/* ============================================
   WebLynk CMS — Logic Admin Panel
   Digunakan oleh /admin/index.html
   ============================================ */

(function () {
  'use strict';

  // ---------- CONSTANTS ----------
  const GH_KEY = 'weblynk_github';
  const CACHE_KEY = 'weblynk_cache';
  const API = 'https://api.github.com';

  // ---------- UTILS ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function toast(msg, type = 'info') {
    const colors = {
      info: 'bg-brand-600',
      success: 'bg-green-600',
      error: 'bg-red-600',
      warn: 'bg-amber-500',
    };
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };

    const el = document.createElement('div');
    el.className = `fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl ${colors[type]} px-5 py-3 text-sm font-medium text-white shadow-2xl transform translate-y-20 opacity-0 transition-all duration-300`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.remove('translate-y-20', 'opacity-0');
    });

    setTimeout(() => {
      el.classList.add('translate-y-20', 'opacity-0');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ---------- GITHUB STORAGE ----------
  function getGH() {
    try {
      return JSON.parse(localStorage.getItem(GH_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function setGH(cfg) {
    localStorage.setItem(GH_KEY, JSON.stringify(cfg));
  }

  function isConfigured() {
    const c = getGH();
    return Boolean(c.owner && c.repo && c.token);
  }

  async function ghGet(path) {
    const { owner, repo, branch = 'main' } = getGH();
    if (!owner || !repo) throw new Error('GitHub belum dikonfigurasi');
    const r = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) throw new Error(`Gagal ambil ${path}: HTTP ${r.status}`);
    return await r.json();
  }

  async function ghPut(path, content, message) {
    const { owner, repo, branch = 'main', token } = getGH();
    if (!owner || !repo || !token) throw new Error('GitHub token belum diisi');

    let sha;
    try {
      const existing = await ghGet(path);
      sha = existing.sha;
    } catch {
      // file baru
    }

    const body = {
      message: message || `Update ${path}`,
      content: btoa(unescape(encodeURIComponent(content))),
      branch,
      ...(sha ? { sha } : {}),
    };

    const r = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Gagal push ${path}: ${err.slice(0, 200)}`);
    }
    return await r.json();
  }

  // ---------- LOCAL CACHE ----------
  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        posts: state.posts,
        tools: state.tools,
        config: state.config,
        ts: Date.now(),
      }));
    } catch (e) {
      console.warn('Cache save failed', e);
    }
  }

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (c.posts) state.posts = c.posts;
      if (c.tools) state.tools = c.tools;
      if (c.config) state.config = c.config;
      return Boolean(c.posts || c.tools);
    } catch {
      return false;
    }
  }

  // ---------- STATE ----------
  const state = {
    posts: [],
    tools: [],
    config: {},
    editing: null,
    editingType: 'post',
  };

  // ---------- RENDER LISTS ----------
  function renderLists() {
    const row = (item, type) => {
      const icon = item.icon || (type === 'post' ? '📝' : type === 'tool' ? '🛠️' : '🎮');
      const title = item.title || item.name || '(tanpa judul)';
      const meta = [item.category, item.date].filter(Boolean).join(' · ');
      return `
        <div class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">${icon}</span>
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">${title}</p>
              <p class="truncate text-xs text-slate-500">${meta}</p>
            </div>
          </div>
          <div class="flex flex-shrink-0 gap-2">
            <button data-action="edit" data-type="${type}" data-id="${item.id}"
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">✏️ Edit</button>
            <button data-action="delete" data-type="${type}" data-id="${item.id}"
              class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">🗑️</button>
          </div>
        </div>`;
    };

    const posts = state.posts;
    const tools = state.tools.filter((t) => t.type === 'tool');
    const games = state.tools.filter((t) => t.type === 'game');

    $('#postsList').innerHTML = posts.length
      ? posts.map((p) => row(p, 'post')).join('')
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada artikel. Klik "+ Artikel Baru" untuk memulai.</p>';

    $('#toolsList').innerHTML = tools.length
      ? tools.map((t) => row(t, 'tool')).join('')
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada tools.</p>';

    $('#gamesList').innerHTML = games.length
      ? games.map((g) => row(g, 'game')).join('')
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada games.</p>';
  }

  // ---------- EDITOR ----------
  function openEditor(type, id) {
    state.editingType = type;
    const pool = type === 'post' ? state.posts : state.tools;
    state.editing = id ? pool.find((i) => i.id === id) : null;

    $('#editorTitle').textContent = (state.editing ? 'Edit ' : 'Baru ') +
      ({ post: 'Artikel', tool: 'Tool', game: 'Game' }[type]);

    $('#editorFields').innerHTML = buildFields(type, state.editing || {});
    $('#editorModal').classList.remove('hidden');
    $('#editorModal').classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeEditor() {
    $('#editorModal').classList.add('hidden');
    $('#editorModal').classList.remove('flex');
    document.body.style.overflow = '';
    state.editing = null;
  }

  function buildFields(type, data) {
    const common = `
      <div class="border-t border-slate-200 pt-4">
        <h4 class="mb-3 text-sm font-bold text-slate-700">🔍 SEO Meta</h4>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-sm font-medium">Meta Title</label>
            <input id="f_metaTitle" value="${data.metaTitle || ''}" maxlength="60"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            <p class="mt-1 text-xs text-slate-400">Maks 60 karakter untuk hasil terbaik di Google.</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Meta Description</label>
            <textarea id="f_metaDescription" rows="2" maxlength="160"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">${data.metaDescription || ''}</textarea>
            <p class="mt-1 text-xs text-slate-400">Maks 160 karakter.</p>
          </div>
        </div>
      </div>`;

    if (type === 'post') {
      return `
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="mb-1 block text-sm font-medium">Judul *</label>
            <input id="f_title" value="${data.title || ''}" required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Slug</label>
            <input id="f_slug" value="${data.slug || ''}" placeholder="otomatis-dari-judul"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Kategori</label>
            <input id="f_category" value="${data.category || 'SEO'}"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Tanggal</label>
            <input id="f_date" type="date" value="${data.date || new Date().toISOString().slice(0, 10)}"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Image URL</label>
            <input id="f_image" value="${data.image || ''}" placeholder="https://..."
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div class="sm:col-span-2">
            <label class="mb-1 block text-sm font-medium">Excerpt</label>
            <textarea id="f_excerpt" rows="2"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">${data.excerpt || ''}</textarea>
          </div>
          <div class="sm:col-span-2">
            <label class="mb-1 block text-sm font-medium">Konten (HTML)</label>
            <textarea id="f_content" rows="8"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none">${data.content || ''}</textarea>
          </div>
          <div class="sm:col-span-2">
            <label class="mb-1 block text-sm font-medium">Tags (pisahkan dengan koma)</label>
            <input id="f_tags" value="${(data.tags || []).join(', ')}"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
        </div>
        ${common}`;
    }

    return `
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-medium">Nama *</label>
          <input id="f_name" value="${data.name || ''}" required
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Icon (emoji)</label>
          <input id="f_icon" value="${data.icon || (type === 'tool' ? '🛠️' : '🎮')}"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Kategori</label>
          <input id="f_category" value="${data.category || (type === 'tool' ? 'SEO' : 'Game')}"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">URL / Path</label>
          <input id="f_url" value="${data.url || ''}" placeholder="/tools/nama-tool.html"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-sm font-medium">Deskripsi</label>
          <textarea id="f_description" rows="3"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">${data.description || ''}</textarea>
        </div>
      </div>
      ${common}`;
  }

  // ---------- SAVE ITEM ----------
  async function saveItem() {
    const val = (id) => $(id)?.value?.trim() ?? '';
    const type = state.editingType;

    if (!isConfigured()) {
      toast('Konfigurasi GitHub dulu di ⚙️ Pengaturan', 'warn');
      return;
    }

    let item;
    if (type === 'post') {
      const title = val('#f_title');
      if (!title) return toast('Judul wajib diisi', 'warn');

      item = {
        id: state.editing?.id || 'post-' + Date.now(),
        title,
        slug: val('#f_slug') || title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
        excerpt: val('#f_excerpt'),
        content: val('#f_content'),
        category: val('#f_category') || 'SEO',
        tags: val('#f_tags').split(',').map((s) => s.trim()).filter(Boolean),
        author: state.editing?.author || 'WebLynk Team',
        date: val('#f_date') || new Date().toISOString().slice(0, 10),
        image: val('#f_image'),
        featured: state.editing?.featured || false,
        metaTitle: val('#f_metaTitle') || title,
        metaDescription: val('#f_metaDescription') || val('#f_excerpt').slice(0, 160),
      };

      if (state.editing) {
        state.posts = state.posts.map((p) => (p.id === item.id ? item : p));
      } else {
        state.posts.unshift(item);
      }
    } else {
      const name = val('#f_name');
      if (!name) return toast('Nama wajib diisi', 'warn');

      item = {
        id: state.editing?.id || (type === 'tool' ? 'tool-' : 'game-') + Date.now(),
        name,
        slug: name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
        type,
        category: val('#f_category') || (type === 'tool' ? 'SEO' : 'Game'),
        description: val('#f_description'),
        icon: val('#f_icon') || (type === 'tool' ? '🛠️' : '🎮'),
        url: val('#f_url') || `/${type}s/${name.toLowerCase().replace(/\s+/g, '-')}.html`,
        metaTitle: val('#f_metaTitle') || name,
        metaDescription: val('#f_metaDescription') || val('#f_description').slice(0, 160),
      };

      if (state.editing) {
        state.tools = state.tools.map((t) => (t.id === item.id ? item : t));
      } else {
        state.tools.unshift(item);
      }
    }

    try {
      toast('Menyimpan...', 'info');
      if (type === 'post') {
        await ghPut('content/posts.json', JSON.stringify({ posts: state.posts }, null, 2), `CMS: update post "${item.title}"`);
      } else {
        await ghPut('content/tools.json', JSON.stringify({ tools: state.tools }, null, 2), `CMS: update ${type} "${item.name}"`);
      }
      saveCache();
      renderLists();
      closeEditor();
      toast('Berhasil dipush ke GitHub!', 'success');
    } catch (e) {
      console.error(e);
      toast(e.message, 'error');
    }
  }

  // ---------- DELETE ----------
  async function deleteItem(type, id) {
    if (!confirm('Yakin ingin menghapus item ini?')) return;
    if (!isConfigured()) return toast('GitHub belum dikonfigurasi', 'warn');

    if (type === 'post') {
      state.posts = state.posts.filter((p) => p.id !== id);
    } else {
      state.tools = state.tools.filter((t) => t.id !== id);
    }

    try {
      if (type === 'post') {
        await ghPut('content/posts.json', JSON.stringify({ posts: state.posts }, null, 2), 'CMS: delete post');
      } else {
        await ghPut('content/tools.json', JSON.stringify({ tools: state.tools }, null, 2), 'CMS: delete item');
      }
      saveCache();
      renderLists();
      toast('Item dihapus', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- SEO CONFIG ----------
  function fillSEOForm() {
    const c = state.config;
    $('#cfgSiteName').value = c.siteName || '';
    $('#cfgSiteUrl').value = c.siteUrl || '';
    $('#cfgDesc').value = c.siteDescription || '';
    $('#cfgKeywords').value = c.siteKeywords || '';
    $('#cfgOgImage').value = c.ogImage || '';
    $('#cfgTwitter').value = c.twitterHandle || '';
  }

  async function saveSEOConfig() {
    if (!isConfigured()) return toast('GitHub belum dikonfigurasi', 'warn');

    const cfg = {
      ...state.config,
      siteName: $('#cfgSiteName').value.trim(),
      siteUrl: $('#cfgSiteUrl').value.trim().replace(/\/$/, ''),
      siteDescription: $('#cfgDesc').value.trim(),
      siteKeywords: $('#cfgKeywords').value.trim(),
      ogImage: $('#cfgOgImage').value.trim(),
      twitterHandle: $('#cfgTwitter').value.trim(),
    };

    try {
      toast('Menyimpan SEO config...', 'info');
      await ghPut('content/config.json', JSON.stringify(cfg, null, 2), 'CMS: update SEO config');
      state.config = cfg;
      saveCache();
      toast('SEO config tersimpan!', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- GITHUB SETTINGS ----------
  function openSettings() {
    const c = getGH();
    $('#ghOwner').value = c.owner || '';
    $('#ghRepo').value = c.repo || '';
    $('#ghBranch').value = c.branch || 'main';
    $('#ghToken').value = c.token || '';
    $('#settingsModal').classList.remove('hidden');
    $('#settingsModal').classList.add('flex');
  }

  function closeSettings() {
    $('#settingsModal').classList.add('hidden');
    $('#settingsModal').classList.remove('flex');
  }

  async function saveGitHubSettings() {
    const cfg = {
      owner: $('#ghOwner').value.trim(),
      repo: $('#ghRepo').value.trim(),
      branch: $('#ghBranch').value.trim() || 'main',
      token: $('#ghToken').value.trim(),
    };

    if (!cfg.owner || !cfg.repo) {
      return toast('Owner & Repo wajib diisi', 'warn');
    }

    setGH(cfg);
    closeSettings();
    updateAuthBadge();

    // Test koneksi
    if (cfg.token) {
      try {
        const r = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}`, {
          headers: { Authorization: `token ${cfg.token}` },
        });
        if (r.ok) {
          toast('Berhasil terhubung ke GitHub!', 'success');
        } else {
          toast('Token salah atau repo tidak ditemukan', 'error');
        }
      } catch {
        toast('Gagal koneksi ke GitHub', 'error');
      }
    } else {
      toast('Pengaturan tersimpan. Token kosong (read-only).', 'warn');
    }
  }

  function updateAuthBadge() {
    const badge = $('#authStatus');
    if (isConfigured()) {
      badge.classList.remove('hidden');
      badge.textContent = '● Terhubung GitHub';
    } else {
      badge.classList.add('hidden');
    }
  }

  // ---------- LOAD DATA ----------
  async function loadData() {
    const hasCache = loadCache();

    // Load config
    try {
      const cfgR = await fetch('/content/config.json?t=' + Date.now());
      if (cfgR.ok) {
        state.config = await cfgR.json();
        fillSEOForm();
      }
    } catch (e) {
      console.warn('Config load failed', e);
    }

    // Load posts
    try {
      const r = await fetch('/content/posts.json?t=' + Date.now());
      if (r.ok) state.posts = (await r.json()).posts || [];
    } catch (e) {
      console.warn('Posts load failed', e);
    }

    // Load tools
    try {
      const r = await fetch('/content/tools.json?t=' + Date.now());
      if (r.ok) state.tools = (await r.json()).tools || [];
    } catch (e) {
      console.warn('Tools load failed', e);
    }

    saveCache();
    renderLists();
    updateAuthBadge();
  }

  // ---------- TABS ----------
  function bindTabs() {
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        $$('.tab-btn').forEach((b) => {
          b.classList.remove('border-brand-600', 'text-brand-600');
          b.classList.add('border-transparent', 'text-slate-500');
        });
        btn.classList.add('border-brand-600', 'text-brand-600');
        btn.classList.remove('border-transparent', 'text-slate-500');

        $$('[data-panel]').forEach((p) => {
          p.classList.toggle('hidden', p.dataset.panel !== tab);
        });
      });
    });
  }

  // ---------- GLOBAL EVENT DELEGATION ----------
  function bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const { action, type, id } = btn.dataset;
      if (action === 'edit') openEditor(type, id);
      if (action === 'delete') deleteItem(type, id);
    });

    // Close modal on overlay click
    $('#editorModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'editorModal') closeEditor();
    });
    $('#settingsModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') closeSettings();
    });

    // ESC closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#editorModal').classList.contains('hidden')) closeEditor();
        if (!$('#settingsModal').classList.contains('hidden')) closeSettings();
      }
    });

    // Ctrl+S to save
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!$('#editorModal').classList.contains('hidden')) saveItem();
      }
    });
  }

  // ---------- EXPOSE GLOBAL FUNCTIONS ----------
  window.openEditor = openEditor;
  window.closeEditor = closeEditor;
  window.saveItem = saveItem;
  window.deleteItem = deleteItem;
  window.saveSEOConfig = saveSEOConfig;
  window.saveGitHubSettings = saveGitHubSettings;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;

  // ---------- BOOT ----------
  document.addEventListener('DOMContentLoaded', () => {
    bindTabs();
    bindGlobalEvents();
    $('#settingsBtn')?.addEventListener('click', openSettings);
    loadData();
  });
})();
