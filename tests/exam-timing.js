/* ==========================================================================
   ACADEX — SÜRE VE STRATEJİ RAPORU TESTLERİ (tests/exam-timing.js)

   Faz 9 (30.10.2026), UWorld / Blueprint / BoardVitals'teki performans
   raporlarının karşılığı:
     - grade-exam applyTiming: soru başına süre, ziyaret; şık değiştirmede
       ilk seçim ile son cevaba göre sınıf (doğrudan yanlışa …)
     - exam-engine timingReport: tempo (provada hedefle), aceleyle yanlış,
       takılma, cevap değiştirme önerileri; eski sınavda (süre yok) null
     - ekran: süre sekme gizliyken sayılmaz, teslimde gönderilir

   Çalıştırma:  node tests/exam-timing.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFromSource, readSource, makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const R = loadFromSource('supabase/functions/grade-exam/index.ts', ['normalizeAnswerText', 'gradeChoice', 'TIMING_MAX_MS', 'applyTiming']);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

test('applyTiming: süre, ziyaret ve şık değiştirme sınıfı', () => {
  const rs = [
    { question_id: 1, type: 'multiple_choice', correct_answer: 'A', student_answer: 'B', is_correct: false, score: 0 },
    { question_id: 2, type: 'multiple_choice', correct_answer: 'A', student_answer: 'A', is_correct: true, score: 100 },
    { question_id: 3, type: 'true_false', correct_answer: 'Doğru', student_answer: 'Yanlış', is_correct: false, score: 0 },
    { question_id: 4, type: 'open_ended', student_answer: 'x', score: 40 },
    { question_id: 5, type: 'multiple_choice', correct_answer: 'A', student_answer: 'A', is_correct: true, score: 100 }
  ];
  R.applyTiming(rs, { 1: { ms: 42000.4, v: 2, p: ['A', 'B'] }, 2: { ms: 9000, v: 1, p: ['C', 'A'] }, 3: { ms: 5000, v: 1, p: ['Yanlış', 'Doğru', 'Yanlış'] }, 4: { ms: 'x', v: -1, p: ['a', 'b'] }, 5: { ms: 1e12, v: 1, p: ['A'] } });
  assert.deepEqual(rs.map(r => r.answer_change), ['right_to_wrong', 'wrong_to_right', 'wrong_to_wrong', undefined, undefined]);
  assert.deepEqual([rs[0].time_ms, rs[0].visits, rs[3].time_ms, rs[3].visits], [42000, 2, undefined, undefined]);
  assert.equal(rs[4].time_ms, R.TIMING_MAX_MS, 'uç değer kırpılır');
  const same = [{ question_id: 1, score: 50 }];
  R.applyTiming(same, null); R.applyTiming(same, [1, 2]); R.applyTiming(same, { 9: { ms: 5 } });
  assert.deepEqual(same, [{ question_id: 1, score: 50 }], 'bozuk veri dokunmaz');
});

const ex = (rs, extra) => Object.assign({ question_results: rs, question_count: rs.length }, extra || {});
const row = (id, sec, score, more) => Object.assign({ question_id: id, type: 'multiple_choice', time_ms: sec * 1000, score, student_answer: 'x' }, more || {});

test('timingReport: tempo, aceleyle yanlış, takılma', () => {
  const rs = [row(1, 3, 0), row(2, 4, 0), row(3, 60, 100), row(4, 70, 100), row(5, 200, 0), row(6, 65, 100)];
  const T = E.timingReport(ex(rs, { is_simulation: true, time_limit_seconds: 300 }));
  assert.deepEqual([T.avgSec, T.medianSec, T.targetSec, T.totalSec], [67, 63, 50, 402]);
  assert.deepEqual(T.rushed, [1, 2]);
  assert.deepEqual(T.stuck, [5]);
  assert.deepEqual(T.slowest.map(s => s.id), [5, 4, 6]);
  assert.deepEqual([T.avgCorrectSec, T.avgWrongSec], [65, 69]);
  assert.deepEqual(T.tips.map(t => t.k), ['pace', 'rush', 'stuck']);
});

test('timingReport: cevap değiştirme önerisi ve boş soru aceleye sayılmaz', () => {
  const rs = [row(1, 30, 0, { answer_change: 'right_to_wrong' }), row(2, 30, 0, { answer_change: 'right_to_wrong' }), row(3, 30, 100, { answer_change: 'wrong_to_right' }), row(4, 2, 0, { student_answer: '' })];
  const T = E.timingReport(ex(rs));
  assert.deepEqual([T.changes.right_to_wrong, T.changes.wrong_to_right, T.blank, T.targetSec], [2, 1, 1, null]);
  assert.deepEqual(T.rushed, []);
  assert.deepEqual(T.tips.map(t => t.k), ['change']);
  const good = E.timingReport(ex([row(1, 30, 100, { answer_change: 'wrong_to_right' }), row(2, 32, 100)]));
  assert.deepEqual(good.tips.map(t => t.k), ['change-good']);
  const even = E.timingReport(ex([row(1, 30, 0, { answer_change: 'right_to_wrong' }), row(2, 30, 100, { answer_change: 'wrong_to_right' })]));
  assert.deepEqual(even.tips.map(t => t.k), [], 'başabaşta öneri yok (tarayıcı denemesinde "işine yaradı" deniyordu)');
});

test('timingReport: süresi kayıtlı olmayan eski sınav için rapor yok', () => {
  assert.equal(E.timingReport(ex([{ question_id: 1, score: 100 }, { question_id: 2, score: 0 }, row(3, 10, 100)])), null);
  assert.equal(E.timingReport(ex([])), null);
  assert.equal(E.timingReport(null), null);
});

test('ekran ve teslim kancaları', () => {
  const ink = readSource('js/acadex-ink.js'), dash = readSource('js/dashboard.js'), grade = readSource('supabase/functions/grade-exam/index.ts');
  assert.match(ink, /document\.addEventListener\('visibilitychange', function \(\) \{ if \(!TIM \|\| TIM\.cur == null\) return; if \(document\.hidden\) \{ timFlush\(\); TIM\.at = 0;/, 'gizli sekmede süre işlemez');
  assert.match(ink, /timPick\(r\.name\.slice\(9\), r\.value\)/);
  assert.match(dash, /timing: typeof window\.__examTiming === 'function' \? window\.__examTiming\(currentActiveExam\.id\) : null/);
  assert.match(grade, /const \{ examId, answers, flags, timing \} = await req\.json\(\)/);
  assert.match(grade, /applyHelp\(results, questions\)\n\s+applyTiming\(results, timing\)/);
});

summary();
