"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  GitBranch,
  Loader2,
  Sparkles,
  Terminal,
  Webhook as WebhookIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useRepoStore } from "@/lib/store/repo-store";
import { DEFAULT_COMMANDS, type RepoConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OnboardingWizard({ open, onClose }: Props) {
  const setOnboardingComplete = useSettingsStore((s) => s.setOnboardingComplete);
  const setSelectedRepo = useRepoStore((s) => s.selectRepo);

  const [step, setStep] = useState(1);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoChecking, setRepoChecking] = useState(false);
  const [repoState, setRepoState] = useState<"idle" | "ok" | "missing" | "invalid">("idle");
  const [resolvedRepo, setResolvedRepo] = useState<string | null>(null);
  const [config, setConfig] = useState<RepoConfig>({
    commands: [...DEFAULT_COMMANDS],
    workspace: null,
    branchFilter: [],
    envVars: {},
  });
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  // Reset state every time the wizard re-opens.
  useEffect(() => {
    if (open) {
      setStep(1);
      setRepoUrl("");
      setRepoState("idle");
      setResolvedRepo(null);
      setConfig({
        commands: [...DEFAULT_COMMANDS],
        workspace: null,
        branchFilter: [],
        envVars: {},
      });
    }
  }, [open]);

  // Live GitHub validation.
  useEffect(() => {
    setRepoState("idle");
    setResolvedRepo(null);
    const trimmed = repoUrl.trim();
    if (!trimmed) return;
    const parsed = parseRepo(trimmed);
    if (!parsed) {
      setRepoState("invalid");
      return;
    }
    let cancelled = false;
    setRepoChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${parsed}`);
        if (cancelled) return;
        if (res.ok) {
          setRepoState("ok");
          setResolvedRepo(parsed);
          // Smart command detection — best-effort.
          const detected = await detectCommands(parsed);
          if (detected.length > 0 && !cancelled) {
            setConfig((c) => ({ ...c, commands: detected }));
          }
        } else if (res.status === 404) {
          setRepoState("missing");
        } else {
          setRepoState("ok");
          setResolvedRepo(parsed);
        }
      } catch {
        if (!cancelled) {
          setRepoState("ok");
          setResolvedRepo(parsed);
        }
      } finally {
        if (!cancelled) setRepoChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [repoUrl]);

  async function finish(skip: boolean) {
    if (!skip && resolvedRepo) {
      try {
        await fetch("/api/repo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ repo: resolvedRepo, ...config }),
        });
        setSelectedRepo(resolvedRepo);
        toast.success("Repo connected", { description: resolvedRepo });
      } catch (err) {
        toast.error("Failed to save repo", { description: String(err) });
      }
    }
    setOnboardingComplete(true);
    onClose();
  }

  const progress = (step / 3) * 100;
  const canAdvance =
    step === 1 ? repoState === "ok" && !!resolvedRepo : step === 2 ? config.commands.length > 0 : true;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10"
          >
            <button
              onClick={() => finish(true)}
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Skip onboarding"
            >
              <X className="size-4" />
            </button>

            <div className="relative h-32 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
              <div className="absolute inset-0 bg-dot-pattern bg-dot-pattern opacity-50" />
              <div className="relative flex h-full flex-col items-center justify-center gap-2">
                <motion.div
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12 }}
                  className="grid size-12 place-items-center rounded-2xl gradient-accent text-white shadow-2xl shadow-primary/40"
                >
                  <Sparkles className="size-5" />
                </motion.div>
                <h2 className="gradient-text text-lg font-semibold tracking-tight">
                  Welcome to deviewer
                </h2>
                <p className="text-xs text-muted-foreground">
                  Live developer feedback for every push.
                </p>
              </div>
            </div>

            <div className="border-b border-border">
              <Progress value={progress} className="h-0.5 rounded-none bg-transparent" />
            </div>

            <div className="px-6 py-5">
              <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Step {step} of 3</span>
                <button
                  onClick={() => finish(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.18 }}
                  className="min-h-[260px]"
                >
                  {step === 1 && (
                    <Step1
                      repoUrl={repoUrl}
                      setRepoUrl={setRepoUrl}
                      repoState={repoState}
                      checking={repoChecking}
                      resolvedRepo={resolvedRepo}
                    />
                  )}
                  {step === 2 && (
                    <Step2 config={config} setConfig={setConfig} />
                  )}
                  {step === 3 && (
                    <Step3 origin={origin} repo={resolvedRepo} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="flex items-center justify-between border-t border-border bg-surface/40 px-6 py-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((s) => (
                  <span
                    key={s}
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      s === step
                        ? "w-6 bg-primary"
                        : s < step
                        ? "bg-primary/60"
                        : "bg-muted",
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {step > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                    Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    size="sm"
                    disabled={!canAdvance}
                    onClick={() => setStep(step + 1)}
                  >
                    Continue
                    <ArrowRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => finish(false)}>
                    Finish
                    <Check className="size-3.5" />
                  </Button>
                )}
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Step1({
  repoUrl,
  setRepoUrl,
  repoState,
  checking,
  resolvedRepo,
}: {
  repoUrl: string;
  setRepoUrl: (s: string) => void;
  repoState: "idle" | "ok" | "missing" | "invalid";
  checking: boolean;
  resolvedRepo: string | null;
}) {
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <GitBranch className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Connect your repo</h3>
      </header>
      <p className="text-xs text-muted-foreground">
        Paste a GitHub repository URL. We&apos;ll verify it exists and detect smart command defaults.
      </p>
      <div className="space-y-1.5">
        <Label>Repository</Label>
        <div className="relative">
          <Input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            spellCheck={false}
            className="pr-9"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {checking ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : repoState === "ok" ? (
              <Check className="size-3.5 text-success" />
            ) : repoState === "missing" || repoState === "invalid" ? (
              <X className="size-3.5 text-destructive" />
            ) : null}
          </span>
        </div>
      </div>
      {repoState === "ok" && resolvedRepo && (
        <Badge variant="success">Found {resolvedRepo} on GitHub</Badge>
      )}
      {repoState === "missing" && (
        <Badge variant="destructive">Repo not found — check the URL or visibility</Badge>
      )}
      {repoState === "invalid" && repoUrl && (
        <Badge variant="warning">Use the format owner/name or a github.com URL</Badge>
      )}
    </div>
  );
}

function Step2({
  config,
  setConfig,
}: {
  config: RepoConfig;
  setConfig: (c: RepoConfig) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Terminal className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Configure commands</h3>
      </header>
      <p className="text-xs text-muted-foreground">
        We pre-filled smart defaults based on your repo. Reorder or replace as needed.
      </p>
      <ul className="space-y-1.5">
        {config.commands.map((c, i) => (
          <li
            key={`${c}-${i}`}
            className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-3 py-1.5"
          >
            <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-mono">
              {i + 1}
            </span>
            <code className="flex-1 truncate font-mono text-xs">{c}</code>
            <button
              onClick={() => setConfig({ ...config, commands: config.commands.filter((_, j) => j !== i) })}
              className="rounded p-1 hover:bg-muted hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) {
                setConfig({ ...config, commands: [...config.commands, draft.trim()] });
                setDraft("");
              }
            }
          }}
          placeholder="Add a command…"
          className="font-mono"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (draft.trim()) {
              setConfig({ ...config, commands: [...config.commands, draft.trim()] });
              setDraft("");
            }
          }}
        >
          Add
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label>Workspace path (optional)</Label>
        <Input
          value={config.workspace ?? ""}
          onChange={(e) => setConfig({ ...config, workspace: e.target.value || null })}
          placeholder="/abs/path/to/local/checkout"
          spellCheck={false}
        />
        <p className="text-[11px] text-muted-foreground">
          Leave blank to use the simulated pipeline first; you can always add this later.
        </p>
      </div>
    </div>
  );
}

function Step3({ origin, repo }: { origin: string; repo: string | null }) {
  const url = `${origin}/api/webhook`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <WebhookIcon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Set up the webhook</h3>
      </header>
      <p className="text-xs text-muted-foreground">
        Wire GitHub to deviewer. (You can revisit this any time from the Webhook tab.)
      </p>

      <ol className="space-y-3 text-xs">
        <li className="flex items-start gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-mono">
            1
          </span>
          <span className="text-muted-foreground">
            In a second terminal, run{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
              ngrok http 3000
            </code>{" "}
            to expose deviewer publicly.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-mono">
            2
          </span>
          <div className="flex-1 space-y-1.5">
            <span className="text-muted-foreground">Use this payload URL:</span>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2/60 px-3 py-1.5">
              <code className="flex-1 truncate font-mono text-[11px]">{url}</code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-muted"
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              </button>
            </div>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-mono">
            3
          </span>
          <span className="text-muted-foreground">
            In{" "}
            {repo ? (
              <a
                href={`https://github.com/${repo}/settings/hooks/new`}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline-offset-2 hover:underline"
              >
                {repo}&apos;s webhook settings
              </a>
            ) : (
              "your repo's webhook settings"
            )}
            : paste the URL above, set content type to{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">application/json</code>, choose{" "}
            <span className="text-foreground">push</span> + <span className="text-foreground">pull_request</span> events, and save.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ChevronRight className="size-4 text-primary" />
          <span className="text-foreground">You&apos;re ready. Hit Finish to enter the dashboard.</span>
        </li>
      </ol>
    </div>
  );
}

function parseRepo(input: string): string | null {
  const m = input.match(
    /^(?:https?:\/\/github\.com\/|git@github\.com:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i,
  );
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

async function detectCommands(repo: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents`);
    if (!res.ok) return [];
    const items = (await res.json()) as Array<{ name: string }>;
    const names = new Set(items.map((i) => i.name.toLowerCase()));
    if (names.has("package.json")) {
      return ["npm install", "npm test", "npm run build"];
    }
    if (names.has("makefile")) return ["make test"];
    if (names.has("cargo.toml")) return ["cargo build", "cargo test"];
    if (names.has("go.mod")) return ["go build ./...", "go test ./..."];
    if (names.has("pyproject.toml") || names.has("requirements.txt")) {
      return ["pip install -r requirements.txt", "pytest"];
    }
    return [];
  } catch {
    return [];
  }
}

export const __useMemoNoOp = useMemo;
