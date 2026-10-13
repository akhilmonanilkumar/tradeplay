"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Card, Empty, PageHead, Segmented, Stat } from "@/components/ui";
import { HBars, Heatmap, Histogram, LineChart, PnlCalendar } from "@/components/Charts";
import TradeModal from "@/components/TradeModal";
import { tzAbbr, wall } from "@/lib/tz";
import { CalendarTab, EmotionsTab, PatternsTab, PerformanceTab, ToolsTab } from "@/components/InsightsTabs";
import { equityCurveR, fmtIST, fmtPct, fmtR, fmtUsd, groupStats, stats, type Stats } from "@/lib/calc";
import { GATE_CHECKS, type Trade } from "@/lib/types";

type Range = "7" | "30" | "90" | "all";
type Tab = "overview" | "calendar" | "performance" | "patterns" | "emotions" | "tools";
const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" }, { value: "calendar", label: "Calendar" }, { value: "performance", label: "Performance" },
  { value: "patterns", label: "Patterns" }, { value: "emotions", label: "Emotions" }, { value: "tools", label: "Tools" },
];
type Dim = "setup" | "model" | "session" | "weekday" | "poi" | "direction" | "instrument" | "hour" | "gate";
type Drill = { dim: Dim; key: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SESSIONS = ["Asia", "London", "New York", "Off-session"];

const istDate = (iso: string) => wall(new Date(iso));
const weekday = (t: Trade) => WEEKDAYS[(istDate(t.opened_at).getUTCDay() + 6) % 7];
const hourIST = (t: Trade) => `${String(istDate(t.opened_at).getUTCHours()).padStart(2, "0")}:00`;
const pf = (s: Stats) => (s.profitFactor == null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2));

export default function Analytics() {
  const { trades, accounts, setups } = useData();
  const [range, setRange] = useState<Range>("all");
  const [account, setAccount] = useState("all");
  const [aplusOnly, setAplusOnly] = useState(false);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [edit, setEdit] = useState<Trade | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [dayAcct, setDayAcct] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && TABS.some((x) => x.value === t)) setTab(t);
  }, []);
  function pickTab(t: Tab) {
    setTab(t);
    try {
      history.replaceState(null, "", t === "overview" ? "/analytics" : `/analytics?tab=${t}`);
    } catch {}
  }

  const setupName = (t: Trade) => setups.find((s) => s.id === t.setup_id)?.name ?? "—";
  const keyOf: Record<Dim, (t: Trade) => string> = {
    setup: setupName,
    model: (t) => t.entry_model ?? "—",
    session: (t) => t.session ?? "—",
    weekday,
    poi: (t) => t.poi_type ?? "—",
    direction: (t) => (t.direction === "long" ? "Long" : "Short"),
    instrument: (t) => t.instrument,
    hour: hourIST,
    gate: (t) => (t.gate_score === 8 && !t.override_reason ? "A+ (8/8)" : "Off-plan"),
  };

  const base = useMemo(() => {
    const since = range === "all" ? 0 : Date.now() - Number(range) * 864e5;
    return trades.filter(
      (t) =>
        t.status === "closed" &&
        t.r_multiple != null &&
        new Date(t.opened_at).getTime() >= since &&
        (account === "all" || t.account_id === account) &&
        (!aplusOnly || (t.gate_score === 8 && !t.override_reason)),
    );
  }, [trades, range, account, aplusOnly]);

  const rows = useMemo(() => base.filter((t) => drills.every((d) => keyOf[d.dim](t) === d.key)), [base, drills]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = useMemo(() => stats(rows), [rows]);
  const curve = useMemo(() => equityCurveR(rows).map((p) => ({ t: p.t, v: p.r })), [rows]);

  function toggle(dim: Dim, key: string) {
    setDrills((ds) => (ds.some((d) => d.dim === dim && d.key === key) ? ds.filter((d) => !(d.dim === dim && d.key === key)) : [...ds.filter((d) => d.dim !== dim), { dim, key }]));
  }
  const activeKey = (dim: Dim) => drills.find((d) => d.dim === dim)?.key ?? null;
  const bars = (dim: Dim) =>
    groupStats(rows, keyOf[dim]).map((g) => ({ key: g.key, value: g.s.totalR, sub: `${g.s.n} · ${fmtPct(g.s.winRate)} · ${fmtR(g.s.avgR)}/t` }));

  const calendar = useMemo(() => {
    const m = new Map<string, { net: number; n: number }>();
    for (const t of rows) {
      const k = istDate(t.closed_at ?? t.opened_at).toISOString().slice(0, 10);
      const v = m.get(k) ?? { net: 0, n: 0 };
      m.set(k, { net: v.net + Number(t.net_pnl), n: v.n + 1 });
    }
    return m;
  }, [rows]);

  const heat = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of rows) m.set(`${weekday(t)}|${t.session ?? "Off-session"}`, [...(m.get(`${weekday(t)}|${t.session ?? "Off-session"}`) ?? []), t]);
    return m;
  }, [rows]);

  const gateImpact = useMemo(
    () =>
      GATE_CHECKS.map((g) => {
        const yes = stats(rows.filter((t) => t[g.key]));
        const no = stats(rows.filter((t) => !t[g.key]));
        return { label: g.label, yes, no };
      }),
    [rows],
  );

  const mistakes = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of rows) for (const k of t.mistakes) m.set(k, [...(m.get(k) ?? []), t]);
    return [...m.entries()].map(([k, ts]) => ({ key: k, s: stats(ts) })).sort((a, b) => a.s.totalR - b.s.totalR);
  }, [rows]);

  const insights = useMemo(() => buildInsights(rows, keyOf), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayTrades = day
    ? (tab === "calendar" ? trades.filter((t) => t.status === "closed" && (!dayAcct || t.account_id === dayAcct)) : rows).filter((t) => istDate(t.closed_at ?? t.opened_at).toISOString().slice(0, 10) === day)
    : [];
  const pickTrade = (id: string) => setEdit(trades.find((t) => t.id === id) ?? null);
  const comboKeys = useMemo(() => ({ session: keyOf.session, setup: keyOf.setup, model: keyOf.model, poi: keyOf.poi, weekday: keyOf.weekday, direction: keyOf.direction }), [setups]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHead
        title="Insights"
        sub="Click any bar, cell or day to drill in. Filters stack."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={range} onChange={setRange} options={[{ value: "7", label: "7D" }, { value: "30", label: "30D" }, { value: "90", label: "90D" }, { value: "all", label: "All" }]} />
            <select className="input w-auto" value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="all">All accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button className={aplusOnly ? "btn bg-up/15 text-up" : "btn-ghost"} onClick={() => setAplusOnly((v) => !v)}>A+ only</button>
          </div>
        }
      />

      <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="inline-flex gap-1 rounded-xl border border-line bg-panel p-1">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => pickTab(t.value)} className={`rounded-lg px-3 py-1.5 text-sm transition ${tab === t.value ? "bg-raised font-medium text-ink" : "text-mute hover:text-ink"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === "calendar" && <CalendarTab onDay={(d, a) => { setDay(d); setDayAcct(a); }} />}
      {tab === "performance" && (base.length ? <PerformanceTab rows={rows} onPick={pickTrade} /> : <Empty title="No closed trades in this view" />)}
      {tab === "patterns" && (base.length ? <PatternsTab rows={rows} keyOf={comboKeys} /> : <Empty title="No closed trades in this view" />)}
      {tab === "emotions" && <EmotionsTab rows={rows} />}
      {tab === "tools" && <ToolsTab rows={rows} />}
      {tab === "calendar" && day && (
        <Card className="mt-4" title={`Trades closed ${day}`} action={<button className="text-xs text-mute" onClick={() => setDay(null)}>Close</button>}>
          <ul className="divide-y divide-line text-sm">
            {dayTrades.map((t) => (
              <li key={t.id}>
                <button className="flex w-full items-center justify-between py-2 text-left hover:text-accent" onClick={() => setEdit(t)}>
                  <span>{fmtIST(t.opened_at, false)} · {t.instrument} · {t.direction} · {setupName(t)}</span>
                  <span className={`num ${Number(t.r_multiple) >= 0 ? "text-up" : "text-down"}`}>{fmtR(t.r_multiple)} · {fmtUsd(t.net_pnl, true)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "overview" && drills.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {drills.map((d) => (
            <button key={d.dim} className="chip border-accent/40 text-accent" onClick={() => toggle(d.dim, d.key)}>
              {d.dim}: {d.key} ✕
            </button>
          ))}
          <button className="text-xs text-mute hover:text-ink" onClick={() => setDrills([])}>Clear all</button>
        </div>
      )}

      {tab !== "overview" ? null : base.length === 0 ? (
        <Empty title="No closed trades in this view">Close a few trades and your edge will show up here.</Empty>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
              <Stat label="Net P&L" value={fmtUsd(s.net, true)} tone={s.net >= 0 ? "up" : "down"} sub={`${s.n} trades`} />
              <Stat label="Total R" value={fmtR(s.totalR)} tone={s.totalR >= 0 ? "up" : "down"} />
              <Stat label="Expectancy" value={fmtR(s.avgR)} sub="avg R / trade" tone={s.avgR >= 0 ? "up" : "down"} />
              <Stat label="Win rate" value={fmtPct(s.winRate)} sub={`${s.wins}W · ${s.losses}L · BE 25% at 3R`} />
              <Stat label="Profit factor" value={pf(s)} />
              <Stat label="Avg win / loss" value={`${fmtR(s.avgWinR)}`} sub={fmtR(s.avgLossR)} />
              <Stat label="Max DD" value={`${s.maxDdR.toFixed(2)}R`} tone="warn" />
              <Stat label="A+ rate" value={fmtPct(s.aPlusRate)} tone={s.aPlusRate >= 0.9 ? "up" : "warn"} />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Equity curve (R)" className="lg:col-span-2">
              <LineChart points={curve} />
            </Card>
            <Card title="Insights">
              {insights.length ? (
                <ul className="space-y-2.5 text-sm">
                  {insights.map((i, k) => (
                    <li key={k} className="flex gap-2">
                      <span className={i.tone === "up" ? "text-up" : i.tone === "down" ? "text-down" : "text-warn"}>●</span>
                      <span>{i.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mute">Need ~10 closed trades for patterns.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="By setup"><HBars rows={bars("setup")} active={activeKey("setup")} onPick={(k) => toggle("setup", k)} /></Card>
            <Card title="By entry model"><HBars rows={bars("model")} active={activeKey("model")} onPick={(k) => toggle("model", k)} /></Card>
            <Card title="By session"><HBars rows={bars("session")} active={activeKey("session")} onPick={(k) => toggle("session", k)} /></Card>
            <Card title="By POI type"><HBars rows={bars("poi")} active={activeKey("poi")} onPick={(k) => toggle("poi", k)} /></Card>
            <Card title="A+ vs off-plan"><HBars rows={bars("gate")} active={activeKey("gate")} onPick={(k) => toggle("gate", k)} /></Card>
            <Card title="Direction · instrument">
              <HBars rows={[...bars("direction"), ...bars("instrument")]} active={activeKey("direction") ?? activeKey("instrument")} onPick={(k) => toggle(["Long", "Short"].includes(k) ? "direction" : "instrument", k)} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="Weekday × session (total R)" className="lg:col-span-3">
              <Heatmap
                rows={WEEKDAYS.filter((d) => [...heat.keys()].some((k) => k.startsWith(d)))}
                cols={SESSIONS.filter((c) => [...heat.keys()].some((k) => k.endsWith(c)))}
                cell={(r, c) => {
                  const ts = heat.get(`${r}|${c}`);
                  return ts ? { value: stats(ts).totalR, n: ts.length } : null;
                }}
                onPick={(r, c) => {
                  toggle("weekday", r);
                  toggle("session", c);
                }}
              />
            </Card>
            <Card title="R distribution" className="lg:col-span-2">
              <Histogram values={rows.map((t) => Number(t.r_multiple))} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Daily P&L">
              <PnlCalendar days={calendar} month={month} onMonth={setMonth} onPick={setDay} />
            </Card>
            <Card title={`Entry hour (${tzAbbr()})`}>
              <HBars rows={bars("hour").sort((a, b) => a.key.localeCompare(b.key))} active={activeKey("hour")} onPick={(k) => toggle("hour", k)} />
            </Card>
            <Card title="Cost of mistakes">
              {mistakes.length === 0 ? (
                <p className="text-sm text-mute">No mistakes tagged in this view.</p>
              ) : (
                <HBars rows={mistakes.map((m) => ({ key: m.key, value: m.s.totalR, sub: `${m.s.n} trades` }))} />
              )}
            </Card>
          </div>

          <Card title="Does each gate box earn its place? (expectancy when ticked vs not)">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="label py-2 font-medium">Check</th>
                    <th className="label py-2 font-medium">Ticked</th>
                    <th className="label py-2 font-medium">Not ticked</th>
                    <th className="label py-2 font-medium">Edge</th>
                  </tr>
                </thead>
                <tbody>
                  {gateImpact.map((g) => {
                    const delta = g.no.n ? g.yes.avgR - g.no.avgR : null;
                    return (
                      <tr key={g.label} className="border-b border-line/60 last:border-0">
                        <td className="py-2">{g.label}</td>
                        <td className="num py-2">{g.yes.n ? `${fmtR(g.yes.avgR)} · ${fmtPct(g.yes.winRate)} · n${g.yes.n}` : "—"}</td>
                        <td className="num py-2 text-mute">{g.no.n ? `${fmtR(g.no.avgR)} · ${fmtPct(g.no.winRate)} · n${g.no.n}` : "always ticked"}</td>
                        <td className="py-2">{delta == null ? <Badge>n/a</Badge> : <Badge tone={delta >= 0 ? "up" : "down"}>{fmtR(delta)}</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {day && (
            <Card title={`Trades closed ${day}`} action={<button className="text-xs text-mute" onClick={() => setDay(null)}>Close</button>}>
              <ul className="divide-y divide-line text-sm">
                {dayTrades.map((t) => (
                  <li key={t.id}>
                    <button className="flex w-full items-center justify-between py-2 text-left hover:text-accent" onClick={() => setEdit(t)}>
                      <span>{fmtIST(t.opened_at, false)} · {t.instrument} · {t.direction} · {setupName(t)}</span>
                      <span className={`num ${Number(t.r_multiple) >= 0 ? "text-up" : "text-down"}`}>{fmtR(t.r_multiple)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
      <TradeModal trade={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function buildInsights(rows: Trade[], keyOf: Record<Dim, (t: Trade) => string>) {
  const out: { tone: "up" | "down" | "warn"; text: string }[] = [];
  if (rows.length < 10) return out;
  const all = stats(rows);

  const aplus = stats(rows.filter((t) => t.gate_score === 8 && !t.override_reason));
  const off = stats(rows.filter((t) => t.gate_score < 8 || t.override_reason));
  if (off.n >= 3 && aplus.n >= 3) {
    out.push({
      tone: aplus.avgR > off.avgR ? "up" : "warn",
      text: `A+ trades average ${fmtR(aplus.avgR)} vs ${fmtR(off.avgR)} off-plan (${off.n} trades cost ${fmtR(off.totalR)} total).`,
    });
  }

  for (const [dim, label] of [["setup", "setup"], ["session", "session"], ["weekday", "day"]] as const) {
    const g = groupStats(rows, keyOf[dim]).filter((x) => x.s.n >= 5);
    if (g.length >= 2) {
      const best = g[0], worst = g.at(-1)!;
      out.push({ tone: "up", text: `Best ${label}: ${best.key} — ${fmtR(best.s.avgR)}/trade over ${best.s.n}.` });
      if (worst.s.avgR < 0) out.push({ tone: "down", text: `Leak: ${worst.key} loses ${fmtR(worst.s.avgR)}/trade over ${worst.s.n}. Consider cutting it.` });
    }
  }

  const tagged = rows.filter((t) => t.mistakes.length);
  if (tagged.length >= 3) {
    const cost = stats(tagged).totalR;
    out.push({ tone: "down", text: `Trades with a mistake tag total ${fmtR(cost)} across ${tagged.length} trades.` });
  }

  if (all.winRate < 0.25 && all.avgWinR < 3) out.push({ tone: "warn", text: "Win rate is under 25% and winners average under 3R — below breakeven. Check if targets are being cut early." });
  if (all.avgWinR > 0 && all.avgWinR < 2.5) out.push({ tone: "warn", text: `Winners average only ${fmtR(all.avgWinR)} despite 1:3 targets — you may be closing early.` });

  return out.slice(0, 7);
}
