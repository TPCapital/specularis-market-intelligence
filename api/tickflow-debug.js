// api/tickflow-debug.js
// Specularis Market Terminal Lite v1.4.1 — TickFlow market-data diagnostic endpoint
// GET /api/tickflow-debug?tickers=NVDA,AMD,MU

import { fetchTickFlowForTickers, getTickFlowConfig, tickFlowEnvDebug } from "../lib/tickflow-adapter.js";

const DEFAULT_TICKERS = ["NVDA", "AMD", "MU", "MRVL"];

function noStoreJson(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(data);
}

function parseTickers(req) {
  const raw = String(req.query?.tickers || "").toUpperCase().replace(/[^A-Z,]/g, "");
  return raw ? [...new Set(raw.split(",").filter((t) => /^[A-Z]{1,6}$/.test(t)))].slice(0, 12) : DEFAULT_TICKERS;
}

export default async function handler(req, res) {
  const started = Date.now();
  const tickers = parseTickers(req);
  const cfg = getTickFlowConfig();
  try {
    const result = await fetchTickFlowForTickers(tickers, { timeoutMs: 3500, concurrency: 2 });
    noStoreJson(res, 200, {
      status: result.status,
      version: "v1.4.1",
      generatedAt: Date.now(),
      latencyMs: Date.now() - started,
      envDebug: tickFlowEnvDebug(),
      config: {
        hasApiKey: Boolean(cfg.apiKey),
        hasBaseUrl: Boolean(cfg.baseUrl),
        hasEndpointTemplate: Boolean(cfg.endpointTemplate),
        authMode: cfg.authMode,
      },
      tickers,
      data: Object.fromEntries(result.items.map((item) => [item.ticker, item])),
      note: "TickFlow free dashboard shows quote/K-line capacity. If unavailable with missing_tickflow_endpoint_or_base_url, add TICKFLOW_BASE_URL or TICKFLOW_QUOTE_ENDPOINT_TEMPLATE / TICKFLOW_KLINE_ENDPOINT_TEMPLATE after obtaining docs.",
    });
  } catch (error) {
    noStoreJson(res, 200, {
      status: "error",
      version: "v1.4.1",
      generatedAt: Date.now(),
      latencyMs: Date.now() - started,
      envDebug: tickFlowEnvDebug(),
      tickers,
      error: error?.message || "tickflow_debug_failed",
    });
  }
}
