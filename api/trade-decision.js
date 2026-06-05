import { noStoreJson } from "./_lib/utils.js";
import { buildSnapshot } from "./_lib/engines/snapshot-engine.js";

export default async function handler(req, res) {
  try {
    const snapshot = await buildSnapshot(req);
    const tradeDecision = snapshot.tradeDecision || snapshot.sources?.tradeDecision?.data || snapshot.sources?.decisionEngine?.data?.tradeDecision || null;
    noStoreJson(res, 200, {
      generatedAt: snapshot.generatedAt || Date.now(),
      runtimeMode: snapshot.runtimeMode || "fast",
      status: tradeDecision ? "ok" : "fallback",
      tradeDecision: tradeDecision || {
        grade: "C",
        score: 50,
        direction: "WAIT",
        permission: "watch-only",
        actionBias: "wait for confirmation",
        title: "C | Waiting for confirmation",
        summary: "Trade decision engine did not receive enough data. Wait for the next snapshot."
      },
      marketRegime: snapshot.marketRegime || snapshot.riskRegime || {},
      cache: snapshot.cacheWriteStatus || null
    });
  } catch (error) {
    noStoreJson(res, 200, {
      generatedAt: Date.now(),
      status: "error",
      error: error.message,
      tradeDecision: {
        grade: "NO TRADE",
        score: 0,
        direction: "WAIT",
        permission: "no-trade",
        actionBias: "wait for recovery",
        title: "NO TRADE | Data unavailable",
        summary: "Trade Decision Engine is temporarily unavailable."
      }
    });
  }
}
