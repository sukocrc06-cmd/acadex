/* ==========================================================================
   Acadex Presentation Schema V10 — one slide shape, whoever produced it

   Slides arrive from three places that do not agree on names: the V7 editor,
   the V11 director edge function, and older saved rows. The database columns
   added by 20260810_presentation_intelligence_v10.sql (schema_version,
   source_refs, quality) assume one shape; this normalises to it.

   Reconstructed alongside presentation-services-v10.js — see the header
   there for why these files were missing. The field mapping is pinned by
   tests/presentation-v10-quality-smoke.js:

     layout        -> layout_type
     designVariant -> design_variant        (camelCase in, snake_case out)
     citations[].page -> citations[].locator.page

   The camel/snake split is the whole point: JavaScript callers write
   designVariant, Postgres columns and the edge function speak snake_case,
   and before this file each side was guessing.
   ========================================================================== */
(function () {
  'use strict';
  if (window.AcadexPresentationSchemaV10) return;

  const SCHEMA_VERSION = 10;

  const LAYOUTS = new Set([
    'title', 'bullets', 'text', 'chart', 'table', 'cards', 'process',
    'metric', 'diagram', 'quote', 'image', 'comparison', 'summary'
  ]);

  const DESIGN_VARIANTS = new Set([
    'hero', 'data', 'cards', 'process', 'summary', 'quote', 'split', 'plain'
  ]);

  const str = (v) => String(v == null ? '' : v).trim();
  const arr = (v) => (Array.isArray(v) ? v : []);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  /**
   * One citation, with its location in a `locator` object.
   *
   * Page/section/timestamp used to sit directly on the citation, which made
   * "which page" and "which kind of location" the same question. A locator
   * keeps a page citation and a section citation the same shape, so the
   * grounding check downstream does not need to know which it is holding.
   */
  function normalizeCitation(raw) {
    const c = obj(raw);
    const locator = obj(c.locator);
    const page = c.page ?? locator.page;
    const section = c.section ?? locator.section;
    const out = {
      claim: str(c.claim),
      source_id: str(c.source_id || c.sourceId),
      locator: {},
      confidence: Number.isFinite(Number(c.confidence)) ? Number(c.confidence) : null
    };
    if (page != null && page !== '' && Number.isFinite(Number(page))) out.locator.page = Number(page);
    if (section) out.locator.section = str(section);
    return out;
  }

  /** A slide in the shape the V10 tables and the quality engine expect. */
  function normalizeSlide(raw, index) {
    const s = obj(raw);
    const content = obj(s.content);

    const layout = str(s.layout_type || s.layout || content.layout).toLowerCase();
    const variant = str(content.design_variant || content.designVariant).toLowerCase();

    const citations = arr(content.citations || content.source_refs || s.citations)
      .map(normalizeCitation)
      // A citation with neither a claim nor a source cannot be checked by
      // anything downstream, and counting it as grounding would be generous
      // about work nobody did.
      .filter((c) => c.claim || c.source_id);

    return {
      schema_version: SCHEMA_VERSION,
      position: Number.isInteger(s.position) ? s.position : (Number.isInteger(index) ? index : 0),
      title: str(s.title || content.title),
      layout_type: LAYOUTS.has(layout) ? layout : 'text',
      speaker_notes: str(s.speaker_notes || s.speakerNotes || content.speaker_notes),
      revision: Number.isInteger(s.revision) ? s.revision : 0,
      content: {
        ...content,
        text: str(content.text || content.body),
        design_variant: DESIGN_VARIANTS.has(variant) ? variant : 'plain',
        citations
      },
      source_refs: arr(s.source_refs),
      quality: obj(s.quality)
    };
  }

  /** Normalise a whole deck, renumbering positions so they are dense and ordered. */
  function normalizeDeck(slides) {
    return arr(slides).map((slide, i) => {
      const normalized = normalizeSlide(slide, i);
      normalized.position = i;
      return normalized;
    });
  }

  /**
   * Split a slide's text into display lines.
   *
   * Shared with the V7 model's `lines()` on purpose — the quality engine
   * counts bullets and the renderer draws them, and the two disagreeing
   * about what a bullet is would make every score slightly wrong.
   */
  function bulletLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((item) => item.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
  }

  window.AcadexPresentationSchemaV10 = {
    version: '10.0.0',
    SCHEMA_VERSION,
    LAYOUTS,
    DESIGN_VARIANTS,
    normalizeCitation,
    normalizeSlide,
    normalizeDeck,
    bulletLines
  };
})();
