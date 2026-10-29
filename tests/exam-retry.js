/* ==========================================================================
   ACADEX — HATA DEFTERİ: İKİNCİ ŞANS TESTLERİ (tests/exam-retry.js)

   Faz 8 (30.10.2026):
     - exam-engine mistakeStates: yanlış (50 altı) → takvim (hiç denenmediyse
       hemen, yanlışsa 1 gün, doğruysa 3 gün), art arda iki doğru (80+) →
       kazanıldı; ikinci şans sınavının kendi sonuçları yeni yanlış olmaz
     - generate-exam { retry }: şablonlu hesap sorusu yeni sayılarla (model
       yok); ötekilerde model sorusu aynı tipte olmalı, kaynağın kendisi olamaz
     - ekran: defter ikinci şans sınavlarını ayrı yanlış saymaz

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
  'repairLatex', 'unverifiedAnswerConsistent', 'validateQuestion', 'shuffleInPlace',
  'OPTION_NEAR_PERCENT', 'NUMERIC_OPTION', 'optionCanonical', 'hasAmbiguousOptions', 'MATH_INPUT_MAX', 'normalizeMathInput', 'STEP_KINDS', 'verifyLinearEquation', 'EXPR_SAMPLE_VALUES', 'EXPR_MIN_VALID_POINTS', 'EXPR_FORMS', 'exprSamplePoints', 'expressionsEquivalent', 'hasTopLevelSum', 'isExpandedForm', 'exprTokenCount', 'checkExpressionForm', 'verifyExpression', 'STANDARD_CONSTANTS', 'referencesName', 'inlineName', 'chartNumbers',
  'TEMPLATE_PH', 'formatNumber', 'templateMultipliers', 'tidy', 'renderTemplate', 'decimalsOf', 'significantDigits', 'makeVariant',
  'RETRY_MAX_ITEMS', 'RETRY_TYPES', 'retryCalcVariant', 'retryUserPrompt', 'acceptRetryQuestion']);
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
  const p = G.retryUserPrompt([src], 'tr', 4);
  assert.match(p, /QUESTION COUNT: 1/); assert.match(p, /GRAPH QUESTIONS: not allowed/); assert.match(p, /CONCEPT: Talep kanunu/);
  assert.deepEqual(G.RETRY_TYPES.sort(), ['calculation', 'fill_blank', 'multiple_choice', 'open_ended', 'true_false']);
  assert.equal(G.RETRY_MAX_ITEMS, 10);
});

test('ekran ve sunucu kancaları', () => {
  const ink = readSource('js/acadex-ink.js'), gen = readSource(GEN);
  assert.match(ink, /if \(isRetry\) return;/, 'ikinci şans sınavı ayrı yanlış değil');
  assert.match(ink, /JSON\.stringify\(\{ retry: \{ items: items \} \}\)/);
  assert.match(gen, /reqBody\.retry && typeof reqBody\.retry === 'object'\) return await handleExamRetry/);
  assert.match(gen, /retry: pairs\.map\(p => \(\{ exam_id: p\.s\.examId, question_id: p\.s\.questionId/);
  assert.match(gen, /is_simulation: false, time_limit_seconds: null/);
});

summary();
