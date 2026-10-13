"use client";

import { getTimeZone } from "@/lib/tz";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Card, Chips } from "@/components/ui";
import { Ring } from "@/components/Charts";
import VoiceButton from "@/components/Voice";
import { ActionChips, CoachSetupNote, Markdown, Sparkle } from "@/components/coach-ui";
import { askCoach, asList, asObjects, asText, useCoachStatus, type CoachResult } from "@/lib/coach";
import { disciplineScore, fmtR, fmtUsd, stats, todayIST, weekStartIST, fmtIST } from "@/lib/calc";
import { streaks, matchLessons } from "@/lib/analysis";
import { nudges } from "@/lib/nudges";
import { quoteOfDay } from "@/lib/quotes";
import { supabase } from "@/lib/supabase";
import { ALL_FEELINGS, type Checkin, type CoachAction, type Trade } from "@/lib/types";

/* ---------------- quote of the day ---------------- */

export function QuoteHero({ now }: { now: Date }) {
  const today = todayIST(now);
  const { quote, principle } = quoteOfDay(today);
  const hour = Number(fmtIST(now, false).slice(0, 2));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <section className="coach relative overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
        <span className="font-medium uppercase tracking-[0.12em] text-accent">Today's quote</span>
        <span>{greet} · {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: getTimeZone() })}</span>
      </div>
      <blockquote className="mt-3 max-w-3xl text-[19px] font-medium leading-snug tracking-tight sm:text-[22px]">“{quote.text}”</blockquote>
      <div className="mt-2 text-sm text-mute">— {quote.by}{quote.note ? <span className="opacity-80"> ({quote.note})</span> : null}</div>
      <div className="mt-4 flex items-start gap-2 border-t border-accent/20 pt-3 text-sm">
        <span className="mt-0.5 shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-accent">A+ principle</span>
        <span>{principle}</span>
      </div>
    </section>
  );
}

/* ---------------- P&L + scores snapshot ---------------- */

const closedIst = (t: Trade) => todayIST(new Date(t.closed_at ?? t.opened_at));

export function Snapshot({ now }: { now: Date }) {
  const { trades, accounts } = useData();
  const today = todayIST(now);
  const week = weekStartIST(now);
  const month = today.slice(0, 7);
  const closed = trades.filter((t) => t.status === "closed" && t.net_pnl != null);
  const sum = (ts: Trade[]) => ({ usd: ts.reduce((s, t) => s + Number(t.net_pnl), 0), r: ts.reduce((s, t) => s + Number(t.r_multiple ?? 0), 0), n: ts.length });
  const periods = [
    { label: "Today", f: (t: Trade) => closedIst(t) === today },
    { label: "This week", f: (t: Trade) => closedIst(t) >= week },
    { label: "This month", f: (t: Trade) => closedIst(t).startsWith(month) },
  ];
  const disc = useMemo(() => disciplineScore(trades), [trades]);
  const s30 = useMemo(() => stats(trades.filter((t) => now.getTime() - new Date(t.opened_at).getTime() < 30 * 864e5)), [trades, now]);
  const st = useMemo(() => streaks(trades), [trades]);
  const active = accounts.filter((a) => a.status === "active");

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {periods.map((p) => {
        const all = sum(closed.filter(p.f));
        return (
          <div key={p.label} className="card p-4">
            <div className="label">{p.label}</div>
            <div className={`num mt-1.5 text-2xl font-semibold ${all.usd > 0 ? "text-up" : all.usd < 0 ? "text-down" : ""}`}>{fmtUsd(all.usd, true)}</div>
            <div className="num text-xs text-mute">{fmtR(all.r)} · {all.n} trade{all.n === 1 ? "" : "s"}</div>
            <div className="mt-2.5 space-y-1 border-t border-line pt-2">
              {active.map((a) => {
                const x = sum(closed.filter((t) => t.account_id === a.id && p.f(t)));
                return (
                  <div key={a.id} className="flex justify-between text-xs">
                    <span className="truncate text-mute">{a.instrument}</span>
                    <span className={`num ${x.usd > 0 ? "text-up" : x.usd < 0 ? "text-down" : "text-mute"}`}>{fmtUsd(x.usd, true)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="card flex items-center gap-4 p-4">
        <Ring value={disc.score} label={disc.status === "ready" ? "discipline" : disc.status} />
        <div className="min-w-0 space-y-1 text-xs">
          <div className="flex justify-between gap-3"><span className="text-mute">A+ rate 30d</span><span className="num">{s30.n ? `${Math.round(s30.aPlusRate * 100)}%` : "—"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-mute">Expectancy</span><span className="num">{s30.n ? fmtR(s30.avgR) : "—"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-mute">Win rate</span><span className="num">{s30.n ? `${Math.round(s30.winRate * 100)}%` : "—"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-mute">Streak</span><span className={`num ${st.current > 0 ? "text-up" : st.current < 0 ? "text-down" : ""}`}>{st.current > 0 ? `${st.current}W` : st.current < 0 ? `${-st.current}L` : "—"}</span></div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- pending & overdue ---------------- */

export function ActionsPanel({ now }: { now: Date }) {
  const data = useData();
  const list = useMemo(
    () => nudges(now, { accounts: data.accounts, plans: data.plans, trades: data.trades, reminders: data.reminders, reviews: data.reviews }),
    [now, data.accounts, data.plans, data.trades, data.reminders, data.reviews],
  );
  const hasCheckin = data.checkins.some((c) => c.checkin_date === todayIST(now));
  const items = [...(data.coachDb && !hasCheckin ? [{ id: "checkin", text: "Do your 30-second mental check-in", href: "#checkin", level: "warn" as const }] : []), ...list];
  return (
    <Card title={`Actions · ${items.length} pending`}>
      {items.length === 0 ? (
        <p className="text-sm text-mute">All clear. Wait for price to come to your levels.</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 9).map((n) => (
            <li key={n.id}>
              <Link href={n.href} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-raised">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.level === "due" ? "bg-down" : n.level === "warn" ? "bg-accent" : "bg-mute"}`} />
                <span className="flex-1">{n.text}</span>
                {n.level === "due" && <Badge tone="down">overdue</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- lessons to keep in mind ---------------- */

export function DontRepeat() {
  const { lessons, coachDb } = useData();
  if (!coachDb) return null;
  const top = matchLessons(lessons, {}, 4);
  return (
    <Card title="Don't repeat" action={<Link href="/coach" className="text-xs text-mute hover:text-ink">All lessons →</Link>}>
      {top.length === 0 ? (
        <p className="text-sm text-mute">No lessons yet. Close a trade and run “Why did this win/lose?” to start building them.</p>
      ) : (
        <ul className="space-y-2.5 text-sm">
          {top.map((l) => (
            <li key={l.id}>
              <div className="leading-snug">{l.title}</div>
              {l.rule && <div className="mt-0.5 text-xs text-accent">→ {l.rule}</div>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- daily mental check-in ---------------- */

const SCALE = [1, 2, 3, 4, 5];
function Scale({ label, value, onChange, lowGood = false }: { label: string; value: number | null; onChange: (v: number) => void; lowGood?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-mute">{label}</span>
      <div className="flex gap-1">
        {SCALE.map((n) => {
          const on = value === n;
          const good = lowGood ? n <= 2 : n >= 4;
          const bad = lowGood ? n >= 4 : n <= 2;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`num h-10 w-10 rounded-xl border text-sm transition sm:h-8 sm:w-8 sm:rounded-lg sm:text-xs ${on ? (good ? "border-up bg-up/15 text-up" : bad ? "border-down bg-down/15 text-down" : "border-accent bg-accent/15 text-ink") : "border-line text-mute hover:text-ink"}`}
              aria-pressed={on}
              aria-label={`${label} ${n} of 5`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CheckinCard({ now }: { now: Date }) {
  const { checkins, refresh, coachDb } = useData();
  const today = todayIST(now);
  const existing = checkins.find((c) => c.checkin_date === today);
  const [c, setC] = useState<Partial<Checkin>>(existing ?? { emotions: [] });
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(!existing);
  const status = useCoachStatus();
  useEffect(() => {
    if (existing) setC(existing);
  }, [existing]);
  if (!coachDb) return null;

  const readiness = (() => {
    const xs = [c.mood, c.energy, c.focus, c.stress != null ? 6 - c.stress : null].filter((x): x is number => x != null);
    return xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length / 5) * 100) : null;
  })();

  async function save() {
    const row = {
      checkin_date: today, mood: c.mood ?? null, energy: c.energy ?? null, focus: c.focus ?? null, stress: c.stress ?? null,
      sleep_hours: c.sleep_hours ?? null, emotions: c.emotions ?? [], note: c.note?.slice(0, 2000) || null,
    };
    const { error } = await supabase.from("checkins").upsert(row, { onConflict: "user_id,checkin_date" });
    if (!error) {
      setSaved(true);
      setOpen(false);
      refresh();
    }
  }

  async function fromVoice(text: string) {
    setC((x) => ({ ...x, note: [x.note, text].filter(Boolean).join(" ") }));
    if (!status?.enabled) return;
    const r = await askCoach("parse", { payload: { text, target: "checkin" } });
    const f = (r.fields ?? {}) as Partial<Checkin>;
    setC((x) => ({
      ...x,
      ...Object.fromEntries(Object.entries(f).filter(([k, v]) => ["mood", "energy", "focus", "stress", "sleep_hours"].includes(k) && typeof v === "number")),
      emotions: [...new Set([...(x.emotions ?? []), ...((f.emotions as string[]) ?? []).filter((e) => ALL_FEELINGS.includes(e))])],
    }));
  }

  return (
    <Card
      title={<span id="checkin">Mental check-in</span>}
      action={
        existing && !open ? (
          <button className="text-xs text-mute hover:text-ink" onClick={() => setOpen(true)}>Edit</button>
        ) : (
          <VoiceButton size="sm" label="Say it" onText={fromVoice} />
        )
      }
    >
      {!open && existing ? (
        <div className="flex items-center gap-4">
          <div className={`num text-3xl font-semibold ${readiness != null && readiness >= 70 ? "text-up" : readiness != null && readiness < 50 ? "text-down" : "text-warn"}`}>{readiness ?? "—"}</div>
          <div className="text-sm">
            <div>Readiness {readiness != null && readiness < 50 ? "— consider sitting out or half size" : readiness != null && readiness < 70 ? "— trade only the cleanest A+" : ""}</div>
            <div className="mt-0.5 text-xs text-mute">{[...(existing.emotions ?? [])].join(", ") || "No feelings tagged"}{existing.sleep_hours != null ? ` · slept ${existing.sleep_hours}h` : ""}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <Scale label="Mood" value={c.mood ?? null} onChange={(v) => setC({ ...c, mood: v })} />
          <Scale label="Energy" value={c.energy ?? null} onChange={(v) => setC({ ...c, energy: v })} />
          <Scale label="Focus" value={c.focus ?? null} onChange={(v) => setC({ ...c, focus: v })} />
          <Scale label="Stress" value={c.stress ?? null} onChange={(v) => setC({ ...c, stress: v })} lowGood />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-mute">Sleep (h)</span>
            <input className="input num h-8 min-h-0 w-20 py-0" inputMode="decimal" value={c.sleep_hours ?? ""} onChange={(e) => setC({ ...c, sleep_hours: e.target.value === "" ? null : Math.max(0, Math.min(24, Number(e.target.value) || 0)) })} />
          </div>
          <Chips options={ALL_FEELINGS} value={c.emotions ?? []} onChange={(v) => setC({ ...c, emotions: v })} />
          <textarea className="input min-h-14" placeholder="Anything on your mind? (optional)" value={c.note ?? ""} onChange={(e) => setC({ ...c, note: e.target.value })} maxLength={2000} />
          <button className="btn-primary w-full" onClick={save}>{saved ? "Saved" : "Save check-in"}</button>
        </div>
      )}
    </Card>
  );
}

/* ---------------- AI outlook ---------------- */

type Outlook = {
  headline?: string;
  focus?: string;
  instruments?: { symbol: string; stance?: string; context?: string; drivers?: string[]; watch?: string[]; scenarios?: { if: string; then: string }[]; avoid?: string[]; sessions?: string }[];
  calendar?: string[];
  actions?: CoachAction[];
  reply?: string;
};

export function OutlookCard() {
  const status = useCoachStatus();
  const { accounts, plans, coachDb } = useData();
  const [res, setRes] = useState<(CoachResult & Outlook) | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (refresh = false) => {
    setBusy(true);
    const r = (await askCoach("outlook", { refresh })) as CoachResult & Outlook;
    setRes(r);
    setBusy(false);
  };
  useEffect(() => {
    if (status?.enabled && coachDb && !res) run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.enabled, coachDb]);

  const stanceTone = (s?: string) => (/bull/i.test(s ?? "") ? "up" : /bear/i.test(s ?? "") ? "down" : /stand/i.test(s ?? "") ? "warn" : "mute") as "up" | "down" | "warn" | "mute";

  return (
    <section className="coach p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkle className="h-4 w-4 text-chart" /> Today's outlook — our way</h2>
        {status?.enabled && coachDb && (
          <div className="flex items-center gap-2 text-xs text-mute">
            {res?.created_at ? <span>{res.cached ? "Generated" : "Updated"} {fmtIST(String(res.created_at), false)}</span> : null}
            <button className="btn-ghost h-8 min-h-0 text-xs" onClick={() => run(true)} disabled={busy}>{busy ? "Thinking…" : "Refresh"}</button>
          </div>
        )}
      </div>

      {!status?.enabled || !coachDb ? (
        <FrameworkFallback accounts={accounts} plans={plans} />
      ) : busy && !res ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-raised" style={{ width: `${90 - i * 15}%` }} />)}</div>
      ) : res?.error ? (
        <p className="text-sm text-down">{res.error}</p>
      ) : res ? (
        <div className="space-y-4">
          {res.headline && <p className="text-[17px] font-medium leading-snug">{asText(res.headline)}</p>}
          {res.focus && <p className="text-sm"><span className="text-accent">Focus:</span> {asText(res.focus)}</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {asObjects<NonNullable<Outlook["instruments"]>[number]>(res.instruments).map((raw) => ({
              ...raw,
              symbol: asText(raw.symbol),
              stance: asText(raw.stance),
              context: asText(raw.context),
              sessions: asText(raw.sessions),
              drivers: asList(raw.drivers),
              watch: asList(raw.watch),
              avoid: asList(raw.avoid),
              scenarios: Array.isArray(raw.scenarios) ? raw.scenarios.map((x) => (typeof x === "string" ? { if: x, then: "" } : { if: asText((x as { if?: unknown }).if), then: asText((x as { then?: unknown }).then) })) : [],
            })).map((ins) => (
              <div key={ins.symbol} className="rounded-xl border border-line bg-panel/60 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{ins.symbol}</span>
                  {ins.stance && <Badge tone={stanceTone(ins.stance)}>{ins.stance}</Badge>}
                </div>
                {ins.context && <p className="mt-2 text-sm leading-relaxed text-mute">{ins.context}</p>}
                {!!ins.drivers?.length && <List title="Drivers" items={ins.drivers} />}
                {!!ins.watch?.length && <List title="What to look for" items={ins.watch} />}
                {!!ins.scenarios?.length && (
                  <div className="mt-2.5">
                    <div className="label mb-1">Scenarios</div>
                    <ul className="space-y-1 text-sm">{ins.scenarios.map((s, i) => <li key={i}><span className="text-mute">If</span> {s.if}{s.then ? <> <span className="text-mute">→</span> {s.then}</> : null}</li>)}</ul>
                  </div>
                )}
                {!!ins.avoid?.length && <List title="No trade if" items={ins.avoid} tone="down" />}
                {ins.sessions && <p className="mt-2 text-xs text-mute">Session: {ins.sessions}</p>}
              </div>
            ))}
          </div>
          {asList(res.calendar).length > 0 && <List title="Calendar" items={asList(res.calendar)} />}
          {res.reply && !Array.isArray(res.instruments) && <Markdown text={asText(res.reply)} />}
          <ActionChips actions={res.actions} />
          <p className="text-[11px] text-mute">Scenarios, not predictions — built from your playbook, knowledgebase, public prices and headlines. Confirm every level on your own chart.</p>
        </div>
      ) : null}
      {status && !status.enabled && <CoachSetupNote compact />}
    </section>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: "down" }) {
  return (
    <div className="mt-2.5">
      <div className="label mb-1">{title}</div>
      <ul className={`list-disc space-y-0.5 pl-4 text-sm ${tone === "down" ? "marker:text-down" : "marker:text-accent"}`}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

/** Without AI: the day's framework per account, from the playbook and today's plan. */
function FrameworkFallback({ accounts, plans }: { accounts: ReturnType<typeof useData>["accounts"]; plans: ReturnType<typeof useData>["plans"] }) {
  const today = todayIST();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {accounts.filter((a) => a.status === "active").map((a) => {
        const p = plans.find((x) => x.account_id === a.id && x.plan_date === today);
        const gold = /XAU/i.test(a.instrument);
        return (
          <div key={a.id} className="rounded-xl border border-line bg-panel/60 p-3.5 text-sm">
            <div className="font-semibold">{a.instrument}</div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-mute">
              <li className={p?.htf_range ? "text-ink" : ""}>HTF range on {gold ? "1H" : "4H"} from the latest BOS{p?.htf_range ? `: ${p.htf_range}` : ""}</li>
              <li className={p?.bias ? "text-ink" : ""}>Premium/discount → bias{p?.bias ? `: ${p.bias}` : ""}</li>
              <li className={p?.magnet ? "text-ink" : ""}>PDH/PDL, equal highs/lows → magnet{p?.magnet ? `: ${p.magnet}` : ""}</li>
              <li className={p?.pois ? "text-ink" : ""}>15M POIs from the extreme{p?.pois ? `: ${p.pois}` : ""}</li>
              <li className={p?.invalidation ? "text-ink" : ""}>Invalidation{p?.invalidation ? `: ${p.invalidation}` : " — write it"}</li>
              <li>{gold ? "Gold sweeps then reverses hard — in fast, out faster." : "BTC: watch funding/OI; stops trigger on mark price."}</li>
            </ol>
            {!p && <Link href={`/plan?account=${a.id}`} className="mt-2 inline-block text-xs text-accent">Write today's plan →</Link>}
          </div>
        );
      })}
    </div>
  );
}
