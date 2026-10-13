"use client";

import { useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/coach";
import { riskWindows, newsTimesFor, activeWindow, type RiskWindow } from "@/lib/events";
import { todayIST, fmtIST } from "@/lib/calc";
import { supabase } from "@/lib/supabase";
import { useData } from "@/components/Shell";
import { Badge, Card, Segmented } from "@/components/ui";

export type Quote = { symbol: "BTC" | "XAU"; label: string; price: number | null; changePct: number | null; source: string };
export type Headline = { title: string; link: string; source: string; at: string | null; tags: ("BTC" | "XAU" | "MACRO")[] };
export type EconEvent = { title: string; country: string; at: string; impact: "High" | "Medium" | "Low" | "Holiday"; forecast: string; previous: string };
type MarketData = { quotes: Quote[]; headlines: Headline[]; events: EconEvent[]; at: string };

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
      <p className="mt-2 text-[11px] text-mute">Gold price via PAXG (≈1 oz) — check your broker's quote before trading.</p>
    </Card>
  );
}

const DAY = 86400000;

/** Mon–Sun grid of this week's market-moving events with no-trade (±15m) and caution windows, in IST. */
export function EconWeek({ market }: { market: ReturnType<typeof useMarket> }) {
  const { accounts, plans, refresh, coachDb, reminders } = useData();
  const [filter, setFilter] = useState<"high" | "all">("high");
  const [msg, setMsg] = useState<string | null>(null);
  const events = market.data?.events ?? [];
  const now = new Date();
  const today = todayIST(now);
  const windows = useMemo(() => riskWindows(events), [events]);
  const live = activeWindow(windows, now);

  const istDate = (iso: string) => todayIST(new Date(iso));
  const monday = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - dow * DAY);
  })();
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY).toISOString().slice(0, 10));
  const shown = events.filter((e) => (filter === "all" ? e.impact !== "Low" : e.impact === "High"));
  const todaysTimes = newsTimesFor(events, today);

  async function addToPlans() {
    setMsg(null);
    for (const a of accounts.filter((x) => x.status === "active")) {
      const plan = plans.find((p) => p.account_id === a.id && p.plan_date === today);
      const merged = [...new Set([...(plan?.news_times ?? []), ...todaysTimes])].sort().slice(0, 12);
      const { error } = await supabase.from("day_plans").upsert({ account_id: a.id, plan_date: today, news_times: merged }, { onConflict: "account_id,plan_date" });
      if (error) return setMsg(error.message);
    }
    setMsg(`Added ${todaysTimes.join(", ")} IST to today's plans — entries blocked ±15 min.`);
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
      title="This week · economic calendar (IST)"
      action={<Segmented size="xs" value={filter} onChange={setFilter} options={[{ value: "high", label: "High" }, { value: "all", label: "High + Med" }]} />}
    >
      {live && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${live.kind === "no-trade" ? "bg-down/10 text-down" : "bg-warn/10 text-warn"}`}>
          {live.kind === "no-trade" ? "No-trade window now" : "Caution window now"} — {live.event.title} ({fmtIST(new Date(live.from), false)}–{fmtIST(new Date(live.to), false)})
        </div>
      )}
      {/* Phones: agenda list */}
      <ul className="space-y-3 md:hidden">
        {days.map((d) => {
          const list = shown.filter((e) => istDate(e.at) === d && new Date(e.at).getTime() > now.getTime() - 2 * 3600000);
          if (!list.length) return null;
          return (
            <li key={d}>
              <div className={`mb-1.5 text-xs font-semibold ${d === today ? "text-accent" : "text-mute"}`}>
                {d === today ? "Today" : new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}
              </div>
              <ul className="space-y-1.5">
                {list.map((e) => {
                  const w = windows.find((x) => x.event === e && x.kind === "no-trade") ?? windows.find((x) => x.event === e);
                  return (
                    <li key={e.title + e.at} className="flex items-center gap-3 rounded-2xl bg-raised px-3 py-2.5">
                      <span className="num w-12 shrink-0 text-sm font-semibold">{fmtIST(e.at, false)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{e.country} · {e.title}</span>
                        {w && <span className={`num block text-xs ${w.kind === "no-trade" ? "text-down" : "text-warn"}`}>{w.kind === "no-trade" ? "No entries" : "Caution"} {fmtIST(new Date(w.from), false)}–{fmtIST(new Date(w.to), false)}</span>}
                      </span>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${e.impact === "High" ? "bg-down" : "bg-warn"}`} aria-label={`${e.impact} impact`} />
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
        {!shown.some((e) => new Date(e.at).getTime() > now.getTime() - 2 * 3600000) && <li className="text-sm text-mute">No more {filter === "high" ? "high-impact " : ""}events this week.</li>}
      </ul>

      <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
        <div className="grid min-w-[640px] grid-cols-7 gap-1.5">
          {days.map((d) => {
            const list = shown.filter((e) => istDate(e.at) === d);
            const isToday = d === today;
            return (
              <div key={d} className={`min-h-28 rounded-xl border p-2 ${isToday ? "border-accent/50 bg-accent/5" : "border-line"}`}>
                <div className={`mb-1.5 text-[11px] font-medium ${isToday ? "text-accent" : "text-mute"}`}>
                  {new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" })}
                </div>
                <ul className="space-y-1">
                  {list.map((e) => {
                    const w = windows.find((x) => x.event === e && x.kind === "no-trade") ?? windows.find((x) => x.event === e);
                    const past = new Date(e.at).getTime() < now.getTime() - 3600000;
                    return (
                      <li key={e.title + e.at} className={`rounded-md px-1.5 py-1 text-[11px] leading-tight ${e.impact === "High" ? "bg-down/10" : "bg-warn/10"} ${past ? "opacity-45" : ""}`} title={`${e.title}${e.forecast ? ` · f ${e.forecast} · p ${e.previous}` : ""}`}>
                        <div className="num font-medium">{fmtIST(e.at, false)} <span className="text-mute">{e.country}</span></div>
                        <div className="line-clamp-2">{e.title}</div>
                        {w && <div className={`num mt-0.5 ${w.kind === "no-trade" ? "text-down" : "text-warn"}`}>{w.kind === "no-trade" ? "⛔" : "⚠"} {fmtIST(new Date(w.from), false)}–{fmtIST(new Date(w.to), false)}</div>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="hidden text-mute md:inline">⛔ no entries · ⚠ caution (wait 30–60 min after high impact)</span>
        <span className="hidden flex-1 md:block" />
        {todaysTimes.length > 0 && <button className="btn-ghost h-10 min-h-0 flex-1 text-xs md:h-8 md:flex-none" onClick={addToPlans}>Block today's times</button>}
        {coachDb && <button className="btn-ghost h-10 min-h-0 flex-1 text-xs md:h-8 md:flex-none" onClick={remind}>Remind me before each</button>}
      </div>
      {msg && <p className="mt-2 text-xs text-up">{msg}</p>}
      {!market.loading && !events.length && <p className="text-sm text-mute">Calendar unavailable right now.</p>}
    </Card>
  );
}

export type { RiskWindow };
