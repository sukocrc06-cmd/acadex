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
  // token hizlandirici (TPM)
  'PACER_SAFETY', 'PACER_WINDOW_MS', 'PACER_MAX_WAIT_MS', 'PACER_COMPLETION_FACTOR',
  'DEFAULT_TPM_LIMIT',
  'tokenPacer', 'estimateTokens',
  // latex
  'stripLatexDelimiters', 'validateLatex', 'sanitizeFormulas',
  // mermaid dogrulama
  'MERMAID_TYPES', 'MERMAID_REVERSE_LABELLED_EDGE', 'repairMermaidArrows',
  'MERMAID_UNQUOTED_PAREN_LABEL', 'repairMermaidLabels',
  'validateMermaid', 'sanitizeDiagrams',
  // grafik kapisi
  'CHART_TYPES', 'CHART_MIN_POINTS', 'sanitizeCharts',
  // temellendirme kapisi
  'gateNormalize', 'GATE_MIN_TERMS_TO_JUDGE', 'GATE_MAX_DROP_SHARE', 'applyGroundingGate',
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

function freshPacer(limit) {
  const p = Object.create(Object.getPrototypeOf(A.tokenPacer));
  Object.assign(p, A.tokenPacer, { limit, limitKnown: false, spent: [] });
  return p;
}

test('8000 TPM de ~5000 tokenlik cagri icin eszamanlilik 1 olur', () => {
  // Canli logdaki tam senaryo: iki pencere ayni anda atesleniyordu, ikisi de 429 aliyordu
  assert.equal(freshPacer(8000).safeConcurrency(5000), 1);
});

test('buyuk plan gercek paralelligi geri aciyor', () => {
  assert.ok(freshPacer(300000).safeConcurrency(5000) > 1, 'yuksek TPM de paralellik olmali');
});

test('safeConcurrency asla 0 donmez', () => {
  assert.equal(freshPacer(8000).safeConcurrency(999999), 1);
  assert.equal(freshPacer(8000).safeConcurrency(0), 1);
});

test('used() yalnizca 60 sn penceresini sayar', () => {
  const p = freshPacer(8000);
  const now = Date.now();
  p.spent = [
    { at: now - 90000, tokens: 5000 },   // pencere disi
    { at: now - 1000,  tokens: 3000 }    // pencere ici
  ];
  assert.equal(p.used(now), 3000, 'eski harcama dusurulmeliydi');
});

test('Groq header i varsayilan limiti ezer', () => {
  const p = freshPacer(8000);
  p.observeHeaders(new Headers({ 'x-ratelimit-limit-tokens': '300000' }));
  assert.equal(p.limit, 300000);
  assert.equal(p.limitKnown, true);
});

test('bozuk header varsayilani bozmaz', () => {
  const p = freshPacer(8000);
  p.observeHeaders(new Headers({ 'x-ratelimit-limit-tokens': 'abc' }));
  assert.equal(p.limit, 8000);
});

test('butce doluysa acquire BEKLER, bosken beklemez', async () => {
  const p = freshPacer(8000);
  let t0 = Date.now();
  await p.acquire(1000);
  assert.ok(Date.now() - t0 < 100, 'bos butcede beklememeliydi');

  p.spent = [{ at: Date.now(), tokens: 7900 }];
  t0 = Date.now();
  const waiter = p.acquire(3000);
  await Promise.race([waiter, new Promise(r => setTimeout(r, 400))]);
  assert.ok(Date.now() - t0 >= 250, 'dolu butcede beklemeliydi');
});

test('tek cagri butceden buyukse kilitlenmez', async () => {
  const p = freshPacer(8000);
  const t0 = Date.now();
  await p.acquire(99999);   // used===0 kacis yolu
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
  p.spent = [{ at: Date.now(), tokens: 7900 }];
  const t0 = Date.now();
  // acquire'i tavanin tuketildigi noktadan baslatmak icin: cok buyuk est ile
  // bile bekleme gereken sureyi asamayacagindan hizli donmeli ya da gercek
  // sureyi beklemeli — ikisi de kabul, ama 55s'lik olu bekleme OLMAMALI.
  await Promise.race([p.acquire(3000), new Promise(r => setTimeout(r, 300))]);
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
  const mWindow = SRC.match(/const WINDOW = (\d+)/);
  assert.ok(mWindow, 'WINDOW sabiti bulunamadi');
  const WINDOW = Number(mWindow[1]);

  const promptIdx = SRC.indexOf('const compactWindowPrompt');
  assert.ok(promptIdx > -1, 'compactWindowPrompt bulunamadi');
  // readTemplate ${...} ifadelerini atladigi icin kosullu dallarin HER IKI
  // metnini birden sayar — yani gercek render'dan buyuk cikar. Butce kapisi
  // icin dogru yon bu: fazla tahmin guvenli taraf.
  const prompt = readTemplate(SRC, SRC.indexOf('`', promptIdx) + 1);
  assert.ok(prompt.length > 500, `compactWindowPrompt okunamadi (${prompt.length} krk)`);

  // Pencere cagrisinin kendi tamamlama tavani (sablonun hemen sonrasindaki
  // callGroqJson blogunda).
  const callIdx = SRC.indexOf('compactWindowPrompt(wi, windows.length)');
  assert.ok(callIdx > -1, 'pencere cagrisi bulunamadi');
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
  const WINDOW = Number(SRC.match(/const WINDOW = (\d+)/)[1]);
  // Canli olculen referans: 30 sayfalik ders slaytindan cikan 12.451 karakter.
  // Bu belge iki pencereye bolundugunde aralarina ~60 saniyelik pacer beklemesi
  // giriyor ve PIPELINE_BUDGET_MS (110 sn) tukenip review pass hic calismiyor.
  assert.ok(
    WINDOW >= 12451,
    `WINDOW=${WINDOW}: 12.451 karakterlik referans belge yine bolunur ` +
    `ve aradaki pacer beklemesi review pass'i engeller`
  );
});

summary();

// Pacer testleri bilerek yarida birakilan uzun bekleme zamanlayicilari
// birakiyor (acquire icinde setTimeout). Node bu zamanlayicilar bitene kadar
// cikmaz, bu da test kosusunu dakikalarca uzatir. Testler bitti, sonuc
// exitCode'da — sureci burada kapatiyoruz.
process.exit(process.exitCode || 0);
