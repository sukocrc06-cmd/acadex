/* ==========================================================================
   ACADEX — SINAV İTİRAZ VE BİLDİRİM TESTLERİ (tests/exam-appeal.js)

   Faz 2b (22.10.2026): supabase/functions/exam-appeal/index.ts. Groq'a ve
   Supabase'e çıkmadan test eder:
     - grade-exam'den kopyalanan yardımcıların BİREBİR aynı kalması
     - istek doğrulama, itiraz edilebilirlik
     - itiraz sonucunun işlenmesi: puan asla düşmez, not yeniden hesaplanır
     - bildirim ve öğretmene iletme sonuçları değiştirmeden işler
     - yeniden puanlama mesajları, boşluk kararı ayrıştırma

   Çalıştırma:  node tests/exam-appeal.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const APPEAL_PATH = 'supabase/functions/exam-appeal/index.ts';
const GRADE_PATH = 'supabase/functions/grade-exam/index.ts';

const SHARED = [
  'normalizeAnswerText', 'foldTurkish', 'mergeQuestionWithKey', 'parseGradesResponse', 'parseCriteria',
  'GROQ_RETRY_MAX_WAIT_MS', 'groqRetryDelayMs', 'PLACEHOLDER_ANSWERS', 'isPlaceholderAnswer',
  'effectiveCorrectAnswer', 'VERDICT_SHARE', 'scoreFromRubric', 'computeFinalGrade'
];

const A = loadFromSource(APPEAL_PATH, [
  ...SHARED,
  'APPEAL_DAILY_LIMIT', 'REPORT_DAILY_LIMIT', 'APPEAL_REASON_MIN', 'APPEAL_REASON_MAX', 'REPORT_NOTE_MAX',
  'REPORT_CATEGORIES', 'APPEALABLE_TYPES', 'STATIC_APPEAL_INSTRUCTIONS', 'STATIC_BLANK_APPEAL_INSTRUCTIONS',
  'validateFeedbackRequest', 'errorMessage', 'findResultIndex', 'appealEligibility',
  'buildOpenAppealPrompt', 'buildBlankAppealPrompt', 'parseBlankVerdict',
  'applyAppealOutcome', 'applyReport', 'applyEscalation'
]);

const { test, summary } = makeRunner();

test('grade-exam ten kopyalanan yardimcilar birebir ayni', () => {
  const ts = require('typescript');
  const toJs = p => ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText;
  const a = toJs(APPEAL_PATH), g = toJs(GRADE_PATH);
  for (const name of SHARED) assert.equal(sliceDeclaration(a, name), sliceDeclaration(g, name), `${name} iki dosyada farkli`);
});

// ---------------------------------------------------------------------------
// İstek doğrulama
// ---------------------------------------------------------------------------
test('validateFeedbackRequest: gecerli itiraz, bildirim, iletme', () => {
  const ap = A.validateFeedbackRequest({ action: 'appeal', examId: 'e1', questionId: '2', reason: '  COUNTIF   formülünü de yazdım,  ikinci cümlede.  ' });
  assert.equal(ap.ok, true);
  assert.equal(ap.questionId, 2);
  assert.equal(ap.reason, 'COUNTIF formülünü de yazdım, ikinci cümlede.');
  const rp = A.validateFeedbackRequest({ action: 'report', examId: 7, questionId: 1, category: 'wrong_key' });
  assert.deepEqual([rp.ok, rp.examId, rp.category, rp.reason], [true, '7', 'wrong_key', '']);
  assert.equal(A.validateFeedbackRequest({ action: 'escalate', examId: 'e', questionId: 3 }).ok, true);
});

test('validateFeedbackRequest: hatali istekler kodla reddedilir', () => {
  const code = b => A.validateFeedbackRequest(b).error;
  assert.equal(code(null), 'bad_body');
  assert.equal(code({ action: 'sil', examId: 'e', questionId: 1 }), 'bad_action');
  assert.equal(code({ action: 'report', questionId: 1, category: 'typo' }), 'bad_exam');
  assert.equal(code({ action: 'report', examId: 'e', questionId: 0, category: 'typo' }), 'bad_question');
  assert.equal(code({ action: 'report', examId: 'e', questionId: 1.5, category: 'typo' }), 'bad_question');
  assert.equal(code({ action: 'appeal', examId: 'e', questionId: 1, reason: 'haksızlık' }), 'reason_too_short');
  assert.equal(code({ action: 'report', examId: 'e', questionId: 1, category: 'kotu' }), 'bad_category');
  assert.equal(code({ action: 'report', examId: 'e', questionId: 1, category: 'other', reason: 'x' }), 'note_required');
});

test('validateFeedbackRequest: uzun metinler kirpilir', () => {
  const ap = A.validateFeedbackRequest({ action: 'appeal', examId: 'e', questionId: 1, reason: 'a'.repeat(5000) });
  assert.equal(ap.reason.length, A.APPEAL_REASON_MAX);
  const rp = A.validateFeedbackRequest({ action: 'report', examId: 'e', questionId: 1, category: 'typo', reason: 'b'.repeat(5000) });
  assert.equal(rp.reason.length, A.REPORT_NOTE_MAX);
});

test('errorMessage: her hata kodunun Turkce ve Ingilizce metni var', () => {
  const codes = ['bad_body', 'bad_action', 'bad_exam', 'bad_question', 'reason_too_short', 'bad_category', 'note_required',
    'not_completed', 'no_question', 'not_appealable', 'already_full', 'already_appealed', 'already_reported',
    'daily_limit', 'no_appeal', 'not_rejected', 'regrade_failed', 'table_missing'];
  for (const c of codes) {
    assert.notEqual(A.errorMessage(c, true), c, `tr metni yok: ${c}`);
    assert.notEqual(A.errorMessage(c, false), c, `en metni yok: ${c}`);
  }
});

// ---------------------------------------------------------------------------
// İtiraz edilebilirlik
// ---------------------------------------------------------------------------
test('appealEligibility: yalnizca klasik ve bosluk, tam puan degilse', () => {
  assert.equal(A.appealEligibility({ type: 'open_ended', score: 45 }), null);
  assert.equal(A.appealEligibility({ type: 'fill_blank', score: 0 }), null);
  assert.equal(A.appealEligibility({ type: 'open_ended', score: null }), null, 'puanlanamayan soru itirazla puanlanabilir');
  assert.equal(A.appealEligibility({ type: 'open_ended', score: 100 }), 'already_full');
  for (const t of ['multiple_choice', 'true_false', 'calculation']) assert.equal(A.appealEligibility({ type: t, score: 0 }), 'not_appealable');
});

test('findResultIndex: soru id siyle bulur', () => {
  const rs = [{ question_id: 1 }, { question_id: '2' }, null];
  assert.equal(A.findResultIndex(rs, 2), 1);
  assert.equal(A.findResultIndex(rs, 9), -1);
  assert.equal(A.findResultIndex(null, 1), -1);
});

// ---------------------------------------------------------------------------
// İtiraz sonucu
// ---------------------------------------------------------------------------
const RESULTS = () => [
  { question_id: 1, type: 'multiple_choice', score: 100 },
  { question_id: 2, type: 'open_ended', score: 45, is_correct: false, feedback: 'COUNTIF eksik',
    rubric_results: [{ criterion: 'SUMIF', points: 45, verdict: 'met', earned: 45, note: '' }, { criterion: 'COUNTIF', points: 45, verdict: 'missing', earned: 0, note: '' }, { criterion: 'aralık', points: 10, verdict: 'missing', earned: 0, note: '' }] },
  { question_id: 3, type: 'fill_blank', score: 0, is_correct: false }
];
const NOW = '2026-10-22T10:00:00.000Z';

test('kabul: puan artar, dokum yenilenir, not yeniden hesaplanir', () => {
  const newRubric = [{ criterion: 'SUMIF', points: 45, verdict: 'met', earned: 45, note: '' }, { criterion: 'COUNTIF', points: 45, verdict: 'met', earned: 45, note: 'ikinci cümle' }, { criterion: 'aralık', points: 10, verdict: 'missing', earned: 0, note: '' }];
  const r = A.applyAppealOutcome(RESULTS(), 1, { regradeScore: 90, feedback: 'COUNTIF de var.', rubricResults: newRubric, note: 'COUNTIF de var.' }, NOW);
  assert.equal(r.accepted, true);
  assert.equal(r.finalScore, 90);
  assert.equal(r.results[1].score, 90);
  assert.equal(r.results[1].is_correct, true);
  assert.equal(r.results[1].rubric_results[1].verdict, 'met');
  assert.equal(r.results[1].feedback, 'COUNTIF de var.');
  assert.deepEqual(r.results[1].appeal, { status: 'accepted', old_score: 45, regrade_score: 90, new_score: 90, note: 'COUNTIF de var.', at: NOW });
  assert.equal(r.grade, Math.round((100 + 90 + 0) / 3));
});

test('ret: yeniden puan dusuk ya da esitse eski puan ve dokum kalir (puan asla dusmez)', () => {
  for (const regrade of [30, 45]) {
    const before = RESULTS();
    const r = A.applyAppealOutcome(before, 1, { regradeScore: regrade, feedback: 'yeni', rubricResults: [], note: 'Cevapta COUNTIF yok.' }, NOW);
    assert.equal(r.accepted, false);
    assert.equal(r.results[1].score, 45);
    assert.equal(r.results[1].feedback, 'COUNTIF eksik');
    assert.equal(r.results[1].rubric_results[1].verdict, 'missing');
    assert.equal(r.results[1].appeal.status, 'rejected');
    assert.equal(r.results[1].appeal.regrade_score, regrade);
    assert.equal(r.grade, Math.round((100 + 45 + 0) / 3));
    assert.equal(before[1].appeal, undefined, 'girdi dizisi degistirilmemeli');
  }
});

test('bosluk: kabulde dogru sayilir; puanlanamamis soru itirazla puanlanir', () => {
  const b = A.applyAppealOutcome(RESULTS(), 2, { regradeScore: 100, feedback: '', rubricResults: null, note: 'Eşanlamlı.' }, NOW);
  assert.equal(b.results[2].is_correct, true);
  assert.equal(b.results[2].appeal.note, 'Eşanlamlı.');
  const rs = RESULTS(); rs[1].score = null; rs[1].grading_failed = true;
  const n = A.applyAppealOutcome(rs, 1, { regradeScore: 20, feedback: 'f', rubricResults: null, note: '' }, NOW);
  assert.equal(n.accepted, true);
  assert.equal(n.results[1].score, 20);
  assert.equal(n.results[1].grading_failed, false);
  assert.equal(n.results[1].appeal.old_score, null);
});

test('yeniden puan 0-100 araligina kistirilir', () => {
  const r = A.applyAppealOutcome(RESULTS(), 1, { regradeScore: 140.4, feedback: '', rubricResults: null, note: '' }, NOW);
  assert.equal(r.finalScore, 100);
});

test('bildirim ve iletme: puana dokunmaz, girdiyi degistirmez', () => {
  const rs = RESULTS();
  const rep = A.applyReport(rs, 0, 'wrong_key', NOW);
  assert.deepEqual(rep[0].report, { category: 'wrong_key', at: NOW });
  assert.equal(rep[0].score, 100);
  assert.equal(rs[0].report, undefined);
  const rej = A.applyAppealOutcome(rs, 1, { regradeScore: 30, feedback: '', rubricResults: null, note: 'n' }, NOW).results;
  const esc = A.applyEscalation(rej, 1, '2026-10-23T00:00:00.000Z');
  assert.equal(esc[1].appeal.status, 'escalated');
  assert.equal(esc[1].appeal.regrade_score, 30);
  assert.equal(esc[1].appeal.escalated_at, '2026-10-23T00:00:00.000Z');
  assert.equal(esc[1].score, 45);
});

// ---------------------------------------------------------------------------
// Mesajlar ve ayrıştırma
// ---------------------------------------------------------------------------
test('klasik itiraz mesaji: rubrik numarali, ilk kararlar ve itiraz notu var', () => {
  const q = { id: 2, type: 'open_ended', question: 'SUMIF ve COUNTIF?', correct_answer: 'null', explanation: 'İkisi aynı kriterle kullanılır.', rubric: [{ criterion: 'SUMIF', points: 45 }, { criterion: 'COUNTIF', points: 45 }, { criterion: 'aralık', points: 10 }] };
  const msg = A.buildOpenAppealPrompt(q, RESULTS()[1], 'COUNTIF formülünü ikinci cümlede yazdım.', 'tr');
  const payload = JSON.parse(msg.slice(msg.indexOf('{')));
  assert.equal(payload.question_id, 2);
  assert.equal(payload.reference_answer, 'İkisi aynı kriterle kullanılır.', '"null" anahtar aciklamaya dusmeli');
  assert.deepEqual(payload.rubric.map(r => r.index), [1, 2, 3]);
  assert.deepEqual(payload.first_grading.criteria.map(c => c.verdict), ['met', 'missing', 'missing']);
  assert.equal(payload.student_appeal, 'COUNTIF formülünü ikinci cümlede yazdım.');
  assert.match(msg, /'tr'/);
});

test('sistem mesajlari itiraz notunu kanit saymaz ve sabittir', () => {
  assert.match(A.STATIC_APPEAL_INSTRUCTIONS, /NOT evidence/);
  assert.match(A.STATIC_BLANK_APPEAL_INSTRUCTIONS, /NOT evidence/);
  assert.ok(!/\$\{/.test(A.STATIC_APPEAL_INSTRUCTIONS + A.STATIC_BLANK_APPEAL_INSTRUCTIONS), 'sistem mesaji istege gore degismemeli');
});

test('bosluk itiraz mesaji ve karar ayristirma', () => {
  const msg = A.buildBlankAppealPrompt({ type: 'fill_blank', question: 'CHOOSE ______ döndürür.', correct_answer: 'null', accepted_answers: ['option', 'seçenek'] }, { student_answer: 'değer' }, 'Listeden bir değer döndürüyor.', 'tr');
  const payload = JSON.parse(msg.slice(msg.indexOf('{')));
  assert.equal(payload.correct_answer, 'option', 'eski "null" anahtar ilk alternatife duser');
  assert.equal(payload.student_answer, 'değer');
  assert.deepEqual(payload.accepted_answers, ['option', 'seçenek']);
  assert.deepEqual(A.parseBlankVerdict('{"acceptable": true, "note": "Eşanlamlı."}'), { acceptable: true, note: 'Eşanlamlı.' });
  assert.deepEqual(A.parseBlankVerdict('```json\n{"acceptable":"false","note":"Farklı kavram."}\n```'), { acceptable: false, note: 'Farklı kavram.' });
  assert.equal(A.parseBlankVerdict('{"acceptable": "belki"}'), null);
  assert.equal(A.parseBlankVerdict('bozuk'), null);
});

summary();
