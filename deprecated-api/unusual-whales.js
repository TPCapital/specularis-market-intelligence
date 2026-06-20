import { json } from "./_utils.js";

export default async function handler(_req, res) {
  // Unusual Whales requires authenticated access for reliable options flow.
  json(res, 501, { error: "Configure an Unusual Whales adapter for live options flow." }, 10);
}
