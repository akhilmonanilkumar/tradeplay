import "server-only";

/** Server-side calls to the public (anon-granted) Postgres functions: profiles, shared trades, leaderboard. */
export async function rpcAnon<T>(fn: "public_profile" | "public_trade" | "leaderboard", args: Record<string, unknown>, revalidate = 60): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export type PublicStats = { trades: number; win_rate: number; total_r: number; avg_r: number; profit_factor: number | null; best_r: number; net?: number; aplus_rate: number; live_logged: number };
export type PublicProfile = {
  username: string;
  display_name: string | null;
  avatar: string;
  bio: string | null;
  socials: Record<string, string>;
  joined: string;
  show_usd: boolean;
  stats: PublicStats;
  stats_30d: PublicStats;
  curve: { t: string; r: number }[];
  months: { m: string; r: number; n: number; net: number | null }[];
};
export type PublicTrade = {
  instrument: string;
  direction: "long" | "short";
  status: "open" | "closed" | "cancelled";
  opened_at: string;
  closed_at: string | null;
  session: string | null;
  entry: number;
  sl: number;
  tp: number;
  exit: number | null;
  rr_planned: number | null;
  r_multiple: number | null;
  gate_score: number;
  poi_type: string | null;
  entry_model: string | null;
  net_pnl: number | null;
  live_logged: boolean;
  logged_at: string;
  trader: { username: string; display_name: string | null; avatar: string } | null;
};
export type LeaderRow = { rank: number; username: string; display_name: string | null; avatar: string; trades: number; total_r: number; win_rate: number; avg_r: number; aplus_rate: number; live_logged: number };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const fmtRs = (r: number | null | undefined) => (r == null ? "—" : `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(2)}R`);
export const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
