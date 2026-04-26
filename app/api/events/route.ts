import { NextResponse } from "next/server";
import { eventStore } from "@/lib/eventStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fetch logs for a specific run (used when a user clicks an older event in the
 * timeline). The live stream already pushes the active run's logs.
 */
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
