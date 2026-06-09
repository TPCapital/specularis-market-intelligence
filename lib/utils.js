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
  const { timeoutMs = 8000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)",
        Accept: "application/json,text/plain,*/*",
        ...(fetchOptions.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
