/* ==========================================================================
   ACADEX — HATA DEFTERİ: İKİNCİ ŞANS TESTLERİ (tests/exam-retry.js)

   Faz 8 (30.10.2026):
     - exam-engine mistakeStates: yanlış (50 altı) → takvim (hiç denenmediyse
       hemen, yanlışsa 1 gün, doğruysa 3 gün), art arda iki doğru (80+) →
       kazanıldı; ikinci şans sınavının kendi sonuçları yeni yanlış olmaz
     - generate-exam { retry }: şablonlu hesap sorusu yeni sayılarla (model
       yok); ötekilerde model sorusu aynı tipte olmalı, kaynağın kendisi olamaz
     - ekran: defter ikinci şans sınavlarını ayrı yanlış saymaz
   Faz 11 (30.10.2026): grafik okuma sorusu sayıları değişmiş grafikle aynı
   biçimde kodla; çizim ve ifade sorusu modelle, kaynağın denklemleri ya da
   cevabı aynıysa kopya sayılır.

   Çalıştırma:  node tests/exam-retry.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFromSource, readSource, makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const GEN = 'supabase/functions/generate-exam/index.ts';
const G = loadFromSource(GEN, [
  'TRUE_FALSE_OPTIONS', 'KEY_FIELDS', 'INTERNAL_FIELDS',
  'EXPLANATION_MAX_CHARS', 'RATIONALE_MAX_CHARS', 'RUBRIC_MIN_ITEMS', 'RUBRIC_MAX_ITEMS',
  'fixJsonEscapes', 'parseQuestionArray', 'normalizeAnswerText', 'parseLooseNumber', 'answerNumber',
  'PLACEHOLDER_ANSWERS', 'isPlaceholderAnswer', 'cleanText',
  'EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression', 'sanitizeVariables',
  'numberReadings', 'sameNumber', 'withinTolerance', 'templateMatches', 'normalizeFormula', 'DERIVED_FACTORS', 'TEMPLATE_DISPLAY_OPS', 'verifyCalculation', 'normalizeOptionRationales', 'normalizeRubric',
  'repairLatex', 'unverifiedAnswerConsistent', 'validateQuestion', 'CALC_PH', 'fillCalcPlaceholders', 'formatNumber', 'tidy', 'shuffleInPlace',
  'OPTION_NEAR_PERCENT', 'NUMERIC_OPTION', 'optionCanonical', 'hasAmbiguousOptions', 'MATH_INPUT_MAX', 'normalizeMathInput', 'STEP_KINDS', 'verifyLinearEquation', 'EXPR_SAMPLE_VALUES', 'EXPR_MIN_VALID_POINTS', 'EXPR_FORMS', 'exprSamplePoints', 'expressionsEquivalent', 'hasTopLevelSum', 'isExpandedForm', 'exprTokenCount', 'checkExpressionForm', 'verifyExpression', 'STANDARD_CONSTANTS', 'referencesName', 'inlineName', 'chartNumbers',
  'TEMPLATE_PH', 'formatNumber', 'templateMultipliers', 'tidy', 'renderTemplate', 'decimalsOf', 'significantDigits', 'makeVariant',
  'RETRY_MAX_ITEMS', 'RETRY_TYPES', 'retryCalcVariant', 'retryUserPrompt', 'retrySimilarity', 'acceptRetryQuestion']);
const G2 = loadFromSource(GEN, [...new Set([
  'TRUE_FALSE_OPTIONS', 'KEY_FIELDS', 'INTERNAL_FIELDS', 'EXPLANATION_MAX_CHARS', 'RATIONALE_MAX_CHARS', 'RUBRIC_MIN_ITEMS', 'RUBRIC_MAX_ITEMS',
  'fixJsonEscapes', 'parseQuestionArray', 'normalizeAnswerText', 'parseLooseNumber', 'answerNumber', 'PLACEHOLDER_ANSWERS', 'isPlaceholderAnswer', 'cleanText',
  'EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression', 'sanitizeVariables',
  'numberReadings', 'sameNumber', 'withinTolerance', 'templateMatches', 'normalizeFormula', 'DERIVED_FACTORS', 'TEMPLATE_DISPLAY_OPS', 'verifyCalculation', 'normalizeOptionRationales', 'normalizeRubric',
  'repairLatex', 'unverifiedAnswerConsistent', 'validateQuestion', 'CALC_PH', 'fillCalcPlaceholders', 'formatNumber', 'tidy', 'OPTION_NEAR_PERCENT', 'NUMERIC_OPTION', 'optionCanonical', 'hasAmbiguousOptions', 'MATH_INPUT_MAX', 'normalizeMathInput',
  'STEP_KINDS', 'verifyLinearEquation', 'EXPR_SAMPLE_VALUES', 'EXPR_MIN_VALID_POINTS', 'EXPR_FORMS', 'exprSamplePoints', 'expressionsEquivalent', 'hasTopLevelSum', 'isExpandedForm', 'exprTokenCount', 'checkExpressionForm', 'verifyExpression', 'STANDARD_CONSTANTS', 'referencesName', 'inlineName', 'chartNumbers',
  'CHART_FORMATS', 'CHART_SKILLS', 'seededRandom', 'TR_DIGIT_WORD', 'TR_TEN_WORD', 'TR_LETTER_NAME', 'trSpokenTail', 'trSuffix',
  'decimalsIn', 'chartVariant', 'pctChange', 'claimTruth', 'seriesWord', 'fmtPct', 'fmtNum', 'claimText', 'claimEvidence',
  'titleSubject', 'valueOptions', 'thresholdsAround', 'TR_MONTHS', 'isTimeAxis', 'claimCandidates', 'claimSubject', 'pickClaims', 'ROMAN', 'PREMISE_COMBOS', 'comboLabel',
  'buildChartQuestion', 'CHART_MAX_SOURCES', 'CHART_MAX_POINTS', 'CHART_MAX_SERIES', 'chartLabel', 'normalizeChartSpec',
  'GRAPH_KINDS', 'GRAPH_TOOL_ORDER', 'GRAPH_MAX_STEPS', 'GRAPH_MAX_ELEMENTS', 'GRAPH_MAX_GIVEN', 'GRAPH_SHIFT_DIRS', 'graphRound', 'normalizeGraphAxis',
  'graphLinear', 'graphInequality', 'graphInBox', 'graphOnGrid', 'graphLineOf', 'graphClipLine', 'graphGridPointsOnLine', 'graphRef', 'graphResolvePoint',
  'GRAPH_KIND_ALIASES', 'graphMapAxisVars', 'normalizeGraphObject', 'graphIneqHolds', 'graphShiftDir', 'graphElementSnap', 'graphNum', 'graphLineText', 'graphPointText',
  'GRAPH_KIND_NAMES', 'graphAnswerText', 'graphDrawLabels', 'graphSameLine', 'GRAPH_EQ_TERM', 'GRAPH_EQ_RE', 'graphEquationsIn', 'graphCopiesFile', 'verifyGraph',
  'retrySimilarity', 'acceptRetryQuestion', 'retryChartFormat', 'retryChartVariant', 'retryUserPrompt', 'RETRY_TYPES'
])]);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const D = 86400000, T0 = Date.parse('2026-10-20T10:00:00Z');
const iso = (d) => new Date(T0 + d * D).toISOString();

const SRC = { id: 'e1', completed_at: iso(0), scoring: {}, question_results: [
  { question_id: 1, type: 'multiple_choice', score: 0 },
  { question_id: 2, type: 'calculation', score: 100 },
  { question_id: 3, type: 'open_ended', score: 40 },
  { question_id: 4, type: 'fill_blank', score: null }
] };
const retryExam = (id, day, items, scores) => ({ id, completed_at: iso(day), scoring: { retry: items.map(q => ({ exam_id: 'e1', question_id: q })) }, question_results: scores.map((s, i) => ({ question_id: i + 1, type: 'multiple_choice', score: s })) });

test('yanlışlar: 50 altı ve puanlanmamış; hiç denenmeyen hemen tekrar', () => {
  const m = E.mistakeStates([SRC], { now: T0 + D });
  assert.deepEqual(Object.keys(m).sort(), ['e1:1', 'e1:3', 'e1:4']);
  assert.deepEqual([m['e1:1'].dueNow, m['e1:1'].streak, m['e1:1'].won, m['e1:1'].attempts.length], [true, 0, false, 0]);
});

test('takvim: yanlış denemeden 1 gün, doğrudan 3 gün sonra; iki doğru kazanır', () => {
  const r1 = retryExam('r1', 1, [1, 3], [100, 30]);
  let m = E.mistakeStates([SRC, r1], { now: T0 + 1.5 * D });
  assert.deepEqual([m['e1:1'].streak, m['e1:1'].dueNow, m['e1:1'].inDays], [1, false, 3]);
  assert.deepEqual([m['e1:3'].streak, m['e1:3'].dueNow, m['e1:3'].inDays], [0, false, 1]);
  m = E.mistakeStates([SRC, r1], { now: T0 + 4.1 * D });
  assert.equal(m['e1:1'].dueNow, true);
  const r2 = retryExam('r2', 4.2, [1], [80]);
  m = E.mistakeStates([r2, SRC, r1], { now: T0 + 5 * D });
  assert.deepEqual([m['e1:1'].streak, m['e1:1'].won, m['e1:1'].dueNow], [2, true, false]);
  const r3 = retryExam('r3', 4.2, [3], [79]);
  m = E.mistakeStates([SRC, r1, r3], { now: T0 + 5 * D });
  assert.deepEqual([m['e1:3'].streak, m['e1:3'].attempts.length], [0, 2], '79 doğru sayılmaz');
});

test('ikinci şans sınavının kendi yanlışları yeni yanlış olmaz; arada yanlış seriyi bozar', () => {
  const r1 = retryExam('r1', 1, [1], [100]), r2 = retryExam('r2', 5, [1], [0]), r3 = retryExam('r3', 7, [1], [100]);
  const m = E.mistakeStates([SRC, r1, r2, r3], { now: T0 + 8 * D });
  assert.equal(Object.keys(m).some(k => k.startsWith('r')), false);
  assert.deepEqual([m['e1:1'].streak, m['e1:1'].won], [1, false]);
  assert.equal(E.isRetryExam(r1), true); assert.equal(E.isRetryExam(SRC), false);
});

test('hatırlatma (Faz 9): hiç denenmeyen sınavdan 1 gün sonra, denenen tekrar gününde; aynı yanlış iki kez çalmaz', () => {
  const chartSrc = { ...SRC, question_results: [...SRC.question_results, { question_id: 5, type: 'multiple_choice', score: 0, chart: { title: 'x' } }] };
  let m = E.mistakeStates([chartSrc], { now: T0 + 0.5 * D });
  assert.deepEqual(E.mistakeReminder(m, T0, T0 + 0.5 * D), { count: 0, at: null }, 'sınavdan hemen sonra çalmaz');
  let r = E.mistakeReminder(m, T0, T0 + 1.2 * D);
  assert.deepEqual([r.count, r.at], [4, T0 + D], 'grafikli soru da sayılır (Faz 11)');
  assert.equal(E.mistakeReminder(m, T0 + 1.1 * D, T0 + 1.2 * D).at, null, 'son kontrolden sonra yeni yok');
  const r1 = retryExam('r1', 2, [1], [100]);
  m = E.mistakeStates([SRC, r1], { now: T0 + 5.5 * D });
  r = E.mistakeReminder(m, T0 + 3 * D, T0 + 5.5 * D);
  assert.deepEqual([r.count, r.at], [3, T0 + 5 * D], 'doğru denemeden 3 gün sonra');
});

test('hesap sorusu: şablonla yeni sayılar, sayılara bağlı alanlar yok', () => {
  const src = { examId: 'e1', questionId: 2, exam: {}, result: { type: 'calculation', question: '25.000 TL %4 3 yıl?', concept: 'Bileşik faiz', units: 'TL' },
    key: { template: '{P} TL %{r*100} {n} yıl?', formula: 'P*(1+r)^n', variables: { P: 25000, r: 0.04, n: 3 }, correct_answer: 28121.6, solution_steps: ['x'], explanation: 'e', common_errors: [{ formula: 'P*r*n', message: 'basit faiz' }] } };
  const q = G.retryCalcVariant(src, 'tr', seq([0.1, 0.9, 0.5]));
  const v = E.makeVariant({ template: src.key.template, formula: src.key.formula, variables: src.key.variables }, 'tr', seq([0.1, 0.9, 0.5]));
  assert.equal(q.question, v.text); assert.equal(q.correct_answer, v.answer);
  assert.notEqual(q.question, src.result.question);
  assert.equal(q.solution_steps, undefined); assert.equal(q.explanation, undefined);
  assert.deepEqual([q.concept, q.units, q.verified], ['Bileşik faiz', 'TL', true]);
  assert.equal(q.common_errors.length, 1, 'formül adlarıyla yazılmış tipik hata sayıdan bağımsız');
  assert.equal(G.retryCalcVariant({ ...src, key: { ...src.key, template: null } }, 'tr'), null);
  assert.equal(G.retryCalcVariant({ ...src, result: { ...src.result, type: 'open_ended' } }, 'tr'), null);
});

test('model sorusu: aynı tip, kaynağın kendisi değil, konu taşınır', () => {
  const src = { examId: 'e1', questionId: 1, exam: {}, key: {}, result: { type: 'true_false', question: 'Talep kanunu fiyat ile miktar arasında ters ilişki kurar.', concept: 'Talep kanunu' } };
  const good = { type: 'true_false', question: 'Fiyat düştüğünde talep edilen miktar azalır.', options: ['Doğru', 'Yanlış'], correct_answer: 'Yanlış', explanation: 'Ters ilişki.' };
  const q = G.acceptRetryQuestion(good, src, 'tr', 4);
  assert.ok(q); assert.equal(q.concept, 'Talep kanunu');
  assert.equal(G.acceptRetryQuestion({ ...good, question: src.result.question }, src, 'tr', 4), null, 'aynı soru');
  assert.equal(G.acceptRetryQuestion({ ...good, type: 'multiple_choice' }, src, 'tr', 4), null, 'tip değişemez');
  // canlı test 30.10: kaynağın yeniden yazılmışı geri çevrilir
  const fb = { examId: 'e1', questionId: 3, exam: {}, key: {}, result: { type: 'fill_blank', question: 'Kısa vadeli borçların toplamı, şirketin dönen varlıkları içinde ________ olarak sınıflandırılır.', correct_answer: 'kısa vadeli yükümlülük', concept: 'Kısa vadeli borçlar' } };
  const reworded = { type: 'fill_blank', question: 'Şirketin kısa vadeli borçları, dönen varlıkların içinde ________ kısmına dahil edilir.', correct_answer: 'kısa vadeli yükümlülük', explanation: 'x' };
  assert.ok(G.retrySimilarity(reworded.question, fb.result.question) >= 0.5);
  assert.equal(G.acceptRetryQuestion(reworded, fb, 'tr', 4), null);
  const fresh = { type: 'fill_blank', question: 'Bir yıl içinde nakde çevrilmesi beklenen varlıklara ________ denir.', correct_answer: 'dönen varlık', explanation: 'x' };
  assert.ok(G.acceptRetryQuestion(fresh, fb, 'tr', 4));
  const p = G.retryUserPrompt([src], 'tr', 4);
  assert.match(p, /QUESTION COUNT: 1/); assert.match(p, /GRAPH QUESTIONS: not allowed/); assert.match(p, /CONCEPT: Talep kanunu/);
  assert.doesNotMatch(p, /EXPRESSION QUESTIONS/);
  assert.deepEqual(G.RETRY_TYPES.slice().sort(), ['calculation', 'expression', 'fill_blank', 'graph', 'multiple_choice', 'open_ended', 'true_false']);
  assert.equal(G.RETRY_MAX_ITEMS, 10);
});

// ---------------------------------------------------------------------------
// Faz 11: grafik ve çizim
// ---------------------------------------------------------------------------
const CHART = { title: 'Yıllara göre ihracat', type: 'line', labels: ['2020', '2021', '2022', '2023'], series: [{ name: 'İhracat', data: [120, 150, 135, 180] }], unit: 'milyar $', x_title: 'Yıl' };

test('grafik sorusunun biçimi kökten, şıklardan ve tipten çıkar', () => {
  const F = (r) => { const x = G2.retryChartFormat(r); return [x.format, x.options_count]; };
  assert.deepEqual(F({ type: 'multiple_choice', question: 'Grafiğe göre aşağıdakilerden hangisi söylenebilir?', options: ['a', 'b', 'c', 'd'] }), ['which_true', 4]);
  assert.deepEqual(F({ type: 'multiple_choice', question: 'Grafiğe göre aşağıdakilerden hangisi söylenemez?', options: ['a', 'b', 'c', 'd', 'e'] }), ['which_false', 5]);
  assert.deepEqual(F({ type: 'multiple_choice', question: 'Hangileri doğrudur?\n\nI. x\nII. y\nIII. z', options: ['Yalnız I', 'I ve II', 'II ve III', 'I, II ve III'] }), ['premises', 4]);
  assert.deepEqual(F({ type: 'multiple_choice', question: 'Ortalama kaçtır?', options: ['%12,5', '15', '17,5', '20'] }), ['value', 4]);
  assert.deepEqual(['true_false', 'fill_blank', 'open_ended', 'calculation'].map(t => F({ type: t, question: 'q' })[0]), ['true_false', 'fill', 'open', 'value']);
});

test('grafik okuma: sayıları değişmiş grafikle aynı tip ve biçimde yeni soru (model yok)', () => {
  const rand = G2.seededRandom('retry-chart');
  const forms = [['which_true', 4], ['which_false', 4], ['premises', 4], ['true_false'], ['fill'], ['open'], ['value'], ['value', 4]];
  for (const [format, oc] of forms) {
    const chart = G2.normalizeChartSpec(CHART);
    const srcQ = G2.buildChartQuestion({ stem: '', format, skills: [], options_count: oc }, { ...chart, x_title: 'Yıl' }, 'tr', rand, 4);
    assert.ok(srcQ, format);
    const src = { examId: 'e1', questionId: 1, exam: {}, key: { source: { page: 3, unit: 'page' } }, result: { ...srcQ, concept: 'İhracat yorumu' } };
    const q = G2.retryChartVariant(src, 'tr', 4, rand);
    assert.ok(q, format);
    assert.equal(q.type, srcQ.type, format + ': tip aynı');
    assert.notDeepEqual(q.chart.series[0].data, CHART.series[0].data, format + ': sayılar değişti');
    assert.deepEqual(q.chart.labels, CHART.labels);
    assert.deepEqual([q.chart.x_title, q.concept, q.source.page], ['Yıl', 'İhracat yorumu', 3]);
    if (format === 'premises') assert.ok(Array.isArray(q.premises));
    if (format === 'value' && oc) assert.equal(q.options.length, 4);
  }
  assert.equal(G2.retryChartVariant({ examId: 'e1', questionId: 1, exam: {}, key: {}, result: { type: 'multiple_choice', question: 'x', chart: { labels: ['a'] } } }, 'tr', 4), null, 'bozuk grafik');
});

const MARKET = { type: 'graph', question: 'Talep P = 12 − 2Q, arz P = 3 + Q. Doğruları çizip dengeyi E ile işaretleyiniz.', concept: 'Piyasa dengesi',
  graph: { x: { min: 0, max: 8, step: 1, label: 'Miktar (Q)' }, y: { min: 0, max: 14, step: 1, label: 'Fiyat (P)' } },
  graph_answer: [{ kind: 'line', equation: 'y = 12 - 2*x', label: 'D' }, { kind: 'line', equation: 'y = 3 + x', label: 'S' }, { kind: 'point', at: { intersect: ['a0', 'a1'] }, label: 'E' }] };

test('çizim sorusu: yeni denklemler kabul, kaynağın denklemleri kopya; kök benzerliği aranmaz', () => {
  const srcQ = JSON.parse(JSON.stringify(MARKET));
  assert.equal(G2.verifyGraph(srcQ, 'tr').ok, true);
  const src = { examId: 'e1', questionId: 2, exam: {}, key: { graph_answer: srcQ.graph_answer }, result: { type: 'graph', question: MARKET.question, concept: 'Piyasa dengesi', graph: srcQ.graph } };
  const fresh = { ...JSON.parse(JSON.stringify(MARKET)), question: 'Talep P = 10 − Q, arz P = 2 + Q. Doğruları çizip dengeyi E ile işaretleyiniz.', concept: null,
    graph_answer: [{ kind: 'line', equation: 'y = 10 - x', label: 'D' }, { kind: 'line', equation: 'y = 2 + x', label: 'S' }, { kind: 'point', at: { intersect: ['a0', 'a1'] }, label: 'E' }] };
  assert.ok(G2.retrySimilarity(fresh.question, MARKET.question) >= 0.5, 'kök çok benzer');
  const q = G2.acceptRetryQuestion(fresh, src, 'tr', 4);
  assert.ok(q, 'yeni denklemli çizim sorusu kabul');
  assert.equal(q.concept, 'Piyasa dengesi');
  assert.equal(G2.acceptRetryQuestion(JSON.parse(JSON.stringify(MARKET)), src, 'tr', 4), null, 'aynı denklemler kopya');
  const p = G2.retryUserPrompt([src], 'tr', 4);
  assert.match(p, /GRAPH QUESTIONS: allowed only to replace/);
  assert.match(p, /GRID: \{/);
});

test('ifade sorusu: farklı ifade kabul, aynı cevap kopya', () => {
  const base = { type: 'expression', question: 'x^2 - 1 ifadesini çarpanlarına ayırınız.', correct_answer: '(x-1)*(x+1)', expr_vars: ['x'], form: 'factored', given: 'x^2-1', up_to_constant: false, solution_steps: ['İki kare farkı'] };
  const src = { examId: 'e1', questionId: 3, exam: {}, key: { correct_answer: '(x-1)*(x+1)' }, result: { type: 'expression', question: base.question, correct_answer: '(x-1)*(x+1)', concept: 'Çarpanlara ayırma' } };
  assert.ok(G2.acceptRetryQuestion({ ...base, question: 'x^2 - 9 ifadesini çarpanlarına ayırınız.', correct_answer: '(x-3)*(x+3)', given: 'x^2-9' }, src, 'tr', 4));
  assert.equal(G2.acceptRetryQuestion({ ...base, question: 'x kare eksi 1 ifadesini çarpanlarına ayırın.' }, src, 'tr', 4), null);
  assert.match(G2.retryUserPrompt([src], 'tr', 4), /EXPRESSION QUESTIONS: allowed only to replace/);
});

test('ekran ve sunucu kancaları', () => {
  const ink = readSource('js/acadex-ink.js'), gen = readSource(GEN);
  assert.match(ink, /if \(isRetry\) return;/, 'ikinci şans sınavı ayrı yanlış değil');
  assert.match(ink, /calculation: 1, graph: 1, expression: 1 \};/, 'Faz 11: grafik, çizim ve ifade de ikinci şansa girer');
  assert.doesNotMatch(ink, /RETRY_OK\[r\.type\] && !r\.chart|RETRY_OK\[r\.type\] \|\| r\.chart/);
  assert.match(ink, /JSON\.stringify\(\{ retry: \{ items: items \} \}\)/);
  assert.match(gen, /reqBody\.retry && typeof reqBody\.retry === 'object'\) return await handleExamRetry/);
  assert.match(gen, /retry: pairs\.map\(p => \(\{ exam_id: p\.s\.examId, question_id: p\.s\.questionId/);
  assert.match(gen, /is_simulation: false, time_limit_seconds: null/);
});

summary();
