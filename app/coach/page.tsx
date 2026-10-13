"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/Shell";
import { Badge, Segmented } from "@/components/ui";
import VoiceButton from "@/components/Voice";
import { ActionChips, CoachSetupNote, Markdown, Sparkle } from "@/components/coach-ui";
import { askCoach, preferredModel, setPreferredModel, useCoachStatus } from "@/lib/coach";
import { supabase } from "@/lib/supabase";
import { PLAYBOOK } from "@/lib/ai/playbook";
import MigrationNotice from "@/components/MigrationNotice";
import EnginePanel from "@/components/EnginePanel";
import type { CoachAction, Lesson, Memory, Message, Thread } from "@/lib/types";

type Msg = Pick<Message, "role" | "content"> & { actions?: CoachAction[]; pending?: boolean; error?: boolean };

const STARTERS = [
  "Build my gold plan for today from the playbook — what should I mark?",
  "Why do I keep losing on BTC in the New York session?",
  "What's my costliest habit this month and one rule to fix it?",
  "Remind me 20 minutes before every high-impact USD event today",
];

export default function CoachPage() {
  const { coachDb } = useData();
  const status = useCoachStatus();
  const [side, setSide] = useState<"threads" | "memory" | "knowledge" | "lessons" | "engine">("threads");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadsKey, setThreadsKey] = useState(0);
  const [panel, setPanel] = useState(false);

  if (!coachDb) return <MigrationNotice />;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="card hidden max-h-[calc(100vh-7rem)] min-h-0 flex-col overflow-hidden p-3 lg:sticky lg:top-4 lg:flex">
        <Segmented
          size="xs"
          value={side}
          onChange={setSide}
          options={[{ value: "threads", label: "Chats" }, { value: "memory", label: "Memory" }, { value: "knowledge", label: "Knowledge" }, { value: "lessons", label: "Lessons" }, { value: "engine", label: "Engine" }]}
        />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {side === "threads" && <Threads key={threadsKey} current={threadId} onPick={setThreadId} />}
          {side === "memory" && <MemoryPanel />}
          {side === "knowledge" && <KnowledgePanel />}
          {side === "lessons" && <LessonsPanel />}
          {side === "engine" && <EnginePanel />}
        </div>
      </aside>
      {panel && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setPanel(false)}>
          <div className="sheet-in flex max-h-[85dvh] w-full flex-col rounded-t-[26px] bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        <Segmented
          size="xs"
          value={side}
          onChange={setSide}
          options={[{ value: "threads", label: "Chats" }, { value: "memory", label: "Memory" }, { value: "knowledge", label: "Knowledge" }, { value: "lessons", label: "Lessons" }, { value: "engine", label: "Engine" }]}
        />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {side === "threads" && <Threads key={threadsKey} current={threadId} onPick={(id) => { setThreadId(id); setPanel(false); }} />}
          {side === "memory" && <MemoryPanel />}
          {side === "knowledge" && <KnowledgePanel />}
          {side === "lessons" && <LessonsPanel />}
          {side === "engine" && <EnginePanel />}
        </div>
                </div>
        </div>
      )}
      <Chat
        key={threadId ?? "new"}
        threadId={threadId}
        status={status}
        onPanel={() => setPanel(true)}
        onThread={(id) => {
          setThreadId(id);
          setThreadsKey((k) => k + 1);
        }}
      />
    </div>
  );
}

/* ---------------- chat ---------------- */

function Chat({ threadId, status, onThread, onPanel }: { threadId: string | null; status: ReturnType<typeof useCoachStatus>; onThread: (id: string) => void; onPanel: () => void }) {
  const params = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [research, setResearch] = useState(false);
  const [model, setModel] = useState<string | undefined>(undefined);
  const bottom = useRef<HTMLDivElement>(null);
  const kicked = useRef(false);
  const tid = useRef<string | null>(threadId);

  useEffect(() => {
    setModel(preferredModel());
    const on = (e: Event) => setModel((e as CustomEvent<string>).detail);
    window.addEventListener("aplus:model", on);
    return () => window.removeEventListener("aplus:model", on);
  }, []);
  useEffect(() => {
    if (!threadId) return;
    supabase
      .from("ai_messages")
      .select("role, content, meta")
      .eq("thread_id", threadId)
      .order("created_at")
      .then(({ data }) => setMsgs((data ?? []).map((m) => ({ role: m.role, content: m.content, actions: (m.meta as { actions?: CoachAction[] })?.actions }))));
  }, [threadId]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setDraft("");
      setBusy(true);
      setMsgs((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "", pending: true }]);
      const r = await askCoach("chat", { message, thread_id: tid.current, research });
      setBusy(false);
      setMsgs((m) => [
        ...m.slice(0, -1),
        r.error ? { role: "assistant", content: r.error, error: true } : { role: "assistant", content: String(r.reply ?? ""), actions: r.actions },
      ]);
      if (r.thread_id && r.thread_id !== tid.current) {
        tid.current = r.thread_id;
        onThread(r.thread_id);
      }
    },
    [busy, research, onThread],
  );

  const brief = useCallback(async () => {
    setBusy(true);
    setMsgs((m) => [...m, { role: "assistant", content: "", pending: true }]);
    const r = await askCoach("brief", { refresh: true });
    setBusy(false);
    setMsgs((m) => [...m.slice(0, -1), r.error ? { role: "assistant", content: r.error, error: true } : { role: "assistant", content: String(r.reply ?? ""), actions: r.actions }]);
  }, []);

  useEffect(() => {
    if (kicked.current || !status?.enabled || threadId) return;
    const q = params.get("q");
    const task = params.get("task");
    if (q) {
      kicked.current = true;
      send(q);
    } else if (task === "brief") {
      kicked.current = true;
      brief();
    }
  }, [params, status, send, brief, threadId]);

  return (
    <section className="card flex min-h-[calc(100dvh-12rem)] flex-col lg:min-h-[calc(100vh-7rem)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 font-medium">
          <button onClick={onPanel} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-mute lg:hidden" aria-label="Chats, memory, knowledge and lessons">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h10" /></svg>
          </button>
          <Sparkle className="h-4 w-4 text-chart" /> Coach
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status?.webSearch && (
            <label className="flex items-center gap-1.5 text-xs text-mute">
              <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} className="accent-[rgb(var(--accent))]" />
              Web research
            </label>
          )}
          {status?.models && (status.models.length > 1 || (model && !status.models.some((m) => m.id === model))) && (
            <select
              className="input h-8 min-h-0 w-auto py-0 text-xs"
              value={model ?? status.models[0].id}
              onChange={(e) => {
                setModel(e.target.value);
                setPreferredModel(e.target.value);
              }}
              aria-label="Model"
            >
              {model && !status.models.some((m) => m.id === model) && <option value={model}>{model.replace(/^openrouter:/, "")} · openrouter</option>}
              {status.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}
          {status?.models?.length === 1 && (!model || model === status.models[0].id) && <Badge>{status.models[0].label}</Badge>}
        </div>
      </header>

      <div className="flex-1 space-y-5 px-4 py-5 sm:px-6 lg:overflow-y-auto">
        {status && !status.enabled && <CoachSetupNote />}
        {msgs.length === 0 && status?.enabled && (
          <div className="mx-auto max-w-xl py-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-chart/15 text-chart"><Sparkle className="h-6 w-6" /></div>
            <h2 className="mt-4 text-lg font-semibold">Plan, research, reflect</h2>
            <p className="mt-1 text-sm text-mute">The coach sees your accounts, guardrails, plans, trades, lessons, memory and knowledgebase. It proposes; you apply.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button key={s} className="rounded-xl border border-line px-3 py-2.5 text-left text-sm text-mute hover:border-accent/50 hover:text-ink" onClick={() => send(s)}>{s}</button>
              ))}
              <button className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-left text-sm sm:col-span-2" onClick={brief}>Give me today's morning brief</button>
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-raised px-4 py-2.5 text-[15px]">{m.content}</div>
          ) : (
            <div key={i} className="max-w-[92%] text-[15px]">
              {m.pending ? (
                <span className="inline-flex items-center gap-2 text-sm text-mute"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Thinking…</span>
              ) : m.error ? (
                <p className="text-sm text-down">{m.content}</p>
              ) : (
                <>
                  <Markdown text={m.content} />
                  <ActionChips actions={m.actions} />
                </>
              )}
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-[calc(5.2rem+env(safe-area-inset-bottom))] rounded-b-[22px] border-t border-line bg-panel p-3 sm:p-4 lg:static"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-bg p-2 focus-within:border-accent/60">
          <label className="sr-only" htmlFor="coach-input">Message the coach</label>
          <textarea
            id="coach-input"
            rows={2}
            className="max-h-48 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-mute"
            placeholder={status?.enabled ? "Plan, research, or ask about a trade…" : "Coach is not configured yet"}
            value={draft}
            disabled={!status?.enabled}
            onChange={(e) => setDraft(e.target.value)}
            enterKeyHint="send"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                send(draft);
              }
            }}
          />
          <VoiceButton size="sm" label="Speak" onInterim={(t) => setDraft(t)} onText={(t) => setDraft(t)} />
          <button type="submit" className="btn-primary h-10 min-h-0 px-3" disabled={busy || !draft.trim() || !status?.enabled} aria-label="Send">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---------------- side panels ---------------- */

function Threads({ current, onPick }: { current: string | null; onPick: (id: string | null) => void }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const load = useCallback(() => {
    supabase.from("ai_threads").select("*").order("updated_at", { ascending: false }).limit(100).then(({ data }) => setThreads((data ?? []) as Thread[]));
  }, []);
  useEffect(load, [load]);
  return (
    <div>
      <button className="btn-ghost mb-2 w-full" onClick={() => onPick(null)}>+ New conversation</button>
      <ul className="space-y-0.5">
        {threads.map((t) => (
          <li key={t.id} className={`group flex items-center gap-1 rounded-lg ${current === t.id ? "bg-raised" : "hover:bg-raised/60"}`}>
            <button className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm" onClick={() => onPick(t.id)}>{t.title}</button>
            <button
              className="px-2 text-xs text-mute opacity-0 hover:text-down group-hover:opacity-100"
              aria-label="Delete conversation"
              onClick={async () => {
                if (!confirm("Delete this conversation?")) return;
                await supabase.from("ai_threads").delete().eq("id", t.id);
                if (current === t.id) onPick(null);
                load();
              }}
            >✕</button>
          </li>
        ))}
        {threads.length === 0 && <li className="px-2 py-3 text-sm text-mute">No conversations yet.</li>}
      </ul>
    </div>
  );
}

function MemoryPanel() {
  const { memory, refresh } = useData();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Memory["kind"]>("fact");
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-mute">What the coach always knows about you. It can propose additions; you decide.</p>
      <div className="space-y-2">
        <textarea className="input min-h-16" placeholder="e.g. I trade best after a 20-minute walk; never trade after 22:00 IST" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
        <div className="flex gap-2">
          <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value as Memory["kind"])}>
            {["fact", "preference", "goal", "rule"].map((k) => <option key={k}>{k}</option>)}
          </select>
          <button
            className="btn-primary flex-1"
            disabled={!text.trim()}
            onClick={async () => {
              await supabase.from("ai_memory").insert({ content: text.trim(), kind });
              setText("");
              refresh();
            }}
          >Remember</button>
        </div>
      </div>
      <ul className="space-y-1.5">
        {memory.map((m) => (
          <li key={m.id} className="group rounded-lg border border-line px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <span>{m.content}</span>
              <button className="text-xs text-mute opacity-60 hover:text-down group-hover:opacity-100" onClick={async () => { await supabase.from("ai_memory").delete().eq("id", m.id); refresh(); }} aria-label="Forget">✕</button>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-mute">
              <Badge>{m.kind}</Badge>
              <button className={m.pinned ? "text-accent" : "hover:text-ink"} onClick={async () => { await supabase.from("ai_memory").update({ pinned: !m.pinned }).eq("id", m.id); refresh(); }}>{m.pinned ? "★ pinned" : "☆ pin"}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type DocRow = { title: string; source: string | null; chunks: number; created_at: string };

function chunkText(text: string, size = 3500): string[] {
  const paras = text.replace(/\r/g, "").split(/\n{2,}/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > size && cur) {
      out.push(cur);
      cur = "";
    }
    if (p.length > size) {
      for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size));
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function KnowledgePanel() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("kb_docs").select("title, source, chunk, created_at").order("title").limit(5000);
    const map = new Map<string, DocRow>();
    for (const r of data ?? []) {
      const d = map.get(r.title) ?? { title: r.title, source: r.source, chunks: 0, created_at: r.created_at };
      d.chunks++;
      map.set(r.title, d);
    }
    setDocs([...map.values()]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add(t: string, text: string, source: string | null) {
    const chunks = chunkText(text);
    await supabase.from("kb_docs").delete().eq("title", t.slice(0, 200));
    for (let i = 0; i < chunks.length; i += 50) {
      const rows = chunks.slice(i, i + 50).map((c, j) => ({ title: t.slice(0, 200), source, chunk: i + j, content: c }));
      const { error } = await supabase.from("kb_docs").insert(rows);
      if (error) throw error;
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-mute">Your documents the coach searches (full-text) on every question: playbook, transcripts, notes.</p>
      <div className="flex flex-wrap gap-2">
        <label className="btn-ghost cursor-pointer">
          Upload .md / .txt
          <input
            type="file"
            accept=".md,.txt,.markdown,text/plain,text/markdown"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])].slice(0, 100);
              e.target.value = "";
              for (const [i, f] of files.entries()) {
                if (f.size > 2_000_000) continue;
                setBusy(`Adding ${i + 1}/${files.length}: ${f.name}`);
                const text = await f.text();
                const t = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() || f.name.replace(/\.(md|txt|markdown)$/i, "");
                try { await add(t, text, f.name); } catch (err) { setBusy(`Failed on ${f.name}: ${(err as Error).message}`); return; }
              }
              setBusy(null);
              load();
            }}
          />
        </label>
        {!docs.some((d) => d.title === "A+ Playbook (built-in)") && (
          <button className="btn-ghost" onClick={async () => { setBusy("Adding playbook…"); await add("A+ Playbook (built-in)", PLAYBOOK, "built-in"); setBusy(null); load(); }}>Add built-in playbook</button>
        )}
      </div>
      <details className="rounded-lg border border-line p-2">
        <summary className="text-xs text-mute">Paste a note</summary>
        <input className="input mt-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <textarea className="input mt-2 min-h-24" placeholder="Text" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn-primary mt-2 w-full" disabled={!title.trim() || !body.trim()} onClick={async () => { setBusy("Saving…"); await add(title.trim(), body, "note"); setTitle(""); setBody(""); setBusy(null); load(); }}>Save to knowledgebase</button>
      </details>
      {busy && <p className="text-xs text-accent">{busy}</p>}
      <ul className="space-y-1">
        {docs.map((d) => (
          <li key={d.title} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-raised">
            <span className="min-w-0 truncate">{d.title}</span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] text-mute">
              {d.chunks}×
              <button className="opacity-60 hover:text-down group-hover:opacity-100" aria-label={`Remove ${d.title}`} onClick={async () => { if (!confirm(`Remove “${d.title}” from the knowledgebase?`)) return; await supabase.from("kb_docs").delete().eq("title", d.title); load(); }}>✕</button>
            </span>
          </li>
        ))}
        {docs.length === 0 && <li className="px-2 py-2 text-mute">Empty. Add the playbook and your Market Mechanics transcripts.</li>}
      </ul>
    </div>
  );
}

function LessonsPanel() {
  const { lessons, refresh } = useData();
  const [title, setTitle] = useState("");
  const [rule, setRule] = useState("");
  const active = lessons.filter((l) => l.active);
  const archived = lessons.filter((l) => !l.active);
  const row = (l: Lesson) => (
    <li key={l.id} className={`rounded-lg border border-line px-3 py-2 ${l.active ? "" : "opacity-60"}`}>
      <div className="font-medium">{l.title}</div>
      {l.rule && <div className="mt-0.5 text-xs text-mute">→ {l.rule}</div>}
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-mute">
        <Badge tone={l.kind === "win" ? "up" : l.kind === "loss" ? "down" : "accent"}>{l.kind}</Badge>
        <span>{l.source}</span>
        <button className="hover:text-ink" onClick={async () => { await supabase.from("lessons").update({ active: !l.active }).eq("id", l.id); refresh(); }}>{l.active ? "Archive" : "Restore"}</button>
        <button className="hover:text-down" onClick={async () => { if (!confirm("Delete lesson?")) return; await supabase.from("lessons").delete().eq("id", l.id); refresh(); }}>Delete</button>
      </div>
    </li>
  );
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-mute">Rules learned from wins and losses. Active ones are shown before every trade.</p>
      <input className="input" placeholder="What happened (e.g. entered before the 5m close)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      <input className="input" placeholder="Rule (e.g. wait for the body close)" value={rule} onChange={(e) => setRule(e.target.value)} maxLength={500} />
      <button className="btn-primary w-full" disabled={!title.trim()} onClick={async () => { await supabase.from("lessons").insert({ title: title.trim(), rule: rule.trim() || null, kind: "rule", source: "manual" }); setTitle(""); setRule(""); refresh(); }}>Add lesson</button>
      <ul className="space-y-1.5">{active.map(row)}</ul>
      {archived.length > 0 && <details><summary className="text-xs text-mute">Archived ({archived.length})</summary><ul className="mt-2 space-y-1.5">{archived.map(row)}</ul></details>}
    </div>
  );
}
