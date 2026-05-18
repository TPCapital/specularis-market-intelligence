import { fetchJson, noStoreJson } from "../lib/utils.js";

function unavailable(reason = "ALPHAVANTAGE_API_KEY is not configured") {
  return {
    status: "unavailable",
    dataQuality: "unavailable",
    isTradable: false,
    source: "AlphaVantage",
    error: { code: "ALPHAVANTAGE_UNAVAILABLE", message: reason }
  };
}

export default async function handler(req, res) {
  const token = process.env.ALPHAVANTAGE_API_KEY;
  if (!token) {
    noStoreJson(res, 200, unavailable());
    return;
  }
  try {
    const mode = String(req.query?.mode || "treasury");
    if (mode === "sector") {
      const data = await fetchJson(`https://www.alphavantage.co/query?function=SECTOR&apikey=${encodeURIComponent(token)}`, { timeoutMs: 10000 });
      noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "AlphaVantage", data });
      return;
    }
    if (mode === "earnings") {
      const data = await fetchJson(`https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${encodeURIComponent(token)}`, { timeoutMs: 10000 });
      noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "AlphaVantage", data });
      return;
    }
    // default treasury/macro daily view
    const [dgs10, dgs2, cpi] = await Promise.all([
      fetchJson(`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 10000 }).catch(() => null),
      fetchJson(`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=2year&apikey=${encodeURIComponent(token)}`, { timeoutMs: 10000 }).catch(() => null),
      fetchJson(`https://www.alphavantage.co/query?function=INFLATION&apikey=${encodeURIComponent(token)}`, { timeoutMs: 10000 }).catch(() => null)
    ]);
    noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "AlphaVantage", data: { dgs10, dgs2, cpi } });
  } catch (error) {
    noStoreJson(res, 200, unavailable(error.message));
  }
}
