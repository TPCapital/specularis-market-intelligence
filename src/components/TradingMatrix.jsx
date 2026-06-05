import React from "react";
import { ArrowDownRight, ArrowUpRight, Crosshair, Minus, Rows3 } from "lucide-react";

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
  if (Array.isArray(value?.leaders)) return value.leaders;
  if (Array.isArray(value?.strong)) return value.strong;
  return [];
}

function formatNumber(value, digits = 2, fallback = "N/A") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toFixed(digits);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function toneClass(value = "") {
  const text = String(value).toUpperCase();
  if (/(BUY|CALL|BULL|LONG|HIGH|STRONG|BREAKOUT|RISK_ON|RISK-ON|WATCHLIST|TEAL)/.test(text)) return "text-teal-400";
  if (/(SELL|PUT|BEAR|SHORT|AVOID|LOW|WEAK|RISK_OFF|RISK-OFF|ROSE)/.test(text)) return "text-rose-400";
  if (/(WAIT|HOLD|ALERT|MEDIUM|CHOP|NEUTRAL|AMBER)/.test(text)) return "text-amber-400";
  return "text-slate-400";
}

function badgeClass(value = "") {
  const text = String(value).toUpperCase();
  if (/(BUY|CALL|BULL|LONG|HIGH|STRONG|BREAKOUT|RISK_ON|RISK-ON|WATCHLIST|TEAL)/.test(text)) {
    return "bg-teal-500/10 text-teal-400 border-teal-500/20";
  }
  if (/(SELL|PUT|BEAR|SHORT|AVOID|LOW|WEAK|RISK_OFF|RISK-OFF|ROSE)/.test(text)) {
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  }
  if (/(WAIT|HOLD|ALERT|MEDIUM|CHOP|NEUTRAL|AMBER)/.test(text)) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  return "bg-slate-900/50 text-slate-400 border-slate-800";
}

function DirectionIcon({ value }) {
  const number = Number(value);
  if (number > 0) return <ArrowUpRight className="h-3.5 w-3.5 text-teal-400" />;
  if (number < 0) return <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />;
  return <Minus className="h-3.5 w-3.5 text-slate-500" />;
}

function normalizeRows({ snapshot = {}, rows, watchlist, premarket, relativeVolume } = {}) {
  if (Array.isArray(rows) && rows.length) return rows;

  const strong = asArray(watchlist?.strong || snapshot.watchlist?.strong).map((item) => ({ ...item, bucket: "STRONG" }));
  const watch = asArray(watchlist?.watch || snapshot.watchlist?.watch).map((item) => ({ ...item, bucket: "WATCH" }));
  const avoid = asArray(watchlist?.avoid || snapshot.watchlist?.avoid).map((item) => ({ ...item, bucket: "AVOID" }));
  const scanner = asArray(premarket?.scanner || snapshot.premarket?.scanner).map((item) => ({ ...item, bucket: item.status || "SCANNER" }));
  const momentum = asArray(premarket?.momentum?.leaders || premarket?.leaders || snapshot.premarket?.momentum?.leaders).map((item) => ({ ...item, bucket: "MOMENTUM" }));
  const rvol = asArray(relativeVolume?.leaders || snapshot.layers?.relativeVolume?.leaders || snapshot.sources?.relativeVolume?.data?.leaders);

  const rvolMap = new Map(rvol.map((item) => [item.symbol || item.ticker, item]));
  const merged = [...strong, ...watch, ...avoid, ...scanner, ...momentum];
  const seen = new Set();

  return merged
    .map((item) => {
      const symbol = item.symbol || item.ticker;
      const volume = rvolMap.get(symbol) || {};
      return {
        ...item,
        symbol,
        relativeVolume: item.relativeVolume ?? volume.relativeVolume,
        volumeSignal: item.volumeSignal || volume.signal,
        bucket: item.bucket || item.status || "WATCH"
      };
    })
    .filter((item) => item.symbol && !seen.has(item.symbol) && seen.add(item.symbol))
    .slice(0, 12);
}

function confidenceFromRow(row = {}) {
  const score = Number(row.score ?? row.momentumScore ?? row.convictionScore ?? 0);
  if (score >= 82) return "HIGH";
  if (score >= 65) return "MEDIUM";
  if (row.bucket === "AVOID") return "LOW";
  return row.confidence || "LOW";
}

function setupFromRow(row = {}) {
  return row.setup || row.catalyst || row.reason || row.entry || "Wait for VWAP, liquidity, and index alignment.";
}

function actionFromRow(row = {}) {
  const bucket = String(row.bucket || row.status || "").toUpperCase();
  if (/AVOID/.test(bucket)) return "AVOID";
  if (/HIGH|STRONG/.test(bucket)) return "EXECUTE";
  if (/WATCH|MOMENTUM|SCANNER/.test(bucket)) return "WATCH";
  return row.action || "WAIT";
}

function HeaderCell({ children, align = "left" }) {
  return (
    <th className={cn("border-0 px-4 py-3 text-[10px] font-medium tracking-widest text-slate-500 uppercase", align === "right" && "text-right")}>
      {children}
    </th>
  );
}

function DataCell({ children, align = "left", className = "" }) {
  return <td className={cn("px-4 py-4 align-middle text-sm", align === "right" && "text-right", className)}>{children}</td>;
}

export default function TradingMatrix({
  snapshot = {},
  rows,
  watchlist,
  premarket,
  relativeVolume,
  title = "Trading Matrix",
  className = ""
}) {
  const normalizedRows = normalizeRows({ snapshot, rows, watchlist, premarket, relativeVolume });
  const regime = snapshot.marketRegime?.type || snapshot.summary?.marketRegime || "NEUTRAL";
  const tradeConfidence = snapshot.confidenceScore?.tradeConfidence || snapshot.summary?.confidence || "LOW";
  const activeRows = normalizedRows.filter((row) => actionFromRow(row) !== "AVOID").length;

  return (
    <section className={cn(surfaceClass, "space-y-4", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rows3 className="h-4 w-4 text-slate-500" />
            <span className={labelClass}>Micro Execution Signals</span>
          </div>
          <h2 className="mt-3 text-3xl font-extralight text-slate-100">{title}</h2>
          <p className="mt-2 max-w-2xl text-xs font-normal leading-6 text-slate-400">
            Clean execution layer for tickers that pass liquidity, momentum, and regime filters.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="border-l border-slate-900/80 pl-4">
            <div className={labelClass}>Regime</div>
            <div className={cn("mt-2 text-sm", metricClass, toneClass(regime))}>{regime}</div>
          </div>
          <div className="border-l border-slate-900/80 pl-4">
            <div className={labelClass}>Active</div>
            <div className={cn("mt-2 text-sm text-slate-200", metricClass)}>{activeRows}</div>
          </div>
          <div className="border-l border-slate-900/80 pl-4">
            <div className={labelClass}>Confidence</div>
            <div className={cn("mt-2 text-sm", metricClass, toneClass(tradeConfidence))}>{tradeConfidence}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-900/80 bg-slate-950/20">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <HeaderCell>Ticker</HeaderCell>
                <HeaderCell>Bias</HeaderCell>
                <HeaderCell align="right">Gap</HeaderCell>
                <HeaderCell align="right">RVOL</HeaderCell>
                <HeaderCell align="right">Score</HeaderCell>
                <HeaderCell>Setup</HeaderCell>
                <HeaderCell>Action</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {normalizedRows.length ? (
                normalizedRows.map((row, index) => {
                  const change = row.premarketPercent ?? row.change ?? row.regularMarketChangePercent ?? row.gap;
                  const rvol = row.relativeVolume ?? row.rvol ?? row.volumeRatio;
                  const score = row.score ?? row.momentumScore ?? row.convictionScore;
                  const action = actionFromRow(row);
                  const confidence = confidenceFromRow(row);

                  return (
                    <tr key={`${row.symbol}-${index}`} className="hover:bg-slate-900/30 transition-colors">
                      <DataCell>
                        <div className="flex items-center gap-3">
                          <DirectionIcon value={change} />
                          <div>
                            <div className="font-mono text-slate-200 font-bold">{row.symbol}</div>
                            <div className="mt-1 text-[10px] font-medium tracking-widest text-slate-600 uppercase">
                              {row.sector || row.category || "equity"}
                            </div>
                          </div>
                        </div>
                      </DataCell>
                      <DataCell>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-widest uppercase", badgeClass(row.bias || row.bucket || confidence))}>
                          {row.bias || row.bucket || confidence}
                        </span>
                      </DataCell>
                      <DataCell align="right" className={cn(metricClass, toneClass(Number(change) >= 0 ? "bullish" : "bearish"))}>
                        {formatPercent(change)}
                      </DataCell>
                      <DataCell align="right" className={cn(metricClass, "text-slate-300")}>
                        {formatNumber(rvol, 2)}x
                      </DataCell>
                      <DataCell align="right" className={cn(metricClass, toneClass(confidence))}>
                        {formatNumber(score, 0)}
                      </DataCell>
                      <DataCell className="max-w-[360px]">
                        <div className="flex items-start gap-3">
                          <span className={cn("mt-2 h-0.5 w-5 shrink-0 rounded-full", toneClass(action).replace("text-", "bg-"))} />
                          <span className="text-xs leading-6 text-slate-400">{setupFromRow(row)}</span>
                        </div>
                      </DataCell>
                      <DataCell>
                        <div className="flex items-center gap-2">
                          <Crosshair className={cn("h-3.5 w-3.5", toneClass(action))} />
                          <span className={cn("text-xs", metricClass, toneClass(action))}>{action}</span>
                        </div>
                      </DataCell>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className={labelClass}>No execution candidates</div>
                    <p className="mt-3 text-xs text-slate-500">The matrix is waiting for clean momentum, volume, and market structure alignment.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
