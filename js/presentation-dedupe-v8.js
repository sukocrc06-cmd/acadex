/* Acadex Presentation Dedupe V8 — stronger left/right clone removal */
(function () {
  'use strict';
  if (window.__acadexPresentationDedupeV8) return;
  window.__acadexPresentationDedupeV8 = true;

  const norm = (value) => String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  function lines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((item) => item.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
  }

  function contentOf(slide) {
    return slide && slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content)
      ? slide.content
      : {};
  }

  function cardSignature(card) {
    const t = norm(card?.title);
    const b = norm(card?.body);
    return { t, b, combo: b ? `${t} ${b}` : t };
  }

  function lineCoveredByCards(line, signatures) {
    const n = norm(line);
    if (!n) return true;
    return signatures.some((s) => {
      if (!s.t) return false;
      if (n === s.t || n === s.combo || n === s.b) return true;
      // "Karbonhidrat: %45-55" vs title Karbonhidrat body %45-55
      if (s.t && n.startsWith(s.t) && (!s.b || n.includes(s.b))) return true;
      if (s.combo && (n.includes(s.t) && s.b && n.includes(s.b))) return true;
      // near-equal
      if (s.t.length >= 4 && (n.includes(s.t) || s.t.includes(n)) && Math.abs(n.length - s.t.length) <= 12 && !s.b) return true;
      return false;
    });
  }

  function dedupeSlide(slide) {
    if (!slide || typeof slide !== 'object') return slide;
    const content = { ...contentOf(slide) };
    let changed = false;

    if (Array.isArray(content.cards) && content.cards.length) {
      content.cards = content.cards.map((card, index) => {
        if (!card || typeof card !== 'object') return card;
        const title = String(card.title || '').trim();
        let body = String(card.body || '').trim();
        if (title && body && norm(title) === norm(body)) {
          body = '';
          changed = true;
        }
        return { ...card, title: title || `Madde ${index + 1}`, body };
      });
    }

    if (Array.isArray(content.steps) && content.steps.length) {
      content.steps = content.steps.map((step, index) => {
        if (!step || typeof step !== 'object') return step;
        const title = String(step.title || '').trim();
        let body = String(step.body || '').trim();
        if (title && body && norm(title) === norm(body)) {
          body = '';
          changed = true;
        }
        return { ...step, title: title || `Adım ${index + 1}`, body };
      });
    }

    if (Array.isArray(content.cards) && content.cards.length >= 2) {
      const signatures = content.cards.map(cardSignature);
      const originalLines = lines(content.text);
      const kept = originalLines.filter((line) => !lineCoveredByCards(line, signatures));
      if (kept.length !== originalLines.length) {
        changed = true;
        content.text = kept.length ? kept.map((l) => `• ${l}`).join('\n') : '';
      }
    }

    // If cards carry the teaching and text empty, prefer cards-only design
    if (Array.isArray(content.cards) && content.cards.length >= 2 && !String(content.text || '').trim()) {
      if (content.design_variant !== 'cards') {
        content.design_variant = 'cards';
        changed = true;
      }
    }

    if (content.secondary_text && content.text) {
      const primary = new Set(lines(content.text).map(norm));
      const secondaryKept = lines(content.secondary_text).filter((l) => !primary.has(norm(l)));
      if (secondaryKept.length !== lines(content.secondary_text).length) {
        content.secondary_text = secondaryKept.map((l) => `• ${l}`).join('\n');
        changed = true;
      }
    }

    if (!changed) return slide;
    return { ...slide, content };
  }

  function dedupeDeck(slides) {
    if (!Array.isArray(slides)) return { slides, changed: false };
    let changed = false;
    const next = slides.map((slide) => {
      const repaired = dedupeSlide(slide);
      if (repaired !== slide) changed = true;
      return repaired;
    });
    return { slides: next, changed };
  }

  function getLiveSlides() {
    try {
      if (typeof presSlides !== 'undefined' && Array.isArray(presSlides)) return presSlides;
    } catch (_) {}
    try {
      if (Array.isArray(window.presSlides)) return window.presSlides;
    } catch (_) {}
    return null;
  }

  function setLiveSlides(next) {
    try {
      if (typeof presSlides !== 'undefined') {
        // mutate array in place so references stay valid
        presSlides.length = 0;
        next.forEach((s) => presSlides.push(s));
        return;
      }
    } catch (_) {}
    try { window.presSlides = next; } catch (_) {}
  }

  function repairLiveDeck() {
    try {
      const live = getLiveSlides();
      if (!live) return false;
      const { slides, changed } = dedupeDeck(live);
      if (!changed) return false;
      setLiveSlides(slides);
      try {
        if (typeof markPresentationDirty === 'function') markPresentationDirty();
        else window.presIsDirty = true;
      } catch (_) {}
      try {
        if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList();
        if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide();
      } catch (_) {}
      return true;
    } catch (e) {
      console.warn('Presentation dedupe failed:', e);
      return false;
    }
  }

  function patchModel() {
    const model = window.AcadexPresentationModelV7;
    if (!model || model.__dedupePatched) return;
    const originalNormalize = model.normalize;
    if (typeof originalNormalize !== 'function') return;
    model.normalize = function (slide, index) {
      return dedupeSlide(originalNormalize.call(model, slide, index));
    };
    const originalBody = model.renderBody;
    if (typeof originalBody === 'function') {
      model.renderBody = function (slide) {
        const s = model.normalize(slide);
        const c = s.content || {};
        const visual = model.renderVisual(s);
        const text = model.renderText(s);
        if (text && visual && Array.isArray(c.cards) && c.cards.length >= 2) {
          const signatures = c.cards.map(cardSignature);
          const textLines = lines(c.text);
          const unique = textLines.filter((line) => !lineCoveredByCards(line, signatures));
          if (unique.length === 0) return visual;
          if (unique.length <= Math.max(1, Math.floor(textLines.length * 0.4))) {
            const slim = {
              ...s,
              content: { ...c, text: unique.map((l) => `• ${l}`).join('\n'), secondary_text: '' },
            };
            const slimText = model.renderText(slim);
            return slimText
              ? `<div class="ap7-combo"><div class="ap7-copy">${slimText}</div><div class="ap7-visual">${visual}</div></div>`
              : visual;
          }
        }
        return originalBody.call(model, s);
      };
    }
    model.__dedupePatched = true;
    model.dedupeSlide = dedupeSlide;
    model.dedupeDeck = dedupeDeck;
  }

  function patchRenderer() {
    const r = window.AcadexPresentationRendererV7;
    if (!r || r.__dedupePatched) return;
    const original = r.repairDeck;
    r.repairDeck = function () {
      let changed = false;
      try { if (typeof original === 'function') changed = !!original.call(r); } catch (_) {}
      try { if (repairLiveDeck()) changed = true; } catch (_) {}
      return changed;
    };
    r.__dedupePatched = true;
  }

  // Also hook renderActivePresentationSlide to always dedupe active slide content for display
  function patchActiveRender() {
    if (window.__apDedupeRenderHooked) return;
    const tryHook = () => {
      if (typeof window.renderActivePresentationSlide !== 'function') return false;
      if (window.renderActivePresentationSlide.__dedupeWrapped) return true;
      const original = window.renderActivePresentationSlide;
      window.renderActivePresentationSlide = function () {
        try {
          const live = getLiveSlides();
          let active = 0;
          try { if (typeof presActiveSlide !== 'undefined') active = presActiveSlide; } catch (_) {}
          if (live && live[active]) {
            const fixed = dedupeSlide(live[active]);
            if (fixed !== live[active]) live[active] = fixed;
          }
        } catch (_) {}
        return original.apply(this, arguments);
      };
      window.renderActivePresentationSlide.__dedupeWrapped = true;
      window.__apDedupeRenderHooked = true;
      return true;
    };
    if (!tryHook()) {
      let n = 0;
      const t = setInterval(() => { if (tryHook() || ++n > 40) clearInterval(t); }, 250);
    }
  }

  function boot() {
    patchModel();
    patchRenderer();
    patchActiveRender();
    setTimeout(() => { patchModel(); patchRenderer(); patchActiveRender(); repairLiveDeck(); }, 600);
  }

  window.AcadexPresentationDedupeV8 = { dedupeSlide, dedupeDeck, repairLiveDeck };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 1200);
})();
