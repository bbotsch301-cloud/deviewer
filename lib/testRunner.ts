import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { eventStore } from "./eventStore";
import type { LogType, RepoConfig, RunEvent } from "./types";

const STAGE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per command

/**
 * Execute the pipeline for a single run.
 *
 * Mode selection:
 *   1. `USE_SIMULATION=true` env var          → always simulate
 *   2. repo has commands AND a workspace      → spawn real commands
 *   3. otherwise                              → fall back to simulation
 *
 * Logs stream into `eventStore.appendLog` line-by-line, which broadcasts each
 * line over SSE. The shape is identical for real vs simulated mode, so the UI
 * doesn't need to know which one ran.
 */
export async function runPipeline(run: RunEvent, config?: RepoConfig): Promise<void> {
  const log = bind(run.id);
  log("info", `▶ Triggered by ${run.trigger} on ${run.repo}@${run.branch}`);
  log("info", `  commit ${run.commitSha.slice(0, 7)} — "${run.commitMessage}"`);
  log("info", `  author ${run.author}`);
  log("info", "");

  const useSimulation = process.env.USE_SIMULATION === "true";
  const canRunReal = !!config && config.commands.length > 0 && !!config.workspace;

  try {
    if (useSimulation || !canRunReal) {
      if (!useSimulation && !canRunReal) {
        log(
          "warning",
          "⚠ No workspace+commands configured for this repo — running simulated pipeline.",
        );
        log("info", "  Configure a workspace path in the UI to execute real commands.");
        log("info", "");
      }
      await runSimulated(run.id);
    } else {
      await runReal(run.id, config!);
    }

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

// ============================================================================
// Real execution
// ============================================================================

async function runReal(runId: string, config: RepoConfig): Promise<void> {
  const log = bind(runId);
  const cwd = config.workspace!;

  if (!existsSync(cwd)) {
    throw new Error(`workspace path does not exist: ${cwd}`);
  }

  log("info", `cwd: ${cwd}`);
  log("info", "");

  for (const command of config.commands) {
    log("info", `$ ${command}`);
    const started = Date.now();
    const exitCode = await spawnLogged(runId, command, cwd);
    const ms = Date.now() - started;

    if (exitCode !== 0) {
      throw new Error(`"${command}" exited with code ${exitCode} after ${formatDuration(ms)}`);
    }
    log("success", `✓ ${command} (${formatDuration(ms)})`);
    log("info", "");
  }
}

function spawnLogged(runId: string, command: string, cwd: string): Promise<number> {
  return new Promise<number>((resolve) => {
    // shell:true so the user can write "npm run build" / chained commands
    // without us parsing them. Commands come from the repo's own config —
    // a setup that's appropriate for an MVP, not for hostile multi-tenant.
    const child = spawn(command, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
    });

    const outRl = createInterface({ input: child.stdout });
    outRl.on("line", (line) => eventStore.appendLog(runId, "info", line));

    const errRl = createInterface({ input: child.stderr });
    errRl.on("line", (line) => eventStore.appendLog(runId, "error", line));

    const timeout = setTimeout(() => {
      eventStore.appendLog(
        runId,
        "error",
        `command exceeded ${formatDuration(STAGE_TIMEOUT_MS)} — sending SIGKILL`,
      );
      child.kill("SIGKILL");
    }, STAGE_TIMEOUT_MS);

    child.on("error", (err) => {
      eventStore.appendLog(runId, "error", `spawn error: ${err.message}`);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      outRl.close();
      errRl.close();
      resolve(code ?? 1);
    });
  });
}

// ============================================================================
// Simulation fallback (Phase 1 behaviour)
// ============================================================================

async function runSimulated(runId: string): Promise<void> {
  await stageInstall(runId);
  await stageTest(runId);
  await stageBuild(runId);
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
  return (type: LogType, message: string) => eventStore.appendLog(runId, type, message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}
