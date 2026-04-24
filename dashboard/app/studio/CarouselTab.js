"use client";

import { useEffect, useState } from "react";
import { api } from "../api-client";
import { HistoryStrip } from "./HistoryStrip";
import {
  CopyButton,
  ErrorBox,
  Field,
  GenerateButton,
  NumberStepper,
  ResultPanel,
  SegmentedControl,
  TextArea,
} from "./studio-ui";
import { useStudioHistory } from "./use-studio-history";

const GOALS = [
  { value: "education", label: "Edu" },
  { value: "storytelling", label: "Story" },
  { value: "listicle", label: "List" },
  { value: "promotion", label: "Promo" },
];

export function CarouselTab({ brandId, consumePrefill }) {
  const [topic, setTopic] = useState("");
  const [numSlides, setNumSlides] = useState(5);
  const [goal, setGoal] = useState("education");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const history = useStudioHistory("carousel", brandId);

  useEffect(() => {
    const p = consumePrefill?.("carousel");
    if (!p) return;
    if (p.topic) setTopic(p.topic);
    if (
      p.goal &&
      ["education", "storytelling", "listicle", "promotion"].includes(p.goal)
    ) {
      setGoal(p.goal);
    }
    setResult(null);
    setError("");
  }, [consumePrefill]);

  async function generate() {
    if (!topic.trim() || loading) return;
    setError("");
    setLoading(true);
    setResult(null);
    setActiveSlide(0);
    const input = {
      topic: topic.trim(),
      num_slides: numSlides,
      goal,
    };
    try {
      const data = await api.studio.carousel(brandId, input);
      setResult(data);
      history.save(input, data);
    } catch (e) {
      setError(e.message || "Gagal generate");
    } finally {
      setLoading(false);
    }
  }

  function restore(entry) {
    setTopic(entry.input.topic);
    setNumSlides(entry.input.num_slides);
    setGoal(entry.input.goal);
    setResult(entry.output);
    setActiveSlide(0);
    setError("");
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <Field label="Topik carousel" hint={`${topic.length}/500`}>
          <TextArea
            value={topic}
            onChange={setTopic}
            placeholder="Contoh: 5 mistake fatal saat hire fotografer wedding"
            rows={4}
            disabled={loading}
          />
        </Field>
        <div className="space-y-3">
          <Field label="Goal">
            <SegmentedControl
              value={goal}
              onChange={setGoal}
              options={GOALS}
              disabled={loading}
            />
          </Field>
          <Field label="Jumlah slide" hint="3 — 10">
            <NumberStepper
              value={numSlides}
              onChange={setNumSlides}
              min={3}
              max={10}
              disabled={loading}
            />
          </Field>
          <GenerateButton
            onClick={generate}
            loading={loading}
            disabled={!topic.trim()}
          >
            Generate Carousel
          </GenerateButton>
        </div>
      </div>

      <ErrorBox message={error} />

      <HistoryStrip
        entries={history.entries}
        onRestore={restore}
        onRemove={history.remove}
        onClear={history.clear}
        renderPreview={(entry) => entry.input.topic}
      />

      {result?.slides?.length > 0 && (
        <ResultPanel title={result.title || "Carousel draft"}>
          <div className="grid gap-5 md:grid-cols-[280px_1fr]">
            <SlidePreview
              slide={result.slides[activeSlide]}
              total={result.slides.length}
            />
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Slides
                </span>
                <span className="text-xs text-slate-500">
                  {activeSlide + 1} / {result.slides.length}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-5">
                {result.slides.map((s, i) => {
                  const active = i === activeSlide;
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveSlide(i)}
                      style={{ "--stagger-i": i }}
                      className={`stagger-in aspect-square rounded-lg border text-[10px] font-semibold transition ${
                        active
                          ? "border-violet-500 bg-gradient-to-br from-blue-600/30 to-violet-600/30 text-violet-100 shadow-lg shadow-violet-900/40"
                          : "border-slate-800 bg-slate-900/40 text-slate-500 hover:border-violet-500/40 hover:text-violet-300"
                      }`}
                      title={s.headline}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 space-y-3">
                <SlideField label="Headline" value={result.slides[activeSlide].headline} />
                <SlideField
                  label="Body"
                  value={result.slides[activeSlide].body}
                  multiline
                />
                <SlideField
                  label="Visual hint"
                  value={result.slides[activeSlide].visual_hint}
                  muted
                />
              </div>
            </div>
          </div>

          {result.caption && (
            <div className="mt-6 border-t border-slate-800 pt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                  IG Caption
                </span>
                <CopyButton text={result.caption} />
              </div>
              <div className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-200">
                {result.caption}
              </div>
            </div>
          )}
        </ResultPanel>
      )}
    </div>
  );
}

function SlidePreview({ slide, total }) {
  if (!slide) return null;
  return (
    <div className="lift-on-hover aspect-square overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-violet-950/40 shadow-2xl shadow-violet-900/30">
      <div className="flex h-full flex-col p-5">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-violet-400/70">
          <span>Slide {slide.slide_num} / {total}</span>
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5">
            HELIX
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-center text-center">
          <h4 className="font-display text-lg font-bold leading-tight text-slate-50">
            {slide.headline}
          </h4>
          {slide.body && (
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {slide.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SlideField({ label, value, multiline, muted }) {
  if (!value) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <CopyButton text={value} />
      </div>
      <div
        className={`rounded-lg border border-slate-800 p-3 text-sm ${
          muted
            ? "bg-slate-950/40 italic text-slate-400"
            : "bg-slate-900/40 text-slate-200"
        } ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
