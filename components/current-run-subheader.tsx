"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Terminal as TerminalIcon } from "lucide-react";
import { useRunStore } from "@/lib/store/run-store";

/**
 * Thin live status strip directly under the navbar — only renders during an
 * active run. Shows which command is currently executing and progress.
 */
export function CurrentRunSubheader() {
  const status = useRunStore((s) => s.status);
  const current = useRunStore(
    (s) => s.runs.find((r) => r.id === s.currentRunId) ?? s.runs[0],
  );

  const isRunning = status === "running";

  return (
    <AnimatePresence>
      {isRunning && current && current.commandTimings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden border-b border-border bg-warning/5"
        >
          <div className="flex items-center gap-3 px-4 py-1.5 text-[11px]">
            <TerminalIcon className="size-3 text-warning" />
            <span className="font-mono text-foreground">
              {current.commandTimings[Math.max(0, current.currentCommandIndex)]?.command ?? "—"}
            </span>
            <span className="text-muted-foreground">
              ({Math.max(0, current.currentCommandIndex) + 1}/{current.commandTimings.length})
            </span>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              {current.commandTimings.map((t, i) => (
                <span
                  key={i}
                  className={
                    t.exitCode === 0
                      ? "size-1.5 rounded-full bg-success"
                      : t.exitCode != null
                      ? "size-1.5 rounded-full bg-destructive"
                      : i === current.currentCommandIndex
                      ? "size-1.5 rounded-full bg-warning animate-pulse-dot"
                      : "size-1.5 rounded-full bg-muted-foreground/40"
                  }
                />
              ))}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
