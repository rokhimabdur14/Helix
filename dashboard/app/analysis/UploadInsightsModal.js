"use client";

import { useRef, useState } from "react";
import { api } from "../api-client";
import {
  PostUrlResultCard,
  ProfileUrlResultCard,
} from "./UrlAnalysisResultCards";

const TEMPLATE_CSV = [
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

const IMG_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const IMG_MAX_MB = 8;
const CSV_MAX_MB = 5;

const URL_RE_IG_POST = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\//i;
const URL_RE_TT_POST = /^https?:\/\/(www\.)?(vm\.|vt\.)?tiktok\.com\/.+\/video\//i;
const URL_RE_TT_SHORT = /^https?:\/\/(vm|vt)\.tiktok\.com\//i;
const URL_RE_IG_PROFILE = /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?$/i;
const URL_RE_TT_PROFILE = /^https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9._]+\/?$/i;

function looksLikePostUrl(url) {
  return URL_RE_IG_POST.test(url) || URL_RE_TT_POST.test(url) || URL_RE_TT_SHORT.test(url);
}

function looksLikeProfileUrl(url) {
  return URL_RE_IG_PROFILE.test(url) || URL_RE_TT_PROFILE.test(url);
}

const MODES = [
  { id: "screenshot", label: "📸 Screenshot Insights", short: "Insights" },
  { id: "url_post", label: "🔗 URL Post", short: "URL Post" },
  { id: "url_profile", label: "👤 URL Profile", short: "Profile" },
  { id: "csv", label: "📄 CSV bulk", short: "CSV" },
];

export function UploadInsightsModal({ open, brandId, brandName, onClose, onSuccess }) {
  const [mode, setMode] = useState("screenshot");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  if (!open) return null;

  function reset() {
    setFile(null);
    setCaption("");
    setUrlInput("");
    setError("");
    setSuccess(null);
    setUploading(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }

  function switchMode(next) {
    if (uploading) return;
    if (next === mode) return;
    reset();
    setMode(next);
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
    if (mode === "csv") {
      if (!f.name.toLowerCase().endsWith(".csv")) {
        setError("File harus berekstensi .csv");
        return;
      }
      if (f.size > CSV_MAX_MB * 1024 * 1024) {
        setError(`File maksimal ${CSV_MAX_MB} MB`);
        return;
      }
      setFile(f);
      return;
    }
    if (mode === "screenshot") {
      const mime = (f.type || "").toLowerCase();
      if (!IMG_MIMES.includes(mime)) {
        setError("Format harus PNG / JPG / WEBP");
        return;
      }
      if (f.size > IMG_MAX_MB * 1024 * 1024) {
        setError(`Gambar maksimal ${IMG_MAX_MB} MB`);
        return;
      }
      setFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
    }
  }

  async function handleSubmit() {
    if (uploading) return;
    setError("");

    if (mode === "screenshot" || mode === "csv") {
      if (!file) return;
    } else {
      const u = urlInput.trim();
      if (!u) {
        setError("URL kosong");
        return;
      }
      if (mode === "url_post" && !looksLikePostUrl(u)) {
        setError(
          "URL post harus format IG (instagram.com/p/... atau /reel/...) atau TikTok (tiktok.com/.../video/... atau vm.tiktok.com/...)"
        );
        return;
      }
      if (mode === "url_profile" && !looksLikeProfileUrl(u)) {
        setError(
          "URL profile harus format instagram.com/<handle>/ atau tiktok.com/@<handle>/"
        );
        return;
      }
    }

    setUploading(true);
    try {
      if (mode === "csv") {
        const data = await api.uploadInsights(brandId, file);
        const agg = data.aggregates || {};
        setSuccess({
          mode: "csv",
          post_count: agg.post_count || 0,
          date_range:
            data.posts?.length > 0
              ? `${data.posts[0].date} → ${data.posts[data.posts.length - 1].date}`
              : "—",
          adaptation: data.adaptation || null,
        });
        onSuccess?.(data);
      } else if (mode === "screenshot") {
        const data = await api.uploadInsightsScreenshot(brandId, file, caption);
        setSuccess({
          mode: "screenshot",
          extracted_row: data.extracted_row,
          extraction: data.extraction || {},
          diagnosis: data.diagnosis || {},
          pillar_assigned: data.pillar_assigned,
          post_count: data.post_count || 0,
        });
        onSuccess?.(data);
      } else if (mode === "url_post") {
        const data = await api.analyzePostUrl(urlInput.trim(), brandId);
        setSuccess({ mode: "url_post", result: data });
      } else if (mode === "url_profile") {
        const data = await api.analyzeProfileUrl(urlInput.trim(), brandId);
        setSuccess({ mode: "url_profile", result: data });
      }
    } catch (e) {
      setError(e.message || "Submit gagal");
    } finally {
      setUploading(false);
    }
  }

  const FORMAT_LABEL = {
    helix: "HELIX schema",
    instagram: "Instagram export",
    tiktok: "TikTok export",
  };

  const CONFIDENCE_STYLE = {
    high: "text-emerald-300 border-emerald-500/30 bg-emerald-500/5",
    medium: "text-amber-300 border-amber-500/30 bg-amber-500/5",
    low: "text-red-300 border-red-500/30 bg-red-500/5",
  };

  const BAND_STYLE = {
    above_avg: { label: "Di atas rata-rata", className: "text-emerald-300" },
    avg: { label: "Setara rata-rata", className: "text-slate-300" },
    below_avg: { label: "Di bawah rata-rata", className: "text-red-300" },
  };

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

  const acceptAttr = mode === "csv" ? ".csv" : "image/png,image/jpeg,image/webp";
  const dropHint =
    mode === "csv"
      ? "Drop CSV di sini atau klik buat pilih file"
      : "Drop screenshot di sini atau klik buat pilih gambar";
  const sizeHint =
    mode === "csv"
      ? `Maksimal ${CSV_MAX_MB} MB · format .csv`
      : `Maksimal ${IMG_MAX_MB} MB · PNG / JPG / WEBP`;

  const submitDisabled =
    uploading ||
    ((mode === "screenshot" || mode === "csv") && !file) ||
    ((mode === "url_post" || mode === "url_profile") && !urlInput.trim());

  const submitLabel = uploading
    ? mode === "screenshot"
      ? "Analisa..."
      : mode === "csv"
      ? "Uploading..."
      : "Scraping & analisa..."
    : mode === "screenshot"
    ? "Extract & analisa"
    : mode === "csv"
    ? "Upload & process"
    : "Analisa URL";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Analisa konten sosmed"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="reveal-in flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Analisa konten sosmed
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Untuk{" "}
              <span className="text-violet-300">{brandName || brandId}</span>
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

        {!success && (
          <div className="border-b border-slate-800 px-5 pt-4">
            <div
              role="tablist"
              className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-950/60 p-1 text-xs"
            >
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  onClick={() => switchMode(m.id)}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${
                    mode === m.id
                      ? "bg-violet-500/20 text-violet-200"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {!success && mode === "screenshot" && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-relaxed text-slate-400">
              <p className="mb-2 font-semibold text-slate-300">
                Cara pakai (post sendiri, butuh akses Insights):
              </p>
              <ol className="list-inside list-decimal space-y-1">
                <li>Buka app IG / TikTok di HP, masuk ke post → tap “Insights / Statistik”</li>
                <li>Screenshot panel Insights (scroll dulu agar semua metric kelihatan)</li>
                <li>Upload di sini — AI extract metric + analisa kenapa post ini perform begini</li>
              </ol>
              <p className="mt-2 text-[11px] text-slate-500">
                Paste caption asli (opsional) biar diagnosis lebih akurat.
              </p>
            </div>
          )}

          {!success && mode === "url_post" && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-relaxed text-slate-400">
              <p className="mb-2 font-semibold text-slate-300">
                Analisa post mana saja (own / kompetitor / inspirasi):
              </p>
              <ol className="list-inside list-decimal space-y-1">
                <li>Copy link post IG (/p/, /reel/) atau TikTok (/video/, vm.tiktok.com)</li>
                <li>Paste di bawah, klik Analisa</li>
                <li>HELIX scrape + AI analisa: visual hook, pattern, kenapa ramai, cara replikasi</li>
              </ol>
              <p className="mt-2 text-[11px] text-slate-500">
                Hanya post publik yang work. IG private / draft tidak bisa di-scrape.
              </p>
            </div>
          )}

          {!success && mode === "url_profile" && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-relaxed text-slate-400">
              <p className="mb-2 font-semibold text-slate-300">
                Analisa profile / akun (untuk benchmark + inspirasi):
              </p>
              <ol className="list-inside list-decimal space-y-1">
                <li>Copy URL profile IG (instagram.com/&lt;handle&gt;) atau TT (tiktok.com/@&lt;handle&gt;)</li>
                <li>Paste di bawah, klik Analisa</li>
                <li>HELIX analisa aesthetic, content themes, format mix, consistency</li>
              </ol>
              <p className="mt-2 text-[11px] text-slate-500">
                Output: palette warna, vibe, editing style, pillar replikasi.
              </p>
            </div>
          )}

          {!success && mode === "csv" && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-relaxed text-slate-400">
              <p className="mb-2 font-semibold text-slate-300">
                Upload CSV bulk (multi-post sekaligus):
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <span className="text-slate-200">Instagram export</span> dari Meta Business Suite
                </li>
                <li>
                  <span className="text-slate-200">TikTok export</span> dari Creator Center Analytics
                </li>
                <li>
                  <span className="text-slate-200">Schema HELIX</span> —{" "}
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="text-violet-300 underline hover:text-violet-200"
                  >
                    download template
                  </button>{" "}
                  + isi manual
                </li>
              </ul>
            </div>
          )}

          {!success && (mode === "url_post" || mode === "url_profile") && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-400">
                URL {mode === "url_post" ? "post" : "profile"}
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={
                  mode === "url_post"
                    ? "https://www.instagram.com/reel/CxxxxxxxX/"
                    : "https://www.instagram.com/fotofusiofficial/"
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
              />
              {uploading && (
                <p className="mt-2 text-[11px] text-amber-400/80">
                  ⏳ Render via headless browser (5-20 detik) + vision AI...
                </p>
              )}
            </div>
          )}

          {!success && (mode === "screenshot" || mode === "csv") && (
            <>
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
                  accept={acceptAttr}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                {file ? (
                  <>
                    {mode === "screenshot" && previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Preview screenshot"
                        className="mb-2 max-h-48 rounded-lg border border-slate-800"
                      />
                    ) : (
                      <div className="text-2xl">📄</div>
                    )}
                    <div className="mt-1 text-sm font-medium text-emerald-200">
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
                    <div className="text-3xl">{mode === "screenshot" ? "📸" : "📤"}</div>
                    <div className="mt-2 text-sm text-slate-300">{dropHint}</div>
                    <div className="mt-1 text-xs text-slate-500">{sizeHint}</div>
                  </>
                )}
              </label>

              {mode === "screenshot" && file && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Caption asli post{" "}
                    <span className="text-slate-600">
                      (opsional, paste biar AI lebih akurat)
                    </span>
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={3}
                    placeholder="Paste caption asli post di sini..."
                    className="w-full resize-y rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
                  />
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* SUCCESS — CSV */}
          {success?.mode === "csv" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
              <div className="mb-3 text-3xl">✅</div>
              <h3 className="text-base font-semibold text-emerald-200">Upload sukses</h3>
              <div className="mt-3 grid gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left text-xs">
                {success.adaptation && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Format terdeteksi:</span>
                    <span className="font-semibold text-violet-300">
                      {FORMAT_LABEL[success.adaptation.format_detected] ||
                        success.adaptation.format_detected}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Posts terbaca:</span>
                  <span className="font-semibold text-slate-200">{success.post_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Range tanggal:</span>
                  <span className="font-mono text-[11px] text-slate-300">{success.date_range}</span>
                </div>
                {success.adaptation?.pillars_classified > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pillar di-tag AI:</span>
                    <span className="font-semibold text-emerald-300">
                      {success.adaptation.pillars_classified} post
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUCCESS — Screenshot Insights */}
          {success?.mode === "screenshot" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="mb-1 text-sm font-semibold text-emerald-200">
                  ✅ Screenshot berhasil di-extract
                </div>
                <div className="text-xs text-slate-400">
                  Total post di brand sekarang:{" "}
                  <span className="text-slate-200">{success.post_count}</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Metric Ter-extract
                  </h4>
                  {success.extraction?.confidence && (
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        CONFIDENCE_STYLE[success.extraction.confidence] ||
                        CONFIDENCE_STYLE.medium
                      }`}
                    >
                      {success.extraction.confidence} confidence
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    ["Reach", success.extracted_row?.reach],
                    ["Plays", success.extracted_row?.impressions],
                    ["Likes", success.extracted_row?.likes],
                    ["Comments", success.extracted_row?.comments],
                    ["Saves", success.extracted_row?.saves],
                    ["Shares", success.extracted_row?.shares],
                    ["Profile visits", success.extracted_row?.profile_visits],
                    ["Follows", success.extracted_row?.follows],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded-md bg-slate-900/60 px-2 py-1.5">
                      <div className="text-[10px] uppercase text-slate-500">{label}</div>
                      <div className="font-mono text-sm text-slate-200">{val || 0}</div>
                    </div>
                  ))}
                </div>
                {success.extraction?.confidence_reason && (
                  <div className="mt-2 text-[11px] italic text-slate-500">
                    {success.extraction.confidence_reason}
                  </div>
                )}
                {success.extraction?.not_visible?.length > 0 && (
                  <div className="mt-2 text-[11px] text-amber-400/80">
                    Tidak terlihat di screenshot: {success.extraction.not_visible.join(", ")}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                    🧠 AI Diagnosis
                  </h4>
                  {success.diagnosis?.performance_band && (
                    <span
                      className={`text-[11px] font-semibold ${
                        BAND_STYLE[success.diagnosis.performance_band]?.className ||
                        "text-slate-300"
                      }`}
                    >
                      {BAND_STYLE[success.diagnosis.performance_band]?.label ||
                        success.diagnosis.performance_band}
                    </span>
                  )}
                </div>
                {success.diagnosis?.summary && (
                  <p className="mb-3 text-sm leading-relaxed text-slate-200">
                    {success.diagnosis.summary}
                  </p>
                )}
                {success.diagnosis?.why_winning?.length > 0 && (
                  <div className="mb-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-emerald-400">
                      Kenapa berhasil
                    </div>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {success.diagnosis.why_winning.map((b, i) => (
                        <li key={i}>• {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {success.diagnosis?.why_underperforming?.length > 0 && (
                  <div className="mb-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-red-400">
                      Kenapa kurang perform
                    </div>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {success.diagnosis.why_underperforming.map((b, i) => (
                        <li key={i}>• {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {success.diagnosis?.actionable_fixes?.length > 0 && (
                  <div className="mb-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-violet-300">
                      Fix yang bisa langsung dipakai
                    </div>
                    <ul className="space-y-1 text-xs text-slate-200">
                      {success.diagnosis.actionable_fixes.map((b, i) => (
                        <li key={i}>→ {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {success.diagnosis?.next_post_hint && (
                  <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      Hint post berikutnya:{" "}
                    </span>
                    {success.diagnosis.next_post_hint}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUCCESS — URL Post */}
          {success?.mode === "url_post" && (
            <PostUrlResultCard result={success.result} />
          )}

          {/* SUCCESS — URL Profile */}
          {success?.mode === "url_profile" && (
            <ProfileUrlResultCard result={success.result} />
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
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="btn-primary rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
