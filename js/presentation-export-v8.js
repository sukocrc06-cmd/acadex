/* Acadex Presentation Export V8 — hardened PowerPoint/PDF/Word exports */
(function () {
  'use strict';
  if (window.__acadexPresentationExportV8) return;
  window.__acadexPresentationExportV8 = true;

  const PPTX_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
  const M = () => window.AcadexPresentationModelV7;
  const toText = (value) => String(value == null ? '' : value);
  const esc = (value) => M()?.esc(value) || toText(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const safeName = (value) => (toText(value).trim() || 'Acadex-Sunum').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100);
  const themePptx = () => {
    try { return window.AcadexPresentationThemeV8?.exportPalette?.() || { accent: '0D9488', navy: '16325C', text: '24364B', soft: 'F0FDFA', border: '99F6E4' }; }
    catch (_) { return { accent: '0D9488', navy: '16325C', text: '24364B', soft: 'F0FDFA', border: '99F6E4' }; }
  };

  let exporting = false;

  function deck() {
    try { return Array.isArray(presSlides) ? presSlides : []; } catch (_) { return []; }
  }

  function deckTitle() {
    try {
      return presCurrentPresentation?.title || document.getElementById('pres-title-input')?.value || 'Acadex Sunum';
    } catch (_) {
      return 'Acadex Sunum';
    }
  }

  function slideLines(value) {
    const lines = M()?.lines?.(value);
    if (Array.isArray(lines)) return lines;
    return toText(value).split(/\r?\n/).map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  }

  function normalizeDeck() {
    const model = M();
    if (!model) throw new Error('Sunum modeli yüklenemedi.');
    const rawDeck = deck();
    if (!rawDeck.length) throw new Error('Dışa aktarılacak slayt bulunamadı.');
    return rawDeck.map((slide, index) => model.normalize(slide, index));
  }

  function sync() {
    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    try { window.AcadexPresentationRendererV7?.repairDeck?.(); } catch (_) {}
    try { window.AcadexPresentationControlsV7?.repair?.(); } catch (_) {}
  }

  async function ensureSaved() {
    sync();
    if (typeof presIsDirty !== 'undefined' && presIsDirty && typeof savePresentation === 'function') {
      const ok = await savePresentation({ silent: true });
      if (!ok) throw new Error('Sunum kaydedilemedi. Lütfen tekrar deneyin.');
    }
  }

  function notify(message, type = 'success') {
    if (typeof showDashboardAlert === 'function') showDashboardAlert(type, message);
    else if (type === 'error') console.error(message);
    else console.info(message);
  }

  function friendlyError(error, fallback = 'Dışa aktarma başarısız oldu.') {
    const raw = toText(error?.message || error || '').trim();
    if (!raw) return fallback;
    if (/Cannot read properties of undefined/i.test(raw)) return 'Dışa aktarma motorunda beklenmeyen bir veri hatası oluştu. Sayfayı yenileyip tekrar deneyin.';
    if (/PptxGenJS|PowerPoint motoru|yüklenemedi/i.test(raw)) return 'PowerPoint motoru yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.';
    return raw.slice(0, 260);
  }

  function loadScriptOnce(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    const existing = document.querySelector(`script[data-acadex-export-lib="${globalName}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (window[globalName]) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`${globalName} yüklenemedi`)), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.acadexExportLib = globalName;
      script.onload = () => window[globalName] ? resolve() : reject(new Error(`${globalName} yüklenemedi`));
      script.onerror = () => reject(new Error(`${globalName} yüklenemedi`));
      document.head.appendChild(script);
    });
  }

  function downloadBlob(blob, name) {
    if (!(blob instanceof Blob)) throw new Error('İndirilecek dosya hazırlanamadı.');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  function addTextLines(slide, value, x, y, w, h, fontSize = 17) {
    const lines = slideLines(value).slice(0, 9);
    if (!lines.length) return false;
    const lineH = Math.max(0.34, Math.min(0.72, h / Math.max(lines.length, 1)));
    lines.forEach((item, index) => {
      slide.addText(`• ${item}`, {
        x, y: y + (index * lineH), w, h: lineH,
        fontFace: 'Aptos', fontSize, color: themePptx().text,
        valign: 'mid', margin: 0.03, breakLine: false, fit: 'shrink'
      });
    });
    return true;
  }

  function addTable(slide, table, x, y, w, h) {
    if (!M()?.validTable?.(table) || typeof slide.addTable !== 'function') return false;
    const rows = [table.headers, ...table.rows].map((row) => row.map((cell) => toText(cell)));
    slide.addTable(rows, {
      x, y, w, h,
      fontFace: 'Aptos', fontSize: 10.5, color: themePptx().text,
      border: { type: 'solid', pt: 1, color: 'CBD5E1' },
      fill: 'FFFFFF', margin: 0.05,
      autoFit: false
    });
    return true;
  }

  function addChart(presentation, slide, chart, x, y, w, h) {
    if (!M()?.validChart?.(chart) || M()?.isGenericChart?.(chart) || typeof slide.addChart !== 'function') return false;
    const chartTypes = presentation.ChartType;
    if (!chartTypes) return false;
    const type = ({ bar: chartTypes.bar, line: chartTypes.line, pie: chartTypes.pie })[chart.type] || chartTypes.bar;
    if (!type) return false;

    const labels = chart.labels.map((v) => toText(v));
    const values = chart.data.map(Number);
    if (!labels.length || values.some((v) => !Number.isFinite(v))) return false;

    slide.addChart(type, [{
      name: toText(chart.series_label || 'Değer'),
      labels,
      values
    }], {
      x, y, w, h,
      showLegend: chart.type === 'pie',
      showValue: true,
      showTitle: !!chart.title,
      title: toText(chart.title || ''),
      chartColors: ['0D9488', '16325C', '14B8A6', '64748B', 'F59E0B'],
      catAxisLabelFontSize: 10,
      valAxisLabelFontSize: 9,
      showCatName: false
    });
    return true;
  }

  function addCards(presentation, slide, cards, x, y, w, h) {
    if (!Array.isArray(cards) || !cards.length || !presentation.ShapeType) return false;
    const items = cards.slice(0, 6);
    const cols = items.length <= 2 ? 2 : 3;
    const rows = Math.ceil(items.length / cols);
    const gap = 0.16;
    const cw = (w - gap * (cols - 1)) / cols;
    const ch = (h - gap * (rows - 1)) / rows;

    items.forEach((card, index) => {
      const cx = x + (index % cols) * (cw + gap);
      const cy = y + Math.floor(index / cols) * (ch + gap);
      slide.addShape(presentation.ShapeType.roundRect, {
        x: cx, y: cy, w: cw, h: ch,
        fill: { color: themePptx().soft },
        line: { color: themePptx().border, pt: 1 }
      });
      slide.addText(toText(card.title), {
        x: cx + 0.12, y: cy + 0.12, w: cw - 0.24, h: 0.38,
        fontSize: 12.5, bold: true, color: themePptx().navy, margin: 0, fit: 'shrink'
      });
      slide.addText(toText(card.body), {
        x: cx + 0.12, y: cy + 0.54, w: cw - 0.24, h: Math.max(0.42, ch - 0.66),
        fontSize: 9.3, color: '475569', margin: 0, valign: 'top', fit: 'shrink'
      });
    });
    return true;
  }

  function addSteps(presentation, slide, steps, x, y, w, h) {
    if (!Array.isArray(steps) || !steps.length || !presentation.ShapeType) return false;
    const items = steps.slice(0, 6);
    const gap = 0.14;
    const cw = (w - gap * (items.length - 1)) / items.length;

    items.forEach((step, index) => {
      const cx = x + index * (cw + gap);
      slide.addShape(presentation.ShapeType.roundRect, {
        x: cx, y, w: cw, h,
        fill: { color: themePptx().soft },
        line: { color: themePptx().border, pt: 1 }
      });
      slide.addText(toText(step.label || index + 1), {
        x: cx + 0.08, y: y + 0.1, w: Math.min(0.42, Math.max(0.28, cw - 0.16)), h: 0.3,
        fontSize: 9.5, bold: true, color: 'FFFFFF',
        fill: { color: themePptx().accent }, align: 'center', margin: 0.02
      });
      slide.addText(toText(step.title || step.label || ''), {
        x: cx + 0.08, y: y + 0.5, w: Math.max(0.2, cw - 0.16), h: 0.5,
        fontSize: 10.3, bold: true, color: themePptx().navy, margin: 0, fit: 'shrink'
      });
      slide.addText(toText(step.body || ''), {
        x: cx + 0.08, y: y + 1.04, w: Math.max(0.2, cw - 0.16), h: Math.max(0.4, h - 1.15),
        fontSize: 8.2, color: '64748B', margin: 0, valign: 'top', fit: 'shrink'
      });
    });
    return true;
  }

  function addMetric(presentation, slide, metric, x, y, w, h) {
    if (!M()?.validMetric?.(metric) || !presentation.ShapeType) return false;
    slide.addShape(presentation.ShapeType.roundRect, {
      x, y, w, h,
      fill: { color: themePptx().soft },
      line: { color: themePptx().border, pt: 1.2 }
    });
    slide.addText(toText(metric.value), {
      x: x + 0.18, y: y + 0.42, w: w - 0.36, h: 0.9,
      fontSize: 35, bold: true, color: themePptx().accent, align: 'center', margin: 0, fit: 'shrink'
    });
    slide.addText(toText(metric.label), {
      x: x + 0.18, y: y + 1.35, w: w - 0.36, h: 0.48,
      fontSize: 14, bold: true, color: themePptx().navy, align: 'center', margin: 0, fit: 'shrink'
    });
    if (metric.context) {
      slide.addText(toText(metric.context), {
        x: x + 0.3, y: y + 1.9, w: w - 0.6, h: Math.max(0.45, h - 2.1),
        fontSize: 10, color: '64748B', align: 'center', margin: 0, fit: 'shrink'
      });
    }
    return true;
  }

  function addVisual(presentation, slide, normalizedSlide, x, y, w, h) {
    const kind = M()?.visualKind?.(normalizedSlide);
    const content = normalizedSlide.content || {};
    if (kind === 'table') return addTable(slide, content.table, x, y, w, h);
    if (kind === 'chart') return addChart(presentation, slide, content.chart, x, y, w, h);
    if (kind === 'cards') return addCards(presentation, slide, content.cards, x, y, w, h);
    if (kind === 'process' || kind === 'timeline') return addSteps(presentation, slide, content.steps, x, y, w, h);
    if (kind === 'diagram') return addSteps(presentation, slide, content.diagram?.nodes, x, y, w, h);
    if (kind === 'metric') return addMetric(presentation, slide, content.metric, x, y, w, h);
    return false;
  }

  async function exportPptx() {
    await ensureSaved();
    await loadScriptOnce(PPTX_CDN, 'PptxGenJS');

    const PptxGenJS = window.PptxGenJS;
    if (!PptxGenJS) throw new Error('PowerPoint motoru yüklenemedi.');

    const slides = normalizeDeck();
    const presentation = new PptxGenJS();
    presentation.layout = 'LAYOUT_WIDE';
    presentation.author = 'Acadex';
    presentation.subject = 'Acadex Academic Presentation';
    presentation.title = deckTitle();
    presentation.company = 'Acadex';
    presentation.lang = presCurrentPresentation?.language === 'en' ? 'en-US' : 'tr-TR';

    if (!presentation.ShapeType) throw new Error('PowerPoint şekil motoru yüklenemedi.');

    slides.forEach((normalizedSlide, index) => {
      const content = normalizedSlide.content || {};
      const slide = presentation.addSlide();
      slide.background = { color: 'F8FAFC' }; /* theme surface */

      slide.addText(toText(normalizedSlide.title), {
        x: 0.65, y: 0.42, w: 12, h: 0.62,
        fontSize: 26, bold: true, color: themePptx().navy, margin: 0, fit: 'shrink'
      });
      slide.addShape(presentation.ShapeType.line, {
        x: 0.65, y: 1.15, w: 12, h: 0,
        line: { color: themePptx().accent, width: 1.5 }
      });

      const kind = M()?.visualKind?.(normalizedSlide);
      const secondary = slideLines(content.secondary_text);
      const primary = slideLines(content.text);

      if (kind) {
        if (secondary.length) {
          addTextLines(slide, content.text, 0.72, 1.42, 2.65, 4.95, 15.5);
          addTextLines(slide, content.secondary_text, 3.5, 1.42, 2.55, 4.95, 14.5);
          addVisual(presentation, slide, normalizedSlide, 6.25, 1.42, 6.25, 4.95);
        } else {
          addTextLines(slide, content.text, 0.72, 1.42, 5.05, 4.95, 16.2);
          addVisual(presentation, slide, normalizedSlide, 6.02, 1.42, 6.48, 4.95);
        }
      } else if (secondary.length) {
        addTextLines(slide, content.text, 0.75, 1.45, 5.55, 5.05, 17);
        addTextLines(slide, content.secondary_text, 6.75, 1.45, 5.55, 5.05, 16);
      } else if (primary.length) {
        addTextLines(slide, content.text, 0.78, 1.48, 11.55, 5.0, 18);
      } else {
        slide.addText('Bu slayt için görünür içerik bulunmuyor.', {
          x: 0.8, y: 2.0, w: 11.4, h: 0.6,
          fontSize: 16, color: '94A3B8', italic: true, align: 'center'
        });
      }

      slide.addText(`${index + 1} / ${slides.length}`, {
        x: 11.55, y: 7.02, w: 1, h: 0.2,
        fontSize: 8, color: '64748B', align: 'right', margin: 0
      });

      if (normalizedSlide.speaker_notes && typeof slide.addNotes === 'function') {
        slide.addNotes(toText(normalizedSlide.speaker_notes));
      }
    });

    await presentation.writeFile({
      fileName: `${safeName(deckTitle())}.pptx`,
      compression: true
    });

    notify('PowerPoint başarıyla indirildi.');
  }

  function sharedCss() {
    return `
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#16325c;background:#fff}
      .ap7-combo{display:grid;grid-template-columns:.9fr 1.1fr;gap:18pt;align-items:stretch}
      .ap7-copy,.ap7-visual{min-width:0}
      .ap7-bullets{display:grid;gap:7pt;font-size:14pt;line-height:1.35}
      .ap7-bullets p{margin:0;display:flex;gap:7pt}.ap7-bullets span{color:#0d9488;font-weight:900}
      .ap7-cols{display:grid;grid-template-columns:1fr 1fr;gap:12pt}
      .ap7-cols>div{padding:9pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7pt}
      .ap7-cols p{margin:0 0 6pt}
      .ap7-table-wrap{overflow:hidden;border:1px solid #dbe3eb;border-radius:7pt}
      .ap7-table{width:100%;border-collapse:collapse;font-size:10pt}
      .ap7-table th{background:#e6f7f5;color:#0f5f59;text-align:left}
      .ap7-table th,.ap7-table td{border:1px solid #dbe3eb;padding:6pt}
      .ap7-chart{display:grid;gap:7pt}
      .ap7-bar{display:grid;grid-template-columns:90pt 1fr 35pt;gap:6pt;align-items:center;font-size:9pt}
      .ap7-bar i{height:12pt;background:#e2e8f0;border-radius:20pt;overflow:hidden}
      .ap7-bar b{display:block;height:100%;background:#0d9488}
      .ap7-cards{display:grid;grid-template-columns:1fr 1fr;gap:8pt}
      .ap7-cards article,.ap7-steps article,.ap7-diagram article{padding:8pt;border:1px solid #ccfbf1;border-radius:7pt;background:#f0fdfa}
      .ap7-cards small{color:#0f766e;font-weight:900}
      .ap7-cards strong,.ap7-steps strong,.ap7-diagram strong{display:block;margin:4pt 0;color:#16325c}
      .ap7-cards p,.ap7-steps p,.ap7-diagram p{margin:0;color:#64748b;font-size:8.5pt;line-height:1.35}
      .ap7-steps,.ap7-diagram{display:flex;gap:5pt;align-items:stretch}
      .ap7-steps article,.ap7-diagram article{flex:1}
      .ap7-steps em,.ap7-diagram em{align-self:center;color:#0d9488;font-style:normal;font-weight:900}
      .ap7-metric{text-align:center;padding:20pt;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10pt}
      .ap7-metric b{display:block;font-size:30pt;color:#0f766e}
      .ap7-metric strong{display:block;margin-top:7pt}
      .ap7-metric p{color:#64748b;font-size:9pt}
      .ap7-empty{color:#94a3b8}
    `;
  }

  function buildPagesHtml(slides) {
    return slides.map((normalizedSlide, index) => `
      <section class="page">
        <div class="slide">
          <h1>${esc(normalizedSlide.title)}</h1>
          <div class="rule"></div>
          <div class="body">${M().renderBody(normalizedSlide)}</div>
          <footer>${index + 1} / ${slides.length}</footer>
        </div>
        <div class="notes">
          <strong>Konuşma Notları</strong>
          <p>${esc(normalizedSlide.speaker_notes || 'Bu slayt için konuşma notu eklenmemiş.')}</p>
        </div>
      </section>
    `).join('');
  }

  async function exportPdf(preopenedPopup) {
    const popup = preopenedPopup || window.open('', '_blank');
    if (!popup) throw new Error('PDF penceresi tarayıcı tarafından engellendi.');

    try {
      popup.document.open();
      popup.document.write('<!doctype html><html><head><title>PDF hazırlanıyor…</title></head><body style="font-family:Arial;padding:32px">PDF hazırlanıyor…</body></html>');
      popup.document.close();

      await ensureSaved();
      const slides = normalizeDeck();
      const pages = buildPagesHtml(slides);

      popup.document.open();
      popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(deckTitle())}</title><style>
        @page{size:13.333in 7.5in;margin:0}
        ${sharedCss()}
        body{margin:0}
        .page{width:13.333in;height:7.5in;page-break-after:always;display:grid;grid-template-rows:6.08in 1.42in;overflow:hidden}
        .page:last-child{page-break-after:auto}
        .slide{padding:.42in .63in;position:relative;overflow:hidden}
        .slide h1{font-size:25pt;margin:0 0 .12in}
        .rule{height:3px;width:.75in;background:#0d9488;margin-bottom:.2in}
        .body{height:4.55in;overflow:hidden}
        .notes{background:#f1f5f9;border-top:2px solid #cbd5e1;padding:.15in .63in;color:#334155}
        .notes strong{display:block;color:#0f766e;font-size:9.5pt;text-transform:uppercase;margin-bottom:.05in}
        .notes p{margin:0;font-size:9pt;line-height:1.35;max-height:.9in;overflow:hidden}
        footer{position:absolute;right:.6in;bottom:.18in;color:#64748b;font-size:8pt}
        @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
      popup.document.close();
      notify('PDF yazdırma penceresi hazırlandı.');
    } catch (error) {
      try { popup.close(); } catch (_) {}
      throw error;
    }
  }

  async function exportWord() {
    await ensureSaved();
    const slides = normalizeDeck();
    const sections = slides.map((normalizedSlide, index) => `
      <section style="page-break-after:${index === slides.length - 1 ? 'auto' : 'always'}">
        <h1>${esc(normalizedSlide.title)}</h1>
        <div>${M().renderBody(normalizedSlide)}</div>
        <div class="notes">
          <h3>Konuşma Notları</h3>
          <p>${esc(normalizedSlide.speaker_notes || 'Bu slayt için konuşma notu eklenmemiş.')}</p>
        </div>
      </section>
    `).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      ${sharedCss()}
      body{margin:34pt}
      .notes{margin-top:20pt;padding:10pt;background:#f1f5f9;border-left:4pt solid #0d9488}
      .notes h3{margin:0 0 6pt}.notes p{line-height:1.4}
    </style></head><body><h1>${esc(deckTitle())}</h1>${sections}</body></html>`;

    downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${safeName(deckTitle())}.doc`);
    notify('Word belgesi başarıyla indirildi.');
  }

  async function runExport(kind, preopenedPopup = null) {
    if (exporting) return;
    exporting = true;
    try {
      if (kind === 'pptx') await exportPptx();
      else if (kind === 'pdf') await exportPdf(preopenedPopup);
      else if (kind === 'word') await exportWord();
      else throw new Error('Bilinmeyen dışa aktarma türü.');
    } catch (error) {
      console.error('Acadex export failed:', error);
      notify(friendlyError(error), 'error');
      if (preopenedPopup && kind !== 'pdf') {
        try { preopenedPopup.close(); } catch (_) {}
      }
    } finally {
      exporting = false;
    }
  }

  function openMenu(anchor) {
    document.getElementById('acadex-pres-export-menu-v8')?.remove();

    const menu = document.createElement('div');
    menu.id = 'acadex-pres-export-menu-v8';
    Object.assign(menu.style, {
      position: 'fixed',
      zIndex: '370000',
      background: '#fff',
      border: '1px solid rgba(22,50,92,.15)',
      borderRadius: '10px',
      boxShadow: '0 14px 35px rgba(15,23,42,.2)',
      padding: '6px',
      minWidth: '235px'
    });

    [
      ['PowerPoint (.pptx)', 'pptx'],
      ['PDF + Konuşma Notları', 'pdf'],
      ['Word + Konuşma Notları', 'word']
    ].forEach(([label, kind]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      Object.assign(button.style, {
        display: 'block',
        width: '100%',
        padding: '10px 12px',
        border: 0,
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: '7px',
        fontWeight: '700',
        color: '#16325c'
      });

      button.addEventListener('mouseenter', () => { button.style.background = '#f0fdfa'; });
      button.addEventListener('mouseleave', () => { button.style.background = 'transparent'; });

      button.onclick = () => {
        let popup = null;
        if (kind === 'pdf') {
          popup = window.open('', '_blank');
          if (!popup) {
            notify('PDF penceresi tarayıcı tarafından engellendi. Açılır pencerelere izin verip tekrar deneyin.', 'error');
            return;
          }
        }
        menu.remove();
        runExport(kind, popup);
      };
      menu.appendChild(button);
    });

    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, rect.bottom + 6))}px`;
    menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, rect.right - menu.offsetWidth))}px`;

    const closeOutside = (event) => {
      if (menu.contains(event.target) || event.target.closest('#pres-export-btn')) return;
      menu.remove();
      document.removeEventListener('pointerdown', closeOutside, true);
    };
    setTimeout(() => document.addEventListener('pointerdown', closeOutside, true), 0);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('#pres-export-btn');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMenu(button);
  }, true);

  window.AcadexPresentationExportV8 = {
    pptx: exportPptx,
    pdf: () => runExport('pdf', window.open('', '_blank')),
    word: exportWord
  };
})();