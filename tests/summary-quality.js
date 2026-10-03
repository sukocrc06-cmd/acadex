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
  // latex
  'stripLatexDelimiters', 'validateLatex', 'sanitizeFormulas',
  // temellendirme kapisi
  'GATE_MIN_TERMS_TO_JUDGE', 'GATE_MAX_DROP_SHARE', 'applyGroundingGate',
  // yakin kopya
  'NEAR_DUP_THRESHOLD', 'NEAR_DUP_MIN_TERMS', 'NEAR_DUP_STEM_LEN',
  'nearDupStem', 'nearDupTermSet', 'dedupeNearDuplicates'
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

summary();
