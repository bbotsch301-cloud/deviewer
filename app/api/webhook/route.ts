import { NextResponse } from "next/server";
import { eventStore } from "@/lib/eventStore";
import { verifySignature } from "@/lib/github";
import { runPipeline } from "@/lib/testRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const event = req.headers.get("x-github-event") ?? "unknown";
  const signature = req.headers.get("x-hub-signature-256");
  const rawBody = await req.text();

  if (!verifySignature(rawBody, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  eventStore.recordWebhook({ receivedAt: Date.now(), event, body: payload });

  if (event === "ping") return NextResponse.json({ ok: true, pong: true });

  if (event !== "push" && event !== "pull_request") {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const parsed = event === "push" ? extractPush(payload) : extractPullRequest(payload);
  if (!parsed) {
    return NextResponse.json({ error: "unable to parse payload" }, { status: 422 });
  }

  eventStore.addRepo(parsed.repo);
  const config = eventStore.getRepoConfig(parsed.repo);

  if (config && config.branchFilter.length > 0 && !config.branchFilter.includes(parsed.branch)) {
    return NextResponse.json({ ok: true, ignored: `branch ${parsed.branch} not in filter` });
  }

  const commands = config?.commands ?? [];
  const run = eventStore.createRun({
    repo: parsed.repo,
    branch: parsed.branch,
    commitSha: parsed.commitSha,
    commitMessage: parsed.commitMessage,
    author: parsed.author,
    authorAvatarUrl: parsed.authorAvatarUrl,
    trigger: event,
    commands,
  });

  runPipeline(run, config).catch((err) => {
    eventStore.appendLog(run.id, "error", `unhandled runner error: ${String(err)}`);
    eventStore.finishRun(run.id, "failed", null);
  });

  return NextResponse.json({ ok: true, runId: run.id });
}

interface ParsedEvent {
  repo: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  authorAvatarUrl: string | null;
}

function extractPush(payload: any): ParsedEvent | null {
  const repo = payload?.repository?.full_name;
  const ref: string | undefined = payload?.ref;
  const branch = ref?.replace(/^refs\/heads\//, "") ?? "main";
  const head = payload?.head_commit ?? payload?.commits?.[payload.commits.length - 1];
  if (!repo || !head) return null;
  const author = head.author?.username ?? head.author?.name ?? payload?.pusher?.name ?? "unknown";
  return {
    repo,
    branch,
    commitSha: head.id ?? payload.after ?? "unknown",
    commitMessage: (head.message ?? "").split("\n")[0] || "(no message)",
    author,
    authorAvatarUrl: payload?.sender?.avatar_url ?? null,
  };
}

function extractPullRequest(payload: any): ParsedEvent | null {
  const pr = payload?.pull_request;
  const repo = payload?.repository?.full_name;
  if (!pr || !repo) return null;
  return {
    repo,
    branch: pr.head?.ref ?? "unknown",
    commitSha: pr.head?.sha ?? "unknown",
    commitMessage: `PR #${pr.number}: ${pr.title}`,
    author: pr.user?.login ?? "unknown",
    authorAvatarUrl: pr.user?.avatar_url ?? null,
  };
}
