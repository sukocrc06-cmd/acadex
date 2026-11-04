/* ==========================================================================
   ACADEX İSTATİSTİK · 9. BÖLÜM KÖŞELERİ (labs/istatistik/is-bolum.js), 03.11.2026
   Çekirdek istatistiğin bölümlere özel uzantıları:
     - iktisat: fiyat endeksleri (Laspeyres, Paasche, Fisher), zaman serisi ve hareketli ortalama
     - işletme: x̄ kontrol kartı (istatistiksel süreç kontrolü), süreç kayması
     - sosyoloji: örnekleme yöntemleri (basit, sistematik, tabakalı, küme) ve standart hataları
     - sağlık: tanı testi eşiği, duyarlılık/özgüllük, ROC eğrisi, PPV/NPV
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, sub = 'iktisat';

  /* ---------- iktisat ---------- */
  var BASKET = [{ n: 'ekmek (adet)', p0: 10, q0: 60, p1: 16, q1: 40 }, { n: 'süt (litre)', p0: 30, q0: 20, p1: 39, q1: 20 }, { n: 'kira (ay)', p0: 8000, q0: 1, p1: 10000, q1: 1 }, { n: 'ulaşım (biniş)', p0: 15, q0: 80, p1: 21, q1: 60 }];
  var TS = (function () { var r = M.seeded(11), a = []; for (var t = 0; t < 36; t++) a.push(100 + 1.8 * t + 9 * Math.sin(t / 12 * 2 * Math.PI) + (r() - 0.5) * 10); return a; })();
  var I = { w: 12 };
  var ikDraw = function () {
    var s = function (k) { return BASKET.reduce(function (a, b) { return a + b[k[0]] * b[k[1]]; }, 0); };
    var L = s(['p1', 'q0']) / s(['p0', 'q0']) * 100, P = s(['p1', 'q1']) / s(['p0', 'q1']) * 100, F = Math.sqrt(L * P);
    C.$('[data-bk]', root).innerHTML = '<table class="t"><thead><tr><th>mal</th><th class="n">p₀</th><th class="n">q₀</th><th class="n">p₁</th><th class="n">q₁</th></tr></thead><tbody>' + BASKET.map(function (b, i) {
      return '<tr><td>' + X(b.n) + '</td><td class="n">' + C.nf(b.p0) + '</td><td class="n">' + b.q0 + '</td><td class="n"><input type="number" min="0" value="' + b.p1 + '" data-bp="' + i + '" aria-label="' + X(b.n) + ' yeni fiyat" style="width:86px;min-height:32px;text-align:right"></td><td class="n">' + b.q1 + '</td></tr>';
    }).join('') + '</tbody></table>';
    C.$('[data-bx]', root).innerHTML = '<div class="bl-idx">' + [['Laspeyres', L, 'eski sepet (q₀)', '#2F6FB0'], ['Paasche', P, 'yeni sepet (q₁)', '#C8553D'], ['Fisher', F, '√(L·P)', '#3E8E5B']].map(function (q) {
      return '<div><span class="lbl">' + q[0] + '</span><b style="color:' + q[3] + '">' + f(q[1], 1) + '</b><i style="--w:' + Math.min(100, (q[1] - 100) / 1.2).toFixed(1) + '%;background:' + q[3] + '"></i><small>%' + f(q[1] - 100, 1) + ' artış · ' + q[2] + '</small></div>';
    }).join('') + '</div>' + IS.tip('Laspeyres, eski alışkanlıkla bugünün fiyatını ölçer (TÜFE mantığı); fiyatı artan maldan kaçışı görmez, bu yüzden genelde Paasche’dan yüksek çıkar.', 'TÜFE');
    C.$$('[data-bp]', root).forEach(function (el) { el.onchange = function () { BASKET[+el.getAttribute('data-bp')].p1 = Math.max(0, +el.value || 0); ikDraw(); }; });
    var ma = TS.map(function (_, i) { if (i < I.w - 1) return null; var s2 = 0; for (var j = i - I.w + 1; j <= i; j++) s2 += TS[j]; return [i + 1, s2 / I.w]; }).filter(Boolean);
    var r = M.linreg(TS.map(function (_, i) { return i + 1; }), TS);
    C.$('[data-ts]', root).innerHTML = C.chart({ w: 640, h: 250, x: [1, 36], al: 'zaman serisi', xl: 'ay', yl: 'satış endeksi', xticks: [1, 6, 12, 18, 24, 30, 36],
      s: [{ p: TS.map(function (v, i) { return [i + 1, v]; }), c: '#9DB8FF', w: 1.8 }, { p: ma, c: '#C8553D', w: 3, lab: I.w + ' aylık HO' }, { p: [[1, r.b0 + r.b1], [36, r.b0 + r.b1 * 36]], c: '#3E8E5B', w: 2, d: '6 4', lab: 'trend' }] }) +
      '<p class="lbl">trend: ayda +' + f(r.b1, 2) + ' puan. 12 aylık hareketli ortalama mevsimselliği siler; 3 aylık hâlâ dalgalanır.</p>';
  };
  /* ---------- işletme: kontrol kartı ---------- */
  var Q = { mu: 500, sig: 4, n: 5, shift: 0, pts: [], timer: 0 };
  var qcAdd = function () { var a = []; for (var i = 0; i < Q.n; i++) a.push(Q.mu + Q.shift + Q.sig * M.randn()); Q.pts.push(M.mean(a)); if (Q.pts.length > 40) Q.pts.shift(); };
  var qcDraw = function () {
    var se = Q.sig / Math.sqrt(Q.n), ucl = Q.mu + 3 * se, lcl = Q.mu - 3 * se, run = 0, flags = [];
    Q.pts.forEach(function (v, i) { run = v > Q.mu ? (run > 0 ? run + 1 : 1) : (run < 0 ? run - 1 : -1); flags.push(v > ucl || v < lcl ? 'out' : Math.abs(run) >= 7 ? 'run' : ''); });
    var dots = Q.pts.map(function (v, i) { return { x: i + 1, y: v, c: flags[i] === 'out' ? '#FF6F55' : flags[i] === 'run' ? '#FFB36B' : '#2F6FB0', r: flags[i] ? 6 : 4, cls: i === Q.pts.length - 1 ? 'me' : '' }; });
    C.$('[data-qc]', root).innerHTML = C.chart({ w: 640, h: 260, x: [0, 41], y: [Q.mu - 6 * se, Q.mu + 6 * se], anim: false, al: 'x̄ kontrol kartı', xl: 'alt grup', yl: 'ortalama ağırlık (g)', yf: function (v) { return f(v, 1); },
      hl: [{ y: ucl, c: '#C9483B', lab: 'ÜKS ' + f(ucl, 1) }, { y: Q.mu, c: '#3E8E5B', lab: 'merkez ' + Q.mu }, { y: lcl, c: '#C9483B', lab: 'AKS ' + f(lcl, 1) }],
      s: Q.pts.length > 1 ? [{ p: Q.pts.map(function (v, i) { return [i + 1, v]; }), c: '#9AA6B8', w: 1.2 }] : [], dots: dots });
    var nOut = flags.filter(function (x) { return x === 'out'; }).length, nRun = flags.filter(function (x) { return x === 'run'; }).length;
    C.$('[data-qck]', root).innerHTML = '<div class="kpi"><small>alt grup</small><b>' + Q.pts.length + '</b></div><div class="kpi"><small>sınır dışı</small><b style="color:var(--bad)">' + nOut + '</b></div><div class="kpi"><small>7’li seri</small><b style="color:#B9821F">' + nRun + '</b></div><div class="kpi hl"><small>durum</small><b>' + (nOut || nRun ? 'kontrol dışı' : 'kontrol altında') + '</b></div>';
  };
  var qcStop = function () { clearInterval(Q.timer); Q.timer = 0; var b = C.$('[data-qrun]', root); if (b) b.textContent = 'hattı çalıştır'; };
  /* ---------- sosyoloji: örnekleme ---------- */
  var ST = [{ n: 'A mahallesi', c: '#FFB36B', p: 0.7 }, { n: 'B mahallesi', c: '#7FE0C2', p: 0.5 }, { n: 'C mahallesi', c: '#9DB8FF', p: 0.3 }, { n: 'D mahallesi', c: '#F4A7B9', p: 0.15 }];
  var POP = (function () { var r = M.seeded(5), a = []; for (var i = 0; i < 200; i++) { var row = Math.floor(i / 20), s = Math.floor(row / 2.5), yes = r() < ST[s].p ? 1 : 0; a.push({ s: s, y: yes, cl: Math.floor(i % 20 / 5) + 4 * Math.floor(row / 2) }); } return a; })();
  var TRUEP = M.mean(POP.map(function (o) { return o.y; }));
  var SM = { m: 'basit', n: 20, sel: [], reps: null };
  var draw = function (m, n, rnd) {
    rnd = rnd || Math.random; var idx = POP.map(function (_, i) { return i; }), sel = [];
    var shuf = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    if (m === 'basit') sel = shuf(idx).slice(0, n);
    else if (m === 'sistem') { var k = Math.floor(200 / n), st = Math.floor(rnd() * k); for (var i = st; i < 200 && sel.length < n; i += k) sel.push(i); }
    else if (m === 'tabaka') ST.forEach(function (_, s) { var g = idx.filter(function (i) { return POP[i].s === s; }), share = Math.round(n * g.length / 200); sel = sel.concat(shuf(g).slice(0, share)); });
    else { var cls = shuf(Array.apply(null, { length: 20 }).map(function (_, i) { return i; })).slice(0, Math.max(1, Math.round(n / 10))); sel = idx.filter(function (i) { return cls.indexOf(POP[i].cl) > -1; }); }
    return sel;
  };
  var MN = { basit: 'basit rastgele', sistem: 'sistematik', tabaka: 'tabakalı (orantılı)', kume: 'küme' };
  var smDraw = function () {
    var sel = SM.sel, ph = sel.length ? M.mean(sel.map(function (i) { return POP[i].y; })) : null;
    C.$('[data-pop]', root).innerHTML = POP.map(function (o, i) { var on = sel.indexOf(i) > -1; return '<i class="' + (o.y ? 'y' : '') + (on ? ' on' : '') + '" style="--c:' + ST[o.s].c + ';--d:' + (on ? (sel.indexOf(i) * 0.03).toFixed(2) : 0) + 's" title="' + ST[o.s].n + (o.y ? ', evet' : ', hayır') + '"></i>'; }).join('');
    C.$('[data-smk]', root).innerHTML = '<div class="kpi"><small>gerçek oran (ana kütle)</small><b>' + f(TRUEP, 3) + '</b></div><div class="kpi hl"><small>örneklem tahmini p̂</small><b>' + (ph == null ? '—' : f(ph, 3)) + '</b></div><div class="kpi"><small>seçilen kişi</small><b>' + sel.length + '</b></div>';
    if (SM.reps) C.$('[data-smr]', root).innerHTML = C.chart({ w: 600, h: 200, y0: true, x: [0.5, 4.5], nb: 4, xticks: [1, 2, 3, 4], xf: function (v) { return ['basit', 'sistematik', 'tabakalı', 'küme'][v - 1]; }, al: 'standart hata karşılaştırması', yl: 'tahminlerin std. sapması', yf: function (v) { return f(v, 2); },
      bars: ['basit', 'sistem', 'tabaka', 'kume'].map(function (m, i) { return { x: i + 1, y0: 0, y1: SM.reps[m], c: ['#9DB8FF', '#7FE0C2', '#3E8E5B', '#F4A7B9'][i], lab: MN[m] + ': ' + f(SM.reps[m], 3) }; }) }) +
      IS.tip('Tabakalı örnekleme, tabakalar birbirinden farklıysa en isabetli tahmini verir. Küme örneklemesi ucuzdur ama kümeler birbirine benzemiyorsa hatası büyür.', 'SH');
  };
  /* ---------- sağlık: ROC ---------- */
  var R = { th: 125, prev: 10 }, H0 = { m: 100, s: 15 }, H1 = { m: 140, s: 20 };
  var rocDraw = function () {
    var sens = 1 - M.normCdf(R.th, H1.m, H1.s), spec = M.normCdf(R.th, H0.m, H0.s), lo = 40, hi = 210;
    var g0 = function (x) { return M.normPdf(x, H0.m, H0.s); }, g1 = function (x) { return M.normPdf(x, H1.m, H1.s); };
    C.$('[data-dens]', root).innerHTML = C.chart({ w: 640, h: 230, x: [lo, hi], y: [0, 0.03], anim: false, al: 'biyobelirteç dağılımları', xl: 'ölçüm (mg/dL)', yf: function () { return ''; }, pl: 14,
      s: [{ p: IS.curve(g0, lo, hi), c: '#3E8E5B', w: 2.4 }, { p: IS.curve(g1, lo, hi), c: '#C9483B', w: 2.4 }, { p: IS.curve(g0, R.th, hi), c: '#E0A526', w: 0.1, area: true }, { p: IS.curve(g1, lo, R.th), c: '#C9483B', w: 0.1, area: true }],
      vl: [{ x: R.th, c: '#0D1838', lab: 'eşik ' + R.th }] }) + '<div class="leg"><span><i style="background:#3E8E5B"></i>sağlıklı</span><span><i style="background:#C9483B"></i>hasta</span><span><i style="background:#F3D9A0"></i>yanlış alarm</span><span><i style="background:#F2C9C3"></i>kaçan hasta</span></div>';
    var roc = []; for (var t = lo; t <= hi; t += 2) roc.push([1 - M.normCdf(t, H0.m, H0.s), 1 - M.normCdf(t, H1.m, H1.s)]); roc.reverse();
    var auc = M.normCdf((H1.m - H0.m) / Math.sqrt(H0.s * H0.s + H1.s * H1.s));
    C.$('[data-roc]', root).innerHTML = '<div style="max-width:440px;margin:0 auto">' + C.chart({ w: 360, h: 300, x: [0, 1], y: [0, 1], anim: false, al: 'ROC eğrisi', xl: '1 − özgüllük', yl: 'duyarlılık', xf: function (v) { return f(v, 1); }, yf: function (v) { return f(v, 1); }, xt: 5, yt: 5,
      s: [{ p: [[0, 0], [1, 1]], c: '#9AA6B8', w: 1.2, d: '4 4' }, { p: roc, c: '#6B4FB3', w: 2.6, area: true }], dots: [{ x: 1 - spec, y: sens, c: '#E0A526', r: 7, cls: 'me' }] }) + '</div>';
    var N = 1000, D = N * R.prev / 100, tp = D * sens, fn = D - tp, tn = (N - D) * spec, fp = N - D - tn;
    C.$('[data-rk]', root).innerHTML = '<div class="kpis"><div class="kpi"><small>duyarlılık</small><b>%' + f(sens * 100, 1) + '</b></div><div class="kpi"><small>özgüllük</small><b>%' + f(spec * 100, 1) + '</b></div><div class="kpi hl"><small>PPV · P(hasta | +)</small><b>%' + f(tp / (tp + fp) * 100, 1) + '</b></div><div class="kpi"><small>NPV · P(sağlam | −)</small><b>%' + f(tn / (tn + fn) * 100, 1) + '</b></div><div class="kpi"><small>AUC</small><b>' + f(auc, 3) + '</b></div></div>' +
      '<div class="tbl-w"><table class="t"><thead><tr><th>1000 kişide</th><th class="n">hasta</th><th class="n">sağlıklı</th></tr></thead><tbody><tr><td>test +</td><td class="n">' + f(tp, 0) + '</td><td class="n">' + f(fp, 0) + '</td></tr><tr><td>test −</td><td class="n">' + f(fn, 0) + '</td><td class="n">' + f(tn, 0) + '</td></tr></tbody></table></div>';
  };

  var subDraw = function () {
    C.$$('[data-sub]', root).forEach(function (s) { s.hidden = s.getAttribute('data-sub') !== sub; });
    if (sub !== 'isletme') qcStop();
    if (sub === 'iktisat') ikDraw(); else if (sub === 'isletme') qcDraw(); else if (sub === 'sosyoloji') smDraw(); else rocDraw();
    FN.bridgeSend();
  };
  var QS = [
    { q: 'Laspeyres fiyat endeksi hangi miktarları kullanır?', o: ['baz dönem miktarları (q₀)', 'cari dönem miktarları (q₁)', 'ikisinin ortalamasını', 'miktar kullanmaz'], a: 0, n: 'L = Σp₁q₀ / Σp₀q₀ · 100.' },
    { q: 'x̄ kontrol kartında kontrol sınırları genellikle nasıl çizilir?', o: ['μ ± 3σ/√n', 'μ ± 2σ', 'μ ± σ', 'min ve maks değerlerde'], a: 0, n: 'Süreç kontrol altındaysa bir noktanın 3σ dışına düşme olasılığı yaklaşık %0,27.' },
    { q: 'Mahalleler birbirinden çok farklıysa en isabetli tahmini hangi yöntem verir?', o: ['tabakalı örnekleme', 'küme örneklemesi', 'kolayda örnekleme', 'kartopu örneklemesi'], a: 0, n: 'Her tabakadan payı kadar seçmek, tabakalar arası farkı tahmin hatasından çıkarır.' },
    { q: 'Tanı testinde eşiği düşürürsek ne olur?', o: ['duyarlılık artar, özgüllük azalır', 'ikisi de artar', 'duyarlılık azalır', 'AUC değişir'], a: 0, n: 'Daha çok kişi pozitif sayılır: hastaları kaçırmazsın ama yanlış alarm artar. AUC eşikten bağımsızdır.' },
    { q: '12 aylık hareketli ortalama aylık bir seride neyi büyük ölçüde siler?', o: ['mevsimsel dalgalanmayı', 'trendi', 'tüm bilgiyi', 'aykırı değerleri yaratır'], a: 0, n: 'Bir tam mevsim döngüsünün ortalaması, mevsim etkisini dengeler; trend kalır.' }
  ];

  IS.bank.bolum = QS;

  FN.st.bolum = {
    init: function () {
      root = C.$('#bolum');
      root.innerHTML = IS.head({ key: 'bolum', k: 'istasyon 9 · bölümüne özel', title: 'Bölüm köşeleri', sub: 'Aynı istatistik, dört farklı bölümün dilinde: iktisatta enflasyon endeksi, işletmede üretim hattı, sosyolojide anket örneklemi, sağlıkta tanı testi.', weeks: ['iktisat: endeks sayıları, zaman serisi', 'işletme: kalite kontrol', 'sosyoloji: örnekleme yöntemleri', 'sağlık: tanı testi, ROC'] }) +
        '<div class="seg" data-seg style="margin-bottom:14px"></div>' +
        '<div data-sub="iktisat"><div class="grid g2"><div class="card box" style="--cc:#B6E37A"><h2>Öğrenci sepeti endeksi</h2><p class="sub">Yeni fiyatları (p₁) değiştir. Miktarlar: q₀ geçen yıl, q₁ bu yıl.</p><div class="tbl-w" data-bk></div><div data-bx></div></div>' +
        '<div class="card box" style="--cc:#B6E37A"><h2>Zaman serisi</h2><p class="sub">Bir kafenin 36 aylık satış endeksi: trend + mevsim + gürültü.</p><div class="seg" data-w></div><div data-ts></div>' +
        IS.code({ x: [['=TOPLA.ÇARPIM(D2:D5;C2:C5)/TOPLA.ÇARPIM(B2:B5;C2:C5)*100', 'Laspeyres'], ['=ORTALAMA(B2:B13)', '12 aylık hareketli ortalama (aşağı sürükle)'], ['=EĞİLİM(B2:B37)', 'doğrusal trend değerleri']], r: [['sum(p1*q0) / sum(p0*q0) * 100', 'Laspeyres'], ['stats::filter(x, rep(1/12, 12), sides = 1)', 'hareketli ortalama'], ['decompose(ts(x, frequency = 12))', 'trend + mevsim ayrıştırma']] }) + '</div></div></div>' +
        '<div data-sub="isletme" hidden><div class="grid gside"><div class="card box" style="--cc:#B6E37A"><h2>Dolum hattı</h2><p class="sub">Paket hedefi 500 g, σ = 4 g. Her 0,6 saniyede 5 paketlik bir alt grup tartılır.</p><div class="row"><button type="button" class="btn sm pri" data-qrun>hattı çalıştır</button><button type="button" class="btn sm" data-qshift>makine ayarı kaysın (+5 g)</button><button type="button" class="btn sm" data-qfix>ayarı düzelt</button><button type="button" class="btn sm" data-qclr>kartı temizle</button></div><div class="kpis" data-qck></div>' +
        IS.tip('Kırmızı nokta: kontrol sınırı dışında. Turuncu: merkezin aynı tarafında 7 ardışık nokta (seri). İkisi de “özel bir neden var, hattı durdur, incele” der.', 'ÜKS') + IS.code({ x: [['=ORTALAMA(B2:F2)', 'alt grup ortalaması'], ['=500+3*4/KAREKÖK(5)', 'üst kontrol sınırı']], r: [['library(qcc); qcc(veri, type = "xbar")', 'qcc paketi']] }) + '</div><div class="card box" style="--cc:#B6E37A"><h2>x̄ kontrol kartı</h2><div data-qc></div></div></div></div>' +
        '<div data-sub="sosyoloji" hidden><div class="grid gside"><div class="card box" style="--cc:#B6E37A"><h2>Anket örneklemi</h2><p class="sub">200 kişilik bir ilçe, dört mahalle. Dolu nokta “evet” diyenler. 20 kişiyle evet oranını tahmin et.</p><div class="seg" data-sm></div><div class="row" style="margin-top:10px"><button type="button" class="btn sm pri" data-smgo>örneklem çek</button><button type="button" class="btn sm" data-smrep>her yöntemi 500 kez dene</button></div><div class="kpis" data-smk></div><div class="leg">' + ST.map(function (s) { return '<span><i style="background:' + s.c + '"></i>' + s.n + ' (%' + Math.round(s.p * 100) + ' evet)</span>'; }).join('') + '</div></div>' +
        '<div class="card box" style="--cc:#B6E37A"><div class="stage"><div class="bl-pop" data-pop></div></div><div data-smr></div>' + IS.code({ x: [['=İNDİS(A2:A201;RASTGELEARADA(1;200))', 'rastgele bir kişi'], ['=AL(SIRALAÖLÇÜT(A2:A201;RASTGELEDİZİ(200));20)', 'Microsoft 365: rastgele sırala, ilk 20’yi al']], r: [['d[sample(nrow(d), 20), ]', 'basit rastgele'], ['d[seq(sample(1:10, 1), 200, by = 10), ]', 'sistematik'], ['library(dplyr); d %>% group_by(mahalle) %>% slice_sample(prop = .1)', 'tabakalı']] }) + '</div></div></div>' +
        '<div data-sub="saglik" hidden><div class="grid g2"><div class="card box" style="--cc:#B6E37A"><h2>Eşik nereye?</h2><p class="sub">Bir biyobelirteç: sağlıklılarda ortalama 100, hastalarda 140. Eşiğin üstü “pozitif”.</p><label class="sl"><span>eşik değeri</span><input type="range" min="80" max="180" step="1" value="125" data-th><output data-tho>125</output></label><label class="sl"><span>yaygınlık</span><input type="range" min="1" max="50" step="1" value="10" data-pv><output data-pvo>%10</output></label><div data-dens></div><div data-rk></div></div>' +
        '<div class="card box" style="--cc:#B6E37A"><h2>ROC eğrisi</h2><p class="sub">Her eşik bir nokta. Sol üst köşeye ne kadar yakınsa o kadar iyi; köşegen yazı-turadır. Eğri altındaki alan AUC.</p><div data-roc></div>' + IS.code({ x: [['=1-NORM.DAĞ(125;140;20;DOĞRU)', 'duyarlılık'], ['=NORM.DAĞ(125;100;15;DOĞRU)', 'özgüllük']], r: [['library(pROC); roc(durum ~ olcum, data = d)', 'ROC ve AUC'], ['auc(roc(durum ~ olcum, data = d))', '']] }) + '</div></div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      IS.seg(C.$('[data-seg]', root), [['iktisat', 'İktisat'], ['isletme', 'İşletme'], ['sosyoloji', 'Sosyoloji'], ['saglik', 'Sağlık']], sub, function (k) { sub = k; subDraw(); });
      IS.seg(C.$('[data-w]', root), [['3', '3 aylık'], ['6', '6 aylık'], ['12', '12 aylık']], '12', function (k) { I.w = +k; ikDraw(); });
      C.$('[data-qrun]', root).onclick = function (e) {
        if (Q.timer) { qcStop(); return; }
        e.target.textContent = 'hattı durdur'; qcAdd(); qcDraw();
        Q.timer = setInterval(function () { qcAdd(); qcDraw(); }, C.RM ? 1200 : 600);
      };
      C.$('[data-qshift]', root).onclick = function () { Q.shift = 5; C.toast('makine ayarı +5 g kaydı; kartı izle'); };
      C.$('[data-qfix]', root).onclick = function () { Q.shift = 0; C.toast('ayar düzeltildi'); };
      C.$('[data-qclr]', root).onclick = function () { Q.pts = []; qcDraw(); };
      IS.seg(C.$('[data-sm]', root), Object.keys(MN).map(function (k) { return [k, MN[k]]; }), SM.m, function (k) { SM.m = k; SM.sel = draw(SM.m, SM.n); smDraw(); });
      C.$('[data-smgo]', root).onclick = function () { SM.sel = draw(SM.m, SM.n); smDraw(); FN.bridgeSend(); };
      C.$('[data-smrep]', root).onclick = function () {
        var out = {}; ['basit', 'sistem', 'tabaka', 'kume'].forEach(function (m) { var est = []; for (var i = 0; i < 500; i++) { var s = draw(m, SM.n); est.push(M.mean(s.map(function (j) { return POP[j].y; }))); } out[m] = M.sd(est); });
        SM.reps = out; smDraw();
      };
      C.$('[data-th]', root).addEventListener('input', function (e) { R.th = +e.target.value; C.$('[data-tho]', root).textContent = R.th; rocDraw(); });
      C.$('[data-pv]', root).addEventListener('input', function (e) { R.prev = +e.target.value; C.$('[data-pvo]', root).textContent = '%' + R.prev; rocDraw(); });
      SM.sel = [];
      subDraw();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Bölüm köşeleri');
    },
    hide: function () { qcStop(); },
    ctx: function () {
      if (sub === 'saglik') return IS.ctx('bolum', 'tanı testi', [['eşik', R.th], ['yaygınlık', '%' + R.prev]], 'sağlık öğrencisi tanı testi eşiği ve ROC eğrisi çalışıyor.', ['AUC nasıl yorumlanır?', 'PPV neden yaygınlığa bağlı?']);
      if (sub === 'sosyoloji') return IS.ctx('bolum', 'örnekleme', [['yöntem', MN[SM.m]], ['n', SM.n]], 'sosyoloji öğrencisi örnekleme yöntemlerini karşılaştırıyor.', ['Olasılıklı ve olasılıksız örnekleme farkı', 'Küme ile tabaka farkı nedir?']);
      if (sub === 'isletme') return IS.ctx('bolum', 'kontrol kartı', [['alt grup', Q.pts.length], ['kayma', Q.shift + ' g']], 'işletme öğrencisi istatistiksel süreç kontrolü çalışıyor.', ['Ortak neden ve özel neden farkı', 'Six Sigma ile ilişkisi']);
      return IS.ctx('bolum', 'fiyat endeksi', BASKET.map(function (b) { return [b.n, C.nf(b.p0) + ' → ' + C.nf(b.p1)]; }), 'iktisat öğrencisi fiyat endeksleri ve zaman serisi çalışıyor.', ['Laspeyres neden enflasyonu abartır?', 'Hareketli ortalama ne işe yarar?']);
    }
  };
})();
