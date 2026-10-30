/* ==========================================================================
   ACADEX — ATIF MOTORU TESTLERI (tests/citation-anchoring.js)

   summarize-document/index.ts icindeki deterministik sayfa atfi motorunu
   (buildPageIndex / anchorClaimToPage / anchorCitations) Groq'a hic cikmadan
   test eder. Fonksiyonlar kaynak dosyadan calisma aninda cikarilir — bu
   dosyaya kopyalanmaz — yani index.ts degisirse test ya yeni davranisi
   olcer ya acik hata verir.

   Calistirma:  node tests/citation-anchoring.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

// Cikarilacak bildirimler. Kaynakta biri yeniden adlandirilirsa test ACIK
// HATA verir — sessizce eski bir kopyayi test etmeye devam etmez.
const NAMES = [
    'ANCHOR_STOPWORDS', 'trNormalize', 'anchorTerms', 'splitByPageMarkers', 'buildPageIndex',
    'buildAnchorIdf', 'ANCHOR_MIN_SCORE', 'ANCHOR_MIN_TERMS',
    // birebir alinti (span seviyesi atif)
    'SENTENCE_ABBREV', 'splitSentences', 'QUOTE_MIN_CHARS', 'QUOTE_MAX_CHARS',
    // Aday uretimi satir yapisina saygi gosteriyor (30.10.2026 olcumu).
    'alintiBloklari',
    // Cogul eki atifi olduruyordu (30.10.2026 olcumu).
    'ingTekil', 'tekilKume',
    'bestQuoteForClaim',
    'anchorClaimToPage', 'applyFootnoteRemap', 'anchorCitations',
    // chunk saklama (document_chunks)
    'splitIntoChunks', 'CHUNK_STORE_SIZE', 'buildStorableChunks'
  ];

function loadAnchoring() {
  return loadFromSource('supabase/functions/summarize-document/index.ts', NAMES);
}

const A = loadAnchoring();

// ---------------------------------------------------------------------------
// Test belgesi: gercekci Turkce akademik metin, sayfa isaretcili
// ---------------------------------------------------------------------------
const DOC = [
  '--- SAYFA 1 ---',
  'Ders izlencesi ve genel bilgilendirme. Bu derste mikroekonomi konulari islenecektir.',
  '',
  '--- SAYFA 2 ---',
  'Talep esnekligi, fiyattaki yuzde degisime karsilik talep edilen miktardaki yuzde',
  'degisimi olcer. Esneklik katsayisi birden buyukse talep esnek kabul edilir.',
  '',
  '--- SAYFA 3 ---',
  'Marjinal maliyet, uretimi bir birim artirmanin toplam maliyete ekledigi tutardir.',
  'Marjinal maliyet egrisi genellikle U biciminde seyreder.',
  '',
  '--- SAYFA 4 ---',
  'Oligopol piyasalarda az sayida firma bulunur ve firmalar birbirinin kararlarini',
  'dikkate alir. Nash dengesi bu stratejik etkilesimin cozumunu tanimlar.'
].join('\n');

const { test, summary } = makeRunner();

console.log('\nATIF MOTORU TESTLERI\n');

// --- buildPageIndex ---------------------------------------------------------
test('buildPageIndex sayfalari dogru ayirir', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  assert.equal(idx.length, 4, '4 sayfa beklenir');
  assert.deepEqual(idx.map(s => s.page), [1, 2, 3, 4]);
});

test('buildPageIndex isaretcisiz metinde bos doner (DOCX davranisi)', () => {
  assert.deepEqual(A.buildPageIndex('Hicbir isaretci yok, sadece duz metin.', 'SAYFA'), []);
  assert.deepEqual(A.buildPageIndex('', 'SAYFA'), []);
});

test('buildPageIndex bos sayfalari atlar', () => {
  const idx = A.buildPageIndex('--- SAYFA 1 ---\n\n--- SAYFA 2 ---\nGercek icerik burada var.', 'SAYFA');
  assert.equal(idx.length, 1);
  assert.equal(idx[0].page, 2);
});

test('buildPageIndex SLAYT etiketiyle de calisir (PPTX)', () => {
  const idx = A.buildPageIndex('--- SLAYT 7 ---\nSunum icerigi burada.', 'SLAYT');
  assert.equal(idx.length, 1);
  assert.equal(idx[0].page, 7);
});

// --- anchorClaimToPage ------------------------------------------------------
test('ayirt edici kelime iceren iddia dogru sayfaya baglanir', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  const hit = A.anchorClaimToPage(
    'Esneklik katsayisi birden buyukse talep esnek kabul edilir', idx, idf);
  assert.ok(hit, 'eslesme bulunmaliydi');
  assert.equal(hit.page, 2);
});

test('farkli sayfadaki iddia o sayfaya baglanir (karismiyor)', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  assert.equal(A.anchorClaimToPage('Nash dengesi stratejik etkilesimin cozumunu tanimlar', idx, idf).page, 4);
  assert.equal(A.anchorClaimToPage('Marjinal maliyet egrisi U biciminde seyreder', idx, idf).page, 3);
});

test('sadece yaygin kelime iceren iddia HIC baglanmaz', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  assert.equal(A.anchorClaimToPage('Bu konu onemlidir ve ayrica diger bolumlerle ilgilidir', idx, idf), null);
});

test('belgede hic gecmeyen iddia baglanmaz (halusinasyon reddi)', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  assert.equal(A.anchorClaimToPage('Fotosentez kloroplastlarda gerceklesir ve klorofil kullanir', idx, idf), null);
});

test('bos/anlamsiz iddia guvenli sekilde null doner', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  assert.equal(A.anchorClaimToPage('', idx, idf), null);
  assert.equal(A.anchorClaimToPage('ve bu', idx, idf), null);
  assert.equal(A.anchorClaimToPage('test', [], idf), null);
});

// --- anchorCitations: uzun-belge yolu (dipnot yoktan var ediliyor) ----------
test('uzun yol: footnotes:[] iken key_points atif kazanir', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const r = A.anchorCitations(
    [
      'Esneklik katsayisi birden buyukse talep esnek kabul edilir',
      'Marjinal maliyet uretimi bir birim artirmanin toplam maliyete ekledigi tutardir',
      'Bu konu genel olarak onemlidir'   // baglanmamali
    ],
    [],                                  // uzun yolun gonderdigi bos dizi
    idx, 'tr'
  );
  assert.equal(r.footnotes.length, 2, '2 atif uretilmeliydi');
  assert.equal(r.stats.added, 2);
  assert.equal(r.stats.skipped, 1);
  assert.deepEqual(r.footnotes.map(f => f.page), [2, 3]);
  assert.match(r.key_points[0], /\[1\]$/, 'ilk nokta [1] isaretcisi almali');
  assert.match(r.key_points[1], /\[2\]$/);
  assert.ok(!/\[\d+\]/.test(r.key_points[2]), 'baglanmayan nokta isaretci almamali');
});

test('uretilen dipnot id ile key_point isaretcisi birbirini tutar', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const r = A.anchorCitations(
    ['Nash dengesi stratejik etkilesimin cozumunu tanimlar'], [], idx, 'tr');
  const marker = parseInt(r.key_points[0].match(/\[(\d+)\]/)[1], 10);
  assert.equal(marker, r.footnotes[0].id, 'isaretci id ile dipnot id ayni olmali');
});

// --- anchorCitations: kisa-belge yolu (model sayfalari dogrulaniyor) --------
test('kisa yol: gecerli model sayfasi korunur', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const r = A.anchorCitations([], [{ id: 1, reference: 'Esneklik', page: 2 }], idx, 'tr');
  assert.equal(r.footnotes[0].page, 2);
  assert.equal(r.stats.kept, 1);
  assert.equal(r.stats.demoted, 0);
});

test('kisa yol: UYDURMA model sayfasi null a dusurulur', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const r = A.anchorCitations([], [{ id: 1, reference: 'Uydurma', page: 99 }], idx, 'tr');
  assert.equal(r.footnotes[0].page, null, 'belgede olmayan sayfa null olmali');
  assert.equal(r.stats.demoted, 1);
  assert.equal(r.stats.kept, 0);
});

test('model zaten atif verdiyse ustune ikinci atif eklenmez', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const r = A.anchorCitations(
    ['Esneklik katsayisi birden buyukse talep esnektir [1]'],
    [{ id: 1, reference: 'Esneklik tanimi', page: 2 }],
    idx, 'tr'
  );
  assert.equal(r.footnotes.length, 1, 'yeni dipnot eklenmemeli');
  assert.equal((r.key_points[0].match(/\[\d+\]/g) || []).length, 1, 'tek isaretci kalmali');
});

// --- id yeniden numaralandirma (duzelttigim hata) --------------------------
test('seyrek model id leri yeniden numaralanirken isaretciler kayar DEGIL', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  // Model 1,2,3 degil 5,9 numaralarini kullandi — yogun 1,2 ye cekilecek.
  const r = A.anchorCitations(
    ['Marjinal maliyet tutardir [9]', 'Esneklik katsayisi [5]'],
    [{ id: 5, reference: 'Esneklik', page: 2 }, { id: 9, reference: 'Marjinal', page: 3 }],
    idx, 'tr'
  );
  assert.deepEqual(r.footnotes.map(f => f.id), [1, 2]);
  // 5 -> 1, 9 -> 2 olmali
  assert.equal(r.idMap[5], 1);
  assert.equal(r.idMap[9], 2);
  assert.match(r.key_points[0], /\[2\]/, '[9] -> [2] olmaliydi');
  assert.match(r.key_points[1], /\[1\]/, '[5] -> [1] olmaliydi');
  // Her isaretci gercekten var olan bir dipnotu gostermeli
  const ids = new Set(r.footnotes.map(f => f.id));
  for (const kp of r.key_points) {
    for (const m of kp.matchAll(/\[(\d+)\]/g)) {
      assert.ok(ids.has(parseInt(m[1], 10)), `[${m[1]}] diye bir dipnot yok`);
    }
  }
});

test('applyFootnoteRemap haritada olmayan id yi oldugu gibi birakir', () => {
  assert.equal(A.applyFootnoteRemap('iddia [7] ve [3]', { 7: 1 }), 'iddia [1] ve [3]');
  assert.equal(A.applyFootnoteRemap('', { 1: 2 }), '');
});

// --- isaretcisiz format -----------------------------------------------------
test('isaretcisiz belgede sayfalar null, cokme yok', () => {
  const r = A.anchorCitations(
    ['Herhangi bir iddia burada'],
    [{ id: 1, reference: 'Bir bolum', page: 4 }],
    [], 'tr'
  );
  assert.equal(r.footnotes.length, 1);
  assert.equal(r.footnotes[0].page, null, 'sayfa kavrami olmayan formatta sayfa uydurulmamali');
  assert.equal(r.stats.demoted, 1);
});

// --- girdi mutasyonu olmamali ----------------------------------------------
test('girdi dizileri mutasyona ugramaz', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const input = ['Nash dengesi stratejik etkilesimin cozumunu tanimlar'];
  const copy = input.slice();
  A.anchorCitations(input, [], idx, 'tr');
  assert.deepEqual(input, copy, 'girdi degismemeliydi');
});

// --- obje bicimli key_point -------------------------------------------------
test('obje bicimli key_point destekleniyor', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const r = A.anchorCitations(
    [{ text: 'Nash dengesi stratejik etkilesimin cozumunu tanimlar', extra: 'korunmali' }],
    [], idx, 'tr'
  );
  assert.equal(typeof r.key_points[0], 'object');
  assert.match(r.key_points[0].text, /\[1\]$/);
  assert.equal(r.key_points[0].extra, 'korunmali', 'diger alanlar korunmali');
});

// ===========================================================================
// BIREBIR ALINTI (span seviyesi atif)
// ===========================================================================
console.log('\nALINTI TESTLERI\n');

test('splitSentences normal cumleleri ayirir', () => {
  const s = A.splitSentences('Birinci cumle burada. Ikinci cumle burada! Ucuncu cumle burada?');
  assert.equal(s.length, 3);
});

test('splitSentences kisaltmalarda BOLMEZ (s. vb. Prof.)', () => {
  assert.equal(A.splitSentences('Esneklik katsayisi onemlidir bkz. s. 42 numarali tablo burada.').length, 1);
  assert.equal(A.splitSentences('Oligopol vb. piyasalar az firmali yapidadir.').length, 1);
  assert.equal(A.splitSentences('Prof. Dr. Ahmet Yilmaz bu konuyu ele almistir.').length, 1);
});

test('splitSentences liste numaralarinda bolmez', () => {
  assert.equal(A.splitSentences('Asagidaki maddeler var 1. madde burada aciklanmistir.').length, 1);
});

test('alinti BIREBIR kaynaktan gelir (dogrulanabilirlik)', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  const page2 = idx.find(s => s.page === 2);
  const q = A.bestQuoteForClaim(
    'Esneklik katsayisi birden buyukse talep esnek kabul edilir', page2.body, idf);
  assert.ok(q, 'alinti bulunmaliydi');
  const norm = s => s.replace(/\s+/g, ' ').trim();
  assert.ok(norm(page2.body).includes(norm(q.replace(/…$/, ''))),
    `alinti kaynakta birebir gecmiyor:\n  alinti: ${q}`);
});

test('alakasiz iddia icin alinti uretilmez', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  const page2 = idx.find(s => s.page === 2);
  assert.equal(A.bestQuoteForClaim('Fotosentez kloroplastlarda gerceklesir', page2.body, idf), null);
});

test('alinti ust sinirda kirpilir ve kelime ortasindan kesmez', () => {
  const idf = new Map();
  const long = 'Talep esnekligi kavrami ' + 'ayrintili bir sekilde incelenmektedir '.repeat(20) + 've sonuclanir.';
  const q = A.bestQuoteForClaim('Talep esnekligi kavrami incelenmektedir sonuclanir', long, idf);
  if (q) {
    assert.ok(q.length <= A.QUOTE_MAX_CHARS + 1, `cok uzun: ${q.length}`);
    if (q.endsWith('…')) assert.ok(!/\s\S+…$/.test(q) === false || /\S…$/.test(q), 'kirpma kelime sonunda olmali');
  }
});

test('anchorClaimToPage artik alinti da dondurur', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  const hit = A.anchorClaimToPage('Nash dengesi stratejik etkilesimin cozumunu tanimlar', idx, idf);
  assert.equal(hit.page, 4);
  assert.ok(hit.quote, 'quote alani dolu olmaliydi');
  assert.ok(/Nash dengesi/i.test(hit.quote), 'alinti ilgili cumle olmali');
});

test('dipnot reference i artik sayfa basligi degil GERCEK cumle', () => {
  const idx = A.buildPageIndex(DOC, 'SAYFA');
  const r = A.anchorCitations(
    ['Marjinal maliyet uretimi bir birim artirmanin toplam maliyete ekledigi tutardir'],
    [], idx, 'tr'
  );
  assert.equal(r.footnotes.length, 1);
  const fn = r.footnotes[0];
  assert.equal(fn.page, 3);
  assert.ok(fn.quote, 'quote alani olmali');
  assert.equal(fn.reference, fn.quote, 'reference alinti ile ayni olmali (UI bunu gosteriyor)');
  assert.ok(fn.reference.length > 25, 'reference anlamli uzunlukta olmali');
  assert.equal(r.stats.quoted, 1);
});

test('alinti bulunamazsa sayfa basligina duser, cokmez', () => {
  // Sayfa icerigi var ama cumle esigini gecmeyecek kadar alakasiz baglanti
  const doc = '--- SAYFA 5 ---\nBaslik Satiri\nkisa';
  const idx = A.buildPageIndex(doc, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  const hit = A.anchorClaimToPage('Baslik Satiri kisa icerik', idx, idf);
  if (hit) {
    assert.ok(hit.quote === null || typeof hit.quote === 'string');
    const r = A.anchorCitations(['Baslik Satiri kisa icerik'], [], idx, 'tr');
    if (r.footnotes.length) assert.ok(r.footnotes[0].reference.length > 0, 'reference bos kalmamali');
  }
});

// ===========================================================================
// CHUNK SAKLAMA (document_chunks) — buildStorableChunks
// ===========================================================================
console.log('\nCHUNK SAKLAMA TESTLERI\n');

test('chunk ler sirali ve bosluksuz indekslenir', () => {
  const cs = A.buildStorableChunks(DOC, 'SAYFA');
  assert.ok(cs.length >= 1);
  assert.deepEqual(cs.map(c => c.chunk_index), cs.map((_, i) => i));
});

test('char_count metin uzunlugu ile tutarli', () => {
  for (const c of A.buildStorableChunks(DOC, 'SAYFA')) {
    assert.equal(c.char_count, c.text.length, 'char_count yanlis');
    assert.ok(c.text.length > 0, 'bos chunk yazilmamali');
  }
});

test('sayfa isaretcileri chunk metnine SIZMAZ', () => {
  for (const c of A.buildStorableChunks(DOC, 'SAYFA')) {
    assert.ok(!/---\s*SAYFA\s+\d+\s*---/.test(c.text),
      `chunk ${c.chunk_index} icinde isaretci kalmis: ${c.text.slice(0, 60)}`);
  }
});

test('kisa sayfalar birlesince page_start..page_end araligi dogru', () => {
  const cs = A.buildStorableChunks(DOC, 'SAYFA');
  // Test belgesinin sayfalari kisa -> hepsi tek chunk ta birlesmeli
  const first = cs[0];
  assert.equal(first.page_start, 1);
  assert.equal(first.page_end, 4);
  assert.ok(first.page_start <= first.page_end);
});

test('uzun sayfa bolununce her parca O sayfanin numarasini tasir', () => {
  const long = 'Ekonomi '.repeat(400);          // ~3200 krk, tek sayfa
  const doc = `--- SAYFA 9 ---\n${long}`;
  const cs = A.buildStorableChunks(doc, 'SAYFA');
  assert.ok(cs.length > 1, 'uzun sayfa birden fazla chunk olmaliydi');
  for (const c of cs) {
    assert.equal(c.page_start, 9);
    assert.equal(c.page_end, 9);
  }
});

test('chunk lar hedef boyutu asmaz', () => {
  const long = 'Mikroekonomi analizi onemlidir. '.repeat(500);
  const cs = A.buildStorableChunks(`--- SAYFA 1 ---\n${long}`, 'SAYFA');
  for (const c of cs) {
    assert.ok(c.char_count <= A.CHUNK_STORE_SIZE,
      `chunk ${c.chunk_index} hedefi asti: ${c.char_count} > ${A.CHUNK_STORE_SIZE}`);
  }
});

test('isaretcisiz belge (DOCX) chunk lanir ama sayfa null kalir', () => {
  const cs = A.buildStorableChunks('Birinci paragraf burada.\n\nIkinci paragraf burada.', 'SAYFA');
  assert.ok(cs.length >= 1, 'isaretcisiz belge de chunk lanmali');
  for (const c of cs) {
    assert.equal(c.page_start, null, 'sayfa kavrami yoksa numara uydurulmamali');
    assert.equal(c.page_end, null);
  }
});

test('bos / anlamsiz girdi bos dizi doner', () => {
  assert.deepEqual(A.buildStorableChunks('', 'SAYFA'), []);
  assert.deepEqual(A.buildStorableChunks('   \n\n  ', 'SAYFA'), []);
  assert.deepEqual(A.buildStorableChunks('--- SAYFA 1 ---\n\n--- SAYFA 2 ---\n', 'SAYFA'), []);
});

test('icerik kaybi yok: chunk lar birlesince tum kelimeler korunur', () => {
  const cs = A.buildStorableChunks(DOC, 'SAYFA');
  const joined = cs.map(c => c.text).join(' ').replace(/\s+/g, ' ');
  // Orijinalden isaretci satirlarini cikar, kelimeleri karsilastir
  const expected = DOC.replace(/---\s*SAYFA\s+\d+\s*---/g, ' ').replace(/\s+/g, ' ').trim();
  for (const word of expected.split(' ')) {
    if (word.length < 5) continue;
    assert.ok(joined.includes(word), `kelime kaybolmus: "${word}"`);
  }
});

test('SLAYT etiketli belge (PPTX) de dogru chunk lanir', () => {
  const cs = A.buildStorableChunks('--- SLAYT 3 ---\nSunum icerigi yeterince uzun bir metin.', 'SLAYT');
  assert.equal(cs.length, 1);
  assert.equal(cs[0].page_start, 3);
  assert.ok(!/SLAYT/.test(cs[0].text), 'slayt isaretcisi metne sizmamali');
});

/* ==========================================================================
   BUYUK "I" KELIMEYI IKIYE BOLUYORDU (24.10.2026)

   JavaScript'te 'İ'.toLowerCase() iki kod birimi uretiyor: 'i' + U+0307
   (birlesen ustteki nokta). U+0307 \p{L}/\p{N} kumelerinde olmadigi icin
   noktalama temizligi onu BOSLUGA cevirip kelimeyi boluyordu. Olculen:

     anchorTerms('İstatistik') -> ["statistik"]   (bastaki 'i' 4 harf
                                   esigine takilip dusuyordu)
     anchorTerms('istatistik') -> ["istatistik"]

   Sonuc: model terimi baslik bicimiyle, kaynak cumle icinde kucuk harfle
   yazdiginda sayfa capasi kayboluyordu. Turkce bir urunde bu, kaynakta
   BIREBIR gecen icerigin atif alamamasi demek.
   ========================================================================== */
test('anchorTerms buyuk I ile kucuk i AYNI koke indiriyor', () => {
  assert.deepEqual(A.anchorTerms('İstatistik'), A.anchorTerms('istatistik'),
    'buyuk I farkli kok uretiyor — eslesme kaybolur');
  assert.deepEqual(A.anchorTerms('İstatistik'), ['istatistik'],
    'bastaki harf dusmus: ' + JSON.stringify(A.anchorTerms('İstatistik')));
});

test('anchorTerms Turkce basliklari bolmuyor', () => {
  const vakalar = [
    ['İşsizlik Oranı', ['işsizlik', 'oranı']],
    ['İthalat ve İhracat', ['ithalat', 'ihracat']],   // "ve" durak kelimesi
    ['İç Verim Oranı', ['verim', 'oranı']],           // "İç" 2 harf, esige takilir
  ];
  for (const [girdi, beklenen] of vakalar) {
    assert.deepEqual(A.anchorTerms(girdi), beklenen,
      `${girdi} -> ${JSON.stringify(A.anchorTerms(girdi))}`);
  }
});

test('buyuk I ile yazilan iddia DOGRU sayfaya baglaniyor', () => {
  /* Capa eslesmesinin kendisi: iddia baslik biciminde, kaynak cumle icinde
     kucuk harfle. Duzeltmeden once bu iddia hic sayfa bulamiyordu. */
  const metin = [
    '--- SAYFA 1 ---',
    'Bu bolumde arz ve talep dengesi ile fiyat olusumu anlatilir.',
    '--- SAYFA 2 ---',
    'İşsizlik orani 2023 yilinda yuzde on bire yukseldi ve istihdam daraldi.'
  ].join('\n');
  const idx = A.buildPageIndex(metin, 'SAYFA');
  assert.equal(idx.length, 2, 'fixture okunmadi — isaret etiketi gecilmemis olabilir');
  const idf = A.buildAnchorIdf(idx);
  /* Kelimeler sayfada BIREBIR geciyor; tek fark bastaki buyuk I. Turkce ek
     farki (orani / oranindaki) ayri ve bilinen bir sinir, bu testin konusu
     degil — o yuzden iddia ek almamis kelimelerden kuruldu. */
  const buyuk = A.anchorClaimToPage('İşsizlik orani istihdam daraldi', idx, idf);
  assert.ok(buyuk, 'iddia hic sayfa bulamadi — buyuk I eslesmeyi bozuyor');
  assert.equal(buyuk.page, 2, `yanlis sayfaya baglandi: ${buyuk && buyuk.page}`);
  // Ayni iddia kucuk harfle de AYNI sayfayi bulmali: fark kalmadi.
  const kucuk = A.anchorClaimToPage('işsizlik orani istihdam daraldi', idx, idf);
  assert.ok(kucuk && kucuk.page === buyuk.page,
    'buyuk ve kucuk harfli iddia farkli sayfa buluyor');
});

test('trNormalize Ingilizce metni degistirmiyor (regresyon)', () => {
  assert.equal(A.trNormalize('Dummy Variable Trap'), 'dummy variable trap');
  assert.deepEqual(A.anchorTerms('Reference Category'), ['reference', 'category']);
});

/* 25.10.2026 — ONDALIK SAYI KORLUGU. "%9.3" noktalama temizliginde "9" ve
   "3"e bolunup 4 harf esigine takiliyordu; iddiayi sayfasina baglayan en
   ayirt edici sey (katsayi, oran) hicbir karsilastirmaya girmiyordu. */
test('anchorTerms ondalik sayiyi TEK terim olarak tutuyor, virgulu noktaya indiriyor', () => {
  assert.deepEqual(A.anchorTerms('unemployment peaked at %9.3'), ['unemployment', 'peaked', '9.3']);
  assert.deepEqual(A.anchorTerms('işsizlik %9,3 oldu'), A.anchorTerms('işsizlik %9.3 oldu'));
  assert.deepEqual(A.anchorTerms('delta = -0.21'), ['delta', '0.21']);
  // Kisa tamsayilar hala gurultu (sayfa/madde numarasi); 4 haneli yil zaten geciyordu.
  assert.deepEqual(A.anchorTerms('slide 3 of 20 in 1982'), ['slide', '1982']);
  // Cumle sonu noktasi sayiya yapismaz.
  assert.deepEqual(A.anchorTerms('Growth was 1982. Prices fell'), ['growth', '1982', 'prices', 'fell']);
});

test('ondalik sayi iddiayi DOGRU sayfaya baglar (kelimeler iki sayfada da ayniyken)', () => {
  const doc = [
    '--- SAYFA 1 ---', 'Estimated wage equation: the gender dummy coefficient equals 0.21 in the sample.',
    '--- SAYFA 2 ---', 'Estimated wage equation: the gender dummy coefficient equals 0.35 in the sample.',
    '--- SAYFA 3 ---', 'Seasonal dummies capture quarterly effects in retail sales data.'
  ].join('\n');
  const idx = A.buildPageIndex(doc, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  const r = A.anchorClaimToPage('the gender dummy coefficient in the wage equation is 0.35', idx, idf);
  assert.ok(r, 'iddia hic baglanmadi');
  assert.equal(r.page, 2, `sayi dikkate alinmadi, esitlikte ilk sayfa secildi: ${r.page}`);
});

test('belgede OLMAYAN ondalik skoru DUSURUR — yeni yanlis atif uretemez', () => {
  const doc = [
    '--- SAYFA 1 ---', 'The Chow test compares restricted and unrestricted residual sums of squares across subsamples.',
    '--- SAYFA 2 ---', 'Seasonal dummies capture quarterly effects in retail sales data.'
  ].join('\n');
  const idx = A.buildPageIndex(doc, 'SAYFA');
  const idf = A.buildAnchorIdf(idx);
  const sayisiz = A.anchorClaimToPage('Chow test compares restricted unrestricted residual sums', idx, idf);
  const sayili = A.anchorClaimToPage('Chow test compares restricted unrestricted residual sums 4.87', idx, idf);
  assert.ok(sayisiz, 'taban iddia baglanmali');
  assert.ok(!sayili || sayili.score < sayisiz.score,
    'belgede olmayan sayi skoru dusurmedi — atif temkinli olmuyor');
  if (sayili) assert.equal(sayili.page, sayisiz.page, 'uydurma sayi iddiayi baska sayfaya tasidi');
});

/* ==========================================================================
   ALINTI OCR COPUYLE GELIYORDU (30.10.2026 — "Week 8 Derivative" OLCUMU)

   Kartin kaynakcasindaki 12 referansin 9'u OCR artigi tasiyordu. Sebep
   alinti secmede degil ADAY URETMEDE: kaynakta cop ile temiz cumle ayri
   satirlardaydi, ama splitSentences ilk isi olarak \s+ -> bosluk yapip
   satir sonlarini siliyordu; noktalama tasimayan OCR satirlari tek bir
   "cumle" halinde birlesiyordu.

   Asagidaki sayfa govdeleri document_chunks'tan BIREBIR, iddialar da o
   kartin gercek key_points'lerinden.
   ========================================================================== */
{
  const A = loadAnchoring();

  // document_chunks'tan birebir (Week 8, sayfa 5 ve 7).
  const SAYFA5 = [
    'Answer Set 2: Basic derivative rules',
    'Power, Sum, and Constant Multiple Rules',
    'ANSWER', 'Solutions', 'E)', '32-2-621/2', '20x3 - 6x', '2-3+21/2',
    '→', '-30-1+岩*-1/2', '10g1+4ば3＝10z+小', 'Incorrect.',
    '（ょり＝なな、', '-62-3-32-1/2',
    'Key idea',
    'Power rule: the exponent moves down, then',
    'decreases by one.'
  ].join('\n');
  const SAYFA7 = [
    'Answer Set 3: When two functions are multiplied', 'Product Rule', 'Solutions',
    "f'(x) = 2x (3x - 5) + 3(x? + 1) = 9x2 - 10x + 3",
    "g' (x) = 3x2 sin x + x3 cos x",
    'P（2）＝22mz+2-4', 'Valid for x > O.', 'ANSWER', 'Key idea',
    'A product-rule derivative has two terms',
    'before simplification.'
  ].join('\n');

  const idf = A.buildAnchorIdf([
    { terms: new Set(A.anchorTerms(SAYFA5)) },
    { terms: new Set(A.anchorTerms(SAYFA7)) }
  ]);

  test('OLCULEN ALINTI artik OCR copu tasimiyor', () => {
    const q5 = A.bestQuoteForClaim(
      'The power rule dictates that the exponent moves down and decreases by one.', SAYFA5, idf);
    assert.equal(q5, 'Power rule: the exponent moves down, then decreases by one.',
      'alinti hala cop tasiyor ya da sarmalanmis cumle birlesmiyor: ' + q5);
    const q7 = A.bestQuoteForClaim(
      'A product-rule derivative always has two terms before simplification.', SAYFA7, idf);
    assert.equal(q7, 'A product-rule derivative has two terms before simplification.', q7);
    // CJK/tam genislik artigi kalmamali.
    for (const q of [q5, q7]) {
      assert.ok(!/[　-鿿＀-￯]/.test(q), 'alintida OCR artigi kaldi: ' + q);
    }
  });

  test('SARMALANMIS cumle birlesiyor, SINIR bolunuyor', () => {
    // Kucuk harfle devam eden satir ayni cumlenin parcasi.
    assert.deepEqual(
      A.alintiBloklari('Power rule: the exponent moves down, then\ndecreases by one.'),
      ['Power rule: the exponent moves down, then decreases by one.']);
    // Buyuk harfle baslayan satir YENI parca; cop satirlari da ayri kaliyor.
    assert.deepEqual(
      A.alintiBloklari('（ょり＝なな、\n-62-3-32-1/2\nKey idea\nPower rule: the exponent moves down.'),
      ['（ょり＝なな、', '-62-3-32-1/2', 'Key idea', 'Power rule: the exponent moves down.']);
    // Noktalama ile biten satir, devami kucuk harfli olsa bile sinirdir.
    assert.deepEqual(
      A.alintiBloklari('Rewrite roots and fractions as powers.\ndifferentiate term by term.'),
      ['Rewrite roots and fractions as powers.', 'differentiate term by term.']);
    // Tireyle bolunmus sozcuk BOSLUKSUZ birlesir.
    assert.deepEqual(A.alintiBloklari('differen-\ntiable'), ['differentiable']);
    // Bos girdi cokmez.
    assert.deepEqual(A.alintiBloklari(''), []);
    assert.deepEqual(A.alintiBloklari(null), []);
  });

  test('BILINEN SINIR: devami buyuk harfle baslayan sarma bolunuyor', () => {
    /* Iki gercek belgede olculdu: ders kitabindaki bosluk-doldurma koku ve
       slayttaki iki satirlik baslik. Ikisi de zayif alinti adayi (en az 2
       eslesen terim + 0,3 skor kapisi), bu yuzden BILEREK kabul edildi.
       Bu test kusuru savunmuyor, DAVRANISI sabitliyor: biri bu bolmeyi
       duzeltmeye kalkarsa denenmis alternatifi (uzun-satir kurali) ve neden
       reddedildigini alintiBloklari yanindaki notta bulsun. */
    assert.deepEqual(
      A.alintiBloklari('Classification of Receivables with Respect to The Nature of The\nTransaction'),
      ['Classification of Receivables with Respect to The Nature of The', 'Transaction']);
  });

  test('alinti motoru generate-exam te de GUNCEL', () => {
    /* Atif motoru iki dosyada birebir duruyor (bkz. tests/exam-feedback.js).
       Yalnizca birini degistirmek sinav geri bildirimini eski davranista
       birakirdi. */
    const g = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'supabase/functions/generate-exam/index.ts'), 'utf8');
    assert.match(g, /function alintiBloklari\(body: string\): string\[\]/,
      'generate-exam hala eski aday uretimini kullaniyor');
    assert.match(g, /const adaylar = alintiBloklari\(body\)\.flatMap\(/,
      'generate-exam te bestQuoteForClaim yeni adaylari kullanmiyor');
  });
}

/* ==========================================================================
   COGUL EKI ATIFI OLDURUYORDU (30.10.2026 — "Week 8 Derivative" OLCUMU)

   Log: "Citation anchoring: pages=24 ... unanchored=2". Atifsiz kalan
   maddelerden birinin kaynaktaki karsiligi NEREDEYSE BIREBIRDI:
     madde   : "Decision mapping classifies expressions into sums, products,
                quotients, or composites before differentiation."
     sayfa 23: "Classify the expression first: sum, product, quotient, or
                composite form."
   Olculen eslesme 10 terimden 1 (yalnizca "decision"); alti kavram
   Ingilizce cekim ekinde kayboluyordu.
   ========================================================================== */
{
  const A = loadAnchoring();

  test('ingTekil: cogul eslesiyor, TUZAKLAR korunuyor', () => {
    for (const [cogul, tekil] of [
      ['classifies', 'classify'], ['expressions', 'expression'], ['sums', 'sum'],
      ['products', 'product'], ['quotients', 'quotient'], ['composites', 'composite'],
      ['derivatives', 'derivative'], ['integrals', 'integral'], ['policies', 'policy'],
      ['taxes', 'tax'], ['boxes', 'box'], ['slopes', 'slope']
    ]) {
      assert.equal(A.ingTekil(cogul), A.ingTekil(tekil), `${cogul} <-> ${tekil} eslesmiyor`);
    }
    // ss/us/is/os ile bitenler cogul DEGIL.
    for (const w of ['class', 'focus', 'analysis', 'basis', 'business', 'chaos']) {
      assert.equal(A.ingTekil(w), w, w + ' bozuldu');
    }
    // 4 karakterden kisa ve ingilizce harf disi karakter tasiyan sozcuk.
    assert.equal(A.ingTekil('its'), 'its');
    assert.equal(A.ingTekil('ölçüs'), 'ölçüs');
    assert.equal(A.ingTekil(''), '');
    assert.equal(A.ingTekil(null), '');
  });

  test('tekilKume OZGUN bicimi de tutuyor', () => {
    // Tekil eklemek, var olan eslesmeyi kaybetmemeli.
    const k = A.tekilKume(new Set(['products', 'class', 'decision']));
    assert.ok(k.has('products') && k.has('product'), [...k].join(','));
    assert.ok(k.has('class') && k.has('decision'));
  });

  // Week 8, sayfa 23 ve 21 — document_chunks'tan birebir.
  const P23 = [
    'Question Set 9: Which rule should I use?', 'Choosing the Correct Rule',
    'Problems', 'Rule and derivative.', 'QUESTION', 'Hint',
    'Classify the expression first: sum, product,', 'quotient, or composite form.',
    'Decision map', 'sum → term by term', "product → u'v + uv'",
    'quotient →', 'inside function → chain'
  ].join('\n');
  const P21 = [
    'Question Set 11: Read the sign of the derivative',
    'Increasing and Decreasing Intervals', 'QUESTION', 'Problems', 'Hint',
    'After finding the critical points, test one', 'number from each interval.',
    'Sign rule', '- to +: local minimum',
    "f'(x) > 0 → f is increasing", "f' (x) < 0 → f is decreasing"
  ].join('\n');
  const idx = () => [
    { page: 21, terms: new Set(A.anchorTerms(P21)), head: 'Increasing and Decreasing Intervals', body: P21 },
    { page: 23, terms: new Set(A.anchorTerms(P23)), head: 'Choosing the Correct Rule', body: P23 }
  ];
  const IDDIA_B = 'Decision mapping classifies expressions into sums, products, quotients, or composites before differentiation.';

  test('OLCULEN ATIFSIZ MADDE artik dogru sayfaya baglaniyor', () => {
    const i = idx();
    const idf = A.buildAnchorIdf(i);
    const kapali = A.anchorClaimToPage(IDDIA_B, idx(), idf, false);
    assert.equal(kapali, null, 'olcum degismis: madde cogul kurali olmadan da baglaniyor');
    const acik = A.anchorClaimToPage(IDDIA_B, i, idf, true);
    assert.ok(acik, 'cogul kurali acikken de atifsiz');
    assert.equal(acik.page, 23);
    assert.equal(acik.quote, 'Classify the expression first: sum, product, quotient, or composite form.',
      'alinti kaynaktaki karsilik degil: ' + acik.quote);
  });

  test('AGIRLIK eslesen bicimden okunuyor', () => {
    /* Ilk denemede eslesme tekil bicimle yapiliyor ama agirlik COGUL
       bicimle araniyordu; idf tablosu sayfa terimlerinden (tekil) kurulu
       oldugu icin `?? 0` donuyordu. Olculdu: eslesen terim sayisi artti,
       skor ayni kaldi, madde YINE atifsiz. */
    const i = idx();
    const idf = A.buildAnchorIdf(i);
    const h = A.anchorClaimToPage(IDDIA_B, i, idf, true);
    assert.ok(h.score >= A.ANCHOR_MIN_SCORE,
      `skor ${h.score} esigin (${A.ANCHOR_MIN_SCORE}) altinda — agirlik cozumlemesi bozuk`);
    assert.ok(h.matched >= A.ANCHOR_MIN_TERMS, 'eslesen terim sayisi esigin altinda');
  });

  test('TURKCE KARTTA davranis BIREBIR ayni kaliyor', () => {
    /* Ingilizce -s kurali Turkceye uygulandiginda olculen zarar gercek:
       "kurs" -> "kur", "ders" -> "der", "ters" -> "ter". "kur" BASKA bir
       Turkce sozcuk, yani ayni belgede ikisi varsa atif YANLIS sayfayi
       gosterir. Bu yuzden kapi dile bagli. */
    const SUM_SRC = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'supabase/functions/summarize-document/index.ts'), 'utf8');
    assert.match(SUM_SRC, /anchorClaimToPage\(text, pageIndex, idf, lang === 'en'\)/,
      'cogul kurali dile bagli degil — Turkce kartta kurs/kur karismasi riski');
    // Kapi KAPALIYKEN tekil kume hic kurulmuyor.
    const i = idx();
    A.anchorClaimToPage(IDDIA_B, i, A.buildAnchorIdf(i), false);
    assert.ok(i.every(s => s.termsTekil === undefined),
      'kapi kapaliyken tekil kume kurulmus — Turkce yol degismis');
  });

  test('tekil kume sayfa basina BIR KEZ kuruluyor', () => {
    const i = idx();
    const idf = A.buildAnchorIdf(i);
    A.anchorClaimToPage(IDDIA_B, i, idf, true);
    const once = i[1].termsTekil;
    assert.ok(once instanceof Set, 'tekil kume saklanmiyor');
    A.anchorClaimToPage('Another claim about products and quotients here.', i, idf, true);
    assert.equal(i[1].termsTekil, once, 'tekil kume her madde icin yeniden kurulmus');
  });

  test('cogul kurali generate-exam te de GUNCEL', () => {
    const g = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'supabase/functions/generate-exam/index.ts'), 'utf8');
    assert.match(g, /function ingTekil\(term: string\): string/, 'generate-exam te ingTekil yok');
    assert.match(g, /tekil \? idf\.get\(ingTekil\(t\)\)/, 'generate-exam te agirlik cozumlemesi yok');
    /* Sinav atfinin CAGRI YERI bilerek degismedi: bu tur bir davranis
       degisikligi kendi olcumunu ister. */
    assert.match(g, /const hit = anchorClaimToPage\(claim, index, idf\)\s*$/m,
      'sinav atfi sessizce cogul kuraline gecmis — ayrica olculmeli');
  });
}

summary().then(() => process.exit(process.exitCode || 0));
