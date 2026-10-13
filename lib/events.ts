import { wall } from "./tz.ts";

/** Pure helpers for economic-event risk windows (shared by the calendar widget, guardrails and the coach). */
export type EventLike = { title: string; at: string; impact: "High" | "Medium" | "Low" | "Holiday"; country: string };
export type RiskWindow = { kind: "no-trade" | "caution"; from: number; to: number; event: EventLike };

/** High impact: no entries ±15 min, caution until +60 min (playbook: wait 30–60 min). Medium: caution ±15 min. */
export function riskWindows(events: EventLike[]): RiskWindow[] {
  const out: RiskWindow[] = [];
  for (const e of events) {
    const t = new Date(e.at).getTime();
    if (!Number.isFinite(t)) continue;
    if (e.impact === "High") {
      out.push({ kind: "no-trade", from: t - 15 * 60000, to: t + 15 * 60000, event: e });
      out.push({ kind: "caution", from: t + 15 * 60000, to: t + 60 * 60000, event: e });
    } else if (e.impact === "Medium") {
      out.push({ kind: "caution", from: t - 15 * 60000, to: t + 15 * 60000, event: e });
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

export function activeWindow(windows: RiskWindow[], now = new Date()): RiskWindow | null {
  const t = now.getTime();
  return windows.find((w) => w.kind === "no-trade" && t >= w.from && t <= w.to) ?? windows.find((w) => t >= w.from && t <= w.to) ?? null;
}

/** Local "HH:MM" of high-impact events on a local date (trader's timezone) — for the day plan's news times. */
export function newsTimesFor(events: EventLike[], istDate: string): string[] {
  const times = new Set<string>();
  for (const e of events) {
    if (e.impact !== "High") continue;
    const ist = wall(new Date(e.at));
    if (ist.toISOString().slice(0, 10) !== istDate) continue;
    times.add(ist.toISOString().slice(11, 16));
  }
  return [...times].sort();
}
