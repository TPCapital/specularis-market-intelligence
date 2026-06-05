import { Redis } from "@upstash/redis";

const TRUMP_TRADES_KEY = "narrative:trump_trades";

function emptyTrumpTrades(status = "miss", error = null) {
  return {
    status,
    key: TRUMP_TRADES_KEY,
    tracking: [],
    insiderBuying: [],
    policyWeights: {},
    updatedAt: null,
    error
  };
}

function redisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function parseCachedPayload(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return JSON.parse(raw);
  return raw;
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeWeights(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, weight]) => [key, Number(weight)])
      .filter(([, weight]) => Number.isFinite(weight))
  );
}

async function loadTrumpTrades() {
  if (!redisConfigured()) {
    return emptyTrumpTrades("unconfigured", "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing");
  }

  try {
    const redis = Redis.fromEnv();
    const cached = parseCachedPayload(await redis.get(TRUMP_TRADES_KEY));
    if (!cached) return emptyTrumpTrades("miss");

    return {
      status: "hit",
      key: TRUMP_TRADES_KEY,
      tracking: normalizeList(cached.tracking || cached.trades || cached.items),
      insiderBuying: normalizeList(cached.insiderBuying || cached.insider_buying || cached.insiders),
      policyWeights: normalizeWeights(cached.policyWeights || cached.policy_weights),
      updatedAt: cached.updatedAt || cached.updated_at || null,
      error: null
    };
  } catch (error) {
    return emptyTrumpTrades("error", error?.message || "failed_to_read_upstash_cache");
  }
}

function policyTilt(policyWeights = {}) {
  const entries = Object.entries(policyWeights).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (!entries.length) return { bias: "NEUTRAL", topPolicies: [], score: 0 };

  const score = entries.reduce((sum, [, value]) => sum + value, 0);
  const bias = score > 0.2 ? "BULLISH" : score < -0.2 ? "BEARISH" : "NEUTRAL";
  return {
    bias,
    topPolicies: entries.slice(0, 5).map(([policy, weight]) => ({ policy, weight })),
    score: Number(score.toFixed(2))
  };
}

function topSymbolsFromFlows(trumpTrades = {}) {
  const rows = [...(trumpTrades.tracking || []), ...(trumpTrades.insiderBuying || [])];
  const scores = new Map();

  for (const row of rows) {
    const symbol = row.symbol || row.ticker;
    if (!symbol) continue;
    const direction = String(row.side || row.action || row.sentiment || "").toUpperCase();
    const notional = Number(row.notional || row.value || row.transactionValue || row.amount || 0);
    const signedScore = direction.includes("SELL") || direction.includes("BEAR")
      ? -Math.max(1, notional)
      : Math.max(1, notional);
    scores.set(symbol, (scores.get(symbol) || 0) + signedScore);
  }

  return [...scores.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 8)
    .map(([symbol, score]) => ({
      symbol,
      bias: score > 0 ? "BULLISH" : score < 0 ? "BEARISH" : "NEUTRAL",
      flowScore: Number(score.toFixed(2))
    }));
}

export async function buildNarrativeReport({
  macroReport = {},
  marketRegime = {},
  strategySummary = {},
  confidenceScore = {},
  generatedAt = Date.now()
} = {}) {
  const startedAt = Date.now();
  const trumpTrades = await loadTrumpTrades();
  const tilt = policyTilt(trumpTrades.policyWeights);
  const politicalFlowSymbols = topSymbolsFromFlows(trumpTrades);

  const baseBias = strategySummary.bias || macroReport.bias || marketRegime.type || "NEUTRAL";
  const blendedBias = tilt.bias === "NEUTRAL" ? baseBias : tilt.bias;
  const hasPoliticalFlow = trumpTrades.status === "hit" && (
    trumpTrades.tracking.length ||
    trumpTrades.insiderBuying.length ||
    Object.keys(trumpTrades.policyWeights).length
  );

  return {
    status: hasPoliticalFlow ? "cached" : "fallback",
    source: "Narrative Engine + Upstash Political Flow Cache",
    cacheKey: TRUMP_TRADES_KEY,
    timestamp: new Date(generatedAt).toISOString(),
    latency: Date.now() - startedAt,
    confidence: hasPoliticalFlow ? (confidenceScore.tradeConfidence || "MEDIUM") : "LOW",
    bias: blendedBias,
    headline: hasPoliticalFlow
      ? `宏观叙事叠加 Trump Trades 政策流，当前偏向 ${blendedBias}。`
      : strategySummary.headline || "宏观叙事保持基础风险框架，政治流缓存暂无有效数据。",
    summary: hasPoliticalFlow
      ? `政策权重 ${tilt.score}，重点观察 ${politicalFlowSymbols.map((item) => item.symbol).join(" / ") || "宏观敏感板块"} 与指数方向是否共振。`
      : macroReport.summary || strategySummary.summary || "政治流追踪为空，维持原宏观与市场结构判断。",
    macro: macroReport,
    marketRegime,
    politicalFlow: {
      trumpTrades,
      policyTilt: tilt,
      symbols: politicalFlowSymbols
    },
    risks: [
      ...(strategySummary.risks || []),
      ...(tilt.bias === "BEARISH" ? ["政策流偏防御，避免追高高 beta 标的。"] : [])
    ].slice(0, 8),
    opportunities: [
      ...(strategySummary.focusSymbols || []),
      ...politicalFlowSymbols.filter((item) => item.bias === "BULLISH").map((item) => item.symbol)
    ].filter(Boolean).slice(0, 10),
    fallback: !hasPoliticalFlow,
    error: trumpTrades.error
  };
}
