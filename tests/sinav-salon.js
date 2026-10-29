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

/* 29.10.2026: not hesaplayıcı "karne kâğıdı" ve "tahtaya sınav yaz" penceresi */
const dash = read('js/dashboard.js');
const gcHtml = html.slice(html.indexOf('id="grade-calc-modal"'), html.indexOf('Global Confirm Modal'));
const calHtml = html.slice(html.indexOf('data-caldlg'), html.indexOf('</dialog>', html.indexOf('data-caldlg')));

test('not hesaplayıcı: alan kimlikleri korunuyor, canlı hesap, Hesapla düğmesi yok', () => {
  for (const id of ['gc-vize-weight', 'gc-final-weight', 'gc-vize-grade', 'gc-target-grade', 'gc-result-box', 'gc-split'])
    assert.ok(gcHtml.includes('id="' + id + '"'), id);
  assert.ok(!gcHtml.includes('onclick="computeRequiredGrade()"'), 'eski Hesapla düğmesi kalmış');
  assert.match(dash, /\['gc-vize-grade', 'gc-target-grade'\]\.forEach\(\(id\) => document\.getElementById\(id\)\.addEventListener\('input', computeRequiredGrade\)\)/);
  assert.ok(css.includes('#grade-calc-modal'), 'karne kâğıdı stili yok');
});

test('not hesaplayıcı: hesap doğru (finalden gereken)', () => {
  const src = dash.slice(dash.indexOf('function gradeCalcResult('), dash.indexOf('window.gradeCalcResult'));
  const f = new Function(src + '; return gradeCalcResult;')();
  const r = f(40, 60, 65, 70);
  assert.equal(r.state, 'mid'); assert.equal(Math.ceil(r.required), 74);
  assert.equal(f(40, 60, 65, 99).state, 'bad');
  assert.equal(f(40, 60, 100, 30).state, 'done');
  assert.equal(f(40, 60, 90, 50).state, 'ok');
  assert.equal(f(40, 60, NaN, 50).state, 'idle');
  assert.equal(f(100, 0, 50, 50).state, 'bad', 'final ağırlığı 0 iken bölme hatası olmamalı');
  assert.equal(f(30, 60, 60, 70).sumOff, 90, 'toplam %100 değilse uyarı');
});

test('tahtaya sınav yaz: tür çipleri, hızlı tarih, canlı önizleme', () => {
  assert.equal((calHtml.match(/type="radio" name="cl-kind"[^>]*data-cl-kind/g) || []).length, 4);
  for (const q of ['7', '14', '30']) assert.ok(calHtml.includes('data-cl-quick="' + q + '"'));
  assert.ok(calHtml.includes('data-cl-prev') && calHtml.includes('data-cl-course') && calHtml.includes('data-cl-date'));
  assert.match(ink, /kind = clKind\(\)/, 'tür artık seçili çipten okunmalı');
  assert.match(ink, /var tkHtml = function/);
  assert.ok(css.includes('.sn-caldlg'));
});

summary();
