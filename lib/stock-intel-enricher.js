// lib/stock-intel-enricher.js
// Specularis Market Terminal Lite v1.3.4 — 个股情报增强引擎
//
// 解决问题：个股情报Pro字段依赖手动填报 → 全自动从Yahoo/Finnhub拉取并填充
// 数据源层级：Yahoo QuoteSummary（分析师/目标价/财报/内部人）> Finnhub新闻 > Google News RSS

export const ENRICHER_VERSION = "v1.3.4";

async function fetchJsonSafe(label, url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 5000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) return { _error: `http_${res.status}`, _label: label };
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { _error: "parse_fail", _label: label }; }
  } catch (e) {
    return { _error: e?.message || "fetch_fail", _label: label };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchYahooEnrichment(ticker) {
  const modules = [
    "price", "summaryDetail", "financialData", "defaultKeyStatistics",
    "recommendationTrend", "calendarEvents", "upgradeDowngradeHistory",
    "insiderTransactions", "institutionOwnership",
  ].join(",");
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${encodeURIComponent(modules)}&corsDomain=finance.yahoo.com`;
  const payload = await fetchJsonSafe(`yahoo_enrich_${ticker}`, url, { timeoutMs: 4500 });
  if (payload._error) return { ticker, status: "unavailable", error: payload._error };
  const row = payload?.quoteSummary?.result?.[0];
  if (!row) return { ticker, status: "unavailable", error: "no_result" };
  try {
    const financial = row.financialData || {};
    const summary   = row.summaryDetail || {};
    const stats     = row.defaultKeyStatistics || {};
    const priceM    = row.price || {};
    const upgrades  = row.upgradeDowngradeHistory?.history || [];
    const calendar  = row.calendarEvents || {};
    const insiders  = row.insiderTransactions?.transactions || [];
    const instOwn   = row.institutionOwnership?.ownershipList || [];

    const currentPrice = Number(priceM.regularMarketPrice?.raw ?? financial.currentPrice?.raw ?? NaN);
    const week52High   = Number(summary.fiftyTwoWeekHigh?.raw ?? NaN);
    const week52Low    = Number(summary.fiftyTwoWeekLow?.raw  ?? NaN);
    const targetMean   = Number(financial.targetMeanPrice?.raw ?? financial.targetMedianPrice?.raw ?? NaN);
    const recKey       = financial.recommendationKey || "";
    const recMean      = Number(financial.recommendationMean?.raw ?? NaN);
    const analystCount = Number(financial.numberOfAnalystOpinions?.raw ?? 0);

    const analystTone = (() => {
      const k = recKey.toLowerCase();
      if (k.includes("strong_buy") || k === "buy")  return "bullish";
      if (k.includes("hold") || k === "neutral")     return "neutral";
      if (k.includes("sell"))                        return "bearish";
      if (Number.isFinite(recMean)) {
        if (recMean <= 2.0) return "bullish";
        if (recMean <= 2.8) return "neutral";
        return "bearish";
      }
      return "unavailable";
    })();

    const upside = Number.isFinite(targetMean) && Number.isFinite(currentPrice) && currentPrice > 0
      ? ((targetMean - currentPrice) / currentPrice) * 100 : null;

    const institutionalSignal = upside == null ? "unavailable"
      : upside > 12 ? "accumulating" : upside < -8 ? "distributing" : "neutral";

    const threeMonthsAgo = Date.now() - 90 * 24 * 3600 * 1000;
    const recentUpgrades = upgrades
      .filter(u => Number(u.epochGradeDate) * 1000 > threeMonthsAgo).slice(0, 4)
      .map(u => ({ firm: u.firm || "", action: u.action || "", toGrade: u.toGrade || "", fromGrade: u.fromGrade || "", date: u.epochGradeDate ? new Date(Number(u.epochGradeDate) * 1000).toISOString().slice(0,10) : null }));

    const earningsDateRaw = Array.isArray(calendar.earnings?.earningsDate) && calendar.earnings.earningsDate[0]?.fmt
      ? calendar.earnings.earningsDate[0].fmt : null;

    const recentInsiders = insiders.filter(t => Number(t.startDate?.raw) * 1000 > threeMonthsAgo).slice(0, 8);
    const insiderBuys  = recentInsiders.filter(t => /(purchase|acquisition|buy)/i.test(t.transactionText || "")).length;
    const insiderSells = recentInsiders.filter(t => /(sale|sell|disposition)/i.test(t.transactionText || "")).length;
    const insiderSignal = recentInsiders.length === 0 ? null
      : insiderBuys > insiderSells ? "净增持" : insiderSells > insiderBuys ? "净减持" : "中性";

    const keySupport = Number.isFinite(currentPrice) && currentPrice > 0
      ? Number(Math.max(Number.isFinite(week52Low) ? week52Low : 0, currentPrice * 0.94).toFixed(2)) : null;
    const keyResistance = Number.isFinite(currentPrice) && currentPrice > 0
      ? Number(Math.min(Number.isFinite(week52High) ? week52High : Infinity, currentPrice * 1.07).toFixed(2)) : null;

    const tradeRelevance = analystTone === "bullish" && (upside == null || upside > 5) ? "tradable"
      : analystTone === "bearish" || (upside != null && upside < -10) ? "avoid" : "watch";

    const instActivity = (() => {
      if (!instOwn.length) return null;
      const sorted = [...instOwn].sort((a,b) => Number(b.reportDate?.raw||0) - Number(a.reportDate?.raw||0));
      const pctHeld = Number(sorted[0]?.pctHeld?.raw ?? NaN);
      return Number.isFinite(pctHeld) ? `${(pctHeld*100).toFixed(1)}% 机构持仓` : null;
    })();

    return {
      ticker, status: "delayed",
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
      analystTone, analystCount,
      recommendationKey: recKey,
      recommendationMean: Number.isFinite(recMean) ? recMean : null,
      targetMeanPrice: Number.isFinite(targetMean) ? targetMean : null,
      upsidePct: upside != null ? Number(upside.toFixed(1)) : null,
      institutionalSignal, instActivity,
      insiderSignal, insiderBuys, insiderSells,
      earningsDate: earningsDateRaw,
      week52High: Number.isFinite(week52High) ? week52High : null,
      week52Low:  Number.isFinite(week52Low)  ? week52Low  : null,
      keySupport, keyResistance, tradeRelevance, recentUpgrades,
      beta: Number(stats.beta?.raw ?? summary.beta?.raw ?? NaN),
      fetchedAt: Date.now(),
    };
  } catch (err) {
    return { ticker, status: "unavailable", error: err?.message || "parse_error" };
  }
}

export async function fetchYahooOptions(ticker) {
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`;
  const payload = await fetchJsonSafe(`yahoo_opts_${ticker}`, url, { timeoutMs: 4000 });
  if (payload._error) return { ticker, status: "unavailable", error: payload._error };
  const result = payload?.optionChain?.result?.[0];
  const block = result?.options?.[0];
  if (!block) return { ticker, status: "unavailable", error: "no_chain" };
  try {
    const calls = block.calls || [];
    const puts  = block.puts  || [];
    const sumV = arr => arr.reduce((s,c) => s + (Number(c.volume)||0), 0);
    const sumO = arr => arr.reduce((s,c) => s + (Number(c.openInterest)||0), 0);
    const avgI = arr => { const v = arr.map(c=>Number(c.impliedVolatility)).filter(x=>Number.isFinite(x)&&x>0); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
    const callVol=sumV(calls), putVol=sumV(puts);
    const callOI=sumO(calls),  putOI=sumO(puts);
    const callIV=avgI(calls), putIV=avgI(puts);
    const avgIVc = (callIV&&putIV) ? (callIV+putIV)/2 : (callIV||putIV||null);
    const pcrVol = callVol > 0 ? putVol/callVol : null;
    const pcrOI  = callOI  > 0 ? putOI/callOI   : null;
    const flowBias = pcrVol==null ? "neutral" : pcrVol>=1.3 ? "put_heavy" : pcrVol<=0.7 ? "call_heavy" : "neutral";
    const callWall = calls.reduce((m,c)=>Number(c.openInterest)>m.oi?{strike:c.strike,oi:Number(c.openInterest)}:m,{strike:null,oi:0});
    const putWall  = puts.reduce( (m,p)=>Number(p.openInterest)>m.oi?{strike:p.strike,oi:Number(p.openInterest)}:m,{strike:null,oi:0});
    return {
      ticker, status: "delayed",
      expiration: block.expirationDate ? new Date(Number(block.expirationDate)*1000).toISOString().slice(0,10) : null,
      callVolume: callVol, putVolume: putVol, callOI, putOI,
      pcrVol: pcrVol!=null?Number(pcrVol.toFixed(3)):null,
      pcrOI:  pcrOI!=null ?Number(pcrOI.toFixed(3)):null,
      avgIV:  avgIVc!=null?Number((avgIVc*100).toFixed(1)):null,
      callIV: callIV!=null?Number((callIV*100).toFixed(1)):null,
      putIV:  putIV!=null ?Number((putIV*100).toFixed(1)):null,
      flowBias,
      callWallStrike: callWall.strike ?? null,
      putWallStrike:  putWall.strike  ?? null,
      contractsSampled: calls.length + puts.length,
      source: "Yahoo Options unofficial", fetchedAt: Date.now(),
    };
  } catch (err) {
    return { ticker, status: "unavailable", error: err?.message || "parse_error" };
  }
}

export async function fetchGoogleNewsForTicker(ticker, companyName = "") {
  const q = companyName
    ? `${ticker} OR "${companyName.split(" ")[0]}" stock earnings analyst`
    : `${ticker} stock earnings analyst`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SpecularisTerminal/1.3.4)", Accept: "application/rss+xml,text/xml,*/*" },
    });
    if (!res.ok) return [];
    const rss = await res.text();
    return [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 5).map(m => {
      const b = m[1];
      const title   = stripXml(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
      const summary = stripXml(b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "") || title;
      const pubDate = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "";
      const link    = stripXml(b.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
      return {
        title: title.slice(0, 160), summary: summary.slice(0, 280),
        url: link || null,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
        source: "Google News",
        sentiment: guessSentiment(`${title} ${summary}`),
        dataStatus: "delayed",
      };
    }).filter(n => n.title.length > 10);
  } catch { return []; }
}

function stripXml(s) {
  return String(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g,"")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}

function guessSentiment(text) {
  const l = String(text||"").toLowerCase();
  if (/(beat|upgrade|raise|outperform|buy|bullish|growth|strong|record|surge|rally|breakout)/.test(l)) return "BULLISH";
  if (/(miss|downgrade|cut|underperform|sell|bearish|weak|decline|drop|crash|warning|loss)/.test(l))   return "BEARISH";
  return "NEUTRAL";
}

export async function enrichStockWatchlist(tickers, opts = {}) {
  const { finnhubKey = "", companyMeta = {}, concurrency = 3 } = opts;
  const results = [];
  for (let i = 0; i < tickers.length; i += concurrency) {
    const batch = tickers.slice(i, i + concurrency);
    const br = await Promise.all(batch.map(async ticker => {
      const companyName = companyMeta[ticker]?.name || "";
      const [enrichment, options, news] = await Promise.all([
        fetchYahooEnrichment(ticker),
        fetchYahooOptions(ticker),
        fetchGoogleNewsForTicker(ticker, companyName),
      ]);
      return { ticker, enrichment, options, news: dedupeNews(news).slice(0, 5), enrichedAt: Date.now() };
    }));
    results.push(...br);
    if (i + concurrency < tickers.length) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

function dedupeNews(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = String(item.title||"").toLowerCase().slice(0,120);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function applyEnrichmentToSipEntry(sipEntry, enrichResult) {
  if (!sipEntry || !enrichResult) return sipEntry;
  const { enrichment: e, options: o, news: n } = enrichResult;
  const out = { ...sipEntry };
  if (e?.analystTone && e.analystTone !== "unavailable") {
    out.analystTone     = e.analystTone;
    out.analystCount    = e.analystCount || null;
    out.targetMeanPrice = e.targetMeanPrice || null;
    out.upsidePct       = e.upsidePct ?? null;
    out.recentUpgrades  = e.recentUpgrades || [];
  }
  if (e?.institutionalSignal && e.institutionalSignal !== "unavailable") {
    out.institutionalSignal = e.institutionalSignal;
    out.instActivity = e.instActivity || null;
  }
  if (e?.insiderSignal) {
    out.insiderSignal = e.insiderSignal;
    out.insiderBuys   = e.insiderBuys  ?? null;
    out.insiderSells  = e.insiderSells ?? null;
  }
  if (e?.earningsDate && !out.earningsDate) out.earningsDate = e.earningsDate;
  if (e?.keySupport    != null) out.keySupport    = e.keySupport;
  if (e?.keyResistance != null) out.keyResistance = e.keyResistance;
  out.week52High = e?.week52High || null;
  out.week52Low  = e?.week52Low  || null;
  if (e?.tradeRelevance) out.tradeRelevance = e.tradeRelevance;
  if (n && n.length > 0) out.recentNews = n.map(i => ({ title:i.title, summary:i.summary, source:i.source, url:i.url, sentiment:i.sentiment, dataStatus:i.dataStatus }));
  if (o?.status === "delayed") out.optionsData = { pcrVol:o.pcrVol, pcrOI:o.pcrOI, avgIV:o.avgIV, flowBias:o.flowBias, callWallStrike:o.callWallStrike, putWallStrike:o.putWallStrike, expiration:o.expiration, callVolume:o.callVolume, putVolume:o.putVolume };
  const rf = new Set(sipEntry.riskFlags||[]);
  if (e?.beta && Number.isFinite(e.beta) && e.beta > 1.5) rf.add("high_beta");
  if (o?.avgIV && o.avgIV > 55) rf.add("high_iv");
  if (e?.earningsDate) rf.add("earnings_event");
  if (e?.analystTone === "bearish") rf.add("analyst_bearish");
  if (o?.flowBias === "put_heavy") rf.add("put_flow");
  out.riskFlags = [...rf];
  out.aiSummary = buildRichAiSummary(out, e, o);
  out.dataStatus = sipEntry.dataStatus === "placeholder" ? "proxy" : sipEntry.dataStatus;
  out.enrichedAt = Date.now();
  out.enrichVersion = ENRICHER_VERSION;
  return out;
}

function buildRichAiSummary(entry, e, o) {
  const parts = [];
  if (entry.currentPrice) parts.push(`当前价 $${entry.currentPrice}，日内 ${entry.dailyChangePercent!=null?(entry.dailyChangePercent>=0?"+":"")+entry.dailyChangePercent+"%":"--"}`);
  if (e?.analystTone && e.analystTone !== "unavailable") {
    const m = { bullish:"买入/看多", neutral:"持有/中性", bearish:"卖出/看空" };
    parts.push(`分析师共识：${m[e.analystTone]||e.analystTone}${e.analystCount?`（${e.analystCount}家）`:""}${e.targetMeanPrice?`，目标均价 $${e.targetMeanPrice}`:""}${e.upsidePct!=null?`（上行 ${e.upsidePct}%）`:""}`);
  }
  if (e?.insiderSignal) parts.push(`内部人：${e.insiderSignal}（买${e.insiderBuys||0}/卖${e.insiderSells||0}）`);
  if (o?.status === "delayed") {
    parts.push(`期权：P/C量比 ${o.pcrVol??"--"}，偏 ${o.flowBias==="call_heavy"?"Call":o.flowBias==="put_heavy"?"Put":"中性"}，IV ${o.avgIV??"--"}%`);
    if (o.callWallStrike) parts.push(`Call Wall $${o.callWallStrike}，Put Wall $${o.putWallStrike||"--"}`);
  }
  if (entry.earningsDate) parts.push(`财报：${entry.earningsDate}`);
  if (entry.week52High && entry.week52Low) parts.push(`52周：$${entry.week52Low}–$${entry.week52High}`);
  return parts.length ? parts.join("。") + "。仅供研究。" : "等待数据源恢复。";
}
