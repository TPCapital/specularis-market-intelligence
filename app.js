const CONFIG = window.DASHBOARD_CONFIG || {};
const REFRESH_SECONDS = CONFIG.refreshSeconds || 300;
const CACHE_PREFIX = "ai-us-equity-dashboard:";
const INDEX_CACHE_KEY = `${CACHE_PREFIX}market-indices:lastKnownGood`;
const FALLBACK_SNAPSHOT_LABEL = "快照数据（SNAPSHOT）";
const CACHE_TRADABLE_MS = 15 * 60 * 1000;
const STATUS_WEIGHT = { live: 1, delayed: 0.75, proxy: 0.35, cached: 0.25, stale: 0.12, snapshot: 0, unavailable: 0 };
const SOURCE_WEIGHT = { marketData: 0.42, premarketMomentum: 0.2, marketBreadth: 0.16, tradingView: 0.12, relativeVolume: 0.1 };

const sourceCatalog = {
  finnhub: "Finnhub",
  twelveData: "TwelveData",
  alphavantage: "AlphaVantage",
  fred: "FRED",
  earnings: "Earnings Layer",
  insider: "Insider Layer",
  relativeVolume: "Relative Volume Scanner",
  premarketMomentum: "Premarket Momentum Engine",
  marketBreadth: "Market Breadth Engine",
  decisionEngine: "Decision Engine",
  tradeDecision: "Trade Decision Engine",
  newsAggregator: "News Aggregator",
  marketData: "Multi-source Market Data / Finnhub primary",
  tradingView: "TradingView Screener",
  xMacro: "Walter Bloomberg X / Kobeissi X",
  finnhubInsider: "Finnhub Insider",
  finnhubEarnings: "Finnhub Earnings",
  reddit: "WallStreetBets Reddit",
  finviz: "Finviz Heatmap",
  unusualWhales: "Options Signal System",
  benzinga: "Benzinga",
  marketStructurePro: "Market Structure Pro",
  yieldCurve: "Yield Curve Pro",
  oilLayer: "Oil Market Layer",
  fedWatch: "FedWatch Proxy",
  breadthPro: "Breadth Pro"
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
  marketData: {
    indices: [
      metric("SPY", "S&P 500 ETF", 689.12, 0, "结构参考 · 非实时"),
      metric("QQQ", "NASDAQ ETF", 612.4, 0, "结构参考 · 非实时"),
      metric("NDX", "NASDAQ 100", 25172.18, 0, "结构参考 · 非实时"),
      metric("VIX", "VOLATILITY", 13.62, 0, "结构参考 · 非实时"),
      metric("TNX", "10Y YIELD", 4.12, 0, "结构参考 · 非实时"),
      metric("DXY", "DOLLAR INDEX", 98.36, 0, "结构参考 · 非实时"),
      metric("GOLD", "GOLD", 3378.4, 0, "结构参考 · 非实时")
    ],
    quotes: []
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
  unusualWhales: [],
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

function writeIndexCache(indices = [], updatedAt = Date.now()) {
  const usable = (indices || []).filter((item) => {
    const value = Number(item?.value);
    const quality = normalizeDataQuality(item?.dataQuality || item?.status);
    return item?.id && Number.isFinite(value) && value > 0 && ["live", "delayed", "cached"].includes(quality);
  });
  if (!usable.length) return;
  try {
    const existing = readIndexCache();
    const merged = new Map((existing || []).map((item) => [item.id, item]));
    usable.forEach((item) => {
      merged.set(item.id, {
        ...item,
        value: Number(item.value),
        change: Number(item.change || 0),
        dataQuality: normalizeDataQuality(item.dataQuality || item.status),
        status: normalizeDataQuality(item.dataQuality || item.status),
        updatedAt: Number(item.updatedAt || updatedAt || Date.now()),
        source: item.source || "Market Data Cache",
        note: item.note || "最近有效数据"
      });
    });
    localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify([...merged.values()]));
  } catch (error) {
    console.warn("index cache write skipped", error);
  }
}

function readIndexCache() {
  try {
    const raw = localStorage.getItem(INDEX_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("index cache read skipped", error);
    return [];
  }
}

function mergeIndexFallbacks(indices = [], serverLastKnown = []) {
  const byId = new Map((indices || []).map((item) => [item.id, item]));
  (serverLastKnown || []).forEach((item) => {
    const current = byId.get(item.id);
    const currentValue = Number(current?.value);
    const fallbackValue = Number(item?.value);
    if ((!Number.isFinite(currentValue) || currentValue <= 0) && Number.isFinite(fallbackValue) && fallbackValue > 0) {
      byId.set(item.id, {
        ...item,
        dataQuality: "cached",
        status: "cached",
        isTradable: false,
        source: item.source || "Server lastKnownGood",
        note: "最近有效数据 · 服务端缓存"
      });
    }
  });
  return [...byId.values()];
}

function countLiveDelayed(items = []) {
  return (items || []).filter((item) => ["live", "delayed"].includes(normalizeDataQuality(item?.dataQuality || item?.status))).length;
}

function marketDataCandidate(data = {}, source = "fallback", provider = "", cacheAdapter = "") {
  const indices = Array.isArray(data?.indices) ? data.indices : [];
  const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
  const liveDelayedIndicesCount = countLiveDelayed(indices);
  const liveDelayedQuotesCount = countLiveDelayed(quotes);
  const usable = liveDelayedIndicesCount >= 2 || liveDelayedQuotesCount >= 3;
  const newestUpdatedAt = [...indices, ...quotes].map((item) => Number(item?.updatedAt || item?.timestamp || 0)).filter(Number.isFinite).sort((a, b) => b - a)[0] || null;
  const hasLive = [...indices, ...quotes].some((item) => normalizeDataQuality(item?.dataQuality || item?.status) === "live");
  const hasDelayed = [...indices, ...quotes].some((item) => normalizeDataQuality(item?.dataQuality || item?.status) === "delayed");
  return {
    indices,
    quotes,
    provider: provider || data?.provider || data?.source || "Market Data",
    source,
    cacheAdapter,
    dataQuality: hasLive ? "live" : hasDelayed ? "delayed" : usable ? "cached" : "snapshot",
    usable,
    liveDelayedIndicesCount,
    liveDelayedQuotesCount,
    updatedAt: newestUpdatedAt
  };
}

function resolveActiveMarketData(payload = {}) {
  const candidates = [
    marketDataCandidate(payload.sources?.marketData?.data, "current", payload.sources?.marketData?.provider || payload.summary?.provider, payload.lastKnownGood?.adapter),
    marketDataCandidate(payload.marketData, "current", payload.marketData?.provider || payload.summary?.provider, payload.lastKnownGood?.adapter),
    marketDataCandidate(payload.lastKnownGood?.marketData, "lastKnownGood", payload.lastKnownGood?.marketData?.provider || "Upstash lastKnownGood", payload.lastKnownGood?.adapter),
    marketDataCandidate(payload.lastKnownGood?.sources?.marketData?.data, "lastKnownGood", payload.lastKnownGood?.sources?.marketData?.provider || "Upstash lastKnownGood", payload.lastKnownGood?.adapter),
    marketDataCandidate({ indices: payload.indices || [], quotes: payload.quotes || [] }, "current", payload.summary?.provider, payload.lastKnownGood?.adapter),
    marketDataCandidate(fallback.marketData, "fallback", "Structural reference", payload.lastKnownGood?.adapter)
  ];
  const selected = candidates.find((candidate) => candidate.usable) || candidates.find((candidate) => candidate.indices.length || candidate.quotes.length) || candidates.at(-1);
  return {
    ...selected,
    provider: selected.provider || "Market Data",
    source: selected.source || "fallback",
    dataQuality: selected.dataQuality || "snapshot"
  };
}

async function loadServerSnapshot() {
  const url = endpoint("snapshot");
  if (!url) return null;
  const joiner = url.includes("?") ? "&" : "?";
  const json = await fetchJson(`${url}${joiner}ts=${Date.now()}`);
  const activeMarketData = resolveActiveMarketData(json);
  const marketData = activeMarketData;
  const indices = mergeIndexFallbacks(activeMarketData.indices || [], json.lastKnownGood?.indices || []);
  const quotes = activeMarketData.quotes || [];
  const summary = json.summary || {};
  const strategySummary = json.strategySummary || null;
  const marketRegime = json.marketRegime || null;
  const tradePlan = json.tradePlan || null;
  const tradeDecision = json.tradeDecision || json.sources?.tradeDecision?.data || json.sources?.decisionEngine?.data?.tradeDecision || null;
  const watchlist = json.watchlist || null;
  if (window.DEBUG_FRONTEND === true) {
    console.log("[FRONTEND SNAPSHOT]", json);
    console.log("[FRONTEND MARKET DATA]", marketData);
    console.log("[FRONTEND INDICES]", indices);
    console.log("[FRONTEND QUOTES]", quotes);
  }
  const sources = fallbackSources();
  for (const [key, value] of Object.entries(json.sources || {})) {
    const normalizedStatus = normalizeDataQuality(value?.status);
    if (!sources[key] || !["live", "delayed", "proxy", "cached", "snapshot", "unavailable"].includes(normalizedStatus) || !hasSnapshotData(value.data)) continue;
    const servedFromLastKnownGood = ["last-success", "last-known-good", "last-success-memory"].includes(json.servedFrom);
    const status = servedFromLastKnownGood || normalizedStatus === "cached" ? "cached" : normalizedStatus;
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
  const marketStatus = normalizeDataQuality(activeMarketData.dataQuality || marketData.status || summary.status || json.sources?.marketData?.status || ((indices.length || quotes.length) ? "delayed" : "unavailable"));
  if (indices.length || quotes.length || marketStatus === "live") {
    const updatedAt = marketStatus === "snapshot" ? null : Number(activeMarketData.updatedAt || marketData.updatedAt || summary.updatedAt || json.lastKnownGood?.generatedAt || json.generatedAt || Date.now());
    sources.marketData = {
      data: {
        ...marketData,
        indices,
        quotes,
        provider: marketData.provider || summary.provider || json.sources?.marketData?.provider || "Multi-source Market Data",
        activeSource: activeMarketData.source,
        cacheAdapter: activeMarketData.cacheAdapter,
        debugActiveMarketData: json.debugActiveMarketData || {
          selectedSource: activeMarketData.source,
          indicesCount: indices.length,
          liveDelayedIndicesCount: activeMarketData.liveDelayedIndicesCount,
          quotesCount: quotes.length,
          liveDelayedQuotesCount: activeMarketData.liveDelayedQuotesCount,
          provider: activeMarketData.provider,
          cacheAdapter: activeMarketData.cacheAdapter || json.lastKnownGood?.adapter || "memory"
        }
      },
      status: marketStatus,
      label: sourceCatalog.marketData,
      source: activeMarketData.source === "lastKnownGood"
        ? `显示最近有效数据 · ${(activeMarketData.cacheAdapter || "cache").toUpperCase()}`
        : marketData.source || json.sources?.marketData?.source || sourceCatalog.marketData,
      updatedAt,
      timestamp: activeMarketData.source === "lastKnownGood"
        ? `最近有效 ${formatDateTime(updatedAt)}`
        : ["live", "delayed", "proxy"].includes(marketStatus) ? formatClock(updatedAt) : marketStatus === "cached" ? `最后成功 ${formatDateTime(updatedAt)}` : "SNAPSHOT",
      latency: Number.isFinite(Number(json.sources?.marketData?.latency)) ? Number(json.sources.marketData.latency) : null,
      confidence: activeMarketData.liveDelayedIndicesCount >= 2 && activeMarketData.liveDelayedQuotesCount >= 3 ? "MEDIUM" : json.sources?.marketData?.confidence || confidenceLabelByStatus(marketStatus),
      freshness: json.sources?.marketData?.freshness || freshnessLabel(updatedAt, marketStatus),
      fallback: activeMarketData.source !== "current",
      activeSource: activeMarketData.source,
      cacheAdapter: activeMarketData.cacheAdapter,
      debugActiveMarketData: json.debugActiveMarketData || {
        selectedSource: activeMarketData.source,
        indicesCount: indices.length,
        liveDelayedIndicesCount: activeMarketData.liveDelayedIndicesCount,
        quotesCount: quotes.length,
        liveDelayedQuotesCount: activeMarketData.liveDelayedQuotesCount,
        provider: activeMarketData.provider,
        cacheAdapter: activeMarketData.cacheAdapter || json.lastKnownGood?.adapter || "memory"
      },
      activeStats: {
        indicesCount: indices.length,
        liveDelayedIndicesCount: activeMarketData.liveDelayedIndicesCount,
        quotesCount: quotes.length,
        liveDelayedQuotesCount: activeMarketData.liveDelayedQuotesCount
      }
    };
    writeSourceCache("marketData", sources.marketData.data, updatedAt, marketStatus);
    writeIndexCache(indices, updatedAt);
  }
  if (json.breadth) {
    const status = normalizeDataQuality(json.breadth.status || json.sources?.marketBreadth?.status || marketStatus);
    const updatedAt = Number(json.breadth.updatedAt || json.generatedAt || Date.now());
    sources.marketBreadth = {
      data: json.breadth,
      status,
      label: sourceCatalog.marketBreadth,
      source: json.breadth.source || sourceCatalog.marketBreadth,
      updatedAt,
      timestamp: ["live", "delayed", "proxy"].includes(status) ? formatClock(updatedAt) : "SNAPSHOT",
      latency: Number.isFinite(Number(json.breadth.latency)) ? Number(json.breadth.latency) : null,
      confidence: json.breadth.confidence || confidenceLabelByStatus(status),
      freshness: json.breadth.freshness || freshnessLabel(updatedAt, status),
      fallback: Boolean(json.breadth.fallback)
    };
  }
  if (json.premarket?.momentum) {
    const status = normalizeDataQuality(json.premarket.momentum.status || json.sources?.premarketMomentum?.status || marketStatus);
    const updatedAt = Number(json.premarket.momentum.updatedAt || json.generatedAt || Date.now());
    sources.premarketMomentum = {
      data: json.premarket.momentum,
      status,
      label: sourceCatalog.premarketMomentum,
      source: json.premarket.momentum.source || sourceCatalog.premarketMomentum,
      updatedAt,
      timestamp: ["live", "delayed", "proxy"].includes(status) ? formatClock(updatedAt) : "SNAPSHOT",
      latency: null,
      confidence: json.premarket.momentum.confidence || confidenceLabelByStatus(status),
      freshness: freshnessLabel(updatedAt, status),
      fallback: Boolean(json.premarket.momentum.fallback)
    };
  }
  applyMarketStructureSources(sources, json, marketStatus);

  if (strategySummary || marketRegime || tradePlan || tradeDecision || watchlist || json.confidenceScore) {
    const status = normalizeDataQuality(json.sources?.decisionEngine?.status || marketStatus || "delayed");
    const updatedAt = Number(json.generatedAt || Date.now());
    sources.decisionEngine = {
      data: {
        strategySummary,
        marketRegime,
        tradePlan,
        tradeDecision,
        watchlist,
        confidenceScore: json.confidenceScore
      },
      status,
      label: sourceCatalog.decisionEngine,
      source: sourceCatalog.decisionEngine,
      updatedAt,
      timestamp: ["live", "delayed", "proxy"].includes(status) ? formatClock(updatedAt) : "SNAPSHOT",
      latency: null,
      confidence: json.confidenceScore?.tradeConfidence || confidenceLabelByStatus(status),
      freshness: "current snapshot",
      fallback: false
    };
  }
  if (json.premarket?.movers || json.sources?.newsAggregator?.data?.news) {
    const status = normalizeDataQuality(json.sources?.newsAggregator?.status || "delayed");
    const updatedAt = Number(json.generatedAt || Date.now());
    const data = {
      movers: json.premarket?.movers || json.sources?.newsAggregator?.data?.movers || [],
      news: json.sources?.newsAggregator?.data?.news || []
    };
    sources.newsAggregator = { ...sources.newsAggregator, data, status, updatedAt, timestamp: formatClock(updatedAt), confidence: confidenceLabelByStatus(status), fallback: false };
    sources.benzinga = { ...sources.benzinga, data, status, updatedAt, timestamp: formatClock(updatedAt), confidence: confidenceLabelByStatus(status), fallback: false };
  }
  return sources;
}

function hasSnapshotData(data) {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data).length > 0;
  return true;
}


function applyMarketStructureSources(sources, json = {}, marketStatus = "proxy") {
  const generatedAt = Number(json.generatedAt || Date.now());
  const root = json.marketStructurePro || json.sources?.marketStructurePro?.data || {};
  const payloads = {
    marketStructurePro: root,
    yieldCurve: json.yieldCurve || root.yieldCurve || json.sources?.yieldCurve?.data || {},
    oilLayer: json.oil || root.oil || json.sources?.oilLayer?.data || {},
    fedWatch: json.fedWatch || root.fedWatch || json.sources?.fedWatch?.data || {},
    breadthPro: json.breadthPro || root.breadthPro || json.sources?.breadthPro?.data || {}
  };
  for (const [key, data] of Object.entries(payloads)) {
    if (!hasSnapshotData(data)) continue;
    const sourcePayload = json.sources?.[key] || {};
    const rawStatus = data.status || sourcePayload.status || root.status || marketStatus || "proxy";
    const status = normalizeDataQuality(rawStatus);
    const updatedAt = Number(sourcePayload.updatedAt || data.updatedAt || generatedAt || Date.now());
    sources[key] = {
      data,
      status,
      dataQuality: status,
      label: sourceCatalog[key],
      source: data.source || sourcePayload.source || sourceCatalog[key],
      updatedAt,
      timestamp: ["live", "delayed", "proxy"].includes(status) ? formatClock(updatedAt) : status === "cached" ? `最后成功 ${formatDateTime(updatedAt)}` : "最近快照",
      latency: Number.isFinite(Number(sourcePayload.latency)) ? Number(sourcePayload.latency) : null,
      confidence: data.confidence || sourcePayload.confidence || confidenceLabelByStatus(status),
      freshness: sourcePayload.freshness || freshnessLabel(updatedAt, status),
      fallback: ["proxy", "cached", "stale", "snapshot"].includes(status)
    };
    writeSourceCache(key, data, updatedAt, status);
  }
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
    marketData: fallbackSource("marketData", fallback.marketData),
    finnhub: fallbackSource("finnhub", []),
    twelveData: fallbackSource("twelveData", []),
    alphavantage: fallbackSource("alphavantage", null),
    fred: fallbackSource("fred", []),
    earnings: fallbackSource("earnings", { events: [] }),
    insider: fallbackSource("insider", { signals: [] }),
    relativeVolume: fallbackSource("relativeVolume", { leaders: [] }),
    premarketMomentum: fallbackSource("premarketMomentum", { leaders: [] }),
    marketBreadth: fallbackSource("marketBreadth", {}),
    marketStructurePro: fallbackSource("marketStructurePro", {}),
    yieldCurve: fallbackSource("yieldCurve", {}),
    oilLayer: fallbackSource("oilLayer", {}),
    fedWatch: fallbackSource("fedWatch", {}),
    breadthPro: fallbackSource("breadthPro", {}),
    decisionEngine: fallbackSource("decisionEngine", {}),
    tradeDecision: fallbackSource("tradeDecision", {}),
    tradingView: fallbackSource("tradingView", fallback.tradingView),
    finnhubInsider: fallbackSource("finnhubInsider", []),
    finnhubEarnings: fallbackSource("finnhubEarnings", []),
    xMacro: fallbackSource("xMacro", fallback.xMacro),
    reddit: fallbackSource("reddit", fallback.reddit),
    finviz: fallbackSource("finviz", fallback.finviz),
    unusualWhales: fallbackSource("unusualWhales", fallback.unusualWhales),
    newsAggregator: fallbackSource("newsAggregator", fallback.benzinga),
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
  if (value === "stale") return "stale";
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
      sourceStatus: source?.sourceStatus || source?.fetchStatus || statusLabel(dataQuality, key),
      fetchedAt: Number(source?.fetchedAt || 0) || null,
      publishedAt: Number(source?.publishedAt || source?.updatedAt || 0) || null,
      sourcePlan: source?.sourcePlan || null,
      primarySource: source?.primarySource || source?.sourcePlan?.primary || null,
      backupSources: source?.backupSources || source?.sourcePlan?.backups || [],
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
  if (dataQuality === "snapshot") return "最新快照";
  if (dataQuality === "unavailable") return "结构参考";
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

function riskModeFromDecision(type = "") {
  if (["RISK_ON", "TREND_DAY", "SQUEEZE"].includes(type)) return "Risk-On";
  if (["RISK_OFF", "GAP_FADE"].includes(type)) return "Risk-Off";
  if (type === "CHOP") return "Chop";
  return "Neutral";
}

function riskFromDecisionEngine(marketRegime = {}, strategySummary = {}, indices = [], confidenceScore = {}) {
  const byId = Object.fromEntries((indices || []).map((item) => [item.id, item]));
  const score = Number.isFinite(Number(marketRegime.score)) ? Number(marketRegime.score) : 50;
  return {
    score,
    mode: riskModeFromDecision(marketRegime.type),
    confidence: confidenceScore.tradeConfidence === "HIGH" ? "高" : confidenceScore.tradeConfidence === "MEDIUM" ? "中" : "低",
    dataQuality: "live",
    tradable: true,
    reason: marketRegime.explanation || "LIVE marketData 已接入，基于指数、宽度与动能生成风险判断。",
    conclusion: strategySummary.summary || marketRegime.explanation || "市场进入可交易评估状态。",
    inputs: [
      ["SPY", signed(byId.SPY?.change || 0)],
      ["QQQ", signed(byId.QQQ?.change || 0)],
      ["VIX", signed(byId.VIX?.change || 0)],
      ["宽度", marketRegime.breadthStrength ?? "待确认"]
    ]
  };
}

function tradePlanFromDecision(plan = {}, watchlist = {}) {
  const focus = [...(watchlist.strong || []), ...(watchlist.watch || [])].slice(0, 3).map((item) => `${item.symbol}：${item.setup || "观察开盘确认"}`);
  return {
    title: plan.action || "可进攻但控仓",
    body: `${plan.entryCondition || "只做开盘后放量突破 VWAP 的强势股"} ${plan.invalidation || ""}`.trim(),
    focus: focus.length ? focus : [plan.entryCondition || "等待强势股开盘确认"],
    avoid: [plan.avoidCondition || "避免无量高开与低 RVOL breakout", plan.riskControl || "单笔风险控制在账户 1%-2%"]
  };
}

function tradePlanFromTradeDecision(decision = {}, fallbackPlan = {}) {
  const focus = Array.isArray(decision.focus) && decision.focus.length
    ? decision.focus.slice(0, 5)
    : (decision.targets || []).slice(0, 5).map((item) => `${item.symbol}｜${item.grade || '观察'}｜${item.direction || 'WAIT'}｜${item.entryTrigger || '等待确认'}`);
  const avoid = Array.isArray(decision.avoid) && decision.avoid.length
    ? decision.avoid.slice(0, 5)
    : (fallbackPlan.avoid || ['无量高开不追', '跌回 VWAP 下方取消追涨']);
  return {
    title: decision.title || decision.actionBias || fallbackPlan.title || '等待确认',
    body: decision.summary || fallbackPlan.body || '等待开盘量价确认。',
    focus: focus.length ? focus : (fallbackPlan.focus || ['等待交易决策引擎刷新']),
    avoid,
    grade: decision.grade,
    score: decision.score,
    permission: decision.permission,
    probability: decision.probability,
    checklist: decision.checklist || [],
    riskControl: decision.riskControl || null,
    topTarget: decision.topTarget || null
  };
}

function buildDashboard(sources) {
  sources = enrichSources(sources);
  const reliability = computeDataReliability(sources);
  if (sources.marketData?.activeStats?.liveDelayedIndicesCount >= 2 && sources.marketData?.activeStats?.liveDelayedQuotesCount >= 3 && reliability.score < 52) {
    reliability.score = 58;
    reliability.grade = "MEDIUM";
  }
  const scoreEligible = {
    quotes: isCoreScoreSource(sources.marketData),
    sectors: isCoreScoreSource(sources.marketBreadth) || isCoreScoreSource(sources.premarketMomentum) || isCoreScoreSource(sources.tradingView),
    news: isCoreScoreSource(sources.newsAggregator),
    retail: false,
    options: false,
    earnings: false,
    insider: false,
    relativeVolume: isCoreScoreSource(sources.relativeVolume),
    breadth: isCoreScoreSource(sources.marketBreadth)
  };
  const benzingaData = sources.benzinga?.data || {};
  const marketQuotes = normalizeQuotes(sources.marketData?.data?.quotes || fallback.marketData.quotes, sources.marketData);
  const marketIndices = sanitizeIndices(sources.marketData?.data?.indices, sources.marketData);
  const quotesForScoring = marketQuotes.filter(isUsableForInference);
  const indicesForScoring = marketIndices.filter(isUsableForInference);
  const quoteMap = new Map(marketQuotes.map((item) => [item.symbol, item]));
  const flows = normalizeSectors(sources.finviz.data, sources.finviz);
  const flowsForScoring = [];
  const moversRaw = Array.isArray(benzingaData.movers) && benzingaData.movers.length
    ? benzingaData.movers
    : deriveMoversFromQuotes(marketQuotes);
  const movers = normalizeMovers(moversRaw, quoteMap, marketQuotes);
  const stars = normalizeStars(sources.tradingView.data, quoteMap);
  const newsItems = Array.isArray(sources.newsAggregator?.data?.news) ? sources.newsAggregator.data.news : Array.isArray(sources.benzinga?.data?.news) ? sources.benzinga.data.news : [];
  const newsForScoring = scoreEligible.news ? newsItems : [];
  const options = normalizeOptions(sources.unusualWhales.data, sources.unusualWhales);
  const premarketMomentum = normalizePremarketMomentum(sources.premarketMomentum?.data?.leaders || [], sources.premarketMomentum);
  const retail = normalizeRetailSentiment(sources.reddit?.data, { premarketMomentum, quotes: marketQuotes, news: newsItems, source: sources.reddit });
  const optionsForScoring = [];
  const retailForScoring = scoreEligible.retail ? retail : {};
  const marketBreadth = sources.marketBreadth?.data || {};
  const decision = sources.decisionEngine?.data || {};
  const tradeDecision = decision.tradeDecision || sources.tradeDecision?.data || null;
  const strategyFlows = flowsForScoring.length ? flowsForScoring : deriveStrategyFlows(premarketMomentum, stars, marketBreadth);
  const calculatedRisk = indicesForScoring.length
    ? calculateRiskRegime(indicesForScoring, [], {}, {
        breadth: marketBreadth,
        momentum: premarketMomentum,
        tradingView: stars
      })
    : {
        score: null,
        mode: "结构参考",
        confidence: "低",
        dataQuality: "unavailable",
        tradable: false,
        reason: "核心行情处于最近有效快照。",
        conclusion: "显示最近有效数据，等待盘前量能确认。",
        inputs: [["SPY", "最近有效"], ["QQQ", "最近有效"], ["VIX", "最近有效"], ["可信度", "中"]]
      };
  const risk = decision.marketRegime && indicesForScoring.length
    ? riskFromDecisionEngine(decision.marketRegime, decision.strategySummary, indicesForScoring, decision.confidenceScore)
    : calculatedRisk;
  const opportunityBuckets = calculatePremarketOpportunities(quotesForScoring, {
    flows: strategyFlows,
    news: newsForScoring,
    retail: retailForScoring,
    risk,
    indices: indicesForScoring,
    options: optionsForScoring
  });
  const opportunities = opportunityBuckets.highConfidenceOpportunities;
  const watchlistOnly = opportunityBuckets.watchlistOnly;
  const starsWithWatchlist = mergeWatchlistIntoStars(stars, watchlistOnly);
  const generatedTradePlan = buildPremarketTradePlan(opportunities, strategyFlows, risk, optionsForScoring, premarketMomentum);
  const tradePlan = tradeDecision && tradeDecision.focus
    ? tradePlanFromTradeDecision(tradeDecision, generatedTradePlan)
    : decision.tradePlan && indicesForScoring.length
      ? tradePlanFromDecision(decision.tradePlan, decision.watchlist)
      : generatedTradePlan;
  const [strategy, strategyContext] = decision.strategySummary && indicesForScoring.length
    ? [decision.strategySummary.headline, `${decision.strategySummary.summary} 置信度 ${decision.strategySummary.confidence || "MEDIUM"}。`]
    : strategyFrom(risk, strategyFlows, retailForScoring, optionsForScoring, {
    momentum: premarketMomentum,
    breadth: marketBreadth,
    tradingView: stars
  });
  const strategyBasis = statusGroup([sources.decisionEngine, sources.marketData, sources.premarketMomentum, sources.marketBreadth, sources.tradingView]);
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
        fallback: value.fallback,
        activeSource: value.activeSource,
        cacheAdapter: value.cacheAdapter,
        activeStats: value.activeStats,
        indexDebug: key === "marketData"
          ? (value.data?.indices || []).filter((item) => ["NDX", "VIX", "DXY"].includes(item.id)).map((item) => ({
              id: item.id,
              successfulSource: item.successfulSource || "未命中",
              providerSymbol: item.providerSymbol || item.id,
              failedSources: item.failedSources || []
            }))
          : [],
        debugActiveMarketData: key === "marketData" ? (value.debugActiveMarketData || null) : null
      })),
    moduleStatus: {
      risk: statusGroup([sources.marketData]),
      index: statusGroup([sources.marketData]),
      sentiment: { status: "snapshot", timestamp: "最新快照" },
      flow: statusGroup([sources.finviz]),
      mover: statusGroup([sources.benzinga]),
      star: statusGroup([sources.tradingView]),
      opportunity: statusGroup([sources.marketData, sources.finviz, sources.reddit, sources.benzinga]),
      momentum: statusGroup([sources.premarketMomentum, sources.marketData, sources.relativeVolume]),
      marketStructure: statusGroup([sources.marketStructurePro, sources.yieldCurve, sources.oilLayer, sources.fedWatch, sources.breadthPro]),
      tradePlan: statusGroup([sources.decisionEngine, sources.marketData, sources.finviz, sources.unusualWhales]),
      news: statusGroup([sources.benzinga]),
      macro: statusGroup([sources.xMacro]),
      retail: retail.dataQuality === "proxy" ? { status: "proxy", timestamp: "代理热度" } : statusGroup([sources.reddit]),
      options: statusGroup([sources.unusualWhales]),
      source: sourceBasis
    },
    indices: marketIndices,
    marketStructurePro: sources.marketStructurePro?.data || {
      sectorRotation: sources.marketStructurePro?.data?.sectorRotation || {},
      yieldCurve: sources.yieldCurve?.data || {},
      oil: sources.oilLayer?.data || {},
      fedWatch: sources.fedWatch?.data || {},
      breadthPro: sources.breadthPro?.data || {}
    },
    sentiment: sources.sentiment,
    macro: sources.xMacro.data,
    retail,
    options,
    opportunities,
    opportunityWatchlist: watchlistOnly,
    premarketMomentum,
    tradeDecision,
    tradePlan,
    scannerStatus: buildScannerStatus(opportunities, flows.length ? flows : strategyFlows, risk, premarketMomentum),
    flows,
    movers,
    stars: starsWithWatchlist,
    news: normalizeNews(newsItems),
    risk,
    marketSummary: marketSummary(marketIndices, risk, marketBreadth, premarketMomentum),
    strategy,
    strategyContext: `${dataBasisLabel(strategyBasis)}。数据可靠性：${reliability.grade === "MEDIUM" ? "中" : reliability.grade} (${reliability.score})。${sources.marketData?.activeSource === "lastKnownGood" ? `持久缓存：${String(sources.marketData.cacheAdapter || "cache").toUpperCase()}。` : ""}${strategyContext}`,
    dataReliability: reliability,
    tape: tapeRead(movers, flows)
  };
}

function latestDataTimestamp(sources) {
  const usable = Object.values(sources)
    .filter((source) => source?.updatedAt && ["live", "delayed", "proxy", "cached"].includes(source.dataQuality))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (sources.marketData?.activeSource === "lastKnownGood" && sources.marketData?.updatedAt) return `显示最近有效数据 · ${String(sources.marketData.cacheAdapter || "cache").toUpperCase()} · ${formatDateTime(sources.marketData.updatedAt)}`;
  return usable[0] ? formatDateTime(usable[0].updatedAt) : "最近有效快照";
}

function sanitizeIndices(indices = [], marketSource = {}) {
  const fallbackById = new Map(fallback.marketData.indices.map((item) => [item.id, item]));
  const localById = new Map(readIndexCache().map((item) => [item.id, item]));
  const byId = new Map((indices || []).map((item) => [item.id, item]));
  const orderedIds = ["SPY", "QQQ", "NDX", "VIX", "TNX", "DXY", "GOLD"];
  const dynamicIds = [...new Set([...orderedIds, ...byId.keys(), ...localById.keys(), ...fallbackById.keys()])];
  const sanitized = dynamicIds.map((id) => {
    const fallbackMetric = fallbackById.get(id) || { id, name: id, value: null, change: 0, note: "结构参考" };
    const cachedMetric = localById.get(id);
    const live = byId.get(id);
    const value = Number(live?.value);
    if (!Number.isFinite(value) || value <= 0) {
      if (cachedMetric && Number.isFinite(Number(cachedMetric.value)) && Number(cachedMetric.value) > 0) {
        return {
          ...cachedMetric,
          id,
          name: cachedMetric.name || fallbackMetric.name || id,
          value: Number(cachedMetric.value),
          change: Number(cachedMetric.change || 0),
          dataQuality: "cached",
          status: "cached",
          source: cachedMetric.source || "Browser lastKnownGood",
          updatedAt: Number(cachedMetric.updatedAt || 0) || null,
          isTradable: false,
          note: "最近有效数据 · 浏览器缓存"
        };
      }
      return {
        ...fallbackMetric,
        value: fallbackMetric.value,
        change: fallbackMetric.change,
        dataQuality: "snapshot",
        status: "snapshot",
        source: "Structural reference",
        updatedAt: null,
        isTradable: false,
        note: "结构参考 · 非实时"
      };
    }
    const item = attachQuality(live, marketSource, marketSource.label, live.status || marketSource.status);
    return {
      ...item,
      note: item.note || (item.isTradable ? "延迟数据" : "缓存快照")
    };
  }).filter(Boolean);
  writeIndexCache(sanitized, marketSource.updatedAt || Date.now());
  return sanitized;
}

function sourceModeLabel(sources) {
  if (sources.marketData?.activeSource === "lastKnownGood") return `显示最近有效数据 · ${String(sources.marketData.cacheAdapter || "cache").toUpperCase()}`;
  const statuses = Object.values(sources).map((source) => source?.status).filter(Boolean);
  if (statuses.some((status) => status === "live")) return "实时 + 结构化情报";
  if (statuses.some((status) => status === "delayed")) return "延迟 + 结构化情报";
  if (statuses.some((status) => status === "proxy")) return "代理推断情报";
  if (statuses.some((status) => status === "cached")) return "缓存快照";
  if (statuses.some((status) => status === "unavailable")) return "结构参考";
  return "最新快照";
}

function dataBasisLabel(item) {
  if (item.status === "live") return `资金流基于实时数据 ${item.timestamp}`;
  if (item.status === "delayed") return `资金流基于延迟数据 ${item.timestamp}`;
  if (item.status === "proxy") return `资金流基于代理推断数据 ${item.timestamp}`;
  if (item.status === "cached") return `资金流基于最后成功数据 ${item.timestamp}`;
  return `资金流基于缓存快照`;
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
    timestamp: "最新快照"
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

function normalizeOptions(payload = [], source = {}) {
  const items = Array.isArray(payload)
    ? payload
    : [
        ...(payload?.callCandidates || []),
        ...(payload?.putCandidates || []),
        ...(payload?.watchOnly || []),
        ...(payload?.avoidChasing || [])
      ].length
        ? [
            ...(payload?.callCandidates || []),
            ...(payload?.putCandidates || []),
            ...(payload?.watchOnly || []),
            ...(payload?.avoidChasing || [])
          ]
        : (payload?.cards || []);
  if (!items?.length) {
    return [{
      symbol: "期权信号观察",
      sector: "期权信号系统",
      score: null,
      conviction: "WAIT_CONFIRMATION",
      direction: "WAIT_CONFIRMATION",
      summary: "当前使用缓存快照维持观察，不生成强方向信号。",
      risk: "等待实时源恢复前，仅作辅助参考。",
      dataQuality: source.dataQuality || "snapshot",
      isTradable: false
    }];
  }
  return (items || []).map((item) => {
    const rawState = item.conviction || item.direction || item.type || "WATCHLIST";
    const downgraded = rawState === "CALL CANDIDATE"
      ? "CALL CANDIDATE"
      : rawState === "PUT CANDIDATE"
        ? "PUT CANDIDATE"
        : rawState === "AVOID CHASING"
          ? "AVOID CHASING"
          : rawState === "WATCH ONLY"
            ? "WATCH ONLY"
            : rawState === "HIGH CONVICTION"
      ? "MOMENTUM"
      : rawState;
    return {
      ...item,
      conviction: downgraded,
      direction: downgraded,
      dataQuality: source.dataQuality || "proxy",
      isTradable: Boolean(source.isTradable),
      summary: `${item.summary || "基于免费数据生成方向信号。"}（免费代理，不是真实 sweep）`,
      risk: item.risk || "风险：期权信号只作辅助，需等待开盘量价确认。"
    };
  }).slice(0, 6);
}

function normalizePremarketMomentum(items = [], source = {}) {
  return (items || [])
    .filter((item) => item?.symbol || item?.ticker)
    .map((item) => ({
      symbol: item.symbol || item.ticker,
      ticker: item.ticker || item.symbol,
      sector: item.sector || symbolMeta[item.symbol || item.ticker]?.[1] || "其他",
      theme: item.theme || "Momentum",
      premarketPercent: Number(item.premarketPercent ?? item.preMarketChange ?? item.change ?? 0),
      relativeVolume: Number(item.relativeVolume || 1),
      catalyst: item.catalyst || "等待新闻催化或量能确认。",
      momentumScore: clamp(Math.round(item.momentumScore ?? item.score ?? 0)),
      dataQuality: normalizeDataQuality(item.dataQuality || source.status || source.dataQuality),
      source: source.label || "Premarket Momentum Engine"
    }))
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 10);
}

function normalizeMovers(items = [], quoteMap, quotes = []) {
  const sourceItems = Array.isArray(items) && items.length
    ? items
    : deriveMoversFromQuotes(quotes?.length ? quotes : fallback.marketData.quotes);
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
        logic: item.logic || "TradingView 趋势强度与多源盘前动量共振。",
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
    return {
      highConfidenceOpportunities: [emptyOpportunityCard()],
      watchlistOnly: []
    };
  }
  const preferred = usableQuotes.filter((item) => ["SPY", "QQQ", "NVDA", "AMD", "AVGO", "PLTR", "TSLA", "COIN", "MSTR", "MRVL", "MSFT", "META", "CRWD"].includes(item.symbol));
  const candidates = preferred.length ? preferred : usableQuotes;
  const scored = candidates
    .map((stock) => calculatePremarketOpportunityScore(stock, context))
    .sort((a, b) => b.score - a.score);
  const highConfidenceOpportunities = scored.filter(isHighConfidenceOpportunity).slice(0, 8);
  const watchlistOnly = scored.filter((item) => !isHighConfidenceOpportunity(item) && isWatchlistOpportunity(item)).slice(0, 8);
  return {
    highConfidenceOpportunities: highConfidenceOpportunities.length ? highConfidenceOpportunities : [emptyOpportunityCard()],
    watchlistOnly
  };
}

function emptyOpportunityCard() {
  return {
      symbol: "暂无高置信度机会",
      name: "等待盘前确认",
      sector: "等待盘前确认",
      score: null,
      confidence: "等待确认",
      dataBasis: "当前指数数据可用性不足",
      dataQuality: "unavailable",
      isTradable: false,
      signal: "WAIT_CONFIRMATION",
      openingConfirmation: "EARLY ONLY",
      vwapBias: "VWAP WATCH",
      relativeVolume: null,
      riskTags: ["等待盘前确认"],
      logic: "当前指数数据可用，但个股 RVOL / 盘前异动不足，等待盘前量能确认。"
  };
}

function isHighConfidenceOpportunity(item) {
  if (!item?.isTradable) return false;
  if (!["live", "delayed"].includes(normalizeDataQuality(item.dataQuality))) return false;
  return item.hasRealRelativeVolume || Math.abs(Number(item.premarketChange || 0)) >= 0.5 || Math.abs(Number(item.regularChange || 0)) >= 0.8;
}

function isWatchlistOpportunity(item) {
  if (!item?.isTradable) return false;
  if (!["live", "delayed"].includes(normalizeDataQuality(item.dataQuality))) return false;
  return Math.abs(Number(item.premarketChange || item.regularChange || 0)) >= 1;
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
    hasRealRelativeVolume,
    premarketChange: gap,
    regularChange,
    mentionCount,
    retailHeat,
    sectorMomentumScore,
    riskTags,
    logic: opportunityLogic(stock, signal, sectorMomentumScore, relativeVolume, catalyst)
  };
}

function mergeWatchlistIntoStars(stars = [], watchlistOnly = []) {
  const watchStars = (watchlistOnly || []).filter((item) => item?.symbol && !item.symbol.includes("暂无")).map((item) => ({
    symbol: item.symbol,
    name: item.name || item.symbol,
    sector: item.sector || "观察名单",
    heat: Number(item.score || 55),
    logic: `${displayTradeState(item.signal)}：${item.logic || "等待盘前确认。"}`,
    persistence: "观察名单：需真实量能确认"
  }));
  const seen = new Set();
  return [...watchStars, ...(stars || [])].filter((item) => {
    if (!item?.symbol || seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    return true;
  }).slice(0, 8);
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
      title: "最近有效数据模式",
      body: "盘前量能尚未确认，暂不生成强方向交易计划。",
      focus: ["使用最近一次有效结构观察"],
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

function deriveStrategyFlows(momentum = [], stars = [], breadth = {}) {
  const grouped = new Map();
  for (const item of momentum || []) {
    if (!item?.sector) continue;
    if (!grouped.has(item.sector)) grouped.set(item.sector, []);
    grouped.get(item.sector).push(item);
  }
  const momentumFlows = [...grouped.entries()].map(([sector, items]) => ({
    sector,
    score: clamp(Math.round(avg(items.map((item) => item.momentumScore || 0)))),
    change: avg(items.map((item) => item.premarketPercent || 0)),
    summary: `${items.slice(0, 3).map((item) => item.symbol).join(" / ")} 盘前动能领先。`,
    dataQuality: "delayed",
    isTradable: true
  })).sort((a, b) => b.score - a.score);
  if (momentumFlows.length) return momentumFlows.slice(0, 6);

  const breadthSectors = (breadth.strongestSectors || []).map((sector, index) => ({
    sector: typeof sector === "string" ? sector : sector.sector || sector.name,
    score: Number(sector.score || 75 - index * 4),
    change: Number(sector.change || 0),
    summary: "来自市场宽度引擎的板块强弱判断。",
    dataQuality: "delayed",
    isTradable: true
  })).filter((item) => item.sector);
  if (breadthSectors.length) return breadthSectors.slice(0, 6);

  return (stars || []).slice(0, 6).map((item) => ({
    sector: item.sector || "动量股",
    score: Number(item.score || 60),
    change: Number(item.change || 0),
    summary: `${item.symbol} TradingView 动量领先。`,
    dataQuality: item.dataQuality || "delayed",
    isTradable: true
  }));
}

function buildScannerStatus(opportunities, flows, risk, momentum = []) {
  const rvLeader = [...(momentum || []), ...opportunities].filter((item) => item.symbol && item.symbol !== "--").sort((a, b) => b.relativeVolume - a.relativeVolume)[0];
  const strongest = flows[0];
  const momentumCount = (momentum || []).length || opportunities.filter((item) => item.score >= 65).length;
  const confirmed = opportunities.filter((item) => item.openingConfirmation === "CONFIRMED").length;
  return {
    rvLeader: rvLeader ? `相对成交量龙头 ${rvLeader.symbol} ${Number(rvLeader.relativeVolume) > 0 ? `${rvLeader.relativeVolume.toFixed(2)}x` : "等待确认"}` : "相对成交量龙头 等待盘前确认",
    strongestSector: strongest ? `最强板块 ${strongest.sector}` : "最强板块 等待确认",
    riskAppetite: `风险偏好 ${displayRiskMode(risk.mode)} · 置信度 ${risk.confidence || "低"}`,
    premarketMomentum: `盘前动量 ${momentumCount} 个观察名单`,
    openingBias: confirmed ? `开盘倾向 ${confirmed} 个已确认` : "开盘倾向 仅早盘观察"
  };
}

function marketSummary(indices, risk = {}, breadth = {}, momentum = []) {
  const byId = Object.fromEntries(indices.map((item) => [item.id, item]));
  if (![byId.SPY, byId.QQQ].some((item) => item?.value)) return "结构参考，当前展示最近有效数据。";
  if (![byId.SPY, byId.QQQ].some((item) => item?.isTradable)) return "当前基于代理推断与延迟数据生成，方向置信度较低。";
  const leader = momentum[0]?.symbol;
  const breadthScore = Number(breadth.breadthScore || 0);
  const breadthPhrase = breadthScore ? `市场宽度 ${breadthScore}` : "市场宽度待确认";
  const techLead = (byId.QQQ?.change || 0) > (byId.SPY?.change || 0);
  const ratesPressure = (byId.TNX?.change || 0) > 0.5;
  const volRelief = (byId.VIX?.change || 0) < 0;
  if (techLead && volRelief && !ratesPressure) return `QQQ 强于 SPY 且 VIX 回落，${breadthPhrase}${leader ? `，动能龙头 ${leader}` : ""}。`;
  if (techLead && ratesPressure) return `科技强于大盘，但美债收益率上行限制追高空间，${breadthPhrase}。`;
  if (!volRelief) return `VIX 未有效回落，${displayRiskMode(risk.mode)} 下优先观察开盘承接。`;
  return `SPY ${signed(byId.SPY?.change || 0)}，QQQ ${signed(byId.QQQ?.change || 0)}，风险偏好 ${displayRiskMode(risk.mode)}。`;
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

function calculateRiskRegime(indices, sentiment, retail, context = {}) {
  const byId = Object.fromEntries(indices.map((item) => [item.id, item]));
  const core = [byId.SPY, byId.QQQ, byId.VIX];
  const usableCore = core.filter((item) => item && Number.isFinite(Number(item.value)) && Number(item.value) > 0);
  const nonTradableCore = core.filter((item) => !item?.isTradable).length;
  if (!usableCore.length) {
    return {
      score: null,
      mode: "结构参考",
      confidence: "低",
      dataQuality: "unavailable",
      tradable: false,
      reason: "核心指数正在同步。",
      conclusion: "结构参考，当前展示最近有效数据。",
      inputs: [["SPY", "同步中"], ["QQQ", "同步中"], ["VIX", "同步中"], ["可信度", "低"]]
    };
  }
  const fearGreed = sentiment.find((item) => item.id === "Fear & Greed")?.value || 50;
  const qqq = byId.QQQ?.change || byId.NDX?.change || 0;
  const vix = byId.VIX?.change || 0;
  const dxy = byId.DXY?.change || 0;
  const tnx = byId.TNX?.change || 0;
  const spy = byId.SPY?.change || 0;
  const breadthScore = Number(context.breadth?.breadthScore || 50);
  const breadthBoost = Number.isFinite(breadthScore) ? (breadthScore - 50) * 0.16 : 0;
  const momentumLeaders = (context.momentum || []).filter((item) => Number(item.momentumScore || 0) >= 65).slice(0, 3).map((item) => item.symbol);
  const strongestSector = (context.breadth?.strongestSectors || [])[0]?.sector || (context.breadth?.strongestSectors || [])[0] || context.momentum?.[0]?.sector || "科技";
  if (qqq > 0 && vix < 0 && dxy <= 0.15 && Math.abs(tnx) < 1.2) {
    return {
      score: 72,
      mode: "Risk-On",
      confidence: riskConfidence(nonTradableCore, core),
      dataQuality: nonTradableCore === 0 ? "live" : "proxy",
      tradable: true,
      reason: `SPY ${signed(spy)}，QQQ ${signed(qqq)}，VIX ${signed(vix)}，${strongestSector} 领先。`,
      conclusion: `科技风险偏好增强，${strongestSector}继续主导市场${momentumLeaders.length ? `，动能龙头 ${momentumLeaders.join(" / ")}` : ""}，谨慎追高，回踩优先。`,
      inputs: [["SPY", signed(spy)], ["QQQ", signed(qqq)], ["VIX", signed(vix)], ["宽度", Math.round(breadthScore)]]
    };
  }
  if (vix > 0 && dxy > 0 && tnx > 0 && qqq < 0) {
    return {
      score: 34,
      mode: "Risk-Off",
      confidence: riskConfidence(nonTradableCore, core),
      dataQuality: nonTradableCore === 0 ? "live" : "proxy",
      tradable: true,
      reason: `SPY ${signed(spy)}，QQQ ${signed(qqq)}，VIX ${signed(vix)}，DXY 与 TNX 同步施压。`,
      conclusion: "风险规避升温，降低高 beta 暴露，等待 VIX 回落与纳指转强。",
      inputs: [["SPY", signed(spy)], ["QQQ", signed(qqq)], ["VIX", signed(vix)], ["TNX", signed(tnx)]]
    };
  }
  let score = 50;

  score += spy * 5.5;
  score += (byId.QQQ?.change || 0) * 7.5;
  score += (byId.NDX?.change || 0) * 8.5;
  score -= (byId.VIX?.change || 0) * 3.2;
  score -= Math.max(0, byId.TNX?.change || 0) * 2.4;
  score -= Math.max(0, byId.DXY?.change || 0) * 1.3;
  score += (fearGreed - 50) * 0.3;
  score += ((retail.score || 50) - 50) * 0.15;
  score += breadthBoost;
  score += Math.min(momentumLeaders.length, 3) * 2.5;

  const bounded = clamp(Math.round(score));
  return {
    score: bounded,
    mode: bounded >= 56 ? "Risk-On" : bounded <= 44 ? "Risk-Off" : "Neutral",
    confidence: riskConfidence(nonTradableCore, core),
    dataQuality: nonTradableCore === 0 ? "delayed" : "proxy",
    tradable: true,
    reason: `SPY ${signed(spy)}，QQQ ${signed(qqq)}，VIX ${signed(vix)}，市场宽度 ${Math.round(breadthScore)}。`,
    conclusion:
      bounded >= 56
        ? `${strongestSector}与纳指动能支撑风险偏好，盘前处于进攻区。`
        : bounded <= 44
          ? "波动率与利率压力抬升，市场进入防御交易。"
          : `风险信号分化，${momentumLeaders.length ? `关注 ${momentumLeaders.join(" / ")} 开盘确认。` : "等待开盘后资金方向确认。"}`,
    inputs: [
      ["SPY", signed(spy)],
      ["QQQ", signed(qqq)],
      ["VIX", signed(byId.VIX?.change || 0)],
      ["宽度", Math.round(breadthScore)]
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

function strategyFrom(risk, flows, retail, options, context = {}) {
  if (!risk.tradable) {
    return ["最近有效数据模式，维持观察。", "行情恢复前不生成强方向策略。"];
  }
  const leader = flows[0]?.sector || "科技";
  const topMomentum = (context.momentum || []).slice(0, 3).map((item) => item.symbol).filter(Boolean);
  const breadthScore = Number(context.breadth?.breadthScore || 0);
  const breadthText = breadthScore ? `市场宽度 ${Math.round(breadthScore)}` : "市场宽度待确认";
  const callBias = options.filter((item) => String(item.type).toLowerCase().includes("call")).length;
  if (risk.mode === "Risk-On") {
    return [
      `科技风险偏好增强，${leader}继续主导市场，谨慎追高，回踩优先。`,
      `${breadthText}${topMomentum.length ? `，盘前动能关注 ${topMomentum.join(" / ")}` : ""}。${callBias >= 2 ? "期权代理与热钱方向同向。" : "等待期权代理与开盘量能确认。"}`
    ];
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
    return { title: "最近有效数据模式", reason: "数据恢复后自动更新，当前展示最近一次有效结构。" };
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
  text("#riskScore", dashboard.risk.score === null ? "观察" : dashboard.risk.score);
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
  renderMarketStructurePro(dashboard.marketStructurePro);
  renderMacro(dashboard.macro);
  renderRetail(dashboard.retail, dashboard.moduleStatus.retail);
  renderOptions(dashboard.options);
  renderOpportunities(dashboard.opportunities, dashboard.opportunityWatchlist);
  renderPremarketMomentum(dashboard.premarketMomentum);
  renderTradePlan(dashboard.tradePlan);
  renderMetricGrid("#sentimentGrid", dashboard.sentiment, "sentiment");
  renderMoverTable(dashboard.movers);
  renderFlows(dashboard.flows);
  renderStars(dashboard.stars);
  renderNews(dashboard.news);
  renderCommandDeck(dashboard);
  renderProWorkspaces(dashboard);
  setLoading(false);
}


function renderCommandDeck(dashboard) {
  const risk = dashboard.risk || {};
  const topFlow = (dashboard.flows || [])[0] || {};
  const topOpportunity = (dashboard.opportunities || []).find((item) => item?.symbol && !String(item.symbol).includes("--")) || {};
  const topMover = (dashboard.movers || [])[0] || {};
  const byId = Object.fromEntries((dashboard.indices || []).map((item) => [item.id, item]));
  const vixChange = Number(byId.VIX?.change || 0);
  const tnxChange = Number(byId.TNX?.change || 0);
  const dxyChange = Number(byId.DXY?.change || 0);
  const riskAlert = risk.mode === "Risk-Off" || vixChange > 3 || tnxChange > 1 || dxyChange > 0.4;
  const tradeDecision = dashboard.tradeDecision || {};
  const action = tradeDecision.actionBias || (risk.mode === "Risk-On"
    ? "CALL 优先"
    : risk.mode === "Risk-Off"
      ? "降风险"
      : "等待确认");
  text("#deckRiskMode", displayRiskModeHero(risk.mode));
  text("#deckRiskScore", risk.score === null || risk.score === undefined ? `置信度 ${risk.confidence || "低"}` : `Score ${risk.score} · 置信度 ${risk.confidence || "中"}`);
  text("#deckMainTheme", topFlow.sector || "等待确认");
  text("#deckThemeScore", topFlow.score ? `Heat ${topFlow.score} · ${signed(topFlow.change || 0)}` : "Heat --");
  text("#deckTopOpportunity", topOpportunity.symbol ? `${topOpportunity.symbol} ${topOpportunity.score ?? "观察"}` : (topMover.symbol ? `${topMover.symbol} ${signed(topMover.change)}` : "--"));
  text("#deckOpportunitySignal", topOpportunity.signal ? displayTradeState(topOpportunity.signal) : (topMover.reason || "等待量价"));
  text("#deckRiskAlert", riskAlert ? "风险升温" : "风险可控");
  text("#deckRiskDetail", `VIX ${signed(vixChange)} · 10Y ${signed(tnxChange)} · DXY ${signed(dxyChange)}`);
  text("#deckActionBias", action);
  text("#deckActionDetail", tradeDecision.title ? `${tradeDecision.title} · ${tradeDecision.permission || "等待确认"}` : (dashboard.strategy || "等待开盘确认"));
  const deck = document.querySelector(".command-deck");
  if (deck) {
    deck.dataset.alert = riskAlert ? "on" : "off";
    deck.dataset.mode = riskDatasetValue(risk.mode);
  }
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
    momentum: ["#momentumModuleMeta"],
    marketStructure: ["#marketStructureModuleMeta"],
    tradePlan: ["#tradePlanModuleMeta"],
    news: ["#newsModuleMeta"],
    macro: ["#macroModuleMeta"],
    retail: ["#retailModuleMeta"],
    options: ["#optionsModuleMeta"],
    source: ["#sourceModuleMeta"]
  };

  for (const [key, selectors] of Object.entries(mapping)) {
    const item = statusMap[key] || { status: "fallback", timestamp: "最新快照" };
    selectors.forEach((selector) => {
      const node = document.querySelector(selector);
      if (!node) return;
      node.classList.toggle("module-live", item.status === "live");
      node.classList.toggle("module-delayed", item.status === "delayed");
      node.classList.toggle("module-proxy", item.status === "proxy");
      node.classList.toggle("module-cached", item.status === "cached");
      node.classList.toggle("module-fallback", item.status === "fallback" || item.status === "snapshot");
      node.classList.toggle("module-unavailable", item.status === "unavailable");
      node.textContent = formatModuleMeta(item, key);
      node.title = `${statusLabel(item.status, key)} · ${item.timestamp || "最近快照"}`;
    });
  }
}

function formatModuleMeta(item = {}, key = "") {
  const status = normalizeDataQuality(item.status);
  const label = statusLabel(status, key).replace(/（.*?）/g, "");
  const time = item.timestamp && item.timestamp !== "--" ? item.timestamp : "最近快照";
  if (item.activeSource === "lastKnownGood") {
    return `最近有效 · ${(item.cacheAdapter || "cache").toString().toUpperCase()}`;
  }
  if (status === "live") return `LIVE · ${time}`;
  if (status === "delayed") return `FRESH · ${time}`;
  if (status === "cached") return `CACHE · ${time}`;
  if (status === "proxy") return `PROXY · ${time}`;
  if (status === "unavailable") return `结构参考 · 等待恢复`;
  return `${label} · ${time}`;
}

function statusLabel(status, key = "") {
  if (key === "options" && status === "live") return "实时期权流（LIVE）";
  if (status === "live") return "实时数据（LIVE）";
  if (status === "delayed") return "最新快照（FRESH）";
  if (status === "proxy") return "代理推断（PROXY）";
  if (status === "cached") return "缓存快照（CACHED）";
  if (status === "stale") return "延迟数据（STALE）";
  if (status === "unavailable") return "结构参考（ERROR）";
  return "最新快照（SNAPSHOT）";
}

function displayRiskMode(mode) {
  if (mode === "结构参考") return "结构参考";
  if (mode === "Risk-On") return "风险偏好开启（Risk-On）";
  if (mode === "Risk-Off") return "风险规避（Risk-Off）";
  if (mode === "Neutral") return "中性（Neutral）";
  if (mode === "Chop") return "震荡（Chop）";
  return mode || "结构参考";
}

function displayRiskModeHero(mode) {
  if (mode === "结构参考") return "结构参考";
  if (mode === "Risk-On") return "风险偏好";
  if (mode === "Risk-Off") return "风险规避";
  if (mode === "Neutral") return "中性";
  if (mode === "Chop") return "震荡";
  return mode || "结构参考";
}

function displayNewsBias(bias) {
  if (bias === "BULLISH" || bias === "利好") return "利好（Bullish）";
  if (bias === "BEARISH" || bias === "利空") return "利空（Bearish）";
  return "中性（Neutral）";
}

function displayTradeState(value = "") {
  if (value === ["DATA", "INSUFFICIENT"].join(" ")) return "等待盘前确认";
  const map = {
    WATCHLIST: "观察名单（Watchlist）",
    "WATCHLIST ONLY": "观察名单（Watchlist）",
    "HIGH MOMENTUM LONG": "强势做多（High Momentum Long）",
    "OPENING BREAKOUT WATCH": "开盘突破观察（Opening Breakout Watch）",
    "HIGH MOMENTUM WATCH": "高动量观察（High Momentum Watch）",
    "PUT / HEDGE WATCH": "对冲观察（Put / Hedge Watch）",
    "CALL CANDIDATE": "CALL 候选",
    "PUT CANDIDATE": "PUT 候选",
    "WATCH ONLY": "仅观察（Watch Only）",
    "AVOID CHASING": "避免追高",
    "LOW QUALITY": "低质量机会（Low Quality）",
    "LOW QUALITY / IGNORE": "低质量机会（Low Quality）",
    WAIT_CONFIRMATION: "等待盘前确认",
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

const sourceDomains = [
  {
    id: "market",
    title: "行情与价格",
    subtitle: "Index / Quote / Screener",
    keys: ["marketData", "tradingView", "twelveData", "alphavantage", "finnhub"]
  },
  {
    id: "structure",
    title: "市场结构",
    subtitle: "Breadth / Rates / Macro",
    keys: ["marketBreadth", "marketStructurePro", "yieldCurve", "oilLayer", "fedWatch", "breadthPro", "fred", "finviz"]
  },
  {
    id: "flow",
    title: "动量与资金流",
    subtitle: "Premarket / RVOL / Options",
    keys: ["premarketMomentum", "relativeVolume", "unusualWhales", "benzinga", "newsAggregator"]
  },
  {
    id: "decision",
    title: "决策与事件",
    subtitle: "Decision / Event / Sentiment",
    keys: ["decisionEngine", "tradeDecision", "earnings", "insider", "reddit", "xMacro", "finnhubInsider", "finnhubEarnings"]
  }
];

function renderSources(items) {
  const normalized = (items || []).filter(Boolean);
  const groupedKeys = new Set(sourceDomains.flatMap((group) => group.keys));
  const groups = [
    ...sourceDomains.map((group) => ({
      ...group,
      items: group.keys.map((key) => normalized.find((item) => item.key === key)).filter(Boolean)
    })).filter((group) => group.items.length),
    {
      id: "other",
      title: "其他接口",
      subtitle: "Auxiliary Sources",
      items: normalized.filter((item) => !groupedKeys.has(item.key))
    }
  ].filter((group) => group.items.length);

  html("#sourceGrid", `
    ${renderSourceGovernance(normalized)}
    <div class="source-domain-grid">
      ${groups.map(renderSourceDomain).join("")}
    </div>
  `);
}

function renderSourceGovernance(items) {
  const total = items.length || 1;
  const liveCount = items.filter((item) => item.status === "live").length;
  const usableCount = items.filter((item) => ["live", "delayed", "proxy", "cached"].includes(item.status)).length;
  const fallbackCount = items.filter((item) => item.fallback || ["snapshot", "cached", "proxy"].includes(item.status)).length;
  const scoringCount = items.filter((item) => sourceScoringLabel(item) !== "NO").length;
  const latest = items.map((item) => Number(item.updatedAt || item.fetchedAt || item.publishedAt || 0)).filter(Boolean);
  const latestAt = latest.length ? Math.max(...latest) : null;
  const healthScore = Math.round((usableCount / total) * 62 + (liveCount / total) * 24 + (scoringCount / total) * 14);
  const grade = healthScore >= 80 ? "Institutional" : healthScore >= 58 ? "Operational" : "Degraded";
  return `
    <article class="source-governance-card">
      <div>
        <span class="source-kicker">DATA GOVERNANCE</span>
        <h3>${grade}</h3>
        <p>覆盖 ${total} 个数据节点，${usableCount} 个可用于盘前/盘中推理，${scoringCount} 个进入核心评分链路。</p>
      </div>
      <div class="source-governance-metrics">
        ${sourceMetric("Health", `${healthScore}`, "/100")}
        ${sourceMetric("Live", `${liveCount}`, `/${total}`)}
        ${sourceMetric("Fallback", `${fallbackCount}`, "routes")}
        ${sourceMetric("Latest", latestAt ? formatClock(latestAt) : "--", "CST")}
      </div>
    </article>
  `;
}

function sourceMetric(label, value, unit) {
  return `
    <div class="source-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(unit)}</em>
    </div>
  `;
}

function renderSourceDomain(group) {
  const status = dominantSourceStatus(group.items);
  return `
    <section class="source-domain source-domain-${escapeHtml(group.id)}">
      <header class="source-domain-header">
        <div>
          <span>${escapeHtml(group.subtitle)}</span>
          <h3>${escapeHtml(group.title)}</h3>
        </div>
        <b class="source-state ${status}">${statusLabel(status, group.id)}</b>
      </header>
      <div class="source-table">
        ${group.items.map(renderSourceRow).join("")}
      </div>
    </section>
  `;
}

function renderSourceRow(item) {
  return `
    <article class="source-card quality-${escapeHtml(item.dataQuality || item.status)}">
      <div class="source-card-main">
        <span class="source-state ${escapeHtml(item.status)}">${statusLabel(item.status, item.key)}</span>
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.source || item.label)}</p>
        </div>
      </div>
      <dl class="source-audit-grid">
        <div><dt>发布</dt><dd>${escapeHtml(sourcePublishedLabel(item))}</dd></div>
        <div><dt>抓取</dt><dd>${escapeHtml(sourceFetchedLabel(item))}</dd></div>
        <div><dt>延迟</dt><dd>${escapeHtml(sourceLatencyLabel(item.latency))}</dd></div>
        <div><dt>新鲜度</dt><dd>${escapeHtml(item.freshness || sourceAgeLabel(item.updatedAt))}</dd></div>
        <div><dt>置信度</dt><dd>${escapeHtml(item.confidence || confidenceLabelByStatus(item.status))}</dd></div>
        <div><dt>评分</dt><dd>${escapeHtml(sourceScoringLabel(item))}</dd></div>
      </dl>
      ${renderSourceRoute(item)}
    </article>
  `;
}

function renderSourceRoute(item) {
  const route = [
    item.primarySource ? `Primary: ${item.primarySource}` : "",
    ...(item.backupSources || []).slice(0, 3).map((source) => `Backup: ${source}`),
    item.fallback ? "Fallback: ON" : "Fallback: OFF"
  ].filter(Boolean);
  const diagnostics = [
    renderActiveMarketDebug(item.debugActiveMarketData),
    renderIndexDebug(item.indexDebug)
  ].filter(Boolean).join("");
  if (!route.length && !diagnostics) return "";
  return `
    <div class="source-route">
      ${route.length ? `<span>${route.map(escapeHtml).join(" · ")}</span>` : ""}
      ${diagnostics ? `<small>${diagnostics}</small>` : ""}
    </div>
  `;
}

function dominantSourceStatus(items = []) {
  const order = ["live", "delayed", "proxy", "cached", "snapshot", "unavailable"];
  return order.find((status) => items.some((item) => item.status === status)) || "snapshot";
}

function renderActiveMarketDebug(debug = null) {
  if (!debug) return "";
  return `持久缓存：${escapeHtml(String(debug.cacheAdapter || "memory").toUpperCase())} · 当前使用：${escapeHtml(debug.selectedSource === "lastKnownGood" ? "最近有效数据" : debug.selectedSource === "current" ? "最新数据" : "结构参考")} · 指数 ${debug.liveDelayedIndicesCount}/${debug.indicesCount} · 个股 ${debug.liveDelayedQuotesCount}/${debug.quotesCount}`;
}

function renderIndexDebug(indexDebug = []) {
  if (!indexDebug?.length) return "";
  return `Index Route：${indexDebug.map((item) => {
    const failed = (item.failedSources || []).map((fail) => `${fail.source}:${fail.providerSymbol}`).slice(0, 3).join(" / ");
    return `${item.id}=${item.successfulSource}(${item.providerSymbol})${failed ? ` fail:${failed}` : ""}`;
  }).join("；")}`;
}

function sourcePublishedLabel(item) {
  return item.publishedAt ? formatDateTime(item.publishedAt) : item.updatedAt ? formatDateTime(item.updatedAt) : "最近有效快照";
}

function sourceFetchedLabel(item) {
  return item.fetchedAt ? formatDateTime(item.fetchedAt) : item.updatedAt ? formatDateTime(item.updatedAt) : "数据恢复后自动更新";
}

function sourceLatencyLabel(latency) {
  if (!Number.isFinite(Number(latency))) return "stale";
  return `${Math.max(0, Math.round(Number(latency)))}ms`;
}

function sourceUpdatedLabel(item) {
  if (item.updatedAt) return formatDateTime(item.updatedAt);
  if (item.dataQuality === "snapshot") return "最新快照";
  return item.timestamp || "最近有效快照";
}

function sourceAgeLabel(updatedAt) {
  if (!updatedAt) return "age pending";
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
    marketData: "核心行情聚合：Multi-source Market Data / Finnhub primary。",
    tradingView: "趋势筛选与强势股池。",
    finnhubInsider: "机构行为层：内部人交易线索。",
    finnhubEarnings: "财报驱动层：财报日历与预期偏差。",
    xMacro: "宏观快讯，不参与个股新闻。",
    reddit: "散户情绪，只读取 WSB。",
    finviz: "热钱板块：Finviz 适配器。",
    unusualWhales: "期权信号系统：CALL / PUT / WATCH / AVOID 免费代理方向。",
    benzinga: "异动新闻：Benzinga 适配器。"
  }[key];
}

// Gauge config: [min, max, zones: [[upTo, color, label]...]]
const GAUGE_CFG = {
  "Fear & Greed": { min:0,  max:100, zones:[[25,"#ff3d57","极度恐慌"],[45,"#d4ab4e","恐慌"],[55,"#7a8194","中性"],[75,"#40d4e8","偏乐观"],[100,"#1adb7e","极度贪婪"]] },
  "RSI":          { min:0,  max:100, zones:[[30,"#ff3d57","超卖"],[50,"#d4ab4e","弱势"],[70,"#7a8194","中性"],[80,"#40d4e8","偏强"],[100,"#ff3d57","超买"]] },
  "Put/Call":     { min:0,  max:2.0, zones:[[0.6,"#1adb7e","看多"],[0.9,"#40d4e8","偏多"],[1.1,"#7a8194","中性"],[1.4,"#d4ab4e","偏空"],[2.0,"#ff3d57","极度恐慌"]] },
};

function makeMiniGauge(id, value, min, max) {
  const cfg = GAUGE_CFG[id];
  if (!cfg) return "";
  const pct = Math.max(0, Math.min(100, ((Number(value) - cfg.min) / (cfg.max - cfg.min)) * 100));
  // Find zone color and label
  let zoneColor = "#7a8194", zoneLabel = "";
  for (const [upTo, color, label] of cfg.zones) {
    const upToPct = ((upTo - cfg.min) / (cfg.max - cfg.min)) * 100;
    if (pct <= upToPct) { zoneColor = color; zoneLabel = label; break; }
  }
  return `<div class="mg-wrap">
    <div class="mg-bar-track">
      <div class="mg-bar-fill" style="width:${pct.toFixed(1)}%;background:${zoneColor}"></div>
      <div class="mg-needle" style="left:${pct.toFixed(1)}%"></div>
    </div>
    <div class="mg-labels">
      <span style="color:#4a5068">${escapeHtml(String(cfg.min))}</span>
      <span class="mg-zone" style="color:${zoneColor}">${escapeHtml(zoneLabel)}</span>
      <span style="color:#4a5068">${escapeHtml(String(cfg.max))}</span>
    </div>
  </div>`;
}

function renderMetricGrid(selector, items, type = "index") {
  html(selector, items.map((item) => {
    const inverse = ["VIX", "TNX", "GOLD", "DXY", "Put/Call"].includes(item.id);
    const gauge = type === "sentiment" ? makeMiniGauge(item.id, item.value, 0, 100) : "";
    return `
      <article class="metric-card quality-${escapeHtml(item.dataQuality || "snapshot")}">
        <div class="metric-head"><span>${escapeHtml(displayMetricId(item.id))}</span><span>${escapeHtml(displayMetricName(item.name || ""))}</span></div>
        <div class="metric-value">${formatNumber(item.value)}</div>
        <div class="metric-change ${changeClass(item.change, inverse)}">${type === "sentiment" && item.id !== "Put/Call" ? signedRaw(item.change) : signed(item.change)}</div>
        ${gauge}
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


function shortSectorName(name = "") {
  const map = {
    "通信服务": "通信",
    "可选消费": "消费",
    "必选消费": "必消",
    "公用事业": "公用",
    "房地产": "地产",
    "Technology": "科技",
    "Communication Services": "通信",
    "Consumer Discretionary": "消费",
    "Consumer Staples": "必消",
    "Utilities": "公用",
    "Real Estate": "地产",
    "Healthcare": "医疗",
    "Financials": "金融",
    "Energy": "能源",
    "Industrials": "工业",
    "Materials": "材料"
  };
  return map[name] || name || "";
}

function renderMarketStructurePro(rawData = {}) {
  const data = rawData?.data && rawData.data.sectorRotation ? rawData.data : rawData;
  const sectorRotation = data.sectorRotation || {};
  const yieldCurve = data.yieldCurve || data.yield || {};
  const oil = data.oil || data.oilLayer || {};
  const fedWatch = data.fedWatch || {};
  const breadthPro = data.breadthPro || data.breadth || {};
  const topSector = (sectorRotation.strongestSectors || sectorRotation.leaders || sectorRotation.rows || [])[0];
  const weakSector = (sectorRotation.weakestSectors || []).find(Boolean) || [...(sectorRotation.rows || [])].sort((a, b) => Number(a.score || 0) - Number(b.score || 0))[0];
  const oilRows = Array.isArray(oil.rows) ? oil.rows : [];
  const sectorScore = Number(sectorRotation.rotationScore ?? topSector?.score ?? 50);
  const yieldScore = Number.isFinite(Number(yieldCurve.dgs10)) ? (yieldCurve.confidence === "HIGH" ? 88 : yieldCurve.confidence === "MEDIUM" ? 68 : 58) : 45;
  const oilScore = Number.isFinite(Number(oil.avgChange)) ? Math.round(50 + Math.min(25, Math.abs(Number(oil.avgChange)) * 7)) : 45;
  const fedScore = Number.isFinite(Number(fedWatch.nearCutProbability)) ? Number(fedWatch.nearCutProbability) : 45;
  const breadthScore = Number.isFinite(Number(breadthPro.breadthScore)) ? Number(breadthPro.breadthScore) : 45;

  const sectorValue = topSector
    ? `${topSector.symbol || "板块"} ${shortSectorName(topSector.sector || topSector.name || "")}`.trim()
    : "板块分化";
  const yieldValue = Number.isFinite(Number(yieldCurve.dgs10))
    ? `10Y ${formatNumber(yieldCurve.dgs10)}%`
    : Number.isFinite(Number(yieldCurve.fedFunds))
      ? `Fed ${formatNumber(yieldCurve.fedFunds)}%`
      : "利率参考";
  const oilValue = oilRows.length
    ? `${oilRows[0]?.symbol === "CL=F" ? "WTI" : (oilRows[0]?.name || oilRows[0]?.symbol || "原油")} ${formatNumber(oilRows[0]?.price)}`
    : "原油参考";
  const fedValue = Number.isFinite(Number(fedWatch.nearCutProbability))
    ? `${Math.round(Number(fedWatch.nearCutProbability))}%`
    : "代理观察";
  const breadthValue = Number.isFinite(Number(breadthPro.breadthScore))
    ? `${Math.round(Number(breadthPro.breadthScore))}`
    : "代理观察";

  const htmlParts = [
    structureCard("板块轮动", sectorValue, sectorRotation.explanation || "板块 ETF 已接入，当前以可用数据与代理快照判断轮动。", [
      `最强：${topSector?.symbol || "--"}${topSector?.sector ? ` ${topSector.sector}` : ""}`,
      `最弱：${weakSector?.symbol || "--"}${weakSector?.sector ? ` ${weakSector.sector}` : ""}`,
      `状态：${displayStructureState(sectorRotation.rotationType)}`,
      dataQualityTag(sectorRotation)
    ], sectorScore, "sector"),
    structureCard("收益率曲线", yieldValue, yieldCurve.explanation || "显示可用的 2Y / 10Y / 30Y 与 Fed Funds 数据；缺失项以结构参考处理。", [
      `2Y ${formatNullablePercent(yieldCurve.dgs2)}`,
      `10Y ${formatNullablePercent(yieldCurve.dgs10)}`,
      `30Y ${formatNullablePercent(yieldCurve.dgs30)}`,
      `Fed ${formatNullablePercent(yieldCurve.fedFunds)}`,
      `2Y-10Y ${formatNullablePercent(yieldCurve.twoTen)}`,
      dataQualityTag(yieldCurve)
    ], yieldScore, "yield"),
    structureCard("原油 / 通胀", oilValue, oil.explanation || "WTI / Brent 用于观察通胀压力与能源板块催化。", [
      ...oilRows.slice(0, 2).map((row) => `${row.name || row.symbol} ${formatNumber(row.price)} ${signed(row.changePercent)}`),
      `状态：${displayStructureState(oil.inflationPressure)}`,
      dataQualityTag(oil)
    ], oilScore, "oil"),
    structureCard("FedWatch", fedValue, fedWatch.explanation || "免费版使用收益率曲线、油价与风险偏好生成降息概率代理。", [
      `近月降息概率 ${formatNullablePercent(fedWatch.nearCutProbability, 0)}`,
      `年内降息 ${fedWatch.yearEndCuts ?? "--"} 次`,
      displayStructureState(fedWatch.impliedPath),
      dataQualityTag(fedWatch)
    ], fedScore, "fed"),
    structureCard("市场宽度", breadthValue, breadthPro.explanation || "免费版用股票池、板块轮动与动量代理全市场宽度。", [
      `>20MA ${formatNullablePercent(breadthPro.percentAbove20, 0)}`,
      `>50MA ${formatNullablePercent(breadthPro.percentAbove50, 0)}`,
      `>200MA ${formatNullablePercent(breadthPro.percentAbove200, 0)}`,
      `参与度 ${formatNullablePercent(breadthPro.participation, 0)}`,
      displayStructureState(breadthPro.health),
      dataQualityTag(breadthPro)
    ], breadthScore, "breadth")
  ];
  html("#marketStructureGrid", htmlParts.join(""));
}

function dataQualityTag(obj = {}) {
  const q = normalizeDataQuality(obj.dataQuality || obj.status || obj.confidence);
  if (q === "live") return "实时";
  if (q === "delayed") return "最新";
  if (q === "cached" || q === "snapshot") return "缓存";
  if (q === "stale") return "最近有效";
  if (q === "proxy") return "代理";
  return obj.confidence ? `置信度 ${obj.confidence}` : "结构参考";
}

function formatNullablePercent(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : "--";
}

function structureCard(title, value, copy, tags = [], score = 50, type = "") {
  const numeric = Number(score);
  const tone = numeric >= 62 ? "hot" : numeric <= 42 ? "risk" : "watch";
  return `<article class="structure-card ${tone} structure-${escapeHtml(type)}">
    <p class="panel-label">${escapeHtml(title)}</p>
    <strong>${escapeHtml(value)}</strong>
    <p>${escapeHtml(copy)}</p>
    <div class="structure-tags">${(tags || []).filter(Boolean).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
  </article>`;
}

function displayStructureState(value) {
  const map = {
    RISK_ON_ROTATION: "风险偏好轮动",
    DEFENSIVE_ROTATION: "防御轮动",
    MIXED_ROTATION: "分化轮动",
    INVERTED_FLATTENING: "倒挂 / 趋平",
    BULL_STEEPENING: "牛陡",
    NORMALIZING_CURVE: "曲线正常化",
    FLAT_CURVE: "曲线平坦",
    HIGHER_INFLATION_PRESSURE: "通胀压力升温",
    LOWER_INFLATION_PRESSURE: "通胀压力缓和",
    NEUTRAL_OIL_PRESSURE: "原油中性",
    DOVISH_REPRICING: "鸽派重定价",
    HIGHER_FOR_LONGER: "高利率更久",
    INSUFFICIENT_YIELD_DATA: "数据不足",
    MODERATE_EASING: "温和降息预期",
    HEALTHY_BREADTH: "宽度健康",
    WEAK_BREADTH: "宽度偏弱",
    MIXED_BREADTH: "宽度分化"
  };
  return map[value] || value || "等待确认";
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


function normalizeRetailSentiment(data = {}, context = {}) {
  const sourceStatus = String(context.source?.status || "").toLowerCase();
  const hasMentions = Array.isArray(data.mentions) && data.mentions.length;
  if (data && data.score !== null && data.score !== undefined && hasMentions) {
    return {
      score: clamp(Number(data.score || 50)),
      tone: data.tone || "中性",
      mentions: data.mentions,
      summary: data.summary || "WSB 提及热度正常。",
      dataQuality: sourceStatus === "live" ? "live" : sourceStatus === "cached" ? "cached" : "proxy"
    };
  }

  const counts = new Map();
  const add = (symbol, weight = 1) => {
    if (!symbol || !symbolMeta[symbol]) return;
    counts.set(symbol, (counts.get(symbol) || 0) + weight);
  };
  for (const item of context.premarketMomentum || []) add(item.symbol, item.momentumScore >= 65 ? 2 : 1);
  for (const item of context.quotes || []) {
    if (Math.abs(Number(item.change || 0)) >= 1.2) add(item.symbol, 1);
  }
  for (const item of context.news || []) add(item.ticker || item.symbol, 1);
  const mentions = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const score = mentions.length ? clamp(48 + Math.min(18, mentions.reduce((sum, [, count]) => sum + count, 0) * 2)) : 50;
  return {
    score,
    tone: score >= 62 ? "偏乐观" : score <= 42 ? "偏谨慎" : "中性",
    mentions: mentions.length ? mentions : [["NVDA", 0], ["AMD", 0], ["PLTR", 0], ["MSFT", 0]],
    summary: "Reddit 实时源暂不可用，当前使用盘前动量、新闻与自选股热度生成散户关注代理。",
    dataQuality: "proxy"
  };
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
        <strong>${escapeHtml(retail.tone || "中性")}</strong>
        <p>${escapeHtml(retail.summary || "散户情绪处于中性区间。")}</p>
        <div class="dial-scale">
          <span>恐慌</span>
          <span>中性</span>
          <span>贪婪</span>
        </div>
      </div>
    </div>
    <div class="mention-grid">
      ${(retail.mentions || []).map(([symbol, count]) => `<span>${escapeHtml(symbol)} <b>${count > 0 ? `${count}次` : "观察"}</b></span>`).join("")}
    </div>
    <p class="retail-note">${retail.dataQuality === "proxy" || ["fallback", "snapshot", "unavailable"].includes(status.status) ? "PROXY：Reddit 实时源不可用时，使用盘前动量、新闻与股票池热度生成关注度代理；不代表买卖信号。" : "数字代表 WallStreetBets 近期帖子中股票代码被提及次数，仅代表散户关注度，不代表买卖信号。"}</p>
  `);
}

function renderOptions(items) {
  html("#optionsFlow", items.map((item) => {
    const score = Number(item.score || 0);
    const state = item.conviction || item.direction || "WATCHLIST";
    const lowerState = String(state).toLowerCase();
    const tier = lowerState.includes("call") || score >= 82
      ? "option-call"
      : lowerState.includes("put") || lowerState.includes("hedge") || lowerState.includes("risky")
        ? "option-put"
        : "option-watch";
    return `
      <article class="option-proxy-card ${tier} quality-${escapeHtml(item.dataQuality || "proxy")}">
        <div class="option-topline">
          <div>
            <strong>${escapeHtml(item.symbol)}</strong>
            <span>${escapeHtml(item.sector || "其他")}</span>
          </div>
          <b>${score ? Math.round(score) : "--"}</b>
        </div>
        <div class="option-state">${escapeHtml(displayTradeState(state))}</div>
        <p>${escapeHtml(item.summary)}</p>
        <div class="option-meta-row">
          <span>${escapeHtml(statusLabel(item.dataQuality || "proxy"))}</span>
          <span>代理推断，不是真实 sweep</span>
        </div>
        <small>${escapeHtml(item.risk || "风险：需等待开盘量价确认。")}</small>
      </article>
    `;
  }).join(""));
}

function renderOpportunities(items = [], watchlist = []) {
  const highItems = (items || []).filter((item) => item?.symbol);
  const watchItems = (watchlist || []).filter((item) => item?.symbol && !String(item.symbol).includes("暂无"));
  const highHasRealCard = highItems.some((item) => !String(item.symbol || "").includes("暂无"));
  const blocks = [];

  blocks.push(`<div class="opportunity-subhead priority-high"><span>高置信机会</span><em>${highHasRealCard ? "可交易优先" : "等待量能确认"}</em></div>`);
  blocks.push(...(highItems.length ? highItems.map((item) => opportunityCardHtml(item, false)) : [opportunityCardHtml(emptyOpportunityCard(), false)]));

  if (watchItems.length) {
    blocks.push(`<div class="opportunity-subhead priority-watch"><span>盘前观察名单</span><em>有方向 · 等确认</em></div>`);
    blocks.push(...watchItems.map((item) => opportunityCardHtml({ ...item, signal: item.signal || "HIGH MOMENTUM WATCH" }, true)));
  } else {
    blocks.push(`<div class="opportunity-subhead priority-watch"><span>盘前观察名单</span><em>暂无触发</em></div>`);
    blocks.push(`<div class="empty-state visual-empty">暂无可用观察名单；等待 live/delayed quote 或涨跌幅触发。</div>`);
  }

  html("#opportunityGrid", blocks.join(""));
}

function opportunityCardHtml(item, isWatchlist = false) {
  const scoreText = item.score === null ? "观察" : item.score;
  return `
    <article class="opportunity-card ${signalClass(item.signal)} ${isWatchlist ? "watchlist-card" : ""} quality-${escapeHtml(item.dataQuality || "snapshot")}">
      <div class="opportunity-score-block">
        <b>${escapeHtml(scoreText)}</b>
        <span>${isWatchlist ? "WATCH" : "SCORE"}</span>
      </div>
      <div class="opportunity-body">
        <div class="opportunity-head">
          <div>
            <strong>${escapeHtml(item.symbol)}</strong>
            <span>${escapeHtml(item.sector)}</span>
          </div>
          <em>${escapeHtml(item.confidence === "低" ? "低置信" : `${item.confidence || "观察"}置信`)}</em>
        </div>
        <div class="signal-pill">${isWatchlist ? "观察名单 · " : ""}${escapeHtml(displayTradeState(item.signal))}</div>
        <p>${escapeHtml(item.logic)}</p>
        <div class="opportunity-meta">
          <span>${escapeHtml(item.dataBasis || "等待盘前确认")}</span>
          <span>${Number(item.relativeVolume) > 0 ? `RVOL ${Number(item.relativeVolume).toFixed(2)}x` : "RVOL 等待确认"}</span>
          <span>${escapeHtml(displayTradeState(item.vwapBias))}</span>
          <span>${escapeHtml(displayTradeState(item.openingConfirmation))}</span>
        </div>
        <div class="risk-tags">
          ${(item.riskTags || []).map((tag) => `<span>${escapeHtml(displayTradeState(tag))}</span>`).join("")}
        </div>
      </div>
    </article>
  `;
}


function renderPremarketMomentum(items) {
  if (!items?.length) {
    html("#momentumGrid", `<div class="empty-state visual-empty">当前显示缓存快照；实时动能源恢复后自动更新。</div>`);
    return;
  }
  html("#momentumGrid", items.map((item, index) => {
    const score = Number(item.momentumScore || 0);
    const tier = score >= 80 ? "momentum-hot" : score >= 65 ? "momentum-watch" : score >= 45 ? "momentum-neutral" : "momentum-cold";
    return `
      <article class="momentum-card ${tier} quality-${escapeHtml(item.dataQuality || "snapshot")}">
        <div class="momentum-rank">#${index + 1}</div>
        <div class="momentum-score">
          <b>${score}</b>
          <span>动能评分</span>
        </div>
        <div class="momentum-main">
          <div class="momentum-title">
            <strong>${escapeHtml(item.symbol)}</strong>
            <em>${escapeHtml(item.sector)} · ${escapeHtml(item.theme)}</em>
          </div>
          <p>${escapeHtml(item.catalyst)}</p>
          <div class="momentum-tags">
            <span class="${item.premarketPercent >= 0 ? "up" : "down"}">盘前 ${signed(item.premarketPercent)}</span>
            <span>RVOL ${Number(item.relativeVolume || 0).toFixed(2)}x</span>
            <span>${escapeHtml(statusLabel(item.dataQuality || "delayed"))}</span>
          </div>
        </div>
      </article>
    `;
  }).join(""));
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
    html("#moverTable", `<div class="empty-state">当前显示缓存快照；异动源恢复后自动更新。</div>`);
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

// Horizon-inspired news scoring & rendering
// Score 0-10 = urgency/market-impact rating
// Dedup: group by ticker to prevent same story 3x
function newsImpactScore(item, index) {
  let score = 10 - index * 0.5; // Base: position matters
  if (item.bias === "BULLISH" || item.bias === "BEARISH") score += 1.5; // Directional = high signal
  if (item.ticker && ["NVDA","AMD","MRVL","AVGO","PLTR","SMCI","TSM"].includes(item.ticker)) score += 1;
  if (item.time && item.time.includes("min")) score += 0.5; // Fresh
  return Math.min(10, Math.round(score * 10) / 10);
}

function newsUrgencyBadge(score, index) {
  if (score >= 9 || index === 0) return `<span class="ni-badge ni-critical">🔴 高优</span>`;
  if (score >= 7 || index < 3)  return `<span class="ni-badge ni-high">🟡 关注</span>`;
  return `<span class="ni-badge ni-normal">⬜ 参考</span>`;
}

function renderNews(items) {
  if (!items || !items.length) {
    html("#newsGrid", `<div class="empty-state">暂无新闻数据</div>`);
    return;
  }
  html("#newsGrid", items.map((item, index) => {
    const score = newsImpactScore(item, index);
    const biasClass = newsBiasClass(item.bias);
    const priority = index < 2 ? "high" : index < 5 ? "mid" : "low";
    const biasColor = item.bias === "BEARISH" ? "down" : item.bias === "BULLISH" ? "up" : "flat";
    const isTop = index < 2;
    return `
    <article class="news-card ${biasClass} news-priority-${priority}">
      <div class="ni-header">
        <div class="ni-meta">
          ${newsUrgencyBadge(score, index)}
          <span class="ni-ticker"><b>${escapeHtml(item.ticker || "MACRO")}</b>${item.sector ? `<em>${escapeHtml(item.sector)}</em>` : ""}</span>
          <span class="${biasColor}">${escapeHtml(displayNewsBias(item.bias))}</span>
          <span class="ni-time">${escapeHtml(item.time || "")}</span>
          <span class="ni-impact-score" title="市场影响力评分">${score.toFixed(1)}/10</span>
        </div>
        <strong class="news-title-cn">${isTop ? "★ " : ""}${escapeHtml(item.title)}</strong>
        ${item.originalTitle && item.originalTitle !== item.title
          ? `<em class="news-title-en">${escapeHtml(item.originalTitle)}</em>` : ""}
      </div>
      ${item.summary ? `<details class="ni-detail">
        <summary class="ni-expand-btn">展开分析 ▾</summary>
        <div class="ni-body">
          <p class="ni-summary">${escapeHtml(item.summary)}</p>
          ${item.context ? `<div class="ni-context"><span class="ni-ctx-label">背景：</span>${escapeHtml(item.context)}</div>` : ""}
        </div>
      </details>` : ""}
    </article>`;
  }).join(""));
}

function newsBiasClass(bias) {
  if (bias === "BULLISH") return "bullish-card";
  if (bias === "BEARISH") return "bearish-card";
  return "neutral-card";
}


function renderProWorkspaces(dashboard) {
  if (!dashboard) return;
  latestDashboard = dashboard;
  // Expose to Specularis Market Terminal Lite modules.
  window._specularisDashboard = dashboard;
  renderIntradayWorkspace(dashboard);
  renderDailyReportWorkspace(dashboard);
  renderNextPlanWorkspace(dashboard);
  renderAIWatchlistWorkspace(dashboard);
}

function renderIntradayWorkspace(dashboard) {
  text("#intradayModuleMeta", dashboard.asOf || "已同步");
  const movers = (dashboard.movers || []).slice(0, 4);
  const topMover = movers[0];
  const topNews = (dashboard.news || [])[0];
  const topFlow = (dashboard.flows || [])[0];
  const topOption = (dashboard.options || [])[0];
  html("#intradayPulse", [
    proKpiCard("风险状态", displayRiskMode(dashboard.risk?.mode), dashboard.risk?.conclusion || "等待确认", dashboard.risk?.mode === "Risk-Off" ? "pulse-risk" : dashboard.risk?.mode === "Risk-On" ? "pulse-live" : "pulse-watch"),
    proKpiCard("最强异动", topMover ? `${topMover.symbol} ${signed(topMover.change)}` : "等待", topMover?.reason || "等待异动源刷新", topMover?.change < 0 ? "pulse-risk" : "pulse-live"),
    proKpiCard("主线板块", topFlow ? `${topFlow.sector}` : "等待", topFlow ? `热度 ${topFlow.score} · ${topFlow.summary}` : "等待板块热度", "pulse-watch"),
    proKpiCard("期权代理", topOption ? displayTradeState(topOption.conviction || topOption.direction || topOption.type) : "观察", topOption?.summary || "等待代理信号", "pulse-watch")
  ].join(""));
  html("#intradayNews", (dashboard.news || []).slice(0, 6).map((item) => `
    <div class="feed-item">
      <div class="row-head"><span>${escapeHtml(item.ticker || "MACRO")}</span><span class="${item.bias === "BEARISH" ? "down" : item.bias === "BULLISH" ? "up" : "flat"}">${escapeHtml(displayNewsBias(item.bias))}</span></div>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.summary || item.originalTitle || "")}</p>
    </div>
  `).join(""));
  html("#intradayMovers", movers.map((item) => `
    <div class="feed-item">
      <div class="row-head"><span>${escapeHtml(item.sector)}</span><span class="${item.change >= 0 ? "up" : "down"}">${signed(item.change)}</span></div>
      <strong>${escapeHtml(item.symbol)} · ${escapeHtml(item.name || "")}</strong>
      <p>${escapeHtml(item.reason || item.durability || "等待确认")}</p>
    </div>
  `).join(""));
}

function proKpiCard(title, value, copy, tone = "") {
  return `<article class="pro-card"><p class="panel-label">${escapeHtml(title)}</p><div class="kpi ${tone}">${escapeHtml(value)}</div><p>${escapeHtml(copy)}</p></article>`;
}

function renderDailyReportWorkspace(dashboard) {
  text("#dailyReportMeta", `${dashboard.asOf || "最新快照"} · 本地结构化解释层`);
  const localReport = buildLocalDailyReport(dashboard);
  renderDailyReportPayload(localReport, { source: "local" });
}

function buildLocalDailyReport(dashboard) {
  const indices = dashboard.indices || [];
  const flows = dashboard.flows || [];
  const movers = dashboard.movers || [];
  const news = dashboard.news || [];
  const risk = dashboard.risk || {};
  const summary = `${displayRiskMode(risk.mode)}；主线：${flows[0]?.sector || "等待确认"}；重点观察：${movers.slice(0, 5).map((item) => item.symbol).join(" / ") || "等待异动"}。`;
  return {
    title: "AI美股日报｜本地快照版",
    provider: "local-dashboard",
    status: "snapshot",
    summary,
    marketRegime: { mode: risk.mode || "Neutral", label: displayRiskMode(risk.mode), score: risk.score ?? null },
    actionBias: dashboard.tradePlan?.title || dashboard.strategy || "等待开盘量价确认",
    focus: [...(dashboard.opportunities || []), ...(dashboard.movers || [])].slice(0, 6).map((item) => item.symbol).filter(Boolean),
    avoid: ["无量高开追涨", "VIX反弹时重仓CALL", "指数与个股背离时追单"],
    sections: [
      { id: "00", title: "今日一句话总结", body: dashboard.risk?.conclusion || dashboard.marketSummary || "市场等待确认", bullets: [`主线：${flows[0]?.sector || "等待板块确认"}`, `策略：${dashboard.strategy || "等待量价确认"}`] },
      { id: "01", title: "大盘表现总览", body: indices.slice(0, 7).map((item) => `${item.id}: ${formatNumber(item.value)} ${signed(item.change)}`).join("；") || "暂无可靠指数数据。", bullets: [] },
      { id: "02", title: "盘中走势复盘", body: dashboard.marketSummary || "宽基指数等待成交确认。", bullets: [`盘前：${dashboard.scannerStatus?.premarketMomentum || "观察"}`, `开盘：${dashboard.scannerStatus?.openingBias || "观察"}`] },
      { id: "03", title: "宏观环境", body: (dashboard.macro || [])[0]?.summary || "重点观察美债、美元、VIX、黄金与油价。", bullets: [] },
      { id: "04", title: "板块表现 / 主题风格", body: flows.slice(0, 8).map((item) => `${item.sector} ${item.score}`).join(" / ") || "等待板块热度。", bullets: [] },
      { id: "05", title: "市场宽度与参与度", body: "当前以板块扩散、异动数量、机会榜数量和相对成交量作为宽度代理。", bullets: [] },
      { id: "06", title: "技术面分析", body: "确认链：指数方向 → VWAP → 相对成交量 → 板块共振 → 个股新闻催化。", bullets: [] },
      { id: "07", title: "重点个股新闻与异动", body: movers.slice(0, 6).map((item) => `${item.symbol} ${signed(item.change)}：${item.reason}`).join("；") || "暂无可靠异动。", bullets: [] },
      { id: "10", title: "机构观点与资金流", body: news.slice(0, 5).map((item) => `${item.ticker}｜${item.title}`).join("；") || "等待新闻源刷新。", bullets: [] },
      { id: "13", title: "明日交易计划", body: dashboard.tradePlan?.body || "开盘15分钟后确认：QQQ/SPY同向、VIX不反弹、目标股RVOL放大、VWAP回踩承接。", bullets: [] },
      { id: "14", title: "风险提示", body: "若QQQ跌破开盘区间低点、VIX反弹、10Y/DXY同步上行、AI龙头放量回落，应取消追涨计划。", bullets: [] },
      { id: "15", title: "最终结论", body: `当前阶段：${displayRiskMode(risk.mode)}。只做确认后的主线顺势机会。`, bullets: [] }
    ]
  };
}

function renderDailyReportPayload(report = {}, options = {}) {
  const sections = Array.isArray(report.sections) ? report.sections : [];
  text("#dailyReportMeta", `${report.provider || options.source || "narrative"} · ${report.status || "live"}`);
  html("#dailyReport", `
    <article class="report-card wide report-hero-summary narrative-hero">
      <p class="panel-label">AI NARRATIVE ENGINE</p>
      <h3>${escapeHtml(report.summary || report.title || "等待日报生成")}</h3>
      <p>${escapeHtml(report.actionBias || "日报会把行情、板块、催化与风险转化为可执行计划。")}</p>
      <div class="mini-tags">
        <span>${escapeHtml(report.marketRegime?.label || displayRiskMode(report.marketRegime?.mode) || "市场状态")}</span>
        ${(report.focus || []).slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </article>
    ${sections.map((section) => `
      <article class="report-card ${section.id === "00" || section.id === "15" ? "wide" : ""}">
        <p class="panel-label">${escapeHtml(section.id || "--")}</p>
        <h3>${escapeHtml(section.title || "未命名章节")}</h3>
        <p>${escapeHtml(section.body || "等待数据")}</p>
        ${Array.isArray(section.bullets) && section.bullets.length ? `<div class="mini-tags">${section.bullets.slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      </article>
    `).join("")}
  `);
}

async function loadDailyReportFromApi(force = false) {
  if (dailyReportLoading) return;
  const url = endpoint("dailyReport");
  if (!url) return;
  const now = Date.now();
  if (!force && dailyReportLoadedAt && now - dailyReportLoadedAt < 180000) return;
  dailyReportLoading = true;
  try {
    text("#dailyReportMeta", "AI日报生成中...");
    const joiner = url.includes("?") ? "&" : "?";
    const report = await fetchJson(`${url}${joiner}ts=${Date.now()}`);
    dailyReportLoadedAt = Date.now();
    renderDailyReportPayload(report, { source: "api" });
  } catch (error) {
    console.warn("daily report fallback", error);
    if (latestDashboard) renderDailyReportPayload(buildLocalDailyReport(latestDashboard), { source: "local-fallback" });
  } finally {
    dailyReportLoading = false;
  }
}

function renderNextPlanWorkspace(dashboard) {
  text("#nextPlanMeta", dashboard.asOf || "最新快照");
  const plan = dashboard.tradePlan || { focus: [], avoid: [] };
  const decision = dashboard.tradeDecision || {};
  const indices = Object.fromEntries((dashboard.indices || []).map((item) => [item.id, item]));
  const watch = [...(dashboard.opportunities || []), ...(dashboard.opportunityWatchlist || [])].filter((item) => item?.symbol && !String(item.symbol).includes("暂无")).slice(0, 8);
  const targets = Array.isArray(decision.targets) ? decision.targets.slice(0, 5) : [];
  const checklist = Array.isArray(decision.checklist) ? decision.checklist.slice(0, 5) : [];
  html("#decisionBoard", `
    <article class="decision-card p4-hero-card"><p class="panel-label">P4 交易决策</p><h3>${escapeHtml(decision.title || plan.title || dashboard.strategy || "等待确认")}</h3><p>${escapeHtml(decision.summary || plan.body || dashboard.strategyContext || "等待行情刷新。")}</p><div class="mini-tags"><span>${escapeHtml(decision.permission || "等待确认")}</span><span>${escapeHtml(decision.direction || "WAIT")}</span><span>概率 ${escapeHtml(decision.probability ?? "--")}</span></div></article>
    <article class="decision-card"><p class="panel-label">SPY / QQQ 关键区</p><div class="kpi">${escapeHtml(decision.grade || displayRiskModeHero(dashboard.risk?.mode))}</div><p>SPY：${levelText(indices.SPY)}<br>QQQ：${levelText(indices.QQQL || indices.QQQ)}</p></article>
    <article class="decision-card"><p class="panel-label">市场闸门</p><h3>${escapeHtml(decision.marketGate?.permission || decision.permission || "等待确认")}</h3><p>${escapeHtml(decision.marketGate?.reason || "重点看 QQQ / SPY / VIX / Breadth 是否共振。")}</p></article>
    <article class="decision-card p4-targets"><p class="panel-label">优先目标</p>${targets.length ? targets.map((item) => `<p><b>${escapeHtml(item.symbol)}</b>｜${escapeHtml(item.grade)}｜${escapeHtml(item.direction)}｜${escapeHtml(item.entryTrigger)}</p>`).join("") : (plan.focus || []).map((item) => `<p>• ${escapeHtml(item)}</p>`).join("") || "<p>等待机会榜刷新。</p>"}</article>
    <article class="decision-card"><p class="panel-label">避免</p>${(decision.avoid || plan.avoid || []).slice(0, 5).map((item) => `<p>• ${escapeHtml(item)}</p>`).join("") || "<p>避免无量高开和低质量突破。</p>"}</article>
    <article class="decision-card"><p class="panel-label">执行检查</p>${checklist.length ? checklist.map((item) => `<p>${item.pass ? "✓" : "×"} ${escapeHtml(item.label)}：${escapeHtml(item.detail)}</p>`).join("") : `<p>${watch.map((item) => item.symbol).join(" / ") || "等待观察名单"}</p>`}</article>
  `);
}

function levelText(item) {
  const value = Number(item?.value || 0);
  if (!value) return "等待行情";
  return `支撑 ${formatNumber(value * 0.992)} / 压力 ${formatNumber(value * 1.008)}`;
}

function renderAIWatchlistWorkspace(dashboard) {
  text("#watchlistMeta", dashboard.asOf || "最新快照");
  const focusSymbols = ["NVDA","AMD","AVGO","MRVL","PLTR","ORCL","CRWD","COIN","MSTR","VRT","SMR","OKLO","CEG","VST","FLNC","APLD"];
  const sourceItems = [...(dashboard.opportunities || []), ...(dashboard.opportunityWatchlist || []), ...(dashboard.stars || []), ...(dashboard.movers || [])];
  const bySymbol = new Map();
  for (const item of sourceItems) {
    if (item?.symbol && !bySymbol.has(item.symbol)) bySymbol.set(item.symbol, item);
  }
  const cards = focusSymbols.map((symbol) => {
    const item = bySymbol.get(symbol) || {};
    const sector = item.sector || symbolMeta?.[symbol]?.[1] || "核心观察";
    const score = item.score ?? item.heat ?? (item.change ? Math.round(55 + Math.abs(item.change) * 4) : "观察");
    const trend = item.signal ? displayTradeState(item.signal) : item.change > 0 ? "继续强势" : item.change < 0 ? "回踩支撑" : "需要观察";
    const note = item.logic || item.reason || item.summary || "等待新闻、量能、板块强弱与关键价位确认。";
    return `<article class="watch-card">
      <div class="watch-symbol"><strong>${escapeHtml(symbol)}</strong><span>${escapeHtml(score)}</span></div>
      <p class="panel-label">${escapeHtml(sector)}</p>
      <h3>${escapeHtml(trend)}</h3>
      <p>${escapeHtml(note)}</p>
      <div class="mini-tags"><span>支撑：开盘 VWAP / 前低</span><span>压力：盘前高点 / 前高</span></div>
    </article>`;
  }).join("");
  html("#aiWatchlist", cards);
}

function initWorkspaceNavigation() {
  const tabs = [...document.querySelectorAll("[data-workspace-target]")];
  const views = [...document.querySelectorAll("[data-workspace]")];
  if (!tabs.length || !views.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.workspaceTarget;
      tabs.forEach((node) => node.classList.toggle("is-active", node === tab));
      views.forEach((view) => view.classList.toggle("is-active", view.dataset.workspace === target));
      if (target === "report") loadDailyReportFromApi(false);
      const selectedView = views.find((view) => view.dataset.workspace === target);
      if (selectedView) selectedView.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
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
  if (!Number.isFinite(Number(value)) || value === null || value === undefined) return "--";
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

function avg(values = []) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
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

initWorkspaceNavigation();
refresh();
startCountdown();
setInterval(refresh, REFRESH_SECONDS * 1000);
