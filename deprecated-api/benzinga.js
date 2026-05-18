import { json } from "./_utils.js";

export default async function handler(_req, res) {
  // Benzinga's official market news APIs require an API key. Set up a private
  // server adapter here when a key is available; frontend fallback remains safe.
  json(res, 501, { error: "Configure BENZINGA_API_KEY or a Benzinga adapter for live movers/news." }, 10);
}
