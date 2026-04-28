"use client";

import { useEffect, useState } from "react";
import { api } from "../api-client";
import { HistoryStrip } from "./HistoryStrip";
import {
  CopyButton,
  ErrorBox,
  Field,
  GenerateButton,
  ResultPanel,
  SegmentedControl,
  TextArea,
} from "./studio-ui";
import { useStudioHistory } from "./use-studio-history";

const FORMAT_OPTIONS = [
  { value: "reel", label: "Reel" },
  { value: "carousel_foto", label: "Carousel" },
  { value: "single_foto", label: "Foto" },
  { value: "story", label: "Story" },
];

const MODE_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "tiru", label: "Tiru" },
  { value: "modifikasi", label: "Modifikasi" },
];

const GOAL_OPTIONS = [
  { value: "awareness", label: "Awareness" },
  { value: "engagement", label: "Engagement" },
  { value: "sales", label: "Sales" },
  { value: "education", label: "Education" },
];

const HOOK_TYPE_COLORS = {
  question: "from-blue-500/20 to-blue-700/20 border-blue-500/40 text-blue-200",
  shock: "from-red-500/20 to-red-700/20 border-red-500/40 text-red-200",
  promise:
    "from-emerald-500/20 to-emerald-700/20 border-emerald-500/40 text-emerald-200",
  story: "from-amber-500/20 to-amber-700/20 border-amber-500/40 text-amber-200",
  contrarian:
    "from-violet-500/20 to-violet-700/20 border-violet-500/40 text-violet-200",
};

export function BriefTab({ brandId, consumePrefill }) {
  const [formatType, setFormatType] = useState("reel");
  const [mode, setMode] = useState("original");
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [pillar, setPillar] = useState("");
  const [goal, setGoal] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [selectedRefIds, setSelectedRefIds] = useState([]);
  const [refs, setRefs] = useState([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  // Input snapshot yang produce `result` — dipakai buat regen-section
  // (bukan input current form state, krn user mungkin sudah ubah field setelah generate)
  const [lastInput, setLastInput] = useState(null);
  // Section key yang lagi di-regenerate (e.g. "hooks" / "scenes") atau null
  const [regeneratingSection, setRegeneratingSection] = useState(null);
  // Banner dismiss state — per brand. Re-baca tiap brand berubah supaya
  // brand A yang sudah dismiss gak ngumpetin banner di brand B.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const history = useStudioHistory("brief", brandId);

  // Load references library — dipakai di mode tiru/modifikasi
  useEffect(() => {
    if (!brandId) return;
    setRefsLoading(true);
    api.social
      .listReferences(brandId)
      .then((r) =>
        setRefs((r.references || []).filter((x) => x.status === "ready"))
      )
      .catch(() => setRefs([]))
      .finally(() => setRefsLoading(false));
  }, [brandId]);

  // Read banner dismiss state per brand — key di-scope ke brandId.
  useEffect(() => {
    if (!brandId || typeof window === "undefined") {
      setBannerDismissed(false);
      return;
    }
    try {
      const v = window.localStorage.getItem(`helix.studio.brief.banner.${brandId}`);
      setBannerDismissed(v === "dismissed");
    } catch {
      setBannerDismissed(false);
    }
  }, [brandId]);

  function dismissBanner() {
    setBannerDismissed(true);
    if (brandId && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          `helix.studio.brief.banner.${brandId}`,
          "dismissed"
        );
      } catch {}
    }
  }

  // Banner muncul saat user belum pernah generate brief untuk brand ini DAN
  // belum dismiss explicit. Setelah ada history, banner self-hide (gak perlu
  // dismiss manual lagi).
  const showBanner = !bannerDismissed && history.entries.length === 0;

  // Prefill dari Plan item
  useEffect(() => {
    const p = consumePrefill?.("brief");
    if (!p) return;
    if (p.topic) setTopic(p.topic);
    if (p.format_type) setFormatType(p.format_type);
    if (p.pillar) setPillar(p.pillar);
    if (p.goal) setGoal(p.goal);
    if (p.angle) setAngle(p.angle);
    if (p.mode) setMode(p.mode);
    setResult(null);
    setError("");
  }, [consumePrefill]);

  const showRefPicker = mode === "tiru" || mode === "modifikasi";

  function toggleRef(id) {
    setSelectedRefIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function generate() {
    if (!topic.trim() || loading) return;
    setError("");
    setLoading(true);
    setResult(null);
    const input = {
      format_type: formatType,
      topic: topic.trim(),
      mode,
      angle: angle.trim() || null,
      pillar: pillar.trim() || null,
      goal: goal || null,
      reference_ids: showRefPicker && selectedRefIds.length > 0 ? selectedRefIds : null,
      reference_text: showRefPicker && referenceText.trim() ? referenceText.trim() : null,
    };
    try {
      const data = await api.studio.brief(brandId, input);
      setResult(data);
      setLastInput(input);
      history.save(input, data);
    } catch (e) {
      setError(e.message || "Gagal generate brief");
    } finally {
      setLoading(false);
    }
  }

  // Regen 1 section: re-call backend dengan input yang sama, lalu merge HANYA
  // section yang diminta ke result. Section lain tetap (stabil di mata user).
  async function regenSection(sectionKey) {
    if (!lastInput || !result || regeneratingSection) return;
    setRegeneratingSection(sectionKey);
    setError("");
    try {
      const data = await api.studio.brief(brandId, lastInput);
      setResult((prev) => ({ ...prev, [sectionKey]: data[sectionKey] }));
    } catch (e) {
      setError(e.message || `Gagal regen ${sectionKey}`);
    } finally {
      setRegeneratingSection(null);
    }
  }

  function restore(entry) {
    setFormatType(entry.input.format_type || "reel");
    setMode(entry.input.mode || "original");
    setTopic(entry.input.topic || "");
    setAngle(entry.input.angle || "");
    setPillar(entry.input.pillar || "");
    setGoal(entry.input.goal || "");
    setSelectedRefIds(entry.input.reference_ids || []);
    setReferenceText(entry.input.reference_text || "");
    setResult(entry.output);
    setLastInput(entry.input);
    setError("");
  }

  return (
    <div>
      {showBanner && <BriefEmptyBanner onDismiss={dismissBanner} />}

      <div className="grid gap-4">
        <Field label="Format konten">
          <SegmentedControl
            value={formatType}
            onChange={setFormatType}
            options={FORMAT_OPTIONS}
            disabled={loading}
          />
        </Field>

        <Field label="Mode">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={MODE_OPTIONS}
            disabled={loading}
          />
        </Field>

        <Field label="Topik / tema post" hint={`${topic.length}/500`}>
          <TextArea
            value={topic}
            onChange={setTopic}
            placeholder="Contoh: workshop corporate Fotofusi — tunjukkan tim kerja saat shoot live event"
            rows={2}
            disabled={loading}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Pillar (opsional)" hint="ngiket ke brand pillar">
            <input
              type="text"
              value={pillar}
              onChange={(e) => setPillar(e.target.value)}
              disabled={loading}
              placeholder="Corporate Event"
              className="input-glow w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none disabled:opacity-50"
            />
          </Field>
          <Field label="Goal (opsional)">
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((g) => {
                const active = goal === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    disabled={loading}
                    onClick={() => setGoal(active ? "" : g.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                      active
                        ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-violet-500/30 hover:text-violet-300"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        {showRefPicker && (
          <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-blue-500/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                Referensi target ({selectedRefIds.length} dipilih)
              </span>
              <a
                href="?tab=references"
                className="text-[11px] text-violet-300 hover:text-violet-200"
              >
                Manage library →
              </a>
            </div>

            {refsLoading && (
              <p className="text-xs text-slate-500">Loading library...</p>
            )}

            {!refsLoading && refs.length === 0 && (
              <p className="text-xs text-slate-500">
                Belum ada reference di library. Tambah dulu URL post viral di
                tab References, atau pakai &quot;Reference manual&quot; di bawah.
              </p>
            )}

            {refs.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {refs.map((r) => {
                  const ana = r.analysis || {};
                  const active = selectedRefIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={loading}
                      onClick={() => toggleRef(r.id)}
                      className={`group flex gap-2 rounded-lg border p-2 text-left transition disabled:opacity-50 ${
                        active
                          ? "border-violet-500/60 bg-violet-500/10"
                          : "border-slate-800 bg-slate-950/40 hover:border-violet-500/30"
                      }`}
                    >
                      {r.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.thumbnail}
                          alt=""
                          className="h-14 w-14 flex-shrink-0 rounded object-cover object-top"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                              r.tag === "own"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : r.tag === "competitor"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-violet-500/20 text-violet-300"
                            }`}
                          >
                            {r.tag || "ref"}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {r.platform || "—"}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                          {ana.hook_or_first_frame ||
                            ana.visual_summary ||
                            r.url}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3">
              <Field label="Atau reference manual (paste deskripsi)">
                <TextArea
                  value={referenceText}
                  onChange={setReferenceText}
                  placeholder="Contoh: Reel @brandX viral 200K view — opening freeze frame text 'Saya cuma bayar 2jt buat ini', cut ke BTS, twist di akhir reveal hasil. Pattern: hook shock-stat → BTS → reveal."
                  rows={3}
                  disabled={loading}
                />
              </Field>
            </div>
          </div>
        )}

        {mode === "modifikasi" && (
          <Field label="Custom angle modifikasi" hint="apa yang mau lo ubah dari pattern referensi">
            <TextArea
              value={angle}
              onChange={setAngle}
              placeholder="Contoh: ganti audience jadi HR korporat (bukan UMKM), tone lebih profesional, twist soft-sell ke jasa Fotofusi"
              rows={2}
              disabled={loading}
            />
          </Field>
        )}

        <GenerateButton
          onClick={generate}
          loading={loading}
          disabled={!topic.trim()}
        >
          Generate Brief
        </GenerateButton>
      </div>

      <ErrorBox message={error} />

      <HistoryStrip
        entries={history.entries}
        onRestore={restore}
        onRemove={history.remove}
        onClear={history.clear}
        renderPreview={(entry) =>
          `[${entry.input.format_type || "reel"}] ${entry.input.topic}`
        }
      />

      {result && (
        <BriefResult
          result={result}
          regenerating={regeneratingSection}
          onRegen={regenSection}
          canRegen={!!lastInput}
        />
      )}
    </div>
  );
}

function BriefResult({ result, regenerating, onRegen, canRegen }) {
  const fmt = result.format;
  const layoutProps = { result, regenerating, onRegen, canRegen };
  return (
    <ResultPanel
      title={`Brief · ${fmt} · ${result.title || "Untitled"}`}
      onCopyAll={<CopyButton text={JSON.stringify(result, null, 2)} label="Copy JSON" />}
    >
      {result.narrative_arc && (
        <NarrativeArc
          arc={result.narrative_arc}
          regenerating={regenerating}
          onRegen={onRegen}
          canRegen={canRegen}
        />
      )}

      {fmt === "reel" && <ReelLayout {...layoutProps} />}
      {fmt === "carousel_foto" && <CarouselFotoLayout {...layoutProps} />}
      {fmt === "single_foto" && <SingleFotoLayout {...layoutProps} />}
      {fmt === "story" && <StoryLayout {...layoutProps} />}

      <BriefMeta result={result} />
    </ResultPanel>
  );
}

function RegenButton({ sectionKey, regenerating, onRegen, disabled }) {
  if (!onRegen) return null;
  const isLoading = regenerating === sectionKey;
  const isOtherLoading = regenerating && regenerating !== sectionKey;
  return (
    <button
      type="button"
      onClick={() => onRegen(sectionKey)}
      disabled={disabled || isLoading || isOtherLoading}
      aria-label={`Regenerate ${sectionKey}`}
      title={`Generate ulang ${sectionKey} saja`}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 transition hover:border-violet-500/60 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`inline-block ${isLoading ? "spin-loop" : ""}`}
        aria-hidden="true"
      >
        ↻
      </span>
      {isLoading ? "regenerating…" : "regen"}
    </button>
  );
}

function NarrativeArc({ arc, regenerating, onRegen, canRegen }) {
  const items = [
    ["Feel", arc.feel, "text-pink-300"],
    ["Think", arc.think, "text-blue-300"],
    ["Do", arc.do, "text-emerald-300"],
    ["Tell", arc.tell, "text-amber-300"],
  ].filter(([, v]) => v);
  if (items.length === 0) return null;
  const isLoading = regenerating === "narrative_arc";
  return (
    <div className="reveal-in mb-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">
          Narrative arc · Feel-Think-Do-Tell
        </span>
        <RegenButton
          sectionKey="narrative_arc"
          regenerating={regenerating}
          onRegen={onRegen}
          disabled={!canRegen}
        />
      </div>
      <div
        className={`relative rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-blue-500/5 p-4 transition-opacity duration-200 ${
          isLoading ? "pointer-events-none opacity-40" : ""
        }`}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map(([label, value, color]) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}>
                {label}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{value}</p>
            </div>
          ))}
        </div>
        {isLoading && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
          >
            <div className="shimmer-sweep absolute inset-0" />
          </div>
        )}
      </div>
    </div>
  );
}

function ReelLayout({ result, regenerating, onRegen, canRegen }) {
  return (
    <>
      {result.hooks?.length > 0 && (
        <Section
          title={`${result.hooks.length} hook opsi`}
          actions={
            <RegenButton
              sectionKey="hooks"
              regenerating={regenerating}
              onRegen={onRegen}
              disabled={!canRegen}
            />
          }
          isRegenerating={regenerating === "hooks"}
        >
          <div className="space-y-2">
            {result.hooks.map((h, i) => {
              const color =
                HOOK_TYPE_COLORS[h.type] ||
                "from-slate-500/20 to-slate-700/20 border-slate-500/40 text-slate-200";
              return (
                <div
                  key={i}
                  style={{ "--stagger-i": i }}
                  className={`stagger-in rounded-xl border bg-gradient-to-br p-3 ${color}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">#{i + 1}</span>
                        <span className="rounded-full border border-current/30 bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                          {h.type}
                        </span>
                      </div>
                      <p className="text-sm font-semibold leading-snug text-slate-100">
                        “{h.text}”
                      </p>
                      {h.visual && (
                        <p className="mt-1 text-[11px] italic text-slate-400">
                          📸 {h.visual}
                        </p>
                      )}
                    </div>
                    <CopyButton text={h.text} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {result.twist && (
        <Section title="Twist">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-sm leading-relaxed text-amber-100">⚡ {result.twist}</p>
          </div>
        </Section>
      )}

      {result.scenes?.length > 0 && (
        <Section
          title={`${result.scenes.length} scenes (~${result.scenes.reduce(
            (s, x) => s + (x.duration_s || 0),
            0
          )}s)`}
          actions={
            <RegenButton
              sectionKey="scenes"
              regenerating={regenerating}
              onRegen={onRegen}
              disabled={!canRegen}
            />
          }
          isRegenerating={regenerating === "scenes"}
        >
          <div className="space-y-2">
            {result.scenes.map((s, i) => (
              <div
                key={i}
                style={{ "--stagger-i": i }}
                className="stagger-in flex gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3"
              >
                <div className="flex w-12 flex-shrink-0 flex-col items-center rounded-lg bg-slate-900/60 p-2">
                  <span className="text-[9px] uppercase text-slate-500">scene</span>
                  <span className="font-display text-lg font-bold text-violet-200">
                    {s.no || i + 1}
                  </span>
                  {s.duration_s && (
                    <span className="text-[9px] text-slate-500">{s.duration_s}s</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {s.visual && (
                    <p className="text-xs text-slate-300">
                      <span className="text-slate-500">📸 Visual: </span>
                      {s.visual}
                    </p>
                  )}
                  {s.voiceover && (
                    <p className="text-xs text-slate-300">
                      <span className="text-slate-500">🎙 VO: </span>
                      {s.voiceover}
                    </p>
                  )}
                  {s.on_screen_text && (
                    <p className="text-xs text-slate-300">
                      <span className="text-slate-500">📝 Teks: </span>
                      {s.on_screen_text}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <CaptionBlock
        caption={result.caption}
        cta={result.cta}
        hashtags={result.hashtags}
        regenerating={regenerating}
        onRegen={onRegen}
        canRegen={canRegen}
      />
    </>
  );
}

function CarouselFotoLayout({ result, regenerating, onRegen, canRegen }) {
  return (
    <>
      {result.slides?.length > 0 && (
        <Section
          title={`${result.slides.length} slides`}
          actions={
            <RegenButton
              sectionKey="slides"
              regenerating={regenerating}
              onRegen={onRegen}
              disabled={!canRegen}
            />
          }
          isRegenerating={regenerating === "slides"}
        >
          <div className="space-y-2">
            {result.slides.map((s, i) => {
              const typeColor =
                s.type === "cover"
                  ? "border-pink-500/40 bg-pink-500/5"
                  : s.type === "cta"
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-slate-800 bg-slate-950/40";
              return (
                <div
                  key={i}
                  style={{ "--stagger-i": i }}
                  className={`stagger-in flex gap-3 rounded-xl border p-3 ${typeColor}`}
                >
                  <div className="flex w-12 flex-shrink-0 flex-col items-center rounded-lg bg-slate-900/60 p-2">
                    <span className="font-display text-lg font-bold text-violet-200">
                      {s.no || i + 1}
                    </span>
                    {s.type && (
                      <span className="text-[9px] uppercase text-slate-500">
                        {s.type}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {s.headline && (
                      <p className="text-sm font-semibold text-slate-100">{s.headline}</p>
                    )}
                    {s.body && (
                      <p className="text-xs text-slate-400">{s.body}</p>
                    )}
                    {s.visual && (
                      <p className="text-[11px] italic text-slate-500">📸 {s.visual}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <CaptionBlock
        caption={result.caption}
        cta={result.cta}
        hashtags={result.hashtags}
        regenerating={regenerating}
        onRegen={onRegen}
        canRegen={canRegen}
      />
    </>
  );
}

function SingleFotoLayout({ result, regenerating, onRegen, canRegen }) {
  return (
    <>
      {result.visual_direction && (
        <Section
          title="Visual direction"
          actions={
            <RegenButton
              sectionKey="visual_direction"
              regenerating={regenerating}
              onRegen={onRegen}
              disabled={!canRegen}
            />
          }
          isRegenerating={regenerating === "visual_direction"}
        >
          <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-3">
            <p className="text-sm leading-relaxed text-pink-100">
              📸 {result.visual_direction}
            </p>
          </div>
        </Section>
      )}

      {result.hook_options?.length > 0 && (
        <Section
          title={`${result.hook_options.length} hook caption opsi`}
          actions={
            <RegenButton
              sectionKey="hook_options"
              regenerating={regenerating}
              onRegen={onRegen}
              disabled={!canRegen}
            />
          }
          isRegenerating={regenerating === "hook_options"}
        >
          <div className="space-y-2">
            {result.hook_options.map((h, i) => (
              <div
                key={i}
                style={{ "--stagger-i": i }}
                className="stagger-in flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3"
              >
                <div className="flex-1">
                  <span className="text-[10px] text-slate-500">#{i + 1}</span>
                  <p className="text-sm font-semibold text-slate-100">“{h}”</p>
                </div>
                <CopyButton text={h} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <CaptionBlock
        caption={result.caption}
        cta={result.cta}
        hashtags={result.hashtags}
        regenerating={regenerating}
        onRegen={onRegen}
        canRegen={canRegen}
      />
    </>
  );
}

function StoryLayout({ result, regenerating, onRegen, canRegen }) {
  return (
    <>
      {result.frames?.length > 0 && (
        <Section
          title={`${result.frames.length} story frames`}
          actions={
            <RegenButton
              sectionKey="frames"
              regenerating={regenerating}
              onRegen={onRegen}
              disabled={!canRegen}
            />
          }
          isRegenerating={regenerating === "frames"}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {result.frames.map((f, i) => (
              <div
                key={i}
                style={{ "--stagger-i": i }}
                className="stagger-in rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-display text-base font-bold text-amber-200">
                    Frame {f.no || i + 1}
                  </span>
                  {f.sticker_suggestion && f.sticker_suggestion !== "none" && (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-200">
                      {f.sticker_suggestion}
                    </span>
                  )}
                </div>
                {f.visual && (
                  <p className="text-xs text-slate-300">📸 {f.visual}</p>
                )}
                {f.copy && (
                  <p className="mt-1 text-xs font-medium text-amber-100">
                    “{f.copy}”
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {result.cta && (
        <Section title="CTA">
          <p className="text-sm text-emerald-300">{result.cta}</p>
        </Section>
      )}
    </>
  );
}

function CaptionBlock({ caption, cta, hashtags, regenerating, onRegen, canRegen }) {
  if (!caption && !cta && !hashtags?.length) return null;
  const fullText = [caption, cta, hashtags?.length ? hashtags.join(" ") : null]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Section
      title="Caption"
      actions={
        <div className="flex items-center gap-1.5">
          <RegenButton
            sectionKey="caption"
            regenerating={regenerating}
            onRegen={onRegen}
            disabled={!canRegen}
          />
          <CopyButton text={fullText} />
        </div>
      }
      isRegenerating={regenerating === "caption"}
    >
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        {caption && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
            {caption}
          </p>
        )}
        {cta && (
          <p className="mt-3 text-sm font-semibold text-emerald-300">→ {cta}</p>
        )}
        {hashtags?.length > 0 && (
          <p className="mt-3 text-xs text-violet-300">{hashtags.join(" ")}</p>
        )}
      </div>
    </Section>
  );
}

function BriefMeta({ result }) {
  if (!result.best_posting_time && !result.exec_notes) return null;
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]">
      {result.best_posting_time && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
            Posting time
          </div>
          <div className="mt-1 font-display text-xl font-bold text-blue-200">
            {result.best_posting_time}
          </div>
        </div>
      )}
      {result.exec_notes && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Exec notes
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            {result.exec_notes}
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, actions, children, isRegenerating }) {
  return (
    <div className={`mb-5 ${isRegenerating ? "regenerating-section" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </h4>
        {actions}
      </div>
      <div
        className={`relative transition-opacity duration-200 ${
          isRegenerating ? "pointer-events-none opacity-40" : ""
        }`}
      >
        {children}
        {isRegenerating && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
          >
            <div className="shimmer-sweep absolute inset-0" />
          </div>
        )}
      </div>
    </div>
  );
}

function BriefEmptyBanner({ onDismiss }) {
  return (
    <div
      role="region"
      aria-label="Brief tab onboarding"
      className="reveal-in mb-5 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-blue-500/10 p-5"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 2h6l4 4v14a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2h2M9 2v4h6V2M9 12h6M9 16h6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-violet-100">
            Brief eksekusi — pertama kali pakai brand ini?
          </h3>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-300">
            <li>
              <span className="text-violet-300">●</span>{" "}
              Pilih <span className="text-slate-100">format</span> (Reel / Carousel /
              Foto / Story) — output JSON adapt sesuai format
            </li>
            <li>
              <span className="text-violet-300">●</span>{" "}
              Set <span className="text-slate-100">mode</span>:{" "}
              <em>Original</em> dari brand DNA, <em>Tiru</em> pattern referensi, atau{" "}
              <em>Modifikasi</em> referensi dengan custom angle
            </li>
            <li>
              <span className="text-violet-300">●</span>{" "}
              History tersimpan otomatis per brand — bisa restore dari strip di bawah form
            </li>
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup banner onboarding"
          className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-violet-500/60 hover:text-violet-200"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}
