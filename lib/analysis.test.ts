import { test } from "node:test";
import assert from "node:assert/strict";
import { applyWhatIf, diagnoseTrade, drawdownR, matchLessons, monteCarlo, parseDictation, rolling, streaks } from "./analysis.ts";
import { accountState, inCustomWindow, windowLabel, windowOpen } from "./calc.ts";
import type { Account, DayPlan, Lesson, Trade } from "./types.ts";

const acct: Account = {
  id: "fh", name: "FundedHive 25K PFP", firm: "FundedHive", instrument: "XAUUSD", kind: "funded", status: "active",
  starting_balance: 25000, target_pct: null, max_daily_loss_pct: 5, max_overall_loss_pct: 10, dd_type: "static",
  min_profitable_days: 0, day_reset_utc: "00:00:00", contract_size: 100, fee_rate: 0, min_rr: 3,
  max_trades_per_day: 2, max_losses_per_day: 2, personal_daily_loss_pct: 1, hard_stop_equity: 23750,
  risk_ladder: [{ min_equity: 24500, risk_pct: 0.5, max_trades: 2 }], loss_streak_n: null, loss_streak_risk_pct: null,
  notes: null, created_at: "2026-10-01T00:00:00Z", max_daily_profit_pct: 3, session_window: "New York",
};
const btc: Account = { ...acct, id: "bo", name: "Breakout 5K", firm: "Breakout", instrument: "BTCUSDT.P" };

let n = 0;
function trade(p: Partial<Trade>): Trade {
  const r = (p.r_multiple ?? 0) as number;
  return {
    id: `t${n++}`, account_id: "fh", setup_id: null, status: "closed", opened_at: "2026-10-12T12:00:00Z",
    closed_at: "2026-10-12T13:00:00Z", instrument: "XAUUSD", direction: "long", session: "New York",
    entry: 100, sl: 99, tp: 103, exit: null, size: 1, risk_usd: 125, fees: 0, gross_pnl: r * 125,
    htf_aligned: true, correct_half: true, in_poi: true, liquidity_swept: true, market_shift: true, in_session: true,
    news_clear: true, poi_type: null, entry_model: null, invalidation: null, mistakes: [], emotions: [], review: null,
    chart_url: null, before_path: null, after_path: null, rr_planned: 3, net_pnl: r * 125, r_multiple: r,
    gate_score: 8, planned_risk_usd: 125, override_reason: null, guardrail_breaches: [], created_at: "2026-10-12T12:00:00Z",
    ...p,
  } as Trade;
}
const plan = (p: Partial<DayPlan>): DayPlan => ({
  id: "p", account_id: "fh", plan_date: "2026-10-12", bias: null, htf_range: null, magnet: null, invalidation: null,
  pois: null, news_times: [], checklist: {}, notes: null, sessions: [], custom_window: null, ...p,
});

// 12:00Z on 12 Oct 2026 = 08:00 New York (EDT) → NY window; = 17:30 IST
test("clean loss is not a mistake", () => {
  const d = diagnoseTrade(trade({ r_multiple: -1 }), { account: acct, plan: plan({}) });
  assert.equal(d.outcome, "loss");
  assert.match(d.verdict, /Clean loss/);
  assert.equal(d.lesson, null);
});

test("avoidable loss finds causes and a lesson", () => {
  const d = diagnoseTrade(
    trade({ r_multiple: -1.4, liquidity_swept: false, gate_score: 7, direction: "short", mistakes: ["Moved SL"], risk_usd: 200 }),
    { account: acct, plan: plan({ bias: "long" }) },
  );
  const codes = d.causes.map((c) => c.code);
  for (const c of ["gate", "oversized", "bias", "stop_slip", "m:Moved SL"]) assert.ok(codes.includes(c), c);
  assert.ok(d.lesson?.rule);
});

test("win with broken rules is flagged", () => {
  const d = diagnoseTrade(trade({ r_multiple: 3, override_reason: "felt strong", guardrail_breaches: ["Outside window"] }), { account: acct });
  assert.match(d.verdict, /despite/);
});

test("revenge and overtrading detection", () => {
  const prior = [
    trade({ id: "a", opened_at: "2026-10-12T11:00:00Z", closed_at: "2026-10-12T11:50:00Z", r_multiple: -1 }),
    trade({ id: "b", opened_at: "2026-10-12T11:10:00Z", closed_at: "2026-10-12T11:40:00Z", r_multiple: -1 }),
  ];
  const t = trade({ id: "c", opened_at: "2026-10-12T12:00:00Z", r_multiple: -1 });
  const codes = diagnoseTrade(t, { account: acct, trades: [...prior, t] }).causes.map((c) => c.code);
  assert.ok(codes.includes("revenge"));
  assert.ok(codes.includes("overtrading"));
});

test("per-plan sessions override the account default", () => {
  const ny8 = new Date("2026-10-12T12:00:00Z"); // 08:00 NY
  const ldn3 = new Date("2026-10-12T07:00:00Z"); // 03:00 NY
  assert.equal(windowOpen(acct, ldn3), false);
  assert.equal(windowOpen(acct, ldn3, plan({ sessions: ["London"] })), true);
  assert.equal(windowOpen(acct, ny8, plan({ sessions: ["London"] })), false);
  assert.equal(windowOpen(acct, ny8, plan({ sessions: ["London", "New York"] })), true);
  assert.equal(windowLabel(acct, plan({ sessions: ["London", "Custom"], custom_window: "13:30-16:00" })), "London / 13:30-16:00 IST");
});

test("custom IST window incl. across midnight", () => {
  assert.equal(inCustomWindow("17:00-18:00", new Date("2026-10-12T12:00:00Z")), true); // 17:30 IST
  assert.equal(inCustomWindow("18:00-19:00", new Date("2026-10-12T12:00:00Z")), false);
  assert.equal(inCustomWindow("23:00-02:00", new Date("2026-10-12T19:00:00Z")), true); // 00:30 IST
  assert.equal(windowOpen(acct, new Date("2026-10-12T12:00:00Z"), plan({ sessions: ["Custom"], custom_window: "17:00-18:00" })), true);
});

test("balance adjustments move equity and the guardrail uses the plan's session", () => {
  const now = new Date("2026-10-12T07:00:00Z");
  const s = accountState(acct, [], [], now, {
    plan: plan({ sessions: ["London"] }),
    adjustments: [{ id: "x", account_id: "fh", amount: -150, at: "2026-10-11T00:00:00Z", note: "sync" }],
  });
  assert.equal(s.equity, 24850);
  assert.ok(!s.reasons.some((r) => r.startsWith("Outside")));
  const s2 = accountState(acct, [], [], now);
  assert.ok(s2.reasons.some((r) => r.includes("New York window")));
});

test("drawdown, rolling and streaks", () => {
  const ts = [1, -1, -1, 3, -1, 2].map((r, i) => trade({ r_multiple: r, closed_at: `2026-10-0${i + 1}T10:00:00Z`, opened_at: `2026-10-0${i + 1}T09:00:00Z` }));
  const dd = drawdownR(ts);
  assert.equal(Math.min(...dd.map((d) => d.dd)), -2);
  assert.equal(rolling(ts, 3).length, 4);
  assert.deepEqual(streaks(ts), { maxWin: 1, maxLoss: 2, current: 1 });
});

test("what-if filters", () => {
  const ts = [trade({ r_multiple: 3 }), trade({ r_multiple: -1, gate_score: 6 }), trade({ r_multiple: -1, mistakes: ["Early entry"] })];
  assert.equal(applyWhatIf(ts, { aPlusOnly: true }).length, 2);
  assert.equal(applyWhatIf(ts, { aPlusOnly: true, noMistakes: true }).length, 1);
});

test("monte carlo is deterministic and sane", () => {
  const base = { start: 25000, riskPct: 0.5, targetPct: 10, maxLossPct: 10, dailyLossPct: 5, tradesPerDay: 2, days: 60, runs: 500 };
  const good = monteCarlo({ ...base, rs: [3, -1, -1, 3, -1] })!;
  const bad = monteCarlo({ ...base, rs: [-1, -1, -1, 1] })!;
  assert.ok(good.pass > bad.pass);
  assert.ok(bad.breach > good.breach);
  assert.deepEqual(monteCarlo({ ...base, rs: [3, -1] }), monteCarlo({ ...base, rs: [3, -1] }));
  assert.equal(good.bands.length, 60);
});

test("dictation parsing", () => {
  const p = parseDictation("Long gold entry 2384.6 stop 2382.10 target 2393.1 London flip zone, entered early, FOMO", [acct, btc]);
  assert.equal(p.account_id, "fh");
  assert.equal(p.direction, "long");
  assert.equal(p.entry, 2384.6);
  assert.equal(p.sl, 2382.1);
  assert.equal(p.tp, 2393.1);
  assert.equal(p.session, "London");
  assert.equal(p.poi_type, "Flip zone");
  assert.deepEqual(p.mistakes, ["Early entry"]);
  assert.deepEqual(p.emotions, ["FOMO"]);
  const q = parseDictation("Bitcoin bias bearish, CPI at 6 pm and FOMC at 23:30, magnet is the Asia low 61,200", [acct, btc]);
  assert.equal(q.account_id, "bo");
  assert.equal(q.bias, "short");
  assert.deepEqual(q.news_times, ["18:00", "23:30"]);
  assert.match(q.magnet ?? "", /Asia low 61,200/);
  const s = parseDictation("short btc sell at 62,450 sl 62,900 tp 61,100", [acct, btc]);
  assert.equal(s.direction, "short");
  assert.equal(s.entry, 62450);
  assert.equal(s.sl, 62900);
  assert.equal(s.tp, 61100);
});

test("lessons match the account first", () => {
  const L = (p: Partial<Lesson>): Lesson => ({ id: "l", trade_id: null, account_id: null, instrument: null, kind: "loss", title: "x", cause: null, rule: "r", tags: [], source: "manual", active: true, created_at: "2026-10-01", ...p });
  const out = matchLessons([L({ id: "g" }), L({ id: "other", account_id: "bo" }), L({ id: "mine", account_id: "fh" }), L({ id: "off", active: false })], { account_id: "fh", instrument: "XAUUSD" });
  assert.deepEqual(out.map((l) => l.id), ["mine", "g"]);
});

test("sequence patterns and combos", async () => {
  const { sequencePatterns, edgeCombos, emotionStats } = await import("./analysis.ts");
  const mk = (i: number, r: number, extra: Partial<Trade> = {}) =>
    trade({ id: `s${i}`, r_multiple: r, opened_at: `2026-10-0${1 + Math.floor(i / 2)}T0${i % 2 ? 9 : 7}:00:00Z`, closed_at: `2026-10-0${1 + Math.floor(i / 2)}T0${i % 2 ? 9 : 7}:20:00Z`, ...extra });
  const ts = [mk(0, -1), mk(1, -1), mk(2, 3, { session: "London", poi_type: "FVG" }), mk(3, -1), mk(4, 3, { session: "London", poi_type: "FVG" }), mk(5, 3, { session: "London", poi_type: "FVG" })];
  const seq = sequencePatterns(ts);
  assert.ok(seq.find((r) => r.label === "Right after a loss"));
  assert.equal(seq.find((r) => r.label === "First trade of the day")!.n, 3);
  const combos = edgeCombos(ts, { session: (t) => t.session ?? "—", poi: (t) => t.poi_type ?? "—" }, 3);
  assert.equal(combos.best[0].label, "London · FVG");
  const em = emotionStats([trade({ r_multiple: -1, emotion_log: [{ at: "x", stage: "during", emotions: ["Anxious"] }], mental: { stress: 5 } }), trade({ r_multiple: 3, emotions: ["Calm"], mental: { stress: 1 } })]);
  assert.equal(em.byFeeling[0].label, "Anxious");
  assert.equal(em.mental.find((m) => m.key === "stress")!.high.avgR, -1);
});
