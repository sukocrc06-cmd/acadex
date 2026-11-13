/* ==========================================================================
   ACADEX — ACADEX KIDS KELİME PAKETLERİ, KELİME KİTABIM, SAHNE KUR (tests/kids-paket.js), 13.11.2026

   NEDEN VAR: Konularda 5-6 kelime vardı (alfabe 6, meyve 5-6). Artık her konu 10-32 kelime
   (toplam 500+) ve kelimeler yaşa göre paketlere bölünür (minik 6, kâşif 8, yıldız 10).
   Bir paket bitince sonraki açılır. Bu dosya:
     - her konuda en az 10 kelime; alfabede 26 harf; her kelimenin çizimi ve tekil kimliği var
     - paketler bütün kelimeleri bir kez kapsar; son küçük paket öncekine katılır
     - oyunlar paketteki kelimeleri kullanır; paketin hedefi yoksa konunun tamamına döner
     - paket kilidi: ilk paket açık, bitenin sonrakisi açılır
     - Kelime kitabım ve Sahne kur modülü yüklenir; çoğul sayım cümleleri katalogda
   Tarayıcı ucu (paket seçici, sözlük, sahne kurma, mobil taşma) Playwright ile denendi.
   Çalıştırma:  node tests/kids-paket.js
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
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js', 'kids-odul.js', 'kids-oyun.js', 'kids-oyun2.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};

test('her konuda en az 10 kelime; çizim ve kimlik tekil', () => {
  const W = yukle(), K = W.KIDS_KONU, R = W.KIDS_RESIM;
  const gorulen = new Map(); let toplam = 0;
  for (const id of K.PAKET) {
    const l = K.hepsi(id); toplam += l.length;
    assert.ok(l.length >= 10, id + ' yalnız ' + l.length + ' kelime');
    for (const x of l) {
      assert.ok(x.id && x.en, id + ' kelimesi eksik');
      assert.ok(!gorulen.has(x.id) || gorulen.get(x.id) === id, x.id + ' iki konuda: ' + gorulen.get(x.id) + ', ' + id);
      gorulen.set(x.id, id);
      const h = K.al(id).gorsel(x); assert.match(h, /<svg/, id + '/' + x.id + ' çizimi yok');
    }
    assert.equal(new Set(l.map((x) => x.id)).size, l.length, id + ' içinde tekrar');
  }
  assert.equal(K.hepsi('alphabet').length, 26, 'alfabe 26 harf');
  assert.ok(K.hepsi('fruits').length >= 20 && K.hepsi('animals').length >= 30);
  assert.ok(toplam >= 500, 'toplam ' + toplam);
  assert.ok(R.liste().length >= 450, 'çizim kitaplığı (renk, sayı, harf kendi çizimini kullanır)');
});

test('paketler bütün kelimeleri bir kez kapsar; son küçük paket katılır', () => {
  const W = yukle(), K = W.KIDS_KONU, V = W.KIDS_VERI;
  assert.deepEqual([V.BANT.minik.paketBoy, V.BANT.kasif.paketBoy, V.BANT.yildiz.paketBoy], [6, 8, 10]);
  for (const id of K.PAKET) for (const b of Object.values(V.BANT)) {
    const n = K.paketSayisi(id, b), hep = K.hepsi(id), birlesik = [];
    for (let i = 0; i < n; i++) { const p = K.paketle(hep, { ...b, paket: i }); assert.ok(p.length >= Math.ceil(b.paketBoy / 2), id + ' paket ' + i + ' çok küçük'); birlesik.push(...p.map((x) => x.id)); }
    assert.deepEqual(birlesik, [...hep.map((x) => x.id)], id + ' paketleri eksik/fazla');
  }
  assert.equal(K.paketle([1, 2, 3, 4, 5, 6, 7, 8, 9], { paketBoy: 8, paket: 0 }).length, 9, '9 kelime: tek paket (1 artan katılır)');
  assert.equal(K.paketle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { paketBoy: 8, paket: 1 }).length, 4);
  assert.equal(K.paketle([1, 2, 3], { paketBoy: 8, paket: 7 }).length, 3, 'taşan paket numarası sona sıkışır');
});

test('oyun kelimeleri seçili paketten gelir; hedefsiz pakette konunun tamamına döner', () => {
  const W = yukle(), K = W.KIDS_KONU, V = W.KIDS_VERI;
  const b = { ...V.BANT.kasif, paket: 1 }, p2 = K.al('animals').ogeler(b).map((x) => x.id);
  assert.deepEqual([...p2], [...K.hepsi('animals').slice(8, 16).map((x) => x.id)]);
  assert.deepEqual([...K.al('colours').ogeler({ ...V.BANT.minik, paket: 1 }).map((x) => x.id)], [...K.hepsi('colours').slice(6).map((x) => x.id)]);
  const o2 = read('kids/assets/kids-oyun2.js');
  assert.match(o2, /function hedefGuvenli\(T, a, P\) \{ var l = hedefler\(T, a\.renkler\); return l\.length \? l : hedefler\(T, K\.hepsi/);
  assert.ok((o2.match(/hedefGuvenli\(T, a, P\)/g) || []).length >= 3, 'sec, yerlestir, simon');
  /* mevsimler: 2. pakette mevsim yok ama oyun yine de 4 mevsimle oynar */
  const s = K.al('seasons'), T = s.oyun3;
  if (T && T.hedefler) assert.ok(T.hedefler(K.hepsi('seasons')).length === 4);
});

test('paket kilidi: ilk açık, biten paketin sonrakisi açılır', () => {
  const W = yukle(), OD = W.KIDS_ODUL;
  const il = { paketler: { animals: { 0: 1 } } };
  assert.ok(OD.paketAcik({}, 'animals', 0)); assert.ok(!OD.paketAcik({}, 'animals', 1));
  assert.ok(OD.paketBitti(il, 'animals', 0)); assert.ok(OD.paketAcik(il, 'animals', 1)); assert.ok(!OD.paketAcik(il, 'animals', 2));
  assert.equal(OD.biteniPaket(il, 'animals'), 1);
  const app = read('kids/assets/kids-app.js');
  assert.match(app, /b\.paket = S\.paket \|\| 0/); assert.match(app, /il\.paketler\[/);
});

test('Kelime kitabım ve Sahne kur yüklenir; çoğul sayım cümleleri katalogda', () => {
  const p2 = read('kids/assets/kids-panel2.js');
  assert.match(p2, /W\.KIDS_PANEL2 = \{ sozluk: sozluk, sahne: sahne, SAHNE: SAHNE \}/);
  assert.match(p2, /il\.sahneler/);
  const b = read('kids/assets/birlestir.js');
  for (const f of ['kids-resim3.js', 'kids-temalar3.js', 'kids-panel2.js']) assert.ok(b.includes(f), f + ' paketlenmiyor');
  const html = read('kids/index.html'); assert.ok(html.includes('KIDS_PANEL2') && html.includes('data-sahnekur') && html.includes('data-sozluk'), 'index.html yeniden üretilmeli');
  const kat = require(path.join(ROOT, 'kids/ses/katalog.js'))(), en = new Set(kat.filter((x) => x.dil === 'en').map((x) => x.metin)), tr = new Set(kat.filter((x) => x.dil === 'tr').map((x) => x.metin));
  for (const m of ['Pick a picture!', 'Big!', 'Small!', 'Great picture!', 'cats!', 'ducks!', 'fish!', 'sheep!']) assert.ok(en.has(m), 'katalogda yok: ' + m);
  for (const m of ['Hadi bir sahne kuralım!', 'Önce bir önceki paketi bitir.', 'Yeni bir kelime paketi açıldı!']) assert.ok(tr.has(m), m);
  assert.ok(!en.has('fishes!') && !en.has('sheeps!'), 'yanlış çoğul');
  const csv = read('kids/ses/kayit-metni.csv'); assert.ok(csv.includes('Pick a picture!'), 'kayit-metni.csv yenilenmeli (node kids/ses/uret.js kuru)');
});

summary();
