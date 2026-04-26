"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  ChevronRight,
  GitBranch,
  GitCompare,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/status-dot";
import { Duration, formatDuration } from "@/components/duration";
import { useRunStore } from "@/lib/store/run-store";
import { useUIStore } from "@/lib/store/ui-store";
import { useRepoStore } from "@/lib/store/repo-store";
import type { RunEvent, RunStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "passed" | "failed" | "running";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "passed", label: "Passed" },
  { id: "failed", label: "Failed" },
  { id: "running", label: "Running" },
];

export function RunsView() {
  const runs = useRunStore((s) => s.runs);
  const selectedRepo = useRepoStore((s) => s.selectedRepo);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs
      .filter((r) => !selectedRepo || r.repo === selectedRepo)
      .filter((r) => filter === "all" || matchesFilter(r.status, filter))
      .filter(
        (r) =>
          !q ||
          r.commitMessage.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q) ||
          r.commitSha.toLowerCase().includes(q),
      );
  }, [runs, filter, query, selectedRepo]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const virt = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 8,
  });

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function openRun(id: string) {
    useRunStore.getState().setViewedRun(id, []);
    fetch(`/api/events?runId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        useRunStore.getState().setViewedRun(id, data.logs ?? []);
        setActiveTab("console");
      })
      .catch(() => null);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by commit message, branch, or SHA…"
            className="h-9 pl-8"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2/40 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.id
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {compareIds.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => null}
            className="gap-1.5"
            disabled
          >
            <GitCompare className="size-3.5" />
            {compareIds.length} selected
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <RunsEmpty hasQuery={!!query} hasFilter={filter !== "all"} />
      ) : (
        <div
          ref={parentRef}
          className="relative flex-1 overflow-auto rounded-lg border border-border bg-card"
        >
          <div style={{ height: virt.getTotalSize() }} className="relative">
            {virt.getVirtualItems().map((vi) => {
              const run = filtered[vi.index];
              return (
                <div
                  key={run.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: `translateY(${vi.start}px)`,
                    width: "100%",
                    padding: "4px 8px",
                  }}
                >
                  <RunCard
                    run={run}
                    selected={compareIds.includes(run.id)}
                    onClick={() => openRun(run.id)}
                    onSelect={() => toggleCompare(run.id)}
                    onDelete={() => setDeleteId(run.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CompareDialog
        ids={compareIds}
        onClose={() => setCompareIds([])}
        runs={runs}
      />

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this run?</DialogTitle>
            <DialogDescription>
              The run and its logs will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteId) return;
                await fetch(`/api/events?runId=${encodeURIComponent(deleteId)}`, {
                  method: "DELETE",
                });
                useRunStore.getState().removeRun(deleteId);
                toast.success("Run deleted");
                setDeleteId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function matchesFilter(status: RunStatus, filter: Filter): boolean {
  if (filter === "passed") return status === "success";
  if (filter === "failed") return status === "failed";
  if (filter === "running") return status === "running";
  return true;
}

function RunCard({
  run,
  selected,
  onClick,
  onSelect,
  onDelete,
}: {
  run: RunEvent;
  selected: boolean;
  onClick: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const initials = run.author.slice(0, 2).toUpperCase();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-md border bg-card px-3 py-3 transition-all hover:border-primary/40",
        selected ? "border-primary ring-1 ring-primary/40" : "border-border",
      )}
      onClick={onClick}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        onClick={(e) => e.stopPropagation()}
        className="size-3.5 cursor-pointer accent-primary"
        aria-label="Select for compare"
      />
      <div className="flex shrink-0 items-center gap-2">
        <StatusDot status={run.status} size="md" />
        <Badge variant="outline" className="font-mono text-[10px]">
          #{run.number}
        </Badge>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {run.commitMessage}
          </span>
          <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {run.commitSha.slice(0, 7)}
          </code>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <GitBranch className="size-3" />
            {run.branch}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="truncate">{run.repo}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{formatDistanceToNow(run.createdAt, { addSuffix: true })}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Avatar className="size-6">
          {run.authorAvatarUrl && <AvatarImage src={run.authorAvatarUrl} alt={run.author} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="hidden text-right sm:block">
          <div className="text-[11px] font-medium text-foreground">{run.author}</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {run.status === "running" ? (
              <Duration startedAt={run.createdAt} />
            ) : run.finishedAt ? (
              formatDuration(run.finishedAt - run.createdAt)
            ) : (
              "—"
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-1.5 opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
          aria-label="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </motion.div>
  );
}

function CompareDialog({
  ids,
  runs,
  onClose,
}: {
  ids: string[];
  runs: RunEvent[];
  onClose: () => void;
}) {
  const open = ids.length === 2;
  const a = runs.find((r) => r.id === ids[0]);
  const b = runs.find((r) => r.id === ids[1]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compare runs</DialogTitle>
          <DialogDescription>
            Side-by-side comparison of two runs.
          </DialogDescription>
        </DialogHeader>
        {a && b && (
          <div className="grid grid-cols-2 gap-4">
            {[a, b].map((r) => (
              <div key={r.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <StatusDot status={r.status} />
                  <Badge variant="outline" className="font-mono text-[10px]">
                    #{r.number}
                  </Badge>
                </div>
                <p className="mt-2 truncate text-sm font-medium">{r.commitMessage}</p>
                <p className="text-xs text-muted-foreground">
                  {r.branch} · {r.commitSha.slice(0, 7)}
                </p>
                <dl className="mt-4 space-y-1.5 text-xs">
                  <Row k="Status" v={r.status} />
                  <Row
                    k="Duration"
                    v={
                      r.finishedAt ? formatDuration(r.finishedAt - r.createdAt) : "in flight"
                    }
                  />
                  <Row k="Author" v={r.author} />
                  <Row k="Trigger" v={r.trigger} />
                  <Row
                    k="Started"
                    v={formatDistanceToNow(r.createdAt, { addSuffix: true })}
                  />
                </dl>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-foreground">{v}</dd>
    </div>
  );
}

function RunsEmpty({ hasQuery, hasFilter }: { hasQuery: boolean; hasFilter: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-dot-pattern bg-dot-pattern p-12 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-full border border-border bg-card text-muted-foreground">
          <GitBranch className="size-5" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">
          {hasQuery || hasFilter ? "No runs match" : "No runs yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasQuery || hasFilter
            ? "Adjust your filter or search."
            : "Push to a connected repo, or trigger a manual run."}
        </p>
      </div>
    </div>
  );
}
