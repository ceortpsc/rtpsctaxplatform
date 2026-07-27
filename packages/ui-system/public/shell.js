/**
 * RTPSC App Shell runtime — theme, navigation, command palette, toasts, modals.
 * Dependency-free browser module. Works with or without SSR markup.
 */
(function (global) {
  const STORAGE_THEME = "rtpsc.theme";
  const STORAGE_SIDEBAR = "rtpsc.sidebarCollapsed";

  const ICONS = {
    dashboard: "▣",
    activity: "↻",
    tasks: "☑",
    notifications: "◉",
    clients: "☰",
    intake: "⎘",
    documents: "▤",
    refunds: "↺",
    ai_workforce: "✦",
    invoices: "$",
    payments: "₡",
    service_catalog: "≡",
    pos: "▢",
    financial_reports: "▥",
    approvals: "✓",
    cases: "▦",
    staff: "웃",
    roles: "⚿",
    jurisdictions: "⌖",
    security: "⊡",
    audit_logs: "▤",
    system_settings: "⚙",
    modules: "▦",
    insights: "◈",
    assistant: "✧",
    graph: "⧉",
    status: "◉",
    design_system: "❖",
    control_plane: "▣",
    apple_console: "",
    help: "?",
    contact: "✉"
  };

  const DEFAULT_NAV = [
    {
      id: "overview",
      label: "Overview",
      items: [
        { id: "dashboard", label: "Dashboard", href: "#dashboard" },
        { id: "activity", label: "Activity", href: "#activity", limited: true },
        { id: "tasks", label: "Tasks", href: "#tasks", limited: true },
        { id: "notifications", label: "Notifications", href: "#notifications", limited: true }
      ]
    },
    {
      id: "client_operations",
      label: "Client Operations",
      items: [
        { id: "clients", label: "Clients", href: "http://localhost:3006/#crm" },
        { id: "intake", label: "Intake", href: "http://localhost:3004/", limited: true },
        { id: "documents", label: "Documents", href: "#documents", limited: true }
      ]
    },
    {
      id: "tax_operations",
      label: "Tax Operations",
      items: [
        { id: "refunds", label: "Refunds", href: "http://localhost:3001/" },
        { id: "ai_workforce", label: "AI Workforce", href: "http://localhost:8860/", limited: true }
      ]
    },
    {
      id: "financial_operations",
      label: "Financial Operations",
      items: [
        { id: "invoices", label: "Invoices", href: "http://localhost:3005/" },
        { id: "payments", label: "Payments", href: "http://localhost:3005/#payments", limited: true },
        { id: "service_catalog", label: "Service Catalog", href: "http://localhost:3005/#catalog" },
        { id: "pos", label: "Point of Sale", href: "http://localhost:3006/#pos" },
        { id: "financial_reports", label: "Financial Reports", href: "#reports", limited: true }
      ]
    },
    {
      id: "workflow",
      label: "Workflow",
      items: [
        { id: "approvals", label: "Approvals", href: "http://localhost:3005/#approvals", limited: true },
        { id: "cases", label: "Cases", href: "http://localhost:3001/" }
      ]
    },
    {
      id: "administration",
      label: "Administration",
      items: [
        { id: "staff", label: "Staff", href: "#staff", limited: true },
        { id: "roles", label: "Roles and Permissions", href: "http://127.0.0.1:8787/rbac" },
        { id: "apple_console", label: "Apple Developer Console", href: "http://localhost:8870/" },
        { id: "security", label: "Security", href: "http://127.0.0.1:8787/infrastructure", limited: true },
        { id: "audit_logs", label: "Audit Logs", href: "http://localhost:3004/", limited: true },
        { id: "system_settings", label: "System Settings", href: "#settings" }
      ]
    },
    {
      id: "integrations",
      label: "Integrations",
      items: [
        { id: "apple_console", label: "Apple Developer Console", href: "http://localhost:8870/" },
        { id: "control_plane", label: "Control Plane", href: "http://127.0.0.1:8787/dashboard" }
      ]
    },
    {
      id: "platform",
      label: "Platform",
      items: [
        { id: "modules", label: "Module Catalog", href: "#catalog" },
        { id: "insights", label: "Insights", href: "#insights" },
        { id: "assistant", label: "AI Assistant", href: "#assistant" },
        { id: "graph", label: "Dependency Graph", href: "#graph" },
        { id: "status", label: "System Status", href: "#status" },
        { id: "design_system", label: "Design System", href: "#design" },
        { id: "control_plane", label: "Control Plane", href: "http://127.0.0.1:8787/dashboard" }
      ]
    },
    {
      id: "support",
      label: "Support",
      items: [
        { id: "help", label: "Help Center", href: "#help", limited: true },
        { id: "contact", label: "Contact Support", href: "#help", limited: true }
      ]
    }
  ];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function ensureToasts() {
    let host = $("#rtpsc-toasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "rtpsc-toasts";
      host.className = "toasts";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, tone) {
    const host = ensureToasts();
    const el = document.createElement("div");
    el.className = `toast${tone ? ` toast--${tone}` : ""}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function applyTheme(theme) {
    const next = theme || "light";
    document.documentElement.setAttribute("data-theme", next === "light" ? "light" : next);
    if (next === "light") document.documentElement.removeAttribute("data-theme");
    if (next !== "light") document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_THEME, next);
    } catch {
      /* ignore */
    }
    document.querySelectorAll("[data-theme-label]").forEach((n) => {
      n.textContent = next;
    });
  }

  function cycleTheme() {
    const order = ["light", "dark", "high-contrast"];
    const current = localStorage.getItem(STORAGE_THEME) || "light";
    const idx = order.indexOf(current);
    applyTheme(order[(idx + 1) % order.length]);
    toast(`Theme: ${order[(idx + 1) % order.length]}`, "success");
  }

  function renderNav(navRoot, activeId, navModel) {
    if (!navRoot) return;
    const model = navModel || DEFAULT_NAV;
    navRoot.innerHTML = model
      .map((section) => {
        const items = section.items
          .map((item) => {
            const active = item.id === activeId || (item.href && location.hash === item.href);
            const badge = item.limited
              ? `<span class="nav-badge is-limited">Limited</span>`
              : item.beta
                ? `<span class="nav-badge is-beta">Beta</span>`
                : "";
            const ico = ICONS[item.id] || "•";
            return `<a class="app-shell__nav-item${active ? " is-active" : ""}" href="${item.href || "#"}" data-nav-id="${item.id}" ${active ? 'aria-current="page"' : ""}>
              <span class="app-shell__nav-ico" aria-hidden="true">${ico}</span>
              <span class="app-shell__nav-label">${item.label}</span>
              ${badge}
            </a>`;
          })
          .join("");
        return `<div class="app-shell__section">
          <div class="app-shell__section-label">${section.label}</div>
          ${items}
        </div>`;
      })
      .join("");
  }

  function mountShell(options) {
    const opts = options || {};
    const root = $(opts.root || "[data-app-shell]") || document.body;
    const activeId = opts.activeId || root.getAttribute("data-active") || "dashboard";
    const serviceName = opts.serviceName || root.getAttribute("data-service") || "RTPSC";
    const env = opts.env || root.getAttribute("data-env") || "local";
    const title = opts.title || document.title;
    const description = opts.description || "";

    if (!root.classList.contains("app-shell") && root.hasAttribute("data-app-shell")) {
      root.classList.add("app-shell");
    }

    const nav = $("#app-nav", root) || $("[data-shell-nav]", root);
    renderNav(nav, activeId, opts.nav);

    const envEl = $("[data-shell-env]", root);
    if (envEl) {
      envEl.textContent = `${env} · ${serviceName}`;
      envEl.setAttribute("data-env", env === "production" || env === "prod" ? "prod" : env);
    }

    const collapsed = localStorage.getItem(STORAGE_SIDEBAR) === "1";
    if (collapsed) root.classList.add("is-collapsed");

    document.querySelectorAll("[data-action='toggle-sidebar']").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.classList.toggle("is-collapsed");
        try {
          localStorage.setItem(STORAGE_SIDEBAR, root.classList.contains("is-collapsed") ? "1" : "0");
        } catch {
          /* ignore */
        }
      });
    });

    document.querySelectorAll("[data-action='open-drawer']").forEach((btn) => {
      btn.addEventListener("click", () => root.classList.add("is-drawer-open"));
    });
    document.querySelectorAll("[data-action='close-drawer']").forEach((btn) => {
      btn.addEventListener("click", () => root.classList.remove("is-drawer-open"));
    });
    document.querySelectorAll("[data-action='cycle-theme']").forEach((btn) => {
      btn.addEventListener("click", cycleTheme);
    });
    document.querySelectorAll("[data-action='open-search']").forEach((btn) => {
      btn.addEventListener("click", () => openCommandPalette(opts.searchItems || []));
    });

    const savedTheme = localStorage.getItem(STORAGE_THEME) || "light";
    applyTheme(savedTheme);

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommandPalette(opts.searchItems || []);
      }
      if (e.key === "Escape") {
        root.classList.remove("is-drawer-open");
        closeCommandPalette();
        closeModal();
      }
      if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey && !isTyping(e.target)) {
        cycleTheme();
      }
    });

    return { toast, applyTheme, cycleTheme, activeId, title, description };
  }

  function isTyping(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function openCommandPalette(items) {
    closeCommandPalette();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "rtpsc-palette";
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Global search">
      <div class="modal__body" style="padding:12px">
        <input id="rtpsc-palette-input" class="field__control" type="search" placeholder="Search clients, invoices, modules, actions…" aria-label="Search" style="min-height:48px" />
        <ul id="rtpsc-palette-results" style="list-style:none;margin:12px 0 0;padding:0;max-height:360px;overflow:auto"></ul>
        <div class="field__hint" style="margin-top:10px">↑↓ navigate · Enter open · Esc close</div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const input = $("#rtpsc-palette-input");
    const results = $("#rtpsc-palette-results");
    const catalog = items.length
      ? items
      : DEFAULT_NAV.flatMap((s) =>
          s.items.map((i) => ({ type: s.label, name: i.label, href: i.href, status: i.limited ? "Limited" : "Available" }))
        );

    function render(q) {
      const query = (q || "").toLowerCase().trim();
      const matched = catalog.filter((item) => {
        if (!query) return true;
        return `${item.type} ${item.name} ${item.status || ""}`.toLowerCase().includes(query);
      }).slice(0, 40);
      if (!matched.length) {
        results.innerHTML = `<li class="table-empty">No matching results for “${query}”.</li>`;
        return;
      }
      results.innerHTML = matched
        .map(
          (item, idx) => `<li>
          <a href="${item.href || "#"}" data-idx="${idx}" style="display:flex;gap:12px;padding:10px 8px;border-radius:8px;text-decoration:none;color:inherit">
            <span class="badge badge--neutral">${item.type || "Item"}</span>
            <span style="flex:1"><strong>${item.name}</strong>${item.status ? ` · ${item.status}` : ""}</span>
          </a>
        </li>`
        )
        .join("");
    }

    render("");
    input.focus();
    input.addEventListener("input", () => render(input.value));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeCommandPalette();
    });
  }

  function closeCommandPalette() {
    $("#rtpsc-palette")?.remove();
  }

  function openModal({ title, bodyHtml, footHtml, size }) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "rtpsc-modal";
    overlay.innerHTML = `<div class="modal${size === "lg" ? " modal--lg" : ""}" role="dialog" aria-modal="true" aria-label="${title || "Dialog"}">
      <div class="modal__head"><h2 style="margin:0;font-family:var(--font-display);font-size:1.25rem">${title || ""}</h2>
        <button type="button" class="btn btn--icon btn--quiet" data-close-modal aria-label="Close">✕</button></div>
      <div class="modal__body">${bodyHtml || ""}</div>
      ${footHtml ? `<div class="modal__foot">${footHtml}</div>` : ""}
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-close-modal]")?.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    return overlay;
  }

  function closeModal() {
    $("#rtpsc-modal")?.remove();
  }

  function statusBadge(code, label) {
    const tones = {
      paid: "success",
      approved: "success",
      complete: "success",
      active: "success",
      accepted: "success",
      verified: "success",
      unpaid: "warning",
      pending: "warning",
      draft: "neutral",
      submitted: "info",
      past_due: "danger",
      rejected: "danger",
      failed: "danger",
      locked: "danger"
    };
    const tone = tones[code] || "neutral";
    return `<span class="badge badge--${tone}" title="${label || code}">${label || String(code).replace(/_/g, " ")}</span>`;
  }

  function pageHeader({ crumbs, category, title, description, primary, secondary, statusHtml }) {
    const crumbHtml = (crumbs || [])
      .map((c, i, arr) =>
        i === arr.length - 1
          ? `<span aria-current="page">${c.label}</span>`
          : `<a href="${c.href || "#"}">${c.label}</a><span aria-hidden="true">/</span>`
      )
      .join("");
    const actions = [
      secondary ? `<button type="button" class="btn btn--secondary" data-secondary-cta>${secondary}</button>` : "",
      primary ? `<button type="button" class="btn btn--primary" data-primary-cta>${primary}</button>` : ""
    ].join("");
    return `<header class="page-header">
      <nav class="page-header__crumbs" aria-label="Breadcrumb">${crumbHtml}</nav>
      ${category ? `<div class="page-header__category">${category}</div>` : ""}
      <div class="page-header__row">
        <div class="page-header__titles">
          <h1 class="page-header__title">${title || ""}</h1>
          ${description ? `<p class="page-header__desc">${description}</p>` : ""}
          ${statusHtml || ""}
        </div>
        <div class="page-header__actions">${actions}</div>
      </div>
    </header>`;
  }

  global.RTPSCShell = {
    mount: mountShell,
    toast,
    applyTheme,
    cycleTheme,
    openModal,
    closeModal,
    openCommandPalette,
    closeCommandPalette,
    statusBadge,
    pageHeader,
    DEFAULT_NAV,
    ICONS
  };
})(typeof window !== "undefined" ? window : globalThis);
