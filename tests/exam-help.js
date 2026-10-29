/* ==========================================================================
   ACADEX — SINAVDA ADIM ADIM YARDIM TESTLERİ (tests/exam-help.js)

   Faz 7 (29.10.2026): generate-exam { help }, grade-exam applyHelp,
   exam-appeal tavanı, konu ustalığı.
     - makeVariant: sunucu kopyası exam-engine ile BİREBİR aynı sonucu verir
     - hesap adımları: değeri model değil kod hesaplar; geçersiz, girdiyi
       tekrar eden ya da cevaba eşit ara adım atılır; son adım sorunun cevabı
     - yönlendirici adımlar: son cevabı ele veren adım atılır, şık karışınca
       doğru şıkkın yeri izlenir
     - adım denetimi: Türkçe/İngilizce sayı yazımı, yüzde; iki yanlışta
       doğrusu gösterilip geçilir
     - puan: 'cap' ve yeni sayıları yazılmamış 'variant' en çok 50; yeni
       sayılarla çözülen tam puan; netlerde yardımlı doğru yarım
     - itiraz tavanı aşamaz; ustalıkta yardımlı doğru zayıf kanıt

   Çalıştırma:  node tests/exam-help.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFromSource, readSource, makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const GEN = 'supabase/functions/generate-exam/index.ts';
const EXPR = ['EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression', 'sanitizeVariables'];
const NUM = ['parseLooseNumber', 'answerNumber', 'normalizeAnswerText', 'numberReadings', 'sameNumber', 'withinTolerance', 'shuffleInPlace'];
const G = loadFromSource(GEN, [...EXPR, ...NUM, 'TEMPLATE_PH', 'formatNumber', 'templateMultipliers', 'tidy', 'renderTemplate', 'decimalsOf', 'significantDigits', 'makeVariant',
  'HELP_CAP', 'HELP_TRIES', 'HELP_MAX_STEPS', 'HELP_PROMPT_MAX', 'HELP_EXPLAIN_MAX', 'helpIsCalc', 'helpInlineExpr', 'helpRound', 'helpHumanize', 'helpText', 'normalizeCalcSteps',
  'helpLeaksAnswer', 'normalizeGuideSteps', 'checkHelpStep', 'publicHelpStep', 'helpShownAnswer', 'advanceHelp', 'applyHelpVariant']);
const R = loadFromSource('supabase/functions/grade-exam/index.ts', ['HELP_CAP', 'applyHelp', 'computeFinalGrade', 'computeNetSummary', 'computeExamGrade']);
const A = loadFromSource('supabase/functions/exam-appeal/index.ts', ['APPEALABLE_TYPES', 'appealEligibility', 'computeFinalGrade', 'computeNetSummary', 'computeExamGrade', 'applyAppealOutcome']);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

const CALC = { id: 3, type: 'calculation', question: '25.000 TL %4 faizle 3 yıl. Bileşik tutar?', template: '{P} TL %{r*100} faizle {n} yıl. Bileşik tutar?', formula: 'P*(1+r)^n', variables: { P: 25000, r: 0.04, n: 3 }, correct_answer: 28121.6, units: 'TL', verified: true };

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

test('hesap sorusu mu: formül, değişken ve tutan cevap gerekir', () => {
  assert.equal(G.helpIsCalc(CALC), true);
  assert.equal(G.helpIsCalc({ ...CALC, correct_answer: 30000 }), false, 'cevap formülle tutmuyor');
  assert.equal(G.helpIsCalc({ ...CALC, formula: '' }), false);
  assert.equal(G.helpIsCalc({ ...CALC, type: 'multiple_choice' }), false);
  assert.equal(G.helpIsCalc({ ...CALC, chart: { title: 'x' } }), false);
});

test('hesap adımları: değer kodla, geçersiz/tekrar/cevaba eşit adım atılır, son adım cevap', () => {
  const raw = [
    { prompt: 'Büyüme çarpanı (1 + r) kaç?', expr: '1 + r', unit: '' },
    { prompt: 'Bu çarpanın 3. kuvveti kaç?', expr: '(1+r)^n' },
    { prompt: 'Anapara kaç?', expr: 'P' },                      // girdiyi tekrar eder
    { prompt: 'Bozuk', expr: 'P * foo(2)' },                    // geçersiz
    { prompt: 'Tekrar', expr: '(1 + r) ^ n' },                  // aynı değer
    { prompt: 'Cevabın kendisi', expr: 'P*(1+r)^n' },           // son adımla aynı
    { prompt: 'Sabit', expr: '12' }
  ];
  const st = G.normalizeCalcSteps(raw, CALC, 'tr');
  assert.equal(st.length, 3);
  assert.deepEqual(st.map(s => s.answer), [1.04, 1.124864, 28121.6]);
  assert.equal(st[0].kind, 'number');
  assert.equal(st[1].explain, '(1+0,04)^3 = 1,124864');
  assert.match(st[2].prompt, /Son adım/);
  assert.equal(st[2].unit, 'TL');
  assert.equal(st[2].hint, '25.000×(1+0,04)^3', 'ipucu sorunun sayılarıyla');
  // canlı test 30.10: ham değişken adı adım metninde kalmaz
  const loan = { type: 'calculation', question: 'Kredi', formula: 'principal*annual_rate/1200', variables: { principal: 100000, annual_rate: 8 }, correct_answer: 666.6667 };
  const ls = G.normalizeCalcSteps([{ prompt: 'Aylık faiz oranı r = annual_rate/100/12 kaç?', expr: 'annual_rate/100/12' }], loan, 'tr');
  assert.equal(ls[0].prompt, 'Aylık faiz oranı r = 8/100/12 kaç?');
  assert.equal(ls[0].hint, '8/100/12');
  assert.equal(G.helpHumanize('Net kar marjı: kar / satis kaç?', { kar: 12, satis: 100 }, 'tr'), 'Net kar marjı: 12 / 100 kaç?', 'işlem dışındaki kelime kalır');
  assert.equal(G.normalizeCalcSteps([{ prompt: 'x', expr: 'P' }], CALC, 'tr'), null, 'ara adım yoksa yönlendirici yola düşülür');
  assert.ok(G.normalizeCalcSteps(Array.from({ length: 8 }, (_, i) => ({ prompt: 's' + i, expr: `P*${i + 2}` })), CALC, 'tr').length <= G.HELP_MAX_STEPS);
});

test('yönlendirici adımlar: cevabı ele veren atılır, karışık şıkta doğru yer izlenir', () => {
  const q = { type: 'fill_blank', question: 'Talep eğrisinin sağa kaymasına ____ denir.', correct_answer: 'talep artışı', accepted_answers: ['talepte artış'] };
  const raw = [
    { prompt: 'Fiyat dışındaki bir etken değişince ne olur?', options: ['Eğri kayar', 'Eğri üzerinde hareket', 'Hiçbir şey'], answer_index: 0, hint: 'Fiyat sabit.', explain: 'Fiyat dışı etken eğriyi kaydırır.' },
    { prompt: 'Bu kaymanın adı ne?', options: ['talep artışı', 'arz artışı', 'denge'], answer_index: 0 },             // cevabı ele veriyor
    { prompt: 'Sağa kayma miktarı nasıl değişir?', options: ['Her fiyatta artar', 'Azalır', 'Aynı kalır'], answer_index: 0 },
    { prompt: 'Eksik şık', options: ['tek'], answer_index: 0 }
  ];
  const st = G.normalizeGuideSteps(raw, q, seq([0.9, 0.1, 0.5, 0.7]));
  assert.equal(st.length, 2);
  for (const [i, s] of st.entries()) {
    assert.equal(s.kind, 'choice');
    assert.equal(s.options[s.answer], raw[i === 0 ? 0 : 2].options[0]);
  }
  assert.equal(G.normalizeGuideSteps(raw.slice(1, 2), q), null, 'en az iki adım');
  assert.equal(G.helpLeaksAnswer('Cevap 28.121,6 TL olur', CALC), true, 'sayısal cevap da sızıntı');
});

test('adım denetimi: sayı yazımları, yüzde ve şık', () => {
  const s = { kind: 'number', answer: 0.004167 };
  for (const ok of ['0,004167', '0.00417', 'i = 0,004167', '0.4167%']) assert.equal(G.checkHelpStep(s, ok), true, ok);
  for (const no of ['0,005', '', 'bilmiyorum', '4167']) assert.equal(G.checkHelpStep(s, no), false, no);
  assert.equal(G.checkHelpStep({ kind: 'number', answer: 28121.6 }, '28.121,6'), true);
  assert.equal(G.checkHelpStep({ kind: 'number', answer: 28121.6 }, '28,121.60'), true);
  assert.equal(G.checkHelpStep({ kind: 'choice', answer: 2, options: ['a', 'b', 'c'] }, '2'), true);
  assert.equal(G.checkHelpStep({ kind: 'choice', answer: 2, options: ['a', 'b', 'c'] }, '1'), false);
});

test('ilerleme: yanlışta ipucu, ikinci yanlışta doğrusu ve geçiş; tarayıcıya cevap gitmez', () => {
  const steps = G.normalizeCalcSteps([{ prompt: '(1 + r) kaç?', expr: '1+r' }], CALC, 'tr');
  let plan = { kind: 'calc', mode: 'variant', steps, cur: 0, tries: 0, log: [] };
  const pub = G.publicHelpStep(plan);
  assert.equal(pub.answer, undefined); assert.equal(pub.hint, undefined); assert.equal(pub.total, 2);
  let r = G.advanceHelp(plan, 0, '2', 'tr');
  assert.deepEqual([r.reply.correct, r.reply.revealed, r.plan.cur, r.plan.tries], [false, undefined, 0, 1]);
  assert.equal(r.reply.hint, '1+0,04');
  assert.equal(plan.tries, 0, 'girdi planı değişmez');
  r = G.advanceHelp(r.plan, 0, '3', 'tr');
  assert.deepEqual([r.reply.correct, r.reply.revealed, r.plan.cur, r.reply.answer], [false, true, 1, '1,04']);
  assert.equal(r.reply.step.n, 1);
  assert.equal(G.advanceHelp(r.plan, 0, '1,04', 'tr').reply.error, 'step_mismatch');
  r = G.advanceHelp(r.plan, 1, '28121,6', 'tr');
  assert.deepEqual([r.reply.correct, r.reply.done, r.reply.step], [true, true, null]);
  assert.equal(r.reply.answer, '28.121,6 TL');
  assert.deepEqual(r.plan.log.map(x => x.ok), [false, true]);
});

test('yeni sayılar: eski sayılara bağlı alanlar atılır, şablon ve formül kalır', () => {
  const key = { correct_answer: 28121.6, variables: CALC.variables, template: CALC.template, formula: CALC.formula, solution_steps: ['x'], explanation: 'e', common_errors: [{}], hint: 'h', tolerance_percent: 1 };
  const out = G.applyHelpVariant(key, { text: 'yeni', variables: { P: 20000, r: 0.05, n: 2 }, answer: 22050 });
  assert.deepEqual(out.variables, { P: 20000, r: 0.05, n: 2 });
  assert.equal(out.correct_answer, 22050); assert.equal(out.varied, true);
  for (const k of ['solution_steps', 'explanation', 'common_errors', 'hint']) assert.equal(out[k], undefined, k);
  assert.equal(out.template, CALC.template); assert.equal(out.tolerance_percent, 1);
});

test('puan: tavan, yeni sayılarla tam puan, yarım kalan yeni sayı tavanlı', () => {
  const qs = [{ id: 1, help: { mode: 'cap', status: 'done' } }, { id: 2, help: { mode: 'variant', status: 'done' } }, { id: 3, help: { mode: 'variant', status: 'started' } }, { id: 4 }, { id: 5, help: { mode: 'cap', status: 'started' } }];
  const rs = [{ question_id: 1, score: 90 }, { question_id: 2, score: 100 }, { question_id: 3, score: 100 }, { question_id: 4, score: 100 }, { question_id: 5, score: 30 }];
  R.applyHelp(rs, qs);
  assert.deepEqual(rs.map(r => r.score), [50, 100, 50, 100, 30]);
  assert.deepEqual([rs[0].help_raw_score, rs[0].help_cap, rs[1].help_variant, rs[3].help_used, rs[4].help_raw_score], [90, 50, true, undefined, undefined]);
  assert.equal(R.computeExamGrade(rs, null), 66);
});

test('net: yardımla doğru çoktan seçmeli tavanı kadar doğru', () => {
  const rs = [
    { type: 'multiple_choice', student_answer: 'a', is_correct: true, score: 50, help_cap: 50 },
    { type: 'multiple_choice', student_answer: 'b', is_correct: true, score: 100 },
    { type: 'multiple_choice', student_answer: 'c', is_correct: false, score: 0 }
  ];
  for (const M of [R, A]) {
    const s = M.computeNetSummary(rs, { negative_marking: true, wrong_per_correct: 4 });
    assert.deepEqual([s.correct, s.wrong, s.net], [1.5, 1, 1.25]);
  }
});

test('itiraz: tavana ulaşmış soru itiraz edilemez, yeniden puan tavanı aşamaz', () => {
  assert.equal(A.appealEligibility({ type: 'open_ended', score: 50, help_cap: 50 }), 'help_capped');
  assert.equal(A.appealEligibility({ type: 'open_ended', score: 30, help_cap: 50 }), null);
  const o = A.applyAppealOutcome([{ question_id: 1, type: 'open_ended', score: 30, help_cap: 50 }], 0, { regradeScore: 90, feedback: 'f', rubricResults: null, note: '' }, 'T');
  assert.deepEqual([o.accepted, o.finalScore], [true, 50]);
});

test('ustalık: yardımla gelen doğru zayıf kanıt (iki kopya aynı kural)', () => {
  const ex = (help) => [{ completed_at: '2026-10-20T10:00:00Z', scoring: { option_count: 4 }, question_results: [1, 2, 3].map(i => ({ question_id: i, type: 'calculation', concept: 'Faiz', score: 100, ...(help ? { help_used: true } : {}) })) }];
  const now = { now: Date.parse('2026-10-21T10:00:00Z') };
  const plain = E.conceptMastery(ex(false), now)[0], helped = E.conceptMastery(ex(true), now)[0];
  assert.ok(helped.p < plain.p, `${helped.p} < ${plain.p}`);
  assert.match(readSource(GEN), /r\.hint_used \|\| r\.help_used \? 0\.5 : 1/);
});

test('ekran: yardım yalnızca alıştırmada; adım cevapları tarayıcıya gelmez', () => {
  const ink = readSource('js/acadex-ink.js');
  assert.match(ink, /var helpB = EXM\.is_simulation \? '' :/);
  assert.match(ink, /help: Object\.assign\(\{ examId: EXM && EXM\.id \}, body\)/);
  const gen = readSource(GEN);
  assert.match(gen, /if \(exam\.is_simulation\) return out\(\{ error: T\('Gerçek sınav provasında adım adım yardım yok\./);
  assert.match(gen, /reqBody\.help && typeof reqBody\.help === 'object'\) return await handleExamHelp/);
});

summary();
