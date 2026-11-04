/* ==========================================================================
   ACADEX İSTATİSTİK · 7. Kİ-KARE VE ANOVA TEZGÂHI (labs/istatistik/is-kikare.js), 03.11.2026
   İstatistik II, 6–9. hafta: ki-kare bağımsızlık ve uyum iyiliği, tek yönlü varyans analizi.
     - bağımsızlık: gözlenen tabloyu değiştir; beklenen = satır toplamı × sütun toplamı / N.
       Hücre rengi (G − B)² / B katkısını gösterir.
     - uyum iyiliği: zar adil mi?
     - ANOVA: gruplar arası fark ile grup içi yayılım halat çeker; F = KO_arası / KO_içi
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, sub = 'bag';
  var T = { rows: ['İşletme', 'Mühendislik'], cols: ['çay', 'kahve', 'enerji içeceği'], o: [[30, 45, 25], [40, 25, 35]] };
  var U = { o: [8, 9, 12, 7, 10, 14] };
  var chiTest = function (o) {
    var r = o.length, c = o[0].length, rs = o.map(function (row) { return M.sum(row); }), cs = o[0].map(function (_, j) { return M.sum(o.map(function (row) { return row[j]; })); }), N = M.sum(rs);
    var e = o.map(function (row, i) { return row.map(function (_, j) { return rs[i] * cs[j] / N; }); }), chi = 0, ct = [];
    o.forEach(function (row, i) { ct.push([]); row.forEach(function (v, j) { var k = e[i][j] ? (v - e[i][j]) * (v - e[i][j]) / e[i][j] : 0; ct[i].push(k); chi += k; }); });
    var df = (r - 1) * (c - 1); return { e: e, ct: ct, chi: chi, df: df, p: 1 - M.chiCdf(chi, df), rs: rs, cs: cs, N: N };
  };
  var chiCurve = function (chi, df) {
    var hi = Math.max(M.chiInv(0.999, df), chi * 1.1), cr = M.chiInv(0.95, df), F = function (x) { return M.chiPdf(x, df); };
    return C.chart({ w: 600, h: 200, x: [0, hi], y: [0, Math.max.apply(null, IS.curve(F, 0.2, hi, 80).map(function (q) { return q[1]; })) * 1.15], anim: false, al: 'ki-kare dağılımı', yf: function () { return ''; }, pl: 14, xl: 'χ²',
      s: [{ p: IS.curve(F, df === 1 ? 0.15 : 0.01, hi), c: '#6B4FB3', w: 2.2 }, { p: IS.curve(F, cr, hi), c: '#C9483B', w: 0.1, area: true }],
      vl: [{ x: cr, c: '#C9483B', lab: 'kritik ' + f(cr, 2) }, { x: Math.min(chi, hi), c: '#0D1838', lab: 'χ² = ' + f(chi, 2) }] });
  };
  var verdict = function (p) { return '<span class="verdict" style="color:' + (p < 0.05 ? 'var(--bad)' : 'var(--ok)') + '">' + (p < 0.05 ? 'H₀ REDDEDİLDİ' : 'H₀ REDDEDİLEMEDİ') + '</span>'; };
  var bagDraw = function () {
    var t = chiTest(T.o), mx = Math.max.apply(null, t.ct.map(function (r) { return Math.max.apply(null, r); })) || 1;
    var h = '<table class="t kk-t"><thead><tr><th></th>' + T.cols.map(function (c) { return '<th class="n">' + X(c) + '</th>'; }).join('') + '<th class="n">toplam</th></tr></thead><tbody>';
    T.o.forEach(function (row, i) {
      h += '<tr><th>' + X(T.rows[i]) + '</th>' + row.map(function (v, j) { var a = t.ct[i][j] / mx; return '<td class="n kk-c" style="--h:' + a.toFixed(2) + '"><input type="number" min="0" max="999" value="' + v + '" data-o="' + i + ',' + j + '" aria-label="' + X(T.rows[i] + ', ' + T.cols[j]) + '"><small>B: ' + f(t.e[i][j], 1) + ' · katkı ' + f(t.ct[i][j], 2) + '</small></td>'; }).join('') + '<td class="n"><b>' + t.rs[i] + '</b></td></tr>';
    });
    h += '</tbody><tfoot><tr><td>toplam</td>' + t.cs.map(function (c) { return '<td class="n">' + c + '</td>'; }).join('') + '<td class="n">' + t.N + '</td></tr></tfoot></table>';
    C.$('[data-ktab]', root).innerHTML = h;
    var bars = [], cols = ['#6B4FB3', '#C7A6FF'];
    T.o.forEach(function (row, i) { row.forEach(function (v, j) { var x = j * 3 + i; bars.push({ x: x, y0: 0, y1: v, c: cols[i], bw: 0.8, lab: T.rows[i] + ' · ' + T.cols[j] + ': gözlenen ' + v }); }); });
    var dots = []; T.o.forEach(function (row, i) { row.forEach(function (_, j) { dots.push({ x: j * 3 + i, y: t.e[i][j], c: '#FFD86B', r: 6, lab: 'beklenen ' + f(t.e[i][j], 1) }); }); });
    C.$('[data-kbar]', root).innerHTML = C.chart({ w: 600, h: 220, y0: true, x: [-0.8, T.cols.length * 3 - 1.2], nb: T.cols.length * 3, xticks: T.cols.map(function (_, j) { return j * 3 + 0.5; }), xf: function (v) { return T.cols[Math.round((v - 0.5) / 3)] || ''; }, al: 'gözlenen ve beklenen', yl: 'kişi', bars: bars, dots: dots }) +
      '<div class="leg"><span><i style="background:#6B4FB3"></i>' + X(T.rows[0]) + '</span><span><i style="background:#C7A6FF"></i>' + X(T.rows[1]) + '</span><span><i style="background:#FFD86B;border-radius:50%"></i>bağımsızlık olsaydı beklenen</span></div>';
    C.$('[data-kres]', root).innerHTML = '<div class="row" style="justify-content:space-between"><div><span class="lbl">χ² = Σ (G − B)² / B</span><div class="big">' + f(t.chi, 2) + '</div></div>' + verdict(t.p) + '</div>' +
      '<div class="kpis"><div class="kpi"><small>serbestlik derecesi (r − 1)(c − 1)</small><b>' + t.df + '</b></div><div class="kpi hl"><small>p-değeri</small><b>' + IS.p(t.p) + '</b></div><div class="kpi"><small>Cramér V</small><b>' + f(Math.sqrt(t.chi / (t.N * Math.min(T.rows.length - 1, T.cols.length - 1))), 3) + '</b></div></div>' + chiCurve(t.chi, t.df) +
      IS.tip('H₀: bölüm ile içecek tercihi <b>bağımsızdır</b>. En koyu hücre, farka en çok katkı yapan hücredir. Beklenen değerlerin hepsi 5’ten büyük olmalı.', 'χ²');
    C.$$('[data-o]', root).forEach(function (el) { el.addEventListener('change', function () { var ij = el.getAttribute('data-o').split(','), v = Math.max(0, Math.round(+el.value || 0)); T.o[+ij[0]][+ij[1]] = v; bagDraw(); FN.bridgeSend(); }); });
  };
  var uyumDraw = function () {
    var N = M.sum(U.o), e = N / 6, chi = 0; U.o.forEach(function (v) { chi += (v - e) * (v - e) / e; });
    var p = 1 - M.chiCdf(chi, 5);
    C.$('[data-uin]', root).innerHTML = U.o.map(function (v, i) { return '<label class="kk-die"><span>' + '⚀⚁⚂⚃⚄⚅'.charAt(i) + '</span><input type="number" min="0" max="999" value="' + v + '" data-u="' + i + '"></label>'; }).join('');
    C.$('[data-ubar]', root).innerHTML = C.chart({ w: 600, h: 220, y0: true, x: [0.5, 6.5], nb: 6, xticks: [1, 2, 3, 4, 5, 6], al: 'zar sonuçları', yl: 'kaç kez', hl: [{ y: e, c: '#B9821F', lab: 'beklenen ' + f(e, 1) }],
      bars: U.o.map(function (v, i) { return { x: i + 1, y0: 0, y1: v, c: '#6B4FB3', bw: 0.7, lab: (i + 1) + ': ' + v }; }) });
    C.$('[data-ures]', root).innerHTML = '<div class="row" style="justify-content:space-between"><div><span class="lbl">χ², sd = 5</span><div class="big">' + f(chi, 2) + '</div></div>' + verdict(p) + '</div><div class="kpis"><div class="kpi"><small>atış</small><b>' + N + '</b></div><div class="kpi hl"><small>p-değeri</small><b>' + IS.p(p) + '</b></div></div>' + chiCurve(chi, 5);
    C.$$('[data-u]', root).forEach(function (el) { el.addEventListener('change', function () { U.o[+el.getAttribute('data-u')] = Math.max(0, Math.round(+el.value || 0)); uyumDraw(); }); });
  };
  /* ---------- ANOVA ---------- */
  var A = { d: 6, s: 8, n: 10 }, GN = ['sabah', 'öğle', 'akşam'], GC = ['#FFB36B', '#7FE0C2', '#9DB8FF'];
  var Z = (function () { var r = M.seeded(42), out = [], rnd = Math.random; Math.random = r; for (var g = 0; g < 3; g++) { var a = []; for (var i = 0; i < 30; i++) a.push(M.randn()); var m = M.mean(a.slice(0, 30)); out.push(a.map(function (v) { return v - m; })); } Math.random = rnd; return out; })();
  var anovaData = function () { return [0, 1, 2].map(function (g) { return Z[g].slice(0, A.n).map(function (z) { return 70 + A.d * (g - 1) + A.s * z; }); }); };
  var anova = function (gs) {
    var all = [].concat.apply([], gs), gm = M.mean(all), ssb = 0, ssw = 0;
    gs.forEach(function (g) { var m = M.mean(g); ssb += g.length * (m - gm) * (m - gm); g.forEach(function (v) { ssw += (v - m) * (v - m); }); });
    var k = gs.length, N = all.length, dfb = k - 1, dfw = N - k, msb = ssb / dfb, msw = ssw / dfw, F = msb / msw;
    return { gm: gm, ssb: ssb, ssw: ssw, dfb: dfb, dfw: dfw, msb: msb, msw: msw, F: F, p: 1 - M.fCdf(F, dfb, dfw), eta: ssb / (ssb + ssw) };
  };
  var anovaDraw = function () {
    var gs = anovaData(), a = anova(gs), W = 600, H = 250, sy = IS.scale(30, 110, H - 20, 14), g = '';
    g += '<line class="av-gm" x1="20" x2="' + (W - 10) + '" y1="' + sy(a.gm).toFixed(1) + '" y2="' + sy(a.gm).toFixed(1) + '"/><text class="av-tx" x="' + (W - 12) + '" y="' + (sy(a.gm) - 6).toFixed(1) + '" text-anchor="end">genel ortalama</text>';
    gs.forEach(function (arr, k) {
      var x0 = 70 + k * 180, m = M.mean(arr);
      g += '<line class="av-gl" x1="' + (x0 - 50) + '" x2="' + (x0 + 50) + '" y1="' + sy(m).toFixed(1) + '" y2="' + sy(m).toFixed(1) + '" stroke="' + GC[k] + '"/>';
      g += '<line class="av-b" x1="' + (x0 + 58) + '" x2="' + (x0 + 58) + '" y1="' + sy(a.gm).toFixed(1) + '" y2="' + sy(m).toFixed(1) + '"/>';
      arr.forEach(function (v, i) { var x = x0 - 40 + (i % 10) * 9 + Math.floor(i / 10) * 3; g += '<line class="av-w" x1="' + x + '" x2="' + x + '" y1="' + sy(m).toFixed(1) + '" y2="' + sy(v).toFixed(1) + '"/><circle class="av-d" cx="' + x + '" cy="' + sy(v).toFixed(1) + '" r="4" fill="' + GC[k] + '"/>'; });
      g += '<text class="av-tx" x="' + x0 + '" y="' + (H - 2) + '" text-anchor="middle">' + GN[k] + ' · ' + f(m, 1) + '</text>';
    });
    C.$('[data-av]', root).innerHTML = '<svg class="av-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="üç grubun notları, grup ortalamaları ve genel ortalama">' + g + '</svg>';
    var pull = Math.max(-1, Math.min(1, Math.log(a.F) / Math.log(20)));
    C.$('[data-tug]', root).innerHTML = '<div class="av-tug"><span class="l">grup içi yayılım<br><b>KO_içi ' + f(a.msw, 1) + '</b></span><div class="av-rope"><i style="left:' + (50 + pull * 38).toFixed(1) + '%"></i></div><span class="r">gruplar arası fark<br><b>KO_arası ' + f(a.msb, 1) + '</b></span></div>';
    C.$('[data-atab]', root).innerHTML = '<div class="tbl-w"><table class="t"><thead><tr><th>kaynak</th><th class="n">KT</th><th class="n">sd</th><th class="n">KO</th><th class="n">F</th><th class="n">p</th></tr></thead><tbody>' +
      '<tr><td>gruplar arası</td><td class="n">' + f(a.ssb, 1) + '</td><td class="n">' + a.dfb + '</td><td class="n">' + f(a.msb, 1) + '</td><td class="n"><b>' + f(a.F, 2) + '</b></td><td class="n"><b>' + IS.p(a.p) + '</b></td></tr>' +
      '<tr><td>grup içi (hata)</td><td class="n">' + f(a.ssw, 1) + '</td><td class="n">' + a.dfw + '</td><td class="n">' + f(a.msw, 1) + '</td><td></td><td></td></tr></tbody><tfoot><tr><td>toplam</td><td class="n">' + f(a.ssb + a.ssw, 1) + '</td><td class="n">' + (a.dfb + a.dfw) + '</td><td></td><td></td><td></td></tr></tfoot></table></div>' +
      '<div class="row" style="justify-content:space-between;margin-top:8px"><span class="lbl">η² = KT_arası / KT_toplam = ' + f(a.eta, 3) + '</span>' + verdict(a.p) + '</div>';
  };

  var subDraw = function () { C.$$('[data-sub]', root).forEach(function (s) { s.hidden = s.getAttribute('data-sub') !== sub; }); if (sub === 'bag') bagDraw(); else if (sub === 'uyum') uyumDraw(); else anovaDraw(); FN.bridgeSend(); };
  var QS = [
    { q: '2 × 3’lük bir bağımsızlık tablosunda serbestlik derecesi kaçtır?', o: ['2', '6', '5', '3'], a: 0, n: '(2 − 1)(3 − 1) = 2.' },
    { q: 'Satır toplamı 100, sütun toplamı 70, genel toplam 200. Beklenen frekans?', o: ['35', '70', '50', '14'], a: 0, n: '100 · 70 / 200 = 35.' },
    { q: 'Ki-kare testinde beklenen frekanslar için kaba kural?', o: ['her hücrede en az 5 olmalı', 'hepsi eşit olmalı', 'en az 30 olmalı', 'tek sayı olmalı'], a: 0, n: 'Küçük beklenenlerde yaklaşım bozulur; hücre birleştir ya da Fisher kesin testini kullan.' },
    { q: 'ANOVA’da F oranı büyükse bu ne demektir?', o: ['gruplar arası fark, grup içi yayılıma göre büyüktür', 'gruplar aynıdır', 'varyanslar eşit değildir', 'örneklem küçüktür'], a: 0, n: 'F = KO_arası / KO_içi; büyük F, ortalamalardan en az birinin farklı olduğuna işaret eder.' },
    { q: 'ANOVA H₀’ı reddedildi. Hangi grupların farklı olduğunu nasıl anlarsın?', o: ['çoklu karşılaştırma (Tukey vb.)', 'F’ye bakarak', 'yeniden ANOVA yaparak', 'ki-kare ile'], a: 0, n: 'ANOVA “en az biri farklı” der; hangisi olduğunu post-hoc testler söyler.' }
  ];

  IS.bank.kikare = QS;

  FN.st.kikare = {
    init: function () {
      root = C.$('#kikare');
      var sl = function (k, lab, min, max, st) { return '<label class="sl"><span>' + lab + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + st + '" value="' + A[k] + '" data-ak="' + k + '"><output data-ako="' + k + '">' + A[k] + '</output></label>'; };
      root.innerHTML = IS.head({ key: 'kikare', k: 'istasyon 7 · kategorik veri ve varyans analizi', title: 'Ki-kare ve ANOVA tezgâhı', sub: 'Gözlenenle beklenen arasındaki fark tesadüf mü? Tabloyu değiştir, katkıları gör. ANOVA’da iki güç halat çeker: gruplar arası fark ve grup içi yayılım.', weeks: ['İst II · 6. hafta: ki-kare uyum iyiliği', '7. hafta: ki-kare bağımsızlık', '8–9. hafta: tek yönlü ANOVA'] }) +
        '<div class="seg" data-seg style="margin-bottom:14px"></div>' +
        '<div data-sub="bag"><div class="grid g2"><div class="card box" style="--cc:#C7A6FF"><h2>Çapraz tablo</h2><p class="sub">Hücreleri değiştir. Her hücrede G gözlenen, B bağımsızlık olsaydı beklenen sayı.</p><div class="tbl-w" data-ktab></div><div data-kbar></div></div><div class="card box" style="--cc:#C7A6FF" data-kres></div></div></div>' +
        '<div data-sub="uyum" hidden><div class="grid g2"><div class="card box" style="--cc:#C7A6FF"><h2>Zar adil mi?</h2><p class="sub">60 atışın sonucunu gir. Adil zarda her yüz 10 kez beklenir.</p><div class="kk-dice" data-uin></div><div data-ubar></div></div><div class="card box" style="--cc:#C7A6FF" data-ures></div></div></div>' +
        '<div data-sub="anova" hidden><div class="grid gside"><div class="card box" style="--cc:#C7A6FF"><h2>Üç şube</h2><p class="sub">Sabah, öğle ve akşam şubelerinin sınav notları. Ortalamalar gerçekten farklı mı?</p>' + sl('d', 'gruplar arası fark', 0, 15, 0.5) + sl('s', 'grup içi yayılım', 2, 15, 0.5) + sl('n', 'şube başına öğrenci', 4, 30, 1) + '<div data-tug></div></div>' +
        '<div class="card box" style="--cc:#C7A6FF"><div class="stage" data-av></div><div data-atab></div></div></div></div>' +
        '<div class="grid g2" style="margin-top:18px"><div>' + IS.quizCard() + '</div><div class="card box" style="--cc:#C7A6FF"><h2>Bilgisayarda</h2>' +
        IS.code({ x: [['=KİKARE.TEST(B2:D3;B6:D7)', 'gözlenen ve beklenen aralıklarından p'], ['=KİKARE.DAĞ.SAĞK(9,49;2)', 'χ²’den p'], ['=KİKARE.TERS.SAĞK(0,05;2)', 'kritik değer 5,99'], ['=F.DAĞ.SAĞK(4,2;2;27)', 'F’den p'], ['Veri › Veri Çözümleme › Anova: Tek Etken', 'Çözümleme Araç Paketi açık olmalı']],
          r: [['tablo <- matrix(c(30, 40, 45, 25, 25, 35), nrow = 2)', ''], ['chisq.test(tablo)', 'beklenenler: chisq.test(tablo)$expected'], ['chisq.test(c(8, 9, 12, 7, 10, 14), p = rep(1/6, 6))', 'uyum iyiliği'], ['summary(aov(not ~ sube, data = d))', 'tek yönlü ANOVA'], ['TukeyHSD(aov(not ~ sube, data = d))', 'hangi şubeler farklı?']] }) + '</div></div>';
      IS.seg(C.$('[data-seg]', root), [['bag', 'Bağımsızlık'], ['uyum', 'Uyum iyiliği'], ['anova', 'ANOVA']], sub, function (k) { sub = k; subDraw(); });
      C.$$('[data-ak]', root).forEach(function (el) { el.addEventListener('input', function () { var k = el.getAttribute('data-ak'); A[k] = +el.value; C.$('[data-ako="' + k + '"]', root).textContent = A[k]; anovaDraw(); }); });
      subDraw();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Ki-kare ve ANOVA');
    },
    ctx: function () {
      if (sub === 'anova') { var a = anova(anovaData()); return IS.ctx('kikare', 'ANOVA', [['F', f(a.F, 2)], ['p', IS.p(a.p)], ['KO arası', f(a.msb, 1)], ['KO içi', f(a.msw, 1)]], 'öğrenci tek yönlü ANOVA çalışıyor.', ['ANOVA varsayımları neler?', 'Neden üç ayrı t testi yapmıyoruz?']); }
      var t = sub === 'uyum' ? null : chiTest(T.o);
      return IS.ctx('kikare', sub === 'uyum' ? 'uyum iyiliği' : 'bağımsızlık', sub === 'uyum' ? [['gözlenen', U.o.join(', ')]] : [['tablo', JSON.stringify(T.o)], ['χ²', f(t.chi, 2)], ['sd', t.df], ['p', IS.p(t.p)]],
        'öğrenci ki-kare testini çalışıyor.', ['Beklenen frekansı nasıl buluyoruz?', 'Cramér V neyi ölçer?']);
    }
  };
})();
