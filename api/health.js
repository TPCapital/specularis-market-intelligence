import { noStoreJson } from "../lib/utils.js";
import { getProviderHealth } from "../lib/ai-router.js";
import { getProviderCircuitState, safeFetchText, sanitizeProviderError } from "../lib/provider-utils.js";

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.length ? value : "";
}

async function upstashPing() {
  const base = envValue("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = envValue("UPSTASH_REDIS_REST_TOKEN");
  if (!base || !token) return { configured: false, ok: false, adapter: "memory" };
  try {
    const text = await safeFetchText(`${base}/ping`, {
      providerName: "upstash",
      timeoutMs: 2500,
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = JSON.parse(text || "{}");
    return { configured: true, ok: true, adapter: "upstash", status: 200, result: payload?.result || null };
  } catch (error) {
    return { configured: true, ok: false, adapter: "upstash", error: sanitizeProviderError(error) };
  }
}

export default async function handler(req, res) {
  if (String(req.query?.__provider_health || "") === "1") {
    noStoreJson(res, 200, getProviderHealth());
    return;
  }
  const upstash = await upstashPing();
  noStoreJson(res, 200, {
    ok: true,
    generatedAt: Date.now(),
    cache: upstash,
    providerCircuit: getProviderCircuitState(),
    env: {
      FINNHUB_API_KEY: !!envValue("FINNHUB_API_KEY"),
      TWELVEDATA_API_KEY: !!envValue("TWELVEDATA_API_KEY"),
      FRED_API_KEY: !!envValue("FRED_API_KEY"),
      ALPHAVANTAGE_API_KEY: !!envValue("ALPHAVANTAGE_API_KEY"),
      ANTHROPIC_API_KEY: !!envValue("ANTHROPIC_API_KEY"),
      OPENAI_API_KEY: !!envValue("OPENAI_API_KEY")
    }
  });
}
