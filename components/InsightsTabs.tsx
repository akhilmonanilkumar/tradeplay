"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Card, Check, Field, Segmented, Stat, numOrNull } from "@/components/ui";
import { Bands, HBars, LineChart, PnlCalendar, Scatter, VBars } from "@/components/Charts";
import { accountState, equityCurveR, fmtPct, fmtR, fmtUsd, stats, tierFor, todayIST, type Stats } from "@/lib/calc";
import { applyWhatIf, durationVsR, drawdownR, edgeCombos, emotionStats, monteCarlo, rByGate, recurringCauses, rolling, sequencePatterns, streaks, type PatternRow, type WhatIf } from "@/lib/analysis";
import { MENTAL_KEYS, type Trade } from "@/lib/types";
import { tzAbbr, wall } from "@/lib/tz";

const istDay = (iso: string) => todayIST(new Date(iso));
const pf = (s: Stats) => (s.profitFactor == null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2));

/* ---------------- Calendar: all accounts + each account ---------------- */

export function CalendarTab({ onDay }: { onDay: (iso: string, accountId: string | null) => void }) {
  const { trades, accounts } = useData();
  const [month, setMonth] = useState(() => new Date());
  const closed = trades.filter((t) => t.status === "closed" && t.net_pnl != null);
  const days = (accountId: string | null) => {
    const m = new Map<string, { net: number; n: number }>();
    for (const t of closed) {
      if (accountId && t.account_id !== accountId) continue;
      const k = istDay(t.closed_at ?? t.opened_at);
      const v = m.get(k) ?? { net: 0, n: 0 };
      m.set(k, { net: v.net + Number(t.net_pnl), n: v.n + 1 });
    }
    return m;
  };
  const shown = accounts.filter((a) => a.status === "active" || closed.some((t) => t.account_id === a.id));

  const months = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) out.push(new Date(Date.UTC(d.getFullYear(), d.getMonth() - i, 1)).toISOString().slice(0, 7));
    return out;
  }, []);
  const monthNet = (ym: string, accountId: string | null) =>
    closed.filter((t) => (!accountId || t.account_id === accountId) && istDay(t.closed_at ?? t.opened_at).startsWith(ym)).reduce((s, t) => s + Number(t.net_pnl), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="All accounts"><PnlCalendar days={days(null)} month={month} onMonth={setMonth} onPick={(d) => onDay(d, null)} /></Card>
        {shown.map((a) => (
          <Card key={a.id} title={a.name}><PnlCalendar days={days(a.id)} month={month} onMonth={setMonth} onPick={(d) => onDay(d, a.id)} /></Card>
        ))}
      </div>
      <Card title="Monthly P&L">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute">
                <th className="py-1.5 pr-3 font-normal">Month</th>
                {shown.map((a) => <th key={a.id} className="px-3 py-1.5 text-right font-normal">{a.instrument}</th>)}
                <th className="py-1.5 pl-3 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="num">
              {months.map((ym) => {
                const total = monthNet(ym, null);
                return (
                  <tr key={ym} className="border-t border-line">
                    <td className="py-1.5 pr-3 font-sans">{new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}</td>
                    {shown.map((a) => {
                      const v = monthNet(ym, a.id);
                      return <td key={a.id} className={`px-3 py-1.5 text-right ${v > 0 ? "text-up" : v < 0 ? "text-down" : "text-mute"}`}>{v ? fmtUsd(v, true) : "·"}</td>;
                    })}
                    <td className={`py-1.5 pl-3 text-right font-medium ${total > 0 ? "text-up" : total < 0 ? "text-down" : "text-mute"}`}>{total ? fmtUsd(total, true) : "·"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Performance ---------------- */

export function PerformanceTab({ rows, onPick }: { rows: Trade[]; onPick: (id: string) => void }) {
  const { accounts } = useData();
  const st = streaks(rows);
  const dd = drawdownR(rows).map((p) => ({ t: p.t, v: p.dd }));
  const roll = rolling(rows, Math.min(20, Math.max(5, Math.floor(rows.length / 3))));
  const byGate = rByGate(rows).map((g) => ({ key: `${g.gate}/8`, value: g.avgR, sub: `${g.n}` }));
  const days = new Map<string, number>();
  for (const t of rows) days.set(istDay(t.closed_at ?? t.opened_at), (days.get(istDay(t.closed_at ?? t.opened_at)) ?? 0) + Number(t.r_multiple));
  const dayVals = [...days.values()];
  const greenDays = dayVals.filter((v) => v > 0).length;
  const perAcct = accounts.map((a) => ({ a, s: stats(rows.filter((t) => t.account_id === a.id)) })).filter((x) => x.s.n);
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => {
    const xs = rows.filter((t) => (wall(new Date(t.opened_at)).getUTCDay() + 6) % 7 === i);
    return { key: d, value: xs.reduce((s, t) => s + Number(t.r_multiple), 0), sub: `${xs.length}` };
  });

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Current streak" value={st.current > 0 ? `${st.current} W` : st.current < 0 ? `${-st.current} L` : "—"} tone={st.current > 0 ? "up" : st.current < 0 ? "down" : undefined} />
          <Stat label="Longest win streak" value={`${st.maxWin}`} tone="up" />
          <Stat label="Longest loss streak" value={`${st.maxLoss}`} tone="down" sub={st.maxLoss >= 6 ? "normal at 3R — plan for it" : undefined} />
          <Stat label="Green days" value={dayVals.length ? fmtPct(greenDays / dayVals.length) : "—"} sub={`${greenDays}/${dayVals.length} days`} />
          <Stat label="Best day" value={dayVals.length ? fmtR(Math.max(...dayVals)) : "—"} tone="up" />
          <Stat label="Worst day" value={dayVals.length ? fmtR(Math.min(...dayVals)) : "—"} tone="down" />
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Drawdown from peak (R)"><LineChart points={dd} color="down" format={fmtR} /></Card>
        <Card title={`Rolling expectancy (last ${Math.min(20, Math.max(5, Math.floor(rows.length / 3)))} trades)`}>
          <LineChart points={roll.map((r) => ({ t: r.t, v: r.exp, note: `win ${Math.round(r.win * 100)}%` }))} startAtZero={false} color="accent" format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}R/t`} />
        </Card>
        <Card title="Average R by gate score — does A+ pay?"><VBars rows={byGate} /></Card>
        <Card title={`Total R by weekday (${tzAbbr()})`}><VBars rows={wd} /></Card>
        <Card title="Holding time vs result" className="lg:col-span-2">
          <Scatter points={durationVsR(rows)} xLabel={(m) => (m >= 120 ? `${(m / 60).toFixed(1)}h` : `${Math.round(m)}m`)} onPick={onPick} />
        </Card>
      </div>
      {perAcct.length > 0 && (
        <Card title="Accounts compared">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-mute">{["Account", "Trades", "Win", "Total R", "Expectancy", "PF", "Max DD", "A+ rate", "Net"].map((h) => <th key={h} className="py-1.5 pr-4 font-normal">{h}</th>)}</tr></thead>
              <tbody className="num">
                {perAcct.map(({ a, s }) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="py-1.5 pr-4 font-sans">{a.name}</td><td className="pr-4">{s.n}</td><td className="pr-4">{fmtPct(s.winRate)}</td>
                    <td className={`pr-4 ${s.totalR >= 0 ? "text-up" : "text-down"}`}>{fmtR(s.totalR)}</td><td className="pr-4">{fmtR(s.avgR)}</td><td className="pr-4">{pf(s)}</td>
                    <td className="pr-4">{s.maxDdR.toFixed(1)}R</td><td className="pr-4">{fmtPct(s.aPlusRate)}</td><td className={s.net >= 0 ? "text-up" : "text-down"}>{fmtUsd(s.net, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Patterns ---------------- */

function PatternTable({ rows, empty }: { rows: PatternRow[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-mute">{empty}</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0 truncate">{r.label}</span>
          <span className="num flex shrink-0 items-center gap-3 text-xs">
            <span className="text-mute">{r.n}× · {fmtPct(r.winRate)}</span>
            <span className={`w-16 text-right text-sm ${r.avgR >= 0 ? "text-up" : "text-down"}`}>{fmtR(r.avgR)}/t</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PatternsTab({ rows, keyOf }: { rows: Trade[]; keyOf: Record<string, (t: Trade) => string> }) {
  const { accounts, plans } = useData();
  const causes = useMemo(() => recurringCauses(rows, { accounts, plans }, 200), [rows, accounts, plans]);
  const seq = useMemo(() => sequencePatterns(rows), [rows]);
  const combos = useMemo(() => edgeCombos(rows, keyOf, 3), [rows, keyOf]);
  const top = causes[0];
  const prompt = encodeURIComponent(
    `Analyse my trading patterns. Recurring problems: ${causes.slice(0, 5).map((c) => `${c.label} ${c.n}× (${c.r.toFixed(1)}R)`).join("; ") || "none"}. Sequences: ${seq.map((s) => `${s.label} ${s.n}× ${s.avgR.toFixed(2)}R/t`).join("; ")}. Best combos: ${combos.best.map((b) => `${b.label} ${b.avgR.toFixed(2)}R/t`).join("; ") || "none"}. Worst: ${combos.worst.map((b) => `${b.label} ${b.avgR.toFixed(2)}R/t`).join("; ") || "none"}. What should I stop, keep and test next? Propose lessons to save.`,
  );
  return (
    <div className="space-y-4">
      {top && (
        <section className="coach p-4">
          <div className="label text-accent">Biggest leak</div>
          <p className="mt-1 text-lg font-medium">{top.label} — {top.n}× costing {fmtR(top.r)}</p>
          {top.rule && <p className="mt-1 text-sm text-mute">Rule: {top.rule}</p>}
          <Link href={`/coach?q=${prompt}`} className="btn-ghost mt-3 h-8 min-h-0 text-xs">Ask the coach to analyse all patterns →</Link>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Recurring causes (rule engine, every closed trade)">
          <HBars rows={causes.map((c) => ({ key: c.label, value: c.r, sub: `${c.n}×` }))} />
        </Card>
        <Card title="Behaviour sequences"><PatternTable rows={seq} empty="Need more trades." /></Card>
        <Card title="Best condition combos (≥3 trades)"><PatternTable rows={combos.best} empty="No positive combos with 3+ trades yet." /></Card>
        <Card title="Worst condition combos (≥3 trades)"><PatternTable rows={combos.worst} empty="No negative combos with 3+ trades yet." /></Card>
      </div>
    </div>
  );
}

/* ---------------- Emotions ---------------- */

export function EmotionsTab({ rows }: { rows: Trade[] }) {
  const { checkins, trades } = useData();
  const em = useMemo(() => emotionStats(rows), [rows]);
  const stages = ["pre", "during", "post"] as const;
  const ci = [...checkins].sort((a, b) => a.checkin_date.localeCompare(b.checkin_date)).slice(-60);
  const series = (k: "mood" | "energy" | "focus" | "stress") => ci.filter((c) => c[k] != null).map((c) => ({ t: Date.parse(`${c.checkin_date}T00:00:00Z`), v: Number(c[k]) }));
  const readinessVsR = ci
    .map((c) => {
      const xs = [c.mood, c.energy, c.focus, c.stress != null ? 6 - c.stress : null].filter((x): x is number => x != null);
      const day = trades.filter((t) => t.status === "closed" && istDay(t.closed_at ?? t.opened_at) === c.checkin_date);
      return xs.length && day.length ? { x: Math.round((xs.reduce((s, x) => s + x, 0) / xs.length / 5) * 100), y: day.reduce((s, t) => s + Number(t.r_multiple ?? 0), 0) } : null;
    })
    .filter((x): x is { x: number; y: number } => !!x);

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">Emotions tracked on {em.tracked} of {em.total} trades in this view. Log feelings before, during and after each trade (New trade → Mental state, and the trade's Emotion tracker).</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Result by feeling (any stage)">
          <HBars rows={em.byFeeling.map((f) => ({ key: f.label, value: f.avgR, sub: `${f.n}× · ${fmtPct(f.winRate)}` }))} format={(v) => `${fmtR(v)}/t`} />
        </Card>
        <Card title="Pre-trade mental state vs result (avg R)">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-mute"><th className="py-1 text-left font-normal" />{["1–2", "3", "4–5"].map((h) => <th key={h} className="py-1 text-right font-normal">{h}</th>)}</tr></thead>
            <tbody className="num">
              {em.mental.map((m) => (
                <tr key={m.key} className="border-t border-line">
                  <td className="py-1.5 font-sans">{MENTAL_KEYS.find((k) => k.key === m.key)?.label}</td>
                  {[m.low, m.mid, m.high].map((b, i) => <td key={i} className={`py-1.5 text-right ${!b.n ? "text-mute" : b.avgR >= 0 ? "text-up" : "text-down"}`}>{b.n ? `${fmtR(b.avgR)} (${b.n})` : "·"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Feelings by stage of the trade" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {stages.map((s) => {
              const xs = em.byStage.filter((x) => x.stage === s).sort((a, b) => b.n - a.n).slice(0, 6);
              return (
                <div key={s}>
                  <div className="label mb-1.5">{s === "pre" ? "Before entry" : s === "during" ? "In the trade" : "After exit"}</div>
                  {xs.length ? (
                    <ul className="space-y-1 text-sm">{xs.map((x) => <li key={x.label} className="flex justify-between"><span>{x.label}</span><span className={`num text-xs ${x.avgR >= 0 ? "text-up" : "text-down"}`}>{x.n}× · {fmtR(x.avgR)}</span></li>)}</ul>
                  ) : <p className="text-xs text-mute">Nothing logged yet.</p>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Daily check-ins (last 60)">
          {ci.length ? (
            <div className="space-y-3">
              {(["mood", "energy", "focus", "stress"] as const).map((k) => (
                <div key={k}><div className="text-xs capitalize text-mute">{k}</div><LineChart points={series(k)} height={60} startAtZero={false} color={k === "stress" ? "down" : "accent"} format={(v) => `${v}/5`} /></div>
              ))}
            </div>
          ) : <p className="text-sm text-mute">Do the daily check-in on Today to see trends.</p>}
        </Card>
        <Card title="Readiness score vs that day's R">
          <Scatter points={readinessVsR} xLabel={(x) => `${Math.round(x)}`} />
          <p className="mt-1 text-xs text-mute">x = check-in readiness (0–100), y = total R that day.</p>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Tools: Monte Carlo + What-if ---------------- */

export function ToolsTab({ rows }: { rows: Trade[] }) {
  const { accounts, trades, payouts, adjustments } = useData();
  const active = accounts.filter((a) => a.status === "active");
  const [accountId, setAccountId] = useState(active[0]?.id ?? "");
  const acct = accounts.find((a) => a.id === accountId);
  const st = acct ? accountState(acct, trades, payouts, new Date(), { adjustments }) : null;
  const [source, setSource] = useState<"aplus" | "all" | "model">("aplus");
  const [winRate, setWinRate] = useState("35");
  const [rrv, setRrv] = useState("3");
  const [over, setOver] = useState<Record<string, string>>({});
  const v = (k: string, d: number) => numOrNull(over[k] ?? "") ?? d;
  const start = v("start", st?.equity ?? 0);
  const risk = v("risk", (acct && tierFor(acct, start)?.risk_pct) ?? 0.5);
  const target = acct?.target_pct ? v("target", acct.target_pct) : numOrNull(over.target ?? "");
  const maxLoss = v("maxLoss", acct?.max_overall_loss_pct ?? 10);
  const daily = v("daily", acct?.max_daily_loss_pct ?? 5);
  const dayStop = v("dayStop", acct?.personal_daily_loss_pct ?? 1);
  const perDay = v("perDay", acct?.max_trades_per_day ?? 2);
  const daysN = v("days", 30);

  const rs = useMemo(() => {
    if (source === "model") {
      const w = Math.max(0, Math.min(100, Number(winRate) || 0)) / 100;
      const r = Number(rrv) || 3;
      return Array.from({ length: 100 }, (_, i) => (i < Math.round(w * 100) ? r : -1));
    }
    return rows.filter((t) => t.account_id === accountId || !accountId).filter((t) => source === "all" || (t.gate_score === 8 && !t.override_reason)).map((t) => Number(t.r_multiple));
  }, [source, winRate, rrv, rows, accountId]);

  const mc = useMemo(
    () => (start > 0 ? monteCarlo({ rs, start, riskPct: risk, targetPct: target, maxLossPct: maxLoss, dailyLossPct: daily, dayStopPct: dayStop, tradesPerDay: Math.max(1, Math.round(perDay)), days: Math.max(1, Math.min(250, Math.round(daysN))), runs: 2000 }) : null),
    [rs, start, risk, target, maxLoss, daily, dayStop, perDay, daysN],
  );

  const [w, setW] = useState<WhatIf>({ aPlusOnly: true, noMistakes: false, noOverrides: true, maxPerDay: 2 });
  const kept = useMemo(() => applyWhatIf(rows, w), [rows, w]);
  const sAll = stats(rows), sKept = stats(kept);

  const num = (k: string, label: string, d: number, hint?: string) => (
    <Field label={label} hint={hint}><input className="input num" inputMode="decimal" placeholder={String(Math.round(d * 100) / 100)} value={over[k] ?? ""} onChange={(e) => setOver({ ...over, [k]: e.target.value })} /></Field>
  );

  return (
    <div className="space-y-4">
      <Card title="Prop-firm simulator — odds of passing vs breaching" action={<Segmented size="xs" value={accountId} onChange={(x) => { setAccountId(x); setOver({}); }} options={active.map((a) => ({ value: a.id, label: a.instrument }))} />}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {num("start", "Start equity $", st?.equity ?? 0)}
          {num("risk", "Risk %/trade", risk)}
          {num("target", "Target %", target ?? 0, acct?.target_pct ? undefined : "blank = funded")}
          {num("maxLoss", "Max loss %", maxLoss)}
          {num("daily", "Firm daily loss %", daily)}
          {num("dayStop", "My daily stop %", dayStop, "ends the day")}
          {num("perDay", "Trades / day", perDay)}
          {num("days", "Trading days", 30)}
          <Field label="R source">
            <select className="input" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
              <option value="aplus">My A+ trades</option>
              <option value="all">All my trades</option>
              <option value="model">Win rate × R:R</option>
            </select>
          </Field>
        </div>
        {source === "model" && (
          <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
            <Field label="Win rate %"><input className="input num" value={winRate} onChange={(e) => setWinRate(e.target.value)} /></Field>
            <Field label="Avg winner (R)"><input className="input num" value={rrv} onChange={(e) => setRrv(e.target.value)} /></Field>
          </div>
        )}
        {source !== "model" && rs.length < 20 && <p className="mt-3 text-xs text-warn">Only {rs.length} trades to resample — results are rough. Try “Win rate × R:R”.</p>}
        {mc ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              <Stat label={target ? "Pass probability" : "Ends profitable"} value={fmtPct(mc.pass)} tone={mc.pass >= 0.5 ? "up" : "warn"} />
              <Stat label="Breach probability" value={fmtPct(mc.breach)} tone={mc.breach <= 0.1 ? "up" : "down"} />
              <Stat label="Median end equity" value={fmtUsd(mc.median)} />
              <p className="text-xs text-mute">2,000 simulated paths resampling your R outcomes, compounding risk on equity, ending each day at your personal stop and failing a path on a firm daily or overall breach.</p>
            </div>
            <Bands rows={mc.bands} format={(x) => fmtUsd(x)} lines={[...(target ? [{ v: start * (1 + target / 100), label: "Target", tone: "up" as const }] : []), { v: start * (1 - maxLoss / 100), label: "Floor", tone: "down" as const }]} />
          </div>
        ) : <p className="mt-3 text-sm text-mute">Need trades (or the win-rate model) and a start equity.</p>}
      </Card>

      <Card title="What if I only took…">
        <div className="grid gap-2 sm:grid-cols-4">
          <Check label="A+ only (8/8)" checked={!!w.aPlusOnly} onChange={(x) => setW({ ...w, aPlusOnly: x })} />
          <Check label="No tagged mistakes" checked={!!w.noMistakes} onChange={(x) => setW({ ...w, noMistakes: x })} />
          <Check label="No overrides" checked={!!w.noOverrides} onChange={(x) => setW({ ...w, noOverrides: x })} />
          <Field label="Max trades / day per account"><input className="input num" value={w.maxPerDay ?? ""} onChange={(e) => setW({ ...w, maxPerDay: numOrNull(e.target.value) })} placeholder="no cap" /></Field>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
          <table className="text-sm">
            <thead><tr className="text-xs text-mute"><th className="py-1 text-left font-normal" /><th className="py-1 text-right font-normal">Actual</th><th className="py-1 text-right font-normal">What-if</th></tr></thead>
            <tbody className="num">
              {[["Trades", sAll.n, sKept.n, String], ["Total R", sAll.totalR, sKept.totalR, fmtR], ["Expectancy", sAll.avgR, sKept.avgR, fmtR], ["Win rate", sAll.winRate, sKept.winRate, fmtPct], ["Max DD", sAll.maxDdR, sKept.maxDdR, (x: number) => `${x.toFixed(1)}R`]].map(([l, a, b, f]) => (
                <tr key={String(l)} className="border-t border-line"><td className="py-1.5 font-sans text-mute">{String(l)}</td><td className="py-1.5 text-right">{(f as (x: number) => string)(a as number)}</td><td className={`py-1.5 text-right ${(b as number) > (a as number) && l !== "Max DD" && l !== "Trades" ? "text-up" : ""}`}>{(f as (x: number) => string)(b as number)}</td></tr>
              ))}
            </tbody>
          </table>
          <div>
            <LineChart points={equityCurveR(kept).map((p) => ({ t: p.t, v: p.r }))} color="accent" />
            <p className="mt-1 text-xs text-mute">Equity curve (R) of the trades you would have kept. <Badge>{rows.length - kept.length} filtered out</Badge></p>
          </div>
        </div>
      </Card>
    </div>
  );
}
