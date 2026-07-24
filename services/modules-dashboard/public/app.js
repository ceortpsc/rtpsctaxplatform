const els = {
  catalog: document.getElementById("catalog"),
  filters: document.getElementById("filters"),
  statModules: document.getElementById("stat-modules"),
  statCategories: document.getElementById("stat-categories")
};

let catalogData = [];
let activeFilter = "all";

async function loadCatalog() {
  try {
    const response = await fetch("/api/modules");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load modules");
    catalogData = data.categories;
    els.statModules.textContent = data.summary.totalModules;
    els.statCategories.textContent = data.summary.categories.length;
    renderFilters();
    renderCatalog();
  } catch (error) {
    els.catalog.innerHTML = `<p class="empty">Failed to load modules: ${error.message}</p>`;
  }
}

function renderFilters() {
  els.filters.innerHTML = "";
  const options = ["all", ...catalogData.map((group) => group.category)];
  for (const option of options) {
    const button = document.createElement("button");
    button.className = "filter-btn" + (option === activeFilter ? " active" : "");
    button.type = "button";
    button.textContent = option;
    button.addEventListener("click", () => {
      activeFilter = option;
      renderFilters();
      renderCatalog();
    });
    els.filters.appendChild(button);
  }
}

function renderCatalog() {
  const categoryTemplate = document.getElementById("category-template");
  const moduleTemplate = document.getElementById("module-template");
  els.catalog.innerHTML = "";

  const groups = catalogData.filter((group) => activeFilter === "all" || group.category === activeFilter);

  for (const group of groups) {
    const section = categoryTemplate.content.cloneNode(true);
    section.querySelector(".category").dataset.category = group.category;
    section.querySelector(".category-title").textContent = group.category;
    section.querySelector(".category-count").textContent = `${group.modules.length} modules`;
    section.querySelector(".category-desc").textContent = group.description;

    const grid = section.querySelector(".module-grid");
    for (const module of group.modules) {
      const card = moduleTemplate.content.cloneNode(true);
      card.querySelector(".module-name").textContent = module.name;
      card.querySelector(".module-summary").textContent = module.summary;

      const tags = card.querySelector(".module-tags");
      for (const tag of module.tags ?? []) {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = tag;
        tags.appendChild(span);
      }

      const detail = card.querySelector(".module-detail");
      detail.textContent = JSON.stringify(module.detail ?? {}, null, 2);

      const toggle = card.querySelector(".detail-toggle");
      const article = card.querySelector(".module-card");
      toggle.addEventListener("click", () => article.classList.toggle("open"));

      grid.appendChild(card);
    }

    els.catalog.appendChild(section);
  }
}

loadCatalog();
