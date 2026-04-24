"use client";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Custom error type biar UI bisa beda-in: server unreachable vs HTTP error.
export class ApiNetworkError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ApiNetworkError";
    this.cause = cause;
  }
}

async function rawFetch(path, options) {
  return fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
}

export async function apiFetch(path, options = {}) {
  // Retry sekali kalau network error — backend mungkin baru hidup / cold start.
  let res;
  try {
    res = await rawFetch(path, options);
  } catch (e) {
    // fetch melempar TypeError saat connection refused / DNS fail / CORS preflight gagal
    await new Promise((r) => setTimeout(r, 400));
    try {
      res = await rawFetch(path, options);
    } catch (e2) {
      throw new ApiNetworkError(
        `Server HELIX tidak merespons di ${API_URL}. Pastikan backend FastAPI sudah running (uvicorn src.api.main:app --port 8000).`,
        e2
      );
    }
  }

  if (!res.ok) {
    let detail;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      detail = await res.text();
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Lightweight ping untuk health check — dipakai status indicator di header.
export async function pingBackend() {
  try {
    const res = await fetch(`${API_URL}/`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export const api = {
  listBrands: () => apiFetch("/brands"),
  listExpertise: () => apiFetch("/expertise"),
  createBrand: (body) =>
    apiFetch("/brands", { method: "POST", body: JSON.stringify(body) }),
  deleteBrand: (brandId) =>
    apiFetch(`/brands/${brandId}`, { method: "DELETE" }),
  getInsights: (brandId) => apiFetch(`/brands/${brandId}/insights`),
  chat: (brandId, history, message) =>
    apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({ brand_id: brandId, history, message }),
    }),
  studio: {
    hook: (brandId, { topic, format_type, count }) =>
      apiFetch("/studio/hook", {
        method: "POST",
        body: JSON.stringify({
          brand_id: brandId,
          topic,
          format_type,
          count,
        }),
      }),
    caption: (brandId, { post_context, goal, length }) =>
      apiFetch("/studio/caption", {
        method: "POST",
        body: JSON.stringify({
          brand_id: brandId,
          post_context,
          goal,
          length,
        }),
      }),
    carousel: (brandId, { topic, num_slides, goal }) =>
      apiFetch("/studio/carousel", {
        method: "POST",
        body: JSON.stringify({
          brand_id: brandId,
          topic,
          num_slides,
          goal,
        }),
      }),
    plan: (brandId, { period, posts_per_week, start_date, goals }) =>
      apiFetch("/studio/plan", {
        method: "POST",
        body: JSON.stringify({
          brand_id: brandId,
          period,
          posts_per_week,
          start_date: start_date || null,
          goals: goals && goals.length > 0 ? goals : null,
        }),
      }),
  },
};
