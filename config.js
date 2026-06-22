window.SPECULARIS_V9_CONFIG = {
  version: "9.0.0",
  refreshSeconds: 300,
  eventPollSeconds: 60,
  endpoints: {
    snapshot: "/api/snapshot",
    dailyReport: "/api/daily-report",
    health: "/api/health",
    tradeDecision: "/api/trade-decision",
    stockIntelEnrichment: "/api/stock-intel-enrichment",
    congressIntel: "/api/congress-intel",
    dailyBriefing: "/api/daily-briefing",
    eventMonitor: "/api/event-monitor"
  },
  watchlist: ["NVDA","AMD","AVGO","MRVL","MU","TSM","ASML","PLTR","ORCL","SMCI"],
  indexSymbols: ["SPY","QQQ","NVDA","AMD","AVGO","MRVL","SMCI","PLTR","ORCL","MU"]
};
