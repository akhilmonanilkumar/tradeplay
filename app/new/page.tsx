"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/Shell";
import { Badge, Card, Check, Field, PageHead, Segmented, numOrNull } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  accountState, feeShare, fmtUsd, levelsValid, newsBlock, positionSize, roundSize, rr, sessionAt, todayIST,
} from "@/lib/calc";
import { ENTRY_MODELS, GATE_CHECKS, POI_TYPES, SESSIONS, type GateKey } from "@/lib/types";

const blankGate = Object.fromEntries(GATE_CHECKS.map((g) => [g.key, false])) as Record<GateKey, boolean>;

function localInput(d: Date) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function NewTrade() {
  const router = useRouter();
  const { accounts, setups, trades, payouts, plans, refresh } = useData();
  const active = accounts.filter((a) => a.status === "active");
  const [accountId, setAccountId] = useState(active[0]?.id ?? "");
  const acct = accounts.find((a) => a.id === accountId);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [setupId, setSetupId] = useState("");
  const [model, setModel] = useState("");
  const [poi, setPoi] = useState("");
  const [session, setSession] = useState(() => sessionAt().name);
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [riskInput, setRiskInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [chart, setChart] = useState("");
  const [openedAt, setOpenedAt] = useState(() => localInput(new Date()));
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [gate, setGate] = useState<Record<GateKey, boolean>>(blankGate);
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const now = new Date();
  const state = acct ? accountState(acct, trades, payouts, now) : null;
  const plan = plans.find((p) => p.account_id === accountId && p.plan_date === todayIST(now));
  const news = newsBlock(plan, now);
  const backfill = Math.abs(new Date(openedAt).getTime() - now.getTime()) > 30 * 60000;

  useEffect(() => {
    const s = sessionAt();
    setSession(s.name);
    setGate((g) => ({ ...g, in_session: !!acct && (acct.session_window === "Any" || (s.inWindow && s.name === acct.session_window)) }));
  }, [accountId, acct]);

  const setup = setups.find((s) => s.id === setupId);
  useEffect(() => {
    if (setup?.model && ENTRY_MODELS.includes(setup.model)) setModel(setup.model);
  }, [setup]);

  const e = numOrNull(entry), s = numOrNull(sl), t = numOrNull(tp);
  const valid = e != null && s != null && t != null && levelsValid(direction, e, s, t);
  const ratio = valid ? rr(e!, s!, t!) : 0;
  const planned = state?.riskUsd ?? 0;
  const risk = numOrNull(riskInput) ?? planned;
  const calcSize = valid && acct ? roundSize(acct.instrument, positionSize(acct, e!, s!, risk)) : 0;
  const size = numOrNull(sizeInput) ?? calcSize;
  const fees = valid && acct ? feeShare(acct, e!, s!) : 0;
  const minRr = acct?.min_rr ?? 3;
  const rrOk = ratio >= minRr;
  const gateScore = Object.values(gate).filter(Boolean).length + (ratio >= 3 ? 1 : 0);
  const gateOk = Object.values(gate).every(Boolean) && rrOk;

  const breaches = useMemo(() => {
    const out: string[] = [];
    if (!backfill && state && !state.canTrade) out.push(...state.reasons);
    if (!backfill && news) out.push(`News block (${news} IST)`);
    if (plan?.bias && plan.bias !== "neutral" && plan.bias !== direction) out.push(`Against today's ${plan.bias} bias`);
    if (plan?.bias === "neutral") out.push("Plan says stand aside today");
    if (risk > planned * 1.05 && planned > 0) out.push(`Risk ${fmtUsd(risk)} above plan ${fmtUsd(planned)}`);
    if (!gateOk) out.push(`A+ gate ${gateScore}/8${!rrOk && valid ? ` (R:R ${ratio} < ${minRr})` : ""}`);
    return out;
  }, [backfill, state, news, plan, direction, risk, planned, gateOk, gateScore, rrOk, valid, ratio, minRr]);

  const canSave = valid && risk > 0 && (breaches.length === 0 || (override && reason.trim().length >= 10));

  async function submit() {
    if (!acct || !valid) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("trades").insert({
      account_id: acct.id,
      setup_id: setupId || null,
      status,
      opened_at: new Date(openedAt).toISOString(),
      closed_at: null,
      instrument: acct.instrument,
      direction,
      session,
      entry: e,
      sl: s,
      tp: t,
      size: size || null,
      risk_usd: Math.round(risk * 100) / 100,
      planned_risk_usd: planned || null,
      poi_type: poi || null,
      entry_model: model || null,
      invalidation: invalidation.trim() || null,
      chart_url: chart.trim() || null,
      override_reason: breaches.length ? reason.trim() : null,
      guardrail_breaches: breaches,
      mistakes: breaches.length ? ["Off-plan"] : [],
      ...gate,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    await refresh();
    router.push(status === "closed" ? "/trades" : "/");
  }

  if (!acct || !state) return <p className="text-sm text-mute">Add an active account first.</p>;

  return (
    <>
      <PageHead
        title="New trade"
        sub={backfill ? "Back-filling a past trade — live guardrails are not enforced, the A+ gate still is." : "Every box ticked, R:R ≥ 1:3, inside your window — or no trade."}
        action={<Segmented value={accountId} onChange={(v) => { setAccountId(v); setRiskInput(""); setSizeInput(""); }} options={active.map((a) => ({ value: a.id, label: `${a.instrument}` }))} />}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card title="Setup">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Direction">
                <Segmented value={direction} onChange={setDirection} options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} />
                {plan?.bias && plan.bias !== "neutral" && (
                  <span className={`ml-2 text-xs ${plan.bias === direction ? "text-up" : "text-down"}`}>Plan: {plan.bias}</span>
                )}
              </Field>
              <Field label="Session">
                <select className="input" value={session} onChange={(ev) => setSession(ev.target.value)}>
                  {SESSIONS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Setup">
                <select className="input" value={setupId} onChange={(ev) => setSetupId(ev.target.value)}>
                  <option value="">—</option>
                  {setups.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </Field>
              <Field label="Entry model">
                <select className="input" value={model} onChange={(ev) => setModel(ev.target.value)}>
                  <option value="">—</option>
                  {ENTRY_MODELS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="POI type">
                <select className="input" value={poi} onChange={(ev) => setPoi(ev.target.value)}>
                  <option value="">—</option>
                  {POI_TYPES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Opened at">
                <input type="datetime-local" className="input" value={openedAt} onChange={(ev) => setOpenedAt(ev.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="Levels & size">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Entry"><input className="input num" inputMode="decimal" value={entry} onChange={(ev) => setEntry(ev.target.value)} /></Field>
              <Field label="Stop loss"><input className="input num" inputMode="decimal" value={sl} onChange={(ev) => setSl(ev.target.value)} /></Field>
              <Field label="Take profit"><input className="input num" inputMode="decimal" value={tp} onChange={(ev) => setTp(ev.target.value)} /></Field>
            </div>
            {entry && sl && tp && !valid && (
              <p className="mt-2 text-xs text-down">For a {direction}, SL must be {direction === "long" ? "below" : "above"} entry and TP {direction === "long" ? "above" : "below"}.</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Risk $" hint={`Plan: ${fmtUsd(planned)} (${state.riskPct}%)`}>
                <input className="input num" inputMode="decimal" placeholder={planned.toFixed(2)} value={riskInput} onChange={(ev) => setRiskInput(ev.target.value)} />
              </Field>
              <Field label={/XAU/i.test(acct.instrument) ? "Lots" : "Quantity"} hint={valid ? `Calculated ${calcSize}` : "Enter levels"}>
                <input className="input num" inputMode="decimal" placeholder={calcSize ? String(calcSize) : ""} value={sizeInput} onChange={(ev) => setSizeInput(ev.target.value)} />
              </Field>
              <div className="rounded-lg border border-line p-3">
                <div className="label">R:R</div>
                <div className={`num mt-1 text-2xl font-semibold ${!valid ? "text-mute" : rrOk ? "text-up" : "text-down"}`}>{valid ? `1:${ratio}` : "—"}</div>
                <div className="text-[11px] text-mute">min 1:{minRr}{valid ? ` · reward ${fmtUsd(risk * ratio)}` : ""}</div>
              </div>
            </div>
            {valid && fees > 0.17 && (
              <p className="mt-2 text-xs text-warn">Fees are {(fees * 100).toFixed(0)}% of this stop-out. Widen to ≥0.4% of price or skip.</p>
            )}
          </Card>

          <Card title={`A+ gate · ${gateScore}/8`} action={gateOk ? <Badge tone="up">✓ A+</Badge> : <Badge tone="warn">Not A+</Badge>}>
            <div className="grid gap-2 sm:grid-cols-2">
              {GATE_CHECKS.map((g) => (
                <Check key={g.key} label={g.label} hint={g.hint} checked={gate[g.key]} onChange={(v) => setGate((x) => ({ ...x, [g.key]: v }))} />
              ))}
              <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${rrOk ? "border-up/40 bg-up/5" : "border-line"}`}>
                <span className={`grid h-4 w-4 place-items-center rounded border ${rrOk ? "border-up bg-up text-bg" : "border-mute/50"}`}>{rrOk && "✓"}</span>
                <span className="text-sm">R:R ≥ 1:{minRr} <span className="block text-xs text-mute">Automatic from levels</span></span>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Invalidation"><input className="input" maxLength={500} value={invalidation} onChange={(ev) => setInvalidation(ev.target.value)} placeholder={plan?.invalidation ?? "Wrong if price holds beyond…"} /></Field>
              <Field label="Chart link"><input className="input" type="url" maxLength={500} value={chart} onChange={(ev) => setChart(ev.target.value)} placeholder="https://www.tradingview.com/x/…" /></Field>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card title="Guardrails" action={breaches.length ? <Badge tone="down">{breaches.length} issue{breaches.length > 1 ? "s" : ""}</Badge> : <Badge tone="up">All clear</Badge>}>
            <div className="num grid grid-cols-2 gap-3 text-sm">
              <div><div className="label">Equity</div>{fmtUsd(state.equity)}</div>
              <div><div className="label">Slots left</div>{state.tradesLeft}/{state.maxTrades}</div>
              <div><div className="label">Today</div><span className={state.todayNet < 0 ? "text-down" : state.todayNet > 0 ? "text-up" : ""}>{fmtUsd(state.todayNet, true)}</span></div>
              <div><div className="label">DD buffer</div>{fmtUsd(state.floorBuffer)}</div>
            </div>
            {breaches.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs">
                {breaches.map((b) => <li key={b} className="rounded-md border border-down/30 bg-down/5 px-2.5 py-1.5 text-down">{b}</li>)}
              </ul>
            )}
            {breaches.length > 0 && (
              <div className="mt-3 rounded-lg border border-line p-3">
                <Check label="Override and log as off-plan" hint="Counts against your Discipline score" checked={override} onChange={setOverride} />
                {override && (
                  <textarea className="input mt-2 min-h-16" maxLength={1000} placeholder="Why are you breaking your rules? (min 10 characters)" value={reason} onChange={(ev) => setReason(ev.target.value)} />
                )}
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Segmented value={status} onChange={setStatus} size="xs" options={[{ value: "open", label: "Live / open" }, { value: "closed", label: "Already closed" }]} />
              <button className={breaches.length && override ? "btn bg-down text-white" : "btn-primary"} disabled={!canSave || busy} onClick={submit}>
                {busy ? "Saving…" : breaches.length ? "Log off-plan trade" : "Log A+ trade"}
              </button>
            </div>
            {status === "closed" && <p className="mt-2 text-xs text-mute">You'll add the result from Trades after saving.</p>}
            {err && <p className="mt-2 text-sm text-down">{err}</p>}
          </Card>

          <Card title="Playbook">
            <ol className="space-y-2 text-xs leading-relaxed text-mute">
              <li><b className="text-ink">Bias</b> — HTF swing range; long only in discount, short only in premium. Mid-range = no trade.</li>
              <li><b className="text-ink">Location</b> — price inside a trend-aligned 15M POI that swept or sits next to liquidity.</li>
              <li><b className="text-ink">Trigger</b> — sweep, then 5M body close through last LH/HL. No pullback → let it go.</li>
              <li><b className="text-ink">Models</b> — Market Shift → pullback · Flip zone (prefer extreme) · Sweep → OB → FVG.</li>
              <li><b className="text-ink">Stop</b> — beyond the LTF zone or sweep wick + spread. Never widen.</li>
              <li><b className="text-ink">Target</b> — a real structural level ≥3R away. Never stretch TP to fit.</li>
            </ol>
            {plan ? (
              <div className="mt-3 rounded-lg border border-line p-3 text-xs">
                <div className="label mb-1">Today's plan</div>
                <div>Bias: <b>{plan.bias ?? "—"}</b>{plan.magnet ? ` · Magnet: ${plan.magnet}` : ""}</div>
                {plan.invalidation && <div className="text-mute">Invalid if: {plan.invalidation}</div>}
                {plan.pois && <div className="mt-1 whitespace-pre-wrap text-mute">{plan.pois}</div>}
              </div>
            ) : (
              <Link href={`/plan?account=${accountId}`} className="mt-3 block rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">No pre-market plan yet → write it</Link>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
