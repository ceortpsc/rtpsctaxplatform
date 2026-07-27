/* global fetch, document, window, RTPSCShell */
const $ = (id) => document.getElementById(id);

let taxData = { states: [], localitiesByState: {} };
let currentInvoice = null;
let lineRows = [];

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

function statusHtml(code) {
  if (globalThis.RTPSCShell?.statusBadge) return RTPSCShell.statusBadge(code);
  return `<span class="badge badge--neutral">${code}</span>`;
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
  const empty = $("paymentsEmpty");
  if (empty) empty.hidden = !$("payBtn").disabled;
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
    <strong>${invoice.number}</strong> · ${statusHtml(invoice.status)}<br/>
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
  const approvals = $("approvalList");
  if (!data.invoices.length) {
    wrap.innerHTML = `<tr><td colspan="5" class="table-empty">None yet.</td></tr>`;
  } else {
    wrap.innerHTML = "";
    data.invoices.forEach((inv) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${escapeAttr(inv.number)}</strong></td>
        <td>${escapeAttr(inv.client.name)}</td>
        <td>${escapeAttr(inv.client.localityName || inv.client.locality || "")} ${escapeAttr(inv.client.state || "")}</td>
        <td>${statusHtml(inv.status)}</td>
        <td>$${money(inv.total)}</td>`;
      row.addEventListener("click", () => showInvoice(inv));
      wrap.appendChild(row);
    });
  }

  if (approvals) {
    const pending = data.invoices.filter((inv) => inv.status === "pending-approval");
    if (!pending.length) {
      approvals.innerHTML = `<tr><td colspan="4" class="table-empty">No invoices awaiting approval.</td></tr>`;
    } else {
      approvals.innerHTML = pending
        .map(
          (inv) => `<tr data-id="${escapeAttr(inv.id)}">
            <td><strong>${escapeAttr(inv.number)}</strong></td>
            <td>${escapeAttr(inv.client.name)}</td>
            <td>${statusHtml(inv.status)}</td>
            <td>$${money(inv.total)}</td>
          </tr>`
        )
        .join("");
      approvals.querySelectorAll("tr[data-id]").forEach((tr) => {
        tr.addEventListener("click", () => {
          const inv = data.invoices.find((i) => i.id === tr.dataset.id);
          if (inv) showInvoice(inv);
        });
      });
    }
  }
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
  if (globalThis.RTPSCShell) {
    RTPSCShell.mount({
      activeId: "invoices",
      serviceName: "invoice-service",
      env: "local",
      title: "Invoices"
    });
  }
  taxData = await api("/api/tax");
  fillStates();
  lineRows = defaultLines();
  renderLines();
  setButtons();
  await loadCatalog();
  await refreshList();
  $("state").addEventListener("change", fillLocalities);
  $("locality").addEventListener("change", updateTaxPreview);
  $("assistBtn").addEventListener("click", () => runAssist().catch((e) => toast(e.message, "danger")));
  $("addLine").addEventListener("click", () => {
    lineRows.push({ sku: "CONSULT-HR", description: "Tax consultation (per hour)", quantity: 1, unitPrice: 150, taxable: true });
    renderLines();
  });
  $("createBtn").addEventListener("click", () => create());
  $("submitBtn").addEventListener("click", () => submit().catch((e) => toast(e.message, "danger")));
  $("approveBtn").addEventListener("click", () => approve().catch((e) => toast(e.message, "danger")));
  $("payBtn").addEventListener("click", () => pay());
  $("assistText").value = "2 hours consultation and 1040 prep for Jordan Ellis in Orleans Parish LA $400";
  $("headerCreateCta")?.addEventListener("click", (e) => {
    e.preventDefault();
    $("createBtn")?.focus();
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
  });
}

boot().catch((err) => {
  if ($("catalog")) $("catalog").textContent = err.message;
  toast(err.message, "danger");
});
