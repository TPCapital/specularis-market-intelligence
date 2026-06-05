import React from "react";
import { Activity, CircleDot, Globe2, RadioTower } from "lucide-react";

const surfaceClass =
  "bg-slate-950/40 backdrop-blur-md border border-slate-900/80 rounded-xl p-6 transition-all duration-300 hover:border-slate-800/80";

const labelClass = "text-[10px] font-medium tracking-widest text-slate-500 uppercase";
const metricClass = "font-mono tracking-tight font-light";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function formatNumber(value, fallback = "N/A") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toFixed(Math.abs(number) >= 10 ? 1 : 2);
}

function toneClass(value = "") {
  const text = String(value).toUpperCase();
  if (/(BULL|RISK_ON|RISK-ON|TREND|SQUEEZE|LIVE|CACHED|HIT|POSITIVE)/.test(text)) return "text-teal-400";
  if (/(BEAR|RISK_OFF|RISK-OFF|HEDGE|DEFENSIVE|NEGATIVE|ERROR)/.test(text)) return "text-rose-400";
  if (/(ALERT|RISK|MISS|UNAVAILABLE|STALE|FALLBACK)/.test(text)) return "text-amber-400";
  return "text-slate-400";
}

function badgeClass(value = "") {
  const text = String(value).toUpperCase();
  if (/(BULL|RISK_ON|RISK-ON|TREND|SQUEEZE|LIVE|CACHED|HIT|POSITIVE)/.test(text)) {
    return "bg-teal-500/10 text-teal-400 border-teal-500/20";
  }
  if (/(BEAR|RISK_OFF|RISK-OFF|HEDGE|DEFENSIVE|NEGATIVE|ERROR)/.test(text)) {
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  }
  if (/(ALERT|RISK|MISS|UNAVAILABLE|STALE|FALLBACK)/.test(text)) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  return "bg-slate-900/50 text-slate-400 border-slate-800";
}

function Dot({ tone = "neutral" }) {
  const color = toneClass(tone).replace("text-", "bg-");
  return <span className={cn("h-1.5 w-1.5 rounded-full", color)} />;
}

function Pill({ children, tone = "neutral" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-widest uppercase", badgeClass(tone))}>
      <Dot tone={tone} />
      {children}
    </span>
  );
}

function MetricTile({ label, value, tone = "neutral", suffix = "" }) {
  return (
    <div className="border-t border-slate-900/80 pt-4">
      <div className={labelClass}>{label}</div>
      <div className={cn("mt-2 text-2xl text-slate-100", metricClass, toneClass(tone))}>
        {value}
        {suffix ? <span className="ml-1 text-sm text-slate-500">{suffix}</span> : null}
      </div>
    </div>
  );
}

function SummaryLine({ title, value, tone = "neutral" }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-slate-900/80 pt-4">
      <div>
        <div className={labelClass}>{title}</div>
        <p className="mt-2 text-xs leading-6 text-slate-400">{value}</p>
      </div>
      <Dot tone={tone} />
    </div>
  );
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
  const narrativeStatus = resolvedNarrative.status || resolvedNarrative.politicalFlow?.trumpTrades?.status || "fallback";

  const narrativeSummary =
    resolvedNarrative.summary ||
    macroReport.summary ||
    snapshot.summary?.strategy ||
    "Macro signal remains stable while market structure waits for stronger confirmation.";

  const headline =
    resolvedNarrative.headline ||
    snapshot.summary?.headline ||
    `${regimeType} macro tape with ${riskMode} positioning bias`;

  return (
    <section className={cn(surfaceClass, "min-h-[420px] space-y-4", className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <RadioTower className="h-4 w-4 text-slate-500" />
            <span className={labelClass}>Macro Environment</span>
          </div>
          <h2 className="max-w-3xl text-3xl font-extralight leading-tight text-slate-100">
            {headline}
          </h2>
        </div>
        <Pill tone={narrativeStatus}>{narrativeStatus}</Pill>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-900/80 bg-slate-950/30 p-5">
            <div className={labelClass}>Executive Summary</div>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              <strong className="font-semibold text-slate-100">{regimeType}</strong>
              <span className="text-slate-500"> regime confirms </span>
              <strong className={cn("font-semibold", toneClass(riskMode))}>{riskMode}</strong>
              <span className="text-slate-500"> conditions. </span>
              {narrativeSummary}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <MetricTile label="SPY Delta" value={formatNumber(spy?.change)} suffix="%" tone={spy?.change >= 0 ? "bullish" : "bearish"} />
            <MetricTile label="QQQ Delta" value={formatNumber(qqq?.change)} suffix="%" tone={qqq?.change >= 0 ? "bullish" : "bearish"} />
            <MetricTile label="VIX Delta" value={formatNumber(vix?.change)} suffix="%" tone={vix?.change > 0 ? "bearish" : "bullish"} />
            <MetricTile label="Confidence" value={confidence} tone={confidence} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <SummaryLine
              title="Market Structure"
              value={resolvedRegime.explanation || "Index structure is online, but breadth and leadership still control execution quality."}
              tone={regimeType}
            />
            <SummaryLine
              title="Dollar Pressure"
              value={`DXY currently prints ${formatNumber(dxy?.change)}%. A stronger dollar mechanically reduces tolerance for long-duration risk.`}
              tone={dxy?.change > 0 ? "bearish" : "neutral"}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-900/80 bg-slate-950/30 p-5">
            <div className="flex items-center justify-between">
              <div className={labelClass}>Political Flow</div>
              <Globe2 className="h-4 w-4 text-slate-600" />
            </div>
            <div className="mt-5 space-y-4">
              {(topPolicies.length ? topPolicies : [{ policy: "policy cache", weight: 0 }]).map((item) => (
                <div key={item.policy} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Dot tone={item.weight > 0 ? "bullish" : item.weight < 0 ? "bearish" : "neutral"} />
                    <span className="text-xs text-slate-400">{item.policy}</span>
                  </div>
                  <span className={cn("text-sm", metricClass, toneClass(item.weight > 0 ? "bullish" : item.weight < 0 ? "bearish" : "neutral"))}>
                    {formatNumber(item.weight)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-900/80 bg-slate-950/30 p-5">
            <div className="flex items-center justify-between">
              <div className={labelClass}>Sensitive Symbols</div>
              <Activity className="h-4 w-4 text-slate-600" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(politicalSymbols.length ? politicalSymbols : [{ symbol: "SPY", bias: "NEUTRAL" }, { symbol: "QQQ", bias: "NEUTRAL" }]).map((item) => (
                <span
                  key={`${item.symbol}-${item.bias}`}
                  className={cn("rounded-full border px-2.5 py-1 text-xs", metricClass, badgeClass(item.bias))}
                >
                  {item.symbol}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-900/80 bg-slate-950/30 p-5">
            <div className={labelClass}>Macro Feed</div>
            <div className="mt-5 space-y-4">
              {(macroFeed.length ? macroFeed.slice(0, 3) : [{ title: "Macro Monitor", summary: "No external macro feed available.", tone: "neutral" }]).map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex gap-3">
                  <CircleDot className={cn("mt-1 h-3.5 w-3.5 shrink-0", toneClass(item.tone || item.bias))} />
                  <div>
                    <div className="text-xs font-normal text-slate-300">{item.title || item.source || "Macro Signal"}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.summary || item.description || item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
