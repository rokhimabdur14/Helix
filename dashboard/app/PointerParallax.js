"use client";

import { useEffect } from "react";

/**
 * Tracks mouse position and writes --mx / --my CSS vars (-1..1 range)
 * di document root. Background orbs di globals.css bisa baca var ini
 * untuk gerakan halus mengikuti kursor (parallax).
 */
export function PointerParallax() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;

    function onMove(e) {
      // Normalize: -1 (left/top) → 1 (right/bottom)
      pendingX = (e.clientX / window.innerWidth) * 2 - 1;
      pendingY = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) {
        raf = requestAnimationFrame(flush);
      }
    }

    function flush() {
      raf = 0;
      document.documentElement.style.setProperty("--mx", pendingX.toFixed(3));
      document.documentElement.style.setProperty("--my", pendingY.toFixed(3));
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
