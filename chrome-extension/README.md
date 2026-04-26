# deviewer — Chrome Extension

A side panel that mirrors the deviewer live console in Chrome. Connects to your
locally running deviewer backend over the same `/api/stream` SSE endpoint the
main web UI uses, so you get the same pass/fail status, log stream, AI failure
analysis, and a re-run button — without needing the deviewer tab open.

## Load it

1. Make sure the deviewer dev server is running locally:

   ```bash
   npm run dev   # in the deviewer repo root
   ```

2. Open Chrome and visit **chrome://extensions**.
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked** and pick this `chrome-extension/` directory.
5. Pin the deviewer icon to the toolbar and click it. The side panel opens.

The first time, click the **⚙** button in the panel header and confirm the
backend URL (default: `http://localhost:3000`). It's persisted via
`chrome.storage.local`.

## What it shows

- **Status badge** — live `Idle / Running / Passed / Failed` mirror of the main UI
- **Re-run** — POSTs `/api/run` to re-trigger the last event
- **Live log stream** — colour-coded same as the web app (info/pass/error/warn)
- **Claude failure analysis** — when the current run is `failed` and an
  explanation has been generated (via the **Ask Claude** button in the main
  UI), the side panel shows it in a collapsible section

## CORS

The deviewer backend already sets `Access-Control-Allow-Origin: *` on
`/api/*` (see `next.config.js` in the project root). If you change that to a
strict origin, also allow the extension's origin
(`chrome-extension://<id>/`).

## Files

| File             | Purpose                                                  |
|------------------|----------------------------------------------------------|
| `manifest.json`  | MV3 manifest — `sidePanel` + `storage` permissions       |
| `background.js`  | Service worker that opens the side panel on icon click   |
| `sidepanel.html` | Markup for the panel                                     |
| `sidepanel.css`  | Dark theme matching the main app                         |
| `sidepanel.js`   | EventSource client + DOM rendering                       |
| `icons/`         | Toolbar / extension icons (16/48/128 px PNG)             |

The icons in `icons/` are placeholders — flat purple squares matching the
deviewer accent. Replace with your own when you ship.
