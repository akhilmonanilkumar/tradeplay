"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AcademyIllo from "@/components/AcademyIllo";
import { Empty } from "@/components/ui";
import { lessonById, lessonsFor, loadDone, saveDone, SOURCE_URL } from "@/lib/academy";

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const lesson = lessonById(String(id));
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => {
    setDone(loadDone());
    setPick(null);
    window.scrollTo({ top: 0 });
  }, [id]);
  if (!lesson) return <Empty title="Lesson not found"><Link href="/academy" className="text-accent">Back to the Academy</Link></Empty>;

  const list = lessonsFor(lesson.path);
  const idx = list.findIndex((l) => l.id === lesson.id);
  const prev = list[idx - 1];
  const next = list[idx + 1];
  const isDone = done.has(lesson.id);
  const toggle = () => {
    const s = new Set(done);
    if (isDone) s.delete(lesson.id);
    else s.add(lesson.id);
    setDone(s);
    saveDone(s);
  };

  return (
    <article className="mx-auto max-w-3xl">
      <nav className="mb-3 flex items-center gap-2 text-xs text-mute">
        <Link href="/academy" className="hover:text-ink">Academy</Link>
        <span>/</span>
        <span>{lesson.path === "pro" ? "Pro path" : "Beginner path"}</span>
        <span className="num ml-auto">Lesson {idx + 1} of {list.length}</span>
      </nav>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-raised"><div className="h-full bg-chart" style={{ width: `${((idx + 1) / list.length) * 100}%` }} /></div>

      <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{lesson.title}</h1>
      <p className="mt-2 text-[15px] text-mute">{lesson.summary}</p>
      <div className="mx-auto mt-5 max-w-lg overflow-hidden rounded-2xl border border-line"><AcademyIllo name={lesson.illo} /></div>

      <div className="mt-6 space-y-6">
        {lesson.body.map((s) => (
          <section key={s.h}>
            <h2 className="text-lg font-semibold tracking-tight">{s.h}</h2>
            {s.p.map((t, i) => <p key={i} className="mt-2 text-[15px] leading-relaxed">{t}</p>)}
          </section>
        ))}
      </div>

      <section className="coach mt-6 p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-chart">Example · {lesson.example.title}</div>
        {lesson.example.text.map((t, i) => <p key={i} className="mt-2 text-[15px] leading-relaxed">{t}</p>)}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="text-sm font-semibold">Key takeaways</h2>
        <ul className="mt-2 space-y-1.5">
          {lesson.takeaways.map((t) => (
            <li key={t} className="flex gap-2 text-[15px]"><span className="text-up">✓</span>{t}</li>
          ))}
        </ul>
      </section>

      {lesson.check && (
        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold">Quick check</h2>
          <p className="mt-1 text-[15px]">{lesson.check.q}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {lesson.check.options.map((o, i) => {
              const chosen = pick === i;
              const right = i === lesson.check!.answer;
              return (
                <button key={o} disabled={pick != null} onClick={() => setPick(i)} className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${pick == null ? "border-line hover:border-chart/50" : right ? "border-up bg-up/10" : chosen ? "border-down bg-down/10" : "border-line opacity-60"}`}>
                  {o}
                </button>
              );
            })}
          </div>
          {pick != null && <p className={`mt-3 text-sm ${pick === lesson.check.answer ? "text-up" : "text-down"}`}>{pick === lesson.check.answer ? "Correct. " : "Not quite. "}<span className="text-ink">{lesson.check.why}</span></p>}
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-mute">
        <span>Go deeper:</span>
        {lesson.sources.map((n) => SOURCE_URL[n] ? <a key={n} href={SOURCE_URL[n]} target="_blank" rel="noopener noreferrer" className="chip h-7 px-2.5 hover:text-ink">Video {String(n).padStart(2, "0")} ↗</a> : null)}
        <Link href={`/coach?q=${encodeURIComponent(`Explain "${lesson.title}" with an example on my instruments`)}`} className="chip h-7 px-2.5 hover:text-ink">Ask the coach</Link>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {prev ? <Link href={`/academy/${prev.id}`} className="btn-ghost">← {prev.title}</Link> : <Link href="/academy" className="btn-ghost">← All lessons</Link>}
        <button className={isDone ? "btn-ghost" : "btn-primary"} onClick={toggle}>{isDone ? "✓ Completed" : "Mark complete"}</button>
        {next ? <Link href={`/academy/${next.id}`} className="btn-primary" onClick={() => { if (!isDone) { const s = new Set(done); s.add(lesson.id); saveDone(s); } }}>Next: {next.title} →</Link> : <Link href="/academy" className="btn-primary">Finish path →</Link>}
      </div>
    </article>
  );
}
