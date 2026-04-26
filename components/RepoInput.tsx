"use client";

import { useState } from "react";
import { DEFAULT_COMMANDS, type ConnectedRepo, type RepoConfig } from "@/lib/types";

interface Props {
  repos: ConnectedRepo[];
  onConnect: (repo: string, config?: Partial<RepoConfig>) => Promise<void>;
  onRemove: (repo: string) => Promise<void>;
}

export function RepoInput({ repos, onConnect, onRemove }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

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
        <ul className="mt-3 space-y-2">
          {repos.map((r) => (
            <li key={r.name} className="rounded-md border border-ink-700 bg-ink-900">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-ink-500">●</span>
                <span className="flex-1 truncate text-xs text-ink-100">{r.name}</span>
                <button
                  onClick={() => setEditing(editing === r.name ? null : r.name)}
                  className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-500 transition hover:bg-ink-700 hover:text-ink-100"
                >
                  {editing === r.name ? "Close" : "Config"}
                </button>
                <button
                  onClick={() => onRemove(r.name)}
                  aria-label={`Remove ${r.name}`}
                  className="rounded p-1 text-ink-500 transition hover:bg-ink-700 hover:text-rose-300"
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {editing === r.name && (
                <RepoConfigEditor
                  repo={r}
                  onSave={async (config) => {
                    await onConnect(r.name, config);
                    setEditing(null);
                  }}
                />
              )}
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

function RepoConfigEditor({
  repo,
  onSave,
}: {
  repo: ConnectedRepo;
  onSave: (config: Partial<RepoConfig>) => Promise<void>;
}) {
  const [workspace, setWorkspace] = useState(repo.config.workspace ?? "");
  const [commandsText, setCommandsText] = useState(repo.config.commands.join("\n"));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const commands = commandsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await onSave({
        commands: commands.length ? commands : [...DEFAULT_COMMANDS],
        workspace: workspace.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-ink-700 px-3 py-3 text-xs">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
          Workspace path
        </label>
        <input
          value={workspace}
          onChange={(e) => setWorkspace(e.target.value)}
          spellCheck={false}
          placeholder="/abs/path/to/local/checkout (leave blank to simulate)"
          className="w-full rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
          Commands (one per line)
        </label>
        <textarea
          value={commandsText}
          onChange={(e) => setCommandsText(e.target.value)}
          spellCheck={false}
          rows={Math.min(6, Math.max(3, commandsText.split("\n").length))}
          className="w-full resize-y rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 font-mono text-xs text-ink-100 outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white transition hover:bg-accent-glow disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save config"}
        </button>
      </div>
      <p className="text-[10px] text-ink-500">
        Without a workspace path, runs fall back to the simulated pipeline. With one, deviewer
        spawns each command with <code className="text-ink-100">child_process.spawn</code> in that
        directory.
      </p>
    </div>
  );
}
