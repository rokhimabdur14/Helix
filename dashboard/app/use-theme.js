"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "helix.theme";
const VALID = ["dark", "light", "system"];

function readStored() {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return VALID.includes(v) ? v : "system";
  } catch {
    return "system";
  }
}

function resolveSystem() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function useTheme() {
  // Mode = user choice (dark | light | system). Resolved = actual applied
  // (dark | light) — di system mode resolved follow OS preference live.
  const [mode, setMode] = useState("system");
  const [resolved, setResolved] = useState("dark");

  // Initial sync setelah mount (server render gak punya akses ke localStorage)
  useEffect(() => {
    const stored = readStored();
    setMode(stored);
    const r = stored === "system" ? resolveSystem() : stored;
    setResolved(r);
    document.documentElement.setAttribute("data-theme", r);
  }, []);

  // Listen ke OS preference change kalau lagi di system mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const r = mq.matches ? "light" : "dark";
      setResolved(r);
      document.documentElement.setAttribute("data-theme", r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setTheme = useCallback((next) => {
    if (!VALID.includes(next)) return;
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    const r = next === "system" ? resolveSystem() : next;
    setResolved(r);
    document.documentElement.setAttribute("data-theme", r);
  }, []);

  return { mode, resolved, setTheme };
}
