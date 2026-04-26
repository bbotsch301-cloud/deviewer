"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActiveTab = "console" | "runs" | "settings" | "webhook";

interface UIState {
  sidebarOpen: boolean;
  aiPanelOpen: boolean;
  aiPinned: boolean;
  activeTab: ActiveTab;
  /** Resizable panel sizes (percent of total width). */
  panelSizes: { sidebar: number; main: number; ai: number };
  commandPaletteOpen: boolean;
  shortcutsOpen: boolean;
  mobileSidebarOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
  toggleAIPanel: () => void;
  setAIPanelOpen: (v: boolean) => void;
  setAIPinned: (v: boolean) => void;
  setActiveTab: (t: ActiveTab) => void;
  setPanelSizes: (sizes: UIState["panelSizes"]) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setMobileSidebarOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      aiPanelOpen: false,
      aiPinned: false,
      activeTab: "console",
      panelSizes: { sidebar: 18, main: 60, ai: 22 },
      commandPaletteOpen: false,
      shortcutsOpen: false,
      mobileSidebarOpen: false,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
      setAIPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
      setAIPinned: (aiPinned) => set({ aiPinned }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setPanelSizes: (panelSizes) => set({ panelSizes }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
    }),
    {
      name: "deviewer.ui",
      partialize: (s) => ({
        sidebarOpen: s.sidebarOpen,
        aiPinned: s.aiPinned,
        activeTab: s.activeTab,
        panelSizes: s.panelSizes,
      }),
    },
  ),
);
