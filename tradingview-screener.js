import { cleanSymbols, fetchJson } from "./utils.js";

function confidenceFromStatus(status) {
  if (status === "live") return "HIGH";
  if (status === "delayed") return "MEDIUM";
  return "LOW";
}

function freshness(updatedAt) {
  if (!updatedAt) return "stale";
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

function signalStrength(change, share) {
  const magnitude = Math.abs(Number(change || 0)) + Math.abs(Number(share || 0));
  if (magnitude > 2_000_000) return "HIGH";
  if (magnitude > 250_000) return "MEDIUM";
  return "LOW";
}

function sentimentOf(change) {
  if (Number(change) > 0) return "BULLISH";
  if (Number(change) < 0) return "BEARISH";
  return "NEUTRAL";
}

export async function buildInsiderLayer({ symbols = "", finnhubKey = "" } = {}) {
  const startedAt = Date.now();
  if (!finnhubKey) {
    return {
      status: "unavailable",
      source: "UNAVAILABLE",
      latency: null,
      timestamp: new Date().toISOString(),
      freshness: "stale",
      confidence: "LOW",
      fallback: true,
      signals: []
    };
  }

  const list = cleanSymbols(symbols).split(",").filter(Boolean).slice(0, 15);
  const rows = await Promise.all(list.map(async (symbol) => {
    try {
      const payload = await fetchJson(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(finnhubKey)}`, { timeoutMs: 4200 });
      return (payload.data || []).slice(0, 4).map((item) => ({
        symbol,
        sentiment: sentimentOf(item.change),
        buySell: Number(item.change || 0) >= 0 ? "BUY" : "SELL",
        transactionValue: Math.round(Math.abs(Number(item.change || 0)) * Math.abs(Number(item.share || 0))),
        insiderRole: item.name || "Insider",
        date: item.transactionDate || null,
        signalStrength: signalStrength(item.change, item.share)
      }));
    } catch (error) {
      console.error("[insider] Finnhub error:", symbol, error?.message || error);
      return [];
    }
  }));

  const signals = rows.flat().slice(0, 40);
  const updatedAt = Date.now();
  return {
    status: signals.length ? "delayed" : "unavailable",
    source: "Finnhub Insider Transactions",
    latency: updatedAt - startedAt,
    timestamp: new Date(updatedAt).toISOString(),
    freshness: freshness(updatedAt),
    confidence: confidenceFromStatus(signals.length ? "delayed" : "unavailable"),
    fallback: !signals.length,
    signals
  };
}
