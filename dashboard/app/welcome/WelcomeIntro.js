"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Phoenix bertengger gagah dengan wing-flap loop + ember particles.
 *
 * Pakai 2 frame existing (wings-wide ↔ folded) di-crossfade slow majestic.
 * Tidak ada timed stage progression — flap loop terus jalan sampai scroll
 * mengambil alih (lihat welcome/page.js untuk ScrollTrigger transformation).
 */

const FLAP_INTERVAL_MS = 1400; // satu kepakan = 2.8s round-trip (slow regal)

export function WelcomeIntro({ flapRef, emberRef }) {
  const wingsWideRef = useRef(null);
  const foldedRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  // Wing-flap crossfade loop
  useEffect(() => {
    let stage = 0;
    const tick = () => {
      stage = 1 - stage;
      if (wingsWideRef.current && foldedRef.current) {
        wingsWideRef.current.style.opacity = stage === 0 ? "1" : "0";
        foldedRef.current.style.opacity = stage === 1 ? "1" : "0";
      }
      if (wrapRef.current) {
        // sync body bob: wings-wide = body lifts up, folded = settles down
        wrapRef.current.style.setProperty(
          "--phoenix-bob",
          stage === 0 ? "-6px" : "4px"
        );
      }
    };
    // Initial sync
    if (wingsWideRef.current) wingsWideRef.current.style.opacity = "1";
    if (foldedRef.current) foldedRef.current.style.opacity = "0";
    const id = setInterval(tick, FLAP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Canvas ember particles rising from below — synced with flap glow
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pool of embers
    const NUM = 38;
    const embers = Array.from({ length: NUM }, () => spawn(true));

    function spawn(initial) {
      const w = canvas.clientWidth || 400;
      const h = canvas.clientHeight || 400;
      return {
        x: w * (0.2 + Math.random() * 0.6),
        y: initial ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.4 - Math.random() * 0.8,
        r: 1 + Math.random() * 2.2,
        life: 0,
        maxLife: 90 + Math.random() * 80,
        hue: 18 + Math.random() * 22, // warm orange-yellow
        flicker: Math.random() * Math.PI * 2,
      };
    }

    function frame() {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.x += e.vx;
        e.y += e.vy;
        e.vy -= 0.003; // slight buoyancy
        e.vx += Math.sin((e.life + e.flicker) * 0.1) * 0.02; // gentle drift
        e.life += 1;

        const t = e.life / e.maxLife;
        const alpha = Math.max(0, (1 - t) * 0.85);
        const flick = 0.7 + 0.3 * Math.sin(e.life * 0.4 + e.flicker);
        const r = e.r * (1 + t * 0.6);

        const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 6);
        grd.addColorStop(0, `hsla(${e.hue}, 100%, 70%, ${alpha * flick})`);
        grd.addColorStop(0.4, `hsla(${e.hue}, 100%, 55%, ${alpha * 0.4})`);
        grd.addColorStop(1, `hsla(${e.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        if (e.life >= e.maxLife || e.y < -20) {
          embers[i] = spawn(false);
        }
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Expose imperative refs so parent (page.js) can drive ScrollTrigger on these layers
  useEffect(() => {
    if (flapRef) flapRef.current = wrapRef.current;
    if (emberRef) emberRef.current = canvasRef.current;
  }, [flapRef, emberRef]);

  return (
    <div ref={wrapRef} className="welcome-intro-wrap phoenix-perch">
      {/* Glow pedestal behind phoenix */}
      <div className="phoenix-aura" aria-hidden />

      {/* Two flap frames stacked, crossfade ping-pong */}
      <div ref={wingsWideRef} className="welcome-intro-frame flap-frame">
        <Image
          src="/brand/phoenix-1-wings-wide.jpg"
          alt="Phoenix wings spread"
          width={800}
          height={800}
          priority
          className="welcome-intro-img"
        />
      </div>
      <div ref={foldedRef} className="welcome-intro-frame flap-frame">
        <Image
          src="/brand/phoenix-2-folded.jpg"
          alt="Phoenix folded elegant"
          width={800}
          height={800}
          className="welcome-intro-img"
        />
      </div>

      {/* Ember particle canvas overlay */}
      <canvas
        ref={canvasRef}
        className="phoenix-ember-canvas"
        aria-hidden
      />
    </div>
  );
}
