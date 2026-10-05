/* ==========================================================================
   Acadex Presentation Services V10 — shared Supabase + state access layer

   WHY THIS FILE EXISTS (05.10.2026):
   The V10/V11 presentation work shipped its BACKEND
   (supabase/functions/acadia-presentation-director) and its CHAT UI
   (js/presentation/ai/acadia-presentation-chat-v11.js), but the layer
   between them was never committed — no commit in the repository's entire
   history touches js/presentation/core/. Two smoke tests written on
   2026-09-26 import it and have therefore never run.

   This file is reconstructed from three sources that DO exist and agree:
     - tests/presentation-v10-quality-smoke.js   (the API and its contracts)
     - tests/presentation-v11-director-smoke.js  (Services.invoke)
     - js/presentation/ai/acadia-presentation-chat-v11.js  (Services().state())

   It is new code, not recovered code. Where the tests pin behaviour it
   follows them exactly; everything else is written to match the conventions
   of the V7/V8 modules alongside it.
   ========================================================================== */
(function () {
  'use strict';
  if (window.AcadexPresentationServicesV10) return;

  /**
   * The Supabase client, or null.
   *
   * "missing Supabase must safely return null WITHOUT RECURSION" is pinned by
   * the V10 smoke test, and the warning is pointed enough to be worth
   * keeping: the obvious way to write this helper is to have it fall back to
   * another getter that falls back to this one. In the browser that is an
   * instant stack overflow on any page where the client failed to load —
   * which is exactly the page where you most need a clean null.
   *
   * So: every candidate is read directly off a global, none of them calls
   * back into this function, and anything that is not an object with a
   * `from` method is rejected rather than returned half-working.
   */
  function resolveSupabase() {
    const candidates = [
      typeof window !== 'undefined' ? window.supabaseClient : null,
      typeof window !== 'undefined' ? window.supabase : null,
      typeof window !== 'undefined' ? window.acadexSupabase : null
    ];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && typeof candidate.from === 'function') {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Call a Supabase Edge Function and return its JSON body.
   *
   * Throws rather than returning an error shape: the V11 director's health
   * check distinguishes "backend answered" from "backend missing" by
   * catching, and a resolved promise carrying an error object would read as
   * success.
   */
  async function invoke(name, body, options) {
    const client = resolveSupabase();
    if (!client || typeof client.functions?.invoke !== 'function') {
      throw new Error(`Supabase unavailable — cannot invoke "${name}".`);
    }
    const { data, error } = await client.functions.invoke(name, {
      body: body || {},
      ...(options || {})
    });
    if (error) throw error;
    return data;
  }

  /**
   * A read-only snapshot of what the studio currently has open.
   *
   * The V7 studio keeps these as page globals (presCurrentPresentation,
   * presSlides, presActiveIndex). Reading them through one accessor means
   * the V11 chat does not have to know that, and a missing global produces
   * an empty deck instead of a ReferenceError — the chat module already
   * relies on that, calling `Services()?.state?.()` and defaulting.
   */
  function readGlobal(name) {
    try {
      // eslint-disable-next-line no-eval
      return typeof window !== 'undefined' && name in window ? window[name] : undefined;
    } catch (_) {
      return undefined;
    }
  }

  function state() {
    const presentation = readGlobal('presCurrentPresentation') || null;
    const slides = readGlobal('presSlides');
    const activeIndex = readGlobal('presActiveIndex');
    return {
      presentation,
      presentationId: presentation?.id || null,
      slides: Array.isArray(slides) ? slides : [],
      activeIndex: Number.isInteger(activeIndex) ? activeIndex : 0,
      isDirty: readGlobal('presIsDirty') === true,
      language: presentation?.language || 'tr',
      sourceType: presentation?.source_type || 'topic'
    };
  }

  /** The slide the user is looking at, or null. */
  function activeSlide() {
    const { slides, activeIndex } = state();
    return slides[activeIndex] || null;
  }

  window.AcadexPresentationServicesV10 = {
    version: '10.0.0',
    resolveSupabase,
    invoke,
    state,
    activeSlide
  };
})();
