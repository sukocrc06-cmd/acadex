/* ==========================================================================
   ACADEX — ACADIA MASKOT TESTLERI (tests/acadia-maskot.js)

   NEDEN VAR (28.10.2026): Acadia artık Acadex'in maskotu. Tek kaynaktan çizilir
   (js/acadia-kit.js), landing'de scroll'la eşlik eder (js/acadia-rehber.js), her
   panelin başlığında durur (js/acadia-yerinde.js), sağ alttaki düğme de aynı kitten
   gelir ve "Acadia'nı giydir" stüdyosuyla kişiselleştirilir (user_metadata.acadia).
     - Kit yüklenmeden acadex-ink.js çalışırsa sağ alttaki Acadia eski çizime düşer;
       sıra bozulmamalı.
     - Geçersiz bir seçim (eski sürüm, elle düzenlenmiş metadata) çizimi bozmamalı.
     - Panel kılığı yalnız kullanıcı "kılık değiştirsin"i açık bıraktıysa uygulanır.
     - Hareketler prefers-reduced-motion'da durmalı.

   Çalıştırma:  node tests/acadia-maskot.js
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

function loadKit(stored) {
  const ls = {}; if (stored) ls['acadex.acadia.style'] = JSON.stringify(stored);
  const doc = { readyState: 'complete', body: {}, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, dispatchEvent() {}, createElement: () => ({}) };
  const ctx = { console, JSON, Object, Array, String, Math, Date, setTimeout, clearTimeout, CustomEvent: function () {}, document: doc,
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = v; } }, matchMedia: () => ({ matches: true }) };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('js/acadia-kit.js'), ctx);
  return { K: ctx.AcadiaKit, ls };
}

test('kit: ruh hali, poz ve renk SVG\'ye işlenir; eski sağ alt sınıfları korunur', () => {
  const { K } = loadKit();
  const s = K.svg({ mood: 'kutlama', pose: 'selam', size: 100 });
  assert.match(s, /^<svg class="acd acd-m-kutlama acd-p-selam"/);
  assert.match(s, /<g class="bd">/);
  assert.match(s, /class="st"[^>]*style="fill:#FFD86B/);
  assert.match(s, /class="acd-wave"/);
  assert.match(s, /class="acd-fx acd-spark"/);
  const m = K.svg({ mood: 'mutlu' });
  for (const c of ['class="ck"', 'class="ey"', 'class="w"', 'class="pu"', 'class="gl"', 'class="mo"']) assert.ok(m.includes(c), c + ' yok (axa-mas stilleri buna bağlı)');
});

test('kit: aksesuarlar ve renk seçimi çizime girer', () => {
  const { K } = loadKit({ renk: 'nane', bas: 'kep', goz: 'gozluk', boyun: 'papyon' });
  const s = K.svg({});
  assert.match(s, /style="fill:#93E4C4/);
  assert.match(s, /acc acc-bas/); assert.match(s, /acc acc-goz/); assert.match(s, /acc acc-boyun/);
});

test('kit: geçersiz kayıtlı seçim varsayılana döner', () => {
  const { K } = loadKit({ renk: 'mor<script>', bas: 'roket', goz: 1, ifade: 'kizgin', kostum: 'evet' });
  assert.equal(JSON.stringify(K.style), JSON.stringify({ renk: 'sari', bas: '', goz: '', boyun: '', ifade: 'mutlu', kostum: true }));
  assert.doesNotMatch(K.svg({}), /script/);
});

test('kit: panel kılığı yalnız "kılık değiştirsin" açıkken uygulanır', () => {
  const on = loadKit({ boyun: 'atki' }).K.svg({ costume: 'medlab' });
  assert.match(on, /#C8D3DC/, 'MedLab\'de stetoskop beklenir');
  assert.doesNotMatch(on, /#D9485F;stroke/, 'kılık açıkken atkı yerine stetoskop');
  const off = loadKit({ boyun: 'atki', kostum: false }).K.svg({ costume: 'medlab' });
  assert.match(off, /#D9485F;stroke/, 'kılık kapalıyken kullanıcının atkısı kalır');
});

test('bağlantılar: dashboard kit\'i acadex-ink.js\'ten önce, landing kit + rehberi yükler', () => {
  const html = read('dashboard.html'), idx = read('index.html'), ink = read('js/acadex-ink.js');
  const a = html.indexOf('<script src="js/acadia-kit.js"></script>'), b = html.indexOf('<script src="js/acadex-ink.js"></script>');
  assert.ok(a > 0 && b > a, 'acadia-kit.js, acadex-ink.js\'ten önce');
  assert.ok(html.indexOf('<script src="js/acadia-yerinde.js"></script>') > html.indexOf('<script src="js/acadex-medlab.js"></script>'));
  assert.match(html, /href="css\/acadia-kit\.css"/);
  assert.match(html, /data-acd-studio="">Acadia’nı giydir<\/button>/);
  assert.match(html, /class="acd-perch" data-acadia="" data-acd-kt=""/);
  assert.match(idx, /<script src="js\/acadia-kit\.js"><\/script>\n<script src="js\/acadia-rehber\.js"><\/script>/);
  assert.match(ink, /window\.AcadiaKit \? window\.AcadiaKit\.svg\(\{ mood: mood \}\) : MAS_OLD/);
  assert.match(ink, /document\.addEventListener\('acadia:style'/);
});

test('kayıt: user_metadata.acadia, veritabanı sütunu yok', () => {
  const k = read('js/acadia-kit.js');
  assert.match(k, /c\.auth\.updateUser\(\{ data: \{ acadia: STYLE \} \}\)/);
  assert.match(k, /u\.user_metadata && u\.user_metadata\.acadia/);
  assert.doesNotMatch(k, /from\('profiles'\)/);
});

test('stil: maskot hareketleri hareket azaltmada durur', () => {
  const css = read('css/acadia-kit.css');
  const blk = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@keyframes acd-bob'));
  for (const k of ['acd-bob', 'acd-blink', 'acd-wave', 'acd-jump', 'acd-hop']) assert.match(blk, new RegExp('animation:' + k + '\\b'), k + ' korumasız');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.acd-guide\{transition:opacity \.3s;transform:none\}/);
});
summary();
