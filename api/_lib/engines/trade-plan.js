export function buildTradePlan({ marketRegime = {}, strategySummary = {}, watchlist = {} } = {}) {
  const top = [...(watchlist.strong || []), ...(watchlist.watch || [])].slice(0, 3).map((item) => item.symbol);
  const actionByRegime = {
    TREND_DAY: "顺势进攻",
    RISK_ON: "可进攻但控仓",
    SQUEEZE: "跟随强势突破",
    CHOP: "控仓观察",
    GAP_FADE: "避免追高，等回踩",
    RISK_OFF: "防御等待",
    NEUTRAL: "等待确认"
  };
  const action = actionByRegime[marketRegime.type] || "等待确认";
  return {
    action,
    entryCondition: top.length
      ? `只做 ${top.join(" / ")} 等强势股开盘后放量突破 VWAP 或回踩重新转强。`
      : "只做开盘后放量突破 VWAP 的强势股。",
    invalidation: "若 QQQ 跌破开盘区间且 breadth 转弱，取消追涨。",
    riskControl: "单笔风险控制在账户 1%-2%，禁止连续追单。",
    targetStyle: marketRegime.preferredStyle || "控仓观察",
    avoidCondition: strategySummary.avoid?.[0] || "避免无量高开、低 RVOL breakout 与逆势追单。"
  };
}
