"use client";

import { create } from "zustand";
import type { WebhookPayload } from "@/lib/types";

interface WebhookState {
  lastWebhookAt: number | null;
  recentWebhooks: WebhookPayload[];
  setSnapshot: (s: { lastWebhookAt: number | null; recentWebhooks: WebhookPayload[] }) => void;
  recordWebhook: (payload: WebhookPayload) => void;
}

export const useWebhookStore = create<WebhookState>((set) => ({
  lastWebhookAt: null,
  recentWebhooks: [],
  setSnapshot: ({ lastWebhookAt, recentWebhooks }) => set({ lastWebhookAt, recentWebhooks }),
  recordWebhook: (payload) =>
    set((s) => ({
      lastWebhookAt: payload.receivedAt,
      recentWebhooks: [payload, ...s.recentWebhooks].slice(0, 5),
    })),
}));
