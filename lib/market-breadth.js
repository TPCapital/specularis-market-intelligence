export function buildMarketBreadth({ quotes = [], sectors = [], indices = [] } = {}) {
  const changes = quotes.map((item) => Number(item.preMarketChange ?? item.regularMarketChangePercent ?? 0)).filter(Number.isFinite);
  const adv = changes.filter((v) => v > 0).length;
  const dec = changes.filter((v) => v < 0).length;
  const unchanged = Math.max(0, changes.length - adv - dec);
  const leaders = [...sectors].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3).map((item) => item.sector);
  const laggards = [...sectors].sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 3).map((item) => item.sector);
  const qqq = indices.find((item) => item.id === "QQQ")?.change || 0;
  const spy = indices.find((item) => item.id === "SPY")?.change || 0;
  const vix = indices.find((item) => item.id === "VIX")?.change || 0;
  const breadthStrength = adv + dec > 0 ? (adv / (adv + dec)) * 100 : 50;
  const indexConfirmation = qqq >= spy && vix <= 0 ? "确认" : qqq < spy && vix > 0 ? "背离" : "中性";
  return {
    advanceDecline: { advance: adv, decline: dec, unchanged },
    breadthStrength: Math.round(breadthStrength),
    sectorRotation: { leaders, laggards },
    newHighLowProxy: {
      newHigh: changes.filter((v) => v >= 2).length,
      newLow: changes.filter((v) => v <= -2).length
    },
    indexConfirmation,
    source: "Multi-source Breadth Proxy",
    confidence: adv + dec >= 8 ? "中" : "低"
  };
}
