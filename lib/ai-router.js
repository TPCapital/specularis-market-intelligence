// lib/ai-router.js
// Specularis v1.5.1 multi-provider AI router hardening.

import { createHash } from "node:crypto";

const DEFAULT_PRIORITY = "deepseek,xiaomi,chatanywhere,gemini,agnes,local";
const DEFAULT_CACHE_TTL_SECONDS = 1200;
const DEFAULT_PROVIDER_TIMEOUT_MS = 8000;
const cache = globalThis.__SPECULARIS_AI_ROUTER_CACHE__ || new Map();
const providerState = globalThis.__SPECULARIS_AI_PROVIDER_STATE__ || {};
globalThis.__SPECULARIS_AI_ROUTER_CACHE__ = cache;
globalThis.__SPECULARIS_AI_PROVIDER_STATE__ = providerState;

function env(name) { const v = process.env[name]; return typeof v === "string" && v.trim() ? v.trim() : ""; }
function envAny(names) { for (const n of names) { const v = env(n); if (v) return v; } return ""; }
function intEnv(name, fallback) { const n = Number(env(name)); return Number.isFinite(n) && n > 0 ? n : fallback; }
function ms() { return Date.now(); }
function providerPriority() { return (env("AI_PROVIDER_PRIORITY") || DEFAULT_PRIORITY).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean); }
function cacheTtlMs() { return intEnv("AI_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS) * 1000; }
function providerTimeoutMs() { return intEnv("AI_PROVIDER_TIMEOUT_MS", DEFAULT_PROVIDER_TIMEOUT_MS); }
function hash(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function stateFor(provider) { if (!providerState[provider]) providerState[provider] = { disabledUntil: 0, lastError: null, lastStatus: null, lastAttemptAt: null }; return providerState[provider]; }
function getCache(key) { const hit = cache.get(key); if (!hit) return null; if (ms() - hit.cachedAt > cacheTtlMs()) { cache.delete(key); return null; } return hit.response; }
function setCache(key, response) { cache.set(key, { cachedAt: ms(), response }); if (cache.size > 120) cache.delete(cache.keys().next().value); }
function retryAfterSeconds(response) { const raw = response?.headers?.get?.("retry-after"); const n = Number(raw); if (Number.isFinite(n) && n > 0) return Math.min(Math.ceil(n), 1800); const d = raw ? Date.parse(raw) : NaN; return Number.isFinite(d) ? Math.min(Math.max(Math.ceil((d - ms()) / 1000), 1), 1800) : null; }
function classify(status) { if (status === 401 || status === 403) return "auth_failed"; if (status === 429) return "rate_limited"; if (status >= 500) return "upstream_error"; return "request_failed"; }
function cooldown(type, retryAfter) { if (type === "auth_failed") return 30 * 60 * 1000; if (type === "rate_limited") return (retryAfter || 300) * 1000; if (type === "upstream_error") return 3 * 60 * 1000; if (type === "timeout") return 2 * 60 * 1000; return 60 * 1000; }
function trip(provider, type, error, retryAfter = null, status = null) { const st = stateFor(provider); st.disabledUntil = ms() + cooldown(type, retryAfter); st.lastError = error || type; st.lastStatus = status || type; st.lastAttemptAt = ms(); }
function result({ status, provider, model, text = "", error = null, fallbackUsed = false, cacheHit = false, started = ms() }) { return { status, provider, model, text, error, fallbackUsed, cacheHit, generatedAt: ms(), latencyMs: ms() - started }; }

function providerConfig(provider) {
  if (provider === "deepseek") return { provider, configured: Boolean(env("DEEPSEEK_API_KEY")), apiKey: env("DEEPSEEK_API_KEY"), baseUrl: env("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1", model: env("DEEPSEEK_MODEL") || "deepseek-chat", headers: {} };
  if (provider === "xiaomi") { const apiKey = envAny(["XIAOMI_API_KEY", "MIMO_API_KEY", "xiaomi"]); return { provider, configured: Boolean(apiKey), apiKey, baseUrl: env("XIAOMI_BASE_URL") || "https://api.xiaomimimo.com/v1", model: env("XIAOMI_MODEL") || "mimo-v2.5-pro", headers: { "api-key": apiKey } }; }
  if (provider === "chatanywhere") { const apiKey = envAny(["CHATANYWHERE_API_KEY", "GPT_API_FREE_KEY", "GPT_API_free"]); return { provider, configured: Boolean(apiKey), apiKey, baseUrl: env("CHATANYWHERE_BASE_URL") || "https://api.chatanywhere.tech/v1", model: env("CHATANYWHERE_MODEL") || "gpt-4.1-mini", headers: {} }; }
  if (provider === "agnes") { const apiKey = envAny(["AGNES_API_KEY", "agnes_ai"]); const baseUrl = env("AGNES_BASE_URL"); const model = env("AGNES_MODEL"); return { provider, configured: Boolean(apiKey && baseUrl && model), apiKey, baseUrl, model, headers: {} }; }
  if (provider === "gemini") return { provider, configured: Boolean(env("GEMINI_API_KEY")), apiKey: env("GEMINI_API_KEY"), baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: env("GEMINI_MODEL") || env("GEMINI_PROMPT_MODEL") || "gemini-2.5-flash-lite", headers: {} };
  return { provider, configured: provider === "local", apiKey: "", baseUrl: "", model: provider === "local" ? "specularis-local-rules-v1.5.1" : "", headers: {} };
}

export function getProviderHealth() {
  const providers = {};
  for (const name of ["deepseek", "xiaomi", "chatanywhere", "gemini", "agnes", "local"]) {
    const cfg = providerConfig(name); const st = stateFor(name);
    providers[name] = { configured: name === "local" ? true : Boolean(cfg.configured), available: name === "local" ? true : Boolean(cfg.configured && (!st.disabledUntil || st.disabledUntil <= ms())), disabledUntil: st.disabledUntil || null, lastError: st.lastError || null };
  }
  return { status: "ok", providers };
}

function buildMessages({ prompt = "", context = "", question = "", mode = "analysis", lang = "zh" }) {
  const userText = [context || prompt, question ? `Question: ${question}` : "", `Mode: ${mode}`].filter(Boolean).join("\n\n").slice(0, 9000);
  const system = lang === "en" ? "You are a conservative market intelligence assistant. Research only, no financial advice. Mark proxy, unavailable, stale, and uncertain data clearly." : "你是保守型市场情报分析助手。仅供研究，不构成投资建议。必须明确标记 proxy、unavailable、stale 和不确定数据。";
  return [{ role: "system", content: system }, { role: "user", content: userText }];
}

export async function callOpenAICompatibleProvider({ provider, baseUrl, apiKey, model, messages, headers = {} }) {
  const started = ms();
  if (!apiKey || !baseUrl || !model) return result({ status: "not_configured", provider, model: model || null, error: "not_configured", started });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), providerTimeoutMs());
  try {
    const response = await fetch(`${String(baseUrl).replace(/\/+$/, "")}/chat/completions`, { method: "POST", cache: "no-store", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...headers }, body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 1200, stream: false }) });
    const text = await response.text(); let payload = null; try { payload = text ? JSON.parse(text) : null; } catch { payload = { rawText: text.slice(0, 1000) }; }
    if (!response.ok) { const type = classify(response.status); trip(provider, type, `${provider}_${type}_${response.status}`, retryAfterSeconds(response), response.status); return result({ status: type, provider, model, error: `${provider}_http_${response.status}`, started }); }
    const content = payload?.choices?.[0]?.message?.content?.trim?.() || "";
    if (!content) return result({ status: "upstream_error", provider, model, error: `${provider}_empty_response`, started });
    Object.assign(stateFor(provider), { lastError: null, lastStatus: "ok", lastAttemptAt: ms() });
    return result({ status: "live", provider, model, text: content, started });
  } catch (error) { const type = error?.name === "AbortError" ? "timeout" : "upstream_error"; trip(provider, type, `${provider}_${type}`); return result({ status: type, provider, model, error: `${provider}_${type}`, started }); }
  finally { clearTimeout(timer); }
}

async function callGeminiProvider({ apiKey, model, messages }) {
  const provider = "gemini"; const started = ms();
  if (!apiKey || !model) return result({ status: "not_configured", provider, model, error: "not_configured", started });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), providerTimeoutMs());
  try {
    const userText = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", cache: "no-store", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: userText }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1200 } }) });
    const text = await response.text(); let payload = null; try { payload = text ? JSON.parse(text) : null; } catch { payload = { rawText: text.slice(0, 1000) }; }
    if (!response.ok) { const type = classify(response.status); trip(provider, type, `gemini_${type}_${response.status}`, retryAfterSeconds(response), response.status); return result({ status: type, provider, model, error: `gemini_http_${response.status}`, started }); }
    const parts = payload?.candidates?.[0]?.content?.parts; const content = Array.isArray(parts) ? parts.map((p) => p.text || "").join("\n").trim() : "";
    if (!content) return result({ status: "upstream_error", provider, model, error: "gemini_empty_response", started });
    Object.assign(stateFor(provider), { lastError: null, lastStatus: "ok", lastAttemptAt: ms() });
    return result({ status: "live", provider, model, text: content, started });
  } catch (error) { const type = error?.name === "AbortError" ? "timeout" : "upstream_error"; trip(provider, type, `gemini_${type}`); return result({ status: type, provider, model, error: `gemini_${type}`, started }); }
  finally { clearTimeout(timer); }
}

function localFallback({ prompt, context, question, mode, lang, errors }) {
  const clipped = String(context || prompt || "").slice(0, 1600);
  if (lang === "en") return `Local rules summary. External AI providers are unavailable, cooling down, or not configured.\nMode: ${mode || "analysis"}\n${question ? `Question: ${question}\n` : ""}Use the auto-intel context conservatively. Treat missing quote, proxy trend, unavailable options, and stale news as no-trade warnings.\nProvider notes: ${errors.join(" | ") || "none"}\n\nContext excerpt:\n${clipped}`;
  return `本地规则摘要：外部 AI 当前不可用、冷却中或未配置。\n模式：${mode || "analysis"}\n${question ? `问题：${question}\n` : ""}请保守使用 auto-intel 上下文；quote 缺失、trend 为 proxy、options unavailable、新闻 stale 时优先视为不可交易或等待。\nProvider 状态：${errors.join(" | ") || "none"}\n\n上下文摘录：\n${clipped}`;
}

export async function routeAI({ prompt = "", context = "", question = "", mode = "analysis", lang = "zh", force = false } = {}) {
  const started = ms(); const normalizedContext = String(context || prompt || "").slice(0, 9000); const normalizedQuestion = String(question || ""); const normalizedMode = String(mode || "analysis");
  const key = hash({ context: normalizedContext, question: normalizedQuestion, mode: normalizedMode, lang });
  if (!force) { const hit = getCache(key); if (hit) return { ...hit, cacheHit: true, generatedAt: ms(), latencyMs: ms() - started }; }
  const messages = buildMessages({ prompt, context: normalizedContext, question: normalizedQuestion, mode: normalizedMode, lang });
  const errors = []; let fallbackUsed = false;
  for (const name of providerPriority()) {
    if (name === "local") break;
    const cfg = providerConfig(name); const st = stateFor(name);
    if (!cfg.configured) { errors.push(`${name}:not_configured`); fallbackUsed = true; continue; }
    if (st.disabledUntil && st.disabledUntil > ms()) { errors.push(`${name}:cooldown`); fallbackUsed = true; continue; }
    const r = name === "gemini" ? await callGeminiProvider({ apiKey: cfg.apiKey, model: cfg.model, messages }) : await callOpenAICompatibleProvider({ provider: name, baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, messages, headers: cfg.headers });
    if (r.status === "live" && r.text) { const response = result({ status: "live", provider: r.provider, model: r.model, text: r.text, error: null, fallbackUsed, cacheHit: false, started }); setCache(key, response); return response; }
    errors.push(`${name}:${r.status}`); fallbackUsed = true;
  }
  const response = result({ status: "fallback", provider: "local", model: "specularis-local-rules-v1.5.1", text: localFallback({ prompt, context: normalizedContext, question: normalizedQuestion, mode: normalizedMode, lang, errors }), error: errors.join(" | ") || null, fallbackUsed: true, cacheHit: false, started });
  setCache(key, response); return response;
}
