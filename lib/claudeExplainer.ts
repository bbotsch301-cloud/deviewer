import Anthropic from "@anthropic-ai/sdk";
import { eventStore } from "./eventStore";
import type { LogEntry, RunEvent } from "./types";

const MODEL = "claude-sonnet-4-6";
const MAX_LOG_LINES = 200;
const MAX_TOKENS = 4096;

/**
 * Stable system prompt — kept byte-identical across requests so prompt
 * caching can hit on the second and subsequent explanations. Anything
 * volatile (logs, run metadata) is intentionally placed in the user turn.
 */
const SYSTEM_PROMPT = `You are a senior developer reviewing CI/CD pipeline output for a teammate.

Your job is to read the failed run's logs and explain, concisely:

1. **What failed** — name the specific stage and command that broke.
2. **Why it failed** — quote the relevant error line(s) and explain what they actually mean.
3. **How to fix it** — give a concrete next step. Include a code snippet or command when it helps.

Style guidelines:
- Use GitHub-flavoured markdown.
- Lead with the diagnosis. No filler ("Let me analyze…").
- Code, file paths, and shell commands always in backticks.
- If the failure looks flaky / environmental rather than a real code bug, say so.
- If there genuinely isn't enough information in the logs, say what would be needed.

Aim for ~150–250 words. Be useful, not exhaustive.`;

/**
 * Stream a Claude-generated explanation of a failed run into the event store.
 * Returns the final accumulated text so callers can decide what to do once
 * the stream completes.
 */
export async function explainRun(run: RunEvent, logs: LogEntry[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — see README for setup");
  }

  const client = new Anthropic({ apiKey });
  const userPrompt = buildUserPrompt(run, logs);

  eventStore.setAIStatus(run.id, "streaming");

  let acc = "";
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    stream.on("text", (delta) => {
      acc += delta;
      eventStore.appendAIDelta(run.id, delta);
    });

    await stream.finalMessage();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    eventStore.setAIStatus(run.id, "error", message);
    throw err;
  }

  eventStore.finishAI(run.id, acc);
  return acc;
}

function buildUserPrompt(run: RunEvent, logs: LogEntry[]): string {
  const trimmedLogs = logs.slice(-MAX_LOG_LINES);
  const truncated = logs.length > trimmedLogs.length;

  const meta = [
    `repo: ${run.repo}`,
    `branch: ${run.branch}`,
    `commit: ${run.commitSha} — ${run.commitMessage}`,
    `author: ${run.author}`,
    `trigger: ${run.trigger}`,
    `status: ${run.status}`,
  ].join("\n");

  const formatted = trimmedLogs
    .map((l) => `[${l.type}] ${l.message}`)
    .join("\n");

  return [
    "A CI/CD run just failed. Help the developer understand and fix it.",
    "",
    "## Run metadata",
    "```",
    meta,
    "```",
    "",
    `## Logs${truncated ? ` (last ${MAX_LOG_LINES} of ${logs.length})` : ""}`,
    "```",
    formatted || "(no logs captured)",
    "```",
  ].join("\n");
}
