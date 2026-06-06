function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

/**
 * Signal Engine v2
 * ─────────────────
 * New in v2:
 *   - Political insider trades factor (trumpTradesBoost)
 *   - Narrative confidence integration
 *   - Per-ticker confidence score amplification
 */
export function buildSignalEngine({
  indices = [],
  scanner = [],
  breadth = null,
  risk = null,
  earnings = [],
  insider = [],
  relativeVolume = [],
  politicalTrades = {},      // NEW: from buildPoliticalTradesLayer()
  narrativeEngine = {}       // NEW: from buildNarrativeEngine()
} = {}) {
  const qqq = indices.find((item) => item.id === "QQQ")?.change || 0;
  const vix = indices.find((item) => item.id === "VIX")?.change || 0;
  const tnx = indices.find((item) => item.id === "TNX")?.change || 0;
  const dxy = indices.find((item) => item.id === "DXY")?.change || 0;
  const gold = indices.find((item) => item.id === "GOLD")?.change || 0;
  const topScanner = scanner.slice(0, 5);
  const highConviction = topScanner.filter((item) => item.status === "HIGH CONVICTION").length;
  const watchlist = topScanner.filter((item) => item.status === "WATCHLIST").length;
  const breadthScore = breadth?.breadthStrength ?? 50;
  const rvolExpansion = (relativeVolume || []).filter((item) => item.signal === "RVOL_EXPANSION").length;

  // ── Political Trades Factor ──────────────────────────────────────────────
  // If national-level informed buyers are active in aligned sectors,
  // boost risk appetite modestly (capped to prevent over-reliance)
  const polSignals = politicalTrades?.signals || [];
  const polBuyCount = polSignals.filter((s) => s.action === "BUY" && (s.signalWeight || 0) >= 0.6).length;
  const polBoost = clamp(polBuyCount * 1.8, 0, 8); // max +8 pts

  // ── Narrative resonance boost ────────────────────────────────────────────
  const narrativeBoost = (narrativeEngine?.boostedTickers?.length || 0) * 1.5; // +1.5 per resonance ticker (cap implicit via clamp below)

  let riskAppetite = clamp(
    50 +
    qqq * 7 -
    Math.max(0, vix) * 4 -
    Math.max(0, tnx) * 2 -
    Math.max(0, dxy) * 2 -
    Math.max(0, gold) * 1.2 +
    (breadthScore - 50) * 0.4 +
    rvolExpansion * 1.2 +
    polBoost +
    Math.min(narrativeBoost, 6)
  );

  if (risk?.mode === "Risk-Off") riskAppetite = Math.min(riskAppetite, 44);
  if (risk?.mode === "Risk-On") riskAppetite = Math.max(riskAppetite, 56);

  const regime = riskAppetite >= 62 ? "SPECULATIVE" : riskAppetite >= 52 ? "RISK-ON" : riskAppetite <= 40 ? "DEFENSIVE" : "NEUTRAL";
  const openingDrive = highConviction >= 2 ? "Opening Drive 关注" : watchlist >= 2 ? "Opening Bias 偏观察" : "低确信度开盘";
  const trendDayProb = clamp(Math.round(riskAppetite * 0.9 + highConviction * 6 - Math.max(0, vix) * 2));
  const gammaProxy = clamp(Math.round(50 + (qqq > 0 ? 8 : -6) + highConviction * 5 - Math.max(0, vix) * 1.2));

  // Per-ticker conviction amplification via political resonance
  const boostedTickers = narrativeEngine?.boostedTickers || [];

  return {
    regime,
    riskAppetite: Math.round(riskAppetite),
    openingDrive,
    trendDayProbability: trendDayProb,
    gammaProxy,
    momentumRanking: topScanner.map((item) => ({
      symbol: item.symbol,
      score: item.score,
      status: item.status,
      // Amplify confidence score for politically-resonant tickers
      politicalBoost: boostedTickers.includes(item.symbol) ? true : false
    })),
    convictionSummary: highConviction > 0 ? "有高确信度标的" : "以观察名单为主",
    politicalFactor: {
      active: polBuyCount > 0,
      boostApplied: polBoost,
      buySignalCount: polBuyCount,
      boostedTickers
    },
    dataQuality: "proxy",
    source: "Signal Engine v2 (with Political Factor)"
  };
}
