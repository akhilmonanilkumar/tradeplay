"use client";

import { useMemo, useRef, useState } from "react";
import { fmtR } from "@/lib/calc";

/* Shared tooltip */
function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-panel px-2 py-1 text-[11px] shadow-lg"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}

/* ---------- Cumulative R line with hover crosshair ---------- */
export function LineChart({
  points,
  height = 220,
  format = fmtR,
  label = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
}: {
  points: { t: number; v: number; note?: string }[];
  height?: number;
  format?: (v: number) => string;
  label?: (t: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const pad = { l: 8, r: 8, t: 12, b: 18 };
  const data = points.length ? [{ t: points[0].t, v: 0 }, ...points] : [];
  const vs = data.map((p) => p.v);
  const min = Math.min(0, ...vs);
  const max = Math.max(0, ...vs);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const path = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = data.length ? `${path}L${x(data.length - 1)},${y(min)}L${x(0)},${y(min)}Z` : "";
  const last = data.at(-1)?.v ?? 0;
  const tone = last >= 0 ? "rgb(var(--up))" : "rgb(var(--down))";

  if (!points.length) return <div className="grid h-40 place-items-center text-sm text-mute">No closed trades yet</div>;

  function onMove(e: React.MouseEvent | React.TouchEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const rel = (cx - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
  }

  const hp = hover != null ? data[hover] : null;
  const box = ref.current?.getBoundingClientRect();

  return (
    <div ref={ref} className="relative select-none" onMouseMove={onMove} onTouchMove={onMove} onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-auto w-full" style={{ height }}>
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tone} stopOpacity="0.22" />
            <stop offset="1" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="rgb(var(--line))" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={area} fill="url(#lc-fill)" />
        <path d={path} fill="none" stroke={tone} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hp && hover != null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="rgb(var(--mute))" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(hp.v)} r={4} fill={tone} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {hp && hover != null && box && (
        <Tip x={(x(hover) / W) * box.width} y={(y(hp.v) / H) * height}>
          <span className="num font-semibold">{format(hp.v)}</span>
          {hover > 0 && <span className="text-mute"> · #{hover} · {label(hp.t)}</span>}
          {"note" in hp && hp.note ? <div className="text-mute">{String(hp.note)}</div> : null}
        </Tip>
      )}
    </div>
  );
}

/* ---------- Horizontal bars (click to drill) ---------- */
export function HBars({
  rows,
  format = fmtR,
  active,
  onPick,
}: {
  rows: { key: string; value: number; sub?: string }[];
  format?: (v: number) => string;
  active?: string | null;
  onPick?: (key: string) => void;
}) {
  const maxAbs = Math.max(0.0001, ...rows.map((r) => Math.abs(r.value)));
  if (!rows.length) return <div className="py-6 text-center text-sm text-mute">No data</div>;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const w = (Math.abs(r.value) / maxAbs) * 50;
        const pos = r.value >= 0;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onPick?.(r.key)}
            className={`grid w-full grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 rounded-md px-1.5 py-1 text-left text-xs transition ${active === r.key ? "bg-accent/10 ring-1 ring-accent/40" : "hover:bg-line/40"}`}
          >
            <span className="truncate" title={r.key}>{r.key}</span>
            <span className="relative h-2.5">
              <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
              <span
                className={`absolute inset-y-0 rounded-sm ${pos ? "bg-up/80" : "bg-down/80"}`}
                style={pos ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
              />
            </span>
            <span className={`num text-right ${pos ? "text-up" : "text-down"}`}>
              {format(r.value)}
              {r.sub && <span className="block text-[10px] text-mute">{r.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Histogram of R outcomes ---------- */
export function Histogram({ values, step = 0.5 }: { values: number[]; step?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const bins = useMemo(() => {
    if (!values.length) return [];
    const lo = Math.floor(Math.min(...values, -1) / step) * step;
    const hi = Math.ceil(Math.max(...values, 1) / step) * step;
    const out: { from: number; to: number; n: number }[] = [];
    for (let b = lo; b < hi; b += step) out.push({ from: b, to: b + step, n: 0 });
    for (const v of values) {
      const i = Math.min(out.length - 1, Math.max(0, Math.floor((v - lo) / step)));
      out[i].n++;
    }
    return out;
  }, [values, step]);
  if (!bins.length) return <div className="py-6 text-center text-sm text-mute">No data</div>;
  const max = Math.max(...bins.map((b) => b.n));
  return (
    <div className="relative">
      <div className="flex h-36 items-end gap-[2px]">
        {bins.map((b, i) => (
          <div
            key={i}
            className="relative flex-1"
            style={{ height: "100%" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={`absolute bottom-0 w-full rounded-t-sm ${b.from >= 0 ? "bg-up/75" : "bg-down/75"} ${hover === i ? "opacity-100" : "opacity-80"}`}
              style={{ height: `${max ? (b.n / max) * 100 : 0}%`, minHeight: b.n ? 2 : 0 }}
            />
            {hover === i && (
              <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-line bg-panel px-1.5 py-0.5 text-[11px]">
                {b.n} trade{b.n === 1 ? "" : "s"} · {b.from}R to {b.to}R
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="num mt-1 flex justify-between text-[10px] text-mute">
        <span>{bins[0].from}R</span>
        <span>0R</span>
        <span>{bins.at(-1)!.to}R</span>
      </div>
    </div>
  );
}

/* ---------- Heatmap (rows × cols) ---------- */
export function Heatmap({
  rows,
  cols,
  cell,
  onPick,
}: {
  rows: string[];
  cols: string[];
  cell: (r: string, c: string) => { value: number; n: number } | null;
  onPick?: (r: string, c: string) => void;
}) {
  const all = rows.flatMap((r) => cols.map((c) => cell(r, c)?.value ?? 0));
  const maxAbs = Math.max(0.0001, ...all.map(Math.abs));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="px-1 pb-1 text-left font-normal text-mute">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td className="pr-2 text-mute">{r}</td>
              {cols.map((c) => {
                const v = cell(r, c);
                const a = v ? Math.min(1, Math.abs(v.value) / maxAbs) : 0;
                const bg = !v ? "transparent" : v.value >= 0 ? `rgb(var(--up) / ${0.12 + a * 0.6})` : `rgb(var(--down) / ${0.12 + a * 0.6})`;
                return (
                  <td key={c} className="p-0">
                    <button
                      type="button"
                      disabled={!v}
                      onClick={() => v && onPick?.(r, c)}
                      title={v ? `${r} · ${c}: ${fmtR(v.value)} over ${v.n} trades` : "No trades"}
                      className="num h-9 w-full min-w-14 rounded-md border border-line text-[11px] transition hover:ring-1 hover:ring-accent/50 disabled:border-dashed disabled:text-mute/50"
                      style={{ background: bg }}
                    >
                      {v ? fmtR(v.value) : "·"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Calendar of daily P&L ---------- */
export function PnlCalendar({ days, month, onMonth, onPick }: { days: Map<string, { net: number; n: number }>; month: Date; onMonth: (d: Date) => void; onPick?: (iso: string) => void }) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  const maxAbs = Math.max(1, ...[...days.values()].map((d) => Math.abs(d.net)));
  const monthNet = cells.reduce((s, c) => s + (c ? days.get(c)?.net ?? 0 : 0), 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <button className="px-2 text-mute hover:text-ink" onClick={() => onMonth(new Date(y, m - 1, 1))} aria-label="Previous month">‹</button>
        <span>
          {first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          <span className={`num ml-2 text-xs ${monthNet >= 0 ? "text-up" : "text-down"}`}>{monthNet >= 0 ? "+" : "−"}${Math.abs(monthNet).toFixed(0)}</span>
        </span>
        <button className="px-2 text-mute hover:text-ink" onClick={() => onMonth(new Date(y, m + 1, 1))} aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-mute">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const d = days.get(c);
          const a = d ? Math.min(1, Math.abs(d.net) / maxAbs) : 0;
          return (
            <button
              key={c}
              type="button"
              disabled={!d}
              onClick={() => d && onPick?.(c)}
              className="aspect-square rounded-md border border-line p-1 text-left text-[10px] transition hover:ring-1 hover:ring-accent/50 disabled:hover:ring-0"
              style={{ background: d ? (d.net >= 0 ? `rgb(var(--up) / ${0.1 + a * 0.55})` : `rgb(var(--down) / ${0.1 + a * 0.55})`) : undefined }}
              title={d ? `${c}: ${d.net >= 0 ? "+" : "−"}$${Math.abs(d.net).toFixed(2)} · ${d.n} trade(s)` : c}
            >
              <span className="text-mute">{Number(c.slice(8))}</span>
              {d && <span className="num block truncate font-medium">{d.net >= 0 ? "+" : "−"}{Math.abs(d.net).toFixed(0)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Radial score ---------- */
export function Ring({ value, size = 96, label }: { value: number | null; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const tone = value == null ? "rgb(var(--line))" : v >= 80 ? "rgb(var(--up))" : v >= 60 ? "rgb(var(--warn))" : "rgb(var(--down))";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--line))" strokeWidth={8} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="num text-xl font-semibold">{value ?? "—"}</div>
          {label && <div className="text-[10px] text-mute">{label}</div>}
        </div>
      </div>
    </div>
  );
}
