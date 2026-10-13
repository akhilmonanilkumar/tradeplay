"use client";

import { useMemo } from "react";
import { sessionAt, todayIST } from "@/lib/calc";
import { getTimeZone, localToUtc, tzAbbr } from "@/lib/tz";

const COLORS: Record<string, string> = { Asia: "#14B8A6", London: "#8B5CF6", "New York": "#F2C14E" };
const DAY = 24 * 60;
const STEP = 5;

type Seg = { name: string; from: number; to: number };

function fmtHM(t: number, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
}
function fmtLeft(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** A 24-hour track of today (your time zone) with the trading sessions, a live "now" marker, and UTC + local labels. */
export default function SessionSlider({ now, newsTimes = [] }: { now: Date; newsTimes?: string[] }) {
  const tz = getTimeZone();
  const day = todayIST(now);
  const start = localToUtc(day, "00:00");

  const segs = useMemo(() => {
    const out: Seg[] = [];
    for (let m = 0; m < DAY; m += STEP) {
      const s = sessionAt(new Date(start + m * 60000));
      const name = s.inWindow ? s.name : "";
      const last = out[out.length - 1];
      if (last && last.name === name) last.to = m + STEP;
      else out.push({ name, from: m, to: m + STEP });
    }
    return out.filter((x) => x.name);
  }, [start]);

  const nowMin = Math.max(0, Math.min(DAY, (now.getTime() - start) / 60000));
  const cur = segs.find((s) => nowMin >= s.from && nowMin < s.to);
  const next = segs.find((s) => s.from > nowMin);
  const status = cur
    ? { label: `${cur.name} session`, sub: `${fmtLeft(cur.to - nowMin)} left`, color: COLORS[cur.name] }
    : next
      ? { label: "Off-session", sub: `${next.name} in ${fmtLeft(next.from - nowMin)}`, color: undefined }
      : { label: "Off-session", sub: "Sessions done for today", color: undefined };

  const showUtc = tzAbbr(now) !== "UTC";
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const pct = (m: number) => `${(m / DAY) * 100}%`;
  const news = newsTimes
    .map((hm) => (localToUtc(day, hm.slice(0, 5)) - start) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0 && m <= DAY);

  return (
    <section className="card p-4 sm:p-5" aria-label="Trading sessions today">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {cur && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: status.color }} />}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: status.color ?? "rgb(var(--mute))" }} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">{status.label}</span>
          <span className="num text-xs text-mute">{status.sub}</span>
        </div>
        <div className="num flex items-center gap-3 text-xs text-mute">
          <span><b className="font-semibold text-ink">{fmtHM(now.getTime(), tz)}</b> {tzAbbr(now)}</span>
          {showUtc && <span><b className="font-semibold text-ink">{fmtHM(now.getTime(), "UTC")}</b> UTC</span>}
        </div>
      </div>

      <div className="relative mt-7">
        {/* now label */}
        <div className="num absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-bg" style={{ left: pct(nowMin) }}>
          Now
        </div>
        <div className="relative">
        <div className="relative h-3.5 overflow-hidden rounded-full bg-raised">
          {segs.map((s) => (
            <div key={`${s.name}-${s.from}`} className="absolute inset-y-0" style={{ left: pct(s.from), width: pct(s.to - s.from), background: COLORS[s.name], opacity: cur === s ? 1 : 0.55 }} title={`${s.name} ${fmtHM(start + s.from * 60000, tz)}–${fmtHM(start + s.to * 60000, tz)}`} />
          ))}
          {/* elapsed part of the day */}
          <div className="absolute inset-y-0 left-0 bg-bg/35" style={{ width: pct(nowMin) }} />
          {news.map((m) => (
            <div key={m} className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-down" style={{ left: pct(m) }} title="News block" />
          ))}
        </div>
        <div className="pointer-events-none absolute -bottom-1.5 -top-1.5 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: pct(nowMin) }}>
          <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-ink ring-2 ring-[rgb(var(--panel))]" />
        </div>
        </div>

        <div className="num relative mt-2.5 h-4 text-[10px] text-mute">
          {ticks.map((h, i) => (
            <span key={h} className={`absolute ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"} ${h % 6 ? "hidden sm:inline" : ""}`} style={{ left: pct(h * 60) }}>
              {String(h % 24).padStart(2, "0")}:00
            </span>
          ))}
          <span className="sr-only">{tzAbbr(now)}</span>
        </div>
        {showUtc && (
          <div className="num relative h-4 text-[10px] text-mute/70">
            {ticks.map((h, i) => (
              <span key={h} className={`absolute ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"} ${h % 6 ? "hidden sm:inline" : ""}`} style={{ left: pct(h * 60) }}>
                {fmtHM(start + h * 3600000, "UTC")}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-mute">
        {Object.entries(COLORS).map(([n, c]) => {
          const s = segs.find((x) => x.name === n);
          return (
            <span key={n} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c }} />
              {n}
              {s && <span className="num">{fmtHM(start + s.from * 60000, tz)}–{fmtHM(start + s.to * 60000, tz)}</span>}
            </span>
          );
        })}
        {news.length > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-0.5 bg-down" /> News block</span>}
        <span className="ml-auto">Top row {tzAbbr(now)}{showUtc ? " · bottom row UTC" : ""}</span>
      </div>
    </section>
  );
}
