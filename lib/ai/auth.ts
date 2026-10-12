import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Server routes act strictly AS the signed-in user: the browser's access token is verified with Supabase
 * and every query runs under that JWT, so row-level security still decides what can be read or written.
 * No service-role key exists anywhere in this app.
 */
export async function userClient(req: Request): Promise<{ sb: SupabaseClient; user: User } | Response> {
  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return json({ error: "Not signed in" }, 401);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return json({ error: "Session expired — sign in again" }, 401);
  return { sb, user: data.user };
}

/** Small per-instance limiter so a stuck loop can't burn through an API budget. */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, perMinute = 20): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > perMinute;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
