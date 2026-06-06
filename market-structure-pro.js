function regimeText(type) {
  return {
    TREND_DAY: "趋势日",
    RISK_ON: "风险偏好开启",
    RISK_OFF: "风险规避",
    NEUTRAL: "中性",
    CHOP: "震荡",
    SQUEEZE: "空头回补",
    GAP_FADE: "高开回落风险"
  }[type] || "中性";
}

function biasFromRegime(type) {
  if (["TREND_DAY", "RISK_ON", "SQUEEZE"].includes(type)) return "BULLISH";
  if (["RISK_OFF", "GAP_FADE"].includes(type)) return "BEARISH";
  return "NEUTRAL";
}

export function buildStrategySummary({ marketRegime = {}, premarketMomentum = {}, marketBreadth = {}, confidenceScore = {} } = {}) {
  const leaders = (premarketMomentum.data?.leaders || premarketMomentum.leaders || []).slice(0, 4);
  const focusSymbols = leaders.map((item) => item.symbol || item.ticker).filter(Boolean);
  const focusSectors = [...new Set(leaders.map((item) => item.sector).filter(Boolean))].slice(0, 4);
  const regime = marketRegime.type || "NEUTRAL";
  const bias = biasFromRegime(regime);
  const breadth = marketBreadth.data?.breadthScore ?? marketBreadth.breadthScore ?? marketRegime.breadthStrength ?? 50;
  const headline = `${regimeText(regime)}｜${marketRegime.preferredStyle || "控仓观察"}`;
  const summary = focusSymbols.length
    ? `${marketRegime.explanation} 盘前动能集中在 ${focusSymbols.join(" / ")}，优先等待开盘量价确认。`
    : `${marketRegime.explanation} 暂无高质量动能龙头，优先等待开盘确认。`;

  return {
    regime,
    headline,
    summary,
    bias,
    confidence: confidenceScore.tradeConfidence || confidenceScore.signalConfidence || "MEDIUM",
    reasons: [
      `SPY/QQQ 方向与 VIX 状态共同定义 ${regimeText(regime)}。`,
      `市场宽度 ${Math.round(Number(breadth || 0))}，动能龙头数量 ${marketRegime.momentumLeadersCount || 0}。`,
      focusSymbols.length ? `重点观察 ${focusSymbols.join(" / ")}。` : "等待动能榜恢复。"
    ],
    risks: [
      regime === "GAP_FADE" ? "高开回落风险较高。" : "无量突破容易失败。",
      "若 QQQ 与 breadth 同时转弱，降低进攻仓位。"
    ],
    avoid: [
      "低相对成交量标的",
      "无新闻催化的高开追涨",
      "逆指数方向连续加仓"
    ],
    focusSectors,
    focusSymbols
  };
}
