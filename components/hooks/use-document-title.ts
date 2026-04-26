"use client";

import { useEffect } from "react";
import { useRunStore } from "@/lib/store/run-store";

const GLYPH = {
  idle: "·",
  running: "◐",
  success: "✓",
  failed: "✗",
} as const;

const LABEL = {
  idle: "deviewer",
  running: "Running",
  success: "Build Passed",
  failed: "Build Failed",
} as const;

export function useDocumentTitle() {
  const status = useRunStore((s) => s.status);

  useEffect(() => {
    document.title =
      status === "idle"
        ? "deviewer — live developer feedback"
        : `${GLYPH[status]} ${LABEL[status]} — deviewer`;
  }, [status]);
}
