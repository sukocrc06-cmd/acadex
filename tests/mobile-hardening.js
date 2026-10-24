/* ==========================================================================
   ACADEX — TELEFON/TABLET SERTLESTIRME TESTLERI (tests/mobile-hardening.js)

   NEDEN VAR (24.10.2026, "Telefon/Tablet Iyilestirme ve Hata Raporu"):
     - Ag kesilince sinav taslagi sunucuya yazilamiyor, baglanti donunce de
       tekrar denenmiyordu (yalniz bir sonraki cevap degisiminde yaziliyordu).
       js/exam-engine.js artik 'online' olayinda kirli taslagi yeniden yazar.
     - Sure sayaci iki yerden (dashboard.js + acadex-ink.js) otomatik teslim
       tetikleyebiliyordu; submitExam'de ucustaki istek kilidi var.
     - Landing'in scroll dinleyicisi pasif degildi ve her olayda yaziyordu.
     - dashboard.html'de viewport-fit=cover yoktu; env(safe-area-inset-*)
       hep 0 donuyor, alt menu ve ust bar centige giriyordu.

   Calistirma:  node tests/mobile-hardening.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const E = require(path.join(ROOT, 'js', 'exam-engine.js'));
const { test, summary } = makeRunner();

// Basssiz motor icin en kucuk tarayici: window/document olay hedefi, bos kok.
function withBrowser(fn) {
  const prev = { window: globalThis.window, document: globalThis.document, warn: console.warn };
  console.warn = () => {}; // beklenen "taslak yazilamadi" uyarilari
  globalThis.window = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = 'visible';
  globalThis.document = doc;
  const root = new EventTarget();
  root.querySelector = () => null;
  root.querySelectorAll = () => [];
  return Promise.resolve()
    .then(() => fn(root))
    .finally(() => { E.destroy(); globalThis.window = prev.window; globalThis.document = prev.document; console.warn = prev.warn; });
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('HATA NOBETI: sunucu taslagi yazilamazsa baglanti donunce yeniden yazilir', () => withBrowser(async (root) => {
  let calls = 0, fail = true;
  E.attach({ id: 'x1', questions: [] }, {
    root, userId: 'u1',
    saveRemote: async () => { calls++; if (fail) throw new Error('offline'); }
  });
  window.dispatchEvent(new Event('pagehide'));
  await tick();
  assert.equal(calls, 1, 'pagehide bir kez yazmayi denemeli');
  fail = false;
  window.dispatchEvent(new Event('online'));
  await tick();
  assert.equal(calls, 2, "'online' kirli taslagi yeniden yazmali");
  window.dispatchEvent(new Event('online'));
  await tick();
  assert.equal(calls, 2, 'temiz taslak tekrar yazilmamali');

  // Motor kapaninca 'online' dinleyicisi birakilir. (Ayni testte: kosucu
  // async testleri paralel kosuyor, global window paylasilamaz.)
  fail = true;
  window.dispatchEvent(new Event('pagehide'));
  await tick();
  assert.equal(calls, 3);
  E.destroy();
  window.dispatchEvent(new Event('online'));
  await tick();
  assert.equal(calls, 3, 'kapali motor yazmamali');
}));

test('submitExam: ucustaki teslim varken ikinci cagri hemen doner', () => {
  const src = read('js/dashboard.js');
  const body = src.slice(src.indexOf('async function submitExam('), src.indexOf('window.submitExam = submitExam;'));
  assert.match(src, /let examSubmitInFlight = false;/);
  assert.match(body, /if \(examSubmitInFlight\) return;/);
  assert.ok(body.indexOf('examSubmitInFlight = true;') < body.indexOf('await supabaseClient.auth.getSession()'), 'kilit ilk await ten once kurulmali');
  assert.match(body, /finally \{\n\s*examSubmitInFlight = false;/);
});

test('landing scroll dinleyicisi pasif ve rAF ile', () => {
  const src = read('js/main.js');
  assert.doesNotMatch(src, /addEventListener\('scroll', handleScroll\)/);
  assert.match(src, /requestAnimationFrame\(\(\) => \{ scrollRaf = 0; handleScroll\(\); \}\)/);
  assert.match(src, /\}, \{ passive: true \}\);/);
});

test('dashboard: viewport-fit=cover ve ust bar guvenli alanda', () => {
  assert.match(read('dashboard.html'), /<meta name="viewport" content="[^"]*viewport-fit=cover/);
  const css = read('css/acadex-ink.css');
  assert.match(css, /body\.acx \.ax-bar\{height:calc\(64px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /body\.acx \.dashboard-layout\{margin-top:calc\(64px \+ env\(safe-area-inset-top\)\)/);
});

test('klavye: --ax-vvh visualViewport tan yazilir ve tam ekran kart kullanir', () => {
  assert.match(read('js/acadex-ink.js'), /setProperty\('--ax-vvh'/);
  assert.match(read('css/acadex-ink.css'), /\.axr-card\{height:var\(--ax-vvh,100dvh\)!important\}/);
});

test('style.css: 100vh tam ekranlarin hepsinde 100dvh geri donusu var', () => {
  const lines = read('css/style.css').split('\n');
  lines.forEach((l, i) => {
    if (!/^\s*(min-)?height:\s*(calc\()?100vh/.test(l)) return;
    const prop = l.trim().split(':')[0];
    const next = (lines[i + 1] || '').trim();
    if (/320px|260px/.test(l)) return; // panel ici kaydirma alanlari, tam ekran degil
    assert.ok(next.startsWith(prop + ':') && next.includes('100dvh'), 'satir ' + (i + 1) + ': ' + l.trim());
  });
});

summary();
