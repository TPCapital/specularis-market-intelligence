const providerCircuitState = globalThis.__SPECULARIS_PROVIDER_CIRCUIT_STATE__ || new Map();
globalThis.__SPECULARIS_PROVIDER_CIRCUIT_STATE__ = providerCircuitState;

export const DATA_QUALITY = Object.freeze({
  LIVE: "live",
  DELAYED: "delayed",
  CACHED: "cached",
  STALE: "stale",
  FALLBACK: "fallback",
  UNAVAILABLE: "unavailable"
});

export function normalizeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeDataQuality(value = DATA_QUALITY.UNAVAILABLE) {
  const raw = String(value || "").toLowerCase();
  if (["live", "delayed", "cached", "stale", "fallback", "unavailable"].includes(raw)) return raw;
  if (raw === "snapshot" || raw === "proxy" || raw === "placeholder") return DATA_QUALITY.FALLBACK;
  if (String(value).toUpperCase() === "LIVE") return DATA_QUALITY.LIVE;
  if (String(value).toUpperCase() === "DELAYED") return DATA_QUALITY.DELAYED;
  return DATA_QUALITY.UNAVAILABLE;
}

export function classifyProviderError(error, status = null) {
  const code = Number(status || error?.status || error?.statusCode || 0);
  const message = String(error?.message || error || "").toLowerCase();
  if (code === 401 || code === 403) return "auth_failed";
  if (code === 429) return "rate_limited";
  if (code >= 500) return "upstream_error";
  if (error?.name === "AbortError" || message.includes("abort") || message.includes("timeout")) return "timeout";
  if (code >= 400) return "request_failed";
  return "invalid_response";
}

export function sanitizeProviderError(error, status = null) {
  return classifyProviderError(error, status);
}

function retryAfterMs(headers) {
  const raw = headers?.get?.("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30 * 60 * 1000);
  const dateMs = Date.parse(raw);
  return Number.isFinite(dateMs) ? Math.min(Math.max(dateMs - Date.now(), 1000), 30 * 60 * 1000) : null;
}

export function cooldownMs(type, retryAfter = null) {
  if (type === "auth_failed") return 30 * 60 * 1000;
  if (type === "rate_limited") return retryAfter || 5 * 60 * 1000;
  if (type === "upstream_error") return 3 * 60 * 1000;
  if (type === "timeout") return 2 * 60 * 1000;
  return 30 * 1000;
}

function stateFor(providerName) {
  const key = String(providerName || "unknown").toLowerCase();
  if (!providerCircuitState.has(key)) {
    providerCircuitState.set(key, { disabledUntil: 0, lastError: null, lastStatus: null, lastAttemptAt: null });
  }
  return providerCircuitState.get(key);
}

export function getProviderCircuitState() {
  return Object.fromEntries([...providerCircuitState.entries()].map(([provider, state]) => [
    provider,
    {
      disabledUntil: state.disabledUntil || null,
      coolingDown: Boolean(state.disabledUntil && state.disabledUntil > Date.now()),
      lastError: state.lastError || null,
      lastStatus: state.lastStatus || null,
      lastAttemptAt: state.lastAttemptAt || null
    }
  ]));
}

export function isProviderCoolingDown(providerName) {
  const state = stateFor(providerName);
  return Boolean(state.disabledUntil && state.disabledUntil > Date.now());
}

function tripProvider(providerName, type, status = null, retryAfter = null) {
  const state = stateFor(providerName);
  state.disabledUntil = Date.now() + cooldownMs(type, retryAfter);
  state.lastError = type;
  state.lastStatus = status || type;
  state.lastAttemptAt = Date.now();
}

function clearProvider(providerName) {
  const state = stateFor(providerName);
  state.disabledUntil = 0;
  state.lastError = null;
  state.lastStatus = "ok";
  state.lastAttemptAt = Date.now();
}

export async function withTimeout(promiseOrFactory, timeoutMs = 8000, label = "provider_call") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const value = typeof promiseOrFactory === "function" ? promiseOrFactory(controller.signal) : promiseOrFactory;
    return await value;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`${label}_timeout`);
      timeoutError.name = "AbortError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function safeProviderCall(providerName, fn, options = {}) {
  const { timeoutMs = 8000, fallback = null, classifyOnly = false } = options;
  if (isProviderCoolingDown(providerName)) {
    return { ok: false, data: fallback, status: "cooldown", dataQuality: DATA_QUALITY.FALLBACK, provider: providerName, error: "cooldown" };
  }
  try {
    const data = await withTimeout((signal) => fn({ signal, timeoutMs }), timeoutMs, providerName);
    clearProvider(providerName);
    return { ok: true, data, status: "ok", dataQuality: DATA_QUALITY.LIVE, provider: providerName, error: null };
  } catch (error) {
    const type = classifyProviderError(error);
    if (!classifyOnly && ["auth_failed", "rate_limited", "upstream_error", "timeout"].includes(type)) {
      tripProvider(providerName, type, error?.status || null, error?.retryAfterMs || null);
    }
    return { ok: false, data: fallback, status: type, dataQuality: DATA_QUALITY.FALLBACK, provider: providerName, error: sanitizeProviderError(error) };
  }
}

export async function safeFetchText(url, options = {}) {
  const { timeoutMs = 8000, providerName = "fetch", ...fetchOptions } = options;
  if (isProviderCoolingDown(providerName)) {
    const error = new Error(`${providerName}_cooldown`);
    error.status = "cooldown";
    throw error;
  }
  return withTimeout(async (signal) => {
    const response = await fetch(url, {
      ...fetchOptions,
      cache: "no-store",
      signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)",
        Accept: "application/json,text/plain,*/*",
        ...(fetchOptions.headers || {})
      }
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`${providerName}_http_${response.status}`);
      error.status = response.status;
      error.retryAfterMs = retryAfterMs(response.headers);
      const type = classifyProviderError(error, response.status);
      if (["auth_failed", "rate_limited", "upstream_error"].includes(type)) tripProvider(providerName, type, response.status, error.retryAfterMs);
      throw error;
    }
    clearProvider(providerName);
    return text;
  }, timeoutMs, providerName);
}

export async function safeFetchJson(url, options = {}) {
  const { providerName = "fetch", ...rest } = options;
  const text = await safeFetchText(url, { providerName, ...rest });
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    const error = new Error(`${providerName}_invalid_json`);
    error.status = "invalid_json";
    throw error;
  }
}
