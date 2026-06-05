import { noStoreJson } from "./_lib/utils.js";
import { buildSnapshot } from "./_lib/engines/snapshot-engine.js";
import { buildNarrativeReport } from "./_lib/engines/narrative-engine.js";

export default async function handler(req, res) {
  try {
    const snapshot = await buildSnapshot(req);
    const provider = req?.query?.provider || undefined;
    const disableAI = String(req?.query?.rules || "").toLowerCase() === "1" || String(req?.query?.rules || "").toLowerCase() === "true";
    const report = await buildNarrativeReport(snapshot, { provider, disableAI });
    noStoreJson(res, 200, report);
  } catch (error) {
    noStoreJson(res, 200, {
      title: `AI Market Daily Report | ${new Date().toISOString().slice(0, 10)}`,
      generatedAt: Date.now(),
      provider: "daily-report-error",
      status: "fallback",
      summary: "Daily report engine could not obtain a reliable snapshot. Please refresh later.",
      error: error.message,
      sections: []
    });
  }
}
