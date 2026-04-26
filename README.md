# deviewer

A live developer feedback console for GitHub pushes. Connect a repo, point its
webhook at `deviewer`, and watch every push trigger a pipeline whose logs
stream into the browser in real time — like a Replit-style terminal, but wired
to your own repos.

> The default pipeline is **simulated** so you can demo the whole loop without
> any infra. The simulation is a single function (`lib/testRunner.ts`) that you
> can swap for `child_process.spawn` to run real `npm install` / `npm test` /
> `npm run build` against a checked-out commit.

---

## Stack

| Layer       | Choice                                      |
| ----------- | ------------------------------------------- |
| Framework   | Next.js 14 (App Router) + TypeScript        |
| UI          | React + TailwindCSS, dark mode by default   |
| Realtime    | Server-Sent Events (`/api/stream`)          |
| State       | In-memory singleton (`lib/eventStore.ts`)   |
| Webhook     | `/api/webhook` with optional HMAC verify    |

## Project layout

```
app/
  layout.tsx              # global shell, dark mode default
  page.tsx                # main UI
  globals.css             # tailwind + scrollbar styles
  api/
    webhook/route.ts      # POST: GitHub push / pull_request ingestion
    stream/route.ts       # GET:  SSE firehose (logs, runs, status)
    run/route.ts          # POST: manual re-run
    repo/route.ts         # GET / POST / DELETE: connected repos
    events/route.ts       # GET:  fetch logs for a specific runId

components/
  Header.tsx              # logo + live stream indicator
  RepoInput.tsx           # connect / remove repos
  EventList.tsx           # recent events (last 10)
  Console.tsx             # terminal-style log viewer
  StatusBadge.tsx         # idle / running / passed / failed
  PreviewLink.tsx         # generated build preview URL
  useStream.ts            # SSE hook + reducer

lib/
  eventStore.ts           # singleton: repos, runs, logs, pub/sub
  testRunner.ts           # simulated install / test / build pipeline
  github.ts               # repo-URL parser + webhook signature verify
  types.ts                # shared types (LogEntry, RunEvent, …)
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

| Method | Route                       | Purpose                                    |
| ------ | --------------------------- | ------------------------------------------ |
| POST   | `/api/webhook`              | GitHub push / pull_request ingestion       |
| GET    | `/api/stream`               | SSE firehose: logs, runs, status, snapshot |
| POST   | `/api/run`                  | Manually trigger a run (re-run last event) |
| GET    | `/api/repo`                 | List connected repos                       |
| POST   | `/api/repo`                 | `{ repo: "owner/name" }`                   |
| DELETE | `/api/repo?repo=owner/name` | Disconnect a repo                          |
| GET    | `/api/events?runId=...`     | Logs for a specific run                    |

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
- Last-10 run history with click-to-replay
- Auto-scroll with "resume tail" when you scroll up
- Optional HMAC signature verification on webhooks
