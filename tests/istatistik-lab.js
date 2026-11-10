/* ==========================================================================
   ACADEX — İSTATİSTİK GİRİŞ DERSİ (tests/istatistik-lab.js)

   NEDEN VAR (11.11.2026; bahar dönemi, Veri Hoca, özet kartı ve sınav provası 12.11.2026): Finans panelinin altındaki eski istatistik gözlemevi
   (labs/istatistik/) kaldırıldı; yerine ders notlarının (Statistics for Business I,
   güz) sırasıyla haftalık ders yolu geldi: labs/istat/. Her hafta = animasyonlu
   anlatım sahneleri + etkileşimli görsel + yeni nesil sorular. Bu test şunları tutar:
     - 14 güz haftası notlardaki sırayla (1–7, ara sınav, 9–15); her haftada en az
       5 sahne, bir görsel atölye ve 5 soru
     - soru üreticileri 150 farklı tohumda geçerli: seçenekler tekrar etmez, doğru
       cevap seçeneklerin içinde, sayısal cevap sonlu, çözüm adımları var, metinde
       NaN / undefined yok
     - matematik çekirdeği notlardaki örneklerin sonuçlarını verir (z tablosu,
       binom, Poisson, hipergeometrik, varyans, çeyrek)
     - cevap ayrıştırma: virgül, nokta, binlik ayracı, kesir (3/8)
     - hub bağlantısı: panelde 14 hafta düğmesi + ders yolu, istat- açılış anahtarı
       labs/istat/index.html'e gider, düğmeler liman gemisine girmez; Acadia'da lab adı;
       lab ağ isteği yapmaz
   Çalıştırma:  node tests/istatistik-lab.js
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
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || '') + ' ' + a + ' ≠ ' + b);

const FILES = ['ist-core.js', 'ist-h1.js', 'ist-h2.js', 'ist-h3.js', 'ist-h4.js', 'ist-h5.js', 'ist-h6.js', 'ist-h7.js', 'ist-h8.js', 'ist-ozet.js'];
const win = { location: { search: '', origin: 'https://acadex.com.tr', href: 'https://acadex.com.tr/labs/istat/' }, matchMedia: () => ({ matches: false }), addEventListener() {} };
win.parent = win;
const ctx = { window: win, document: { addEventListener() {} }, location: win.location, Math, JSON, Date, isFinite, isNaN, parseFloat, Number, String, Array, Object, URL };
vm.createContext(ctx);
FILES.forEach((f) => vm.runInContext(read('labs/istat/' + f), ctx, { filename: f }));
const IST = win.IST, M = IST.M;

test('27 hafta notlardaki sırayla (güz 1–7, 9–15; bahar 1–7, 9–14); her hafta anlatım + görsel + sorular + özet', () => {
  assert.deepEqual([...IST.H.map((h) => h.id)].sort(), ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g9', 'g10', 'g11', 'g12', 'g13', 'g14', 'g15', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b9', 'b10', 'b11', 'b12', 'b13', 'b14'].sort());
  const en = { g1: /Basic Outlook to Statistics 1/, g2: /Basic Outlook to Statistics 2/, g3: /^Data$/, g4: /Graphical/, g5: /Central Tendency Measures I$/, g6: /Central Tendency Measures II/, g7: /^Probability$/, g9: /Variability/, g10: /Discrete PD/, g11: /Binomial and Poisson/, g12: /Hypergeometric/, g13: /Continuous PD 1/, g14: /Uniform and Exponential/, g15: /Normal/,
    b1: /Sampling Methods/, b2: /Point Estimation/, b3: /Interval Estimation/, b4: /^One Sample Hypothesis Testing$/, b5: /One Sample Hypothesis Testing 2/, b6: /Two Samples/, b7: /ANOVA/, b9: /Correlation/, b10: /Regression/, b11: /Non-Parametric Statistics I$/, b12: /Non-Parametric Statistics II/, b13: /Index Numbers/, b14: /Decision Theory/ };
  IST.H.forEach((h) => {
    assert.match(h.en, en[h.id], h.id + ' İngilizce adı notlarla aynı');
    assert.ok(h.sahneler.length >= 5, h.id + ' en az 5 sahne');
    assert.equal(typeof h.gorsel.kur, 'function');
    assert.equal(h.no, +h.id.slice(1)); assert.equal(h.donem, h.id[0] === 'b' ? 'bahar' : 'guz');
    const o = IST.OZET[h.id]; assert.ok(o && o.m.length >= 3 && o.f.length >= 1, h.id + ' özet kartı');
  });
  /* sınav provaları yalnızca var olan haftalara bakar; her hafta bir provada */
  const pv = [].concat(...Array.from(IST.PROVA, (p) => Array.from(p.hf)));
  assert.deepEqual(pv.sort(), Array.from(IST.H, (h) => h.id).sort());
  assert.match(IST.hoca(), /class="hoca"/); assert.doesNotMatch(read('labs/istat/ist-core.js') + read('labs/istat/index.html'), /Ali İhsan|Çetin/i, 'anlatıcı kurgusal');
});

test('anlatım sahneleri: her sahne görsel üretir, terimler Türkçe + İngilizce', () => {
  IST.H.forEach((h) => h.sahneler.forEach((s, i) => {
    const v = typeof s.v === 'function' ? s.v() : s.v;
    assert.ok(/<svg|<table|class="kt"|class="fx"/.test(v), h.id + ' sahne ' + i + ' görsel yok');
    assert.doesNotMatch(v + s.t, /NaN|undefined|Infinity/, h.id + ' sahne ' + i);
    (s.terim || []).forEach((t) => assert.ok(t[0] && t[1], h.id + ' terim çifti'));
  }));
  assert.ok(IST.H.every((h) => h.sahneler.some((s) => s.terim && s.terim.length)), 'her haftada İngilizce terim');
});

test('yeni nesil soru üreticileri 150 tohumda geçerli', () => {
  IST.H.forEach((h) => {
    for (let seed = 1; seed <= 150; seed++) {
      const L = h.sorular(IST.rng(seed * 7919 + h.no));
      assert.equal(L.length, 5, h.id + ' 5 soru');
      L.forEach((q, i) => {
        const id = h.id + ' #' + i + ' tohum ' + seed;
        if (q.o) {
          assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length, id + ' doğru seçenek');
          assert.equal(new Set(q.o).size, q.o.length, id + ' tekrar eden seçenek: ' + q.o.join(' | '));
        } else {
          assert.ok(Number.isFinite(q.say), id + ' sayısal cevap ' + q.say);
          assert.ok(q.goster, id + ' gösterilecek cevap');
        }
        assert.ok(q.ip && q.cz && q.cz.length, id + ' ipucu ve çözüm');
        assert.doesNotMatch(q.q + (q.g || '') + q.cz.join('') + q.ip + (q.o || []).join(''), /NaN|undefined|Infinity|−0(?![,\d])/, id);
      });
    }
  });
});

test('matematik çekirdeği notlardaki örnekleri verir', () => {
  assert.equal(M.ztab(1.25), 0.3944); assert.equal(M.ztab(1.5), 0.4332); assert.equal(M.ztab(1), 0.3413); assert.equal(M.ztab(1.96), 0.475);
  near(M.binom(2, 3, 0.5), 0.375, 1e-12, '3 parada 2 yazı');
  near(M.binom(2, 4, 0.1), 0.0486, 1e-9, 'basketbol P(X=2)');
  near(1 - Math.pow(0.9, 4), 0.3439, 1e-9);
  near(M.pois(5, 6), 0.1606, 5e-5, 'çağrı merkezi'); near(M.pois(2, 1), 0.1839, 5e-5); near(M.pois(0, 2.5), 0.0821, 5e-5);
  near(M.hyper(4, 100, 60, 4), 0.1244, 5e-5, 'istatistik sınıfı');
  near(1 - M.hyper(0, 400, 20, 5), 0.2272, 5e-5, 'toptancı reddi');
  assert.equal(M.varS([2, 4, 4, 7, 13]), 18.5);
  assert.equal(M.median([12, 13, 14, 14, 15, 15, 16, 16, 16, 16, 17, 17, 18, 19, 20, 21, 21, 22, 23, 24, 25, 26, 28, 29]), 17.5);
  assert.deepEqual([...M.modes([3, 1, 3, 2, 10, 9, 3, 10, 3, 4])], [3]);
  const d = [12, 15, 17, 18, 20, 21, 23, 24, 26, 30, 41];
  assert.equal(M.pct(d, 0.25), 17); assert.equal(M.pct(d, 0.75), 26);
  assert.equal(M.C(100, 4), 3921225); assert.equal(M.C(5, 2), 10);
  /* bahar: t, ki-kare, F tabloları ve notlardaki örnekler */
  assert.equal(M.tkr(0.025, 9), 2.262); assert.equal(M.tkr(0.005, 8), 3.355); assert.equal(M.tkr(0.05, 11), 1.796); assert.equal(M.c2kr(0.05, 3), 7.815); assert.equal(M.c2kr(0.05, 14), 23.685); assert.equal(M.fkr(0.05, 2, 12), 3.89);
  const A = IST.anova([[254, 263, 241, 237, 251], [234, 218, 235, 227, 216], [200, 222, 197, 206, 204]]);
  near(A.ssb, 4716.4, 1e-6, 'golf SSB'); near(A.ssw, 1119.6, 1e-6, 'golf SSW'); near(A.F, 25.27, 0.01, 'golf F');
  near(M.r([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-12); assert.deepEqual([...M.rank([10, 10, 10, 3, 5, 12])], [4, 4, 4, 1, 2, 6]);
  let p = 0; for (let k = 15; k <= 20; k++) p += M.binom(k, 20, 0.5); near(p, 0.0207, 5e-5, 'binom testi 15/20');
  near(M.Phi(0), 0.5, 1e-9); near(M.zinv(0.95), 1.6449, 1e-3);
});

test('cevap ayrıştırma ve Türkçe sayı biçimi', () => {
  assert.equal(IST.parse('0,25'), 0.25); assert.equal(IST.parse('0.25'), 0.25); assert.equal(IST.parse('3/8'), 0.375);
  assert.equal(IST.parse('1.234,5'), 1234.5); assert.equal(IST.parse(' −2,5 '), -2.5); assert.equal(IST.parse('%32,7'.replace('%', '')), 32.7);
  assert.ok(Number.isNaN(IST.parse('')));
  assert.equal(IST.nf(1234.5, 1), '1.234,5'); assert.equal(IST.nf(0.3944, 4), '0,3944'); assert.equal(IST.nf(0.25, 3, false), '0,250'); assert.equal(IST.nf(-0.5, 1), '−0,5');
});

test('hub: panel düğmeleri, açılış anahtarı, liman, Acadia; ağ isteği yok', () => {
  const html = read('dashboard.html'), fin = read('js/acadex-finans.js'), aca = read('js/acadex-medlab-acadia.js'), idx = read('labs/istat/index.html');
  const keys = [...html.matchAll(/<button[^>]*data-finans-open="(istat-[a-z0-9]+)"[^>]*>/g)];
  assert.deepEqual(keys.map((m) => m[1]).sort(), ['istat-yol'].concat(IST.H.map((h) => 'istat-' + h.id)).sort(), 'panelde 27 hafta + ders yolu');
  assert.ok(keys.every((m) => /data-lm-skip/.test(m[0])));
  assert.match(fin, /labOf\(k\) === 'istat'\) \{ var u = k\.slice\(6\); return IST\[u\] \? \{ lab: 'istat', tab: u, src: 'labs\/istat\/index\.html'/);
  const IKEYS = Object.keys(new Function(fin.slice(fin.indexOf('var IST = '), fin.indexOf(';', fin.indexOf('var IST = '))) + '; return IST;')());
  assert.deepEqual(IKEYS.sort(), ['yol'].concat(IST.H.map((h) => h.id)).sort());
  assert.match(aca, /istat: 'Acadex İstatistik'/); assert.match(aca, /lab === 'istat' \?/);
  assert.match(idx, /axf-embed/); FILES.forEach((f) => assert.match(idx, new RegExp('<script src="' + f.replace('.', '\\.') + '"></script>')));
  assert.match(html, /<section class="axf-ist land" aria-labelledby="axf-ist-t">[\s\S]*<p class="axf-cite mono">/);
  assert.doesNotMatch(html + fin, /labs\/istatistik\//, 'eski gözlemevine bağlantı kalmadı');
  FILES.forEach((f) => assert.doesNotMatch(read('labs/istat/' + f), /fetch\(|XMLHttpRequest|supabase|localStorage\.clear/, f));
  assert.match(read('labs/istat/ist-core.js'), /m\.src = 'axlab'; m\.lab = 'istat'/);
  assert.match(read('labs/istat/ist.css'), /@media \(prefers-reduced-motion:reduce\)/);
});

summary();
