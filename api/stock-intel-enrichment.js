// api/stock-intel-enrichment.js
// Backing function for /api/auto-intel via Vercel rewrite.

import { buildAutoIntel } from "../lib/auto-intel.js";

function noStoreJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(payload);
}

function legacyCompat(payload = {}) {
  const data = {};
  for (const [ticker, row] of Object.entries(payload.tickers || {})) {
    data[ticker] = {
      ticker,
      enrichment: {
        status: row.quote?.status || "fallback",
        tradeRelevance: row.decision?.action || "watch",
        keySupport: row.decision?.keyEntryZone || null,
        keyResistance: row.decision?.targetZone || null,
        tradeRelevanceReason: row.decision?.reason || null
      },
      options: row.options || { status: "unavailable" },
      news: row.news || [],
      enrichedAt: payload.generatedAt || Date.now()
    };
  }
  return { status: payload.status || "fallback", version: "v1.5-auto-intel-compat", generatedAt: payload.generatedAt || Date.now(), data };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return noStoreJson(res, 200, { status: "ok", generatedAt: Date.now(), tickers: {} });
  if (req.method !== "GET") return noStoreJson(res, 405, { status: "error", error: "method_not_allowed", generatedAt: Date.now(), tickers: {} });
  try {
    const payload = await buildAutoIntel(req.query?.tickers || "");
    if (String(req.url || "").includes("/api/stock-intel-enrichment")) return noStoreJson(res, 200, legacyCompat(payload));
    return noStoreJson(res, 200, payload);
  } catch (error) {
    return noStoreJson(res, 200, {
      status: "fallback",
      error: error?.message || "auto_intel_failed",
      generatedAt: Date.now(),
      tickers: {}
    });
  }
}
