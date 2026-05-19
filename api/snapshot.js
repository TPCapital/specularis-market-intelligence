import { cleanSymbols, fetchJson, noStoreJson } from "../lib/utils.js";
import { buildMarketBreadth } from "../lib/market-breadth.js";
import { runPremarketScanner } from "../lib/premarket-scanner.js";
import { buildSignalEngine } from "../lib/signal-engine.js";
import { buildEarningsLayer } from "../lib/earnings.js";
import { buildInsiderLayer } from "../lib/insider.js";
import { buildRelativeVolumeLayer } from "../lib/relative-volume.js";
import { buildConfidenceScore } from "../lib/confidence-score.js";
import { buildMarketRegime } from "../lib/market-regime.js";
import { buildStrategySummary } from "../lib/strategy-engine.js";
import { buildTradePlan } from "../lib/trade-plan.js";
import { buildWatchlist } from "../lib/watchlist-engine.js";

const MARKET_SYMBOLS = {
  SPY: "SPY",
  QQQ: "QQQ",
  VIX: "^VIX",
  TNX: "^TNX",
  DXY: "DX-Y.NYB",
  GOLD: "GC=F",
  NDX: "^NDX"
};

const sourceCatalog = {
  finnhub: "Finnhub",
  twelveData: "TwelveData",
  alphavantage: "AlphaVantage",
  fred: "FRED",
  earnings: "Earnings Layer",
  insider: "Insider Layer",
  relativeVolume: "Relative Volume Scanner",
  premarketMomentum: "Premarket Momentum Engine",
  marketBreadth: "Market Breadth Engine",
  decisionEngine: "Decision Engine",
  newsAggregator: "News Aggregator",
  marketData: "Multi-source Market Data",
  tradingView: "TradingView Screener",
  xMacro: "Macro Feed",
  reddit: "WallStreetBets Reddit",
  finviz: "Sector Heat Proxy",
  unusualWhales: "Options Signal System",
  benzinga: "Benzinga API",
  finnhubNews: "Finnhub News",
  marketWatchNews: "MarketWatch RSS",
  reutersNews: "Reuters RSS",
  secNews: "SEC Filing Feed"
};

const symbolMeta = {
  SPY: ["SPDR S&P 500 ETF", "Index ETF"],
  QQQ: ["Invesco QQQ", "Index ETF"],
  NVDA: ["Nvidia", "AI 半导体"],
  AMD: ["AMD", "AI 半导体"],
  AVGO: ["Broadcom", "AI 半导体"],
  MRVL: ["Marvell", "AI 半导体"],
  SMCI: ["Super Micro", "AI 服务器"],
  MSFT: ["Microsoft", "大型科技"],
  AAPL: ["Apple", "大型科技"],
  AMZN: ["Amazon", "大型科技"],
  GOOGL: ["Alphabet", "大型科技"],
  META: ["Meta", "大型科技"],
  TSLA: ["Tesla", "高 beta 动量"],
  PLTR: ["Palantir", "AI 软件"],
  ORCL: ["Oracle", "AI 软件"],
  CRWD: ["CrowdStrike", "云安全"],
  PANW: ["Palo Alto", "云安全"],
  COIN: ["Coinbase", "加密资产"],
  MSTR: ["MicroStrategy", "加密资产"],
  XOM: ["Exxon Mobil", "能源"],
  CVX: ["Chevron", "能源"],
  JPM: ["JPMorgan", "金融"],
  LLY: ["Eli Lilly", "医疗"],
  DASH: ["DoorDash", "消费科技"],
  CSCO: ["Cisco", "AI 网络"],
  SMR: ["NuScale Power", "核能"],
  OKLO: ["Oklo", "核能"],
  NNE: ["Nano Nuclear", "核能"],
  UEC: ["Uranium Energy", "铀矿"]
};

const MARKET_INDEX_META = {
  SPY: "S&P 500 ETF",
  QQQ: "NASDAQ ETF",
  NDX: "NASDAQ 100",
  VIX: "VOLATILITY",
  TNX: "10Y YIELD",
  DXY: "DOLLAR INDEX",
  GOLD: "GOLD"
};

const tvSymbols = [
  "NASDAQ:NVDA",
  "NASDAQ:AMD",
  "NASDAQ:AVGO",
  "NASDAQ:MRVL",
  "NASDAQ:MSFT",
  "NASDAQ:AMZN",
  "NASDAQ:META",
  "NASDAQ:TSLA",
  "NASDAQ:PLTR",
  "NYSE:ORCL",
  "NASDAQ:CRWD",
  "NASDAQ:COIN",
  "NASDAQ:MSTR",
  "NASDAQ:CSCO"
];

let lastGoodSources = {};
let lastGoodSnapshot = null;
const lastGoodFinnhubQuotes = new Map();
const lastGoodTwelveDataQuotes = new Map();
const SOURCE_DEBUG_PREFIX = "[snapshot:debug]";

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.length ? value : "";
}

function envDebug() {
  return {
    FINNHUB_API_KEY: !!process.env.FINNHUB_API_KEY,
    TWELVEDATA_API_KEY: !!process.env.TWELVEDATA_API_KEY,
    ALPHAVANTAGE_API_KEY: !!process.env.ALPHAVANTAGE_API_KEY,
    FRED_API_KEY: !!process.env.FRED_API_KEY,
    TEST_ENV_CHECK: envValue("TEST_ENV_CHECK") || null
  };
}

function lastGoodIndices() {
  return lastGoodSnapshot?.sources?.marketData?.data?.indices || [];
}

function lastGoodQuotes() {
  return lastGoodSnapshot?.sources?.marketData?.data?.quotes || [];
}

function normalizeDataQuality(status = "") {
  const value = String(status || "").toLowerCase();
  if (["live", "delayed", "snapshot", "stale", "unavailable"].includes(value)) return value;
  if (value === "proxy" || value === "cached") return "stale";
  if (value === "fallback") return "snapshot";
  if (String(status).toUpperCase() === "LIVE") return "live";
  if (String(status).toUpperCase() === "DELAYED") return "delayed";
  if (String(status).toUpperCase() === "SNAPSHOT") return "snapshot";
  if (String(status).toUpperCase() === "STALE") return "stale";
  return "snapshot";
}

function isTradableQuality(dataQuality) {
  return ["live", "delayed"].includes(dataQuality);
}

function metric(id, name, value, change, note, status = "SNAPSHOT") {
  const dataQuality = normalizeDataQuality(status);
  return { id, name, value, change, note, status, dataQuality, isTradable: isTradableQuality(dataQuality), source: "Market Data Adapter", timestamp: Date.now() };
}

function quote(symbol, price, preMarketChange, relativeVolume = 1, extra = {}) {
  const [name, sector] = symbolMeta[symbol] || [symbol, "其他"];
  return {
    symbol,
    name,
    sector,
    price,
    value: price,
    change: preMarketChange,
    preMarketChange,
    preMarketChangePercent: preMarketChange,
    regularMarketChangePercent: extra.regularMarketChangePercent ?? preMarketChange,
    volumeRatio: relativeVolume,
    relativeVolume,
    volume: extra.volume ?? 0,
    averageVolume: extra.averageVolume ?? 0,
    dataStatus: extra.dataStatus || "SNAPSHOT",
    status: normalizeDataQuality(extra.dataStatus || "SNAPSHOT"),
    dataQuality: normalizeDataQuality(extra.dataStatus || "SNAPSHOT"),
    isTradable: isTradableQuality(normalizeDataQuality(extra.dataStatus || "SNAPSHOT")),
    source: extra.source || "Market Data Adapter",
    timestamp: extra.timestamp || Date.now()
  };
}

function nowIso(value) {
  return new Date(value).toISOString();
}

function confidenceFromStatus(status) {
  const s = normalizeDataQuality(status);
  if (s === "live") return "HIGH";
  if (s === "delayed") return "MEDIUM";
  if (s === "stale") return "LOW";
  if (s === "snapshot") return "LOW";
  return "LOW";
}

function freshnessFromUpdatedAt(updatedAt, status) {
  if (!updatedAt) return status === "snapshot" ? "snapshot" : "stale";
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function source(key, data, status, generatedAt, label = sourceCatalog[key], extra = {}) {
  const dataQuality = normalizeDataQuality(status);
  const updatedAt = Number(extra.updatedAt || generatedAt);
  const confidence = extra.confidence || confidenceFromStatus(dataQuality);
  const fallback = Boolean(extra.fallback ?? (dataQuality === "snapshot" || dataQuality === "stale"));
  return {
    data,
    status: dataQuality,
    source: label,
    dataQuality,
    isTradable: isTradableQuality(dataQuality),
    label,
    updatedAt,
    timestamp: nowIso(updatedAt),
    latency: Number.isFinite(Number(extra.latency)) ? Number(extra.latency) : null,
    error: extra.error || null,
    provider: extra.provider || null,
    indices: Array.isArray(extra.indices) ? extra.indices : undefined,
    quotes: Array.isArray(extra.quotes) ? extra.quotes : undefined,
    participatesInScoring: typeof extra.participatesInScoring === "boolean" ? extra.participatesInScoring : undefined,
    confidence,
    freshness: extra.freshness || freshnessFromUpdatedAt(updatedAt, dataQuality),
    fallback
  };
}

function cachedSource(key, cached) {
  const updatedAt = cached.updatedAt || Date.now();
  return {
    ...cached,
    status: "stale",
    source: cached.source || sourceCatalog[key],
    dataQuality: "stale",
    isTradable: false,
    timestamp: cached.timestamp || nowIso(updatedAt),
    confidence: cached.confidence || "LOW",
    freshness: freshnessFromUpdatedAt(updatedAt, "stale"),
    fallback: true
  };
}

function fallbackSource(key, data = null) {
  return {
    data,
    status: "snapshot",
    source: sourceCatalog[key],
    dataQuality: "snapshot",
    isTradable: false,
    label: sourceCatalog[key],
    updatedAt: null,
    timestamp: "snapshot only",
    latency: null,
    confidence: "LOW",
    freshness: "snapshot",
    fallback: true
  };
}

function keepLastGood(key, item) {
  if (["live", "delayed"].includes(item.status) && item.data) lastGoodSources[key] = item;
  return item;
}

function lastOrFallback(key, fallbackData = null) {
  return lastGoodSources[key] ? cachedSource(key, lastGoodSources[key]) : fallbackSource(key, fallbackData);
}

async function settleSource(key, loader, generatedAt, fallbackData = null, label) {
  try {
    const loaded = await loader();
    return keepLastGood(
      key,
      source(
        key,
        loaded.data ?? loaded,
        loaded.status || "live",
        generatedAt,
        label || loaded.label || sourceCatalog[key],
        {
          latency: loaded.latency,
          error: loaded.error,
          provider: loaded.provider,
          indices: loaded.indices,
          quotes: loaded.quotes,
          participatesInScoring: loaded.participatesInScoring,
          confidence: loaded.confidence,
          freshness: loaded.freshness,
          fallback: loaded.fallback,
          updatedAt: loaded.updatedAt
        }
      )
    );
  } catch (error) {
    console.error(`${SOURCE_DEBUG_PREFIX} settleSource error`, {
      source: key,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    if (lastGoodSources[key]) return cachedSource(key, lastGoodSources[key]);
    const fallback = fallbackSource(key, fallbackData);
    fallback.error = error?.message || String(error);
    return fallback;
  }
}

async function fetchWithFallback(symbol) {
  try {
    const stooq = await fetchStooqQuote(symbol);
    if (stooq) return { ...stooq, dataStatus: "DELAYED" };
  } catch {}
  try {
    const alpha = await fetchAlphaVantageQuote(symbol);
    if (alpha) return { ...alpha, dataStatus: "DELAYED" };
  } catch {}
  return null;
}

async function fetchIndexFallback(id, symbol) {
  if (["NDX", "VIX", "TNX", "DXY", "GOLD"].includes(id)) {
    const alphaSymbol = id === "GOLD" ? "GOLD" : id;
    try {
      const alpha = await fetchAlphaVantageQuote(alphaSymbol);
      if (alpha) return { ...alpha, dataStatus: "DELAYED" };
    } catch (error) {
      console.error("[snapshot:index-fallback] AlphaVantage failed", { id, reason: error?.message || String(error) });
    }
    return null;
  }
  return fetchWithFallback(symbol);
}

function finnhubSymbol(symbol = "") {
  const map = {
    "^VIX": "VIX",
    "^NDX": "NDX",
    "^TNX": "TNX",
    "DX-Y.NYB": "DXY",
    "GC=F": "GC=F"
  };
  return map[symbol] || symbol;
}

function twelveDataSymbol(symbol = "") {
  const map = {
    "^VIX": "VIX",
    "^NDX": "NDX",
    "^TNX": "TNX",
    "DX-Y.NYB": "DXY",
    NDX: "NDX",
    VIX: "VIX",
    TNX: "TNX",
    DXY: "DXY",
    GOLD: "XAU/USD",
    "GC=F": "XAU/USD"
  };
  return map[symbol] || symbol;
}

function responseCodeFromError(error) {
  return String(error?.message || "").match(/upstream\s+(\d+)/)?.[1] || "fetch-error";
}

async function fetchJsonWithDebug(sourceName, url, options = {}) {
  const safeUrl = String(url)
    .replace(/([?&](?:token|apikey|api_key)=)[^&]+/gi, "$1***")
    .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, "$1***");
  console.log(`${SOURCE_DEBUG_PREFIX} FETCHING ${sourceName}:`, safeUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)",
        Accept: "application/json,text/plain,*/*",
        ...(options.headers || {})
      },
      body: options.body
    });
    console.log(`${SOURCE_DEBUG_PREFIX} ${sourceName} RESPONSE STATUS:`, response.status);
    const text = await response.text();
    console.log(`${SOURCE_DEBUG_PREFIX} ${sourceName} RESPONSE BODY(300):`, String(text || "").slice(0, 300));
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text?.slice(0, 500) || "" };
    }
    console.log(`${SOURCE_DEBUG_PREFIX} ${sourceName} JSON:`, data);
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    return data;
  } catch (error) {
    console.error(`${SOURCE_DEBUG_PREFIX} ${sourceName} ERROR:`, error?.message || String(error));
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function classifyUpstreamError(error, responseCode = "") {
  const code = String(responseCode || responseCodeFromError(error) || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("aborted") || message.includes("timeout")) return "timeout";
  if (code === "401") return "401";
  if (code === "403") return "403";
  if (code === "429") return "429";
  if (message.includes("finnhub_api_key is not configured")) return "missing_key";
  if (message.includes("missing_key")) return "missing_key";
  if (message.includes("invalid") || message.includes("no usable quotes") || message.includes("empty-price")) return "invalid_response";
  if (message.includes("upstream")) return code || "invalid_response";
  return "invalid_response";
}

function normalizeProviderQuote(symbol, payload, provider, dataStatus = "DELAYED") {
  const price = Number(payload?.price ?? payload?.c ?? payload?.close);
  const previous = Number(payload?.previous ?? payload?.pc ?? payload?.previous_close);
  if (!Number.isFinite(price) || price <= 0) return null;
  const change = Number(payload?.changePercent ?? payload?.dp ?? payload?.percent_change ?? (Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : 0));
  const normalized = {
    symbol,
    value: price,
    price,
    change,
    status: normalizeDataQuality(dataStatus),
    dataQuality: normalizeDataQuality(dataStatus),
    regularChange: change,
    volume: Number(payload?.volume || payload?.v || 0),
    averageVolume: 0,
    dataStatus,
    source: provider,
    provider,
    timestamp: payload?.t ? Number(payload.t) * 1000 : payload?.timestamp ? Number(payload.timestamp) * 1000 : Date.now()
  };
  if (provider === "Finnhub") lastGoodFinnhubQuotes.set(symbol, normalized);
  if (provider === "TwelveData") lastGoodTwelveDataQuotes.set(symbol, normalized);
  return normalized;
}

async function loadFinnhubMarketData(symbols) {
  const token = envValue("FINNHUB_API_KEY");
  console.log("FINNHUB KEY EXISTS:", !!token);
  if (!token) return { data: [], status: "unavailable", label: "Finnhub", error: "missing_key", confidence: "LOW", fallback: true };
  const requested = cleanSymbols(symbols).split(",").filter(Boolean);
  const priority = ["AAPL", "SPY", "QQQ", "NVDA"];
  const list = [...new Set([...priority, ...requested])];
  const latencies = [];
  let lastErrorCode = "";
  const rows = await Promise.all(list.map(async (symbol) => {
    const endpoint = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSymbol(symbol))}&token=***`;
    try {
      const startedAt = Date.now();
      const payload = await fetchJsonWithDebug("FINNHUB", `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSymbol(symbol))}&token=${encodeURIComponent(token)}`, { timeoutMs: 8000 });
      const latencyMs = Date.now() - startedAt;
      latencies.push(latencyMs);
      console.log("[snapshot:finnhub] fetch success", { symbol, endpoint, responseCode: 200, latencyMs });
      if (payload?.error) throw new Error(payload.error);
      const normalized = normalizeProviderQuote(symbol, payload, "Finnhub", "LIVE");
      if (!normalized) {
        console.log("[snapshot:finnhub] fetch fail", { symbol, endpoint, responseCode: 200, reason: "empty-price" });
        lastErrorCode = "invalid_response";
      }
      return normalized;
    } catch (error) {
      const responseCode = responseCodeFromError(error);
      const classified = classifyUpstreamError(error, responseCode);
      lastErrorCode = classified;
      console.error("FINNHUB ERROR:", { symbol, endpoint, responseCode, reason: error.message, classified });
      return null;
    }
  }));
  const data = rows.filter(Boolean);
  return data.length
    ? { data, status: "live", label: "Finnhub", latency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null, confidence: "HIGH", fallback: false }
    : { data: [], status: "unavailable", label: "Finnhub", error: lastErrorCode || "invalid_response", confidence: "LOW", fallback: true };
}

async function loadFinnhubStrictProbe() {
  const testSymbols = ["AAPL", "NVDA", "SPY", "QQQ"];
  const token = envValue("FINNHUB_API_KEY");
  console.log("FINNHUB_API_KEY_EXISTS:", !!token);
  if (!token) {
    return {
      status: "unavailable",
      source: "Finnhub",
      error: "missing_key",
      testSymbols,
      quotes: [],
      confidence: "LOW",
      fallback: true,
      participatesInScoring: false
    };
  }

  const quotes = [];
  let finalError = "";
  for (const symbol of testSymbols) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
    const safeUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=***`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      console.log("FINNHUB_TEST_SYMBOL:", symbol);
      console.log("FINNHUB_REQUEST_URL:", safeUrl);
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)",
          Accept: "application/json,text/plain,*/*"
        }
      });
      const bodyText = await response.text();
      console.log("FINNHUB_RESPONSE_STATUS:", response.status);
      console.log("FINNHUB_RESPONSE_BODY:", String(bodyText || "").slice(0, 300));
      if (!response.ok) {
        if (response.status === 401) finalError = "401_invalid_key";
        else if (response.status === 403) finalError = "403_forbidden";
        else if (response.status === 429) finalError = "429_rate_limit";
        else finalError = `http_${response.status}`;
        console.error("FINNHUB_ERROR:", finalError);
        continue;
      }
      let payload = null;
      try {
        payload = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        finalError = "invalid_response";
        console.error("FINNHUB_ERROR:", finalError);
        continue;
      }
      if (payload?.error) {
        const msg = String(payload.error || "").toLowerCase();
        if (msg.includes("invalid api key")) finalError = "401_invalid_key";
        else finalError = "invalid_response";
        console.error("FINNHUB_ERROR:", finalError);
        continue;
      }
      const normalized = normalizeProviderQuote(symbol, payload, "Finnhub", "LIVE");
      if (!normalized) {
        finalError = "invalid_response";
        console.error("FINNHUB_ERROR:", finalError);
        continue;
      }
      quotes.push(normalized);
    } catch (error) {
      const msg = String(error?.message || "");
      finalError = msg.toLowerCase().includes("aborted") ? "timeout" : "invalid_response";
      console.error("FINNHUB_ERROR:", msg);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (quotes.length) {
    return {
      status: "live",
      source: "Finnhub",
      error: null,
      testSymbols,
      quotes,
      confidence: "HIGH",
      fallback: false,
      participatesInScoring: true
    };
  }

  return {
    status: "unavailable",
    source: "Finnhub",
    error: finalError || "invalid_response",
    testSymbols,
    quotes: [],
    confidence: "LOW",
    fallback: true,
    participatesInScoring: false
  };
}

async function loadTwelveDataMarketData(symbols) {
  const token = envValue("TWELVEDATA_API_KEY");
  console.log("TWELVEDATA_API_KEY_EXISTS:", !!token);
  if (!token) return { data: [], status: "unavailable", label: "TwelveData", error: "TWELVEDATA_API_KEY is not configured" };
  const originalSymbols = ["NDX", "VIX", "DXY", "GOLD"];
  const providerSymbols = originalSymbols.map(twelveDataSymbol);
  const latencies = [];
  const rows = await Promise.all(originalSymbols.map(async (symbol, index) => {
    const provider = providerSymbols[index];
    const endpoint = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(provider)}&apikey=***`;
    try {
      const startedAt = Date.now();
      const pricePayload = await fetchJsonWithDebug("TWELVEDATA", `https://api.twelvedata.com/price?symbol=${encodeURIComponent(provider)}&apikey=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
      const latencyMs = Date.now() - startedAt;
      latencies.push(latencyMs);
      console.log("[snapshot:twelvedata] fetch success", { symbol, providerSymbol: provider, endpoint, responseCode: 200, latencyMs });
      const price = Number(pricePayload?.price);
      if (!Number.isFinite(price) || price <= 0) {
        console.log("[snapshot:twelvedata] fetch fail", { symbol, providerSymbol: provider, endpoint, responseCode: 200, reason: pricePayload?.message || "empty-price" });
        return lastGoodTwelveDataQuotes.get(symbol) || null;
      }
      let quotePayload = {};
      try {
        quotePayload = await fetchJsonWithDebug("TWELVEDATA_QUOTE", `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(provider)}&apikey=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
      } catch (error) {
        console.error("TWELVEDATA ERROR:", { symbol, providerSymbol: provider, responseCode: responseCodeFromError(error), reason: error.message });
      }
      return normalizeProviderQuote(symbol, { ...quotePayload, price, close: price }, "TwelveData", "DELAYED");
    } catch (error) {
      console.error("TWELVEDATA ERROR:", { symbol, providerSymbol: provider, endpoint, responseCode: responseCodeFromError(error), reason: error.message });
      return lastGoodTwelveDataQuotes.get(symbol) || null;
    }
  }));
  const data = rows.filter(Boolean);
  return data.length
    ? { data, status: "delayed", label: "TwelveData", latency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null, confidence: "MEDIUM", fallback: false }
    : { data: [], status: "delayed", label: "TwelveData", error: "TwelveData returned no usable quotes", confidence: "LOW", fallback: true };
}

async function loadFinnhubQuotes(symbols) {
  const result = await loadFinnhubMarketData(symbols);
  return result.data || [];
}

async function loadTwelveDataQuotes(symbols) {
  const result = await loadTwelveDataMarketData(symbols);
  return result.data || [];
}

async function fetchStooqQuote(symbol) {
  const stooq = stooqSymbol(symbol);
  if (!stooq) return null;
  const response = await fetch(`https://stooq.com/q/l/?s=${stooq}&f=sd2t2ohlcvp&h&e=csv`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Institutional-Terminal/1.0)" }
  });
  if (!response.ok) return null;
  const [, line] = (await response.text()).trim().split(/\r?\n/);
  if (!line) return null;
  const [, , , , , , close, volume, previous] = line.split(",");
  const price = Number(close);
  const prev = Number(previous);
  if (!Number.isFinite(price) || !Number.isFinite(prev) || price <= 0 || prev <= 0) return null;
  return { symbol, price, change: ((price - prev) / prev) * 100, regularChange: ((price - prev) / prev) * 100, volume: Number(volume) || 0, averageVolume: Number(volume) || 0 };
}

async function fetchAlphaVantageQuote(symbol) {
  const token = envValue("ALPHAVANTAGE_API_KEY");
  if (!token) return null;
  if (symbol === "GC=F" || symbol === "GOLD") {
    const payload = await fetchJson(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${encodeURIComponent(token)}`, { timeoutMs: 7000 });
    const row = payload["Realtime Currency Exchange Rate"];
    const price = Number(row?.["5. Exchange Rate"]);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { symbol, price, change: 0, regularChange: 0, volume: 0, averageVolume: 0, dataStatus: "DELAYED", provider: "AlphaVantage" };
  }
  if (symbol === "^TNX" || symbol === "TNX") {
    const payload = await fetchJson(`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 7000 });
    const latest = Array.isArray(payload.data) ? payload.data.find((item) => Number.isFinite(Number(item.value))) : null;
    const previous = Array.isArray(payload.data) ? payload.data.find((item) => item !== latest && Number.isFinite(Number(item.value))) : null;
    const price = Number(latest?.value);
    const prev = Number(previous?.value);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { symbol, price, change: Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0, regularChange: 0, volume: 0, averageVolume: 0, dataStatus: "DELAYED", provider: "AlphaVantage" };
  }
  const alphaSymbol = symbol === "DX-Y.NYB" ? "DXY" : symbol === "GOLD" ? "XAUUSD" : symbol.replace(/^\^/, "");
  if (!/^[A-Z.]+$/.test(alphaSymbol)) return null;
  const payload = await fetchJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(alphaSymbol)}&apikey=${encodeURIComponent(token)}`, { timeoutMs: 7000 });
  const row = payload["Global Quote"];
  const price = Number(row?.["05. price"]);
  const changeRaw = String(row?.["10. change percent"] || "").replace("%", "");
  if (!Number.isFinite(price) || price <= 0) return null;
  return { symbol, price, change: Number(changeRaw) || 0, regularChange: Number(changeRaw) || 0, volume: Number(row?.["06. volume"]) || 0, averageVolume: 0, dataStatus: "DELAYED", provider: "AlphaVantage" };
}

function stooqSymbol(symbol) {
  const clean = symbol.replaceAll("%5E", "^").replaceAll("%3D", "=").toUpperCase();
  const indexMap = { "^VIX": "^vix", "^NDX": "^ndx", "^TNX": null, "DX-Y.NYB": null, "GC=F": "gc.f" };
  if (clean in indexMap) return indexMap[clean];
  if (clean.startsWith("^") || clean.includes("=") || clean.includes(".")) return null;
  return `${clean.toLowerCase()}.us`;
}

function normalizeTradingViewQuote(item = {}) {
  const symbol = String(item.symbol || "").split(":").pop();
  const price = Number(item.close || item.price || 0);
  const change = Number(item.change || 0);
  if (!symbol || !Number.isFinite(price) || price <= 0) return null;
  return {
    symbol,
    price,
    change,
    regularChange: change,
    volume: Number(item.volume || 0),
    averageVolume: 0,
    dataStatus: "DELAYED",
    provider: "TradingView"
  };
}

function fredMarketRows(fredRows = []) {
  const dgs10 = (fredRows || []).find((item) => item.id === "DGS10");
  const price = Number(dgs10?.value);
  if (!Number.isFinite(price) || price <= 0) return [];
  return [{
    symbol: "^TNX",
    price,
    change: 0,
    regularChange: 0,
    volume: 0,
    averageVolume: 0,
    dataStatus: "DELAYED",
    provider: "FRED"
  }];
}

function alphaMacroMarketRows(alphaMacro = null) {
  const dgs10 = Array.isArray(alphaMacro?.dgs10?.data)
    ? alphaMacro.dgs10.data.find((item) => Number.isFinite(Number(item.value)))
    : null;
  const previous = Array.isArray(alphaMacro?.dgs10?.data)
    ? alphaMacro.dgs10.data.find((item) => item !== dgs10 && Number.isFinite(Number(item.value)))
    : null;
  const price = Number(dgs10?.value);
  const prev = Number(previous?.value);
  if (!Number.isFinite(price) || price <= 0) return [];
  return [{
    symbol: "^TNX",
    price,
    change: Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0,
    regularChange: 0,
    volume: 0,
    averageVolume: 0,
    dataStatus: "DELAYED",
    provider: "AlphaVantage"
  }];
}

function mergeMarketQuotes({ symbols, marketEntries, finnhubRows = [], twelveDataRows = [], tradingViewRows = [], fredRows = [], alphaMacro = null, fallbackMarketMap = new Map(), fallbackStockMap = new Map() }) {
  const staleIndices = lastGoodIndices();
  const staleQuotes = lastGoodQuotes();
  const snapshotById = new Map(staleIndices.map((item) => [item.id, item]));
  const snapshotBySymbol = new Map(staleQuotes.map((item) => [item.symbol, item]));
  const finnhubMap = new Map((finnhubRows || []).map((item) => [item.symbol, item]));
  const twelveMap = new Map((twelveDataRows || []).map((item) => [item.symbol, item]));
  const fredMap = new Map(fredMarketRows(fredRows).map((item) => [item.symbol, item]));
  const alphaMacroMap = new Map(alphaMacroMarketRows(alphaMacro).map((item) => [item.symbol, item]));
  const tradingViewMap = new Map((tradingViewRows || []).map((item) => [item.symbol, normalizeTradingViewQuote(item)]).filter(([, row]) => row));

  // Index priority:
  // SPY/QQQ: Finnhub remains untouched.
  // NDX/VIX/DXY/GOLD: TwelveData -> Alpha/Stooq -> cached snapshot.
  // TNX: FRED DGS10 -> AlphaVantage TREASURY_YIELD -> cached snapshot.
  const indices = marketEntries.map(([id, providerSymbol]) => {
    const fallback = snapshotById.get(id);
    const indexRows = {
      SPY: finnhubMap.get("SPY") || twelveMap.get("SPY") || fallbackMarketMap.get("SPY"),
      QQQ: finnhubMap.get("QQQ") || twelveMap.get("QQQ") || fallbackMarketMap.get("QQQ"),
      NDX: twelveMap.get("^NDX") || twelveMap.get("NDX") || fallbackMarketMap.get("NDX"),
      VIX: twelveMap.get("^VIX") || twelveMap.get("VIX") || fallbackMarketMap.get("VIX"),
      TNX: fredMap.get("^TNX") || alphaMacroMap.get("^TNX") || fallbackMarketMap.get("TNX"),
      DXY: twelveMap.get("DX-Y.NYB") || twelveMap.get("DXY") || fallbackMarketMap.get("DXY"),
      GOLD: twelveMap.get("GC=F") || twelveMap.get("GOLD") || fallbackMarketMap.get("GOLD")
    };
    const row = indexRows[id] || finnhubMap.get(providerSymbol) || finnhubMap.get(id) || twelveMap.get(providerSymbol) || twelveMap.get(id) || fallbackMarketMap.get(id);
    if (!row) {
      if (fallback) return { ...fallback, note: "STALE：实时行情源暂不可用，使用最近有效缓存。", status: "STALE", dataQuality: "stale", isTradable: false };
      return { ...metric(id, MARKET_INDEX_META[id] || id, null, null, "SNAPSHOT：source_failed，等待下一次指数源刷新。", "SNAPSHOT"), fallback: true, error: "source_failed" };
    }
    const baseName = fallback?.name || MARKET_INDEX_META[id] || id;
    return metric(id, baseName, row.price ?? fallback?.value ?? null, row.change ?? fallback?.change ?? null, `${row.dataStatus}：${row.provider || "行情适配器"}。`, row.dataStatus);
  });

  // Stock priority: Finnhub -> TwelveData -> TradingView -> Stooq/Alpha -> cached snapshot
  const stockSymbols = symbols.filter((item) => !Object.values(MARKET_SYMBOLS).includes(item) && !item.startsWith("^")).slice(0, 40);
  const quotes = stockSymbols.map((symbol) => {
    const fallback = snapshotBySymbol.get(symbol);
    const row = finnhubMap.get(symbol) || twelveMap.get(symbol) || tradingViewMap.get(symbol) || fallbackStockMap.get(symbol);
    if (!row && fallback) return { ...fallback, dataStatus: "STALE", status: "stale", dataQuality: "stale", isTradable: false, source: "Last Good Snapshot" };
    if (!row) return null;
    const relativeVolume = row.volume && row.averageVolume ? row.volume / row.averageVolume : fallback?.relativeVolume || 1;
    return quote(symbol, row.price, row.change, relativeVolume, {
      regularMarketChangePercent: row.regularChange,
      volume: row.volume,
      averageVolume: row.averageVolume,
      dataStatus: row.dataStatus
    });
  }).filter(Boolean);

  return { indices, quotes };
}

async function loadMarketData(rawSymbols, providerRows = {}) {
  const marketEntries = Object.entries(MARKET_SYMBOLS);
  const symbols = cleanSymbols(rawSymbols).split(",").filter(Boolean);
  const quoteSymbols = symbols.filter((item) => !Object.values(MARKET_SYMBOLS).includes(item) && !item.startsWith("^")).slice(0, 40);
  const [fallbackMarketRows, fallbackStockRows] = await Promise.all([
    Promise.all(marketEntries.map(async ([id, symbol]) => [id, await fetchIndexFallback(id, symbol)])),
    Promise.all(quoteSymbols.map((symbol) => fetchWithFallback(symbol).then((row) => [symbol, row]).catch(() => [symbol, null])))
  ]);
  const fallbackMarketMap = new Map(fallbackMarketRows.map(([id, row]) => [id, row]));
  const fallbackStockMap = new Map(fallbackStockRows.map(([symbol, row]) => [symbol, row]));
  const merged = mergeMarketQuotes({
    symbols,
    marketEntries,
    finnhubRows: providerRows.finnhub || [],
    twelveDataRows: providerRows.twelveData || [],
    tradingViewRows: providerRows.tradingView || [],
    fredRows: providerRows.fred || [],
    alphaMacro: providerRows.alphaMacro || null,
    fallbackMarketMap,
    fallbackStockMap
  });
  const hasFinnhub = Array.isArray(providerRows.finnhub) && providerRows.finnhub.length > 0;
  const hasTwelve = Array.isArray(providerRows.twelveData) && providerRows.twelveData.length > 0;
  const provider = hasFinnhub ? "Finnhub" : hasTwelve ? "TwelveData" : "Fallback Cache";
  const status = hasFinnhub ? "live" : hasTwelve ? "delayed" : "snapshot";
  const fallback = !hasFinnhub && !hasTwelve;
  const confidence = hasFinnhub ? "HIGH" : hasTwelve ? "MEDIUM" : "LOW";
  return {
    data: { ...merged, provider },
    provider,
    indices: merged.indices,
    quotes: merged.quotes,
    status,
    fallback,
    confidence,
    label: hasFinnhub ? "Multi-source Market Data / Finnhub primary" : hasTwelve ? "Multi-source Market Data / TwelveData secondary" : "Multi-source Market Data / Cached fallback"
  };
}

async function loadTradingView() {
  const payload = await fetchJson("https://scanner.tradingview.com/america/scan", {
    timeoutMs: 10000,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbols: { tickers: tvSymbols, query: { types: [] } },
      columns: ["name", "close", "change", "volume", "Recommend.All", "RSI"],
      range: [0, 50]
    })
  });
  const rows = (payload.data || []).map((row) => {
    const [symbol, close, change, volume, recommendation, rsi] = row.d || [];
    const [, sector] = symbolMeta[symbol] || [symbol, "强势股"];
    const score = clamp(Math.round(55 + (change || 0) * 4 + (recommendation || 0) * 18 + ((rsi || 50) - 50) * 0.35));
    return { symbol, close: Number(close || 0), score, sector, change: change || 0, volume: volume || 0, rsi: rsi || 50, recommendation: recommendation || 0, logic: `动量 ${Number(change || 0).toFixed(2)}%，RSI ${Number(rsi || 0).toFixed(1)}。` };
  }).filter((item) => item.symbol);
  if (!rows.length) throw new Error("TradingView empty scan");
  return rows.sort((a, b) => b.score - a.score).slice(0, 8);
}

async function loadReddit() {
  const payload = await fetchJson("https://www.reddit.com/r/wallstreetbets/hot.json?limit=50", {
    timeoutMs: 10000,
    headers: { "User-Agent": "InstitutionalDashboard/1.0" }
  });
  const posts = payload.data?.children?.map((item) => item.data) || [];
  if (!posts.length) throw new Error("Reddit empty feed");
  const tickers = {};
  let toneScore = 50;
  for (const post of posts) {
    const text = `${post.title || ""}`.toUpperCase();
    for (const symbol of Object.keys(symbolMeta)) {
      if (text.includes(symbol)) tickers[symbol] = (tickers[symbol] || 0) + 1;
    }
    const lower = text.toLowerCase();
    if (/(call|calls|moon|bull|buy|yolo|beat)/.test(lower)) toneScore += 1.6;
    if (/(put|puts|bear|sell|short|miss)/.test(lower)) toneScore -= 1.4;
  }
  const score = clamp(Math.round(toneScore));
  return {
    score,
    tone: score >= 62 ? "偏乐观" : score <= 42 ? "偏谨慎" : "中性",
    mentions: Object.entries(tickers).sort((a, b) => b[1] - a[1]).slice(0, 8),
    summary: score >= 62 ? "WSB 风险偏好回升，高 beta 与 AI 讨论活跃。" : "WSB 情绪未形成一致追涨，短线偏观察。"
  };
}

function classifyBenzingaError(error) {
  const code = responseCodeFromError(error);
  if (code === "401") return "benzinga_401";
  if (code === "429") return "benzinga_rate_limit";
  return code || "benzinga_error";
}

function parseRssItems(rss, provider = "RSS") {
  const itemMatches = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const entryMatches = [...rss.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
  const blocks = itemMatches.length ? itemMatches.map((m) => m[1]) : entryMatches.map((m) => m[1]);
  return blocks.map((block) => {
    const title =
      stripXml(block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] || "") ||
      stripXml(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const summary =
      stripXml(block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] || "") ||
      stripXml(block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "") ||
      stripXml(block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || "") ||
      title;
    const publishedRaw =
      stripXml(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "") ||
      stripXml(block.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] || "") ||
      stripXml(block.match(/<published>([\s\S]*?)<\/published>/i)?.[1] || "");
    const date = publishedRaw ? new Date(publishedRaw) : null;
    return {
      title,
      summary,
      provider,
      time: Number.isFinite(date?.getTime())
        ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
        : new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
    };
  }).filter((item) => item.title);
}

function normalizeNewsFeed(rawItems = [], provider = "NEWS") {
  return rawItems.slice(0, 40).flatMap((item, index) => {
    const analyzed = analyzeNews({
      title: item.title || item.headline || "",
      summary: item.summary || item.description || item.title || item.headline || "",
      relatedSymbol: item.relatedSymbol,
      time: item.time || (item.datetime ? new Date(item.datetime * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : new Date(Date.now() - index * 5 * 60 * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }))
    });
    return analyzed ? [{ ...analyzed, provider }] : [];
  }).slice(0, 12);
}

function buildEarningsNewsEvents(earningsRows = []) {
  const items = (earningsRows || []).slice(0, 20).map((row, index) => {
    const symbol = String(row.symbol || "").toUpperCase();
    if (!symbol) return null;
    const epsA = Number(row.epsActual);
    const epsE = Number(row.epsEstimate);
    const beat = Number.isFinite(epsA) && Number.isFinite(epsE) && epsA >= epsE;
    return {
      ticker: symbol,
      sector: symbolMeta[symbol]?.[1] || "美股",
      category: "财报",
      newsType: beat ? "earnings beat" : "earnings miss",
      bias: beat ? "BULLISH" : "BEARISH",
      title: `${symbol}｜${beat ? "财报预期偏强" : "财报预期承压"}`,
      summary: beat ? "利好｜财报预期改善，关注开盘确认。" : "利空｜财报预期偏弱，注意波动风险。",
      originalTitle: `${symbol} earnings calendar update`,
      originalSummary: `EPS actual ${Number.isFinite(epsA) ? epsA : "n/a"} vs estimate ${Number.isFinite(epsE) ? epsE : "n/a"}`,
      time: row.date || new Date(Date.now() - index * 60000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      provider: "Finnhub Earnings"
    };
  }).filter(Boolean);
  return items;
}

function buildInsiderNewsEvents(insiderRows = []) {
  const items = (insiderRows || []).slice(0, 20).map((row, index) => {
    const symbol = String(row.symbol || "").toUpperCase();
    if (!symbol) return null;
    const change = Number(row.change || 0);
    const bullish = change > 0;
    return {
      ticker: symbol,
      sector: symbolMeta[symbol]?.[1] || "美股",
      category: "内部人",
      newsType: bullish ? "insider buy" : "insider sell",
      bias: bullish ? "BULLISH" : "BEARISH",
      title: `${symbol}｜内部人交易信号更新`,
      summary: bullish ? "利好｜内部人净增持，关注资金延续。" : "利空｜内部人减持增加，注意高位回撤。",
      originalTitle: `${symbol} insider transactions update`,
      originalSummary: `Change ${change}`,
      time: row.transactionDate || new Date(Date.now() - index * 60000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      provider: "Finnhub Insider"
    };
  }).filter(Boolean);
  return items;
}

async function loadBenzingaNews() {
  const key = envValue("BENZINGA_API_KEY");
  if (!key) {
    return { data: [], status: "unavailable", label: "Benzinga", error: "benzinga_key_missing" };
  }
  const url = `https://api.benzinga.com/api/v2/news?token=${encodeURIComponent(key)}&channels=markets,stocks,wiim,analyst,earnings&displayOutput=full&pagesize=20`;
  try {
    const payload = await fetchJsonWithDebug("BENZINGA_NEWS", url, { timeoutMs: 10000 });
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    const normalized = normalizeNewsFeed(rows.map((row) => ({
      title: row.title,
      summary: row.teaser || row.body || row.title,
      relatedSymbol: Array.isArray(row.stocks) && row.stocks.length ? String(row.stocks[0]).toUpperCase() : "",
      time: row.updated ? new Date(row.updated).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : undefined
    })), "Benzinga");
    if (!normalized.length) return { data: [], status: "unavailable", label: "Benzinga", error: "no_realtime_news" };
    return { data: normalized, status: "live", label: "Benzinga", error: null, fallback: false, confidence: "HIGH" };
  } catch (error) {
    return { data: [], status: "unavailable", label: "Benzinga", error: classifyBenzingaError(error), fallback: true, confidence: "LOW" };
  }
}

async function loadMarketWatchNews() {
  try {
    const rss = await fetchText("https://feeds.content.dowjones.io/public/rss/mw_topstories");
    const items = normalizeNewsFeed(parseRssItems(rss, "MarketWatch"), "MarketWatch");
    if (!items.length) return { data: [], status: "unavailable", label: "MarketWatch", error: "no_realtime_news" };
    return { data: items, status: "delayed", label: "MarketWatch", error: null, fallback: false, confidence: "MEDIUM" };
  } catch (error) {
    return { data: [], status: "unavailable", label: "MarketWatch", error: error.message || "no_realtime_news", fallback: true, confidence: "LOW" };
  }
}

async function loadReutersNews() {
  try {
    const rss = await fetchText("https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best");
    const items = normalizeNewsFeed(parseRssItems(rss, "Reuters"), "Reuters");
    if (!items.length) return { data: [], status: "unavailable", label: "Reuters", error: "no_realtime_news" };
    return { data: items, status: "delayed", label: "Reuters", error: null, fallback: false, confidence: "MEDIUM" };
  } catch (error) {
    return { data: [], status: "unavailable", label: "Reuters", error: error.message || "no_realtime_news", fallback: true, confidence: "LOW" };
  }
}

async function loadSecFilingsNews() {
  try {
    const atom = await fetchText("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-k&owner=include&count=40&output=atom");
    const items = normalizeNewsFeed(parseRssItems(atom, "SEC Filing"), "SEC Filing");
    if (!items.length) return { data: [], status: "unavailable", label: "SEC Filing", error: "no_realtime_news" };
    return { data: items, status: "delayed", label: "SEC Filing", error: null, fallback: false, confidence: "MEDIUM" };
  } catch (error) {
    return { data: [], status: "unavailable", label: "SEC Filing", error: error.message || "no_realtime_news", fallback: true, confidence: "LOW" };
  }
}

async function loadFinnhubCompanyNews(symbols) {
  const token = envValue("FINNHUB_API_KEY");
  if (!token) return [];
  const tickers = cleanSymbols(symbols).split(",").filter((symbol) => symbolMeta[symbol]).slice(0, 20);
  const to = new Date();
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (date) => date.toISOString().slice(0, 10);
  const companyNews = await Promise.all(tickers.map(async (symbol) => {
    try {
      const payload = await fetchJson(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
      return (Array.isArray(payload) ? payload : []).slice(0, 3).map((item) => ({ ...item, relatedSymbol: symbol }));
    } catch {
      return [];
    }
  }));
  return companyNews.flat();
}

async function loadFinnhubMarketNews() {
  const token = envValue("FINNHUB_API_KEY");
  if (!token) return [];
  try {
    const payload = await fetchJson(`https://finnhub.io/api/v1/news?category=general&token=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
    return Array.isArray(payload) ? payload.slice(0, 30) : [];
  } catch {
    return [];
  }
}

async function loadFinnhubNews(symbols) {
  const token = envValue("FINNHUB_API_KEY");
  if (!token) return { data: [], status: "unavailable", label: "Finnhub News", error: "missing_key" };
  const [companyNews, marketNews] = await Promise.all([
    loadFinnhubCompanyNews(symbols),
    loadFinnhubMarketNews()
  ]);
  const rawItems = [...companyNews, ...marketNews]
    .sort((a, b) => Number(b.datetime || 0) - Number(a.datetime || 0))
    .slice(0, 40);
  const items = normalizeNewsFeed(rawItems.map((item) => ({
    title: item.headline || item.title || "",
    summary: item.summary || item.headline || item.title || "",
    relatedSymbol: item.relatedSymbol,
    datetime: item.datetime,
    time: item.datetime ? new Date(item.datetime * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : undefined
  })), "Finnhub");
  return items.length
    ? { data: items.slice(0, 12), status: "delayed", label: "Finnhub News", error: null, fallback: false, confidence: "MEDIUM" }
    : { data: [], status: "unavailable", label: "Finnhub News", error: "no_realtime_news", fallback: true, confidence: "LOW" };
}

async function loadFinnhubInsider(symbols) {
  return { data: [], status: "unavailable", label: "Finnhub Insider", error: "disabled_to_avoid_rate_limit", confidence: "LOW", fallback: true };
}

async function loadFinnhubEarnings(symbols) {
  const token = envValue("FINNHUB_API_KEY");
  if (!token) return { data: [], status: "unavailable", label: "Finnhub Earnings", error: "FINNHUB_API_KEY is not configured" };
  try {
    const payload = await fetchJson(`https://finnhub.io/api/v1/calendar/earnings?token=${encodeURIComponent(token)}`, { timeoutMs: 9000 });
    const list = (payload.earningsCalendar || [])
      .filter((item) => cleanSymbols(symbols).split(",").includes(item.symbol))
      .slice(0, 20)
      .map((item) => ({
        symbol: item.symbol,
        date: item.date,
        epsActual: item.epsActual,
        epsEstimate: item.epsEstimate,
        revenueActual: item.revenueActual,
        revenueEstimate: item.revenueEstimate
      }));
    return list.length
      ? { data: list, status: "delayed", label: "Finnhub Earnings" }
      : { data: [], status: "unavailable", label: "Finnhub Earnings", error: "Finnhub earnings unavailable" };
  } catch (error) {
    return { data: [], status: "unavailable", label: "Finnhub Earnings", error: error.message };
  }
}

async function loadAlphaVantageMacro() {
  const token = envValue("ALPHAVANTAGE_API_KEY");
  console.log("ALPHAVANTAGE_API_KEY_EXISTS:", !!token);
  if (!token) return { data: null, status: "unavailable", label: "AlphaVantage", error: "ALPHAVANTAGE_API_KEY is not configured" };
  try {
    const startedAt = Date.now();
    const [dgs10, dgs2, sector] = await Promise.all([
      fetchJsonWithDebug("ALPHAVANTAGE_TREASURY_10Y", `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 9000 }).catch((error) => {
        console.error("ALPHAVANTAGE ERROR:", { function: "TREASURY_YIELD_10Y", reason: error.message });
        return null;
      }),
      fetchJsonWithDebug("ALPHAVANTAGE_TREASURY_2Y", `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=2year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 9000 }).catch((error) => {
        console.error("ALPHAVANTAGE ERROR:", { function: "TREASURY_YIELD_2Y", reason: error.message });
        return null;
      }),
      fetchJsonWithDebug("ALPHAVANTAGE_SECTOR", `https://www.alphavantage.co/query?function=SECTOR&apikey=${encodeURIComponent(token)}`, { timeoutMs: 9000 }).catch((error) => {
        console.error("ALPHAVANTAGE ERROR:", { function: "SECTOR", reason: error.message });
        return null;
      })
    ]);
    if (!dgs10 && !dgs2 && !sector) return { data: null, status: "delayed", label: "AlphaVantage", error: "AlphaVantage macro unavailable", latency: Date.now() - startedAt, confidence: "LOW", fallback: true };
    return { data: { dgs10, dgs2, sector }, status: "delayed", label: "AlphaVantage", latency: Date.now() - startedAt, confidence: "MEDIUM", fallback: false };
  } catch (error) {
    console.error("ALPHAVANTAGE ERROR:", { reason: error.message, stack: error.stack || null });
    return { data: null, status: "delayed", label: "AlphaVantage", error: error.message, confidence: "LOW", fallback: true };
  }
}

async function loadFredMacro() {
  const token = envValue("FRED_API_KEY");
  console.log("FRED_API_KEY_EXISTS:", !!token);
  if (!token) return { data: [], status: "unavailable", label: "FRED", error: "FRED_API_KEY is not configured" };
  const ids = ["FEDFUNDS", "DGS10", "DGS2", "UNRATE", "CPIAUCSL"];
  const startedAt = Date.now();
  const latencies = [];
  const data = await Promise.all(ids.map(async (id) => {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(id)}&api_key=${encodeURIComponent(token)}&file_type=json&sort_order=desc&limit=1`;
      const rowStart = Date.now();
      const payload = await fetchJsonWithDebug("FRED", url, { timeoutMs: 9000 });
      latencies.push(Date.now() - rowStart);
      const latest = payload.observations?.[0];
      return { id, date: latest?.date, value: latest?.value };
    } catch (error) {
      console.error("FRED ERROR:", { series: id, reason: error.message, responseCode: responseCodeFromError(error) });
      return { id, value: null };
    }
  }));
  return data.some((item) => item.value !== null)
    ? { data, status: "delayed", label: "FRED", latency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : Date.now() - startedAt, confidence: "HIGH", fallback: false }
    : { data: [], status: "delayed", label: "FRED", error: "FRED unavailable", latency: Date.now() - startedAt, confidence: "LOW", fallback: true };
}

async function fetchText(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Institutional-Terminal/1.0)", Accept: "application/rss+xml,text/xml,text/plain,*/*" }
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.text();
}

function stripXml(value) {
  return String(value).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").trim();
}

function analyzeNews(news) {
  if (!news?.title || news.title.toLowerCase().includes("market update") || news.title.length < 15 || String(news.summary || "").length < 10) return null;
  const junkPattern = /(is .* a buy|top \d+ stocks|etf to buy|could be huge|millionaire maker|prediction|week ahead|opinion|motley fool|worth buying|best stocks to buy|ai stock opinion|investment advice|forecast 20\d{2}|should you buy)/i;
  if (junkPattern.test(`${news.title} ${news.summary || ""}`)) return null;
  const ticker = news.relatedSymbol || extractTicker(news);
  const type = detectNewsType(news);
  if (!ticker && !isMarketRelevantNews(news, type)) return null;
  const bias = classifyNewsBias(`${news.title} ${news.summary}`, type);
  const sector = ticker ? symbolMeta[ticker]?.[1] || "美股" : typeToSector(type);
  return {
    ticker: ticker || "MACRO",
    sector,
    category: typeLabel(type),
    newsType: type,
    bias,
    title: makeReadableChineseNewsTitle({ ticker, type, originalTitle: news.title, bias }),
    summary: rewriteNewsSummary(ticker, type, bias),
    originalTitle: news.title,
    originalSummary: news.summary,
    time: news.time
  };
}

function extractTicker(news) {
  const text = `${news.title || ""} ${news.summary || ""}`.toUpperCase();
  const aliases = [
    ["Advanced Micro Devices", "AMD"],
    ["NVIDIA", "NVDA"],
    ["Nvidia", "NVDA"],
    ["Palantir", "PLTR"],
    ["Tesla", "TSLA"],
    ["Eli Lilly", "LLY"],
    ["Meta", "META"],
    ["Apple", "AAPL"],
    ["Coinbase", "COIN"],
    ["MicroStrategy", "MSTR"],
    ["Broadcom", "AVGO"],
    ["NuScale Power", "SMR"],
    ["Oklo", "OKLO"],
    ["Uranium Energy", "UEC"],
    ["Nano Nuclear", "NNE"]
  ];
  for (const [name, symbol] of aliases) {
    if (text.includes(name.toUpperCase())) return symbol;
  }
  return Object.keys(symbolMeta).find((symbol) => new RegExp(`\\b${symbol}\\b`).test(text)) || "";
}

function detectNewsType(news) {
  const lower = `${news.title || ""} ${news.summary || ""}`.toLowerCase();
  if (/upgrade|price target|buy rating/.test(lower)) return "analyst upgrade";
  if (/downgrade|sell rating/.test(lower)) return "downgrade";
  if (/earnings beat|beats|beat estimates|revenue beat/.test(lower)) return "earnings beat";
  if (/earnings miss|misses|miss estimates|revenue miss/.test(lower)) return "earnings miss";
  if (/guidance raise|raises guidance|raised guidance/.test(lower)) return "guidance raise";
  if (/guidance cut|cuts guidance|lower guidance/.test(lower)) return "guidance cut";
  if (/\bai\b|artificial intelligence|gpu demand|ai demand/.test(lower)) return "AI demand";
  if (/semiconductor|chip|gpu|data center/.test(lower)) return "semiconductor";
  if (/cloud|software|saas/.test(lower)) return "cloud";
  if (/crypto|bitcoin|ether/.test(lower)) return "crypto";
  if (/fda|trial|drug|phase/.test(lower)) return "FDA";
  if (/lawsuit|probe|investigation/.test(lower)) return "lawsuit";
  if (/war|missile|iran|qatar|tariff/.test(lower)) return "war";
  if (/government|contract|defense/.test(lower)) return "government";
  if (/fed|federal reserve|yield|rates/.test(lower)) return "macro";
  if (/inflation|cpi|pce/.test(lower)) return "inflation";
  if (/ipo|openai|spacex|anthropic/.test(lower)) return "IPO";
  if (/uranium|power|nuclear|nuscale|oklo|nano nuclear/.test(lower)) return "nuclear";
  return "macro";
}

function isMarketRelevantNews(news, type) {
  const lower = `${news.title || ""} ${news.summary || ""}`.toLowerCase();
  if (/retirement|social security|dividend income|roth ira|personal finance|advice|saving this for years/.test(lower)) return false;
  return /(fed|cpi|treasury|nasdaq|s&p|dow|ai|ipo|crypto|bitcoin|oil|gold|nuclear|uranium|rates|inflation)/.test(lower)
    || ["macro", "inflation", "crypto", "war", "IPO", "nuclear"].includes(type);
}

function classifyNewsBias(text, type) {
  const lower = String(text || "").toLowerCase();
  if (/downgrade|lawsuit|investigation|war|tariff|delay|weak demand|warning|loss|miss|cut/.test(lower) || ["downgrade", "earnings miss", "guidance cut", "lawsuit", "war"].includes(type)) return "BEARISH";
  if (/beat|raise|raises|upgrade|price target|partnership|contract|\bai\b|launch|demand|growth/.test(lower) || ["analyst upgrade", "earnings beat", "guidance raise", "AI demand", "government"].includes(type)) return "BULLISH";
  return "NEUTRAL";
}

function translateEnglishTitleToChineseEvent(originalTitle, ticker, type) {
  const lower = String(originalTitle || "").toLowerCase();

  if (/nvidia|nvda/.test(lower)) return "AI 芯片龙头买盘关注升温";
  if (/amd|advanced micro devices/.test(lower)) return "AI 芯片追赶逻辑继续发酵";
  if (/nuscale|smr|nuclear|oklo|uranium/.test(lower)) return "核能主题长期预期升温";
  if (/vanguard|etf|buffett/.test(lower)) return "资金配置偏好转向低成本 ETF";
  if (/trump|trades|insiders/.test(lower)) return "政治交易线索引发市场关注";
  if (/futures|dow jones|nasdaq|s&p 500/.test(lower)) return "股指期货高位震荡等待确认";
  if (/treasury|yield|rates|fed|inflation/.test(lower)) return "利率与通胀预期影响资金风格";
  if (/ipo|openai|spacex|anthropic/.test(lower)) return "AI IPO 预期继续升温";
  if (/earnings|reports|results|revenue/.test(lower)) return "业绩结果进入市场定价";
  if (/price target|upgrade|raises/.test(lower)) return "目标价上调强化买盘预期";
  if (/downgrade|cut/.test(lower)) return "评级下修压制风险偏好";

  return "事件催化进入盘前定价";
}

function makeReadableChineseNewsTitle({ ticker, type, originalTitle }) {
  const symbol = ticker && ticker !== "MACRO" ? ticker : "MACRO";
  return `${symbol}｜${translateEnglishTitleToChineseEvent(originalTitle, symbol, type)}`;
}

function rewriteNewsSummary(ticker, type, bias) {
  const subject = ticker ? symbolMeta[ticker]?.[1] || ticker : "市场";
  if (bias === "BULLISH") return `机构资金关注${subject}的催化延续，需观察开盘量能确认。`;
  if (bias === "BEARISH") return `${subject}出现负面催化，短线风险偏好可能降温。`;
  return `${subject}相关信息进入盘前定价，方向仍需价格确认。`;
}

function typeLabel(type) {
  if (/upgrade|downgrade/.test(type)) return "评级";
  if (/earnings|guidance/.test(type)) return "财报";
  if (/AI|semiconductor|cloud|crypto/.test(type)) return "主线";
  if (/macro|inflation|war/.test(type)) return "宏观";
  if (/FDA|lawsuit|government/.test(type)) return "事件";
  return "新闻";
}

function typeToSector(type) {
  if (/AI|semiconductor/.test(type)) return "AI 半导体";
  if (/cloud/.test(type)) return "AI 软件";
  if (/crypto/.test(type)) return "加密资产";
  if (/FDA/.test(type)) return "医疗";
  return "宏观";
}

function deriveSectors(quotes) {
  const grouped = new Map();
  for (const item of quotes || []) {
    if (!grouped.has(item.sector)) grouped.set(item.sector, []);
    grouped.get(item.sector).push(item);
  }
  return [...grouped.entries()].map(([sector, items]) => {
    const change = avg(items.map((item) => item.preMarketChange || 0));
    const rv = avg(items.map((item) => item.relativeVolume || item.volumeRatio || 1));
    const leaders = [...items].sort((a, b) => b.preMarketChange - a.preMarketChange).slice(0, 3).map((item) => item.symbol).join(" / ");
    return {
      sector,
      score: clamp(Math.round(50 + change * 9 + Math.min(rv, 3) * 8 + sectorThemeBonus(sector))),
      change,
      summary: `${leaders} 领涨，动量与相对成交量共同驱动板块热度。`
    };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
}

function deriveMovers(quotes, news = []) {
  const sourceQuotes = (quotes && quotes.length ? quotes : [])
    .filter((item) => Number.isFinite(Number(item.preMarketChange ?? item.regularMarketChangePercent)));
  const tickerNews = new Set(news.map((item) => item.ticker).filter(Boolean));
  return [...sourceQuotes].sort((a, b) => {
    const aChange = Number(a.preMarketChange ?? a.regularMarketChangePercent ?? 0);
    const bChange = Number(b.preMarketChange ?? b.regularMarketChangePercent ?? 0);
    return Math.abs(bChange) - Math.abs(aChange);
  }).slice(0, 10).map((item) => {
    const change = Number(item.preMarketChange ?? item.regularMarketChangePercent ?? 0);
    return {
    symbol: item.symbol,
    name: item.name,
    sector: item.sector,
    change,
    reason: tickerNews.has(item.symbol)
      ? "盘前价格异动与新闻催化同步出现。"
      : "价格异动进入盘前扫描，等待开盘量能确认。",
    bias: change >= 0 ? "利好" : "利空"
  };
  });
}

function deriveOptionsSignalSystem(quotes, context = {}) {
  if (!["live", "delayed"].includes(String(context.marketStatus || "").toLowerCase())) {
    return {
      status: "unavailable",
      source: "Options Signal System",
      error: "market_data_not_live_or_delayed",
      callCandidates: [],
      putCandidates: [],
      watchOnly: [],
      avoidChasing: [],
      cards: []
    };
  }
  const signals = [...(quotes || [])]
    .filter((stock) => stock?.symbol && Number.isFinite(Number(stock.price)) && Number(stock.price) > 0)
    .map((stock) => calculateOptionsSignalScore(stock, context))
    .sort((a, b) => b.score - a.score);
  const callCandidates = signals.filter((item) => item.bucket === "CALL").slice(0, 4);
  const putCandidates = signals.filter((item) => item.bucket === "PUT").slice(0, 3);
  const watchOnly = signals.filter((item) => item.bucket === "WATCH").slice(0, 4);
  const avoidChasing = signals.filter((item) => item.bucket === "AVOID").slice(0, 4);
  return {
    status: signals.length ? "delayed" : "unavailable",
    source: "Options Signal System",
    callCandidates,
    putCandidates,
    watchOnly,
    avoidChasing,
    cards: [...callCandidates, ...putCandidates, ...watchOnly, ...avoidChasing].slice(0, 8)
  };
}

function buildPremarketMomentumEngine({ quotes = [], tradingView = [], relativeVolume = [], news = [], marketStatus = "unavailable" } = {}) {
  if (!["live", "delayed"].includes(String(marketStatus).toLowerCase())) {
    return {
      status: "unavailable",
      source: "Premarket Momentum Engine",
      confidence: "LOW",
      fallback: false,
      error: "market_data_not_live_or_delayed",
      leaders: []
    };
  }
  const liveQuotes = (quotes || []).filter((item) => item?.symbol && Number.isFinite(Number(item.price)) && Number(item.price) > 0);
  if (!liveQuotes.length) {
    return {
      status: "unavailable",
      source: "Premarket Momentum Engine",
      confidence: "LOW",
      fallback: false,
      error: "no_realtime_quotes",
      leaders: []
    };
  }

  const tvMap = new Map((tradingView || []).map((item) => [item.symbol, item]));
  const rvolMap = new Map((relativeVolume || []).map((item) => [item.symbol, item]));
  const newsMap = new Map((news || []).filter((item) => item?.ticker).map((item) => [item.ticker, item]));
  const leaders = liveQuotes
    .map((stock) => {
      const symbol = stock.symbol;
      const tv = tvMap.get(symbol) || {};
      const rv = rvolMap.get(symbol) || {};
      const catalystNews = newsMap.get(symbol);
      const premarketPercent = Number(stock.preMarketChangePercent ?? stock.preMarketChange ?? stock.regularMarketChangePercent ?? stock.change ?? 0);
      const relativeVolumeValue = Number(rv.relativeVolume || stock.realRelativeVolume || stock.relativeVolume || stock.volumeRatio || 1);
      const gapScore = clamp(Math.max(0, premarketPercent) * 9, 0, 35);
      const volumeScore = clamp((relativeVolumeValue - 1) * 18 + (relativeVolumeValue >= 1.5 ? 8 : 0), 0, 25);
      const tvScore = clamp(Number(tv.score || 50) * 0.22 + Math.max(0, Number(tv.change || 0)) * 2, 0, 20);
      const catalystScore = catalystNews ? (catalystNews.bias === "BEARISH" ? 4 : catalystNews.bias === "BULLISH" ? 15 : 9) : 0;
      const theme = classifyPremarketTheme(stock, catalystNews);
      const themeScore = ["AI", "Semis", "Cybersecurity", "EV", "Meme", "Biotech", "Crypto"].includes(theme) ? 5 : 0;
      const momentumScore = clamp(Math.round(gapScore + volumeScore + tvScore + catalystScore + themeScore));

      return {
        ticker: symbol,
        symbol,
        name: stock.name,
        sector: stock.sector || symbolMeta[symbol]?.[1] || "其他",
        theme,
        premarketPercent,
        relativeVolume: relativeVolumeValue,
        catalyst: catalystNews
          ? `${typeLabel(catalystNews.type || catalystNews.category || "news")}｜${catalystNews.summary || catalystNews.title}`
          : relativeVolumeValue >= 1.5
            ? "相对成交量扩张，等待开盘延续确认。"
            : "价格进入盘前动能扫描，等待新闻或量能确认。",
        momentumScore,
        dataQuality: marketStatus,
        source: "Finnhub / TradingView / Relative Volume / News Catalyst"
      };
    })
    .filter((item) => item.momentumScore > 0)
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 10);

  return {
    status: leaders.length ? (marketStatus === "live" ? "live" : "delayed") : "unavailable",
    source: "Premarket Momentum Engine",
    confidence: marketStatus === "live" ? "HIGH" : "MEDIUM",
    fallback: false,
    leaders
  };
}

function classifyPremarketTheme(stock, catalystNews) {
  const symbol = stock.symbol || "";
  const sector = `${stock.sector || ""} ${catalystNews?.title || ""} ${catalystNews?.summary || ""}`;
  if (/NVDA|AMD|AVGO|MRVL|SMCI|半导体|芯片|semiconductor|chip/i.test(`${symbol} ${sector}`)) return "Semis";
  if (/PLTR|ORCL|MSFT|AI 软件|AI|data center|artificial intelligence/i.test(`${symbol} ${sector}`)) return "AI";
  if (/CRWD|PANW|网络安全|云安全|cyber/i.test(`${symbol} ${sector}`)) return "Cybersecurity";
  if (/TSLA|RIVN|LCID|EV|电动车|robotaxi/i.test(`${symbol} ${sector}`)) return "EV";
  if (/GME|AMC|KOSS|BB|meme/i.test(`${symbol} ${sector}`)) return "Meme";
  if (/LLY|MRNA|BIIB|REGN|PFE|FDA|drug|trial|医疗|biotech/i.test(`${symbol} ${sector}`)) return "Biotech";
  if (/COIN|MSTR|crypto|bitcoin|加密/i.test(`${symbol} ${sector}`)) return "Crypto";
  return "Momentum";
}

function calculateOptionsSignalScore(stock, context = {}) {
  const sectorMap = new Map((context.sectors || []).map((item) => [item.sector, item]));
  const rvolMap = new Map((context.relativeVolume || []).map((item) => [item.symbol, item]));
  const momentumMap = new Map((context.momentum || []).map((item) => [item.symbol || item.ticker, item]));
  const tvMap = new Map((context.tradingView || []).map((item) => [item.symbol, item]));
  const indexMap = Object.fromEntries((context.indices || []).map((item) => [item.id, item]));
  const news = context.news || [];
  const sector = stock.sector || "其他";
  const sectorHeat = sectorMap.get(sector)?.score ?? (55 + sectorThemeBonus(sector));
  const preChange = Number(stock.preMarketChangePercent ?? stock.preMarketChange ?? 0);
  const relativeVolume = Number(rvolMap.get(stock.symbol)?.relativeVolume || stock.relativeVolume || stock.volumeRatio || 1);
  const momentumScore = Number(momentumMap.get(stock.symbol)?.momentumScore || 0);
  const tvScore = Number(tvMap.get(stock.symbol)?.score || 50);
  const newsBias = news.find((item) => item.ticker === stock.symbol)?.bias || "NEUTRAL";
  const qqq = Number(indexMap.QQQ?.change || indexMap.NDX?.change || 0);
  const spy = Number(indexMap.SPY?.change || 0);
  const vix = Number(indexMap.VIX?.change || 0);
  const riskAssetStrength = qqq * 5 + spy * 2 - Math.max(0, vix) * 2;
  const volRiskPenalty = vix > 1 ? 8 : vix > 0 ? 4 : 0;
  const directionBias = preChange >= 0 ? 1 : -1;
  const baseScore = Math.min(Math.abs(preChange), 6) * 8 + Math.min(relativeVolume, 3) * 11 + sectorHeat * 0.18 + momentumScore * 0.16 + tvScore * 0.1;
  const catalystScore = newsBias === "BULLISH" ? 12 : newsBias === "BEARISH" ? -8 : 4;
  const callScore = clamp(Math.round(baseScore + catalystScore + riskAssetStrength - volRiskPenalty));
  const putScore = clamp(Math.round(baseScore + (newsBias === "BEARISH" ? 14 : 0) - riskAssetStrength + (preChange < 0 ? 12 : 0) + Math.max(0, vix) * 2));
  const bucket = classifyOptionsBucket({ callScore, putScore, preChange, relativeVolume, newsBias, qqq, vix });
  const score = bucket === "PUT" ? putScore : callScore;
  const direction = bucket === "CALL" ? "CALL CANDIDATE" : bucket === "PUT" ? "PUT CANDIDATE" : bucket === "AVOID" ? "AVOID CHASING" : "WATCH ONLY";
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector,
    score,
    bucket,
    conviction: direction,
    direction,
    type: direction,
    relativeVolume,
    summary: optionsSignalSummary(stock, bucket, { preChange, relativeVolume, qqq, spy, vix, newsBias }),
    risk: optionsSignalRisk(bucket, { preChange, relativeVolume, vix })
  };
}

function classifyOptionsBucket({ callScore, putScore, preChange, relativeVolume, newsBias, qqq, vix }) {
  if (preChange > 3.8 && relativeVolume < 1.2) return "AVOID";
  if (callScore >= 70 && preChange > 0 && qqq >= -0.3 && newsBias !== "BEARISH") return "CALL";
  if (putScore >= 68 && (preChange < 0 || newsBias === "BEARISH" || vix > 1.2)) return "PUT";
  if (callScore < 48 && putScore < 48) return "AVOID";
  return "WATCH";
}

function optionsSignalSummary(stock, bucket, data) {
  if (bucket === "CALL") return `${stock.sector}正股动量、相对成交量与指数方向共振，偏 CALL 观察。`;
  if (bucket === "PUT") return `${stock.sector}价格或新闻偏弱，叠加波动风险，偏 PUT / 对冲观察。`;
  if (bucket === "AVOID") return `涨幅、量能或波动结构不匹配，避免追高。`;
  return `${stock.sector}进入期权观察池，但方向仍需开盘量价确认。`;
}

function optionsSignalRisk(bucket, data) {
  if (bucket === "CALL" && data.preChange > 3) return "风险：跳空较大，优先等 VWAP 回踩。";
  if (bucket === "PUT") return "风险：若 QQQ 快速转强，PUT 方向失效。";
  if (bucket === "AVOID") return "风险：追高回撤或流动性不足。";
  return "风险：仅为免费数据代理信号，不是真实期权大单。";
}

function calculateRiskRegime(indices) {
  if (!Array.isArray(indices) || !indices.length) {
    return { mode: "DATA_UNAVAILABLE", score: null, status: "UNAVAILABLE", reason: "insufficient_realtime_indices" };
  }
  const byId = Object.fromEntries((indices || []).map((item) => [item.id, item]));
  const qqq = byId.QQQ?.change || byId.NDX?.change || 0;
  const vix = byId.VIX?.change || 0;
  const dxy = byId.DXY?.change || 0;
  const tnx = byId.TNX?.change || 0;
  if (qqq > 0 && vix < 0 && dxy <= 0.15 && Math.abs(tnx) < 1.2) return { mode: "Risk-On", score: 72 };
  if (vix > 0 && dxy > 0 && tnx > 0 && qqq < 0) return { mode: "Risk-Off", score: 34 };
  const score = clamp(Math.round(50 + qqq * 10 - vix * 4 - Math.max(0, dxy) * 4 - Math.max(0, tnx) * 2));
  return { mode: score >= 56 ? "Risk-On" : score <= 44 ? "Risk-Off" : "Neutral", score };
}

export async function buildSnapshot(req) {
  const generatedAt = Date.now();
  console.log(`${SOURCE_DEBUG_PREFIX} ENV CHECK`, {
    FINNHUB_API_KEY: !!envValue("FINNHUB_API_KEY"),
    TWELVEDATA_API_KEY: !!envValue("TWELVEDATA_API_KEY"),
    ALPHAVANTAGE_API_KEY: !!envValue("ALPHAVANTAGE_API_KEY"),
    FRED_API_KEY: !!envValue("FRED_API_KEY")
  });
  const defaultSymbols = "SPY,QQQ,NVDA,AMD,AVGO,MRVL,MSFT,AMZN,META,TSLA,PLTR,ORCL,CRWD,COIN,MSTR,DASH,CSCO,LLY,AAPL";
  const symbols = cleanSymbols(req?.query?.symbols || defaultSymbols);
  const marketSymbols = `${Object.values(MARKET_SYMBOLS).join(",")},${symbols}`;
  const finnhubProbe = await loadFinnhubStrictProbe();
  const [twelveData, tradingView, insider, earnings, alphaMacro, fredMacro] = await Promise.all([
    settleSource("twelveData", async () => {
      return loadTwelveDataMarketData(marketSymbols);
    }, generatedAt, []),
    settleSource("tradingView", loadTradingView, generatedAt, []),
    settleSource("finnhubInsider", () => loadFinnhubInsider(symbols), generatedAt, [], "Finnhub Insider"),
    settleSource("finnhubEarnings", () => loadFinnhubEarnings(symbols), generatedAt, [], "Finnhub Earnings"),
    settleSource("alphavantage", loadAlphaVantageMacro, generatedAt, null, "AlphaVantage"),
    settleSource("fred", loadFredMacro, generatedAt, [], "FRED")
  ]);
  const earningsLayer = await settleSource("earnings", () => buildEarningsLayer({
    symbols,
    finnhubKey: envValue("FINNHUB_API_KEY"),
    alphaVantageKey: envValue("ALPHAVANTAGE_API_KEY")
  }), generatedAt, { events: [] }, "Earnings Layer");
  const insiderLayer = await settleSource("insider", () => buildInsiderLayer({
    symbols,
    finnhubKey: ""
  }), generatedAt, { signals: [] }, "Insider Layer");
  const marketData = await settleSource("marketData", () => loadMarketData(symbols, {
    finnhub: finnhubProbe.quotes || [],
    twelveData: twelveData.data || [],
    tradingView: tradingView.data || [],
    fred: fredMacro.data || [],
    alphaMacro: alphaMacro.data || null
  }), generatedAt, { indices: lastGoodIndices(), quotes: lastGoodQuotes() });
  const [reddit, benzingaNews, finnhubNews, marketWatchNews, reutersNews, secNews] = await Promise.all([
    settleSource("reddit", loadReddit, generatedAt, { score: null, tone: "UNAVAILABLE", mentions: [], summary: "数据源不可用。" }),
    settleSource("benzinga", loadBenzingaNews, generatedAt, [], "Benzinga API"),
    settleSource("finnhubNews", () => loadFinnhubNews(symbols), generatedAt, [], "Finnhub News"),
    settleSource("marketWatchNews", loadMarketWatchNews, generatedAt, [], "MarketWatch RSS"),
    settleSource("reutersNews", loadReutersNews, generatedAt, [], "Reuters RSS"),
    settleSource("secNews", loadSecFilingsNews, generatedAt, [], "SEC Filing Feed")
  ]);

  const quotes = marketData.data?.quotes?.length ? marketData.data.quotes : [];
  const finnhubEarningsNews = source("finnhubEarnings", buildEarningsNewsEvents(earnings.data || []), (earnings.data || []).length ? "delayed" : "unavailable", generatedAt, "Finnhub Earnings");
  const finnhubInsiderNews = source("finnhubInsider", buildInsiderNewsEvents(insider.data || []), (insider.data || []).length ? "delayed" : "unavailable", generatedAt, "Finnhub Insider");
  const newsCandidates = [
    { name: "benzinga", source: benzingaNews },
    { name: "finnhub", source: finnhubNews },
    { name: "finnhub_earnings", source: finnhubEarningsNews },
    { name: "finnhub_insider", source: finnhubInsiderNews },
    { name: "marketwatch", source: marketWatchNews },
    { name: "reuters", source: reutersNews },
    { name: "sec", source: secNews }
  ];
  const selectedNewsSource = newsCandidates.find((item) => Array.isArray(item.source?.data) && item.source.data.length) || null;
  const news = selectedNewsSource ? selectedNewsSource.source.data : [];
  console.log("NEWS SOURCE USED:", selectedNewsSource ? selectedNewsSource.name : "none");
  const sectorData = deriveSectors(quotes);
  const moverData = deriveMovers(quotes, news);
  const relativeVolumeLayer = await settleSource("relativeVolume", () => buildRelativeVolumeLayer({
    quotes,
    tradingView: tradingView.data || []
  }), generatedAt, { leaders: [] }, "Relative Volume Scanner");
  const premarketMomentumData = buildPremarketMomentumEngine({
    quotes,
    tradingView: tradingView.data || [],
    relativeVolume: relativeVolumeLayer.data?.leaders || [],
    news,
    marketStatus: marketData.status || "unavailable"
  });
  const premarketMomentumLayer = source("premarketMomentum", premarketMomentumData, premarketMomentumData.status, generatedAt, "Premarket Momentum Engine", {
    confidence: premarketMomentumData.confidence,
    fallback: false,
    error: premarketMomentumData.error || null
  });
  const optionsSignalData = quotes.length ? deriveOptionsSignalSystem(quotes, {
    sectors: sectorData,
    tradingView: tradingView.data || [],
    news,
    relativeVolume: relativeVolumeLayer.data?.leaders || [],
    momentum: premarketMomentumData.leaders || [],
    indices: marketData.data?.indices || [],
    marketStatus: marketData.status || "unavailable"
  }) : { status: "unavailable", callCandidates: [], putCandidates: [], watchOnly: [], avoidChasing: [], cards: [], error: "no_realtime_quotes" };
  const riskRegime = calculateRiskRegime(marketData.data?.indices || []);
  const marketBreadthData = buildMarketBreadth({
    quotes,
    sectors: sectorData,
    indices: marketData.data?.indices || [],
    status: marketData.status === "live" ? "live" : marketData.status === "delayed" ? "delayed" : "stale"
  });
  const marketBreadthLayer = await settleSource("marketBreadth", async () => marketBreadthData, generatedAt, {}, "Market Breadth Engine");
  let premarketScanner = [];
  try {
    premarketScanner = runPremarketScanner({
      quotes,
      news,
      earnings: earningsLayer.data?.events || [],
      insider: insiderLayer.data?.signals || [],
      relativeVolume: relativeVolumeLayer.data?.leaders || []
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] premarketScanner", error?.message || error);
  }
  let signalEngine = { regime: "UNAVAILABLE", riskAppetite: null, error: "not_generated" };
  try {
    signalEngine = buildSignalEngine({
      indices: marketData.data?.indices || [],
      scanner: premarketScanner,
      breadth: marketBreadthLayer.data || marketBreadthData,
      risk: riskRegime,
      earnings: earningsLayer.data?.events || [],
      insider: insiderLayer.data?.signals || [],
      relativeVolume: relativeVolumeLayer.data?.leaders || []
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] signalEngine", error?.message || error);
  }

  const finviz = keepLastGood("finviz", source("finviz", sectorData, sectorData.length ? "delayed" : "unavailable", generatedAt, "Sector Heat Proxy", {
    error: sectorData.length ? null : "source_data_unavailable"
  }));
  const aggregateNewsStatus = selectedNewsSource ? selectedNewsSource.source.status || "delayed" : "unavailable";
  const aggregateNewsConfidence = selectedNewsSource?.source?.confidence || (aggregateNewsStatus === "live" ? "HIGH" : aggregateNewsStatus === "delayed" ? "MEDIUM" : "LOW");
  const benzinga = keepLastGood("benzinga", source("benzinga", { movers: moverData, news }, aggregateNewsStatus, generatedAt, "News Aggregator", {
    error: selectedNewsSource ? null : "no_realtime_news",
    confidence: aggregateNewsConfidence,
    fallback: !selectedNewsSource
  }));
  const unusualWhales = keepLastGood("unusualWhales", source("unusualWhales", optionsSignalData, optionsSignalData.cards?.length ? "delayed" : "unavailable", generatedAt, "Options Signal System", {
    error: optionsSignalData.cards?.length ? null : (optionsSignalData.error || "insufficient_realtime_quotes")
  }));
  const xMacro = source("xMacro", [
    { source: "Macro Monitor", title: `${riskRegime.mode} 结构监控`, summary: riskRegime.mode === "Risk-On" ? "QQQ、VIX、DXY 与 TNX 组合支持科技风险偏好。" : "宏观变量仍需观察，避免无量追高。", tone: riskRegime.mode === "Risk-Off" ? "bearish" : "bullish" }
  ], "delayed", generatedAt, "Macro Risk Proxy");
  const normalizedMarketDataSource = {
    ...marketData,
    provider: marketData.provider || marketData.data?.provider || "Fallback Cache",
    indices: marketData.indices || marketData.data?.indices || [],
    quotes: marketData.quotes || marketData.data?.quotes || []
  };
  const newsAggregator = source("newsAggregator", { movers: moverData, news }, aggregateNewsStatus, generatedAt, "News Aggregator", {
    error: selectedNewsSource ? null : "no_realtime_news",
    confidence: aggregateNewsConfidence,
    fallback: !selectedNewsSource
  });
  let confidenceScore = { dataConfidence: "LOW", signalConfidence: "LOW", tradeConfidence: "LOW", score: 0, detail: [] };
  try {
    confidenceScore = buildConfidenceScore({
      marketData: normalizedMarketDataSource,
      premarketMomentum: premarketMomentumLayer,
      marketBreadth: marketBreadthLayer,
      tradingView,
      relativeVolume: relativeVolumeLayer,
      newsAggregator
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] confidenceScore", error?.message || error);
  }
  let marketRegime = {
    type: riskRegime.mode === "Risk-On" ? "RISK_ON" : riskRegime.mode === "Risk-Off" ? "RISK_OFF" : "NEUTRAL",
    score: riskRegime.score ?? null,
    explanation: riskRegime.reason || "市场结构引擎暂不可用，保留基础风险判断。",
    tradable: normalizedMarketDataSource.status === "live" || normalizedMarketDataSource.status === "delayed",
    preferredStyle: "控仓观察"
  };
  try {
    marketRegime = buildMarketRegime({
      marketData: normalizedMarketDataSource,
      premarketMomentum: premarketMomentumLayer,
      marketBreadth: marketBreadthLayer,
      tradingView
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] marketRegime", error?.message || error);
  }
  let watchlist = { strong: [], watch: [], avoid: [] };
  try {
    watchlist = buildWatchlist({
      premarketMomentum: premarketMomentumLayer,
      marketRegime,
      relativeVolume: relativeVolumeLayer
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] watchlist", error?.message || error);
  }
  let strategySummary = {
    regime: marketRegime.type || "NEUTRAL",
    headline: "控仓观察",
    summary: marketRegime.explanation || "市场数据可用，等待动能与宽度确认。",
    bias: "NEUTRAL",
    confidence: confidenceScore.tradeConfidence || "LOW",
    reasons: [],
    risks: [],
    avoid: [],
    focusSectors: [],
    focusSymbols: []
  };
  try {
    strategySummary = buildStrategySummary({
      marketRegime,
      premarketMomentum: premarketMomentumLayer,
      marketBreadth: marketBreadthLayer,
      confidenceScore
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] strategySummary", error?.message || error);
  }
  let tradePlan = {
    action: "控仓观察",
    entryCondition: "等待开盘量价确认。",
    invalidation: "若 QQQ 与市场宽度同步转弱，取消追涨。",
    riskControl: "单笔风险控制在账户 1%-2%。",
    targetStyle: "控仓观察",
    avoidCondition: "避免无量高开。"
  };
  try {
    tradePlan = buildTradePlan({
      marketRegime,
      strategySummary,
      watchlist
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] tradePlan", error?.message || error);
  }
  const decisionEngine = source("decisionEngine", {
    strategySummary,
    marketRegime,
    tradePlan,
    watchlist,
    confidenceScore
  }, normalizedMarketDataSource.status === "live" ? "live" : normalizedMarketDataSource.status === "delayed" ? "delayed" : "unavailable", generatedAt, "Decision Engine", {
    confidence: confidenceScore.tradeConfidence,
    fallback: false
  });

  const snapshot = {
    generatedAt,
    envDebug: envDebug(),
    marketData: normalizedMarketDataSource.data || { indices: normalizedMarketDataSource.indices || [], quotes: normalizedMarketDataSource.quotes || [], provider: normalizedMarketDataSource.provider },
    summary: {
      status: normalizedMarketDataSource.status,
      provider: normalizedMarketDataSource.provider,
      headline: strategySummary.headline,
      strategy: strategySummary.summary,
      riskMode: riskRegime.mode,
      riskScore: riskRegime.score,
      marketRegime: marketRegime.type,
      confidence: confidenceScore.tradeConfidence,
      updatedAt: generatedAt
    },
    indices: normalizedMarketDataSource.data?.indices || normalizedMarketDataSource.indices || [],
    breadth: marketBreadthLayer.data || marketBreadthData || {},
    sectors: sectorData,
    premarket: {
      movers: moverData,
      momentum: premarketMomentumData,
      scanner: premarketScanner
    },
    risk: riskRegime,
    riskRegime,
    strategySummary,
    marketRegime,
    tradePlan,
    watchlist,
    confidenceScore,
    layers: {
      realtimeQuotes: {
        sourcePriority: ["Finnhub", "TwelveData", "Fallback Cache"],
        confidence: finnhubProbe.status === "live" || twelveData.status === "delayed" ? "中高" : "低",
        freshness: nowIso(generatedAt)
      },
      marketStructure: marketBreadthLayer.data || marketBreadthData,
      earnings: earningsLayer.data || { events: [] },
      insider: insiderLayer.data || { signals: [] },
      relativeVolume: relativeVolumeLayer.data || { leaders: [] },
      premarketMomentum: premarketMomentumData,
      institutionalBehavior: {
        insider: insiderLayer.data?.signals || insider.data || [],
        earnings: earningsLayer.data?.events || earnings.data || [],
        confidence: insiderLayer.status === "delayed" || earningsLayer.status === "delayed" ? "中" : "低"
      },
      newsCatalyst: {
        topSource: selectedNewsSource ? selectedNewsSource.name : "none",
        total: news.length,
        status: selectedNewsSource ? (selectedNewsSource.source.status || "delayed") : "no_realtime_news",
        error: selectedNewsSource ? null : "no_realtime_news"
      },
      strategySummary,
      marketRegime,
      tradePlan,
      watchlist,
      confidenceScore,
      tradeSignals: signalEngine,
      premarketScanner
    },
    sources: {
        finnhub: finnhubProbe,
        twelveData,
        alphavantage: alphaMacro,
        fred: fredMacro,
        earnings: earningsLayer,
        insider: insiderLayer,
        relativeVolume: relativeVolumeLayer,
        premarketMomentum: premarketMomentumLayer,
        marketBreadth: marketBreadthLayer,
        decisionEngine,
        marketData: normalizedMarketDataSource,
        reddit,
        tradingView,
        finnhubNews,
        marketWatchNews,
        reutersNews,
        secNews,
        finnhubInsider: insider,
        finnhubEarnings: earnings,
        xMacro,
        finviz,
        unusualWhales,
        benzinga,
        newsAggregator
    }
  };
  console.log("[SNAPSHOT FINAL]", JSON.stringify(snapshot, null, 2));
  lastGoodSnapshot = snapshot;
  return snapshot;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function avg(values) {
  return values.reduce((sum, item) => sum + (Number(item) || 0), 0) / Math.max(1, values.length);
}

function sectorThemeBonus(sector) {
  if (/AI 半导体|AI 软件|AI 服务器|云计算|加密资产|大型科技|高 beta/.test(sector)) return 12;
  if (/医疗|能源|金融/.test(sector)) return -3;
  return 0;
}

export default async function handler(req, res) {
  try {
    noStoreJson(res, 200, await buildSnapshot(req));
  } catch (error) {
    if (lastGoodSnapshot) {
      noStoreJson(res, 200, { ...lastGoodSnapshot, servedFrom: "last-success", error: error.message });
      return;
    }
    noStoreJson(res, 200, {
      generatedAt: Date.now(),
      envDebug: envDebug(),
      servedFrom: "emergency-snapshot",
      error: error.message,
      marketData: { indices: lastGoodIndices(), quotes: lastGoodQuotes(), provider: "Emergency Fallback" },
      summary: {
        status: "unavailable",
        provider: "Emergency Fallback",
        headline: "数据源异常",
        strategy: "snapshot 构建失败，等待下一次刷新。",
        riskMode: "DATA_UNAVAILABLE",
        riskScore: null,
        marketRegime: "UNAVAILABLE",
        confidence: "LOW",
        updatedAt: Date.now()
      },
      indices: lastGoodIndices(),
      breadth: {},
      sectors: [],
      premarket: { movers: [], momentum: { leaders: [] }, scanner: [] },
      risk: { mode: "DATA_UNAVAILABLE", score: null, reason: "snapshot_build_failed" },
      strategySummary: null,
      marketRegime: null,
      tradePlan: null,
      watchlist: { strong: [], watch: [], avoid: [] },
      confidenceScore: { dataConfidence: "LOW", signalConfidence: "LOW", tradeConfidence: "LOW", score: 0 },
      sources: {
        finnhub: {
          status: "UNAVAILABLE",
          source: "Finnhub",
          error: "invalid_response",
          testSymbols: ["AAPL", "NVDA", "SPY", "QQQ"],
          quotes: [],
          confidence: "LOW",
          fallback: true,
          participatesInScoring: false
        },
        twelveData: fallbackSource("twelveData", []),
        alphavantage: fallbackSource("alphavantage", null),
        fred: fallbackSource("fred", []),
        earnings: fallbackSource("earnings", { events: [] }),
        insider: fallbackSource("insider", { signals: [] }),
        relativeVolume: fallbackSource("relativeVolume", { leaders: [] }),
        premarketMomentum: fallbackSource("premarketMomentum", { leaders: [] }),
        marketBreadth: fallbackSource("marketBreadth", {}),
        decisionEngine: fallbackSource("decisionEngine", {}),
        marketData: fallbackSource("marketData", { indices: lastGoodIndices(), quotes: lastGoodQuotes() }),
        reddit: fallbackSource("reddit", { score: null, tone: "UNAVAILABLE", mentions: [], summary: "数据源不可用。" }),
        tradingView: fallbackSource("tradingView", []),
        xMacro: fallbackSource("xMacro", []),
        finviz: fallbackSource("finviz", []),
        unusualWhales: fallbackSource("unusualWhales", []),
        newsAggregator: { ...fallbackSource("newsAggregator", { movers: [], news: [] }), status: "unavailable", dataQuality: "unavailable", error: "no_realtime_news" },
        benzinga: { ...fallbackSource("benzinga", { movers: [], news: [] }), status: "unavailable", dataQuality: "unavailable", error: "no_realtime_news" },
        finnhubNews: { ...fallbackSource("finnhubNews", []), status: "unavailable", dataQuality: "unavailable", error: "no_realtime_news" },
        marketWatchNews: { ...fallbackSource("marketWatchNews", []), status: "unavailable", dataQuality: "unavailable", error: "no_realtime_news" },
        reutersNews: { ...fallbackSource("reutersNews", []), status: "unavailable", dataQuality: "unavailable", error: "no_realtime_news" },
        secNews: { ...fallbackSource("secNews", []), status: "unavailable", dataQuality: "unavailable", error: "no_realtime_news" }
      }
    });
  }
}
