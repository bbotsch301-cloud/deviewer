export type LogType = "info" | "success" | "error" | "warning";

export interface LogEntry {
  id: string;
  runId: string;
  timestamp: number;
  type: LogType;
  message: string;
}

export type RunStatus = "idle" | "running" | "success" | "failed";

export interface RunEvent {
  id: string;
  repo: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  trigger: "push" | "pull_request" | "manual";
  status: RunStatus;
  createdAt: number;
  finishedAt: number | null;
  previewUrl: string | null;
}

/** Server-Sent Event payload shape, broadcast over /api/stream. */
export type StreamMessage =
  | { kind: "log"; entry: LogEntry }
  | { kind: "run"; run: RunEvent }
  | { kind: "status"; status: RunStatus; runId: string | null }
  | { kind: "snapshot"; runs: RunEvent[]; logs: LogEntry[]; status: RunStatus; currentRunId: string | null; repos: string[] };
