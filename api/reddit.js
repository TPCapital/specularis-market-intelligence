import { fetchJson, json } from "../lib/utils.js";

export default async function handler(_req, res) {
  try {
    const payload = await fetchJson("https://www.reddit.com/r/wallstreetbets/hot.json?limit=50", {
      headers: {
        "User-Agent": "AIEquityDashboard/1.0 by dashboard"
      }
    });
    json(res, 200, payload, 60);
  } catch (error) {
    json(res, 502, { error: "Reddit upstream unavailable", detail: error.message }, 10);
  }
}
