/* ==========================================================================
   ACADEX — SÖZLÜK KALDIRILDI (tests/sozluk.js), 27.11.2026

   NEDEN VAR: Acadex Sözlük (sol alttaki "Sözlük" düğmesi, Ctrl+K, yönetici panelindeki
   sözlük bölümü) kullanıcının isteğiyle tamamen kaldırıldı. Bir sayfa betiği yeniden
   yüklerse düğme geri gelir; bu test bunu yakalar.
     - Panel, bütün lab sayfaları ve yönetici paneli acadex-sozluk.js / admin-sozluk.*
       yüklemez; yönetici menüsünde "Sözlük" yok.
     - Veritabanı tablosu (20261118b_sozluk.sql) bilerek duruyor; kod ona dokunmaz.
   Calistirma:  node tests/sozluk.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();

const sayfalar = () => {
  const out = ['dashboard.html', 'admin.html', 'panel.html', 'index.html'];
  for (const d of fs.readdirSync(path.join(ROOT, 'labs'))) { const f = path.join('labs', d, 'index.html'); if (fs.existsSync(path.join(ROOT, f))) out.push(f); }
  return out.filter((f) => fs.existsSync(path.join(ROOT, f)));
};

test('hiçbir sayfa sözlük betiğini ya da stilini yüklemez', () => {
  const L = sayfalar(); assert.ok(L.length >= 14, 'lab sayfaları bulundu');
  for (const f of L) assert.doesNotMatch(read(f), /acadex-sozluk\.js|admin-sozluk\.(js|css)/, f);
});

test('yönetici menüsünde Sözlük bölümü yok', () => {
  const a = read('js/admin-app.js');
  assert.doesNotMatch(a, /k: 'sozluk'/); assert.doesNotMatch(a, /sozluk: '/);
});

test('sol alttaki düğmeye ait kalıntı kural yok', () => {
  for (const f of ['labs/depo/index.html', 'css/acadex-masa-renk.css']) assert.doesNotMatch(read(f), /\.asz-fab/, f);
});

summary();
