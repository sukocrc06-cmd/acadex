/* ==========================================================================
   ACADEX — DKT LAB (tests/dkt-lab.js)

   NEDEN VAR (29.10.2026): MedLab'e Dil ve Konuşma Terapisi öğrencileri için
   "terapi odası" laboratuvarı eklendi (labs/dkt/). Klinik içerik kaynaklı
   ölçeklere dayanır; bu test o ölçeklerin kodda bozulmadığını tutar:
     - Türkçe ünsüz tablosu (yer, biçim, ötümlülük)
     - Penetrasyon-Aspirasyon Skalası 1-8 (Rosenbek ve ark., 1996)
     - IDDSI şırınga akış testi eşikleri (0: <1 mL, 1: 1-4, 2: 4-8, 3: >8, 4: akmaz)
     - Boston afazi sınıflaması (akıcılık × anlama × tekrar = 8 tür)
     - %TH: yalnızca kekemeliğe özgü akıcısızlıklar sayılır
   Ayrıca MedLab bağlantısı: kart, iframe mikrofon izni, Acadia köprüsü.
   Aynı gün: Fizyo Lab kartı "fizyoterapi öğrencileri için" oldu.

   Calistirma:  node tests/dkt-lab.js
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

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(read('labs/dkt/dkt-veri.js'), ctx);
const V0 = ctx.window.AXDKT;
/* vm içindeki diziler başka bir realm'e ait; deepEqual için sade kopya */
const V = Object.assign(JSON.parse(JSON.stringify(V0)), { hece: V0.hece });
const yut = read('labs/dkt/dkt-yutma.js');
const ses = read('labs/dkt/dkt-ses.js');
const ak = read('labs/dkt/dkt-akicilik.js');
const html = read('labs/dkt/index.html');
const dash = read('dashboard.html');
const medlab = read('js/acadex-medlab.js');
const acadia = read('js/acadex-medlab-acadia.js');
const fn = (src, head) => { const i = src.indexOf(head); assert.ok(i >= 0, head); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } throw new Error(head); };

test('Türkçe ünsüzler: 20 sesbirim, yer ve biçim tabloda tanımlı', () => {
  assert.equal(V.UNSUZ.length, 20);
  const yer = new Set(V.YER.map((y) => y[0])), bic = new Set(V.BICIM.map((b) => b[0]));
  V.UNSUZ.forEach((u) => { assert.ok(yer.has(u.yer), u.h); assert.ok(bic.has(u.bicim), u.h); });
  const by = Object.fromEntries(V.UNSUZ.map((u) => [u.h, u]));
  assert.equal(by.m.bicim, 'genizsil'); assert.equal(by.k.yer, 'artdamak'); assert.equal(by.h.yer, 'girtlak');
  assert.equal(by.ç.bicim, 'yaripat'); assert.equal(by.c.ot, true); assert.equal(by.ç.ot, false);
  /* ötümlülük eşleri karşılıklı ve ötümlülükleri zıt */
  V.UNSUZ.filter((u) => u.cift).forEach((u) => { const e = by[u.cift]; assert.equal(e.cift, u.h, u.h); assert.notEqual(e.ot, u.ot, u.h); assert.equal(e.yer, u.yer, u.h); });
});

test('Minimal çiftler tek ses farklı; süreç soruları tanımlı süreçlere bağlı', () => {
  V.MINIMAL.forEach((m) => { assert.equal(m[2].replace(m[0], m[1]), m[3], m.join('/')); });
  const s = new Set(V.SUREC.map((x) => x[0]));
  V.SUREC_SORU.forEach((q) => assert.ok(s.has(q.s), q.h));
});

test('PAS 1-8 ve puanlama kuralı (Rosenbek ve ark., 1996)', () => {
  assert.deepEqual(V.PAS.map((p) => p[0]), [1, 2, 3, 4, 5, 6, 7, 8]);
  const c = { }; vm.createContext(c); vm.runInContext(fn(yut, 'var pasScore = function') .replace('var pasScore =', 'this.pasScore ='), c);
  const P = c.pasScore;
  assert.equal(P('yok', 'evet'), 1);
  assert.equal(P('ust', 'evet'), 2); assert.equal(P('ust', 'caba'), 3);
  assert.equal(P('tel', 'evet'), 4); assert.equal(P('tel', 'caba'), 5);
  assert.equal(P('alt', 'evet'), 6); assert.equal(P('alt', 'caba'), 7); assert.equal(P('alt', 'yok'), 8);
});

test('IDDSI şırınga eşikleri ve düzey listesi 0-7', () => {
  assert.deepEqual(V.IDDSI.map((d) => d.n), [0, 1, 2, 3, 4, 5, 6, 7]);
  const c = {}; vm.createContext(c); vm.runInContext(fn(yut, 'var syLevel = function').replace('var syLevel =', 'this.f ='), c);
  assert.equal(c.f(0.3), 0); assert.equal(c.f(2.6), 1); assert.equal(c.f(6.1), 2); assert.equal(c.f(9.4), 3); assert.equal(c.f(null), 4);
});

test('Boston afazi sınıflaması: 8 kombinasyon, her biri tek tür', () => {
  const keys = new Set(V.AFAZI.map((a) => [a.ak, a.an, a.te].join()));
  assert.equal(keys.size, 8);
  const by = Object.fromEntries(V.AFAZI.map((a) => [a.k, a]));
  assert.deepEqual([by.broca.ak, by.broca.an, by.broca.te], [false, true, false]);
  assert.deepEqual([by.wernicke.ak, by.wernicke.an, by.wernicke.te], [true, false, false]);
  assert.deepEqual([by.iletim.ak, by.iletim.an, by.iletim.te], [true, true, false]);
  V.AFAZI_SORU.forEach((q) => assert.ok(by[q.k], q.k));
});

test('%TH: yalnızca kekemeliğe özgü türler; konuşma örneklerinde hece ve anahtar tutarlı', () => {
  const ko = V.TIP.filter((t) => t[2]).map((t) => t[0]).sort();
  assert.deepEqual(ko, ['blok', 'ses', 'soz', 'uzatma']);
  const tips = new Set(V.TIP.map((t) => t[0]));
  V.ORNEK.forEach((o) => {
    o.toks.forEach((t) => { if (t[1]) assert.ok(tips.has(t[1]), t[0]); });
    const hece = o.toks.reduce((a, t) => a + V.hece(t[2] !== undefined ? t[2] : t[0]), 0);
    assert.ok(hece > 80 && hece < 130, o.id + ' ' + hece);
  });
  assert.equal(V.hece('kardeşim'), 3);
  assert.match(ak, /var isKO = function \(k\) \{ return !!\(TIP\[k\] && TIP\[k\]\[2\]\); \}/);
});

test('Vakalar: her bölümde en az bir doğru, tanıda tek doğru', () => {
  assert.ok(V.VAKA.length >= 5);
  V.VAKA.forEach((v) => {
    assert.ok(v.deg.some((o) => o[2]) && v.deg.some((o) => !o[2]), v.id);
    assert.equal(v.tani.filter((o) => o[2]).length, 1, v.id);
    assert.ok(v.terapi.some((o) => o[2]) && v.terapi.some((o) => !o[2]), v.id);
    assert.ok(v.ozet && v.bulgu, v.id);
  });
});

test('Ses laboratuvarı: perde dedektörü sentetik seste doğru, ses cihazdan çıkmaz', () => {
  const c = { Math, Float32Array }; vm.createContext(c);
  vm.runInContext(fn(ses, 'var pitch = function').replace('var pitch =', 'this.pitch ='), c);
  [110, 210, 320].forEach((f) => {
    const sr = 48000, n = 2048, b = new Float32Array(n);
    for (let i = 0; i < n; i++) { const ph = (i * f / sr) % 1; b[i] = 0.5 * (2 * ph - 1); }
    assert.ok(Math.abs(c.pitch(b, sr) - f) < 2, String(f));
  });
  assert.doesNotMatch(ses, /fetch\(|XMLHttpRequest|supabase/);
  assert.match(ses, /echoCancellation: false/);
});

test('MedLab: DKT kartı, lab kaydı, iframe mikrofon izni, Acadia köprüsü', () => {
  assert.match(dash, /data-medlab-open="dkt"/);
  assert.match(dash, /dil ve konuşma terapisi öğrencileri için/);
  assert.match(dash, /allow="fullscreen; microphone"/);
  assert.match(medlab, /dkt: \{ t: 'DKT Lab', src: 'labs\/dkt\/index\.html' \}/);
  assert.match(acadia, /dkt: 'DKT Lab'/);
  assert.match(acadia, /dkt: 'dil ve konuşma terapisi öğrencisine'/);
  assert.match(read('labs/dkt/dkt-app.js'), /m\.lab = 'dkt'/);
  assert.match(html, /<script src="dkt-veri\.js"><\/script>/);
});

test('MedLab başlığı sağlık bilimleri; Fizyo Lab fizyoterapi öğrencileri için', () => {
  assert.match(dash, /sağlık bilimleri için kurulmuş laboratuvarlar/);
  assert.doesNotMatch(dash, /tıp fakültesi için kurulmuş laboratuvarlar/);
  const i = dash.indexOf('data-medlab-open="fizyo"'), j = dash.indexOf('</button>', i);
  assert.match(dash.slice(i, j), /<span class="axm-lab-for hand">fizyoterapi öğrencileri için<\/span>/);
});

summary();
