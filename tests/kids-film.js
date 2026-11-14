/* ==========================================================================
   ACADEX KIDS — TANITIM SAYFASI: "BİR GÜNÜN HİKÂYESİ" FİLMİ VE ÜÇ BAKIŞ (tests/kids-film.js), 15.11.2026

   NEDEN VAR: Tanıtım sayfası tek bir sinematik hikâyeye döndü. Bölüm sabitlenir, kaydırma altı
   perdeyi (sınıf → ev → uçuş → harita → oyun → ertesi sabah) ileri sarar; cihaz maketinin içinde
   uygulamanın kendi çizimleri oynar. Altında Çocuk / Öğretmen / Veli sekmeleri var. Amatör duran
   altın iz + kenar çizgisi ve "Bir çocuğun bir günü" bölümü (kids-gun.js) kaldırıldı.
   Yumuşak kaydırma (masaüstü) ve fare/eğim derinliği kids-scroll.js'te. Bu dosya şunları korur:
     - altı perde: metin, nokta, ekran ve arka plan sayıları tutar; her perdenin CSS'i var
     - hareketi azalt: film sabitlenmez, perdeler alt alta; yumuşak kaydırma ve eğim kapalı
     - yumuşak kaydırma pencerelerde (teklif, uçuş) ve kaydırılabilir kutularda devreye girmez
     - üç bakış ARIA sekme düzeninde (ok tuşları, tek odak)
   Tarayıcıda (Playwright, masaüstü + telefon + hareketi azalt) denendi.
   Çalıştırma:  node tests/kids-film.js
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
const S = read('kids/assets/sayfa.html'), J = read('kids/assets/kids-film.js'), CSS = read('kids/assets/kids-film.css');

test('sayfa: film #nasil, ardından üç bakış; eski iz, kenar çizgisi ve "bir günü" bölümü yok', () => {
  assert.match(S, /<section class="kf" id="nasil" data-film aria-labelledby="kf-b">/);
  assert.ok(S.indexOf('id="nasil"') < S.indexOf('id="bakis"') && S.indexOf('id="bakis"') < S.indexOf('id="baslangic"') && S.indexOf('id="baslangic"') < S.indexOf('id="dene"'));
  assert.match(S, /<a href="#nasil">Nasıl çalışır<\/a>/, 'menü filme gider');
  for (const eski of ['data-yolculuk', 'data-ray', 'data-gun', 'data-sahne ']) assert.ok(!S.includes(eski), eski + ' kaldırılmalı');
  const b = read('kids/assets/birlestir.js');
  assert.ok(!b.includes("'kids-gun.js'") && !b.includes("'kids-gun.css'"), 'kids-gun paketten çıktı');
  assert.ok(b.indexOf("'kids-film.js'") > b.indexOf("'kids-scroll.js'"));
  const html = read('kids/index.html');
  for (const f of ['kids-film.js', 'kids-film.css']) assert.ok(html.includes(read('kids/assets/' + f).trim().slice(0, 2500)), f + ' eski: node kids/assets/birlestir.js');
});

test('altı perde: metin, nokta, ekran, arka plan ve CSS sayıları tutar', () => {
  assert.equal((S.match(/<article class="kf-b" data-kb="\d">/g) || []).length, 6);
  assert.equal((S.match(/data-kgit="\d"/g) || []).length, 6);
  assert.match(J, /var N = 6/);
  for (let i = 0; i < 6; i++) {
    assert.ok(J.includes("'<div class=\"kf-e kf-e" + i), 'ekran ' + i);
    assert.ok(CSS.includes('.kf-yap[data-perde="' + i + '"] .kf-e' + i), 'ekran CSS ' + i);
    assert.match(CSS, new RegExp('\\.kf-yap\\[data-perde="' + i + '"\\] \\.kf-bg-'), 'arka plan ' + i);
  }
  for (const s of ['kf-bg-sinif', 'kf-bg-ev', 'kf-bg-uzay', 'kf-bg-dunya', 'kf-bg-sabah']) assert.ok(J.includes(s), s);
  assert.match(J, /C\.avatar\(/, 'ekranlarda uygulamanın kendi çizimleri'); assert.doesNotMatch(J + CSS, /https?:\/\/(?!www\.w3\.org)|<img/, 'dış kaynak ve resim yok');
});

test('zaman çizgisi: evreler 0..1, perde ve yerel ilerleme', () => {
  const c = { document: { readyState: 'loading', addEventListener() {} }, matchMedia: () => ({ matches: false }), KIDS_CIZ: {}, KIDS_VERI: {} };
  c.window = c; vm.createContext(c); vm.runInContext(J, c);
  const seg = c.KIDS_FILM.seg;
  assert.equal(seg(0, 0.08, 0.34), 0); assert.equal(seg(1, 0.08, 0.34), 1); assert.equal(seg(0.21, 0.08, 0.34), 0.5);
  assert.match(J, /i = Math\.min\(N - 1, Math\.floor\(x\)\), t = Math\.min\(1, x - i\)/);
  assert.match(J, /\['a1', 'a2', 'a3'\]\.forEach/);
});

test('hareketi azalt: film sabitlenmez, her ekran son hâliyle; yumuşak kaydırma ve eğim kapalı', () => {
  assert.match(J, /if \(SAKIN\) \{ bolum\.classList\.add\('kf-duragan'\);/);
  assert.match(CSS, /\.kf-duragan \.kf-yap\{position:relative;top:0;height:auto/);
  assert.match(CSS, /\.kf-duragan \.kf-b\{position:static;opacity:1;translate:none\}/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)\{\.kf \*,\.kb \*\{animation:none!important;transition:none!important\}\.kb-msj\{opacity:1\}/);
  const sc = read('kids/assets/kids-scroll.js');
  assert.match(sc, /function yumusakKur\(\) \{\s*if \(SAKIN \|\| !W\.matchMedia \|\| !W\.matchMedia\('\(hover: hover\) and \(pointer: fine\)'\)\.matches\) return;/, 'yalnız fareli masaüstü');
  assert.match(sc, /function egimKur\(\) \{\s*if \(SAKIN\) return;/);
  assert.doesNotMatch(sc, /requestPermission/, 'iOS izin penceresi açılmaz');
});

test('yumuşak kaydırma pencereleri ve iç kaydırmayı bozmaz', () => {
  const sc = read('kids/assets/kids-scroll.js');
  assert.match(sc, /el\.closest\('\.ktf,\.kr-katman,\.ku'\)/);
  assert.match(sc, /if \(e\.ctrlKey \|\| e\.defaultPrevented \|\| D\.getElementById\('kl-sayfa'\)\.hidden \|\| kaydirilabilir\(e\.target\)\) return;/);
  assert.match(sc, /\['keydown', 'mousedown', 'touchstart'\]\.forEach/, 'klavye ve kaydırma çubuğu akışı keser');
  assert.match(J, /W\.KIDS_SCROLL\.kaydir\(hedef\)/, 'noktalar da yumuşak kayar');
});

test('üç bakış: ARIA sekmeler, ok tuşları, paneller', () => {
  for (let i = 0; i < 3; i++) { assert.match(S, new RegExp('role="tab" id="kb-t' + i + '" aria-controls="kb-p' + i + '"')); assert.match(S, new RegExp('role="tabpanel" id="kb-p' + i + '" aria-labelledby="kb-t' + i + '"')); }
  assert.equal((S.match(/aria-selected="true"/g) || []).length, 1);
  assert.match(J, /e\.key === 'ArrowRight' \? \(i \+ 1\) % 3 : e\.key === 'ArrowLeft' \? \(i \+ 2\) % 3/);
  assert.match(J, /b\.tabIndex = i === n \? 0 : -1/);
});

test('15.11.2026 (3): fiyat yazmaz; teklif sahnesi, yığılan yaş kartları, yana akan konular, bulut kenarlar, tablette deneme', () => {
  assert.doesNotMatch(S, /34\.900|TL<|KDV|kl-fiyat-kart/, 'sayfada fiyat yok');
  assert.match(S, /<a href="#fiyat">Teklif<\/a>/);
  assert.match(S, /<section class="kl-bolum kt2" id="fiyat" aria-labelledby="kt2-b">/);
  assert.equal((S.match(/<li><i>\d<\/i><b>/g) || []).length, 3, 'üç adımlık yol');
  assert.equal((S.match(/<article class="kyd-kart" style="--r:#[0-9A-F]{6};--i:\d">/g) || []).length, 3);
  assert.match(CSS, /\.kyd-kart\{--ort:0;position:sticky;top:calc\(96px \+ var\(--i\) \* 26px\)/);
  assert.match(J, /a\.style\.setProperty\('--ort', p\.toFixed\(3\)\)/);
  assert.match(S, /<section class="kkn" id="icerik-konular" data-kk aria-labelledby="kk-b">/);
  assert.match(J, /kkYol = Math\.max\(0, kkSerit\.offsetWidth - kkSerit\.parentNode\.clientWidth\)/);
  assert.match(J, /if \(ks\) ks\.textContent = V\.KONU\.length; if \(ws && top\) ws\.textContent = top;/, 'konu ve kelime sayısı veriden');
  assert.match(J, /if \(SAKIN\) \{ kk\.classList\.add\('kk-duragan'\)|if \(SAKIN\) \{ kk\.classList\.add\('kkn-duragan'\)/);
  for (const k of ['.kl-hero::after', '.kf::before', '.kf::after']) assert.ok(CSS.includes(k), k + ' bulut kenarı');
  assert.match(CSS, /\.kl-dene-oyun\{position:relative;padding:18px!important;[^}]*background:var\(--m\)!important/);
  /* başka modüllerin sınıflarıyla çakışmasın (kitaplık kk-, yazdırma ky-) */
  for (const f of fs.readdirSync(path.join(ROOT, 'kids/assets')).filter((x) => /\.css$/.test(x) && x !== 'kids-film.css')) {
    const c = read('kids/assets/' + f);
    for (const on of ['kf-', 'kb-', 'kyd-', 'kkn-', 'kt2-']) assert.ok(!c.includes('.' + on), f + ' içinde .' + on + ' var: önek çakışması');
  }
});

summary();
