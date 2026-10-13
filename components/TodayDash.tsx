"use client";

import { getTimeZone } from "@/lib/tz";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useData, Icon } from "@/components/Shell";
import { Modal } from "@/components/ui";
import { DayBars, Radar, ScoreGauge, SmoothArea } from "@/components/Dash";
import { accountState, disciplineScore, fmtIST, fmtR, fmtUsd, msToWindow, sessionAt, stats, todayIST, weekStartIST, windowLabel, windowOpen } from "@/lib/calc";
import { scoreAxes, streaks } from "@/lib/analysis";
import { nudges } from "@/lib/nudges";
import { quoteOfDay } from "@/lib/quotes";
import { useMarket } from "@/components/Market";
import { riskWindows } from "@/lib/events";
import type { Trade } from "@/lib/types";
import type { EconEvent } from "@/components/Market";

const DAY = 864e5;
const closedDay = (t: Trade) => todayIST(new Date(t.closed_at ?? t.opened_at));
const fmtDur = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/* ---------------- greeting + quote ---------------- */

export function Greeting({ now, onStart }: { now: Date; onStart: () => void }) {
  const { session, profile } = useData();
  const market = useMarket();
  const name = profile?.display_name?.trim() || (session.user.user_metadata?.name as string | undefined)?.trim();
  const h = Number(fmtIST(now, false).slice(0, 2));
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const local = quoteOfDay(todayIST(now));
  const zen = market.data?.quote;
  const quote = zen ? { text: zen.text, by: zen.by, note: undefined } : local.quote;
  const principle = local.principle;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">{part}{name ? `, ${name}` : ""}!</h1>
        <div className="flex gap-2">
          <button onClick={onStart} className="btn-primary h-11 px-5">
            <Icon d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2-.1-2.8a2 2 0 0 0-2.9-.2zM12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z" />
            Start my day
          </button>
          <Link href="/new" className="btn-accent h-11 px-5">+ New trade</Link>
        </div>
      </div>
      <section className="card flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Today's quote</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-snug">“{quote.text}” <span className="font-normal text-mute">— {quote.by}{quote.note ? ` (${quote.note})` : ""}</span></p>
          <p className="mt-1 text-xs text-mute"><span className="font-medium text-ink">A+ principle:</span> {principle}</p>
          {zen && <p className="mt-1 text-[10px] text-mute/80">Quote provided by <a href="https://zenquotes.io/" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">ZenQuotes API</a></p>}
        </div>
      </section>
    </div>
  );
}

/* ---------------- score + KPIs ---------------- */

export function ScorePanel({ now }: { now: Date }) {
  const { trades } = useData();
  const disc = useMemo(() => disciplineScore(trades), [trades]);
  const s = useMemo(() => stats(trades.filter((t) => now.getTime() - new Date(t.opened_at).getTime() < 30 * DAY)), [trades, now]);
  const st = streaks(trades);
  const pf = s.profitFactor == null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2);
  const kpis = [
    { label: "Net P&L · 30d", value: fmtUsd(s.net, true), tone: s.net > 0 ? "text-up" : s.net < 0 ? "text-down" : "", icon: "M4 20V10M10 20V4M16 20v-7" },
    { label: "Win rate", value: s.n ? `${Math.round(s.winRate * 100)}%` : "—", tone: "", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" },
    { label: "Profit factor", value: pf, tone: "", icon: "M3 3v18h18M7 14l4-4 4 4 5-5" },
    { label: "Expectancy", value: s.n ? fmtR(s.avgR) : "—", tone: s.avgR > 0 ? "text-up" : s.avgR < 0 ? "text-down" : "", icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] text-mute">Discipline score</div>
            <div className="num mt-0.5 text-[34px] font-semibold leading-none">{disc.score ?? "—"}</div>
          </div>
          <span className={`num rounded-full px-2.5 py-1 text-xs ${st.current > 0 ? "bg-up/10 text-up" : st.current < 0 ? "bg-down/10 text-down" : "bg-raised text-mute"}`}>
            {st.current > 0 ? `${st.current}W streak` : st.current < 0 ? `${-st.current}L streak` : "no streak"}
          </span>
        </div>
        <div className="mt-4"><ScoreGauge value={disc.score} /></div>
        <p className="mt-2 text-[11px] text-mute">{disc.status === "ready" ? `Last ${disc.sample} trades` : `${disc.status} · ${disc.sample} trades (full at 30)`} · gate 30% · risk 25% · no override 25% · no mistakes 20%</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-raised"><Icon d={k.icon} /></span>
            <div className="mt-3 text-xs text-mute">{k.label}</div>
            <div className={`num mt-0.5 text-[19px] font-semibold ${k.tone}`}>{k.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- cumulative P&L ---------------- */

export function PnlCurve({ now }: { now: Date }) {
  const { trades, accounts } = useData();
  const [acct, setAcct] = useState<string>("all");
  const [range, setRange] = useState<"30" | "90" | "all">("30");
  const closed = trades.filter((t) => t.status === "closed" && t.net_pnl != null && (acct === "all" || t.account_id === acct));
  const since = range === "all" ? "" : todayIST(new Date(now.getTime() - Number(range) * DAY));
  const byDay = new Map<string, number>();
  for (const t of closed) byDay.set(closedDay(t), (byDay.get(closedDay(t)) ?? 0) + Number(t.net_pnl));
  const daysSorted = [...byDay.keys()].sort();
  let cum = daysSorted.filter((d) => d < since).reduce((s, d) => s + byDay.get(d)!, 0);
  const pts = daysSorted.filter((d) => d >= since).map((d) => ({ t: Date.parse(`${d}T00:00:00Z`), v: (cum += byDay.get(d)!) }));
  const today = todayIST(now), week = weekStartIST(now), month = today.slice(0, 7);
  const sum = (f: (d: string) => boolean) => [...byDay.entries()].filter(([d]) => f(d)).reduce((s, [, v]) => s + v, 0);
  const figs = [
    { l: "Today", v: sum((d) => d === today) },
    { l: "This week", v: sum((d) => d >= week) },
    { l: "This month", v: sum((d) => d.startsWith(month)) },
  ];
  const chip = (on: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-xs transition ${on ? "bg-solid text-solid-ink" : "bg-raised text-mute hover:text-ink"}`;
  return (
    <div className="card flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight">Cumulative net P&amp;L</h2>
        <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <button className={chip(acct === "all")} onClick={() => setAcct("all")}>All</button>
          {accounts.filter((a) => a.status === "active").map((a) => <button key={a.id} className={chip(acct === a.id)} onClick={() => setAcct(a.id)}>{a.instrument}</button>)}
          <span className="mx-1 w-px bg-line" />
          {(["30", "90", "all"] as const).map((r) => <button key={r} className={chip(range === r)} onClick={() => setRange(r)}>{r === "all" ? "All" : `${r}D`}</button>)}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:gap-8">
        {figs.map((f) => (
          <div key={f.l}>
            <div className="text-xs text-mute">{f.l}</div>
            <div className={`num text-[15px] font-semibold sm:text-lg ${f.v > 0 ? "text-up" : f.v < 0 ? "text-down" : ""}`}>{fmtUsd(f.v, true)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex-1">
        <SmoothArea points={pts} height={230} format={(v) => fmtUsd(v, true)} label={(t) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} />
      </div>
    </div>
  );
}

/* ---------------- daily bars, radar, trades ---------------- */

export function DailyPnl({ now }: { now: Date }) {
  const { trades } = useData();
  const since = todayIST(new Date(now.getTime() - 45 * DAY));
  const m = new Map<string, number>();
  for (const t of trades) if (t.status === "closed" && t.net_pnl != null && closedDay(t) >= since) m.set(closedDay(t), (m.get(closedDay(t)) ?? 0) + Number(t.net_pnl));
  const days = [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ d, v }));
  const green = days.filter((x) => x.v > 0).length;
  return (
    <div className="card h-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight">Net daily P&amp;L</h2>
        <span className="num text-xs text-mute">{days.length ? `${green}/${days.length} green days` : ""}</span>
      </div>
      <div className="mt-4"><DayBars days={days} height={190} format={(v) => fmtUsd(v, true)} /></div>
    </div>
  );
}

export function OverallScore({ now }: { now: Date }) {
  const { trades } = useData();
  const disc = disciplineScore(trades).score;
  const cur = scoreAxes(trades.filter((t) => now.getTime() - new Date(t.opened_at).getTime() < 30 * DAY), disc);
  const prevTrades = trades.filter((t) => { const a = now.getTime() - new Date(t.opened_at).getTime(); return a >= 30 * DAY && a < 60 * DAY; });
  const prev = prevTrades.length ? scoreAxes(prevTrades, disc) : undefined;
  const avg = Math.round((cur.reduce((s, a) => s + a.value, 0) / cur.length) * 100);
  return (
    <div className="card h-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight">Overall score</h2>
        <span className="num text-lg font-semibold">{avg}</span>
      </div>
      <Radar axes={cur} prev={prev} />
      <div className="flex justify-center gap-4 text-[11px] text-mute">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-chart" />Last 30d</span>
        {prev && <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 border-t-2 border-dashed border-accent" />Prior 30d</span>}
      </div>
    </div>
  );
}

export function TradesTable({ onOpen }: { onOpen: (t: Trade) => void }) {
  const { trades, accounts } = useData();
  const [tab, setTab] = useState<"recent" | "open">("recent");
  const open = trades.filter((t) => t.status === "open");
  const rows = tab === "open" ? open : trades.filter((t) => t.status === "closed").slice(0, 7);
  return (
    <div className="card h-full p-5">
      <div className="flex gap-4 border-b border-line pb-2.5 text-[13px]">
        <button onClick={() => setTab("recent")} className={tab === "recent" ? "font-semibold text-ink" : "text-mute hover:text-ink"}>Recent trades</button>
        <button onClick={() => setTab("open")} className={tab === "open" ? "font-semibold text-ink" : "text-mute hover:text-ink"}>Open positions{open.length ? ` (${open.length})` : ""}</button>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-mute">{tab === "open" ? "No open positions." : "No closed trades yet."}</p>
      ) : (
        <ul>
          {rows.map((t) => (
            <li key={t.id}>
              <button onClick={() => onOpen(t)} className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-line/70 py-2.5 text-left text-[13px] last:border-0 hover:text-ink">
                <span className="text-mute">{new Date(t.opened_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: getTimeZone() })}</span>
                <span className="truncate">
                  <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${t.direction === "long" ? "bg-up" : "bg-down"}`} />
                  {t.instrument.replace("USDT.P", "")}
                </span>
                <span className={`num ${t.status === "open" ? "text-mute" : Number(t.r_multiple) >= 0 ? "text-up" : "text-down"}`}>
                  {t.status === "open" ? `${fmtR(t.rr_planned)} plan` : `${fmtR(t.r_multiple)} · ${fmtUsd(t.net_pnl, true)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link href="/trades" className="mt-2 inline-block text-xs text-mute hover:text-ink">All trades →</Link>
    </div>
  );
}

/* ---------------- right rail ---------------- */

export function StatusCard({ now }: { now: Date }) {
  const { accounts, trades, payouts, plans, adjustments } = useData();
  const today = todayIST(now);
  const states = accounts.filter((a) => a.status === "active").map((a) => {
    const plan = plans.find((p) => p.account_id === a.id && p.plan_date === today) ?? null;
    return { a, plan, s: accountState(a, trades, payouts, now, { plan, adjustments }), open: windowOpen(a, now, plan), wait: msToWindow(a, now, plan) };
  });
  const slots = states.reduce((n, x) => n + (x.s.canTrade ? x.s.tradesLeft : 0), 0);
  const next = states.filter((x) => !x.open && x.wait > 0).sort((a, b) => a.wait - b.wait)[0];
  const openNow = states.filter((x) => x.open && x.a.status === "active");
  const sess = sessionAt(now);
  const progress = next ? Math.max(4, 100 - (next.wait / (6 * 3600000)) * 100) : 100;
  return (
    <div className="solid-card p-5">
      <div className="text-lg font-semibold">Today's status</div>
      <div className="mt-0.5 text-[13px] text-[#9AA0AA]">
        {slots ? `${slots} A+ slot${slots > 1 ? "s" : ""}` : "No slots — protect the account"} · {sess.inWindow ? `${sess.name} Q-zone` : "off-session"}
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#E5E7EB] transition-all" style={{ width: `${Math.min(100, progress)}%` }} /></div>
      <div className="mt-3 text-center text-sm font-semibold">
        {openNow.length ? `Window open: ${openNow.map((x) => x.a.instrument).join(" · ")}` : next ? `${windowLabel(next.a, next.plan)} opens in` : "Window open all day"}
      </div>
      {next && !openNow.length && <div className="num text-center text-sm text-[#C7CBD2]">{fmtDur(next.wait)} · {next.a.instrument}</div>}
      <ul className="mt-4 space-y-1.5 text-xs">
        {states.map(({ a, s }) => (
          <li key={a.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-[#C7CBD2]">{a.instrument}</span>
            <span className={`num ${s.canTrade ? "text-[#34D399]" : s.reasons.every((r) => r.startsWith("Outside your")) ? "text-[#C7CBD2]" : "text-[#FB7185]"}`}>{s.canTrade ? `${s.tradesLeft} left · ${fmtUsd(s.riskUsd)}` : s.reasons.every((r) => r.startsWith("Outside your")) ? "off-session" : "done today"}</span>
          </li>
        ))}
      </ul>
      <Link href="/plan" className="mt-4 block rounded-xl bg-[#F3F4F6] py-2.5 text-center text-sm font-semibold text-[#111214] hover:opacity-90">Open today's plan</Link>
    </div>
  );
}

export function TodoList({ now }: { now: Date }) {
  const data = useData();
  const list = useMemo(
    () => nudges(now, { accounts: data.accounts, plans: data.plans, trades: data.trades, reminders: data.reminders, reviews: data.reviews }),
    [now, data.accounts, data.plans, data.trades, data.reminders, data.reviews],
  );
  const checked = data.checkins.some((c) => c.checkin_date === todayIST(now));
  const items = [...(data.coachDb && !checked ? [{ id: "ci", text: "Mental check-in", href: "#checkin", level: "warn" as const }] : []), ...list].slice(0, 6);
  const icon = (id: string) =>
    id.startsWith("plan") ? "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"
    : id.startsWith("news") ? "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
    : id.startsWith("win") ? "M12 8v4l3 3M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"
    : id === "ci" ? "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"
    : id.startsWith("review") || id.startsWith("unrev") ? "M5 4h14v16l-7-4-7 4z"
    : "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9";
  return (
    <div className="px-1">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">Your to-do list</h2>
      {items.length === 0 ? (
        <p className="text-sm text-mute">All clear. Let price come to your levels.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className="flex items-center gap-3 rounded-2xl p-1.5 transition hover:bg-panel">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-rail text-[#F3F4F6]"><Icon d={icon(n.id)} className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug">{n.text}</span>
                  <span className={`block text-xs ${n.level === "due" ? "text-down" : "text-mute"}`}>{n.level === "due" ? "Overdue" : n.level === "warn" ? "Today" : "When you can"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NextEventCard({ events, now }: { events: EconEvent[]; now: Date }) {
  const next = events.filter((e) => e.impact === "High" && new Date(e.at).getTime() > now.getTime() - 3600000).sort((a, b) => a.at.localeCompare(b.at))[0];
  if (!next) return null;
  const w = riskWindows([next]);
  const nt = w.find((x) => x.kind === "no-trade");
  const ct = w.find((x) => x.kind === "caution");
  const live = nt && now.getTime() >= nt.from && now.getTime() <= nt.to;
  return (
    <div className="solid-card p-5">
      <div className="text-[15px] font-semibold">{next.country} {next.title}</div>
      <div className="mt-1 flex items-center gap-2 text-[13px]">
        <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-[#FB7185]" : "bg-[#FB7185]"}`} />
        {new Date(next.at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: getTimeZone() })} at {fmtIST(next.at, false)} IST
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#9AA0AA]">
        {nt && <>No entries {fmtIST(new Date(nt.from), false)}–{fmtIST(new Date(nt.to), false)}. </>}
        {ct && <>Caution until {fmtIST(new Date(ct.to), false)} — wait for the first 15M close.</>}
        {next.forecast && <> Forecast {next.forecast} · prior {next.previous}.</>}
      </p>
    </div>
  );
}

/* ---------------- Start my day ---------------- */

export function StartDay({ open, onClose, now }: { open: boolean; onClose: () => void; now: Date }) {
  const { accounts, plans, checkins, coachDb } = useData();
  const today = todayIST(now);
  const active = accounts.filter((a) => a.status === "active");
  const steps = [
    ...(coachDb ? [{ done: checkins.some((c) => c.checkin_date === today), title: "Mental check-in", sub: "30 seconds — are you fit to trade today?", href: "/#checkin" }] : []),
    { done: false, title: "Read today's outlook", sub: "Drivers, what to look for, no-trade conditions", href: "/#outlook" },
    { done: active.every((a) => plans.find((p) => p.account_id === a.id && p.plan_date === today)?.news_times?.length), title: "Block news windows", sub: "Economic calendar → Block today's times", href: "/#calendar" },
    ...active.map((a) => {
      const p = plans.find((x) => x.account_id === a.id && x.plan_date === today);
      return { done: !!p && Object.values(p.checklist ?? {}).filter(Boolean).length >= 6, title: `Plan ${a.instrument}`, sub: "Bias, range, magnet, POIs, sessions — or dictate it", href: `/plan?account=${a.id}` };
    }),
    { done: false, title: "Set alerts and walk away", sub: "Price comes to your POIs. Not the other way round.", href: "/new" },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <Modal open={open} onClose={onClose} title="Start my day">
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-chart transition-all" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link href={s.href} onClick={onClose} className="flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:bg-raised">
              <span className={`num grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-semibold ${s.done ? "bg-up/15 text-up" : "bg-rail text-[#F3F4F6]"}`}>{s.done ? "✓" : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${s.done ? "text-mute line-through" : ""}`}>{s.title}</span>
                <span className="block text-xs text-mute">{s.sub}</span>
              </span>
              <span className="text-mute">→</span>
            </Link>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
