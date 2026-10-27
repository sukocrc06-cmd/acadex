/* ==========================================================================
   ACADEX — ADIM ADIM KONTROL VE ŞIK TEKRARI TESTLERİ (tests/exam-steps.js)

   Faz 3c (23.10.2026):
     - generate-exam: aynı cevabı gösteren şıklar (5.368 / 5.368,5, %8 /
       0.08) atılır; ardışık tam sayılar (1990 / 1991) atılmaz
     - generate-exam: step_kind (linear / npv / interest); doğrusal denklem
       kodla çözülür, formülle tutmazsa yalnızca adım türü düşer
     - grade-exam: sonuçta steps verisi
     - exam-engine: satır satır kontrol (doğrusal denklem, NBD, faiz)

   Çalıştırma:  node tests/exam-steps.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const GEN_PATH = 'supabase/functions/generate-exam/index.ts';
const GRADE_PATH = 'supabase/functions/grade-exam/index.ts';
const EXPR = ['EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression', 'sanitizeVariables', 'MATH_INPUT_MAX', 'normalizeMathInput'];

const G = loadFromSource(GEN_PATH, [
  ...EXPR, 'TRUE_FALSE_OPTIONS', 'normalizeAnswerText', 'parseLooseNumber', 'answerNumber', 'PLACEHOLDER_ANSWERS', 'isPlaceholderAnswer', 'cleanText',
  'EXPLANATION_MAX_CHARS', 'RATIONALE_MAX_CHARS', 'RUBRIC_MIN_ITEMS', 'RUBRIC_MAX_ITEMS', 'normalizeOptionRationales', 'normalizeRubric',
  'numberReadings', 'sameNumber', 'withinTolerance', 'templateMatches', 'normalizeFormula', 'DERIVED_FACTORS', 'TEMPLATE_DISPLAY_OPS',
  'STEP_KINDS', 'verifyLinearEquation', 'verifyCalculation', 'OPTION_NEAR_PERCENT', 'NUMERIC_OPTION', 'optionCanonical', 'hasAmbiguousOptions',
  'EXPR_SAMPLE_VALUES', 'EXPR_MIN_VALID_POINTS', 'EXPR_FORMS', 'exprSamplePoints', 'expressionsEquivalent', 'hasTopLevelSum', 'isExpandedForm',
  'exprTokenCount', 'checkExpressionForm', 'verifyExpression', 'repairLatex', 'validateQuestion', 'STANDARD_CONSTANTS', 'referencesName', 'inlineName', 'chartNumbers']);
const R = loadFromSource(GRADE_PATH, ['teachingFields']);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

const { test, summary } = makeRunner();

// ---------------------------------------------------------------------------
// Şık tekrarı
// ---------------------------------------------------------------------------
test('ayni cevabi gosteren sayisal siklar yakalanir', () => {
  assert.equal(G.hasAmbiguousOptions(['5.368,00', '5.400', '5.368,5', '5.368', '5.500']), true, 'canlida gorulen soru');
  assert.equal(G.hasAmbiguousOptions(['5.368', '5.368,5', '4.200', '6.100']), true, 'yuzde 0,5 icinde kesirli');
  assert.equal(G.hasAmbiguousOptions(['10', '10,0', '12', '14']), true);
  assert.equal(G.hasAmbiguousOptions(['%8', '0.08', '%12', '%20']), true, 'yuzde ile kesir ayni');
  assert.equal(G.hasAmbiguousOptions(['=XNPV(0.08,{-5000,2000})', '=XNPV(8%,{-5000,2000})', '=NPV(0.08,1)', '=SUM(1)']), true);
});

test('farkli siklar ayri kalir', () => {
  assert.equal(G.hasAmbiguousOptions(['1990', '1991', '1992', '1993']), false, 'ardisik tam sayilar');
  assert.equal(G.hasAmbiguousOptions(['5.368 TL', '5.400 TL', '4.200 TL', '6.100 TL']), false);
  assert.equal(G.hasAmbiguousOptions(['12,5', '12,6', '13', '14']), false);
  assert.equal(G.hasAmbiguousOptions(['0', '100', '200', '300', '400']), false);
  assert.equal(G.hasAmbiguousOptions(['x = 4', 'x = -4', 'x = 2', 'x = 8']), false, 'isaret farki');
  assert.equal(G.hasAmbiguousOptions(['Tam eşleşme', 'Yaklaşık eşleşme', 'En büyük değer', 'En küçük değer']), false);
  assert.equal(G.hasAmbiguousOptions(['B4:F4', 'B4:C4', 'B4:D4', 'B4:E4']), false);
  assert.equal(G.hasAmbiguousOptions(['a1', 'b1', 'c1', 'd1']), false, 'sayi disindaki kisim farkli');
  assert.equal(G.hasAmbiguousOptions(['5.368 TL', '5.368,5 TL', '4.200 TL', '6.100 TL']), true, 'ayni birim, yakin sayi');
});

test('validateQuestion: belirsiz sikli soru mc_ambiguous_options ile atilir', () => {
  const r = G.validateQuestion({ type: 'multiple_choice', question: 'Aylık taksit yaklaşık kaç TL?', options: ['5.368,00', '5.400', '5.368,5', '5.500'], correct_answer: '5.368,00' }, ['multiple_choice'], 'tr', 4);
  assert.equal(r.reason, 'mc_ambiguous_options');
  const ok = G.validateQuestion({ type: 'multiple_choice', question: 'Aylık taksit yaklaşık kaç TL?', options: ['5.368', '5.900', '4.200', '6.100'], correct_answer: 'A' }, ['multiple_choice'], 'tr', 4);
  assert.equal(ok.ok, true);
});

// ---------------------------------------------------------------------------
// Üretim: step_kind
// ---------------------------------------------------------------------------
const linQ = (extra = {}) => ({
  type: 'calculation', question: '3x + 5 = 2x - 7 denklemini çözünüz. x kaçtır?', correct_answer: -12,
  variables: { a: 3, b: 5, c: 2, d: 7 }, formula: '(-d - b)/(a - c)',
  template: '{a}x + {b} = {c}x - {d} denklemini çözünüz. x kaçtır?',
  step_kind: 'linear', equation: 'a*x + b = c*x - d', unknown: 'x', ...extra
});

test('dogrusal denklem: kodla cozulur, formulle tutar, acik bicimde saklanir', () => {
  const q = linQ();
  assert.deepEqual(G.verifyCalculation(q), { ok: true });
  assert.equal(q.step_kind, 'linear');
  assert.equal(q.equation, 'a*x+b=c*x-d');
  assert.equal(q.unknown, 'x');
  assert.ok(q.template, 'sablon korunur');
});

test('dogrusal denklem tutmazsa yalnizca adim turu duser, soru kalir', () => {
  for (const extra of [{ equation: 'a*x + b = c*x + d' }, { equation: 'a*x^2 = d' }, { unknown: 'a' }, { unknown: 'xy' }, { equation: 'a*x=b=c' }, { equation: null }]) {
    const q = linQ(extra);
    assert.equal(G.verifyCalculation(q).ok, true, JSON.stringify(extra));
    assert.equal(q.step_kind, null, JSON.stringify(extra));
    assert.equal(q.equation, null);
  }
});

test('npv / interest korunur, gecersiz tur null; negatif sabit sablonda isaret carpaniyla', () => {
  const q = linQ({ step_kind: 'npv', equation: 'x' });
  G.verifyCalculation(q);
  assert.deepEqual([q.step_kind, q.equation, q.unknown], ['npv', null, null]);
  const q2 = linQ({ step_kind: 'grafik' });
  G.verifyCalculation(q2);
  assert.equal(q2.step_kind, null);
  const q3 = linQ({ variables: { a: 3, b: 5, c: 2, d: -7 }, formula: '(d - b)/(a - c)', equation: 'a*x+b=c*x+d' });
  assert.equal(G.verifyCalculation(q3).ok, true);
  assert.equal(q3.step_kind, 'linear');
  assert.equal(q3.template, '{a}x + {b} = {c}x - {d*-1} denklemini çözünüz. x kaçtır?', '-7 metinde "- 7": sablonda isaret carpani');
  assert.equal(E.renderTemplate(q3.template, { a: 4, b: 6, c: 1, d: -9 }, 'tr'), '4x + 6 = 1x - 9 denklemini çözünüz. x kaçtır?');
});

test('grade-exam: dogrulanmis ve adim turlu soruda steps verisi gider', () => {
  const q = { type: 'calculation', verified: true, formula: '(-d - b)/(a - c)', variables: { a: 3, b: 5, c: 2, d: 7 }, template: 't {a}', tolerance_percent: 1, units: '',
    step_kind: 'linear', equation: 'a*x+b=c*x-d', unknown: 'x', common_errors: [{ formula: '(d - b)/(a - c)', message: 'işaret' }] };
  const t = R.teachingFields(q);
  assert.equal(t.steps.kind, 'linear');
  assert.equal(t.steps.equation, 'a*x+b=c*x-d');
  assert.equal(t.steps.common_errors.length, 1);
  assert.ok(t.practice, 'pratik verisi de durur');
  assert.equal(R.teachingFields({ ...q, step_kind: null }).steps, undefined);
  assert.equal(R.teachingFields({ ...q, verified: false }).steps, undefined);
  assert.equal(R.teachingFields({ ...q, equation: null }).steps, undefined, 'denklemsiz linear gonderilmez');
  assert.equal(R.teachingFields({ ...q, step_kind: 'npv', equation: null }).steps.equation, null);
});

// ---------------------------------------------------------------------------
// Tarayıcı: doğrusal denklem
// ---------------------------------------------------------------------------
const LIN = { kind: 'linear', equation: 'a*x+b=c*x-d', unknown: 'x', variables: { a: 3, b: 5, c: 2, d: 7 } };
const codes = r => r.lines.map(l => l.code);

test('dogrusal: dogru cozum, ilk hata, tasinan hata, bitmemis', () => {
  const ok = E.checkSteps('3x + 5 = 2x - 7\n3x - 2x = -7 - 5\nx = -12', LIN, null, 'tr');
  assert.equal(ok.status, 'solved');
  assert.deepEqual(codes(ok), ['ok', 'ok', 'final']);
  const bad = E.checkSteps('1) 3x + 5 = 2x - 7\n2) 3x - 2x = -7 + 5\n3) x = -2', LIN, null, 'tr');
  assert.equal(bad.status, 'error');
  assert.equal(bad.first_error, 1);
  assert.deepEqual(codes(bad), ['ok', 'wrong', 'carried']);
  assert.ok(!/-12/.test(bad.lines[1].message), 'dogru cevap soylenmez');
  const un = E.checkSteps('3x - 2x = -12', LIN, null, 'tr');
  assert.equal(un.status, 'unfinished');
  assert.equal(E.checkSteps('-12 = x', LIN, null, 'tr').status, 'solved', 'x sagda da olabilir');
});

test('dogrusal: dogrusal degil, x kayboldu, okunamaz, bos, esitsiz', () => {
  assert.equal(E.checkSteps('3x^2 = 5', LIN, null, 'tr').lines[0].code, 'nonlinear');
  assert.equal(E.checkSteps('3x - 3x = 5', LIN, null, 'tr').lines[0].code, 'lost');
  assert.equal(E.checkSteps('3x = ?', LIN, null, 'tr').lines[0].code, 'unreadable');
  assert.equal(E.checkSteps('3x + 5', LIN, null, 'tr').lines[0].code, 'no_equals');
  assert.equal(E.checkSteps('  \n ', LIN, null, 'tr').status, 'empty');
});

test('dogrusal: farkli sayilarla varyant kendi cozumuyle kontrol edilir', () => {
  const vars = { a: 4, b: 6, c: 1, d: 3 };
  assert.equal(E.solveLinearEquation(LIN, vars), -3);
  assert.equal(E.checkSteps('4x + 6 = x - 3\n3x = -9\nx = -3', LIN, vars, 'tr').status, 'solved');
  assert.equal(E.checkSteps('x = -12', LIN, vars, 'tr').status, 'error', 'asil sorunun cevabi varyantta yanlis');
  assert.equal(E.checkSteps('x = 1', { ...LIN, equation: 'a*x=a*x+1' }, null, 'tr'), null, 'cozumsuz denklem kontrol edilmez');
});

// ---------------------------------------------------------------------------
// Tarayıcı: NBD ve faiz
// ---------------------------------------------------------------------------
const NPV = { kind: 'npv', formula: 'CF1/(1+k)+CF2/(1+k)^2-I0', variables: { CF1: 500, CF2: 600, k: 0.1, I0: 900 }, tolerance_percent: 1,
  common_errors: [{ formula: 'CF1+CF2-I0', message: 'İskonto etmeyi unuttun.' }] };

test('NBD: dogru adimlar, Turkce sayilar, etiketler', () => {
  const r = E.checkSteps('PV1 = 500/1,1 = 454,55\nPV2 = 600/1,1^2 = 495,87\nNBD = 454,55 + 495,87 - 900 = 50,42', NPV, null, 'tr');
  assert.equal(r.status, 'solved');
  assert.deepEqual(codes(r), ['on_track', 'on_track', 'on_track']);
});

test('NBD: islem hatasi satiri ve beklenen deger; tasinan hata', () => {
  const r = E.checkSteps('500/1,1 = 450\n600/1,21 = 495,87\n450 + 495,87 - 900 = 45,87', NPV, null, 'tr');
  assert.equal(r.status, 'error');
  assert.equal(r.first_error, 0);
  assert.equal(r.lines[0].code, 'arith');
  assert.ok(Math.abs(r.lines[0].expected - 454.5454) < 0.01);
  assert.equal(r.lines[2].code, 'ok', 'kendi icinde dogru islem');
});

test('NBD: islemler dogru ama yontem yanlis → tipik hata mesaji', () => {
  const r = E.checkSteps('500 + 600 - 900 = 200', NPV, null, 'tr');
  assert.equal(r.status, 'method');
  assert.match(r.message, /İskonto etmeyi unuttun/);
});

test('faiz: yuvarlanmis girdiyle us alinca olusan fark islem hatasi sayilmaz; 1.000.000 okunur', () => {
  const LOAN = { kind: 'interest', formula: 'P * (r/100/12) / (1 - (1 + r/100/12)^(-n))', variables: { P: 1000000, r: 5, n: 360 }, tolerance_percent: 1 };
  const r = E.checkSteps('i = 5/100/12 = 0,004167\n(1+0,004167)^360 = 4,4677\n1.000.000 * 0,004167 / (1 - 1/4,4677) = 5368,6', LOAN, null, 'tr');
  assert.equal(r.status, 'solved', JSON.stringify(r.lines));
  const w = E.checkSteps('(1+0,004167)^360 = 4,9', LOAN, null, 'tr');
  assert.equal(w.lines[0].code, 'arith');
});

test('subValues: formulun ara sonuclari; stepLines basliklari atar', () => {
  const v = E.subValues('CF1/(1+k)+CF2/(1+k)^2-I0', NPV.variables);
  assert.ok(v.some(x => Math.abs(x - 454.5454) < 0.001));
  assert.ok(v.some(x => Math.abs(x - 495.8677) < 0.001));
  assert.deepEqual(E.stepLines('Adım 1: x = 2\n2) 3x = 6\n• y = 1\n⇒ z = 3\n\n'), ['x = 2', '3x = 6', 'y = 1', 'z = 3']);
  assert.equal(E.stepLines('a=1\n'.repeat(30)).length, 20, 'en fazla 20 satir');
});

summary();
