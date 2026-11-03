/* ==========================================================================
   ACADEX — KAYNAKLA ÇALIŞ OKUMA MASASI TESTLERİ (tests/kaynak-masa.js)

   NEDEN VAR (03.11.2026): Kaynakla çalış ekranı bir okuma masası sahnesi oldu
   (js/acadex-kaynak-masa.js + css/acadex-kaynak-masa.css).
     - Acadia köşesi kullanıcının stüdyoda seçtiği rengi kullanır (--ac) ve stil
       değişince (acadia:style olayı) hemen güncellenir.
     - Acadia düşünürken düşünen yüz ve dönen yıldızlar; düşünme göstergesi
       dashboard.js'in açıp kapattığı #sourcehub-chat-typing-indicator'dan okunur.
     - Sohbet, özet ve belge mantığına dokunulmaz (yalnızca sahne).
     - Süsler ekran okuyucuya gizli, hareket azaltmada animasyon yok.
   Çalıştırma:  node tests/kaynak-masa.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const js = read('js/acadex-kaynak-masa.js'), css = read('css/acadex-kaynak-masa.css'), html = read('dashboard.html');

test('sayfaya bağlı; Acadia kitinden sonra yüklenir', () => {
  assert.match(html, /<link rel="stylesheet" href="css\/acadex-kaynak-masa\.css">/);
  assert.ok(html.indexOf('src="js/acadia-kit.js"') < html.indexOf('src="js/acadex-kaynak-masa.js"'));
  assert.match(html, /id="sourcehub-chat-typing-indicator"/);
});

test('Acadia rengi sahneye geçer ve stil değişince güncellenir', () => {
  assert.match(js, /root\.style\.setProperty\('--ac', c\.f\)/);
  assert.match(js, /D\.addEventListener\('acadia:style', paintColor\)/);
  assert.match(css, /\.msg\.ac::before\{content:"★ Acadia";background:var\(--ac\)/);
});

test('düşünürken yüz ve yıldızlar; cevapta göz kırpar', () => {
  assert.match(js, /new MutationObserver\(function \(\) \{ setThinking\(think\.style\.display !== 'none' && !think\.hidden\); \}\)/);
  assert.match(js, /k\.setMood\(host, 'dusunuyor'\)/); assert.match(js, /k\.react\(host, 'kirp', 1200\)/);
  assert.match(css, /\.chat\.ky-thinking \.ky-orbit\{opacity:1\}/);
});

test('yalnızca sahne: sohbet / veri koduna dokunmaz; süsler gizli', () => {
  assert.doesNotMatch(js, /supabase|functions\.invoke|fetch\(/);
  for (const c of ['ky-props', 'ky-clip', 'ky-sky', 'ky-gz', 'ky-orbit', 'ky-spark', 'ky-stars']) assert.match(js, new RegExp(c + '[\'"][^\\n]*aria-hidden'), c);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{#sourcehub-view\.axy \.ky-sky i,#sourcehub-view\.axy \.ky-orbit,#sourcehub-view\.axy \.ky-stars i\{animation:none!important\}\}/);
});

summary();
