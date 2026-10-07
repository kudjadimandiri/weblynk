/* ============================================
   WebLynk Main JS — Frontend Index
   ============================================ */

(function () {
  'use strict';

  // ---------- UTILS ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function formatDate(d) {
    try {
      return new Date(d).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return d;
    }
  }

  async function loadJSON(path) {
    try {
      const r = await fetch(`${path}?t=${Date.now()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn('[WebLynk] Gagal memuat', path, e);
      return null;
    }
  }

  // ---------- STATE ----------
  const state = {
    posts: [],
    tools: [],
    games: [],
    config: {},
    filters: { q: '', category: '' },
  };

  // ---------- SEO: Update Meta Tags ----------
  function applySEO(cfg) {
    if (!cfg) return;
    const setMeta = (id, val, attr = 'content') => {
      const el = document.getElementById(id);
      if (el && val) el.setAttribute(attr, val);
    };

    document.title = `${cfg.siteName || 'WebLynk'} — Blog SEO 2026, Backlink High DA/DR, Tools & Game`;
    setMeta('metaDescription', cfg.siteDescription);
    setMeta('metaKeywords', cfg.siteKeywords);
    setMeta('ogTitle', `${cfg.siteName} — Blog SEO 2026`);
    setMeta('ogDescription', cfg.siteDescription);
    setMeta('ogImage', cfg.ogImage);
    setMeta('ogUrl', `${cfg.siteUrl}/`);
    setMeta('canonicalUrl', `${cfg.siteUrl}/`, 'href');
    setMeta('twHandle', cfg.twitterHandle);

    // Schema.org WebSite
    const sd = document.getElementById('structuredData');
    if (sd) {
      sd.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: cfg.siteName,
        url: cfg.siteUrl,
        description: cfg.siteDescription,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${cfg.siteUrl}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      });
    }
  }

  // ---------- RENDER ----------
  function postCard(p) {
    const url = `/artikel/${encodeURIComponent(p.slug)}.html`;
    const img = p.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800';
    return `
      <article class="card-hover group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <a href="${url}" class="block">
          <div class="aspect-video overflow-hidden bg-slate-100">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" loading="lazy"
              class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          </div>
          <div class="p-5">
            <span class="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">${escapeHtml(p.category || 'Umum')}</span>
            <h3 class="mt-3 line-clamp-2 font-bold text-slate-900 transition group-hover:text-brand-600">${escapeHtml(p.title)}</h3>
            <p class="mt-2 line-clamp-2 text-sm text-slate-600">${escapeHtml(p.excerpt || '')}</p>
            <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>📅 ${formatDate(p.date)}</span>
              <span>⏱ ${Math.max(1, Math.ceil((p.content || '').replace(/<[^>]+>/g, '').length / 1000))} menit</span>
            </div>
          </div>
        </a>
      </article>`;
  }

  function itemCard(item) {
    return `
      <a href="${escapeHtml(item.url)}"
        class="card-hover group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-300">
        <div class="mb-3 text-4xl">${item.icon || '🛠️'}</div>
        <h3 class="font-bold text-slate-900 transition group-hover:text-brand-600">${escapeHtml(item.name)}</h3>
        <p class="mt-1 line-clamp-2 text-sm text-slate-600">${escapeHtml(item.description || '')}</p>
        <span class="mt-3 inline-block self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">${escapeHtml(item.category || '')}</span>
      </a>`;
  }

  function emptyState(msg) {
    return `<p class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-500">${msg}</p>`;
  }

  function applyFilters() {
    const { q, category } = state.filters;

    const match = (item) => {
      const hay = (
        (item.title || item.name || '') + ' ' +
        (item.excerpt || item.description || '') + ' ' +
        (item.category || '')
      ).toLowerCase();
      const okQ = !q || hay.includes(q);
      const okC = !category || (item.category || '').toLowerCase() === category.toLowerCase();
      return okQ && okC;
    };

    const posts = state.posts.filter(match);
    const tools = state.tools.filter(match);
    const games = state.games.filter(match);

    const pGrid = $('#postsGrid');
    const tGrid = $('#toolsGrid');
    const gGrid = $('#gamesGrid');

    if (pGrid) pGrid.innerHTML = posts.length ? posts.map(postCard).join('') : emptyState('Tidak ada artikel yang cocok.');
    if (tGrid) tGrid.innerHTML = tools.length ? tools.map(itemCard).join('') : emptyState('Tidak ada tools yang cocok.');
    if (gGrid) gGrid.innerHTML = games.length ? games.map(itemCard).join('') : emptyState('Tidak ada games yang cocok.');

    // Update counter
    const counter = $('#resultCount');
    if (counter) counter.textContent = posts.length + tools.length + games.length;
  }

  // ---------- INIT ----------
  async function init() {
    // 1. Load config
    const cfg = await loadJSON('/content/config.json');
    if (cfg) {
      state.config = cfg;
      applySEO(cfg);
    }

    // 2. Load posts
    const postData = await loadJSON('/content/posts.json');
    state.posts = (postData?.posts || []).sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. Load tools & games
    const toolData = await loadJSON('/content/tools.json');
    const all = toolData?.tools || [];
    state.tools = all.filter((t) => t.type === 'tool');
    state.games = all.filter((t) => t.type === 'game');

    applyFilters();

    // 4. Lazy load images
    if ('loading' in HTMLImageElement.prototype) {
      $$('img[loading="lazy"]').forEach((img) => img.setAttribute('decoding', 'async'));
    }

    // 5. Console info
    console.log(
      `%c🌐 WebLynk loaded — ${state.posts.length} posts, ${state.tools.length} tools, ${state.games.length} games`,
      'color:#0284c7;font-weight:bold;padding:4px 8px;background:#f0f9ff;border-radius:6px;'
    );
  }

  // ---------- EVENT LISTENERS ----------
  function bindEvents() {
    // Mobile menu
    const menuBtn = $('#menuBtn');
    const mobileNav = $('#mobileNav');
    menuBtn?.addEventListener('click', () => mobileNav?.classList.toggle('hidden'));
    mobileNav?.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => mobileNav.classList.add('hidden'))
    );

    // Search
    const search = $('#searchInput');
    let debounce;
    search?.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.filters.q = e.target.value.toLowerCase().trim();
        applyFilters();
      }, 200);
    });

    // Category filter
    $('#categoryFilter')?.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      applyFilters();
    });

    // Back to top button
    const backTop = $('#backToTop');
    if (backTop) {
      window.addEventListener('scroll', () => {
        backTop.classList.toggle('opacity-0', window.scrollY < 400);
        backTop.classList.toggle('pointer-events-none', window.scrollY < 400);
      });
      backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  }

  // ---------- BOOT ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindEvents();
      init();
    });
  } else {
    bindEvents();
    init();
  }

     // Expose helper ke global untuk dipakai halaman lain
  window.showToast = toast;
  window.WebLynkUtils = { escapeHtml, formatDate, readTime };
})();
