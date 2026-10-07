/* ============================================
   WebLynk CMS — Complete Admin Logic
   Includes: GitHub API, List Render, Markdown Editor
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

  // ============================================
  // GITHUB API
  // ============================================
  function getGH() {
    try { return JSON.parse(localStorage.getItem(GH_KEY) || '{}'); }
    catch { return {}; }
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
    } catch { /* file baru */ }

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

  // ============================================
  // LOCAL CACHE
  // ============================================
  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        posts: state.posts,
        tools: state.tools,
        config: state.config,
        ts: Date.now(),
      }));
    } catch (e) { console.warn('Cache save failed', e); }
  }

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (c.posts) state.posts = c.posts;
      if (c.tools) state.tools = c.tools;
      if (c.config) state.config = c.config;
      return Boolean(c.posts || c.tools);
    } catch { return false; }
  }

  // ============================================
  // STATE
  // ============================================
  const state = {
    posts: [],
    tools: [],
    config: {},
    editing: null,
    editingType: 'post',
  };

  // ============================================
  // RENDER LISTS
  // ============================================
  function renderLists() {
    const row = (item, type) => {
      const icon = item.icon || (type === 'post' ? '📝' : type === 'tool' ? '🛠️' : '🎮');
      const title = item.title || item.name || '(tanpa judul)';
      const meta = [item.category, item.date].filter(Boolean).join(' · ');
      const hasMd = type === 'post' && item.markdown;
      return `
        <div class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">${icon}</span>
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">
                ${title}
                ${hasMd ? '<span class="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">MD</span>' : ''}
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
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada artikel. Klik "✍️ Tulis Artikel Baru".</p>';

    $('#toolsList').innerHTML = tools.length
      ? tools.map((t) => row(t, 'tool')).join('')
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada tools.</p>';

    $('#gamesList').innerHTML = games.length
      ? games.map((g) => row(g, 'game')).join('')
      : '<p class="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-slate-500">Belum ada games.</p>';
  }

  // ============================================
  // MARKDOWN EDITOR MODULE
  // ============================================
  const MD = {
    editor: null,
    preview: null,
    previewScroll: null,
    isPreviewMobile: false,

    init() {
      this.editor = $('#mdEditor');
      this.preview = $('#previewContent');
      this.previewScroll = $('#previewScroll');
      if (!this.editor) return;

      if (window.marked) {
        marked.setOptions({
          breaks: true,
          gfm: true,
          headerIds: true,
          mangle: false,
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
        case 'hr':
          replacement = '\n\n---\n\n';
          break;
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

        if (ctrl && e.key === 'b') {
          e.preventDefault();
          this.applyFormat('bold');
        } else if (ctrl && e.key === 'i') {
          e.preventDefault();
          this.applyFormat('italic');
        } else if (ctrl && e.key === 'k') {
          e.preventDefault();
          this.applyFormat('link');
        } else if (e.key === 'Tab') {
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
          html = DOMPurify.sanitize(html, {
            ADD_ATTR: ['target', 'rel'],
            ADD_TAGS: ['iframe'],
          });
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
        this.preview.innerHTML = `<p class="text-red-500">Error parsing markdown: ${err.message}</p>`;
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
      const fields = $('#metaFields');
      const chevron = $('#metaChevron');
      if (!btn || !fields) return;

      btn.addEventListener('click', () => {
        const collapsed = fields.style.display === 'none';
        fields.style.display = collapsed ? '' : 'none';
        chevron.style.transform = collapsed ? '' : 'rotate(-90deg)';
      });
    },

    bindPreviewToggle() {
      const desktop = $('#previewDesktop');
      const mobile = $('#previewMobile');
      const panel = $('#previewPanel');
      if (!desktop || !mobile) return;

      const setMode = (isMobile) => {
        this.isPreviewMobile = isMobile;
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
        ['#f_title', '#f_slug', '#f_excerpt', '#f_image', '#f_metaTitle', '#f_metaDescription', '#f_tags'].forEach(s => {
          const el = $(s);
          if (el) el.value = '';
        });
        this.updatePreview();
        this.updateStats();
      });
    },

    loadSample() {
      const sample = `# Panduan Backlink High DA/DR 2026

**Backlink** adalah komponen vital dari strategi SEO yang sukses. Di tahun 2026, Google semakin canggih dalam menilai kualitas backlink.

## Apa Itu Backlink?

Backlink adalah tautan dari satu website ke website lain. Mereka bertindak sebagai *suara kepercayaan* dari satu situs ke situs lainnya.

> 💡 **Intinya:** Semakin banyak backlink berkualitas dari situs otoritatif, semakin tinggi kepercayaan Google terhadap website Anda.

## Mengapa Backlink Penting?

- **Peringkat Lebih Baik:** Google menggunakan backlink sebagai faktor peringkat utama
- **Lalu Lintas Organik:** Backlink mendatangkan traffic rujukan
- **Kredibilitas:** Backlink dari situs terpercaya meningkatkan otoritas
- **Indeks Lebih Cepat:** Bot mesin pencari menemukan halaman lebih cepat

## Jenis-Jenis Backlink

1. **Natural Backlink** — diperoleh organik ketika orang lain menemukan konten Anda berharga
2. **Manual Backlink** — melalui outreach ke pemilik situs lain
3. **Self-Created** — dibuat sendiri (hati-hati spam!)

## Contoh Kode

\`\`\`html
<a href="https://example.com" rel="noopener noreferrer">Backlink</a>
\`\`\`

## Kesimpulan

Fokus pada **kualitas** daripada kuantitas. 10 backlink dari situs DA 70+ jauh lebih berharga daripada 100 backlink spam.

---

Pelajari lebih lanjut di [WebLynk](https://weblynk.pages.dev).`;

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
      const pick = prompt(`Pilih snippet:\n${keys.map((k, i) => `${i + 1}. ${k}`).join('\n')}\n\nMasukkan nomor:`);
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

      // Prioritas: field 'markdown' → fallback ke 'content' (HTML → MD)
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

    getMarkdown() {
      return this.editor?.value || '';
    },

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

  // ============================================
  // EDITOR (TOOL/GAME)
  // ============================================
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

  // ============================================
  // OPEN EDITOR
  // ============================================
  function openEditor(type, id) {
    state.editingType = type;
    const pool = type === 'post' ? state.posts : state.tools;
    state.editing = id ? pool.find((i) => i.id === id) : null;

    const titleMap = { post: 'Artikel', tool: 'Tool', game: 'Game' };
    $('#editorTitle').textContent = (state.editing ? 'Edit ' : 'Tulis ') + titleMap[type];

    if (type === 'post') {
      // POST: Markdown editor
      $('#metaFields').classList.remove('hidden');
      $('#metaToggle').parentElement.querySelector('span').textContent = '⚙️ Metadata & SEO';
      $('#toolGamePanel').classList.add('hidden');
      $('#editorPanel').classList.remove('hidden');
      $('#previewPanel').classList.remove('hidden');
      $('#previewToggle').classList.remove('hidden');

      // Fill metadata
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

      // Init & load MD
      if (!MD.editor) MD.init();
      MD.load(state.editing);
      MD.markSaved();

    } else {
      // TOOL/GAME: form sederhana
      $('#metaFields').classList.add('hidden');
      $('#toolGamePanel').classList.remove('hidden');
      $('#editorFields').innerHTML = buildToolGameFields(type, state.editing || {});
      $('#editorPanel').classList.add('hidden');
      $('#previewPanel').classList.add('hidden');
      $('#previewToggle').classList.add('hidden');
    }

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

  // ============================================
  // SAVE ITEM
  // ============================================
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

      const contentHTML = MD.getHTML();
      const mdRaw = MD.getMarkdown();

      if (!mdRaw.trim()) return toast('Konten artikel kosong', 'warn');

      const plainText = mdRaw.replace(/[#*`>\[\]()!]/g, '').replace(/\s+/g, ' ').trim();

      item = {
        id: state.editing?.id || 'post-' + Date.now(),
        title,
        slug: val('#f_slug') || title.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, ''),
        excerpt: val('#f_excerpt') || plainText.slice(0, 160),
        content: contentHTML,
        markdown: mdRaw,
        category: val('#f_category') || 'SEO',
        tags: val('#f_tags').split(',').map(s => s.trim()).filter(Boolean),
        author: state.editing?.author || 'WebLynk Team',
        date: val('#f_date') || new Date().toISOString().slice(0, 10),
        image: val('#f_image'),
        featured: state.editing?.featured || false,
        metaTitle: val('#f_metaTitle') || title,
        metaDescription: val('#f_metaDescription') || (val('#f_excerpt') || plainText).slice(0, 160),
      };

      if (state.editing) {
        state.posts = state.posts.map(p => p.id === item.id ? item : p);
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
        state.tools = state.tools.map(t => t.id === item.id ? item : t);
      } else {
        state.tools.unshift(item);
      }
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

  // ============================================
  // DELETE ITEM
  // ============================================
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

  // ============================================
  // SEO CONFIG
  // ============================================
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

  // ============================================
  // GITHUB SETTINGS
  // ============================================
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

  // ============================================
  // LOAD DATA
  // ============================================
  async function loadData() {
    loadCache();

    try {
      const cfgR = await fetch('/content/config.json?t=' + Date.now());
      if (cfgR.ok) {
        state.config = await cfgR.json();
        fillSEOForm();
      }
    } catch (e) { console.warn('Config load failed', e); }

    try {
      const r = await fetch('/content/posts.json?t=' + Date.now());
      if (r.ok) state.posts = (await r.json()).posts || [];
    } catch (e) { console.warn('Posts load failed', e); }

    try {
      const r = await fetch('/content/tools.json?t=' + Date.now());
      if (r.ok) state.tools = (await r.json()).tools || [];
    } catch (e) { console.warn('Tools load failed', e); }

    saveCache();
    renderLists();
    updateAuthBadge();
  }

  // ============================================
  // TABS
  // ============================================
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

  // ============================================
  // GLOBAL EVENTS
  // ============================================
  function bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, type, id } = btn.dataset;
      if (action === 'edit') openEditor(type, id);
      if (action === 'delete') deleteItem(type, id);
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
        if (!$('#editorModal').classList.contains('hidden')) {
          if (state.editingType === 'post') saveItem();
          else saveItem();
        }
      }
    });
  }

  // ============================================
  // EXPOSE GLOBAL
  // ============================================
  window.openEditor = openEditor;
  window.closeEditor = closeEditor;
  window.saveItem = saveItem;
  window.deleteItem = deleteItem;
  window.saveSEOConfig = saveSEOConfig;
  window.saveGitHubSettings = saveGitHubSettings;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.WebLynkMD = MD;

  // ============================================
  // BOOT
  // ============================================
  document.addEventListener('DOMContentLoaded', () => {
    bindTabs();
    bindGlobalEvents();
    $('#settingsBtn')?.addEventListener('click', openSettings);

    // Init MD editor sebelum load data
    MD.init();

    loadData();
  });
})();