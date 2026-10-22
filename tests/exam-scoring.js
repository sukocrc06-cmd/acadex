/* ==========================================================================
   ACADEX — ŞIK SAYISI VE NET HESABI TESTLERİ (tests/exam-scoring.js)

   Faz 2c (22.10.2026): 4/5 şık ve "yanlış doğruyu götürür". Groq'a ve
   Supabase'e çıkmadan test eder:
     - generate-exam: ayarın doğrulanması, şık sayısına göre soru doğrulama
     - grade-exam / exam-appeal: net özeti ve not; ayar kapalıyken notun
       eskisiyle birebir aynı kalması; itirazdan sonra cezanın korunması

   Çalıştırma:  node tests/exam-scoring.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const GEN_PATH = 'supabase/functions/generate-exam/index.ts';
const GRADE_PATH = 'supabase/functions/grade-exam/index.ts';
const APPEAL_PATH = 'supabase/functions/exam-appeal/index.ts';

const G = loadFromSource(GEN_PATH, [
  'TRUE_FALSE_OPTIONS', 'ALLOWED_OPTION_COUNTS', 'ALLOWED_WRONG_PER_CORRECT', 'normalizeScoring',
  'EXPLANATION_MAX_CHARS', 'RATIONALE_MAX_CHARS', 'RUBRIC_MIN_ITEMS', 'RUBRIC_MAX_ITEMS',
  'normalizeAnswerText', 'parseLooseNumber', 'PLACEHOLDER_ANSWERS', 'isPlaceholderAnswer', 'cleanText',
  'normalizeOptionRationales', 'normalizeRubric', 'validateQuestion', 'STATIC_EXAM_INSTRUCTIONS'
]);
const R = loadFromSource(GRADE_PATH, ['computeFinalGrade', 'computeNetSummary', 'computeExamGrade']);

const { test, summary } = makeRunner();

const toJs = p => require('typescript').transpileModule(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'), {
  compilerOptions: { target: 99, module: 99 }
}).outputText;

test('computeNetSummary ve computeExamGrade grade-exam ve exam-appeal da birebir ayni', () => {
  const g = toJs(GRADE_PATH), a = toJs(APPEAL_PATH);
  for (const n of ['computeNetSummary', 'computeExamGrade']) assert.equal(sliceDeclaration(a, n), sliceDeclaration(g, n), n);
});

// ---------------------------------------------------------------------------
// Ayar
// ---------------------------------------------------------------------------
test('normalizeScoring: varsayilan 4 sik, ceza kapali', () => {
  assert.deepEqual(G.normalizeScoring(undefined, undefined), { option_count: 4, negative_marking: false, wrong_per_correct: 3 });
  assert.deepEqual(G.normalizeScoring('7', 'evet'), { option_count: 4, negative_marking: false, wrong_per_correct: 3 });
  assert.deepEqual(G.normalizeScoring(4, 0), { option_count: 4, negative_marking: false, wrong_per_correct: 3 });
});

test('normalizeScoring: ceza acik; oran secilir ya da sik sayisindan gelir', () => {
  assert.deepEqual(G.normalizeScoring(5, true), { option_count: 5, negative_marking: true, wrong_per_correct: 4 });
  assert.deepEqual(G.normalizeScoring(4, true), { option_count: 4, negative_marking: true, wrong_per_correct: 3 });
  assert.deepEqual(G.normalizeScoring(5, 3), { option_count: 5, negative_marking: true, wrong_per_correct: 3 });
  assert.deepEqual(G.normalizeScoring('4', '4'), { option_count: 4, negative_marking: true, wrong_per_correct: 4 });
  assert.deepEqual(G.normalizeScoring(5, 7), { option_count: 5, negative_marking: false, wrong_per_correct: 4 }, 'gecersiz oran cezayi acmaz');
});

test('sistem mesaji artik "tam 4 sik" demiyor, sik sayisini kullanici mesajina birakiyor', () => {
  assert.ok(!/exactly 4 options/.test(G.STATIC_EXAM_INSTRUCTIONS));
  assert.match(G.STATIC_EXAM_INSTRUCTIONS, /OPTION COUNT/);
});

const mc = (options, correct) => ({ type: 'multiple_choice', question: 'Hangisi doğrudur?', options, correct_answer: correct });

test('validateQuestion: 5 sikli soru 5 istendiginde gecer, E harfi cevap olabilir', () => {
  const five = ['a1', 'b1', 'c1', 'd1', 'e1'];
  const r = G.validateQuestion(mc(five, 'E'), ['multiple_choice'], 'tr', 5);
  assert.equal(r.ok, true);
  assert.equal(r.question.correct_answer, 'e1');
  assert.equal(G.validateQuestion(mc(five, 'e1'), ['multiple_choice'], 'tr', 4).reason, 'mc_option_count');
  assert.equal(G.validateQuestion(mc(five.slice(0, 4), 'a1'), ['multiple_choice'], 'tr', 5).reason, 'mc_option_count');
  assert.equal(G.validateQuestion(mc(five.slice(0, 4), 'E'), ['multiple_choice'], 'tr', 4).reason, 'mc_answer_not_in_options', '4 siklida E harfi yok');
  assert.equal(G.validateQuestion(mc(five.slice(0, 4), 'D'), ['multiple_choice'], 'tr').question.correct_answer, 'd1', 'varsayilan 4 sik');
});

// ---------------------------------------------------------------------------
// Net ve not
// ---------------------------------------------------------------------------
const MC = (ans, ok) => ({ type: 'multiple_choice', student_answer: ans, is_correct: ok, score: ok ? 100 : 0 });
const ON = k => ({ option_count: 5, negative_marking: true, wrong_per_correct: k });

test('10 coktan secmeli: 6 dogru 3 yanlis 1 bos, 3 yanlis 1 dogruyu goturur → net 5, not 50', () => {
  const rs = [...Array(6)].map(() => MC('a', true)).concat([...Array(3)].map(() => MC('b', false)), [MC('', false)]);
  assert.deepEqual(R.computeNetSummary(rs, ON(3)), { enabled: true, wrong_per_correct: 3, mc_total: 10, correct: 6, wrong: 3, blank: 1, net: 5 });
  assert.equal(R.computeExamGrade(rs, ON(3)), 50);
  assert.equal(R.computeExamGrade(rs, null), 60, 'ayar yoksa eski not');
});

test('4 yanlis 1 dogru: net kesirli, iki basamaga yuvarlanir', () => {
  const rs = [MC('a', true), MC('a', true), MC('b', false), MC('b', false), MC('b', false)];
  assert.equal(R.computeNetSummary(rs, ON(4)).net, 1.25);
  assert.equal(R.computeExamGrade(rs, ON(4)), 25);
});

test('bos birakmak goturmez', () => {
  const rs = [MC('a', true), MC('', false), MC('', false), MC('', false)];
  assert.equal(R.computeExamGrade(rs, ON(3)), R.computeFinalGrade(rs));
});

test('karisik sinav: ceza yalnizca coktan secmeli kisma; net eksiye dusse de oteki tipleri silmez', () => {
  const rs = [MC('b', false), MC('b', false), MC('b', false), MC('b', false),
    { type: 'open_ended', score: 80 }, { type: 'true_false', student_answer: 'Yanlış', is_correct: false, score: 0 }, { type: 'fill_blank', score: 100 }];
  const s = R.computeNetSummary(rs, ON(3));
  assert.equal(s.net, -1.33);
  assert.equal(R.computeExamGrade(rs, ON(3)), Math.round((80 + 0 + 100 + 0) / 7), 'MC katkisi 0 a kistirildi, D/Y cezasiz');
});

test('ayar kapali ya da coktan secmeli yoksa not computeFinalGrade ile birebir ayni', () => {
  const rs = [MC('a', true), MC('b', false), { type: 'open_ended', score: 55 }, { type: 'open_ended', score: null }];
  for (const sc of [null, undefined, {}, { negative_marking: false, wrong_per_correct: 3 }, 'bozuk']) {
    assert.equal(R.computeExamGrade(rs, sc), R.computeFinalGrade(rs), JSON.stringify(sc));
  }
  const noMc = [{ type: 'open_ended', score: 40 }, { type: 'fill_blank', score: 100 }];
  assert.equal(R.computeExamGrade(noMc, ON(4)), 70);
  assert.equal(R.computeExamGrade([{ type: 'open_ended', score: null }], ON(4)), null, 'puanlanabilen soru yoksa null (grade-exam 502 doner)');
});

test('gecersiz oran 4 e duser', () => {
  const rs = [MC('a', true), MC('b', false), MC('b', false), MC('b', false), MC('b', false)];
  assert.equal(R.computeNetSummary(rs, { negative_marking: true, wrong_per_correct: 9 }).wrong_per_correct, 4);
});

test('itiraz sonrasi not cezayi korur', () => {
  const A = loadFromSource(APPEAL_PATH, ['computeFinalGrade', 'computeNetSummary', 'computeExamGrade', 'applyAppealOutcome']);
  const rs = [MC('a', true), MC('b', false), MC('b', false), MC('b', false), { type: 'open_ended', score: 40, question_id: 5 }];
  const r = A.applyAppealOutcome(rs, 4, { regradeScore: 70, feedback: '', rubricResults: null, note: '' }, 'now', ON(3));
  assert.equal(r.grade, Math.round((70 + 0 * 100) / 5), 'net 0: MC katkisi 0');
  const r2 = A.applyAppealOutcome(rs, 4, { regradeScore: 70, feedback: '', rubricResults: null, note: '' }, 'now');
  assert.equal(r2.grade, Math.round((100 + 70) / 5), 'ayar yoksa eski hesap');
});

summary();
