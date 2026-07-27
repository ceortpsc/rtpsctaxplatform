const $ = (id) => document.getElementById(id);

function toast(message, tone = "info") {
  const el = $("toast");
  el.hidden = false;
  el.dataset.tone = tone;
  el.textContent = message;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data.message || data.error || res.statusText);
  return data;
}

function renderIntegrations(data) {
  const wrap = $("integrations");
  wrap.innerHTML = (data.interfaces || [])
    .map((i) => {
      const ready =
        i.id === "irs-oauth"
          ? i.clientIdConfigured && i.keyConfigured
          : Boolean(i.clientIdConfigured);
      return `<div class="list-row"><strong>${i.title}</strong> · ${ready ? "configured" : "awaiting credentials"} · <code>${i.endpoint || "n/a"}</code></div>`;
    })
    .join("");
}

async function loadAccount() {
  const data = await api("/api/account");
  $("account").textContent = JSON.stringify(
    {
      firm: data.firm?.company,
      operator: data.firm?.operator?.name,
      ptin: data.account?.ptinRedacted,
      caf: data.account?.cafRedacted,
      api: data.account?.apiClientConfigured,
      tds: data.account?.tdsClientConfigured,
      irs: data.account?.irsOAuthConfigured,
      xmlWellFormed: data.xmlWellFormed
    },
    null,
    2
  );
  renderIntegrations(data.integrations || {});
}

async function loadReleases() {
  const data = await api("/api/releases");
  const list = data.releases || [];
  $("releases").innerHTML = list.length
    ? list
        .map(
          (r) =>
            `<div class="list-row"><a href="/api/releases/${encodeURIComponent(r.id)}/xml">${r.id}</a> · ${r.caseId} · ${r.status} · $${Number(r.amount).toFixed(2)}</div>`
        )
        .join("")
    : "None yet.";
}

async function rectify() {
  const data = await api("/api/masterfile/process", {
    method: "POST",
    body: JSON.stringify({
      caseId: $("caseId").value.trim(),
      taxpayerRef: $("taxpayerRef").value.trim(),
      rectifyCodes: ["570", "810"],
      notes: "ERO suite UI rectification"
    })
  });
  $("masterfileOut").hidden = false;
  $("masterfileOut").textContent = JSON.stringify(
    {
      gate: data.gate,
      openHolds: data.analysis?.openHolds,
      rectified: data.rectification?.analysis?.rectifiedHolds,
      xmlWellFormed: data.xmlWellFormed
    },
    null,
    2
  );
}

async function runAssist() {
  const data = await api("/api/assist", {
    method: "POST",
    body: JSON.stringify({ prompt: $("assistPrompt").value })
  });
  $("lifecycleOut").hidden = false;
  $("lifecycleOut").textContent = JSON.stringify(data.assist, null, 2);
}

async function runIntel() {
  const data = await api("/api/intelligence", {
    method: "POST",
    body: JSON.stringify({ wmrStatus: "HOLD", masterfileStatus: "HOLD", manualReview: true })
  });
  $("lifecycleOut").hidden = false;
  $("lifecycleOut").textContent = JSON.stringify(data.intelligence, null, 2);
}

async function runLifecycle() {
  const data = await api("/api/release/lifecycle", {
    method: "POST",
    body: JSON.stringify({
      caseId: $("caseId").value.trim(),
      taxpayerRef: $("taxpayerRef").value.trim(),
      amount: Number($("amount").value),
      rectifyCodes: ["570", "810"]
    })
  });
  $("lifecycleOut").hidden = false;
  $("lifecycleOut").textContent = JSON.stringify(
    {
      releaseId: data.release?.id,
      status: data.release?.status,
      issued: data.release?.issued,
      tc846Posted: data.release?.tc846Posted,
      liveIrsIssuance: data.release?.liveIrsIssuance,
      reconciliation: data.reconciliation?.status,
      balanced: data.reconciliation?.balanced,
      events: data.events
    },
    null,
    2
  );
  await loadReleases();
  toast("Release lifecycle executed (scaffold issuance)", "success");
}

async function boot() {
  if (globalThis.RTPSCShell) {
    RTPSCShell.mount({ activeId: "reports", serviceName: "irs-practitioner-service", env: "local" });
  }
  $("rectifyBtn").onclick = () => rectify().catch((e) => toast(e.message, "danger"));
  $("assistBtn").onclick = () => runAssist().catch((e) => toast(e.message, "danger"));
  $("intelBtn").onclick = () => runIntel().catch((e) => toast(e.message, "danger"));
  $("lifecycleBtn").onclick = () => runLifecycle().catch((e) => toast(e.message, "danger"));
  await loadAccount();
  await loadReleases();
}

boot().catch((err) => toast(err.message, "danger"));
