// lib/market-terminal/fallbackData.js
// Static placeholder data for Specularis Market Terminal Lite.
// Every field is clearly labeled as "placeholder" or "manual" — never faked as live data.

export const WATCHLIST_TICKERS = ["MU","MRVL","NVDA","AVGO","AMD","TSM","ASML","PLTR","ORCL","SMCI"];

export const STOCK_INTEL_FALLBACK = WATCHLIST_TICKERS.map((ticker) => ({
  ticker,
  companyName: {
    MU: "Micron Technology", MRVL: "Marvell Technology", NVDA: "Nvidia",
    AVGO: "Broadcom", AMD: "AMD", TSM: "TSMC ADR", ASML: "ASML Holding ADR",
    PLTR: "Palantir", ORCL: "Oracle", SMCI: "Super Micro Computer"
  }[ticker] || ticker,
  sector: {
    MU: "AI 半导体 / 存储", MRVL: "AI 半导体 / ASIC", NVDA: "AI 半导体",
    AVGO: "AI 半导体 / 网络", AMD: "AI 半导体", TSM: "AI 半导体 / 代工",
    ASML: "半导体设备", PLTR: "AI 软件", ORCL: "AI 软件 / 云", SMCI: "AI 服务器"
  }[ticker] || "科技",
  themeTags: {
    MU: ["HBM", "AI内存", "数据中心"], MRVL: ["ASIC", "数据中心", "定制芯片"],
    NVDA: ["AI算力", "GPU", "数据中心"], AVGO: ["AI网络", "ASIC", "带宽"],
    AMD: ["GPU", "EPYC", "AI加速"], TSM: ["代工龙头", "先进制程", "苹果供应链"],
    ASML: ["EUV光刻", "半导体设备", "供应链垄断"], PLTR: ["AI软件", "政府合同", "AIP"],
    ORCL: ["AI云", "数据库", "企业SaaS"], SMCI: ["AI服务器", "液冷", "Nvidia生态"]
  }[ticker] || [],
  currentPrice: null,
  dailyChangePercent: null,
  volumeStatus: "placeholder",
  trendStatus: "placeholder",
  keySupport: null,
  keyResistance: null,
  recentNews: [],
  earningsDate: null,
  analystTone: "placeholder",
  institutionalSignal: "placeholder",
  insiderSignal: "placeholder",
  aiSummary: "等待手动输入或数据接入后生成分析摘要。",
  riskFlags: [],
  tradeRelevance: "watch",
  dataStatus: "placeholder",
  lastUpdated: null,
}));

export const OPTIONS_LITE_FALLBACK = WATCHLIST_TICKERS.map((ticker) => ({
  ticker,
  optionDataStatus: "lite-mode",
  ivStatus: "placeholder",
  earningsVolRisk: false,
  preferredStructure: "wait",
  reason: "IV / GEX 数据暂不可用。基于价格动量与市场状态生成代理信号。",
  invalidationCondition: "需要手动确认",
  riskLevel: "medium",
  notes: "免费版不接入真实期权大单流。",
  // Future paid API placeholders
  _future_gammaWall: null,
  _future_callWall: null,
  _future_putWall: null,
  _future_ivRank: null,
  _future_skew: null,
  _future_openInterest: null,
  _future_unusualOptionsFlow: null,
  dataStatus: "placeholder",
}));

export const KOL_DISTILLATION_FALLBACK = [];

export const AI_DECISION_FALLBACK = WATCHLIST_TICKERS.map((ticker) => ({
  ticker,
  score: null,
  rating: "placeholder",
  action: "watch",
  preferredVehicle: "no_trade",
  keyEntryZone: null,
  invalidationLevel: null,
  targetZone: null,
  reason: "等待数据质量改善后生成 A+ 评分。",
  riskWarning: "当前数据为占位符，不构成交易建议。",
  scoreBreakdown: {
    marketRegime: 0,
    stockTrend: 0,
    catalystQuality: 0,
    optionRiskReward: 0,
    kolConfirmation: 0,
    riskControlClarity: 0,
  },
  dataStatus: "placeholder",
}));
