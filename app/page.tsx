"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Card, Meter, Stat } from "@/components/ui";
import TradeModal from "@/components/TradeModal";
import { CheckinCard, DontRepeat, OutlookCard } from "@/components/TodayWidgets";
import { DailyPnl, Greeting, NextEventCard, OverallScore, PnlCurve, ScorePanel, StartDay, StatusCard, TodoList, TradesTable } from "@/components/TodayDash";
import { EconWeek, MarketPanel, useMarket } from "@/components/Market";
import {
  accountState, fmtIST, fmtPct, fmtR, fmtUsd, msToWindow, newsBlock, sessionAt, todayIST, windowLabel,
} from "@/lib/calc";
import type { Trade } from "@/lib/types";

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function fmtDur(ms: number) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function Today() {
  const { accounts, trades, payouts, plans, adjustments } = useData();
  const market = useMarket();
  const now = useNow();
  const [edit, setEdit] = useState<Trade | null>(null);
  const [startDay, setStartDay] = useState(false);
  const active = accounts.filter((a) => a.status === "active");
  const session = sessionAt(now);
  const open = trades.filter((t) => t.status === "open");
  const today = todayIST(now);
  const states = useMemo(
    () => active.map((a) => {
      const plan = plans.find((p) => p.account_id === a.id && p.plan_date === today) ?? null;
      return { a, plan, s: accountState(a, trades, payouts, now, { plan, adjustments }) };
    }),
    [active, plans, today, trades, payouts, now, adjustments],
  );
  const slots = states.reduce((n, x) => n + (x.s.canTrade ? x.s.tradesLeft : 0), 0);

  const breaksToday = trades.filter(
    (t) => todayIST(new Date(t.opened_at)) === today && (t.override_reason || t.gate_score < 8 || t.mistakes.length),
  );

  return (
    <>
      <Greeting now={now} onStart={() => setStartDay(true)} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-4"><ScorePanel now={now} /></div>
            <div className="lg:col-span-8"><PnlCurve now={now} /></div>
            <div className="lg:col-span-4"><DailyPnl now={now} /></div>
            <div className="lg:col-span-4"><OverallScore now={now} /></div>
            <div className="lg:col-span-4"><TradesTable onOpen={setEdit} /></div>
          </div>
          <div id="outlook" className="scroll-mt-20"><OutlookCard /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        {states.map(({ a, plan, s }) => {
          const news = newsBlock(plan, now);
          const planDone = plan && Object.values(plan.checklist ?? {}).filter(Boolean).length >= 6;
          const wait = msToWindow(a, now, plan);
          const blocked = !s.canTrade || !!news;
          const rangeToFloor = s.equity - s.floor;
          const totalRoom = a.starting_balance - s.floor;
          return (
            <Card
              key={a.id}
              title={
                <span className="flex items-center gap-2 normal-case tracking-normal">
                  <span className="text-sm font-semibold text-ink">{a.name}</span>
                  <Badge>{a.instrument}</Badge>
                </span>
              }
              action={
                blocked ? <Badge tone="down">⛔ Locked</Badge> : <Badge tone="up">● Clear to trade</Badge>
              }
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
                <Stat label="Equity" value={fmtUsd(s.equity)} sub={`${fmtUsd(s.equity - a.starting_balance, true)} total`} />
                <Stat label="Today" value={fmtUsd(s.todayNet, true)} tone={s.todayNet > 0 ? "up" : s.todayNet < 0 ? "down" : undefined} sub={`${s.todayTrades}/${s.maxTrades} trades`} />
                <Stat label="Risk / trade" value={fmtUsd(s.riskUsd)} sub={`${s.riskPct}%${s.lossStreak ? " · streak cut" : ""}`} tone={s.lossStreak ? "warn" : undefined} />
                <Stat label="A+ slots" value={`${s.tradesLeft}`} sub={`min 1:${a.min_rr}`} tone={s.tradesLeft ? undefined : "mute"} />
              </div>

              <div className="mt-5 space-y-3 text-xs">
                <div>
                  <div className="mb-1 flex justify-between text-mute">
                    <span>Max drawdown buffer · floor {fmtUsd(s.floor)}</span>
                    <span className="num">{fmtUsd(rangeToFloor)}</span>
                  </div>
                  <Meter value={totalRoom > 0 ? rangeToFloor / totalRoom : 0} tone={rangeToFloor / totalRoom < 0.35 ? "down" : rangeToFloor / totalRoom < 0.7 ? "warn" : "up"} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-mute">
                    <span>Personal daily stop · −{a.personal_daily_loss_pct}% ({fmtUsd(s.personalStop)})</span>
                    <span className="num">{fmtUsd(s.equity - s.personalStop)}</span>
                  </div>
                  <Meter value={(s.equity - s.personalStop) / (s.sod * (a.personal_daily_loss_pct / 100) || 1)} tone="accent" />
                </div>
                {s.targetUsd != null && (
                  <div>
                    <div className="mb-1 flex justify-between text-mute">
                      <span>Target {fmtUsd(s.targetUsd)} · {s.profitableDays}/{a.min_profitable_days} profitable days</span>
                      <span className="num">{fmtPct(s.targetProgress ?? 0)}</span>
                    </div>
                    <Meter value={s.targetProgress ?? 0} tone="up" />
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                {!planDone && (
                  <Link href={`/plan?account=${a.id}`} className="flex items-center justify-between rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-warn">
                    Pre-market plan not done for today <span>→</span>
                  </Link>
                )}
                {news && <div className="rounded-lg border border-down/30 bg-down/5 px-3 py-2 text-down">News block: {news} IST ±15 min</div>}
                {s.reasons.map((r) => (
                  <div key={r} className="rounded-lg border border-line px-3 py-2 text-mute">{r}</div>
                ))}
                {wait > 0 && (
                  <div className="text-mute">{windowLabel(a, plan)} window opens in {fmtDur(wait)}</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

          <div id="calendar" className="scroll-mt-20"><EconWeek market={market} /></div>
          <MarketPanel market={market} />
        </div>

        <aside className="space-y-5">
          <StatusCard now={now} />
          <TodoList now={now} />
          <NextEventCard events={market.data?.events ?? []} now={now} />
          <CheckinCard now={now} />
          <DontRepeat />
          {breaksToday.length > 0 && (
            <Card title="Rule breaks today">
              <ul className="space-y-1.5 text-sm">
                {breaksToday.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-1.5">
                    <span className="text-mute">{fmtIST(t.opened_at, false)}</span>
                    <span>{t.instrument}</span>
                    {t.gate_score < 8 && <Badge tone="warn">Gate {t.gate_score}/8</Badge>}
                    {t.override_reason && <Badge tone="down">Override</Badge>}
                    {t.mistakes.map((m) => <Badge key={m}>{m}</Badge>)}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <TradeModal trade={edit} onClose={() => setEdit(null)} />
      <StartDay open={startDay} onClose={() => setStartDay(false)} now={now} />
    </>
  );
}
