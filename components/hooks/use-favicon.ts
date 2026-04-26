"use client";

import { useEffect } from "react";
import { useRunStore } from "@/lib/store/run-store";

/** Status → fill colour for the favicon dot. */
const COLOR = {
  idle: "#7c3aed",
  running: "#f59e0b",
  success: "#10b981",
  failed: "#ef4444",
} as const;

function svgFor(status: keyof typeof COLOR): string {
  const fill = COLOR[status];
  const inner = status === "running"
    ? `<circle cx="32" cy="32" r="22" fill="${fill}" opacity="0.4"/><circle cx="32" cy="32" r="14" fill="${fill}"/>`
    : `<circle cx="32" cy="32" r="22" fill="${fill}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0a0a0f"/>${inner}</svg>`;
}

export function useFavicon() {
  const status = useRunStore((s) => s.status);

  useEffect(() => {
    const svg = svgFor(status);
    const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = url;
  }, [status]);
}
