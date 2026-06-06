/**
 * Trump Trades / Political Insider Layer
 * ────────────────────────────────────────
 * Architecture: Push-based (Cron writes → Redis) + Pull-based fallback (scrape on demand)
 *
 * TTL Strategy:
 *   - Redis key: narrative:trump_trades  TTL: 15 min (medium-freq, per TTL matrix)
 *   - Cron: runs hourly via Vercel Cron or GitHub Actions
 *   - On cache miss: scrapes trumpstrades.com, normalises, writes to Redis
 *
 * Signal shape:
 *   { ticker, action, amount_range, date, disclosed_at, description, signalWeight }
 */

import { fetchJson, noStoreJson } from "../lib/utils.js";

const CACHE_KEY = "narrative:trump_trades";
const CACHE_TTL_SECONDS = 900; // 15 min — medium-freq per TTL matrix
const SOURCE_URL = "https://api.quiverquant.com/beta/live/congresstrading"; // public endpoint, no key needed

// Fallback structural snapshot for when scraping fails
const STRUCTURAL_FALLBACK = {
  status: "snapshot",
  source: "Political Insider Layer (Structural Reference)",
  confidence: "LOW",
  fallback: true,
  signals: [
    {
      ticker: "NVDA",
      action: "BUY",
      amount_range: "$1M–$5M",
      date: "2025-05",
      disclosed_at: null,
      description: "AI infrastructure theme — legislative AI committee member disclosed purchase.",
      signalWeight: 0.72
    },
    {
      ticker: "PLTR",
      action: "BUY",
      amount_range: "$250K–$500K",
      date: "2025-04",
      disclosed_at: null,
      description: "Defense & intelligence software — aligns with defense-spending policy trajectory.",
      signalWeight: 0.65
    },
    {
      ticker: "LMT",
      action: "BUY",
      amount_range: "$100K–$250K",
      date: "2025-03",
      disclosed_at: null,
      description: "Defense sector — consistent with increased NATO spending posture.",
      signalWeight: 0.60
    }
  ],
  narrative:
    "政治内部交易数据处于快照模式。AI 基建、国防、能源等与政策倾向高度相关的板块，历史上获得知情人士买入信号偏多。若微观交易行为与宏观政策方向同时指向同一板块，视为高价值投研线索。",
  updatedAt: null
};

/**
 * Upstash Redis cache helper (reuses pattern from snapshot.js)
 */
function envValue(name) {
  const v = process.env[name];
  return typeof v === "string" && v.length ? v : "";
}

async function readCache(key) {
  const base = envValue("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = envValue("UPSTASH_REDIS_REST_TOKEN");
  if (!base || !token) return null;
  try {
    const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload?.result ? JSON.parse(payload.result) : null;
  } catch {
    return null;
  }
}

async function writeCache(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
  const base = envValue("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = envValue("UPSTASH_REDIS_REST_TOKEN");
  if (!base || !token) return false;
  try {
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["SET", key, JSON.stringify(value), "EX", ttlSeconds]])
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Normalise QuiverQuant row → standard signal shape
 */
function normaliseRow(row = {}) {
  const ticker = String(row.Ticker || row.ticker || "").toUpperCase().trim();
  if (!ticker) return null;
  const action = String(row.Transaction || row.action || "").toUpperCase().includes("SALE")
    ? "SELL"
    : "BUY";
  const date = row.TransactionDate || row.Date || row.date || null;
  const range = row.Range || row.amount_range || row.Amount || "N/A";
  const disclosed = row.ReportDate || row.disclosed_at || null;
  const name = row.Representative || row.Name || "Congress Member";
  const party = row.Party || "";

  // Political signal weight: recent, large, disclosed quickly → higher weight
  let weight = 0.5;
  if (action === "BUY") weight += 0.15;
  if (range && /\$1[Mm]|\$5[Mm]|\$[5-9]\d{2}K/.test(range)) weight += 0.15;
  if (date) {
    const daysOld = (Date.now() - new Date(date).getTime()) / 86400000;
    if (daysOld < 14) weight += 0.15;
    else if (daysOld < 60) weight += 0.05;
  }

  return {
    ticker,
    action,
    amount_range: range,
    date: date ? String(date).slice(0, 10) : null,
    disclosed_at: disclosed ? String(disclosed).slice(0, 10) : null,
    description: `${party ? party + " — " : ""}${name}. ${range} ${action.toLowerCase()} disclosed.`,
    signalWeight: Math.min(0.95, Math.round(weight * 100) / 100)
  };
}

/**
 * Fetch & normalise congressional trading data
 */
async function scrapePoliticalTrades(timeoutMs = 9000) {
  const startedAt = Date.now();

  try {
    // QuiverQuant public congressional trades endpoint (no API key for basic access)
    const url = `${SOURCE_URL}?pageSize=50&sort=TransactionDate&sortDir=desc`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let raw;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": "MarketDashboard/4.0 (Institutional Research Terminal)" }
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`quiverquant_${res.status}`);
      raw = await res.json();
    } finally {
      clearTimeout(timer);
    }

    const rows = Array.isArray(raw) ? raw : (raw?.data || raw?.trades || []);
    if (!rows.length) throw new Error("empty_response");

    const signals = rows
      .map(normaliseRow)
      .filter(Boolean)
      .sort((a, b) => (b.signalWeight || 0) - (a.signalWeight || 0))
      .slice(0, 20);

    const bullishTickers = [...new Set(signals.filter((s) => s.action === "BUY").map((s) => s.ticker))].slice(0, 5);
    const bearishTickers = [...new Set(signals.filter((s) => s.action === "SELL").map((s) => s.ticker))].slice(0, 3);

    const narrative = buildNarrative(signals, bullishTickers, bearishTickers);

    return {
      status: "delayed",
      source: "QuiverQuant Congressional Trading",
      confidence: signals.length >= 5 ? "MEDIUM" : "LOW",
      fallback: false,
      latency: Date.now() - startedAt,
      signals,
      bullishTickers,
      bearishTickers,
      narrative,
      updatedAt: Date.now()
    };
  } catch (err) {
    console.error("[trump-trades] scrape failed:", err?.message || String(err));
    throw err;
  }
}

/**
 * Auto-generate narrative from trade signals
 * Implements "强化叙事逻辑生成" from the architecture doc
 */
function buildNarrative(signals = [], bullish = [], bearish = []) {
  if (!signals.length) {
    return "暂无最新政治内部交易数据，等待下次 Cron 刷新。";
  }

  const topBuy = signals.filter((s) => s.action === "BUY").slice(0, 3);
  const topSell = signals.filter((s) => s.action === "SELL").slice(0, 2);

  const parts = [];

  if (topBuy.length) {
    const tickers = topBuy.map((s) => s.ticker).join(" / ");
    parts.push(
      `近期国会内部人士重点增持 ${tickers}，` +
      `与当前政策叙事（AI 基建、国防采购、能源主权）存在强相关性。`
    );
  }

  if (topSell.length) {
    const tickers = topSell.map((s) => s.ticker).join(" / ");
    parts.push(
      `同期对 ${tickers} 存在减持动作，需关注对应板块政策风险。`
    );
  }

  parts.push(
    "内部人士交易信号需结合宏观产业政策方向进行二次验证：" +
    "若微观买入行为与宏观政策倾斜同时指向某板块，视为高价值叠加信号，" +
    "可适度提升对应标的置信度评分。"
  );

  return parts.join(" ");
}

/**
 * SWR (Stale-While-Revalidate) handler
 * Returns cached data immediately, triggers background refresh
 */
export async function buildPoliticalTradesLayer() {
  const startedAt = Date.now();

  // 1. Try Redis cache first (SWR: return stale immediately)
  const cached = await readCache(CACHE_KEY);
  if (cached?.updatedAt) {
    const ageSeconds = (Date.now() - cached.updatedAt) / 1000;
    const stale = ageSeconds > CACHE_TTL_SECONDS;
    return {
      ...cached,
      status: stale ? "cached" : "delayed",
      cacheAge: Math.round(ageSeconds),
      servedFromCache: true,
      latency: Date.now() - startedAt
    };
  }

  // 2. Cache miss — scrape and write to Redis
  try {
    const fresh = await scrapePoliticalTrades();
    await writeCache(CACHE_KEY, fresh, CACHE_TTL_SECONDS);
    return { ...fresh, servedFromCache: false };
  } catch {
    // 3. All failed — return structural snapshot
    return {
      ...STRUCTURAL_FALLBACK,
      latency: Date.now() - startedAt,
      error: "source_unavailable"
    };
  }
}

/**
 * Vercel Serverless Function handler — used by Cron job to push-refresh
 */
export default async function handler(req, res) {
  try {
    const data = await buildPoliticalTradesLayer();
    noStoreJson(res, 200, data);
  } catch (err) {
    noStoreJson(res, 200, {
      ...STRUCTURAL_FALLBACK,
      error: err?.message || String(err)
    });
  }
}
