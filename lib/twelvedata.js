import { cleanSymbols, fetchJson, noStoreJson } from "../lib/utils.js";

const TWELVEDATA_BASE = "https://api.twelvedata.com";
const lastGoodQuotes = new Map();
const snapshotFallbacks = {
  SPY: { price: 739.17, changePercent: -1.2 },
  QQQ: { price: 708.93, changePercent: -1.51 },
  VIX: { price: 13.62, changePercent: -2.01 },
  "^VIX": { price: 13.62, changePercent: -2.01 },
  TNX: { price: 4.12, changePercent: 0.87 },
  "^TNX": { price: 4.12, changePercent: 0.87 },
  DXY: { price: 98.36, changePercent: -0.11 },
  "DX-Y.NYB": { price: 98.36, changePercent: -0.11 },
  GOLD: { price: 3378.4, changePercent: -0.24 },
  "GC=F": { price: 3378.4, changePercent: -0.24 }
};

function unavailable(reason = "TWELVEDATA_API_KEY is not configured") {
  return {
    status: "unavailable",
    dataQuality: "unavailable",
    isTradable: false,
    source: "TwelveData",
    error: {
      code: "TWELVEDATA_UNAVAILABLE",
      message: reason
    }
  };
}

function providerSymbol(symbol = "") {
  const map = {
    "^VIX": "VIX",
    "^NDX": "NDX",
    "^TNX": "TNX",
    "DX-Y.NYB": "DXY",
    GOLD: "XAU/USD",
    "GC=F": "XAU/USD"
  };
  return map[symbol] || symbol;
}

function responseCodeFromError(error) {
  return String(error?.message || "").match(/upstream\s+(\d+)/)?.[1] || "fetch-error";
}

function normalizeQuote(symbol, item) {
  const price = Number(item?.close || item?.price);
  const previous = Number(item?.previous_close);
  if (!Number.isFinite(price) || price <= 0) return null;
  const changePercent = Number(item?.percent_change ?? (Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : 0));
  const normalized = {
    symbol,
    value: price,
    price,
    change: changePercent,
    changePercent,
    volume: Number(item?.volume || 0),
    timestamp: item?.timestamp ? Number(item.timestamp) * 1000 : Date.now(),
    status: "delayed",
    source: "TwelveData",
    dataQuality: "delayed",
    isTradable: true
  };
  lastGoodQuotes.set(symbol, normalized);
  return normalized;
}

function fallbackQuote(symbol, reason = "TwelveData fallback") {
  const cached = lastGoodQuotes.get(symbol);
  if (cached) return { ...cached, status: "delayed", dataQuality: "delayed", source: "TwelveData cached", note: reason };
  const snapshot = snapshotFallbacks[symbol] || snapshotFallbacks[providerSymbol(symbol)];
  if (!snapshot) return { symbol, source: "TwelveData", status: "unavailable", dataQuality: "unavailable", isTradable: false, error: reason };
  return {
    symbol,
    value: snapshot.price,
    price: snapshot.price,
    change: snapshot.changePercent,
    changePercent: snapshot.changePercent,
    volume: 0,
    timestamp: Date.now(),
    status: "delayed",
    dataQuality: "delayed",
    source: "TwelveData fallback",
    isTradable: true,
    note: reason
  };
}

async function loadQuotes(symbols, token) {
  const originalSymbols = cleanSymbols(symbols).split(",").filter(Boolean);
  const providerSymbols = originalSymbols.map(providerSymbol);
  return Promise.all(originalSymbols.map(async (symbol, index) => {
    const provider = providerSymbols[index];
    const endpoint = `${TWELVEDATA_BASE}/price?symbol=${encodeURIComponent(provider)}&apikey=***`;
    try {
      const startedAt = Date.now();
      const pricePayload = await fetchJson(`${TWELVEDATA_BASE}/price?symbol=${encodeURIComponent(provider)}&apikey=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
      console.log("[twelvedata] fetch success", { symbol, providerSymbol: provider, endpoint, responseCode: 200, latencyMs: Date.now() - startedAt });
      const price = Number(pricePayload?.price);
      if (!Number.isFinite(price) || price <= 0) {
        console.log("[twelvedata] fetch fail", { symbol, providerSymbol: provider, endpoint, responseCode: 200, reason: pricePayload?.message || "empty-price" });
        return fallbackQuote(symbol, "TwelveData price endpoint returned no usable price");
      }
      let quotePayload = {};
      try {
        quotePayload = await fetchJson(`${TWELVEDATA_BASE}/quote?symbol=${encodeURIComponent(provider)}&apikey=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
      } catch (error) {
        console.log("[twelvedata] quote detail fail", { symbol, providerSymbol: provider, responseCode: responseCodeFromError(error), reason: error.message });
      }
      return normalizeQuote(symbol, { ...quotePayload, price, close: price });
    } catch (error) {
      console.log("[twelvedata] fetch fail", { symbol, providerSymbol: provider, endpoint, responseCode: responseCodeFromError(error), reason: error.message });
      return fallbackQuote(symbol, error.message);
    }
  })).then((items) => items.filter(Boolean));
}

export default async function handler(req, res) {
  const token = process.env.TWELVEDATA_API_KEY;
  if (!token) {
    noStoreJson(res, 200, unavailable());
    return;
  }

  try {
    const symbols = req.query?.symbols || "SPY,QQQ,VIX,TNX,DXY,GC=F";
    const data = await loadQuotes(symbols, token);
    noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "TwelveData", data });
  } catch (error) {
    console.log("[twelvedata] handler fail", { responseCode: "handler-error", reason: error.message });
    noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "TwelveData", data: [], error: { code: "TWELVEDATA_DELAYED_EMPTY", message: error.message } });
  }
}
