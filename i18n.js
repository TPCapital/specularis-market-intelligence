(() => {
  const STORAGE_KEY = "specularis-market-intelligence:language";
  const LANGS = { zh: "zh-CN", en: "en-US" };
  const CJK_RE = /[\u3400-\u9fff]/;
  let lang = localStorage.getItem(STORAGE_KEY) || "zh";
  let observer = null;
  let scheduled = false;
  let applying = false;
  const originals = new WeakMap();

  const exact = new Map(Object.entries({
    "AI 美股信息流交易系统": "AI U.S. Equity Flow Intelligence System",
    "初始化": "Initializing",
    "等待快照": "Waiting for snapshot",
    "自动刷新准备中": "Auto refresh standing by",
    "盘前战情室": "Pre-Market War Room",
    "盘中信息流": "Intraday Flow Desk",
    "收盘日报": "Daily Close Report",
    "明日交易计划": "Next Session Playbook",
    "核心交易驾驶舱": "Core Trading Command Deck",
    "市场状态": "Market Regime",
    "读取中": "Loading",
    "主线板块": "Leading Theme",
    "等待确认": "Awaiting Confirmation",
    "最强机会": "Top Opportunity",
    "等待量价": "Waiting for Price & Volume",
    "风险警报": "Risk Alert",
    "正常": "Normal",
    "执行倾向": "Execution Bias",
    "不追无量高开": "Do not chase low-volume gap-ups",
    "观察": "Watch",
    "风险规避": "Risk Avoidance",
    "风险升温": "Risk Heating Up",
    "防御等待": "Defensive Wait",
    "PUT / 对冲观察": "PUT / Hedge Watch",
    "禁止交易": "No Trade",
    "今日策略": "Today's Strategy",
    "市场指数": "Market Indices",
    "市场概览": "Market Overview",
    "市场结构 Pro": "Market Structure Pro",
    "风险指标": "Risk Indicators",
    "追高判断": "Chase-Risk Verdict",
    "中性偏谨慎": "Neutral to Cautious",
    "盘前交易计划": "Pre-Market Trade Plan",
    "强势股自动筛选": "Strong Stock Auto Scanner",
    "股票池逻辑": "Stock Pool Logic",
    "今日机会榜": "Today's Opportunity Board",
    "盘前动能": "Pre-Market Momentum",
    "明星股池": "Star Stock Pool",
    "盘前异动榜": "Pre-Market Movers",
    "热钱板块": "Hot Money Sectors",
    "AI 盘面解读": "AI Tape Read",
    "期权信号系统": "Options Signal System",
    "利好 / 利空新闻": "Bullish / Bearish News",
    "宏观快讯": "Macro Flash",
    "散户情绪 / WSB提及热度": "Retail Sentiment / WSB Mentions",
    "数据源状态": "Data Source Status",
    "突发新闻流": "Breaking News Flow",
    "动量 / 异动雷达": "Momentum / Mover Radar",
    "美股收盘日报": "U.S. Market Daily Close",
    "核心主题追踪": "Core Theme Tracking",
    "等待同步": "Awaiting Sync",
    "观察模式": "Observation Mode",
    "读取快照": "Reading Snapshot",
    "读取最新快照。": "Reading the latest snapshot.",
    "读取指数快照。": "Reading index snapshot.",
    "数据刷新后生成盘前交易计划。": "A pre-market trade plan will be generated after data refresh.",
    "指数与波动率信号尚待确认。": "Index and volatility signals are still pending confirmation.",
    "按涨幅、相对强弱、成交活跃度、板块热度与催化可信度加权。": "Weighted by price change, relative strength, trading activity, sector heat, and catalyst credibility.",
    "正在读取热钱板块、异动扩散与期权方向。": "Reading hot-money sectors, mover breadth, and options direction.",
    "免费版未接入真实期权大单流，本模块基于正股动量、相对成交量、板块强度、QQQ/SPY 方向、波动风险与新闻催化生成 CALL / PUT / WATCH / AVOID 代理信号。": "The free version does not connect to real institutional options flow. This module generates CALL / PUT / WATCH / AVOID proxy signals using underlying momentum, relative volume, sector strength, QQQ/SPY direction, volatility risk, and news catalysts.",
    "AI / 半导体 / 软件 / 电力 / 核能": "AI / Semiconductors / Software / Power / Nuclear",
    "北京时间 08:00 复盘模板": "08:00 Beijing Time Review Template",
    "高": "High",
    "中": "Medium",
    "低": "Low",
    "中高": "Medium-High",
    "中性": "Neutral",
    "偏乐观": "Moderately Optimistic",
    "利好": "Bullish",
    "利空": "Bearish",
    "其他": "Other",
    "宏观": "Macro",
    "金融": "Financials",
    "能源": "Energy",
    "医疗": "Healthcare",
    "核能": "Nuclear",
    "云计算": "Cloud Computing",
    "大型科技": "Mega-Cap Tech",
    "消费科技": "Consumer Tech",
    "网络安全": "Cybersecurity",
    "加密资产": "Crypto Assets",
    "AI 半导体": "AI Semiconductors",
    "AI 软件": "AI Software",
    "AI 服务器": "AI Servers",
    "AI 网络": "AI Networking",
    "铀矿": "Uranium",
    "新闻": "News",
    "财报": "Earnings",
    "评级": "Analyst Rating",
    "政策": "Policy",
    "暂无高置信度机会": "No high-confidence opportunity yet",
    "等待盘前确认": "Awaiting pre-market confirmation",
    "当前指数数据可用性不足": "Insufficient index data availability",

    // ── Specularis Market Terminal Lite — New Module Labels ──
    "个股情报 Pro": "Stock Intelligence Pro",
    "期权与波动率": "Options & Volatility",
    "KOL 观点蒸馏": "KOL Distillation",
    "政要持股情报": "Congress Trading Intelligence",
    "国会持股活跃榜": "Congress Activity Rank",
    "最新持股申报": "Latest Disclosures",
    "近90天申报 · 买卖量排序": "Last 90 days · Sorted by volume",
    "观察池标的": "Watchlist tickers",
    "社交情报 · Social Intelligence": "Social Intelligence",
    "StockTwits 热搜榜": "StockTwits Trending",
    "观察池情绪流": "Watchlist Sentiment",
    "Reddit 热帖信号": "Reddit Hot Posts",
    "暂无数据": "No data available",
    "暂无近期申报记录": "No recent disclosures",
    "近90天申报 · 共": "Last 90 days · Total",
    "众议院": "House",
    "参议院": "Senate",
    "买入 BUY": "BUY",
    "卖出 SELL": "SELL",
    "国会 × 社交共振信号": "Congress × Social Confluence Signal",
    "同时出现在国会持股变动 &amp; 社交热搜，值得重点关注": "Appearing in both congress disclosures & social trending. Worth watching.",
    "政策要员持股情报，全程免费自动抓取": "Congress Trading Intelligence — fully automated, free",
    "AI 决策层": "AI Decision Layer",
    "生成 AI 提示词": "Generate AI Prompt",
    "KOL · AI 决策": "KOL · AI Decision",
    "政要持股 · 情报": "Congress Intel",
    "Congress Intel": "Congress Intel",
    "模块加载中": "Loading module",
    "免费版代理信号 · Lite Mode Proxy Signals": "Free-tier proxy signals · Lite Mode",
    "手动输入 · Manual Input Mode": "Manual Input Mode",
    "综合评分：市场环境 + 股价动能 + 催化质量 + 期权 + KOL + 风控": "Score = Regime + Trend + Catalyst + Options + KOL + Risk",
    "生成可粘贴至 GPT Plus / Claude Pro 的完整分析提示词": "Generate a copyable prompt for GPT Plus / Claude Pro",
    "仅供研究，不构成投资建议": "For research only, not financial advice",
    "仅供研究 · For research only, not financial advice": "For research only, not financial advice",
    "普通提及不代表真实持仓": "Ordinary mentions ≠ real positions",
    "手动数据优先": "Manual Data First",
    "当前数据为占位符，不构成交易建议": "Current data is placeholder — not a trade recommendation",
    "等待数据质量改善后生成 A+ 评分": "Awaiting data quality improvement before scoring",
    "请在「个股情报 Pro」中输入数据后计算": "Enter data in Stock Intelligence Pro to compute",
    "可交易": "Tradable",
    "等待回踩": "Wait for Pullback",
    "回避": "Avoid",
    "正股": "Stock",
    "期权": "Option",
    "不交易": "No Trade",
    "看多 Bullish": "Bullish",
    "看空 Bearish": "Bearish",
    "明确持仓": "Explicit Position",
    "强观点": "Strong Opinion",
    "普通讨论": "Discussion Only",
    "新闻评论": "News Commentary",
    "玩笑/噪音": "Joke / Noise",
    "误读风险": "Misinterpretation Risk",
    "观察池相关性": "Watchlist Relevance",
    "AI 蒸馏": "AI Distillation",
    "暂无 KOL 条目": "No KOL entries yet",
    "市场环境": "Market Regime",
    "股价动能": "Price Momentum",
    "催化质量": "Catalyst Quality",
    "期权风险回报": "Options Risk/Reward",
    "KOL 确认": "KOL Confirmation",
    "风控清晰度": "Risk Control Clarity",
    "进场区": "Entry Zone",
    "止损": "Stop Level",
    "目标": "Target",
    "财报前期权波动风险较高": "Options vol risk elevated before earnings",
    "建议结构": "Preferred Structure",
    "风险等级": "Risk Level",
    "IV 状态": "IV Status",
    "失效条件": "Invalidation",
    "未来升级付费 API 后可接入": "Unlock with paid API upgrade",
    "添加 KOL 内容": "Add KOL Entry",
    "帖子原文": "Post Text",
    "涉及标的": "Related Tickers",
    "核心论点": "Key Arguments",
    "截图备注": "Screenshot Note",
    "将当前市场快照汇总为可粘贴的分析提示词": "Summarize current snapshot as a copyable analysis prompt",
    "人工智能协同分析": "Human-in-the-Loop AI Analysis",
    "已复制！": "Copied!",
    "支撑": "Support",
    "压力": "Resistance",
    "分析师": "Analyst",
    "机构": "Institutional",
    "内部人": "Insider",
    "交易相关性": "Trade Relevance",
    "最新新闻": "Recent News",
    "风险标记": "Risk Flags",
    "AI 摘要": "AI Summary",
    "趋势": "Trend",
    "成交量": "Volume",
    "财报日": "Earnings Date",
    "当前价格": "Current Price",
    "涨跌幅": "Daily Change",
    "免费版 Lite Mode": "Free-tier Lite Mode",
    "未接入真实 IV / GEX 数据": "Real IV / GEX data not connected",
    "基于价格动量与市场环境生成代理信号": "Proxy signals based on price momentum and market regime",
    "AI / 半导体 / 存储": "AI / Semiconductor / Memory",
    "AI / 半导体 / ASIC": "AI / Semiconductor / ASIC",
    "AI / 半导体 / 网络": "AI / Semiconductor / Networking",
    "AI / 半导体 / 代工": "AI / Semiconductor / Foundry",
    "半导体设备": "Semiconductor Equipment",
    "AI 软件 / 云": "AI Software / Cloud",
    "AI Watchlist Focus List": "AI Watchlist Focus List",

    // ── Module label strings (second pass — missing translations) ──
    "高风险": "High Risk",
    "低风险": "Low Risk",
    "中风险": "Medium Risk",
    "AI半导体 / ASIC": "AI Semiconductor / ASIC",
    "AI半导体 / 代工": "AI Semiconductor / Foundry",
    "AI半导体 / 存储": "AI Semiconductor / Memory",
    "AI半导体 / 网络": "AI Semiconductor / Networking",
    "AI云": "AI Cloud",
    "AI内存": "AI Memory",
    "AI加速": "AI Acceleration",
    "AI服务器": "AI Servers",
    "AI算力": "AI Compute",
    "AI网络": "AI Networking",
    "AI软件": "AI Software",
    "Call 价差": "Call Spread",
    "EUV光刻": "EUV Lithography",
    "Nvidia生态": "Nvidia Ecosystem",
    "Put 价差": "Put Spread",
    "不明确 Unclear": "Unclear",
    "中文": "Chinese",
    "中立 Neutral": "Neutral",
    "买入 Call": "Long Call",
    "代工龙头": "Foundry Leader",
    "企业SaaS": "Enterprise SaaS",
    "供应链垄断": "Supply Chain Monopoly",
    "先进制程": "Advanced Node",
    "免费版 Lite Mode — 未接入真实 IV / GEX 数据。基于价格动量与市场环境生成代理信号。": "Free-tier Lite Mode — Real IV/GEX data not connected. Proxy signals based on price momentum and market regime.",
    "净减持": "Net Selling",
    "净增持": "Net Buying",
    "可选：截图说明": "Optional: screenshot note",
    "回避 Avoid": "Avoid",
    "定制芯片": "Custom ASIC",
    "带宽": "Bandwidth",
    "政府合同": "Government Contracts",
    "数据中心": "Data Center",
    "数据库": "Database",
    "暂无 KOL 输入": "No KOL input yet",
    "暂无有效评分": "No valid scores yet",
    "暂无有效评分（需先在个股情报中输入数据）": "No valid scores (enter data in Stock Intelligence Pro first)",
    "未分类": "Uncategorized",
    "未来升级付费 API 后可接入: GammaWall / CallWall / PutWall / IV Rank / Skew / OI / 异常大单。": "Unlock with paid API upgrade: GammaWall / CallWall / PutWall / IV Rank / Skew / OI / Unusual Flow.",
    "未知": "Unknown",
    "正股 Stock": "Stock",
    "液冷": "Liquid Cooling",
    "混合 Mixed": "Mixed",
    "确认删除此 KOL 条目？": "Confirm delete this KOL entry?",
    "等待 Wait": "Wait",
    "等待数据或手动输入。": "Awaiting data or manual input.",
    "等待观察 Wait": "Wait / Watch",
    "苹果供应链": "Apple Supply Chain",
    "看多 Bullish": "Bullish",
    "看空 Bearish": "Bearish",
    "明确持仓": "Explicit Position",
    "强观点": "Strong Opinion",
    "普通讨论": "Discussion Only",
    "新闻评论": "News Commentary",
    "玩笑/噪音": "Joke / Noise",
    "误读风险": "Misinterpretation Risk",
    "观察池相关性": "Watchlist Relevance",
    "AI 蒸馏": "AI Distillation",
    "暂无 KOL 条目。点击「添加」粘贴 X / Twitter 内容进行结构化分析。": "No KOL entries. Click Add to paste X / Twitter content for structured analysis.",
    "⚠️ 重要：普通提及≠真实持仓。请区分「明确持仓」、「强观点」与「讨论」。": "⚠️ Important: Ordinary mentions ≠ real positions. Distinguish explicit positions, strong opinions, and discussion.",
    "手动粘贴 KOL 内容，结构化为可用市场信号。区分立场、置信度与信号类型。": "Manually paste KOL content and structure it into usable market signals. Distinguish stance, conviction, and signal type.",
    "综合评分 = 市场环境(2) + 股价动能(2) + 催化质量(2) + 期权(2) + KOL(1) + 风控(1)": "Score = Regime(2) + Trend(2) + Catalyst(2) + Options(2) + KOL(1) + Risk(1)",
    "KOL handle 和帖子原文为必填项。": "KOL handle and post text are required.",
    "免费版不接入真实期权大单流。信号基于：正股动量 · 相对成交量 · 板块强度 · QQQ/SPY 方向 · 波动风险 · 新闻催化。": "Free tier does not connect to real institutional options flow. Signals based on: price momentum · relative volume · sector strength · QQQ/SPY direction · vol risk · news catalysts.",
    "将当前市场快照 + 个股情报 + 期权信号 + KOL 数据 + AI 评分汇总为可粘贴的分析提示词。": "Summarize current snapshot + stock intel + options signals + KOL data + AI scores into a copyable analysis prompt.",
    "无需付费 API — 粘贴至 GPT Plus 或 Claude Pro 完成分析。": "No paid API needed — paste into GPT Plus or Claude Pro to complete analysis.",
    "在各模块填入数据（价格、新闻、KOL）": "Fill in data across modules (price, news, KOL)",
    "点击「生成提示词」按钮": "Click the Generate Prompt button",
    "粘贴至 GPT Plus / Claude Pro": "Paste into GPT Plus / Claude Pro",
    "将 AI 摘要粘回「AI 摘要」字段": "Paste AI summary back into the AI Summary field",
    "接入 OpenAI / Anthropic API 后，此模块可直接调用 AI 完成分析。": "After connecting the OpenAI / Anthropic API, this module can call AI directly.",
    "占位符已预留 API 配置接口。": "API configuration interface already reserved as placeholder.",
    "Generated Prompt": "Generated Prompt",
    "将以上文本粘贴至 GPT Plus 或 Claude Pro 以进行完整分析。": "Paste the above text into GPT Plus or Claude Pro for full analysis.",
    "已复制！Copied!": "Copied!",
    "✕ 取消": "✕ Cancel",
    "➕ 添加 / Add": "➕ Add",
    "手动更新 / Edit": "Edit",
    "保存 Save": "Save",
    "取消 Cancel": "Cancel",
    "添加 / Add": "Add",
    "编辑": "Edit",
    "删除": "Delete",
    "仅供研究 · Not financial advice": "For research only · Not financial advice",
    "Options Lite Mode": "Options Lite Mode",
    "Future API 升级后可解锁 / Upgrade to unlock:": "Unlock after paid API upgrade:",
    "普通提及不代表真实持仓。Ordinary mentions ≠ real positions.": "Ordinary mentions ≠ real positions.",
    "实际信号以客户端手动输入为准。": "Actual signals defer to client-side manual input.",
    "免费版 Lite Mode — IV/GEX 暂不可用。客户端手动数据优先。": "Free-tier Lite Mode — IV/GEX unavailable. Manual client-side data takes priority.",
    "请在「个股情报 Pro」中输入数据后计算。": "Enter data in Stock Intelligence Pro to compute score."
  }));

  const rules = [
    [/高置信度?opportunity/gi, "High-confidence opportunity"],
    [/Low\s*质量opportunity\s*\(Low Quality\)/gi, "Low-quality opportunity"],
    [/Low\s*质量opportunity/gi, "Low-quality opportunity"],
    [/Medium置信/gi, "Medium confidence"],
    [/High置信/gi, "High confidence"],
    [/Low置信/gi, "Low confidence"],
    [/置信度\s*HIGH/gi, "Confidence HIGH"],
    [/置信度\s*MEDIUM/gi, "Confidence MEDIUM"],
    [/置信度\s*LOW/gi, "Confidence LOW"],
    [/Confidence\s*高/g, "Confidence HIGH"],
    [/Confidence\s*中/g, "Confidence MEDIUM"],
    [/Confidence\s*低/g, "Confidence LOW"],
    [/Risk偏好\s*RISK AVOIDANCE\s*\(RISK-OFF\)/gi, "Risk bias: RISK AVOIDANCE (RISK-OFF)"],
    [/盘前watch名单/g, "Pre-market watchlist"],
    [/暂无可用watch名单/g, "No available watchlist"],
    [/wait for live\/delayed quote 或涨跌幅触发/g, "wait for live/delayed quotes or price-change trigger"],
    [/相对成交量龙头/g, "Relative volume leader"],
    [/最强SECTOR/gi, "Strongest sector"],
    [/开盘倾向/g, "Opening bias"],
    [/仅早盘WATCH名单/g, "Early-session watchlist only"],
    [/盘前价格mover与newscatalystsync出现/g, "Pre-market price move and news catalyst are aligned"],
    [/价格mover进入盘前扫描/g, "Price mover entered the pre-market scanner"],
    [/需成交量confirmation/g, "volume confirmation required"],
    [/需volume confirmation/g, "volume confirmation required"],
    [/需开盘confirmation/g, "opening confirmation required"],
    [/需开盘量能confirmation/g, "opening volume confirmation required"],
    [/需开盘量价confirmation/g, "opening price-volume confirmation required"],
    [/持续性验证/g, "durability check"],
    [/仅供参考/g, "reference only"],
    [/快照data/g, "snapshot data"],
    [/snapshotdata/g, "snapshot data"],
    [/delayeddata/g, "delayed data"],
    [/livedata/g, "live data"],
    [/proxy推断/g, "proxy inference"],
    [/proxy量能/g, "proxy volume"],
    [/真实量能/g, "real volume"],
    [/延迟价格/g, "delayed price"],
    [/实时价格/g, "live price"],
    [/结构性opportunity/g, "Structural opportunity"],
    [/结构性/g, "Structural"],
    [/热钱is concentrated in少数sector/g, "Hot money is concentrated in a few sectors"],
    [/避免无差别chasing/g, "avoid indiscriminate chasing"],
    [/避免无量chasing/g, "avoid chasing without volume"],
    [/避免无量高开/g, "avoid low-volume gap-ups"],
    [/不抢第一根/g, "do not take the first bar"],
    [/不抢第一根K线/g, "do not take the first candle"],
    [/wait for开盘15分钟confirmation方向/g, "wait for 15-minute opening confirmation"],
    [/wait for开盘延续confirmation/g, "wait for opening continuation confirmation"],
    [/wait for开盘延续/g, "wait for opening continuation"],
    [/wait for开盘/g, "wait for the open"],
    [/for开盘/g, "for the open"],
    [/开盘15分钟confirmation方向/g, "15-minute opening confirmation"],
    [/开盘量价Confirmation/gi, "opening price-volume confirmation"],
    [/开盘量价confirmation/gi, "opening price-volume confirmation"],
    [/开盘量能confirmation/gi, "opening volume confirmation"],
    [/开盘区间Low点/g, "opening-range low"],
    [/跌破开盘区间Low点/g, "breaks the opening-range low"],
    [/QQQ\/SPY\s*sync走弱/g, "QQQ/SPY weakens in sync"],
    [/VIX\s*不回落/g, "VIX does not pull back"],
    [/VIX\s*快速上行时避免CALL/g, "avoid CALLs when VIX spikes"],
    [/快速上行时避免CALL/g, "avoid CALLs during a fast volatility spike"],
    [/与sector背离的signal全部放弃/g, "abandon signals that diverge from sector direction"],
    [/跌回VWAP/g, "fails back below VWAP"],
    [/连续亏损后停止加仓/g, "stop adding after consecutive losses"],
    [/避免sentiment翻倍/g, "avoid sentiment-driven overextension"],
    [/翻倍/g, "overextension"],
    [/财报预期改善/g, "earnings expectations improved"],
    [/关注开盘confirmation/g, "watch opening confirmation"],
    [/财报预期偏弱/g, "earnings expectations are weak"],
    [/注意波动risk/g, "watch volatility risk"],
    [/AI semiconductors动量结构延续/g, "AI semiconductor momentum structure continues"],
    [/AI semiconductors动量/g, "AI semiconductor momentum"],
    [/存在themeheat/g, "theme heat exists"],
    [/但trade质量仍需开盘confirmation/g, "but trade quality still requires opening confirmation"],
    [/缺少明确动量\/量能或catalyst共振/g, "lacks clear momentum, volume, or catalyst alignment"],
    [/相对成交量扩张/g, "relative volume expansion"],
    [/资金预期改善/g, "fund-flow expectations improved"],
    [/高成长主题/g, "high-growth theme"],
    [/偏弱/g, "weaker"],
    [/弹性强/g, "high beta"],
    [/回落/g, "pullback"],
    [/未进入极端亢奋/g, "not in extreme euphoria"],
    [/尚未触及典型超买阈值/g, "not yet at a typical overbought threshold"],
    [/保护性需求偏low/g, "protective demand is low"],
    [/追涨拥挤度上升/g, "chasing crowding is rising"],
    [/贪婪区间/g, "greed zone"],
    [/动能偏强/g, "momentum is firm"],
    [/Market宽度/g, "market breadth"],
    [/market breadth/g, "market breadth"],
    [/Pre-Market动能/g, "pre-market momentum"],
    [/盘前动能/g, "pre-market momentum"],
    [/动能股/g, "momentum stocks"],
    [/集中在/g, "is concentrated in"],
    [/优先等待/g, "prefer waiting for"],
    [/等待开盘量价/g, "wait for opening price-volume"],
    [/开盘量价/g, "opening price-volume"],
    [/开盘量能/g, "opening volume"],
    [/开盘/g, "opening"],
    [/盘前/g, "pre-market"],
    [/盘中/g, "intraday"],
    [/收盘/g, "close"],
    [/明日/g, "next session"],
    [/北京时间/g, "Beijing Time"],
    [/数据生成/g, "data generated"],
    [/页面刷新/g, "page refreshed"],
    [/自动刷新/g, "auto refresh"],
    [/数据可靠性/g, "data reliability"],
    [/资金流基于/g, "flow basis:"],
    [/资金流/g, "flow"],
    [/置信/g, "confidence"],
    [/风险规避/g, "Risk Avoidance"],
    [/风险升温/g, "Risk Heating Up"],
    [/防御等待/g, "Defensive Wait"],
    [/对冲观察/g, "Hedge Watch"],
    [/禁止交易/g, "No Trade"],
    [/无交易/g, "No Trade"],
    [/不交易/g, "No Trade"],
    [/观察/g, "Watch"],
    [/等待同步/g, "Awaiting Sync"],
    [/等待确认/g, "Awaiting Confirmation"],
    [/等待/g, "wait"],
    [/确认/g, "confirmation"],
    [/方向/g, "direction"],
    [/不追/g, "do not chase"],
    [/无量高开/g, "low-volume gap-up"],
    [/追高/g, "chasing"],
    [/回踩/g, "pullback"],
    [/可进攻但控仓/g, "Can attack, but control size"],
    [/可进攻/g, "Can attack"],
    [/控仓/g, "control size"],
    [/风险偏好/g, "risk appetite"],
    [/风险/g, "risk"],
    [/规避/g, "avoidance"],
    [/升温/g, "heating up"],
    [/防御/g, "defensive"],
    [/市场概览/g, "market overview"],
    [/市场结构/g, "market structure"],
    [/市场/g, "market"],
    [/板块/g, "sector"],
    [/主线/g, "main theme"],
    [/机会/g, "opportunity"],
    [/量价/g, "price-volume"],
    [/指数/g, "indices"],
    [/波动率/g, "volatility"],
    [/收益率/g, "yield"],
    [/美元/g, "dollar"],
    [/黄金/g, "gold"],
    [/宽度/g, "breadth"],
    [/动量/g, "momentum"],
    [/动能/g, "momentum"],
    [/异动/g, "mover"],
    [/热度/g, "heat"],
    [/催化/g, "catalyst"],
    [/正向/g, "positive"],
    [/负面/g, "negative"],
    [/利好/g, "bullish"],
    [/利空/g, "bearish"],
    [/中性/g, "neutral"],
    [/偏谨慎/g, "cautious"],
    [/谨慎/g, "cautious"],
    [/偏乐观/g, "moderately optimistic"],
    [/乐观/g, "optimistic"],
    [/悲观/g, "pessimistic"],
    [/读取/g, "reading"],
    [/同步/g, "sync"],
    [/快照/g, "snapshot"],
    [/实时/g, "live"],
    [/延迟/g, "delayed"],
    [/缓存/g, "cached"],
    [/代理/g, "proxy"],
    [/数据/g, "data"],
    [/生成/g, "generated"],
    [/刷新/g, "refreshed"],
    [/日期/g, "date"],
    [/新闻/g, "news"],
    [/宏观/g, "macro"],
    [/散户/g, "retail"],
    [/情绪/g, "sentiment"],
    [/提及/g, "mentions"],
    [/来源/g, "source"],
    [/状态/g, "status"],
    [/正常/g, "normal"],
    [/最新/g, "latest"],
    [/最近/g, "recent"],
    [/有效/g, "valid"],
    [/核心/g, "core"],
    [/主题/g, "theme"],
    [/追踪/g, "tracking"],
    [/半导体/g, "semiconductors"],
    [/软件/g, "software"],
    [/电力/g, "power"],
    [/核能/g, "nuclear"],
    [/通信/g, "communications"],
    [/医疗/g, "healthcare"],
    [/金融/g, "financials"],
    [/云安全/g, "cloud security"],
    [/网络安全/g, "cybersecurity"],
    [/大型科技/g, "mega-cap tech"],
    [/加密资产/g, "crypto assets"],
    [/价格/g, "price"],
    [/成交量/g, "volume"],
    [/涨跌幅/g, "price change"],
    [/股票/g, "stock"],
    [/名单/g, "list"],
    [/暂无/g, "none"],
    [/可用/g, "available"],
    [/触发/g, "trigger"],
    [/或/g, "or"],
    [/与/g, "and"],
    [/的/g, ""],
    [/年/g, "-"],
    [/月/g, "-"],
    [/日/g, ""],
    [/，/g, ", "],
    [/。/g, "."],
    [/、/g, " / "],
    [/：/g, ": "],
    [/（/g, " ("],
    [/）/g, ") "]
  ];

  const cleanup = [
    [/\s{2,}/g, " "],
    [/\s+([,.:;])/g, "$1"],
    [/([(|/])\s+/g, "$1"],
    [/\s+([)|/])/g, "$1"],
    [/data generated\s*:/gi, "data generated: "],
    [/page refreshed\s*:/gi, "page refreshed: "],
    [/auto refreshed/gi, "auto refresh"],
    [/flow basis:\s*live data/gi, "Flow basis: live data"],
    [/flow basis:\s*delayed data/gi, "Flow basis: delayed data"],
    [/flow basis:\s*proxy/gi, "Flow basis: proxy"],
    [/data reliability\s*:\s*HIGH/gi, "data reliability: HIGH"],
    [/confidence\s*HIGH/gi, "Confidence HIGH"],
    [/confidence\s*MEDIUM/gi, "Confidence MEDIUM"],
    [/confidence\s*LOW/gi, "Confidence LOW"],
    [/High\s*confidence\s*opportunity/gi, "High-confidence opportunity"],
    [/Low\s*quality\s*opportunity/gi, "Low-quality opportunity"],
    [/pre-market\s+momentumis/gi, "pre-market momentum is"],
    [/mover与news/gi, "move and news"],
    [/catalystsync/gi, "catalyst alignment"],
    [/newscatalyst/gi, "news catalyst"],
    [/sector轮动/gi, "sector rotation"],
    [/yield曲线/gi, "yield curve"],
    [/原油\s*\/\s*通胀/gi, "oil / inflation"],
    [/market真实均线参与率/gi, "real market MA participation"],
    [/免/gi, "Free"],
    [/未接入/g, "not connected"],
    [/当前基于/g, "currently based on"],
    [/曲线/g, "curve"],
    [/轮动/g, "rotation"],
    [/分化/g, "divergence"],
    [/需wait/g, "needs to wait"],
    [/foropening/g, "for opening"],
    [/prefer waiting foropening/gi, "prefer waiting for opening"],
    [/openingconfirmation/gi, "opening confirmation"],
    [/confirmationconfirmation/gi, "confirmation"],
    [/watch名单/gi, "watchlist"],
    [/watchlist名单/gi, "watchlist"],
    [/量能/g, "volume"],
    [/分钟/g, "min"],
    [/分钟/g, "min"],
    [/个/g, ""],
    [/只/g, ""],
    [/↑/g, "up"],
    [/↓/g, "down"],
    [/\bhigh\b/g, "High"],
    [/\bmedium\b/g, "Medium"],
    [/\blow\b/g, "Low"]
  ];

  const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);

  function injectStyles() {
    if (document.getElementById("specularis-i18n-style")) return;
    const style = document.createElement("style");
    style.id = "specularis-i18n-style";
    style.textContent = `
      .language-toggle {
        border: 1px solid rgba(148, 163, 184, .34);
        background: rgba(15, 23, 42, .52);
        color: #e5e7eb;
        border-radius: 999px;
        padding: 6px 10px;
        min-width: 44px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .08em;
        cursor: pointer;
        box-shadow: 0 0 18px rgba(56, 189, 248, .14), inset 0 0 12px rgba(148, 163, 184, .08);
        transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
      }
      .language-toggle:hover {
        transform: translateY(-1px);
        border-color: rgba(56, 189, 248, .72);
        box-shadow: 0 0 22px rgba(56, 189, 248, .28), inset 0 0 16px rgba(56, 189, 248, .1);
      }
      html[data-lang="en"] .topbar {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: end;
        gap: 16px;
        margin-bottom: 20px;
      }
      html[data-lang="en"] h1 {
        max-width: 760px;
        font-size: clamp(30px, 3vw, 48px);
        line-height: .96;
        letter-spacing: -.045em;
      }
      html[data-lang="en"] .eyebrow { margin-bottom: 6px; }
      html[data-lang="en"] .meta {
        justify-content: flex-end;
        flex-wrap: wrap;
        row-gap: 4px;
        white-space: nowrap;
        line-height: 1.4;
        max-width: none;
        margin-left: auto;
      }
      html[data-lang="en"] .meta > span,
      html[data-lang="en"] .meta > time {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
      }
      html[data-lang="en"] .workspace-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      html[data-lang="en"] .workspace-tab { min-height: 56px; padding: 10px 12px; }
      html[data-lang="en"] .workspace-tab strong {
        font-size: clamp(11px, .95vw, 14px);
        line-height: 1.10;
        letter-spacing: .01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      html[data-lang="en"] .workspace-tab em { font-size: 10px; letter-spacing: .15em; }
      html[data-lang="en"] .command-deck { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      html[data-lang="en"] .command-tile { min-height: 132px; padding: 20px; }
      html[data-lang="en"] .command-tile p,
      html[data-lang="en"] .panel-label,
      html[data-lang="en"] .section-title h2 { letter-spacing: .035em; }
      html[data-lang="en"] .command-tile strong { font-size: clamp(20px, 1.7vw, 32px); line-height: 1.04; }
      html[data-lang="en"] .risk-mode { font-size: clamp(38px, 4.6vw, 78px); line-height: .92; }
      html[data-lang="en"] .risk-score { font-size: clamp(52px, 6vw, 98px); }
      html[data-lang="en"] .strategy-panel h2 { font-size: clamp(28px, 2.7vw, 50px); line-height: 1.02; }
      html[data-lang="en"] .strategy-panel p,
      html[data-lang="en"] .conclusion { line-height: 1.45; }
      html[data-lang="en"] .metric-card h3,
      html[data-lang="en"] .tape-card h3,
      html[data-lang="en"] .market-summary-card h3 { line-height: 1.15; }
      @media (max-width: 1180px) {
        html[data-lang="en"] .topbar { grid-template-columns: 1fr; }
        html[data-lang="en"] .meta { justify-content: flex-start; max-width: none; margin-left: 0; }
        html[data-lang="en"] .workspace-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        html[data-lang="en"] .command-deck { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 900px) {
        html[data-lang="en"] .workspace-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function preserveSpacing(original, translated) {
    const prefix = original.match(/^\s*/)?.[0] || "";
    const suffix = original.match(/\s*$/)?.[0] || "";
    return `${prefix}${translated}${suffix}`;
  }

  function translateText(value) {
    const original = String(value || "");
    const trimmed = original.trim();
    if (!trimmed || !CJK_RE.test(trimmed)) return original;
    if (exact.has(trimmed)) return preserveSpacing(original, exact.get(trimmed));
    let next = original;
    for (const [pattern, replacement] of rules) next = next.replace(pattern, replacement);
    for (const [pattern, replacement] of cleanup) next = next.replace(pattern, replacement);
    next = next.replace(/[\u3400-\u9fff]+/g, "");
    for (const [pattern, replacement] of cleanup) next = next.replace(pattern, replacement);
    return preserveSpacing(original, next.trim());
  }

  function getTextNodes(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
        if (skipTags.has(node.parentElement?.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function rememberNode(node) {
    const current = node.nodeValue;
    const saved = originals.get(node);
    if (!saved) {
      originals.set(node, current);
      return;
    }
    if (CJK_RE.test(current) && current !== translateText(saved)) originals.set(node, current);
  }

  function applyLanguage() {
    scheduled = false;
    if (!document.body) return;
    applying = true;
    document.documentElement.lang = LANGS[lang];
    document.documentElement.dataset.lang = lang;
    document.title = lang === "en" ? "AI U.S. Equity Flow Intelligence System" : "AI 美股信息流交易系统";
    const toggle = document.getElementById("langToggle");
    if (toggle) {
      toggle.textContent = lang === "en" ? "中" : "EN";
      toggle.setAttribute("aria-label", lang === "en" ? "Switch to Chinese" : "Switch to English");
    }
    getTextNodes().forEach((node) => {
      if (node.parentElement?.id === "langToggle") return;
      rememberNode(node);
      const original = originals.get(node) || node.nodeValue;
      const next = lang === "en" ? translateText(original) : original;
      if (node.nodeValue !== next) node.nodeValue = next;
    });
    applying = false;
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyLanguage);
  }

  function bindToggle() {
    const toggle = document.getElementById("langToggle");
    if (!toggle || toggle.dataset.bound === "true") return;
    toggle.dataset.bound = "true";
    toggle.addEventListener("click", () => {
      lang = lang === "en" ? "zh" : "en";
      localStorage.setItem(STORAGE_KEY, lang);
      scheduleApply();
    });
  }

  function init() {
    injectStyles();
    bindToggle();
    if (!observer) {
      observer = new MutationObserver((records) => {
        if (applying) return;
        for (const record of records) {
          if (record.type === "characterData" && record.target?.nodeValue && CJK_RE.test(record.target.nodeValue)) originals.set(record.target, record.target.nodeValue);
        }
        bindToggle();
        scheduleApply();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    scheduleApply();
    setTimeout(scheduleApply, 80);
    setTimeout(scheduleApply, 300);
    setTimeout(scheduleApply, 900);
    setTimeout(scheduleApply, 1800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
