import { EventEmitter } from "node:events";
import { loadState, scheduleSave, type PersistedState } from "./persistence";
import {
  DEFAULT_COMMANDS,
  type AIStatus,
  type ConnectedRepo,
  type LogEntry,
  type LogType,
  type RepoConfig,
  type RunEvent,
  type RunStatus,
  type StreamMessage,
} from "./types";

const MAX_RUNS = 20;
const MAX_LOGS_PER_RUN = 1000;

/**
 * Process-wide singleton holding the live state of the system.
 *
 * - Persists repos + runs + logs to a JSON file on disk (debounced).
 * - Survives Next.js HMR reloads in dev by stashing on `globalThis`.
 * - Broadcasts every mutation through an EventEmitter for SSE subscribers.
 */
class EventStore {
  private repos = new Map<string, RepoConfig>();
  private runs: RunEvent[] = [];
  private logsByRun = new Map<string, LogEntry[]>();
  private currentRunId: string | null = null;
  private status: RunStatus = "idle";
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
    // We never resume an in-flight pipeline after restart — the spawned
    // process is gone. Demote any stale "running" runs to "failed".
    for (const r of this.runs) {
      if (r.status === "running") {
        r.status = "failed";
        r.finishedAt = r.finishedAt ?? Date.now();
      }
    }
  }

  private persist() {
    const state: PersistedState = {
      version: 1,
      repos: Array.from(this.repos.entries()),
      runs: this.runs,
      logsByRun: Array.from(this.logsByRun.entries()),
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
  createRun(input: Omit<RunEvent, "id" | "status" | "createdAt" | "finishedAt" | "previewUrl" | "aiExplanation" | "aiStatus" | "aiError">): RunEvent {
    const run: RunEvent = {
      ...input,
      id: makeId("run"),
      status: "running",
      createdAt: Date.now(),
      finishedAt: null,
      previewUrl: null,
      aiExplanation: null,
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

  finishRun(runId: string, status: Extract<RunStatus, "success" | "failed">, previewUrl: string | null) {
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
      if (list.length > MAX_LOGS_PER_RUN) list.splice(0, list.length - MAX_LOGS_PER_RUN);
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

  // ---- AI explanation ----
  setAIStatus(runId: string, aiStatus: AIStatus, error: string | null = null) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    run.aiStatus = aiStatus;
    run.aiError = error;
    if (aiStatus === "streaming") {
      run.aiExplanation = "";
    }
    this.broadcast({ kind: "run", run });
    this.persist();
  }

  appendAIDelta(runId: string, delta: string) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    run.aiExplanation = (run.aiExplanation ?? "") + delta;
    // Stream the delta directly; we save the accumulated text on `done` to
    // avoid hammering the disk on every token.
    this.broadcast({ kind: "ai", runId, delta });
  }

  finishAI(runId: string, finalText: string) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return;
    run.aiExplanation = finalText;
    run.aiStatus = "done";
    run.aiError = null;
    this.broadcast({ kind: "run", run });
    this.persist();
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
    };
  }

  // ---- pub/sub ----
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

function normalizeConfig(input: Partial<RepoConfig> | RepoConfig): RepoConfig {
  const commands = Array.isArray(input.commands) && input.commands.length > 0
    ? input.commands.map((c) => String(c).trim()).filter(Boolean)
    : [...DEFAULT_COMMANDS];
  const workspace = typeof input.workspace === "string" && input.workspace.trim()
    ? input.workspace.trim()
    : null;
  return { commands, workspace };
}

function normalizeRun(r: RunEvent): RunEvent {
  // Older persisted runs (Phase 1) won't have AI fields — fill them in.
  return {
    ...r,
    aiExplanation: r.aiExplanation ?? null,
    aiStatus: r.aiStatus ?? "idle",
    aiError: r.aiError ?? null,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __deviewerEventStore: EventStore | undefined;
}

export const eventStore: EventStore =
  globalThis.__deviewerEventStore ?? (globalThis.__deviewerEventStore = new EventStore());
