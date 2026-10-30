/* ==========================================================================
   ACADEX — CEBİRSEL İFADE TESTLERİ (tests/exam-expression.js)

   Faz 3b (23.10.2026): öğrencinin yazdığı ifade kodla açılır ve sabit örnek
   noktalarda referansla karşılaştırılır. Groq'a ve Supabase'e çıkmadan:
     - ortak blok generate-exam ve grade-exam'de birebir aynı
     - tarayıcı kopyası (js/exam-engine.js) aynı yazımları aynı açar
     - denklik, sabit farkı, biçim (çarpan / açılmış / sade)
     - generate-exam: ifade sorusunun doğrulanması
     - grade-exam: puan ve geri bildirim
     - tarayıcı: TeX önizleme

   Çalıştırma:  node tests/exam-expression.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const GEN_PATH = 'supabase/functions/generate-exam/index.ts';
const GRADE_PATH = 'supabase/functions/grade-exam/index.ts';
const EXPR = ['EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression'];
const SHARED = ['MATH_INPUT_MAX', 'EXPR_SAMPLE_VALUES', 'EXPR_MIN_VALID_POINTS', 'EXPR_FORMS', 'normalizeMathInput',
  'exprSamplePoints', 'expressionsEquivalent', 'hasTopLevelSum', 'isExpandedForm', 'exprTokenCount', 'checkExpressionForm'];

const G = loadFromSource(GEN_PATH, [
  ...EXPR, ...SHARED, 'TRUE_FALSE_OPTIONS', 'normalizeAnswerText', 'parseLooseNumber', 'PLACEHOLDER_ANSWERS', 'isPlaceholderAnswer', 'cleanText',
  'EXPLANATION_MAX_CHARS', 'RATIONALE_MAX_CHARS', 'RUBRIC_MIN_ITEMS', 'RUBRIC_MAX_ITEMS', 'normalizeOptionRationales', 'normalizeRubric',
  'sanitizeVariables', 'numberReadings', 'sameNumber', 'withinTolerance', 'templateMatches', 'normalizeFormula', 'DERIVED_FACTORS', 'TEMPLATE_DISPLAY_OPS', 'verifyCalculation', 'stepsConfirmValue',
  'verifyExpression', 'ALGEBRA_SOURCE_CUES', 'sourceTeachesAlgebra', 'repairLatex', 'validateQuestion', 'CALC_PH', 'fillCalcPlaceholders', 'formatNumber', 'tidy', 'allowedTypesFor', 'STANDARD_CONSTANTS', 'referencesName', 'inlineName', 'chartNumbers']);
const R = loadFromSource(GRADE_PATH, [...EXPR, ...SHARED, 'gradeExpression']);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

const { test, summary } = makeRunner();

test('ortak ifade blogu generate-exam ve grade-exam te birebir ayni', () => {
  const toJs = p => require('typescript').transpileModule(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'), {
    compilerOptions: { target: 99, module: 99 }
  }).outputText;
  const a = toJs(GEN_PATH), b = toJs(GRADE_PATH);
  for (const n of [...EXPR, ...SHARED]) assert.equal(sliceDeclaration(a, n), sliceDeclaration(b, n), n);
});

// ---------------------------------------------------------------------------
// Öğrenci yazımı → açık ifade (sunucu ve tarayıcı aynı)
// ---------------------------------------------------------------------------
const XY = ['x', 'y'];
const NORM = [
  ['2x(x+1)', '2*x*(x+1)'],
  ['(x+1)(x-1)', '(x+1)*(x-1)'],
  ['x²+3x', 'x^2+3*x'],
  ['0,5x', '0.5*x'],
  ['xy', 'x*y'],
  ['2pix', '2*pi*x'],
  ['sinx', 'sin(x)'],
  ['Sin(2x)', 'sin(2*x)'],
  ['cos²x', 'cos(x)^2'],
  ['3sin^2x', '3*sin(x)^2'],
  ['√x', 'sqrt(x)'],
  ['√(x+1)', 'sqrt(x+1)'],
  ['x · y', 'x*y'],
  ['x ÷ 2 − 1', 'x/2-1'],
  ['2**x', '2^x'],
  ['e^(2x)', 'e^(2*x)'],
  ['sqrt(x)sqrt(y)', 'sqrt(x)*sqrt(y)'],
  ['[x+1]^2', '(x+1)^2'],
  ['-(x+1)', '-(x+1)'],
  ['ln x', 'ln(x)'],
  ['3 4', '3 4'],
  ['x2', ''],
  ['foo', ''],
  ['sin^2', ''],
  ['x = 2', ''],
  ['', ''],
  ['x'.repeat(201), '']
];

for (const [name, impl] of [['sunucu (TS)', G.normalizeMathInput], ['tarayici (JS)', E.normalizeMathInput]]) {
  test(`${name}: ogrenci yazimi acik ifadeye cevrilir`, () => {
    for (const [src, want] of NORM) assert.equal(impl(src, XY), want, JSON.stringify(src));
  });
}

test('tarayici kopyasi normalizeMathInput u TS ten birebir tasir', () => {
  const ts = require('typescript');
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', GRADE_PATH), 'utf8'), { compilerOptions: { target: 99, module: 99 } }).outputText;
  const want = sliceDeclaration(js, 'normalizeMathInput').replace(/\s+/g, ' ');
  const eng = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam-engine.js'), 'utf8');
  assert.ok(eng.replace(/\s+/g, ' ').includes(want), 'exam-engine.js icindeki kopya farkli');
});

// ---------------------------------------------------------------------------
// Denklik ve biçim
// ---------------------------------------------------------------------------
const eq = (a, b, vars = ['x'], c = false) => G.expressionsEquivalent(G.normalizeMathInput(a, vars), G.normalizeMathInput(b, vars), vars, c);

test('denklik: ayni ifadenin farkli yazimlari esit, farkli ifade degil', () => {
  assert.equal(eq('2x(x+1)', '2x^2+2x'), 'equal');
  assert.equal(eq('(x+1)^2', 'x^2+2x+1'), 'equal');
  assert.equal(eq('(x+1)^2', 'x^2+1'), 'different');
  assert.equal(eq('ln(x^2)', '2ln(x)'), 'equal', 'ornek noktalar pozitif');
  assert.equal(eq('1/x', 'x^-1'), 'equal');
  assert.equal(eq('sin²x+cos²x', '1'), 'equal');
  assert.equal(eq('-x', 'x'), 'different', 'isaret hatasi yakalanir');
  assert.equal(eq('x*y', 'y*x', XY), 'equal');
  assert.equal(eq('x+y', 'x+2y', XY), 'different');
});

test('belirsiz integral: sabit farki kabul, baska fark degil', () => {
  assert.equal(eq('x^3/3+5', 'x^3/3', ['x'], true), 'equal');
  assert.equal(eq('x^3/3+5', 'x^3/3', ['x'], false), 'different');
  assert.equal(eq('x^3/3+x', 'x^3/3', ['x'], true), 'different');
});

test('referans hesaplanamiyorsa invalid; ogrenci tanimsizsa different', () => {
  assert.equal(eq('x', 'sqrt(-1-x)'), 'invalid');
  assert.equal(eq('ln(-x)', 'x'), 'different');
  assert.equal(G.expressionsEquivalent('', 'x', ['x']), 'different');
});

test('bicim: carpanlarina ayrilmis, acilmis, sade', () => {
  assert.equal(G.hasTopLevelSum('(x-1)*(x+1)'), false);
  assert.equal(G.hasTopLevelSum('x^2-1'), true);
  assert.equal(G.hasTopLevelSum('-x*(x+1)'), false, 'bastaki eksi toplam degil');
  assert.equal(G.hasTopLevelSum('x*(-1)'), false);
  assert.equal(G.isExpandedForm('x^2+2*x+1'), true);
  assert.equal(G.isExpandedForm('(x+1)^2'), false);
  assert.equal(G.isExpandedForm('2*(x+1)'), false);
  assert.equal(G.isExpandedForm('1/(x+1)'), true, 'payda serbest');
  assert.equal(G.isExpandedForm('sin(x+1)*2'), true, 'fonksiyon argumani serbest');
  assert.equal(G.checkExpressionForm('x^2-1', 'factored', '(x-1)*(x+1)', ''), false);
  assert.equal(G.checkExpressionForm('(x+1)*(x-1)', 'factored', '(x-1)*(x+1)', ''), true);
  assert.equal(G.checkExpressionForm('x+1', 'simplified', 'x+1', '(x^2-1)/(x-1)'), true);
  assert.equal(G.checkExpressionForm('(x^2-1)/(x-1)', 'simplified', 'x+1', '(x^2-1)/(x-1)'), false, 'verilen ifade aynen');
  assert.equal(G.checkExpressionForm('x*(x+1)/x', 'simplified', 'x+1', ''), false, 'sade degil');
  assert.equal(G.checkExpressionForm('anything', 'any', 'x', ''), true);
});

// ---------------------------------------------------------------------------
// generate-exam
// ---------------------------------------------------------------------------
const exprQ = (extra = {}) => ({
  type: 'expression', question: 'x^2 - 1 ifadesini çarpanlarına ayırınız.', correct_answer: '(x-1)*(x+1)',
  expr_vars: ['x'], form: 'factored', given: 'x^2-1', up_to_constant: false,
  solution_steps: ['İki kare farkı: a^2-b^2 = (a-b)(a+b)'], options: ['a'], tolerance_percent: 2, units: 'TL',
  variables: { P: 1 }, formula: 'P', ...extra
});

test('calculation sinavi ifade sorusuna izin verir; karisik ve test vermez', () => {
  assert.deepEqual(G.allowedTypesFor('calculation', true), ['calculation', 'expression']);
  assert.ok(!G.allowedTypesFor('mixed', true).includes('expression'));
  assert.ok(!G.allowedTypesFor('test', true).includes('expression'));
});

test('dogru ifade sorusu gecer; cevap acik bicimde, hesap alanlari temizlenir', () => {
  const r = G.validateQuestion(exprQ({ correct_answer: '(x-1)(x+1)' }), ['calculation', 'expression'], 'tr');
  assert.equal(r.ok, true, r.reason);
  const q = r.question;
  assert.equal(q.correct_answer, '(x-1)*(x+1)');
  assert.deepEqual(q.expr_vars, ['x']);
  assert.equal(q.form, 'factored');
  assert.equal(q.given, 'x^2-1');
  assert.equal(q.options, null);
  for (const k of ['tolerance_percent', 'units', 'variables', 'formula']) assert.ok(!(k in q), k);
});

test('ifade sorusu: degiskensiz, okunamaz, bicimine uymayan ya da verilenin aynisi atilir', () => {
  const v = (x) => G.validateQuestion(exprQ(x), ['expression'], 'tr');
  assert.equal(v({ expr_vars: [] }).reason, 'expr_no_vars');
  assert.equal(v({ expr_vars: ['pi', 'sin'] }).reason, 'expr_no_vars', 'sabit ve fonksiyon adi degisken olamaz');
  assert.equal(v({ correct_answer: 'x =' }).reason, 'expr_answer_invalid');
  assert.equal(v({ correct_answer: 'z+1' }).reason, 'expr_answer_invalid', 'bildirilmeyen degisken');
  assert.equal(v({ correct_answer: 'sqrt(-1-x)' }).reason, 'expr_answer_invalid', 'ornek noktalarda tanimsiz');
  assert.equal(v({ correct_answer: 'x^2-1' }).reason, 'expr_form_mismatch');
  assert.equal(v({ form: 'any', correct_answer: 'x^2-1' }).reason, 'expr_form_mismatch', 'cevap verilenin aynisi');
  assert.equal(v({ form: 'garip' }).question.form, 'any');
  assert.equal(v({ up_to_constant: 'evet' }).question.up_to_constant, false);
});

// ---------------------------------------------------------------------------
// grade-exam
// ---------------------------------------------------------------------------
const stored = (extra = {}) => ({ type: 'expression', correct_answer: '(x-1)*(x+1)', expr_vars: ['x'], form: 'factored', given: 'x^2-1', up_to_constant: false, ...extra });

test('notlama: denk ve dogru bicim 100, bicim yanlis 50, kopya 0, yanlis 0', () => {
  assert.equal(R.gradeExpression('(x+1)(x-1)', stored()).score, 100);
  assert.equal(R.gradeExpression('(x - 1) * (x + 1)', stored()).verdict, 'correct');
  const f = R.gradeExpression('x^2 - 1 + 0', stored());
  assert.deepEqual([f.score, f.verdict], [50, 'wrong_form']);
  const c = R.gradeExpression('x^2-1', stored());
  assert.deepEqual([c.score, c.verdict], [0, 'copied']);
  assert.deepEqual([R.gradeExpression('(x-1)^2', stored()).score, R.gradeExpression('(x-1)^2', stored()).verdict], [0, 'wrong']);
});

test('notlama: bos, okunamaz, integral sabiti, referans bozuk', () => {
  assert.equal(R.gradeExpression('', stored()).verdict, 'blank');
  assert.equal(R.gradeExpression('x = 1', stored()).verdict, 'unreadable');
  const integ = stored({ correct_answer: 'x^3/3', form: 'any', given: null, up_to_constant: true });
  assert.equal(R.gradeExpression('x^3/3 + C', integ).score, 100, '+C atilir');
  assert.equal(R.gradeExpression('x³/3+7', integ).score, 100, 'herhangi sabit');
  assert.equal(R.gradeExpression('x^2', integ).score, 0);
  const bad = R.gradeExpression('x', stored({ correct_answer: 'sqrt(-1-x)', form: 'any', given: null }));
  assert.deepEqual([bad.score, bad.verdict], [null, 'invalid'], 'nota katilmaz');
});

test('turev sorusu: farkli ama denk yazimlar', () => {
  const d = stored({ correct_answer: '2*x*sin(x)+x^2*cos(x)', form: 'any', given: null });
  assert.equal(R.gradeExpression('2x sinx + x²cosx', d).score, 100);
  assert.equal(R.gradeExpression('x(2sin(x)+x cos(x))', d).score, 100);
  assert.equal(R.gradeExpression('2x cos x', d).score, 0);
});

// ---------------------------------------------------------------------------
// Tarayıcı: TeX önizleme ve tip kaydı
// ---------------------------------------------------------------------------
test('exprToTex: kesir, us, kok, fonksiyon, carpma', () => {
  const T = s => E.exprToTex(E.normalizeMathInput(s, ['x', 'r']));
  assert.equal(T('2x(x+1)'), '2 x \\left(x + 1\\right)');
  assert.equal(T('x^2/2'), '\\frac{{x}^{2}}{2}');
  assert.equal(T('sqrt(x^2+1)'), '\\sqrt{{x}^{2} + 1}');
  assert.equal(T('sin²x'), '{\\sin\\left(x\\right)}^{2}');
  assert.equal(T('(x+1)^2'), '{\\left(x + 1\\right)}^{2}');
  assert.equal(T('2*3x'), '2 \\cdot 3 x');
  assert.equal(T('3pi*r^2'), '3 \\pi {r}^{2}');
  assert.equal(T('√x sinx'), '\\sqrt{x} \\, \\sin\\left(x\\right)', 'fonksiyonla carpimda ince bosluk');
  assert.equal(T('2sinx'), '2 \\, \\sin\\left(x\\right)');
  assert.equal(E.exprToTex(''), '');
  assert.equal(E.exprToTex('2*('), '');
});

test('expression tipi kayitli; preview okunamazsa null', () => {
  assert.equal(E.hasType('expression'), true);
  assert.equal(E.exprPreviewHtml('x = ', ['x']), null);
  assert.equal(E.exprPreviewHtml('2x', ['x']), '2*x', 'katex yoksa acik ifade metni');
  const html = E.getType('expression').renderInput({ id: 3, expr_vars: ['x', 'y'], form: 'factored' }, { esc: s => String(s), lang: 'tr', name: 'answer-q-3' });
  assert.match(html, /name="answer-q-3"/);
  assert.match(html, /data-expr-vars="x,y"/);
  assert.match(html, /data-expr-key="√\("/);
  assert.match(html, /çarpanlarına ayrılmış/);
});

test('sourceTeachesAlgebra: cebir/turev ogreten kaynak ifade sorusu zorunlu (canli test 26.10.2026)', () => {
  assert.equal(G.sourceTeachesAlgebra('Türev kuralları: kuvvet kuralı (xⁿ)′ = n·xⁿ⁻¹; zincir kuralı; çarpanlara ayırma.'), true);
  assert.equal(G.sourceTeachesAlgebra('Derivatives: the power rule and the chain rule.'), true);
  assert.equal(G.sourceTeachesAlgebra('Kredi taksiti, faiz ve net bugünkü değer hesapları.'), false, 'finans');
  assert.equal(G.sourceTeachesAlgebra('Marjinal maliyet türev ile bulunur.'), false, 'tek iz yetmez');
});

summary();
