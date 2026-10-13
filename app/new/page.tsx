"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/Shell";
import { Badge, Card, Check, Chips, Field, MobileBar, PageHead, Segmented, numOrNull } from "@/components/ui";
import VoiceButton from "@/components/Voice";
import { ActionChips, Markdown, Sparkle } from "@/components/coach-ui";
import { supabase } from "@/lib/supabase";
import {
  accountState, feeShare, fmtUsd, levelsValid, newsBlock, positionSize, roundSize, rr, sessionAt, todayIST, windowOpen, windowLabel,
} from "@/lib/calc";
import { matchLessons, parseDictation } from "@/lib/analysis";
import { tzAbbr } from "@/lib/tz";
import { askCoach, asList, asText, resolveAccount, useCoachStatus, type CoachResult } from "@/lib/coach";
import { ALL_FEELINGS, ENTRY_MODELS, FEELINGS, GATE_CHECKS, MENTAL_KEYS, POI_TYPES, SESSIONS, type CoachAction, type GateKey, type MentalState } from "@/lib/types";

type Precheck = CoachResult & { verdict?: "GO" | "WAIT" | "NO"; summary?: string; checks?: { ok: boolean | null; text: string }[]; manage?: string[]; lessons?: string[]; actions?: CoachAction[] };

const blankGate = Object.fromEntries(GATE_CHECKS.map((g) => [g.key, false])) as Record<GateKey, boolean>;

function localInput(d: Date) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function NewTrade() {
  const router = useRouter();
  const { accounts, setups, trades, payouts, plans, refresh, adjustments, lessons, coachDb } = useData();
  const coach = useCoachStatus();
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
  const [mental, setMental] = useState<MentalState>({});
  const [feelings, setFeelings] = useState<string[]>([]);
  const [heard, setHeard] = useState("");
  const [autoVoice, setAutoVoice] = useState(false);
  const [check, setCheck] = useState<Precheck | null>(null);
  const [checking, setChecking] = useState(false);

  const now = new Date();
  const plan = plans.find((p) => p.account_id === accountId && p.plan_date === todayIST(now)) ?? null;
  const state = acct ? accountState(acct, trades, payouts, now, { plan, adjustments }) : null;
  const news = newsBlock(plan, now);
  const backfill = Math.abs(new Date(openedAt).getTime() - now.getTime()) > 30 * 60000;

  useEffect(() => {
    const s = sessionAt();
    setSession(s.name);
    setGate((g) => ({ ...g, in_session: !!acct && windowOpen(acct, new Date(), plan) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, acct, plan?.sessions?.join(), plan?.custom_window]);

  // Prefill from ?draft= (coach) and start dictation from ?voice=1
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("voice") === "1") setAutoVoice(true);
    const raw = q.get("draft");
    if (raw) {
      try {
        applyFields(JSON.parse(raw));
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFields(f: Record<string, unknown>) {
    const acc = typeof f.account_id === "string" ? accounts.find((a) => a.id === f.account_id) : typeof f.account === "string" ? resolveAccount(accounts, f.account) : null;
    if (acc) setAccountId(acc.id);
    if (f.direction === "long" || f.direction === "short") setDirection(f.direction);
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? v : null);
    if (num(f.entry)) setEntry(num(f.entry)!);
    if (num(f.sl)) setSl(num(f.sl)!);
    if (num(f.tp)) setTp(num(f.tp)!);
    if (typeof f.poi_type === "string" && POI_TYPES.includes(f.poi_type)) setPoi(f.poi_type);
    if (typeof f.entry_model === "string" && ENTRY_MODELS.includes(f.entry_model)) setModel(f.entry_model);
    if (typeof f.session === "string" && SESSIONS.includes(f.session)) setSession(f.session);
    if (typeof f.invalidation === "string") setInvalidation(f.invalidation);
    if (Array.isArray(f.emotions)) setFeelings((x) => [...new Set([...x, ...(f.emotions as string[]).filter((e) => ALL_FEELINGS.includes(e))])]);
    if (f.mental && typeof f.mental === "object") setMental((m) => ({ ...m, ...(f.mental as MentalState) }));
    if (f.gate && typeof f.gate === "object") {
      const g = f.gate as Record<string, unknown>;
      setGate((x) => ({ ...x, ...Object.fromEntries(GATE_CHECKS.filter((c) => typeof g[c.key] === "boolean").map((c) => [c.key, g[c.key] as boolean])) }));
    }
  }

  async function fromVoice(text: string) {
    setHeard(text);
    applyFields(parseDictation(text, accounts) as Record<string, unknown>);
    if (coach?.enabled) {
      const r = await askCoach("parse", { payload: { text, target: "trade" } });
      if (r.fields && typeof r.fields === "object") applyFields(r.fields as Record<string, unknown>);
    }
  }

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
    if (!backfill && news) out.push(`News block (${news} ${tzAbbr()})`);
    if (plan?.bias && plan.bias !== "neutral" && plan.bias !== direction) out.push(`Against today's ${plan.bias} bias`);
    if (plan?.bias === "neutral") out.push("Plan says stand aside today");
    if (risk > planned * 1.05 && planned > 0) out.push(`Risk ${fmtUsd(risk)} above plan ${fmtUsd(planned)}`);
    if (!gateOk) out.push(`A+ gate ${gateScore}/8${!rrOk && valid ? ` (R:R ${ratio} < ${minRr})` : ""}`);
    return out;
  }, [backfill, state, news, plan, direction, risk, planned, gateOk, gateScore, rrOk, valid, ratio, minRr]);

  const mentalWarn = useMemo(() => {
    const w: string[] = [];
    if ((mental.stress ?? 0) >= 4) w.push("High stress");
    if (mental.focus != null && mental.focus <= 2) w.push("Low focus");
    if (mental.patience != null && mental.patience <= 2) w.push("Impatient");
    const neg = feelings.filter((f) => (FEELINGS.negative as readonly string[]).includes(f));
    if (neg.length) w.push(neg.join(", "));
    return w;
  }, [mental, feelings]);
  const myLessons = matchLessons(lessons, { account_id: accountId, instrument: acct?.instrument }, 4);

  async function runCheck() {
    setChecking(true);
    setCheck(null);
    const r = (await askCoach("precheck", {
      payload: {
        account_id: accountId,
        draft: { direction, session, setup: setup?.name, entry_model: model, poi_type: poi, entry: e, sl: s, tp: t, rr: ratio, risk, size, gate, invalidation, mental, feelings, breaches, backfill },
        poi_type: poi,
        entry_model: model,
      },
    })) as Precheck;
    setCheck(r);
    setChecking(false);
    document.getElementById("coach-check")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
      emotions: feelings.filter((f) => ["Calm", "Confident", "Hesitant", "FOMO", "Revenge", "Overconfident", "Tired"].includes(f)),
      ...(coachDb ? { mental, emotion_log: feelings.length || Object.keys(mental).length ? [{ at: new Date().toISOString(), stage: "pre", emotions: feelings }] : [] } : {}),
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
        action={
          <div className="flex flex-wrap items-center gap-2">
            <VoiceButton label="Dictate trade" autoStart={autoVoice} onInterim={setHeard} onText={fromVoice} />
            <Segmented value={accountId} onChange={(v) => { setAccountId(v); setRiskInput(""); setSizeInput(""); }} options={active.map((a) => ({ value: a.id, label: `${a.instrument}` }))} />
          </div>
        }
      />
      {heard && (
        <div className="coach mb-4 p-3 text-sm">
          <span className="label mr-2 text-accent">Heard</span>{heard}
          <p className="mt-1 text-xs text-mute">Try: “Long gold, entry 4,212.5, stop 4,209, target 4,223, flip zone, market shift, London, feeling calm”. Check every field before logging.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card title="Setup">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Direction">
                <Segmented value={direction} onChange={setDirection} options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} />
                {plan?.bias && plan.bias !== "neutral" && (
                  <span className={`mt-1 block text-xs ${plan.bias === direction ? "text-up" : "text-down"}`}>Plan: {plan.bias}</span>
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
              <div className="col-span-2 sm:col-span-1"><Field label="Opened at">
                <input type="datetime-local" className="input" value={openedAt} onChange={(ev) => setOpenedAt(ev.target.value)} />
              </Field></div>
            </div>
          </Card>

          <Card title="Levels & size">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Field label="Entry"><input className="input num" inputMode="decimal" value={entry} onChange={(ev) => setEntry(ev.target.value)} /></Field>
              <Field label="Stop"><input className="input num" inputMode="decimal" value={sl} onChange={(ev) => setSl(ev.target.value)} /></Field>
              <Field label="Target"><input className="input num" inputMode="decimal" value={tp} onChange={(ev) => setTp(ev.target.value)} /></Field>
            </div>
            {entry && sl && tp && !valid && (
              <p className="mt-2 text-xs text-down">For a {direction}, SL must be {direction === "long" ? "below" : "above"} entry and TP {direction === "long" ? "above" : "below"}.</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Risk $" hint={`Plan: ${fmtUsd(planned)} (${state.riskPct}%)`}>
                <input className="input num" inputMode="decimal" placeholder={planned.toFixed(2)} value={riskInput} onChange={(ev) => setRiskInput(ev.target.value)} />
              </Field>
              <Field label={/XAU/i.test(acct.instrument) ? "Lots" : "Quantity"} hint={valid ? `Calculated ${calcSize}` : "Enter levels"}>
                <input className="input num" inputMode="decimal" placeholder={calcSize ? String(calcSize) : ""} value={sizeInput} onChange={(ev) => setSizeInput(ev.target.value)} />
              </Field>
              <div className="hidden rounded-xl border border-line p-3 sm:block">
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

          <Card title="Mental state · before entry" action={mentalWarn.length ? <Badge tone="warn">{mentalWarn.join(" · ")}</Badge> : Object.keys(mental).length ? <Badge tone="up">Ready</Badge> : <Badge>Rate yourself</Badge>}>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {MENTAL_KEYS.map((m) => (
                <div key={m.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-mute">{m.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const on = mental[m.key] === n;
                      const good = m.good === "high" ? n >= 4 : n <= 2;
                      const bad = m.good === "high" ? n <= 2 : n >= 4;
                      return (
                        <button key={n} type="button" aria-label={`${m.label} ${n}`} aria-pressed={on} onClick={() => setMental((x) => ({ ...x, [m.key]: n }))}
                          className={`num h-9 w-9 rounded-lg border text-sm sm:h-7 sm:w-7 sm:rounded-md sm:text-xs ${on ? (good ? "border-up bg-up/15 text-up" : bad ? "border-down bg-down/15 text-down" : "border-accent bg-accent/15") : "border-line text-mute hover:text-ink"}`}>{n}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3"><Chips options={ALL_FEELINGS} value={feelings} onChange={setFeelings} /></div>
            {mentalWarn.length > 0 && <p className="mt-2 text-xs text-warn">You're not at your best. Only take it if it's a textbook 8/8 — or skip and log why.</p>}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <section id="coach-check" className="coach scroll-mt-20 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkle className="h-4 w-4 text-chart" /> Coach check</h2>
              {coach?.enabled && <button className="btn-ghost h-8 min-h-0 text-xs" onClick={runCheck} disabled={checking || !valid}>{checking ? "Checking…" : check ? "Re-check" : "Check this trade"}</button>}
            </div>
            {check?.error && <p className="mt-2 text-sm text-down">{check.error}</p>}
            {check && !check.error && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone={check.verdict === "GO" ? "up" : check.verdict === "WAIT" ? "warn" : "down"}>{asText(check.verdict) || "—"}</Badge>
                  <span>{asText(check.summary)}</span>
                </div>
                <ul className="space-y-1">{(Array.isArray(check.checks) ? check.checks : []).map((c) => (typeof c === "string" ? { ok: null, text: c } : { ok: typeof c?.ok === "boolean" ? c.ok : null, text: asText(c?.text) })).map((c, i) => <li key={i} className="flex gap-2"><span className={c.ok ? "text-up" : c.ok === false ? "text-down" : "text-warn"}>{c.ok ? "✓" : c.ok === false ? "✕" : "!"}</span><span>{c.text}</span></li>)}</ul>
                {asList(check.manage).length > 0 && <div><div className="label mb-1">Management plan</div><ul className="list-disc space-y-0.5 pl-4">{asList(check.manage).map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
                {asList(check.lessons).length > 0 && <div className="text-xs text-accent">{asList(check.lessons).map((l, i) => <div key={i}>⟲ {l}</div>)}</div>}
                {typeof check.reply === "string" && !check.checks && <Markdown text={check.reply} />}
                <ActionChips actions={check.actions} />
              </div>
            )}
            {!check && (
              <div className="mt-2 text-sm text-mute">
                {myLessons.length ? (
                  <ul className="space-y-1.5">{myLessons.map((l) => <li key={l.id}><span className="text-ink">⟲ {l.title}</span>{l.rule ? <span className="block text-xs text-accent">→ {l.rule}</span> : null}</li>)}</ul>
                ) : coach?.enabled ? "Enter levels, tick the gate, then ask for a second opinion before you click." : "Lessons you save will show up here before every entry."}
              </div>
            )}
          </section>

          <div id="guardrails" className="scroll-mt-20" />
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
              <button className={breaches.length && override ? "btn-danger" : "btn-primary"} disabled={!canSave || busy} onClick={submit}>
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
                <div className="text-mute">Window: {windowLabel(acct, plan)}</div>
                {plan.invalidation && <div className="text-mute">Invalid if: {plan.invalidation}</div>}
                {plan.pois && <div className="mt-1 whitespace-pre-wrap text-mute">{plan.pois}</div>}
              </div>
            ) : (
              <Link href={`/plan?account=${accountId}`} className="mt-3 block rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">No pre-market plan yet → write it</Link>
            )}
          </Card>
        </div>
      </div>

      <MobileBar>
        <div className="num min-w-0 flex-1 text-xs leading-tight">
          <div className={`text-base font-semibold ${!valid ? "text-mute" : rrOk ? "text-up" : "text-down"}`}>{valid ? `1:${ratio}` : "R:R —"}</div>
          <div className="truncate text-mute">
            {fmtUsd(risk)} · {valid ? calcSize || "—" : "size —"} · <span className={gateOk ? "text-up" : "text-warn"}>{gateScore}/8</span>
            {breaches.length > 0 && <span className="text-down"> · {breaches.length} issue{breaches.length > 1 ? "s" : ""}</span>}
          </div>
        </div>
        {coach?.enabled && (
          <button className="btn-ghost h-11 min-h-0 px-3" onClick={runCheck} disabled={checking || !valid} aria-label="Coach check">
            <Sparkle className="h-4 w-4 text-chart" />
          </button>
        )}
        {breaches.length > 0 && !override ? (
          <button className="btn-ghost h-11 min-h-0 px-4 text-down" onClick={() => document.getElementById("guardrails")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Why blocked?
          </button>
        ) : (
          <button className={`h-11 min-h-0 px-4 ${breaches.length ? "btn-danger" : "btn-primary"}`} disabled={!canSave || busy} onClick={submit}>
            {busy ? "Saving…" : breaches.length ? "Log off-plan" : "Log trade"}
          </button>
        )}
      </MobileBar>
    </>
  );
}
