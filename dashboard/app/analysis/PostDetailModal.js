"use client";

import { useEffect, useState } from "react";
import { api } from "../api-client";

const BAND_STYLE = {
  above_avg: { label: "Di atas rata-rata", className: "text-emerald-300" },
  avg: { label: "Setara rata-rata", className: "text-slate-300" },
  below_avg: { label: "Di bawah rata-rata", className: "text-red-300" },
};

const TYPE_COLOR = {
  reel: "text-pink-300",
  carousel: "text-blue-300",
  image: "text-emerald-300",
  story: "text-amber-300",
  feed: "text-violet-300",
};

export function PostDetailModal({ open, post, brandId, savedDiagnosis, onClose, onDiagnosisUpdate }) {
  const [diagnosis, setDiagnosis] = useState(savedDiagnosis || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDiagnosis(savedDiagnosis || null);
    setError("");
  }, [savedDiagnosis, post?.post_id]);

  if (!open || !post) return null;

  async function generateDiagnosis() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.diagnosePost(brandId, post.post_id);
      setDiagnosis(data.diagnosis);
      onDiagnosisUpdate?.(post.post_id, data.diagnosis);
    } catch (e) {
      setError(e.message || "Generate diagnosis gagal");
    } finally {
      setLoading(false);
    }
  }

  const metrics = [
    ["Reach", post.reach],
    ["Plays", post.impressions],
    ["Likes", post.likes],
    ["Comments", post.comments],
    ["Saves", post.saves],
    ["Shares", post.shares],
    ["Profile visits", post.profile_visits],
    ["Follows", post.follows],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detail post ${post.post_id}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="reveal-in flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold uppercase ${
                  TYPE_COLOR[post.type?.toLowerCase()] || "text-slate-400"
                }`}
              >
                {post.type}
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400">{post.date}</span>
              {post.posted_time && (
                <>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-400">{post.posted_time}</span>
                </>
              )}
            </div>
            <h2 className="mt-2 text-base font-semibold text-slate-100">
              Performance:{" "}
              <span className="text-violet-300">{post.engagement_rate}%</span> ER
            </h2>
            {post.content_pillar && (
              <p className="mt-1 text-xs text-slate-500">
                Pillar:{" "}
                <span className="text-slate-300">{post.content_pillar}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Metric grid */}
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Metric
            </h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {metrics.map(([label, val]) => (
                <div key={label} className="rounded-md bg-slate-900/60 px-2 py-1.5">
                  <div className="text-[10px] uppercase text-slate-500">{label}</div>
                  <div className="font-mono text-sm text-slate-200">
                    {val?.toLocaleString?.() || val || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Caption
              </h4>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                {post.caption}
              </p>
              {post.hashtags?.length > 0 && (
                <p className="mt-2 text-[11px] text-slate-500">
                  {post.hashtags.join(" ")}
                </p>
              )}
            </div>
          )}

          {/* Diagnosis */}
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                🧠 AI Diagnosis
              </h4>
              {diagnosis?.performance_band && (
                <span
                  className={`text-[11px] font-semibold ${
                    BAND_STYLE[diagnosis.performance_band]?.className || "text-slate-300"
                  }`}
                >
                  {BAND_STYLE[diagnosis.performance_band]?.label ||
                    diagnosis.performance_band}
                </span>
              )}
            </div>

            {!diagnosis && !loading && (
              <div className="text-center">
                <p className="mb-3 text-xs text-slate-400">
                  Belum ada diagnosis untuk post ini. Generate sekarang?
                </p>
                <button
                  type="button"
                  onClick={generateDiagnosis}
                  className="btn-primary rounded-lg px-5 py-2 text-xs font-semibold text-white"
                >
                  Generate diagnosis
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center text-xs text-slate-400">
                <span className="inline-block animate-pulse">
                  Menganalisis post...
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            {diagnosis && (
              <>
                {diagnosis.summary && (
                  <p className="mb-3 text-sm leading-relaxed text-slate-200">
                    {diagnosis.summary}
                  </p>
                )}
                {diagnosis.why_winning?.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-emerald-400">
                      Kenapa berhasil
                    </div>
                    <ul className="space-y-1 text-xs leading-relaxed text-slate-300">
                      {diagnosis.why_winning.map((b, i) => (
                        <li key={i}>• {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diagnosis.why_underperforming?.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-red-400">
                      Kenapa kurang perform
                    </div>
                    <ul className="space-y-1 text-xs leading-relaxed text-slate-300">
                      {diagnosis.why_underperforming.map((b, i) => (
                        <li key={i}>• {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diagnosis.actionable_fixes?.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-violet-300">
                      Fix yang bisa langsung dipakai
                    </div>
                    <ul className="space-y-1 text-xs leading-relaxed text-slate-200">
                      {diagnosis.actionable_fixes.map((b, i) => (
                        <li key={i}>→ {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diagnosis.next_post_hint && (
                  <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      Hint post berikutnya:{" "}
                    </span>
                    {diagnosis.next_post_hint}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">
                    {diagnosis.benchmark_used
                      ? "Pakai benchmark brand"
                      : "Best-practice expertise saja"}
                  </div>
                  <button
                    type="button"
                    onClick={generateDiagnosis}
                    disabled={loading}
                    className="text-[10px] text-slate-500 underline hover:text-slate-300 disabled:opacity-40"
                  >
                    ↻ regen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
