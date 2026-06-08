// modules/specularis-terminal-lite.js
// Main coordinator for Specularis Market Terminal Lite new modules.
// Loaded as a plain ES module (type="module") — runs after app.js / i18n.js.

import { renderStockIntelPro, getStockIntelState } from "./stock-intelligence-pro.js";
import { renderOptionsIntelLite, getOptionsLiteState } from "./options-intelligence-lite.js";
import { renderKolDistillation, getKolState } from "./kol-distillation.js";
import { renderAIDecisionLayer } from "./ai-decision-layer.js";
import { renderAIPromptExport } from "./ai-prompt-export.js";

// Retrieve current market regime from the existing app global state.
// app.js stores lastDashboard on window as window._specularisDashboard.
function getMarketRegime() {
  try {
    const d = window._specularisDashboard;
    if (!d) return {};
    const regime = d.risk || d.marketRegime || {};
    return {
      score: regime.score ?? null,
      mode: regime.mode ?? null,
      label: regime.label ?? null,
    };
  } catch {
    return {};
  }
}

// Return latest snapshot for SIP snapshot merge.
function getLatestSnapshot() {
  try {
    return window._specularisDashboard || {};
  } catch {
    return {};
  }
}

// Keep live module handles so AI Decision / Prompt Export read the rendered
// in-memory state instead of stale localStorage placeholders.
let sipModule = null;
let oilModule = null;
let kolModule = null;
let latestSnapshot = {};

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

function snapshotId(d = {}) {
  return d.generatedAt || d.asOf || d.updatedAt || d.terminalLite?.meta?.generatedAt || null;
}

function initModules() {
  latestSnapshot = getLatestSnapshot();

  // Stock Intelligence Pro.
  sipModule = renderStockIntelPro("sipContainer", latestSnapshot);

  // Options Intelligence Lite.
  oilModule = renderOptionsIntelLite("oilContainer", latestSnapshot);

  // KOL Distillation.
  kolModule = renderKolDistillation("kolContainer");

  // AI Decision Layer — now prefers server-side terminalLite.aiDecisionLayer when present.
  renderAIDecisionLayer("adlContainer", getModuleStates, latestSnapshot);

  // AI Prompt Export — generates copyable prompts.
  renderAIPromptExport("apeContainer", getModuleStates);

  // If app.js already populated a snapshot before this module loaded, immediately
  // notify all child modules so they hydrate from real API data.
  if (snapshotId(latestSnapshot)) {
    queueMicrotask(() => {
      document.dispatchEvent(new CustomEvent("specularis:snapshotReady", { detail: latestSnapshot }));
    });
  }

  console.log("[Specularis Terminal Lite] All modules initialized.");
}

// Wait for DOM to be ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModules);
} else {
  initModules();
}

// app.js doesn't fire events natively, so poll and detect snapshot changes.
// IMPORTANT: current snapshots use generatedAt, not asOf/updatedAt. v1.3.1
// missed this, causing front-end modules to stay on placeholders.
let lastSnapshotAt = null;
setInterval(() => {
  const d = window._specularisDashboard;
  if (!d) return;
  const ts = snapshotId(d);
  if (ts && ts !== lastSnapshotAt) {
    lastSnapshotAt = ts;
    latestSnapshot = d;
    document.dispatchEvent(
      new CustomEvent("specularis:snapshotReady", { detail: d })
    );
  }
}, 1000);
