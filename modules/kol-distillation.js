// modules/kol-distillation.js
// Specularis Market Terminal Lite — KOL Distillation Module.
// Manual input interface for X/Twitter KOL content analysis.
// No automatic X scraping — user pastes content, module structures it.

const KOL_STORAGE_KEY = "specularis-market-terminal:kol-v1";
const WATCHLIST = ["MU","MRVL","NVDA","AVGO","AMD","TSM","ASML","PLTR","ORCL","SMCI"];

const STANCE_LABELS = {
  bullish: "看多 Bullish",
  bearish: "看空 Bearish",
  neutral: "中立 Neutral",
  mixed: "混合 Mixed",
  unclear: "不明确 Unclear",
};

const SIGNAL_LABELS = {
  explicit_position: "明确持仓",
  strong_opinion: "强观点",
  discussion_only: "普通讨论",
  news_commentary: "新闻评论",
  joke_or_noise: "玩笑/噪音",
};

const CONVICTION_LABELS = { high: "高", medium: "中", low: "低" };

function loadState() {
  try {
    const raw = localStorage.getItem(KOL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { entries: [] };
}

function saveState(state) {
  try {
    localStorage.setItem(KOL_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function escHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stanceBadge(s) {
  const cls = s === "bullish" ? "kol-bull"
    : s === "bearish" ? "kol-bear"
    : s === "mixed" ? "kol-mixed" : "kol-neu";
  return `<span class="kol-stance ${cls}">${escHtml(STANCE_LABELS[s] || s)}</span>`;
}

function convictionBadge(c) {
  const cls = c === "high" ? "kol-conv--high" : c === "medium" ? "kol-conv--med" : "kol-conv--low";
  return `<span class="kol-conv ${cls}">${escHtml(CONVICTION_LABELS[c] || c)}</span>`;
}

function tickerTags(tickers = []) {
  return tickers.map((t) => {
    const isWL = WATCHLIST.includes(t);
    return `<span class="kol-ticker-tag ${isWL ? "kol-ticker-tag--wl" : ""}">${escHtml(t)}</span>`;
  }).join("");
}

function renderEntry(entry, idx) {
  const url = entry.postUrl ? `<a class="kol-url" href="${escHtml(entry.postUrl)}" target="_blank" rel="noopener">🔗 原文</a>` : "";
  const screenshot = entry.screenshotNote ? `<p class="kol-screenshot">📸 ${escHtml(entry.screenshotNote)}</p>` : "";
  const args = Array.isArray(entry.keyArguments) && entry.keyArguments.length > 0
    ? `<ul class="kol-args">${entry.keyArguments.map((a) => `<li>${escHtml(a)}</li>`).join("")}</ul>` : "";
  const risk = entry.riskOfMisinterpretation
    ? `<p class="kol-misrisk">⚠️ 误读风险: ${escHtml(entry.riskOfMisinterpretation)}</p>` : "";
  const summary = entry.aiDistillationSummary
    ? `<p class="kol-distilled"><span class="kol-label">AI 蒸馏:</span> ${escHtml(entry.aiDistillationSummary)}</p>` : "";
  const relevance = entry.relevanceToWatchlist
    ? `<p class="kol-rel"><span class="kol-label">观察池相关性:</span> ${escHtml(entry.relevanceToWatchlist)}</p>` : "";

  return `
<article class="kol-card" data-idx="${idx}">
  <div class="kol-card-header">
    <div class="kol-handle">
      <strong>@${escHtml(entry.kolHandle)}</strong>
      ${entry.kolName ? `<span class="kol-name">${escHtml(entry.kolName)}</span>` : ""}
    </div>
    <div class="kol-meta">
      ${entry.date ? `<span class="kol-date">${escHtml(entry.date)}</span>` : ""}
      ${url}
    </div>
  </div>
  <blockquote class="kol-post">${escHtml(entry.postText)}</blockquote>
  ${screenshot}
  <div class="kol-badges">
    ${stanceBadge(entry.stance || "unclear")}
    ${convictionBadge(entry.convictionLevel || "low")}
    <span class="kol-signal-type">${escHtml(SIGNAL_LABELS[entry.signalType] || entry.signalType || "未分类")}</span>
  </div>
  <div class="kol-tickers">${tickerTags(entry.mentionedTickers || [])}</div>
  ${args}
  ${risk}
  ${relevance}
  ${summary}
  <div class="kol-actions">
    <button class="kol-edit-btn" data-idx="${idx}">✏️ 编辑</button>
    <button class="kol-del-btn" data-idx="${idx}">🗑️ 删除</button>
  </div>
</article>`;
}

function renderAddForm() {
  return `
<div class="kol-add-form" id="kolAddForm">
  <h3 class="kol-add-title">➕ 添加 KOL 内容 / Add KOL Entry</h3>
  <div class="sip-form-grid">
    <label>KOL Handle (@)<input type="text" id="kolF-handle" placeholder="e.g. walterblooomberg"></label>
    <label>KOL 名称<input type="text" id="kolF-name" placeholder="e.g. Walter Bloomberg"></label>
    <label>日期 Date<input type="text" id="kolF-date" placeholder="e.g. 2025-06-07"></label>
    <label>帖子链接 URL<input type="text" id="kolF-url" placeholder="https://x.com/..."></label>
    <label>立场 Stance<select id="kolF-stance">
      ${["bullish","bearish","neutral","mixed","unclear"].map((v) =>
        `<option value="${v}">${STANCE_LABELS[v] || v}</option>`).join("")}
    </select></label>
    <label>置信度 Conviction<select id="kolF-conviction">
      ${["high","medium","low"].map((v) =>
        `<option value="${v}">${CONVICTION_LABELS[v] || v}</option>`).join("")}
    </select></label>
    <label>信号类型 Signal Type<select id="kolF-signalType">
      ${Object.entries(SIGNAL_LABELS).map(([v, l]) =>
        `<option value="${v}">${l}</option>`).join("")}
    </select></label>
  </div>
  <label style="display:block;margin-top:10px">帖子原文 Post Text<textarea id="kolF-text" rows="4" placeholder="粘贴原文内容..."></textarea></label>
  <label style="display:block;margin-top:10px">涉及标的 Tickers (空格或逗号分隔)<input type="text" id="kolF-tickers" placeholder="e.g. NVDA MRVL AMD"></label>
  <label style="display:block;margin-top:10px">核心论点 Key Arguments (每行一条)<textarea id="kolF-args" rows="3" placeholder="逐条列出核心论点..."></textarea></label>
  <label style="display:block;margin-top:10px">误读风险 Risk<input type="text" id="kolF-misrisk" placeholder="e.g. 可能是反讽语气，非真实仓位"></label>
  <label style="display:block;margin-top:10px">观察池相关性<input type="text" id="kolF-relevance" placeholder="e.g. 直接影响 NVDA 持仓逻辑"></label>
  <label style="display:block;margin-top:10px">截图备注 Screenshot Note<input type="text" id="kolF-screenshot" placeholder="可选：截图说明"></label>
  <label style="display:block;margin-top:10px">AI 蒸馏摘要<textarea id="kolF-summary" rows="3" placeholder="粘贴 GPT / Claude 分析结果..."></textarea></label>
  <div class="kol-form-actions">
    <button class="sip-save-btn" id="kolFormSave">添加 / Add</button>
    <button class="sip-cancel-btn" id="kolFormCancel">取消 / Cancel</button>
  </div>
</div>`;
}

function collectFormData() {
  const get = (id) => document.getElementById(id)?.value?.trim() || "";
  const tickersRaw = get("kolF-tickers").split(/[\s,]+/).filter(Boolean).map((t) => t.toUpperCase());
  const argsRaw = get("kolF-args").split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    kolHandle: get("kolF-handle").replace(/^@/, ""),
    kolName: get("kolF-name"),
    date: get("kolF-date"),
    postUrl: get("kolF-url"),
    postText: get("kolF-text"),
    stance: get("kolF-stance") || "unclear",
    convictionLevel: get("kolF-conviction") || "low",
    signalType: get("kolF-signalType") || "discussion_only",
    mentionedTickers: tickersRaw,
    keyArguments: argsRaw,
    riskOfMisinterpretation: get("kolF-misrisk"),
    relevanceToWatchlist: get("kolF-relevance"),
    screenshotNote: get("kolF-screenshot"),
    aiDistillationSummary: get("kolF-summary"),
    addedAt: new Date().toISOString(),
  };
}

export function renderKolDistillation(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let state = loadState();
  let showForm = false;

  function redraw() {
    container.classList.remove("is-loading");
    const entries = state.entries || [];
    const entriesHtml = entries.length > 0
      ? entries.map((e, i) => renderEntry(e, i)).join("")
      : `<div class="kol-empty">
           <p>暂无 KOL 条目。点击「添加」粘贴 X / Twitter 内容进行结构化分析。</p>
           <p class="sip-muted">⚠️ 重要：普通提及≠真实持仓。请区分「明确持仓」、「强观点」与「讨论」。</p>
         </div>`;

    container.innerHTML = `
      <div class="kol-header">
        <div>
          <span class="kol-badge-notice">📱 Manual Input Mode — X API 暂不可用</span>
          <p class="kol-header-note">手动粘贴 KOL 内容，结构化为可用市场信号。区分立场、置信度与信号类型。</p>
        </div>
        <button class="sip-save-btn" id="kolToggleAdd" style="align-self:center">
          ${showForm ? "✕ 取消" : "➕ 添加 / Add"}
        </button>
      </div>
      ${showForm ? renderAddForm() : ""}
      <div class="kol-entries">${entriesHtml}</div>
      <div class="sip-disclaimer">
        ⚠️ 仅供研究 · For research only, not financial advice.
        普通提及不代表真实持仓。Ordinary mentions ≠ real positions.
      </div>`;

    document.getElementById("kolToggleAdd")?.addEventListener("click", () => {
      showForm = !showForm;
      redraw();
    });

    document.getElementById("kolFormSave")?.addEventListener("click", () => {
      const entry = collectFormData();
      if (!entry.kolHandle || !entry.postText) {
        alert("KOL handle 和帖子原文为必填项。");
        return;
      }
      state.entries = [entry, ...(state.entries || [])];
      saveState(state);
      showForm = false;
      document.dispatchEvent(new CustomEvent("specularis:kolUpdated", { detail: { state } }));
      redraw();
    });

    document.getElementById("kolFormCancel")?.addEventListener("click", () => {
      showForm = false;
      redraw();
    });

    container.querySelectorAll(".kol-del-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (confirm("确认删除此 KOL 条目？")) {
          state.entries.splice(idx, 1);
          saveState(state);
          document.dispatchEvent(new CustomEvent("specularis:kolUpdated", { detail: { state } }));
          redraw();
        }
      });
    });
  }

  redraw();

  return { getState: () => state };
}

export function getKolState() {
  return loadState();
}
