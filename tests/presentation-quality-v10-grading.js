/* ==========================================================================
   ACADEX — SUNUM KALITE MOTORU: NOTLAMA DAVRANISI
   (tests/presentation-quality-v10-grading.js)

   presentation-v10-quality-smoke.js API'yi ve uc davranisi sabitliyor. Bu
   dosya motorun ASIL ise yarayan ozelligini sabitliyor: AYIRT EDEBILMEK.

   Her desteye 95 veren bir kalite skoru, hic skor olmamasindan kotudur —
   ogrenci ona bakip "iyiymis" der ve sunum kotu kalir. Ilk yazdigimda ideal
   deste 100 aldi ve bu beni rahatsiz etti; asagidaki "vasat deste" tam da o
   suphe icin var ve 59 aliyor.

   Calistirma:  node tests/presentation-quality-v10-grading.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');

global.window = global;
global.document = {
  readyState: 'complete',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  head: { appendChild() {} },
  createElement() { return { style: {}, appendChild() {}, addEventListener() {}, querySelector() { return null; } }; },
};

require('../js/presentation/core/presentation-services-v10.js');
require('../js/presentation/core/presentation-schema-v10.js');
require('../js/presentation/quality/presentation-quality-v10.js');

const Schema = global.AcadexPresentationSchemaV10;
const Quality = global.AcadexPresentationQualityV10;
const Services = global.AcadexPresentationServicesV10;

let gecti = 0;
function test(ad, fn) {
  try { fn(); gecti++; console.log(`  ok    ${ad}`); }
  catch (e) { console.error(`  FAIL  ${ad}\n        ${e.message}`); process.exitCode = 1; }
}

const notlar = (n) => 'Bu slaytta anlatilacak konuyu adim adim acikliyorum ve ornekle destekliyorum.'.slice(0, n || 80);

/** Her acidan saglam bir deste. */
function idealDeste() {
  return [
    { title: 'Giris', content: { design_variant: 'hero', text: 'Arastirmanin amaci' }, speaker_notes: notlar() },
    { title: 'Problem', content: { text: 'Belirsizlik artiyor.\nKararlar veri yogun.', citations: [{ claim: 'belirsizlik', source_id: 's1', page: 2 }] }, speaker_notes: notlar() },
    { title: 'Yontem', content: { design_variant: 'process', text: 'Veri\nModel\nKarar', citations: [{ claim: 'yontem', source_id: 's1', page: 5 }] }, speaker_notes: notlar() },
    { title: 'Bulgular', content: { design_variant: 'data', text: 'Tahmin hatasi dustu.', citations: [{ claim: 'bulgu', source_id: 's1', page: 8 }] }, speaker_notes: notlar() },
    { title: 'Sonuc', content: { design_variant: 'summary', text: 'Veri kalitesi belirleyici.' }, speaker_notes: notlar() }
  ];
}

/** Ogrencinin gercekten uretecegi tipte deste: slayta cok metin, yarim notlar,
 *  cogu slayt kaynaksiz, kapanis slaydi yok. */
function vasatDeste() {
  const uzun = Array(9).fill('Enflasyon genel fiyat duzeyindeki surekli artistir ve satin alma gucunu dusurur.').join('\n');
  return [
    { title: 'Giris', content: { design_variant: 'hero', text: 'Sunumun amaci' }, speaker_notes: 'Kisa.' },
    { title: 'Enflasyon Nedir', content: { text: uzun, citations: [{ claim: 'tanim', source_id: 's1', page: 3 }] }, speaker_notes: notlar() },
    { title: 'Nedenleri', content: { text: 'Talep cekisli\nMaliyet itisli\nParasal genisleme' }, speaker_notes: 'ok' },
    { title: 'Sonuclari', content: { text: uzun }, speaker_notes: '' },
    { title: 'Politika', content: { text: 'Faiz artirimi\nRezerv orani' }, speaker_notes: notlar() }
  ];
}

console.log('\nAYIRT ETME\n');

test('iyi deste ile vasat deste arasinda belirgin fark var', () => {
  const iyi = Quality.reviewDeck(idealDeste(), { source_type: 'document' }).score;
  const vasat = Quality.reviewDeck(vasatDeste(), { source_type: 'document' }).score;
  assert.ok(iyi - vasat >= 25,
    `aradaki fark cok kucuk (iyi=${iyi}, vasat=${vasat}) — boyle bir skor ogrenciye hicbir sey anlatmaz`);
  assert.ok(vasat < 75, `vasat deste yuksek puan aliyor (${vasat})`);
  assert.ok(iyi >= 85, `iyi deste hak ettigi puani almiyor (${iyi})`);
});

test('her bulgu somut: hangi slayt, ne kadar', () => {
  const r = Quality.reviewDeck(vasatDeste(), { source_type: 'document' });
  assert.ok(r.issues.length >= 3, 'vasat destede birden fazla sorun bulunmali');
  for (const i of r.issues) {
    assert.ok(i.type && i.severity && i.message, `eksik alanli bulgu: ${JSON.stringify(i)}`);
    assert.ok(/\d/.test(i.message), `bulgu sayi icermiyor, eyleme donuk degil: "${i.message}"`);
  }
});

console.log('\nGROUNDING\n');

test('konu kaynakli destede kaynak aranmiyor', () => {
  // Konudan uretilen bir sunumda atfedilecek bir kaynak YOK; grounding'den
  // puan kirmak, ogrenciyi ozelligi tasarlandigi gibi kullandigi icin
  // cezalandirmak olurdu.
  const r = Quality.reviewDeck(idealDeste(), { source_type: 'topic' });
  assert.equal(r.metrics.grounding, 100);
  assert.equal(r.meta.groundingApplicable, false);
  assert.ok(!r.issues.some((i) => i.type === 'grounding'));
});

test('acilis ve kapanis slaytlari kaynak istemiyor', () => {
  // Baslik slaydina atif zorunlu kilinirsa uretec oraya sahte bir atif koyar.
  const r = Quality.reviewDeck(idealDeste(), { source_type: 'document' });
  assert.equal(r.meta.claimBearingSlides, 3, '5 slaydin hero ve summary olanlari sayilmamali');
  assert.equal(r.metrics.grounding, 100);
});

test('kaynaksiz belge destesi dusuk grounding aliyor', () => {
  const kaynaksiz = idealDeste().map((s) => ({ ...s, content: { ...s.content, citations: [] } }));
  const r = Quality.reviewDeck(kaynaksiz, { source_type: 'document' });
  assert.equal(r.metrics.grounding, 0);
  assert.ok(r.suggestions.some((x) => /Citation Engine/i.test(x)));
});

console.log('\nTEKRAR\n');

test('ayni slayt iki kez varsa yakalaniyor', () => {
  const d = idealDeste();
  d.push({ ...d[1], title: d[1].title });
  const r = Quality.reviewDeck(d, { source_type: 'document' });
  assert.ok(r.metrics.repetition < 100);
  const bulgu = r.issues.find((i) => i.type === 'repetition');
  assert.ok(bulgu, 'tekrar bulgusu olmali');
  assert.ok(/\d+\. ve \d+\. slaytlar/.test(bulgu.message), 'hangi iki slayt oldugu yazmali');
});

test('farkli konulu slaytlar tekrar sayilmiyor', () => {
  // Yanlis pozitif, bulamamaktan kotu: ogrenci iyi bir slaydi siler.
  const r = Quality.reviewDeck(idealDeste(), { source_type: 'document' });
  assert.equal(r.metrics.repetition, 100, 'birbirinden farkli slaytlar tekrar sayilmamali');
  assert.equal(r.meta.duplicatePairs, 0);
});

console.log('\nSEMA\n');

test('camelCase girdi snake_case cikti veriyor', () => {
  // Iki taraf var: JS cagiranlar designVariant yaziyor, Postgres kolonlari ve
  // edge function snake_case konusuyor. Bu dosyadan once her iki taraf da
  // tahmin ediyordu.
  const s = Schema.normalizeSlide({
    title: 'T', layout: 'chart',
    content: { designVariant: 'data', citations: [{ claim: 'x', sourceId: 's1', page: 4 }] }
  }, 0);
  assert.equal(s.schema_version, 10);
  assert.equal(s.layout_type, 'chart');
  assert.equal(s.content.design_variant, 'data');
  assert.equal(s.content.citations[0].source_id, 's1');
  assert.equal(s.content.citations[0].locator.page, 4);
});

test('taninmayan layout/variant sessizce guvenli degere dusuyor', () => {
  const s = Schema.normalizeSlide({ title: 'T', layout: 'uydurma', content: { designVariant: 'yok' } }, 3);
  assert.equal(s.layout_type, 'text');
  assert.equal(s.content.design_variant, 'plain');
  assert.equal(s.position, 3);
});

test('bos atif elenir', () => {
  // Ne iddiasi ne kaynagi olan bir atif hicbir yerde dogrulanamaz; onu
  // saymak, kimsenin yapmadigi bir is icin puan vermek olur.
  const s = Schema.normalizeSlide({ content: { citations: [{}, { claim: 'var' }, null] } }, 0);
  assert.equal(s.content.citations.length, 1);
});

console.log('\nSERVIS KATMANI\n');

test('Supabase yokken null doner, sonsuz donguye girmez', () => {
  // Bu testin asil derdi "null donuyor mu" degil: bu yardimciyi yazmanin
  // bariz yolu, birbirini cagiran iki getter kurmak ve tarayicida aninda
  // stack overflow almaktir — hem de tam olarak client'in yuklenemedigi
  // sayfada, yani temiz bir null'a en cok ihtiyac duyulan yerde.
  assert.equal(Services.resolveSupabase(), null);
});

test('state() eksik global varken bos deste doner', () => {
  const s = Services.state();
  assert.deepEqual(s.slides, []);
  assert.equal(s.presentationId, null);
  assert.equal(s.activeIndex, 0);
});

console.log(`\n${gecti} test gecti${process.exitCode ? ' (BASARISIZ olanlar var)' : ''}\n`);
