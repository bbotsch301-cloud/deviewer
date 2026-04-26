"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Check, ChevronDown, Copy, Loader2, PlayCircle, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebhookStore } from "@/lib/store/webhook-store";
import { cn } from "@/lib/utils";

export function WebhookView() {
  const lastWebhookAt = useWebhookStore((s) => s.lastWebhookAt);
  const recent = useWebhookStore((s) => s.recentWebhooks);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const status = !lastWebhookAt
    ? "waiting"
    : Date.now() - lastWebhookAt < 60_000
    ? "connected"
    : "configured";

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Webhook setup</h2>
          <p className="text-xs text-muted-foreground">
            Wire deviewer to your GitHub repository in four steps.
          </p>
        </div>
        <ConnectionPill status={status} lastWebhookAt={lastWebhookAt} />
      </div>

      <div className="grid gap-4">
        <Step
          n={1}
          title="Start ngrok"
          body={
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Tunnel your local port so GitHub can reach it.
              </p>
              <CodeRow text="ngrok http 3000" />
            </>
          }
        />
        <Step
          n={2}
          title="Webhook URL"
          body={
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Use ngrok&apos;s HTTPS URL when behind a tunnel; otherwise the value below works locally.
              </p>
              <CodeRow text={`${origin}/api/webhook`} />
            </>
          }
        />
        <Step
          n={3}
          title="Add the webhook in GitHub"
          body={
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li>
                <span className="text-foreground">Go to</span> your repo →{" "}
                <span className="font-mono">Settings → Webhooks → Add webhook</span>
              </li>
              <li>
                <span className="text-foreground">Payload URL:</span> the URL from step 2
              </li>
              <li>
                <span className="text-foreground">Content type:</span>{" "}
                <span className="font-mono">application/json</span>
              </li>
              <li>
                <span className="text-foreground">Events:</span> Just{" "}
                <span className="font-mono">push</span> + check{" "}
                <span className="font-mono">Pull requests</span>
              </li>
              <li>
                <span className="text-foreground">Secret (optional):</span> match
                <span className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  GITHUB_WEBHOOK_SECRET
                </span>{" "}
                in your <span className="font-mono">.env.local</span>
              </li>
            </ol>
          }
        />
        <Step n={4} title="Test the connection" body={<TestConnection />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Webhook className="size-4 text-primary" />
            Recent webhook deliveries
          </CardTitle>
          <CardDescription>The last {recent.length || "—"} payloads received.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Nothing received yet. Push a commit or hit “Test connection” above.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((p, i) => (
                <PayloadRow key={i} payload={p} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionPill({
  status,
  lastWebhookAt,
}: {
  status: "waiting" | "configured" | "connected";
  lastWebhookAt: number | null;
}) {
  const variant: React.ComponentProps<typeof Badge>["variant"] =
    status === "waiting" ? "outline" : status === "connected" ? "success" : "secondary";
  const label =
    status === "waiting"
      ? "Waiting for events"
      : status === "connected"
      ? "Connected"
      : "Last received " +
        (lastWebhookAt ? formatDistanceToNow(lastWebhookAt, { addSuffix: true }) : "—");
  return <Badge variant={variant}>{label}</Badge>;
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: n * 0.05 }}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-3 border-b border-border bg-surface/40 px-4 py-2.5">
        <span className="grid size-6 place-items-center rounded-full gradient-accent text-[11px] font-semibold text-white">
          {n}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4">{body}</div>
    </motion.div>
  );
}

function CodeRow({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2/60 px-3 py-2">
      <code className="flex-1 truncate font-mono text-xs text-foreground">{text}</code>
      <Button size="icon-sm" variant="ghost" onClick={copy}>
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

function TestConnection() {
  const lastWebhookAt = useWebhookStore((s) => s.lastWebhookAt);
  const [busy, setBusy] = useState(false);
  const [pinged, setPinged] = useState<number | null>(null);
  const success = pinged != null && lastWebhookAt != null && lastWebhookAt >= pinged;

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Send a synthetic <span className="font-mono">ping</span> through deviewer to verify the
        plumbing.
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setPinged(Date.now());
            try {
              const res = await fetch("/api/webhook/test", { method: "POST" });
              if (!res.ok) throw new Error(String(res.status));
              toast.success("Ping fired", { description: "Look for it in the recent deliveries list." });
            } catch (err) {
              toast.error("Ping failed", { description: String(err) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <PlayCircle className="size-3.5" />
          )}
          Test connection
        </Button>
        <AnimatePresence>
          {success && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1.5 text-xs text-success"
            >
              <Check className="size-3.5" /> Received
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PayloadRow({ payload }: { payload: { receivedAt: number; event: string; body: unknown } }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-md border border-border bg-surface-2/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2/60"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
        <Badge variant="outline" className="font-mono text-[10px]">
          {payload.event}
        </Badge>
        <span className="text-muted-foreground">
          {formatDistanceToNow(payload.receivedAt, { addSuffix: true })}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-x-auto border-t border-border bg-background/40 px-3 py-2 font-mono text-[11px] text-muted-foreground"
          >
            {JSON.stringify(payload.body, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>
    </li>
  );
}
