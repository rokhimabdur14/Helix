"use client";

import Image from "next/image";
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

const FADE_OUT_MS = 700;

export default function WelcomePage() {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const stageRef = useRef(null); // tall scroll container
  const pinRef = useRef(null); // pinned viewport-sized hero
  const phoenixWrapRef = useRef(null); // entire phoenix scene
  const emberCanvasRef = useRef(null);
  const logoMarkRef = useRef(null); // helix-mark.png (revealed at scrub)
  const wordmarkRef = useRef(null); // "HELIX AI" text
  const taglineRef = useRef(null);
  const sublineRef = useRef(null);
  const scrollHintRef = useRef(null);
  const cardsRef = useRef(null);

  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/studio");
    router.prefetch("/analysis");
  }, [router]);

  // GSAP ScrollTrigger transformation
  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (prefersReducedMotion) {
        // Skip scrub on reduced motion — keep phoenix idle, show cards naturally
        return;
      }

      const ctx = gsap.context(() => {
        // Initial state — phoenix big, logo hidden, wordmark hidden
        gsap.set(logoMarkRef.current, {
          opacity: 0,
          scale: 0.4,
          y: 30,
        });
        gsap.set(wordmarkRef.current, {
          opacity: 0,
          y: 40,
          scale: 0.9,
          letterSpacing: "0.4em",
        });
        gsap.set([taglineRef.current, sublineRef.current], {
          opacity: 0,
          y: 20,
        });

        // Master scroll-scrub timeline
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: stageRef.current,
            start: "top top",
            end: "+=160%", // 1.6 viewport heights of scrub
            scrub: 0.6,
            pin: pinRef.current,
            pinSpacing: true,
            anticipatePin: 1,
          },
        });

        // Phase A (0-50%): phoenix shrinks + moves up + fades
        tl.to(
          phoenixWrapRef.current,
          {
            scale: 0.45,
            y: -120,
            opacity: 0,
            filter: "blur(2px)",
            ease: "power2.in",
          },
          0
        );
        tl.to(
          emberCanvasRef.current,
          { opacity: 0.25, ease: "none" },
          0
        );
        tl.to(
          scrollHintRef.current,
          { opacity: 0, y: 10, duration: 0.2, ease: "power1.out" },
          0
        );

        // Phase B (40-75%): helix-mark logo rises + wordmark expands
        tl.to(
          logoMarkRef.current,
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.4,
            ease: "power3.out",
          },
          0.4
        );
        tl.to(
          wordmarkRef.current,
          {
            opacity: 1,
            scale: 1,
            y: 0,
            letterSpacing: "0.12em",
            duration: 0.45,
            ease: "power3.out",
          },
          0.45
        );

        // Phase C (75-100%): tagline + subline pop
        tl.to(
          taglineRef.current,
          { opacity: 1, y: 0, duration: 0.3 },
          0.75
        );
        tl.to(
          sublineRef.current,
          { opacity: 1, y: 0, duration: 0.3 },
          0.85
        );
      }, stageRef);

      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  function smoothTransition(href) {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => router.push(href), FADE_OUT_MS);
  }

  return (
    <div
      ref={stageRef}
      className={`welcome-stage relative ${exiting ? "is-exiting" : ""}`}
    >
      {/* Pinned hero section — phoenix transforms into logo while user scrolls */}
      <section ref={pinRef} className="welcome-pin">
        <div className="welcome-pin-inner">
          {/* Phoenix scene (flap loop + embers) — shrinks/fades on scroll */}
          <div ref={phoenixWrapRef} className="phoenix-stage">
            <WelcomeIntro emberRef={emberCanvasRef} />
          </div>

          {/* Helix mark — appears as phoenix shrinks */}
          <div ref={logoMarkRef} className="welcome-logo-mark">
            <Image
              src="/brand/helix-mark.png"
              alt="HELIX mark"
              width={160}
              height={160}
              priority
            />
          </div>

          {/* Wordmark + tagline (revealed at end of scrub) */}
          <h1 ref={wordmarkRef} className="welcome-wordmark wordmark font-display">
            HELIX AI
          </h1>
          <p ref={taglineRef} className="welcome-tagline">
            <span className="text-violet-300">The DNA of your brand,</span> decoded.
          </p>
          <p ref={sublineRef} className="welcome-subline">
            AI Social Media Strategist · oleh Akselera Tech
          </p>

          {/* Scroll hint — fades on scroll */}
          <div ref={scrollHintRef} className="welcome-scroll-hint" aria-hidden>
            <span className="scroll-label">Scroll untuk masuk</span>
            <span className="scroll-chevron">⌄</span>
          </div>
        </div>
      </section>

      {/* Feature cards — revealed after pin ends */}
      <section ref={cardsRef} className="welcome-cards-section">
        <div className="mx-auto w-full max-w-5xl px-4 py-12">
          <h2 className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
            ✨ Pilih fitur untuk mulai
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
          <div className="mt-10 text-center">
            <p className="text-[11px] text-slate-600">
              13+ brand · Vision AI multimodal · Live trend ingestion ·
              Multi-tenant ready
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
