/* ==========================================================================
   ACADEX — GRAFİK OKUMA TESTLERİ (tests/exam-chart.js)

   Faz 4a (23.10.2026): grafikler yalnızca kaynaktan gelir (kartın
   doğrulanmış charts verisi ve sayısal tablolar); model soruya chart_ref
   yazar, grafiği sunucu ekler. Tarayıcı SVG olarak çizer.

   Çalıştırma:  node tests/exam-chart.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const GEN_PATH = 'supabase/functions/generate-exam/index.ts';
const GRADE_PATH = 'supabase/functions/grade-exam/index.ts';
const CHART = ['CHART_MAX_SOURCES', 'CHART_MAX_POINTS', 'CHART_MAX_SERIES', 'chartLabel', 'normalizeChartSpec', 'tableNumber',
  'tableToCharts', 'buildChartSources', 'describeCharts', 'attachChart', 'chartNumbers'];

const G = loadFromSource(GEN_PATH, [
  'EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression', 'sanitizeVariables', 'MATH_INPUT_MAX', 'normalizeMathInput',
  'TRUE_FALSE_OPTIONS', 'normalizeAnswerText', 'parseLooseNumber', 'PLACEHOLDER_ANSWERS', 'isPlaceholderAnswer', 'cleanText',
  'EXPLANATION_MAX_CHARS', 'RATIONALE_MAX_CHARS', 'RUBRIC_MIN_ITEMS', 'RUBRIC_MAX_ITEMS', 'normalizeOptionRationales', 'normalizeRubric',
  'numberReadings', 'sameNumber', 'withinTolerance', 'templateMatches', 'normalizeFormula', 'DERIVED_FACTORS', 'STANDARD_CONSTANTS',
  'referencesName', 'inlineName', 'STEP_KINDS', 'verifyLinearEquation', 'verifyCalculation', 'OPTION_NEAR_PERCENT', 'NUMERIC_OPTION',
  'optionCanonical', 'hasAmbiguousOptions', 'EXPR_SAMPLE_VALUES', 'EXPR_MIN_VALID_POINTS', 'EXPR_FORMS', 'exprSamplePoints',
  'expressionsEquivalent', 'hasTopLevelSum', 'isExpandedForm', 'exprTokenCount', 'checkExpressionForm', 'verifyExpression',
  'validateQuestion', ...CHART
]);
const R = loadFromSource(GRADE_PATH, ['chartAsText']);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

const { test, summary } = makeRunner();

const SALES = { title: 'Satışlar', headers: ['Yıl', 'Satış (TL)', 'Maliyet (TL)', 'Kâr marjı'],
  rows: [['2021', '1.250.000', '900.000', '%12'], ['2022', '1.480.000', '1.000.000', '%14,5'], ['2023', '1.390.000', '980.000', '%11']] };

// ---------------------------------------------------------------------------
// Kaynak → grafik
// ---------------------------------------------------------------------------
test('normalizeChartSpec: kart charts bicimi ve cok serili bicim; gecersizler null', () => {
  assert.deepEqual(G.normalizeChartSpec({ title: 'Türler', type: 'bar', labels: ['A', 'B'], data: [3, 4] }),
    { title: 'Türler', type: 'bar', labels: ['A', 'B'], series: [{ name: '', data: [3, 4] }], unit: '' });
  const m = G.normalizeChartSpec({ title: 'x', type: 'line', labels: [2021, 2022], series: [{ name: 's1', data: [1, 2] }, { name: 's2', data: ['3', '4,5'] }] });
  assert.deepEqual(m.labels, ['2021', '2022'], 'sayi etiketler metin olur');
  assert.deepEqual(m.series[1].data, [3, 4.5]);
  assert.equal(G.normalizeChartSpec({ labels: ['A'], data: [1] }), null, 'tek nokta');
  assert.equal(G.normalizeChartSpec({ labels: ['A', 'B'], data: [1, 'x'] }), null, 'sayi olmayan deger');
  assert.equal(G.normalizeChartSpec({ labels: ['A', 'B', 'C'], data: [1, 2] }), null, 'uzunluk tutmuyor');
  assert.equal(G.normalizeChartSpec({ type: 'pie', labels: ['A', 'B'], data: [5, -1] }).type, 'bar', 'negatifli pasta sutuna doner');
  assert.equal(G.normalizeChartSpec({ type: 'radar', labels: ['A', 'B'], data: [1, 2] }).type, 'bar');
  assert.equal(G.normalizeChartSpec({ labels: [...Array(40)].map((_, i) => 'L' + i), data: [...Array(40)].map((_, i) => i) }).labels.length, 24);
});

test('tableToCharts: yillar cizgi, olcek farki ayri grafik, Turkce sayilar, yuzde birimi', () => {
  const cs = G.tableToCharts(SALES);
  assert.equal(cs.length, 2, 'TL ve % ayri');
  assert.equal(cs[0].type, 'line');
  assert.deepEqual(cs[0].series.map(s => s.name), ['Satış (TL)', 'Maliyet (TL)']);
  assert.deepEqual(cs[0].series[1].data, [900000, 1000000, 980000], '900.000 binlik');
  assert.equal(cs[1].unit, '%');
  assert.deepEqual(cs[1].series[0].data, [12, 14.5, 11]);
  const bar = G.tableToCharts({ title: 'Bölgeler', headers: ['Bölge', 'Pay'], rows: [['Marmara', '38'], ['Ege', '17'], ['İç Anadolu', '15']] });
  assert.equal(bar[0].type, 'bar');
  assert.deepEqual(G.tableToCharts({ title: 'Roller', headers: ['Rol', 'Görev'], rows: [['a', 'b'], ['c', 'd']] }), [], 'sayisal sutun yok');
  assert.deepEqual(G.tableToCharts({ headers: ['a', 'b'], rows: [['x', '1']] }), [], 'tek satir');
});

test('tableNumber: binlik ayrac ve ondalik', () => {
  for (const [v, want] of [['900.000', 900000], ['0.125', 0.125], ['1,5', 1.5], ['12.5', 12.5], ['1.234,56', 1234.56], ['%12', 12], ['₺1.250', 1250], ['-3.000', -3000]]) {
    assert.equal(G.tableNumber(v), want, v);
  }
});

test('buildChartSources: grafikler once, en cok 6; describeCharts numarali', () => {
  const src = G.buildChartSources([{ title: 'X', type: 'pie', labels: ['a', 'b'], data: [1, 2] }], [SALES, SALES, SALES]);
  assert.equal(src.length, 6);
  assert.equal(src[0].title, 'X');
  const d = G.describeCharts(src.slice(0, 2));
  assert.match(d, /^\[1\] "X" \(pie\)/);
  assert.match(d, /\[2\] .*\n  Satış \(TL\): 2021=1250000/);
});

test('attachChart: gecerli numara sunucu grafigini ekler; modelin grafigi ve chart_ref atilir', () => {
  const src = G.buildChartSources([], [SALES]);
  const q = G.attachChart({ type: 'calculation', chart_ref: 1, chart: { title: 'uydurma' } }, src);
  assert.equal(q.chart.title, src[0].title);
  assert.ok(!('chart_ref' in q));
  assert.ok(!('chart' in G.attachChart({ type: 'x', chart_ref: 9, chart: { title: 'uydurma' } }, src)), 'olmayan numara');
  assert.ok(!('chart' in G.attachChart({ type: 'x', chart_ref: '1.5' }, src)));
  assert.deepEqual(G.chartNumbers(src[0]), [1250000, 1480000, 1390000, 900000, 1000000, 980000]);
});

test('grafikli hesap sorusu: degerler grafikten, metinde sayi yok; sablon kapali', () => {
  const src = G.buildChartSources([], [SALES]);
  const raw = { type: 'calculation', question: 'Grafiğe göre satışlar 2021\'den 2022\'ye yüzde kaç arttı?', correct_answer: 18.4, tolerance_percent: 1, units: '%',
    variables: { s21: 1250000, s22: 1480000 }, formula: '(s22 - s21) / s21 * 100', template: 'x {s21} {s22}', chart_ref: 1 };
  const r = G.validateQuestion(G.attachChart(raw, src), ['calculation'], 'tr');
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.question.correct_answer, 18.4);
  assert.equal(r.question.verified, true);
  assert.equal(r.question.template, null);
  assert.equal(r.question.chart.title, src[0].title);
  const noChart = G.validateQuestion(G.attachChart({ ...raw, chart_ref: null }, src), ['calculation'], 'tr');
  assert.equal(noChart.reason, 'calc_var_not_in_text', 'grafik yoksa sayilar gizli girdi');
  const wrong = G.validateQuestion(G.attachChart({ ...raw, variables: { s21: 1250000, s22: 1500000 } }, src), ['calculation'], 'tr');
  assert.equal(wrong.reason, 'calc_var_not_in_text', 'grafikte olmayan deger');
});

test('grafikli coktan secmeli soru grafigi tasir', () => {
  const src = G.buildChartSources([], [SALES]);
  const r = G.validateQuestion(G.attachChart({ type: 'multiple_choice', question: 'Grafiğe göre satışların en yüksek olduğu yıl hangisidir?', options: ['2021', '2022', '2023', '2024'], correct_answer: '2022', chart_ref: 1 }, src), ['multiple_choice'], 'tr', 4);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.question.chart.type, 'line');
});

test('grade-exam chartAsText: puanlayici grafigi metin olarak gorur', () => {
  const t = R.chartAsText({ title: 'Satışlar', labels: ['2021', '2022'], series: [{ name: 'TL', data: [1, 2] }], unit: '' });
  assert.match(t, /Öğrencinin gördüğü grafik "Satışlar": TL: 2021=1, 2022=2/);
  assert.equal(R.chartAsText(null), '');
  assert.equal(R.chartAsText({ labels: [], series: [] }), '');
});

// ---------------------------------------------------------------------------
// Tarayıcı: SVG çizimi
// ---------------------------------------------------------------------------
test('niceTicks: okunur adimlar, araligi kapsar', () => {
  assert.deepEqual(E.niceTicks(0, 1480000), [0, 500000, 1000000, 1500000]);
  assert.deepEqual(E.niceTicks(-3, 8), [-5, -2.5, 0, 2.5, 5, 7.5, 10]);
  const t = E.niceTicks(11, 14.5);
  assert.ok(t[0] <= 11 && t[t.length - 1] >= 14.5);
  assert.deepEqual(E.niceTicks(5, 5).length > 1, true, 'tek deger');
});

test('renderChartSvg: sutun, cizgi, pasta; NaN yok; gecersiz bos', () => {
  const bar = E.renderChartSvg({ title: 'Pay', type: 'bar', labels: ['A', 'B', 'C', 'D'], series: [{ name: '', data: [12, -4, 30, 8] }], unit: '%' }, 'tr');
  assert.equal((bar.match(/class="axc-bar"/g) || []).length, 4);
  assert.ok(bar.includes('%30'), 'Turkce yuzde');
  assert.ok(bar.includes('-%4') && !bar.includes('%-4'), 'negatif yuzde -%4');
  assert.ok(bar.includes('class="axc-zero"'), 'sifir cizgisi');
  const line = E.renderChartSvg({ title: 'S', type: 'line', labels: ['2021', '2022', '2023'], series: [{ name: 'a', data: [1250000, 1480000, 1390000] }, { name: 'b', data: [900000, 1000000, 980000] }] }, 'tr');
  assert.equal((line.match(/<polyline/g) || []).length, 2);
  assert.equal((line.match(/<circle/g) || []).length, 6);
  assert.ok(line.includes('>a</text>') && line.includes('>b</text>'), 'iki seride gosterge');
  const pie = E.renderChartSvg({ title: 'P', type: 'pie', labels: ['X', 'Y', 'Z'], series: [{ name: '', data: [50, 30, 20] }] }, 'tr');
  assert.equal((pie.match(/<path/g) || []).length, 3);
  assert.ok(pie.includes('(%50)'));
  // birimi % ve pay ayniysa ikinci kez yazilmaz (canli test 24.10.2026)
  const pieP = E.renderChartSvg({ title: 'P', type: 'pie', labels: ['Marmara', 'Ege'], series: [{ name: '', data: [62, 38] }], unit: '%' }, 'tr');
  assert.ok(pieP.includes('Marmara: %62<') && !pieP.includes('(%62)'), 'tekrar yok');
  for (const svg of [bar, line, pie]) assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.equal(E.renderChartSvg({ labels: ['a'], series: [{ data: [1] }] }, 'tr'), '');
  assert.equal(E.renderChartSvg(null, 'tr'), '');
  assert.equal(E.renderChartSvg({ labels: ['a', 'b'], series: [{ data: [1, NaN] }] }, 'tr'), '');
});

test('chartFigureHtml: baslik, ekran okuyucu tablosu, kacis', () => {
  const html = E.chartFigureHtml({ title: '<b>Satış</b>', type: 'bar', labels: ['<script>', 'B'], series: [{ name: 'TL', data: [1, 2] }], unit: '' }, 'tr');
  assert.match(html, /<figure class="axc-chart"><figcaption>&lt;b&gt;Satış&lt;\/b&gt;<\/figcaption>/);
  assert.match(html, /<table class="axc-sr">/);
  assert.ok(!html.includes('<script>'), 'etiket kacisli');
  assert.match(html, /role="img" aria-labelledby=/);
});

summary();
