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

const GOALS = [
  { value: "awareness", label: "Awareness" },
  { value: "engagement", label: "Engagement" },
  { value: "sales", label: "Sales" },
  { value: "education", label: "Education" },
];

const LENGTHS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export function CaptionTab({ brandId, consumePrefill }) {
  const [postContext, setPostContext] = useState("");
  const [goal, setGoal] = useState("engagement");
  const [length, setLength] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const history = useStudioHistory("caption", brandId);

  useEffect(() => {
    const p = consumePrefill?.("caption");
    if (!p) return;
    if (p.post_context) setPostContext(p.post_context);
    if (p.goal && ["awareness", "engagement", "sales", "education"].includes(p.goal)) {
      setGoal(p.goal);
    }
    setResult(null);
    setError("");
  }, [consumePrefill]);

  async function generate() {
    if (!postContext.trim() || loading) return;
    setError("");
    setLoading(true);
    setResult(null);
    const input = {
      post_context: postContext.trim(),
      goal,
      length,
    };
    try {
      const data = await api.studio.caption(brandId, input);
      setResult(data);
      history.save(input, data);
    } catch (e) {
      setError(e.message || "Gagal generate");
    } finally {
      setLoading(false);
    }
  }

  function restore(entry) {
    setPostContext(entry.input.post_context);
    setGoal(entry.input.goal);
    setLength(entry.input.length);
    setResult(entry.output);
    setError("");
  }

  const fullCaption = result
    ? [result.hook, result.body, result.cta, (result.hashtags || []).join(" ")]
        .filter(Boolean)
        .join("\n\n")
    : "";

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <Field label="Konteks post" hint={`${postContext.length}/1000`}>
          <TextArea
            value={postContext}
            onChange={setPostContext}
            placeholder="Contoh: Behind the scene wedding shoot di Tirta Empul, modern editorial style"
            rows={5}
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
          <Field label="Length">
            <SegmentedControl
              value={length}
              onChange={setLength}
              options={LENGTHS}
              disabled={loading}
            />
          </Field>
          <GenerateButton
            onClick={generate}
            loading={loading}
            disabled={!postContext.trim()}
          >
            Generate Caption
          </GenerateButton>
        </div>
      </div>

      <ErrorBox message={error} />

      <HistoryStrip
        entries={history.entries}
        onRestore={restore}
        onRemove={history.remove}
        onClear={history.clear}
        renderPreview={(entry) => entry.input.post_context}
      />

      {result && (
        <ResultPanel
          title="Caption draft"
          onCopyAll={<CopyButton text={fullCaption} label="Copy full" />}
        >
          <div className="space-y-4">
            <CaptionSection label="Hook" value={result.hook} />
            <CaptionSection label="Body" value={result.body} multiline />
            <CaptionSection label="CTA" value={result.cta} />
            {result.hashtags?.length > 0 && (
              <div>
                <SectionLabel
                  label="Hashtags"
                  copyText={result.hashtags.join(" ")}
                />
                <div className="flex flex-wrap gap-1.5">
                  {result.hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.alt_versions?.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Alternative versions
                </div>
                <div className="space-y-2">
                  {result.alt_versions.map((alt, i) => (
                    <div
                      key={i}
                      style={{ "--stagger-i": i }}
                      className="stagger-in lift-on-hover flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                    >
                      <p className="flex-1 whitespace-pre-wrap text-sm text-slate-300">
                        {alt}
                      </p>
                      <CopyButton text={alt} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ResultPanel>
      )}
    </div>
  );
}

function SectionLabel({ label, copyText }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {copyText && <CopyButton text={copyText} />}
    </div>
  );
}

function CaptionSection({ label, value, multiline }) {
  if (!value) return null;
  return (
    <div>
      <SectionLabel label={label} copyText={value} />
      <div
        className={`rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-200 ${
          multiline ? "whitespace-pre-wrap leading-relaxed" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
