// modules/specularis-terminal-lite.js
// Main coordinator for Specularis Market Terminal Lite new modules.
// Loaded as a plain ES module (type="module") — runs after app.js / i18n.js.
//
// v1.3.5-hotfix: fetch /api/snapshot directly from this module and bridge the
// raw snapshot into the new Terminal Lite modules. This avoids the legacy
// app.js buildDashboard() stripping terminalLite / marketData / generatedAt.

import { renderStockIntelPro, getStockIntelState } from "./stock-intelligence-pro.js";
import { renderOptionsIntelLite, getOptionsLiteState } from "./options-intelligence-lite.js";
import { renderKolDistillation, getKolState } from "./kol-distillation.js";
import { renderAIDecisionLayer } from "./ai-decision-layer.js";
import { renderAIPromptExport } from "./ai-prompt-export.js";

const SNAPSHOT_ENDPOINT = "/api/snapshot?mode=fast&refresh=1";
const AUTO_REFRESH_MS = 60_000;

// Retrieve current market regime from the existing app global state.
// app.js stores lastDashboard on window as window._specularisDashboard.
function getMarketRegime() {
  try {
    const d = window._specularisDashboard;
    if (!d) return {};
    const regime = d.risk || d.marketRegime || d.terminalLite?.marketRegimeSummary || {};
    return {
      score: regime.score ?? null,
      mode: regime.mode ?? regime.type ?? null,
      label: regime.label ?? regime.headline ?? null,
    };
  } catch {
    return {};
  }
}

function snapshotId(d = {}) {
  return d.generatedAt || d.asOf || d.updatedAt || d.terminalLite?.meta?.generatedAt || d.rawSnapshot?.generatedAt || null;
}

// Return latest snapshot for SIP snapshot merge.
function getLatestSnapshot() {
  try {
    return latestSnapshot || window._specularisDashboard || window._specularisRawSnapshot || {};
  } catch {
    return {};
  }
}

// Merge raw /api/snapshot response into the legacy dashboard object so all new
// modules can hydrate from terminalLite and marketData without waiting for app.js
// to expose these fields.
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
  latestSnapshot = bridged;
  return bridged;
}

async function fetchFreshSnapshot(reason = "manual") {
  try {
    const url = `${SNAPSHOT_ENDPOINT}&t=${Date.now()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`snapshot_http_${res.status}`);
    const raw = await res.json();
    const bridged = bridgeRawSnapshot(raw);
    if (!bridged) return null;

    document.dispatchEvent(new CustomEvent("specularis:snapshotReady", {
      detail: bridged,
    }));

    console.log("[Specularis Terminal Lite] snapshot bridged", {
      reason,
      version: bridged.terminalLite?.meta?.version,
      generatedAt: bridged.generatedAt,
      stockIntel: bridged.terminalLite?.stockIntelligencePro?.length || 0,
      optionsLite: bridged.terminalLite?.optionsIntelligenceLite?.length || 0,
      aiDecision: bridged.terminalLite?.aiDecisionLayer?.length || 0,
    });
    return bridged;
  } catch (err) {
    console.warn("[Specularis Terminal Lite] direct snapshot fetch failed:", err?.message || err);
    return null;
  }
}

// Keep live module handles so AI Decision / Prompt Export read the rendered
// in-memory state instead of stale localStorage placeholders.
let sipModule = null;
let oilModule = null;
let kolModule = null;
let latestSnapshot = {};
let lastSnapshotAt = null;

// Provide current state to all modules that need cross-module data.
function getModuleStates() {
  return {
    sipState: sipModule?.getState?.() || getStockIntelState(),
    oilState: oilModule?.getState?.() || getOptionsLiteState(),
    kolState: kolModule?.getState?.() || getKolState(),
    marketRegime: getMarketRegime(),
    snapshot: latestSnapshot || getLatestSnapshot(),
  };
}

function emitSnapshotReady(d) {
  if (!d) return;
  const ts = snapshotId(d);
  if (ts && ts === lastSnapshotAt) return;
  lastSnapshotAt = ts || Date.now();
  latestSnapshot = d;
  document.dispatchEvent(new CustomEvent("specularis:snapshotReady", { detail: d }));
}

function initModules() {
  latestSnapshot = getLatestSnapshot();

  // Stock Intelligence Pro.
  sipModule = renderStockIntelPro("sipContainer", latestSnapshot);

  // Options Intelligence Lite.
  oilModule = renderOptionsIntelLite("oilContainer", latestSnapshot);

  // KOL Distillation.
  kolModule = renderKolDistillation("kolContainer");

  // AI Decision Layer — prefers server-side terminalLite.aiDecisionLayer when present.
  renderAIDecisionLayer("adlContainer", getModuleStates, latestSnapshot);

  // AI Prompt Export — generates copyable prompts.
  renderAIPromptExport("apeContainer", getModuleStates);

  // Immediately hydrate from any dashboard object that already exists.
  emitSnapshotReady(latestSnapshot);

  // Critical fix: fetch the raw snapshot directly. This supplies terminalLite,
  // marketData.quotes, generatedAt and raw source metadata even if the legacy
  // app.js dashboard transformer omits them.
  fetchFreshSnapshot("initial-load");

  // Make manual debugging easy in the browser console.
  window.__specularisRefreshSnapshot = () => fetchFreshSnapshot("console");

  console.log("[Specularis Terminal Lite] All modules initialized with direct snapshot bridge.");
}

// Wait for DOM to be ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModules);
} else {
  initModules();
}

// app.js doesn't fire events natively, so poll and detect snapshot changes.
setInterval(() => {
  const d = window._specularisDashboard;
  if (!d) return;
  const ts = snapshotId(d);
  if (ts && ts !== lastSnapshotAt) {
    emitSnapshotReady(d);
  }
}, 1000);

// Periodically refresh raw snapshot for the new modules only. The cadence is
// intentionally conservative to avoid API limits.
setInterval(() => fetchFreshSnapshot("interval"), AUTO_REFRESH_MS);
