"use client";

import { useEffect, useState } from "react";
import type { RunEvent } from "@/lib/types";
import { Markdown } from "./Markdown";

interface Props {
  run: RunEvent | null;
  /** Live AI delta buffer for this run, if streaming. */
  liveDelta: string;
  onAsk: (runId: string) => Promise<void>;
}

export function AIExplanationPanel({ run, liveDelta, onAsk }: Props) {
  const [askError, setAskError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset collapse / error state when the user looks at a different run.
  useEffect(() => {
    setCollapsed(false);
    setAskError(null);
  }, [run?.id]);

  if (!run) return null;

  // The panel only shows up for failed runs — that's the whole point.
  if (run.status !== "failed") return null;

  const text = liveDelta || run.aiExplanation || "";
  const hasContent = text.length > 0;
  const isStreaming = run.aiStatus === "streaming";
  const isError = run.aiStatus === "error";

  async function ask() {
    if (!run) return;
    setBusy(true);
    setAskError(null);
    try {
      await onAsk(run.id);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-accent/30 bg-gradient-to-br from-accent/[0.04] to-transparent">
      <header className="flex items-center justify-between gap-3 border-b border-accent/20 bg-ink-900/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <SparkleIcon />
          <span className="text-xs font-semibold uppercase tracking-wider text-accent-glow">
            Claude · failure analysis
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] text-ink-500">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent-glow" />
              streaming
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-500 transition hover:bg-ink-700 hover:text-ink-100"
            >
              {collapsed ? "Show" : "Hide"}
            </button>
          )}
          {!isStreaming && (
            <button
              onClick={ask}
              disabled={busy}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white transition hover:bg-accent-glow disabled:opacity-50"
            >
              {busy
                ? "Asking…"
                : hasContent
                ? "Re-ask Claude"
                : "Ask Claude to explain this"}
            </button>
          )}
        </div>
      </header>

      {(askError || isError) && (
        <div className="border-b border-rose-500/20 bg-rose-500/5 px-4 py-2 text-xs text-rose-300">
          {askError ?? run.aiError ?? "Claude failed to respond."}
        </div>
      )}

      {!collapsed && hasContent && (
        <div className="px-4 py-3">
          <Markdown source={text} />
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulseDot bg-accent-glow" />
          )}
        </div>
      )}

      {!hasContent && !isStreaming && !isError && (
        <div className="px-4 py-4 text-xs text-ink-500">
          Click <span className="text-ink-100">Ask Claude to explain this</span> to get a senior-engineer
          read on what failed and how to fix it. Requires <code className="text-ink-100">ANTHROPIC_API_KEY</code>.
        </div>
      )}
    </section>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent-glow" fill="currentColor">
      <path d="M8 0l1.6 4.4L14 6l-4.4 1.6L8 12l-1.6-4.4L2 6l4.4-1.6L8 0z" />
      <path d="M13 10l.6 1.4L15 12l-1.4.6L13 14l-.6-1.4L11 12l1.4-.6L13 10z" />
    </svg>
  );
}
