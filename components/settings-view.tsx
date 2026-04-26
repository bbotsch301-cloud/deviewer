"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Eye,
  GitBranch,
  Keyboard,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useRepoStore } from "@/lib/store/repo-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useRunStore } from "@/lib/store/run-store";
import type { ConnectedRepo, RepoConfig } from "@/lib/types";

export function SettingsView() {
  const repos = useRepoStore((s) => s.repos);
  const selected = useRepoStore((s) => s.selectedRepo);
  const repo = repos.find((r) => r.name === selected) ?? repos[0];

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Configure your project, notifications, appearance, and more.
        </p>
      </div>

      {repo && <RepoSettings repo={repo} />}
      <NotificationSettings />
      <AppearanceSettings />
      <DangerZone />
    </div>
  );
}

function RepoSettings({ repo }: { repo: ConnectedRepo }) {
  const [draft, setDraft] = useState<RepoConfig>(repo.config);
  const [repoUrl, setRepoUrl] = useState(repo.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(repo.config);
    setRepoUrl(repo.name);
  }, [repo]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/repo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo: repoUrl, ...draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      toast.success("Saved", { description: data.repo });
    } catch (err) {
      toast.error("Save failed", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <GitBranch className="size-4 text-primary" />
        <div>
          <CardTitle className="text-sm">Repository</CardTitle>
          <CardDescription>Configure how runs execute for this repo.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field
          label="Repo URL"
          help="Format: owner/name or https://github.com/owner/name"
        >
          <Input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            spellCheck={false}
          />
        </Field>

        <Field label="Workspace path" help="Absolute local path where commands run.">
          <Input
            value={draft.workspace ?? ""}
            onChange={(e) => setDraft({ ...draft, workspace: e.target.value || null })}
            spellCheck={false}
            placeholder="/abs/path/to/repo"
          />
        </Field>

        <Field
          label="Default branches"
          help="Only trigger on these branches. Empty matches all."
        >
          <BranchTags
            value={draft.branchFilter}
            onChange={(branchFilter) => setDraft({ ...draft, branchFilter })}
          />
        </Field>

        <Field label="Commands" help="Run sequentially. First non-zero exit fails the run.">
          <CommandsEditor
            value={draft.commands}
            onChange={(commands) => setDraft({ ...draft, commands })}
          />
        </Field>

        <Field label="Environment variables" help="Injected into every command.">
          <EnvVarsEditor
            value={draft.envVars}
            onChange={(envVars) => setDraft({ ...draft, envVars })}
          />
        </Field>

        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const browserOn = useSettingsStore((s) => s.browserNotifications);
  const setBrowserOn = useSettingsStore((s) => s.setBrowserNotifications);
  const soundOn = useSettingsStore((s) => s.soundNotifications);
  const setSoundOn = useSettingsStore((s) => s.setSoundNotifications);
  const trigger = useSettingsStore((s) => s.notificationTrigger);
  const setTrigger = useSettingsStore((s) => s.setNotificationTrigger);

  async function onBrowserChange(v: boolean) {
    if (v && typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Permission denied", { description: "Enable in browser settings." });
        return;
      }
    }
    setBrowserOn(v);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Bell className="size-4 text-primary" />
        <div>
          <CardTitle className="text-sm">Notifications</CardTitle>
          <CardDescription>How deviewer alerts you when builds finish.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Toggle
          label="Browser notifications"
          help="Native push when this tab isn't focused."
          checked={browserOn}
          onChange={onBrowserChange}
        />
        <Toggle
          label="Sound notifications"
          help="Subtle chime on success, buzz on failure."
          checked={soundOn}
          onChange={setSoundOn}
        />
        <Field label="Notify on" help="Which build outcomes trigger notifications.">
          <Select value={trigger} onValueChange={(v) => setTrigger(v as any)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Success or failure</SelectItem>
              <SelectItem value="success">Success only</SelectItem>
              <SelectItem value="failure">Failure only</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}

function AppearanceSettings() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fontSize = useSettingsStore((s) => s.terminalFontSize);
  const setFontSize = useSettingsStore((s) => s.setTerminalFontSize);
  const lineHeight = useSettingsStore((s) => s.terminalLineHeight);
  const setLineHeight = useSettingsStore((s) => s.setTerminalLineHeight);
  const aiAuto = useSettingsStore((s) => s.aiAutoOpenOnFailure);
  const setAIAuto = useSettingsStore((s) => s.setAIAutoOpenOnFailure);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Eye className="size-4 text-primary" />
        <div>
          <CardTitle className="text-sm">Appearance</CardTitle>
          <CardDescription>Tune the look and feel.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Theme" help="Three depth levels of dark.">
          <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="darker">Darker</SelectItem>
              <SelectItem value="oled">OLED Black</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label={`Terminal font size (${fontSize}px)`} help="12 – 20 pixels.">
          <Slider
            value={[fontSize]}
            min={12}
            max={20}
            step={1}
            onValueChange={([v]) => setFontSize(v)}
            className="max-w-sm"
          />
        </Field>

        <Field label={`Line height (${lineHeight.toFixed(2)})`} help="Terminal line spacing.">
          <Slider
            value={[lineHeight * 100]}
            min={110}
            max={180}
            step={5}
            onValueChange={([v]) => setLineHeight(v / 100)}
            className="max-w-sm"
          />
        </Field>

        <Toggle
          label="Auto-open AI panel on failure"
          help="Slide out the explainer the moment a build fails."
          checked={aiAuto}
          onChange={setAIAuto}
        />
      </CardContent>
    </Card>
  );
}

function DangerZone() {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = useSettingsStore((s) => s.reset);

  return (
    <Card className="border-destructive/30 bg-destructive/[0.02]">
      <CardHeader>
        <CardTitle className="text-sm text-destructive">Danger zone</CardTitle>
        <CardDescription>
          These actions are immediate. Be careful.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-destructive/20">
        <DangerRow
          title="Clear all run history"
          description="Removes every run and its logs from disk."
          actionLabel="Clear history"
          onAction={() => setConfirmClear(true)}
        />
        <DangerRow
          title="Reset all settings"
          description="Restore deviewer's default preferences."
          actionLabel="Reset"
          onAction={() => setConfirmReset(true)}
        />
      </CardContent>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear all run history?</DialogTitle>
            <DialogDescription>This deletes every run and log. Cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await fetch("/api/events", { method: "DELETE" });
                useRunStore.getState().clearRuns();
                toast.success("Run history cleared");
                setConfirmClear(false);
              }}
            >
              Clear everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset all settings?</DialogTitle>
            <DialogDescription>Restore the original defaults. Repos and runs are kept.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                reset();
                toast.success("Settings reset");
                setConfirmReset(false);
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DangerRow({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button variant="destructive" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label className="text-foreground normal-case tracking-normal">{label}</Label>
        {help && <p className="mt-0.5 text-[11px] text-muted-foreground">{help}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CommandsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-1.5">
      <ul className="space-y-1.5">
        {value.map((cmd, i) => (
          <li
            key={`${cmd}-${i}`}
            className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-2 py-1.5"
          >
            <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-mono text-muted-foreground">
              {i + 1}
            </span>
            <code className="flex-1 truncate font-mono text-xs">{cmd}</code>
            <button
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="rounded p-1 hover:bg-muted hover:text-destructive"
              aria-label="Remove"
            >
              <X className="size-3" />
            </button>
            <button
              disabled={i === 0}
              onClick={() => {
                const next = [...value];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              disabled={i === value.length - 1}
              onClick={() => {
                const next = [...value];
                [next[i], next[i + 1]] = [next[i + 1], next[i]];
                onChange(next);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label="Move down"
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="npm test"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) {
                onChange([...value, draft.trim()]);
                setDraft("");
              }
            }
          }}
          className="font-mono"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (draft.trim()) {
              onChange([...value, draft.trim()]);
              setDraft("");
            }
          }}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

function EnvVarsEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const entries = Object.entries(value);
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No env vars configured.</p>
      )}
      <ul className="space-y-1.5">
        {entries.map(([key, val]) => (
          <li
            key={key}
            className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-2 py-1.5"
          >
            <code className="font-mono text-xs">{key}</code>
            <Separator orientation="vertical" className="h-4" />
            <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
              {val.replace(/./g, "•")}
            </code>
            <button
              onClick={() => {
                const { [key]: _, ...rest } = value;
                onChange(rest);
              }}
              className="rounded p-1 hover:bg-muted hover:text-destructive"
              aria-label="Remove"
            >
              <Trash2 className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={k}
          onChange={(e) => setK(e.target.value)}
          placeholder="KEY"
          spellCheck={false}
          className="font-mono"
        />
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="value"
          spellCheck={false}
          type="password"
          className="font-mono"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (k.trim()) {
              onChange({ ...value, [k.trim()]: v });
              setK("");
              setV("");
            }
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function BranchTags({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-surface-2 p-1.5">
      {value.map((b) => (
        <span
          key={b}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px]"
        >
          {b}
          <button onClick={() => onChange(value.filter((x) => x !== b))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const v = draft.trim();
            if (v && !value.includes(v)) onChange([...value, v]);
            setDraft("");
          }
        }}
        placeholder={value.length ? "" : "main, develop, …"}
        className="flex-1 bg-transparent text-xs outline-none"
        spellCheck={false}
      />
    </div>
  );
}

export function SettingsKeyboardHint() {
  return (
    <p className="text-[11px] text-muted-foreground">
      <Keyboard className="mr-1 inline size-3" />
      Press <kbd className="rounded bg-muted px-1 font-mono">?</kbd> to view shortcuts.
    </p>
  );
}
