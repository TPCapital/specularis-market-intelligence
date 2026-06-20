// modules/stock-intelligence-pro.js
// Specularis Market Terminal Lite — Stock Intelligence Pro Module.
// Browser-side: state management, rendering, and manual data entry.
// Loaded as a plain ES module via <script type="module"> in index.html.

const SIP_STORAGE_KEY = "specularis-market-terminal:stock-intel-v1";

const WATCHLIST = ["MU","MRVL","NVDA","AVGO","AMD","TSM","ASML","PLTR","ORCL","SMCI"];

const COMPANY_META = {
  MU:   { name: "Micron Technology",        sector: "AI 半导体 / 存储",     tags: ["HBM","AI内存","数据中心"] },
  MRVL: { name: "Marvell Technology",        sector: "AI 半导体 / ASIC",    tags: ["ASIC","数据中心","定制芯片"] },
  NVDA: { name: "Nvidia",                    sector: "AI 半导体",            tags: ["AI算力","GPU","数据中心"] },
  AVGO: { name: "Broadcom",                  sector: "AI 半导体 / 网络",     tags: ["AI网络","ASIC","带宽"] },
  AMD:  { name: "AMD",                        sector: "AI 半导体",            tags: ["GPU","EPYC","AI加速"] },
  TSM:  { name: "TSMC ADR",                  sector: "AI 半导体 / 代工",     tags: ["代工龙头","先进制程","苹果供应链"] },
  ASML: { name: "ASML Holding ADR",          sector: "半导体设备",           tags: ["EUV光刻","半导体设备","供应链垄断"] },
  PLTR: { name: "Palantir Technologies",     sector: "AI 软件",              tags: ["AI软件","政府合同","AIP"] },
  ORCL: { name: "Oracle",                    sector: "AI 软件 / 云",         tags: ["AI云","数据库","企业SaaS"] },
  SMCI: { name: "Super Micro Computer",      sector: "AI 服务器",            tags: ["AI服务器","液冷","Nvidia生态"] },
};

// Load persisted state from localStorage.
function loadState() {
  try {
    const raw = localStorage.getItem(SIP_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

// Persist state to localStorage.
function saveState(state) {
  try {
    localStorage.setItem(SIP_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}
// v1.3.4: 自动从 /api/stock-intel-enrichment 拉取增强数据
async function fetchEnrichmentData(tickers) {
  const url = '/api/stock-intel-enrichment?tickers=' + tickers.join(',');
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('http_' + res.status);
    return await res.json();
  } catch (err) {
    console.warn('[SIP v1.3.4] enrichment fetch failed:', err?.message);
    return null;
  }
}

// v1.3.4: 将增强数据合并到 SIP state
function applyEnrichmentToSipState(state, enrichPayload) {
  if (!enrichPayload?.data) return state;
  const out = { ...state };
  for (const ticker of WATCHLIST) {
    const r = enrichPayload.data[ticker];
    if (!r) continue;
    const entry = out[ticker] || {};
    const e = r.enrichment, o = r.options, n = r.news;
    if (!e || e.status === 'unavailable') continue;
    if (e.analystTone && e.analystTone !== 'unavailable') {
      entry.analystTone = e.analystTone;
      entry.analystCount = e.analystCount;
      entry.targetMeanPrice = e.targetMeanPrice;
      entry.upsidePct = e.upsidePct;
      entry.recentUpgrades = e.recentUpgrades || [];
    }
    if (e.institutionalSignal && e.institutionalSignal !== 'unavailable') {
      entry.institutionalSignal = e.institutionalSignal;
      entry.instActivity = e.instActivity;
    }
    if (e.insiderSignal) { entry.insiderSignal = e.insiderSignal; entry.insiderBuys = e.insiderBuys; entry.insiderSells = e.insiderSells; }
    if (e.earningsDate && !entry.earningsDate) entry.earningsDate = e.earningsDate;
    if (e.keySupport != null) entry.keySupport = e.keySupport;
    if (e.keyResistance != null) entry.keyResistance = e.keyResistance;
    entry.week52High = e.week52High;
    entry.week52Low = e.week52Low;
    if (e.tradeRelevance) entry.tradeRelevance = e.tradeRelevance;
    if (n && n.length > 0) entry.recentNews = n;
    if (o?.status === 'delayed') entry.optionsData = { pcrVol: o.pcrVol, pcrOI: o.pcrOI, avgIV: o.avgIV, flowBias: o.flowBias, callWallStrike: o.callWallStrike, putWallStrike: o.putWallStrike, expiration: o.expiration };
    const rf = new Set(entry.riskFlags || []);
    if (e.beta > 1.5) rf.add('high_beta');
    if (o?.avgIV > 55) rf.add('high_iv');
    if (e.earningsDate) rf.add('earnings_event');
    if (e.analystTone === 'bearish') rf.add('analyst_bearish');
    if (o?.flowBias === 'put_heavy') rf.add('put_flow');
    entry.riskFlags = [...rf];
    if (!entry.dataStatus || entry.dataStatus === 'placeholder') entry.dataStatus = 'proxy';
    entry.enrichVersion = enrichPayload.version || 'v1.3.4';
    out[ticker] = entry;
  }
  return out;
}


// Merge live snapshot data into SIP state.
// Merge snapshot data into SIP state.
// Priority: snapshot auto data > optional manual notes. Manual edits no longer block live snapshot hydration.
// Reads from snapshot.terminalLite.stockIntelligencePro (new schema) with
// fallback to snapshot.marketData.quotes (existing schema) for backward compat.
function mergeSnapshotData(state, snapshot = {}) {
  // --- Path 1: new terminalLite schema ---
  const tlEntries = snapshot?.terminalLite?.stockIntelligencePro || [];
  const tlMap = new Map(tlEntries.map((e) => [e.ticker, e]));

  // --- Path 2: legacy quote map fallback ---
  const quotes = snapshot?.marketData?.quotes || [];
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  // Earnings from terminalLite or legacy layers
  const tlEarnings = snapshot?.terminalLite?.stockIntelligencePro || [];
  const legacyEarnings = snapshot?.layers?.earnings?.events || [];

  // Insider from terminalLite or legacy layers
  const legacyInsider = snapshot?.layers?.insider?.signals || [];

  for (const ticker of WATCHLIST) {
    if (!state[ticker]) state[ticker] = {};
    const manual = false; // v1.3.3: snapshot data always hydrates core fields; manual edits are annotations only.

    // terminalLite entry (preferred)
    const tl = tlMap.get(ticker);
    // legacy quote entry
    const q = quoteMap.get(ticker);

    // Always update core market/intelligence fields from snapshot when available.
    if (tl?.currentPrice != null) {
        state[ticker].currentPrice = tl.currentPrice;
        state[ticker].dailyChangePercent = tl.dailyChangePercent ?? state[ticker].dailyChangePercent;
        state[ticker].dataStatus = tl.dataStatus || "delayed";
        state[ticker].volumeStatus = tl.volumeStatus ?? state[ticker].volumeStatus;
        state[ticker].relativeVolumeStatus = tl.relativeVolumeStatus ?? state[ticker].relativeVolumeStatus;
        state[ticker].trendStatus = tl.trendStatus ?? state[ticker].trendStatus;
        state[ticker].keySupport = tl.keySupport ?? state[ticker].keySupport;
        state[ticker].keyResistance = tl.keyResistance ?? state[ticker].keyResistance;
        state[ticker].aiSummary = tl.aiSummary ?? state[ticker].aiSummary;
        state[ticker].riskFlags = tl.riskFlags ?? state[ticker].riskFlags;
        state[ticker].tradeRelevance = tl.tradeRelevance ?? state[ticker].tradeRelevance;
        state[ticker].recentNews = tl.recentNews ?? state[ticker].recentNews;
      } else if (q && Number.isFinite(Number(q.price)) && Number(q.price) > 0) {
        state[ticker].currentPrice = Number(q.price);
        state[ticker].dailyChangePercent = q.preMarketChange ?? q.changePercent ?? state[ticker].dailyChangePercent;
        state[ticker].dataStatus = q.dataQuality === "live" || q.status === "live" ? "live" : "delayed";
      }

    // Earnings date: terminalLite first, then legacy
    if (!state[ticker].earningsDate) {
      const tlEarningsEntry = tlEarnings.find((e) => e.ticker === ticker);
      const legacyEntry = legacyEarnings.find((e) => e.symbol === ticker);
      const date = tl?.earningsDate || tlEarningsEntry?.earningsDate || legacyEntry?.reportDate || legacyEntry?.date || null;
      if (date) state[ticker].earningsDate = date;
    }

    // Insider signal: only fill if not manually set
    if (!state[ticker].insiderSignal || tl?.insiderSignal) {
      const signal = tl?.insiderSignal || null;
      if (signal) {
        state[ticker].insiderSignal = signal;
      } else {
        // Compute from legacy insider signals
        const insiderRows = legacyInsider.filter((s) => s?.symbol === ticker);
        if (insiderRows.length > 0) {
          const buys = insiderRows.filter((r) => r.type === "buy").length;
          const sells = insiderRows.filter((r) => r.type === "sell").length;
          state[ticker].insiderSignal = buys > sells ? "净增持" : sells > buys ? "净减持" : "中性";
        }
      }
    }
  }
  return state;
}

function escHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataStatusBadge(s) {
  const map = {
    live: '<span class="sip-badge sip-badge--live">● Live</span>',
    cached: '<span class="sip-badge sip-badge--cached">● Cached</span>',
    delayed: '<span class="sip-badge sip-badge--cached">● Delayed</span>',
    proxy: '<span class="sip-badge sip-badge--placeholder">◇ Proxy</span>',
    manual: '<span class="sip-badge sip-badge--manual">● Manual</span>',
    placeholder: '<span class="sip-badge sip-badge--placeholder">○ Waiting Data</span>',
    unavailable: '<span class="sip-badge sip-badge--unavailable">✕ N/A</span>',
    "computed-lite": '<span class="sip-badge sip-badge--cached">● Lite</span>',
  };
  return map[s] || map.placeholder;
}

function tradeRelevanceBadge(r) {
  const map = {
    tradable: '<span class="sip-relevance sip-relevance--tradable">可交易</span>',
    watch: '<span class="sip-relevance sip-relevance--watch">观察</span>',
    avoid: '<span class="sip-relevance sip-relevance--avoid">回避</span>',
  };
  return map[r] || map.watch;
}

function renderStockCard(ticker, entry) {
  const meta = COMPANY_META[ticker] || {};
  const tags = (meta.tags || []).map((t) => `<span class="sip-tag">${escHtml(t)}</span>`).join("");
  const price = entry.currentPrice != null ? `$${escHtml(entry.currentPrice)}` : "--";
  const change = entry.dailyChangePercent != null
    ? `<span class="${Number(entry.dailyChangePercent) >= 0 ? "sip-pos" : "sip-neg"}">${Number(entry.dailyChangePercent) >= 0 ? "+" : ""}${escHtml(entry.dailyChangePercent)}%</span>`
    : "<span>--</span>";
  const newsHtml = Array.isArray(entry.recentNews) && entry.recentNews.length > 0
    ? `<ul class="sip-news">${entry.recentNews.slice(0, 2).map((n) =>
        `<li>${escHtml(typeof n === "object" ? n.title || n : n)}</li>`).join("")}</ul>`
    : `<p class="sip-muted">暂无最新新闻</p>`;
  const RISK_FLAG_ZH = {
    // Price action
    "chasing_risk":       "追涨风险",
    "price_pressure":     "价格承压",
    "extended":           "超买延伸",
    "gap_risk":           "跳空风险",
    // Fundamental
    "earnings_event":     "财报临近",
    "high_beta":          "高波动β",
    "high_iv":            "期权IV偏高",
    "low_volume":         "成交量不足",
    "sector_risk":        "板块风险",
    // Flow / analyst
    "put_flow":           "Put沉重流",
    "analyst_bearish":    "分析师看空",
    // Data quality (show as muted)
    "options_unavailable":"期权数据缺失",
    "quote_fallback":     "报价备用源",
  };
  const riskHtml = Array.isArray(entry.riskFlags) && entry.riskFlags.length > 0
    ? `<div class="sip-risk">${entry.riskFlags.map((f) => {
        // Handle target:XXXX format
        if (f.startsWith("target:")) return `<span>🎯 目标价 $${escHtml(f.slice(7))}</span>`;
        const zh = RISK_FLAG_ZH[f];
        return `<span>⚠️ ${escHtml(zh || f)}</span>`;
      }).join("")}</div>`
    : "";
  const earningsHtml = entry.earningsDate
    ? `<span class="sip-earnings">财报: ${escHtml(entry.earningsDate)}</span>` : "";
  const summaryHtml = entry.aiSummary
    ? `<p class="sip-summary">${escHtml(entry.aiSummary)}</p>` : "";

  return `
<article class="sip-card" data-ticker="${ticker}">
  <div class="sip-card-header">
    <div class="sip-ticker-block">
      <strong class="sip-ticker">${ticker}</strong>
      <span class="sip-company">${escHtml(meta.name || ticker)}</span>
    </div>
    <div class="sip-badge-row">
      ${dataStatusBadge(entry.dataStatus || "placeholder")}
      ${tradeRelevanceBadge(entry.tradeRelevance || "watch")}
    </div>
  </div>
  <div class="sip-sector">${escHtml(meta.sector || "")} ${earningsHtml}</div>
  <div class="sip-tags">${tags}</div>
  <div class="sip-price-row">
    <div class="sip-price">${price}</div>
    <div class="sip-change">${change}</div>
    <div class="sip-meta-col">
      <span class="sip-meta-label">趋势</span>
      <span>${escHtml(entry.trendStatus || "--")}</span>
    </div>
    <div class="sip-meta-col">
      <span class="sip-meta-label">成交量</span>
      <span>${escHtml(entry.volumeStatus || "--")}${entry.relativeVolumeStatus === "proxy" ? " · RVOL Proxy" : ""}</span>
    </div>
  </div>
  <div class="sip-levels">
    <div><span class="sip-meta-label">支撑</span> <span>${escHtml(entry.keySupport || "--")}</span></div>
    <div><span class="sip-meta-label">压力</span> <span>${escHtml(entry.keyResistance || "--")}</span></div>
    ${entry.targetMeanPrice ? '<div><span class="sip-meta-label">目标价</span> <span>$' + escHtml(entry.targetMeanPrice) + (entry.upsidePct != null ? ' (+' + escHtml(entry.upsidePct) + '%)' : '') + '</span></div>' : ''}
    ${entry.week52High && entry.week52Low ? '<div><span class="sip-meta-label">52W</span> <span>$' + escHtml(entry.week52Low) + '–$' + escHtml(entry.week52High) + '</span></div>' : ''}
    <div><span class="sip-meta-label">分析师</span> <span>${escHtml(entry.analystTone || "--")}  ${entry.analystCount ? '(' + entry.analystCount + '家)' : ''}</span></div>
    <div><span class="sip-meta-label">机构</span> <span>${escHtml(entry.institutionalSignal || "--")}${entry.instActivity ? ' · ' + escHtml(entry.instActivity) : ''}</span></div>
    <div><span class="sip-meta-label">内部人</span> <span>${escHtml(entry.insiderSignal || "--")}${entry.insiderBuys != null ? ' (买' + entry.insiderBuys + '/卖' + (entry.insiderSells||0) + ')' : ''}</span></div>
    ${entry.optionsData ? '<div><span class="sip-meta-label">期权流</span> <span>PCR:${escHtml(entry.optionsData.pcrVol||"--")} ${entry.optionsData.flowBias === "call_heavy" ? "偏Call" : entry.optionsData.flowBias === "put_heavy" ? "偏Put" : "中性"}${entry.optionsData.avgIV ? " IV:"+escHtml(entry.optionsData.avgIV)+"%" : ""}</span></div>' : ''}
  </div>
  ${summaryHtml}
  ${newsHtml}
  ${riskHtml}
  <button class="sip-edit-btn" data-ticker="${ticker}">✏️ 手动更新 / Edit</button>
</article>`;
}

function renderEditModal(ticker, entry) {
  const meta = COMPANY_META[ticker] || {};
  return `
<div class="sip-modal-backdrop" id="sipModal">
  <div class="sip-modal">
    <div class="sip-modal-header">
      <strong>${ticker} — ${escHtml(meta.name || ticker)}</strong>
      <button class="sip-modal-close" id="sipModalClose">✕</button>
    </div>
    <div class="sip-modal-body">
      <div class="sip-form-grid">
        <label>当前价格 Price<input type="number" step="0.01" id="sipF-price" value="${entry.currentPrice ?? ""}" placeholder="e.g. 135.50"></label>
        <label>涨跌幅 % Change<input type="number" step="0.01" id="sipF-change" value="${entry.dailyChangePercent ?? ""}" placeholder="e.g. 2.35"></label>
        <label>趋势 Trend<select id="sipF-trend">
          ${["placeholder","strong_uptrend","uptrend","sideways","downtrend","strong_downtrend"].map((v) =>
            `<option value="${v}" ${entry.trendStatus === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
        <label>成交量 Volume<select id="sipF-volume">
          ${["placeholder","above_average","average","below_average","dry"].map((v) =>
            `<option value="${v}" ${entry.volumeStatus === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
        <label>支撑 Support<input type="text" id="sipF-support" value="${entry.keySupport ?? ""}" placeholder="e.g. $130.00"></label>
        <label>压力 Resistance<input type="text" id="sipF-resist" value="${entry.keyResistance ?? ""}" placeholder="e.g. $145.00"></label>
        <label>财报日 Earnings<input type="text" id="sipF-earnings" value="${entry.earningsDate ?? ""}" placeholder="e.g. 2025-06-25"></label>
        <label>分析师 Analyst<select id="sipF-analyst">
          ${["placeholder","bullish","neutral","bearish"].map((v) =>
            `<option value="${v}" ${entry.analystTone === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
        <label>机构信号 Institutional<select id="sipF-inst">
          ${["placeholder","accumulating","neutral","distributing"].map((v) =>
            `<option value="${v}" ${entry.institutionalSignal === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
        <label>内部人 Insider<select id="sipF-insider">
          ${["placeholder","净增持","中性","净减持"].map((v) =>
            `<option value="${v}" ${entry.insiderSignal === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
        <label>交易相关性 Relevance<select id="sipF-rel">
          ${["watch","tradable","avoid"].map((v) =>
            `<option value="${v}" ${entry.tradeRelevance === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
      </div>
      <label style="display:block;margin-top:10px">最新新闻 News (每行一条)<textarea id="sipF-news" rows="3" placeholder="输入新闻标题，每行一条">${
        Array.isArray(entry.recentNews) ? entry.recentNews.map((n) => typeof n === "object" ? n.title || "" : n).join("\n") : ""
      }</textarea></label>
      <label style="display:block;margin-top:10px">风险标记 Risk Flags (逗号分隔)<input type="text" id="sipF-risk" value="${
        Array.isArray(entry.riskFlags) ? entry.riskFlags.join(", ") : ""
      }" placeholder="e.g. 财报前, 高IV, 关税风险"></label>
      <label style="display:block;margin-top:10px">AI 摘要 Summary<textarea id="sipF-summary" rows="3" placeholder="粘贴 AI 分析摘要或手动输入">${entry.aiSummary ?? ""}</textarea></label>
    </div>
    <div class="sip-modal-footer">
      <button class="sip-save-btn" id="sipModalSave">保存 Save</button>
      <button class="sip-cancel-btn" id="sipModalCancel">取消 Cancel</button>
    </div>
  </div>
</div>`;
}

function openEditModal(ticker, state, onSave) {
  document.getElementById("sipModal")?.remove();
  const entry = state[ticker] || {};
  const backdropHtml = renderEditModal(ticker, entry);
  document.body.insertAdjacentHTML("beforeend", backdropHtml);

  const close = () => document.getElementById("sipModal")?.remove();

  document.getElementById("sipModalClose").addEventListener("click", close);
  document.getElementById("sipModalCancel").addEventListener("click", close);
  document.getElementById("sipModal").addEventListener("click", (e) => {
    if (e.target.id === "sipModal") close();
  });

  document.getElementById("sipModalSave").addEventListener("click", () => {
    const price = parseFloat(document.getElementById("sipF-price").value);
    const change = parseFloat(document.getElementById("sipF-change").value);
    const newsRaw = document.getElementById("sipF-news").value.trim();
    const riskRaw = document.getElementById("sipF-risk").value.trim();
    const updated = {
      ...(state[ticker] || {}),
      currentPrice: Number.isFinite(price) ? price : (state[ticker]?.currentPrice ?? null),
      dailyChangePercent: Number.isFinite(change) ? change : (state[ticker]?.dailyChangePercent ?? null),
      trendStatus: document.getElementById("sipF-trend").value,
      volumeStatus: document.getElementById("sipF-volume").value,
      keySupport: document.getElementById("sipF-support").value.trim() || null,
      keyResistance: document.getElementById("sipF-resist").value.trim() || null,
      earningsDate: document.getElementById("sipF-earnings").value.trim() || null,
      analystTone: document.getElementById("sipF-analyst").value,
      institutionalSignal: document.getElementById("sipF-inst").value,
      insiderSignal: document.getElementById("sipF-insider").value,
      tradeRelevance: document.getElementById("sipF-rel").value,
      recentNews: newsRaw ? newsRaw.split("\n").map((l) => l.trim()).filter(Boolean) : [],
      riskFlags: riskRaw ? riskRaw.split(",").map((l) => l.trim()).filter(Boolean) : [],
      aiSummary: document.getElementById("sipF-summary").value.trim() || null,
      manualNote: true,
      dataStatus: (state[ticker]?.dataStatus && state[ticker].dataStatus !== "placeholder") ? state[ticker].dataStatus : "manual",
      manualUpdatedAt: new Date().toISOString(),
    };
    onSave(ticker, updated);
    close();
  });
}

export function renderStockIntelPro(containerId, snapshot = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let state = loadState();
  state = mergeSnapshotData(state, snapshot);

  // Ensure all tickers exist in state.
  for (const ticker of WATCHLIST) {
    if (!state[ticker]) state[ticker] = { dataStatus: "placeholder" };
  }

  function redraw() {
    container.classList.remove("is-loading");
    const cards = WATCHLIST.map((t) => renderStockCard(t, state[t] || {})).join("");
    container.innerHTML = `
      <div class="sip-disclaimer">
        ⚠️ 仅供研究 · For research only, not financial advice.
        <span class="sip-mode-label">📡 v1.3.4 Auto-Intel — Yahoo 分析师+期权+内部人 全自动</span>
      </div>
      <div class="sip-toolbar" style="margin:8px 0;display:flex;align-items:center;gap:10px">
        <button class="sip-save-btn" id="sipAutoRefreshBtn" style="font-size:12px;padding:4px 12px">🔄 自动获取（分析师/期权/内部人/新闻）</button>
        <span class="sip-muted" id="sipRefreshStatus" style="font-size:11px"></span>
      </div>
      <div class="sip-grid">${cards}</div>`;

    // v1.3.4: 自动刷新按钮
    document.getElementById("sipAutoRefreshBtn")?.addEventListener("click", async () => {
      const btn = document.getElementById("sipAutoRefreshBtn");
      const status = document.getElementById("sipRefreshStatus");
      if (btn) btn.disabled = true;
      if (status) status.textContent = "正在获取数据...";
      const payload = await fetchEnrichmentData(WATCHLIST);
      if (payload) {
        state = applyEnrichmentToSipState(state, payload);
        saveState(state);
        document.dispatchEvent(new CustomEvent("specularis:sipUpdated", { detail: { state } }));
        redraw();
        setTimeout(() => {
          const s2 = document.getElementById("sipRefreshStatus");
          if (s2) s2.textContent = "✓ 数据已更新 " + new Date().toLocaleTimeString("zh-CN", {hour:"2-digit",minute:"2-digit"});
        }, 100);
      } else {
        if (status) status.textContent = "获取失败，请稍后重试";
      }
      if (btn) btn.disabled = false;
    });

    container.querySelectorAll(".sip-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ticker = btn.dataset.ticker;
        openEditModal(ticker, state, (t, updated) => {
          state[t] = updated;
          saveState(state);
          // Fire event so other modules (options lite, AI decision) can pick up changes.
          document.dispatchEvent(new CustomEvent("specularis:sipUpdated", { detail: { state } }));
          redraw();
        });
      });
    });
  }

  redraw();

  // v1.3.4: 页面加载后2秒自动触发一次增强数据拉取
  setTimeout(async () => {
    const payload = await fetchEnrichmentData(WATCHLIST);
    if (payload) {
      state = applyEnrichmentToSipState(state, payload);
      saveState(state);
      document.dispatchEvent(new CustomEvent("specularis:sipUpdated", { detail: { state } }));
      redraw();
    }
  }, 2500);

  // Listen for snapshot refresh events.
  document.addEventListener("specularis:snapshotReady", (e) => {
    state = mergeSnapshotData(state, e.detail || {});
    saveState(state);
    redraw();
  });

  return {
    getState: () => state,
  };
}

// Export state getter for cross-module use.
export function getStockIntelState() {
  return loadState();
}
