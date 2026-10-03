/* ==========================================================================
   ACADEX — CHAT RETRIEVAL TESTLERI (tests/chat-retrieval.js)

   chat-with-document icindeki sorgu kurma ve pasaj birlestirme mantigini
   Groq'a ve Supabase'e hic cikmadan test eder. Fonksiyonlar kaynak dosyadan
   calisma aninda cikarilir (bkz. tests/_ts-extract.js).

   Calistirma:  node tests/chat-retrieval.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const A = loadFromSource('supabase/functions/chat-with-document/index.ts', [
  'WHOLE_DOC_MAX_CHARS', 'RETRIEVED_MAX_CHARS', 'RETRIEVED_MAX_CHUNKS',
  'QUERY_STOPWORDS', 'buildChunkTsQuery', 'assembleRetrieved'
]);

const { test, summary } = makeRunner();

console.log('\nSORGU KURMA TESTLERI\n');

test('icerik kelimeleri OR ile birlestirilir', () => {
  const q = A.buildChunkTsQuery('marjinal maliyet egrisi');
  assert.equal(q, 'marjinal | maliyet | egrisi');
});

test('soru kaliplari (stopword) atilir', () => {
  const q = A.buildChunkTsQuery('Marjinal maliyet nedir, bana kisaca aciklar misin?');
  assert.ok(q.includes('marjinal'), 'anlamli terim kalmali');
  assert.ok(q.includes('maliyet'));
  assert.ok(!q.includes('nedir'), 'nedir atilmaliydi');
  assert.ok(!q.includes('bana'), 'bana atilmaliydi');
  assert.ok(!q.includes('kisaca'), 'kisaca atilmaliydi');
});

test('2 harften kisa kelimeler atilir', () => {
  const q = A.buildChunkTsQuery('bu ve de marjinal');
  assert.equal(q, 'marjinal');
});

test('tekrarlayan kelime bir kez gecer', () => {
  const q = A.buildChunkTsQuery('maliyet maliyet maliyet egrisi');
  assert.equal(q, 'maliyet | egrisi');
});

test('anlamli terim yoksa null doner (caller tum belgeye duser)', () => {
  assert.equal(A.buildChunkTsQuery('nedir bu?'), null);
  assert.equal(A.buildChunkTsQuery(''), null);
  assert.equal(A.buildChunkTsQuery('   '), null);
  assert.equal(A.buildChunkTsQuery('?! ...'), null);
});

// --- ENJEKSIYON GUVENLIGI: en kritik testler --------------------------------
// to_tsquery'ye operator sizmasi hem sorgunun anlamini degistirir hem de
// sorguyu patlatabilir. Harf/rakam disindaki her sey atildigi icin
// kullanicinin yazdigi hicbir sey operator olarak gecemez.

test('tsquery operatorleri sizdirilmaz (& | ! parantez)', () => {
  const q = A.buildChunkTsQuery('maliyet & egrisi | (sapma) ! deger');
  assert.ok(q, 'sorgu uretilmeliydi');
  // Tek izin verilen operator, bizim ekledigimiz ' | '
  const withoutOurOrs = q.split(' | ').join(' ');
  assert.ok(!/[&!()<>:*]/.test(withoutOurOrs),
    `operator sizdi: ${JSON.stringify(q)}`);
});

test('prefix/agirlik sozdizimi (:* :A) sizdirilmaz', () => {
  const q = A.buildChunkTsQuery('maliyet:* egrisi:A');
  assert.ok(!q.includes(':'), `iki nokta sizdi: ${q}`);
});

test('tek tirnak ve ters egik cizgi sizdirilmaz', () => {
  const q = A.buildChunkTsQuery("maliyet' or 1=1 -- \\ egrisi");
  assert.ok(!/['\\=-]/.test(q), `tehlikeli karakter sizdi: ${q}`);
});

test('fazla uzun soru terim sayisinda sinirlanir', () => {
  const many = Array.from({ length: 80 }, (_, i) => `terim${i}`).join(' ');
  const q = A.buildChunkTsQuery(many);
  assert.ok(q.split(' | ').length <= 24, 'terim sayisi 24 ile sinirli olmali');
});

test('Turkce karakterler korunur', () => {
  const q = A.buildChunkTsQuery('esneklik katsayısı öğrenme çıktısı');
  assert.ok(q.includes('katsayısı'), `Turkce karakter kaybolmus: ${q}`);
  assert.ok(q.includes('öğrenme'));
});

console.log('\nPASAJ BIRLESTIRME TESTLERI\n');

const row = (i, page, text) => ({ chunk_index: i, page_start: page, page_end: page, text });

test('secim alakaya gore ama metin OKUMA sirasina gore dizilir', () => {
  // RPC alaka sirasinda doner: 70, 12, 45
  const rows = [row(70, 71, 'yetmisinci chunk'), row(12, 13, 'onikinci chunk'), row(45, 46, 'kirkbesinci chunk')];
  const { text } = A.assembleRetrieved(rows, 100000);
  const order = [12, 45, 70].map(n => text.indexOf(
    n === 12 ? 'onikinci' : n === 45 ? 'kirkbesinci' : 'yetmisinci'));
  assert.ok(order[0] < order[1] && order[1] < order[2],
    'pasajlar okuma sirasinda olmaliydi (model karisik sirada mantik kuramaz)');
});

test('karakter butcesi asilmaz', () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(i, i + 1, 'x'.repeat(1000)));
  const { text, used } = A.assembleRetrieved(rows, 5000);
  assert.ok(used <= 5000, `butce asildi: ${used}`);
  assert.ok(text.length > 0, 'bos donmemeli');
});

test('butce cok kucukse en alakali tek pasaj yine gonderilir', () => {
  const rows = [row(3, 4, 'y'.repeat(9000))];
  const { text, used } = A.assembleRetrieved(rows, 1000);
  assert.ok(used > 0 && text.length > 0, 'hic pasaj gonderilmemesi kabul edilemez');
});

test('sayfa etiketi eklenir ve sayfalar raporlanir', () => {
  const { text, pages } = A.assembleRetrieved([row(5, 12, 'icerik burada')], 10000);
  assert.ok(text.includes('[Sayfa 12]'), `sayfa etiketi yok: ${text}`);
  assert.deepEqual(pages, [12]);
});

test('coklu sayfa araligi dogru etiketlenir', () => {
  const r = { chunk_index: 1, page_start: 4, page_end: 6, text: 'uc sayfaya yayilan icerik' };
  const { text } = A.assembleRetrieved([r], 10000);
  assert.ok(text.includes('[Sayfa 4-6]'), `aralik etiketi yok: ${text}`);
});

test('sayfasiz chunk (DOCX) etiketsiz gecer, cokmez', () => {
  const r = { chunk_index: 0, page_start: null, page_end: null, text: 'sayfasiz icerik' };
  const { text, pages } = A.assembleRetrieved([r], 10000);
  assert.ok(text.includes('sayfasiz icerik'));
  assert.ok(!text.includes('[Sayfa'), 'sayfa kavrami yoksa etiket uydurulmamali');
  assert.deepEqual(pages, []);
});

test('bos / bozuk satirlar atlanir', () => {
  const rows = [row(1, 2, ''), { chunk_index: 2 }, row(3, 4, 'gercek icerik')];
  const { text } = A.assembleRetrieved(rows, 10000);
  assert.ok(text.includes('gercek icerik'));
  assert.ok(!text.includes('undefined'), 'undefined sizmamali');
});

test('bos satir listesi guvenli sekilde bos doner', () => {
  const { text, used, pages } = A.assembleRetrieved([], 10000);
  assert.equal(text, '');
  assert.equal(used, 0);
  assert.deepEqual(pages, []);
});

console.log('\nSABITLER\n');

test('butce eski 100.000 kesmesinden kucuk (TPM kazanci)', () => {
  assert.ok(A.RETRIEVED_MAX_CHARS < 100000,
    'retrieval butcesi eski kesmeden kucuk olmali, yoksa kazanc yok');
  assert.ok(A.WHOLE_DOC_MAX_CHARS > 0 && A.RETRIEVED_MAX_CHUNKS > 0);
});

summary();
