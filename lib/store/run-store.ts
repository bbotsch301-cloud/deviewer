"use client";

import { create } from "zustand";
import type { LogEntry, RunEvent, RunStatus } from "@/lib/types";

interface RunState {
  status: RunStatus;
  currentRunId: string | null;
  runs: RunEvent[];
  logs: LogEntry[];
  /** Live AI deltas per run, accumulated until a finalized `run` update arrives. */
  aiBuffers: Record<string, string>;

  setStatus: (status: RunStatus, runId?: string | null) => void;
  setSnapshot: (snapshot: { status: RunStatus; currentRunId: string | null; runs: RunEvent[]; logs: LogEntry[] }) => void;
  upsertRun: (run: RunEvent) => void;
  appendLog: (entry: LogEntry) => void;
  setViewedRun: (runId: string, logs: LogEntry[]) => void;
  appendAIDelta: (runId: string, delta: string) => void;
  removeRun: (runId: string) => void;
  clearRuns: () => void;
}

export const useRunStore = create<RunState>((set) => ({
  status: "idle",
  currentRunId: null,
  runs: [],
  logs: [],
  aiBuffers: {},

  setStatus: (status, runId) =>
    set((s) => ({ status, currentRunId: runId !== undefined ? runId : s.currentRunId })),

  setSnapshot: ({ status, currentRunId, runs, logs }) =>
    set({ status, currentRunId, runs, logs }),

  upsertRun: (run) =>
    set((s) => {
      const idx = s.runs.findIndex((r) => r.id === run.id);
      const runs = [...s.runs];
      let { currentRunId, logs } = s;
      let aiBuffers = s.aiBuffers;
      if (idx >= 0) {
        runs[idx] = run;
      } else {
        runs.unshift(run);
        currentRunId = run.id;
        logs = [];
      }
      if (run.aiStatus === "done" || run.aiStatus === "error") {
        if (aiBuffers[run.id]) {
          aiBuffers = { ...aiBuffers };
          delete aiBuffers[run.id];
        }
      }
      return { runs: runs.slice(0, 100), currentRunId, logs, aiBuffers };
    }),

  appendLog: (entry) =>
    set((s) => {
      if (s.currentRunId && entry.runId !== s.currentRunId) return s;
      return { logs: [...s.logs, entry] };
    }),

  setViewedRun: (runId, logs) => set({ currentRunId: runId, logs }),

  appendAIDelta: (runId, delta) =>
    set((s) => ({
      aiBuffers: { ...s.aiBuffers, [runId]: (s.aiBuffers[runId] ?? "") + delta },
    })),

  removeRun: (runId) =>
    set((s) => {
      const runs = s.runs.filter((r) => r.id !== runId);
      const currentRunId =
        s.currentRunId === runId ? runs[0]?.id ?? null : s.currentRunId;
      return { runs, currentRunId, logs: currentRunId === s.currentRunId ? s.logs : [] };
    }),

  clearRuns: () => set({ runs: [], logs: [], currentRunId: null, status: "idle" }),
}));
