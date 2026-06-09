// lib/auto-intel.js
// Specularis v1.5 normalized automatic intelligence.

import { fetchTickFlowForTickers } from "./tickflow-adapter.js";

export const DEFAULT_TICKERS = ["MU", "MRVL", "NVDA", "AVGO", "AMD", "TSM", "ASML", "PLTR", "ORCL", "SMCI"];
export const AUTO_INTEL_CACHE_TTL_MS = 5 * 60 * 1000;
const cache = globalThis.__SPECULARIS_AUTO_INTEL_CACHE__ || new Map();
globalThis.__SPECULARIS_AUTO_INTEL_CACHE__ = cache;

function env(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function flag(name) {
  return String(process.env[name] || "").toLowerCase() === "true";
}

function normalizeTickers(input = "") {
  const raw = String(input || "").toUpperCase().replace(/[^A-Z,]/g, "");
  const list = raw ? raw.split(",") : DEFAULT_TICKERS;
  return [...new Set(list.filter((x) => /^[A-Z]{1,6}$/.test(x)))].slice(0, 12);
}

export function trendLabelZh(value) {
  return {
    strong_uptrend: "强上涨",
    uptrend: "上涨",
    sideways: "震荡",
    downtrend: "下跌",
    strong_downtrend: "强下跌",
    unavailable: "等待数据",
    placeholder: "等待数据"
  }[value] || "等待数据";
}

function trendFromChange(changePercent) {
  const n = Number(changePercent);
  if (!Number.isFinite(n)) return "unavailable";
  if (n >= 3) return "strong_uptrend";
  if (n >= 0.8) return "uptrend";
  if (n <= -3) return "strong_downtrend";
  if (n <= -0.8) return "downtrend";
  return "sideways";
}

function cacheKey(tickers) {
  return tickers.join(",");
}

function getCached(tickers) {
  const hit = cache.get(cacheKey(tickers));
  if (!hit) return null;
  if (Date.now() - hit.at > AUTO_INTEL_CACHE_TTL_MS) {
    cache.delete(cacheKey(tickers));
    return null;
  }
  return hit.value;
}

function setCached(tickers, value) {
  cache.set(cacheKey(tickers), { at: Date.now(), value });
  if (cache.size > 20) cache.delete(cache.keys().next().value);
}

async function fetchJson(url, timeoutMs = 4200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "SpecularisAutoIntel/1.5" } });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { rawText: text.slice(0, 2000) }; }
    return { ok: response.ok, status: response.status, payload };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || "fetch_failed", payload: null };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = 4200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { "User-Agent": "SpecularisAutoIntel/1.5" } });
    return { ok: response.ok, status: response.status, text: await response.text() };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: error?.message || "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function finnhubQuotes(tickers) {
  const token = env("FINNHUB_API_KEY");
  if (!token) return new Map();
  const rows = await Promise.all(tickers.map(async (ticker) => {
    const result = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(token)}`);
    if (!result.ok) return [ticker, { ticker, status: result.status === 429 ? "rate_limited" : "unavailable", source: "Finnhub", error: `finnhub_http_${result.status || result.error}` }];
    const price = Number(result.payload?.c);
    const prev = Number(result.payload?.pc);
    if (!Number.isFinite(price) || price <= 0) return [ticker, { ticker, status: "unavailable", source: "Finnhub", error: "empty_price" }];
    const changePercent = Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : Number(result.payload?.dp || 0);
    return [ticker, { ticker, status: "live", source: "Finnhub", price: Number(price.toFixed(2)), previousClose: Number.isFinite(prev) ? Number(prev.toFixed(2)) : null, changePercent: Number(changePercent.toFixed(2)), volume: Number(result.payload?.v || 0) }];
  }));
  return new Map(rows);
}

async function tickflowQuotes(tickers) {
  const payload = await fetchTickFlowForTickers(tickers, { timeoutMs: 2500, concurrency: 2 }).catch(() => ({ items: [] }));
  return new Map((payload.items || []).map((row) => [row.ticker, { ticker: row.ticker, status: row.status, source: row.source || "TickFlow", price: row.price, previousClose: row.previousClose, changePercent: row.changePercent, volume: row.volume, relativeVolume: row.relativeVolume, trendStatus: row.trendStatus, error: row.error || null }]));
}

async function alphaQuote(ticker) {
  const token = env("ALPHAVANTAGE_API_KEY");
  if (!token) return null;
  const result = await fetchJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(token)}`);
  const q = result.payload?.["Global Quote"] || {};
  const price = Number(q["05. price"]);
  if (!result.ok || !Number.isFinite(price) || price <= 0) return null;
  return { ticker, status: "delayed", source: "AlphaVantage", price: Number(price.toFixed(2)), previousClose: Number(q["08. previous close"] || 0) || null, changePercent: Number.parseFloat(String(q["10. change percent"] || "0").replace("%", "")), volume: Number(q["06. volume"] || 0) };
}

async function newsFor(ticker) {
  const token = env("FINNHUB_API_KEY");
  if (token) {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (date) => date.toISOString().slice(0, 10);
    const result = await fetchJson(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${fmt(from)}&to=${fmt(to)}&token=${encodeURIComponent(token)}`);
    if (result.ok && Array.isArray(result.payload)) return result.payload.slice(0, 3).map((n) => ({ title: n.headline, source: n.source || "Finnhub", url: n.url || null, status: "delayed" }));
  }
  const rss = await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(`${ticker} stock`)}&hl=en-US&gl=US&ceid=US:en`);
  if (rss.ok && rss.text) {
    const titles = [...rss.text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)]
      .map((m) => (m[1] || m[2] || "").replace(/&amp;/g, "&"))
      .filter((title) => title && !/Google News/i.test(title))
      .slice(0, 3);
    if (titles.length) return titles.map((title) => ({ title, source: "Google News RSS", url: null, status: "delayed" }));
  }
  return [{ title: `${ticker}: 自动新闻暂不可用，使用价格/趋势作为主信号。`, source: "fallback", url: null, status: "fallback" }];
}

async function optionsFor(ticker) {
  if (!flag("ENABLE_YAHOO_OPTIONS")) return { status: "unavailable", source: "Yahoo Options", reason: "disabled_by_ENABLE_YAHOO_OPTIONS", ivStatus: "unavailable", riskLevel: "medium", preferredStructure: "wait" };
  const result = await fetchJson(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`, 3200);
  if (!result.ok) return { status: result.status === 429 ? "rate_limited" : "unavailable", source: "Yahoo Options", error: `yahoo_options_http_${result.status || result.error}`, ivStatus: "unavailable", riskLevel: "medium", preferredStructure: "wait" };
  const opt = result.payload?.optionChain?.result?.[0]?.options?.[0] || {};
  const sample = [...(opt.calls || []).slice(0, 8), ...(opt.puts || []).slice(0, 8)].map((x) => Number(x.impliedVolatility)).filter((n) => Number.isFinite(n) && n > 0);
  const avgIv = sample.length ? sample.reduce((a, b) => a + b, 0) / sample.length : null;
  return { status: "delayed", source: "Yahoo Options", ivStatus: avgIv == null ? "unavailable" : avgIv >= 0.65 ? "elevated" : avgIv >= 0.35 ? "normal" : "low", avgIV: avgIv == null ? null : Number((avgIv * 100).toFixed(1)), riskLevel: avgIv != null && avgIv >= 0.65 ? "high" : "medium", preferredStructure: avgIv != null && avgIv >= 0.65 ? "call_spread" : "wait" };
}

function decisionFor(ticker, quote, trend, news, options) {
  let score = 0;
  if (quote.status === "live") score += 2;
  if (["strong_uptrend", "uptrend"].includes(trend.status)) score += trend.status === "strong_uptrend" ? 2 : 1;
  if (news.some((n) => n.status !== "fallback")) score += 1;
  if (options.status === "delayed" && options.riskLevel !== "high") score += 1;
  const rating = score >= 5 ? "A" : score >= 3 ? "B" : score >= 2 ? "C" : "Avoid";
  return { ticker, score, rating, action: rating === "A" ? "tradable" : rating === "B" ? "watch" : rating === "C" ? "wait_for_pullback" : "avoid", preferredVehicle: options.preferredStructure && options.preferredStructure !== "wait" ? options.preferredStructure : "stock", keyEntryZone: quote.price ? `$${quote.price}` : null, invalidationLevel: quote.previousClose ? `低于 $${quote.previousClose}` : null, targetZone: quote.price ? `$${Number((quote.price * 1.04).toFixed(2))}` : null, reason: `${ticker} 自动评分：行情=${quote.status}，趋势=${trend.labelZh}，期权=${options.status}。`, dataStatus: quote.status === "live" ? "computed-auto" : "fallback", scoreBreakdown: { regimeScore: 1, trendScore: score >= 2 ? 1 : 0, catalystScore: news.some((n) => n.status !== "fallback") ? 1 : 0, optScore: options.status === "delayed" ? 1 : 0, kolScore: 0, riskCtrlScore: quote.previousClose ? 1 : 0 } };
}

function fallbackQuote(ticker) {
  return { ticker, status: "fallback", source: "fallback", price: null, previousClose: null, changePercent: null, volume: null };
}

export async function buildAutoIntel(inputTickers = "") {
  const started = Date.now();
  const tickers = normalizeTickers(inputTickers);
  const cached = getCached(tickers);
  if (cached) return { ...cached, cacheHit: true, generatedAt: Date.now(), latencyMs: Date.now() - started };

  const [fh, tf] = await Promise.all([finnhubQuotes(tickers), tickflowQuotes(tickers)]);
  const out = {};
  await Promise.all(tickers.map(async (ticker) => {
    let quote = fh.get(ticker);
    if (!quote || quote.status !== "live") quote = tf.get(ticker) || quote;
    if (!quote || !quote.price) quote = await alphaQuote(ticker) || fallbackQuote(ticker);
    const [news, options] = await Promise.all([newsFor(ticker), optionsFor(ticker)]);
    const trendStatus = quote.trendStatus || trendFromChange(quote.changePercent);
    const trend = { status: trendStatus, labelZh: trendLabelZh(trendStatus), source: quote.source || "fallback" };
    const decision = decisionFor(ticker, quote, trend, news, options);
    out[ticker] = { quote, trend, volume: { status: quote.volume ? "available" : "unavailable", value: quote.volume ?? null, relativeVolume: quote.relativeVolume ?? null }, news, options, ai: { status: "local", summary: decision.reason }, decision, dataQuality: { status: quote.status === "live" ? (news.some((n) => n.status !== "fallback") ? "live" : "partial") : "fallback", quote: quote.status || "fallback", news: news.some((n) => n.status !== "fallback") ? "delayed" : "fallback", options: options.status || "unavailable" } };
  }));

  const values = Object.values(out);
  const live = values.filter((row) => row.quote?.status === "live").length;
  const partial = values.some((row) => ["live", "partial"].includes(row.dataQuality?.status));
  const payload = { status: live === tickers.length ? "live" : partial ? "partial" : "fallback", version: "v1.5-auto-intel", generatedAt: Date.now(), latencyMs: Date.now() - started, cacheHit: false, tickers: out, sources: { quote: "Finnhub -> TickFlow -> AlphaVantage -> fallback", news: "Finnhub News -> Google News RSS -> fallback", macro: "existing snapshot / FRED when available", options: flag("ENABLE_YAHOO_OPTIONS") ? "Yahoo Options safe mode" : "disabled_by_ENABLE_YAHOO_OPTIONS", twelveData: flag("ENABLE_TWELVEDATA_SNAPSHOT") ? "enabled" : "disabled_by_ENABLE_TWELVEDATA_SNAPSHOT", yahooQuoteSummary: flag("ENABLE_YAHOO_QUOTE_SUMMARY") ? "enabled" : "disabled_by_ENABLE_YAHOO_QUOTE_SUMMARY" } };
  setCached(tickers, payload);
  return payload;
}
