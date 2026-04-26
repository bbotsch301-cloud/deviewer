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

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface CommandTiming {
  command: string;
  startedAt: number;
  finishedAt: number | null;
  exitCode: number | null;
}

export interface RunEvent {
  id: string;
  /** Auto-incremented per-installation run number, displayed as `#N`. */
  number: number;
  repo: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  /** GitHub username if known, free-form name otherwise. Powers avatar lookup. */
  author: string;
  authorAvatarUrl: string | null;
  trigger: "push" | "pull_request" | "manual";
  status: RunStatus;
  createdAt: number;
  finishedAt: number | null;
  previewUrl: string | null;
  commandTimings: CommandTiming[];
  /** Index into `commandTimings` of the currently-executing command. */
  currentCommandIndex: number;
  aiMessages: AIMessage[];
  aiStatus: AIStatus;
  aiError: string | null;
}

/** Per-repo runner config. */
export interface RepoConfig {
  commands: string[];
  workspace: string | null;
  /** Empty array means "all branches". */
  branchFilter: string[];
  /** Injected into every spawned command's environment. */
  envVars: Record<string, string>;
}

export const DEFAULT_COMMANDS: string[] = [
  "npm ci",
  "npm test",
  "npm run build",
];

export interface ConnectedRepo {
  name: string;
  config: RepoConfig;
}

export interface WebhookPayload {
  receivedAt: number;
  event: string;
  body: unknown;
}

export type StreamMessage =
  | { kind: "log"; entry: LogEntry }
  | { kind: "run"; run: RunEvent }
  | { kind: "status"; status: RunStatus; runId: string | null }
  | { kind: "ai"; runId: string; delta: string }
  | { kind: "webhook"; payload: WebhookPayload }
  | {
      kind: "snapshot";
      runs: RunEvent[];
      logs: LogEntry[];
      status: RunStatus;
      currentRunId: string | null;
      repos: ConnectedRepo[];
      lastWebhookAt: number | null;
      recentWebhooks: WebhookPayload[];
    };
