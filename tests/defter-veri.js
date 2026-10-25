/* ==========================================================================
   ACADEX — DEFTERDE VERI KAYBI (tests/defter-veri.js)

   NEDEN VAR (25.10.2026, test raporu R24 R30 R32 R36 R37):
     R37  Silgiden sonra geri al / ileri al sayfayi bos birakiyordu
          (canvas 'destination-out' modunda kaliyordu) ve geri al butun
          notlari, yazilari, tablolari siliyordu (captureCurrentOverlayElements
          tanimli degildi, anlik goruntuler bos 'elements' tutuyordu).
     R24  Bilgi deposundan yapistirilan kart depodan siliniyordu; defterden
          de gidince her yerden kayboluyordu. Artik kopyalanir.
     R30  Sayfa degistirirken confirm() "Iptal" = kaydetmeden gec demekti;
          uc secenekli pencere: Kaydet ve devam et / Kaydetmeden / Vazgec.
     R32  Yeni sayfa kaydedilmeden kayboluyordu; acilir acilmaz yazilir.
     R36  "Deftere ekle" ayni notu tekrar tekrar ekliyordu, geri bildirim yoktu.

   Calistirma:  node tests/defter-veri.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const dash = read('js/dashboard.js');
const ink = read('js/acadex-ink.js');
const css = read('css/acadex-ink.css');
const { test, summary } = makeRunner();

function body(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, head + ' bulunamadi');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error(head + ' kapanmadi');
}

test('R37 captureCurrentOverlayElements tanimli ve kayit onu kullaniyor', () => {
  assert.match(dash, /function captureCurrentOverlayElements\(\)/);
  assert.match(dash, /window\.captureCurrentOverlayElements = captureCurrentOverlayElements/);
  assert.match(body(dash, 'async function saveNotebookData()'), /captureCurrentOverlayElements\(\)/);
});

test('R37 sayfa cizimi her zaman source-over ile yeniden kurulur', () => {
  const r = body(dash, 'function renderCurrentPageData(');
  const clear = r.indexOf('clearRect');
  const op = r.indexOf("globalCompositeOperation = 'source-over'");
  assert.ok(op >= 0 && op < clear, 'temizlemeden once source-over');
  assert.ok(r.indexOf("globalCompositeOperation = 'source-over'", clear) > clear, 'resim cizerken de source-over');
});

test('R37 yapiskan not eklenince geri al anlik goruntusu alinir', () => {
  assert.match(body(dash, 'function addStickyNoteToNotebook('), /recordNotebookState\(\)/);
});

test('R24 depodan yapistirma karti silmez (kopyalar)', () => {
  const p = body(dash, 'async function pasteDepotItem(');
  assert.doesNotMatch(p, /\.delete\(\)/);
  assert.match(p, /notebookHasUnsavedChanges = true/);
  assert.match(p, /classList\.add\('is-placed'\)/);
  assert.match(css, /\.is-placed \.depot-item-actions \.btn/);
});

test('R30 sayfa gecislerinde confirm() yerine uc secenekli pencere', () => {
  assert.match(dash, /function askNotebookUnsaved\(actionTr, actionEn\)/);
  const a = body(dash, 'function askNotebookUnsaved(');
  for (const k of ['save', 'discard', 'cancel']) assert.ok(a.includes('data-a="' + k + '"'), k);
  assert.match(a, /Escape[\s\S]*done\('cancel'\)/);
  assert.match(a, /Kaydet ve devam et/);
  assert.match(a, /Vazgeç/);
  for (const f of ['async function navigateNotebookPage(', 'async function selectNotebookTemplate(', 'async function selectPageFromOverview(']) {
    const b = body(dash, f);
    assert.match(b, /await confirmLeaveNotebookPage\(/, f);
    assert.doesNotMatch(b, /\bconfirm\(/, f);
  }
  assert.match(css, /\.nb-dlg-box/);
});

test('R32 yeni sayfa acilir acilmaz notebooks tablosuna yazilir', () => {
  const b = body(dash, 'async function selectNotebookTemplate(');
  assert.match(b, /from\('notebooks'\)[\s\S]*upsert\(/);
  assert.match(b, /onConflict: 'user_id,page_number'/);
});

test('R32 sayfa listesi sira numarasi ve kaydedilmedi isareti gosterir', () => {
  const b = body(dash, 'function openNotebookPagesOverview(');
  assert.match(b, /pageIdx \+ 1/);
  assert.match(b, /page-thumbnail-dirty/);
});

test('R36 Deftere ekle ayni notu ikinci kez eklemez ve geri bildirim verir', () => {
  assert.match(ink, /var noteText = function \(h\)/);
  assert.match(ink, /Bu not bu sayfada zaten var\./);
  assert.match(ink, /ax-flash/);
  assert.match(ink, /eklendi ✓/);
  assert.match(css, /@keyframes axNoteFlash/);
});

summary();
