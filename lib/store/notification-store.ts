"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NotificationItem {
  id: string;
  kind: "success" | "error" | "warning" | "info";
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
}

const MAX_HISTORY = 20;

interface NotificationState {
  history: NotificationItem[];
  add: (n: Omit<NotificationItem, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
  clear: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      history: [],
      add: (n) =>
        set((s) => {
          const item: NotificationItem = {
            ...n,
            id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            createdAt: Date.now(),
            read: false,
          };
          return { history: [item, ...s.history].slice(0, MAX_HISTORY) };
        }),
      markAllRead: () =>
        set((s) => ({ history: s.history.map((h) => ({ ...h, read: true })) })),
      clear: () => set({ history: [] }),
      unreadCount: () => get().history.filter((h) => !h.read).length,
    }),
    { name: "deviewer.notifications" },
  ),
);
