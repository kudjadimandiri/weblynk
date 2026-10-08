/* ============================================
   WebLynk Shared — Navbar (minimal) & Footer (lengkap)
   ============================================ */

(function () {
  'use strict';

  const SHARED_KEY = 'weblynk_shared_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function getCache() {
    try {
      const c = JSON.parse(sessionStorage.getItem(SHARED_KEY) || '{}');
      if (c.ts && Date.now() - c.ts < CACHE_TTL) return c;
    } catch {}
    return null;
  }

  function setCache(data) {
    try {
      sessionStorage.setItem(SHARED_KEY, JSON.stringify({ ...data, ts: Date.now() }));
    } catch {}
  }

  async function loadShared() {
    const cached = getCache();
    if (cached) return cached;

    const [cfgRes, pagesRes] = await Promise.all([
      fetch('/content/config.json?t=' + Date.now()).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/content/pages.json?t=' + Date.now()).then(r => r.ok ? r.json() : { pages: [] }).catch(() => ({ pages: [] })),
    ]);

    const data = {
      config: cfgRes || {},
      pages: (pagesRes.pages || [])
        .filter(p => p.showInNav !== false)
        .sort((a, b) => (a.navOrder || 99) - (b.navOrder || 99)),
    };
    setCache(data);
    return data;
  }

  function getActivePage() {
    const path = location.pathname;
    const params = new URLSearchParams(location.search);

    if (path.includes('/pages/')) return { type: 'page', slug: params.get('slug') };
    if (path.includes('/artikel/') || path.includes('/artikel')) return { type: 'artikel' };
    if (path.includes('/tools/') || path.includes('/tools')) return { type: 'tools' };
    if (path.includes('/games/') || path.includes('/games')) return { type: 'games' };
    if (path === '/' || path.endsWith('/index.html')) return { type: 'home' };
    return { type: 'other' };
  }

  // ============================================
  // NAVBAR — HANYA Artikel, Tools, Games
  // ============================================
  function renderNavbar(pages, active) {
    const desktopNav = $('#navLinks');
    const mobileNav = $('#mobileNavLinks');

    // Hanya 3 link ini yang muncul di navbar
    const mainLinks = [
      { label: 'Artikel', href: '/#artikel', type: 'artikel' },
      { label: 'Tools', href: '/#tools', type: 'tools' },
      { label: 'Games', href: '/#games', type: 'games' },
    ];

    // Desktop navbar
    if (desktopNav) {
      desktopNav.innerHTML = mainLinks.map(l => {
        const isActive = active.type === l.type;
        return `<a href="${l.href}" class="transition ${isActive ? 'text-brand-600 font-semibold' : 'hover:text-brand-600'}">${l.label}</a>`;
      }).join('');
    }

    // Mobile navbar (sama, hanya 3 link)
    if (mobileNav) {
      mobileNav.innerHTML = mainLinks.map(l => {
        const isActive = active.type === l.type;
        return `<a href="${l.href}" class="block py-2 text-sm font-medium ${isActive ? 'text-brand-600' : 'text-slate-700 hover:text-brand-600'}">${l.label}</a>`;
      }).join('');
    }
  }

  // ============================================
  // FOOTER — Tetap Lengkap (Konten + Informasi + Kontak)
  // ============================================
  function renderFooter(pages, cfg) {
    const pagesCol = $('#footerPagesLinks');
    if (pagesCol) {
      pagesCol.innerHTML = pages.map(p =>
        `<li><a href="/pages/?slug=${encodeURIComponent(p.slug)}" class="text-slate-600 hover:text-brand-600">${escapeHtml(p.title)}</a></li>`
      ).join('');
    }

    const contactInfo = $('#footerContact');
    if (contactInfo) {
      contactInfo.innerHTML = `
        <li class="text-slate-500">📧 hello@weblynk.pages.dev</li>
        <li class="text-slate-500">🐦 ${escapeHtml(cfg.twitterHandle || '@weblynk')}</li>
      `;
    }
  }

  async function init() {
    try {
      const { config, pages } = await loadShared();
      const active = getActivePage();

      renderNavbar(pages, active);
      renderFooter(pages, config);

      const menuBtn = $('#menuBtn');
      const mobileNavEl = $('#mobileNav');
      if (menuBtn && mobileNavEl) {
        menuBtn.addEventListener('click', () => mobileNavEl.classList.toggle('hidden'));
        mobileNavEl.querySelectorAll('a').forEach(a =>
          a.addEventListener('click', () => mobileNavEl.classList.add('hidden'))
        );
      }
    } catch (e) {
      console.error('Shared init failed:', e);
    }
  }

  window.WebLynkShared = { init, loadShared };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();