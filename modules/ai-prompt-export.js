// modules/ai-prompt-export.js
// Specularis Market Terminal Lite v1.4.3 - AI Prompt Export + AI Router Q&A.

const TICKERS = ["MU", "MRVL", "NVDA", "AVGO", "AMD", "TSM", "ASML", "PLTR", "ORCL", "SMCI"];
const GEMINI_LOCAL_CACHE_TTL_MS = 20 * 60 * 1000;
const GEMINI_DEFAULT_COOLDOWN_SECONDS = 60;
let geminiCooldownTimer = null;
let geminiCooldownUntil = 0;

function escHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STRUCTURE_LABELS = {
  stock: "正股 Stock",
  long_call: "买入 Call",
  call_spread: "Call 价差",
  put_spread: "Put 价差",
  wait: "等待 Wait",
  avoid: "回避 Avoid",
};

function fmt(v, fallback = "N/A") {
  if (v === null || v === undefined || v === "") return fallback;
  if (Number.isFinite(Number(v))) return String(Math.round(Number(v) * 100) / 100);
  return String(v);
}

function trendZh(v) {
  return {
    strong_uptrend: "强上涨",
    uptrend: "上涨",
    sideways: "震荡",
    downtrend: "下跌",
    strong_downtrend: "强下跌",
    placeholder: "等待数据",
    unavailable: "等待数据",
  }[v] || v || "等待数据";
}

function displayAiSource(value) {
  const raw = String(value || "AI Router");
  return /gemini/i.test(raw) ? "AI Router" : raw;
}

function buildPrompt(lang, { sipState, oilState, kolState, marketRegime, decisions }) {
  const now = lang === "en"
    ? new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour12: false })
    : new Date().toLocaleString("zh-CN", { timeZone: "America/New_York", hour12: false });
  const regimeStr = marketRegime?.label || marketRegime?.mode || "未知";
  const regimeScore = marketRegime?.score ?? "--";
  const kolEntries = kolState?.entries || [];

  // Build language-aware data lines
  const sipLines = TICKERS.map((t) => {
    const s = sipState?.[t] || {};
    const price = s.currentPrice ? `$${s.currentPrice}` : "N/A";
    const change = s.dailyChangePercent != null ? `${s.dailyChangePercent}%` : "N/A";
    const news = Array.isArray(s.recentNews) && s.recentNews.length > 0
      ? (typeof s.recentNews[0] === "object" ? s.recentNews[0].title : s.recentNews[0])
      : (lang === "en" ? "none" : "无");
    if (lang === "en") {
      return `  ${t}: price=${price} chg=${change} trend=${s.trendStatus || "N/A"} analyst=${s.analystTone || "N/A"} earnings=${s.earningsDate || "unknown"} news=${news}`;
    }
    return `  ${t}: 价格${price} 涨跌${change} 趋势${trendZh(s.trendStatus)} 分析师${s.analystTone || "N/A"} 财报${s.earningsDate || "未知"} 新闻:${news}`;
  }).join("\n");

  const oilLines = TICKERS.map((t) => {
    const o = oilState?.[t] || {};
    if (lang === "en") {
      return `  ${t}: structure=${o.preferredStructure || "wait"} IV=${o.ivStatus || "N/A"} earnings_risk=${o.earningsVolRisk ? "yes" : "no"} risk=${o.riskLevel || "N/A"}`;
    }
    return `  ${t}: 结构${STRUCTURE_LABELS[o.preferredStructure] || o.preferredStructure || "wait"} IV${o.ivStatus || "N/A"} 财报风险${o.earningsVolRisk ? "是" : "否"} 风险${o.riskLevel || "N/A"}`;
  }).join("\n");

  const kolLines = kolEntries.length > 0
    ? kolEntries.slice(0, 6).map((k) => {
        if (lang === "en") {
          return `  @${k.kolHandle}: ${k.stance} (conviction:${k.convictionLevel}) [${k.signalType}] tickers:${(k.mentionedTickers || []).join(",")} - ${(k.keyArguments || [k.aiDistillationSummary || "no thesis"])[0]}`;
        }
        return `  @${k.kolHandle}: ${k.stance} (${k.convictionLevel}信心) [${k.signalType}] 涉及:${(k.mentionedTickers || []).join(",")} - ${(k.keyArguments || [k.aiDistillationSummary || "无论点"])[0]}`;
      }).join("\n")
    : (lang === "en" ? "  No KOL input" : "  暂无 KOL 输入");

  const decisionLines = decisions && decisions.length > 0
    ? decisions.filter((d) => d.score !== null).slice(0, 5).map((d) => {
        if (lang === "en") {
          return `  ${d.ticker}: ${d.score}/10 [${d.rating}] action=${d.action} vehicle=${d.preferredVehicle} entry=${d.keyEntryZone || "N/A"} stop=${d.invalidationLevel || "N/A"} target=${d.targetZone || "N/A"}`;
        }
        return `  ${d.ticker}: ${d.score}/10 [${d.rating}] 动作:${d.action} 工具:${d.preferredVehicle} 进场:${d.keyEntryZone || "N/A"} 止损:${d.invalidationLevel || "N/A"} 目标:${d.targetZone || "N/A"}`;
      }).join("\n") || (lang === "en" ? "  No valid scores" : "  暂无有效评分")
    : (lang === "en" ? "  No valid scores" : "  暂无有效评分");

  if (lang === "en") {
    return `
=== SPECULARIS MARKET TERMINAL LITE - AI ANALYSIS PROMPT ===
Generated: ${now} EST | Mode: Human-in-the-Loop

MARKET REGIME: ${regimeStr} (Score: ${regimeScore}/100)

STOCK INTELLIGENCE PRO:
${sipLines}

OPTIONS INTELLIGENCE LITE:
${oilLines}

KOL DISTILLATION:
${kolLines}

AI DECISION LAYER:
${decisionLines}

REQUESTS:
1. Assess current market regime for AI/semiconductor stocks.
2. Which 3 tickers are most tradable today and why?
3. For the top 2 tickers: stock vs option, IV/event risk, preferred structure.
4. Provide score, entry zone, invalidation, and target for the strongest setup.
5. List mandatory no-trade conditions and top risks.

Rules: Be conservative when data is mixed or placeholder. No fabricated GEX, insider, or options-flow data. Research only.
`.trim();
  }

  return `
=== SPECULARIS 市场终端 LITE - AI 分析提示词 ===
生成时间：${now} 美东时间 | 模式：人工智能协同分析

当前市场状态：${regimeStr}（评分 ${regimeScore}/100）

【个股情报 Pro】
${sipLines}

【期权情报 Lite】
${oilLines}

【KOL 观点蒸馏】
${kolLines}

【AI 决策层评分】
${decisionLines}

分析请求：
1. 当前市场状态对 AI / 半导体板块意味着什么？风险偏好如何？
2. 今日最具交易性的 3 个标的是什么？理由是什么？
3. 针对前 2 个标的：选择正股还是期权？当前 IV / 财报事件风险是否过高？建议哪种期权结构？
4. 最强机会的完整评分、进场区间、止损位和目标位。
5. 今日必须遵守的不可交易条件和 3 大风险。

规则：数据混合或占位符时请保守。请勿编造 GEX、内部人或异常大单数据。仅供研究。
`.trim();
}

function getGeminiSummary() {
  try {
    return window._specularisDashboard?.terminalLite?.geminiSummary || null;
  } catch {
    return null;
  }
}

function getGeminiSummaryHtml() {
  const gemini = getGeminiSummary();
  if (!gemini) return "";
  const status = gemini.status || gemini.dataStatus || "unavailable";
  const summary = gemini.summary || {};
  const zh = summary.zhSummary || summary.rawText || "AI 分析摘要暂不可用。";
  const risks = Array.isArray(summary.topRisks) ? summary.topRisks.slice(0, 3).join(" / ") : "";
  const focus = Array.isArray(summary.watchlistFocus) ? summary.watchlistFocus.slice(0, 5).join(" / ") : "";
  const source = displayAiSource(gemini.source);
  return `
  <div class="ape-gemini-card">
    <div class="ape-output-header">
      <span class="ape-output-label">AI 分析摘要 · ${escHtml(status)}</span>
      <span class="ape-note">${escHtml(source)}</span>
    </div>
    <p class="ape-desc">${escHtml(zh)}</p>
    ${risks ? `<p class="ape-note"><strong>Top risks:</strong> ${escHtml(risks)}</p>` : ""}
    ${focus ? `<p class="ape-note"><strong>Focus:</strong> ${escHtml(focus)}</p>` : ""}
  </div>`;
}

function simpleHash(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function localCacheKey(promptHash) {
  return `specularis:gemini-auto-analysis:${promptHash}`;
}

function getLocalGeminiCache(promptHash) {
  try {
    const raw = localStorage.getItem(localCacheKey(promptHash));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.storedAt || Date.now() - parsed.storedAt > GEMINI_LOCAL_CACHE_TTL_MS) {
      localStorage.removeItem(localCacheKey(promptHash));
      return null;
    }
    return parsed.result || null;
  } catch {
    return null;
  }
}

function setLocalGeminiCache(promptHash, result) {
  try {
    localStorage.setItem(localCacheKey(promptHash), JSON.stringify({ storedAt: Date.now(), result }));
  } catch {}
}

export function renderAIPromptExport(containerId, getModuleStates) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let latestDecisions = [];

  document.addEventListener("specularis:decisionsReady", (e) => {
    latestDecisions = e.detail?.decisions || [];
  });

  function currentStates() {
    return getModuleStates();
  }

  function buildCurrentPrompt(lang) {
    const { sipState, oilState, kolState, marketRegime } = currentStates();
    return buildPrompt(lang, { sipState, oilState, kolState, marketRegime, decisions: latestDecisions });
  }

  function buildCompactPrompt(lang, userQuestion = "") {
    const { sipState = {}, oilState = {}, marketRegime = {}, snapshot = {} } = currentStates();
    const tl = snapshot?.terminalLite || window._specularisDashboard?.terminalLite || {};
    const regime = tl.marketRegimeSummary || marketRegime || {};
    const decisions = latestDecisions.length ? latestDecisions : (tl.aiDecisionLayer || []);
    const gemini = getGeminiSummary();
    const geminiText = gemini?.summary?.zhSummary || gemini?.summary?.enSummary || gemini?.summary?.rawText || "";

    const stockLines = TICKERS.map((ticker) => {
      const s = sipState[ticker] || (tl.stockIntelligencePro || []).find((x) => x.ticker === ticker) || {};
      const o = oilState[ticker] || (tl.optionsIntelligenceLite || []).find((x) => x.ticker === ticker) || {};
      const risks = Array.isArray(s.riskFlags) && s.riskFlags.length ? s.riskFlags.join("/") : "none";
      const trendLabel = lang === "en"
        ? (s.trendStatus || "unknown")
        : trendZh(s.trendStatus);
      const structLabel = lang === "en"
        ? (o.preferredStructure || "wait")
        : (STRUCTURE_LABELS[o.preferredStructure] || o.preferredStructure || "wait");
      return `${ticker}: price=${fmt(s.currentPrice)} change=${fmt(s.dailyChangePercent)}% trend=${trendLabel} risks=${risks}; option=${structLabel} iv=${o.ivStatus || "N/A"} risk=${o.riskLevel || "N/A"}`;
    }).join("\n");

    const topDecisionLines = decisions
      .filter((d) => d && d.ticker)
      .slice(0, 5)
      .map((d) => `${d.ticker}: score=${fmt(d.score, "--")} rating=${d.rating || "N/A"} action=${d.action || "N/A"} vehicle=${d.preferredVehicle || "N/A"} entry=${d.keyEntryZone || "N/A"} invalidation=${d.invalidationLevel || "N/A"} target=${d.targetZone || "N/A"}`)
      .join("\n") || "No valid decision rows.";

    const questionBlock = userQuestion ? `\nUSER QUESTION:\n${userQuestion}\n` : "";
    const instruction = lang === "en"
      ? "Answer in concise structured English. Include conclusion, reasons, risks, no-trade conditions, and missing data. Research only."
      : "请用中文直接回答。包含：结论、理由、风险、不可交易条件、仍需确认的数据。仅供研究，不构成投资建议。";

    return `
=== SPECULARIS COMPACT AI ROUTER CONTEXT v1.4.3 ===
MARKET REGIME:
mode=${regime.mode || regime.type || "N/A"} label=${regime.label || regime.headline || "N/A"} score=${fmt(regime.score, "--")} conclusion=${regime.conclusion || "N/A"}

AI DECISION LAYER TOP 5:
${topDecisionLines}

WATCHLIST ONE-LINE SNAPSHOT:
${stockLines}

EXISTING AI ANALYSIS SUMMARY:
${geminiText ? geminiText.slice(0, 900) : "N/A"}
${questionBlock}
INSTRUCTIONS:
${instruction}
Do not fabricate GEX, options flow, insider data, or unavailable IV. If data is delayed/proxy/unavailable, say so.
`.trim();
  }

  function copyText(text, btn, idleText) {
    const write = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(text)
      : Promise.reject(new Error("clipboard_unavailable"));
    write.then(() => {
      if (btn) {
        btn.textContent = "已复制 Copied";
        setTimeout(() => { btn.textContent = idleText; }, 2000);
      }
    }).catch(() => {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
    });
  }

  function removeOutputs() {
    document.getElementById("apePromptOutput")?.remove();
    document.getElementById("apeManualPromptOutput")?.remove();
    document.getElementById("apeGeminiOutput")?.remove();
  }

  function setGeminiButtonsDisabled(disabled, text = "") {
    ["apeBtnGeminiZh", "apeBtnGeminiEn", "apeBtnAskGemini", "apeRegenerateGeminiBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = disabled;
      if (text) btn.textContent = text;
    });
  }

  function restoreGeminiButtons() {
    const labels = {
      apeBtnGeminiZh: "AI Router 自动分析",
      apeBtnGeminiEn: "AI Router English Analysis",
      apeBtnAskGemini: "网页内 AI 分析",
      apeRegenerateGeminiBtn: "重新生成",
    };
    Object.entries(labels).forEach(([id, label]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  }

  function startGeminiCooldown(seconds = GEMINI_DEFAULT_COOLDOWN_SECONDS) {
    clearInterval(geminiCooldownTimer);
    geminiCooldownUntil = Date.now() + Math.max(1, seconds) * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((geminiCooldownUntil - Date.now()) / 1000));
      if (remaining <= 0) {
        clearInterval(geminiCooldownTimer);
        geminiCooldownTimer = null;
        geminiCooldownUntil = 0;
        restoreGeminiButtons();
        return;
      }
      setGeminiButtonsDisabled(true, `冷却中 ${remaining}s / Cooling down ${remaining}s`);
    };
    tick();
    geminiCooldownTimer = setInterval(tick, 1000);
  }

  function generateAndShow(targetLang) {
    // Hard-enforce: "en" button always produces English, "zh" always Chinese
    const lang = (targetLang === "en") ? "en" : "zh";
    // Optionally include the user question from the textarea
    const questionInput = document.getElementById("apeQuestionInput");
    const userQuestion = (questionInput?.value || "").trim();
    const prompt = userQuestion
      ? buildCompactPrompt(lang, userQuestion)
      : buildCurrentPrompt(lang);
    removeOutputs();
    const langLabel = lang === "en" ? "English Prompt" : "中文提示词";
    const outputHtml = `
<div class="ape-output" id="apeManualPromptOutput">
  <div class="ape-output-header">
    <span class="ape-output-label">Generated ${escHtml(langLabel)}</span>
    <button class="ape-copy-btn" id="apeCopyBtn">复制 Copy</button>
  </div>
  <textarea class="ape-textarea" id="apePromptText" readonly>${escHtml(prompt)}</textarea>
  <p class="ape-note">${lang === "en"
    ? "Copy to GPT-4 / Claude Pro. AI Router uses a shorter compact prompt to avoid rate limits."
    : "可手动复制到 GPT Plus / Claude Pro 等工具。AI Router 自动分析使用更短的 compact prompt。"}</p>
</div>`;
    container.insertAdjacentHTML("beforeend", outputHtml);
    document.getElementById("apeCopyBtn").addEventListener("click", () => {
      copyText(prompt, document.getElementById("apeCopyBtn"), "复制 Copy");
    });
  }

  function renderGeminiResult(result, lang, prompt, title = "AI Router Auto Analysis", options = {}) {
    document.getElementById("apeGeminiOutput")?.remove();
    const status = result?.status || "unavailable";
    const source = options.localCache ? "Loaded from local cache" : displayAiSource(result?.source);
    const error = result?.error || "";
    const latency = Number.isFinite(result?.latencyMs) ? `${result.latencyMs}ms` : "--";
    const analysis = result?.analysis || (lang === "en"
      ? "No AI Router analysis returned. The generated prompt is preserved below."
      : "AI Router 未返回分析结果。下方保留本次生成的提示词。");
    const outputHtml = `
<div class="ape-output ape-gemini-output" id="apeGeminiOutput">
  <div class="ape-output-header">
    <span class="ape-output-label">${escHtml(title)} · ${escHtml(status)}</span>
    <button class="ape-copy-btn" id="apeCopyGeminiBtn">复制分析 Copy</button>
    <button class="ape-copy-btn" id="apeRegenerateGeminiBtn">重新生成</button>
  </div>
  <p class="ape-note">${escHtml(source)} · ${escHtml(latency)}${result?.cacheHit ? " · server cache" : ""}${options.localCache ? " · local cache" : ""}${error ? " · " + escHtml(error) : ""}</p>
  <textarea class="ape-textarea ape-textarea--analysis" id="apeGeminiText" readonly>${escHtml(analysis)}</textarea>
  <details class="ape-note">
    <summary>查看本次发送给 AI Router 的 compact prompt</summary>
    <textarea class="ape-textarea" readonly>${escHtml(prompt)}</textarea>
  </details>
  <p class="ape-note">如果 AI Router 暂时受限，可继续使用“生成中文提示词 / Generate English Prompt”手动复制到 GPT Plus 或 Claude Pro。</p>
</div>`;
    container.insertAdjacentHTML("beforeend", outputHtml);
    document.getElementById("apeCopyGeminiBtn")?.addEventListener("click", () => {
      copyText(analysis, document.getElementById("apeCopyGeminiBtn"), "复制分析 Copy");
    });
    document.getElementById("apeRegenerateGeminiBtn")?.addEventListener("click", () => {
      executeGeminiRequest({ lang, prompt, title, force: true });
    });
  }

  async function executeGeminiRequest({ lang, prompt, title, force = false }) {
    if (geminiCooldownUntil && Date.now() < geminiCooldownUntil) return;
    const promptHash = simpleHash(`${lang}|${prompt}`);
    if (!force) {
      const local = getLocalGeminiCache(promptHash);
      if (local) {
        renderGeminiResult(local, lang, prompt, title, { localCache: true });
        return;
      }
    }

    removeOutputs();
    setGeminiButtonsDisabled(true, lang === "en" ? "AI Router analyzing..." : "AI Router 分析中...");
    try {
      const response = await fetch("/api/ai-prompt-generate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, prompt, promptHash })
      });
      let result = null;
      try { result = await response.json(); } catch { result = null; }
      result = result || {
        status: "unavailable",
        source: "AI Router",
        error: `http_${response.status}`,
        analysis: lang === "en" ? "AI Router automatic analysis failed." : "AI Router 自动分析失败。"
      };
      if (result.status === "live") setLocalGeminiCache(promptHash, result);
      renderGeminiResult(result, lang, prompt, title);
      if (result.status === "rate_limited") startGeminiCooldown(Number(result.retryAfterSeconds) || GEMINI_DEFAULT_COOLDOWN_SECONDS);
      else restoreGeminiButtons();
    } catch (error) {
      renderGeminiResult({
        status: "unavailable",
        source: "AI Router",
        error: error?.message || "request_failed",
        analysis: lang === "en"
          ? "AI Router automatic analysis failed. You can still copy the generated prompt and analyze it manually."
          : "AI Router 自动分析失败。你仍然可以复制生成的提示词进行手动分析。"
      }, lang, prompt, title);
      restoreGeminiButtons();
    }
  }

  function runGeminiAutoAnalysis(lang) {
    const prompt = buildCompactPrompt(lang);
    return executeGeminiRequest({ lang, prompt, title: "AI Router Auto Analysis" });
  }

  function runGeminiQuestion(lang = "zh") {
    const input = document.getElementById("apeQuestionInput");
    const question = (input?.value || "").trim();
    if (!question) {
      renderGeminiResult({
        status: "unavailable",
        source: "Web AI Q&A",
        error: "missing_question",
        analysis: "请先在网页内输入你要分析的问题。"
      }, lang, buildCompactPrompt(lang), "AI Router Web Q&A");
      input?.focus();
      return;
    }
    const prompt = buildCompactPrompt(lang, question);
    return executeGeminiRequest({ lang, prompt, title: "AI Router Web Q&A" });
  }

  container.classList.remove("is-loading");
  container.innerHTML = `
<div class="ape-panel">
  <div class="ape-header">
    <div class="ape-header-text">
      <span class="ape-badge">Human-in-the-Loop AI Workflow</span>
      <h3 class="ape-title">网页端 AI 问答 / Prompt Export</h3>
      <p class="ape-desc">
        网页内 AI 分析使用短上下文 compact prompt，并带缓存与冷却保护；手动复制流程仍保留完整提示词。
      </p>
    </div>
  </div>
  ${getGeminiSummaryHtml()}
  <div class="ape-output" id="apeQuestionPanel">
    <div class="ape-output-header">
      <span class="ape-output-label">Web AI Q&amp;A / 网页内问答</span>
    </div>
    <textarea class="ape-textarea" id="apeQuestionInput" rows="4" placeholder="输入你的问题，例如：今天 AMD 和 NVDA 哪个更适合做 0DTE？风险点是什么？"></textarea>
    <div class="ape-btn-row">
      <button class="ape-gen-btn" id="apeBtnAskGemini">网页内 AI 分析</button>
      <button class="ape-copy-btn" id="apeClearQuestionBtn">清空</button>
    </div>
  </div>
  <div class="ape-btn-row">
    <button class="ape-gen-btn" id="apeBtnGeminiZh">AI Router 自动分析</button>
    <button class="ape-gen-btn ape-gen-btn--en" id="apeBtnGeminiEn">AI Router English Analysis</button>
  </div>
  <div class="ape-btn-row">
    <button class="ape-gen-btn" id="apeBtnZh">生成中文提示词</button>
    <button class="ape-gen-btn ape-gen-btn--en" id="apeBtnEn">Generate English Prompt</button>
  </div>
</div>`;

  document.getElementById("apeBtnGeminiZh").addEventListener("click", () => runGeminiAutoAnalysis("zh"));
  document.getElementById("apeBtnGeminiEn").addEventListener("click", () => runGeminiAutoAnalysis("en"));
  document.getElementById("apeBtnAskGemini").addEventListener("click", () => runGeminiQuestion("zh"));
  document.getElementById("apeClearQuestionBtn").addEventListener("click", () => {
    const input = document.getElementById("apeQuestionInput");
    if (input) {
      input.value = "";
      input.focus();
    }
  });
  document.getElementById("apeBtnZh").addEventListener("click", () => generateAndShow("zh"));
  document.getElementById("apeBtnEn").addEventListener("click", () => generateAndShow("en"));

  document.addEventListener("specularis:snapshotReady", () => {
    renderAIPromptExport(containerId, getModuleStates);
  }, { once: true });
}
