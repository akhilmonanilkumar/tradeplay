import { newsBlock, windowOpen, todayIST } from "./calc.ts";
import { EMOTIONS, GATE_CHECKS, MISTAKES, type Account, type DayPlan, type Lesson, type Trade } from "./types.ts";

const closedTime = (t: Trade) => new Date(t.closed_at ?? t.opened_at).getTime();
const closedSorted = (trades: Trade[]) =>
  trades.filter((t) => t.status === "closed" && t.r_multiple != null).sort((a, b) => closedTime(a) - closedTime(b));

/* =====================================================================
 * Trade post-mortem: why did this trade win or lose?
 * ===================================================================== */

export type Cause = { code: string; text: string; severity: "bad" | "warn" | "good"; rule?: string };
export type Diagnosis = {
  outcome: "win" | "loss" | "breakeven" | "open";
  verdict: string;
  causes: Cause[];
  lesson: { title: string; rule: string; cause: string } | null;
};

const RULES: Record<string, string> = {
  gate: "Only take 8/8 — if a gate box is empty, there is no trade.",
  rr: "No entry below the minimum R:R; move on rather than shrinking the target.",
  oversized: "Risk exactly the ladder amount — never size up to win back or 'because it's obvious'.",
  override: "A guardrail block is the answer, not a question. Close the app instead of overriding.",
  bias: "Trade with the day's written bias or update the plan first — never against it on impulse.",
  session: "Enter only inside the chosen session window.",
  news: "No entries within 15 minutes of high-impact news.",
  revenge: "After a loss, wait 30 minutes and re-read the plan before the next entry.",
  overtrading: "Stop at the daily trade cap — the next setup belongs to tomorrow.",
  stop_slip: "Hard stop in the platform at entry; never widen or remove it.",
  cut_winner: "Manage by the plan: hold to target or the planned trail, not by feel.",
  lucky: "A win that broke rules still counts as a mistake — log it and don't repeat it.",
};

const MISTAKE_RULE: Record<string, string> = {
  "Early entry": "Wait for the 5M/1M body close that confirms the shift before entering.",
  "Chased entry": "If price left the POI, let it go — no chasing.",
  "No sweep": "No liquidity sweep, no entry.",
  "Counter-bias": RULES.bias,
  "Moved SL": RULES.stop_slip,
  Oversized: RULES.oversized,
  "Cut winner early": RULES.cut_winner,
  Overtrading: RULES.overtrading,
  "Off-plan": "If it is not in today's plan, it is not a trade.",
  Revenge: RULES.revenge,
};

const EMOTION_NOTE: Record<string, string> = {
  FOMO: "Entered on FOMO",
  Revenge: "Revenge mindset",
  Overconfident: "Overconfident after recent results",
  Tired: "Traded tired",
  Hesitant: "Hesitated on execution",
};

type DiagCtx = { account?: Account | null; plan?: DayPlan | null; trades?: Trade[] };

export function diagnoseTrade(t: Trade, ctx: DiagCtx = {}): Diagnosis {
  const causes: Cause[] = [];
  const r = t.r_multiple == null ? null : Number(t.r_multiple);
  const outcome: Diagnosis["outcome"] =
    t.status !== "closed" || r == null ? "open" : r > 0.1 ? "win" : r < -0.1 ? "loss" : "breakeven";

  const missing = GATE_CHECKS.filter((g) => !t[g.key]).map((g) => g.label);
  if (missing.length) causes.push({ code: "gate", severity: "bad", text: `Gate ${t.gate_score}/8 — missing: ${missing.join(", ")}`, rule: RULES.gate });
  const minRr = ctx.account?.min_rr ?? 3;
  if (t.rr_planned != null && Number(t.rr_planned) < minRr)
    causes.push({ code: "rr", severity: "bad", text: `Planned R:R 1:${Number(t.rr_planned).toFixed(2)} is under your 1:${minRr} minimum`, rule: RULES.rr });
  if (t.planned_risk_usd != null && Number(t.risk_usd) > Number(t.planned_risk_usd) * 1.05)
    causes.push({ code: "oversized", severity: "bad", text: `Risked $${Number(t.risk_usd).toFixed(2)} vs $${Number(t.planned_risk_usd).toFixed(2)} allowed`, rule: RULES.oversized });
  if (t.override_reason)
    causes.push({ code: "override", severity: "bad", text: `Overrode guardrails (${(t.guardrail_breaches ?? []).join("; ") || "breach"}): “${t.override_reason}”`, rule: RULES.override });

  const plan = ctx.plan;
  if (plan?.bias && plan.bias !== "neutral" && plan.bias !== t.direction)
    causes.push({ code: "bias", severity: "bad", text: `Went ${t.direction} against the plan's ${plan.bias} bias`, rule: RULES.bias });
  const opened = new Date(t.opened_at);
  if (ctx.account && !windowOpen(ctx.account, opened, plan))
    causes.push({ code: "session", severity: "bad", text: "Entered outside the session window", rule: RULES.session });
  const news = newsBlock(plan, opened);
  if (news) causes.push({ code: "news", severity: "bad", text: `Entered within 15 min of news at ${news} IST`, rule: RULES.news });

  const sameAcct = (ctx.trades ?? []).filter((x) => x.account_id === t.account_id && x.id !== t.id && x.status !== "cancelled");
  const prevLoss = sameAcct.find(
    (x) => x.status === "closed" && Number(x.net_pnl) < 0 && x.closed_at &&
      opened.getTime() - new Date(x.closed_at).getTime() >= 0 && opened.getTime() - new Date(x.closed_at).getTime() < 30 * 60000,
  );
  if (prevLoss) causes.push({ code: "revenge", severity: "warn", text: "Opened within 30 min of a losing trade", rule: RULES.revenge });
  if (ctx.account) {
    const day = todayIST(opened);
    const before = sameAcct.filter((x) => todayIST(new Date(x.opened_at)) === day && new Date(x.opened_at) < opened).length;
    if (before >= ctx.account.max_trades_per_day)
      causes.push({ code: "overtrading", severity: "bad", text: `Trade #${before + 1} of the day (cap ${ctx.account.max_trades_per_day})`, rule: RULES.overtrading });
  }

  if (outcome === "loss" && r != null && r < -1.15)
    causes.push({ code: "stop_slip", severity: "bad", text: `Lost ${r.toFixed(2)}R — more than the planned 1R (stop moved, missing or slipped)`, rule: RULES.stop_slip });
  if (outcome === "win" && r != null && t.rr_planned != null && r < Number(t.rr_planned) * 0.6)
    causes.push({ code: "cut_winner", severity: "warn", text: `Took +${r.toFixed(2)}R of a planned ${Number(t.rr_planned).toFixed(1)}R`, rule: RULES.cut_winner });

  for (const m of t.mistakes ?? []) {
    if (m === "Off-plan" && t.override_reason) continue;
    causes.push({ code: `m:${m}`, severity: "bad", text: `Tagged mistake: ${m}`, rule: MISTAKE_RULE[m] });
  }
  for (const e of t.emotions ?? []) if (EMOTION_NOTE[e]) causes.push({ code: `e:${e}`, severity: "warn", text: EMOTION_NOTE[e] });

  const bad = causes.filter((c) => c.severity === "bad");
  let verdict: string;
  if (outcome === "open") verdict = "Still open — manage it by the plan.";
  else if (outcome === "loss" && !bad.length) {
    verdict = "Clean loss. The setup was valid and the rules were followed — this is the cost of the edge, nothing to fix.";
    causes.push({ code: "clean", severity: "good", text: "Process followed: 8/8, risk on plan, inside the window" });
  } else if (outcome === "loss") verdict = `Avoidable loss — ${bad.length} rule${bad.length > 1 ? "s" : ""} broken. Fix the process, not the strategy.`;
  else if (outcome === "win" && bad.length) {
    verdict = "Won despite breaking rules. Treat it as a mistake so it doesn't become a habit.";
    causes.push({ code: "lucky", severity: "warn", text: "Positive result reinforced a broken process", rule: RULES.lucky });
  } else if (outcome === "win") {
    verdict = "Textbook — the plan worked as designed. Repeat exactly this.";
    causes.push({ code: "clean", severity: "good", text: "8/8 gate, risk on plan, executed inside the window" });
  } else verdict = bad.length ? "Scratch trade, but rules were broken on the way in." : "Scratch — managed to break-even by the plan.";

  const top = bad.find((c) => c.rule) ?? causes.find((c) => c.code === "cut_winner" || c.code === "lucky" || c.code === "revenge");
  const lesson = top?.rule
    ? { title: top.text.length > 120 ? `${top.text.slice(0, 117)}…` : top.text, rule: top.rule, cause: top.text }
    : null;
  return { outcome, verdict, causes, lesson };
}

/** Which causes keep repeating across closed trades, and what they cost in R. */
export function recurringCauses(trades: Trade[], ctx: { accounts: Account[]; plans: DayPlan[] }, last = 100) {
  const closed = closedSorted(trades).slice(-last);
  const tally = new Map<string, { code: string; label: string; n: number; r: number; rule?: string }>();
  for (const t of closed) {
    const account = ctx.accounts.find((a) => a.id === t.account_id) ?? null;
    const plan = ctx.plans.find((p) => p.account_id === t.account_id && p.plan_date === todayIST(new Date(t.opened_at))) ?? null;
    const d = diagnoseTrade(t, { account, plan, trades });
    for (const c of d.causes) {
      if (c.severity === "good") continue;
      const key = c.code.startsWith("gate") ? "gate" : c.code;
      const label = key === "gate" ? "Gate below 8/8" : c.code.startsWith("m:") || c.code.startsWith("e:") ? c.code.slice(2) : c.text.replace(/\s*\(.*$/, "").replace(/[—:].*$/, "").trim();
      const g = tally.get(key) ?? { code: key, label, n: 0, r: 0, rule: c.rule };
      g.n += 1;
      g.r += Number(t.r_multiple);
      tally.set(key, g);
    }
  }
  return [...tally.values()].sort((a, b) => a.r - b.r || b.n - a.n);
}

/** Active lessons most relevant to an account/instrument, newest first. */
export function matchLessons(lessons: Lesson[], q: { account_id?: string | null; instrument?: string | null }, limit = 5): Lesson[] {
  const score = (l: Lesson) =>
    (l.account_id && l.account_id === q.account_id ? 2 : 0) +
    (l.instrument && q.instrument && l.instrument === q.instrument ? 1 : 0) +
    (!l.account_id && !l.instrument ? 1 : 0);
  return lessons
    .filter((l) => l.active && (!l.account_id || l.account_id === q.account_id || !q.account_id))
    .sort((a, b) => score(b) - score(a) || b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/* =====================================================================
 * Curves and distributions for Insights
 * ===================================================================== */

/** Underwater curve in R: distance below the running peak after each trade. */
export function drawdownR(trades: Trade[]): { t: number; dd: number }[] {
  let cum = 0, peak = 0;
  return closedSorted(trades).map((t) => {
    cum += Number(t.r_multiple);
    peak = Math.max(peak, cum);
    return { t: closedTime(t), dd: cum - peak };
  });
}

/** Rolling expectancy (avg R) and win rate over the last `n` trades. */
export function rolling(trades: Trade[], n = 20): { t: number; exp: number; win: number }[] {
  const c = closedSorted(trades);
  const out: { t: number; exp: number; win: number }[] = [];
  for (let i = n - 1; i < c.length; i++) {
    const w = c.slice(i - n + 1, i + 1);
    out.push({
      t: closedTime(c[i]),
      exp: w.reduce((s, x) => s + Number(x.r_multiple), 0) / n,
      win: w.filter((x) => Number(x.net_pnl) > 0).length / n,
    });
  }
  return out;
}

export function streaks(trades: Trade[]): { maxWin: number; maxLoss: number; current: number } {
  let maxWin = 0, maxLoss = 0, cur = 0;
  for (const t of closedSorted(trades)) {
    const r = Number(t.r_multiple);
    if (r > 0) cur = cur > 0 ? cur + 1 : 1;
    else if (r < 0) cur = cur < 0 ? cur - 1 : -1;
    else cur = 0;
    maxWin = Math.max(maxWin, cur);
    maxLoss = Math.min(maxLoss, cur);
  }
  return { maxWin, maxLoss: -maxLoss, current: cur };
}

/** Average R by gate score (does the A+ filter actually pay?). */
export function rByGate(trades: Trade[]): { gate: number; n: number; avgR: number }[] {
  const c = closedSorted(trades);
  const out: { gate: number; n: number; avgR: number }[] = [];
  for (let g = 0; g <= 8; g++) {
    const xs = c.filter((t) => t.gate_score === g);
    if (xs.length) out.push({ gate: g, n: xs.length, avgR: xs.reduce((s, t) => s + Number(t.r_multiple), 0) / xs.length });
  }
  return out;
}

/** Holding time (minutes) vs R for each closed trade. */
export function durationVsR(trades: Trade[]): { x: number; y: number; id: string }[] {
  return closedSorted(trades)
    .filter((t) => t.closed_at)
    .map((t) => ({ id: t.id, x: Math.max(0, (new Date(t.closed_at!).getTime() - new Date(t.opened_at).getTime()) / 60000), y: Number(t.r_multiple) }));
}

/* =====================================================================
 * What-if: replay history with stricter rules
 * ===================================================================== */

export type WhatIf = { aPlusOnly?: boolean; noMistakes?: boolean; noOverrides?: boolean; maxPerDay?: number | null; sessions?: string[] };

export function applyWhatIf(trades: Trade[], w: WhatIf): Trade[] {
  const perDay = new Map<string, number>();
  return closedSorted(trades).filter((t) => {
    if (w.aPlusOnly && t.gate_score !== 8) return false;
    if (w.noMistakes && (t.mistakes ?? []).length) return false;
    if (w.noOverrides && t.override_reason) return false;
    if (w.sessions?.length && !w.sessions.includes(t.session ?? "")) return false;
    if (w.maxPerDay) {
      const k = `${t.account_id}:${todayIST(new Date(t.opened_at))}`;
      const n = (perDay.get(k) ?? 0) + 1;
      perDay.set(k, n);
      if (n > w.maxPerDay) return false;
    }
    return true;
  });
}

/* =====================================================================
 * Monte Carlo: odds of hitting target vs breaching limits, from your own R's
 * ===================================================================== */

export type MCInput = {
  rs: number[]; // historical R multiples to resample
  start: number;
  riskPct: number; // % of current equity risked per trade
  targetPct: number | null;
  maxLossPct: number; // static overall drawdown from start
  dailyLossPct: number; // firm daily loss limit vs start-of-day equity (breach)
  dayStopPct?: number | null; // personal daily stop: ends the day, not a breach
  tradesPerDay: number;
  days: number;
  runs?: number;
  seed?: number;
};

export type MCResult = {
  pass: number; // reached target before breaching (or ended profitable if no target)
  breach: number;
  median: number;
  bands: { day: number; p10: number; p50: number; p90: number }[];
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function monteCarlo(p: MCInput): MCResult | null {
  if (!p.rs.length || p.days < 1 || p.tradesPerDay < 1) return null;
  const runs = Math.min(p.runs ?? 2000, 10000);
  const rand = rng(p.seed ?? 42);
  const floor = p.start * (1 - p.maxLossPct / 100);
  const target = p.targetPct ? p.start * (1 + p.targetPct / 100) : null;
  const byDay: number[][] = Array.from({ length: p.days }, () => []);
  const finals: number[] = [];
  let pass = 0, breach = 0;
  for (let i = 0; i < runs; i++) {
    let eq = p.start;
    let done: "pass" | "breach" | null = null;
    for (let d = 0; d < p.days; d++) {
      if (!done) {
        const sod = eq;
        for (let k = 0; k < p.tradesPerDay; k++) {
          const r = p.rs[Math.floor(rand() * p.rs.length)];
          eq += eq * (p.riskPct / 100) * r;
          if (eq <= floor || eq <= sod * (1 - p.dailyLossPct / 100)) { done = "breach"; break; }
          if (target && eq >= target) { done = "pass"; break; }
          if (p.dayStopPct && eq <= sod * (1 - p.dayStopPct / 100) + 1e-9) break;
        }
      }
      byDay[d].push(eq);
    }
    if (done === "breach") breach++;
    else if (done === "pass" || (!target && eq > p.start)) pass++;
    finals.push(eq);
  }
  const q = (xs: number[], f: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(f * (s.length - 1))))];
  };
  return {
    pass: pass / runs,
    breach: breach / runs,
    median: q(finals, 0.5),
    bands: byDay.map((xs, d) => ({ day: d + 1, p10: q(xs, 0.1), p50: q(xs, 0.5), p90: q(xs, 0.9) })),
  };
}

/* =====================================================================
 * Local speech/text understanding (works without any AI provider)
 * ===================================================================== */

export type Parsed = {
  account_id?: string;
  direction?: "long" | "short";
  entry?: number;
  sl?: number;
  tp?: number;
  exit?: number;
  gross_pnl?: number;
  fees?: number;
  session?: string;
  sessions?: string[];
  poi_type?: string;
  entry_model?: string;
  bias?: "long" | "short" | "neutral";
  news_times?: string[];
  mistakes?: string[];
  emotions?: string[];
  magnet?: string;
  invalidation?: string;
  htf_range?: string;
  pois?: string;
  notes?: string;
};

const NUM = "(-?\\d{1,3}(?:[,\\s]\\d{3})+(?:\\.\\d+)?|-?\\d+(?:\\.\\d+)?)";
const num = (s: string) => Number(s.replace(/[,\s]/g, ""));

function grab(text: string, words: string[]): number | undefined {
  for (const w of words) {
    const m = new RegExp(`\\b${w}\\b(?:\\s+(?:at|of|is|=|:|to|price))*\\s*\\$?${NUM}`, "i").exec(text);
    if (m) return num(m[1]);
  }
  return undefined;
}

function grabPhrase(text: string, words: string[]): string | undefined {
  for (const w of words) {
    const m = new RegExp(`\\b${w}\\b\\s*(?:is|at|:|=)?\\s*([^.;\\n]+)`, "i").exec(text);
    if (m) return m[1].trim().replace(/\s+(?:and|then)$/i, "");
  }
  return undefined;
}

/** "18:00", "6 pm", "6:30pm", "at 1830" → "HH:MM" (24h). */
function toHHMM(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  let m = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/.exec(s) || /^(\d{1,2})\s*(am|pm)$/.exec(s) || /^(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  let mm = m[2] && /^\d{2}$/.test(m[2]) ? Number(m[2]) : 0;
  const ap = m[3] ?? (m[2] === "am" || m[2] === "pm" ? m[2] : undefined);
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || mm > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function parseDictation(text: string, accounts: Pick<Account, "id" | "instrument" | "name" | "firm">[] = []): Parsed {
  const t = ` ${text.replace(/\s+/g, " ")} `;
  const low = t.toLowerCase();
  const out: Parsed = {};

  const isGold = /\b(gold|xau|xauusd)\b/.test(low);
  const isBtc = /\b(btc|bitcoin|btcusdt)\b/.test(low);
  const acct = accounts.find((a) => {
    const name = `${a.name} ${a.firm ?? ""}`.toLowerCase();
    if (isGold && /XAU|GOLD/i.test(a.instrument)) return true;
    if (isBtc && /BTC/i.test(a.instrument)) return true;
    return name.split(/\s+/).some((w) => w.length > 4 && low.includes(` ${w} `));
  });
  if (acct) out.account_id = acct.id;

  if (/\b(long|buy|buying|bought|bullish)\b/.test(low) && !/\b(short|sell|selling|sold)\b/.test(low)) out.direction = "long";
  else if (/\b(short|sell|selling|sold)\b/.test(low) && !/\b(long|buy|buying|bought)\b/.test(low)) out.direction = "short";
  if (/\bbias\b/.test(low)) {
    const m = /\bbias\b[^.]*?\b(bullish|long|bearish|short|neutral)\b/.exec(low) || /\b(bullish|bearish|neutral)\b[^.]*?\bbias\b/.exec(low);
    if (m) out.bias = /bull|long/.test(m[1]) ? "long" : /bear|short/.test(m[1]) ? "short" : "neutral";
  }

  out.entry = grab(t, ["entry", "entered", "enter", "in at", "filled", "buy at", "bought at", "sell at", "sold at", "long at", "short at", "long from", "short from"]);
  out.sl = grab(t, ["stop loss", "stoploss", "stop", "sl", "invalidation at"]);
  out.tp = grab(t, ["take profit", "target", "tp", "targeting"]);
  out.exit = grab(t, ["exited", "exit", "closed at", "closed", "out at"]);
  out.gross_pnl = grab(t, ["pnl", "p&l", "profit", "made"]);
  const lost = grab(t, ["lost", "loss of"]);
  if (out.gross_pnl == null && lost != null) out.gross_pnl = -Math.abs(lost);
  out.fees = grab(t, ["fees", "fee", "commission"]);

  const sess: string[] = [];
  if (/\blondon\b/.test(low)) sess.push("London");
  if (/\b(new york|ny|nyc)\b/.test(low)) sess.push("New York");
  if (/\b(asia|asian|tokyo)\b/.test(low) && !/\basia (high|low|range)\b/.test(low)) sess.push("Asia");
  if (sess.length) {
    out.sessions = sess;
    out.session = sess[0];
  }

  if (/\bflip\b/.test(low)) out.poi_type = "Flip zone";
  else if (/\b(fvg|fair value gap|imbalance)\b/.test(low)) out.poi_type = "FVG";
  else if (/\border ?block|\bob\b/.test(low)) out.poi_type = "Order Block";
  else if (/\bdemand\b/.test(low)) out.poi_type = "Demand";
  else if (/\bsupply\b/.test(low)) out.poi_type = "Supply";
  if (/\bsweep\b.*\b(ob|order ?block)\b.*\b(fvg)\b/.test(low)) out.entry_model = "Sweep→OB→FVG";
  else if (/\bflip\b/.test(low)) out.entry_model = "Flip zone";
  else if (/\b(market shift|mss|shift|choch|bos)\b/.test(low)) out.entry_model = "Market Shift";

  const times = new Set<string>();
  const newsRe = /\b(?:news|cpi|nfp|fomc|ppi|gdp|pmi|jobs|powell|fed|claims|retail sales)\b[^.]*?\b(?:at|@)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?|\d{4})/gi;
  for (const m of t.matchAll(newsRe)) {
    const hm = toHHMM(m[1]);
    if (hm) times.add(hm);
  }
  if (times.size) out.news_times = [...times];

  const mistakes: string[] = [];
  const mistakeWords: [RegExp, string][] = [
    [/\b(early|too soon|jumped in)\b/, "Early entry"], [/\bchas(ed|ing)\b/, "Chased entry"], [/\bno sweep\b/, "No sweep"],
    [/\b(against|counter)[- ]?(the )?(bias|trend)\b/, "Counter-bias"], [/\bmoved (my )?(stop|sl)\b/, "Moved SL"],
    [/\b(oversized|too big|over ?risked)\b/, "Oversized"], [/\b(cut|closed) (the |my )?(winner|it) (early|too early)\b/, "Cut winner early"],
    [/\bovertrad/, "Overtrading"], [/\boff[- ]plan\b/, "Off-plan"], [/\brevenge\b/, "Revenge"],
  ];
  for (const [re, m] of mistakeWords) if (re.test(low) && MISTAKES.includes(m)) mistakes.push(m);
  if (mistakes.length) out.mistakes = mistakes;
  const emotions = EMOTIONS.filter((e) => new RegExp(`\\b${e.toLowerCase()}\\b`).test(low));
  if (/\b(fomo|fear of missing)\b/.test(low) && !emotions.includes("FOMO")) emotions.push("FOMO");
  if (emotions.length) out.emotions = [...new Set(emotions)];

  out.magnet = grabPhrase(t, ["magnet", "draw on liquidity", "targeting liquidity at"]);
  out.htf_range = grabPhrase(t, ["htf range", "range is", "swing range"]);
  out.invalidation = grabPhrase(t, ["invalidation", "invalid if", "invalidated if"]);
  out.pois = grabPhrase(t, ["pois", "poi", "zones", "zone at"]);

  for (const k of Object.keys(out) as (keyof Parsed)[]) if (out[k] === undefined) delete out[k];
  out.notes = text.trim();
  return out;
}

/* =====================================================================
 * Automatic pattern finding
 * ===================================================================== */

export type PatternRow = { label: string; n: number; avgR: number; winRate: number; totalR: number };
const summarize = (label: string, ts: Trade[]): PatternRow => {
  const rs = ts.map((t) => Number(t.r_multiple));
  const n = rs.length;
  return { label, n, totalR: rs.reduce((s, r) => s + r, 0), avgR: n ? rs.reduce((s, r) => s + r, 0) / n : 0, winRate: n ? ts.filter((t) => Number(t.net_pnl) > 0).length / n : 0 };
};

/** Behavioural sequences: what happens after a loss/win, 1st vs 2nd trade of the day, quick re-entries, overrides. */
export function sequencePatterns(trades: Trade[]): PatternRow[] {
  const c = closedSorted(trades);
  const afterLoss: Trade[] = [], afterWin: Trade[] = [], first: Trade[] = [], second: Trade[] = [], quick: Trade[] = [], afterTwoWins: Trade[] = [];
  const byAcct = new Map<string, Trade[]>();
  for (const t of c) byAcct.set(t.account_id, [...(byAcct.get(t.account_id) ?? []), t]);
  for (const list of byAcct.values()) {
    list.forEach((t, i) => {
      const prev = list[i - 1];
      const prev2 = list[i - 2];
      if (prev) {
        (Number(prev.r_multiple) < 0 ? afterLoss : afterWin).push(t);
        if (prev.closed_at && new Date(t.opened_at).getTime() - new Date(prev.closed_at).getTime() < 30 * 60000) quick.push(t);
        if (prev2 && Number(prev.r_multiple) > 0 && Number(prev2.r_multiple) > 0) afterTwoWins.push(t);
      }
      const day = todayIST(new Date(t.opened_at));
      const nth = list.filter((x) => todayIST(new Date(x.opened_at)) === day && new Date(x.opened_at) < new Date(t.opened_at)).length;
      (nth === 0 ? first : second).push(t);
    });
  }
  return [
    summarize("First trade of the day", first),
    summarize("2nd+ trade of the day", second),
    summarize("Right after a loss", afterLoss),
    summarize("Right after a win", afterWin),
    summarize("After two wins in a row", afterTwoWins),
    summarize("Within 30 min of the previous trade", quick),
    summarize("Guardrail overridden", c.filter((t) => t.override_reason)),
    summarize("Clean A+ (8/8, no override)", c.filter((t) => t.gate_score === 8 && !t.override_reason)),
  ].filter((r) => r.n > 0);
}

/** Best and worst combinations of conditions (min sample size), e.g. "London · Flip zone · FVG". */
export function edgeCombos(trades: Trade[], keys: Record<string, (t: Trade) => string>, minN = 3): { best: PatternRow[]; worst: PatternRow[] } {
  const c = closedSorted(trades);
  const names = Object.keys(keys);
  const groups = new Map<string, Trade[]>();
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++)
      for (const t of c) {
        const a = keys[names[i]](t), b = keys[names[j]](t);
        if (!a || !b || a === "—" || b === "—") continue;
        const k = `${a} · ${b}`;
        groups.set(k, [...(groups.get(k) ?? []), t]);
      }
  const rows = [...groups.entries()].map(([k, ts]) => summarize(k, ts)).filter((r) => r.n >= minN);
  const uniq = (xs: PatternRow[]) => xs.filter((r, i, arr) => arr.findIndex((x) => x.label === r.label) === i);
  return {
    best: uniq([...rows].sort((a, b) => b.avgR - a.avgR)).filter((r) => r.avgR > 0).slice(0, 6),
    worst: uniq([...rows].sort((a, b) => a.avgR - b.avgR)).filter((r) => r.avgR < 0).slice(0, 6),
  };
}

/** Outcome by feeling (any stage of the trade) and by pre-trade mental ratings. */
export function emotionStats(trades: Trade[]) {
  const c = closedSorted(trades);
  const feel = new Map<string, Trade[]>();
  const stage = new Map<string, Trade[]>();
  for (const t of c) {
    const all = new Set<string>([...(t.emotions ?? []), ...(t.emotion_log ?? []).flatMap((e) => e.emotions)]);
    for (const f of all) feel.set(f, [...(feel.get(f) ?? []), t]);
    for (const e of t.emotion_log ?? []) for (const f of e.emotions) {
      const k = `${e.stage}|${f}`;
      if (!(stage.get(k) ?? []).includes(t)) stage.set(k, [...(stage.get(k) ?? []), t]);
    }
  }
  const mental = (["focus", "confidence", "patience", "energy", "stress"] as const).map((k) => {
    const rated = c.filter((t) => t.mental?.[k] != null);
    return {
      key: k,
      low: summarize("1–2", rated.filter((t) => t.mental![k]! <= 2)),
      mid: summarize("3", rated.filter((t) => t.mental![k] === 3)),
      high: summarize("4–5", rated.filter((t) => t.mental![k]! >= 4)),
    };
  });
  const tracked = c.filter((t) => (t.emotion_log ?? []).length || (t.emotions ?? []).length || Object.keys(t.mental ?? {}).length).length;
  return {
    byFeeling: [...feel.entries()].map(([k, ts]) => summarize(k, ts)).sort((a, b) => a.avgR - b.avgR),
    byStage: [...stage.entries()].map(([k, ts]) => ({ stage: k.split("|")[0], ...summarize(k.split("|")[1], ts) })),
    mental,
    tracked,
    total: c.length,
  };
}

/* =====================================================================
 * Overall score (radar): six process/outcome axes normalised 0–1
 * ===================================================================== */

export type ScoreAxis = { key: string; label: string; value: number; raw: string };

export function scoreAxes(trades: Trade[], disciplinePct: number | null): ScoreAxis[] {
  const c = closedSorted(trades);
  const n = c.length;
  const rs = c.map((t) => Number(t.r_multiple));
  const wins = rs.filter((r) => r > 0), losses = rs.filter((r) => r < 0);
  const winRate = n ? wins.length / n : 0;
  const gw = wins.reduce((s, r) => s + r, 0), gl = Math.abs(losses.reduce((s, r) => s + r, 0));
  const pf = gl ? gw / gl : gw ? 3 : 0;
  const avgW = wins.length ? gw / wins.length : 0, avgL = losses.length ? gl / losses.length : 1;
  const days = new Map<string, number>();
  for (const t of c) days.set(todayIST(new Date(t.closed_at ?? t.opened_at)), (days.get(todayIST(new Date(t.closed_at ?? t.opened_at))) ?? 0) + Number(t.r_multiple));
  const green = days.size ? [...days.values()].filter((v) => v > 0).length / days.size : 0;
  let cum = 0, peak = 0, dd = 0;
  for (const r of rs) { cum += r; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  return [
    { key: "win", label: "Win %", value: clamp(winRate / 0.5), raw: `${Math.round(winRate * 100)}%` },
    { key: "pf", label: "Profit factor", value: clamp(pf / 2.5), raw: pf.toFixed(2) },
    { key: "rr", label: "Win/loss", value: clamp(avgW / avgL / 4), raw: `${(avgW / avgL).toFixed(1)}×` },
    { key: "dd", label: "Drawdown", value: n ? clamp(1 - dd / 10) : 0, raw: `${dd.toFixed(1)}R` },
    { key: "disc", label: "Discipline", value: clamp((disciplinePct ?? 0) / 100), raw: disciplinePct == null ? "—" : String(disciplinePct) },
    { key: "cons", label: "Consistency", value: clamp(green / 0.6), raw: `${Math.round(green * 100)}% green` },
  ];
}
