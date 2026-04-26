export type LogType = "info" | "success" | "error" | "warning";

export interface LogEntry {
  id: string;
  runId: string;
  timestamp: number;
  type: LogType;
  message: string;
}

export type RunStatus = "idle" | "running" | "success" | "failed";

export type AIStatus = "idle" | "streaming" | "done" | "error";

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
  /** Final, persisted Claude explanation. Set when aiStatus transitions to "done". */
  aiExplanation: string | null;
  aiStatus: AIStatus;
  aiError: string | null;
}

/** Per-repo runner config — what commands to run, and where. */
export interface RepoConfig {
  /** Shell commands run in order; the first non-zero exit fails the run. */
  commands: string[];
  /** Absolute path of an existing local checkout. If unset, the runner falls
   *  back to simulation (Phase 2 doesn't ship auto-clone). */
  workspace: string | null;
}

export const DEFAULT_COMMANDS: string[] = [
  "npm ci",
  "npm test",
  "npm run build",
];

/** Server-Sent Event payload shape, broadcast over /api/stream. */
export type StreamMessage =
  | { kind: "log"; entry: LogEntry }
  | { kind: "run"; run: RunEvent }
  | { kind: "status"; status: RunStatus; runId: string | null }
  | { kind: "ai"; runId: string; delta: string }
  | {
      kind: "snapshot";
      runs: RunEvent[];
      logs: LogEntry[];
      status: RunStatus;
      currentRunId: string | null;
      repos: ConnectedRepo[];
    };

export interface ConnectedRepo {
  name: string;
  config: RepoConfig;
}
