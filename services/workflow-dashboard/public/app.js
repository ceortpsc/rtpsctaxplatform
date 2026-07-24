const SAMPLE_INPUT = {
  "refund-status-update": { caseId: "CASE-10042", taxpayerRef: "TP-88", filingStage: "approved" },
  "transcript-intake": { requestId: "REQ-2201", products: ["account-transcript", "tds-packet"], authorized: true },
  "transmission-cycle": { batchId: "batch-alpha", documents: ["doc-1", "doc-2"] }
};

const els = {
  workflows: document.getElementById("workflows"),
  runs: document.getElementById("runs"),
  refresh: document.getElementById("refresh"),
  toast: document.getElementById("toast"),
  statTotal: document.getElementById("stat-total"),
  statOk: document.getElementById("stat-succeeded"),
  statFail: document.getElementById("stat-failed")
};

const openRuns = new Set();

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed (${response.status})`);
  }
  return data;
}

function renderWorkflows(workflows) {
  els.workflows.innerHTML = "";
  const template = document.getElementById("workflow-card-template");
  for (const workflow of workflows) {
    const node = template.content.cloneNode(true);
    node.querySelector(".card-title").textContent = workflow.name;
    node.querySelector(".card-desc").textContent = workflow.description;

    const triggerBadge = node.querySelector(".trigger");
    triggerBadge.textContent = formatTrigger(workflow.trigger);

    const tags = node.querySelector(".tags");
    for (const tag of workflow.tags) {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag;
      tags.appendChild(span);
    }

    const steps = node.querySelector(".steps");
    for (const step of workflow.steps) {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${step.name}</strong> — ${step.description}`;
      steps.appendChild(li);
    }

    const textarea = node.querySelector(".input-json");
    textarea.value = JSON.stringify(SAMPLE_INPUT[workflow.name] ?? {}, null, 2);

    const button = node.querySelector(".run-btn");
    button.textContent = workflow.trigger.type === "event" ? "Emit event + run" : "Run workflow";
    button.addEventListener("click", () => runWorkflow(workflow, textarea, button));

    els.workflows.appendChild(node);
  }
}

function formatTrigger(trigger) {
  if (trigger.type === "event") return `event · ${trigger.on}`;
  if (trigger.type === "schedule") return `schedule · ${Math.round(trigger.everyMs / 1000)}s`;
  return "manual";
}

async function runWorkflow(workflow, textarea, button) {
  let input;
  try {
    input = textarea.value.trim() ? JSON.parse(textarea.value) : {};
  } catch {
    showToast("Input must be valid JSON.", true);
    return;
  }

  button.disabled = true;
  try {
    let result;
    if (workflow.trigger.type === "event") {
      result = await api("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: workflow.trigger.on, payload: input })
      });
      const run = result.runs[0];
      showToast(`Event "${workflow.trigger.on}" triggered ${result.triggered} run(s): ${run ? run.status : "n/a"}`,
        run && run.status === "failed");
      if (run) openRuns.add(run.id);
    } else {
      result = await api(`/api/workflows/${encodeURIComponent(workflow.name)}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });
      showToast(`${workflow.name}: ${result.run.status}`, result.run.status === "failed");
      openRuns.add(result.run.id);
    }
    await loadRuns();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function renderRuns(payload) {
  const { runs, stats } = payload;
  els.statTotal.textContent = stats.total;
  els.statOk.textContent = stats.succeeded;
  els.statFail.textContent = stats.failed;

  if (!runs.length) {
    els.runs.innerHTML = '<p class="empty">No runs yet. Trigger a workflow to get started.</p>';
    return;
  }

  els.runs.innerHTML = "";
  for (const run of runs) {
    const wrapper = document.createElement("div");
    wrapper.className = "run" + (openRuns.has(run.id) ? " open" : "");

    const summary = document.createElement("div");
    summary.className = "run-summary";
    summary.innerHTML = `
      <span class="status-dot ${run.status}"></span>
      <span class="run-name">${run.workflow}</span>
      <span class="run-meta">
        <span>${run.trigger}</span>
        <span>${run.durationMs != null ? run.durationMs + "ms" : "…"}</span>
      </span>`;
    summary.addEventListener("click", () => {
      if (openRuns.has(run.id)) openRuns.delete(run.id);
      else openRuns.add(run.id);
      wrapper.classList.toggle("open");
    });

    const detail = document.createElement("div");
    detail.className = "run-detail";
    detail.appendChild(buildDetail(run));

    wrapper.appendChild(summary);
    wrapper.appendChild(detail);
    els.runs.appendChild(wrapper);
  }
}

function buildDetail(run) {
  const frag = document.createDocumentFragment();
  for (const step of run.steps) {
    const row = document.createElement("div");
    row.className = "step-row";
    row.innerHTML = `
      <span class="status-dot ${step.status}"></span>
      <span class="step-name">${step.name}</span>
      <span class="step-dur">${step.durationMs != null ? step.durationMs + "ms" : "…"}</span>`;
    frag.appendChild(row);
  }

  if (run.error) {
    const err = document.createElement("div");
    err.className = "run-error";
    err.textContent = run.error;
    frag.appendChild(err);
  }

  const output = document.createElement("pre");
  output.className = "output-block";
  output.textContent = JSON.stringify(run.output ?? run.input, null, 2);
  frag.appendChild(output);
  return frag;
}

async function loadWorkflows() {
  try {
    const data = await api("/api/workflows");
    renderWorkflows(data.workflows);
  } catch (error) {
    els.workflows.innerHTML = `<p class="empty">Failed to load workflows: ${error.message}</p>`;
  }
}

async function loadRuns() {
  try {
    const data = await api("/api/runs");
    renderRuns(data);
  } catch (error) {
    showToast(error.message, true);
  }
}

els.refresh.addEventListener("click", loadRuns);

loadWorkflows();
loadRuns();
setInterval(loadRuns, 4000);
