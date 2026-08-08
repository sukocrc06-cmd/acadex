/* Acadex Presentation Renderer V7 — editor renderer backed by the unified slide model */
(function () {
  'use strict';
  if (window.__acadexPresentationRendererV7) return;
  window.__acadexPresentationRendererV7 = true;

  const model = () => window.AcadexPresentationModelV7;

  function injectStyles() {
    if (document.getElementById('acadex-presentation-v7-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-presentation-v7-style';
    style.textContent = `
      .ap7-combo{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:1rem;align-items:stretch;width:100%;height:100%}
      .ap7-copy{min-width:0;overflow:auto;padding:.15rem .2rem}.ap7-visual{min-width:0;overflow:auto;display:flex;align-items:stretch}
      .ap7-bullets{display:grid;gap:.48rem;font-size:.83rem;line-height:1.5;color:#24364b}.ap7-bullets p{margin:0;display:flex;gap:.5rem}.ap7-bullets span{color:#0d9488;font-weight:900}
      .ap7-cols{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;font-size:.75rem;line-height:1.45}.ap7-cols>div{padding:.7rem;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0}.ap7-cols p{margin:0 0 .42rem;display:flex;gap:.4rem}.ap7-cols span{color:#0d9488;font-weight:900}
      .ap7-table-wrap{width:100%;overflow:auto;border:1px solid #dbe3eb;border-radius:12px;background:#fff}.ap7-table{width:100%;border-collapse:collapse;font-size:.68rem}.ap7-table th{background:#e6f7f5;color:#0f5f59;text-align:left;font-weight:800}.ap7-table th,.ap7-table td{border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:.5rem}.ap7-table tr:last-child td{border-bottom:0}.ap7-table th:last-child,.ap7-table td:last-child{border-right:0}
      .ap7-chart{display:grid;gap:.5rem;width:100%;align-content:center}.ap7-bar{display:grid;grid-template-columns:minmax(80px,1.1fr) 2.5fr auto;gap:.5rem;align-items:center;font-size:.67rem;color:#334155}.ap7-bar i{height:15px;background:#e2e8f0;border-radius:999px;overflow:hidden}.ap7-bar b{display:block;height:100%;background:linear-gradient(90deg,#0f766e,#2dd4bf);border-radius:999px}.ap7-bar strong{font-size:.68rem;color:#16325c}
      .ap7-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem;width:100%}.ap7-cards article{padding:.65rem;border:1px solid #ccfbf1;border-radius:12px;background:linear-gradient(145deg,#fff,#f0fdfa);box-shadow:0 4px 14px rgba(15,23,42,.05)}.ap7-cards small{display:inline-grid;place-items:center;width:27px;height:27px;border-radius:8px;background:#ccfbf1;color:#0f766e;font-weight:900;font-size:.58rem;margin-bottom:.4rem}.ap7-cards strong{display:block;color:#16325c;font-size:.72rem;margin-bottom:.25rem}.ap7-cards p{margin:0;color:#64748b;font-size:.61rem;line-height:1.4}
      .ap7-steps,.ap7-diagram{display:flex;gap:.35rem;align-items:stretch;width:100%;overflow:auto}.ap7-steps article,.ap7-diagram article{flex:1;min-width:105px;padding:.6rem;border:1px solid #ccfbf1;border-radius:12px;background:#f0fdfa}.ap7-steps article span,.ap7-diagram article span{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#0f766e;color:#fff;font-weight:900;font-size:.57rem;margin-bottom:.4rem}.ap7-steps strong,.ap7-diagram strong{display:block;font-size:.68rem;color:#16325c}.ap7-steps p,.ap7-diagram p{font-size:.58rem;color:#64748b;line-height:1.38;margin:.25rem 0 0}.ap7-steps em,.ap7-diagram em{align-self:center;color:#0d9488;font-size:.9rem;font-style:normal;font-weight:900}.ap7-diagram.type-matrix{display:grid;grid-template-columns:1fr 1fr}.ap7-diagram.type-matrix em{display:none}
      .ap7-metric{width:100%;min-height:150px;border-radius:16px;background:radial-gradient(circle at top right,#99f6e4,transparent 42%),linear-gradient(145deg,#f8fafc,#fff);border:1px solid #99f6e4;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem}.ap7-metric b{font-size:2rem;color:#0f766e;line-height:1}.ap7-metric strong{font-size:.78rem;color:#16325c;margin-top:.45rem}.ap7-metric p{font-size:.62rem;color:#64748b;max-width:86%;line-height:1.4}
      .ap7-empty{font-size:.72rem;color:#94a3b8;padding:1rem;text-align:center}
      #pres-component-preview.ap7-direct{display:block!important;width:100%;height:100%;overflow:auto;padding:.25rem!important}
      #pres-component-preview.ap7-direct + #pres-component-actions{margin-top:.35rem}
      @media(max-width:900px){.ap7-combo{grid-template-columns:1fr}.ap7-cards{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function repairSlide(slide, index) {
    const m = model();
    if (!m || !slide) return slide;
    const normalized = m.normalize(slide, index);
    const c = normalized.content;

    // Old renderer versions created placeholder charts from numbered bullets.
    // Delete those charts permanently in-memory so they cannot leak into preview/export.
    if (c.chart && m.isGenericChart(c.chart)) {
      delete c.chart;
      if (normalized.layout_type === 'chart') normalized.layout_type = 'title-content';
    }
    if (normalized.layout_type === 'table' && !m.validTable(c.table)) normalized.layout_type = 'title-content';
    if (normalized.layout_type === 'chart' && !m.validChart(c.chart)) normalized.layout_type = 'title-content';
    return normalized;
  }

  const originalNormalize = window.normalizePresentationSlide;
  window.normalizePresentationSlide = function (slide, index) {
    const base = typeof originalNormalize === 'function' ? originalNormalize(slide, index) : slide;
    return repairSlide(base, index);
  };

  const originalRich = window.renderPresentationRichContent;
  window.renderPresentationRichContent = function (slide) {
    injectStyles();
    const preview = document.getElementById('pres-component-preview');
    const empty = document.getElementById('pres-component-empty');
    const actions = document.getElementById('pres-component-actions');
    const m = model();
    if (!m || !preview || !empty || !actions) {
      if (typeof originalRich === 'function') return originalRich(slide);
      return;
    }

    const normalized = repairSlide(slide, 0);
    const visual = m.renderVisual(normalized);
    if (!visual) {
      preview.classList.remove('ap7-direct');
      if (typeof originalRich === 'function') return originalRich(normalized);
      preview.hidden = true;
      actions.hidden = true;
      empty.hidden = false;
      return;
    }

    // Real visual data exists: show it directly. Never show "Tablo Alanı / Grafik Alanı" above it.
    preview.innerHTML = visual;
    preview.classList.add('ap7-direct');
    preview.hidden = false;
    empty.hidden = true;
    actions.hidden = false;
  };

  window.AcadexPresentationRendererV7 = {
    repairSlide,
    repairDeck() {
      try {
        if (!Array.isArray(presSlides)) return false;
        let changed = false;
        presSlides.forEach((slide, index) => {
          const repaired = repairSlide(slide, index);
          if (repaired !== slide || JSON.stringify(repaired) !== JSON.stringify(slide)) {
            presSlides[index] = repaired;
            changed = true;
          }
        });
        return changed;
      } catch (_) { return false; }
    }
  };

  injectStyles();
})();
