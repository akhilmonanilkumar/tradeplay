import { test } from "node:test";
import assert from "node:assert/strict";
import { accountState, disciplineScore, windowOpen, dayStart, levelsValid, positionSize, rr, sessionAt, stats, tierFor, weekStartIST } from "./calc.ts";
import type { Account, Trade } from "./types.ts";

const breakout: Account = {
  id: "bo", name: "Breakout 5K Funded", firm: "Breakout", instrument: "BTCUSDT.P", kind: "funded", status: "active",
  starting_balance: 5000, target_pct: null, max_daily_loss_pct: 3, max_overall_loss_pct: 3, dd_type: "static",
  min_profitable_days: 0, day_reset_utc: "00:30:00", contract_size: 1, fee_rate: 0.0008, min_rr: 3,
  max_trades_per_day: 2, max_losses_per_day: 2, personal_daily_loss_pct: 1, hard_stop_equity: 4880,
  risk_ladder: [
    { min_equity: 5150, risk_pct: 0.75, max_trades: 2 },
    { min_equity: 5000, risk_pct: 0.5, max_trades: 2 },
    { min_equity: 4925, risk_pct: 0.25, max_trades: 2 },
    { min_equity: 4880, risk_pct: 0.25, max_trades: 1 },
  ],
  loss_streak_n: null, loss_streak_risk_pct: null, notes: null, created_at: "2026-10-01T00:00:00Z",
  max_daily_profit_pct: 3, session_window: "New York",
};

const fh: Account = {
  ...breakout, id: "fh", name: "FundedHive 25K", instrument: "XAUUSD", kind: "challenge", starting_balance: 25000,
  target_pct: 10, max_daily_loss_pct: 5, max_overall_loss_pct: 10, day_reset_utc: "00:00:00", contract_size: 100,
  fee_rate: 0, hard_stop_equity: 23750, min_profitable_days: 3,
  risk_ladder: [{ min_equity: 24500, risk_pct: 0.5, max_trades: 2 }, { min_equity: 23750, risk_pct: 0.25, max_trades: 2 }],
  loss_streak_n: 2, loss_streak_risk_pct: 0.25,
};

let n = 0;
function trade(p: Partial<Trade>): Trade {
  const gross = p.gross_pnl ?? null;
  const fees = p.fees ?? 0;
  const risk = p.risk_usd ?? 25;
  return {
    id: `t${n++}`, account_id: "bo", setup_id: null, status: "closed", opened_at: "2026-10-12T10:00:00Z",
    closed_at: "2026-10-12T11:00:00Z", instrument: "BTCUSDT.P", direction: "long", session: "New York",
    entry: 100, sl: 99, tp: 103, exit: null, size: 1, risk_usd: risk, fees, gross_pnl: gross,
    htf_aligned: true, correct_half: true, in_poi: true, liquidity_swept: true, market_shift: true, in_session: true,
    news_clear: true, poi_type: null, entry_model: null, invalidation: null, mistakes: [], emotions: [], review: null,
    chart_url: null, before_path: null, after_path: null, rr_planned: 3,
    net_pnl: gross == null ? null : gross - fees, r_multiple: gross == null ? null : (gross - fees) / risk,
    gate_score: 8, created_at: "2026-10-12T10:00:00Z", ...p,
  } as Trade;
}

test("rr and level validation", () => {
  assert.equal(rr(62000, 61500, 63500), 3);
  assert.equal(levelsValid("long", 100, 99, 103), true);
  assert.equal(levelsValid("short", 100, 99, 103), false);
});

test("playbook sizing examples", () => {
  // Gold: $125 risk, $3 stop -> 0.4166 lots
  assert.ok(Math.abs(positionSize(fh, 4190, 4187, 125) - 0.41667) < 1e-4);
  // BTC: $25 risk, $400 stop at 82,800 incl. fees -> ~0.0536 BTC
  assert.ok(Math.abs(positionSize(breakout, 82800, 82400, 25) - 0.05363) < 1e-4);
});

test("risk ladder tiers", () => {
  assert.equal(tierFor(breakout, 5200)?.risk_pct, 0.75);
  assert.equal(tierFor(breakout, 5000)?.risk_pct, 0.5);
  assert.equal(tierFor(breakout, 4950)?.risk_pct, 0.25);
  assert.equal(tierFor(breakout, 4900)?.max_trades, 1);
  assert.equal(tierFor(breakout, 4870), null);
});

test("daily reset boundary 00:30 UTC", () => {
  assert.equal(dayStart(breakout, new Date("2026-10-13T00:10:00Z")).toISOString(), "2026-10-12T00:30:00.000Z");
  assert.equal(dayStart(breakout, new Date("2026-10-13T00:45:00Z")).toISOString(), "2026-10-13T00:30:00.000Z");
});

test("fresh Breakout account: $25 risk, 2 slots, can trade", () => {
  const s = accountState(breakout, [], [], new Date("2026-10-13T12:00:00Z"));
  assert.equal(s.riskUsd, 25);
  assert.equal(s.tradesLeft, 2);
  assert.equal(s.floor, 4850);
  assert.equal(s.canTrade, true);
});

test("two losses today blocks trading", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const ts = [
    trade({ opened_at: "2026-10-13T08:00:00Z", closed_at: "2026-10-13T08:30:00Z", gross_pnl: -25 }),
    trade({ opened_at: "2026-10-13T09:00:00Z", closed_at: "2026-10-13T09:30:00Z", gross_pnl: -25 }),
  ];
  const s = accountState(breakout, ts, [], now);
  assert.equal(s.equity, 4950);
  assert.equal(s.canTrade, false);
  assert.equal(s.riskUsd, 12.38); // 0.25% of 4950
});

test("hard stop at $4,880", () => {
  const ts = [trade({ closed_at: "2026-10-10T09:00:00Z", opened_at: "2026-10-10T08:00:00Z", gross_pnl: -120 })];
  const s = accountState(breakout, ts, [], new Date("2026-10-13T12:00:00Z"));
  assert.equal(s.equity, 4880);
  assert.equal(s.canTrade, false);
});

test("FundedHive loss streak halves risk", () => {
  const ts = [
    trade({ account_id: "fh", opened_at: "2026-10-09T08:00:00Z", closed_at: "2026-10-09T09:00:00Z", gross_pnl: -125, risk_usd: 125 }),
    trade({ account_id: "fh", opened_at: "2026-10-10T08:00:00Z", closed_at: "2026-10-10T09:00:00Z", gross_pnl: -125, risk_usd: 125 }),
  ];
  const s = accountState(fh, ts, [], new Date("2026-10-13T12:00:00Z"));
  assert.equal(s.lossStreak, true);
  assert.equal(s.riskPct, 0.25);
  assert.equal(s.targetUsd, 27500);
});

test("stats", () => {
  const s = stats([trade({ gross_pnl: 75 }), trade({ gross_pnl: -25 }), trade({ gross_pnl: -25 })]);
  assert.equal(s.n, 3);
  assert.equal(s.totalR, 1);
  assert.ok(Math.abs(s.winRate - 1 / 3) < 1e-9);
  assert.equal(s.profitFactor, 1.5);
});

test("sessions follow New York time (DST aware)", () => {
  // 13 Oct 2026, EDT: 07:30 UTC = 03:30 NY -> London
  assert.equal(sessionAt(new Date("2026-10-13T07:30:00Z")).name, "London");
  // 12:00 UTC = 08:00 NY -> New York
  assert.equal(sessionAt(new Date("2026-10-13T12:00:00Z")).name, "New York");
  // 16:00 UTC = 12:00 NY -> off
  assert.equal(sessionAt(new Date("2026-10-13T16:00:00Z")).inWindow, false);
});

test("week start is Monday IST", () => {
  assert.equal(weekStartIST(new Date("2026-10-12T22:00:00Z")), "2026-10-12"); // Tue 03:30 IST -> Mon 12 Oct
});

test("window guardrail: NY window open 08:00 NY, closed at noon", () => {
  assert.equal(windowOpen(breakout, new Date("2026-10-13T12:00:00Z")), true);
  const s = accountState(breakout, [], [], new Date("2026-10-13T16:00:00Z"));
  assert.equal(s.canTrade, false);
  assert.ok(s.reasons.some((r) => r.includes("window")));
});

test("daily profit cap locks the day", () => {
  const ts = [trade({ opened_at: "2026-10-13T11:00:00Z", closed_at: "2026-10-13T11:30:00Z", gross_pnl: 150 })];
  const s = accountState(breakout, ts, [], new Date("2026-10-13T12:00:00Z"));
  assert.ok(s.reasons.some((r) => r.includes("profit cap")));
});

test("discipline score", () => {
  const ts = Array.from({ length: 12 }, (_, i) => trade({ gross_pnl: 10, mistakes: i < 3 ? ["Early entry"] : [] }));
  const d = disciplineScore(ts);
  assert.equal(d.status, "provisional");
  assert.equal(d.score, 95); // 0.3 + 0.25 + 0.25 + 0.2*0.75
});
