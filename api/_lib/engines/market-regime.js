function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function byId(indices = []) {
  return Object.fromEntries((indices || []).map((item) => [item.id || item.symbol, item]));
}

function direction(value) {
  if (value > 0.15) return "up";
  if (value < -0.15) return "down";
  return "flat";
}

export function buildMarketRegime({ marketData = {}, premarketMomentum = {}, marketBreadth = {}, tradingView = [] } = {}) {
  const indices = byId(marketData.data?.indices || marketData.indices || []);
  const spy = Number(indices.SPY?.change || 0);
  const qqq = Number(indices.QQQ?.change || indices.NDX?.change || 0);
  const vix = Number(indices.VIX?.change || 0);
  const dxy = Number(indices.DXY?.change || 0);
  const tnx = Number(indices.TNX?.change || 0);
  const gold = Number(indices.GOLD?.change || 0);
  const breadthScore = Number(marketBreadth.data?.breadthScore ?? marketBreadth.breadthScore ?? 50);
  const leaders = premarketMomentum.data?.leaders || premarketMomentum.leaders || [];
  const leaderCount = leaders.filter((item) => Number(item.momentumScore || 0) >= 65).length;
  const tvCount = (tradingView.data || tradingView || []).filter((item) => Number(item.score || 0) >= 70).length;
  const qqqRelative = qqq - spy;

  let score = 50 + spy * 5 + qqq * 8 - Math.max(0, vix) * 4 - Math.max(0, dxy) * 2 - Math.max(0, tnx) * 2 - Math.max(0, gold) * 1.2 + (breadthScore - 50) * 0.18 + leaderCount * 2 + tvCount * 0.8;
  score = clamp(Math.round(score));

  let type = "NEUTRAL";
  if (score >= 70 && qqq > 0 && leaderCount >= 3) type = "TREND_DAY";
  else if (score >= 58 && qqq >= 0) type = "RISK_ON";
  else if (vix > 1.2 && qqq < 0) type = "RISK_OFF";
  else if (Math.abs(spy) < 0.25 && Math.abs(qqq) < 0.25) type = "CHOP";
  else if (spy > 0.8 && qqq < spy - 0.4) type = "GAP_FADE";
  else if (vix < -1 && qqq > 0.4 && leaderCount >= 2) type = "SQUEEZE";

  const preferredStyle = {
    TREND_DAY: "顺势追随",
    RISK_ON: "早盘突破",
    RISK_OFF: "防御等待",
    CHOP: "控仓观察",
    SQUEEZE: "顺势追随",
    GAP_FADE: "避免追高",
    NEUTRAL: "控仓观察"
  }[type];

  return {
    type,
    score,
    tradable: ["live", "delayed"].includes(String(marketData.status || "").toLowerCase()),
    preferredStyle,
    spyDirection: direction(spy),
    qqqDirection: direction(qqq),
    qqqRelativeStrength: Number(qqqRelative.toFixed(2)),
    vixDirection: direction(vix),
    breadthStrength: Math.round(breadthScore),
    momentumLeadersCount: leaderCount,
    explanation: `SPY ${spy.toFixed(2)}%，QQQ ${qqq.toFixed(2)}%，VIX ${vix.toFixed(2)}%，GOLD ${gold.toFixed(2)}%，市场宽度 ${Math.round(breadthScore)}，动能股 ${leaderCount} 个。`
  };
}
