/* ==========================================================================
   ACADEX — ÖDEV: ÖĞRENCİ TARAFI TESTLERİ (tests/exam-assignment-student.js)

   Faz 6.3 (28.10.2026):
     - "öğrenciye özel sayılar": generate-exam'deki makeVariant, exam-engine'deki
       ile BİREBİR aynı sonucu verir (aynı rastgele sayılarla)
     - öğrenciye özel kopya: sıra karıştırma (keep_order şıklara dokunulmaz),
       değişen sayıda eski sayılara bağlı alanlar (çözüm adımları…) atılır
     - geç teslim kesintisi: her başlamış gün için %pct; 2 dk tolerans
     - gizli cevaplar: exams satırında anahtar yok; question_attempts anahtarı boş;
       tam sonuç exam_hidden_results'ta, reveal_at geçince
     - itiraz: cevaplar gizliyken yok; yeniden hesaplanan nota kesinti uygulanır
     - başlatma: model çağrılmaz, kurallar SQL'de (assignment_begin yalnızca service_role)

   Davranış testi: tests/sql/faz6-ogrenci.sql (ACADEX_PG verilirse)
   Çalıştırma:  node tests/exam-assignment-student.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { loadFromSource, readSource, makeRunner } = require('./_ts-extract.js');

const GEN = 'supabase/functions/generate-exam/index.ts';
const EXPR = ['EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression', 'sanitizeVariables'];
const G = loadFromSource(GEN, [...EXPR, 'shuffleInPlace', 'TEMPLATE_PH', 'formatNumber', 'templateMultipliers', 'tidy', 'renderTemplate', 'decimalsOf', 'significantDigits', 'makeVariant', 'buildAssignmentQuestions']);
const R = loadFromSource('supabase/functions/grade-exam/index.ts', ['LATE_GRACE_MS', 'HIDDEN_KEEP', 'assignmentLatePenalty', 'redactAssignmentResult', 'assignmentReveal']);
const A = loadFromSource('supabase/functions/exam-appeal/index.ts', ['assignmentAnswersHidden', 'withLatePenalty']);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));
const gen = readSource(GEN), grade = readSource('supabase/functions/grade-exam/index.ts'), ink = readSource('js/acadex-ink.js');
const { test, summary } = makeRunner();

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const H = 3600e3, DUE = Date.UTC(2026, 10, 1, 20, 59);

test('makeVariant: sunucu ve tarayıcı kopyası aynı sonucu verir', () => {
  const cases = [
    { template: 'Faiz %{r*100}, anapara {P} TL, {n} yıl. Bileşik tutar?', formula: 'P*(1+r)^n', variables: { r: 0.04, P: 25000, n: 3 } },
    { template: 'P = {a} − {b}Q ve P = {c}Q ise Q?', formula: 'a/(b+c)', variables: { a: 18, b: 2, c: 2 } },
    { template: 'Aylık {m/12} ödeme', formula: 'm*2', variables: { m: 0.5 } }
  ];
  for (const c of cases) for (const r of [[0.1, 0.9, 0.5, 0.3, 0.7], [0.99, 0.01, 0.42]]) {
    for (const lang of ['tr', 'en']) assert.deepEqual(G.makeVariant(c, lang, seq(r)), E.makeVariant(c, lang, seq(r)), c.template + ' ' + lang);
  }
});

test('öğrenciye özel kopya: karıştırma, keep_order, yeniden numara, öğretmen alanları atılır', () => {
  const qs = [
    { id: 7, type: 'multiple_choice', question: 'S1', options: ['a', 'b', 'c', 'd'], correct_answer: 'a', author: 'teacher', edited: true },
    { id: 8, type: 'multiple_choice', question: 'S2', options: ['I', 'II', 'I ve II'], keep_order: true, correct_answer: 'I ve II' },
    { id: 9, type: 'open_ended', question: 'S3' }
  ];
  const out = G.buildAssignmentQuestions(qs, { shuffle: true }, 'tr', seq([0.1, 0.8, 0.3, 0.6, 0.2]));
  assert.deepEqual(out.map(q => q.id), [1, 2, 3]);
  assert.deepEqual(out.map(q => q.question).sort(), ['S1', 'S2', 'S3']);
  const s1 = out.find(q => q.question === 'S1'), s2 = out.find(q => q.question === 'S2');
  assert.deepEqual([...s1.options].sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(s2.options, ['I', 'II', 'I ve II'], 'keep_order şıkları korunur');
  assert.ok(!('author' in s1) && !('edited' in s1));
  assert.deepEqual(out.map(q => q.src).sort(), [0, 1, 2]); assert.equal(s1.src, 0); assert.equal(s2.src, 1);
  const plain = G.buildAssignmentQuestions(qs, { shuffle: false }, 'tr', seq([0.1]));
  assert.deepEqual(plain.map(q => q.question), ['S1', 'S2', 'S3']);
  assert.deepEqual(plain[0].options, ['a', 'b', 'c', 'd']);
  assert.equal(qs[0].id, 7, 'kaynak dizi değişmez');
});

test('öğrenciye özel sayılar: cevap formülden, eski sayılara bağlı alanlar atılır', () => {
  const q = { type: 'calculation', question: 'P = 18 − 2Q ve P = 2Q ise Q?', template: 'P = {a} − {b}Q ve P = {c}Q ise Q?', formula: 'a/(b+c)', variables: { a: 18, b: 2, c: 2 }, correct_answer: 4.5, solution_steps: ['18/4'], common_errors: [{ value: 9 }], explanation: '18 / 4 = 4,5' };
  const [v] = G.buildAssignmentQuestions([q], { vary_numbers: true, shuffle: false }, 'tr', seq([0.9, 0.2, 0.6]));
  assert.equal(v.varied, true);
  assert.notEqual(v.question, q.question);
  assert.equal(v.correct_answer, Math.round(v.variables.a / (v.variables.b + v.variables.c) * 1e4) / 1e4);
  for (const k of ['solution_steps', 'common_errors', 'explanation']) assert.ok(!(k in v), k);
  const [same] = G.buildAssignmentQuestions([q], { vary_numbers: false, shuffle: false }, 'tr');
  assert.equal(same.correct_answer, 4.5); assert.ok(!same.varied);
  const [chart] = G.buildAssignmentQuestions([{ ...q, chart: { type: 'bar' } }], { vary_numbers: true, shuffle: false }, 'tr');
  assert.ok(!chart.varied, 'grafikli soru değişmez');
});

test('geç teslim kesintisi: her başlamış gün, 2 dk tolerans, kesintisizde 0', () => {
  const asg = { due_at: new Date(DUE).toISOString(), late: { pct: 10, days: 3 } };
  assert.deepEqual(R.assignmentLatePenalty(asg, DUE - 1000), { days: 0, pct: 0 });
  assert.deepEqual(R.assignmentLatePenalty(asg, DUE + 90_000), { days: 0, pct: 0 }, 'tolerans');
  assert.deepEqual(R.assignmentLatePenalty(asg, DUE + 3 * 60_000), { days: 1, pct: 10 });
  assert.deepEqual(R.assignmentLatePenalty(asg, DUE + 30 * H), { days: 2, pct: 20 });
  assert.deepEqual(R.assignmentLatePenalty({ ...asg, late: null }, DUE + 30 * H), { days: 2, pct: 0 });
  assert.deepEqual(R.assignmentLatePenalty({ ...asg, late: { pct: 60 } }, DUE + 30 * H), { days: 2, pct: 100 }, 'en çok %100');
  assert.deepEqual(R.assignmentLatePenalty(null, DUE + 30 * H), { days: 0, pct: 0 });
});

test('gizli cevaplar: sonuçta anahtar yok, ne zaman açılacağı', () => {
  const full = { question_id: 1, type: 'multiple_choice', question: 'S', options: ['a', 'b'], student_answer: 'b', score: 0, is_correct: false, correct_answer: 'a', explanation: 'çünkü', option_rationales: ['x'], feedback: 'Yanlış cevap. Doğru cevap: a', practice: { formula: 'x' }, solution_steps: ['1'], rubric_results: [{}], source: { page: 3 } };
  const red = R.redactAssignmentResult(full, true);
  for (const k of ['correct_answer', 'explanation', 'option_rationales', 'practice', 'solution_steps', 'rubric_results', 'source']) assert.ok(!(k in red), k);
  assert.equal(red.feedback, 'Yanlış.'); assert.equal(red.answers_hidden, true); assert.equal(red.score, 0);
  assert.ok(!JSON.stringify(red).includes('Doğru cevap'));
  assert.equal(R.redactAssignmentResult({ ...full, student_answer: '' }, true).feedback, 'Boş bırakıldı.');
  assert.equal(R.redactAssignmentResult({ ...full, score: 60 }, false).feedback, 'Partially correct.');
  assert.deepEqual(R.assignmentReveal({ show_answers: 'after_submit' }), { hidden: false, revealAt: null });
  assert.deepEqual(R.assignmentReveal({ show_answers: 'never' }), { hidden: true, revealAt: null });
  assert.deepEqual(R.assignmentReveal({ show_answers: 'after_due', due_at: 'D', window_end: 'W' }), { hidden: true, revealAt: 'W' });
  assert.deepEqual(R.assignmentReveal(null), { hidden: false, revealAt: null });
});

test('grade-exam: kesinti ve gizleme kayda uygulanıyor, attempt anahtarı boş', () => {
  assert.match(grade, /const gradeToStore = late\.pct > 0 \? Math\.round\(finalGrade \* \(100 - late\.pct\)\) \/ 100 : finalGrade/);
  assert.match(grade, /const storedResults = reveal\.hidden \? results\.map\(r => redactAssignmentResult\(r, isTr\)\) : results/);
  assert.match(grade, /\.update\(examPatch\)\s*\.eq\('id', examId\)\s*\.is\('completed_at', null\)/);
  assert.match(grade, /if \(reveal\.hidden\) rows\.forEach\(r => \{ r\.answer_key = null \}\)/);
  assert.match(grade, /from\('exam_hidden_results'\)\s*\.upsert\(\{ exam_id: exam\.id, user_id: exam\.user_id, results, reveal_at: reveal\.revealAt \}/);
});

test('itiraz: gizliyken yok (açılışa RLS karar verir); kesinti yeniden hesaplanan nota da', () => {
  const ex = (a) => ({ assignment_id: 'a', scoring: { assignment: a } });
  assert.equal(A.assignmentAnswersHidden(ex({ answers_hidden: true })), true);
  assert.equal(A.assignmentAnswersHidden(ex({ answers_hidden: false })), false);
  assert.equal(A.assignmentAnswersHidden({ scoring: { assignment: { answers_hidden: true } } }), false, 'ödev değil');
  const appeal = readSource('supabase/functions/exam-appeal/index.ts');
  assert.match(appeal, /if \(kind === 'appeal' && assignmentAnswersHidden\(exam\)\) \{\s*const \{ data: shown \} = await userClient\.from\('exam_hidden_results'\)\.select\('exam_id'\)\.eq\('exam_id', exam\.id\)\.maybeSingle\(\)\s*if \(!shown\) return fail\('answers_hidden', 403\)/);
  assert.equal(A.withLatePenalty(80, { assignment: { late_applied: { pct: 10 } } }), 72);
  assert.equal(A.withLatePenalty(80, { assignment: { late_applied: null } }), 80);
  assert.equal(A.withLatePenalty(80, {}), 80);
  assert.equal(A.withLatePenalty(null, { assignment: { late_applied: { pct: 10 } } }), null);
});

test('başlatma yolu: model ve sınır sayımından önce; parametre denetimi atlanır; süreli ve ipuçsuz', () => {
  assert.match(gen, /const startMode = typeof assignmentStart === 'string' && assignmentStart\.length > 0/);
  for (const re of [/if \(!startMode && resolvedSourceType === 'study_card' && !studyCardId\)/, /if \(!startMode && \(!examType \|\| !questionCount \|\| !language\)\)/, /if \(!startMode && \(!ALLOWED_EXAM_TYPES\.includes\(examType\)/]) assert.match(gen, re);
  const i = gen.indexOf('if (startMode) return await startAssignmentExam(serviceClient, user.id, assignmentStart)');
  assert.ok(i > 0 && i < gen.indexOf('if (draftMode) {\n      const { data: okTake') && i < gen.indexOf('const countSince = async'), 'sınır ve taslak kapısından önce');
  const fn = gen.slice(gen.indexOf('async function startAssignmentExam'), gen.indexOf('serve(async (req) => {'));
  assert.match(fn, /serviceClient\.rpc\('assignment_begin', \{ p_id: assignmentId, p_user: userId \}\)/);
  assert.match(fn, /is_simulation: true,/);
  assert.match(fn, /const limit = Math\.max\(60, Math\.min\(own, windowLeft\)\)/);
  assert.match(fn, /splitPublicAndKey\(q\)/);
  assert.match(fn, /from\('exam_answer_keys'\)\.insert/);
  assert.ok(!/callGroq|fetch\(/.test(fn), 'model çağrısı yok');
});

test('ön yüz: liste RPC parametresiz; başla gövdesi yalnızca ödev kimliği', () => {
  assert.match(ink, /sb\(\)\.rpc\('my_assignments'\)/);
  assert.match(ink, /body: JSON\.stringify\(\{ assignmentStart: a\.id \}\)/);
  assert.match(ink, /from\('exam_hidden_results'\)\.select\('results'\)\.eq\('exam_id', exam\.id\)/);
  assert.match(ink, /bir öğretmenin ödevi değildir/);
});

test('davranış testi (Postgres + RLS)', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const root = path.join(__dirname, '..');
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1';
  execSync(P + ' -d postgres -c "drop database if exists ax_t63" -c "create database ax_t63"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/_supabase-stub.sql', 'supabase/migrations/20261027_sinav_faz6_siniflar.sql', 'supabase/migrations/20261027b_sinav_faz6_odevler.sql', 'supabase/migrations/20261028b_sinav_faz6_ogrenci.sql', 'supabase/migrations/20261028c_sinav_faz6_cevap_acilisi.sql', 'supabase/migrations/20261028c_sinav_faz6_cevap_acilisi.sql'])
      execSync(P + ' -d ax_t63 -f ' + JSON.stringify(path.join(root, f)), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_t63 -f ' + JSON.stringify(path.join(root, 'tests/sql/faz6-ogrenci.sql')), { stdio: 'pipe' }).toString();
    assert.match(out, /HEPSI GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_t63"', { stdio: 'pipe' }); }
});

test('sınav satırı koruması: ödev alanları, süre, gerçek sınav ayarı, öğretmen notu (Postgres)', () => {
  const mig = readSource('supabase/migrations/20261028d_sinav_faz6_koruma.sql');
  for (const c of ['assignment_id', 'attempt_no', 'is_simulation', 'time_limit_seconds', 'teacher_note', 'user_id']) assert.match(mig, new RegExp('or new\\.' + c + ' is distinct from old\\.' + c), c);
  assert.match(mig, /or new\.assignment_id is not null or new\.attempt_no is not null/);
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const root = path.join(__dirname, '..');
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1';
  execSync(P + ' -d postgres -c "drop database if exists ax_t63c" -c "create database ax_t63c"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/_supabase-stub.sql', 'supabase/migrations/20261027_sinav_faz6_siniflar.sql', 'supabase/migrations/20261027b_sinav_faz6_odevler.sql', 'supabase/migrations/20261028b_sinav_faz6_ogrenci.sql', 'supabase/migrations/20261028d_sinav_faz6_koruma.sql', 'supabase/migrations/20261028d_sinav_faz6_koruma.sql'])
      execSync(P + ' -d ax_t63c -f ' + JSON.stringify(path.join(root, f)), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_t63c -f ' + JSON.stringify(path.join(root, 'tests/sql/faz6-koruma.sql')), { stdio: 'pipe' }).toString();
    assert.match(out, /HEPSI GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_t63c"', { stdio: 'pipe' }); }
});

summary();
