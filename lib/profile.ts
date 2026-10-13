export type Socials = Partial<Record<"x" | "instagram" | "tradingview" | "youtube" | "telegram" | "website", string>>;

export type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar: string;
  bio: string | null;
  socials: Socials;
  timezone: string;
  is_public: boolean;
  on_leaderboard: boolean;
  show_usd: boolean;
  created_at?: string;
};

export const SOCIALS: { key: keyof Socials; label: string; prefix: string; url: (h: string) => string; placeholder: string }[] = [
  { key: "x", label: "X / Twitter", prefix: "@", url: (h) => `https://x.com/${h}`, placeholder: "handle" },
  { key: "instagram", label: "Instagram", prefix: "@", url: (h) => `https://instagram.com/${h}`, placeholder: "handle" },
  { key: "tradingview", label: "TradingView", prefix: "", url: (h) => `https://www.tradingview.com/u/${h}/`, placeholder: "username" },
  { key: "youtube", label: "YouTube", prefix: "@", url: (h) => `https://youtube.com/@${h}`, placeholder: "channel" },
  { key: "telegram", label: "Telegram", prefix: "@", url: (h) => `https://t.me/${h}`, placeholder: "username" },
  { key: "website", label: "Website", prefix: "", url: (h) => (/^https?:\/\//.test(h) ? h : `https://${h}`), placeholder: "example.com" },
];

/** Strip URLs/@ down to a bare handle; websites keep a cleaned host+path. */
export function cleanHandle(key: keyof Socials, v: string): string {
  let s = v.trim();
  if (!s) return "";
  if (key === "website") {
    try {
      const u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`);
      return u.protocol === "https:" || u.protocol === "http:" ? `${u.host}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 100) : "";
    } catch {
      return "";
    }
  }
  s = s.replace(/^https?:\/\/[^/]+\/(u\/|@)?/i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return s.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40);
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function displayName(p: Pick<Profile, "display_name" | "username"> | null | undefined, fallback = "Trader"): string {
  return p?.display_name?.trim() || (p?.username ? `@${p.username}` : fallback);
}
