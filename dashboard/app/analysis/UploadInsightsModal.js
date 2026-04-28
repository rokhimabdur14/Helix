"use client";

import { useRef, useState } from "react";
import { api } from "../api-client";

const REQUIRED_COLUMNS = [
  "post_id",
  "date",
  "type",
  "caption",
  "reach",
  "likes",
  "comments",
];

const OPTIONAL_COLUMNS = [
  "posted_time",
  "content_pillar",
  "hashtags",
  "impressions",
  "saves",
  "shares",
  "profile_visits",
  "follows",
];

const TEMPLATE_CSV = [
  // header
  [
    "post_id",
    "date",
    "posted_time",
    "type",
    "content_pillar",
    "caption",
    "hashtags",
    "reach",
    "impressions",
    "likes",
    "comments",
    "saves",
    "shares",
    "profile_visits",
    "follows",
  ].join(","),
  // sample row
  [
    "p_001",
    "2026-04-15",
    "19:00",
    "reel",
    "Brand Education",
    `"Caption singkat — ganti dengan caption asli post lo"`,
    "#hashtag1 #hashtag2",
    "850",
    "1100",
    "62",
    "8",
    "24",
    "5",
    "30",
    "4",
  ].join(","),
].join("\n");

export function UploadInsightsModal({ open, brandId, brandName, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  if (!open) return null;

  function reset() {
    setFile(null);
    setError("");
    setSuccess(null);
    setUploading(false);
  }

  function handleClose() {
    if (uploading) return;
    reset();
    onClose();
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  function handleFileSelect(f) {
    setError("");
    setSuccess(null);
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("File harus berekstensi .csv");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File maksimal 5 MB");
      return;
    }
    setFile(f);
  }

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    try {
      const data = await api.uploadInsights(brandId, file);
      const agg = data.aggregates || {};
      setSuccess({
        post_count: agg.post_count || 0,
        date_range:
          data.posts?.length > 0
            ? `${data.posts[0].date} → ${data.posts[data.posts.length - 1].date}`
            : "—",
      });
      onSuccess?.(data);
    } catch (e) {
      setError(e.message || "Upload gagal");
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "helix-insights-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload insights CSV"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="reveal-in flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Upload data sosmed
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              CSV insights untuk{" "}
              <span className="text-violet-300">{brandName || brandId}</span> —
              data lama akan diganti
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            aria-label="Tutup modal"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!success && (
            <>
              <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-relaxed text-slate-400">
                <p className="mb-2 font-semibold text-slate-300">
                  Cara dapat CSV:
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    <span className="text-slate-200">Instagram</span>: Settings →
                    Account Center → Your Information → Download Information →
                    pilih <em>Insights</em> range
                  </li>
                  <li>
                    <span className="text-slate-200">TikTok</span>: Creator
                    Center → Analytics → Overview → Export
                  </li>
                  <li>
                    Atau{" "}
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="text-violet-300 underline hover:text-violet-200"
                    >
                      download template HELIX
                    </button>{" "}
                    + isi manual
                  </li>
                </ul>
                <p className="mt-3 text-[11px] text-slate-500">
                  Schema wajib: <code className="text-slate-300">{REQUIRED_COLUMNS.join(", ")}</code>
                  <br />
                  Optional: <code className="text-slate-500">{OPTIONAL_COLUMNS.join(", ")}</code>
                </p>
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                  dragOver
                    ? "border-violet-500 bg-violet-500/5"
                    : file
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-slate-700 bg-slate-950/30 hover:border-violet-500/50 hover:bg-slate-950/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                {file ? (
                  <>
                    <div className="text-2xl">📄</div>
                    <div className="mt-2 text-sm font-medium text-emerald-200">
                      {file.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        reset();
                      }}
                      className="mt-3 text-xs text-slate-500 underline hover:text-slate-300"
                    >
                      Ganti file
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-3xl">📤</div>
                    <div className="mt-2 text-sm text-slate-300">
                      Drop CSV di sini atau klik buat pilih file
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Maksimal 5 MB · format .csv
                    </div>
                  </>
                )}
              </label>

              {error && (
                <div className="mt-3 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
              <div className="mb-3 text-3xl">✅</div>
              <h3 className="text-base font-semibold text-emerald-200">
                Upload sukses
              </h3>
              <div className="mt-3 grid gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Posts terbaca:</span>
                  <span className="font-semibold text-slate-200">
                    {success.post_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Range tanggal:</span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {success.date_range}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Analysis tab sudah refresh. Klik tutup untuk balik.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-40"
          >
            {success ? "Tutup" : "Batal"}
          </button>
          {!success && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Upload & process"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
