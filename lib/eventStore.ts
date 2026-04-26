import { EventEmitter } from "node:events";
import type { LogEntry, LogType, RunEvent, RunStatus, StreamMessage } from "./types";

const MAX_RUNS = 10;
const MAX_LOGS_PER_RUN = 500;

/**
 * Process-wide singleton holding the live state of the system.
 * Survives Next.js HMR reloads in dev by stashing on `globalThis`.
 */
class EventStore {
  private repos = new Set<string>();
  private runs: RunEvent[] = [];
  private logsByRun = new Map<string, LogEntry[]>();
  private currentRunId: string | null = null;
  private status: RunStatus = "idle";
  private bus = new EventEmitter();

  constructor() {
    this.bus.setMaxListeners(0);
  }

  // ---- repos ----
  addRepo(repo: string) {
    this.repos.add(repo);
  }
  removeRepo(repo: string) {
    this.repos.delete(repo);
  }
  listRepos(): string[] {
    return Array.from(this.repos);
  }

  // ---- runs ----
  createRun(input: Omit<RunEvent, "id" | "status" | "createdAt" | "finishedAt" | "previewUrl">): RunEvent {
    const run: RunEvent = {
      ...input,
      id: makeId("run"),
      status: "running",
      createdAt: Date.now(),
      finishedAt: null,
      previewUrl: null,
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

declare global {
  // eslint-disable-next-line no-var
  var __deviewerEventStore: EventStore | undefined;
}

export const eventStore: EventStore =
  globalThis.__deviewerEventStore ?? (globalThis.__deviewerEventStore = new EventStore());
