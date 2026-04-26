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

  if (event === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  if (event !== "push" && event !== "pull_request") {
    return NextResponse.json({ ok: true, ignored: event });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = event === "push" ? extractPush(payload) : extractPullRequest(payload);
  if (!parsed) {
    return NextResponse.json({ error: "unable to parse payload" }, { status: 422 });
  }

  eventStore.addRepo(parsed.repo);

  const run = eventStore.createRun({
    repo: parsed.repo,
    branch: parsed.branch,
    commitSha: parsed.commitSha,
    commitMessage: parsed.commitMessage,
    author: parsed.author,
    trigger: event,
  });

  // Fire-and-forget: the pipeline streams its own logs through the event store.
  runPipeline(run).catch((err) => {
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
}

function extractPush(payload: any): ParsedEvent | null {
  const repo = payload?.repository?.full_name;
  const ref: string | undefined = payload?.ref;
  const branch = ref?.replace(/^refs\/heads\//, "") ?? "main";
  const head = payload?.head_commit ?? payload?.commits?.[payload.commits.length - 1];
  if (!repo || !head) return null;
  return {
    repo,
    branch,
    commitSha: head.id ?? payload.after ?? "unknown",
    commitMessage: (head.message ?? "").split("\n")[0] || "(no message)",
    author: head.author?.username ?? head.author?.name ?? payload?.pusher?.name ?? "unknown",
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
  };
}
