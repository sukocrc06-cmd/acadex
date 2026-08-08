/* Acadex Presentation Controls V7 — event-driven preview/media; no MutationObserver */
(function () {
  'use strict';
  if (window.__acadexPresentationControlsV7) return;
  window.__acadexPresentationControlsV7 = true;

  const M = () => window.AcadexPresentationModelV7;
  const esc = (v) => M()?.esc(v) || String(v == null ? '' : v);

  function slides() {
    try { return Array.isArray(presSlides) ? presSlides : []; } catch (_) { return []; }
  }
  function currentIndex() {
    try { return Number.isInteger(presActiveSlide) ? Math.max(0, Math.min(presActiveSlide, slides().length - 1)) : 0; } catch (_) { return 0; }
  }
  function currentSlide() { return slides()[currentIndex()] || null; }

  function repairDeck() {
    const m = M();
    if (!m) return;
    slides().forEach((slide, index) => {
      const repaired = window.AcadexPresentationRendererV7?.repairSlide
        ? window.AcadexPresentationRendererV7.repairSlide(slide, index)
        : m.normalize(slide, index);
      slides()[index] = repaired;
    });
  }

  // Event-driven repair: no DOM mutation observer, therefore no feedback loop.
  const originalActiveRender = window.renderActivePresentationSlide;
  if (typeof originalActiveRender === 'function') {
    window.renderActivePresentationSlide = function () {
      const list = slides();
      const index = currentIndex();
      if (list[index] && window.AcadexPresentationRendererV7?.repairSlide) {
        list[index] = window.AcadexPresentationRendererV7.repairSlide(list[index], index);
      }
      return originalActiveRender.apply(this, arguments);
    };
  }

  const originalListRender = window.renderPresentationSlidesList;
  if (typeof originalListRender === 'function') {
    window.renderPresentationSlidesList = function () {
      repairDeck();
      return originalListRender.apply(this, arguments);
    };
  }

  function setMediaState({ image, empty, actions, loading, url, slide }) {
    if (loading) loading.hidden = true; // V7 never uses a permanent spinner.
    if (url) {
      image.src = url;
      image.alt = slide?.content?.image?.alt || slide?.title || 'Sunum görseli';
      image.hidden = false;
      empty.hidden = true;
      actions.hidden = false;
    } else {
      image.hidden = true;
      image.removeAttribute('src');
      empty.hidden = false;
      actions.hidden = true;
    }
  }

  window.renderPresentationMedia = async function (slide) {
    const image = document.getElementById('pres-slide-image');
    const empty = document.getElementById('pres-media-empty');
    const actions = document.getElementById('pres-media-actions');
    const loading = document.getElementById('pres-media-loading');
    if (!image || !empty || !actions) return;

    setMediaState({ image, empty, actions, loading, url: '', slide });
    let path = '';
    try { path = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(slide) : ''; } catch (_) {}
    if (!path) return;

    const key = slide?._localKey;
    try {
      const url = await Promise.race([
        Promise.resolve(typeof getPresentationImageUrl === 'function' ? getPresentationImageUrl(path) : ''),
        new Promise((resolve) => setTimeout(() => resolve(''), 5000))
      ]);
      const active = currentSlide();
      if (key && active?._localKey && key !== active._localKey) return;
      setMediaState({ image, empty, actions, loading, url, slide });
      if (!url && typeof showPresentationUploadMessage === 'function') {
        showPresentationUploadMessage('Görsel yüklenemedi. Yeni bir görsel seçebilirsiniz.', true);
      }
    } catch (error) {
      console.error('Presentation media V7:', error);
      setMediaState({ image, empty, actions, loading, url: '', slide });
    }
  };

  const originalImageBusy = window.setPresentationImageBusy;
  window.setPresentationImageBusy = function (busy) {
    let result;
    if (typeof originalImageBusy === 'function') result = originalImageBusy.apply(this, arguments);
    const loading = document.getElementById('pres-media-loading');
    // Only a real upload may briefly set busy. Force-stop the animation after 4s.
    if (loading) {
      loading.hidden = !busy;
      if (busy) setTimeout(() => { if (loading) loading.hidden = true; }, 4000);
    }
    return result;
  };

  function previewStyles() {
    return `
      #acadex-presentation-preview-v7{position:fixed;inset:0;z-index:300000;background:#071827f2;color:#fff;font-family:Inter,Arial,sans-serif;display:grid;grid-template-rows:58px minmax(0,1fr)}
      .ap7p-top{display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#0b2238;border-bottom:1px solid #ffffff18}.ap7p-top strong{font-size:14px}.ap7p-top button{border:1px solid #ffffff35;background:#ffffff12;color:#fff;border-radius:9px;padding:8px 12px;cursor:pointer;font-weight:800}
      .ap7p-stage{display:grid;grid-template-columns:58px minmax(0,1fr) 58px;gap:14px;align-items:center;min-height:0;padding:18px}.ap7p-nav{height:48px;border:0;border-radius:50%;background:#ffffff18;color:#fff;font-size:25px;cursor:pointer}.ap7p-nav:disabled{opacity:.25}
      .ap7p-center{height:100%;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:10px;align-items:center}.ap7p-slide{aspect-ratio:16/9;width:min(1180px,calc(100vw - 180px),calc((100vh - 205px)*1.777));max-height:calc(100vh - 205px);margin:auto;background:#fff;color:#16325c;border-radius:18px;box-shadow:0 30px 80px #0008;padding:4.5% 5.5%;overflow:hidden;position:relative}.ap7p-slide h1{font-size:clamp(23px,2.7vw,42px);line-height:1.08;letter-spacing:-.03em;margin:0 0 14px}.ap7p-rule{width:72px;height:4px;border-radius:99px;background:#0d9488;margin-bottom:19px}.ap7p-body{height:calc(100% - 92px);min-height:0;overflow:hidden}
      .ap7p-body .ap7-combo{height:100%;grid-template-columns:.9fr 1.1fr;gap:22px}.ap7p-body .ap7-bullets{font-size:clamp(13px,1.25vw,20px);gap:10px}.ap7p-body .ap7-cols{font-size:clamp(12px,1.08vw,18px)}.ap7p-body .ap7-table{font-size:clamp(10px,.9vw,15px)}.ap7p-body .ap7-cards article{padding:14px}.ap7p-body .ap7-cards strong{font-size:clamp(11px,1vw,17px)}.ap7p-body .ap7-cards p{font-size:clamp(9px,.83vw,14px)}.ap7p-body .ap7-steps strong,.ap7p-body .ap7-diagram strong{font-size:clamp(10px,.9vw,15px)}.ap7p-body .ap7-steps p,.ap7p-body .ap7-diagram p{font-size:clamp(8px,.75vw,13px)}
      .ap7p-image{position:absolute;right:4.5%;bottom:4.5%;max-width:30%;max-height:34%;object-fit:contain;border-radius:13px;box-shadow:0 8px 24px #0f172a22}.ap7p-count{position:absolute;right:4%;bottom:2.4%;font-size:10px;color:#94a3b8}
      .ap7p-notes{width:min(1180px,calc(100vw - 180px));margin:0 auto;background:#102b43;border:1px solid #ffffff1c;border-radius:12px;padding:10px 14px;max-height:92px;overflow:auto}.ap7p-notes strong{display:block;color:#5eead4;text-transform:uppercase;letter-spacing:.06em;font-size:10px;margin-bottom:4px}.ap7p-notes p{margin:0;color:#e2e8f0;font-size:12px;line-height:1.42}
      @media(max-width:850px){.ap7p-stage{grid-template-columns:42px 1fr 42px;padding:8px}.ap7p-slide{width:calc(100vw - 108px);padding:5%}.ap7p-notes{width:calc(100vw - 108px)}.ap7p-body .ap7-combo{grid-template-columns:1fr}.ap7p-body .ap7-visual{display:none}}
    `;
  }

  async function hydrateImage(root, slide) {
    let path = '';
    try { path = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(slide) : ''; } catch (_) {}
    if (!path) return;
    const img = root.querySelector('[data-ap7-preview-image]');
    if (!img) return;
    try {
      const url = await Promise.race([
        getPresentationImageUrl(path),
        new Promise((resolve) => setTimeout(() => resolve(''), 5000))
      ]);
      if (url) { img.src = url; img.hidden = false; }
    } catch (_) {}
  }

  function openPreview() {
    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    repairDeck();
    const deck = slides();
    if (!deck.length || !M()) return;
    document.getElementById('acadex-presentation-preview-v7')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'acadex-presentation-preview-v7';
    const deckTitle = (() => { try { return presCurrentPresentation?.title || 'Acadex Sunum'; } catch (_) { return 'Acadex Sunum'; } })();
    overlay.innerHTML = `<style>${previewStyles()}</style><div class="ap7p-top"><strong>${esc(deckTitle)}</strong><div><span id="ap7p-index"></span>&nbsp;&nbsp;<button id="ap7p-close" type="button">Kapat ✕</button></div></div><div class="ap7p-stage"><button class="ap7p-nav" id="ap7p-prev" type="button">‹</button><div class="ap7p-center"><div id="ap7p-host"></div><div class="ap7p-notes"><strong>Konuşma Notları</strong><p id="ap7p-notes-text"></p></div></div><button class="ap7p-nav" id="ap7p-next" type="button">›</button></div>`;
    document.body.appendChild(overlay);

    let index = currentIndex();
    const host = overlay.querySelector('#ap7p-host');
    const counter = overlay.querySelector('#ap7p-index');
    const notes = overlay.querySelector('#ap7p-notes-text');
    const prev = overlay.querySelector('#ap7p-prev');
    const next = overlay.querySelector('#ap7p-next');

    const draw = () => {
      const slide = M().normalize(deck[index], index);
      let imagePath = '';
      try { imagePath = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(slide) : ''; } catch (_) {}
      host.innerHTML = `<section class="ap7p-slide"><h1>${esc(slide.title)}</h1><div class="ap7p-rule"></div><div class="ap7p-body">${M().renderBody(slide)}</div>${imagePath ? '<img class="ap7p-image" data-ap7-preview-image hidden alt="Sunum görseli">' : ''}<span class="ap7p-count">${index + 1} / ${deck.length}</span></section>`;
      notes.textContent = slide.speaker_notes || 'Bu slayt için konuşma notu eklenmemiş.';
      counter.textContent = `${index + 1} / ${deck.length}`;
      prev.disabled = index === 0;
      next.disabled = index === deck.length - 1;
      void hydrateImage(host, slide);
    };

    overlay.querySelector('#ap7p-close').onclick = () => overlay.remove();
    prev.onclick = () => { if (index > 0) { index -= 1; draw(); } };
    next.onclick = () => { if (index < deck.length - 1) { index += 1; draw(); } };
    const keyHandler = (event) => {
      if (!document.getElementById('acadex-presentation-preview-v7')) { document.removeEventListener('keydown', keyHandler); return; }
      if (event.key === 'Escape') overlay.remove();
      if (event.key === 'ArrowLeft' && index > 0) { index -= 1; draw(); }
      if (event.key === 'ArrowRight' && index < deck.length - 1) { index += 1; draw(); }
    };
    document.addEventListener('keydown', keyHandler);
    draw();
  }

  function expandStudio() {
    if (document.getElementById('acadex-presentation-v7-workspace-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-presentation-v7-workspace-style';
    style.textContent = `
      #pres-studio-mode{min-height:calc(100vh - 120px)!important;height:auto!important;padding-bottom:10px!important}
      #pres-studio-mode .pres-studio-grid,#pres-studio-mode .pres-editor-grid{min-height:calc(100vh - 245px)!important;grid-template-columns:minmax(175px,.72fr) minmax(520px,2.35fr) minmax(235px,1fr)!important;gap:12px!important}
      #pres-studio-mode .pres-canvas,#pres-studio-mode .pres-editor-canvas{min-height:560px!important}
      #pres-media-loading[hidden]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function bind() {
    expandStudio();
    repairDeck();
    const preview = document.getElementById('pres-preview-btn');
    if (preview && preview.dataset.previewV7 !== '1') {
      preview.dataset.previewV7 = '1';
      preview.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPreview();
      }, true);
    }

    document.querySelectorAll('.pres-layout-btn[data-layout="image-left"],.pres-layout-btn[data-layout="image-right"]').forEach((button) => {
      if (button.dataset.mediaV7 === '1') return;
      button.dataset.mediaV7 = '1';
      button.addEventListener('click', () => {
        setTimeout(() => {
          const loading = document.getElementById('pres-media-loading');
          const empty = document.getElementById('pres-media-empty');
          if (loading) loading.hidden = true;
          let path = '';
          try { path = typeof getPresentationImagePath === 'function' ? getPresentationImagePath(currentSlide()) : ''; } catch (_) {}
          if (!path && empty) empty.hidden = false;
        }, 0);
      });
    });
  }

  window.AcadexPresentationControlsV7 = { preview: openPreview, repair: repairDeck };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
