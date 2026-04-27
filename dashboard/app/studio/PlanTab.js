"use client";

import { useEffect, useState } from "react";
import { api } from "../api-client";
import { HistoryStrip } from "./HistoryStrip";
import {
  ErrorBox,
  Field,
  GenerateButton,
  NumberStepper,
  ResultPanel,
  SegmentedControl,
  TextArea,
} from "./studio-ui";
import { useStudioHistory } from "./use-studio-history";

const PERIODS = [
  { value: "week", label: "1 Week" },
  { value: "month", label: "1 Month" },
];

const GOAL_OPTIONS = [
  { value: "awareness", label: "Awareness" },
  { value: "engagement", label: "Engagement" },
  { value: "sales", label: "Sales" },
  { value: "education", label: "Education" },
];

const FORMAT_COLORS = {
  reel: "border-pink-500/40 bg-pink-500/10 text-pink-200",
  carousel: "border-blue-500/40 bg-blue-500/10 text-blue-200",
  story: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  feed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

const GOAL_COLORS = {
  awareness: "text-blue-300",
  engagement: "text-violet-300",
  sales: "text-emerald-300",
  education: "text-amber-300",
};

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayFromDate(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return DAY_NAMES[d.getDay()];
  } catch {
    return "";
  }
}

export function PlanTab({ brandId, onSendToTool }) {
  const [period, setPeriod] = useState("week");
  const [postsPerWeek, setPostsPerWeek] = useState(4);
  const [goals, setGoals] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const history = useStudioHistory("plan", brandId);

  useEffect(() => {
    setStartDate(todayISO());
  }, []);

  function toggleGoal(g) {
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  async function generate() {
    if (loading) return;
    setError("");
    setLoading(true);
    setResult(null);
    const input = {
      period,
      posts_per_week: postsPerWeek,
      start_date: startDate,
      goals,
      theme: theme.trim(),
    };
    try {
      const data = await api.studio.plan(brandId, input);
      setResult(data);
      history.save(input, data);
    } catch (e) {
      setError(e.message || "Gagal generate plan");
    } finally {
      setLoading(false);
    }
  }

  function restore(entry) {
    setPeriod(entry.input.period);
    setPostsPerWeek(entry.input.posts_per_week);
    setGoals(entry.input.goals || []);
    setStartDate(entry.input.start_date || todayISO());
    setTheme(entry.input.theme || "");
    setResult(entry.output);
    setError("");
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
        <Field label="Period">
          <SegmentedControl
            value={period}
            onChange={setPeriod}
            options={PERIODS}
            disabled={loading}
          />
        </Field>
        <Field label="Posts per week" hint="2 — 7">
          <NumberStepper
            value={postsPerWeek}
            onChange={setPostsPerWeek}
            min={2}
            max={7}
            disabled={loading}
          />
        </Field>
        <Field label="Start date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
            className="input-glow w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-100 focus:border-violet-500 focus:outline-none disabled:opacity-50"
            style={{ colorScheme: "dark" }}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Tema konten (opsional)"
          hint={`${theme.length}/500 — HELIX bias hook & angle ke tema ini`}
        >
          <TextArea
            value={theme}
            onChange={setTheme}
            placeholder="Contoh: Wedding Season Q2 — soft sell paket prewedding, tonjolkan moment intimate & lokasi hidden gem Jogja"
            rows={2}
            disabled={loading}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Goals (optional, default balanced mix)">
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((g) => {
              const active = goals.includes(g.value);
              return (
                <button
                  key={g.value}
                  type="button"
                  disabled={loading}
                  onClick={() => toggleGoal(g.value)}
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
        <GenerateButton
          onClick={generate}
          loading={loading}
          disabled={false}
        >
          Generate Calendar
        </GenerateButton>
      </div>

      <ErrorBox message={error} />

      <HistoryStrip
        entries={history.entries}
        onRestore={restore}
        onRemove={history.remove}
        onClear={history.clear}
        renderPreview={(entry) =>
          entry.input.theme
            ? `${entry.input.theme}`
            : `${entry.input.period} · ${entry.input.start_date || "today"}`
        }
      />

      {result && (
        <ResultPanel
          title={`Calendar · ${result.start_date} → ${result.end_date}`}
        >
          {result.strategy && (
            <div className="reveal-in mb-5 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-blue-500/5 p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-400">
                Strategy
              </div>
              <p className="text-sm leading-relaxed text-slate-300">
                {result.strategy}
              </p>
              {result.pillars?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.pillars.map((p) => (
                    <span
                      key={p}
                      className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {result.posts?.length > 0 && (
            <div className="space-y-3">
              {result.posts.map((post, i) => (
                <PostCard
                  key={`${post.date}-${i}`}
                  post={post}
                  index={i}
                  onSendToTool={onSendToTool}
                />
              ))}
            </div>
          )}
        </ResultPanel>
      )}
    </div>
  );
}

function PostCard({ post, index = 0, onSendToTool }) {
  const formatClass =
    FORMAT_COLORS[post.format?.toLowerCase()] ||
    "border-slate-700 bg-slate-800/50 text-slate-300";
  const goalClass =
    GOAL_COLORS[post.goal?.toLowerCase()] || "text-slate-400";
  const computedDay = post.date ? dayFromDate(post.date) : "";
  const day = computedDay || post.day || "";

  function handleSend(targetTool) {
    if (!onSendToTool) return;
    if (targetTool === "hook") {
      onSendToTool("hook", {
        topic: `${post.topic}. Hook awal: ${post.hook_idea || ""}`.trim(),
        format_type:
          post.format?.toLowerCase() === "reel"
            ? "reel"
            : post.format?.toLowerCase() === "story"
            ? "story"
            : "reel",
      });
    } else if (targetTool === "caption") {
      onSendToTool("caption", {
        post_context: `${post.topic}. Angle: ${post.caption_angle || ""}. Visual: ${post.visual_idea || ""}`,
        goal: post.goal?.toLowerCase(),
      });
    } else if (targetTool === "carousel") {
      onSendToTool("carousel", {
        topic: post.topic,
        goal: "education",
      });
    }
  }

  const fmt = post.format?.toLowerCase();
  const sendButtons = [];
  if (fmt === "reel" || fmt === "story") sendButtons.push("hook");
  if (fmt === "carousel") sendButtons.push("carousel");
  sendButtons.push("caption");

  return (
    <div
      style={{ "--stagger-i": index }}
      className="stagger-in lift-on-hover group rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-violet-500/40"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex w-16 flex-shrink-0 flex-col items-center rounded-lg border border-slate-800 bg-slate-900/60 p-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            {day.slice(0, 3)}
          </span>
          <span className="font-display text-2xl font-bold text-violet-200">
            {post.date?.slice(8, 10) || "—"}
          </span>
          <span className="text-[10px] text-slate-500">
            {post.date?.slice(5, 7) || ""}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${formatClass}`}
            >
              {post.format}
            </span>
            {post.pillar && (
              <span className="text-[10px] text-slate-500">
                · {post.pillar}
              </span>
            )}
            {post.time && (
              <span className="ml-auto text-xs text-slate-500">
                {post.time}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold leading-snug text-slate-100">
            {post.topic}
          </h4>
          {post.hook_idea && (
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              <span className="font-semibold text-slate-500">Hook: </span>
              {post.hook_idea}
            </p>
          )}
          {post.caption_angle && (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              <span className="font-semibold text-slate-500">Caption angle: </span>
              {post.caption_angle}
            </p>
          )}
          {post.visual_idea && (
            <p className="mt-1 text-xs italic leading-relaxed text-slate-500">
              📸 {post.visual_idea}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {post.goal && (
              <span className={`text-[10px] font-medium uppercase tracking-wider ${goalClass}`}>
                · {post.goal}
              </span>
            )}
            <div className="ml-auto flex flex-wrap gap-1.5">
              {sendButtons.map((tool) => (
                <button
                  key={tool}
                  onClick={() => handleSend(tool)}
                  className="rounded-md border border-slate-700/60 bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-400 transition hover:border-violet-500/50 hover:text-violet-200"
                >
                  → {tool}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
