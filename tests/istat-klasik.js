/* ==========================================================================
   ACADEX — İSTATİSTİK: KLASİK SINAV VE FORMÜL KAĞIDI (tests/istat-klasik.js), 18.11.2026

   NEDEN VAR: labs/istat/ist-klasik.js ve ist-klasik-banka.js: 15 soruluk klasik sınav
   (tanım/boşluk, doğru-yanlış, terim, tablo tamamlama, formül → yerine koy → sonuç,
   z / t / χ² tablosundan okuma, olasılık ağacı kurucu) ve bütün formüllerin tek kağıdı.
   Bu dosya şunları korur:
     - her kapsam (güz/bahar vize/final) 200 tohumda 15 soru, en fazla 6 problem, haftalar karışık
     - her problemin formülü formül kağıdında var; adımlar sonlu sayı; tablo adımları
       tablodaki değerle aynı (z: P(0<Z<z), t ve χ² kritik değerleri)
     - sözel bankada her boşlukta tek “____” ve en az bir kabul edilen cevap
     - cevap karşılaştırma Türkçe harf ve büyük/küçük harften bağımsız
     - ağaç puanı: doğru ağaç tam puan, eksik dal kısmi puan
     - ders yolunda klasik sınavlar ve formül kağıdı; ağ isteği yok
   Tarayıcıda (Playwright, masaüstü + telefon) denendi.
   Çalıştırma:  node tests/istat-klasik.js
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
const FILES = ['ist-core.js', 'ist-sahne.js', 'ist-h1.js', 'ist-h2.js', 'ist-h3.js', 'ist-h4.js', 'ist-h5.js', 'ist-h6.js', 'ist-h7.js', 'ist-h8.js', 'ist-ozet.js', 'ist-tahmin.js', 'ist-olasilik.js', 'ist-klasik-banka.js', 'ist-klasik.js'];
const win = { location: { search: '', origin: 'https://acadex.com.tr', href: 'https://acadex.com.tr/labs/istat/' }, matchMedia: () => ({ matches: false }), addEventListener() {} };
win.parent = win;
const ctx = { window: win, document: { addEventListener() {} }, location: win.location, Math, JSON, Date, isFinite, isNaN, parseFloat, Number, String, Array, Object, URL };
vm.createContext(ctx);
FILES.forEach((f) => vm.runInContext(read('labs/istat/' + f), ctx, { filename: f }));
const IST = win.IST, M = IST.M, T = IST.KLASIK_TEST;
IST.H.sort((a, b) => (a.donem === b.donem ? 0 : a.donem === 'guz' ? -1 : 1) || a.no - b.no);

test('sözel banka: her hafta için tanım ve doğru/yanlış; boşlukta tek “____”', () => {
  IST.H.forEach((H) => {
    const B = IST.KLASIK[H.id]; assert.ok(B && B.t.length >= 2 && B.dy.length >= 2, H.id);
    B.t.forEach((q) => { assert.equal(q[0].split('____').length, 2, H.id + ': ' + q[0]); assert.ok(q[1].length >= 1); });
    B.dy.forEach((q) => { assert.equal(typeof q[1], 'boolean'); assert.ok(q[2].length > 8, H.id + ' açıklama'); });
    const dogru = B.dy.filter((q) => q[1]).length; assert.ok(dogru >= 1 && dogru < B.dy.length || B.dy.length < 3, H.id + ' hem doğru hem yanlış ifade');
  });
});
test('her kapsamda 200 tohumda 15 soru; en fazla 6 problem; puanlar ve formüller tutarlı', () => {
  IST.KLASIK_SINAV.forEach((P) => {
    for (let seed = 1; seed <= 200; seed++) {
      const L = IST.sinavKur(P.hf, IST.rng(seed * 977 + 3));
      assert.equal(L.length, 15, P.id + ' ' + seed);
      assert.ok(L.every((q) => P.hf.includes(q.hafta)), P.id + ' kapsam dışı soru');
      const prob = L.filter((q) => ['sayisal', 'agac', 'tablo'].includes(q.tip)); assert.ok(prob.length <= 6);
      assert.ok(L.filter((q) => q.tip === 'bosluk').length >= 3 && L.filter((q) => q.tip === 'dy').length >= 2, P.id + ' sözel karışım');
      assert.ok(new Set(L.map((q) => q.hafta)).size >= Math.min(4, P.hf.length), P.id + ' haftalar dengeli');
      L.forEach((q) => {
        assert.ok(q.puan > 0, q.tip);
        if (q.tip === 'sayisal') {
          assert.ok(IST.formulBul(q.hafta, q.f), q.hafta + ' formülü kağıtta yok: ' + q.f);
          q.adim.forEach((a) => assert.ok(Number.isFinite(a.say), q.hafta + ' ' + a.t));
          assert.doesNotMatch(q.soru + (q.g || '') + q.adim.map((a) => a.t).join(''), /NaN|undefined|Infinity/);
          if (q.karar) assert.ok(q.karar.a >= 0 && q.karar.a < q.karar.o.length);
          const sec = T.formulSecenek(q, IST.rng(seed)); assert.equal(new Set(sec).size, 4); assert.ok(sec.includes(q.f));
        }
        if (q.tip === 'terim') assert.ok(q.t.en.length >= 3 && q.t.tr && /^(en|tr)$/.test(q.yon));
      });
    }
  });
});
test('tablo adımları tablodaki değerle aynı (z, t, χ²)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const r = () => IST.rng(seed);
    const g15 = IST.KLASIK_SAYISAL.g15(r()), z = g15.adim[0].say; assert.equal(g15.adim[1].tablo, 'z'); assert.equal(g15.adim[1].say, M.ztab(z));
    assert.ok(Math.abs(g15.adim[2].say - (0.5 - M.ztab(z))) < 1e-12);
    const b5 = IST.KLASIK_SAYISAL.b5(r()), sd = +b5.adim[2].t.match(/sd = (\d+)/)[1]; assert.ok(sd >= 1 && sd <= 30, 't tablosunda olan sd');
    const a = /α\/2/.test(b5.adim[2].t) ? +b5.adim[2].t.match(/α\/2 = ([\d,]+)/)[1].replace(',', '.') : +b5.adim[2].t.match(/α = ([\d,]+)/)[1].replace(',', '.');
    assert.equal(b5.adim[2].say, M.tkr(a, sd));
    const red = b5.karar.a === 0, t = b5.adim[1].say; assert.equal(red, /≠/.test(b5.soru) ? Math.abs(t) > b5.adim[2].say : t > b5.adim[2].say);
    const b11 = IST.KLASIK_SAYISAL.b11(r()); assert.equal(b11.adim[2].tablo, 'c2'); const k = (b11.g.match(/Pazartesi|Salı|Çarşamba|Perşembe/g) || []).length; assert.equal(+b11.adim[2].t.match(/sd = (\d)/)[1], k - 1); assert.equal(b11.adim[2].say, M.c2kr(0.05, k - 1));
    const b3 = IST.KLASIK_SAYISAL.b3(r()); assert.ok([1.645, 1.96, 2.576].includes(b3.adim[0].say));
  }
});
test('cevap karşılaştırma: Türkçe harf ve büyük harf fark etmez; kabul listesi', () => {
  assert.deepEqual(Array.from(IST.sayiAday('0.105')).includes(0.105), true, 'noktalı ondalık da okunur'); assert.ok(Array.from(IST.sayiAday('0,105')).includes(0.105)); assert.ok(Array.from(IST.sayiAday('1.234,5')).includes(1234.5));
  assert.ok(IST.metinDogru('  Örnek Uzay ', ['örnek uzay'])); assert.ok(IST.metinDogru('ORNEK UZAY', ['örnek uzay']));
  assert.ok(IST.metinDogru('İstatistik', ['istatistik'])); assert.ok(IST.metinDogru('Mann Whitney U', ['mann–whitney u', 'mann whitney u']));
  assert.ok(IST.metinDogru('n-1', ['n − 1'])); assert.ok(IST.metinDogru('1,96', ['1,96', '1.96'])); assert.ok(!IST.metinDogru('', ['x'])); assert.ok(!IST.metinDogru('medyan', ['mod']));
  assert.equal(T.enTemiz('binomial distribution X ~ B(n, p)'), 'binomial distribution'); assert.equal(T.enTemiz('sample space S'), 'sample space'); assert.equal(T.enTemiz('Student’s t distribution'), 'Student’s t distribution'); assert.equal(T.enTemiz('regression line ŷ = a + bx'), 'regression line'); assert.deepEqual(Array.from(T.enKabul('test statistic z')), ['test statistic z', 'test statistic']);
  assert.deepEqual(Array.from(T.trSecenek('başarı / başarısızlık')).slice(0, 2), ['başarı', 'başarısızlık']);
});
test('ağaç puanı: doğru ağaç 12, eksik dal ve yanlış yaprak kısmi puan', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const Q = T.agacSoru(IST.rng(seed)), k = Q.sc.ad.length;
    const tam = { dal: Q.sc.ad.map((a, i) => ({ ad: a, p: String(Q.pay[i]).replace('.', ','), k: String(Q.oran[i]), kd: String(1 - Q.oran[i]), y: String(Q.pay[i] * Q.oran[i]) })), pk: String(Q.pk), post: String(Q.post) };
    assert.equal(IST.agacPuan(Q, tam).puan, 12, 'tam ağaç ' + seed);
    const eksik = { dal: tam.dal.slice(0, k - 1), pk: tam.pk, post: '0' }, pe = IST.agacPuan(Q, eksik);
    assert.ok(pe.puan > 0 && pe.puan < 12 && !pe.yapi, 'eksik dal kısmi: ' + pe.puan);
    assert.equal(IST.agacPuan(Q, { dal: [], pk: '', post: '' }).puan, 0);
    assert.ok(Math.abs(Q.post - Q.pay[Q.hedef] * Q.oran[Q.hedef] / Q.pk) < 1e-12);
  }
});
test('tablo tamamlama: boşluklar göreli / birikimli frekansla tutarlı', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const Q = T.tabloSoru(IST.rng(seed));
    assert.equal(Q.bos.length, 4); Q.bos.forEach((b) => assert.equal(b.say, b.k === 'g' ? Q.fr[b.i] / Q.n : Q.F[b.i]));
    assert.equal(Q.F[Q.F.length - 1], Q.n);
  }
});
test('kancalar: ek sayfalar, ders yolu, üst düğme; ağ isteği yok', () => {
  const core = read('labs/istat/ist-core.js'), idx = read('labs/istat/index.html'), k = read('labs/istat/ist-klasik.js') + read('labs/istat/ist-klasik-banka.js');
  assert.match(core, /else if \(SY\) SY\(main, crumb\);/); assert.match(core, /prova\('g'\) \+ \(IST\.yolEk \? IST\.yolEk\('g'\) : ''\)/);
  assert.ok(idx.indexOf('ist-klasik-banka.js') > idx.indexOf('ist-olasilik.js') && idx.indexOf('ist-klasik.js"') > idx.indexOf('ist-klasik-banka.js') && idx.indexOf('ist-klasik.js"') < idx.indexOf('IST.start()'));
  assert.match(idx, /data-formul aria-label="formül kağıdı">📐<span class="ks-fbt"> formül kağıdı<\/span><\/button>/);
  assert.deepEqual(Object.keys(IST.SAYFA).sort(), ['formul', 'ks-bf', 'ks-bv', 'ks-gf', 'ks-gv']);
  assert.match(IST.yolEk('g'), /data-go="ks-gv"/); assert.match(IST.yolEk('b'), /data-go="formul"/);
  assert.doesNotMatch(k, /https?:\/\//); assert.doesNotMatch(k + idx, /Ali İhsan|Çetin/i);
  assert.ok(IST.formulBul('g11', 'Binom') && IST.formulBul('b5', 't testi'));
});
summary();
