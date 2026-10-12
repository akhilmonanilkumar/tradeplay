"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useData } from "@/components/Shell";
import { Badge, Empty, PageHead, Segmented } from "@/components/ui";
import TradeModal from "@/components/TradeModal";
import { fmtIST, fmtR, fmtUsd, toCsv } from "@/lib/calc";
import type { Trade } from "@/lib/types";

type StatusF = "all" | "open" | "closed" | "cancelled";
type GateF = "all" | "aplus" | "off";

export default function Trades() {
  const { trades, accounts, setups } = useData();
  const [status, setStatus] = useState<StatusF>("all");
  const [gate, setGate] = useState<GateF>("all");
  const [account, setAccount] = useState("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Trade | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return trades.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (account !== "all" && t.account_id !== account) return false;
      if (gate === "aplus" && (t.gate_score < 8 || t.override_reason)) return false;
      if (gate === "off" && t.gate_score === 8 && !t.override_reason) return false;
      if (needle) {
        const hay = [t.instrument, t.direction, t.session, t.entry_model, t.poi_type, t.review, ...t.mistakes, ...t.emotions,
          setups.find((s) => s.id === t.setup_id)?.name].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [trades, status, account, gate, q, setups]);

  function exportCsv() {
    const data = rows.map((t) => ({
      opened_at: t.opened_at, closed_at: t.closed_at, account: accounts.find((a) => a.id === t.account_id)?.name,
      instrument: t.instrument, direction: t.direction, status: t.status, session: t.session,
      setup: setups.find((s) => s.id === t.setup_id)?.name, entry_model: t.entry_model, poi_type: t.poi_type,
      entry: t.entry, sl: t.sl, tp: t.tp, exit: t.exit, size: t.size, risk_usd: t.risk_usd, planned_risk_usd: t.planned_risk_usd,
      rr_planned: t.rr_planned, gross_pnl: t.gross_pnl, fees: t.fees, net_pnl: t.net_pnl, r_multiple: t.r_multiple,
      gate_score: t.gate_score, htf_aligned: t.htf_aligned, correct_half: t.correct_half, in_poi: t.in_poi,
      liquidity_swept: t.liquidity_swept, market_shift: t.market_shift, in_session: t.in_session, news_clear: t.news_clear,
      override_reason: t.override_reason, guardrail_breaches: t.guardrail_breaches, mistakes: t.mistakes, emotions: t.emotions,
      invalidation: t.invalidation, review: t.review, chart_url: t.chart_url,
    }));
    const blob = new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradeplay-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHead
        title="Trades"
        sub={`${rows.length} of ${trades.length}`}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
            <Link href="/new" className="btn-primary">+ New</Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }, { value: "cancelled", label: "Cancelled" }]} />
        <Segmented value={gate} onChange={setGate} options={[{ value: "all", label: "Any" }, { value: "aplus", label: "A+ only" }, { value: "off", label: "Off-plan" }]} />
        <select className="input w-auto" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input className="input w-full sm:w-56" placeholder="Search notes, tags, setup…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <Empty title="No trades here">Log your first A+ trade from <Link className="text-accent" href="/new">New</Link>.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {["Opened (IST)", "Instrument", "Setup", "Gate", "R:R", "Risk", "Net", "R", "Tags"].map((h) => (
                  <th key={h} className="label px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const net = t.net_pnl;
                return (
                  <tr key={t.id} onClick={() => setEdit(t)} className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-line/30">
                    <td className="num px-3 py-2.5 text-mute">{fmtIST(t.opened_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${t.direction === "long" ? "bg-up" : "bg-down"}`} />
                        {t.instrument}
                        {t.status !== "closed" && <Badge>{t.status}</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-mute">{setups.find((s) => s.id === t.setup_id)?.name ?? t.entry_model ?? "—"}</td>
                    <td className="px-3 py-2.5"><Badge tone={t.gate_score === 8 && !t.override_reason ? "up" : "warn"}>{t.gate_score}/8</Badge></td>
                    <td className="num px-3 py-2.5">1:{t.rr_planned ?? "—"}</td>
                    <td className="num px-3 py-2.5">{fmtUsd(t.risk_usd)}</td>
                    <td className={`num px-3 py-2.5 ${net == null ? "text-mute" : net >= 0 ? "text-up" : "text-down"}`}>{net == null ? "—" : fmtUsd(net, true)}</td>
                    <td className={`num px-3 py-2.5 ${t.r_multiple == null ? "text-mute" : t.r_multiple >= 0 ? "text-up" : "text-down"}`}>{fmtR(t.r_multiple)}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        {t.override_reason && <Badge tone="down">override</Badge>}
                        {t.mistakes.slice(0, 2).map((m) => <Badge key={m}>{m}</Badge>)}
                        {(t.before_path || t.after_path) && <Badge tone="accent">📷</Badge>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TradeModal trade={edit} onClose={() => setEdit(null)} />
    </>
  );
}
