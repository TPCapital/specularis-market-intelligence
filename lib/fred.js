import { fetchJson, noStoreJson } from "../lib/utils.js";

const SERIES = ["FEDFUNDS", "DGS10", "DGS2", "UNRATE", "CPIAUCSL"];

function unavailable(reason = "FRED_API_KEY is not configured") {
  return {
    status: "unavailable",
    dataQuality: "unavailable",
    isTradable: false,
    source: "FRED",
    error: { code: "FRED_UNAVAILABLE", message: reason }
  };
}

export default async function handler(req, res) {
  const token = process.env.FRED_API_KEY;
  if (!token) {
    noStoreJson(res, 200, unavailable());
    return;
  }
  try {
    const series = String(req.query?.series || SERIES.join(",")).split(",").map((item) => item.trim()).filter(Boolean);
    const data = await Promise.all(series.map(async (id) => {
      try {
        const payload = await fetchJson(`https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(id)}&api_key=${encodeURIComponent(token)}&file_type=json&sort_order=desc&limit=2`, { timeoutMs: 4500 });
        const latest = payload.observations?.[0];
        return { id, date: latest?.date, value: latest?.value };
      } catch (error) {
        return { id, error: error.message };
      }
    }));
    noStoreJson(res, 200, { status: "delayed", dataQuality: "delayed", isTradable: true, source: "FRED", data });
  } catch (error) {
    noStoreJson(res, 200, unavailable(error.message));
  }
}
