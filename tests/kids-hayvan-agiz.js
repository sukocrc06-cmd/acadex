/* ==========================================================================
   ACADEX — ACADEX KIDS: KONUŞAN HAYVANIN AĞZI (tests/kids-hayvan-agiz.js), 20.11.2026

   NEDEN VAR: İzle sahnesinde kedi/köpek konuşurken açılan ağız burnun üstüne biniyordu
   ("köpek burnundan konuşuyor"). Ağız yeri (kids-hayvan.js T[id].ag) elle verilmişti.
   Bu dosya her hayvan için yüz çiziminden (kids-resim.js ic) burnu / burun deliklerini
   bulur ve açılan ağzın (cy = ag+2, ry 5.5) bunların ALTINDA kaldığını, yüzün dışına
   taşmadığını ölçer. Yeni hayvan eklenince de çalışır.
   Çalıştırma:  node tests/kids-hayvan-agiz.js
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

const W = { document: { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() { } }, addEventListener() { }, matchMedia: () => ({ matches: false }), navigator: {}, console };
W.window = W; vm.createContext(W);
for (const f of ['kids-canli.js', 'kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-hayvan.js']) vm.runInContext(read('kids/assets/' + f), W, { filename: f });
const src = read('kids/assets/kids-hayvan.js');
const AG = {};
for (const m of src.matchAll(/\n    (\w+): \{[^\n]*?ag: (null|\[([\d.]+), ([\d.]+)(?:, ([\d.]+))?\])/g)) AG[m[1]] = m[2] === 'null' ? null : [+m[3], +m[4], m[5] ? +m[5] : 1];
const sayi = (s, a) => { const m = new RegExp('\\b' + a + '="([-\\d.]+)"').exec(s); return m ? +m[1] : NaN; };
/* yüzdeki küçük yuvarlak parçalar (göz, burun, burun deliği) */
function parcalar(id) {
  const ic = W.KIDS_RESIM.ic(id), L = [];
  for (const m of ic.matchAll(/<(ellipse|circle)\b[^>]*>/g)) {
    const t = m[0], cx = sayi(t, 'cx'), cy = sayi(t, 'cy'), ry = m[1] === 'circle' ? sayi(t, 'r') : sayi(t, 'ry'), rx = m[1] === 'circle' ? ry : sayi(t, 'rx');
    if ([cx, cy, rx, ry].some(Number.isNaN)) continue;
    L.push({ cx, cy, rx, ry });
  }
  return L;
}

test('ağız yerleri okundu', () => {
  assert.ok(Object.keys(AG).length >= 18, Object.keys(AG).join(','));
  /* 20.11.2026: civciv, domuz, fil, fare, zebra, keçi, su aygırı da konuşurken ağzını oynatır */
  const agizsiz = Object.keys(AG).filter((k) => !AG[k]);
  assert.equal(agizsiz.join(','), '', 'konuşurken ağzı oynamayan hayvan');
});

test('açılan ağız burnun / burun deliklerinin altında, gözlere değmez', () => {
  const hata = [];
  for (const [id, ag] of Object.entries(AG)) {
    if (!ag) continue;
    const ust = ag[1] + 2 - 5.5 * ag[2], alt = ag[1] + 2 + 5.5 * ag[2];
    /* burun: ağzın üstünde, ağza yakın x'te, küçük parça (gözler 52'nin üstünde) */
    for (const p of parcalar(id)) {
      if (p.rx > 6 || Math.abs(p.cx - ag[0]) > 14) continue;
      /* göz: ağız hiçbir gözün üstüne çıkmaz */
      if (p.cy < 52) { if (ust < p.cy + p.ry) hata.push(id + ': ağız göze değiyor'); continue; }
      if (Math.abs(p.cx - ag[0]) > 10 || p.cy > ag[1] + 2) continue;
      if (ust < p.cy + p.ry - 0.6) hata.push(id + ': ağız üstü ' + ust.toFixed(1) + ' < burun altı ' + (p.cy + p.ry).toFixed(1));
    }
    if (alt > 88) hata.push(id + ': ağız yüzün altına taşıyor ' + alt);
  }
  assert.deepEqual(hata, []);
});

summary();
