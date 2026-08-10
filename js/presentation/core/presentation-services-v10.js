/* Acadex Presentation Studio V10 — shared service/runtime layer.
 * One safe gateway for presentation state, Supabase access, edge calls and events.
 * Legacy V7/V8/V9 modules can keep running while new V10 modules depend on this API.
 */
(function () {
  'use strict';
  if (window.AcadexPresentationServicesV10) return;

  const listeners = new Map();

  function resolveSupabase() {
    try {
      // supabase-config.js defines a global lexical binding in the page realm.
      if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
    } catch (_) {}
    try {
      if (window.supabaseClient) return window.supabaseClient;
    } catch (_) {}
    try {
      if (window.__acadexSupabase) return window.__acadexSupabase;
    } catch (_) {}
    return null;
  }

  function state() {
    const out = {
      slides: [],
      activeIndex: 0,
      presentationId: null,
      presentation: null,
      dirty: false,
    };
    try { if (typeof presSlides !== 'undefined' && Array.isArray(presSlides)) out.slides = presSlides; } catch (_) {}
    try { if (!out.slides.length && Array.isArray(window.presSlides)) out.slides = window.presSlides; } catch (_) {}
    try { if (typeof presActiveSlide !== 'undefined') out.activeIndex = Number(presActiveSlide) || 0; } catch (_) {}
    try { if (typeof window.presActiveSlide === 'number') out.activeIndex = window.presActiveSlide; } catch (_) {}
    try { if (typeof presCurrentId !== 'undefined' && presCurrentId) out.presentationId = presCurrentId; } catch (_) {}
    try { if (!out.presentationId && window.presCurrentId) out.presentationId = window.presCurrentId; } catch (_) {}
    try { if (typeof presCurrentPresentation !== 'undefined' && presCurrentPresentation) out.presentation = presCurrentPresentation; } catch (_) {}
    try { if (!out.presentation && window.presCurrentPresentation) out.presentation = window.presCurrentPresentation; } catch (_) {}
    try { if (typeof presIsDirty !== 'undefined') out.dirty = !!presIsDirty; } catch (_) {}
    try { if (typeof window.presIsDirty === 'boolean') out.dirty = window.presIsDirty; } catch (_) {}
    out.activeIndex = Math.max(0, Math.min(Math.max(0, out.slides.length - 1), out.activeIndex));
    return out;
  }

  function activeSlide() {
    const s = state();
    return s.slides[s.activeIndex] || null;
  }

  function markDirty() {
    try {
      if (typeof markPresentationDirty === 'function') {
        markPresentationDirty();
        return;
      }
    } catch (_) {}
    try {
      if (typeof presIsDirty !== 'undefined') presIsDirty = true;
    } catch (_) {}
    try { window.presIsDirty = true; } catch (_) {}
    emit('dirty', { dirty: true });
  }

  function render() {
    try { if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList(); } catch (_) {}
    try { if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide(); } catch (_) {}
    try {
      const slide = activeSlide();
      if (slide && typeof renderPresentationRichContent === 'function') renderPresentationRichContent(slide);
    } catch (_) {}
    emit('render', state());
  }

  async function invoke(functionName, body, options) {
    const client = resolveSupabase();
    if (!client?.functions?.invoke) throw new Error('Supabase function client is not available.');
    const result = await client.functions.invoke(functionName, {
      body: body || {},
      ...(options || {}),
    });
    if (result?.error) {
      const message = result.data?.error || result.error?.message || `${functionName} failed`;
      const err = new Error(message);
      err.cause = result.error;
      throw err;
    }
    return result?.data;
  }

  function on(eventName, handler) {
    if (typeof handler !== 'function') return function noop() {};
    const bucket = listeners.get(eventName) || new Set();
    bucket.add(handler);
    listeners.set(eventName, bucket);
    return () => bucket.delete(handler);
  }

  function emit(eventName, payload) {
    const bucket = listeners.get(eventName);
    if (!bucket) return;
    bucket.forEach((handler) => {
      try { handler(payload); } catch (error) { console.error(`[Presentation V10] ${eventName} listener failed`, error); }
    });
  }

  function cleanText(value, maxLength) {
    const text = String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim();
    return Number.isFinite(maxLength) ? text.slice(0, maxLength) : text;
  }

  function clone(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function notify(message, type) {
    const level = type || 'success';
    try {
      if (typeof showDashboardAlert === 'function') {
        showDashboardAlert(level, message);
        return;
      }
    } catch (_) {}
    (level === 'error' ? console.error : console.info)(message);
  }

  window.AcadexPresentationServicesV10 = {
    version: '10.0.0',
    resolveSupabase,
    state,
    activeSlide,
    markDirty,
    render,
    invoke,
    on,
    emit,
    cleanText,
    clone,
    notify,
  };
})();
