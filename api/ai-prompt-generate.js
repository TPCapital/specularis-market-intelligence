// api/ai-prompt-generate.js
// Specularis Market Terminal Lite v1.4.2 - Gemini-powered prompt automation.
// POST { lang, prompt, context }

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function noStoreJson(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(data);
}

function promptResponse({ status = "unavailable", source = "Gemini API", analysis = "", error = null, started = Date.now() }) {
  return {
    status,
    source,
    analysis,
    error,
    generatedAt: Date.now(),
    latencyMs: Date.now() - started,
  };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  if (typeof req.on !== "function") return {};
  return await new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function parseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part?.text || "").join("\n").trim();
}

function fallbackAnalysis(lang, prompt, reason) {
  const original = String(prompt || "").slice(0, 8000);
  if (lang !== "en") {
    return [
      `Gemini 自动分析暂不可用（${reason}）。`,
      "",
      "已保留可复制提示词，请先手动粘贴至 GPT Plus / Claude Pro / Gemini 进行完整分析。",
      "",
      "--- 原始提示词 ---",
      original,
    ].join("\n");
  }
  return [
    `Gemini automatic analysis is temporarily unavailable (${reason}).`,
    "",
    "The copyable prompt is preserved below. Paste it into GPT Plus / Claude Pro / Gemini for full analysis.",
    "",
    "--- Original Prompt ---",
    original,
  ].join("\n");
}

export default async function handler(req, res) {
  const started = Date.now();
  if (req.method === "OPTIONS") {
    return noStoreJson(res, 200, promptResponse({ status: "ok", source: "preflight", analysis: "", error: null, started }));
  }
  if (req.method !== "POST") {
    return noStoreJson(res, 405, promptResponse({ status: "error", source: "Gemini API", analysis: "", error: "method_not_allowed", started }));
  }

  const body = await readBody(req);
  const lang = body.lang === "en" ? "en" : "zh";
  const prompt = String(body.prompt || "").slice(0, 12000);
  const key = envValue("GEMINI_API_KEY");
  const model = envValue("GEMINI_PROMPT_MODEL") || envValue("GEMINI_MODEL") || "gemini-2.5-flash-lite";
  const source = `Gemini API · ${model}`;

  if (!prompt.trim()) {
    return noStoreJson(res, 200, promptResponse({ source, error: "missing_prompt", analysis: fallbackAnalysis(lang, prompt, "missing_prompt"), started }));
  }

  if (!key) {
    return noStoreJson(res, 200, promptResponse({ source, error: "missing_gemini_api_key", analysis: fallbackAnalysis(lang, prompt, "missing_gemini_api_key"), started }));
  }

  const systemInstruction = lang === "en"
    ? "You are a conservative market research assistant. Produce structured research only, not financial advice. Do not fabricate data. Clearly mark uncertainty and no-trade conditions."
    : "你是保守型美股信息流交易研究助手。只输出研究分析，不构成投资建议。不要编造数据；数据不足时明确说明，并突出不可交易条件。";

  const userText = `${systemInstruction}\n\n请基于以下 Specularis 终端提示词直接生成完整分析结果，不要要求用户再次粘贴。\n\n${prompt}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2200 },
      }),
    });
    if (!response.ok) throw new Error(`gemini_http_${response.status}`);
    const payload = await response.json();
    const analysis = parseText(payload);
    return noStoreJson(res, 200, promptResponse({
      status: analysis ? "live" : "unavailable",
      source,
      analysis: analysis || fallbackAnalysis(lang, prompt, "empty_gemini_response"),
      error: analysis ? null : "empty_gemini_response",
      started,
    }));
  } catch (error) {
    const reason = error?.message || "gemini_prompt_generation_failed";
    return noStoreJson(res, 200, promptResponse({
      status: "unavailable",
      source,
      error: reason,
      analysis: fallbackAnalysis(lang, prompt, reason),
      started,
    }));
  } finally {
    clearTimeout(timer);
  }
}
