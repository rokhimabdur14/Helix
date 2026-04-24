"use client";

/**
 * Floating SVG illustrations of content-creator elements.
 * Subtle ambient backdrop — fixed-positioned, low opacity, drift animation.
 *
 * Tidak interaktif (pointer-events:none). Sit di z-0 di atas particle-field
 * tapi di bawah konten utama.
 */

const PALETTE = {
  violet: "#a78bfa",
  blue: "#60a5fa",
  pink: "#f472b6",
  amber: "#fbbf24",
  emerald: "#34d399",
};

// Each icon: id, paths (svg path d), positioning, color, animation params
const ICONS = [
  {
    id: "camera",
    color: PALETTE.violet,
    pos: { left: "5%", top: "12%" },
    size: 130,
    opacity: 0.13,
    duration: "22s",
    delay: "0s",
    pulse: false,
    paths: [
      "M3 8h3l1.5-2.5h9L18 8h3v11H3z",
      "M12 11.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
    ],
  },
  {
    id: "play",
    color: PALETTE.blue,
    pos: { right: "8%", top: "8%" },
    size: 100,
    opacity: 0.14,
    duration: "26s",
    delay: "-3s",
    pulse: true,
    paths: ["M8 5v14l11-7z"],
  },
  {
    id: "heart",
    color: PALETTE.pink,
    pos: { left: "8%", top: "62%" },
    size: 110,
    opacity: 0.11,
    duration: "24s",
    delay: "-6s",
    pulse: false,
    paths: [
      "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    ],
  },
  {
    id: "hashtag",
    color: PALETTE.violet,
    pos: { right: "12%", top: "55%" },
    size: 100,
    opacity: 0.12,
    duration: "28s",
    delay: "-2s",
    pulse: true,
    paths: ["M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"],
  },
  {
    id: "mic",
    color: PALETTE.violet,
    pos: { left: "48%", top: "4%" },
    size: 88,
    opacity: 0.1,
    duration: "20s",
    delay: "-8s",
    pulse: false,
    paths: [
      "M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z",
      "M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6",
    ],
  },
  {
    id: "music",
    color: PALETTE.blue,
    pos: { right: "5%", bottom: "10%" },
    size: 96,
    opacity: 0.12,
    duration: "30s",
    delay: "-4s",
    pulse: true,
    paths: [
      "M9 18V5l12-2v13",
      "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
      "M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    ],
  },
  {
    id: "comment",
    color: PALETTE.violet,
    pos: { left: "3%", bottom: "15%" },
    size: 96,
    opacity: 0.11,
    duration: "25s",
    delay: "-7s",
    pulse: false,
    paths: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  },
  {
    id: "lightbulb",
    color: PALETTE.amber,
    pos: { left: "55%", bottom: "8%" },
    size: 90,
    opacity: 0.1,
    duration: "23s",
    delay: "-5s",
    pulse: true,
    paths: [
      "M9 18h6M10 22h4",
      "M12 2a7 7 0 0 0-4 12.7v2.3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z",
    ],
  },
];

export function CreatorBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        // Parallax tipis ikut kursor (depth bawah orbs/starfield)
        translate:
          "calc(var(--mx, 0) * -12px) calc(var(--my, 0) * -12px)",
        transition: "translate 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {ICONS.map((ic) => (
        <div
          key={ic.id}
          className={`creator-icon ${ic.pulse ? "pulse" : ""}`}
          style={{
            ...ic.pos,
            width: ic.size,
            height: ic.size,
            color: ic.color,
            opacity: ic.opacity,
            animationDuration: ic.duration,
            animationDelay: ic.delay,
            "--icon-opacity": ic.opacity,
          }}
        >
          <svg viewBox="0 0 24 24">
            {ic.paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
}
