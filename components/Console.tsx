"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, LogType, RunStatus } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

const LOG_STYLES: Record<LogType, string> = {
  info: "text-ink-100",
  success: "text-emerald-300",
  error: "text-rose-300",
  warning: "text-yellow-300",
};

const FILTERS: { key: LogType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "info", label: "Info" },
  { key: "success", label: "Pass" },
  { key: "warning", label: "Warn" },
  { key: "error", label: "Error" },
];

interface Props {
  logs: LogEntry[];
  status: RunStatus;
  onRerun: () => Promise<void>;
}

export function Console({ logs, status, onRerun }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState<LogType | "all">("all");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => (filter === "all" ? logs : logs.filter((l) => l.type === filter)),
    [logs, filter],
  );

  useEffect(() => {
    if (!follow) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered, follow]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setFollow(atBottom);
  }

  async function handleRerun() {
    setBusy(true);
    try {
      await onRerun();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-950 shadow-[0_30px_80px_-40px_rgba(124,92,255,0.4)]">
      <header className="flex items-center justify-between border-b border-ink-700 bg-ink-900/80 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="text-xs font-medium text-ink-500">deviewer › live console</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            onClick={handleRerun}
            disabled={busy || status === "running"}
            className="rounded-md border border-ink-700 bg-ink-800 px-3 py-1 text-xs font-medium text-ink-100 transition hover:border-accent hover:text-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
            title="Re-run last event"
          >
            {status === "running" ? "Running…" : "Re-run"}
          </button>
        </div>
      </header>

      <div className="flex items-center gap-1 border-b border-ink-700 bg-ink-900/50 px-3 py-1.5 text-xs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded px-2 py-0.5 transition ${
              filter === f.key
                ? "bg-ink-700 text-ink-100"
                : "text-ink-500 hover:text-ink-100"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-ink-500">{filtered.length} lines</span>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto bg-ink-950 px-4 py-3 font-mono text-[12.5px] leading-relaxed"
      >
        {filtered.length === 0 ? (
          <EmptyState status={status} />
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className="flex gap-3 animate-slideIn">
              <span className="shrink-0 select-none text-ink-500">
                {formatTs(entry.timestamp)}
              </span>
              <span className={`whitespace-pre-wrap break-words ${LOG_STYLES[entry.type]}`}>
                {entry.message || " "}
              </span>
            </div>
          ))
        )}
      </div>

      {!follow && (
        <button
          onClick={() => {
            setFollow(true);
            const el = scrollerRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          className="absolute bottom-4 right-6 rounded-full bg-accent px-3 py-1 text-xs text-white shadow-lg"
        >
          ↓ Resume tail
        </button>
      )}
    </section>
  );
}

function EmptyState({ status }: { status: RunStatus }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-ink-500">
      <span className="text-3xl">⌁</span>
      <p className="text-sm">
        {status === "running"
          ? "Pipeline starting…"
          : "Push to a connected repo, or hit Re-run, to see logs stream here."}
      </p>
    </div>
  );
}

function formatTs(ms: number): string {
  const d = new Date(ms);
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0")
  );
}
