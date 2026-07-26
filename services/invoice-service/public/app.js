/* global fetch, document, window */
const $ = (id) => document.getElementById(id);

let taxData = { states: [], localitiesByState: {} };
let currentInvoice = null;
let lineRows = [];

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

function defaultLines() {
  return [{ sku: "TAX-PREP-1040", description: "Individual tax preparation (Form 1040)", quantity: 1, unitPrice: 250, taxable: true }];
}

function renderLines() {
  const wrap = $("lines");
  wrap.innerHTML = "";
  lineRows.forEach((row, idx) => {
    const el = document.createElement("div");
    el.className = "line";
    el.innerHTML = `
      <input data-k="sku" data-i="${idx}" value="${escapeAttr(row.sku)}" placeholder="SKU" />
      <input data-k="description" data-i="${idx}" value="${escapeAttr(row.description)}" placeholder="Description" />
      <input data-k="quantity" data-i="${idx}" type="number" min="0" step="0.25" value="${row.quantity}" />
      <input data-k="unitPrice" data-i="${idx}" type="number" min="0" step="0.01" value="${row.unitPrice}" />
      <button type="button" data-del="${idx}" title="Remove">×</button>`;
    wrap.appendChild(el);
  });
  wrap.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      const i = Number(input.dataset.i);
      const k = input.dataset.k;
      lineRows[i][k] = k === "quantity" || k === "unitPrice" ? Number(input.value) : input.value;
    });
  });
  wrap.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lineRows.splice(Number(btn.dataset.del), 1);
      if (!lineRows.length) lineRows = defaultLines();
      renderLines();
    });
  });
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function fillStates() {
  const sel = $("state");
  sel.innerHTML = taxData.states.map((s) => `<option value="${s.code}">${s.code} — ${s.name} (${s.rate}%)</option>`).join("");
  if (![...sel.options].some((o) => o.value === "LA")) sel.selectedIndex = 0;
  else sel.value = "LA";
  fillLocalities();
}

function fillLocalities() {
  const state = $("state").value;
  const locs = taxData.localitiesByState[state] || [];
  const label = taxData.states.find((s) => s.code === state)?.localityLabel || "county";
  $("localityLabel").textContent = label === "parish" ? "Parish" : "County";
  const sel = $("locality");
  sel.innerHTML =
    `<option value="">(state only)</option>` +
    locs.map((l) => `<option value="${l.code}">${l.name} (+${l.rate}%)</option>`).join("");
  updateTaxPreview();
}

function updateTaxPreview() {
  const state = taxData.states.find((s) => s.code === $("state").value);
  const locs = taxData.localitiesByState[$("state").value] || [];
  const loc = locs.find((l) => l.code === $("locality").value);
  if (!state) {
    $("taxPreview").textContent = "Select a jurisdiction to preview tax rate.";
    return;
  }
  const combined = (state.rate + (loc?.rate || 0)).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  $("taxPreview").textContent = loc
    ? `${state.name} ${state.rate}% + ${loc.name} ${loc.rate}% = ${combined}% combined (reference rates).`
    : `${state.name} ${state.rate}% (no local overlay selected).`;
}

function setButtons() {
  const status = currentInvoice?.status;
  $("submitBtn").disabled = !(status === "draft" || status === "rejected");
  $("approveBtn").disabled = status !== "pending-approval";
  $("payBtn").disabled = !(status === "approved" || status === "partially-paid");
  $("payRow").hidden = $("payBtn").disabled;
  if (currentInvoice) {
    $("exports").hidden = false;
    $("pdfLink").href = `/api/invoices/${encodeURIComponent(currentInvoice.id)}/pdf`;
    $("receiptPdfLink").href = `/api/invoices/${encodeURIComponent(currentInvoice.id)}/receipt.pdf`;
    $("receiptTxtLink").href = `/api/invoices/${encodeURIComponent(currentInvoice.id)}/receipt.txt`;
  } else {
    $("exports").hidden = true;
  }
}

function showInvoice(invoice, note) {
  currentInvoice = invoice;
  $("result").hidden = false;
  $("result").classList.remove("err");
  $("result").innerHTML = `
    <strong>${invoice.number}</strong> · <span class="status ${invoice.status}">${invoice.status}</span><br/>
    Client: ${escapeAttr(invoice.client.name)} · Total <strong>$${money(invoice.total)}</strong>
    (tax $${money(invoice.tax)} @ ${invoice.taxDetail?.rate ?? 0}%)
    ${invoice.confirmation ? `<br/>Confirmation <code>${invoice.confirmation.id}</code> — ${escapeAttr(invoice.confirmation.message)}` : ""}
    ${note ? `<br/><em>${escapeAttr(note)}</em>` : ""}`;
  $("totals").textContent =
    `Subtotal  $${money(invoice.subtotal)}\n` +
    `Taxable   $${money(invoice.taxableSubtotal)}\n` +
    `Tax       $${money(invoice.tax)}\n` +
    `TOTAL     $${money(invoice.total)}`;
  setButtons();
  refreshList();
}

async function refreshList() {
  const data = await api("/api/invoices");
  const wrap = $("invoiceList");
  if (!data.invoices.length) {
    wrap.textContent = "None yet.";
    return;
  }
  wrap.innerHTML = "";
  data.invoices.forEach((inv) => {
    const row = document.createElement("div");
    row.className = "inv-row";
    row.innerHTML = `
      <div><strong>${escapeAttr(inv.number)}</strong> · ${escapeAttr(inv.client.name)}
        <div class="meta">${escapeAttr(inv.client.localityName || inv.client.locality || "")} ${escapeAttr(inv.client.state || "")}</div>
      </div>
      <div><span class="status ${inv.status}">${inv.status}</span><div class="meta">$${money(inv.total)}</div></div>`;
    row.addEventListener("click", () => showInvoice(inv));
    wrap.appendChild(row);
  });
}

async function loadCatalog() {
  const data = await api("/api/catalog");
  $("catalog").innerHTML = data.catalog
    .map(
      (c) =>
        `<div class="item"><div class="sku">${escapeAttr(c.sku)}</div>${escapeAttr(c.description)}<div class="price">$${money(c.unitPrice)}</div></div>`
    )
    .join("");
}

async function runAssist() {
  const data = await api("/api/assist", {
    method: "POST",
    body: JSON.stringify({
      text: $("assistText").value,
      state: $("state").value,
      locality: $("locality").value
    })
  });
  const a = data.assist;
  if (a.client?.name) $("clientName").value = a.client.name;
  if (a.client?.email) $("email").value = a.client.email;
  if (a.jurisdiction?.state?.code) {
    $("state").value = a.jurisdiction.state.code;
    fillLocalities();
    if (a.jurisdiction.locality?.code) $("locality").value = a.jurisdiction.locality.code;
    updateTaxPreview();
  }
  if (a.lineItems?.length) {
    lineRows = a.lineItems.map((l) => ({
      sku: l.sku,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxable: l.taxable !== false
    }));
    renderLines();
  }
  $("assistOut").hidden = false;
  $("assistOut").innerHTML =
    `<strong>AI assist</strong> (${a.mode})` +
    `<ul>${a.suggestions.map((s) => `<li>${escapeAttr(s.message)}</li>`).join("")}</ul>`;
  toast("AI assist applied");
}

async function create() {
  try {
    const data = await api("/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        clientName: $("clientName").value,
        email: $("email").value,
        state: $("state").value,
        locality: $("locality").value,
        notes: $("notes").value,
        lineItems: lineRows
      })
    });
    showInvoice(data.invoice, "Draft created — submit for approval when ready.");
    toast("Invoice created");
  } catch (err) {
    $("result").hidden = false;
    $("result").classList.add("err");
    $("result").textContent = err.message;
  }
}

async function submit() {
  if (!currentInvoice) return;
  const data = await api(`/api/invoices/${encodeURIComponent(currentInvoice.id)}/submit`, { method: "POST", body: "{}" });
  showInvoice(data.invoice, "Queued for payment approval.");
  toast("Submitted for approval");
}

async function approve() {
  if (!currentInvoice) return;
  const data = await api(`/api/invoices/${encodeURIComponent(currentInvoice.id)}/approve`, {
    method: "POST",
    body: JSON.stringify({ approver: "ops-desk" })
  });
  showInvoice(data.invoice, "Approved — record payment to generate confirmation.");
  toast("Invoice approved");
}

async function pay() {
  if (!currentInvoice) return;
  try {
    const data = await api(`/api/invoices/${encodeURIComponent(currentInvoice.id)}/pay`, {
      method: "POST",
      body: JSON.stringify({
        method: $("payMethod").value,
        amount: currentInvoice.total,
        reference: $("payRef").value
      })
    });
    showInvoice(data.invoice, "Payment confirmed — download PDF or receipt paper.");
    toast("Payment confirmed");
  } catch (err) {
    $("result").hidden = false;
    $("result").classList.add("err");
    $("result").textContent = err.message;
  }
}

async function boot() {
  taxData = await api("/api/tax");
  fillStates();
  lineRows = defaultLines();
  renderLines();
  await loadCatalog();
  await refreshList();
  $("state").addEventListener("change", fillLocalities);
  $("locality").addEventListener("change", updateTaxPreview);
  $("assistBtn").addEventListener("click", () => runAssist().catch((e) => toast(e.message)));
  $("addLine").addEventListener("click", () => {
    lineRows.push({ sku: "CONSULT-HR", description: "Tax consultation (per hour)", quantity: 1, unitPrice: 150, taxable: true });
    renderLines();
  });
  $("createBtn").addEventListener("click", () => create());
  $("submitBtn").addEventListener("click", () => submit().catch((e) => toast(e.message)));
  $("approveBtn").addEventListener("click", () => approve().catch((e) => toast(e.message)));
  $("payBtn").addEventListener("click", () => pay());
  $("assistText").value = "2 hours consultation and 1040 prep for Jordan Ellis in Orleans Parish LA $400";
}

boot().catch((err) => {
  $("catalog").textContent = err.message;
  toast(err.message);
});
