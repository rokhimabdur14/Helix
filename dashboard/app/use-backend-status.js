"use client";

import { useEffect, useRef, useState } from "react";
import { pingBackend } from "./api-client";

const POLL_INTERVAL = 15000; // 15s saat online
const POLL_INTERVAL_BOOTING = 3000; // 3s saat booting — biar UI cepet flip ke online begitu siap
const POLL_INTERVAL_DOWN = 4000; // poll lebih sering kalau lagi down

export function useBackendStatus() {
  const [status, setStatus] = useState("unknown"); // "online" | "booting" | "offline" | "unknown"
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let timeoutId;

    async function check() {
      const next = await pingBackend(); // "online" | "booting" | "offline"
      if (!aliveRef.current) return;
      setStatus(next);
      const delay =
        next === "online"
          ? POLL_INTERVAL
          : next === "booting"
          ? POLL_INTERVAL_BOOTING
          : POLL_INTERVAL_DOWN;
      timeoutId = setTimeout(check, delay);
    }

    check();
    return () => {
      aliveRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return status;
}
