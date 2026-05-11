"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * 3-stage phoenix → HELIX logo transformation.
 *
 * Stage 0 (0.0-2.4s):  Phoenix wings wide-spread (dramatic intro)
 * Stage 1 (2.4-4.8s):  Phoenix folded/elegant (settling)
 * Stage 2 (4.8s+):     HELIX AI logo (final state, stays)
 *
 * Setiap stage crossfade halus 600ms. Scale + rotate subtle untuk
 * tambah dimensi cinematic. Hero animation lock width 100% supaya
 * responsive di mobile dan desktop.
 */

const FRAMES = [
  {
    src: "/brand/phoenix-1-wings-wide.jpg",
    alt: "Phoenix wings spread",
    initialScale: 1.15,
    finalScale: 1.0,
    rotate: "-2deg",
    duration: 2400,
  },
  {
    src: "/brand/phoenix-2-folded.jpg",
    alt: "Phoenix folded elegant",
    initialScale: 1.05,
    finalScale: 1.0,
    rotate: "1deg",
    duration: 2400,
  },
  {
    src: "/brand/phoenix-3-logo.jpg",
    alt: "HELIX AI logo",
    initialScale: 0.95,
    finalScale: 1.0,
    rotate: "0deg",
    duration: 0, // stay on this frame
  },
];

const CROSSFADE_MS = 600;

export function WelcomeIntro({ onComplete }) {
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const frame = FRAMES[stage];
    if (!frame || frame.duration === 0) {
      // Final stage — call onComplete and stop
      setDone(true);
      onComplete?.();
      return;
    }
    const timer = setTimeout(() => {
      setStage((s) => Math.min(s + 1, FRAMES.length - 1));
    }, frame.duration);
    return () => clearTimeout(timer);
  }, [stage, done, onComplete]);

  return (
    <div className="welcome-intro-wrap">
      {FRAMES.map((f, i) => (
        <div
          key={f.src}
          className={`welcome-intro-frame ${i === stage ? "is-active" : ""} ${
            i < stage ? "is-past" : ""
          }`}
          style={{
            "--initial-scale": f.initialScale,
            "--final-scale": f.finalScale,
            "--rotate": f.rotate,
          }}
        >
          <Image
            src={f.src}
            alt={f.alt}
            width={800}
            height={800}
            priority={i === 0}
            className="welcome-intro-img"
          />
        </div>
      ))}

      {/* Skip button — muncul setelah stage 0 mulai */}
      {!done && (
        <button
          type="button"
          onClick={() => {
            setDone(true);
            setStage(FRAMES.length - 1);
            onComplete?.();
          }}
          className="welcome-intro-skip"
          aria-label="Skip intro animation"
        >
          Skip intro →
        </button>
      )}
    </div>
  );
}
