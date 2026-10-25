/* ==========================================================================
   ACADEX — TEMA VE ANA EKRAN (tests/tema-ana-ekran.js)

   NEDEN VAR (25.10.2026, test raporu R5, R6, R8):
     R5  Gece modunda avatarin renkleri bozuluyordu. Gece modu sayfayi
         tumden ters ceviriyor, resimleri geri ceviriyor; ust cubuktaki
         avatar kutusu da geri cevrildigi icin resim UC kez cevriliyordu.
         Acadia yildizi ise hic geri cevrilmiyordu.
     R6  Tema dugmesi uc durum donuyordu (acik -> gece -> saate gore);
         'saate gore' gunduz acik gorundugu icin bir tiklama bosa gidiyordu.
         Artik ekranda gorunen temanin tersine gecer.
     R8  "Yarinki sana not" yalnizca tarayicidaydi ve "bugun" sayfa
         acilirken bir kez hesaplaniyordu. Artik profiles.day_memo'da,
         gun degisince yeniden hesaplanir, ertesi gun kendiliginden acilir.

   Calistirma:  node tests/tema-ana-ekran.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const css = read('css/acadex-ink.css');
const html = read('dashboard.html');
const sql = read('supabase/migrations/20261025a_gunluk_not.sql');
const { test, summary } = makeRunner();

const memoBlock = () => {
  const a = ink.indexOf('/* ---------- yarınki sana not ----------');
  const b = ink.indexOf('/* ---------- lamba: ipi çek ---------- */');
  assert.ok(a > 0 && b > a, 'not blogu bulunamadi');
  return ink.slice(a, b);
};

test('R5 ust cubuktaki avatar resmi bir kez daha cevrilmez', () => {
  assert.match(css, /html\.ax-dark #topbar-user-avatar img\{filter:none\}/);
});

test('R5 Acadia yildizi gece modunda geri cevrilir (golgeden once degil)', () => {
  assert.match(css, /html\.ax-dark #axa-layer \.axa-mas svg\{filter:drop-shadow\([^)]*\)\) invert\(1\) hue-rotate\(180deg\)\}/);
});

test('R6 tema dugmesi gorunen temanin tersine gecer (tek tiklama)', () => {
  assert.match(ink, /S\('acadex\.theme', html\.classList\.contains\('ax-dark'\) \? 'light' : 'dark'\)/);
  assert.doesNotMatch(ink, /t === 'dark' \? 'auto'/);
});

test('R6 dugme etiketi ekranda gorunen temaya gore', () => {
  assert.match(ink, /var vm = dark \? 'dark' : 'light'; tb\.setAttribute\('data-mode', vm\)/);
});

test('R8 not hesaba yazilir ve hesaptan okunur', () => {
  const b = memoBlock();
  assert.match(b, /from\('profiles'\)\.update\(\{ day_memo: val \}\)/);
  assert.match(b, /window\.axWhenProfile\(function \(p\)/);
  assert.match(b, /p\.day_memo/);
  assert.match(sql, /add column if not exists day_memo jsonb/);
  assert.doesNotMatch(html, /yalnızca bu tarayıcıda kalır/);
});

test('R8 bugun sabit degil, gun degisince yeniden hesaplanir', () => {
  const b = memoBlock();
  assert.match(b, /var todayK = function \(\) \{ return ymd\(new Date\(\)\); \}/);
  assert.match(b, /visibilitychange/);
  assert.match(b, /setInterval\(dayCheck, 60000\)/);
});

test('R8 onceki gunden kalan not ekrana gelince kendiliginden acilir', () => {
  const b = memoBlock();
  assert.match(b, /cur\.d < t && shownFor !== t && store\.get\('memoSeen'\) !== t && box\.hidden && memoInView/);
  assert.match(b, /IntersectionObserver/);
});

summary();
