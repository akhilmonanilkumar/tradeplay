import { msToWindow, todayIST, weekStartIST, windowLabel } from "./calc.ts";
import type { Account, DayPlan, Reminder, Review, Trade } from "./types.ts";

export type Nudge = { id: string; text: string; href: string; level: "due" | "warn" | "info"; reminderId?: string };

type Input = { accounts: Account[]; plans: DayPlan[]; trades: Trade[]; reminders: Reminder[]; reviews: Review[] };

/** Everything the trader should be reminded of right now, most urgent first. */
export function nudges(now: Date, d: Input): Nudge[] {
  const out: Nudge[] = [];
  const today = todayIST(now);

  for (const r of d.reminders) {
    if (!r.done && new Date(r.due_at).getTime() <= now.getTime())
      out.push({ id: `r:${r.id}`, reminderId: r.id, text: r.text, href: r.account_id ? `/?account=${r.account_id}` : "/", level: "due" });
  }

  for (const a of d.accounts.filter((x) => x.status === "active")) {
    const plan = d.plans.find((p) => p.account_id === a.id && p.plan_date === today) ?? null;
    if (!plan) out.push({ id: `plan:${a.id}:${today}`, text: `Write today's plan for ${a.name}`, href: `/plan?account=${a.id}`, level: "warn" });

    for (const hm of plan?.news_times ?? []) {
      const t = new Date(`${today}T${hm.slice(0, 5)}:00+05:30`).getTime();
      const mins = Math.round((t - now.getTime()) / 60000);
      if (mins > 0 && mins <= 30)
        out.push({ id: `news:${a.id}:${hm}`, text: `News at ${hm} IST in ${mins}m — ${a.instrument} entries blocked ±15 min`, href: "/", level: "warn" });
    }

    const wait = msToWindow(a, now, plan);
    if (wait > 0 && wait <= 20 * 60000)
      out.push({ id: `win:${a.id}:${today}:${windowLabel(a, plan)}`, text: `${windowLabel(a, plan)} window opens in ${Math.ceil(wait / 60000)}m — ${a.name}`, href: "/new", level: "info" });

    for (const t of d.trades.filter((x) => x.account_id === a.id && x.status === "open")) {
      const hrs = (now.getTime() - new Date(t.opened_at).getTime()) / 3600000;
      if (hrs >= 6) out.push({ id: `open:${t.id}`, text: `${t.instrument} ${t.direction} open for ${Math.floor(hrs)}h — check the management plan`, href: `/trades?open=${t.id}`, level: "info" });
    }
  }

  const unreviewed = d.trades.filter(
    (t) => t.status === "closed" && !t.review && !(t.mistakes ?? []).length && now.getTime() - new Date(t.closed_at ?? t.opened_at).getTime() < 7 * 86400000,
  ).length;
  if (unreviewed) out.push({ id: `unrev:${unreviewed}`, text: `${unreviewed} closed trade${unreviewed > 1 ? "s" : ""} waiting for a review note`, href: "/trades?status=closed", level: "info" });

  const istDay = new Date(now.getTime() + 5.5 * 3600000).getUTCDay(); // 0 Sun
  const week = weekStartIST(now);
  if ((istDay === 6 || istDay === 0) && !d.reviews.some((r) => r.week_start === week))
    out.push({ id: `review:${week}`, text: "Weekly review is due", href: "/review", level: "warn" });

  const rank = { due: 0, warn: 1, info: 2 } as const;
  return out.sort((x, y) => rank[x.level] - rank[y.level]);
}
