import { cleanSymbols, fetchJson, noStoreJson } from "./_utils.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

function unavailable(reason = "FINNHUB_API_KEY is not configured") {
  return {
    status: "unavailable",
    dataQuality: "unavailable",
    isTradable: false,
    source: "Finnhub",
    error: {
      code: "FINNHUB_UNAVAILABLE",
      message: reason
    }
  };
}

function normalizeSymbol(symbol = "") {
  const map = {
    "^VIX": "VIX",
    "^NDX": "NDX",
    "^TNX": "TNX",
    "DX-Y.NYB": "DXY",
    "GC=F": "GC=F"
  };
  return map[symbol] || symbol;
}

async function loadQuotes(symbols, token) {
  const list = cleanSymbols(symbols).split(",").filter(Boolean);
  const quotes = await Promise.all(list.map(async (symbol) => {
    try {
      const payload = await fetchJson(`${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(normalizeSymbol(symbol))}&token=${encodeURIComponent(token)}`, { timeoutMs: 8000 });
      const price = Number(payload.c);
      if (!Number.isFinite(price) || price <= 0) return null;
      const previous = Number(payload.pc);
      const changePercent = Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : Number(payload.dp || 0);
      return {
        symbol,
        price,
        changePercent,
        volume: Number(payload.v || 0),
        timestamp: payload.t ? payload.t * 1000 : Date.now(),
        source: "Finnhub",
        dataQuality: "live",
        isTradable: true
      };
    } catch (error) {
      return { symbol, source: "Finnhub", dataQuality: "unavailable", isTradable: false, error: error.message };
    }
  }));
  return quotes.filter(Boolean);
}

async function loadCompanyNews(symbol, token) {
  const to = new Date();
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (date) => date.toISOString().slice(0, 10);
  const payload = await fetchJson(`${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
  return (Array.isArray(payload) ? payload : []).slice(0, 20).map((item) => ({
    title: item.headline,
    summary: item.summary || item.headline,
    url: item.url,
    datetime: item.datetime ? item.datetime * 1000 : Date.now(),
    source: item.source || "Finnhub",
    relatedSymbol: symbol,
    dataQuality: "delayed",
    isTradable: true
  }));
}

async function loadMarketNews(token) {
  const payload = await fetchJson(`${FINNHUB_BASE}/news?category=general&token=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
  return (Array.isArray(payload) ? payload : []).slice(0, 30).map((item) => ({
    title: item.headline,
    summary: item.summary || item.headline,
    url: item.url,
    datetime: item.datetime ? item.datetime * 1000 : Date.now(),
    source: item.source || "Finnhub",
    relatedSymbol: "",
    dataQuality: "delayed",
    isTradable: true
  }));
}

export default async function handler(req, res) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    noStoreJson(res, 200, unavailable());
    return;
  }

  try {
    const mode = String(req.query?.mode || "quote");
    if (mode === "company-news") {
      const symbol = String(req.query?.symbol || "SPY").toUpperCase();
      noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "Finnhub", data: await loadCompanyNews(symbol, token) });
      return;
    }
    if (mode === "market-news") {
      noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "Finnhub", data: await loadMarketNews(token) });
      return;
    }
    const symbols = req.query?.symbols || "SPY,QQQ,NVDA,AMD,TSLA";
    noStoreJson(res, 200, { status: "live", dataQuality: "live", isTradable: true, source: "Finnhub", data: await loadQuotes(symbols, token) });
  } catch (error) {
    noStoreJson(res, 200, unavailable(error.message));
  }
}
