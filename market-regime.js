import { json } from "../lib/utils.js";

export default async function handler(_req, res) {
  // Finviz heatmap does not provide a stable public JSON API for browser apps.
  // Keep this endpoint so a server-side scraper or paid data adapter can be
  // plugged in without changing the frontend contract.
  json(res, 501, { error: "Configure a Finviz heatmap adapter for live sector flow." }, 10);
}
