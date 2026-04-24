"use client";

import { useEffect, useState } from "react";

export function AddBrandModal({ open, onClose, onCreate }) {
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setBrandId("");
      setBrandName("");
      setWebsiteUrl("");
      setTagline("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  // Auto-derive brand_id from brand_name
  function handleNameChange(value) {
    setBrandName(value);
    // Only auto-fill if user hasn't manually typed brand_id
    if (!brandId || brandId === autoSlug(brandName)) {
      setBrandId(autoSlug(value));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);
    try {
      const payload = {
        brand_id: brandId.trim(),
        brand_name: brandName.trim(),
        website_url: websiteUrl.trim(),
      };
      if (tagline.trim()) payload.tagline = tagline.trim();

      await onCreate(payload);
      onClose();
    } catch (e) {
      setError(e.message || "Gagal membuat brand");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="modal-backdrop-in absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />
      <div className="modal-content-in relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-violet-900/30">
        <div className="border-b border-slate-800 bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-violet-500/5 px-6 py-4">
          <h2 className="font-display text-base font-bold uppercase tracking-wider text-slate-100">
            Tambah Brand Baru
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            HELIX akan scrape website & bangun knowledge base brand kamu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <Field
            label="Brand Name"
            value={brandName}
            onChange={handleNameChange}
            placeholder="Contoh: Kopi Kenangan"
            required
            disabled={submitting}
          />

          <Field
            label="Brand ID (slug)"
            value={brandId}
            onChange={setBrandId}
            placeholder="kopi-kenangan"
            required
            disabled={submitting}
            hint="Lowercase, angka, dash. Dipakai untuk URL & file."
            pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$"
          />

          <Field
            label="Website URL"
            value={websiteUrl}
            onChange={setWebsiteUrl}
            type="url"
            placeholder="https://kopi-kenangan.com"
            required
            disabled={submitting}
          />

          <Field
            label="Tagline"
            optional
            value={tagline}
            onChange={setTagline}
            placeholder="Bisa diisi nanti"
            disabled={submitting}
          />

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {submitting && (
            <div className="rounded-lg border border-violet-900/50 bg-violet-950/30 px-3 py-3 text-sm text-violet-200">
              <div className="flex items-center gap-2">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400"></span>
                </span>
                <span>Scraping website...</span>
              </div>
              <p className="mt-1 text-xs text-violet-400/70">
                Bisa 30 detik - 3 menit tergantung ukuran website.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 py-2.5 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !brandId || !brandName || !websiteUrl}
              className="btn-primary flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Scraping..." : "Buat & Scrape"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  optional,
  disabled,
  hint,
  pattern,
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {optional && (
          <span className="text-[10px] uppercase tracking-wider text-slate-600">
            opsional
          </span>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        pattern={pattern}
        className="w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}

function autoSlug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
