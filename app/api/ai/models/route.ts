import { json, rateLimited, userClient } from "@/lib/ai/auth";
import { OPENROUTER_FREE, openrouterCatalog, openrouterKeyInfo } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OpenRouter catalog (free first) + this key's usage / free-tier allowance. Signed-in owner only. */
export async function GET(req: Request) {
  const auth = await userClient(req);
  if (auth instanceof Response) return auth;
  if (rateLimited(`models:${auth.user.id}`, 10)) return json({ error: "Slow down" }, 429);
  if (!(process.env.OPENROUTER_API_KEY ?? "").trim()) return json({ connected: false, presets: OPENROUTER_FREE });
  const [catalog, key] = await Promise.all([openrouterCatalog().catch(() => []), openrouterKeyInfo().catch(() => null)]);
  const sorted = [...catalog].sort((a, b) => Number(b.free) - Number(a.free) || a.promptPerM - b.promptPerM || b.context - a.context);
  return json({ connected: true, presets: OPENROUTER_FREE, key, models: sorted.slice(0, 400) });
}
