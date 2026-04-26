"use client";

import { useEffect, useReducer, useRef } from "react";
import type { LogEntry, RunEvent, RunStatus, StreamMessage } from "@/lib/types";

export interface StreamState {
  status: RunStatus;
  currentRunId: string | null;
  runs: RunEvent[];
  logs: LogEntry[];
  repos: string[];
  connected: boolean;
}

type Action =
  | { type: "connected"; value: boolean }
  | { type: "stream"; msg: StreamMessage }
  | { type: "setRepos"; repos: string[] }
  | { type: "viewRun"; runId: string; logs: LogEntry[] };

const initial: StreamState = {
  status: "idle",
  currentRunId: null,
  runs: [],
  logs: [],
  repos: [],
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
          // Only append if the user is viewing the run the log belongs to.
          if (state.currentRunId && m.entry.runId !== state.currentRunId) return state;
          return { ...state, logs: [...state.logs, m.entry] };
        }
        case "run": {
          const existing = state.runs.findIndex((r) => r.id === m.run.id);
          const runs = [...state.runs];
          if (existing >= 0) runs[existing] = m.run;
          else runs.unshift(m.run);
          // If a brand new run starts, switch the console to it and clear logs.
          const isNew = existing < 0;
          return {
            ...state,
            runs: runs.slice(0, 10),
            currentRunId: isNew ? m.run.id : state.currentRunId,
            logs: isNew ? [] : state.logs,
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
    async connectRepo(repo: string) {
      const res = await fetch("/api/repo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo }),
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
  };
}
