import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  Layers,
  LineChart,
  RefreshCcw,
  ShieldAlert,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Card({ children, className = "" }) {
  return <div className={cn("premium-card border border-cyan-300/10 bg-slate-950/78 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.42)] ring-1 ring-white/10", className)}>{children}</div>;
}

function Button({ children, className = "", variant = "default", type = "button", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-black transition focus:outline-none focus:ring-4";
  const variants = {
    default: "bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-400/20",
    ghost: "bg-slate-950/74 text-slate-300 hover:bg-slate-900/58 focus:ring-teal-400/20 border border-white/15",
    danger: "bg-red-700 text-white hover:bg-red-800 focus:ring-red-400/20",
  };
  return (
    <button type={type} className={cn(base, variants[variant] || variants.default, className)} {...props}>
      {children}
    </button>
  );
}

function Badge({ children, tone = "teal" }) {
  const toneMap = {
    teal: "border-teal-600 bg-teal-500/10 text-teal-100",
    red: "border-red-600 bg-red-500/10 text-red-100",
    amber: "border-amber-600 bg-amber-500/10 text-amber-100",
    blue: "border-sky-600 bg-sky-500/10 text-sky-100",
    violet: "border-violet-600 bg-violet-500/10 text-violet-100",
    slate: "border-slate-400/40 bg-slate-900/58 text-slate-200",
    green: "border-emerald-600 bg-emerald-500/10 text-emerald-100",
  };
  return <span className={cn("rounded-full border px-3 py-1 text-xs font-black", toneMap[tone])}>{children}</span>;
}

function KeyWord({ children, tone = "teal" }) {
  const toneMap = {
    teal: "bg-teal-700 text-white",
    red: "bg-red-700 text-white",
    amber: "bg-amber-600 text-white",
    blue: "bg-sky-700 text-white",
    violet: "bg-violet-700 text-white",
    slate: "bg-slate-800 text-white",
    green: "bg-emerald-700 text-white",
  };
  return <span className={cn("inline-flex rounded-lg px-2 py-0.5 text-xs font-black", toneMap[tone])}>{children}</span>;
}

function SectionHeader({ number, title, desc, tone = "teal" }) {
  const toneMap = {
    teal: "from-teal-700 to-cyan-600",
    blue: "from-sky-700 to-blue-600",
    red: "from-red-700 to-rose-600",
    amber: "from-amber-700 to-orange-600",
    violet: "from-violet-700 to-fuchsia-600",
    slate: "from-slate-800 to-slate-600",
  };
  return (
    <div className="mb-5 flex items-start gap-4">
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-black text-white shadow-lg",
          toneMap[tone]
        )}
      >
        {number}
      </div>
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-50">{title}</h2>
        <p className="mt-1 max-w-4xl text-sm font-bold leading-7 text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function RuleCard({ label, text, tone = "teal", icon: Icon = CheckCircle2 }) {
  const toneMap = {
    teal: "border-teal-300/25 bg-teal-500/10 text-teal-100",
    red: "border-red-300/35 bg-red-950/45 text-red-100",
    amber: "border-amber-300/25 bg-amber-500/10 text-amber-100",
    blue: "border-sky-300/25 bg-sky-500/10 text-sky-100",
    violet: "border-violet-300/35 bg-violet-500/10 text-violet-100",
    slate: "border-white/10 bg-slate-900/58 text-slate-100",
    green: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
  };
  return (
    <div className={cn("rounded-2xl border p-3 shadow-sm", toneMap[tone])}>
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <p className="text-sm font-black leading-6">{text}</p>
    </div>
  );
}

function FlowCard({ title, badge, tone = "teal", items = [] }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.01 }} transition={{ duration: 0.2 }}>
    <Card className="overflow-hidden rounded-[1.7rem] border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.35)] transition hover:shadow-[0_28px_70px_rgba(15,23,42,0.13)]">
      <div
        className={cn(
          "section-accent-bar h-2",
          tone === "teal"
            ? "bg-teal-700"
            : tone === "blue"
              ? "bg-sky-700"
              : tone === "amber"
                ? "bg-amber-600"
                : tone === "red"
                  ? "bg-red-700"
                  : tone === "violet"
                    ? "bg-violet-700"
                    : tone === "green"
                      ? "bg-emerald-700"
                      : "bg-slate-700"
        )}
      />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge tone={tone}>{badge}</Badge>
          <Target className="h-5 w-5 text-slate-500" />
        </div>
        <h3 className="text-lg font-black leading-7 text-slate-50">{title}</h3>
        <div className="mt-4 grid gap-2">
          {items.map((item) => (
            <RuleCard key={item.label} {...item} />
          ))}
        </div>
      </div>
    </Card>
    </motion.div>
  );
}

function VisualMeter({ label, left, right, fill = 50, tone = "teal", note }) {
  const [hovered, setHovered] = useState(false);
  const theme = {
    teal: { base: "bg-teal-500/100", soft: "bg-teal-400/30", dot: "border-teal-300/25 bg-teal-500/100 shadow-[0_0_18px_rgba(13,148,136,0.65)]", glow: "shadow-[0_0_18px_rgba(13,148,136,0.55)]" },
    red: { base: "bg-red-500/100", soft: "bg-red-400/25", dot: "border-red-300/35 bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.65)]", glow: "shadow-[0_0_18px_rgba(239,68,68,0.55)]" },
    amber: { base: "bg-amber-500/100", soft: "bg-amber-300/30", dot: "border-amber-100 bg-amber-500/100 shadow-[0_0_18px_rgba(245,158,11,0.65)]", glow: "shadow-[0_0_18px_rgba(245,158,11,0.55)]" },
    blue: { base: "bg-sky-500/100", soft: "bg-sky-300/30", dot: "border-sky-100 bg-sky-500/100 shadow-[0_0_18px_rgba(14,165,233,0.65)]", glow: "shadow-[0_0_18px_rgba(14,165,233,0.55)]" },
    violet: { base: "bg-violet-500/100", soft: "bg-violet-300/30", dot: "border-violet-100 bg-violet-500/100 shadow-[0_0_18px_rgba(139,92,246,0.65)]", glow: "shadow-[0_0_18px_rgba(139,92,246,0.55)]" },
    green: { base: "bg-emerald-500/100", soft: "bg-emerald-300/30", dot: "border-emerald-100 bg-emerald-500/100 shadow-[0_0_18px_rgba(16,185,129,0.65)]", glow: "shadow-[0_0_18px_rgba(16,185,129,0.55)]" },
  }[tone];
  return (
    <div
      className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 transition duration-300 hover:border-white/15 hover:bg-slate-950/74"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between text-xs font-black text-slate-500">
        <span>{label}</span>
        <span>{note}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800/80 ring-1 ring-white/10">
        <div className={cn("h-full rounded-full", theme.soft)} style={{ width: `${fill}%` }} />
        <motion.div
          className={cn("-mt-3 h-3 rounded-full", theme.base, theme.glow)}
          initial={false}
          animate={{ width: hovered ? `${fill}%` : "0%" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="relative mt-1 h-4">
        <motion.div
          className={cn("absolute top-0.5 h-3 w-3 rounded-full border-2", theme.dot)}
          initial={false}
          animate={{ left: hovered ? `calc(${fill}% - 6px)` : "-12px", opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs font-bold text-slate-500">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function ProcessRail({ steps, tone = "teal" }) {
  const dotTone = {
    teal: "bg-teal-700",
    blue: "bg-sky-700",
    amber: "bg-amber-600",
    violet: "bg-violet-700",
    red: "bg-red-700",
  }[tone];
  return (
    <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(4,minmax(0,1fr))]">
      {steps.map((step, i) => (
        <div key={step.title} className="relative rounded-[1.5rem] border border-white/10 bg-slate-950/74 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white", dotTone)}>
              {i + 1}
            </div>
            <div className="text-sm font-black text-slate-50">{step.title}</div>
          </div>
          <div className="text-sm font-bold leading-6 text-slate-400">{step.text}</div>
          {i !== steps.length - 1 && (
            <ArrowRight className="absolute -right-2 top-8 hidden h-4 w-4 text-slate-400 lg:block" />
          )}
        </div>
      ))}
    </div>
  );
}

function getCurrentETSession() {
  const now = new Date();
  const etHour = (now.getUTCHours() - 4 + 24) % 24;
  const etMin = now.getUTCMinutes();
  const etTime = etHour + etMin / 60;
  if (etTime >= 9.5 && etTime < 9.75) return 0;
  if (etTime >= 9.75 && etTime < 11.5) return 1;
  if (etTime >= 11.5 && etTime < 13.5) return 2;
  if (etTime >= 13.5 && etTime < 15) return 3;
  if (etTime >= 15.75 && etTime < 16) return 4;
  return -1;
}

function HeatWindow({ title, rows }) {
  const [active, setActive] = useState(null);
  const [currentSession, setCurrentSession] = useState(getCurrentETSession);

  useEffect(() => {
    const timer = setInterval(() => setCurrentSession(getCurrentETSession()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="rounded-[1.7rem] border-white/15 bg-slate-950/80 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-50">{title}</h3>
          <div className="mt-1 text-xs font-bold text-slate-500">当前美东时段自动高亮，仅作日内窗口提醒。</div>
        </div>
        <Clock className="h-5 w-5 text-slate-500" />
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, idx) => {
          const isCurrent = currentSession === idx;
          return (
          <div key={row.label} onMouseEnter={() => setActive(idx)} onMouseLeave={() => setActive(null)} className={cn("rounded-2xl border border-white/10 bg-slate-900/56 p-3 transition hover:border-white/15 hover:bg-slate-950/74", isCurrent ? "ring-2 ring-white/40 border-cyan-200/35 bg-slate-950/86" : "")}>
            <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-500">
              <span>{row.label}</span>
              <span className={cn(isCurrent ? "text-cyan-200" : "")}>{isCurrent ? "当前 · " : ""}{row.status}</span>
            </div>
            <div className="relative h-4 overflow-hidden rounded-full bg-slate-800/70 ring-1 ring-white/10">
              <div className={cn("h-full rounded-full opacity-20", row.className)} style={{ width: `${row.fill}%` }} />
              <motion.div
                className={cn("-mt-4 h-4 rounded-full", row.className, "shadow-[0_0_18px_rgba(15,23,42,0.20)]")}
                initial={false}
                animate={{ width: active === idx || isCurrent ? `${row.fill}%` : "0%" }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="mt-2 text-xs font-bold text-slate-400">{row.note}</div>
          </div>
        );})}
      </div>
    </Card>
  );
}

function RiskBiasMeter({ label, value, tone = "teal" }) {
  const [hovered, setHovered] = useState(false);
  const levels = [
    { max: 25, text: "低", count: 1 },
    { max: 50, text: "中", count: 2 },
    { max: 75, text: "高", count: 3 },
    { max: 100, text: "极高", count: 4 },
  ];
  const current = levels.find((l) => value <= l.max) || levels[levels.length - 1];
  const theme = {
    teal: {
      chip: "border-teal-300/25 bg-teal-500/10 text-teal-100",
      bar: "bg-teal-600",
      soft: "bg-teal-100",
    },
    amber: {
      chip: "border-amber-300/25 bg-amber-500/10 text-amber-100",
      bar: "bg-amber-500/100",
      soft: "bg-amber-100",
    },
    red: {
      chip: "border-red-300/35 bg-red-950/45 text-red-100",
      bar: "bg-red-600",
      soft: "bg-red-100",
    },
    blue: {
      chip: "border-sky-300/25 bg-sky-500/10 text-sky-100",
      bar: "bg-sky-600",
      soft: "bg-sky-100",
    },
    green: {
      chip: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
      bar: "bg-emerald-600",
      soft: "bg-emerald-100",
    },
  }[tone] || {
    chip: "border-white/10 bg-slate-900/58 text-slate-100",
    bar: "bg-slate-700",
    soft: "bg-slate-800/70",
  };

  return (
    <div
      className="rounded-2xl border border-white/10 bg-slate-950/74 p-3 transition hover:border-white/15"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-black text-slate-500">{label}</div>
        <div className={cn("rounded-full border px-2.5 py-1 text-xs font-black", theme.chip)}>{current.text}</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => {
          const active = i < current.count;
          return (
            <motion.div
              key={i}
              className={cn("h-2.5 rounded-full", active ? theme.bar : "bg-slate-800/75")}
              initial={false}
              animate={{ opacity: hovered ? 1 : active ? 0.92 : 0.5, scaleX: hovered && active ? 1 : 0.96 }}
              transition={{ duration: 0.45, delay: i * 0.04 }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
        <span>优先级</span>
        <span>{value >= 70 ? "可优先考虑" : value >= 40 ? "有条件参与" : "仅辅助判断"}</span>
      </div>
    </div>
  );
}

function VerticalMacroFlow() {
  const steps = [
    { title: "先看绝对值", text: "VIX 区间先定环境：低波、中性、高压。" },
    { title: "再看当日方向", text: "上行偏防守；下行偏进攻。" },
    { title: "映射风险状态", text: "Risk ON / 过渡 / Risk OFF。" },
    { title: "落实到动作", text: "Call 优先 / 降仓等待 / Put 或观望。" },
  ];
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={step.title} className="relative rounded-2xl border border-white/10 bg-slate-950/74 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">{i + 1}</div>
            <div>
              <div className="text-sm font-black text-slate-50">{step.title}</div>
              <div className="mt-1 text-xs font-bold leading-5 text-slate-400">{step.text}</div>
            </div>
          </div>
          {i !== steps.length - 1 && <div className="ml-4 mt-3 h-5 w-px bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

function DecisionSignalBoard({ title, items, tone = "teal" }) {
  const toneMap = {
    teal: "border-teal-300/25 bg-teal-500/10 text-teal-100",
    amber: "border-amber-300/25 bg-amber-500/10 text-amber-100",
    blue: "border-sky-300/25 bg-sky-500/10 text-sky-100",
    red: "border-red-300/35 bg-red-950/45 text-red-100",
    violet: "border-violet-300/35 bg-violet-500/10 text-violet-100",
  };
  return (
    <Card className="rounded-[1.7rem] border-white/15 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-50">{title}</h3>
        <Badge tone={tone}>图形规则</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-900/58 p-4">
            <div className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black", toneMap[item.tone] || toneMap.teal)}>{item.kicker}</div>
            <div className="mt-3 text-sm font-black text-slate-50">{item.title}</div>
            <div className="mt-2 text-sm font-bold leading-6 text-slate-400">{item.text}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FlagBackdrop({ type = "uk" }) {
  const src = type === "us" ? "/flag-us.png" : "/flag-gb.png";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.5rem]">
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="flag-backdrop-img absolute bottom-0 right-[-8%] h-full w-[72%] object-cover object-center"
      />
      <div className="flag-backdrop-wash absolute inset-0 bg-gradient-to-r from-slate-950/88 via-slate-950/58 to-slate-950/12" />
    </div>
  );
}

function SignalLamp({ active = "green" }) {
  const [hovered, setHovered] = useState(false);
  const color = {
    green: {
      off: "radial-gradient(circle at 32% 28%,#ffffff 0,#c8f7dc 24%,#8ad9ad 58%,#3e9f70 100%)",
      on: "radial-gradient(circle at 30% 24%,#ffffff 0,#bcffe2 22%,#34d399 58%,#059669 100%)",
      glow: "0 0 0 4px rgba(16,185,129,0.10),0 0 20px rgba(16,185,129,0.58),inset -4px -5px 9px rgba(4,120,87,0.38),inset 4px 4px 8px rgba(255,255,255,0.68)",
    },
    yellow: {
      off: "radial-gradient(circle at 32% 28%,#ffffff 0,#fff1b8 24%,#e4ca63 60%,#b98209 100%)",
      on: "radial-gradient(circle at 30% 24%,#ffffff 0,#fff4b8 22%,#facc15 58%,#d97706 100%)",
      glow: "0 0 0 4px rgba(245,158,11,0.10),0 0 20px rgba(245,158,11,0.58),inset -4px -5px 9px rgba(146,64,14,0.38),inset 4px 4px 8px rgba(255,255,255,0.68)",
    },
    red: {
      off: "radial-gradient(circle at 32% 28%,#ffffff 0,#ffd0d0 24%,#e59a9a 60%,#b43b3b 100%)",
      on: "radial-gradient(circle at 30% 24%,#ffffff 0,#ffc4c4 22%,#ef4444 58%,#b91c1c 100%)",
      glow: "0 0 0 4px rgba(239,68,68,0.10),0 0 20px rgba(239,68,68,0.58),inset -4px -5px 9px rgba(127,29,29,0.38),inset 4px 4px 8px rgba(255,255,255,0.68)",
    },
  }[active];
  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.16 }}
      className="h-8 w-8 shrink-0 rounded-full"
      style={{
        background: hovered ? color.on : color.off,
        boxShadow: hovered ? color.glow : "inset -4px -5px 9px rgba(15,23,42,0.16),inset 4px 4px 8px rgba(255,255,255,0.62),0 6px 13px rgba(15,23,42,0.10)",
      }}
    />
  );
}

function OptionSignalLightBoard() {
  const items = [
    {
      title: '允许出手',
      label: '绿灯',
      active: 'green',
      tone: 'teal',
      text: '大盘/板块同向，VWAP确认，量能启动，价差小。',
      card: 'border-emerald-300/25 bg-emerald-500/10',
      chip: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100',
    },
    {
      title: '谨慎处理',
      label: '黄灯',
      active: 'yellow',
      tone: 'amber',
      text: 'IV偏高、时间一般、方向虽对但空间有限。',
      card: 'border-amber-300/25 bg-amber-500/10',
      chip: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
    },
    {
      title: '直接放弃',
      label: '红灯',
      active: 'red',
      tone: 'red',
      text: '开盘乱流、午盘横磨、反复穿VWAP、无量。',
      card: 'border-red-300/35 bg-red-950/45',
      chip: 'border-red-300/35 bg-red-950/45 text-red-100',
    },
  ];
  return (
    <Card className="rounded-[1.7rem] border-white/15 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-50">期权执行信号灯</h3>
        <Badge tone="teal">悬停点亮</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <motion.div key={item.label} whileHover={{ y: -5, scale: 1.012 }} className={cn('group rounded-[1.5rem] border p-4 shadow-sm transition-all duration-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.13)]', item.card)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black', item.chip)}>{item.label}</div>
                <div className="mt-4 text-sm font-black text-slate-50">{item.title}</div>
              </div>
              <SignalLamp active={item.active} />
            </div>
            <div className="mt-4 text-sm font-bold leading-6 text-slate-400">{item.text}</div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function KillZoneBoard() {
  const items = [
    {
      title: '伦敦',
      emoji: '🇬🇧',
      flag: '英国',
      text: '15:00-17:00 北京：扫亚洲盘高低点',
      cls: 'border-amber-300/25 bg-amber-500/10',
      icon: CheckCircle2,
      iconCls: 'text-amber-100',
    },
    {
      title: '纽约',
      emoji: '🇺🇸',
      flag: '美国',
      text: '21:30-23:30 北京：扫伦敦高低点后定方向',
      cls: 'border-sky-300/25 bg-sky-500/10',
      icon: CheckCircle2,
      iconCls: 'text-sky-100',
    },
    {
      title: '禁区',
      text: '亚洲盘中间位默认不追，数据前后不做',
      cls: 'border-red-300/35 bg-red-950/45',
      icon: Ban,
      iconCls: 'text-red-100',
    },
  ];
  return (
    <div className="rounded-[1.6rem] border-2 border-red-300/35 bg-red-950/45 p-4 shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2"><KeyWord tone="red">Kill Zone</KeyWord><span className="text-sm font-black text-red-100">时间过滤优先于普通信号</span></div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.title} whileHover={{ y: -5, scale: 1.01 }} className={cn('group relative overflow-hidden rounded-[1.5rem] border p-5 shadow-sm transition-all duration-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]', item.cls)}>
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-5 w-5 shrink-0', item.iconCls)} />
                  <div className="text-lg font-black text-slate-50">{item.title}</div>
                </div>
                
              </div>
              <div className="relative z-10 mt-4 max-w-[72%] text-lg font-black leading-8 text-slate-50">{item.text}</div>
              {item.emoji ? <FlagBackdrop type={item.title === '纽约' ? 'us' : 'uk'} /> : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function MacroRadarBoard() {
  const [active, setActive] = useState(0);
  const current = macroCards[active];
  const Icon = current.icon || Gauge;
  return (
    <div className="grid gap-4 xl:grid-rows-[auto_auto_1fr]">
      <div className="grid gap-3 md:grid-cols-2">
        {macroCards.map((m, idx) => {
          const IconComp = m.icon || Gauge;
          const toneClass = {
            green: "border-emerald-300/25 bg-emerald-500/10 hover:border-emerald-300",
            amber: "border-amber-300/25 bg-amber-500/10 hover:border-amber-300",
            red: "border-red-300/35 bg-red-950/55 hover:border-red-300/60",
          }[m.tone] || "border-white/10 bg-slate-900/58 hover:border-white/15";
          return (
            <motion.button
              key={m.state}
              type="button"
              onMouseEnter={() => setActive(idx)}
              onFocus={() => setActive(idx)}
              whileHover={{ y: -3, scale: 1.01 }}
              className={cn(
                "rounded-[1.4rem] border p-4 text-left transition shadow-sm",
                toneClass,
                active === idx ? "ring-2 ring-slate-300 shadow-[0_16px_38px_rgba(15,23,42,0.10)]" : ""
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500">{m.state}</div>
                  <div className="mt-1 text-sm font-black text-slate-50">{m.cond}</div>
                </div>
                <div className="rounded-xl border border-white/60 bg-slate-900/70 p-2 shadow-sm"><IconComp className="h-4 w-4 text-slate-300" /></div>
              </div>
              <div className="mt-3 text-base font-black text-slate-100">{m.action}</div>
            </motion.button>
          );
        })}
      </div>

      <Card className="rounded-[1.5rem] border-white/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(30,41,59,0.62))] p-4 shadow-[0_22px_65px_rgba(0,0,0,0.34)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">当前聚焦</div>
            <div className="mt-1 flex items-center gap-2 text-lg font-black text-slate-50"><Icon className="h-5 w-5" />{current.state}</div>
            <div className="mt-1 text-sm font-bold text-slate-400">{current.cond}</div>
          </div>
          <Badge tone={current.tone === "green" ? "green" : current.tone === "red" ? "red" : "amber"}>{current.short}</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <RiskBiasMeter label="Call / 进攻" value={current.bias.attack} tone="teal" />
          <RiskBiasMeter label="等待 / 降仓" value={current.bias.wait} tone="amber" />
          <RiskBiasMeter label="Put / 防守" value={current.bias.defend} tone="red" />
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/58 p-3 text-xs font-bold leading-6 text-slate-400">
          这里不再强调晦涩百分比，而用 <span className="font-black text-slate-100">低 / 中 / 高 / 极高</span> 表达动作优先级：更接近真实执行，而不是精确预测。
        </div>
      </Card>

      <div className="grid gap-4">
        <Card className="rounded-[1.5rem] border-white/15 p-4 shadow-[0_22px_65px_rgba(0,0,0,0.34)]">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-base font-black text-slate-50">宏观决策流程</h4>
            <LineChart className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-4"><VerticalMacroFlow /></div>
        </Card>
        <Card className="rounded-[1.5rem] border-white/15 bg-slate-900/56 p-4 shadow-[0_22px_65px_rgba(0,0,0,0.34)]">
          <h4 className="text-base font-black text-slate-50">重点提醒</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/74 p-4 text-sm font-black leading-7 text-slate-200">不是只看 <KeyWord tone="slate">VIX绝对值</KeyWord>，还要看 <KeyWord tone="amber">当日方向</KeyWord>。</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/74 p-4 text-sm font-black leading-7 text-slate-200">VIX 从 <KeyWord tone="red">15 → 17</KeyWord>，通常比 <KeyWord tone="green">22 → 20</KeyWord> 更值得警惕。</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/74 p-4 text-sm font-black leading-7 text-slate-200">宏观只做 <KeyWord tone="blue">环境过滤</KeyWord>，不能代替具体入场触发。</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function VisualDecision({ title, tone = "teal", items }) {
  const headClass = {
    teal: "bg-teal-700 text-white",
    amber: "bg-amber-600 text-white",
    blue: "bg-sky-700 text-white",
    violet: "bg-violet-700 text-white",
    red: "bg-red-700 text-white",
  }[tone];
  return (
    <Card className="overflow-hidden rounded-[1.7rem] border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <div className={cn("px-5 py-4", headClass)}>
        <h3 className="text-lg font-black">{title}</h3>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-2xl border border-white/10 bg-slate-900/58 p-4">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">{it.label}</div>
            <div className="mt-2 text-sm font-black leading-6 text-slate-100">{it.text}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const matrix = [
  { name: "黄金 / EUR", role: "主战场", tone: "amber", core: "流动性 + 结构确认", do: "扫后收回、回踩确认", ban: "新闻盘 / 中间位" },
  { name: "期权买方", role: "当前重点", tone: "teal", core: "方向 + 时间 + 波动率", do: "确认后的中间段", ban: "无量 / 高IV / 扛单" },
  { name: "正股", role: "低频配置", tone: "blue", core: "基本面锚 + 技术择时", do: "先筛公司，再找位置", ban: "纯K线冲动" },
  { name: "加密", role: "暂缓扩展", tone: "violet", core: "OI + Funding + 清算", do: "清算后等确认", ban: "高杠杆猜顶底" },
];

const goldModels = [
  {
    title: "POC集中区",
    badge: "黄金核心",
    tone: "amber",
    items: [
      { label: "看", text: "3-5个相邻POC成本区", tone: "amber" },
      { label: "用", text: "上方偏强，下方偏弱", tone: "teal" },
      { label: "禁", text: "单一POC直接开仓", tone: "red", icon: Ban },
    ],
  },
  {
    title: "FVG + OB 共振",
    badge: "黄金入场",
    tone: "amber",
    items: [
      { label: "有效", text: "强推动留下，未反复穿透", tone: "amber" },
      { label: "触发", text: "回补边界 + 拒绝K + 放量", tone: "teal" },
      { label: "放弃", text: "结构破坏、止损太大", tone: "red", icon: XCircle },
    ],
  },
  {
    title: "MA9 / MA21 动能",
    badge: "短线过滤",
    tone: "amber",
    items: [
      { label: "强", text: "价格 > MA9 > MA21", tone: "green" },
      { label: "弱", text: "价格 < MA9 < MA21", tone: "red" },
      { label: "提醒", text: "均线只过滤，不开仓", tone: "slate" },
    ],
  },
];

const eurModels = [
  {
    title: "EMA趋势回踩",
    badge: "EUR / 外汇",
    tone: "blue",
    items: [
      { label: "环境", text: "EMA9/21/55顺排 + ADX > 25", tone: "blue" },
      { label: "入场", text: "回踩EMA21/结构位，等拒绝确认", tone: "teal" },
      { label: "放弃", text: "ADX低、均线缠绕、数据前后", tone: "red", icon: Ban },
    ],
  },
  {
    title: "破位不追",
    badge: "执行规则",
    tone: "blue",
    items: [
      { label: "先等", text: "突破后不追第一根", tone: "slate" },
      { label: "再看", text: "回踩不破 + 重新放量", tone: "teal" },
      { label: "管理", text: "RR≥1:2；到1:2先保本", tone: "green" },
    ],
  },
];

const optionModels = [
  {
    title: "VWAP确认协议",
    badge: "日内核心",
    tone: "teal",
    items: [
      { label: "定义", text: "VWAP是观察区，不是开仓点", tone: "slate" },
      { label: "Call", text: "回踩不破 / 快速收回 / 9EMA上拐", tone: "green" },
      { label: "Put", text: "反抽不过 / 上影失败 / 跌回下方", tone: "red" },
    ],
  },
  {
    title: "合约过滤",
    badge: "先筛再做",
    tone: "teal",
    items: [
      { label: "Delta", text: "日内0.45-0.55；波段0.40-0.50", tone: "teal" },
      { label: "价差", text: "0.01-0.08较好；0.20+放弃", tone: "amber" },
      { label: "止损", text: "-20%警戒；-25%硬止损", tone: "red", icon: ShieldAlert },
      { label: "DTE", text: "日内选1-5DTE；0DTE仅限高波动数据日快进快出", tone: "blue" },
    ],
  },
  {
    title: "板块协同",
    badge: "方向确认",
    tone: "violet",
    items: [
      { label: "NVDA", text: "看QQQ + XLK，同向才升级", tone: "violet" },
      { label: "TSLA", text: "看QQQ + XLY，冲突就降级", tone: "blue" },
      { label: "原则", text: "大盘/板块冲突，放弃或小仓", tone: "red", icon: AlertTriangle },
    ],
  },
];

const stockModels = [
  {
    title: "正股低频配置",
    badge: "非日内",
    tone: "blue",
    items: [
      { label: "先筛", text: "营收/利润增长、行业景气、无重大负面", tone: "blue" },
      { label: "再等", text: "周线不坏，日线回调支撑，60分钟确认", tone: "teal" },
      { label: "不做", text: "只因K线好看就买；PE不能机械套用", tone: "red", icon: Ban },
    ],
  },
];

const macroCards = [
  { state: "强Risk ON", cond: "VIX<18 且下行", action: "Call环境更友好", tone: "green", icon: TrendingUp, short: "偏进攻", bias: { attack: 88, wait: 20, defend: 8 } },
  { state: "低位转弱", cond: "VIX<18 但上行", action: "缩仓，防转向", tone: "amber", icon: AlertTriangle, short: "先收缩", bias: { attack: 40, wait: 72, defend: 28 } },
  { state: "过渡期", cond: "VIX 18-25", action: "降仓，等方向", tone: "amber", icon: Activity, short: "不扩张", bias: { attack: 28, wait: 80, defend: 35 } },
  { state: "Risk OFF", cond: "VIX>25 且上行", action: "Put/观望优先", tone: "red", icon: ShieldAlert, short: "偏防守", bias: { attack: 12, wait: 36, defend: 90 } },
];

const highWinModels = [
  { title: "扫流动性收回", badge: "黄金/EUR", tone: "amber", items: [{ label: "场景", text: "扫前高/前低后重新收回", tone: "amber" }, { label: "触发", text: "长影线 + CHoCH确认", tone: "teal" }, { label: "放弃", text: "只扫不收、新闻刚出", tone: "red" }] },
  { title: "POC/FVG共振", badge: "黄金", tone: "amber", items: [{ label: "场景", text: "成本区 + OB/FVG + 流动性位", tone: "amber" }, { label: "触发", text: "回踩拒绝 + 量能启动", tone: "teal" }, { label: "放弃", text: "共振区被直接穿透", tone: "red" }] },
  { title: "EMA趋势回踩", badge: "EUR", tone: "blue", items: [{ label: "场景", text: "EMA顺排 + ADX确认趋势", tone: "blue" }, { label: "触发", text: "回踩EMA21/结构位不破", tone: "teal" }, { label: "放弃", text: "均线缠绕、ADX弱", tone: "red" }] },
  { title: "VWAP确认期权", badge: "期权", tone: "teal", items: [{ label: "场景", text: "催化剂 + 大盘共振 + 合约流动性好", tone: "teal" }, { label: "触发", text: "VWAP收回/失败 + 量能确认", tone: "green" }, { label: "放弃", text: "反复穿VWAP、无量横盘、价差大", tone: "red" }] },
  { title: "ORB 开盘区间突破", badge: "期权", tone: "teal", items: [{ label: "场景", text: "开盘15分钟形成高低区间，大盘方向一致", tone: "teal" }, { label: "触发", text: "突破ORB高/低点 + 量能放大 + VWAP同侧", tone: "green" }, { label: "放弃", text: "回撤进入ORB区间内 / 大盘反向 / 无量突破", tone: "red" }] },
];

const checklist = [
  "交易系统已选定，规则没有混用。",
  "位置不在中间位，也不是机械到线开仓。",
  "方向完整：大盘、板块、品种结构不冲突。",
  "期权已检查：DTE、Delta、价差、成交量、IV风险。",
  "时间窗口已确认：9:45-11:30 或 13:30-15:00 ET（避开09:30-09:45/午盘/15:45后）。",
  "VWAP只作观察区，已出现失败/收回确认。",
  "量能和空间足够，不是低胜率磨损区。",
  "黄金/EUR已确认Kill Zone、结构、流动性、趋势强度。",
  "风险已写清：-25%硬止损、+50%保护、最大亏损。",
  "VIX方向支持或已降仓处理。",
  "没有触发连续亏损熔断：2笔连亏/日损5%/3日连亏。",
  "情绪正常：不是回本、证明自己、连续亏损后追单。",
  "正股今日无财报/重大数据：不在催化剂未知的前夜持有买方期权过夜。",
];

const questions = [
  { category: "期权", q: "价格到VWAP就买Put，对吗？", options: ["对，VWAP就是压力", "不对，VWAP是观察区", "只要跌过就买", "加仓更稳"], a: 1, exp: "VWAP不是开仓点。必须等反抽失败或收回确认。" },
  { category: "黄金", q: "黄金来到单一POC，可以直接开仓吗？", options: ["可以", "不可以，等POC集中区+结构确认", "满仓", "只看均线"], a: 1, exp: "单一POC不是按钮。要看集中区、共振和确认。" },
  { category: "EUR", q: "EUR均线缠绕、ADX低，还能做趋势回踩吗？", options: ["能", "不能，趋势强度不足", "只看MACD", "追突破"], a: 1, exp: "趋势系统必须先有趋势环境。" },
  { category: "期权", q: "IVR > 60 时，买方期权最怕什么？", options: ["买太便宜", "IV Crush和买贵", "成交太多", "Delta太高"], a: 1, exp: "IV高位时，方向对也可能被波动率回落杀掉利润。" },
  { category: "正股", q: "正股是否只靠K线入场？", options: ["是", "不是，先有基本面锚定", "只看PE", "只看消息"], a: 1, exp: "正股是低频配置系统，基本面锚定优先。" },
  { category: "风控", q: "日内期权亏损到-25%，正确动作是什么？", options: ["再等到-30%", "硬止损离场", "加仓摊平", "换合约继续赌"], a: 1, exp: "-20%是警戒，-25%是硬止损，不给情绪留空间。" },
  { category: "A+模型", q: "价格扫前低，长下影收回，回到FVG，下一根阳线确认。是否允许进场？", options: ["允许，属于A1模型", "不允许，因为扫了前低", "必须反手做空", "只看MACD决定"], a: 0, exp: "这是扫流动性 → 收回 → 确认的A1模型，但仍要小仓和结构止损。" },
  { category: "垃圾单", q: "价格位于POC中间，没有Sweep，没有FVG，没有确认K线，但你想做多。应该？", options: ["轻仓试一下", "禁止，属于垃圾单", "加仓降低成本", "等亏损后对冲"], a: 1, exp: "中间位 + 无触发 = 低质量交易。系统的价值在于过滤掉这种单子。" },
  { category: "纪律", q: "今天没有A+机会，最正确的动作是？", options: ["找B级机会", "降低标准做一笔", "不交易", "看1分钟图找机会"], a: 2, exp: "没有机会也是机会。弱水三千，只取一瓢。" },
  { category: "VIX", q: "VIX=15但正在快速上行，大盘冲高回落。期权买方应该？", options: ["无脑Call", "缩仓或等待，防止低位转弱", "满仓Put", "忽略VIX"], a: 1, exp: "VIX绝对值低不等于安全，低位上行反而要警惕风险切换。" },
  { category: "Kill Zone", q: "亚洲盘中间位，没有扫高低点，黄金出现一根小阳线。是否做多？", options: ["可以", "禁止，中间位低质量", "追多", "开双向对冲"], a: 1, exp: "时间、位置、触发都不完整。亚洲盘中间位默认不追。" },
  { category: "期权估算", q: "NVDA 预计上涨 $10，ATM Call Delta≈0.55，持有 1 张合约理论增值约多少？", options: ["约 $55", "约 $550", "约 $5,500", "无法估算"], a: 1, exp: "$10 × 0.55 × 100股 = 约 $550。实际还受 Theta、IV 和价差影响，0DTE 误差更大。" },
  { category: "纪律", q: "今日已连续亏损2笔，第三个机会出现且信号很好，应该？", options: ["立即出手，信号好就做", "暂停1小时，复盘后再决定", "加仓弥补亏损", "换品种继续"], a: 1, exp: "连续2笔亏损触发熔断规则，暂停1小时是系统规定，不因信号质量破例。" },
  { category: "期权", q: "你准备做1-2天的日内/短线期权，最合适的DTE是？", options: ["0DTE（当天到期）", "1-5 DTE", "30-45 DTE", "越长越好"], a: 1, exp: "1-5 DTE有足够时间缓冲，Theta不会瞬间归零，适合短线期权买方的主战区间。" },
  { category: "期权", q: "你看多NVDA，但QQQ当日跌破VWAP，XLK科技ETF也在走弱，应该？", options: ["正常买Call", "降级为小仓或放弃", "加仓NVDA Call对抗大盘", "改买QQQ Put对冲"], a: 1, exp: "板块和大盘冲突时，个股期权信号降级处理。大盘/板块是环境，不是辅助，要优先。" },
];
function OptionPriceCalculator() {
  const [mode, setMode] = useState("call");
  const [currentStock, setCurrentStock] = useState("520");
  const [targetStock, setTargetStock] = useState("522");
  const [stopLossStock, setStopLossStock] = useState("518");
  const [optionPrice, setOptionPrice] = useState("1.80");
  const [delta, setDelta] = useState("0.55");
  const [contracts, setContracts] = useState("1");

  const current = Number(currentStock);
  const target = Number(targetStock);
  const stopLoss = Number(stopLossStock);
  const option = Number(optionPrice);
  const deltaAbs = Math.abs(Number(delta));
  const contractCount = Math.max(1, Number(contracts) || 1);
  const isValid = [current, target, stopLoss, option, deltaAbs].every((n) => Number.isFinite(n)) && option >= 0 && deltaAbs >= 0;
  const stockMove = isValid ? (mode === "call" ? target - current : current - target) : 0;
  const stopLossMove = isValid ? (mode === "call" ? stopLoss - current : current - stopLoss) : 0;
  const projectedOption = isValid ? Math.max(0, option + stockMove * deltaAbs) : 0;
  const stopLossOption = isValid ? Math.max(0, option + stopLossMove * deltaAbs) : 0;
  const pnl = (projectedOption - option) * 100 * contractCount;
  const stopLossPnl = (stopLossOption - option) * 100 * contractCount;
  const pnlPct = option > 0 ? ((projectedOption - option) / option) * 100 : 0;
  const stopLossPct = option > 0 ? ((stopLossOption - option) / option) * 100 : 0;
  const inputClass =
    "terminal-input w-full rounded-2xl border border-white/15 bg-slate-950/90 px-4 py-3 text-base font-black text-slate-50 shadow-inner outline-none transition focus:border-teal-300/45 focus:ring-4 focus:ring-teal-400/20";

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-[2rem] border-2 border-teal-300/45 shadow-xl shadow-teal-950/20">
      <div className="bg-gradient-to-r from-teal-800 via-cyan-700 to-sky-700 px-5 py-4 text-white">
        <div className="text-xs font-black uppercase tracking-[0.2em] opacity-85">Quick Calculator</div>
        <h3 className="mt-1 text-xl font-black">正股目标 → 期权估算</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-teal-50">用 Delta 快速估算，适合止盈/止损参考。</p>
      </div>
      <div className="grid flex-1 gap-4 p-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">类型</span><select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}><option value="call">Call</option><option value="put">Put</option></select></label>
          <label className="space-y-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">当前正股</span><input className={inputClass} value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} inputMode="decimal" /></label>
          <label className="space-y-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">目标正股</span><input className={inputClass} value={targetStock} onChange={(e) => setTargetStock(e.target.value)} inputMode="decimal" /></label>
          <label className="space-y-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">止损正股价</span><input className={inputClass} value={stopLossStock} onChange={(e) => setStopLossStock(e.target.value)} inputMode="decimal" /></label>
          <label className="space-y-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">当前期权</span><input className={inputClass} value={optionPrice} onChange={(e) => setOptionPrice(e.target.value)} inputMode="decimal" /></label>
          <label className="space-y-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Delta</span><input className={inputClass} value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="decimal" /></label>
          <label className="space-y-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">张数</span><input className={inputClass} value={contracts} onChange={(e) => setContracts(e.target.value)} inputMode="numeric" /></label>
        </div>
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/15 bg-slate-900/58 p-4"><div className="text-xs font-black text-slate-500">目标估算期权价</div><div className="mt-1 text-3xl font-black text-teal-100">{isValid ? projectedOption.toFixed(2) : "--"}</div>{!isValid && <div className="mt-1 text-xs font-black text-amber-400">请检查输入值是否为有效数字</div>}{projectedOption === 0 && isValid && <div className="mt-2 text-xs font-black text-red-400">⚠️ 期权可能归零，触发止损规则</div>}</div>
          <div className={cn("rounded-2xl border p-4", pnl >= 0 ? "border-teal-300 bg-teal-500/10" : "border-red-300/35 bg-red-950/45")}><div className="text-xs font-black text-slate-500">目标估算盈亏</div><div className={cn("mt-1 text-2xl font-black", pnl >= 0 ? "text-teal-100" : "text-red-100")}>{isValid ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(0)} 美元` : "--"}</div><div className="text-sm font-bold text-slate-400">{isValid ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%` : "--"}</div></div>
          <div className={cn("rounded-2xl border p-4", stopLossPnl >= 0 ? "border-amber-300/50 bg-amber-500/10" : "border-red-300/35 bg-red-950/45")}><div className="text-xs font-black text-slate-500">止损估算</div><div className={cn("mt-1 text-2xl font-black", stopLossPnl >= 0 ? "text-amber-100" : "text-red-100")}>{isValid ? `${stopLossPnl >= 0 ? "+" : ""}${stopLossPnl.toFixed(0)} 美元` : "--"}</div><div className="text-sm font-bold text-slate-400">{isValid ? `止损价约 ${stopLossOption.toFixed(2)} ｜ ${stopLossPct >= 0 ? "+" : ""}${stopLossPct.toFixed(1)}%` : "--"}</div>{stopLossOption === 0 && isValid && <div className="mt-2 text-xs font-black text-red-400">⚠️ 止损估算已接近归零，不适合继续扛单</div>}</div>
          <div className="rounded-2xl border border-amber-300 bg-amber-500/10 p-3 text-sm font-bold leading-6 text-amber-100">不包含 IV、Theta、Gamma 和价差。0DTE 误差更大。</div>
        </div>
      </div>
    </Card>
  );
}

function TradingMatrix() {
  const iconMap = { "黄金 / EUR": BarChart3, "期权买方": Gauge, 正股: LineChart, 加密: Activity };
  return (
    <section className="mb-8 rounded-[2.2rem] border border-white/15 bg-slate-950/70 p-5 shadow-[0_28px_85px_rgba(0,0,0,0.42)] ring-1 ring-white/10 md:p-7">
      <SectionHeader number="01" title="多品种交易矩阵" desc="用一屏先看清主次关系：做什么、为什么做、什么情况不做。" tone="teal" />
      <div className="grid gap-4 lg:grid-cols-4">
        {matrix.map((item) => {
          const Icon = iconMap[item.name];
          return (
            <Card key={item.name} className="rounded-[1.7rem] border-white/15 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
              <div className="mb-4 flex items-center justify-between">
                <Badge tone={item.tone}>{item.role}</Badge>
                <div className="rounded-2xl bg-slate-800/70 p-3"><Icon className="h-5 w-5 text-slate-400" /></div>
              </div>
              <h3 className="text-xl font-black text-slate-50">{item.name}</h3>
              <div className="mt-4 grid gap-3">
                <VisualMeter label="核心" left="结构" right="执行" fill={80} tone={item.tone} note={item.core} />
                <RuleCard label="只做" text={item.do} tone="teal" />
                <RuleCard label="禁区" text={item.ban} tone="red" icon={Ban} />
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function GoldEurSystem() {
  return (
    <section className="mb-8 rounded-[2.2rem] border border-white/15 bg-slate-950/70 p-5 shadow-[0_28px_85px_rgba(0,0,0,0.42)] ring-1 ring-white/10 md:p-7">
      <SectionHeader number="02" title="黄金 / EUR 执行系统" desc="把 SMC 和趋势跟踪压缩成一条操作链：先定向，再找位，最后等确认。" tone="amber" />
      <ProcessRail
        tone="amber"
        steps={[
          { title: "日线定向", text: "看趋势、关键 OB、主结构；先有方向，再有交易。" },
          { title: "4H / 1H 找位", text: "找 BSL/SSL、FVG、POC 集中区和结构重叠区。" },
          { title: "15M / 5M 确认", text: "等收回、拒绝、CHoCH/BOS，不在测试区提前动手。" },
          { title: "只拿中间段", text: "止损放结构外；信号不完整，不做。" },
        ]}
      />
      <div className="mt-5 mb-5">
        <KillZoneBoard />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">{goldModels.map((m) => <FlowCard key={m.title} {...m} />)}</div>
      <div className="mt-4">
        <DecisionSignalBoard
          title="黄金 / EUR 执行图"
          tone="amber"
          items={[
            { kicker: "先看", title: "环境", text: "Kill Zone + 主结构 + 关键流动性位。", tone: "amber" },
            { kicker: "再等", title: "确认", text: "收回 / 拒绝 / CHoCH，不在测试区抢跑。", tone: "teal" },
            { kicker: "不做", title: "禁区", text: "亚洲盘中间位、新闻前后、只到位不确认。", tone: "red" },
          ]}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{eurModels.map((m) => <FlowCard key={m.title} {...m} />)}</div>
    </section>
  );
}

function OptionSystem() {
  return (
    <section className="mb-8 rounded-[2.2rem] border border-white/15 bg-slate-950/70 p-5 shadow-[0_28px_85px_rgba(0,0,0,0.42)] ring-1 ring-white/10 md:p-7">
      <SectionHeader number="03" title="期权买方系统" desc="用图形替代大段说明：先看三维判断，再看时间、合约和开仓确认。" tone="blue" />
      <VisualDecision
        title="三维判断"
        tone="teal"
        items={[
          { label: "方向", text: "正股结构 + 大盘 + 板块 + 催化剂同向" },
          { label: "时间", text: "日内快进快出；波段看 14-45 DTE" },
          { label: "波动率", text: "波段优先 IVR < 40；IVR > 60 降仓或放弃" },
        ]}
      />
      <div className="mt-5">
        <OptionSignalLightBoard />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="rounded-[1.8rem] border-white/15 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-50">VWAP 状态机</h3>
            <Zap className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-slate-900/58 p-4">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500">Step 1</div>
              <div className="mt-2 text-sm font-black text-slate-50">接近 VWAP</div>
              <div className="mt-2 text-sm font-bold leading-6 text-slate-400">只观察，不抢跑，不直接开仓。</div>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-teal-300/25 bg-teal-500/10 p-4">
              <div className="text-xs font-black uppercase tracking-wider text-teal-700">Step 2</div>
              <div className="mt-2 text-sm font-black text-slate-50">等待确认</div>
              <div className="mt-2 text-sm font-bold leading-6 text-slate-400">Call 看收回，Put 看失败；再看 9EMA 与量能。</div>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-red-300/35 bg-red-950/45 p-4">
              <div className="text-xs font-black uppercase tracking-wider text-red-700">Step 3</div>
              <div className="mt-2 text-sm font-black text-slate-50">执行 / 放弃</div>
              <div className="mt-2 text-sm font-bold leading-6 text-slate-400">确认成立再进；反复穿越、无量横盘直接放弃。</div>
            </motion.div>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">{optionModels.map((m) => <FlowCard key={m.title} {...m} />)}</div>
        </Card>
        <div className="grid gap-4">
          <HeatWindow
            title="日内时间热力条"
            rows={[
              { label: "09:30-09:45", status: "禁做", fill: 20, className: "bg-red-500/100", note: "开盘乱流，方向未定。" },
              { label: "09:45-11:30", status: "优先", fill: 88, className: "bg-emerald-600", note: "趋势确立阶段，优先窗口。" },
              { label: "11:30-13:30", status: "低质", fill: 35, className: "bg-amber-500/100", note: "午盘低流动性，假信号多。" },
              { label: "13:30-15:00", status: "优先", fill: 82, className: "bg-emerald-600", note: "午后方向重启。" },
              { label: "15:45-16:00", status: "禁做", fill: 18, className: "bg-red-500/100", note: "尾盘对冲，波动异常。" },
            ]}
          />
          <Card className="rounded-[1.7rem] border-white/15 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-50">合约与风控仪表</h3>
              <Gauge className="h-5 w-5 text-slate-500" />
            </div>
            <div className="mt-4 grid gap-3">
              <VisualMeter label="DTE" left="0DTE" right="45DTE" fill={18} tone="blue" note="日内优先 1-5DTE；0DTE只做高波动快进快出" />
              <VisualMeter label="Delta" left="激进 0.35" right="深 ITM 0.65" fill={55} tone="teal" note="日内优先 0.45-0.55" />
              <VisualMeter label="价差" left="0.01" right="0.20+" fill={30} tone="amber" note="越窄越好" />
              <VisualMeter label="止损线" left="-20% 警戒" right="-25% 离场" fill={100} tone="red" note="不保留 -30% 档位" />
              <VisualMeter label="止盈线" left="+50% 保护" right="+80%-100% 全平" fill={80} tone="green" note="盈利要锁住" />
            </div>
          </Card>
        </div>
      </div>
      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="flex h-full flex-col rounded-[1.8rem] border-red-300/35 bg-red-950/45 p-5 shadow-[0_20px_55px_rgba(239,68,68,0.16)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-black text-red-100">期权买方四大杀手</h3>
            <AlertTriangle className="h-5 w-5 text-red-700" />
          </div>
          <div className="mt-4 grid flex-1 gap-4 sm:grid-cols-2">
            {[
              ["Theta", "入场太早", "被时间磨死"],
              ["IV", "IV过高", "方向对也不赚钱"],
              ["VWAP", "误把观察区", "当成开仓点"],
              ["止损", "小亏不走", "最后变成大亏"],
            ].map(([tag, a, b]) => (
              <motion.div
                key={tag}
                whileHover={{ y: -6, scale: 1.015 }}
                className="group rounded-[1.5rem] border border-red-300/35 bg-slate-950/74 p-5 transition-all duration-300 hover:border-red-300/35 hover:shadow-[0_24px_60px_rgba(127,29,29,0.18)]"
              >
                <div className="mb-3 flex items-center justify-between gap-3 text-red-100">
                  <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" /><span className="text-sm font-black uppercase tracking-[0.16em]">{tag}</span></div>
                  <div className="h-2 w-14 rounded-full bg-red-100"><div className="h-2 w-8 rounded-full bg-red-700 transition-all duration-300 group-hover:w-14" /></div>
                </div>
                <div className="text-2xl font-black leading-10 text-red-100">{a}</div>
                <div className="mt-1 text-lg font-black leading-8 text-red-100/90">{b}</div>
              </motion.div>
            ))}
          </div>
        </Card>
        <OptionPriceCalculator />
      </div>
    </section>
  );
}

function ExpansionSystem() {
  return (
    <section className="mb-8 rounded-[2.2rem] border border-white/15 bg-slate-950/70 p-5 shadow-[0_28px_85px_rgba(0,0,0,0.42)] ring-1 ring-white/10 md:p-7">
      <SectionHeader number="04" title="正股配置系统" desc="保留必要内容，但图形化展示，避免和日内模块抢注意力。" tone="violet" />
      <div className="grid gap-4 lg:grid-cols-2">
        {stockModels.map((m) => <FlowCard key={m.title} {...m} />)}
        <Card className="rounded-[1.7rem] border-violet-300/35 bg-violet-500/10 p-5 shadow-[0_20px_55px_rgba(139,92,246,0.14)]">
          <Badge tone="violet">加密暂缓</Badge>
          <h3 className="mt-3 text-lg font-black text-slate-50">加密合约 / 期权</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-violet-300/35 bg-slate-950/74 p-4"><div className="text-xs font-black text-violet-700">看</div><div className="mt-2 text-sm font-black text-slate-50">OI / Funding / 清算</div></div>
            <div className="rounded-2xl border border-teal-300/25 bg-slate-950/74 p-4"><div className="text-xs font-black text-teal-700">等</div><div className="mt-2 text-sm font-black text-slate-50">15-45 分钟，5M/15M 确认</div></div>
            <div className="rounded-2xl border border-red-300/35 bg-slate-950/74 p-4"><div className="text-xs font-black text-red-700">禁</div><div className="mt-2 text-sm font-black text-slate-50">1M 追反转 / 高杠杆</div></div>
          </div>
        </Card>
      </div>
      <div className="mt-4">
        <DecisionSignalBoard
          title="正股 / 加密 低频动作面板"
          tone="violet"
          items={[
            { kicker: "正股", title: "先筛后做", text: "先有公司质量，再等周线趋势和日线位置。", tone: "blue" },
            { kicker: "加密", title: "先清算后确认", text: "先看极端，再等 5M / 15M K线确认。", tone: "violet" },
            { kicker: "共通", title: "统一风控", text: "没有结构优势，不因热度和情绪出手。", tone: "red" },
          ]}
        />
      </div>
    </section>
  );
}

function MacroAndModels() {
  return (
    <section className="mb-8 rounded-[2.2rem] border border-white/15 bg-slate-950/74 p-5 shadow-[0_28px_85px_rgba(0,0,0,0.42)] ring-1 ring-white/10 md:p-7">
      <SectionHeader number="05" title="宏观过滤 + 高胜率模型库" desc="把宏观过滤、模型卡和执行逻辑进一步做成终端化界面：更少文字，更强层次，更快扫视。" tone="slate" />
      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="rounded-[1.8rem] border-white/15 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-50">VIX 风险地图</h3>
              <p className="mt-1 text-sm font-bold text-slate-400">用象限 + 偏向条 + 决策流，减少阅读压力。</p>
            </div>
            <Gauge className="h-5 w-5 text-slate-500" />
          </div>
          <MacroRadarBoard />
        </Card>
        <Card className="rounded-[1.8rem] border-teal-300/45 bg-slate-950/74 p-5 shadow-[0_26px_80px_rgba(20,184,166,0.16)]">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-50">高胜率模型库</h3>
              <p className="mt-1 text-sm font-bold text-slate-400">每张卡只回答：场景、触发、放弃。</p>
            </div>
            <div className="rounded-2xl border border-red-300/35 bg-red-950/45 px-4 py-2 text-sm font-black text-red-100">没有触发 = 不交易</div>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/58 p-3"><div className="text-xs font-black text-slate-500">读卡顺序</div><div className="mt-2 text-sm font-black text-slate-50">先看场景，再看触发，最后看放弃。</div></div>
            <div className="rounded-2xl border border-teal-300/25 bg-teal-500/10 p-3"><div className="text-xs font-black text-teal-700">触发标准</div><div className="mt-2 text-sm font-black text-slate-50">出现确认才做，不做预判单。</div></div>
            <div className="rounded-2xl border border-red-300/35 bg-red-950/45 p-3"><div className="text-xs font-black text-red-700">执行底线</div><div className="mt-2 text-sm font-black text-slate-50">没有空间 / 无量 / 新闻刚出，一律放弃。</div></div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">{highWinModels.map((m) => <FlowCard key={m.title} {...m} />)}</div>
        </Card>
      </div>
    </section>
  );
}

function TrafficLightChecklist() {
  const [checked, setChecked] = useState([]);
  const all = checked.length === checklist.length;
  const toggle = (i) => setChecked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  return (
    <Card className={cn("rounded-[2rem] border-2 p-5 shadow-xl", all ? "border-teal-300/45 bg-teal-500/10" : "border-red-300/35 bg-red-950/45")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-50">开单前红绿灯</h3>
          <p className="mt-1 text-sm font-bold text-slate-400">全部点亮才允许进入下一步。</p>
        </div>
        <div className="flex items-center gap-2"><div className={cn("rounded-2xl px-4 py-3 text-lg font-black", all ? "bg-teal-700 text-white" : "bg-red-700 text-white")}>{checked.length} / {checklist.length}</div><Button variant="ghost" onClick={() => setChecked([])} className="text-xs"><RefreshCcw className="mr-1 h-3 w-3" />重置</Button></div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800/70"><motion.div className={cn("h-full rounded-full", all ? "bg-teal-600" : "bg-red-600")} animate={{ width: `${(checked.length / checklist.length) * 100}%` }} transition={{ duration: 0.4 }} /></div><div className="mt-1 text-right text-xs font-bold text-slate-500">{Math.round((checked.length / checklist.length) * 100)}% 完成</div><div className="mt-3 flex flex-wrap gap-1.5">{checklist.map((_, i) => <span key={i} className={cn("h-2.5 w-2.5 rounded-full border", checked.includes(i) ? "border-teal-300/45 bg-teal-600" : "border-slate-700 bg-slate-900")} />)}</div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">{checklist.map((item, i) => {
        const ok = checked.includes(i);
        return <button key={item} onClick={() => toggle(i)} className={cn("flex gap-3 rounded-2xl border-2 p-4 text-left text-sm font-black leading-6 transition", ok ? "border-teal-300/45 bg-slate-950/74 text-teal-100 shadow-lg shadow-teal-950/20" : "border-red-300/35 bg-slate-950/74 text-slate-200 shadow-sm hover:border-red-500")}><span className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white", ok ? "bg-teal-700" : "bg-red-600")}>{ok ? "绿" : "红"}</span><span>{item}</span></button>;
      })}</div>
      <div className={cn("mt-5 rounded-2xl border p-4 text-center text-lg font-black", all ? "border-teal-300/45 bg-slate-950/74 text-teal-100" : "border-red-300/35 bg-slate-950/74 text-red-100")}>{all ? "绿灯全亮：可以进入执行，但仍然小仓试错。" : "红灯未清：禁止开单。"}</div>
    </Card>
  );
}

function TrainingQuiz() {
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState(null);
  const q = questions[idx];
  function next() {
    setAnswer(null);
    setIdx((prevIdx) => {
      if (questions.length <= 1) return prevIdx;
      let newIdx;
      do {
        newIdx = Math.floor(Math.random() * questions.length);
      } while (newIdx === prevIdx);
      return newIdx;
    });
  }
  return (
    <Card className="rounded-[2rem] border-white/15 p-5 shadow-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="text-xl font-black text-slate-50">每日交易判断题</h3><p className="mt-1 text-sm font-bold text-slate-400">训练“能不能做”，不是预测涨跌。</p></div><div className="flex items-center gap-2"><Badge tone="violet">{idx + 1}/{questions.length}</Badge><Button onClick={next} variant="ghost"><RefreshCcw className="mr-2 h-4 w-4" />换一题</Button></div></div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/58 p-5"><div className="mb-3"><Badge tone="blue">{q.category}</Badge></div><h4 className="text-lg font-black leading-8 text-slate-50">{q.q}</h4><div className="mt-4 grid gap-3 md:grid-cols-2">{q.options.map((op, i) => {
        const chosen = answer === i;
        const correct = answer !== null && i === q.a;
        const wrong = chosen && i !== q.a;
        return <button key={op} onClick={() => setAnswer(i)} className={cn("rounded-2xl border-2 p-4 text-left text-sm font-black transition", correct ? "border-teal-300/45 bg-teal-500/10 text-teal-100" : wrong ? "border-red-700 bg-red-500/10 text-red-100" : "border-white/15 bg-slate-950/74 text-slate-300 hover:border-teal-500")}>{op}</button>;
      })}</div>{answer !== null && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-amber-300 bg-amber-500/10 p-4 text-sm font-black leading-7 text-amber-100">{answer === q.a ? "判断正确：" : "判断错误："}{q.exp}</motion.div>}</div>
    </Card>
  );
}

function DisciplineSystem() {
  return (
    <section className="mb-8 rounded-[2.2rem] border border-white/15 bg-slate-950/70 p-5 shadow-[0_28px_85px_rgba(0,0,0,0.42)] ring-1 ring-white/10 md:p-7">
      <SectionHeader number="06" title="执行纪律与训练闸门" desc="把复杂判断前置成图形化自检：红绿灯、熔断和训练题。" tone="red" />
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]"><TrafficLightChecklist /><TrainingQuiz /></div>
      <Card className="mt-5 rounded-[1.8rem] border-red-300/35 bg-red-950/45 p-5 shadow-lg shadow-red-950/20">
        <h3 className="text-xl font-black text-red-100">账户生存法则</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <RuleCard label="次数" text="每日最多3笔" tone="red" />
          <RuleCard label="连亏" text="当日连续亏损2笔，暂停1小时" tone="red" />
          <RuleCard label="日损" text="当日亏损>账户5%，停止交易" tone="red" />
          <RuleCard label="周期" text="连续3日亏损，回模拟盘1周" tone="red" />
        </div>
      </Card>
    </section>
  );
}

export default function TradingModelTrainingSystem() {
  const stats = useMemo(
    () => [
      { label: "交易矩阵", value: "4类", icon: Layers, tone: "bg-teal-700" },
      { label: "执行模型", value: "9组", icon: Activity, tone: "bg-sky-700" },
      { label: "红绿灯", value: `${checklist.length}项`, icon: ShieldAlert, tone: "bg-red-700" },
      { label: "训练题", value: `${questions.length}题`, icon: Brain, tone: "bg-violet-700" },
    ],
    []
  );

  return (
    <div className="min-h-screen premium-terminal-bg text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <motion.header initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-8 overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))] shadow-[0_40px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
          <div className="section-accent-bar h-3 bg-gradient-to-r from-teal-700 via-sky-600 to-violet-700" />
          <div className="p-6 md:p-8">
            <div className="mb-4 flex flex-wrap gap-2"><Badge tone="teal">交易模型训练系统 v4.1</Badge><Badge tone="red">Premium Professional Terminal</Badge><Badge tone="blue">图形可视化</Badge></div>
            <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-50 md:text-6xl">黄金期权交易训练终端</h1>
                <p className="mt-4 max-w-4xl text-base font-semibold leading-8 text-slate-300">
                  把交易决策压缩成四个动作：<KeyWord>看什么</KeyWord> <KeyWord tone="blue">等什么</KeyWord> <KeyWord tone="green">做什么</KeyWord> <KeyWord tone="red">不做什么</KeyWord>。
                </p>
              </div>
              <div className="rounded-[1.5rem] border-2 border-red-300/35 bg-red-950/45 p-4 shadow-lg">
                <div className="flex items-center gap-2 text-red-100"><AlertTriangle className="h-5 w-5" /><span className="font-black">总原则</span></div>
                <p className="mt-2 text-sm font-bold leading-7 text-red-100">信号不完整，不交易。规则不清晰，不交易。情绪不稳定，不交易。</p>
              </div>
            </div>
          </div>
        </motion.header>

        <div className="mb-8 grid gap-4 md:grid-cols-4 xl:gap-5">{stats.map((s) => { const Icon = s.icon; return <Card key={s.label} className="relative overflow-hidden rounded-[1.6rem] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.62))] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.40)]"><div className="flex items-start justify-between"><div><div className="text-2xl font-black text-slate-50">{s.value}</div><div className="mt-1 text-sm font-black text-slate-400">{s.label}</div></div><div className={cn("rounded-2xl p-3 text-white", s.tone)}><Icon className="h-5 w-5" /></div></div><div className={cn("absolute bottom-0 left-0 h-2 w-full", s.tone)} /></Card>; })}</div>

        <TradingMatrix />
        <GoldEurSystem />
        <OptionSystem />
        <ExpansionSystem />
        <MacroAndModels />
        <DisciplineSystem />
      </div>
    </div>
  );
}
