"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConnectedRepo } from "@/lib/types";

interface RepoState {
  repos: ConnectedRepo[];
  selectedRepo: string | null;
  setRepos: (repos: ConnectedRepo[]) => void;
  selectRepo: (name: string | null) => void;
}

export const useRepoStore = create<RepoState>()(
  persist(
    (set) => ({
      repos: [],
      selectedRepo: null,
      setRepos: (repos) =>
        set((s) => ({
          repos,
          selectedRepo:
            s.selectedRepo && repos.some((r) => r.name === s.selectedRepo)
              ? s.selectedRepo
              : repos[0]?.name ?? null,
        })),
      selectRepo: (selectedRepo) => set({ selectedRepo }),
    }),
    {
      name: "deviewer.repo",
      partialize: (s) => ({ selectedRepo: s.selectedRepo }),
    },
  ),
);
