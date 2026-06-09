window.DASHBOARD_CONFIG = {
  refreshSeconds: 300,

  // Vercel Hobby-compatible architecture: snapshot is the primary public dashboard API.
  // Auto-intel is loaded by modules/specularis-terminal-lite.js to avoid duplicate bootstraps.
  endpoints: {
    snapshot: "/api/snapshot",
    dailyReport: "/api/daily-report",
    health: "/api/health",
    tradeDecision: "/api/trade-decision"
  },

  marketSymbols: [
    "SPY",
    "QQQ",
    "^ND