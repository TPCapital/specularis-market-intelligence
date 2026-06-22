// modules/ai-decision-layer.js — AI Decision Layer v3.0
// Inspired by: UZI-Skill (51-investor panel), daily_stock_analysis (decision dashboard)
// Multi-perspective scoring: Regime × Trend × Catalyst × Options × Social × Risk
// Five analyst "lenses" synthesize into a final A+/A/B/C/AVOID rating

const WATCHLIST = ["NVDA","MSFT","AAPL","AMD","MRVL","MU","AVGO","TSM","ASML","PLTR","ORCL","SMCI","META","GOOGL","AMZN","TSLA","SPY","QQQ"];

// Five analyst perspective lenses (inspired by UZI's 51 panel — condensed to 5 institutional profiles)
const ANALYST_LENSES = [
  {
    id: "momentum",
    name: "动能分析师",
    nameEn: "Momentum Trader",
    icon: "⚡",
    focus: "价格动能、RVOL、盘前强度",
    bullConditions: (s, o) => [
      s.dailyChangePercent >= 2,
      s.trendStatus === "strong_uptrend" || s.trendStatus === "uptrend",
      (s.relativeVolume || 1) >= 1.5,
    ].filter(Boolean).length,
    bearConditions: (s, o) => [
      s.dailyChangePercent <= -2,
      s.trendStatus === "downtrend" || s.trendStatus === "strong_downtrend",
    ].filter(Boolean).length,
  },
  {
    id: "value",
    name: "价值猎手",
    nameEn: "Value Hunter",
    icon: "🏛",
    focus: "支撑位、PE估值、安全边际",
    bullConditions: (s, o) => [
      s.supportLevel && s.currentPrice && s.currentPrice <= s.supportLevel * 1.05,
      !s.riskFlags?.includes("chasing_risk"),
      !s.riskFlags?.includes("extended"),
    ].filter(Boolean).length,
    bearConditions: (s, o) => [
      s.riskFlags?.includes("chasing_risk"),
      s.riskFlags?.includes("extended"),
      s.riskFlags?.includes("high_beta"),
    ].filter(Boolean).length,
  },
  {
    id: "catalyst",
    name: "事件驱动",
    nameEn: "Event Driven",
    icon: "🎯",
    focus: "新闻催化、财报、机构动向",
    bullConditions: (s, o) => [
      (s.news || []).some(n => /upgr|buy|bull|strong|beat|upside/i.test(n)),
      !s.riskFlags?.includes("earnings_event"),
      s.analystTone === "bullish" || s.analystTone === "positive",
    ].filter(Boolean).length,
    bearConditions: (s, o) => [
      s.riskFlags?.includes("analyst_bearish"),
      s.riskFlags?.includes("earnings_event"),
      (s.news || []).some(n => /downgrade|sell|miss|warn|risk/i.test(n)),
    ].filter(Boolean).length,
  },
  {
    id: "options",
    name: "期权流向",
    nameEn: "Options Flow",
    icon: "📊",
    focus: "IV结构、Put/Call、期权方向",
    bullConditions: (s, o) => [
      o?.preferredStructure === "CALL" || o?.preferredStructure === "long_call",
      o?.ivStatus === "low" || o?.ivStatus === "normal",
      o?.riskLevel === "low",
    ].filter(Boolean).length,
    bearConditions: (s, o) => [
      o?.preferredStructure === "PUT" || o?.preferredStructure === "hedge",
      o?.ivStatus === "high" || o?.ivStatus === "elevated",
      s.riskFlags?.includes("put_flow"),
    ].filter(Boolean).length,
  },
  {
    id: "regime",
    name: "宏观环境",
    nameEn: "Macro Regime",
    icon: "🌐",
    focus: "市场风险偏好、板块轮动、宏观背景",
    bullConditions: (s, o, regime) => [
      regime?.mode === "Risk-On",
      regime?.score >= 65,
      !["VIX_SPIKE", "BREADTH_WEAK"].some(r => (regime?.alerts || []).includes(r)),
    ].filter(Boolean).length,
    bearConditions: (s, o, regime) => [
      regime?.mode === "Risk-Off",
      regime?.score <= 35,
    ].filter(Boolean).length,
  },
];

// Scoring matrix
function computeScore(sipEntry, oilEntry, regime) {
  if (!sipEntry) return null;
  const s = sipEntry;
  const o = oilEntry || {};
  const r = regime || {};

  let totalBull = 0, totalBear = 0, maxPossible = 0;
  const lensScores = ANALYST_LENSES.map(lens => {
    const bull = lens.bullConditions(s, o, r);
    const bear = lens.bearConditions(s, o, r);
    totalBull += bull;
    totalBear += bear;
    maxPossible += 3;
    return { id: lens.id, name: lens.name, icon: lens.icon, bull, bear };
  });

  const netScore = (totalBull - totalBear) / maxPossible;
  const rawScore = Math.round(50 + netScore * 50);
  const score = Math.max(0, Math.min(100, rawScore));

  // Rating
  let rating, ratingClass, action;
  if (score >= 80)     { rating = "A+"; ratingClass = "adl-rating--aplus"; action = "积极考虑"; }
  else if (score >= 68){ rating = "A";  ratingClass = "adl-rating--a";     action = "关注机会"; }
  else if (score >= 52){ rating = "B";  ratingClass = "adl-rating--b";     action = "观察等待"; }
  else if (score >= 38){ rating = "C";  ratingClass = "adl-rating--c";     action = "谨慎轻仓"; }
  else                  { rating = "回避"; ratingClass = "adl-rating--avoid"; action = "规避"; }

  // Regime-based strategy label (inspired by daily_stock_analysis's three-phase strategy)
  const strategy = r.mode === "Risk-On"
    ? "进攻" : r.mode === "Risk-Off"
    ? "防守" : "均衡";

  return { score, rating, ratingClass, action, strategy, lensScores, totalBull, totalBear };
}

function esc(v) { return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function renderADLCard(ticker, sipEntry, oilEntry, regime, isPlaceholder) {
  if (isPlaceholder || !sipEntry) {
    return `<div class="adl-card adl-rating--placeholder">
      <div class="adl-card-header">
        <span class="adl-ticker">${esc(ticker)}</span>
        <div class="adl-score-block"><span class="adl-score adl-score--placeholder">–</span></div>
      </div>
      <p class="adl-placeholder-note">等待快照数据...</p>
    </div>`;
  }

  const result = computeScore(sipEntry, oilEntry, regime);
  if (!result) return "";

  const { score, rating, ratingClass, action, strategy, lensScores } = result;

  const lensHtml = lensScores.map(l => {
    const bullPct = Math.round((l.bull / 3) * 100);
    const bearPct = Math.round((l.bear / 3) * 100);
    const netColor = l.bull > l.bear ? "#1adb7e" : l.bear > l.bull ? "#ff3d57" : "#7a8194";
    return `<div class="adl-lens">
      <span class="adl-lens-icon">${esc(l.icon)}</span>
      <span class="adl-lens-name">${esc(l.name)}</span>
      <div class="adl-lens-bar-track">
        <div class="adl-lens-fill" style="width:${bullPct}%;background:${netColor}"></div>
      </div>
      <span class="adl-lens-val" style="color:${netColor}">${l.bull > l.bear ? "+" : l.bear > l.bull ? "−" : "~"}${Math.abs(l.bull - l.bear)}</span>
    </div>`;
  }).join("");

  // Key levels
  const support   = sipEntry.supportLevel  ? `$${Number(sipEntry.supportLevel).toFixed(2)}`  : "–";
  const resist    = sipEntry.resistLevel   ? `$${Number(sipEntry.resistLevel).toFixed(2)}`   : "–";
  const price     = sipEntry.currentPrice  ? `$${Number(sipEntry.currentPrice).toFixed(2)}`  : "–";
  const chg       = sipEntry.dailyChangePercent != null ? `${sipEntry.dailyChangePercent >= 0 ? "+" : ""}${Number(sipEntry.dailyChangePercent).toFixed(2)}%` : "–";
  const chgClass  = sipEntry.dailyChangePercent >= 0 ? "up" : "down";

  // Strategy badge color
  const stratColor = strategy === "进攻" ? "#1adb7e" : strategy === "防守" ? "#ff3d57" : "#d4ab4e";

  return `<div class="adl-card ${esc(ratingClass)}">
    <div class="adl-card-header">
      <div class="adl-ticker-block">
        <span class="adl-ticker">${esc(ticker)}</span>
        <span class="adl-sector">${esc(sipEntry.sector || "")}</span>
      </div>
      <div class="adl-score-block">
        <span class="adl-score">${score}</span>
        <span class="adl-score-max">/100</span>
      </div>
    </div>

    <div class="adl-rating-row">
      <span class="adl-rating-badge">${esc(rating)}</span>
      <span class="adl-action">${esc(action)}</span>
      <span class="adl-strategy-badge" style="color:${stratColor};border-color:${stratColor}40">${esc(strategy)}模式</span>
    </div>

    <div class="adl-price-row">
      <span class="adl-cur-price">${esc(price)}</span>
      <span class="${chgClass}">${esc(chg)}</span>
    </div>

    <div class="adl-lenses">${lensHtml}</div>

    <div class="adl-levels">
      <div><span class="adl-lvl-label">支撑</span><span>${esc(support)}</span></div>
      <div><span class="adl-lvl-label">压力</span><span>${esc(resist)}</span></div>
      <div><span class="adl-lvl-label">期权方向</span><span>${esc(oilEntry?.preferredStructure || "–")}</span></div>
    </div>

    ${sipEntry.riskFlags?.length ? `<div class="adl-risk-row">${
      sipEntry.riskFlags.map(f => {
        const RISK_ZH = {
          chasing_risk:"追涨⚠", extended:"超买延伸", earnings_event:"财报临近",
          high_beta:"高波动β", gap_risk:"跳空风险", price_pressure:"价格承压",
          put_flow:"Put沉重", analyst_bearish:"分析师看空", high_iv:"IV偏高",
          options_unavailable:"期权缺失", quote_fallback:"报价备用"
        };
        return `<span class="adl-risk-flag">${esc(RISK_ZH[f] || f)}</span>`;
      }).join("")
    }</div>` : ""}
  </div>`;
}

export function renderAIDecisionLayer(containerId, getModuleStates, latestSnapshot) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.classList.remove("is-loading");

  const states = getModuleStates?.() || {};
  const sipEntries = states.sipState?.entries || [];
  const oilEntries = states.oilState?.entries || [];
  const regime     = latestSnapshot?.risk || states.marketRegime || {};

  const sipMap = Object.fromEntries(sipEntries.map(e => [e.ticker, e]));
  const oilMap = Object.fromEntries(oilEntries.map(e => [e.symbol || e.ticker, e]));

  // Strategy mode banner (inspired by daily_stock_analysis three-phase)
  const mode = regime.mode || "Neutral";
  const modeZh = mode === "Risk-On" ? "进攻" : mode === "Risk-Off" ? "防守" : "均衡";
  const modeColor = mode === "Risk-On" ? "#1adb7e" : mode === "Risk-Off" ? "#ff3d57" : "#d4ab4e";
  const modeDesc = mode === "Risk-On"
    ? "市场风险偏好开启 · 积极参与动能标的 · 管控仓位"
    : mode === "Risk-Off"
    ? "市场风险偏好收缩 · 观望防守为主 · 规避高Beta标的"
    : "市场处于观察整理期 · 轻仓等待明确方向";

  // Sort: by score descending
  const ranked = WATCHLIST
    .map(ticker => {
      const sip = sipMap[ticker];
      const oil = oilMap[ticker];
      const result = computeScore(sip, oil, regime);
      return { ticker, sip, oil, result };
    })
    .filter(x => x.result)
    .sort((a, b) => (b.result?.score || 0) - (a.result?.score || 0));

  const watchlistOnly = WATCHLIST.filter(t => !sipMap[t]);

  el.innerHTML = `
    <!-- Strategy Banner -->
    <div class="adl-strategy-banner" style="border-color:${modeColor}40;background:${modeColor}08">
      <span class="adl-mode-label" style="color:${modeColor}">当前策略模式：${esc(modeZh)}（${esc(mode)}）</span>
      <span class="adl-mode-desc">${esc(modeDesc)}</span>
      <span class="adl-score-note">综合评分 = 动能(3) + 价值(3) + 催化(3) + 期权(3) + 宏观(3) · 满分100</span>
    </div>

    <!-- ADL Grid — sorted by score -->
    <div class="adl-grid">
      ${ranked.map(({ ticker, sip, oil }) => renderADLCard(ticker, sip, oil, regime, false)).join("")}
      ${watchlistOnly.map(t => renderADLCard(t, null, null, regime, true)).join("")}
    </div>
  `;

  // Wire up refresh on snapshot
  document.addEventListener("specularis:snapshotReady", () => {
    renderAIDecisionLayer(containerId, getModuleStates, window.__latestSnapshot);
  });
}
