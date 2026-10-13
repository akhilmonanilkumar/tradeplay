/** Predefined trader avatars (a1…a12): a gradient badge with a simple market glyph. */
export const AVATARS: { id: string; name: string; from: string; to: string; glyph: string }[] = [
  { id: "a1", name: "Peak", from: "#F2C14E", to: "#E07B39", glyph: "M5 17 L12 6 L19 17" },
  { id: "a2", name: "Candles", from: "#34D399", to: "#0EA5E9", glyph: "M8 4v16M6 8h4v7H6zM16 6v14M14 9h4v6h-4z" },
  { id: "a3", name: "Uptrend", from: "#8B5CF6", to: "#EC4899", glyph: "M4 17l5-5 4 3 7-8M15 7h5v5" },
  { id: "a4", name: "Bull", from: "#22C55E", to: "#15803D", glyph: "M5 7c0 3 2 4 4 4h6c2 0 4-1 4-4M9 11v4a3 3 0 0 0 6 0v-4" },
  { id: "a5", name: "Bear", from: "#F43F5E", to: "#9F1239", glyph: "M7 6a2 2 0 1 0 0 .1M17 6a2 2 0 1 0 0 .1M6 10h12v5a6 6 0 0 1-12 0z" },
  { id: "a6", name: "Target", from: "#06B6D4", to: "#3B82F6", glyph: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1" },
  { id: "a7", name: "Bolt", from: "#FACC15", to: "#F97316", glyph: "M13 3L5 14h6l-1 7 8-11h-6z" },
  { id: "a8", name: "Diamond", from: "#A78BFA", to: "#6366F1", glyph: "M6 9l6-5 6 5-6 11zM6 9h12" },
  { id: "a9", name: "Moon", from: "#64748B", to: "#1E293B", glyph: "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z" },
  { id: "a10", name: "Flame", from: "#FB923C", to: "#DC2626", glyph: "M12 21c4 0 6-3 6-6 0-4-4-6-4-10-3 2-5 5-5 8-1-1-2-2-2-3-1 2-1 3-1 5 0 3 2 6 6 6z" },
  { id: "a11", name: "Shield", from: "#14B8A6", to: "#0F766E", glyph: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4" },
  { id: "a12", name: "Rocket", from: "#818CF8", to: "#C084FC", glyph: "M14 4c3 0 6 3 6 6l-6 6-4-4zM10 12l-4 1-2 3 4 1M12 14l-1 4 3 2 1-4M15 9h.01" },
];

export function Avatar({ id, size = 40, label }: { id?: string | null; size?: number; label?: string }) {
  const a = AVATARS.find((x) => x.id === id) ?? AVATARS[0];
  const gid = `av-${a.id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={label ?? `${a.name} avatar`} className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a.from} />
          <stop offset="1" stopColor={a.to} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${gid})`} />
      <g transform="translate(8 8)">
        <path d={a.glyph} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
