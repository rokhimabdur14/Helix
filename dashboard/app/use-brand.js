"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import { useBackendStatus } from "./use-backend-status";

const STORAGE_KEY = "helix.activeBrandId";

// Featured brand: brand pertama yang dipilih saat user baru pertama buka HELIX
// (localStorage kosong). Pilih fotofusi karena: punya 16-page scrape paling
// lengkap, expertise+brand profile paling enriched, content bank ready buat
// demo end-to-end. Backend return alfabetis (arabi first), tanpa override ini
// fresh visitor landing di arabi.
const FEATURED_BRAND_ID = "fotofusi";

export function useBrand() {
  const [brands, setBrands] = useState([]);
  const [activeBrandId, setActiveBrandId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listBrands();
      setBrands(data.brands || []);
      return data.brands || [];
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + restore selection from localStorage
  useEffect(() => {
    (async () => {
      const list = await refresh();
      const saved =
        typeof window !== "undefined"
          ? window.localStorage.getItem(STORAGE_KEY)
          : null;
      const found = saved && list.find((b) => b.brand_id === saved);
      const featured = list.find((b) => b.brand_id === FEATURED_BRAND_ID);
      const pick = found
        ? saved
        : featured
        ? FEATURED_BRAND_ID
        : list[0]?.brand_id || null;
      setActiveBrandId(pick);
    })();
  }, [refresh]);

  // Auto re-load brands saat backend transisi ke "online" dari state apapun
  // yang bukan online (offline/booting/unknown). Krn cold-start awal user landing,
  // brand list fetch awal 502 → brands=[]; tanpa retry user stuck.
  const backendStatus = useBackendStatus();
  const prevStatusRef = useRef(backendStatus);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = backendStatus;
    if (backendStatus === "online" && prev !== "online" && prev !== "unknown") {
      (async () => {
        const list = await refresh();
        if (!activeBrandId && list.length > 0) {
          const featured = list.find((b) => b.brand_id === FEATURED_BRAND_ID);
          setActiveBrandId(featured ? FEATURED_BRAND_ID : list[0].brand_id);
        }
      })();
    }
  }, [backendStatus, refresh, activeBrandId]);

  // Auto-poll selama ada brand yang scrape_status="pending".
  // Stop polling begitu semua ready/failed → no wasted requests.
  const hasPending = brands.some((b) => b.scrape_status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => {
      refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [hasPending, refresh]);

  const selectBrand = useCallback((brandId) => {
    setActiveBrandId(brandId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, brandId);
    }
  }, []);

  const createBrand = useCallback(
    async (payload) => {
      const result = await api.createBrand(payload);
      await refresh();
      selectBrand(result.brand_id);
      return result;
    },
    [refresh, selectBrand]
  );

  const deleteBrand = useCallback(
    async (brandId) => {
      await api.deleteBrand(brandId);
      const remaining = await refresh();
      if (activeBrandId === brandId) {
        selectBrand(remaining[0]?.brand_id || null);
      }
    },
    [refresh, selectBrand, activeBrandId]
  );

  const activeBrand = brands.find((b) => b.brand_id === activeBrandId) || null;

  return {
    brands,
    activeBrand,
    activeBrandId,
    loading,
    error,
    selectBrand,
    createBrand,
    deleteBrand,
    refresh,
  };
}
