/* Acadex Presentation Studio V7.3 — independent scrolling, safe modal portals, and deterministic visual enrichment */
(function () {
  'use strict';
  if (window.__acadexPresentationStudioV73) return;
  window.__acadexPresentationStudioV73 = true;

  const m = () => window.AcadexPresentationModelV7;

  function injectStyles() {
    if (document.getElementById('acadex-presentation-v73-style')) return;
    const style = document.createElement('style');
    style.id = 'acadex-presentation-v73-style';
    style.textContent = `
      /* The studio is a viewport application: toolbar/footer stay put, each column scrolls by itself. */
      #pres-studio-mode.pres-studio{
        height:calc(100dvh - 112px)!important;
        max-height:calc(100dvh - 112px)!important;
        min-height:0!important;
        overflow:hidden!important;
      }
      #pres-studio-mode .pres-toolbar,#pres-studio-mode .pres-footer{flex:0 0 auto!important}
      #pres-studio-mode .pres-body{flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;align-items:stretch!important}
      #pres-studio-mode .pres-panel{min-height:0!important;overflow:hidden!important}
      #pres-studio-mode .pres-panel-left .pres-slides-list{
        flex:1 1 auto!important;min-height:0!important;overflow-y:scroll!important;overflow-x:hidden!important;
        overscroll-behavior:contain!important;scrollbar-gutter:stable!important;
      }
      #pres-studio-mode .pres-canvas-wrap{
        flex:1 1 auto!important;min-height:0!important;overflow-y:scroll!important;overflow-x:hidden!important;
        overscroll-behavior:contain!important;scrollbar-gutter:stable!important;padding:.8rem!important;
      }
      #pres-studio-mode .pres-panel-right .pres-right-body{
        flex:1 1 auto!important;min-height:0!important;overflow-y:scroll!important;overflow-x:hidden!important;
        overscroll-behavior:contain!important;scrollbar-gutter:stable!important;padding-bottom:1rem!important;
      }
      #pres-studio-mode .pres-canvas{width:min(100%,1100px)!important;min-height:390px!important}
      #pres-studio-mode .pres-speaker-notes{flex:0 0 auto!important}

      #pres-studio-mode .pres-slides-list,
      #pres-studio-mode .pres-canvas-wrap,
      #pres-studio-mode .pres-right-body,
      .pres-builder-body{scrollbar-width:thin;scrollbar-color:rgba(31,138,147,.5) transparent}
      #pres-studio-mode .pres-slides-list::-webkit-scrollbar,
      #pres-studio-mode .pres-canvas-wrap::-webkit-scrollbar,
      #pres-studio-mode .pres-right-body::-webkit-scrollbar,
      .pres-builder-body::-webkit-scrollbar{width:8px;height:8px}
      #pres-studio-mode .pres-slides-list::-webkit-scrollbar-thumb,
      #pres-studio-mode .pres-canvas-wrap::-webkit-scrollbar-thumb,
      #pres-studio-mode .pres-right-body::-webkit-scrollbar-thumb,
      .pres-builder-body::-webkit-scrollbar-thumb{background:rgba(31,138,147,.42);border-radius:999px}

      /* Any structured visual is visible beside the explanation, not hidden behind a layout placeholder. */
      #pres-slide-layout-body.ap73-has-visual{
        grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr)!important;
        grid-template-areas:"primary component"!important;
        gap:1rem!important;
      }
      #pres-slide-layout-body.ap73-has-visual #pres-layout-placeholder{display:flex!important;min-height:180px!important}
      #pres-slide-layout-body.ap73-has-visual #pres-component-empty{display:none!important}
      #pres-slide-layout-body.ap73-has-visual #pres-component-preview{display:block!important;height:100%!important}

      /* More recognisable academic diagrams. */
      .ap7-diagram.type-hierarchy{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem .7rem!important;align-items:stretch!important;overflow:visible!important}
      .ap7-diagram.type-hierarchy em{display:none!important}
      .ap7-diagram.type-hierarchy article:first-of-type{grid-column:1/-1;justify-self:center;width:min(52%,260px);background:#ecfeff;border:1.5px solid #14b8a6;position:relative}
      .ap7-diagram.type-hierarchy article:not(:first-of-type){position:relative}
      .ap7-diagram.type-hierarchy article:not(:first-of-type)::before{content:"";position:absolute;top:-.56rem;left:50%;height:.56rem;border-left:1.5px solid #5eead4}
      .ap7-diagram.type-funnel{display:flex!important;flex-direction:column!important;align-items:center!important;gap:.32rem!important;overflow:visible!important}
      .ap7-diagram.type-funnel em{display:none!important}
      .ap7-diagram.type-funnel article{flex:none!important;width:92%}
      .ap7-diagram.type-funnel article:nth-of-type(2){width:80%}.ap7-diagram.type-funnel article:nth-of-type(3){width:68%}.ap7-diagram.type-funnel article:nth-of-type(4){width:56%}.ap7-diagram.type-funnel article:nth-of-type(n+5){width:46%}
      .ap7-diagram.type-cycle{flex-wrap:wrap!important;justify-content:center!important}.ap7-diagram.type-cycle article{min-width:120px!important;max-width:180px!important}

      /* Every presentation builder (AI/table/chart) is a real viewport modal with its own scroll. */
      body > .pres-builder-overlay{
        position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-height:100dvh!important;
        box-sizing:border-box!important;padding:10px!important;align-items:center!important;justify-content:center!important;
        overflow:hidden!important;z-index:360000!important;
      }
      body > .pres-builder-overlay .pres-builder-modal{
        position:relative!important;inset:auto!important;transform:none!important;margin:0 auto!important;
        width:min(820px,calc(100vw - 20px))!important;height:min(780px,calc(100dvh - 20px))!important;
        max-height:calc(100dvh - 20px)!important;min-height:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;
      }
      body > .pres-builder-overlay .pres-builder-header,
      body > .pres-builder-overlay .pres-builder-footer{flex:0 0 auto!important;position:relative!important;background:#fff!important;z-index:3!important}
      body > .pres-builder-overlay .pres-builder-footer{box-shadow:0 -8px 18px rgba(15,23,42,.06)!important}
      body > .pres-builder-overlay .pres-builder-body{
        flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;
        overflow-y:scroll!important;overflow-x:hidden!important;overscroll-behavior:contain!important;scrollbar-gutter:stable!important;
        -webkit-overflow-scrolling:touch!important;padding-bottom:18px!important;
      }
      @media(max-width:1100px){#pres-studio-mode.pres-studio{height:calc(100dvh - 100px)!important;max-height:calc(100dvh - 100px)!important}}
      @media(max-width:720px){
        #pres-studio-mode.pres-studio{height:auto!important;max-height:none!important;overflow:visible!important}
        #pres-studio-mode .pres-body{overflow:visible!important}
        #pres-studio-mode .pres-panel-left{max-height:210px!important}
        #pres-studio-mode .pres-panel-right{max-height:360px!important}
        #pres-slide-layout-body.ap73-has-visual{grid-template-columns:1fr!important;grid-template-areas:"primary" "component"!important}
      }
    `;
    document.head.appendChild(style);
  }

  function plainLines(value) {
    const model = m();
    if (model?.lines) return model.lines(value);
    return String(value || '').split(/\r?\n/).map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  }

  function cellsFromPipe(line) {
    let value = String(line || '').trim();
    if (value.startsWith('|')) value = value.slice(1);
    if (value.endsWith('|')) value = value.slice(0, -1);
    return value.split('|').map((cell) => cell.trim()).filter((cell, i, all) => cell || all.length > 1);
  }

  function isSeparatorRow(line) {
    const cells = cellsFromPipe(line);
    return cells.length >= 2 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, '')));
  }

  function parseMarkdownTable(text) {
    const all = String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const pipeLines = all.filter((line) => line.includes('|'));
    if (pipeLines.length < 2) return null;
    const dataLines = pipeLines.filter((line) => !isSeparatorRow(line));
    if (dataLines.length < 2) return null;
    const headers = cellsFromPipe(dataLines[0]).slice(0, 6);
    if (headers.length < 2) return null;
    const rows = dataLines.slice(1, 9).map(cellsFromPipe).filter((row) => row.length >= 2).map((row) => headers.map((_, i) => row[i] || ''));
    if (!rows.length) return null;
    return { title: '', headers, rows };
  }

  function conciseTableNarrative(table) {
    return table.rows.slice(0, 4).map((row) => {
      const lead = row[0] || 'Kavram';
      const details = row.slice(1).map((cell, i) => `${table.headers[i + 1] || 'Özellik'}: ${cell}`).filter((x) => !/:\s*$/.test(x)).join('; ');
      return `• ${lead}${details ? ` — ${details}` : ''}`;
    }).join('\n');
  }

  function splitTitleBody(item) {
    const value = String(item || '').trim();
    const match = value.match(/^(.{2,70}?)(?:\s*[:—–-]\s+)(.+)$/);
    if (match) return { title: match[1].trim(), body: match[2].trim() };
    const words = value.split(/\s+/);
    const title = words.slice(0, Math.min(5, words.length)).join(' ');
    return { title, body: value };
  }

  function numericChartFromItems(items, slideTitle) {
    const pairs = [];
    const unitPattern = /(-?\d+(?:[.,]\d+)?)\s*(%|₺|TL|TRY|USD|\$|€|adet|kişi|puan|yıl|ay|gün|saat)\b/i;
    items.forEach((item) => {
      const match = String(item).match(unitPattern);
      if (!match) return;
      const value = Number(match[1].replace(',', '.'));
      if (!Number.isFinite(value)) return;
      let label = String(item).slice(0, match.index).replace(/[:—–-]+\s*$/, '').trim();
      if (!label) label = String(item).slice((match.index || 0) + match[0].length).replace(/^\s*[:—–-]+/, '').trim();
      label = label.slice(0, 55);
      if (label) pairs.push({ label, value });
    });
    if (pairs.length < 2 || pairs.length > 8) return null;
    return {
      type: 'bar',
      title: String(slideTitle || '').slice(0, 120),
      series_label: 'Değer',
      labels: pairs.map((p) => p.label),
      data: pairs.map((p) => p.value),
      source_verified: true
    };
  }

  function hasStructured(content) {
    const model = m();
    return !!(
      model?.validTable?.(content.table) ||
      (model?.validChart?.(content.chart) && !model?.isGenericChart?.(content.chart)) ||
      model?.validCards?.(content.cards) ||
      model?.validSteps?.(content.steps) ||
      model?.validMetric?.(content.metric) ||
      model?.validDiagram?.(content.diagram)
    );
  }

  function enrichSlide(slide, index = 0) {
    if (!slide || typeof slide !== 'object') return slide;
    const content = slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content) ? { ...slide.content } : {};
    let text = String(content.text || '');
    let layout = String(slide.layout_type || slide.layout || 'title-content');
    let variant = String(content.design_variant || '').toLowerCase();

    // AI models occasionally write a Markdown table into visible text. Convert it to a real table and readable bullets.
    if (!content.table && text.includes('|')) {
      const parsedTable = parseMarkdownTable(text);
      if (parsedTable) {
        parsedTable.title = String(slide.title || '').slice(0, 120);
        content.table = parsedTable;
        content.text = conciseTableNarrative(parsedTable);
        text = content.text;
        layout = 'table';
        variant = 'comparison';
      }
    }

    const items = plainLines(text).slice(0, 7);
    const title = String(slide.title || '').toLowerCase();
    const originalNumbered = /^\s*\d+[.)]\s+/m.test(text) && (text.match(/^\s*\d+[.)]\s+/gm) || []).length >= 2;

    if (!hasStructured(content) && items.length >= 2) {
      const chart = numericChartFromItems(items, slide.title);
      const processLike = /(süreç|adım|aşama|iş akışı|yol haritası|workflow|process|how to|nasıl)/i.test(title) || originalNumbered;
      const hierarchyLike = /(hiyerarşi|hiyerarşik|ağaç|yapı|sınıflandır|classification|hierarchy|organizasyon)/i.test(title);
      const funnelLike = /(huni|funnel|dönüşüm|conversion)/i.test(title);
      const cycleLike = /(döngü|cycle|yaşam döngüsü|lifecycle)/i.test(title);
      const comparisonLike = /(karşılaştır|fark|vs\.?|versus|avantaj.*dezavantaj|comparison)/i.test(title);
      const summaryLike = /(özet|çıkarım|sonuç|takeaway|summary|conclusion)/i.test(title);

      if (chart) {
        content.chart = chart;
        layout = 'chart';
        variant = 'data';
      } else if (comparisonLike) {
        const rows = items.map(splitTitleBody).filter((x) => x.title && x.body).slice(0, 6);
        if (rows.length >= 2) {
          content.table = { title: String(slide.title || '').slice(0, 120), headers: ['Kavram', 'Açıklama'], rows: rows.map((x) => [x.title, x.body]) };
          layout = 'table';
          variant = 'comparison';
        }
      } else if (hierarchyLike || funnelLike || cycleLike) {
        content.diagram = {
          type: hierarchyLike ? 'hierarchy' : (funnelLike ? 'funnel' : 'cycle'),
          title: String(slide.title || '').slice(0, 120),
          nodes: items.slice(0, 7).map((item) => {
            const pair = splitTitleBody(item);
            return { label: pair.title, body: pair.body === pair.title ? '' : pair.body };
          })
        };
        variant = variant || 'section';
      } else if (processLike) {
        content.steps = items.slice(0, 7).map((item, i) => {
          const pair = splitTitleBody(item);
          return { label: String(i + 1), title: pair.title, body: pair.body === pair.title ? '' : pair.body };
        });
        variant = 'process';
      } else {
        content.cards = items.slice(0, summaryLike ? 5 : 6).map((item) => {
          const pair = splitTitleBody(item);
          return { title: pair.title, body: pair.body === pair.title ? item : pair.body };
        });
        // Keep summary semantics while still giving the learner a structured visual.
        variant = summaryLike ? 'summary' : 'cards';
      }
    }

    content.design_variant = variant || content.design_variant || (index === 0 ? 'hero' : 'section');
    return { ...slide, layout_type: layout, content };
  }

  function portalBuilder(overlay) {
    if (!overlay || !document.body) return;
    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
    const modal = overlay.querySelector('.pres-builder-modal');
    const body = modal?.querySelector('.pres-builder-body');
    if (!modal || !body) return;
    body.style.setProperty('overflow-y', 'scroll', 'important');
    body.style.setProperty('min-height', '0', 'important');
  }

  function portalAllBuilders() {
    document.querySelectorAll('.pres-builder-overlay').forEach(portalBuilder);
  }

  function scrollOpenBuilder(delta) {
    const overlay = Array.from(document.querySelectorAll('body > .pres-builder-overlay.is-open')).find((x) => getComputedStyle(x).display !== 'none');
    const body = overlay?.querySelector('.pres-builder-body');
    if (!body) return false;
    body.scrollTop += delta;
    return body.scrollHeight > body.clientHeight;
  }

  function patchPresentationPipeline() {
    const previousNormalize = window.normalizePresentationSlide;
    if (!previousNormalize?.__ap73Wrapped) {
      const wrapped = function (slide, index) {
        const base = typeof previousNormalize === 'function' ? previousNormalize(slide, index) : slide;
        return enrichSlide(base, index);
      };
      wrapped.__ap73Wrapped = true;
      window.normalizePresentationSlide = wrapped;
    }

    const previousRich = window.renderPresentationRichContent;
    if (!previousRich?.__ap73Wrapped) {
      const wrappedRich = function (slide) {
        const enriched = enrichSlide(slide, (typeof presActiveSlide !== 'undefined' ? presActiveSlide : 0));
        if (slide && typeof slide === 'object' && enriched && typeof enriched === 'object') {
          slide.content = enriched.content;
          slide.layout_type = enriched.layout_type;
        }
        if (typeof previousRich === 'function') previousRich(enriched);
        const model = m();
        const kind = model?.visualKind?.(enriched);
        const layoutBody = document.getElementById('pres-slide-layout-body');
        const placeholder = document.getElementById('pres-layout-placeholder');
        if (layoutBody) layoutBody.classList.toggle('ap73-has-visual', !!kind);
        if (placeholder && kind) placeholder.style.setProperty('display', 'flex', 'important');
        if (placeholder && !kind) placeholder.style.removeProperty('display');
      };
      wrappedRich.__ap73Wrapped = true;
      window.renderPresentationRichContent = wrappedRich;
    }
  }

  function repairOpenDeck() {
    try {
      if (typeof presSlides === 'undefined' || !Array.isArray(presSlides)) return;
      presSlides.forEach((slide, index) => {
        const enriched = enrichSlide(slide, index);
        if (enriched && slide) {
          slide.content = enriched.content;
          slide.layout_type = enriched.layout_type;
        }
      });
    } catch (_) {}
  }

  function bind() {
    injectStyles();
    patchPresentationPipeline();
    portalAllBuilders();
    repairOpenDeck();

    // Opening any builder or switching slides reapplies the safe viewport/scroll rules without observers.
    document.addEventListener('click', (event) => {
      const relevant = event.target.closest('#pres-ai-btn,#pres-insert-table-btn,#pres-insert-chart-btn,#pres-component-edit-btn,[data-pres-builder-close],.pres-slide-thumb,.pres-layout-btn');
      if (!relevant) return;
      requestAnimationFrame(() => {
        portalAllBuilders();
        repairOpenDeck();
      });
    }, true);

    // Header/footer/backdrop wheel movement scrolls the builder body instead of the page.
    document.addEventListener('wheel', (event) => {
      const overlay = event.target.closest?.('body > .pres-builder-overlay.is-open');
      if (!overlay) return;
      const builderBody = overlay.querySelector('.pres-builder-body');
      if (!builderBody || builderBody.contains(event.target)) return;
      if (scrollOpenBuilder(event.deltaY)) event.preventDefault();
    }, { passive: false, capture: true });

    window.addEventListener('resize', portalAllBuilders);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.AcadexPresentationStudioV73 = { enrichSlide, parseMarkdownTable, portalAllBuilders, repairOpenDeck };
})();
