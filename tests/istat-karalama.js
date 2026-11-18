/* ==========================================================================
   ACADEX — İSTATİSTİK: KARALAMA KAĞIDI VE ÇÖZÜM ANİMASYONLARI (tests/istat-karalama.js), 18.11.2026

   NEDEN VAR: labs/istat/ist-karalama.js her soru kartına karalama kağıdı (kalem/parmak/fare)
   ekler; tablo okuma animasyonu (IST.tabloOku), eğri önizlemesi (IST.egriOnizle) verir.
   ist-klasik.js klasik sınavda “▶ çözümü oynat” (formül → yerine koy → sonuç), canlı ağaç
   (IST.agacSvg) ve z / t eğri önizlemesi kullanır. Bu dosya şunları korur:
     - ist-karalama.js sayfada ist-klasik.js'ten sonra, IST.start()'tan önce yükleniyor
     - karalama otomatik olarak üç kart türüne (haftalık, prova, klasik) ekleniyor
     - her sayısal problem adımında “yerine koy” metni (yk) var, sayı içeriyor, NaN yok
     - tablo adımlarında okunacak değer (z ya da sd + α) tanımlı ve tabloda adımın sonucu çıkıyor
     - eğri önizlemesi olan problemlerde önizlenen adım z / t değeri
     - ağaç ve eğri çizimleri NaN içermiyor, boş değerde kılavuz yazısı gösteriyor
     - azaltılmış hareket tercihinde animasyonlar kapanıyor; yazdırmada gizleniyor
   Tarayıcıda (Playwright, masaüstü + telefon) denendi.
   Çalıştırma:  node tests/istat-karalama.js
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
const FILES = ['ist-core.js', 'ist-sahne.js', 'ist-h1.js', 'ist-h2.js', 'ist-h3.js', 'ist-h4.js', 'ist-h5.js', 'ist-h6.js', 'ist-h7.js', 'ist-h8.js', 'ist-ozet.js', 'ist-tahmin.js', 'ist-olasilik.js', 'ist-klasik-banka.js', 'ist-klasik.js', 'ist-karalama.js'];
const win = { location: { search: '', origin: 'https://acadex.com.tr', href: 'https://acadex.com.tr/labs/istat/' }, matchMedia: () => ({ matches: false }), addEventListener() {} };
win.parent = win;
const ctx = { window: win, document: { addEventListener() {}, readyState: 'complete', getElementById: () => null }, location: win.location, Math, JSON, Date, isFinite, isNaN, parseFloat, Number, String, Array, Object, URL };
vm.createContext(ctx);
FILES.forEach((f) => vm.runInContext(read('labs/istat/' + f), ctx, { filename: f }));
const IST = win.IST, M = IST.M, S = IST.KLASIK_SAYISAL;
const html = read('labs/istat/index.html'), js = read('labs/istat/ist-karalama.js'), kl = read('labs/istat/ist-klasik.js'), css = read('labs/istat/ist.css');

test('sayfa: ist-karalama.js, ist-klasik.js ile IST.start() arasında', () => {
  const a = html.indexOf('src="ist-klasik.js"'), b = html.indexOf('src="ist-karalama.js"'), c = html.indexOf('IST.start()');
  assert.ok(a > 0 && b > a && c > b, [a, b, c].join(','));
  assert.equal(typeof IST.karalama, 'function'); assert.equal(typeof IST.tabloOku, 'function'); assert.equal(typeof IST.egriOnizle, 'function'); assert.equal(typeof IST.agacSvg, 'function');
});

test('karalama: üç kart türü, kalem varken avuç içi yok sayılır, araçlar', () => {
  ['.is-sor .q', '.is-prova .q', '.ks-q'].forEach((s) => assert.ok(js.includes(s), s));
  assert.match(js, /pointerType === 'touch' && S\.kalemVar\) return/);
  assert.match(js, /touch-action:none/.test(css) ? /./ : /x^/);
  ['data-geri', 'data-temiz', 'data-sil', 'data-buyut', 'data-kal'].forEach((s) => assert.ok(js.includes(s), s));
  assert.ok(!/localStorage|fetch\(|XMLHttpRequest/.test(js), 'ağ ya da kalıcı depolama yok');
});

test('her sayısal problem: adımlar sonlu, yerine koy metni sayı içeriyor (200 tohum)', () => {
  Object.keys(S).forEach((h) => {
    for (let t = 1; t <= 200; t++) {
      const Q = S[h](IST.rng(t * 7919 + h.length));
      Q.adim.forEach((a, j) => {
        assert.ok(isFinite(a.say), h + ' #' + t + ' adım ' + j);
        assert.ok(typeof a.yk === 'string' && /\d/.test(a.yk) && !/NaN|undefined/.test(a.yk), h + ' yk: ' + a.yk);
      });
    }
  });
});

test('tablo adımları: okunacak değer tanımlı ve tablo sonucu adımın cevabı', () => {
  let n = 0;
  Object.keys(S).forEach((h) => {
    for (let t = 1; t <= 120; t++) {
      const Q = S[h](IST.rng(t * 104729 + h.length));
      Q.adim.forEach((a) => {
        if (!a.tablo) return; n++;
        if (a.tablo === 'z') { const z = a.tz != null ? a.tz : a.say; /* ileri okuma: z → alan; ters okuma (b3): alan → z, hücre yine z'nin hücresi */
          assert.ok(a.tz != null && (Math.abs(M.ztab(Math.abs(z)) - a.say) < 6e-4 || a.say === a.tz), h + ' z ' + z + ' → ' + a.say); }
        else {
          assert.ok(Number.isInteger(a.sd) && a.sd >= 1 && a.sd <= 30, h + ' sd ' + a.sd);
          assert.ok([0.10, 0.05, 0.025, 0.01, 0.005].includes(a.ta), h + ' α ' + a.ta);
          const kr = a.tablo === 't' ? M.tkr(a.ta, a.sd) : M.c2kr(a.ta, a.sd);
          assert.ok(Math.abs(kr - a.say) < 1e-6, h + ' ' + a.tablo + ' ' + kr + ' vs ' + a.say);
        }
      });
    }
  });
  assert.ok(n > 50, 'tablo adımı sayısı ' + n);
});

test('eğri önizlemesi: işaretli adım z / t ve çizim NaN içermiyor', () => {
  let n = 0;
  Object.keys(S).forEach((h) => {
    for (let t = 1; t <= 60; t++) {
      const Q = S[h](IST.rng(t * 31 + h.length)); if (!Q.egri) continue; n++;
      const e = Q.egri, a = Q.adim[e.adim];
      assert.ok(a && !a.tablo && isFinite(a.say), h + ' egri adımı');
      assert.ok(['z', 't'].includes(e.tur) && ['sag', 'iki'].includes(e.kuyruk), h);
      if (e.tur === 't') assert.ok(e.sd >= 1, h + ' sd');
      const k = { innerHTML: '' }; IST.egriOnizle(k, { tur: e.tur, deger: a.say, sd: e.sd, kuyruk: e.kuyruk });
      assert.ok(k.innerHTML.includes('<svg') && !/NaN|undefined/.test(k.innerHTML), h);
    }
  });
  assert.ok(n > 20);
  const k = { innerHTML: '' }; IST.egriOnizle(k, { tur: 'z', deger: undefined }); assert.match(k.innerHTML, /yazınca/);
});

test('ağaç çizimi: değerler ve boş dallar NaN üretmiyor; animasyonlu sürüm sıralı', () => {
  const sc = { olay: 'kusurlu', olayD: 'sağlam' };
  const s1 = IST.agacSvg([{ ad: 'A', p: 0.6, k: 0.02 }, { ad: 'B', p: 0.4, k: 0.05 }], sc, false);
  assert.ok(s1.includes('<svg') && !/NaN|undefined/.test(s1)); assert.ok(s1.includes('0,012'), 'yaprak çarpımı');
  const s2 = IST.agacSvg([{ ad: '', p: NaN, k: NaN }], sc, true);
  assert.ok(!/NaN|undefined/.test(s2)); assert.match(s2, /class="dr"/);
});

test('çözüm animasyonu: oynat / durdur / adım düğmeleri, azaltılmış hareket, yazdırma', () => {
  ['data-oyn', 'data-agoyn', 'data-g', 'data-i', 'data-o', 'mark', 'ks-uc'].forEach((s) => assert.ok(kl.includes(s), s));
  assert.match(kl, /prefers-reduced-motion/); assert.match(js, /prefers-reduced-motion/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.ks-cz-li\.yeni/);
  assert.match(css, /@media print\{\.kr,\.ks-czd,\.ks-cz,\.ks-egri\{display:none/);
  assert.ok(!/Ali İhsan|Çetin/.test(js + html));
});

summary();
