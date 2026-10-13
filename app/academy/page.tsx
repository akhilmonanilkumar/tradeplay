"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead, Segmented } from "@/components/ui";
import AcademyIllo from "@/components/AcademyIllo";
import { LESSONS, PATHS, lessonsFor, loadDone, type Path } from "@/lib/academy";

export default function Academy() {
  const [path, setPath] = useState<Path>("beginner");
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    setDone(loadDone());
    try {
      const p = localStorage.getItem("aplus.academy.path");
      if (p === "pro" || p === "beginner") setPath(p);
    } catch {}
  }, []);
  const choose = (p: Path) => {
    setPath(p);
    try { localStorage.setItem("aplus.academy.path", p); } catch {}
  };
  const list = lessonsFor(path);
  const next = list.find((l) => !done.has(l.id)) ?? list[0];
  const meta = PATHS.find((p) => p.id === path)!;
  const pct = (p: Path) => {
    const l = lessonsFor(p);
    return l.length ? l.filter((x) => done.has(x.id)).length / l.length : 0;
  };

  return (
    <>
      <PageHead title="Academy" sub="Learn the method behind every check in this app — in order, one idea per lesson." action={<Segmented value={path} onChange={choose} options={[{ value: "beginner", label: "Beginner" }, { value: "pro", label: "Pro" }]} />} />

      <div className="grid gap-4 md:grid-cols-2">
        {PATHS.map((p) => (
          <button key={p.id} onClick={() => choose(p.id)} className={`card p-5 text-left transition ${path === p.id ? "ring-2 ring-chart/60" : "opacity-80 hover:opacity-100"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{p.title}</span>
              <span className="num text-xs text-mute">{lessonsFor(p.id).filter((x) => done.has(x.id)).length}/{lessonsFor(p.id).length}</span>
            </div>
            <div className="mt-1 text-lg font-semibold leading-snug">{p.tagline}</div>
            <p className="mt-1 text-sm text-mute">{p.blurb}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-chart transition-all" style={{ width: `${pct(p.id) * 100}%` }} /></div>
          </button>
        ))}
      </div>

      {next && (
        <Link href={`/academy/${next.id}`} className="coach mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="w-full shrink-0 sm:w-56"><AcademyIllo name={next.illo} /></div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-chart">{done.has(next.id) ? "Start again" : done.size ? "Continue" : "Start here"} · {meta.title}</div>
            <div className="mt-1 text-xl font-semibold">{next.title}</div>
            <p className="mt-1 text-sm text-mute">{next.summary}</p>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent">Open lesson · {next.minutes} min →</span>
          </div>
        </Link>
      )}

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((l, i) => (
          <li key={l.id}>
            <Link href={`/academy/${l.id}`} className="card flex h-full items-start gap-3 p-4 transition hover:-translate-y-0.5">
              <span className={`num grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${done.has(l.id) ? "bg-up/15 text-up" : "bg-raised text-mute"}`}>{done.has(l.id) ? "✓" : i + 1}</span>
              <span className="min-w-0">
                <span className="block font-medium leading-snug">{l.title}</span>
                <span className="mt-0.5 block text-xs text-mute">{l.summary}</span>
                <span className="mt-1.5 block text-[11px] text-mute">{l.minutes} min{l.check ? " · quick check" : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[11px] text-mute">{LESSONS.length} lessons written for A+ TradePlay from our knowledgebase (Brad Go “Market Mechanics” lessons, linked in each) and the A+ playbook. Education only — not financial advice. Progress is saved on this device.</p>
    </>
  );
}
