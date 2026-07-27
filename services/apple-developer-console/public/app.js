/* Apple Developer Console operator UI */
(function () {
  const $ = (id) => document.getElementById(id);

  const EXTRA_NAV = [
    {
      id: "integrations",
      label: "Integrations",
      items: [
        { id: "apple_console", label: "Apple Developer Console", href: "/" },
        { id: "control_plane", label: "Control Plane", href: "http://127.0.0.1:8787/dashboard" },
        { id: "modules", label: "Module Catalog", href: "http://127.0.0.1:3010/#catalog" }
      ]
    }
  ];

  async function api(path, options) {
    const response = await fetch(path, {
      headers: { accept: "application/json", "content-type": "application/json" },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || data.error || `HTTP ${response.status}`);
      err.payload = data;
      throw err;
    }
    return data;
  }

  function toast(message, tone) {
    if (window.RTPSCShell?.toast) window.RTPSCShell.toast(message, tone);
  }

  function badgeForStatus(status) {
    if (status === "implemented" || status === "implemented_stub") return "success";
    if (status === "limited") return "info";
    if (status === "configuration_required") return "warning";
    return "neutral";
  }

  function renderStatus(data) {
    const gate = data.gate || {};
    const apple = data.apple || {};
    const live = gate.liveCallsAllowed === true;
    $("metricGate").textContent = live ? "Open" : "Blocked";
    $("metricGateHint").textContent = live
      ? "Live App Store Connect calls allowed"
      : (gate.reasons && gate.reasons[0]) || "Safeguards incomplete";
    $("metricIssuer").textContent = apple.issuerId || "unset";
    $("metricKey").textContent = apple.keyId || "unset";
    $("metricTeam").textContent = `${apple.teamId || "unset"} · ${apple.bundleId || "unset"}`;

    const badge = $("gateBadge");
    badge.textContent = live ? "Live ready" : "Configuration required";
    badge.className = `badge badge--${live ? "success" : "warning"}`;

    const list = $("checklist");
    list.innerHTML = (data.setup || [])
      .map((step, i) => {
        const complete = step.id === "provision_secrets" ? gate.safeguards?.secretsConfigured && gate.safeguards?.enabledFlag : false;
        const link = step.href
          ? `<a href="${step.href}" target="_blank" rel="noopener">${step.title}</a>`
          : `<strong>${step.title}</strong>`;
        return `<li>
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
            <div>${link}<p class="field__hint" style="margin:6px 0 0">${step.detail}</p></div>
            <span class="badge badge--${complete ? "success" : "neutral"}">${complete ? "Done" : `Step ${i + 1}`}</span>
          </div>
        </li>`;
      })
      .join("");

    $("capabilities").innerHTML = (data.capabilities || [])
      .map(
        (cap) => `<div class="cap-item">
        <div><strong>${cap.label}</strong><p>${cap.detail}</p></div>
        <span class="badge badge--${badgeForStatus(cap.status)}">${String(cap.status).replace(/_/g, " ")}</span>
      </div>`
      )
      .join("");

    const portals = data.portals || {};
    $("portals").innerHTML = Object.entries(portals)
      .map(
        ([key, href]) => `<a class="portal-item" href="${href}" target="_blank" rel="noopener">
        <div><strong>${key}</strong><p>${href}</p></div>
        <span class="btn btn--link">Open</span>
      </a>`
      )
      .join("");

    if (portals.developer) $("openDeveloper").href = portals.developer;
    if (portals.appStoreConnect) $("openAsc").href = portals.appStoreConnect;
  }

  async function refresh() {
    const data = await api("/api/apple/status");
    renderStatus(data);
    toast("Apple console status refreshed", "success");
  }

  async function generateToken() {
    try {
      const data = await api("/api/apple/token", { method: "POST", body: "{}" });
      const out = $("tokenOut");
      out.hidden = false;
      out.textContent = JSON.stringify(data, null, 2);
      toast("API token generated (preview)", "success");
    } catch (error) {
      const out = $("tokenOut");
      out.hidden = false;
      out.textContent = JSON.stringify(error.payload || { message: error.message }, null, 2);
      toast(error.message, "error");
    }
  }

  async function loadApps() {
    try {
      const data = await api("/api/apple/apps");
      const out = $("appsOut");
      out.hidden = false;
      out.textContent = JSON.stringify(data, null, 2);
      toast(data.source === "live" ? "Apps loaded from Apple" : "Apps blocked — showing stub", data.source === "live" ? "success" : "warning");
    } catch (error) {
      const out = $("appsOut");
      out.hidden = false;
      out.textContent = JSON.stringify(error.payload || { message: error.message }, null, 2);
      toast(error.message, "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = [...(window.RTPSCShell?.DEFAULT_NAV || []), ...EXTRA_NAV];
    window.RTPSCShell?.mount({
      activeId: "apple_console",
      serviceName: "apple-developer-console",
      env: "local",
      nav
    });
    $("refreshBtn")?.addEventListener("click", () => refresh().catch((e) => toast(e.message, "error")));
    $("tokenBtn")?.addEventListener("click", generateToken);
    $("tokenBtnMobile")?.addEventListener("click", generateToken);
    $("appsBtn")?.addEventListener("click", loadApps);
    refresh().catch((e) => toast(e.message, "error"));
  });
})();
