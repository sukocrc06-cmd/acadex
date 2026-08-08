/* Acadex Presentation Renderer V2 — structured AI slide renderer */
(function () {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function cleanLines(v) {
    return String(v || '').split(/\r?\n/).map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  }
  function structuredFallback(content) {
    if (!content || typeof content !== 'object') return '';
    if (Array.isArray(content.cards) && content.cards.length) return content.cards.map(x => `• ${x.title}: ${x.body}`).join('\n');
    if (Array.isArray(content.steps) && content.steps.length) return content.steps.map(x => `• ${x.label ? x.label + ' — ' : ''}${x.title}${x.body ? ': ' + x.body : ''}`).join('\n');
    if (content.metric?.value) return `• ${content.metric.value} — ${content.metric.label}${content.metric.context ? ': ' + content.metric.context : ''}`;
    if (content.table?.rows?.length) return content.table.rows.slice(0, 5).map(r => `• ${r.join(' — ')}`).join('\n');
    if (content.chart?.labels?.length) return content.chart.labels.map((x,i) => `• ${x}: ${content.chart.data?.[i] ?? ''}`).join('\n');
    return '';
  }

  const originalNormalize = window.normalizePresentationSlide;
  if (typeof originalNormalize === 'function') {
    window.normalizePresentationSlide = function (slide, index) {
      const normalized = originalNormalize(slide, index);
      normalized.content = normalized.content && typeof normalized.content === 'object' ? normalized.content : {};
      if (!String(normalized.content.text || '').trim()) {
        normalized.content.text = structuredFallback(normalized.content);
      }
      if (normalized.content.chart?.labels?.length >= 2) normalized.layout_type = 'chart';
      else if (normalized.content.table?.headers?.length >= 2) normalized.layout_type = 'table';
      else if (normalized.content.design_variant === 'comparison' && normalized.content.secondary_text) normalized.layout_type = 'two-column';
      return normalized;
    };
  }

  function show(preview, empty, actions) {
    empty.hidden = true;
    preview.hidden = false;
    actions.hidden = false;
  }
  function renderCards(preview, cards) {
    preview.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${Math.min(cards.length,3)},minmax(0,1fr));gap:.55rem;width:100%;padding:.25rem;">${cards.map((c,i)=>`<article style="min-height:108px;padding:.7rem;border:1px solid rgba(13,148,136,.22);border-radius:12px;background:linear-gradient(145deg,#fff,#f0fdfa);box-shadow:0 5px 16px rgba(15,23,42,.06);"><div style="width:26px;height:26px;border-radius:8px;background:#ccfbf1;color:#0f766e;display:grid;place-items:center;font-weight:800;font-size:.7rem;margin-bottom:.4rem;">${i+1}</div><strong style="display:block;color:#16325c;font-size:.78rem;margin-bottom:.25rem;">${esc(c.title)}</strong><span style="font-size:.66rem;line-height:1.4;color:#475569;">${esc(c.body)}</span></article>`).join('')}</div>`;
  }
  function renderSteps(preview, steps, timeline) {
    preview.innerHTML = `<div style="display:flex;align-items:stretch;gap:.35rem;width:100%;padding:.4rem .2rem;overflow:auto;">${steps.map((s,i)=>`<div style="flex:1;min-width:105px;position:relative;padding:.65rem .55rem;border-radius:12px;background:${timeline?'#f8fafc':'#f0fdfa'};border:1px solid rgba(22,50,92,.12);"><div style="font-size:.62rem;font-weight:900;color:#0d9488;margin-bottom:.35rem;">${esc(s.label || i+1)}</div><strong style="display:block;font-size:.72rem;color:#16325c;margin-bottom:.2rem;">${esc(s.title)}</strong><span style="font-size:.61rem;line-height:1.35;color:#64748b;">${esc(s.body||'')}</span></div>`).join('<div style="align-self:center;color:#0d9488;font-weight:900;">→</div>')}</div>`;
  }
  function renderMetric(preview, metric) {
    preview.innerHTML = `<div style="width:100%;min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem;border-radius:16px;background:radial-gradient(circle at top right,#ccfbf1,transparent 45%),linear-gradient(145deg,#f8fafc,#fff);border:1px solid rgba(13,148,136,.18);"><div style="font-size:2.25rem;line-height:1;font-weight:900;color:#0f766e;letter-spacing:-.04em;">${esc(metric.value)}</div><strong style="font-size:.88rem;color:#16325c;margin-top:.55rem;">${esc(metric.label)}</strong><span style="max-width:80%;font-size:.68rem;line-height:1.45;color:#64748b;margin-top:.35rem;">${esc(metric.context||'')}</span></div>`;
  }
  function renderHero(preview, slide) {
    const lines = cleanLines(slide?.content?.text).slice(0,3);
    preview.innerHTML = `<div style="width:100%;min-height:190px;display:flex;align-items:center;gap:1rem;padding:1rem;border-radius:16px;background:linear-gradient(135deg,#0f2942,#0f766e);color:white;overflow:hidden;position:relative;"><div style="position:absolute;width:160px;height:160px;border-radius:50%;right:-55px;top:-55px;background:rgba(255,255,255,.08);"></div><div style="width:54px;height:54px;border-radius:16px;background:rgba(255,255,255,.14);display:grid;place-items:center;font-size:1.6rem;flex:none;">✦</div><div style="position:relative;"><strong style="display:block;font-size:1rem;line-height:1.25;margin-bottom:.45rem;">${esc(slide.title||'')}</strong>${lines.map(x=>`<div style="font-size:.7rem;opacity:.86;margin:.18rem 0;">${esc(x)}</div>`).join('')}</div></div>`;
  }

  const originalRich = window.renderPresentationRichContent;
  window.renderPresentationRichContent = function (slide) {
    const content = slide?.content || {};
    const variant = content.design_variant || '';
    const preview = document.getElementById('pres-component-preview');
    const empty = document.getElementById('pres-component-empty');
    const actions = document.getElementById('pres-component-actions');
    if (!preview || !empty || !actions) return;

    if (typeof originalRich === 'function') originalRich(slide);
    if (!preview.hidden) return; // chart/table renderer already succeeded

    if (Array.isArray(content.cards) && content.cards.length) {
      renderCards(preview, content.cards); show(preview, empty, actions); return;
    }
    if (Array.isArray(content.steps) && content.steps.length) {
      renderSteps(preview, content.steps, variant === 'timeline'); show(preview, empty, actions); return;
    }
    if (content.metric?.value) {
      renderMetric(preview, content.metric); show(preview, empty, actions); return;
    }
    if (variant === 'hero') {
      renderHero(preview, slide); show(preview, empty, actions); return;
    }

    // Never leave an AI slide visually empty. Give section/summary slides a compact visual takeaway panel.
    const lines = cleanLines(content.text);
    if (lines.length && ['section','summary'].includes(variant)) {
      preview.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${Math.min(lines.length,3)},minmax(0,1fr));gap:.5rem;width:100%;padding:.25rem;">${lines.slice(0,6).map((x,i)=>`<div style="padding:.65rem;border-radius:11px;background:#f8fafc;border-left:3px solid #0d9488;font-size:.66rem;line-height:1.4;color:#334155;"><strong style="color:#0f766e;margin-right:.25rem;">${String(i+1).padStart(2,'0')}</strong>${esc(x)}</div>`).join('')}</div>`;
      show(preview, empty, actions);
    }
  };

  // Repair already-open/generated slides once the renderer loads.
  if (Array.isArray(window.presSlides)) {
    window.presSlides.forEach((s,i) => {
      if (!s?.content?.text?.trim()) s.content.text = structuredFallback(s.content);
      s.order_index = i;
    });
    if (typeof window.renderPresentationSlidesList === 'function') window.renderPresentationSlidesList();
    if (typeof window.renderActivePresentationSlide === 'function' && window.presSlides.length) window.renderActivePresentationSlide();
  }
})();
