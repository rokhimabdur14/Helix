"use client";

/**
 * Result cards untuk Sprint 14b URL analysis.
 * - PostUrlResultCard: render output /analyze/post-url (analyze_reference)
 * - ProfileUrlResultCard: render output /analyze/profile-url (analyze_profile)
 *
 * Reuse design language Sprint 14a diagnosis card — bullet sections,
 * violet/emerald/amber accent, monospace metric grid.
 */

const PLATFORM_BADGE = {
  instagram: { label: "Instagram", className: "text-pink-300 border-pink-500/30 bg-pink-500/5" },
  tiktok: { label: "TikTok", className: "text-cyan-300 border-cyan-500/30 bg-cyan-500/5" },
};

function PlatformBadge({ platform }) {
  if (!platform) return null;
  const cfg = PLATFORM_BADGE[platform] || {
    label: platform,
    className: "text-slate-300 border-slate-700 bg-slate-800/50",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function Thumbnail({ src, alt }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="mb-4 max-h-72 w-full rounded-xl border border-slate-800 object-contain bg-slate-950"
    />
  );
}

export function PostUrlResultCard({ result }) {
  const { url, platform, thumbnail_data_url, analysis } = result || {};
  if (!analysis) return null;

  const eng = analysis.engagement_signals || {};

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            <PlatformBadge platform={platform || analysis.platform} />
            {analysis.format && (
              <span className="text-[11px] font-medium uppercase text-slate-400">
                {analysis.format}
              </span>
            )}
            {analysis.creator_handle && (
              <span className="text-[11px] text-slate-500">@{analysis.creator_handle}</span>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[11px] text-violet-300 underline hover:text-violet-200"
          >
            {url}
          </a>
        </div>
      </div>

      <Thumbnail src={thumbnail_data_url} alt={`Screenshot ${url}`} />

      {/* Engagement signals */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Engagement signals (publik)
        </h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            ["Views", eng.views],
            ["Likes", eng.likes],
            ["Comments", eng.comments],
          ].map(([label, val]) => (
            <div key={label} className="rounded-md bg-slate-900/60 px-2 py-1.5">
              <div className="text-[10px] uppercase text-slate-500">{label}</div>
              <div className="font-mono text-sm text-slate-200">
                {val || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual + hook breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
        {analysis.visual_summary && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
              Visual summary
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {analysis.visual_summary}
            </p>
          </div>
        )}
        {analysis.hook_or_first_frame && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
              Hook / detik 1
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {analysis.hook_or_first_frame}
            </p>
          </div>
        )}
        {(analysis.hooks_pattern || analysis.topic_or_pillar) && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {analysis.hooks_pattern && (
              <span className="rounded-md bg-violet-500/10 px-2 py-1 text-violet-200">
                Pattern: {analysis.hooks_pattern}
              </span>
            )}
            {analysis.topic_or_pillar && (
              <span className="rounded-md bg-slate-800 px-2 py-1 text-slate-300">
                Topic: {analysis.topic_or_pillar}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Caption */}
      {analysis.caption_excerpt && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Caption
          </h4>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
            {analysis.caption_excerpt}
          </p>
          {analysis.caption_style && (
            <p className="mt-2 text-[10px] italic text-slate-500">
              Style: {analysis.caption_style}
            </p>
          )}
        </div>
      )}

      {/* Why it works */}
      {analysis.why_it_works?.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            ✅ Kenapa post ini ramai
          </h4>
          <ul className="space-y-1 text-xs leading-relaxed text-slate-200">
            {analysis.why_it_works.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Replication */}
      {analysis.replication_angle && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
            🔁 Cara replikasi untuk brand kamu
          </h4>
          <p className="text-sm leading-relaxed text-slate-200">
            {analysis.replication_angle}
          </p>
          {analysis.suggested_use_for_brand && (
            <p className="mt-2 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Cocok untuk goal: </span>
              {analysis.suggested_use_for_brand}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProfileUrlResultCard({ result }) {
  const { url, platform, thumbnail_data_url, analysis } = result || {};
  if (!analysis) return null;

  const stats = analysis.stats || {};
  const fmt = analysis.format_mix || {};

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            <PlatformBadge platform={platform || analysis.platform} />
            {analysis.handle && (
              <span className="text-sm font-semibold text-slate-200">
                @{analysis.handle}
              </span>
            )}
            {analysis.consistency_score && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  analysis.consistency_score === "high"
                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/5"
                    : analysis.consistency_score === "medium"
                    ? "text-amber-300 border-amber-500/30 bg-amber-500/5"
                    : "text-red-300 border-red-500/30 bg-red-500/5"
                }`}
              >
                {analysis.consistency_score} consistency
              </span>
            )}
          </div>
          {analysis.display_name && (
            <p className="text-xs text-slate-400">{analysis.display_name}</p>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[11px] text-violet-300 underline hover:text-violet-200"
          >
            {url}
          </a>
        </div>
      </div>

      <Thumbnail src={thumbnail_data_url} alt={`Profile ${analysis.handle || url}`} />

      {/* Stats */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Stats akun
        </h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            ["Posts", stats.posts],
            ["Followers", stats.followers],
            ["Following", stats.following],
          ].map(([label, val]) => (
            <div key={label} className="rounded-md bg-slate-900/60 px-2 py-1.5">
              <div className="text-[10px] uppercase text-slate-500">{label}</div>
              <div className="font-mono text-sm text-slate-200">
                {val ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bio */}
      {analysis.bio && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Bio
          </h4>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
            {analysis.bio}
          </p>
        </div>
      )}

      {/* Aesthetic — palette + vibe + editing */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Aesthetic
        </h4>
        {analysis.color_palette?.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] text-slate-500">Palette dominan</div>
            <div className="flex flex-wrap gap-2">
              {analysis.color_palette.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-5 w-5 rounded border border-slate-700"
                    style={{ backgroundColor: c }}
                  />
                  <span className="font-mono text-[10px] text-slate-400">{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {analysis.vibe && (
          <div>
            <div className="mb-1 text-[10px] text-slate-500">Vibe</div>
            <p className="text-xs text-slate-300">{analysis.vibe}</p>
          </div>
        )}
        {analysis.editing_style && (
          <div>
            <div className="mb-1 text-[10px] text-slate-500">Editing style</div>
            <p className="text-xs text-slate-300">{analysis.editing_style}</p>
          </div>
        )}
      </div>

      {/* Content themes + format mix */}
      {(analysis.content_themes?.length > 0 || fmt) && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Content mix
          </h4>
          {analysis.content_themes?.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] text-slate-500">Themes</div>
              <div className="space-y-1">
                {analysis.content_themes.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="min-w-[140px] truncate text-slate-300">
                      {t.theme}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
                        style={{ width: `${Math.min(100, t.estimated_share_pct || 0)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {t.estimated_share_pct || 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(fmt.single_image_pct || fmt.carousel_pct || fmt.reel_or_video_pct) ? (
            <div>
              <div className="mb-1 text-[10px] text-slate-500">Format mix</div>
              <div className="flex h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500/60"
                  style={{ width: `${fmt.single_image_pct || 0}%` }}
                  title={`Single image ${fmt.single_image_pct || 0}%`}
                />
                <div
                  className="bg-blue-500/60"
                  style={{ width: `${fmt.carousel_pct || 0}%` }}
                  title={`Carousel ${fmt.carousel_pct || 0}%`}
                />
                <div
                  className="bg-pink-500/60"
                  style={{ width: `${fmt.reel_or_video_pct || 0}%` }}
                  title={`Reel ${fmt.reel_or_video_pct || 0}%`}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                <span>📷 Image {fmt.single_image_pct || 0}%</span>
                <span>🎠 Carousel {fmt.carousel_pct || 0}%</span>
                <span>🎬 Reel {fmt.reel_or_video_pct || 0}%</span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Key observations */}
      {analysis.key_observations?.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Key observations
          </h4>
          <ul className="space-y-1 text-xs leading-relaxed text-slate-300">
            {analysis.key_observations.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Replication pillars */}
      {analysis.recommended_replication_pillars?.length > 0 && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
            🔁 Pillar yang bisa di-replikasi
          </h4>
          <ul className="space-y-1 text-sm leading-relaxed text-slate-200">
            {analysis.recommended_replication_pillars.map((b, i) => (
              <li key={i}>→ {b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
