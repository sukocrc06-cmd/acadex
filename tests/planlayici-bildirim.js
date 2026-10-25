/* ==========================================================================
   ACADEX — PLANLAYICI VE BILDIRIMLER (tests/planlayici-bildirim.js)

   NEDEN VAR (25.10.2026, test raporu R7, R10, R14, R21):
     R7   Hatirlaticilar yalnizca sinavlar icin, yalnizca o oturumda
          planlayici acildiysa calisiyordu; Android Chrome'da sayfadan
          new Notification() hata verdigi (sessizce yutuldugu) icin hic
          bildirim gelmiyordu. Artik window.axNotify -> sw.js
          showNotification; tum etkinlikler; acilista yuklenir.
     R10  .ics'te yalnizca sinavlarda alarm vardi; telefonda dosya
          Indirilenler'e dusuyordu. Her etkinlik alarmli, telefonda paylas.
     R14  Gun anlasilamayip form acildiginda, form kaydedilince hizli yaz
          kutusu dolu kaliyordu.
     R21  "Yarin 10.00 ..." saat noktayla yazilinca baslikta kaliyordu.

   Calistirma:  node tests/planlayici-bildirim.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const dash = read('js/dashboard.js');
const sw = read('sw.js');
const vercel = JSON.parse(read('vercel.json'));
const { test, summary } = makeRunner();

function slice(src, a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i + 1);
  assert.ok(i >= 0 && j > i, a + ' bulunamadi');
  return src.slice(i, j);
}

/* parseQuick'i kaynaktan cikarip calistir (bugun = 25.10.2026 pazar) */
function makeParser() {
  const body = slice(ink, '  var parseQuick = function (text) {', "  $('[data-quick]').addEventListener('submit'");
  const ctx = {
    MONTHS: ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'],
    DAYS: ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'],
    TYPE: { calisma: 'çalışma', sinav: 'sınav', odev: 'ödev' },
    now: new Date(2026, 9, 25, 14, 0, 0),
    todayK: '2026-10-25',
    pad: (n) => ('0' + n).slice(-2),
    ymd: (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2),
    addD: (k, n) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return ctx.ymd(d); },
    cap: (s) => s ? s.charAt(0).toLocaleUpperCase('tr') + s.slice(1) : s,
    docNames: () => []
  };
  vm.createContext(ctx);
  vm.runInContext(body + '\nthis.parseQuick = parseQuick;', ctx);
  return ctx.parseQuick;
}

test('R21 "Yarin 10.00" saati ayrilir, basliktan cikar', () => {
  const p = makeParser()('Yarın 10.00 week tekrarı');
  assert.equal(p.time, '10:00');
  assert.equal(p.date, '2026-10-26');
  assert.equal(p.title, 'Week tekrarı');
});

test('R21 iki nokta ve nokta ayni sonucu verir', () => {
  const q = makeParser();
  assert.deepEqual([q('yarın 10:00 x').time, q('yarın 10.00 x').time], ['10:00', '10:00']);
  assert.equal(q('cuma 14.30 finans sınavı').date, '2026-10-30');
  assert.equal(q('cuma 14.30 finans sınavı').time, '14:30');
  assert.equal(q('haftaya salı 10.00 vize').date, '2026-11-03');
});

test('R21 gun sozcugu yoksa "10.11" tarih olarak kalir', () => {
  const p = makeParser()('10.11 ödev teslimi');
  assert.equal(p.date, '2026-11-10');
  assert.equal(p.time, '');
});

test('R14 formdan kaydedilince hizli yaz kutusu bosalir', () => {
  assert.match(ink, /if \(!p\.date\) \{ quickPending = true; openForm\(/);
  assert.match(ink, /if \(quickPending\) \{ quickPending = false; var qi = \$\('#quick-in'\); if \(qi\) qi\.value = ''; \}/);
});

test('R7 bildirim servis calisani uzerinden (Android)', () => {
  assert.match(ink, /window\.axNotify = function \(title, opts\)/);
  assert.match(ink, /navigator\.serviceWorker\.register\('sw\.js'\)/);
  assert.match(ink, /r\.showNotification\(title, opts\)/);
  assert.match(sw, /addEventListener\('notificationclick'/);
  assert.doesNotMatch(sw, /addEventListener\('fetch'/);
  assert.ok(vercel.headers.some((h) => h.source === '/sw.js'));
});

test('R7 tum etkinlikler hatirlatilir, acilista yuklenir', () => {
  const b = slice(ink, '  var remindPlan = function (e) {', '  var checkRemind');
  assert.match(b, /e\.type === 'sinav'/);
  assert.match(b, /if \(e\.time\) return/);
  assert.match(b, /body: e\.title \+ ' bugün'/);
  assert.match(ink, /window\.axWhenProfile\(function \(p\) \{ if \(p && remindOn && !loaded\) load\(true\); \}\)/);
  const c = slice(ink, '  var checkRemind = function () {', '  window.axRemindCheck');
  assert.doesNotMatch(c, /e\.type !== 'sinav'/);
  assert.doesNotMatch(c, /new Notification\(/);
});

test('R7 eski Ingilizce sinav bildirimi yeni yola yonlendirilir', () => {
  assert.match(dash, /if \(typeof window\.axRemindCheck === 'function'\) \{ window\.axRemindCheck\(\); return; \}/);
});

test('R10 her etkinlik alarmli, uzun satirlar katlanir, telefonda paylas', () => {
  const b = slice(ink, "  $('[data-ics]').addEventListener('click'", '  /* ---------- hatırlatıcılar');
  assert.match(b, /var alarms = e\.type === 'sinav'/);
  assert.match(b, /'PT9H'/);
  assert.match(b, /var fold = function \(line\)/);
  assert.match(b, /navigator\.share\(\{ files: \[file\]/);
});

summary();
