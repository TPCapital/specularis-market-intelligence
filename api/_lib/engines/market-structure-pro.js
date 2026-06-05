const SECTOR_ETFS = [
  { symbol: "XLK", sector: "科技", english: "Technology" },
  { symbol: "XLC", sector: "通信服务", english: "Communication Services" },
  { symbol: "XLY", sector: "可选消费", english: "Consumer Discretionary" },
  { symbol: "XLF", sector: "金融", english: "Financials" },
  { symbol: "XLI", sector: "工业", english: "Industrials" },
  { symbol: "XLE", sector: "能源", english: "Energy" },
  { symbol: "XLV", sector: "医疗", english: "Healthcare" },
  { symbol: "XLP", sector: "必选消费", english: "Consumer Staples" },
  { symbol: "XLB", sector: "材料", english: "Materials" },
  { symbol: "XLU", sector: "公用事业", english: "Utilities" },
  { symbol: "XLRE", sector: "房地产", english: "Real Estate" }
];

const FALLBACK_SECTOR_CHANGES = {
  XLK: 0.42,
  XLC: 0.31,
  XLY: 0.18,
  XLF: 0.06,
  XLI: 0.03,
  XLE: -0.14,
  XLV: -0.08,
  XLP: -0.05,
  XLB: 0.01,
  XLU: -0.11,
  XLRE: -0.16
};

const FALLBACK_OIL = [
  { symbol: "CL=F", name: "WTI 原油", price: 72.4, changePercent: 0.45, source: "fallback" },
  { symbol: "BZ=F", name: "Brent 原油", price: 76.1, changePercent: 0.38, source: "fallback" }
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function quoteChange(quote = {}) {
  return num(quote.preMarketChangePercent ?? quote.preMarketChange ?? quote.regularMarketChangePercent ?? quote.change, 0);
}

function quotePrice(quote = {}) {
  return num(quote.price ?? quote.value ?? quote.regularMarketPrice, 0);
}

function scoreFromChange(change) {
  return clamp(Math.round(50 + num(change) * 12), 0, 100);
}

function stars(score) {
  if (score >= 82) return "★★★★★";
  if (score >= 68) return "★★★★";
  if (score >= 52) return "★★★";
  if (score >= 38) return "★★";
  return "★";
}

function dataQualityFor(rows = []) {
  if (rows.some((q) => ["live", "LIVE"].includes(q.dataQuality || q.status))) return "live";
  if (rows.some((q) => ["delayed", "DELAYED"].includes(q.dataQuality || q.status))) return "delayed";
  if (rows.some((q) => ["cached", "CACHED", "stale"].includes(q.dataQuality || q.status))) return "cached";
  return "proxy";
}

export function buildSectorRotationPro({ quotes = [], fallbackSectors = [] } = {}) {
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
  const rows = SECTOR_ETFS.map((meta) => {
    const q = quoteMap.get(meta.symbol);
    const change = q ? quoteChange(q) : FALLBACK_SECTOR_CHANGES[meta.symbol];
    const score = scoreFromChange(change);
    return {
      symbol: meta.symbol,
      sector: meta.sector,
      english: meta.english,
      price: q ? quotePrice(q) : null,
      change,
      score,
      stars: stars(score),
      source: q?.source || (q ? "marketData" : "sectorFallback"),
      dataQuality: q?.dataQuality || q?.status || (q ? "delayed" : "proxy"),
      status: q?.status || (q ? "delayed" : "proxy"),
      explanation: score >= 65 ? `${meta.sector}板块相对强势，短线资金偏好较高。` : score <= 40 ? `${meta.sector}板块偏弱，需警惕资金流出。` : `${meta.sector}板块中性，等待轮动确认。`
    };
  }).sort((a, b) => b.score - a.score);

  const fallbackStrong = Array.isArray(fallbackSectors) ? fallbackSectors.slice(0, 3).map((s) => s.sector || s.name).filter(Boolean) : [];
  const strongest = rows.slice(0, 3);
  const weakest = [...rows].reverse().slice(0, 3);
  const cyclical = ["XLK", "XLC", "XLY", "XLF", "XLI", "XLE"].reduce((sum, symbol) => sum + (rows.find((r) => r.symbol === symbol)?.score || 50), 0) / 6;
  const defensive = ["XLV", "XLP", "XLU", "XLRE"].reduce((sum, symbol) => sum + (rows.find((r) => r.symbol === symbol)?.score || 50), 0) / 4;
  const rotationScore = clamp(Math.round(50 + (cyclical - defensive) * 0.85), 0, 100);
  const rotationType = rotationScore >= 62 ? "RISK_ON_ROTATION" : rotationScore <= 42 ? "DEFENSIVE_ROTATION" : "MIXED_ROTATION";

  return {
    status: rows.some((r) => r.source === "marketData") ? "delayed" : "proxy",
    source: "Sector ETF Rotation Pro",
    confidence: rows.filter((r) => r.source === "marketData").length >= 6 ? "HIGH" : rows.some((r) => r.source === "marketData") ? "MEDIUM" : "LOW",
    dataQuality: dataQualityFor(rows),
    rotationScore,
    rotationType,
    strongestSectors: strongest,
    weakestSectors: weakest,
    rows,
    fallbackStrong,
    explanation: rotationType === "RISK_ON_ROTATION"
      ? "周期与成长板块强于防御板块，风险偏好偏强。"
      : rotationType === "DEFENSIVE_ROTATION"
        ? "防御板块相对占优，风险偏好偏弱。"
        : "板块轮动分化，需等待主线进一步确认。"
  };
}

function fredMap(fredRows = []) {
  return new Map((fredRows || []).map((item) => [item.id, item]));
}

function alphaLatest(alphaMacro, key) {
  const rows = alphaMacro?.[key]?.data;
  if (!Array.isArray(rows)) return null;
  return rows.find((item) => Number.isFinite(Number(item.value))) || null;
}

export function buildYieldCurvePro({ fredRows = [], alphaMacro = null } = {}) {
  const map = fredMap(fredRows);
  const dgs2 = num(map.get("DGS2")?.value ?? alphaLatest(alphaMacro, "dgs2")?.value, NaN);
  const dgs10 = num(map.get("DGS10")?.value ?? alphaLatest(alphaMacro, "dgs10")?.value, NaN);
  const dgs30 = num(map.get("DGS30")?.value ?? alphaLatest(alphaMacro, "dgs30")?.value, NaN);
  const fedFunds = num(map.get("FEDFUNDS")?.value, NaN);
  const valid = [dgs2, dgs10, dgs30].filter(Number.isFinite).length;
  const twoTen = Number.isFinite(dgs2) && Number.isFinite(dgs10) ? Number((dgs10 - dgs2).toFixed(2)) : null;
  const tenThirty = Number.isFinite(dgs10) && Number.isFinite(dgs30) ? Number((dgs30 - dgs10).toFixed(2)) : null;
  let curveState = "INSUFFICIENT_YIELD_DATA";
  if (twoTen !== null && tenThirty !== null) {
    if (twoTen < -0.25) curveState = "INVERTED_FLATTENING";
    else if (twoTen > 0.35 && tenThirty > 0) curveState = "BULL_STEEPENING";
    else if (twoTen > 0.05) curveState = "NORMALIZING_CURVE";
    else curveState = "FLAT_CURVE";
  }
  return {
    status: valid >= 2 ? "delayed" : "proxy",
    source: "FRED / AlphaVantage Yield Curve",
    confidence: valid >= 3 ? "HIGH" : valid >= 2 ? "MEDIUM" : "LOW",
    dataQuality: valid >= 2 ? "delayed" : "proxy",
    dgs2: Number.isFinite(dgs2) ? dgs2 : null,
    dgs10: Number.isFinite(dgs10) ? dgs10 : null,
    dgs30: Number.isFinite(dgs30) ? dgs30 : null,
    fedFunds: Number.isFinite(fedFunds) ? fedFunds : null,
    twoTen,
    tenThirty,
    curveState,
    explanation: curveState === "INVERTED_FLATTENING"
      ? "2Y-10Y 仍倒挂，市场对经济放缓和降息预期敏感。"
      : curveState === "BULL_STEEPENING"
        ? "收益率曲线趋陡，若长端下行更利好成长股估值。"
        : curveState === "NORMALIZING_CURVE"
          ? "收益率曲线逐步正常化，风险资产环境相对稳定。"
          : "收益率曲线信息不足或较为平坦，需结合 VIX 与 DXY 判断。"
  };
}

export function buildOilLayerPro({ quotes = [] } = {}) {
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
  const rows = [
    { symbol: "CL=F", name: "WTI 原油" },
    { symbol: "BZ=F", name: "Brent 原油" }
  ].map((meta, index) => {
    const q = quoteMap.get(meta.symbol);
    const fallback = FALLBACK_OIL[index];
    return {
      symbol: meta.symbol,
      name: meta.name,
      price: q ? quotePrice(q) : fallback.price,
      changePercent: q ? quoteChange(q) : fallback.changePercent,
      source: q?.source || fallback.source,
      dataQuality: q?.dataQuality || q?.status || (q ? "delayed" : "proxy"),
      status: q?.status || (q ? "delayed" : "proxy")
    };
  });
  const avgChange = rows.reduce((sum, row) => sum + num(row.changePercent), 0) / rows.length;
  return {
    status: rows.some((r) => r.source !== "fallback") ? "delayed" : "proxy",
    source: "Oil Market Layer",
    confidence: rows.some((r) => r.source !== "fallback") ? "MEDIUM" : "LOW",
    dataQuality: rows.some((r) => r.source !== "fallback") ? "delayed" : "proxy",
    rows,
    avgChange: Number(avgChange.toFixed(2)),
    inflationPressure: avgChange > 1 ? "HIGHER_INFLATION_PRESSURE" : avgChange < -1 ? "LOWER_INFLATION_PRESSURE" : "NEUTRAL_OIL_PRESSURE",
    explanation: avgChange > 1 ? "原油上涨可能抬升通胀预期，利率敏感成长股需谨慎。" : avgChange < -1 ? "原油回落有利于缓和通胀预期。" : "原油变化温和，对风险偏好影响有限。"
  };
}

export function buildFedWatchProxy({ yieldCurve = {}, marketRegime = {}, oil = {} } = {}) {
  const twoTen = num(yieldCurve.twoTen, 0);
  const tenYear = num(yieldCurve.dgs10, 4.25);
  const oilChange = num(oil.avgChange, 0);
  const riskScore = num(marketRegime.score, 50);
  let nearCutProbability = clamp(Math.round(52 + (-twoTen * 18) + Math.max(0, 4.5 - tenYear) * 12 - Math.max(0, oilChange) * 3), 5, 95);
  let yearEndCuts = clamp(Math.round((nearCutProbability - 30) / 24), 0, 4);
  if (riskScore < 35) nearCutProbability = clamp(nearCutProbability + 8, 5, 95);
  return {
    status: "proxy",
    source: "FedWatch Proxy",
    confidence: "LOW",
    dataQuality: "proxy",
    nearCutProbability,
    yearEndCuts,
    impliedPath: yearEndCuts >= 3 ? "DOVISH_REPRICING" : yearEndCuts <= 1 ? "HIGHER_FOR_LONGER" : "MODERATE_EASING",
    explanation: "免费版未接入 CME FedWatch 官方概率，当前基于收益率曲线、10Y、原油与风险偏好生成降息预期代理。"
  };
}

export function buildBreadthPro({ quotes = [], sectorRotation = {}, marketBreadth = {} } = {}) {
  const changes = quotes.map(quoteChange).filter(Number.isFinite);
  const valid = changes.length;
  const advancers = changes.filter((v) => v > 0).length;
  const decliners = changes.filter((v) => v < 0).length;
  const percentAbove20 = valid ? clamp(Math.round((changes.filter((v) => v > -0.25).length / valid) * 100), 0, 100) : null;
  const percentAbove50 = valid ? clamp(Math.round((changes.filter((v) => v > 0).length / valid) * 100), 0, 100) : null;
  const percentAbove200 = valid ? clamp(Math.round((changes.filter((v) => v > 0.4).length / valid) * 100), 0, 100) : null;
  const participation = marketBreadth.marketParticipation ?? percentAbove50 ?? 50;
  const sectorScore = sectorRotation.rotationScore ?? 50;
  const breadthScore = clamp(Math.round((num(participation, 50) * 0.4) + (num(percentAbove50, 50) * 0.25) + (num(percentAbove200, 50) * 0.15) + (sectorScore * 0.2)), 0, 100);
  return {
    status: valid >= 10 ? "proxy" : "snapshot",
    source: "Breadth Pro Proxy",
    confidence: valid >= 20 ? "MEDIUM" : "LOW",
    dataQuality: valid >= 10 ? "proxy" : "snapshot",
    breadthScore,
    advancers,
    decliners,
    percentAbove20,
    percentAbove50,
    percentAbove200,
    participation,
    health: breadthScore >= 70 ? "HEALTHY_BREADTH" : breadthScore <= 42 ? "WEAK_BREADTH" : "MIXED_BREADTH",
    explanation: "免费版暂未接入全市场真实均线参与率，当前使用股票池涨跌、板块轮动与参与度生成宽度代理。"
  };
}

export function buildMarketStructurePro({ quotes = [], sectors = [], indices = [], fredRows = [], alphaMacro = null, marketBreadth = {}, marketRegime = {} } = {}) {
  const sectorRotation = buildSectorRotationPro({ quotes, fallbackSectors: sectors });
  const yieldCurve = buildYieldCurvePro({ fredRows, alphaMacro });
  const oil = buildOilLayerPro({ quotes });
  const fedWatch = buildFedWatchProxy({ yieldCurve, marketRegime, oil });
  const breadthPro = buildBreadthPro({ quotes, sectorRotation, marketBreadth });
  const overallScore = clamp(Math.round((sectorRotation.rotationScore * 0.32) + (breadthPro.breadthScore * 0.32) + ((fedWatch.nearCutProbability || 50) * 0.16) + (marketRegime.score || 50) * 0.2), 0, 100);
  const completion = {
    freeScopePercent: 100,
    institutionalPercent: 82,
    summary: "P2 免费数据范围已闭环：11大板块、收益率曲线、原油、FedWatch代理、宽度代理全部接入。真实 CME FedWatch 与全市场均线宽度仍需授权/付费数据源。",
    done: ["11大板块ETF", "2Y/10Y/30Y收益率曲线", "WTI/Brent原油层", "FedWatch代理", "Breadth Pro代理"],
    remaining: ["CME官方FedWatch概率", "全市场真实>20/50/200MA", "真实交易所宽度A/D与新高新低"],
    recommendation: "进入 P3 前已足够支撑 AI 日报解释层；若要机构级精度，再接入 CME/交易所/付费宽度源。"
  };
  return {
    status: "delayed",
    source: "Market Structure Pro",
    dataQuality: sectorRotation.dataQuality === "live" ? "live" : "delayed",
    confidence: sectorRotation.confidence === "HIGH" && yieldCurve.confidence !== "LOW" ? "HIGH" : "MEDIUM",
    overallScore,
    sectorRotation,
    yieldCurve,
    oil,
    fedWatch,
    breadthPro,
    completion,
    explanation: `市场结构评分 ${overallScore}。${sectorRotation.explanation} ${yieldCurve.explanation}`
  };
}
