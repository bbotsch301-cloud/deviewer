import type { RunStatus } from "@/lib/types";

const STYLES: Record<RunStatus, { dot: string; text: string; label: string; ring: string }> = {
  idle: {
    dot: "bg-ink-500",
    ring: "ring-ink-700",
    text: "text-ink-500",
    label: "Idle",
  },
  running: {
    dot: "bg-yellow-400 animate-pulseDot",
    ring: "ring-yellow-400/30",
    text: "text-yellow-300",
    label: "Running",
  },
  success: {
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
    text: "text-emerald-300",
    label: "Passed",
  },
  failed: {
    dot: "bg-rose-500",
    ring: "ring-rose-500/30",
    text: "text-rose-300",
    label: "Failed",
  },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-ink-900/70 px-3 py-1 text-xs font-medium ring-1 ${s.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className={s.text}>{s.label}</span>
    </span>
  );
}
