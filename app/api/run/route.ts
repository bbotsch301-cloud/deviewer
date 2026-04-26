import { NextResponse } from "next/server";
import { eventStore } from "@/lib/eventStore";
import { runPipeline } from "@/lib/testRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manually trigger a run. Body is optional — defaults to re-running the last
 * known event, which is the "Re-run" button behaviour.
 */
export async function POST(req: Request) {
  if (eventStore.getStatus() === "running") {
    return NextResponse.json({ error: "a run is already in progress" }, { status: 409 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const last = eventStore.lastRun();
  const repo = body.repo ?? last?.repo ?? eventStore.listRepos()[0];

  if (!repo) {
    return NextResponse.json(
      { error: "no repo connected — connect one first or send { repo } in the body" },
      { status: 400 },
    );
  }

  const run = eventStore.createRun({
    repo,
    branch: body.branch ?? last?.branch ?? "main",
    commitSha: body.commitSha ?? last?.commitSha ?? "manual",
    commitMessage: body.commitMessage ?? last?.commitMessage ?? "Manual re-run",
    author: body.author ?? last?.author ?? "you",
    trigger: "manual",
  });

  runPipeline(run).catch((err) => {
    eventStore.appendLog(run.id, "error", `unhandled runner error: ${String(err)}`);
    eventStore.finishRun(run.id, "failed", null);
  });

  return NextResponse.json({ ok: true, runId: run.id });
}
