import { json } from "./_utils.js";

export default async function handler(_req, res) {
  // X/Twitter official data access requires credentials; this endpoint is kept
  // as the macro-news adapter boundary.
  json(res, 501, { error: "Configure X API credentials or a macro feed adapter." }, 10);
}
