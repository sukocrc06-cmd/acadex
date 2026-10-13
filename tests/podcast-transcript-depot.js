/* ==========================================================================
   ACADEX — SESLI OZET DOKUMU / DEFTER AKTARIMI (tests/podcast-transcript-depot.js)

   "Sesli sohbeti deftere aktar" yolunu tarayicisiz test eder.

   NEDEN VAR:
   Bu ozellikte hicbir SES metne cevrilmiyor — generate-podcast-script
   diyalogu zaten metin olarak uretip study_cards.podcast_script uzerinde
   sakliyor. Dolayisiyla kirilgan olan kisim transkripsiyon degil, IKI UC:

     1) Veri bicimi. Payload JSON olarak card_depot.content'e yaziliyor ve
        deftere yapistirilirken geri okunuyor. Konusmaci ayrimi burada
        kaybolursa dokum tek blok metne doner (yapiskan not yolunun
        textContent ile duzlestirmesi tam olarak bunu yapiyordu).

     2) check constraint. card_depot_source_type_check yeni bir source_type'i
        otomatik kabul ETMEZ; 2026-07-26'da 'image' tam olarak bu yuzden
        canlida reddedildi (20260726c_card_depot_allow_image_source_type.sql).
        Bu dosya, kodun gonderdigi her source_type icin migration'da izin
        olup olmadigini kontrol eder — deploy edilmemis bir migration'i
        sessizce kacirmamak icin.

   Ayrica satir metni LLM'den geliyor ve inline HTML'e giriyor; kacislar
   test ediliyor.

   Calistirma:  node tests/podcast-transcript-depot.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const UI = loadFromSource('js/dashboard.js', [
  'escapeHtml',
  'buildPodcastTranscriptPayload',
  'formatTranscriptPlainText',
  'renderTranscriptLinesHtml'
]);

const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const DASH_SRC = fs.readFileSync(path.join(ROOT, 'js/dashboard.js'), 'utf8');

const podcast = (lines, hostNames) => ({
  script: lines.map(([speaker, text]) => ({ speaker, text })),
  ...(hostNames ? { hostNames } : {})
});

console.log('\nPAYLOAD BICIMI\n');

test('konusmaci ayrimi korunuyor', () => {
  const p = UI.buildPodcastTranscriptPayload(
    podcast([['A', 'Talep esnekligi nedir?'], ['B', 'Fiyat degisince talebin tepkisi.']]),
    'tr', 'mikro.pdf');
  assert.equal(p.lines.length, 2);
  assert.deepEqual(p.lines.map(l => l.speaker), ['A', 'B']);
  assert.equal(p.docName, 'mikro.pdf');
});

test('bos ve bosluk-only satirlar atiliyor', () => {
  const p = UI.buildPodcastTranscriptPayload(
    podcast([['A', 'Merhaba'], ['B', '   '], ['A', ''], ['B', 'Devam']]), 'tr');
  assert.deepEqual(p.lines.map(l => l.text), ['Merhaba', 'Devam']);
});

test('bilinmeyen konusmaci A sayiliyor (sema iki sunuculu)', () => {
  const p = UI.buildPodcastTranscriptPayload(podcast([['C', 'kim bu'], [undefined, 'bu da']]), 'tr');
  assert.deepEqual(p.lines.map(l => l.speaker), ['A', 'A']);
});

test('sunucu adlari yoksa dile gore varsayilan geliyor', () => {
  assert.deepEqual(UI.buildPodcastTranscriptPayload(podcast([['A', 'x']]), 'tr').hostNames, ['Ela', 'Kaan']);
  assert.deepEqual(UI.buildPodcastTranscriptPayload(podcast([['A', 'x']]), 'en').hostNames, ['Alex', 'Sam']);
});

test('kayittaki sunucu adlari varsayilani eziyor', () => {
  const p = UI.buildPodcastTranscriptPayload(podcast([['A', 'x']], ['Deniz', 'Mert']), 'tr');
  assert.deepEqual(p.hostNames, ['Deniz', 'Mert']);
});

test('yarim/bozuk sunucu adi listesi varsayilana duser', () => {
  const p = UI.buildPodcastTranscriptPayload(podcast([['A', 'x']], ['Deniz', '  ']), 'tr');
  assert.deepEqual(p.hostNames, ['Ela', 'Kaan']);
});

test('sesli ozet hic yoksa bos satir listesi doner (cagiran uyari gosterir)', () => {
  assert.deepEqual(UI.buildPodcastTranscriptPayload(null, 'tr').lines, []);
  assert.deepEqual(UI.buildPodcastTranscriptPayload({}, 'tr').lines, []);
  assert.deepEqual(UI.buildPodcastTranscriptPayload({ script: 'metin degil' }, 'tr').lines, []);
});

console.log('\nJSON TUR-GERI DONUS (depo -> defter)\n');

test('stringify/parse sonrasi render ayni kaliyor', () => {
  const p = UI.buildPodcastTranscriptPayload(
    podcast([['A', 'Birinci'], ['B', 'Ikinci']], ['Ela', 'Kaan']), 'tr', 'ders.pdf');
  const geri = JSON.parse(JSON.stringify(p));
  assert.equal(UI.renderTranscriptLinesHtml(geri), UI.renderTranscriptLinesHtml(p));
  assert.deepEqual(geri.lines, p.lines);
});

test('duz metin karsiligi konusmaci adlarini kullaniyor', () => {
  const p = UI.buildPodcastTranscriptPayload(
    podcast([['A', 'Soru'], ['B', 'Cevap']], ['Ela', 'Kaan']), 'tr');
  assert.equal(UI.formatTranscriptPlainText(p), 'Ela: Soru\nKaan: Cevap');
});

test('duz metin bos payload ile patlamiyor', () => {
  assert.equal(UI.formatTranscriptPlainText(null), '');
  assert.equal(UI.formatTranscriptPlainText({ lines: [] }), '');
});

console.log('\nHTML KACISLARI (metin LLM\'den geliyor)\n');

test('satir metnindeki HTML kaciliyor', () => {
  const p = UI.buildPodcastTranscriptPayload(
    podcast([['A', '<img src=x onerror=alert(1)> & "tirnak"']]), 'tr');
  const html = UI.renderTranscriptLinesHtml(p);
  assert.ok(!html.includes('<img'), 'ham <img> HTML\'e sizdi');
  assert.ok(html.includes('&lt;img'), 'kacis uygulanmamis');
  assert.ok(html.includes('&quot;'), 'cift tirnak kacirilmamis');
});

test('sunucu adi da kaciliyor', () => {
  const p = UI.buildPodcastTranscriptPayload(podcast([['A', 'x']], ['<b>Ela</b>', 'Kaan']), 'tr');
  const html = UI.renderTranscriptLinesHtml(p);
  assert.ok(!html.includes('<b>Ela</b>'), 'sunucu adindaki HTML sizdi');
});

test('konusmaciya gore sinif veriliyor (CSS renk ayrimi buna bagli)', () => {
  const p = UI.buildPodcastTranscriptPayload(podcast([['A', 'bir'], ['B', 'iki']]), 'tr');
  const html = UI.renderTranscriptLinesHtml(p);
  assert.ok(html.includes('speaker-a'), 'A sinifi yok');
  assert.ok(html.includes('speaker-b'), 'B sinifi yok');
});

test('bos payload bos HTML veriyor', () => {
  assert.equal(UI.renderTranscriptLinesHtml({ lines: [] }), '');
  assert.equal(UI.renderTranscriptLinesHtml(null), '');
});

console.log('\nCHECK CONSTRAINT UYUMU\n');

/** Migration'lar icinde card_depot_source_type_check'i EN SON tanimlayan dosya. */
function sonConstraintIzinListesi() {
  const dir = path.join(ROOT, 'supabase/migrations');
  const dosyalar = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  let sonuc = null;
  for (const f of dosyalar) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = src.match(/add\s+constraint\s+card_depot_source_type_check[\s\S]*?ARRAY\[([\s\S]*?)\]/i);
    if (m) sonuc = { dosya: f, izinli: new Set((m[1].match(/'([a-z_]+)'/g) || []).map(s => s.slice(1, -1))) };
  }
  return sonuc;
}

/** dashboard.js'in card_depot'a yazdigi butun source_type literalleri. */
function kodunGonderdigiTipler() {
  const tipler = new Set();
  for (const m of DASH_SRC.matchAll(/sendToDepot\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*'([a-z_]+)'/g)) tipler.add(m[1]);
  for (const m of DASH_SRC.matchAll(/source_type:\s*'([a-z_]+)'/g)) tipler.add(m[1]);
  return tipler;
}

test('card_depot kisiti migration\'larda bulunuyor', () => {
  const c = sonConstraintIzinListesi();
  assert.ok(c, 'card_depot_source_type_check hicbir migration\'da tanimli degil');
  assert.ok(c.izinli.size > 0, 'izin listesi bos okundu — regex bozulmus olabilir');
});

test('transcript tipi kisitta izinli', () => {
  const c = sonConstraintIzinListesi();
  assert.ok(c.izinli.has('transcript'),
    `'transcript' izin listesinde yok (son tanim: ${c.dosya}) — insert canlida ` +
    'check constraint hatasiyla reddedilir.');
});

test('kodun gonderdigi her source_type kisitta izinli', () => {
  const c = sonConstraintIzinListesi();
  const kacak = [...kodunGonderdigiTipler()].filter(t => !c.izinli.has(t));
  assert.deepEqual(kacak, [],
    'Bu tip(ler) icin migration yok — card_depot insert\'i reddedecek: ' + kacak.join(', '));
});

console.log('\nDEFTER KAYIT/GERI YUKLEME KABLOLAMASI\n');

test('transcript ogesi kaydediliyor ve geri yukleniyor', () => {
  assert.ok(/type === 'transcript'[\s\S]{0,300}data-transcript-json/.test(DASH_SRC),
    'saveNotebookData transcript ogesini seri hale getirmiyor — sayfa yenilenince dokum kaybolur');
  assert.ok(/item\.type === 'transcript'[\s\S]{0,200}insertTranscriptCanvasElement/.test(DASH_SRC),
    'loadNotebookPage transcript ogesini geri yuklemiyor');
});

test('depodan yapistirma transcript tipini tanıyor', () => {
  assert.ok(/sourceType === 'transcript'[\s\S]{0,200}insertTranscriptCanvasElement/.test(DASH_SRC),
    'pasteDepotItem transcript\'i yapiskan nota dusuruyor — konusmaci ayrimi kaybolur');
});

console.log('\nGONDERIM SONRASI DUGME DURUMU\n');

// 2026-10-13 geri bildirimi: dugme "Gonderildi" deyip 1.5 saniye sonra eski
// haline donuyordu; kullanici gonderimin olup olmadigindan emin olamiyordu.
// Tek seferlik gonderimde etiket KALICI olmali.
test('sendToDepot kalici bitis etiketini destekliyor', () => {
  assert.ok(/async function sendToDepot\([^)]*doneHtml\)/.test(DASH_SRC),
    'sendToDepot doneHtml parametresi almiyor');
  assert.ok(/if \(!doneHtml\) \{\s*setTimeout/.test(DASH_SRC),
    'doneHtml verildiginde geri alma zamanlayicisi atlanmiyor — dugme yine eski haline doner');
});

test('sendToDepot basari/basarisizlik donduruyor', () => {
  assert.ok(/return true;/.test(DASH_SRC) && /return false;/.test(DASH_SRC),
    'cagiran gonderimin basarili olup olmadigini anlayamaz');
});

test('dokum gonderildikten sonra dugme tekrar gondermiyor', () => {
  assert.ok(/removeAttribute\('data-podnote'\)/.test(DASH_SRC),
    'dugme hala data-podnote tasiyor — ikinci tikla ayni dokum depoya tekrar gider');
  assert.ok(/setAttribute\('data-depotopen', ''\)/.test(DASH_SRC),
    'dugme depoyu acma kisayoluna donusmuyor');
});

summary();
