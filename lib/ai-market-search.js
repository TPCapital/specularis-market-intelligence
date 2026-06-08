// lib/ai-market-search.js
// Specularis Market Terminal Lite v1.4.1 — deploy-safe Gemini market context helper
//
// Purpose:
// - Provide an optional AI context layer for news/catalyst explanation.
// - Never block deployment or the main dashboard when Gemini/Search is unavailable.
// - Avoid advanced Gemini Search/JSON-mode payload fields that may fail on some
//   accounts/models during deployment/runtime.

export const AI_MARKET_SEARCH_VERSION = "v1.4.1-safe";

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function parseGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part?.text || "").join("\n").trim();
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}

  // Gemini sometimes wraps JSON in ```json fences or adds short prose.
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    try { return JSON.parse(fenced); } catch {}
  }

  const start = String(text).indexOf("{");
  const end = String(text).lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(String(text).slice(start, end + 1)); } catch {}
  }
  return null;
}

function fallbackItems(tickers = [], reason = "ai_search_unavailable") {
  return tickers.map((ticker) => ({
    ticker,
    summary: "AI context temporarily unavailable. Use market data, news feed, and manual review.",
    catalysts: [],
    risks: [reason],
    sentiment: "neutral",
    confidence: "LOW",
    sources: [],
  }));
}

function normalizeItems(parsed, tickers = []) {
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const byTicker = new Map(rawItems.map((item) => [String(item?.ticker || "").toUpperCase(), item]));
  return tickers.map((ticker) => {
    const item = byTicker.get(ticker) || {};
    return {
      ticker,
      summary: String(item.summary || item.rawText || "No AI summary available."),
      catalysts: Array.isArray(item.catalysts) ? item.catalysts.slice(0, 5) : [],
      risks: Array.isArray(item.risks) ? item.risks.slice(0, 5) : [],
      sentiment: ["bullish", "neutral", "bearish"].includes(String(item.sentiment || "").toLowerCase())
        ? String(item.sentiment).toLowerCase()
        : "neutral",
      confidence: ["HIGH", "MEDIUM", "LOW"].includes(String(item.confidence || "").toUpperCase())
        ? String(item.confidence).toUpperCase()
        : "LOW",
      sources: Array.isArray(item.sources) ? item.sources.slice(0, 5) : [],
    };
  });
}

export async function runAIMarketSearch(tickers = [], opts = {}) {
  const key = envValue("GEMINI_API_KEY");
  const model = envValue("GEMINI_SEARCH_MODEL") || envValue("GEMINI_MODEL") || "gemini-2.5-flash-lite";
  const unique = [...new Set((tickers || []).map((ticker) => String(ticker || "").toUpperCase()).filter(Boolean))].slice(0, 10);

  if (!unique.length) {
    return { status: "unavailable", version: AI_MARKET_SEARCH_VERSION, error: "no_tickers", items: [], data: {} };
  }

  if (!key) {
    const items = fallbackItems(unique, "missing_gemini_api_key");
    return {
      status: "unavailable",
      source: "Gemini API",
      version: AI_MARKET_SEARCH_VERSION,
      generatedAt: Date.now(),
      error: "missing_gemini_api_key",
      items,
      data: Object.fromEntries(items.map((item) => [item.ticker, item])),
    };
  }

  const prompt = [
    "You are a research-only US equity intelligence assistant.",
    `Tickers: ${unique.join(", ")}`,
    "Return JSON only with this shape:",
    '{"items":[{"ticker":"NVDA","summary":"short latest context","catalysts":["item"],"risks":["item"],"sentiment":"bullish|neutral|bearish","confidence":"HIGH|MEDIUM|LOW","sources":[]}] }',
    "Rules: no financial advice, no fabricated sources, mark uncertainty, focus on latest catalysts, earnings, analyst commentary, regulation, sector context.",
  ].join("\n\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(opts.timeoutMs || 8000));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1400 },
      }),
    });

    if (!response.ok) throw new Error(`gemini_http_${response.status}`);

    const payload = await response.json();
    const text = parseGeminiText(payload);
    const parsed = safeJsonParse(text) || { items: unique.map((ticker) => ({ ticker, rawText: text })) };
    const items = normalizeItems(parsed, unique);

    return {
      status: "live",
      source: `Gemini API · ${model}`,
      version: AI_MARKET_SEARCH_VERSION,
      generatedAt: Date.now(),
      items,
      data: Object.fromEntries(items.map((item) => [item.ticker, item])),
      groundingMetadata: payload?.candidates?.[0]?.groundingMetadata || null,
    };
  } catch (error) {
    const items = fallbackItems(unique, error?.message || "ai_market_search_failed");
    return {
      status: "unavailable",
      source: `Gemini API · ${model}`,
      version: AI_MARKET_SEARCH_VERSION,
      generatedAt: Date.now(),
      error: error?.message || "ai_market_search_failed",
      items,
      data: Object.fromEntries(items.map((item) => [item.ticker, item])),
    };
  } finally {
    clearTimeout(timer);
  }
}
