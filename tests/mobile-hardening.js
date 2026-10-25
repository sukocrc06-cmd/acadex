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

/* 24.10.2026, ikinci tur ("puruzsuz ve akici", telefon/tablet taramasi):
     - Mermaid (3,5 MB) <head>'de senkron yukleniyordu; orta seviye telefonda ilk
       gorunum ~10 sn gecikiyordu. Artik yer tutucu var, kutuphane ilk diyagramda iner.
     - Chart.js ve KaTeX defer; Chart.js ana surume sabit (onceden surumsuz "latest").
     - style.css'teki Google Fonts @import'u (panelde kullanilmiyor) kaldirildi.
     - Sayfa gecisindeki 26px yana kayma telefonda sayfayi genisletiyor, alt menu
       ekranin altina kayiyordu: .dashboard-content overflow-x:clip.
     - Tablette Acadia maskotu (fixed, translateX(24px)) yatay kaydirma aciyordu. */
test('dashboard: mermaid tembel yuklenir, head te senkron mermaid/chart/katex yok', () => {
  const html = read('dashboard.html');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.doesNotMatch(head, /<script src="[^"]*mermaid[^"]*"><\/script>/, 'mermaid senkron yuklenmemeli');
  assert.match(head, /window\.mermaid = yer;/);
  assert.match(head, /\['parse', 'render', 'run'\]\.forEach/);
  assert.match(head, /<script defer src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js@4"><\/script>/);
  assert.match(head, /<script defer src="https:\/\/cdn\.jsdelivr\.net\/npm\/katex@[^"]+katex\.min\.js"><\/script>/);
  // supabase senkron kalmali: supabase-config.js hemen createClient cagiriyor
  assert.match(head, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2[^"]*"><\/script>/);
});

test('mermaid yer tutucusu: initialize ayari saklanir, parse/render gercek kutuphaneye devredilir', async () => {
  const html = read('dashboard.html');
  const code = html.slice(html.indexOf('(function () {\n      var cfg = null'), html.indexOf('window.acadexLoadMermaid = getir;') + 34) + '\n    })();';
  const real = { inits: [], initialize(c) { this.inits.push(c); }, parse: async (s) => s === 'ok', render: async (id, s) => ({ svg: '<svg id="' + id + '">' + s + '</svg>' }) };
  const head = { appendChild(s) { setTimeout(() => { win.mermaid = real; s.onload(); }, 0); } };
  const win = {};
  const doc = { head, createElement: () => ({}) };
  new Function('window', 'document', code)(win, doc);
  assert.ok(win.mermaid.__lazy);
  win.mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true });
  assert.equal(await win.mermaid.parse('ok'), true);
  assert.deepEqual(real.inits, [{ startOnLoad: false, suppressErrorRendering: true }], 'ayar yuklemede uygulanmali');
  assert.equal((await win.mermaid.render('d1', 'x')).svg, '<svg id="d1">x</svg>');
});

test('panel: Google Fonts @import yok; kullanan sayfalar link ile yukler', () => {
  assert.doesNotMatch(read('css/style.css'), /@import url\('https:\/\/fonts\.googleapis/);
  ['legal.html', 'changelog.html', 'ders-agaci.html'].forEach(f => assert.match(read(f), /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Newsreader/, f));
});

test('yatay tasma: sayfa gecisi icerikte kirpilir, Acadia maskotu dugmesinde kirpilir', () => {
  const css = read('css/acadex-ink.css');
  assert.match(css, /body\.acx \.dashboard-content\{overflow-x:clip\}/);
  const mas = css.match(/#axa-layer \.axa-mas\{[^}]*\}/)[0];
  assert.match(mas, /overflow-x:clip/);
  assert.doesNotMatch(mas, /transform:translateX\(24px\)/, 'dugme ekran disina tasmamali');
  assert.match(css, /#axa-layer \.axa-mas svg\{transform:translateX\(24px\)/);
});

summary();
