/* ==========================================================================
   ACADEX — ACADEX KIDS İKİNCİ TAKIMADA, KARIŞIK DURAK, KİTAPLIK, MATERYAL (tests/kids-dunya.js), 12.11.2026

   NEDEN VAR: Kids 22 konuya çıktı (ilk on temaya ikinci kat kelimeler + on yeni tema),
   sayı × renk × kelimeyle sınırsız soru üreten "Karışık" durak, ada dünyaları
   (her konunun arka planı), hikâye kitaplığı ve yazdırılabilir materyal geldi. Bu dosya:
     - 22 konunun her birinin paketi, oyunu, dünyası, rozeti var; kelime kimlikleri tekil
     - karışık durak yalnız sayılabilir (ve renkli konularda boyanabilir) kelimeleri kullanır,
       çoğulları doğru kurar; parçalı seslendirmenin parçaları katalogda
     - kitapların bütün resimleri çizilir; cümleleri, kelimeleri ve soruları katalogda
     - materyal her konu ve yaş dünyası için dört türü de üretir; isim basılmaz
   Tarayıcı ucu (22 konu, karışık durak, kitap okuma ve sorular, bülten/materyal PDF'i) Playwright ile denendi.
   Çalıştırma:  node tests/kids-dunya.js
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
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js', 'kids-oyun.js', 'kids-oyun2.js', 'kids-kitap.js', 'kids-yazdir.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};
const kat = () => new Set(require(path.join(ROOT, 'kids/ses/katalog.js'))().map((x) => x.dil + ':' + x.metin));

test('22 konu: paket, oyun, dünya, rozet; ikinci takımada işaretli', () => {
  const W = yukle(), V = W.KIDS_VERI, K = W.KIDS_KONU, R = W.KIDS_RESIM, O = W.KIDS_OYUN;
  assert.equal(V.KONU.length, 22); assert.equal(V.KONU.filter((k) => k.grup === 2).length, 10);
  for (const k of V.KONU) {
    const p = K.al(k.id); assert.ok(p && k.acik && k.rozet, k.id);
    assert.equal(typeof O[p.oyun3.id], 'function', k.id + ' oyunu');
    assert.ok(R.DUNYA[k.id], k.id + ' dünyası'); assert.match(R.dunya(k.id), /<svg class="ka-dunya-r"/);
    for (const o of p.ogeler(V.BANT.yildiz)) assert.ok(k.id === 'colours' || k.id === 'numbers' || R.var(o.id), o.id + ' çizimi');
    assert.equal(K.yildizMax(k.id), 3 * K.oyunSay(k.id));
  }
  assert.equal(K.al('alphabet').ogeler(V.BANT.yildiz).length, 26);
  assert.equal(K.al('numbers').ogeler(V.BANT.yildiz).length, 20);
  assert.equal(K.al('colours').ogeler(V.BANT.yildiz).length, 11);
});

test('karışık durak: sayılabilir kelimeler, doğru çoğullar, parçalar katalogda', () => {
  const W = yukle(), V = W.KIDS_VERI, K = W.KIDS_KONU, T = W.KIDS_TEMALAR, R = W.KIDS_RESIM, O = W.KIDS_OYUN, k = kat();
  const c = (id) => T.cogul(V.ogeBul(id));
  assert.deepEqual([c('mouse'), c('sheep'), c('bus'), c('peach'), c('strawberry'), c('cat'), c('fish'), c('dress')], ['mice', 'sheep', 'buses', 'peaches', 'strawberries', 'cats', 'fish', 'dresses']);
  assert.ok(!T.karisikUygun(V.ogeBul('milk')) && !T.karisikUygun(V.ogeBul('eyes')) && T.karisikUygun(V.ogeBul('apple')));
  for (const id of K.PAKET) {
    const p = K.al(id); if (!p.karisik) continue;
    const l = p.ogeler(V.BANT.yildiz).filter(T.karisikUygun).filter((x) => p.karisik !== 'renk' || R.boyanir(x.id));
    assert.ok(l.length >= 5, id + ' karışık için en az 5 kelime');
    for (const m of O.karisikParca(p)) assert.ok(k.has('en:' + m), id + ' → ' + m);
  }
  for (const s of V.SAYI) assert.ok(k.has('en:' + s.en), s.en); for (const r of V.RENK) assert.ok(k.has('en:' + r.en), r.en);
  assert.notEqual(R.boya('car', '#4AA8FF'), R.ic('car'), 'araba boyanır');
  assert.match(read('kids/assets/kids-ses.js'), /function dizi\(parcalar, dil\)/);
  assert.match(read('kids/assets/kids-app.js'), /\{ id: 'karisik', ad: 'Karışık', simge: 'gokkusagi', oyun: 1 \}/);
});

test('kitaplık: her konuya bir kitap; resimler çizilir; metinler katalogda', () => {
  const W = yukle(), V = W.KIDS_VERI, KT = W.KIDS_KITAP, C = W.KIDS_CIZ, k = kat(), yok = C.simge('bu-yok');
  assert.deepEqual([...new Set(KT.LISTE.map((b) => b.konu))].sort(), [...V.KONU.map((x) => x.id)].sort());
  for (const b of KT.LISTE) {
    /* 13.11.2026: olaylı hikâyeler, yaşa göre üç seviye: 1 Minikler 6 sayfa · 2 Kâşifler 7 · 3 Yıldızlar 8 */
    assert.ok([1, 2, 3].includes(b.sv), b.id + ' seviye'); assert.equal(b.sayfalar.length, 5 + b.sv, b.id); assert.equal(b.sorular.length, 3, b.id);
    assert.ok(b.sayfalar.some((s) => s.n) && b.sayfalar.some((s) => s.t || s.d), b.id + ' katılım (nakarat + tahmin/dokun) olmalı');
    for (const s of b.sayfalar) { if (s.n) assert.ok(k.has('en:' + s.n), s.n); if (s.t) { assert.ok(k.has('en:' + s.t.s), s.t.s); assert.ok(s.t.y.includes(s.t.c), b.id + ' tahmin cevabı seçeneklerde'); } }
    for (const id of [].concat(...b.sayfalar.map((s) => s.r), ...b.sorular.map((q) => [q.c, ...q.y]))) assert.ok(id === 'star' || KT.gorsel(id) !== yok, b.id + ' resim ' + id);
    for (const q of b.sorular) assert.ok(q.y.includes(q.c), b.id + ' doğru cevap seçeneklerde');
    for (const s of b.sayfalar) { assert.ok(k.has('en:' + s.s), s.s); for (const w of KT.kelimeler(s.s)) assert.ok(k.has('en:' + w), w); }
    for (const q of b.sorular) assert.ok(k.has('en:' + q.s), q.s);
  }
});

test('materyal: her konu ve yaş dünyası için dört tür; isim basılmaz', () => {
  const W = yukle(), V = W.KIDS_VERI, Y = W.KIDS_YAZDIR;
  for (const k of V.KONU) for (const b of Object.keys(V.BANT)) for (const t of ['boyama', 'kart', 'bingo', 'sertifika']) {
    const h = Y.uret(t, k.id, b, 3); assert.match(h, /class="ky-sayfa/, k.id + '/' + b + '/' + t);
    for (const s of V.OKUL.siniflar) for (const o of s.ogr) assert.ok(!h.includes('>' + o[0] + '<'), 'çocuk adı basıldı');
  }
  assert.doesNotMatch(Y.uret('boyama', 'animals', 'kasif', 1), /fill="#FF9F45"/, 'boyama sayfası renksiz');
  assert.match(read('kids/assets/kids-ogretmen.js'), /data-materyal/);
  assert.match(read('kids/assets/kids-app.js'), /data-vyaz="boyama"/);
});

summary();
