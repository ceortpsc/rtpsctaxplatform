/**
 * RTPSC Application Shell — theme, density, contrast, motion, sidebar, mobile nav, and toasts.
 * Include after page scripts: <script src="/rtp-design/shell.js" defer></script>
 */
(function () {
  const STORAGE_THEME = 'rtp.theme';
  const STORAGE_SIDEBAR = 'rtp.sidebar.collapsed';
  const STORAGE_DENSITY = 'rtp.cosmetics.density';
  const STORAGE_CONTRAST = 'rtp.cosmetics.contrast';
  const STORAGE_MOTION = 'rtp.cosmetics.motion';

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

  function getTheme() {
    return localStorage.getItem(STORAGE_THEME) || 'light';
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark' || theme === 'midnight') root.setAttribute('data-theme', 'midnight');
    else root.removeAttribute('data-theme');
    localStorage.setItem(STORAGE_THEME, theme);
    const btn = $('#rtp-theme-toggle');
    if (btn) btn.setAttribute('aria-pressed', theme === 'midnight' ? 'true' : 'false');
  }

  function toggleTheme() {
    applyTheme(getTheme() === 'midnight' ? 'light' : 'midnight');
  }

  function normalizeChoice(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function applyDensity(value) {
    const density = normalizeChoice(value, ['compact', 'standard', 'comfortable'], 'standard');
    if (density === 'standard') document.documentElement.removeAttribute('data-density');
    else document.documentElement.setAttribute('data-density', density);
    localStorage.setItem(STORAGE_DENSITY, density);
    $$('[data-rtp-density]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.rtpDensity === density)));
    return density;
  }

  function applyContrast(value) {
    const contrast = normalizeChoice(value, ['standard', 'high'], 'standard');
    if (contrast === 'high') document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
    localStorage.setItem(STORAGE_CONTRAST, contrast);
    $$('[data-rtp-contrast]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.rtpContrast === contrast)));
    return contrast;
  }

  function applyMotion(value) {
    const motion = normalizeChoice(value, ['system', 'on', 'off'], 'system');
    if (motion === 'off') document.documentElement.setAttribute('data-motion', 'off');
    else document.documentElement.removeAttribute('data-motion');
    localStorage.setItem(STORAGE_MOTION, motion);
    $$('[data-rtp-motion]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.rtpMotion === motion)));
    return motion;
  }

  function initCosmeticPreferences() {
    applyDensity(localStorage.getItem(STORAGE_DENSITY) || 'standard');
    applyContrast(localStorage.getItem(STORAGE_CONTRAST) || 'standard');
    applyMotion(localStorage.getItem(STORAGE_MOTION) || 'system');
    $$('[data-rtp-density]').forEach((el) => el.addEventListener('click', () => applyDensity(el.dataset.rtpDensity)));
    $$('[data-rtp-contrast]').forEach((el) => el.addEventListener('click', () => applyContrast(el.dataset.rtpContrast)));
    $$('[data-rtp-motion]').forEach((el) => el.addEventListener('click', () => applyMotion(el.dataset.rtpMotion)));
  }

  function initReveal() {
    const items = $$('[data-rtp-reveal]');
    if (!items.length) return;
    document.documentElement.setAttribute('data-cosmetics-ready', 'true');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach((item) => observer.observe(item));
  }

  function initMobileNav() {
    const sidebar = $('.rtp-sidebar, .sidebar');
    const toggle = $('#rtp-mobile-toggle');
    const overlay = $('#rtp-mobile-overlay');
    if (!sidebar || !toggle) return;

    function close() {
      sidebar.classList.remove('open');
      overlay?.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    function open() {
      sidebar.classList.add('open');
      overlay?.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    toggle.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
    overlay?.addEventListener('click', close);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  }

  function initSidebarCollapse() {
    const app = $('.rtp-app, .app');
    const btn = $('#rtp-sidebar-collapse');
    if (!app || !btn) return;
    const collapsed = localStorage.getItem(STORAGE_SIDEBAR) === '1';
    if (collapsed) app.classList.add('rtp-app--collapsed');
    btn.addEventListener('click', () => {
      app.classList.toggle('rtp-app--collapsed');
      localStorage.setItem(STORAGE_SIDEBAR, app.classList.contains('rtp-app--collapsed') ? '1' : '0');
    });
  }

  function showToast(message, { type = 'info', duration = 4200 } = {}) {
    let el = $('.rtp-toast, .toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'rtp-toast';
      el.id = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `rtp-toast show${type === 'error' ? ' rtp-toast--error err' : type === 'success' ? ' rtp-toast--success' : ''}`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  window.rtpShell = {
    showToast,
    applyTheme,
    toggleTheme,
    getTheme,
    applyDensity,
    applyContrast,
    applyMotion
  };

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getTheme());
    initCosmeticPreferences();
    initMobileNav();
    initSidebarCollapse();
    initReveal();
    $('#rtp-theme-toggle')?.addEventListener('click', toggleTheme);
    if (!window.showToast) window.showToast = showToast;
  });
})();
