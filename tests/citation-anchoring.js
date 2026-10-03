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
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'summarize-document', 'index.ts');

// ---------------------------------------------------------------------------
// Kaynaktan izole fonksiyon cikarimi
// index.ts bir Deno edge function — tepe seviyede import ve serve() var, o
// yuzden dosyayi butun halde yukleyemeyiz. TypeScript ile JS'e cevirip
// sadece ihtiyac duydugumuz tepe-seviye bildirimleri brace eslemesiyle
// kesip izole bir kapsamda degerlendiriyoruz.
// ---------------------------------------------------------------------------
function transpile(tsSource) {
  return ts.transpileModule(tsSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText;
}

/**
 * Kaynak tarayici: string/yorum iceriklerini atlayarak ilerler ve her
 * konumda parantez/brace/bracket derinligini bildirir. Bir `function f(a)`
 * bildiriminde parametre parantezi kapandiginda toplam derinlik sifira
 * doner — gövde daha baslamamistir — bu yuzden sayaclar TURE GORE ayri
 * tutulur ve fonksiyon gövdesi ayrica aranir.
 */
function scanFrom(js, start, onChar) {
  let i = start;
  let paren = 0, brace = 0, bracket = 0;
  let inStr = null, inLineComment = false, inBlockComment = false;
  while (i < js.length) {
    const c = js[i], n = js[i + 1];
    if (inLineComment) { if (c === '\n') inLineComment = false; i++; continue; }
    if (inBlockComment) { if (c === '*' && n === '/') { inBlockComment = false; i += 2; continue; } i++; continue; }
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '/' && n === '/') { inLineComment = true; i += 2; continue; }
    if (c === '/' && n === '*') { inBlockComment = true; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '(') paren++; else if (c === ')') paren--;
    else if (c === '{') brace++; else if (c === '}') brace--;
    else if (c === '[') bracket++; else if (c === ']') bracket--;
    const stop = onChar(c, i, { paren, brace, bracket });
    if (stop !== undefined) return stop;
    i++;
  }
  return -1;
}

/** `function NAME(...) {...}` veya `const NAME = ...;` bildiriminin tamamini keser. */
function sliceDeclaration(js, name) {
  const fnRe = new RegExp(`function\\s+${name}\\s*\\(`);
  const constRe = new RegExp(`const\\s+${name}\\s*=`);
  const fnM = js.match(fnRe);
  const constM = js.match(constRe);

  if (fnM) {
    // Gövdenin acilis '{' ini bul (parametre parantezi kapandiktan sonraki ilk '{'),
    // sonra SADECE brace sayarak gövdenin sonunu bul.
    const bodyStart = scanFrom(js, fnM.index, (c, i, d) =>
      (c === '{' && d.paren === 0 && d.brace === 1) ? i : undefined);
    if (bodyStart === -1) throw new Error(`'${name}': fonksiyon gövdesi bulunamadi.`);
    const end = scanFrom(js, bodyStart, (c, i, d) =>
      (c === '}' && d.brace === 0) ? i + 1 : undefined);
    if (end === -1) throw new Error(`'${name}': fonksiyon gövdesi kapanmadi.`);
    return js.slice(fnM.index, end);
  }

  if (constM) {
    // Tum derinlikler sifirken gelen ilk ';' bildirimi bitirir.
    const end = scanFrom(js, constM.index, (c, i, d) =>
      (c === ';' && d.paren === 0 && d.brace === 0 && d.bracket === 0) ? i + 1 : undefined);
    if (end === -1) throw new Error(`'${name}': const bildirimi ';' ile bitmiyor.`);
    return js.slice(constM.index, end);
  }

  throw new Error(
    `index.ts icinde '${name}' bildirimi bulunamadi.\n` +
    `Yeniden adlandirilmis veya tasinmis olabilir — bu test guncellenmeli.`
  );
}

function loadAnchoring() {
  const js = transpile(fs.readFileSync(SRC, 'utf8'));
  const names = [
    'ANCHOR_STOPWORDS', 'anchorTerms', 'buildPageIndex', 'buildAnchorIdf',
    'ANCHOR_MIN_SCORE', 'ANCHOR_MIN_TERMS', 'anchorClaimToPage',
    'applyFootnoteRemap', 'anchorCitations'
  ];
  const body = names.map(n => sliceDeclaration(js, n)).join('\n\n');
  const factory = new Function(`${body}\nreturn { ${names.join(', ')} };`);
  return factory();
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

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
}

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

console.log(`\n${passed} test gecti${process.exitCode ? ' (BASARISIZ olanlar var)' : ''}\n`);
