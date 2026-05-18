const CONFIG = window.DASHBOARD_CONFIG || {};
const REFRESH_SECONDS = CONFIG.refreshSeconds || 90;
const CACHE_PREFIX = "ai-us-equity-dashboard:";
const FALLBACK_SNAPSHOT_LABEL = "快照数据（SNAPSHOT）";
const CACHE_TRADABLE_MS = 15 * 60 * 1000;
const STATUS_WEIGHT = { live: 1, delayed: 0.75, proxy: 0.35, cached: 0.25, snapshot: 0.1, unavailable: 0 };
const SOURCE_WEIGHT = { finnhub: 0.24, twelveData: 0.22, relativeVolume: 0.2, earnings: 0.17, marketBreadth: 0.17 };

const sourceCatalog = {
  finnhub: "Finnhub",
  twelveData: "TwelveData",
  alphavantage: "AlphaVantage",
  fred: "FRED",
  earnings: "Earnings Layer",
  insider: "Insider Layer",
  relativeVolume: "Relative Volume Scanner",
  marketBreadth: "Market Breadth Engine",
  yahoo: "Yahoo Finance",
  tradingView: "TradingView Screener",
  xMacro: "Walter Bloomberg X / Kobeissi X",
  finnhubInsider: "Finnhub Insider",
  finnhubEarnings: "Finnhub Earnings",
  reddit: "WallStreetBets Reddit",
  finviz: "Finviz Heatmap",
  unusualWhales: "Options Flow Proxy",
  benzinga: "Benzinga"
};

const symbolMeta = {
  SPY: ["SPDR S&P 500 ETF", "指数 ETF"],
  QQQ: ["Invesco QQQ", "指数 ETF"],
  NVDA: ["Nvidia", "AI 半导体"],
  AMD: ["AMD", "AI 半导体"],
  AVGO: ["Broadcom", "AI 半导体"],
  MRVL: ["Marvell", "AI 半导体"],
  SMCI: ["Super Micro", "AI 服务器"],
  MSFT: ["Microsoft", "大型科技"],
  AAPL: ["Apple", "大型科技"],
  AMZN: ["Amazon", "大型科技"],
  GOOGL: ["Alphabet", "大型科技"],
  META: ["Meta", "大型科技"],
  TSLA: ["Tesla", "动量科技"],
  PLTR: ["Palantir", "AI 软件"],
  ORCL: ["Oracle", "AI 软件"],
  CRM: ["Salesforce", "云计算"],
  SNOW: ["Snowflake", "云计算"],
  CRWD: ["CrowdStrike", "网络安全"],
  PANW: ["Palo Alto", "网络安全"],
  COIN: ["Coinbase", "加密资产"],
  MSTR: ["MicroStrategy", "加密资产"],
  XOM: ["Exxon Mobil", "能源"],
  CVX: ["Chevron", "能源"],
  JPM: ["JPMorgan", "金融"],
  GS: ["Goldman Sachs", "金融"],
  LLY: ["Eli Lilly", "医疗"],
  UNH: ["UnitedHealth", "医疗"],
  DASH: ["DoorDash", "消费科技"],
  NFLX: ["Netflix", "消费科技"],
  CSCO: ["Cisco", "AI 网络"],
  SMR: ["NuScale Power", "核能"],
  OKLO: ["Oklo", "核能"],
  NNE: ["Nano Nuclear", "核能"],
  UEC: ["Uranium Energy", "铀矿"]
};

const fallback = {
  yahoo: {
    indices: [
      metric("SPY", "S&P 500 ETF", 689.12, 0.31, "快照数据（SNAPSHOT）：宽基风险资产仍有承接。"),
      metric("QQQ", "Nasdaq ETF", 612.4, 0.46, "快照数据（SNAPSHOT）：科技权重占优。"),
      metric("NDX", "Nasdaq 100", 25172.18, 0.48, "快照数据（SNAPSHOT）：科技风险偏好代理。"),
      metric("VIX", "Volatility", 13.62, -2.01, "快照数据（SNAPSHOT）：尾部风险定价。"),
      metric("TNX", "10Y Yield", 4.12, 0.87, "快照数据（SNAPSHOT）：长端利率锚。"),
      metric("DXY", "Dollar Index", 98.36, -0.11, "快照数据（SNAPSHOT）：美元流动性代理。"),
      metric("GOLD", "Gold", 3378.4, -0.24, "快照数据（SNAPSHOT）：避险资产代理。")
    ],
    quotes: [
      quote("CSCO", 79.9, 15.03, 3.6),
      quote("PLTR", 227.4, 4.82, 2.9),
      quote("NVDA", 188.2, 2.35, 2.1),
      quote("MRVL", 93.4, 2.08, 1.7),
      quote("DASH", 254.1, 1.92, 1.6),
      quote("MSTR", 462.5, 1.76, 1.8),
      quote("AMD", 238.3, 1.64, 1.5),
      quote("CRWD", 554.8, 1.28, 1.35),
      quote("SNOW", 284.2, 1.18, 1.25),
      quote("COIN", 358.9, 1.11, 1.4),
      quote("XOM", 117.3, -0.28, 0.9),
      quote("UNH", 312.4, -1.24, 1.3)
    ]
  },
  tradingView: [
    leader("CSCO", 92, "价格突破 + 量能扩张 + 趋势强度高。"),
    leader("PLTR", 88, "AI 软件主线延续，相对强弱保持领先。"),
    leader("NVDA", 86, "AI 芯片核心龙头，回撤后资金回补。"),
    leader("MRVL", 78, "数据中心 ASIC 预期支撑趋势。"),
    leader("DASH", 73, "消费科技中相对强势，利润率预期改善。"),
    leader("MSTR", 71, "高 beta 弹性标的，受风险偏好驱动。")
  ],
  xMacro: [
    feed("Walter Bloomberg", "美债收益率仍是盘前估值锚", "利率上行会压制高估值成长股，但 VIX 回落抵消部分压力。", "neutral"),
    feed("The Kobeissi Letter", "科技集中度继续抬升", "市场风险偏好依旧围绕 AI、半导体和大型科技展开。", "bullish")
  ],
  reddit: {
    score: 68,
    tone: "偏乐观",
    mentions: [
      ["NVDA", 18],
      ["TSLA", 14],
      ["PLTR", 11],
      ["MSTR", 8]
    ],
    summary: "WSB 讨论集中在 AI 与高 beta 科技，散户追涨意愿回升但未失控。"
  },
  finviz: [
    sector("AI 半导体", 92, 1.82, "NVDA / AMD / AVGO 扩散最强，主动资金继续追随 AI 基建。"),
    sector("AI 软件", 84, 1.34, "PLTR / ORCL 维持强势，资金偏好盈利可见度。"),
    sector("云计算", 81, 1.08, "CRM / SNOW / MSFT 获得企业 AI 支出预期支撑。"),
    sector("大型科技", 78, 0.88, "MSFT / META 承接稳定，是指数风险偏好的核心。"),
    sector("加密资产", 67, 0.62, "COIN / MSTR 跟随高 beta 风险偏好改善。"),
    sector("能源", 41, -0.22, "油价催化不足，资金相对流出。")
  ],
  unusualWhales: [
    optionFlow("NVDA", "AI 半导体", 88, "CALL MOMENTUM PROXY", "AI 半导体板块强势，价格动量和成交活跃度共振，短线看涨期权需求可能升温。", "风险：追高风险中等，等待回踩更优。"),
    optionFlow("PLTR", "AI 软件", 81, "CALL MOMENTUM PROXY", "AI 软件主线延续，散户关注度和价格动量同步增强。", "风险：若开盘冲高回落，避免追单。"),
    optionFlow("TSLA", "高 beta 科技", 66, "WATCHLIST ONLY", "散户关注度高，但价格确认不足，适合观察不适合重仓追高。", "风险：需等待开盘量价确认。"),
    optionFlow("UNH", "医疗", 72, "PUT / HEDGE PROXY", "防御板块承压，价格走弱，短线对冲需求可能上升。", "风险：若开盘快速修复，空头对冲可能失效。")
  ],
  benzinga: {
    movers: [
      mover("CSCO", 15.03, "AI 网络订单与业绩指引强于预期。", "利好"),
      mover("PLTR", 4.82, "AI 软件需求延续，机构观点继续偏正面。", "利好"),
      mover("NVDA", 2.35, "AI 芯片链资金回流，期权成交活跃。", "利好"),
      mover("DASH", 1.92, "订单增长和利润率预期改善。", "利好"),
      mover("MSTR", 1.76, "加密资产风险偏好改善，高 beta 资金回补。", "利好"),
      mover("AMD", 1.64, "AI GPU 需求预期改善，半导体板块扩散。", "利好"),
      mover("CRWD", 1.28, "网络安全软件资金回流，云安全支出预期稳定。", "利好"),
      mover("SNOW", 1.18, "云数据平台交易升温，AI 数据基础设施逻辑延续。", "利好"),
      mover("COIN", 1.11, "加密相关资产跟随风险偏好回升。", "利好"),
      mover("UNH", -1.24, "防御仓位降温，医疗板块相对承压。", "利空")
    ],
    news: [
      news("财报", "Cisco 指引强化 AI 网络交易", "AI 订单与企业网络支出改善，硬件链重新定价。", "利好", "07:42"),
      news("AI", "半导体与 AI 软件继续吸引买盘", "资金偏好具备收入兑现能力的 AI 龙头。", "利好", "07:28"),
      news("IPO", "AI 基础设施资产关注度升温", "资金继续寻找数据中心、网络和芯片链的增量标的。", "利好", "07:16"),
      news("评级", "卖方上修 AI 龙头目标价", "评级催化强化趋势资金的持仓信心。", "利好", "06:58"),
      news("政策", "利率路径仍压制高估值扩张", "若收益率继续上行，追高胜率下降。", "利空", "06:41")
    ]
  },
  sentiment: [
    metric("Fear & Greed", "CNN Proxy", 66, 0, "贪婪区间，乐观但未进入极端亢奋。"),
    metric("RSI", "SPX 14D", 61, 2.1, "动能偏强，尚未触及典型超买阈值。"),
    metric("Put/Call", "CBOE Proxy", 0.82, -0.04, "保护性需求偏低，追涨拥挤度上升。")
  ]
};

function metric(id, name, value, change, note) {
  return { id, name, value, change, note };
}

function quote(symbol, price, preMarketChange, volumeRatio = 1) {
  const [name, sector] = symbolMeta[symbol] || [symbol, "其他"];
  return { symbol, name, sector, price, preMarketChange, volumeRatio, proxyRelativeVolume: volumeRatio };
}

function feed(source, title, summary, tone = "neutral") {
  return { source, title, summary, tone };
}

function sector(name, score, change, summary) {
  return { sector: name, score, change, summary };
}

function optionFlow(symbol, sectorName, score, direction, summary, risk) {
  return { symbol, sector: sectorName, score, direction, type: direction, summary, risk };
}

function mover(symbol, change, reason, bias) {
  const [name, sectorName] = symbolMeta[symbol] || [symbol, "其他"];
  return { symbol, name, sector: sectorName, change, reason, bias };
}

function leader(symbol, score, logic) {
  const [name, sectorName] = symbolMeta[symbol] || [symbol, "其他"];
  return { symbol, name, sector: sectorName, score, logic };
}

function news(category, title, summary, bias, time = "--:--") {
  return { category, title, summary, bias, time };
}

function endpoint(name) {
  return CONFIG.endpoints?.[name] || "";
}

async function fetchJson(url) {
  if (!url) throw new Error("missing endpoint");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`request failed ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function writeSourceCache(sourceKey, data, updatedAt, dataQuality = "live") {
  if (!["live", "delayed", "proxy"].includes(normalizeDataQuality(dataQuality))) return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${sourceKey}`, JSON.stringify({ data, updatedAt, dataQuality: normalizeDataQuality(dataQuality) }));
  } catch (error) {
    console.warn("cache write skipped", sourceKey, error);
  }
}

function readSourceCache(sourceKey) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${sourceKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !Number.isFinite(parsed.updatedAt) || !parsed.dataQuality || normalizeDataQuality(parsed.dataQuality) === "snapshot") return null;
    return parsed;
  } catch (error) {
    console.warn("cache read skipped", sourceKey, error);
    return null;
  }
}

async function loadServerSnapshot() {
  const url = endpoint("snapshot");
  if (!url) return null;
  const joiner = url.includes("?") ? "&" : "?";
  const json = await fetchJson(`${url}${joiner}ts=${Date.now()}`);
  const sources = fallbackSources();
  for (const [key, value] of Object.entries(json.sources || {})) {
    if (!sources[key] || !["live", "delayed", "proxy", "cached", "fallback", "snapshot", "unavailable"].includes(value?.status) || !hasSnapshotData(value.data)) continue;
    const status = json.servedFrom === "last-success" || value.status === "cached" ? "cached" : value.status;
    const dataQuality = normalizeDataQuality(status);
    const updatedAt = dataQuality === "snapshot"
      ? null
      : Number(value.updatedAt || json.generatedAt || Date.now());
    sources[key] = {
      data: value.data,
      status,
      label: value.label || sourceCatalog[key],
      source: value.source || value.label || sourceCatalog[key],
      updatedAt,
      timestamp: ["live", "delayed", "proxy"].includes(dataQuality) ? formatClock(updatedAt) : dataQuality === "cached" ? `最后成功 ${formatDateTime(updatedAt)}` : "SNAPSHOT",
      latency: Number.isFinite(Number(value.latency)) ? Number(value.latency) : null,
      confidence: value.confidence || confidenceLabelByStatus(status),
      freshness: value.freshness || freshnessLabel(updatedAt, status),
      fallback: Boolean(value.fallback ?? (["snapshot", "cached", "proxy"].includes(dataQuality)))
    };
    writeSourceCache(key, value.data, updatedAt, status);
  }
  return sources;
}

function hasSnapshotData(data) {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data).length > 0;
  return true;
}

async function refreshSequentially() {
  const sources = (await loadServerSnapshot().catch((error) => {
    console.warn("server snapshot fallback", error);
    return null;
  })) || loadCachedSources() || fallbackSources();
  render(buildDashboard(sources));
}

function loadCachedSources() {
  const sources = fallbackSources();
  let hasCached = false;
  for (const key of Object.keys(sourceCatalog)) {
    const cached = readSourceCache(key);
    if (!cached) continue;
    sources[key] = {
      data: cached.data,
      status: "cached",
      dataQuality: "cached",
      originalDataQuality: cached.dataQuality,
      label: sourceCatalog[key],
      source: sourceCatalog[key],
      updatedAt: cached.updatedAt,
      timestamp: `最后成功 ${formatDateTime(cached.updatedAt)}`,
      latency: null,
      confidence: "MEDIUM",
      freshness: freshnessLabel(cached.updatedAt, "cached"),
      fallback: true
    };
    hasCached = true;
  }
  return hasCached ? sources : null;
}

function fallbackSources() {
  return {
    yahoo: fallbackSource("yahoo", fallback.yahoo),
    finnhub: fallbackSource("finnhub", []),
    twelveData: fallbackSource("twelveData", []),
    alphavantage: fallbackSource("alphavantage", null),
    fred: fallbackSource("fred", []),
    earnings: fallbackSource("earnings", { events: [] }),
    insider: fallbackSource("insider", { signals: [] }),
    relativeVolume: fallbackSource("relativeVolume", { leaders: [] }),
    marketBreadth: fallbackSource("marketBreadth", {}),
    tradingView: fallbackSource("tradingView", fallback.tradingView),
    finnhubInsider: fallbackSource("finnhubInsider", []),
    finnhubEarnings: fallbackSource("finnhubEarnings", []),
    xMacro: fallbackSource("xMacro", fallback.xMacro),
    reddit: fallbackSource("reddit", fallback.reddit),
    finviz: fallbackSource("finviz", fallback.finviz),
    unusualWhales: fallbackSource("unusualWhales", fallback.unusualWhales),
    benzinga: fallbackSource("benzinga", fallback.benzinga),
    sentiment: fallback.sentiment
  };
}

function fallbackSource(key, data) {
  return {
    data,
    status: "snapshot",
    source: sourceCatalog[key],
    label: sourceCatalog[key],
    updatedAt: null,
    timestamp: FALLBACK_SNAPSHOT_LABEL,
    latency: null,
    confidence: "LOW",
    freshness: "snapshot",
    fallback: true
  };
}

function normalizeDataQuality(status = "") {
  const value = String(status || "").toLowerCase();
  if (value === "live") return "live";
  if (value === "delayed") return "delayed";
  if (value === "proxy") return "proxy";
  if (value === "cached") return "cached";
  if (value === "unavailable") return "unavailable";
  if (value === "fallback" || value === "snapshot" || value === "snapshot only") return "snapshot";
  if (String(status).toUpperCase() === "LIVE") return "live";
  if (String(status).toUpperCase() === "DELAYED") return "delayed";
  if (String(status).toUpperCase() === "SNAPSHOT") return "snapshot";
  return "snapshot";
}

function isTradableQuality(dataQuality, updatedAt) {
  if (dataQuality === "live" || dataQuality === "delayed" || dataQuality === "proxy") return true;
  if (dataQuality === "cached") return Number.isFinite(updatedAt) && Date.now() - updatedAt <= CACHE_TRADABLE_MS;
  return false;
}

function isUsableForInference(item) {
  if (!item) return false;
  const q = normalizeDataQuality(item.dataQuality || item.status);
  return Boolean(item.isTradable) && (q === "live" || q === "delayed");
}

function isCoreScoreSource(source) {
  const q = normalizeDataQuality(source?.status);
  return q === "live" || q === "delayed";
}

function computeDataReliability(sources) {
  const detail = Object.entries(SOURCE_WEIGHT).map(([key, weight]) => {
    const status = normalizeDataQuality(sources?.[key]?.status);
    const score = (STATUS_WEIGHT[status] ?? 0) * weight;
    return { key, status, weight, weighted: score };
  });
  const raw = detail.reduce((sum, item) => sum + item.weighted, 0);
  return {
    score: Math.round(raw * 100),
    detail,
    grade: raw >= 0.78 ? "HIGH" : raw >= 0.52 ? "MEDIUM" : "LOW"
  };
}

function enrichSources(rawSources) {
  return Object.fromEntries(Object.entries(rawSources).map(([key, source]) => {
    if (key === "sentiment") return [key, source];
    const dataQuality = normalizeDataQuality(source?.status);
    const updatedAt = Number(source?.updatedAt || 0) || null;
    const isTradable = isTradableQuality(dataQuality, updatedAt);
    return [key, {
      ...source,
      status: dataQuality,
      dataQuality,
      updatedAt,
      isTradable,
      timestamp: source?.timestamp || qualityTimestamp(dataQuality, updatedAt),
      source: source?.source || source?.label || sourceCatalog[key] || key,
      latency: Number.isFinite(Number(source?.latency)) ? Number(source.latency) : null,
      confidence: source?.confidence || confidenceLabelByStatus(dataQuality),
      freshness: source?.freshness || freshnessLabel(updatedAt, dataQuality),
      fallback: Boolean(source?.fallback ?? (["snapshot", "cached", "proxy"].includes(dataQuality)))
    }];
  }));
}

function confidenceLabelByStatus(status = "") {
  const q = normalizeDataQuality(status);
  if (q === "live") return "HIGH";
  if (q === "delayed") return "MEDIUM";
  if (q === "cached") return "MEDIUM";
  return "LOW";
}

function freshnessLabel(updatedAt, status = "") {
  const q = normalizeDataQuality(status);
  if (!updatedAt) return q === "snapshot" ? "snapshot" : "stale";
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function qualityTimestamp(dataQuality, updatedAt) {
  if (updatedAt && dataQuality !== "snapshot") return formatClock(updatedAt);
  if (dataQuality === "snapshot") return "低置信度";
  if (dataQuality === "unavailable") return "数据不可用";
  return "--";
}

function attachQuality(item, source, sourceName, overrideStatus) {
  const dataQuality = normalizeDataQuality(overrideStatus || item?.dataQuality || item?.status || source?.dataQuality || source?.status);
  const updatedAt = Number(item?.updatedAt || source?.updatedAt || 0) || null;
  const isTradable = isTradableQuality(dataQuality, updatedAt) && dataQuality !== "snapshot";
  return {
    ...item,
    dataQuality,
    updatedAt,
    source: item?.source || sourceName || source?.label || "Unknown",
    isTradable
  };
}

function normalizeQuotes(quotes = [], source) {
  return (quotes || []).map((item) => {
    const volume = Number(item.volume || item.regularMarketVolume || 0);
    const averageVolume = Number(item.averageVolume || item.averageDailyVolume3Month || 0);
    const realRelativeVolume = volume > 0 && averageVolume > 0 ? volume / averageVolume : Number(item.realRelativeVolume || 0) || null;
    const proxyRelativeVolume = realRelativeVolume ? null : Number(item.proxyRelativeVolume ?? item.relativeVolume ?? item.volumeRatio ?? 1);
    return attachQuality({
      ...item,
      volumeRatio: realRelativeVolume || proxyRelativeVolume || 1,
      relativeVolume: realRelativeVolume || proxyRelativeVolume || 1,
      realRelativeVolume,
      proxyRelativeVolume
    }, source, source?.label);
  });
}

function hasScoringData(items = []) {
  return items.some((item) => isUsableForInference(item));
}

function buildDashboard(sources) {
  sources = enrichSources(sources);
  const reliability = computeDataReliability(sources);
  const scoreEligible = {
    quotes: isCoreScoreSource(sources.yahoo),
    sectors: isCoreScoreSource(sources.finviz),
    news: isCoreScoreSource(sources.benzinga),
    retail: isCoreScoreSource(sources.reddit),
    options: isCoreScoreSource(sources.unusualWhales),
    earnings: isCoreScoreSource(sources.earnings),
    insider: isCoreScoreSource(sources.insider),
    relativeVolume: isCoreScoreSource(sources.relativeVolume),
    breadth: isCoreScoreSource(sources.marketBreadth)
  };
  const benzingaData = sources.benzinga?.data || {};
  const yahooQuotes = normalizeQuotes(sources.yahoo?.data?.quotes || fallback.yahoo.quotes, sources.yahoo);
  const marketIndices = sanitizeIndices(sources.yahoo?.data?.indices, sources.yahoo);
  const quotesForScoring = scoreEligible.quotes ? yahooQuotes : [];
  const indicesForScoring = scoreEligible.quotes ? marketIndices : [];
  const quoteMap = new Map(yahooQuotes.map((item) => [item.symbol, item]));
  const flows = normalizeSectors(sources.finviz.data, sources.finviz);
  const flowsForScoring = scoreEligible.sectors ? flows : [];
  const moversRaw = Array.isArray(benzingaData.movers) && benzingaData.movers.length
    ? benzingaData.movers
    : deriveMoversFromQuotes(yahooQuotes);
  const movers = normalizeMovers(moversRaw, quoteMap, yahooQuotes);
  const stars = normalizeStars(sources.tradingView.data, quoteMap);
  const retail = sources.reddit.data;
  const newsItems = Array.isArray(sources.benzinga?.data?.news) ? sources.benzinga.data.news : [];
  const newsForScoring = scoreEligible.news ? newsItems : [];
  const options = normalizeOptions(sources.unusualWhales.data, sources.unusualWhales);
  const optionsForScoring = scoreEligible.options ? options : [];
  const retailForScoring = scoreEligible.retail ? retail : {};
  const risk = indicesForScoring.length
    ? calculateRiskRegime(indicesForScoring, sources.sentiment, retailForScoring)
    : {
        score: null,
        mode: "数据不足",
        confidence: "低",
        dataQuality: "unavailable",
        tradable: false,
        reason: "核心行情不是 LIVE / DELAYED。",
        conclusion: "等待可交易数据恢复后再评估方向。",
        inputs: [["SPY", "不可用"], ["QQQ", "不可用"], ["VIX", "不可用"], ["可信度", "低"]]
      };
  const opportunities = calculatePremarketOpportunities(quotesForScoring, {
    flows: flowsForScoring,
    news: newsForScoring,
    retail: retailForScoring,
    risk,
    indices: indicesForScoring,
    options: optionsForScoring
  });
  const tradePlan = buildPremarketTradePlan(opportunities, flowsForScoring, risk, optionsForScoring);
  const [strategy, strategyContext] = strategyFrom(risk, flowsForScoring, retailForScoring, optionsForScoring);
  const strategyBasis = statusGroup([sources.finviz, sources.unusualWhales, sources.benzinga]);
  const sourceBasis = statusGroup(Object.values(sources).filter((source) => source?.status));

  return {
    asOf: `数据生成：${latestDataTimestamp(sources)} · 页面刷新：${formatDateTime(Date.now())}`,
    sourceMode: sourceModeLabel(sources),
    sourceStatus: Object.entries(sources)
      .filter(([key]) => key !== "sentiment")
      .map(([key, value]) => ({
        key,
        label: value.label,
        source: value.source || value.label,
        status: value.status,
        timestamp: value.timestamp || "备用快照",
        updatedAt: value.updatedAt,
        dataQuality: value.dataQuality,
        isTradable: value.isTradable,
        latency: value.latency,
        freshness: value.freshness,
        confidence: value.confidence,
        fallback: value.fallback
      })),
    moduleStatus: {
      risk: statusGroup([sources.yahoo]),
      index: statusGroup([sources.yahoo]),
      sentiment: { status: "snapshot", timestamp: "低置信度代理" },
      flow: statusGroup([sources.finviz]),
      mover: statusGroup([sources.benzinga]),
      star: statusGroup([sources.tradingView]),
      opportunity: statusGroup([sources.yahoo, sources.finviz, sources.reddit, sources.benzinga]),
      tradePlan: statusGroup([sources.yahoo, sources.finviz, sources.unusualWhales]),
      news: statusGroup([sources.benzinga]),
      macro: statusGroup([sources.xMacro]),
      retail: statusGroup([sources.reddit]),
      options: statusGroup([sources.unusualWhales]),
      source: sourceBasis
    },
    indices: marketIndices,
    sentiment: sources.sentiment,
    macro: sources.xMacro.data,
    retail,
    options,
    opportunities,
    tradePlan,
    scannerStatus: buildScannerStatus(opportunities, flows, risk),
    flows,
    movers,
    stars,
    news: normalizeNews(newsItems),
    risk,
    marketSummary: marketSummary(marketIndices),
    strategy,
    strategyContext: `${dataBasisLabel(strategyBasis)}。数据可靠性 ${reliability.score} (${reliability.grade})。${strategyContext}`,
    dataReliability: reliability,
    tape: tapeRead(movers, flows)
  };
}

function latestDataTimestamp(sources) {
  const usable = Object.values(sources)
    .filter((source) => source?.updatedAt && ["live", "delayed", "proxy", "cached"].includes(source.dataQuality))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return usable[0] ? formatDateTime(usable[0].updatedAt) : "无可用实时数据";
}

function sanitizeIndices(indices = [], yahooSource = {}) {
  const fallbackById = new Map(fallback.yahoo.indices.map((item) => [item.id, item]));
  const byId = new Map((indices || []).map((item) => [item.id, item]));
  return fallback.yahoo.indices.map((fallbackMetric) => {
    const live = byId.get(fallbackMetric.id);
    const value = Number(live?.value);
    if (!Number.isFinite(value) || value <= 0) {
      return {
        ...fallbackMetric,
        value: fallbackById.get(fallbackMetric.id)?.value || fallbackMetric.value,
        change: fallbackById.get(fallbackMetric.id)?.change ?? fallbackMetric.change,
        dataQuality: "snapshot",
        source: "Fallback Snapshot",
        updatedAt: null,
        isTradable: false,
        note: "快照数据（SNAPSHOT）：低置信度代理输入，用于维持方向判断。"
      };
    }
    const item = attachQuality(live, yahooSource, yahooSource.label, live.status || yahooSource.status);
    return {
      ...item,
      note: item.isTradable ? item.note : "快照数据（SNAPSHOT）：低置信度代理输入，用于维持方向判断。"
    };
  });
}

function sourceModeLabel(sources) {
  const statuses = Object.values(sources).map((source) => source?.status).filter(Boolean);
  if (statuses.some((status) => status === "live")) return "实时 + 结构化情报";
  if (statuses.some((status) => status === "delayed")) return "延迟 + 结构化情报";
  if (statuses.some((status) => status === "proxy")) return "代理推断情报";
  if (statuses.some((status) => status === "cached")) return "上次成功数据";
  if (statuses.some((status) => status === "unavailable")) return "数据不足";
  return "快照数据";
}

function dataBasisLabel(item) {
  if (item.status === "live") return `资金流基于实时数据 ${item.timestamp}`;
  if (item.status === "delayed") return `资金流基于延迟数据 ${item.timestamp}`;
  if (item.status === "proxy") return `资金流基于代理推断数据 ${item.timestamp}`;
  if (item.status === "cached") return `资金流基于最后成功数据 ${item.timestamp}`;
  return `资金流基于快照数据`;
}

function formatClock(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false
  }).format(new Date(value));
}

function statusGroup(sourceItems) {
  const liveItems = sourceItems.filter((source) => source?.status === "live" && source.updatedAt);
  const delayedItems = sourceItems.filter((source) => source?.status === "delayed" && source.updatedAt);
  const proxyItems = sourceItems.filter((source) => source?.status === "proxy" && source.updatedAt);
  const cachedItems = sourceItems.filter((source) => source?.status === "cached" && source.updatedAt);
  const latestLiveAt = liveItems.length ? Math.max(...liveItems.map((source) => source.updatedAt)) : null;
  const latestDelayedAt = delayedItems.length ? Math.max(...delayedItems.map((source) => source.updatedAt)) : null;
  const latestProxyAt = proxyItems.length ? Math.max(...proxyItems.map((source) => source.updatedAt)) : null;
  const latestCachedAt = cachedItems.length ? Math.max(...cachedItems.map((source) => source.updatedAt)) : null;
  if (latestLiveAt) {
    return {
      status: "live",
      timestamp: formatClock(latestLiveAt),
      fullTimestamp: formatDateTime(latestLiveAt)
    };
  }
  if (latestDelayedAt) {
    return {
      status: "delayed",
      timestamp: formatClock(latestDelayedAt),
      fullTimestamp: formatDateTime(latestDelayedAt)
    };
  }
  if (latestProxyAt) {
    return {
      status: "proxy",
      timestamp: formatClock(latestProxyAt),
      fullTimestamp: formatDateTime(latestProxyAt)
    };
  }
  if (latestCachedAt) {
    return {
      status: "cached",
      timestamp: formatDateTime(latestCachedAt),
      fullTimestamp: formatDateTime(latestCachedAt)
    };
  }
  return {
    status: "snapshot",
    timestamp: "低置信度代理"
  };
}

function normalizeSectors(items = [], source = {}) {
  return (items || [])
    .map((item) => ({
      sector: item.sector || item.name,
      score: clamp(Math.round(item.score ?? 50 + (item.change || 0) * 15)),
      change: item.change ?? 0,
      summary: item.summary || item.note || "板块热度来自 Finviz Heatmap。",
      dataQuality: source.dataQuality || "snapshot",
      isTradable: Boolean(source.isTradable),
      source: source.label || "Sector Heat Proxy",
      updatedAt: source.updatedAt || null
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function normalizeOptions(items = [], source = {}) {
  if (!items?.length) {
    return [{
      symbol: "--",
      sector: "AI 期权流代理",
      score: null,
      conviction: "DATA INSUFFICIENT",
      direction: "DATA INSUFFICIENT",
      summary: "行情与代理源均为空，暂不生成期权方向信号。",
      risk: "等待下一次数据刷新。",
      dataQuality: source.dataQuality || "snapshot",
      isTradable: false
    }];
  }
  return (items || []).map((item) => {
    const rawState = item.conviction || item.direction || item.type || "WATCHLIST";
    const downgraded = rawState === "HIGH CONVICTION"
      ? "MOMENTUM"
      : rawState === "CALL MOMENTUM PROXY"
        ? "MOMENTUM"
        : rawState === "PUT / HEDGE PROXY"
          ? "PUT / HEDGE WATCH"
          : rawState;
    return {
      ...item,
      conviction: downgraded,
      direction: downgraded,
      dataQuality: source.dataQuality || "proxy",
      isTradable: Boolean(source.isTradable),
      summary: `${item.summary || "基于免费数据生成代理方向。"}（代理推断，不是真实期权大单）`,
      risk: item.risk || "风险：代理信号只作辅助，需等待开盘量价确认。"
    };
  }).slice(0, 6);
}

function normalizeMovers(items = [], quoteMap, quotes = []) {
  const sourceItems = Array.isArray(items) && items.length
    ? items
    : deriveMoversFromQuotes(quotes?.length ? quotes : fallback.yahoo.quotes);
  return sourceItems
    .filter((item) => item && item.symbol)
    .map((item) => {
      const live = quoteMap.get(item.symbol);
      const [name, sectorName] = symbolMeta[item.symbol] || [item.name || item.symbol, item.sector || "其他"];
      const change = live?.preMarketChange ?? item.change ?? 0;
      return {
        symbol: item.symbol,
        name: item.name || name,
        sector: item.sector || sectorName,
        change,
        reason: item.reason || item.summary || "异动新闻待确认。",
        bias: item.bias || (change >= 0 ? "利好" : "利空"),
        durability: live?.isTradable ? durability(live, change) : "快照数据，仅供参考。",
        dataQuality: live?.dataQuality || "snapshot",
        isTradable: Boolean(live?.isTradable)
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10);
}

function deriveMoversFromQuotes(quotes = []) {
  return [...quotes]
    .filter((item) => item?.symbol)
    .map((item) => {
      const change = Number(item.preMarketChange ?? item.regularMarketChangePercent ?? 0);
      return {
        symbol: item.symbol,
        name: item.name,
        sector: item.sector,
        change,
        reason: "价格异动进入盘前扫描，等待开盘量能确认。",
        bias: change >= 0 ? "利好" : "利空"
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10);
}

function normalizeStars(items, quoteMap) {
  return items
    .map((item) => {
      const live = quoteMap.get(item.symbol);
      const [name, sectorName] = symbolMeta[item.symbol] || [item.name || item.symbol, item.sector || "其他"];
      const heat = clamp(Math.round((item.score || 55) + (live?.preMarketChange || 0) * 3 + (live?.volumeRatio || 1) * 4));
      return {
        symbol: item.symbol,
        name: item.name || name,
        sector: item.sector || sectorName,
        heat,
        logic: item.logic || "TradingView 趋势强度与 Yahoo 盘前动量共振。",
        persistence: heat >= 84 ? "高" : heat >= 70 ? "中高" : "中性"
      };
    })
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 6);
}

function normalizeNews(items = []) {
  const cleaned = items
    .map((item) => normalizeNewsItem(item))
    .filter(Boolean)
    .filter((item) => !String(item.originalTitle).toLowerCase().includes("market update"))
    .filter((item) => isTradableNews(item))
    .map((item, index) => ({
      ticker: item.ticker || "MACRO",
      sector: item.sector || "宏观",
      category: item.category || item.newsType || "新闻",
      title: makeReadableChineseNewsTitle({
        ticker: item.ticker,
        type: item.newsType || item.category,
        originalTitle: item.originalTitle,
        bias: item.bias
      }),
      summary: item.summary || readableNewsSummary(item),
      originalTitle: item.originalTitle,
      bias: normalizeNewsBias(item.bias),
      time: item.time || item.publishedAt || `0${7 - Math.min(index, 5)}:${(50 - index * 7).toString().padStart(2, "0")}`
    }));
  return cleaned.length ? cleaned : fallback.benzinga.news.map((item) => ({
    ticker: "AI",
    sector: "AI 半导体",
    category: item.category,
    title: item.title,
    summary: item.summary,
    originalTitle: "Snapshot catalyst retained for terminal continuity.",
    bias: item.bias === "利空" ? "BEARISH" : "BULLISH",
    time: item.time
  }));
}

function normalizeNewsItem(item = {}) {
  const originalTitle = item.originalTitle || item.title || "";
  if (!originalTitle) return null;
  const ticker = item.ticker || extractTickerFromText(`${originalTitle} ${item.summary || ""}`);
  const type = item.newsType || item.category || detectNewsTypeFromText(originalTitle);
  const sector = ticker ? symbolMeta[ticker]?.[1] || item.sector || "美股" : item.sector || newsTypeSector(type);
  return {
    ...item,
    ticker: ticker || "MACRO",
    sector,
    newsType: type,
    originalTitle,
    bias: normalizeNewsBias(item.bias || classifyNewsBiasFromText(originalTitle))
  };
}

function translateEnglishTitleToChineseEvent(originalTitle, ticker, type) {
  const lower = String(originalTitle || "").toLowerCase();

  if (/nvidia|nvda/.test(lower)) return "AI 芯片龙头买盘关注升温";
  if (/amd|advanced micro devices/.test(lower)) return "AI 芯片追赶逻辑继续发酵";
  if (/nuscale|smr|nuclear|oklo|uranium/.test(lower)) return "核能主题长期预期升温";
  if (/vanguard|etf|buffett/.test(lower)) return "资金配置偏好转向低成本 ETF";
  if (/trump|trades|insiders/.test(lower)) return "政治交易线索引发市场关注";
  if (/futures|dow jones|nasdaq|s&p 500/.test(lower)) return "股指期货高位震荡等待确认";
  if (/treasury|yield|rates|fed|inflation/.test(lower)) return "利率与通胀预期影响资金风格";
  if (/ipo|openai|spacex|anthropic/.test(lower)) return "AI IPO 预期继续升温";
  if (/earnings|reports|results|revenue/.test(lower)) return "业绩结果进入市场定价";
  if (/price target|upgrade|raises/.test(lower)) return "目标价上调强化买盘预期";
  if (/downgrade|cut/.test(lower)) return "评级下修压制风险偏好";

  return "事件催化进入盘前定价";
}

function makeReadableChineseNewsTitle({ ticker, type, originalTitle }) {
  const symbol = ticker && ticker !== "MACRO" ? ticker : "MACRO";
  return `${symbol}｜${translateEnglishTitleToChineseEvent(originalTitle, symbol, type)}`;
}

function readableNewsSummary(item) {
  const bias = normalizeNewsBias(item.bias);
  const target = item.ticker && item.ticker !== "MACRO" ? `${item.ticker} 与${item.sector || "相关板块"}` : item.sector || "宏观资产";
  if (bias === "BULLISH") return `${target}出现正向催化，仍需开盘量价确认。`;
  if (bias === "BEARISH") return `${target}出现负面催化，需观察风险偏好是否降温。`;
  return `${target}进入盘前定价，方向仍需开盘确认。`;
}

function isTradableNews(item) {
  const title = String(item.originalTitle || "").toLowerCase();
  if (/retirement|social security|dividend income|roth ira|personal finance|advice|saving this for years/.test(title)) return false;
  if (item.ticker && item.ticker !== "MACRO") return true;
  return /(fed|cpi|treasury|nasdaq|s&p|dow|ai|ipo|crypto|bitcoin|oil|gold|nuclear|uranium|rates|inflation)/.test(title);
}

function extractTickerFromText(text = "") {
  const upper = text.toUpperCase();
  const aliases = [
    ["NUSCALE POWER", "SMR"],
    ["OKLO", "OKLO"],
    ["URANIUM ENERGY", "UEC"],
    ["NANO NUCLEAR", "NNE"],
    ["ADVANCED MICRO DEVICES", "AMD"],
    ["NVIDIA", "NVDA"],
    ["ELI LILLY", "LLY"]
  ];
  for (const [name, symbol] of aliases) {
    if (upper.includes(name)) return symbol;
  }
  return Object.keys(symbolMeta).find((symbol) => new RegExp(`\\b${symbol}\\b`).test(upper)) || "";
}

function detectNewsTypeFromText(title = "") {
  const lower = title.toLowerCase();
  if (/price target|raises|raise|upgrade/.test(lower)) return "analyst upgrade";
  if (/downgrade|cut/.test(lower)) return "downgrade";
  if (/\bai\b|nvidia|amd|data center|chip|gpu|server/.test(lower)) return "AI demand";
  if (/trial|drug|weight loss|eli lilly|lilly/.test(lower)) return "FDA";
  if (/fed|treasury|inflation|rates|yield/.test(lower)) return "macro";
  if (/futures|nasdaq|s&p 500|dow jones|dow/.test(lower)) return "macro";
  if (/ipo|openai|spacex|anthropic/.test(lower)) return "IPO";
  if (/uranium|power|nuclear|nuscale|oklo|nano nuclear/.test(lower)) return "nuclear";
  if (/earnings|reports|results|revenue/.test(lower)) return "earnings";
  return "event";
}

function newsTypeSector(type = "") {
  if (/AI|semiconductor/.test(type)) return "AI 半导体";
  if (/FDA/.test(type)) return "医疗";
  if (/nuclear/.test(type)) return "核能";
  if (/IPO/.test(type)) return "AI IPO";
  return "宏观";
}

function classifyNewsBiasFromText(title = "") {
  const lower = title.toLowerCase();
  if (/downgrade|cut|lawsuit|investigation|miss|weak|fallout/.test(lower)) return "BEARISH";
  if (/raise|raises|upgrade|price target|beat|ai|growth|demand/.test(lower)) return "BULLISH";
  return "NEUTRAL";
}

function normalizeNewsBias(bias = "NEUTRAL") {
  if (bias === "利好") return "BULLISH";
  if (bias === "利空") return "BEARISH";
  if (["BULLISH", "BEARISH", "NEUTRAL"].includes(bias)) return bias;
  return "NEUTRAL";
}

function calculatePremarketOpportunities(quotes, context) {
  const usableQuotes = (quotes || []).filter((item) => item?.symbol && isUsableForInference(item));
  if (!usableQuotes.length) {
    return [{
      symbol: "--",
      name: "数据不足",
      sector: "行情源为空",
      score: null,
      confidence: "低",
      dataBasis: "API 完全不可用",
      dataQuality: "unavailable",
      isTradable: false,
      signal: "DATA INSUFFICIENT",
      openingConfirmation: "DATA INSUFFICIENT",
      vwapBias: "DATA INSUFFICIENT",
      relativeVolume: 0,
      riskTags: ["数据不足"],
      logic: "行情源为空，等待下一次刷新。"
    }];
  }
  return usableQuotes
    .filter((item) => ["SPY", "QQQ", "NVDA", "AMD", "AVGO", "PLTR", "TSLA", "COIN", "MSTR", "MRVL", "MSFT", "META", "CRWD"].includes(item.symbol))
    .map((stock) => calculatePremarketOpportunityScore(stock, context))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function calculatePremarketOpportunityScore(stock, context) {
  const flowMap = new Map((context.flows || []).map((item) => [item.sector, item]));
  const mentionMap = new Map(context.retail?.mentions || []);
  const newsText = (context.news || []).map((item) => `${item.title || ""} ${item.summary || ""}`).join(" ").toLowerCase();
  const sector = stock.sector || "其他";
  const gap = Number(stock.preMarketChangePercent ?? stock.preMarketChange ?? stock.regularMarketChangePercent ?? 0);
  const regularChange = Number(stock.regularMarketChangePercent ?? gap);
  const hasRealRelativeVolume = Number.isFinite(stock.realRelativeVolume) && stock.realRelativeVolume > 0;
  const relativeVolume = hasRealRelativeVolume
    ? Number(stock.realRelativeVolume)
    : Number(stock.proxyRelativeVolume ?? stock.relativeVolume ?? stock.volumeRatio ?? 1);
  const sectorMomentumScore = flowMap.get(sector)?.score ?? sectorMomentumProxy(sector);
  const mentionCount = Number(mentionMap.get(stock.symbol) || 0);
  const retailHeat = clamp(Math.round(mentionCount * 6 + (context.retail?.score || 50) * 0.35));
  const catalyst = newsCatalystBias(newsText, stock.symbol);
  const vwapBias = vwapTrendProxy(stock, context, sectorMomentumScore);
  const gapScore = gap >= 3 ? 20 : gap >= 1.5 ? 15 : gap <= -2 ? 13 : Math.max(0, 8 + gap * 3);
  const volumeScore = relativeVolume >= 2 ? 25 : relativeVolume >= 1.5 ? 20 : relativeVolume >= 1 ? 13 : 7;
  const vwapScore = vwapBias === "BULLISH ABOVE VWAP" ? 20 : vwapBias === "WEAK BELOW VWAP" ? 8 : 13;
  const sectorScore = clamp(sectorMomentumScore) * 0.15;
  const newsScore = catalyst === "bullish" ? 10 : catalyst === "bearish" ? 7 : 5;
  const retailScore = clamp(retailHeat) * 0.1;
  const score = clamp(Math.round(gapScore + volumeScore + vwapScore + sectorScore + newsScore + retailScore));
  const confidence = opportunityConfidence(stock, hasRealRelativeVolume, score);
  const signal = classifyOpportunitySignal({ score, gap, relativeVolume, sectorMomentumScore, catalyst, risk: context.risk, confidence, hasRealRelativeVolume });
  const openingConfirmation = openingConfirmationState({ relativeVolume, gap, vwapBias, sectorMomentumScore, risk: context.risk, indices: context.indices, hasRealRelativeVolume });
  const riskTags = opportunityRiskTags({ gap, relativeVolume, mentionCount, score, openingConfirmation, signal });
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector,
    score,
    confidence,
    dataBasis: opportunityDataBasis(stock, hasRealRelativeVolume),
    dataQuality: stock.dataQuality,
    isTradable: Boolean(stock.isTradable),
    signal,
    openingConfirmation,
    vwapBias,
    relativeVolume,
    mentionCount,
    retailHeat,
    sectorMomentumScore,
    riskTags,
    logic: opportunityLogic(stock, signal, sectorMomentumScore, relativeVolume, catalyst)
  };
}

function opportunityConfidence(stock, hasRealRelativeVolume, score) {
  if (!stock.isTradable || stock.dataQuality === "snapshot") return "低";
  if (hasRealRelativeVolume && score >= 65) return "高";
  if (hasRealRelativeVolume) return "中";
  if (["live", "delayed"].includes(stock.dataQuality)) return "中";
  return "低";
}

function opportunityDataBasis(stock, hasRealRelativeVolume) {
  if (!stock.isTradable && stock.dataQuality === "snapshot") return "快照 + 代理推断";
  if (!stock.isTradable) return "代理推断";
  if (hasRealRelativeVolume && ["live", "delayed"].includes(stock.dataQuality)) return stock.dataQuality === "live" ? "实时价格 + 真实量能" : "延迟价格 + 真实量能";
  if (["live", "delayed"].includes(stock.dataQuality)) return "延迟价格 + 代理量能";
  if (stock.dataQuality === "proxy") return "代理推断";
  return "快照 + 代理推断";
}

function sectorMomentumProxy(sector) {
  if (/AI 半导体|AI 软件|AI 服务器|云计算|加密资产|大型科技|动量科技/.test(sector)) return 78;
  if (/医疗|公用|防御/.test(sector)) return 42;
  return 58;
}

function newsCatalystBias(text, symbol) {
  const scoped = text.includes(symbol.toLowerCase()) ? text : text.slice(0, 1200);
  if (/(earnings beat|guidance raise|analyst upgrade|partnership|\bai demand\b|government contract|price target|raises|growth|demand)/i.test(scoped)) return "bullish";
  if (/(downgrade|lawsuit|weak demand|war|delay|investigation|miss|cut|fallout)/i.test(scoped)) return "bearish";
  return "neutral";
}

function vwapTrendProxy(stock, context, sectorMomentumScore) {
  const gap = Number(stock.preMarketChangePercent ?? stock.preMarketChange ?? 0);
  const regularChange = Number(stock.regularMarketChangePercent ?? gap);
  const qqq = (context.indices || []).find((item) => item.id === "QQQ" || item.id === "NDX")?.change || 0;
  if (gap > 0.8 && regularChange >= -0.5 && sectorMomentumScore >= 65 && qqq >= -0.4) return "BULLISH ABOVE VWAP";
  if (gap < -1 || regularChange < -1.5 || sectorMomentumScore < 45) return "WEAK BELOW VWAP";
  return "VWAP WATCH";
}

function classifyOpportunitySignal({ score, gap, relativeVolume, sectorMomentumScore, catalyst, risk, confidence, hasRealRelativeVolume }) {
  if (score < 50) return "LOW QUALITY / IGNORE";
  if (gap < -1.5 || catalyst === "bearish" || (sectorMomentumScore < 45 && gap < 0)) return "PUT / HEDGE WATCH";
  if (confidence === "高" && hasRealRelativeVolume && score > 80 && relativeVolume > 1.5 && sectorMomentumScore >= 65 && catalyst !== "bearish" && risk.mode === "Risk-On") return "HIGH MOMENTUM LONG";
  if (score >= 72) return "OPENING BREAKOUT WATCH";
  if (score >= 60) return "HIGH MOMENTUM WATCH";
  return "LOW QUALITY / IGNORE";
}

function openingConfirmationState({ relativeVolume, gap, vwapBias, sectorMomentumScore, risk, indices, hasRealRelativeVolume }) {
  const spy = (indices || []).find((item) => item.id === "SPY")?.change || 0;
  const qqq = (indices || []).find((item) => item.id === "QQQ" || item.id === "NDX")?.change || 0;
  if (gap > 1.5 && vwapBias === "WEAK BELOW VWAP") return "FAILED OPEN";
  if (relativeVolume > 1.5 && Math.abs(gap) > 1 && sectorMomentumScore >= 60 && (spy >= -0.3 || qqq >= -0.3) && risk.mode !== "Risk-Off") return "CONFIRMED";
  return "EARLY ONLY";
}

function opportunityRiskTags({ gap, relativeVolume, mentionCount, score, openingConfirmation, signal }) {
  const tags = [];
  if (gap >= 3) tags.push("Chase Risk", "Gap Exhaustion");
  if (mentionCount >= 10) tags.push("Crowded Risk");
  if (relativeVolume < 1) tags.push("Weak Volume");
  if (score >= 75) tags.push("Strong Trend");
  if (openingConfirmation === "EARLY ONLY") tags.push("Early Only");
  if (signal.includes("HEDGE")) tags.push("Put Watch");
  return tags.length ? tags.slice(0, 4) : ["WATCH"];
}

function opportunityLogic(stock, signal, sectorMomentumScore, relativeVolume, catalyst) {
  if (signal === "HIGH MOMENTUM LONG") return `${stock.sector}主线强化，量能与板块同步，优先等待 VWAP 回踩延续。`;
  if (signal === "OPENING BREAKOUT WATCH") return `${stock.sector}有催化和动量，但需确认开盘相对成交量。`;
  if (signal === "HIGH MOMENTUM WATCH") return `${stock.sector}动量结构活跃，当前基于代理推断与延迟数据生成。`;
  if (signal === "PUT / HEDGE WATCH") return `${stock.sector}或价格结构偏弱，短线更适合观察对冲方向。`;
  if (relativeVolume < 1) return "量能不足，暂不追逐盘前异动。";
  if (catalyst === "bullish" || sectorMomentumScore >= 65) return "存在主题热度，但交易质量仍需开盘确认。";
  return "缺少明确动量、量能或催化共振。";
}

function buildPremarketTradePlan(opportunities, flows, risk, options) {
  const usableOpportunities = opportunities.filter((item) => item.symbol && item.symbol !== "--");
  if (!usableOpportunities.length) {
    return {
      title: "数据不足，等待下一次刷新。",
      body: "行情源完全为空，系统暂不生成方向性交易计划。",
      focus: ["等待下一次行情刷新"],
      avoid: ["无数据状态下追单"]
    };
  }
  const leader = flows[0]?.sector || "AI / 高 beta";
  const topLongs = opportunities.filter((item) => ["HIGH MOMENTUM LONG", "OPENING BREAKOUT WATCH", "HIGH MOMENTUM WATCH", "WATCHLIST ONLY"].includes(item.signal)).slice(0, 3);
  const hedges = opportunities.filter((item) => item.signal === "PUT / HEDGE WATCH").slice(0, 2);
  return {
    title: `${leader}仍是盘前主线，${displayRiskMode(risk.mode)} 下优先等开盘确认。`,
    body: risk.mode === "Risk-Off"
      ? "风险偏好转弱，降低高 beta 追涨，优先观察放量失败和对冲机会。"
      : `${risk.confidence === "低" ? "当前基于代理推断与延迟数据生成。" : "市场仍可寻找顺势机会。"}无量高开不追，优先交易回踩 VWAP 后重新转强的标的。`,
    focus: topLongs.length ? topLongs.map((item) => `${item.symbol}：${displayTradeState(item.openingConfirmation)} / ${displayTradeState(item.signal)}`) : ["等待相对成交量和板块确认"],
    avoid: [
      "无量高开",
      "低成交量 breakout",
      hedges.length ? `${hedges.map((item) => item.symbol).join(" / ")} 追多` : "弱势防御板块追多"
    ]
  };
}

function buildScannerStatus(opportunities, flows, risk) {
  const rvLeader = [...opportunities].filter((item) => item.symbol && item.symbol !== "--").sort((a, b) => b.relativeVolume - a.relativeVolume)[0];
  const strongest = flows[0];
  const momentum = opportunities.filter((item) => item.score >= 65).length;
  const confirmed = opportunities.filter((item) => item.openingConfirmation === "CONFIRMED").length;
  return {
    rvLeader: rvLeader ? `相对成交量龙头 ${rvLeader.symbol} ${rvLeader.relativeVolume.toFixed(2)}x` : "相对成交量龙头 --",
    strongestSector: strongest ? `最强板块 ${strongest.sector}` : "最强板块 --",
    riskAppetite: `风险偏好 ${displayRiskMode(risk.mode)} · 置信度 ${risk.confidence || "低"}`,
    premarketMomentum: `盘前动量 ${momentum} 个观察名单`,
    openingBias: confirmed ? `开盘倾向 ${confirmed} 个已确认` : "开盘倾向 仅早盘观察"
  };
}

function marketSummary(indices) {
  const byId = Object.fromEntries(indices.map((item) => [item.id, item]));
  if (![byId.SPY, byId.QQQ].some((item) => item?.value)) return "行情源为空，等待下一次刷新。";
  if (![byId.SPY, byId.QQQ].some((item) => item?.isTradable)) return "当前基于代理推断与延迟数据生成，方向置信度较低。";
  const techLead = (byId.QQQ?.change || 0) > (byId.SPY?.change || 0);
  const ratesPressure = (byId.TNX?.change || 0) > 0.5;
  const volRelief = (byId.VIX?.change || 0) < 0;
  if (techLead && volRelief && !ratesPressure) return "QQQ 强于 SPY 且 VIX 回落，科技风险偏好占优。";
  if (techLead && ratesPressure) return "科技强于大盘，但美债收益率上行限制追高空间。";
  if (!volRelief) return "波动率抬升压制风险资产，开盘优先观察防御需求。";
  return "宽基指数温和修复，风险偏好中性偏多。";
}

function durability(live, change) {
  const volumeRatio = live?.volumeRatio || 1;
  if (Math.abs(change) >= 4 && volumeRatio >= 1.8) return "持续性高，量价确认。";
  if (Math.abs(change) >= 2 && volumeRatio >= 1.2) return "持续性中高，开盘承接关键。";
  if (Math.abs(change) >= 3) return "弹性强，需成交量确认。";
  return "偏事件交易，持续性待验证。";
}

function riskConfidence(nonTradableCore, core = []) {
  if (nonTradableCore === 0) return "高";
  if (core.filter((item) => item?.isTradable).length >= 1) return "中";
  return "低";
}

function calculateRiskRegime(indices, sentiment, retail) {
  const byId = Object.fromEntries(indices.map((item) => [item.id, item]));
  const core = [byId.SPY, byId.QQQ, byId.VIX];
  const usableCore = core.filter((item) => item && Number.isFinite(Number(item.value)) && Number(item.value) > 0);
  const nonTradableCore = core.filter((item) => !item?.isTradable).length;
  if (!usableCore.length) {
    return {
      score: null,
      mode: "数据不足",
      confidence: "低",
      dataQuality: "unavailable",
      tradable: false,
      reason: "核心指数行情为空。",
      conclusion: "行情源为空，等待下一次刷新。",
      inputs: [["SPY", "数据不足"], ["QQQ", "数据不足"], ["VIX", "数据不足"], ["可信度", "低"]]
    };
  }
  const fearGreed = sentiment.find((item) => item.id === "Fear & Greed")?.value || 50;
  const qqq = byId.QQQ?.change || byId.NDX?.change || 0;
  const vix = byId.VIX?.change || 0;
  const dxy = byId.DXY?.change || 0;
  const tnx = byId.TNX?.change || 0;
  if (qqq > 0 && vix < 0 && dxy <= 0.15 && Math.abs(tnx) < 1.2) {
    return {
      score: 72,
      mode: "Risk-On",
      confidence: riskConfidence(nonTradableCore, core),
      dataQuality: nonTradableCore === 0 ? "live" : "proxy",
      tradable: true,
      reason: nonTradableCore === 0 ? "QQQ 上行、VIX 回落，美元与利率压力可控。" : "实时性不足，基于代理推断与延迟数据生成。",
      conclusion: "科技风险偏好增强，AI 半导体继续主导市场，谨慎追高，回踩优先。",
      inputs: [["VIX", signed(vix)], ["Fear & Greed", fearGreed], ["TNX", signed(tnx)], ["QQQ", signed(qqq)]]
    };
  }
  if (vix > 0 && dxy > 0 && tnx > 0 && qqq < 0) {
    return {
      score: 34,
      mode: "Risk-Off",
      confidence: riskConfidence(nonTradableCore, core),
      dataQuality: nonTradableCore === 0 ? "live" : "proxy",
      tradable: true,
      reason: nonTradableCore === 0 ? "VIX、DXY、TNX 上行且 QQQ 走弱。" : "实时性不足，基于代理推断与延迟数据生成。",
      conclusion: "VIX、DXY 与 TNX 同步施压，降低高 beta 暴露，等待风险释放。",
      inputs: [["VIX", signed(vix)], ["Fear & Greed", fearGreed], ["TNX", signed(tnx)], ["QQQ", signed(qqq)]]
    };
  }
  let score = 50;

  score += (byId.SPX?.change || 0) * 5.5;
  score += (byId.SPY?.change || 0) * 5.5;
  score += (byId.QQQ?.change || 0) * 7.5;
  score += (byId.NDX?.change || 0) * 8.5;
  score -= (byId.VIX?.change || 0) * 3.2;
  score -= Math.max(0, byId.TNX?.change || 0) * 2.4;
  score -= Math.max(0, byId.DXY?.change || 0) * 1.3;
  score += (fearGreed - 50) * 0.3;
  score += ((retail.score || 50) - 50) * 0.15;

  const bounded = clamp(Math.round(score));
  return {
    score: bounded,
    mode: bounded >= 56 ? "Risk-On" : bounded <= 44 ? "Risk-Off" : "Neutral",
    confidence: riskConfidence(nonTradableCore, core),
    dataQuality: nonTradableCore === 0 ? "delayed" : "proxy",
    tradable: true,
    reason: nonTradableCore === 0 ? "核心指数可用但信号未完全共振。" : "当前基于代理推断与延迟数据生成。",
    conclusion:
      bounded >= 56
        ? "纳指强于大盘、VIX 回落，盘前风险偏好处于进攻区。"
        : bounded <= 44
          ? "波动率与利率压力抬升，市场进入防御交易。"
          : "风险信号分化，等待开盘后资金方向确认。",
    inputs: [
      ["VIX", signed(byId.VIX?.change || 0)],
      ["Fear & Greed", fearGreed],
      ["TNX", signed(byId.TNX?.change || 0)],
      ["QQQ", signed(byId.QQQ?.change || byId.NDX?.change || 0)]
    ]
  };
}

function sentimentVerdict(sentiment, retail) {
  const fng = sentiment.find((item) => item.id === "Fear & Greed")?.value || 50;
  const rsi = sentiment.find((item) => item.id === "RSI")?.value || 50;
  const pc = sentiment.find((item) => item.id === "Put/Call")?.value || 1;
  if (fng >= 75 || rsi >= 70 || pc <= 0.65 || retail.score >= 78) return ["不宜追高", "情绪接近过热，等待回踩确认。"];
  if (fng <= 30 || pc >= 1.2 || retail.score <= 35) return ["恐慌可观察", "保护性需求高，等卖压衰竭。"];
  return ["可进攻但控仓", "乐观未极端，适合顺势但不适合重仓追价。"];
}

function strategyFrom(risk, flows, retail, options) {
  if (!risk.tradable) {
    return ["数据不足，等待下一次刷新。", "行情源完全为空时不生成方向性策略。"];
  }
  const leader = flows[0]?.sector || "科技";
  const callBias = options.filter((item) => String(item.type).toLowerCase().includes("call")).length;
  if (risk.mode === "Risk-On" && callBias >= 2) {
    return [`科技风险偏好增强，${leader}继续主导市场，谨慎追高，回踩优先。`, "热钱与期权资金同向时顺势，非主线只做低吸。"];
  }
  if (risk.mode === "Risk-Off") {
    return ["风险偏好转弱，降低高 beta 暴露，等待 VIX 回落与纳指转强。", "防御、现金与事件驱动优先于追涨交易。"];
  }
  if (retail.score >= 72) {
    return ["散户情绪升温但主线分化，保留仓位弹性，避免开盘无量追价。", "只交易高热度、高成交确认的龙头股。"];
  }
  return ["市场处于确认区，等待开盘 30 分钟量价方向后再加仓。", "仓位节奏比方向判断更重要。"];
}

function tapeRead(movers, flows) {
  if (!movers.length && !flows.length) {
    return { title: "数据不足", reason: "行情与板块源为空，等待下一次刷新。" };
  }
  if (!movers.some((item) => item.isTradable) && !flows.some((item) => item.isTradable)) {
    return { title: "代理推断模式", reason: "当前基于代理推断与延迟数据生成。" };
  }
  const leader = flows[0];
  const positive = movers.filter((item) => item.isTradable && item.change > 0).length;
  if (leader?.score >= 78 && positive >= 4) {
    return { title: `${leader.sector}主导风险偏好`, reason: "异动与热钱方向一致，盘前主线清晰。" };
  }
  if (positive <= 2) return { title: "资金偏防御", reason: "异动扩散不足，追涨胜率下降。" };
  return { title: "结构性机会", reason: "热钱集中在少数板块，避免无差别追高。" };
}

function render(dashboard) {
  const [chaseVerdict, chaseReason] = sentimentVerdict(dashboard.sentiment, dashboard.retail);

  document.body.dataset.risk = riskDatasetValue(dashboard.risk.mode);
  text("#riskMode", displayRiskModeHero(dashboard.risk.mode));
  text("#riskScore", dashboard.risk.score === null ? "--" : dashboard.risk.score);
  text("#riskConclusion", dashboard.risk.conclusion);
  text("#strategyText", dashboard.strategy);
  text("#strategyContext", dashboard.strategyContext);
  text("#chaseVerdict", chaseVerdict);
  text("#chaseReason", chaseReason);
  text("#asOf", dashboard.asOf);
  text("#dataStatus", dashboard.sourceMode);
  text("#tapeRead", dashboard.tape.title);
  text("#tapeReason", dashboard.tape.reason);
  text("#starSummary", dashboard.tape.title);
  text("#marketSummary", dashboard.marketSummary);
  text("#rvLeader", dashboard.scannerStatus.rvLeader);
  text("#strongestSector", dashboard.scannerStatus.strongestSector);
  text("#riskAppetite", dashboard.scannerStatus.riskAppetite);
  text("#premarketMomentum", dashboard.scannerStatus.premarketMomentum);
  text("#openingBias", dashboard.scannerStatus.openingBias);
  document.querySelector("#gaugeFill").style.width = `${dashboard.risk.score === null ? 0 : dashboard.risk.score}%`;
  document.querySelector("#statusDot").style.color = dashboard.sourceMode.startsWith("实时") ? "var(--green)" : "var(--gold)";
  document.querySelector("#statusDot").style.background = dashboard.sourceMode.startsWith("实时") ? "var(--green)" : "var(--gold)";

  renderModuleStatus(dashboard.moduleStatus);
  renderSources(dashboard.sourceStatus);
  renderRiskInputs(dashboard.risk);
  renderMetricGrid("#indexGrid", dashboard.indices);
  renderMacro(dashboard.macro);
  renderRetail(dashboard.retail, dashboard.moduleStatus.retail);
  renderOptions(dashboard.options);
  renderOpportunities(dashboard.opportunities);
  renderTradePlan(dashboard.tradePlan);
  renderMetricGrid("#sentimentGrid", dashboard.sentiment, "sentiment");
  renderMoverTable(dashboard.movers);
  renderFlows(dashboard.flows);
  renderStars(dashboard.stars);
  renderNews(dashboard.news);
  setLoading(false);
}

function renderModuleStatus(statusMap) {
  const mapping = {
    risk: ["#riskModuleMeta"],
    index: ["#indexModuleMeta"],
    sentiment: ["#sentimentModuleMeta"],
    flow: ["#flowModuleMeta"],
    mover: ["#moverModuleMeta"],
    star: ["#starModuleMeta"],
    opportunity: ["#opportunityModuleMeta"],
    tradePlan: ["#tradePlanModuleMeta"],
    news: ["#newsModuleMeta"],
    macro: ["#macroModuleMeta"],
    retail: ["#retailModuleMeta"],
    options: ["#optionsModuleMeta"],
    source: ["#sourceModuleMeta"]
  };

  for (const [key, selectors] of Object.entries(mapping)) {
    const item = statusMap[key] || { status: "fallback", timestamp: "--" };
    selectors.forEach((selector) => {
      const node = document.querySelector(selector);
      if (!node) return;
      node.classList.toggle("module-live", item.status === "live");
      node.classList.toggle("module-delayed", item.status === "delayed");
      node.classList.toggle("module-proxy", item.status === "proxy");
      node.classList.toggle("module-cached", item.status === "cached");
      node.classList.toggle("module-fallback", item.status === "fallback" || item.status === "snapshot");
      node.classList.toggle("module-unavailable", item.status === "unavailable");
      node.textContent = `${statusLabel(item.status, key)} · ${item.timestamp}`;
    });
  }
}

function statusLabel(status, key = "") {
  if (key === "options" && status === "live") return "实时期权流（LIVE）";
  if (status === "live") return "实时（LIVE）";
  if (status === "delayed") return "延迟（DELAYED）";
  if (status === "proxy") return "代理推断（PROXY）";
  if (status === "cached") return "缓存数据（CACHED）";
  if (status === "unavailable") return "数据不可用（UNAVAILABLE）";
  return "快照数据（SNAPSHOT）";
}

function displayRiskMode(mode) {
  if (mode === "数据不足") return "数据不足";
  if (mode === "Risk-On") return "风险偏好开启（Risk-On）";
  if (mode === "Risk-Off") return "风险规避（Risk-Off）";
  if (mode === "Neutral") return "中性（Neutral）";
  return mode || "--";
}

function displayRiskModeHero(mode) {
  if (mode === "数据不足") return "数据不足";
  if (mode === "Risk-On") return "风险偏好";
  if (mode === "Risk-Off") return "风险规避";
  if (mode === "Neutral") return "中性";
  return mode || "--";
}

function displayNewsBias(bias) {
  if (bias === "BULLISH" || bias === "利好") return "利好（Bullish）";
  if (bias === "BEARISH" || bias === "利空") return "利空（Bearish）";
  return "中性（Neutral）";
}

function displayTradeState(value = "") {
  const map = {
    WATCHLIST: "观察名单（Watchlist）",
    "WATCHLIST ONLY": "观察名单（Watchlist）",
    "HIGH MOMENTUM LONG": "强势做多（High Momentum Long）",
    "OPENING BREAKOUT WATCH": "开盘突破观察（Opening Breakout Watch）",
    "HIGH MOMENTUM WATCH": "高动量观察（High Momentum Watch）",
    "PUT / HEDGE WATCH": "对冲观察（Put / Hedge Watch）",
    "PUT / HEDGE PROXY": "对冲代理（Put / Hedge Proxy）",
    "CALL MOMENTUM PROXY": "看涨动量代理（Call Momentum Proxy）",
    "LOW QUALITY": "低质量机会（Low Quality）",
    "LOW QUALITY / IGNORE": "低质量机会（Low Quality）",
    "DATA INSUFFICIENT": "数据不足",
    CONFIRMED: "已确认（Confirmed）",
    "EARLY ONLY": "仅早盘观察（Early Only）",
    "FAILED OPEN": "开盘失败（Failed Open）",
    "BULLISH ABOVE VWAP": "VWAP 上方偏强（Bullish Above VWAP）",
    "WEAK BELOW VWAP": "VWAP 下方偏弱（Weak Below VWAP）",
    "VWAP WATCH": "VWAP 观察（VWAP Watch）",
    "HIGH CONVICTION": "高置信度（High Conviction）",
    MOMENTUM: "动量机会（Momentum）",
    RISKY: "高风险机会（Risky）",
    PROXY: "代理推断（Proxy）",
    "Chase Risk": "追高风险",
    "Gap Exhaustion": "跳空衰竭",
    "Crowded Risk": "散户拥挤",
    "Weak Volume": "量能偏弱",
    "Strong Trend": "趋势强劲",
    "Early Only": "仅早盘观察",
    "Put Watch": "看跌观察",
    "数据不足": "数据不足",
    WATCH: "观察"
  };
  return map[value] || value;
}

function riskDatasetValue(mode) {
  if (mode === "Risk-On") return "risk-on";
  if (mode === "Risk-Off") return "risk-off";
  if (mode === "Neutral") return "neutral";
  return "neutral";
}

function displayMetricId(id) {
  return {
    "Fear & Greed": "贪婪 / 恐慌指数",
    "Put/Call": "看涨看跌比"
  }[id] || id;
}

function displayMetricName(name) {
  return {
    "CNN Proxy": "CNN 代理",
    "CBOE Proxy": "CBOE 代理"
  }[name] || name;
}

function renderSources(items) {
  html("#sourceGrid", items.map((item) => `
    <article class="source-card quality-${escapeHtml(item.dataQuality || item.status)}">
      <span class="source-state ${item.status}">${statusLabel(item.status, item.key)}</span>
      <strong>${escapeHtml(item.label)}</strong>
      <p>Source：${escapeHtml(item.source || item.label)}<br>Status：${escapeHtml(statusLabel(item.status, item.key))}<br>Latency：${escapeHtml(sourceLatencyLabel(item.latency))} · Freshness：${escapeHtml(item.freshness || sourceAgeLabel(item.updatedAt))}<br>Confidence：${escapeHtml(item.confidence || confidenceLabelByStatus(item.status))} · Fallback：${escapeHtml(item.fallback ? "YES" : "NO")}<br>参与评分：${escapeHtml(sourceScoringLabel(item))}</p>
    </article>
  `).join(""));
}

function sourceLatencyLabel(latency) {
  if (!Number.isFinite(Number(latency))) return "stale";
  return `${Math.max(0, Math.round(Number(latency)))}ms`;
}

function sourceUpdatedLabel(item) {
  if (item.updatedAt) return formatDateTime(item.updatedAt);
  if (item.dataQuality === "snapshot") return "快照 / 低置信度代理";
  return item.timestamp || "--";
}

function sourceAgeLabel(updatedAt) {
  if (!updatedAt) return "age --";
  const minutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60000));
  return `age ${minutes}m`;
}

function sourceScoringLabel(item) {
  if (!item.isTradable) return "否";
  if (item.dataQuality === "proxy") return "辅助";
  return "是";
}

function sourceRole(key) {
  return {
    finnhub: "Finnhub 行情与新闻：有 API key 时作为优先源。",
    twelveData: "TwelveData 跨资产行情：补充指数、外汇与商品。",
    alphavantage: "AlphaVantage 宏观层：收益率、板块、财报日历。",
    fred: "FRED 宏观层：利率、失业与通胀结构。",
    earnings: "Earnings Layer：财报日历与财报催化强度。",
    insider: "Insider Layer：内部人交易方向与强度。",
    relativeVolume: "Relative Volume Scanner：盘前量能扩张识别。",
    marketBreadth: "Market Breadth Engine：市场参与度与广度评分。",
    yahoo: "指数、价格、盘前涨跌基础数据。",
    tradingView: "趋势筛选与强势股池。",
    finnhubInsider: "机构行为层：内部人交易线索。",
    finnhubEarnings: "财报驱动层：财报日历与预期偏差。",
    xMacro: "宏观快讯，不参与个股新闻。",
    reddit: "散户情绪，只读取 WSB。",
    finviz: "热钱板块：Finviz 适配器或 Yahoo 板块代理。",
    unusualWhales: "期权流代理信号：免费数据推断方向。",
    benzinga: "异动新闻：Benzinga 适配器或 Yahoo 新闻代理。"
  }[key];
}

function renderMetricGrid(selector, items, type = "index") {
  html(selector, items.map((item) => {
    const inverse = ["VIX", "TNX", "GOLD", "DXY", "Put/Call"].includes(item.id);
    return `
      <article class="metric-card quality-${escapeHtml(item.dataQuality || "snapshot")}">
        <div class="metric-head"><span>${escapeHtml(displayMetricId(item.id))}</span><span>${escapeHtml(displayMetricName(item.name || ""))}</span></div>
        <div class="metric-value">${formatNumber(item.value)}</div>
        <div class="metric-change ${changeClass(item.change, inverse)}">${type === "sentiment" && item.id !== "Put/Call" ? signedRaw(item.change) : signed(item.change)}</div>
        <p>${escapeHtml(item.note)}</p>
      </article>
    `;
  }).join(""));
}

function renderRiskInputs(risk) {
  html("#riskInputs", risk.inputs.map(([label, value]) => `
    <div class="factor-pill"><span>${escapeHtml(displayMetricId(label))}</span><strong>${escapeHtml(value)}</strong></div>
  `).join(""));
}

function renderMacro(items) {
  html("#macroFeed", items.map((item) => `
    <div class="feed-item">
      <div class="row-head"><span>${escapeHtml(item.source)}</span><span class="${toneClass(item.tone)}">${escapeHtml(item.tone || "neutral")}</span></div>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.summary)}</p>
    </div>
  `).join(""));
}

function renderRetail(retail, status = { status: "fallback" }) {
  const score = clamp(retail.score || 50);
  const angle = -90 + score * 1.8;
  const fearLabel = score >= 72 ? "贪婪" : score <= 35 ? "恐慌" : score >= 56 ? "偏乐观" : "中性";
  html("#retailPanel", `
    <div class="sentiment-gauge-card">
      <div class="dial" style="--needle:${angle}deg">
        <div class="dial-arc"></div>
        <div class="dial-needle"></div>
        <div class="dial-hub"></div>
        <div class="dial-score">${score}</div>
        <div class="dial-label">${escapeHtml(fearLabel)}</div>
      </div>
      <div class="dial-copy">
        <strong>${escapeHtml(retail.tone)}</strong>
        <p>${escapeHtml(retail.summary)}</p>
        <div class="dial-scale">
          <span>恐慌</span>
          <span>中性</span>
          <span>贪婪</span>
        </div>
      </div>
    </div>
    <div class="mention-grid">
      ${retail.mentions.map(([symbol, count]) => `<span>${escapeHtml(symbol)} <b>${count}次</b></span>`).join("")}
    </div>
    <p class="retail-note">${["fallback", "snapshot"].includes(status.status) ? "SNAPSHOT：当前为备用热度快照，等待 Reddit 数据刷新。" : "数字代表 WallStreetBets 近期帖子中股票代码被提及次数，仅代表散户关注度，不代表买卖信号。"}</p>
  `);
}

function renderOptions(items) {
  html("#optionsFlow", items.map((item) => `
    <div class="feed-item option-proxy-card quality-${escapeHtml(item.dataQuality || "proxy")}">
      <div class="row-head"><span>${escapeHtml(item.symbol)}</span><span>${escapeHtml(item.sector || "其他")}</span></div>
      <div class="option-score">${escapeHtml(displayTradeState(item.conviction || item.direction || "WATCHLIST"))}</div>
      <strong class="option-direction">代理评分（Proxy Score） ${item.score === null ? "--" : Math.round(Number(item.score || 0))}</strong>
      <p>${escapeHtml(item.summary)}</p>
      <small>${escapeHtml(statusLabel(item.dataQuality || "proxy"))} · 代理推断，不是真实期权大单</small>
      <small>${escapeHtml(item.risk || "风险：需等待开盘量价确认。")}</small>
    </div>
  `).join(""));
}

function renderOpportunities(items) {
  html("#opportunityGrid", items.map((item) => `
    <article class="opportunity-card ${signalClass(item.signal)} quality-${escapeHtml(item.dataQuality || "snapshot")}">
      <div class="opportunity-head">
        <div>
          <strong>${escapeHtml(item.symbol)}</strong>
          <span>${escapeHtml(item.sector)}</span>
        </div>
        <b>${item.score === null ? "--" : item.score}</b>
      </div>
      <div class="signal-pill">${escapeHtml(displayTradeState(item.signal))}</div>
      <p>${escapeHtml(item.logic)}</p>
      <div class="opportunity-meta">
        <span>可信度 ${escapeHtml(item.confidence || "低")}</span>
        <span>${escapeHtml(item.dataBasis || "快照，不参与交易")}</span>
        <span>RVOL ${Number(item.relativeVolume || 0).toFixed(2)}x</span>
        <span>${escapeHtml(displayTradeState(item.vwapBias))}</span>
        <span>${escapeHtml(displayTradeState(item.openingConfirmation))}</span>
      </div>
      <div class="risk-tags">
        ${item.riskTags.map((tag) => `<span>${escapeHtml(displayTradeState(tag))}</span>`).join("")}
      </div>
    </article>
  `).join(""));
}

function renderTradePlan(plan) {
  text("#tradePlanTitle", plan.title);
  text("#tradePlanBody", plan.body);
  html("#tradePlanList", `
    <div><span>优先关注</span>${plan.focus.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
    <div><span>避免</span>${plan.avoid.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
  `);
}

function signalClass(signal) {
  if (signal === "HIGH MOMENTUM LONG") return "signal-long";
  if (signal === "OPENING BREAKOUT WATCH" || signal === "HIGH MOMENTUM WATCH") return "signal-watch";
  if (signal === "PUT / HEDGE WATCH") return "signal-hedge";
  return "signal-ignore";
}

function renderMoverTable(items) {
  if (!items?.length) {
    html("#moverTable", `<div class="empty-state">暂无有效异动数据，等待下一次快照刷新。</div>`);
    return;
  }
  html("#moverTable", `
    <div class="table-row table-head"><span>股票</span><span>涨跌幅</span><span>板块</span><span>Benzinga 异动原因</span></div>
    ${items.map((item) => `
      <div class="table-row">
        <div><div class="symbol">${escapeHtml(item.symbol)}</div><div class="subtle">${escapeHtml(item.name)}</div></div>
        <strong class="${item.change >= 0 ? "up" : "down"}">${signed(item.change)}</strong>
        <span class="tag">${escapeHtml(item.sector)}</span>
        <div><div>${escapeHtml(item.reason)}</div><div class="subtle">${escapeHtml(item.bias)} / ${escapeHtml(item.durability)}</div></div>
      </div>
    `).join("")}
  `);
}

function renderFlows(items) {
  html("#flowGrid", items.map((item, index) => `
    <article class="flow-card quality-${escapeHtml(item.dataQuality || "proxy")}" title="${escapeHtml(item.summary)}">
      <div class="flow-rank"><span class="rank-num">#${index + 1}</span><span class="heat-score ${item.score >= 70 ? "up" : item.score <= 45 ? "down" : "flat"}">${item.score}</span></div>
      <h3>${escapeHtml(item.sector)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="subtle">${escapeHtml(statusLabel(item.dataQuality || "proxy"))} · Finviz heatmap ${signed(item.change)}</div>
      <div class="flow-bar"><span style="width:${item.score}%"></span></div>
    </article>
  `).join(""));
}

function renderStars(items) {
  html("#starGrid", items.map((item) => `
    <article class="star-card">
      <div class="star-head"><span>${escapeHtml(item.sector)}</span><span class="heat-score ${item.heat >= 72 ? "up" : "flat"}">${item.heat}</span></div>
      <h3>${escapeHtml(item.symbol)} <small>${escapeHtml(item.name)}</small></h3>
      <p>${escapeHtml(item.logic)}</p>
      <div class="tag">持续性：${escapeHtml(item.persistence)}</div>
      <div class="heat-bar"><span style="width:${item.heat}%"></span></div>
    </article>
  `).join(""));
}

function renderNews(items) {
  html("#newsGrid", items.map((item) => `
    <article class="news-card ${newsBiasClass(item.bias)}">
      <details>
        <summary>
          <span class="news-head">
            <span><b>${escapeHtml(item.ticker)}</b><em>${escapeHtml(item.sector)}</em></span>
            <span class="${item.bias === "BEARISH" ? "down" : item.bias === "BULLISH" ? "up" : "flat"}">${escapeHtml(displayNewsBias(item.bias))} · ${escapeHtml(item.time)}</span>
          </span>
          <strong class="news-title-cn">${escapeHtml(item.title)}</strong>
          <em class="news-title-en">Original: ${escapeHtml(item.originalTitle)}</em>
        </summary>
        <p>${escapeHtml(item.summary)}</p>
      </details>
    </article>
  `).join(""));
}

function newsBiasClass(bias) {
  if (bias === "BULLISH") return "bullish-card";
  if (bias === "BEARISH") return "bearish-card";
  return "neutral-card";
}

function startCountdown() {
  let next = REFRESH_SECONDS;
  setInterval(() => {
    text("#refreshTimer", `自动刷新 ${next}s`);
    next -= 1;
    if (next < 0) next = REFRESH_SECONDS;
  }, 1000);
}

async function refresh() {
  setLoading(true);
  await refreshSequentially();
}

function setLoading(isLoading) {
  document.querySelectorAll(".loading-zone").forEach((node) => {
    node.classList.toggle("is-loading", isLoading);
  });
}

function text(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function html(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.innerHTML = value;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 3 });
}

function signed(value) {
  return `${value > 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;
}

function signedRaw(value) {
  return `${value > 0 ? "+" : ""}${Number(value || 0).toFixed(1)}`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function changeClass(value, inverse = false) {
  const adjusted = inverse ? -value : value;
  if (adjusted > 0.05) return "up";
  if (adjusted < -0.05) return "down";
  return "flat";
}

function toneClass(tone) {
  if (tone === "bullish") return "up";
  if (tone === "bearish") return "down";
  return "flat";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

refresh();
startCountdown();
setInterval(refresh, REFRESH_SECONDS * 1000);
