"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  ChevronDown,
  Command as CommandIcon,
  Github,
  Menu,
  Moon,
  PanelLeft,
  Play,
  Sparkles,
  Sun,
  Sunrise,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/status-dot";
import { Duration } from "@/components/duration";
import { useRunStore } from "@/lib/store/run-store";
import { useUIStore } from "@/lib/store/ui-store";
import { useNotificationStore } from "@/lib/store/notification-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function Navbar() {
  const status = useRunStore((s) => s.status);
  const currentRunId = useRunStore((s) => s.currentRunId);
  const runs = useRunStore((s) => s.runs);
  const current = runs.find((r) => r.id === currentRunId) ?? runs[0];

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);

  const notifications = useNotificationStore((s) => s.history);
  const unread = notifications.filter((n) => !n.read).length;
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const isRunning = status === "running";
  const eta = useETA(current?.repo);

  return (
    <header className="relative z-40 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Hint label="Toggle sidebar" kbd="⌘B" side="bottom">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              toggleSidebar();
              setMobileSidebarOpen(true);
            }}
            className="hidden md:inline-flex"
          >
            <PanelLeft
              className={cn("size-4 transition-transform", !sidebarOpen && "rotate-180")}
            />
          </Button>
        </Hint>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>

        <Brand />

        <span className="hidden h-5 w-px bg-border sm:block" />

        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          {current ? (
            <>
              <Badge variant="outline" className="gap-1.5 font-mono text-[11px]">
                <StatusDot status={status} />#{current.number}
              </Badge>
              <span className="truncate text-xs text-muted-foreground">
                <span className="text-foreground">{current.repo}</span> ·{" "}
                <span className="font-mono">{current.branch}</span>
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No runs yet</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {isRunning && current && (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-warning" />
              <span>
                Running <Duration startedAt={current.createdAt} />
                {eta != null && eta > 0 && (
                  <span className="ml-1 text-muted-foreground/60">
                    · ~{formatSeconds(eta - (Date.now() - current.createdAt))} left
                  </span>
                )}
              </span>
            </span>
          )}

          <Hint label="Command palette" kbd="⌘K">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden gap-2 sm:inline-flex"
            >
              <CommandIcon className="size-3.5" />
              <span className="text-muted-foreground">Search…</span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
          </Hint>

          <Hint label="Re-run last build" kbd="⌘R">
            <Button
              size="icon"
              variant="ghost"
              disabled={isRunning}
              onClick={async () => {
                try {
                  const res = await fetch("/api/run", { method: "POST" });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    toast.error("Re-run failed", { description: data.error ?? "" });
                  }
                } catch (err) {
                  toast.error("Re-run failed", { description: String(err) });
                }
              }}
            >
              <Play className="size-4" />
            </Button>
          </Hint>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={markAllRead}
                aria-label="Notifications"
                className="relative"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid size-3.5 place-items-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <NotificationDrawer />
            </PopoverContent>
          </Popover>

          <ThemeMenu />
        </div>
      </div>

      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 -bottom-px"
          >
            <Progress
              indeterminate={!eta || eta <= 0}
              value={
                current && eta && eta > 0
                  ? Math.min(99, ((Date.now() - current.createdAt) / eta) * 100)
                  : undefined
              }
              className="h-0.5 rounded-none bg-transparent"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Brand() {
  return (
    <a
      href="/dashboard"
      className="flex shrink-0 items-center gap-2"
      aria-label="deviewer home"
    >
      <span className="grid size-7 place-items-center rounded-md gradient-accent text-white shadow-[0_0_24px_-8px_hsl(var(--primary))]">
        <Sparkles className="size-3.5" />
      </span>
      <div className="hidden flex-col leading-none sm:flex">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          deviewer
        </span>
        <span className="text-[10px] text-muted-foreground">
          live developer feedback
        </span>
      </div>
    </a>
  );
}

function ThemeMenu() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const Icon = theme === "oled" ? Moon : theme === "darker" ? Sun : Sunrise;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Theme">
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(
          [
            { id: "dark", label: "Dark", desc: "Default deep navy" },
            { id: "darker", label: "Darker", desc: "Lower contrast" },
            { id: "oled", label: "OLED Black", desc: "Pure #000" },
          ] as const
        ).map((opt) => (
          <DropdownMenuItem
            key={opt.id}
            onSelect={() => setTheme(opt.id)}
            className={cn(theme === opt.id && "bg-surface-2")}
          >
            <div className="flex flex-col">
              <span className="text-xs font-medium">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </div>
            {theme === opt.id && <span className="ml-auto text-primary">●</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationDrawer() {
  const items = useNotificationStore((s) => s.history);
  const clear = useNotificationStore((s) => s.clear);
  return (
    <div className="max-h-[420px] overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notifications
        </span>
        <Button variant="ghost" size="sm" onClick={clear} disabled={!items.length}>
          Clear
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">
          You&apos;re all caught up.
        </div>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto divide-y divide-border">
          {items.map((n) => (
            <li key={n.id} className="px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1 size-1.5 rounded-full",
                    n.kind === "success" && "bg-success",
                    n.kind === "error" && "bg-destructive",
                    n.kind === "warning" && "bg-warning",
                    n.kind === "info" && "bg-primary",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="truncate text-[11px] text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                    {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useETA(repo?: string): number | null {
  const runs = useRunStore((s) => s.runs);
  if (!repo) return null;
  const finished = runs
    .filter((r) => r.repo === repo && r.status !== "running" && r.finishedAt)
    .slice(0, 5);
  if (finished.length === 0) return null;
  const avg =
    finished.reduce((acc, r) => acc + ((r.finishedAt as number) - r.createdAt), 0) /
    finished.length;
  return Math.round(avg);
}

function formatSeconds(ms: number): string {
  if (ms < 1000) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
