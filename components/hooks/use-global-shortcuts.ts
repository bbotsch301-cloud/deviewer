"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";

/**
 * Application-wide keyboard shortcuts. Bindings are intentionally
 * simple — every action surfaces in the command palette too.
 */
export function useGlobalShortcuts() {
  const router = useRouter();
  const ui = useUIStore.getState;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui().setCommandPaletteOpen(!ui().commandPaletteOpen);
        return;
      }

      if (meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        triggerRerun();
        return;
      }

      if (meta && e.key === "/") {
        e.preventDefault();
        ui().toggleAIPanel();
        return;
      }

      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        ui().toggleSidebar();
        return;
      }

      if (meta && e.key === ",") {
        e.preventDefault();
        ui().setActiveTab("settings");
        router.push("/dashboard");
        return;
      }

      if (e.key === "Escape") {
        const s = ui();
        if (s.commandPaletteOpen) s.setCommandPaletteOpen(false);
        else if (s.shortcutsOpen) s.setShortcutsOpen(false);
        else if (s.mobileSidebarOpen) s.setMobileSidebarOpen(false);
        return;
      }

      if (!editable && e.key === "?") {
        e.preventDefault();
        ui().setShortcutsOpen(!ui().shortcutsOpen);
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, ui]);
}

async function triggerRerun() {
  try {
    const res = await fetch("/api/run", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error("Re-run failed", { description: data.error ?? `HTTP ${res.status}` });
    } else {
      toast.message("Re-running last build", { description: "Streaming logs…" });
    }
  } catch (err) {
    toast.error("Re-run failed", { description: String(err) });
  }
}
