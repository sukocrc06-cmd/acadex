/* Acadex Presentation Dedupe V8 — break left-text / right-card clones (studio fix 2/6) */
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

  function dedupeSlide(slide) {
    if (!slide || typeof slide !== 'object') return slide;
    const content = { ...contentOf(slide) };
    let changed = false;

    // 1) Card body must not clone title
    if (Array.isArray(content.cards) && content.cards.length) {
      content.cards = content.cards.map((card, index) => {
        if (!card || typeof card !== 'object') return card;
        const title = String(card.title || '').trim();
        let body = String(card.body || '').trim();
        if (title && body && norm(title) === norm(body)) {
          body = '';
          changed = true;
        }
        // body that is only a slight truncation of title
        if (title && body && (norm(title).startsWith(norm(body)) || norm(body).startsWith(norm(title))) && Math.abs(title.length - body.length) <= 8) {
          body = '';
          changed = true;
        }
        return { ...card, title: title || `Madde ${index + 1}`, body };
      });
    }

    // 2) Steps body must not clone title
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

    // 3) Text lines that equal card titles → remove from text (cards own that info)
    if (Array.isArray(content.cards) && content.cards.length >= 2) {
      const titles = new Set(
        content.cards
          .map((c) => norm(c && c.title))
          .filter(Boolean)
      );
      const originalLines = lines(content.text);
      const kept = originalLines.filter((line) => !titles.has(norm(line)));
      if (kept.length !== originalLines.length) {
        changed = true;
        if (kept.length === 0) {
          // Prefer a short non-duplicate lead-in from card bodies if any
          const bodies = content.cards
            .map((c) => String(c && c.body || '').trim())
            .filter((b) => b && !titles.has(norm(b)));
          content.text = bodies.length
            ? bodies.slice(0, 2).map((b) => `• ${b}`).join('\n')
            : '';
        } else {
          content.text = kept.map((l) => `• ${l}`).join('\n');
        }
      }
    }

    // 4) Two-column: secondary_text should not mirror primary text
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

  function repairLiveDeck() {
    try {
      if (!Array.isArray(window.presSlides)) return false;
      const { slides, changed } = dedupeDeck(window.presSlides);
      if (!changed) return false;
      window.presSlides = slides;
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

  // Patch model normalize if present
  function patchModel() {
    const model = window.AcadexPresentationModelV7;
    if (!model || model.__dedupePatched) return;
    const originalNormalize = model.normalize;
    if (typeof originalNormalize !== 'function') return;
    model.normalize = function (slide, index) {
      const base = originalNormalize.call(model, slide, index);
      return dedupeSlide(base);
    };

    // Smarter body: avoid combo when text is only card-title echoes
    const originalBody = model.renderBody;
    if (typeof originalBody === 'function') {
      model.renderBody = function (slide) {
        const s = model.normalize(slide);
        const c = s.content || {};
        const text = model.renderText(s);
        const visual = model.renderVisual(s);
        if (text && visual && Array.isArray(c.cards) && c.cards.length >= 2) {
          const titleSet = new Set(c.cards.map((card) => norm(card.title)).filter(Boolean));
          const textLines = lines(c.text);
          const unique = textLines.filter((line) => !titleSet.has(norm(line)));
          // If almost all text is card titles, show cards (+ optional unique lines only)
          if (unique.length === 0) return visual;
          if (unique.length <= Math.max(1, Math.floor(textLines.length * 0.34))) {
            const slim = {
              ...s,
              content: {
                ...c,
                text: unique.map((l) => `• ${l}`).join('\n'),
                secondary_text: '',
              },
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

  // Hook renderer repairDeck
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

  function boot() {
    patchModel();
    patchRenderer();
    // One-shot repair when slides already loaded
    setTimeout(() => {
      patchModel();
      patchRenderer();
      repairLiveDeck();
    }, 600);
  }

  window.AcadexPresentationDedupeV8 = {
    dedupeSlide,
    dedupeDeck,
    repairLiveDeck,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 1200);
})();
