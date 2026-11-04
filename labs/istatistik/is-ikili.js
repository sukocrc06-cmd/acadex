/* ==========================================================================
   ACADEX İSTATİSTİK · İKİ ANAKÜTLE VE PARAMETRİK OLMAYAN TESTLER (labs/istatistik/is-ikili.js), 03.11.2026
   AYBÜ BUS202 3., 5. ve 14. hafta: iki anakütlenin karşılaştırılması (tahmin ve test),
   bağımsız iki ortalama (ortak varyans / Welch), eşleştirilmiş t, iki oran; parametrik olmayan
   testler: Mann-Whitney U, Wilcoxon işaretli sıralar, işaret testi, Spearman, Kruskal-Wallis.
     - bağımsız: iki grup çanı ve farkın güven aralığı; aralık sıfırı içeriyor mu?
     - eşleştirilmiş: önce–sonra çizgileri; aynı veriye yanlışlıkla bağımsız test yapılırsa ne olur
     - iki oran: A/B testi, 10 × 10 ızgaralar
     - parametrik olmayan: değerler tek sıraya dizilir, sıra numarası alır (animasyon)
   p-değerleri: Mann-Whitney ve Wilcoxon için normal yaklaşım (küçük örneklemde R'nin kesin
   değerinden biraz farklı olabilir), işaret testi kesin binom, Kruskal-Wallis ki-kare yaklaşımı.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, sub = 'bag';
  var sl = function (obj, k, lab, min, max, st, key) { return '<label class="sl"><span>' + lab + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + st + '" value="' + obj[k] + '" data-' + key + '="' + k + '"><output data-' + key + 'o="' + k + '">' + f(obj[k], st < 1 ? 1 : 0) + '</output></label>'; };
  var bind = function (key, obj, fn) { C.$$('[data-' + key + ']', root).forEach(function (el) { el.addEventListener('input', function () { var k = el.getAttribute('data-' + key); obj[k] = +el.value; C.$('[data-' + key + 'o="' + k + '"]', root).textContent = f(obj[k], +el.step < 1 ? 1 : 0); fn(); }); }); };
  var verdict = function (p) { return '<span class="verdict" style="color:' + (p < 0.05 ? 'var(--bad)' : 'var(--ok)') + '">' + (p < 0.05 ? 'H₀ REDDEDİLDİ' : 'H₀ REDDEDİLEMEDİ') + '</span>'; };

  /* ---------- bağımsız iki ortalama ---------- */
  var B = { m1: 74.1, s1: 9.5, n1: 20, m2: 68.3, s2: 10.2, n2: 22, welch: false };
  var bagTest = function () {
    var o = {}, b = B;
    if (b.welch) { o.se = Math.sqrt(b.s1 * b.s1 / b.n1 + b.s2 * b.s2 / b.n2); o.df = M.welchDf(b.s1, b.n1, b.s2, b.n2); }
    else { o.sp = Math.sqrt(((b.n1 - 1) * b.s1 * b.s1 + (b.n2 - 1) * b.s2 * b.s2) / (b.n1 + b.n2 - 2)); o.se = o.sp * Math.sqrt(1 / b.n1 + 1 / b.n2); o.df = b.n1 + b.n2 - 2; }
    o.d = b.m1 - b.m2; o.t = o.d / o.se; o.p = 2 * (1 - M.tCdf(Math.abs(o.t), o.df)); o.tc = M.tInv(0.975, o.df); o.lo = o.d - o.tc * o.se; o.hi = o.d + o.tc * o.se; return o;
  };
  var bagDraw = function () {
    var o = bagTest(), lo = 30, hi = 110;
    C.$('[data-bch]', root).innerHTML = C.chart({ w: 620, h: 210, x: [lo, hi], y: [0, 0.05], anim: false, al: 'iki grubun dağılımı', yf: function () { return ''; }, pl: 14, xl: 'not',
      s: [{ p: IS.curve(function (x) { return M.normPdf(x, B.m1, B.s1); }, lo, hi), c: '#2F6FB0', w: 2.6, area: true }, { p: IS.curve(function (x) { return M.normPdf(x, B.m2, B.s2); }, lo, hi), c: '#C8553D', w: 2.6, area: true }],
      vl: [{ x: B.m1, c: '#2F6FB0', lab: 'x̄A' }, { x: B.m2, c: '#C8553D', lab: 'x̄B' }] });
    var sx = IS.scale(-15, 25, 30, 590), hit = o.lo <= 0 && 0 <= o.hi;
    C.$('[data-bci]', root).innerHTML = '<svg viewBox="0 0 620 90" class="ik-ci" role="img" aria-label="farkın güven aralığı"><line x1="30" x2="590" y1="50" y2="50" class="ik-ax"/>' + [-15, -10, -5, 0, 5, 10, 15, 20, 25].map(function (v) { return '<text x="' + sx(v) + '" y="80" text-anchor="middle">' + v + '</text>'; }).join('') +
      '<line x1="' + sx(0) + '" x2="' + sx(0) + '" y1="18" y2="62" class="ik-zero"/><text x="' + (sx(0) + 4) + '" y="14" class="ik-zt">fark yok (0)</text><g class="ik-bar' + (hit ? '' : ' sig') + '" style="transform:translateX(0)"><line x1="' + sx(Math.max(-15, o.lo)).toFixed(1) + '" x2="' + sx(Math.min(25, o.hi)).toFixed(1) + '" y1="50" y2="50"/><circle cx="' + sx(o.d).toFixed(1) + '" cy="50" r="7"/></g></svg>' +
      '<p class="lbl">μA − μB için %95 aralık: <b>[' + f(o.lo, 2) + ' ; ' + f(o.hi, 2) + ']</b> · ' + (hit ? 'sıfırı içeriyor: fark anlamlı değil' : 'sıfırı içermiyor: fark anlamlı') + '</p>';
    C.$('[data-bres]', root).innerHTML = '<div class="row" style="justify-content:space-between"><div><span class="lbl">t = ' + f(o.t, 3) + ', sd = ' + f(o.df, 1) + '</span><div class="big">p = ' + IS.p(o.p) + '</div></div>' + verdict(o.p) + '</div>';
    IS.steps(C.$('[data-bst]', root), B.welch ? [
      { t: 'standart hata (Welch)', x: 'SH = √(s₁²/n₁ + s₂²/n₂) = √(' + f(B.s1, 1) + '²/' + B.n1 + ' + ' + f(B.s2, 1) + '²/' + B.n2 + ') = ' + f(o.se, 3) },
      { t: 'serbestlik derecesi', x: 'Welch–Satterthwaite: sd ≈ ' + f(o.df, 2) },
      { t: 'test istatistiği', x: 't = (' + f(B.m1, 1) + ' − ' + f(B.m2, 1) + ') / ' + f(o.se, 3) + ' = ' + f(o.t, 3) },
      { t: 'aralık', x: f(o.d, 2) + ' ± ' + f(o.tc, 3) + ' · ' + f(o.se, 3) + ' = [' + f(o.lo, 2) + ' ; ' + f(o.hi, 2) + ']' }] : [
      { t: 'ortak varyans', x: 'sₚ² = (' + (B.n1 - 1) + '·' + f(B.s1, 1) + '² + ' + (B.n2 - 1) + '·' + f(B.s2, 1) + '²) / ' + o.df + ' = ' + f(o.sp * o.sp, 2) },
      { t: 'standart hata', x: 'SH = ' + f(o.sp, 3) + ' · √(1/' + B.n1 + ' + 1/' + B.n2 + ') = ' + f(o.se, 3) },
      { t: 'test istatistiği', x: 't = (' + f(B.m1, 1) + ' − ' + f(B.m2, 1) + ') / ' + f(o.se, 3) + ' = ' + f(o.t, 3) + ', sd = ' + o.df },
      { t: 'aralık', x: f(o.d, 2) + ' ± ' + f(o.tc, 3) + ' · ' + f(o.se, 3) + ' = [' + f(o.lo, 2) + ' ; ' + f(o.hi, 2) + ']' }], 'iki ortalama, adım adım');
  };
  /* ---------- eşleştirilmiş ---------- */
  var E = { a: [62, 70, 55, 81, 74, 68, 59, 77, 66, 72], b: [66, 75, 57, 84, 73, 74, 64, 80, 70, 76] };
  var eslTest = function () {
    var d = E.b.map(function (v, i) { return v - E.a[i]; }), n = d.length, md = M.mean(d), sd = M.sd(d), t = md / (sd / Math.sqrt(n)), p = 2 * (1 - M.tCdf(Math.abs(t), n - 1));
    var sp = Math.sqrt(((n - 1) * Math.pow(M.sd(E.a), 2) + (n - 1) * Math.pow(M.sd(E.b), 2)) / (2 * n - 2)), ti = (M.mean(E.b) - M.mean(E.a)) / (sp * Math.sqrt(2 / n)), pi = 2 * (1 - M.tCdf(Math.abs(ti), 2 * n - 2));
    return { d: d, n: n, md: md, sd: sd, t: t, p: p, ti: ti, pi: pi };
  };
  var eslDraw = function () {
    var o = eslTest(), sy = IS.scale(45, 95, 250, 20), g = '';
    g += '<text x="120" y="275" text-anchor="middle">önce</text><text x="460" y="275" text-anchor="middle">sonra</text><line x1="120" x2="120" y1="16" y2="256" class="ik-ax"/><line x1="460" x2="460" y1="16" y2="256" class="ik-ax"/>';
    E.a.forEach(function (v, i) { var up = E.b[i] >= v; g += '<g class="ik-pair' + (up ? ' up' : ' dn') + '" style="--d:' + (i * 0.07).toFixed(2) + 's"><line x1="120" x2="460" y1="' + sy(v).toFixed(1) + '" y2="' + sy(E.b[i]).toFixed(1) + '"/><circle cx="120" cy="' + sy(v).toFixed(1) + '" r="5"/><circle cx="460" cy="' + sy(E.b[i]).toFixed(1) + '" r="5"/></g>'; });
    C.$('[data-esv]', root).innerHTML = '<svg viewBox="0 0 580 285" class="ik-slope" role="img" aria-label="önce ve sonra puanları">' + g + '</svg>';
    C.$('[data-esr]', root).innerHTML = '<div class="kpis"><div class="kpi hl"><small>eşleştirilmiş t <span class="en">paired</span></small><b>t = ' + f(o.t, 2) + ' · p = ' + IS.p(o.p) + '</b></div><div class="kpi"><small>yanlışlıkla bağımsız t</small><b>t = ' + f(o.ti, 2) + ' · p = ' + IS.p(o.pi) + '</b></div></div>' +
      IS.tip('Aynı öğrenciler iki kez ölçüldü. Öğrenciler arası büyük fark (55 ile 81) bağımsız testte gürültü olur; farklara bakınca gürültü kaybolur ve küçük ama tutarlı artış görünür.', 'd̄');
    IS.steps(C.$('[data-est]', root), [{ t: 'farklar', x: 'd = sonra − önce: ' + o.d.join(', ') }, { t: 'farkların ortalaması ve std. sapması', x: 'd̄ = ' + f(o.md, 2) + '   s_d = ' + f(o.sd, 3) }, { t: 'test istatistiği', x: 't = d̄ / (s_d/√n) = ' + f(o.md, 2) + ' / (' + f(o.sd, 3) + '/√' + o.n + ') = ' + f(o.t, 3) + ', sd = ' + (o.n - 1) }], 'eşleştirilmiş t, adım adım');
  };
  /* ---------- iki oran ---------- */
  var P = { x1: 48, n1: 400, x2: 30, n2: 400 };
  var oranTest = function () {
    var p1 = P.x1 / P.n1, p2 = P.x2 / P.n2, pb = (P.x1 + P.x2) / (P.n1 + P.n2), se0 = Math.sqrt(pb * (1 - pb) * (1 / P.n1 + 1 / P.n2)), z = (p1 - p2) / se0, p = 2 * (1 - M.normCdf(Math.abs(z)));
    var se = Math.sqrt(p1 * (1 - p1) / P.n1 + p2 * (1 - p2) / P.n2); return { p1: p1, p2: p2, pb: pb, se0: se0, z: z, p: p, lo: p1 - p2 - 1.96 * se, hi: p1 - p2 + 1.96 * se };
  };
  var oranDraw = function () {
    var o = oranTest(), waf = function (pp, c) { var n = Math.round(pp * 100), s = ''; for (var i = 0; i < 100; i++) s += '<i' + (i < n ? ' class="on" style="--c:' + c + ';--d:' + (i * 0.008).toFixed(3) + 's"' : '') + '></i>'; return '<div class="ik-waf">' + s + '</div>'; };
    C.$('[data-orv]', root).innerHTML = '<div class="ik-two"><div><b>A tasarımı</b><span class="lbl">tıklama %' + f(o.p1 * 100, 1) + '</span>' + waf(o.p1 * 2.5, '#2F6FB0') + '</div><div><b>B tasarımı</b><span class="lbl">tıklama %' + f(o.p2 * 100, 1) + '</span>' + waf(o.p2 * 2.5, '#C8553D') + '</div></div><p class="lbl">ızgaralar oranı 2,5 kat büyüterek gösterir (her kare %0,4)</p>';
    C.$('[data-orr]', root).innerHTML = '<div class="row" style="justify-content:space-between"><div><span class="lbl">z = ' + f(o.z, 3) + '</span><div class="big">p = ' + IS.p(o.p) + '</div></div>' + verdict(o.p) + '</div><p class="lbl">p₁ − p₂ için %95 aralık: [' + f(o.lo, 4) + ' ; ' + f(o.hi, 4) + ']</p>';
    IS.steps(C.$('[data-ost]', root), [{ t: 'oranlar', x: 'p̂₁ = ' + P.x1 + '/' + P.n1 + ' = ' + f(o.p1, 4) + '   p̂₂ = ' + P.x2 + '/' + P.n2 + ' = ' + f(o.p2, 4) }, { t: 'birleşik oran (H₀ altında)', x: 'p̄ = (' + P.x1 + ' + ' + P.x2 + ') / (' + P.n1 + ' + ' + P.n2 + ') = ' + f(o.pb, 4) }, { t: 'standart hata', x: 'SH = √(p̄(1 − p̄)(1/n₁ + 1/n₂)) = ' + f(o.se0, 5) }, { t: 'test istatistiği', x: 'z = (' + f(o.p1, 4) + ' − ' + f(o.p2, 4) + ') / ' + f(o.se0, 5) + ' = ' + f(o.z, 3) }], 'iki oran, adım adım');
  };
  /* ---------- parametrik olmayan ---------- */
  var NP = { k: 'mw', sorted: false };
  var MW = { A: [12, 15, 9, 22, 18, 30, 14], B: [25, 28, 19, 35, 31, 24, 40, 27] };
  var KW = { g: [[68, 72, 75, 61, 70], [78, 82, 74, 88, 80], [65, 60, 71, 58, 66]], n: ['sabah', 'öğle', 'akşam'] };
  var SP = { x: [1, 2, 3, 4, 5, 6, 7, 8], y: [2, 1, 4, 3, 6, 8, 5, 7] };
  var GC = ['#2F6FB0', '#C8553D', '#1F8A7A'];
  var npCalc = function () {
    var o = { k: NP.k };
    if (NP.k === 'mw') {
      var all = MW.A.concat(MW.B), rk = M.rank(all), n1 = MW.A.length, n2 = MW.B.length, R1 = M.sum(rk.slice(0, n1)), U1 = R1 - n1 * (n1 + 1) / 2, mu = n1 * n2 / 2, sd = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
      o.items = all.map(function (v, i) { return { v: v, g: i < n1 ? 0 : 1, r: rk[i] }; }); o.R1 = R1; o.R2 = M.sum(rk.slice(n1)); o.U = Math.min(U1, n1 * n2 - U1); o.z = (U1 - mu) / sd; o.p = 2 * (1 - M.normCdf(Math.abs(o.z))); o.n1 = n1; o.n2 = n2;
    } else if (NP.k === 'wil' || NP.k === 'isaret') {
      var d = E.b.map(function (v, i) { return v - E.a[i]; }).filter(function (x) { return x !== 0; }), n = d.length;
      if (NP.k === 'wil') {
        var r = M.rank(d.map(Math.abs)), Wp = 0, Wm = 0; d.forEach(function (x, i) { if (x > 0) Wp += r[i]; else Wm += r[i]; });
        var mw = n * (n + 1) / 4, sw = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24); o.items = d.map(function (x, i) { return { v: Math.abs(x), g: x > 0 ? 0 : 1, r: r[i], s: x > 0 ? '+' : '−' }; });
        o.Wp = Wp; o.Wm = Wm; o.z = (Math.min(Wp, Wm) - mw) / sw; o.p = 2 * M.normCdf(-Math.abs(o.z)); o.n = n;
      } else {
        var plus = d.filter(function (x) { return x > 0; }).length, k = Math.min(plus, n - plus); o.plus = plus; o.n = n; o.p = Math.min(1, 2 * M.binomCdf(k, n, 0.5)); o.d = d;
      }
    } else if (NP.k === 'spearman') {
      var rx = M.rank(SP.x), ry = M.rank(SP.y), d2 = rx.map(function (v, i) { return (v - ry[i]) * (v - ry[i]); }), n3 = SP.x.length, rs = 1 - 6 * M.sum(d2) / (n3 * (n3 * n3 - 1)), t = rs * Math.sqrt((n3 - 2) / (1 - rs * rs));
      o.rx = rx; o.ry = ry; o.d2 = d2; o.rs = rs; o.t = t; o.p = 2 * (1 - M.tCdf(Math.abs(t), n3 - 2)); o.n = n3;
    } else {
      var al = [], gi = []; KW.g.forEach(function (g, j) { g.forEach(function (v) { al.push(v); gi.push(j); }); });
      var rr = M.rank(al), N = al.length, H = 0, Rj = [0, 0, 0]; rr.forEach(function (v, i) { Rj[gi[i]] += v; });
      KW.g.forEach(function (g, j) { H += Rj[j] * Rj[j] / g.length; }); H = 12 / (N * (N + 1)) * H - 3 * (N + 1);
      o.items = al.map(function (v, i) { return { v: v, g: gi[i], r: rr[i] }; }); o.Rj = Rj; o.H = H; o.p = 1 - M.chiCdf(H, KW.g.length - 1); o.N = N;
    }
    return o;
  };
  /* sıralama animasyonu: çipler gruplu satırlardan tek bir sıralı satıra akar */
  var chips = function (items, groups) {
    var N = items.length, ord = items.map(function (it, i) { return i; }).sort(function (a, b) { return items[a].v - items[b].v; }), pos = {};
    ord.forEach(function (ix, k) { pos[ix] = k; });
    var cnt = {}, w = 100 / Math.max(N, 1);
    return '<div class="ik-chips' + (NP.sorted ? ' sorted' : '') + '" style="--rows:' + groups.length + '">' + (NP.sorted ? '' : groups.map(function (g, j) { return '<span class="ik-gl" style="top:' + (j * 46 + 8) + 'px;color:' + GC[j] + '">' + X(g) + '</span>'; }).join('')) + items.map(function (it, i) {
      var j = cnt[it.g] = (cnt[it.g] || 0) + 1, left = NP.sorted ? pos[i] * w : 20 + (j - 1) * Math.min(w, 9), top = NP.sorted ? 30 : it.g * 46;
      return '<span class="ik-chip" style="left:' + left.toFixed(2) + '%;top:' + top + 'px;width:calc(' + w.toFixed(2) + '% - 4px);--c:' + GC[it.g] + '"><b>' + (it.s || '') + f(it.v, 0) + '</b>' + (NP.sorted ? '<small>' + f(it.r, it.r % 1 ? 1 : 0) + '</small>' : '') + '</span>';
    }).join('') + '</div>';
  };
  var npDraw = function () {
    var o = npCalc(), v = C.$('[data-npv]', root), res = '', st = [];
    C.$('[data-npsort]', root).hidden = !(o.items);
    C.$('[data-npsort]', root).textContent = NP.sorted ? 'gruplara geri ayır' : 'hepsini tek sıraya diz ve sırala';
    if (NP.k === 'mw') {
      v.innerHTML = '<p class="sub">İki şubede müşteri bekleme süreleri (dk). Veri çarpık, örneklem küçük: ortalama yerine sıralara bakalım.</p>' + chips(o.items, ['A şubesi', 'B şubesi']);
      res = '<div class="kpis"><div class="kpi"><small>R₁ (A’nın sıra toplamı)</small><b>' + f(o.R1, 1) + '</b></div><div class="kpi"><small>U</small><b>' + f(o.U, 1) + '</b></div><div class="kpi hl"><small>z · p (normal yakl.)</small><b>' + f(o.z, 2) + ' · ' + IS.p(o.p) + '</b></div></div>';
      st = [{ t: 'birleştir ve sırala', x: 'n₁ = ' + o.n1 + ', n₂ = ' + o.n2 + '; en küçük değer 1. sırayı alır, eşitlere ortalama sıra' }, { t: 'sıra toplamları', x: 'R₁ = ' + f(o.R1, 1) + '   R₂ = ' + f(o.R2, 1) }, { t: 'U', x: 'U₁ = R₁ − n₁(n₁+1)/2 = ' + f(o.R1, 1) + ' − ' + (o.n1 * (o.n1 + 1) / 2) + ' = ' + f(o.R1 - o.n1 * (o.n1 + 1) / 2, 1) }, { t: 'z', x: 'z = (U₁ − n₁n₂/2) / √(n₁n₂(n₁+n₂+1)/12) = ' + f(o.z, 3) }];
    } else if (NP.k === 'wil') {
      v.innerHTML = '<p class="sub">Önce–sonra verisindeki farkların mutlak değerleri sıralanır; sıralar farkın işaretiyle toplanır.</p>' + chips(o.items, ['artan (+)', 'azalan (−)']);
      res = '<div class="kpis"><div class="kpi"><small>W⁺</small><b>' + f(o.Wp, 1) + '</b></div><div class="kpi"><small>W⁻</small><b>' + f(o.Wm, 1) + '</b></div><div class="kpi hl"><small>z · p (normal yakl.)</small><b>' + f(o.z, 2) + ' · ' + IS.p(o.p) + '</b></div></div>';
      st = [{ t: 'farklar ve mutlak değerleri', x: 'sıfır olmayan fark sayısı n = ' + o.n }, { t: 'işaretli sıra toplamları', x: 'W⁺ = ' + f(o.Wp, 1) + '   W⁻ = ' + f(o.Wm, 1) }, { t: 'z', x: 'z = (min W − n(n+1)/4) / √(n(n+1)(2n+1)/24) = ' + f(o.z, 3) }];
    } else if (NP.k === 'isaret') {
      v.innerHTML = '<p class="sub">Yalnız farkın yönüne bakılır: kaç kişi arttı, kaç kişi azaldı?</p><div class="ik-signs">' + o.d.map(function (x, i) { return '<i class="' + (x > 0 ? 'p' : 'm') + '" style="--d:' + (i * 0.08).toFixed(2) + 's">' + (x > 0 ? '+' : '−') + '</i>'; }).join('') + '</div>';
      res = '<div class="kpis"><div class="kpi"><small>artan (+)</small><b>' + o.plus + ' / ' + o.n + '</b></div><div class="kpi hl"><small>kesin binom p</small><b>' + IS.p(o.p) + '</b></div></div>';
      st = [{ t: 'işaretleri say', x: '+ : ' + o.plus + '   − : ' + (o.n - o.plus) }, { t: 'H₀ altında', x: 'artan sayısı ~ Binom(' + o.n + ', 0,5)' }, { t: 'çift yönlü p', x: 'p = 2·P(X ≤ ' + Math.min(o.plus, o.n - o.plus) + ') = ' + f(o.p, 4) }];
    } else if (NP.k === 'spearman') {
      v.innerHTML = '<p class="sub">İki jüri 8 yarışmacıyı sıraladı. Sıralamalar ne kadar uyumlu?</p><div class="tbl-w"><table class="t"><thead><tr><th>yarışmacı</th>' + SP.x.map(function (_, i) { return '<th class="n">' + String.fromCharCode(65 + i) + '</th>'; }).join('') + '</tr></thead><tbody><tr><td>jüri 1</td>' + o.rx.map(function (r) { return '<td class="n">' + r + '</td>'; }).join('') + '</tr><tr><td>jüri 2</td>' + o.ry.map(function (r, i) { return '<td class="n"><input type="number" min="1" max="8" value="' + SP.y[i] + '" data-spy="' + i + '"></td>'; }).join('') + '</tr><tr><td>d²</td>' + o.d2.map(function (d) { return '<td class="n">' + d + '</td>'; }).join('') + '</tr></tbody></table></div>';
      res = '<div class="kpis"><div class="kpi hl"><small>Spearman rₛ</small><b>' + f(o.rs, 3) + '</b></div><div class="kpi"><small>p (t yaklaşımı)</small><b>' + IS.p(o.p) + '</b></div></div>';
      st = [{ t: 'farkların karesi', x: 'Σd² = ' + o.d2.join(' + ') + ' = ' + M.sum(o.d2) }, { t: 'formül', x: 'rₛ = 1 − 6·' + M.sum(o.d2) + ' / (' + o.n + '·(' + o.n + '² − 1)) = ' + f(o.rs, 4) }];
    } else {
      v.innerHTML = '<p class="sub">Üç şubenin notları (küçük örneklem). ANOVA’nın parametrik olmayan karşılığı.</p>' + chips(o.items, KW.n);
      res = '<div class="kpis"><div class="kpi"><small>sıra toplamları</small><b>' + o.Rj.map(function (r) { return f(r, 1); }).join(' · ') + '</b></div><div class="kpi hl"><small>H · p (χ², sd = 2)</small><b>' + f(o.H, 2) + ' · ' + IS.p(o.p) + '</b></div></div>';
      st = [{ t: 'birleştir ve sırala', x: 'N = ' + o.N }, { t: 'sıra toplamları', x: 'R = ' + o.Rj.map(function (r) { return f(r, 1); }).join(', ') }, { t: 'H', x: 'H = 12/(N(N+1)) Σ R²/n − 3(N+1) = ' + f(o.H, 3) }];
    }
    C.$('[data-npr]', root).innerHTML = '<div class="row" style="justify-content:space-between">' + res + verdict(o.p) + '</div>';
    IS.steps(C.$('[data-npst]', root), st, 'adım adım');
    C.$$('[data-spy]', root).forEach(function (el) { el.onchange = function () { SP.y[+el.getAttribute('data-spy')] = Math.max(1, Math.min(8, Math.round(+el.value || 1))); npDraw(); }; });
  };

  var subDraw = function () { C.$$('[data-sub]', root).forEach(function (s) { s.hidden = s.getAttribute('data-sub') !== sub; }); if (sub === 'bag') bagDraw(); else if (sub === 'esl') eslDraw(); else if (sub === 'oran') oranDraw(); else npDraw(); FN.bridgeSend(); };
  var QS = [
    { q: 'Aynı 15 çalışanın eğitimden önce ve sonra verimliliği ölçüldü. Hangi test?', o: ['eşleştirilmiş t testi', 'bağımsız iki örneklem t testi', 'ki-kare bağımsızlık', 'tek yönlü ANOVA'], a: 0, n: 'Aynı birimler iki kez ölçüldü; farklar üzerinden tek örneklem t yapılır.' },
    { q: 'μ₁ − μ₂ için %95 güven aralığı [−1,2 ; 4,8]. Yorum?', o: ['fark α = 0,05’te anlamlı değil', 'fark anlamlı', 'μ₁ > μ₂ kesin', 'varyanslar eşit değil'], a: 0, n: 'Aralık sıfırı içeriyor; çift yönlü testte H₀ reddedilemez.' },
    { q: 'Varyansların eşit olduğu varsayılamıyorsa iki ortalama için hangi test?', o: ['Welch t testi', 'ortak varyanslı t', 'z testi', 'işaret testi'], a: 0, n: 'Welch, standart hatayı ayrı varyanslarla ve düzeltilmiş serbestlik derecesiyle hesaplar.' },
    { q: 'Mann-Whitney U testi hangi parametrik testin karşılığıdır?', o: ['bağımsız iki örneklem t', 'eşleştirilmiş t', 'tek yönlü ANOVA', 'Pearson korelasyonu'], a: 0, n: 'Normal varsayımı yoksa iki bağımsız grubu sıralarla karşılaştırır.' },
    { q: 'Kruskal-Wallis testi ne zaman kullanılır?', o: ['üç ya da daha fazla bağımsız grup, normallik şüpheli', 'iki eşleştirilmiş grup', 'iki kategorik değişken', 'tek bir oran'], a: 0, n: 'ANOVA’nın sıralara dayalı karşılığı; H ki-kare (k − 1) ile karşılaştırılır.' },
    { q: 'İki jürinin sıralamaları birebir aynı. Spearman rₛ?', o: ['1', '0', '−1', '0,5'], a: 0, n: 'Σd² = 0 → rₛ = 1.' },
    { q: 'A/B testinde p̂₁ = 0,12 ve p̂₂ = 0,075, her biri n = 400. İki oran testinde birleşik oran p̄?', o: ['0,0975', '0,195', '0,045', '0,12'], a: 0, n: '(48 + 30) / 800 = 0,0975.' }
  ];
  IS.bank.ikili = QS;

  FN.st.ikili = {
    init: function () {
      root = C.$('#ikili');
      root.innerHTML = IS.head({ key: 'ikili', k: 'istasyon · iki anakütle ve sıra testleri', title: 'İki anakütle ve parametrik olmayan testler', sub: 'İki grup gerçekten farklı mı? Önce farkın güven aralığını kur, sonra test et. Veri normal değilse ya da örneklem küçükse değerleri <b>sıraya diz</b>: parametrik olmayan testler sıralarla çalışır.' }) +
        '<div class="seg" data-seg style="margin-bottom:14px"></div>' +
        '<div data-sub="bag"><div class="grid gside"><div class="card box" style="--cc:#FF8A7A"><h2>' + IS.en('Bağımsız iki örneklem', 'independent samples') + '</h2><p class="sub">A: yeni yöntem, B: eski yöntem (notlar).</p>' + sl(B, 'm1', 'A ortalaması', 55, 90, 0.1, 'bk') + sl(B, 's1', 'A std. sapma', 2, 25, 0.1, 'bk') + sl(B, 'n1', 'n_A', 3, 80, 1, 'bk') + sl(B, 'm2', 'B ortalaması', 55, 90, 0.1, 'bk') + sl(B, 's2', 'B std. sapma', 2, 25, 0.1, 'bk') + sl(B, 'n2', 'n_B', 3, 80, 1, 'bk') + '<label class="row lbl"><input type="checkbox" data-welch style="width:auto"> varyanslar eşit varsayılmasın (Welch)</label></div>' +
        '<div class="card box" style="--cc:#FF8A7A"><div data-bch></div><div class="stage" data-bci style="margin-top:8px"></div><div data-bres></div><div data-bst></div>' + IS.code({ x: [['=T.TEST(A2:A21;B2:B23;2;2)', 'eşit varyanslı, çift yönlü p'], ['=T.TEST(A2:A21;B2:B23;2;3)', 'Welch (eşit olmayan varyans)']], r: [['t.test(a, b, var.equal = TRUE)', 'aralık da verir'], ['t.test(a, b)', 'Welch (R’nin varsayılanı)']] }) + '</div></div></div>' +
        '<div data-sub="esl" hidden><div class="grid g2"><div class="card box" style="--cc:#FF8A7A"><h2>' + IS.en('Önce ve sonra', 'matched samples') + '</h2><p class="sub">10 öğrencinin kurs öncesi ve sonrası puanı. Yeşil çizgi artış, kırmızı düşüş.</p><div class="stage" data-esv></div><button type="button" class="btn sm" data-esnew style="margin-top:8px">yeni sınıf üret</button></div>' +
        '<div class="card box" style="--cc:#FF8A7A"><div data-esr></div><div data-est></div>' + IS.code({ x: [['=T.TEST(A2:A11;B2:B11;2;1)', 'eşleştirilmiş, çift yönlü p']], r: [['t.test(sonra, once, paired = TRUE)', '']] }) + '</div></div></div>' +
        '<div data-sub="oran" hidden><div class="grid gside"><div class="card box" style="--cc:#FF8A7A"><h2>' + IS.en('A/B testi: iki oran', 'two proportions') + '</h2><p class="sub">Bir e-ticaret sitesi iki tasarımı 400’er ziyaretçiyle denedi.</p>' + sl(P, 'x1', 'A tıklayan', 0, 200, 1, 'or') + sl(P, 'n1', 'A ziyaretçi', 50, 2000, 10, 'or') + sl(P, 'x2', 'B tıklayan', 0, 200, 1, 'or') + sl(P, 'n2', 'B ziyaretçi', 50, 2000, 10, 'or') + '</div>' +
        '<div class="card box" style="--cc:#FF8A7A"><div data-orv></div><div data-orr></div><div data-ost></div>' + IS.code({ x: [['=(B1/B2-C1/C2)/KAREKÖK(D1*(1-D1)*(1/B2+1/C2))', 'z (D1 = birleşik oran)']], r: [['prop.test(c(48, 30), c(400, 400), correct = FALSE)', 'χ² = z²']] }) + '</div></div></div>' +
        '<div data-sub="np" hidden><div class="card box" style="--cc:#FF8A7A"><div class="row" style="justify-content:space-between"><h2>' + IS.en('Parametrik olmayan testler', 'nonparametric tests') + '</h2><div class="seg" data-npk></div></div><div data-npv></div><button type="button" class="btn sm pri" data-npsort style="margin-top:10px"></button><div data-npr style="margin-top:12px"></div><div class="grid g2"><div data-npst></div><div>' +
        IS.code({ x: [['=SIRA.ORT(A2;$A$2:$A$16;1)', 'eşitlere ortalama sıra (küçükten büyüğe)'], ['=BİNOM.DAĞ(2;10;0,5;DOĞRU)*2', 'işaret testi p']], r: [['wilcox.test(a, b)', 'Mann-Whitney U'], ['wilcox.test(sonra, once, paired = TRUE)', 'Wilcoxon işaretli sıralar'], ['binom.test(8, 10)', 'işaret testi'], ['cor.test(x, y, method = "spearman")', ''], ['kruskal.test(not ~ sube)', '']] }) + '</div></div></div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      IS.seg(C.$('[data-seg]', root), [['bag', 'Bağımsız iki ortalama'], ['esl', 'Eşleştirilmiş'], ['oran', 'İki oran'], ['np', 'Parametrik olmayan']], sub, function (k) { sub = k; subDraw(); });
      IS.seg(C.$('[data-npk]', root), [['mw', 'Mann-Whitney'], ['wil', 'Wilcoxon'], ['isaret', 'işaret'], ['spearman', 'Spearman'], ['kw', 'Kruskal-Wallis']], NP.k, function (k) { NP.k = k; NP.sorted = false; C.$('[data-npst]', root).__stp = 0; npDraw(); FN.bridgeSend(); });
      C.$('[data-npsort]', root).onclick = function () { NP.sorted = !NP.sorted; var ch = C.$('.ik-chips', root); if (!ch) { npDraw(); return; } var tmp = document.createElement('div'); tmp.innerHTML = chips(npCalc().items, NP.k === 'kw' ? KW.n : NP.k === 'wil' ? ['artan (+)', 'azalan (−)'] : ['A şubesi', 'B şubesi']); var nw = tmp.firstChild; ch.className = nw.className; C.$$('.ik-gl', ch).forEach(function (g) { g.remove(); }); C.$$('.ik-gl', nw).forEach(function (g) { ch.insertBefore(g, ch.firstChild); }); var olds = C.$$('.ik-chip', ch), nws = C.$$('.ik-chip', nw); olds.forEach(function (o, i) { o.style.left = nws[i].style.left; o.style.top = nws[i].style.top; o.innerHTML = nws[i].innerHTML; }); C.$('[data-npsort]', root).textContent = NP.sorted ? 'gruplara geri ayır' : 'hepsini tek sıraya diz ve sırala'; };
      C.$('[data-welch]', root).onchange = function (e) { B.welch = e.target.checked; C.$('[data-bst]', root).__stp = 0; bagDraw(); };
      C.$('[data-esnew]', root).onclick = function () { var a = [], b = []; for (var i = 0; i < 10; i++) { var v = Math.round(55 + 30 * Math.random()); a.push(v); b.push(Math.max(45, Math.min(95, Math.round(v + 3 + 3 * M.randn())))); } E.a = a; E.b = b; eslDraw(); };
      bind('bk', B, bagDraw); bind('or', P, function () { P.x1 = Math.min(P.x1, P.n1); P.x2 = Math.min(P.x2, P.n2); oranDraw(); });
      subDraw();
      IS.quiz(C.$('[data-quiz]', root), QS, 'İki anakütle');
    },
    ctx: function () {
      var o = sub === 'bag' ? bagTest() : sub === 'esl' ? eslTest() : sub === 'oran' ? oranTest() : npCalc();
      return IS.ctx('ikili', sub === 'np' ? NP.k : sub, [['test', sub === 'np' ? NP.k : sub], ['p', IS.p(o.p)]], 'öğrenci iki anakütle karşılaştırması ve parametrik olmayan testleri çalışıyor (AYBÜ BUS202 3, 5, 14. hafta).', ['Hangi durumda hangi test?', 'Parametrik olmayan test ne zaman tercih edilir?', 'Eşleştirilmiş t neden daha güçlü?']);
    }
  };
})();
