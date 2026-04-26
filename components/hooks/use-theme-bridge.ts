"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/store/settings-store";

/**
 * Apply the user's chosen theme variant as a class on <html>. We also keep
 * `dark` so Tailwind's dark: variants stay active across all three themes.
 */
export function useThemeBridge() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-darker", "theme-oled");
    if (theme === "darker") root.classList.add("theme-darker");
    else if (theme === "oled") root.classList.add("theme-oled");
  }, [theme]);
}
