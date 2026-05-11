"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WelcomeIntro } from "./WelcomeIntro";

const FEATURES = [
  {
    href: "/",
    icon: "💬",
    title: "Chat",
    desc: "Tanya jawab dengan AI strategist yang hafal brand kamu — atau Free Chat tanpa brand context.",
    accent: "from-violet-500/30 to-blue-500/20",
  },
  {
    href: "/studio",
    icon: "🎨",
    title: "Studio",
    desc: "Generate content brief lengkap: hook, caption, carousel, plan mingguan. 4-format reel/foto/carousel/story.",
    accent: "from-fuchsia-500/30 to-violet-500/20",
  },
  {
    href: "/analysis",
    icon: "🔍",
    title: "Analysis",
    desc: "Analisa kenapa konten ramai/sepi. Upload screenshot Insights, paste URL post, atau scan profile.",
    accent: "from-blue-500/30 to-cyan-500/20",
  },
  {
    href: "/studio?tab=references",
    icon: "📚",
    title: "References",
    desc: "Library pattern viral. Snapshot profile + post URL untuk inspirasi visual + copywriting.",
    accent: "from-emerald-500/30 to-teal-500/20",
  },
];

// Auto-redirect ke dashboard kalau user diam — kasih waktu untuk lihat hero
// + intro + tagline, baru fade out + push ke target.
const AUTO_REDIRECT_DELAY_MS = 3500; // setelah intro complete
const FADE_OUT_MS = 700;

export default function WelcomePage() {
  const router = useRouter();
  const [introDone, setIntroDone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const autoTimerRef = useRef(null);
  const userInteractedRef = useRef(false);

  // Prefetch target supaya redirect smooth tanpa flash blank
  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/studio");
    router.prefetch("/analysis");
  }, [router]);

  // Auto-redirect ke / setelah intro selesai, kecuali user udah klik card
  useEffect(() => {
    if (!introDone || userInteractedRef.current) return;
    autoTimerRef.current = setTimeout(() => {
      if (!userInteractedRef.current) {
        smoothTransition("/");
      }
    }, AUTO_REDIRECT_DELAY_MS);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [introDone]);

  function smoothTransition(href) {
    if (exiting) return;
    userInteractedRef.current = true;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setExiting(true);
    // Wait for fade-out, then navigate
    setTimeout(() => {
      router.push(href);
    }, FADE_OUT_MS);
  }

  return (
    <div
      className={`welcome-page-wrap relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12 ${
        exiting ? "is-exiting" : ""
      }`}
    >
      <main className="mx-auto w-full max-w-5xl">
        {/* Hero — phoenix animation */}
        <div className="welcome-hero-aura mb-8 sm:mb-12">
          <WelcomeIntro onComplete={() => setIntroDone(true)} />
        </div>

        {/* Tagline below animation */}
        <div
          className={`mb-10 text-center transition-all duration-700 ${
            introDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h1 className="wordmark font-display text-4xl font-extrabold sm:text-5xl">
            HELIX AI
          </h1>
          <p className="mt-3 text-base text-slate-400 sm:text-lg">
            <span className="text-violet-300">The DNA of your brand,</span>{" "}
            decoded.
          </p>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            AI Social Media Strategist · oleh Akselera Tech
          </p>
        </div>

        {/* Feature cards */}
        <div
          className={`transition-all duration-700 ${
            introDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
            ✨ Pilih fitur untuk mulai
            {introDone && (
              <span className="ml-2 text-slate-600 normal-case">
                · auto-redirect ke Chat dalam {(AUTO_REDIRECT_DELAY_MS / 1000).toFixed(0)}s
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Link
                key={f.href}
                href={f.href}
                onClick={(e) => {
                  e.preventDefault();
                  smoothTransition(f.href);
                }}
                className="welcome-feature-card stagger-in rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 backdrop-blur hover:border-violet-500/40"
                style={{ "--stagger-i": i }}
              >
                <div
                  className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-2xl`}
                >
                  {f.icon}
                </div>
                <h3 className="mb-1 text-base font-semibold text-slate-100">
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {f.desc}
                </p>
                <div className="mt-4 text-[11px] font-semibold text-violet-300">
                  Masuk →
                </div>
              </Link>
            ))}
          </div>

          {/* Footer micro stats */}
          <div className="mt-10 text-center">
            <p className="text-[11px] text-slate-600">
              13+ brand · Vision AI multimodal · Live trend ingestion ·
              Multi-tenant ready
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
