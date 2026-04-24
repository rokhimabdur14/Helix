"use client";

const TYPE_META = {
  reel: { color: "border-pink-500/40 bg-pink-500/10 text-pink-200", icon: "▶" },
  carousel: { color: "border-blue-500/40 bg-blue-500/10 text-blue-200", icon: "❯❯" },
  image: { color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", icon: "▣" },
  story: { color: "border-amber-500/40 bg-amber-500/10 text-amber-200", icon: "○" },
  feed: { color: "border-violet-500/40 bg-violet-500/10 text-violet-200", icon: "⬜" },
};

export function TypeBreakdown({ data }) {
  const entries = Object.entries(data).sort(
    (a, b) => (b[1].avg_engagement_rate || 0) - (a[1].avg_engagement_rate || 0)
  );
  const maxER = Math.max(...entries.map(([_, v]) => v.avg_engagement_rate || 0));

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {entries.map(([type, stats], i) => {
        const meta = TYPE_META[type.toLowerCase()] || TYPE_META.feed;
        const erWidth = maxER > 0 ? (stats.avg_engagement_rate / maxER) * 100 : 0;
        return (
          <div
            key={type}
            style={{ "--stagger-i": i }}
            className={`stagger-in lift-on-hover rounded-xl border p-4 ${meta.color}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-sm font-semibold uppercase">
                {meta.icon} {type}
              </span>
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold">
                {stats.count} post{stats.count > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <Stat label="Avg ER" value={`${stats.avg_engagement_rate}%`} />
              <Stat label="Avg Reach" value={fmtNum(stats.avg_reach)} />
              <Stat label="+Follows" value={`+${stats.total_follows}`} />
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-current opacity-60 transition-all duration-700"
                style={{ width: `${erWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
