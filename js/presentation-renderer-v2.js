/* Acadex Presentation Renderer V3 — guaranteed visual slide renderer */
(function () {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function cleanLines(v) {
    return String(v || '').split(/\r?\n/).map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  }
  function splitLabel(line) {
    const idx = line.indexOf(':');
    if (idx > 0 && idx < 70) return { title: line.slice(0, idx).trim(), body: line.slice(idx + 1).trim() };
    const dash = line.indexOf(' — ');
    if (dash > 0 && dash < 70) return { title: line.slice(0, dash).trim(), body: line.slice(dash + 3).trim() };
    return { title: '', body: line };
  }
  function structuredFallback(content) {
    if (!content || typeof content !== 'object') return '';
    if (Array.isArray(content.cards) && content.cards.length) return content.cards.map(x => `• ${x.title}: ${x.body}`).join('\n');
    if (Array.isArray(content.steps) && content.steps.length) return content.steps.map(x => `• ${x.label ? x.label + ' — ' : ''}${x.title}${x.body ? ': ' + x.body : ''}`).join('\n');
    if (content.metric?.value) return `• ${content.metric.value} — ${content.metric.label}${content.metric.context ? ': ' + content.metric.context : ''}`;
    if (content.table?.rows?.length) return content.table.rows.slice(0, 6).map(r => `• ${r.join(' — ')}`).join('\n');
    if (content.chart?.labels?.length) return content.chart.labels.map((x,i) => `• ${x}: ${content.chart.data?.[i] ?? ''}`).join('\n');
    return '';
  }
  function autoCards(content) {
    const lines = cleanLines(content?.text).slice(0, 6);
    return lines.map((line, i) => {
      const parts = splitLabel(line);
      return { title: parts.title || `Kavram ${i + 1}`, body: parts.body || line };
    });
  }
  function autoComparison(content) {
    const left = cleanLines(content?.text);
    const right = cleanLines(content?.secondary_text);
    if (left.length && right.length) {
      return [
        { title: splitLabel(left[0]).title || 'A', body: left.map(x => splitLabel(x).body || x).join(' ') },
        { title: splitLabel(right[0]).title || 'B', body: right.map(x => splitLabel(x).body || x).join(' ') }
      ];
    }
    if (left.length >= 2) {
      const first = splitLabel(left[0]);
      const second = splitLabel(left[1]);
      return [
        { title: first.title || 'Kavram 1', body: first.body || left[0] },
        { title: second.title || 'Kavram 2', body: second.body || left[1] }
      ];
    }
    return [];
  }
  function autoComparisonTable(content) {
    const items = autoComparison(content);
    if (items.length !== 2) return null;
    return {
      headers: ['Kavram', 'Açıklama'],
      rows: items.map(item => [item.title, item.body])
    };
  }
  function extractNumericSeries(content) {
    const lines = cleanLines(`${content?.text || ''}\n${content?.secondary_text || ''}`);
    const labels = [];
    const data = [];
    for (const line of lines) {
      const match = line.match(/^(.*?)(?:[:\-–—]\s*)?(-?\d+(?:[.,]\d+)?)\s*(%|percent|puan|points?)?\b/i);
      if (!match) continue;
      const value = Number(match[2].replace(',', '.'));
      if (!Number.isFinite(value)) continue;
      let label = match[1].trim().replace(/^[-•*]\s*/, '').replace(/[:\-–—]+$/, '').trim();
      if (!label) label = `Değer ${labels.length + 1}`;
      labels.push(label.slice(0, 70));
      data.push(value);
      if (labels.length >= 7) break;
    }
    return labels.length >= 2 ? { type: 'bar', title: '', series_label: 'Değer', labels, data, datasets: [{ label: 'Değer', data }] } : null;
  }

  const originalNormalize = window.normalizePresentationSlide;
  if (typeof originalNormalize === 'function') {
    window.normalizePresentationSlide = function (slide, index) {
      const normalized = originalNormalize(slide, index);
      normalized.content = normalized.content && typeof normalized.content === 'object' ? normalized.content : {};
      const content = normalized.content;
      if (!String(content.text || '').trim()) content.text = structuredFallback(content);

      const variant = content.design_variant || '';
      if (variant === 'cards' && (!Array.isArray(content.cards) || content.cards.length < 2)) content.cards = autoCards(content);
      if ((variant === 'process' || variant === 'timeline') && (!Array.isArray(content.steps) || content.steps.length < 2)) {
        content.steps = cleanLines(content.text).slice(0, 6).map((line, i) => ({ label: variant === 'timeline' ? `${i + 1}` : `${i + 1}`, title: splitLabel(line).title || line.slice(0, 80), body: splitLabel(line).body || '' }));
      }
      if (variant === 'comparison') {
        const table = autoComparisonTable(content);
        if (table && (!content.table || !Array.isArray(content.table.rows))) content.table = table;
      }
      if (!content.chart) {
        const chart = extractNumericSeries(content);
        if (chart) content.chart = chart;
      }

      if (content.chart?.labels?.length >= 2 && ['data','big-number'].includes(variant)) normalized.layout_type = 'chart';
      else if (content.table?.headers?.length >= 2 && variant === 'comparison') normalized.layout_type = 'table';
      else if (variant === 'comparison') normalized.layout_type = 'two-column';
      return normalized;
    };
  }

  function show(preview, empty, actions) {
    empty.hidden = true;
    preview.hidden = false;
    actions.hidden = false;
  }
  function renderCards(preview, cards) {
    const safeCards = cards.slice(0, 6);
    preview.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${safeCards.length <= 2 ? 2 : 3},minmax(0,1fr));gap:.65rem;width:100%;padding:.3rem;">${safeCards.map((c,i)=>`<article style="min-height:118px;padding:.8rem;border:1px solid rgba(13,148,136,.20);border-radius:14px;background:linear-gradient(145deg,#ffffff,#f0fdfa);box-shadow:0 7px 20px rgba(15,23,42,.07);"><div style="width:30px;height:30px;border-radius:9px;background:#ccfbf1;color:#0f766e;display:grid;place-items:center;font-weight:900;font-size:.72rem;margin-bottom:.45rem;">${String(i+1).padStart(2,'0')}</div><strong style="display:block;color:#16325c;font-size:.8rem;margin-bottom:.28rem;line-height:1.25;">${esc(c.title)}</strong><span style="font-size:.67rem;line-height:1.45;color:#475569;">${esc(c.body)}</span></article>`).join('')}</div>`;
  }
  function renderSteps(preview, steps, timeline) {
    preview.innerHTML = `<div style="display:flex;align-items:stretch;gap:.4rem;width:100%;padding:.45rem .2rem;overflow:auto;">${steps.slice(0,7).map((s,i)=>`<div style="flex:1;min-width:110px;position:relative;padding:.7rem .6rem;border-radius:13px;background:${timeline?'linear-gradient(180deg,#fff,#f8fafc)':'linear-gradient(180deg,#f0fdfa,#fff)'};border:1px solid rgba(22,50,92,.12);box-shadow:0 4px 14px rgba(15,23,42,.05);"><div style="display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:25px;padding:0 .4rem;border-radius:999px;background:#0d9488;color:white;font-size:.62rem;font-weight:900;margin-bottom:.4rem;">${esc(s.label || i+1)}</div><strong style="display:block;font-size:.73rem;color:#16325c;margin-bottom:.22rem;line-height:1.25;">${esc(s.title)}</strong><span style="font-size:.61rem;line-height:1.4;color:#64748b;">${esc(s.body||'')}</span></div>`).join('<div style="align-self:center;color:#0d9488;font-weight:900;font-size:1rem;">→</div>')}</div>`;
  }
  function renderMetric(preview, metric) {
    preview.innerHTML = `<div style="width:100%;min-height:205px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem;border-radius:18px;background:radial-gradient(circle at top right,#99f6e4,transparent 42%),linear-gradient(145deg,#f8fafc,#fff);border:1px solid rgba(13,148,136,.18);box-shadow:0 8px 24px rgba(15,23,42,.06);"><div style="font-size:2.55rem;line-height:1;font-weight:950;color:#0f766e;letter-spacing:-.05em;">${esc(metric.value)}</div><strong style="font-size:.9rem;color:#16325c;margin-top:.6rem;">${esc(metric.label)}</strong><span style="max-width:82%;font-size:.69rem;line-height:1.5;color:#64748b;margin-top:.38rem;">${esc(metric.context||'')}</span></div>`;
  }
  function renderHero(preview, slide) {
    const lines = cleanLines(slide?.content?.text).slice(0,3);
    preview.innerHTML = `<div style="width:100%;min-height:215px;display:flex;align-items:center;gap:1.15rem;padding:1.15rem 1.25rem;border-radius:18px;background:linear-gradient(135deg,#0b253d,#0f766e);color:white;overflow:hidden;position:relative;box-shadow:0 10px 28px rgba(15,41,66,.18);"><div style="position:absolute;width:210px;height:210px;border-radius:50%;right:-70px;top:-75px;background:rgba(255,255,255,.08);"></div><div style="position:absolute;width:95px;height:95px;border-radius:50%;left:38%;bottom:-60px;background:rgba(153,246,228,.13);"></div><div style="width:58px;height:58px;border-radius:17px;background:rgba(255,255,255,.14);display:grid;place-items:center;font-size:1.75rem;flex:none;">✦</div><div style="position:relative;"><strong style="display:block;font-size:1.05rem;line-height:1.25;margin-bottom:.5rem;">${esc(slide.title||'')}</strong>${lines.map(x=>`<div style="font-size:.72rem;opacity:.88;margin:.2rem 0;">${esc(x)}</div>`).join('')}</div></div>`;
  }
  function renderComparison(preview, content) {
    const items = autoComparison(content);
    if (items.length !== 2) return false;
    preview.innerHTML = `<div style="display:grid;grid-template-columns:1fr 48px 1fr;align-items:stretch;gap:.65rem;width:100%;padding:.35rem;"><article style="padding:.9rem;border-radius:16px;background:linear-gradient(145deg,#eff6ff,#fff);border:1px solid #bfdbfe;box-shadow:0 6px 18px rgba(37,99,235,.07);"><div style="font-size:.62rem;font-weight:900;color:#2563eb;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.45rem;">A</div><strong style="display:block;font-size:.85rem;color:#16325c;margin-bottom:.35rem;">${esc(items[0].title)}</strong><span style="font-size:.68rem;line-height:1.5;color:#475569;">${esc(items[0].body)}</span></article><div style="display:flex;align-items:center;justify-content:center;"><div style="width:38px;height:38px;border-radius:50%;background:#16325c;color:white;display:grid;place-items:center;font-size:.68rem;font-weight:900;box-shadow:0 5px 15px rgba(22,50,92,.18);">VS</div></div><article style="padding:.9rem;border-radius:16px;background:linear-gradient(145deg,#f0fdfa,#fff);border:1px solid #99f6e4;box-shadow:0 6px 18px rgba(13,148,136,.07);"><div style="font-size:.62rem;font-weight:900;color:#0d9488;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.45rem;">B</div><strong style="display:block;font-size:.85rem;color:#16325c;margin-bottom:.35rem;">${esc(items[1].title)}</strong><span style="font-size:.68rem;line-height:1.5;color:#475569;">${esc(items[1].body)}</span></article></div>`;
    return true;
  }
  function renderConceptGrid(preview, content) {
    const cards = autoCards(content);
    if (!cards.length) return false;
    renderCards(preview, cards);
    return true;
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
    if (!preview.hidden) return; // valid chart/table already rendered by native editor

    if (variant === 'comparison' && renderComparison(preview, content)) { show(preview, empty, actions); return; }
    if (Array.isArray(content.cards) && content.cards.length) { renderCards(preview, content.cards); show(preview, empty, actions); return; }
    if (Array.isArray(content.steps) && content.steps.length) { renderSteps(preview, content.steps, variant === 'timeline'); show(preview, empty, actions); return; }
    if (content.metric?.value) { renderMetric(preview, content.metric); show(preview, empty, actions); return; }
    if (variant === 'hero') { renderHero(preview, slide); show(preview, empty, actions); return; }

    // Every AI slide gets a visual treatment instead of remaining a plain wall of text.
    const lines = cleanLines(content.text);
    if (lines.length && renderConceptGrid(preview, content)) { show(preview, empty, actions); return; }
  };

  window.acadexPresentationRendererVersion = '3.0';
})();
