import React from "react";
import { ArrowDownRight, ArrowUpRight, ShieldAlert, Sliders, Radio } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function formatNumber(value, fallback = "0.00") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return (number >= 0 ? "+" : "") + number.toFixed(2);
}

function getTone(value, type = "default") {
  const text = String(value).toUpperCase();
  const isPositive = /(BULL|RISK_ON|RISK-ON|TREND|SQUEEZE|LIVE|POSITIVE)/.test(text) || (type === "num" && Number(value) > 0);
  const isNegative = /(BEAR|RISK_OFF|RISK-OFF|HEDGE|DEFENSIVE|NEGATIVE|ERROR)/.test(text) || (type === "num" && Number(value) < 0);
  const isWarning = /(ALERT|RISK|MISS|UNAVAILABLE|STALE|FALLBACK)/.test(text);

  if (isPositive) return { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
  if (isNegative) return { text: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" };
  if (isWarning) return { text: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
  return { text: "text-slate-400", bg: "bg-slate-900/50 border-slate-800" };
}

function normalizeMacroRows(snapshot = {}) {
  const indices = asArray(snapshot.indices || snapshot.marketData?.indices || snapshot.sources?.marketData?.data?.indices);
  const macroFeed = asArray(snapshot.sources?.xMacro?.data || snapshot.xMacro || snapshot.macro);
  const policyFlow = snapshot.narrative?.politicalFlow || snapshot.layers?.narrative?.politicalFlow || {};
  const topPolicies = asArray(policyFlow.policyTilt?.topPolicies || policyFlow.topPolicies).slice(0, 4);

  return {
    indices,
    macroFeed,
    topPolicies,
    politicalSymbols: asArray(policyFlow.symbols).slice(0, 5)
  };
}

export default function MacroRadarBoard({
  snapshot = {},
  macro,
  narrative,
  marketRegime,
  riskRegime,
  confidenceScore,
  className = ""
}) {
  const resolvedRegime = marketRegime || snapshot.marketRegime || snapshot.layers?.marketRegime || {};
  const resolvedRisk = riskRegime || snapshot.riskRegime || snapshot.risk || {};
  const resolvedConfidence = confidenceScore || snapshot.confidenceScore || snapshot.layers?.confidenceScore || {};
  const resolvedNarrative = narrative || snapshot.narrative || snapshot.layers?.narrative || {};
  const macroReport = macro || resolvedNarrative.macro || snapshot.sources?.xMacro?.data?.[0] || {};
  
  const { indices, macroFeed, topPolicies, politicalSymbols } = normalizeMacroRows({ ...snapshot, narrative: resolvedNarrative });

  const spy = indices.find((item) => item.id === "SPY" || item.symbol === "SPY");
  const qqq = indices.find((item) => item.id === "QQQ" || item.symbol === "QQQ" || item.id === "NDX");
  const vix = indices.find((item) => item.id === "VIX" || item.symbol === "VIX");
  const dxy = indices.find((item) => item.id === "DXY" || item.symbol === "DXY");

  const regimeType = resolvedRegime.type || snapshot.summary?.marketRegime || "NEUTRAL";
  const riskMode = resolvedRisk.mode || snapshot.summary?.riskMode || "Neutral";
  const confidence = resolvedConfidence.tradeConfidence || snapshot.summary?.confidence || "LOW";
  const narrativeStatus = resolvedNarrative.status || resolvedNarrative.politicalFlow?.trumpTrades?.status || "Live";

  const narrativeSummary = resolvedNarrative.summary || macroReport.summary || snapshot.summary?.strategy || "";
  const headline = resolvedNarrative.headline || snapshot.summary?.headline || `${regimeType} Market Regime / ${riskMode} Bias`;

  return (
    <section className={cn("rounded-[2rem] border border-slate-900 bg-slate-950/20 p-8 backdrop-blur-xl md:p-10 space-y-10 shadow-[0_30px_100px_rgba(0,0,0,0.6)]", className)}>
      
      {/* 1. Open Editorial Header Narrative */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 items-center justify-center rounded-full bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.8)] animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 inline-flex items-center gap-2">
            <Radio className="h-3 w-3 text-slate-600" /> Live Macro Broadcast Stream
          </p>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <h2 className="text-3xl font-extralight tracking-tight text-slate-100 leading-tight md:text-4xl max-w-4xl">
            {headline}
          </h2>
          <span className={cn("self-start rounded-md border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase", getTone(narrativeStatus).bg, getTone(narrativeStatus).text)}>
            {narrativeStatus}
          </span>
        </div>
      </div>

      {/* 2. Intelligence Executive Report Presentation */}
      <div className="border-l-2 border-slate-800 pl-6 md:pl-8 space-y-3">
        <p className="text-lg leading-relaxed text-slate-300 font-light">
          Current market posture is formally diagnosed as a <span className="font-semibold text-slate-50 tracking-wide underline decoration-slate-700 decoration-2 underline-offset-4">{regimeType}</span> environment, 
          where the core macro intelligence layer enforces a <span className={cn("font-semibold tracking-wide", getTone(riskMode).text)}>{riskMode}</span> operational bias. 
          {narrativeSummary || "Macro liquidity structures remain uncompromised. Micro execution systems should proceed according to systematic baseline frequency guidelines."}
        </p>
      </div>

      {/* 3. Borderless Bloomberg-Style Metric Ticker Block */}
      <div className="grid grid-cols-2 gap-y-6 gap-x-12 pt-6 border-y border-slate-900/60 md:grid-cols-4">
        {[
          { item: spy, label: "SPY Delta", isVix: false },
          { item: qqq, label: "QQQ Delta", isVix: false },
          { item: vix, label: "VIX Volatility", isVix: true },
          { item: dxy, label: "DXY Dollar Index", isVix: false }
        ].map(({ item, label, isVix }) => {
          const val = Number(item?.change ?? 0);
          const isUp = val >= 0;
          const tone = isVix ? (isUp ? "bearish" : "bullish") : (isUp ? "bullish" : "bearish");
          const colorClass = getTone(tone).text;

          return (
            <div key={label} className="group space-y-1">
              <span className="text-[10px] font-medium tracking-widest text-slate-500 uppercase block">{label}</span>
              <div className="flex items-baseline gap-2">
                <span className={cn("font-mono text-3xl font-extralight tracking-tighter", colorClass)}>
                  {formatNumber(item?.change)}%
                </span>
                {isUp ? (
                  <ArrowUpRight className={cn("h-4 w-4 shrink-0 self-center opacity-60", colorClass)} />
                ) : (
                  <ArrowDownRight className={cn("h-4 w-4 shrink-0 self-center opacity-60", colorClass)} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Split Asymmetric Mechanics & Signals Layer */}
      <div className="grid gap-12 lg:grid-cols-[1.35fr_0.65fr] pt-4">
        
        {/* Left Column: Structural Text Streams */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5 text-slate-500" /> Structural Mechanics
            </h3>
            <p className="text-sm leading-7 font-light text-slate-400">
              {resolvedRegime.explanation || "Index architecture remains structurally intact above key moving variables, but underlying participation trends and factor rotation dictate the true velocity and margin of safety for execution."}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-slate-500" /> Currency & Intermarket Pressure
            </h4>
            <p className="text-sm leading-7 font-light text-slate-400">
              The Dollar Index (DXY) prints a change rate of <span className={cn("font-mono font-normal", getTone(dxy?.change, "num").text)}>{formatNumber(dxy?.change)}%</span>. 
              In asset allocation mechanics, persistent dollar acceleration acts as a systemic drag on high-beta long-duration equity positions.
            </p>
          </div>
          
          <div className="pt-2">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Engine Confidence</span>
              <div className="h-[2px] flex-1 bg-slate-900">
                <div 
                  className={cn("h-full transition-all duration-500", 
                    confidence === "HIGH" ? "bg-emerald-500 w-full" : confidence === "MEDIUM" ? "bg-amber-500 w-2/3" : "bg-slate-700 w-1/3"
                  )} 
                />
              </div>
              <span className={cn("font-mono text-xs font-bold uppercase tracking-wider", getTone(confidence).text)}>
                {confidence}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Open Borderless Tensors */}
        <div className="space-y-8 lg:border-l lg:border-slate-900 lg:pl-10">
          
          {/* Political Shifts */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Political Shifts</h3>
            <div className="space-y-3">
              {(topPolicies.length ? topPolicies : [{ policy: "Policy Anchor", weight: 0.0 }]).map((item) => {
                const tone = getTone(item.weight, "num").text;
                return (
                  <div key={item.policy} className="flex items-center justify-between text-xs font-light">
                    <span className="text-slate-400 truncate max-w-[160px]">{item.policy}</span>
                    <span className={cn("font-mono font-normal", tone)}>{formatNumber(item.weight)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sensitive Nodes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Sensitive Nodes</h3>
            <div className="flex flex-wrap gap-1.5">
              {(politicalSymbols.length ? politicalSymbols : [{ symbol: "SPY", bias: "NEUTRAL" }]).map((item) => (
                <span key={`${item.symbol}-${item.bias}`} className={cn("rounded-sm border px-2 py-0.5 text-[10px] font-mono font-medium tracking-wide transition-colors", getTone(item.bias).bg, getTone(item.bias).text)}>
                  {item.symbol}
                </span>
              ))}
            </div>
          </div>

          {/* Macro Signals Terminal */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Macro Signals</h3>
            <div className="space-y-4">
              {(macroFeed.length ? macroFeed.slice(0, 2) : [{ title: "Global Macro Monitor", summary: "External data links are healthy and streaming.", bias: "neutral" }]).map((item, index) => (
                <div key={`${item.title}-${index}`} className="group relative pl-3 space-y-1">
                  <div className={cn("absolute left-0 top-1 bottom-1 w-[1px]", getTone(item.tone || item.bias).text.replace("text-", "bg-"))} />
                  <div className="text-xs font-normal text-slate-300 group-hover:text-slate-100 transition-colors">
                    {item.title || item.source || "Feed Update"}
                  </div>
                  <p className="text-[11px] leading-5 text-slate-500 font-light">
                    {item.summary || item.description || item.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
