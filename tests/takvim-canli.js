/* ==========================================================================
   ACADEX — CANLI MASA TAKVİMİ TESTLERİ (tests/takvim-canli.js)

   NEDEN VAR (03.11.2026): planlayıcı takvimine js/acadex-takvim.js süsleme katmanı geldi
   (mevsim penceresi, bugün halkası, bu hafta şeridi, geçmiş günler, türe göre not kâğıdı,
   sınav geri sayımı, ay çevrilince düşen notlar).
     - Süsleme takvimin verisine ve olaylarına dokunmaz: kayıt, sürükle-bırak ve form
       acadex-ink.js'te kalır; burada yalnızca çizimden sonra eklenen öğeler var.
     - Süslemeler tıklamayı engellemez (pointer-events:none), ekran okuyucuya gizli.
     - Mevsim doğru: aralık-şubat kış, mart-mayıs bahar, haziran-ağustos yaz, eylül-kasım güz.
     - Hareket azaltmada animasyon yok.
   Çalıştırma:  node tests/takvim-canli.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const js = read('js/acadex-takvim.js'), css = read('css/acadex-takvim.css'), html = read('dashboard.html');

test('sayfaya bağlı, planlayıcı kabuğundan sonra', () => {
  assert.match(html, /<link rel="stylesheet" href="css\/acadex-takvim\.css">/);
  assert.ok(html.indexOf('src="js/acadex-ink.js"') < html.indexOf('src="js/acadex-takvim.js"'));
  assert.match(js, /if \(!root \|\| !root\.classList\.contains\('axp'\)\) return;/);
});

test('mevsimler doğru aylara düşer', () => {
  const season = new Function('return ' + js.slice(js.indexOf('function (m) { return m === 11'), js.indexOf(';\n', js.indexOf('var season'))))();
  const want = ['kis', 'kis', 'bahar', 'bahar', 'bahar', 'yaz', 'yaz', 'yaz', 'guz', 'guz', 'guz', 'kis'];
  want.forEach((s, m) => assert.equal(season(m), s, 'ay ' + (m + 1)));
});

test('yalnızca süsleme: veri ve olay kodu yok, tıklamayı engellemez', () => {
  assert.doesNotMatch(js, /supabase|study_events|addEventListener\('(click|pointerdown)'/);
  assert.match(js, /observe\(days, \{ childList: true \}\)/);
  for (const c of ['tk-today', 'tk-dec', 'tk-ok', 'tk-cd', 'tk-tl']) assert.match(js, new RegExp('class="' + c + '[^"]*"[^>]*aria-hidden="true"'), c + ' gizli olmalı');
  for (const sel of ['\\.tk-today\\{[^}]*pointer-events:none', '\\.tk-dec\\{position:absolute;pointer-events:none', '\\.tk-cd\\{[^}]*pointer-events:none', '\\.tk-ok\\{[^}]*pointer-events:none']) assert.match(css, new RegExp(sel));
});

test('bugün, bu hafta, geçmiş ve sınav geri sayımı', () => {
  assert.match(js, /c\.classList\.toggle\('tk-past', k < tk\); c\.classList\.toggle\('tk-week', k >= wsK && k <= weK\);/);
  assert.match(js, /n === 0 \? 'bugün!' : n === 1 \? 'yarın' : n \+ ' gün'/);
  assert.match(css, /\.day\.tk-past:not\(\.out\) \.dn::after/);
});

test('hareket azaltmada animasyon yok', () => {
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{#planner-view\.axp \.tk-win \*,#planner-view\.axp \.tk-today path,#planner-view\.axp \.tk-tl,#planner-view\.axp \.tk-cd,#planner-view\.axp \.pi\.tk-in\{animation:none!important\}\}/);
  assert.match(js, /if \(flipped && !RM\)/);
});

summary();
