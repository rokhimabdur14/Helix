"use client";

/**
 * BrandsSkeleton — pengganti "Loading brands..." text saat /brands fetch.
 * Sesuaikan visual ke layout target via prop variant.
 *
 * variant:
 *  - "chat"     → mode toggle + 4 sample-chip placeholder
 *  - "studio"   → tab strip + 2 input row + button
 *  - "analysis" → 4 stat cards
 */
export default function BrandsSkeleton({ variant = "chat" }) {
  if (variant === "studio") {
    return (
      <div className="space-y-5" aria-label="Loading brands" role="status">
        <Bar className="h-10 w-full max-w-md" />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-9 w-full" delay={i * 60} />
          ))}
        </div>
        <Bar className="h-32 w-full" delay={120} />
        <Bar className="h-10 w-44" delay={200} />
      </div>
    );
  }

  if (variant === "analysis") {
    return (
      <div className="space-y-6" aria-label="Loading brands" role="status">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="helix-card-surface rounded-2xl border border-slate-800/60 p-5"
            >
              <Bar className="h-3 w-20" delay={i * 60} />
              <Bar className="mt-3 h-7 w-24" delay={i * 60 + 40} />
              <Bar className="mt-2 h-3 w-16" delay={i * 60 + 80} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Bar className="h-44 w-full" delay={140} />
          <Bar className="h-44 w-full" delay={200} />
        </div>
      </div>
    );
  }

  // default: chat
  return (
    <div className="space-y-4" aria-label="Loading brands" role="status">
      <Bar className="h-10 w-full max-w-xs" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-16 w-full" delay={i * 80} />
        ))}
      </div>
    </div>
  );
}

function Bar({ className = "", delay = 0 }) {
  return (
    <div
      className={`skeleton-bar rounded-xl ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
