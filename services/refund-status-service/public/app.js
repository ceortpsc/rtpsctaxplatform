/* global fetch, document, localStorage, RTPSCShell */
const $ = (id) => document.getElementById(id);

function toast(msg, tone) {
  if (globalThis.RTPSCShell?.toast) {
    RTPSCShell.toast(msg, tone || "success");
    return;
  }
  const el = $("toast");
  if (!el) return;
  el.hidden = false;
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
  return headers;
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...credHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

function statusHtml(code) {
  if (globalThis.RTPSCShell?.statusBadge) return RTPSCShell.statusBadge(code);
  return `<span class="badge badge--neutral">${code}</span>`;
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

async function refreshCases() {
  const data = await api("/api/cases");
  const wrap = $("cases");
  if (!data.cases.length) {
    wrap.innerHTML = `<tr><td colspan="3" class="table-empty">No cases yet.</td></tr>`;
    return;
  }
  wrap.innerHTML = "";
  data.cases.forEach((c) => {
    const el = document.createElement("tr");
    el.innerHTML = `<td><strong>${c.id}</strong></td><td>${statusHtml(c.status)}</td><td>${c.taxpayerRef} · risk ${c.riskScore} · ${c.priority}</td>`;
    el.onclick = () => showCase(c.id);
    wrap.appendChild(el);
  });
}

async function showCase(id) {
  const data = await api(`/api/cases/${encodeURIComponent(id)}`);
  const c = data.case;
  $("detail").textContent =
    `${c.id}\nStatus: ${c.status}\nStage: ${c.filingStage}\nRisk: ${c.riskScore} (${c.priority})\n` +
    `Intel: ${c.intelligence ? `${c.intelligence.score}/100 ${c.intelligence.band}` : "n/a"}\n\nTimeline:\n` +
    c.timeline.map((t) => `• ${t.at} ${t.type}: ${t.detail}`).join("\n");
}

async function ingest() {
  localStorage.setItem("rtpClientId", $("clientId").value.trim());
  const data = await api("/api/events", {
    method: "POST",
    body: JSON.stringify({
      caseId: $("caseId").value.trim(),
      taxpayerRef: $("taxpayerRef").value.trim(),
      filingStage: $("stage").value,
      amount: Number($("amount").value),
      hasTranscript: true
    })
  });
  $("result").hidden = false;
  $("result").textContent = `Ingested ${data.event.eventId}\nStatus ${data.case.status}\nRisk ${data.case.riskScore}\nClient ${data.authenticatedClient.id}`;
  toast("Event ingested");
  await refreshCases();
  await showCase(data.case.id);
}

async function fullRefund() {
  localStorage.setItem("rtpClientId", $("clientId").value.trim());
  const data = await api("/api/refunds/full", {
    method: "POST",
    body: JSON.stringify({
      caseId: $("caseId").value.trim(),
      taxpayerRef: $("taxpayerRef").value.trim(),
      amount: Number($("amount").value),
      hasTranscript: true
    })
  });
  $("result").hidden = false;
  $("result").textContent = `FULL REFUND PATH\n${data.case.id}\nStatus ${data.case.status}\nTimeline ${data.case.timeline.length} events\nIntel ${data.case.intelligence?.score}/100`;
  toast("Full refund path complete");
  await refreshCases();
  await showCase(data.case.id);
}

if (globalThis.RTPSCShell) {
  RTPSCShell.mount({ activeId: "refunds", serviceName: "refund-status-service", env: "local" });
}

$("ingestBtn").onclick = () => ingest().catch((e) => toast(e.message, "danger"));
$("fullBtn").onclick = () => fullRefund().catch((e) => toast(e.message, "danger"));
$("ingestBtnMobile")?.addEventListener("click", () => $("ingestBtn").click());
$("fullBtnMobile")?.addEventListener("click", () => $("fullBtn").click());
loadClients().then(refreshCases).catch((e) => toast(e.message, "danger"));
