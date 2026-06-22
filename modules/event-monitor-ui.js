// modules/event-monitor-ui.js — PanWatch-style event monitor UI bridge
// Listens to snapshot updates and fires events to the banner

const THRESHOLDS = { rvol: 2.0, strongUp: 3.0, strongDown: -3.0 };
let prevData = null;

function esc(v){ return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

function detectAndBroadcast(snapshot) {
  const rows = [
    ...(snapshot?.terminalLite?.opportunities||[]),
    ...(snapshot?.opportunities||[]),
    ...(snapshot?.movers||[]),
  ].slice(0,20);

  if (!prevData) { prevData = rows; return; }
  const prev = new Map(prevData.map(r=>[r.ticker||r.symbol,r]));
  const events = [];

  for (const row of rows) {
    const sym = row.ticker||row.symbol;
    if (!sym) continue;
    const p = prev.get(sym)||{};
    const chg = Number(row.changePercent??row.change??0);
    const rvol = Number(row.relativeVolume??row.rvol??1);
    const prevChg = Number(p.changePercent??p.change??0);
    const prevRvol = Number(p.relativeVolume??p.rvol??1);

    if (rvol>=THRESHOLDS.rvol && prevRvol<THRESHOLDS.rvol) {
      events.push({ ticker:sym, detail:`RVOL ${rvol.toFixed(1)}x 异常放量`, color:"#38bdf8" });
    }
    if (chg>=THRESHOLDS.strongUp && prevChg<THRESHOLDS.strongUp) {
      events.push({ ticker:sym, detail:`+${chg.toFixed(1)}% 突破性上涨`, color:"#22c55e" });
    }
    if (chg<=THRESHOLDS.strongDown && prevChg>THRESHOLDS.strongDown) {
      events.push({ ticker:sym, detail:`${chg.toFixed(1)}% 异常下挫`, color:"#ef4444" });
    }
  }

  prevData = rows;

  if (events.length) {
    const banner = document.getElementById("eventBanner");
    const badge  = document.getElementById("eventAlertBadge");
    if (banner) {
      banner.style.display = "flex";
      banner.innerHTML = events.slice(0,4).map(ev=>
        `<div class="event-item" style="border-color:${ev.color}20">
          <strong style="color:${ev.color}">${esc(ev.ticker)}</strong>
          <span>${esc(ev.detail)}</span>
        </div>`).join("");
      setTimeout(()=>{ banner.style.display="none"; }, 15000);
    }
    if (badge) {
      badge.style.display = "inline-block";
      const cur = parseInt(badge.textContent.replace(/\D/g,""))||0;
      badge.textContent = `⚡ ${cur+events.length}`;
    }
  }
}

window.addEventListener("specularis-snapshot", (e) => {
  try { detectAndBroadcast(e.detail||{}); } catch {}
});
