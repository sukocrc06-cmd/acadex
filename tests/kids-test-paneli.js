/* ==========================================================================
   ACADEX — ACADEX KIDS: TEST EKİBİ "BİLDİR" DÜĞMESİ (tests/kids-test-paneli.js), 20.11.2026

   NEDEN VAR: Acadex'teki Test Paneli düğmesi (js/acadex-test.js) Kids'te de çıkar; kayıtlar
   acadex.com.tr/panel'e düşer. Test ekibi aynı tarayıcıda Acadex hesabıyla giriş yapmış olmalı.
   Bu dosya şunları korur:
     - Acadex oturumu yoksa (çocuk cihazları) hiçbir dış dosya yüklenmez, düğme çıkmaz
     - oturum varsa Supabase kütüphanesi + /js/acadex-test.js yüklenir; yetki yine tp_members
     - Kids sayfa adları ve adres (konu / durak / yaş) kayda düşer; Acadex'teki davranış değişmez
   Tarayıcıda (oturumlu / oturumsuz, sahte Supabase) denendi.
   Çalıştırma:  node tests/kids-test-paneli.js
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
const js = read('kids/assets/kids-test.js'), ax = read('js/acadex-test.js');

function calistir(depo) {
  const eklenen = [], zaman = [];
  const D = { createElement: () => ({ set src(v) { eklenen.push(v); } }), head: { appendChild() { } }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const W = { document: D, localStorage: { getItem: (k) => depo[k] || null }, location: { hash: '' } };
  W.window = W; vm.createContext(Object.assign(W, { setTimeout: (f) => zaman.push(f) }));
  vm.runInContext(js, W);
  zaman.forEach((f) => f());
  return { W, eklenen, zaman };
}

test('oturum yoksa hiçbir şey yüklenmez (çocuk cihazları)', () => {
  const r = calistir({});
  assert.equal(r.zaman.length, 0); assert.equal(r.eklenen.length, 0); assert.equal(r.W.ACADEX_TEST_SAYFA, undefined);
  const bozuk = calistir({ 'sb-yrcdvcsowblzmkpbmkut-auth-token': '{bozuk' });
  assert.equal(bozuk.zaman.length, 0);
});

test('Acadex oturumu varsa test düğmesi yüklenir, Kids sayfaları verilir', () => {
  const r = calistir({ 'sb-yrcdvcsowblzmkpbmkut-auth-token': JSON.stringify({ access_token: 'a', refresh_token: 'b', user: { email: 't@x.com' } }) });
  assert.equal(r.zaman.length, 1);
  assert.ok(r.eklenen[0].includes('supabase-js@2'));
  const S = r.W.ACADEX_TEST_SAYFA;
  assert.ok(S.liste.length >= 12 && S.liste.every((x) => x.startsWith('Kids · ')));
  for (const p of ['Kids · Harita', 'Kids · Masal', 'Kids · Söyle', 'Kids · Sesli cevap / komut', 'Kids · Veli köşesi']) assert.ok(S.liste.includes(p), p);
  assert.match(js, /return yukle\('\/js\/acadex-test\.js'\)/);
});

test('acadex-test.js: Kids listesi kullanılır, Acadex davranışı aynı kalır', () => {
  assert.match(ax, /var DIS = window\.ACADEX_TEST_SAYFA \|\| null;/);
  assert.match(ax, /if \(DIS && DIS\.liste && DIS\.liste\.length\) PAGES = DIS\.liste\.slice\(\);/);
  assert.match(ax, /if \(r\.error \|\| !r\.data\) return;   \/\/ tablo yok ya da ekipte değil: sessiz/, 'ekipte olmayan yine görmez');
  const b = read('kids/assets/birlestir.js'), html = read('kids/index.html');
  assert.ok(b.includes("'kids-test.js'")); assert.ok(html.includes(js.trim().slice(0, 1200)), 'eski index: node kids/assets/birlestir.js');
});

summary();
