let products = [];
let selected = null;

const $ = (id) => document.getElementById(id);

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

async function loadGate() {
  try {
    const gate = await api("/api/payment-gate");
    const node = $("gate");
    node.className = "gate " + (gate.allowed ? "allowed" : "blocked");
    node.innerHTML = gate.allowed
      ? "🟢 Payment gate OPEN — funding permitted in this environment."
      : "🛡 Payment gate CLOSED — enrollment is recorded, but funding is blocked until approvals." +
        `<div class="reasons">${gate.reasons.map((r) => "• " + r).join("<br/>")}</div>`;
  } catch (error) {
    $("gate").textContent = "Payment gate unavailable: " + error.message;
  }
}

async function loadProducts() {
  const data = await api("/api/products");
  products = data.products;
  $("provider").textContent = data.provider.name;
  const wrap = $("products");
  wrap.innerHTML = "";
  products.forEach((product, index) => {
    const card = document.createElement("label");
    card.className = "product";
    card.innerHTML = `
      <input type="radio" name="product" value="${product.code}" ${index === 0 ? "checked" : ""} />
      <span>
        <span class="p-name">${product.name}</span>
        <span class="p-meta">Max $${product.maxAmount.toLocaleString()} · APR ${product.apr}%${product.requiresCreditCheck ? " · credit check" : ""}</span>
      </span>`;
    card.querySelector("input").addEventListener("change", () => selectProduct(product.code));
    wrap.appendChild(card);
  });
  selectProduct(products[0].code);
}

function selectProduct(code) {
  selected = products.find((p) => p.code === code);
  document.querySelectorAll(".product").forEach((el) => {
    el.classList.toggle("selected", el.querySelector("input").value === code);
  });
  const list = $("disclosures");
  list.innerHTML = selected.disclosures.map((d) => `<li>${d}</li>`).join("");
  $("creditRow").hidden = !selected.requiresCreditCheck;
}

async function enroll() {
  if (!selected) return;
  const body = {
    applicationId: $("applicationId").value.trim(),
    taxpayerRef: $("taxpayerRef").value.trim(),
    productCode: selected.code,
    requestedAmount: Number($("requestedAmount").value),
    consent: {
      disclosuresAccepted: $("disclosuresAccepted").checked,
      creditCheckAuthorized: $("creditCheckAuthorized").checked
    }
  };
  const result = $("result");
  try {
    const data = await api("/api/enrollments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const enr = data.enrollment;
    const funded = enr.fundingAllowed;
    result.hidden = false;
    result.className = "result " + (funded ? "ok" : "pending");
    result.innerHTML =
      `<strong>Enrolled:</strong> ${enr.id}<br/>Product: ${enr.product.name} · $${enr.requestedAmount.toLocaleString()}<br/>` +
      `Status: <strong>${enr.status}</strong>` +
      (funded ? "" : `<div class="reasons">Funding gate: ${enr.gate.reasons.join("; ")}</div>`) +
      `<pre>${JSON.stringify({ id: enr.id, status: enr.status, fundingAllowed: enr.fundingAllowed }, null, 2)}</pre>`;
    toast(`Enrollment ${enr.status}`);
    loadEnrollments();
  } catch (error) {
    result.hidden = false;
    result.className = "result err";
    result.textContent = "Enrollment failed: " + error.message;
    toast("Enrollment failed", true);
  }
}

async function loadEnrollments() {
  const data = await api("/api/enrollments");
  const wrap = $("enrollments");
  if (!data.enrollments.length) {
    wrap.textContent = "None yet.";
    return;
  }
  wrap.innerHTML = "";
  data.enrollments.forEach((enr) => {
    const row = document.createElement("div");
    row.className = "enr";
    const cls = enr.fundingAllowed ? "ok" : "pending";
    row.innerHTML = `<span class="badge ${cls}">${enr.status}</span> <strong>${enr.product.name}</strong> · $${enr.requestedAmount.toLocaleString()} · ${enr.applicationId} <span style="margin-left:auto;color:var(--muted)">${enr.id}</span>`;
    wrap.appendChild(row);
  });
}

$("enroll").addEventListener("click", enroll);
loadGate();
loadProducts();
loadEnrollments();
