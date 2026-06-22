import { safeFetchJson } from "./provider-utils.js";

export function json(res, status, payload, cacheSeconds = 30) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", `s-maxage=${cacheSeconds}, stale-while-revalidate=120`);
  res.status(status).send(JSON.stringify(payload));
}

export function noStoreJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(status).send(JSON.stringify(payload));
}

export function cleanSymbols(symbols = "") {
  return symbols
    .split(",")
    .map((symbol) => decodeURIComponent(symbol).trim())
    .filter(Boolean)
    .slice(0, 80)
    .join(",");
}

function envFlag(name) {
  return String(process.env[name] || "").toLowerCase() === "true";
}

function optionalSourceResponse(url) {
  const raw = String(url || "");
  if (!envFlag("ENABLE_TWELVEDATA_SNAPSHOT") && /api\.twelvedata\.com\/quote/i.test(raw)) {
    return {
      status: "disabled",
      code: 200,
      body: {
        status: "disabled",
        reason: "disabled_by_ENABLE_TWELVEDATA_SNAPSHOT",
        data: []
      }
    };
  }
  if (!envFlag("ENABLE_YAHOO_QUOTE_SUMMARY") && /query2\.finance\.yahoo\.com\/v10\/finance\/quoteSummary/i.test(raw)) {
    return {
      status: "disabled",
      code: 200,
      body: {
        quoteSummary: { result: [] },
        status: "disabled",
        reason: "disabled_by_ENABLE_YAHOO_QUOTE_SUMMARY"
      }
    };
  }
  if (!envFlag("ENABLE_YAHOO_OPTIONS") && /query2\.finance\.yahoo\.com\/v7\/finance\/options/i.test(raw)) {
    return {
      status: "disabled",
      code: 200,
      body: {
        optionChain: { result: [] },
        status: "disabled",
        reason: "disabled_by_ENABLE_YAHOO_OPTIONS"
      }
    };
  }
  if (!envFlag("ENABLE_GEMINI_SNAPSHOT") && /generativelanguage\.googleapis\.com\/v1beta\/models\/[^/]+:generateContent/i.test(raw)) {
    return {
      status: "disabled",
      code: 503,
      body: {
        status: "disabled",
        reason: "disabled_by_ENABLE_GEMINI_SNAPSHOT"
      }
    };
  }
  return null;
}

const nativeFetch = globalThis.fetch?.bind(globalThis);
if (nativeFetch && !globalThis.__specularisOptionalSourceGuard) {
  globalThis.__specularisOptionalSourceGuard = true;
  globalThis.fetch = async (url, options = {}) => {
    const optional = optionalSourceResponse(url);
    if (optional) {
      return new Response(JSON.stringify(optional.body), {
        status: optional.code,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
    return nativeFetch(url, options);
  };
}

export async function fetchJson(url, options = {}) {
  const providerName = options.providerName || providerNameFromUrl(url);
  return safeFetchJson(url, { ...options, providerName });
}

function providerNameFromUrl(url) {
  const raw = String(url || "");
  if (/finnhub\.io/i.test(raw)) return "finnhub";
  if (/twelvedata\.com/i.test(raw)) return "twelvedata";
  if (/query[12]\.finance\.yahoo\.com/i.test(raw)) return "yahoo";
  if (/stooq\.com/i.test(raw)) return "stooq";
  if (/alphavantage\.co/i.test(raw)) return "alphavantage";
  if (/stlouisfed\.org/i.test(raw)) return "fred";
  if (/scanner\.tradingview\.com/i.test(raw)) return "tradingview";
  if (/reddit\.com/i.test(raw)) return "reddit";
  if (/generativelanguage\.googleapis\.com/i.test(raw)) return "gemini";
  return "fetch";
}
