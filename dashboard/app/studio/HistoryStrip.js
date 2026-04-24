"use client";

import { timeAgo } from "./use-studio-history";

export function HistoryStrip({ entries, onRestore, onRemove, onClear, renderPreview }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            className="text-slate-500"
          >
            <path
              d="M12 8v4l2.5 2.5M12 3a9 9 0 11-9 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M3 3v5h5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Recent ({entries.length})
          </span>
        </div>
        <button
          onClick={() => {
            if (window.confirm("Hapus semua history untuk tool ini?")) {
              onClear();
            }
          }}
          className="text-[10px] text-slate-600 transition hover:text-red-400"
        >
          Clear all
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onRestore(entry)}
            className="group relative flex max-w-[220px] flex-shrink-0 flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2 pr-7 text-left transition hover:border-violet-500/50 hover:bg-slate-800/60"
          >
            <span className="truncate text-xs text-slate-200">
              {renderPreview(entry)}
            </span>
            <span className="text-[10px] text-slate-500">
              {timeAgo(entry.ts)}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(entry.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove(entry.id);
                }
              }}
              className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded text-slate-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
              aria-label="Remove"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 2l6 6M8 2l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
