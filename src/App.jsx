import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import MacroRadarBoard from "./components/MacroRadarBoard";
import RiskBiasMeter from "./components/RiskBiasMeter";
import TradingMatrix from "./components/TradingMatrix";
import OptionsSystem from "./components/OptionsSystem";

const SNAPSHOT_ENDPOINT = "/api/snapshot-cached";
const REFRESH_MS = 60_000;

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatTime(value) {
  if (!value) return "--";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return "--";
  }
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("live")) return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (normalized.includes("delayed") || normalized.includes("stale")) return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  return "border-slate-700 bg-slate-900/70 text-slate-300";
}

function deriveMacroStates(snapshot) {
  const riskMode = snapshot?.summary?.riskMode || snapshot?.riskRegime?.mode || snapshot?.risk?.mode || "Neutral";
  const riskScore = Number(snapshot?.summary?.riskScore ?? snapshot?.riskRegime?.score ?? snapshot?.risk?.score ?? 50);
  const marketRegime = snapshot?.marketRegime?.type || snapshot?.summary?.marketRegime || "UNCONFIRMED";

  const riskOnAttack = riskMode === "Risk-On" ? 78 : riskScore >= 58 ? 64 : 32;
  const riskOffDefend = riskMode === "Risk-Off" ? 82 : riskScore <= 44 ? 68 : 28;
  const wait = riskMode === "Neutral" ? 76 : marketRegime === "CHOP" ? 80 : 48;

  return [
    {
      state: "Risk-On Expansion",
      short: "Attack",
      tone: "emerald",
      condition: "Macro filter permits selective upside execution only after micro confirmation.",
      action: "CALL setups require VWAP strength, relative volume, and sector alignment.",
      bias: { attack: riskOnAttack, wait: Math.max(30, 100 - riskOnAttack), defend: Math.max(12, riskOffDefend - 30) },
    },
    {
      state: "Transition / Chop",
      short: "Wait",
      tone: "amber",
      condition: "Macro inputs are mixed or market structure is unstable.",
      action: "Reduce frequency. Let liquidity and the opening range define direction.",
      bias: { attack: 38, wait, defend: 42 },
    },
    {
      state: "Risk-Off Defense",
      short: "Defend",
      tone: "rose",
      condition: "Volatility, breadth, dollar, or yield pressure is unfavorable for chasing.",
      action: "Prefer no trade, PUT / hedge watch, or smaller size until risk cools.",
      bias: { attack: Math.max(10, riskOnAttack - 45), wait: 62, defend: riskOffDefend },
    },
  ];
}

function chooseActiveState(snapshot) {
  const riskMode = snapshot?.summary?.riskMode || snapshot?.riskRegime?.mode || snapshot?.risk?.mode || "Neutral";
  if (riskMode === "Risk-On") return "Risk-On Expansion";
  if (riskMode === "Risk-Off") return "Risk-Off Defense";
  return "Transition / Chop";
}

function Header({ snapshot, loading, onRefresh }) {
  const status = snapshot?.summary?.status || snapshot?.sources?.marketData?.status || "snapshot";
  const generatedAt = snapshot?.generatedAt || snapshot?.summary?.updatedAt || null;
  const provider = snapshot?.summary?.provider || snapshot?.marketData?.provider || "Market data layer";

  return (
    <header className="rounded-[2rem] border border-slate-800 bg-slate-950/50 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.42)] backdrop-blur-md md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Specularis Market Intelligence</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-[-0.06em] text-slate-50 md:text-6xl">
            Macro Filter. Micro Execution.
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-400">
            A disciplined market intelligence dashboard built around one rule: macro environment filters opportunity,
            micro signals decide execution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <span className={cn("rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.16em]", statusTone(status))}>{status}</span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-xs font-bold text-slate-300">
            {provider}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-xs font-bold text-slate-500">
            {formatTime(generatedAt)}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-200 transition hover:border-sky-300/40 hover:text-sky-100"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}

function DecisionSignalBoard({ snapshot }) {
  const decision = snapshot?.tradeDecision || snapshot?.sources?.tradeDecision?.data || {};
  const confidence = snapshot?.confidenceScore || {};
  const headline = decision?.title || decision?.actionBias || snapshot?.summary?.headline || "WAIT FOR CONFIRMATION";
  const summary = decision?.summary || snapshot?.summary?.strategy || "No execution until market structure and micro signal align.";

  return (
    <section className="rounded-[1.8rem] border border-slate-800 bg-slate-950/40 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-md">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Decision Layer</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-50">{headline}</h2>
      <p className="mt-3 text-sm font-semibold leading-7 text-slate-400">{summary}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Data</div>
          <div className="mt-2 font-mono text-lg font-black text-slate-50">{confidence.dataConfidence || "LOW"}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Signal</div>
          <div className="mt-2 font-mono text-lg font-black text-slate-50">{confidence.signalConfidence || "LOW"}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Trade</div>
          <div className="mt-2 font-mono text-lg font-black text-slate-50">{confidence.tradeConfidence || snapshot?.summary?.confidence || "LOW"}</div>
        </div>
      </div>
    </section>
  );
}

function SourceHealthStrip({ snapshot }) {
  const sources = snapshot?.sources || {};
  const rows = ["marketData", "marketBreadth", "premarketMomentum", "newsAggregator", "optionsSignals", "decisionEngine"];

  return (
    <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {rows.map((key) => {
        const source = sources[key] || {};
        return (
          <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 backdrop-blur-md">
            <div className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{key}</div>
            <div className="mt-2 truncate text-xs font-black uppercase text-slate-200">{source.status || source.dataQuality || "snapshot"}</div>
          </div>
        );
      })}
    </section>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadSnapshot({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${SNAPSHOT_ENDPOINT}?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Snapshot request failed: ${response.status}`);
      const payload = await response.json();
      setSnapshot(payload);
    } catch (err) {
      setError(err?.message || "Snapshot unavailable");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadSnapshot();
    const timer = window.setInterval(() => loadSnapshot({ silent: true }), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const macroStates = useMemo(() => deriveMacroStates(snapshot), [snapshot]);
  const activeState = useMemo(() => chooseActiveState(snapshot), [snapshot]);
  const riskScore = Number(snapshot?.summary?.riskScore ?? snapshot?.riskRegime?.score ?? snapshot?.risk?.score ?? 50);
  const marketBreadth = Number(snapshot?.breadth?.breadthScore ?? snapshot?.marketStructurePro?.breadthPro?.score ?? 50);
  const tradeConfidenceScore = Number(snapshot?.confidenceScore?.score ?? 0);

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%)]" />
      <div className="relative mx-auto max-w-7xl p-6 space-y-6 md:p-8">
        <Header snapshot={snapshot} loading={loading} onRefresh={() => loadSnapshot()} />

        {error ? (
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm font-semibold text-rose-100">
            {error}. Showing the last client state if available.
          </div>
        ) : null}

        <SourceHealthStrip snapshot={snapshot} />

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <div className="min-w-0">
            <MacroRadarBoard snapshot={snapshot} loading={loading} />
          </div>
          <div className="grid gap-6">
            <RiskBiasMeter label="Risk Score" value={riskScore} tone={riskScore >= 58 ? "emerald" : riskScore <= 44 ? "rose" : "amber"} description="Macro environment filter derived from index, volatility, breadth, yield, and dollar pressure." />
            <RiskBiasMeter label="Breadth" value={marketBreadth} tone={marketBreadth >= 58 ? "emerald" : marketBreadth <= 42 ? "rose" : "sky"} description="Market participation and sector confirmation layer." />
            <RiskBiasMeter label="Confidence" value={tradeConfidenceScore} tone="sky" description="Data, signal, and trade-confidence aggregation." />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <div className="min-w-0">
            <TradingMatrix snapshot={snapshot} loading={loading} />
          </div>
          <DecisionSignalBoard snapshot={snapshot} />
        </section>

        <section>
          <OptionsSystem snapshot={snapshot} />
        </section>
      </div>
    </main>
  );
}
