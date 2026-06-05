function setupFromScore(score) {
  if (score >= 82) return "开盘强势延续";
  if (score >= 68) return "突破观察";
  return "等待确认";
}

function riskFromItem(item, regime) {
  if (regime?.type === "RISK_OFF") return "指数风险偏弱，避免追高。";
  if (Number(item.premarketPercent || 0) > 4) return "跳空较大，警惕高开回落。";
  if (Number(item.relativeVolume || 0) < 1.2) return "相对成交量不足，需确认承接。";
  return "等待 VWAP 与开盘量能确认。";
}

function normalizeCandidate(item = {}, regime = {}) {
  const score = Number(item.momentumScore || item.score || 0);
  return {
    symbol: item.symbol || item.ticker,
    sector: item.sector || "动量股",
    score,
    setup: setupFromScore(score),
    catalyst: item.catalyst || "盘前动量与相对强弱进入扫描。",
    reason: `${item.sector || "动量股"}动量分 ${score}，RVOL ${Number(item.relativeVolume || 1).toFixed(2)}x。`,
    risk: riskFromItem(item, regime)
  };
}

export function buildWatchlist({ premarketMomentum = {}, marketRegime = {}, relativeVolume = {} } = {}) {
  const momentum = premarketMomentum.data?.leaders || premarketMomentum.leaders || [];
  const rvol = relativeVolume.data?.leaders || relativeVolume.leaders || [];
  const rvolMap = new Map(rvol.map((item) => [item.symbol, item]));
  const candidates = momentum.map((item) => normalizeCandidate({
    ...item,
    relativeVolume: item.relativeVolume || rvolMap.get(item.symbol)?.relativeVolume
  }, marketRegime));

  return {
    strong: candidates.filter((item) => item.score >= 80).slice(0, 5),
    watch: candidates.filter((item) => item.score >= 60 && item.score < 80).slice(0, 7),
    avoid: candidates.filter((item) => item.score < 60).slice(0, 5)
  };
}
