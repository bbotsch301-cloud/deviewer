"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "darker" | "oled";
export type NotificationTrigger = "success" | "failure" | "both";

export interface SettingsState {
  theme: Theme;
  terminalFontSize: number;
  terminalLineHeight: number;
  browserNotifications: boolean;
  soundNotifications: boolean;
  notificationTrigger: NotificationTrigger;
  aiAutoOpenOnFailure: boolean;
  onboardingComplete: boolean;

  setTheme: (t: Theme) => void;
  setTerminalFontSize: (n: number) => void;
  setTerminalLineHeight: (n: number) => void;
  setBrowserNotifications: (v: boolean) => void;
  setSoundNotifications: (v: boolean) => void;
  setNotificationTrigger: (t: NotificationTrigger) => void;
  setAIAutoOpenOnFailure: (v: boolean) => void;
  setOnboardingComplete: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: Omit<SettingsState, keyof Pick<SettingsState,
  "setTheme" | "setTerminalFontSize" | "setTerminalLineHeight" |
  "setBrowserNotifications" | "setSoundNotifications" | "setNotificationTrigger" |
  "setAIAutoOpenOnFailure" | "setOnboardingComplete" | "reset">> = {
  theme: "dark",
  terminalFontSize: 13,
  terminalLineHeight: 1.45,
  browserNotifications: false,
  soundNotifications: false,
  notificationTrigger: "both",
  aiAutoOpenOnFailure: true,
  onboardingComplete: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setTerminalFontSize: (terminalFontSize) => set({ terminalFontSize }),
      setTerminalLineHeight: (terminalLineHeight) => set({ terminalLineHeight }),
      setBrowserNotifications: (browserNotifications) => set({ browserNotifications }),
      setSoundNotifications: (soundNotifications) => set({ soundNotifications }),
      setNotificationTrigger: (notificationTrigger) => set({ notificationTrigger }),
      setAIAutoOpenOnFailure: (aiAutoOpenOnFailure) => set({ aiAutoOpenOnFailure }),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
      reset: () => set({ ...DEFAULTS, onboardingComplete: true }),
    }),
    { name: "deviewer.settings" },
  ),
);
