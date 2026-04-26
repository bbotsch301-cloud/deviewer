import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { LogEntry, RepoConfig, RunEvent } from "./types";

const DATA_FILE = process.env.DEVIEWER_DATA_FILE ?? "data/state.json";
const SAVE_DEBOUNCE_MS = 200;

export interface PersistedState {
  version: 1;
  repos: Array<[string, RepoConfig]>;
  runs: RunEvent[];
  logsByRun: Array<[string, LogEntry[]]>;
}

const EMPTY: PersistedState = { version: 1, repos: [], runs: [], logsByRun: [] };

export function loadState(): PersistedState {
  try {
    const raw = readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed?.version !== 1) return EMPTY;
    return {
      version: 1,
      repos: parsed.repos ?? [],
      runs: parsed.runs ?? [],
      logsByRun: parsed.logsByRun ?? [],
    };
  } catch {
    return EMPTY;
  }
}

let pending: NodeJS.Timeout | null = null;
let queued: PersistedState | null = null;

/** Debounced atomic save. Multiple rapid calls collapse into one write. */
export function scheduleSave(state: PersistedState): void {
  queued = state;
  if (pending) return;
  pending = setTimeout(flush, SAVE_DEBOUNCE_MS);
}

function flush() {
  pending = null;
  if (!queued) return;
  const snapshot = queued;
  queued = null;
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot), "utf8");
    renameSync(tmp, DATA_FILE);
  } catch (err) {
    // Persistence is best-effort — log and move on rather than crashing the
    // request that triggered the save.
    console.warn("[deviewer] failed to persist state:", err);
  }
}
