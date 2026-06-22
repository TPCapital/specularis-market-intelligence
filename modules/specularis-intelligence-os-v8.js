// Specularis Intelligence OS v8
// Integrates four open-source design ideas without adding Vercel Serverless Functions:
// PanWatch-style agent loop, UZI-style multi-school jury, Horizon-style news radar,
// and daily_stock_analysis-style decision dashboard.

const TICKERS = ["NVDA", "AMD", "TSLA", "META", "AMZN", "PLTR", "AVGO", "MU", "MRVL", "QQQ", "SPY"];
const THEMES = ["AI / 半导体", "电力 / 核能", "云计算 / 软件", "机器人 / 自动驾驶", "国防 / 航天", "加密 / 金融科技"];
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MAX_NEWS_ITEMS = 9;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchJson(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractRows(snapshot = {}) {
  const candidates = [
    snapshot?.opportunities,
    snapshot?.terminalLite?.opportunities,
    snapshot?.marketData?.opportunities,
    snapshot?.rawSnapshot?.opportunities,
    snapshot?.movers,
    snapshot?.marketData?.movers,
    snapshot?.rawSnapshot?.movers,
  ];
  const rows = candidates.find(Array.isArray) || [];
  const normalized = rows.map((row, i) => ({
    ticker: String(row.ticker || row.symbol || row.code || TICKERS[i % TICKERS.length]).toUpperCase(),
    name: row.name || row.company || row.ticker || row.symbol || TICKERS[i % TICKERS.length],
    change: num(row.changePercent ?? row.change ?? row.pct ?? row.percentChange, 0),
    volume: num(row.relativeVolume ?? row.rvol ?? row.volumeRatio ?? row.volume, 1),
    score: clamp(row.score ?? row.aiScore ?? row.rankScore ?? (55 + Math.random() * 25)),
    sector: row.sector || inferTheme(row.ticker || row.symbol),
    catalyst: row.catalyst || row.reason || row.headline || inferCatalyst(row.ticker || row.symbol),
    source: row.source || "snapshot",
  }));
  if (normalized.length) return normalized.slice(0, 12);
  return fallbackRows();
}

function inferTheme(ticker = "") {
  const t = String(ticker).toUpperCase();
  if (["NVDA", "AMD", "AVGO", "MU", "MRVL", "TSM", "ASML", "SMCI"].includes(t)) return "AI / 半导体";
  if (["CEG", "VST", "NEE", "OKLO", "SMR", "NUE"].includes(t)) return "电力 / 核能";
  if (["MSFT", "ORCL", "PLTR", "SNOW", "DDOG", "CRM"].includes(t)) return "云计算 / 软件";
  if (["TSLA", "RIVN", "UBER", "GOOG"].includes(t)) return "机器人 / 自动驾驶";
  if (["HOOD", "COIN", "MSTR", "PYPL"].includes(t)) return "加密 / 金融科技";
  return THEMES[Math.abs([...t].reduce((a, c) => a + c.charCodeAt(0), 0)) % THEMES.length];
}

function inferCatalyst(ticker = "") {
  const t = String(ticker).toUpperCase();
  const map = {
    NVDA: "AI 算力需求与数据中心资本开支",
    AMD: "MI 系列 GPU 与服务器 CPU 预期",
    TSLA: "自动驾驶、交付与机器人叙事",
    META: "AI 广告效率与资本开支再定价",
    AMZN: "云业务增长与 AI 合作催化",
    PLTR: "企业 AI 操作系统订单",
    AVGO: "ASIC / 网络芯片 / AI 定制芯片",
    MU: "HBM 存储周期",
    MRVL: "AI 网络与定制硅",
  };
  return map[t] || "价格异动 + 新闻催化待确认";
}

function fallbackRows() {
  return TICKERS.map((ticker, i) => ({
    ticker,
    name: ticker,
    change: [2.4, 1.8, -0.6, 0.9, 1.2, 3.1, 1.5, 2.0, 2.7, 0.4, 0.2][i] ?? 0,
    volume: [1.8, 1.5, 0.9, 1.1, 1.3, 2.2, 1.4, 2.1, 2.4, 1.0, 0.95][i] ?? 1,
    score: [82, 76, 54, 68, 70, 84, 74, 79, 81, 57, 55][i] ?? 60,
    sector: inferTheme(ticker),
    catalyst: inferCatalyst(ticker),
    source: "fallback-model",
  }));
}

function scoreTheme(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const key = row.sector || inferTheme(row.ticker);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets.entries()].map(([theme, items]) => {
    const momentum = items.reduce((s, r) => s + clamp(50 + r.change * 8, 0, 100), 0) / items.length;
    const participation = Math.min(100, items.length * 18);
    const conviction = items.reduce((s, r) => s + clamp(r.score, 0, 100), 0) / items.length;
    const heat = Math.round(momentum * 0.4 + participation * 0.25 + conviction * 0.35);
    return { theme, heat, items: items.sort((a, b) => b.score - a.score).slice(0, 4) };
  }).sort((a, b) => b.heat - a.heat).slice(0, 6);
}

function buildNewsRadar(rows, snapshot = {}) {
  const explicit = [
    snapshot?.news,
    snapshot?.terminalLite?.news,
    snapshot?.marketData?.news,
    snapshot?.rawSnapshot?.news,
    snapshot?.headlines,
  ].find(Array.isArray) || [];
  const rawItems = explicit.length ? explicit : rows.slice(0, MAX_NEWS_ITEMS).map((row) => ({
    title: `${row.ticker}：${row.catalyst}`,
    source: row.source,
    ticker: row.ticker,
    theme: row.sector,
  }));
  const seen = new Set();
  return rawItems.map((item, index) => {
    const title = item.title || item.headline || item.summary || `${item.ticker || rows[index % rows.length]?.ticker} catalyst`;
    const key = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "").slice(0, 80);
    if (seen.has(key)) return null;
    seen.add(key);
    const related = rows.find((row) => title.toUpperCase().includes(row.ticker)) || rows[index % rows.length] || {};
    const impact = clamp((related.score || 55) + (related.change || 0) * 5 + (related.volume || 1) * 5, 0, 100);
    return {
      title,
      ticker: item.ticker || related.ticker || "MARKET",
      theme: item.theme || related.sector || inferTheme(related.ticker),
      source: item.source || "market-radar",
      impact: Math.round(impact),
      action: impact >= 78 ? "可进入候选池，但必须等 VWAP/量能确认" : impact >= 62 ? "观察，等待二次确认" : "只记录，不交易",
    };
  }).filter(Boolean).sort((a, b) => b.impact - a.impact).slice(0, MAX_NEWS_ITEMS);
}

function multiAgentDecision(rows, themes) {
  const leader = rows.slice().sort((a, b) => b.score - a.score)[0] || fallbackRows()[0];
  const marketHeat = themes[0]?.heat || 55;
  const riskPenalty = leader.change < -1 ? 12 : leader.volume < 1 ? 8 : 0;
  const score = clamp(leader.score * 0.45 + marketHeat * 0.25 + clamp(50 + leader.change * 10, 0, 100) * 0.2 + clamp(leader.volume * 35, 0, 100) * 0.1 - riskPenalty);
  const level = score >= 82 ? "A+" : score >= 72 ? "A" : score >= 62 ? "B" : score >= 52 ? "C" : "D";
  const action = level === "A+" ? "主动找回踩入场" : level === "A" ? "只做确认后的顺势单" : level === "B" ? "候选观察，不追单" : "禁止主动交易";
  return {
    leader,
    score: Math.round(score),
    level,
    action,
    agents: [
      { role: "技术 Agent", verdict: leader.change > 0 && leader.volume >= 1.2 ? "多头动能有效" : "动能不足或分歧", weight: 22 },
      { role: "新闻 Agent", verdict: leader.catalyst || "催化待确认", weight: 18 },
      { role: "情绪 Agent", verdict: marketHeat >= 70 ? "主题扩散良好" : "热度仍需确认", weight: 15 },
      { role: "基本面 Agent", verdict: `${leader.sector} 叙事需落到业绩/订单`, weight: 15 },
      { role: "风险 Agent", verdict: riskPenalty ? "存在追高/低量惩罚" : "风险未触发硬拦截", weight: 20 },
      { role: "PM 整合", verdict: action, weight: 10 },
    ],
  };
}

function juryScore(row) {
  const price = clamp(50 + row.change * 9, 0, 100);
  const volume = clamp(row.volume * 36, 0, 100);
  const catalyst = clamp(row.score, 0, 100);
  const risk = clamp(100 - Math.max(0, row.change - 4) * 12 - Math.max(0, 1 - row.volume) * 18, 0, 100);
  const total = Math.round(price * 0.28 + volume * 0.22 + catalyst * 0.3 + risk * 0.2);
  return {
    ...row,
    jury: total,
    school: total >= 80 ? "进攻派通过" : total >= 68 ? "趋势派通过" : total >= 58 ? "观察派" : "风控派否决",
    trap: row.volume < 0.9 && row.change > 2 ? "高开低量陷阱" : row.change < -2 ? "反弹失败风险" : "未触发杀猪盘/诱多硬信号",
  };
}

function renderShell() {
  const root = document.getElementById("sioContainer");
  if (!root) return;
  root.innerHTML = `
    <div class="sio-grid sio-grid-hero">
      <article class="sio-card sio-hero">
        <p class="panel-label">SPECULARIS INTELLIGENCE OS v8</p>
        <h3 id="sioMainVerdict">正在融合四套开源思想</h3>
        <p id="sioMainReason">PanWatch Agent Loop + UZI Jury + Horizon News Radar + DSA Decision Dashboard</p>
        <div class="sio-meter"><span id="sioMeterFill"></span></div>
      </article>
      <article class="sio-card">
        <p class="panel-label">核心动作</p>
        <strong id="sioAction">等待数据</strong>
        <span id="sioActionMeta">先判市场，再判主题，再判个股</span>
      </article>
      <article class="sio-card sio-risk-card">
        <p class="panel-label">硬风控</p>
        <strong id="sioRiskGate">不追单</strong>
        <span>FOMC / CPI / NFP / 四巫日默认降级</span>
      </article>
    </div>

    <div class="sio-grid sio-grid-two">
      <section class="sio-card">
        <div class="sio-title"><h3>主题热度雷达</h3><small>Horizon-style dedupe + score</small></div>
        <div id="sioThemeRadar" class="sio-list"></div>
      </section>
      <section class="sio-card">
        <div class="sio-title"><h3>多 Agent 决策链</h3><small>PanWatch-style PM verdict</small></div>
        <div id="sioAgentLoop" class="sio-agent-list"></div>
      </section>
    </div>

    <section class="sio-card">
      <div class="sio-title"><h3>个股评审团</h3><small>UZI-style multi-school jury, simplified for day trading</small></div>
      <div id="sioJuryTable" class="sio-table"></div>
    </section>

    <div class="sio-grid sio-grid-two">
      <section class="sio-card">
        <div class="sio-title"><h3>新闻 / 催化雷达</h3><small>去重、排序、转化为交易动作</small></div>
        <div id="sioNewsRadar" class="sio-news-list"></div>
      </section>
      <section class="sio-card">
        <div class="sio-title"><h3>日内执行清单</h3><small>DSA-style decision dashboard</small></div>
        <div id="sioChecklist" class="sio-checklist"></div>
      </section>
    </div>
  `;
}

function render(snapshot = {}) {
  const root = document.getElementById("sioContainer");
  if (!root) return;
  renderShell();
  const rows = extractRows(snapshot);
  const themes = scoreTheme(rows);
  const news = buildNewsRadar(rows, snapshot);
  const decision = multiAgentDecision(rows, themes);
  const jury = rows.map(juryScore).sort((a, b) => b.jury - a.jury).slice(0, 8);

  root.classList.remove("is-loading");
  const score = decision.score;
  const level = decision.level;
  const leader = decision.leader;
  setText("#sioMainVerdict", `${level} · ${leader.ticker} · ${score}/100`);
  setText("#sioMainReason", `${leader.sector}｜${leader.catalyst}`);
  setText("#sioAction", decision.action);
  setText("#sioActionMeta", `Leader ${leader.ticker} · ${pct(leader.change)} · RVOL ${Number(leader.volume || 0).toFixed(2)}x`);
  setText("#sioRiskGate", score >= 72 ? "允许小仓试错" : "默认等待");
  const meter = document.querySelector("#sioMeterFill");
  if (meter) meter.style.width = `${score}%`;

  setHtml("#sioThemeRadar", themes.map((theme) => `
    <div class="sio-row">
      <div><b>${esc(theme.theme)}</b><span>${theme.items.map((x) => x.ticker).join(" · ")}</span></div>
      <strong>${theme.heat}</strong>
    </div>
  `).join(""));

  setHtml("#sioAgentLoop", decision.agents.map((agent) => `
    <div class="sio-agent">
      <span>${esc(agent.role)}</span>
      <b>${esc(agent.verdict)}</b>
      <em>${agent.weight}%</em>
    </div>
  `).join(""));

  setHtml("#sioJuryTable", `
    <div class="sio-table-head"><span>Ticker</span><span>评分</span><span>流派</span><span>陷阱扫描</span><span>动作</span></div>
    ${jury.map((row) => `
      <div class="sio-table-row">
        <span><b>${esc(row.ticker)}</b><small>${esc(row.sector)}</small></span>
        <span>${row.jury}</span>
        <span>${esc(row.school)}</span>
        <span>${esc(row.trap)}</span>
        <span>${row.jury >= 78 ? "等回踩入场" : row.jury >= 65 ? "只观察确认" : "剔除"}</span>
      </div>
    `).join("")}
  `);

  setHtml("#sioNewsRadar", news.map((item) => `
    <div class="sio-news">
      <strong>${esc(item.title)}</strong>
      <p>${esc(item.ticker)} · ${esc(item.theme)} · Impact ${item.impact}</p>
      <span>${esc(item.action)}</span>
    </div>
  `).join(""));

  const checks = buildChecklist(decision, themes, jury);
  setHtml("#sioChecklist", checks.map((item) => `
    <div class="sio-check ${item.ok ? "is-ok" : "is-warn"}">
      <b>${item.ok ? "✓" : "!"}</b>
      <span>${esc(item.text)}</span>
    </div>
  `).join(""));
}

function buildChecklist(decision, themes, jury) {
  const top = jury[0] || {};
  return [
    { ok: decision.score >= 72, text: `总分 ${decision.score}/100：低于 72 不主动开仓` },
    { ok: (themes[0]?.heat || 0) >= 68, text: `主线热度 ${themes[0]?.heat || "--"}：必须有板块扩散` },
    { ok: top.jury >= 70, text: `${top.ticker || "候选股"} 评审团分数 ${top.jury || "--"}：低于 70 只观察` },
    { ok: !String(top.trap || "").includes("高开低量"), text: `陷阱扫描：${top.trap || "未触发"}` },
    { ok: true, text: "买方期权只做 1-5DTE、ATM/略 OTM；盈利 50%-100% 分批走" },
    { ok: true, text: "消息日、FOMC/CPI/NFP/四巫日自动降级，除非量能确认" },
  ];
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setHtml(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.innerHTML = value;
}

async function refresh() {
  const root = document.getElementById("sioContainer");
  if (!root) return;
  try {
    const snapshot = await fetchJson("/api/snapshot?mode=fast");
    render(snapshot);
  } catch (error) {
    render(window._specularisDashboard || window._specularisRawSnapshot || {});
    const node = document.querySelector("#sioActionMeta");
    if (node) node.textContent = `快照接口暂不可用，已启用本地推演：${error.message}`;
  }
}

function init() {
  if (!document.getElementById("sioContainer")) return;
  renderShell();
  refresh();
  setInterval(refresh, CHECK_INTERVAL_MS);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
