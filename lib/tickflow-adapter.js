// lib/tickflow-adapter.js
// Specularis Market Terminal Lite v1.4.1 — TickFlow market-data adapter
//
// Current TickFlow free dashboard exposes realtime quote + daily K-line capacity,
// not options-flow/GEX. This adapter therefore treats TickFlow as a market data
// and volume/RVOL source. It is endpoint-template driven because the dashboard
// does not expose public docs inside the API-key screen.

export const TICKFLOW_ADAPTER_VERSION = "v1.4.1-market";

export function envValueAny(names = []) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function getTickFlowConfig() {
  const apiKey = envValueAny(["TICKFLOW_API_KEY", "TickFlow_API_KEY", "TICKFLOW_TOKEN", "TickFlow_TOKEN"]);
  const baseUrl = envValueAny(["TICKFLOW_BASE_URL", "TickFlow_BASE_URL", "TICKFLOW_API_URL", "TickFlow_API_URL"]);
  const quoteEndpointTemplate = envValueAny(["TICKFLOW_QUOTE_ENDPOINT_TEMPLATE", "TickFlow_QUOTE_ENDPOINT_TEMPLATE", "TICKFLOW_ENDPOINT_TEMPLATE", "TickFlow_ENDPOINT_TEMPLATE"]);
  const klineEndpointTemplate = envValueAny(["TICKFLOW_KLINE_ENDPOINT_TEMPLATE", "TickFlow_KLINE_ENDPOINT_TEMPLATE"]);
  const authMode = envValueAny(["TICKFLOW_AUTH_MODE", "TickFlow_AUTH_MODE"]) || "both";
  return { apiKey, baseUrl, quoteEndpointTemplate, klineEndpointTemplate, authMode };
}

export function tickFlowEnvDebug() {
  const cfg = getTickFlowConfig();
  return {
    TICKFLOW_API_KEY: Boolean(cfg.apiKey),
    TICKFLOW_BASE_URL: Boolean(cfg.baseUrl),
    TICKFLOW_QUOTE_ENDPOINT_TEMPLATE: Boolean(cfg.quoteEndpointTemplate),
    TICKFLOW_KLINE_ENDPOINT_TEMPLATE: Boolean(cfg.klineEndpointTemplate),
  };
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getPath(obj, path) {
  let cur = obj;
  for (const part of String(path).split('.')) cur = cur?.[part];
  return cur;
}

function firstNumber(obj, keys = []) {
  for (const key of keys) {
    const n = safeNumber(getPath(obj, key));
    if (n != null) return n;
  }
  return null;
}

function findFirstObject(payload = {}) {
  const candidates = [
    payload?.data,
    payload?.result,
    payload?.quote,
    payload?.quotes?.[0],
    payload?.data?.quote,
    payload?.data?.quotes?.[0],
    payload?.data?.items?.[0],
    payload?.items?.[0],
    payload?.results?.[0],
    payload,
  ];
  return candidates.find((x) => x && typeof x === "object" && !Array.isArray(x)) || {};
}

function extractBars(payload = {}) {
  const arrays = [payload?.data?.klines, payload?.data?.candles, payload?.data?.bars, payload?.klines, payload?.candles, payload?.bars, payload?.data, payload?.items, payload?.results];
  for (const arr of arrays) if (Array.isArray(arr)) return arr;
  return [];
}

function normalizeBar(row = {}) {
  if (Array.isArray(row)) {
    return { time: row[0], open: safeNumber(row[1]), high: safeNumber(row[2]), low: safeNumber(row[3]), close: safeNumber(row[4]), volume: safeNumber(row[5]) };
  }
  return {
    time: row.time || row.timestamp || row.date || row.t,
    open: firstNumber(row, ["open", "o"]),
    high: firstNumber(row, ["high", "h"]),
    low: firstNumber(row, ["low", "l"]),
    close: firstNumber(row, ["close", "c", "price"]),
    volume: firstNumber(row, ["volume", "v", "vol"]),
  };
}

function avg(values = []) {
  const nums = values.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function classifyTrend(price, prevClose, bars = []) {
  const change = prevClose > 0 && price > 0 ? ((price - prevClose) / prevClose) * 100 : null;
  if (change != null) {
    if (change >= 3) return "strong_uptrend";
    if (change >= 0.8) return "uptrend";
    if (change <= -3) return "strong_downtrend";
    if (change <= -0.8) return "downtrend";
  }
  const closes = bars.map((b) => b.close).filter((n) => Number.isFinite(n));
  if (closes.length >= 5) return closes.at(-1) > closes.at(-5) ? "uptrend" : "downtrend";
  return "sideways";
}

function authHeaders(apiKey, authMode = "both") {
  const headers = { Accept: "application/json,*/*", "User-Agent": "SpecularisMarketTerminal/1.4.1" };
  if (!apiKey) return headers;
  if (authMode === "bearer" || authMode === "both") headers.Authorization = `Bearer ${apiKey}`;
  if (authMode === "x-api-key" || authMode === "both") headers["x-api-key"] = apiKey;
  return headers;
}

function templateUrl(template, symbol, extra = {}) {
  const encoded = encodeURIComponent(symbol);
  return template
    .replaceAll("{symbol}", encoded)
    .replaceAll("{ticker}", encoded)
    .replaceAll("{market}", extra.market || "US")
    .replaceAll("{period}", extra.period || "1d")
    .replaceAll("{limit}", String(extra.limit || 30));
}

function buildQuoteEndpointCandidates(symbol, cfg = {}) {
  if (cfg.quoteEndpointTemplate) return [templateUrl(cfg.quoteEndpointTemplate, symbol)];
  const base = cfg.baseUrl ? cfg.baseUrl.replace(/\/+$/, "") : "";
  if (!base) return [];
  const encoded = encodeURIComponent(symbol);
  return [
    `${base}/realtime?symbol=${encoded}`,
    `${base}/quote?symbol=${encoded}`,
    `${base}/quotes?symbol=${encoded}`,
    `${base}/v1/realtime?symbol=${encoded}`,
    `${base}/v1/quote?symbol=${encoded}`,
    `${base}/api/realtime?symbol=${encoded}`,
    `${base}/api/quote?symbol=${encoded}`,
  ];
}

function buildKlineEndpointCandidates(symbol, cfg = {}) {
  if (cfg.klineEndpointTemplate) return [templateUrl(cfg.klineEndpointTemplate, symbol, { period: "1d", limit: 30 })];
  const base = cfg.baseUrl ? cfg.baseUrl.replace(/\/+$/, "") : "";
  if (!base) return [];
  const encoded = encodeURIComponent(symbol);
  return [
    `${base}/kline?symbol=${encoded}&period=1d&limit=30`,
    `${base}/klines?symbol=${encoded}&period=1d&limit=30`,
    `${base}/candles?symbol=${encoded}&period=1d&limit=30`,
    `${base}/v1/kline?symbol=${encoded}&period=1d&limit=30`,
    `${base}/api/kline?symbol=${encoded}&period=1d&limit=30`,
  ];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { rawText: text.slice(0, 1000) }; }
    return { ok: res.ok, status: res.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function tryEndpoints(endpoints, cfg, timeoutMs) {
  const attempts = [];
  for (const endpoint of endpoints) {
    const started = Date.now();
    try {
      const result = await fetchWithTimeout(endpoint, { headers: authHeaders(cfg.apiKey, cfg.authMode) }, timeoutMs);
      attempts.push({ endpoint, httpStatus: result.status, ok: result.ok, latencyMs: Date.now() - started });
      if (result.ok) return { endpoint, payload: result.payload, attempts, latencyMs: Date.now() - started };
    } catch (error) {
      attempts.push({ endpoint, ok: false, error: error?.message || String(error) });
    }
  }
  return { endpoint: null, payload: null, attempts, latencyMs: null };
}

export function normalizeTickFlowMarketPayload(symbol, quotePayload = {}, klinePayload = {}, meta = {}) {
  const q = findFirstObject(quotePayload);
  const bars = extractBars(klinePayload).map(normalizeBar).filter((b) => Number.isFinite(b.close));
  const latestBar = bars.at(-1) || {};
  const prevBar = bars.length >= 2 ? bars.at(-2) : {};
  const price = firstNumber(q, ["price", "last", "lastPrice", "close", "c", "data.price", "data.last"]) ?? latestBar.close ?? null;
  const prevClose = firstNumber(q, ["prevClose", "previousClose", "preClose", "previous_close", "pc"]) ?? prevBar.close ?? null;
  const changePercent = firstNumber(q, ["changePercent", "change_percent", "percent", "pct", "pchg", "regularMarketChangePercent"])
    ?? (price && prevClose ? ((price - prevClose) / prevClose) * 100 : null);
  const volume = firstNumber(q, ["volume", "vol", "v", "dayVolume"]) ?? latestBar.volume ?? 0;
  const avgVolume20 = avg(bars.slice(-21, -1).map((b) => b.volume));
  const realRelativeVolume = volume > 0 && avgVolume20 > 0 ? Number((volume / avgVolume20).toFixed(2)) : null;
  return {
    ticker: symbol,
    symbol,
    kind: "market",
    status: meta.status || (price ? "live" : "unavailable"),
    dataStatus: meta.status || (price ? "live" : "unavailable"),
    source: "TickFlow Market",
    provider: "TickFlow",
    price,
    value: price,
    previousClose: prevClose,
    changePercent: changePercent != null ? Number(changePercent.toFixed(4)) : null,
    volume: volume || 0,
    avgVolume20,
    realRelativeVolume,
    relativeVolume: realRelativeVolume,
    relativeVolumeStatus: realRelativeVolume ? "real" : "unavailable",
    volumeStatus: realRelativeVolume ? "real" : (volume ? "partial" : "unavailable"),
    trendStatus: classifyTrend(price, prevClose, bars),
    bars: bars.slice(-30),
    confidence: price ? (realRelativeVolume ? "HIGH" : "MEDIUM") : "LOW",
    endpoint: meta.endpoint || null,
    klineEndpoint: meta.klineEndpoint || null,
    error: meta.error || null,
    updatedAt: Date.now(),
    latencyMs: meta.latencyMs ?? null,
  };
}

export async function fetchTickFlowForTicker(symbol, opts = {}) {
  const cfg = { ...getTickFlowConfig(), ...opts };
  if (!cfg.apiKey) return normalizeTickFlowMarketPayload(symbol, {}, {}, { status: "unavailable", error: "missing_tickflow_api_key" });
  const quoteEndpoints = buildQuoteEndpointCandidates(symbol, cfg);
  const klineEndpoints = buildKlineEndpointCandidates(symbol, cfg);
  if (!quoteEndpoints.length && !klineEndpoints.length) {
    return normalizeTickFlowMarketPayload(symbol, {}, {}, { status: "unavailable", error: "missing_tickflow_endpoint_or_base_url" });
  }
  const started = Date.now();
  const quote = quoteEndpoints.length ? await tryEndpoints(quoteEndpoints, cfg, opts.timeoutMs || 3000) : { payload: null, endpoint: null, attempts: [] };
  const kline = klineEndpoints.length ? await tryEndpoints(klineEndpoints, cfg, opts.timeoutMs || 3000) : { payload: null, endpoint: null, attempts: [] };
  const normalized = normalizeTickFlowMarketPayload(symbol, quote.payload || {}, kline.payload || {}, {
    status: quote.payload || kline.payload ? "live" : "unavailable",
    endpoint: quote.endpoint,
    klineEndpoint: kline.endpoint,
    latencyMs: Date.now() - started,
    error: quote.payload || kline.payload ? null : "no_usable_tickflow_payload",
  });
  return { ...normalized, attempts: { quote: quote.attempts, kline: kline.attempts } };
}

export async function fetchTickFlowForTickers(symbols = [], opts = {}) {
  const unique = [...new Set(symbols.map((s) => String(s || "").toUpperCase()).filter(Boolean))].slice(0, 12);
  const concurrency = Math.max(1, Math.min(Number(opts.concurrency || 2), 3));
  const items = [];
  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    const rows = await Promise.all(chunk.map((s) => fetchTickFlowForTicker(s, opts)));
    items.push(...rows);
  }
  const liveCount = items.filter((item) => item.status === "live" && item.price).length;
  return {
    status: liveCount ? "live" : "unavailable",
    kind: "market",
    version: TICKFLOW_ADAPTER_VERSION,
    items,
    map: new Map(items.map((item) => [item.ticker, item])),
    liveCount,
    unavailableCount: items.length - liveCount,
    generatedAt: Date.now(),
  };
}
