import "server-only";

/**
 * Public market context for BTC and gold — fetched server-side, cached 5–15 min, no API keys.
 *  - Prices: Kraken public ticker (XBTUSD, PAXGUSD ≈ 1 oz gold), CoinGecko as fallback
 *  - Headlines: Finnhub market news API (FINNHUB_API_KEY, free tier) — one vetted aggregator of
 *    Reuters/CNBC/MarketWatch etc.; without a key, the FXStreet publisher RSS feed (or NEWS_FEEDS) is used
 *  - Economic calendar: Forex Factory weekly JSON export (nfs.faireconomy.media)
 *  - Quote of the day: ZenQuotes /api/today (free, attribution required), local list as fallback
 */

export type Quote = { symbol: "BTC" | "XAU"; label: string; price: number | null; changePct: number | null; source: string };
export type Headline = { title: string; link: string; source: string; at: string | null; tags: ("BTC" | "XAU" | "MACRO")[] };
export type EconEvent = {
  title: string;
  country: string;
  at: string; // ISO
  impact: "High" | "Medium" | "Low" | "Holiday";
  forecast: string;
  previous: string;
};

const UA = { "user-agent": "APlusTradePlay/1.0 (+personal journal)" };

async function getJson(url: string, revalidate: number): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function quotes(): Promise<Quote[]> {
  const k = await getJson("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,PAXGUSD", 120);
  const res = k?.result as Record<string, { c: string[]; o: string }> | undefined;
  const pick = (re: RegExp) => (res ? Object.entries(res).find(([n]) => re.test(n))?.[1] : undefined);
  const mk = (symbol: Quote["symbol"], label: string, t?: { c: string[]; o: string }): Quote => {
    const last = t ? Number(t.c[0]) : NaN;
    const open = t ? Number(t.o) : NaN;
    return {
      symbol,
      label,
      price: Number.isFinite(last) ? last : null,
      changePct: Number.isFinite(last) && Number.isFinite(open) && open ? ((last - open) / open) * 100 : null,
      source: "Kraken",
    };
  };
  let out = [mk("BTC", "Bitcoin", pick(/XBT/)), mk("XAU", "Gold (PAXG)", pick(/PAXG/))];
  if (out.some((q) => q.price == null)) {
    const g = await getJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,pax-gold&vs_currencies=usd&include_24hr_change=true", 180);
    out = out.map((q) => {
      if (q.price != null || !g) return q;
      const row = q.symbol === "BTC" ? g.bitcoin : g["pax-gold"];
      return row ? { ...q, price: row.usd ?? null, changePct: row.usd_24h_change ?? null, source: "CoinGecko" } : q;
    });
  }
  return out;
}

const DEFAULT_FEEDS = ["https://www.fxstreet.com/rss/news"];

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

function tagsFor(title: string): Headline["tags"] {
  const t = title.toLowerCase();
  const tags: Headline["tags"] = [];
  if (/\b(bitcoin|btc|crypto|etf flows?|spot etf|miners?|halving|stablecoin)\b/.test(t)) tags.push("BTC");
  if (/\b(gold|xau|bullion|precious metals?)\b/.test(t)) tags.push("XAU");
  if (/\b(fed|fomc|powell|cpi|inflation|pce|nfp|payrolls|jobs|yields?|treasur(y|ies)|dollar|usd|dxy|rate (cut|hike)s?|tariffs?|recession|gdp)\b/.test(t)) tags.push("MACRO");
  return tags;
}

async function feed(url: string): Promise<Headline[]> {
  try {
    const r = await fetch(url, { headers: UA, next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const xml = await r.text();
    const host = new URL(url).hostname.replace(/^www\./, "");
    const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
    return items.slice(0, 40).flatMap((it) => {
      const title = decode(/<title>([\s\S]*?)<\/title>/.exec(it)?.[1] ?? "");
      const link = decode(/<link>([\s\S]*?)<\/link>/.exec(it)?.[1] ?? "");
      const date = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(it)?.[1];
      if (!title || !/^https:\/\//.test(link)) return [];
      const at = date ? new Date(decode(date)) : null;
      return [{ title, link, source: host, at: at && !isNaN(at.getTime()) ? at.toISOString() : null, tags: tagsFor(title) }];
    });
  } catch {
    return [];
  }
}

type FinnhubItem = { category?: string; datetime?: number; headline?: string; source?: string; url?: string; summary?: string };

/** Finnhub market news (general + forex + crypto). Free key: finnhub.io → Dashboard. */
async function finnhub(key: string): Promise<Headline[]> {
  const cats = ["general", "forex", "crypto"];
  const lists = await Promise.all(
    cats.map(async (c) => {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/news?category=${c}`, { headers: { ...UA, "X-Finnhub-Token": key }, next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
        return r.ok ? ((await r.json()) as FinnhubItem[]) : [];
      } catch {
        return [];
      }
    }),
  );
  return lists.flatMap((list, i) =>
    (Array.isArray(list) ? list : []).slice(0, 60).flatMap((n) => {
      const title = decode(String(n.headline ?? "")).slice(0, 220);
      const link = String(n.url ?? "");
      if (!title || !/^https:\/\//.test(link)) return [];
      const tags = tagsFor(`${title} ${String(n.summary ?? "").slice(0, 300)}`);
      if (cats[i] === "crypto" && !tags.includes("BTC") && /bitcoin|btc/i.test(title)) tags.push("BTC");
      return [{ title, link, source: String(n.source ?? "Finnhub").slice(0, 40), at: n.datetime ? new Date(n.datetime * 1000).toISOString() : null, tags }];
    }),
  );
}

/** Latest relevant headlines (BTC, gold, macro), newest first, deduped. */
export async function headlines(limit = 24): Promise<Headline[]> {
  const key = process.env.FINNHUB_API_KEY?.trim();
  if (key) {
    const seen = new Set<string>();
    const list = (await finnhub(key))
      .filter((h) => h.tags.length && !seen.has(h.title.toLowerCase()) && seen.add(h.title.toLowerCase()))
      .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
      .slice(0, limit);
    if (list.length) return list;
  }
  const urls = (process.env.NEWS_FEEDS ?? "").split(",").map((s) => s.trim()).filter((s) => /^https:\/\//.test(s));
  const all = (await Promise.all((urls.length ? urls : DEFAULT_FEEDS).map(feed))).flat();
  const seen = new Set<string>();
  return all
    .filter((h) => h.tags.length && !seen.has(h.title.toLowerCase()) && seen.add(h.title.toLowerCase()))
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, limit);
}

/** This week's events that move gold/BTC: USD (all impacts) plus High-impact from EUR/CNY/GBP/JPY. */
export async function calendar(): Promise<EconEvent[]> {
  const j = await getJson("https://nfs.faireconomy.media/ff_calendar_thisweek.json", 900);
  if (!Array.isArray(j)) return [];
  return j
    .filter((e: any) => e && typeof e.title === "string" && typeof e.date === "string")
    .filter((e: any) => e.country === "USD" ? e.impact !== "Low" || /fomc|fed|powell/i.test(e.title) : e.impact === "High" && ["EUR", "CNY", "GBP", "JPY"].includes(e.country))
    .map((e: any) => ({
      title: String(e.title).slice(0, 140),
      country: String(e.country),
      at: new Date(e.date).toISOString(),
      impact: (["High", "Medium", "Low", "Holiday"].includes(e.impact) ? e.impact : "Low") as EconEvent["impact"],
      forecast: String(e.forecast ?? ""),
      previous: String(e.previous ?? ""),
    }))
    .sort((a: EconEvent, b: EconEvent) => a.at.localeCompare(b.at));
}

export type DayQuote = { text: string; by: string; source: "ZenQuotes" };

/** Today's quote from ZenQuotes (cached 6h; their free tier allows 5 calls / 30 s and needs attribution). */
export async function zenQuote(): Promise<DayQuote | null> {
  const j = await getJson("https://zenquotes.io/api/today", 21600);
  const q = Array.isArray(j) ? j[0] : null;
  const text = typeof q?.q === "string" ? q.q.trim() : "";
  const by = typeof q?.a === "string" ? q.a.trim() : "";
  if (!text || !by || /too many requests|zenquotes\.io/i.test(text)) return null;
  return { text: text.slice(0, 400), by: by.slice(0, 80), source: "ZenQuotes" };
}
