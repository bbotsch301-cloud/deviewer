"use client";

import { useEffect, useReducer, useRef } from "react";
import type { ConnectedRepo, LogEntry, RepoConfig, RunEvent, RunStatus, StreamMessage } from "@/lib/types";

export interface StreamState {
  status: RunStatus;
  currentRunId: string | null;
  runs: RunEvent[];
  logs: LogEntry[];
  repos: ConnectedRepo[];
  /** Live AI deltas, keyed by runId. Cleared once the run's
   *  `aiExplanation` field is finalized via a `run` update. */
  aiBuffers: Record<string, string>;
  connected: boolean;
}

type Action =
  | { type: "connected"; value: boolean }
  | { type: "stream"; msg: StreamMessage }
  | { type: "setRepos"; repos: ConnectedRepo[] }
  | { type: "viewRun"; runId: string; logs: LogEntry[] };

const initial: StreamState = {
  status: "idle",
  currentRunId: null,
  runs: [],
  logs: [],
  repos: [],
  aiBuffers: {},
  connected: false,
};

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "connected":
      return { ...state, connected: action.value };

    case "setRepos":
      return { ...state, repos: action.repos };

    case "viewRun":
      return { ...state, currentRunId: action.runId, logs: action.logs };

    case "stream": {
      const m = action.msg;
      switch (m.kind) {
        case "snapshot":
          return {
            ...state,
            status: m.status,
            currentRunId: m.currentRunId,
            runs: m.runs,
            logs: m.logs,
            repos: m.repos,
          };
        case "log": {
          if (state.currentRunId && m.entry.runId !== state.currentRunId) return state;
          return { ...state, logs: [...state.logs, m.entry] };
        }
        case "run": {
          const existing = state.runs.findIndex((r) => r.id === m.run.id);
          const runs = [...state.runs];
          if (existing >= 0) runs[existing] = m.run;
          else runs.unshift(m.run);
          const isNew = existing < 0;
          // Drop any live AI buffer once the run carries the finalized text.
          const aiBuffers = { ...state.aiBuffers };
          if (m.run.aiStatus === "done" || m.run.aiStatus === "error") {
            delete aiBuffers[m.run.id];
          }
          return {
            ...state,
            runs: runs.slice(0, 20),
            currentRunId: isNew ? m.run.id : state.currentRunId,
            logs: isNew ? [] : state.logs,
            aiBuffers,
          };
        }
        case "ai": {
          const prev = state.aiBuffers[m.runId] ?? "";
          return {
            ...state,
            aiBuffers: { ...state.aiBuffers, [m.runId]: prev + m.delta },
          };
        }
        case "status":
          return { ...state, status: m.status, currentRunId: m.runId ?? state.currentRunId };
      }
    }
  }
}

export function useStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => dispatchRef.current({ type: "connected", value: true });
    es.onerror = () => dispatchRef.current({ type: "connected", value: false });
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as StreamMessage;
        dispatchRef.current({ type: "stream", msg });
      } catch {
        // ignore malformed
      }
    };
    return () => es.close();
  }, []);

  return {
    state,
    async connectRepo(repo: string, config?: Partial<RepoConfig>) {
      const res = await fetch("/api/repo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, ...(config ?? {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "failed to connect repo");
      dispatchRef.current({ type: "setRepos", repos: data.repos });
    },
    async removeRepo(repo: string) {
      const res = await fetch(`/api/repo?repo=${encodeURIComponent(repo)}`, { method: "DELETE" });
      const data = await res.json();
      dispatchRef.current({ type: "setRepos", repos: data.repos ?? [] });
    },
    async rerun() {
      const res = await fetch("/api/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "failed to start run");
    },
    async viewRun(runId: string) {
      const res = await fetch(`/api/events?runId=${encodeURIComponent(runId)}`);
      if (!res.ok) return;
      const data = await res.json();
      dispatchRef.current({ type: "viewRun", runId, logs: data.logs ?? [] });
    },
    async askClaude(runId: string) {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "failed to ask Claude");
      }
    },
  };
}
