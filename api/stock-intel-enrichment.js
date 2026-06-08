// api/stock-intel-enrichment.js
// Specularis Market Terminal Lite v1.3.4 — 个股情报增强 API 端点
//
// 调用方式：GET /api/stock-intel-enrichment?tickers=NVDA,AMD,MRVL
// 返回：每个 ticker 的增强数据（分析师/目标价/内部人/期权/新闻）
//
// 这个端点与 /api/snapshot 解耦，可以独立按需调用，避免影响主 snapshot 的 10s 预算
// 建议前端页面加载后异步调用，用 specularis:sipUpdated 事件更新 SIP 卡片

import { enrichStockWatchlist, applyEnrichmentToSipEntry } from "../lib/stock-intel-enricher.js";

const DEFAULT_WATCHLIST = ["MU","MRVL","NVDA","AVGO","AMD","TSM","ASML","PLTR","ORCL","SMCI"];

const COMPANY_META = {
  MU:   { name: "Micron Technology" },
  MRVL: { name: "Marvell Technology" },
  NVDA: { name: "Nvidia" },
  AVGO: { name: "Broadcom" },
  AMD:  { name: "AMD" },
  TSM:  { name: "TSMC" },
  ASML: { name: "ASML Holding" },
  PLTR: { name: "Palantir Technologies" },
  ORCL: { name: "Oracle" },
  SMCI: { name: "Super Micro Computer" },
};

function noStoreJson(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(data);
}

function envValue(name) {
  const v = process.env[name];
  return typeof v === "string" && v.length ? v : "";
}

export default async function handler(req, res) {
  const startedAt = Date.now();

  // 解析 tickers 参数（支持逗号分隔）
  const tickersParam = String(req.query?.tickers || "").toUpperCase().replace(/[^A-Z,]/g, "");
  const tickers = tickersParam
    ? [...new Set(tickersParam.split(",").filter(t => /^[A-Z]{1,6}$/.test(t)))].slice(0, 12)
    : DEFAULT_WATCHLIST;

  try {
    const enrichResults = await enrichStockWatchlist(tickers, {
      finnhubKey: envValue("FINNHUB_API_KEY"),
      companyMeta: COMPANY_META,
      concurrency: 3,
    });

    // 构建结果映射
    const resultMap = {};
    for (const r of enrichResults) {
      resultMap[r.ticker] = {
        ticker: r.ticker,
        enrichment: r.enrichment,
        options: r.options,
        news: r.news,
        enrichedAt: r.enrichedAt,
      };
    }

    noStoreJson(res, 200, {
      status: "ok",
      version: "v1.3.4",
      generatedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      tickers,
      data: resultMap,
      // 数据源说明
      sources: {
        fundamentals: "Yahoo Finance QuoteSummary (unofficial) — 分析师评级/目标价/内部人/财报日期",
        options: "Yahoo Finance Options (unofficial) — P/C比/IV/期权流偏向/Call Wall/Put Wall",
        news: "Google News RSS — 实时新闻标题与摘要",
        note: "所有数据为免费/非官方来源，不构成投资建议。For research only.",
      },
    });
  } catch (err) {
    noStoreJson(res, 200, {
      status: "error",
      error: err?.message || "enrichment_failed",
      generatedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      tickers,
      data: {},
    });
  }
}
