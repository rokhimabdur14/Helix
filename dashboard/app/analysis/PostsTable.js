"use client";

import { useMemo, useState } from "react";

const TYPE_COLOR = {
  reel: "text-pink-300",
  carousel: "text-blue-300",
  image: "text-emerald-300",
  story: "text-amber-300",
  feed: "text-violet-300",
};

const COLUMNS = [
  { id: "date", label: "Date", sortable: true },
  { id: "type", label: "Type", sortable: true },
  { id: "content_pillar", label: "Pillar", sortable: true },
  { id: "reach", label: "Reach", sortable: true, num: true },
  { id: "engagement_rate", label: "ER %", sortable: true, num: true },
  { id: "follows", label: "+Follows", sortable: true, num: true },
  { id: "caption", label: "Caption", sortable: false },
];

export function PostsTable({ posts }) {
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    const arr = [...posts];
    arr.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [posts, sortBy, sortDir]);

  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir(col === "date" || col === "type" || col === "content_pillar" ? "asc" : "desc");
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/60">
          <tr>
            {COLUMNS.map((c) => {
              const active = sortBy === c.id;
              return (
                <th
                  key={c.id}
                  className={`px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400 ${
                    c.num ? "text-right" : ""
                  } ${c.sortable ? "cursor-pointer hover:text-violet-300" : ""}`}
                  onClick={c.sortable ? () => toggleSort(c.id) : undefined}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${
                      c.num ? "justify-end" : ""
                    }`}
                  >
                    {c.label}
                    {active && (
                      <span className="text-violet-400">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr
              key={p.post_id || i}
              className="border-t border-slate-800/60 hover:bg-violet-500/5"
            >
              <td className="px-3 py-2 text-slate-400">{p.date}</td>
              <td
                className={`px-3 py-2 font-semibold uppercase ${
                  TYPE_COLOR[p.type?.toLowerCase()] || "text-slate-400"
                }`}
              >
                {p.type}
              </td>
              <td className="max-w-[160px] truncate px-3 py-2 text-slate-300">
                {p.content_pillar}
              </td>
              <td className="px-3 py-2 text-right text-slate-300">
                {p.reach?.toLocaleString() || "—"}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-violet-200">
                {p.engagement_rate}%
              </td>
              <td className="px-3 py-2 text-right text-emerald-300">
                +{p.follows || 0}
              </td>
              <td className="max-w-[260px] truncate px-3 py-2 text-slate-500">
                {p.caption}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
