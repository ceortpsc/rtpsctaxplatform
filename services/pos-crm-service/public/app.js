/* global fetch, document */
const $ = (id) => document.getElementById(id);

let taxData = { states: [], localitiesByState: {} };
let contacts = [];
let session = null;
let selectedContactId = null;

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
  ["crm", "pos", "ero"].forEach((t) => {
    $(`tab-${t}`).hidden = t !== name;
  });
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
      <div class="meta">${escapeHtml(c.taxpayerRef || "no TP ref")} · ${escapeHtml(c.locality || "")} ${escapeHtml(c.state || "")}</div>`;
    el.onclick = () => showContact(c.id);
    wrap.appendChild(el);
  });
  fillContactSelects();
}

function fillContactSelects() {
  const opts = contacts.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.state || "?")})</option>`).join("");
  $("pContact").innerHTML = opts || `<option value="">No contacts</option>`;
  $("tContact").innerHTML = opts || `<option value="">No contacts</option>`;
  if (selectedContactId) {
    $("pContact").value = selectedContactId;
    $("tContact").value = selectedContactId;
  }
}

async function showContact(id) {
  selectedContactId = id;
  const data = await api(`/api/contacts/${encodeURIComponent(id)}`);
  const c = data.contact;
  $("contactDetail").hidden = false;
  $("contactDetail").textContent =
    `${c.name}\n${c.email || "—"} · ${c.phone || "—"}\nTaxpayer: ${c.taxpayerRef || "—"}\n` +
    `Jurisdiction: ${c.locality || ""} ${c.state || ""}\n` +
    `Sales: ${data.sales.length} · Traces: ${data.traces.length} · Interactions: ${data.interactions.length}\n` +
    (data.interactions[0] ? `Latest: ${data.interactions[0].subject}` : "");
  renderContacts(contacts);
}

async function refreshContacts() {
  const q = $("cSearch").value.trim();
  const data = await api(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  renderContacts(data.contacts);
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
      tags: ["ops"]
    })
  });
  toast("Contact saved");
  selectedContactId = data.contact.id;
  await refreshContacts();
  await showContact(data.contact.id);
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
  $("openSession").onclick = () => openSession().catch((e) => toast(e.message));
  $("addItem").onclick = () => addItem().catch((e) => toast(e.message));
  $("checkout").onclick = () => checkout().catch((e) => toast(e.message));
  $("trackBtn").onclick = () => trackReport().catch((e) => toast(e.message));
  $("intelBtn").onclick = () => runIntel().catch((e) => toast(e.message));
  $("phraseBtn").onclick = () => genPhrase().catch((e) => toast(e.message));
  renderCart();
}

boot().catch((err) => toast(err.message));
