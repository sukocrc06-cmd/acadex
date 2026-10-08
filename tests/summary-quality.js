/* ==========================================================================
   ACADEX — OZET KALITE KAPILARI TESTLERI (tests/summary-quality.js)

   summarize-document icindeki uc kaliteyi-koruma mekanizmasini Groq'a hic
   cikmadan test eder:
     1. applyGroundingGate     — kaynagin desteklemedigi iddialari atar
     2. dedupeNearDuplicates   — ayni fikrin iki farkli ifadesini birlestirir
     3. validateLatex / sanitizeFormulas — render edilemeyecek formulu atar

   Fonksiyonlar kaynak dosyadan calisma aninda cikarilir (tests/_ts-extract.js).

   Calistirma:  node tests/summary-quality.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const A = loadFromSource('supabase/functions/summarize-document/index.ts', [
  'ANCHOR_STOPWORDS', 'anchorTerms',
  // Reasoning parametrelerinin model ailesine gore turetilmesi.
  // DIKKAT: bu dosyada loadFromSource SADECE burada cagrilmali. Her cagri
  // 5.900 satirlik kaynagi senkron olarak transpile ediyor ve olay dongusunu
  // yuzlerce ms blokluyor; asagidaki pacer testleri gercek duvar saatine
  // bakiyor, bu yuzden testin ORTASINDA yapilan bir transpile onlari
  // uydurma sekilde basarisiz gosteriyor (05.10.2026'da tam bu oldu).
  'reasoningParamsFor',
  // token hizlandirici (TPM)
  'PACER_SAFETY', 'PACER_WINDOW_MS', 'PACER_MAX_WAIT_MS', 'PACER_COMPLETION_FACTOR',
  'REASONING_HEADROOM', 'reviewCompletionFor',
  'CHART_MIN_GROUNDED_RATIO', 'sourceNumbers',
  'DEFAULT_TPM_LIMIT', 'MODEL_OTPM', 'OTPM_SAFETY', 'VISION_MAX_COMPLETION', 'PIPELINE_BUDGET_MS', 'REVIEW_ATTEMPT_TIMEOUT_MS', 'REVIEW_TAIL_MS',
  'tokenPacer', 'estimateTokens', 'parseGroqRetryAfterMs', 'isDailyQuotaError', 'MODEL_HEAVY', 'MODEL_FAST', 'MODEL_EXTRACT', 'VISION_CALL_MS', 'WINDOW_CALL_MS', 'NARRATIVE_WRITER_RESERVE_MS',
  // latex
  'stripLatexDelimiters', 'validateLatex', 'sanitizeFormulas',
  // mermaid dogrulama
  'MERMAID_TYPES', 'MERMAID_REVERSE_LABELLED_EDGE', 'repairMermaidArrows',
  'MERMAID_UNQUOTED_PAREN_LABEL', 'repairMermaidLabels',
  'validateMermaid', 'sanitizeDiagrams',
  // grafik kapisi
  'CHART_TYPES', 'CHART_MIN_POINTS', 'sanitizeCharts',
  // gorsel sayfa secimi
  'FIGURE_CAPTION_RE', 'selectVisualPages',
  'VISION_TOKENS_PER_IMAGE', 'VISION_MAX_IMAGES', 'VISUAL_MIN_BUDGET_MS',
  // bosluk doldurma kartlari
  'clozeTermPattern', 'turkishIClasses', 'blankAllOccurrences',
  'REVIEW_ARRAY_FIELDS', 'applyCorrections', 'NARRATIVE_MIN_KEEP_RATIO', 'INLINE_PAGE_CITE', 'stripIntroducedCitations', 'mergeReviewOntoDraft', 'stripThinkBlock', 'buildClozeCards',
  // tekrarlayan ustbilgi/altbilgi temizligi
  'BOILERPLATE_MIN_PAGES', 'BOILERPLATE_PAGE_SHARE', 'BOILERPLATE_MAX_LINE_CHARS',
  'boilerplateKey', 'splitByPageMarkers', 'stripRepeatedBoilerplate',
  // anlati yil kapisi
  'YEAR_RE', 'YEAR_RANGE_RE', 'YEAR_ONLY_PAREN_RE',
  'yearInSource', 'scrubUnsupportedYears', 'sanitizeNarrativeYears',
  // temellendirme kapisi
  'gateNormalize', 'GATE_MIN_TERMS_TO_JUDGE', 'GATE_MAX_DROP_SHARE', 'applyGroundingGate',
  // yakin kopya
  'NEAR_DUP_THRESHOLD', 'NEAR_DUP_MIN_TERMS', 'NEAR_DUP_STEM_LEN',
  'NEAR_DUP_KEY_OVERLAP', 'nearDupKeysMatch',
  'nearDupStem', 'nearDupTermSet', 'dedupeNearDuplicates',
  // Slayt destesi tespiti ve cikarim talimati (07.10.2026).
  'DECK_MIN_PAGES', 'DECK_MAX_CHARS_PER_PAGE', 'DECK_PROMPT_CHARS',
  'detectSlideDeck', 'buildSlideDeckInstruction'
]);

const { test, summary } = makeRunner();

// Gercekci kaynak metin — kapinin karsilastiracagi belge.
const SOURCE = `
Talep esnekligi, fiyattaki yuzde degisime karsilik talep edilen miktardaki
yuzde degisimi olcer. Esneklik katsayisi birden buyukse talep esnek kabul
edilir ve firmanin fiyatlandirma stratejisi buna gore sekillenir.

Marjinal maliyet, uretimi bir birim artirmanin toplam maliyete ekledigi
tutardir. Kisa donemde marjinal maliyet egrisi ortalama maliyet egrisini
minimum noktasinda keser.

Oligopol piyasalarda az sayida firma bulunur. Nash dengesi, hicbir oyuncunun
tek tarafli sapmakla kazanc saglayamadigi durumu tanimlar.

Tuketici artigi, odemeye razi olunan tutar ile fiilen odenen tutar
arasindaki farktir.
`.repeat(3);

// ===========================================================================
console.log('\nLATEX DOGRULAMA\n');

test('gecerli formul kabul edilir', () => {
  for (const ok of ['E = mc^2', '\\frac{a}{b}', '\\sum_{i=1}^{n} x_i', 'F = ma', 'Q_d = a - bP']) {
    const r = A.validateLatex(ok);
    assert.ok(r.ok, `reddedildi: ${ok} (${r.reason})`);
  }
});

test('ayiricilar SIYRILIR, formul korunur ($ \\( \\[ )', () => {
  assert.equal(A.validateLatex('$E = mc^2$').latex, 'E = mc^2');
  assert.equal(A.validateLatex('$$\\frac{a}{b}$$').latex, '\\frac{a}{b}');
  assert.equal(A.validateLatex('\\(F = ma\\)').latex, 'F = ma');
  assert.equal(A.validateLatex('\\[x^2\\]').latex, 'x^2');
  assert.ok(A.validateLatex('$E = mc^2$').ok, 'ayirici yuzunden atilmamali');
});

test('dengesiz suslu parantez REDDEDILIR', () => {
  const r = A.validateLatex('\\frac{a}{b');
  assert.equal(r.ok, false);
  assert.match(r.reason, /dengesiz/);
});

test('fazla kapanis parantezi reddedilir', () => {
  assert.equal(A.validateLatex('a}{b').ok, false);
});

test('kacak suslu parantez (\\{ \\}) yanlis sayilmaz', () => {
  const r = A.validateLatex('\\{ x : x > 0 \\}');
  assert.ok(r.ok, `kacirilmis parantez yanlis sayildi: ${r.reason}`);
});

test('\\left / \\right dengesizligi reddedilir', () => {
  assert.equal(A.validateLatex('\\left( \\frac{a}{b}').ok, false);
  assert.ok(A.validateLatex('\\left( \\frac{a}{b} \\right)').ok, 'dengeli olan kabul edilmeli');
});

test('kacak $ ve yarim komut reddedilir', () => {
  assert.equal(A.validateLatex('a + $b').ok, false);
  assert.equal(A.validateLatex('a + b \\').ok, false);
});

test('bos / cok kisa / cok uzun reddedilir', () => {
  assert.equal(A.validateLatex('').ok, false);
  assert.equal(A.validateLatex('   ').ok, false);
  assert.equal(A.validateLatex('x').ok, false);
  assert.equal(A.validateLatex('x'.repeat(1500)).ok, false);
});

test('sanitizeFormulas: gecerliyi tutar, bozugu atar, onarilani sayar', () => {
  const r = A.sanitizeFormulas([
    { name: 'Einstein', latex: 'E = mc^2' },
    { name: 'Bozuk', latex: '\\frac{a}{b' },
    { name: 'Sarili', latex: '$F = ma$' },
    { name: 'Bos', latex: '' }
  ]);
  assert.equal(r.formulas.length, 2, 'iki formul kalmaliydi');
  assert.deepEqual(r.formulas.map(f => f.name), ['Einstein', 'Sarili']);
  assert.equal(r.formulas[1].latex, 'F = ma', 'ayirici siyrilmali');
  assert.equal(r.repaired, 1);
  assert.equal(r.dropped.length, 2);
  assert.ok(r.dropped.every(d => d.reason), 'her atilan icin neden olmali');
});

test('sanitizeFormulas: diger alanlar korunur', () => {
  const r = A.sanitizeFormulas([
    { name: 'X', latex: '$a+b$', variables: [{ symbol: 'a', meaning: 'bir' }] }
  ]);
  assert.deepEqual(r.formulas[0].variables, [{ symbol: 'a', meaning: 'bir' }]);
});

test('sanitizeFormulas: bozuk girdide cokmez', () => {
  assert.deepEqual(A.sanitizeFormulas(null).formulas, []);
  assert.deepEqual(A.sanitizeFormulas([null, undefined, {}]).formulas, []);
});

// ===========================================================================
console.log('\nMERMAID DOGRULAMA\n');

test('gecerli diyagram kabul edilir', () => {
  for (const ok of [
    'flowchart TD\n  A[Baslangic] --> B[Bitis]',
    'graph LR\n  X --> Y',
    'mindmap\n  root((konu))\n    dal1',
    'sequenceDiagram\n  A->>B: mesaj'
  ]) {
    const r = A.validateMermaid(ok);
    assert.ok(r.ok, `reddedildi: ${JSON.stringify(ok)} (${r.reason})`);
  }
});

test('kod blogu sarmalayici siyrilir', () => {
  const r = A.validateMermaid('```mermaid\nflowchart TD\n  A --> B\n```');
  assert.ok(r.ok, `reddedildi: ${r.reason}`);
  assert.ok(!r.mermaid.includes('```'), 'fence kalmamali');
  assert.ok(r.mermaid.startsWith('flowchart'));
});

test('diyagram turu olmayan kaynak reddedilir', () => {
  const r = A.validateMermaid('A --> B\n  B --> C');
  assert.equal(r.ok, false);
  assert.match(r.reason, /tur/);
});

test('dengesiz parantezler reddedilir', () => {
  assert.equal(A.validateMermaid('flowchart TD\n  A[Baslangic --> B').ok, false);
  assert.equal(A.validateMermaid('flowchart TD\n  A(Bir --> B').ok, false);
  assert.equal(A.validateMermaid('flowchart TD\n  A{Karar --> B').ok, false);
});

test('dengesiz tirnak reddedilir', () => {
  assert.equal(A.validateMermaid('flowchart TD\n  A["Baslangic] --> B').ok, false);
});

test('tek satir / bos reddedilir', () => {
  assert.equal(A.validateMermaid('flowchart TD').ok, false);
  assert.equal(A.validateMermaid('').ok, false);
  assert.equal(A.validateMermaid('   ').ok, false);
});

test('sanitizeDiagrams gecerliyi tutar bozugu atar', () => {
  const r = A.sanitizeDiagrams([
    { title: 'Iyi', mermaid: 'flowchart TD\n  A --> B' },
    { title: 'Bozuk', mermaid: 'flowchart TD\n  A[Acik --> B' },
    { title: 'Tursuz', mermaid: 'A --> B\n B --> C' }
  ]);
  assert.deepEqual(r.diagrams.map(d => d.title), ['Iyi']);
  assert.equal(r.dropped.length, 2);
  assert.ok(r.dropped.every(d => d.reason), 'her atilan icin neden olmali');
});

test('sanitizeDiagrams bozuk girdide cokmez', () => {
  assert.deepEqual(A.sanitizeDiagrams(null).diagrams, []);
  assert.deepEqual(A.sanitizeDiagrams([null, {}, { mermaid: '' }]).diagrams, []);
});

// ===========================================================================
console.log('\nTEMELLENDIRME KAPISI\n');

test('kaynakta gecen terimler korunur', () => {
  const r = A.applyGroundingGate(
    [{ term: 'Talep esnekligi', definition: '...' }, { term: 'Marjinal maliyet', definition: '...' }],
    [], SOURCE
  );
  assert.equal(r.key_terms.length, 2, 'ikisi de kalmaliydi');
  assert.equal(r.stats.termsDropped, 0);
});

test('UYDURMA terim atilir', () => {
  const r = A.applyGroundingGate(
    [
      { term: 'Talep esnekligi', definition: '...' },
      { term: 'Fotosentez', definition: 'kloroplastlarda gerceklesir' }
    ],
    [], SOURCE
  );
  assert.deepEqual(r.key_terms.map(t => t.term), ['Talep esnekligi']);
  assert.equal(r.stats.termsDropped, 1);
  assert.deepEqual(r.stats.droppedTerms, ['Fotosentez']);
});

test('Turkce ek almis terim bulunur (substring avantaji)', () => {
  // Kaynakta "esnekligi" var; model "esneklik" yaziyor
  const r = A.applyGroundingGate([{ term: 'esneklik', definition: '...' }], [], SOURCE);
  assert.equal(r.key_terms.length, 1, 'kok eslesmesi tutmaliydi');
});

test('cok kelimeli terim parcali gecse de kabul edilir', () => {
  const r = A.applyGroundingGate(
    [{ term: 'esneklik stratejisi', definition: '...' }], [], SOURCE
  );
  // "esneklik" ve "stratejisi" ayri ayri kaynakta var
  assert.equal(r.key_terms.length, 1);
});

test('SIFIR ortusmeli key_point atilir', () => {
  const r = A.applyGroundingGate([], [
    'Esneklik katsayisi birden buyukse talep esnektir',
    'Fotosentez kloroplastlarda klorofil pigmentiyle gerceklesir'
  ], SOURCE);
  assert.equal(r.key_points.length, 1);
  assert.match(r.key_points[0], /Esneklik/);
  assert.equal(r.stats.pointsDropped, 1);
});

test('DUSUK ortusmeli yeniden-ifade KORUNUR (asiri agresif olmamali)', () => {
  // Esanlamlilarla yazilmis ama en az bir ayirt edici terim paylasan ifade
  const paraphrase = 'Fiyat duyarliligi yuksek oldugunda talep esneklik gosterir';
  const r = A.applyGroundingGate([], [paraphrase], SOURCE);
  assert.equal(r.key_points.length, 1, 'yeniden ifade atilmamaliydi');
  assert.equal(r.stats.pointsDropped, 0);
});

test('kisa / yargilanamaz nokta korunur', () => {
  const r = A.applyGroundingGate([], ['Onemli bir konu'], SOURCE);
  assert.equal(r.key_points.length, 1, 'yargilayacak kadar terim yoksa atilmamali');
});

test('doğruluk skoru hesaplanir', () => {
  const r = A.applyGroundingGate(
    [{ term: 'Marjinal maliyet' }, { term: 'Fotosentez' }],
    [], SOURCE
  );
  assert.equal(r.stats.score, 50, '1 tuttu / 2 yargilandi = %50');
});

// --- CANLI LOGDAN GELEN GERCEK VAKALAR (2026-10-04) -------------------------
// Ilk gercek calistirmada kapi bu uc terimi "uydurma" diye atmisti; ucu de
// bolumun icinde geciyordu. Sebep tipografik noktalama idi.

test('U+2011 tireli terim atilmaz (Fine-tuning vakasi)', () => {
  const src = 'The Fed used fine tuning to stabilize the economy. '.repeat(10);
  const r = A.applyGroundingGate([{ term: 'Fine\u2011tuning' }], [], src);
  assert.equal(r.key_terms.length, 1, 'U+2011 tire yuzunden atilmamaliydi');
  assert.equal(r.stats.termsDropped, 0);
});

test('tire/bosluk farki terimi oldurmez (Goods-and-services vakasi)', () => {
  const src = 'The goods and services market is one of three market arenas. '.repeat(10);
  const r = A.applyGroundingGate([{ term: 'Goods\u2011and\u2011services market' }], [], src);
  assert.equal(r.key_terms.length, 1, 'tire-bosluk farki yuzunden atilmamaliydi');
});

test('parantezli terim atilmaz (GDP deflator vakasi)', () => {
  const src = 'The inflation rate measured by the GDP deflator rose sharply. '.repeat(10);
  const r = A.applyGroundingGate([{ term: 'Inflation rate (GDP deflator)' }], [], src);
  assert.equal(r.key_terms.length, 1, 'parantezler yuzunden atilmamaliydi');
});

test('gateNormalize tum tire varyantlarini ayni yere indirger', () => {
  const want = 'fine tuning';
  for (const dash of ['\u2010', '\u2011', '\u2012', '\u2013', '\u2014', '-', ' ']) {
    assert.equal(A.gateNormalize('Fine' + dash + 'tuning'), want, `basarisiz: U+${dash.charCodeAt(0).toString(16)}`);
  }
});

test('gateNormalize gercek uydurmayi hala yakaliyor', () => {
  const src = 'The goods and services market is one of three market arenas. '.repeat(10);
  const r = A.applyGroundingGate([{ term: 'Fotosentez' }, { term: 'goods and services market' }], [], src);
  assert.deepEqual(r.key_terms.map(t => t.term), ['goods and services market']);
  assert.equal(r.stats.termsDropped, 1, 'gercekten gecmeyen terim yine atilmali');
});

// --- GUVENLIK VALFI: en onemli test -----------------------------------------
test('GUVENLIK VALFI: kapi cogunu atacaksa HICBIR SEY atmaz', () => {
  const allFake = [
    { term: 'Fotosentez' }, { term: 'Mitokondri' }, { term: 'Kloroplast' },
    { term: 'Ribozom' }, { term: 'Golgi aygiti' }
  ];
  const r = A.applyGroundingGate(allFake, [], SOURCE);
  assert.equal(r.key_terms.length, 5,
    'esik asilinca kapi kendine guvenmemeli — cikti silinmemeli');
  assert.equal(r.stats.aborted, true, 'abort isaretlenmeli');
});

test('kaynak metin yoksa/kisaysa kapi hic calismaz', () => {
  const items = [{ term: 'Herhangi bir terim' }];
  assert.equal(A.applyGroundingGate(items, [], '').key_terms.length, 1);
  assert.equal(A.applyGroundingGate(items, [], 'kisa metin').key_terms.length, 1);
});

test('bos girdilerde cokmez', () => {
  const r = A.applyGroundingGate(null, null, SOURCE);
  assert.deepEqual(r.key_terms, []);
  assert.deepEqual(r.key_points, []);
  assert.equal(r.stats.score, null);
});

// ===========================================================================
console.log('\nYAKIN-KOPYA BIRLESTIRME\n');

const txt = (x) => typeof x === 'string' ? x : String(x?.text || '');

test('sabit-onek koklemesi Turkce cekimi normalize eder', () => {
  // Bu testin varlik sebebi: tam kelime eslestirmesi tam burada cokuyordu.
  assert.equal(A.nearDupStem('esneklik'), A.nearDupStem('esnekligi'));
  assert.equal(A.nearDupStem('duyarliligi'), A.nearDupStem('duyarliligini'));
  assert.equal(A.nearDupStem('maliyet'), A.nearDupStem('maliyetidir'));
  // Kisa kelime oldugu gibi kalir
  assert.equal(A.nearDupStem('nash'), 'nash');
  // Alakasiz kelimeler yine ayri
  assert.notEqual(A.nearDupStem('marjinal'), A.nearDupStem('maliyet'));
});

test('kokleme ILGISIZ kelimeleri carpistirmaz', () => {
  // 5 karakter, cakismanin gerceklesmeyecegi kadar ayirt edici olmali
  const a = A.nearDupTermSet('talep esnekligi fiyat');
  const b = A.nearDupTermSet('tablo erisim fikir');
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  assert.equal(shared, 0, `yanlis carpisma: ${[...a]} vs ${[...b]}`);
});

test('ayni fikrin iki ifadesi birlesir', () => {
  const r = A.dedupeNearDuplicates([
    'Talep esnekligi fiyat degisimine duyarliligi olcer',
    'Esneklik, fiyat degisimine talebin duyarliligini olcer'
  ], txt);
  assert.equal(r.length, 1, 'yakin kopya birlesmeliydi');
});

test('FARKLI fikirler birlesmez', () => {
  const r = A.dedupeNearDuplicates([
    'Talep esnekligi fiyat duyarliligini olcer',
    'Marjinal maliyet uretimi bir birim artirmanin maliyetidir',
    'Nash dengesi stratejik etkilesimin cozumunu tanimlar'
  ], txt);
  assert.equal(r.length, 3, 'farkli maddeler korunmaliydi');
});

test('kopya bulununca DAHA BILGILENDIRICI (uzun) olan tutulur', () => {
  const sh = 'Marjinal maliyet toplam maliyete eklenen tutardir';
  const lo = 'Marjinal maliyet, uretimi bir birim artirmanin toplam maliyete ekledigi tutardir ve kisa donemde U biciminde seyreder';
  assert.equal(A.dedupeNearDuplicates([sh, lo], txt)[0], lo, 'uzun olan tutulmaliydi');
  assert.equal(A.dedupeNearDuplicates([lo, sh], txt)[0], lo, 'sira degisse de uzun olan');
});

test('siralama korunur', () => {
  const r = A.dedupeNearDuplicates([
    'Birinci madde talep esnekligi hakkindadir',
    'Ikinci madde marjinal maliyet hakkindadir',
    'Ucuncu madde Nash dengesi hakkindadir'
  ], txt);
  assert.match(r[0], /Birinci/);
  assert.match(r[1], /Ikinci/);
  assert.match(r[2], /Ucuncu/);
});

test('kisa/terimsiz maddeler birlestirilmez (guvenli taraf)', () => {
  const r = A.dedupeNearDuplicates(['Evet', 'Hayir', 'Belki'], txt);
  assert.equal(r.length, 3, 'karsilastiracak terim yoksa dokunulmamali');
});

test('obje bicimli maddeler destekleniyor', () => {
  const r = A.dedupeNearDuplicates([
    { term: 'Talep esnekligi', definition: 'fiyat duyarliligi olcumu' },
    { term: 'Esneklik', definition: 'fiyat duyarliligi olcumudur' },
    { term: 'Marjinal maliyet', definition: 'ek birim maliyeti' }
  ], (t) => `${t?.term || ''} ${t?.definition || ''}`);
  assert.equal(r.length, 2, 'ilk ikisi birlesmeliydi');
  assert.equal(r[1].term, 'Marjinal maliyet');
});

test('bos ve bozuk girdiler atlanir', () => {
  const r = A.dedupeNearDuplicates(['', '   ', null, 'Gercek bir madde burada yazili'], txt);
  assert.equal(r.length, 1);
});

test('bos dizi guvenli', () => {
  assert.deepEqual(A.dedupeNearDuplicates([], txt), []);
  assert.deepEqual(A.dedupeNearDuplicates(null, txt), []);
});

console.log('\nTOKEN HIZLANDIRICI (TPM)\n');

// Pacer artik MODEL BASINA calisiyor: her modelin kendi 8.000'i, kendi
// harcama gecmisi var (Groq TPM'i model basina sayiyor). Testlerde kullanilan
// iki ornek model adi — gercek id'ler onemli degil, AYRI olmalari onemli.
const M_A = 'test/model-a';
const M_B = 'test/model-b';

function freshPacer(limit, model = M_A) {
  const p = Object.create(Object.getPrototypeOf(A.tokenPacer));
  Object.assign(p, A.tokenPacer, { lanes: Object.create(null) });
  p.lane(model).limit = limit;
  return p;
}

test('8000 TPM de ~5000 tokenlik cagri icin eszamanlilik 1 olur', () => {
  // Canli logdaki tam senaryo: iki pencere ayni anda atesleniyordu, ikisi de 429 aliyordu
  assert.equal(freshPacer(8000).safeConcurrency(5000, M_A), 1);
});

test('buyuk plan gercek paralelligi geri aciyor', () => {
  assert.ok(freshPacer(300000).safeConcurrency(5000, M_A) > 1, 'yuksek TPM de paralellik olmali');
});

test('safeConcurrency asla 0 donmez', () => {
  assert.equal(freshPacer(8000).safeConcurrency(999999, M_A), 1);
  assert.equal(freshPacer(8000).safeConcurrency(0, M_A), 1);
});

test('used() yalnizca 60 sn penceresini sayar', () => {
  const p = freshPacer(8000);
  const now = Date.now();
  p.lane(M_A).spent = [
    { at: now - 90000, tokens: 5000 },   // pencere disi
    { at: now - 1000,  tokens: 3000 }    // pencere ici
  ];
  assert.equal(p.used(now, M_A), 3000, 'eski harcama dusurulmeliydi');
});

test('Groq header i varsayilan limiti ezer', () => {
  const p = freshPacer(8000);
  p.observeHeaders(new Headers({ 'x-ratelimit-limit-tokens': '300000' }), M_A);
  assert.equal(p.lane(M_A).limit, 300000);
  assert.equal(p.lane(M_A).limitKnown, true);
});

test('bozuk header varsayilani bozmaz', () => {
  const p = freshPacer(8000);
  p.observeHeaders(new Headers({ 'x-ratelimit-limit-tokens': 'abc' }), M_A);
  assert.equal(p.lane(M_A).limit, 8000);
});

// ---- model basina ayrisma (asil kazanc) --------------------------------

test('bir modelin harcamasi digerinin butcesini yemez', () => {
  const p = freshPacer(8000);
  const now = Date.now();
  p.lane(M_A).spent = [{ at: now, tokens: 7900 }];
  assert.equal(p.used(now, M_A), 7900, 'kendi seridi dolu olmali');
  assert.equal(p.used(now, M_B), 0, 'diger serit ETKILENMEMELI — Groq ayri sayiyor');
});

test('review cagrisi draft in harcamasi yuzunden BEKLEMEZ', async () => {
  // Tam da duzeltilen hata: tek ortak defterde review, draft'in 7.900
  // tokenini kendi borcu sanip ~60 sn bosuna bekliyordu.
  const p = freshPacer(8000, M_A);
  p.lane(M_B).limit = 8000;
  p.lane(M_A).spent = [{ at: Date.now(), tokens: 7900 }];   // draft az once harcadi
  const t0 = Date.now();
  await p.acquire(3000, M_B);                                // review baska modelde
  assert.ok(Date.now() - t0 < 100, `review beklememeliydi (${Date.now() - t0}ms bekledi)`);
});

test('ayni modeldeki ikinci cagri hala BEKLER', async () => {
  // Ayrisma, ayni serit icindeki korumayi gevsetmemeli.
  const p = freshPacer(8000, M_A);
  p.lane(M_A).spent = [{ at: Date.now(), tokens: 7900 }];
  const t0 = Date.now();
  const waiter = p.acquire(3000, M_A);
  await Promise.race([waiter, new Promise(r => setTimeout(r, 400))]);
  assert.ok(Date.now() - t0 >= 250, 'ayni seritte beklemeliydi');
});

test('header bir modelin limitini ezerken digerini bozmaz', () => {
  const p = freshPacer(8000, M_A);
  p.lane(M_B).limit = 8000;
  p.observeHeaders(new Headers({ 'x-ratelimit-limit-tokens': '300000' }), M_B);
  assert.equal(p.lane(M_B).limit, 300000, 'cagrilan modelin limiti guncellenmeli');
  assert.equal(p.lane(M_A).limit, 8000, 'digerinin limiti sabit kalmali');
});

// ---- waitEstimate: review kapisinin dayandigi olcum --------------------

test('waitEstimate bos seritte 0 doner', () => {
  assert.equal(freshPacer(8000).waitEstimate(3000, M_A), 0);
});

test('waitEstimate sigan cagri icin 0 doner', () => {
  const p = freshPacer(8000);
  p.lane(M_A).spent = [{ at: Date.now(), tokens: 3000 }];
  assert.equal(p.waitEstimate(3000, M_A), 0, '3000+3000 <= 7200, beklememeli');
});

test('waitEstimate dolu seritte kalan pencereyi doner', () => {
  const p = freshPacer(8000);
  p.lane(M_A).spent = [{ at: Date.now() - 50_000, tokens: 6500 }];
  const w = p.waitEstimate(3761, M_A);
  // 60s pencere, kayit 50s once -> ~10s kaldi
  assert.ok(w > 9_000 && w < 11_500, `~10sn beklenirdi, ${w} geldi`);
});

test('waitEstimate baska modelin harcamasini saymaz', () => {
  const p = freshPacer(8000);
  p.lane(M_B).limit = 8000;
  p.lane(M_A).spent = [{ at: Date.now(), tokens: 7000 }];
  assert.equal(p.waitEstimate(3761, M_B), 0, 'diger serit bos, beklememeli');
});

test('waitEstimate tavani asmaz', () => {
  const p = freshPacer(8000);
  p.lane(M_A).spent = [{ at: Date.now(), tokens: 7900 }];
  assert.ok(p.waitEstimate(7000, M_A) <= A.PACER_MAX_WAIT_MS);
});

test('waitEstimate acquire ile ayni karari verir', () => {
  // Kapi acquire'in ne yapacagini tahmin ediyor; ikisi ayrismamali.
  for (const [age, tokens, est] of [[0, 7900, 3000], [50_000, 6500, 3761], [0, 1000, 3000]]) {
    const p = freshPacer(8000);
    p.lane(M_A).spent = [{ at: Date.now() - age, tokens }];
    const predicted = p.waitEstimate(est, M_A);
    const fits = p.used(Date.now(), M_A) + est <= 8000 * A.PACER_SAFETY;
    assert.equal(predicted === 0, fits, `age=${age} tokens=${tokens} est=${est}`);
  }
});

test('CANLI SENARYO 04.10: review 39sn butceyle calisabilmeli', () => {
  // Gercek run: merge 16.1sn, vision 6505 token kaydetti, kapiya 72.2sn'de
  // gelindi, budgetLeft=39195ms. Eski sabit 55sn kapisi review'u atlamisti.
  const p = freshPacer(8000, 'qwen/qwen3.8-27b');
  p.lane('qwen/qwen3.8-27b').spent = [{ at: Date.now() - 56_100, tokens: 6505 }];
  const wait = p.waitEstimate(3761, 'qwen/qwen3.8-27b');
  assert.ok(wait < 5_000, `pacer beklemesi ~4sn olmaliydi, ${wait} geldi`);

  const budgetLeft = 39_195;
  const needs = wait + A.REVIEW_ATTEMPT_TIMEOUT_MS + A.REVIEW_TAIL_MS;
  assert.ok(needs <= budgetLeft, `review calismaliydi: gereken ${needs} > kalan ${budgetLeft}`);
  assert.ok(55_000 > budgetLeft, 'eski sabit kapi gercekten atlamis olmali');
});

test('serit gercekten doluysa review HALA atlanir', () => {
  // Kapiyi gevsetmek, zamanin olmadigi durumu gormezden gelmek degil.
  const p = freshPacer(8000, 'qwen/qwen3.8-27b');
  p.lane('qwen/qwen3.8-27b').spent = [{ at: Date.now(), tokens: 7000 }];
  const wait = p.waitEstimate(3761, 'qwen/qwen3.8-27b');
  const needs = wait + A.REVIEW_ATTEMPT_TIMEOUT_MS + A.REVIEW_TAIL_MS;
  assert.ok(needs > 39_195, `dolu seritte atlanmaliydi (gereken ${needs})`);
});

test('tek denemelik butce yetiyorsa retry kapatilir', () => {
  // reviewRetries mantiginin aynisi: iki deneme sigmazsa 1 deneme.
  const wait = 4_000;
  const twoAttempts = wait + A.REVIEW_ATTEMPT_TIMEOUT_MS * 2 + A.REVIEW_TAIL_MS;
  const oneAttempt = wait + A.REVIEW_ATTEMPT_TIMEOUT_MS + A.REVIEW_TAIL_MS;
  assert.ok(39_195 < twoAttempts, 'iki deneme sigmamali');
  assert.ok(39_195 >= oneAttempt, 'tek deneme sigmali');
});

test('hic gorulmemis model varsayilan limitle acilir', () => {
  const p = freshPacer(8000);
  const lane = p.lane('test/hic-kullanilmamis');
  assert.equal(lane.limit, A.DEFAULT_TPM_LIMIT);
  assert.equal(lane.limitKnown, false);
  assert.deepEqual(lane.spent, []);
});

test('butce doluysa acquire BEKLER, bosken beklemez', async () => {
  const p = freshPacer(8000);
  let t0 = Date.now();
  await p.acquire(1000, M_A);
  assert.ok(Date.now() - t0 < 100, 'bos butcede beklememeliydi');

  p.lane(M_A).spent = [{ at: Date.now(), tokens: 7900 }];
  t0 = Date.now();
  const waiter = p.acquire(3000, M_A);
  await Promise.race([waiter, new Promise(r => setTimeout(r, 400))]);
  assert.ok(Date.now() - t0 >= 250, 'dolu butcede beklemeliydi');
});

test('tek cagri butceden buyukse kilitlenmez', async () => {
  const p = freshPacer(8000);
  const t0 = Date.now();
  await p.acquire(99999, M_A);   // used===0 kacis yolu
  assert.ok(Date.now() - t0 < 100, 'sonsuz beklememeliydi');
});

test('bekleme tavani pencereyi ASMALI (canli logdan gelen hata)', () => {
  // 55s tavan / 60s pencere ile her uzun bekleme tanim geregi bosunaydi:
  // taze bir kayit 55s sonra hala pencere icinde kaliyordu.
  assert.ok(A.PACER_MAX_WAIT_MS > A.PACER_WINDOW_MS,
    `tavan (${A.PACER_MAX_WAIT_MS}) pencereden (${A.PACER_WINDOW_MS}) buyuk olmali`);
});

test('gereken sure tavandan buyukse HIC beklemez', async () => {
  const p = freshPacer(8000);
  p.lane(M_A).spent = [{ at: Date.now(), tokens: 7900 }];
  const t0 = Date.now();
  // acquire'i tavanin tuketildigi noktadan baslatmak icin: cok buyuk est ile
  // bile bekleme gereken sureyi asamayacagindan hizli donmeli ya da gercek
  // sureyi beklemeli — ikisi de kabul, ama 55s'lik olu bekleme OLMAMALI.
  await Promise.race([p.acquire(3000, M_A), new Promise(r => setTimeout(r, 300))]);
  const waited = Date.now() - t0;
  assert.ok(waited < 1000 || waited >= 250, 'olu bekleme olmamali');
});

test('tamamlama tahmini tavanin tamamini saymaz', () => {
  assert.ok(A.PACER_COMPLETION_FACTOR > 0 && A.PACER_COMPLETION_FACTOR < 1);
  const est = A.estimateTokens('', '', 3000);
  assert.ok(est < 3000, `tavanin tamami sayilmamali: ${est}`);
  assert.ok(est > 1000, `cok dusuk olmamali: ${est}`);
});

test('estimateTokens girdiyle birlikte buyur', () => {
  const a = A.estimateTokens('abc', 'x'.repeat(1000), 1000);
  const b = A.estimateTokens('abc', 'x'.repeat(10000), 1000);
  assert.ok(b > a, 'daha uzun girdi daha buyuk tahmin vermeli');
  // Tamamlama tavani artik PACER_COMPLETION_FACTOR ile carpiliyor, tamami degil
  assert.ok(a > 1000 * A.PACER_COMPLETION_FACTOR * 0.9, 'tamamlama butcesi dahil olmali');
  assert.ok(a < 1000 + 1000, 'tavanin tamami sayilmamali');
});

/* --------------------------------------------------------------------------
   GRAFIK KAPISI (sanitizeCharts)
   --------------------------------------------------------------------------
   Canli olcum: 30 sayfalik ders slaytindan uretilen kartta uc grafik vardi —
   "U.S. Aggregate Output 1970-2014", "Unemployment Rate", "Inflation Rate" —
   her birinin on yil etiketi ve data=[0,0,0,0,0,0,0,0,0,0] degeri. Uc tanesi
   de x ekseni boyunca duz cizgi olarak render oldu. Model sayi uydurmadigi
   icin "never fabricate" kuralina uydugunu saniyor; kapi bu yuzden promptta
   degil burada.
   ------------------------------------------------------------------------ */

// Kartta gercekten cikan grafik.
const EMPTY_CHART = {
  title: 'U.S. Aggregate Output (Real GDP) 1970-2014',
  type: 'line',
  labels: ['1970', '1975', '1980', '1985', '1990', '1995', '2000', '2005', '2010', '2014'],
  data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};

const REAL_CHART = {
  title: 'Issizlik orani',
  type: 'line',
  labels: ['1975', '1982', '2010'],
  data: [8.9, 10.6, 10.0]
};

test('sifir dolu grafik dusurulur', () => {
  const r = A.sanitizeCharts([EMPTY_CHART]);
  assert.equal(r.charts.length, 0, 'tum degerleri sifir olan grafik kalmamali');
  assert.equal(r.dropped.length, 1);
  assert.match(r.dropped[0].reason, /ayni/, `sebep yaziliyor olmali: ${r.dropped[0].reason}`);
});

test('gercek verili grafik korunur', () => {
  const r = A.sanitizeCharts([REAL_CHART]);
  assert.equal(r.charts.length, 1);
  assert.deepEqual(r.charts[0].data, [8.9, 10.6, 10.0]);
  assert.deepEqual(r.charts[0].labels, ['1975', '1982', '2010']);
});

test('kapi iyi ve kotuyu ayni listede ayirir', () => {
  const r = A.sanitizeCharts([EMPTY_CHART, REAL_CHART, EMPTY_CHART]);
  assert.equal(r.charts.length, 1, 'sadece gercek veri kalmali');
  assert.equal(r.dropped.length, 2);
});

test('tek noktali veya bos grafik dusurulur', () => {
  assert.equal(A.sanitizeCharts([{ title: 'tek', data: [5], labels: ['a'] }]).charts.length, 0);
  assert.equal(A.sanitizeCharts([{ title: 'bos', data: [], labels: [] }]).charts.length, 0);
  assert.equal(A.sanitizeCharts([{ title: 'dizi degil', data: null }]).charts.length, 0);
});

test('sayi olmayan noktalar atilir, kalan yeterliyse grafik yasar', () => {
  const r = A.sanitizeCharts([{ title: 'karisik', type: 'bar', labels: ['a', 'b', 'c'], data: [1, 'yok', 3] }]);
  assert.equal(r.charts.length, 1);
  assert.deepEqual(r.charts[0].data, [1, 3], 'sayi olmayan nokta dusmeli');
  assert.deepEqual(r.charts[0].labels, ['a', 'c'], 'etiket kendi degeriyle hizali kalmali');
});

test('gecersiz tip bar a dusurulur, negatifli pie bar olur', () => {
  assert.equal(A.sanitizeCharts([{ title: 'x', type: 'donut', labels: ['a','b'], data: [1, 2] }]).charts[0].type, 'bar');
  assert.equal(A.sanitizeCharts([{ title: 'y', type: 'pie', labels: ['a','b'], data: [-1, 2] }]).charts[0].type, 'bar');
  assert.equal(A.sanitizeCharts([{ title: 'z', type: 'pie', labels: ['a','b'], data: [1, 2] }]).charts[0].type, 'pie');
});

test('sanitizeCharts dizi olmayan girdide patlamaz', () => {
  for (const bad of [null, undefined, 'x', 42, {}]) {
    assert.deepEqual(A.sanitizeCharts(bad).charts, [], `${JSON.stringify(bad)} bos liste vermeli`);
  }
});

/* --------------------------------------------------------------------------
   MERMAID TERS OK ONARIMI
   --------------------------------------------------------------------------
   `A <--|etiket| B` Mermaid'de gecerli degil ve tek bir satir tum diyagrami
   parse edilemez hale getiriyor. Canli kartta circular-flow diyagrami tam da
   bu yuzden hic render olmadi. Dogrusu `B -->|etiket| A` — ayni anlam, gecerli
   sozdizimi — o yuzden dusurmek yerine cevriliyor.
   ------------------------------------------------------------------------ */

// Karttan birebir alindi.
const LIVE_DIAGRAM = `flowchart LR
H[Households] -->|spends on goods| F[Firms]
H -->|pays taxes| G[Government]
H <--|receives wages, dividends, interest| F
H <--|receives transfers| G`;

test('canli circular-flow diyagrami onarilip gecerli hale gelir', () => {
  const v = A.validateMermaid(LIVE_DIAGRAM);
  assert.ok(v.ok, `onarim sonrasi gecerli olmali: ${v.reason}`);
  assert.equal(v.repaired, 2, 'iki ters ok cevrilmeli');
  assert.ok(!/<--\|/.test(v.mermaid), 'ters etiketli ok kalmamali');
  assert.match(v.mermaid, /F -->\|receives wages, dividends, interest\| H/);
  assert.match(v.mermaid, /G -->\|receives transfers\| H/);
});

test('onarim yon disinda hicbir seyi degistirmez', () => {
  const v = A.validateMermaid(LIVE_DIAGRAM);
  // Zaten dogru olan iki satir aynen durmali.
  assert.match(v.mermaid, /H\[Households\] -->\|spends on goods\| F\[Firms\]/);
  assert.match(v.mermaid, /H -->\|pays taxes\| G\[Government\]/);
  // Etiket metni korunur.
  assert.ok(v.mermaid.includes('receives wages, dividends, interest'));
});

test('dogru diyagram onarimdan etkilenmez', () => {
  const clean = `flowchart TD\nA[Giris] -->|akis| B[Cikis]`;
  const v = A.validateMermaid(clean);
  assert.ok(v.ok);
  assert.equal(v.repaired, 0, 'onarilacak bir sey yoktu');
  assert.equal(v.mermaid, clean, 'gecerli kaynak aynen kalmali');
});

test('== ve -.- ok turleri de onarilir', () => {
  const r1 = A.repairMermaidArrows('A <==|x| B');
  assert.equal(r1.mermaid, 'B ==>|x| A');
  const r2 = A.repairMermaidArrows('A <-.-|x| B');
  assert.equal(r2.mermaid, 'B -.->|x| A');
});

test('onarilamayan ters ok diyagrami dusurur', () => {
  // Sag tarafta dugum yok: cevrilecek hedef yok.
  const broken = `flowchart LR\nA[Tek] <--|etiket|`;
  const v = A.validateMermaid(broken);
  assert.ok(!v.ok, 'gecersiz kalmali');
  assert.match(v.reason, /ters etiketli ok/);
});

/* --------------------------------------------------------------------------
   MERMAID ETIKET TIRNAKLAMA
   --------------------------------------------------------------------------
   `Money[Money (Financial) Market]` sozdizimi hatasi; dogrusu
   `Money["Money (Financial) Market"]`. Parantez dengesi kontrolu bunu
   yakalayamiyor (bir ac bir kapa var), o yuzden diyagram dogrulamadan geciyor
   ve Mermaid tumunu reddediyor. Canli kartta "Three Market Arenas" diyagrami
   tam bu satir yuzunden render olmadi.
   ------------------------------------------------------------------------ */

// Karttan birebir alindi.
const LIVE_ARENAS = `graph TD
Goods[Goods-and-Services Market]
Labor[Labor Market]
Money[Money (Financial) Market]
Households --> Goods
Firms --> Money`;

test('parantezli etiket tirnaklanip gecerli hale gelir', () => {
  const v = A.validateMermaid(LIVE_ARENAS);
  assert.ok(v.ok, `onarim sonrasi gecerli olmali: ${v.reason}`);
  assert.equal(v.repaired, 1, 'tek etiket onarilmali');
  assert.match(v.mermaid, /Money\["Money \(Financial\) Market"\]/);
  // Parantezsiz etiketlere dokunulmaz.
  assert.match(v.mermaid, /Goods\[Goods-and-Services Market\]/);
  assert.match(v.mermaid, /Labor\[Labor Market\]/);
});

test('ozel dugum sekilleri bozulmaz', () => {
  // Ikinci karakter etiketin degil SEKLIN parcasi; tirnaklamak bozar.
  for (const shape of ['A[(database)]', 'A[[subroutine]]', 'A((daire))', 'A{karar}']) {
    const r = A.repairMermaidLabels(shape);
    assert.equal(r.repaired, 0, `${shape} dokunulmamali`);
    assert.equal(r.mermaid, shape);
  }
});

test('zaten tirnakli etiket iki kez tirnaklanmaz', () => {
  const already = 'A["Money (Financial) Market"]';
  const r = A.repairMermaidLabels(already);
  assert.equal(r.repaired, 0);
  assert.equal(r.mermaid, already);
});

test('ok ve etiket onarimi ayni diyagramda birlikte calisir', () => {
  const both = `flowchart LR
H[Households] <--|wages| F[Firms (all sectors)]`;
  const v = A.validateMermaid(both);
  assert.ok(v.ok, `ikisi birden onarilmali: ${v.reason}`);
  assert.equal(v.repaired, 2, 'bir ok + bir etiket');
  assert.match(v.mermaid, /F\["Firms \(all sectors\)"\] -->\|wages\| H\[Households\]/);
});

test('sanitizeDiagrams onarim sayisini toplar', () => {
  const r = A.sanitizeDiagrams([
    { title: 'akis', mermaid: LIVE_DIAGRAM },
    { title: 'cop', mermaid: 'bu bir diyagram degil' }
  ]);
  assert.equal(r.diagrams.length, 1, 'gecerli olan kalmali');
  assert.equal(r.repaired, 2, 'onarim sayisi raporlanmali');
  assert.equal(r.dropped.length, 1);
});

/* --------------------------------------------------------------------------
   BOSLUK DOLDURMA KARTLARI (buildClozeCards)
   --------------------------------------------------------------------------
   Kutuphanede "Boşluk Doldurma — aktif hatırlama" diye tam bir calisma modu
   var. Uretim iki ayri sekilde bozuktu:

   1. Cumle klozlari hic calismiyordu. key_term gecisi once kosuyor ve 25-28
      maddelik gercek bir sozlukle 20 slotun hepsini yiyordu; ogrencinin
      gordugu her kart "___: <tanim>" idi, yani ANAHTAR TERIMLER listesinin
      tersten okunmus hali.
   2. Cumle gecisi yanlis kelimeyi bosaltiyordu. "ilk buyuk harfli ifade"
      ariyordu ama her cumle buyuk harfle basliyor:
          "___ five recessionary periods ..."   -> cevap: "The"
          "___ policy involves ..."             -> cevap: "Fiscal"
   ------------------------------------------------------------------------ */

const CLOZE_TERMS = [
  { term: 'Macroeconomics', definition: 'Deals with the economy as a whole.' },
  { term: 'Unemployment rate', definition: 'The percentage of the labor force that is unemployed.' },
  { term: 'Fiscal policy', definition: 'Government policies concerning taxes and spending.' },
  { term: 'Sticky prices', definition: 'Prices that do not always adjust rapidly.' },
  { term: 'Great Depression', definition: 'A period of severe economic contraction beginning in 1929.' },
  { term: 'Aggregate output', definition: 'The total quantity of goods and services produced.' }
];
const CLOZE_POINTS = [
  'The five recessionary reference periods show increases in the unemployment rate.',
  'Fiscal policy involves government taxation and spending decisions.',
  'Sticky prices can cause short-run disequilibria in supply and demand.',
  'The Great Depression began in 1929 and continued throughout the 1930s.',
  'Output is measured by aggregate output and tracked through the business cycle.'
];

test('cevap asla durak kelime olmaz', () => {
  const cards = A.buildClozeCards(undefined, CLOZE_TERMS, CLOZE_POINTS, 20);
  assert.ok(cards.length > 0, 'kart uretilmeli');
  for (const c of cards) {
    assert.ok(!/^(the|a|an|bu|bir|ve|and|of)$/i.test(c.answer.trim()),
      `durak kelime cevap olmus: "${c.answer}" — ${c.prompt}`);
  }
});

test('cok kelimeli terim ortadan bolunmez', () => {
  const cards = A.buildClozeCards(undefined, CLOZE_TERMS, CLOZE_POINTS, 20);
  const byAnswer = new Map(cards.map(c => [c.answer.toLowerCase(), c]));
  for (const whole of ['fiscal policy', 'sticky prices', 'unemployment rate', 'aggregate output']) {
    const card = byAnswer.get(whole);
    assert.ok(card, `${whole} tam haliyle sorulmali`);
    // Terimin TAMAMI bosluga alinmis olmali — yarisi istemde kalmamali.
    // (Ayni kelimenin cumlede baska bir yerde gecmesi sorun degil:
    //  "Output is measured by ___ ..." dogru bir karttir.)
    assert.ok(!new RegExp(whole.replace(/\s+/g, '\\s+'), 'i').test(card.prompt),
      `terim istemde butun halde kalmis: ${card.prompt}`);
    assert.ok(card.prompt.includes('___'), 'istemde bosluk olmali');
  }
});

test('uzun terim kisa terime tercih edilir', () => {
  const terms = [{ term: 'rate', definition: 'x' }, { term: 'unemployment rate', definition: 'y' }];
  const cards = A.buildClozeCards(undefined, terms, ['The report shows increases in the unemployment rate this year.'], 20);
  const fromPoint = cards.filter(c => c.source === 'key_point');
  assert.equal(fromPoint.length, 1);
  assert.equal(fromPoint[0].answer, 'unemployment rate', '"rate" degil tam ifade sorulmali');
});

test('cumle klozlari tanim istemlerine ezdirilmez', () => {
  // 25 terimlik gercekci bir sozluk: eskiden 20 slotun hepsini bunlar aliyordu.
  const many = Array.from({ length: 25 }, (_, i) => ({
    term: `Terim${i}`, definition: `Bu ${i} numarali kavramin aciklamasidir.`
  })).concat(CLOZE_TERMS);
  const cards = A.buildClozeCards(undefined, many, CLOZE_POINTS, 20);
  const sentence = cards.filter(c => c.source === 'key_point');
  assert.ok(sentence.length >= 4, `cumle klozu sayisi ${sentence.length} — sozluk onlari bogmamali`);
});

test('ayni terim icin tek kart uretilir', () => {
  const points = [
    'Fiscal policy involves government taxation and spending decisions.',
    'Fiscal policy is one of the two main tools of macroeconomic management.',
    'Changes in fiscal policy affect aggregate demand across the economy.'
  ];
  const cards = A.buildClozeCards(undefined, [{ term: 'Fiscal policy', definition: 'x' }], points, 20);
  const fiscal = cards.filter(c => c.answer.toLowerCase() === 'fiscal policy');
  assert.equal(fiscal.length, 1, 'ayni kelime icin tekrar tekrar sorulmamali');
});

test('model kendi kartlarini verdiyse onlar korunur', () => {
  const model = [{ id: 'm1', prompt: 'Model ___ yazdi.', answer: 'kartini', full_text: 'Model kartini yazdi.' }];
  const cards = A.buildClozeCards(model, CLOZE_TERMS, CLOZE_POINTS, 20);
  assert.equal(cards[0].answer, 'kartini', 'model kartlari basta kalmali');
  assert.equal(cards[0].source, 'model');
});

test('bos girdide patlamaz', () => {
  assert.deepEqual(A.buildClozeCards(undefined, [], [], 20), []);
  assert.deepEqual(A.buildClozeCards(undefined, null, null, 20), []);
});

// ---- cevap sizintisi (04.10.2026 canli PDF ciktisindan) -----------------
//
// Cumle icinde terim iki kez geciyorsa eskiden SADECE ilki bosaltiliyordu,
// yani sorunun icinde cevap yaziyordu. Gercek ciktidan iki ornek:
//
//   7. "...300 billion ___ in 1900 to over 17,000 billion 2009 dollars..."
//   8. "...1980-1982 ___ and again ... during the 2008-2009 recessionary
//       period."

test('tekrar eden terimin HER gecisi bosaltilir', () => {
  const text = 'Aggregate output grew from 300 billion 2009 dollars in 1900 '
    + 'to over 17000 billion 2009 dollars by 2014.';
  const cards = A.buildClozeCards(undefined, [{ term: '2009 dollars', definition: 'base year' }], [text], 20);
  const card = cards.find(c => c.source === 'key_point');
  assert.ok(card, 'cumle karti uretilmeliydi');
  assert.equal((card.prompt.match(/___/g) || []).length, 2, 'iki bosluk olmaliydi');
});

test('hicbir kartin sorusu kendi cevabini icermez', () => {
  const terms = [
    { term: '2009 dollars', definition: 'The base year used for real GDP.' },
    { term: 'recessionary period', definition: 'An interval during which the economy contracts.' },
    { term: 'unemployment rate', definition: 'The percentage of the labor force that is unemployed.' }
  ];
  const points = [
    'Aggregate output grew from 300 billion 2009 dollars in 1900 to over 17000 billion 2009 dollars by 2014.',
    'The unemployment rate peaked near 10.5% during the 1980-1982 recessionary period and again reached 10% during the 2008-2009 recessionary period.'
  ];
  for (const c of A.buildClozeCards(undefined, terms, points, 20)) {
    assert.ok(
      !A.clozeTermPattern(c.answer).test(c.prompt),
      `cevap soruda gorunuyor — answer="${c.answer}" prompt="${c.prompt}"`
    );
  }
});

test('tanim icinde tekrar eden terim de tamamen bosaltilir', () => {
  const cards = A.buildClozeCards(
    undefined,
    [{ term: 'money market', definition: 'The money market is the market where the money market clears.' }],
    [],
    20
  );
  assert.ok(!A.clozeTermPattern('money market').test(cards[0].prompt), 'tanimda cevap kalmamali');
});

test('terim yalnizca baska kelimenin icinde geciyorsa tanim kaliba duser', () => {
  // "rate" sadece "corporate" icinde geciyor: kelime siniri tutmaz, hicbir
  // sey bosalmaz. Boyle bir kartin sorusu = cevabi olurdu.
  const cards = A.buildClozeCards(
    undefined,
    [{ term: 'rate', definition: 'Applies to corporate borrowing.' }],
    [],
    20
  );
  assert.ok(cards[0].prompt.startsWith('___:'), `tanim kalibina dusmeliydi: ${cards[0].prompt}`);
  assert.equal(cards[0].full_text, 'rate: Applies to corporate borrowing.');
});

test('blankAllOccurrences kelime sinirina saygi duyar', () => {
  assert.equal(A.blankAllOccurrences('a rate and corporate rates', 'rate'), 'a ___ and corporate rates');
  // Turkce: buyuk I/i tuzagi
  assert.equal(A.blankAllOccurrences('İşsizlik ve işsizlik', 'işsizlik'), '___ ve ___');
});

test('clozeTermPattern Turkce harflerde dogru sinir kurar', () => {
  assert.ok(A.clozeTermPattern('işsizlik').test('Türkiye işsizlik oranı arttı.'));
  // "issizlikten" icindeki "issizlik" tam kelime degil, eslesmemeli
  assert.ok(!A.clozeTermPattern('işsizlik').test('issizlikten bahsediyoruz'));
  assert.ok(A.clozeTermPattern('fiscal policy').test('The fiscal policy stance'));
});

/* --------------------------------------------------------------------------
   SOZLUK MADDELERI TERIMLE ANAHTARLANIR (nearDupKeysMatch)
   --------------------------------------------------------------------------
   Yakin-kopya birlestirme term + definition metnini karsilastiriyor ve tanim
   bu metne hakim oluyor. Bir sozluk ise iliskili kavramlari kasten PARALEL
   cumlelerle tanimlar — ortusmenin tam olarak yanildigi yer.

   Referans bolumun kendi sozlugunde olculen oranlar:
       0.86  Treasury bonds, notes, or bills  <->  Corporate bonds
       0.73  Expansion or boom                <->  Contraction, recession, or slump
       0.60  Inflation                        <->  Deflation
   Ilk ikisi birlesip karttan kayboldu. Ikincisi birbirinin ZIDDI: "trough'tan
   peak'e ... grow" ile "peak'ten trough'a ... fall" neredeyse tum icerik
   kelimelerini paylasiyor.
   ------------------------------------------------------------------------ */

const GLOSSARY = [
  { term: 'Treasury bonds, notes, or bills', definition: 'Promissory notes issued by the federal government when it borrows money.' },
  { term: 'Corporate bonds', definition: 'Promissory notes issued by corporations when they borrow money.' },
  { term: 'Inflation', definition: 'An increase in the overall price level.' },
  { term: 'Deflation', definition: 'A decrease in the overall price level.' },
  { term: 'Expansion or boom', definition: 'The period in the business cycle from a trough up to a peak during which output and employment grow.' },
  { term: 'Contraction, recession, or slump', definition: 'The period in the business cycle from a peak down to a trough during which output and employment fall.' }
];
const TERM_TEXT = t => `${t.term} ${t.definition}`;
const TERM_KEY = t => String(t.term || '');

test('paralel tanimli AYRI terimler birlesmez', () => {
  const kept = A.dedupeNearDuplicates(GLOSSARY, TERM_TEXT, TERM_KEY);
  assert.equal(kept.length, GLOSSARY.length, 'altisinin de kalmasi gerek');
  for (const t of GLOSSARY) {
    assert.ok(kept.includes(t), `${t.term} dusmemeli`);
  }
});

test('zit kavramlar ozellikle birlesmez', () => {
  // Bu cift anahtar olmadan 0.73 ile birlesiyordu.
  assert.ok(!A.nearDupKeysMatch('Expansion or boom', 'Contraction, recession, or slump'));
  assert.ok(!A.nearDupKeysMatch('Inflation', 'Deflation'));
  assert.ok(!A.nearDupKeysMatch('Treasury bonds, notes, or bills', 'Corporate bonds'));
});

test('ayni terimin farkli yazilislari hala birlesir', () => {
  assert.ok(A.nearDupKeysMatch('Business cycle', 'The business cycle'), 'onek farki');
  assert.ok(A.nearDupKeysMatch('Aggregate output', 'Aggregate output (Real GDP)'), 'parantezli ek');
  assert.ok(A.nearDupKeysMatch('Sticky prices', 'Price stickiness'), 'cekim/siralama farki');
  assert.ok(A.nearDupKeysMatch('Fiscal policy', 'fiscal POLICY'), 'buyuk kucuk harf');
});

test('gercek kopyalar hala birlestirilir, uzun olani kalir', () => {
  const dupes = [
    { term: 'Business cycle', definition: 'The cycle of short-term ups and downs in the economy.' },
    { term: 'The business cycle', definition: 'The cycle of short term ups and downs in the economy over time.' }
  ];
  const kept = A.dedupeNearDuplicates(dupes, TERM_TEXT, TERM_KEY);
  assert.equal(kept.length, 1, 'kopya birlestirilmeli');
  assert.equal(kept[0].term, 'The business cycle', 'daha dolu ifade kalmali');
});

test('anahtarsiz cagri eski davranisi aynen korur', () => {
  // key_points ve quiz anahtarsiz cagiriliyor; davranislari degismemeli.
  const points = [
    'The business cycle has expansions and contractions.',
    'The business cycle contains expansions and contractions.'
  ];
  const withKey = A.dedupeNearDuplicates(points, p => p);
  assert.equal(withKey.length, 1, 'anahtarsiz metin birlestirmesi calismali');
});

test('anahtarlardan biri bossa metne gore karar verilir', () => {
  const items = [
    { term: '', definition: 'The cycle of short-term ups and downs in the economy.' },
    { term: 'Business cycle', definition: 'The cycle of short-term ups and downs in the economy.' }
  ];
  const kept = A.dedupeNearDuplicates(items, TERM_TEXT, TERM_KEY);
  assert.equal(kept.length, 1, 'bos anahtar vetoya donusmemeli');
});

/* --------------------------------------------------------------------------
   GORSELE DAYALI IDDIALARIN KAPIDAN MUAFIYETI
   --------------------------------------------------------------------------
   Kapi "belgenin METNI bu iddiayi destekliyor mu" diye soruyor; gorsel gecis
   ise tam olarak metinde OLMAYANI kurtarmak icin var. Muafiyet olmadan ikisi
   yapisal olarak birbirine calisiyor.

   Canli olcum, gorsel gecisin ilk calistigi kosu: model Sekil 20.2'nin eksen
   etiketlerinden "First oil shock" / "Second oil shock" ifadelerini okudu,
   kapi da "Oil shock" terimini uydurma diye attı. Ifade cikarilabilir metinde
   SIFIR kez geciyor, gorselde ise aciktan duruyor.
   ------------------------------------------------------------------------ */

const GATE_SOURCE = `Macroeconomics deals with the economy as a whole. Aggregate output is the total
quantity of goods and services produced. A recession is a period during which aggregate output
declines for two consecutive quarters. The unemployment rate is the percentage of the labor force
that is unemployed. Inflation is an increase in the overall price level, and deflation is a decrease.
Fiscal policy concerns taxes and spending; monetary policy concerns short-term interest rates.`;

// Guvenlik valfi, iddialarin %60'indan fazlasi dusecekse kapiyi tumden iptal
// ediyor. Gercekci bir kart gibi, metinde gecen terimlerle birlikte test et —
// yoksa tek terimli bir kurgu valfi tetikler ve kapi hic calismamis olur.
const SUPPORTED_TERMS = [
  { term: 'Aggregate output', definition: 'a' },
  { term: 'Unemployment rate', definition: 'b' },
  { term: 'Fiscal policy', definition: 'c' },
  { term: 'Monetary policy', definition: 'd' }
];

test('gorselden gelen terim kapidan gecer, metinde olmasa bile', () => {
  const terms = [...SUPPORTED_TERMS, { term: 'Oil shock', definition: 'Petrol fiyati soku' }];

  // Muafiyet yokken: uydurma sayilir.
  const without = A.applyGroundingGate(terms, [], GATE_SOURCE);
  assert.ok(!without.key_terms.some(t => t.term === 'Oil shock'), 'muafiyetsiz atilmali');
  assert.deepEqual(without.stats.droppedTerms, ['Oil shock']);

  // Muafiyetle: korunur ve KEPT sayilir.
  const vision = new Set([A.gateNormalize('Oil shock')]);
  const withExempt = A.applyGroundingGate(terms, [], GATE_SOURCE, vision);
  assert.ok(withExempt.key_terms.some(t => t.term === 'Oil shock'), 'gorsele dayali terim korunmali');
  assert.equal(withExempt.stats.termsDropped, 0);
  assert.equal(withExempt.stats.score, 100, 'gorsel katkisi skoru dusurmemeli');
});

test('gorselden gelen nokta da muaf', () => {
  const pt = 'Unemployment peaks near 10.6 percent in 1982 before falling back';
  const without = A.applyGroundingGate([], [pt], GATE_SOURCE);
  const vision = new Set([A.gateNormalize(pt)]);
  const withExempt = A.applyGroundingGate([], [pt], GATE_SOURCE, vision);
  assert.equal(withExempt.key_points.length, 1, 'gorsele dayali nokta korunmali');
  assert.ok(withExempt.key_points.length >= without.key_points.length, 'muafiyet hicbir seyi kotulestirmemeli');
});

test('muafiyet listesi gercekten uydurma olani kurtarmaz', () => {
  // Listede olmayan uydurma terim yine atilmali — muafiyet genel bir af degil.
  const terms = [
    ...SUPPORTED_TERMS,
    { term: 'Oil shock', definition: 'gorselden' },
    { term: 'Phillips egrisi', definition: 'belgede yok, gorselde de yok' }
  ];
  const r = A.applyGroundingGate(terms, [], GATE_SOURCE, new Set([A.gateNormalize('Oil shock')]));
  const kept = r.key_terms.map(t => t.term);
  assert.ok(kept.includes('Oil shock'), 'muaf olan kalmali');
  assert.ok(!kept.includes('Phillips egrisi'), 'muaf olmayan uydurma yine atilmali');
  assert.deepEqual(r.stats.droppedTerms, ['Phillips egrisi']);
});

test('bos muafiyet listesi eski davranisi aynen korur', () => {
  const terms = [{ term: 'Aggregate output', definition: 'x' }, { term: 'Oil shock', definition: 'y' }];
  const a = A.applyGroundingGate(terms, [], GATE_SOURCE);
  const b = A.applyGroundingGate(terms, [], GATE_SOURCE, new Set());
  assert.deepEqual(a.key_terms.map(t => t.term), b.key_terms.map(t => t.term));
  assert.equal(b.stats.termsKept, 1, 'metinde gecen terim yine gecmeli');
});

/* --------------------------------------------------------------------------
   GORSEL SAYFA SECIMI (selectVisualPages)
   --------------------------------------------------------------------------
   Eski secici "metni 150 karakterden az olan sayfa gorsel sayfasidir" diyordu.
   30 sayfalik referans destede sectigi iki sayfa yayincinin KAPAK slaytlariydi;
   sekil tasiyan alti sayfanin hicbiri secilmedi, cunku her sekil 200-800
   karakterlik bir altyaziyla geliyor ve hicbiri "bos" gorunmuyor.
   ------------------------------------------------------------------------ */

// Referans desteden olculen gercek degerler.
const DECK = (() => {
  const pages = Array.from({ length: 30 }, (_, i) => `Slayt ${i + 1} govdesi, duz metin.`);
  pages[9]  = 'FIGURE 20.1  A Typical Business Cycle\n' + 'x'.repeat(250);
  pages[10] = 'FIGURE 20.2  U.S. Aggregate Output\n' + 'x'.repeat(200);
  pages[15] = 'FIGURE 20.3  The Circular Flow\n' + 'x'.repeat(788);
  pages[26] = 'FIGURE 20.4  Aggregate Output\n' + 'x'.repeat(291);
  pages[27] = 'FIGURE 20.5  Unemployment Rate\n' + 'x'.repeat(222);
  pages[28] = 'FIGURE 20.6  Inflation Rate\n' + 'x'.repeat(309);
  return pages;
})();

test('kapak slaytlari degil, sekil sayfalari secilir', () => {
  // Eski seciciye gore "bos" gorunen sayfalar 0 ve 2: ikisi de kapak.
  const r = A.selectVisualPages(DECK, [0, 2], A.VISION_MAX_IMAGES);
  assert.ok(!r.indices.includes(0) && !r.indices.includes(2), 'kapak slaytlari secilmemeli');
  for (const i of r.indices) {
    assert.match(DECK[i], /^FIGURE/, `sayfa ${i} bir sekil sayfasi olmali`);
  }
});

test('en kisa altyazili sekiller tercih edilir', () => {
  // Altyazi uzunlugu, gorselin icinde ne kadar ACIKLANMAMIS icerik kaldiginin
  // olcusu: 788 karakterle anlatilmis dolasim diyagramina bakmanin degeri dusuk.
  const r = A.selectVisualPages(DECK, [], 2);
  assert.deepEqual(r.indices, [10, 27], 'Sekil 20.2 (200 krk) ve 20.5 (222 krk) secilmeli');
  assert.ok(!r.indices.includes(15), 'en uzun altyazili sekil (20.3) secilmemeli');
});

test('secim VISION_MAX_IMAGES ile sinirli', () => {
  assert.ok(A.selectVisualPages(DECK, [], A.VISION_MAX_IMAGES).indices.length <= A.VISION_MAX_IMAGES);
  assert.equal(A.selectVisualPages(DECK, [], 1).indices.length, 1);
});

test('secilen sayfalar okuma sirasinda doner', () => {
  const r = A.selectVisualPages(DECK, [], 3);
  assert.deepEqual(r.indices, [...r.indices].sort((a, b) => a - b), 'sayfa sirasi artan olmali');
});

test('sekil basligi yoksa bos sayfa yedegine duser', () => {
  const plain = ['bir', 'iki', 'uc', 'dort', 'bes'];
  const r = A.selectVisualPages(plain, [1, 3], 2);
  assert.deepEqual(r.indices, [1, 3]);
  assert.match(r.reason, /yedegi/);
});

test('FIGURE_CAPTION_RE satir basina bakar, metin icine degil', () => {
  assert.ok(A.FIGURE_CAPTION_RE.test('FIGURE 20.1 A Typical Business Cycle'));
  assert.ok(A.FIGURE_CAPTION_RE.test('onceki satir\nTable 3: Sonuclar'));
  assert.ok(A.FIGURE_CAPTION_RE.test('Şekil 4 — Akis semasi'));
  // Cumle ortasindaki kelime bir altyazi degil.
  assert.ok(!A.FIGURE_CAPTION_RE.test('see the figure above for details'));
  assert.ok(!A.FIGURE_CAPTION_RE.test('bu tabloda gosterildigi gibi'));
});

test('iki gorsel TPM tavanina sigar, uc sigmaz', () => {
  // Groq her gorseli sabit 2048 input token sayiyor ve istek basina en fazla
  // 3 kabul ediyor; 8.000 TPM'de ucu istem+tamamlama ile birlikte limiti asiyor.
  const overhead = 330 + Math.ceil(3072 * A.PACER_COMPLETION_FACTOR);
  const load = (n) => n * A.VISION_TOKENS_PER_IMAGE + overhead;
  const ceiling = Math.floor(A.DEFAULT_TPM_LIMIT * A.PACER_SAFETY);
  assert.ok(load(A.VISION_MAX_IMAGES) <= ceiling, `${A.VISION_MAX_IMAGES} gorsel tavani asmamali: ${load(A.VISION_MAX_IMAGES)} > ${ceiling}`);
  assert.ok(load(3) > A.DEFAULT_TPM_LIMIT, '3 gorsel sert limiti asmali — bu yuzden tavan 2');
});

test('gorsel gecisi anlati yazarina yer birakacak kadar butce ister', () => {
  // Gorsel gecisi ~65 sn (bekleme + cagri), anlati yazarinin kapisi 35 sn.
  assert.ok(
    A.VISUAL_MIN_BUDGET_MS >= 100_000,
    `taban ${A.VISUAL_MIN_BUDGET_MS}: ikisine birden yer kalmiyor, OZET kaybolabilir`
  );
  assert.ok(A.VISUAL_MIN_BUDGET_MS < A.PIPELINE_BUDGET_MS, 'tabandan hic gecilemezse gecis olu kod olur');
});

/* --------------------------------------------------------------------------
   TEKRARLAYAN USTBILGI/ALTBILGI TEMIZLIGI (stripRepeatedBoilerplate)
   --------------------------------------------------------------------------
   Canli olcum: 30 sayfalik Pearson ders slaytinda "Copyright © 2017 Pearson
   Education, Inc." ve "20-1 / 20-2 / ..." sayfa numarasi, modele gosterilen
   12.615 karakterin 1.455'ini yiyordu — %11,5'i, hicbiri ders materyali degil,
   ve pencere zaten hesabin dakikalik 8.000 tokeninin 6.200'unu harciyor.
   ------------------------------------------------------------------------ */

function makePagedDoc(bodies, footer) {
  return bodies
    .map((b, i) => `--- SAYFA ${i + 1} ---\n${b}\n${footer}\n${20}-${i + 1}`)
    .join('\n\n');
}

test('her sayfada tekrarlayan altbilgi silinir, icerik kalir', () => {
  const doc = makePagedDoc(
    ['Makroekonomi nedir', 'Issizlik orani', 'Enflasyon', 'Para politikasi',
     'Maliye politikasi', 'Is cevrimi', 'Durgunluk', 'Stagflasyon'],
    'Copyright © 2017 Pearson Education, Inc.'
  );
  const r = A.stripRepeatedBoilerplate(doc, 'SAYFA');
  assert.ok(r.charsSaved > 0, 'kazanc olmali');
  assert.ok(!/Pearson/.test(r.text), 'altbilgi kalmamali');
  assert.ok(!/^20-\d+$/m.test(r.text), 'sayfa numarasi kalmamali');
  // Icerik aynen durmali.
  for (const s of ['Makroekonomi nedir', 'Stagflasyon', 'Para politikasi']) {
    assert.ok(r.text.includes(s), `${s} silinmemeli`);
  }
});

test('sayfa isaretleri ve sayfa sayisi korunur', () => {
  const doc = makePagedDoc(
    ['bir', 'iki', 'uc', 'dort', 'bes', 'alti', 'yedi', 'sekiz'],
    'Copyright © 2017 Pearson Education, Inc.'
  );
  const r = A.stripRepeatedBoilerplate(doc, 'SAYFA');
  const pages = A.splitByPageMarkers(r.text, 'SAYFA');
  assert.equal(pages.length, 8, 'her sayfa isareti durmali');
  assert.deepEqual(pages.map(p => p.page), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('az sayfali belgeye dokunulmaz', () => {
  // Yargiya varacak kadar sayfa yok.
  const doc = makePagedDoc(['bir', 'iki', 'uc'], 'Ayni altbilgi');
  const r = A.stripRepeatedBoilerplate(doc, 'SAYFA');
  assert.equal(r.charsSaved, 0);
  assert.equal(r.text, doc);
});

test('sayfa isareti olmayan belgeye dokunulmaz', () => {
  const plain = 'Hic sayfa isareti olmayan duz metin.\nAyni satir\nAyni satir';
  const r = A.stripRepeatedBoilerplate(plain, 'SAYFA');
  assert.equal(r.text, plain);
  assert.equal(r.charsSaved, 0);
});

test('birkac sayfada gecen icerik satiri silinmez', () => {
  // 8 sayfanin 2'sinde gecen baslik esigin (%60) altinda.
  const bodies = ['The Three Market Arenas', 'The Three Market Arenas',
                  'a', 'b', 'c', 'd', 'e', 'f'];
  const r = A.stripRepeatedBoilerplate(makePagedDoc(bodies, 'Altbilgi satiri'), 'SAYFA');
  assert.ok(r.text.includes('The Three Market Arenas'), 'icerik basligi korunmali');
  assert.ok(!/Altbilgi satiri/.test(r.text), 'gercek altbilgi yine de silinmeli');
});

test('uzun tekrarlayan paragraf altbilgi sayilmaz', () => {
  const long = 'Bu cok uzun bir paragraf ve her sayfada tekrar ediyor olabilir ama bir ustbilgi degil cunku uzunlugu esigin ustunde kaliyor yani icerik olarak degerlendirilmeli.';
  assert.ok(long.length > 120, 'test kurgusu: esigin ustunde olmali');
  const r = A.stripRepeatedBoilerplate(
    makePagedDoc(['a', 'b', 'c', 'd', 'e', 'f'].map(x => `${x}\n${long}`), 'Kisa altbilgi'),
    'SAYFA'
  );
  assert.ok(r.text.includes(long), 'uzun paragraf korunmali');
});

test('boilerplateKey rakamlari joker yapar', () => {
  assert.equal(A.boilerplateKey('20-1'), A.boilerplateKey('20-7'));
  assert.equal(A.boilerplateKey('Sayfa 3 / 30'), A.boilerplateKey('Sayfa 11 / 30'));
  assert.notEqual(A.boilerplateKey('Enflasyon'), A.boilerplateKey('Issizlik'));
});

test('sayfa tamamen bosaltilmaz', () => {
  // Her satiri tekrarlayan bir sayfa: dedektor hatasi olma ihtimali daha
  // yuksek, ve bos sayfa o sayfaya yapilan atifi kirar.
  const doc = makePagedDoc(['Ortak', 'Ortak', 'Ortak', 'Ortak', 'Ortak', 'Ortak'], 'Altbilgi');
  const r = A.stripRepeatedBoilerplate(doc, 'SAYFA');
  for (const p of A.splitByPageMarkers(r.text, 'SAYFA')) {
    assert.ok(p.body.trim().length > 0, `sayfa ${p.page} bosalmamali`);
  }
});

/* --------------------------------------------------------------------------
   ANLATI YIL KAPISI (sanitizeNarrativeYears)
   --------------------------------------------------------------------------
   applyGroundingGate key_terms ve key_points'u denetliyor, DUZ YAZIYI degil.
   "summary" / "summary_executive" / sections[].summary kapidan SONRA anlati
   yazari tarafindan uretiliyor ve hicbir sey kontrol etmiyor. Modelin genel
   bilgisi oradan sizyor.

   Ayni 30 sayfalik belgenin 11 calistirmasinin 2'sinde, kapi her seferinde
   "25 kept / 0 dropped" derken ozette su cikti:
       "the Great Depression (1929-1933)"
   Kaynak "began in 1929 and continued throughout the 1930s" diyor; 1933
   belgede hicbir yerde gecmiyor.
   ------------------------------------------------------------------------ */

// Kaynak: 1929, 1930s, 1973, 1975, 1979, 1981, 1900, 2014, 1970 gecer.
// 1933 ve 1982 GECMEZ.
const YEAR_SOURCE = `The Great Depression The period of severe economic contraction and high
unemployment that began in 1929 and continued throughout the 1930s.
Since 1970, inflation has been high in two periods: 1973 IV-1975 IV and 1979 I-1981 IV.
U.S. Aggregate Output (Real GDP), 1900-2014.`;

test('kaynakta olmayan yil, yil-only parantezle birlikte silinir', () => {
  // Karttan birebir: U+2011 NON-BREAKING HYPHEN ile.
  const before = 'A brief history highlights the Great Depression (1929‑1933), the post-war era.';
  const r = A.scrubUnsupportedYears(before, YEAR_SOURCE);
  assert.equal(r.text, 'A brief history highlights the Great Depression, the post-war era.');
  assert.deepEqual(r.removed, ['1933']);
  assert.deepEqual(r.flagged, [], 'silinen yil ayrica isaretlenmemeli');
});

test('araligin desteklenen ucu korunur', () => {
  const r = A.scrubUnsupportedYears('The Great Depression of 1929‑1933 reshaped policy.', YEAR_SOURCE);
  assert.equal(r.text, 'The Great Depression of 1929 reshaped policy.');
  assert.deepEqual(r.removed, ['1933']);
});

test('tamamen desteklenen aralik ve parantez korunur', () => {
  const ok1 = 'High inflation ran 1973-1975 and again 1979-1981.';
  assert.equal(A.scrubUnsupportedYears(ok1, YEAR_SOURCE).text, ok1);
  const ok2 = 'The Great Depression (1929) began then.';
  assert.equal(A.scrubUnsupportedYears(ok2, YEAR_SOURCE).text, ok2);
});

test('ciplak uydurma yil silinmez, isaretlenir', () => {
  // Cumle ortasindaki yili korlemesine silmek cumleyi bozar — kapi bunu
  // bilerek yapmiyor, raporluyor.
  const before = 'Unemployment peaked in 1982 according to the chart.';
  const r = A.scrubUnsupportedYears(before, YEAR_SOURCE);
  assert.equal(r.text, before, 'metin degismemeli');
  assert.deepEqual(r.flagged, ['1982']);
  assert.deepEqual(r.removed, []);
});

test('yil disi parantezlere dokunulmaz', () => {
  for (const s of ['Three concerns (output, unemployment, inflation).', 'See note (3).', 'GDP (real).']) {
    assert.equal(A.scrubUnsupportedYears(s, YEAR_SOURCE).text, s, s);
  }
});

test('yearInSource bitisik rakamlara takilmaz', () => {
  assert.ok(A.yearInSource('1929', YEAR_SOURCE));
  assert.ok(!A.yearInSource('1933', YEAR_SOURCE));
  // "19700" icinde "1970" aranmamali
  assert.ok(!A.yearInSource('1970', 'kod 19700 olarak gecer'));
});

test('sanitizeNarrativeYears ozet, yonetici ozeti ve bolumleri kapsar', () => {
  const draft = {
    summary: 'The Great Depression (1929‑1933) was severe.',
    summary_executive: 'Covers 1929‑1933.',
    sections: [
      { heading: 'Tarih', summary: 'Stagflation followed the 1973-1975 period.' },
      { heading: 'Bos', summary: 'Hic yil yok.' }
    ],
    key_points: ['Bu alan bu kapinin isi degil (1933).']
  };
  const r = A.sanitizeNarrativeYears(draft, YEAR_SOURCE);
  assert.equal(draft.summary, 'The Great Depression was severe.');
  assert.equal(draft.summary_executive, 'Covers 1929.');
  assert.equal(draft.sections[0].summary, 'Stagflation followed the 1973-1975 period.', 'desteklenen aralik durmali');
  assert.equal(r.changed, 2, 'iki alan degismeli');
  assert.deepEqual(r.removed, ['1933']);
  // key_points applyGroundingGate'in isi — bu kapi ona dokunmamali.
  assert.match(draft.key_points[0], /1933/);
});

test('sanitizeNarrativeYears bozuk girdide patlamaz', () => {
  for (const bad of [null, undefined, 'x', 42]) {
    const r = A.sanitizeNarrativeYears(bad, YEAR_SOURCE);
    assert.equal(r.changed, 0);
  }
  // kaynak metin yoksa hicbir seyi silme
  const draft = { summary: 'Great Depression (1929-1933).' };
  A.sanitizeNarrativeYears(draft, '');
  assert.match(draft.summary, /1933/, 'kaynaksiz karar verilmemeli');
});

/* --------------------------------------------------------------------------
   PENCERE TOKEN BUTCESI
   --------------------------------------------------------------------------
   WINDOW'u buyutmek 8.000 TPM'de en degerli ayar: her fazladan pencere, isi
   degil, ~60 saniyelik bir TokenPacer beklemesi ekliyor (canli olcum: 30
   sayfalik 12.451 karakterlik belge 130 saniye surdu, 114 saniyesi bekleme).
   Ama ayni sabit tek basina TPM tavanini asarsa pencere cagrisi 429 alir ve
   payload %55'e kuculerek yeniden denenir — yani kazanc sessizce geri gider.

   Bu test o dengeyi kilitler: WINDOW, compactWindowPrompt ve pencerenin
   maxCompletionTokens degeri kaynaktan okunur, kodun KENDI estimateTokens
   fonksiyonuyla toplanir ve pacer tavaniyla karsilastirilir. Uc sayidan biri
   buyutuldugunde burasi patlar.
   ------------------------------------------------------------------------ */
const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'),
  'utf8'
);

// Sablon literalini kacislari ve ${...} ifadelerini sayarak oku.
function readTemplate(src, startIdx) {
  let out = '';
  let depth = 0;
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i++; continue; }
    if (c === '$' && src[i + 1] === '{') { depth++; i++; continue; }
    if (c === '}' && depth > 0) { depth--; continue; }
    if (c === '`' && depth === 0) break;
    out += c;
  }
  return out;
}

test('pencere token butcesi pacer tavaninin altinda', () => {
  /* 07.10.2026: WINDOW artik sabit degil, deste moduna gore iki degerden
     biri. Capa "const WINDOW = (\d+)" idi ve ternary'ye donunce "WINDOW
     sabiti bulunamadi" diye dustu — kodda sorun yokken. Taban deger
     okunur; deste modunun kendi tavan testi SLAYT DESTESI blogunda. */
  const mWindow = SRC.match(/const WINDOW = (?:deste\.isDeck \? )?(\d+)/);
  assert.ok(mWindow, 'WINDOW taban degeri bulunamadi');
  const WINDOW = Number(mWindow[1]);

  const promptIdx = SRC.indexOf('const compactWindowPrompt');
  assert.ok(promptIdx > -1, 'compactWindowPrompt bulunamadi');
  // readTemplate ${...} ifadelerini atladigi icin kosullu dallarin HER IKI
  // metnini birden sayar — yani gercek render'dan buyuk cikar. Butce kapisi
  // icin dogru yon bu: fazla tahmin guvenli taraf.
  const prompt = readTemplate(SRC, SRC.indexOf('`', promptIdx) + 1);
  assert.ok(prompt.length > 500, `compactWindowPrompt okunamadi (${prompt.length} krk)`);

  // Pencere cagrisinin kendi tamamlama tavani.
  //
  // Capa `const result = await callGroqJson(` — compactWindowPrompt'un ILK
  // gectigi yer DEGIL. 06.10.2026'da retry serit secimine bir tahmin hesabi
  // eklendi, o da compactWindowPrompt'u cagiriyor, ve indexOf artik cagriyi
  // degil o hesabi buluyordu: test "maxCompletionTokens bulunamadi" diye
  // dustu, oysa kodda bir sorun yoktu. Capa cagrinin kendisi olmali.
  const callIdx = SRC.indexOf('const result = await callGroqJson(');
  assert.ok(callIdx > -1, 'pencere callGroqJson cagrisi bulunamadi');
  assert.ok(
    SRC.slice(callIdx, callIdx + 400).includes('compactWindowPrompt(wi, windows.length)'),
    'capa dogru cagriyi gostermiyor — pencere cagrisi tasinmis olabilir'
  );
  const mCompletion = SRC.slice(callIdx, callIdx + 1500).match(/maxCompletionTokens: (\d+)/);
  assert.ok(mCompletion, 'pencere maxCompletionTokens bulunamadi');
  const maxCompletion = Number(mCompletion[1]);

  const est = A.estimateTokens(prompt, 'x'.repeat(WINDOW), maxCompletion);
  const ceiling = Math.floor(A.DEFAULT_TPM_LIMIT * A.PACER_SAFETY);

  assert.ok(
    est <= ceiling,
    `pencere butcesi tavani asiyor: WINDOW=${WINDOW}, prompt=${prompt.length} krk, ` +
    `completion=${maxCompletion} -> est=${est} > tavan=${ceiling}. ` +
    `Ucunden birini kucult, yoksa her pencere 429 alip %55'e kuculecek.`
  );

  // Alt sinir: pencereyi gereginden kucuk birakmak da bir regresyon — kullanilmayan
  // her token, 8.000 TPM'de fazladan bir ~60 saniyelik bekleme demek.
  assert.ok(
    est > ceiling * 0.7,
    `pencere butcenin ${Math.round((est / ceiling) * 100)}%'ini kullaniyor — ` +
    `WINDOW gereksiz yere kucuk, bu her belgede fazladan pencere ve fazladan bekleme demek`
  );
});

test('tek pencere kotasi parca kotasindan buyuk', () => {
  // WINDOW buyutulup belge tek pencereye sigdiginda, parca basina yazilmis
  // "5-15 key_terms" sinirinin TUM belgenin siniri haline gelmesi olculdu:
  // 2 pencere 24/25 terim verirken 1 pencere tam 15 veriyordu. Kotalar artik
  // pencere sayisina gore degisiyor; bu test o ayrimin kaybolmamasini saglar.
  const quotas = ['termQuota', 'pointQuota', 'quizQuota'];
  for (const name of quotas) {
    const m = SRC.match(new RegExp('const ' + name + ' = [^\\n]*'));
    assert.ok(m, `${name} bulunamadi`);
    const nums = m[0].match(/'(\d+)-(\d+)'/g);
    assert.ok(nums && nums.length === 2, `${name} iki kota icermeli: ${m[0]}`);
    const upper = nums.map(q => Number(q.match(/-(\d+)'/)[1]));
    const [single, multi] = upper;
    assert.ok(
      single > multi,
      `${name}: tek pencere ust siniri (${single}) parca ust sinirindan (${multi}) buyuk olmali — ` +
      `aksi halde tek pencereye sigan belge parca kotasiyla kirpilir`
    );
  }
});

test('tek pencerede prompt kendini "parca" diye tanitmaz', () => {
  // "part 1/1" ve "this part" ifadeleri, pencere TUM belge oldugunda modele
  // var olmayan baska bir parcaya ait malzemeyi atlama izni veriyor.
  const promptIdx = SRC.indexOf('const compactWindowPrompt');
  const body = SRC.slice(promptIdx, SRC.indexOf('\n\n', promptIdx));
  const bare = body
    .replace(/\$\{[^}]*\}/g, '')          // kosullu ifadeler haric
    .replace(/scopeWord\(total\)/g, '');
  assert.ok(
    !/\bthis part\b/i.test(bare),
    'prompt kosulsuz "this part" iceriyor — scopeWord(total) uzerinden gecmeli'
  );
});

test('tipik tek bolumluk belge tek pencereye sigar', () => {
  const WINDOW = Number(SRC.match(/const WINDOW = (?:deste\.isDeck \? )?(\d+)/)[1]);
  // Canli olculen referans: 30 sayfalik ders slaytindan cikan 12.451 karakter.
  // Bu belge iki pencereye bolundugunde aralarina ~60 saniyelik pacer beklemesi
  // giriyor ve PIPELINE_BUDGET_MS (110 sn) tukenip review pass hic calismiyor.
  assert.ok(
    WINDOW >= 12451,
    `WINDOW=${WINDOW}: 12.451 karakterlik referans belge yine bolunur ` +
    `ve aradaki pacer beklemesi review pass'i engeller`
  );
});

console.log('\nREVIEW BIRLESTIRME (mergeReviewOntoDraft)\n');

// 04.10.2026 canli run: review "tam JSON" dondurmesi istenirken 2500
// tamamlama tokeniyle sinirliydi; sigdirmak icin icerigi kirpti.
//   merge  : terms=26 points=14 quiz=13
//   sonra  : terms=12 points=5  quiz=5
const DRAFT = JSON.stringify({
  summary: 'x'.repeat(200),
  summary_executive: 'y'.repeat(100),
  key_terms: Array.from({ length: 26 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` })),
  key_points: Array.from({ length: 14 }, (_, i) => `p${i}`),
  quiz_questions: Array.from({ length: 13 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })),
  sections: [{ heading: 'h', summary: 's', key_points: [], outline_id: null }],
  document_type: 'lecture',
  is_quantitative: false
});

test('CANLI HATA: kisalmis review icerigi SILEMEZ', () => {
  const truncated = JSON.stringify({
    summary: 'z'.repeat(200),
    key_terms: Array.from({ length: 12 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` })),
    key_points: ['p0', 'p1', 'p2', 'p3', 'p4'],
    quiz_questions: Array.from({ length: 5 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })),
    quality_gate: { pass: true, grounded: true, issues: [] }
  });
  const { merged } = A.mergeReviewOntoDraft(DRAFT, truncated);
  const m = JSON.parse(merged);
  assert.equal(m.key_terms.length, 26, 'terimler taslaktan korunmaliydi');
  assert.equal(m.key_points.length, 14);
  assert.equal(m.quiz_questions.length, 13);
  assert.equal(m.summary, 'z'.repeat(200), 'anlatim yine de guncellenmeli');
});

test('review anlatimi duzeltirse kabul edilir', () => {
  const r = JSON.stringify({
    summary: 'Issizlik orani 1980-82 doneminde %10.5 zirve yapti. '.repeat(3),
    summary_executive: 'Duzeltilmis yonetici ozeti; taslaktakiyle ayni uzunlukta tutuldu ki uzunluk tabanina takilmasin.',
    quality_gate: { pass: true, grounded: true, issues: [] }
  });
  const m = JSON.parse(A.mergeReviewOntoDraft(DRAFT, r).merged);
  assert.ok(m.summary.includes('1980-82'));
  assert.ok(m.summary_executive.startsWith('Duzeltilmis'));
  assert.equal(m.key_terms.length, 26, 'diziler dokunulmadan gecmeli');
});

test('review diziyi buyutebilir', () => {
  const r = JSON.stringify({
    key_points: Array.from({ length: 16 }, (_, i) => `p${i}`),
    quality_gate: { pass: true, grounded: true, issues: [] }
  });
  const { merged, notes } = A.mergeReviewOntoDraft(DRAFT, r);
  assert.equal(JSON.parse(merged).key_points.length, 16);
  assert.ok(notes.some(n => n.includes('14→16')), notes.join('|'));
});

test('bozuk review JSON i taslagi bozmaz', () => {
  for (const bad of ['', '{ bu json degil', 'null', '[]']) {
    const { merged } = A.mergeReviewOntoDraft(DRAFT, bad);
    const m = JSON.parse(merged);
    assert.equal(m.key_terms.length, 26, `bozuk girdi: ${JSON.stringify(bad)}`);
    assert.equal(m.key_points.length, 14);
  }
});

test('cok kisa summary kabul edilmez', () => {
  const r = JSON.stringify({ summary: 'kisa', quality_gate: { pass: true, grounded: true, issues: [] } });
  const m = JSON.parse(A.mergeReviewOntoDraft(DRAFT, r).merged);
  assert.equal(m.summary, 'x'.repeat(200), 'taslak ozeti korunmaliydi');
});

test('quality_gate her zaman gecer', () => {
  const r = JSON.stringify({ quality_gate: { pass: false, grounded: false, issues: ['yil hatasi'] } });
  const m = JSON.parse(A.mergeReviewOntoDraft(DRAFT, r).merged);
  assert.equal(m.quality_gate.pass, false);
  assert.deepEqual(m.quality_gate.issues, ['yil hatasi']);
});

test('<think> blogu ile gelen review de okunur', () => {
  const r = '<think>dusunuyorum</think>' + JSON.stringify({
    summary: 'w'.repeat(200), quality_gate: { pass: true, grounded: true, issues: [] }
  });
  const m = JSON.parse(A.mergeReviewOntoDraft(DRAFT, r).merged);
  assert.equal(m.summary, 'w'.repeat(200));
  assert.equal(m.key_terms.length, 26);
});

test('korunan dizi notlara yazilir', () => {
  const r = JSON.stringify({ key_terms: [{ term: 'a', definition: 'b' }] });
  const { notes } = A.mergeReviewOntoDraft(DRAFT, r);
  assert.ok(notes.some(n => n.includes('KORUNDU')), notes.join('|'));
});

test('review prompt u tam JSON istemiyor', () => {
  const src = SRC;
  assert.ok(!/Return the REFINED full study-card JSON/.test(src),
    'eski "tam JSON dondur" talimati hala duruyor — kirpma riski geri gelir');
  assert.ok(/NOT yours to\nrewrite/.test(src) || /NOT yours to rewrite/.test(src),
    'review a dizileri yazmamasi soylenmeli');
});

test('CANLI HATA: review in uydurdugu (s. N) atiflari temizlenir', () => {
  // 04.10.2026: review kaynagin sadece ilk 4000 karakterini goruyor, 11
  // atifin 11'i de "(s. 1)" cikti — 30 sayfaya yayilmis bilgiler icin.
  const r = JSON.stringify({
    summary: 'Makroekonomi butunu inceler (s. 1). Is cevrimi evreleri vardir (s. 1). '
      + 'Dort sektor dolasim semasiyla gosterilir (s. 1). Maliye ve para politikasi araclardir (s. 1).',
    quality_gate: { pass: true, grounded: true, issues: [] }
  });
  const { merged, notes } = A.mergeReviewOntoDraft(DRAFT, r);
  const m = JSON.parse(merged);
  assert.ok(!/\(s\.\s*\d+\)/.test(m.summary), `atif kalmamaliydi: ${m.summary}`);
  assert.ok(m.summary.includes('Makroekonomi'), 'metnin kendisi korunmali');
  assert.ok(notes.some(n => n.includes('temizlendi')), notes.join('|'));
});

test('taslakta zaten atif varsa review inkiler korunur', () => {
  const draftWithCites = JSON.stringify({
    summary: 'Taslak metni bir atif iceriyor (s. 12). Devami da burada yeterince uzun.',
    key_terms: [{ term: 'a', definition: 'b' }], key_points: ['p'], quiz_questions: []
  });
  const r = JSON.stringify({
    summary: 'Duzeltilmis metin yine atif iceriyor (s. 14). Devami da burada yeterince uzun.'
  });
  const m = JSON.parse(A.mergeReviewOntoDraft(draftWithCites, r).merged);
  assert.ok(/\(s\.\s*14\)/.test(m.summary), 'taslak atif kullaniyorsa review inki silinmemeli');
});

test('slayt ve page bicimleri de temizlenir', () => {
  for (const unit of ['slayt 3', 'p. 9', 'sayfa 2', 'page 11']) {
    const r = JSON.stringify({
      summary: `Bu yeterince uzun bir ozet metnidir ve bir atif tasir (${unit}). Devami burada.`
    });
    const m = JSON.parse(A.mergeReviewOntoDraft(DRAFT, r).merged);
    assert.ok(!m.summary.includes(unit), `${unit} temizlenmeliydi: ${m.summary}`);
  }
});

test('temizlik sonrasi metin cok kisalirsa taslak korunur', () => {
  const r = JSON.stringify({ summary: '(s. 1) (s. 2) (s. 3) (s. 4) (s. 5) (s. 6) (s. 7) (s. 8)' });
  const m = JSON.parse(A.mergeReviewOntoDraft(DRAFT, r).merged);
  assert.equal(m.summary, 'x'.repeat(200), 'ici bosalan metin kabul edilmemeli');
});

test('review prompt u artik atif istemiyor', () => {
  assert.ok(!/append inline markers like/.test(SRC),
    'eski "atif ekle" talimati duruyor — (s. 1) sorunu geri gelir');
  assert.ok(/DO NOT ADD PAGE NUMBERS/.test(SRC), 'atif yasagi prompt ta olmali');
});

console.log('\nPROMPT ICINDE ORNEK SAYI SIZINTISI\n');

/* 04.10.2026: gorsel prompt unda ornek olarak duran
     ("unemployment peaks near 10.6% in 1982")
   ozete "10.6% in 2008-09" diye fact olarak sizdi — sayi prompt tan alinmis,
   ustelik yanlis donem. Bir talimatin icindeki somut rakam, sayfadan okunmus
   rakamdan ayirt edilemiyor. Bu testler o ornegin geri gelmesini engeller. */

// Kaynaktaki sablon literallerini (prompt lari) yorum satirlarindan ayirarak al.
function promptLiterals(src) {
  const out = [];
  const lines = src.split('\n');
  let inPrompt = false, buf = [];
  for (const l of lines) {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*')) continue;
    if (!inPrompt && /(SystemPrompt|UserPrompt|fixSys)\s*=\s*`/.test(l)) { inPrompt = true; buf = [l]; continue; }
    if (inPrompt) {
      buf.push(l);
      if (/`\s*$/.test(t) || /`$/.test(t)) { out.push(buf.join('\n')); inPrompt = false; }
    }
  }
  return out;
}

test('prompt larda ornek yuzde degeri yok', () => {
  for (const p of promptLiterals(SRC)) {
    const m = p.match(/\d{1,3}(?:[.,]\d+)?\s?%/g);
    assert.equal(m, null, `prompt ta ornek yuzde var, sizabilir: ${(m || []).join(', ')}`);
  }
});

test('gorsel prompt u 10.6 ornegini artik tasimiyor', () => {
  const vis = promptLiterals(SRC).find(p => /visualSystemPrompt/.test(p));
  assert.ok(vis, 'gorsel prompt bulunamadi — test guncel degil');
  assert.ok(!/10\.6/.test(vis), 'sizan ornek geri gelmis');
  assert.ok(/PRINTED on the image/.test(vis),
    'sayi yalnizca goruntude YAZILIYORSA verilmeli kurali eksik');
});

test('gorsel prompt u goz karari tahmini kelimeye yonlendiriyor', () => {
  const vis = promptLiterals(SRC).find(p => /visualSystemPrompt/.test(p));
  assert.ok(/relative words/.test(vis), 'goz karari degerler icin kelime alternatifi onerilmeli');
});

console.log('\nOTPM — CIKTI TOKEN KOVASI\n');

/* 04.10.2026 canli hata:
     Request too large for `qwen/qwen3.8-27b` on output tokens per minute
     (OTPM): Limit 1000, Requested 1311
   Pacer sadece TPM biliyordu, 2500 tamamlama isteyen review'u gecirdi. Her
   tier 429 aldi, her 429 sonrasi tam pencere beklendi, dongu 81 saniye surdu
   ve 150sn'lik Edge duvari fonksiyonu review'un ortasinda oldurdu — belge
   "reviewing" asamasinda asili kaldi. */

const QWEN = 'qwen/qwen3.8-27b';

test('qwen in OTPM tavani taniniyor', () => {
  assert.equal(A.MODEL_OTPM[QWEN], 1000, 'canli hata mesajindaki limit');
  const p = freshPacer(8000);
  assert.equal(p.maxCompletion(QWEN), Math.floor(1000 * A.OTPM_SAFETY));
});

test('OTPM i olmayan model sinirsiz sayilir', () => {
  const p = freshPacer(8000);
  assert.equal(p.maxCompletion('openai/gpt-oss-120b'), null, 'TPM-only model kisitlanmamali');
  assert.equal(p.clampCompletion('openai/gpt-oss-120b', 4096), 4096);
});

test('CANLI HATA: 2500 tamamlama OTPM tavanina kirpilir', () => {
  const p = freshPacer(8000);
  const clamped = p.clampCompletion(QWEN, 2500);
  assert.ok(clamped <= 1000, `2500 -> ${clamped}, 1000 tavanin altinda olmali`);
  assert.equal(clamped, 850);
});

test('review tier leri OTPM tavanini asmiyor', () => {
  // Kaynaktaki gercek tier listesi okunur: biri buyurse burasi patlar.
  const m = SRC.match(/const reviewTiers[\s\S]{0,400}?\]/);
  assert.ok(m, 'reviewTiers bulunamadi');
  const asks = [...m[0].matchAll(/maxCompletionTokens:\s*(?:Math\.min\()?(\d+)/g)].map(x => Number(x[1]));
  assert.ok(asks.length >= 3, `tier bulunamadi: ${asks}`);
  for (const a of asks) {
    assert.ok(a <= A.MODEL_OTPM[QWEN] * A.OTPM_SAFETY,
      `tier ${a} token istiyor, OTPM tavani ${A.MODEL_OTPM[QWEN] * A.OTPM_SAFETY}`);
  }
});

test('cikti butcesi dolu ise acquire OTPM icin bekler', async () => {
  const p = freshPacer(8000, QWEN);
  p.lane(QWEN).outSpent = [{ at: Date.now(), tokens: 900 }];
  const t0 = Date.now();
  const waiter = p.acquire(100, QWEN, 800);
  await Promise.race([waiter, new Promise(r => setTimeout(r, 400))]);
  assert.ok(Date.now() - t0 >= 250, 'OTPM dolu iken beklemeliydi');
});

test('waitEstimate OTPM i de hesaba katar', () => {
  const p = freshPacer(8000, QWEN);
  // TPM bos ama cikti kovasi dolu
  p.lane(QWEN).outSpent = [{ at: Date.now() - 50_000, tokens: 900 }];
  const w = p.waitEstimate(100, QWEN, 800);
  assert.ok(w > 9_000 && w < 11_500, `OTPM icin ~10sn beklenirdi, ${w} geldi`);
});

test('OTPM bos ise beklenmez', () => {
  const p = freshPacer(8000, QWEN);
  assert.equal(p.waitEstimate(100, QWEN, 800), 0);
});

test('gorsel cagrisinin ciktisi kaydediliyor (review onun arkasina gecsin)', () => {
  const p = freshPacer(8000, QWEN);
  p.record(6500, QWEN, 900);
  assert.equal(p.usedOut(Date.now(), QWEN), 900, 'cikti harcamasi ayri tutulmali');
  assert.equal(p.used(Date.now(), QWEN), 6500);
});

test('review dongusu butce bitince taslaga doner', () => {
  // Kodun kendisi kontrol edilir: tier dongusunde butce kapisi olmali.
  assert.ok(/Review tier \$\{i \+ 1\} atlandi/.test(SRC) || /Review tier .* atlandi/.test(SRC),
    'tier dongusunde butce kapisi yok — 150sn duvarina tekrar carpilir');
  assert.ok(/rawFinalContent = rawContent[\s\S]{0,40}break/.test(SRC),
    'butce bitince taslaga donulmeli');
});

console.log('\nANLATIM UZUNLUK TABANI\n');

/* 04.10.2026: narrative writer (MODEL_HEAVY, cikti siniri yok) 4 paragraflik
   ~1600 karakterlik ozet yazdi. Review ve critic ikisi de MODEL_FAST'te,
   OTPM tavani yuzunden 850 tamamlama tokeniyle sinirli, ve ikisi de ozeti
   YENIDEN YAZIYOR. Iki gecisin ardindan ozet ~560 karaktere dustu.
   Diziler bastan beri kucultmeye karsi koruluydu; anlatim degildi. */

const LONG = ('Makroekonomi butunu inceler. '.repeat(50)).trim();   // ~1400 krk

test('CANLI HATA: sikistirilmis ozet reddedilir, taslak kalir', () => {
  const draft = JSON.stringify({ summary: LONG, key_terms: [], key_points: [] });
  const squeezed = JSON.stringify({ summary: 'Makroekonomi butunu inceler. '.repeat(15) });  // ~%30
  const { merged, notes } = A.mergeReviewOntoDraft(draft, squeezed);
  assert.equal(JSON.parse(merged).summary, LONG.trim(), 'taslak anlatimi korunmaliydi');
  assert.ok(notes.some(n => n.includes('KORUNDU')), notes.join('|'));
});

test('mesru kisaltma (az budama) kabul edilir', () => {
  const draft = JSON.stringify({ summary: LONG, key_terms: [], key_points: [] });
  // %90 uzunluk: desteksiz bir cumle atilmis gibi
  const trimmed = 'Makroekonomi butunu inceler. '.repeat(46);
  const { merged } = A.mergeReviewOntoDraft(draft, JSON.stringify({ summary: trimmed }));
  assert.equal(JSON.parse(merged).summary, trimmed.trim(), 'kucuk budama kabul edilmeliydi');
});

test('tam esikte kabul edilir', () => {
  const draftText = 'a'.repeat(1000);
  const atFloor = 'b'.repeat(Math.ceil(1000 * A.NARRATIVE_MIN_KEEP_RATIO));
  const { merged } = A.mergeReviewOntoDraft(
    JSON.stringify({ summary: draftText }),
    JSON.stringify({ summary: atFloor })
  );
  assert.equal(JSON.parse(merged).summary, atFloor);
});

test('esigin bir altinda reddedilir', () => {
  const draftText = 'a'.repeat(1000);
  const below = 'b'.repeat(Math.floor(1000 * A.NARRATIVE_MIN_KEEP_RATIO) - 1);
  const { merged } = A.mergeReviewOntoDraft(
    JSON.stringify({ summary: draftText }),
    JSON.stringify({ summary: below })
  );
  assert.equal(JSON.parse(merged).summary, draftText);
});

test('taslakta ozet yoksa taban uygulanmaz', () => {
  const { merged } = A.mergeReviewOntoDraft(
    JSON.stringify({ key_terms: [] }),
    JSON.stringify({ summary: 'Yeni yazilmis yeterince uzun bir ozet metni burada duruyor.' })
  );
  assert.ok(JSON.parse(merged).summary.startsWith('Yeni yazilmis'));
});

test('critic kapisi OTPM beklemesini hesaba katiyor', () => {
  // Canli hata: waitEstimate e tamamlama gecirilmedigi icin OTPM beklemesi 0
  // sanildi, critic calisti ve acquire 60sn bekledi (run 135sn/150sn).
  assert.ok(/criticCompletion = tokenPacer\.clampCompletion/.test(SRC),
    'critic tamamlama butcesi kirpilmali');
  assert.ok(/waitEstimate\([\s\S]{0,160}?criticCompletion\s*\n?\s*\)/.test(SRC),
    'critic waitEstimate e tamamlama gecirilmeli — yoksa OTPM beklemesi gorunmez');
});

test('critic de uzunluk tabanina tabi', () => {
  assert.ok(/critic yazisi REDDEDILDI/.test(SRC), 'critic icin de taban olmali');
});

console.log('\nGUNLUK KOTA (TPD) ve RETRY-AFTER AYRISTIRMA\n');

/* 05.10.2026: gunluk token kotasi doldu (TPD 200000, kullanilan 196725).
   Kod bunu dakikalik limit sanip 3 kez denedi; her 429 tahminini DAKIKALIK
   deftere yazdi, defter doldu, pacer 60sn bekledi — bir daha, bir daha.
   Sonuc: ~2 dakika bos bekleme, ozet yok, kullaniciya sebebi soylenmeyen
   bir hata. */

test('"3m2.736s" dogru okunur (eski desen 2.7sn sanıyordu)', () => {
  assert.equal(A.parseGroqRetryAfterMs('Please try again in 3m2.736s'), 182736);
});

test('"5m16.656s" dogru okunur', () => {
  assert.equal(A.parseGroqRetryAfterMs('Please try again in 5m16.656s'), 316656);
});

test('dakikasiz sure de okunur', () => {
  assert.equal(A.parseGroqRetryAfterMs('Please try again in 42.5s'), 42500);
});

test('sure yoksa null doner', () => {
  assert.equal(A.parseGroqRetryAfterMs('Rate limit reached'), null);
  assert.equal(A.parseGroqRetryAfterMs(''), null);
});

test('eski desenin hatasi bir daha olmasin', () => {
  // Eski: /try again in ([\d.]+)s/ -> "3m2.736s" icinde "2.736s" yakalardi
  const eski = 'Please try again in 3m2.736s'.match(/try again in ([\d.]+)s/i);
  assert.ok(!eski, 'eski desen artik eslesmemeli (dakika atlaniyordu)');
});

test('TPD hatasi gunluk kota olarak taninir', () => {
  const live = 'Rate limit reached for model `openai/gpt-oss-120b` in organization '
    + '`org_x` service tier `on_demand` on tokens per day (TPD): Limit 200000, '
    + 'Used 196725, Requested 3698. Please try again in 3m2.736s';
  assert.equal(A.isDailyQuotaError(live), true);
});

test('RPD de gunluk sayilir', () => {
  assert.equal(A.isDailyQuotaError('on requests per day (RPD): Limit 1000'), true);
});

test('DAKIKALIK limitler gunluk SAYILMAZ', () => {
  const tpm = 'on tokens per minute (TPM): Limit 8000, Used 6982, Requested 3000';
  const otpm = 'on output tokens per minute (OTPM): Limit 1000, Requested 1311';
  assert.equal(A.isDailyQuotaError(tpm), false, 'TPM beklenerek asilir, durulmamali');
  assert.equal(A.isDailyQuotaError(otpm), false, 'OTPM de dakikalik');
});

test('gunluk kota yolu yeniden denemiyor ve sebebi soyluyor', () => {
  assert.ok(/GUNLUK kota \(TPD\/RPD\) doldu — yeniden denenmeyecek/.test(SRC),
    'fetchWithRetry gunluk kotada hemen donmeli');
  assert.ok(/windowResults\.length === 0 && !dailyQuotaExhausted/.test(SRC),
    'son care mini-extract gunluk kotada atlanmali');
  assert.ok(/Günlük AI kotası doldu/.test(SRC),
    'kullaniciya gercek sebep soylenmeli');
});

console.log('\nREVIEW DUZELTME LISTESI (applyCorrections)\n');

/* Review, 850 tamamlama tokeniyle ozeti BUTUN halinde geri yazamiyor:
   2157 krk ozet tek basina ~674 token, butcenin %79'u. Iki canli olcum de
   ayni: 1644->563 (%34), 2157->635 (%29). Artik cumle bazli duzeltme
   donduruyor, uzunluk yapisal olarak korunuyor. */

const SUM = 'Macroeconomics focuses on three core concerns. '
  + 'The unemployment rate peaked at roughly 10.5% in the 2008-09 downturn. '
  + 'Fiscal policy involves taxes and spending.';

test('CANLI HATA: yanlis donem cumlesi duzeltilir, uzunluk korunur', () => {
  const r = A.applyCorrections(SUM, [{
    find: 'The unemployment rate peaked at roughly 10.5% in the 2008-09 downturn.',
    replace: 'The unemployment rate peaked near 10% in 2008-09 and about 10.8% in 1980-82.'
  }]);
  assert.equal(r.applied, 1);
  assert.ok(r.text.includes('10.8% in 1980-82'));
  assert.ok(r.text.startsWith('Macroeconomics focuses'), 'bastaki cumle korunmali');
  assert.ok(r.text.endsWith('taxes and spending.'), 'sondaki cumle korunmali');
});

test('bulunamayan duzeltme metni BOZMAZ', () => {
  const r = A.applyCorrections(SUM, [{ find: 'Boyle bir cumle yok burada.', replace: 'X' }]);
  assert.equal(r.applied, 0);
  assert.equal(r.text, SUM, 'metin aynen kalmali');
  assert.equal(r.skipped.length, 1);
});

test('belirsiz (birden cok gecen) duzeltme atlanir', () => {
  const dbl = 'Ayni cumle burada. Baska sey. Ayni cumle burada.';
  const r = A.applyCorrections(dbl, [{ find: 'Ayni cumle burada.', replace: 'X' }]);
  assert.equal(r.applied, 0, 'hangisi oldugu belirsizken degistirilmemeli');
  assert.equal(r.text, dbl);
  assert.ok(r.skipped[0].includes('belirsiz'));
});

test('bosluk farki tolere edilir', () => {
  const r = A.applyCorrections(SUM, [{
    find: 'The unemployment rate peaked at roughly 10.5%   in the 2008-09 downturn.',
    replace: 'DUZELTILDI.'
  }]);
  assert.equal(r.applied, 1, 'model bosluklari yeniden akitabilir');
  assert.ok(r.text.includes('DUZELTILDI.'));
  assert.ok(r.text.startsWith('Macroeconomics focuses'));
});

test('cok kisa find reddedilir (yanlis yeri vurabilir)', () => {
  const r = A.applyCorrections(SUM, [{ find: 'the', replace: 'X' }]);
  assert.equal(r.applied, 0);
  assert.equal(r.text, SUM);
});

test('en fazla 8 duzeltme uygulanir', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ find: `cumle${i} burada.`, replace: 'X' }));
  const text = many.map((_, i) => `cumle${i} burada.`).join(' ');
  const r = A.applyCorrections(text, many);
  assert.ok(r.applied <= 8, `en fazla 8 beklenirdi, ${r.applied} uygulandi`);
});

test('bos/bozuk girdi patlamaz', () => {
  assert.equal(A.applyCorrections('', [{ find: 'a', replace: 'b' }]).applied, 0);
  assert.equal(A.applyCorrections(SUM, null).text, SUM);
  assert.equal(A.applyCorrections(SUM, 'liste degil').text, SUM);
  assert.equal(A.applyCorrections(SUM, [null, {}, { find: 'x' }]).applied, 0);
});

test('merge duzeltmeleri uygular ve uzunlugu korur', () => {
  const draft = JSON.stringify({ summary: SUM, key_terms: [], key_points: [] });
  const rev = JSON.stringify({
    corrections: [{
      find: 'The unemployment rate peaked at roughly 10.5% in the 2008-09 downturn.',
      replace: 'The unemployment rate peaked near 10% in 2008-09.'
    }],
    quality_gate: { pass: true, grounded: true, issues: [] }
  });
  const { merged, notes } = A.mergeReviewOntoDraft(draft, rev);
  const m = JSON.parse(merged);
  assert.ok(m.summary.includes('near 10% in 2008-09'), 'duzeltme uygulanmali');
  assert.ok(m.summary.includes('Macroeconomics focuses'), 'gerisi durmali');
  assert.ok(notes.some(n => n.includes('1 duzeltme uygulandi')), notes.join('|'));
});

test('review prompt u artik ozeti yeniden yazmiyor', () => {
  assert.ok(/do NOT rewrite\nthe summary/.test(SRC) || /do NOT rewrite the summary/.test(SRC),
    'prompt ta yeniden yazma yasagi olmali');
  assert.ok(/"corrections"/.test(SRC), 'duzeltme listesi istenmeli');
});

test('quality_gate verdigi her zaman loglanir', () => {
  const draft = JSON.stringify({ summary: SUM, key_terms: [], key_points: [] });
  const { notes } = A.mergeReviewOntoDraft(draft, JSON.stringify({
    corrections: [],
    quality_gate: { pass: true, grounded: true, issues: [] }
  }));
  assert.ok(notes.some(n => n.startsWith('quality_gate:')), notes.join('|'));
  assert.ok(notes.some(n => n.includes('0 sorun')), notes.join('|'));
});

test('quality_gate sorunlari loga yazilir', () => {
  const draft = JSON.stringify({ summary: SUM, key_terms: [], key_points: [] });
  const { notes } = A.mergeReviewOntoDraft(draft, JSON.stringify({
    quality_gate: { pass: false, grounded: false, issues: ['yil hatasi', 'desteksiz iddia'] }
  }));
  const line = notes.find(n => n.startsWith('quality_gate:'));
  assert.ok(line.includes('pass=false'), line);
  assert.ok(line.includes('2 sorun'), line);
  assert.ok(line.includes('yil hatasi'), line);
});

test('quality_gate hic gelmezse bu da loglanir', () => {
  const draft = JSON.stringify({ summary: SUM, key_terms: [], key_points: [] });
  const { notes } = A.mergeReviewOntoDraft(draft, JSON.stringify({ corrections: [] }));
  assert.ok(notes.some(n => n.includes('quality_gate GELMEDI')), notes.join('|'));
});

console.log('\nREVIEW E NE GONDERILIYOR\n');

/* 05.10.2026, review in kendi sikayeti loglandi:
     "The source text provided is truncated and does not contain t..."
   Hakliymis. Chunked yolda sourceTextForReview, BELGE degil pencerelerin
   kendi ozetleriydi (her biri 500 krk). Yani taslagi kaynakla degil, kendi
   ozetiyle karsilastiriyordu — her pencereye sizan bir halusinasyon
   "tam yerinde" gorunurdu. 6000 karakteri asan HER belge bu yoldan gecer. */

test('chunked yolda review e GERCEK kaynak gonderiliyor', () => {
  assert.ok(!/sourceTextForReview = windowResults\.map/.test(SRC),
    'review hala pencere ozetleriyle besleniyor — kaynakla karsilastirma yapamaz');
  assert.ok(/sourceTextForReview = extractedText/.test(SRC),
    'review kaynak metni gormeli');
});

test('review e tum taslak JSON gonderilmiyor', () => {
  assert.ok(!/Draft JSON summary:\n\$\{rawContent\}/.test(SRC),
    'tum kart hala gonderiliyor — girdi butcesinin ucte ikisi bosa gidiyor');
  assert.ok(/these two fields only/.test(SRC), 'yalnizca anlatim gonderilmeli');
});

test('tier 0 tum belgeyi kapsiyor', () => {
  const m = SRC.match(/const reviewTiers[\s\S]{0,400}?\]/);
  const srcBudgets = [...m[0].matchAll(/sourceChars:\s*(\d+)/g)].map(x => Number(x[1]));
  assert.ok(srcBudgets[0] >= 11000,
    `tier 0 kaynak butcesi ${srcBudgets[0]} — referans belge 11.050 krk, kesilmemeli`);
  assert.ok(srcBudgets[0] > srcBudgets[1] && srcBudgets[1] > srcBudgets[2], 'tier ler kuculmeli');
});

test('yeni review cagrisi TPM tavanina siginiyor', () => {
  // sistem ~2500 + tam kaynak 11050 + anlatim ~2500 + ek ~300
  const est = A.estimateTokens('x'.repeat(2500), 'y'.repeat(11050 + 2500 + 300), 850);
  const ceiling = A.DEFAULT_TPM_LIMIT * A.PACER_SAFETY;
  assert.ok(est <= ceiling, `est ${est} > tavan ${ceiling} — 429 yer`);
});

test('sekil bulgulari review e kaynak olarak gonderiliyor', () => {
  /* 05.10.2026: Figure 20.2 nin etiketleri "Korean War, Vietnam War, First
     oil shock, Second oil shock". Ozet "oil shocks of the 1970s and 2000s"
     dedi — savaslar dogru (vision grafikten okumus), "2000s" uydurma.
     Review bunu yakalayamazdi: etiketler METINDE degil, GORSELDE. */
  assert.ok(/const visionNotes/.test(SRC), 'vision bulgulari verbatim tutulmali');
  assert.ok(/visionNotes\.push/.test(SRC), 'bulgular doldurulmali');
  assert.ok(/Read from the document's FIGURES and TABLES/.test(SRC),
    'review prompt unda sekil bulgulari bolumu olmali');
  assert.ok(/equally authoritative/.test(SRC),
    'sekil bulgulari kaynak sayilmali, yoksa review dogru okumalari da eler');
});

test('vision notlari kapsamda (ReferenceError olmasin)', () => {
  // visionGroundedClaims ayni hatayi canlida yapmisti: chunked blok icinde
  // tanimlanip disarida okunmak.
  const decl = SRC.indexOf('const visionNotes');
  const use = SRC.indexOf('visionNotes.slice(0, 20)');
  assert.ok(decl > 0 && use > 0, 'ikisi de bulunmali');
  assert.ok(decl < use, 'tanim kullanimdan once gelmeli');
});

console.log('\nGROQ JSON-MOD SOZLESMESI\n');

/* 05.10.2026 canli hata:
     Groq Review API call failed (400): 'messages' must contain the word
     'json' in some form, to use 'response_format' of type 'json_object'.
   Review prompt undan tum taslak JSON unu cikarirken, "Draft JSON summary:"
   satirini da silmis oldum — ve o satir Groq un sart kostugu TEK "json"
   gecisiydi. Review butun belgelerde 400 almaya basladi, sessizce taslaga
   dondu. Prompt metni degistikce bu kolayca tekrar kirilir, o yuzden test. */

function promptStringsOf(name) {
  // Sablon literalini al; kod icindeki JSON.parse/JSON.stringify sayilmasin.
  const i = SRC.indexOf(name);
  assert.ok(i > 0, `${name} bulunamadi`);
  const start = SRC.indexOf('`', i);
  let depth = 0, end = start + 1;
  for (; end < SRC.length; end++) {
    const c = SRC[end];
    if (c === '\\') { end++; continue; }
    if (c === '$' && SRC[end + 1] === '{') { depth++; end++; continue; }
    if (c === '}' && depth > 0) { depth--; continue; }
    if (c === '`' && depth === 0) break;
  }
  return SRC.slice(start + 1, end);
}

test('review system prompt u "json" kelimesini iceriyor (Groq sarti)', () => {
  const p = promptStringsOf('const reviewSystemPrompt');
  assert.ok(/json/i.test(p),
    'response_format json_object kullanilirken mesajlarda "json" GECMELI — yoksa 400');
});

test('json_object kullanan her prompt ta "json" geciyor', () => {
  // Bildirimden sonraki genis bir dilime bakmak yeterli: bu bir regresyon
  // bekcisi, bir ayristirici degil. visualSystemPrompt `systemPrompt + ...`
  // seklinde kuruldugu icin tabanini da katiyoruz — birlestirmeyi gormeden
  // bakmak yanlis alarm veriyor (ilk denememde tam oyle oldu).
  const base = SRC.slice(SRC.indexOf('const systemPrompt ='), SRC.indexOf('const systemPrompt =') + 9000);
  const baseHasJson = /json/i.test(base);
  for (const m of SRC.matchAll(/const (\w*[Ss]ystemPrompt) = (\w+ \+ )?`/g)) {
    const [, name, inherits] = m;
    if (name === 'systemPrompt') continue;
    const own = SRC.slice(m.index, m.index + 2500);
    const ok = /json/i.test(own) || (inherits && inherits.startsWith('systemPrompt') && baseHasJson);
    assert.ok(ok, `${name} ve tabaninda "json" yok — Groq 400 doner`);
  }
});

console.log('\nIKINCI CIKARMA SERIDI (gpt-oss-20b)\n');

/* Groq konsolundan okunan org limitleri (05.10.2026):
     openai/gpt-oss-120b  30 RPM  1K RPD  8K TPM  200K TPD
     openai/gpt-oss-20b   30 RPM  1K RPD  8K TPM  200K TPD
   Birebir ayni, ve model basina olculuyor. Bir pencere ~6150 token, calisma
   butcesi 7200 -> bir seride dakikada tek pencere sigiyor. 31.817 krk'lik
   belgede 3 pencere, iki adet 60sn bekleme, 132sn, ve vision+writer+review
   butce yetmediginden atlandi. */

test('serit SIRAYA gore degil, BOS olana gore secilir', () => {
  // Ilk surum index paritesiyle seciyordu. 3 pencereli belgede W1 ve W2
  // paralel kostu ama W3 sirf indeksi cift diye yine 120b ye gitti ve bos
  // yere 60sn bekledi. Parite hangi seridin bos oldugunu bilmiyor.
  const p = freshPacer(8000, A.MODEL_HEAVY);
  p.lane(A.MODEL_EXTRACT).limit = 8000;
  const pick = (est) => {
    let best = null, bw = Infinity;
    for (const m of [A.MODEL_HEAVY, A.MODEL_EXTRACT]) {
      const w = p.waitEstimate(est, m, 3072);
      if (w < bw) { best = m; bw = w; }
    }
    return best;
  };
  assert.equal(pick(6149), A.MODEL_HEAVY, 'ikisi de bosken tercih edilen gelir');
  p.lane(A.MODEL_HEAVY).spent = [{ at: Date.now(), tokens: 6149 }];
  assert.equal(pick(6149), A.MODEL_EXTRACT, 'agir serit doluyken digerine gecmeli');
});

test('pickLane kodda gercekten kullaniliyor', () => {
  assert.ok(/function pickLane/.test(SRC), 'serit secici olmali');
  assert.ok(!/windowModel\(/.test(SRC), 'parite tabanli secim kaldirilmali');
  // Pencere seridi artik partide atanip extractWindow a geciriliyor; yeniden
  // denemede pickLane e geri dusuyor. Ikisi de olmali.
  assert.ok(/const batchLanes = batchIndices\.map\(wi => pickLane/.test(SRC),
    'parti seritleri dagitimdan once secmeli');
  assert.ok(/\(attempt === 0 && assignedLane\)/.test(SRC),
    'ilk deneme atanan seridi kullanmali');
  assert.ok(/const writerLane = pickLane/.test(SRC), 'yazar da bos serite dusebilmeli');
});

test('yazar tercihini AGIR modelden yana kullanir', () => {
  // Kalite oncelikli: iki serit de bosken 120b gelmeli.
  const i = SRC.indexOf('const writerLane = pickLane');
  assert.ok(/\[MODEL_HEAVY, MODEL_EXTRACT\]/.test(SRC.slice(i, i + 200)),
    'tercih sirasi once MODEL_HEAVY olmali');
});

test('gorsel kapisi sabit 100sn degil, olculen sure', () => {
  // 100sn kapi 110sn lik boru hattinda vision u ilk 10 saniyeye hapsediyordu;
  // cok pencereli belgede asla calisamazdi (41sn bulup atladi).
  assert.ok(/budgetLeft\(\) <= visionNeedsMs/.test(SRC), 'kapi olcume baglanmali');
  assert.ok(/VISION_CALL_MS/.test(SRC) && /NARRATIVE_WRITER_RESERVE_MS/.test(SRC),
    'cagri suresi ve yazar payi ayri ayri bellenmeli');
  assert.ok(A.VISION_CALL_MS + A.NARRATIVE_WRITER_RESERVE_MS < A.VISUAL_MIN_BUDGET_MS,
    'yeni kapi eskisinden gevsek olmali, yoksa degisiklik anlamsiz');
});

test('ikinci serit gercekten BASKA bir model', () => {
  assert.notEqual(A.MODEL_EXTRACT, A.MODEL_HEAVY, 'ayni model = ayni kova = kazanc yok');
  assert.notEqual(A.MODEL_EXTRACT, A.MODEL_FAST, 'qwen zaten vision/review de dolu');
  assert.equal(A.MODEL_EXTRACT, 'openai/gpt-oss-20b');
});

test('ardisik iki pencere ayni dakikada calisabilir', () => {
  const p = freshPacer(8000, A.MODEL_HEAVY);
  p.lane(A.MODEL_EXTRACT).limit = 8000;
  // 1. pencere agir seride harcadi
  p.lane(A.MODEL_HEAVY).spent = [{ at: Date.now(), tokens: 6149 }];
  assert.ok(p.waitEstimate(6149, A.MODEL_HEAVY) > 0, 'ayni seritte ikincisi beklerdi');
  assert.equal(p.waitEstimate(6149, A.MODEL_EXTRACT), 0, 'diger seritte beklemeden gider');
});

test('eszamanlilik iki seridin TOPLAMI', () => {
  // Tek seride bakmak eszamanliligi 1 e cakiyordu — asil hata buydu.
  const p = freshPacer(8000, A.MODEL_HEAVY);
  p.lane(A.MODEL_EXTRACT).limit = 8000;
  const tek = p.safeConcurrency(6149, A.MODEL_HEAVY);
  const toplam = [A.MODEL_HEAVY, A.MODEL_EXTRACT].reduce((n, m) => n + p.safeConcurrency(6149, m), 0);
  assert.equal(tek, 1, 'bir serit tek pencere alir');
  assert.equal(toplam, 2, 'iki serit iki pencere alir');
});

test('yazar AGIR modeli tercih eder ama ona KILITLI degil', () => {
  // Bu test once "yazar asla MODEL_EXTRACT kullanmasin" diyordu. O kural
  // 05.10.2026 olcumunde yanlis cikti: yazar 120b icin 57 saniye bekledi,
  // o sirada 20b nin seridi bosalmisti, ve bir onceki kosuda yazar tamamen
  // ATLANMIS, kart yazili ozetsiz kalmisti. 57 saniyelik kuyruk bir kalite
  // tercihi degil; "yazili ozet var mi yok mu" tercihi. Tercih sirasi
  // korunuyor, kilit kalkiyor.
  const i = SRC.indexOf('const writerLane = pickLane');
  assert.ok(i > 0, 'yazar serit secimi olmali');
  const blok = SRC.slice(i, i + 200);
  assert.ok(/\[MODEL_HEAVY, MODEL_EXTRACT\]/.test(blok),
    'MODEL_HEAVY once gelmeli — esitlikte tercih edilen o');
});

test('ayni partideki pencereler FARKLI seritlere dagilir', () => {
  /* 05.10.2026: W1 ve W2 ayni anda dagitildi, ikisi de bos serit gorup
     MODEL_HEAVY i secti -> used=10386/7200, kendi butcesini asti, ve bir
     sonraki cagri 58sn bekledi. Pacer yardim edemez: harcamayi yanit
     GELDIGINDE kaydediyor, bu kararlarin hepsi ondan once veriliyor. */
  assert.ok(/claimed\?: Set<string>/.test(SRC), 'pickLane kapilmis seritleri bilmeli');
  assert.ok(/const claimedLanes = new Set<string>\(\)/.test(SRC),
    'parti seritleri dagitimdan ONCE atanmali');
  assert.ok(/batchIndices\.map\(\(wi, bi\) => extractWindow\(wi, windows\[wi\], batchLanes\[bi\]\)\)/.test(SRC),
    'atanan serit extractWindow a gecirilmeli');
});

test('butce paylari OLCULEN degerlerden geliyor', () => {
  // Vision cagrisi dort canli kosuda 6.0-7.2sn; yazar beklemesiz 1.8sn.
  // Eski sabitler 30sn ve 40sn idi ve vision u 43sn butceyle atlattilar.
  assert.ok(A.VISION_CALL_MS <= 20_000, `vision payi ${A.VISION_CALL_MS}: olculen ~6.6sn`);
  assert.ok(A.NARRATIVE_WRITER_RESERVE_MS <= 25_000, `yazar payi ${A.NARRATIVE_WRITER_RESERVE_MS}: olculen ~1.8sn`);
  // Ama sifira da inmemeli — bekleme ayri hesaplaniyor, bu cagrinin kendisi.
  assert.ok(A.VISION_CALL_MS >= 10_000 && A.NARRATIVE_WRITER_RESERVE_MS >= 10_000,
    'olculen degerin en az bir kac kati pay kalmali');
});

test('CANLI SENARYO: 43sn butceyle vision calisabilmeli', () => {
  // Dunku kosunun tam sayilari: pacer beklemesi 0, butce 43031ms.
  const needs = 0 + A.VISION_CALL_MS + A.NARRATIVE_WRITER_RESERVE_MS;
  assert.ok(needs <= 43_031, `gereken ${needs} > 43031 — vision yine atlanir`);
});

console.log('\nUZUN BELGE: KAYIP ASAMALAR GORUNUR\n');

test('json_validate_failed yeniden denemesi OLCUME bagli', () => {
  /* 05.10.2026: W3 64.1sn de dustu, 45.9sn butce vardi, kapi 70sn istedi ->
     denenmedi, belgenin 1/3 u hic islenmedi. 70sn "bir pencere = bir tam TPM
     penceresi beklemek" varsayimindan geliyordu; iki seritte yeniden deneme
     bos serite gider, o an 0.7sn beklerdi. */
  assert.ok(/const retryNeedsMs = retryWaitMs \+ WINDOW_CALL_MS/.test(SRC),
    'yeniden deneme maliyeti olculmeli');
  assert.ok(/budgetLeft\(\) > retryNeedsMs/.test(SRC), 'kapi olculen degere bakmali');
  assert.ok(A.WINDOW_CALL_MS <= 20_000, `pencere cagrisi olculen ~3-5sn, sabit ${A.WINDOW_CALL_MS}`);
});

test('CANLI SENARYO: 45.9sn butceyle W3 yeniden denenebilmeli', () => {
  const needs = 700 + A.WINDOW_CALL_MS + A.NARRATIVE_WRITER_RESERVE_MS;
  assert.ok(needs <= 45_900, `gereken ${needs} > 45900 — dilim yine kaybolur`);
  assert.ok(70_000 > 45_900, 'eski kapi gercekten engelliyordu');
});

test('sentez ile yazar AYNI seridi kovalamiyor', () => {
  // Ikisi arka arkaya calisiyor; ikisi de MODEL_HEAVY isteyince yazar 50sn
  // bekledi. Tercih sirasi ters cevrildi: yapilandirma kucuk modele,
  // duzyazi buyuge.
  const syn = SRC.indexOf('const synLane = pickLane');
  const wrt = SRC.indexOf('const writerLane = pickLane');
  assert.ok(syn > 0 && wrt > 0, 'ikisi de serit secmeli');
  assert.ok(/\[MODEL_EXTRACT, MODEL_HEAVY\]/.test(SRC.slice(syn, syn + 160)),
    'sentez once MODEL_EXTRACT i denemeli');
  assert.ok(/\[MODEL_HEAVY, MODEL_EXTRACT\]/.test(SRC.slice(wrt, wrt + 160)),
    'yazar once MODEL_HEAVY i denemeli');
});

test('butce yuzunden atlanan asamalar karta yaziliyor', () => {
  // Uzun belge vision/yazar/review i kaybedip yine de "tam" gorunebiliyor.
  assert.ok(/const skippedStages: string\[\] = \[\]/.test(SRC));
  for (const asama of ['gorsel analiz', 'anlati yazari', 'review', 'critic']) {
    assert.ok(SRC.includes(`skippedStages.push('${asama}')`), `${asama} kaydedilmeli`);
  }
  assert.ok((SRC.match(/skipped_stages: skippedStages/g) || []).length >= 2,
    'model quality_gate i ezdiginde de korunmali');
});

test('review ve critic de serit secebiliyor', () => {
  /* Review, MODEL_FAST e sabitlenmis son cagriydi. Sabitleme gerekcesi
     "taslagin seridinden uzak dursun" idi — pickLane bunu zaten, hem de
     gercekte neyin bos oldugana bakarak yapiyor. Sabitleme ayrica review u
     vision in az once qwen de harcadigina mahkum ediyordu: 05.10.2026'da
     vision 2 saniye once bitti ve review a 58sn bekleme cikarildi. */
  assert.ok(/const reviewLane = pickLane/.test(SRC), 'review serit secmeli');
  assert.ok(/const criticLane = pickLane/.test(SRC), 'critic de secmeli');
  // Hicbir yerde MODEL_FAST e sabitlenmis cagri kalmamali (vision haric —
  // qwen tek gorme yetenekli model).
  const pinned = [...SRC.matchAll(/model: MODEL_FAST/g)].length;
  assert.equal(pinned, 1, `MODEL_FAST e sabit ${pinned} cagri var, sadece vision olmali`);
});

test('dinamik serit secen cagrida sabit reasoning_effort yok', () => {
  /* 05.10.2026 — tam bu testin yoklugu review u ekonomi belgesinde oldurdu.
     509bd5f review u serbest birakti, review gpt-oss-120b ye dustu, ve
     govdesinde elle yazilmis reasoning_effort:"none" tasidigi icin Groq
     cevap verdi:

       400  `reasoning_effort` must be one of `low`, `medium`, or `high`

     Ustelik o 400'u almak icin 52 saniyelik pacer beklemesi odenmisti.

     Kural: `model` calisma aninda secilen bir degiskense (reviewLane,
     criticLane, synLane, writerLane, windowLane) ayni govdede reasoning
     parametresi SABIT olamaz — reasoningParamsFor(lane) ile turetilmeli. */
  const LANE_VARS = /model:\s*(reviewLane|criticLane|synLane|writerLane|windowLane|MODEL_FAST|MODEL_HEAVY|MODEL_EXTRACT)\b/g;
  const ihlaller = [];
  for (const m of SRC.matchAll(LANE_VARS)) {
    // Ayni istek govdesini tara: `model:` satirindan sonraki ~700 karakter
    // bu cagrinin parametrelerini kapsiyor. YORUMLAR CIKARILIR — aksi halde
    // bu testin kendi aciklama yorumu ("reasoning_effort:\"none\" 400 doner")
    // ihlal sayiliyor; ilk kosusta tam bu oldu.
    const govde = SRC.slice(m.index, m.index + 700).replace(/\/\/[^\n]*/g, '');
    const literal = govde.match(/reasoning_effort:\s*"(\w+)"/);
    if (literal) {
      const satir = SRC.slice(0, m.index).split('\n').length;
      ihlaller.push(`satir ${satir}: model: ${m[1]} + reasoning_effort: "${literal[1]}"`);
    }
  }
  assert.equal(
    ihlaller.length, 0,
    'degisken model ile sabit reasoning_effort bir arada olamaz — ' +
    'reasoningParamsFor(model) kullan:\n  ' + ihlaller.join('\n  ')
  );
});

test('reasoningParamsFor iki model ailesini dogru ayiriyor', () => {
  const { reasoningParamsFor } = A;   // tepede bir kez yuklendi, bkz. yukarisi

  // gpt-oss: "none" KABUL ETMIYOR, en dusugu "low".
  for (const m of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
    const p = reasoningParamsFor(m);
    assert.equal(p.reasoning_effort, 'low', `${m} icin low olmali`);
    assert.equal(p.include_reasoning, false, `${m} icin dusunce blogu kapanmali`);
  }

  // qwen: varsayilan olarak dusunuyor, kapatilmali.
  assert.equal(reasoningParamsFor('qwen/qwen3.8-27b').reasoning_effort, 'none');

  // Taninmayan model: parametre GONDERILMEMELI. Desteklenmeyen bir parametre
  // 400 doner; sessizce atlamak sadece biraz reasoning tokeni maliyeti.
  assert.deepEqual(reasoningParamsFor('bilinmeyen/model-x'), {});

  // Hicbiri "none" i gpt-oss e vermemeli — kirilan tam buydu.
  for (const m of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'gpt-oss-safety']) {
    assert.notEqual(reasoningParamsFor(m).reasoning_effort, 'none',
      `${m} icin "none" 400 doner`);
  }
});

/* ==========================================================================
   CLOZE — KARTLAR ARASI CEVAP SIZMASI

   Girdi UYDURMA DEGIL: tests/fixtures/economy-chapter-20.json, 05.10.2026
   canli kosusunun gercek key_terms (29) ve key_points (16) ciktisi. Uydurma
   bir sozlukle bu hatayi uretmek zordur, cunku sizma tam olarak gercek bir
   sozlugun komsu kavramlari birbirinin icinde anmasindan doguyor.
   ========================================================================== */
const CLOZE_FIXTURE = require('./fixtures/economy-chapter-20.json');

function clozeLeaks(cards) {
  const out = [];
  for (const a of cards) {
    for (const b of cards) {
      if (a === b) continue;
      if (A.clozeTermPattern(b.answer).test(a.prompt)) {
        out.push(`${a.id} sorusu ${b.id} cevabini iceriyor: "${b.answer}"`);
      }
    }
  }
  return out;
}

test('cloze kartlari birbirinin cevabini sizdirmiyor (gercek belge verisi)', () => {
  const cards = A.buildClozeCards(
    undefined, CLOZE_FIXTURE.key_terms, CLOZE_FIXTURE.key_points, 20
  );
  const leaks = clozeLeaks(cards);
  assert.equal(
    leaks.length, 0,
    `bir kartin sorusu baska bir kartin cevabini yaziyor:\n  ${leaks.join('\n  ')}`
  );
});

test('sizma kapisi kart sayisini dusurmuyor', () => {
  // Sizan adayi YAMAMAK yerine ATLIYORUZ, bu yuzden asil risk kart kaybi.
  // Aday havuzu (29 terim + 16 nokta) maxCards tan cok buyuk oldugu icin
  // atlanan slot bir sonraki adayla doluyor: olculen sonuc 20 kart ve
  // ayni 9 key_point / 11 key_term dagilimi, sizma 4 -> 0.
  const cards = A.buildClozeCards(
    undefined, CLOZE_FIXTURE.key_terms, CLOZE_FIXTURE.key_points, 20
  );
  assert.equal(cards.length, 20, 'kapi 20 kartin tamamini uretmeye devam etmeli');
  const bySource = cards.reduce((m, c) => (m[c.source] = (m[c.source] || 0) + 1, m), {});
  assert.ok(bySource.key_point >= 8,
    `cumle klozlari ezilmemeli (key_point=${bySource.key_point})`);
  assert.ok(bySource.key_term >= 8,
    `tanim klozlari ezilmemeli (key_term=${bySource.key_term})`);
});

test('sizma kapisi gercekten sizan bir cifti reddediyor', () => {
  // Kendini dogrulayan test: kapi calismazsa yukaridaki iki yesil bir sey
  // ifade etmez. Bu cift kacinilmaz sizar — birinin tanimi otekinin terimi.
  const cards = A.buildClozeCards(undefined, [
    { term: 'fiscal policy', definition: 'Government policies concerning taxes and spending.' },
    { term: 'monetary policy', definition: 'Fiscal policy covers taxes; this one covers interest rates.' }
  ], [], 20);
  assert.equal(clozeLeaks(cards).length, 0, 'kapi bu cifti ayirmaliydi');
  assert.equal(cards.length, 1, 'ikisinden sadece biri kalmali');
});

test('atlanan aday cevabini yakmiyor', () => {
  /* seenAnswers i leak kontrolunden ONCE isaretlemek sessiz bir kayip
     uretiyordu: sizdigi icin atilan aday, cevabini "kullanilmis" sayip
     ayni terimin daha sonra TEMIZ bir karta donusmesini de engelliyordu.
     Burada "recession" once kirli bir cumlede, sonra temiz bir tanimda
     geciyor; ikincisi karta donmeli. */
  const cards = A.buildClozeCards(undefined, [
    { term: 'recession', definition: 'Two consecutive quarters of declining output.' },
    { term: 'depression', definition: 'A prolonged and deep recession.' }
  ], [], 20);
  const answers = cards.map(c => c.answer.toLowerCase());
  assert.ok(answers.includes('recession'),
    `"recession" temiz bir kart olarak kalmaliydi, kalanlar: ${JSON.stringify(answers)}`);
  assert.equal(clozeLeaks(cards).length, 0);
});

test('dusunen modele reasoning icin ayri yer veriliyor', () => {
  /* Reasoning tokenleri COMPLETION tokenidir ve gpt-oss ailesine
     "dusunme" denemiyor — en dususu "low". max_completion_tokens ikisini
     birden kapsiyor, yani butce once dusunmeye gidiyor, cevap artandan
     yaziliyor.

     Review'un 850'si qwen'in 1000'lik OTPM tavanindan turetilmisti, review
     o seride civiliyken. 509bd5f serit secmeyi acti, butce pesinden
     gitmedi, ve muhasebe belgesinde (05.10.2026) review gpt-oss-120b'ye
     dusup soyle dondu:

       400 json_validate_failed ... "failed_generation": ""

     Bozuk cevap degil — HIC cevap yok. */
  const { reviewCompletionFor, REASONING_HEADROOM } = A;
  // qwen: reasoning_effort "none" aliyor, dusunmuyor, ek yere ihtiyaci yok.
  assert.equal(reviewCompletionFor('qwen/qwen3.8-27b', 850), 850);
  // gpt-oss: dusunuyor, ustune yer eklenmeli.
  assert.equal(reviewCompletionFor('openai/gpt-oss-120b', 850), 850 + REASONING_HEADROOM);
  assert.equal(reviewCompletionFor('openai/gpt-oss-20b', 700), 700 + REASONING_HEADROOM);
  assert.ok(REASONING_HEADROOM > 0, 'dusunen model icin yer ayrilmali');
});

test('reasoning yeri serit tavanini ASMIYOR', () => {
  /* Bu testin asil isi: headroom'u buyutmek bedava degil. estimateTokens
     completion'i PACER_COMPLETION_FACTOR ile sayiyor, yani buyuyen butce
     review'un tahminini, kuyruk beklemesini ve uzun belgede atlanma
     ihtimalini buyutuyor.

     Olculen ekonomi kosusu: est=6645, completion=850.
     Metin kismi = 6645 - 850*0.6 = 6135 token.
     Serit tavani = 8000 * PACER_SAFETY.

     Ilk denemede 1200 yazmistim: est 7365 cikiyordu, yani tavanin ustu —
     bos cevabi "hic cevap yok"a cevirecekti. */
  const F = A.PACER_COMPLETION_FACTOR;
  const metinTokeni = 6645 - 850 * F;          // olculen kosudan
  const tavan = A.DEFAULT_TPM_LIMIT * A.PACER_SAFETY;
  const comp = A.reviewCompletionFor('openai/gpt-oss-120b', 850);
  const est = metinTokeni + comp * F;
  assert.ok(est <= tavan,
    `review tahmini serit tavanini asiyor: ${Math.round(est)} > ${tavan} ` +
    `(completion ${comp}) — bu haliyle review uzun belgede HIC calisamaz`);
  // Ve gercekten anlamli bir artis olmali, yoksa duzeltme bir sey yapmiyor.
  assert.ok(comp >= 850 * 1.5, 'dusunme yeri fark edilir olmali');
});

test('OTPM tavani hala ustte, headroom onu asamaz', () => {
  // qwen'in 1000'lik OTPM'i mutlak: reviewCompletionFor ondan sonra
  // clampCompletion'dan geciyor ve o sinir degismemeli.
  const tavan = A.MODEL_OTPM['qwen/qwen3.8-27b'] * A.OTPM_SAFETY;
  assert.ok(reviewSrcHas('clampCompletion(\n          reviewLane,\n          reviewCompletionFor(reviewLane'),
    'once lane sonra tavan sirasi korunmali');
  assert.ok(tavan <= 1000, 'qwen OTPM tavani 1000');
});

function reviewSrcHas(frag) { return SRC.includes(frag); }

test('reasoning maliyeti loglaniyor', () => {
  // 700 bir baslangic degeri, olcum degil. Gercek rakam loglanmadan
  // ayarlanamaz.
  assert.ok(/completion_tokens_details\?\.reasoning_tokens/.test(SRC),
    'gercek reasoning tokeni okunmali');
  assert.ok(/Review token: completion=/.test(SRC), 'olculen deger loglanmali');
});

test('grafik: uydurma ama makul sayilar kaynakta aranarak dusuruluyor', () => {
  /* Mevcut "tum degerler ayni" kontrolu modelin UYMAYA CALISIRKEN urettigi
     sifirli grafigi yakaliyor. Yakalamadigi, daha tehlikeli olani:
     goremedigi bir sekli egitimden hatirladigi makul degerlerle doldurmak.
     Sifirda duz bir cizgi bakinca bozuk gorunur; "GSYIH: 14.9, 15.4, 16.1"
     dogru gorunur ve bu belgeden degildir. */
  const kaynak = 'Toplam uretim 1929 yilinda 103 milyar dolardi, 1982 yilinda 3255 milyar dolara ulasti.';
  const uydurma = { title: 'GSYIH', type: 'line', labels: ['a','b','c'], data: [14.9, 15.4, 16.1] };
  const gercek  = { title: 'GSYIH', type: 'bar',  labels: ['1929','1982'], data: [103, 3255] };

  const r1 = A.sanitizeCharts([uydurma], kaynak);
  assert.equal(r1.charts.length, 0, 'kaynakta olmayan sayilarla grafik tutulmamali');
  assert.match(r1.dropped[0].reason, /kaynakta yok/);

  const r2 = A.sanitizeCharts([gercek], kaynak);
  assert.equal(r2.charts.length, 1, 'kaynaktan okunan grafik DUSMEMELI — yanlis pozitif en kotusu');
});

test('grafik: kaynak metin verilmezse yapisal kontroller yine calisiyor', () => {
  // Iki boru hatti buraya farkli yerlerden geliyor; metni veremeyen cagiran
  // hic kontrol degil, yapisal kontrolleri almali.
  const sifirli = { title: 'X', type: 'line', labels: ['a','b'], data: [0, 0] };
  assert.equal(A.sanitizeCharts([sifirli]).charts.length, 0, 'sifirli grafik metinsiz de dusmeli');
  const saglam = { title: 'Y', type: 'bar', labels: ['a','b'], data: [3, 7] };
  assert.equal(A.sanitizeCharts([saglam]).charts.length, 1, 'metin yoksa saglam grafik tutulmali');
});

test('sourceNumbers binlik ayraci ve yuvarlamayi tolere ediyor', () => {
  const s = A.sourceNumbers('Hasila 17,042 milyar dolar; oran %10.63 oldu.');
  assert.ok(s.has(17042), 'binlik ayraci temizlenmeli');
  assert.ok(s.has(10.63), 'ondalik korunmali');
  assert.ok(s.has(10.6), 'modelin yuvarladigi deger de okunmus sayilmali');
  assert.ok(s.has(11), 'tam sayiya yuvarlama da');
});

test('sourceNumbers gurultusu kapiyi SERTLESTIRMIYOR', () => {
  // "20-30" gibi sayfa isaretleri sete -30 olarak giriyor. Fazladan uye
  // kapiyi yalnizca MUSAMAHAKAR yapar; gercek bir grafigi dusurmez. Gatenin
  // goremedigi bir yerde hata yapacaksa, tutma yonunde yapmali.
  const az = A.sanitizeCharts([{ title: 'T', type: 'bar', labels: ['a','b'], data: [30, 40] }], 'metin 30 ve 40 iceriyor');
  const cok = A.sanitizeCharts([{ title: 'T', type: 'bar', labels: ['a','b'], data: [30, 40] }], 'metin 30 ve 40 iceriyor. Sayfa 20-30, 20-40.');
  assert.equal(az.charts.length, 1);
  assert.equal(cok.charts.length, 1, 'gurultu grafigi dusurmemeli');
});

test('pencere tekrar denemesi BUYUK modeli tercih ediyor', () => {
  /* pickLane musaitlige gore secer — ki bu hiz icin dogru, burada yanlis:
     ilk denemenin harcadigi serit tam da kacinacagi serittir, yani dusen
     bir pencere SISTEMATIK olarak kucuk modele veriliyor.

     Olculdu (06.10.2026): deneme 1 json_validate_failed verdi, tekrar
     denemesi gpt-oss-20b'ye dustu ve pencere "terms=24 points=10 quiz=0"
     dondu. Ayni belge ayni promptla bir gun once gpt-oss-120b'de quiz=10
     vermisti. Kart 13 soru yerine 3 soruyla cikti.

     Tekrar denemesi pencerenin KALITESINI kurtarmak icin var; onu zayif
     modele vermek amaci bozuyor. */
  const i = SRC.indexOf('A RETRY PREFERS THE BIG MODEL');
  assert.ok(i > -1, 'tekrar denemesi serit tercihi aciklamasi kaybolmus');
  const blok = SRC.slice(i, i + 2600);   // aciklama yorumu uzun, kodu da kapsamali
  assert.ok(/const heavyWaitMs = tokenPacer\.waitEstimate\(est, MODEL_HEAVY/.test(blok),
    'buyuk seridin beklemesi olculmeli');
  assert.ok(/windowLane = affordHeavy\s*\n?\s*\? MODEL_HEAVY/.test(blok),
    'butceye sigiyorsa MODEL_HEAVY secilmeli');
  assert.ok(/: pickLane\(\[MODEL_HEAVY, MODEL_EXTRACT\]/.test(blok),
    'sigmiyorsa eski davranisa dusulmeli — kurtarma yine de olmali');
  // Ve bekleme butceyle karsilastirilmali, korü korune beklenmemeli.
  assert.ok(/budgetLeft\(\) > heavyWaitMs \+ WINDOW_CALL_MS \+ NARRATIVE_WRITER_RESERVE_MS/.test(blok),
    'buyuk serit beklemesi butceye karsi tartilmali');
});

test('bos donen alan sessiz gecmiyor', () => {
  /* Bir pencere bir diziden bolca, otekinden HIC dondurmusse basarisiz
     olmadi — kabul edildi, birlestirildi ve yayinlandi. Logdaki tek kelime
     "ok" idi. Dolu bir dizinin yanindaki bos dizi, "bu belgede sinav sorusu
     yok" demek degil; modelin bir alani atlamasi demek. */
  assert.ok(/const emptyFields = \[/.test(SRC), 'bos alan tespiti kaldirilmis');
  assert.ok(/BOS dondu/.test(SRC), 'bos alan uyarisi loglanmali');
  // Gercekten bos bir pencereyi (hepsi sifir) uyarmamali — o zaten baska
  // yoldan basarisiz sayiliyor, iki kere bagirmak gurultu olur.
  assert.ok(/nTerms \+ nPoints \+ nQuiz > 0/.test(SRC),
    'tamamen bos pencere icin ayrica uyarilmamali');
});

console.log('\nSLAYT DESTESI TESTLERI\n');

/* 07.10.2026. Bir ekonometri ders notu ozetine gelen geri bildirim:
   "ders slaytlari daha ozet gibi kaldi", "slayt slayt degil de hangi slayt
   gerekli hangisi gereksiz iyi analiz etmeli". Sistem desteyi duz metin
   gibi isliyordu; document_type siniflandirmasi desteyi taniyor ama
   SENTEZ adiminda, yani is bittikten sonra. */

const sahteSayfa = (n, krk) => Array.from({ length: n }, (_, i) =>
  `--- SAYFA ${i + 1} ---\n${'x'.repeat(krk)}`).join('\n\n');
const sahteSlayt = (n, krk) => Array.from({ length: n }, (_, i) =>
  `--- SLAYT ${i + 1} ---\n${'x'.repeat(krk)}`).join('\n\n');

test('pptx TARTISMASIZ deste sayilir', () => {
  // Dosyanin kendisi deste; sayfa yogunlugu ne olursa olsun.
  const r = A.detectSlideDeck(sahteSlayt(3, 5000), 'SLAYT');
  assert.equal(r.isDeck, true, 'pptx her zaman deste');
  assert.equal(r.reason, 'pptx');
});

test('PDF e aktarilmis deste SEYREK SAYFADAN taniniyor', () => {
  /* Asil kazanc burada: ogrenciler slaytlari cogu zaman PDF olarak disa
     aktariyor ve o zaman isaret "SAYFA" oluyor, yani mime type hicbir sey
     soylemiyor. Deste sayfalari KISA olur. */
  const r = A.detectSlideDeck(sahteSayfa(30, 300), 'SAYFA');
  assert.equal(r.isDeck, true, `30 sayfa x 300 krk deste sayilmali (${r.reason})`);
  assert.ok(r.charsPerPage <= A.DECK_MAX_CHARS_PER_PAGE);
});

test('kitap bolumu deste SAYILMIYOR', () => {
  // Yanlis pozitif, yanlis negatiften kotu: duz metne "slaytlari grupla,
  // baslik sayfalarini atla" demek, atlanmamasi gereken seyi atlatir.
  const r = A.detectSlideDeck(sahteSayfa(30, 3000), 'SAYFA');
  assert.equal(r.isDeck, false, `30 sayfa x 3000 krk duz metin olmali (${r.reason})`);
});

test('kisa belge deste sayilmiyor', () => {
  // Iki sayfalik seyrek bir belge deste degil; alt sinir bunun icin var.
  const r = A.detectSlideDeck(sahteSayfa(3, 200), 'SAYFA');
  assert.equal(r.isDeck, false, 'sayfa sayisi esigin altinda');
  assert.ok(/sayfa az/.test(r.reason));
});

test('isaretsiz metin deste sayilmiyor', () => {
  const r = A.detectSlideDeck('Hicbir isaret icermeyen duz metin. '.repeat(50), 'SAYFA');
  assert.equal(r.isDeck, false);
  assert.equal(r.pages, 0);
});

test('TAVAN KORUNUYOR: deste promptu pencere butcesinden dusuluyor', () => {
  /* EN KRITIK TEST. Canli pencere cagrisinin butcesi:
       WINDOW/4 + prompt(527) + talimat + completion(3072) <= 7200
     WINDOW=13000 iken pay yalnizca ~351 token. Ilk yazdigim talimat ~425
     tokendi ve tavani ASACAKTI — bu projede tam bu tur tasma daha once
     pencere kaybettirdi (bkz. TokenPacer yorumlari).

     Bu test sayiyi degil ILISKIYI koruyor: talimat ne kadar buyurse
     buyusun, maliyeti pencereden dusulmus olmali. */
  const PROMPT_TOK = 527, COMPLETION = 3072, TAVAN = 7200, TABAN_PENCERE = 13000;

  for (const u of ['slide', 'page']) {
    const talimat = A.buildSlideDeckInstruction(true, u);
    const talimatTok = Math.ceil(talimat.length / 4);

    assert.ok(talimat.length <= A.DECK_PROMPT_CHARS,
      `${u}: talimat ${talimat.length} krk > ayrilan pay ${A.DECK_PROMPT_CHARS} — ` +
      `pencere butcesinden dusulen miktar yetersiz, tavan asilir`);

    const pencere = TABAN_PENCERE - A.DECK_PROMPT_CHARS;
    const toplam = Math.ceil(pencere / 4) + PROMPT_TOK + talimatTok + COMPLETION;
    assert.ok(toplam <= TAVAN,
      `${u}: deste modunda ${toplam} token > ${TAVAN} tavani`);
  }

  /* KORUNAN SEY TAVAN DEGIL, PAY. Ilk yazimda burada "dusulmezse tavan
     asilir" diye bir iddia vardi ve bu test onu CURUTTU: talimat 425'ten
     270 tokene sikistirilinca dusulmemis toplam 7119 oldu, yani tavanin
     altinda. Iddia eskimisti, test dogruydu.

     Gercek gerekce pay: duz metin yolu 351 token payla calisiyor, deste
     dusulmeden 81 token payla kalirdi. Bu promptun kendi yorumu Turkce'nin
     4 krk/token'dan kotu tokenlestigini soyluyor, yani WINDOW/4 zaten
     eksik tahmin. Deste modu, duz metnin dayandigi paydan DAHA DAR
     olmamali. */
  const payDuz = TAVAN - (Math.ceil(TABAN_PENCERE / 4) + PROMPT_TOK + COMPLETION);
  const talimatTok = Math.ceil(A.buildSlideDeckInstruction(true, 'slide').length / 4);
  const payDeste = TAVAN - (Math.ceil((TABAN_PENCERE - A.DECK_PROMPT_CHARS) / 4) +
    PROMPT_TOK + talimatTok + COMPLETION);
  assert.ok(payDeste >= payDuz,
    `deste payi ${payDeste} token, duz metin payi ${payDuz} — deste modu daha dar ` +
    `paya dusmemeli (Turkce WINDOW/4'ten kotu tokenlesiyor)`);
});

test('duz metinde talimat BOS — tek karakter maliyeti yok', () => {
  assert.equal(A.buildSlideDeckInstruction(false, 'page'), '',
    'deste olmayan belge talimatin bedelini odememeli');
});

test('talimat uc isi de istiyor', () => {
  // Geri bildirimin uc maddesi: acmak, slayt secmek, formul/tablo.
  const t = A.buildSlideDeckInstruction(true, 'slide');
  assert.ok(/EXPAND, don't compress/.test(t), 'acma talimati yok');
  assert.ok(/LONGER than/.test(t), 'ciktinin daha uzun olmasi gerektigi soylenmeli');
  assert.ok(/JUDGE \w+s: skip/.test(t), 'slayt secme talimati yok');
  assert.ok(/agenda/.test(t), 'atlanacak slayt tipleri sayilmali');
  assert.ok(/GROUP the rest by topic/.test(t), 'konuya gore gruplama talimati yok');
  assert.ok(/FORMULAS\/TABLES ARE THE LESSON/.test(t), 'formul/tablo talimati yok');
  assert.ok(/name every variable/.test(t), 'degisken aciklamasi istenmeli');
  // Pay, olculen referans belgeyi (12.451 krk) bolmemeli.
  assert.equal(13000 - A.DECK_PROMPT_CHARS, 12451,
    'deste penceresi olculen referans belgeyi tam karsilamali');
});

test('canli pencere promptuna GERCEKTEN bagli', () => {
  /* buildChunkSystemPrompt bu dosyada "NOT WIRED" olarak duruyor (satir
     ~391). Talimati oraya eklemek hicbir ise yaramazdi — ilk denemede tam
     bunu yaptim. Bu test bagin CANLI prompt'ta oldugunu dogruluyor. */
  const i = SRC.indexOf('const compactWindowPrompt = (wi: number, total: number)');
  assert.ok(i > -1, 'canli pencere promptu bulunamadi');
  const blok = SRC.slice(i, i + 600);
  assert.ok(/\$\{desteTalimati\}/.test(blok),
    'deste talimati canli prompta baglanmamis');
  // Ve pencere boyutu deste moduna gore daraltilmali.
  assert.ok(/const WINDOW = deste\.isDeck \? 13000 - DECK_PROMPT_CHARS : 13000/.test(SRC),
    'pencere deste modunda daraltilmiyor — tavan asilir');
  // Tespit pencere basina bir kez, prompt icinde degil.
  assert.ok(!/buildSlideDeckInstruction\(\s*detectSlideDeck/.test(SRC),
    'tespit her prompt cagrisinda yeniden kosuyor');
});

summary().then(() => process.exit(process.exitCode || 0));
