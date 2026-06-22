// lib/treasury-yields.js
// Official US Treasury yield data — completely free, no API key required
// Source: https://home.treasury.gov/resource-center/data-chart-center/interest-rates/
// XML endpoint updated daily by US Treasury
// Falls back to DollarLiquidity.com real-yield-10y if Treasury is unavailable

const TIMEOUT = 9000;

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Specularis-MarketTerminal/7.2 (research)",
        "Accept": "application/xml, text/xml, */*",
      },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { clearTimeout(t); return null; }
}

// Get current month XML URL
function getTreasuryXmlUrl(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${y}${m}`;
}

// Parse Treasury XML to extract latest yield row
function parseYieldsXml(xml) {
  if (!xml) return null;
  // Extract all <G_BC_CAT> entries
  const entries = [];
  const entryRe = /<G_BC_CAT>([\s\S]*?)<\/G_BC_CAT>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const getVal = (tag) => {
      const match = block.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
      return match ? match[1].trim() : null;
    };
    const date = getVal("NEW_DATE");
    const y1m  = parseFloat(getVal("BC_1MONTH")  || getVal("BC_1_MONTH"));
    const y3m  = parseFloat(getVal("BC_3MONTH")  || getVal("BC_3_MONTH"));
    const y6m  = parseFloat(getVal("BC_6MONTH")  || getVal("BC_6_MONTH"));
    const y1y  = parseFloat(getVal("BC_1YEAR"));
    const y2y  = parseFloat(getVal("BC_2YEAR"));
    const y3y  = parseFloat(getVal("BC_3YEAR"));
    const y5y  = parseFloat(getVal("BC_5YEAR"));
    const y7y  = parseFloat(getVal("BC_7YEAR"));
    const y10y = parseFloat(getVal("BC_10YEAR"));
    const y20y = parseFloat(getVal("BC_20YEAR"));
    const y30y = parseFloat(getVal("BC_30YEAR"));
    if (date && !isNaN(y10y)) {
      entries.push({ date, y1m, y3m, y6m, y1y, y2y, y3y, y5y, y7y, y10y, y20y, y30y });
    }
  }
  if (!entries.length) return null;
  // Sort descending — newest first
  entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  return entries[0]; // most recent
}

export async function getTreasuryYields() {
  const now = new Date();

  // Try current month, then previous month as fallback
  const urls = [
    getTreasuryXmlUrl(now),
    getTreasuryXmlUrl(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
  ];

  for (const url of urls) {
    const xml = await fetchText(url);
    const yields = parseYieldsXml(xml);
    if (yields) {
      const spread = (yields.y10y && yields.y2y) ? +(yields.y10y - yields.y2y).toFixed(3) : null;
      return {
        source:   "US Treasury (official)",
        date:     yields.date,
        y1m:      yields.y1m   || null,
        y3m:      yields.y3m   || null,
        y6m:      yields.y6m   || null,
        y1y:      yields.y1y   || null,
        dgs2:     yields.y2y   || null,
        dgs5:     yields.y5y   || null,
        dgs10:    yields.y10y  || null,
        dgs30:    yields.y30y  || null,
        twoTen:   spread,
        quality:  "LIVE",
        ok:       true,
      };
    }
  }

  return { source: "US Treasury", ok: false, dgs2: null, dgs10: null, dgs30: null, twoTen: null };
}
