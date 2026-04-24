"use client";

import { useCallback, useEffect, useState } from "react";

const MAX_ENTRIES = 10;

function storageKey(tool, brandId) {
  return `helix.studio.history.${tool}.${brandId}`;
}

function readHistory(tool, brandId) {
  if (typeof window === "undefined" || !brandId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tool, brandId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(tool, brandId, entries) {
  if (typeof window === "undefined" || !brandId) return;
  try {
    window.localStorage.setItem(
      storageKey(tool, brandId),
      JSON.stringify(entries.slice(0, MAX_ENTRIES))
    );
  } catch {}
}

export function useStudioHistory(tool, brandId) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    setEntries(readHistory(tool, brandId));
  }, [tool, brandId]);

  const save = useCallback(
    (input, output) => {
      if (!brandId) return;
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        input,
        output,
      };
      setEntries((prev) => {
        const next = [entry, ...prev].slice(0, MAX_ENTRIES);
        writeHistory(tool, brandId, next);
        return next;
      });
    },
    [tool, brandId]
  );

  const remove = useCallback(
    (id) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        writeHistory(tool, brandId, next);
        return next;
      });
    },
    [tool, brandId]
  );

  const clear = useCallback(() => {
    setEntries([]);
    writeHistory(tool, brandId, []);
  }, [tool, brandId]);

  return { entries, save, remove, clear };
}

export function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}
