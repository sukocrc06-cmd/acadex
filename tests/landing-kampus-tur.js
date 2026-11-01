/* ==========================================================================
   ACADEX — LANDING SAĞLIK KAMPÜSÜ TURU TESTLERİ (tests/landing-kampus-tur.js)

   NEDEN VAR (01.11.2026): landing'deki "tıp öğrencileri için" 3B iskelet filmi
   (96 kare, js/acadex-medlab-film.js) kaldırıldı. Yerine bütün MedLab lab'larını
   maskotlarıyla anlatan bir scroll turu geldi (section#medlab.kt):
   rehber cerrah kampüste yürür, her lab binasında o lab'ın maskotu kendi animasyonunu
   yapar, sonunda Acadex Medica'nın kapısı açılır.
     - Maskot çizimleri dashboard'daki MedLab kartlarıyla AYNI olmalı; maskot hareketleri
       css/acadex-medlab.css'ten üretilen css/acadex-kampus-tur-maskot.css'te.
     - Her lab (dashboard'daki her MedLab kartı) turda bir durak olmalı; yeni lab eklenince
       bu test hatırlatır.
     - Kısa mod: hareket azaltmada, dar ekranda ve JS yokken sabitleme yok, kartlar alt alta.
   Çalıştırma:  node tests/landing-kampus-tur.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const html = read('index.html');
const dash = read('dashboard.html');
const js = read('js/acadex-kampus-tur.js');
const css = read('css/acadex-kampus-tur.css');
const mcss = read('css/acadex-kampus-tur-maskot.css');
const sec = html.slice(html.indexOf('<section id="medlab"'), html.indexOf('</section>', html.indexOf('<section id="medlab"')));

test('eski 3B film tamamen kalktı', () => {
  assert.doesNotMatch(html, /acadex-medlab-film|class="mf[ "-]|mf-track/);
  assert.doesNotMatch(sec, /data-mf=/);
  for (const f of ['js/acadex-medlab-film.js', 'css/acadex-medlab-film.css']) assert.ok(!fs.existsSync(path.join(ROOT, f)), f + ' silinmeli');
  assert.ok(!fs.existsSync(path.join(ROOT, 'assets/landing/medlab')), 'film kareleri silinmeli');
  assert.doesNotMatch(read('.gitignore'), /!\/assets\/landing\/medlab/);
});

test('bölüm, stiller ve betik bağlı; menü bağlantısı #medlab', () => {
  assert.match(sec, /^<section id="medlab" class="kt" data-kt="" aria-labelledby="kt-t">/);
  assert.match(html, /<link rel="stylesheet" href="css\/acadex-kampus-tur\.css">\n<link rel="stylesheet" href="css\/acadex-kampus-tur-maskot\.css">/);
  assert.match(html, /<script src="js\/acadex-kampus-tur\.js"><\/script>/);
  assert.match(html, /href="#medlab"/);
  assert.doesNotMatch(sec, /tıp öğrencileri için<\/span>\s*<h2/, 'başlık artık tek bölüme ait değil');
});

test('her MedLab kartı turda bir durak; giriş başta, Medica sonda', () => {
  const kartlar = [...dash.matchAll(/data-medlab-open="(\w+)"/g)].map((m) => m[1]);
  const duraklar = [...sec.matchAll(/<article class="kt-st[^"]*" data-st="(\w+)"/g)].map((m) => m[1]);
  assert.equal(duraklar[0], 'giris'); assert.equal(duraklar[duraklar.length - 1], 'med');
  assert.equal(duraklar.length, kartlar.length + 1, 'giriş + her lab');
  assert.equal((sec.match(/<li style="--c:#[0-9A-Fa-f]+"><a href="#medlab" data-kt-git=/g) || []).length, duraklar.length, 'ray her durağa bağlı');
});

test('maskotlar dashboard kapaklarıyla aynı çizim', () => {
  for (const k of ['axm-med', 'axm-ana', 'axm-fiz', 'axm-ody', 'axm-dyt', 'axm-dkt', 'axm-ecz', 'axm-hem']) {
    const a = dash.match(new RegExp('<svg class="' + k + '".*?</svg>', 's')), b = sec.match(new RegExp('<svg class="' + k + '".*?</svg>', 's'));
    assert.ok(a && b, k); assert.equal(b[0], a[0], k + ' kapağı dashboard ile aynı olmalı');
  }
  assert.equal((sec.match(/class="kt-cv" role="img" aria-label="[^"]+"/g) || []).length, 8, 'her kapağın erişilebilir adı var');
});

test('maskot hareketleri MedLab kapak CSS\'iyle eşleşiyor (üretilmiş dosya güncel)', () => {
  const src = read('css/acadex-medlab.css');
  const kf = new Set([...src.matchAll(/@keyframes ([a-z][a-z0-9-]*)\{/g)].map((m) => m[1]));
  const used = new Set();
  for (const m of src.matchAll(/#medlab-view\.axm[^{]*\.axm-(?:med|ana|fiz|ody|dyt|dkt|ecz|hem)\b[^{]*\{([^}]*)\}/g)) for (const v of m[1].matchAll(/animation:([^;}]+)/g)) for (const t of v[1].match(/[a-z][a-z0-9-]*/g) || []) if (kf.has(t)) used.add(t);
  assert.ok(used.size > 20, 'kapak animasyonları bulunmalı');
  for (const k of used) assert.match(mcss, new RegExp('@keyframes ' + k + '\\{'), 'eksik anahtar kare: ' + k);
  assert.doesNotMatch(mcss.replace(/\/\*[\s\S]*?\*\//, ''), /#medlab-view/, 'kapsam .kt olmalı');
  assert.match(mcss, /\.kt \.kt-st\.on \.axm-/, 'etkin durakta hızlanır');
});

test('bölüm seçici: her bölüm bir durağa gider, seçim hatırlanır', () => {
  const chips = [...sec.matchAll(/data-kt-bolum="(\w+)"/g)].map((m) => m[1]);
  for (const c of chips) if (c !== 'hepsi') assert.match(sec, new RegExp('data-st="' + c + '"'), 'bölüm durağı yok: ' + c);
  assert.ok(chips.includes('hepsi'));
  assert.match(js, /localStorage\.setItem\(KEY, id\)/); assert.match(js, /lsafe\(/, 'depolama hatası sayfayı bozmaz');
  assert.match(css, /\.kt-sen \.kt-tx::before\{content:"senin bölümün"/);
});

test('kısa mod ve hareket tercihi', () => {
  assert.match(js, /var wantPin = function \(\) \{ return !calm && W\.innerWidth >= 760/);
  assert.match(js, /if \(!wantPin\(\)\) return;/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.kt \*,\.kt \*::before,\.kt \*::after\{animation:none!important;transition:none!important\}\}/);
  assert.match(css, /\.kt\.kt-pin \.kt-st:not\(\.on\) \*\{animation-play-state:paused!important\}/, 'görünmeyen maskotlar durur');
  assert.match(js, /\{ passive: true \}/);
});

test('Acadia rehberi kampüs turunu anlatır', () => {
  const reh = read('js/acadia-rehber.js');
  assert.match(reh, /q: '#medlab'[^}]*costume: 'medlab'[^}]*kampüs/);
  assert.match(js, /W\.acadiaRehber\.at === 'medlab'/);
  assert.equal((sec.match(/data-reh="[^"]+"/g) || []).length, (sec.match(/<article class="kt-st/g) || []).length);
});

summary();
