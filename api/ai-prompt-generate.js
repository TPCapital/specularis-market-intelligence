// api/ai-prompt-generate.js
// Backing function for /api/ai-router via Vercel rewrite.

import { routeAI } from "../lib/ai-router.js";
import { sanitizeProviderError } from "../lib/provider-utils.js";

function noStoreJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(payload);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return noStoreJson(res, 200, { status: "ok", provider: "preflight", model: null, text: "", analysis: "", error: null, fallbackUsed: false, generatedAt: Date.now(), latencyMs: 0 });
  if (req.method !== "POST") return noStoreJson(res, 405, { status: "error", provider: "router", model: null, text: "", analysis: "", error: "method_not_allowed", fallbackUsed: true, generatedAt: Date.now(), latencyMs: 0 });

  const body = await readBody(req);
  const result = await routeAI({
    prompt: String(body.prompt || ""),
    context: String(body.context || body.prompt || ""),
    question: String(body.question || ""),
    mode: String(body.mode || "analysis"),
    lang: body.lang === "en" ? "en" : "zh",
    force: Boolean(body.force)
  });

  return noStoreJson(res, 200, {
    ...result,
    source: "AI Router",
    displayProvider: "AI Router",
    error: result.error ? sanitizeProviderError(result.error) : null,
    analysis: result.text || ""
  });
}
