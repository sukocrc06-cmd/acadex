/* ==========================================================================
   ACADEX — ACADEX KIDS MADALYA, KELİME USTALIĞI, BÜYÜYEN ADA (tests/kids-odul.js), 12.11.2026

   NEDEN VAR: Konu başına 9 yıldız azdı. Artık her konu Bronz · Gümüş · Altın olarak üç kez
   bitirilir (her seviyede daha çok kelime ve seçenek) ve her kelimenin 0-3 ustalık yıldızı var.
   Ada ilerlemeyle büyür (çimen → konunun yapıları → altın kule) ve canlı sakinleri olur. Bu dosya:
     - seviye yıldızları ayrı anahtarlarda; eski kayıtlar (yalnız il.yildiz[konu]) bozulmaz
     - Gümüş/Altın daha zor: seçenek, tur, kelime artar ama sınırı aşmaz
     - ustalık 3'te durur; ada aşaması ilerlemeyle doğru hesaplanır
     - her oyun doğru cevabı ustalığa bildirir (a.dogru); uygulama durak başına bir kez sayar
     - her konunun ada sakinleri ve yapıları çizilebilir
   Tarayıcı ucu (seviye penceresi, uçan yıldızlar, ada büyüme kutlaması) Playwright ile denendi.
   Çalıştırma:  node tests/kids-odul.js
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
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-odul.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};

test('seviye yıldızları ayrı; eski kayıt bronz sayılır; konu en çok 3 kat yıldız', () => {
  const W = yukle(), OD = W.KIDS_ODUL, K = W.KIDS_KONU;
  const eski = { yildiz: { animals: { balon: 3, hafiza: 2, sesbul: 3 } }, bitti: { animals: 1 } };
  assert.equal(OD.seviye(eski, 'animals'), 1, 'eski bitmiş konu bronz');
  assert.equal(OD.konuYildiz(eski, 'animals'), 8);
  const il = { yildiz: { animals: { balon: 3 }, 'animals@2': { balon: 2 }, 'animals@3': { balon: 1 } }, seviye: { animals: 3 } };
  assert.equal(OD.seviyeYildiz(il, 'animals', 2), 2); assert.equal(OD.konuYildiz(il, 'animals'), 6);
  assert.equal(OD.anahtar('animals', 1), 'animals'); assert.equal(OD.anahtar('animals', 3), 'animals@3');
  assert.equal(OD.konuMax('animals'), 3 * K.yildizMax('animals'));
  assert.ok(OD.konuMax('animals') >= 36, 'artık konu başına en az 36 yıldız');
});

test('Gümüş ve Altın daha zor ama sınırlar içinde', () => {
  const W = yukle(), OD = W.KIDS_ODUL, V = W.KIDS_VERI;
  for (const b of Object.values(V.BANT)) {
    const g = OD.bantSeviye(b, 2), a = OD.bantSeviye(b, 3);
    assert.equal(OD.bantSeviye(b, 1), b);
    assert.ok(g.secenek > b.secenek || b.secenek === 6); assert.ok(a.tur > g.tur && g.tur > b.tur);
    assert.ok(a.secenek <= 6 && a.cift <= 8 && a.kelimeSay <= 20 && a.renkSay <= 11 && a.sayiSay <= 20);
    assert.equal(a.ad, b.ad, 'yaş dünyası aynı kalır');
  }
  assert.ok(W.KIDS_KONU.al('food').ogeler(OD.bantSeviye(V.BANT.minik, 3)).length > W.KIDS_KONU.al('food').ogeler(V.BANT.minik).length, 'altında daha çok kelime');
});

test('ustalık 3 ile sınırlı; ada aşaması ilerlemeyle büyür', () => {
  const W = yukle(), OD = W.KIDS_ODUL, V = W.KIDS_VERI;
  const il = { yildiz: {}, usta: { cat: 5, dog: 2 }, bitti: {}, seviye: {} };
  const u = OD.ustalik(il, 'animals', V.BANT.minik);
  assert.equal(u.max, 18); assert.equal(u.n, 5); assert.equal(u.ogren, 1);
  assert.equal(OD.ustaToplam(il), 5);
  assert.equal(OD.asama({ yildiz: {}, usta: {}, bitti: {} }, 'animals'), 0);
  assert.equal(OD.asama(il, 'animals'), 1, 'ustalık varsa çimen');
  assert.equal(OD.asama({ yildiz: {}, usta: {}, bitti: { animals: 1 } }, 'animals'), 2);
  assert.equal(OD.asama({ yildiz: {}, usta: {}, bitti: {}, seviye: { animals: 3 } }, 'animals'), 3);
});

test('ada süsleri ve sakinler her konu için çizilir', () => {
  const W = yukle(), OD = W.KIDS_ODUL, V = W.KIDS_VERI, C = W.KIDS_CIZ;
  for (const k of V.KONU) {
    assert.ok(OD.SAKIN[k.id] && OD.YAPI[k.id], k.id);
    for (const a of [0, 1, 2, 3]) { const h = OD.adaEk(k.id, a); assert.match(h, /kc-sakin|kc-s-kabarcik/, k.id + ' sakin'); if (a >= 2) assert.match(h, /kc-yapi/); if (a === 3) assert.match(h, /kc-kule/); }
    assert.match(C.ada(k.renk, k.simge, false, OD.adaEk(k.id, 2)), /class="kc-ada-ek"/);
  }
  assert.match(OD.madalya(3, false), /kc-madalya/); assert.match(OD.madalya(2, true), /kc-kilitli/);
});

test('oyunlar doğru cevabı bildirir; uygulama durak başına bir kez sayar', () => {
  const o = read('kids/assets/kids-oyun.js'), o2 = read('kids/assets/kids-oyun2.js'), app = read('kids/assets/kids-app.js');
  assert.equal((o.match(/if \(a\.dogru\) a\.dogru\(/g) || []).length, 4, 'balon, hafıza, boyama, say');
  assert.equal((o2.match(/if \(a\.dogru\) a\.dogru\(/g) || []).length, 4, 'sec, yerlestir, simon, karisik');
  assert.match(app, /dogru: ustaArtir/);
  assert.match(app, /if \(!id \|\| S\.goruldu\[id\]\) return; S\.goruldu\[id\] = 1;/);
  assert.match(app, /e = il\.usta\[id\] \|\| 0; if \(e >= 3\) return;/);
  assert.match(app, /il\.yildiz\[ak\]\[d\.id\] = Math\.max\(oncekiY, y\)/);
  assert.match(read('kids/assets/kids-tema.css'), /prefers-reduced-motion:reduce\)\{\.kc-sakin/);
});

summary();
