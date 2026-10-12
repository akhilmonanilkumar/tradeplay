import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountState, disciplineScore, fmtIST, fmtUsd, sessionAt, stats, todayIST, windowLabel } from "@/lib/calc";
import { diagnoseTrade, matchLessons, recurringCauses } from "@/lib/analysis";
import { nudges } from "@/lib/nudges";
import type { Account, Adjustment, DayPlan, Lesson, Memory, Payout, Reminder, Review, Trade } from "@/lib/types";

export type Snapshot = {
  accounts: Account[];
  trades: Trade[];
  payouts: Payout[];
  adjustments: Adjustment[];
  plans: DayPlan[];
  lessons: Lesson[];
  memory: Memory[];
  reminders: Reminder[];
  reviews: Review[];
};

const opt = async <T,>(q: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => {
  const { data } = await q;
  return data ?? [];
};

/** Everything the coach may look at, read with the user's own JWT (RLS applies). */
export async function loadSnapshot(sb: SupabaseClient): Promise<Snapshot> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const [accounts, trades, payouts, adjustments, plans, lessons, memory, reminders, reviews] = await Promise.all([
    opt<Account>(sb.from("accounts").select("*").order("created_at")),
    opt<Trade>(sb.from("trades").select("*").order("opened_at", { ascending: false }).limit(1000)),
    opt<Payout>(sb.from("payouts").select("*")),
    opt<Adjustment>(sb.from("balance_adjustments").select("*")),
    opt<DayPlan>(sb.from("day_plans").select("*").gte("plan_date", since).order("plan_date", { ascending: false })),
    opt<Lesson>(sb.from("lessons").select("*").eq("active", true).order("created_at", { ascending: false }).limit(60)),
    opt<Memory>(sb.from("ai_memory").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(60)),
    opt<Reminder>(sb.from("reminders").select("*").eq("done", false).order("due_at").limit(30)),
    opt<Review>(sb.from("reviews").select("*").order("week_start", { ascending: false }).limit(4)),
  ]);
  return { accounts, trades, payouts, adjustments, plans, lessons, memory, reminders, reviews };
}

const line = (t: Trade, accounts: Account[]) => {
  const a = accounts.find((x) => x.id === t.account_id);
  const r = t.r_multiple == null ? t.status : `${Number(t.r_multiple) > 0 ? "+" : ""}${t.r_multiple}R`;
  const tags = [...(t.mistakes ?? []), ...(t.emotions ?? [])].join("/");
  return `- ${fmtIST(t.opened_at)} ${a?.name ?? ""} ${t.instrument} ${t.direction} e${t.entry} sl${t.sl} tp${t.tp} gate ${t.gate_score}/8 ${t.session ?? ""} ${t.poi_type ?? ""} ${t.entry_model ?? ""} → ${r}${tags ? ` [${tags}]` : ""}${t.override_reason ? ` OVERRIDE: ${t.override_reason}` : ""}${t.review ? ` — "${t.review.slice(0, 140)}"` : ""} (id ${t.id})`;
};

/** Compact, human-readable context block for the system prompt. */
export function describe(s: Snapshot, now = new Date(), focusAccountId?: string | null): string {
  const today = todayIST(now);
  const out: string[] = [];
  const sess = sessionAt(now);
  out.push(`NOW: ${fmtIST(now)} IST (${today}). Current Q-zone: ${sess.inWindow ? sess.name : "off-session"}.`);

  out.push("\nACCOUNTS:");
  for (const a of s.accounts.filter((x) => x.status === "active" || x.id === focusAccountId)) {
    const plan = s.plans.find((p) => p.account_id === a.id && p.plan_date === today) ?? null;
    const st = accountState(a, s.trades, s.payouts, now, { plan, adjustments: s.adjustments });
    out.push(
      `- ${a.name} [${a.id}] ${a.instrument} ${a.kind}/${a.status}: equity ${fmtUsd(st.equity)}, today ${fmtUsd(st.todayNet, true)} (${st.todayTrades}/${st.maxTrades} trades, ${st.todayLosses} losses), next risk ${fmtUsd(st.riskUsd)} (${st.riskPct}%), floor ${fmtUsd(st.floor)} (buffer ${fmtUsd(st.floorBuffer)}), daily floor ${fmtUsd(st.dailyFloor)}, min R:R 1:${a.min_rr}, window ${windowLabel(a, plan)}, daily reset ${a.day_reset_utc.slice(0, 5)} UTC.` +
        (st.targetUsd ? ` Target ${fmtUsd(st.targetUsd)} (${Math.round((st.targetProgress ?? 0) * 100)}%), profitable days ${st.profitableDays}/${a.min_profitable_days}.` : "") +
        ` ${st.canTrade ? "CLEAR TO TRADE." : `LOCKED: ${st.reasons.join("; ")}.`}`,
    );
    if (plan)
      out.push(
        `  Today's plan: bias ${plan.bias ?? "—"}; HTF ${plan.htf_range ?? "—"}; magnet ${plan.magnet ?? "—"}; invalidation ${plan.invalidation ?? "—"}; POIs ${plan.pois ?? "—"}; news ${(plan.news_times ?? []).join(", ") || "none"} IST; sessions ${windowLabel(a, plan)}; checklist ${Object.values(plan.checklist ?? {}).filter(Boolean).length}/6${plan.notes ? `; notes: ${plan.notes.slice(0, 300)}` : ""}.`,
      );
    else out.push("  No plan written for today yet.");
  }

  const open = s.trades.filter((t) => t.status === "open");
  if (open.length) out.push("\nOPEN TRADES:", ...open.map((t) => line(t, s.accounts)));

  const recent = s.trades.filter((t) => t.status === "closed").slice(0, 15);
  if (recent.length) out.push("\nLAST CLOSED TRADES (newest first):", ...recent.map((t) => line(t, s.accounts)));

  const last30 = s.trades.filter((t) => now.getTime() - new Date(t.opened_at).getTime() < 30 * 86400000);
  const st = stats(last30);
  const all = stats(s.trades);
  const disc = disciplineScore(s.trades);
  out.push(
    `\nSTATS: last 30d ${st.n} trades, win ${Math.round(st.winRate * 100)}%, ${st.totalR.toFixed(1)}R, expectancy ${st.avgR.toFixed(2)}R, A+ rate ${Math.round(st.aPlusRate * 100)}%. All-time ${all.n} trades, ${all.totalR.toFixed(1)}R, max DD ${all.maxDdR.toFixed(1)}R. Discipline ${disc.score ?? "n/a"} (${disc.status}).`,
  );

  const rec = recurringCauses(s.trades, { accounts: s.accounts, plans: s.plans }, 60).slice(0, 5);
  if (rec.length) out.push("RECURRING PROBLEMS (last 60 trades, cost in R):", ...rec.map((c) => `- ${c.label}: ${c.n}× (${c.r.toFixed(1)}R)`));

  const lessons = matchLessons(s.lessons, { account_id: focusAccountId ?? null }, 10);
  if (lessons.length) out.push("\nLESSONS — DON'T REPEAT:", ...lessons.map((l) => `- ${l.title}${l.rule ? ` → rule: ${l.rule}` : ""}`));

  if (s.memory.length) out.push("\nMEMORY ABOUT THE TRADER:", ...s.memory.slice(0, 40).map((m) => `- (${m.kind}) ${m.content}`));

  const nd = nudges(now, { accounts: s.accounts, plans: s.plans, trades: s.trades, reminders: s.reminders, reviews: s.reviews });
  if (nd.length) out.push("\nPENDING REMINDERS/NUDGES:", ...nd.slice(0, 10).map((n) => `- ${n.text}`));
  const upcoming = s.reminders.filter((r) => new Date(r.due_at) > now).slice(0, 8);
  if (upcoming.length) out.push("SCHEDULED REMINDERS:", ...upcoming.map((r) => `- ${fmtIST(r.due_at)} IST: ${r.text}`));

  return out.join("\n");
}

/** Local post-mortem passed to the model so its analysis starts from facts. */
export function tradeFacts(s: Snapshot, t: Trade): string {
  const account = s.accounts.find((a) => a.id === t.account_id) ?? null;
  const plan = s.plans.find((p) => p.account_id === t.account_id && p.plan_date === todayIST(new Date(t.opened_at))) ?? null;
  const d = diagnoseTrade(t, { account, plan, trades: s.trades });
  return [
    `TRADE: ${line(t, s.accounts)}`,
    `Planned R:R ${t.rr_planned}, risk ${fmtUsd(t.risk_usd)} (plan allowed ${fmtUsd(t.planned_risk_usd)}), exit ${t.exit ?? "—"}, net ${fmtUsd(t.net_pnl, true)}, opened ${fmtIST(t.opened_at)}, closed ${t.closed_at ? fmtIST(t.closed_at) : "—"}.`,
    `Invalidation: ${t.invalidation ?? "—"}. Breaches at entry: ${(t.guardrail_breaches ?? []).join("; ") || "none"}.`,
    plan ? `Plan that day: bias ${plan.bias ?? "—"}, magnet ${plan.magnet ?? "—"}, invalidation ${plan.invalidation ?? "—"}, POIs ${plan.pois ?? "—"}.` : "No plan written that day.",
    `RULE-ENGINE DIAGNOSIS: ${d.verdict}`,
    ...d.causes.map((c) => `- [${c.severity}] ${c.text}`),
  ].join("\n");
}
