// modules/specularis-terminal-lite.js
// Runtime coordinator for the terminal modules. Keep this file defensive:
// the main dashboard must not stay in a global loading state if one module,
// snapshot request, or auto-intel request fails.

import { renderStockIntelPro, getStockIntelState } from "./stock-intelligence-pro.js";
import { renderOptionsIntelLite, getOptionsLiteState } from "./options-intelligence-lite.js";
import { renderCongressIntel, getCongressIntelState } from "./congress-intel.js";
import { renderAIDecisionLayer } from "./ai-decision-layer.js";
import { renderAIPromptExport } from "./ai-prompt-export.js";

const WATCHLIST = ["MU", "MRVL", "NVDA", "AVGO", "AMD", "TSM", "ASML", "PLTR", "ORCL", "SMCI"];
const SNAPSHOT_ENDPOINT = "/api/snapshot?mode=fast";
const AUTO_INTEL_ENDPOINT = `/api/auto-intel?tickers=${WATCHLIST.join(",")}`;
const AUTO_REFRESH_MS = 300_000;
const FETCH_TIMEOUT_MS = 14_000;

let sipModule = null;
let oilModule = null;
let congressModule = null;
let latestSnapshot = {};
let latestAutoIntel = null;
let lastSnapshotKey = null;
let terminalReady = false;

const TREND_MAP_ZH = {
  strong_uptrend: "强上涨",
  uptrend: "上涨",
  sideways: "震荡",
  downtrend: "下跌",
  strong_downtrend: "强下跌",
  placeholder: "等待数据",
  unavailable: "等待数据",
};

function escHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clearLoading(reason = "terminal-ready") {
  document.querySelectorAll(".loading-zone.is-loading").forEach((node) => node.classList.remove("is-loading"));
  document.body.dataset.specularisLoadingState = reason;
}

function showModuleFallback(containerId, title, error) {
  const node = document.getElementById(containerId);
  if (!node) return;
  node.classList.remove("is-loading");
  node.innerHTML = `<div class="sip-disclaimer"><b>${escHtml(title)}</b><br>${escHtml(error?.message || error || "Module temporarily unavailable.")}</div>`;
}

function snapshotKey(data = {}) {
  return data.generatedAt || data.asOf || data.updatedAt || data.terminalLite?.meta?.generatedAt || data.rawSnapshot?.generatedAt || null;
}

function replaceTrendText(root) {
  if (!root || !window.NodeFilter) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    let text = node.nodeValue || "";
    for (const [raw, zh] of Object.entries(TREND_MAP_ZH)) text = text.replaceAll(raw, zh);
    node.nodeValue = text;
  }
}

function patchTrendLabels() {
  replaceTrendText(document.getElementById("sipContainer"));
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function bridgeRawSnapshot(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const current = window._specularisDashboard || {};
  const bridged = {
    ...current,
    generatedAt: raw.generatedAt || current.generatedAt || Date.now(),
    runtimeMode: raw.runtimeMode || current.runtimeMode || null,
    runtimeBudgetMs: raw.runtimeBudgetMs || current.runtimeBudgetMs || null,
    envDebug: raw.envDebug || current.envDebug || {},
    marketData: raw.marketData || current.marketData || raw.lastKnownGood?.marketData || null,
    sources: raw.sources || current.sources || raw.lastKnownGood?.sources || {},
    terminalLite: raw.terminalLite || current.terminalLite || raw.lastKnownGood?.terminalLite || null,
    rawSnapshot: raw,
  };
  window._specularisRawSnapshot = raw;
  window._specularisDashboard = bridged;
  window.__latestSnapshot = bridged; // v9: alias for ADL + SIO modules
  latestSnapshot = bridged;
  return bridged;
}

function normalizeAutoIntel(payload = {}) {
  if (payload?.tickers && typeof payload.tickers === "object") return payload;
  if (!payload?.data || typeof payload.data !== "object") return payload;
  const tickers = {};
  for (const [ticker, row] of Object.entries(payload.data)) {
    tickers[ticker] = {
      quote: {},
      trend: { status: "unavailable", labelZh: "等待数据" },
      volume: { status: "unavailable", relativeVolume: null },
      news: Array.isArray(row?.news) ? row.news : [],
      options: row?.options || { status: "unavailable", preferredStructure: "wait", ivStatus: "unavailable" },
      decision: {
        ticker,
        action: row?.enrichment?.tradeRelevance || "watch",
        rating: row?.enrichment?.tradeRelevance === "avoid" ? "Avoid" : "C",
        reason: row?.enrichment?.tradeRelevanceReason || "Legacy enrichment compatibility fallback.",
        keyEntryZone: row?.enrichment?.keySupport || null,
        targetZone: row?.enrichment?.keyResistance || null,
        dataStatus: "fallback",
      },
      dataQuality: { quote: "fallback", news: "fallback", options: row?.options?.status || "unavailable" },
      ai: { summary: row?.enrichment?.tradeRelevanceReason || `${ticker}: auto intelligence compatibility fallback.` },
    };
  }
  return { ...payload, status: payload.status || "fallback", tickers };
}

function bridgeAutoIntelPayload(payload = {}) {
  payload = normalizeAutoIntel(payload);
  const rows = payload?.tickers || {};
  const tickers = Object.keys(rows);
  if (!tickers.length) {
    console.warn("[Specularis Terminal] /api/auto-intel returned no tickers; keeping existing dashboard state.");
    return null;
  }
  const current = latestSnapshot || window._specularisDashboard || {};
  const stockIntelligencePro = tickers.map((ticker) => {
    const row = rows[ticker] || {};
    const quote = row.quote || {};
    const trend = row.trend || {};
    return {
      ticker,
      currentPrice: quote.price ?? null,
      dailyChangePercent: quote.changePercent ?? null,
      dataStatus: row.dataQuality?.quote || quote.status || "fallback",
      volumeStatus: row.volume?.status || "unavailable",
      relativeVolumeStatus: row.volume?.relativeVolume ? "real" : "unavailable",
      trendStatus: trend.status || "unavailable",
      keySupport: quote.previousClose ? `$${quote.previousClose}` : null,
      keyResistance: quote.price ? `$${Number((Number(quote.price) * 1.04).toFixed(2))}` : null,
      aiSummary: row.ai?.summary || "自动情报暂不可用，使用 fallback 数据。",
      riskFlags: [row.dataQuality?.options === "unavailable" ? "options_unavailable" : null, row.dataQuality?.quote === "fallback" ? "quote_fallback" : null].filter(Boolean),
      tradeRelevance: row.decision?.action === "tradable" ? "tradable" : row.decision?.action === "avoid" ? "avoid" : "watch",
      recentNews: row.news || [],
      autoIntel: true,
    };
  });
  const optionsIntelligenceLite = tickers.map((ticker) => {
    const row = rows[ticker] || {};
    const opt = row.options || {};
    return {
      ticker,
      preferredStructure: opt.preferredStructure || "wait",
      ivStatus: opt.ivStatus || "unavailable",
      earningsVolRisk: Boolean(opt.earningsVolRisk),
      riskLevel: opt.riskLevel || "medium",
      reason: opt.reason || (opt.status === "unavailable" ? "自动期权情报暂不可用；默认等待，不把缺失数据当作信号。" : `${ticker} options auto-intel from ${opt.source || "provider"}`),
      invalidationCondition: row.decision?.invalidationLevel || "",
      notes: opt.reason || opt.error || opt.status || "auto-intel",
      dataStatus: opt.status || "unavailable",
      autoIntel: true,
    };
  });
  const bridged = {
    ...current,
    generatedAt: payload.generatedAt || current.generatedAt || Date.now(),
    autoIntel: payload,
    terminalLite: {
      ...(current.terminalLite || {}),
      autoIntelStatus: payload.status || "fallback",
      stockIntelligencePro,
      optionsIntelligenceLite,
      aiDecisionLayer: tickers.map((ticker) => rows[ticker]?.decision).filter(Boolean),
      meta: { ...(current.terminalLite?.meta || {}), version: "v1.5-auto-intel", generatedAt: payload.generatedAt || Date.now() },
    },
  };
  window._specularisAutoIntel = payload;
  window._specularisDashboard = bridged;
  window.__latestSnapshot = bridged; // v9: alias
  latestAutoIntel = payload;
  latestSnapshot = bridged;
  return bridged;
}

function emitSnapshotReady(snapshot, reason = "snapshot") {
  if (!snapshot) return;
  const key = snapshotKey(snapshot);
  if (key && key === lastSnapshotKey) return;
  lastSnapshotKey = key || `${reason}:${Date.now()}`;
  document.dispatchEvent(new CustomEvent("specularis:snapshotReady", { detail: snapshot }));
  clearLoading(reason);
  queueMicrotask(patchTrendLabels);
}

async function fetchFreshSnapshot(reason = "manual") {
  try {
    const sep = SNAPSHOT_ENDPOINT.includes("?") ? "&" : "?";
    const payload = await fetchJson(`${SNAPSHOT_ENDPOINT}${sep}t=${Math.floor(Date.now() / 300000)}`);
    const bridged = bridgeRawSnapshot(payload);
    emitSnapshotReady(bridged, `snapshot:${reason}`);
    return bridged;
  } catch (error) {
    console.warn("[Specularis Terminal] snapshot fetch failed", error?.message || error);
    clearLoading(`snapshot-failed:${reason}`);
    return null;
  }
}

async function fetchAutoIntel(reason = "manual") {
  try {
    const sep = AUTO_INTEL_ENDPOINT.includes("?") ? "&" : "?";
    const payload = await fetchJson(`${AUTO_INTEL_ENDPOINT}${sep}t=${Math.floor(Date.now() / 300000)}`);
    const bridged = bridgeAutoIntelPayload(payload);
    if (!bridged) return null;
    document.dispatchEvent(new CustomEvent("specularis:autoIntelReady", { detail: latestAutoIntel }));
    emitSnapshotReady(bridged, `auto-intel:${reason}`);
    return bridged;
  } catch (error) {
    console.warn("[Specularis Terminal] auto-intel fetch failed", error?.message || error);
    clearLoading(`auto-intel-failed:${reason}`);
    return null;
  }
}

function getMarketRegime() {
  const data = window._specularisDashboard || {};
  const regime = data.risk || data.marketRegime || data.terminalLite?.marketRegimeSummary || {};
  return { score: regime.score ?? null, mode: regime.mode ?? regime.type ?? null, label: regime.label ?? regime.headline ?? null };
}

function getModuleStates() {
  return {
    sipState: sipModule?.getState?.() || getStockIntelState(),
    oilState: oilModule?.getState?.() || getOptionsLiteState(),
    congressState: congressModule?.getState?.() || getCongressIntelState(),
    marketRegime: getMarketRegime(),
    snapshot: latestSnapshot || window._specularisDashboard || {},
    autoIntel: latestAutoIntel || window._specularisAutoIntel || latestSnapshot?.autoIntel || null,
  };
}

function safeRender(name, containerId, fn) {
  try {
    const result = fn();
    // Handle async render functions (e.g. congress-intel, which fetches data)
    if (result && typeof result.then === "function") {
      result.catch(error => {
        console.error(`[Specularis Terminal] ${name} async render failed`, error);
        showModuleFallback(containerId, `${name} 暂不可用`, error);
      });
    }
    return result;
  } catch (error) {
    console.error(`[Specularis Terminal] ${name} render failed`, error);
    showModuleFallback(containerId, `${name} 暂不可用`, error);
    return null;
  }
}

function initModules() {
  if (terminalReady) return;
  terminalReady = true;
  latestSnapshot = window._specularisDashboard || {};
  sipModule = safeRender("Stock Intelligence Pro", "sipContainer", () => renderStockIntelPro("sipContainer", latestSnapshot));
  oilModule = safeRender("Options Lite", "oilContainer", () => renderOptionsIntelLite("oilContainer", latestSnapshot));
  congressModule = safeRender("Congress Intel", "kolContainer", () => renderCongressIntel("kolContainer"));
  safeRender("AI Decision Layer", "adlContainer", () => renderAIDecisionLayer("adlContainer", getModuleStates, latestSnapshot));
  safeRender("AI Prompt Export", "apeContainer", () => renderAIPromptExport("apeContainer", getModuleStates));
  emitSnapshotReady(latestSnapshot, "initial-dashboard");

  // v9 fix: re-render ADL after fresh snapshot arrives (data may not be present at init time)
  document.addEventListener("specularis:snapshotReady", () => {
    const snap = window._specularisDashboard || window.__latestSnapshot || {};
    safeRender("AI Decision Layer", "adlContainer", () =>
      renderAIDecisionLayer("adlContainer", getModuleStates, snap));
  }, { once: true });

  fetchFreshSnapshot("initial-load");
  fetchAutoIntel("initial-load");
  window.__specularisRefreshSnapshot = () => fetchFreshSnapshot("console");
  window.__specularisRefreshAutoIntel = () => fetchAutoIntel("console");
  setTimeout(() => clearLoading("guard-timeout"), 8000);
  setTimeout(() => clearLoading("guard-timeout-extended"), 16000);
  console.log("[Specularis Terminal] modules initialized with loading guard.");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initModules, { once: true });
else initModules();

setInterval(() => {
  const data = window._specularisDashboard;
  if (!data) return;
  const key = snapshotKey(data);
  if (key && key !== lastSnapshotKey) emitSnapshotReady(data, "dashboard-refresh");
}, 1500);

setInterval(() => fetchFreshSnapshot("interval"), AUTO_REFRESH_MS);
setInterval(() => fetchAutoIntel("interval"), AUTO_REFRESH_MS);
