/* ==========================================================================
   ACADEX — YUKLEME GOSTERGESI (tests/yukleme-gostergesi.js)

   NEDEN VAR (27.10.2026): "bir sey yukledigim zaman ekranda bir sey
   gorunmuyor, sanki bir sey olmamis gibi, sonra bir anda yukleniyor."

   Iki kusur birdeydi:

     1) Cubugun yuzdesi tamamlanan/toplam idi. ILK dosyada bu sifir, yani
        cubuk sifir genislikte — hic gorunmuyor. Tek dosya yukleyen biri
        cubugu ancak %100'e atlarken goruyordu; arada dosyanin tamamini
        okuyan bir SHA-256 ve gercek yukleme var.
     2) Asama metni dosya basina bir kez yazilip oyle kaliyordu ve yalnizca
        Ingilizce idi; hangi isin surdugu (okuma / yukleme / kayit) hic
        yazmiyordu.

   KRITIK: canli yol handleMultipleFilesUpload + uploadSingleFileCore.
   handleFileUpload'in repoda tek cagrilani YOK — CLAUDE.md bolum 4'teki
   dersin aynisi: once cizen yolu dogrula, sonra yaz. Bu dosyanin ilk isi
   o olu yola yama yapilmadigini olcmek.

   Calistirma:  node tests/yukleme-gostergesi.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const dash = read('js/dashboard.js');
const html = read('dashboard.html');
const { test, summary } = makeRunner();

/** Canli yukleyicinin govdesi. */
const canliYol = () => {
  const a = dash.indexOf('async function handleMultipleFilesUpload(files) {');
  assert.ok(a > 0, 'canli yukleyici bulunamadi');
  const b = dash.indexOf('async function uploadSingleFileCore(', a);
  assert.ok(b > a, 'cekirdek bulunamadi');
  return dash.slice(a, b);
};

test('CANLI YOL dogrulanmis: dosya secimi handleMultipleFilesUpload a gidiyor', () => {
  /* Bu test digerlerinin dayanagi. handleFileUpload'a yama yapmak ekranda
     hicbir sey degistirmez; o yol oluyken buradaki iddialar bos cikardi. */
  assert.ok(dash.includes("fileInput.addEventListener('change'"), 'dosya secimi baglanmamis');
  assert.equal((dash.match(/handleMultipleFilesUpload\(files\);/g) || []).length, 2,
    'secim ve surukle-birak yollarinin ikisi de canli yukleyiciye gitmeli');
  assert.equal((dash.match(/handleFileUpload\(/g) || []).length, 1,
    'handleFileUpload cagrilmaya baslamis — yol degistiyse testler yeniden yazilmali');
});

test('CUBUK ilk dosyada da GORUNUYOR', () => {
  const b = canliYol();
  assert.ok(!b.includes('const percentage = Math.round((completedCount / totalCount) * 100);'),
    'eski yuzde geri gelmis — ilk dosyada cubuk sifir genislikte kalir');
  assert.ok(b.includes("progressBar.style.width = `${Math.max(3, Math.round(a + (b - a) * oran))}%`"),
    'cubuk taban genislik tasimiyor');
  assert.ok(b.includes('const a = (completedCount / totalCount) * 100;') &&
    b.includes('const b = ((completedCount + 1) / totalCount) * 100;'),
    'dosya basina band hesabi yok — cubuk yalnizca dosya bitince ziplar');
});

test('CUBUK is surerken OYNUYOR', () => {
  /* Supabase JS gercek yukleme yuzdesi vermiyor. Band icinde hedefe dogru
     yumusak ilerleme, "ekranda bir sey oluyor" hissinin tek kaynagi. */
  const b = canliYol();
  assert.ok(b.includes('let oran = 0, hedef = 0;'), 'ilerleme durumu yok');
  assert.ok(b.includes('const ilerlemeTik = setInterval(() => {'), 'ilerleme zamanlayicisi yok');
  assert.ok(b.includes('oran += (hedef - oran) * 0.18;'), 'hedefe dogru ilerleme yok');
  assert.ok(dash.includes('clearInterval(ilerlemeTik);'),
    'zamanlayici kapatilmiyor — yukleme bittikten sonra da donup durur');
});

test('ASAMALAR cekirdekten BILDIRILIYOR', () => {
  /* Hangi adimda oldugunu yalnizca cekirdek biliyor; en uzun adim olan
     hash (dosyanin tamami + SHA-256) eskiden hic yazmiyordu. */
  assert.ok(dash.includes('async function uploadSingleFileCore(file, bildir) {'),
    'cekirdek asama bildirmiyor');
  assert.ok(dash.includes("const asama = typeof bildir === 'function' ? bildir : () => {};"),
    'bildirim opsiyonel degil — window.uploadSingleFileCore tek argumanla cagrilabiliyor');
  const i = dash.indexOf('async function uploadSingleFileCore(file, bildir) {');
  const g = dash.slice(i, i + 2200);
  for (const ad of ['okuma', 'yukleme', 'kayit']) {
    assert.ok(g.includes("asama('" + ad + "')"), ad + ' asamasi bildirilmiyor');
  }
  assert.ok(g.indexOf("asama('okuma')") < g.indexOf('checkFileHashDuplicate'),
    'okuma asamasi hash ten SONRA bildiriliyor — en uzun adim yine sessiz gecer');
  assert.ok(g.indexOf("asama('yukleme')") < g.indexOf('.upload(storagePath, file)'),
    'yukleme asamasi upload tan sonra bildiriliyor');
  assert.ok(dash.includes('await uploadSingleFileCore(file, (ad) => asamaBildir(ad, file.name));'),
    'isci bildirimi gecirmiyor — cekirdek konusuyor, kimse dinlemiyor');
});

test('ASAMA METNI iki dilli ve hedefi var', () => {
  const b = canliYol();
  assert.ok(b.includes("const isTrUpload = (localStorage.getItem('acadexUILang') || 'en') === 'tr';"),
    'arayuz dili okunmuyor — Turkce kullaniciya Ingilizce yaziyor');
  assert.ok(b.includes('Dosya okunuyor:') && b.includes('Yükleniyor:') && b.includes('Arşive kaydediliyor:'),
    'Turkce asama metinleri eksik');
  assert.ok(b.includes('Reading file:') && b.includes('Uploading:') && b.includes('Saving to archive:'),
    'Ingilizce asama metinleri eksik');
  assert.ok(b.includes("if (ad === 'okuma') { hedef = 0.2;") && b.includes("else if (ad === 'yukleme') { hedef = 0.85;"),
    'asamalar cubuk hedefine baglanmamis');
  // Metni tasiyan dugum HTML de gercekten var olmali.
  assert.ok(html.includes('id="upload-progress-text"'), 'asama metni dugumu HTML de yok');
});

test('GOSTERGE kapanirken metin de TEMIZLENIYOR', () => {
  /* Kalirsa bir sonraki yuklemede onceki dosyanin adi bir an gorunur. */
  const i = dash.indexOf('function resetUploadUI() {');
  assert.ok(i > 0, 'resetUploadUI bulunamadi');
  const b = dash.slice(i, i + 900);
  assert.ok(b.includes("progressText.textContent = ''") && b.includes("progressText.style.display = 'none'"),
    'asama metni temizlenmiyor');
});

test('ASAMA METNI kirpilan kutunun DISINDA', () => {
  /* 27.10.2026, canli ekran goruntusu: cubuk gorunuyor, metin yok.
     #upload-progress-text, #progress-container'in ICINDEYDI; o kutu
     style.css'te height:6px + overflow:hidden, acadex-ink.css'te
     height:8px — metin ciziliyordu ama kirpiliyordu. JS dogruydu
     (display:block veriyordu), kusur markup'taydi. */
  const base = read('css/style.css');
  assert.ok(/\.progress-container \{[^}]*overflow: hidden/.test(base),
    'kirpma kalkmis — bu test artik var olmayan bir sebebi koruyor');
  const i = html.indexOf('id="progress-container"');
  const j = html.indexOf('id="upload-progress-text"');
  assert.ok(i > 0 && j > i, 'dugumler bulunamadi');
  /* IKI kapanis: biri cubugun, biri kutunun. Tek kapanis, metnin hala
     kutunun icinde oldugu anlamina gelir. Ilk surumde tek kapanis
     ariyordum ve cubugun kendi kapanisi testi YANLIS yesil yapiyordu —
     markup'i geri alan mutasyon testi dusurmedi. */
  assert.ok((html.slice(i, j).match(/<\/div>/g) || []).length >= 2,
    'asama metni hala kirpilan kutunun icinde — ekranda gorunmez');
  assert.ok(html.slice(j, j + 240).includes('display:none'),
    'metin varsayilan olarak gizli degil — bos satir yer kaplar');
  const ink = read('css/acadex-ink.css');
  assert.ok(ink.includes('#docs-view #upload-progress-text{max-width:600px;margin:8px auto 0;'),
    'metin cubukla hizalanmiyor');
});

test('ASAMA SURELERI olculuyor', () => {
  /* "Yavasladi mi, internet mi" sorusu ancak olcumle cevaplanir: okuma
     yerel is (dosyanin tamami + SHA-256), yukleme ag isi. Ikisi ayri
     yazilmazsa ekran goruntusunden teshis edilemez. */
  const i = dash.indexOf('async function uploadSingleFileCore(file, bildir) {');
  assert.ok(i > 0, 'cekirdek bulunamadi');
  const g = dash.slice(i, i + 2800);
  assert.ok(g.includes('const olcum = { t0: Date.now(), okuma: 0, yukleme: 0, kayit: 0 };'),
    'olcum baslamiyor');
  assert.ok(g.includes('olcum.okuma = Date.now() - olcum.t0;'), 'okuma olculmuyor');
  assert.ok(g.includes('olcum.yukleme = Date.now() - yuklemeBasladi;'), 'yukleme olculmuyor');
  assert.ok(g.includes('olcum.kayit = Date.now() - kayitBasladi;'), 'kayit olculmuyor');
  assert.ok(g.includes('[yukleme] ') && g.includes('okuma ${olcum.okuma}ms'),
    'olcum loga basilmiyor');
});

summary();
