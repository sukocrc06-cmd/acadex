/* ==========================================================================
   ACADEX — LANDING MEDLAB SCROLL FİLMİ TESTLERİ (tests/landing-medlab-film.js)

   NEDEN VAR (28.10.2026): landing'deki "Kayıt olmadan üç kart çöz" (#dene)
   bölümü kaldırıldı; yerine Anatomi Lab'in gerçek 3B modelinden çekilmiş 96
   karelik bir scroll filmi geldi (section#medlab, js/acadex-medlab-film.js).
   Stetoskoplu Acadia rehberi (js/acadia-rehber.js) her adımı anlatır.
     - Kareler tembel yüklenir; telefonda/saveData'da her iki kareden biri.
     - Hareket azaltmada film oynamaz, adım başına sabit kare gösterilir.
   Çalıştırma:  node tests/landing-medlab-film.js
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
const js = read('js/acadex-medlab-film.js');
const css = read('css/acadex-medlab-film.css');
const reh = read('js/acadia-rehber.js');

test('index: #medlab film bölümü var, eski #dene/deneme bölümü yok', () => {
  assert.match(html, /<section[^>]*id="medlab"[^>]*data-mf/);
  assert.doesNotMatch(html, /id="dene"/);
  assert.doesNotMatch(html, /href="#dene"/);
  assert.match(html, /href="#medlab"/);
  assert.match(html, /css\/acadex-medlab-film\.css/);
  assert.match(html, /js\/acadex-medlab-film\.js/);
});
test('index: 5 adım, kaynak notu (CC BY-SA) ve atlama bağlantısı', () => {
  assert.equal((html.match(/class="mf-step[ "]/g) || []).length, 5);
  assert.match(html, /CC BY-SA 4\.0/);
  assert.match(html, /class="mf-skip"/);
});
test('kareler: telefon (640×800) ve masaüstü (hd/, 960×1200) setleri, 96 kare, bütçe içinde', () => {
  let tel = 0, hd = 0;
  for (let i = 0; i < 96; i++) {
    const n = 'f' + String(i).padStart(3, '0') + '.webp';
    const a = fs.statSync(path.join(ROOT, 'assets/landing/medlab', n)).size;
    const b = fs.statSync(path.join(ROOT, 'assets/landing/medlab/hd', n)).size;
    assert.ok(a > 1000 && b > a, n + ' ' + a + '/' + b);
    tel += a; hd += b;
  }
  // "dengeli" bütçe: masaüstü ~4 MB, telefon her 2. kare ~1,5 MB
  assert.ok(hd < 5.5e6, 'hd seti ' + hd);
  assert.ok(tel / 2 < 2e6, 'telefon seti ' + tel);
  // webp başlığından gerçek boyut (VP8X/VP8 ayrıştırmadan, RIFF + kare boyutu kontrolü)
  const h = fs.readFileSync(path.join(ROOT, 'assets/landing/medlab/hd/f000.webp'));
  assert.equal(h.toString('ascii', 0, 4), 'RIFF'); assert.equal(h.toString('ascii', 8, 12), 'WEBP');
});
test('etiketler: pins.json her kare için yapı konumu taşıyor; JS içindeki her etiket anahtarı içinde', () => {
  const d = JSON.parse(read('assets/landing/medlab/pins.json'));
  assert.equal(d.f.length, 96);
  d.f.forEach((r) => assert.equal(r.length, d.k.length * 3));
  const used = [...js.matchAll(/\['([a-z]+)', '[^']+', '[^']+'\]/g)].map((m) => m[1]);
  assert.ok(used.length >= 15, 'PINS bulunamadı');
  used.forEach((k) => assert.ok(d.k.includes(k), k + ' pins.json içinde yok'));
  // her adımda en az bir etiket o adımın karelerinde görünür olmalı
  const STEP = [[0, 19], [19, 44], [44, 57], [57, 76], [76, 95]];
  const P = [...js.matchAll(/^    \[\[.*\]\],?$/gm)].map((m) => [...m[0].matchAll(/\['([a-z]+)'/g)].map((x) => x[1]));
  assert.equal(P.length, 5);
  P.forEach((keys, si) => {
    const [a, b] = STEP[si];
    const seen = keys.some((k) => { const ki = d.k.indexOf(k); for (let j = a; j <= b; j++) { const r = d.f[j]; if (r[ki * 3 + 2] >= 30 && r[ki * 3] > 60 && r[ki * 3] < 940) return true; } return false; });
    assert.ok(seen, (si + 1) + '. adımda görünen etiket yok');
  });
});
test('index: eski sabit etiketler (mf-tag) yerine yapıya bağlı etiket katmanı', () => {
  assert.doesNotMatch(html, /mf-tag/);
  assert.match(html, /class="mf-pins"/);
});
test('js: tembel yükleme, telefonda adım (stride), hareket azaltma', () => {
  assert.match(js, /var N = 96/);
  assert.match(js, /SET = phone \? '' : 'hd\/'/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /saveData/);
  assert.match(js, /stride = phone \? 2 : 1/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});
test('rehber: #dene durağı yerine stetoskoplu #medlab durağı ve say API', () => {
  assert.doesNotMatch(reh, /q: '#dene'/);
  assert.match(reh, /q: '#medlab'[^}]*costume: 'medlab'/);
  assert.match(reh, /W\.acadiaRehber = /);
});
test('css: hareket azaltma ve mobil düzen', () => {
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /max-width:860px/);
});
test('git: kareler .gitignore tarafından DIŞLANMIYOR (siteye gitmezse film boş kalır)', () => {
  // 28.10.2026: .gitignore'daki "/assets/landing" satırı kareleri GitHub'a hiç
  // göndermedi; canlıda "model yükleniyor"da takıldı. Bu test onu yakalar.
  const { spawnSync } = require('node:child_process');
  const r = spawnSync('git', ['check-ignore', 'assets/landing/medlab/f000.webp', 'assets/landing/medlab/f095.webp'], { cwd: ROOT });
  if (r.error || r.status === 128) return; // git yoksa / repo değilse atla
  assert.equal(r.status, 1, 'assets/landing/medlab kareleri git tarafından yok sayılıyor');
  const gi = read('.gitignore');
  assert.match(gi, /!\/assets\/landing\/medlab\//);
});
test('js: kare gelmezse "yükleniyor"da takılmaz; bir kez yeniden dener, sonra not gösterir', () => {
  assert.match(js, /tried\[i\]/);
  assert.match(js, /mf-fail/);
  assert.match(js, /Model şu an açılamadı/);
  assert.match(css, /\.mf-fail \.mf-load/);
});
summary();
