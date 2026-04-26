"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Copy, Eraser, Search, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useRunStore } from "@/lib/store/run-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import type { LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const TerminalCanvas = dynamic(() => import("./terminal-canvas").then((m) => m.TerminalCanvas), {
  ssr: false,
  loading: () => <TerminalSkeleton />,
});

function TerminalSkeleton() {
  return (
    <div className="flex h-full items-center justify-center bg-background/40">
      <div className="grid w-full max-w-[600px] gap-2 px-6">
        <div className="skeleton-shimmer h-3 w-1/3 rounded bg-muted/40" />
        <div className="skeleton-shimmer h-3 w-2/3 rounded bg-muted/40" />
        <div className="skeleton-shimmer h-3 w-1/2 rounded bg-muted/40" />
        <div className="skeleton-shimmer h-3 w-3/4 rounded bg-muted/40" />
      </div>
    </div>
  );
}

export function Terminal() {
  const logs = useRunStore((s) => s.logs);
  const status = useRunStore((s) => s.status);
  const fontSize = useSettingsStore((s) => s.terminalFontSize);
  const lineHeight = useSettingsStore((s) => s.terminalLineHeight);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [follow, setFollow] = useState(true);
  const [copied, setCopied] = useState(false);
  const apiRef = useRef<TerminalAPI | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "f") {
        const t = e.target as HTMLElement | null;
        const inTerm = t?.closest("[data-terminal-host]");
        if (inTerm) {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      data-terminal-host
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[0_30px_80px_-40px_hsl(var(--primary)/0.4)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface/80 px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/80" />
            <span className="size-2.5 rounded-full bg-warning/80" />
            <span className="size-2.5 rounded-full bg-success/80" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Terminal
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Hint label="Search" kbd="⌘F">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search className="size-3.5" />
            </Button>
          </Hint>
          <Hint label="Copy all">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={async () => {
                const text = logs.map((l) => l.message).join("\n");
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </Hint>
          <Hint label="Clear">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => apiRef.current?.clear()}
            >
              <Eraser className="size-3.5" />
            </Button>
          </Hint>
        </div>
      </div>

      {searchOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface/60 px-3 py-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find in terminal…"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.shiftKey) apiRef.current?.findPrevious(searchTerm);
                else apiRef.current?.findNext(searchTerm);
              }
              if (e.key === "Escape") {
                setSearchOpen(false);
                setSearchTerm("");
              }
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => apiRef.current?.findPrevious(searchTerm)}
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => apiRef.current?.findNext(searchTerm)}
          >
            ↓
          </Button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {logs.length === 0 ? (
          <TerminalEmpty status={status} />
        ) : (
          <TerminalCanvas
            logs={logs}
            fontSize={fontSize}
            lineHeight={lineHeight}
            onFollowChange={setFollow}
            apiRef={apiRef}
          />
        )}

        {!follow && logs.length > 0 && (
          <Button
            size="sm"
            variant="default"
            onClick={() => apiRef.current?.scrollToBottom()}
            className="absolute bottom-3 right-4 gap-1 shadow-lg"
          >
            <ChevronDown className="size-3.5" />
            Scroll to bottom
          </Button>
        )}
      </div>
    </div>
  );
}

function TerminalEmpty({ status }: { status: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-dot-pattern bg-dot-pattern p-10 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full border border-border bg-surface text-muted-foreground">
          <Eraser className="size-4" />
        </div>
        <p className="text-sm text-foreground">
          {status === "running" ? "Pipeline starting…" : "Terminal idle"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Push to a connected repo or hit{" "}
          <kbd className="rounded bg-muted px-1 font-mono text-[10px]">⌘R</kbd> to re-run.
        </p>
      </div>
    </div>
  );
}

export interface TerminalAPI {
  clear: () => void;
  scrollToBottom: () => void;
  findNext: (q: string) => void;
  findPrevious: (q: string) => void;
}

export type { LogEntry as TerminalLogEntry };

export const TERMINAL_FOLLOW_CLASS = cn();
