/* ==========================================================================
   ACADEX — ACADEX KIDS ANİMASYONLU ANLATIM VE OYUN PARKI (tests/kids-park.js), 12.11.2026

   NEDEN VAR: "İzle" durağı animasyonlu sahneye döndü (konuya özgü giriş hareketi, harf harf
   kelime, konuşan Acadia, "senin sıran"); her konuya madalya seviyesine göre değişen bir
   "Park" durağı geldi: Ses avı (bronz), Yapboz / Gölge (gümüş), Harf treni (altın). Bu dosya:
     - 22 konunun hepsinin bir giriş hareketi var; anlatım konunun kendi cümlelerini kullanır
     - park oyunu seviyeye ve konuya göre doğru seçilir (gölgesi ayırt edilemeyen konular gölge oynamaz,
       yazısız yaş dünyası harf treni oynamaz)
     - harf treni yalnız 3-8 harfli tek kelimeleri kullanır; her konunun ses avı komutları katalogda
     - yıldız hesabı park durağını sayar
   Tarayıcı ucu (4 park oyunu × 3 yaş dünyası, sonuna kadar oynandı; 390px'te taşma yok) Playwright ile denendi.
   Çalıştırma:  node tests/kids-park.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const yukle = () => {
  const W = { document: {}, addEventListener() {}, matchMedia: () => ({ matches: false }), KIDS_SES: {} };
  W.window = W;
  const ctx = vm.createContext({ window: W, localStorage: { getItem: () => null, setItem() {} }, console });
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-oyun.js', 'kids-oyun2.js', 'kids-park.js', 'kids-anlat.js', 'kids-odul.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};

test('anlatım: her konunun giriş hareketi ve CSS karşılığı var; Acadia konuşur', () => {
  const W = yukle(), V = W.KIDS_VERI, A = W.KIDS_ANLAT, css = read('kids/assets/kids-anlat.css');
  for (const k of V.KONU) { const h = A.HAREKET[k.id]; assert.ok(h, k.id); assert.ok(css.includes('kn-h-' + h) || h === 'say', k.id + ' → ' + h); }
  assert.match(W.KIDS_CIZ.acadia({ mood: 'mutlu' }), /class="kc-acd-agiz"/);
  assert.match(css, /\.kn-konus \.kc-acd-agiz\{animation:knAgiz/);
  assert.match(read('kids/assets/kids-app.js'), /if \(W\.KIDS_ANLAT\) return W\.KIDS_ANLAT\.izle\(sahne, \{ paket: paket\(\), ogeler: renklerIzle\(\)/);
});

test('park oyunu seviyeye ve konuya göre seçilir', () => {
  const W = yukle(), O = W.KIDS_OYUN, V = W.KIDS_VERI, OD = W.KIDS_ODUL;
  for (const b of Object.keys(V.BANT)) for (const k of V.KONU) {
    assert.equal(O.parkOyun(OD.bantSeviye(V.BANT[b], 1), k.id), 'sesavi');
    for (let i = 0; i < 20; i++) { const g = O.parkOyun(OD.bantSeviye(V.BANT[b], 2), k.id); assert.ok(g === 'yapboz' || (g === 'golge' && !O.GOLGE_YOK[k.id]), k.id + ' ' + g); }
    const a = O.parkOyun(OD.bantSeviye(V.BANT[b], 3), k.id);
    if (V.BANT[b].yazi) assert.equal(a, 'harf'); else assert.ok(a === 'golge' || a === 'yapboz', a);
    if (O.GOLGE_YOK[k.id]) assert.notEqual(a, 'golge');
  }
  for (const id of ['sesavi', 'yapboz', 'golge', 'harf']) assert.equal(typeof O[id], 'function');
});

test('harf treni kelimeleri; ses avı ve park cümleleri katalogda; yıldız park durağını sayar', () => {
  const W = yukle(), O = W.KIDS_OYUN, K = W.KIDS_KONU, V = W.KIDS_VERI;
  assert.ok(O.harfUygun({ en: 'cat' }) && !O.harfUygun({ en: 'T-shirt' }) && !O.harfUygun({ en: 'ice cream' }) && !O.harfUygun({ en: 'ox' }));
  for (const k of V.KONU) if (V.BANT.kasif.yazi) assert.ok(K.al(k.id).ogeler(V.BANT.yildiz).some(O.harfUygun) || k.id === 'places', k.id + ' harf treni için kelime');
  const kat = new Set(require(path.join(ROOT, 'kids/ses/katalog.js'))().map((x) => x.dil + ':' + x.metin));
  for (const m of O.parkCumleler) assert.ok(kat.has('en:' + m), m);
  for (const k of V.KONU) for (const o of K.al(k.id).ogeler(V.BANT.yildiz).filter(O.harfUygun)) { const w = o.kelime || o.en; assert.ok(kat.has('en:' + w + '.') && kat.has('en:' + w + '!'), k.id + ' harf treni sesi: ' + w); }
  for (const k of V.KONU) for (const o of K.al(k.id).ogeler(V.BANT.yildiz)) assert.ok(kat.has('en:' + K.komut(K.al(k.id), o)), K.komut(K.al(k.id), o));
  assert.equal(K.oyunSay('colours'), 4); assert.equal(K.oyunSay('toys'), 5);
  assert.match(read('kids/assets/kids-app.js'), /\{ id: 'park', ad: OYUN\.PARK\[S\.parkSecim \|\| 'sesavi'\]\[1\]/);
  assert.equal((read('kids/assets/kids-park.js').match(/if \(a\.dogru\) a\.dogru\(/g) || []).length, 4, 'dört oyun ustalığa bildirir');
});

summary();
