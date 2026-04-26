import React from "react";

/**
 * Tiny markdown renderer — enough for Claude's failure explanations.
 *
 * Supports: # / ## / ### headings, **bold**, *italic*, `inline code`,
 * fenced ```code blocks```, - / * unordered lists, 1. ordered lists,
 * blank-line paragraph breaks. No HTML pass-through, so no
 * dangerouslySetInnerHTML — every leaf is a plain React string.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
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

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push({ type: "code", lang, text: buf.join("\n") });
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      out.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push({ type: "ol", items });
      continue;
    }

    // Blank line — separator
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: gather contiguous non-blank, non-block lines
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
      return (
        <pre className="my-2 overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-3 text-[12px] leading-relaxed">
          <code className="font-mono text-ink-100">{block.text}</code>
        </pre>
      );
    case "heading": {
      const inline = renderInline(block.text);
      if (block.level === 1) {
        return <h1 className="mt-3 mb-2 text-base font-semibold text-ink-100">{inline}</h1>;
      }
      if (block.level === 2) {
        return <h2 className="mt-3 mb-1.5 text-sm font-semibold text-ink-100">{inline}</h2>;
      }
      return (
        <h3 className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
          {inline}
        </h3>
      );
    }
    case "ul":
      return (
        <ul className="my-2 list-disc space-y-1 pl-5 text-sm text-ink-100">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="my-2 list-decimal space-y-1 pl-5 text-sm text-ink-100">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "p":
      return <p className="my-2 text-sm leading-relaxed text-ink-100">{renderInline(block.text)}</p>;
  }
}

/**
 * Inline renderer: walks the string and emits React nodes for `code`,
 * **bold**, and *italic*. Order matters — code first so we don't try to
 * format inside backticks.
 */
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let key = 0;
  // Tokenize by inline code first (no markdown formatting inside backticks).
  const parts = text.split(/(`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      out.push(
        <code
          key={key++}
          className="rounded bg-ink-900 px-1 py-0.5 font-mono text-[12px] text-accent-glow"
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
  // Process bold first (**...**), then italic (*...*).
  const boldSplit = text.split(/(\*\*[^*]+\*\*)/g);
  for (const seg of boldSplit) {
    if (/^\*\*[^*]+\*\*$/.test(seg)) {
      out.push(
        <strong key={nextKey()} className="font-semibold text-ink-100">
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
