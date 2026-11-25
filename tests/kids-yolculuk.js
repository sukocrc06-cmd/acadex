/* ==========================================================================
   ACADEX — ACADEX KIDS: UZAY YOLCULUĞU TANITIM SAYFASI (tests/kids-yolculuk.js), 21.11.2026

   NEDEN VAR: Kids tanıtım sayfası baştan bir uzay yolculuğu oldu (kids-yolculuk.js/.css):
   astronot rehber, gezegene dalış, gezegen → giriş kartı, Söyle balonları, masal + canlı
   kelimeler. GSAP + ScrollTrigger yerel dosyadan (kids-gsap.js) ve yalnız gerektiğinde gelir.
   Bu dosya şunları korur:
     - dört sahne sayfada, her birinin rengi ve rehber sözü var
     - GSAP yerel: dış CDN yok, lisans başlığı duruyor, SW önbelleğinde
     - GSAP gelmezse ya da hareketi azaltta sayfa son hâlini gösterir (kyo-statik / CSS varsayılanı)
     - sürprizler yazıların üstüne binmez (yalnız kenar şeritleri, içeriğin arkasında)
     - eski kids-scroll.js efektleri uzay modunda çift çalışmaz
     - önek kyo- (yazdırma modülü ky- kullanır; çakışma yok)
     - paket sırası: kids-yolculuk.js, kids-scroll.js'ten önce
   Tarayıcıda (Playwright, masaüstü + telefon, ekran görüntüleriyle) denendi.
   Çalıştırma:  node tests/kids-yolculuk.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const js = read('kids/assets/kids-yolculuk.js'), css = read('kids/assets/kids-yolculuk.css'), html = read('kids/assets/sayfa.html');
const gsap = read('kids/assets/kids-gsap.js'), sw = read('kids/sw.js'), bir = read('kids/assets/birlestir.js'), scr = read('kids/assets/kids-scroll.js');

test('dört sahne var; her birinin rengi ve rehber sözü dolu', () => {
  for (const id of ['kyo-okul', 'kyo-giris', 'kyo-soyle', 'kyo-masal']) {
    const m = html.match(new RegExp('<section[^>]*id="' + id + '"[^>]*>'));
    assert.ok(m, id + ' yok');
    assert.match(m[0], /kyo-sahne/); assert.match(m[0], /data-ky-renk="#[0-9A-Fa-f]{6}"/); assert.match(m[0], /data-ky-soz="[^"]{4,}"/);
  }
  assert.match(html, /class="kl-hero kyo-hero"/);
});
test('Söyle sahnesinde 5 balon, her birinde İngilizce kelime', () => {
  const b = html.match(/class="kyo-balon"[^>]*data-ky-kelime="[a-z]+"/g) || [];
  assert.equal(b.length, 5);
});
test('GSAP yerel ve lisanslı; dış CDN yok; SW önbelleğinde', () => {
  assert.match(gsap.slice(0, 600), /GreenSock|gsap/i); assert.match(gsap.slice(0, 900), /license|lisans/i);
  assert.match(gsap, /ScrollTrigger/);
  assert.doesNotMatch(js, /cdn\.|unpkg|jsdelivr/);
  assert.match(js, /\/kids\/assets\/kids-gsap\.js/);
  assert.match(sw, /'\/kids\/assets\/kids-gsap\.js'/);
});
test('hareketi azalt ve GSAP hatası: sade mod', () => {
  assert.match(js, /prefers-reduced-motion/); assert.match(js, /kyo-statik/);
  assert.match(js, /gsapYukle\(\)\.then\(sahneler, function/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  /* GSAP yoksa giriş kartındaki gezegen köşede durur (CSS son hâl) */
  assert.match(css, /html:not\(\.kyo-gsap\) \.kyo-mkart-gz\{transform:/);
  assert.doesNotMatch(css, /\n\.kyo-mkart-gz\{[^}]*transform:translate/);
});
test('sürprizler kenar şeritlerinde ve içeriğin arkasında', () => {
  assert.match(js, /yalnız sağ\/sol kenar şeritleri/);
  assert.match(css, /\.kyo-surpriz\{position:absolute;z-index:1;/);
});
test('rehber balonu kendiliğinden söner', () => {
  assert.match(js, /kyo-sus/); assert.match(css, /\.kyo-r-balon\.kyo-sus\{opacity:0/);
});
test('ışık kartındaki başlıklar beyaza boyanmaz; film sınıflarına ezme kids-film.css\'te', () => {
  const film = read('kids/assets/kids-film.css');
  assert.doesNotMatch(film, /html\.kyo [^{]*\.kt2-sol>h2/);
  assert.match(film, /html\.kyo \.kb-panel\{/);
});
test('kids-scroll uzay modunda eski efektleri çalıştırmaz', () => {
  const n = (scr.match(/UZAY\(\)/g) || []).length; assert.ok(n >= 3, 'UZAY() korumaları: ' + n);
});
test('paket sırası', () => {
  const a = bir.indexOf("'kids-yolculuk.js'"), b = bir.indexOf("'kids-scroll.js'");
  assert.ok(a > 0 && b > a, 'kids-yolculuk.js kids-scroll.js\'ten önce olmalı');
  assert.match(bir, /'kids-yolculuk\.css'/);
  assert.doesNotMatch(bir, /'kids-gsap\.js'/, 'GSAP pakete gömülmez, gerektiğinde yüklenir');
});

test('önek kyo-: yazdırma modülünün ky- sınıflarıyla çakışmaz', () => {
  assert.doesNotMatch(css, /(^|[^a-z-])\.ky-/m); assert.doesNotMatch(html, /class="[^"]*\bky-/);
  assert.match(js, /classList\.add\('kyo'\)/); assert.match(scr, /classList\.contains\('kyo'\)/);
});
summary();
