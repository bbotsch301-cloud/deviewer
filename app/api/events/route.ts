import { NextResponse } from "next/server";
import { eventStore } from "@/lib/eventStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ runs: eventStore.listRuns() });
  }
  const run = eventStore.getRun(runId);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
  return NextResponse.json({ run, logs: eventStore.logsFor(runId) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  if (!runId) {
    eventStore.clearAllRuns();
    return NextResponse.json({ ok: true, cleared: true });
  }
  eventStore.deleteRun(runId);
  return NextResponse.json({ ok: true, deleted: runId });
}
