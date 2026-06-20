// modules/congress-intel.js
// Specularis Market Intelligence — Congress & Social Intelligence Module
// Replaces manual KOL input. Auto-fetches:
//   • US Congress trading disclosures (STOCK Act filings) — House + Senate
//   • StockTwits trending & watchlist sentiment
//   • Reddit WSB / r/stocks hot threads
// Zero API keys required. All public endpoints.

const CONGRESS_INTEL_ENDPOINT = "/api/congress-intel";
const FETCH_TIMEOUT_MS = 16_000;
const WATCHLIST = ["NVDA","MSFT","AAPL","AMD","MRVL","MU","AVGO","TSM","ASML","PLTR","ORCL","SMCI","META","GOOGL","AMZN","TSLA","SPY","QQQ"];

let _state = null;
let _lastFetch = 0;

// ── helpers ───────────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function relTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  return `${d}天前`;
}

function tradeTypeBadge(type = "") {
  const t = type.toLowerCase();
  const isBuy = /pur|buy|acqui|long/.test(t);
  const isSell = /sale|sell|short|exercise/.test(t);
  if (isBuy)  return `<span class="ci-badge ci-buy">买入 BUY</span>`;
  if (isSell) return `<span class="ci-badge ci-sell">卖出 SELL</span>`;
  return `<span class="ci-badge ci-neutral">${esc(type.slice(0,12))}</span>`;
}

function amountLabel(amount = "") {
  const s = String(amount);
  if (/[0-9]/.test(s)) return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return s || "–";
}

function sentimentBar(bullPct = 50) {
  const b = Math.max(0, Math.min(100, bullPct));
  const br = 100 - b;
  return `<div class="ci-sent-bar">
    <div class="ci-sent-bull" style="width:${b}%"></div>
    <div class="ci-sent-bear" style="width:${br}%"></div>
  </div>
  <div class="ci-sent-labels">
    <span class="up">${b}% 看多</span>
    <span class="down">${br}% 看空</span>
  </div>`;
}

function netArrow(net) {
  if (net > 0) return `<span class="ci-net-up">▲ ${net}</span>`;
  if (net < 0) return `<span class="ci-net-dn">▼ ${Math.abs(net)}</span>`;
  return `<span class="ci-net-flat">→ 0</span>`;
}

function statusDot(s) {
  if (s === "live")        return `<span class="ci-src-live">● LIVE</span>`;
  if (s === "unavailable") return `<span class="ci-src-off">✕ 离线</span>`;
  return `<span class="ci-src-delay">◐ ${esc(s)}</span>`;
}

// ── Render: Congress Activity Rank ────────────────────────────────────────────
function renderActivityRank(rank = []) {
  if (!rank.length) return `<div class="ci-empty">暂无国会持股活动数据</div>`;
  return rank.map((r) => {
    const highlight = r.isWatchlist ? "ci-rank-wl" : "";
    const conf = r.confluenceSignal ? `<span class="ci-confluence">⚡ 共振</span>` : "";
    return `<div class="ci-rank-row ${highlight}">
      <div class="ci-rank-sym">${esc(r.symbol)}</div>
      <div class="ci-rank-bars">
        <span class="ci-buy-bar" style="width:${Math.min(100, r.buys * 8)}px"></span>
        <span class="ci-sell-bar" style="width:${Math.min(100, r.sells * 8)}px"></span>
      </div>
      <div class="ci-rank-nums">
        <span class="up">↑${r.buys}</span>
        <span class="down">↓${r.sells}</span>
      </div>
      <div class="ci-rank-meta">${r.members}人 ${netArrow(r.net)} ${conf}</div>
    </div>`;
  }).join("");
}

// ── Render: Recent trades table ───────────────────────────────────────────────
function renderTradeRows(trades = []) {
  if (!trades.length) return `<div class="ci-empty">暂无近期交易记录</div>`;
  return `<div class="ci-trade-table">
    <div class="ci-trade-head">
      <span>议员</span><span>股票</span><span>类型</span><span>金额</span><span>日期</span>
    </div>
    ${trades.slice(0, 30).map((t) => {
      const wl = t.isWatchlist ? "ci-row-wl" : "";
      return `<div class="ci-trade-row ${wl}">
        <span class="ci-member" title="${esc(t.chamber + " · " + (t.district || t.state || ""))}">
          ${esc(t.member.length > 18 ? t.member.slice(0, 18) + "…" : t.member)}
          <em>${esc(t.chamber === "House" ? "众" : "参")}</em>
        </span>
        <span class="ci-ticker">${esc(t.ticker || "–")}</span>
        ${tradeTypeBadge(t.type)}
        <span class="ci-amount">${esc(amountLabel(t.amount))}</span>
        <span class="ci-date">${esc(t.date?.slice(0,10) || "")}</span>
      </div>`;
    }).join("")}
  </div>`;
}

// ── Render: Confluence Alert ──────────────────────────────────────────────────
function renderConfluence(items = []) {
  if (!items.length) return "";
  return `<div class="ci-confluence-block">
    <div class="ci-confluence-title">⚡ 国会 × 社交共振信号</div>
    <div class="ci-confluence-desc">以下标的同时出现在国会持股变动 & 社交媒体热搜，值得重点关注：</div>
    <div class="ci-confluence-tags">
      ${items.map((r) =>
        `<div class="ci-conf-tag">
          <strong>${esc(r.symbol)}</strong>
          <span>${r.buys}买 ${r.sells}卖</span>
          <span>${r.members}名议员</span>
        </div>`
      ).join("")}
    </div>
  </div>`;
}

// ── Render: StockTwits Trending ───────────────────────────────────────────────
function renderTrending(symbols = []) {
  if (!symbols.length) return `<div class="ci-empty">StockTwits 数据暂不可用</div>`;
  const top = symbols.slice(0, 12);
  return `<div class="ci-trending-grid">
    ${top.map((s) => {
      const wl = s.isWatchlist ? "ci-trend-wl" : "";
      const bull = s.bullPercent ?? 50;
      const bearPct = 100 - bull;
      const chg = s.change != null ? `${s.change >= 0 ? "+" : ""}${Number(s.change).toFixed(2)}%` : "";
      const chgCls = s.change >= 0 ? "up" : "down";
      return `<div class="ci-trend-card ${wl}">
        <div class="ci-trend-header">
          <strong>${esc(s.symbol)}</strong>
          ${chg ? `<span class="${chgCls}">${esc(chg)}</span>` : ""}
        </div>
        <div class="ci-trend-name">${esc((s.title || "").slice(0, 24))}</div>
        <div class="ci-sent-bar" title="${bull}% 看多">
          <div class="ci-sent-bull" style="width:${bull}%"></div>
          <div class="ci-sent-bear" style="width:${bearPct}%"></div>
        </div>
        <div class="ci-trend-meta">
          <span>👥 ${s.watchlist?.toLocaleString() || 0}</span>
          <span>💬 ${s.messages?.toLocaleString() || 0}</span>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

// ── Render: Reddit Hot Thread Feed ───────────────────────────────────────────
function renderRedditPosts(posts = [], hotTickers = []) {
  const tickerRow = hotTickers.length
    ? `<div class="ci-reddit-tickers">
        热门标的：${hotTickers.slice(0, 8).map((h) => {
          const wl = WATCHLIST.includes(h.symbol) ? "ci-tick-wl" : "";
          return `<span class="ci-tick-tag ${wl}">${esc(h.symbol)}<em>${h.heat}</em></span>`;
        }).join("")}
      </div>`
    : "";

  const postRows = posts.slice(0, 12).map((p) => {
    const subs = { wallstreetbets: "WSB", stocks: "Stocks", investing: "Investing" };
    const sub = subs[p.subreddit] || p.subreddit;
    const tix = p.tickers.map((t) =>
      `<span class="ci-tick-tag ${WATCHLIST.includes(t) ? "ci-tick-wl" : ""}">${esc(t)}</span>`
    ).join("");
    return `<div class="ci-reddit-row">
      <div class="ci-reddit-meta">
        <span class="ci-sub">r/${esc(sub)}</span>
        ${p.flair ? `<span class="ci-flair">${esc(p.flair.slice(0, 20))}</span>` : ""}
        <span class="ci-score">▲ ${p.score.toLocaleString()}</span>
        <span class="ci-cmts">💬 ${p.comments}</span>
        <span class="ci-rtime">${relTime(p.created)}</span>
      </div>
      <div class="ci-reddit-title">${esc(p.title)}</div>
      ${tix ? `<div class="ci-reddit-tix">${tix}</div>` : ""}
    </div>`;
  }).join("");

  return `${tickerRow}<div class="ci-reddit-feed">${postRows || '<div class="ci-empty">Reddit 数据暂不可用</div>'}</div>`;
}

// ── Render: Watchlist sentiment panel ────────────────────────────────────────
function renderWatchlistSentiment(sentiment = []) {
  if (!sentiment.length) return "";
  return `<div class="ci-wl-sentiment">
    ${sentiment.map((s) => {
      return `<div class="ci-wl-sent-card">
        <div class="ci-wl-sym">${esc(s.symbol)}</div>
        ${sentimentBar(s.bullPct)}
        <div class="ci-wl-msgs">
          ${s.recentMsgs.slice(0, 1).map((m) => `
            <div class="ci-msg-preview ${m.sentiment === "Bullish" ? "msg-bull" : m.sentiment === "Bearish" ? "msg-bear" : ""}">
              <span class="ci-msg-user">@${esc(m.user)}</span>
              ${esc(m.text)}
            </div>`
          ).join("")}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

// ── Main render function ──────────────────────────────────────────────────────
async function fetchCongressIntel() {
  const now = Date.now();
  if (_state && now - _lastFetch < 900_000) return _state; // 15-min cache

  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(CONGRESS_INTEL_ENDPOINT, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const data = await r.json();
    _state = data;
    _lastFetch = now;
    return data;
  } catch (e) {
    console.warn("[CongressIntel] fetch failed:", e.message);
    return null;
  }
}

export function getCongressIntelState() {
  return _state || null;
}

export async function renderCongressIntel(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.classList.remove("is-loading");

  // Skeleton while loading
  el.innerHTML = `<div class="ci-loading">
    <div class="ci-shimmer"></div>
    <div class="ci-shimmer" style="width:70%;margin-top:10px"></div>
    <div class="ci-shimmer" style="width:50%;margin-top:10px"></div>
  </div>`;

  const data = await fetchCongressIntel();
  if (!data) {
    el.innerHTML = `<div class="ci-error">
      <div class="ci-error-icon">⚠</div>
      <div class="ci-error-title">数据获取失败</div>
      <div class="ci-error-desc">国会持股数据源暂时不可用。请稍后刷新。<br>
        数据来源：housestockwatcher.com · senatestockwatcher.com · StockTwits · Reddit
      </div>
    </div>`;
    return;
  }

  const { sources, congress, social, intel } = data;
  const house  = congress?.house || {};
  const senate = congress?.senate || {};
  const trending = social?.trending || {};
  const sentiment = social?.sentiment || [];
  const reddit = social?.reddit || {};

  // Combine all trades (watchlist first, then recent)
  const allTrades = [
    ...(intel?.watchlistTrades || []),
    ...(house.trades || []).filter((t) => !t.isWatchlist).slice(0, 20),
    ...(senate.trades || []).filter((t) => !t.isWatchlist).slice(0, 10),
  ].slice(0, 35);

  el.innerHTML = `
    <!-- ── Source Status Bar ───────────────────────────── -->
    <div class="ci-status-bar">
      <span>众议院 ${statusDot(sources?.house)}</span>
      <span>参议院 ${statusDot(sources?.senate)}</span>
      <span>StockTwits ${statusDot(sources?.stocktwits)}</span>
      <span>Reddit ${statusDot(sources?.reddit)}</span>
      <span class="ci-total">共 ${intel?.totalCongressTrades ?? 0} 条申报记录</span>
    </div>

    <!-- ── Confluence Signal ───────────────────────────── -->
    ${renderConfluence(intel?.confluence || [])}

    <!-- ── Two-column: Activity Rank + Trade Table ────── -->
    <div class="ci-main-grid">
      <div class="ci-left-col">
        <div class="ci-panel-title">
          <span class="ci-panel-icon">🏛</span>
          国会持股活跃榜
          <em>近90天申报 · 按交易量排序</em>
        </div>
        ${renderActivityRank(intel?.congressActivityRank || [])}
      </div>

      <div class="ci-right-col">
        <div class="ci-panel-title">
          <span class="ci-panel-icon">📋</span>
          最新持股申报
          <em>观察池优先 · 按日期降序</em>
        </div>
        ${renderTradeRows(allTrades)}
      </div>
    </div>

    <!-- ── Social Intelligence: StockTwits Trending ────── -->
    <div class="ci-section-divider">
      <span>社交情报 · Social Intelligence</span>
    </div>

    <div class="ci-panel-title">
      <span class="ci-panel-icon">📊</span>
      StockTwits 热搜榜
      <em>公开API · 无需密钥 · 实时情绪</em>
    </div>
    ${renderTrending(trending.symbols || [])}

    <!-- ── Watchlist Sentiment ────────────────────────── -->
    ${sentiment.length ? `
    <div class="ci-panel-title" style="margin-top:18px">
      <span class="ci-panel-icon">🎯</span>
      观察池 StockTwits 情绪
      <em>NVDA · AMD · PLTR · META · TSLA · SPY · QQQ</em>
    </div>
    ${renderWatchlistSentiment(sentiment)}` : ""}

    <!-- ── Reddit Feed ────────────────────────────────── -->
    <div class="ci-panel-title" style="margin-top:18px">
      <span class="ci-panel-icon">🔥</span>
      Reddit 热帖信号
      <em>r/wallstreetbets · r/stocks · r/investing</em>
    </div>
    ${renderRedditPosts(reddit.posts || [], reddit.hotTickers || [])}

    <!-- ── Disclaimer ─────────────────────────────────── -->
    <div class="ci-footnote">
      数据来源：House Stock Watcher (housestockwatcher.com) · Senate Stock Watcher (senatestockwatcher.com) · 
      StockTwits Public API · Reddit JSON Feed。均为免费公开数据源，无需 API 密钥。
      国会持股申报数据来自美国《STOCK 法案》(STOCK Act) 强制披露，
      申报截止日为交易后 30–45 天，存在披露延迟。本模块仅供信息参考，不构成投资建议。
    </div>
  `;

  // Set up auto-refresh every 15 min
  return {
    refresh: async () => {
      _lastFetch = 0; // force re-fetch
      await renderCongressIntel(containerId);
    },
  };
}
