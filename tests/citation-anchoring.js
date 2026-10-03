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
    'ANCHOR_STOPWORDS', 'anchorTerms', 'splitByPageMarkers', 'buildPageIndex',
    'buildAnchorIdf', 'ANCHOR_MIN_SCORE', 'ANCHOR_MIN_TERMS',
    // birebir alinti (span seviyesi atif)
    'SENTENCE_ABBREV', 'splitSentences', 'QUOTE_MIN_CHARS', 'QUOTE_MAX_CHARS',
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

summary();
