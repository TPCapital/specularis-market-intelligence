// lib/auto-intel.js
// Normalized automatic intelligence with per-provider fallbacks.

import { fetchTickFlowForTickers } from "./tickflow-adapter.js";
import { safeFetchText, sanitizeProviderError } from "./provider-utils.js";

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
    strong_uptrend: "strong uptrend",
    uptrend: "uptrend",
    sideways: "sideways",
    downtrend: "downtrend",
    strong_downtrend: "strong downtrend",
    unavailable: "waiting for data",
    placeholder: "waiting for data"
  }[value] || "waiting for data";
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

function providerNameFromUrl(url) {
  const raw = String(url || "");
  if (/finnhub\.io/i.test(raw)) return "finnhub";
  if (/alphavantage\.co/i.test(raw)) return "alphavantage";
  if (/query[12]\.finance\.yahoo\.com/i.test(raw)) return "yahoo";
  if (/news\.google\.com/i.test(raw)) return "google_news";
  return "auto_intel";
}

async function fetchJson(url, timeoutMs = 4200) {
  try {
    const text = await safeFetchText(url, {
      providerName: providerNameFromUrl(url),
      timeoutMs,
      headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "SpecularisAutoIntel/1.5" }
    });
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { rawText: text.slice(0, 2000) };
    }
    return { ok: true, status: 200, payload };
  } catch (error) {
    return { ok: false, status: error?.status || 0, error: sanitizeProviderError(error), payload: null };
  }
}

async function fetchText(url, timeoutMs = 4200) {
  try {
    const text = await safeFetchText(url, {
      providerName: providerNameFromUrl(url),
      timeoutMs,
      headers: { "User-Agent": "SpecularisAutoIntel/1.5" }
    });
    return { ok: true, status: 200, text };
  } catch (error) {
    return { ok: false, status: error?.status || 0, text: "", error: sanitizeProviderError(error) };
  }
}

async function finnhubQuotes(tickers) {
  const token = env("FINNHUB_API_KEY");
  if (!token) return new Map();
  const rows = await Promise.all(tickers.map(async (ticker) => {
    const result = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(token)}`);
    if (!result.ok) return [ticker, { ticker, status: result.status === 429 ? "rate_limited" : "fallback", source: "Finnhub", error: result.error || "finnhub_failed" }];
    const price = Number(result.payload?.c);
    const prev = Number(result.payload?.pc);
    if (!Number.isFinite(price) || price <= 0) return [ticker, { ticker, status: "fallback", source: "Finnhub", error: "empty_price" }];
    const changePercent = Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : Number(result.payload?.dp || 0);
    return [ticker, {
      ticker,
      status: "live",
      source: "Finnhub",
      price: Number(price.toFixed(2)),
      previousClose: Number.isFinite(prev) ? Number(prev.toFixed(2)) : null,
      changePercent: Number(changePercent.toFixed(2)),
      volume: Number(result.payload?.v || 0)
    }];
  }));
  return new Map(rows);
}

async function tickflowQuotes(tickers) {
  const payload = await fetchTickFlowForTickers(tickers, { timeoutMs: 2500, concurrency: 2 }).catch(() => ({ items: [] }));
  return new Map((payload.items || []).map((row) => [row.ticker, {
    ticker: row.ticker,
    status: row.status || "fallback",
    source: row.source || "TickFlow",
    price: row.price,
    previousClose: row.previousClose,
    changePercent: row.changePercent,
    volume: row.volume,
    relativeVolume: row.relativeVolume,
    trendStatus: row.trendStatus,
    error: row.error || null
  }]));
}

async function alphaQuote(ticker) {
  const token = env("ALPHAVANTAGE_API_KEY");
  if (!token) return null;
  const result = await fetchJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(token)}`);
  const q = result.payload?.["Global Quote"] || {};
  const price = Number(q["05. price"]);
  if (!result.ok || !Number.isFinite(price) || price <= 0) return null;
  return {
    ticker,
    status: "delayed",
    source: "AlphaVantage",
    price: Number(price.toFixed(2)),
    previousClose: Number(q["08. previous close"] || 0) || null,
    changePercent: Number.parseFloat(String(q["10. change percent"] || "0").replace("%", "")),
    volume: Number(q["06. volume"] || 0)
  };
}

async function newsFor(ticker) {
  const token = env("FINNHUB_API_KEY");
  if (token) {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (date) => date.toISOString().slice(0, 10);
    const result = await fetchJson(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${fmt(from)}&to=${fmt(to)}&token=${encodeURIComponent(token)}`);
    if (result.ok && Array.isArray(result.payload)) {
      return result.payload.slice(0, 3).map((n) => ({ title: n.headline, source: n.source || "Finnhub", url: n.url || null, status: "delayed" }));
    }
  }
  const rss = await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(`${ticker} stock`)}&hl=en-US&gl=US&ceid=US:en`);
  if (rss.ok && rss.text) {
    const titles = [...rss.text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)]
      .map((m) => (m[1] || m[2] || "").replace(/&amp;/g, "&"))
      .filter((title) => title && !/Google News/i.test(title))
      .slice(0, 3);
    if (titles.length) return titles.map((title) => ({ title, source: "Google News RSS", url: null, status: "delayed" }));
  }
  return [{ title: `${ticker}: news fallback active; using price and trend context.`, source: "fallback", url: null, status: "fallback" }];
}

async function optionsFor(ticker) {
  if (!flag("ENABLE_YAHOO_OPTIONS")) {
    return { status: "fallback", source: "Yahoo Options", reason: "disabled_by_ENABLE_YAHOO_OPTIONS", ivStatus: "fallback", riskLevel: "medium", preferredStructure: "wait" };
  }
  const result = await fetchJson(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`, 3200);
  if (!result.ok) {
    return { status: result.status === 429 ? "rate_limited" : "fallback", source: "Yahoo Options", error: result.error || "yahoo_options_failed", ivStatus: "fallback", riskLevel: "medium", preferredStructure: "wait" };
  }
  const opt = result.payload?.optionChain?.result?.[0]?.options?.[0] || {};
  const sample = [...(opt.calls || []).slice(0, 8), ...(opt.puts || []).slice(0, 8)].map((x) => Number(x.impliedVolatility)).filter((n) => Number.isFinite(n) && n > 0);
  const avgIv = sample.length ? sample.reduce((a, b) => a + b, 0) / sample.length : null;
  return {
    status: "delayed",
    source: "Yahoo Options",
    ivStatus: avgIv == null ? "fallback" : avgIv >= 0.65 ? "elevated" : avgIv >= 0.35 ? "normal" : "low",
    avgIV: avgIv == null ? null : Number((avgIv * 100).toFixed(1)),
    riskLevel: avgIv != null && avgIv >= 0.65 ? "high" : "medium",
    preferredStructure: avgIv != null && avgIv >= 0.65 ? "call_spread" : "wait"
  };
}

function decisionFor(ticker, quote, trend, news, options) {
  let score = 0;
  if (quote.status === "live") score += 2;
  if (quote.status === "delayed") score += 1;
  if (["strong_uptrend", "uptrend"].includes(trend.status)) score += trend.status === "strong_uptrend" ? 2 : 1;
  if (news.some((n) => n.status !== "fallback")) score += 1;
  if (options.status === "delayed" && options.riskLevel !== "high") score += 1;
  const rating = score >= 5 ? "A" : score >= 3 ? "B" : score >= 2 ? "C" : "Watch";
  return {
    ticker,
    score,
    rating,
    action: rating === "A" ? "tradable" : rating === "B" ? "watch" : rating === "C" ? "wait_for_pullback" : "watch",
    preferredVehicle: options.preferredStructure && options.preferredStructure !== "wait" ? options.preferredStructure : "stock",
    keyEntryZone: quote.price ? `$${quote.price}` : null,
    invalidationLevel: quote.previousClose ? `below $${quote.previousClose}` : null,
    targetZone: quote.price ? `$${Number((quote.price * 1.04).toFixed(2))}` : null,
    reason: `${ticker} auto score: quote=${quote.status}, trend=${trend.labelZh}, options=${options.status}.`,
    dataStatus: quote.status === "live" ? "computed-auto" : "fallback",
    scoreBreakdown: {
      regimeScore: 1,
      trendScore: score >= 2 ? 1 : 0,
      catalystScore: news.some((n) => n.status !== "fallback") ? 1 : 0,
      optScore: options.status === "delayed" ? 1 : 0,
      kolScore: 0,
      riskCtrlScore: quote.previousClose ? 1 : 0
    }
  };
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
    out[ticker] = {
      quote,
      trend,
      volume: { status: quote.volume ? "available" : "fallback", value: quote.volume ?? null, relativeVolume: quote.relativeVolume ?? null },
      news,
      options,
      ai: { status: "local", summary: decision.reason },
      decision,
      dataQuality: {
        status: quote.status === "live" ? (news.some((n) => n.status !== "fallback") ? "live" : "delayed") : "fallback",
        quote: quote.status || "fallback",
        news: news.some((n) => n.status !== "fallback") ? "delayed" : "fallback",
        options: options.status || "fallback"
      }
    };
  }));

  const values = Object.values(out);
  const live = values.filter((row) => row.quote?.status === "live").length;
  const delayed = values.filter((row) => ["live", "delayed"].includes(row.quote?.status)).length;
  const status = live === tickers.length ? "live" : delayed ? "delayed" : "fallback";
  const leaders = values
    .map((row) => ({
      ticker: row.quote?.ticker,
      price: row.quote?.price ?? null,
      changePercent: row.quote?.changePercent ?? null,
      score: row.decision?.score ?? 0,
      action: row.decision?.action || "watch",
      dataQuality: row.dataQuality?.status || "fallback"
    }))
    .filter((row) => row.ticker)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  const payload = {
    status,
    dataQuality: status,
    version: "v1.5-auto-intel",
    generatedAt: Date.now(),
    updatedAt: Date.now(),
    latencyMs: Date.now() - started,
    cacheHit: false,
    marketRegime: {
      mode: delayed >= Math.ceil(tickers.length / 2) ? "DATA_AVAILABLE" : "FALLBACK_MODE",
      score: Math.round((delayed / Math.max(1, tickers.length)) * 100),
      dataQuality: status
    },
    leaders,
    sectors: [],
    news: values.flatMap((row) => row.news || []).slice(0, 20),
    riskSignals: values
      .filter((row) => row.options?.riskLevel === "high" || row.decision?.action === "avoid")
      .map((row) => ({ ticker: row.quote?.ticker, reason: row.decision?.reason || row.options?.riskLevel || "risk", dataQuality: row.dataQuality?.status || "fallback" })),
    summary: status === "fallback" ? "Auto-intel is using fallback data because live providers are unavailable." : "Auto-intel generated from available quote, news, options and local decision layers.",
    aiSummary: status === "fallback" ? "AI Router fallback summary: wait for live data confirmation." : "AI Router local summary generated from normalized auto-intel data.",
    tickers: out,
    sources: {
      quote: "Finnhub -> TickFlow -> AlphaVantage -> fallback",
      news: "Finnhub News -> Google News RSS -> fallback",
      macro: "existing snapshot / FRED when available",
      options: flag("ENABLE_YAHOO_OPTIONS") ? "Yahoo Options safe mode" : "disabled_by_ENABLE_YAHOO_OPTIONS",
      twelveData: flag("ENABLE_TWELVEDATA_SNAPSHOT") ? "enabled" : "disabled_by_ENABLE_TWELVEDATA_SNAPSHOT",
      yahooQuoteSummary: flag("ENABLE_YAHOO_QUOTE_SUMMARY") ? "enabled" : "disabled_by_ENABLE_YAHOO_QUOTE_SUMMARY"
    }
  };
  setCached(tickers, payload);
  return payload;
}
