/* ==========================================================================
   ACADEX — SUNUM: KALİTE KAYDI VE YÖNETMEN DAYANIKLILIĞI
   (tests/sunum-kalite-kaydi.js)

   NEDEN VAR (13.11.2026, veri taraması): canlıda 4 sunum, 24 asetat vardı ve
   ÜÇ ayrı şey bozuktu:

     1) presentations.quality_score / quality_report dört sunumda da BOŞTU.
        Yönetmen (acadia-presentation-director) 0-100 puan ve sorun listesi
        döndürüyor — tek gerçek ölçüm 96/100 idi — ama istemci yanıttaki
        quality alanını atıyordu. Puan ne kaydediliyor ne gösteriliyordu.
     2) Puanı göstermek tek başına yetmez: o 96 puanlı destede
        slide_count_mismatch sorunu vardı. Puan sorunlarla birlikte görünmeli,
        yoksa öğrenci "96 almışım" deyip eksik desteyi öyle bırakır.
     3) Üretimin 4 koşusunun 3'ü düşmüştü (2× AI_SERVICE_UNAVAILABLE,
        1× INCOMPLETE_PLAN). Üç deneme de AYNI modele gidiyordu ve taslak
        eşiği (%75) fazla katıydı.

   Çalıştırma:  node tests/sunum-kalite-kaydi.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const dir = read('supabase/functions/acadia-presentation-director/index.ts');

test('KALİTE RAPORU DESTEYE KADAR GELİR (13.11.2026)', () => {
  assert.match(ink, /return \{ title: txt\(pres\.title\), items: out, quality: d && d\.quality/,
    'fromDirector kalite raporunu atıyor');
  assert.match(ink, /plotMeta\.quality = r\.quality \|\| null;/,
    'üretim yolunda kalite plotMeta’ya alınmıyor');
  assert.match(ink, /if \(plotMeta\.quality\) deck\.quality = plotMeta\.quality;/,
    'kalite desteye yazılmıyor');
});

test('KALİTE SUNUMA KAYDEDİLİR (13.11.2026)', () => {
  /* quality_score / quality_report sütunları 20260810 migration'ından beri
     vardı ama kodun hiçbir yerinde yazılmıyordu. */
  assert.match(ink, /row\.quality_score = Math\.max\(0, Math\.min\(100, Math\.round\(d\.quality\.score\)\)\)/,
    'quality_score kaydedilmiyor');
  assert.ok(ink.includes('row.quality_report = d.quality;'), 'quality_report kaydedilmiyor');
  assert.match(ink, /if \(d\.quality && typeof d\.quality\.score === 'number'\)/,
    'kalite yokken de yazmaya çalışıyor (elle yapılan destede alan boş kalmalı)');
});

test('PUAN SORUNLARIYLA BİRLİKTE GÖRÜNÜR (13.11.2026)', () => {
  /* Tek gerçek ölçüm 96/100 "geçti" idi ve aynı anda slide_count_mismatch
     bildiriyordu. Yalnız puan gösterilirse bu sorun görünmez kalır. */
  assert.match(ink, /Acadia kalite notu ' \+ Math\.round\(kq\.score\) \+ '\/100'/,
    'kalite notu ekranda gösterilmiyor');
  assert.match(ink, /arr\(kq\.issues\)\.length \? ' — ' \+ arr\(kq\.issues\)\.map/,
    'sorunlar puanın yanında gösterilmiyor');
  for (const k of ['slide_count_mismatch', 'duplicate_titles', 'weak_speaker_notes', 'dense_slides', 'visual_repetition', 'weak_grounding'])
    assert.ok(ink.includes(k + ':'), k + ' için Türkçe karşılık yok (ham anahtar görünür)');
});

test('YÖNETMEN: model şeridi ve yumuşak taslak eşiği (13.11.2026)', () => {
  /* 3 denemenin 3'ü de aynı modele gidiyordu: model meşgulse tekrar denemek
     işe yaramıyordu. Son deneme ayrı kotası olan küçük modele düşer. */
  assert.match(dir, /const lane = \[primary, primary, fallback\]/, 'model şeridi yok');
  assert.match(dir, /model: lane\[attempt\] \|\| primary,/, 'istek hâlâ tek modele gidiyor');
  assert.match(dir, /GROQ_PRESENTATION_MODEL_FALLBACK/, 'yedek model ortam değişkeni yok');
  assert.match(dir, /if \(outlineRaw\.length < Math\.max\(3, Math\.ceil\(slideCount \* 0\.5\)\)\) throw new Error\('INCOMPLETE_PLAN'\)/,
    'taslak eşiği hâlâ %75 — 10 asetatlık istekte 7 başlık gelince üretim tamamen düşer');
});

summary();
