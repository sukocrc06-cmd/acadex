/* ==========================================================================
   Acadex Presentation Quality V10 — Academic Quality score for a deck

   The same idea as the summarization pipeline's deterministic gates
   (grounding, near-duplicate merge, citation anchoring): no model call, no
   token cost, no opinion the student has to take on faith. Every number
   below can be traced back to something countable in the deck.

   Reconstructed with its two siblings in js/presentation/core — see the
   header of presentation-services-v10.js. The API and three behaviours are
   pinned by tests/presentation-v10-quality-smoke.js:

     reviewDeck(deck, ctx) -> { score, metrics, issues, suggestions, meta }
       - a cited, varied, well-noted deck scores >= 70 with grounding >= 80
       - duplicate slides push repetition below 100 and raise a
         { type: 'repetition' } issue
       - a document-sourced deck with no citations scores lower on grounding
         and is told to run the Citation Engine
   ========================================================================== */
(function () {
  'use strict';
  if (window.AcadexPresentationQualityV10) return;

  const Schema = () => window.AcadexPresentationSchemaV10;

  // Sources that CAN be cited. A deck generated from a topic has nothing to
  // cite, and scoring it on grounding would punish the student for using the
  // feature as designed.
  const GROUNDABLE = new Set(['document', 'study_card']);

  // How much each metric moves the final score. Grounding is weighted
  // highest because an academic deck that asserts things it cannot support
  // is the failure that matters; prettiness is not.
  const WEIGHTS = { grounding: 0.34, repetition: 0.22, structure: 0.18, density: 0.14, notes: 0.12 };

  // A slide whose job is to open or close carries no claims, so it is not
  // counted as missing a citation.
  const CEREMONIAL = new Set(['title', 'quote']);
  const CEREMONIAL_VARIANTS = new Set(['hero', 'summary']);

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  /** Fold case and strip punctuation/diacritics so two slides can be compared. */
  function fold(text) {
    return String(text || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function words(text) {
    return fold(text).split(' ').filter((w) => w.length > 2);
  }

  /** Jaccard overlap of two word sets — 0 for unrelated, 1 for identical. */
  function similarity(a, b) {
    const A = new Set(words(a));
    const B = new Set(words(b));
    if (A.size === 0 || B.size === 0) return 0;
    let shared = 0;
    for (const w of A) if (B.has(w)) shared++;
    return shared / (A.size + B.size - shared);
  }

  function slideText(slide) {
    const c = slide?.content || {};
    const extra = []
      .concat(Array.isArray(c.cards) ? c.cards.map((x) => `${x?.title || ''} ${x?.body || ''}`) : [])
      .concat(Array.isArray(c.steps) ? c.steps.map((x) => `${x?.title || ''} ${x?.body || ''}`) : []);
    return [slide?.title, c.text, ...extra].filter(Boolean).join('\n');
  }

  function isCeremonial(slide) {
    const variant = String(slide?.content?.design_variant || slide?.content?.designVariant || '');
    return CEREMONIAL.has(String(slide?.layout_type || slide?.layout || '')) ||
      CEREMONIAL_VARIANTS.has(variant);
  }

  function citationsOf(slide) {
    const c = slide?.content || {};
    const list = [].concat(
      Array.isArray(c.citations) ? c.citations : [],
      Array.isArray(c.source_refs) ? c.source_refs : [],
      Array.isArray(slide?.source_refs) ? slide.source_refs : []
    );
    return list.filter((x) => x && (x.claim || x.source_id || x.sourceId));
  }

  /**
   * How much of what this deck asserts is actually attributed.
   *
   * Only slides that make claims count — the opener and the closing summary
   * are excluded, because demanding a citation on a title slide would teach
   * the generator to put a fake one there.
   */
  function gradeGrounding(slides, sourceType) {
    if (!GROUNDABLE.has(sourceType)) {
      return { score: 100, applicable: false, cited: 0, claimBearing: 0 };
    }
    const claimBearing = slides.filter((s) => !isCeremonial(s));
    if (claimBearing.length === 0) return { score: 100, applicable: true, cited: 0, claimBearing: 0 };
    const cited = claimBearing.filter((s) => citationsOf(s).length > 0).length;
    return {
      score: Math.round((cited / claimBearing.length) * 100),
      applicable: true,
      cited,
      claimBearing: claimBearing.length
    };
  }

  /** Does the deck say the same thing twice? */
  function gradeRepetition(slides) {
    const pairs = [];
    let worst = 0;
    for (let i = 0; i < slides.length; i++) {
      for (let j = i + 1; j < slides.length; j++) {
        const sim = similarity(slideText(slides[i]), slideText(slides[j]));
        if (sim >= 0.6) pairs.push({ a: i, b: j, similarity: Math.round(sim * 100) });
        if (sim > worst) worst = sim;
      }
    }
    // One near-duplicate pair is a real defect, not a rounding error, so the
    // penalty starts steep rather than fading in.
    const penalty = pairs.reduce((n, p) => n + 20 + (p.similarity - 60) / 2, 0);
    return { score: clamp(Math.round(100 - penalty), 0, 100), pairs, worst: Math.round(worst * 100) };
  }

  /**
   * Does it open, develop and close, at a length a person can present?
   *
   * Every message names the slide or the count it is about. "Kapanış slaydı
   * bir özet değil" is true but leaves the student hunting for which slide
   * that is; "5. slayt…" is the same finding they can act on without
   * counting. The grading test enforces it.
   */
  function gradeStructure(slides) {
    const n = slides.length;
    const notes = [];
    let score = 100;
    if (n < 4) { score -= 35; notes.push(`Sunum çok kısa — ${n} slayt var, en az 4-5 bekleniyor.`); }
    if (n > 25) { score -= 15; notes.push(`Sunum çok uzun — ${n} slayt bir derse sığmaz, 25 üstü bölünmeli.`); }
    if (n > 0 && !isCeremonial(slides[0])) { score -= 10; notes.push('1. slayt bir başlık/hero slaydı değil — sunum bir açılışla başlamalı.'); }
    if (n > 2 && !isCeremonial(slides[n - 1])) { score -= 10; notes.push(`${n}. slayt bir özet/sonuç slaydı değil — sunum bir kapanışla bitmeli.`); }
    const variants = new Set(slides.map((s) => s?.content?.design_variant || 'plain'));
    if (n >= 5 && variants.size < 3) { score -= 10; notes.push(`Slayt düzenleri tekdüze — ${n} slaytta yalnızca ${variants.size} farklı yerleşim var.`); }
    return { score: clamp(score, 0, 100), notes, variants: variants.size };
  }

  /** Is there a wall of text on any slide? */
  function gradeDensity(slides) {
    const S = Schema();
    const overfull = [];
    let total = 0;
    slides.forEach((slide, i) => {
      const text = String(slide?.content?.text || '');
      const lines = S ? S.bulletLines(text) : text.split(/\r?\n/).filter(Boolean);
      const chars = text.length;
      total += chars;
      if (lines.length > 7 || chars > 520) overfull.push({ index: i, lines: lines.length, chars });
    });
    const score = clamp(Math.round(100 - overfull.length * 18), 0, 100);
    return { score, overfull, averageChars: slides.length ? Math.round(total / slides.length) : 0 };
  }

  /**
   * Speaker notes, which are what separates a deck from a document.
   *
   * A note shorter than ~60 characters is a placeholder, not something to
   * say out loud, so it does not count.
   */
  function gradeNotes(slides) {
    if (slides.length === 0) return { score: 100, withNotes: 0 };
    const withNotes = slides.filter((s) => String(s?.speaker_notes || s?.speakerNotes || '').trim().length >= 60).length;
    return { score: Math.round((withNotes / slides.length) * 100), withNotes };
  }

  /**
   * Review a deck and return a score with its reasons.
   *
   * `slides` may be raw (straight off the editor or the director) — it is
   * normalised here so callers do not each have to remember to.
   */
  function reviewDeck(slides, context) {
    const ctx = context && typeof context === 'object' ? context : {};
    const sourceType = String(ctx.source_type || ctx.sourceType || 'topic');
    const S = Schema();
    const deck = S ? S.normalizeDeck(slides) : (Array.isArray(slides) ? slides : []);

    const grounding = gradeGrounding(deck, sourceType);
    const repetition = gradeRepetition(deck);
    const structure = gradeStructure(deck);
    const density = gradeDensity(deck);
    const notes = gradeNotes(deck);

    const metrics = {
      grounding: grounding.score,
      repetition: repetition.score,
      structure: structure.score,
      density: density.score,
      notes: notes.score
    };

    const score = Math.round(
      metrics.grounding * WEIGHTS.grounding +
      metrics.repetition * WEIGHTS.repetition +
      metrics.structure * WEIGHTS.structure +
      metrics.density * WEIGHTS.density +
      metrics.notes * WEIGHTS.notes
    );

    const issues = [];
    const suggestions = [];

    if (grounding.applicable && grounding.score < 100) {
      issues.push({
        type: 'grounding',
        severity: grounding.score < 50 ? 'high' : 'medium',
        message: `${grounding.claimBearing} iddia taşıyan slayttan ${grounding.cited} tanesi kaynaklı.`
      });
      // The literal name matters: the chat and the smoke test both look for
      // it, and a student reading this needs the name of the button to press.
      suggestions.push('Citation Engine çalıştırarak kaynaksız slaytlara atıf ekleyin.');
    }
    for (const pair of repetition.pairs) {
      issues.push({
        type: 'repetition',
        severity: pair.similarity >= 85 ? 'high' : 'medium',
        message: `${pair.a + 1}. ve ${pair.b + 1}. slaytlar %${pair.similarity} benzer.`
      });
    }
    if (repetition.pairs.length) suggestions.push('Benzer slaytları birleştirin veya birine yeni bir açı ekleyin.');
    for (const note of structure.notes) {
      issues.push({ type: 'structure', severity: 'medium', message: note });
    }
    for (const of_ of density.overfull) {
      issues.push({
        type: 'density',
        severity: 'low',
        message: `${of_.index + 1}. slayt çok yoğun (${of_.lines} satır, ${of_.chars} karakter).`
      });
    }
    if (density.overfull.length) suggestions.push('Yoğun slaytları ikiye bölün; slayttaki metni konuşmacı notlarına taşıyın.');
    if (notes.score < 70) {
      issues.push({
        type: 'notes',
        severity: 'medium',
        message: `${deck.length} slayttan ${notes.withNotes} tanesinde kullanılabilir konuşmacı notu var.`
      });
      suggestions.push('Konuşmacı notlarını üreterek sunumu anlatılabilir hale getirin.');
    }

    return {
      score: clamp(score, 0, 100),
      metrics,
      issues,
      suggestions,
      meta: {
        slideCount: deck.length,
        sourceType,
        groundingApplicable: grounding.applicable,
        citedSlides: grounding.cited,
        claimBearingSlides: grounding.claimBearing,
        duplicatePairs: repetition.pairs.length,
        averageCharsPerSlide: density.averageChars,
        weights: WEIGHTS
      }
    };
  }

  window.AcadexPresentationQualityV10 = {
    version: '10.0.0',
    WEIGHTS,
    similarity,
    reviewDeck
  };
})();
