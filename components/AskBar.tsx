"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VoiceButton from "@/components/Voice";

/** Floating "Ask anything" bar — sends you to the coach with the question. */
export default function AskBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = (text: string) => {
    const v = text.trim();
    if (!v) return;
    setQ("");
    router.push(`/coach?q=${encodeURIComponent(v)}`);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
      className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 md:bottom-5"
    >
      <label className="flex h-[52px] w-full max-w-[560px] items-center gap-2.5 rounded-full border border-chart/30 bg-panel/80 py-1.5 pl-2 pr-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur-xl">
        <span className="ml-1 grid h-7 shrink-0 place-items-center rounded-full bg-chart px-2.5 text-[11px] font-bold text-white">AI</span>
        <span className="sr-only">Ask the coach</span>
        <input
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-mute"
          placeholder="Ask anything — plan, research, a trade…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <VoiceButton size="sm" label="Speak" onInterim={setQ} onText={(t) => go(t)} />
        <button type="submit" disabled={!q.trim()} aria-label="Ask" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-solid text-solid-ink disabled:opacity-40">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </label>
    </form>
  );
}
