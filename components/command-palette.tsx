"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Clock,
  Copy,
  Eraser,
  Eye,
  GitBranch,
  Keyboard,
  Layers,
  Moon,
  Play,
  Settings,
  Sparkles,
  Terminal,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useUIStore } from "@/lib/store/ui-store";
import { useRunStore } from "@/lib/store/run-store";
import { useSettingsStore, type Theme } from "@/lib/store/settings-store";

const RECENTS_KEY = "deviewer.cmdk.recents";

type ActionId =
  | "rerun"
  | "clear-terminal"
  | "open-settings"
  | "open-webhook"
  | "open-runs"
  | "open-console"
  | "copy-webhook-url"
  | "ask-claude"
  | "toggle-theme-dark"
  | "toggle-theme-darker"
  | "toggle-theme-oled"
  | "toggle-ai-panel"
  | "toggle-sidebar"
  | "open-shortcuts"
  | "view-last-run";

interface Action {
  id: ActionId;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const [recents, setRecents] = useState<ActionId[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      setRecents(raw ? (JSON.parse(raw) as ActionId[]) : []);
    } catch {
      setRecents([]);
    }
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const close = () => setOpen(false);
    return [
      {
        id: "rerun",
        label: "Re-run last build",
        description: "Trigger the last event again",
        icon: Play,
        shortcut: "⌘R",
        run: async () => {
          close();
          try {
            const res = await fetch("/api/run", { method: "POST" });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              toast.error("Re-run failed", { description: data.error });
            } else {
              toast.message("Re-running last build");
            }
          } catch (err) {
            toast.error("Re-run failed", { description: String(err) });
          }
        },
      },
      {
        id: "view-last-run",
        label: "View last run",
        icon: Clock,
        run: () => {
          close();
          const last = useRunStore.getState().runs[0];
          if (!last) {
            toast.error("No runs yet");
            return;
          }
          fetch(`/api/events?runId=${encodeURIComponent(last.id)}`)
            .then((r) => r.json())
            .then((data) => {
              useRunStore.getState().setViewedRun(last.id, data.logs ?? []);
              setActiveTab("console");
            });
        },
      },
      {
        id: "clear-terminal",
        label: "Clear terminal",
        icon: Eraser,
        run: () => {
          close();
          useRunStore.setState({ logs: [] });
          toast.success("Terminal cleared");
        },
      },
      {
        id: "ask-claude",
        label: "Ask Claude about last run",
        icon: Sparkles,
        run: async () => {
          close();
          const last = useRunStore.getState().runs[0];
          if (!last) {
            toast.error("No runs yet");
            return;
          }
          await fetch("/api/explain", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ runId: last.id }),
          });
          useUIStore.getState().setAIPanelOpen(true);
        },
      },
      {
        id: "open-console",
        label: "Go to Console",
        icon: Terminal,
        run: () => {
          close();
          setActiveTab("console");
        },
      },
      {
        id: "open-runs",
        label: "Go to Runs",
        icon: GitBranch,
        run: () => {
          close();
          setActiveTab("runs");
        },
      },
      {
        id: "open-webhook",
        label: "Go to Webhook setup",
        icon: Webhook,
        run: () => {
          close();
          setActiveTab("webhook");
        },
      },
      {
        id: "open-settings",
        label: "Open Settings",
        icon: Settings,
        shortcut: "⌘,",
        run: () => {
          close();
          setActiveTab("settings");
        },
      },
      {
        id: "copy-webhook-url",
        label: "Copy webhook URL",
        icon: Copy,
        run: async () => {
          close();
          await navigator.clipboard.writeText(`${window.location.origin}/api/webhook`);
          toast.success("Webhook URL copied");
        },
      },
      {
        id: "toggle-ai-panel",
        label: "Toggle AI panel",
        icon: Sparkles,
        shortcut: "⌘/",
        run: () => {
          close();
          toggleAIPanel();
        },
      },
      {
        id: "toggle-sidebar",
        label: "Toggle sidebar",
        icon: Layers,
        shortcut: "⌘B",
        run: () => {
          close();
          toggleSidebar();
        },
      },
      {
        id: "toggle-theme-dark",
        label: "Theme: Dark",
        icon: Eye,
        run: () => {
          close();
          setTheme("dark");
        },
      },
      {
        id: "toggle-theme-darker",
        label: "Theme: Darker",
        icon: Eye,
        run: () => {
          close();
          setTheme("darker");
        },
      },
      {
        id: "toggle-theme-oled",
        label: "Theme: OLED Black",
        icon: Moon,
        run: () => {
          close();
          setTheme("oled" as Theme);
        },
      },
      {
        id: "open-shortcuts",
        label: "View keyboard shortcuts",
        icon: Keyboard,
        shortcut: "?",
        run: () => {
          close();
          setShortcutsOpen(true);
        },
      },
    ];
  }, [setOpen, setActiveTab, toggleAIPanel, toggleSidebar, setShortcutsOpen, setTheme]);

  const recentActions = recents
    .map((id) => actions.find((a) => a.id === id))
    .filter(Boolean) as Action[];

  function pushRecent(id: ActionId) {
    if (typeof window === "undefined") return;
    const next = [id, ...recents.filter((r) => r !== id)].slice(0, 5);
    setRecents(next);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No commands match.</CommandEmpty>

        {recentActions.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentActions.map((a) => (
                <ActionRow key={a.id} action={a} onSelect={pushRecent} />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Actions">
          {actions
            .filter((a) => !["toggle-theme-dark", "toggle-theme-darker", "toggle-theme-oled"].includes(a.id))
            .map((a) => (
              <ActionRow key={a.id} action={a} onSelect={pushRecent} />
            ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          {actions
            .filter((a) => ["toggle-theme-dark", "toggle-theme-darker", "toggle-theme-oled"].includes(a.id))
            .map((a) => (
              <ActionRow key={a.id} action={a} onSelect={pushRecent} />
            ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Notifications">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              if (typeof window !== "undefined" && "Notification" in window) {
                Notification.requestPermission();
              }
            }}
          >
            <Bell />
            Enable browser notifications
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function ActionRow({
  action,
  onSelect,
}: {
  action: Action;
  onSelect: (id: ActionId) => void;
}) {
  const Icon = action.icon;
  return (
    <CommandItem
      onSelect={() => {
        onSelect(action.id);
        action.run();
      }}
    >
      <Icon />
      <span className="flex-1">{action.label}</span>
      {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
    </CommandItem>
  );
}
