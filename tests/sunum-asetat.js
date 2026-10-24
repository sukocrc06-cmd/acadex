/* ==========================================================================
   ACADEX — SUNUM ASETAT TESTLERI (tests/sunum-asetat.js)

   NEDEN VAR (24.10.2026): kalem kutusundaki "zenginleştir" her maddeye 2-3
   cümlelik paragraf, "(Wikipedia)" ve uydurma sayı yazıyordu; iki kolonlu
   asetatta her şeyi ilk kolona yığıyor, yazı asetattan taşıyıp başlığın
   üstüne biniyordu.
     - generate-slide-content: enrich/shorten artık maxBullets/maxWords alır,
       çıktıyı tidyContent ile zorla keser, atıfları siler.
     - js/acadex-ink.js: kutunun sığdırabileceği kadar madde ister (capOf),
       her kolonu ayrı zenginleştirir (targetsOf), önizler (preview),
       sığmayanı konuşmacı notuna taşır (settle), denetçi tarar (audit).

   Çalıştırma:  node tests/sunum-asetat.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const FN = 'supabase/functions/generate-slide-content/index.ts';
const { tidyBullet, tidyContent } = loadFromSource(FN, ['tidyBullet', 'tidyContent']);
const { test, summary } = makeRunner();

test('tidyContent: paragrafı tek cümleye indirir, atıfı siler', () => {
  const raw = "• 1453 öncesinde Bizans'ın savunma gücü 7,000 askerle sınırlıydı (Wikipedia). Devlet hazinesi borçla sarsılmıştı.\n• Surlar üç katlıydı [1]";
  const out = tidyContent(raw, 5, 14).split('\n');
  assert.equal(out.length, 2);
  assert.equal(out[0], "• 1453 öncesinde Bizans'ın savunma gücü 7,000 askerle sınırlıydı");
  assert.equal(out[1], '• Surlar üç katlıydı');
});

test('tidyContent: madde sayısını maxBullets ile keser', () => {
  const raw = ['a bir iki üç', 'b bir iki üç', 'c bir iki üç', 'd bir iki üç'].map((x) => '• ' + x).join('\n');
  assert.equal(tidyContent(raw, 2, 10).split('\n').length, 2);
});

test('tidyBullet: sayı içindeki virgülden bölmez', () => {
  const t = tidyBullet('yaklaşık 7,000 askerle sınırlıydı ve bunların çoğu paralı askerdi, şehir küçüktü', 6);
  assert.ok(!/ 7$/.test(t), t);
  assert.ok(t.includes('7,000'), t);
});

test('tidyBullet: II. gibi kısaltmada cümle bölmez', () => {
  assert.equal(tidyBullet('Fatih Sultan Mehmed II. kuşatmayı üç aşamada yürüttü', 14), 'Fatih Sultan Mehmed II. kuşatmayı üç aşamada yürüttü');
});

test('tidyBullet: sınırı aşan maddeyi keser ve belli eder', () => {
  const t = tidyBullet('bir iki üç dört beş altı yedi sekiz dokuz on on bir on iki', 6);
  assert.ok(t.split(/\s+/).length <= 7, t);
  assert.ok(t.endsWith('…'), t);
});

test('enrich ve shorten kısa madde kuralını ve kaynak kuralını taşır', () => {
  const src = read(FN);
  assert.match(src, /'shorten'\]/);
  assert.match(src, /SLIDE_RULE\(maxB, maxW\)/);
  assert.match(src, /KAYNAK KURALI/);
  assert.match(src, /action === 'enrich' \|\| action === 'shorten'\) \? tidyContent/);
});

test('acadex-ink: zenginleştir kutu kapasitesi, kolon başlığı ve önizlemeyle çalışır', () => {
  const ink = read('js/acadex-ink.js');
  assert.match(ink, /maxBullets: c\.b, maxWords: c\.w, sourceText:/);
  assert.match(ink, /slideTitle: ttl \+ \(t\.hint \? ' — ' \+ t\.hint : ''\)/);
  assert.match(ink, /var PREV = \{ rich: 1, short: 1, list: 1 \};/);
  assert.match(ink, /Asetata sığmayanlar: /);
  assert.ok(!/E\('t', 70, 466, 820, 44/.test(ink), 'soru artık sabit y=466 a basılmamalı');
  assert.match(ink, /data-audit>✓ asetatları denetle/);
});

summary();
