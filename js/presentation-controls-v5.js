/* Acadex Presentation Controls V6-safe core — no MutationObserver feedback loops */
(function () {
  'use strict';
  if (window.__acadexPresentationControlsV6Safe) return;
  window.__acadexPresentationControlsV6Safe = true;

  const style = document.createElement('style');
  style.id = 'acadex-presentation-v6-safe-style';
  style.textContent = `
    /* Never block the editor with an endless media spinner. */
    #pres-media-loading{display:none!important}

    /* If the structured preview has real content, hide the decorative empty-state completely. */
    #pres-layout-placeholder.has-live-component #pres-component-empty,
    #pres-layout-placeholder.has-live-component #pres-layout-placeholder-title,
    #pres-layout-placeholder.has-live-component #pres-layout-placeholder-hint{display:none!important}
    #pres-layout-placeholder.has-live-component{padding:.35rem!important;background:transparent!important}
    #pres-layout-placeholder.has-live-component #pres-component-preview{display:block!important;width:100%!important;height:100%!important;min-height:240px!important}

    /* Give the image itself the whole media pane. */
    #pres-media-placeholder.has-live-image #pres-media-empty{display:none!important}
    #pres-media-placeholder.has-live-image #pres-slide-image{display:block!important;opacity:1!important;visibility:visible!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}
  `;
  document.head.appendChild(style);

  const timers = new WeakMap();
  let mediaRequestId = 0;

  function getSlides() {
    try { return Array.isArray(presSlides) ? presSlides : []; } catch (_) { return []; }
  }

  function getActiveSlide() {
    try {
      const deck = getSlides();
      return deck[Number.isInteger(presActiveSlide) ? presActiveSlide : 0] || null;
    } catch (_) { return null; }
  }

  function clearPending(el) {
    const list = timers.get(el) || [];
    list.forEach(id => clearTimeout(id));
    timers.delete(el);
  }

  function schedule(el, fn, delays) {
    if (!el) return;
    clearPending(el);
    const list = delays.map(ms => setTimeout(fn, ms));
    timers.set(el, list);
  }

  function previewHasRealContent(preview) {
    if (!preview || preview.hidden) return false;
    if (preview.querySelector('table, canvas, svg, img, .pres-slide-table, .pres-slide-chart, .pres-v2-cards, .pres-v2-process, .pres-v2-timeline, .pres-v2-metric, article')) return true;
    const text = String(preview.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length > 12;
  }

  function syncStructuredComponent() {
    const holder = document.getElementById('pres-layout-placeholder');
    const empty = document.getElementById('pres-component-empty');
    const preview = document.getElementById('pres-component-preview');
    const title = document.getElementById('pres-layout-placeholder-title');
    const hint = document.getElementById('pres-layout-placeholder-hint');
    if (!holder || !preview) return;

    const slide = getActiveSlide();
    const structured = !!(
      slide?.content?.table?.rows?.length ||
      slide?.content?.chart?.labels?.length ||
      slide?.content?.cards?.length ||
      slide?.content?.steps?.length ||
      slide?.content?.metric
    );
    const rendered = previewHasRealContent(preview);
    const live = structured || rendered;

    holder.classList.toggle('has-live-component', live);
    if (live) {
      if (empty) { empty.hidden = true; empty.style.display = 'none'; }
      if (title) title.style.display = 'none';
      if (hint) hint.style.display = 'none';
      preview.hidden = false;
      preview.style.display = 'block';
    } else {
      holder.classList.remove('has-live-component');
      if (empty) { empty.hidden = false; empty.style.removeProperty('display'); }
      if (title) title.style.removeProperty('display');
      if (hint) hint.style.removeProperty('display');
    }
  }

  async function resolveImageWithoutSpinner(slide, image, empty, holder) {
    let path = '';
    try {
      path = typeof getPresentationImagePath === 'function' ? String(getPresentationImagePath(slide) || '') : '';
    } catch (_) {}

    const existingSrc = String(image?.getAttribute('src') || '').trim();
    if (existingSrc) {
      image.hidden = false;
      image.style.display = 'block';
      holder?.classList.add('has-live-image');
      if (empty) { empty.hidden = true; empty.style.display = 'none'; }
      return;
    }

    if (!path) {
      holder?.classList.remove('has-live-image');
      if (image) { image.hidden = true; image.style.removeProperty('display'); }
      if (empty) { empty.hidden = false; empty.style.removeProperty('display'); }
      return;
    }

    if (typeof getPresentationImageUrl !== 'function') {
      if (empty) { empty.hidden = false; empty.style.removeProperty('display'); }
      return;
    }

    const requestId = ++mediaRequestId;
    try {
      const url = await Promise.race([
        getPresentationImageUrl(path),
        new Promise((_, reject) => setTimeout(() => reject(new Error('image-timeout')), 4500))
      ]);
      if (requestId !== mediaRequestId) return;
      if (url && image) {
        image.src = url;
        image.hidden = false;
        image.style.display = 'block';
        holder?.classList.add('has-live-image');
        if (empty) { empty.hidden = true; empty.style.display = 'none'; }
      } else if (empty) {
        empty.hidden = false;
        empty.style.removeProperty('display');
      }
    } catch (_) {
      if (requestId !== mediaRequestId) return;
      holder?.classList.remove('has-live-image');
      if (empty) { empty.hidden = false; empty.style.removeProperty('display'); }
    }
  }

  function settleMedia() {
    const loading = document.getElementById('pres-media-loading');
    const image = document.getElementById('pres-slide-image');
    const empty = document.getElementById('pres-media-empty');
    const holder = document.getElementById('pres-media-placeholder') || image?.parentElement || empty?.parentElement;

    /* The spinner is intentionally non-blocking in V6. */
    if (loading) {
      loading.hidden = true;
      loading.style.display = 'none';
      loading.setAttribute('aria-hidden', 'true');
    }

    const slide = getActiveSlide();
    if (!slide) {
      if (empty) { empty.hidden = false; empty.style.removeProperty('display'); }
      return;
    }

    const src = String(image?.getAttribute('src') || '').trim();
    if (src) {
      image.hidden = false;
      image.style.display = 'block';
      holder?.classList.add('has-live-image');
      if (empty) { empty.hidden = true; empty.style.display = 'none'; }
      return;
    }

    resolveImageWithoutSpinner(slide, image, empty, holder);
  }

  function runPostRender() {
    syncStructuredComponent();
    settleMedia();

    const holder = document.getElementById('pres-studio-mode') || document.body;
    schedule(holder, () => {
      syncStructuredComponent();
      settleMedia();
    }, [60, 260, 900, 2200, 4800]);
  }

  function patchGlobalRenderer(name, after) {
    const current = window[name];
    if (typeof current !== 'function' || current.__acadexV6Wrapped) return false;
    const wrapped = function () {
      const result = current.apply(this, arguments);
      try { after(); } catch (_) {}
      return result;
    };
    wrapped.__acadexV6Wrapped = true;
    window[name] = wrapped;
    return true;
  }

  function patchRenderers() {
    patchGlobalRenderer('renderActivePresentationSlide', runPostRender);
    patchGlobalRenderer('renderPresentationRichContent', syncStructuredComponent);
    patchGlobalRenderer('renderPresentationSlideMedia', settleMedia);
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#presentation-view, #pres-studio-mode')) return;
    if (event.target.closest('.pres-layout-btn, .pres-slide-item, #pres-add-slide-btn, #pres-component-actions, #pres-media-actions')) {
      setTimeout(runPostRender, 0);
      setTimeout(runPostRender, 180);
      setTimeout(runPostRender, 900);
    }
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest('#presentation-view, #pres-studio-mode')) return;
    setTimeout(runPostRender, 40);
    setTimeout(runPostRender, 500);
    setTimeout(runPostRender, 1800);
  }, true);

  function start() {
    patchRenderers();
    runPostRender();
    let attempts = 0;
    const installer = setInterval(() => {
      patchRenderers();
      if (++attempts >= 24) clearInterval(installer);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.AcadexPresentationControlsV6Safe = {
    refresh: runPostRender,
    syncStructured: syncStructuredComponent,
    settleMedia
  };
})();
