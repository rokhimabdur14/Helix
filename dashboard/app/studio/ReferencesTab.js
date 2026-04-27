"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../api-client";

const TAG_OPTIONS = [
  { value: "own", label: "Own", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" },
  { value: "inspiration", label: "Inspiration", color: "border-violet-500/40 bg-violet-500/10 text-violet-200" },
  { value: "competitor", label: "Competitor", color: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
];

export function ReferencesTab({ brandId, onCountChange }) {
  const [profile, setProfile] = useState({ snapshots: [] });
  const [refs, setRefs] = useState([]);
  const [error, setError] = useState("");

  const [url, setUrl] = useState("");
  const [tag, setTag] = useState("inspiration");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const refresh = useCallback(async () => {
    if (!brandId) return;
    setError("");
    try {
      const [p, r] = await Promise.all([
        api.social.getProfile(brandId),
        api.social.listReferences(brandId),
      ]);
      setProfile(p);
      setRefs(r.references || []);
    } catch (e) {
      setError(e.message);
    }
  }, [brandId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Bubble ready-references count up to parent (Studio shell) untuk dipakai di
  // indicator "N references aktif" di tab lain.
  useEffect(() => {
    if (!onCountChange) return;
    const ready = refs.filter((r) => r.status === "ready").length;
    const profileReady = (profile.snapshots || []).filter(
      (s) => s.status === "ready"
    ).length;
    onCountChange({ references: ready, profiles: profileReady });
  }, [refs, profile, onCountChange]);

  const hasPending =
    profile.snapshots?.some((s) => s.status === "pending") ||
    refs.some((r) => r.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [hasPending, refresh]);

  async function handleAddReference(e) {
    e.preventDefault();
    if (submitting || !url.trim()) return;
    setFormError("");
    setSubmitting(true);
    try {
      const newRef = await api.social.addReference(brandId, {
        url: url.trim(),
        tag,
      });
      setRefs((prev) => [newRef, ...prev]);
      setUrl("");
    } catch (e) {
      setFormError(e.message || "Gagal tambah reference");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(refId) {
    if (!window.confirm("Hapus reference ini?")) return;
    try {
      await api.social.deleteReference(brandId, refId);
      setRefs((prev) => prev.filter((r) => r.id !== refId));
    } catch (e) {
      setError(e.message);
    }
  }

  async function triggerSnapshot(platform) {
    const handle = window.prompt(
      `Handle ${platform}? (tanpa @, contoh: fotofusi)`
    );
    if (!handle?.trim()) return;
    try {
      await api.social.triggerSnapshot(brandId, {
        platform,
        handle: handle.trim(),
      });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="mb-2 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-blue-500/5 p-3 text-xs text-violet-100">
        <span className="font-semibold">Tips:</span> Reference + profile snapshot
        otomatis ke-inject ke prompt Plan/Hook/Caption/Carousel — generate konten
        akan match aesthetic brand & replicate pattern referensi yang kamu pilih.
      </div>

      {/* Profile snapshots */}
      <section className="mb-6 mt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            Profile snapshots
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => triggerSnapshot("instagram")}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 transition hover:border-violet-500/50 hover:text-violet-200"
            >
              + Instagram
            </button>
            <button
              onClick={() => triggerSnapshot("tiktok")}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 transition hover:border-violet-500/50 hover:text-violet-200"
            >
              + TikTok
            </button>
          </div>
        </div>
        {profile.snapshots?.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-center text-xs text-slate-500">
            Belum ada profile snapshot. Klik tombol Instagram / TikTok di atas
            untuk mulai.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {profile.snapshots?.map((snap) => (
            <ProfileCard key={snap.platform} snapshot={snap} />
          ))}
        </div>
      </section>

      {/* Reference library */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-300">
          Reference library
        </h3>

        <form
          onSubmit={handleAddReference}
          className="mb-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
        >
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste URL post Instagram / TikTok"
              disabled={submitting}
              className="input-glow w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none disabled:opacity-50"
            />
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              disabled={submitting}
              className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 focus:border-violet-500 focus:outline-none disabled:opacity-50"
              style={{ colorScheme: "dark" }}
            >
              {TAG_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="btn-primary rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Adding..." : "Analyze"}
            </button>
          </div>
          {formError && (
            <p className="mt-2 text-xs text-red-400">{formError}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Screenshot + vision analysis jalan di background (~10-30 detik).
            Refresh otomatis selama pending.
          </p>
        </form>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {refs.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-500">
            Belum ada reference. Paste URL post di atas untuk mulai bangun
            library.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {refs.map((r) => (
            <ReferenceCard
              key={r.id}
              reference={r}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
        analyzing
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
        ⚠ failed
      </span>
    );
  }
  return null;
}

function PlatformBadge({ platform }) {
  const styles =
    platform === "instagram"
      ? "border-pink-500/40 bg-pink-500/10 text-pink-200"
      : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles}`}
    >
      {platform}
    </span>
  );
}

function ProfileCard({ snapshot }) {
  const ana = snapshot.analysis || {};
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={snapshot.platform} />
          <span className="text-sm font-medium text-slate-200">
            @{snapshot.handle}
          </span>
        </div>
        <StatusBadge status={snapshot.status} />
      </div>

      {snapshot.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={snapshot.thumbnail}
          alt={`${snapshot.handle} profile`}
          className="mb-3 max-h-64 w-full rounded-lg border border-slate-800 object-cover object-top"
        />
      )}

      {snapshot.status === "failed" && (
        <p className="text-xs text-red-400">{snapshot.error}</p>
      )}

      {snapshot.status === "ready" && (
        <div className="space-y-2 text-xs">
          {ana.vibe && <KV label="Vibe" value={ana.vibe} />}
          {ana.color_palette?.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Palette
              </span>
              <div className="flex gap-1">
                {ana.color_palette.slice(0, 6).map((c, i) => (
                  <span
                    key={i}
                    title={c}
                    style={{ backgroundColor: c }}
                    className="h-4 w-4 rounded border border-slate-700"
                  />
                ))}
              </div>
            </div>
          )}
          {ana.editing_style && (
            <KV label="Editing" value={ana.editing_style} />
          )}
          {ana.consistency_score && (
            <KV
              label="Consistency"
              value={`${ana.consistency_score} — ${ana.consistency_reason || ""}`}
            />
          )}
          {ana.content_themes?.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Themes
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {ana.content_themes.map((t, i) => (
                  <span
                    key={i}
                    className="rounded border border-slate-700 bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-300"
                  >
                    {t.theme}{" "}
                    {t.estimated_share_pct ? `${t.estimated_share_pct}%` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
          {ana.key_observations?.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Observations
              </span>
              <ul className="mt-1 space-y-0.5">
                {ana.key_observations.map((o, i) => (
                  <li key={i} className="text-slate-400">
                    · {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReferenceCard({ reference, onDelete }) {
  const ana = reference.analysis || {};
  const tagMeta =
    TAG_OPTIONS.find((t) => t.value === reference.tag) || TAG_OPTIONS[1];
  return (
    <div className="lift-on-hover rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={reference.platform} />
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tagMeta.color}`}
          >
            {tagMeta.label}
          </span>
          <StatusBadge status={reference.status} />
        </div>
        <button
          onClick={() => onDelete(reference.id)}
          title="Hapus"
          className="text-slate-600 transition hover:text-red-400"
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
      </div>

      <a
        href={reference.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-2 block truncate text-xs text-violet-300 hover:text-violet-200"
      >
        {reference.url}
      </a>

      {reference.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reference.thumbnail}
          alt="reference preview"
          className="mb-3 max-h-72 w-full rounded-lg border border-slate-800 object-cover object-top"
        />
      )}

      {reference.status === "failed" && (
        <p className="text-xs text-red-400">{reference.error}</p>
      )}

      {reference.status === "ready" && (
        <div className="space-y-2 text-xs">
          {ana.format && (
            <KV
              label="Format"
              value={`${ana.format} · ${ana.topic_or_pillar || ""}`}
            />
          )}
          {ana.hook_or_first_frame && (
            <KV label="Hook" value={ana.hook_or_first_frame} />
          )}
          {ana.hooks_pattern && (
            <KV label="Hook pattern" value={ana.hooks_pattern} />
          )}
          {ana.caption_excerpt && ana.caption_excerpt !== "-" && (
            <KV label="Caption" value={ana.caption_excerpt} />
          )}
          {ana.why_it_works?.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Why it works
              </span>
              <ul className="mt-1 space-y-0.5">
                {ana.why_it_works.map((w, i) => (
                  <li key={i} className="text-slate-400">
                    · {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ana.replication_angle && (
            <KV label="Replicate" value={ana.replication_angle} />
          )}
        </div>
      )}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <p className="text-slate-300">{value}</p>
    </div>
  );
}
