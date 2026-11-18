/* ==========================================================================
   ACADEX — İSTATİSTİK: OLASILIK VE BİNOM EKİ (tests/istat-olasilik.js), 18.11.2026

   NEDEN VAR: 7. hafta (Olasılık) ve 11. hafta (Binom ve Poisson) genişledi
   (labs/istat/ist-olasilik.js): Bayes filmi, Tablo ↔ Venn ↔ Ağaç çevirici, Basketçi,
   yeni sahneler, yanılgı yakalayıcı yeni nesil sorular ve rehberli seri (azalan yardım).
   Bu dosya şunları korur:
     - yeni soruların cevabı bağımsız hesapla aynı; yanlış şık / yaygın hatalı sayı
       doğru yanılgı açıklamasını alır (P(B|A) karıştırma, tek dizilim, “en az” ≠ “tam”)
     - her sette 5 soru, en az ikisi yeni şablonlardan
     - rehberli serinin her adımının gösterilen cevabı kendi sayısıyla tutarlı
     - ek, tahmin kartlarından sonra yüklenir ve soru sayfasında rehber kancası var
   Tarayıcıda (Playwright, masaüstü + telefon) denendi.
   Çalıştırma:  node tests/istat-olasilik.js
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
const FILES = ['ist-core.js', 'ist-sahne.js', 'ist-h1.js', 'ist-h2.js', 'ist-h3.js', 'ist-h4.js', 'ist-h5.js', 'ist-h6.js', 'ist-h7.js', 'ist-h8.js', 'ist-ozet.js', 'ist-tahmin.js', 'ist-olasilik.js'];
const win = { location: { search: '', origin: 'https://acadex.com.tr', href: 'https://acadex.com.tr/labs/istat/' }, matchMedia: () => ({ matches: false }), addEventListener() {} };
win.parent = win;
const ctx = { window: win, document: { addEventListener() {} }, location: win.location, Math, JSON, Date, isFinite, isNaN, parseFloat, Number, String, Array, Object, URL };
vm.createContext(ctx);
FILES.forEach((f) => vm.runInContext(read('labs/istat/' + f), ctx, { filename: f }));
const IST = win.IST, M = IST.M, EK = IST.EK_OLASILIK;
const sayi = (s) => IST.parse(String(s).replace(/<[^>]+>/g, ''));
const duz = (h) => String(h).replace(/<[^>]+>/g, ' ');

test('yollar: C(n, k) farklı dizilim, her birinde tam k kaçırma', () => {
  for (let n = 1; n <= 8; n++) for (let k = 0; k <= n; k++) {
    const L = Array.from(EK.yollar(n, k));
    assert.equal(L.length, M.C(n, k), n + ',' + k); assert.equal(new Set(L).size, L.length);
    L.forEach((y) => assert.equal(y.split('').filter((c) => c === '0').length, k));
  }
});
test('7. hafta yeni sorular: cevaplar doğru, yanılgılar yakalanır', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const L = EK.g7Yeni(IST.rng(seed));
    assert.equal(L.length, 4);
    const [bay, kos, bag, enaz] = L;
    /* Bayes: soru metnindeki yüzdelerden bağımsız hesap */
    const m = duz(bay.q).match(/%(\d+)/g).map((x) => +x.slice(1)); const [prev, se, fpr] = m, h = 10 * prev, tp = Math.round(h * se / 100), fp = Math.round((1000 - h) * fpr / 100);
    assert.ok(Math.abs(bay.say - tp / (tp + fp)) < 1e-12, 'Bayes ' + seed);
    assert.match(bay.yanlis(se / 100), /duyarlılık/); assert.match(bay.yanlis(prev / 100), /taban oranı/);
    for (let k = 0; k <= bay.cz.length; k++) assert.doesNotMatch(bay.viz(k), /NaN|undefined/);
    /* koşullu: doğru şık P(A|B), yanlış şıkların açıklaması var, şıklar tek */
    assert.equal(new Set(kos.o).size, 4); assert.equal(kos.a, 0);
    const td = [...kos.g.matchAll(/<td[^>]*>(\d+)<\/td>/g)].map((x) => +x[1]); /* ab, aB, gA, Ab, AB, ..., gB, ..., tt */
    assert.equal(kos.o[0], IST.nf(td[0] / (td[0] + td[3]), 4)); assert.match(kos.yn[1], /ters çevirdin/); assert.match(kos.yn[2], /P\(A ∩ B\)/);
    /* bağımsız / ayrık: doğru şık sayılarla tutarlı */
    const [pa, pb, pab] = [...duz(bag.q).matchAll(/=\s+(\d+(?:,\d+)?)/g)].map((x) => +x[1].replace(',', '.'));
    const beklenen = pab === 0 ? 1 : Math.abs(pab - pa * pb) < 0.005 ? 0 : 2;
    assert.equal(bag.a, beklenen, 'bağımsız/ayrık ' + seed + ' ' + [pa, pb, pab]);
    /* en az bir: toplama hatası yakalanır */
    const k = +duz(enaz.q).match(/girişimci (\d)/)[1], p = +duz(enaz.q).match(/olasılığı[^\d]*(\d+(?:,\d+)?)/)[1].replace(',', '.');
    assert.ok(Math.abs(enaz.say - (1 - Math.pow(1 - p, k))) < 1e-12);
    assert.match(enaz.yanlis(Math.min(1, k * p)), /topladın/); assert.match(enaz.yanlis(Math.pow(p, k)), /hepsinin/);
  }
});
test('11. hafta yeni sorular: binom cevapları doğru, tek dizilim / tam-en az karışıklığı yakalanır', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const [bas, sik, kal, oku] = EK.g11Yeni(IST.rng(seed));
    const t = duz(bas.q), p = +t.match(/%(\d+)/)[1] / 100, n = +t.match(/Maçta\s+(\d+)/)[1], k = +t.match(/tam\s+(\d+)/)[1], q = Math.round((1 - p) * 100) / 100;
    assert.ok(Math.abs(bas.say - M.binom(k, n, q)) < 1e-12, 'basketçi ' + seed);
    assert.match(bas.yanlis(Math.pow(q, k) * Math.pow(p, n - k)), /bir dizilimin/); assert.match(bas.yanlis(M.binom(k, n, p)), /karıştırdın/);
    const ns = +duz(sik.q).match(/(\d+)\s+soruluk/)[1], s = +duz(sik.q).match(/(\d)\s+şıklı/)[1], ke = +duz(sik.q).match(/En az\s+(\d)/)[1];
    let cdf = 0; for (let i = 0; i < ke; i++) cdf += M.binom(i, ns, 1 / s);
    assert.ok(Math.abs(sik.say - (1 - cdf)) < 1e-12); assert.match(sik.yanlis(M.binom(ke, ns, 1 / s)), /tek değer değildir/);
    const nk = +duz(kal.q).match(/rastgele\s+(\d+)/)[1], pk = +duz(kal.q).match(/%(\d+)/)[1] / 100;
    assert.ok(Math.abs(kal.say - M.binom(0, nk, pk) - M.binom(1, nk, pk)) < 1e-12); assert.match(kal.yanlis(M.binom(1, nk, pk)), /0 ya da 1/);
    assert.equal(new Set(oku.o).size, 4); assert.equal(oku.yn[oku.a], null);
    const ifade = duz(oku.q).match(/sayısının\s+(.+?)\s+olma/)[1];
    const isr = /^en az/.test(ifade) ? '≥' : /^en fazla/.test(ifade) ? '≤' : /fazla$/.test(ifade) ? '>' : '<';
    if (!/^en/.test(ifade)) assert.match(ifade, /^(2’den|[345]’ten) (az|fazla)$/, 'Türkçe ek uyumu: ' + ifade);
    assert.ok(oku.o[oku.a].includes(isr), ifade + ' → ' + oku.o[oku.a]);
  }
});
test('her sette 5 soru, en az ikisi yeni şablonlardan', () => {
  const yeni = /Bayes|koşullu|kavram|binom|en az|en fazla|okuma/;
  ['g7', 'g11'].forEach((id) => {
    for (let seed = 1; seed <= 200; seed++) {
      const L = IST.by[id].sorular(IST.rng(seed * 13));
      assert.equal(L.length, 5);
      const tags = L.map((q) => q.tag || '');
      const eskiT = IST.by[id] && tags.filter((t) => /senaryo · |tablo · |kavram|okuma/.test(t)).length;
      assert.ok(eskiT >= 2, id + ' ' + seed + ' yeni şablon sayısı: ' + tags.join(' | '));
    }
  });
});
test('rehberli seri: her adımın gösterilen cevabı kendi sayısıyla aynı; en az iki adım', () => {
  [['R7', EK.R7], ['R11', EK.R11]].forEach(([ad, L]) => L.forEach((f, i) => {
    for (let seed = 1; seed <= 200; seed++) {
      const T = f(IST.rng(seed));
      assert.ok(T.adim.length >= 2 && T.q, ad + i);
      T.adim.forEach((a, j) => { const tol = a.tol != null ? a.tol : 0.0051; assert.ok(Math.abs(sayi(a.goster) - a.say) <= tol, ad + i + ' adım ' + j + ': ' + a.goster + ' ≠ ' + a.say); assert.doesNotMatch(a.t + a.goster + T.q + (T.g || ''), /NaN|undefined|Infinity/); });
    }
  }));
  assert.equal(IST.by.g7.rehber, EK.R7); assert.equal(IST.by.g11.rehber, EK.R11);
});
test('yükleme ve kancalar: tahminlerden sonra; soru sayfasında rehber; atölyede yeni sekmeler', () => {
  const idx = read('labs/istat/index.html'), core = read('labs/istat/ist-core.js'), ek = read('labs/istat/ist-olasilik.js'), css = read('labs/istat/ist.css');
  assert.ok(idx.indexOf('<script src="ist-olasilik.js"></script>') > idx.indexOf('<script src="ist-tahmin.js"></script>'));
  assert.match(core, /if \(H\.rehber && IST\.rehber\) lsafe\(function \(\) \{ IST\.rehber\(H, body\.querySelector\('\[data-rehber\]'\)\); \}\);/);
  assert.match(ek, /sekmeEkle\(g7, 'Venn ve zar', \[\['bayes', 'Bayes filmi', bayesFilm\], \['cevir', 'Tablo ↔ Venn ↔ Ağaç', cevirici\]\]\)/);
  assert.match(ek, /sekmeEkle\(g11, 'Binom ve Poisson gezgini', \[\['basket', 'Basketçi', basketci\]\]\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.bf-n,\.bf-form span,\.vb\{transition:none\}\}/);
  assert.doesNotMatch(ek, /https?:\/\/(?!www\.w3\.org)/, 'ağ isteği yok');
  assert.ok(IST.by.g7.sahneler.some((s) => /1000 kişiyle/.test(s.b)) && IST.by.g11.sahneler.some((s) => /10 farklı yol/.test(s.b)));
});
summary();
