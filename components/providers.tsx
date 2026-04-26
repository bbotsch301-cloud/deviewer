"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStreamSync } from "@/components/hooks/use-stream-sync";
import { useThemeBridge } from "@/components/hooks/use-theme-bridge";
import { useDocumentTitle } from "@/components/hooks/use-document-title";
import { useFavicon } from "@/components/hooks/use-favicon";
import { useNotificationOrchestrator } from "@/components/hooks/use-notification-orchestrator";
import { useGlobalShortcuts } from "@/components/hooks/use-global-shortcuts";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={0}>
      <BrowserSideEffects />
      {children}
      <CommandPalette />
      <ShortcutsDialog />
      <Toaster
        theme="dark"
        position="top-right"
        richColors
        closeButton
        visibleToasts={3}
        toastOptions={{
          classNames: {
            toast:
              "bg-popover border-border text-popover-foreground shadow-lg shadow-black/30",
          },
        }}
      />
    </TooltipProvider>
  );
}

function BrowserSideEffects() {
  useStreamSync();
  useThemeBridge();
  useDocumentTitle();
  useFavicon();
  useNotificationOrchestrator();
  useGlobalShortcuts();
  // Avoid hydration mismatch — these hooks only do work after mount.
  useEffect(() => {}, []);
  return null;
}
