"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRepoStore } from "@/lib/store/repo-store";

export function AddRepoDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [valid, setValid] = useState<"idle" | "ok" | "missing" | "invalid">("idle");
  const setSelected = useRepoStore((s) => s.selectRepo);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setValid("idle");
    }
  }, [open]);

  useEffect(() => {
    setValid("idle");
    const trimmed = url.trim();
    if (!trimmed) return;
    const parsed = parseRepo(trimmed);
    if (!parsed) {
      setValid("invalid");
      return;
    }
    let cancelled = false;
    setValidating(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${parsed}`);
        if (cancelled) return;
        if (res.status === 404) setValid("missing");
        else setValid("ok");
      } catch {
        if (!cancelled) setValid("ok");
      } finally {
        if (!cancelled) setValidating(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [url]);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/repo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setSelected(data.repo);
      toast.success("Repo connected", { description: data.repo });
      onClose();
    } catch (err) {
      toast.error("Failed to add repo", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a repository</DialogTitle>
          <DialogDescription>
            Quick add. Tweak commands, branches, and env vars in Settings later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Repository</Label>
          <div className="relative">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              spellCheck={false}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid === "ok") submit();
              }}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {validating ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              ) : valid === "ok" ? (
                <Check className="size-3.5 text-success" />
              ) : valid === "missing" || valid === "invalid" ? (
                <X className="size-3.5 text-destructive" />
              ) : null}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || valid !== "ok"}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Add repo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseRepo(input: string): string | null {
  const m = input.match(
    /^(?:https?:\/\/github\.com\/|git@github\.com:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i,
  );
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}
