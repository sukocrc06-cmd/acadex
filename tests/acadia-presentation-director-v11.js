/* ==========================================================================
   Acadia Presentation Director V11 — browser client for the V11 edge function

   The backend (supabase/functions/acadia-presentation-director) and the chat
   UI (acadia-presentation-chat-v11.js) both shipped; this client between
   them did not. See presentation-services-v10.js for the full story.

   Reconstructed against three things that exist and agree:
     - tests/presentation-v11-director-smoke.js  (version, edgeFunction,
       busy, health() online and offline)
     - the edge function's own actions: health | plan | compose | critique
     - the chat module's calls: generate(options), critiqueCurrent(), close()

   Everything the function returns is normalised through Schema V10 before it
   reaches the editor, and scored locally by Quality V10 when the backend
   does not send a score — so a deck is never shown without a quality number
   just because one pass happened to be unavailable.
   ========================================================================== */
(function () {
  'use strict';
  if (window.AcadiaPresentationDirectorV11) return;

  const EDGE_FUNCTION = 'acadia-presentation-director';
  const Services = () => window.AcadexPresentationServicesV10;
  const Schema = () => window.AcadexPresentationSchemaV10;
  const Quality = () => window.AcadexPresentationQualityV10;

  // Health is asked about on every open; without caching, a studio that
  // reopens the panel five times makes five calls to answer a question whose
  // answer does not change that fast.
  const HEALTH_TTL_MS = 60_000;
  let healthCheckedAt = 0;
  let healthState = null;

  const api = {
    version: '11.0.0',
    edgeFunction: EDGE_FUNCTION,
    busy: false,
    lastRun: null
  };

  /**
   * Is the V11 backend deployed?
   *
   * Returns false rather than throwing. A project that has not deployed the
   * function yet is a normal state, not an error — the studio falls back to
   * the V7/V8 generator and the student still gets a deck.
   */
  async function health(force) {
    const now = Date.now();
    if (!force && healthState !== null && now - healthCheckedAt < HEALTH_TTL_MS) return healthState;
    try {
      const data = await Services().invoke(EDGE_FUNCTION, { action: 'health' });
      healthState = data?.ok === true || Number(data?.version) === 11;
    } catch (_err) {
      healthState = false;
    }
    healthCheckedAt = Date.now();
    return healthState;
  }

  /** The request body shape the edge function expects, from any caller's options. */
  function buildRequest(options) {
    const o = options && typeof options === 'object' ? options : {};
    const state = Services()?.state?.() || {};
    const sourceType = String(o.sourceType || o.source_type || state.sourceType || 'topic');
    return {
      sourceType,
      topic: String(o.topic || '').trim(),
      sourceId: o.sourceId || o.source_id || null,
      documentId: o.documentId || o.document_id || null,
      studyCardId: o.studyCardId || o.study_card_id || null,
      presentationId: o.presentationId || state.presentationId || null,
      slideCount: Number(o.slideCount || o.slide_count) || 8,
      mode: String(o.mode || 'academic'),
      language: String(o.language || state.language || 'tr'),
      targetMinutes: Number(o.targetMinutes || o.target_minutes) || 10
    };
  }

  /**
   * Normalise whatever the backend returned, and make sure a quality score
   * exists.
   *
   * The `critique` action and the local Quality V10 engine compute the same
   * kind of number from the same deck, so when the response carries no score
   * we grade it here rather than showing the student a blank. Scoring
   * locally costs nothing — no call, no tokens, no quota.
   */
  function adoptResult(data, request) {
    const S = Schema();
    const rawSlides = data?.presentation?.slides || data?.slides || [];
    const slides = S ? S.normalizeDeck(rawSlides) : rawSlides;
    let quality = data?.quality || null;
    if (!quality && Quality()) {
      quality = Quality().reviewDeck(slides, { source_type: request.sourceType });
      quality.computed_locally = true;
    }
    return {
      version: Number(data?.version) || 11,
      run_id: data?.run_id || null,
      source: data?.source || null,
      plan: data?.plan || null,
      presentation: { ...(data?.presentation || {}), slides },
      quality,
      evidence_chunks: data?.evidence_chunks || []
    };
  }

  /**
   * Full pipeline: brief -> evidence map -> slide writer -> visual planner ->
   * academic critic. One call; the edge function runs plan and compose itself
   * when no explicit action is given.
   *
   * `busy` is a guard, not decoration: the chat routes every "make me a
   * deck" phrasing here, and a student who presses twice would otherwise get
   * two decks racing to overwrite the same presentation.
   */
  async function generate(options) {
    if (api.busy) throw new Error('Acadia V11 zaten çalışıyor — bitmesini bekleyin.');
    const request = buildRequest(options);
    if (request.sourceType === 'topic' && request.topic.length < 3) {
      throw new Error('Sunum konusu çok kısa.');
    }
    api.busy = true;
    const startedAt = Date.now();
    try {
      const data = await Services().invoke(EDGE_FUNCTION, request);
      if (data?.error) throw new Error(data.error);
      const result = adoptResult(data, request);
      api.lastRun = { at: startedAt, ms: Date.now() - startedAt, runId: result.run_id, score: result.quality?.score ?? null };
      return result;
    } finally {
      api.busy = false;
    }
  }

  /** Plan only — an outline the student can approve before slides are written. */
  async function plan(options) {
    const request = { ...buildRequest(options), action: 'plan' };
    const data = await Services().invoke(EDGE_FUNCTION, request);
    if (data?.error) throw new Error(data.error);
    return data;
  }

  /** Compose slides from a plan the caller already has. */
  async function compose(planInput, options) {
    const request = { ...buildRequest(options), action: 'compose', plan: planInput };
    const data = await Services().invoke(EDGE_FUNCTION, request);
    if (data?.error) throw new Error(data.error);
    return adoptResult(data, request);
  }

  /**
   * Score the deck currently open in the studio.
   *
   * Grades locally first and only then asks the backend: the local engine is
   * deterministic, instant and free, so the student sees a number even when
   * the function is undeployed or the daily quota is gone. A backend answer
   * replaces it when one arrives.
   */
  async function critiqueCurrent() {
    const state = Services()?.state?.() || { slides: [], sourceType: 'topic' };
    const slides = state.slides || [];
    if (slides.length === 0) throw new Error('Denetlenecek slayt yok.');

    let local = null;
    if (Quality()) {
      local = Quality().reviewDeck(slides, { source_type: state.sourceType });
      local.computed_locally = true;
    }
    try {
      const data = await Services().invoke(EDGE_FUNCTION, {
        action: 'critique',
        sourceType: state.sourceType,
        slideCount: slides.length,
        presentation: { title: state.presentation?.title || 'Deck', slides }
      });
      if (data?.quality) return data.quality;
    } catch (_err) {
      // fall through to the local score
    }
    if (!local) throw new Error('Academic Critic sonucu alınamadı.');
    return local;
  }

  /** Release the busy flag and drop cached health — used when the panel closes. */
  function close() {
    api.busy = false;
    healthState = null;
    healthCheckedAt = 0;
  }

  api.health = health;
  api.generate = generate;
  api.plan = plan;
  api.compose = compose;
  api.critiqueCurrent = critiqueCurrent;
  api.close = close;

  window.AcadiaPresentationDirectorV11 = api;
})();
