/* ==========================================================================
   ACADEX — SINAV GERİ BİLDİRİM TESTLERİ (tests/exam-feedback.js)

   Faz 2a (21.10.2026): açıklama, şık gerekçeleri, rubrik ve kaynak sayfa.
   Groq'a ve Supabase'e çıkmadan test eder:
     - generate-exam: geri bildirim alanlarının temizlenmesi, rubriğin 100'e
       ölçeklenmesi, şık gerekçelerinin şık METNİNE bağlanması, sorunun
       document_chunks'tan kurulan sayfa dizinine bağlanması
     - generate-exam'deki atıf motoru kopyasının summarize-document'takiyle
       BİREBİR aynı kalması
     - grade-exam: madde kararlarının ayrıştırılması ve rubrikten puan

   Çalıştırma:  node tests/exam-feedback.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, sliceDeclaration, makeRunner } = require('./_ts-extract.js');

const GEN_PATH = 'supabase/functions/generate-exam/index.ts';
const GRADE_PATH = 'supabase/functions/grade-exam/index.ts';
const SUM_PATH = 'supabase/functions/summarize-document/index.ts';

const ANCHOR_NAMES = [
  'ANCHOR_STOPWORDS', 'anchorTerms', 'SENTENCE_ABBREV', 'splitSentences',
  'QUOTE_MIN_CHARS', 'QUOTE_MAX_CHARS', 'bestQuoteForClaim',
  'buildAnchorIdf', 'ANCHOR_MIN_SCORE', 'ANCHOR_MIN_TERMS', 'anchorClaimToPage'
];

const G = loadFromSource(GEN_PATH, [
  'TRUE_FALSE_OPTIONS', 'KEY_FIELDS',
  'EXPLANATION_MAX_CHARS', 'RATIONALE_MAX_CHARS', 'RUBRIC_MIN_ITEMS', 'RUBRIC_MAX_ITEMS',
  'normalizeAnswerText', 'parseLooseNumber', 'cleanText', 'normalizeOptionRationales', 'normalizeRubric',
  'validateQuestion', 'splitPublicAndKey', 'shuffleInPlace',
  ...ANCHOR_NAMES, 'CHUNK_STORE_SIZE', 'joinChunkParts', 'buildPageIndexFromChunks', 'anchorQuestionToSource'
]);
const R = loadFromSource(GRADE_PATH, [
  'VERDICT_SHARE', 'parseCriteria', 'parseGradesResponse', 'scoreFromRubric', 'teachingFields'
]);

const { test, summary } = makeRunner();

// ---------------------------------------------------------------------------
// Atıf motoru kopyası
// ---------------------------------------------------------------------------
test('atif motoru generate-exam ve summarize-document te birebir ayni', () => {
  const ts = require('typescript');
  const toJs = p => ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText;
  const genJs = toJs(GEN_PATH), sumJs = toJs(SUM_PATH);
  for (const name of [...ANCHOR_NAMES, 'CHUNK_STORE_SIZE']) {
    assert.equal(sliceDeclaration(genJs, name), sliceDeclaration(sumJs, name), `${name} iki dosyada farkli — birini degistirdiysen otekini de degistir`);
  }
});

// ---------------------------------------------------------------------------
// Kaynak sayfa
// ---------------------------------------------------------------------------
const PAGES = {
  1: 'Mikroekonomiye giriş. Bu bölümde kıtlık, tercih ve fırsat maliyeti kavramları tanıtılır. Fırsat maliyeti, bir seçim yapıldığında vazgeçilen en iyi alternatifin değeridir.',
  2: 'Talep kanunu. Diğer koşullar sabitken bir malın fiyatı arttığında talep edilen miktar azalır. Talep eğrisi bu nedenle negatif eğimlidir. Gelir artışı normal mallarda talep eğrisini sağa kaydırır.',
  3: 'Arz kanunu. Fiyat yükseldiğinde üreticiler daha fazla miktar arz etmek ister; arz eğrisi pozitif eğimlidir.',
  4: 'Piyasa dengesi. Arz ve talep eğrilerinin kesiştiği noktada denge fiyatı ve denge miktarı oluşur. Talep artarsa denge fiyatı yükselir.',
  5: 'Esneklik. Fiyat esnekliği, talep edilen miktardaki yüzde değişimin fiyattaki yüzde değişime oranıdır.'
};

const chunkRows = () => [
  { page_start: 1, page_end: 1, text: PAGES[1] },
  { page_start: 2, page_end: 2, text: PAGES[2].slice(0, PAGES[2].indexOf(' Gelir')) },
  { page_start: 2, page_end: 2, text: PAGES[2].slice(PAGES[2].indexOf(' Gelir') + 1) },
  { page_start: 3, page_end: 4, text: PAGES[3] + '\n\n' + PAGES[4] },
  { page_start: 5, page_end: 5, text: PAGES[5] }
];

test('chunk lardan sayfa dizini: ayni sayfanin parcalari birlesir, birlesik sayfalar aralik tutar', () => {
  const { index, pageEnd } = G.buildPageIndexFromChunks(chunkRows());
  assert.deepEqual(index.map(s => s.page), [1, 2, 3, 5]);
  assert.ok(index[1].body.includes('negatif eğimlidir'));
  assert.equal(pageEnd.get(3), 4);
  assert.equal(pageEnd.has(2), false);
});

test('uzun paragrafin kelime ortasindan kesilen parcalari bosluksuz birlesir', () => {
  // summarize-document'taki splitIntoChunks: 1.5x'ten uzun paragraf tam
  // CHUNK_STORE_SIZE karakterde kesilir, parçalar trim'lenip saklanır.
  const para = ('Talep kanunu fiyat ile talep edilen miktar arasındaki ters ilişkiyi anlatır. ').repeat(30);
  const cut = G.CHUNK_STORE_SIZE;
  const pieces = [para.substring(0, cut).trim(), para.substring(cut, cut * 2).trim(), para.substring(cut * 2).trim()].filter(Boolean);
  assert.equal(pieces[0].length, cut, 'test kurgusu: ilk parca kelime ortasinda bitmeli');
  const joined = G.joinChunkParts(pieces);
  assert.equal(joined.replace(/\s+/g, ' '), para.trim().replace(/\s+/g, ' '));
  assert.equal(G.joinChunkParts(['Birinci paragraf.', 'İkinci paragraf.']), 'Birinci paragraf.\n\nİkinci paragraf.');
});

test('sayfasiz belge (DOCX) bos dizin verir', () => {
  const { index } = G.buildPageIndexFromChunks([{ page_start: null, page_end: null, text: PAGES[1] }]);
  assert.deepEqual(index, []);
});

test('soru dogru sayfaya baglanir ve o sayfadan cumle alintilanir', () => {
  const { index, pageEnd } = G.buildPageIndexFromChunks(chunkRows());
  const idf = G.buildAnchorIdf(index);
  const q = {
    type: 'multiple_choice',
    question: 'Bir malın fiyatı arttığında talep edilen miktara ne olur?',
    correct_answer: 'Azalır',
    explanation: 'Talep kanununa göre fiyat arttığında talep edilen miktar azalır; talep eğrisi negatif eğimlidir.'
  };
  const src = G.anchorQuestionToSource(q, index, idf, pageEnd);
  assert.equal(src.page, 2);
  assert.equal(src.page_end, null);
  assert.match(src.quote, /talep edilen miktar azalır/);
});

test('birlesik parcadaki soru aralikla doner (s. 3-4)', () => {
  const { index, pageEnd } = G.buildPageIndexFromChunks(chunkRows());
  const idf = G.buildAnchorIdf(index);
  const src = G.anchorQuestionToSource({
    type: 'open_ended',
    question: 'Piyasa dengesi nasıl oluşur?',
    correct_answer: 'Arz ve talep eğrilerinin kesiştiği noktada denge fiyatı ve denge miktarı oluşur.',
    explanation: 'Denge, arz ve talep eğrilerinin kesiştiği noktadır.'
  }, index, idf, pageEnd);
  assert.equal(src.page, 3);
  assert.equal(src.page_end, 4);
});

test('belgede olmayan konu sayfaya baglanmaz (yanlis sayfa gostermektense hic)', () => {
  const { index, pageEnd } = G.buildPageIndexFromChunks(chunkRows());
  const idf = G.buildAnchorIdf(index);
  const src = G.anchorQuestionToSource({
    type: 'open_ended',
    question: 'Merkez bankasının açık piyasa işlemleri enflasyonu nasıl etkiler?',
    correct_answer: 'Tahvil satışı para arzını daraltır, enflasyonist baskıyı azaltır.',
    explanation: 'Para politikası araçları likiditeyi değiştirir.'
  }, index, idf, pageEnd);
  assert.equal(src, null);
});

// ---------------------------------------------------------------------------
// Üretim: geri bildirim alanları
// ---------------------------------------------------------------------------
const mc = (extra = {}) => ({
  type: 'multiple_choice',
  question: 'Talep artarsa denge fiyatı ne olur?',
  options: ['Artar', 'Azalır', 'Değişmez', 'Sıfırlanır'],
  correct_answer: 'Artar',
  ...extra
});

test('sik gerekceleri sik METNINE baglanir; harf ve bilinmeyen sik ele alinir', () => {
  const r = G.validateQuestion(mc({
    explanation: 'Talep eğrisi sağa kayınca  denge fiyatı yükselir.',
    option_rationales: [
      { option: 'Artar', why: 'Doğru: talep kayması fiyatı yükseltir.' },
      { option: 'B', why: 'Arz artışının etkisiyle karıştırılmış.' },
      { option: 'değişmez', why: 'Tam esnek arz varsayımı.' },
      { option: 'Yok böyle şık', why: 'atlanmalı' },
      { option: 'Sıfırlanır', why: '' }
    ]
  }), ['multiple_choice'], 'tr');
  assert.equal(r.ok, true);
  assert.equal(r.question.explanation, 'Talep eğrisi sağa kayınca denge fiyatı yükselir.');
  assert.deepEqual(r.question.option_rationales, {
    'Artar': 'Doğru: talep kayması fiyatı yükseltir.',
    'Azalır': 'Arz artışının etkisiyle karıştırılmış.',
    'Değişmez': 'Tam esnek arz varsayımı.'
  });
});

test('nesne bicimindeki gerekceler de kabul edilir; karistirmadan sonra metinle eslesmeye devam eder', () => {
  const r = G.validateQuestion(mc({ option_rationales: { Azalır: 'Ters yön.' } }), ['multiple_choice'], 'tr');
  const shuffled = G.shuffleInPlace([...r.question.options], () => 0);
  assert.ok(shuffled.includes('Azalır'));
  assert.equal(r.question.option_rationales['Azalır'], 'Ters yön.');
});

test('geri bildirim alanlari eksikse soru yine kabul edilir', () => {
  const r = G.validateQuestion(mc(), ['multiple_choice'], 'tr');
  assert.equal(r.ok, true);
  assert.equal(r.question.explanation, null);
  assert.equal(r.question.option_rationales, null);
  assert.equal(r.question.rubric, null);
});

test('rubrik yalnizca acik uclu soruda; puanlar 100 e olceklenir', () => {
  const open = G.validateQuestion({
    type: 'open_ended', question: 'Fırsat maliyetini bir örnekle açıklayın.', correct_answer: 'Vazgeçilen en iyi alternatif...',
    rubric: [
      { criterion: 'Fırsat maliyetini doğru tanımlar', points: 4 },
      { criterion: 'Somut bir örnek verir', points: 3 },
      { criterion: 'Örnekte vazgeçilen alternatifi açıkça belirtir', points: 3 }
    ]
  }, ['open_ended'], 'tr');
  assert.deepEqual(open.question.rubric.map(r => r.points), [40, 30, 30]);
  const withRubricOnMc = G.validateQuestion(mc({ rubric: [{ criterion: 'x x x', points: 50 }, { criterion: 'y y y', points: 50 }] }), ['multiple_choice'], 'tr');
  assert.equal(withRubricOnMc.question.rubric, null);
});

test('normalizeRubric: yuvarlama farki en buyuk maddeye; gecersizler atilir; tek madde yetmez', () => {
  const r = G.normalizeRubric([{ criterion: 'Bir', points: 1 }, { criterion: 'İki', points: 1 }, { criterion: 'Üç', points: 1 }]);
  assert.equal(r.reduce((a, i) => a + i.points, 0), 100);
  assert.deepEqual(G.normalizeRubric([{ criterion: 'Tanım', points: 'abc' }, { criterion: 'Örnek', points: 60 }]), null);
  assert.equal(G.normalizeRubric([{ criterion: 'Tek', points: 100 }]), null);
  assert.equal(G.normalizeRubric('bozuk'), null);
  const many = G.normalizeRubric(Array.from({ length: 9 }, (_, i) => ({ criterion: `Madde ${i + 1}`, points: 10 })));
  assert.equal(many.length, G.RUBRIC_MAX_ITEMS);
  assert.equal(many.reduce((a, i) => a + i.points, 0), 100);
});

test('aciklama, gerekceler, rubrik ve kaynak tarayiciya GITMEZ (anahtarda kalir)', () => {
  const q = { id: 1, type: 'multiple_choice', question: 'S?', options: ['a', 'b'], concept: 'k',
    correct_answer: 'a', explanation: 'e', option_rationales: { b: 'neden' }, rubric: null, source: { page: 3 }, hint: 'h' };
  const { pub, key } = G.splitPublicAndKey(q);
  for (const f of ['correct_answer', 'explanation', 'option_rationales', 'rubric', 'source', 'hint']) {
    assert.ok(!(f in pub), `${f} tarayiciya gidiyor`);
    assert.ok(f in key, `${f} anahtarda yok`);
  }
  assert.deepEqual(Object.keys(pub).sort(), ['concept', 'id', 'options', 'question', 'type']);
});

test('aciklama cok uzunsa kelime sinirinda kesilir', () => {
  const long = 'kelime '.repeat(200);
  const out = G.cleanText(long, G.EXPLANATION_MAX_CHARS);
  assert.ok(out.length <= G.EXPLANATION_MAX_CHARS + 1);
  assert.ok(out.endsWith('…'));
});

// ---------------------------------------------------------------------------
// Puanlama: rubrik
// ---------------------------------------------------------------------------
const RUBRIC = [
  { criterion: 'Tanım', points: 40 },
  { criterion: 'Örnek', points: 30 },
  { criterion: 'Alternatif', points: 30 }
];

test('scoreFromRubric: karsilandi tam, kismen yarim, eksik sifir', () => {
  const r = R.scoreFromRubric(RUBRIC, [
    { index: 1, verdict: 'met', note: 'doğru tanım' },
    { index: 2, verdict: 'partial', note: 'örnek belirsiz' },
    { index: 3, verdict: 'missing', note: '' }
  ]);
  assert.equal(r.score, 55);
  assert.deepEqual(r.items.map(i => i.earned), [40, 15, 0]);
  assert.equal(r.items[1].criterion, 'Örnek');
});

test('scoreFromRubric: bir madde karari eksikse null (butuncul puana donulur)', () => {
  assert.equal(R.scoreFromRubric(RUBRIC, [{ index: 1, verdict: 'met', note: '' }, { index: 2, verdict: 'met', note: '' }]), null);
  assert.equal(R.scoreFromRubric(RUBRIC, null), null);
  assert.equal(R.scoreFromRubric([], [{ index: 1, verdict: 'met', note: '' }]), null);
});

test('ayni kararlar her zaman ayni puani verir (tutarlilik koddan gelir)', () => {
  const v = [{ index: 1, verdict: 'met', note: '' }, { index: 2, verdict: 'met', note: '' }, { index: 3, verdict: 'partial', note: '' }];
  assert.equal(R.scoreFromRubric(RUBRIC, v).score, R.scoreFromRubric(RUBRIC, v.slice()).score);
  assert.equal(R.scoreFromRubric(RUBRIC, v).score, 85);
});

test('parseCriteria: bilinmeyen karar atlanir, index yoksa sira kullanilir, buyuk harf kabul', () => {
  assert.deepEqual(R.parseCriteria([{ verdict: 'MET', note: 'a' }, { index: 2, verdict: 'belki' }, { verdict: 'missing' }]), [
    { index: 1, verdict: 'met', note: 'a' },
    { index: 3, verdict: 'missing', note: '' }
  ]);
  assert.equal(R.parseCriteria('yok'), null);
  assert.equal(R.parseCriteria([]), null);
});

test('parseGradesResponse: kriterli yanit; puan yoksa da kriterler yeterli', () => {
  const out = R.parseGradesResponse(JSON.stringify({ grades: [
    { question_id: 3, criteria: [{ index: 1, verdict: 'met', note: 'x' }], feedback: 'iyi' }
  ] }));
  assert.equal(out.length, 1);
  assert.ok(Number.isNaN(out[0].score));
  assert.equal(out[0].criteria[0].verdict, 'met');
});

test('teachingFields: yalnizca dolu alanlar sonuca tasinir', () => {
  assert.deepEqual(R.teachingFields({ explanation: 'neden', option_rationales: null, source: { page: 2, page_end: null, quote: 'q' } }),
    { explanation: 'neden', source: { page: 2, page_end: null, quote: 'q' } });
  assert.deepEqual(R.teachingFields({}), {});
});

summary();
