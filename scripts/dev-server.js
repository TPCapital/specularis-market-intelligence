import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../api/snapshot.js";
import finnhubHandler from "../api/finnhub.js";
import twelveDataHandler from "../api/twelvedata.js";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function runVercelHandler(handler, req, res, url) {
  const headers = {};
  const vercelRes = {
    setHeader(key, value) {
      headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      res.writeHead(this.statusCode || 200, headers);
      res.end(body);
    }
  };
  await handler({ ...req, query: Object.fromEntries(url.searchParams.entries()) }, vercelRes);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)",
      Accept: "application/json,text/plain,*/*",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.json();
}

const stooqSymbol = (symbol) => {
  const clean = symbol.replaceAll("%5E", "^").replaceAll("%3D", "=").toUpperCase();
  if (clean.startsWith("^") || clean.includes("=") || clean.includes(".")) return null;
  return `${clean.toLowerCase()}.us`;
};

const snapshotSymbols = ["NVDA", "AMD", "AVGO", "MRVL", "MSFT", "AMZN", "META", "TSLA", "PLTR", "ORCL", "CRWD", "COIN"];

const snapshotSource = (label, data, status = "live", updatedAt = Date.now()) => ({
  data,
  status,
  label,
  updatedAt,
  timestamp: new Date(updatedAt).toISOString()
});

async function fetchStooqQuotes(symbols) {
  const requested = symbols.split(",").map((symbol) => decodeURIComponent(symbol).trim()).filter(Boolean);
  const mapped = requested
    .map((symbol) => [symbol, stooqSymbol(symbol)])
    .filter(([, stooq]) => stooq);

  const stooqToOriginal = new Map(mapped.map(([original, stooq]) => [stooq.toUpperCase(), original.toUpperCase()]));
  const response = await fetch(`https://stooq.com/q/l/?s=${mapped.map(([, stooq]) => stooq).join("+")}&f=sd2t2ohlcvp&h&e=csv`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)" }
  });
  if (!response.ok) throw new Error(`stooq upstream ${response.status}`);
  const text = await response.text();
  const result = text.trim().split(/\r?\n/).slice(1).flatMap((line) => {
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

  if (!result.length) throw new Error("stooq fallback empty");
  return { quoteResponse: { result, error: null } };
}

async function fetchSnapshot(symbols) {
  const generatedAt = Date.now();
  const yahooRaw = await fetchStooqQuotes(symbols);
  const rows = yahooRaw.quoteResponse.result || [];
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
  const yahoo = {
    indices: [
      { id: "SPY", name: "S&P 500 ETF", value: bySymbol.get("SPY")?.regularMarketPrice || 0, change: bySymbol.get("SPY")?.regularMarketChangePercent || 0, note: "服务端快照行情。" },
      { id: "QQQ", name: "Nasdaq ETF", value: bySymbol.get("QQQ")?.regularMarketPrice || 0, change: bySymbol.get("QQQ")?.regularMarketChangePercent || 0, note: "服务端快照行情。" },
      { id: "NDX", name: "Nasdaq 100", value: 25172.18, change: 0.48, note: "指数代理数据待接入。" },
      { id: "VIX", name: "Volatility", value: 13.62, change: -2.01, note: "指数代理数据待接入。" },
      { id: "TNX", name: "10Y Yield", value: 4.12, change: 0.87, note: "收益率代理数据待接入。" },
      { id: "DXY", name: "Dollar Index", value: 98.36, change: -0.11, note: "美元指数代理数据待接入。" },
      { id: "GOLD", name: "Gold", value: 3378.4, change: -0.24, note: "黄金代理数据待接入。" }
    ],
    quotes: snapshotSymbols.map((symbol) => ({
      symbol,
      name: symbol,
      sector: "强势股",
      price: bySymbol.get(symbol)?.regularMarketPrice || 0,
      preMarketChange: bySymbol.get(symbol)?.regularMarketChangePercent || 0,
      volumeRatio: 1
    }))
  };

  return {
    generatedAt,
    sources: {
      yahoo: snapshotSource("Yahoo Finance", yahoo, "live", generatedAt),
      reddit: snapshotSource("WallStreetBets Reddit", {
        score: 50,
        tone: "服务端快照",
        mentions: [],
        summary: "本地快照服务未接入 Reddit 聚合。"
      }, "fallback", generatedAt),
      tradingView: snapshotSource("TradingView Screener", [], "fallback", generatedAt),
      xMacro: snapshotSource("Walter Bloomberg X / Kobeissi X", null, "fallback", generatedAt),
      finviz: snapshotSource("Finviz Heatmap", null, "fallback", generatedAt),
      unusualWhales: snapshotSource("Unusual Whales", null, "fallback", generatedAt),
      benzinga: snapshotSource("Benzinga", null, "fallback", generatedAt)
    }
  };
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname === "/api/snapshot") {
      return sendJson(res, 200, await buildSnapshot({ query: Object.fromEntries(url.searchParams.entries()) }));
    }

    if (url.pathname === "/api/cron-refresh") {
      const snapshot = await buildSnapshot({ query: Object.fromEntries(url.searchParams.entries()) });
      return sendJson(res, 200, {
        ok: true,
        generatedAt: snapshot.generatedAt,
        sources: Object.fromEntries(Object.entries(snapshot.sources || {}).map(([key, value]) => [key, value.status]))
      });
    }

    if (url.pathname === "/api/finnhub") {
      return runVercelHandler(finnhubHandler, req, res, url);
    }

    if (url.pathname === "/api/twelvedata") {
      return runVercelHandler(twelveDataHandler, req, res, url);
    }

    if (url.pathname === "/api/yahoo") {
      const symbols = url.searchParams.get("symbols") || "SPY,QQQ,%5ENDX,%5EVIX,%5ETNX,GC%3DF,DX-Y.NYB";
      const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
      try {
        return sendJson(res, 200, await fetchJson(yahooUrl));
      } catch {
        return sendJson(res, 200, await fetchStooqQuotes(symbols));
      }
    }

    if (url.pathname === "/api/reddit") {
      return sendJson(res, 200, await fetchJson("https://www.reddit.com/r/wallstreetbets/hot.json?limit=50"));
    }

    if (url.pathname === "/api/tradingview-screener") {
      const payload = await fetchJson("https://scanner.tradingview.com/america/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: {
            tickers: ["NASDAQ:NVDA", "NASDAQ:AMD", "NASDAQ:AVGO", "NASDAQ:MSFT", "NASDAQ:META", "NASDAQ:TSLA", "NASDAQ:PLTR", "NYSE:ORCL"],
            query: { types: [] }
          },
          columns: ["name", "close", "change", "volume", "Recommend.All", "RSI"],
          range: [0, 30]
        })
      });
      const rows = (payload.data || []).map((row) => {
        const [symbol, _close, change, volume, recommendation, rsi] = row.d || [];
        return {
          symbol,
          score: Math.max(0, Math.min(100, Math.round(55 + (change || 0) * 4 + (recommendation || 0) * 18 + ((rsi || 50) - 50) * 0.35))),
          logic: `TradingView 动量 ${Number(change || 0).toFixed(2)}%，RSI ${Number(rsi || 0).toFixed(1)}，量能 ${Number(volume || 0).toLocaleString("en-US")}。`
        };
      });
      return sendJson(res, 200, rows);
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson(res, 501, { error: "Adapter not configured; frontend fallback will be used." });
    }
  } catch (error) {
    return sendJson(res, 502, { error: "Upstream unavailable", detail: error.message });
  }

  return false;
}

async function handleStatic(res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mime[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    const body = await readFile(join(root, "index.html"));
    res.writeHead(200, { "Content-Type": mime[".html"], "Cache-Control": "no-store" });
    res.end(body);
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }
  await handleStatic(res, url);
}).listen(port, "0.0.0.0", () => {
  console.log(`Dashboard dev server running at http://127.0.0.1:${port}`);
  console.log("For phone testing, use your Mac LAN IP, for example http://192.168.x.x:" + port);
});
