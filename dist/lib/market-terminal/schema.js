// lib/market-terminal/schema.js
// Specularis Market Terminal Lite — snapshot schema & validation helpers.

export const SNAPSHOT_META = {
  version: "specularis-market-terminal-lite-v1",
  dataMode: "free-lite",
  aiMode: "human-in-the-loop",
};

export function buildSnapshotMeta(overrides = {}) {
  return {
    ...SNAPSHOT_META,
    generatedAt: new Date().toISOString(),
    dataQuality: "mixed",
    ...overrides,
  };
}

// Validate a stock intel entry has required fields.
export function validateStockIntel(entry = {}) {
  return typeof entry.ticker === "string" && entry.ticker.length > 0;
}

// Validate a KOL entry has minimum required fields.
export function validateKolEntry(entry = {}) {
  return (
    typeof entry.kolHandle === "string" &&
    entry.kolHandle.length > 0 &&
    typeof entry.postText === "string" &&
    entry.postText.length > 0
  );
}

// Validate an AI decision entry.
export function validateDecisionEntry(entry = {}) {
  return typeof entry.ticker === "string" && entry.ticker.length > 0;
}

// Allowed signal stances for KOL distillation.
export const KOL_STANCES = ["bullish", "bearish", "neutral", "mixed", "unclear"];
export const KOL_SIGNAL_TYPES = [
  "explicit_position",
  "strong_opinion",
  "discussion_only",
  "news_commentary",
  "joke_or_noise",
];
export const KOL_CONVICTION_LEVELS = ["high", "medium", "low"];

// Options lite — allowed structure recommendations.
export const OPTIONS_STRUCTURES = [
  "stock",
  "long_call",
  "call_spread",
  "put_spread",
  "wait",
  "avoid",
];

// Decision layer — ratings and actions.
export const DECISION_RATINGS = ["A+", "A", "B", "C", "Avoid"];
export const DECISION_ACTIONS = [
  "tradable",
  "watch",
  "wait_for_pullback",
  "avoid",
];
export const DECISION_VEHICLES = [
  "stock",
  "option",
  "call_spread",
  "no_trade",
];

// Data status badges.
export const DATA_STATUS_LABELS = {
  live: "🟢 Live",
  cached: "🟡 Cached",
  manual: "🔵 Manual",
  placeholder: "⚪ Placeholder",
  unavailable: "🔴 N/A",
};
