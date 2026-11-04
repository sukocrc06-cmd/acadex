/* ==========================================================================
   ACADEX — ACADEX İSTATİSTİK GÖZLEMEVİ (tests/istatistik-lab.js)

   NEDEN VAR (03.11.2026): Acadex Finans paneline istatistik gözlemevi eklendi
   (labs/istatistik/, çekirdek ../finans/fn-app.js, FN_CONF ile; dokuz istasyon).
   Bu test şunları tutar:
     - matematik çekirdeği (is-mat.js) bilinen değerleri verir: normal, t, ki-kare, F
       (ters fonksiyonlar dahil), binom, Poisson, çeyrek (Excel DÖRTTEBİRLİK.DHL = R tip 7),
       örneklem çarpıklığı, regresyon. Referanslar scipy ile hesaplandı.
     - istasyon hesapları: hipotez davaları (t, iki örneklem t, oran z), ki-kare bağımsızlık,
       güven aralığı hata payı, Laspeyres > Paasche (ikame etkisi)
     - Excel formülleri yalnızca gerçek Türkçe Excel işlev adlarını kullanır (uydurma ad yok)
       ve kod kutusunda eksi işareti Excel'in anlayacağı "-" olur
     - hub bağlantısı: dokuz yıldız düğmesi, istat- açılış anahtarı, liman defteri anahtarı,
       Acadia köprüsünde lab adı; lab ağ isteği yapmaz
   Çalıştırma:  node tests/istatistik-lab.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const M = require('../labs/istatistik/is-mat.js');
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || '') + ' ' + a + ' ≠ ' + b);
const ST = ['betimsel', 'grafik', 'olasilik', 'dagilim', 'galton', 'guven', 'hipotez', 'kikare', 'indeks', 'ikili', 'regresyon', 'coklu', 'bolum'];
const src = (k) => read('labs/istatistik/is-' + k + '.js');
/* kaynak dosyadan bir fonksiyon bloğunu çıkarıp verilen bağlamla çalıştır */
const slice = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + 1); assert.ok(i > -1 && j > i, 'blok bulunamadı: ' + a); return s.slice(i, j); };

test('dağılımlar: yoğunluk, birikimli ve ters değerler (scipy referansı)', () => {
  near(M.normInv(0.975), 1.959964, 1e-6); near(M.normInv(0.01), -2.326348, 1e-6); near(M.normCdf(1.5), 0.933193, 1e-6);
  near(M.tInv(0.975, 10), 2.228139, 1e-6); near(M.tInv(0.95, 1), 6.313752, 1e-5); near(M.tCdf(2, 5), 0.949030, 1e-6);
  near(M.chiInv(0.95, 2), 5.991465, 1e-6); near(M.chiInv(0.95, 10), 18.307038, 1e-6); near(M.chiCdf(3, 4), 0.442175, 1e-6);
  near(M.fInv(0.95, 2, 27), 3.354131, 1e-6); near(M.fCdf(2, 3, 10), 0.821993, 1e-6); near(M.fPdf(1, 5, 10), 0.495480, 1e-6);
  near(M.tPdf(0, 10), 0.389108, 1e-6); near(M.chiPdf(2, 3), 0.207554, 1e-6);
  near(M.binomCdf(3, 10, 0.4), 0.382281, 1e-6); near(M.poisCdf(2, 3), 0.423190, 1e-6); assert.equal(M.choose(10, 3), 120);
  for (let p = 0.02; p < 1; p += 0.07) { near(M.normCdf(M.normInv(p)), p, 1e-9, 'normal ters'); near(M.tCdf(M.tInv(p, 7), 7), p, 1e-9, 't ters'); }
});

test('betimsel: Excel/R ile aynı tanımlar', () => {
  near(M.quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.25), 3.25, 1e-12, 'DÖRTTEBİRLİK.DHL / R tip 7');
  near(M.variance([2, 4, 4, 4, 5, 5, 7, 9]), 32 / 7, 1e-12, 'VAR.S (n − 1)');
  near(M.skew([1, 2, 3, 10]), 1.763633, 1e-6, 'ÇARPIKLIK');
  assert.deepEqual(M.modes([1, 2, 2, 3, 3]), [2, 3]); assert.deepEqual(M.modes([1, 2, 3]), []);
  const b = M.box([1, 2, 3, 4, 5, 6, 7, 8, 9, 40]); assert.deepEqual(b.out, [40]); assert.equal(b.whi, 9);
  const r = M.linreg([1, 1.5, 2, 3, 3.5, 4, 5, 5.5, 6, 7, 8, 9], [38, 52, 45, 55, 61, 58, 66, 72, 64, 78, 80, 88]);
  near(r.b1, 5.520958, 1e-6); near(r.b0, 37.548902, 1e-6); near(r.r, 0.964713, 1e-6);
  near(r.sse, M.sse([1, 1.5, 2, 3, 3.5, 4, 5, 5.5, 6, 7, 8, 9], [38, 52, 45, 55, 61, 58, 66, 72, 64, 78, 80, 88], r.b0, r.b1), 1e-9);
});

test('hipotez mahkemesi: üç dava doğru istatistik ve p-değerini verir', () => {
  const s = src('hipotez');
  const run = new Function('M', slice(s, '  var CASES = {', '  var court = function') + ';return { CASES: CASES, S: S, test: test };')(M);
  const go = (c) => { run.S.c = c; run.S.v = JSON.parse(JSON.stringify(run.CASES[c].v)); run.S.tail = run.CASES[c].tail; run.S.a = 0.05; return run.test(); };
  let o = go('kahve'); near(o.stat, -2.064516, 1e-5); near(o.p, 0.028354, 1e-5); assert.equal(o.df, 15); assert.equal(o.rej, true);
  o = go('yontem'); near(o.stat, 1.901298, 1e-5); near(o.p, 0.032242, 1e-5); assert.equal(o.df, 40);
  o = go('secim'); near(o.stat, 2.204541, 1e-5); near(o.p, 0.013743, 1e-5);
  run.S.tail = 'cift'; o = run.test(); near(o.p, 2 * 0.013743, 2e-5, 'çift yönlü p iki katı');
  run.S.a = 0.01; assert.equal(run.test().rej, false, 'α = 0,01’de reddedilemez');
});

test('ki-kare, güven aralığı ve fiyat endeksi hesapları', () => {
  const k = src('kikare');
  const chiTest = new Function('M', slice(k, '  var chiTest = function', '  var chiCurve') + ';return chiTest;')(M);
  const t = chiTest([[30, 45, 25], [40, 25, 35]]); near(t.chi, 8.809524, 1e-5); near(t.p, 0.012219, 1e-5); assert.equal(t.df, 2); near(t.e[0][0], 35, 1e-9);
  /* güven: x̄ = 72,4, s = 9,8, n = 25, %95, t → hata payı 4,045 */
  near(M.tInv(0.975, 24) * 9.8 / 5, 4.045241, 1e-5);
  const b = src('bolum'), BASKET = new Function(slice(b, '  var BASKET = ', ';\n') + ';return BASKET;')();
  const S = (p, q) => BASKET.reduce((a, x) => a + x[p] * x[q], 0), L = S('p1', 'q0') / S('p0', 'q0') * 100, P = S('p1', 'q1') / S('p0', 'q1') * 100;
  assert.ok(L > P, 'ikame etkisi: Laspeyres Paasche’dan yüksek (' + L + ' / ' + P + ')');
  near(Math.sqrt(L * P), Math.sqrt(L) * Math.sqrt(P), 1e-9);
});

test('Excel formülleri yalnızca gerçek Türkçe Excel işlevleri; eksi işareti ASCII', () => {
  const OK = new Set(['ORTALAMA', 'ORTANCA', 'ENÇOK_OLAN.TEK', 'VAR.S', 'STDSAPMA.S', 'DÖRTTEBİRLİK.DHL', 'ÇARPIKLIK', 'SIKLIK', 'KOMBİNASYON', 'PERMÜTASYON', 'ÇARPINIM', 'RASTGELEARADA', 'EĞER', 'S_SAYI_ÜRET',
    'BİNOM.DAĞ', 'POISSON.DAĞ', 'NORM.DAĞ', 'NORM.S.DAĞ', 'NORM.TERS', 'NORM.S.TERS', 'T.DAĞ', 'T.DAĞ.SAĞK', 'T.DAĞ.2K', 'T.TERS.2K', 'T.TEST', 'MUTLAK', 'KİKARE.DAĞ', 'KİKARE.TERS.SAĞK', 'KİKARE.DAĞ.SAĞK', 'KİKARE.TEST', 'F.DAĞ.SAĞK',
    'KAREKÖK', 'SAY', 'RASTGELEDİZİ', 'GÜVENİLİRLİK.NORM', 'GÜVENİLİRLİK.T', 'EĞİM', 'KESMENOKTASI', 'KORELASYON', 'RKARE', 'TAHMİN.DOĞRUSAL', 'TOPLA.ÇARPIM', 'EĞİLİM', 'İNDİS', 'AL', 'SIRALAÖLÇÜT',
    /* v2 (04.11.2026): grafik, indeks, iki anakütle, çoklu regresyon ve öngörü */
    'BASIKLIK', 'YÜZDEBİRLİK.DHL', 'GEOORT', 'HARORT', 'TOPKARE', 'EĞERSAY', 'SIRA.ORT', 'DOT', 'TAHMİN.ETS', 'STANDARTLAŞTIRMA']);
  const all = ST.map(src).join('\n'), seen = new Set();
  for (const m of all.matchAll(/\['=([^']*)'/g)) for (const f of m[1].matchAll(/([A-ZÇĞİÖŞÜ_][A-ZÇĞİÖŞÜ0-9_.]*)\(/g)) { seen.add(f[1]); assert.ok(OK.has(f[1]), 'bilinmeyen Excel işlevi: ' + f[1]); }
  /* formül kartındaki Excel sütunu da aynı listeden */
  const w = { FN: {} }; new Function('window', read('labs/istatistik/is-terim.js'))(w);
  for (const k in w.FN.is.SHEET) w.FN.is.SHEET[k].forEach((r) => { for (const f of String(r[2] || '').matchAll(/([A-ZÇĞİÖŞÜ_][A-ZÇĞİÖŞÜ0-9_.]*)\(/g)) assert.ok(OK.has(f[1]), 'formül kartında bilinmeyen Excel işlevi: ' + f[1]); });
  assert.ok(seen.size >= 45, 'en az 45 farklı işlev öğretiliyor: ' + seen.size);
  assert.match(read('labs/istatistik/is-app.js'), /String\(q\[0\]\)\.replace\(\/−\/g, '-'\)/, 'Türkçe eksi (−) koda düz eksi olarak yazılır');
  ST.forEach((k) => assert.match(src(k), /IS\.code\(/, k + ': Excel/R kutusu var'));
});

test('ders planı (v2): 28 hafta AYBÜ BUS201/202, her hafta var olan istasyona bağlı; TR+EN terimler; formül kartı', () => {
  const win = { FN: {} }; new Function('window', read('labs/istatistik/is-terim.js'))(win);
  const IS = win.FN.is, html = read('labs/istatistik/index.html');
  assert.equal(IS.WEEKS.length, 28);
  assert.deepEqual([...new Set(IS.WEEKS.map((w) => w.c))], ['BUS201', 'BUS202']);
  IS.WEEKS.forEach((w, i) => {
    assert.equal(w.w, i % 14 + 1, 'hafta sırası');
    assert.ok(w.tr && w.en, 'hafta ' + (i + 1) + ': TR ve EN başlık');
    if (w.exam) assert.ok(IS.EXAMS[w.exam], w.exam + ' sınav tanımı var');
    else assert.ok(ST.includes(w.s), 'hafta ' + (i + 1) + ' bilinmeyen istasyon: ' + w.s);
  });
  assert.equal(IS.WEEKS.filter((w) => w.exam).length, 2, 'iki vize');
  ST.forEach((k) => {
    assert.ok(IS.EN[k], k + ': İngilizce ad');
    assert.ok(Array.isArray(IS.GLOSS[k]) && IS.GLOSS[k].length >= 3, k + ': en az 3 terim');
    IS.GLOSS[k].forEach((g) => assert.ok(g[0] && g[1], k + ': terim çifti eksik'));
    assert.match(html, new RegExp('data-tab="' + k + '"'));
  });
  assert.ok(Object.keys(IS.SHEET).length >= 8, 'formül kartları');
  Object.keys(IS.SHEET).forEach((k) => IS.SHEET[k].forEach((r) => assert.ok(r[0] && r[1], k + ': formül satırı eksik')));
});

test('lab kabuğu: on üç istasyon + 28 yıldızlı yol, ortak çekirdek, ağ isteği yok, hareket azaltma', () => {
  const html = read('labs/istatistik/index.html');
  ST.forEach((k) => {
    assert.match(html, new RegExp('<section class="pt-view" id="' + k + '"'));
    assert.match(html, new RegExp('<script src="is-' + k + '\\.js"></script>'));
    assert.match(html, new RegExp('data-tab="' + k + '"'));
    const s = src(k);
    assert.match(s, new RegExp('FN\\.st\\.' + k + ' = \\{'), k + ' kayıtlı');
    assert.match(s, /init: function/); assert.match(s, /ctx: function/); assert.match(s, /IS\.quiz\(/, k + ': karneli sınav');
  });
  assert.ok(html.indexOf('window.FN_CONF') < html.indexOf('<script src="../finans/fn-app.js">'));
  assert.ok(html.indexOf('is-mat.js') < html.indexOf('is-app.js'));
  assert.match(html, /"lab": "istat"/);
  /* yol: 28 haftalık harita ve vize/final provası; sınav yok, karne çekirdek defterine yazılır */
  assert.match(html, /<section class="pt-view" id="yol"/); assert.match(html, /data-tab="yol"/);
  assert.ok(html.indexOf('is-terim.js') < html.indexOf('is-betimsel.js') && html.lastIndexOf('<script src="is-') === html.indexOf('<script src="is-yol.js">'), 'terim önce, yol en son yüklenir');
  assert.match(read('labs/istatistik/is-yol.js'), /FN\.st\.yol = \{/);
  const all = ['mat', 'app', 'terim', 'yol'].concat(ST).map((f) => read('labs/istatistik/is-' + f + '.js')).join('\n');
  assert.doesNotMatch(all, /fetch\(|XMLHttpRequest|supabase|localStorage/, 'lab ağ isteği yapmaz, defteri çekirdek yazar');
  const css = read('labs/istatistik/is-style.css');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\*\{animation-duration:\.01ms!important/);
  assert.match(src('galton'), /if \(C\.RM\)/, 'Galton hareket azaltmada anında düşer');
  assert.match(src('bolum'), /hide: function \(\) \{ qcStop\(\); \}/, 'kontrol kartı zamanlayıcısı sekme değişince durur');
});

test('hub: gözlemevi düğmeleri, açılış anahtarı, liman defteri, Acadia köprüsü', () => {
  const html = read('dashboard.html'), fin = read('js/acadex-finans.js'), lim = read('js/acadex-liman.js'), aca = read('js/acadex-medlab-acadia.js');
  ST.forEach((k) => assert.match(html, new RegExp('class="axf-st" data-finans-open="istat-' + k + '"')));
  assert.equal(new Set([...html.matchAll(/data-finans-open="([a-z-]+)"/g)].map((m) => m[1])).size, 29);
  assert.match(html, /class="axf-yol" data-finans-open="istat-yol" data-lm-skip/, 'yol şeridi istasyon sayılmaz');
  assert.match(fin, /if \(labOf\(k\) === 'istat'\) \{ var u = k\.slice\(6\); return IST\[u\] \? \{ lab: 'istat', tab: u, src: 'labs\/istatistik\/index\.html'/);
  ST.forEach((k) => assert.match(fin, new RegExp('\\b' + k + ": '")));
  const logKey = new Function('return ' + lim.slice(lim.indexOf('function (k) { return /^sirket-/'), lim.indexOf(';\n', lim.indexOf('var logKey'))))();
  assert.equal(logKey('istat-galton'), 'istat.galton'); assert.equal(logKey('sirket-sim'), 'sirket.sim'); assert.equal(logKey('zaman'), 'finans.zaman');
  assert.match(lim, /cols = st\.length <= 15 \? 5 : Math\.ceil\(st\.length \/ 4\)/, 'gemi istasyon sayısına göre büyür');
  assert.match(aca, /istat: 'Acadex İstatistik'/); assert.match(aca, /lab === 'istat' \?/);
  assert.match(read('css/acadex-finans.css'), /html\.ax-dark #finans-view\.axf \.axf-obs\{filter:invert\(1\) hue-rotate\(180deg\)\}/, 'koyu temada gök gece kalır');
});

summary();
