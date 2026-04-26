"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  Layers,
  Plus,
  Settings,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/status-dot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRepoStore } from "@/lib/store/repo-store";
import { useRunStore } from "@/lib/store/run-store";
import { useUIStore } from "@/lib/store/ui-store";
import { type RunStatus } from "@/lib/types";

interface Props {
  onOpenAddRepo: () => void;
}

export function Sidebar({ onOpenAddRepo }: Props) {
  const repos = useRepoStore((s) => s.repos);
  const selected = useRepoStore((s) => s.selectedRepo);
  const selectRepo = useRepoStore((s) => s.selectRepo);
  const runs = useRunStore((s) => s.runs);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  return (
    <aside className="flex h-full flex-col bg-surface/40">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="size-3.5" />
          Projects
        </div>
        <Hint label="Add new repo">
          <Button size="icon-sm" variant="ghost" onClick={onOpenAddRepo}>
            <Plus className="size-3.5" />
          </Button>
        </Hint>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {repos.length === 0 ? (
          <SidebarEmpty onAdd={onOpenAddRepo} />
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {repos.map((r) => {
                const repoRuns = runs.filter((run) => run.repo === r.name);
                const last = repoRuns[0];
                const status: RunStatus = last?.status ?? "idle";
                const isSelected = selected === r.name;
                return (
                  <motion.li
                    key={r.name}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-2 text-xs transition-colors",
                        isSelected
                          ? "bg-surface-2 text-foreground"
                          : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                      )}
                    >
                      <button
                        onClick={() => selectRepo(r.name)}
                        className="flex flex-1 min-w-0 items-center gap-2 text-left"
                      >
                        <StatusDot status={status} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-foreground">
                            {r.name.split("/")[1] ?? r.name}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {r.name.split("/")[0]} ·{" "}
                            {last
                              ? formatDistanceToNow(last.createdAt, { addSuffix: true })
                              : "no runs"}
                          </div>
                        </div>
                      </button>
                      <Hint label="Remove repo" side="right">
                        <button
                          onClick={() => setRemoveTarget(r.name)}
                          className="rounded p-1 opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </Hint>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="border-t border-border p-2">
        <SidebarLink
          icon={<Webhook className="size-3.5" />}
          label="Webhook setup"
          onClick={() => setActiveTab("webhook")}
        />
        <SidebarLink
          icon={<Settings className="size-3.5" />}
          label="Settings"
          kbd="⌘,"
          onClick={() => setActiveTab("settings")}
        />
        <RunAllButton />
      </div>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this repository?</DialogTitle>
            <DialogDescription>
              <code className="text-foreground">{removeTarget}</code> will be disconnected. Run history is kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!removeTarget) return;
                await fetch(`/api/repo?repo=${encodeURIComponent(removeTarget)}`, {
                  method: "DELETE",
                });
                toast.success("Repository removed", { description: removeTarget });
                setRemoveTarget(null);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function SidebarEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-2/30 p-3 text-center">
      <GitBranch className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-2 text-[11px] text-muted-foreground">No repos connected</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full justify-center"
        onClick={onAdd}
      >
        Add repository
      </Button>
    </div>
  );
}

function SidebarLink({
  icon,
  label,
  kbd,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  kbd?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {kbd && (
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{kbd}</kbd>
      )}
    </button>
  );
}

function RunAllButton() {
  const repos = useRepoStore((s) => s.repos);
  const status = useRunStore((s) => s.status);
  if (repos.length < 2) return null;
  return (
    <button
      disabled={status === "running"}
      onClick={async () => {
        for (const r of repos) {
          await fetch("/api/run", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ repo: r.name }),
          }).catch(() => null);
        }
        toast.success("Triggered runs across all repos");
      }}
      className="mt-1 flex w-full items-center gap-2 rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
    >
      <Zap className="size-3.5" />
      Run all repos
    </button>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2 px-3 py-4">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
