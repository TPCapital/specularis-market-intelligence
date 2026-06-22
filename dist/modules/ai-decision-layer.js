// modules/ai-decision-layer.js
// Specularis Market Terminal Lite — AI Decision Layer Module.
// Aggregates data from all modules and computes A+ opportunity scores.

const ADL_STORAGE_KEY = "specularis-market-terminal:ai-decision-v1";
const WATCHLIST = ["MU","MRVL","NVDA","AVGO","AMD","TSM","ASML","PLTR","ORCL","SMCI"];

const RATING_CLASSES = {
  "A+": "adl-rating--aplus",
  "A": "adl-rating--a",
  "B": "adl-rating--b",
  "C": "adl-rating--c",
  "Avoid": "adl-rating--avoid",
  "placeholder": "adl-rating--placeholder",
  "computed-lite": "adl-rating--b",
};

const ACTION_LABELS = {
  tradable: "可交易",
  watch: "观察",
  wait_for_pullback: "等待回踩",
  avoid: "回避",
};

const VEHICLE_LABELS = {
  stock: "正股",
  option: "期权",
  call_spread: "Call 价差",
  no_trade: "不交易",
};

function escHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function scoreDecision({ sipEntry = {}, oilEntry = {}, kolEntries = [], marketRegime = {} }) {
  const ticker = sipEntry.ticker;
  const isPlaceholder = sipEntry.dataStatus === "placeholder" || !sipEntry.dataStatus;

  // Market regime
  const regimeRaw = Number(marketRegime.score);
  const regimeScore = Number.isFinite(regimeRaw) ? (regimeRaw >= 70 ? 2 : regimeRaw >= 50 ? 1 : 0) : 0;

  // Stock trend
  let trendScore = 0;
  if (!isPlaceholder) {
    if (sipEntry.trendStatus === "strong_uptrend") trendScore = 2;
    else if (sipEntry.trendStatus === "uptrend" || Number(sipEntry.dailyChangePercent) > 0) trendScore = 1;
  }

  // Catalyst quality
  let catalystScore = 0;
  if (!isPlaceholder) {
    const newsOk = Array.isArray(sipEntry.recentNews) && sipEntry.recentNews.length > 0;
    const analystBull = String(sipEntry.analystTone || "").toLowerCase() === "bullish";
    const upsideOk = Number(sipEntry.upsidePct) > 5;
    if (newsOk && (analystBull || upsideOk)) catalystScore = 2;
    else if (newsOk || analystBull || upsideOk) catalystScore = 1;
  }

  // Options risk/reward
  let optScore = 0;
  if (oilEntry.preferredStructure && !["avoid","wait"].includes(oilEntry.preferredStructure)) {
    optScore = oilEntry.riskLevel === "low" ? 2 : oilEntry.riskLevel === "medium" ? 1 : 0;
  }
  if (sipEntry.optionsData?.flowBias === "call_heavy" && ["uptrend","strong_uptrend"].includes(sipEntry.trendStatus)) optScore = Math.max(optScore, 1);
  if (sipEntry.optionsData?.flowBias === "put_heavy" && Number(sipEntry.dailyChangePercent) < 0) optScore = Math.max(optScore, 1);

  // KOL confirmation
  const kolScore = kolEntries.filter((e) =>
    e.mentionedTickers?.includes(ticker) &&
    e.stance === "bullish" &&
    ["explicit_position","strong_opinion"].includes(e.signalType) &&
    ["high","medium"].includes(e.convictionLevel)
  ).length > 0 ? 1 : 0;

  // Risk control clarity
  const riskCtrlScore = (!isPlaceholder && sipEntry.keySupport && sipEntry.keyResistance) ? 1 : 0;

  const total = regimeScore + trendScore + catalystScore + optScore + kolScore + riskCtrlScore;

  const rating = isPlaceholder ? "placeholder"
    : total >= 8.5 ? "A+" : total >= 7 ? "A" : total >= 5 ? "B" : total >= 3 ? "C" : "Avoid";

  return {
    ticker,
    score: isPlaceholder ? null : parseFloat(total.toFixed(1)),
    rating,
    action: rating === "placeholder" ? "watch"
          : rating === "A+" || rating === "A" ? "tradable"
          : rating === "B" ? "watch"
          : rating === "C" ? "wait_for_pullback" : "avoid",
    preferredVehicle: rating === "Avoid" || rating === "placeholder" ? "no_trade"
          : oilEntry.preferredStructure === "call_spread" ? "call_spread"
          : oilEntry.preferredStructure === "long_call" ? "option" : "stock",
    keyEntryZone: sipEntry.keySupport || null,
    invalidationLevel: sipEntry.keySupport ? `低于 ${sipEntry.keySupport}` : null,
    targetZone: sipEntry.keyResistance || null,
    scoreBreakdown: { regimeScore, trendScore, catalystScore, optScore, kolScore, riskCtrlScore },
    dataStatus: isPlaceholder ? "placeholder" : "computed",
  };
}

function barHtml(score, max) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return `<div class="adl-bar-track"><div class="adl-bar-fill" style="width:${pct}%"></div></div>`;
}

function renderCard(decision) {
  const ratingCls = RATING_CLASSES[decision.rating] || "adl-rating--placeholder";
  const isPlaceholder = decision.dataStatus === "placeholder";
  const score = decision.score !== null ? decision.score : "--";
  const bd = decision.scoreBreakdown || {};

  const breakdownHtml = isPlaceholder
    ? `<p class="adl-placeholder-note">等待免费行情或在「个股情报 Pro」中手动输入后计算。</p>`
    : `<div class="adl-breakdown">
        <div class="adl-brow"><span>市场环境</span>${barHtml(bd.regimeScore, 2)}<span>${bd.regimeScore}/2</span></div>
        <div class="adl-brow"><span>股价动能</span>${barHtml(bd.trendScore, 2)}<span>${bd.trendScore}/2</span></div>
        <div class="adl-brow"><span>催化质量</span>${barHtml(bd.catalystScore, 2)}<span>${bd.catalystScore}/2</span></div>
        <div class="adl-brow"><span>期权风险回报</span>${barHtml(bd.optScore, 2)}<span>${bd.optScore}/2</span></div>
        <div class="adl-brow"><span>KOL 确认</span>${barHtml(bd.kolScore, 1)}<span>${bd.kolScore}/1</span></div>
        <div class="adl-brow"><span>风控清晰度</span>${barHtml(bd.riskCtrlScore, 1)}<span>${bd.riskCtrlScore}/1</span></div>
      </div>`;

  const levelsHtml = !isPlaceholder && (decision.keyEntryZone || decision.targetZone || decision.invalidationLevel)
    ? `<div class="adl-levels">
        ${decision.keyEntryZone ? `<div><span class="oil-label">进场区</span><span>${escHtml(decision.keyEntryZone)}</span></div>` : ""}
        ${decision.invalidationLevel ? `<div><span class="oil-label">止损</span><span>${escHtml(decision.invalidationLevel)}</span></div>` : ""}
        ${decision.targetZone ? `<div><span class="oil-label">目标</span><span>${escHtml(decision.targetZone)}</span></div>` : ""}
      </div>` : "";

  return `
<article class="adl-card ${ratingCls}" data-ticker="${decision.ticker}">
  <div class="adl-card-header">
    <strong class="adl-ticker">${decision.ticker}</strong>
    <div class="adl-score-block">
      <span class="adl-score">${score}</span>
      <span class="adl-score-max">/10</span>
    </div>
  </div>
  <div class="adl-rating-row">
    <span class="adl-rating-badge ${ratingCls}">${escHtml(decision.rating)}</span>
    <span class="adl-action">${escHtml(ACTION_LABELS[decision.action] || decision.action)}</span>
    <span class="adl-vehicle">${escHtml(VEHICLE_LABELS[decision.preferredVehicle] || decision.preferredVehicle)}</span>
  </div>
  ${breakdownHtml}
  ${decision.reason ? `<p class="adl-reason">${escHtml(decision.reason)}</p>` : ""}
  ${levelsHtml}
  <p class="adl-risk-warn">⚠️ 仅供研究 · Not financial advice</p>
</article>`;
}

function normalizeServerDecision(decision = {}) {
  const bd = decision.scoreBreakdown || {};
  return {
    ticker: decision.ticker,
    score: decision.score ?? null,
    rating: decision.rating || "placeholder",
    action: decision.action || "watch",
    preferredVehicle: decision.preferredVehicle || "no_trade",
    keyEntryZone: decision.keyEntryZone || null,
    invalidationLevel: decision.invalidationLevel || null,
    targetZone: decision.targetZone || null,
    reason: decision.reason || "Server-side Lite decision.",
    riskWarning: decision.riskWarning || "仅供研究，不构成投资建议。For research only, not financial advice.",
    scoreBreakdown: {
      regimeScore: bd.regimeScore ?? bd.marketRegime ?? 0,
      trendScore: bd.trendScore ?? bd.stockTrend ?? 0,
      catalystScore: bd.catalystScore ?? bd.catalystQuality ?? 0,
      optScore: bd.optScore ?? bd.optionRiskReward ?? 0,
      kolScore: bd.kolScore ?? bd.kolConfirmation ?? 0,
      riskCtrlScore: bd.riskCtrlScore ?? bd.riskControlClarity ?? 0,
    },
    dataStatus: decision.dataStatus || "computed-lite",
  };
}

function getServerDecisions(snapshot = {}) {
  const rows = snapshot?.terminalLite?.aiDecisionLayer;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const usable = rows.filter((r) => r && r.ticker && r.dataStatus !== "placeholder");
  return usable.length ? usable.map(normalizeServerDecision) : null;
}

export function renderAIDecisionLayer(containerId, getModuleStates, initialSnapshot = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let latestSnapshot = initialSnapshot || {};

  function redraw() {
    container.classList.remove("is-loading");
    const moduleStates = getModuleStates();
    latestSnapshot = moduleStates.snapshot || latestSnapshot || {};
    const hasEnrichedSip = Object.values(moduleStates.sipState || {}).some((e) => e?.enrichVersion || e?.optionsData || e?.targetMeanPrice);
    const serverDecisions = hasEnrichedSip ? null : getServerDecisions(latestSnapshot);
    const decisions = serverDecisions || (() => {
      const { sipState = {}, oilState = {}, congressState = {}, kolState = {}, marketRegime = {} } = moduleStates;
      // Use congress intel state (watchlist trades) as social signal, fall back to legacy kolState
      const kolEntries = kolState?.entries || [];
      return WATCHLIST.map((ticker) => {
        const sipEntry = { ticker, ...(sipState[ticker] || {}) };
        const oilEntry = oilState[ticker] || {};
        return scoreDecision({ sipEntry, oilEntry, kolEntries, marketRegime });
      });
    })();

    // Sort by score descending.
    const sorted = [...decisions].sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });

    const cards = sorted.map((d) => renderCard(d)).join("");
    container.innerHTML = `
      <div class="adl-header">
        <span class="adl-mode-badge">🤖 AI Decision Layer</span>
        <span class="adl-header-note">综合评分 = 市场环境(2) + 股价动能(2) + 催化质量(2) + 期权(2) + 社交共振(1) + 风控(1)</span>
      </div>
      <div class="adl-grid">${cards}</div>
      <p class="sip-disclaimer">⚠️ 仅供研究，不构成投资建议。For research only, not financial advice.</p>`;

    // Expose decisions to prompt builder via custom event.
    document.dispatchEvent(new CustomEvent("specularis:decisionsReady", {
      detail: { decisions: sorted }
    }));
  }

  redraw();

  // Recompute when any module updates.
  ["specularis:sipUpdated", "specularis:oilUpdated", "specularis:kolUpdated"].forEach((evtName) => {
    document.addEventListener(evtName, () => redraw());
  });
  document.addEventListener("specularis:snapshotReady", (e) => {
    latestSnapshot = e.detail || {};
    redraw();
  });

  return { redraw };
}
