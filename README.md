# deviewer

A live developer feedback console for GitHub pushes. Connect a repo, point its
webhook at `deviewer`, and watch every push trigger a pipeline whose logs
stream into the browser in real time — like a Replit-style terminal, but wired
to your own repos.

> **Phase 2 is live.** Real `child_process.spawn` execution, a Claude-powered
> "explain this failure" panel, file-based persistence (runs survive
> restarts), and a Chrome side-panel extension. The Phase 1 simulation is
> still the safe default for demos — see [Phase 2 — Real execution + Claude
> + extension](#phase-2--real-execution--claude--extension) for setup.

---

## Stack

| Layer        | Choice                                                     |
| ------------ | ---------------------------------------------------------- |
| Framework    | Next.js 14 (App Router) + TypeScript                       |
| UI           | React + TailwindCSS, dark mode by default                  |
| Realtime     | Server-Sent Events (`/api/stream`)                         |
| State        | In-memory singleton + JSON file persistence (`data/`)      |
| Webhook      | `/api/webhook` with optional HMAC verify                   |
| Runner       | `child_process.spawn` (real) or staged simulation          |
| AI           | Anthropic SDK · `claude-sonnet-4-6` · adaptive thinking    |
| Browser      | Chrome MV3 side-panel extension (`chrome-extension/`)      |

## Project layout

```
app/
  layout.tsx              # global shell, dark mode default
  page.tsx                # main UI
  globals.css             # tailwind + scrollbar styles
  api/
    webhook/route.ts      # POST: GitHub push / pull_request ingestion
    stream/route.ts       # GET:  SSE firehose (logs, runs, status, AI deltas)
    run/route.ts          # POST: manual re-run
    repo/route.ts         # GET / POST / DELETE: connected repos + their config
    events/route.ts       # GET:  fetch logs for a specific runId
    explain/route.ts      # POST: kick off Claude failure analysis (Phase 2)

components/
  Header.tsx              # logo + live stream indicator
  RepoInput.tsx           # connect / remove repos + per-repo command config
  EventList.tsx           # recent events (last 20)
  Console.tsx             # terminal-style log viewer
  StatusBadge.tsx         # idle / running / passed / failed
  PreviewLink.tsx         # generated build preview URL
  AIExplanationPanel.tsx  # streamed Claude explanation panel (Phase 2)
  Markdown.tsx            # tiny safe markdown-to-react renderer (Phase 2)
  useStream.ts            # SSE hook + reducer

lib/
  eventStore.ts           # singleton: repos, runs, logs, AI state, pub/sub
  testRunner.ts           # real spawn() pipeline + simulation fallback
  claudeExplainer.ts      # Anthropic streaming + prompt caching (Phase 2)
  persistence.ts          # debounced atomic JSON file writes (Phase 2)
  github.ts               # repo-URL parser + webhook signature verify
  types.ts                # shared types (LogEntry, RunEvent, RepoConfig, …)

chrome-extension/         # Chrome MV3 side-panel extension (Phase 2)
  manifest.json
  background.js
  sidepanel.{html,css,js}
  icons/
  README.md               # how to load unpacked

data/                     # JSON state file (gitignored, created on first run)
```

> **Note on routing:** the brief mentions `pages/api/...`, but Next.js 14 ships
> the App Router as the default and SSE works cleanly with `ReadableStream` +
> `Response`. Each handler still maps 1:1: `pages/api/webhook.ts` →
> `app/api/webhook/route.ts`, etc.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Then paste any repo URL (`https://github.com/owner/name` or `owner/name`) into
the **Connect** input. The repo is now ready to receive webhook events.

To prove the loop works without setting up GitHub:

* click **Re-run** in the console — a simulated pipeline kicks off,
* logs stream line-by-line,
* status flips `idle → running → success` (or `failed` on a flaky test),
* a fake preview URL is generated on success.

---

## Exposing localhost via ngrok

GitHub needs a public URL to deliver webhooks. Use [ngrok](https://ngrok.com):

```bash
# in a second terminal, with the dev server running on :3000
ngrok http 3000
```

Copy the `https://…ngrok-free.app` URL it prints — that's your public base URL.

---

## Configuring the GitHub webhook

In your repo: **Settings → Webhooks → Add webhook**.

| Field         | Value                                                     |
| ------------- | --------------------------------------------------------- |
| Payload URL   | `https://<your-ngrok-host>/api/webhook`                   |
| Content type  | `application/json`                                        |
| Secret        | *(optional)* same value as `GITHUB_WEBHOOK_SECRET`        |
| SSL verify    | Enabled                                                   |
| Events        | **Just the push event** + check **Pull requests**         |

Hit **Add webhook**. GitHub fires a `ping` event immediately — deviewer
acknowledges it and the next `git push` will trigger a real run.

### Optional: signature verification

```bash
cp .env.example .env.local
# set GITHUB_WEBHOOK_SECRET=your-shared-secret
```

When the secret is set, deviewer rejects requests whose
`X-Hub-Signature-256` header doesn't match. Leave it empty for local testing.

---

## Example payload

Drop this into a `curl` to simulate a push without touching GitHub:

```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{
    "ref": "refs/heads/main",
    "repository": { "full_name": "octocat/hello-world" },
    "pusher": { "name": "octocat" },
    "head_commit": {
      "id": "9fceb02d0ae598e95dc40b8b8b3e0f0a6b",
      "message": "feat: ship the live console",
      "author": { "username": "octocat", "name": "The Octocat" }
    }
  }'
```

You should see a new event appear in the timeline and logs stream into the
console immediately.

---

## How real-time works

1. The browser opens **one** `EventSource` to `/api/stream`.
2. On connect, the server sends a `snapshot` message so the UI restores state
   without a flash.
3. Every webhook, log line, and status change is broadcast through a singleton
   `EventEmitter` (`lib/eventStore.ts`) and forwarded to every subscriber.
4. A 15-second comment heartbeat (`: ping …`) keeps proxies (ngrok, nginx)
   from idling the connection.

Frontend reducer (`components/useStream.ts`) folds those messages into a tiny
state tree the UI renders. Auto-scroll only happens when you're already at the
bottom — scroll up to inspect, hit **↓ Resume tail** to lock back on.

---

## Replacing the simulation with real commands

`lib/testRunner.ts` is the only place to change:

```ts
import { spawn } from "node:child_process";

function runCommand(runId: string, cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: workspaceFor(runId) });
    child.stdout.on("data", (b) => eventStore.appendLog(runId, "info", b.toString()));
    child.stderr.on("data", (b) => eventStore.appendLog(runId, "error", b.toString()));
    child.on("close", (code) => (code === 0 ? resolve(0) : reject(new Error(`exit ${code}`))));
  });
}
```

Stream pipeline / state / preview wiring stays identical.

---

## API reference

| Method | Route                       | Purpose                                                         |
| ------ | --------------------------- | --------------------------------------------------------------- |
| POST   | `/api/webhook`              | GitHub push / pull_request ingestion                            |
| GET    | `/api/stream`               | SSE firehose: logs, runs, status, AI deltas, snapshot           |
| POST   | `/api/run`                  | Manually trigger a run (re-run last event)                      |
| GET    | `/api/repo`                 | List connected repos with their config                          |
| POST   | `/api/repo`                 | `{ repo, commands?: string[], workspace?: string }`             |
| DELETE | `/api/repo?repo=owner/name` | Disconnect a repo                                               |
| GET    | `/api/events?runId=...`     | Logs + run metadata + AI explanation for a specific run         |
| POST   | `/api/explain`              | `{ runId }` — start a Claude streamed failure analysis (Phase 2)|

---

## What's intentionally not here

* **No database.** State lives in memory and resets when the dev server
  restarts. That's a feature for an MVP — add Postgres / Redis when you need
  persistence across restarts or multi-instance deploys.
* **No auth.** Anyone hitting your ngrok URL can trigger runs. Fine for local
  testing; gate it behind Clerk / NextAuth before deploying.
* **No real workspace checkout.** The simulation pretends to install / test /
  build. Real execution needs a working tree per run; see the spawn snippet
  above.

---

## Stretch features included

- Filter logs by type (All / Info / Pass / Warn / Error) in the console header
- Multiple connected repos
- Last-20 run history with click-to-replay (was 10 in Phase 1)
- Auto-scroll with "resume tail" when you scroll up
- Optional HMAC signature verification on webhooks

---

## Phase 2 — Real execution + Claude + extension

Phase 2 layers four things on top of Phase 1 without breaking it: real shell
execution, AI failure analysis, file-based persistence, and a Chrome
side-panel extension. Each is opt-in.

### 1. Real command execution

`lib/testRunner.ts` no longer fakes the pipeline. Per-repo, you configure:

- **Workspace path** — an existing local checkout where commands run
- **Commands** — one shell command per line, executed in order; first
  non-zero exit fails the run

Open the **Config** drawer next to a connected repo in the UI to set both.

Mode selection at runtime:

| Condition                             | Mode                                          |
|---------------------------------------|-----------------------------------------------|
| `USE_SIMULATION=true`                 | Always simulate (Phase 1 behaviour, demo-safe) |
| Repo has commands **and** workspace   | Spawn real commands via `child_process.spawn` |
| Otherwise                             | Fall back to simulation, with a UI warning    |

Stdout and stderr are line-buffered (`readline`) and streamed into the same
SSE channel as everything else, so the UI experience is identical to the
simulation. A 10-minute per-command timeout SIGKILLs runaway processes.

> **Security note.** Commands come from your own repo config and are passed to
> `spawn(..., { shell: true })` so multi-word commands work. That's
> appropriate for an MVP on your own machine; do not expose this surface to
> untrusted users. For multi-tenant or hostile inputs, sandbox each run
> (Docker, Firecracker, gVisor) before going further.

To roll back to the simulator without touching code:

```bash
USE_SIMULATION=true npm run dev
```

### 2. Claude "Ask to explain this" panel

When a run finishes with `failed` status, an **Ask Claude to explain this**
button appears below the preview area. Clicking it:

1. POSTs to `/api/explain` with `{ runId }`
2. The server reads the last 200 log lines + run metadata, calls Claude
   (`claude-sonnet-4-6`, adaptive thinking, prompt-cached system prompt) via
   the official `@anthropic-ai/sdk` streaming API
3. Each token chunk broadcasts as `{ kind: "ai", runId, delta }` over the
   existing `/api/stream` SSE firehose — no new connection needed
4. The final text is persisted on the run object, so it survives restarts
   and renders next time you click that run

Setup:

```bash
cp .env.example .env.local
# add ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Get a key at <https://console.anthropic.com/settings/keys>. Without one,
the button surfaces a `ANTHROPIC_API_KEY is not configured` error — the rest
of deviewer keeps working.

The prompt is cached on the system block (`cache_control: ephemeral`), so
the second-and-onwards explanations cost ~10% of the first one's input
tokens. Verify cache hits via the `usage.cache_read_input_tokens` field in
the SDK response if you want to instrument it.

### 3. File-based persistence

Runs, logs, repo configs, and AI explanations are written to
`data/state.json` (debounced atomic write — temp file + rename) on every
mutation. On startup, the event store rehydrates from disk. Anything that
was `running` at shutdown gets demoted to `failed` since the spawned
process is gone.

- Last **20** runs are kept (rolling)
- `data/` is gitignored — it's per-machine local state
- Override the file path with `DEVIEWER_DATA_FILE=/some/path.json`

The interface (`eventStore.createRun`, `appendLog`, …) is unchanged from
Phase 1, so nothing downstream needed updating.

### 4. Chrome side-panel extension

`chrome-extension/` is a complete MV3 extension that mirrors the live
console in a Chrome side panel. Same SSE feed, same colour-coded logs,
same status badge, same AI explanation, plus a **Re-run** button.

Quick load:

1. `npm run dev` (deviewer running on `http://localhost:3000`)
2. Visit `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → pick `chrome-extension/`
4. Pin the icon, click it, the side panel opens
5. **⚙** in the panel header lets you point it at a different backend URL

CORS is already wired: `next.config.js` adds
`Access-Control-Allow-Origin: *` to all `/api/*` responses, so the
extension can hit them from `chrome-extension://` origins.

Full docs: [`chrome-extension/README.md`](chrome-extension/README.md).

### Phase 2 environment variables

```ini
# .env.local
ANTHROPIC_API_KEY=sk-ant-...     # required for /api/explain
USE_SIMULATION=                  # set to "true" to force the simulator
GITHUB_WEBHOOK_SECRET=           # optional HMAC verification (Phase 1)
DEVIEWER_DATA_FILE=              # optional override for the JSON store path
```

### Phase 2 behaviour matrix

| Scenario                                      | Result                                         |
|-----------------------------------------------|------------------------------------------------|
| No `ANTHROPIC_API_KEY`, click "Ask Claude"    | Inline 500 error, app continues working        |
| No commands/workspace, push or re-run         | Simulated pipeline + warning log line          |
| Commands set, workspace doesn't exist         | Run fails immediately with a clear error       |
| Server restart mid-run                        | Run marked `failed` on next boot, logs kept    |
| Extension can't reach backend                 | "stream offline" indicator + retry on settings |
| `USE_SIMULATION=true` + commands configured   | Simulation wins (env flag is the kill switch)  |
