"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Card, Meter, Stat } from "@/components/ui";
import TradeModal from "@/components/TradeModal";
import { ActionsPanel, CheckinCard, DontRepeat, OutlookCard, QuoteHero, Snapshot } from "@/components/TodayWidgets";
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
      <QuoteHero now={now} />

      <div className="mb-4 mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight sm:text-[28px]">
            {slots === 0 ? "No A+ slots open. Protect the account." : `${slots} A+ slot${slots > 1 ? "s" : ""}. Stay patient.`}
          </h1>
          <p className="mt-1 text-sm text-mute">
            {fmtIST(now, false)} IST · <span className={session.inWindow ? "text-up" : ""}>{session.inWindow ? `${session.name} Q-zone open` : "Off-session"}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/plan" className="btn-ghost">Plan</Link>
          <Link href="/new" className="btn-accent">+ New trade</Link>
        </div>
      </div>

      <Snapshot now={now} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><OutlookCard /></div>
        <div className="space-y-4">
          <ActionsPanel now={now} />
          <CheckinCard now={now} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
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

      <div className="mt-4"><EconWeek market={market} /></div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><MarketPanel market={market} /></div>
        <div className="space-y-4">
          <Card title="Open positions">
            {open.length === 0 ? (
              <p className="text-sm text-mute">No open trades.</p>
            ) : (
              <ul className="divide-y divide-line">
                {open.map((t) => {
                  const acct = accounts.find((a) => a.id === t.account_id);
                  return (
                    <li key={t.id} className="py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge tone={t.direction === "long" ? "up" : "down"}>{t.direction.toUpperCase()}</Badge>
                        <span className="truncate font-medium">{t.instrument}</span>
                        <span className="truncate text-xs text-mute">{acct?.name}</span>
                      </div>
                      <div className="num mt-0.5 text-xs text-mute">{t.entry} · SL {t.sl} · TP {t.tp} · {fmtR(t.rr_planned)} · {fmtUsd(t.risk_usd)}</div>
                      <div className="mt-2 flex gap-2">
                        <button className="btn-ghost h-8 min-h-0 flex-1 text-xs" onClick={() => setEdit(t)}>Manage / close</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
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
        </div>
      </div>

      <TradeModal trade={edit} onClose={() => setEdit(null)} />
    </>
  );
}
