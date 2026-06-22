// modules/position-tracker.js — PanWatch-style Position Tracker
// Stores positions in localStorage, monitors stop-loss/take-profit thresholds,
// emits events to the event banner when triggered.

const STORAGE_KEY = "specularis-v9:positions";
const POLL_INTERVAL_MS = 60_000; // 1-minute event poll (PanWatch Agent Loop style)

function loadPositions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch { return []; }
}

function savePositions(positions) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)); } catch {}
}

function esc(v) {
  return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function pnlPct(pos, currentPrice) {
  const cp = Number(currentPrice||0);
  const cost = Number(pos.costPrice||0);
  if (!cp||!cost) return null;
  return ((cp-cost)/cost)*100;
}

function renderPositions(container, positions, quoteMap={}) {
  const alerts = [];

  const cards = positions.map(pos => {
    const cp = quoteMap[pos.ticker];
    const pnl = cp!=null ? pnlPct(pos, cp) : null;
    const stopPct = Number(pos.stopLoss||0);
    const targetPct = Number(pos.takeProfit||0);
    let cardClass = "watch";
    if (pnl!=null) {
      if (pnl>0) cardClass="profit";
      else if (pnl<0) cardClass="loss";
      if (stopPct && pnl <= -Math.abs(stopPct)) {
        alerts.push({ type:"STOP_LOSS", ticker:pos.ticker, detail:`持仓跌幅 ${pnl.toFixed(1)}% 触达止损线 -${Math.abs(stopPct).toFixed(1)}%` });
      }
      if (targetPct && pnl >= Math.abs(targetPct)) {
        alerts.push({ type:"TAKE_PROFIT", ticker:pos.ticker, detail:`持仓涨幅 +${pnl.toFixed(1)}% 触达止盈线 +${Math.abs(targetPct).toFixed(1)}%` });
      }
    }
    return `
    <div class="position-card ${cardClass}">
      <button class="position-delete-btn" data-id="${esc(pos.id)}">删除</button>
      <div class="position-card-header">
        <span class="position-ticker">${esc(pos.ticker)}</span>
        <span class="position-pnl ${pnl>=0?'pos':'neg'}">
          ${pnl!=null ? (pnl>=0?'+':'')+pnl.toFixed(2)+'%' : '--'}
        </span>
      </div>
      <div class="position-meta">
        <span>成本价 <strong>${esc(pos.costPrice)}</strong></span>
        <span>当前价 <strong>${cp!=null?Number(cp).toFixed(2):'--'}</strong></span>
        <span>数量 <strong>${esc(pos.qty||1)}股</strong></span>
        <span>方向 <strong>${pos.direction==='short'?'做空':'做多'}</strong></span>
      </div>
      ${pos.note?`<p style="font-size:.73rem;color:#64748b;margin:4px 0">${esc(pos.note)}</p>`:''}
      <div class="position-levels">
        <span class="level-stop">止损 -${Math.abs(stopPct).toFixed(1)}%</span>
        <span class="level-target">止盈 +${Math.abs(targetPct).toFixed(1)}%</span>
      </div>
    </div>`;
  }).join("");

  const alertHtml = alerts.length ? `
    <div class="position-alert-bar">
      ⚡ 预警触发: ${alerts.map(a=>`<strong>${esc(a.ticker)}</strong> ${esc(a.detail)}`).join(" · ")}
    </div>` : "";

  const formHtml = `
    <div class="add-position-form">
      <h3>+ 录入持仓</h3>
      <div class="form-row">
        <div><label class="form-label">股票代码</label><input class="form-input" id="posTickerInput" placeholder="NVDA" /></div>
        <div><label class="form-label">成本价 ($)</label><input class="form-input" id="posCostInput" type="number" placeholder="450.00" /></div>
        <div><label class="form-label">数量 (股)</label><input class="form-input" id="posQtyInput" type="number" placeholder="10" /></div>
      </div>
      <div class="form-row">
        <div><label class="form-label">止损 (%)</label><input class="form-input" id="posStopInput" type="number" placeholder="7" /></div>
        <div><label class="form-label">止盈 (%)</label><input class="form-input" id="posTargetInput" type="number" placeholder="15" /></div>
        <div><label class="form-label">备注</label><input class="form-input" id="posNoteInput" placeholder="催化/逻辑" /></div>
      </div>
      <button class="btn-add-position" id="addPositionBtn">录入持仓</button>
    </div>`;

  container.innerHTML = `
    ${formHtml}
    ${alertHtml}
    ${positions.length
      ? `<div class="positions-grid">${cards}</div>`
      : `<div class="position-empty">暂无持仓记录<br>在上方录入您的持仓，系统将自动监控止损止盈。</div>`}
  `;

  // Bind add button
  container.querySelector("#addPositionBtn")?.addEventListener("click", () => {
    const ticker = (container.querySelector("#posTickerInput")?.value||"").trim().toUpperCase();
    const cost   = Number(container.querySelector("#posCostInput")?.value||0);
    const qty    = Number(container.querySelector("#posQtyInput")?.value||1);
    const stop   = Number(container.querySelector("#posStopInput")?.value||7);
    const target = Number(container.querySelector("#posTargetInput")?.value||15);
    const note   = (container.querySelector("#posNoteInput")?.value||"").trim();
    if (!ticker||!cost) return;
    const positions = loadPositions();
    positions.push({ id: Date.now().toString(), ticker, costPrice:cost, qty, stopLoss:stop, takeProfit:target, note, direction:"long", addedAt: new Date().toISOString() });
    savePositions(positions);
    renderPositions(container, positions, quoteMap);
  });

  // Bind delete buttons
  container.querySelectorAll(".position-delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const positions = loadPositions().filter(p=>p.id!==id);
      savePositions(positions);
      renderPositions(container, positions, quoteMap);
    });
  });

  // Show alerts in global banner
  if (alerts.length) {
    const banner = document.getElementById("eventBanner");
    if (banner) {
      banner.style.display = "flex";
      banner.innerHTML = alerts.map(a=>`<div class="event-item">⚠️ <strong>${esc(a.ticker)}</strong> — ${esc(a.detail)}</div>`).join("");
      setTimeout(()=>{ banner.style.display="none"; }, 15000);
    }
  }
}

async function fetchQuotes(tickers) {
  const quoteMap = {};
  try {
    const snap = await fetch("/api/snapshot?mode=fast",{cache:"no-store",headers:{Accept:"application/json"}}).then(r=>r.json());
    const quotes = [
      ...(snap?.marketData?.quotes||[]),
      ...(snap?.sources?.marketData?.data?.quotes||[]),
      ...(snap?.terminalLite?.quotes||[]),
    ];
    for (const q of quotes) {
      const sym = q.symbol||q.ticker;
      if (sym) quoteMap[sym] = q.price??q.value??q.close;
    }
  } catch {}
  return quoteMap;
}

async function boot() {
  const container = document.getElementById("positionsContainer");
  if (!container) return;

  let positions = loadPositions();
  let quoteMap = {};
  try { quoteMap = await fetchQuotes(positions.map(p=>p.ticker)); } catch {}
  renderPositions(container, positions, quoteMap);

  // PanWatch-style poll loop
  setInterval(async () => {
    positions = loadPositions();
    try { quoteMap = await fetchQuotes(positions.map(p=>p.ticker)); } catch {}
    // Only re-render if tab is active
    const tab = document.querySelector('[data-workspace="positions"]');
    if (tab?.classList.contains("is-active") || document.querySelector('.workspace-view[data-workspace="positions"].is-active')) {
      renderPositions(container, positions, quoteMap);
    }
  }, POLL_INTERVAL_MS);
}

if (document.readyState==="loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else { boot(); }
