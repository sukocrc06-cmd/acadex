/* ==========================================================================
   ACADEX — KODLA DOĞRULANAN HESAP TESTLERİ (tests/exam-calc.js)

   Faz 3a (22.10.2026). Groq'a ve Supabase'e çıkmadan test eder:
     - güvenli ifade hesaplayıcı: generate-exam ve grade-exam kopyaları
       BİREBİR aynı; tarayıcı kopyası (js/exam-engine.js) aynı vektörlerle
       aynı sonucu veriyor; eval yok, kaçış denemeleri NaN döner
     - generate-exam verifyCalculation: cevap formülden, çelişen / formülsüz
       / gizli girdili soru atılır, şablon ve tipik hatalar temizlenir
     - grade-exam: tipik hata eşleşmesi, sonuç kâğıdına giden pratik verisi
     - tarayıcı: benzer soru üretimi ve cevap kontrolü

   Çalıştırma:  node tests/exam-calc.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const GEN_PATH = 'supabase/functions/generate-exam/index.ts';
const GRADE_PATH = 'supabase/functions/grade-exam/index.ts';
const EXPR = ['EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression', 'sanitizeVariables'];

const G = loadFromSource(GEN_PATH, ['calcFormulaKey', 
  ...EXPR, 'normalizeAnswerText', 'parseLooseNumber', 'answerNumber', 'cleanText',
  'numberReadings', 'sameNumber', 'withinTolerance', 'templateMatches', 'normalizeFormula', 'DERIVED_FACTORS', 'TEMPLATE_DISPLAY_OPS', 'verifyCalculation',
  'MATH_INPUT_MAX', 'normalizeMathInput', 'STEP_KINDS', 'verifyLinearEquation', 'STANDARD_CONSTANTS', 'referencesName', 'inlineName', 'chartNumbers']);
const R = loadFromSource(GRADE_PATH, [...EXPR, 'parseLooseNumber', 'answerNumber', 'matchCommonError', 'teachingFields']);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

const { test, summary } = makeRunner();

test('hesaplayici generate-exam ve grade-exam te birebir ayni', () => {
  const toJs = p => require('typescript').transpileModule(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'), {
    compilerOptions: { target: 99, module: 99 }
  }).outputText;
  const a = toJs(GEN_PATH), b = toJs(GRADE_PATH);
  for (const n of EXPR) assert.equal(sliceDeclaration(a, n), sliceDeclaration(b, n), n);
});

// ---------------------------------------------------------------------------
// Hesaplayıcı: üç kopya da aynı sonucu vermeli
// ---------------------------------------------------------------------------
const LOAN = 'P * (r/100/12) / (1 - (1 + r/100/12)^(-n))';
const VECTORS = [
  ['1 + 2 * 3', {}, 7],
  ['(1 + 2) * 3', {}, 9],
  ['2 ^ 3 ^ 2', {}, 512],
  ['-2^2', {}, -4],
  ['2 ** 10', {}, 1024],
  ['10 / 4 - 1', {}, 1.5],
  ['--3', {}, 3],
  ['2^-1', {}, 0.5],
  ['sqrt(16) + abs(-3) + ln(e) + log10(1000)', {}, 4 + 3 + 1 + 3],
  ['min(3, 1, 2) + max(4, 9) + pow(2, 3) + round(2.345, 2) + floor(2.9) + ceil(2.1)', {}, 1 + 9 + 8 + 2.35 + 2 + 3],
  ['round(pi, 4)', {}, 3.1416],
  ['P * (1 + r/100)^n', { P: 1000, r: 10, n: 2 }, 1210],
  [LOAN, { P: 1000000, r: 5, n: 360 }, 5368.2162],
  ['CF1/(1+k) + CF2/(1+k)^2 - I0', { CF1: 500, CF2: 600, k: 0.1, I0: 900 }, 500 / 1.1 + 600 / 1.21 - 900],
  ['1.5e3 + .5', {}, 1500.5],
  // Faz 3a.1: finans fonksiyonları (Excel değerleri, işaretsiz)
  ['pmt(r/12, n, P)', { r: 0.06, n: 60, P: 100000 }, 1933.2802],
  ['PMT(0.06/12, 5*12, -100000)', {}, 1933.2802],
  ['pmt(0, 10, 1000)', {}, 100],
  ['pv(0.08, 5, 1000)', {}, 3992.7101],
  ['fv(0.05, 10, 0, 1000)', {}, 1628.8946],
  ['fv(0.05, 3, 100)', {}, 315.25],
  ['npv(0.1, 500, 600) - 900', {}, 500 / 1.1 + 600 / 1.21 - 900],
  ['PV * 2', { PV: 3 }, 6]
];
const BAD = [
  ['', {}], ['2x', { x: 3 }], ['2 * y', {}], ['(1 + 2', {}], ['1 + 2)', {}], ['1 / 0', {}], ['sqrt(-1)', {}],
  ['foo(2)', {}], ['min()', {}], ['pow(2)', {}], ['pmt(1, 2)', {}], ['npv(0.1)', {}], ['sqrt(1, 2)', {}], ['1,2', {}], ['3 3', {}],
  ['process.exit()', {}], ['constructor', {}], ['__proto__', {}], ['x.constructor', { x: 1 }],
  ['alert(1)', {}], ['"a"', {}], ['1; 2', {}], ['a[0]', { a: 1 }], ['x = 2', { x: 1 }],
  ['1 + '.repeat(200) + '1', {}], ['('.repeat(60) + '1' + ')'.repeat(60), {}]
];

for (const [name, impl] of [['sunucu (TS)', G.evaluateExpression], ['tarayici (JS)', E.evaluateExpression]]) {
  test(`${name}: dogru hesaplar`, () => {
    for (const [src, vars, want] of VECTORS) {
      const got = impl(src, vars);
      assert.ok(Math.abs(got - want) < 1e-3 * Math.max(1, Math.abs(want)), `${src} = ${got}, beklenen ${want}`);
    }
  });
  test(`${name}: gecersiz, sonsuz ve kacis denemeleri NaN`, () => {
    for (const [src, vars] of BAD) assert.ok(Number.isNaN(impl(src, vars)), `NaN bekleniyordu: ${src.slice(0, 40)}`);
  });
}

test('sanitizeVariables: gecersiz ad, fonksiyon/sabit adi ve sayi olmayan deger atilir', () => {
  const v = G.sanitizeVariables({ P: 1000, r: '5', 'bad name': 3, pi: 3, e: 1, x: 'abc', n: Infinity, k_2: 0.1, constructor: 5 });
  assert.deepEqual(v, { P: 1000, r: 5, k_2: 0.1, constructor: 5 });
  assert.deepEqual(G.sanitizeVariables({ PV: 10, sqrt: 2 }), { PV: 10, sqrt: 2 }, 'fonksiyon adi degisken olabilir');
  assert.deepEqual(G.sanitizeVariables({ number_of_periods: 240, ['x'.repeat(33)]: 1 }), { number_of_periods: 240 }, 'uzun ad (32 ye kadar) gecer');
  assert.ok(Math.abs(G.evaluateExpression('pmt(interest_rate/12/100, number_of_periods, present_value)', G.sanitizeVariables({ interest_rate: 4, number_of_periods: 180, present_value: 500000 })) - 3698.44) < 0.01, 'canli testteki formul');
  assert.deepEqual(E.sanitizeVariables({ number_of_periods: 240 }), { number_of_periods: 240 });
  assert.equal(G.evaluateExpression('sqrt(sqrt) + PV', { sqrt: 16, PV: 1 }), 5, 'ad( fonksiyon, ad degisken');
  assert.equal(G.evaluateExpression('constructor + 1', v), 6, 'kendi alani olarak verilen ad calisir, prototipe ulasilmaz');
  assert.deepEqual(G.sanitizeVariables(null), {});
  assert.deepEqual(G.sanitizeVariables([1, 2]), {});
  assert.deepEqual(E.sanitizeVariables({ P: 1000, pi: 2, PV: 4 }), { P: 1000, PV: 4 });
});

// ---------------------------------------------------------------------------
// generate-exam: verifyCalculation
// ---------------------------------------------------------------------------
const loanQ = (extra = {}) => ({
  type: 'calculation',
  question: '1.000.000 TL konut kredisi yıllık %5 faizle 360 ayda ödenecek. Aylık taksit kaç TL?',
  correct_answer: 5368.22, tolerance_percent: 1, units: 'TL',
  variables: { P: 1000000, r: 5, n: 360 }, formula: LOAN,
  template: '{P} TL konut kredisi yıllık %{r} faizle {n} ayda ödenecek. Aylık taksit kaç TL?',
  common_errors: [
    { formula: 'P * (r/100) / (1 - (1 + r/100)^(-n))', message: 'Yıllık faizi 12\'ye bölmeyi unuttun.' },
    { formula: 'P / n', message: 'Faizi hiç hesaba katmadın.' },
    { formula: LOAN, message: 'Doğru cevapla aynı — atılmalı.' },
    { formula: 'P * bozuk(', message: 'Hesaplanamaz — atılmalı.' }
  ],
  ...extra
});

test('dogru soru: cevap formulden, sablon ve tipik hatalar temiz, dogrulandi isareti', () => {
  const q = loanQ();
  assert.deepEqual(G.verifyCalculation(q), { ok: true });
  assert.equal(q.correct_answer, 5368.2162);
  assert.equal(q.verified, true);
  assert.ok(q.template.includes('{P}'));
  assert.deepEqual(q.common_errors.map(c => c.message), ['Yıllık faizi 12\'ye bölmeyi unuttun.', 'Faizi hiç hesaba katmadın.']);
});

test('modelin cevabi kodun hesabiyla celisirse soru atilir', () => {
  assert.equal(G.verifyCalculation(loanQ({ correct_answer: 4200 })).reason, 'calc_mismatch');
  assert.equal(G.verifyCalculation(loanQ({ correct_answer: '5.368,22' })).ok, true, 'Turkce yazim ayni sayi');
  assert.equal(G.verifyCalculation(loanQ({ correct_answer: 5400, tolerance_percent: 0.1 })).ok, true, 'yuvarlama farki icin en az %1 pay');
});

test('formul yok, hesaplanamiyor ya da girdi soru metninde yok → atilir', () => {
  assert.equal(G.verifyCalculation(loanQ({ formula: '' })).reason, 'calc_no_formula');
  assert.equal(G.verifyCalculation(loanQ({ variables: {} })).reason, 'calc_no_formula');
  assert.equal(G.verifyCalculation(loanQ({ formula: 'XNPV(r, CF, dates)' })).reason, 'calc_formula_invalid');
  assert.equal(G.verifyCalculation(loanQ({ variables: { P: 1000000, r: 7, n: 360 }, correct_answer: null })).reason, 'calc_var_not_in_text', '7 metinde yok');
});

test('turetilmis girdi (%5 → 0.05, 30 yil → 360 ay) kabul; 360 standart sabit oldugundan sablon kapanir', () => {
  const q = loanQ({ question: '1.000.000 TL konut kredisi yıllık %5 faizle 30 yılda ödenecek. Aylık taksit kaç TL?', variables: { P: 1000000, r: 0.05, n: 360 }, formula: 'pmt(r/12, n, P)', template: '{P} TL konut kredisi yıllık %{r} faizle {n} yılda ödenecek. Aylık taksit kaç TL?' });
  assert.deepEqual(G.verifyCalculation(q), { ok: true });
  assert.equal(q.correct_answer, 5368.2162);
  assert.equal(q.template, null, 'n=360 formule gomuldu; sablondaki {n} karsiliksiz');
});

test('turetilmis girdi (%5 → 0.05, 25 yil → 300 ay): sablon gosterim carpaniyla korunur, alistirma yuvarlak sayilarla', () => {
  const q = loanQ({ question: '1.000.000 TL konut kredisi yıllık %5 faizle 25 yılda ödenecek. Aylık taksit kaç TL?', variables: { P: 1000000, r: 0.05, n: 300 }, correct_answer: null, formula: 'pmt(r/12, n, P)', template: '{P} TL konut kredisi yıllık %{r} faizle {n} yılda ödenecek. Aylık taksit kaç TL?' });
  assert.deepEqual(G.verifyCalculation(q), { ok: true });
  assert.equal(q.template, '{P} TL konut kredisi yıllık %{r*100} faizle {n/12} yılda ödenecek. Aylık taksit kaç TL?', 'turetilmis degisken carpanla');
  // alistirma: metindeki sayi degisir (%5 → yuvarlak yuzde, 30 → tam yil), degisken ona gore
  let i = 0; const seq = [0.1, 0.9, 0.5, 0.3];
  const v = E.makeVariant({ template: q.template, variables: q.variables, formula: q.formula }, 'tr', () => seq[i++ % seq.length]);
  assert.ok(v, 'alistirma uretildi');
  const m = v.text.match(/%(\d+) faizle (\d+) yılda/);
  assert.ok(m, v.text);
  assert.equal(v.variables.r, Number(m[1]) / 100);
  assert.equal(v.variables.n, Number(m[2]) * 12);
  assert.ok(Math.abs(v.answer - E.evaluateExpression(q.formula, v.variables)) < 0.01);
});

test('normalizeFormula: "=", "PMT =", ×÷− isaretleri, kare', () => {
  assert.equal(G.normalizeFormula('= P × r ÷ 2 − 1'), 'P * r / 2 - 1');
  assert.equal(G.normalizeFormula('PMT = pmt(r/12, n, P)'), 'pmt(r/12, n, P)');
  assert.equal(G.normalizeFormula('x²+y³'), 'x^2+y^3');
  assert.equal(G.normalizeFormula('a = b = c'), 'a = b = c', 'iki esittir: dokunulmaz, hesaplayici reddeder');
  assert.equal(G.normalizeFormula(null), '');
  const q = loanQ({ formula: 'Taksit = ' + LOAN.replace(/\*/g, '×') });
  assert.equal(G.verifyCalculation(q).ok, true);
  assert.equal(q.formula, LOAN.replace(/\*/g, '*'));
});

test('sayilarin Turkce ve Ingilizce yazimi tanınır', () => {
  assert.deepEqual(G.numberReadings('1.000.000').includes(1000000), true);
  assert.deepEqual(G.numberReadings('1,000,000').includes(1000000), true);
  assert.deepEqual(G.numberReadings('0,05').includes(0.05), true);
  assert.deepEqual(G.numberReadings('1.000').sort((a, b) => a - b), [1, 1000], '1.000 iki turlu okunabilir');
});

test('sablon soruyla tutarsizsa yalnizca sablon dusurulur, soru kalir', () => {
  const q1 = loanQ({ template: '{P} TL kredi, %{r}, {n} ay.' });
  assert.equal(G.verifyCalculation(q1).ok, true);
  assert.equal(q1.template, null);
  const q2 = loanQ({ template: '{P} TL konut kredisi yıllık %{r} faizle 360 ayda ödenecek. Aylık taksit kaç TL?' });
  G.verifyCalculation(q2);
  assert.equal(q2.template, null, 'n yer tutucusu eksik');
  assert.equal(G.templateMatches('{a} + {b} kaç eder?', '3 + 4 kaç eder?', ['a', 'b']), true);
});

// ---------------------------------------------------------------------------
// grade-exam
// ---------------------------------------------------------------------------
test('tipik hata eslesmesi: faizi 12 ye bolmeyi unutan ogrenci', () => {
  const q = loanQ(); G.verifyCalculation(q);
  const wrongAnnual = G.evaluateExpression('P * (r/100) / (1 - (1 + r/100)^(-n))', q.variables);
  assert.equal(R.matchCommonError(wrongAnnual.toFixed(2), q), 'Yıllık faizi 12\'ye bölmeyi unuttun.');
  assert.equal(R.matchCommonError('2777,78', q), 'Faizi hiç hesaba katmadın.');
  assert.equal(R.matchCommonError('9999', q), null);
  assert.equal(R.matchCommonError('', q), null);
  assert.equal(R.matchCommonError('5368', { ...q, common_errors: null }), null);
});

test('sonuc kagidina pratik verisi yalnizca dogrulanmis hesap sorusunda gider', () => {
  const q = loanQ(); G.verifyCalculation(q);
  const t = R.teachingFields(q);
  assert.equal(t.verified, true);
  assert.deepEqual(Object.keys(t.practice).sort(), ['formula', 'template', 'tolerance_percent', 'units', 'variables']);
  assert.equal(R.teachingFields({ ...q, verified: false }).practice, undefined);
  assert.equal(R.teachingFields({ ...q, template: null }).practice, undefined);
  assert.equal(R.teachingFields({ type: 'open_ended', verified: true }).verified, undefined);
});

// ---------------------------------------------------------------------------
// Tarayıcı: benzer soru
// ---------------------------------------------------------------------------
const seq = (seed) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

test('makeVariant: yeni sayilar, cevap formulden, sayilar yuvarlak ve isaretli', () => {
  const q = loanQ(); G.verifyCalculation(q);
  const t = R.teachingFields(q);
  const rnd = seq(7);
  for (let i = 0; i < 25; i++) {
    const v = E.makeVariant(t.practice, 'tr', rnd);
    assert.ok(v, 'varyant uretilemedi');
    assert.notDeepEqual(v.variables, q.variables);
    assert.ok(Math.abs(v.answer - E.evaluateExpression(LOAN, v.variables)) < 1e-3);
    assert.ok(v.variables.P >= 600000 && v.variables.P <= 1400000 && v.variables.P % 10000 === 0, 'P: ' + v.variables.P);
    assert.ok(Number.isInteger(v.variables.n) && v.variables.n > 0);
    assert.ok(!/\{/.test(v.text), 'yer tutucu kalmamali');
  }
});

test('makeVariant: ondalikli degisken ondalik basamagini korur; uretilemezse null', () => {
  const p = { template: 'Oran {k} ise {A} TL kaç eder?', variables: { k: 0.25, A: 800 }, formula: 'A * k' };
  const v = E.makeVariant(p, 'tr', seq(3));
  assert.ok(String(v.variables.k).split('.')[1].length <= 2);
  assert.match(v.text, /^Oran 0,\d+ ise \d{3}(?:\.\d{3})? TL kaç eder\?$/);
  assert.equal(E.makeVariant({ template: 'x', variables: { a: 1 }, formula: '1/(a-a)' }, 'tr', seq(1)), null);
  assert.equal(E.makeVariant(null, 'tr'), null);
  assert.equal(E.renderTemplate('{a} ve {b}', { a: 1234.5 }, 'en'), '1,234.5 ve {b}');
});

test('checkNumericAnswer: Turkce yazim, tolerans, bos', () => {
  assert.deepEqual(E.checkNumericAnswer('5.368,20', 5368.2162, 1).ok, true);
  assert.deepEqual(E.checkNumericAnswer('5000', 5368.2162, 1).ok, false);
  assert.deepEqual(E.checkNumericAnswer('', 5368.2162, 1).filled, false);
  assert.deepEqual(E.checkNumericAnswer('0,01', 0, 2).ok, true);
});

// ---------------------------------------------------------------------------
// Faz 3c canlı test (23.10.2026): kullanılmayan değişken, standart sabit
// ---------------------------------------------------------------------------
test('formulde gecmeyen degisken atilir (A1, A2 gibi fazladan hucreler)', () => {
  const q = { type: 'calculation', question: 'A3=20, A4=25 ve A5=30 ise =SUM(A3:A5) kaçtır?', correct_answer: 75,
    variables: { A1: 10, A2: 15, A3: 20, A4: 25, A5: 30 }, formula: 'A3 + A4 + A5', template: 'A3={A3}, A4={A4} ve A5={A5} ise =SUM(A3:A5) kaçtır?' };
  assert.deepEqual(G.verifyCalculation(q), { ok: true });
  assert.deepEqual(Object.keys(q.variables), ['A3', 'A4', 'A5']);
});

test('metinde yazmayan standart sabit (aylik → 12) formule gomulur, sablon korunur', () => {
  const q = { type: 'calculation', question: '500.000 TL kredi, yıllık %4 faiz, 20 yıl vade. Aylık taksit kaç TL?', correct_answer: 3029.9,
    variables: { PV: 500000, interest_rate: 0.04, periods_per_year: 12, years: 20 },
    formula: 'PV * (interest_rate/periods_per_year) / (1 - (1 + interest_rate/periods_per_year)^(-periods_per_year*years))',
    template: '{PV} TL kredi, yıllık %{interest_rate} faiz, {years} yıl vade. Aylık taksit kaç TL?',
    common_errors: [{ formula: 'PV * interest_rate / (1 - (1 + interest_rate)^(-years))', message: 'Yıllık faizi aya çevirmedin.' }] };
  assert.deepEqual(G.verifyCalculation(q), { ok: true }, 'calc_var_not_in_text degil');
  assert.ok(!('periods_per_year' in q.variables));
  assert.match(q.formula, /\(12\)/);
  assert.ok(Math.abs(q.correct_answer - 3029.9) < 0.1);
  assert.equal(q.template, '{PV} TL kredi, yıllık %{interest_rate*100} faiz, {years} yıl vade. Aylık taksit kaç TL?', '0.04 metinde %4: carpanla');
  assert.equal(E.renderTemplate(q.template, { PV: 400000, interest_rate: 0.035, years: 15 }, 'tr'), '400.000 TL kredi, yıllık %3,5 faiz, 15 yıl vade. Aylık taksit kaç TL?');
  const q2 = { ...q, variables: { PV: 500000, r: 4, periods_per_year: 12, years: 20 }, formula: 'PV * (r/100/periods_per_year) / (1 - (1 + r/100/periods_per_year)^(-periods_per_year*years))',
    template: '{PV} TL kredi, yıllık %{r} faiz, {years} yıl vade. Aylık taksit kaç TL?', common_errors: null };
  assert.deepEqual(G.verifyCalculation(q2), { ok: true });
  assert.ok(q2.template, 'tum degiskenler metinde: sablon korunur');
  assert.equal(G.inlineName('pmt(r, n, PV) + PV*2', 'PV', 5), 'pmt(r, n, (5)) + (5)*2');
  assert.equal(G.inlineName('pv(1,2,3)', 'pv', 5), 'pv(1,2,3)', 'fonksiyon cagrisi dokunulmaz');
});

test('tarihten turetilmis yil kesri (0,5) hala gizli girdi sayilir', () => {
  const q = { type: 'calculation', question: '01.01.2024 -10.000 TL, 01.07.2024 3.000 TL; %6 iskonto ile XNPV?', correct_answer: -7087,
    variables: { r: 0.06, cf1: -10000, cf2: 3000, t2: 0.4959 }, formula: 'cf1 + cf2/(1+r)^t2' };
  assert.equal(G.verifyCalculation(q).reason, 'calc_var_not_in_text');
});

test('calcFormulaKey: ayni formulu farkli sayilarla soran hesap sorusu tekrar sayilir (canli test 26.10.2026)', () => {
  const a = { type: 'calculation', formula: '50 - 4*q', variables: { q: 5 } };
  const b = { type: 'calculation', formula: '50-4*q', variables: { q: 8 } };
  const c = { type: 'calculation', formula: '3*q^2 - 12*q + 15', variables: { q: 5 } };
  assert.equal(G.calcFormulaKey(a), G.calcFormulaKey(b));
  assert.notEqual(G.calcFormulaKey(a), G.calcFormulaKey(c));
  assert.equal(G.calcFormulaKey({ type: 'multiple_choice', formula: 'x' }), null);
  assert.equal(G.calcFormulaKey({ type: 'calculation', formula: '' }), null, 'dogrulanmamis (formulsuz) soru denetlenmez');
});

summary();
