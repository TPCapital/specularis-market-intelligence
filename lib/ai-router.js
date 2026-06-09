// lib/ai-router.js
// Specularis v1.5 unified AI provider router.

import { createHash } from "node:crypto";

export const AI_ROUTER_CACHE_TTL_MS = 20 * 60 * 1000;
const cache = globalThis.__SPECULARIS_AI_ROUTER_CACHE__ || new Map();
globalThis.__SPECULARIS_AI_ROUTER_CACHE__ = cache;

function env(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function priority() {
  return (env("AI_PROVIDER_PRIORITY") || "deepseek,gemini,doubao,hunyuan,local")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function hash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > AI_ROUTER_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCache(key, value) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 80) cache.delete(cache.keys().next().value);
}

function retryAfterSeconds(response) {
  const raw = response?.headers?.get?.("retry-after");
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(Math.ceil(seconds), 600);
  const dateMs = raw ? Date.parse(raw) : NaN;
  if (Number.isFinite(dateMs)) return Math.min(Math.max(Math.ceil((dateMs - Date.now()) / 1000), 1), 600);
  return 60;
}

async function postJson(url, body, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { rawText: text.slice(0, 2000) }; }
    if (!response.ok) {
      const error = new Error(`http_${response.status}`);
      error.httpStatus = response.status;
      error.retryAfterSeconds = retryAfterSeconds(response);
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function chatBody(model, prompt, lang) {
  const system = lang === "en"
    ? "Conservative market intelligence assistant. Research only. Mark proxy and missing data."
    : "保守型市场情报助手。仅供研究，必须标记 proxy 和缺失数据。";
  return {
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 1600
  };
}

async function deepseek(prompt, lang) {
  const key = env("DEEPSEEK_API_KEY");
  if (!key) throw new Error("missing_deepseek_api_key");
  const model = env("DEEPSEEK_MODEL") || "deepseek-chat";
  const payload = await postJson("https://api.deepseek.com/chat/completions", chatBody(model, prompt, lang), { Authorization: `Bearer ${key}` });
  return { provider: "deepseek", model, text: payload?.choices?.[0]?.message?.content?.trim?.() || "" };
}

async function gemini(prompt, lang) {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("missing_gemini_api_key");
  const model = env("GEMINI_PROMPT_MODEL") || env("GEMINI_MODEL") || "gemini-2.5-flash-lite";
  const prefix = lang === "en" ? "Return concise structured market analysis. Research only.\n\n" : "请返回简洁结构化市场分析。仅供研究。\n\n";
  const payload = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    contents: [{ role: "user", parts: [{ text: prefix + prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1600 }
  });
  const parts = payload?.candidates?.[0]?.content?.parts;
  return { provider: "gemini", model, text: Array.isArray(parts) ? parts.map((p) => p.text || "").join("\n").trim() : "" };
}

async function doubao(prompt, lang) {
  const key = env("ARK_API_KEY");
  if (!key) throw new Error("missing_ark_api_key");
  const model = env("ARK_MODEL") || env("DOUBAO_MODEL") || "doubao-seed-1-6-flash-250615";
  const base = env("ARK_API_BASE") || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  const payload = await postJson(base, chatBody(model, prompt, lang), { Authorization: `Bearer ${key}` });
  return { provider: "doubao", model, text: payload?.choices?.[0]?.message?.content?.trim?.() || "" };
}

async function hunyuan(prompt, lang) {
  const key = env("HUNYUAN_API_KEY");
  const base = env("HUNYUAN_API_BASE");
  if (!key) throw new Error("missing_hunyuan_api_key");
  if (!base) throw new Error("missing_hunyuan_api_base");
  const model = env("HUNYUAN_MODEL") || "hunyuan-lite";
  const payload = await postJson(base, chatBody(model, prompt, lang), { Authorization: `Bearer ${key}` });
  return { provider: "hunyuan", model, text: payload?.choices?.[0]?.message?.content?.trim?.() || "" };
}

const providers = { deepseek, gemini, doubao, ark: doubao, hunyuan };

function localText(prompt, question, lang, errors) {
  const clipped = String(prompt || "").slice(0, 1600);
  if (lang === "en") {
    return `Local fallback: external AI is unavailable or rate limited.\n${question ? `Question: ${question}\n` : ""}Review auto-intel context conservatively. Treat proxy/unavailable quote, trend, and options fields as no-trade warnings.\nProvider notes: ${errors.join(" | ") || "none"}\n\nContext:\n${clipped}`;
  }
  return `本地降级：外部 AI 不可用或额度受限。\n${question ? `问题：${question}\n` : ""}请保守复核 auto-intel 上下文；quote、trend、options 为 proxy/unavailable 时优先视为不可交易或等待。\nProvider 状态：${errors.join(" | ") || "none"}\n\n上下文：\n${clipped}`;
}

export async function routeAI({ prompt = "", question = "", lang = "zh", force = false } = {}) {
  const started = Date.now();
  const compactPrompt = String(prompt || "").slice(0, 9000);
  const key = hash({ prompt: compactPrompt, question, lang, priority: priority() });
  if (!force) {
    const hit = getCache(key);
    if (hit) return { ...hit, cacheHit: true, generatedAt: Date.now(), latencyMs: Date.now() - started };
  }

  const errors = [];
  let had429 = false;
  for (const name of priority()) {
    if (name === "local") break;
    const call = providers[name];
    if (!call) {
      errors.push(`${name}:unsupported`);
      continue;
    }
    try {
      const result = await call(compactPrompt, lang);
      if (!result.text) throw new Error(`${name}_empty_response`);
      const response = { status: "live", provider: result.provider, model: result.model, text: result.text, error: null, fallbackUsed: errors.length > 0, cacheHit: false, generatedAt: Date.now(), latencyMs: Date.now() - started };
      setCache(key, response);
      return response;
    } catch (error) {
      if (Number(error.httpStatus) === 429) had429 = true;
      errors.push(`${name}:${error.message}`);
    }
  }

  const response = {
    status: had429 ? "rate_limited" : "fallback",
    provider: "local",
    model: "specularis-local-rules-v1.5",
    text: localText(compactPrompt, question, lang, errors),
    error: errors.join(" | ") || null,
    fallbackUsed: true,
    cacheHit: false,
    generatedAt: Date.now(),
    latencyMs: Date.now() - started
  };
  setCache(key, response);
  return response;
}
