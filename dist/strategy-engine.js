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
