/* ==========================================================================
   ACADEX — DIPNOT RENDER TESTLERI (tests/footnote-rendering.js)

   js/dashboard.js icindeki dipnot render fonksiyonlarini, BACKEND'IN ARTIK
   URETTIGI veri bicimiyle test eder.

   Bu testin varlik sebebi: atif motoru degistiginde `footnotes[].reference`
   alaninin icerigi degisti. Eskiden sayfanin ilk satiriydi ("Talep
   Esnekligi" gibi kisa bir baslik); artik kaynaktan birebir alinmis, 220
   karaktere kadar, NOKTALAMA ICEREN tam bir cumle. Ve bu metin inline bir
   `onclick` attribute'una, bir JS string literal'inin icine gomuluyor:

       onclick="... jumpToFootnote(1, 'REFERANS BURAYA', 4)"

   "Frontend'de degisiklik gerekmiyor" iddiasi kodu OKUYARAK verildi.
   Bu dosya onu olcer.

   Calistirma:  node tests/footnote-rendering.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const UI = loadFromSource('js/dashboard.js', [
  'escapeHtml', 'formatFootnoteMarkers', 'renderFootnotesSectionHtml',
  'renderSuggestedTagChipHtml'
]);

const { test, summary } = makeRunner();

/** Uretilen HTML'den onclick attribute'unun degerini cikarir. */
function onclickOf(html) {
  const m = html.match(/onclick="([^"]*)"/);
  return m ? m[1] : null;
}

/**
 * onclick icerigi GECERLI JS mi? new Function sadece ayristirir, calistirmaz
 * — yani jumpToFootnote tanimsiz olsa da sozdizimi hatasi yakalanir.
 * Attribute degeri HTML entity tasiyabilir; tarayici bunlari attribute
 * ayristirmasindan SONRA cozup JS'e verir, o yuzden burada da cozuyoruz.
 */
function onclickIsValidJs(html) {
  const raw = onclickOf(html);
  if (raw === null) return { ok: false, reason: 'onclick attribute bulunamadi' };
  const decoded = raw
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  try { new Function(decoded); return { ok: true, decoded }; }
  catch (e) { return { ok: false, reason: e.message, decoded }; }
}

const fn = (id, reference, page) => ({ id, reference, page });

console.log('\nDIPNOT ISARETCISI RENDER\n');

test('isaretci dogru id ile <sup> uretir', () => {
  const html = UI.formatFootnoteMarkers('Bir iddia [1]', [fn(1, 'Sayfa 4', 4)]);
  assert.match(html, /<sup class="footnote-marker"/);
  assert.match(html, /\[1\]<\/sup>/);
  assert.match(html, /jumpToFootnote\(1,/);
});

test('UZUN cumle referansi (yeni bicim) bozmuyor', () => {
  const long = 'Esneklik katsayisi birden buyukse talep esnek kabul edilir ve firmanin fiyatlandirma stratejisi dogrudan bu duruma gore sekillenmek zorundadir cunku gelir etkisi tersine doner.';
  const html = UI.formatFootnoteMarkers('Bir iddia [1]', [fn(1, long, 11)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}`);
  assert.match(html, /jumpToFootnote\(1,/);
});

test('APOSTROF iceren referans (Turkce: Nash\'in, 2008\'de)', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, "Nash'in dengesi 2008'de yeniden yorumlanmistir", 7)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${r.decoded}`);
});

test('CIFT TIRNAK iceren referans', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Yazar bunu "esnek talep" olarak adlandirir', 3)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${r.decoded}`);
});

test('HTML karakterleri (< > &) kacirilir, enjeksiyon olmaz', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'a < b & c > d <script>alert(1)</script>', 2)]);
  assert.ok(!html.includes('<script>'), 'script etiketi kacirilmali');
  assert.ok(html.includes('&lt;') || html.includes('&amp;lt;'), 'kacirma uygulanmali');
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}`);
});

test('TERS EGIK CIZGI iceren referans', () => {
  // escapeHtml & < > " ' kaciriyor ama \\ KACIRMIYOR. Referans bir JS string
  // literal'inin icine giriyor, orada \\ kacis karakteridir.
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Gosterim \\alpha katsayisi ile verilir', 5)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${r.decoded}`);
});

test('SONU ters egik cizgiyle biten referans (en kotu durum)', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Formul sonu \\', 5)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${r.decoded}`);
});

test('SATIR SONU iceren referans', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Birinci satir\nikinci satir', 5)]);
  const r = onclickIsValidJs(html);
  assert.ok(r.ok, `onclick gecersiz: ${r.reason}\n  ${JSON.stringify(r.decoded)}`);
});

test('eksik dipnot icin yedek metin kullanilir', () => {
  const html = UI.formatFootnoteMarkers('x [9]', [fn(1, 'Sayfa 1', 1)]);
  assert.match(html, /jumpToFootnote\(9,/);
  assert.match(html, /Reference 9/);
});

test('page null ise jumpToFootnote null aliyor', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Bir bolum', null)]);
  assert.match(html, /jumpToFootnote\(1, this\.dataset\.fnRef, null\)/);
  assert.ok(!html.includes('(Sayfa'), 'sayfa yoksa baslikta sayfa yazmamali');
});

// --- DEGISMEZ: yazar metni JS ayristiricisina HIC ulasmamali ----------------
// Bu testin kirilmasi, birinin referansi tekrar onclick icine string olarak
// gommeye dondugu anlamina gelir — apostrof hatasi da onunla geri gelir.
test('DEGISMEZ: referans metni onclick icinde GECMEZ, data- attribute ta durur', () => {
  const ref = "Nash'in dengesi \\alpha ile gosterilir";
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, ref, 7)]);
  const oc = onclickOf(html);
  assert.ok(oc.includes('this.dataset.fnRef'), 'onclick referansi elementten okumali');
  assert.ok(!oc.includes('Nash'), `yazar metni onclick e sizmis: ${oc}`);
  assert.ok(!oc.includes('alpha'), `yazar metni onclick e sizmis: ${oc}`);
  assert.match(html, /data-fn-ref="/, 'data-fn-ref attribute u olmali');
});

test('data-fn-ref degeri attribute i kapatmiyor (cift tirnak kacirilmis)', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Yazar "esnek talep" der', 3)]);
  const m = html.match(/data-fn-ref="([^"]*)"/);
  assert.ok(m, 'data-fn-ref ayristirilabilmeli');
  assert.ok(m[1].includes('&quot;'), 'cift tirnak entity olarak kacirilmali');
  assert.ok(!html.includes('data-fn-ref="Yazar "'), 'attribute erken kapanmamali');
});

test('page varsa baslikta sayfa gorunuyor', () => {
  const html = UI.formatFootnoteMarkers('x [1]', [fn(1, 'Bir cumle', 12)]);
  assert.match(html, /\(Sayfa 12\)/);
});

test('bos metin / bos dipnot listesi guvenli', () => {
  assert.equal(UI.formatFootnoteMarkers('', [fn(1, 'a', 1)]), '');
  assert.equal(UI.formatFootnoteMarkers('isaretcisiz metin', []), 'isaretcisiz metin');
  assert.equal(UI.formatFootnoteMarkers('x [1]', null).includes('<sup'), true);
});

console.log('\nKAYNAKCA BOLUMU RENDER\n');

test('kaynakca cumle referanslarini ve sayfa etiketini basiyor', () => {
  const html = UI.renderFootnotesSectionHtml([
    fn(1, 'Esneklik katsayisi birden buyukse talep esnek kabul edilir.', 11),
    fn(2, 'Marjinal maliyet uretimi bir birim artirmanin maliyetidir.', 12)
  ]);
  assert.match(html, /Esneklik katsayisi/);
  assert.match(html, /Sayfa 11/);
  assert.match(html, /Sayfa 12/);
  assert.match(html, /id="fn-ref-1"/);
});

test('kaynakcada HTML kacirilir', () => {
  const html = UI.renderFootnotesSectionHtml([fn(1, '<script>alert(1)</script>', 1)]);
  assert.ok(!html.includes('<script>'), 'kacirma uygulanmali');
});

test('kaynakca: sayfasiz dipnotta etiket yok', () => {
  const html = UI.renderFootnotesSectionHtml([fn(1, 'Bir bolum', null)]);
  assert.ok(!html.includes('Sayfa'), 'sayfa yoksa etiket basilmamali');
});

test('kaynakca: bos liste bos string', () => {
  assert.equal(UI.renderFootnotesSectionHtml([]), '');
  assert.equal(UI.renderFootnotesSectionHtml(null), '');
});

console.log('\nONERILEN DERS ETIKETI CIPI (ayni tuzagin ikinci ornegi)\n');

test('apostroflu etiket onclick i bozmuyor', () => {
  const html = UI.renderSuggestedTagChipHtml('d1', 'c1', "Isletme'ye Giris");
  const oc = (html.match(/onclick="([^"]*)"/g) || [])[0] || '';
  const decoded = oc.replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/^onclick="/, '').replace(/"$/, '');
  try { new Function(decoded); } catch (e) {
    assert.fail(`onclick gecersiz: ${e.message}\n  ${decoded}`);
  }
});

test('etiket metni onclick e sizmiyor', () => {
  const html = UI.renderSuggestedTagChipHtml('d1', 'c1', "Isletme'ye Giris");
  const m = html.match(/class="btn-accept-tag"[^>]*onclick="([^"]*)"/);
  assert.ok(m, 'accept butonu bulunamadi');
  assert.ok(m[1].includes('this.dataset.suggestedTag'), 'elementten okumali');
  assert.ok(!m[1].includes('Isletme'), `metin sizmis: ${m[1]}`);
});

test('etiket HTML kacirilmis olarak gosteriliyor', () => {
  const html = UI.renderSuggestedTagChipHtml('d1', 'c1', '<script>x</script>');
  assert.ok(!html.includes('<script>'), 'kacirma uygulanmali');
});

test('bos etiket bos string doner', () => {
  assert.equal(UI.renderSuggestedTagChipHtml('d1', 'c1', ''), '');
});

summary().then(() => process.exit(process.exitCode || 0));
