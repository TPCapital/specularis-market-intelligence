import { noStoreJson } from "../lib/utils.js";
import { buildSnapshot } from "./snapshot.js";

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
        permission: "只看不做",
        actionBias: "等待确认",
        title: "C｜等待确认",
        summary: "交易决策引擎未获得足够数据，等待下一次快照。"
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
        permission: "禁止交易",
        actionBias: "等待恢复",
        title: "NO TRADE｜数据异常",
        summary: "Trade Decision Engine 暂时不可用。"
      }
    });
  }
}
