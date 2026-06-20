import { noStoreJson } from "../lib/utils.js";
import { buildSnapshot } from "./snapshot.js";
import { buildNarrativeReport } from "../lib/narrative-engine.js";

export default async function handler(req, res) {
  try {
    const snapshot = await buildSnapshot(req);
    const provider = req?.query?.provider || undefined;
    const disableAI = String(req?.query?.rules || "").toLowerCase() === "1" || String(req?.query?.rules || "").toLowerCase() === "true";
    const report = await buildNarrativeReport(snapshot, { provider, disableAI });
    noStoreJson(res, 200, report);
  } catch (error) {
    noStoreJson(res, 200, {
      title: `AI美股日报｜${new Date().toLocaleDateString("zh-CN")}`,
      generatedAt: Date.now(),
      provider: "daily-report-error",
      status: "fallback",
      summary: "日报引擎暂时无法获取可靠快照，请稍后刷新。",
      error: error.message,
      sections: []
    });
  }
}
