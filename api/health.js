import { noStoreJson } from "../lib/utils.js";
import { getProviderHealth } from "../lib/ai-router.js";

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.length ? value : "";
}

async function upstashPing() {
  const base = envValue("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = envValue("UPSTASH_REDIS_REST_TOKEN");
  if (!base || !token) return { configured: false, ok: false, adapter: "memory" };
  try {
    const response = await fetch(`${base}/ping`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => null);
    return { configured: true, ok: response.ok, adapter: "upstash", status: response.status, result: payload?.result || null };
  } catch (error) {
    return { configured: true, ok: false, adapter: "upstash", error: error.message };
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
