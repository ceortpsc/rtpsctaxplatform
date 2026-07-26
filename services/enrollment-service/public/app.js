let products = [];
let selected = null;
let clearanceToken = sessionStorage.getItem("sbtpgClearanceToken") || null;

const $ = (id) => document.getElementById(id);

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (clearanceToken) headers["x-sbtpg-clearance"] = clearanceToken;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

async function loadGate() {
  try {
    const gate = await api("/api/payment-gate");
    const node = $("gate");
    node.className = "gate " + (gate.allowed ? "allowed" : "blocked");
    const clearanceLine = gate.loginClearance
      ? `<div class="reasons">Login clearance: ${gate.loginClearance.cleared ? "CLEARED" : gate.loginClearance.status}` +
        (gate.loginClearance.usernameHint ? ` · ${gate.loginClearance.usernameHint}` : "") +
        ` · credentials ${gate.credentialsProvisioned ? "provisioned" : "missing"}</div>`
      : "";
    node.innerHTML = gate.allowed
      ? "🟢 Payment gate OPEN — funding permitted in this environment." + clearanceLine
      : "🛡 Payment gate CLOSED — enrollment is recorded, but funding is blocked until approvals." +
        `<div class="reasons">${gate.reasons.map((r) => "• " + r).join("<br/>")}</div>` +
        clearanceLine;
  } catch (error) {
    $("gate").textContent = "Payment gate unavailable: " + error.message;
  }
}

async function refreshAuth() {
  const data = await api("/api/auth/status");
  const cred = data.credentials;
  $("credStatus").textContent = cred.provisioned
    ? `Credentials provisioned for hint ${cred.usernameHint} (env: ${cred.envKeys.join(", ")}).`
    : "Credentials NOT provisioned — set SBTPG_USERNAME and SBTPG_SECRET in the environment.";

  const clr = data.clearance;
  const box = $("clearanceBox");
  if (clr.cleared) {
    box.hidden = false;
    box.className = "result ok";
    box.innerHTML = `<strong>CLEARED</strong> · session ${clr.session.id}<br/>User ${clr.session.username} · expires ${clr.session.expiresAt}`;
    $("logoutBtn").disabled = false;
    $("loginBtn").disabled = true;
  } else {
    box.hidden = false;
    box.className = "result pending";
    box.innerHTML = `<strong>Not cleared</strong> · ${clr.status}`;
    $("logoutBtn").disabled = !clearanceToken;
    $("loginBtn").disabled = false;
  }
  await loadAudit();
}

async function loadAudit() {
  const data = await api("/api/auth/audit?limit=20&persisted=1");
  const wrap = $("auditLog");
  if (!data.entries.length) {
    wrap.textContent = "No attempts yet.";
    return;
  }
  wrap.innerHTML = data.entries
    .map((e) => {
      const cls = e.outcome === "success" || e.event === "login_cleared" ? "ok" : e.outcome === "failure" ? "fail" : "";
      return `<div class="audit-row"><span class="${cls}">${e.event}</span> · ${e.outcome || ""} · ${e.usernameRedacted || "—"} · <code>${e.code || e.clearanceId || ""}</code> · ${e.at}</div>`;
    })
    .join("");
}

async function login() {
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: $("authUser").value, secret: $("authSecret").value })
    });
    clearanceToken = data.clearance.token;
    sessionStorage.setItem("sbtpgClearanceToken", clearanceToken);
    $("authSecret").value = "";
    toast("Login cleared — audit logged");
    await refreshAuth();
    await loadGate();
  } catch (error) {
    clearanceToken = null;
    sessionStorage.removeItem("sbtpgClearanceToken");
    toast(error.message);
    await refreshAuth();
    await loadGate();
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: clearanceToken })
    });
  } catch {
    // ignore
  }
  clearanceToken = null;
  sessionStorage.removeItem("sbtpgClearanceToken");
  toast("Clearance revoked");
  await refreshAuth();
  await loadGate();
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
    toast("Enrollment failed");
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
$("loginBtn").addEventListener("click", () => login());
$("logoutBtn").addEventListener("click", () => logout());
loadGate();
loadProducts();
loadEnrollments();
refreshAuth().catch((e) => toast(e.message));
