const FOCUS = new Set(["SPY", "QQQ", "NVDA", "AMD", "AVGO", "PLTR", "TSLA", "COIN", "MSTR", "MRVL", "MSFT", "META", "CRWD", "SMR", "OKLO", "NNE", "UEC"]);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function catalystBoost(symbol, news = []) {
  const matched = news.filter((item) => item.ticker === symbol);
  if (!matched.length) return { score: 0, reason: "无新闻催化" };
  const bullish = matched.filter((item) => item.bias === "BULLISH").length;
  const bearish = matched.filter((item) => item.bias === "BEARISH").length;
  if (bullish > bearish) return { score: 12, reason: "利好催化" };
  if (bearish > bullish) return { score: -8, reason: "利空催化" };
  return { score: 4, reason: "中性催化" };
}

export function runPremarketScanner({ quotes = [], news = [] } = {}) {
  const pool = quotes.filter((item) => FOCUS.has(item.symbol));
  return pool.map((item) => {
    const gap = Number(item.preMarketChange ?? item.regularMarketChangePercent ?? 0);
    const relVol = Number(item.relativeVolume || item.volumeRatio || 1);
    const catalyst = catalystBoost(item.symbol, news);
    const score = clamp(
      45 +
      Math.min(20, Math.max(-20, gap * 4)) +
      Math.min(20, relVol * 8) +
      catalyst.score
    );
    const status = score >= 80 ? "HIGH CONVICTION" : score >= 65 ? "WATCHLIST" : score >= 50 ? "MEAN REVERSION RISK" : "AVOID CHASING";
    return {
      symbol: item.symbol,
      sector: item.sector,
      gapPercent: gap,
      relativeVolume: relVol,
      score,
      status,
      catalyst: catalyst.reason
    };
  }).sort((a, b) => b.score - a.score).slice(0, 12);
}
