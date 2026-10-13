"use client";

import { useEffect, useRef, useState } from "react";

export function Card({ title, action, children, className = "" }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "up" | "down" | "warn" | "mute" }) {
  const color = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : tone === "mute" ? "text-mute" : "";
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={`num mt-1 truncate text-xl font-semibold tracking-tight ${color}`}>{value}</div>
      {sub != null && <div className="num mt-0.5 truncate text-xs text-mute">{sub}</div>}
    </div>
  );
}

export function Badge({ tone = "mute", children }: { tone?: "up" | "down" | "warn" | "mute" | "accent"; children: React.ReactNode }) {
  const map = {
    up: "border-up/30 bg-up/10 text-up",
    down: "border-down/30 bg-down/10 text-down",
    warn: "border-warn/30 bg-warn/10 text-warn",
    accent: "border-accent/30 bg-accent/10 text-accent",
    mute: "border-line text-mute",
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}>{children}</span>;
}

/** Horizontal meter. value/max in 0..1 range by default. */
export function Meter({ value, tone = "mute", label }: { value: number; tone?: "up" | "down" | "warn" | "mute" | "accent"; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const bg = { up: "bg-up", down: "bg-down", warn: "bg-warn", mute: "bg-mute", accent: "bg-accent" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "sm" }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: "sm" | "xs" }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`shrink-0 whitespace-nowrap rounded-md ${size === "xs" ? "px-2.5 py-1.5 text-[11px] sm:px-2 sm:py-0.5" : "px-3 py-2 text-xs sm:px-2.5 sm:py-1"} transition ${value === o.value ? "bg-ink text-bg" : "text-mute hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${checked ? "border-up/40 bg-up/5" : "border-line hover:border-ink/30"} disabled:opacity-50`}
      aria-pressed={checked}
    >
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-up bg-up text-bg" : "border-mute/50"}`}>
        {checked && (
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M3 8.5l3 3 7-7" /></svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-mute">{hint}</span>}
      </span>
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

export function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`rounded-full border px-3 py-1.5 text-xs transition sm:px-2.5 sm:py-1 ${on ? "border-ink bg-ink text-bg" : "border-line text-mute hover:text-ink"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  useEffect(() => setDrag(0), [open]);
  if (!open) return null;
  // Swipe the handle/header down to dismiss on phones.
  const onStart = (e: React.TouchEvent) => (startY.current = e.touches[0].clientY);
  const onMove = (e: React.TouchEvent) => startY.current != null && setDrag(Math.max(0, e.touches[0].clientY - startY.current));
  const onEnd = () => {
    if (drag > 90) onClose();
    else setDrag(0);
    startY.current = null;
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div
        className="card sheet-in flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-b-none shadow-2xl sm:max-h-[88vh] sm:rounded-[22px]"
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pb-3 pt-2 sm:pt-5" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-mute hover:text-ink" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-panel px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

/** Phone-only action bar pinned above the bottom nav (forms: log, save). */
export function MobileBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-3 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-20 md:hidden">
      <div className="card flex items-center gap-3 rounded-[20px] px-3 py-2.5 shadow-[0_8px_30px_rgb(0_0_0/0.25)]">{children}</div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="mt-1 text-sm text-mute">{children}</div>}
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
