/* ==========================================================================
   ACADEX — SINAV SALONU TASARIM TESTLERI (tests/sinav-salon.js)

   NEDEN VAR (29.10.2026, sınav platformu "sınav salonu" yeniden tasarımı):
     - Görünüm css/acadex-sinav.css'te; eski acadex-ink.css kurallarının
       ÜSTÜNE yüklenir. Bağlantı düşerse sayfa yeni işaretlemeyi eski
       stillerle gösterir (kara tahta, sıralar dağılır).
     - Başka dosyalar sınav işaretlemesine kanca atıyor: acadex-plus.js
       (.sn-eg / .sn-eg-h / .axs-wk), avatar-studio.js (.sn-score),
       dashboard.js (exam-form-params, btn-generate-exam ...). Tasarım
       değişirken bunlar kaybolursa özellikler sessizce kırılır.
     - Yeni sınav sihirbazı 3 adımlı; #exam-form-params ve hata satırı
       adımların dışına taşınmamalı, "kitapçığı dağıt" her adımda görünür.
     - Hareketler prefers-reduced-motion'da durmalı; koyu temada kara tahta
       geri çevrilmeli.

   Calistirma:  node tests/sinav-salon.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();

const html = read('dashboard.html');
const ink = read('js/acadex-ink.js');
const css = read('css/acadex-sinav.css');
const ex = html.slice(html.indexOf('id="exams-view"'), html.indexOf('data-builddlg'));
const bd = html.slice(html.indexOf('data-builddlg'), html.indexOf('</dialog>', html.indexOf('data-builddlg')));

test('acadex-sinav.css medlab stilinden SONRA bağlı', () => {
  const a = html.indexOf('css/acadex-medlab.css'), b = html.indexOf('css/acadex-sinav.css');
  assert.ok(a > 0 && b > a, 'sinav.css bağlantısı yok ya da eski stillerden önce');
});

test('sahne: kara tahta takvim, duvar saati, kürsüde gözetmen Acadia', () => {
  for (const k of ['class="sn-board', 'data-cal=""', 'data-cal-add', 'data-cal-tip', 'data-acx=""', 'data-wclock', 'data-hh', 'data-mh', 'data-sh', 'sn-lectern'])
    assert.ok(ex.includes(k), k + ' yok');
  assert.match(ex, /class="sn-gz"[^>]*data-acadia[^>]*data-costume="sinav"/);
});

test('üst düğmeler korunuyor (hata defteri, not hesapla, yeni sınav)', () => {
  assert.match(ex, /data-goerr[\s\S]*data-errn/);
  assert.ok(ex.includes('openGradeCalculator'));
  assert.match(ex, /sn-new[^>]*data-build|data-build[^>]*sn-new/);
});

test('sihirbaz: 3 adım, form alanları ve dağıt düğmesi yerinde', () => {
  assert.equal((bd.match(/data-step-go="\d"/g) || []).length, 3);
  for (const n of ['1', '2', '3']) assert.ok(bd.includes('data-step="' + n + '"'), 'adım ' + n);
  for (const id of ['exam-card-source-wrap', 'exam-course-source-wrap', 'exam-form-params', 'exam-question-count', 'btn-generate-exam'])
    assert.ok(bd.includes('id="' + id + '"'), id);
  assert.ok(bd.includes('data-step-next') && bd.includes('data-step-prev'));
  // dağıt düğmesi adımların içinde değil, alt şeritte
  const foot = bd.slice(bd.indexOf('sn-dlg-b'));
  assert.ok(foot.includes('btn-generate-exam'), 'dağıt düğmesi alt şeritte değil');
  assert.match(ink, /var stepGo = function/);
  assert.match(ink, /paintCover\(\); stepGo\(1, true\);/);
});

test('başka dosyaların kancaları korunuyor', () => {
  assert.ok(ink.includes('<div class="sn-eg"><div class="sn-eg-h">'), '.sn-eg / .sn-eg-h (acadex-plus.js)');
  assert.ok(ink.includes('axs-wk'), '.axs-wk (acadex-plus.js)');
  assert.match(ink, /class="sn-score /, '.sn-score (avatar-studio.js)');
  assert.ok(ink.includes('data-try') && ink.includes('data-prof'), 'sıra düğmeleri');
});

test('sıralar: kâğıt, kalem dairesi ve konu boncukları', () => {
  for (const k of ['sn-sheet', 'sn-mark', 'sn-beads', 'sn-legs', 'sn-chair']) assert.ok(ink.includes(k), k);
  for (const k of ['.sn-sheet', '.sn-mark', '.sn-beads', '.sn-mrow', '.sn-atts', '.sn-eg']) assert.ok(css.includes(k), 'css ' + k);
});

test('salon ve sonuçta gözetmen; süre azalınca tepki', () => {
  assert.match(html, /sn-gz-hall[^>]*data-gzh[^>]*data-acadia/);
  assert.ok(ink.includes('sn-gz-res'));
  assert.match(ink, /\$L\('\[data-gzh\]'\)[^\n]*AcadiaKit\.react\(gz, 'saskin'/);
});

test('hareket azaltma ve koyu tema korumaları', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*animation:none!important/);
  assert.match(css, /html\.ax-dark[^{]*\.sn-board[^{]*\{filter:invert\(1\) hue-rotate\(180deg\)\}/);
  assert.match(css, /transform-origin:50px 50px/, 'saat kolları merkezden dönmeli');
});

summary();
