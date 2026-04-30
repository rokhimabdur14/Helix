"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_URL } from "./api-client";
import { BrandSwitcher } from "./BrandSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { useBackendStatus } from "./use-backend-status";

const NAV = [
  { href: "/", label: "Chat" },
  { href: "/studio", label: "Studio" },
  { href: "/analysis", label: "Analysis" },
];

export function AppHeader({
  brands,
  activeBrandId,
  onSelect,
  onAdd,
  onDelete,
}) {
  const pathname = usePathname();
  const backendStatus = useBackendStatus();

  return (
    <header className="relative z-30 border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-xl">
      {backendStatus === "booting" && <BackendBootingBanner />}
      {backendStatus === "offline" && <BackendOfflineBanner />}
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/helix-mark.png"
            alt="HELIX"
            width={40}
            height={40}
            className="logo-pulse"
            priority
          />
          <div>
            <h1 className="wordmark font-display text-xl font-extrabold">
              HELIX
            </h1>
            <p className="hidden text-[11px] text-slate-500 tracking-wide sm:block">
              AI Social Media Strategist ·{" "}
              <span className="text-slate-400">by Akselera Tech</span>
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-xl border border-slate-800/60 bg-slate-900/40 p-1 backdrop-blur md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-violet-200 shadow-inner shadow-violet-900/30"
                    : "text-slate-400 hover:text-violet-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <StatusDot status={backendStatus} />
          <BrandSwitcher
            brands={brands}
            activeBrandId={activeBrandId}
            onSelect={onSelect}
            onAdd={onAdd}
            onDelete={onDelete}
          />
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-xs text-slate-500 transition hover:text-violet-400 sm:block"
          >
            API ↗
          </a>
        </div>
      </div>

      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 pb-3 md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition ${
                active
                  ? "bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-violet-200"
                  : "text-slate-400 hover:text-violet-300"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

const STATUS_META = {
  online: {
    color: "bg-emerald-400 shadow-emerald-400/60",
    label: "Backend online",
  },
  booting: {
    color: "bg-amber-400 shadow-amber-400/60 animate-pulse",
    label: "Backend lagi cold-start — tunggu ~10 detik",
  },
  offline: {
    color: "bg-red-500 shadow-red-500/60 animate-pulse",
    label: "Backend offline — start uvicorn di port 8000",
  },
  unknown: {
    color: "bg-slate-500 shadow-slate-500/40",
    label: "Mengecek koneksi backend...",
  },
};

function StatusDot({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      className={`inline-block h-2 w-2 rounded-full shadow-md ${meta.color}`}
    />
  );
}

function BackendBootingBanner() {
  return (
    <div className="border-b border-amber-900/50 bg-gradient-to-r from-amber-950/40 via-emerald-950/30 to-amber-950/40 px-4 py-2 text-center text-xs text-amber-200 sm:px-6">
      <span className="mr-1 inline-block animate-spin">🔄</span>
      <span className="font-semibold">Booting AI…</span>{" "}
      <span className="text-amber-300/80">
        Backend HF lagi bangun container, biasanya ~10 detik. Auto-retry on.
      </span>
    </div>
  );
}

function BackendOfflineBanner() {
  const isProd = !/(localhost|127\.0\.0\.1)/.test(API_URL);
  return (
    <div className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-center text-xs text-red-300 sm:px-6">
      <span className="font-semibold">Server HELIX tidak merespons.</span>{" "}
      {isProd ? (
        <>
          Backend{" "}
          <code className="rounded bg-red-950/60 px-1.5 py-0.5 text-red-200">
            {API_URL}
          </code>{" "}
          mungkin sedang restart atau kena cold start — coba refresh dalam 30
          detik.
        </>
      ) : (
        <>
          Pastikan backend jalan:{" "}
          <code className="rounded bg-red-950/60 px-1.5 py-0.5 text-red-200">
            uvicorn src.api.main:app --port 8000
          </code>
        </>
      )}
    </div>
  );
}
