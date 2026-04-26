// deviewer side panel — tails /api/stream, mirrors the main app's console.
//
// State lives in memory; the configured backend URL is the only thing we
// persist (chrome.storage.local). Reconnection is handled by the browser's
// EventSource implementation.

const DEFAULTS = { backendUrl: "http://localhost:3000" };
const MAX_LOG_LINES = 1000;

const els = {
  statusBadge: document.getElementById("status-badge"),
  statusLabel: document.querySelector("#status-badge .label"),
  rerunBtn: document.getElementById("rerun-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  settings: document.getElementById("settings"),
  backendInput: document.getElementById("backend-url"),
  saveSettingsBtn: document.getElementById("save-settings"),
  connDot: document.getElementById("conn-dot"),
  connText: document.getElementById("conn-text"),
  aiPanel: document.getElementById("ai-panel"),
  aiToggle: document.getElementById("ai-toggle"),
  aiBody: document.getElementById("ai-body"),
  console: document.getElementById("console"),
  runMeta: document.getElementById("run-meta"),
};

const state = {
  backendUrl: DEFAULTS.backendUrl,
  status: "idle",
  currentRunId: null,
  runs: [],
  logs: [],
  aiBuffers: {}, // runId -> accumulated streamed text
  follow: true,
  source: null,
};

// ---- bootstrapping ----
chrome.storage.local.get(["backendUrl"], (saved) => {
  state.backendUrl = saved.backendUrl || DEFAULTS.backendUrl;
  els.backendInput.value = state.backendUrl;
  connect();
});

els.settingsBtn.addEventListener("click", () => {
  els.settings.classList.toggle("hidden");
});

els.saveSettingsBtn.addEventListener("click", () => {
  const url = els.backendInput.value.trim().replace(/\/$/, "");
  if (!url) return;
  state.backendUrl = url;
  chrome.storage.local.set({ backendUrl: url }, () => {
    els.settings.classList.add("hidden");
    connect();
  });
});

els.rerunBtn.addEventListener("click", async () => {
  els.rerunBtn.disabled = true;
  try {
    const res = await fetch(`${state.backendUrl}/api/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      flashError(data.error || `re-run failed (${res.status})`);
    }
  } catch (err) {
    flashError(err?.message || "re-run failed");
  } finally {
    els.rerunBtn.disabled = false;
  }
});

els.aiToggle.addEventListener("click", () => {
  els.aiPanel.classList.toggle("collapsed");
});

els.console.addEventListener("scroll", () => {
  const el = els.console;
  state.follow = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
});

// ---- SSE connection ----
function connect() {
  if (state.source) {
    try { state.source.close(); } catch {}
  }
  setConn(false);
  state.logs = [];
  state.aiBuffers = {};
  renderConsole();

  const url = `${state.backendUrl}/api/stream`;
  let source;
  try {
    source = new EventSource(url);
  } catch (err) {
    flashError(`bad backend URL: ${err.message}`);
    return;
  }
  state.source = source;

  source.onopen = () => setConn(true);
  source.onerror = () => setConn(false);
  source.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handleStreamMessage(msg);
    } catch {
      // ignore malformed
    }
  };
}

function handleStreamMessage(msg) {
  switch (msg.kind) {
    case "snapshot":
      state.status = msg.status;
      state.currentRunId = msg.currentRunId;
      state.runs = msg.runs;
      state.logs = msg.logs.slice(-MAX_LOG_LINES);
      renderAll();
      return;
    case "log":
      if (state.currentRunId && msg.entry.runId !== state.currentRunId) return;
      state.logs.push(msg.entry);
      if (state.logs.length > MAX_LOG_LINES) state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
      appendLogDom(msg.entry);
      return;
    case "run": {
      const idx = state.runs.findIndex((r) => r.id === msg.run.id);
      if (idx >= 0) state.runs[idx] = msg.run;
      else {
        state.runs.unshift(msg.run);
        state.currentRunId = msg.run.id;
        state.logs = [];
        renderConsole();
      }
      if (msg.run.aiStatus === "done" || msg.run.aiStatus === "error") {
        delete state.aiBuffers[msg.run.id];
      }
      renderRunMeta();
      renderAI();
      return;
    }
    case "ai": {
      state.aiBuffers[msg.runId] = (state.aiBuffers[msg.runId] || "") + msg.delta;
      if (msg.runId === state.currentRunId) renderAI();
      return;
    }
    case "status":
      state.status = msg.status;
      if (msg.runId) state.currentRunId = msg.runId;
      renderStatus();
      return;
  }
}

// ---- rendering ----
function renderAll() {
  renderStatus();
  renderRunMeta();
  renderAI();
  renderConsole();
}

function renderStatus() {
  const cls = `badge badge-${state.status}`;
  els.statusBadge.className = cls;
  els.statusLabel.textContent = labelFor(state.status);
  els.rerunBtn.disabled = state.status === "running";
}

function labelFor(status) {
  switch (status) {
    case "idle": return "Idle";
    case "running": return "Running";
    case "success": return "Passed";
    case "failed": return "Failed";
    default: return status;
  }
}

function setConn(on) {
  els.connDot.className = `conn-dot ${on ? "conn-on" : "conn-off"}`;
  els.connText.textContent = on ? "stream connected" : "stream offline";
}

function renderRunMeta() {
  const run = state.runs.find((r) => r.id === state.currentRunId);
  if (!run) {
    els.runMeta.textContent = "Waiting for an event…";
    return;
  }
  const sha = (run.commitSha || "").slice(0, 7);
  els.runMeta.textContent = `${run.repo} · ${run.branch} · ${sha} · ${run.author}`;
}

function renderAI() {
  const run = state.runs.find((r) => r.id === state.currentRunId);
  if (!run || run.status !== "failed") {
    els.aiPanel.classList.add("hidden");
    return;
  }
  const text = state.aiBuffers[run.id] ?? run.aiExplanation ?? "";
  if (!text) {
    els.aiPanel.classList.add("hidden");
    return;
  }
  els.aiPanel.classList.remove("hidden");
  els.aiBody.textContent = text; // textContent — extension CSP forbids HTML innerHTML from string deltas
}

function renderConsole() {
  els.console.replaceChildren();
  if (state.logs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "console-empty";
    empty.textContent = state.status === "running"
      ? "Pipeline starting…"
      : "Push to a connected repo, or click Re-run, to see logs stream.";
    els.console.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  for (const entry of state.logs) frag.appendChild(buildLogLine(entry));
  els.console.appendChild(frag);
  scrollIfFollowing();
}

function appendLogDom(entry) {
  const empty = els.console.querySelector(".console-empty");
  if (empty) empty.remove();
  els.console.appendChild(buildLogLine(entry));
  scrollIfFollowing();
}

function buildLogLine(entry) {
  const row = document.createElement("div");
  row.className = `log-line log-${entry.type}`;
  const ts = document.createElement("span");
  ts.className = "ts";
  ts.textContent = formatTs(entry.timestamp);
  const msg = document.createElement("span");
  msg.className = "msg";
  msg.textContent = entry.message || " ";
  row.append(ts, msg);
  return row;
}

function scrollIfFollowing() {
  if (!state.follow) return;
  els.console.scrollTop = els.console.scrollHeight;
}

function formatTs(ms) {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function flashError(message) {
  const row = document.createElement("div");
  row.className = "log-line log-error";
  const ts = document.createElement("span");
  ts.className = "ts";
  ts.textContent = formatTs(Date.now());
  const msg = document.createElement("span");
  msg.className = "msg";
  msg.textContent = `[deviewer] ${message}`;
  row.append(ts, msg);
  els.console.appendChild(row);
  scrollIfFollowing();
}
