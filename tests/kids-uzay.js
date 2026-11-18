/* ==========================================================================
   ACADEX — ACADEX KIDS: UZAY TEMASI (tests/kids-uzay.js), 19.11.2026

   NEDEN VAR: Giriş akışı ve harita uzayda geçer (kids/assets/kids-uzay.js/.css):
   adalar konunun renginde gezegen, çocuk kendi hayvanıyla kasklı astronot olarak
   gezegenden gezegene uçar, arkada kat kat yıldızlar, kayan yıldızlar ve ateş topları.
   Bu dosya şunları korur:
     - paket: dosyalar index.html içinde, dış kaynak yok, kids-ciz'den sonra yüklenir
     - gezegen: NaN yok, her gezegenin degrade kimliği tek, aşamaya göre bayrak / ay / altın
       halka, kilitli gezegende süs yok ve soluk
     - harita: gezegen çizer, astronot uçuşu bitince konu açılır, Acadia ikinci kez uçmaz
     - uzay yalnız giriş ve haritada; konu ekranlarının kendi sahnesi bozulmaz
     - hareketi azaltta yıldızlar durağan, kayan yıldız / ateş topu yok
     - telefonu yormaz: piksel oranı en çok 2, sekme gizliyken durur
   Tarayıcıda (Playwright, masaüstü + telefon) denendi.
   Çalıştırma:  node tests/kids-uzay.js
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
const js = read('kids/assets/kids-uzay.js'), css = read('kids/assets/kids-uzay.css'), app = read('kids/assets/kids-app.js'), ucus = read('kids/assets/kids-ucus.js');

test('paket: uzay dosyaları index.html içinde, dış kaynak yok', () => {
  const b = read('kids/assets/birlestir.js'), html = read('kids/index.html');
  for (const f of ['kids-uzay.css', 'kids-uzay.js']) assert.ok(b.includes("'" + f + "'"), f);
  assert.ok(b.indexOf("'kids-uzay.js'") > b.indexOf("'kids-ciz.js'") && b.indexOf("'kids-uzay.js'") < b.indexOf("'kids-app.js'"));
  for (const f of ['kids-uzay.js', 'kids-uzay.css']) {
    assert.ok(html.includes(read('kids/assets/' + f).trim().slice(0, 2500)), f + ' eski: node kids/assets/birlestir.js');
    assert.doesNotMatch(read('kids/assets/' + f), /https?:\/\/(?!www\.w3\.org)/, f + ' dış kaynak yok');
  }
});

const win = { matchMedia: () => ({ matches: false }), addEventListener() {}, document: { readyState: 'complete', getElementById: () => null, addEventListener() {}, documentElement: { classList: { contains: () => false } } } };
win.window = win;
const ctx = { window: win, document: win.document, Math, JSON, String, Number, Array, Object, parseInt, isFinite };
vm.createContext(ctx);
vm.runInContext(read('kids/assets/kids-ciz.js'), ctx);
vm.runInContext(js, ctx);
const U = win.KIDS_UZAY;

test('gezegen: NaN yok, degrade kimliği tek, aşama süsleri, kilitli soluk', () => {
  const g0 = U.gezegen('#FF7AA8', 'yildiz', false, 0, 0), g3 = U.gezegen('#4AA8FF', 'yildiz', false, 3, 1), k = U.gezegen('#4AA8FF', 'yildiz', true, 3, 2);
  for (const s of [g0, g3, k]) { assert.ok(!/NaN|undefined/.test(s)); assert.match(s, /class="kc kc-ada kz-gz/); }
  const ids = [g0, g3, k].flatMap((s) => [...s.matchAll(/id="(kz[gl]\d+)"/g)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length, 'her gezegenin degradesi kendine ait');
  assert.ok(!/kz-bayrak|kz-ay|kz-altin/.test(g0));
  assert.ok(/kz-bayrak/.test(g3) && /kz-ay/.test(g3) && /kz-altin/.test(g3));
  assert.ok(!/kz-bayrak|kz-ay|kz-altin/.test(k), 'kilitlide süs yok');
  assert.match(k, /kz-kilit/); assert.match(k, /opacity="\.45"/);
  assert.match(g3, /a92 22 0 0 0 184 0/, 'her üç gezegenden birinde halka');
  assert.equal(U._test.karis('#000000', '#ffffff', 0.5), '#808080');
});

test('harita: gezegen çizer; astronot uçar, sonra konu açılır; Acadia ikinci kez uçmaz', () => {
  assert.match(app, /W\.KIDS_UZAY \? W\.KIDS_UZAY\.gezegen\(k\.renk, k\.simge, !k\.acik, k\.acik \? as : 0, i\) : C\.ada/);
  assert.match(app, /W\.KIDS_UZAY\.uc\(kid, function \(\) \{ adaSec\(kid\); \}\)/);
  assert.match(app, /W\.KIDS_UZAY\.yerlestir\(app, \{ anahtar:/);
  assert.match(app, /duration: uzay \? 1 : 780/);
  assert.match(ucus, /W\.KIDS_UZAY \? W\.KIDS_UZAY\.gezegen\(/, 'giriş uçuşunda da gezegenler');
  assert.match(js, /setTimeout\(bit, 1400\)/, 'animasyon takılsa da konu açılır');
});

test('uzay yalnız giriş ve harita; hareketi azaltta sakin; telefonu yormaz', () => {
  assert.match(js, /var TAM = \{ giris: 1, harita: 1 \}, SAKINGOR = \{\}/);
  assert.match(js, /if \(SAKIN \|\| tek\) return;/, 'hareketi azaltta kayan yıldız / ateş topu yok');
  assert.match(js, /if \(SAKIN\) \{ ciz\(performance\.now\(\), true\); return; \}/);
  assert.match(js, /Math\.min\(2, W\.devicePixelRatio/);
  assert.match(js, /if \(D\.hidden\) dur\(\); else basla\(\)/);
  assert.match(css, /\.kz-tuval\{position:fixed;inset:0;[^}]*pointer-events:none/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.kz-ast\{animation:none\}/);
  assert.match(css, /html\.kz-uzay body,html\.kz-uzay-sakin body\{\s*background-color:#0B1033/);
});

summary();
