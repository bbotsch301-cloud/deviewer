import { NextResponse } from "next/server";
import { eventStore } from "@/lib/eventStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Simulate a GitHub `ping` event server-side so the user can verify the
 * webhook plumbing is wired up without leaving the app.
 */
export async function POST() {
  eventStore.recordWebhook({
    receivedAt: Date.now(),
    event: "ping",
    body: {
      zen: "It's not whether you win or lose…",
      hook_id: 0,
      hook: { type: "Repository", events: ["push", "pull_request"] },
      repository: null,
      sender: { login: "deviewer-self-test" },
    },
  });
  return NextResponse.json({ ok: true });
}
