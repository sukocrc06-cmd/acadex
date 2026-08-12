/* Acadex Presentation HD Quality V9
   After generation, slide view renders at true 16:9 HD design resolution
   (1280×720 base, GPU-scaled) so text, charts and images stay crisp.
   Also: high-quality image rendering, sharper canvas chrome, fullscreen Present mode.
*/
(function () {
  'use strict';
  if (window.__acadexPresentationHdV9) return;
  window.__acadexPresentationHdV9 = true;

  const DESIGN_W = 1280;
  const DESIGN_H = 720;
  const STYLE_ID = 'acadex-pres-hd-v9-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ===== HD Canvas shell ===== */
      .pres-canvas-wrap {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 1.1rem !important;
        background: linear-gradient(160deg, #e8eef5 0%, #f1f5f9 45%, #e2e8f0 100%) !important;
        overflow: auto !important;
        min-height: 0 !important;
      }

      /* Fixed design resolution — scaled by JS for pixel-perfect sharpness */
      .pres-canvas.pres-hd-ready {
        width: ${DESIGN_W}px !important;
        height: ${DESIGN_H}px !important;
        min-height: ${DESIGN_H}px !important;
        max-width: none !important;
        aspect-ratio: unset !important;
        flex: 0 0 auto !important;
        transform-origin: center center !important;
        will-change: transform;
        border-radius: 10px !important;
        box-shadow:
          0 0 0 1px rgba(15, 23, 42, 0.06),
          0 12px 40px rgba(15, 23, 42, 0.14),
          0 2px 8px rgba(15, 23, 42, 0.06) !important;
        padding: 48px 56px !important;
        background: #ffffff !important;
        overflow: hidden !important;
        /* Crisp text on high-DPI */
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }

      /* Title & body typography tuned for 1280×720 stage */
      .pres-canvas.pres-hd-ready .pres-slide-title {
        font-size: 36px !important;
        line-height: 1.2 !important;
        letter-spacing: -0.02em !important;
        margin-bottom: 20px !important;
        font-weight: 800 !important;
      }
      .pres-canvas.pres-hd-ready .pres-slide-content,
      .pres-canvas.pres-hd-ready .pres-slide-content-secondary {
        font-size: 18px !important;
        line-height: 1.45 !important;
      }
      .pres-canvas.pres-hd-ready .pres-field-label {
        font-size: 12px !important;
        letter-spacing: 0.04em !important;
      }
      .pres-canvas.pres-hd-ready .pres-layout-placeholder {
        min-height: 220px !important;
      }
      .pres-canvas.pres-hd-ready .pres-component-preview {
        font-size: 14px !important;
      }

      /* HD media */
      .pres-canvas.pres-hd-ready .pres-media-image,
      .pres-canvas.pres-hd-ready #pres-slide-image {
        image-rendering: -webkit-optimize-contrast;
        image-rendering: high-quality;
        object-fit: contain !important;
        max-width: 100% !important;
        max-height: 100% !important;
        border-radius: 8px;
      }
      .pres-canvas.pres-hd-ready .pres-layout-visual {
        min-height: 280px !important;
      }

      /* Speaker notes sit outside the scaled stage (keep original size) */
      .pres-canvas.pres-hd-ready + .pres-speaker-notes,
      .pres-canvas-wrap .pres-speaker-notes {
        /* notes remain under the scaled canvas via layout */
      }

      /* Thumbnails slightly richer */
      .pres-slide-thumb-preview {
        height: 56px !important;
        font-size: 0.7rem !important;
        background: linear-gradient(180deg, #fff 0%, #f8fafc 100%) !important;
      }

      /* Present mode overlay */
      #pres-hd-present-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: #0b1220;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #e2e8f0;
        font-family: inherit;
      }
      #pres-hd-present-overlay.is-open { display: flex; }
      #pres-hd-present-stage {
        width: min(96vw, calc(96vh * 16 / 9));
        aspect-ratio: 16 / 9;
        background: #fff;
        border-radius: 6px;
        box-shadow: 0 25px 80px rgba(0,0,0,0.55);
        overflow: hidden;
        position: relative;
        color: #0f172a;
      }
      #pres-hd-present-stage .phd-slide {
        position: absolute;
        inset: 0;
        padding: 4.2% 5%;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        background: #fff;
      }
      #pres-hd-present-stage .phd-title {
        font-size: clamp(22px, 3.2vw, 42px);
        font-weight: 800;
        color: #16325c;
        margin: 0 0 1.1% 0;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }
      #pres-hd-present-stage .phd-rule {
        width: 72px;
        height: 4px;
        background: #0d9488;
        border-radius: 2px;
        margin-bottom: 2.2%;
        flex-shrink: 0;
      }
      #pres-hd-present-stage .phd-body {
        flex: 1;
        min-height: 0;
        font-size: clamp(14px, 1.55vw, 22px);
        line-height: 1.45;
        color: #24364b;
        overflow: hidden;
        white-space: pre-wrap;
      }
      #pres-hd-present-stage .phd-body ul {
        margin: 0;
        padding-left: 1.2em;
      }
      #pres-hd-present-stage .phd-body li { margin-bottom: 0.35em; }
      #pres-hd-present-stage .phd-footer {
        position: absolute;
        right: 2.5%;
        bottom: 2%;
        font-size: 12px;
        color: #94a3b8;
        font-weight: 600;
      }
      #pres-hd-present-bar {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.85rem 1rem;
        background: linear-gradient(transparent, rgba(0,0,0,0.55));
        opacity: 0;
        transition: opacity 0.2s;
      }
      #pres-hd-present-overlay:hover #pres-hd-present-bar,
      #pres-hd-present-bar:focus-within { opacity: 1; }
      #pres-hd-present-bar button {
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(15,23,42,0.7);
        color: #f8fafc;
        border-radius: 8px;
        padding: 0.45rem 0.9rem;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
      }
      #pres-hd-present-bar button:hover { background: rgba(13,148,136,0.85); border-color: #0d9488; }
      #pres-hd-present-counter {
        color: rgba(255,255,255,0.75);
        font-size: 0.8rem;
        font-weight: 600;
        min-width: 4.5rem;
        text-align: center;
      }

      /* Toolbar HD Present button */
      #pres-hd-present-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
    `;
    document.head.appendChild(style);
  }

  function getCanvas() {
    return document.getElementById('pres-canvas');
  }

  function getWrap() {
    return document.querySelector('.pres-canvas-wrap');
  }

  function fitCanvas() {
    const canvas = getCanvas();
    const wrap = getWrap();
    if (!canvas || !wrap) return;

    canvas.classList.add('pres-hd-ready');

    // Available space inside wrap (subtract padding roughly)
    const rect = wrap.getBoundingClientRect();
    const pad = 28;
    const availW = Math.max(280, rect.width - pad);
    const availH = Math.max(200, rect.height - pad);

    const scale = Math.min(availW / DESIGN_W, availH / DESIGN_H, 1);
    // Keep a tiny margin so shadow isn't clipped
    const s = Math.max(0.28, Math.round(scale * 1000) / 1000);

    canvas.style.transform = `scale(${s})`;
    // Compensate layout space so flex/scroll doesn't reserve full 1280px
    canvas.style.marginBottom = `${(DESIGN_H * (s - 1))}px`;
    canvas.style.marginRight = `${(DESIGN_W * (s - 1))}px`;
    // Center via transform already; wrap is flex-centered
    canvas.dataset.hdScale = String(s);
  }

  let fitRaf = 0;
  function scheduleFit() {
    if (fitRaf) cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(() => {
      fitRaf = 0;
      fitCanvas();
    });
  }

  function observeResize() {
    const wrap = getWrap();
    if (!wrap || wrap.__hdObserved) return;
    wrap.__hdObserved = true;
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => scheduleFit());
      ro.observe(wrap);
    }
    window.addEventListener('resize', scheduleFit, { passive: true });
  }

  // ---------- Fullscreen Present mode ----------
  let presentIndex = 0;
  let presentKeyHandler = null;

  function getSlides() {
    try {
      if (Array.isArray(window.presSlides) && window.presSlides.length) return window.presSlides;
    } catch (_) {}
    try {
      // lexical in dashboard.js
      if (typeof presSlides !== 'undefined' && Array.isArray(presSlides)) return presSlides;
    } catch (_) {}
    return [];
  }

  function slideTitle(slide) {
    return String(slide?.title || '').trim() || 'Slayt';
  }

  function slideBodyText(slide) {
    if (typeof window.getPresentationSlideText === 'function') {
      try { return window.getPresentationSlideText(slide) || ''; } catch (_) {}
    }
    const c = slide?.content;
    if (!c) return '';
    if (typeof c === 'string') return c;
    if (Array.isArray(c.bullets)) return c.bullets.map((b) => `• ${b}`).join('\n');
    if (typeof c.text === 'string') return c.text;
    if (typeof c.body === 'string') return c.body;
    if (Array.isArray(c.left_column)) return c.left_column.map((b) => `• ${b}`).join('\n');
    return '';
  }

  function ensurePresentOverlay() {
    let overlay = document.getElementById('pres-hd-present-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'pres-hd-present-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div id="pres-hd-present-stage">
        <div class="phd-slide">
          <h1 class="phd-title"></h1>
          <div class="phd-rule"></div>
          <div class="phd-body"></div>
          <div class="phd-footer"></div>
        </div>
      </div>
      <div id="pres-hd-present-bar">
        <button type="button" id="pres-hd-prev" aria-label="Önceki">← Önceki</button>
        <span id="pres-hd-present-counter">1 / 1</span>
        <button type="button" id="pres-hd-next" aria-label="Sonraki">Sonraki →</button>
        <button type="button" id="pres-hd-exit" aria-label="Çıkış">Esc · Kapat</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#pres-hd-prev')?.addEventListener('click', () => goPresent(-1));
    overlay.querySelector('#pres-hd-next')?.addEventListener('click', () => goPresent(1));
    overlay.querySelector('#pres-hd-exit')?.addEventListener('click', closePresent);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePresent();
    });
    return overlay;
  }

  function renderPresentSlide() {
    const slides = getSlides();
    const slide = slides[presentIndex];
    const overlay = ensurePresentOverlay();
    const titleEl = overlay.querySelector('.phd-title');
    const bodyEl = overlay.querySelector('.phd-body');
    const footerEl = overlay.querySelector('.phd-footer');
    const counter = overlay.querySelector('#pres-hd-present-counter');
    if (!slide) {
      if (titleEl) titleEl.textContent = 'Slayt yok';
      if (bodyEl) bodyEl.textContent = '';
      if (footerEl) footerEl.textContent = '';
      if (counter) counter.textContent = '0 / 0';
      return;
    }
    if (titleEl) titleEl.textContent = slideTitle(slide);
    const raw = slideBodyText(slide);
    if (bodyEl) {
      // simple bullet-aware render
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.some((l) => /^[•\-\*]|\d+[.)]/.test(l))) {
        bodyEl.innerHTML = '<ul>' + lines.map((l) => {
          const t = l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '');
          return `<li>${escapeHtml(t)}</li>`;
        }).join('') + '</ul>';
      } else {
        bodyEl.textContent = raw;
      }
    }
    if (footerEl) footerEl.textContent = `${presentIndex + 1} / ${slides.length}`;
    if (counter) counter.textContent = `${presentIndex + 1} / ${slides.length}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function goPresent(delta) {
    const slides = getSlides();
    if (!slides.length) return;
    presentIndex = (presentIndex + delta + slides.length) % slides.length;
    renderPresentSlide();
  }

  function openPresent() {
    const slides = getSlides();
    if (!slides.length) {
      if (typeof showDashboardAlert === 'function') {
        showDashboardAlert('info', 'Sunumda henüz slayt yok.');
      }
      return;
    }
    try {
      if (typeof window.presActiveSlide === 'number') presentIndex = window.presActiveSlide;
      else if (typeof presActiveSlide !== 'undefined') presentIndex = presActiveSlide;
      else presentIndex = 0;
    } catch (_) {
      presentIndex = 0;
    }
    presentIndex = Math.max(0, Math.min(presentIndex, slides.length - 1));
    const overlay = ensurePresentOverlay();
    overlay.classList.add('is-open');
    renderPresentSlide();
    presentKeyHandler = (e) => {
      if (e.key === 'Escape') closePresent();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goPresent(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPresent(-1);
      } else if (e.key === 'Home') {
        presentIndex = 0;
        renderPresentSlide();
      } else if (e.key === 'End') {
        presentIndex = slides.length - 1;
        renderPresentSlide();
      }
    };
    document.addEventListener('keydown', presentKeyHandler);
    try {
      if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
    } catch (_) {}
  }

  function closePresent() {
    const overlay = document.getElementById('pres-hd-present-overlay');
    if (overlay) overlay.classList.remove('is-open');
    if (presentKeyHandler) {
      document.removeEventListener('keydown', presentKeyHandler);
      presentKeyHandler = null;
    }
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (_) {}
  }

  function ensurePresentButton() {
    if (document.getElementById('pres-hd-present-btn')) return;
    const toolbar =
      document.querySelector('#pres-studio-mode .pres-toolbar') ||
      document.querySelector('#presentation-view .pres-toolbar') ||
      document.getElementById('pres-save-btn')?.parentElement;
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pres-hd-present-btn';
    btn.className = 'pres-btn';
    btn.title = 'HD sunum modu (tam ekran)';
    btn.innerHTML = '▶ HD Present';
    btn.addEventListener('click', openPresent);

    const exportBtn = document.getElementById('pres-export-btn') || document.getElementById('pres-complete-btn');
    if (exportBtn && exportBtn.parentElement === toolbar) {
      exportBtn.insertAdjacentElement('beforebegin', btn);
    } else {
      toolbar.appendChild(btn);
    }
  }

  // ---------- Hook render pipeline ----------
  function patchRender() {
    if (window.renderActivePresentationSlide && !window.renderActivePresentationSlide.__hdWrapped) {
      const original = window.renderActivePresentationSlide;
      window.renderActivePresentationSlide = function () {
        const result = original.apply(this, arguments);
        scheduleFit();
        ensurePresentButton();
        return result;
      };
      window.renderActivePresentationSlide.__hdWrapped = true;
    }
  }

  function boot() {
    injectStyles();
    // Wait for studio DOM
    const tryInit = () => {
      const canvas = getCanvas();
      if (!canvas) return false;
      canvas.classList.add('pres-hd-ready');
      observeResize();
      scheduleFit();
      ensurePresentButton();
      patchRender();
      // Re-fit a few times as studio layout settles
      setTimeout(scheduleFit, 120);
      setTimeout(scheduleFit, 400);
      setTimeout(scheduleFit, 900);
      return true;
    };

    if (!tryInit()) {
      let attempts = 0;
      const t = setInterval(() => {
        attempts += 1;
        if (tryInit() || attempts > 40) clearInterval(t);
      }, 250);
    }

    // Also when switching into presentation view
    const origSwitch = window.switchDashboardView;
    if (typeof origSwitch === 'function' && !origSwitch.__hdWrapped) {
      window.switchDashboardView = function (viewId) {
        const r = origSwitch.apply(this, arguments);
        if (viewId === 'presentation') {
          setTimeout(() => {
            injectStyles();
            scheduleFit();
            ensurePresentButton();
            patchRender();
          }, 80);
        }
        return r;
      };
      window.switchDashboardView.__hdWrapped = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Public API
  window.AcadexPresentationHdV9 = {
    fit: scheduleFit,
    openPresent,
    closePresent,
    designSize: { w: DESIGN_W, h: DESIGN_H },
  };
})();
