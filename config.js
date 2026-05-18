window.DASHBOARD_CONFIG = {
  refreshSeconds: 60,

  // Optional deployment endpoints. Leave empty for static fallback mode.
  // Each endpoint must return JSON for its own module only; the app will not
  // use one source to synthesize another source's content.
  endpoints: {
    snapshot: "/api/snapshot",
    finnhub: "/api/finnhub",
    twelvedata: "/api/twelvedata",
    alphavantage: "/api/alphavantage",
    fred: "/api/fred",
    reddit: "/api/reddit",
    finvizHeatmap: "/api/finviz-heatmap",
    tradingViewScreener: "/api/tradingview-screener"
  },

  yahooSymbols: [
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
