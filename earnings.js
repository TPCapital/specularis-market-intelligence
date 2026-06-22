function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(value) {
  const n = num(value, NaN);
  if (!Number.isFinite(n)) return "--";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function riskLabel(mode) {
  if (mode === "Risk-On") return "风险偏好开启";
  if (mode === "Risk-Off") return "风险规避升温";
  if (mode === "Neutral") return "中性震荡";
  return "等待确认";
}

function sourceData(snapshot, key, fallback = null) {
  return snapshot?.sources?.[key]?.data ?? snapshot?.[key] ?? fallback;
}

function compactSnapshot(snapshot = {}) {
  const marketData = sourceData(snapshot, "marketData", {}) || {};
  const marketStructure = sourceData(snapshot, "marketStructurePro", {}) || snapshot.marketStructurePro || {};
  const risk = snapshot.risk || snapshot.marketRegime || snapshot.riskRegime || sourceData(snapshot, "decisionEngine", {})?.marketRegime || {};
  const tradePlan = snapshot.tradePlan || sourceData(snapshot, "decisionEngine", {})?.tradePlan || {};
  const newsData = sourceData(snapshot, "newsCatalysts", {}) || sourceData(snapshot, "benzinga", {}) || {};
  const momentumData = sourceData(snapshot, "premarketMomentum", {}) || {};
  const optionsData = sourceData(snapshot, "optionsSignals", {}) || {};

  const indices = safeArray(marketData.indices || snapshot.indices).slice(0, 10).map((item) => ({
    id: item.id || item.symbol,
    value: item.value ?? item.price,
    change: item.change ?? item.changePercent,
    quality: item.dataQuality || item.status || item.source
  }));

  const sectors = safeArray(marketStructure.sectorRotation?.rows || sourceData(snapshot, "sectorHeat", []) || sourceData(snapshot, "finviz", [])).slice(0, 12).map((item) => ({
    sector: item.sector || item.name,
    score: item.score,
    change: item.change ?? item.changePercent,
    status: item.status || item.dataQuality || item.source
  }));

  const movers = safeArray(newsData.movers || snapshot.premarket?.movers).slice(0, 10).map((item) => ({
    symbol: item.symbol,
    change: item.change ?? item.changePercent,
    sector: item.sector,
    reason: item.reason || item.summary || item.catalyst
  }));

  const momentum = safeArray(momentumData.leaders || snapshot.premarket?.momentum?.leaders).slice(0, 10).map((item) => ({
    symbol: item.symbol,
    score: item.momentumScore || item.score,
    sector: item.sector,
    catalyst: item.catalyst || item.logic || item.reason
  }));

  const news = safeArray(newsData.news || sourceData(snapshot, "finnhubNews", []) || sourceData(snapshot, "newsAggregator", {})?.news).slice(0, 12).map((item) => ({
    ticker: item.ticker || item.symbol || item.relatedSymbol || "MACRO",
    title: item.title || item.headline || item.originalTitle,
    summary: item.summary,
    bias: item.bias || item.sentiment || item.category,
    source: item.source
  }));

  const options = safeArray(optionsData.cards || optionsData || sourceData(snapshot, "unusualWhales", [])).slice(0, 8).map((item) => ({
    symbol: item.symbol,
    score: item.score,
    direction: item.direction || item.conviction || item.type,
    summary: item.summary || item.logic,
    risk: item.risk
  }));

  const breadth = marketStructure.breadthPro || sourceData(snapshot, "marketBreadth", {}) || snapshot.breadthPro || {};
  const fedWatch = marketStructure.fedWatch || snapshot.fedWatch || {};
  const yieldCurve = marketStructure.yieldCurve || snapshot.yieldCurve || {};
  const oil = marketStructure.oil || snapshot.oil || {};

  return {
    generatedAt: snapshot.generatedAt || Date.now(),
    runtimeMode: snapshot.runtimeMode || snapshot.summary?.runtimeMode,
    risk,
    tradePlan,
    indices,
    sectors,
    movers,
    momentum,
    news,
    options,
    breadth,
    fedWatch,
    yieldCurve,
    oil,
    quality: {
      cacheAdapter: snapshot.cacheAdapter || snapshot.cacheWriteStatus?.adapter || snapshot.lastKnownGood?.adapter || "unknown",
      cacheWritten: Boolean(snapshot.cacheWriteStatus?.written),
      confidence: snapshot.tradeConfidence || snapshot.signalConfidence || snapshot.dataConfidence || snapshot.summary?.confidence || "UNKNOWN"
    }
  };
}

function section(id, title, body, bullets = []) {
  return { id, title, body, bullets: bullets.filter(Boolean) };
}

function topNames(items, key = "symbol", count = 5) {
  return safeArray(items).slice(0, count).map((item) => item?.[key]).filter(Boolean).join(" / ") || "等待确认";
}

function buildRuleBasedNarrative(snapshot = {}) {
  const ctx = compactSnapshot(snapshot);
  const risk = ctx.risk || {};
  const topSector = ctx.sectors[0]?.sector || "等待板块确认";
  const weakSector = ctx.sectors.at(-1)?.sector || "等待确认";
  const topMoverText = ctx.movers.slice(0, 5).map((m) => `${m.symbol} ${pct(m.change)}：${m.reason || "异动进入扫描"}`).join("；") || "暂无高质量盘前异动。";
  const momentumText = ctx.momentum.slice(0, 5).map((m) => `${m.symbol} ${m.score ?? "观察"}分`).join(" / ") || topNames(ctx.movers, "symbol");
  const indexText = ctx.indices.slice(0, 7).map((i) => `${i.id} ${i.value ?? "--"} ${pct(i.change)}`).join("；") || "暂无可靠指数快照。";
  const sectorText = ctx.sectors.slice(0, 8).map((s) => `${s.sector} ${s.score ?? "--"} ${s.change !== undefined ? pct(s.change) : ""}`.trim()).join(" / ") || "等待板块数据。";
  const breadthScore = ctx.breadth.breadthScore ?? ctx.breadth.score ?? "--";
  const fedProb = ctx.fedWatch.nearCutProbability ?? ctx.fedWatch.cutProbability ?? "--";
  const optionText = ctx.options.length ? ctx.options.slice(0, 5).map((o) => `${o.symbol} ${o.direction || "WATCH"} ${o.score ?? ""}`.trim()).join(" / ") : "暂无真实期权大单，当前维持 Options Proxy。";
  const riskMode = riskLabel(risk.mode);
  const action = risk.mode === "Risk-On" ? "CALL优先，但只做回踩确认后的主线延续。" : risk.mode === "Risk-Off" ? "降低追涨，优先观察PUT或防守。" : "等待开盘15分钟，确认指数、VIX与目标股量能。";

  const summary = `${riskMode}；主线板块：${topSector}；重点动能：${momentumText}；执行倾向：${action}`;

  const sections = [
    section("00", "今日一句话总结", `${riskMode}。${risk.conclusion || "市场状态已经可读，但仍需要开盘量能确认。"}`, [
      `主线：${topSector}`,
      `重点动能：${momentumText}`,
      `执行：${action}`
    ]),
    section("01", "大盘表现总览", indexText, ["先看 QQQ/SPY 是否同向", "VIX 反弹时降低追涨", "10Y 与 DXY 上行会压制高估值科技"]),
    section("02", "盘中走势复盘", "盘中判断顺序：指数方向 → VIX/10Y → 板块扩散 → 龙头量能 → 个股催化。盘前强不等于可追，必须等 VWAP 和相对成交量确认。"),
    section("03", "宏观环境", `收益率曲线：2Y ${ctx.yieldCurve.dgs2 ?? "--"} / 10Y ${ctx.yieldCurve.dgs10 ?? "--"} / 30Y ${ctx.yieldCurve.dgs30 ?? "--"}；FedWatch代理近端降息概率 ${fedProb}%；原油层：${safeArray(ctx.oil.rows).map((o) => `${o.name || o.symbol} ${o.price ?? "--"} ${pct(o.changePercent)}`).join("；") || "等待原油源"}。`, ["利率上行不利高估值科技", "油价上行可能支撑能源但压制降息预期"]),
    section("04", "板块表现 / 主题风格", sectorText, [`流入关注：${topSector}`, `流出警惕：${weakSector}`, "主线板块分数高于其他板块时，减少杂乱交易"]),
    section("05", "市场宽度与参与度", `Breadth Score ${breadthScore}；>20MA ${ctx.breadth.percentAbove20 ?? "--"}%；>50MA ${ctx.breadth.percentAbove50 ?? "--"}%；>200MA ${ctx.breadth.percentAbove200 ?? "--"}%。`, ["宽度改善代表行情更健康", "指数涨但宽度恶化时容易高开低走"]),
    section("06", "技术面分析", "技术面不直接给入场，而是给确认链：站上VWAP、回踩不破、相对成交量放大、板块同步、指数同向。缺任一环节就降仓位。"),
    section("07", "重点个股新闻与异动", topMoverText),
    section("08", "AI硬件 / 半导体", "重点跟踪 NVDA / AMD / AVGO / MRVL / SMH。若SMH强于QQQ，AI硬件仍是主线；若硬件钝化但软件走强，切换观察PLTR/ORCL/CRWD。"),
    section("09", "软件 / AI应用", "软件线更适合补涨逻辑，重点看PLTR、ORCL、CRWD、NOW、SNOW。只有在AI主线扩散且RVOL放大时才提高优先级。"),
    section("10", "机构观点与资金流", `${ctx.news.slice(0, 6).map((n) => `${n.ticker}｜${n.title}`).join("；") || "新闻源等待刷新"}。期权层：${optionText}`),
    section("11", "板块轮动判断", `资金当前优先关注 ${topSector}。如果前二板块集中领先，优先做主线龙头；如果板块轮动发散，降低单一方向确定性。`),
    section("12", "重点关注股观察", `重点观察：${momentumText}。这些标的不是直接买入名单，而是开盘后优先验证VWAP、量能和新闻持续性的名单。`),
    section("13", "明日交易计划", ctx.tradePlan?.body || `交易计划：${action} 优先做主线强势股的确认机会，避免无量追高和逆势PUT。`),
    section("14", "风险提示", "如果QQQ跌破开盘区间低点、VIX反弹、10Y/DXY同步上行、AI龙头放量回落，应取消追涨计划。"),
    section("15", "最终结论", `${riskMode}。当前系统已经具备数据层与结构层，交易上只做确认后的主线顺势机会，不用杂乱新闻驱动临时开单。`)
  ];

  return {
    title: `AI美股日报｜${new Date(ctx.generatedAt).toLocaleDateString("zh-CN")}`,
    generatedAt: ctx.generatedAt,
    provider: "rule-based-narrative",
    status: "live",
    summary,
    marketRegime: { mode: risk.mode || "Neutral", label: riskMode, score: risk.score ?? null },
    actionBias: action,
    focus: ctx.momentum.slice(0, 6).map((m) => m.symbol).filter(Boolean),
    avoid: ["无量高开追涨", "指数与个股背离时追单", "VIX反弹时重仓CALL"],
    sections,
    quality: ctx.quality
  };
}

function extractJson(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function narrativePrompt(compact) {
  return `你是一个服务于小资金日内美股期权交易员的中文市场结构分析师。请基于下面 JSON 快照生成严格 JSON，不要输出 Markdown，不要输出解释文字。\n\n要求：\n1. 语言简洁、具体、交易员视角。\n2. 不编造快照中没有的数据。\n3. 必须围绕：市场状态、板块轮动、机会、交易计划、风险。\n4. 不是投资建议，只是交易辅助。\n5. sections 必须包含 00-15 共16节，每节有 id/title/body/bullets。\n\n输出 JSON schema：\n{\n  "title": string,\n  "summary": string,\n  "marketRegime": {"mode": string, "label": string, "score": number|null},\n  "actionBias": string,\n  "focus": string[],\n  "avoid": string[],\n  "sections": [{"id": string, "title": string, "body": string, "bullets": string[]}],\n  "provider": string,\n  "status": "live"\n}\n\n快照：\n${JSON.stringify(compact).slice(0, 24000)}`;
}

async function callClaude(compact) {
  const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 4000,
      temperature: 0.2,
      messages: [{ role: "user", content: narrativePrompt(compact) }]
    })
  });
  if (!response.ok) throw new Error(`claude_${response.status}`);
  const payload = await response.json();
  const text = payload?.content?.map((p) => p.text || "").join("\n") || "";
  const parsed = extractJson(text);
  return parsed ? { ...parsed, provider: "claude", status: "live" } : null;
}

async function callOpenAI(compact) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是中文美股市场结构与日内期权交易辅助分析师，只输出JSON。" },
        { role: "user", content: narrativePrompt(compact) }
      ]
    })
  });
  if (!response.ok) throw new Error(`openai_${response.status}`);
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content || "";
  const parsed = extractJson(text);
  return parsed ? { ...parsed, provider: "openai", status: "live" } : null;
}

function normalizeAiReport(report, fallback, snapshot) {
  const base = fallback || buildRuleBasedNarrative(snapshot);
  const sections = safeArray(report?.sections).length >= 10 ? report.sections : base.sections;
  return {
    ...base,
    ...report,
    generatedAt: snapshot?.generatedAt || Date.now(),
    sections,
    focus: safeArray(report?.focus).length ? report.focus : base.focus,
    avoid: safeArray(report?.avoid).length ? report.avoid : base.avoid,
    provider: report?.provider || base.provider,
    status: report?.status || base.status,
    quality: base.quality
  };
}

export async function buildNarrativeReport(snapshot = {}, options = {}) {
  const fallback = buildRuleBasedNarrative(snapshot);
  const compact = compactSnapshot(snapshot);
  const prefer = String(options.provider || process.env.NARRATIVE_PROVIDER || "auto").toLowerCase();
  if (options.disableAI || prefer === "rules" || prefer === "rule") return fallback;
  try {
    const ai = prefer === "openai" ? await callOpenAI(compact) : prefer === "claude" ? await callClaude(compact) : (await callClaude(compact)) || (await callOpenAI(compact));
    return ai ? normalizeAiReport(ai, fallback, snapshot) : fallback;
  } catch (error) {
    return { ...fallback, provider: `${fallback.provider}-fallback`, aiError: error.message };
  }
}

export { compactSnapshot, buildRuleBasedNarrative };
