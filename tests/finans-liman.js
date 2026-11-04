/* ==========================================================================
   ACADEX — FİNANS LİMAN DEFTERİ TESTLERİ (tests/finans-liman.js)

   NEDEN VAR (03.11.2026): Acadex Finans paneline ilerleme panosu geldi
   (js/acadex-liman.js + css/acadex-liman.css). Lab'lar (labs/finans/fn-app.js, Şirket de
   aynı çekirdeği kullanır) istasyon açılışlarını, süreyi ve karne sonuçlarını
   acadex.finans.log'a yazar; pano bunu okur.
     - Karne yeniden çizilince (ekran tazelenince) aynı sonuç ikinci kez sayılmaz.
     - Kayıt yalnızca bu tarayıcıda; ağ isteği yok.
     - Panodaki "devam" / "öneri" düğmeleri panelin mevcut açma düğmesi
       (data-finans-open) ile çalışır; ayrı açma kodu yok.
     - Her istasyon (8 finans + 7 şirket katı + 9 istatistik gözlemevi, 03.11.2026) gemide bir yuva.
   Çalıştırma:  node tests/finans-liman.js
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
const app = read('labs/finans/fn-app.js'), js = read('js/acadex-liman.js'), css = read('css/acadex-liman.css'), html = read('dashboard.html');

test('sayfaya bağlı; finans panelinden sonra yüklenir', () => {
  assert.match(html, /<link rel="stylesheet" href="css\/acadex-liman\.css">/);
  assert.match(html, /<script src="js\/acadex-finans\.js"><\/script>\n<script src="js\/acadex-liman\.js"><\/script>/);
  assert.equal(new Set([...html.matchAll(/data-finans-open="([a-z-]+)"/g)].map((m) => m[1])).size, 29); // 04.11.2026: istatistik v2 (+4 istasyon, +yol şeridi)
});

test('lab defteri: açılış, süre ve karne; tekrar çizilen karne bir kez sayılır', () => {
  assert.match(app, /if \(FN\.logVisit\) FN\.logVisit\(k\);/);
  /* defter kodunu küçük bir taslakta çalıştır */
  const start = app.indexOf('  var logGet = function'), end = app.indexOf('  setInterval(function () {', start);
  const store = {};
  const ctx = { FN: { core: {} }, LAB: 'finans', tab: 'muhasebe', D: { hidden: false }, Date, Math, isFinite,
    ls: { get: (k, d) => (k in store ? JSON.parse(store[k]) : d), set: (k, v) => { store[k] = JSON.stringify(v); } },
    post: () => {}, karne: (p) => 'karne ' + p };
  vm.runInNewContext(app.slice(start, end) + ';this.out = { visit: FN.logVisit, karne: FN.core.karne };', ctx);
  ctx.out.visit('muhasebe'); ctx.out.visit('muhasebe');
  assert.equal(ctx.out.karne(91.6), 'karne 91.6');
  ctx.out.karne(91.6); ctx.out.karne(91.6);
  ctx.out.karne(70);
  const log = JSON.parse(store.log), r = log.tabs['finans.muhasebe'];
  assert.equal(r.v, 2); assert.equal(r.n, 2, 'aynı sonuç tekrar sayılmaz'); assert.equal(r.best, 92); assert.equal(r.lastP, 70); assert.equal(log.last, 'finans.muhasebe');
  assert.doesNotMatch(app.slice(start, end), /fetch\(|XMLHttpRequest|supabase/);
});

test('pano: anahtar eşlemesi, devam ve öneri mevcut açma düğmesiyle', () => {
  const logKey = new Function('return ' + js.slice(js.indexOf('function (k) { return /^sirket-/'), js.indexOf(';\n', js.indexOf('var logKey'))))();
  assert.equal(logKey('zaman'), 'finans.zaman'); assert.equal(logKey('sirket-sim'), 'sirket.sim');
  assert.match(js, /class="lm-go" data-finans-open="/); assert.match(js, /class="lm-next" data-finans-open="/);
  assert.match(js, /if \(panel\.contains\(b\) \|\| b\.hasAttribute\('data-lm-skip'\)\) return;/, 'panodaki düğmeler ve yol şeridi istasyon sayılmaz');
  assert.match(js, /d\.src === 'axlab' && d\.type === 'progress'/);
});

test('onay eşiği %85; hareket azaltmada animasyon yok; etiketler gizli', () => {
  assert.match(js, /r\.best >= 85/); assert.match(js, /tag\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{#finans-view \.lm-board \*\{animation:none!important\}\}/);
});

summary();
