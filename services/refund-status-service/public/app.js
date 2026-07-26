/* global fetch, document, localStorage */
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function credHeaders() {
  const headers = { "content-type": "application/json" };
  const id = $("clientId").value.trim();
  const secret = $("clientSecret").value;
  if (id) headers["x-api-client-id"] = id;
  if (secret) headers["x-api-client-secret"] = secret;
  const token = localStorage.getItem("rtpSessionToken");
  if (token) headers["authorization"] = `Bearer ${token}`;
  return headers;
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...credHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

async function loadClients() {
  const data = await api("/api/clients");
  $("clientBadge").textContent = `API ${data.counts.api} · TDS ${data.counts.tds}`;
  $("clientStatus").textContent =
    `API provisioned: ${data.apiProvisioned}\nTDS provisioned: ${data.tdsProvisioned}\n` +
    data.clients.api.concat(data.clients.tds).map((c) => `${c.kind}: ${c.id} [${c.status}]`).join("\n");
  const saved = localStorage.getItem("rtpClientId");
  if (saved && !$("clientId").value) $("clientId").value = saved;
}

async function loadTunnel() {
  try {
    const data = await api("/rtpsc/tunnel");
    const probe = data.probe || {};
    $("tunnelBadge").textContent =
      `Gateway Comms Tunnel: ${probe.status || "unknown"} · ${probe.provider || "USDTFS"}\n` +
      `${probe.message || ""}`;
  } catch (e) {
    $("tunnelBadge").textContent = `Tunnel probe failed: ${e.message}`;
  }
}

async function authenticate() {
  localStorage.setItem("rtpClientId", $("clientId").value.trim());
  const data = await api("/rtpsc/auth", {
    method: "POST",
    body: JSON.stringify({})
  });
  localStorage.setItem("rtpSessionToken", data.session_token || data.accessToken || "");
  $("sessionPanel").hidden = false;
  $("sessionPanel").textContent =
    `Authenticated scope=${data.scope}\nClient ${data.client.id}\nToken ${String(data.session_token || "").slice(0, 18)}…`;
  toast("Authenticated");
}

async function refreshCases() {
  const data = await api("/rtpsc/cases");
  const wrap = $("cases");
  const cases = Array.isArray(data) ? data : data.cases || [];
  if (!cases.length) {
    wrap.textContent = "No cases yet.";
    return;
  }
  wrap.innerHTML = "";
  cases.forEach((c) => {
    const el = document.createElement("div");
    el.className = "item";
    const id = c.caseId || c.id;
    el.innerHTML =
      `<strong>${id}</strong> · ${c.latestStage || c.filingStage || "ingested"}` +
      `<div class="meta">${c.taxpayerRef} · $${c.amount ?? "—"}</div>`;
    el.onclick = () => showCase(id);
    wrap.appendChild(el);
  });
}

function formatPhrase(phrase) {
  if (!phrase) return "";
  if (typeof phrase === "string") return phrase;
  return phrase.text || "";
}

async function showCase(id) {
  const data = await api(`/rtpsc/cases/${encodeURIComponent(id)}`);
  const c = data.case;
  const timeline = data.timeline || c.timeline || [];
  $("detail").textContent =
    `${c.caseId || c.id}\nTaxpayer: ${c.taxpayerRef}\nAmount: ${c.amount ?? "—"}\n` +
    `Filing: ${c.filingStage} · Trace: ${c.latestStage || "ingested"}\n` +
    `Status: ${c.status} · Risk: ${c.riskScore} (${c.priority})\n` +
    `Intel: ${c.intelligence ? `${c.intelligence.score}/100 ${c.intelligence.band}` : "n/a"}\n` +
    `Ledger: ${c.ledger ? `${c.ledger.clientName || ""} ack=${c.ledger.ackCode || "—"}` : "n/a"}\n\n` +
    `Timeline (${timeline.length}):\n` +
    timeline
      .map((t) => {
        const phrase = formatPhrase(t.phrase);
        return (
          `• [${t.stage || t.type}] ${t.label || t.detail || ""}` +
          (phrase ? `\n    phrase: ${phrase}` : "")
        );
      })
      .join("\n");
}

async function ingest() {
  localStorage.setItem("rtpClientId", $("clientId").value.trim());
  const data = await api("/rtpsc/cases/ingest", {
    method: "POST",
    body: JSON.stringify({
      caseId: $("caseId").value.trim(),
      taxpayerRef: $("taxpayerRef").value.trim(),
      filingStage: $("stage").value,
      amount: Number($("amount").value),
      source: "api"
    })
  });
  $("result").hidden = false;
  $("result").textContent =
    `INGESTED\n${data.case.caseId || data.case.id}\nStage ${data.case.latestStage}\n` +
    `Status ${data.case.status}\nClient ${data.authenticatedClient.id}`;
  toast("Case ingested");
  await refreshCases();
  await showCase(data.case.caseId || data.case.id);
}

async function fullRefund() {
  localStorage.setItem("rtpClientId", $("clientId").value.trim());
  const caseId = $("caseId").value.trim();
  const data = await api(`/rtpsc/cases/${encodeURIComponent(caseId)}/run-full-path`, {
    method: "POST",
    body: JSON.stringify({
      taxpayerRef: $("taxpayerRef").value.trim(),
      amount: Number($("amount").value),
      source: "api",
      channel: "TOPS"
    })
  });
  $("result").hidden = false;
  const tunnel = data.tunnelSession
    ? `\nTunnel ${data.tunnelSession.channel}: ${data.tunnelSession.status}`
    : "";
  $("result").textContent =
    `FULL FEDERAL PATH\n${data.case.caseId || data.case.id}\n` +
    `Trace ${data.case.latestStage}\nTimeline ${data.timeline.length} events\n` +
    `Intel ${data.case.intelligence?.score}/100${tunnel}`;
  toast("Full federal path complete");
  await refreshCases();
  await showCase(data.case.caseId || data.case.id);
}

$("authBtn").onclick = () => authenticate().catch((e) => toast(e.message));
$("ingestBtn").onclick = () => ingest().catch((e) => toast(e.message));
$("fullBtn").onclick = () => fullRefund().catch((e) => toast(e.message));
loadClients()
  .then(loadTunnel)
  .then(refreshCases)
  .catch((e) => toast(e.message));
