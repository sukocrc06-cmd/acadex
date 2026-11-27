/* ==========================================================================
   ACADEX KIDS — DİNLE VE BUL TESTLERİ (tests/kids-dinlebul.js), 27.11.2026

   NEDEN VAR: anaokulu/kreş çocuğu okuyamaz; İngilizce cümleyi dinler, üç resimden doğrusuna dokunur.
   Veri elle yazılıyor; olmayan bir resim boş kart, yanlışların arasına karışan doğru cevap ise
   çocuğa "yanlış" dedirtir.
     - 10 konu × 7 tur; her turda 3 farklı kart, doğru cevap yanlışların arasında yok.
     - Her resim kimliği KIDS_RESIM'de var; renk/sayı/boy kartları doğru çözülür.
     - Kapı yalnız test ekibinde; balonlar sırayla açılır (ekipte hepsi açık).
     - Söylenen cümleler ses kataloğunda; hareketler "hareketi azalt"a uyar; önek kdb.
   Calistirma:  node tests/kids-dinlebul.js
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
const js = read('kids/assets/kids-dinlebul.js'), css = read('kids/assets/kids-dinlebul.css'), app = read('kids/assets/kids-app.js'), bir = read('kids/assets/birlestir.js');
const W = { document: { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() { }, documentElement: { classList: { add() { }, toggle() { } } } }, addEventListener() { }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() { } }, navigator: {}, console };
W.window = W; W.self = W; vm.createContext(W);
for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-hayvan.js', 'kids-dinlebul.js']) vm.runInContext(read('kids/assets/' + f), W, { filename: f });
const B = W.KIDS_DINLEBUL, R = W.KIDS_RESIM;

test('10 konu, her biri 7 tur; kimlikler tekil', () => {
  assert.equal(B.KONU.length, 10);
  assert.equal(new Set(B.KONU.map((k) => k.id)).size, 10);
  for (const k of B.KONU) { assert.equal(k.s.length, 7, k.id); assert.ok(k.tr && k.renk && k.kapak, k.id + ' ad/renk/kapak'); }
});

test('her tur: tek doğru, iki farklı yanlış, cümle İngilizce', () => {
  for (const k of B.KONU) {
    const cum = new Set();
    for (const q of k.s) {
      assert.equal(q.length, 4, k.id + ' ' + q[0]);
      assert.equal(new Set(q.slice(1)).size, 3, k.id + ' 3 farklı kart: ' + q[0]);
      assert.ok(!q.slice(2).includes(q[1]), k.id + ' doğru yanlışlarda: ' + q[0]);
      assert.match(q[0], /^[A-Z][A-Za-z ',.?!]+[.!?]$/, k.id + ' cümle: ' + q[0]);
      assert.ok(!cum.has(q[0]), k.id + ' tekrar eden cümle: ' + q[0]); cum.add(q[0]);
    }
  }
});

test('her kart çizilebilir: resim var, renk/sayı/boy çözülür', () => {
  const tum = new Set();
  for (const k of B.KONU) { tum.add(k.kapak); for (const q of k.s) q.slice(1).forEach((x) => tum.add(x)); }
  for (const x of tum) {
    const c = B.kartCoz(x);
    assert.ok(['renk', 'say', 'boy', 'resim'].includes(c.tur), x);
    if (c.tur === 'renk') assert.match(c.renk, /^#[0-9A-Fa-f]{6}$/, x);
    else { assert.ok(R.var(c.id), 'resim yok: ' + x + ' → ' + c.id); assert.ok(R.ciz(c.id).length > 50, 'boş çizim: ' + c.id); }
    if (c.tur === 'say') assert.ok(c.n >= 1 && c.n <= 3, x);
  }
});

test('yıldız ve balon sırası; ekipte hepsi açık', () => {
  assert.equal(B.yildiz(0), 3); assert.equal(B.yildiz(1), 3); assert.equal(B.yildiz(3), 2); assert.equal(B.yildiz(4), 1);
  W.KIDS_EKIP = false;
  const i = { dinleBul: {} };
  assert.ok(B.konuAcik(i, 0)); assert.ok(!B.konuAcik(i, 1));
  i.dinleBul[B.KONU[0].id] = 2; assert.ok(B.konuAcik(i, 1)); assert.ok(!B.konuAcik(i, 2));
  W.KIDS_EKIP = true; assert.ok(B.konuAcik({}, 9), 'ekipte hepsi açık'); W.KIDS_EKIP = false;
});

test('kapı yalnız test ekibinde, pakette; önek kdb, hareketi azalt', () => {
  assert.match(app, /\(W\.KIDS_DINLEBUL && W\.KIDS_EKIP \? '<button type="button" class="ka-portal kdb-portal" data-dinlebul/);
  assert.match(app, /W\.KIDS_DINLEBUL\.ac\(\{ kok: app, il: ilerleme/);
  assert.ok(bir.indexOf("'kids-dinlebul.js'") > 0 && bir.indexOf("'kids-dinlebul.js'") < bir.indexOf("'kids-app.js'"));
  assert.match(bir, /'kids-dinlebul\.css'/);
  assert.match(js, /dataset\.gorunum = 'dinlebul'/);
  const kurallar = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  for (const b of kurallar.split(/(?=@media)/)) if (/animation:/.test(b) && !/^@media \(prefers-reduced-motion:no-preference\)/.test(b.trim())) for (const l of b.split('}')) if (/animation:/.test(l) && !/animation:none/.test(l)) assert.fail('korumasız animasyon: ' + l.trim().slice(0, 90));
  const sec = kurallar.split('}').map((r) => r.split('{').slice(-2, -1)[0] || '').map((x) => x.trim()).filter((x) => x && !/^(from|to|\d|@)/.test(x));
  for (const x of sec) for (const parca of x.split(',')) assert.match(parca, /kdb|ka-portal/, 'önek: ' + parca);
});

test('söylenen cümleler katalogda', () => {
  const c = B.cumleler(), kat = require(path.join(ROOT, 'kids/ses/katalog.js'))(), k = new Set(kat.map((x) => x.dil + ':' + x.metin));
  assert.equal(c.en.length, 70);
  for (const m of c.en) assert.ok(k.has('en:' + m.trim().replace(/\s+/g, ' ')), 'katalogda yok: ' + m);
  for (const m of c.tr) assert.ok(k.has('tr:' + m.trim().replace(/\s+/g, ' ')), 'katalogda yok: ' + m);
});

summary();
