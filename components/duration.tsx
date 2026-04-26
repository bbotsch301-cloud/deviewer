"use client";

import { useEffect, useState } from "react";

/** Live ticking counter for in-flight runs; static label after `until`. */
export function Duration({
  startedAt,
  until,
  className,
}: {
  startedAt: number;
  until?: number | null;
  className?: string;
}) {
  const live = until == null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const ms = (until ?? now) - startedAt;
  return <span className={className}>{formatDuration(ms)}</span>;
}

export function formatDuration(ms: number): string {
  ms = Math.max(0, ms);
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
