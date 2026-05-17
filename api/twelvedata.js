import { cleanSymbols, fetchJson, noStoreJson } from "./_utils.js";

const TWELVEDATA_BASE = "https://api.twelvedata.com";

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
    "GC=F": "XAU/USD"
  };
  return map[symbol] || symbol;
}

function normalizeQuote(symbol, item) {
  const price = Number(item?.close || item?.price);
  const previous = Number(item?.previous_close);
  if (!Number.isFinite(price) || price <= 0) return null;
  const changePercent = Number(item?.percent_change ?? (Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : 0));
  return {
    symbol,
    price,
    changePercent,
    volume: Number(item?.volume || 0),
    timestamp: item?.timestamp ? Number(item.timestamp) * 1000 : Date.now(),
    source: "TwelveData",
    dataQuality: "delayed",
    isTradable: true
  };
}

async function loadQuotes(symbols, token) {
  const originalSymbols = cleanSymbols(symbols).split(",").filter(Boolean);
  const providerSymbols = originalSymbols.map(providerSymbol);
  const url = `${TWELVEDATA_BASE}/quote?symbol=${encodeURIComponent(providerSymbols.join(","))}&apikey=${encodeURIComponent(token)}`;
  const payload = await fetchJson(url, { timeoutMs: 10000 });
  const isBatch = originalSymbols.length > 1;
  return originalSymbols.map((symbol, index) => {
    const row = isBatch ? payload[providerSymbols[index]] : payload;
    if (row?.status === "error" || row?.code) {
      return { symbol, source: "TwelveData", dataQuality: "unavailable", isTradable: false, error: row.message || "TwelveData symbol unavailable" };
    }
    return normalizeQuote(symbol, row);
  }).filter(Boolean);
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
    if (!data.some((item) => item.isTradable)) {
      noStoreJson(res, 200, unavailable("TwelveData returned no usable quotes"));
      return;
    }
    noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "TwelveData", data });
  } catch (error) {
    noStoreJson(res, 200, unavailable(error.message));
  }
}
