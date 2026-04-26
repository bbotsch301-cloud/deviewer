import { eventStore } from "./eventStore";
import type { RunEvent } from "./types";

/**
 * Simulated CI pipeline: install → test → build.
 *
 * Each stage emits staged log lines through the event store, which broadcasts
 * them to every connected SSE client. Replace the `simulateStage` helper with
 * `child_process.spawn` to run real commands — the rest of the pipeline,
 * including streaming, status, and preview URL, will keep working.
 */
export async function runPipeline(run: RunEvent): Promise<void> {
  const log = (type: "info" | "success" | "error" | "warning", message: string) =>
    eventStore.appendLog(run.id, type, message);

  log("info", `▶ Triggered by ${run.trigger} on ${run.repo}@${run.branch}`);
  log("info", `  commit ${run.commitSha.slice(0, 7)} — "${run.commitMessage}"`);
  log("info", `  author ${run.author}`);
  log("info", "");

  try {
    await stageInstall(run.id);
    await stageTest(run.id);
    await stageBuild(run.id);

    const previewUrl = `https://preview-app.local/build-${run.id.slice(-6)}`;
    log("success", "");
    log("success", `✔ Pipeline succeeded in ${formatDuration(Date.now() - run.createdAt)}`);
    log("info", `  preview ready: ${previewUrl}`);
    eventStore.finishRun(run.id, "success", previewUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", "");
    log("error", `✘ Pipeline failed: ${msg}`);
    eventStore.finishRun(run.id, "failed", null);
  }
}

async function stageInstall(runId: string) {
  const log = bind(runId);
  log("info", "$ npm install");
  await sleep(220);
  log("info", "  resolving dependencies…");
  await sleep(380);
  log("info", "  fetching packages…");
  await sleep(420);
  log("info", "  linking 248 modules…");
  await sleep(260);
  log("success", "✓ dependencies installed (1.3s)");
  log("info", "");
}

async function stageTest(runId: string) {
  const log = bind(runId);
  log("info", "$ npm test");
  await sleep(180);
  log("info", "  PASS  src/utils/format.test.ts");
  await sleep(140);
  log("info", "  PASS  src/components/button.test.tsx");
  await sleep(180);
  log("info", "  PASS  src/lib/parser.test.ts");
  await sleep(160);

  // ~15% chance of a flaky failure to make the failed-state visible.
  if (Math.random() < 0.15) {
    log("warning", "  WARN  src/api/client.test.ts: deprecated assertion");
    await sleep(120);
    log("error", "  FAIL  src/api/client.test.ts");
    log("error", "    ● fetchUser › returns user on 200");
    log("error", "      expected 200 but received 500");
    throw new Error("1 test suite failed");
  }

  log("success", "✓ 4 suites, 27 tests passed (2.1s)");
  log("info", "");
}

async function stageBuild(runId: string) {
  const log = bind(runId);
  log("info", "$ npm run build");
  await sleep(220);
  log("info", "  compiling…");
  await sleep(360);
  log("info", "  bundling client (217 kB)…");
  await sleep(280);
  log("info", "  bundling server (84 kB)…");
  await sleep(220);
  log("info", "  optimizing assets…");
  await sleep(180);
  log("success", "✓ build artifact ready (1.3s)");
}

function bind(runId: string) {
  return (type: "info" | "success" | "error" | "warning", message: string) =>
    eventStore.appendLog(runId, type, message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
