// modules/options-intelligence-lite.js
// Specularis Market Terminal Lite — Options Intelligence Lite Module.
// Does NOT claim to have real GEX/IV data. Proxy signals only.
// All real data fields marked as future placeholders.

const OIL_STORAGE_KEY = "specularis-market-terminal:options-lite-v1";

const WATCHLIST = ["MU","MRVL","NVDA","AVGO","AMD","TSM","ASML","PLTR","ORCL","SMCI"];

const STRUCTURE_LABELS = {
  stock: "正股 Stock",
  long_call: "买入 Call",
  call_spread: "Call 价差",
  put_spread: "Put 价差",
  wait: "等待观察 Wait",
  avoid: "回避 Avoid",
};

const RISK_LABELS = {
  low: '<span class="oil-risk oil-risk--low">低风险</span>',
  medium: '<span class="oil-risk oil-risk--med">中风险</span>',
  high: '<span class="oil-risk oil-risk--high">高风险</span>',
  medium_high: '<span class="oil-risk oil-risk--high">中高风险</span>',
};

function loadState() {
  try {
    const raw = localStorage.getItem(OIL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveState(state) {
  try {
    localStorage.setItem(OIL_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function escHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function structureBadge(s) {
  const isPositive = ["stock","long_call","call_spread"].includes(s);
  const isNegative = s === "avoid";
  const cls = isPositive ? "oil-struct--pos" : isNegative ? "oil-struct--neg" : "oil-struct--neu";
  return `<span class="oil-struct ${cls}">${escHtml(STRUCTURE_LABELS[s] || s)}</span>`;
}

function renderCard(ticker, entry) {
  const earningsWarning = entry.earningsVolRisk
    ? `<div class="oil-earnings-warn">⚠️ 财报窗口 — 期权溢价可能偏高 / Earnings Vol Risk</div>`
    : "";
  const futureFields = `
    <div class="oil-future-fields">
      <span class="oil-future-label">Future API 升级后可解锁 / Upgrade to unlock:</span>
      <span>GammaWall · CallWall · PutWall · IV Rank · Skew · OI · 异常大单</span>
    </div>`;

  return `
<article class="oil-card" data-ticker="${ticker}">
  <div class="oil-card-header">
    <strong class="oil-ticker">${ticker}</strong>
    <span class="oil-mode-badge">Options Lite${entry.dataStatus ? " · " + escHtml(entry.dataStatus) : ""}</span>
  </div>
  ${earningsWarning}
  <div class="oil-row">
    <div class="oil-col">
      <span class="oil-label">建议结构</span>
      ${structureBadge(entry.preferredStructure || "wait")}
    </div>
    <div class="oil-col">
      <span class="oil-label">风险等级</span>
      ${RISK_LABELS[entry.riskLevel || "medium"] || RISK_LABELS.medium}
    </div>
    <div class="oil-col">
      <span class="oil-label">IV 状态</span>
      <span>${escHtml(entry.ivStatus === "placeholder" ? "unavailable" : (entry.ivStatus || "unavailable"))}</span>
    </div>
  </div>
  <p class="oil-reason">${escHtml(entry.reason || "等待数据或手动输入。")}</p>
  ${entry.invalidationCondition ? `<p class="oil-invalid"><span class="oil-label">失效条件:</span> ${escHtml(entry.invalidationCondition)}</p>` : ""}
  ${entry.notes ? `<p class="oil-notes">${escHtml(entry.notes)}</p>` : ""}
  ${futureFields}
  <button class="oil-edit-btn" data-ticker="${ticker}">✏️ 手动更新 / Edit</button>
</article>`;
}

function renderEditModal(ticker, entry) {
  return `
<div class="sip-modal-backdrop" id="oilModal">
  <div class="sip-modal">
    <div class="sip-modal-header">
      <strong>${ticker} — Options Lite</strong>
      <button class="sip-modal-close" id="oilModalClose">✕</button>
    </div>
    <div class="sip-modal-body">
      <div class="sip-form-grid">
        <label>建议结构 Structure<select id="oilF-struct">
          ${["stock","long_call","call_spread","put_spread","wait","avoid"].map((v) =>
            `<option value="${v}" ${entry.preferredStructure === v ? "selected" : ""}>${STRUCTURE_LABELS[v] || v}</option>`).join("")}
        </select></label>
        <label>IV 状态<select id="oilF-iv">
          ${["placeholder","low","normal","elevated","extreme"].map((v) =>
            `<option value="${v}" ${entry.ivStatus === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
        <label>风险等级<select id="oilF-risk">
          ${["low","medium","high"].map((v) =>
            `<option value="${v}" ${entry.riskLevel === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
        <label>财报波动风险<select id="oilF-earnings">
          <option value="false" ${!entry.earningsVolRisk ? "selected" : ""}>否 No</option>
          <option value="true" ${entry.earningsVolRisk ? "selected" : ""}>是 Yes</option>
        </select></label>
      </div>
      <label style="display:block;margin-top:10px">理由 Reason<textarea id="oilF-reason" rows="2">${escHtml(entry.reason ?? "")}</textarea></label>
      <label style="display:block;margin-top:10px">失效条件 Invalidation<input type="text" id="oilF-invalid" value="${escHtml(entry.invalidationCondition ?? "")}" placeholder="e.g. 跌破 $130 VWAP"></label>
      <label style="display:block;margin-top:10px">备注 Notes<textarea id="oilF-notes" rows="2">${escHtml(entry.notes ?? "")}</textarea></label>
    </div>
    <div class="sip-modal-footer">
      <button class="sip-save-btn" id="oilModalSave">保存 Save</button>
      <button class="sip-cancel-btn" id="oilModalCancel">取消 Cancel</button>
    </div>
  </div>
</div>`;
}

// Merge snapshot terminalLite.optionsIntelligenceLite into state.
// Snapshot auto data takes priority; manual edits are only supplementary notes.
function mergeOilSnapshot(state, snapshot = {}) {
  const tlEntries = snapshot?.terminalLite?.optionsIntelligenceLite || [];
  const tlMap = new Map(tlEntries.map((e) => [e.ticker, e]));
  for (const ticker of WATCHLIST) {
    if (!state[ticker]) state[ticker] = {};
    const manual = false; // v1.3.3: do not let old localStorage manual data block live API hydration.
    const tl = tlMap.get(ticker);
    if (tl) {
      state[ticker] = {
        ...state[ticker],
        preferredStructure: tl.preferredStructure ?? state[ticker].preferredStructure,
        ivStatus: tl.ivStatus ?? state[ticker].ivStatus,
        earningsVolRisk: tl.earningsVolRisk ?? state[ticker].earningsVolRisk,
        riskLevel: tl.riskLevel ?? state[ticker].riskLevel,
        reason: tl.reason ?? state[ticker].reason,
        invalidationCondition: tl.invalidationCondition ?? state[ticker].invalidationCondition,
        notes: tl.notes ?? state[ticker].notes,
        dataStatus: tl.dataStatus ?? state[ticker].dataStatus ?? "placeholder",
      };
    }
  }
  return state;
}

export function renderOptionsIntelLite(containerId, snapshot = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let state = mergeOilSnapshot(loadState(), snapshot);
  for (const t of WATCHLIST) {
    if (!state[t]) {
      state[t] = {
        preferredStructure: "wait",
        ivStatus: "placeholder",
        earningsVolRisk: false,
        riskLevel: "medium",
        reason: "Options Auto Lite — 未接入真实 IV / GEX 数据。基于价格动量与市场环境生成代理信号。",
        invalidationCondition: "",
        notes: "未来升级付费 API 后可接入: GammaWall / CallWall / PutWall / IV Rank / Skew / OI / 异常大单。",
        dataStatus: "placeholder",
      };
    }
  }

  function redraw() {
    container.classList.remove("is-loading");
    const cards = WATCHLIST.map((t) => renderCard(t, state[t])).join("");
    container.innerHTML = `
      <div class="oil-header">
        <div class="oil-header-text">
          <span class="oil-mode-notice">📊 Options Lite Mode</span>
          <span>免费版不接入真实期权大单流。信号基于：正股动量 · 相对成交量 · 板块强度 · QQQ/SPY 方向 · 波动风险 · 新闻催化。</span>
        </div>
        <span class="sip-disclaimer">仅供研究 · For research only</span>
      </div>
      <div class="oil-grid">${cards}</div>`;

    container.querySelectorAll(".oil-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ticker = btn.dataset.ticker;
        const entry = state[ticker] || {};
        document.getElementById("oilModal")?.remove();
        document.body.insertAdjacentHTML("beforeend", renderEditModal(ticker, entry));

        const close = () => document.getElementById("oilModal")?.remove();
        document.getElementById("oilModalClose").addEventListener("click", close);
        document.getElementById("oilModalCancel").addEventListener("click", close);
        document.getElementById("oilModal").addEventListener("click", (e) => {
          if (e.target.id === "oilModal") close();
        });
        document.getElementById("oilModalSave").addEventListener("click", () => {
          state[ticker] = {
            ...state[ticker],
            preferredStructure: document.getElementById("oilF-struct").value,
            ivStatus: document.getElementById("oilF-iv").value,
            riskLevel: document.getElementById("oilF-risk").value,
            earningsVolRisk: document.getElementById("oilF-earnings").value === "true",
            reason: document.getElementById("oilF-reason").value.trim(),
            invalidationCondition: document.getElementById("oilF-invalid").value.trim(),
            notes: document.getElementById("oilF-notes").value.trim(),
            manualNote: true,
            dataStatus: state[ticker]?.dataStatus && state[ticker].dataStatus !== "placeholder" ? state[ticker].dataStatus : "manual",
          };
          saveState(state);
          document.dispatchEvent(new CustomEvent("specularis:oilUpdated", { detail: { state } }));
          close();
          redraw();
        });
      });
    });
  }

  redraw();

  // Listen for snapshot ready events to merge earnings vol risk from snapshot
  document.addEventListener("specularis:snapshotReady", (e) => {
    state = mergeOilSnapshot(state, e.detail || {});
    saveState(state);
    redraw();
  });

  // Persist the auto-hydrated state so other tabs / prompt export can see it.
  saveState(state);
  return { getState: () => state };
}

export function getOptionsLiteState() {
  return loadState();
}
