"use client";

import { useEffect, useRef, useState } from "react";
import { pingBackend } from "./api-client";

const POLL_INTERVAL = 15000; // 15s
const POLL_INTERVAL_DOWN = 4000; // poll lebih sering kalau lagi down

export function useBackendStatus() {
  const [status, setStatus] = useState("unknown"); // "online" | "offline" | "unknown"
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let timeoutId;

    async function check() {
      const ok = await pingBackend();
      if (!aliveRef.current) return;
      setStatus((prev) => {
        const next = ok ? "online" : "offline";
        // schedule next check sesuai status
        timeoutId = setTimeout(
          check,
          ok ? POLL_INTERVAL : POLL_INTERVAL_DOWN
        );
        return next;
      });
    }

    check();
    return () => {
      aliveRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return status;
}
