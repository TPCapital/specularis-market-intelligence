import { noStoreJson } from "./_utils.js";
import { buildSnapshot } from "./snapshot.js";

export default async function handler(req, res) {
  try {
    const snapshot = await buildSnapshot(req);
    noStoreJson(res, 200, {
      ok: true,
      generatedAt: snapshot.generatedAt,
      sources: Object.fromEntries(
        Object.entries(snapshot.sources || {}).map(([key, value]) => [key, value.status])
      )
    });
  } catch (error) {
    noStoreJson(res, 502, { ok: false, error: error.message });
  }
}
