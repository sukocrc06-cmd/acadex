/* Acadex Presentation AI Modal Scroll V7.1 — hard viewport fix */
(function () {
  'use strict';
  if (window.__acadexPresentationModalScrollV71) return;
  window.__acadexPresentationModalScrollV71 = true;

  function applyFix() {
    const overlay = document.getElementById('pres-ai-builder');
    const modal = document.getElementById('pres-ai-form');
    if (!overlay || !modal) return;
    const body = modal.querySelector('.pres-builder-body');
    const header = modal.querySelector('.pres-builder-header');
    const footer = modal.querySelector('.pres-builder-footer');
    if (!body) return;

    // The original overlay can be positioned inside the presentation section.
    // Force it to the browser viewport so short laptop screens never crop the footer.
    overlay.style.setProperty('position', 'fixed', 'important');
    overlay.style.setProperty('inset', '0', 'important');
    overlay.style.setProperty('width', '100vw', 'important');
    overlay.style.setProperty('height', '100dvh', 'important');
    overlay.style.setProperty('max-height', '100dvh', 'important');
    overlay.style.setProperty('box-sizing', 'border-box', 'important');
    overlay.style.setProperty('align-items', 'center', 'important');
    overlay.style.setProperty('justify-content', 'center', 'important');
    overlay.style.setProperty('padding', '12px', 'important');
    overlay.style.setProperty('overflow', 'hidden', 'important');
    overlay.style.setProperty('z-index', '350000', 'important');

    modal.style.setProperty('position', 'relative', 'important');
    modal.style.setProperty('top', 'auto', 'important');
    modal.style.setProperty('left', 'auto', 'important');
    modal.style.setProperty('right', 'auto', 'important');
    modal.style.setProperty('bottom', 'auto', 'important');
    modal.style.setProperty('transform', 'none', 'important');
    modal.style.setProperty('margin', '0 auto', 'important');
    modal.style.setProperty('width', 'min(720px, calc(100vw - 24px))', 'important');
    modal.style.setProperty('height', 'min(760px, calc(100dvh - 24px))', 'important');
    modal.style.setProperty('max-height', 'calc(100dvh - 24px)', 'important');
    modal.style.setProperty('min-height', '0', 'important');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('flex-direction', 'column', 'important');
    modal.style.setProperty('overflow', 'hidden', 'important');

    if (header) {
      header.style.setProperty('flex', '0 0 auto', 'important');
      header.style.setProperty('position', 'relative', 'important');
      header.style.setProperty('z-index', '2', 'important');
      header.style.setProperty('background', '#fff', 'important');
    }

    body.style.setProperty('flex', '1 1 auto', 'important');
    body.style.setProperty('min-height', '0', 'important');
    body.style.setProperty('height', 'auto', 'important');
    body.style.setProperty('max-height', 'none', 'important');
    body.style.setProperty('overflow-y', 'auto', 'important');
    body.style.setProperty('overflow-x', 'hidden', 'important');
    body.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    body.style.setProperty('overscroll-behavior', 'contain', 'important');
    body.style.setProperty('scrollbar-gutter', 'stable', 'important');

    if (footer) {
      footer.style.setProperty('flex', '0 0 auto', 'important');
      footer.style.setProperty('position', 'relative', 'important');
      footer.style.setProperty('z-index', '2', 'important');
      footer.style.setProperty('background', '#fff', 'important');
    }

    if (overlay.dataset.scrollV71 !== '1') {
      overlay.dataset.scrollV71 = '1';
      overlay.addEventListener('wheel', function (event) {
        if (!body.contains(event.target)) {
          body.scrollTop += event.deltaY;
          event.preventDefault();
        }
      }, { passive: false });
    }
  }

  function bind() {
    applyFix();
    const triggers = document.querySelectorAll('#pres-ai-generate-open-btn, [data-open-pres-ai], #pres-ai-btn, .pres-ai-open-btn');
    triggers.forEach((btn) => btn.addEventListener('click', () => requestAnimationFrame(applyFix)));
    window.addEventListener('resize', applyFix);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  // Expose for manual re-apply when another script opens the modal.
  window.AcadexFixPresentationModalScroll = applyFix;
})();
