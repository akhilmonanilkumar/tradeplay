import type { Account, DayPlan, Payout, Tier, Trade } from "./types";

/* ---------- basic trade math ---------- */

export function rr(entry: number, sl: number, tp: number): number {
  const risk = Math.abs(entry - sl);
  if (!risk) return 0;
  return Math.round((Math.abs(tp - entry) / risk) * 100) / 100;
}

/** Direction sanity: SL on the losing side, TP on the winning side. */
export function levelsValid(direction: "long" | "short", entry: number, sl: number, tp: number): boolean {
  if (![entry, sl, tp].every(Number.isFinite)) return false;
  return direction === "long" ? sl < entry && tp > entry : sl > entry && tp < entry;
}

/**
 * Position size so that a stop-out (including round-trip fees) loses exactly riskUsd.
 * Gold: contract_size 100 (oz/lot), fee_rate 0  -> lots.
 * BTC:  contract_size 1, fee_rate 0.0008       -> BTC qty.
 */
export function positionSize(account: Pick<Account, "contract_size" | "fee_rate">, entry: number, sl: number, riskUsd: number): number {
  const perUnit = account.contract_size * (Math.abs(entry - sl) + entry * account.fee_rate);
  if (!perUnit || riskUsd <= 0) return 0;
  return riskUsd / perUnit;
}

/** Share of the stop-out loss that is fees (useful warning for BTC tight stops). */
export function feeShare(account: Pick<Account, "fee_rate">, entry: number, sl: number): number {
  const fee = entry * account.fee_rate;
  const total = Math.abs(entry - sl) + fee;
  return total ? fee / total : 0;
}

export function roundSize(instrument: string, size: number): number {
  const step = /XAU|GOLD/i.test(instrument) ? 0.01 : 0.001;
  return Math.floor(size / step) * step;
}

/* ---------- account state ---------- */

/** Most recent daily reset instant (UTC) at or before `now`. */
export function dayStart(account: Pick<Account, "day_reset_utc">, now = new Date()): Date {
  const [h, m] = account.day_reset_utc.split(":").map(Number);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h || 0, m || 0));
  if (d.getTime() > now.getTime()) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

const closedTime = (t: Trade) => new Date(t.closed_at ?? t.opened_at).getTime();

export function balanceAt(account: Account, trades: Trade[], payouts: Payout[], at: number = Infinity): number {
  let bal = Number(account.starting_balance);
  for (const t of trades) {
    if (t.account_id === account.id && t.status === "closed" && t.net_pnl != null && closedTime(t) < at) bal += Number(t.net_pnl);
  }
  for (const p of payouts) {
    if (p.account_id === account.id && new Date(p.paid_at).getTime() < at) bal -= Number(p.amount);
  }
  return bal;
}

/** Highest closed balance ever reached (for trailing drawdown). */
export function peakBalance(account: Account, trades: Trade[]): number {
  const closed = trades
    .filter((t) => t.account_id === account.id && t.status === "closed" && t.net_pnl != null)
    .sort((a, b) => closedTime(a) - closedTime(b));
  let bal = Number(account.starting_balance);
  let peak = bal;
  for (const t of closed) {
    bal += Number(t.net_pnl);
    peak = Math.max(peak, bal);
  }
  return peak;
}

export function overallFloor(account: Account, trades: Trade[]): number {
  const base = account.dd_type === "trailing" ? peakBalance(account, trades) : Number(account.starting_balance);
  return base * (1 - account.max_overall_loss_pct / 100);
}

export function tierFor(account: Account, equity: number): Tier | null {
  const ladder = [...(account.risk_ladder ?? [])].sort((a, b) => b.min_equity - a.min_equity);
  return ladder.find((t) => equity >= t.min_equity) ?? null;
}

/** True when the last N closed trades on the account were all losses. */
export function onLossStreak(account: Account, trades: Trade[]): boolean {
  const n = account.loss_streak_n;
  if (!n) return false;
  const closed = trades
    .filter((t) => t.account_id === account.id && t.status === "closed" && t.net_pnl != null)
    .sort((a, b) => closedTime(b) - closedTime(a))
    .slice(0, n);
  return closed.length === n && closed.every((t) => Number(t.net_pnl) < 0);
}

export type AccountState = {
  equity: number;
  sod: number;
  todayNet: number;
  todayTrades: number;
  todayLosses: number;
  openTrades: number;
  floor: number;
  floorBuffer: number;
  dailyFloor: number;
  dailyBuffer: number;
  personalStop: number;
  riskPct: number;
  riskUsd: number;
  maxTrades: number;
  tradesLeft: number;
  canTrade: boolean;
  reasons: string[];
  lossStreak: boolean;
  targetUsd: number | null;
  targetProgress: number | null;
  profitableDays: number;
  nextReset: Date;
};

export function accountState(account: Account, trades: Trade[], payouts: Payout[], now = new Date()): AccountState {
  const start = dayStart(account, now);
  const startMs = start.getTime();
  const mine = trades.filter((t) => t.account_id === account.id && t.status !== "cancelled");

  const equity = balanceAt(account, trades, payouts);
  const sod = balanceAt(account, trades, payouts, startMs);
  const today = mine.filter((t) => new Date(t.opened_at).getTime() >= startMs);
  const todayClosed = mine.filter((t) => t.status === "closed" && t.net_pnl != null && closedTime(t) >= startMs);
  const todayNet = todayClosed.reduce((s, t) => s + Number(t.net_pnl), 0);
  const todayLosses = todayClosed.filter((t) => Number(t.net_pnl) < 0).length;
  const openTrades = mine.filter((t) => t.status === "open").length;

  const floor = overallFloor(account, trades);
  const dailyFloor = sod * (1 - account.max_daily_loss_pct / 100);
  const personalStop = sod * (1 - account.personal_daily_loss_pct / 100);

  const tier = tierFor(account, equity);
  const lossStreak = onLossStreak(account, trades);
  let riskPct = tier?.risk_pct ?? 0;
  if (lossStreak && account.loss_streak_risk_pct != null) riskPct = Math.min(riskPct, account.loss_streak_risk_pct);
  const maxTrades = Math.min(tier?.max_trades ?? account.max_trades_per_day, account.max_trades_per_day);

  const reasons: string[] = [];
  if (account.status !== "active") reasons.push(`Account is ${account.status}`);
  if (account.hard_stop_equity != null && equity <= account.hard_stop_equity) reasons.push(`Equity at/below your hard stop (${fmtUsd(account.hard_stop_equity)}) — review first`);
  else if (!tier) reasons.push("Equity below every risk tier");
  if (today.length >= maxTrades) reasons.push(`Trade limit reached (${today.length}/${maxTrades})`);
  if (todayLosses >= account.max_losses_per_day) reasons.push(`${todayLosses} losses today — done`);
  if (equity <= personalStop) reasons.push(`Personal daily stop hit (−${account.personal_daily_loss_pct}%)`);
  if (account.max_daily_profit_pct && todayNet >= sod * (account.max_daily_profit_pct / 100))
    reasons.push(`Daily profit cap reached (+${account.max_daily_profit_pct}%) — lock the day`);
  if (!windowOpen(account, now)) reasons.push(`Outside your ${account.session_window} window`);
  if (equity <= dailyFloor) reasons.push("Firm daily loss limit reached");
  if (equity <= floor) reasons.push("Max drawdown breached");

  const riskUsd = Math.round(equity * (riskPct / 100) * 100) / 100;
  const targetUsd = account.target_pct
    ? Math.round(Number(account.starting_balance) * (1 + account.target_pct / 100) * 100) / 100
    : null;
  const targetProgress =
    targetUsd != null ? Math.max(0, Math.min(1, (equity - account.starting_balance) / (targetUsd - account.starting_balance))) : null;

  const next = new Date(startMs);
  next.setUTCDate(next.getUTCDate() + 1);

  return {
    equity,
    sod,
    todayNet,
    todayTrades: today.length,
    todayLosses,
    openTrades,
    floor,
    floorBuffer: equity - floor,
    dailyFloor,
    dailyBuffer: equity - dailyFloor,
    personalStop,
    riskPct,
    riskUsd,
    maxTrades,
    tradesLeft: Math.max(0, maxTrades - today.length),
    canTrade: reasons.length === 0,
    reasons,
    lossStreak,
    targetUsd,
    targetProgress,
    profitableDays: profitableDays(account, trades),
    nextReset: next,
  };
}

/** Days (by the account's reset boundary) whose closed net P&L was positive. */
export function profitableDays(account: Account, trades: Trade[]): number {
  const byDay = new Map<string, number>();
  for (const t of trades) {
    if (t.account_id !== account.id || t.status !== "closed" || t.net_pnl == null) continue;
    const key = dayStart(account, new Date(closedTime(t))).toISOString();
    byDay.set(key, (byDay.get(key) ?? 0) + Number(t.net_pnl));
  }
  return [...byDay.values()].filter((v) => v > 0).length;
}

/* ---------- sessions (Brad Go Q-zones, defined in New York time so DST is automatic) ---------- */

export type SessionInfo = { name: string; inWindow: boolean };

export function nyHour(d = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

export function sessionAt(d = new Date()): SessionInfo {
  const h = nyHour(d);
  if (h >= 2 && h < 5) return { name: "London", inWindow: true };
  if (h >= 7 && h < 10) return { name: "New York", inWindow: true };
  if (h >= 20) return { name: "Asia", inWindow: true };
  return { name: "Off-session", inWindow: false };
}

export function windowOpen(account: Pick<Account, "session_window">, d = new Date()): boolean {
  if (!account.session_window || account.session_window === "Any") return true;
  const s = sessionAt(d);
  return s.inWindow && s.name === account.session_window;
}

/** Next opening of the account's window, in ms from `d` (0 if open now). */
export function msToWindow(account: Pick<Account, "session_window">, d = new Date()): number {
  if (windowOpen(account, d)) return 0;
  for (let m = 1; m <= 24 * 60; m++) {
    const t = new Date(d.getTime() + m * 60000);
    if (windowOpen(account, t)) return m * 60000;
  }
  return 0;
}

/** Today's plan date in IST (YYYY-MM-DD). */
export function todayIST(d = new Date()): string {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Returns the news time (IST "HH:MM") currently blocking entries, if within ±15 min. */
export function newsBlock(plan: Pick<DayPlan, "news_times" | "plan_date"> | null | undefined, d = new Date(), minutes = 15): string | null {
  if (!plan) return null;
  for (const hm of plan.news_times ?? []) {
    const t = new Date(`${plan.plan_date}T${hm.length === 5 ? hm : hm.slice(0, 5)}:00+05:30`).getTime();
    if (Number.isFinite(t) && Math.abs(d.getTime() - t) <= minutes * 60000) return hm;
  }
  return null;
}

/* ---------- discipline score (last 100 trades, process not P&L) ---------- */

export type Discipline = {
  score: number | null;
  sample: number;
  status: "building" | "provisional" | "ready";
  parts: { label: string; value: number; weight: number }[];
};

export function disciplineScore(trades: Trade[]): Discipline {
  const recent = trades
    .filter((t) => t.status !== "cancelled")
    .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
    .slice(0, 100);
  const n = recent.length;
  const share = (f: (t: Trade) => boolean) => (n ? recent.filter(f).length / n : 0);
  const parts = [
    { label: "A+ gate 8/8", value: share((t) => t.gate_score === 8), weight: 0.3 },
    { label: "Risk within plan", value: share((t) => t.planned_risk_usd == null || Number(t.risk_usd) <= Number(t.planned_risk_usd) * 1.05), weight: 0.25 },
    { label: "No guardrail overrides", value: share((t) => !t.override_reason), weight: 0.25 },
    { label: "No mistakes tagged", value: share((t) => !t.mistakes?.length), weight: 0.2 },
  ];
  const score = n ? Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) * 100) : null;
  return { score: n >= 10 ? score : null, sample: n, status: n < 10 ? "building" : n < 30 ? "provisional" : "ready", parts };
}

/* ---------- stats ---------- */

export type Stats = {
  n: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
  net: number;
  profitFactor: number | null;
  avgWinR: number;
  avgLossR: number;
  maxDdR: number;
  aPlusRate: number;
};

export function stats(trades: Trade[]): Stats {
  const closed = trades.filter((t) => t.status === "closed" && t.r_multiple != null);
  const rs = closed.map((t) => Number(t.r_multiple));
  const wins = closed.filter((t) => Number(t.net_pnl) > 0);
  const losses = closed.filter((t) => Number(t.net_pnl) < 0);
  const grossWin = wins.reduce((s, t) => s + Number(t.net_pnl), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.net_pnl), 0));
  let cum = 0, peak = 0, dd = 0;
  for (const r of [...closed].sort((a, b) => closedTime(a) - closedTime(b)).map((t) => Number(t.r_multiple))) {
    cum += r;
    peak = Math.max(peak, cum);
    dd = Math.max(dd, peak - cum);
  }
  const totalR = rs.reduce((s, r) => s + r, 0);
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  return {
    n: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? wins.length / closed.length : 0,
    totalR,
    avgR: closed.length ? totalR / closed.length : 0,
    net: closed.reduce((s, t) => s + Number(t.net_pnl), 0),
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? Infinity : null,
    avgWinR: avg(wins.map((t) => Number(t.r_multiple))),
    avgLossR: avg(losses.map((t) => Number(t.r_multiple))),
    maxDdR: dd,
    aPlusRate: closed.length ? closed.filter((t) => t.gate_score === 8).length / closed.length : 0,
  };
}

export function groupStats(trades: Trade[], key: (t: Trade) => string | null | undefined): { key: string; s: Stats }[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = key(t) || "—";
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([k, ts]) => ({ key: k, s: stats(ts) }))
    .filter((g) => g.s.n > 0)
    .sort((a, b) => b.s.totalR - a.s.totalR);
}

export function equityCurveR(trades: Trade[]): { t: number; r: number }[] {
  const closed = trades
    .filter((t) => t.status === "closed" && t.r_multiple != null)
    .sort((a, b) => closedTime(a) - closedTime(b));
  let cum = 0;
  return closed.map((t) => ({ t: closedTime(t), r: (cum += Number(t.r_multiple)) }));
}

/* ---------- formatting ---------- */

export function fmtUsd(n: number | null | undefined, signed = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  if (!signed) return n < 0 ? `−${s}` : s;
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

export function fmtR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}R`;
}

export function fmtPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtIST(iso: string | Date, withDate = true): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    ...(withDate ? { day: "2-digit", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Monday 00:00 IST of the week containing d, returned as YYYY-MM-DD. */
export function weekStartIST(d = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const day = (ist.getUTCDay() + 6) % 7;
  ist.setUTCDate(ist.getUTCDate() - day);
  return ist.toISOString().slice(0, 10);
}

export function inWeekIST(iso: string, weekStart: string): boolean {
  const startMs = new Date(`${weekStart}T00:00:00+05:30`).getTime();
  const t = new Date(iso).getTime();
  return t >= startMs && t < startMs + 7 * 86400 * 1000;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
