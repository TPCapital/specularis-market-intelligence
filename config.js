window.DASHBOARD_CONFIG = {
  refreshSeconds: 300,

  // Vercel Hobby-compatible architecture: snapshot is the only public API.
  endpoints: {
    snapshot: "/api/snapshot",
    dailyReport: "/api/daily-report",
    health: "/api/health",
    tradeDecision: "/api/trade-decision"
  },

  marketSymbols: [
    "SPY",
    "QQQ",
    "^NDX",
    "^VIX",
    "^TNX",
    "GC=F",
    "DX-Y.NYB",
    "NVDA",
    "AMD",
    "AVGO",
    "MRVL",
    "SMCI",
    "MSFT",
    "AAPL",
    "AMZN",
    "GOOGL",
    "META",
    "TSLA",
    "PLTR",
    "ORCL",
    "CRWD",
    "PANW",
    "COIN",
    "MSTR",
    "XOM",
    "CVX",
    "JPM",
    "LLY",
    "DASH",
    "CSCO"
  ]
};
