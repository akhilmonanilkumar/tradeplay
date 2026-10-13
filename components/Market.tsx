"use client";

import { useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/coach";
import { riskWindows, newsTimesFor, activeWindow, type RiskWindow } from "@/lib/events";
import { todayIST, fmtIST } from "@/lib/calc";
import { tzAbbr } from "@/lib/tz";
import { supabase } from "@/lib/supabase";
import { useData } from "@/components/Shell";
import { Badge, Card, Segmented } from "@/components/ui";

export type Quote = { symbol: "BTC" | "XAU"; label: string; price: number | null; changePct: number | null; source: string };
export type Headline = { title: string; link: string; source: string; at: string | null; tags: ("BTC" | "XAU" | "MACRO")[] };
export type EconEvent = { title: string; country: string; at: string; impact: "High" | "Medium" | "Low" | "Holiday"; forecast: string; previous: string };
type MarketData = { quotes: Quote[]; headlines: Headline[]; events: EconEvent[]; quote?: { text: string; by: string; source: string } | null; newsSource?: string; at: string };

let cache: { at: number; p: Promise<MarketData | null> } | null = null;
function loadMarket(force = false): Promise<MarketData | null> {
  if (!force && cache && Date.now() - cache.at < 5 * 60000) return cache.p;
  const p = authedFetch("/api/market").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  cache = { at: Date.now(), p };
  return p;
}

export function useMarket() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = (force = false) => {
    setLoading(true);
    loadMarket(force).then((d) => {
      setData(d);
      setLoading(false);
    });
  };
  useEffect(() => {
    reload();
    const id = setInterval(() => reload(true), 5 * 60000);
    return () => clearInterval(id);
  }, []);
  return { data, loading, reload };
}

const ago = (iso: string | null) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export function MarketPanel({ market }: { market: ReturnType<typeof useMarket> }) {
  const [tab, setTab] = useState<"all" | "XAU" | "BTC" | "MACRO">("all");
  const { data, loading } = market;
  const news = (data?.headlines ?? []).filter((h) => tab === "all" || h.tags.includes(tab)).slice(0, 8);
  return (
    <Card title="Markets & news" action={<Segmented size="xs" value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "XAU", label: "Gold" }, { value: "BTC", label: "BTC" }, { value: "MACRO", label: "Macro" }]} />}>
      <div className="grid grid-cols-2 gap-3">
        {(data?.quotes ?? [{ symbol: "XAU", label: "Gold", price: null, changePct: null, source: "" }, { symbol: "BTC", label: "Bitcoin", price: null, changePct: null, source: "" }] as Quote[])
          .slice()
          .sort((a) => (a.symbol === "XAU" ? -1 : 1))
          .map((q) => (
            <div key={q.symbol} className="rounded-xl bg-raised px-3 py-2.5">
              <div className="flex items-center justify-between text-xs text-mute"><span>{q.symbol === "XAU" ? "XAUUSD" : "BTCUSD"}</span><span>{q.source}</span></div>
              <div className="num mt-1 text-xl font-semibold">{q.price != null ? q.price.toLocaleString("en-US", { maximumFractionDigits: q.symbol === "XAU" ? 2 : 0 }) : loading ? "…" : "—"}</div>
              {q.changePct != null && <div className={`num text-xs ${q.changePct >= 0 ? "text-up" : "text-down"}`}>{q.changePct >= 0 ? "+" : "−"}{Math.abs(q.changePct).toFixed(2)}% today</div>}
            </div>
          ))}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {news.map((h) => (
          <li key={h.link} className="py-2.5">
            <a href={h.link} target="_blank" rel="noopener noreferrer" className="text-sm leading-snug hover:text-accent">{h.title}</a>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-mute">
              <span>{h.source}</span>
              {h.at && <span>· {ago(h.at)} ago</span>}
              {h.tags.map((t) => <Badge key={t} tone={t === "XAU" ? "accent" : t === "BTC" ? "warn" : "mute"}>{t === "XAU" ? "Gold" : t}</Badge>)}
            </div>
          </li>
        ))}
        {!loading && news.length === 0 && <li className="py-3 text-sm text-mute">No headlines right now.</li>}
      </ul>
      <p className="mt-2 text-[11px] text-mute">Prices: Kraken public API (gold via PAXG ≈ 1 oz) · News: {data?.newsSource ?? "—"}. Check your broker's quote before trading.</p>
    </Card>
  );
}

const DAY = 86400000;
const FLAG: Record<string, string> = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CNY: "🇨🇳", AUD: "🇦🇺", CAD: "🇨🇦", CHF: "🇨🇭", NZD: "🇳🇿", All: "🌐" };

function until(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 0) return m > -60 ? "just out" : "out";
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `in ${h}h ${m % 60 ? `${m % 60}m` : ""}`.trim() : `in ${Math.round(h / 24)}d`;
}

/** This week's market-moving events: pick a day, see its events with no-trade and caution windows (your time zone). */
export function EconWeek({ market }: { market: ReturnType<typeof useMarket> }) {
  const { accounts, plans, refresh, coachDb, reminders } = useData();
  const [filter, setFilter] = useState<"high" | "all">("high");
  const [msg, setMsg] = useState<string | null>(null);
  const events = market.data?.events ?? [];
  const now = new Date();
  const today = todayIST(now);
  const [sel, setSel] = useState(today);
  const windows = useMemo(() => riskWindows(events), [events]);
  const live = activeWindow(windows, now);

  const localDate = (iso: string) => todayIST(new Date(iso));
  const monday = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - dow * DAY);
  })();
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY).toISOString().slice(0, 10));
  const shown = events.filter((e) => (filter === "all" ? e.impact === "High" || e.impact === "Medium" : e.impact === "High"));
  const todaysTimes = newsTimesFor(events, today);
  const dayList = shown.filter((e) => localDate(e.at) === sel).sort((a, b) => a.at.localeCompare(b.at));
  const nextUp = shown.find((e) => new Date(e.at).getTime() > now.getTime());

  async function addToPlans() {
    setMsg(null);
    for (const a of accounts.filter((x) => x.status === "active")) {
      const plan = plans.find((p) => p.account_id === a.id && p.plan_date === today);
      const merged = [...new Set([...(plan?.news_times ?? []), ...todaysTimes])].sort().slice(0, 12);
      const { error } = await supabase.from("day_plans").upsert({ account_id: a.id, plan_date: today, news_times: merged }, { onConflict: "account_id,plan_date" });
      if (error) return setMsg(error.message);
    }
    setMsg(`Blocked ${todaysTimes.join(", ")} ${tzAbbr()} in today's plans — no entries ±15 min.`);
    refresh();
  }
  async function remind() {
    for (const e of events.filter((x) => x.impact === "High" && new Date(x.at).getTime() - 20 * 60000 > Date.now() && new Date(x.at).getTime() - Date.now() < 7 * DAY)) {
      const due = new Date(new Date(e.at).getTime() - 20 * 60000).toISOString();
      const text = `${e.country} ${e.title} in 20 min — no entries ±15 min`;
      if (reminders.some((r) => r.text === text && Math.abs(new Date(r.due_at).getTime() - new Date(due).getTime()) < 60000)) continue;
      await supabase.from("reminders").insert({ text, due_at: due, source: "manual" });
    }
    setMsg("Reminders set 20 min before each high-impact event this week.");
    refresh();
  }

  return (
    <Card
      title="Economic calendar"
      action={<Segmented size="xs" value={filter} onChange={setFilter} options={[{ value: "high", label: "High" }, { value: "all", label: "High + Med" }]} />}
    >
      {live ? (
        <div className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${live.kind === "no-trade" ? "bg-down/10 text-down" : "bg-warn/10 text-warn"}`}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
          <span className="min-w-0 flex-1 truncate">{live.kind === "no-trade" ? "No-trade window" : "Caution window"} · {live.event.title}</span>
          <span className="num shrink-0 text-xs">until {fmtIST(new Date(live.to), false)}</span>
        </div>
      ) : nextUp ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
          <span className="text-xs text-mute">Next</span>
          <span className="min-w-0 flex-1 truncate">{FLAG[nextUp.country] ?? ""} {nextUp.title}</span>
          <span className="num shrink-0 text-xs font-semibold">{until(new Date(nextUp.at).getTime() - now.getTime())}</span>
        </div>
      ) : null}

      {/* Day picker */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Day">
        {days.map((d) => {
          const list = shown.filter((e) => localDate(e.at) === d);
          const high = list.filter((e) => e.impact === "High").length;
          const med = list.length - high;
          const on = d === sel;
          const dt = new Date(`${d}T00:00:00Z`);
          return (
            <button
              key={d}
              role="tab"
              aria-selected={on}
              onClick={() => setSel(d)}
              className={`flex min-w-[52px] flex-1 flex-col items-center rounded-2xl px-2 py-2 transition ${on ? "bg-ink text-bg" : d < today ? "text-mute/60 hover:bg-raised" : "hover:bg-raised"}`}
            >
              <span className={`text-[10px] font-medium uppercase tracking-wide ${on ? "" : "text-mute"}`}>{d === today ? "Today" : dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
              <span className="num text-base font-semibold">{dt.getUTCDate()}</span>
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                {Array.from({ length: Math.min(high, 4) }).map((_, i) => <span key={`h${i}`} className="h-1.5 w-1.5 rounded-full bg-down" />)}
                {Array.from({ length: Math.min(med, 3 - Math.min(high, 3)) }).map((_, i) => <span key={`m${i}`} className="h-1.5 w-1.5 rounded-full bg-warn" />)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Events of the selected day */}
      <ul className="mt-3 space-y-2">
        {dayList.map((e) => {
          const t = new Date(e.at).getTime();
          const past = t < now.getTime() - 3600000;
          const w = windows.find((x) => x.event === e && x.kind === "no-trade") ?? windows.find((x) => x.event === e);
          return (
            <li key={e.title + e.at} className={`flex gap-3 rounded-2xl border border-line p-3 ${past ? "opacity-50" : ""}`}>
              <div className="w-14 shrink-0">
                <div className="num text-[15px] font-semibold leading-tight">{fmtIST(e.at, false)}</div>
                <div className="num mt-0.5 text-[11px] text-mute">{until(t - now.getTime())}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{e.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.impact === "High" ? "bg-down/15 text-down" : "bg-warn/15 text-warn"}`}>{e.impact}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-mute">
                  <span>{FLAG[e.country] ?? ""} {e.country}</span>
                  {e.forecast && <span>Forecast <b className="num font-medium text-ink">{e.forecast}</b></span>}
                  {e.previous && <span>Prev <b className="num font-medium text-ink">{e.previous}</b></span>}
                </div>
                {w && (
                  <div className={`num mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] ${w.kind === "no-trade" ? "bg-down/10 text-down" : "bg-warn/10 text-warn"}`}>
                    {w.kind === "no-trade" ? "No entries" : "Caution"} {fmtIST(new Date(w.from), false)}–{fmtIST(new Date(w.to), false)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {!market.loading && events.length > 0 && dayList.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-mute">No {filter === "high" ? "high-impact " : ""}events — a clean day for price action.</li>
        )}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="hidden text-mute md:inline">Times in {tzAbbr()} · no entries ±15 min · caution 30–60 min after</span>
        <span className="hidden flex-1 md:block" />
        {todaysTimes.length > 0 && <button className="btn-ghost h-10 min-h-0 flex-1 text-xs md:h-8 md:flex-none" onClick={addToPlans}>Block today's times</button>}
        {coachDb && <button className="btn-ghost h-10 min-h-0 flex-1 text-xs md:h-8 md:flex-none" onClick={remind}>Remind me before each</button>}
      </div>
      {msg && <p className="mt-2 text-xs text-up">{msg}</p>}
      {!market.loading && !events.length && <p className="text-sm text-mute">Calendar unavailable right now.</p>}
      <p className="mt-2 text-[11px] text-mute">Source: Forex Factory weekly calendar.</p>
    </Card>
  );
}

export type { RiskWindow };
