/* Acadex Presentation Export V7 — preview/export share the same content model */
(function () {
  'use strict';
  if (window.__acadexPresentationExportV7) return;
  window.__acadexPresentationExportV7 = true;

  const PPTX_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
  const M = () => window.AcadexPresentationModelV7;
  const esc = (v) => M()?.esc(v) || String(v == null ? '' : v);
  const text = (v) => String(v == null ? '' : v);
  const safeName = (v) => (text(v).trim() || 'Acadex-Sunum').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100);

  function deck() { try { return Array.isArray(presSlides) ? presSlides : []; } catch (_) { return []; } }
  function deckTitle() { try { return presCurrentPresentation?.title || document.getElementById('pres-title-input')?.value || 'Acadex Sunum'; } catch (_) { return 'Acadex Sunum'; } }
  function slideLines(v) { return M()?.lines(v) || []; }

  function sync() {
    try { if (typeof syncActiveSlideFromEditor === 'function') syncActiveSlideFromEditor(); } catch (_) {}
    try { window.AcadexPresentationControlsV7?.repair?.(); } catch (_) {}
  }

  async function ensureSaved() {
    sync();
    try {
      if (typeof presIsDirty !== 'undefined' && presIsDirty && typeof savePresentation === 'function') {
        const ok = await savePresentation({ silent: true });
        if (!ok) throw new Error('Sunum kaydedilemedi.');
      }
    } catch (error) { if (error?.message) throw error; }
  }

  function notify(message, type = 'success') {
    if (typeof showDashboardAlert === 'function') showDashboardAlert(type, message);
    else alert(message);
  }

  function load(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`${globalName} yüklenemedi`));
      document.head.appendChild(script);
    });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function addBullets(slide, content, x, y, w, h, fontSize = 17) {
    const primary = slideLines(content);
    if (!primary.length) return false;
    slide.addText(primary.map((item) => ({ text: item, options: { bullet: { indent: 18 }, hanging: 4, breakLine: true } })), {
      x, y, w, h, fontFace: 'Aptos', fontSize, color: '24364B', valign: 'top', margin: 0.07, fit: 'shrink', breakLine: false
    });
    return true;
  }

  function addTable(slide, table, x, y, w, h) {
    if (!M()?.validTable(table) || typeof slide.addTable !== 'function') return false;
    slide.addTable([table.headers, ...table.rows], {
      x, y, w, h, fontFace: 'Aptos', fontSize: 11.5, color: '24364B',
      border: { type: 'solid', pt: 1, color: 'CBD5E1' }, fill: 'FFFFFF', margin: 0.05,
      rowH: 0.38, autoFit: false
    });
    return true;
  }

  function addChart(pptx, slide, chart, x, y, w, h) {
    if (!M()?.validChart(chart) || M()?.isGenericChart(chart) || typeof slide.addChart !== 'function') return false;
    const type = { bar: pptx.ChartType?.bar, line: pptx.ChartType?.line, pie: pptx.ChartType?.pie }[chart.type] || pptx.ChartType?.bar;
    if (!type) return false;
    slide.addChart(type, [{ name: chart.series_label || 'Değer', labels: chart.labels, values: chart.data.map(Number) }], {
      x, y, w, h, showLegend: chart.type === 'pie', showValue: true, showTitle: !!chart.title,
      title: chart.title || '', chartColors: ['0D9488', '16325C', '14B8A6', '64748B', 'F59E0B'],
      catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, showCatName: false
    });
    return true;
  }

  function addCards(pptx, slide, cards, x, y, w, h) {
    if (!Array.isArray(cards) || !cards.length) return false;
    const items = cards.slice(0, 6);
    const cols = items.length <= 2 ? 2 : 3;
    const rows = Math.ceil(items.length / cols);
    const gap = 0.16;
    const cw = (w - gap * (cols - 1)) / cols;
    const ch = (h - gap * (rows - 1)) / rows;
    items.forEach((card, i) => {
      const cx = x + (i % cols) * (cw + gap);
      const cy = y + Math.floor(i / cols) * (ch + gap);
      slide.addShape(pptx.ShapeType.roundRect, { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: 'F0FDFA' }, line: { color: '99F6E4', pt: 1 } });
      slide.addText(text(card.title), { x: cx + 0.12, y: cy + 0.12, w: cw - 0.24, h: 0.35, fontSize: 12.5, bold: true, color: '16325C', margin: 0, fit: 'shrink' });
      slide.addText(text(card.body), { x: cx + 0.12, y: cy + 0.52, w: cw - 0.24, h: Math.max(0.45, ch - 0.62), fontSize: 9.5, color: '475569', margin: 0, valign: 'top', fit: 'shrink' });
    });
    return true;
  }

  function addSteps(pptx, slide, steps, x, y, w, h) {
    if (!Array.isArray(steps) || !steps.length) return false;
    const items = steps.slice(0, 6);
    const gap = 0.14;
    const cw = (w - gap * (items.length - 1)) / items.length;
    items.forEach((step, i) => {
      const cx = x + i * (cw + gap);
      slide.addShape(pptx.ShapeType.roundRect, { x: cx, y, w: cw, h, fill: { color: 'F0FDFA' }, line: { color: '99F6E4', pt: 1 } });
      slide.addText(text(step.label || i + 1), { x: cx + 0.08, y: y + 0.1, w: 0.38, h: 0.3, fontSize: 9.5, bold: true, color: 'FFFFFF', fill: { color: '0F766E' }, align: 'center', margin: 0.02 });
      slide.addText(text(step.title), { x: cx + 0.08, y: y + 0.5, w: cw - 0.16, h: 0.5, fontSize: 10.5, bold: true, color: '16325C', margin: 0, fit: 'shrink' });
      slide.addText(text(step.body || ''), { x: cx + 0.08, y: y + 1.04, w: cw - 0.16, h: Math.max(0.4, h - 1.15), fontSize: 8.3, color: '64748B', margin: 0, valign: 'top', fit: 'shrink' });
    });
    return true;
  }

  function addMetric(pptx, slide, metric, x, y, w, h) {
    if (!M()?.validMetric(metric)) return false;
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: 'F0FDFA' }, line: { color: '99F6E4', pt: 1.2 } });
    slide.addText(text(metric.value), { x: x + 0.18, y: y + 0.42, w: w - 0.36, h: 0.9, fontSize: 35, bold: true, color: '0F766E', align: 'center', margin: 0, fit: 'shrink' });
    slide.addText(text(metric.label), { x: x + 0.18, y: y + 1.35, w: w - 0.36, h: 0.48, fontSize: 14, bold: true, color: '16325C', align: 'center', margin: 0, fit: 'shrink' });
    if (metric.context) slide.addText(text(metric.context), { x: x + 0.3, y: y + 1.9, w: w - 0.6, h: Math.max(0.45, h - 2.1), fontSize: 10, color: '64748B', align: 'center', margin: 0, fit: 'shrink' });
    return true;
  }

  function addVisual(pptx, slide, s, x, y, w, h) {
    const kind = M()?.visualKind(s);
    const c = s.content || {};
    if (kind === 'table') return addTable(slide, c.table, x, y, w, h);
    if (kind === 'chart') return addChart(pptx, slide, c.chart, x, y, w, h);
    if (kind === 'cards') return addCards(pptx, slide, c.cards, x, y, w, h);
    if (kind === 'process' || kind === 'timeline' || kind === 'diagram') return addSteps(pptx, slide, kind === 'diagram' ? c.diagram?.nodes : c.steps, x, y, w, h);
    if (kind === 'metric') return addMetric(pptx, slide, c.metric, x, y, w, h);
    return false;
  }

  async function pptx() {
    await ensureSaved();
    await load(PPTX_CDN, 'PptxGenJS');
    const P = window.PptxGenJS;
    if (!P || !M()) throw new Error('PowerPoint motoru yüklenemedi.');
    const presentation = new P();
    presentation.layout = 'LAYOUT_WIDE';
    presentation.author = 'Acadex';
    presentation.title = deckTitle();

    deck().forEach((raw, index) => {
      const s = M().normalize(raw, index);
      const c = s.content || {};
      const slide = presentation.addSlide();
      slide.background = { color: 'F8FAFC' };
      slide.addText(s.title, { x: 0.65, y: 0.42, w: 12, h: 0.62, fontSize: 26, bold: true, color: '16325C', margin: 0, fit: 'shrink' });
      slide.addShape(P.ShapeType.line, { x: 0.65, y: 1.15, w: 12, h: 0, line: { color: '0D9488', width: 1.5 } });

      const kind = M().visualKind(s);
      const primary = slideLines(c.text);
      const secondary = slideLines(c.secondary_text);
      if (kind) {
        if (secondary.length) {
          addBullets(slide, c.text, 0.72, 1.42, 2.65, 4.95, 15.5);
          addBullets(slide, c.secondary_text, 3.5, 1.42, 2.55, 4.95, 14.5);
          addVisual(P, slide, s, 6.25, 1.42, 6.25, 4.95);
        } else {
          addBullets(slide, c.text, 0.72, 1.42, 5.05, 4.95, 16.2);
          addVisual(P, slide, s, 6.02, 1.42, 6.48, 4.95);
        }
      } else if (secondary.length) {
        addBullets(slide, c.text, 0.75, 1.45, 5.55, 5.05, 17);
        addBullets(slide, c.secondary_text, 6.75, 1.45, 5.55, 5.05, 16);
      } else if (primary.length) {
        addBullets(slide, c.text, 0.78, 1.48, 11.55, 5.0, 18);
      }

      slide.addText(`${index + 1} / ${deck().length}`, { x: 11.55, y: 7.02, w: 1, h: 0.2, fontSize: 8, color: '64748B', align: 'right', margin: 0 });
      if (s.speaker_notes && typeof slide.addNotes === 'function') slide.addNotes(s.speaker_notes);
    });

    await presentation.writeFile({ fileName: `${safeName(deckTitle())}.pptx` });
    notify('PowerPoint hazırlandı. Metin, görseller ve konuşma notları aynı slayt modelinden aktarıldı.');
  }

  function sharedCss() {
    return `
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#16325c}.ap7-combo{display:grid;grid-template-columns:.9fr 1.1fr;gap:18pt;align-items:stretch}.ap7-copy,.ap7-visual{min-width:0}.ap7-bullets{display:grid;gap:7pt;font-size:14pt;line-height:1.35}.ap7-bullets p{margin:0;display:flex;gap:7pt}.ap7-bullets span{color:#0d9488;font-weight:900}.ap7-cols{display:grid;grid-template-columns:1fr 1fr;gap:12pt}.ap7-cols>div{padding:9pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7pt}.ap7-cols p{margin:0 0 6pt}.ap7-table-wrap{overflow:hidden;border:1px solid #dbe3eb;border-radius:7pt}.ap7-table{width:100%;border-collapse:collapse;font-size:10pt}.ap7-table th{background:#e6f7f5;color:#0f5f59;text-align:left}.ap7-table th,.ap7-table td{border:1px solid #dbe3eb;padding:6pt}.ap7-chart{display:grid;gap:7pt}.ap7-bar{display:grid;grid-template-columns:90pt 1fr 35pt;gap:6pt;align-items:center;font-size:9pt}.ap7-bar i{height:12pt;background:#e2e8f0;border-radius:20pt;overflow:hidden}.ap7-bar b{display:block;height:100%;background:#0d9488}.ap7-cards{display:grid;grid-template-columns:1fr 1fr;gap:8pt}.ap7-cards article,.ap7-steps article,.ap7-diagram article{padding:8pt;border:1px solid #ccfbf1;border-radius:7pt;background:#f0fdfa}.ap7-cards small{color:#0f766e;font-weight:900}.ap7-cards strong,.ap7-steps strong,.ap7-diagram strong{display:block;margin:4pt 0;color:#16325c}.ap7-cards p,.ap7-steps p,.ap7-diagram p{margin:0;color:#64748b;font-size:8.5pt;line-height:1.35}.ap7-steps,.ap7-diagram{display:flex;gap:5pt;align-items:stretch}.ap7-steps article,.ap7-diagram article{flex:1}.ap7-steps em,.ap7-diagram em{align-self:center;color:#0d9488;font-style:normal;font-weight:900}.ap7-metric{text-align:center;padding:20pt;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10pt}.ap7-metric b{display:block;font-size:30pt;color:#0f766e}.ap7-metric strong{display:block;margin-top:7pt}.ap7-metric p{color:#64748b;font-size:9pt}.ap7-empty{color:#94a3b8}
    `;
  }

  async function pdf() {
    await ensureSaved();
    if (!M()) throw new Error('Sunum modeli yüklenemedi.');
    const pages = deck().map((raw, index) => {
      const s = M().normalize(raw, index);
      return `<section class="page"><div class="slide"><h1>${esc(s.title)}</h1><div class="rule"></div><div class="body">${M().renderBody(s)}</div><footer>${index + 1} / ${deck().length}</footer></div><div class="notes"><strong>Konuşma Notları</strong><p>${esc(s.speaker_notes || 'Bu slayt için konuşma notu eklenmemiş.')}</p></div></section>`;
    }).join('');
    const popup = window.open('', '_blank');
    if (!popup) throw new Error('PDF penceresi engellendi.');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(deckTitle())}</title><style>@page{size:13.333in 7.5in;margin:0}${sharedCss()}body{margin:0}.page{width:13.333in;height:7.5in;page-break-after:always;display:grid;grid-template-rows:6.08in 1.42in;overflow:hidden}.page:last-child{page-break-after:auto}.slide{padding:.42in .63in;position:relative;overflow:hidden}.slide h1{font-size:25pt;margin:0 0 .12in}.rule{height:3px;width:.75in;background:#0d9488;margin-bottom:.2in}.body{height:4.55in;overflow:hidden}.notes{background:#f1f5f9;border-top:2px solid #cbd5e1;padding:.15in .63in;color:#334155}.notes strong{display:block;color:#0f766e;font-size:9.5pt;text-transform:uppercase;margin-bottom:.05in}.notes p{margin:0;font-size:9pt;line-height:1.35;max-height:.9in;overflow:hidden}footer{position:absolute;right:.6in;bottom:.18in;color:#64748b;font-size:8pt}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);
    popup.document.close();
    notify('PDF önizlemesi açıldı. Slayt içeriği ve konuşma notları birlikte aktarılıyor.');
  }

  async function word() {
    await ensureSaved();
    if (!M()) throw new Error('Sunum modeli yüklenemedi.');
    const sections = deck().map((raw, index) => {
      const s = M().normalize(raw, index);
      return `<section style="page-break-after:always"><h1>${esc(s.title)}</h1><div>${M().renderBody(s)}</div><div class="notes"><h3>Konuşma Notları</h3><p>${esc(s.speaker_notes || 'Bu slayt için konuşma notu eklenmemiş.')}</p></div></section>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${sharedCss()}body{margin:34pt}.notes{margin-top:20pt;padding:10pt;background:#f1f5f9;border-left:4pt solid #0d9488}.notes h3{margin:0 0 6pt}.notes p{line-height:1.4}</style></head><body><h1>${esc(deckTitle())}</h1>${sections}</body></html>`;
    download(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${safeName(deckTitle())}.doc`);
    notify('Word belgesi içerik, görsel yapı ve konuşma notlarıyla hazırlandı.');
  }

  function menu(anchor) {
    document.getElementById('acadex-pres-export-menu-v7')?.remove();
    const menu = document.createElement('div');
    menu.id = 'acadex-pres-export-menu-v7';
    Object.assign(menu.style, { position: 'fixed', zIndex: '360000', background: '#fff', border: '1px solid rgba(22,50,92,.15)', borderRadius: '10px', boxShadow: '0 14px 35px rgba(15,23,42,.2)', padding: '6px', minWidth: '235px' });
    [['PowerPoint (.pptx)', pptx], ['PDF + Konuşma Notları', pdf], ['Word + Konuşma Notları', word]].forEach(([label, fn]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      Object.assign(button.style, { display: 'block', width: '100%', padding: '10px 12px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', borderRadius: '7px', fontWeight: '700', color: '#16325c' });
      button.onclick = async () => {
        menu.remove();
        try { await fn(); } catch (error) { console.error(error); notify(error.message || 'Dışa aktarma başarısız oldu.', 'error'); }
      };
      menu.appendChild(button);
    });
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${Math.min(innerHeight - menu.offsetHeight - 8, rect.bottom + 6)}px`;
    menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, rect.right - menu.offsetWidth))}px`;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('#pres-export-btn');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    menu(button);
  }, true);

  window.AcadexPresentationExportV7 = { pptx, pdf, word };
})();
