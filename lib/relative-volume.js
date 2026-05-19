function confidenceFromStatus(status) {
  if (status === "live") return "HIGH";
  if (status === "delayed") return "MEDIUM";
  if (status === "proxy") return "LOW";
  return "LOW";
}

function freshness(updatedAt) {
  if (!updatedAt) return "stale";
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

function classify(relativeVolume, hasRealVolume, changePercent) {
  if (!hasRealVolume) return "PROXY_ONLY";
  if (relativeVolume >= 1.8) return "RVOL_EXPANSION";
  if (relativeVolume >= 1.2 || Math.abs(changePercent) >= 1.2) return "PREMARKET_ACTIVE";
  return "LOW_VOLUME";
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export function buildRelativeVolumeLayer({ quotes = [], tradingView = [] } = {}) {
  const startedAt = Date.now();
  const tvMap = new Map((tradingView || []).map((row) => [String(row.symbol || "").split(":").pop(), Number(row.volume || 0)]));
  const leaders = (quotes || [])
    .filter((item) => item?.symbol)
    .map((item) => {
      const volume = Number(item.volume || 0);
      const avgVolume = Number(item.averageVolume || 0);
      const changePercent = Number(item.preMarketChangePercent ?? item.preMarketChange ?? item.regularMarketChangePercent ?? 0);
      const hasRealVolume = volume > 0 && avgVolume > 0;
      const proxyFromTv = Number(tvMap.get(item.symbol) || 0);
      const proxySeed = Number(item.relativeVolume || item.volumeRatio || 1);
      const relativeVolume = hasRealVolume
        ? volume / avgVolume
        : clamp(1 + Math.min(2, Math.abs(changePercent) / 3) + (proxyFromTv > 0 ? 0.2 : 0) + (proxySeed - 1) * 0.5, 0.5, 3.5);
      return {
        symbol: item.symbol,
        relativeVolume: Number(relativeVolume.toFixed(2)),
        volume,
        avgVolume,
        changePercent: Number(changePercent.toFixed(2)),
        sector: item.sector || "其他",
        signal: classify(relativeVolume, hasRealVolume, changePercent),
        source: hasRealVolume ? "Quote Volume" : "Proxy Inference"
      };
    })
    .sort((a, b) => b.relativeVolume - a.relativeVolume)
    .slice(0, 20);

  const status = leaders.some((item) => item.signal !== "PROXY_ONLY") ? "delayed" : "proxy";
  const updatedAt = Date.now();
  return {
    status,
    source: "Relative Volume Scanner",
    latency: updatedAt - startedAt,
    timestamp: new Date(updatedAt).toISOString(),
    freshness: freshness(updatedAt),
    confidence: confidenceFromStatus(status),
    fallback: status === "proxy",
    leaders
  };
}
