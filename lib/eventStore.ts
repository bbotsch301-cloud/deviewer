import { EventEmitter } from "node:events";
import { loadState, scheduleSave, type PersistedState } from "./persistence";
import {
  DEFAULT_COMMANDS,
  type AIMessage,
  type AIStatus,
  type CommandTiming,
  type ConnectedRepo,
  type LogEntry,
  type LogType,
  type RepoConfig,
  type RunEvent,
  type RunStatus,
  type StreamMessage,
  type WebhookPayload,
} from "./types";

const MAX_RUNS = 100;
const MAX_LOGS_PER_RUN = 10_000;
const MAX_WEBHOOK_PAYLOADS = 5;

class EventStore {
  private repos = new Map<string, RepoConfig>();
  private runs: RunEvent[] = [];
  private logsByRun = new Map<string, LogEntry[]>();
  private currentRunId: string | null = null;
  private status: RunStatus = "idle";
  private nextRunNumber = 1;
  private lastWebhookAt: number | null = null;
  private recentWebhooks: WebhookPayload[] = [];
  private bus = new EventEmitter();

  constructor() {
    this.bus.setMaxListeners(0);
    this.hydrate();
  }

  private hydrate() {
    const s = loadState();
    for (const [name, config] of s.repos) {
      this.repos.set(name, normalizeConfig(config));
    }
    this.runs = s.runs.slice(0, MAX_RUNS).map(normalizeRun);
    for (const [runId, logs] of s.logsByRun) {
      this.logsByRun.set(runId, logs.slice(-MAX_LOGS_PER_RUN));
    }
    for (const r of this.runs) {
      if (r.status === "running") {
        r.status = "failed";
        r.finishedAt = r.finishedAt ?? Date.now();
      }
    }
    this.nextRunNumber = (this.runs[0]?.number ?? 0) + 1;
    this.lastWebhookAt = s.lastWebhookAt ?? null;
    this.recentWebhooks = (s.recentWebhooks ?? []).slice(0, MAX_WEBHOOK_PAYLOADS);
  }

  private persist() {
    const state: PersistedState = {
      version: 2,
      repos: Array.from(this.repos.entries()),
      runs: this.runs,
      logsByRun: Array.from(this.logsByRun.entries()),
      lastWebhookAt: this.lastWebhookAt,
      recentWebhooks: this.recentWebhooks,
    };
    scheduleSave(state);
  }

  // ---- repos ----
  addRepo(repo: string, config?: Partial<RepoConfig>) {
    const existing = this.repos.get(repo);
    const next = normalizeConfig({ ...(existing ?? {}), ...(config ?? {}) });
    this.repos.set(repo, next);
    this.persist();
  }

  removeRepo(repo: string) {
    this.repos.delete(repo);
    this.persist();
  }

  getRepoConfig(repo: string): RepoConfig | undefined {
    return this.repos.get(repo);
  }

  listRepos(): ConnectedRepo[] {
    return Array.from(this.repos.entries()).map(([name, config]) => ({ name, config }));
  }

  // ---- runs ----
  createRun(input: {
    repo: string;
    branch: string;
    commitSha: string;
    commitMessage: string;
    author: string;
    authorAvatarUrl?: string | null;
    trigger: RunEvent["trigger"];
    commands: string[];
  }): RunEvent {
    const run: RunEvent = {
      id: makeId("run"),
      number: this.nextRunNumber++,
      repo: input.repo,
      branch: input.branch,
      commitSha: input.commitSha,
      commitMessage: input.commitMessage,
      author: input.author,
      authorAvatarUrl: input.authorAvatarUrl ?? avatarFor(input.author),
      trigger: input.trigger,
      status: "running",
      createdAt: Date.now(),
      finishedAt: null,
      previewUrl: null,
      commandTimings: input.commands.map((command) => ({
        command,
        startedAt: 0,
        finishedAt: null,
        exitCode: null,
      })),
      currentCommandIndex: -1,
      aiMessages: [],
      aiStatus: "idle",
      aiError: null,
    };
    this.runs.unshift(run);
    if (this.runs.length > MAX_RUNS) {
      const dropped = this.runs.splice(MAX_RUNS);
      for (const d of dropped) this.logsByRun.delete(d.id);
    }
    this.logsByRun.set(run.id, []);
    this.currentRunId = run.id;
    this.setStatus("running");
    this.broadcast({ kind: "run", run });
    this.persist();
    return run;
  }

  startCommand(runId: string, index: number) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run || !run.commandTimings[index]) return;
    run.currentCommandIndex = index;
    run.commandTimings[index].startedAt = Date.now();
    this.broadcast({ kind: "run", run });
    this.persist();
  }

  finishCommand(runId: string, index: number, exitCode: number) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run || !run.commandTimings[index]) return;
    run.commandTimings[index].finishedAt = Date.now();
    run.commandTimings[index].exitCode = exitCode;
    this.broadcast({ kind: "run", run });
    this.persist();
  }

  finishRun(
    runId: string,
    status: Extract<RunStatus, "success" | "failed">,
    previewUrl: string | null,
  ) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    run.status = status;
    run.finishedAt = Date.now();
    run.previewUrl = previewUrl;
    if (this.currentRunId === runId) this.setStatus(status);
    this.broadcast({ kind: "run", run });
    this.persist();
  }

  getRun(runId: string): RunEvent | undefined {
    return this.runs.find((r) => r.id === runId);
  }

  listRuns(): RunEvent[] {
    return [...this.runs];
  }

  lastRun(): RunEvent | undefined {
    return this.runs[0];
  }

  deleteRun(runId: string) {
    const idx = this.runs.findIndex((r) => r.id === runId);
    if (idx < 0) return;
    this.runs.splice(idx, 1);
    this.logsByRun.delete(runId);
    if (this.currentRunId === runId) this.currentRunId = this.runs[0]?.id ?? null;
    this.broadcast({ kind: "status", status: this.status, runId: this.currentRunId });
    this.persist();
  }

  clearAllRuns() {
    this.runs = [];
    this.logsByRun.clear();
    this.currentRunId = null;
    this.nextRunNumber = 1;
    this.setStatus("idle");
    this.persist();
  }

  // ---- logs ----
  appendLog(runId: string, type: LogType, message: string): LogEntry {
    const entry: LogEntry = {
      id: makeId("log"),
      runId,
      timestamp: Date.now(),
      type,
      message,
    };
    const list = this.logsByRun.get(runId);
    if (list) {
      list.push(entry);
      if (list.length > MAX_LOGS_PER_RUN) {
        list.splice(0, list.length - MAX_LOGS_PER_RUN);
      }
    }
    this.broadcast({ kind: "log", entry });
    this.persist();
    return entry;
  }

  logsFor(runId: string): LogEntry[] {
    return this.logsByRun.get(runId) ?? [];
  }

  // ---- status ----
  setStatus(status: RunStatus) {
    this.status = status;
    this.broadcast({ kind: "status", status, runId: this.currentRunId });
  }

  getStatus(): RunStatus {
    return this.status;
  }

  getCurrentRunId(): string | null {
    return this.currentRunId;
  }

  // ---- AI explanation (multi-turn) ----
  beginAITurn(runId: string, userMessage: string) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    run.aiMessages.push(
      { role: "user", content: userMessage, timestamp: Date.now() },
      { role: "assistant", content: "", timestamp: Date.now() },
    );
    run.aiStatus = "streaming";
    run.aiError = null;
    this.broadcast({ kind: "run", run });
    this.persist();
  }

  appendAIDelta(runId: string, delta: string) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    const last = run.aiMessages[run.aiMessages.length - 1];
    if (!last || last.role !== "assistant") return;
    last.content += delta;
    this.broadcast({ kind: "ai", runId, delta });
  }

  finishAI(runId: string) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    run.aiStatus = "done";
    run.aiError = null;
    this.broadcast({ kind: "run", run });
    this.persist();
  }

  failAI(runId: string, error: string) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    run.aiStatus = "error";
    run.aiError = error;
    this.broadcast({ kind: "run", run });
    this.persist();
  }

  // ---- webhook tracking ----
  recordWebhook(payload: WebhookPayload) {
    this.lastWebhookAt = payload.receivedAt;
    this.recentWebhooks.unshift(payload);
    if (this.recentWebhooks.length > MAX_WEBHOOK_PAYLOADS) {
      this.recentWebhooks.length = MAX_WEBHOOK_PAYLOADS;
    }
    this.broadcast({ kind: "webhook", payload });
    this.persist();
  }

  getWebhookState() {
    return {
      lastWebhookAt: this.lastWebhookAt,
      recentWebhooks: [...this.recentWebhooks],
    };
  }

  // ---- snapshot for new SSE clients ----
  snapshot(): StreamMessage {
    const currentLogs = this.currentRunId ? this.logsFor(this.currentRunId) : [];
    return {
      kind: "snapshot",
      runs: this.listRuns(),
      logs: currentLogs,
      status: this.status,
      currentRunId: this.currentRunId,
      repos: this.listRepos(),
      lastWebhookAt: this.lastWebhookAt,
      recentWebhooks: [...this.recentWebhooks],
    };
  }

  subscribe(listener: (msg: StreamMessage) => void): () => void {
    this.bus.on("msg", listener);
    return () => this.bus.off("msg", listener);
  }

  private broadcast(msg: StreamMessage) {
    this.bus.emit("msg", msg);
  }
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function avatarFor(author: string): string | null {
  if (!author || /\s/.test(author) || author === "unknown" || author === "you") {
    return null;
  }
  return `https://github.com/${encodeURIComponent(author)}.png?size=64`;
}

function normalizeConfig(input: Partial<RepoConfig> | RepoConfig): RepoConfig {
  const commands = Array.isArray(input.commands) && input.commands.length > 0
    ? input.commands.map((c) => String(c).trim()).filter(Boolean)
    : [...DEFAULT_COMMANDS];
  const workspace = typeof input.workspace === "string" && input.workspace.trim()
    ? input.workspace.trim()
    : null;
  const branchFilter = Array.isArray(input.branchFilter)
    ? input.branchFilter.map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  const envVars =
    input.envVars && typeof input.envVars === "object" ? { ...input.envVars } : {};
  return { commands, workspace, branchFilter, envVars };
}

function normalizeRun(r: RunEvent | (Partial<RunEvent> & Record<string, unknown>)): RunEvent {
  const legacy = r as Record<string, unknown>;
  const aiMessages: AIMessage[] = Array.isArray(r.aiMessages)
    ? (r.aiMessages as AIMessage[])
    : typeof legacy.aiExplanation === "string" && legacy.aiExplanation
    ? [
        {
          role: "user",
          content: "Explain why this build failed and how to fix it.",
          timestamp: (r.finishedAt as number) ?? (r.createdAt as number) ?? Date.now(),
        },
        {
          role: "assistant",
          content: legacy.aiExplanation as string,
          timestamp: (r.finishedAt as number) ?? Date.now(),
        },
      ]
    : [];
  const commandTimings: CommandTiming[] = Array.isArray(r.commandTimings)
    ? (r.commandTimings as CommandTiming[])
    : [];
  return {
    id: r.id as string,
    number: typeof r.number === "number" ? r.number : 0,
    repo: r.repo as string,
    branch: r.branch as string,
    commitSha: r.commitSha as string,
    commitMessage: r.commitMessage as string,
    author: r.author as string,
    authorAvatarUrl:
      (r.authorAvatarUrl as string | null | undefined) ?? avatarFor((r.author as string) ?? ""),
    trigger: r.trigger as RunEvent["trigger"],
    status: r.status as RunStatus,
    createdAt: r.createdAt as number,
    finishedAt: (r.finishedAt as number | null) ?? null,
    previewUrl: (r.previewUrl as string | null) ?? null,
    commandTimings,
    currentCommandIndex:
      typeof r.currentCommandIndex === "number" ? r.currentCommandIndex : -1,
    aiMessages,
    aiStatus: ((r.aiStatus as AIStatus) ?? (aiMessages.length ? "done" : "idle")) as AIStatus,
    aiError: (r.aiError as string | null) ?? null,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __deviewerEventStore: EventStore | undefined;
}

export const eventStore: EventStore =
  globalThis.__deviewerEventStore ?? (globalThis.__deviewerEventStore = new EventStore());
