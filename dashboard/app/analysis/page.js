"use client";

import { useEffect, useState } from "react";
import { AddBrandModal } from "../AddBrandModal";
import { api } from "../api-client";
import { AppHeader } from "../AppHeader";
import { useBrand } from "../use-brand";
import { HourHeatmap } from "./HourHeatmap";
import { PillarBars } from "./PillarBars";
import { PostsTable } from "./PostsTable";
import { StatCard } from "./StatCard";
import { TopPostCard } from "./TopPostCard";
import { TypeBreakdown } from "./TypeBreakdown";
import { UploadInsightsModal } from "./UploadInsightsModal";

export default function AnalysisPage() {
  const {
    brands,
    activeBrand,
    activeBrandId,
    loading: brandsLoading,
    selectBrand,
    createBrand,
    deleteBrand,
  } = useBrand();

  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeBrandId) {
      setInsights(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    setInsights(null);
    api
      .getInsights(activeBrandId)
      .then(setInsights)
      .catch((e) => {
        setError(e.message || "Gagal load insights");
      })
      .finally(() => setLoading(false));
  }, [activeBrandId]);

  // Source tag ditulis backend ke insights.json saat upload — kalau absent,
  // berarti default synthetic data dari repo (fotofusi commit).
  const insightsSource = insights?.source || (insights ? "synthetic" : null);
  const uploadedAt = insights?.uploaded_at;

  const agg = insights?.aggregates;
  const hasNoInsights = error?.includes("404") || error?.includes("No insights");

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <AppHeader
        brands={brands}
        activeBrandId={activeBrandId}
        onSelect={selectBrand}
        onAdd={() => setAddOpen(true)}
        onDelete={deleteBrand}
      />

      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="wordmark font-display text-2xl font-bold uppercase md:text-3xl">
                HELIX Analysis
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Analisa performa konten{" "}
                <span className="text-violet-300">
                  {activeBrand?.brand_name || "—"}
                </span>{" "}
                · data-driven insights
              </p>
              {insightsSource && (
                <DataSourceBadge source={insightsSource} uploadedAt={uploadedAt} />
              )}
            </div>
            {activeBrandId && (
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="lift-on-hover rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-blue-500/10 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:border-violet-500/70"
              >
                📤 Upload data sosmed
              </button>
            )}
          </div>

          {brandsLoading && (
            <CenteredMessage text="Loading brands..." />
          )}

          {!brandsLoading && brands.length === 0 && (
            <NoBrandsState onAdd={() => setAddOpen(true)} />
          )}

          {!brandsLoading && activeBrandId && loading && (
            <CenteredMessage text={`Loading insights ${activeBrand?.brand_name}...`} />
          )}

          {!loading && hasNoInsights && (
            <NoInsightsState brandName={activeBrand?.brand_name} />
          )}

          {!loading && error && !hasNoInsights && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {agg && (
            <div className="space-y-6">
              {/* Hero stats */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label="Total Posts"
                  value={agg.post_count}
                  hint={dateRangeHint(insights.posts)}
                  index={0}
                />
                <StatCard
                  label="Total Reach"
                  value={fmtNum(agg.total_reach)}
                  hint={`avg ${fmtNum(agg.avg_reach)}/post`}
                  index={1}
                />
                <StatCard
                  label="Avg ER"
                  value={`${agg.avg_engagement_rate}%`}
                  hint={`median ${agg.median_engagement_rate}%`}
                  accent="emerald"
                  index={2}
                />
                <StatCard
                  label="New Follows"
                  value={`+${agg.total_follows}`}
                  hint="dari periode ini"
                  accent="violet"
                  index={3}
                />
              </div>

              {/* Type breakdown */}
              {agg.by_type && (
                <Section title="Performance by Format">
                  <TypeBreakdown data={agg.by_type} />
                </Section>
              )}

              {/* Pillar breakdown */}
              {agg.by_content_pillar && (
                <Section title="Performance by Content Pillar">
                  <PillarBars data={agg.by_content_pillar} />
                </Section>
              )}

              {/* Hour heatmap */}
              {agg.engagement_by_hour && (
                <Section title="Engagement by Hour">
                  <HourHeatmap data={agg.engagement_by_hour} />
                </Section>
              )}

              {/* Top posts */}
              {agg.top_5_posts?.length > 0 && (
                <Section title="Top Performing Posts">
                  <div className="space-y-3">
                    {agg.top_5_posts.map((p, i) => (
                      <TopPostCard key={p.post_id} post={p} rank={i + 1} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Full posts table */}
              {insights.posts?.length > 0 && (
                <Section title={`All Posts (${insights.posts.length})`}>
                  <PostsTable posts={insights.posts} />
                </Section>
              )}
            </div>
          )}
        </div>
      </main>

      <AddBrandModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={createBrand}
      />
      <UploadInsightsModal
        open={uploadOpen}
        brandId={activeBrandId}
        brandName={activeBrand?.brand_name}
        onClose={() => setUploadOpen(false)}
        onSuccess={(data) => setInsights(data)}
      />
    </div>
  );
}

function DataSourceBadge({ source, uploadedAt }) {
  const isUploaded = source === "uploaded";
  const dot = isUploaded ? "bg-emerald-400" : "bg-amber-400";
  const label = isUploaded ? "Uploaded" : "Synthetic demo";
  const hint = isUploaded
    ? uploadedAt
      ? `· ${formatRelative(uploadedAt)}`
      : null
    : "· data karangan, replace via Upload";
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 px-2 py-1 text-[11px] text-slate-400">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="font-semibold text-slate-300">{label}</span>
      {hint && <span className="text-slate-500">{hint}</span>}
    </div>
  );
}

function formatRelative(iso) {
  try {
    const ts = new Date(iso).getTime();
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1) return "baru saja";
    if (diffMin < 60) return `${diffMin}m lalu`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lalu`;
    return `${Math.floor(diffMin / 1440)}h lalu`;
  } catch {
    return "";
  }
}

function Section({ title, children }) {
  return (
    <section className="reveal-in rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-violet-300">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CenteredMessage({ text }) {
  return (
    <div className="mt-12 text-center text-sm text-slate-500">{text}</div>
  );
}

function NoBrandsState({ onAdd }) {
  return (
    <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center backdrop-blur">
      <p className="text-sm text-slate-400">
        Belum ada brand. Tambahkan brand dulu untuk lihat analisa konten.
      </p>
      <button
        onClick={onAdd}
        className="btn-primary mt-4 rounded-lg px-6 py-2 text-sm font-semibold text-white"
      >
        + Tambah brand
      </button>
    </div>
  );
}

function NoInsightsState({ brandName }) {
  return (
    <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center backdrop-blur">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/60">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3v18h18M7 14l4-4 4 4 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-500"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-base font-semibold text-slate-200">
        Belum ada data insights
      </h3>
      <p className="mb-1 text-sm text-slate-500">
        Brand <span className="text-violet-300">{brandName}</span> belum punya
        data performance konten.
      </p>
      <p className="text-xs text-slate-600">
        Upload CSV ke <code className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">data/{brandName?.toLowerCase()}_insights.csv</code>{" "}
        atau coba dengan brand demo (Fotofusi).
      </p>
    </div>
  );
}

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function dateRangeHint(posts) {
  if (!posts?.length) return "";
  const start = posts[0].date;
  const end = posts[posts.length - 1].date;
  return `${start} → ${end}`;
}
