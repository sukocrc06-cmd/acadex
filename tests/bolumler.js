/* ==========================================================================
   ACADEX — FAKÜLTE / BÖLÜM LİSTESİ TESTLERİ (tests/bolumler.js)

   NEDEN VAR (31.10.2026, tıp ve diğer fakültelerin kayıt olabilmesi):
     - Veritabanı yalnızca 4 İİBF bölümüne izin veriyordu; tıp öğrencisi kayıt
       olunca handle_new_user bölümünü boşaltıyor, Ayarlar'dan seçince CHECK
       kısıtı reddediyordu. Liste artık iki yerde: js/acadex-bolumler.js ve
       supabase/migrations/20261031_bolumler.sql (acadex_departments()).
       İkisi ayrışırsa bir bölüm ekranda görünür ama kaydedilemez.
     - Yan menüde bölüme uymayan lab "diğer laboratuvarlar" altında katlanır;
       bölüm yoksa ya da "Other" ise hepsi açık kalmalı.
     - Eski getDepartmentShortName/ColorClass "business" kelimesine bakıyordu;
       Uluslararası Ticaret İşletme rozetini alıyordu, yeni bölümler "DEPT".

   Calistirma:  node tests/bolumler.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner, sliceDeclaration } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();

const modSrc = read('js/acadex-bolumler.js');
const sql = read('supabase/migrations/20261031_bolumler.sql');

function load() {
  const win = {
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener() {},
    document: { readyState: 'loading', addEventListener() {}, getElementById: () => null },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(modSrc, win);
  return win.AX_BOLUM;
}
const B = load();

test('JS listesi ile SQL acadex_departments() aynı', () => {
  const body = sql.match(/acadex_departments\(\)[\s\S]*?select array\[([\s\S]*?)\]::text\[\]/);
  assert.ok(body, 'SQL listesi bulunamadı');
  const inSql = [...body[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(Array.from(B.all()).sort(), inSql);
});

test('eski 4 bölüm aynı değerle duruyor (eski kayıtlar bozulmasın)', () => {
  for (const d of ['Management Information Systems', 'Business Administration', 'International Trade and Business', 'Banking and Finance']) assert.ok(B.valid(d), d);
});

test('SQL: kısıt ve kayıt tetikleyicisi aynı listeyi kullanıyor, boş bölüm serbest', () => {
  assert.match(sql, /check \(department = '' or department = any \(public\.acadex_departments\(\)\)\)/);
  assert.match(sql, /if not \(dep = any \(public\.acadex_departments\(\)\)\) then dep := ''/);
  assert.match(sql, /immutable/, 'CHECK içinde kullanılan fonksiyon immutable olmalı');
});

test('lab eşlemesi: tıp → MedLab, İİBF → Finans, Other/boş → hepsi', () => {
  assert.deepEqual(Array.from(B.labsFor('Medicine')), ['medlab']);
  assert.deepEqual(Array.from(B.labsFor('Audiology')), ['medlab']);
  assert.deepEqual(Array.from(B.labsFor('Banking and Finance')), ['finans']);
  assert.deepEqual(Array.from(B.labsFor('Health Management')).sort(), ['finans', 'medlab']);
  assert.deepEqual(Array.from(B.labsFor('Computer Engineering')), []);
  assert.equal(B.labsFor('Other'), null);
  assert.equal(B.labsFor(''), null);
  assert.equal(B.labsFor('Bilinmeyen Bölüm'), null);
});

test('her bölümün Türkçe adı ve fakültesi var; <select> fakülte gruplu', () => {
  for (const d of B.all()) { assert.ok(B.tr(d) && B.tr(d) !== d || d === 'Other', d); assert.ok(B.faculty(d), d); }
  const html = B.options('Medicine', 'bölümünü seç');
  assert.equal((html.match(/<optgroup/g) || []).length, 4);
  assert.match(html, /<option value="Medicine" selected>Tıp<\/option>/);
  assert.match(html, /^<option value="">bölümünü seç<\/option>/);
});

test('rozet kısaltmaları: hepsi tanımlı ve benzersiz', () => {
  const seen = new Set();
  for (const d of B.all()) {
    const s = B.short(d);
    assert.ok(s != null, 'kısaltma yok: ' + d);
    if (s) { assert.ok(!seen.has(s), 'tekrar eden kısaltma: ' + s); seen.add(s); }
  }
});

test('dashboard.js: Uluslararası Ticaret artık İşletme rozeti almıyor', () => {
  const src = read('js/dashboard.js');
  const body = ['getDepartmentColorClass', 'getDepartmentShortName'].map((n) => sliceDeclaration(src, n)).join('\n');
  const { color, short } = new Function('window', body + '\nreturn { color: getDepartmentColorClass, short: getDepartmentShortName };')({ AX_BOLUM: B });
  assert.equal(color('International Trade and Business'), 'dept-itb');
  assert.equal(color('Business Administration'), 'dept-ba');
  assert.equal(short('International Trade and Business'), 'ITB');
  assert.equal(short('Medicine'), 'MED');
  assert.notEqual(short('Public Finance'), 'B&F');
});

test('sayfalar modülü yüklüyor ve kullanıyor', () => {
  const reg = read('register.html'), dash = read('dashboard.html'), adm = read('admin.html');
  assert.ok(reg.indexOf('js/acadex-bolumler.js') > -1 && reg.indexOf('js/acadex-bolumler.js') < reg.indexOf('js/auth.js'));
  assert.match(reg, /id="department"[^>]*data-bolum-select/);
  assert.ok(dash.indexOf('js/acadex-bolumler.js') > -1 && dash.indexOf('js/acadex-bolumler.js') < dash.indexOf('js/profile-complete.js'));
  assert.ok(adm.indexOf('js/acadex-bolumler.js') > -1 && adm.indexOf('js/acadex-bolumler.js') < adm.indexOf('js/admin-app.js'));
  assert.match(read('js/profile-complete.js'), /window\.AX_BOLUM\.options\(/);
  assert.match(read('js/i18n.js'), /window\.AX_BOLUM\.valid\(dept\)/);
  assert.match(read('js/admin-app.js'), /window\.AX_BOLUM\.all\(\)/);
});

test('yan menü: katlanan lab erişilebilir kalıyor (gizli değil, katlı)', () => {
  assert.match(modSrc, /aria-expanded/);
  assert.match(modSrc, /activeFolded/, 'katlı lab açıkken grup kendiliğinden açılmalı');
  assert.match(modSrc, /KEY_ALL = 'acadexLabsAll'/);
});

summary();
