"use client";

import { useEffect, useRef, useState } from "react";
import { useRunStore } from "@/lib/store/run-store";
import { useRepoStore } from "@/lib/store/repo-store";
import { useWebhookStore } from "@/lib/store/webhook-store";
import type { StreamMessage } from "@/lib/types";

let __connected = false;

/**
 * Single SSE subscription, fanned out to the right zustand stores.
 * Mounted once via the global Providers tree.
 */
export function useStreamSync() {
  const sourceRef = useRef<EventSource | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (__connected) return;
    __connected = true;

    const es = new EventSource("/api/stream");
    sourceRef.current = es;

    es.onopen = () => force((n) => n + 1);
    es.onerror = () => force((n) => n + 1);
    es.onmessage = (ev) => {
      let msg: StreamMessage;
      try {
        msg = JSON.parse(ev.data) as StreamMessage;
      } catch {
        return;
      }
      handle(msg);
    };

    return () => {
      es.close();
      __connected = false;
    };
  }, []);
}

export function useStreamConnected(): boolean {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const tick = () => {
      const r = (typeof window !== "undefined" && (window as any).__deviewerSourceState) as
        | "open"
        | "closed"
        | undefined;
      setConnected(r === "open");
    };
    const i = setInterval(tick, 1000);
    tick();
    return () => clearInterval(i);
  }, []);
  return connected;
}

function handle(msg: StreamMessage) {
  switch (msg.kind) {
    case "snapshot": {
      useRunStore.getState().setSnapshot({
        status: msg.status,
        currentRunId: msg.currentRunId,
        runs: msg.runs,
        logs: msg.logs,
      });
      useRepoStore.getState().setRepos(msg.repos);
      useWebhookStore.getState().setSnapshot({
        lastWebhookAt: msg.lastWebhookAt,
        recentWebhooks: msg.recentWebhooks,
      });
      return;
    }
    case "log":
      useRunStore.getState().appendLog(msg.entry);
      return;
    case "run":
      useRunStore.getState().upsertRun(msg.run);
      return;
    case "ai":
      useRunStore.getState().appendAIDelta(msg.runId, msg.delta);
      return;
    case "status":
      useRunStore.getState().setStatus(msg.status, msg.runId);
      return;
    case "webhook":
      useWebhookStore.getState().recordWebhook(msg.payload);
      return;
  }
}
