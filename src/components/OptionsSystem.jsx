import React from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function collectCards(snapshot) {
  const payload = snapshot?.optionsSignals || snapshot?.layers?.optionsSignals || snapshot?.sources?.optionsSignals?.data || snapshot?.sources?.unusualWhales?.data || {};
  if (Array.isArray(payload)) return payload;
  const combined = [
    ...(payload.callCandidates || []),
    ...(payload.putCandidates || []),
    ...(payload.watchOnly || []),
    ...(payload.avoidChasing || []),
    ...(payload.cards || []),
  ];
  return combined.filter(Boolean).slice(0, 6);
}

function normalizeSignal(item) {
  const raw = item?.direction || item?.conviction || item?.type || item?.bucket || "WATCH";
  const value = String(raw).toUpperCase();
  if (value.includes("CALL")) return { label: "CALL", tone: "emerald" };
  if (value.includes("PUT") || value.includes("HEDGE")) return { label: "PUT / HEDGE", tone: "rose" };
  if (value.includes("AVOID")) return { label: "AVOID", tone: "amber" };
  return { label: "WATCH", tone: "sky" };
}

const toneStyles = {
  emerald: "border-emerald-300/20 bg-emerald-400/[0.045] text-emerald-200",
  rose: "border-rose-300/20 bg-rose-400/[0.045] text-rose-200",
  amber: "border-amber-300/20 bg-amber-400/[0.045] text-amber-200",
  sky: "border-sky-300/20 bg-sky-400/[0.045] text-sky-200",
};

export default function OptionsSystem({ snapshot }) {
  const cards = collectCards(snapshot);
  const confidence = snapshot?.confidenceScore?.tradeConfidence || snapshot?.summary?.confidence || "LOW";

  return (
    <section className="rounded-[1.8rem] border border-slate-800 bg-slate-950/40 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Micro Signal Layer</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-50">Options System</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-400">
            Options are treated as execution instruments only. Direction, volatility, relative volume, and sector alignment must confirm.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-right">
          <div className="font-mono text-xs font-black uppercase tracking-[0.18em] text-slate-500">Trade Confidence</div>
          <div className="mt-1 font-mono text-sm font-black text-slate-100">{confidence}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.length ? cards.map((item, index) => {
          const signal = normalizeSignal(item);
          const score = item.score ?? item.callScore ?? item.putScore ?? item.convictionScore ?? "--";
          return (
            <article key={`${item.symbol || item.ticker || index}-${index}`} className={cn("rounded-[1.35rem] border p-4", toneStyles[signal.tone])}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xl font-black text-slate-50">{item.symbol || item.ticker || "OPTIONS"}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{item.sector || item.theme || "Options proxy signal"}</div>
                </div>
                <span className="rounded-full border border-current/30 bg-slate-950/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.15em]">{signal.label}</span>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Score</div>
                <div className="mt-1 font-mono text-3xl font-black text-slate-50">{score}</div>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">{item.summary || item.setup || "Wait for opening price-volume confirmation."}</p>
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{item.risk || item.invalidation || "Cancel if QQQ/SPY or VWAP behavior invalidates the setup."}</p>
            </article>
          );
        }) : (
          <div className="rounded-[1.35rem] border border-slate-800 bg-slate-950/45 p-6 text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-3">
            No options signal is active. This is valid: no clean setup means no trade.
          </div>
        )}
      </div>
    </section>
  );
}
