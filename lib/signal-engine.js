function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export function buildSignalEngine({ indices = [], scanner = [], breadth = null, risk = null } = {}) {
  const qqq = indices.find((item) => item.id === "QQQ")?.change || 0;
  const vix = indices.find((item) => item.id === "VIX")?.change || 0;
  const tnx = indices.find((item) => item.id === "TNX")?.change || 0;
  const dxy = indices.find((item) => item.id === "DXY")?.change || 0;
  const topScanner = scanner.slice(0, 5);
  const highConviction = topScanner.filter((item) => item.status === "HIGH CONVICTION").length;
  const watchlist = topScanner.filter((item) => item.status === "WATCHLIST").length;
  const breadthScore = breadth?.breadthStrength ?? 50;

  let riskAppetite = clamp(50 + qqq * 7 - Math.max(0, vix) * 4 - Math.max(0, tnx) * 2 - Math.max(0, dxy) * 2 + (breadthScore - 50) * 0.4);
  if (risk?.mode === "Risk-Off") riskAppetite = Math.min(riskAppetite, 44);
  if (risk?.mode === "Risk-On") riskAppetite = Math.max(riskAppetite, 56);

  const regime = riskAppetite >= 62 ? "SPECULATIVE" : riskAppetite >= 52 ? "RISK-ON" : riskAppetite <= 40 ? "DEFENSIVE" : "NEUTRAL";
  const openingDrive = highConviction >= 2 ? "Opening Drive 关注" : watchlist >= 2 ? "Opening Bias 偏观察" : "低确信度开盘";
  const trendDayProb = clamp(Math.round(riskAppetite * 0.9 + highConviction * 6 - Math.max(0, vix) * 2));
  const gammaProxy = clamp(Math.round(50 + (qqq > 0 ? 8 : -6) + highConviction * 5 - Math.max(0, vix) * 1.2));

  return {
    regime,
    riskAppetite: Math.round(riskAppetite),
    openingDrive,
    trendDayProbability: trendDayProb,
    gammaProxy,
    momentumRanking: topScanner.map((item) => ({ symbol: item.symbol, score: item.score, status: item.status })),
    convictionSummary: highConviction > 0 ? "有高确信度标的" : "以观察名单为主",
    dataQuality: "proxy",
    source: "Signal Engine v1"
  };
}
