"use client";

import React, { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ApplyFixButton } from "./ai-panel";

/**
 * Lightweight, safe markdown renderer for Claude responses.
 * Supports: # / ## / ### headings, **bold**, *italic*, `inline code`,
 * fenced ```code blocks (with copy + Apply fix), - / * unordered lists,
 * 1. ordered lists, blank-line paragraph breaks. No HTML pass-through.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

type Block =
  | { type: "code"; lang: string; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push({ type: "code", lang, text: buf.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      out.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push({ type: "ul", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push({ type: "ol", items });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const buf: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (
        next.trim() === "" ||
        /^```/.test(next) ||
        /^#{1,3}\s+/.test(next) ||
        /^\s*[-*]\s+/.test(next) ||
        /^\s*\d+\.\s+/.test(next)
      ) {
        break;
      }
      buf.push(next);
      i++;
    }
    out.push({ type: "p", text: buf.join(" ") });
  }

  return out;
}

function Block({ block }: { block: Block }) {
  switch (block.type) {
    case "code":
      return <CodeBlock {...block} />;
    case "heading": {
      const inline = renderInline(block.text);
      if (block.level === 1)
        return <h3 className="mt-2 text-sm font-semibold tracking-tight">{inline}</h3>;
      if (block.level === 2)
        return <h4 className="mt-2 text-xs font-semibold tracking-tight">{inline}</h4>;
      return (
        <h5 className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {inline}
        </h5>
      );
    }
    case "ul":
      return (
        <ul className="list-disc space-y-1 pl-4">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-1 pl-4">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "p":
      return <p className="leading-relaxed">{renderInline(block.text)}</p>;
  }
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const isShell = ["bash", "sh", "zsh", "shell"].includes(lang);
  const oneLineCommand = isShell && !text.includes("\n") ? text.trim() : null;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background/60">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-2.5 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {lang || "code"}
        </span>
        <div className="flex items-center gap-1">
          {oneLineCommand && (
            <ApplyFixButton command={oneLineCommand} />
          )}
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3 text-success" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-foreground">
        <code>{text}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let key = 0;
  const parts = text.split(/(`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      out.push(
        <code
          key={key++}
          className={cn(
            "rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]",
            "text-primary",
          )}
        >
          {part.slice(1, -1)}
        </code>,
      );
      continue;
    }
    out.push(...formatBoldItalic(part, () => key++));
  }
  return out;
}

function formatBoldItalic(text: string, nextKey: () => number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const boldSplit = text.split(/(\*\*[^*]+\*\*)/g);
  for (const seg of boldSplit) {
    if (/^\*\*[^*]+\*\*$/.test(seg)) {
      out.push(
        <strong key={nextKey()} className="font-semibold text-foreground">
          {seg.slice(2, -2)}
        </strong>,
      );
      continue;
    }
    const italicSplit = seg.split(/(\*[^*]+\*)/g);
    for (const s of italicSplit) {
      if (/^\*[^*]+\*$/.test(s)) {
        out.push(
          <em key={nextKey()} className="italic">
            {s.slice(1, -1)}
          </em>,
        );
      } else if (s) {
        out.push(<React.Fragment key={nextKey()}>{s}</React.Fragment>);
      }
    }
  }
  return out;
}
