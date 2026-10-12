"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NAV, useData, useTheme } from "@/components/Shell";

type Item = { id: string; label: string; hint?: string; run: () => void };

export default function CommandPalette({ open, onClose, go }: { open: boolean; onClose: () => void; go: (href: string) => void }) {
  const { trades, accounts } = useData();
  const [, setTheme] = useTheme();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setI(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      ...NAV.map((n) => ({ id: n.href, label: `Go to ${n.label}`, run: () => go(n.href) })),
      { id: "voice-trade", label: "Dictate a trade", hint: "voice", run: () => go("/new?voice=1") },
      { id: "voice-plan", label: "Dictate today's plan", hint: "voice", run: () => go("/plan?voice=1") },
      { id: "ask", label: "Ask the coach…", hint: q ? `“${q}”` : undefined, run: () => go(`/coach${q ? `?q=${encodeURIComponent(q)}` : ""}`) },
      { id: "brief", label: "Morning brief from the coach", run: () => go("/coach?task=brief") },
      { id: "tools", label: "Prop-firm simulator (Monte Carlo)", run: () => go("/analytics?tab=tools") },
      { id: "t-dark", label: "Theme: dark", run: () => { setTheme("dark"); onClose(); } },
      { id: "t-light", label: "Theme: light", run: () => { setTheme("light"); onClose(); } },
      { id: "t-system", label: "Theme: match system", run: () => { setTheme("system"); onClose(); } },
      ...accounts.map((a) => ({ id: `acct-${a.id}`, label: `Account: ${a.name}`, hint: a.instrument, run: () => go(`/accounts#${a.id}`) })),
    ];
    const s = q.trim().toLowerCase();
    if (!s) return base;
    const recent = trades
      .filter((t) => `${t.instrument} ${t.direction} ${t.session ?? ""} ${t.review ?? ""} ${(t.mistakes ?? []).join(" ")}`.toLowerCase().includes(s))
      .slice(0, 6)
      .map((t) => ({ id: `trade-${t.id}`, label: `Trade ${t.instrument} ${t.direction} · ${t.opened_at.slice(0, 10)}`, hint: t.r_multiple != null ? `${t.r_multiple}R` : t.status, run: () => go(`/trades?open=${t.id}`) }));
    const matched = base.filter((x) => `${x.label} ${x.hint ?? ""}`.toLowerCase().includes(s));
    const ask = base.find((x) => x.id === "ask")!;
    return [...matched.filter((x) => x.id !== "ask"), ...recent, ask];
  }, [q, trades, accounts, go, onClose, setTheme]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search and actions">
        <input
          ref={input}
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-mute"
          placeholder="Search trades, jump anywhere, or ask the coach…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            if (e.key === "Enter") items[i]?.run();
          }}
        />
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {items.map((it, k) => (
            <li key={it.id}>
              <button
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${k === i ? "bg-raised text-ink" : "text-mute"}`}
                onMouseEnter={() => setI(k)}
                onClick={it.run}
              >
                <span className="truncate">{it.label}</span>
                {it.hint && <span className="ml-3 shrink-0 text-xs text-mute">{it.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
