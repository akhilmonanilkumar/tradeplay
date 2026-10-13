import { json, rateLimited, userClient } from "@/lib/ai/auth";
import { calendar, headlines, quotes, zenQuote } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** BTC & gold prices, relevant headlines and this week's economic calendar (public sources, cached upstream). */
export async function GET(req: Request) {
  const auth = await userClient(req);
  if (auth instanceof Response) return auth;
  if (rateLimited(`m:${auth.user.id}`, 30)) return json({ error: "Slow down" }, 429);
  const [q, h, c, z] = await Promise.all([quotes(), headlines(24), calendar(), zenQuote()]);
  return json({ quotes: q, headlines: h, events: c, quote: z, newsSource: process.env.FINNHUB_API_KEY ? "Finnhub" : "FXStreet", at: new Date().toISOString() });
}
