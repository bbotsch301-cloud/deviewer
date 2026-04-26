import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/status-dot";
import type { RunStatus } from "@/lib/types";

const LABEL: Record<RunStatus, string> = {
  idle: "Idle",
  running: "Running",
  success: "Passed",
  failed: "Failed",
};

const VARIANT: Record<RunStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  idle: "secondary",
  running: "warning",
  success: "success",
  failed: "destructive",
};

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <Badge variant={VARIANT[status]} className="gap-1.5 px-2 py-0.5">
      <StatusDot status={status} />
      {LABEL[status]}
    </Badge>
  );
}
