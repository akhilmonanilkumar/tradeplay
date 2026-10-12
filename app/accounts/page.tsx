"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Card, Field, Modal, PageHead, numOrNull } from "@/components/ui";
import { accountState, fmtUsd } from "@/lib/calc";
import { supabase } from "@/lib/supabase";
import type { Account, Setup, Tier } from "@/lib/types";

type NumField = { key: keyof Account; label: string; hint?: string };
const GROUPS: { title: string; fields: NumField[] }[] = [
  {
    title: "Balance & firm rules",
    fields: [
      { key: "starting_balance", label: "Starting balance $", hint: "Changing it re-bases equity, floors and targets" },
      { key: "target_pct", label: "Target %", hint: "Blank for funded" },
      { key: "max_daily_loss_pct", label: "Firm daily loss %" },
      { key: "max_overall_loss_pct", label: "Firm max loss %" },
      { key: "min_profitable_days", label: "Min profitable days" },
    ],
  },
  {
    title: "Your guardrails",
    fields: [
      { key: "personal_daily_loss_pct", label: "Personal daily stop %" },
      { key: "max_daily_profit_pct", label: "Daily profit cap %" },
      { key: "max_trades_per_day", label: "Max trades / day" },
      { key: "max_losses_per_day", label: "Max losses / day" },
      { key: "min_rr", label: "Minimum R:R" },
      { key: "hard_stop_equity", label: "Hard-stop equity $" },
      { key: "loss_streak_n", label: "Loss-streak trigger (n)" },
      { key: "loss_streak_risk_pct", label: "Risk % on streak" },
    ],
  },
  {
    title: "Sizing",
    fields: [
      { key: "contract_size", label: "Contract size", hint: "Gold 100 oz/lot · BTC 1" },
      { key: "fee_rate", label: "Round-trip fee rate", hint: "BTC Breakout 0.0008" },
    ],
  },
];
const NUM_FIELDS: NumField[] = GROUPS.flatMap((g) => g.fields);

function AccountEditor({ account }: { account: Account }) {
  const { refresh, trades, payouts, adjustments, coachDb } = useData();
  const [sync, setSync] = useState({ balance: "", note: "" });
  const myAdj = adjustments.filter((x) => x.account_id === account.id);
  const [a, setA] = useState<Account>(account);
  const [ladder, setLadder] = useState<Tier[]>(account.risk_ladder ?? []);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [payout, setPayout] = useState({ amount: "", paid_at: new Date().toISOString().slice(0, 10), note: "" });
  const s = accountState(account, trades, payouts, new Date(), { adjustments });
  const dirty = JSON.stringify({ ...a, risk_ladder: ladder }) !== JSON.stringify({ ...account, risk_ladder: account.risk_ladder ?? [] });

  async function syncEquity() {
    const target = numOrNull(sync.balance);
    if (target == null || target <= 0) return setErr("Enter your broker's current balance");
    const diff = Math.round((target - s.equity) * 100) / 100;
    if (!diff) return setErr("Already in sync");
    const { error } = await supabase.from("balance_adjustments").insert({ account_id: account.id, amount: diff, note: sync.note || `Synced to broker balance ${target}` });
    if (error) return setErr(error.message);
    setSync({ balance: "", note: "" });
    setErr(null);
    refresh();
  }
  const myPayouts = payouts.filter((p) => p.account_id === account.id);

  useEffect(() => {
    setA(account);
    setLadder(account.risk_ladder ?? []);
  }, [account]);

  async function save() {
    setState("saving");
    setErr(null);
    const patch: Partial<Account> = {
      name: a.name, firm: a.firm, instrument: a.instrument, kind: a.kind, status: a.status, dd_type: a.dd_type,
      session_window: a.session_window, day_reset_utc: a.day_reset_utc, notes: a.notes,
      risk_ladder: ladder.filter((t) => Number.isFinite(t.min_equity) && t.risk_pct > 0),
    };
    for (const f of NUM_FIELDS) (patch as Record<string, unknown>)[f.key] = a[f.key];
    const { error } = await supabase.from("accounts").update(patch).eq("id", account.id);
    if (error) {
      setErr(error.message);
      return setState("idle");
    }
    await refresh();
    setState("saved");
  }

  async function addPayout() {
    const amount = numOrNull(payout.amount);
    if (!amount || amount <= 0) return setErr("Payout amount must be positive");
    const { error } = await supabase.from("payouts").insert({ account_id: account.id, amount, paid_at: payout.paid_at, note: payout.note || null });
    if (error) return setErr(error.message);
    setPayout({ ...payout, amount: "", note: "" });
    refresh();
  }

  const myTrades = trades.filter((t) => t.account_id === account.id);
  const [confirmDel, setConfirmDel] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function archive() {
    const { error } = await supabase.from("accounts").update({ status: "closed" }).eq("id", account.id);
    if (error) return setErr(error.message);
    setConfirmDel(false);
    refresh();
  }

  async function deleteAccount() {
    if (typed.trim() !== account.name.trim()) return;
    setDeleting(true);
    setErr(null);
    // Screenshots live in storage, not the table — remove them first so nothing is orphaned.
    const files = myTrades.flatMap((t) => [t.before_path, t.after_path]).filter((p): p is string => !!p);
    for (let i = 0; i < files.length; i += 100) await supabase.storage.from("screenshots").remove(files.slice(i, i + 100));
    // trades, payouts and day plans cascade in the database.
    const { error } = await supabase.from("accounts").delete().eq("id", account.id);
    setDeleting(false);
    if (error) return setErr(error.message);
    setConfirmDel(false);
    refresh();
  }

  async function delPayout(id: string) {
    if (!confirm("Delete this payout?")) return;
    await supabase.from("payouts").delete().eq("id", id);
    refresh();
  }

  return (
    <div id={account.id} className="scroll-mt-20">
    <Card
      title={<span className="flex items-center gap-2 normal-case tracking-normal"><span className="text-sm font-semibold text-ink">{account.name}</span><Badge>{account.instrument}</Badge><Badge tone={account.status === "active" ? "up" : "mute"}>{account.status}</Badge></span>}
      action={<span className="num text-sm">{fmtUsd(s.equity)}</span>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name"><input className="input" maxLength={120} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} /></Field>
        <Field label="Firm"><input className="input" value={a.firm ?? ""} onChange={(e) => setA({ ...a, firm: e.target.value })} /></Field>
        <Field label="Instrument"><input className="input" value={a.instrument} onChange={(e) => setA({ ...a, instrument: e.target.value })} /></Field>
        <Field label="Type">
          <select className="input" value={a.kind} onChange={(e) => setA({ ...a, kind: e.target.value as Account["kind"] })}>
            {["challenge", "funded", "live", "demo"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={a.status} onChange={(e) => setA({ ...a, status: e.target.value as Account["status"] })}>
            {["active", "passed", "failed", "closed"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Drawdown type">
          <select className="input" value={a.dd_type} onChange={(e) => setA({ ...a, dd_type: e.target.value as Account["dd_type"] })}>
            <option value="static">static</option>
            <option value="trailing">trailing</option>
          </select>
        </Field>
        <Field label="Session window" hint="DST-aware Q-zones">
          <select className="input" value={a.session_window} onChange={(e) => setA({ ...a, session_window: e.target.value as Account["session_window"] })}>
            {["London", "New York", "Asia", "Any"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Daily reset (UTC)" hint="Breakout 00:30 · broker midnight for FX/CFD">
          <input type="time" className="input" value={a.day_reset_utc.slice(0, 5)} onChange={(e) => setA({ ...a, day_reset_utc: `${e.target.value}:00` })} />
        </Field>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title} className="mt-5">
          <div className="label mb-2">{g.title}</div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input
                  className="input num"
                  inputMode="decimal"
                  value={a[f.key] == null ? "" : String(a[f.key])}
                  onChange={(e) => setA({ ...a, [f.key]: numOrNull(e.target.value) })}
                />
              </Field>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-5">
        <div className="label mb-2">Risk ladder — first tier where equity ≥ threshold applies</div>
        <div className="space-y-2">
          {ladder.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              <input className="input num" placeholder="Equity ≥" value={t.min_equity} onChange={(e) => setLadder(ladder.map((x, j) => (j === i ? { ...x, min_equity: Number(e.target.value) } : x)))} />
              <input className="input num" placeholder="Risk %" value={t.risk_pct} onChange={(e) => setLadder(ladder.map((x, j) => (j === i ? { ...x, risk_pct: Number(e.target.value) } : x)))} />
              <input className="input num" placeholder="Trades/day" value={t.max_trades} onChange={(e) => setLadder(ladder.map((x, j) => (j === i ? { ...x, max_trades: Number(e.target.value) } : x)))} />
              <button className="px-2 text-mute hover:text-down" onClick={() => setLadder(ladder.filter((_, j) => j !== i))} aria-label="Remove tier">✕</button>
            </div>
          ))}
          <button className="text-xs text-accent" onClick={() => setLadder([...ladder, { min_equity: 0, risk_pct: 0.25, max_trades: 1 }])}>+ Add tier</button>
        </div>
      </div>

      <Field label="Notes"><textarea className="input mt-4 min-h-16" maxLength={4000} value={a.notes ?? ""} onChange={(e) => setA({ ...a, notes: e.target.value })} /></Field>
      {err && <p className="mt-2 text-sm text-down">{err}</p>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button className="text-xs text-mute hover:text-down" onClick={() => { setTyped(""); setConfirmDel(true); }}>Delete account…</button>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${dirty ? "text-accent" : "text-mute"}`}>{dirty ? "Unsaved changes" : state === "saved" ? "Saved" : ""}</span>
          {dirty && <button className="btn-ghost" onClick={() => { setA(account); setLadder(account.risk_ladder ?? []); }}>Discard</button>}
          <button className="btn-primary" onClick={save} disabled={state === "saving" || !dirty}>Save changes</button>
        </div>
      </div>

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title={`Delete “${account.name}”?`}>
        <p className="text-sm text-mute">
          This permanently removes the account and <b className="text-ink">{myTrades.length} trade{myTrades.length === 1 ? "" : "s"}</b>,{" "}
          <b className="text-ink">{myPayouts.length} payout{myPayouts.length === 1 ? "" : "s"}</b>, its daily plans and screenshots. It cannot be undone.
        </p>
        {myTrades.length > 0 && (
          <p className="mt-2 text-sm text-mute">Keeping history? <button className="text-accent" onClick={archive}>Mark it closed instead</button> — it disappears from Today but stays in Insights.</p>
        )}
        <Field label="Type the account name to confirm">
          <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={account.name} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
          <button className="btn-danger" disabled={typed.trim() !== account.name.trim() || deleting} onClick={deleteAccount}>
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </Modal>

      {coachDb && (
        <div className="mt-6 border-t border-line pt-4">
          <div className="label mb-1">Equity sync</div>
          <p className="mb-2 text-xs text-mute">Equity = starting balance + closed P&L − payouts + adjustments = <b className="num text-ink">{fmtUsd(s.equity)}</b>. If your broker shows something else (swap, commissions, a deposit), enter the real balance and the difference is logged as an adjustment.</p>
          <div className="flex flex-wrap gap-2">
            <input className="input num w-40" inputMode="decimal" placeholder="Broker balance $" value={sync.balance} onChange={(e) => setSync({ ...sync, balance: e.target.value })} />
            <input className="input w-48 flex-1" placeholder="Note (optional)" value={sync.note} onChange={(e) => setSync({ ...sync, note: e.target.value })} maxLength={500} />
            <button className="btn-ghost" onClick={syncEquity}>Sync</button>
          </div>
          {myAdj.length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {myAdj.map((x) => (
                <li key={x.id} className="flex items-center justify-between py-1.5">
                  <span className="num">{x.at.slice(0, 10)} · <span className={x.amount >= 0 ? "text-up" : "text-down"}>{fmtUsd(x.amount, true)}</span> {x.note && <span className="text-mute">· {x.note}</span>}</span>
                  <button className="text-xs text-mute hover:text-down" onClick={async () => { if (!confirm("Delete this adjustment?")) return; await supabase.from("balance_adjustments").delete().eq("id", x.id); refresh(); }}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <div className="label mb-2">Payouts / withdrawals</div>
        <div className="flex flex-wrap gap-2">
          <input className="input num w-28" placeholder="Amount $" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} />
          <input type="date" className="input w-auto" value={payout.paid_at} onChange={(e) => setPayout({ ...payout, paid_at: e.target.value })} />
          <input className="input w-40 flex-1" placeholder="Note" value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} />
          <button className="btn-ghost" onClick={addPayout}>Add</button>
        </div>
        {myPayouts.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {myPayouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-1.5">
                <span className="num">{p.paid_at} · {fmtUsd(p.amount)} {p.note && <span className="text-mute">· {p.note}</span>}</span>
                <button className="text-xs text-mute hover:text-down" onClick={() => delPayout(p.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
    </div>
  );
}

function Setups() {
  const { setups, refresh } = useData();
  const [draft, setDraft] = useState({ name: "", model: "", rules: "" });

  async function add() {
    if (!draft.name.trim()) return;
    await supabase.from("setups").insert({ name: draft.name.trim(), model: draft.model || null, rules: draft.rules || null });
    setDraft({ name: "", model: "", rules: "" });
    refresh();
  }
  async function toggle(s: Setup) {
    await supabase.from("setups").update({ active: !s.active }).eq("id", s.id);
    refresh();
  }
  async function remove(s: Setup) {
    if (!confirm(`Delete setup “${s.name}”? Trades keep their data but lose the setup tag.`)) return;
    await supabase.from("setups").delete().eq("id", s.id);
    refresh();
  }

  return (
    <Card title="Setups">
      <ul className="space-y-2">
        {setups.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-line p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.name} {!s.active && <Badge>inactive</Badge>}</div>
              {s.rules && <p className="mt-0.5 text-xs text-mute">{s.rules}</p>}
            </div>
            <div className="flex shrink-0 gap-3">
              <button className="text-xs text-mute hover:text-ink" onClick={() => toggle(s)}>{s.active ? "Disable" : "Enable"}</button>
              <button className="text-xs text-mute hover:text-down" onClick={() => remove(s)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
        <input className="input" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className="input" placeholder="Model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
        <input className="input" placeholder="Rules" value={draft.rules} onChange={(e) => setDraft({ ...draft, rules: e.target.value })} />
        <button className="btn-ghost" onClick={add}>Add</button>
      </div>
    </Card>
  );
}

export default function Accounts() {
  const { accounts, refresh } = useData();
  async function addAccount() {
    await supabase.from("accounts").insert({
      name: "New account", instrument: "XAUUSD", starting_balance: 10000, max_daily_loss_pct: 5, max_overall_loss_pct: 10,
      risk_ladder: [{ min_equity: 0, risk_pct: 0.5, max_trades: 2 }], contract_size: 100,
    });
    refresh();
  }
  return (
    <>
      <PageHead title="Accounts & rules" sub="Every parameter is editable any time — balance, risk, limits, ladder, sessions. Changes apply to guardrails immediately." action={<button className="btn-ghost" onClick={addAccount}>+ Account</button>} />
      <div className="space-y-4">
        {accounts.map((a) => <AccountEditor key={a.id} account={a} />)}
        <Setups />
      </div>
    </>
  );
}
