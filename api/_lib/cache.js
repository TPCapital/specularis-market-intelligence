const MEMORY_CACHE = new Map();
const IN_FLIGHT_REFRESHES = new Map();

let redisClientPromise = null;

function nowMs() {
  return Date.now();
}

function normalizeTtl(ttlSeconds) {
  const parsed = Number(ttlSeconds);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

function isRateLimitError(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
  return status === 429 || /\b429\b|rate\s*limit|too\s*many\s*requests/i.test(String(error?.message || error || ""));
}

function serializePayload(data, meta = {}) {
  return {
    data,
    meta: {
      cachedAt: nowMs(),
      source: meta.source || "external",
      ttlSeconds: meta.ttlSeconds || null,
      ...meta,
    },
  };
}

function getAgeSeconds(entry) {
  const cachedAt = Number(entry?.meta?.cachedAt || 0);
  if (!cachedAt) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((nowMs() - cachedAt) / 1000));
}

async function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  try {
    const { Redis } = await import("@upstash/redis");
    return new Redis({ url, token });
  } catch (error) {
    console.warn("[cache] Upstash Redis unavailable; using memory fallback", error?.message || error);
    return null;
  }
}

async function redis() {
  if (!redisClientPromise) redisClientPromise = createRedisClient();
  return redisClientPromise;
}

async function readCache(key) {
  const client = await redis();
  if (client) {
    try {
      const value = await client.get(key);
      if (value) return value;
    } catch (error) {
      console.warn("[cache] Redis read failed; using memory fallback", key, error?.message || error);
    }
  }
  return MEMORY_CACHE.get(key) || null;
}

async function writeCache(key, payload, ttlSeconds) {
  const maxAge = Math.max(normalizeTtl(ttlSeconds) * 2, normalizeTtl(ttlSeconds) + 30);
  MEMORY_CACHE.set(key, payload);

  const client = await redis();
  if (!client) return;

  try {
    await client.set(key, payload, { ex: maxAge });
  } catch (error) {
    console.warn("[cache] Redis write failed; memory cache retained", key, error?.message || error);
  }
}

async function refreshCache(key, fetcher, ttlSeconds, meta = {}) {
  if (IN_FLIGHT_REFRESHES.has(key)) return IN_FLIGHT_REFRESHES.get(key);

  const task = Promise.resolve()
    .then(fetcher)
    .then(async (freshData) => {
      const payload = serializePayload(freshData, { ...meta, ttlSeconds: normalizeTtl(ttlSeconds), refreshedBy: "swr" });
      await writeCache(key, payload, ttlSeconds);
      return payload;
    })
    .catch((error) => {
      console.warn("[cache] background refresh failed", key, error?.message || error);
      return null;
    })
    .finally(() => IN_FLIGHT_REFRESHES.delete(key));

  IN_FLIGHT_REFRESHES.set(key, task);
  return task;
}

export async function fetchWithSWR(key, ttlSeconds, fetcher, options = {}) {
  if (!key || typeof fetcher !== "function") {
    throw new Error("fetchWithSWR requires a cache key and fetcher function");
  }

  const ttl = normalizeTtl(ttlSeconds);
  const staleTtl = Number(options.staleTtlSeconds || ttl * 2);
  const meta = { source: options.source || key, layer: options.layer || "unspecified" };
  const cached = await readCache(key);
  const age = getAgeSeconds(cached);

  if (cached && age < ttl) {
    return {
      data: cached.data,
      cache: {
        status: "fresh",
        key,
        ageSeconds: age,
        ttlSeconds: ttl,
        source: cached.meta?.source || meta.source,
      },
    };
  }

  if (cached && age < staleTtl) {
    refreshCache(key, fetcher, ttl, meta);
    return {
      data: cached.data,
      cache: {
        status: "stale-while-revalidate",
        key,
        ageSeconds: age,
        ttlSeconds: ttl,
        staleTtlSeconds: staleTtl,
        source: cached.meta?.source || meta.source,
      },
    };
  }

  try {
    const freshData = await fetcher();
    const payload = serializePayload(freshData, { ...meta, ttlSeconds: ttl, refreshedBy: "blocking" });
    await writeCache(key, payload, ttl);
    return {
      data: freshData,
      cache: {
        status: cached ? "refreshed-expired" : "miss",
        key,
        ageSeconds: 0,
        ttlSeconds: ttl,
        source: meta.source,
      },
    };
  } catch (error) {
    if (cached) {
      return {
        data: cached.data,
        cache: {
          status: isRateLimitError(error) ? "rate-limit-fallback" : "error-fallback",
          key,
          ageSeconds: age,
          ttlSeconds: ttl,
          staleTtlSeconds: staleTtl,
          source: cached.meta?.source || meta.source,
          error: error?.message || String(error),
        },
      };
    }
    throw error;
  }
}

export const CACHE_TTL = Object.freeze({
  MACRO: 600,
  MICRO: 30,
});

export function clearMemoryCacheForTests() {
  MEMORY_CACHE.clear();
  IN_FLIGHT_REFRESHES.clear();
}
