// api/event-monitor.js — PanWatch-style event detection endpoint
// Accepts a snapshot payload and detects significant market events.
// Called by frontend every 60s during market hours.

export const config = { maxDuration: 15 };

const THRESHOLDS = {
  rvol: 2.0,
  strongUp: 3.0,
  strongDown: -3.0,
  vixSpike: 5.0,
};

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const events = [];
  let body = {};
  try {
    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
  } catch {}

  const rows = [
    ...(body.opportunities||[]),
    ...(body.movers||[]),
  ].slice(0,20);

  for (const row of rows) {
    const sym = row.ticker||row.symbol||"";
    const chg  = Number(row.changePercent??row.change??0);
    const rvol = Number(row.relativeVolume??row.rvol??1);
    if (!sym) continue;
    if (rvol >= THRESHOLDS.rvol) {
      events.push({ type:"VOLUME_SPIKE", ticker:sym, detail:`RVOL ${rvol.toFixed(1)}x`, ts: Date.now() });
    }
    if (chg >= THRESHOLDS.strongUp) {
      events.push({ type:"BREAKOUT", ticker:sym, detail:`+${chg.toFixed(1)}%`, ts: Date.now() });
    }
    if (chg <= THRESHOLDS.strongDown) {
      events.push({ type:"SELLOFF", ticker:sym, detail:`${chg.toFixed(1)}%`, ts: Date.now() });
    }
  }

  res.status(200).json({ events, generatedAt: new Date().toISOString(), count: events.length });
}
