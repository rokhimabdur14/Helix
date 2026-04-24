"use client";

import { useEffect, useRef, useState } from "react";

export function BrandSwitcher({
  brands,
  activeBrandId,
  onSelect,
  onAdd,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const active = brands.find((b) => b.brand_id === activeBrandId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 backdrop-blur transition hover:border-violet-500/60 hover:bg-slate-800/60"
      >
        <span className="text-xs text-slate-500">Brand:</span>
        <span className="font-medium text-violet-300">
          {active?.brand_name || "—"}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="dropdown-in absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-violet-900/20 backdrop-blur-xl">
          <div className="border-b border-slate-800 px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Your Brands
          </div>
          <div className="max-h-60 overflow-y-auto">
            {brands.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                Belum ada brand.
              </div>
            )}
            {brands.map((b) => {
              const isActive = b.brand_id === activeBrandId;
              const isDemo = b.brand_id === "fotofusi";
              return (
                <div
                  key={b.brand_id}
                  className={`group flex items-center gap-2 px-3 py-2.5 transition ${
                    isActive ? "bg-violet-500/10" : "hover:bg-slate-800/60"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelect(b.brand_id);
                      setOpen(false);
                    }}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${
                        isActive ? "bg-violet-400" : "bg-slate-700"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-200">
                        {b.brand_name}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {b.brand_id}
                        {isDemo && (
                          <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                            demo
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {!isDemo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `Hapus brand "${b.brand_name}"? Semua data (config, scraped website, insights) akan hilang.`
                          )
                        ) {
                          onDelete(b.brand_id);
                          setOpen(false);
                        }
                      }}
                      title="Hapus brand"
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 4h10m-1 0v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4m2 0V3a1 1 0 011-1h2a1 1 0 011 1v1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              onAdd();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-slate-800 bg-slate-900/40 px-3 py-3 text-sm text-violet-300 transition hover:bg-violet-500/10"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Tambah brand baru
          </button>
        </div>
      )}
    </div>
  );
}
