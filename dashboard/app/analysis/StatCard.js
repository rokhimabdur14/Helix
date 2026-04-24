"use client";

const ACCENT = {
  default: "from-blue-500/10 to-violet-500/5 border-slate-800 text-slate-100",
  emerald:
    "from-emerald-500/10 to-emerald-700/5 border-emerald-500/20 text-emerald-100",
  violet:
    "from-violet-500/15 to-blue-500/5 border-violet-500/20 text-violet-100",
};

export function StatCard({ label, value, hint, accent = "default", index = 0 }) {
  const acc = ACCENT[accent] || ACCENT.default;
  return (
    <div
      style={{ "--stagger-i": index }}
      className={`stagger-in lift-on-hover rounded-xl border bg-gradient-to-br p-4 ${acc}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold md:text-3xl">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[10px] text-slate-500">{hint}</div>
      )}
    </div>
  );
}
