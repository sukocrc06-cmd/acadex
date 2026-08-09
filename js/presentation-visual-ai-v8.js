/* Acadex Presentation Visual AI V8 — table/chart from active slide (fixed global access) */
(function () {
  'use strict';
  if (window.__acadexPresentationVisualAiV8) return;
  window.__acadexPresentationVisualAiV8 = true;

  let busy = false;

  /** dashboard.js uses top-level let — NOT on window. Read global lexical bindings. */
  function readGlobals() {
    const g = {
      slides: null,
      active: 0,
      currentId: null,
      presentation: null,
    };
    try {
      // eslint-disable-next-line no-undef
      if (typeof presSlides !== 'undefined' && Array.isArray(presSlides)) g.slides = presSlides;
    } catch (_) {}
    try {
      if (Array.isArray(window.presSlides)) g.slides = window.presSlides;
    } catch (_) {}
    try {
      // eslint-disable-next-line no-undef
      if (typeof presActiveSlide !== 'undefined') g.active = Number(presActiveSlide) || 0;
    } catch (_) {}
    try {
      if (typeof window.presActiveSlide === 'number') g.active = window.presActiveSlide;
    } catch (_) {}
    try {
      // eslint-disable-next-line no-undef
      if (typeof presCurrentId !== 'undefined' && presCurrentId) g.currentId = presCurrentId;
    } catch (_) {}
    try {
      if (window.presCurrentId) g.currentId = window.presCurrentId;
    } catch (_) {}
    try {
      // eslint-disable-next-line no-undef
      if (typeof presCurrentPresentation !== 'undefined') g.presentation = presCurrentPresentation;
    } catch (_) {}
    try {
      if (window.presCurrentPresentation) g.presentation = window.presCurrentPresentation;
    } catch (_) {}
    return g;
  }

  function injectStyles() {
    if (document.getElementById('acadex-pres-visual-ai-v8-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-pres-visual-ai-v8-style';
    style.textContent = `
      .pres-visual-ai-actions { display:flex; flex-direction:column; gap:.35rem; margin-top:.55rem; }
      .pres-visual-ai-actions .pres-btn { justify-content:flex-start; width:100%; font-size:.78rem; }
      .pres-visual-ai-actions .pres-btn:disabled { opacity:.6; cursor:wait; }
      .pres-visual-ai-note { margin-top:.35rem; font-size:.66rem; color:#64748b; line-height:1.4; }
      .pres-visual-ai-note.is-error { color:#b91c1c; }
      .pres-visual-ai-note.is-ok { color:#0f766e; }
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    injectStyles();
    if (document.getElementById('pres-visual-ai-actions')) return;
    const host =
      document.querySelector('#pres-studio-mode .pres-tool-card h4')?.parentElement
      || document.getElementById('pres-upload-zone')?.parentElement;
    if (!host) return;

    const box = document.createElement('div');
    box.id = 'pres-visual-ai-actions';
    box.className = 'pres-visual-ai-actions';
    box.innerHTML = `
      <button type="button" class="pres-btn" id="pres-ai-make-table-btn">📊 Acadia ile tablo üret</button>
      <button type="button" class="pres-btn" id="pres-ai-make-chart-btn">📈 Acadia ile grafik / görsel üret</button>
      <p class="pres-visual-ai-note" id="pres-visual-ai-status">Aktif slayt metninden tablo veya grafik üretir.</p>
    `;
    const uploadBtn = document.getElementById('pres-upload-btn');
    if (uploadBtn && uploadBtn.parentElement === host) uploadBtn.insertAdjacentElement('afterend', box);
    else host.appendChild(box);

    document.getElementById('pres-ai-make-table-btn')?.addEventListener('click', () => generateFromSlide('table'));
    document.getElementById('pres-ai-make-chart-btn')?.addEventListener('click', () => generateFromSlide('chart'));
  }

  function setStatus(message, kind) {
    const el = document.getElementById('pres-visual-ai-status');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('is-error', 'is-ok');
    if (kind) el.classList.add(kind);
  }

  function setBusy(isBusy) {
    busy = isBusy;
    ['pres-ai-make-table-btn', 'pres-ai-make-chart-btn', 'pres-ux-ai-table', 'pres-ux-ai-chart'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !!isBusy;
    });
  }

  function activeSlide() {
    const g = readGlobals();
    if (!g.slides || !g.slides.length) return null;
    const idx = Math.max(0, Math.min(g.slides.length - 1, g.active || 0));
    return g.slides[idx] || null;
  }

  function slidePayload(slide) {
    const content = slide.content && typeof slide.content === 'object' ? slide.content : {};
    const text = typeof window.getPresentationSlideText === 'function'
      ? window.getPresentationSlideText(slide)
      : String(content.text || '');
    const secondary = typeof window.getPresentationSlideSecondaryText === 'function'
      ? window.getPresentationSlideSecondaryText(slide)
      : String(content.secondary_text || '');
    return {
      title: slide.title || '',
      text,
      secondary_text: secondary,
      speaker_notes: slide.speaker_notes || '',
      layout_type: slide.layout_type || 'title-content',
      design_variant: content.design_variant || '',
      table: content.table || null,
      chart: content.chart || null,
      cards: content.cards || null,
      steps: content.steps || null,
    };
  }

  function instructionFor(kind, language) {
    const lang = language === 'en' ? 'English' : 'Turkish';
    if (kind === 'table') {
      return `Create one academic TABLE from this slide only. Language: ${lang}.
Return layout_type "table" and table {title, headers, rows} grounded in the slide.
Do not invent numbers. Keep short text. No instruction leakage.`;
    }
    return `From this slide add a visual. Language: ${lang}.
If real numbers exist, create chart with real labels/data (never Değer 1 / Value 1).
If no trustworthy numbers, create a comparison TABLE instead.
Set layout_type chart or table. Keep short text. No instruction leakage.`;
  }

  function applyRefined(slide, refined) {
    if (!refined || typeof refined !== 'object') return false;
    const content = { ...(slide.content && typeof slide.content === 'object' ? slide.content : {}) };
    const rc = refined.content && typeof refined.content === 'object' ? refined.content : refined;

    if (typeof refined.title === 'string' && refined.title.trim()) {
      slide.title = refined.title.trim().slice(0, 160);
    }
    if (typeof (rc.text ?? refined.text) === 'string') content.text = rc.text ?? refined.text;
    if (typeof (rc.secondary_text ?? refined.secondary_text) === 'string') {
      content.secondary_text = rc.secondary_text ?? refined.secondary_text;
    }

    const table = rc.table ?? refined.table;
    const chart = rc.chart ?? refined.chart;
    if (table && Array.isArray(table.headers) && Array.isArray(table.rows)) {
      content.table = table;
      content.design_variant = 'comparison';
      slide.layout_type = 'table';
    }
    if (chart && Array.isArray(chart.labels) && Array.isArray(chart.data)) {
      content.chart = chart;
      content.design_variant = 'data';
      slide.layout_type = 'chart';
    }
    if (Array.isArray(rc.cards)) content.cards = rc.cards;
    if (Array.isArray(rc.steps)) content.steps = rc.steps;
    if (rc.diagram) content.diagram = rc.diagram;
    if (rc.metric) content.metric = rc.metric;
    if (typeof rc.design_variant === 'string' && rc.design_variant.trim()) {
      content.design_variant = rc.design_variant.trim();
    }
    if (typeof refined.speaker_notes === 'string') slide.speaker_notes = refined.speaker_notes;

    slide.content = content;
    try {
      if (window.AcadexPresentationDedupeV8?.dedupeSlide) {
        const fixed = window.AcadexPresentationDedupeV8.dedupeSlide(slide);
        Object.assign(slide, fixed);
      }
    } catch (_) {}
    return !!(content.table || content.chart || content.cards || content.steps);
  }

  async function generateFromSlide(kind) {
    if (busy) return;
    const g = readGlobals();
    const slide = activeSlide();
    if (!slide) {
      setStatus('Aktif slayt bulunamadı. Sol listeden bir slayt seçin.', 'is-error');
      return;
    }
    if (!g.currentId) {
      setStatus('Sunum kaydı gerekli. Önce Kaydet’e basın.', 'is-error');
      return;
    }
    if (!window.supabaseClient) {
      setStatus('Bağlantı hazır değil.', 'is-error');
      return;
    }

    try {
      if (typeof window.syncActiveSlideFromEditor === 'function') window.syncActiveSlideFromEditor();
      else if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor();
    } catch (_) {}

    setBusy(true);
    setStatus(kind === 'table' ? 'Acadia tablo hazırlıyor…' : 'Acadia görsel hazırlıyor…');

    try {
      const language = g.presentation?.language === 'en' ? 'en' : 'tr';
      const { data, error } = await window.supabaseClient.functions.invoke('generate-presentation', {
        body: {
          action: 'improve_slide',
          presentationId: g.currentId,
          language,
          instruction: instructionFor(kind, language),
          slide: slidePayload(slide),
        },
      });
      if (error || !data?.slide) throw new Error(data?.error || error?.message || 'AI yanıtı alınamadı');

      const ok = applyRefined(slide, data.slide);
      try {
        if (typeof markPresentationDirty === 'function') markPresentationDirty();
        else if (typeof window.markPresentationDirty === 'function') window.markPresentationDirty();
        else window.presIsDirty = true;
      } catch (_) {}
      try {
        if (typeof renderPresentationSlidesList === 'function') renderPresentationSlidesList();
        if (typeof renderActivePresentationSlide === 'function') renderActivePresentationSlide();
        if (typeof renderPresentationRichContent === 'function') renderPresentationRichContent(slide);
      } catch (_) {}

      setStatus(
        ok
          ? (kind === 'table' ? 'Tablo eklendi.' : 'Görsel eklendi. Sayı yoksa tablo önerilmiş olabilir.')
          : 'Üretim bitti ama tablo/grafik boş kaldı. Tekrar deneyin.',
        ok ? 'is-ok' : 'is-error'
      );
      if (ok && typeof showDashboardAlert === 'function') {
        showDashboardAlert('success', kind === 'table' ? 'Tablo üretildi.' : 'Görsel üretildi.');
      }
    } catch (e) {
      console.error('Visual AI failed:', e);
      setStatus(e?.message || 'Üretim başarısız.', 'is-error');
    } finally {
      setBusy(false);
    }
  }

  window.AcadexPresentationVisualAiV8 = { generateFromSlide, ensureUi, readGlobals };

  function boot() { ensureUi(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 800);
  setTimeout(boot, 2000);
})();
