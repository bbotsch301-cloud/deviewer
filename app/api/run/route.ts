import { NextResponse } from "next/server";
import { eventStore } from "@/lib/eventStore";
import { runPipeline } from "@/lib/testRunner";
import type { RepoConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const repos = eventStore.listRepos();
  const repo = body.repo ?? last?.repo ?? repos[0]?.name;

  if (!repo) {
    return NextResponse.json(
      { error: "no repo connected — connect one first or send { repo } in the body" },
      { status: 400 },
    );
  }

  const config: RepoConfig | undefined = eventStore.getRepoConfig(repo);
  const overrideCommand: string | undefined =
    typeof body.command === "string" && body.command.trim() ? body.command.trim() : undefined;
  const commands = overrideCommand ? [overrideCommand] : config?.commands ?? [];

  const run = eventStore.createRun({
    repo,
    branch: body.branch ?? last?.branch ?? "main",
    commitSha: body.commitSha ?? last?.commitSha ?? "manual",
    commitMessage: body.commitMessage ?? overrideCommand ?? last?.commitMessage ?? "Manual re-run",
    author: body.author ?? last?.author ?? "you",
    authorAvatarUrl: last?.authorAvatarUrl ?? null,
    trigger: "manual",
    commands,
  });

  const runConfig: RepoConfig | undefined = overrideCommand && config
    ? { ...config, commands: [overrideCommand] }
    : config;

  runPipeline(run, runConfig).catch((err) => {
    eventStore.appendLog(run.id, "error", `unhandled runner error: ${String(err)}`);
    eventStore.finishRun(run.id, "failed", null);
  });

  return NextResponse.json({ ok: true, runId: run.id });
}
