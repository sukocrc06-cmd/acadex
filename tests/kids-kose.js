/* ==========================================================================
   ACADEX — ACADEX KIDS ÇİZGİ FİLM SESLERİ, TAM GÖVDELİ HAYVANLAR, OLAYLI KİTAPLAR, KÖŞELER
   (tests/kids-kose.js), 13.11.2026

   NEDEN VAR: Kedinin yalnız kafası vardı ve "Meow"u öğretmen sesi söylüyordu. Kitaplarda olay
   yoktu. Bu turda:
     - hayvan sesi çizgi film efekti (ElevenLabs ses efekti; dosya yoksa tarayıcı sentezi)
     - yalnız yüzü olan hayvanlara gövde, pati, kuyruk; konuşurken ağız açılır
     - kitaplar yaşa göre üç seviye; her yaş dünyası kendi seviyesine kadar olanları görür
     - üç köşe: Evcil hayvanım, Benim günüm, Uyku vakti (uyku vaktinde oyun/ödül yok)
   Tarayıcı ucu (bakım döngüsü, sıralama, ninni, mobil) Playwright ile denendi.
   Çalıştırma:  node tests/kids-kose.js
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
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-hayvan.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js', 'kids-konusan.js', 'kids-kitap.js', 'kids-panel3.js']) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};

test('tam gövdeli hayvanlar: gövde + kuyruk + konuşan ağız; olmayan hayvan olağan çizimle', () => {
  const W = yukle(), HV = W.KIDS_HAYVAN, K = W.KIDS_KONU;
  for (const id of ['cat', 'dog', 'rabbit', 'lion', 'bear', 'cow']) { assert.ok(HV.var(id), id); assert.match(HV.ciz(id), /kc-hayvan[\s\S]*kc-kafa/, id); }
  assert.match(HV.ciz('cat'), /kc-konus-agiz/, 'kedi konuşurken ağzı açılır');
  for (const id of Object.keys(HV.T)) assert.ok(HV.var(id), 'yüz çizimi yok: ' + id);
  assert.ok(!HV.var('apple'));
  const P = K.al('fruits'), o = K.hepsi('fruits')[0];
  assert.equal(HV.en(o, P), P.gorsel(o), 'gövdesi olmayan kelime değişmez');
  assert.match(read('kids/assets/kids-anlat.js'), /KIDS_HAYVAN|HV\.en/);
});

test('çizgi film efektleri: tarif listesi, üretim komutu, dosya yoksa sentez', () => {
  const ef = require(path.join(ROOT, 'kids/ses/efektler.js')), uret = read('kids/ses/uret.js'), ses = read('kids/assets/kids-ses.js');
  assert.ok(ef.length >= 26); assert.equal(new Set(ef.map((x) => x.id)).size, ef.length, 'efekt kimlikleri tekil');
  for (const x of ef) { assert.match(x.id, /^[a-z]+$/); assert.ok(x.metin.length > 20 && x.sure >= 0.5 && x.sure <= 5, x.id); }
  for (const id of ['cat', 'dog', 'cow', 'munch', 'splash', 'snore', 'purr']) assert.ok(ef.some((x) => x.id === id), id);
  assert.match(uret, /\/v1\/sound-generation/); assert.match(uret, /fx:/);
  assert.doesNotMatch(uret, /sk_[A-Za-z0-9]{20,}/, 'anahtar dosyaya yazılmaz');
  assert.match(ses, /if \(HAYVAN\[id\]\) \{ HAYVAN\[id\]\(\);/, 'dosya yoksa sentez');
});

test('kitaplar: yaş dünyası kendi seviyesine kadar olanları görür', () => {
  const W = yukle(), KT = W.KIDS_KITAP;
  const m = KT.kitaplar('minik'), k = KT.kitaplar('kasif'), y = KT.kitaplar('yildiz');
  assert.ok(m.length >= 6 && m.every((b) => b.sv === 1), 'minikler yalnız 1. seviye');
  assert.ok(k.length > m.length && k.every((b) => b.sv <= 2)); assert.equal(y.length, KT.LISTE.length);
  assert.equal(k[0].sv, 2, 'kendi seviyesi önce gelir');
  for (const b of KT.LISTE) { const mx = Math.max(...b.sayfalar.map((s) => s.s.split(' ').length)); assert.ok(mx <= [0, 9, 12, 16][b.sv], b.id + ' cümle uzunluğu ' + mx); }
});

test('köşeler: evcil hayvan ihtiyaçları zamanla azalır; rutin ve gece cümleleri katalogda', () => {
  const W = yukle(), P3 = W.KIDS_PANEL3;
  assert.deepEqual([...P3.TUR.map((t) => t.id)], ['cat', 'dog', 'rabbit']);
  assert.deepEqual([...P3.IHTIYAC.map((x) => x.id)], ['ac', 'temiz', 'oyun', 'uyku']);
  const t0 = Date.now(), il = { evcil: { tur: 'cat', ac: 100, temiz: 100, oyun: 100, uyku: 100, kalp: 0, t: t0 - 4 * 3600e3 } };
  const e = P3.evcilOku(il); assert.equal(e.ac, 100 - 4 * P3.SAATTE, '4 saatte 20 puan'); assert.ok(e.ac >= 0);
  assert.equal(P3.enDusuk({ ac: 100, temiz: 100, oyun: 100, uyku: 100 }), null, 'hepsi doluysa istek yok');
  assert.equal(P3.enDusuk({ ac: 30, temiz: 100, oyun: 60, uyku: 100 }).id, 'ac');
  assert.ok(P3.evcilOku({ evcil: { tur: 'dog', ac: 10, temiz: 10, oyun: 10, uyku: 10, kalp: 0, t: t0 - 1000 * 3600e3 } }).ac >= 0, 'sıfırın altına inmez');
  assert.ok(P3.RUTIN.length >= 8 && P3.GECE.length >= 6);
  const kat = require(path.join(ROOT, 'kids/ses/katalog.js'))(), en = new Set(kat.filter((x) => x.dil === 'en').map((x) => x.metin));
  for (const m of P3.cumleler()) assert.ok(en.has(String(m).trim().replace(/\s+/g, ' ')), 'katalogda yok: ' + m);
  const p3 = read('kids/assets/kids-panel3.js'), uyku = p3.slice(p3.indexOf('Uyku vakti ----'));
  assert.doesNotMatch(uyku, /SES\.fx\('yildiz'\)|yildizUcur|rozet/, 'uyku vaktinde ödül yok');
  assert.match(read('kids/assets/kids-ses.js'), /function ninni\(ac_\)/);
  assert.ok(read('kids/assets/birlestir.js').includes('kids-panel3.js') && read('kids/assets/birlestir.js').includes('kids-hayvan.js'));
  assert.ok(read('kids/index.html').includes('KIDS_PANEL3'), 'index.html yeniden üretilmeli');
});

summary();
