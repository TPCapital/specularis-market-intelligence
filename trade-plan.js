function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function freshness(updatedAt) {
  if (!updatedAt) return "stale";
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

export function buildMarketBreadth({ quotes = [], sectors = [], indices = [], status = "proxy" } = {}) {
  const startedAt = Date.now();
  const changes = quotes.map((item) => Number(item.preMarketChange ?? item.regularMarketChangePercent ?? 0)).filter(Number.isFinite);
  const adv = changes.filter((v) => v > 0).length;
  const dec = changes.filter((v) => v < 0).length;
  const valid = adv + dec;
  const advanceDeclineRatio = dec === 0 ? (adv > 0 ? adv : 1) : Number((adv / dec).toFixed(2));
  const strongestSectors = [...sectors].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3).map((item) => item.sector);
  const weakestSectors = [...sectors].sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 3).map((item) => item.sector);
  const megaCaps = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL"];
  const megaCapLeadership = quotes
    .filter((q) => megaCaps.includes(q.symbol))
    .map((q) => Number(q.preMarketChange ?? q.regularMarketChangePercent ?? 0))
    .filter(Number.isFinite);
  const megaCapAvg = megaCapLeadership.length
    ? megaCapLeadership.reduce((a, b) => a + b, 0) / megaCapLeadership.length
    : 0;
  const aiSymbols = ["NVDA", "AMD", "AVGO", "MRVL", "PLTR", "MSFT"];
  const aiMoves = quotes
    .filter((q) => aiSymbols.includes(q.symbol))
    .map((q) => Number(q.preMarketChange ?? q.regularMarketChangePercent ?? 0))
    .filter(Number.isFinite);
  const aiConcentration = aiMoves.length ? clamp(Math.round(50 + aiMoves.reduce((a, b) => a + b, 0) * 6), 0, 100) : 50;
  const participation = valid > 0 ? clamp(Math.round((adv / valid) * 100), 0, 100) : 50;
  const qqq = Number(indices.find((i) => i.id === "QQQ")?.change || 0);
  const spy = Number(indices.find((i) => i.id === "SPY")?.change || 0);
  const vix = Number(indices.find((i) => i.id === "VIX")?.change || 0);
  const riskBreadth = clamp(Math.round(participation + megaCapAvg * 6 - Math.max(0, vix) * 3), 0, 100);
  const breadthScore = clamp(Math.round((participation * 0.45) + (riskBreadth * 0.35) + (aiConcentration * 0.2)), 0, 100);
  const regimeHint = breadthScore >= 62 && qqq >= spy ? "RISK-ON BREADTH" : breadthScore <= 42 ? "RISK-OFF BREADTH" : "MIXED BREADTH";
  const updatedAt = Date.now();

  return {
    status,
    source: "Market Breadth Engine",
    latency: updatedAt - startedAt,
    timestamp: new Date(updatedAt).toISOString(),
    freshness: freshness(updatedAt),
    confidence: status === "live" ? "HIGH" : status === "delayed" ? "MEDIUM" : "LOW",
    fallback: status === "snapshot" || status === "proxy" || status === "unavailable",
    breadthScore,
    advanceDeclineRatio,
    strongestSectors,
    weakestSectors,
    aiConcentration,
    marketParticipation: participation,
    megaCapLeadership: Number(megaCapAvg.toFixed(2)),
    riskBreadth,
    bullishParticipation: participation >= 55,
    regimeHint,
    advanceDecline: { advance: adv, decline: dec, unchanged: Math.max(0, changes.length - adv - dec) }
  };
}
