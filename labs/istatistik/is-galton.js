/* ==========================================================================
   ACADEX İSTATİSTİK · 4. GALTON TAHTASI VE MERKEZÎ LİMİT (labs/istatistik/is-galton.js), 03.11.2026
   İstatistik I, 10–11. hafta: örnekleme dağılımı, standart hata, merkezî limit teoremi.
     - Galton tahtası (canvas): bilyeler çivilere çarpıp sağa/sola sapar; kutularda binom,
       çok bilyede çan eğrisi oluşur. Eğim sürgüsü p'yi değiştirir (çarpık binom).
     - MLT: ana kütle ne kadar çarpık olursa olsun, n büyüdükçe örneklem ortalamaları
       normale yaklaşır ve yayılımı σ/√n'e iner.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, cv, cx, ROWS = 12, CW = 640, CH = 440, raf = 0;
  var G = { p: 0.5, balls: [], bins: [], total: 0, queue: 0 };
  var resetG = function () { G.balls = []; G.bins = []; for (var i = 0; i <= ROWS; i++) G.bins.push(0); G.total = 0; G.queue = 0; };
  resetG();
  var pegX = function (r, k) { return CW / 2 + (k - r / 2) * 40; }, pegY = function (r) { return 40 + r * 22; };
  var BIN_TOP = pegY(ROWS) + 10;
  var spawn = function () { var path = []; for (var r = 0; r < ROWS; r++) path.push(Math.random() < G.p ? 1 : 0); G.balls.push({ path: path, t: 0, k: 0, hue: Math.random() }); };
  var ballPos = function (b) {
    var r = Math.floor(b.t), fr = b.t - r, k = 0; for (var i = 0; i < Math.min(r, ROWS); i++) k += b.path[i];
    if (r >= ROWS) return { x: pegX(ROWS, k), y: pegY(ROWS) + (b.t - ROWS) * 60, k: k };
    var x0 = pegX(r, k), x1 = pegX(r + 1, k + b.path[r]), y0 = pegY(r) - 9, y1 = pegY(r + 1) - 9;
    return { x: x0 + (x1 - x0) * fr, y: y0 + (y1 - y0) * fr - Math.sin(fr * Math.PI) * 9, k: k };
  };
  var paint = function () {
    var c = cx; c.clearRect(0, 0, CW, CH);
    var g = c.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, '#0F1B3E'); g.addColorStop(1, '#1A2B5A'); c.fillStyle = g; c.fillRect(0, 0, CW, CH);
    c.fillStyle = '#AEB8DC';
    for (var r = 0; r < ROWS; r++) for (var k = 0; k <= r; k++) { c.beginPath(); c.arc(pegX(r, k), pegY(r), 3, 0, 7); c.fill(); }
    /* kutular */
    var max = Math.max(4, Math.max.apply(null, G.bins)), hmax = CH - BIN_TOP - 26;
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1;
    for (var j = 0; j <= ROWS + 1; j++) { var x = pegX(ROWS, j) - 20; c.beginPath(); c.moveTo(x, BIN_TOP); c.lineTo(x, CH - 22); c.stroke(); }
    G.bins.forEach(function (n, j) {
      var h = n / max * hmax, x = pegX(ROWS, j) - 16;
      var gr = c.createLinearGradient(0, CH - 22 - h, 0, CH - 22); gr.addColorStop(0, '#FFD86B'); gr.addColorStop(1, '#E0A526');
      c.fillStyle = gr; c.fillRect(x, CH - 22 - h, 32, h);
      c.fillStyle = '#AEB8DC'; c.font = '11px JetBrains Mono, monospace'; c.textAlign = 'center'; c.fillText(String(j), x + 16, CH - 7);
    });
    /* beklenen binom eğrisi */
    if (G.total > 0) {
      c.strokeStyle = '#7FE0C2'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath();
      for (var q = 0; q <= ROWS * 4; q++) {
        var kk = q / 4, lo = Math.floor(kk), fr = kk - lo, e = G.total * ((1 - fr) * M.binomPmf(lo, ROWS, G.p) + fr * M.binomPmf(Math.min(ROWS, lo + 1), ROWS, G.p));
        var px = pegX(ROWS, kk), py = CH - 22 - e / max * hmax; if (q) c.lineTo(px, py); else c.moveTo(px, py);
      }
      c.stroke(); c.setLineDash([]);
    }
    G.balls.forEach(function (b) { var p = ballPos(b); c.fillStyle = 'hsl(' + (40 + b.hue * 20) + ',100%,' + (65 + b.hue * 15) + '%)'; c.shadowColor = '#FFD86B'; c.shadowBlur = 8; c.beginPath(); c.arc(p.x, p.y, 5, 0, 7); c.fill(); c.shadowBlur = 0; });
  };
  var lastT = 0;
  var tick = function (t) {
    var dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    var sp = G.queue > 60 ? 26 : 9;
    if (G.queue > 0) { var n = G.queue > 200 ? 8 : G.queue > 40 ? 3 : 1; if (!tick.cd || tick.cd <= 0) { for (var i = 0; i < n && G.queue > 0; i++) { spawn(); G.queue--; } tick.cd = G.queue > 40 ? 0 : 0.12; } else tick.cd -= dt; }
    G.balls = G.balls.filter(function (b) {
      b.t += dt * sp; if (b.t >= ROWS + 0.6) { var k = 0; b.path.forEach(function (v) { k += v; }); G.bins[k]++; G.total++; return false; } return true;
    });
    paint(); stats();
    if (G.balls.length || G.queue > 0) raf = requestAnimationFrame(tick); else { raf = 0; lastT = 0; FN.bridgeSend(); }
  };
  var drop = function (n) {
    if (C.RM) { for (var i = 0; i < n; i++) { var k = 0; for (var r = 0; r < ROWS; r++) k += Math.random() < G.p ? 1 : 0; G.bins[k]++; G.total++; } paint(); stats(); return; }
    G.queue += n; if (!raf) raf = requestAnimationFrame(tick);
  };
  var stats = function () {
    var n = G.total, m = 0, v = 0; G.bins.forEach(function (c, k) { m += c * k; }); m = n ? m / n : 0; G.bins.forEach(function (c, k) { v += c * (k - m) * (k - m); }); v = n > 1 ? v / (n - 1) : 0;
    C.$('[data-gk]', root).innerHTML = '<div class="kpi"><small>düşen bilye</small><b>' + C.nf(n) + '</b></div><div class="kpi hl"><small>ortalama kutu</small><b>' + (n ? f(m, 2) : '—') + '</b></div><div class="kpi"><small>beklenen np</small><b>' + f(ROWS * G.p, 2) + '</b></div><div class="kpi"><small>std. sapma · √(np(1−p))</small><b>' + (n > 1 ? f(Math.sqrt(v), 2) : '—') + ' · ' + f(Math.sqrt(ROWS * G.p * (1 - G.p)), 2) + '</b></div>';
  };

  /* ---------- merkezî limit ---------- */
  var POP = {
    zar: { t: 'zar (tekdüze)', mu: 3.5, s: Math.sqrt(35 / 12), r: [1, 6], gen: function () { return 1 + Math.floor(Math.random() * 6); } },
    ustel: { t: 'bekleme süresi (sağa çarpık)', mu: 2, s: 2, r: [0, 12], gen: function () { return -2 * Math.log(1 - Math.random()); } },
    ikitepe: { t: 'iki tepeli', mu: 4.5, s: Math.sqrt(6.75), r: [0, 9.5], gen: function () { return Math.random() < 0.5 ? 2 + 0.6 * M.randn() : 7 + 0.8 * M.randn(); } },
    bern: { t: 'evet / hayır (p = 0,2)', mu: 0.2, s: 0.4, r: [0, 1], gen: function () { return Math.random() < 0.2 ? 1 : 0; } }
  };
  var L = { pop: 'ustel', n: 5, means: [], last: null, busy: false };
  var popHist = {};
  var popChart = function () {
    var P = POP[L.pop];
    if (!popHist[L.pop]) { var r = M.seeded(7), a = []; var rnd = Math.random; Math.random = r; for (var i = 0; i < 4000; i++) a.push(P.gen()); Math.random = rnd; popHist[L.pop] = a; }
    var a = popHist[L.pop], k = L.pop === 'zar' ? 6 : L.pop === 'bern' ? 2 : 24, lo = P.r[0] - (L.pop === 'zar' ? 0.5 : L.pop === 'bern' ? 0.5 : 0), hi = P.r[1] + (L.pop === 'zar' || L.pop === 'bern' ? 0.5 : 0);
    var h = M.hist(a.filter(function (v) { return v >= lo && v <= hi; }), k, lo, hi);
    return C.chart({ w: 320, h: 180, y0: true, nb: k, x: [lo, hi], al: 'ana kütle', yl: 'ana kütle', yf: function () { return ''; }, pl: 14, anim: false,
      bars: h.c.map(function (c, i) { return { x: lo + h.w * (i + 0.5), y0: 0, y1: c, c: '#9DB8FF', bw: 0.92 }; }),
      dots: (L.last || []).map(function (v) { return { x: Math.min(hi, Math.max(lo, v)), y: 0, c: '#FFD86B', r: 4 }; }), vl: [{ x: P.mu, c: '#C8553D', lab: 'μ' }] });
  };
  var sampChart = function () {
    var P = POP[L.pop], lo = P.r[0], hi = Math.min(P.r[1], P.mu + 4.2 * P.s), k = 40, se = P.s / Math.sqrt(L.n);
    if (L.pop === 'ustel') hi = 8;
    var h = M.hist(L.means.length ? L.means.filter(function (v) { return v >= lo && v <= hi; }) : [lo], k, lo, hi), cnt = L.means.length ? h.c : h.c.map(function () { return 0; });
    var s = L.means.length > 20 ? [{ p: IS.curve(function (x) { return L.means.length * h.w * M.normPdf(x, P.mu, se); }, lo, hi, 160), c: '#7FE0C2', w: 2.2, d: '6 4', lab: 'N(μ, σ/√n)' }] : [];
    return C.chart({ w: 640, h: 260, y0: true, y: L.means.length ? undefined : [0, 10], nb: k, x: [lo, hi], al: 'örneklem ortalamalarının dağılımı', xl: 'x̄', yl: 'kaç örneklem', anim: false,
      bars: cnt.map(function (c, i) { return { x: lo + h.w * (i + 0.5), y0: 0, y1: c, c: '#E0A526', bw: 0.9 }; }), s: s, vl: [{ x: P.mu, c: '#C8553D', lab: 'μ = ' + f(P.mu, 2) }] });
  };
  var cltDraw = function () {
    var P = POP[L.pop], se = P.s / Math.sqrt(L.n), m = M.mean(L.means), sd = M.sd(L.means);
    C.$('[data-pop]', root).innerHTML = popChart();
    C.$('[data-samp]', root).innerHTML = sampChart();
    C.$('[data-ck]', root).innerHTML = '<div class="kpi"><small>örneklem sayısı</small><b>' + C.nf(L.means.length) + '</b></div><div class="kpi"><small>x̄’lerin ortalaması · μ</small><b>' + (L.means.length ? f(m, 2) : '—') + ' · ' + f(P.mu, 2) + '</b></div><div class="kpi hl"><small>x̄’lerin std. sapması · σ/√n</small><b>' + (L.means.length > 1 ? f(sd, 3) : '—') + ' · ' + f(se, 3) + '</b></div>';
  };
  var sample = function () { var a = [], P = POP[L.pop]; for (var i = 0; i < L.n; i++) a.push(P.gen()); L.last = a; L.means.push(M.mean(a)); };
  var cltRun = function (k) {
    if (L.busy) return;
    if (k === 1 || C.RM) { for (var i = 0; i < k; i++) sample(); cltDraw(); return; }
    L.busy = true; var left = k, per = Math.max(1, Math.ceil(k / 50));
    var st = function () { for (var j = 0; j < per && left > 0; j++, left--) sample(); cltDraw(); if (left > 0) requestAnimationFrame(st); else { L.busy = false; FN.bridgeSend(); } };
    requestAnimationFrame(st);
  };

  var QS = [
    { q: 'Ana kütle σ = 12. n = 36’lık örneklemlerin ortalamalarının standart sapması (standart hata) kaçtır?', o: ['2', '12', '0,33', '6'], a: 0, n: 'σ/√n = 12/6 = 2.' },
    { q: 'Merkezî limit teoremi ne söyler?', o: ['n büyüdükçe örneklem ortalamaları yaklaşık normal dağılır', 'ana kütle her zaman normaldir', 'n büyüdükçe veri normalleşir', 'örneklem ortalaması her zaman μ’ye eşittir'], a: 0, n: 'Normalleşen, tek tek gözlemler değil; ortalamaların (örnekleme) dağılımıdır.' },
    { q: 'Standart hatayı yarıya indirmek için örneklem büyüklüğü kaç katına çıkmalı?', o: ['4 katına', '2 katına', '√2 katına', '8 katına'], a: 0, n: 'SH = σ/√n; √n’in iki katı olması için n dört katına çıkmalı.' },
    { q: 'Galton tahtasında eğimi sağa verirsek (p = 0,7) kutuların dağılımı nasıl olur?', o: ['tepe sağa kayar, dağılım binom(12; 0,7) olur', 'tekdüze olur', 'değişmez', 'iki tepeli olur'], a: 0, n: 'Her çivide sağa gitme olasılığı 0,7; kutu numarası Binom(12; 0,7), beklenen 8,4.' },
    { q: 'Pratikte MLT’yi kullanmak için sık söylenen örneklem eşiği nedir?', o: ['n ≥ 30', 'n ≥ 3', 'n ≥ 1000', 'n tek sayı olmalı'], a: 0, n: 'Kaba bir kural; ana kütle çok çarpıksa daha büyük n gerekir. Yukarıda üstel dağılımla dene.' }
  ];

  FN.st.galton = {
    init: function () {
      root = C.$('#galton');
      root.innerHTML = IS.head({ k: 'istasyon 4 · örnekleme dağılımı', title: 'Galton tahtası ve merkezî limit', sub: 'Her bilye 12 çiviye çarpar; her çarpışmada sağa ya da sola sapar. Tek bilye rastgele, binlercesi bir <b>çan eğrisi</b> çizer. Sonra çarpık bir ana kütleden örneklem al: ortalamalar yine normale koşar.', weeks: ['İst I · 10. hafta: örnekleme dağılımı', '11. hafta: merkezî limit teoremi, standart hata'] }) +
        '<div class="grid gside"><div class="card box" style="--cc:#9DB8FF"><h2>Galton tahtası</h2><p class="sub">Yeşil kesikli çizgi binom dağılımının beklediği yükseklik.</p>' +
        '<div class="row"><button type="button" class="btn sm pri" data-drop="1">1 bilye</button><button type="button" class="btn sm" data-drop="50">50</button><button type="button" class="btn sm" data-drop="500">500</button><button type="button" class="btn sm" data-drop="0">boşalt</button></div>' +
        '<label class="sl"><span>tahta eğimi: sağa sapma olasılığı p</span><input type="range" min="0.1" max="0.9" step="0.05" value="0.5" data-gp><output data-gpo>0,50</output></label><div class="kpis" data-gk></div>' +
        IS.tip('Bir bilyenin kutu numarası = sağa sapma sayısı. 12 bağımsız deneme, her biri p: tam olarak <b>Binom(12, p)</b>.', 'B(12,p)') + '</div>' +
        '<div class="card box" style="--cc:#9DB8FF"><canvas class="gt-cv" width="' + CW + '" height="' + CH + '" role="img" aria-label="Galton tahtası: bilyeler çivilerden düşüp kutularda birikir"></canvas></div></div>' +
        '<div class="grid gside" style="margin-top:18px"><div class="card box" style="--cc:#E0A526"><h2>Merkezî limit</h2><p class="sub">Ana kütle seç, örneklem büyüklüğü n’i ayarla, örneklem çek.</p><div class="seg" data-pp></div><div data-pop style="margin-top:8px"></div>' +
        '<p class="lbl" style="margin:8px 0 4px">örneklem büyüklüğü n</p><div class="seg" data-n></div>' +
        '<div class="row" style="margin-top:10px"><button type="button" class="btn sm pri" data-cs="1">1 örneklem</button><button type="button" class="btn sm" data-cs="100">100</button><button type="button" class="btn sm" data-cs="1000">1000</button><button type="button" class="btn sm" data-cs="0">sıfırla</button></div></div>' +
        '<div class="card box" style="--cc:#E0A526"><h2>Örneklem ortalamaları</h2><p class="sub">Her örneklemin ortalaması bir sütuna düşer. n’i 1’den 30’a çıkar ve eğrinin daralışını izle.</p><div data-samp></div><div class="kpis" data-ck></div>' +
        IS.code({ x: [['=STDSAPMA.S(A2:A31)/KAREKÖK(SAY(A2:A31))', 'standart hata s/√n'], ['=ORTALAMA(RASTGELEDİZİ(30;1;1;6;DOĞRU))', '30 zarın ortalaması (Microsoft 365)']], r: [['xbar <- replicate(1000, mean(rexp(5, rate = 1/2)))', '1000 örneklem, n = 5, üstel'], ['hist(xbar); sd(xbar)', 'σ/√n = 2/√5 ≈ 0,894'], ['sd(x) / sqrt(length(x))', 'standart hata']] }) + '</div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      cv = C.$('.gt-cv', root); cx = cv.getContext('2d');
      C.$$('[data-drop]', root).forEach(function (b) { b.onclick = function () { var n = +b.getAttribute('data-drop'); if (!n) { resetG(); paint(); stats(); return; } drop(n); }; });
      C.$('[data-gp]', root).addEventListener('input', function (e) { G.p = +e.target.value; C.$('[data-gpo]', root).textContent = f(G.p, 2); resetG(); paint(); stats(); });
      IS.seg(C.$('[data-pp]', root), Object.keys(POP).map(function (k) { return [k, POP[k].t]; }), L.pop, function (k) { L.pop = k; L.means = []; L.last = null; cltDraw(); FN.bridgeSend(); });
      IS.seg(C.$('[data-n]', root), [1, 2, 5, 10, 30].map(function (n) { return [String(n), 'n = ' + n]; }), String(L.n), function (k) { L.n = +k; L.means = []; L.last = null; cltDraw(); FN.bridgeSend(); });
      C.$$('[data-cs]', root).forEach(function (b) { b.onclick = function () { var n = +b.getAttribute('data-cs'); if (!n) { L.means = []; L.last = null; cltDraw(); return; } cltRun(n); }; });
      paint(); stats(); cltDraw();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Galton ve MLT');
    },
    hide: function () { if (raf) { cancelAnimationFrame(raf); raf = 0; lastT = 0; G.balls.forEach(function (b) { var k = 0; b.path.forEach(function (v) { k += v; }); G.bins[k]++; G.total++; }); G.balls = []; G.queue = 0; } },
    show: function () { if (cx) { paint(); stats(); } },
    ctx: function () {
      var P = POP[L.pop];
      return IS.ctx('galton', 'merkezî limit', [['ana kütle', P.t], ['μ', f(P.mu, 2)], ['σ', f(P.s, 2)], ['n', L.n], ['örneklem sayısı', L.means.length], ['standart hata σ/√n', f(P.s / Math.sqrt(L.n), 3)], ['Galton bilyesi', G.total]],
        'öğrenci örnekleme dağılımı ve merkezî limit teoremini simülasyonla çalışıyor.', ['Standart sapma ile standart hata farkı?', 'MLT neden bu kadar önemli?']);
    }
  };
})();
