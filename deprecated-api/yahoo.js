import { cleanSymbols, fetchJson, json } from "./_utils.js";

const stooqSymbol = (symbol) => {
  const clean = symbol.replaceAll("%5E", "^").replaceAll("%3D", "=").toUpperCase();
  if (clean.startsWith("^") || clean.includes("=") || clean.includes(".")) return null;
  return `${clean.toLowerCase()}.us`;
};

async function fetchStooqQuotes(symbols) {
  const requested = symbols.split(",").map((symbol) => decodeURIComponent(symbol).trim()).filter(Boolean);
  const mapped = requested
    .map((symbol) => [symbol, stooqSymbol(symbol)])
    .filter(([, stooq]) => stooq);

  const stooqToOriginal = new Map(mapped.map(([original, stooq]) => [stooq.toUpperCase(), original.toUpperCase()]));
  const url = `https://stooq.com/q/l/?s=${mapped.map(([, stooq]) => stooq).join("+")}&f=sd2t2ohlcvp&h&e=csv`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)" }
  });
  if (!response.ok) throw new Error(`stooq upstream ${response.status}`);
  const text = await response.text();
  const lines = text.trim().split(/\r?\n/).slice(1);
  const results = lines.flatMap((line) => {
    if (!line) return [];
    const [symbol, date, time, open, high, low, close, volume, prev] = line.split(",");
    const price = Number(close);
    const previous = Number(prev);
    if (!Number.isFinite(price) || !Number.isFinite(previous) || price <= 0 || previous <= 0) return [];
    return [{
      symbol: stooqToOriginal.get(symbol.toUpperCase()) || symbol.replace(".US", ""),
      regularMarketPrice: price,
      regularMarketChangePercent: ((price - previous) / previous) * 100,
      regularMarketVolume: Number(volume) || undefined,
      averageDailyVolume3Month: Number(volume) || undefined,
      regularMarketTime: Date.parse(`${date}T${time}Z`) || Date.now(),
      shortName: symbol
    }];
  });

  if (!results.length) throw new Error("stooq fallback empty");
  return { quoteResponse: { result: results, error: null } };
}

export default async function handler(req, res) {
  const symbols = cleanSymbols(req.query.symbols || "SPY,QQQ,%5ENDX,%5EVIX,%5ETNX,GC%3DF,DX-Y.NYB");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols).replaceAll("%2C", ",")}`;

  try {
    const payload = await fetchJson(url);
    json(res, 200, payload, 20);
  } catch (error) {
    try {
      const fallbackPayload = await fetchStooqQuotes(symbols);
      json(res, 200, fallbackPayload, 30);
    } catch (fallbackError) {
      json(res, 502, { error: "Yahoo Finance upstream unavailable", detail: `${error.message}; ${fallbackError.message}` }, 5);
    }
  }
}
