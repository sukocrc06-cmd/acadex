/* ==========================================================================
   ACADEX İSTATİSTİK · ÇOKLU REGRESYON VE ÖNGÖRÜ (labs/istatistik/is-coklu.js), 03.11.2026
   AYBÜ BUS202 11–13. hafta: regresyonda eğim için çıkarım (t testi, güven bandı), çoklu
   regresyon (katsayı tablosu, R² ve düzeltilmiş R², F testi), zaman serisi ve öngörü
   (naif, hareketli ortalama, üstel düzeltme, trend + mevsim; MAD, MSE, MAPE).
     - eğim: gerçek eğimi ve gürültüyü değiştir, yeni örneklem çek; güven bandı nefes alır
     - çoklu: 3B serpilme ve regresyon düzlemi (sürükleyip döndür); işe yaramaz bir
       değişken eklenince R² artar ama düzeltilmiş R² düşer
     - öngörü: yöntem seç, gelecek 6 ay çizilerek uzar; hata tablosu yöntemleri yarıştırır
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, sub = 'egim';
  var verdict = function (p) { return '<span class="verdict" style="color:' + (p < 0.05 ? 'var(--bad)' : 'var(--ok)') + '">' + (p < 0.05 ? 'H₀: β₁ = 0 REDDEDİLDİ' : 'H₀: β₁ = 0 REDDEDİLEMEDİ') + '</span>'; };

  /* ---------- eğim için çıkarım ---------- */
  var E = { beta: 4, sig: 10, n: 15, seed: 1 };
  var eData = function () { var r = M.seeded(E.seed * 97 + 3), rnd = Math.random, xs = [], ys = []; Math.random = r; for (var i = 0; i < E.n; i++) { var x = 1 + 9 * r(); xs.push(x); ys.push(30 + E.beta * x + E.sig * M.randn()); } Math.random = rnd; return { x: xs, y: ys }; };
  var egimDraw = function () {
    var d = eData(), r = M.linreg(d.x, d.y), n = d.x.length, sxx = d.x.reduce(function (a, x) { return a + (x - r.mx) * (x - r.mx); }, 0), s = Math.sqrt(r.sse / (n - 2)), se = s / Math.sqrt(sxx), t = r.b1 / se, p = 2 * (1 - M.tCdf(Math.abs(t), n - 2)), tc = M.tInv(0.975, n - 2);
    var band = function (sg) { return IS.curve(function (x) { return r.b0 + r.b1 * x + sg * tc * s * Math.sqrt(1 / n + (x - r.mx) * (x - r.mx) / sxx); }, 0, 10, 60); };
    C.$('[data-ech]', root).innerHTML = C.chart({ w: 620, h: 280, x: [0, 10], y: [0, 130], anim: false, al: 'eğim ve güven bandı', xl: 'x', yl: 'y',
      s: [{ p: band(1), c: '#6FD3F0', w: 1.2, d: '4 4' }, { p: band(-1), c: '#6FD3F0', w: 1.2, d: '4 4' }, { p: [[0, r.b0], [10, r.b0 + 10 * r.b1]], c: '#2F6FB0', w: 3 }, { p: [[0, 30], [10, 30 + 10 * E.beta]], c: '#1E8A55', w: 1.6, d: '2 4', lab: 'gerçek' }],
      dots: d.x.map(function (x, i) { return { x: x, y: Math.max(0, Math.min(130, d.y[i])), c: '#E0A526', r: 5 }; }) });
    C.$('[data-eres]', root).innerHTML = '<div class="row" style="justify-content:space-between"><div><span class="lbl">b₁ = ' + f(r.b1, 3) + ' · SH = ' + f(se, 3) + ' · t = ' + f(t, 2) + ' (sd = ' + (n - 2) + ')</span><div class="big">p = ' + IS.p(p) + '</div></div>' + verdict(p) + '</div><p class="lbl">β₁ için %95 aralık: [' + f(r.b1 - tc * se, 3) + ' ; ' + f(r.b1 + tc * se, 3) + '] · gerçek eğim ' + f(E.beta, 2) + '</p>';
    IS.steps(C.$('[data-est]', root), [
      { t: 'tahminin standart hatası', x: 's = √(KT_hata / (n − 2)) = √(' + f(r.sse, 1) + ' / ' + (n - 2) + ') = ' + f(s, 3) },
      { t: 'eğimin standart hatası', x: 'SH(b₁) = s / √Sxx = ' + f(s, 3) + ' / √' + f(sxx, 2) + ' = ' + f(se, 4) },
      { t: 'test istatistiği', x: 't = b₁ / SH(b₁) = ' + f(r.b1, 3) + ' / ' + f(se, 4) + ' = ' + f(t, 3) },
      { t: 'aralık', x: 'b₁ ± t(' + (n - 2) + ')·SH = ' + f(r.b1, 3) + ' ± ' + f(tc, 3) + ' · ' + f(se, 4) }
    ], 'eğim testi, adım adım');
  };
  /* ---------- çoklu regresyon ---------- */
  var MR = (function () { var r = M.seeded(21), rnd = Math.random, d = []; Math.random = r; for (var i = 0; i < 30; i++) { var x1 = 1 + 9 * r(), x2 = 10 + 10 * r(), x3 = r() * 10; d.push([x1, x2, x3, 80 + 6 * x1 - 3 * x2 + 6 * M.randn()]); } Math.random = rnd; return d; })();
  var V = { use: { fiyat: true, gur: false }, rx: -0.5, ry: 0.6, auto: true, raf: 0 };
  var mrFit = function () { var cols = [0].concat(V.use.fiyat ? [1] : []).concat(V.use.gur ? [2] : []), Xr = MR.map(function (r) { return cols.map(function (c) { return r[c]; }); }); return { cols: cols, o: M.ols(Xr, MR.map(function (r) { return r[3]; })) }; };
  var NM = ['reklam (bin TL)', 'fiyat (TL)', 'rastgele gürültü'], NE = ['advertising', 'price', 'noise'];
  var mrTable = function () {
    var F = mrFit(), o = F.o;
    C.$('[data-mtab]', root).innerHTML = '<div class="tbl-w"><table class="t"><thead><tr><th>değişken</th><th class="n">katsayı</th><th class="n">SH</th><th class="n">t</th><th class="n">p</th></tr></thead><tbody><tr><td>sabit</td><td class="n">' + f(o.b[0], 2) + '</td><td class="n">' + f(o.se[0], 2) + '</td><td class="n">' + f(o.t[0], 2) + '</td><td class="n">' + IS.p(o.p[0]) + '</td></tr>' +
      F.cols.map(function (c, j) { var sig = o.p[j + 1] < 0.05; return '<tr' + (sig ? '' : ' class="mr-ns"') + '><td>' + IS.en(NM[c], NE[c]) + '</td><td class="n"><b>' + f(o.b[j + 1], 3) + '</b></td><td class="n">' + f(o.se[j + 1], 3) + '</td><td class="n">' + f(o.t[j + 1], 2) + '</td><td class="n">' + IS.p(o.p[j + 1]) + (sig ? '' : ' <span class="pill warn">anlamsız</span>') + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="kpis"><div class="kpi"><small>R²</small><b>' + f(o.r2, 4) + '</b></div><div class="kpi hl"><small>düzeltilmiş R² <span class="en">adjusted</span></small><b>' + f(o.adj, 4) + '</b></div><div class="kpi"><small>F · p</small><b>' + f(o.F, 1) + ' · ' + IS.p(o.pF) + '</b></div><div class="kpi"><small>s (tahminin SH’si)</small><b>' + f(o.s, 2) + '</b></div></div>' +
      '<div class="formula">ŷ = ' + f(o.b[0], 2) + F.cols.map(function (c, j) { var b = o.b[j + 1]; return (b < 0 ? ' − ' : ' + ') + f(Math.abs(b), 3) + '·' + ['reklam', 'fiyat', 'gürültü'][c]; }).join('') + '</div>' +
      IS.tip(V.use.gur ? 'Gürültü değişkeni R²’yi biraz artırdı (R² hiç düşmez) ama düzeltilmiş R² düştü ve katsayısı anlamsız: modele katkısı yok. Değişken eklerken düzeltilmiş R²’ye bak.' : V.use.fiyat ? 'Fiyat 1 TL artınca, reklam sabitken, satış ortalama ' + f(Math.abs(o.b[2]), 2) + ' birim azalıyor. “Diğerleri sabitken” yorumu çoklu regresyonun özüdür.' : 'Yalnız reklamla model satışın bir kısmını açıklıyor. Fiyatı ekle ve R²’nin sıçrayışını izle.', 'R̄²');
  };
  var proj = function (x, y, z) {
    /* veri birimlerini küpe sığdır, iki eksende döndür, ekrana düşür */
    var X0 = (x - 5.5) / 4.5, Y0 = (z - 15) / 5, Z0 = (y - 80) / 40, cy = Math.cos(V.ry), sy = Math.sin(V.ry), cx = Math.cos(V.rx), sx = Math.sin(V.rx);
    var a = X0 * cy - Y0 * sy, b = X0 * sy + Y0 * cy, c = Z0 * cx - b * sx, dd = Z0 * sx + b * cx;
    var sc = 330 / (3.2 - dd * 0.4); return [310 + a * sc, 200 - c * sc, dd];
  };
  var mrPaint = function () {
    var cv = C.$('[data-mcv]', root); if (!cv) return; var c = cv.getContext('2d'), F = mrFit(), o = F.o, W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H); var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0F1B3E'); g.addColorStop(1, '#1A2B5A'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    var line = function (p, q, col, w) { c.strokeStyle = col; c.lineWidth = w || 1; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
    /* eksenler */
    var o0 = proj(1, 40, 10); line(o0, proj(10, 40, 10), 'rgba(255,255,255,.45)', 1.5); line(o0, proj(1, 40, 20), 'rgba(255,255,255,.45)', 1.5); line(o0, proj(1, 120, 10), 'rgba(255,255,255,.45)', 1.5);
    c.fillStyle = '#AEB8DC'; c.font = '12px JetBrains Mono, monospace'; var t1 = proj(10.6, 40, 10), t2 = proj(1, 40, 21), t3 = proj(1, 124, 10); c.fillText('reklam', t1[0], t1[1]); c.fillText('fiyat', t2[0], t2[1]); c.fillText('satış', t3[0], t3[1]);
    /* düzlem */
    var yh = function (x1, x2) { var v = o.b[0], j = 1; v += o.b[j++] * x1; if (V.use.fiyat) v += o.b[j++] * x2; if (V.use.gur) v += o.b[j++] * 5; return v; };
    c.strokeStyle = 'rgba(111,211,240,.35)'; c.lineWidth = 1;
    for (var i = 0; i <= 8; i++) { var a1 = 1 + 9 * i / 8, a2 = 10 + 10 * i / 8; line(proj(a1, yh(a1, 10), 10), proj(a1, yh(a1, 20), 20), 'rgba(111,211,240,.35)'); line(proj(1, yh(1, a2), a2), proj(10, yh(10, a2), a2), 'rgba(111,211,240,.35)'); }
    var q = [proj(1, yh(1, 10), 10), proj(10, yh(10, 10), 10), proj(10, yh(10, 20), 20), proj(1, yh(1, 20), 20)];
    c.fillStyle = 'rgba(111,211,240,.10)'; c.beginPath(); c.moveTo(q[0][0], q[0][1]); q.slice(1).forEach(function (p) { c.lineTo(p[0], p[1]); }); c.closePath(); c.fill();
    /* noktalar ve kalıntılar, derinliğe göre */
    MR.map(function (r) { return { r: r, p: proj(r[0], r[3], r[1]), h: proj(r[0], yh(r[0], r[1]), r[1]) }; }).sort(function (a, b) { return a.p[2] - b.p[2]; }).forEach(function (d) {
      line(d.p, d.h, d.r[3] > yh(d.r[0], d.r[1]) ? 'rgba(127,224,194,.7)' : 'rgba(255,111,85,.7)', 1.2);
      c.fillStyle = '#FFD86B'; c.shadowColor = '#FFD86B'; c.shadowBlur = 6; c.beginPath(); c.arc(d.p[0], d.p[1], 4.5, 0, 7); c.fill(); c.shadowBlur = 0;
    });
  };
  var mrLoop = function () { if (sub !== 'coklu' || C.RM || !V.auto) { V.raf = 0; return; } V.ry += 0.004; mrPaint(); V.raf = requestAnimationFrame(mrLoop); };
  /* ---------- öngörü ---------- */
  var TS = (function () { var r = M.seeded(8), a = []; for (var t = 0; t < 36; t++) a.push(200 + 3 * t + 40 * Math.sin((t % 12) / 12 * 2 * Math.PI - 1) + (r() - 0.5) * 24); return a; })();
  var FC = { m: 'mevsim', a: 0.4, h: 6 };
  var fit = function (m) {
    var n = TS.length, fitv = [], fut = [];
    if (m === 'naif') { for (var t = 1; t < n; t++) fitv[t] = TS[t - 1]; for (t = 0; t < FC.h; t++) fut.push(TS[n - 1]); }
    else if (m === 'ho') { for (t = 3; t < n; t++) fitv[t] = (TS[t - 1] + TS[t - 2] + TS[t - 3]) / 3; var last = (TS[n - 1] + TS[n - 2] + TS[n - 3]) / 3; for (t = 0; t < FC.h; t++) fut.push(last); }
    else if (m === 'ud') { var F = TS[0]; fitv[1] = F; for (t = 1; t < n; t++) { F = FC.a * TS[t - 1] + (1 - FC.a) * F; fitv[t] = F; } var Fn = FC.a * TS[n - 1] + (1 - FC.a) * F; for (t = 0; t < FC.h; t++) fut.push(Fn); }
    else {
      var xs = TS.map(function (_, i) { return i; }), r = M.linreg(xs, TS), idx = []; for (var k = 0; k < 12; k++) { var rs = []; for (t = k; t < n; t += 12) rs.push(TS[t] / (r.b0 + r.b1 * t)); idx.push(M.mean(rs)); }
      var mi = M.mean(idx); idx = idx.map(function (v) { return v / mi; });
      for (t = 0; t < n; t++) fitv[t] = (r.b0 + r.b1 * t) * idx[t % 12]; for (t = 0; t < FC.h; t++) fut.push((r.b0 + r.b1 * (n + t)) * idx[(n + t) % 12]); fit.idx = idx;
    }
    var e = [], ape = []; for (t = 0; t < n; t++) if (fitv[t] != null) { e.push(TS[t] - fitv[t]); ape.push(Math.abs((TS[t] - fitv[t]) / TS[t])); }
    return { fit: fitv, fut: fut, mad: M.mean(e.map(Math.abs)), mse: M.mean(e.map(function (v) { return v * v; })), mape: M.mean(ape) * 100 };
  };
  var MN = { naif: 'naif', ho: 'hareketli ort. (3)', ud: 'üstel düzeltme', mevsim: 'trend + mevsim' };
  var fcDraw = function () {
    var o = fit(FC.m), n = TS.length;
    C.$('[data-fch]', root).innerHTML = C.chart({ w: 640, h: 270, x: [0, n + FC.h - 1], al: 'zaman serisi öngörüsü', xl: 'ay', yl: 'satış', anim: true, xticks: [0, 6, 12, 18, 24, 30, 36, 41],
      s: [{ p: TS.map(function (v, t) { return [t, v]; }), c: '#9AA6B8', w: 2, cls: 'nodraw' }, { p: o.fit.map(function (v, t) { return v == null ? null : [t, v]; }).filter(Boolean), c: '#2F6FB0', w: 2, d: '5 3' }, { p: [[n - 1, TS[n - 1]]].concat(o.fut.map(function (v, t) { return [n + t, v]; })), c: '#C8553D', w: 3.2, lab: 'öngörü' }],
      vl: [{ x: n - 0.5, c: '#46506A', lab: 'bugün' }] });
    var rows = Object.keys(MN).map(function (m) { var q = fit(m); return [m, q]; }), best = rows.reduce(function (a, r) { return r[1].mape < a[1].mape ? r : a; });
    C.$('[data-ftab]', root).innerHTML = '<div class="tbl-w"><table class="t t-sm"><thead><tr><th>yöntem</th><th class="n">MAD</th><th class="n">MSE</th><th class="n">MAPE</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr' + (r[0] === FC.m ? ' class="mr-on"' : '') + '><td>' + MN[r[0]] + (r[0] === best[0] ? ' <span class="pill ok">en iyi</span>' : '') + '</td><td class="n">' + f(r[1].mad, 1) + '</td><td class="n">' + f(r[1].mse, 0) + '</td><td class="n">%' + f(r[1].mape, 2) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (FC.m === 'mevsim' ? '<p class="lbl">mevsim indeksleri (ocak → aralık): ' + fit.idx.map(function (v) { return f(v, 2); }).join(' · ') + '</p>' : '') +
      IS.tip(FC.m === 'mevsim' ? 'Seri hem büyüyor hem her yıl aynı aylarda dalgalanıyor. Trend ve mevsim birlikte modellenince hata en aza iner.' : FC.m === 'ud' ? 'α büyükse son gözleme çok güvenirsin (hızlı tepki, çok oynak); küçükse geçmişe (pürüzsüz, gecikmeli). Mevsimsellik olan seride düz öngörü yetersiz kalır.' : 'Basit yöntemler mevsim dalgasını yakalayamaz; geleceği düz bir çizgi sanır.', FC.m === 'ud' ? 'α' : 'MAPE');
    C.$('[data-fa]', root).hidden = FC.m !== 'ud';
  };

  var subDraw = function () {
    C.$$('[data-sub]', root).forEach(function (s) { s.hidden = s.getAttribute('data-sub') !== sub; });
    if (sub === 'egim') egimDraw(); else if (sub === 'coklu') { mrTable(); mrPaint(); if (!V.raf) V.raf = requestAnimationFrame(mrLoop); } else fcDraw();
    FN.bridgeSend();
  };
  var QS = [
    { q: 'Basit regresyonda b₁ = 2,4 ve SH(b₁) = 0,8, n = 22. Test istatistiği?', o: ['t = 3, sd = 20', 't = 1,92, sd = 21', 't = 3, sd = 21', 'z = 1,6'], a: 0, n: 't = 2,4 / 0,8 = 3; serbestlik derecesi n − 2 = 20.' },
    { q: 'Modele yeni bir değişken eklendi; R² 0,812’den 0,815’e çıktı, düzeltilmiş R² 0,80’den 0,79’a düştü. Yorum?', o: ['değişken modele anlamlı katkı yapmıyor', 'model kesin iyileşti', 'R² hep düşer', 'çoklu doğrusallık yok demektir'], a: 0, n: 'R² değişken eklendikçe asla düşmez; düzeltilmiş R² gereksiz değişkeni cezalandırır.' },
    { q: 'Çoklu regresyonda fiyat katsayısı −3,2. Doğru yorum?', o: ['diğer değişkenler sabitken fiyat 1 birim artınca y ortalama 3,2 azalır', 'fiyat y’yi %3,2 azaltır', 'fiyat ile y arasında korelasyon −3,2', 'fiyat anlamsızdır'], a: 0, n: 'Kısmi etki: öteki değişkenler sabit tutulur (ceteris paribus).' },
    { q: 'Üstel düzeltmede α = 0,9 seçmenin sonucu?', o: ['öngörü son gözleme çok yakın, oynak olur', 'öngörü çok pürüzsüz olur', 'mevsimsellik yakalanır', 'trend eklenir'], a: 0, n: 'Fₜ₊₁ = 0,9yₜ + 0,1Fₜ: ağırlığın çoğu son gözlemde.' },
    { q: 'MAPE = %4 ne anlatır?', o: ['öngörüler ortalama %4 sapıyor', 'öngörülerin %4’ü yanlış', 'R² = 0,96', 'hata kareleri 4'], a: 0, n: 'Ortalama mutlak yüzde hata; ölçekten bağımsızdır, yöntemleri karşılaştırmaya yarar.' },
    { q: 'F testi (çoklu regresyon) neyi sınar?', o: ['bağımsız değişkenlerin hiçbirinin etkisi yok mu', 'tek bir katsayı sıfır mı', 'kalıntılar normal mi', 'varyanslar eşit mi'], a: 0, n: 'H₀: β₁ = β₂ = … = 0. Ret: en az bir değişken anlamlı.' }
  ];
  IS.bank.coklu = QS;

  FN.st.coklu = {
    init: function () {
      root = C.$('#coklu');
      var sl = function (k, lab, min, max, st) { return '<label class="sl"><span>' + lab + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + st + '" value="' + E[k] + '" data-ek="' + k + '"><output data-eko="' + k + '">' + f(E[k], st < 1 ? 1 : 0) + '</output></label>'; };
      root.innerHTML = IS.head({ key: 'coklu', k: 'istasyon · regresyonda çıkarım ve öngörü', title: 'Çoklu regresyon ve öngörü', sub: 'Eğim gerçekten sıfırdan farklı mı? Birden fazla değişken aynı anda ne anlatır? Geçmiş satışlardan gelecek ay nasıl tahmin edilir? Grafikler sürüklenir, döner, uzar.' }) +
        '<div class="seg" data-seg style="margin-bottom:14px"></div>' +
        '<div data-sub="egim"><div class="grid gside"><div class="card box" style="--cc:#6FD3F0"><h2>' + IS.en('Eğim için çıkarım', 'inference about the slope') + '</h2><p class="sub">Gerçek ilişkiyi biz belirliyoruz; örneklem gürültülü. Açık mavi çizgiler ortalama yanıt için %95 güven bandı.</p>' + sl('beta', 'gerçek eğim β₁', 0, 8, 0.1) + sl('sig', 'gürültü σ', 2, 30, 0.5) + sl('n', 'örneklem n', 5, 60, 1) + '<button type="button" class="btn sm pri" data-enew>yeni örneklem çek</button></div>' +
        '<div class="card box" style="--cc:#6FD3F0"><div data-ech></div><div data-eres></div><div data-est></div>' + IS.code({ x: [['=DOT(B2:B16;A2:A16;DOĞRU;DOĞRU)', 'dizi: eğim, SH, R², F … (Microsoft 365)'], ['Veri › Veri Çözümleme › Regresyon', 'katsayı tablosu, t, p, güven aralığı']], r: [['summary(lm(y ~ x))', 'Estimate, Std. Error, t value, Pr(>|t|)'], ['confint(lm(y ~ x))', 'β için güven aralığı'], ['predict(m, interval = "confidence")', 'güven bandı']] }) + '</div></div></div>' +
        '<div data-sub="coklu" hidden><div class="grid g2"><div class="card box" style="--cc:#6FD3F0"><h2>' + IS.en('3B regresyon düzlemi', 'multiple regression') + '</h2><p class="sub">30 mağaza: satış ~ reklam + fiyat. Sürükleyerek döndür. Yeşil/kırmızı çizgiler kalıntılar.</p><canvas class="mr-cv" data-mcv width="620" height="400" role="img" aria-label="3 boyutlu serpilme ve regresyon düzlemi"></canvas><div class="row" style="margin-top:8px"><label class="row lbl"><input type="checkbox" data-mf checked style="width:auto"> fiyat modelde</label><label class="row lbl"><input type="checkbox" data-mg style="width:auto"> rastgele gürültü değişkenini ekle</label></div></div>' +
        '<div class="card box" style="--cc:#6FD3F0"><div data-mtab></div>' + IS.code({ x: [['=DOT(D2:D31;A2:B31;DOĞRU;DOĞRU)', 'çoklu regresyon dizisi'], ['Veri › Veri Çözümleme › Regresyon (X aralığı: A:B)', '']], r: [['m <- lm(satis ~ reklam + fiyat, data = d)', ''], ['summary(m)', 'Adjusted R-squared, F-statistic'], ['car::vif(m)', 'çoklu doğrusallık kontrolü']] }) + '</div></div></div>' +
        '<div data-sub="ongoru" hidden><div class="grid gside"><div class="card box" style="--cc:#6FD3F0"><h2>' + IS.en('Öngörü yöntemi', 'forecasting method') + '</h2><p class="sub">Bir kafenin 36 aylık satışı. Yöntem seç; kırmızı çizgi gelecek 6 ayı çizer.</p><div class="seg" data-fm></div><label class="sl" data-fa hidden><span>α (düzeltme katsayısı)</span><input type="range" min="0.05" max="0.95" step="0.05" value="0.4" data-fal><output data-falo>0,40</output></label><div data-ftab></div></div>' +
        '<div class="card box" style="--cc:#6FD3F0"><div data-fch></div>' + IS.code({ x: [['=TAHMİN.ETS(A38;B2:B37;A2:A37;12)', 'mevsimsel üstel düzeltme (Excel 2016+)'], ['Veri › Tahmin Sayfası', 'grafik ve güven aralığıyla'], ['=ORTALAMA(B35:B37)', '3 aylık hareketli ortalama']], r: [['x <- ts(satis, frequency = 12)', ''], ['HoltWinters(x)', 'trend + mevsim üstel düzeltme'], ['predict(HoltWinters(x), 6)', '6 aylık öngörü'], ['decompose(x)$seasonal', 'mevsim bileşeni']] }) + '</div></div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      IS.seg(C.$('[data-seg]', root), [['egim', 'Eğim testi'], ['coklu', 'Çoklu regresyon'], ['ongoru', 'Zaman serisi ve öngörü']], sub, function (k) { sub = k; subDraw(); });
      C.$$('[data-ek]', root).forEach(function (el) { el.addEventListener('input', function () { var k = el.getAttribute('data-ek'); E[k] = +el.value; C.$('[data-eko="' + k + '"]', root).textContent = f(E[k], +el.step < 1 ? 1 : 0); egimDraw(); }); });
      C.$('[data-enew]', root).onclick = function () { E.seed++; egimDraw(); FN.bridgeSend(); };
      C.$('[data-mf]', root).onchange = function (e) { V.use.fiyat = e.target.checked; mrTable(); mrPaint(); FN.bridgeSend(); };
      C.$('[data-mg]', root).onchange = function (e) { V.use.gur = e.target.checked; mrTable(); mrPaint(); FN.bridgeSend(); };
      var cv = C.$('[data-mcv]', root), drag = null;
      cv.addEventListener('pointerdown', function (e) { drag = [e.clientX, e.clientY, V.rx, V.ry]; V.auto = false; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
      cv.addEventListener('pointermove', function (e) { if (!drag) return; V.ry = drag[3] + (e.clientX - drag[0]) / 120; V.rx = Math.max(-1.3, Math.min(1.3, drag[2] + (e.clientY - drag[1]) / 120)); mrPaint(); });
      cv.addEventListener('pointerup', function () { drag = null; });
      IS.seg(C.$('[data-fm]', root), Object.keys(MN).map(function (k) { return [k, MN[k]]; }), FC.m, function (k) { FC.m = k; fcDraw(); FN.bridgeSend(); });
      C.$('[data-fal]', root).oninput = function (e) { FC.a = +e.target.value; C.$('[data-falo]', root).textContent = f(FC.a, 2); fcDraw(); };
      subDraw();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Çoklu regresyon ve öngörü');
    },
    hide: function () { if (V.raf) { cancelAnimationFrame(V.raf); V.raf = 0; } },
    show: function () { if (root && sub === 'coklu' && !V.raf) V.raf = requestAnimationFrame(mrLoop); },
    ctx: function () {
      var F = mrFit();
      return IS.ctx('coklu', sub, sub === 'coklu' ? [['R²', f(F.o.r2, 3)], ['düzeltilmiş R²', f(F.o.adj, 3)], ['değişkenler', F.cols.map(function (c) { return NM[c]; }).join(', ')]] : sub === 'ongoru' ? [['yöntem', MN[FC.m]], ['MAPE', '%' + f(fit(FC.m).mape, 2)]] : [['gerçek eğim', E.beta], ['gürültü', E.sig], ['n', E.n]],
        'öğrenci regresyonda eğim testi, çoklu regresyon ve zaman serisi öngörüsü çalışıyor (AYBÜ BUS202 11–13. hafta).', ['Düzeltilmiş R² neden önemli?', 'Çoklu doğrusallık nedir?', 'Hangi öngörü yöntemini seçmeliyim?']);
    }
  };
})();
