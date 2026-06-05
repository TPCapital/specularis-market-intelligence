const STATUS_WEIGHT = {
  live: 1,
  delayed: 0.75,
  proxy: 0.4,
  stale: 0.25,
  cached: 0.25,
  snapshot: 0,
  unavailable: 0
};

const CORE_WEIGHTS = {
  marketData: 0.34,
  premarketMomentum: 0.16,
  marketBreadth: 0.14,
  tradingView: 0.1,
  relativeVolume: 0.1,
  sectorHeat: 0.08,
  newsCatalysts: 0.04,
  optionsSignals: 0.04
};

function normalizeStatus(status = "") {
  const value = String(status || "").toLowerCase();
  if (value === "live") return "live";
  if (value === "delayed") return "delayed";
  if (value === "proxy") return "proxy";
  if (value === "cached") return "cached";
  if (value === "stale") return "stale";
  if (value === "snapshot") return "snapshot";
  if (value === "unavailable") return "unavailable";
  return "unavailable";
}

function grade(score) {
  if (score >= 78) return "HIGH";
  if (score >= 52) return "MEDIUM";
  return "LOW";
}

export function buildConfidenceScore(sources = {}) {
  const detail = Object.entries(CORE_WEIGHTS).map(([key, weight]) => {
    const source = sources[key] || {};
    const status = normalizeStatus(source.status || source.dataQuality);
    const weighted = (STATUS_WEIGHT[status] ?? 0) * weight;
    return {
      source: key,
      status,
      weight,
      score: Math.round(weighted * 100),
      confidence: source.confidence || grade(weighted * 100)
    };
  });
  const raw = detail.reduce((sum, item) => sum + item.score, 0);
  const dataConfidence = grade(raw);
  const marketLive = normalizeStatus(sources.marketData?.status) === "live";
  const momentumLive = ["live", "delayed"].includes(normalizeStatus(sources.premarketMomentum?.status));
  const breadthLive = ["live", "delayed"].includes(normalizeStatus(sources.marketBreadth?.status));
  const signalScore = Math.min(100, raw + (marketLive ? 8 : 0) + (momentumLive ? 5 : 0) + (breadthLive ? 4 : 0));
  const tradeScore = Math.min(100, signalScore);

  return {
    dataConfidence,
    signalConfidence: grade(signalScore),
    tradeConfidence: grade(tradeScore),
    score: Math.round(tradeScore),
    detail
  };
}
