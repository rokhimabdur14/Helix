"use client";

const RANK_BADGES = {
  1: "from-yellow-400 to-amber-500 text-yellow-950",
  2: "from-slate-300 to-slate-400 text-slate-900",
  3: "from-amber-700 to-amber-900 text-amber-100",
};

const TYPE_COLOR = {
  reel: "border-pink-500/40 text-pink-300",
  carousel: "border-blue-500/40 text-blue-300",
  image: "border-emerald-500/40 text-emerald-300",
  story: "border-amber-500/40 text-amber-300",
  feed: "border-violet-500/40 text-violet-300",
};

export function TopPostCard({ post, rank }) {
  const badge =
    RANK_BADGES[rank] ||
    "from-slate-700 to-slate-800 text-slate-300";
  const typeC = TYPE_COLOR[post.type?.toLowerCase()] || TYPE_COLOR.feed;

  return (
    <div
      style={{ "--stagger-i": rank - 1 }}
      className="stagger-in lift-on-hover flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
    >
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display text-base font-bold ${badge}`}
      >
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md border bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${typeC}`}
          >
            {post.type}
          </span>
          <span className="text-[10px] text-slate-500">{post.date}</span>
          <span className="text-[10px] text-slate-500">·</span>
          <span className="text-[10px] text-slate-500">{post.content_pillar}</span>
        </div>
        {post.caption_preview && (
          <p className="text-xs leading-relaxed text-slate-300 line-clamp-2">
            {post.caption_preview}
          </p>
        )}
        <div className="mt-2 flex items-center gap-4 text-xs">
          <span className="font-semibold text-violet-200">
            {post.engagement_rate}% ER
          </span>
          <span className="text-slate-500">
            {post.reach.toLocaleString()} reach
          </span>
        </div>
      </div>
    </div>
  );
}
