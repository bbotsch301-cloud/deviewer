"use client";

import type { RunEvent } from "@/lib/types";

interface Props {
  runs: RunEvent[];
  currentRunId: string | null;
  onSelect: (runId: string) => void;
}

export function EventList({ runs, currentRunId, onSelect }: Props) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-850/60">
      <header className="flex items-center justify-between border-b border-ink-700 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          Recent events
        </h2>
        <span className="text-[10px] text-ink-500">{runs.length}/10</span>
      </header>

      {runs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-xs text-ink-500">
          Waiting for the first webhook event…
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-ink-700/60 overflow-y-auto">
          {runs.map((run) => {
            const active = run.id === currentRunId;
            return (
              <li key={run.id}>
                <button
                  onClick={() => onSelect(run.id)}
                  className={`block w-full px-4 py-3 text-left transition ${
                    active ? "bg-ink-800" : "hover:bg-ink-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate text-sm text-ink-100">
                      <StatusDot status={run.status} />
                      <span className="truncate font-medium">{run.commitMessage}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-ink-500">
                      {formatRelative(run.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
                    <code className="rounded bg-ink-900 px-1.5 py-0.5 text-ink-100">
                      {run.branch}
                    </code>
                    <span>·</span>
                    <span className="truncate">{run.repo}</span>
                    <span>·</span>
                    <span>{run.author}</span>
                    <span className="ml-auto font-mono">{run.commitSha.slice(0, 7)}</span>
                  </div>
                  {run.previewUrl && (
                    <div className="mt-1.5 truncate text-[11px] text-emerald-300">
                      ↗ {run.previewUrl}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusDot({ status }: { status: RunEvent["status"] }) {
  const cls =
    status === "running"
      ? "bg-yellow-400 animate-pulseDot"
      : status === "success"
      ? "bg-emerald-400"
      : status === "failed"
      ? "bg-rose-500"
      : "bg-ink-500";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
