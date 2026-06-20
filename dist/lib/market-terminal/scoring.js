// lib/market-terminal/scoring.js
// Specularis Market Terminal Lite — A+ Opportunity Scoring.
// Combines market regime, stock trend, catalyst, options lite, KOL confirmation.

import { DECISION_RATINGS, DECISION_ACTIONS, DECISION_VEHICLES } from "./schema.js";

/**
 * Compute the A+ score for a single ticker.
 *
 * @param {object} params
 *   stockIntel     - from stockIntelligence[]
 *   optionsLite    - from optionsLite[]
 *   kolEntries     - KOL distillation entries mentioning this ticker
 *   marketRegime   - from existing snapshot.marketRegime
 *   dataQuality    - overall data quality string
 * @returns {object} decision entry
 */
export function scoreOpportunity({
  stockIntel = {},
  optionsLite = {},
  kolEntries = [],
  marketRegime = {},
  dataQuality = "placeholder",
}) {
  const ticker = stockIntel.ticker || "??";

  // If data is mostly placeholder, return low-confidence result.
  const isPlaceholder =
    dataQuality === "placeholder" || stockIntel.dataStatus === "placeholder";

  // -- Component 1: Market Regime (0-2) --
  const regimeScore = scoreMarketRegime(marketRegime);

  // -- Component 2: Stock Trend (0-2) --
  const trendScore = isPlaceholder ? 0 : scoreStockTrend(stockIntel);

  // -- Component 3: Catalyst Quality (0-2) --
  const catalystScore = isPlaceholder ? 0 : scoreCatalyst(stockIntel);

  // -- Component 4: Options Risk/Reward (0-2) --
  const optionsScore = scoreOptionsLite(optionsLite);

  // -- Component 5: KOL Confirmation (0-1) --
  const kolScore = scoreKol(kolEntries, ticker);

  // -- Component 6: Risk Control Clarity (0-1) --
  const riskScore =
    !isPlaceholder &&
    stockIntel.keySupport &&
    stockIntel.keyResistance
      ? 1
      : 0;

  const total =
    regimeScore +
    trendScore +
    catalystScore +
    optionsScore +
    kolScore +
    riskScore;

  const rating = ratingFromScore(total, isPlaceholder);
  const action = actionFromRating(rating);
  const vehicle = vehicleFromData(stockIntel, optionsLite, rating);

  return {
    ticker,
    score: isPlaceholder ? null : parseFloat(total.toFixed(1)),
    rating,
    action,
    preferredVehicle: vehicle,
    keyEntryZone: stockIntel.keySupport || null,
    invalidationLevel: stockIntel.keySupport
      ? `Below ${stockIntel.keySupport}`
      : null,
    targetZone: stockIntel.keyResistance || null,
    reason: buildReason(rating, regimeScore, trendScore, catalystScore, kolScore, isPlaceholder),
    riskWarning: buildRiskWarning(stockIntel, optionsLite, isPlaceholder),
    scoreBreakdown: {
      marketRegime: regimeScore,
      stockTrend: trendScore,
      catalystQuality: catalystScore,
      optionRiskReward: optionsScore,
      kolConfirmation: kolScore,
      riskControlClarity: riskScore,
    },
    dataStatus: isPlaceholder ? "placeholder" : "computed",
  };
}

function scoreMarketRegime(regime = {}) {
  const score = Number(regime.score);
  if (!Number.isFinite(score)) return 0;
  if (score >= 70) return 2;
  if (score >= 50) return 1;
  return 0;
}

function scoreStockTrend(intel = {}) {
  const change = Number(intel.dailyChangePercent);
  if (intel.trendStatus === "strong_uptrend") return 2;
  if (Number.isFinite(change) && change > 1.5) return 2;
  if (Number.isFinite(change) && change > 0) return 1;
  return 0;
}

function scoreCatalyst(intel = {}) {
  const newsCount = Array.isArray(intel.recentNews) ? intel.recentNews.length : 0;
  const analystTone = String(intel.analystTone || "").toLowerCase();
  if (newsCount > 0 && analystTone === "bullish") return 2;
  if (newsCount > 0 || analystTone === "bullish") return 1;
  return 0;
}

function scoreOptionsLite(optLite = {}) {
  if (optLite.preferredStructure === "avoid") return 0;
  if (optLite.preferredStructure === "wait") return 0;
  if (optLite.riskLevel === "low") return 2;
  if (optLite.riskLevel === "medium") return 1;
  return 0;
}

function scoreKol(entries = [], ticker = "") {
  const relevant = entries.filter(
    (e) =>
      e.mentionedTickers?.includes(ticker) &&
      ["bullish"].includes(e.stance) &&
      ["explicit_position", "strong_opinion"].includes(e.signalType) &&
      ["high", "medium"].includes(e.convictionLevel)
  );
  return relevant.length > 0 ? 1 : 0;
}

function ratingFromScore(total, isPlaceholder) {
  if (isPlaceholder) return "placeholder";
  if (total >= 8.5) return "A+";
  if (total >= 7) return "A";
  if (total >= 5) return "B";
  if (total >= 3) return "C";
  return "Avoid";
}

function actionFromRating(rating) {
  if (rating === "A+" || rating === "A") return "tradable";
  if (rating === "B") return "watch";
  if (rating === "C") return "wait_for_pullback";
  return "avoid";
}

function vehicleFromData(intel = {}, optLite = {}, rating = "") {
  if (rating === "Avoid" || rating === "placeholder") return "no_trade";
  if (optLite.preferredStructure === "call_spread") return "call_spread";
  if (optLite.preferredStructure === "long_call") return "option";
  return "stock";
}

function buildReason(rating, regime, trend, catalyst, kol, isPlaceholder) {
  if (isPlaceholder)
    return "数据为占位符，暂不生成评分理由。请手动输入数据后重新计算。";
  const parts = [];
  if (regime >= 1) parts.push("市场环境支持");
  if (trend >= 1) parts.push("股价动能偏强");
  if (catalyst >= 1) parts.push("存在催化因素");
  if (kol >= 1) parts.push("KOL 确认信号");
  if (parts.length === 0) return "无明确多头条件，建议观望。";
  return `${parts.join(" · ")} → 综合评级 ${rating}。`;
}

function buildRiskWarning(intel = {}, optLite = {}, isPlaceholder) {
  const warnings = ["仅供研究，不构成投资建议。For research only, not financial advice."];
  if (isPlaceholder) warnings.push("当前数据为占位符，评分不可靠。");
  if (optLite.earningsVolRisk) warnings.push("⚠️ 财报前期权波动风险较高。");
  if (intel.riskFlags?.length > 0)
    warnings.push(`⚠️ ${intel.riskFlags.join(" · ")}`);
  return warnings.join(" ");
}

/**
 * Build complete AI Decision Layer from all inputs.
 */
export function buildAIDecisionLayer({
  stockIntelligence = [],
  optionsLite = [],
  kolDistillation = [],
  marketRegime = {},
  dataQuality = "placeholder",
}) {
  return stockIntelligence.map((intel) => {
    const optLite =
      optionsLite.find((o) => o.ticker === intel.ticker) || {};
    return scoreOpportunity({
      stockIntel: intel,
      optionsLite: optLite,
      kolEntries: kolDistillation,
      marketRegime,
      dataQuality,
    });
  });
}
