import { cleanSymbols, fetchJson, noStoreJson } from "./_utils.js";

const MARKET_SYMBOLS = {
  SPY: "SPY",
  QQQ: "QQQ",
  VIX: "^VIX",
  TNX: "^TNX",
  DXY: "DX-Y.NYB",
  GOLD: "GC=F",
  NDX: "^NDX"
};

const sourceCatalog = {
  yahoo: "Market Data Adapter",
  tradingView: "TradingView Screener",
  xMacro: "Macro Feed",
  reddit: "WallStreetBets Reddit",
  finviz: "Sector Heat Proxy",
  unusualWhales: "Options Flow Proxy",
  benzinga: "News Catalyst Proxy"
};

const symbolMeta = {
  SPY: ["SPDR S&P 500 ETF", "Index ETF"],
  QQQ: ["Invesco QQQ", "Index ETF"],
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
  TSLA: ["Tesla", "高 beta 动量"],
  PLTR: ["Palantir", "AI 软件"],
  ORCL: ["Oracle", "AI 软件"],
  CRWD: ["CrowdStrike", "云安全"],
  PANW: ["Palo Alto", "云安全"],
  COIN: ["Coinbase", "加密资产"],
  MSTR: ["MicroStrategy", "加密资产"],
  XOM: ["Exxon Mobil", "能源"],
  CVX: ["Chevron", "能源"],
  JPM: ["JPMorgan", "金融"],
  LLY: ["Eli Lilly", "医疗"],
  DASH: ["DoorDash", "消费科技"],
  CSCO: ["Cisco", "AI 网络"],
  SMR: ["NuScale Power", "核能"],
  OKLO: ["Oklo", "核能"],
  NNE: ["Nano Nuclear", "核能"],
  UEC: ["Uranium Energy", "铀矿"]
};

const snapshotIndices = [
  metric("SPY", "S&P 500 ETF", 739.17, -1.2, "SNAPSHOT：宽基风险资产。"),
  metric("QQQ", "NASDAQ ETF", 708.93, -1.51, "SNAPSHOT：科技权重代理。"),
  metric("NDX", "NASDAQ 100", 25172.18, 0.48, "SNAPSHOT：纳指 100。"),
  metric("VIX", "VOLATILITY", 13.62, -2.01, "SNAPSHOT：波动率风险锚。"),
  metric("TNX", "10Y YIELD", 4.12, 0.87, "SNAPSHOT：长端利率。"),
  metric("DXY", "DOLLAR INDEX", 98.36, -0.11, "SNAPSHOT：美元流动性。"),
  metric("GOLD", "GOLD", 3378.4, -0.24, "SNAPSHOT：避险资产。")
];

const snapshotQuotes = [
  quote("NVDA", 188.2, 2.35, 2.1),
  quote("AMD", 238.3, 1.64, 1.5),
  quote("AVGO", 305.7, 1.42, 1.45),
  quote("PLTR", 227.4, 4.82, 2.9),
  quote("TSLA", 462.5, 1.76, 1.8),
  quote("COIN", 358.9, 1.11, 1.4),
  quote("MSTR", 462.5, 1.76, 1.8),
  quote("MRVL", 93.4, 2.08, 1.7),
  quote("MSFT", 421.9, 0.76, 1.2),
  quote("META", 614.2, 0.68, 1.1),
  quote("CRWD", 554.8, 1.28, 1.35),
  quote("LLY", 792.4, -0.64, 1.05),
  quote("XOM", 117.3, -0.28, 0.9)
];

const snapshotNews = [
  {
    ticker: "NVDA",
    sector: "AI 半导体",
    category: "主线",
    newsType: "AI demand",
    bias: "BULLISH",
    title: "NVDA｜AI 芯片需求逻辑继续强化",
    summary: "机构继续关注 AI 数据中心扩张主线，开盘需确认量能延续。",
    originalTitle: "NVIDIA remains central to AI data center demand",
    originalSummary: "Snapshot catalyst retained for terminal continuity.",
    time: "SNAPSHOT"
  },
  {
    ticker: "AMD",
    sector: "AI 半导体",
    category: "主线",
    newsType: "semiconductor",
    bias: "BULLISH",
    title: "AMD｜AI 芯片追赶逻辑进入盘前定价",
    summary: "资金继续评估 AMD 在 AI 加速器链条中的弹性。",
    originalTitle: "Advanced Micro Devices draws attention as an AI GPU beneficiary",
    originalSummary: "Snapshot catalyst retained for terminal continuity.",
    time: "SNAPSHOT"
  },
  {
    ticker: "PLTR",
    sector: "AI 软件",
    category: "主线",
    newsType: "AI demand",
    bias: "BULLISH",
    title: "PLTR｜AI 软件订单预期维持强势",
    summary: "AI 软件主线延续，但需等待开盘成交量确认突破质量。",
    originalTitle: "Palantir remains in focus as AI software demand expands",
    originalSummary: "Snapshot catalyst retained for terminal continuity.",
    time: "SNAPSHOT"
  }
];

const tvSymbols = [
  "NASDAQ:NVDA",
  "NASDAQ:AMD",
  "NASDAQ:AVGO",
  "NASDAQ:MRVL",
  "NASDAQ:MSFT",
  "NASDAQ:AMZN",
  "NASDAQ:META",
  "NASDAQ:TSLA",
  "NASDAQ:PLTR",
  "NYSE:ORCL",
  "NASDAQ:CRWD",
  "NASDAQ:COIN",
  "NASDAQ:MSTR",
  "NASDAQ:CSCO"
];

let lastGoodSources = {};
let lastGoodSnapshot = null;

function metric(id, name, value, change, note, status = "SNAPSHOT") {
  return { id, name, value, change, note, status };
}

function quote(symbol, price, preMarketChange, relativeVolume = 1, extra = {}) {
  const [name, sector] = symbolMeta[symbol] || [symbol, "其他"];
  return {
    symbol,
    name,
    sector,
    price,
    preMarketChange,
    preMarketChangePercent: preMarketChange,
    regularMarketChangePercent: extra.regularMarketChangePercent ?? preMarketChange,
    volumeRatio: relativeVolume,
    relativeVolume,
    volume: extra.volume ?? 0,
    averageVolume: extra.averageVolume ?? 0,
    dataStatus: extra.dataStatus || "SNAPSHOT"
  };
}

function nowIso(value) {
  return new Date(value).toISOString();
}

function source(key, data, status, generatedAt, label = sourceCatalog[key]) {
  return { data, status, label, updatedAt: generatedAt, timestamp: nowIso(generatedAt) };
}

function cachedSource(key, cached) {
  return { ...cached, status: "cached", timestamp: cached.timestamp || nowIso(cached.updatedAt || Date.now()) };
}

function fallbackSource(key, data = null) {
  return { data, status: "fallback", label: sourceCatalog[key], updatedAt: null, timestamp: "snapshot only" };
}

function keepLastGood(key, item) {
  if (["live", "delayed", "proxy"].includes(item.status) && item.data) lastGoodSources[key] = item;
  return item;
}

function lastOrFallback(key, fallbackData = null) {
  return lastGoodSources[key] ? cachedSource(key, lastGoodSources[key]) : fallbackSource(key, fallbackData);
}

async function settleSource(key, loader, generatedAt, fallbackData = null, label) {
  try {
    const loaded = await loader();
    return keepLastGood(key, source(key, loaded.data ?? loaded, loaded.status || "live", generatedAt, label || loaded.label || sourceCatalog[key]));
  } catch {
    if (lastGoodSources[key]) return cachedSource(key, lastGoodSources[key]);
    return fallbackSource(key, fallbackData);
  }
}

async function fetchWithFallback(symbol) {
  try {
    const yahoo = await fetchYahooQuote(symbol);
    if (yahoo) return { ...yahoo, dataStatus: "LIVE" };
  } catch {}
  try {
    const stooq = await fetchStooqQuote(symbol);
    if (stooq) return { ...stooq, dataStatus: "DELAYED" };
  } catch {}
  try {
    const alpha = await fetchAlphaDemo(symbol);
    if (alpha) return { ...alpha, dataStatus: "DELAYED" };
  } catch {}
  return null;
}

async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url, { timeoutMs: 9000 });
  const row = payload.quoteResponse?.result?.[0];
  if (!row?.regularMarketPrice) return null;
  return {
    symbol,
    price: row.preMarketPrice ?? row.regularMarketPrice,
    change: row.preMarketChangePercent ?? row.regularMarketChangePercent ?? 0,
    regularChange: row.regularMarketChangePercent ?? 0,
    volume: row.regularMarketVolume ?? 0,
    averageVolume: row.averageDailyVolume3Month ?? 0
  };
}

async function fetchStooqQuote(symbol) {
  const stooq = stooqSymbol(symbol);
  if (!stooq) return null;
  const response = await fetch(`https://stooq.com/q/l/?s=${stooq}&f=sd2t2ohlcvp&h&e=csv`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Institutional-Terminal/1.0)" }
  });
  if (!response.ok) return null;
  const [, line] = (await response.text()).trim().split(/\r?\n/);
  if (!line) return null;
  const [, , , , , , close, volume, previous] = line.split(",");
  const price = Number(close);
  const prev = Number(previous);
  if (!Number.isFinite(price) || !Number.isFinite(prev) || price <= 0 || prev <= 0) return null;
  return { symbol, price, change: ((price - prev) / prev) * 100, regularChange: ((price - prev) / prev) * 100, volume: Number(volume) || 0, averageVolume: Number(volume) || 0 };
}

async function fetchAlphaDemo(symbol) {
  if (!/^[A-Z.]+$/.test(symbol)) return null;
  const payload = await fetchJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=demo`, { timeoutMs: 7000 });
  const row = payload["Global Quote"];
  const price = Number(row?.["05. price"]);
  const changeRaw = String(row?.["10. change percent"] || "").replace("%", "");
  if (!Number.isFinite(price) || price <= 0) return null;
  return { symbol, price, change: Number(changeRaw) || 0, regularChange: Number(changeRaw) || 0, volume: Number(row?.["06. volume"]) || 0, averageVolume: 0 };
}

function stooqSymbol(symbol) {
  const clean = symbol.replaceAll("%5E", "^").replaceAll("%3D", "=").toUpperCase();
  const indexMap = { "^VIX": "^vix", "^NDX": "^ndx", "^TNX": null, "DX-Y.NYB": null, "GC=F": "gc.f" };
  if (clean in indexMap) return indexMap[clean];
  if (clean.startsWith("^") || clean.includes("=") || clean.includes(".")) return null;
  return `${clean.toLowerCase()}.us`;
}

async function loadMarketData(rawSymbols) {
  const marketEntries = Object.entries(MARKET_SYMBOLS);
  const symbols = cleanSymbols(rawSymbols).split(",").filter(Boolean);
  const quoteSymbols = symbols.filter((item) => !Object.values(MARKET_SYMBOLS).includes(item) && !item.startsWith("^")).slice(0, 40);
  const [marketRows, stockRows] = await Promise.all([
    Promise.all(marketEntries.map(async ([id, symbol]) => [id, await fetchWithFallback(symbol)])),
    Promise.all(quoteSymbols.map((symbol) => fetchWithFallback(symbol).then((row) => [symbol, row]).catch(() => [symbol, null])))
  ]);

  const indices = marketRows.map(([id, row]) => {
    const fallback = snapshotIndices.find((item) => item.id === id);
    if (!row) return { ...fallback, note: "SNAPSHOT：行情源暂不可用，使用最近结构快照。", status: "SNAPSHOT" };
    return metric(id, fallback.name, row.price || fallback.value, row.change ?? fallback.change, `${row.dataStatus}：多源行情适配器。`, row.dataStatus);
  });

  const quotes = stockRows.map(([symbol, row]) => {
    const fallback = snapshotQuotes.find((item) => item.symbol === symbol);
    if (!row && fallback) return fallback;
    if (!row) return null;
    const relativeVolume = row.volume && row.averageVolume ? row.volume / row.averageVolume : fallback?.relativeVolume || 1;
    return quote(symbol, row.price, row.change, relativeVolume, {
      regularMarketChangePercent: row.regularChange,
      volume: row.volume,
      averageVolume: row.averageVolume,
      dataStatus: row.dataStatus
    });
  }).filter(Boolean);

  return { data: { indices, quotes: quotes.length ? quotes : snapshotQuotes }, status: indices.some((item) => item.status === "LIVE") ? "live" : "delayed", label: "Multi-source Market Data" };
}

async function loadTradingView() {
  const payload = await fetchJson("https://scanner.tradingview.com/america/scan", {
    timeoutMs: 10000,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbols: { tickers: tvSymbols, query: { types: [] } },
      columns: ["name", "close", "change", "volume", "Recommend.All", "RSI"],
      range: [0, 50]
    })
  });
  const rows = (payload.data || []).map((row) => {
    const [symbol, _close, change, volume, recommendation, rsi] = row.d || [];
    const [, sector] = symbolMeta[symbol] || [symbol, "强势股"];
    const score = clamp(Math.round(55 + (change || 0) * 4 + (recommendation || 0) * 18 + ((rsi || 50) - 50) * 0.35));
    return { symbol, score, sector, change: change || 0, volume: volume || 0, rsi: rsi || 50, recommendation: recommendation || 0, logic: `动量 ${Number(change || 0).toFixed(2)}%，RSI ${Number(rsi || 0).toFixed(1)}。` };
  }).filter((item) => item.symbol);
  if (!rows.length) throw new Error("TradingView empty scan");
  return rows.sort((a, b) => b.score - a.score).slice(0, 8);
}

async function loadReddit() {
  const payload = await fetchJson("https://www.reddit.com/r/wallstreetbets/hot.json?limit=50", {
    timeoutMs: 10000,
    headers: { "User-Agent": "InstitutionalDashboard/1.0" }
  });
  const posts = payload.data?.children?.map((item) => item.data) || [];
  if (!posts.length) throw new Error("Reddit empty feed");
  const tickers = {};
  let toneScore = 50;
  for (const post of posts) {
    const text = `${post.title || ""}`.toUpperCase();
    for (const symbol of Object.keys(symbolMeta)) {
      if (text.includes(symbol)) tickers[symbol] = (tickers[symbol] || 0) + 1;
    }
    const lower = text.toLowerCase();
    if (/(call|calls|moon|bull|buy|yolo|beat)/.test(lower)) toneScore += 1.6;
    if (/(put|puts|bear|sell|short|miss)/.test(lower)) toneScore -= 1.4;
  }
  const score = clamp(Math.round(toneScore));
  return {
    score,
    tone: score >= 62 ? "偏乐观" : score <= 42 ? "偏谨慎" : "中性",
    mentions: Object.entries(tickers).sort((a, b) => b[1] - a[1]).slice(0, 8),
    summary: score >= 62 ? "WSB 风险偏好回升，高 beta 与 AI 讨论活跃。" : "WSB 情绪未形成一致追涨，短线偏观察。"
  };
}

async function loadYahooNews() {
  const rss = await fetchText("https://feeds.finance.yahoo.com/rss/2.0/headline?s=SPY,QQQ,NVDA,AMD,AVGO,MSFT,TSLA,PLTR,COIN,MSTR,LLY,META,AAPL&region=US&lang=en-US");
  const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20).flatMap((match, index) => {
    const block = match[1];
    const title = stripXml(block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/)?.[1] || block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
    const summary = stripXml(block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/)?.[1] || "");
    if (!title || title.toLowerCase().includes("market update") || title.length < 15 || summary.length < 10) return [];
    const analyzed = analyzeNews({ title, summary, time: new Date(Date.now() - index * 8 * 60 * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) });
    return analyzed ? [analyzed] : [];
  });
  if (!items.length) throw new Error("Yahoo news empty");
  return items.slice(0, 8);
}

async function fetchText(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Institutional-Terminal/1.0)", Accept: "application/rss+xml,text/xml,text/plain,*/*" }
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.text();
}

function stripXml(value) {
  return String(value).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").trim();
}

function analyzeNews(news) {
  if (!news?.title || news.title.toLowerCase().includes("market update") || news.title.length < 15 || String(news.summary || "").length < 10) return null;
  const ticker = extractTicker(news);
  const type = detectNewsType(news);
  if (!ticker && !isMarketRelevantNews(news, type)) return null;
  const bias = classifyNewsBias(`${news.title} ${news.summary}`, type);
  const sector = ticker ? symbolMeta[ticker]?.[1] || "美股" : typeToSector(type);
  return {
    ticker: ticker || "MACRO",
    sector,
    category: typeLabel(type),
    newsType: type,
    bias,
    title: makeReadableChineseNewsTitle({ ticker, type, originalTitle: news.title, bias }),
    summary: rewriteNewsSummary(ticker, type, bias),
    originalTitle: news.title,
    originalSummary: news.summary,
    time: news.time
  };
}

function extractTicker(news) {
  const text = `${news.title || ""} ${news.summary || ""}`.toUpperCase();
  const aliases = [
    ["Advanced Micro Devices", "AMD"],
    ["NVIDIA", "NVDA"],
    ["Nvidia", "NVDA"],
    ["Palantir", "PLTR"],
    ["Tesla", "TSLA"],
    ["Eli Lilly", "LLY"],
    ["Meta", "META"],
    ["Apple", "AAPL"],
    ["Coinbase", "COIN"],
    ["MicroStrategy", "MSTR"],
    ["Broadcom", "AVGO"],
    ["NuScale Power", "SMR"],
    ["Oklo", "OKLO"],
    ["Uranium Energy", "UEC"],
    ["Nano Nuclear", "NNE"]
  ];
  for (const [name, symbol] of aliases) {
    if (text.includes(name.toUpperCase())) return symbol;
  }
  return Object.keys(symbolMeta).find((symbol) => new RegExp(`\\b${symbol}\\b`).test(text)) || "";
}

function detectNewsType(news) {
  const lower = `${news.title || ""} ${news.summary || ""}`.toLowerCase();
  if (/upgrade|price target|buy rating/.test(lower)) return "analyst upgrade";
  if (/downgrade|sell rating/.test(lower)) return "downgrade";
  if (/earnings beat|beats|beat estimates|revenue beat/.test(lower)) return "earnings beat";
  if (/earnings miss|misses|miss estimates|revenue miss/.test(lower)) return "earnings miss";
  if (/guidance raise|raises guidance|raised guidance/.test(lower)) return "guidance raise";
  if (/guidance cut|cuts guidance|lower guidance/.test(lower)) return "guidance cut";
  if (/\bai\b|artificial intelligence|gpu demand|ai demand/.test(lower)) return "AI demand";
  if (/semiconductor|chip|gpu|data center/.test(lower)) return "semiconductor";
  if (/cloud|software|saas/.test(lower)) return "cloud";
  if (/crypto|bitcoin|ether/.test(lower)) return "crypto";
  if (/fda|trial|drug|phase/.test(lower)) return "FDA";
  if (/lawsuit|probe|investigation/.test(lower)) return "lawsuit";
  if (/war|missile|iran|qatar|tariff/.test(lower)) return "war";
  if (/government|contract|defense/.test(lower)) return "government";
  if (/fed|federal reserve|yield|rates/.test(lower)) return "macro";
  if (/inflation|cpi|pce/.test(lower)) return "inflation";
  if (/ipo|openai|spacex|anthropic/.test(lower)) return "IPO";
  if (/uranium|power|nuclear|nuscale|oklo|nano nuclear/.test(lower)) return "nuclear";
  return "macro";
}

function isMarketRelevantNews(news, type) {
  const lower = `${news.title || ""} ${news.summary || ""}`.toLowerCase();
  if (/retirement|social security|dividend income|roth ira|personal finance/.test(lower)) return false;
  return /(fed|cpi|treasury|nasdaq|s&p|dow|ai|ipo|crypto|bitcoin|oil|gold|nuclear|uranium|rates|inflation)/.test(lower)
    || ["macro", "inflation", "crypto", "war", "IPO", "nuclear"].includes(type);
}

function classifyNewsBias(text, type) {
  const lower = String(text || "").toLowerCase();
  if (/downgrade|lawsuit|investigation|war|tariff|delay|weak demand|warning|loss|miss|cut/.test(lower) || ["downgrade", "earnings miss", "guidance cut", "lawsuit", "war"].includes(type)) return "BEARISH";
  if (/beat|raise|raises|upgrade|price target|partnership|contract|\bai\b|launch|demand|growth/.test(lower) || ["analyst upgrade", "earnings beat", "guidance raise", "AI demand", "government"].includes(type)) return "BULLISH";
  return "NEUTRAL";
}

function makeReadableChineseNewsTitle({ ticker, type, originalTitle }) {
  const symbol = ticker || "MACRO";
  const lower = String(originalTitle || "").toLowerCase();
  let event = "事件催化进入盘前定价";
  if (/price target|raises|raise|upgrade/.test(lower)) event = "目标价上调强化买盘预期";
  else if (/downgrade|cut/.test(lower)) event = "评级下修压制风险偏好";
  else if (/\bai\b|nvidia|amd|data center|chip|gpu|server/.test(lower)) event = "AI 需求逻辑继续强化";
  else if (/earnings|reports|results|revenue/.test(lower)) event = "财报或业绩结果进入定价";
  else if (/trial|drug|weight loss|eli lilly|lilly/.test(lower)) event = "医药试验结果引发波动";
  else if (/fed|treasury|inflation|rates|yield/.test(lower)) event = "利率与通胀预期影响市场";
  else if (/futures|nasdaq|s&p 500|dow jones|dow/.test(lower)) event = "股指期货维持高位震荡";
  else if (/ipo|openai|spacex|anthropic/.test(lower)) event = "AI IPO 预期升温";
  else if (/uranium|power|nuclear|nuscale|oklo|nano nuclear/.test(lower)) event = "核能主题波动升温";
  return `${symbol}｜${event}`;
}

function rewriteNewsSummary(ticker, type, bias) {
  const subject = ticker ? symbolMeta[ticker]?.[1] || ticker : "市场";
  if (bias === "BULLISH") return `机构资金关注${subject}的催化延续，需观察开盘量能确认。`;
  if (bias === "BEARISH") return `${subject}出现负面催化，短线风险偏好可能降温。`;
  return `${subject}相关信息进入盘前定价，方向仍需价格确认。`;
}

function typeLabel(type) {
  if (/upgrade|downgrade/.test(type)) return "评级";
  if (/earnings|guidance/.test(type)) return "财报";
  if (/AI|semiconductor|cloud|crypto/.test(type)) return "主线";
  if (/macro|inflation|war/.test(type)) return "宏观";
  if (/FDA|lawsuit|government/.test(type)) return "事件";
  return "新闻";
}

function typeToSector(type) {
  if (/AI|semiconductor/.test(type)) return "AI 半导体";
  if (/cloud/.test(type)) return "AI 软件";
  if (/crypto/.test(type)) return "加密资产";
  if (/FDA/.test(type)) return "医疗";
  return "宏观";
}

function deriveSectors(quotes) {
  const grouped = new Map();
  for (const item of quotes || []) {
    if (!grouped.has(item.sector)) grouped.set(item.sector, []);
    grouped.get(item.sector).push(item);
  }
  return [...grouped.entries()].map(([sector, items]) => {
    const change = avg(items.map((item) => item.preMarketChange || 0));
    const rv = avg(items.map((item) => item.relativeVolume || item.volumeRatio || 1));
    const leaders = [...items].sort((a, b) => b.preMarketChange - a.preMarketChange).slice(0, 3).map((item) => item.symbol).join(" / ");
    return {
      sector,
      score: clamp(Math.round(50 + change * 9 + Math.min(rv, 3) * 8 + sectorThemeBonus(sector))),
      change,
      summary: `${leaders} 领涨，动量与相对成交量共同驱动板块热度。`
    };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
}

function deriveMovers(quotes, news = []) {
  const sourceQuotes = (quotes && quotes.length ? quotes : snapshotQuotes)
    .filter((item) => Number.isFinite(Number(item.preMarketChange ?? item.regularMarketChangePercent)));
  const tickerNews = new Set(news.map((item) => item.ticker).filter(Boolean));
  return [...sourceQuotes].sort((a, b) => {
    const aChange = Number(a.preMarketChange ?? a.regularMarketChangePercent ?? 0);
    const bChange = Number(b.preMarketChange ?? b.regularMarketChangePercent ?? 0);
    return Math.abs(bChange) - Math.abs(aChange);
  }).slice(0, 10).map((item) => {
    const change = Number(item.preMarketChange ?? item.regularMarketChangePercent ?? 0);
    return {
    symbol: item.symbol,
    name: item.name,
    sector: item.sector,
    change,
    reason: tickerNews.has(item.symbol)
      ? "盘前价格异动与新闻催化同步出现。"
      : "价格异动进入盘前扫描，等待开盘量能确认。",
    bias: change >= 0 ? "利好" : "利空"
  };
  });
}

function deriveOptionsProxy(quotes, context = {}) {
  return [...(quotes || [])]
    .map((stock) => calculateOptionsProxyScore(stock, context))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function calculateOptionsProxyScore(stock, context = {}) {
  const sectorMap = new Map((context.sectors || []).map((item) => [item.sector, item]));
  const mentionMap = new Map(context.reddit?.mentions || []);
  const news = context.news || [];
  const sector = stock.sector || "其他";
  const sectorHeat = sectorMap.get(sector)?.score ?? (55 + sectorThemeBonus(sector));
  const preChange = Number(stock.preMarketChangePercent ?? stock.preMarketChange ?? 0);
  const relativeVolume = Number(stock.relativeVolume || stock.volumeRatio || 1);
  const mentions = Number(mentionMap.get(stock.symbol) || 0);
  const newsBias = news.find((item) => item.ticker === stock.symbol)?.bias || "NEUTRAL";
  const aiBonus = /AI|半导体|软件|加密|高 beta/.test(sector) ? 10 : 0;
  const score = clamp(Math.round(
    Math.min(Math.abs(preChange), 6) * 7 +
    Math.min(relativeVolume, 3) * 12 +
    sectorHeat * 0.22 +
    (newsBias === "BULLISH" ? 14 : newsBias === "BEARISH" ? 8 : 6) +
    Math.min(mentions, 15) * 1.5 +
    aiBonus
  ));
  const conviction = classifyFlowConviction(score, preChange, newsBias, relativeVolume);
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector,
    score,
    conviction,
    direction: conviction,
    type: conviction,
    summary: flowProxySummary(stock, conviction),
    risk: conviction === "HIGH CONVICTION"
      ? "风险：需观察开盘后量能延续。"
      : conviction === "RISKY"
        ? "风险：波动扩大，避免无确认追单。"
        : "风险：等待价格与成交量确认。"
  };
}

function classifyFlowConviction(score, change, newsBias, relativeVolume) {
  if (score >= 82 && change > 0 && relativeVolume >= 1.4 && newsBias !== "BEARISH") return "HIGH CONVICTION";
  if (score >= 68 && change > 0) return "MOMENTUM";
  if (newsBias === "BEARISH" || change < -1.5) return "RISKY";
  if (score >= 50) return "WATCHLIST";
  return "LOW QUALITY";
}

function flowProxySummary(stock, conviction) {
  if (conviction === "HIGH CONVICTION") return `${stock.sector}继续获得资金回流，盘前强势结构确认。`;
  if (conviction === "MOMENTUM") return `${stock.sector}动量保持活跃，适合等待开盘确认。`;
  if (conviction === "RISKY") return `${stock.sector}出现波动或负面催化，谨慎处理追单。`;
  if (conviction === "WATCHLIST") return `${stock.sector}进入观察池，但攻击方向尚未完全确认。`;
  return "动量、成交量与催化不足，交易质量偏低。";
}

function calculateRiskRegime(indices) {
  const byId = Object.fromEntries((indices || []).map((item) => [item.id, item]));
  const qqq = byId.QQQ?.change || byId.NDX?.change || 0;
  const vix = byId.VIX?.change || 0;
  const dxy = byId.DXY?.change || 0;
  const tnx = byId.TNX?.change || 0;
  if (qqq > 0 && vix < 0 && dxy <= 0.15 && Math.abs(tnx) < 1.2) return { mode: "Risk-On", score: 72 };
  if (vix > 0 && dxy > 0 && tnx > 0 && qqq < 0) return { mode: "Risk-Off", score: 34 };
  const score = clamp(Math.round(50 + qqq * 10 - vix * 4 - Math.max(0, dxy) * 4 - Math.max(0, tnx) * 2));
  return { mode: score >= 56 ? "Risk-On" : score <= 44 ? "Risk-Off" : "Neutral", score };
}

export async function buildSnapshot(req) {
  const generatedAt = Date.now();
  const defaultSymbols = "SPY,QQQ,NVDA,AMD,AVGO,MRVL,MSFT,AMZN,META,TSLA,PLTR,ORCL,CRWD,COIN,MSTR,DASH,CSCO,LLY,AAPL";
  const symbols = cleanSymbols(req?.query?.symbols || defaultSymbols);
  const yahoo = await settleSource("yahoo", () => loadMarketData(symbols), generatedAt, { indices: snapshotIndices, quotes: snapshotQuotes });
  const [reddit, tradingView, newsSource] = await Promise.all([
    settleSource("reddit", loadReddit, generatedAt, { score: 58, tone: "中性", mentions: [["NVDA", 8], ["TSLA", 6], ["AMD", 5]], summary: "SNAPSHOT：散户关注集中在 AI 与高 beta。" }),
    settleSource("tradingView", loadTradingView, generatedAt, []),
    settleSource("benzinga", loadYahooNews, generatedAt, snapshotNews, "Yahoo Finance News")
  ]);

  const quotes = yahoo.data?.quotes?.length ? yahoo.data.quotes : snapshotQuotes;
  const news = Array.isArray(newsSource.data) && newsSource.data.length ? newsSource.data : snapshotNews;
  const sectorData = deriveSectors(quotes);
  const moverData = deriveMovers(quotes, news);
  const optionProxyData = deriveOptionsProxy(quotes, { sectors: sectorData, tradingView: tradingView.data || [], reddit: reddit.data || {}, news });
  const riskRegime = calculateRiskRegime(yahoo.data?.indices || snapshotIndices);

  const finviz = keepLastGood("finviz", source("finviz", sectorData, "proxy", generatedAt, "Sector Heat Proxy"));
  const benzinga = keepLastGood("benzinga", source("benzinga", { movers: moverData.length ? moverData : deriveMovers(snapshotQuotes, news), news }, "proxy", generatedAt, "News Catalyst Proxy"));
  const unusualWhales = keepLastGood("unusualWhales", source("unusualWhales", optionProxyData, "proxy", generatedAt, "Options Flow Proxy"));
  const xMacro = source("xMacro", [
    { source: "Macro Monitor", title: `${riskRegime.mode} 结构监控`, summary: riskRegime.mode === "Risk-On" ? "QQQ、VIX、DXY 与 TNX 组合支持科技风险偏好。" : "宏观变量仍需观察，避免无量追高。", tone: riskRegime.mode === "Risk-Off" ? "bearish" : "bullish" }
  ], "proxy", generatedAt, "Macro Risk Proxy");

  const snapshot = {
    generatedAt,
    riskRegime,
    sources: {
      yahoo,
      reddit,
      tradingView,
      xMacro,
      finviz,
      unusualWhales,
      benzinga
    }
  };
  lastGoodSnapshot = snapshot;
  return snapshot;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function avg(values) {
  return values.reduce((sum, item) => sum + (Number(item) || 0), 0) / Math.max(1, values.length);
}

function sectorThemeBonus(sector) {
  if (/AI 半导体|AI 软件|AI 服务器|云计算|加密资产|大型科技|高 beta/.test(sector)) return 12;
  if (/医疗|能源|金融/.test(sector)) return -3;
  return 0;
}

export default async function handler(req, res) {
  try {
    noStoreJson(res, 200, await buildSnapshot(req));
  } catch (error) {
    if (lastGoodSnapshot) {
      noStoreJson(res, 200, { ...lastGoodSnapshot, servedFrom: "last-success", error: error.message });
      return;
    }
    noStoreJson(res, 200, {
      generatedAt: Date.now(),
      servedFrom: "emergency-snapshot",
      error: error.message,
      sources: {
        yahoo: fallbackSource("yahoo", { indices: snapshotIndices, quotes: snapshotQuotes }),
        reddit: fallbackSource("reddit", { score: 58, tone: "中性", mentions: [["NVDA", 8], ["TSLA", 6]], summary: "SNAPSHOT：散户关注集中在 AI 与高 beta。" }),
        tradingView: fallbackSource("tradingView", []),
        xMacro: fallbackSource("xMacro", []),
        finviz: fallbackSource("finviz", deriveSectors(snapshotQuotes)),
        unusualWhales: fallbackSource("unusualWhales", deriveOptionsProxy(snapshotQuotes, { sectors: deriveSectors(snapshotQuotes), reddit: {}, news: [] })),
        benzinga: fallbackSource("benzinga", { movers: deriveMovers(snapshotQuotes, snapshotNews), news: snapshotNews })
      }
    });
  }
}
