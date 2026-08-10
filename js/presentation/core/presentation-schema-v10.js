/* Acadex Presentation Studio V10 — canonical deck/slide schema.
 * New V10 modules should read/write this shape. Legacy fields are normalized in place.
 */
(function () {
  'use strict';
  if (window.AcadexPresentationSchemaV10) return;

  const SCHEMA_VERSION = 10;
  const LAYOUTS = new Set([
    'title-only', 'title-content', 'two-column', 'image-left', 'image-right',
    'quote', 'chart', 'table', 'full-image'
  ]);
  const VARIANTS = new Set([
    'hero', 'section', 'cards', 'process', 'timeline', 'big-number',
    'comparison', 'data', 'summary'
  ]);

  function text(value, max) {
    const service = window.AcadexPresentationServicesV10;
    if (service?.cleanText) return service.cleanText(value, max);
    const out = String(value == null ? '' : value).trim();
    return Number.isFinite(max) ? out.slice(0, max) : out;
  }

  function normalizeCitation(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const claim = text(value.claim, 800);
    const sourceId = text(value.source_id || value.sourceId, 80);
    const page = Number.isFinite(Number(value.page)) ? Number(value.page) : null;
    const section = text(value.section, 180);
    const confidence = Number(value.confidence);
    if (!claim && !sourceId && page == null && !section) return null;
    return {
      id: text(value.id, 80) || null,
      source_id: sourceId || null,
      claim,
      locator: {
        page,
        section: section || null,
        chunk_id: text(value.chunk_id || value.chunkId, 120) || null,
      },
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    };
  }

  function normalizeContent(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const variantRaw = text(source.design_variant || source.designVariant, 30).toLowerCase();
    const citations = Array.isArray(source.citations)
      ? source.citations.map(normalizeCitation).filter(Boolean).slice(0, 30)
      : [];
    return {
      ...source,
      text: text(source.text, 5200),
      secondary_text: text(source.secondary_text || source.secondaryText, 3200),
      design_variant: VARIANTS.has(variantRaw) ? variantRaw : 'section',
      citations,
      source_refs: Array.isArray(source.source_refs || source.sourceRefs)
        ? (source.source_refs || source.sourceRefs).map((x) => text(x, 120)).filter(Boolean).slice(0, 30)
        : [],
      quality: source.quality && typeof source.quality === 'object' ? source.quality : {},
    };
  }

  function normalizeSlide(input, index) {
    const slide = input && typeof input === 'object' ? input : {};
    const layoutRaw = text(slide.layout_type || slide.layout, 30).toLowerCase();
    const content = normalizeContent(slide.content);
    if (slide.text && !content.text) content.text = text(slide.text, 5200);
    if (slide.secondary_text && !content.secondary_text) content.secondary_text = text(slide.secondary_text, 3200);
    if (slide.design_variant && (!slide.content || !slide.content.design_variant)) {
      const v = text(slide.design_variant, 30).toLowerCase();
      if (VARIANTS.has(v)) content.design_variant = v;
    }
    return {
      ...slide,
      schema_version: SCHEMA_VERSION,
      id: text(slide.id, 80) || null,
      title: text(slide.title, 180) || `Slayt ${(index || 0) + 1}`,
      layout_type: LAYOUTS.has(layoutRaw) ? layoutRaw : 'title-content',
      content,
      speaker_notes: text(slide.speaker_notes || slide.speakerNotes, 6200),
      image_url: text(slide.image_url || slide.imageUrl, 1600) || null,
      image_position: text(slide.image_position || slide.imagePosition, 30) || null,
      revision: Number.isFinite(Number(slide.revision)) ? Math.max(0, Number(slide.revision)) : 0,
    };
  }

  function normalizeDeck(slides) {
    return (Array.isArray(slides) ? slides : []).map((slide, index) => normalizeSlide(slide, index));
  }

  function snapshot(presentation, slides, reason) {
    return {
      schema_version: SCHEMA_VERSION,
      captured_at: new Date().toISOString(),
      reason: text(reason, 200) || 'manual_snapshot',
      presentation: presentation && typeof presentation === 'object' ? { ...presentation, schema_version: SCHEMA_VERSION } : null,
      slides: normalizeDeck(slides),
    };
  }

  window.AcadexPresentationSchemaV10 = {
    version: '10.0.0',
    schemaVersion: SCHEMA_VERSION,
    layouts: Array.from(LAYOUTS),
    variants: Array.from(VARIANTS),
    normalizeCitation,
    normalizeContent,
    normalizeSlide,
    normalizeDeck,
    snapshot,
  };
})();
