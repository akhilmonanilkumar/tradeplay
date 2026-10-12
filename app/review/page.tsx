"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Card, Field, PageHead, Stat } from "@/components/ui";
import { fmtPct, fmtR, fmtUsd, groupStats, inWeekIST, stats, weekStartIST } from "@/lib/calc";
import { supabase } from "@/lib/supabase";

function shiftWeek(ws: string, n: number) {
  const d = new Date(`${ws}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

export default function Review() {
  const { trades, reviews, setups, refresh } = useData();
  const [week, setWeek] = useState(weekStartIST());
  const existing = reviews.find((r) => r.week_start === week);
  const [form, setForm] = useState({ went_well: "", to_fix: "", rule_change: "", rating: 3 });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      went_well: existing?.went_well ?? "",
      to_fix: existing?.to_fix ?? "",
      rule_change: existing?.rule_change ?? "",
      rating: existing?.rating ?? 3,
    });
    setState("idle");
  }, [existing, week]);

  const wk = useMemo(() => trades.filter((t) => t.status !== "cancelled" && inWeekIST(t.opened_at, week)), [trades, week]);
  const s = useMemo(() => stats(wk), [wk]);
  const closed = wk.filter((t) => t.status === "closed" && t.r_multiple != null);
  const best = [...closed].sort((a, b) => Number(b.r_multiple) - Number(a.r_multiple))[0];
  const worst = [...closed].sort((a, b) => Number(a.r_multiple) - Number(b.r_multiple))[0];
  const offPlan = wk.filter((t) => t.gate_score < 8 || t.override_reason);
  const mistakeCounts = useMemo(() => {
    const m = new Map<string, number>();
    wk.forEach((t) => t.mistakes.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [wk]);
  const bySetup = groupStats(closed, (t) => setups.find((x) => x.id === t.setup_id)?.name ?? t.entry_model ?? "—");

  const focus = (() => {
    if (!wk.length) return "No trades this week — was that discipline (no A+ setups) or missed sessions? Note which.";
    if (offPlan.length) return `Cut off-plan trades to zero: ${offPlan.length} of ${wk.length} broke the gate or a guardrail.`;
    if (mistakeCounts[0]) return `Fix "${mistakeCounts[0][0]}" — it showed up ${mistakeCounts[0][1]}× this week.`;
    if (s.n && s.avgWinR < 2.5 && s.wins) return `Let winners reach target: average winner was ${fmtR(s.avgWinR)}.`;
    return "Clean week. Repeat the process exactly — no rule changes needed.";
  })();

  async function save() {
    setState("saving");
    setErr(null);
    const { error } = await supabase.from("reviews").upsert(
      { week_start: week, went_well: form.went_well || null, to_fix: form.to_fix || null, rule_change: form.rule_change || null, rating: form.rating },
      { onConflict: "user_id,week_start" },
    );
    if (error) {
      setErr(error.message);
      return setState("idle");
    }
    await refresh();
    setState("saved");
  }

  const end = shiftWeek(week, 1);
  return (
    <>
      <PageHead
        title="Weekly review"
        sub="Record daily, review weekly, reflect monthly, refine quarterly."
        action={
          <div className="flex items-center gap-2 text-sm">
            <button className="btn-ghost" onClick={() => setWeek(shiftWeek(week, -1))}>‹</button>
            <span className="num min-w-36 text-center">{week} → {shiftWeek(end, 0).slice(5)}</span>
            <button className="btn-ghost" onClick={() => setWeek(shiftWeek(week, 1))} disabled={week >= weekStartIST()}>›</button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card title="Recap">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Net" value={fmtUsd(s.net, true)} tone={s.net >= 0 ? "up" : "down"} sub={`${wk.length} trades`} />
              <Stat label="Total R" value={fmtR(s.totalR)} tone={s.totalR >= 0 ? "up" : "down"} />
              <Stat label="Win rate" value={s.n ? fmtPct(s.winRate) : "—"} />
              <Stat label="Off-plan" value={`${offPlan.length}`} tone={offPlan.length ? "down" : "up"} />
            </div>
            <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
              <div className="label mb-1 text-accent">One focus for next week</div>
              {focus}
            </div>
          </Card>

          <Card title="What happened">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="label mb-2">By setup</div>
                {bySetup.length ? (
                  <ul className="space-y-1 text-sm">
                    {bySetup.map((g) => (
                      <li key={g.key} className="flex justify-between">
                        <span className="truncate">{g.key}</span>
                        <span className={`num ${g.s.totalR >= 0 ? "text-up" : "text-down"}`}>{fmtR(g.s.totalR)} · n{g.s.n}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-mute">—</p>}
              </div>
              <div>
                <div className="label mb-2">Mistakes</div>
                {mistakeCounts.length ? (
                  <div className="flex flex-wrap gap-1.5">{mistakeCounts.map(([k, n]) => <Badge key={k} tone="down">{k} ×{n}</Badge>)}</div>
                ) : <p className="text-sm text-mute">None tagged</p>}
              </div>
              <div>
                <div className="label mb-1">Best trade</div>
                <p className="text-sm">{best ? `${best.instrument} ${best.direction} · ${fmtR(best.r_multiple)}` : "—"}</p>
              </div>
              <div>
                <div className="label mb-1">Worst trade</div>
                <p className="text-sm">{worst ? `${worst.instrument} ${worst.direction} · ${fmtR(worst.r_multiple)}` : "—"}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Reflection" className="lg:col-span-2">
          <div className="space-y-3">
            <Field label="What went well"><textarea className="input min-h-20" maxLength={4000} value={form.went_well} onChange={(e) => setForm({ ...form, went_well: e.target.value })} /></Field>
            <Field label="What to fix"><textarea className="input min-h-20" maxLength={4000} value={form.to_fix} onChange={(e) => setForm({ ...form, to_fix: e.target.value })} /></Field>
            <Field label="Rule change (if any — max one)"><textarea className="input min-h-16" maxLength={4000} value={form.rule_change} onChange={(e) => setForm({ ...form, rule_change: e.target.value })} /></Field>
            <Field label="Process rating">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} className={`h-9 w-9 rounded-lg border text-sm ${form.rating === n ? "border-ink bg-ink text-bg" : "border-line text-mute"}`}>{n}</button>
                ))}
              </div>
            </Field>
            {err && <p className="text-sm text-down">{err}</p>}
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-mute">{state === "saved" ? "Saved" : ""}</span>
              <button className="btn-primary" onClick={save} disabled={state === "saving"}>Save review</button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
