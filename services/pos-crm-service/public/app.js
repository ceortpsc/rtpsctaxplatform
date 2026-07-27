/* global fetch, document */
const $ = (id) => document.getElementById(id);

let taxData = { states: [], localitiesByState: {} };
let contacts = [];
let session = null;
let selectedContactId = null;
let crmLetter = "";
let mfLetter = "";
let mxLetter = "";
let masterRows = [];
let matrixData = null;

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function switchTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  ["crm", "master", "matrix", "pos", "ero"].forEach((t) => {
    const el = $(`tab-${t}`);
    if (el) el.hidden = t !== name;
  });
  if (name === "master") refreshMasterfile().catch((e) => toast(e.message));
  if (name === "matrix") refreshMatrix().catch((e) => toast(e.message));
}

function renderAlphaBar(el, letters, active, onPick) {
  if (!el) return;
  const set = ["ALL", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"];
  el.innerHTML = set
    .map((L) => {
      const available = L === "ALL" || (letters || []).includes(L) || L === "#";
      const isActive = (active || "ALL") === L || (!active && L === "ALL");
      return `<button type="button" data-letter="${L}" class="${isActive ? "active" : ""}" ${available ? "" : "disabled"}>${L}</button>`;
    })
    .join("");
  el.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => onPick(btn.dataset.letter === "ALL" ? "" : btn.dataset.letter);
  });
}

function statusChip(value) {
  const v = String(value || "none");
  return `<span class="status ${escapeHtml(v)}">${escapeHtml(v.replace(/_/g, " "))}</span>`;
}

function fillStates(selId, locId, labelId, preferred = "LA") {
  const sel = $(selId);
  sel.innerHTML = taxData.states.map((s) => `<option value="${s.code}">${s.code} — ${s.name}</option>`).join("");
  sel.value = preferred;
  const fillLoc = () => {
    const state = sel.value;
    const locs = taxData.localitiesByState[state] || [];
    const label = taxData.states.find((s) => s.code === state)?.localityLabel || "county";
    if (labelId) $(labelId).textContent = label === "parish" ? "Parish" : "County";
    $(locId).innerHTML =
      `<option value="">(state only)</option>` + locs.map((l) => `<option value="${l.code}">${escapeHtml(l.name)}</option>`).join("");
  };
  sel.onchange = fillLoc;
  fillLoc();
}

function renderContacts(list) {
  contacts = list;
  const wrap = $("contactList");
  if (!list.length) {
    wrap.textContent = "No contacts.";
    return;
  }
  wrap.innerHTML = "";
  list.forEach((c) => {
    const el = document.createElement("div");
    el.className = "item" + (c.id === selectedContactId ? " selected" : "");
    el.innerHTML = `<strong>${escapeHtml(c.name)}</strong> <span class="status ${c.status}">${c.status}</span>
      <div class="meta">${escapeHtml(c.clientNumber || "no CL#")} · ${escapeHtml(c.customerNumber || "no CU#")} · ${escapeHtml(c.taxpayerRef || "no TP ref")}</div>
      <div class="meta">${escapeHtml(c.locality || "")} ${escapeHtml(c.state || "")}</div>`;
    el.onclick = () => showContact(c.id);
    wrap.appendChild(el);
  });
  fillContactSelects();
}

function fillContactSelects() {
  const opts = contacts.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.clientNumber || c.state || "?")})</option>`).join("");
  $("pContact").innerHTML = opts || `<option value="">No contacts</option>`;
  $("tContact").innerHTML = opts || `<option value="">No contacts</option>`;
  if ($("idContact")) $("idContact").innerHTML = opts || `<option value="">No contacts</option>`;
  if (selectedContactId) {
    $("pContact").value = selectedContactId;
    $("tContact").value = selectedContactId;
    if ($("idContact")) $("idContact").value = selectedContactId;
  }
}

async function showContact(id) {
  selectedContactId = id;
  const data = await api(`/api/contacts/${encodeURIComponent(id)}`);
  const c = data.contact;
  $("contactDetail").hidden = false;
  $("contactDetail").textContent =
    `${c.name}\n${c.email || "—"} · ${c.phone || "—"}\n` +
    `Client ID #: ${c.clientNumber || "—"}\nCustomer ID #: ${c.customerNumber || "—"}\n` +
    `Taxpayer: ${c.taxpayerRef || "—"}\n` +
    `Jurisdiction: ${c.locality || ""} ${c.state || ""}\n` +
    `Sales: ${data.sales.length} · Traces: ${data.traces.length} · Interactions: ${data.interactions.length}\n` +
    (data.interactions[0] ? `Latest: ${data.interactions[0].subject}` : "");
  renderContacts(contacts);
}

async function refreshContacts() {
  const q = $("cSearch").value.trim();
  const params = new URLSearchParams({ sort: "alpha" });
  if (q) params.set("q", q);
  if (crmLetter) params.set("letter", crmLetter);
  const data = await api(`/api/contacts?${params}`);
  renderContacts(data.contacts);
  renderAlphaBar($("crmLetters"), data.letters || [], crmLetter || "ALL", (L) => {
    crmLetter = L;
    refreshContacts().catch((e) => toast(e.message));
  });
}

async function refreshMasterfile() {
  const q = $("mfSearch").value.trim();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (mfLetter) params.set("letter", mfLetter);
  const data = await api(`/api/masterfile?${params}`);
  masterRows = data.rows || [];
  renderAlphaBar($("mfLetters"), data.letters || [], mfLetter || "ALL", (L) => {
    mfLetter = L;
    refreshMasterfile().catch((e) => toast(e.message));
  });
  const wrap = $("mfList");
  if (!masterRows.length) {
    wrap.textContent = "No master-file rows.";
    return;
  }
  wrap.innerHTML = masterRows
    .map(
      (r) =>
        `<div class="item" data-id="${escapeHtml(r.id)}"><strong>${escapeHtml(r.name)}</strong> ${statusChip(r.crmStatus)}
        <div class="meta">${escapeHtml(r.taxpayerRef || "no TP ref")} · ${escapeHtml(r.locality || "")} ${escapeHtml(r.state || "")} · ${escapeHtml(r.letter)}</div></div>`
    )
    .join("");
  wrap.querySelectorAll(".item").forEach((el) => {
    el.onclick = () => showMasterRecord(el.dataset.id);
  });
}

function showMasterRecord(id) {
  const r = masterRows.find((row) => row.id === id);
  if (!r) return;
  $("mfDetail").hidden = false;
  $("mfDetail").textContent =
    `${r.name}\n${r.email || "—"} · ${r.phone || "—"}\nTaxpayer: ${r.taxpayerRef || "—"}\n` +
    `Jurisdiction: ${r.locality || ""} ${r.state || ""}\nCRM status: ${r.crmStatus}\n` +
    `Contact id: ${r.contactId || "—"} · Source: ${r.source}\nNotes: ${r.notes || "—"}`;
}

async function masterLookupByName() {
  const name = $("mfLookup").value.trim();
  const data = await api(`/api/masterfile/lookup?name=${encodeURIComponent(name)}`);
  const wrap = $("mfLookupResults");
  if (!data.matches.length) {
    wrap.textContent = name ? "No name matches." : "Type a name to look up.";
    return;
  }
  wrap.innerHTML = data.matches
    .map(
      (r) =>
        `<div class="item"><strong>${escapeHtml(r.name)}</strong>
        <div class="meta">${escapeHtml(r.taxpayerRef || "—")} · ${escapeHtml(r.email || "—")}</div></div>`
    )
    .join("");
}

async function masterLookupByRef() {
  const ref = $("mfRefLookup").value.trim();
  if (!ref) throw new Error("Enter a taxpayer ref.");
  const data = await api(`/api/masterfile/lookup?taxpayerRef=${encodeURIComponent(ref)}`);
  if (!data.matches.length) {
    toast("No master-file match");
    $("mfDetail").hidden = false;
    $("mfDetail").textContent = `No record for ${ref}`;
    return;
  }
  masterRows = data.matches;
  showMasterRecord(data.matches[0].id);
  toast(`Found ${data.matches[0].name}`);
}

async function syncMasterFromCrm() {
  await api("/api/masterfile", { method: "POST", body: JSON.stringify({ syncFromCrm: true }) });
  toast("Master file resynced from CRM");
  await refreshMasterfile();
}

async function refreshMatrix() {
  const q = $("mxSearch").value.trim();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (mxLetter) params.set("letter", mxLetter);
  matrixData = await api(`/api/ero/matrix?${params}`);
  renderAlphaBar($("mxLetters"), matrixData.letters || [], mxLetter || "ALL", (L) => {
    mxLetter = L;
    refreshMatrix().catch((e) => toast(e.message));
  });
  const body = $("mxBody");
  if (!matrixData.rows.length) {
    body.innerHTML = `<tr><td colspan="8">No clients match.</td></tr>`;
  } else {
    body.innerHTML = matrixData.rows
      .map((row) => {
        const ch = row.channels;
        return `<tr>
          <td><div class="client-name">${escapeHtml(row.name)}</div>
            <div class="sub">${escapeHtml(row.locality || "")} ${escapeHtml(row.state || "")}</div></td>
          <td>${escapeHtml(row.taxpayerRef || "—")}</td>
          <td>${statusChip(ch.crm.status)}</td>
          <td>${statusChip(ch.refund.filingStage || ch.refund.status)}
            <div class="sub">${ch.refund.amount != null ? "$" + money(ch.refund.amount) : "—"}</div></td>
          <td>${statusChip(ch.sbtpg.stage)}
            <div class="sub">${escapeHtml(ch.sbtpg.productCode || "—")}</div></td>
          <td>${statusChip(ch.efile.stage)}
            <div class="sub">${escapeHtml(ch.efile.label || "")}</div></td>
          <td>${statusChip(ch.overall)}</td>
          <td><strong>${row.intelligence.score}</strong> ${escapeHtml(row.intelligence.band)}
            <div class="sub">${escapeHtml(row.intelligence.recommendation)}</div></td>
        </tr>`;
      })
      .join("");
  }
  $("mxMeta").textContent = `${matrixData.total} client(s) · sorted alphabetically · channels: ${(matrixData.channels || []).join(", ")}`;
}

async function createContact() {
  const data = await api("/api/contacts", {
    method: "POST",
    body: JSON.stringify({
      name: $("cName").value,
      email: $("cEmail").value,
      taxpayerRef: $("cTaxRef").value,
      state: $("cState").value,
      locality: $("cLocality").value,
      tags: ["ops"],
      issueIds: $("cIssueIds")?.checked !== false
    })
  });
  const ids = [
    data.contact.clientNumber && `CL ${data.contact.clientNumber}`,
    data.contact.customerNumber && `CU ${data.contact.customerNumber}`
  ]
    .filter(Boolean)
    .join(" · ");
  toast(ids ? `Contact saved · ${ids}` : "Contact saved");
  selectedContactId = data.contact.id;
  await refreshContacts();
  await showContact(data.contact.id);
  await refreshIdStatus();
}

async function refreshIdStatus() {
  if (!$("idStatus")) return;
  const data = await api("/api/ids");
  $("idStatus").textContent =
    `Next Client ID #: ${data.next.client}\nNext Customer ID #: ${data.next.customer}\n` +
    `Issued: ${data.counts.client} client · ${data.counts.customer} customer\n` +
    `Distinct from API/TDS machine credentials (./rtpsc clients).`;
}

async function issueForSelected(kind) {
  const contactId = $("idContact").value;
  if (!contactId) throw new Error("Select a contact.");
  let data;
  if (kind === "pair") {
    data = await api("/api/ids/pair", { method: "POST", body: JSON.stringify({ contactId }) });
    toast(data.notice || "Pair issued");
  } else {
    data = await api(`/api/ids/${kind}`, {
      method: "POST",
      body: JSON.stringify({ contactId, name: contacts.find((c) => c.id === contactId)?.name })
    });
    toast(data.notice || `${kind} id issued`);
  }
  await refreshContacts();
  await refreshIdStatus();
  if (contactId) await showContact(contactId);
}

function renderCart() {
  if (!session) {
    $("cart").textContent = "Open a session and attach a CRM contact.";
    $("addItem").disabled = true;
    $("checkout").disabled = true;
    return;
  }
  const lines = session.lineItems.length
    ? session.lineItems.map((l, i) => `${i + 1}. ${l.quantity} × ${l.description} @ $${money(l.unitPrice)}`).join("\n")
    : "(empty cart)";
  $("cart").textContent =
    `Session ${session.id}\nCustomer: ${session.clientName}\n` +
    `${session.locality || ""} ${session.state || ""}\nStatus: ${session.status}\n\n${lines}`;
  $("addItem").disabled = session.status !== "open";
  $("checkout").disabled = session.status !== "open" || session.lineItems.length === 0;
  $("sessionBox").hidden = false;
  $("sessionBox").innerHTML = `Open session <span class="status ${session.status}">${session.status}</span> · ${escapeHtml(session.register)} / ${escapeHtml(session.operator)}`;
}

async function openSession() {
  const contactId = $("pContact").value;
  if (!contactId) throw new Error("Select a CRM contact first.");
  const data = await api("/api/pos/sessions", {
    method: "POST",
    body: JSON.stringify({
      contactId,
      register: $("pRegister").value,
      operator: $("pOperator").value
    })
  });
  session = data.session;
  renderCart();
  toast("POS session opened");
}

async function addItem() {
  if (!session) return;
  const body = {
    sku: $("pSku").value,
    quantity: Number($("pQty").value) || 1
  };
  if ($("pPrice").value !== "") body.unitPrice = Number($("pPrice").value);
  const data = await api(`/api/pos/sessions/${encodeURIComponent(session.id)}/items`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  session = data.session;
  renderCart();
}

async function checkout() {
  if (!session) return;
  const data = await api(`/api/pos/sessions/${encodeURIComponent(session.id)}/checkout`, {
    method: "POST",
    body: JSON.stringify({ method: $("pMethod").value, reference: $("pRef").value })
  });
  session = data.session;
  renderCart();
  $("saleResult").hidden = false;
  $("saleResult").innerHTML =
    `<strong>${escapeHtml(data.sale.number)}</strong> · <span class="status paid">${escapeHtml(data.sale.status)}</span><br/>` +
    `Invoice ${escapeHtml(data.invoice.number)} · Total <strong>$${money(data.invoice.total)}</strong> ` +
    `(tax $${money(data.invoice.tax)})<br/>` +
    `Confirmation <code>${escapeHtml(data.invoice.confirmation?.id || "")}</code>`;
  $("saleExports").hidden = false;
  $("saleExports").innerHTML = `
    <a href="${data.downloads.invoicePdf}" target="_blank">Invoice PDF</a>
    <a href="${data.downloads.receiptPdf}" target="_blank">Receipt PDF</a>
    <a href="${data.downloads.receiptTxt}" target="_blank">Receipt paper</a>`;
  toast("Sale settled via invoicing machine");
  await refreshSales();
  await refreshContacts();
}

async function refreshSales() {
  const data = await api("/api/pos/sales");
  const wrap = $("salesList");
  if (!data.sales.length) {
    wrap.textContent = "None yet.";
    return;
  }
  wrap.innerHTML = data.sales
    .map(
      (s) =>
        `<div class="item"><strong>${escapeHtml(s.number)}</strong> · $${money(s.total)}
        <div class="meta">${escapeHtml(s.status)} · inv ${escapeHtml(s.invoiceNumber)}</div></div>`
    )
    .join("");
}

async function trackReport() {
  const contactId = $("tContact").value;
  const contact = contacts.find((c) => c.id === contactId);
  const data = await api("/api/sbtpg/traces", {
    method: "POST",
    body: JSON.stringify({
      contactId,
      taxpayerRef: contact?.taxpayerRef,
      productCode: $("tProduct").value,
      stage: $("tStage").value,
      detail: $("tDetail").value
    })
  });
  toast(`Trace ${data.trace.id}`);
  await refreshTraces();
}

async function refreshTraces() {
  const data = await api("/api/sbtpg/traces");
  const gate = data.gate?.paymentGate;
  $("gateBox").textContent = gate
    ? `SBTPG payment gate: ${gate.blocked ? "BLOCKED" : "OPEN"}\n${(gate.reasons || []).join("\n") || "All safeguards passed."}`
    : "Gate unavailable";
  const wrap = $("traceList");
  if (!data.traces.length) {
    wrap.textContent = "No traces yet.";
    return;
  }
  wrap.innerHTML = data.traces
    .map(
      (t) =>
        `<div class="item"><strong>${escapeHtml(t.id)}</strong> · ${escapeHtml(t.productCode || "—")} · ${escapeHtml(t.stage)}
        <div class="meta">${escapeHtml(t.detail || "")}</div></div>`
    )
    .join("");
}

async function runIntel() {
  const data = await api("/api/ero/intelligence", {
    method: "POST",
    body: JSON.stringify({
      clientName: $("iName").value,
      refundStatus: $("iStatus").value,
      hasTranscript: $("iTranscript").checked,
      sbtpgEnrolled: $("iEnrolled").checked,
      posPaid: $("iPosPaid").checked,
      daysSinceFiling: 10
    })
  });
  $("intelOut").hidden = false;
  $("intelOut").textContent =
    `Score ${data.intelligence.score}/100 (${data.intelligence.band})\n` +
    `Drivers: ${data.intelligence.drivers.join("; ")}\n` +
    `Action: ${data.intelligence.recommendation}\n\n` +
    data.brief.text;
}

async function loadPhrases() {
  const data = await api("/api/ero/phrases");
  $("phraseCode").innerHTML = data.templates.map((t) => `<option value="${t.code}">${escapeHtml(t.title)} (${t.audience})</option>`).join("");
}

async function genPhrase() {
  const contact = contacts.find((c) => c.id === $("tContact").value) || contacts[0];
  const data = await api("/api/ero/phrases", {
    method: "POST",
    body: JSON.stringify({
      code: $("phraseCode").value,
      context: {
        clientName: contact?.name || $("iName").value,
        taxpayerRef: contact?.taxpayerRef || "TP-77",
        statusPhrase: $("iStatus").value,
        productName: $("tProduct").value,
        enrollmentId: "enr-demo",
        saleNumber: "POS-DEMO",
        total: "250.00",
        paymentMethod: "card",
        traceId: "sbt-demo",
        productCode: $("tProduct").value,
        stage: $("tStage").value,
        detail: $("tDetail").value,
        score: 72,
        band: "watch",
        drivers: "demo",
        recommendation: "monitor"
      }
    })
  });
  $("phraseOut").textContent = data.phrase.text;
}

async function loadCatalog() {
  const data = await api("/api/catalog");
  $("pSku").innerHTML = data.catalog.map((c) => `<option value="${c.sku}">${c.sku} — $${money(c.unitPrice)}</option>`).join("");
}

async function boot() {
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  taxData = await api("/api/tax");
  fillStates("cState", "cLocality", "cLocLabel", "LA");
  await loadCatalog();
  await loadPhrases();
  await refreshContacts();
  await refreshSales();
  await refreshTraces();
  if (contacts[0]) {
    selectedContactId = contacts[0].id;
    $("cLocality").value = contacts[0].locality || "";
    await showContact(contacts[0].id);
  }

  $("createContact").onclick = () => createContact().catch((e) => toast(e.message));
  $("cSearch").oninput = () => refreshContacts().catch((e) => toast(e.message));
  $("mfSearch").oninput = () => refreshMasterfile().catch((e) => toast(e.message));
  $("mfLookup").oninput = () => masterLookupByName().catch((e) => toast(e.message));
  $("mfRefBtn").onclick = () => masterLookupByRef().catch((e) => toast(e.message));
  $("mfSyncBtn").onclick = () => syncMasterFromCrm().catch((e) => toast(e.message));
  $("mxSearch").oninput = () => refreshMatrix().catch((e) => toast(e.message));
  $("issueClientBtn").onclick = () => issueForSelected("client").catch((e) => toast(e.message));
  $("issueCustomerBtn").onclick = () => issueForSelected("customer").catch((e) => toast(e.message));
  $("issuePairBtn").onclick = () => issueForSelected("pair").catch((e) => toast(e.message));
  $("openSession").onclick = () => openSession().catch((e) => toast(e.message));
  $("addItem").onclick = () => addItem().catch((e) => toast(e.message));
  $("checkout").onclick = () => checkout().catch((e) => toast(e.message));
  $("trackBtn").onclick = () => trackReport().catch((e) => toast(e.message));
  $("intelBtn").onclick = () => runIntel().catch((e) => toast(e.message));
  $("phraseBtn").onclick = () => genPhrase().catch((e) => toast(e.message));
  await refreshIdStatus().catch(() => {});
  renderCart();
}

boot().catch((err) => toast(err.message));
