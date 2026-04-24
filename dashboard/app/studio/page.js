"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AddBrandModal } from "../AddBrandModal";
import { api } from "../api-client";
import { AppHeader } from "../AppHeader";
import { useBrand } from "../use-brand";
import { CaptionTab } from "./CaptionTab";
import { CarouselTab } from "./CarouselTab";
import { HookTab } from "./HookTab";
import { PlanTab } from "./PlanTab";

const TABS = [
  {
    id: "plan",
    label: "Plan",
    desc: "Kalender konten mingguan/bulanan",
    icon: PlanIcon,
  },
  {
    id: "hook",
    label: "Hook",
    desc: "3 detik pertama yang scroll-stopping",
    icon: HookIcon,
  },
  {
    id: "caption",
    label: "Caption",
    desc: "Caption IG yang drive engagement",
    icon: CaptionIcon,
  },
  {
    id: "carousel",
    label: "Carousel",
    desc: "Multi-slide dengan narrative arc",
    icon: CarouselIcon,
  },
];

const VALID_TAB_IDS = TABS.map((t) => t.id);
const DEFAULT_TAB = "plan";

// Wrapper supaya useSearchParams muat di Suspense boundary (Next.js 16 req).
export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioPageInner />
    </Suspense>
  );
}

function StudioPageInner() {
  const {
    brands,
    activeBrand,
    activeBrandId,
    loading: brandsLoading,
    error: brandsError,
    selectBrand,
    createBrand,
    deleteBrand,
  } = useBrand();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [addOpen, setAddOpen] = useState(false);
  // Initialize from URL: ?tab=hook → activeTab "hook" (validated)
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return VALID_TAB_IDS.includes(t) ? t : DEFAULT_TAB;
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  // Prefill: payload yang dikirim dari PlanTab → tab tujuan untuk pre-fill input
  // Shape: { tool: "hook|caption|carousel", payload: {...} }
  const [prefill, setPrefill] = useState(null);
  const [expertise, setExpertise] = useState([]);

  // Sync URL → state untuk back/forward browser navigation
  useEffect(() => {
    const t = searchParams.get("tab");
    const next = VALID_TAB_IDS.includes(t) ? t : DEFAULT_TAB;
    if (next !== activeTab) {
      setActiveTab(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Wrapper: update state + URL (replace, no scroll, no history spam)
  const changeTab = useCallback(
    (tab) => {
      if (!VALID_TAB_IDS.includes(tab)) return;
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    api.listExpertise()
      .then((d) => setExpertise(d.expertise || []))
      .catch(() => setExpertise([]));
  }, []);

  const sendToTool = useCallback(
    (tool, payload) => {
      setPrefill({ tool, payload });
      changeTab(tool);
    },
    [changeTab]
  );

  const consumePrefill = useCallback((tool) => {
    if (prefill?.tool !== tool) return null;
    const p = prefill.payload;
    setPrefill(null);
    return p;
  }, [prefill]);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <AppHeader
        brands={brands}
        activeBrandId={activeBrandId}
        onSelect={selectBrand}
        onAdd={() => setAddOpen(true)}
        onDelete={deleteBrand}
      />

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="wordmark font-display text-2xl font-bold uppercase md:text-3xl">
                Content Studio
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Generate konten sosmed untuk{" "}
                <span className="text-violet-300">
                  {activeBrand?.brand_name || "—"}
                </span>{" "}
                · powered by HELIX
              </p>
            </div>
            {expertise.length > 0 && (
              <ExpertiseBadge sources={expertise} />
            )}
          </div>

          {brandsLoading && (
            <div className="mt-12 text-center text-sm text-slate-500">
              Loading brands...
            </div>
          )}

          {brandsError && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              Gagal load brands: {brandsError}
            </div>
          )}

          {!brandsLoading && brands.length === 0 && (
            <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center backdrop-blur">
              <p className="text-sm text-slate-400">
                Belum ada brand. Tambahkan brand dulu di header untuk mulai
                generate konten.
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="btn-primary mt-4 rounded-lg px-6 py-2 text-sm font-semibold text-white"
              >
                + Tambah brand
              </button>
            </div>
          )}

          {!brandsLoading && activeBrandId && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => changeTab(tab.id)}
                      className={`lift-on-hover group flex items-start gap-3 rounded-xl border p-4 text-left ${
                        active
                          ? "border-violet-500/60 bg-gradient-to-br from-blue-600/10 to-violet-600/10 shadow-lg shadow-violet-900/20"
                          : "border-slate-800 bg-slate-900/40 hover:border-violet-500/30 hover:bg-slate-800/40"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition ${
                          active
                            ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white"
                            : "bg-slate-800 text-slate-400 group-hover:text-violet-300"
                        }`}
                      >
                        <Icon />
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`text-sm font-semibold ${
                            active ? "text-violet-200" : "text-slate-200"
                          }`}
                        >
                          {tab.label}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {tab.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
                {activeTab === "plan" && (
                  <PlanTab
                    brandId={activeBrandId}
                    onSendToTool={sendToTool}
                  />
                )}
                {activeTab === "hook" && (
                  <HookTab
                    brandId={activeBrandId}
                    consumePrefill={consumePrefill}
                  />
                )}
                {activeTab === "caption" && (
                  <CaptionTab
                    brandId={activeBrandId}
                    consumePrefill={consumePrefill}
                  />
                )}
                {activeTab === "carousel" && (
                  <CarouselTab
                    brandId={activeBrandId}
                    consumePrefill={consumePrefill}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <AddBrandModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={createBrand}
      />
    </div>
  );
}

function ExpertiseBadge({ sources }) {
  return (
    <div
      title={`Knowledge sources aktif: ${sources.map((s) => s.label).join(", ")}`}
      className="lift-on-hover group flex items-center gap-2 rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-blue-500/5 px-3 py-2 text-xs"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="text-violet-300"
      >
        <path
          d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex flex-col">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-violet-400">
          Knowledge active
        </span>
        <span className="text-xs font-medium text-violet-100">
          {sources.length} expertise source{sources.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function PlanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CaptionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CarouselIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M21 8v8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
