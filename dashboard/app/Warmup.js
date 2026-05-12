"use client";

import { useEffect } from "react";
import { API_URL } from "./api-client";

// Fire-and-forget warmup ping di root layout. Goal: wake HF Space container
// se-awal mungkin di page load, sebelum user klik Chat/Studio. Kalau Space
// cold (idle), GET / start container boot. Berikutnya brand list / chat udah
// hit container yang warm.
//
// Multiple parallel ping ke endpoint berbeda biar lebih banyak handler ke-warm
// di FastAPI worker (import expertise files, brand configs, Groq client).
export function Warmup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip warmup kalau backend localhost (dev) — gak ada cold-start
    if (/(localhost|127\.0\.0\.1)/.test(API_URL)) return;

    const endpoints = ["/", "/expertise", "/brands"];
    for (const path of endpoints) {
      fetch(`${API_URL}${path}`, {
        method: "GET",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {
        // Silent fail — useBackendStatus akan handle UI state
      });
    }
  }, []);

  return null;
}
