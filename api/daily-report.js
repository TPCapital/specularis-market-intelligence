/**
 * /api/daily-report
 * ──────────────────
 * AI-generated daily market narrative report.
 * Uses Claude (ANTHROPIC_API_KEY) → OpenAI (OPENAI_API_KEY) → rule-based fallback.
 *
 * Query params:
 *   ?provider=claude|openai|rules  (default: auto)
 *   ?rules=1                        (force rule-based, no AI call)
 */

import { noStoreJson } from "../lib/utils.js";
import { buildNarrativeReport } from "../lib/narrative-engine.js";
import { buildSnapshot } from "./snapshot.js";

export default async function handler(req, res) {
  try {
    const snapshot = await buildSnapshot(req);
    const provider = req?.query?.provider || undefined;
    const disableAI =
      String(req?.query?.rules || "").toLowerCase() === "1" ||
      String(req?.query?.rules || "").toLowerCase() === "true";
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
