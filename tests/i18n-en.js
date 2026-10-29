/* ==========================================================================
   ACADEX — İNGİLİZCE ARAYÜZ TESTLERİ (tests/i18n-en.js)

   NEDEN VAR (29.10.2026, "TR / EN" seçicisinin tüm panellerde çalışması):
     - Çeviri iki dosyada: js/i18n-en.js (sözlük, window.AX_EN) ve
       js/acadex-i18n.js (çalışma anı çevirici). Biri dashboard.html'den
       düşerse EN seçici sessizce yalnızca eski data-i18n metinlerini çevirir.
     - Öğrencinin içeriği ÇEVRİLMEZ: belgeler, özetler, kartlar, defter,
       sınav soruları, hata defteri, Acadia geçmişi, akış paylaşımları.
       Bunlar CONTENT seçicileriyle korunur; biri silinirse öğrencinin
       Türkçe özeti İngilizceye "çevrilmeye" çalışılır.
     - Hesap silme onayında yazılan sabit ifadeler ("hesabımı sil", "DELETE")
       çevrilirse kullanıcı ekranda gördüğünü yazar, kod Türkçesini bekler.
     - Özet dili arayüz dilinden bağımsız (ilk kullanımda TR).
     - Sözlükte {1}{2} sıralı yer tutucular anahtardaki {*}/{#} sayısını
       aşmamalı; aşarsa çeviride "undefined" ya da boşluk çıkar.

   Calistirma:  node tests/i18n-en.js
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

const html = read('dashboard.html');
const dictSrc = read('js/i18n-en.js');
const trSrc = read('js/acadex-i18n.js');
const ink = read('js/acadex-ink.js');

/* sözlük + çevirici, DOM'suz küçük bir pencere taslağında */
function load(lang) {
  const store = { acadexUILang: lang };
  const win = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    addEventListener() {},
    document: { readyState: 'loading', addEventListener() {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(dictSrc, win);
  vm.runInContext(trSrc, win);
  return win;
}

test('dashboard.html: sözlük, çeviriciden önce ve i18n.js sonrasında yükleniyor', () => {
  const a = html.indexOf('src="js/i18n.js"');
  const b = html.indexOf('src="js/i18n-en.js"');
  const c = html.indexOf('src="js/acadex-i18n.js"');
  assert.ok(a > -1 && b > -1 && c > -1, 'üç betik de bağlı olmalı');
  assert.ok(a < b && b < c, 'sıra: i18n.js → i18n-en.js → acadex-i18n.js');
});

test('sözlük: binlerce giriş, boş değer yok', () => {
  const w = load('tr');
  const T = w.AX_EN.t;
  const keys = Object.keys(T);
  assert.ok(keys.length > 3000, 'sözlük beklenenden küçük: ' + keys.length);
  for (const k of keys) assert.ok(typeof T[k] === 'string' && T[k].trim(), 'boş çeviri: ' + k);
});

test('sözlük: sıralı yer tutucular anahtardaki yer tutucu sayısını aşmıyor', () => {
  const T = load('tr').AX_EN.t;
  for (const [k, v] of Object.entries(T)) {
    const n = (k.match(/\{[#*]\}/g) || []).length;
    const idx = (v.match(/\{(\d)\}/g) || []).map((x) => +x[1]);
    const plain = (v.match(/\{[#*]\}/g) || []).length;
    if (idx.length) assert.ok(Math.max(...idx) <= n, `"${k}" → "${v}": {${Math.max(...idx)}} ama ${n} yer tutucu var`);
    if (plain) assert.ok(plain <= n, `"${k}" → "${v}": çeviride fazla yer tutucu`);
  }
});

test('hesap silme onay ifadeleri çevrilmiyor', () => {
  const w = load('en');
  assert.equal(w.axT('hesabımı sil'), 'hesabımı sil');
  assert.equal(w.axT('DELETE'), 'DELETE');
});

test('çevirici: EN’de çevirir, TR’de dokunmaz', () => {
  assert.equal(load('en').axT('Ayarlar'), 'Settings');
  assert.equal(load('en').axT('  Kaydet  '), '  Save  ', 'baştaki/sondaki boşluk korunmalı');
  assert.equal(load('tr').axT('Ayarlar'), 'Ayarlar');
  assert.equal(load('en').axT('Bu cümle sözlükte yok kesinlikle'), 'Bu cümle sözlükte yok kesinlikle');
});

test('çevirici: sayı kalıpları ve sıralı yer tutucular', () => {
  const w = load('en');
  /* {*} stilinde {*} için … → "… for {2} in {1} style" */
  assert.equal(w.axT('Cornell stilinde Biyoloji için çalışma kartı oluşturuldu'),
    'A study card was created for Biyoloji in Cornell style');
  assert.doesNotMatch(w.axT('Cornell stilinde Biyoloji için çalışma kartı oluşturuldu'), /undefined|\{\d\}/);
});

test('öğrenci içeriği CONTENT seçicileriyle korunuyor', () => {
  const m = trSrc.match(/var CONTENT = \[([\s\S]*?)\]\.join/);
  assert.ok(m, 'CONTENT listesi bulunamadı');
  const list = m[1];
  const must = [
    '[data-no-i18n]', '[contenteditable="true"]',
    '.axr-prose', '.axr-md', '.sum-body', '#sourcehub-summary-text',   // belge / özet
    '.kx-face', '.fc-front', '.fc-back', '#notebook-editor',           // kartlar, defter
    '.sn-qtext', '.sn-opts', '.sn-eg .q',                              // sınav, hata defteri
    '#acadia-messages', '.axb-post-body',                              // Acadia, akış
    '.doc-name',                                                        // belge adları
  ];
  for (const s of must) assert.ok(list.includes("'" + s + "'"), 'eksik seçici: ' + s);
  assert.match(trSrc, /SKIP = \{[^}]*SCRIPT[^}]*TEXTAREA/, 'textarea içeriği çevrilmemeli');
});

test('TR’ye dönüş: kayıt tutuluyor ve geri yükleniyor', () => {
  assert.match(trSrc, /var stop = function/);
  assert.match(trSrc, /r\.n\.data = r\.v/, 'metin düğümü eski hâline dönmeli');
  assert.match(trSrc, /W\.applyLanguage = w/, 'applyLanguage kancası');
  assert.match(trSrc, /e\.key === 'acadexUILang'/, 'diğer sekmeden dil değişimi');
});

test('özet dili arayüzden bağımsız: ilk kullanımda TR', () => {
  assert.match(ink, /if \(!last\) last = 'tr';/);
  assert.ok(ink.includes('Your documents and summaries stay as they are.'), 'EN bildirimi içeriğe dokunulmadığını söylemeli');
});

summary();
