// modules/congress-intel.js — Congress & Social Intelligence v3.0
// Calls /api/congress-intel (Vercel serverless proxy)

const CONGRESS_API = "/api/congress-intel";
const WL_SET = new Set(["NVDA","MSFT","AAPL","AMD","MRVL","MU","AVGO","TSM","ASML","PLTR","ORCL","SMCI","META","GOOGL","AMZN","TSLA","SPY","QQQ"]);
const CACHE_MS = 900_000;

let _cache = null;
let _cacheTime = 0;

function esc(v) {
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function relTime(iso) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 2) return "刚刚";
  if (m < 60) return `${m}m前`;
  if (m < 1440) return `${Math.floor(m/60)}h前`;
  return `${Math.floor(m/1440)}d前`;
}
function tradeBadge(type) {
  const t = (type||"").toLowerCase();
  if (/pur|buy|acqui/.test(t)) return `<span class="ci-badge ci-buy">买入</span>`;
  if (/sale|sell|short/.test(t)) return `<span class="ci-badge ci-sell">卖出</span>`;
  return `<span class="ci-badge ci-neutral">${esc((type||"").slice(0,12))}</span>`;
}

// ── Inline compact source pill ────────────────────────────────────────────────
function srcPill(label, status) {
  const cls = status === "live" ? "ci-src-live" : status === "unavailable" ? "ci-src-off" : "ci-src-delay";
  const dot = status === "live" ? "●" : "✕";
  return `<span class="${cls}">${dot} ${esc(label)}</span>`;
}

// ── Fetch from Vercel proxy ───────────────────────────────────────────────────
async function fetchIntelFromAPI() {
  if (_cache && Date.now() - _cacheTime < CACHE_MS) return _cache;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 22000);
    const r = await fetch(CONGRESS_API, {
      cache: "no-store", signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    _cache = data; _cacheTime = Date.now();
    return data;
  } catch (e) {
    console.warn("[CongressIntel]", e.message);
    return null;
  }
}

// ── Confluence ────────────────────────────────────────────────────────────────
function renderConfluence(items) {
  if (!items?.length) return "";
  return `<div class="ci-confluence-block">
    <div class="ci-confluence-title">⚡ 国会 × 社交共振</div>
    <div class="ci-confluence-tags">
      ${items.map(r => `<div class="ci-conf-tag">
        <strong>${esc(r.symbol)}</strong>
        <span class="up">↑${r.buys}</span>
        <span class="down">↓${r.sells}</span>
        <em>${r.members}人</em>
      </div>`).join("")}
    </div>
  </div>`;
}

// ── Congress activity rank ────────────────────────────────────────────────────
function renderActRank(rank) {
  if (!rank?.length) return `<div class="ci-empty">暂无数据</div>`;
  const maxT = Math.max(...rank.map(r => r.buys + r.sells), 1);
  return rank.map(r => {
    const bw = Math.round((r.buys / maxT) * 80);
    const sw = Math.round((r.sells / maxT) * 80);
    const net = r.net > 0 ? `<span class="ci-net-up">▲${r.net}</span>`
              : r.net < 0 ? `<span class="ci-net-dn">▼${Math.abs(r.net)}</span>`
              : `<span class="ci-net-flat">→</span>`;
    return `<div class="ci-rank-row${r.isWL?" ci-rank-wl":""}">
      <div class="ci-rank-sym">${esc(r.symbol)}</div>
      <div class="ci-rank-visual">
        <div class="ci-bar-wrap"><span class="ci-buy-bar" style="width:${bw}px"></span></div>
        <div class="ci-bar-wrap"><span class="ci-sell-bar" style="width:${sw}px"></span></div>
      </div>
      <div class="ci-rank-nums"><span class="up">↑${r.buys}</span><span class="down">↓${r.sells}</span></div>
      <div class="ci-rank-meta">${r.members}人 ${net}</div>
    </div>`;
  }).join("");
}

// ── Trade table ───────────────────────────────────────────────────────────────
function renderTrades(trades) {
  if (!trades?.length) return `<div class="ci-empty">暂无近期申报记录</div>`;
  return `<div class="ci-trade-table">
    <div class="ci-trade-head">
      <span>议员</span><span>院</span><span>股票</span><span>操作</span><span>日期</span>
    </div>
    ${trades.slice(0,30).map(t => `<div class="ci-trade-row${t.isWL?" ci-row-wl":""}">
      <span class="ci-member">${esc((t.member||"").slice(0,18))}</span>
      <span class="ci-chamber-badge">${t.chamber==="众议院"?"众":"参"}</span>
      <span class="ci-ticker">${esc(t.ticker||"–")}</span>
      ${tradeBadge(t.type)}
      <span class="ci-date">${esc(t.date||"")}</span>
    </div>`).join("")}
  </div>`;
}

// ── StockTwits trending — with honest "N/A" when no real sentiment ────────────
function renderTrending(symbols) {
  if (!symbols?.length) return `<div class="ci-empty">StockTwits 数据暂不可用</div>`;
  return `<div class="ci-trending-grid">
    ${symbols.map(s => {
      const hasSent = s.bullPct != null;
      const bull = hasSent ? Math.round(s.bullPct) : null;
      const chg  = s.change != null ? `${s.change>=0?"+":""}${Number(s.change).toFixed(2)}%` : "";
      const sentHtml = hasSent
        ? `<div class="ci-sent-bar-wrap"><div class="ci-sent-bar">
             <div class="ci-sent-bull" style="width:${bull}%"></div>
             <div class="ci-sent-bear" style="width:${100-bull}%"></div>
           </div></div>
           <div class="ci-trend-foot"><span class="up">${bull}%多</span><span class="ci-tmeta">💬${(s.messages||0).toLocaleString()}</span></div>`
        : `<div class="ci-trend-foot"><span class="ci-tmeta">💬${(s.messages||0).toLocaleString()}</span><span class="ci-tmeta">情绪N/A</span></div>`;
      return `<div class="ci-trend-card${s.isWL?" ci-trend-wl":""}">
        <div class="ci-trend-header">
          <strong>${esc(s.symbol)}</strong>
          ${chg?`<span class="${s.change>=0?"up":"down"}">${esc(chg)}</span>`:""}
        </div>
        <div class="ci-trend-name">${esc((s.title||"").slice(0,24))}</div>
        ${sentHtml}
      </div>`;
    }).join("")}
  </div>`;
}

// ── Reddit feed ───────────────────────────────────────────────────────────────
function renderReddit(posts, hotTickers) {
  const tickerRow = hotTickers?.length
    ? `<div class="ci-reddit-tickers"><span class="ci-rtick-label">热议标的：</span>${
        hotTickers.slice(0,10).map(h =>
          `<span class="ci-tick-tag${WL_SET.has(h.symbol)?" ci-tick-wl":""}">${esc(h.symbol)}</span>`
        ).join("")
      }</div>` : "";
  const SUB = { wallstreetbets:"WSB", stocks:"r/Stocks", investing:"r/Invest" };
  const rows = (posts||[]).slice(0,14).map(p => {
    const tix = (p.tickers||[]).map(t =>
      `<span class="ci-tick-tag${WL_SET.has(t)?" ci-tick-wl":""}">${esc(t)}</span>`
    ).join("");
    return `<div class="ci-reddit-row">
      <div class="ci-reddit-meta">
        <span class="ci-sub">${esc(SUB[p.sub]||p.sub)}</span>
        ${p.flair?`<span class="ci-flair">${esc(p.flair)}</span>`:""}
        <span class="ci-score">▲${(p.score||0).toLocaleString()}</span>
        <span class="ci-cmts">💬${p.comments||0}</span>
        <span class="ci-rtime">${relTime(p.created)}</span>
      </div>
      <div class="ci-reddit-title">${esc(p.title)}</div>
      ${tix?`<div class="ci-reddit-tix">${tix}</div>`:""}
    </div>`;
  }).join("");
  return `${tickerRow}<div class="ci-reddit-feed">${rows||'<div class="ci-empty">Reddit 数据暂不可用</div>'}</div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderFromData(el, data) {
  const sources  = data.sources || {};
  const house    = data.congress?.house   || { ok:false, trades:[] };
  const senate   = data.congress?.senate  || { ok:false, trades:[] };
  const trending = data.social?.trending  || { ok:false, symbols:[] };
  const reddit   = data.social?.reddit   || { ok:false, posts:[], hotTickers:[] };
  const intel    = data.intel            || { actRank:[], confluence:[], wlTrades:[], total:0 };

  // Merge all trades, watchlist first
  const wlKeys = new Set((intel.wlTrades||[]).map(t=>`${t.member}|${t.ticker}|${t.date}`));
  const extra  = [...(house.trades||[]),...(senate.trades||[])]
    .filter(t => !t.isWL && !wlKeys.has(`${t.member}|${t.ticker}|${t.date}`))
    .sort((a,b) => new Date(b.date||0)-new Date(a.date||0))
    .slice(0,20);
  const allTrades = [...(intel.wlTrades||[]),...extra].slice(0,35);

  el.innerHTML = `
    <!-- Compact status strip -->
    <div class="ci-status-bar">
      ${srcPill("众议院", sources.house)}
      ${srcPill("参议院", sources.senate)}
      ${srcPill("StockTwits", sources.stocktwits)}
      ${srcPill("Reddit", sources.reddit)}
      <span class="ci-total">近90天申报 · 共 ${intel.total??0} 条</span>
    </div>

    ${renderConfluence(intel.confluence)}

    <div class="ci-main-grid">
      <div class="ci-left-col">
        <div class="ci-panel-title">🏛 国会持股活跃榜 <em>近90天买卖量排序</em></div>
        ${renderActRank(intel.actRank)}
      </div>
      <div class="ci-right-col">
        <div class="ci-panel-title">📋 最新持股申报 <em>观察池<span style="color:var(--gold)">金色</span>优先</em></div>
        ${renderTrades(allTrades)}
      </div>
    </div>

    <div class="ci-section-divider"><span>社交情报 · Social Intelligence</span></div>

    <div class="ci-panel-title">📊 StockTwits 热搜榜 <em>公开API · 无需密钥</em></div>
    ${renderTrending(trending.symbols)}

    <div class="ci-panel-title" style="margin-top:18px">🔥 Reddit 热帖信号 <em>r/wallstreetbets · r/stocks · r/investing</em></div>
    ${renderReddit(reddit.posts, reddit.hotTickers)}

    <div class="ci-footnote">
      数据来源：housestockwatcher.com · senatestockwatcher.com（STOCK Act 披露）·
      api.stocktwits.com · reddit.com · 备用：quiverquant.com。
      国会申报存在 30–45 天延迟。仅供参考，不构成投资建议。
    </div>`;
}

export function getCongressIntelState() { return _cache; }

export async function renderCongressIntel(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.classList.remove("is-loading");
  el.innerHTML = `<div class="ci-skeleton">
    <div class="ci-sk-bar"></div>
    <div class="ci-sk-bar" style="width:65%;margin-top:8px"></div>
    <div style="margin-top:14px;display:flex;gap:10px">
      <div class="ci-sk-box"></div><div class="ci-sk-box"></div>
      <div class="ci-sk-box"></div><div class="ci-sk-box"></div>
    </div>
    <div class="ci-sk-bar" style="margin-top:14px"></div>
    <div class="ci-sk-bar" style="width:80%;margin-top:8px"></div>
  </div>`;
  const data = await fetchIntelFromAPI();
  if (!data) {
    el.innerHTML = `<div class="ci-error">
      <div class="ci-error-icon">⚠</div>
      <div class="ci-error-title">数据获取失败</div>
      <div class="ci-error-desc">政要持股数据暂时不可用，请稍后刷新。</div>
    </div>`;
    return;
  }
  renderFromData(el, data);
}
