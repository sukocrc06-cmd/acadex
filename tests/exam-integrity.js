/* ==========================================================================
   ACADEX — SINAV BÜTÜNLÜĞÜ TESTLERİ (tests/exam-integrity.js)

   Faz 0 (14.10.2026) değişikliklerini Groq'a ve Supabase'e hiç çıkmadan
   test eder: generate-exam'deki soru doğrulama / şık karıştırma / anahtar
   ayırma ve grade-exam'deki Türkçe karşılaştırma, sayı okuma, süre
   kontrolü, puan ayrıştırma ve not hesabı.

   Fonksiyonlar kaynak dosyalardan çalışma anında çıkarılır — bu dosyaya
   kopyalanmaz — yani index.ts değişirse test ya yeni davranışı ölçer ya
   açık hata verir.

   Çalıştırma:  node tests/exam-integrity.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const GEN_PATH = 'supabase/functions/generate-exam/index.ts';
const GRADE_PATH = 'supabase/functions/grade-exam/index.ts';

const G = loadFromSource(GEN_PATH, [
  'TRUE_FALSE_OPTIONS', 'KEY_FIELDS',
  'parseQuestionArray', 'normalizeAnswerText', 'parseLooseNumber',
  'allowedTypesFor', 'validateQuestion', 'shuffleInPlace', 'splitPublicAndKey'
]);
const R = loadFromSource(GRADE_PATH, [
  'SIMULATION_GRACE_MS',
  'normalizeAnswerText', 'foldTurkish', 'parseLooseNumber',
  'checkSubmissionWindow', 'mergeQuestionWithKey',
  'gradeChoice', 'gradeFillBlank', 'gradeCalculation',
  'parseGradesResponse', 'computeFinalGrade', 'buildAttemptRows'
]);

const { test, summary } = makeRunner();

// ---------------------------------------------------------------------------
// İki dosyadaki ortak fonksiyonlar birebir aynı kalmalı (edge function'lar
// panelden yapıştırılarak deploy edildiği için _shared modülü kullanılamıyor).
// ---------------------------------------------------------------------------
test('normalizeAnswerText ve parseLooseNumber iki dosyada birebir ayni', () => {
  const ts = require('typescript');
  const toJs = p => ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText;
  const genJs = toJs(GEN_PATH), gradeJs = toJs(GRADE_PATH);
  for (const name of ['normalizeAnswerText', 'parseLooseNumber']) {
    assert.equal(sliceDeclaration(genJs, name), sliceDeclaration(gradeJs, name), `${name} iki dosyada farkli`);
  }
});

// ---------------------------------------------------------------------------
// Türkçe karşılaştırma
// ---------------------------------------------------------------------------
test('Turkce buyuk harf: KIRILMA == kırılma (toLowerCase "kirilma" verirdi)', () => {
  assert.equal(R.normalizeAnswerText('KIRILMA'), 'kırılma');
  assert.equal(R.normalizeAnswerText('İSTANBUL'), 'istanbul');
  assert.ok(R.gradeChoice('Kırılma', 'KIRILMA'));
});

test('bas/son noktalama ve fazla bosluk atilir', () => {
  assert.equal(R.normalizeAnswerText('  "Fırsat   maliyeti." '), 'fırsat maliyeti');
});

test('NFC: birlesik ve hazir ü ayni', () => {
  assert.equal(R.normalizeAnswerText('üretim'), R.normalizeAnswerText('üretim'));
});

test('bos cevap secmeli soruda dogru sayilmaz', () => {
  assert.equal(R.gradeChoice('', ''), false);
  assert.equal(R.gradeChoice('  ', 'A'), false);
});

test('bosluk doldurma: birebir, alternatif, Turkce karakter katlamasi', () => {
  assert.deepEqual(R.gradeFillBlank('yüzde', 'Yüzde', []), { correct: true, match: 'exact' });
  assert.deepEqual(R.gradeFillBlank('NBD', 'net bugünkü değer', ['NBD', 'NPV']), { correct: true, match: 'alternative' });
  assert.deepEqual(R.gradeFillBlank('kirilma', 'kırılma', []), { correct: true, match: 'folded' });
  assert.deepEqual(R.gradeFillBlank('esneklik', 'yüzde', []), { correct: false, match: null });
  assert.deepEqual(R.gradeFillBlank('', 'yüzde', []), { correct: false, match: null });
});

// ---------------------------------------------------------------------------
// Sayı okuma ve hesaplama puanı
// ---------------------------------------------------------------------------
test('parseLooseNumber: Turkce ve Ingilizce yazimlar', () => {
  assert.equal(R.parseLooseNumber(1432.5), 1432.5);
  assert.equal(R.parseLooseNumber('1432.5'), 1432.5);
  assert.equal(R.parseLooseNumber('1.432,50'), 1432.5);
  assert.equal(R.parseLooseNumber('1,432.50'), 1432.5);
  assert.equal(R.parseLooseNumber('-3,5'), -3.5);
  assert.equal(R.parseLooseNumber('%12'), 12);
  assert.equal(R.parseLooseNumber('₺1.000.000'), 1000000);
  assert.ok(Number.isNaN(R.parseLooseNumber('')));
  assert.ok(Number.isNaN(R.parseLooseNumber('yok')));
});

test('hesaplama: tolerans icinde 100, iki kati icinde 50, disinda 0', () => {
  assert.equal(R.gradeCalculation('1000', 1000, 2, '').score, 100);
  assert.equal(R.gradeCalculation('1019', 1000, 2, '').score, 100);
  assert.equal(R.gradeCalculation('1030', 1000, 2, '').score, 50);
  assert.equal(R.gradeCalculation('1100', 1000, 2, '').score, 0);
  assert.equal(R.gradeCalculation('', 1000, 2, '').score, 0);
});

test('hesaplama: yuzde biriminde 0,12 ile 12 karisikligi kabul edilir', () => {
  const g = R.gradeCalculation('0.12', 12, 2, '%');
  assert.equal(g.score, 100);
  assert.equal(g.percentScaled, true);
  assert.equal(R.gradeCalculation('0.12', 12, 2, 'TL').score, 0, 'yuzde olmayan birimde olcekleme yapilmamali');
});

test('hesaplama: tolerans gecersizse %2 varsayilir', () => {
  assert.equal(R.gradeCalculation('100', 100, null, '').tolPercent, 2);
});

// ---------------------------------------------------------------------------
// Süre ve tek gönderim
// ---------------------------------------------------------------------------
test('tamamlanmis sinav ikinci kez gonderilemez', () => {
  assert.deepEqual(R.checkSubmissionWindow({ completed_at: '2026-10-14T10:00:00Z' }, Date.now()), { ok: false, reason: 'already_completed' });
});

test('simulasyon: sure + pay icinde kabul, sonrasi red', () => {
  const started = Date.parse('2026-10-14T10:00:00Z');
  const exam = { is_simulation: true, time_limit_seconds: 600, started_at: '2026-10-14T10:00:00Z', completed_at: null };
  assert.equal(R.checkSubmissionWindow(exam, started + 600_000).ok, true);
  assert.equal(R.checkSubmissionWindow(exam, started + 600_000 + R.SIMULATION_GRACE_MS).ok, true);
  assert.deepEqual(R.checkSubmissionWindow(exam, started + 600_000 + R.SIMULATION_GRACE_MS + 1), { ok: false, reason: 'time_expired' });
});

test('simulasyon olmayan ya da started_at i olmayan eski sinav sure kontrolune takilmaz', () => {
  assert.equal(R.checkSubmissionWindow({ is_simulation: false, time_limit_seconds: 10, started_at: '2020-01-01T00:00:00Z' }, Date.now()).ok, true);
  assert.equal(R.checkSubmissionWindow({ is_simulation: true, time_limit_seconds: 10, started_at: null }, Date.now()).ok, true);
});

// ---------------------------------------------------------------------------
// Puanlayıcı yanıtı ve not hesabı
// ---------------------------------------------------------------------------
test('parseGradesResponse: nesne, dizi, kod blogu; puan 0-100 araligina kistirilir', () => {
  assert.deepEqual(R.parseGradesResponse('{"grades":[{"question_id":1,"score":80,"feedback":"iyi"}]}'), [{ question_id: 1, score: 80, feedback: 'iyi' }]);
  assert.deepEqual(R.parseGradesResponse('```json\n[{"question_id":"2","score":140,"feedback":"x"}]\n```'), [{ question_id: 2, score: 100, feedback: 'x' }]);
  assert.equal(R.parseGradesResponse('bozuk'), null);
  assert.deepEqual(R.parseGradesResponse('{"grades":[{"question_id":1}]}'), []);
});

test('computeFinalGrade: puanlanamayan soru ortalamaya girmez', () => {
  assert.equal(R.computeFinalGrade([{ score: 100 }, { score: 0 }, { score: null }]), 50);
  assert.equal(R.computeFinalGrade([{ score: null }]), null);
  assert.equal(R.computeFinalGrade([{ score: 67 }, { score: 66 }]), 67);
});

test('mergeQuestionWithKey: anahtar varsa birlesir, yoksa (eski sinav) soru aynen kalir', () => {
  const q = { id: 1, type: 'multiple_choice', question: 'S?', options: ['a', 'b'] };
  assert.deepEqual(R.mergeQuestionWithKey(q, { 1: { correct_answer: 'b' } }), { ...q, correct_answer: 'b' });
  const legacy = { ...q, correct_answer: 'a' };
  assert.deepEqual(R.mergeQuestionWithKey(legacy, null), legacy);
});

// ---------------------------------------------------------------------------
// generate-exam: ayrıştırma ve doğrulama
// ---------------------------------------------------------------------------
test('parseQuestionArray: {"questions":[...]}, duz dizi, kod blogu, bozuk', () => {
  assert.equal(G.parseQuestionArray('{"questions":[{"id":1}]}').length, 1);
  assert.equal(G.parseQuestionArray('[{"id":1},{"id":2}]').length, 2);
  assert.equal(G.parseQuestionArray('```json\n{"items":[{"id":1}]}\n```').length, 1);
  assert.equal(G.parseQuestionArray('bozuk'), null);
  assert.equal(G.parseQuestionArray('{"x":1}'), null);
});

test('allowedTypesFor: sinav turune gore tipler', () => {
  assert.deepEqual(G.allowedTypesFor('classic', true), ['open_ended']);
  assert.deepEqual(G.allowedTypesFor('test', false), ['multiple_choice']);
  assert.ok(!G.allowedTypesFor('mixed', false).includes('calculation'));
  assert.ok(G.allowedTypesFor('mixed', true).includes('calculation'));
});

const mc = (over = {}) => ({ type: 'multiple_choice', question: 'Esneklik 1den buyukse ne olur?', options: ['Azalır', 'Artar', 'Değişmez', 'Belirlenemez'], correct_answer: 'Artar', hint: 'ipucu', concept: 'Esneklik', ...over });

test('coktan secmeli: gecerli soru kabul edilir', () => {
  const r = G.validateQuestion(mc(), ['multiple_choice'], 'tr');
  assert.equal(r.ok, true);
  assert.equal(r.question.correct_answer, 'Artar');
});

test('coktan secmeli: anahtar siklarda yoksa reddedilir', () => {
  assert.deepEqual(G.validateQuestion(mc({ correct_answer: 'Sıfır olur' }), ['multiple_choice'], 'tr'), { ok: false, reason: 'mc_answer_not_in_options' });
});

test('coktan secmeli: harf olarak verilen anahtar sikka cevrilir', () => {
  assert.equal(G.validateQuestion(mc({ correct_answer: 'B' }), ['multiple_choice'], 'tr').question.correct_answer, 'Artar');
  assert.equal(G.validateQuestion(mc({ correct_answer: 'b) Artar' }), ['multiple_choice'], 'tr').question.correct_answer, 'Artar');
});

test('coktan secmeli: tekrar eden ya da eksik sik reddedilir', () => {
  assert.equal(G.validateQuestion(mc({ options: ['Artar', 'ARTAR', 'Azalır', 'Değişmez'] }), ['multiple_choice'], 'tr').reason, 'mc_duplicate_options');
  assert.equal(G.validateQuestion(mc({ options: ['Artar', 'Azalır', 'Değişmez'] }), ['multiple_choice'], 'tr').reason, 'mc_option_count');
});

test('sinav turune uymayan tip reddedilir', () => {
  assert.equal(G.validateQuestion(mc(), ['open_ended'], 'tr').reason, 'type_not_allowed:multiple_choice');
});

test('dogru-yanlis: siklar dile gore sunucuda konur, anahtar normalize edilir', () => {
  const r = G.validateQuestion({ type: 'true_false', question: 'Tam rekabette firma fiyat belirler.', correct_answer: 'False' }, ['true_false'], 'tr');
  assert.deepEqual(r.question.options, ['Doğru', 'Yanlış']);
  assert.equal(r.question.correct_answer, 'Yanlış');
  assert.equal(G.validateQuestion({ type: 'true_false', question: 'Bir ifade burada.', correct_answer: 'belki' }, ['true_false'], 'tr').reason, 'tf_answer_unclear');
});

test('hesaplama: sayi olmayan anahtar reddedilir, tolerans kistirilir', () => {
  assert.equal(G.validateQuestion({ type: 'calculation', question: 'NBD kaç TL?', correct_answer: 'yaklaşık bin' }, ['calculation'], 'tr').reason, 'calc_answer_not_number');
  const r = G.validateQuestion({ type: 'calculation', question: 'NBD kaç TL?', correct_answer: '1.432,50', tolerance_percent: 50 }, ['calculation'], 'tr');
  assert.equal(r.question.correct_answer, 1432.5);
  assert.equal(r.question.tolerance_percent, 10);
});

test('bosluk doldurma: kabul edilen alternatifler temizlenir', () => {
  const r = G.validateQuestion({ type: 'fill_blank', question: 'Esneklik ______ değişimi ölçer.', correct_answer: 'yüzde', accepted_answers: ['oransal', '', null] }, ['fill_blank'], 'tr');
  assert.deepEqual(r.question.accepted_answers, ['oransal']);
});

test('shuffleInPlace: elemanlar korunur, sabit rand ile belirlenebilir', () => {
  const arr = ['A', 'B', 'C', 'D'];
  const out = G.shuffleInPlace([...arr], () => 0);
  assert.deepEqual([...out].sort(), arr);
  assert.notDeepEqual(out, arr);
});

test('splitPublicAndKey: anahtar alanlari tarayiciya giden kisimda yok', () => {
  const q = { id: 1, type: 'calculation', question: 'S?', units: 'TL', concept: 'NBD', correct_answer: 5, solution_steps: ['a'], tolerance_percent: 2, hint: 'h', accepted_answers: [] };
  const { pub, key } = G.splitPublicAndKey(q);
  for (const k of G.KEY_FIELDS) assert.ok(!(k in pub), `${k} tarayiciya sizdi`);
  assert.deepEqual(Object.keys(pub).sort(), ['concept', 'id', 'question', 'type', 'units']);
  assert.equal(key.correct_answer, 5);
});

// ---------------------------------------------------------------------------
// FAZ 1: soru bazında deneme satırları
// ---------------------------------------------------------------------------
test('buildAttemptRows: her soru icin bir satir; ipucu ve isaret bilgisi, anahtar', () => {
  const exam = { id: 'e1', user_id: 'u1', course_code: 'IKT101', study_card_id: null, language: 'tr' };
  const questions = [
    { id: 1, type: 'multiple_choice', question: 'S1?', options: ['a', 'b'], correct_answer: 'b', difficulty: 'easy' },
    { id: 2, type: 'open_ended', question: 'S2?', correct_answer: 'ref' }
  ];
  const results = [
    { question_id: 1, type: 'multiple_choice', concept: 'Esneklik', student_answer: 'a', score: 0, is_correct: false },
    { question_id: 2, type: 'open_ended', concept: null, student_answer: 'x', score: null, is_correct: null }
  ];
  const rows = R.buildAttemptRows(exam, questions, results, [2], [1]);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { q: rows[0].question_id, hint: rows[0].hint_used, flag: rows[0].flagged, score: rows[0].score, key: rows[0].answer_key.correct_answer, course: rows[0].course_code, diff: rows[0].difficulty },
    { q: 1, hint: true, flag: false, score: 0, key: 'b', course: 'IKT101', diff: 'easy' }
  );
  assert.equal(rows[1].flagged, true);
  assert.equal(rows[1].score, null, 'puanlanamayan soru null kalmali');
  assert.equal(rows[1].study_card_id, null);
  assert.deepEqual(rows[0].question, { question: 'S1?', options: ['a', 'b'], units: null });
});

test('buildAttemptRows: flags/hints bozuk gelirse yine calisir', () => {
  const rows = R.buildAttemptRows({ id: 1, user_id: 'u' }, [{ id: 1, type: 'true_false' }], [{ question_id: 1, score: 100, is_correct: true }], 'bozuk', null);
  assert.equal(rows[0].flagged, false);
  assert.equal(rows[0].hint_used, false);
});

summary();
