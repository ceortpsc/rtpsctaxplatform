const state = {
  catalog: [],
  summary: { totalModules: 0, categories: [] },
  allModules: [],
  view: "catalog",
  catalogFilter: "all",
  catalogSearch: "",
  thread: [],
  palette: { open: false, results: [], active: 0 }
};

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
  try {
    const data = await getJSON("/api/modules");
    state.catalog = data.categories;
    state.summary = data.summary;
    state.allModules = data.categories.flatMap((group) =>
      group.modules.map((module) => ({ ...module, category: group.category }))
    );
    document.getElementById("stat-modules").textContent = data.summary.totalModules;
    document.getElementById("stat-categories").textContent = data.summary.categories.length;
  } catch (error) {
    document.getElementById("view").innerHTML = `<p class="empty">Failed to load: ${error.message}</p>`;
    return;
  }
  wireNav();
  wirePalette();
  render();
}

function wireNav() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.getElementById("view-title").textContent = {
    catalog: "Catalog",
    insights: "Insights",
    assistant: "AI Assistant",
    graph: "Dependency Graph"
  }[view];
  render();
}

function render() {
  const view = document.getElementById("view");
  view.innerHTML = "";
  if (state.view === "catalog") view.appendChild(renderCatalog());
  else if (state.view === "insights") renderInsights(view);
  else if (state.view === "assistant") view.appendChild(renderAssistant());
  else if (state.view === "graph") renderGraph(view);
}

/* ---------- Catalog ---------- */
function moduleCard(module) {
  const card = el("article", { class: "module-card", "data-name": module.name });
  card.appendChild(el("h3", { class: "module-name", text: module.name }));
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
  ["all", ...state.catalog.map((g) => g.category)].forEach((option) => {
    filters.appendChild(
      el("button", {
        class: "filter-btn" + (option === state.catalogFilter ? " active" : ""),
        text: option,
        onclick: () => {
          state.catalogFilter = option;
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
    b.classList.toggle("active", b.textContent === state.catalogFilter);
  });
  body.innerHTML = "";
  const term = state.catalogSearch;
  const groups = state.catalog.filter((g) => state.catalogFilter === "all" || g.category === state.catalogFilter);
  let shown = 0;
  for (const group of groups) {
    const modules = group.modules.filter((m) => {
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
        el("div", { class: "bar-track" }, [
          el("div", { class: "bar-fill", style: `width:${(count / maxTrigger) * 100}%` })
        ]),
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
        el("div", { class: "bar-track" }, [el("div", { class: "bar-fill", style: `width:${(count / maxCat) * 100}%` })]),
        el("span", { class: "bar-value", text: String(count) })
      ])
    );
  }
  grid.appendChild(catCard);
  view.appendChild(grid);

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
  packages: "#7c5cff",
  services: "#4c8dff",
  workers: "#3fb950",
  pipelines: "#d29922",
  engines: "#f778ba",
  workflows: "#56d4dd",
  external: "#8b98a9"
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
        openModule(pick.name);
      }
    }
  });
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
  const query = term.toLowerCase();
  const results = state.allModules
    .filter((m) => {
      if (!query) return true;
      return (
        m.name.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query) ||
        (m.tags ?? []).join(" ").toLowerCase().includes(query)
      );
    })
    .slice(0, 12);
  state.palette.results = results;
  state.palette.active = 0;
  drawPalette();
}

function drawPalette() {
  const list = document.getElementById("palette-results");
  list.innerHTML = "";
  state.palette.results.forEach((module, index) => {
    list.appendChild(
      el("li", {
        class: "palette-item" + (index === state.palette.active ? " active" : ""),
        onclick: () => {
          closePalette();
          openModule(module.name);
        }
      }, [
        el("span", { class: "pi-name", text: module.name }),
        el("span", { class: "pi-cat", text: module.category })
      ])
    );
  });
  if (state.palette.results.length === 0) {
    list.appendChild(el("li", { class: "palette-item", text: "No modules found" }));
  }
}

boot();
