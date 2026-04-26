"use client";

import { useState } from "react";

interface Props {
  repos: string[];
  onConnect: (repo: string) => Promise<void>;
  onRemove: (repo: string) => Promise<void>;
}

export function RepoInput({ repos, onConnect, onRemove }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onConnect(value);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-ink-700 bg-ink-850/60 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
        Connected repositories
      </h2>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://github.com/owner/repo"
          spellCheck={false}
          className="flex-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white shadow-[0_0_24px_-12px_theme(colors.accent.glow)] transition hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

      {repos.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {repos.map((r) => (
            <li
              key={r}
              className="group inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900 py-1 pl-3 pr-1 text-xs text-ink-100"
            >
              <span className="text-ink-500">●</span>
              {r}
              <button
                onClick={() => onRemove(r)}
                aria-label={`Remove ${r}`}
                className="ml-1 rounded-full p-1 text-ink-500 transition hover:bg-ink-700 hover:text-rose-300"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-ink-500">
          No repos connected yet. Add one, then point its webhook at <code className="text-ink-100">/api/webhook</code>.
        </p>
      )}
    </section>
  );
}
