/* ==========================================================================
   ACADEX — DEFTER: TABLET VE KALEM, TANITIM SAYFASI AKICILIGI
   (tests/defter-tablet.js)

   NEDEN VAR (25.10.2026, test raporu R25, R31, R3, R4):
     R25  Tablette depodan eklenen post-it'ler ust uste geliyordu (hep sayfa
          ortasina 20 px kaydirmayla) ve tasinamiyordu (yalnizca fare).
          findFreeNoteSpot + isaretci olaylariyla tasima.
     R31  Kalem secimliyken parmakla kaydirma cizgi birakiyordu; cizgi
          kagidin kenarindan cikinca da uzuyordu; tuval pikseli CSS
          boyutundan farkliyken cizgi parmagin altinda cikmiyordu.
     R3   Tanitim sayfasindaki ust kalem kaydirmayla ayni karede gitmiyordu.
     R4   Tablette kaydirma takiliyordu: buyuk golgeli masa parcalari her
          karede yeniden ciziliyordu (tarama suresinin yarisi).

   Calistirma:  node tests/defter-tablet.js
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
const index = read('index.html');
const { test, summary } = makeRunner();

function body(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, head + ' bulunamadi');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error(head + ' kapanmadi');
}

test('R25 notlar bos yere konur (iki yol da)', () => {
  assert.match(dash, /function findFreeNoteSpot\(overlay, w, h\)/);
  assert.match(body(dash, 'function addDepotStickyNoteToCanvas('), /findFreeNoteSpot\(overlay, 220, 150\)/);
  assert.match(body(dash, 'function addStickyNoteToNotebook('), /findFreeNoteSpot\(overlay, 220, 150\)/);
  assert.doesNotMatch(body(dash, 'function addDepotStickyNoteToCanvas('), /overlay\.children\.length \* 20/);
});

test('R25 bos yer, yapiskan arac cubugunun altindan baslar', () => {
  assert.match(body(dash, 'function findFreeNoteSpot('), /#notebook-view \.nb-top/);
});

test('R25 notlar isaretci olaylariyla (parmak, kalem, fare) tasinir', () => {
  const b = body(dash, 'function makeElementDraggable(');
  assert.match(b, /handle\.onpointerdown = dragMouseDown/);
  assert.match(b, /setPointerCapture/);
  assert.match(b, /el\.style\.touchAction = 'none'/);
  assert.doesNotMatch(b, /document\.onmousemove = elementDrag/);
});

test('R31 kalem de cizer; kalem kullanildiysa parmak kaydirir', () => {
  assert.match(ink, /if \(e\.pointerType !== 'touch' && e\.pointerType !== 'pen'\) return;/);
  assert.match(ink, /store\.set\('penOnly', '1'\)/);
  assert.match(ink, /if \(e\.pointerType === 'touch' && penOnly && inkMode\)/);
  assert.match(ink, /sc\.scrollBy\(\{ left: lastX - e\.clientX, top: lastY - e\.clientY, behavior: 'instant' \}\)/);
});

test('R31 kagittan cikinca cizgi biter', () => {
  assert.match(ink, /if \(!inside\(e\)\) \{ tEnd\(e\); return; \}/);
});

test('R31 cizim koordinati tuvalin gercek olcegine gore', () => {
  assert.match(dash, /function canvasPointFromEvent\(e\)/);
  assert.match(body(dash, 'function startDrawing('), /canvasPointFromEvent\(e\)/);
  assert.match(body(dash, 'function draw('), /canvasPointFromEvent\(e\)/);
});

test('R3 ust kalem kaydirma zaman cizelgesiyle', () => {
  assert.match(index, /@supports \(animation-timeline: scroll\(\)\)\{/);
  assert.match(index, /\.js \.rp-pen\{animation:rpPen linear both;animation-timeline:scroll\(root\)\}/);
});

test('R4 golgeli masa parcalari kendi katmaninda', () => {
  assert.match(index, /\.dsk-top,\.sheet,\.dsk-i\{will-change:transform\}/);
});

summary();
