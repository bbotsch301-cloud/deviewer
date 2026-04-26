import Anthropic from "@anthropic-ai/sdk";
import { eventStore } from "./eventStore";
import type { LogEntry, RunEvent } from "./types";

const MODEL = "claude-sonnet-4-6";
const MAX_LOG_LINES = 200;
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a senior developer pair-reviewing a CI/CD pipeline run with a teammate.

When asked to explain a failure for the first time, structure your answer:

1. **What failed** — the specific stage and command.
2. **Why it failed** — quote the relevant log line(s) and explain what they mean.
3. **How to fix it** — a concrete next step. Include a fenced \`bash\` code block with the exact command(s) to run when a fix is mechanical (e.g. \`npm install\`, \`pnpm dlx tsx ...\`).

Style:
- GitHub-flavoured markdown.
- Lead with the diagnosis. No filler ("Let me analyze…").
- Code, file paths, and shell commands always in backticks.
- Aim for ~150–250 words on the first explanation; shorter for follow-ups.
- If the failure is environmental/flaky rather than a code bug, say so.
- If logs don't have enough info, say what would be needed.

For follow-up questions, answer directly and reference the run's logs as needed. The user can already see the original logs — don't re-quote large portions, just point at the relevant line.`;

/**
 * Stream a Claude reply for the given run. The first call generates the
 * default failure explanation; subsequent calls treat `userMessage` as a
 * follow-up turn against the existing chat history on the run.
 */
export async function explainRun(
  run: RunEvent,
  logs: LogEntry[],
  userMessage: string,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const history = run.aiMessages;
  const isFirstTurn = history.length === 0;

  const messages: Anthropic.MessageParam[] = [];
  if (isFirstTurn) {
    messages.push({
      role: "user",
      content: buildInitialPrompt(run, logs, userMessage),
    });
  } else {
    for (const m of history) {
      if (m.role === "user" && m === history[0]) {
        messages.push({ role: "user", content: buildInitialPrompt(run, logs, m.content) });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }
    messages.push({ role: "user", content: userMessage });
  }

  eventStore.beginAITurn(run.id, userMessage);

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Adaptive thinking is supported at runtime on Sonnet 4.6 even when
      // older SDK type definitions only enumerate enabled/disabled.
      thinking: { type: "adaptive" } as unknown as Anthropic.ThinkingConfigParam,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    stream.on("text", (delta) => {
      eventStore.appendAIDelta(run.id, delta);
    });

    await stream.finalMessage();
    eventStore.finishAI(run.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    eventStore.failAI(run.id, message);
    throw err;
  }
}

function buildInitialPrompt(run: RunEvent, logs: LogEntry[], userMessage: string): string {
  const trimmed = logs.slice(-MAX_LOG_LINES);
  const truncated = logs.length > trimmed.length;

  const meta = [
    `repo: ${run.repo}`,
    `branch: ${run.branch}`,
    `commit: ${run.commitSha} — ${run.commitMessage}`,
    `author: ${run.author}`,
    `trigger: ${run.trigger}`,
    `status: ${run.status}`,
  ].join("\n");

  const formatted = trimmed.map((l) => `[${l.type}] ${l.message}`).join("\n");

  return [
    userMessage,
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
