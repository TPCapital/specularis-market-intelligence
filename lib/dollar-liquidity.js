// lib/dollar-liquidity.js
// DollarLiquidity.com Free API — no API key required
// https://dollarliquidity.com/en/api-docs
// Endpoints: GET /api/regime | /api/series/{id}?days=N | /api/correlation
// Indicators: tga, fed-balance-sheet, onrrp, vix, hy-spread, real-yield-10y,
//             dollar-index, sofr-iorb, srf, bank-cash-buffer, net-liquidity, m2

const BASE = "https://dollarliquidity.com";
const TIMEOUT = 8000;

async function dlFetch(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Specularis-MarketTerminal/7.2 (research; contact@specularis.app)",
      },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(t);
    return null;
  }
}

function lastValue(data) {
  if (!data?.data?.length) return null;
  return data.data[data.data.length - 1]; // ascending — last is newest
}

// ── Regime / Composite Score ──────────────────────────────────────────────────
export async function getLiquidityRegime() {
  const d = await dlFetch("/api/regime");
  if (!d) return null;
  return {
    status:       d.status || "unknown",       // "tight" | "neutral" | "easy"
    score:        d.percentile5y ?? null,       // 0-100 percentile
    momentum:     d.momentum ?? null,           // direction
    confidence:   d.confidence ?? null,
    keyDrivers:   d.keyDrivers || [],
    updatedAt:    d.updatedAt || null,
  };
}

// ── Key Series (latest values + z-scores) ────────────────────────────────────
export async function getLiquiditySeries(days = 7) {
  const SERIES = [
    "tga", "fed-balance-sheet", "onrrp",
    "net-liquidity", "hy-spread", "real-yield-10y",
    "sofr-iorb", "bank-cash-buffer", "m2",
  ];

  const results = await Promise.allSettled(
    SERIES.map(id => dlFetch(`/api/series/${id}?days=${days}`))
  );

  const out = {};
  SERIES.forEach((id, i) => {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      const latest = lastValue(r.value);
      out[id] = {
        value:      latest?.value ?? null,
        zScore:     latest?.zScore ?? null,
        percentile: r.value?.meta?.percentile ?? null,
        date:       latest?.date ?? null,
      };
    } else {
      out[id] = { value: null, zScore: null, percentile: null, date: null };
    }
  });
  return out;
}

// ── Correlations (SPX/QQQ/BTC/GOLD vs liquidity score) ───────────────────────
export async function getLiquidityCorrelation() {
  const d = await dlFetch("/api/correlation");
  if (!d) return null;
  return d;
}

// ── Compound fetch: regime + key series in parallel ───────────────────────────
export async function getDollarLiquiditySnapshot() {
  const [regime, series] = await Promise.all([
    getLiquidityRegime(),
    getLiquiditySeries(7),
  ]);
  return { regime, series, source: "dollarliquidity.com", asOf: new Date().toISOString() };
}
