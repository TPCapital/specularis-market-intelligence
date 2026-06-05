import { cleanSymbols, fetchJson } from "./utils.js";

function symbolSet(raw = "") {
  return new Set(cleanSymbols(raw).split(",").filter(Boolean));
}

function confidenceFromStatus(status) {
  if (status === "live") return "HIGH";
  if (status === "delayed") return "MEDIUM";
  if (status === "proxy" || status === "snapshot") return "LOW";
  return "LOW";
}

function freshness(updatedAt) {
  if (!updatedAt) return "stale";
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

function catalystTag(event = {}) {
  if (Number.isFinite(Number(event.epsActual)) && Number.isFinite(Number(event.epsEstimate))) {
    if (Number(event.epsActual) > Number(event.epsEstimate)) return "EARNINGS_BEAT";
    if (Number(event.epsActual) < Number(event.epsEstimate)) return "EARNINGS_MISS";
  }
  return "EARNINGS_AHEAD";
}

function importance(event = {}) {
  const marketCapHint = String(event.symbol || "").match(/^(AAPL|MSFT|NVDA|AMZN|META|GOOGL|TSLA|AVGO|AMD)$/) ? 90 : 65;
  return marketCapHint;
}

async function loadFinnhubEarnings(symbols, token) {
  const payload = await fetchJson(`https://finnhub.io/api/v1/calendar/earnings?token=${encodeURIComponent(token)}`, { timeoutMs: 4200 });
  const watch = symbolSet(symbols);
  return (payload.earningsCalendar || [])
    .filter((item) => watch.has(item.symbol))
    .slice(0, 40)
    .map((item) => ({
      symbol: item.symbol,
      company: item.symbol,
      reportDate: item.date || null,
      time: item.hour || "TBD",
      epsEstimate: item.epsEstimate ?? null,
      revenueEstimate: item.revenueEstimate ?? null,
      importance: importance(item),
      catalystTag: catalystTag(item)
    }));
}

async function loadAlphaVantageEarnings(symbols, token) {
  const payload = await fetchJson(`https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${encodeURIComponent(token)}`, { timeoutMs: 4500 });
  const rows = String(payload || "").split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const watch = symbolSet(symbols);
  const header = rows[0].split(",");
  const idxSymbol = header.indexOf("symbol");
  const idxDate = header.indexOf("reportDate");
  const idxEstimate = header.indexOf("estimate");
  return rows.slice(1).map((line) => {
    const parts = line.split(",");
    const symbol = parts[idxSymbol];
    if (!watch.has(symbol)) return null;
    return {
      symbol,
      company: symbol,
      reportDate: parts[idxDate] || null,
      time: "TBD",
      epsEstimate: parts[idxEstimate] || null,
      revenueEstimate: null,
      importance: importance({ symbol }),
      catalystTag: "EARNINGS_AHEAD"
    };
  }).filter(Boolean).slice(0, 40);
}

export async function buildEarningsLayer({ symbols = "", finnhubKey = "", alphaVantageKey = "" } = {}) {
  const startedAt = Date.now();
  try {
    let events = [];
    let source = "UNAVAILABLE";
    let status = "unavailable";

    if (finnhubKey) {
      try {
        events = await loadFinnhubEarnings(symbols, finnhubKey);
        if (events.length) {
          source = "Finnhub Earnings Calendar";
          status = "delayed";
        }
      } catch (error) {
        console.error("[earnings] Finnhub error:", error?.message || error);
      }
    }

    if (!events.length && alphaVantageKey) {
      try {
        const alphaEvents = await loadAlphaVantageEarnings(symbols, alphaVantageKey);
        if (alphaEvents.length) {
          events = alphaEvents;
          source = "AlphaVantage Earnings Calendar";
          status = "delayed";
        }
      } catch (error) {
        console.error("[earnings] AlphaVantage error:", error?.message || error);
      }
    }

    const updatedAt = Date.now();
    return {
      status,
      source,
      latency: updatedAt - startedAt,
      timestamp: new Date(updatedAt).toISOString(),
      freshness: freshness(updatedAt),
      confidence: confidenceFromStatus(status),
      fallback: status === "unavailable",
      events
    };
  } catch (error) {
    console.error("[earnings] layer fatal:", error?.message || error);
    return {
      status: "unavailable",
      source: "UNAVAILABLE",
      latency: null,
      timestamp: new Date().toISOString(),
      freshness: "stale",
      confidence: "LOW",
      fallback: true,
      events: []
    };
  }
}
