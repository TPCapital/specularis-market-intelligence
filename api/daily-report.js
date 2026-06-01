import { noStoreJson } from "../lib/utils.js";
import { buildSnapshot } from "./snapshot.js";

function pct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "--";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function displayRisk(mode) {
  if (mode === "Risk-On") return "风险偏好开启";
  if (mode === "Risk-Off") return "风险规避升温";
  if (mode === "Neutral") return "中性震荡";
  return "等待确认";
}

function getSnapshotArray(snapshot, path, fallback = []) {
  try {
    return path.split(".").reduce((acc, key) => acc?.[key], snapshot) || fallback;
  } catch {
    return fallback;
  }
}

function buildReport(snapshot = {}) {
  const sources = snapshot.sources || {};
  const marketData = sources.marketData?.data || snapshot.marketData || {};
  const indices = marketData.indices || snapshot.indices || [];
  const quotes = marketData.quotes || [];
  const risk = snapshot.risk || snapshot.marketRegime || sources.decisionEngine?.data?.marketRegime || {};
  const sectors = sources.sectorHeat?.data || sources.finviz?.data || snapshot.sectors || [];
  const movers = sources.newsCatalysts?.data?.movers || sources.benzinga?.data?.movers || snapshot.premarket?.movers || [];
  const momentum = sources.premarketMomentum?.data?.leaders || snapshot.premarket?.momentum?.leaders || [];
  const news = sources.newsCatalysts?.data?.news || sources.benzinga?.data?.news || sources.newsAggregator?.data?.news || [];
  const options = sources.optionsSignals?.data?.cards || sources.optionsSignals?.data || sources.unusualWhales?.data || [];
  const breadth = sources.marketBreadth?.data || snapshot.breadth || {};
  const marketStructure = sources.marketStructurePro?.data || snapshot.marketStructurePro || {};
  const sectorRotation = marketStructure.sectorRotation || {};
  const yieldCurve = marketStructure.yieldCurve || snapshot.yieldCurve || {};
  const oil = marketStructure.oil || snapshot.oil || {};
  const fedWatch = marketStructure.fedWatch || snapshot.fedWatch || {};
  const breadthPro = marketStructure.breadthPro || snapshot.breadthPro || {};
  const topSector = sectors[0]?.sector || sectors[0]?.name || "等待确认";
  const topMovers = movers.slice(0, 6).map((m) => `${m.symbol || "--"} ${pct(m.change)} ${m.reason || m.summary || ""}`.trim());
  const topMomentum = momentum.slice(0, 6).map((m) => `${m.symbol || "--"} ${m.momentumScore || m.score || "观察"}分`);
  const topNews = news.slice(0, 6).map((n) => `${n.ticker || "MACRO"}｜${n.title || n.originalTitle || n.headline || "新闻催化"}`);
  const indexLine = indices.slice(0, 8).map((i) => `${i.id || i.symbol}: ${i.value ?? "--"} ${pct(i.change)}`).join("；") || "暂无可靠指数快照";
  const sectorRows = sectorRotation.rows || sectors;
  const sectorLine = sectorRows.slice(0, 8).map((s) => `${s.sector || s.name}: ${s.score ?? "--"}${s.change !== undefined ? ` (${pct(s.change)})` : ""}`).join(" / ") || "等待板块源刷新";
  const yieldLine = `2Y ${yieldCurve.dgs2 ?? "--"} / 10Y ${yieldCurve.dgs10 ?? "--"} / 30Y ${yieldCurve.dgs30 ?? "--"}；2Y-10Y ${yieldCurve.twoTen ?? "--"}；状态 ${yieldCurve.curveState || "等待确认"}`;
  const oilLine = Array.isArray(oil.rows) ? oil.rows.map((row) => `${row.name || row.symbol}: ${row.price ?? "--"} ${pct(row.changePercent)}`).join("；") : "等待原油数据";
  const fedLine = `近端降息概率 ${fedWatch.nearCutProbability ?? "--"}%；年内降息次数代理 ${fedWatch.yearEndCuts ?? "--"}；${fedWatch.impliedPath || "等待确认"}`;
  const breadthLine = `Breadth Score ${breadthPro.breadthScore ?? breadth.breadthScore ?? "--"}；>20MA ${breadthPro.percentAbove20 ?? "--"}%；>50MA ${breadthPro.percentAbove50 ?? "--"}%；>200MA ${breadthPro.percentAbove200 ?? "--"}%`;
  const optionLine = Array.isArray(options) && options.length
    ? options.slice(0, 6).map((o) => `${o.symbol || "--"} ${o.direction || o.conviction || o.type || "WATCH"} ${o.score ?? ""}`.trim()).join(" / ")
    : "当前仍为 Options Proxy，不是真实 sweep / block trade。";

  return {
    title: `AI美股收盘日报｜${new Date(snapshot.generatedAt || Date.now()).toLocaleDateString("zh-CN")}`,
    generatedAt: snapshot.generatedAt || Date.now(),
    cacheAdapter: snapshot.cacheAdapter || snapshot.cacheWriteStatus?.adapter || "unknown",
    summary: `${displayRisk(risk.mode)}；主线板块：${topSector}；重点动能：${topMomentum.join(" / ") || "等待确认"}。`,
    sections: [
      { id: "00", title: "今日一句话总结", body: `${displayRisk(risk.mode)}。${risk.conclusion || snapshot.summary?.strategy || "市场等待更多实时数据确认。"}` },
      { id: "01", title: "大盘表现总览", body: indexLine },
      { id: "02", title: "盘中走势复盘", body: snapshot.marketSummary || "重点观察 SPY / QQQ 是否维持 VWAP 上方、VIX 是否继续回落、主线是否从单一龙头扩散。" },
      { id: "03", title: "宏观环境", body: `${yieldLine}。${oilLine}。${fedLine}。${yieldCurve.explanation || "收益率曲线等待确认。"}` },
      { id: "04", title: "板块表现 / 主题风格", body: `${sectorLine}。${sectorRotation.explanation || "板块轮动等待确认。"}` },
      { id: "05", title: "市场宽度与参与度", body: `${breadthLine}。${breadthPro.explanation || breadth.explanation || "当前以板块扩散、异动数量、机会榜数量和相对成交量作为宽度代理。"}` },
      { id: "06", title: "技术面分析", body: "确认链：指数方向 → VWAP → 相对成交量 → 板块共振 → 个股新闻催化。没有 VWAP 和量能确认，不把盘前强势直接当入场信号。" },
      { id: "07", title: "重点个股新闻与异动", body: topMovers.join("；") || "暂无可靠盘前异动。" },
      { id: "08", title: "AI硬件 / 半导体", body: "重点观察 NVDA / AMD / AVGO / MRVL / SMH。若 SMH 强于 QQQ，AI硬件仍是主线；若 SMH 转弱但软件扩散，切换到 PLTR / ORCL / CRWD。" },
      { id: "09", title: "软件 / AI应用", body: "重点观察 PLTR / ORCL / CRWD / NOW / SNOW。软件线最适合做补涨，但必须确认相对成交量。" },
      { id: "10", title: "机构观点与资金流", body: `${topNews.join("；") || "新闻源等待刷新"}。期权层：${optionLine}` },
      { id: "11", title: "板块轮动判断", body: `资金关注：${topSector}。若前二板块得分明显高于其他板块，优先只做主线，不做杂乱机会。` },
      { id: "12", title: "重点关注股观察", body: topMomentum.join(" / ") || quotes.slice(0, 8).map((q) => q.symbol).join(" / ") || "等待观察名单。" },
      { id: "13", title: "明日交易计划", body: snapshot.tradePlan?.body || "开盘 15 分钟后确认：QQQ / SPY 同向、VIX 不反弹、目标股 RVOL > 1.5x、回踩 VWAP 后有承接。" },
      { id: "14", title: "风险提示", body: "若 QQQ 跌破开盘区间低点、VIX 反弹、美债上行、AI龙头放量回落，取消追涨计划。" },
      { id: "15", title: "最终结论", body: `${displayRisk(risk.mode)}。当前系统提供交易辅助，不构成投资建议；优先做确认后的主线顺势机会，避免低质量无量追高。` }
    ]
  };
}

export default async function handler(req, res) {
  try {
    const snapshot = await buildSnapshot(req);
    noStoreJson(res, 200, buildReport(snapshot));
  } catch (error) {
    noStoreJson(res, 200, {
      title: `AI美股收盘日报｜${new Date().toLocaleDateString("zh-CN")}`,
      generatedAt: Date.now(),
      error: error.message,
      summary: "日报引擎暂时无法获取可靠快照，请稍后刷新。",
      sections: []
    });
  }
}
