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

// Provide current state to all modules that need cross-module data.
function getModuleStates() {
  return {
    sipState: getStockIntelState(),
    oilState: getOptionsLiteState(),
    kolState: getKolState(),
    marketRegime: getMarketRegime(),
  };
}

function initModules() {
  // Stock Intelligence Pro.
  const sipModule = renderStockIntelPro("sipContainer", getLatestSnapshot());

  // Options Intelligence Lite.
  renderOptionsIntelLite("oilContainer");

  // KOL Distillation.
  renderKolDistillation("kolContainer");

  // AI Decision Layer — needs references to other module states.
  renderAIDecisionLayer("adlContainer", getModuleStates);

  // AI Prompt Export — generates copyable prompts.
  renderAIPromptExport("apeContainer", getModuleStates);

  console.log("[Specularis Terminal Lite] All modules initialized.");
}

// Wait for DOM to be ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModules);
} else {
  initModules();
}

// When app.js fires a snapshot refresh, notify our modules.
// app.js doesn't fire events natively, so we poll and detect changes.
let lastSnapshotAt = null;
setInterval(() => {
  const d = window._specularisDashboard;
  if (!d) return;
  const ts = d.asOf || d.updatedAt;
  if (ts && ts !== lastSnapshotAt) {
    lastSnapshotAt = ts;
    document.dispatchEvent(
      new CustomEvent("specularis:snapshotReady", { detail: d })
    );
  }
}, 5000);
