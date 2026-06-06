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
import { buildMarketStructurePro } from "../lib/market-structure-pro.js";
import { buildTradeDecision } from "../lib/trade-decision-engine.js";

const MARKET_SYMBOLS = {
  SPY: "SPY",
  QQQ: "QQQ",
  VIX: "^VIX",
  TNX: "^TNX",
  DXY: "DX-Y.NYB",
  GOLD: "GC=F",
  NDX: "^NDX",
  WTI: "CL=F",   // WTI 原油 — Yahoo Chart / Stooq 兜底
  BRENT: "BZ=F"  // Brent 原油 — Yahoo Chart / Stooq 兜底
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
  marketStructurePro: "Market Structure Pro",
  yieldCurve: "Yield Curve Pro",
  oilLayer: "Oil Market Layer",
  fedWatch: "FedWatch Proxy",
  breadthPro: "Breadth Pro",
  decisionEngine: "Decision Engine",
  tradeDecision: "Trade Decision Engine",
  newsAggregator: "News Aggregator",
  marketData: "Multi-source Market Data",
  tradingView: "TradingView Screener",
  xMacro: "Macro Feed",
  reddit: "WallStreetBets Reddit",
  finviz: "Sector Heat Proxy",
  sectorHeat: "Sector Heat Engine",
  unusualWhales: "Options Signal System",
  optionsSignals: "Options Signal Proxy",
  benzinga: "Benzinga API",
  newsCatalysts: "News Catalyst Engine",
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
  IBIT: ["iShares Bitcoin Trust", "加密资产"],
  XLK: ["Technology Select Sector SPDR", "Technology"],
  SMH: ["VanEck Semiconductor ETF", "Semiconductor"],
  SOXX: ["iShares Semiconductor ETF", "Semiconductor"],
  XLF: ["Financial Select Sector SPDR", "Financials"],
  XLE: ["Energy Select Sector SPDR", "Energy"],
  XLV: ["Health Care Select Sector SPDR", "Healthcare"],
  XLY: ["Consumer Discretionary Select Sector SPDR", "Consumer"],
  XLP: ["Consumer Staples Select Sector SPDR", "Consumer Staples"],
  XLI: ["Industrial Select Sector SPDR", "Industrials"],
  XLB: ["Materials Select Sector SPDR", "Materials"],
  XLU: ["Utilities Select Sector SPDR", "Utilities"],
  XLRE: ["Real Estate Select Sector SPDR", "Real Estate"],
  XLC: ["Communication Services Select Sector SPDR", "Communication Services"],
  IWM: ["iShares Russell 2000 ETF", "Small Caps"],
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
  GOLD: "GOLD",
  WTI: "WTI 原油",
  BRENT: "Brent 原油"
};

const INDEX_SOURCE_MAP = {
  SPY: [
    { type: "prefetch", provider: "Finnhub", symbol: "SPY", quality: "LIVE" },
    { type: "prefetch", provider: "TwelveData", symbol: "SPY", quality: "DELAYED" },
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "SPY", quality: "DELAYED" },
    { type: "stooq", provider: "Stooq CSV", symbol: "spy.us", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ],
  QQQ: [
    { type: "prefetch", provider: "Finnhub", symbol: "QQQ", quality: "LIVE" },
    { type: "prefetch", provider: "TwelveData", symbol: "QQQ", quality: "DELAYED" },
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "QQQ", quality: "DELAYED" },
    { type: "stooq", provider: "Stooq CSV", symbol: "qqq.us", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ],
  NDX: [
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "^NDX", quality: "DELAYED" },
    { type: "stooq", provider: "Stooq CSV", symbol: "^ndx", quality: "DELAYED" },
    { type: "prefetch", provider: "TwelveData", symbol: "NDX", quality: "DELAYED" },
    { type: "tradingViewProxy", provider: "TradingView proxy", symbol: "QQQ", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ],
  VIX: [
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "^VIX", quality: "DELAYED" },
    { type: "stooq", provider: "Stooq CSV", symbol: "^vix", quality: "DELAYED" },
    { type: "prefetch", provider: "TwelveData", symbol: "VIX", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ],
  DXY: [
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "DX-Y.NYB", quality: "DELAYED" },
    { type: "prefetch", provider: "TwelveData", symbol: "DXY", quality: "DELAYED" },
    { type: "yahooProxy", provider: "Yahoo UUP proxy", symbol: "UUP", quality: "PROXY" },
    { type: "alpha", provider: "AlphaVantage FX proxy", symbol: "DX-Y.NYB", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ],
  TNX: [
    { type: "prefetch", provider: "FRED", symbol: "^TNX", quality: "DELAYED" },
    { type: "alpha", provider: "AlphaVantage TREASURY_YIELD", symbol: "^TNX", quality: "DELAYED" },
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "^TNX", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ],
  GOLD: [
    { type: "prefetch", provider: "TwelveData", symbol: "GOLD", quality: "DELAYED" },
    { type: "alpha", provider: "AlphaVantage XAU/USD", symbol: "GOLD", quality: "DELAYED" },
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "GC=F", quality: "DELAYED" },
    { type: "stooq", provider: "Stooq CSV", symbol: "gc.f", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ],
  // 原油期货 — TwelveData 免费档不支持，走 Yahoo Chart + Stooq
  // key 与 MARKET_SYMBOLS 保持一致（WTI/BRENT），symbol 字段传真实期货代码
  WTI: [
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "CL=F", quality: "DELAYED" },
    { type: "stooq", provider: "Stooq CSV", symbol: "cl.f", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ],
  BRENT: [
    { type: "yahooChart", provider: "Yahoo Chart", symbol: "BZ=F", quality: "DELAYED" },
    { type: "stooq", provider: "Stooq CSV", symbol: "bz.f", quality: "DELAYED" },
    { type: "lastKnownGood", provider: "lastKnownGood", quality: "CACHED" }
  ]
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
const LAST_KNOWN_GOOD_TTL_MS = 6 * 60 * 60 * 1000;
const SOURCE_MANAGER_TIMEOUT_MS = 2800;
const CRITICAL_SOURCE_TIMEOUT_MS = 3600;
const CRITICAL_SOURCES = new Set(["twelveData", "tradingView", "marketData"]);
const CACHE_FIRST_SOURCES = new Set([
  "finnhubInsider",
  "finnhubEarnings",
  "alphavantage",
  "fred",
  "earnings",
  "insider",
  "reddit",
  "benzinga",
  "finnhubNews",
  "marketWatchNews",
  "reutersNews",
  "secNews"
]);
let snapshotRuntimeMode = "fast";
let snapshotRuntimeStartedAt = 0;
const LAST_KNOWN_GOOD_KEY = "market-dashboard:lastKnownGood";
const SOURCE_PLANS = {
  marketData: { primary: "Finnhub quotes", backups: ["TwelveData", "TradingView Screener", "AlphaVantage / Stooq", "lastKnownGood cache"] },
  movers: { primary: "News Aggregator movers", backups: ["marketData quotes", "Premarket Momentum Engine", "lastKnownGood cache"] },
  newsAggregator: { primary: "Benzinga API", backups: ["Finnhub company-news", "MarketWatch RSS", "Reuters RSS", "SEC filing feed", "lastKnownGood cache"] },
  xMacro: { primary: "FRED macro layer", backups: ["AlphaVantage macro", "Market regime engine", "lastKnownGood cache"] },
  riskMetrics: { primary: "marketData indices", backups: ["FRED DGS10", "AlphaVantage macro", "lastKnownGood cache"] },
  crossAsset: { primary: "TwelveData VIX/DXY/XAU/USD", backups: ["FRED DGS10", "AlphaVantage XAUUSD/TREASURY_YIELD", "lastKnownGood cache"] },
  sectorHeat: { primary: "marketData ETF basket", backups: ["TradingView Screener", "quote sector grouping", "lastKnownGood cache"] },
  optionsSignals: { primary: "marketData + RVOL + sectorHeat", backups: ["premarketMomentum", "newsCatalysts", "lastKnownGood cache"] },
  relativeVolume: { primary: "marketData quote volume", backups: ["TradingView volume", "premarketMomentum proxy", "lastKnownGood cache"] },
  premarketMomentum: { primary: "marketData quotes", backups: ["TradingView Screener", "relativeVolume", "newsCatalysts", "lastKnownGood cache"] },
  marketBreadth: { primary: "marketData breadth proxy", backups: ["sectorHeat", "TradingView participation", "lastKnownGood cache"] },
  marketStructurePro: { primary: "Sector ETFs + Yield Curve + Oil + Breadth", backups: ["marketData", "FRED", "AlphaVantage", "lastKnownGood cache"] },
  yieldCurve: { primary: "FRED DGS2/DGS10/DGS30", backups: ["AlphaVantage treasury", "lastKnownGood cache"] },
  oilLayer: { primary: "TwelveData/Yahoo oil futures", backups: ["snapshot proxy", "lastKnownGood cache"] },
  fedWatch: { primary: "FedWatch proxy from yields", backups: ["FRED", "market regime", "lastKnownGood cache"] },
  breadthPro: { primary: "Market breadth proxy + sector ETFs", backups: ["quote participation", "lastKnownGood cache"] }
};

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.length ? value : "";
}

const cacheAdapter = {
  get type() {
    if (envValue("UPSTASH_REDIS_REST_URL") && envValue("UPSTASH_REDIS_REST_TOKEN")) return "upstash";
    if (envValue("SUPABASE_URL") && envValue("SUPABASE_SERVICE_ROLE_KEY")) return "supabase";
    return "memory";
  },
  async read(key = LAST_KNOWN_GOOD_KEY) {
    try {
      if (this.type === "upstash") return readUpstashCache(key);
      if (this.type === "supabase") return readSupabaseCache(key);
      return lastGoodSnapshot;
    } catch (error) {
      console.error("[snapshot:cache] read failed", { adapter: this.type, reason: error?.message || String(error) });
      return lastGoodSnapshot;
    }
  },
  async write(key = LAST_KNOWN_GOOD_KEY, value) {
    if (!value) return false;
    lastGoodSnapshot = value;
    lastGoodSources = value.sources || lastGoodSources || {};
    try {
      if (this.type === "upstash") return writeUpstashCache(key, value);
      if (this.type === "supabase") return writeSupabaseCache(key, value);
      return true;
    } catch (error) {
      console.error("[snapshot:cache] write failed", { adapter: this.type, reason: error?.message || String(error) });
      return false;
    }
  }
};

async function readUpstashCache(key) {
  const base = envValue("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = envValue("UPSTASH_REDIS_REST_TOKEN");
  try {
    const response = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null; // FIX: return null instead of throw on HTTP error (e.g. cold cache, 404)
    const payload = await response.json();
    const raw = payload?.result;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null; // FIX: never crash on cache read failure — fall through to live fetch
  }
}

async function writeUpstashCache(key, value, ttlSeconds = 6 * 60 * 60) {
  // FIX: Added EX TTL so the key auto-expires in Redis (was missing — caused stale data to persist indefinitely).
  // Default TTL = 6 hours (matches LAST_KNOWN_GOOD_TTL_MS). Override with second argument for finer tiers.
  const base = envValue("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = envValue("UPSTASH_REDIS_REST_TOKEN");
  const response = await fetch(`${base}/pipeline`, {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["SET", key, JSON.stringify(value), "EX", ttlSeconds]])
  });
  if (!response.ok) throw new Error(`upstash_write_${response.status}`);
  return true;
}

async function readSupabaseCache(key) {
  const base = envValue("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/rest/v1/dashboard_cache?id=eq.${encodeURIComponent(key)}&select=payload`, {
    cache: "no-store",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`supabase_read_${response.status}`);
  const rows = await response.json();
  return rows?.[0]?.payload || null;
}

async function writeSupabaseCache(key, value) {
  const base = envValue("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/rest/v1/dashboard_cache?on_conflict=id`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({ id: key, payload: value, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`supabase_write_${response.status}`);
  return true;
}

async function hydratePersistentCache() {
  const cached = await cacheAdapter.read();
  if (cached?.generatedAt) {
    lastGoodSnapshot = cached;
    lastGoodSources = cached.sources || {};
  }
  return cached;
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
  if (["live", "delayed", "cached", "snapshot", "stale", "unavailable", "proxy"].includes(value)) return value;
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

function ageMs(updatedAt, now = Date.now()) {
  const value = Number(updatedAt || 0);
  return Number.isFinite(value) && value > 0 ? Math.max(0, now - value) : null;
}

function sourceStatusFrom(dataQuality, updatedAt, hasError = false) {
  const q = normalizeDataQuality(dataQuality);
  const age = ageMs(updatedAt);
  if (q === "live") return "LIVE";
  if (q === "delayed") return "FRESH";
  if (q === "cached") return age !== null && age <= LAST_KNOWN_GOOD_TTL_MS ? "CACHED" : "STALE";
  if (q === "stale") return age !== null && age <= LAST_KNOWN_GOOD_TTL_MS ? "CACHED" : "STALE";
  if (q === "snapshot") return "ERROR";
  return hasError ? "ERROR" : "ERROR";
}

function sourcePlanFor(key) {
  return SOURCE_PLANS[key] || { primary: sourceCatalog[key] || key, backups: ["lastKnownGood cache"] };
}

function hasUsableData(data) {
  if (Array.isArray(data)) return data.length > 0;
  if (!data || typeof data !== "object") return data !== null && data !== undefined;
  return Object.values(data).some((value) => Array.isArray(value) ? value.length > 0 : value && typeof value === "object" ? Object.keys(value).length > 0 : value !== null && value !== undefined);
}

function source(key, data, status, generatedAt, label = sourceCatalog[key], extra = {}) {
  const dataQuality = normalizeDataQuality(status);
  const updatedAt = Number(extra.updatedAt || generatedAt);
  const confidence = extra.confidence || confidenceFromStatus(dataQuality);
  const fallback = Boolean(extra.fallback ?? (dataQuality === "snapshot" || dataQuality === "stale"));
  const plan = extra.sourcePlan || sourcePlanFor(key);
  const hasError = Boolean(extra.error);
  const sourceStatus = extra.sourceStatus || sourceStatusFrom(dataQuality, updatedAt, hasError);
  return {
    data,
    status: dataQuality,
    sourceStatus,
    fetchStatus: sourceStatus,
    source: label,
    dataQuality,
    isTradable: isTradableQuality(dataQuality),
    label,
    updatedAt,
    fetchedAt: extra.fetchedAt || generatedAt,
    publishedAt: extra.publishedAt || extra.updatedAt || generatedAt,
    timestamp: nowIso(updatedAt),
    latency: Number.isFinite(Number(extra.latency)) ? Number(extra.latency) : null,
    error: extra.error || null,
    provider: extra.provider || null,
    sourcePlan: plan,
    primarySource: plan.primary,
    backupSources: plan.backups,
    cachePolicy: {
      type: "lastKnownGood",
      staleAfterMs: LAST_KNOWN_GOOD_TTL_MS,
      staleAfter: "6h"
    },
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
  const stale = ageMs(updatedAt) !== null && ageMs(updatedAt) > LAST_KNOWN_GOOD_TTL_MS;
  return {
    ...cached,
    status: stale ? "stale" : "cached",
    sourceStatus: stale ? "STALE" : "CACHED",
    fetchStatus: stale ? "STALE" : "CACHED",
    source: cached.source || sourceCatalog[key],
    dataQuality: stale ? "stale" : "cached",
    isTradable: false,
    fetchedAt: cached.fetchedAt || updatedAt,
    publishedAt: cached.publishedAt || updatedAt,
    timestamp: cached.timestamp || nowIso(updatedAt),
    confidence: cached.confidence || "LOW",
    freshness: freshnessFromUpdatedAt(updatedAt, stale ? "stale" : "cached"),
    fallback: true
  };
}

function fallbackSource(key, data = null) {
  const plan = sourcePlanFor(key);
  return {
    data,
    status: "unavailable",
    sourceStatus: "ERROR",
    fetchStatus: "ERROR",
    source: sourceCatalog[key],
    dataQuality: "unavailable",
    isTradable: false,
    label: sourceCatalog[key],
    updatedAt: null,
    fetchedAt: null,
    publishedAt: null,
    timestamp: "no usable source",
    latency: null,
    confidence: "LOW",
    freshness: "source unavailable",
    fallback: true,
    sourcePlan: plan,
    primarySource: plan.primary,
    backupSources: plan.backups,
    cachePolicy: {
      type: "lastKnownGood",
      staleAfterMs: LAST_KNOWN_GOOD_TTL_MS,
      staleAfter: "6h"
    }
  };
}

function keepLastGood(key, item) {
  if (["live", "delayed"].includes(item.status) && hasUsableData(item.data)) lastGoodSources[key] = item;
  return item;
}

function stableModuleSource(key, item) {
  if (["live", "delayed"].includes(item.status) && hasUsableData(item.data)) return keepLastGood(key, item);
  if (lastGoodSources[key]) return cachedSource(key, lastGoodSources[key]);
  return item;
}

function lastOrFallback(key, fallbackData = null) {
  return lastGoodSources[key] ? cachedSource(key, lastGoodSources[key]) : fallbackSource(key, fallbackData);
}

async function settleSource(key, loader, generatedAt, fallbackData = null, label) {
  const plan = sourcePlanFor(key);
  const runtimeAge = snapshotRuntimeStartedAt ? Date.now() - snapshotRuntimeStartedAt : 0;
  if (snapshotRuntimeMode === "fast" && CACHE_FIRST_SOURCES.has(key)) {
    if (lastGoodSources[key]) {
      const cached = cachedSource(key, lastGoodSources[key]);
      cached.fastPath = true;
      cached.cachePolicy = { ...(cached.cachePolicy || {}), mode: "cache-first", reason: "vercel_hobby_fast_path" };
      return cached;
    }
    const fallback = fallbackSource(key, fallbackData);
    fallback.fastPath = true;
    fallback.error = "skipped_in_fast_path";
    fallback.sourcePlan = plan;
    fallback.primarySource = plan.primary;
    fallback.backupSources = plan.backups;
    return fallback;
  }
  if (snapshotRuntimeMode === "fast" && runtimeAge > 7600 && !CRITICAL_SOURCES.has(key)) {
    if (lastGoodSources[key]) return cachedSource(key, lastGoodSources[key]);
    const fallback = fallbackSource(key, fallbackData);
    fallback.error = "time_budget_exceeded";
    return fallback;
  }
  const maxAttempts = 1;
  const timeoutMs = CRITICAL_SOURCES.has(key) ? CRITICAL_SOURCE_TIMEOUT_MS : SOURCE_MANAGER_TIMEOUT_MS;
  let lastError = null;
  let loaded = null;
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        loaded = await loader({ attempt, timeoutMs });
        break;
      } catch (error) {
        lastError = error;
        console.error(`${SOURCE_DEBUG_PREFIX} sourceManager attempt failed`, {
          source: key,
          attempt,
          timeoutMs,
          primary: plan.primary,
          backups: plan.backups,
          message: error?.message || String(error)
        });
      }
    }
    if (!loaded) throw lastError || new Error("source_failed");
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
          updatedAt: loaded.updatedAt,
          sourcePlan: plan,
          fetchedAt: generatedAt,
          publishedAt: loaded.updatedAt || generatedAt,
          sourceStatus: loaded.sourceStatus
        }
      )
    );
  } catch (error) {
    console.error(`${SOURCE_DEBUG_PREFIX} sourceManager fallback`, {
      source: key,
      primary: plan.primary,
      backups: plan.backups,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    if (lastGoodSources[key]) return cachedSource(key, lastGoodSources[key]);
    const fallback = fallbackSource(key, fallbackData);
    fallback.error = error?.message || String(error);
    fallback.sourcePlan = plan;
    fallback.primarySource = plan.primary;
    fallback.backupSources = plan.backups;
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

function validIndexValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function normalizeIndexMetric(id, row, route = {}) {
  if (!row || !validIndexValue(row.value ?? row.price)) return null;
  const dataQuality = normalizeDataQuality(route.quality || row.dataStatus || row.status || "DELAYED");
  const source = route.provider || row.provider || row.source || "Index Router";
  const updatedAt = Number(row.updatedAt || row.timestamp || Date.now());
  return {
    id,
    name: MARKET_INDEX_META[id] || id,
    value: Number(row.value ?? row.price),
    change: Number(row.change ?? row.regularChange ?? 0) || 0,
    source,
    provider: source,
    providerSymbol: route.symbol || row.providerSymbol || row.symbol || MARKET_SYMBOLS[id] || id,
    dataQuality,
    status: dataQuality,
    updatedAt,
    timestamp: updatedAt,
    isTradable: ["live", "delayed"].includes(dataQuality),
    note: `${statusTextForIndex(dataQuality)} · ${source}`,
    fallback: ["cached", "stale", "snapshot"].includes(dataQuality),
    triedSources: route.triedSources || [],
    successfulSource: route.successfulSource || source,
    failedSources: route.failedSources || [],
    errorReason: route.errorReason || null
  };
}

function statusTextForIndex(dataQuality) {
  if (dataQuality === "live") return "实时数据";
  if (dataQuality === "delayed") return "延迟数据";
  if (dataQuality === "cached") return "最近有效数据";
  if (dataQuality === "stale") return "缓存快照";
  return "结构参考";
}

async function fetchYahooChartIndex(providerSymbol, indexId) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1m&range=1d`;
  const payload = await fetchJsonWithDebug("YAHOO_CHART_INDEX", url, { timeoutMs: 4000 });
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta || {};
  const price = Number(meta.regularMarketPrice || meta.chartPreviousClose || 0);
  const previous = Number(meta.previousClose || meta.chartPreviousClose || result?.indicators?.quote?.[0]?.open?.find((item) => Number.isFinite(Number(item))) || 0);
  if (!validIndexValue(price)) return null;
  const change = validIndexValue(previous) ? ((price - previous) / previous) * 100 : 0;
  return {
    symbol: indexId,
    providerSymbol,
    price,
    value: price,
    change,
    regularChange: change,
    dataStatus: "DELAYED",
    provider: "Yahoo Chart",
    timestamp: Number(meta.regularMarketTime || 0) > 0 ? Number(meta.regularMarketTime) * 1000 : Date.now()
  };
}

async function fetchStooqIndex(providerSymbol, indexId) {
  const response = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(providerSymbol)}&f=sd2t2ohlcvp&h&e=csv`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Institutional-Terminal/1.0)" }
  });
  if (!response.ok) return null;
  const [headerLine, line] = (await response.text()).trim().split(/\r?\n/);
  const row = parseStooqCsvRow(headerLine, line);
  if (!row) return null;
  const price = Number(row.close);
  const percentChange = parseStooqPercent(row.percent);
  if (!validIndexValue(price)) return null;
  const change = Number.isFinite(percentChange) ? percentChange : 0;
  const timestamp = row.date && row.time ? Date.parse(`${row.date}T${String(row.time).replace(/\./g, ":")}Z`) : Date.now();
  return {
    symbol: indexId,
    providerSymbol,
    price,
    value: price,
    change,
    regularChange: change,
    changeQuality: Number.isFinite(percentChange) ? "percent" : "unknown",
    volume: Number(row.volume) || 0,
    averageVolume: Number(row.volume) || 0,
    dataStatus: "DELAYED",
    provider: "Stooq CSV",
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now()
  };
}

function parseStooqCsvRow(headerLine = "", line = "") {
  if (!headerLine || !line) return null;
  const headers = headerLine.split(",").map((item) => item.trim().toLowerCase());
  const values = line.split(",");
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  return {
    symbol: row.symbol,
    date: row.date,
    time: row.time,
    close: row.close,
    volume: row.volume,
    percent: row["%change"] ?? row["change%"] ?? row.percent ?? row.perc
  };
}

function parseStooqPercent(value) {
  if (value === undefined || value === null || value === "" || String(value).toUpperCase() === "N/D") return null;
  const cleaned = String(value).replace("%", "").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function prefetchIndexRow(route, context = {}) {
  if (route.provider === "Finnhub") {
    const map = context.finnhubMap || new Map();
    return map.get(route.symbol) || null;
  }
  if (route.provider === "TwelveData") {
    const map = context.twelveMap || new Map();
    return map.get(route.symbol) || map.get(MARKET_SYMBOLS[route.symbol]) || null;
  }
  if (route.provider === "FRED") {
    const map = context.fredMap || new Map();
    return map.get(route.symbol) || null;
  }
  if (route.provider?.startsWith("AlphaVantage") && context.alphaMacroMap) {
    return context.alphaMacroMap.get(route.symbol) || null;
  }
  return null;
}

function lastKnownGoodIndex(id) {
  const stale = lastGoodIndices().find((item) => item.id === id);
  if (!stale || !validIndexValue(stale.value)) return null;
  return {
    ...stale,
    value: Number(stale.value),
    change: Number(stale.change || 0),
    dataStatus: "CACHED",
    status: "cached",
    dataQuality: "cached",
    source: stale.source || "lastKnownGood",
    provider: stale.provider || stale.source || "lastKnownGood",
    timestamp: Number(stale.updatedAt || stale.timestamp || Date.now())
  };
}

function marketDataStats(data = {}) {
  const indices = Array.isArray(data.indices) ? data.indices : [];
  const quotes = Array.isArray(data.quotes) ? data.quotes : [];
  return {
    indicesCount: indices.length,
    liveDelayedIndicesCount: indices.filter((item) => ["live", "delayed"].includes(normalizeDataQuality(item.dataQuality || item.status))).length,
    quotesCount: quotes.length,
    liveDelayedQuotesCount: quotes.filter((item) => ["live", "delayed"].includes(normalizeDataQuality(item.dataQuality || item.status))).length
  };
}

function buildDebugActiveMarketData(snapshot = {}) {
  const candidates = [
    { source: "current", data: snapshot.sources?.marketData?.data || snapshot.marketData, provider: snapshot.sources?.marketData?.provider || snapshot.summary?.provider },
    { source: "lastKnownGood", data: snapshot.lastKnownGood?.marketData, provider: snapshot.lastKnownGood?.marketData?.provider },
    { source: "lastKnownGood", data: snapshot.lastKnownGood?.sources?.marketData?.data, provider: snapshot.lastKnownGood?.sources?.marketData?.provider },
    { source: "fallback", data: { indices: snapshot.indices || [], quotes: snapshot.quotes || [] }, provider: snapshot.summary?.provider }
  ];
  const selected = candidates.map((candidate) => ({ ...candidate, stats: marketDataStats(candidate.data || {}) }))
    .find((candidate) => candidate.stats.liveDelayedIndicesCount >= 2 || candidate.stats.liveDelayedQuotesCount >= 3)
    || candidates.map((candidate) => ({ ...candidate, stats: marketDataStats(candidate.data || {}) })).find((candidate) => candidate.stats.indicesCount || candidate.stats.quotesCount)
    || { source: "fallback", data: {}, provider: "Fallback", stats: marketDataStats({}) };
  return {
    selectedSource: selected.source,
    indicesCount: selected.stats.indicesCount,
    liveDelayedIndicesCount: selected.stats.liveDelayedIndicesCount,
    quotesCount: selected.stats.quotesCount,
    liveDelayedQuotesCount: selected.stats.liveDelayedQuotesCount,
    provider: selected.provider || selected.data?.provider || "Market Data",
    cacheAdapter: cacheAdapter.type
  };
}


function isGoodSnapshotForCache(snapshot = {}) {
  const currentMarketData = snapshot.sources?.marketData?.data || snapshot.marketData || { indices: snapshot.indices || [], quotes: snapshot.quotes || [] };
  const stats = marketDataStats(currentMarketData);
  const reliabilityScore = Number(snapshot.confidenceScore?.dataReliabilityScore ?? snapshot.dataReliability?.score ?? 0);
  const marketStatus = normalizeDataQuality(snapshot.sources?.marketData?.status || snapshot.summary?.status);
  const provider = String(snapshot.sources?.marketData?.provider || snapshot.summary?.provider || currentMarketData?.provider || "").toLowerCase();
  const providerLooksStructural = /built-in|fallback|structure|structural/.test(provider);
  const hasUsableIndices = stats.liveDelayedIndicesCount >= 2;
  const hasUsableQuotes = stats.liveDelayedQuotesCount >= 3;
  const marketStatusUsable = ["live", "delayed"].includes(marketStatus);
  if (providerLooksStructural) return false;
  if (!hasUsableIndices && !hasUsableQuotes && !marketStatusUsable && reliabilityScore < 40) return false;
  return hasUsableIndices || hasUsableQuotes || marketStatusUsable || reliabilityScore >= 40;
}

function tradingViewIndexProxy(id, route, context = {}) {
  const stale = lastKnownGoodIndex(id);
  if (!stale) return null;
  const row = (context.tradingViewMap || new Map()).get(route.symbol);
  if (!row) return null;
  return {
    ...stale,
    change: Number(row.change || stale.change || 0),
    dataStatus: "DELAYED",
    provider: route.provider,
    source: route.provider,
    timestamp: row.timestamp || Date.now()
  };
}

async function fetchIndexWithFallback(indexId, context = {}) {
  const routes = INDEX_SOURCE_MAP[indexId] || [];
  const triedSources = [];
  const failedSources = [];
  for (const route of routes) {
    const routeLabel = `${route.provider}:${route.symbol || indexId}`;
    triedSources.push(routeLabel);
    try {
      let row = null;
      if (route.type === "prefetch") row = prefetchIndexRow(route, context);
      if (route.type === "yahooChart") row = await fetchYahooChartIndex(route.symbol, indexId);
      if (route.type === "yahooProxy") {
        const proxy = await fetchYahooChartIndex(route.symbol, route.symbol);
        if (proxy) {
          row = {
            ...proxy,
            symbol: indexId,
            providerSymbol: route.symbol,
            dataStatus: route.quality || "PROXY",
            provider: route.provider,
            source: route.provider
          };
        }
      }
      if (route.type === "stooq") row = await fetchStooqIndex(route.symbol, indexId);
      if (route.type === "alpha") row = await fetchAlphaVantageQuote(route.symbol);
      if (route.type === "tradingViewProxy") row = tradingViewIndexProxy(indexId, route, context);
      if (route.type === "lastKnownGood") row = lastKnownGoodIndex(indexId);
      if (!row) {
        failedSources.push({ source: route.provider, providerSymbol: route.symbol || indexId, errorReason: "no_data" });
        continue;
      }
      const normalized = normalizeIndexMetric(indexId, row, {
        ...route,
        triedSources,
        successfulSource: route.provider,
        failedSources
      });
      if (normalized) return normalized;
      failedSources.push({ source: route.provider, providerSymbol: route.symbol || indexId, errorReason: "invalid_value" });
    } catch (error) {
      failedSources.push({ source: route.provider, providerSymbol: route.symbol || indexId, errorReason: error?.message || String(error) });
      console.error("[snapshot:index-router] route failed", {
        indexId,
        provider: route.provider,
        providerSymbol: route.symbol,
        reason: error?.message || String(error)
      });
    }
  }
  return {
    id: indexId,
    name: MARKET_INDEX_META[indexId] || indexId,
    value: null,
    change: 0,
    source: "Index Router",
    providerSymbol: MARKET_SYMBOLS[indexId] || indexId,
    dataQuality: "unavailable",
    status: "unavailable",
    updatedAt: Date.now(),
    timestamp: Date.now(),
    isTradable: false,
    note: "结构参考",
    fallback: true,
    error: "source_failed",
    triedSources,
    successfulSource: null,
    failedSources,
    errorReason: failedSources.at(-1)?.errorReason || "source_failed"
  };
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
  // TwelveData 免费档可用符号映射
  // WTI/BRENT 原油在免费档不存在，由 Yahoo Chart 兜底，此处返回 null 跳过
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
    "GC=F": "XAU/USD",
    "CL=F": null,
    "BZ=F": null
  };
  const v = map[symbol];
  if (v === null) return null;
  return v !== undefined ? v : symbol;
}

function responseCodeFromError(error) {
  return String(error?.message || "").match(/upstream\s+(\d+)/)?.[1] || "fetch-error";
}

async function fetchJsonWithDebug(sourceName, url, options = {}) {
  const safeUrl = String(url)
    .replace(/([?&](?:token|apikey|api_key)=)[^&]+/gi, "$1***")
    .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, "$1***");

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

    const text = await response.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text?.slice(0, 500) || "" };
    }

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
      const payload = await fetchJsonWithDebug("FINNHUB", `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSymbol(symbol))}&token=${encodeURIComponent(token)}`, { timeoutMs: 4000 });
      const latencyMs = Date.now() - startedAt;
      latencies.push(latencyMs);

      if (payload?.error) throw new Error(payload.error);
      const normalized = normalizeProviderQuote(symbol, payload, "Finnhub", "LIVE");
      if (!normalized) {

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

  let finalError = "";
  const rows = await Promise.all(testSymbols.map(async (symbol) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
    const safeUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=***`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const startedAt = Date.now();
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

      if (!response.ok) {
        if (response.status === 401) finalError = "401_invalid_key";
        else if (response.status === 403) finalError = "403_forbidden";
        else if (response.status === 429) finalError = "429_rate_limit";
        else finalError = `http_${response.status}`;
        return null;
      }
      let payload = null;
      try { payload = bodyText ? JSON.parse(bodyText) : null; } catch { finalError = "invalid_response"; return null; }
      if (payload?.error) { finalError = String(payload.error || "invalid_response"); return null; }
      const normalized = normalizeProviderQuote(symbol, payload, "Finnhub", "LIVE");
      if (!normalized) finalError = "invalid_response";
      return normalized;
    } catch (error) {
      const msg = String(error?.message || "");
      finalError = msg.toLowerCase().includes("aborted") ? "timeout" : "invalid_response";
      console.error("FINNHUB_ERROR:", { symbol, reason: msg });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }));

  const quotes = rows.filter(Boolean);
  if (quotes.length) {
    return {
      status: "live",
      source: "Finnhub",
      error: null,
      testSymbols,
      quotes,
      confidence: quotes.length >= 3 ? "HIGH" : "MEDIUM",
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
  // 重构：从每个符号2次请求 → 单次批量 /quote 请求
  // 原因：原实现对6个符号发12次请求，在 Vercel 10s 限制内必然超时或耗尽配额
  // TwelveData /quote 支持逗号分隔批量，1次请求返回所有符号数据
  // 同时移除免费档不支持的 CL=F/BZ=F（twelveDataSymbol 返回 null 跳过）
  const token = envValue("TWELVEDATA_API_KEY");
  if (!token) return { data: [], status: "unavailable", label: "TwelveData", error: "TWELVEDATA_API_KEY is not configured" };

  // 只取 twelveDataSymbol 有映射的符号（跳过 null）
  const candidates = ["NDX", "VIX", "DXY", "GOLD", "SPY", "QQQ"];
  const pairs = candidates
    .map(s => ({ orig: s, td: twelveDataSymbol(s) }))
    .filter(p => p.td !== null && p.td);

  if (!pairs.length) {
    return { data: [], status: "unavailable", label: "TwelveData", error: "no_valid_symbols" };
  }

  const batchSymbol = pairs.map(p => p.td).join(",");
  const startedAt = Date.now();

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(batchSymbol)}&apikey=${encodeURIComponent(token)}`;
    const payload = await fetchJsonWithDebug("TWELVEDATA_BATCH", url, { timeoutMs: 5000 });
    const latencyMs = Date.now() - startedAt;

    // 批量返回时顶层是 { "NDX": {...}, "VIX": {...} }
    // 单个返回时顶层直接是 quote 对象（有 symbol 字段）
    const isSingle = payload && typeof payload.symbol === "string";
    const quoteMap = isSingle
      ? { [payload.symbol]: payload }
      : (payload || {});

    const rows = pairs.map(({ orig, td }) => {
      const q = quoteMap[td] || quoteMap[orig];
      if (!q || q.status === "error") {

        return lastGoodTwelveDataQuotes.get(orig) || null;
      }
      const price = Number(q.close || q.price || q.previous_close);
      if (!Number.isFinite(price) || price <= 0) {
        return lastGoodTwelveDataQuotes.get(orig) || null;
      }
      const normalized = normalizeProviderQuote(orig, { ...q, price, close: price }, "TwelveData", "DELAYED");
      if (normalized) lastGoodTwelveDataQuotes.set(orig, normalized);
      return normalized;
    }).filter(Boolean);

    return rows.length
      ? { data: rows, status: "delayed", label: "TwelveData", latency: latencyMs, confidence: "MEDIUM", fallback: false }
      : { data: [], status: "delayed", label: "TwelveData", error: "TwelveData returned no usable quotes", confidence: "LOW", fallback: true };

  } catch (error) {
    console.error("TWELVEDATA BATCH ERROR:", { reason: error.message, latencyMs: Date.now() - startedAt });
    // 用上次缓存的数据兜底
    const fallback = candidates.map(s => lastGoodTwelveDataQuotes.get(s)).filter(Boolean);
    return fallback.length
      ? { data: fallback, status: "cached", label: "TwelveData", error: error.message, confidence: "LOW", fallback: true }
      : { data: [], status: "unavailable", label: "TwelveData", error: error.message, confidence: "LOW", fallback: true };
  }
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
  const [headerLine, line] = (await response.text()).trim().split(/\r?\n/);
  const row = parseStooqCsvRow(headerLine, line);
  if (!row) return null;
  const price = Number(row.close);
  if (!Number.isFinite(price) || price <= 0) return null;
  const percentChange = parseStooqPercent(row.percent);
  const change = Number.isFinite(percentChange) ? percentChange : 0;
  return {
    symbol,
    price,
    change,
    regularChange: change,
    changeQuality: Number.isFinite(percentChange) ? "percent" : "unknown",
    volume: Number(row.volume) || 0,
    averageVolume: Number(row.volume) || 0
  };
}

async function fetchAlphaVantageQuote(symbol) {
  const token = envValue("ALPHAVANTAGE_API_KEY");
  if (!token) return null;
  if (symbol === "GC=F" || symbol === "GOLD") {
    const payload = await fetchJson(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${encodeURIComponent(token)}`, { timeoutMs: 4000 });
    const row = payload["Realtime Currency Exchange Rate"];
    const price = Number(row?.["5. Exchange Rate"]);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { symbol, price, change: 0, regularChange: 0, volume: 0, averageVolume: 0, dataStatus: "DELAYED", provider: "AlphaVantage" };
  }
  if (symbol === "^TNX" || symbol === "TNX") {
    const payload = await fetchJson(`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 4000 });
    const latest = Array.isArray(payload.data) ? payload.data.find((item) => Number.isFinite(Number(item.value))) : null;
    const previous = Array.isArray(payload.data) ? payload.data.find((item) => item !== latest && Number.isFinite(Number(item.value))) : null;
    const price = Number(latest?.value);
    const prev = Number(previous?.value);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { symbol, price, change: Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0, regularChange: 0, volume: 0, averageVolume: 0, dataStatus: "DELAYED", provider: "AlphaVantage" };
  }
  const alphaSymbol = symbol === "DX-Y.NYB" ? "DXY" : symbol === "GOLD" ? "XAUUSD" : symbol.replace(/^\^/, "");
  if (!/^[A-Z.]+$/.test(alphaSymbol)) return null;
  const payload = await fetchJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(alphaSymbol)}&apikey=${encodeURIComponent(token)}`, { timeoutMs: 4000 });
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
    const routedIndex = fallbackMarketMap.get(id);
    if (routedIndex?.id === id) return routedIndex;
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
      if (fallback) return { ...fallback, note: "缓存快照 · 最近有效数据", status: "cached", dataQuality: "cached", isTradable: false };
      return { ...metric(id, MARKET_INDEX_META[id] || id, null, null, "结构参考", "unavailable"), fallback: true, error: "source_failed" };
    }
    const baseName = fallback?.name || MARKET_INDEX_META[id] || id;
    return metric(id, baseName, row.price ?? fallback?.value ?? null, row.change ?? fallback?.change ?? null, `${row.dataStatus} · ${row.provider || "行情适配器"}。`, row.dataStatus);
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
  const indexRouteContext = {
    finnhubMap: new Map((providerRows.finnhub || []).map((item) => [item.symbol, item])),
    twelveMap: new Map((providerRows.twelveData || []).map((item) => [item.symbol, item])),
    fredMap: new Map(fredMarketRows(providerRows.fred || []).map((item) => [item.symbol, item])),
    alphaMacroMap: new Map(alphaMacroMarketRows(providerRows.alphaMacro || null).map((item) => [item.symbol, item])),
    tradingViewMap: new Map((providerRows.tradingView || []).map((item) => [item.symbol, normalizeTradingViewQuote(item)]).filter(([, row]) => row))
  };
  const [fallbackMarketRows, fallbackStockRows] = snapshotRuntimeMode === "fast"
    ? await Promise.all([
        Promise.all(marketEntries.map(async ([id]) => [id, await fetchIndexWithFallback(id, indexRouteContext)])),
        Promise.resolve(quoteSymbols.map((symbol) => [symbol, null]))
      ])
    : await Promise.all([
        Promise.all(marketEntries.map(async ([id]) => [id, await fetchIndexWithFallback(id, indexRouteContext)])),
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
  const hasLiveIndex = merged.indices.some((item) => normalizeDataQuality(item.dataQuality || item.status) === "live" && validIndexValue(item.value));
  const hasDelayedIndex = merged.indices.some((item) => normalizeDataQuality(item.dataQuality || item.status) === "delayed" && validIndexValue(item.value));
  const hasCachedIndex = merged.indices.some((item) => ["cached", "stale"].includes(normalizeDataQuality(item.dataQuality || item.status)) && validIndexValue(item.value));
  const provider = hasFinnhub ? "Finnhub" : hasTwelve ? "TwelveData" : hasDelayedIndex ? "Index Router" : hasCachedIndex ? "lastKnownGood" : "Fallback Cache";
  const status = hasFinnhub || hasLiveIndex ? "live" : hasTwelve || hasDelayedIndex ? "delayed" : hasCachedIndex ? "cached" : "snapshot";
  const fallback = !hasFinnhub && !hasTwelve && !hasLiveIndex && !hasDelayedIndex;
  const confidence = hasFinnhub || hasLiveIndex ? "HIGH" : hasTwelve || hasDelayedIndex ? "MEDIUM" : "LOW";
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
    timeoutMs: 3200,
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
  // Reddit 的 *.reddit.com/*.json 对数据中心 IP(Vercel)几乎一律 403。
  // 优先用对服务器 IP 友好的镜像/RSS 端点,再降级回官方 JSON。
  // 每个端点用统一的解析器抽取标题文本,计算 ticker 提及与情绪。
  const jsonEndpoints = [
    "https://www.reddit.com/r/wallstreetbets/hot.json?limit=50&raw_json=1",
    "https://old.reddit.com/r/wallstreetbets/hot.json?limit=50&raw_json=1"
  ];
  // RSS 端点:Reddit 的 .rss 通常比 .json 对服务器 IP 宽松
  const rssEndpoints = [
    "https://www.reddit.com/r/wallstreetbets/hot.rss?limit=50",
    "https://www.reddit.com/r/wallstreetbets/.rss?limit=50"
  ];

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Accept: "application/json,text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9"
  };

  const scoreTitles = (titles, provider) => {
    if (!titles.length) throw new Error("Reddit empty feed");
    const tickers = {};
    let toneScore = 50;
    for (const title of titles) {
      const text = String(title || "").toUpperCase();
      for (const symbol of Object.keys(symbolMeta)) {
        const pattern = new RegExp(`(^|[^A-Z])${symbol}([^A-Z]|$)`, "i");
        if (pattern.test(text)) tickers[symbol] = (tickers[symbol] || 0) + 1;
      }
      const lower = text.toLowerCase();
      if (/(call|calls|moon|bull|buy|yolo|beat|breakout|squeeze|rip)/.test(lower)) toneScore += 1.6;
      if (/(put|puts|bear|sell|short|miss|dump|crash|tank)/.test(lower)) toneScore -= 1.4;
    }
    const mentions = Object.entries(tickers).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const score = clamp(Math.round(toneScore));
    return {
      score,
      tone: score >= 62 ? "偏乐观" : score <= 42 ? "偏谨慎" : "中性",
      mentions,
      summary: score >= 62 ? "WSB 风险偏好回升，高 beta 与 AI 讨论活跃。" : "WSB 情绪未形成一致追涨，短线偏观察。",
      provider
    };
  };

  let lastError = null;

  // 1) RSS 优先(对服务器 IP 更宽松)
  for (const endpoint of rssEndpoints) {
    try {
      const rss = await fetchText(endpoint, browserHeaders);
      const titles = [...rss.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)]
        .map((m) => stripXml(m[1]))
        .filter((t) => t && !/^r\/wallstreetbets/i.test(t));
      return scoreTitles(titles, "reddit-rss");
    } catch (error) {
      lastError = error;
    }
  }

  // 2) 降级回官方 JSON
  for (const endpoint of jsonEndpoints) {
    try {
      const payload = await fetchJson(endpoint, { timeoutMs: 2800, headers: browserHeaders });
      const posts = payload.data?.children?.map((item) => item.data) || [];
      if (!posts.length) throw new Error("Reddit empty feed");
      const titles = posts.map((p) => `${p.title || ""} ${p.selftext || ""}`);
      return scoreTitles(titles, endpoint.includes("old.reddit") ? "old.reddit" : "reddit-json");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Reddit upstream unavailable");
}

// 旧版 JSON-only 解析路径已废弃,保留下方变量以防其他引用(无副作用)。
async function _loadRedditLegacy() {
  const endpoints = [];
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(endpoint, { timeoutMs: 2400 });
      const posts = payload.data?.children?.map((item) => item.data) || [];
      if (!posts.length) throw new Error("Reddit empty feed");
      const tickers = {};
      let toneScore = 50;
      for (const post of posts) {
        const text = `${post.title || ""} ${post.selftext || ""}`.toUpperCase();
        for (const symbol of Object.keys(symbolMeta)) {
          const pattern = new RegExp(`(^|[^A-Z])${symbol}([^A-Z]|$)`, "i");
          if (pattern.test(text)) tickers[symbol] = (tickers[symbol] || 0) + 1;
        }
        const lower = text.toLowerCase();
        if (/(call|calls|moon|bull|buy|yolo|beat|breakout)/.test(lower)) toneScore += 1.6;
        if (/(put|puts|bear|sell|short|miss|dump)/.test(lower)) toneScore -= 1.4;
      }
      const mentions = Object.entries(tickers).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const score = clamp(Math.round(toneScore));
      return {
        score,
        tone: score >= 62 ? "偏乐观" : score <= 42 ? "偏谨慎" : "中性",
        mentions,
        summary: score >= 62 ? "WSB 风险偏好回升，高 beta 与 AI 讨论活跃。" : "WSB 情绪未形成一致追涨，短线偏观察。",
        provider: endpoint.includes("old.reddit") ? "old.reddit" : "reddit"
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Reddit upstream unavailable");
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
    const payload = await fetchJsonWithDebug("BENZINGA_NEWS", url, { timeoutMs: 4500 });
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
    // dowjones.io RSS 已 403，改用 WSJ Markets + MarketWatch 备用
    const feeds = [
      "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
      "https://www.marketwatch.com/rss/topstories",
      "https://feeds.content.dowjones.io/public/rss/mw_marketpulse"
    ];
    let rss = null;
    for (const feedUrl of feeds) {
      try { rss = await fetchText(feedUrl); if (rss && rss.includes("<item>")) break; }
      catch { rss = null; }
    }
    if (!rss) throw new Error("all_mw_feeds_failed");
    const items = normalizeNewsFeed(parseRssItems(rss, "MarketWatch"), "MarketWatch");
    if (!items.length) return { data: [], status: "unavailable", label: "MarketWatch", error: "no_realtime_news" };
    return { data: items, status: "delayed", label: "MarketWatch", error: null, fallback: false, confidence: "MEDIUM" };
  } catch (error) {
    return { data: [], status: "unavailable", label: "MarketWatch", error: error.message || "no_realtime_news", fallback: true, confidence: "LOW" };
  }
}

async function loadReutersNews() {
  // reutersagency.com feed was retired (404). Use Yahoo Finance + CNBC market RSS
  // as resilient business-news substitutes; first feed that returns items wins.
  const feeds = [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US",
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    "https://www.investing.com/rss/news_25.rss"
  ];
  for (const url of feeds) {
    try {
      const rss = await fetchText(url);
      const items = normalizeNewsFeed(parseRssItems(rss, "Reuters/Markets"), "Reuters/Markets");
      if (items.length) {
        return { data: items, status: "delayed", label: "Reuters/Markets", error: null, fallback: false, confidence: "MEDIUM" };
      }
    } catch (error) {
      console.error("[news] markets feed failed", { url, reason: error?.message || error });
    }
  }
  return { data: [], status: "unavailable", label: "Reuters/Markets", error: "no_realtime_news", fallback: true, confidence: "LOW" };
}

async function loadSecFilingsNews() {
  try {
    const atom = await fetchText("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-k&owner=include&count=40&output=atom", {
      // SEC EDGAR rejects generic agents (403). It requires a descriptive UA with contact info.
      "User-Agent": "AI Equity Flow Dashboard admin@example.com",
      Accept: "application/atom+xml,application/xml,text/xml,*/*"
    });
    const items = normalizeNewsFeed(parseRssItems(atom, "SEC Filing"), "SEC Filing");
    if (!items.length) return { data: [], status: "unavailable", label: "SEC Filing", error: "no_realtime_news" };
    return { data: items, status: "delayed", label: "SEC Filing", error: null, fallback: false, confidence: "MEDIUM" };
  } catch (error) {
    return { data: [], status: "unavailable", label: "SEC Filing", error: error.message || "no_realtime_news", fallback: true, confidence: "LOW" };
  }
}

async function loadFinnhubCompanyNews(symbols) {
  // 限制为 8 个核心 ticker（免费档 30req/min，20 并发必触发 429 导致全部失败）
  // 优先 AI 主线 + 大型科技，分批串行避免限速
  const token = envValue("FINNHUB_API_KEY");
  if (!token) return [];
  const PRIORITY = ["NVDA","MSFT","GOOGL","META","AMZN","AMD","AVGO","PLTR"];
  const tickers = [
    ...PRIORITY.filter(s => cleanSymbols(symbols).split(",").includes(s)),
    ...cleanSymbols(symbols).split(",").filter(s => symbolMeta[s] && !PRIORITY.includes(s))
  ].slice(0, 8);
  const to = new Date();
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (date) => date.toISOString().slice(0, 10);
  const results = [];
  for (const symbol of tickers) {
    try {
      const payload = await fetchJson(
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${encodeURIComponent(token)}`,
        { timeoutMs: 3500 }
      );
      if (Array.isArray(payload)) {
        results.push(...payload.slice(0, 2).map(item => ({ ...item, relatedSymbol: symbol })));
      }
    } catch {
      // 单个失败不影响其他
    }
  }
  return results;
}

async function loadFinnhubMarketNews() {
  const token = envValue("FINNHUB_API_KEY");
  if (!token) return [];
  try {
    const payload = await fetchJson(`https://finnhub.io/api/v1/news?category=general&token=${encodeURIComponent(token)}`, { timeoutMs: 4200 });
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
    const payload = await fetchJson(`https://finnhub.io/api/v1/calendar/earnings?token=${encodeURIComponent(token)}`, { timeoutMs: 4200 });
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

  if (!token) return { data: null, status: "unavailable", label: "AlphaVantage", error: "ALPHAVANTAGE_API_KEY is not configured" };
  try {
    const startedAt = Date.now();
    const [dgs10, dgs2, dgs30, sector] = await Promise.all([
      fetchJsonWithDebug("ALPHAVANTAGE_TREASURY_10Y", `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 4200 }).catch((error) => {
        console.error("ALPHAVANTAGE ERROR:", { function: "TREASURY_YIELD_10Y", reason: error.message });
        return null;
      }),
      fetchJsonWithDebug("ALPHAVANTAGE_TREASURY_2Y", `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=2year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 4200 }).catch((error) => {
        console.error("ALPHAVANTAGE ERROR:", { function: "TREASURY_YIELD_2Y", reason: error.message });
        return null;
      }),
      fetchJsonWithDebug("ALPHAVANTAGE_TREASURY_30Y", `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=30year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 4200 }).catch((error) => {
        console.error("ALPHAVANTAGE ERROR:", { function: "TREASURY_YIELD_30Y", reason: error.message });
        return null;
      }),
      fetchJsonWithDebug("ALPHAVANTAGE_SECTOR", `https://www.alphavantage.co/query?function=SECTOR&apikey=${encodeURIComponent(token)}`, { timeoutMs: 4200 }).catch((error) => {
        console.error("ALPHAVANTAGE ERROR:", { function: "SECTOR", reason: error.message });
        return null;
      })
    ]);
    if (!dgs10 && !dgs2 && !dgs30 && !sector) return { data: null, status: "delayed", label: "AlphaVantage", error: "AlphaVantage macro unavailable", latency: Date.now() - startedAt, confidence: "LOW", fallback: true };
    return { data: { dgs10, dgs2, dgs30, sector }, status: "delayed", label: "AlphaVantage", latency: Date.now() - startedAt, confidence: "MEDIUM", fallback: false };
  } catch (error) {
    console.error("ALPHAVANTAGE ERROR:", { reason: error.message, stack: error.stack || null });
    return { data: null, status: "delayed", label: "AlphaVantage", error: error.message, confidence: "LOW", fallback: true };
  }
}

async function loadFredMacro() {
  const token = envValue("FRED_API_KEY");

  if (!token) return { data: [], status: "unavailable", label: "FRED", error: "FRED_API_KEY is not configured" };
  const ids = ["FEDFUNDS", "DGS10", "DGS2", "DGS30", "UNRATE", "CPIAUCSL"];
  const startedAt = Date.now();
  const latencies = [];
  const data = await Promise.all(ids.map(async (id) => {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(id)}&api_key=${encodeURIComponent(token)}&file_type=json&sort_order=desc&limit=1`;
      const rowStart = Date.now();
      const payload = await fetchJsonWithDebug("FRED", url, { timeoutMs: 4200 });
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

async function fetchText(url, extraHeaders = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Institutional-Terminal/1.0)", Accept: "application/rss+xml,text/xml,text/plain,*/*", ...extraHeaders }
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.text();
}

function stripXml(value) {
  return String(value).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").trim();
}

// Removes internal build-progress metadata (e.g. `completion`) from the
// Market Structure Pro payload before it is exposed in the public snapshot.
// Returns a safe, shallow-cloned object; never throws on malformed input.
function stripInternalMarketStructure(structure) {
  if (!structure || typeof structure !== "object") return {};
  const { completion, ...publicFields } = structure;
  return publicFields;
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

function buildSectorHeat({ quotes = [], tradingView = [], marketStatus = "unavailable" } = {}) {
  const quoteMap = new Map((quotes || []).filter((item) => item?.symbol).map((item) => [item.symbol, item]));
  const tvMap = new Map((tradingView || []).filter((item) => item?.symbol).map((item) => [item.symbol, item]));
  const groups = [
    ["Technology", ["XLK", "MSFT", "AAPL", "META"]],
    ["Semiconductor", ["SMH", "SOXX", "NVDA", "AVGO", "AMD", "MRVL"]],
    ["AI Growth", ["NVDA", "AVGO", "AMD", "PLTR", "MSFT", "META"]],
    ["Financials", ["XLF", "JPM"]],
    ["Energy", ["XLE", "XOM", "CVX"]],
    ["Healthcare", ["XLV", "LLY"]],
    ["Consumer", ["XLY", "TSLA", "AMZN", "DASH"]],
    ["Small Caps", ["IWM"]],
    ["Crypto", ["COIN", "MSTR", "IBIT"]]
  ];
  const sectorRows = groups.map(([sector, symbols]) => {
    const observations = symbols.map((symbol) => {
      const quoteRow = quoteMap.get(symbol);
      const tvRow = tvMap.get(symbol);
      const change = Number(quoteRow?.preMarketChangePercent ?? quoteRow?.change ?? tvRow?.change ?? 0);
      const rv = Number(quoteRow?.relativeVolume ?? quoteRow?.volumeRatio ?? 1);
      const tvScore = Number(tvRow?.score || 50);
      return quoteRow || tvRow ? { symbol, change, rv, tvScore } : null;
    }).filter(Boolean);
    if (!observations.length) return null;
    const change = avg(observations.map((item) => item.change));
    const rv = avg(observations.map((item) => item.rv || 1));
    const tvScore = avg(observations.map((item) => item.tvScore || 50));
    const score = clamp(Math.round(50 + change * 8 + Math.min(rv, 3) * 7 + (tvScore - 50) * 0.25 + sectorThemeBonus(sector)));
    const leaders = observations.sort((a, b) => b.change - a.change).slice(0, 3).map((item) => item.symbol);
    return {
      sector,
      score,
      change,
      relativeVolume: rv,
      leaders,
      summary: `${leaders.join(" / ")} 驱动 ${sector} 热度，均值涨跌 ${change.toFixed(2)}%。`
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  const strongestSectors = sectorRows.slice(0, 5);
  const weakestSectors = [...sectorRows].sort((a, b) => a.score - b.score).slice(0, 3);
  const status = ["live", "delayed"].includes(String(marketStatus).toLowerCase()) && sectorRows.length ? marketStatus : sectorRows.length ? "delayed" : "unavailable";
  const leader = strongestSectors[0]?.sector || "无明显主线";
  const laggard = weakestSectors[0]?.sector || "无明显弱项";
  return {
    status,
    source: "Sector Heat Engine",
    confidence: status === "live" ? "HIGH" : status === "delayed" ? "MEDIUM" : "LOW",
    strongestSectors,
    weakestSectors,
    rotationType: sectorRows.length ? `${leader} 领先 / ${laggard} 落后` : "NO_VALID_SECTOR_DATA",
    explanation: sectorRows.length ? `${leader} 相对占优，${laggard} 承压，基于实时/延迟行情与 TradingView 动量推断。` : "暂无可用板块源，使用缓存策略维持结构。"
  };
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

function extractNewsCatalysts(news = [], earningsEvents = [], macroItems = []) {
  const fromNews = (news || [])
    .filter((item) => item?.ticker || /fed|cpi|treasury|rate|inflation|vix|nasdaq|s&p|dow|macro/i.test(`${item?.title || ""} ${item?.summary || ""}`))
    .map((item) => {
      const text = `${item.title || item.originalTitle || ""} ${item.summary || ""}`;
      const type = detectCatalystType(text);
      return {
        symbol: item.ticker || "MACRO",
        catalystType: type,
        sentiment: item.bias || item.tone || classifyCatalystSentiment(text),
        importance: catalystImportance(type, text),
        chineseSummary: item.summary || rewriteNewsSummary(item.ticker, type, item.bias || "NEUTRAL"),
        reason: item.title || item.originalTitle || "结构化新闻催化"
      };
    });
  const fromEarnings = (earningsEvents || []).slice(0, 8).map((item) => ({
    symbol: item.symbol,
    catalystType: "Earnings",
    sentiment: "NEUTRAL",
    importance: item.importance || 60,
    chineseSummary: `${item.symbol} 财报窗口临近，注意开盘波动与隐含波动率变化。`,
    reason: item.catalystTag || "earnings calendar"
  }));
  const fromMacro = (macroItems || []).slice(0, 4).map((item) => ({
    symbol: "MACRO",
    catalystType: "Macro",
    sentiment: String(item.tone || "").toUpperCase() === "BEARISH" ? "BEARISH" : String(item.tone || "").toUpperCase() === "BULLISH" ? "BULLISH" : "NEUTRAL",
    importance: 55,
    chineseSummary: item.summary || item.title || "宏观变量进入盘前定价。",
    reason: item.title || "macro headline"
  }));
  return [...fromNews, ...fromEarnings, ...fromMacro]
    .filter((item) => item.symbol && item.catalystType)
    .sort((a, b) => Number(b.importance || 0) - Number(a.importance || 0))
    .slice(0, 20);
}

function detectCatalystType(text = "") {
  const lower = text.toLowerCase();
  if (/earnings|revenue|eps|results|report/.test(lower)) return "Earnings";
  if (/guidance|forecast|outlook/.test(lower)) return "Guidance";
  if (/upgrade|downgrade|price target|rating|analyst/.test(lower)) return "Analyst Rating";
  if (/ai|nvidia|gpu|data center|semiconductor|chip/.test(lower)) return "AI Theme";
  if (/fed|cpi|treasury|yield|rates|inflation|macro/.test(lower)) return "Macro";
  if (/fda|trial|drug|phase/.test(lower)) return "FDA";
  if (/merger|acquisition|m&a|buyout/.test(lower)) return "M&A";
  if (/sec|lawsuit|investigation|regulation|tariff/.test(lower)) return "Regulation";
  if (/meme|reddit|wsb|wallstreetbets/.test(lower)) return "Meme";
  return "Unknown";
}

function classifyCatalystSentiment(text = "") {
  const lower = text.toLowerCase();
  if (/beat|raise|upgrade|growth|demand|contract|approval|launch/.test(lower)) return "BULLISH";
  if (/miss|cut|downgrade|lawsuit|investigation|weak|delay|warning|loss/.test(lower)) return "BEARISH";
  return "NEUTRAL";
}

function catalystImportance(type, text = "") {
  const base = {
    Earnings: 78,
    Guidance: 76,
    "Analyst Rating": 70,
    "AI Theme": 68,
    Macro: 66,
    FDA: 70,
    "M&A": 74,
    Regulation: 65,
    Meme: 55,
    Unknown: 45
  }[type] || 45;
  return clamp(base + (/nvda|spy|qqq|tsla|amd|pltr|coin|mstr/i.test(text) ? 6 : 0));
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
    status: signals.length ? (context.marketStatus === "live" && context.relativeVolumeStatus === "live" ? "live" : "delayed") : "unavailable",
    source: "Options Signal System",
    confidence: signals.length ? (context.marketStatus === "live" ? "MEDIUM" : "LOW") : "LOW",
    label: "Options Signal Proxy",
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
    reason: optionsSignalSummary(stock, bucket, { preChange, relativeVolume, qqq, spy, vix, newsBias }),
    summary: optionsSignalSummary(stock, bucket, { preChange, relativeVolume, qqq, spy, vix, newsBias }),
    risk: optionsSignalRisk(bucket, { preChange, relativeVolume, vix }),
    setup: optionsSignalSetup(bucket, stock, { relativeVolume, qqq, spy }),
    invalidation: optionsSignalInvalidation(bucket, { qqq, spy, vix })
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

function optionsSignalSetup(bucket, stock, data) {
  if (bucket === "CALL") return "开盘后站上 VWAP 且 RVOL 延续扩张，再考虑顺势 CALL 观察。";
  if (bucket === "PUT") return "跌破开盘区间或反抽 VWAP 失败，再考虑 PUT / hedge 观察。";
  if (bucket === "AVOID") return "等待价格回到 VWAP 附近重新确认，不追第一波。";
  return "仅加入观察名单，等待价格、量能与指数方向同步。";
}

function optionsSignalInvalidation(bucket, data) {
  if (bucket === "CALL") return "QQQ 转弱或标的跌回 VWAP 下方，CALL 方向失效。";
  if (bucket === "PUT") return "QQQ/SPY 同步转强或 VIX 回落，PUT 方向降权。";
  return "无量突破、价量背离或指数反向时取消交易计划。";
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
  const gold = byId.GOLD?.change || 0;
  if (qqq > 0 && vix < 0 && dxy <= 0.15 && Math.abs(tnx) < 1.2) return { mode: "Risk-On", score: 72 };
  if (vix > 0 && dxy > 0 && tnx > 0 && qqq < 0) return { mode: "Risk-Off", score: 34 };
  const score = clamp(Math.round(50 + qqq * 10 - vix * 4 - Math.max(0, dxy) * 4 - Math.max(0, tnx) * 2 - Math.max(0, gold) * 1.2));
  return { mode: score >= 56 ? "Risk-On" : score <= 44 ? "Risk-Off" : "Neutral", score };
}

export async function buildSnapshot(req) {
  const generatedAt = Date.now();
  snapshotRuntimeStartedAt = generatedAt;
  const modeParam = String(req?.query?.mode || req?.query?.deep || "").toLowerCase();
  snapshotRuntimeMode = modeParam === "deep" || modeParam === "1" || modeParam === "true" ? "deep" : "fast";
  const persistentSnapshot = await hydratePersistentCache();

  // ── SWR Short-circuit: serve cached snapshot immediately if it's fresh enough ──
  // Tier 1 (≤60s): serve from Upstash/memory without hitting any upstream APIs.
  // Tier 2 (≤300s / snapshotRuntimeMode=fast): serve from cache, trigger background hydrate.
  // Tier 3 (>300s or mode=deep): full live fetch from all upstream sources.
  const forceRefresh = modeParam === "deep" || String(req?.query?.refresh || "").toLowerCase() === "1";
  const SWR_FRESH_TTL_MS = 60 * 1000;       // 60s — serve directly, zero upstream calls
  const SWR_STALE_TTL_MS = 5 * 60 * 1000;   // 5min — serve from cache while config=fast
  if (!forceRefresh && persistentSnapshot?.generatedAt) {
    const cacheAgeMs = generatedAt - Number(persistentSnapshot.generatedAt);
    if (cacheAgeMs < SWR_FRESH_TTL_MS) {
      // Cache is ≤60s old: return immediately, no upstream I/O
      return { ...persistentSnapshot, servedFrom: "swr-fresh", cacheAgeMs, cacheAdapter: cacheAdapter.type };
    }
    if (cacheAgeMs < SWR_STALE_TTL_MS && snapshotRuntimeMode === "fast") {
      // Cache is ≤5min old and caller didn't request deep refresh: serve stale, trigger background refresh
      // (background refresh runs after response is sent; Vercel waitUntil not available on Hobby,
      //  so we just serve stale — next request will get fresh data)
      return { ...persistentSnapshot, servedFrom: "swr-stale", cacheAgeMs, cacheAdapter: cacheAdapter.type };
    }
  }

  const defaultSymbols = "SPY,QQQ,NVDA,AMD,AVGO,MRVL,MSFT,AMZN,META,TSLA,PLTR,ORCL,CRWD,COIN,MSTR,DASH,CSCO,LLY,AAPL,XLK,SMH,SOXX,XLF,XLE,XLV,XLY,XLP,XLI,XLB,XLU,XLRE,XLC,IWM,IBIT,CL=F,BZ=F";
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
    settleSource("reddit", loadReddit, generatedAt, { score: 50, tone: "中性", mentions: [["NVDA",0],["AMD",0],["PLTR",0],["MSFT",0]], summary: "Reddit 实时源暂不可用，使用本地代理热度。", dataQuality: "proxy" }),
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

  let sectorHeatData = { status: "unavailable", source: "Sector Heat Engine", confidence: "LOW", strongestSectors: [], weakestSectors: [], rotationType: "NO_VALID_SECTOR_DATA", explanation: "暂无可用板块源，使用缓存策略维持结构。", error: "not_generated" };
  let sectorData = [];
  try {
    sectorHeatData = buildSectorHeat({
      quotes,
      tradingView: tradingView.data || [],
      marketStatus: marketData.status || "unavailable"
    });
    sectorData = sectorHeatData.strongestSectors?.length
      ? sectorHeatData.strongestSectors.map((item) => ({
          sector: item.sector,
          score: item.score,
          change: item.change,
          summary: item.summary
        }))
      : deriveSectors(quotes);
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] sectorHeat", error?.message || error);
    sectorHeatData.error = error?.message || "source_failed";
    sectorData = deriveSectors(quotes);
  }
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
  const premarketMomentumLayer = stableModuleSource("premarketMomentum", source("premarketMomentum", premarketMomentumData, premarketMomentumData.status, generatedAt, "Premarket Momentum Engine", {
    confidence: premarketMomentumData.confidence,
    fallback: false,
    error: premarketMomentumData.error || null,
    sourcePlan: sourcePlanFor("premarketMomentum")
  }));
  let optionsSignalData = { status: "unavailable", callCandidates: [], putCandidates: [], watchOnly: [], avoidChasing: [], cards: [], error: "no_realtime_quotes" };
  try {
    optionsSignalData = quotes.length ? deriveOptionsSignalSystem(quotes, {
      sectors: sectorData,
      sectorHeat: sectorHeatData,
      tradingView: tradingView.data || [],
      news,
      relativeVolume: relativeVolumeLayer.data?.leaders || [],
      relativeVolumeStatus: relativeVolumeLayer.status,
      momentum: premarketMomentumData.leaders || [],
      indices: marketData.data?.indices || [],
      marketStatus: marketData.status || "unavailable"
    }) : optionsSignalData;
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] optionsSignals", error?.message || error);
    optionsSignalData.error = error?.message || "source_failed";
  }
  let newsCatalysts = [];
  try {
    newsCatalysts = extractNewsCatalysts(news, earningsLayer.data?.events || [], []);
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] newsCatalysts", error?.message || error);
  }
  const riskRegime = calculateRiskRegime(marketData.data?.indices || []);
  const marketBreadthData = buildMarketBreadth({
    quotes,
    sectors: sectorData,
    indices: marketData.data?.indices || [],
    status: marketData.status === "live" ? "live" : marketData.status === "delayed" ? "delayed" : "stale"
  });
  const marketBreadthLayer = await settleSource("marketBreadth", async () => marketBreadthData, generatedAt, {}, "Market Breadth Engine");
  let marketStructureProData = { status: "unavailable", source: "Market Structure Pro", error: "not_generated" };
  try {
    marketStructureProData = buildMarketStructurePro({
      quotes,
      sectors: sectorData,
      indices: marketData.data?.indices || [],
      fredRows: fredMacro.data || [],
      alphaMacro: alphaMacro.data || null,
      marketBreadth: marketBreadthLayer.data || marketBreadthData,
      marketRegime: riskRegime
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] marketStructurePro", error?.message || error);
    marketStructureProData = { status: "unavailable", source: "Market Structure Pro", error: error?.message || "source_failed" };
  }
  if (marketStructureProData && typeof marketStructureProData === "object") {
    delete marketStructureProData.completion;
  }
  const marketStructureProSource = stableModuleSource("marketStructurePro", source("marketStructurePro", marketStructureProData, marketStructureProData.status || "delayed", generatedAt, "Market Structure Pro", {
    confidence: marketStructureProData.confidence || "MEDIUM",
    error: marketStructureProData.error || null,
    sourcePlan: sourcePlanFor("marketStructurePro")
  }));
  let premarketScanner = [];
  try {
    premarketScanner = runPremarketScanner({
      quotes,
      news,
      earnings: [],
      insider: [],
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
      earnings: [],
      insider: [],
      relativeVolume: relativeVolumeLayer.data?.leaders || []
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] signalEngine", error?.message || error);
  }

  const finviz = stableModuleSource("finviz", source("finviz", sectorData, sectorData.length ? "delayed" : "unavailable", generatedAt, "Sector Heat Proxy", {
    error: sectorData.length ? null : "source_data_unavailable",
    confidence: sectorHeatData.confidence,
    fallback: false,
    sourcePlan: sourcePlanFor("sectorHeat")
  }));
  const aggregateNewsStatus = selectedNewsSource ? selectedNewsSource.source.status || "delayed" : "unavailable";
  const aggregateNewsConfidence = selectedNewsSource?.source?.confidence || (aggregateNewsStatus === "live" ? "HIGH" : aggregateNewsStatus === "delayed" ? "MEDIUM" : "LOW");
  const benzinga = stableModuleSource("benzinga", source("benzinga", { movers: moverData, news }, aggregateNewsStatus, generatedAt, "News Aggregator", {
    error: selectedNewsSource ? null : "no_realtime_news",
    confidence: aggregateNewsConfidence,
    fallback: !selectedNewsSource,
    sourcePlan: sourcePlanFor("newsAggregator")
  }));
  const unusualWhales = stableModuleSource("unusualWhales", source("unusualWhales", optionsSignalData, optionsSignalData.cards?.length ? optionsSignalData.status : "unavailable", generatedAt, "Options Signal System", {
    error: optionsSignalData.cards?.length ? null : (optionsSignalData.error || "insufficient_realtime_quotes"),
    confidence: optionsSignalData.confidence,
    sourcePlan: sourcePlanFor("optionsSignals")
  }));
  const xMacro = stableModuleSource("xMacro", source("xMacro", [
    { source: "Macro Monitor", title: `${riskRegime.mode} 结构监控`, summary: riskRegime.mode === "Risk-On" ? "QQQ、VIX、DXY 与 TNX 组合支持科技风险偏好。" : "宏观变量仍需观察，避免无量追高。", tone: riskRegime.mode === "Risk-Off" ? "bearish" : "bullish" }
  ], "delayed", generatedAt, "Macro Risk Proxy", {
    sourcePlan: sourcePlanFor("xMacro")
  }));
  const normalizedMarketDataSource = {
    ...marketData,
    provider: marketData.provider || marketData.data?.provider || "Fallback Cache",
    indices: marketData.indices || marketData.data?.indices || [],
    quotes: marketData.quotes || marketData.data?.quotes || []
  };
  const newsAggregator = stableModuleSource("newsAggregator", source("newsAggregator", { movers: moverData, news }, aggregateNewsStatus, generatedAt, "News Aggregator", {
    error: selectedNewsSource ? null : "no_realtime_news",
    confidence: aggregateNewsConfidence,
    fallback: !selectedNewsSource,
    sourcePlan: sourcePlanFor("newsAggregator")
  }));
  const sectorHeatSource = stableModuleSource("sectorHeat", source("sectorHeat", sectorHeatData, sectorHeatData.status, generatedAt, "Sector Heat Engine", {
    confidence: sectorHeatData.confidence,
    error: sectorHeatData.error || null,
    sourcePlan: sourcePlanFor("sectorHeat")
  }));
  const newsCatalystsSource = stableModuleSource("newsCatalysts", source("newsCatalysts", newsCatalysts, newsCatalysts.length ? aggregateNewsStatus : "unavailable", generatedAt, "News Catalyst Engine", {
    confidence: newsCatalysts.length ? aggregateNewsConfidence : "LOW",
    error: newsCatalysts.length ? null : "no_realtime_catalysts",
    sourcePlan: sourcePlanFor("newsAggregator")
  }));
  const optionsSignalsSource = stableModuleSource("optionsSignals", source("optionsSignals", optionsSignalData, optionsSignalData.status, generatedAt, "Options Signal Proxy", {
    confidence: optionsSignalData.confidence,
    error: optionsSignalData.error || null,
    sourcePlan: sourcePlanFor("optionsSignals")
  }));
  let confidenceScore = { dataConfidence: "LOW", signalConfidence: "LOW", tradeConfidence: "LOW", score: 0, detail: [] };
  try {
    confidenceScore = buildConfidenceScore({
      marketData: normalizedMarketDataSource,
      premarketMomentum: premarketMomentumLayer,
      marketBreadth: marketBreadthLayer,
      tradingView,
      relativeVolume: relativeVolumeLayer,
      sectorHeat: sectorHeatSource,
      newsCatalysts: newsCatalystsSource,
      optionsSignals: optionsSignalsSource
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] confidenceScore", error?.message || error);
  }
  let marketRegime = {
    type: riskRegime.mode === "Risk-On" ? "RISK_ON" : riskRegime.mode === "Risk-Off" ? "RISK_OFF" : "NEUTRAL",
    score: riskRegime.score ?? null,
    explanation: riskRegime.reason || "市场结构引擎同步中，保留基础风险判断。",
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
  let tradeDecision = {
    grade: "C",
    score: 50,
    direction: "WAIT",
    permission: "只看不做",
    actionBias: "等待确认",
    title: "C｜等待确认",
    summary: "等待开盘量价确认。",
    targets: [],
    focus: [],
    avoid: ["无量高开不追。"],
    checklist: []
  };
  try {
    tradeDecision = buildTradeDecision({
      marketRegime,
      riskRegime,
      strategySummary,
      tradePlan,
      watchlist,
      signalEngine,
      marketStructurePro: stripInternalMarketStructure(marketStructureProSource.data || marketStructureProData || {}),
      marketBreadth: marketBreadthLayer.data || marketBreadthData || {},
      premarketMomentum: premarketMomentumLayer.data || premarketMomentumData || {},
      relativeVolume: relativeVolumeLayer.data || {},
      marketData: normalizedMarketDataSource.data || { indices: normalizedMarketDataSource.indices || [], quotes: normalizedMarketDataSource.quotes || [] },
      newsCatalysts: newsCatalystsSource.data || newsCatalysts || {},
      optionsSignals: optionsSignalsSource.data || optionsSignalData || [],
      confidenceScore,
      scanner: premarketScanner || []
    });
  } catch (error) {
    console.error("[SNAPSHOT ENGINE ERROR] tradeDecision", error?.message || error);
  }
  const tradeDecisionSource = source("tradeDecision", tradeDecision, normalizedMarketDataSource.status === "live" ? "live" : normalizedMarketDataSource.status === "delayed" ? "delayed" : "proxy", generatedAt, "Trade Decision Engine", {
    confidence: tradeDecision.confidence || confidenceScore.tradeConfidence,
    fallback: false
  });

  const decisionEngine = source("decisionEngine", {
    strategySummary,
    marketRegime,
    tradePlan,
    tradeDecision,
    watchlist,
    confidenceScore
  }, normalizedMarketDataSource.status === "live" ? "live" : normalizedMarketDataSource.status === "delayed" ? "delayed" : "unavailable", generatedAt, "Decision Engine", {
    confidence: confidenceScore.tradeConfidence,
    fallback: false
  });

  const snapshot = {
    generatedAt,
    runtimeMode: snapshotRuntimeMode,
    runtimeBudgetMs: snapshotRuntimeMode === "fast" ? 9000 : 25000,
    envDebug: envDebug(),
    lastKnownGood: {
      adapter: cacheAdapter.type,
      generatedAt: lastGoodSnapshot?.generatedAt || persistentSnapshot?.generatedAt || null,
      marketData: lastGoodSnapshot?.marketData || null,
      indices: lastGoodIndices(),
      quotes: lastGoodQuotes(),
      sources: lastGoodSnapshot?.sources || null
    },
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
    marketStructurePro: stripInternalMarketStructure(marketStructureProSource.data || marketStructureProData || {}),
    yieldCurve: marketStructureProData.yieldCurve || {},
    oil: marketStructureProData.oil || {},
    fedWatch: marketStructureProData.fedWatch || {},
    breadthPro: marketStructureProData.breadthPro || {},
    sectors: sectorData,
    sectorHeat: sectorHeatSource.data || sectorHeatData,
    newsCatalysts: newsCatalystsSource.data || newsCatalysts,
    optionsSignals: optionsSignalsSource.data || optionsSignalData,
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
    tradeDecision,
    watchlist,
    confidenceScore,
    layers: {
      realtimeQuotes: {
        sourcePriority: ["Finnhub", "TwelveData", "Fallback Cache"],
        confidence: finnhubProbe.status === "live" || twelveData.status === "delayed" ? "中高" : "低",
        freshness: nowIso(generatedAt)
      },
      marketStructure: marketBreadthLayer.data || marketBreadthData,
      marketStructurePro: marketStructureProSource.data || marketStructureProData,
      yieldCurve: marketStructureProData.yieldCurve || {},
      oil: marketStructureProData.oil || {},
      fedWatch: marketStructureProData.fedWatch || {},
      breadthPro: marketStructureProData.breadthPro || {},
      earnings: earningsLayer.data || { events: [] },
      insider: insiderLayer.data || { signals: [] },
      relativeVolume: relativeVolumeLayer.data || { leaders: [] },
      sectorHeat: sectorHeatSource.data || sectorHeatData,
      premarketMomentum: premarketMomentumData,
      institutionalBehavior: {
        insider: insiderLayer.data?.signals || insider.data || [],
        earnings: earningsLayer.data?.events || earnings.data || [],
        confidence: insiderLayer.status === "delayed" || earningsLayer.status === "delayed" ? "中" : "低"
      },
      newsCatalyst: {
        topSource: selectedNewsSource ? selectedNewsSource.name : "none",
        total: news.length,
        catalysts: newsCatalystsSource.data || newsCatalysts,
        status: selectedNewsSource ? (selectedNewsSource.source.status || "delayed") : "no_realtime_news",
        error: selectedNewsSource ? null : "no_realtime_news"
      },
      optionsSignals: optionsSignalsSource.data || optionsSignalData,
      strategySummary,
      marketRegime,
      tradePlan,
      tradeDecision,
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
        marketStructurePro: marketStructureProSource,
        yieldCurve: source("yieldCurve", marketStructureProData.yieldCurve || {}, marketStructureProData.yieldCurve?.status || "proxy", generatedAt, "Yield Curve Pro", { confidence: marketStructureProData.yieldCurve?.confidence || "LOW" }),
        oilLayer: source("oilLayer", marketStructureProData.oil || {}, marketStructureProData.oil?.status || "proxy", generatedAt, "Oil Market Layer", { confidence: marketStructureProData.oil?.confidence || "LOW" }),
        fedWatch: source("fedWatch", marketStructureProData.fedWatch || {}, marketStructureProData.fedWatch?.status || "proxy", generatedAt, "FedWatch Proxy", { confidence: marketStructureProData.fedWatch?.confidence || "LOW" }),
        breadthPro: source("breadthPro", marketStructureProData.breadthPro || {}, marketStructureProData.breadthPro?.status || "proxy", generatedAt, "Breadth Pro", { confidence: marketStructureProData.breadthPro?.confidence || "LOW" }),
        decisionEngine,
        tradeDecision: tradeDecisionSource,
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
        sectorHeat: sectorHeatSource,
        unusualWhales,
        optionsSignals: optionsSignalsSource,
        benzinga,
        newsAggregator,
        newsCatalysts: newsCatalystsSource
    }
  };
  snapshot.debugActiveMarketData = buildDebugActiveMarketData(snapshot);
  const goodForCache = isGoodSnapshotForCache(snapshot);
  snapshot.cacheWriteStatus = {
    attempted: true,
    written: false,
    reason: goodForCache ? "good_snapshot" : "rejected_low_quality_snapshot",
    adapter: cacheAdapter.type
  };
  if (process.env.DEBUG_SNAPSHOT === "true") {

  } else {

  }
  if (goodForCache) {
    snapshot.cacheWriteStatus.written = await cacheAdapter.write(LAST_KNOWN_GOOD_KEY, snapshot);
  } else {
    const persistent = await cacheAdapter.read();
    if (persistent?.generatedAt) {
      return {
        ...persistent,
        servedFrom: "last-known-good",
        currentGenerationFailed: true,
        currentSnapshotRejected: true,
        rejectedSnapshotGeneratedAt: snapshot.generatedAt,
        cacheAdapter: cacheAdapter.type,
        cacheWriteStatus: snapshot.cacheWriteStatus
      };
    }
  }
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
    const persistent = await cacheAdapter.read();
    if (persistent?.generatedAt) {
      noStoreJson(res, 200, { ...persistent, servedFrom: "last-known-good", cacheAdapter: cacheAdapter.type, error: error.message });
      return;
    }
    if (lastGoodSnapshot) {
      noStoreJson(res, 200, { ...lastGoodSnapshot, servedFrom: "last-success-memory", cacheAdapter: "memory", error: error.message });
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
        strategy: "snapshot 构建失败，当前无可用缓存。",
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
        reddit: fallbackSource("reddit", { score: 50, tone: "中性", mentions: [["NVDA",0],["AMD",0],["PLTR",0],["MSFT",0]], summary: "Reddit 实时源暂不可用，使用本地代理热度。", dataQuality: "proxy" }),
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
