const state = {
  catalog: [],
  summary: { totalModules: 0, categories: [] },
  allModules: [],
  view: "catalog",
  catalogFilter: "all",
  catalogSearch: "",
  thread: [],
  environment: null,
  palette: { open: false, results: [], active: 0 }
};

/* ---------- Persistence & preferences ---------- */
const STORE = { fav: "rtp.favorites", prefs: "rtp.prefs" };

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — features degrade gracefully */
  }
}

const favorites = new Set(loadJSON(STORE.fav, []));
const prefs = Object.assign({ theme: "cream", motion: "on", statusMs: 5000 }, loadJSON(STORE.prefs, {}));
let statusTimer = null;
let navKeyArmed = false;

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
};

async function getJSON(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

async function postJSON(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

async function boot() {
  applyPrefs();
  try {
    const data = await getJSON("/api/modules");
    state.catalog = data.categories;
    state.summary = data.summary;
    state.allModules = data.categories.flatMap((group) =>
      group.modules.map((module) => ({ ...module, category: group.category }))
    );
    countUp("stat-modules", data.summary.totalModules);
    countUp("stat-categories", data.summary.categories.length);
  } catch (error) {
    document.getElementById("view").innerHTML = `<p class="empty">Failed to load: ${error.message}</p>`;
    return;
  }
  wireNav();
  wirePalette();
  initFeatures();
  loadEnvironment();
  render();
}

function wireNav() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

const VIEW_META = {
  catalog: { title: "Catalog", kicker: "Platform module inventory" },
  insights: { title: "Insights", kicker: "AI-assisted analysis & recommendations" },
  assistant: { title: "AI Assistant", kicker: "Ask the platform about its modules" },
  graph: { title: "Dependency Graph", kicker: "How the modules connect" },
  design: { title: "Design System", kicker: "The Sovereign Ledger visual language" }
};

function setView(view) {
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  const meta = VIEW_META[view] ?? { title: view, kicker: "" };
  document.getElementById("view-title").textContent = meta.title;
  const kicker = document.getElementById("view-kicker");
  if (kicker) kicker.textContent = meta.kicker;
  render();
}

function render() {
  if (statusTimer && state.view !== "status") {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  const view = document.getElementById("view");
  view.innerHTML = "";
  if (state.view === "catalog") view.appendChild(renderCatalog());
  else if (state.view === "insights") renderInsights(view);
  else if (state.view === "assistant") view.appendChild(renderAssistant());
  else if (state.view === "graph") renderGraph(view);
  else if (state.view === "design") renderDesign(view);
  else if (state.view === "status") renderStatus(view);
}

/* ---------- Animation helpers ---------- */
function animateReveal(scope = document) {
  const nodes = [...scope.querySelectorAll(".reveal:not(.in)")];
  nodes.forEach((node, index) => {
    setTimeout(() => node.classList.add("in"), Math.min(index * 55, 600));
  });
}

function countUp(id, target) {
  const node = document.getElementById(id);
  if (!node) return;
  const duration = 700;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(step);
    else node.textContent = target;
  };
  requestAnimationFrame(step);
}

/* ---------- Catalog ---------- */
function moduleCard(module) {
  const card = el("article", { class: "module-card reveal", "data-name": module.name });
  const star = el("button", {
    class: "star-btn" + (favorites.has(module.name) ? " on" : ""),
    title: "Pin to favorites",
    text: favorites.has(module.name) ? "★" : "☆",
    onclick: (event) => {
      event.stopPropagation();
      toggleFavorite(module.name);
      star.classList.toggle("on");
      star.textContent = favorites.has(module.name) ? "★" : "☆";
    }
  });
  card.appendChild(star);
  card.appendChild(el("h3", { class: "module-name", text: module.name, title: "Open details", onclick: () => openDrawer(module.name) }));
  card.appendChild(el("p", { class: "module-summary", text: module.summary ?? "" }));
  const tags = el("div", { class: "module-tags" });
  for (const tag of module.tags ?? []) tags.appendChild(el("span", { class: "tag", text: tag }));
  card.appendChild(tags);
  const detail = el("pre", { class: "module-detail", text: JSON.stringify(module.detail ?? {}, null, 2) });
  const toggle = el("button", {
    class: "detail-toggle",
    text: "Details",
    onclick: () => card.classList.toggle("open")
  });
  card.appendChild(toggle);
  card.appendChild(detail);
  return card;
}

function renderCatalog() {
  const frag = document.createDocumentFragment();
  const toolbar = el("div", { class: "toolbar" });
  const search = el("input", {
    class: "search-inline",
    type: "text",
    placeholder: "Filter modules by name, tag, or summary…",
    value: state.catalogSearch
  });
  search.addEventListener("input", () => {
    state.catalogSearch = search.value.toLowerCase();
    const focus = document.activeElement === search;
    refreshCatalogBody();
    if (focus) document.querySelector(".search-inline").focus();
  });
  toolbar.appendChild(search);

  const filters = el("div", { class: "filters" });
  const options = [
    { v: "all", label: "all" },
    { v: "favorites", label: `★ favorites` },
    ...state.catalog.map((g) => ({ v: g.category, label: g.category }))
  ];
  options.forEach(({ v, label }) => {
    filters.appendChild(
      el("button", {
        class: "filter-btn" + (v === state.catalogFilter ? " active" : ""),
        "data-filter": v,
        text: label,
        onclick: () => {
          state.catalogFilter = v;
          refreshCatalogBody();
        }
      })
    );
  });
  toolbar.appendChild(filters);
  frag.appendChild(toolbar);
  frag.appendChild(el("div", { class: "catalog-body", id: "catalog-body" }));
  // Defer body fill until in DOM handled by refreshCatalogBody after render.
  setTimeout(refreshCatalogBody, 0);
  return frag;
}

function refreshCatalogBody() {
  const body = document.getElementById("catalog-body");
  if (!body) return;
  // Update filter active states
  document.querySelectorAll(".filters .filter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.filter === state.catalogFilter);
  });
  body.innerHTML = "";
  const term = state.catalogSearch;
  const favMode = state.catalogFilter === "favorites";
  const groups = state.catalog.filter((g) => favMode || state.catalogFilter === "all" || g.category === state.catalogFilter);
  let shown = 0;
  for (const group of groups) {
    const modules = group.modules.filter((m) => {
      if (favMode && !favorites.has(m.name)) return false;
      if (!term) return true;
      return (
        m.name.toLowerCase().includes(term) ||
        (m.summary ?? "").toLowerCase().includes(term) ||
        (m.tags ?? []).join(" ").toLowerCase().includes(term)
      );
    });
    if (modules.length === 0) continue;
    shown += modules.length;
    const section = el("section", { class: "category" });
    const head = el("div", { class: "category-head" }, [
      el("h2", { class: "category-title", text: group.category }),
      el("span", { class: "category-count", text: `${modules.length} modules` })
    ]);
    section.appendChild(head);
    section.appendChild(el("p", { class: "category-desc", text: group.description }));
    const grid = el("div", { class: "module-grid" });
    modules.forEach((m) => grid.appendChild(moduleCard(m)));
    section.appendChild(grid);
    body.appendChild(section);
  }
  if (shown === 0) body.appendChild(el("p", { class: "empty", text: "No modules match your filter." }));
  animateReveal(body);
}

/* ---------- Insights ---------- */
async function renderInsights(view) {
  view.appendChild(el("p", { class: "empty", text: "Analyzing modules…" }));
  let insights;
  try {
    insights = await getJSON("/api/insights");
  } catch (error) {
    view.innerHTML = `<p class="empty">Failed to load insights: ${error.message}</p>`;
    return;
  }
  view.innerHTML = "";

  const grid = el("div", { class: "insight-grid" });
  grid.appendChild(
    el("div", { class: "insight-card" }, [
      el("h3", { text: "Total Modules" }),
      el("div", { class: "big-number", text: String(insights.totalModules) })
    ])
  );
  grid.appendChild(
    el("div", { class: "insight-card" }, [
      el("h3", { text: "Background Workflows" }),
      el("div", { class: "big-number", text: String(insights.backgroundWorkflows) })
    ])
  );

  const triggerCard = el("div", { class: "insight-card" }, [el("h3", { text: "Workflow Triggers" })]);
  const maxTrigger = Math.max(1, ...Object.values(insights.triggerCounts));
  for (const [label, count] of Object.entries(insights.triggerCounts)) {
    triggerCard.appendChild(
      el("div", { class: "bar-row" }, [
        el("span", { class: "bar-label", text: label }),
        el("div", { class: "bar-track" }, [el("div", { class: "bar-fill", "data-w": (count / maxTrigger) * 100 })]),
        el("span", { class: "bar-value", text: String(count) })
      ])
    );
  }
  grid.appendChild(triggerCard);

  const catCard = el("div", { class: "insight-card" }, [el("h3", { text: "Modules by Category" })]);
  const maxCat = Math.max(1, ...insights.categoryCounts.map((c) => c.count));
  for (const { category, count } of insights.categoryCounts) {
    catCard.appendChild(
      el("div", { class: "bar-row" }, [
        el("span", { class: "bar-label", text: category }),
        el("div", { class: "bar-track" }, [el("div", { class: "bar-fill", "data-w": (count / maxCat) * 100 })]),
        el("span", { class: "bar-value", text: String(count) })
      ])
    );
  }
  grid.appendChild(catCard);
  view.appendChild(grid);

  requestAnimationFrame(() =>
    view.querySelectorAll(".bar-fill[data-w]").forEach((fill) => {
      fill.style.width = `${fill.getAttribute("data-w")}%`;
    })
  );

  view.appendChild(el("h2", { class: "section-title", text: "AI-assisted recommendations" }));
  for (const rec of insights.recommendations) {
    view.appendChild(
      el("div", { class: `rec ${rec.severity}` }, [
        el("span", { class: "rec-sev", text: rec.severity }),
        el("div", { class: "rec-body" }, [
          rec.module ? el("span", { class: "rec-module", text: rec.module + " · " }) : null,
          document.createTextNode(rec.message)
        ])
      ])
    );
  }

  view.querySelectorAll(".insight-card, .rec").forEach((node) => node.classList.add("reveal"));
  animateReveal(view);
}

/* ---------- Assistant ---------- */
function renderAssistant() {
  const wrap = el("div", { class: "assistant" });
  wrap.appendChild(
    el("p", {
      class: "assistant-intro",
      html:
        'Ask about the platform modules — triggers, dependencies, categories, or compliance. ' +
        'Powered by a local, dependency-free heuristic engine <span class="tag pill">no external LLM</span>.'
    })
  );

  const chips = el("div", { class: "chips" });
  [
    "Which workflows are event-driven?",
    "How many modules are there?",
    "What depends on refund-status-service?",
    "Show compliance-related modules",
    "scheduled background workflows"
  ].forEach((prompt) => {
    chips.appendChild(el("span", { class: "chip", text: prompt, onclick: () => ask(prompt) }));
  });
  wrap.appendChild(chips);

  const thread = el("div", { class: "thread", id: "thread" });
  state.thread.forEach((msg) => thread.appendChild(renderMessage(msg)));
  wrap.appendChild(thread);

  const input = el("input", { class: "ask-input", type: "text", placeholder: "Ask about the modules…" });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && input.value.trim()) ask(input.value.trim());
  });
  const row = el("div", { class: "ask-row" }, [
    input,
    el("button", { class: "ask-btn", text: "Ask", onclick: () => input.value.trim() && ask(input.value.trim()) })
  ]);
  wrap.appendChild(row);
  setTimeout(() => input.focus(), 0);
  return wrap;
}

function renderMessage(msg) {
  if (msg.role === "user") return el("div", { class: "msg user", text: msg.text });
  const bot = el("div", { class: "msg bot" });
  bot.appendChild(el("div", { class: "msg-intent", text: msg.intent ?? "answer" }));
  bot.appendChild(document.createTextNode(msg.text));
  if (msg.matches && msg.matches.length) {
    const matches = el("div", { class: "msg-matches" });
    msg.matches.forEach((m) => {
      matches.appendChild(
        el("span", {
          class: "match-chip",
          text: m.name,
          onclick: () => openModule(m.name)
        })
      );
    });
    bot.appendChild(matches);
  }
  return bot;
}

async function ask(query) {
  state.thread.push({ role: "user", text: query });
  render();
  try {
    const result = await postJSON("/api/assistant", { query });
    state.thread.push({ role: "bot", text: result.answer, intent: result.intent, matches: result.matches });
  } catch (error) {
    state.thread.push({ role: "bot", text: `Error: ${error.message}`, intent: "error" });
  }
  render();
  const thread = document.getElementById("thread");
  if (thread) thread.scrollIntoView({ block: "end" });
}

/* ---------- Dependency Graph ---------- */
const CATEGORY_COLORS = {
  packages: "#14213d",
  services: "#b8860b",
  workers: "#6b7280",
  pipelines: "#9c7a1e",
  engines: "#22345f",
  workflows: "#d4af37",
  external: "#9aa1ac"
};

async function renderGraph(view) {
  view.appendChild(el("p", { class: "empty", text: "Building graph…" }));
  let graph;
  try {
    graph = await getJSON("/api/graph");
  } catch (error) {
    view.innerHTML = `<p class="empty">Failed to load graph: ${error.message}</p>`;
    return;
  }
  view.innerHTML = "";

  const legend = el("div", { class: "graph-legend" });
  Object.entries(CATEGORY_COLORS).forEach(([cat, color]) => {
    legend.appendChild(
      el("div", { class: "legend-item" }, [
        el("span", { class: "legend-dot", style: `background:${color}` }),
        document.createTextNode(cat)
      ])
    );
  });
  view.appendChild(legend);

  // Layered layout: group nodes into columns by category order.
  const order = ["packages", "engines", "pipelines", "workflows", "workers", "services", "external"];
  const columns = new Map();
  order.forEach((cat) => columns.set(cat, []));
  for (const node of graph.nodes) {
    if (!columns.has(node.category)) columns.set(node.category, []);
    columns.get(node.category).push(node);
  }

  const colWidth = 210;
  const rowHeight = 54;
  const activeCols = [...columns.entries()].filter(([, nodes]) => nodes.length > 0);
  const width = Math.max(900, activeCols.length * colWidth + 80);
  const maxRows = Math.max(...activeCols.map(([, n]) => n.length), 1);
  const height = Math.max(420, maxRows * rowHeight + 60);

  const pos = new Map();
  activeCols.forEach(([, nodes], colIndex) => {
    const x = 60 + colIndex * colWidth;
    nodes.forEach((node, rowIndex) => {
      const y = 50 + rowIndex * rowHeight + ((maxRows - nodes.length) * rowHeight) / 2;
      pos.set(node.id, { x, y, category: node.category });
    });
  });

  const SVG = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  for (const edge of graph.edges) {
    const a = pos.get(edge.from);
    const b = pos.get(edge.to);
    if (!a || !b) continue;
    const path = document.createElementNS(SVG, "path");
    const midX = (a.x + b.x) / 2;
    path.setAttribute("d", `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`);
    path.setAttribute("class", `gedge ${edge.type}`);
    svg.appendChild(path);
  }

  for (const [id, p] of pos.entries()) {
    const g = document.createElementNS(SVG, "g");
    g.setAttribute("class", "gnode");
    g.setAttribute("transform", `translate(${p.x}, ${p.y})`);
    const circle = document.createElementNS(SVG, "circle");
    circle.setAttribute("r", "8");
    circle.setAttribute("fill", CATEGORY_COLORS[p.category] ?? "#8b98a9");
    const text = document.createElementNS(SVG, "text");
    text.setAttribute("x", "13");
    text.setAttribute("y", "4");
    text.textContent = id;
    g.appendChild(circle);
    g.appendChild(text);
    g.addEventListener("click", () => {
      setView("catalog");
      openModule(id);
    });
    svg.appendChild(g);
  }

  const wrap = el("div", { class: "graph-wrap" });
  wrap.appendChild(svg);
  view.appendChild(wrap);
}

/* ---------- Cross-view helpers ---------- */
function openModule(name) {
  setView("catalog");
  state.catalogFilter = "all";
  state.catalogSearch = "";
  render();
  setTimeout(() => {
    const card = document.querySelector(`.module-card[data-name="${CSS.escape(name)}"]`);
    if (card) {
      card.classList.add("open", "flash");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => card.classList.remove("flash"), 1600);
    }
  }, 60);
}

/* ---------- Design System ---------- */
const PALETTE_SWATCHES = [
  { name: "Cream (base)", hex: "#f1e8d2", ink: "#14213d" },
  { name: "Cream 100", hex: "#f8f2e2", ink: "#14213d" },
  { name: "Gold", hex: "#b8860b", ink: "#ffffff" },
  { name: "Gold bright", hex: "#d4af37", ink: "#14213d" },
  { name: "Navy (ink)", hex: "#14213d", ink: "#ffffff" },
  { name: "Navy 500", hex: "#22345f", ink: "#ffffff" },
  { name: "Black trim", hex: "#16181d", ink: "#ffffff" },
  { name: "White", hex: "#ffffff", ink: "#14213d" },
  { name: "Silver", hex: "#9aa1ac", ink: "#14213d" }
];

function dsPanel(title, note, children) {
  return el("section", { class: "ds-panel reveal" }, [
    el("h2", { text: title }),
    note ? el("p", { class: "ds-note", text: note }) : null,
    ...[].concat(children)
  ]);
}

function renderDesign(view) {
  const hero = el("div", { class: "ds-hero reveal" }, [
    el("img", { class: "ds-hero-rosette", src: "/assets/guilloche.svg", alt: "" }),
    el("p", { class: "ds-hero-eyebrow", text: "Ross Tax Pro Software Co · Design Language" }),
    el("h1", { class: "ds-hero-title", html: 'The <span class="grad">Sovereign Ledger</span> System' }),
    el("p", {
      class: "ds-hero-sub",
      text:
        "A treasury-grade visual language — engraved guilloché artwork, an embossed seal, " +
        "a cream-and-navy canvas, and gold that behaves like light on metal. Every token, " +
        "curve, and motion cue is tuned to feel considered, official, and unmistakably premium."
    }),
    el("div", { class: "ds-hero-rule" })
  ]);
  view.appendChild(hero);

  // Palette
  const swatchGrid = el("div", { class: "swatch-grid" });
  PALETTE_SWATCHES.forEach((s) => {
    swatchGrid.appendChild(
      el("div", { class: "swatch" }, [
        el("div", { class: "swatch-chip", style: `background:${s.hex}` }),
        el("div", { class: "swatch-meta" }, [
          el("div", { class: "swatch-name", text: s.name }),
          el("div", { class: "swatch-hex", text: s.hex })
        ])
      ])
    );
  });
  view.appendChild(dsPanel("Color", "Cream base · gold · navy blue · black trim · white · silver.", swatchGrid));

  // Typography
  const typeRows = [
    ["Display / 46", "display", "Sovereign Ledger", "font-family: var(--font-display); font-size: 46px;"],
    ["Display / 26", "display", "Platform Modules", "font-size: 26px;"],
    ["Body / 16", "", "Every module is an executable, compliant stub.", "font-size: 16px;"],
    ["Body / 14", "", "Read-only inventory of the platform surface.", "font-size: 14px;"],
    ["Mono / 13", "mono", "workflow-runner · api-gateway", "font-family: var(--font-mono);"]
  ].map(([tag, cls, sample, style]) =>
    el("div", { class: "type-row" }, [
      el("span", { class: "type-tag", text: tag }),
      el("span", { class: `type-sample ${cls}`, style, text: sample })
    ])
  );
  view.appendChild(dsPanel("Typography", "Serif display for authority, humanist sans for clarity, mono for identifiers.", typeRows));

  // Components
  const gallery = el("div", { class: "gallery" }, [
    el("button", { class: "ask-btn", text: "Primary action", style: "height:40px" }),
    el("button", { class: "filter-btn active", text: "active filter" }),
    el("button", { class: "filter-btn", text: "filter" }),
    el("span", { class: "tag", text: "event-driven" }),
    el("span", { class: "chip", text: "suggested prompt" })
  ]);
  const barDemo = el("div", { class: "bar-row", style: "max-width:360px;margin-top:16px" }, [
    el("span", { class: "bar-label", text: "sample" }),
    el("div", { class: "bar-track" }, [el("div", { class: "bar-fill", style: "width:72%" })]),
    el("span", { class: "bar-value", text: "72" })
  ]);
  view.appendChild(dsPanel("Components", "Buttons, filters, tags, chips, and data bars share one gold→navy accent system.", [gallery, barDemo]));

  // Motion
  const motion = el("div", { class: "motion-grid" }, [
    motionCard("Float", el("div", { class: "demo-coin u-float" })),
    motionCard("Gold shimmer", el("div", { class: "demo-shimmer" })),
    motionCard("Bar reveal", el("div", { class: "demo-bar-track" }, [el("div", { class: "demo-bar-fill" })])),
    motionCard("Rosette spin", el("img", { src: "/assets/guilloche.svg", alt: "", style: "width:52px;animation:rtp-spin-slow 14s linear infinite" }))
  ]);
  view.appendChild(dsPanel("Motion", "Calm, purposeful motion: fade-rise entrances, staggered reveals, metallic shimmer, and slow engraving spins. Honors prefers-reduced-motion.", motion));

  // Artwork
  const art = el("div", { class: "ds-art" }, [
    el("img", { src: "/assets/emblem.svg", alt: "RTPSC seal", width: "128", height: "128" }),
    el("img", { src: "/assets/guilloche.svg", alt: "Guilloché rosette", width: "180", height: "180" }),
    el("p", {
      class: "ds-note",
      style: "max-width:34ch",
      text:
        "The seal fuses a ledger crest, ascending bars, and a milled coin edge. The guilloché rosette " +
        "echoes currency-grade security engraving — hand-tuned overlapping ellipses."
    })
  ]);
  view.appendChild(dsPanel("Concept artwork", "Original, dependency-free SVG graphics — no external assets.", art));

  animateReveal(view);
}

function motionCard(label, demo) {
  return el("div", { class: "motion-card" }, [el("div", { class: "motion-demo" }, [demo]), document.createTextNode(label)]);
}

/* ---------- Command palette ---------- */
function wirePalette() {
  document.getElementById("open-palette").addEventListener("click", openPalette);
  const input = document.getElementById("palette-input");
  const overlay = document.getElementById("palette");

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openPalette();
    } else if (event.key === "Escape" && state.palette.open) {
      closePalette();
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePalette();
  });

  input.addEventListener("input", () => updatePalette(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.palette.active = Math.min(state.palette.active + 1, state.palette.results.length - 1);
      drawPalette();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.palette.active = Math.max(state.palette.active - 1, 0);
      drawPalette();
    } else if (event.key === "Enter") {
      const pick = state.palette.results[state.palette.active];
      if (pick) {
        closePalette();
        pick.run();
      }
    }
  });
}

function paletteEntries(term) {
  const q = term.toLowerCase();
  const commands = [
    { label: "Go to Catalog", sub: "view", run: () => setView("catalog") },
    { label: "Go to Insights", sub: "view", run: () => setView("insights") },
    { label: "Go to AI Assistant", sub: "view", run: () => setView("assistant") },
    { label: "Go to Dependency Graph", sub: "view", run: () => setView("graph") },
    { label: "Go to System Status", sub: "view", run: () => setView("status") },
    { label: "Go to Design System", sub: "view", run: () => setView("design") },
    { label: "Toggle theme (Cream / Midnight)", sub: "action", run: toggleTheme },
    { label: "Export catalog JSON", sub: "action", run: exportCatalog },
    { label: "Open settings", sub: "action", run: openSettings },
    { label: "Show keyboard shortcuts", sub: "action", run: openShortcuts }
  ];
  const modules = state.allModules.map((m) => ({ label: m.name, sub: m.category, run: () => openDrawer(m.name) }));
  const all = [...commands, ...modules];
  if (!q) return all.slice(0, 14);
  return all.filter((e) => e.label.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q)).slice(0, 14);
}

function openPalette() {
  state.palette.open = true;
  document.getElementById("palette").hidden = false;
  const input = document.getElementById("palette-input");
  input.value = "";
  updatePalette("");
  input.focus();
}

function closePalette() {
  state.palette.open = false;
  document.getElementById("palette").hidden = true;
}

function updatePalette(term) {
  state.palette.results = paletteEntries(term);
  state.palette.active = 0;
  drawPalette();
}

function drawPalette() {
  const list = document.getElementById("palette-results");
  list.innerHTML = "";
  state.palette.results.forEach((entry, index) => {
    list.appendChild(
      el("li", {
        class: "palette-item" + (index === state.palette.active ? " active" : ""),
        onclick: () => {
          closePalette();
          entry.run();
        }
      }, [
        el("span", { class: "pi-name", text: entry.label }),
        el("span", { class: "pi-cat", text: entry.sub })
      ])
    );
  });
  if (state.palette.results.length === 0) {
    list.appendChild(el("li", { class: "palette-item", text: "No matches" }));
  }
}

/* ---------- Environment protection ---------- */
async function loadEnvironment() {
  try {
    state.environment = await getJSON("/api/environment");
  } catch {
    state.environment = null;
  }
  renderEnvBadge();
  return state.environment;
}

async function ensureEnvironment() {
  if (!state.environment) await loadEnvironment();
  return state.environment;
}

function renderEnvBadge() {
  const badge = document.getElementById("env-badge");
  const env = state.environment;
  if (!badge || !env) return;
  badge.hidden = false;
  badge.className = "env-badge " + (env.transmissionAllowed ? "live" : "protected");
  badge.title = env.transmissionAllowed
    ? "E-file transmission is LIVE in this environment"
    : "Environment protection active — live transmission blocked";
  badge.innerHTML = "";
  badge.appendChild(el("span", { class: "env-shield", text: env.transmissionAllowed ? "⚠" : "🛡" }));
  badge.appendChild(el("span", { class: "env-env", text: env.environment }));
  badge.appendChild(el("span", { class: "env-state", text: env.transmissionAllowed ? "E-file LIVE" : "Protected" }));
}

function envPanelContent(env) {
  const wrap = el("div", { class: "insight-card reveal" });
  wrap.appendChild(el("h3", { text: "Environment Protection" }));
  wrap.appendChild(
    el("div", {
      style: "font-family:var(--font-display);font-size:var(--fs-xl);color:var(--color-navy);margin-bottom:4px",
      text: `${env.environment.toUpperCase()} · ${env.transmissionAllowed ? "E-FILE LIVE" : "PROTECTED"}`
    })
  );
  wrap.appendChild(
    el("div", {
      class: "status-sub",
      text: env.transmissionAllowed
        ? "All safeguards satisfied — live IRS e-file transmission is permitted."
        : "Fail-safe active — live e-file transmission is blocked until every safeguard passes."
    })
  );

  const safeguards = [
    ["Production environment", env.safeguards.productionEnvironment],
    ["Secrets configured", env.safeguards.secretsConfigured],
    ["Approved secure tunnel", env.safeguards.approvedTunnel],
    ["Transmission flag enabled", env.safeguards.transmissionFlagEnabled]
  ];
  const list = el("div", { style: "margin-top:12px;display:flex;flex-direction:column;gap:6px" });
  safeguards.forEach(([label, ok]) => {
    list.appendChild(
      el("div", { style: "display:flex;align-items:center;gap:9px;font-size:var(--fs-sm)" }, [
        el("span", { class: "status-led " + (ok ? "ok" : "bad"), style: "width:9px;height:9px" }),
        el("span", { text: label })
      ])
    );
  });
  wrap.appendChild(list);

  if (env.reasons.length) {
    wrap.appendChild(el("div", { class: "drawer-section-title", text: "Why transmission is blocked" }));
    env.reasons.forEach((reason) => wrap.appendChild(el("div", { class: "status-sub", text: "• " + reason })));
  }
  return wrap;
}

/* ---------- Toasts ---------- */
function toast(message) {
  const container = document.getElementById("toasts");
  if (!container) return;
  const node = el("div", { class: "toast", text: message });
  container.appendChild(node);
  setTimeout(() => {
    node.style.transition = "opacity .3s";
    node.style.opacity = "0";
    setTimeout(() => node.remove(), 320);
  }, 2400);
}

/* ---------- Favorites ---------- */
function toggleFavorite(name) {
  if (favorites.has(name)) {
    favorites.delete(name);
    toast(`Unpinned ${name}`);
  } else {
    favorites.add(name);
    toast(`Pinned ${name}`);
  }
  saveJSON(STORE.fav, [...favorites]);
  updateFavBadge();
  updateCardStar(name);
}

function updateFavBadge() {
  const badge = document.getElementById("fav-badge");
  if (!badge) return;
  badge.textContent = String(favorites.size);
  badge.style.display = favorites.size ? "" : "none";
}

function updateCardStar(name) {
  document.querySelectorAll(`.module-card[data-name="${CSS.escape(name)}"] .star-btn`).forEach((btn) => {
    const on = favorites.has(name);
    btn.classList.toggle("on", on);
    btn.textContent = on ? "★" : "☆";
  });
}

/* ---------- Detail drawer ---------- */
function openDrawer(name) {
  const module = state.allModules.find((m) => m.name === name);
  if (!module) {
    toast(`No module named ${name}`);
    return;
  }
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawer-overlay");
  const isFav = favorites.has(name);
  drawer.innerHTML = "";

  drawer.appendChild(
    el("div", { class: "drawer-head" }, [
      el("div", {}, [el("h2", { class: "drawer-title", text: name }), el("span", { class: "drawer-cat", text: module.category })]),
      el("button", { class: "icon-btn", text: "✕", onclick: closeDrawer })
    ])
  );

  const body = el("div", { class: "drawer-body" });
  body.appendChild(
    el("div", { class: "drawer-actions" }, [
      el("button", {
        class: "mini-btn gold",
        text: isFav ? "★ Pinned" : "☆ Pin",
        onclick: () => {
          toggleFavorite(name);
          openDrawer(name);
        }
      }),
      el("button", { class: "mini-btn", text: "Copy JSON", onclick: () => copyText(JSON.stringify(module, null, 2), "Module JSON copied") }),
      el("button", { class: "mini-btn", text: "Show in graph", onclick: () => { closeDrawer(); setView("graph"); } })
    ])
  );

  body.appendChild(el("div", { class: "drawer-section-title", text: "Summary" }));
  body.appendChild(el("p", { class: "rec-body", text: module.summary ?? "" }));

  if (module.tags?.length) {
    body.appendChild(el("div", { class: "drawer-section-title", text: "Tags" }));
    const tg = el("div", { class: "module-tags" });
    module.tags.forEach((t) => tg.appendChild(el("span", { class: "tag", text: t })));
    body.appendChild(tg);
  }

  const deps = module.detail?.dependencies;
  if (deps?.length) {
    body.appendChild(el("div", { class: "drawer-section-title", text: "Dependencies" }));
    const wrap = el("div");
    deps.forEach((d) => wrap.appendChild(el("span", { class: "rel-chip", text: d, onclick: () => openDrawer(d) })));
    body.appendChild(wrap);
  }

  body.appendChild(el("div", { class: "drawer-section-title", text: "Detail" }));
  body.appendChild(el("pre", { class: "drawer-pre", text: JSON.stringify(module.detail ?? {}, null, 2) }));

  drawer.appendChild(body);
  drawer.hidden = false;
  overlay.hidden = false;
}

function closeDrawer() {
  document.getElementById("drawer").hidden = true;
  document.getElementById("drawer-overlay").hidden = true;
}

function copyText(text, message) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(message)).catch(() => toast("Copy failed"));
  } else {
    toast("Clipboard unavailable");
  }
}

/* ---------- System Status ---------- */
function renderStatus(view) {
  const envWrap = el("div", { id: "env-panel-wrap", style: "margin-bottom:20px" });
  view.appendChild(envWrap);
  ensureEnvironment().then(() => {
    if (state.environment) {
      envWrap.innerHTML = "";
      envWrap.appendChild(envPanelContent(state.environment));
      animateReveal(envWrap);
    }
  });

  view.appendChild(
    el("div", { class: "status-refresh" }, [
      el("button", { class: "mini-btn", text: "Refresh now", onclick: refreshStatus }),
      el("span", { id: "status-updated", text: "Checking…" })
    ])
  );
  view.appendChild(el("div", { class: "status-banner", id: "status-banner", text: "Checking services…" }));
  view.appendChild(el("div", { class: "status-grid", id: "status-grid" }));
  refreshStatus();
  if (statusTimer) clearInterval(statusTimer);
  statusTimer = setInterval(refreshStatus, prefs.statusMs);
}

async function refreshStatus() {
  const grid = document.getElementById("status-grid");
  const banner = document.getElementById("status-banner");
  if (!grid || !banner) return;
  let data;
  try {
    data = await getJSON("/api/status");
  } catch (error) {
    banner.className = "status-banner down";
    banner.textContent = `Status unavailable: ${error.message}`;
    return;
  }
  const up = data.services.filter((s) => s.ok).length;
  banner.className = "status-banner " + (data.healthy ? "up" : "down");
  banner.textContent = data.healthy
    ? `✓ All ${data.services.length} services healthy`
    : `${up}/${data.services.length} services healthy`;
  const updated = document.getElementById("status-updated");
  if (updated) updated.textContent = "Updated " + new Date(data.checkedAt).toLocaleTimeString();

  grid.innerHTML = "";
  data.services.forEach((s) => {
    grid.appendChild(
      el("div", { class: "status-card" }, [
        el("span", { class: "status-led " + (s.ok ? "ok" : "bad") }),
        el("div", { class: "status-meta" }, [
          el("div", { class: "status-name", text: s.name }),
          el("div", { class: "status-sub", text: `:${s.port} · ${s.status}` })
        ]),
        el("span", { class: "status-latency", text: `${s.latencyMs}ms` })
      ])
    );
  });
}

/* ---------- Export ---------- */
function exportCatalog() {
  const data = JSON.stringify({ summary: state.summary, categories: state.catalog }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", { href: url, download: "rtpsc-modules.json" });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast("Catalog exported (rtpsc-modules.json)");
}

/* ---------- Preferences & theme ---------- */
function applyPrefs() {
  const root = document.documentElement;
  if (prefs.theme === "midnight") root.setAttribute("data-theme", "midnight");
  else root.removeAttribute("data-theme");
  root.setAttribute("data-motion", prefs.motion === "off" ? "off" : "on");
}

function setTheme(theme) {
  prefs.theme = theme;
  saveJSON(STORE.prefs, prefs);
  applyPrefs();
}

function toggleTheme() {
  setTheme(prefs.theme === "midnight" ? "cream" : "midnight");
  toast(`Theme: ${prefs.theme === "midnight" ? "Midnight" : "Cream"}`);
}

/* ---------- Modals (settings / shortcuts) ---------- */
function showModal(id) {
  document.getElementById(id).hidden = false;
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

function openShortcuts() {
  showModal("shortcuts-modal");
}

function segControl(options, current, onPick) {
  const seg = el("div", { class: "seg" });
  options.forEach((opt) => {
    const [label, value] = Array.isArray(opt) ? opt : [opt, opt];
    seg.appendChild(el("button", { class: value === current ? "on" : "", text: label, onclick: () => onPick(value) }));
  });
  return seg;
}

function settingRow(label, desc, control) {
  return el("div", { class: "setting-row" }, [
    el("div", {}, [el("div", { class: "setting-label", text: label }), el("div", { class: "setting-desc", text: desc })]),
    control
  ]);
}

function openSettings() {
  const body = document.getElementById("settings-body");
  body.innerHTML = "";
  body.appendChild(
    settingRow(
      "Theme",
      "Cream or Midnight canvas",
      segControl([["Cream", "cream"], ["Midnight", "midnight"]], prefs.theme, (v) => {
        setTheme(v);
        openSettings();
      })
    )
  );
  body.appendChild(
    settingRow(
      "Motion",
      "Enable UI animations",
      segControl([["On", "on"], ["Off", "off"]], prefs.motion, (v) => {
        prefs.motion = v;
        saveJSON(STORE.prefs, prefs);
        applyPrefs();
        openSettings();
      })
    )
  );
  body.appendChild(
    settingRow(
      "Status refresh",
      "Auto-refresh interval",
      segControl([["3s", 3000], ["5s", 5000], ["10s", 10000]], prefs.statusMs, (v) => {
        prefs.statusMs = v;
        saveJSON(STORE.prefs, prefs);
        if (state.view === "status") render();
        openSettings();
      })
    )
  );
  showModal("settings-modal");
}

/* ---------- Global keyboard shortcuts ---------- */
function onGlobalKey(event) {
  if (event.key === "Escape") {
    closeDrawer();
    closeModal("settings-modal");
    closeModal("shortcuts-modal");
    return;
  }
  const tag = (event.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === "?") {
    openShortcuts();
  } else if (event.key.toLowerCase() === "t") {
    toggleTheme();
  } else if (event.key.toLowerCase() === "g") {
    navKeyArmed = true;
    setTimeout(() => {
      navKeyArmed = false;
    }, 1200);
  } else if (navKeyArmed) {
    const map = { c: "catalog", i: "insights", a: "assistant", d: "graph", s: "status", y: "design" };
    const target = map[event.key.toLowerCase()];
    if (target) setView(target);
    navKeyArmed = false;
  }
}

/* ---------- Feature wiring ---------- */
function initFeatures() {
  document.getElementById("btn-export").addEventListener("click", exportCatalog);
  document.getElementById("btn-settings").addEventListener("click", openSettings);
  document.getElementById("btn-shortcuts").addEventListener("click", openShortcuts);
  document.getElementById("drawer-overlay").addEventListener("click", closeDrawer);
  document.querySelectorAll("[data-close-modal]").forEach((btn) =>
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal))
  );
  document.querySelectorAll(".modal-overlay").forEach((overlay) =>
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.hidden = true;
    })
  );

  const catNav = document.querySelector('.nav-item[data-view="catalog"]');
  if (catNav) catNav.appendChild(el("span", { class: "nav-badge", id: "fav-badge" }));
  updateFavBadge();

  document.addEventListener("keydown", onGlobalKey);
}

boot();
