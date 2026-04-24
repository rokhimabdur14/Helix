"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import { useBackendStatus } from "./use-backend-status";

const STORAGE_KEY = "helix.activeBrandId";

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
      const pick = found ? saved : list[0]?.brand_id || null;
      setActiveBrandId(pick);
    })();
  }, [refresh]);

  // Auto re-load brands saat backend transisi offline → online
  // (handle case: user buka page saat backend mati, lalu user nyalain backend)
  const backendStatus = useBackendStatus();
  const prevStatusRef = useRef(backendStatus);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = backendStatus;
    if (backendStatus === "online" && prev === "offline") {
      // backend baru hidup lagi — retry brand load
      (async () => {
        const list = await refresh();
        if (!activeBrandId && list.length > 0) {
          setActiveBrandId(list[0].brand_id);
        }
      })();
    }
  }, [backendStatus, refresh, activeBrandId]);

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
