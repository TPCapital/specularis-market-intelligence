/**
 * Narrative Engine
 * ────────────────
 * Converts raw signals into structured market narratives.
 * Implements "强化叙事逻辑生成" from the architecture document.
 *
 * Output: human-readable, trading-relevant summaries that link
 * political insider signals → macro policy → sector positioning → stock-level conviction.
 */

const SECTOR_POLICY_MAP = {
  "AI 半导体": "AI 国家竞争战略 + 数据中心资本支出超周期",
  "AI 软件": "企业 AI 渗透率提升 + 政府数字化采购加速",
  "国防": "NATO 承诺 + 国防预算扩张 + 供应链重组",
  "核能": "清洁能源立法 + 数据中心能耗需求 + 去碳化政策",
  "加密资产": "监管明确化预期 + 机构配置扩张",
  "大型科技": "AI 超级周期持续 + 企业资本支出转移",
  "云计算": "企业 AI 改造浪潮 + 公有云基础设施需求",
  "能源": "能源主权战略 + 战略储备采购",
  "金融": "去监管化预期 + 利差环境改善",
  "医疗": "GLP-1 超级周期 + 医疗创新加速"
};

const REGIME_NARRATIVE = {
  TREND_DAY: "趋势延续日：市场宽度扩张，主线资金持续流入。优先顺势，无需等待回踩。",
  RISK_ON: "风险偏好开启：指数正向，量能尚可。早盘突破 VWAP 可追，控制单笔仓位。",
  RISK_OFF: "风险规避：VIX 主导，下跌放量。仅做防御性标的，等待 VIX 稳定。",
  SQUEEZE: "空头回补：做空盘被迫平仓推升，跟随强势突破但警惕快速反转。",
  CHOP: "震荡格局：方向不明，成交量收缩。严控仓位，等待开盘方向确认。",
  GAP_FADE: "高开回落风险：跳空后承接不足，避免追高，优先等待回踩支撑。",
  NEUTRAL: "中性等待：无明显方向偏好。以观察为主，等待量能共振。"
};

function safeStr(val) {
  return typeof val === "string" ? val : String(val || "");
}

function clamp(v, min = 0, max = 100) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

/**
 * Core narrative builder: links political trades + market regime + sector flow
 */
export function buildNarrativeEngine({
  marketRegime = {},
  strategySummary = {},
  politicalTrades = {},
  sectorFlows = [],
  premarketMomentum = {},
  confidenceScore = {},
  indices = []
} = {}) {
  const regime = marketRegime.type || "NEUTRAL";
  const regimeText = REGIME_NARRATIVE[regime] || REGIME_NARRATIVE.NEUTRAL;

  // Extract political signals
  const polSignals = politicalTrades?.signals || [];
  const polBullish = politicalTrades?.bullishTickers || [];
  const polBearish = politicalTrades?.bearishTickers || [];
  const hasPolData = polSignals.length > 0;

  // Identify sector resonance: political buys × hot sectors
  const hotSectors = (sectorFlows || [])
    .filter((s) => (s.score || 0) >= 70)
    .map((s) => s.sector);

  const resonanceMap = new Map(); // ticker → { polWeight, sectorScore, policyTheme }
  for (const sig of polSignals.filter((s) => s.action === "BUY")) {
    const sectorHit = hotSectors.find((sec) =>
      (sig.description || "").toLowerCase().includes(sec.toLowerCase()) ||
      ["NVDA", "AMD", "AVGO", "MRVL"].includes(sig.ticker) && sec.includes("AI") ||
      ["LMT", "RTX", "NOC", "GD"].includes(sig.ticker) && sec.includes("国防") ||
      ["SMR", "OKLO", "NNE"].includes(sig.ticker) && sec.includes("核能")
    );
    if (sectorHit) {
      resonanceMap.set(sig.ticker, {
        polWeight: sig.signalWeight || 0.5,
        sectorScore: (sectorFlows.find((f) => f.sector === sectorHit)?.score || 70),
        policyTheme: SECTOR_POLICY_MAP[sectorHit] || sectorHit
      });
    }
  }
  const resonanceItems = [...resonanceMap.entries()]
    .sort((a, b) => (b[1].polWeight + b[1].sectorScore / 100) - (a[1].polWeight + a[1].sectorScore / 100))
    .slice(0, 4);

  // Build confidence boost signals
  const boostedTickers = resonanceItems.map(([ticker]) => ticker);

  // Momentum leaders
  const momentumLeaders = (premarketMomentum?.data?.leaders || premarketMomentum?.leaders || [])
    .slice(0, 4)
    .map((l) => l.symbol || l.ticker)
    .filter(Boolean);

  // Composite headline
  const headline = buildHeadline(regime, resonanceItems, momentumLeaders, confidenceScore);

  // Full narrative text
  const narrativeBlocks = [];

  // Block 1: Regime
  narrativeBlocks.push(`【市场状态】${regimeText}`);

  // Block 2: Political resonance (if available)
  if (resonanceItems.length) {
    const resonanceLine = resonanceItems
      .map(([t, data]) => `${t}（${data.policyTheme}）`)
      .join(" / ");
    narrativeBlocks.push(
      `【政策共振】内部人士买入与热门板块同时指向：${resonanceLine}。` +
      `微观知情交易与宏观政策叙事叠加，视为高价值复合信号。`
    );
  } else if (hasPolData) {
    narrativeBlocks.push(
      `【政治交易监控】检测到国会内部人士持仓动向：` +
      `增持标的 ${polBullish.slice(0, 3).join(" / ") || "待分析"}，` +
      (polBearish.length ? `减持标的 ${polBearish.slice(0, 2).join(" / ")}，` : "") +
      `当前与热门板块无直接共振，仅作辅助参考。`
    );
  }

  // Block 3: Momentum confirmation
  if (momentumLeaders.length) {
    narrativeBlocks.push(
      `【动能确认】盘前动能龙头：${momentumLeaders.join(" / ")}。` +
      `等待 VWAP 与开盘量能共振后方可进攻，禁止无量追涨。`
    );
  }

  // Block 4: Risk discipline
  const riskLine = buildRiskDiscipline(regime, confidenceScore);
  narrativeBlocks.push(`【执行纪律】${riskLine}`);

  return {
    headline,
    narrative: narrativeBlocks.join(" \n\n"),
    blocks: narrativeBlocks,
    regime,
    boostedTickers,
    resonanceItems: resonanceItems.map(([ticker, data]) => ({ ticker, ...data })),
    politicalSignals: {
      bullish: polBullish,
      bearish: polBearish,
      hasData: hasPolData,
      source: politicalTrades?.source || "Political Insider Layer"
    },
    confidenceBoost: boostedTickers.length > 0,
    dataQuality: resolveNarrativeQuality(marketRegime, politicalTrades, confidenceScore)
  };
}

function buildHeadline(regime, resonanceItems, momentumLeaders, confidenceScore) {
  const conf = confidenceScore?.tradeConfidence || confidenceScore?.signalConfidence || "MEDIUM";
  if (resonanceItems.length >= 2) {
    const tickers = resonanceItems.slice(0, 2).map(([t]) => t).join(" + ");
    return `政策共振 × 市场动能 → ${tickers} 高置信叠加`;
  }
  if (resonanceItems.length === 1) {
    const [[ticker]] = resonanceItems;
    return `政策信号 → ${ticker} 知情买入 + 板块热度共振`;
  }
  if (momentumLeaders.length) {
    return `动能驱动 → ${momentumLeaders[0]} 盘前领涨，等待开盘确认`;
  }
  const regimeLabels = {
    TREND_DAY: "趋势延续 → 顺势为主",
    RISK_ON: "风险开启 → 早盘突破优先",
    RISK_OFF: "风险规避 → 防御等待",
    CHOP: "震荡格局 → 控仓观察",
    NEUTRAL: "中性 → 等待方向确认"
  };
  return regimeLabels[regime] || "等待盘前数据同步";
}

function buildRiskDiscipline(regime, confidenceScore) {
  const conf = confidenceScore?.tradeConfidence || "MEDIUM";
  const base = "单笔风险 ≤ 账户 1-2%。禁止补仓摊平亏损标的。";
  if (regime === "CHOP" || conf === "LOW") {
    return base + " 当前格局不明，建议半仓以下运作，优先保护资本。";
  }
  if (regime === "RISK_OFF") {
    return base + " 风险规避格局下，任何进攻仓位需要双重确认（量 + 价）才能建立。";
  }
  if (regime === "TREND_DAY") {
    return base + " 趋势日可适度放宽追入空间，但破开盘区间必须止损。";
  }
  return base + " 等待 VWAP 站稳与相对成交量确认，不追无量突破。";
}

function resolveNarrativeQuality(regime = {}, polTrades = {}, conf = {}) {
  if (regime.type && ["live", "delayed"].includes(regime.tradable ? "live" : "snapshot")) return "delayed";
  if (polTrades?.status === "delayed") return "delayed";
  if (conf?.score >= 60) return "proxy";
  return "snapshot";
}
