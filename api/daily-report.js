import { noStoreJson } from "../lib/utils.js";
import { buildSnapshot } from "./snapshot.js";

function pct(value) {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function cnRisk(mode) {
  if (mode === "Risk-On") return "风险偏好开启";
  if (mode === "Risk-Off") return "风险规避";
  if (mode === "Neutral") return "中性震荡";
  return mode || "等待确认";
}

function buildReport(snapshot = {}) {
  const sources = snapshot.sources || {};
  const market = sources.marketData?.data || sources.marketData || {};
  const indices = market.indices || [];
  const regime = snapshot.riskRegime || sources.decisionEngine?.data?.marketRegime || {};
  const sectors = sources.sectorHeat?.data || sources.finviz?.data || [];
  const movers = sources.newsCatalysts?.data?.movers || sources.benzinga?.data?.movers || [];
  const news = sources.newsCatalysts?.data?.news || sources.benzinga?.data?.news || [];
  const options = sources.optionsSignals?.data || sources.unusualWhales?.data || [];
  const topSector = sectors[0]?.sector || sectors[0]?.name || "等待确认";
  const topMovers = movers.slice(0, 5).map((m) => `${m.symbol} ${pct(m.change)} ${m.reason || ""}`).join("；") || "暂无可靠异动";
  const indexLine = indices.slice(0, 7).map((i) => `${i.id} ${i.value ?? "--"} ${pct(i.change)}`).join("；");
  const sectorLine = sectors.slice(0, 6).map((s) => `${s.sector || s.name} ${s.score ?? "--"}`).join(" / ");
  const newsLine = news.slice(0, 5).map((n) => `${n.ticker || "MACRO"}｜${n.title || n.originalTitle}`).join("；") || "暂无可靠新闻催化";
  const optionLine = options.slice(0, 5).map((o) => `${o.symbol} ${o.direction || o.conviction || o.type || "WATCH"} ${o.score ?? ""}`).join(" / ") || "暂无真实期权流，维持代理观察";

  return {
    title: `美股收盘日报｜${new Date(snapshot.generatedAt || Date.now()).toLocaleDateString("zh-CN")}`,
    generatedAt: snapshot.generatedAt || Date.now(),
    summary: `${cnRisk(regime.mode || regime.type)}；主线板块：${topSector}；重点异动：${topMovers}。`,
    sections: [
      { title: "0. 今日一句话总结", body: `${cnRisk(regime.mode || regime.type)}。${regime.conclusion || regime.explanation || "市场等待更多实时数据确认。"}` },
      { title: "1. 大盘表现总览", body: indexLine || "暂无可靠指数数据。" },
      { title: "2. 盘中走势复盘", body: "根据当前快照，优先观察指数方向、VIX 变化、主线板块延续性与尾盘资金是否确认。" },
      { title: "3. 宏观环境", body: "重点观察 10Y 美债、DXY、黄金、油价、Fed 降息预期与宏观数据。" },
      { title: "4. 板块表现", body: sectorLine || "暂无可靠板块数据。" },
      { title: "5. 主题与风格", body: `当前主线：${topSector}。重点观察 AI 硬件、软件、云计算、核电/电力和小盘是否扩散。` },
      { title: "6. 市场宽度与参与度", body: "免费版以板块扩散、异动数量、机会榜数量、相对成交量作为宽度代理；真实 A/D 与均线参与度待后续接入。" },
      { title: "7. 技术面分析", body: "重点看 SPY/QQQ 是否守住 VWAP 与 20 日趋势，SMH 是否继续强于 QQQ，IWM 是否参与。" },
      { title: "8. 重点个股新闻与异动", body: topMovers },
      { title: "9. 财报日历与财报解读", body: "财报层已预留 Earnings Layer；若未配置 API key，则显示结构化观察而非编造数据。" },
      { title: "10. 机构观点与资金流", body: `${newsLine}。期权代理：${optionLine}。` },
      { title: "11. 板块轮动判断", body: `资金关注：${sectorLine || topSector}。若主线集中且宽度不扩散，避免无量追高。` },
      { title: "12. 重点关注股观察", body: movers.slice(0, 10).map((m) => m.symbol).join(" / ") || "等待观察名单。" },
      { title: "13. 明日交易计划", body: "优先等待开盘 15 分钟确认：SPY/QQQ 同向、VIX 不反弹、目标股 RVOL 放大、VWAP 回踩承接。" },
      { title: "14. 风险提示", body: "10Y 上行、VIX 异动、DXY 走强、AI 利好钝化、财报不及预期、市场宽度恶化。" },
      { title: "15. 最终结论", body: `${cnRisk(regime.mode || regime.type)}。不构成投资建议；优先做确认后的主线顺势机会，避免低质量追高。` }
    ]
  };
}

export default async function handler(req, res) {
  try {
    const snapshot = await buildSnapshot(req);
    noStoreJson(res, 200, buildReport(snapshot));
  } catch (error) {
    noStoreJson(res, 200, {
      title: `美股收盘日报｜${new Date().toLocaleDateString("zh-CN")}`,
      generatedAt: Date.now(),
      error: error.message,
      summary: "日报引擎暂时无法获取可靠快照，请稍后刷新。",
      sections: []
    });
  }
}
