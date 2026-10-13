"use client";

import { useRef, useState } from "react";
import type { ScoreAxis } from "@/lib/analysis";

/** Catmull-Rom → cubic Bézier for a smooth line through every point. */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Smooth area chart with a dark tooltip bubble (cumulative P&L). */
export function SmoothArea({ points, height = 260, format, label }: { points: { t: number; v: number }[]; height?: number; format: (v: number) => string; label: (t: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="grid place-items-center text-sm text-mute" style={{ height }}>Close a few trades to draw the curve</div>;
  const W = 800, H = height, pad = { t: 16, b: 26, l: 4, r: 4 };
  const vs = points.map((p) => p.v);
  const lo = Math.min(0, ...vs), hi = Math.max(0, ...vs), span = hi - lo || 1;
  const X = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
  const pts = points.map((p, i) => [X(i), Y(p.v)] as [number, number]);
  const line = smooth(pts);
  const area = `${line} L${X(points.length - 1)},${H - pad.b} L${X(0)},${H - pad.b} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (points.length - 1)));
  const hp = hover != null ? points[hover] : null;
  const move = (cx: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(((cx - r.left) / r.width) * (points.length - 1)))));
  };
  return (
    <div ref={ref} className="relative select-none" onMouseMove={(e) => move(e.clientX)} onTouchMove={(e) => move(e.touches[0].clientX)} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
        <defs>
          <linearGradient id="sa-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--chart))" stopOpacity="0.28" />
            <stop offset="1" stopColor="rgb(var(--chart))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)} stroke="rgb(var(--line))" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />)}
        <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="rgb(var(--mute) / 0.4)" vectorEffect="non-scaling-stroke" />
        <path d={area} fill="url(#sa-fill)" />
        <path d={line} fill="none" stroke="rgb(var(--chart))" strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover != null && <line x1={X(hover)} x2={X(hover)} y1={pad.t} y2={H - pad.b} stroke="rgb(var(--chart) / 0.5)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hp && hover != null && (
        <>
          <span className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-chart bg-panel" style={{ left: `${(X(hover) / W) * 100}%`, top: (Y(hp.v) / H) * height }} />
          <div className="num pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-xl bg-solid px-3 py-2 text-xs text-solid-ink shadow-lg" style={{ left: `${Math.min(88, Math.max(12, (X(hover) / W) * 100))}%`, top: (Y(hp.v) / H) * height }}>
            <div className="opacity-70">{label(hp.t)}</div>
            <div className="font-semibold">{format(hp.v)}</div>
          </div>
        </>
      )}
      <div className="num mt-1 flex justify-between text-[11px] text-mute">
        {ticks.map((i, k) => <span key={k}>{label(points[i].t)}</span>)}
      </div>
    </div>
  );
}

/** Net daily P&L bars (green up / red down). */
export function DayBars({ days, height = 200, format }: { days: { d: string; v: number }[]; height?: number; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!days.length) return <div className="grid place-items-center text-sm text-mute" style={{ height }}>No closed trades yet</div>;
  const max = Math.max(...days.map((x) => Math.max(0, x.v)), 1);
  const min = Math.min(...days.map((x) => Math.min(0, x.v)), 0);
  const span = max - min || 1;
  const zero = (max / span) * 100;
  return (
    <div className="relative">
      <div className="relative flex items-stretch gap-[3px]" style={{ height }}>
        <div className="absolute inset-x-0 h-px bg-line" style={{ top: `${zero}%` }} />
        {days.map((x, i) => {
          const h = (Math.abs(x.v) / span) * 100;
          return (
            <div key={x.d} className="relative flex-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div
                className={`absolute inset-x-0 mx-auto w-full max-w-[18px] ${x.v >= 0 ? "rounded-t-[5px] rounded-b-[2px] bg-up" : "rounded-b-[5px] rounded-t-[2px] bg-down"} ${hover === i ? "opacity-100" : "opacity-85"}`}
                style={x.v >= 0 ? { bottom: `${100 - zero}%`, height: `${Math.max(h, 0.8)}%` } : { top: `${zero}%`, height: `${Math.max(h, 0.8)}%` }}
              />
            </div>
          );
        })}
      </div>
      {hover != null && (
        <div className="num absolute right-0 top-0 rounded-lg bg-solid px-2.5 py-1.5 text-xs text-solid-ink">
          {new Date(`${days[hover].d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} · {format(days[hover].v)}
        </div>
      )}
      <div className="num mt-1.5 flex justify-between text-[11px] text-mute">
        <span>{new Date(`${days[0].d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
        <span>{new Date(`${days.at(-1)!.d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
      </div>
    </div>
  );
}

/** Radar of the six score axes; optional dashed comparison (previous period). */
export function Radar({ axes, prev, size = 220 }: { axes: ScoreAxis[]; prev?: ScoreAxis[]; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const c = size / 2, r = size / 2 - 30;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / axes.length) * Math.PI * 2;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, Math.max(0.04, v)).join(",")).join(" ");
  return (
    <div className="relative">
      <svg viewBox={`-44 -6 ${size + 88} ${size + 12}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label={axes.map((a) => `${a.label} ${a.raw}`).join(", ")}>
        {[0.33, 0.66, 1].map((k) => <polygon key={k} points={poly(axes.map(() => k))} fill="none" stroke="rgb(var(--line))" />)}
        {axes.map((_, i) => <line key={i} x1={c} y1={c} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="rgb(var(--line))" />)}
        {prev && <polygon points={poly(prev.map((a) => a.value))} fill="none" stroke="rgb(var(--accent))" strokeWidth={1.8} strokeDasharray="5 4" />}
        <polygon points={poly(axes.map((a) => a.value))} fill="rgb(var(--chart) / 0.18)" stroke="rgb(var(--chart))" strokeWidth={2.5} strokeLinejoin="round" />
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.16);
          return (
            <text key={a.key} x={x} y={y} textAnchor={Math.abs(x - c) < 4 ? "middle" : x > c ? "start" : "end"} dominantBaseline="middle" fontSize="11" fill={hover === i ? "rgb(var(--ink))" : "rgb(var(--mute))"} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {a.label}
            </text>
          );
        })}
      </svg>
      {hover != null && <div className="num absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-solid px-2.5 py-1.5 text-xs text-solid-ink">{axes[hover].label}: {axes[hover].raw}</div>}
    </div>
  );
}

/** Red → green gradient gauge with a marker (0–100). */
export function ScoreGauge({ value }: { value: number | null }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div>
      <div className="relative h-3 rounded-full" style={{ background: "linear-gradient(90deg,#F87171,#FBBF24 45%,#A3E635 72%,#34D399)" }}>
        {value != null && <span className="absolute -top-1 h-5 w-2.5 -translate-x-1/2 rounded-md border-2 border-ink bg-panel" style={{ left: `${v}%` }} />}
      </div>
      <div className="num mt-2 flex justify-between text-[11px] text-mute">{[0, 20, 40, 60, 80, 100].map((x) => <span key={x}>{x}</span>)}</div>
    </div>
  );
}
