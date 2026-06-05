import React, { useMemo, useState } from "react";
import { Activity, Gauge, LineChart, ShieldAlert, TrendingUp } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Card({ children, className = "" }) {
  return (
    <section
      className={cn(
        "rounded-[1.6rem] border border-slate-800/90 bg-slate-950/40 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    rose: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    sky: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    slate: "border-slate-700 bg-slate-900/70 text-slate-300",
  };
  return <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em]", tones[tone])}>{children}</span>;
}

function BiasBar({ label, value, tone = "sky" }) {
  const colors = {
    emerald: "bg-emerald-300/80",
    amber: "bg-amber-300/80",
    rose: "bg-rose-300/80",
    sky: "bg-sky-300/80",
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
        <span className="font-mono text-xs font-black text-slate-300">{value}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800/80">
        <div className={cn("h-full rounded-full", colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

const DEFAULT_MACRO_STATES = [
  {
    state: "Risk-On Expansion",
    short: "Attack",
    tone: "emerald",
    icon: TrendingUp,
    condition: "QQQ firm, VIX fading, dollar stable, breadth improving.",
    action: "Permit selective CALL setups after micro confirmation.",
    bias: { attack: 76, wait: 38, defend: 18 },
  },
  {
    state: "Transition / Chop",
    short: "Wait",
    tone: "amber",
    icon: Activity,
    condition: "Index direction and volatility are not aligned.",
    action: "Reduce frequency. Let the first move reveal liquidity.",
    bias: { attack: 42, wait: 74, defend: 44 },
  },
  {
    state: "Risk-Off Defense",
    short: "Defend",
    tone: "rose",
    icon: ShieldAlert,
    condition: "VIX rising, QQQ weak, dollar/yields pressuring duration.",
    action: "No chasing. Prefer PUT / hedge watch or stay flat.",
    bias: { attack: 16, wait: 64, defend: 82 },
  },
];

const TONE_STYLES = {
  emerald: {
    card: "border-emerald-300/20 bg-emerald-400/[0.045]",
    active: "ring-1 ring-emerald-300/40",
    accent: "bg-emerald-300/80",
    text: "text-emerald-200",
  },
  amber: {
    card: "border-amber-300/20 bg-amber-400/[0.045]",
    active: "ring-1 ring-amber-300/40",
    accent: "bg-amber-300/80",
    text: "text-amber-200",
  },
  rose: {
    card: "border-rose-300/20 bg-rose-400/[0.045]",
    active: "ring-1 ring-rose-300/40",
    accent: "bg-rose-300/80",
    text: "text-rose-200",
  },
};

export default function MacroRadarBoard({ states = DEFAULT_MACRO_STATES, activeState }) {
  const initialIndex = useMemo(() => {
    if (!activeState) return 0;
    const found = states.findIndex((item) => item.state === activeState || item.short === activeState);
    return found >= 0 ? found : 0;
  }, [activeState, states]);

  const [active, setActive] = useState(initialIndex);
  const current = states[active] || states[0];
  const CurrentIcon = current.icon || Gauge;
  const currentTone = TONE_STYLES[current.tone] || TONE_STYLES.amber;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        {states.map((item, index) => {
          const Icon = item.icon || Gauge;
          const tone = TONE_STYLES[item.tone] || TONE_STYLES.amber;
          const selected = index === active;

          return (
            <button
              key={item.state}
              type="button"
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              className={cn(
                "group rounded-[1.35rem] border p-4 text-left transition duration-200 hover:-translate-y-0.5",
                tone.card,
                selected ? tone.active : "",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Macro State</p>
                  <h3 className="mt-2 text-sm font-black text-slate-100">{item.state}</h3>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
                  <Icon className={cn("h-4 w-4", tone.text)} />
                </div>
              </div>
              <p className="mt-4 min-h-[48px] text-sm font-semibold leading-6 text-slate-400">{item.condition}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Pill tone={item.tone}>{item.short}</Pill>
                <span className="font-mono text-[11px] font-bold text-slate-500">FILTER</span>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={cn("h-2.5 w-2.5 rounded-full", currentTone.accent)} />
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Current Macro Filter</p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <CurrentIcon className={cn("h-6 w-6", currentTone.text)} />
              <h2 className="text-2xl font-black tracking-tight text-slate-50 md:text-3xl">{current.state}</h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-400">{current.action}</p>
          </div>
          <Pill tone={current.tone}>{current.short}</Pill>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <BiasBar label="CALL / Attack" value={current.bias.attack} tone="emerald" />
          <BiasBar label="Wait / De-risk" value={current.bias.wait} tone="amber" />
          <BiasBar label="PUT / Defend" value={current.bias.defend} tone="rose" />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
          <div className="mb-3 flex items-center gap-2">
            <LineChart className="h-4 w-4 text-sky-200" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Execution Principle</span>
          </div>
          <p className="text-sm font-semibold leading-7 text-slate-300">
            Macro environment is only a filter. Micro signals still decide execution: liquidity sweep, VWAP behavior,
            relative volume, sector alignment, and price-volume confirmation.
          </p>
        </div>
      </Card>
    </div>
  );
}
