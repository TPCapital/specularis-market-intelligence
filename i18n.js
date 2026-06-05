(() => {
  const STORAGE_KEY = "specularis-market-intelligence:language";
  const LANGS = { zh: "zh-CN", en: "en-US" };
  const CJK_RE = /[\u3400-\u9fff]/;
  let lang = localStorage.getItem(STORAGE_KEY) || "zh";
  let observer = null;
  let scheduled = false;
  let applying = false;
  const originals = new WeakMap();

  const dict = new Map(Object.entries({
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
    "读取最新快照。": "Reading the latest snapshot.",
    "今日策略": "Today's Strategy",
    "谨慎追高，等待回踩确认": "Avoid chasing; wait for pullback confirmation",
    "指数与波动率信号尚待确认。": "Index and volatility signals are still pending confirmation.",
    "相对成交量龙头 等待确认": "RVOL leader awaiting confirmation",
    "最强板块 等待确认": "Strongest sector awaiting confirmation",
    "风险偏好 等待确认": "Risk appetite awaiting confirmation",
    "盘前动量 等待确认": "Pre-market momentum awaiting confirmation",
    "开盘倾向 等待确认": "Opening bias awaiting confirmation",
    "市场指数": "Market Indices",
    "等待同步": "Awaiting Sync",
    "市场概览": "Market Overview",
    "读取指数快照。": "Reading index snapshot.",
    "市场结构 Pro": "Market Structure Pro",
    "风险指标": "Risk Indicators",
    "追高判断": "Chase-Risk Verdict",
    "中性偏谨慎": "Neutral to Cautious",
    "Greed 未到极端，但科技拥挤度需要观察。": "Greed is not extreme yet, but tech crowding needs monitoring.",
    "盘前交易计划": "Pre-Market Trade Plan",
    "观察模式": "Observation Mode",
    "读取机会快照。": "Reading opportunity snapshot.",
    "数据刷新后生成盘前交易计划。": "A pre-market trade plan will be generated after data refresh.",
    "强势股自动筛选": "Strong Stock Auto Scanner",
    "股票池逻辑": "Stock Pool Logic",
    "按涨幅、相对强弱、成交活跃度、板块热度与催化可信度加权。": "Weighted by price change, relative strength, trading activity, sector heat, and catalyst credibility.",
    "今日机会榜": "Today's Opportunity Board",
    "盘前动能": "Pre-Market Momentum",
    "明星股池": "Star Stock Pool",
    "盘前异动榜": "Pre-Market Movers",
    "热钱板块": "Hot Money Sectors",
    "AI 盘面解读": "AI Tape Read",
    "读取快照": "Reading Snapshot",
    "正在读取热钱板块、异动扩散与期权方向。": "Reading hot-money sectors, mover breadth, and options direction.",
    "期权信号系统": "Options Signal System",
    "免费版未接入真实期权大单流，本模块基于正股动量、相对成交量、板块强度、QQQ/SPY 方向、波动风险与新闻催化生成 CALL / PUT / WATCH / AVOID 代理信号。": "The free version does not connect to real institutional options flow. This module generates CALL / PUT / WATCH / AVOID proxy signals using underlying momentum, relative volume, sector strength, QQQ/SPY direction, volatility risk, and news catalysts.",
    "利好 / 利空新闻": "Bullish / Bearish News",
    "宏观快讯": "Macro Flash",
    "散户情绪 / WSB提及热度": "Retail Sentiment / WSB Mentions",
    "数据源状态": "Data Source Status",
    "突发新闻流": "Breaking News Flow",
    "动量 / 异动雷达": "Momentum / Mover Radar",
    "美股收盘日报": "U.S. Market Daily Close",
    "北京时间 08:00 复盘模板": "08:00 Beijing Time Review Template",
    "核心主题追踪": "Core Theme Tracking",
    "AI / 半导体 / 软件 / 电力 / 核能": "AI / Semiconductors / Software / Power / Nuclear",
    "结构参考 · 非实时": "Structural reference · not real-time",
    "快照数据（SNAPSHOT）": "Snapshot Data",
    "最近快照": "Latest snapshot",
    "最新快照": "Latest snapshot",
    "最后成功": "Last successful",
    "显示最近有效数据": "Showing last valid data",
    "最近有效": "Last valid",
    "备用快照": "Backup snapshot",
    "实时 + 结构化情报": "Live + structured intelligence",
    "资金流基于实时数据": "Flow based on live data",
    "资金流基于延迟数据": "Flow based on delayed data",
    "资金流基于代理推断数据": "Flow based on proxy inference data",
    "资金流基于最后成功数据": "Flow based on last successful data",
    "资金流基于缓存快照": "Flow based on cached snapshot",
    "数据生成：": "Data generated: ",
    "页面刷新：": "Page refreshed: ",
    "数据可靠性：": "Data reliability: ",
    "置信度": "Confidence",
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
    "等待盘前确认": "Awaiting pre-market confirmation",
    "暂无高置信度机会": "No high-confidence opportunity yet",
    "当前指数数据可用性不足": "Insufficient index data availability",
    "等待实时源恢复前，仅作辅助参考。": "Auxiliary reference only until live sources recover.",
    "当前使用缓存快照维持观察，不生成强方向信号。": "Using cached snapshot for observation only; no strong directional signal generated.",
    "风险：期权信号只作辅助，需等待开盘量价确认。": "Risk: options signals are auxiliary only; wait for opening price-volume confirmation."
  }));

  const phraseRules = [
    [/北京时间/g, "Beijing Time"], [/等待同步/g, "Awaiting Sync"], [/等待确认/g, "Awaiting Confirmation"],
    [/读取快照/g, "Reading Snapshot"], [/观察模式/g, "Observation Mode"], [/结构参考/g, "Structural Reference"],
    [/非实时/g, "Not Real-Time"], [/延迟数据/g, "Delayed Data"], [/实时数据/g, "Live Data"],
    [/代理推断/g, "Proxy Inference"], [/缓存快照/g, "Cached Snapshot"], [/风险偏好/g, "Risk Appetite"],
    [/盘前/g, "Pre-Market"], [/盘中/g, "Intraday"], [/收盘/g, "Close"], [/明日/g, "Next Session"],
    [/市场/g, "Market"], [/板块/g, "Sector"], [/机会/g, "Opportunity"], [/动量/g, "Momentum"],
    [/异动/g, "Mover"], [/热度/g, "Heat"], [/追高/g, "Chasing"], [/回踩/g, "Pullback"],
    [/确认/g, "Confirmation"], [/情绪/g, "Sentiment"], [/宏观/g, "Macro"], [/新闻/g, "News"],
    [/期权/g, "Options"], [/信号/g, "Signal"], [/数据源/g, "Data Source"], [/数据/g, "Data"],
    [/读取/g, "Reading"], [/同步/g, "Sync"], [/最新/g, "Latest"], [/正常/g, "Normal"], [/谨慎/g, "Cautious"]
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
      html[data-lang="en"] .section-title h2,
      html[data-lang="en"] .command-tile p,
      html[data-lang="en"] .workspace-tab strong,
      html[data-lang="en"] .panel-label { letter-spacing: .02em; }
      html[data-lang="en"] .workspace-tab strong { font-size: clamp(11px, .9vw, 13px); }
    `;
    document.head.appendChild(style);
  }

  function translateText(value) {
    const original = String(value || "");
    const trimmed = original.trim();
    if (!trimmed || !CJK_RE.test(trimmed)) return original;
    if (dict.has(trimmed)) return preserveSpacing(original, dict.get(trimmed));
    let next = original;
    for (const [pattern, replacement] of phraseRules) next = next.replace(pattern, replacement);
    return next;
  }

  function preserveSpacing(original, translated) {
    const prefix = original.match(/^\s*/)?.[0] || "";
    const suffix = original.match(/\s*$/)?.[0] || "";
    return `${prefix}${translated}${suffix}`;
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
    if (!saved || (CJK_RE.test(current) && current !== translateText(saved))) {
      originals.set(node, current);
    }
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
          if (record.type === "characterData" && record.target?.nodeValue && CJK_RE.test(record.target.nodeValue)) {
            originals.set(record.target, record.target.nodeValue);
          }
        }
        bindToggle();
        scheduleApply();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    scheduleApply();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();