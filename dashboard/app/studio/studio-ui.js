"use client";

import { useState } from "react";

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {hint && <span className="text-xs text-slate-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3, disabled }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="input-glow w-full resize-none rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none disabled:opacity-50"
    />
  );
}

export function SegmentedControl({ value, onChange, options, disabled }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/40 p-1">
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "bg-gradient-to-r from-blue-600/40 to-violet-600/40 text-violet-100 shadow-inner shadow-violet-900/30"
                : "text-slate-400 hover:text-violet-300"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function NumberStepper({ value, onChange, min, max, disabled }) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-1">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 disabled:opacity-30"
      >
        −
      </button>
      <span className="flex-1 text-center text-sm font-semibold text-violet-200">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

export function GenerateButton({ onClick, loading, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? (
        <span className="inline-flex items-end gap-1 h-4">
          <span className="dna-dot inline-block h-4 w-1 rounded-full bg-white/80"></span>
          <span className="dna-dot inline-block h-4 w-1 rounded-full bg-white/80"></span>
          <span className="dna-dot inline-block h-4 w-1 rounded-full bg-white/80"></span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
      Error: {message}
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 transition hover:border-violet-500/50 hover:text-violet-300"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export function ResultPanel({ title, children, onCopyAll }) {
  return (
    <div className="reveal-in mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-violet-300">
          {title}
        </h3>
        {onCopyAll}
      </div>
      {children}
    </div>
  );
}
