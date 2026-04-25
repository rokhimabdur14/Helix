"use client";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HourHeatmap({ data }) {
  // data: {"09:00": 14.18, ...}
  const valueByHour = {};
  Object.entries(data).forEach(([k, v]) => {
    const h = parseInt(k.slice(0, 2), 10);
    valueByHour[h] = v;
  });

  const values = Object.values(data);
  const maxER = values.length > 0 ? Math.max(...values) : 1;
  const peakHour = Object.entries(valueByHour).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}
      >
        {HOURS.map((h, i) => {
          const er = valueByHour[h];
          const has = er !== undefined;
          const intensity = has ? er / maxER : 0;
          const bgColor = has
            ? `rgba(124, 58, 237, ${0.15 + intensity * 0.7})`
            : "rgba(30, 41, 59, 0.4)";
          const isPeak = peakHour && parseInt(peakHour[0], 10) === h;

          return (
            <div
              key={h}
              style={{
                backgroundColor: bgColor,
                "--stagger-i": i,
              }}
              title={
                has
                  ? `${String(h).padStart(2, "0")}:00 — ER ${er.toFixed(1)}%`
                  : `${String(h).padStart(2, "0")}:00 — no data`
              }
              className={`stagger-in flex aspect-square items-center justify-center rounded-md text-[9px] font-medium transition hover:scale-110 ${
                isPeak
                  ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900 text-white font-bold"
                  : has
                  ? "text-violet-100"
                  : "text-slate-700"
              }`}
            >
              {h}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
        <span>00:00</span>
        <span className="text-violet-300">
          {peakHour
            ? `🔥 Peak: ${peakHour[0]}:00 (${peakHour[1].toFixed(1)}% ER)`
            : "—"}
        </span>
        <span>23:00</span>
      </div>
    </div>
  );
}
