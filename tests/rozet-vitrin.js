/* ==========================================================================
   ACADEX — ROZET VİTRİNİ TESTLERİ (tests/rozet-vitrin.js)

   NEDEN VAR (03.11.2026): ana sayfadaki rozet kartı madalya rafı oldu
   (js/acadex-rozet.js + css/acadex-rozet.css).
     - Veritabanındaki 17 rozetin her biri için Türkçe başlık ve "nasıl kazanılır"
       metni olmalı; achievements tablosundaki bazı açıklamalar İngilizce.
     - İlerleme yalnızca sayım sorgularıyla (head: true) okunur, satır çekilmez.
     - Hedefi dolmuş ama henüz yazılmamış rozet "1 / 1" değil "hazır" görünür.
     - Yeni kazanılan rozet bir kez düşer; ilk ziyarette bütün raf düşmez.
     - Hareket azaltmada animasyon yok.
   Çalıştırma:  node tests/rozet-vitrin.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const js = read('js/acadex-rozet.js'), css = read('css/acadex-rozet.css'), html = read('dashboard.html'), ach = read('js/achievements.js');

test('sayfaya bağlı ve eski çizicinin yerine geçiyor', () => {
  assert.match(html, /<link rel="stylesheet" href="css\/acadex-rozet\.css">/);
  const at = (f) => html.indexOf('src="js/' + f + '"');
  assert.ok(at('dashboard.js') < at('acadex-rozet.js') && at('achievements.js') < at('acadex-rozet.js'));
  assert.match(js, /renderStreakAndAchievements = render;/); assert.match(js, /W\.renderStreakAndAchievements = render;/);
  assert.match(html, /id="home-achievements-list"/);
});

test('her rozetin Türkçe başlığı, açıklaması ve kademesi var', () => {
  const ids = [...ach.matchAll(/^\s{2}(\w+): \{ title:/gm)].map((m) => m[1]);
  assert.equal(ids.length, 17);
  for (const id of ids) {
    const m = js.match(new RegExp('\\n    ' + id + ": \\['([^']+)', '([^']+)', [^,]+, (\\d+), '[^']*', '([bsg])'\\]"));
    assert.ok(m, id + ' tanımı yok'); assert.doesNotMatch(m[2], /\b(the|your|Uploaded|Created)\b/, id + ' açıklaması İngilizce');
  }
});

test('ilerleme yalnızca sayımla; hedefi dolan "hazır"', () => {
  assert.match(js, /var h = \{ count: 'exact', head: true \};/);
  assert.equal((js.match(/\.select\('[a-z_]+', h\)/g) || []).length, 6);
  assert.match(js, /have >= m\[3\] \? 'hazır ✓'/);
  assert.match(js, /cnt\[m\[2\]\] >= m\[3\]\) return;/, 'sıradaki önerisi dolmuş hedefi göstermez');
});

test('yeni rozet bir kez düşer; ilk ziyarette raf düşmez', () => {
  assert.match(js, /if \(on && seen && seen\.indexOf\(id\) < 0\) fresh\.push\(id\);/);
  assert.match(js, /seenSet\(uid, all\.filter/);
  assert.match(js, /if \(!RM\) fresh\.forEach/);
  assert.match(css, /@keyframes rz-drop\{/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.rz-m \*,\.rz-count\{animation:none!important;transition:none!important\}\}/);
});

test('erişilebilirlik: madalya düğme, durumu okunur, Esc ile kart kapanır', () => {
  assert.match(js, /aria-label="' \+ esc\(lbl\) \+ '"/);
  assert.match(js, /', kazanıldı' : ', kilitli'/);
  assert.match(js, /e\.key === 'Escape' && tip/);
  assert.match(css, /\.rz-m:focus-visible\{outline:/);
});

summary();
