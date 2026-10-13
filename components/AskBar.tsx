"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import VoiceButton from "@/components/Voice";

const QUICK = ["Build my gold plan for today", "What's my biggest leak this month?", "Should I trade the CPI day?", "Give me today's morning brief"];

/**
 * Ask the coach from anywhere.
 * Desktop: floating glass bar. Phone: a small AI button above the nav that opens a bottom sheet,
 * so nothing covers the page while you scroll.
 */
export default function AskBar({ hideOnPhone = false }: { hideOnPhone?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const go = (text: string) => {
    const v = text.trim();
    if (!v) return;
    setQ("");
    setOpen(false);
    router.push(`/coach?q=${encodeURIComponent(v)}`);
  };
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 60);
  }, [open]);
  // Phone FAB tucks away while you scroll down and returns when you scroll up.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setTucked(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const field = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
      className="flex h-[52px] w-full items-center gap-2.5 rounded-full border border-chart/30 bg-panel/85 py-1.5 pl-2 pr-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur-xl"
    >
      <span className="ml-1 grid h-7 shrink-0 place-items-center rounded-full bg-chart px-2.5 text-[11px] font-bold text-white">AI</span>
      <label className="sr-only" htmlFor="ask-input">Ask the coach</label>
      <input
        id="ask-input"
        ref={input}
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-mute"
        placeholder="Ask anything — plan, research, a trade…"
        enterKeyHint="send"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <VoiceButton size="sm" label="Speak" onInterim={setQ} onText={(t) => go(t)} />
      <button type="submit" disabled={!q.trim()} aria-label="Ask" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-solid text-solid-ink disabled:opacity-40">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </form>
  );

  return (
    <>
      {/* Desktop / tablet */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 hidden justify-center px-4 md:flex">
        <div className="pointer-events-auto w-full max-w-[560px]">{field}</div>
      </div>

      {/* Phone: floating button + sheet */}
      {!hideOnPhone && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask the coach"
          className={`fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom))] right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-chart text-white shadow-[0_10px_30px_rgb(139_92_246/0.45)] transition duration-300 active:scale-95 md:hidden ${tucked ? "pointer-events-none translate-y-6 scale-75 opacity-0" : ""}`}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
          </svg>
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)}>
          <div className="sheet-in w-full rounded-t-[26px] bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
            <div className="mb-3 text-sm font-semibold">Ask the coach</div>
            {field}
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
              {QUICK.map((s) => (
                <button key={s} onClick={() => go(s)} className="shrink-0 rounded-full bg-raised px-3.5 py-2 text-xs text-mute active:text-ink">{s}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
