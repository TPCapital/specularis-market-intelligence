// lib/ai-market-search.js
// Specularis Market Terminal Lite v1.4.1 — ultra-safe stub
//
// This module is intentionally minimal to guarantee Vercel deployment.
// It does not call Gemini during build/runtime. Re-enable live Gemini search
// only after the main deployment is stable.

export const AI_MARKET_SEARCH_VERSION = "v1.4.1-ultra-safe";

function normalizeTickers(tickers = []) {
  return [...new Set((tickers || [])
    .map((ticker) => String(ticker || "").toUpperCase().trim())
    .filter((ticker) => /^[A-Z]{1,6}$/.test(ticker))
  )].slice(0, 10);
}

function buildItem(ticker, reason = "ai_market_search_disabled_for_deploy_safety") {
  return {
    ticker,
    summary: "AI context layer is temporarily disabled to keep deployment stable. Use market data, news feed, TickFlow debug, and manual review.",
    catalysts: [],
    risks: [reason],
    sentiment: "neutral",
    confidence: "LOW",
    sources: [],
  };
}

export async function runAIMarketSearch(tickers = [], opts = {}) {
  const unique = normalizeTickers(tickers);
  const items = unique.map((ticker) => buildItem(ticker));
  return {
    status: "disabled",
    source: "AI Market Search Stub",
    version: AI_MARKET_SEARCH_VERSION,
    generatedAt: Date.now(),
    error: null,
    items,
    data: Object.fromEntries(items.map((item) => [item.ticker, item])),
    note: "Deploy-safe stub. Gemini live search intentionally disabled until deployment is stable.",
  };
}
