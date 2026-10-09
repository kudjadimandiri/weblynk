/* ============================================
   WebLynk AdSense — Render + Auto Reload
   ============================================ */

(function () {
  'use strict';

  const CACHE_KEY = 'weblynk_adsense_config';
  const CACHE_TTL = 5 * 60 * 1000;

  let config = null;
  let reloadTimer = null;
  let reloadCount = 0;
  let initialized = false;

  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

  function getCache() {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
      if (c.ts && Date.now() - c.ts < CACHE_TTL) return c.data;
    } catch {}
    return null;
  }

  function setCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  }

  async function loadConfig() {
    const cached = getCache();
    if (cached) return cached;

    try {
      const r = await fetch('/content/config.json?t=' + Date.now());
      if (!r.ok) throw new Error('Config not found');
      const cfg = await r.json();
      const ads = cfg.adsense || { enabled: false };
      setCache(ads);
      return ads;
    } catch (e) {
      console.warn('[WebLynk Ads] Gagal load config:', e);
      return { enabled: false };
    }
  }

  function loadAdSenseScript(clientId) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="adsbygoogle.js"]')) {
        return resolve();
      }
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
      script.onload = () => { console.log('[WebLynk Ads] Script loaded'); resolve(); };
      script.onerror = () => { console.warn('[WebLynk Ads] Script failed'); reject(new Error('failed')); };
      document.head.appendChild(script);
    });
  }

  function createAdSlot(slotId, format = 'auto', options = {}) {
    const {
      layout = '',
      style = 'display:block',
      fullWidth = true,
      className = '',
    } = options;

    const wrap = document.createElement('div');
    wrap.className = `weblynk-ad-slot ${className}`;
    wrap.dataset.slotId = slotId;
    wrap.style.margin = '16px 0';
    wrap.style.textAlign = 'center';

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.style.textAlign = 'center';
    ins.setAttribute('data-ad-client', config.clientId);
    ins.setAttribute('data-ad-slot', slotId);
    ins.setAttribute('data-ad-format', format);
    if (fullWidth) ins.setAttribute('data-full-width-responsive', 'true');
    if (layout) ins.setAttribute('data-ad-layout', layout);

    wrap.appendChild(ins);
    return wrap;
  }

  function pushAd(wrap) {
    if (!wrap) return;
    if (wrap.dataset.rendered === '1') return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      wrap.dataset.rendered = '1';
      console.log('[WebLynk Ads] Rendered:', wrap.dataset.slotId);
    } catch (e) {
      console.warn('[WebLynk Ads] Push error:', e);
    }
  }

  // ---------- RENDER HEADER ----------
  function renderHeaderAd() {
    if (!config.position?.headerOn || !config.slots?.header) return;
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    if (!header || !main) return;
    if (document.getElementById('weblynk-ad-header')) return;

    const wrap = createAdSlot(config.slots.header, 'horizontal');
    wrap.id = 'weblynk-ad-header';

    const container = document.createElement('div');
    container.className = 'mx-auto max-w-6xl px-4 py-2 sm:px-6';
    container.appendChild(wrap);

    header.insertAdjacentElement('afterend', container);
    pushAd(wrap);
  }

  // ---------- RENDER SIDEBAR ----------
  function renderSidebarAd() {
    if (!config.position?.sidebarOn || !config.slots?.sidebar) return;
    const aside = document.querySelector('aside');
    if (!aside) return;
    if (aside.querySelector('.weblynk-ad-sidebar')) return;

    const wrap = createAdSlot(config.slots.sidebar, 'auto');
    wrap.classList.add('weblynk-ad-sidebar');

    const container = document.createElement('div');
    container.className = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
    container.innerHTML = `<p class="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Iklan</p>`;
    container.appendChild(wrap);
    aside.appendChild(container);
    pushAd(wrap);
  }

  // ---------- RENDER IN-ARTICLE ----------
  function renderInArticleAd() {
    if (!config.position?.inArticleOn || !config.slots?.inArticle) return;
    const content = document.getElementById('postContent');
    if (!content) return;
    if (content.querySelector('.weblynk-ad-in-article')) return;

    const paragraphs = content.querySelectorAll('p');
    const insertAfter = (config.inArticleParagraph || 3) - 1;
    if (paragraphs.length < insertAfter + 1) return;

    const wrap = createAdSlot(config.slots.inArticle, 'fluid', { layout: 'in-article' });
    wrap.classList.add('weblynk-ad-in-article');

    const container = document.createElement('div');
    container.className = 'my-6';
    container.appendChild(wrap);
    paragraphs[insertAfter].insertAdjacentElement('afterend', container);
    pushAd(wrap);
  }

  // ---------- RENDER FOOTER ----------
  function renderFooterAd() {
    if (!config.position?.footerOn || !config.slots?.footer) return;
    const footer = document.querySelector('footer');
    const main = document.querySelector('main');
    if (!footer || !main) return;
    if (document.getElementById('weblynk-ad-footer')) return;

    const wrap = createAdSlot(config.slots.footer, 'horizontal');
    wrap.id = 'weblynk-ad-footer';

    const container = document.createElement('div');
    container.className = 'mx-auto max-w-6xl px-4 py-4 sm:px-6';
    container.appendChild(wrap);
    main.insertAdjacentElement('afterend', container);
    pushAd(wrap);
  }

  // ---------- REFRESH ----------
  function refreshAds() {
    reloadCount++;
    console.log(`[WebLynk Ads] Auto-reload #${reloadCount} @ ${new Date().toLocaleTimeString()}`);

    const slots = $$('.weblynk-ad-slot ins.adsbygoogle');
    let refreshed = 0;

    slots.forEach((ins) => {
      const wrap = ins.closest('.weblynk-ad-slot');
      if (!wrap) return;

      try {
        ins.setAttribute('data-ad-status', 'unfilled');
        ins.innerHTML = '';
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        refreshed++;
      } catch (e) {
        console.warn('[WebLynk Ads] Refresh error:', e);
      }
    });

    if (refreshed === 0) {
      renderAllAds();
    }
  }

  function startAutoReload() {
    if (!config.autoReload) return;
    if (reloadTimer) clearInterval(reloadTimer);
    const interval = Math.max(10000, config.reloadInterval || 30000);
    reloadTimer = setInterval(refreshAds, interval);
    console.log(`[WebLynk Ads] Auto-reload ON: ${interval / 1000}s`);
  }

  function stopAutoReload() {
    if (reloadTimer) {
      clearInterval(reloadTimer);
      reloadTimer = null;
      console.log('[WebLynk Ads] Auto-reload OFF');
    }
  }

  function bindVisibilityControl() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoReload();
      else if (config.autoReload) startAutoReload();
    });
  }

  function renderAllAds() {
    renderHeaderAd();
    renderSidebarAd();
    renderInArticleAd();
    renderFooterAd();
  }

  async function init() {
    if (initialized) return;
    initialized = true;

    config = await loadConfig();

    if (!config.enabled || !config.clientId || config.clientId.includes('XXXXXX')) {
      console.log('[WebLynk Ads] Disabled atau belum dikonfigurasi');
      return;
    }

    try {
      await loadAdSenseScript(config.clientId);
    } catch (e) {
      console.warn('[WebLynk Ads] Script gagal load');
      return;
    }

    setTimeout(() => {
      renderAllAds();
      setTimeout(renderAllAds, 1500);
    }, 500);

    startAutoReload();
    bindVisibilityControl();

    window.WebLynkAds = {
      refresh: refreshAds,
      start: startAutoReload,
      stop: stopAutoReload,
      render: renderAllAds,
      getConfig: () => config,
      reload: () => { initialized = false; init(); },
    };

    console.log('[WebLynk Ads] Initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();