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

const FORMATS = [
  { value: "reel", label: "Reel" },
  { value: "tiktok", label: "TikTok" },
  { value: "story", label: "Story" },
];

const TYPE_COLORS = {
  question: "from-blue-500/20 to-blue-700/20 border-blue-500/40 text-blue-200",
  shock: "from-red-500/20 to-red-700/20 border-red-500/40 text-red-200",
  promise:
    "from-emerald-500/20 to-emerald-700/20 border-emerald-500/40 text-emerald-200",
  story:
    "from-amber-500/20 to-amber-700/20 border-amber-500/40 text-amber-200",
  contrarian:
    "from-violet-500/20 to-violet-700/20 border-violet-500/40 text-violet-200",
};

export function HookTab({ brandId, consumePrefill }) {
  const [topic, setTopic] = useState("");
  const [formatType, setFormatType] = useState("reel");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const history = useStudioHistory("hook", brandId);

  useEffect(() => {
    const p = consumePrefill?.("hook");
    if (!p) return;
    if (p.topic) setTopic(p.topic);
    if (p.format_type && ["reel", "tiktok", "story"].includes(p.format_type)) {
      setFormatType(p.format_type);
    }
    setResult(null);
    setError("");
  }, [consumePrefill]);

  async function generate() {
    if (!topic.trim() || loading) return;
    setError("");
    setLoading(true);
    setResult(null);
    const input = {
      topic: topic.trim(),
      format_type: formatType,
      count,
    };
    try {
      const data = await api.studio.hook(brandId, input);
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
    setFormatType(entry.input.format_type);
    setCount(entry.input.count);
    setResult(entry.output);
    setError("");
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[1fr_180px_180px]">
        <Field label="Topik video" hint={`${topic.length}/500`}>
          <TextArea
            value={topic}
            onChange={setTopic}
            placeholder="Contoh: Tips memilih fotografer wedding di Jogja yang sesuai budget"
            rows={3}
            disabled={loading}
          />
        </Field>
        <div className="space-y-3">
          <Field label="Format">
            <SegmentedControl
              value={formatType}
              onChange={setFormatType}
              options={FORMATS}
              disabled={loading}
            />
          </Field>
          <Field label="Jumlah hook" hint={`min 3, max 10`}>
            <NumberStepper
              value={count}
              onChange={setCount}
              min={3}
              max={10}
              disabled={loading}
            />
          </Field>
        </div>
        <div className="flex items-end">
          <GenerateButton
            onClick={generate}
            loading={loading}
            disabled={!topic.trim()}
          >
            Generate
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

      {result?.hooks?.length > 0 && (
        <ResultPanel title={`${result.hooks.length} hook ide`}>
          <div className="space-y-3">
            {result.hooks.map((hook, i) => (
              <HookCard key={i} hook={hook} index={i} />
            ))}
          </div>
        </ResultPanel>
      )}
    </div>
  );
}

function HookCard({ hook, index }) {
  const colorClass =
    TYPE_COLORS[hook.type] ||
    "from-slate-500/20 to-slate-700/20 border-slate-500/40 text-slate-200";
  return (
    <div
      style={{ "--stagger-i": index }}
      className={`stagger-in lift-on-hover rounded-xl border bg-gradient-to-br p-4 ${colorClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-slate-500">#{index + 1}</span>
            <span className="rounded-full border border-current/30 bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              {hook.type}
            </span>
          </div>
          <p className="text-base font-semibold leading-snug text-slate-100">
            “{hook.text}”
          </p>
          {hook.reasoning && (
            <p className="mt-2 text-xs text-slate-400">
              <span className="text-slate-500">Why: </span>
              {hook.reasoning}
            </p>
          )}
        </div>
        <CopyButton text={hook.text} />
      </div>
    </div>
  );
}
