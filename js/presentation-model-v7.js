/* Acadex Presentation Model V7 — one source of truth for editor, preview and export */
(function () {
  'use strict';
  if (window.AcadexPresentationModelV7) return;

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function lines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((item) => item.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
  }

  function contentOf(slide) {
    return slide && slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content)
      ? slide.content
      : {};
  }

  const validTable = (table) => !!(table && Array.isArray(table.headers) && table.headers.length >= 2 && Array.isArray(table.rows) && table.rows.length);
  const validChart = (chart) => !!(chart && Array.isArray(chart.labels) && chart.labels.length >= 2 && Array.isArray(chart.data) && chart.data.length === chart.labels.length && chart.data.every((v) => Number.isFinite(Number(v))));
  const validCards = (cards) => Array.isArray(cards) && cards.length >= 2;
  const validSteps = (steps) => Array.isArray(steps) && steps.length >= 2;
  const validMetric = (metric) => !!(metric && String(metric.value || '').trim() && String(metric.label || '').trim());
  const validDiagram = (diagram) => !!(diagram && Array.isArray(diagram.nodes) && diagram.nodes.length >= 2);

  function isGenericChart(chart) {
    if (!validChart(chart)) return true;
    const labels = chart.labels.map((x) => String(x || '').trim());
    const generic = labels.every((label, index) => {
      const n = index + 1;
      return new RegExp(`^(?:değer|deger|value|kategori|category)\\s*${n}$`, 'i').test(label)
        || label === String(n);
    });
    return generic;
  }

  function fallbackText(slide) {
    const content = contentOf(slide);
    if (String(content.text || '').trim()) return String(content.text).trim();
    if (validCards(content.cards)) return content.cards.slice(0, 6).map((c) => `• ${c.title}${c.body ? ` — ${c.body}` : ''}`).join('\n');
    if (validSteps(content.steps)) return content.steps.slice(0, 7).map((s, i) => `• ${s.label || i + 1}. ${s.title}${s.body ? ` — ${s.body}` : ''}`).join('\n');
    if (validMetric(content.metric)) return `• ${content.metric.value} — ${content.metric.label}${content.metric.context ? `: ${content.metric.context}` : ''}`;
    if (validTable(content.table)) return content.table.rows.slice(0, 6).map((row) => `• ${row.join(' — ')}`).join('\n');
    if (validChart(content.chart) && !isGenericChart(content.chart)) return content.chart.labels.map((label, i) => `• ${label}: ${content.chart.data[i]}`).join('\n');
    if (String(content.secondary_text || '').trim()) return String(content.secondary_text).trim();
    return String(slide?.speaker_notes || '').trim().split(/(?<=[.!?])\s+/).slice(0, 3).join(' ').slice(0, 800);
  }

  function normalize(slide, index = 0) {
    const input = slide && typeof slide === 'object' ? slide : {};
    const content = { ...contentOf(input) };
    if (!String(content.text || '').trim()) content.text = fallbackText(input);
    const normalized = {
      ...input,
      title: String(input.title || `Slayt ${index + 1}`).trim(),
      layout_type: String(input.layout_type || input.layout || 'title-content'),
      content,
      speaker_notes: String(input.speaker_notes || input.speakerNotes || '').trim()
    };
    return normalized;
  }

  function visualKind(slide) {
    const s = normalize(slide);
    const c = s.content;
    const variant = String(c.design_variant || '').toLowerCase();
    const layout = String(s.layout_type || '').toLowerCase();

    // Summary/teaching slides keep their actual text. A stale chart must never replace it.
    const chartAllowed = validChart(c.chart) && !isGenericChart(c.chart)
      && (variant === 'data' || layout === 'chart');
    if (chartAllowed) return 'chart';
    if (validTable(c.table) && (variant === 'comparison' || layout === 'table')) return 'table';
    if (validDiagram(c.diagram)) return 'diagram';
    if (validSteps(c.steps) && (variant === 'process' || variant === 'timeline')) return variant;
    if (validCards(c.cards) && variant === 'cards') return 'cards';
    if (validMetric(c.metric) && variant === 'big-number') return 'metric';
    if (validTable(c.table)) return 'table';
    if (validSteps(c.steps)) return 'process';
    if (validCards(c.cards)) return 'cards';
    if (validMetric(c.metric)) return 'metric';
    return null;
  }

  function renderText(slide) {
    const s = normalize(slide);
    const primary = lines(s.content.text);
    const secondary = lines(s.content.secondary_text);
    if (secondary.length) {
      return `<div class="ap7-cols"><div>${primary.map((x) => `<p><span>•</span>${esc(x)}</p>`).join('')}</div><div>${secondary.map((x) => `<p><span>•</span>${esc(x)}</p>`).join('')}</div></div>`;
    }
    if (!primary.length) return '';
    return `<div class="ap7-bullets">${primary.map((x) => `<p><span>•</span>${esc(x)}</p>`).join('')}</div>`;
  }

  function renderTable(table) {
    return `<div class="ap7-table-wrap"><table class="ap7-table"><thead><tr>${table.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.slice(0, 8).map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderChart(chart) {
    const values = chart.data.map(Number);
    const max = Math.max(1, ...values.map((v) => Math.abs(v)));
    return `<div class="ap7-chart">${chart.labels.map((label, i) => {
      const value = Number(values[i]) || 0;
      const width = Math.max(4, Math.round(Math.abs(value) / max * 100));
      return `<div class="ap7-bar"><span>${esc(label)}</span><i><b style="width:${width}%"></b></i><strong>${esc(chart.data[i])}</strong></div>`;
    }).join('')}</div>`;
  }

  function renderCards(cards) {
    return `<div class="ap7-cards">${cards.slice(0, 6).map((card, i) => `<article><small>${String(i + 1).padStart(2, '0')}</small><strong>${esc(card.title)}</strong><p>${esc(card.body || '')}</p></article>`).join('')}</div>`;
  }

  function renderSteps(steps, timeline) {
    return `<div class="ap7-steps ${timeline ? 'is-timeline' : ''}">${steps.slice(0, 7).map((step, i) => `<article><span>${esc(step.label || i + 1)}</span><strong>${esc(step.title)}</strong><p>${esc(step.body || '')}</p></article>`).join('<em>→</em>')}</div>`;
  }

  function renderMetric(metric) {
    return `<div class="ap7-metric"><b>${esc(metric.value)}</b><strong>${esc(metric.label)}</strong>${metric.context ? `<p>${esc(metric.context)}</p>` : ''}</div>`;
  }

  function renderDiagram(diagram) {
    const type = String(diagram.type || 'flow').toLowerCase();
    const nodes = diagram.nodes.slice(0, 7);
    return `<div class="ap7-diagram type-${esc(type)}">${nodes.map((node, i) => `<article><span>${String(i + 1).padStart(2, '0')}</span><strong>${esc(node.label || node.title || '')}</strong>${node.body ? `<p>${esc(node.body)}</p>` : ''}</article>`).join(type === 'matrix' ? '' : '<em>→</em>')}</div>`;
  }

  function renderVisual(slide) {
    const s = normalize(slide);
    const c = s.content;
    const kind = visualKind(s);
    if (kind === 'table') return renderTable(c.table);
    if (kind === 'chart') return renderChart(c.chart);
    if (kind === 'cards') return renderCards(c.cards);
    if (kind === 'process') return renderSteps(c.steps, false);
    if (kind === 'timeline') return renderSteps(c.steps, true);
    if (kind === 'metric') return renderMetric(c.metric);
    if (kind === 'diagram') return renderDiagram(c.diagram);
    return '';
  }

  function renderBody(slide) {
    const s = normalize(slide);
    const text = renderText(s);
    const visual = renderVisual(s);
    if (text && visual) return `<div class="ap7-combo"><div class="ap7-copy">${text}</div><div class="ap7-visual">${visual}</div></div>`;
    return text || visual || '<div class="ap7-empty">Bu slayt için görünür içerik bulunmuyor.</div>';
  }

  window.AcadexPresentationModelV7 = {
    esc,
    lines,
    normalize,
    fallbackText,
    visualKind,
    renderText,
    renderVisual,
    renderBody,
    validTable,
    validChart,
    validCards,
    validSteps,
    validMetric,
    validDiagram,
    isGenericChart
  };
})();
