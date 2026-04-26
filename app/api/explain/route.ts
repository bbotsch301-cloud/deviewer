import { NextResponse } from "next/server";
import { explainRun } from "@/lib/claudeExplainer";
import { eventStore } from "@/lib/eventStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/explain  { runId: string }
 *
 * Kicks off a Claude streaming explanation for the named run. The route
 * itself returns immediately with `{ ok: true, runId }` — the streamed
 * deltas land on the live `/api/stream` SSE channel as `{kind:"ai", ...}`
 * messages, and the finished explanation persists on the run object.
 */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const runId = String(body?.runId ?? "");
  if (!runId) return NextResponse.json({ error: "missing runId" }, { status: 400 });

  const run = eventStore.getRun(runId);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  if (run.aiStatus === "streaming") {
    return NextResponse.json(
      { error: "an explanation is already streaming for this run" },
      { status: 409 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const logs = eventStore.logsFor(runId);

  // Fire-and-forget. Errors are reported through the event store so the UI
  // sees them — no need to await here.
  explainRun(run, logs).catch((err) => {
    console.warn("[deviewer] explainRun failed:", err);
  });

  return NextResponse.json({ ok: true, runId });
}
