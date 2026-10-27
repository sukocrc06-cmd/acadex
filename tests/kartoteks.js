/* ==========================================================================
   ACADEX KARTOTEKS — BİLGİ KARTLARI PANELİ TESTLERİ (tests/kartoteks.js)

   NEDEN VAR (27.10.2026): Bilgi kartları paneli MedLab / Study Lab gibi kendi
   dünyası olan "Acadex Kartoteks" olarak baştan çizildi: meşe fiş dolabı (deste =
   çekmece), 5 tekrar gözü, okuma fişi (tarih damgaları), katalog fişi biçiminde kart
   (dashboard.html #cards-view.kx.kt + css/acadex-kartoteks.css).
   Davranış hâlâ js/acadex-ink.js'teki BİLGİ KARTLARI bloğunda; o blok
   işaretlediği data-* öğelerini bulamazsa ekran sessizce boş kalır.
     - JS'in aradığı her öğe yeni işaretlemede olmalı.
     - Eski deste kutusu sınıfı (.kbox) JS'ten tamamen çıkmalı.
     - "Akıllı Tekrar" bandı kart ekranından kalktı, karşılaştırmalar Belgelerim'de.
     - Günlük sayaç / seri yalnız bu cihazda tutulur; kart serisi hesabı sınanır.

   Çalıştırma:  node tests/kartoteks.js
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

const html = read('dashboard.html');
const ink = read('js/acadex-ink.js');
const s0 = html.indexOf('<section id="cards-view"'), s1 = html.indexOf('TAB: KAYNAKLA ÇALIŞ', s0);
const view = html.slice(s0, s1);
const a0 = ink.indexOf('/* ================= BİLGİ KARTLARI (tam tasarım'), a1 = ink.indexOf('/* eski "Akıllı Tekrar" pencerelerini', a0);
const mod = ink.slice(a0, a1);

test('Kartoteks paneli: sınıf, başlık ve stil dosyası bağlı', () => {
  assert.match(view, /^<section id="cards-view" class="dashboard-view-section axd axk kx kt">/);
  assert.match(view, /<h1 class="disp">Acadex Kartoteks<\/h1>/);
  assert.match(view, /class="kt-slip" data-kx-streak=""/);
  assert.match(view, /class="kt-cab land"/);
  const a = html.indexOf('href="css/acadex-ink.css"'), b = html.indexOf('href="css/acadex-kartoteks.css"');
  assert.ok(a > 0 && b > a, 'acadex-kartoteks.css, acadex-ink.css\'ten sonra yüklenmeli');
});

test('çekmece: pirinç etiket, kulp, bugün uç veren fişler; boş çekmece yeni deste açar', () => {
  assert.match(mod, /class="kx-deck kt-drawer"/);
  assert.match(mod, /<span class="kt-peek" aria-hidden="true">/);
  assert.match(mod, /class="kx-add" data-kx-add=""/);
  assert.match(mod, /closest\('\.d-head \[data-new-deck\], \[data-kx-add\]'\)\) openRecipe\(\)/);
});

test('bildim damgası sonraki iade tarihini basar (SM-2 aralığı)', () => {
  assert.match(mod, /im\.textContent = 'İADE ' \+ dn\.getDate\(\)/);
});

test('JS bloğunun $(...) ile aradığı her öğe işaretlemede var', () => {
  const sels = new Set([...mod.matchAll(/\$\('(\[data-[a-z0-9-]+(?:="[^"]*")?\]|#[a-zA-Z0-9-]+)'\)/g)].map(m => m[1]));
  const skip = ['[data-smart]']; // isteğe bağlı (kaldırıldı, JS korumalı)
  for (const s of sels) {
    if (skip.includes(s)) continue;
    if (s.startsWith('[') && mod.includes(s.slice(1, -1).split('=')[0] + '=""')) continue; // JS'in kendi çizdiği öğe
    if (s.startsWith('#')) assert.ok(view.includes('id="' + s.slice(1) + '"'), s + ' yok');
    else { const k = s.slice(1, -1).split('=')[0]; assert.ok(view.includes(k + '=""') || view.includes(k + '="'), s + ' yok'); }
  }
});

test('eski deste kutusu (.kbox) JS\'ten çıktı, yeni deste sekmesi kullanılıyor', () => {
  assert.doesNotMatch(mod, /\.kbox\b|class="kbox/);
  assert.match(mod, /class="kx-deck kt-drawer"/);
  assert.match(mod, /var smB = \$\('\[data-smart\]'\); if \(smB\)/);
});

test('yinelenen Akıllı Tekrar bandı kalktı, karşılaştırmalar Belgelerim\'de', () => {
  assert.doesNotMatch(view, /global-review-widget|past-comparisons-section/);
  const d0 = html.indexOf('<section id="docs-view"'), d1 = html.indexOf('</section>', html.indexOf('btn-bulk-cancel', d0));
  assert.match(html.slice(d0, d1), /id="past-comparisons-section"/);
});

test('kart serisi: bugün yoksa dünden geriye sayar, boşlukta durur', () => {
  const src = /var ymdL = [^\n]+\n/.exec(mod)[0] + /var streakOf = [^\n]+\n/.exec(mod)[0];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src + 'this.ymdL=ymdL;this.streakOf=streakOf;', ctx);
  const day = (k) => { const d = new Date(); d.setDate(d.getDate() - k); return ctx.ymdL(d); };
  const o = {}; o[day(1)] = 3; o[day(2)] = 1; o[day(4)] = 5;
  assert.equal(ctx.streakOf(o), 2, 'bugün henüz çalışmadıysa seri dünden sayılır');
  o[day(0)] = 1; assert.equal(ctx.streakOf(o), 3);
  assert.equal(ctx.streakOf({}), 0);
});

test('stil: dar ekranda desteler yatay şerit, hareket azaltma korumalı', () => {
  const css = read('css/acadex-kartoteks.css');
  assert.match(css, /@media \(max-width:700px\)\{[\s\S]*?\.kt-drawers\{grid-auto-flow:column;[^}]*overflow-x:auto/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\.cp\.bump\{animation:none\}/);
});
summary();
