/* ==========================================================================
   ACADEX — MASANIN DEVAMI TESTLERİ (tests/masa-renk.js), 27.11.2026

   NEDEN VAR: "Bugün" sayfasının alt kartları renklendi (ders renkleri, bugünün hedefi,
   seri alevi, sınav geri sayımı, Acadia anları). Veri acadex-ink.js'in 'acx:home'
   olayıyla gelir; olay ya da course_tag sorgusu kaybolursa kartlar boş/renksiz kalır.
     - Aynı ders her yerde aynı renkte olmalı (course_tag > ders kodu > belge adı).
     - Yeni kart, CSS ve JS panelde bağlı olmalı; kısayol ikonları çizgi animasyonu
       (drw) kullanmamalı, yoksa dolgulu ikonlar görünmeden kalır.
     - Hareketler "Hareketi azalt" ve prefers-reduced-motion'a uymalı.

   Calistirma:  node tests/masa-renk.js
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
const js = read('js/acadex-masa-renk.js'), css = read('css/acadex-masa-renk.css'), html = read('dashboard.html'), ink = read('js/acadex-ink.js');

const yukle = () => {
  const dinle = {};
  const doc = {
    getElementById: (id) => (id === 'home-view' ? { addEventListener() {} } : null),
    querySelector: () => null, querySelectorAll: () => [], addEventListener: (n, f) => { dinle[n] = f; },
    documentElement: { classList: { contains: () => false } }, createElement: () => ({ style: { setProperty() {} }, setAttribute() {}, appendChild() {} }),
  };
  const win = { document: doc, addEventListener() {}, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} } };
  win.window = win; vm.createContext(win); vm.runInContext(js, win);
  return { W: win, dinle };
};

test('ders anahtarı: course_tag önce, sonra addaki ders kodu, sonra belge adı', () => {
  const { W } = yukle(), M = W.AXMASA;
  assert.equal(M.keyOf('1731000000_Week 5.pptx', 'itb 311'), 'ITB 311');
  assert.equal(M.keyOf('1731000000_ITB 311- Lecture 2-Early Trade Theories.pdf', ''), 'ITB 311');
  assert.equal(M.keyOf('1731000000_MUH201_Chapter_1.pdf', null), 'MUH 201');
  assert.equal(M.kodOf('İKT 102 Arz Talep'), 'İKT 102', 'görünen ad Türkçe harfini korur');
  assert.equal(M.keyOf('x.pdf', 'ikt 102'), M.keyOf('1731000000_İKT 102 Arz Talep.pdf', ''), 'küçük harfli etiket ile dosya adındaki kod aynı ders');
  assert.equal(M.kodOf('Chapter 1'), '', 'ders kodu olmayan ad kod sayılmaz');
  assert.equal(M.kodOf('Week 2026 notları'), '', 'dört haneli sayı ders kodu değil');
});

test('aynı ders hep aynı renk; renkler paletten', () => {
  const { W } = yukle(), M = W.AXMASA;
  assert.deepEqual(M.renk('ITB 311'), M.renk('ITB 311'));
  const set = new Set(['ITB 311', 'MUH 201', 'IKT 102', 'FIZ 101', 'week 5'].map((k) => M.renk(k).c));
  assert.ok(set.size >= 3, 'farklı dersler çoğunlukla farklı renk almalı');
  M.PAL.forEach((p) => { assert.match(p.c, /^#[0-9A-F]{6}$/i); assert.match(p.l, /^#[0-9A-F]{6}$/i); });
});

test('veri köprüsü: acadex-ink.js çizimden sonra acx:home yayar, belgelerde course_tag çekilir', () => {
  assert.match(ink, /renderHours\(D\);\n\s+try \{ document\.dispatchEvent\(new CustomEvent\('acx:home', \{ detail: D \}\)\); \}/);
  assert.match(ink, /select\('id, file_name, uploaded_at, status, course_tag'\)/);
  const { dinle } = yukle(); assert.equal(typeof dinle['acx:home'], 'function');
  assert.match(js, /eq\('event_type', 'exam'\)\.gte\('event_date', ymd\(new Date\(\)\)\)/, 'geri sayım yalnız bugünden sonraki sınavları sorar');
});

test('panel: yeni kart, CSS ve JS bağlı; kart taşınabilir kartlar arasında', () => {
  assert.match(html, /<section class="card c-full land mr-gun" data-mr-gun aria-labelledby="t-gun">/);
  assert.ok(html.indexOf('data-mr-gun') < html.indexOf('aria-labelledby="t-week"'), 'bugünün hedefi haftanın üstünde');
  assert.match(html, /<link rel="stylesheet" href="css\/acadex-masa-renk\.css">/);
  assert.match(html, /<script src="js\/acadex-ink\.js\?v=\d+"><\/script>\n\s*<script src="js\/acadex-masa-renk\.js"><\/script>/);
  ['data-mr-hedef', 'data-mr-seri', 'data-mr-sinav-l', 'data-mr-say'].forEach((h) => assert.ok(html.includes(h), h));
});

test('kısayollar: dolgulu renkli ikonlar, çizgi animasyonu yok, her kartın rengi var', () => {
  const sh = html.slice(html.indexOf('<div class="shorts"'), html.indexOf('</div>', html.indexOf('<div class="shorts"')));
  assert.equal((sh.match(/class="tile"/g) || []).length, 6);
  assert.equal((sh.match(/style="--tc:#[0-9A-F]{6};--tk:#[0-9A-F]{6}"/gi) || []).length, 6);
  assert.doesNotMatch(sh, /class="drw"/);
  assert.equal((sh.match(/class="mr-ic"/g) || []).length, 6);
});

test('hareket: animasyonlar reduced-motion altında, konfeti "Hareketi azalt"a uyar', () => {
  const anim = css.split('\n').filter((l) => /animation:/.test(l) && !/@keyframes/.test(l));
  anim.forEach((l) => { if (!/mr-konfeti i\{/.test(l)) assert.match(l, /prefers-reduced-motion: no-preference/, 'korumasız animasyon: ' + l.slice(0, 90)); });
  assert.match(js, /classList\.contains\('axa-rm'\)/);
  assert.match(js, /var konfeti = function \(host\) \{\n\s+if \(calm\(\)\) return;/);
});

test('kutlama günde bir kez, hedef dakikası yalnız izinli değerler', () => {
  assert.match(js, /store\.get\('kutlama'\) !== ymd\(new Date\(\)\)/);
  assert.match(js, /\[15, 25, 45, 60\]\.indexOf\(v\) >= 0 \? v : 25/);
});

summary();
