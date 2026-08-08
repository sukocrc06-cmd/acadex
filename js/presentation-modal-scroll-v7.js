/* Acadex Presentation AI Modal Scroll V7.2 — body-portal viewport fix */
(function () {
  'use strict';
  if (window.__acadexPresentationModalScrollV72) return;
  window.__acadexPresentationModalScrollV72 = true;

  function isOpen(overlay) {
    if (!overlay) return false;
    const style = window.getComputedStyle(overlay);
    return !overlay.hidden && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function applyFix() {
    const overlay = document.getElementById('pres-ai-builder');
    const modal = document.getElementById('pres-ai-form');
    if (!overlay || !modal || !document.body) return;

    const body = modal.querySelector('.pres-builder-body');
    const header = modal.querySelector('.pres-builder-header');
    const footer = modal.querySelector('.pres-builder-footer');
    if (!body) return;

    /*
     * Critical fix:
     * A position:fixed element can still be clipped/offset when one of its ancestors
     * creates a containing block (transform/filter/perspective/contain). The presentation
     * studio does that, so CSS-only fixes were not sufficient. Move the existing overlay
     * node directly under <body>. Existing event listeners and form state are preserved.
     */
    if (overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }

    overlay.style.setProperty('position', 'fixed', 'important');
    overlay.style.setProperty('inset', '0', 'important');
    overlay.style.setProperty('width', '100vw', 'important');
    overlay.style.setProperty('height', '100dvh', 'important');
    overlay.style.setProperty('max-height', '100dvh', 'important');
    overlay.style.setProperty('box-sizing', 'border-box', 'important');
    overlay.style.setProperty('align-items', 'center', 'important');
    overlay.style.setProperty('justify-content', 'center', 'important');
    overlay.style.setProperty('padding', '10px', 'important');
    overlay.style.setProperty('overflow', 'hidden', 'important');
    overlay.style.setProperty('z-index', '350000', 'important');

    modal.style.setProperty('position', 'relative', 'important');
    modal.style.setProperty('inset', 'auto', 'important');
    modal.style.setProperty('transform', 'none', 'important');
    modal.style.setProperty('margin', '0 auto', 'important');
    modal.style.setProperty('width', 'min(760px, calc(100vw - 20px))', 'important');
    modal.style.setProperty('height', 'calc(100dvh - 20px)', 'important');
    modal.style.setProperty('max-height', 'calc(100dvh - 20px)', 'important');
    modal.style.setProperty('min-height', '0', 'important');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('flex-direction', 'column', 'important');
    modal.style.setProperty('overflow', 'hidden', 'important');

    if (header) {
      header.style.setProperty('flex', '0 0 auto', 'important');
      header.style.setProperty('position', 'relative', 'important');
      header.style.setProperty('z-index', '3', 'important');
      header.style.setProperty('background', '#fff', 'important');
    }

    body.style.setProperty('flex', '1 1 auto', 'important');
    body.style.setProperty('min-height', '0', 'important');
    body.style.setProperty('height', 'auto', 'important');
    body.style.setProperty('max-height', 'none', 'important');
    body.style.setProperty('overflow-y', 'scroll', 'important');
    body.style.setProperty('overflow-x', 'hidden', 'important');
    body.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    body.style.setProperty('overscroll-behavior', 'contain', 'important');
    body.style.setProperty('scrollbar-gutter', 'stable', 'important');
    body.style.setProperty('padding-bottom', '18px', 'important');

    if (footer) {
      footer.style.setProperty('flex', '0 0 auto', 'important');
      footer.style.setProperty('position', 'relative', 'important');
      footer.style.setProperty('bottom', 'auto', 'important');
      footer.style.setProperty('z-index', '4', 'important');
      footer.style.setProperty('background', '#fff', 'important');
      footer.style.setProperty('box-shadow', '0 -8px 18px rgba(15,23,42,.06)', 'important');
    }

    // Start at the top whenever the modal is newly opened.
    if (isOpen(overlay) && overlay.dataset.wasOpenV72 !== '1') {
      body.scrollTop = 0;
      overlay.dataset.wasOpenV72 = '1';
    }
    if (!isOpen(overlay)) overlay.dataset.wasOpenV72 = '0';
  }

  function scrollBodyBy(delta) {
    const modal = document.getElementById('pres-ai-form');
    const body = modal?.querySelector('.pres-builder-body');
    if (!body) return false;
    const before = body.scrollTop;
    body.scrollTop += delta;
    return body.scrollTop !== before || body.scrollHeight > body.clientHeight;
  }

  function bind() {
    applyFix();

    // Re-apply after any click that may open/close the modal. No MutationObserver.
    document.addEventListener('click', function () {
      requestAnimationFrame(() => {
        applyFix();
        requestAnimationFrame(applyFix);
      });
    }, true);

    // Wheel over header/footer/backdrop still scrolls the form body.
    document.addEventListener('wheel', function (event) {
      const overlay = document.getElementById('pres-ai-builder');
      const modal = document.getElementById('pres-ai-form');
      const body = modal?.querySelector('.pres-builder-body');
      if (!overlay || !modal || !body || !isOpen(overlay) || !overlay.contains(event.target)) return;
      if (body.contains(event.target)) return; // native scrolling inside the body
      if (scrollBodyBy(event.deltaY)) event.preventDefault();
    }, { passive: false, capture: true });

    // Keyboard fallback for accessibility and laptop keyboards.
    document.addEventListener('keydown', function (event) {
      const overlay = document.getElementById('pres-ai-builder');
      if (!overlay || !isOpen(overlay)) return;
      if (event.key === 'PageDown') { if (scrollBodyBy(320)) event.preventDefault(); }
      if (event.key === 'PageUp') { if (scrollBodyBy(-320)) event.preventDefault(); }
      if (event.key === 'End') {
        const body = document.querySelector('#pres-ai-form .pres-builder-body');
        if (body) { body.scrollTop = body.scrollHeight; event.preventDefault(); }
      }
      if (event.key === 'Home') {
        const body = document.querySelector('#pres-ai-form .pres-builder-body');
        if (body) { body.scrollTop = 0; event.preventDefault(); }
      }
    }, true);

    window.addEventListener('resize', applyFix);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.AcadexFixPresentationModalScroll = applyFix;
})();
