(() => {
  const state = { products: [], open: false };
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

  function filtered(query = '') {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return state.products;
    return state.products.filter((product) => {
      const haystack = [product.name, product.category, product.status, ...(product.features || [])].join(' ').toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }

  function renderResults(container, query = '') {
    const products = filtered(query);
    container.innerHTML = products.length ? products.map((product) => `
      <a class="rtp-command-item" href="${esc(product.href)}" data-product-id="${esc(product.id)}">
        <span><span class="rtp-command-name">${esc(product.name)}</span><br><span class="rtp-command-meta">${esc(product.category)} · ${(product.features || []).slice(0,3).map(esc).join(' · ')}</span></span>
        <span class="rtp-status-chip">${esc(product.status)}</span>
      </a>`).join('') : '<p class="rtp-command-meta">No matching products or tools.</p>';
  }

  function close(overlay) {
    state.open = false;
    overlay.dataset.open = 'false';
    overlay.setAttribute('aria-hidden', 'true');
  }

  function open(overlay, input) {
    state.open = true;
    overlay.dataset.open = 'true';
    overlay.setAttribute('aria-hidden', 'false');
    queueMicrotask(() => input.focus());
  }

  function mount(options = {}) {
    if (document.querySelector('[data-rtp-product-tools]')) return;
    state.products = Array.isArray(options.products) ? options.products : (window.RTPSC_PRODUCTS || []);
    const root = document.createElement('div');
    root.dataset.rtpProductTools = 'true';
    root.innerHTML = `
      <div class="rtp-product-launcher"><button type="button" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">⌘ Products</button></div>
      <div class="rtp-command-overlay" data-open="false" aria-hidden="true">
        <section class="rtp-command-panel" role="dialog" aria-modal="true" aria-label="RTPSC product and tool navigation">
          <div class="rtp-command-head"><input type="search" placeholder="Search products, tools, workflows…" aria-label="Search products and tools"></div>
          <div class="rtp-command-results"></div>
        </section>
      </div>`;
    document.body.appendChild(root);
    const button = root.querySelector('button');
    const overlay = root.querySelector('.rtp-command-overlay');
    const input = root.querySelector('input');
    const results = root.querySelector('.rtp-command-results');
    renderResults(results);
    button.addEventListener('click', () => open(overlay, input));
    input.addEventListener('input', () => renderResults(results, input.value));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(overlay); });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); state.open ? close(overlay) : open(overlay, input); }
      if (event.key === 'Escape' && state.open) close(overlay);
    });
  }

  function renderGrid(container, products = state.products) {
    container.classList.add('rtp-product-grid');
    container.innerHTML = products.map((product) => `<article class="rtp-product-card"><p class="rtp-command-meta">${esc(product.category)} · ${esc(product.status)}</p><h3><a href="${esc(product.href)}">${esc(product.name)}</a></h3><div class="rtp-product-features">${(product.features || []).map((feature) => `<span>${esc(feature)}</span>`).join('')}</div></article>`).join('');
  }

  window.rtpProductTools = Object.freeze({ mount, renderGrid, search: filtered });
})();
