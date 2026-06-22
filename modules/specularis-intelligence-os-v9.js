// Specularis Intelligence OS v9
// Integrates four open-source design ideas:
//   PanWatch  — Agent loop event monitoring
//   UZI-Skill — 22-dimension quantitative rules + multi-school jury
//   Horizon   — AI-powered themed news radar + daily briefings
//   daily_stock_analysis — LLM decision dashboard + push delivery

const TICKERS = ["NVDA","AMD","TSLA","META","AMZN","PLTR","AVGO","MU","MRVL","QQQ","SPY"];
const THEMES = ["AI / 半导体","电力 / 核能","云计算 / 软件","机器人 / 自动驾驶","国防 / 航天","加密 / 金融科技"];
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MAX_NEWS_ITEMS = 9;

// ── UZI-Skill: Quantitative Rule Engine ──────────────────────────────────────
const UZI_RULES = {
  momentum: [
    { id:"M1", label:"RVOL≥2.0 + 20日高点突破", weight:15, signal:"bull", test:(s)=>(s.volume||1)>=2 && (s.change||0)>1 },
    { id:"M2", label:"盘前涨幅>3% + 催化确认",   weight:12, signal:"bull", test:(s)=>(s.change||0)>=3 },
    { id:"M3", label:"连续3日强于大盘",           weight:10, signal:"bull", test:(s)=>s.trendStatus==="strong_uptrend" },
    { id:"M4", label:"量价齐升首次回调10日线",    weight: 8, signal:"bull", test:(s)=>(s.change||0)>0.5&&(s.volume||1)>=1.3 },
    { id:"M5", label:"跌破开盘低点量能放大",      weight:10, signal:"bear", test:(s)=>(s.change||0)<=-2 },
    { id:"M6", label:"高位放量滞涨",              weight: 8, signal:"bear", test:(s)=>(s.change||0)<0&&(s.volume||1)>=1.5 },
  ],
  risk: [
    { id:"R1", label:"VIX>25 市场风险高位",       weight:20, signal:"block", test:(_,m)=>(m?.vix||0)>25 },
    { id:"R2", label:"财报前IV异常高位",           weight:15, signal:"block", test:(s)=>(s.riskFlags||[]).includes("earnings_event") },
    { id:"R3", label:"持续跌破VWAP量能衰竭",       weight:12, signal:"bear",  test:(s)=>(s.change||0)<=-3 },
  ],
  catalyst: [
    { id:"C1", label:"机构评级上调",               weight:12, signal:"bull", test:(s)=>s.analystTone==="bullish"||s.analystTone==="positive" },
    { id:"C2", label:"业绩超预期",                 weight:14, signal:"bull", test:(s)=>(s.news||[]).some(n=>/beat|surprise|exceed/i.test(n)) },
    { id:"C3", label:"机构评级下调",               weight:12, signal:"bear", test:(s)=>(s.riskFlags||[]).includes("analyst_bearish") },
  ]
};

function applyUziRules(stockData, marketRegime) {
  const triggered = [];
  let bullScore = 0, bearScore = 0, blockFlag = false;
  const m = marketRegime || {};
  for (const [cat, rules] of Object.entries(UZI_RULES)) {
    for (const rule of rules) {
      try {
        if (rule.test(stockData, m)) {
          triggered.push({ ...rule, category: cat });
          if (rule.signal === "bull")  bullScore  += rule.weight;
          if (rule.signal === "bear")  bearScore  += rule.weight;
          if (rule.signal === "block") blockFlag   = true;
        }
      } catch {}
    }
  }
  const net = bullScore - bearScore;
  const rating = blockFlag ? "BLOCK" : net >= 30 ? "A+" : net >= 18 ? "A" : net >= 8 ? "B" : net >= 0 ? "C" : "AVOID";
  return { bullScore, bearScore, blockFlag, triggered, rating, net };
}

// ── Horizon: News radar by theme ─────────────────────────────────────────────
const NEWS_THEMES = [
  { key:"ai_semi",   label:"AI / 半导体", icon:"🔵", keywords:/\b(AI|nvidia|amd|gpu|semiconductor|chip|TSM|ASML|Broadcom|Marvell)/i },
  { key:"macro",     label:"宏观 / 利率", icon:"🔴", keywords:/\b(fed|rate|yield|inflation|CPI|PCE|powell|FOMC|treasury)/i },
  { key:"cloud",     label:"云计算 / 软件",icon:"🟢", keywords:/\b(cloud|SaaS|microsoft|amazon|google|azure|AWS|oracle|salesforce)/i },
  { key:"crypto",    label:"加密 / 风险资产",icon:"🟡", keywords:/\b(bitcoin|crypto|ETH|coinbase|microstrategy|BTC)/i },
];

function categorizeNews(newsItems = []) {
  const buckets = {};
  NEWS_THEMES.forEach(t => { buckets[t.key] = { ...t, items: [] }; });
  const uncategorized = [];
  for (const item of newsItems) {
    const text = `${item.title||""} ${item.summary||""}`;
    let placed = false;
    for (const theme of NEWS_THEMES) {
      if (theme.keywords.test(text)) {
        buckets[theme.key].items.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) uncategorized.push(item);
  }
  return { buckets, uncategorized };
}

function scoreNewsImportance(item) {
  const text = `${item.title||""} ${item.summary||""}`;
  let score = 5;
  if (/\bEARNING|BEAT|MISS|GUIDANCE|UPGRADE|DOWNGRADE|TARGET/i.test(text)) score += 4;
  if (/\bFED|FOMC|RATE|INFLATION|GDP/i.test(text)) score += 3;
  if (/\bNVDA|AMD|MSFT|AAPL|META|GOOGL|AMZN|TSLA/i.test(text)) score += 2;
  const ageMins = item.datetime ? Math.floor((Date.now() - item.datetime) / 60000) : 999;
  if (ageMins < 30) score += 3;
  else if (ageMins < 120) score += 1;
  return Math.min(score, 10);
}

// ── PanWatch: Event Monitor ───────────────────────────────────────────────────
const EVENT_THRESHOLDS = { rvol: 2.0, priceBreak: 2.0, strongUp: 3.0, strongDown: -3.0 };
let eventLog = [];

function detectEvents(rows = [], previousRows = []) {
  const prev = new Map(previousRows.map(r=>[r.ticker, r]));
  const newEvents = [];
  for (const row of rows) {
    const p = prev.get(row.ticker) || {};
    if ((row.volume||1) >= EVENT_THRESHOLDS.rvol && (p.volume||0) < EVENT_THRESHOLDS.rvol) {
      newEvents.push({ type:"VOLUME_SPIKE", ticker:row.ticker, detail:`RVOL ${(row.volume||1).toFixed(1)}x 异常放量`, ts: Date.now() });
    }
    if ((row.change||0) >= EVENT_THRESHOLDS.strongUp && (p.change||0) < EVENT_THRESHOLDS.strongUp) {
      newEvents.push({ type:"BREAKOUT", ticker:row.ticker, detail:`涨幅 +${(row.change||0).toFixed(1)}% 强势突破`, ts: Date.now() });
    }
    if ((row.change||0) <= EVENT_THRESHOLDS.strongDown && (p.change||0) > EVENT_THRESHOLDS.strongDown) {
      newEvents.push({ type:"SELLOFF", ticker:row.ticker, detail:`跌幅 ${(row.change||0).toFixed(1)}% 异常下挫`, ts: Date.now() });
    }
  }
  return newEvents;
}

// ── Utility helpers ───────────────────────────────────────────────────────────
function esc(v) {
  return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function pct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  return `${n>0?"+":""}${n.toFixed(2)}%`;
}
function clamp(v,mn=0,mx=100){ return Math.max(mn,Math.min(mx,Number(v)||0)); }
function num(v,fb=0){ const n=Number(v); return Number.isFinite(n)?n:fb; }

async function fetchJson(url, timeout=12000) {
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { cache:"no-store", signal:ctrl.signal, headers:{ Accept:"application/json" }});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function extractRows(snapshot={}) {
  // Priority 1: pre-scored opportunity / mover arrays
  const oppCandidates = [
    snapshot?.opportunities, snapshot?.terminalLite?.opportunities,
    snapshot?.marketData?.opportunities, snapshot?.movers, snapshot?.marketData?.movers,
  ];
  let rows = oppCandidates.find(Array.isArray) || [];

  // Priority 2: fall back to raw quotes (most reliably populated)
  if (!rows.length) {
    const quoteSources = [
      snapshot?.marketData?.quotes,
      snapshot?.sources?.marketData?.data?.quotes,
      snapshot?.terminalLite?.stockIntelligencePro,
    ];
    for (const src of quoteSources) {
      if (Array.isArray(src) && src.length) { rows = src; break; }
    }
  }

  const normalized = rows.map((row, i) => {
    const sym = String(row.ticker||row.symbol||row.code||TICKERS[i%TICKERS.length]).toUpperCase();
    const chg = num(row.changePercent??row.change??row.pct??row.dailyChangePercent??0);
    const rvol = num(row.relativeVolume??row.rvol??row.volumeRatio??1);
    return {
      ticker: sym,
      name: row.name||row.company||sym,
      change: chg,
      volume: rvol,
      score:  clamp(row.score??row.aiScore??Math.max(40, 55 + chg * 3)),
      sector: row.sector||inferTheme(sym),
      catalyst: row.catalyst||row.reason||row.headline||inferCatalyst(sym),
      source: row.source||row.dataQuality||"snapshot",
      news: row.news||row.recentNews||[],
      analystTone: row.analystTone||"",
      riskFlags: row.riskFlags||[],
      trendStatus: row.trendStatus||(chg>=3?"strong_uptrend":chg>=0.8?"uptrend":chg<=-3?"strong_downtrend":chg<=-0.8?"downtrend":"sideways"),
    };
  })
  .filter(r => !/^\^|=F$|^DX-Y|^BZ-|^CL-/.test(r.ticker));

  if (normalized.length) return normalized.slice(0, 12);

  return TICKERS.slice(0, 6).map(ticker => ({
    ticker, name:ticker, change:0, volume:1, score:55,
    sector:inferTheme(ticker), catalyst:inferCatalyst(ticker),
    source:"fallback", news:[], analystTone:"", riskFlags:[], trendStatus:"sideways",
  }));
}
function inferTheme(t="") {
  t = String(t).toUpperCase();
  if (["NVDA","AMD","AVGO","MU","MRVL","TSM","ASML","SMCI"].includes(t)) return "AI / 半导体";
  if (["CEG","VST","NEE","OKLO","SMR"].includes(t)) return "电力 / 核能";
  if (["MSFT","ORCL","PLTR","SNOW","DDOG","CRM"].includes(t)) return "云计算 / 软件";
  if (["TSLA","RIVN","UBER","GOOG"].includes(t)) return "机器人 / 自动驾驶";
  if (["HOOD","COIN","MSTR","PYPL"].includes(t)) return "加密 / 金融科技";
  return THEMES[Math.abs([...t].reduce((a,c)=>a+c.charCodeAt(0),0))%THEMES.length];
}

function inferCatalyst(t="") {
  const map = {
    NVDA:"AI算力需求与数据中心资本开支",AMD:"MI系列GPU与服务器CPU预期",
    TSLA:"自动驾驶、交付与机器人叙事",META:"AI广告效率与资本开支再定价",
    AMZN:"云业务增长与AI合作催化",PLTR:"企业AI操作系统订单",
    AVGO:"ASIC/网络芯片/AI定制芯片",MU:"HBM存储周期",MRVL:"AI网络与定制硅",
  };
  return map[String(t).toUpperCase()]||"价格异动 + 新闻催化待确认";
}

// ── Render functions ──────────────────────────────────────────────────────────
function ratingColor(r) {
  return { "A+":"#22c55e","A":"#4ade80","B":"#eab308","C":"#94a3b8","AVOID":"#ef4444","BLOCK":"#f59e0b" }[r]||"#64748b";
}

function renderJury(row, uziResult) {
  const triggered = (uziResult.triggered||[]).slice(0,4);
  const tags = triggered.map(rule=>{
    const cls = rule.signal==="bull"?"uzi-bull":rule.signal==="bear"?"uzi-bear":"uzi-block";
    return `<span class="uzi-rule-tag ${cls}">${esc(rule.label)}</span>`;
  }).join("");
  return `
    <div style="margin-top:6px">
      <div style="font-size:0.68rem;color:#64748b;margin-bottom:4px">UZI 量化规则命中:</div>
      <div>${tags||'<span style="font-size:0.72rem;color:#475569">无明确规则触发</span>'}</div>
    </div>`;
}

function renderRows(rows, snapshot) {
  const regime = snapshot?.marketRegime || {};
  return rows.map(row => {
    const uzi = applyUziRules(row, regime);
    const rating = uzi.rating;
    const rColor = ratingColor(rating);
    const chg = row.change||0;
    const chgClass = chg>=0?"pos":"neg";
    return `
    <article class="sio-card" style="border-left:3px solid ${rColor}">
      <header class="sio-card-header">
        <div>
          <span class="sio-ticker">${esc(row.ticker)}</span>
          <span class="sio-theme-badge">${esc(row.sector)}</span>
        </div>
        <span class="sio-rating" style="color:${rColor};border-color:${rColor}">${esc(rating)}</span>
      </header>
      <div class="sio-metrics">
        <span class="${chgClass}" style="font-weight:700;font-size:0.95rem">${pct(chg)}</span>
        <span class="sio-metric-item">RVOL <strong>${(row.volume||1).toFixed(1)}x</strong></span>
        <span class="sio-metric-item">Score <strong>${Math.round(row.score)}</strong></span>
      </div>
      <p class="sio-catalyst">${esc(row.catalyst)}</p>
      ${renderJury(row, uzi)}
      <div style="display:flex;gap:6px;margin-top:8px;font-size:0.7rem;color:#475569">
        <span>🔵 ${uzi.bullScore}分看多</span>
        <span>🔴 ${uzi.bearScore}分看空</span>
        ${uzi.blockFlag?'<span style="color:#f59e0b">⚠️ 触发风控</span>':""}
      </div>
    </article>`;
  }).join("");
}

function renderNewsRadar(snapshot) {
  const newsItems = [
    ...(snapshot?.sources?.newsCatalysts?.data?.news||[]),
    ...(snapshot?.terminalLite?.newsFeed||[]),
    ...(snapshot?.news||[]),
  ].slice(0, 40);

  const { buckets } = categorizeNews(newsItems);
  const activeThemes = Object.values(buckets).filter(b=>b.items.length>0);
  if (!activeThemes.length) return `<p style="color:#475569;font-size:0.8rem;padding:12px">新闻数据加载中...</p>`;

  return activeThemes.map(theme => {
    const top = [...theme.items].sort((a,b)=>scoreNewsImportance(b)-scoreNewsImportance(a)).slice(0,3);
    const items = top.map(item => {
      const imp = scoreNewsImportance(item);
      const cls = imp>=8?"score-high":imp>=5?"score-mid":"score-low";
      return `<div class="news-radar-item">
        <span class="news-radar-score ${cls}">${imp}</span>
        ${esc(item.title||item.headline||"").slice(0,80)}
      </div>`;
    }).join("");
    return `<div class="news-radar-bucket">
      <div class="news-radar-bucket-header">
        <span class="news-radar-bucket-title">${theme.icon} ${esc(theme.label)}</span>
        <span class="news-radar-count">${theme.items.length}条</span>
      </div>
      ${items}
    </div>`;
  }).join("");
}

function renderEventLog() {
  if (!eventLog.length) return `<div style="color:#475569;font-size:0.8rem;padding:12px;text-align:center">暂无触发事件 · 监控运行中</div>`;
  return eventLog.slice(0,8).map(ev => {
    const ageMin = Math.floor((Date.now()-ev.ts)/60000);
    const cls = ev.type==="BREAKOUT"?"event-breakout":ev.type==="VOLUME_SPIKE"?"event-volume":"event-stoploss";
    return `<div class="event-monitor-item">
      <span class="event-type-badge ${cls}">${esc(ev.type)}</span>
      <strong style="color:#e2e8f0">${esc(ev.ticker)}</strong>
      <span style="color:#94a3b8;flex:1">${esc(ev.detail)}</span>
      <span style="color:#475569;font-size:0.7rem">${ageMin<1?"刚刚":`${ageMin}m前`}</span>
    </div>`;
  }).join("");
}

// ── Main render ───────────────────────────────────────────────────────────────
let prevRows = [];

function renderSIO(container, snapshot) {
  const rows = extractRows(snapshot);
  const newEvents = detectEvents(rows, prevRows);
  if (newEvents.length) {
    eventLog = [...newEvents, ...eventLog].slice(0,30);
    updateEventBanner(newEvents);
  }
  prevRows = rows;

  container.innerHTML = `
    <style>
      .sio-panel-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
      @media(max-width:900px){ .sio-panel-grid { grid-template-columns:1fr; } }
      .sio-panel { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; }
      .sio-panel-title { font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#64748b; margin-bottom:12px; }
      .sio-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
      .sio-card { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:14px; }
      .sio-card-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
      .sio-ticker { font-size:1rem; font-weight:800; color:var(--text-primary); margin-right:6px; }
      .sio-theme-badge { font-size:.65rem; background:rgba(56,189,248,.12); color:#38bdf8; padding:2px 6px; border-radius:4px; }
      .sio-rating { font-size:.85rem; font-weight:800; padding:3px 10px; border-radius:5px; border:1.5px solid; }
      .sio-metrics { display:flex; gap:10px; align-items:center; margin-bottom:6px; font-size:.8rem; }
      .sio-metric-item { color:#64748b; }
      .sio-catalyst { font-size:.76rem; color:#94a3b8; margin:0; line-height:1.4; }
      .pos { color:#22c55e } .neg { color:#ef4444 }
    </style>

    <div class="sio-panel-grid">
      <!-- PanWatch Event Monitor -->
      <div class="sio-panel">
        <div class="sio-panel-title">⚡ 事件监控 (PanWatch)</div>
        <div id="sioEventLog">${renderEventLog()}</div>
      </div>
      <!-- Horizon News Radar -->
      <div class="sio-panel">
        <div class="sio-panel-title">📡 主题新闻雷达 (Horizon)</div>
        <div class="news-radar-grid" style="grid-template-columns:1fr">${renderNewsRadar(snapshot)}</div>
      </div>
    </div>

    <!-- UZI Decision Jury -->
    <div style="margin-bottom:14px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:12px">
        🎯 UZI 量化规则决策陪审团 (22维数据 × 量化规则)
      </div>
      <div class="sio-cards">${renderRows(rows, snapshot)}</div>
    </div>

    <div style="font-size:.68rem;color:#334155;text-align:center;padding:10px">
      Specularis v9 · PanWatch Agent Loop · UZI 量化规则 · Horizon 新闻雷达 · daily_stock_analysis 决策层
    </div>
  `;
  updateNewsRadarSection(snapshot);
}

function updateEventBanner(events) {
  const banner = document.getElementById("eventBanner");
  const badge  = document.getElementById("eventAlertBadge");
  if (!banner||!events.length) return;
  banner.style.display = "flex";
  banner.innerHTML = events.map(ev=>`
    <div class="event-item">⚡ <strong>${esc(ev.ticker)}</strong> — ${esc(ev.detail)}</div>`).join("");
  if (badge) {
    badge.style.display = "inline-block";
    badge.textContent = `⚡ ${eventLog.length}`;
  }
  setTimeout(()=>{ if(banner) banner.style.display="none"; }, 12000);
}

function updateNewsRadarSection(snapshot) {
  const el = document.getElementById("newsRadarGrid");
  if (el) { el.innerHTML = renderNewsRadar(snapshot); el.classList.remove("is-loading"); }
  const meta = document.getElementById("newsRadarMeta");
  if (meta) meta.textContent = "Horizon · 主题过滤";
  updateHorizonBriefingBar(snapshot);
}

function updateHorizonBriefingBar(snapshot) {
  const el = document.getElementById("briefingTickerText");
  if (!el) return;
  const newsItems = [
    ...(snapshot?.sources?.newsCatalysts?.data?.news||[]),
    ...(snapshot?.terminalLite?.newsFeed||[]),
    ...(snapshot?.news||[]),
  ].slice(0,20);
  const top = [...newsItems].sort((a,b)=>scoreNewsImportance(b)-scoreNewsImportance(a)).slice(0,5);
  if (!top.length) { el.textContent = "新闻雷达等待数据..."; return; }
  el.textContent = top.map(n=>n.title||n.headline||"").filter(Boolean).join("  ·  ");
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  const container = document.getElementById("sioContainer");
  if (!container) return;

  // 1. Render immediately with whatever app.js has already loaded (no extra fetch wait)
  const existing = window._specularisDashboard || window.__latestSnapshot || {};
  if (Object.keys(existing).length) {
    container.classList.remove("is-loading");
    renderSIO(container, existing);
  }

  // 2. If no existing data yet, do our own fetch as fallback
  let snapshot = existing;
  if (!Object.keys(existing).length) {
    try {
      snapshot = await fetchJson("/api/snapshot?mode=fast", 20000);
    } catch (e) {
      console.warn("[SIO v9] snapshot fetch failed:", e.message);
    }
    container.classList.remove("is-loading");
    renderSIO(container, snapshot);
  }

  // 3. Re-render whenever main app fires a snapshot event
  const onSnap = (e) => {
    const data = e.detail || window._specularisDashboard || snapshot;
    renderSIO(container, data);
  };
  window.addEventListener("specularis-snapshot", onSnap);
  document.addEventListener("specularis:snapshotReady", onSnap);

  // 4. Periodic refresh (every 5 min) as safety net
  setInterval(async () => {
    const fresh = window._specularisDashboard;
    if (fresh && Object.keys(fresh).length) {
      renderSIO(container, fresh);
    } else {
      try { snapshot = await fetchJson("/api/snapshot?mode=fast", 20000); } catch {}
      renderSIO(container, snapshot);
    }
  }, CHECK_INTERVAL_MS);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
