import { NextResponse } from "next/server";
import { explainRun } from "@/lib/claudeExplainer";
import { eventStore } from "@/lib/eventStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/explain  { runId, message? }
 *
 * First call (no message): kicks off the standard "explain this failure".
 * Subsequent calls: send a follow-up question and stream the answer.
 *
 * Streamed deltas land on /api/stream as `{ kind: "ai", runId, delta }`.
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
      { error: "another response is already streaming" },
      { status: 409 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const userMessage =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : "Explain why this build failed and how to fix it.";

  const logs = eventStore.logsFor(runId);

  explainRun(run, logs, userMessage).catch((err) => {
    console.warn("[deviewer] explainRun failed:", err);
  });

  return NextResponse.json({ ok: true, runId });
}
