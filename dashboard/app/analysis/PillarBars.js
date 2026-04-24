"use client";

export function PillarBars({ data }) {
  const entries = Object.entries(data).sort(
    (a, b) => (b[1].avg_engagement_rate || 0) - (a[1].avg_engagement_rate || 0)
  );
  const maxER = Math.max(...entries.map(([_, v]) => v.avg_engagement_rate || 0));

  return (
    <div className="space-y-2">
      {entries.map(([pillar, stats], i) => {
        const erPct = maxER > 0 ? (stats.avg_engagement_rate / maxER) * 100 : 0;
        return (
          <div
            key={pillar}
            style={{ "--stagger-i": i }}
            className="stagger-in group rounded-lg border border-slate-800 bg-slate-950/40 p-3 transition hover:border-violet-500/40"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-slate-200">
                {pillar}
              </span>
              <span className="flex-shrink-0 text-xs text-slate-500">
                {stats.count} post · +{stats.total_follows}f
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-violet-400 transition-all duration-700"
                  style={{ width: `${erPct}%` }}
                />
              </div>
              <span className="w-16 text-right text-xs font-semibold text-violet-200">
                {stats.avg_engagement_rate}% ER
              </span>
              <span className="w-16 text-right text-xs text-slate-500">
                {fmtNum(stats.avg_reach)} reach
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
