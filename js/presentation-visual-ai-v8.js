/* Acadex Presentation Visual AI V8 — generate table/chart from current slide (studio fix 3/6) */
(function () {
  'use strict';
  if (window.__acadexPresentationVisualAiV8) return;
  window.__acadexPresentationVisualAiV8 = true;

  let busy = false;

  function injectStyles() {
    if (document.getElementById('acadex-pres-visual-ai-v8-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-pres-visual-ai-v8-style';
    style.textContent = `
      .pres-visual-ai-actions { display:flex; flex-direction:column; gap:.35rem; margin-top:.55rem; }
      .pres-visual-ai-actions .pres-btn { justify-content:flex-start; width:100%; font-size:.78rem; }
      .pres-visual-ai-actions .pres-btn:disabled { opacity:.6; cursor:wait; }
      .pres-visual-ai-note {
        margin-top:.35rem; font-size:.66rem; color:#64748b; line-height:1.4;
      }
      .pres-visual-ai-note.is-error { color:#b91c1c; }
      .pres-visual-ai-note.is-ok { color:#0f766e; }
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    injectStyles();
    if (document.getElementById('pres-visual-ai-actions')) return;

    const host =
      document.querySelector('#pres-studio-mode .pres-tool-card h4[data-i18n="dash.presentation.imageUpload"]')?.parentElement
      || document.getElementById('pres-upload-zone')?.parentElement
      || document.getElementById('pres-insert-table-btn')?.closest('.pres-tool-card');

    if (!host) return;

    const box = document.createElement('div');
    box.id = 'pres-visual-ai-actions';
    box.className = 'pres-visual-ai-actions';
    box.innerHTML = `
      <button type="button" class="pres-btn" id="pres-ai-make-table-btn">📊 Acadia ile tablo üret</button>
      <button type="button" class="pres-btn" id="pres-ai-make-chart-btn">📈 Acadia ile grafik / görsel üret</button>
      <p class="pres-visual-ai-note" id="pres-visual-ai-status">Aktif slaytın metninden tablo veya grafik taslağı üretir. Sayı yoksa güvenli tablo önerir.</p>
    `;

    const uploadBtn = document.getElementById('pres-upload-btn');
    if (uploadBtn && uploadBtn.parentElement === host) {
      uploadBtn.insertAdjacentElement('afterend', box);
    } else {
      host.appendChild(box);
    }

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
    ['pres-ai-make-table-btn', 'pres-ai-make-chart-btn'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !!isBusy;
    });
  }

  function activeSlide() {
    try {
      if (!Array.isArray(window.presSlides)) return null;
      return window.presSlides[window.presActiveSlide] || null;
    } catch (_) {
      return null;
    }
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
      return `Create a clear academic TABLE from this slide only. Language: ${lang}.
Return layout_type "table" and a table object with title, headers (2-5 cols), and 2-6 factual rows grounded in the slide text.
Do not invent statistics, citations, or numbers that are not implied by the slide.
Prefer comparison / definition / process-checklist tables.
Keep a short explanatory text. No instruction leakage.`;
    }
    return `From this slide, add a visual:
- If real numeric values exist, create a chart (bar preferred) with real labels/data (never "Value 1/2/3" or "Değer 1").
- If no trustworthy numbers exist, create a comparison TABLE instead (do not invent chart data).
Language: ${lang}. Keep short explanatory text. No instruction leakage.
Set layout_type to chart or table accordingly.`;
  }

  function applyRefined(slide, refined) {
    if (!refined || typeof refined !== 'object') return false;
    const content = { ...(slide.content && typeof slide.content === 'object' ? slide.content : {}) };
    const rc = refined.content && typeof refined.content === 'object' ? refined.content : refined;

    if (typeof refined.title === 'string' && refined.title.trim()) {
      slide.title = refined.title.trim().slice(0, 160);
    }

    const text = rc.text ?? refined.text;
    const secondary = rc.secondary_text ?? refined.secondary_text;
    if (typeof text === 'string') content.text = text;
    if (typeof secondary === 'string') content.secondary_text = secondary;

    const table = rc.table ?? refined.table;
    const chart = rc.chart ?? refined.chart;
    const cards = rc.cards ?? refined.cards;
    const steps = rc.steps ?? refined.steps;
    const diagram = rc.diagram ?? refined.diagram;
    const metric = rc.metric ?? refined.metric;
    const variant = rc.design_variant ?? refined.design_variant;

    if (table && Array.isArray(table.headers) && Array.isArray(table.rows)) {
      content.table = table;
      content.design_variant = 'comparison';
      slide.layout_type = 'table';
      // chart optional keep/remove
    }
    if (chart && Array.isArray(chart.labels) && Array.isArray(chart.data)) {
      content.chart = chart;
      content.design_variant = 'data';
      slide.layout_type = 'chart';
    }
    if (Array.isArray(cards) && cards.length >= 2) content.cards = cards;
    if (Array.isArray(steps) && steps.length >= 2) content.steps = steps;
    if (diagram) content.diagram = diagram;
    if (metric) content.metric = metric;
    if (typeof variant === 'string' && variant.trim()) content.design_variant = variant.trim();

    if (typeof refined.speaker_notes === 'string') slide.speaker_notes = refined.speaker_notes;
    if (typeof refined.layout_type === 'string' && refined.layout_type.trim()) {
      // prefer structured visual layout when we got table/chart
      if (!(content.table || content.chart)) slide.layout_type = refined.layout_type;
    }

    slide.content = content;

    // Dedupe if available
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
    const slide = activeSlide();
    if (!slide) {
      setStatus('Önce bir sunum ve slayt açın.', 'is-error');
      return;
    }
    if (!window.presCurrentId) {
      setStatus('Sunum kaydı gerekli. Önce kaydedin.', 'is-error');
      return;
    }
    if (!window.supabaseClient) {
      setStatus('Bağlantı hazır değil.', 'is-error');
      return;
    }

    try {
      if (typeof window.syncActiveSlideFromEditor === 'function') window.syncActiveSlideFromEditor();
    } catch (_) {}

    setBusy(true);
    setStatus(kind === 'table' ? 'Acadia tablo hazırlıyor…' : 'Acadia görsel hazırlıyor…');

    try {
      const language = window.presCurrentPresentation?.language === 'en' ? 'en' : 'tr';
      const { data, error } = await window.supabaseClient.functions.invoke('generate-presentation', {
        body: {
          action: 'improve_slide',
          presentationId: window.presCurrentId,
          language,
          instruction: instructionFor(kind, language),
          slide: slidePayload(slide),
        },
      });

      if (error || !data?.slide) {
        throw new Error(data?.error || error?.message || 'AI yanıtı alınamadı');
      }

      const ok = applyRefined(slide, data.slide);
      try {
        if (typeof window.markPresentationDirty === 'function') window.markPresentationDirty();
        else window.presIsDirty = true;
      } catch (_) {}
      try {
        if (typeof window.renderPresentationSlidesList === 'function') window.renderPresentationSlidesList();
        if (typeof window.renderActivePresentationSlide === 'function') window.renderActivePresentationSlide();
        if (typeof window.renderPresentationRichContent === 'function') window.renderPresentationRichContent(slide);
      } catch (_) {}

      if (ok) {
        setStatus(
          kind === 'table'
            ? 'Tablo eklendi. Beğenmezsen düzenleyebilir veya tekrar üretebilirsin.'
            : 'Görsel bileşen eklendi. Sayı yoksa tablo önerilmiş olabilir.',
          'is-ok'
        );
        if (typeof window.showDashboardAlert === 'function') {
          window.showDashboardAlert('success', kind === 'table' ? 'Tablo üretildi.' : 'Görsel üretildi.');
        }
      } else {
        setStatus('Üretim tamamlandı ama tablo/grafik alanları boş kaldı. Tekrar deneyin.', 'is-error');
      }
    } catch (e) {
      console.error('Visual AI failed:', e);
      setStatus(e?.message || 'Üretim başarısız. Biraz sonra tekrar deneyin.', 'is-error');
    } finally {
      setBusy(false);
    }
  }

  function boot() {
    ensureUi();
  }

  window.AcadexPresentationVisualAiV8 = {
    generateFromSlide,
    ensureUi,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 800);
  setTimeout(boot, 2000);
})();
