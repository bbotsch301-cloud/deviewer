"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import type { LogEntry } from "@/lib/types";
import type { TerminalAPI } from "./terminal";

const COLOR: Record<LogEntry["type"], string> = {
  info: "",
  success: "\x1b[32m",
  warning: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

function fmt(entry: LogEntry): string {
  const t = new Date(entry.timestamp);
  const ts =
    String(t.getHours()).padStart(2, "0") +
    ":" +
    String(t.getMinutes()).padStart(2, "0") +
    ":" +
    String(t.getSeconds()).padStart(2, "0");
  const tint = COLOR[entry.type] ?? "";
  return `${DIM}${ts}${RESET}  ${tint}${entry.message}${RESET}`;
}

interface Props {
  logs: LogEntry[];
  fontSize: number;
  lineHeight: number;
  onFollowChange: (following: boolean) => void;
  apiRef: MutableRefObject<TerminalAPI | null>;
}

export function TerminalCanvas({ logs, fontSize, lineHeight, onFollowChange, apiRef }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const writtenIdsRef = useRef<Set<string>>(new Set());

  // Init terminal once.
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "var(--font-mono), JetBrains Mono, Fira Code, ui-monospace, Menlo, Consolas, monospace",
      fontSize,
      lineHeight,
      letterSpacing: 0,
      cursorBlink: false,
      cursorStyle: "bar",
      scrollback: 5000,
      convertEol: true,
      disableStdin: true,
      allowProposedApi: true,
      theme: {
        background: "#00000000",
        foreground: "#e6e8ee",
        cursor: "#7c3aed",
        cursorAccent: "#0a0a0f",
        selectionBackground: "rgba(124,92,255,0.35)",
        black: "#0a0a0f",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#60a5fa",
        magenta: "#a78bfa",
        cyan: "#22d3ee",
        white: "#e6e8ee",
        brightBlack: "#4a5165",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#93c5fd",
        brightMagenta: "#c4b5fd",
        brightCyan: "#67e8f9",
        brightWhite: "#f5f7fb",
      },
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.loadAddon(search);

    term.open(containerRef.current);
    queueMicrotask(() => fit.fit());

    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // dimensions can be 0 mid-transition — ignore
      }
    });
    ro.observe(containerRef.current);

    let lastFollow = true;
    const dispScroll = term.onScroll(() => {
      const buf = term.buffer.active;
      const atBottom = buf.viewportY + term.rows >= buf.length;
      if (atBottom !== lastFollow) {
        lastFollow = atBottom;
        onFollowChange(atBottom);
      }
    });

    apiRef.current = {
      clear() {
        term.clear();
        writtenIdsRef.current.clear();
      },
      scrollToBottom() {
        term.scrollToBottom();
      },
      findNext(q: string) {
        if (q) search.findNext(q, { caseSensitive: false });
      },
      findPrevious(q: string) {
        if (q) search.findPrevious(q, { caseSensitive: false });
      },
    };

    return () => {
      ro.disconnect();
      dispScroll.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
      writtenIdsRef.current.clear();
      apiRef.current = null;
    };
  }, [apiRef, onFollowChange]);

  // React to font size / line height.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    term.options.lineHeight = lineHeight;
    fitRef.current?.fit();
  }, [fontSize, lineHeight]);

  // Stream logs in.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const seen = writtenIdsRef.current;
    if (seen.size === 0 && logs.length > 0) {
      // First batch — render via single write to avoid flicker.
      const out = logs.map(fmt).join("\r\n") + "\r\n";
      term.write(out);
      for (const l of logs) seen.add(l.id);
      return;
    }

    for (const l of logs) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      term.write(fmt(l) + "\r\n");
    }
  }, [logs]);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" />;
}
