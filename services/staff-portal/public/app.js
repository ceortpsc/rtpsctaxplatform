const STATUS_LABELS = {
  ready: '',
  limited: 'Limited',
  beta: 'Beta',
  blocked_dependency: 'Blocked',
  blocked_credentials: 'Config required',
  blocked_external: 'External'
};

function renderNav(sections) {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  nav.innerHTML = sections
    .map(
      (section) => `
    <div class="rtp-nav-section">
      <div class="rtp-nav-section__label">${section.label}</div>
      ${section.items
        .map((item) => {
          const badge = STATUS_LABELS[item.status];
          const disabled = !item.href;
          const cls = disabled ? 'rtp-nav-item rtp-nav-item--disabled' : 'rtp-nav-item';
          const tag = item.href ? 'a' : 'span';
          const href = item.href ? ` href="${item.href}"` : '';
          const target = item.href?.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
          return `<${tag} class="${cls}"${href}${target}>
            <span class="rtp-nav-item__ico nav-ico">•</span>
            <span>${item.label}</span>
            ${badge ? `<span class="rtp-nav-item__badge">${badge}</span>` : ''}
          </${tag}>`;
        })
        .join('')}
    </div>`
    )
    .join('');
}

function renderDashboard(data) {
  const grid = document.getElementById('dashboard-grid');
  if (!grid) return;
  grid.innerHTML = data.widgets
    .map(
      (w) => `
    <article class="metric-card">
      <div class="metric-label">${w.label}</div>
      <div class="metric-value">${w.value}</div>
      <span class="rtp-status rtp-status--${w.status === 'ready' ? 'active' : w.status.startsWith('blocked') ? 'blocked' : 'limited'}">${w.status.replace(/_/g, ' ')}</span>
      ${w.href ? `<a class="metric-link" href="${w.href}">Open module →</a>` : ''}
    </article>`
    )
    .join('');
}

async function init() {
  try {
    const [navRes, dashRes] = await Promise.all([
      fetch('/api/navigation?role=tax_preparer'),
      fetch('/api/dashboard')
    ]);
    const nav = await navRes.json();
    const dash = await dashRes.json();
    renderNav(nav.sections);
    renderDashboard(dash);
  } catch (err) {
    window.rtpShell?.showToast?.('Unable to load dashboard data.', { type: 'error' });
  }

  const envLabel = document.getElementById('env-label');
  if (envLabel) envLabel.textContent = (location.hostname === 'localhost' ? 'LOCAL' : 'DEV').toUpperCase();
}

document.addEventListener('DOMContentLoaded', init);
