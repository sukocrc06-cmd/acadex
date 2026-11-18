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
     - 3B galaksi (kids-uzay3d.mjs, three.js r160 içinde): dış bağlantı yok, çevrimdışı önbellekte,
       WebGL yoksa / modül gelmezse düz haritaya döner; düğmeler gerçek düğme olarak gezegen üstünde
   Tarayıcıda (Playwright + SwiftShader WebGL, masaüstü + telefon) denendi.
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


test('3B galaksi: modül yerel, önbellekte, düşerse düz harita; düğmeler gezegen üstünde', () => {
  const mjs = read('kids/assets/kids-uzay3d.mjs'), src = read('kids/assets/kids-uzay3d.src.js'), sw = read('kids/sw.js'), css3 = css;
  assert.ok(mjs.length > 100000 && mjs.length < 700000, 'paket boyutu ' + mjs.length);
  assert.match(mjs, /"160"/, 'three r160 (MedLab kampüsüyle aynı)');
  assert.doesNotMatch(mjs, /(?:import|from)\s*["']https?:/, 'CDN içe aktarımı yok');
  assert.doesNotMatch(mjs, /cdn\.jsdelivr|unpkg|esm\.sh/);
  assert.match(src, /export function kur\(o\)/);
  assert.match(sw, /'\/kids\/assets\/kids-uzay3d\.mjs'/, 'çevrimdışı önbellekte');
  assert.match(js, /new Function\('u', 'return import\(u\)'\)\('\/kids\/assets\/kids-uzay3d\.mjs'\)/, 'eski tarayıcıda sözdizimi hatası yok');
  assert.match(js, /var sure = setTimeout\(vazgec, 7000\)/, 'modül gelmezse düz harita');
  assert.match(js, /getContext\('webgl2'\) \|\| c\.getContext\('webgl'\)/);
  assert.match(js, /if \(U3 && U3\.harita && U3\.harita\.isConnected\)/, 'uçuş 3B astronotla');
  assert.match(app, /app\.querySelector\('\.kz-ast-yer, \.kz3-acik'\)/);
  assert.match(css3, /\.ka-harita\.kz3-acik \.ka-ada\{[^}]*pointer-events:auto/);
  assert.match(css3, /isolation:isolate/, 'etiketler üst çubuğun üstüne taşmaz');
  assert.match(src, /if \(!kap\.isConnected\) \{ temizle\(\); return; \}/, 'harita kapanınca WebGL bırakılır');
  assert.match(src, /if \(i === suan \|\| sakin\)/, 'hareketi azaltta uçuş anında');
});

summary();
