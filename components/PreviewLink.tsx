import type { RunEvent } from "@/lib/types";

export function PreviewLink({ run }: { run: RunEvent | null }) {
  if (!run || run.status !== "success" || !run.previewUrl) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
          Preview ready
        </p>
        <a
          href={run.previewUrl}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm text-ink-100 underline-offset-2 hover:underline"
        >
          {run.previewUrl}
        </a>
      </div>
      <span className="shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
        {run.commitSha.slice(0, 7)}
      </span>
    </div>
  );
}
