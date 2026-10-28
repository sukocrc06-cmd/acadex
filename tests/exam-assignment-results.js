/* ==========================================================================
   ACADEX — ÖDEV SONUÇLARI TESTLERİ (tests/exam-assignment-results.js)

   Faz 6.4 (28.10.2026): öğretmenin sonuç ve analiz ekranı.
     - assignmentAnalysis: öğrenci durumu, en yüksek not, geç teslim; özet;
       soru analizi ilk denemeden, karışık sıra src ile (yoksa metinle) toplanır;
       ayırt edicilik ve uyarılar
     - exam-appeal öğretmen işlemleri: teacher_score (yukarı/aşağı, itirazı
       kapatır, not kesintiyle yeniden hesaplanır, gizli cevaplıda iki kopya),
       teacher_note; yetki exam_teacher_ok, öğrencinin sahiplik denetiminden ÖNCE
     - öğretmen yalnızca ödev sonuçlarını ve paylaşan öğrencinin o dersteki
       ustalığını görür (SQL davranış testi)

   Davranış testi: tests/sql/faz6-sonuclar.sql (ACADEX_PG verilirse)
   Çalıştırma:  node tests/exam-assignment-results.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { loadFromSource, readSource, makeRunner } = require('./_ts-extract.js');
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));
const AP = 'supabase/functions/exam-appeal/index.ts';
const A = loadFromSource(AP, ['APPEAL_REASON_MIN', 'APPEAL_REASON_MAX', 'REPORT_NOTE_MAX', 'REPORT_CATEGORIES', 'TEACHER_NOTE_MAX', 'validateFeedbackRequest', 'applyTeacherScore']);
const appeal = readSource(AP), ink = readSource('js/acadex-ink.js');
const { test, summary } = makeRunner();

const Q = [
  { type: 'multiple_choice', question: 'S1 talep?', options: ['a', 'b', 'c', 'd'], correct_answer: 'a' },
  { type: 'open_ended', question: 'S2 açıkla' },
  { type: 'calculation', question: 'S3 hesapla', correct_answer: 5 }
];
const ex = (id, u, att, g, mc, oe, calc, extra = {}) => Object.assign({ id, user_id: u, attempt_no: att, started_at: '2026-10-2' + att + 'T10:00:00Z', completed_at: '2026-10-2' + att + 'T11:00:00Z', grade: g,
  questions: [{ id: 1, src: 2 }, { id: 2, src: 0 }, { id: 3, src: 1 }],
  results: [{ question_id: 1, score: calc, student_answer: calc ? '5' : '' }, { question_id: 2, score: mc === 'a' ? 100 : 0, student_answer: mc }, { question_id: 3, score: oe, student_answer: oe ? 'x' : '' }] }, extra);
const mem = ids => ids.map(u => ({ user_id: u, full_name: 'Ö' + u, student_number: null, share_mastery: false }));

test('öğrenci durumu, en yüksek not, geç teslim, özet', () => {
  const r = E.assignmentAnalysis({ assignment: { questions: Q }, members: mem(['u1', 'u2', 'u3', 'u4']),
    exams: [ex('e1', 'u1', 1, 40, 'b', 20, 0), ex('e1b', 'u1', 2, 80, 'a', 60, 100),
      ex('e2', 'u2', 1, 63, 'a', 50, 50, { assignment: { late_applied: { days: 2, pct: 10, raw_grade: 70 } } }),
      { id: 'e3', user_id: 'u3', started_at: '2026-10-28T10:00:00Z', completed_at: null, questions: [], results: null }], feedback: [] });
  const by = Object.fromEntries(r.students.map(s => [s.user_id, s]));
  assert.equal(by.u1.status, 'done'); assert.equal(by.u1.attempts, 2); assert.equal(by.u1.best, 80); assert.equal(by.u1.firstExamId, 'e1'); assert.equal(by.u1.bestExamId, 'e1b');
  assert.equal(by.u2.lateDays, 2); assert.equal(by.u2.latePct, 10); assert.equal(by.u2.rawBest, 70);
  assert.equal(by.u3.status, 'in_progress'); assert.equal(by.u3.openExamId, 'e3'); assert.equal(by.u4.status, 'none');
  assert.deepEqual(r.summary, { members: 4, submitted: 2, inProgress: 1, notStarted: 1, avg: 71.5, median: 71.5, late: 1 });
});

test('soru analizi: ilk deneme, src ile asıl sıra, çeldirici dağılımı', () => {
  const r = E.assignmentAnalysis({ assignment: { questions: Q }, members: mem(['u1', 'u2']),
    exams: [ex('e1', 'u1', 1, 40, 'b', 20, 0), ex('e1b', 'u1', 2, 80, 'a', 60, 100), ex('e2', 'u2', 1, 90, 'a', 90, 100)], feedback: [] });
  assert.equal(r.analyzed, 2);
  const [mc, oe, calc] = r.questions;
  assert.equal(mc.n, 2); assert.equal(mc.correctRate, 0.5, 'u1 ilk denemesinde b dedi');
  assert.deepEqual(mc.optionCounts.map(o => [o.option, o.count, o.correct]), [['a', 1, true], ['b', 1, false], ['c', 0, false], ['d', 0, false]]);
  assert.equal(oe.correctRate, 0.5); assert.equal(oe.avgScore, 55);
  assert.equal(calc.blank, 1, 'calc src=2 → üçüncü soru');
  assert.equal(mc.discrimination, null, 'n < 4');
});

test('src yoksa metinle eşlenir', () => {
  const e = ex('e1', 'u1', 1, 50, 'a', 50, 50);
  e.questions = [{ id: 1, question: 'S3 hesapla' }, { id: 2, question: 'S1  TALEP?' }, { id: 3, question: 'S2 açıkla' }];
  const r = E.assignmentAnalysis({ assignment: { questions: Q }, members: mem(['u1']), exams: [e], feedback: [] });
  assert.equal(r.questions[0].correctRate, 1); assert.equal(r.questions[2].avgScore, 50);
});

test('ayırt edicilik ve uyarılar', () => {
  // 6 öğrenci: iyiler MC'yi yanlış, zayıflar doğru yapıyor → ters; açık uçlu herkes 0 → zor
  const ids = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
  const grades = [95, 90, 85, 30, 20, 10];
  const exams = ids.map((u, i) => ex('e' + u, u, 1, grades[i], i < 3 ? 'b' : 'a', 0, 100));
  const r = E.assignmentAnalysis({ assignment: { questions: Q }, members: mem(ids), exams, feedback: [] });
  const [mc, oe, calc] = r.questions;
  assert.equal(mc.discrimination, -1); assert.ok(mc.flags.includes('ters'));
  assert.ok(mc.flags.includes('işlemeyen çeldirici: c') && mc.flags.includes('işlemeyen çeldirici: d'));
  assert.ok(oe.flags.includes('zor')); assert.ok(oe.flags.includes('çok boş'));
  assert.ok(calc.flags.includes('kolay')); assert.equal(calc.discrimination, 0); assert.ok(calc.flags.includes('ayırt etmiyor'));
});

test('bekleyen itirazlar ve bildirimler asıl soru sırasıyla', () => {
  const r = E.assignmentAnalysis({ assignment: { questions: Q }, members: mem(['u1']), exams: [ex('e1', 'u1', 1, 40, 'b', 20, 0)],
    feedback: [{ exam_id: 'e1', question_id: 3, user_id: 'u1', kind: 'appeal', status: 'escalated' }, { exam_id: 'e1', question_id: 3, user_id: 'u1', kind: 'appeal', status: 'resolved' }, { exam_id: 'e1', question_id: 2, user_id: 'u1', kind: 'report', category: 'typo' }] });
  assert.equal(r.pendingAppeals.length, 1); assert.equal(r.pendingAppeals[0].src, 1); assert.equal(r.pendingAppeals[0].name, 'Öu1');
  assert.equal(r.reports.length, 1); assert.equal(r.reports[0].src, 0);
});

test('istek denetimi: teacher_score 0-100, teacher_note soru istemez', () => {
  assert.deepEqual(A.validateFeedbackRequest({ action: 'teacher_score', examId: 'e', questionId: 2, score: 74.6, reason: ' iyi ' }), { ok: true, action: 'teacher_score', examId: 'e', questionId: 2, reason: 'iyi', category: null, score: 75 });
  assert.equal(A.validateFeedbackRequest({ action: 'teacher_score', examId: 'e', questionId: 2, score: 101 }).error, 'bad_score');
  assert.equal(A.validateFeedbackRequest({ action: 'teacher_score', examId: 'e', questionId: 2, score: '' }).error, 'bad_score');
  assert.equal(A.validateFeedbackRequest({ action: 'teacher_score', examId: 'e', questionId: 0, score: 5 }).error, 'bad_question');
  const n = A.validateFeedbackRequest({ action: 'teacher_note', examId: 'e', reason: 'x'.repeat(1200) });
  assert.equal(n.ok, true); assert.equal(n.reason.length, 1000);
  assert.equal(A.validateFeedbackRequest({ action: 'hack', examId: 'e', questionId: 1 }).error, 'bad_action');
});

test('öğretmen puanı: aşağı da düşebilir; bekleyen itiraz kapanır', () => {
  const rs = [{ question_id: 1, type: 'open_ended', score: 50, appeal: { status: 'escalated', old_score: 50 } }, { question_id: 2, type: 'multiple_choice', score: 0 }];
  const up = A.applyTeacherScore(rs, 0, 80, 'yeterli', 'T');
  assert.equal(up.results[0].score, 80); assert.equal(up.results[0].is_correct, true); assert.equal(up.results[0].appeal.status, 'teacher_accepted');
  assert.deepEqual(up.results[0].teacher_override, { old_score: 50, score: 80, note: 'yeterli', at: 'T' }); assert.equal(up.escalated, true);
  const down = A.applyTeacherScore(rs, 0, 30, '', 'T');
  assert.equal(down.results[0].appeal.status, 'teacher_rejected'); assert.equal(down.results[0].is_correct, false);
  const mc = A.applyTeacherScore(rs, 1, 100, 'anahtar hatalıydı', 'T');
  assert.equal(mc.results[1].is_correct, true); assert.ok(!mc.results[1].appeal); assert.equal(mc.escalated, false);
  assert.equal(rs[0].score, 50, 'girdi değişmez');
});

test('öğretmen dalı: sahiplikten önce, exam_teacher_ok, iki kopya, kesinti', () => {
  const i = appeal.indexOf("if (v.action === 'teacher_score' || v.action === 'teacher_note') {");
  assert.ok(i > 0 && i < appeal.indexOf("const { data: exam, error: examError } = await userClient.from('exams')"));
  const br = appeal.slice(i, appeal.indexOf('// Sahiplik kullanıcının kendi yetkisiyle (RLS).', i));
  assert.match(br, /userClient\.rpc\('exam_teacher_ok', \{ p_exam: v\.examId \}\)/);
  assert.match(br, /okErr \|\| okT !== true/);
  assert.match(br, /const grade = withLatePenalty\(computeExamGrade\(ap\.results, tex\.scoring\), tex\.scoring\)/);
  assert.match(br, /from\('exam_hidden_results'\)\.update\(\{ results: ap\.results \}\)/);
  assert.match(br, /status: 'resolved'/);
});

test('ön yüz: çağrılar ve parametreler', () => {
  assert.match(ink, /sb\(\)\.rpc\('assignment_results', \{ p_id: id \}\)/);
  assert.match(ink, /sb\(\)\.rpc\('class_mastery_data', \{ p_class: RS\.assignment\.class_id \}\)/);
  assert.match(ink, /callAppealFn\(\{ action: 'teacher_score', examId: rsExam, questionId: \+b\.getAttribute\('data-ov-save'\), score: \+sc, reason: note \}\)/);
  assert.match(ink, /if \(ap && ap\.status === 'rejected' && RES_EXAM && RES_EXAM\.assignment_id\)/);
});

test('davranış testi (Postgres + RLS)', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const root = path.join(__dirname, '..');
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1';
  execSync(P + ' -d postgres -c "drop database if exists ax_t64" -c "create database ax_t64"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/_supabase-stub.sql', 'supabase/migrations/20261027_sinav_faz6_siniflar.sql', 'supabase/migrations/20261027b_sinav_faz6_odevler.sql', 'supabase/migrations/20261028b_sinav_faz6_ogrenci.sql',
      'supabase/migrations/20261028c_sinav_faz6_cevap_acilisi.sql', 'supabase/migrations/20261028e_sinav_faz6_sonuclar.sql', 'supabase/migrations/20261028e_sinav_faz6_sonuclar.sql'])
      execSync(P + ' -d ax_t64 -f ' + JSON.stringify(path.join(root, f)), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_t64 -f ' + JSON.stringify(path.join(root, 'tests/sql/faz6-sonuclar.sql')), { stdio: 'pipe' }).toString();
    assert.match(out, /HEPSI GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_t64"', { stdio: 'pipe' }); }
});

summary();
