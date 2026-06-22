// modules/congress-intel.js
// Specularis Market Intelligence — Congress & Social Intelligence Module v2.0
// ✅ PURE FRONTEND: calls external APIs directly from browser via CORS
// ✅ Works on GitHub Pages, Vercel, any static host — NO serverless required
// ✅ Zero API keys needed
//
// Data sources (all CORS-enabled, all free, no key):
//   • housestockwatcher.com/api     — House STOCK Act disclosures
//   • senatestockwatcher.com/api    — Senate STOCK Act disclosures
//   • api.stocktwits.com/api/2/...  — Social sentiment (public JSON)
//   • reddit.com/r/*.json           — Reddit hot posts (public JSON)

const HOUSE_API    = "https://housestockwatcher.com/api";
const SENATE_API   = "https://senatestockwatcher.com/api";
const ST_TRENDING  = "https://api.stocktwits.com/api/2/trending/symbols.json?limit=30";
const ST_STREAM    = (s) => `https://api.stocktwits.com/api/2/streams/symbol/${s}.json?limit=8`;
const REDDIT_WSB   = "https://www.reddit.com/r/wallstreetbets/hot.json?limit=25";
const REDDIT_STKS  = "https://www.reddit.com/r/stocks/hot.json?limit=15";
const REDDIT_INV   = "https://www.reddit.com/r/investing/hot.json?limit=10";

const WATCHLIST = ["NVDA","MSFT","AAPL","AMD","MRVL","MU","AVGO","TSM","ASML","PLTR","ORCL","SMCI","META","GOOGL","AMZN","TSLA","SPY","QQQ"];
const WL_SET = new Set(WATCHLIST);
const TICKER_RE = /\b([A-Z]{2,5})\b/g;

let _cache = null;
let _lastFetch = 0;
const CACHE_MS = 900_000; // 15 min

// ── DOM helpers ───────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function relTime(iso) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1)  return "刚刚";
  if (m < 60) return `${m}m前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h前`;
  return `${Math.floor(h/24)}d前`;
}
function tradeBadge(type = "") {
  const t = type.toLowerCase();
  if (/pur|buy|acqui/.test(t)) return `<span class="ci-badge ci-buy">买入 BUY</span>`;
  if (/sale|sell|short|exch/.test(t)) return `<span class="ci-badge ci-sell">卖出 SELL</span>`;
  return `<span class="ci-badge ci-neutral">${esc(type.slice(0,14))}</span>`;
}
function srcDot(ok) {
  return ok
    ? `<span class="ci-src-live">● LIVE</span>`
    : `<span class="ci-src-off">✕ 离线</span>`;
}

// ── Data fetchers (direct CORS, browser-side) ─────────────────────────────────
async function safeGet(url, opts = {}) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: { "Accept": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function getHouseTrades() {
  const d = await safeGet(HOUSE_API);
  if (!d) return { ok: false, trades: [] };
  const arr = Array.isArray(d) ? d : (d.data || d.transactions || []);
  const cutoff = Date.now() - 90 * 86400000;
  return {
    ok: true,
    trades: arr
      .filter(t => new Date(t.transaction_date || t.disclosure_date || t.filed_at || 0) >= cutoff)
      .sort((a, b) =>
        new Date(b.transaction_date || b.disclosure_date || 0) -
        new Date(a.transaction_date || a.disclosure_date || 0))
      .slice(0, 100)
      .map(t => ({
        chamber:  "众议院",
        member:   t.representative || t.member_name || t.name || "Unknown",
        ticker:   (t.ticker || "").replace("$","").toUpperCase().trim(),
        company:  (t.asset_description || t.company || "").slice(0,40),
        type:     t.type || t.transaction_type || "–",
        amount:   t.amount || t.transaction_amount || "–",
        date:     (t.transaction_date || t.disclosure_date || t.filed_at || "").slice(0,10),
        state:    t.district || t.state || "",
        isWL:     WL_SET.has((t.ticker || "").replace("$","").toUpperCase().trim()),
      })),
  };
}

async function getSenateTrades() {
  const d = await safeGet(SENATE_API);
  if (!d) return { ok: false, trades: [] };
  const arr = Array.isArray(d) ? d : (d.data || d.transactions || []);
  const cutoff = Date.now() - 90 * 86400000;
  return {
    ok: true,
    trades: arr
      .filter(t => new Date(t.transaction_date || t.disclosure_date || t.filed_at || 0) >= cutoff)
      .sort((a, b) =>
        new Date(b.transaction_date || b.disclosure_date || 0) -
        new Date(a.transaction_date || a.disclosure_date || 0))
      .slice(0, 80)
      .map(t => ({
        chamber:  "参议院",
        member:   t.senator || t.member_name || t.name || "Unknown",
        ticker:   (t.ticker || "").replace("$","").toUpperCase().trim(),
        company:  (t.asset_description || t.company || "").slice(0,40),
        type:     t.type || t.transaction_type || "–",
        amount:   t.amount || t.transaction_amount || "–",
        date:     (t.transaction_date || t.disclosure_date || t.filed_at || "").slice(0,10),
        state:    t.state || "",
        isWL:     WL_SET.has((t.ticker || "").replace("$","").toUpperCase().trim()),
      })),
  };
}

async function getStockTwitsTrending() {
  const d = await safeGet(ST_TRENDING);
  if (!d?.symbols) return { ok: false, symbols: [] };
  return {
    ok: true,
    symbols: d.symbols.slice(0, 16).map(s => ({
      symbol:   s.symbol,
      title:    s.title || "",
      watchlist:s.watchlist_count || 0,
      messages: s.messages_count || s.message_count || 0,
      bullPct:  s.symbol_sentiment?.bull_percent ?? 50,
      bearPct:  s.symbol_sentiment?.bear_percent ?? 50,
      price:    s.prices?.last?.close ?? null,
      change:   s.prices?.last?.change_percent ?? null,
      isWL:     WL_SET.has(s.symbol),
    })),
  };
}

async function getWLSentiment() {
  const tickers = ["NVDA","AMD","PLTR","META","TSLA","SPY","QQQ"];
  const results = await Promise.allSettled(tickers.map(async sym => {
    const d = await safeGet(ST_STREAM(sym));
    if (!d?.messages) return null;
    const msgs = d.messages;
    const bull = msgs.filter(m => m.entities?.sentiment?.basic === "Bullish").length;
    const bear = msgs.filter(m => m.entities?.sentiment?.basic === "Bearish").length;
    const total = bull + bear || 1;
    return {
      symbol:   sym,
      bullPct:  Math.round(bull / total * 100),
      bearPct:  Math.round(bear / total * 100),
      preview:  msgs.slice(0,1).map(m => ({
        text:      (m.body || "").slice(0,100),
        sentiment: m.entities?.sentiment?.basic || "",
        user:      m.user?.username || "",
      })),
    };
  }));
  return results.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
}

async function getReddit() {
  const [wsb, stk, inv] = await Promise.all([
    safeGet(REDDIT_WSB, { headers: { "User-Agent": "Specularis/7.0" } }),
    safeGet(REDDIT_STKS, { headers: { "User-Agent": "Specularis/7.0" } }),
    safeGet(REDDIT_INV,  { headers: { "User-Agent": "Specularis/7.0" } }),
  ]);

  function parsePosts(data, sub) {
    return (data?.data?.children || [])
      .filter(c => c.kind === "t3" && !c.data.stickied && (c.data.score || 0) > 5)
      .map(c => {
        const d = c.data;
        const text = `${d.title || ""} ${(d.selftext || "").slice(0,300)}`;
        const tickers = [...new Set((text.match(TICKER_RE) || []).filter(t => WL_SET.has(t)))];
        return {
          sub, title: (d.title || "").slice(0,140),
          score: d.score || 0, comments: d.num_comments || 0,
          created: new Date((d.created_utc || 0)*1000).toISOString(),
          tickers, flair: (d.link_flair_text || "").slice(0,20),
          url: d.url || "",
        };
      });
  }

  const all = [
    ...parsePosts(wsb, "wallstreetbets"),
    ...parsePosts(stk, "stocks"),
    ...parsePosts(inv, "investing"),
  ].sort((a,b) => b.score - a.score);

  // Ticker heat map
  const freq = {};
  for (const p of all)
    for (const t of p.tickers)
      freq[t] = (freq[t] || 0) + 1 + Math.log1p(p.score / 200);

  const hotTickers = Object.entries(freq)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 10)
    .map(([symbol, heat]) => ({ symbol, heat: Math.round(heat*10)/10 }));

  return { ok: all.length > 0, posts: all.slice(0, 18), hotTickers };
}

// ── Intelligence synthesis ────────────────────────────────────────────────────
function synthesize(house, senate, trending, wlSentiment, reddit) {
  const all = [...house.trades, ...senate.trades];

  // Per-ticker activity
  const activity = {};
  for (const t of all) {
    const sym = t.ticker;
    if (!sym || sym.length > 5 || sym.length < 1) continue;
    if (!activity[sym]) activity[sym] = { buys:0, sells:0, members: new Set(), isWL: t.isWL };
    const isBuy = /pur|buy|acqui/i.test(t.type);
    if (isBuy) activity[sym].buys++; else activity[sym].sells++;
    activity[sym].members.add(t.member);
  }

  const actRank = Object.entries(activity)
    .map(([sym, v]) => ({ symbol:sym, buys:v.buys, sells:v.sells,
      members:v.members.size, net:v.buys-v.sells, isWL:v.isWL }))
    .sort((a,b) => (b.buys+b.sells) - (a.buys+a.sells))
    .slice(0, 14);

  // Social hot set
  const socialHot = new Set([
    ...(trending.symbols || []).map(s => s.symbol),
    ...(reddit.hotTickers || []).map(h => h.symbol),
  ]);

  const confluence = actRank.filter(r => socialHot.has(r.symbol));

  // Watchlist trades only (sorted)
  const wlTrades = all
    .filter(t => t.isWL)
    .sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
    .slice(0, 20);

  return { actRank, confluence, wlTrades, total: all.length };
}

// ── Render helpers ────────────────────────────────────────────────────────────
function renderConfluence(items) {
  if (!items.length) return "";
  return `<div class="ci-confluence-block">
    <div class="ci-confluence-title">⚡ 国会 × 社交共振信号</div>
    <div class="ci-confluence-desc">以下标的同时出现在国会持股变动 & 社交热搜，值得重点关注</div>
    <div class="ci-confluence-tags">
      ${items.map(r => `<div class="ci-conf-tag">
        <strong>${esc(r.symbol)}</strong>
        <span class="up">↑${r.buys}买</span>
        <span class="down">↓${r.sells}卖</span>
        <span>${r.members}人</span>
      </div>`).join("")}
    </div>
  </div>`;
}

function renderActRank(rank) {
  if (!rank.length) return `<div class="ci-empty">暂无数据</div>`;
  return rank.map(r => {
    const maxBar = Math.max(...rank.map(x => x.buys + x.sells), 1);
    const bw = Math.round(r.buys / maxBar * 88);
    const sw = Math.round(r.sells / maxBar * 88);
    const net = r.net > 0 ? `<span class="ci-net-up">▲${r.net}</span>`
              : r.net < 0 ? `<span class="ci-net-dn">▼${Math.abs(r.net)}</span>`
              : `<span class="ci-net-flat">→0</span>`;
    return `<div class="ci-rank-row${r.isWL ? " ci-rank-wl" : ""}">
      <div class="ci-rank-sym">${esc(r.symbol)}</div>
      <div class="ci-rank-visual">
        <div class="ci-bar-wrap">
          <span class="ci-buy-bar" style="width:${bw}px" title="买入 ${r.buys}次"></span>
        </div>
        <div class="ci-bar-wrap">
          <span class="ci-sell-bar" style="width:${sw}px" title="卖出 ${r.sells}次"></span>
        </div>
      </div>
      <div class="ci-rank-nums"><span class="up">↑${r.buys}</span><span class="down">↓${r.sells}</span></div>
      <div class="ci-rank-meta">${r.members}人 ${net}</div>
    </div>`;
  }).join("");
}

function renderTrades(trades) {
  if (!trades.length) return `<div class="ci-empty">暂无近期申报记录</div>`;
  return `<div class="ci-trade-table">
    <div class="ci-trade-head">
      <span>议员</span><span>院</span><span>股票</span><span>操作</span><span>金额</span><span>日期</span>
    </div>
    ${trades.map(t => `<div class="ci-trade-row${t.isWL ? " ci-row-wl" : ""}">
      <span class="ci-member" title="${esc(t.state)}">${esc(t.member.length>16 ? t.member.slice(0,16)+"…" : t.member)}</span>
      <span class="ci-chamber-badge">${esc(t.chamber === "众议院" ? "众" : "参")}</span>
      <span class="ci-ticker">${esc(t.ticker||"–")}</span>
      ${tradeBadge(t.type)}
      <span class="ci-amount" title="${esc(t.amount)}">${esc((String(t.amount||"")).slice(0,18))}</span>
      <span class="ci-date">${esc(t.date)}</span>
    </div>`).join("")}
  </div>`;
}

function renderTrending(symbols) {
  if (!symbols.length) return `<div class="ci-empty">StockTwits 数据暂不可用</div>`;
  return `<div class="ci-trending-grid">
    ${symbols.map(s => {
      const bull = Math.round(s.bullPct ?? 50);
      const chg = s.change != null ? `${s.change>=0?"+":""}${Number(s.change).toFixed(2)}%` : "";
      return `<div class="ci-trend-card${s.isWL ? " ci-trend-wl" : ""}">
        <div class="ci-trend-header">
          <strong>${esc(s.symbol)}</strong>
          ${chg ? `<span class="${s.change>=0?"up":"down"}">${esc(chg)}</span>` : ""}
        </div>
        <div class="ci-trend-name">${esc((s.title||"").slice(0,22))}</div>
        <div class="ci-sent-bar-wrap">
          <div class="ci-sent-bar">
            <div class="ci-sent-bull" style="width:${bull}%"></div>
            <div class="ci-sent-bear" style="width:${100-bull}%"></div>
          </div>
        </div>
        <div class="ci-trend-foot">
          <span class="up">${bull}%看多</span>
          <span class="ci-tmeta">💬${s.messages?.toLocaleString()||0}</span>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

function renderWLSentiment(sentiment) {
  if (!sentiment.length) return "";
  return `<div class="ci-wl-sentiment">
    ${sentiment.map(s => {
      const bull = s.bullPct ?? 50;
      const preview = s.preview?.[0];
      return `<div class="ci-wl-sent-card">
        <div class="ci-wl-sym">${esc(s.symbol)}</div>
        <div class="ci-sent-bar-wrap">
          <div class="ci-sent-bar">
            <div class="ci-sent-bull" style="width:${bull}%"></div>
            <div class="ci-sent-bear" style="width:${100-bull}%"></div>
          </div>
        </div>
        <div class="ci-sent-pct"><span class="up">${bull}%</span><span class="down">${s.bearPct}%</span></div>
        ${preview ? `<div class="ci-msg-preview${preview.sentiment==="Bullish"?" msg-bull":preview.sentiment==="Bearish"?" msg-bear":""}">
          <span class="ci-msg-user">@${esc(preview.user)}</span>${esc(preview.text)}
        </div>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

function renderReddit(posts, hotTickers) {
  const tickerRow = hotTickers.length
    ? `<div class="ci-reddit-tickers"><span class="ci-rtick-label">热议标的：</span>${
        hotTickers.slice(0,8).map(h =>
          `<span class="ci-tick-tag${WL_SET.has(h.symbol)?" ci-tick-wl":""}">${esc(h.symbol)}</span>`
        ).join("")
      }</div>` : "";

  const rows = posts.slice(0, 12).map(p => {
    const sub = {wallstreetbets:"WSB",stocks:"r/Stocks",investing:"r/Investing"}[p.sub] || p.sub;
    const tix = p.tickers.map(t =>
      `<span class="ci-tick-tag${WL_SET.has(t)?" ci-tick-wl":""}">${esc(t)}</span>`
    ).join("");
    return `<div class="ci-reddit-row">
      <div class="ci-reddit-meta">
        <span class="ci-sub">${esc(sub)}</span>
        ${p.flair ? `<span class="ci-flair">${esc(p.flair)}</span>` : ""}
        <span class="ci-score">▲${p.score.toLocaleString()}</span>
        <span class="ci-cmts">💬${p.comments}</span>
        <span class="ci-rtime">${relTime(p.created)}</span>
      </div>
      <div class="ci-reddit-title">${esc(p.title)}</div>
      ${tix ? `<div class="ci-reddit-tix">${tix}</div>` : ""}
    </div>`;
  }).join("");

  return `${tickerRow}<div class="ci-reddit-feed">${rows || '<div class="ci-empty">Reddit 数据暂不可用</div>'}</div>`;
}

// ── Main entry point ──────────────────────────────────────────────────────────
export function getCongressIntelState() { return _cache; }

export async function renderCongressIntel(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.classList.remove("is-loading");

  // Show skeleton immediately
  el.innerHTML = `<div class="ci-skeleton">
    <div class="ci-sk-bar"></div>
    <div class="ci-sk-bar" style="width:68%;margin-top:8px"></div>
    <div class="ci-sk-bar" style="width:45%;margin-top:8px"></div>
    <div style="margin-top:14px;display:flex;gap:10px">
      ${[1,2,3,4].map(()=>`<div class="ci-sk-box"></div>`).join("")}
    </div>
    <div class="ci-sk-bar" style="margin-top:14px"></div>
    <div class="ci-sk-bar" style="width:80%;margin-top:8px"></div>
  </div>`;

  // Use cache if fresh
  if (_cache && Date.now() - _lastFetch < CACHE_MS) {
    renderFromData(el, _cache);
    return;
  }

  // Fetch all sources in parallel
  const [house, senate, trending, wlSentiment, reddit] = await Promise.all([
    getHouseTrades(),
    getSenateTrades(),
    getStockTwitsTrending(),
    getWLSentiment(),
    getReddit(),
  ]);

  const intel = synthesize(house, senate, trending, wlSentiment, reddit);
  _cache = { house, senate, trending, wlSentiment, reddit, intel };
  _lastFetch = Date.now();

  renderFromData(el, _cache);
}

function renderFromData(el, data) {
  const { house, senate, trending, wlSentiment, reddit, intel } = data;

  // All trades combined, watchlist first
  const allTrades = [
    ...intel.wlTrades,
    ...[...house.trades, ...senate.trades]
      .filter(t => !t.isWL)
      .sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .slice(0, 30),
  ].slice(0, 35);

  el.innerHTML = `
    <!-- ── Status bar ─────────────────────────────── -->
    <div class="ci-status-bar">
      <span>众议院 ${srcDot(house.ok)}</span>
      <span>参议院 ${srcDot(senate.ok)}</span>
      <span>StockTwits ${srcDot(trending.ok)}</span>
      <span>Reddit ${srcDot(reddit.ok)}</span>
      <span class="ci-total">近90天申报 · 共 ${intel.total} 条</span>
    </div>

    <!-- ── Confluence alert ───────────────────────── -->
    ${renderConfluence(intel.confluence)}

    <!-- ── Two-column: rank + trades ─────────────── -->
    <div class="ci-main-grid">
      <div class="ci-left-col">
        <div class="ci-panel-title">
          <span class="ci-panel-icon">🏛</span> 国会持股活跃榜
          <em>近90天 · 买卖量排序</em>
        </div>
        ${renderActRank(intel.actRank)}
      </div>
      <div class="ci-right-col">
        <div class="ci-panel-title">
          <span class="ci-panel-icon">📋</span> 最新持股申报
          <em>观察池标的 <span style="color:var(--gold)">金色</span> 优先</em>
        </div>
        ${renderTrades(allTrades)}
      </div>
    </div>

    <!-- ── Divider ────────────────────────────────── -->
    <div class="ci-section-divider"><span>社交情报 · Social Intelligence</span></div>

    <!-- ── StockTwits trending ───────────────────── -->
    <div class="ci-panel-title">
      <span class="ci-panel-icon">📊</span> StockTwits 热搜榜
      <em>公开 API · 无需密钥 · 实时情绪比例</em>
    </div>
    ${renderTrending(trending.symbols || [])}

    <!-- ── Watchlist sentiment ───────────────────── -->
    ${wlSentiment.length ? `
    <div class="ci-panel-title" style="margin-top:18px">
      <span class="ci-panel-icon">🎯</span> 观察池情绪流
      <em>NVDA · AMD · PLTR · META · TSLA · SPY · QQQ</em>
    </div>
    ${renderWLSentiment(wlSentiment)}` : ""}

    <!-- ── Reddit ─────────────────────────────────── -->
    <div class="ci-panel-title" style="margin-top:18px">
      <span class="ci-panel-icon">🔥</span> Reddit 热帖信号
      <em>r/wallstreetbets · r/stocks · r/investing</em>
    </div>
    ${renderReddit(reddit.posts || [], reddit.hotTickers || [])}

    <!-- ── Footnote ───────────────────────────────── -->
    <div class="ci-footnote">
      数据来源均为免费公开 API，无需密钥：
      housestockwatcher.com · senatestockwatcher.com（STOCK Act 披露数据库）·
      api.stocktwits.com · reddit.com/r/*.json。
      国会申报存在 30–45 天披露延迟。仅供参考，不构成投资建议。
    </div>`;
}
