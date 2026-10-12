"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/Shell";
import { applyAction, describeAction } from "@/lib/coach";
import type { CoachAction } from "@/lib/types";

/* ---------- tiny, safe markdown (no HTML injection: builds React elements) ---------- */

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\)|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="num rounded bg-raised px-1 py-0.5 text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(t)!;
      out.push(<a key={k} href={mm[2]} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{mm[1]}</a>);
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? "ol" : "ul";
    blocks.push(
      <L key={`l${blocks.length}`} className={`${list.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
        {list.items.map((it, i) => <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>)}
      </L>,
    );
    list = null;
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) blocks.push(<div key={idx} className="mt-1 font-semibold">{inline(h[2], `h${idx}`)}</div>);
    else blocks.push(<p key={idx}>{inline(line, `p${idx}`)}</p>);
  });
  flush();
  return <div className={`space-y-2 leading-relaxed ${className}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}

/* ---------- proposed actions ---------- */

export function ActionChips({ actions }: { actions?: CoachAction[] }) {
  const { accounts, refresh } = useData();
  const router = useRouter();
  const [state, setState] = useState<Record<number, "busy" | "done" | string>>({});
  if (!actions?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.slice(0, 6).map((a, i) => {
        const s = state[i];
        return (
          <button
            key={i}
            disabled={s === "busy" || s === "done"}
            onClick={async () => {
              setState((x) => ({ ...x, [i]: "busy" }));
              const err = await applyAction(a, accounts, (h) => router.push(h));
              setState((x) => ({ ...x, [i]: err ?? "done" }));
              if (!err) refresh();
            }}
            className={`max-w-full truncate rounded-full border px-3 py-1.5 text-left text-xs transition ${s === "done" ? "border-up/40 text-up" : "border-line hover:border-accent/60 hover:text-ink"} ${typeof s === "string" && s !== "busy" && s !== "done" ? "border-down/40 text-down" : ""}`}
            title={typeof s === "string" && s !== "busy" && s !== "done" ? s : describeAction(a)}
          >
            {s === "done" ? "✓ " : s === "busy" ? "… " : "+ "}
            {describeAction(a)}
          </button>
        );
      })}
    </div>
  );
}

export function CoachSetupNote({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`text-sm text-mute ${compact ? "" : "mt-2"}`}>
      The coach needs an AI provider. Add one key (Anthropic, OpenAI, Gemini or any OpenAI-compatible endpoint) in the server
      environment — see <span className="text-ink">docs/ai-coach.md</span>. Everything else on this page still works without it.
    </p>
  );
}

export function Sparkle({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
    </svg>
  );
}
