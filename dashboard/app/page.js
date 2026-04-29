"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AddBrandModal } from "./AddBrandModal";
import { api, API_URL } from "./api-client";
import { AppHeader } from "./AppHeader";
import { useBrand } from "./use-brand";

export default function ChatPage() {
  const {
    brands,
    activeBrand,
    activeBrandId,
    loading: brandsLoading,
    error: brandsError,
    selectBrand,
    createBrand,
    deleteBrand,
  } = useBrand();

  const [addOpen, setAddOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // mode: "brand" (pakai context brand aktif) | "free" (HELIX expertise saja, no brand)
  const [mode, setMode] = useState("brand");
  const messagesEndRef = useRef(null);

  // Reset chat history kalau switch brand atau switch mode
  useEffect(() => {
    setHistory([]);
    setError("");
  }, [activeBrandId, mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  // Free mode: nggak butuh brand. Brand mode: butuh activeBrandId.
  const canSend = mode === "free" || !!activeBrandId;

  async function sendMessage() {
    const message = input.trim();
    if (!message || loading || !canSend) return;

    setInput("");
    setError("");
    setLoading(true);

    const prevHistory = history;
    // Append user message immediately. Assistant bubble di-append nanti pas
    // chunk pertama dateng — gini LoadingBubble bisa show selama waiting TTFB,
    // dan auto-hide saat bubble jawaban muncul.
    setHistory([...prevHistory, { role: "user", content: message }]);

    const brandIdForRequest = mode === "free" ? null : activeBrandId;
    let accumulated = "";
    let assistantAppended = false;

    try {
      await api.chatStream(brandIdForRequest, prevHistory, message, {
        onChunk: (text) => {
          accumulated += text;
          setHistory((curr) => {
            if (!assistantAppended) {
              assistantAppended = true;
              return [...curr, { role: "assistant", content: accumulated }];
            }
            const copy = curr.slice();
            copy[copy.length - 1] = {
              role: "assistant",
              content: accumulated,
            };
            return copy;
          });
        },
      });
      // Edge case: stream selesai tanpa chunk (model balas empty string).
      // Tetap append empty assistant biar history konsisten.
      if (!assistantAppended) {
        setHistory((curr) => [...curr, { role: "assistant", content: "" }]);
      }
    } catch (err) {
      setError(err.message || "Gagal menghubungi server");
      // Rollback: balik ke history sebelum user message kalau gagal sama sekali.
      // Kalau partial response sudah masuk, user bisa re-send konteks lengkap.
      setHistory(prevHistory);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="relative z-10 flex h-screen flex-col">
      <AppHeader
        brands={brands}
        activeBrandId={activeBrandId}
        onSelect={selectBrand}
        onAdd={() => setAddOpen(true)}
        onDelete={deleteBrand}
      />

      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <ModeToggle mode={mode} onChange={setMode} />

          {brandsLoading && mode === "brand" && (
            <div className="mt-20 text-center text-slate-500">
              <p className="text-sm">Loading brands...</p>
            </div>
          )}

          {brandsError && mode === "brand" && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              Gagal load brands: {brandsError}. Pastikan API server jalan di{" "}
              <code className="text-red-200">{API_URL}</code>.
            </div>
          )}

          {mode === "brand" &&
            !brandsLoading &&
            !brandsError &&
            brands.length === 0 && (
              <NoBrandsState
                onAdd={() => setAddOpen(true)}
                onTryFree={() => setMode("free")}
              />
            )}

          {mode === "brand" &&
            !brandsLoading &&
            activeBrand &&
            history.length === 0 &&
            !loading && (
              <EmptyState brand={activeBrand} onPick={setInput} />
            )}

          {mode === "free" && history.length === 0 && !loading && (
            <FreeEmptyState onPick={setInput} />
          )}

          {history.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} />
          ))}

          {/* Loading dots hanya selama waiting first chunk — begitu assistant
              bubble muncul (last role = assistant), bubble itu sendiri yang
              jadi indicator "lagi nulis". */}
          {loading &&
            (history.length === 0 ||
              history[history.length - 1].role !== "assistant") && (
              <LoadingBubble />
            )}

          {error && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300 backdrop-blur">
              Error: {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-slate-800/60 bg-slate-950/40 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                mode === "free"
                  ? "Tanya apa saja tentang strategi sosmed..."
                  : activeBrandId
                  ? `Tanya strategi sosmed untuk ${activeBrand?.brand_name}...`
                  : "Pilih brand dulu (atau switch ke Free Chat)..."
              }
              rows={1}
              disabled={loading || !canSend}
              className="input-glow flex-1 resize-none rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none transition disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading || !canSend}
              className="btn-primary rounded-xl px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Kirim
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-600">
            Enter untuk kirim · Shift+Enter untuk baris baru
          </p>
        </div>
      </footer>

      <AddBrandModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={createBrand}
      />
    </div>
  );
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="mx-auto flex w-fit items-center gap-1 rounded-xl border border-slate-800/60 bg-slate-900/40 p-1 backdrop-blur">
      <ModeButton
        active={mode === "brand"}
        onClick={() => onChange("brand")}
        label="Brand Chat"
        sub="dengan context brand"
      />
      <ModeButton
        active={mode === "free"}
        onClick={() => onChange("free")}
        label="Free Chat"
        sub="tanpa input brand"
      />
    </div>
  );
}

function ModeButton({ active, onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-left transition ${
        active
          ? "bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-violet-100 shadow-inner shadow-violet-900/30"
          : "text-slate-400 hover:text-violet-300"
      }`}
    >
      <div className="text-sm font-semibold">{label}</div>
      <div
        className={`text-[10px] ${
          active ? "text-violet-300/80" : "text-slate-600"
        }`}
      >
        {sub}
      </div>
    </button>
  );
}

function FreeEmptyState({ onPick }) {
  const samples = [
    "3 metric paling penting algoritma TikTok 2026 — yang nentuin FYP push",
    "Hook 3 detik untuk reel B2B SaaS launch — 3 pattern berbeda",
    "Playbook naikin watch time Reels dari 30% ke 70% — step by step",
    "Strategi 4 minggu pertama akun coffee shop dari nol — pillar + format",
  ];
  return (
    <div className="mt-12 text-center">
      <Image
        src="/brand/helix-mark.png"
        alt="HELIX"
        width={72}
        height={72}
        className="logo-pulse mx-auto mb-6"
        priority
      />
      <h2 className="wordmark font-display mb-2 text-2xl font-bold uppercase md:text-3xl">
        HELIX Free Chat
      </h2>
      <p className="mb-2 text-sm text-slate-400">
        Tanya apa saja soal strategi sosmed.
      </p>
      <p className="mb-8 text-xs text-slate-500">
        Powered by HELIX expertise (TikTok algorithm + growth tactics).
        Untuk saran spesifik brand-mu, switch ke{" "}
        <span className="text-violet-300">Brand Chat</span>.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {samples.map((sample) => (
          <button
            key={sample}
            onClick={() => onPick(sample)}
            className="rounded-full border border-slate-800 bg-slate-900/50 px-4 py-2 text-xs text-slate-300 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-200 hover:shadow-lg hover:shadow-violet-500/10"
          >
            {sample}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoBrandsState({ onAdd, onTryFree }) {
  return (
    <div className="mt-20 text-center">
      <Image
        src="/brand/helix-mark.png"
        alt="HELIX"
        width={72}
        height={72}
        className="logo-pulse mx-auto mb-6"
        priority
      />
      <h2 className="wordmark font-display mb-2 text-3xl font-bold">
        Welcome to HELIX
      </h2>
      <p className="mb-6 text-sm text-slate-500">
        Tambahkan brand pertama untuk Brand Chat, atau coba{" "}
        <button
          onClick={onTryFree}
          className="text-violet-300 underline-offset-2 hover:underline"
        >
          Free Chat
        </button>{" "}
        dulu tanpa setup.
      </p>
      <button
        onClick={onAdd}
        className="btn-primary rounded-lg px-6 py-2.5 text-sm font-semibold text-white"
      >
        + Tambah brand
      </button>
    </div>
  );
}

function EmptyState({ brand, onPick }) {
  const samples = [
    "Post mana yang paling sukses bulan ini, dan kenapa polanya menang?",
    "3 ide reel untuk pillar yang punya footage real, lengkap dengan hook",
    "Jam posting paling worth it berdasarkan engagement rate per hour",
    "Pillar mana paling under-utilized vs potential ROI? Kasih saran ramp-up",
  ];

  return (
    <div className="mt-16 text-center">
      <Image
        src="/brand/helix-mark.png"
        alt="HELIX"
        width={72}
        height={72}
        className="logo-pulse mx-auto mb-6"
        priority
      />
      <h2 className="wordmark font-display mb-3 text-2xl font-bold uppercase md:text-3xl">
        DNA of {brand.brand_name}, decoded
      </h2>
      <p className="mb-8 text-sm text-slate-500">
        Saya sudah baca website & data{" "}
        <span className="text-violet-300">{brand.brand_name}</span>. Tanya apa
        saja.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {samples.map((sample) => (
          <button
            key={sample}
            onClick={() => onPick(sample)}
            className="rounded-full border border-slate-800 bg-slate-900/50 px-4 py-2 text-xs text-slate-300 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-200 hover:shadow-lg hover:shadow-violet-500/10"
          >
            {sample}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="bubble-in flex items-start gap-3">
      <Image
        src="/brand/helix-mark.png"
        alt="HELIX"
        width={32}
        height={32}
        className="h-8 w-8 flex-shrink-0 logo-pulse"
      />
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm backdrop-blur">
        <span className="inline-flex items-end gap-1 h-4">
          <span className="dna-dot inline-block h-4 w-1 rounded-full bg-gradient-to-b from-blue-400 to-violet-500"></span>
          <span className="dna-dot inline-block h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-violet-600"></span>
          <span className="dna-dot inline-block h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-blue-500"></span>
        </span>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`bubble-in flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {isUser ? (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-200">
          Y
        </div>
      ) : (
        <Image
          src="/brand/helix-mark.png"
          alt="HELIX"
          width={32}
          height={32}
          className="h-8 w-8 flex-shrink-0"
        />
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed backdrop-blur ${
          isUser
            ? "border border-violet-500/30 bg-gradient-to-br from-blue-600/20 to-violet-600/20 text-slate-100"
            : "border border-slate-800 bg-slate-900/60 text-slate-100"
        }`}
      >
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}
