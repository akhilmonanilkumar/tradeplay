"use client";

import { useEffect, useRef, useState } from "react";
import { authedFetch, useCoachStatus } from "@/lib/coach";

/* Minimal typing for the Web Speech API (not in lib.dom for all TS versions). */
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function speechCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Mic button. Live dictation with the browser's speech engine (Chrome/Edge/Safari); falls back to recording
 * and server-side transcription when the browser has none and a speech-to-text provider is configured.
 * onText receives the full transcript when you stop; onInterim streams partial text while speaking.
 */
export default function VoiceButton({
  onText,
  onInterim,
  label = "Dictate",
  size = "md",
  autoStart = false,
  lang = "en-IN",
}: {
  onText: (text: string) => void;
  onInterim?: (text: string) => void;
  label?: string;
  size?: "sm" | "md";
  autoStart?: boolean;
  lang?: string;
}) {
  const status = useCoachStatus();
  const [state, setState] = useState<"idle" | "listening" | "transcribing" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const text = useRef("");
  const started = useRef(false);

  const supported = !!speechCtor() || (typeof MediaRecorder !== "undefined" && !!status?.stt);

  function startSpeech() {
    const Ctor = speechCtor()!;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    text.current = "";
    r.onresult = (e) => {
      let finalT = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalT += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      text.current = finalT.trim();
      onInterim?.(`${finalT}${interim}`.trim());
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setErr(e.error === "not-allowed" ? "Microphone permission denied" : `Speech error: ${e.error}`);
      setState("error");
    };
    r.onend = () => {
      setState((s) => (s === "error" ? s : "idle"));
      if (text.current) onText(text.current);
    };
    rec.current = r;
    r.start();
    setState("listening");
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setState("transcribing");
      const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "speech");
      const r = await authedFetch("/api/ai/transcribe", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.text) {
        setErr(j.error ?? "Transcription failed");
        setState("error");
        return;
      }
      onText(String(j.text));
      setState("idle");
    };
    media.current = mr;
    mr.start();
    setState("listening");
  }

  async function toggle() {
    setErr(null);
    if (state === "listening") {
      rec.current?.stop();
      if (media.current?.state === "recording") media.current.stop();
      return;
    }
    try {
      if (speechCtor()) startSpeech();
      else await startRecording();
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }

  useEffect(() => {
    if (autoStart && supported && !started.current) {
      started.current = true;
      toggle();
    }
    return () => {
      rec.current?.abort();
      if (media.current?.state === "recording") media.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, supported]);

  if (!supported) return null;
  const listening = state === "listening";
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={state === "transcribing"}
        className={`inline-flex items-center gap-2 rounded-full border transition ${size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm"} ${listening ? "recording border-down bg-down/10 text-down" : "border-accent/40 bg-accent/10 text-ink hover:border-accent"}`}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : label}
      >
        <svg viewBox="0 0 24 24" className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          {listening ? <rect x="7" y="7" width="10" height="10" rx="2" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
        </svg>
        {state === "transcribing" ? "Transcribing…" : listening ? "Stop" : label}
      </button>
      {err && <span className="mt-1 text-xs text-down">{err}</span>}
    </span>
  );
}
