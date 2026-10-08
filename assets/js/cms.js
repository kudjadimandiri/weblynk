/* ============================================
   WebLynk CMS — Complete with AI Schema + Pages + Scroll Fix
   ============================================ */

(function () {
  'use strict';

  const GH_KEY = 'weblynk_github';
  const CACHE_KEY = 'weblynk_cache';
  const API = 'https://api.github.com';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function toast(msg, type = 'info') {
    const colors = { info: 'bg-brand-600', success: 'bg-green-600', error: 'bg-red-600', warn: 'bg-amber-500' };
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };

    const el = document.createElement('div');
    el.className = `fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl ${colors[type]} px-5 py-3 text-sm font-medium text-white shadow-2xl transition-all duration-300`;
    el.style.transform = 'translateY(80px)';
    el.style.opacity = '0';
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
    });
    setTimeout(() => {
      el.style.transform = 'translateY(80px)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ---------- GITHUB ----------
  function getGH() {
    try { return JSON.parse(localStorage.getItem(GH_KEY) || '{}'); }
    catch { return {}; }
  }
  function setGH(cfg) { localStorage.setItem(GH_KEY, JSON.stringify(cfg)); }
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
    } catch {}

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

  // ---------- CACHE ----------
  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        posts: state.posts, tools: state.tools, config: state.config, pages: Pages.pages, ts: Date.now(),
      }));
    } catch (e) { console.warn('Cache save failed', e); }
  }
  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (c.posts) state.posts = c.posts;
      if (c.tools) state.tools = c.tools;
      if (c.config) state.config = c.config;
      if (c.pages) Pages.pages = c.pages;
      return Boolean(c.posts || c.tools);
    } catch { return false; }
  }

  const state = {
    posts: [], tools: [], config: {},
    editing: null, editingType: 'post',
  };

  // ---------- RENDER LISTS ----------
  function renderLists() {
    const row = (item, type) => {
      const icon = item.icon || (type === 'post' ? '📝' : type === 'tool' ? '🛠️' : '🎮');
      const title = item.title || item.name || '(tanpa judul)';
      const meta = [item.category, item.date].filter(Boolean).join(' · ');
      const hasMd = type === 'post' && item.markdown;
      const hasAI = type === 'post' && item.aiSchema && (
        item.aiSchema.faq?.length || item.aiSchema.keyTakeaways?.length || item.aiSchema.howTo?.steps?.length
      );
      return `
        <div class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">${icon}</span>
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">
                ${title}
                ${hasMd ? '<span class="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">MD</span>' : ''}
                ${hasAI ? '<span class="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">🤖 AI</span>' : ''}
              </p>
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
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada artikel.</p>';
    $('#toolsList').innerHTML = tools.length
      ? tools.map((t) => row(t, 'tool')).join('')
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada tools.</p>';
    $('#gamesList').innerHTML = games.length
      ? games.map((g) => row(g, 'game')).join('')
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada games.</p>';
  }

  // ============================================
  // PAGES MODULE
  // ============================================
  const Pages = {
    pages: [],

    renderList() {
      const list = $('#pagesList');
      if (!list) return;

      if (!this.pages.length) {
        list.innerHTML = '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada halaman. Klik "+ Halaman Baru".</p>';
        return;
      }

      list.innerHTML = this.pages
        .slice()
        .sort((a, b) => (a.navOrder || 99) - (b.navOrder || 99))
        .map(p => `
          <div class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">${p.icon || '📄'}</span>
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-900">
                  ${p.title}
                  ${p.showInNav ? '<span class="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">NAV</span>' : ''}
                </p>
                <p class="truncate text-xs text-slate-500">/pages/?slug=${p.slug}</p>
              </div>
            </div>
            <div class="flex flex-shrink-0 gap-2">
              <a href="/pages/?slug=${p.slug}" target="_blank" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">👁️ Lihat</a>
              <button data-action="edit-page" data-id="${p.id}" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">✏️ Edit</button>
              <button data-action="delete-page" data-id="${p.id}" class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">🗑️</button>
            </div>
          </div>`).join('');
    },

    async load() {
      try {
        const r = await fetch('/content/pages.json?t=' + Date.now());
        if (r.ok) {
          const data = await r.json();
          this.pages = data.pages || [];
        }
      } catch (e) {
        console.warn('Pages load failed', e);
      }
      this.renderList();
    },

    get(id) { return this.pages.find(p => p.id === id); },

    async delete(id) {
      if (!confirm('Yakin hapus halaman ini?')) return;
      if (!isConfigured()) return toast('GitHub belum dikonfigurasi', 'warn');

      this.pages = this.pages.filter(p => p.id !== id);
      try {
        await ghPut('content/pages.json', JSON.stringify({ pages: this.pages }, null, 2), 'CMS: delete page');
        this.renderList();
        toast('Halaman dihapus', 'success');
      } catch (e) { toast(e.message, 'error'); }
    },

    async save(item) {
      if (!isConfigured()) {
        toast('Konfigurasi GitHub dulu di ⚙️ Pengaturan', 'warn');
        return false;
      }

      const idx = this.pages.findIndex(p => p.id === item.id);
      if (idx >= 0) this.pages[idx] = item;
      else this.pages.push(item);

      try {
        toast('Menyimpan halaman...', 'info');
        await ghPut('content/pages.json', JSON.stringify({ pages: this.pages }, null, 2), `CMS: save page "${item.title}"`);
        this.renderList();
        toast('Halaman tersimpan!', 'success');
        return true;
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    },
  };

  // ============================================
  // AI SCHEMA MODULE
  // ============================================
  const AI = {
    init() {
      $('#aiPanelToggle')?.addEventListener('click', () => {
        const panel = $('#aiPanel');
        const chevron = $('#aiChevron');
        const collapsed = panel.style.display === 'none';
        panel.style.display = collapsed ? '' : 'none';
        chevron.style.transform = collapsed ? '' : 'rotate(-90deg)';
      });

      ['#f_about', '#f_mentions', '#f_keyTakeaways', '#f_title', '#f_slug', '#f_excerpt', '#f_image', '#f_category', '#f_tags', '#f_date']
        .forEach(sel => { $(sel)?.addEventListener('input', () => this.updatePreview()); });

      this.updatePreview();
    },

    addFAQ(q = '', a = '') {
      const list = $('#faqList');
      if (!list) return;
      const id = 'faq-' + Date.now() + Math.random().toString(36).slice(2, 6);
      const el = document.createElement('div');
      el.className = 'ai-faq-item rounded-lg border border-slate-100 bg-slate-50 p-3';
      el.dataset.faqId = id;
      el.innerHTML = `
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500">FAQ Item</span>
          <button type="button" class="text-xs text-red-500 hover:underline" data-remove>Hapus</button>
        </div>
        <input placeholder="Pertanyaan..." value="${String(q).replace(/"/g, '&quot;')}"
          class="faq-q mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
        <textarea placeholder="Jawaban..." rows="2"
          class="faq-a w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none">${a || ''}</textarea>`;
      list.appendChild(el);
      el.querySelector('[data-remove]').addEventListener('click', () => { el.remove(); this.updatePreview(); });
      el.querySelector('.faq-q').addEventListener('input', () => this.updatePreview());
      el.querySelector('.faq-a').addEventListener('input', () => this.updatePreview());
      this.updatePreview();
    },

    getFAQs() {
      return $$('#faqList [data-faq-id]').map(el => ({
        q: el.querySelector('.faq-q')?.value.trim() || '',
        a: el.querySelector('.faq-a')?.value.trim() || '',
      })).filter(f => f.q && f.a);
    },

    addHowToStep(name = '', text = '') {
      const list = $('#howToList');
      if (!list) return;
      const id = 'step-' + Date.now() + Math.random().toString(36).slice(2, 6);
      const el = document.createElement('div');
      el.className = 'ai-step-item rounded-lg border border-slate-100 bg-slate-50 p-3';
      el.dataset.stepId = id;
      el.innerHTML = `
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500">Step</span>
          <button type="button" class="text-xs text-red-500 hover:underline" data-remove>Hapus</button>
        </div>
        <input placeholder="Nama step..." value="${String(name).replace(/"/g, '&quot;')}"
          class="step-name mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
        <textarea placeholder="Penjelasan..." rows="2"
          class="step-text w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none">${text || ''}</textarea>`;
      list.appendChild(el);
      el.querySelector('[data-remove]').addEventListener('click', () => { el.remove(); this.updatePreview(); });
      el.querySelector('.step-name').addEventListener('input', () => this.updatePreview());
      el.querySelector('.step-text').addEventListener('input', () => this.updatePreview());
      this.updatePreview();
    },

    getHowToSteps() {
      return $$('#howToList [data-step-id]').map(el => ({
        name: el.querySelector('.step-name')?.value.trim() || '',
        text: el.querySelector('.step-text')?.value.trim() || '',
      })).filter(s => s.name);
    },

    buildSchemas() {
      const title = $('#f_title')?.value || '';
      const slug = $('#f_slug')?.value || title.toLowerCase().replace(/\s+/g, '-');
      const excerpt = $('#f_excerpt')?.value || '';
      const image = $('#f_image')?.value || '';
      const category = $('#f_category')?.value || 'SEO';
      const tags = $('#f_tags')?.value || '';
      const date = $('#f_date')?.value || new Date().toISOString().slice(0, 10);
      const base = state.config.siteUrl || location.origin;
      const url = `${base}/artikel/${slug}.html`;

      const about = ($('#f_about')?.value || '').split(',').map(s => s.trim()).filter(Boolean)
        .map(name => ({ '@type': 'Thing', name }));
      const mentions = ($('#f_mentions')?.value || '').split(',').map(s => s.trim()).filter(Boolean)
        .map(name => ({ '@type': 'Thing', name }));
      const faqs = this.getFAQs();
      const steps = this.getHowToSteps();

      const schemas = [];

      const blogPosting = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title || 'Untitled',
        description: excerpt,
        image: image ? { '@type': 'ImageObject', url: image, width: 1200, height: 630 } : undefined,
        datePublished: date,
        dateModified: date,
        author: { '@type': 'Organization', name: state.config.author || 'WebLynk Team' },
        publisher: {
          '@type': 'Organization',
          name: state.config.siteName || 'WebLynk',
          logo: { '@type': 'ImageObject', url: `${base}/logo.png` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        articleSection: category,
        keywords: tags,
        inLanguage: 'id-ID',
        isAccessibleForFree: true,
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['.article-title', '.key-takeaways', '.article-summary'],
        },
      };
      if (about.length) blogPosting.about = about;
      if (mentions.length) blogPosting.mentions = mentions;
      schemas.push(blogPosting);

      if (faqs.length) {
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(f => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        });
      }

      if (steps.length) {
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: title,
          description: excerpt,
          image: image || undefined,
          totalTime: 'PT30M',
          step: steps.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        });
      }

      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: base },
          { '@type': 'ListItem', position: 2, name: category, item: `${base}/#artikel` },
          { '@type': 'ListItem', position: 3, name: title || 'Artikel', item: url },
        ],
      });

      return JSON.parse(JSON.stringify(schemas, (k, v) => v === undefined ? undefined : v));
    },

    updatePreview() {
      const schemas = this.buildSchemas();
      const preview = $('#aiPreview');
      if (preview) preview.textContent = JSON.stringify(schemas, null, 2);

      const info = $('#aiInfo');
      if (info) {
        const faqCount = this.getFAQs().length;
        const stepCount = this.getHowToSteps().length;
        const aboutCount = ($('#f_about')?.value || '').split(',').filter(Boolean).length;
        const mentionCount = ($('#f_mentions')?.value || '').split(',').filter(Boolean).length;
        info.textContent = `📊 ${schemas.length} schema · ${faqCount} FAQ · ${stepCount} howto · ${aboutCount} about · ${mentionCount} mentions`;
      }
    },

    load(item) {
      const faqList = $('#faqList');
      const howList = $('#howToList');
      if (faqList) faqList.innerHTML = '';
      if (howList) howList.innerHTML = '';

      ['#f_about', '#f_mentions', '#f_keyTakeaways'].forEach(sel => {
        const el = $(sel);
        if (el) el.value = '';
      });

      if (!item?.aiSchema) {
        this.updatePreview();
        return;
      }

      const s = item.aiSchema;
      if (s.about) $('#f_about').value = s.about.map(a => a.name || a).join(', ');
      if (s.mentions) $('#f_mentions').value = s.mentions.map(m => m.name || m).join(', ');
      if (s.keyTakeaways) $('#f_keyTakeaways').value = s.keyTakeaways.join('\n');
      if (s.faq) s.faq.forEach(f => this.addFAQ(f.q, f.a));
      if (s.howTo?.steps) s.howTo.steps.forEach(step => this.addHowToStep(step.name, step.text));

      this.updatePreview();
    },

    getData() {
      const faqs = this.getFAQs();
      const steps = this.getHowToSteps();
      const about = ($('#f_about')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      const mentions = ($('#f_mentions')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      const takeaways = ($('#f_keyTakeaways')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);

      if (!faqs.length && !steps.length && !about.length && !mentions.length && !takeaways.length) {
        return null;
      }

      const data = { speakable: ['.article-title', '.key-takeaways', '.article-summary'] };
      if (about.length) data.about = about.map(name => ({ name }));
      if (mentions.length) data.mentions = mentions.map(name => ({ name }));
      if (takeaways.length) data.keyTakeaways = takeaways;
      if (faqs.length) data.faq = faqs;
      if (steps.length) data.howTo = { name: $('#f_title')?.value || '', steps };
      return data;
    },
  };

  // ============================================
  // MARKDOWN EDITOR
  // ============================================
  const MD = {
    editor: null, preview: null, previewScroll: null,

    init() {
      this.editor = $('#mdEditor');
      this.preview = $('#previewContent');
      this.previewScroll = $('#previewScroll');
      if (!this.editor) return;

      if (window.marked) {
        marked.setOptions({
          breaks: true, gfm: true, headerIds: true, mangle: false,
          highlight: (code, lang) => {
            if (window.hljs && lang && hljs.getLanguage(lang)) {
              try { return hljs.highlight(code, { language: lang }).value; }
              catch {}
            }
            return code;
          },
        });
      }

      this.bindToolbar();
      this.bindKeyboardShortcuts();
      this.bindLivePreview();
      this.bindMetaToggle();
      this.bindPreviewToggle();
      this.bindSampleAndClear();

      this.updatePreview();
      this.updateStats();
    },

    bindToolbar() {
      $$('#mdToolbar [data-md]').forEach((btn) => {
        btn.addEventListener('click', () => this.applyFormat(btn.dataset.md));
      });
      $('#insertSnippet')?.addEventListener('click', () => this.insertSnippet());
    },

    applyFormat(type) {
      const ta = this.editor;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const text = ta.value;
      const selected = text.slice(start, end);
      let replacement = selected;
      let cursorOffset = 0;

      const wrap = (before, after = before) => {
        replacement = before + (selected || '') + after;
        cursorOffset = before.length;
      };

      const linePrefix = (prefix) => {
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = text.indexOf('\n', end) === -1 ? text.length : text.indexOf('\n', end);
        const block = text.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        replacement = lines.map(l => prefix + l).join('\n');
        ta.value = text.slice(0, lineStart) + replacement + text.slice(lineEnd);
        ta.focus();
        ta.setSelectionRange(lineStart, lineStart + replacement.length);
        this.updatePreview();
        this.updateStats();
        this.markUnsaved();
        return;
      };

      switch (type) {
        case 'bold': wrap('**'); break;
        case 'italic': wrap('*'); break;
        case 'strike': wrap('~~'); break;
        case 'code': wrap('`'); break;
        case 'h2': return linePrefix('## ');
        case 'h3': return linePrefix('### ');
        case 'ul': return linePrefix('- ');
        case 'ol': return linePrefix('1. ');
        case 'quote': return linePrefix('> ');
        case 'hr': replacement = '\n\n---\n\n'; break;
        case 'link':
          replacement = `[${selected || 'teks link'}](https://example.com)`;
          cursorOffset = 1;
          break;
        case 'image':
          replacement = `![${selected || 'alt text'}](https://example.com/image.jpg)`;
          break;
        case 'codeblock':
          replacement = '```\n' + (selected || '// kode Anda') + '\n```';
          break;
        default: return;
      }

      ta.value = text.slice(0, start) + replacement + text.slice(end);
      ta.focus();
      const newCursor = start + cursorOffset + (selected ? selected.length : 0);
      ta.setSelectionRange(newCursor, newCursor);
      this.updatePreview();
      this.updateStats();
      this.markUnsaved();
    },

    bindKeyboardShortcuts() {
      this.editor?.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key === 'b') { e.preventDefault(); this.applyFormat('bold'); }
        else if (ctrl && e.key === 'i') { e.preventDefault(); this.applyFormat('italic'); }
        else if (ctrl && e.key === 'k') { e.preventDefault(); this.applyFormat('link'); }
        else if (e.key === 'Tab') {
          e.preventDefault();
          const s = this.editor.selectionStart;
          this.editor.value = this.editor.value.slice(0, s) + '  ' + this.editor.value.slice(this.editor.selectionEnd);
          this.editor.setSelectionRange(s + 2, s + 2);
        }
      });
    },

    bindLivePreview() {
      let debounce;
      this.editor?.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.updatePreview();
          this.updateStats();
          this.markUnsaved();
        }, 150);
      });
    },

    updatePreview() {
      if (!this.editor || !this.preview) return;
      const md = this.editor.value;

      if (!md.trim()) {
        this.preview.innerHTML = '<p class="italic text-slate-400">Preview akan muncul di sini saat Anda mengetik...</p>';
        return;
      }

      try {
        let html = window.marked ? marked.parse(md) : this.fallbackParse(md);
        if (window.DOMPurify) {
          html = DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
        }
        this.preview.innerHTML = html;

        if (window.hljs) {
          $$('pre code', this.preview).forEach((block) => {
            try { hljs.highlightElement(block); } catch {}
          });
        }

        $$('a[href^="http"]', this.preview).forEach((a) => {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });
      } catch (err) {
        this.preview.innerHTML = `<p class="text-red-500">Error: ${err.message}</p>`;
      }
    },

    fallbackParse(md) {
      return md
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^\- (.*$)/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(.+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`);
    },

    updateStats() {
      if (!this.editor) return;
      const val = this.editor.value;
      const chars = val.length;
      const lines = val.split('\n').length;
      const words = val.trim() ? val.trim().split(/\s+/).length : 0;
      const stats = $('#mdStats');
      const wc = $('#wordCount');
      if (stats) stats.textContent = `${chars.toLocaleString()} karakter · ${lines} baris`;
      if (wc) wc.textContent = `${words} kata`;
    },

    bindMetaToggle() {
      const btn = $('#metaToggle');
      const wrap = $('#metaFieldsWrap');
      const chevron = $('#metaChevron');
      const status = $('#metaStatus');
      if (!btn || !wrap) return;

      wrap.classList.add('hidden');
      if (chevron) chevron.style.transform = 'rotate(-90deg)';

      btn.addEventListener('click', () => {
        const isHidden = wrap.classList.contains('hidden');
        wrap.classList.toggle('hidden', !isHidden);
        if (chevron) chevron.style.transform = isHidden ? '' : 'rotate(-90deg)';
        if (status) status.textContent = isHidden ? '' : '(klik untuk sembunyikan)';
      });
    },

    bindPreviewToggle() {
      const desktop = $('#previewDesktop');
      const mobile = $('#previewMobile');
      if (!desktop || !mobile) return;
      const setMode = (isMobile) => {
        desktop.className = !isMobile
          ? 'rounded px-2 py-1 font-medium text-brand-600 bg-brand-50'
          : 'rounded px-2 py-1 font-medium text-slate-500 hover:bg-slate-100';
        mobile.className = isMobile
          ? 'rounded px-2 py-1 font-medium text-brand-600 bg-brand-50'
          : 'rounded px-2 py-1 font-medium text-slate-500 hover:bg-slate-100';
        this.preview.classList.toggle('preview-mobile', isMobile);
      };
      desktop.addEventListener('click', () => setMode(false));
      mobile.addEventListener('click', () => setMode(true));
    },

    bindSampleAndClear() {
      $('#loadSampleBtn')?.addEventListener('click', () => this.loadSample());
      $('#clearBtn')?.addEventListener('click', () => {
        if (!confirm('Kosongkan semua field?')) return;
        this.editor.value = '';
        ['#f_title', '#f_slug', '#f_excerpt', '#f_image', '#f_metaTitle', '#f_metaDescription', '#f_tags', '#f_about', '#f_mentions', '#f_keyTakeaways'].forEach(s => {
          const el = $(s);
          if (el) el.value = '';
        });
        const faqList = $('#faqList');
        const howList = $('#howToList');
        if (faqList) faqList.innerHTML = '';
        if (howList) howList.innerHTML = '';
        this.updatePreview();
        this.updateStats();
        AI.updatePreview();
      });
    },

    loadSample() {
      const sample = `# Panduan Backlink High DA/DR 2026

**Backlink** adalah komponen vital dari strategi SEO yang sukses.

## Apa Itu Backlink?

Backlink adalah tautan dari satu website ke website lain.

> 💡 **Intinya:** Semakin banyak backlink berkualitas, semakin tinggi kepercayaan Google.

## Mengapa Backlink Penting?

- **Peringkat Lebih Baik:** Faktor peringkat utama
- **Lalu Lintas Organik:** Traffic rujukan
- **Kredibilitas:** Meningkatkan otoritas

## Kesimpulan

Fokus pada **kualitas** daripada kuantitas.`;

      if (this.editor) {
        this.editor.value = sample;
        this.updatePreview();
        this.updateStats();
        toast('Contoh dimuat!', 'info');
      }
    },

    insertSnippet() {
      const snippets = {
        'Blockquote Tips': '\n> 💡 **Tips:** Tulis tips Anda di sini.\n',
        'CTA Box': '\n> 🔥 **Dapatkan 10 Backlink High DA/DR** — [Klik di sini](https://weblynk.pages.dev)\n',
        'Table': '\n| Header 1 | Header 2 |\n|----------|----------|\n| Isi 1    | Isi 2    |\n',
        'Checklist': '\n- [x] Sudah selesai\n- [ ] Belum selesai\n',
        'Code Block JS': '\n```js\nconsole.log("Hello");\n```\n',
        'Code Block HTML': '\n```html\n<div class="example">Hello</div>\n```\n',
        'Image': '\n![alt text](https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800)\n',
      };
      const keys = Object.keys(snippets);
      const pick = prompt(`Pilih snippet:\n${keys.map((k, i) => `${i + 1}. ${k}`).join('\n')}\n\nNomor:`);
      const idx = parseInt(pick, 10) - 1;
      if (keys[idx]) {
        const snippet = snippets[keys[idx]];
        const ta = this.editor;
        const pos = ta.selectionStart;
        ta.value = ta.value.slice(0, pos) + snippet + ta.value.slice(ta.selectionEnd);
        ta.focus();
        ta.setSelectionRange(pos + snippet.length, pos + snippet.length);
        this.updatePreview();
        this.updateStats();
      }
    },

    load(item) {
      if (!this.editor) this.init();
      if (!item) {
        this.editor.value = '';
        this.updatePreview();
        this.updateStats();
        return;
      }
      let content = item.markdown || '';
      if (!content && item.content) {
        const looksLikeHtml = /<p>|<h[1-6]>|<ul>|<div>/i.test(item.content);
        content = looksLikeHtml ? this.htmlToMarkdown(item.content) : item.content;
      }
      this.editor.value = content;
      this.updatePreview();
      this.updateStats();
    },

    htmlToMarkdown(html) {
      return html
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
        .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
        .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n')
        .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
        .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
        .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<hr[^>]*\/?>/gi, '\n---\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    },

    getMarkdown() { return this.editor?.value || ''; },

    getHTML() {
      const md = this.getMarkdown();
      if (!md.trim()) return '';
      let html = window.marked ? marked.parse(md) : this.fallbackParse(md);
      if (window.DOMPurify) {
        html = DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
      }
      html = html.replace(
        /<a href="(https?:\/\/[^"]+)"/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer"'
      );
      return html;
    },

    markUnsaved() {
      const status = $('#saveStatus');
      if (status) {
        status.textContent = '● Belum disimpan';
        status.className = 'text-xs font-medium text-amber-600';
        status.classList.remove('hidden');
      }
      $('#lastSaved')?.classList.add('hidden');
    },

    markSaved() {
      const status = $('#saveStatus');
      if (status) {
        status.textContent = '✓ Tersimpan';
        status.className = 'text-xs font-medium text-green-600';
      }
      const lastSaved = $('#lastSaved');
      const timeEl = $('#lastSavedTime');
      if (lastSaved && timeEl) {
        lastSaved.classList.remove('hidden');
        timeEl.textContent = new Date().toLocaleTimeString('id-ID');
      }
    },
  };

  // ---------- TOOL/GAME FIELDS ----------
  function buildToolGameFields(type, data) {
    const common = `
      <div class="border-t border-slate-200 pt-3 sm:col-span-2">
        <p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">🔍 SEO Meta</p>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Meta Title</label>
        <input id="f_metaTitle" value="${data.metaTitle || ''}" maxlength="60"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Meta Description</label>
        <textarea id="f_metaDescription" rows="2" maxlength="160"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">${data.metaDescription || ''}</textarea>
      </div>`;

    return `
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Nama *</label>
        <input id="f_name" value="${data.name || ''}" required
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Icon (emoji)</label>
        <input id="f_icon" value="${data.icon || (type === 'tool' ? '🛠️' : '🎮')}"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Kategori</label>
        <input id="f_category" value="${data.category || (type === 'tool' ? 'SEO' : 'Game')}"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">URL / Path</label>
        <input id="f_url" value="${data.url || ''}" placeholder="/tools/nama-tool.html"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div class="sm:col-span-2">
        <label class="mb-1 block text-xs font-medium text-slate-600">Deskripsi</label>
        <textarea id="f_description" rows="3"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">${data.description || ''}</textarea>
      </div>
      ${common}`;
  }

  // ---------- RESTORE POST META FIELDS ----------
  function getPostMetaFieldsHTML() {
    return `
      <div class="sm:col-span-2">
        <label class="mb-1 block text-xs font-medium text-slate-600">Judul *</label>
        <input id="f_title" placeholder="Panduan Backlink High DA/DR 2026"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Slug</label>
        <input id="f_slug" placeholder="otomatis-dari-judul"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Kategori</label>
        <input id="f_category" value="SEO"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Tanggal</label>
        <input id="f_date" type="date"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Cover Image URL</label>
        <input id="f_image" placeholder="https://..."
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div class="sm:col-span-2">
        <label class="mb-1 block text-xs font-medium text-slate-600">Tags (koma)</label>
        <input id="f_tags" placeholder="backlink, high DA, SEO 2026"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div class="sm:col-span-2">
        <label class="mb-1 block text-xs font-medium text-slate-600">Excerpt</label>
        <textarea id="f_excerpt" rows="2"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"></textarea>
      </div>
      <div class="sm:col-span-2 border-t border-slate-200 pt-3">
        <p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">🔍 SEO Override</p>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Meta Title (max 60)</label>
        <input id="f_metaTitle" maxlength="60"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-600">Meta Description (max 160)</label>
        <textarea id="f_metaDescription" rows="2" maxlength="160"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"></textarea>
      </div>

      <div id="aiPanelWrap" class="sm:col-span-2 mt-2 rounded-xl border-2 border-dashed border-brand-300 bg-gradient-to-br from-brand-50 to-white p-4">
        <button id="aiPanelToggle" type="button" class="flex w-full items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">🤖</span>
            <div class="text-left">
              <p class="text-sm font-bold text-slate-900">AI Schema</p>
              <p id="aiInfo" class="text-xs text-slate-500">FAQ, HowTo, Key Takeaways</p>
            </div>
          </div>
          <svg id="aiChevron" class="h-5 w-5 text-brand-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div id="aiPanel" class="mt-4 space-y-4" style="display:none">
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <label class="mb-2 flex items-center justify-between text-sm font-medium">
              <span>🎯 Key Takeaways</span>
              <span class="text-xs font-normal text-slate-500">AI akan kutip poin ini</span>
            </label>
            <textarea id="f_keyTakeaways" rows="4"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"></textarea>
            <p class="mt-1 text-xs text-slate-500">Satu poin per baris (idealnya 3-5 poin)</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-slate-200 bg-white p-4">
              <label class="mb-2 block text-sm font-medium">📚 About</label>
              <input id="f_about" placeholder="Backlink, SEO, Link Building"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-4">
              <label class="mb-2 block text-sm font-medium">🔗 Mentions</label>
              <input id="f_mentions" placeholder="Ahrefs, Moz, SEMrush"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <label class="text-sm font-medium">❓ FAQ</label>
                <p class="text-xs text-slate-500">Rekomendasi: 3-5 FAQ</p>
              </div>
              <button type="button" onclick="addFAQ()" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700">+ FAQ</button>
            </div>
            <div id="faqList" class="space-y-3"></div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <label class="text-sm font-medium">📝 HowTo Steps</label>
                <p class="text-xs text-slate-500">Untuk artikel tutorial</p>
              </div>
              <button type="button" onclick="addHowToStep()" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700">+ Step</button>
            </div>
            <div id="howToList" class="space-y-3"></div>
          </div>
          <div class="rounded-lg border-2 border-slate-800 bg-slate-900 p-4">
            <div class="mb-2 flex items-center justify-between">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-300">🔍 Live JSON-LD Preview</label>
              <button type="button" onclick="copyJSONLD()" class="rounded-lg bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600">📋 Copy</button>
            </div>
            <pre id="aiPreview" class="max-h-64 overflow-auto rounded-lg bg-black p-3 text-xs text-green-400" style="font-family: ui-monospace, monospace;"></pre>
          </div>
        </div>
      </div>
    `;
  }

  // ---------- OPEN EDITOR (POST/TOOL/GAME) ----------
  function openEditor(type, id) {
    state.editingType = type;
    const pool = type === 'post' ? state.posts : state.tools;
    state.editing = id ? pool.find((i) => i.id === id) : null;

    const titleMap = { post: 'Artikel', tool: 'Tool', game: 'Game' };
    $('#editorTitle').textContent = (state.editing ? 'Edit ' : 'Tulis ') + titleMap[type];

    // Reset metadata toggle
    const wrap = $('#metaFieldsWrap');
    const chevron = $('#metaChevron');
    const status = $('#metaStatus');
    if (wrap) wrap.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
    if (status) status.textContent = '';

    // Restore meta fields untuk post (jika sebelumnya diganti page editor)
    const metaFields = $('#metaFields');
    if (type === 'post') {
      if (metaFields && !metaFields.querySelector('#f_title')) {
        metaFields.innerHTML = getPostMetaFieldsHTML();
        AI.init();
      }
    }

    if (type === 'post') {
      $('#toolGamePanel').classList.add('hidden');
      $('#editorPanel').classList.remove('hidden');
      $('#previewPanel').classList.remove('hidden');

      const d = state.editing || {};
      const setVal = (sel, v) => { const el = $(sel); if (el) el.value = v || ''; };
      setVal('#f_title', d.title);
      setVal('#f_slug', d.slug);
      setVal('#f_category', d.category || 'SEO');
      setVal('#f_date', d.date || new Date().toISOString().slice(0, 10));
      setVal('#f_image', d.image);
      setVal('#f_tags', (d.tags || []).join(', '));
      setVal('#f_excerpt', d.excerpt);
      setVal('#f_metaTitle', d.metaTitle);
      setVal('#f_metaDescription', d.metaDescription);

      if (!MD.editor) MD.init();
      MD.load(state.editing);
      MD.markSaved();
      AI.load(state.editing);
    } else {
      $('#toolGamePanel').classList.remove('hidden');
      $('#editorFields').innerHTML = buildToolGameFields(type, state.editing || {});
      $('#editorPanel').classList.add('hidden');
      $('#previewPanel').classList.add('hidden');
    }

    window.saveItem = savePostItem;

    $('#editorModal').classList.remove('hidden');
    $('#editorModal').classList.add('flex');
    document.body.style.overflow = 'hidden';

    const body = $('#editorBody');
    if (body) body.scrollTop = 0;
  }

  // ---------- OPEN PAGE EDITOR ----------
  function openPageEditor(id) {
    const p = id ? Pages.get(id) : null;
    state.editingType = 'page';
    state.editing = p;

    $('#editorTitle').textContent = p ? 'Edit Halaman' : 'Halaman Baru';

    const wrap = $('#metaFieldsWrap');
    const chevron = $('#metaChevron');
    const status = $('#metaStatus');
    if (wrap) wrap.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
    if (status) status.textContent = '';

    // Hide AI panel
    const aiWrap = $('#aiPanelWrap');
    if (aiWrap) aiWrap.style.display = 'none';

    // Show tool/game panel
    $('#toolGamePanel').classList.add('hidden');

    // Show markdown + preview
    $('#editorPanel').classList.remove('hidden');
    $('#previewPanel').classList.remove('hidden');

    // Replace meta fields dengan page-specific
    const metaFields = $('#metaFields');
    if (metaFields) {
      metaFields.innerHTML = `
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-slate-600">Judul Halaman *</label>
          <input id="p_title" value="${p?.title || ''}" placeholder="Tentang Kami"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Slug *</label>
          <input id="p_slug" value="${p?.slug || ''}" placeholder="tentang"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <p class="mt-1 text-xs text-slate-400">URL: /pages/?slug=<span class="font-mono">${p?.slug || 'slug'}</span></p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Icon (emoji)</label>
          <input id="p_icon" value="${p?.icon || '📄'}" maxlength="4"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Nav Order</label>
          <input id="p_navOrder" type="number" value="${p?.navOrder || 1}"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-slate-600">Excerpt</label>
          <textarea id="p_excerpt" rows="2" placeholder="Deskripsi singkat halaman..."
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">${p?.excerpt || ''}</textarea>
        </div>
        <div class="sm:col-span-2 border-t border-slate-200 pt-3">
          <p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">🔍 SEO</p>
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-slate-600">Meta Title (max 60)</label>
          <input id="p_metaTitle" maxlength="60" value="${p?.metaTitle || ''}"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-slate-600">Meta Description (max 160)</label>
          <textarea id="p_metaDescription" rows="2" maxlength="160"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">${p?.metaDescription || ''}</textarea>
        </div>
        <div class="sm:col-span-2 border-t border-slate-200 pt-3">
          <p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">⚙️ Pengaturan Halaman</p>
        </div>
        <div class="sm:col-span-2">
          <label class="flex items-center gap-2 text-sm font-medium">
            <input id="p_showInNav" type="checkbox" ${p?.showInNav !== false ? 'checked' : ''}
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span>Tampilkan di Navigasi & Footer</span>
          </label>
        </div>
      `;
    }

    if (!MD.editor) MD.init();
    MD.load(p ? { markdown: p.markdown, content: p.content } : null);
    MD.markSaved();

    window.saveItem = savePageItem;

    $('#editorModal').classList.remove('hidden');
    $('#editorModal').classList.add('flex');
    document.body.style.overflow = 'hidden';

    const body = $('#editorBody');
    if (body) body.scrollTop = 0;
  }

  function closeEditor() {
    $('#editorModal').classList.add('hidden');
    $('#editorModal').classList.remove('flex');
    document.body.style.overflow = '';
    state.editing = null;
  }

  // ---------- SAVE POST/TOOL/GAME ----------
  async function savePostItem() {
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

      const contentHTML = MD.getHTML();
      const mdRaw = MD.getMarkdown();
      if (!mdRaw.trim()) return toast('Konten artikel kosong', 'warn');

      const plainText = mdRaw.replace(/[#*`>\[\]()!]/g, '').replace(/\s+/g, ' ').trim();

      item = {
        id: state.editing?.id || 'post-' + Date.now(),
        title,
        slug: val('#f_slug') || title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        excerpt: val('#f_excerpt') || plainText.slice(0, 160),
        content: contentHTML,
        markdown: mdRaw,
        category: val('#f_category') || 'SEO',
        tags: val('#f_tags').split(',').map(s => s.trim()).filter(Boolean),
        author: state.editing?.author || 'WebLynk Team',
        date: val('#f_date') || new Date().toISOString().slice(0, 10),
        dateModified: new Date().toISOString(),
        image: val('#f_image'),
        featured: state.editing?.featured || false,
        metaTitle: val('#f_metaTitle') || title,
        metaDescription: val('#f_metaDescription') || (val('#f_excerpt') || plainText).slice(0, 160),
        aiSchema: AI.getData(),
      };

      if (state.editing) state.posts = state.posts.map(p => p.id === item.id ? item : p);
      else state.posts.unshift(item);
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

      if (state.editing) state.tools = state.tools.map(t => t.id === item.id ? item : t);
      else state.tools.unshift(item);
    }

    try {
      toast('Menyimpan...', 'info');
      if (type === 'post') {
        await ghPut('content/posts.json', JSON.stringify({ posts: state.posts }, null, 2),
          `CMS: ${state.editing ? 'update' : 'new'} post "${item.title}"`);
      } else {
        await ghPut('content/tools.json', JSON.stringify({ tools: state.tools }, null, 2),
          `CMS: update ${type} "${item.name}"`);
      }
      saveCache();
      renderLists();
      if (type === 'post') MD.markSaved();
      toast('Berhasil dipush ke GitHub!', 'success');
      setTimeout(closeEditor, 500);
    } catch (e) {
      console.error(e);
      toast(e.message, 'error');
    }
  }

  // ---------- SAVE PAGE ----------
  async function savePageItem() {
    const val = (id) => $(id)?.value?.trim() ?? '';

    const title = val('#p_title');
    const slug = val('#p_slug');
    if (!title) return toast('Judul wajib diisi', 'warn');
    if (!slug) return toast('Slug wajib diisi', 'warn');

    const mdRaw = MD.getMarkdown();
    const contentHTML = MD.getHTML();
    if (!mdRaw.trim()) return toast('Konten halaman kosong', 'warn');

    const item = {
      id: state.editing?.id || 'page-' + Date.now(),
      title,
      slug: slug.toLowerCase().replace(/[^\w-]/g, '-').replace(/-+/g, '-'),
      icon: val('#p_icon') || '📄',
      excerpt: val('#p_excerpt') || mdRaw.replace(/[#*`>\[\]()!]/g, '').slice(0, 160),
      markdown: mdRaw,
      content: contentHTML,
      metaTitle: val('#p_metaTitle') || title,
      metaDescription: val('#p_metaDescription') || val('#p_excerpt').slice(0, 160),
      date: state.editing?.date || new Date().toISOString().slice(0, 10),
      dateModified: new Date().toISOString(),
      showInNav: $('#p_showInNav')?.checked ?? true,
      navOrder: parseInt(val('#p_navOrder')) || 1,
    };

    const ok = await Pages.save(item);
    if (ok) {
      MD.markSaved();
      saveCache();
      setTimeout(closeEditor, 500);
    }
  }

  // ---------- DELETE ----------
  async function deleteItem(type, id) {
    if (!confirm('Yakin ingin menghapus item ini?')) return;
    if (!isConfigured()) return toast('GitHub belum dikonfigurasi', 'warn');

    if (type === 'post') state.posts = state.posts.filter((p) => p.id !== id);
    else state.tools = state.tools.filter((t) => t.id !== id);

    try {
      if (type === 'post') {
        await ghPut('content/posts.json', JSON.stringify({ posts: state.posts }, null, 2), 'CMS: delete post');
      } else {
        await ghPut('content/tools.json', JSON.stringify({ tools: state.tools }, null, 2), 'CMS: delete item');
      }
      saveCache();
      renderLists();
      toast('Item dihapus', 'success');
    } catch (e) { toast(e.message, 'error'); }
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
    $('#cfgKnowsAbout').value = (c.knowsAbout || []).join(', ');
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
      knowsAbout: $('#cfgKnowsAbout').value.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      toast('Menyimpan SEO config...', 'info');
      await ghPut('content/config.json', JSON.stringify(cfg, null, 2), 'CMS: update SEO config');
      state.config = cfg;
      saveCache();
      toast('SEO config tersimpan!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  // ---------- SETTINGS ----------
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
    if (!cfg.owner || !cfg.repo) return toast('Owner & Repo wajib diisi', 'warn');

    setGH(cfg);
    closeSettings();
    updateAuthBadge();

    if (cfg.token) {
      try {
        const r = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}`, {
          headers: { Authorization: `token ${cfg.token}` },
        });
        if (r.ok) toast('Berhasil terhubung ke GitHub!', 'success');
        else toast('Token salah atau repo tidak ditemukan', 'error');
      } catch { toast('Gagal koneksi ke GitHub', 'error'); }
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
    loadCache();
    try {
      const cfgR = await fetch('/content/config.json?t=' + Date.now());
      if (cfgR.ok) { state.config = await cfgR.json(); fillSEOForm(); }
    } catch (e) { console.warn('Config load failed', e); }

    try {
      const r = await fetch('/content/posts.json?t=' + Date.now());
      if (r.ok) state.posts = (await r.json()).posts || [];
    } catch (e) { console.warn('Posts load failed', e); }

    try {
      const r = await fetch('/content/tools.json?t=' + Date.now());
      if (r.ok) state.tools = (await r.json()).tools || [];
    } catch (e) { console.warn('Tools load failed', e); }

    await Pages.load();

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

  // ---------- GLOBAL EVENTS ----------
  function bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, type, id } = btn.dataset;
      if (action === 'edit') openEditor(type, id);
      if (action === 'delete') deleteItem(type, id);
      if (action === 'edit-page') openPageEditor(id);
      if (action === 'delete-page') Pages.delete(id);
    });

    $('#editorModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'editorModal') closeEditor();
    });
    $('#settingsModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') closeSettings();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#editorModal').classList.contains('hidden')) closeEditor();
        if (!$('#settingsModal').classList.contains('hidden')) closeSettings();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!$('#editorModal').classList.contains('hidden')) saveItem();
      }
    });
  }

  // ---------- EXPOSE GLOBAL ----------
  window.openEditor = openEditor;
  window.openPageEditor = openPageEditor;
  window.closeEditor = closeEditor;
  window.saveItem = savePostItem;
  window.deleteItem = deleteItem;
  window.saveSEOConfig = saveSEOConfig;
  window.saveGitHubSettings = saveGitHubSettings;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.addFAQ = (q, a) => AI.addFAQ(q, a);
  window.addHowToStep = (n, t) => AI.addHowToStep(n, t);
  window.copyJSONLD = () => {
    const preview = $('#aiPreview');
    if (preview) {
      navigator.clipboard.writeText(preview.textContent);
      toast('JSON-LD copied!', 'success');
    }
  };
  window.WebLynkAI = AI;
  window.WebLynkMD = MD;
  window.WebLynkPages = Pages;

  // ---------- BOOT ----------
  document.addEventListener('DOMContentLoaded', () => {
    bindTabs();
    bindGlobalEvents();
    $('#settingsBtn')?.addEventListener('click', openSettings);
    MD.init();
    AI.init();
    loadData();
  });
})();