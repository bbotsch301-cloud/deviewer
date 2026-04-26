import { cn } from "@/lib/utils";
import type { RunStatus } from "@/lib/types";

const COLOR: Record<RunStatus, string> = {
  idle: "bg-muted-foreground/60",
  running: "bg-warning animate-pulse-dot",
  success: "bg-success",
  failed: "bg-destructive",
};

export function StatusDot({
  status,
  size = "sm",
  className,
}: {
  status: RunStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = size === "lg" ? "h-2.5 w-2.5" : size === "md" ? "h-2 w-2" : "h-1.5 w-1.5";
  return (
    <span className={cn("relative inline-flex", dim, className)}>
      {status === "running" && (
        <span className={cn("absolute inset-0 rounded-full bg-warning/40 animate-ping", dim)} />
      )}
      <span className={cn("relative inline-flex rounded-full", dim, COLOR[status])} />
    </span>
  );
}
