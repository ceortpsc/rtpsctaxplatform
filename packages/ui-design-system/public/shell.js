/**
 * RTPSC Application Shell — theme, sidebar, mobile nav, toasts.
 * Include after page scripts: <script src="/rtp-design/shell.js" defer></script>
 */
(function () {
  const STORAGE_THEME = 'rtp.theme';
  const STORAGE_SIDEBAR = 'rtp.sidebar.collapsed';

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

  function getTheme() {
    return localStorage.getItem(STORAGE_THEME) || 'light';
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark' || theme === 'midnight') {
      root.setAttribute('data-theme', 'midnight');
    } else {
      root.removeAttribute('data-theme');
    }
    localStorage.setItem(STORAGE_THEME, theme);
    const btn = $('#rtp-theme-toggle');
    if (btn) btn.setAttribute('aria-pressed', theme === 'midnight' ? 'true' : 'false');
  }

  function toggleTheme() {
    applyTheme(getTheme() === 'midnight' ? 'light' : 'midnight');
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

    toggle.addEventListener('click', () => {
      sidebar.classList.contains('open') ? close() : open();
    });
    overlay?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
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

  window.rtpShell = { showToast, applyTheme, toggleTheme, getTheme };

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getTheme());
    initMobileNav();
    initSidebarCollapse();
    const themeBtn = $('#rtp-theme-toggle');
    themeBtn?.addEventListener('click', toggleTheme);

    // Wire legacy toast callers
    if (!window.showToast) window.showToast = showToast;
  });
})();
