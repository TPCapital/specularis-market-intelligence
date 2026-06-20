// modules/congress-intel.js — Congress & Social Intelligence v2.1
// All data fetched via /api/congress-intel (Vercel serverless proxy)
// No direct CORS calls from browser. No API keys needed.

const CONGRESS_API = "/api/congress-intel";
const WATCHLIST = ["NVDA","MSFT","AAPL","AMD","MRVL","MU","AVGO","TSM","ASML","PLTR","ORCL","SMCI","META","GOOGL","AMZN","TSLA","SPY","QQQ"];
const WL_SET = new Set(WATCHLIST);
const CACHE_MS = 900_000; // 15 min

let _cache = null;
let _cacheTime = 0;

// ── HTML helpers ──────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function relTime(iso) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}m前`;
  if (m < 1440) return `${Math.floor(m/60)}h前`;
  return `${Math.floor(m/1440)}d前`;
}
function tradeBadge(type) {
  const t = (type || "").toLowerCase();
  if (/pur|buy|acqui/.test(t)) return `<span class="ci-badge ci-buy">买入 BUY</span>`;
  if (/sale|sell|short|exch/.test(t)) return `<span class="ci-badge ci-sell">卖出 SELL</span>`;
  return `<span class="ci-badge ci-neutral">${esc((type||"").slice(0,14))}</span>`;
}
function srcDot(isLive) {
  return isLive
    ? `<span class="ci-src-live">● LIVE</span>`
    : `<span class="ci-src-off">✕ 离线</span>`;
}

// ── Fetch from server proxy ───────────────────────────────────────────────────
async function fetchIntelFromAPI() {
  if (_cache && Date.now() - _cacheTime < CACHE_MS) return _cache;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(CONGRESS_API, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    _cache = data;
    _cacheTime = Date.now();
    return data;
  } catch (e) {
    console.warn("[CongressIntel] fetch failed:", e.message);
    return null;
  }
}

// ── Render: Confluence alert ──────────────────────────────────────────────────
function renderConfluence(items) {
  if (!items || !items.length) return "";
  return `<div class="ci-confluence-block">
    <div class="ci-confluence-title">⚡ 国会 × 社交共振信号</div>
    <div class="ci-confluence-desc">同时出现在国会持股变动 &amp; 社交热搜，值得重点关注</div>
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

// ── Render: Activity rank bars ────────────────────────────────────────────────
function renderActRank(rank) {
  if (!rank || !rank.length) return `<div class="ci-empty">暂无数据</div>`;
  const maxTotal = Math.max(...rank.map(r => r.buys + r.sells), 1);
  return rank.map(r => {
    const bw = Math.round((r.buys / maxTotal) * 88);
    const sw = Math.round((r.sells / maxTotal) * 88);
    const net = r.net > 0 ? `<span class="ci-net-up">▲${r.net}</span>`
              : r.net < 0 ? `<span class="ci-net-dn">▼${Math.abs(r.net)}</span>`
              : `<span class="ci-net-flat">→0</span>`;
    return `<div class="ci-rank-row${r.isWL ? " ci-rank-wl" : ""}">
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

// ── Render: Trade table ───────────────────────────────────────────────────────
function renderTrades(trades) {
  if (!trades || !trades.length) return `<div class="ci-empty">暂无近期申报记录</div>`;
  return `<div class="ci-trade-table">
    <div class="ci-trade-head">
      <span>议员</span><span>院</span><span>股票</span><span>操作</span><span>金额</span><span>日期</span>
    </div>
    ${trades.map(t => `<div class="ci-trade-row${t.isWL ? " ci-row-wl" : ""}">
      <span class="ci-member" title="${esc(t.state)}">${esc((t.member||"").length > 16 ? t.member.slice(0,16)+"…" : t.member)}</span>
      <span class="ci-chamber-badge">${esc(t.chamber === "众议院" ? "众" : "参")}</span>
      <span class="ci-ticker">${esc(t.ticker || "–")}</span>
      ${tradeBadge(t.type)}
      <span class="ci-amount" title="${esc(t.amount)}">${esc(String(t.amount||"").slice(0,18))}</span>
      <span class="ci-date">${esc(t.date || "")}</span>
    </div>`).join("")}
  </div>`;
}

// ── Render: StockTwits trending ───────────────────────────────────────────────
function renderTrending(symbols) {
  if (!symbols || !symbols.length) return `<div class="ci-empty">StockTwits 数据暂不可用</div>`;
  return `<div class="ci-trending-grid">
    ${symbols.map(s => {
      const bull = Math.round(s.bullPct ?? 50);
      const chg  = s.change != null ? `${s.change >= 0 ? "+" : ""}${Number(s.change).toFixed(2)}%` : "";
      return `<div class="ci-trend-card${s.isWL ? " ci-trend-wl" : ""}">
        <div class="ci-trend-header">
          <strong>${esc(s.symbol)}</strong>
          ${chg ? `<span class="${s.change >= 0 ? "up" : "down"}">${esc(chg)}</span>` : ""}
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
          <span class="ci-tmeta">💬${(s.messages||0).toLocaleString()}</span>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

// ── Render: Watchlist sentiment ───────────────────────────────────────────────
function renderWLSentiment(sentiment) {
  if (!sentiment || !sentiment.length) return "";
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
        <div class="ci-sent-pct"><span class="up">${bull}%</span><span class="down">${s.bearPct ?? 100-bull}%</span></div>
        ${preview ? `<div class="ci-msg-preview${preview.sentiment==="Bullish"?" msg-bull":preview.sentiment==="Bearish"?" msg-bear":""}">
          <span class="ci-msg-user">@${esc(preview.user)}</span>${esc(preview.text)}
        </div>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

// ── Render: Reddit feed ───────────────────────────────────────────────────────
function renderReddit(posts, hotTickers) {
  const tickerRow = (hotTickers && hotTickers.length)
    ? `<div class="ci-reddit-tickers"><span class="ci-rtick-label">热议标的：</span>${
        hotTickers.slice(0,8).map(h =>
          `<span class="ci-tick-tag${WL_SET.has(h.symbol)?" ci-tick-wl":""}">${esc(h.symbol)}</span>`
        ).join("")
      }</div>` : "";

  const SUB_LABELS = { wallstreetbets:"WSB", stocks:"r/Stocks", investing:"r/Investing" };
  const rows = (posts||[]).slice(0,12).map(p => {
    const tix = (p.tickers||[]).map(t =>
      `<span class="ci-tick-tag${WL_SET.has(t)?" ci-tick-wl":""}">${esc(t)}</span>`
    ).join("");
    return `<div class="ci-reddit-row">
      <div class="ci-reddit-meta">
        <span class="ci-sub">${esc(SUB_LABELS[p.sub]||p.sub)}</span>
        ${p.flair ? `<span class="ci-flair">${esc(p.flair)}</span>` : ""}
        <span class="ci-score">▲${(p.score||0).toLocaleString()}</span>
        <span class="ci-cmts">💬${p.comments||0}</span>
        <span class="ci-rtime">${relTime(p.created)}</span>
      </div>
      <div class="ci-reddit-title">${esc(p.title)}</div>
      ${tix ? `<div class="ci-reddit-tix">${tix}</div>` : ""}
    </div>`;
  }).join("");

  return `${tickerRow}<div class="ci-reddit-feed">${rows || '<div class="ci-empty">Reddit 数据暂不可用</div>'}</div>`;
}

// ── Main render from API data ─────────────────────────────────────────────────
function renderFromData(el, data) {
  const sources     = data.sources    || {};
  const house       = data.congress?.house   || { ok: false, trades: [] };
  const senate      = data.congress?.senate  || { ok: false, trades: [] };
  const trending    = data.social?.trending  || { ok: false, symbols: [] };
  const wlSentiment = data.social?.wlSentiment || [];
  const reddit      = data.social?.reddit    || { ok: false, posts: [], hotTickers: [] };
  const intel       = data.intel             || { actRank: [], confluence: [], wlTrades: [], total: 0 };

  // Combine trades: watchlist first, then rest sorted by date
  const wlSet = new Set((intel.wlTrades||[]).map(t => `${t.member}|${t.ticker}|${t.date}`));
  const otherTrades = [...(house.trades||[]), ...(senate.trades||[])]
    .filter(t => !t.isWL && !wlSet.has(`${t.member}|${t.ticker}|${t.date}`))
    .sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
    .slice(0, 20);
  const allTrades = [...(intel.wlTrades||[]), ...otherTrades].slice(0, 35);

  el.innerHTML = `
    <div class="ci-status-bar">
      <span>众议院 ${srcDot(sources.house === "live")}</span>
      <span>参议院 ${srcDot(sources.senate === "live")}</span>
      <span>StockTwits ${srcDot(sources.stocktwits === "live")}</span>
      <span>Reddit ${srcDot(sources.reddit === "live")}</span>
      <span class="ci-total">近90天申报 · 共 ${intel.total ?? 0} 条</span>
    </div>

    ${renderConfluence(intel.confluence)}

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

    <div class="ci-section-divider"><span>社交情报 · Social Intelligence</span></div>

    <div class="ci-panel-title">
      <span class="ci-panel-icon">📊</span> StockTwits 热搜榜
      <em>公开 API · 无需密钥 · 实时情绪比例</em>
    </div>
    ${renderTrending(trending.symbols)}

    ${wlSentiment.length ? `
    <div class="ci-panel-title" style="margin-top:18px">
      <span class="ci-panel-icon">🎯</span> 观察池情绪流
      <em>NVDA · AMD · PLTR · META · TSLA · SPY · QQQ</em>
    </div>
    ${renderWLSentiment(wlSentiment)}` : ""}

    <div class="ci-panel-title" style="margin-top:18px">
      <span class="ci-panel-icon">🔥</span> Reddit 热帖信号
      <em>r/wallstreetbets · r/stocks · r/investing</em>
    </div>
    ${renderReddit(reddit.posts, reddit.hotTickers)}

    <div class="ci-footnote">
      数据来源均为免费公开 API，无需密钥：
      housestockwatcher.com · senatestockwatcher.com（STOCK Act 披露数据库）·
      api.stocktwits.com · reddit.com/r/*.json。
      国会申报存在 30–45 天披露延迟。仅供参考，不构成投资建议。
    </div>`;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function getCongressIntelState() { return _cache; }

export async function renderCongressIntel(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.classList.remove("is-loading");

  // Show skeleton
  el.innerHTML = `<div class="ci-skeleton">
    <div class="ci-sk-bar"></div>
    <div class="ci-sk-bar" style="width:68%;margin-top:8px"></div>
    <div style="margin-top:14px;display:flex;gap:10px">
      <div class="ci-sk-box"></div><div class="ci-sk-box"></div>
      <div class="ci-sk-box"></div><div class="ci-sk-box"></div>
    </div>
    <div class="ci-sk-bar" style="margin-top:14px"></div>
    <div class="ci-sk-bar" style="width:75%;margin-top:8px"></div>
  </div>`;

  const data = await fetchIntelFromAPI();

  if (!data) {
    el.innerHTML = `<div class="ci-error">
      <div class="ci-error-icon">⚠</div>
      <div class="ci-error-title">数据获取失败</div>
      <div class="ci-error-desc">
        政要持股数据源暂时不可用。请稍后刷新页面。<br>
        数据来源：housestockwatcher.com · senatestockwatcher.com · StockTwits · Reddit
      </div>
    </div>`;
    return;
  }

  renderFromData(el, data);
}
