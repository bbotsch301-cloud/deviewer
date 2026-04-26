"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Pin,
  PinOff,
  Send,
  Sparkles,
  Terminal as TerminalIcon,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useRunStore } from "@/lib/store/run-store";
import { useUIStore } from "@/lib/store/ui-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Markdown } from "@/components/markdown";
import type { AIMessage, RunEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AIPanel({ embedded }: { embedded?: boolean }) {
  const runs = useRunStore((s) => s.runs);
  const currentRunId = useRunStore((s) => s.currentRunId);
  const aiBuffers = useRunStore((s) => s.aiBuffers);
  const run = runs.find((r) => r.id === currentRunId) ?? null;

  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const setAIPanelOpen = useUIStore((s) => s.setAIPanelOpen);
  const aiPinned = useUIStore((s) => s.aiPinned);
  const setAIPinned = useUIStore((s) => s.setAIPinned);
  const aiAuto = useSettingsStore((s) => s.aiAutoOpenOnFailure);

  // Auto-open on failure when configured.
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!run || !aiAuto) return;
    if (run.status !== "failed") return;
    if (autoOpenedRef.current === run.id) return;
    autoOpenedRef.current = run.id;
    setAIPanelOpen(true);
  }, [run, aiAuto, setAIPanelOpen]);

  if (!run) return embedded ? <AIPanelEmpty /> : null;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        embedded
          ? "rounded-lg border border-primary/20 bg-card"
          : "border-l border-border bg-card",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface/40 px-3 py-2.5">
        <div className="grid size-6 place-items-center rounded-md gradient-accent text-white">
          <Sparkles className="size-3" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">Claude assistant</p>
          <p className="text-[10px] text-muted-foreground">
            Powered by <span className="text-foreground">claude-sonnet-4-6</span>
          </p>
        </div>
        <Hint label={aiPinned ? "Unpin" : "Pin open"}>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setAIPinned(!aiPinned)}
          >
            {aiPinned ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
          </Button>
        </Hint>
        {!aiPinned && !embedded && (
          <Hint label="Close" kbd="⌘/">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setAIPanelOpen(false)}
            >
              <X className="size-3.5" />
            </Button>
          </Hint>
        )}
      </header>

      <ChatBody run={run} liveDelta={aiBuffers[run.id] ?? ""} />
      <Composer run={run} />
    </div>
  );
}

function ChatBody({ run, liveDelta }: { run: RunEvent; liveDelta: string }) {
  const messages = run.aiMessages;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, liveDelta]);

  if (messages.length === 0 && run.status === "failed") {
    return <FirstAskCTA run={run} />;
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-xs">
          <Sparkles className="mx-auto size-5 text-primary" />
          <p className="mt-2 text-xs text-muted-foreground">
            Failure analysis appears here when a build fails.
          </p>
        </div>
      </div>
    );
  }

  const isStreaming = run.aiStatus === "streaming";

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-4">
        {messages.map((m, i) => {
          const isLastAssistant =
            isStreaming && i === messages.length - 1 && m.role === "assistant";
          const content = isLastAssistant ? liveDelta || m.content : m.content;
          return <ChatBubble key={i} message={{ ...m, content }} streaming={isLastAssistant} />;
        })}
        {run.aiError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {run.aiError}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message, streaming }: { message: AIMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("flex gap-2.5", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-semibold",
          isUser ? "bg-muted text-muted-foreground" : "gradient-accent text-white",
        )}
      >
        {isUser ? "You" : <Sparkles className="size-3" />}
      </div>
      <div className={cn("min-w-0 flex-1", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block max-w-full rounded-lg px-3 py-2 text-xs",
            isUser
              ? "bg-primary/10 text-foreground"
              : "border border-border bg-surface/40 text-foreground",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-left">{message.content}</p>
          ) : (
            <div className="text-left">
              <Markdown source={message.content} />
              {streaming && (
                <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-caret-blink bg-primary" />
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FirstAskCTA({ run }: { run: RunEvent }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="max-w-xs space-y-3 text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Why did this fail?</h3>
        <p className="text-xs text-muted-foreground">
          Get an instant senior-engineer read on what went wrong and how to fix it.
        </p>
        <Button
          size="sm"
          className="w-full gap-2"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/explain", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ runId: run.id }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error ?? "Couldn't reach Claude");
              }
            } catch (err) {
              toast.error(String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Wand2 className="size-3.5" />
          Ask Claude to explain
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Requires <code className="text-foreground">ANTHROPIC_API_KEY</code>.
        </p>
      </div>
    </div>
  );
}

function Composer({ run }: { run: RunEvent }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const isStreaming = run.aiStatus === "streaming";
  const hasMessages = run.aiMessages.length > 0;

  if (!hasMessages) return null;

  async function send() {
    const message = draft.trim();
    if (!message) return;
    setBusy(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: run.id, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't reach Claude");
        return;
      }
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface/40 p-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isStreaming) send();
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isStreaming ? "Streaming…" : "Ask a follow-up…"}
          disabled={isStreaming || busy}
          className="text-xs"
        />
        <Button type="submit" size="icon" disabled={!draft.trim() || isStreaming || busy}>
          <Send className="size-3.5" />
        </Button>
      </form>
      <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Sparkles className="size-2.5" />
        Powered by Claude
      </p>
    </div>
  );
}

function AIPanelEmpty() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-6">
      <div className="text-center">
        <Sparkles className="mx-auto size-5 text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">
          Pick a run to see AI insights here.
        </p>
      </div>
    </div>
  );
}

export function ApplyFixButton({
  command,
  repo,
}: {
  command: string;
  repo?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/run", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ command, repo }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error ?? "Apply failed");
            return;
          }
          toast.success("Applying fix", { description: command });
        } finally {
          setBusy(false);
        }
      }}
      className="gap-1.5"
    >
      <TerminalIcon className="size-3.5" />
      Apply fix
    </Button>
  );
}
