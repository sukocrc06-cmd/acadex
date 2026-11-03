/* ==========================================================================
   ACADEX İSTATİSTİK · 3. DAĞILIM GALERİSİ (labs/istatistik/is-dagilim.js), 03.11.2026
   İstatistik I, 7–10. hafta: rastlantı değişkeni, beklenen değer, binom, Poisson,
   normal ve standart normal (z), t, ki-kare.
     - sürgülerle parametre; iki sınır sürgüsüyle P(a ≤ X ≤ b) alanı boyanır
     - normal: z değerleri ve "ters" soru (P(X ≤ x) = p → x)
     - t: normalle üst üste; serbestlik derecesi arttıkça kuyruklar incelir
     - her sonucun Excel ve R karşılığı o anki sayılarla yazılır
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, cur = 'normal';
  var P = {
    binom: { n: 10, p: 0.3, a: 2, b: 4 },
    poisson: { l: 4, a: 0, b: 2 },
    normal: { mu: 70, s: 10, a: 60, b: 85, inv: 0.95 },
    t: { df: 5, a: -2, b: 2 },
    kikare: { df: 4, a: 0, b: 9.49 }
  };
  var D = {
    binom: { t: 'Binom', d: 'n bağımsız denemede başarı sayısı. Örnek: 10 soruluk testte rastgele işaretlenen doğru sayısı.', sl: [['n', 'deneme sayısı n', 1, 40, 1], ['p', 'başarı olasılığı p', 0.01, 0.99, 0.01]], disc: true },
    poisson: { t: 'Poisson', d: 'Bir zaman aralığında olayların sayısı. Örnek: kafeye 5 dakikada gelen müşteri.', sl: [['l', 'ortalama λ', 0.5, 15, 0.5]], disc: true },
    normal: { t: 'Normal', d: 'Çan eğrisi: boy, sınav puanı, ölçüm hatası. Alan, olasılıktır.', sl: [['mu', 'ortalama μ', 0, 100, 1], ['s', 'standart sapma σ', 2, 25, 0.5]] },
    t: { t: 't', d: 'σ bilinmeyip örneklemden tahmin edilince kullanılır. Küçük örneklemde kuyruklar daha kalındır.', sl: [['df', 'serbestlik derecesi sd', 1, 60, 1]] },
    kikare: { t: 'Ki-kare', d: 'Kareli sapmaların toplamı; uyum ve bağımsızlık testlerinde kullanılır. Sağa çarpık, hep pozitif.', sl: [['df', 'serbestlik derecesi sd', 1, 30, 1]] }
  };
  var range = function (k) {
    var p = P[k];
    if (k === 'binom') return [0, p.n];
    if (k === 'poisson') return [0, Math.max(10, Math.ceil(p.l + 4 * Math.sqrt(p.l)))];
    if (k === 'normal') return [p.mu - 4 * p.s, p.mu + 4 * p.s];
    if (k === 't') return [-5, 5];
    return [0, Math.max(10, p.df + 5 * Math.sqrt(2 * p.df))];
  };
  var calc = function (k) {
    var p = P[k], a = Math.min(p.a, p.b), b = Math.max(p.a, p.b), o = {};
    if (k === 'binom') { a = Math.round(a); b = Math.round(b); o.pr = M.binomCdf(b, p.n, p.p) - (a > 0 ? M.binomCdf(a - 1, p.n, p.p) : 0); o.E = p.n * p.p; o.V = p.n * p.p * (1 - p.p); }
    else if (k === 'poisson') { a = Math.round(a); b = Math.round(b); o.pr = M.poisCdf(b, p.l) - (a > 0 ? M.poisCdf(a - 1, p.l) : 0); o.E = p.l; o.V = p.l; }
    else if (k === 'normal') { o.pr = M.normCdf(b, p.mu, p.s) - M.normCdf(a, p.mu, p.s); o.E = p.mu; o.V = p.s * p.s; o.za = (a - p.mu) / p.s; o.zb = (b - p.mu) / p.s; }
    else if (k === 't') { o.pr = M.tCdf(b, p.df) - M.tCdf(a, p.df); o.E = p.df > 1 ? 0 : NaN; o.V = p.df > 2 ? p.df / (p.df - 2) : Infinity; }
    else { o.pr = M.chiCdf(b, p.df) - M.chiCdf(a, p.df); o.E = p.df; o.V = 2 * p.df; }
    o.a = a; o.b = b; return o;
  };
  var pdf = function (k) {
    var p = P[k];
    return k === 'normal' ? function (x) { return M.normPdf(x, p.mu, p.s); } : k === 't' ? function (x) { return M.tPdf(x, p.df); } : function (x) { return M.chiPdf(x, p.df); };
  };
  var codes = function (k, o) {
    var p = P[k], n2 = function (v) { return C.nf(v, 2).replace(/\.(?=\d{3})/g, ''); };
    if (k === 'binom') return { x: [['=BİNOM.DAĞ(' + o.a + ';' + p.n + ';' + n2(p.p) + ';YANLIŞ)', 'P(X = ' + o.a + ')'], ['=BİNOM.DAĞ(' + o.b + ';' + p.n + ';' + n2(p.p) + ';DOĞRU)-BİNOM.DAĞ(' + (o.a - 1) + ';' + p.n + ';' + n2(p.p) + ';DOĞRU)', 'P(' + o.a + ' ≤ X ≤ ' + o.b + ')']],
      r: [['dbinom(' + o.a + ', ' + p.n + ', ' + p.p + ')', ''], ['pbinom(' + o.b + ', ' + p.n + ', ' + p.p + ') - pbinom(' + (o.a - 1) + ', ' + p.n + ', ' + p.p + ')', ''], ['sum(dbinom(' + o.a + ':' + o.b + ', ' + p.n + ', ' + p.p + '))', 'aynı sonuç']] };
    if (k === 'poisson') return { x: [['=POISSON.DAĞ(' + o.a + ';' + n2(p.l) + ';YANLIŞ)', 'P(X = ' + o.a + ')'], ['=POISSON.DAĞ(' + o.b + ';' + n2(p.l) + ';DOĞRU)' + (o.a > 0 ? '-POISSON.DAĞ(' + (o.a - 1) + ';' + n2(p.l) + ';DOĞRU)' : ''), 'P(' + o.a + ' ≤ X ≤ ' + o.b + ')']],
      r: [['dpois(' + o.a + ', ' + p.l + ')', ''], ['ppois(' + o.b + ', ' + p.l + ')' + (o.a > 0 ? ' - ppois(' + (o.a - 1) + ', ' + p.l + ')' : ''), '']] };
    if (k === 'normal') return { x: [['=NORM.DAĞ(' + n2(o.b) + ';' + p.mu + ';' + n2(p.s) + ';DOĞRU)-NORM.DAĞ(' + n2(o.a) + ';' + p.mu + ';' + n2(p.s) + ';DOĞRU)', 'P(a ≤ X ≤ b)'], ['=NORM.S.DAĞ(' + n2(o.zb) + ';DOĞRU)', 'standart normal: P(Z ≤ z)'], ['=NORM.TERS(' + n2(p.inv) + ';' + p.mu + ';' + n2(p.s) + ')', 'P(X ≤ x) = ' + n2(p.inv) + ' olan x'], ['=NORM.S.TERS(0,975)', 'z₀,₀₂₅ = 1,96']],
      r: [['pnorm(' + o.b + ', ' + p.mu + ', ' + p.s + ') - pnorm(' + o.a + ', ' + p.mu + ', ' + p.s + ')', ''], ['qnorm(' + p.inv + ', ' + p.mu + ', ' + p.s + ')', ''], ['qnorm(0.975)', '1.959964']] };
    if (k === 't') return { x: [['=T.DAĞ(' + n2(o.b) + ';' + p.df + ';DOĞRU)-T.DAĞ(' + n2(o.a) + ';' + p.df + ';DOĞRU)', ''], ['=T.TERS.2K(0,05;' + p.df + ')', 'çift yönlü kritik t (α = 0,05) = ' + f(M.tInv(0.975, p.df), 3)]],
      r: [['pt(' + o.b + ', ' + p.df + ') - pt(' + o.a + ', ' + p.df + ')', ''], ['qt(0.975, ' + p.df + ')', f(M.tInv(0.975, p.df), 3).replace(',', '.')]] };
    return { x: [['=KİKARE.DAĞ(' + n2(o.b) + ';' + p.df + ';DOĞRU)-KİKARE.DAĞ(' + n2(o.a) + ';' + p.df + ';DOĞRU)', ''], ['=KİKARE.TERS.SAĞK(0,05;' + p.df + ')', 'kritik değer (α = 0,05) = ' + f(M.chiInv(0.95, p.df), 3)]],
      r: [['pchisq(' + o.b + ', ' + p.df + ') - pchisq(' + o.a + ', ' + p.df + ')', ''], ['qchisq(0.95, ' + p.df + ')', '']] };
  };

  var draw = function () {
    var k = cur, p = P[k], d = D[k], o = calc(k), rg = range(k), html;
    if (d.disc) {
      var bars = [], top = 0;
      for (var x = rg[0]; x <= rg[1]; x++) { var y = k === 'binom' ? M.binomPmf(x, p.n, p.p) : M.poisPmf(x, p.l); top = Math.max(top, y); bars.push({ x: x, y0: 0, y1: y, c: x >= o.a && x <= o.b ? '#E0A526' : '#9DB8FF', bw: 0.8, lab: 'P(X=' + x + ') = ' + f(y, 4) }); }
      var step = rg[1] > 24 ? 5 : rg[1] > 12 ? 2 : 1, xt = []; for (var t = 0; t <= rg[1]; t += step) xt.push(t);
      html = C.chart({ w: 640, h: 270, y0: true, x: [rg[0] - 0.5, rg[1] + 0.5], nb: rg[1] - rg[0] + 1, xticks: xt, yf: function (v) { return f(v, 2); }, al: d.t + ' dağılımı', yl: 'P(X = x)', bars: bars, vl: [{ x: o.E, c: '#C8553D', lab: 'E[X] = ' + f(o.E, 2) }] });
    } else {
      var F = pdf(k), all = IS.curve(F, rg[0] + (k === 'kikare' ? 0.05 : 0), rg[1], 200), sh = IS.curve(F, Math.max(rg[0] + (k === 'kikare' ? 0.05 : 0), o.a), Math.min(rg[1], o.b), 100);
      var s = [{ p: all, c: '#2F6FB0', w: 2.6 }, { p: sh, c: '#E0A526', w: 0.1, area: true, base: 0 }];
      if (k === 't') s.push({ p: IS.curve(function (x) { return M.normPdf(x); }, -5, 5, 160), c: '#C8553D', w: 1.6, d: '5 5', lab: 'normal' });
      html = C.chart({ w: 640, h: 270, y: [0, Math.max(k === 't' ? 0.42 : 0, all.reduce(function (m, q) { return Math.max(m, isFinite(q[1]) ? q[1] : 0); }, 0) * 1.12)], x: rg, yf: function (v) { return f(v, k === 'normal' ? 3 : 2); }, al: d.t + ' dağılımı', yl: 'yoğunluk', s: s, anim: false,
        vl: [{ x: o.a, c: '#B9821F', lab: 'a' }, { x: o.b, c: '#B9821F', lab: 'b' }] });
    }
    C.$('[data-ch]', root).innerHTML = html;
    C.$('[data-pr]', root).innerHTML = '<span class="lbl">P(' + f(o.a, d.disc ? 0 : 2) + ' ≤ X ≤ ' + f(o.b, d.disc ? 0 : 2) + ')</span><div class="big" style="color:#B9821F">' + f(o.pr, 4) + '</div>' +
      '<div class="kpis"><div class="kpi"><small>beklenen değer E[X]</small><b>' + (isFinite(o.E) ? f(o.E, 2) : 'tanımsız') + '</b></div><div class="kpi"><small>varyans Var(X)</small><b>' + (isFinite(o.V) ? f(o.V, 2) : '∞') + '</b></div>' +
      (k === 'normal' ? '<div class="kpi"><small>z(a) · z(b)</small><b>' + f(o.za, 2) + ' · ' + f(o.zb, 2) + '</b></div>' : '') + '</div>' +
      (k === 'normal' ? '<div class="formula">z = (x − μ) / σ → P(' + f(o.za, 2) + ' ≤ Z ≤ ' + f(o.zb, 2) + ') = Φ(' + f(o.zb, 2) + ') − Φ(' + f(o.za, 2) + ')</div>' +
        '<label class="sl" style="margin-top:10px"><span>ters soru: P(X ≤ x) = p ise x kaç?</span><input type="range" min="0.01" max="0.99" step="0.01" value="' + p.inv + '" data-inv><output>p = ' + f(p.inv, 2) + ' → x = ' + f(M.normInv(p.inv, p.mu, p.s), 2) + '</output></label>' : '') +
      (k === 't' ? IS.tip('sd = ' + p.df + ' iken çift yönlü %95 kritik değer <b>' + f(M.tInv(0.975, p.df), 3) + '</b>; normalde 1,960. Örneklem büyüdükçe t, normale yaklaşır.', 't') : '') +
      (k === 'binom' && p.n * p.p >= 5 && p.n * (1 - p.p) >= 5 ? IS.tip('np ≥ 5 ve n(1 − p) ≥ 5: binom artık normale benziyor (normal yaklaşım).', 'np≥5') : '');
    var inv = C.$('[data-inv]', root);
    if (inv) inv.oninput = function () { p.inv = +inv.value; inv.nextElementSibling.textContent = 'p = ' + f(p.inv, 2) + ' → x = ' + f(M.normInv(p.inv, p.mu, p.s), 2); };
    C.$('[data-code]', root).innerHTML = IS.code(codes(k, o), 'bu sonuç bilgisayarda');
  };
  var panel = function () {
    var d = D[cur], p = P[cur], rg = range(cur), st = d.disc ? 1 : cur === 'normal' ? 0.5 : 0.05;
    C.$('[data-desc]', root).textContent = d.d;
    var sl = function (key, lab, min, max, step) { return '<label class="sl"><span>' + lab + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + p[key] + '" data-p="' + key + '"><output data-po="' + key + '">' + f(p[key], step < 1 ? 2 : 0) + '</output></label>'; };
    C.$('[data-params]', root).innerHTML = d.sl.map(function (q) { return sl.apply(null, q); }).join('') + '<p class="lbl" style="margin:10px 0 0">boyanan aralık</p>' + sl('a', 'alt sınır a', rg[0], rg[1], st) + sl('b', 'üst sınır b', rg[0], rg[1], st);
    C.$$('[data-p]', root).forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.getAttribute('data-p'); p[key] = +el.value; C.$('[data-po="' + key + '"]', root).textContent = f(p[key], +el.step < 1 ? 2 : 0);
        if (key !== 'a' && key !== 'b') { var r2 = range(cur); p.a = Math.max(r2[0], Math.min(r2[1], p.a)); p.b = Math.max(r2[0], Math.min(r2[1], p.b)); panel(); return; }
        draw();
      });
      el.addEventListener('change', function () { FN.bridgeSend(); });
    });
    draw();
  };

  var QS = [
    { q: 'X ~ N(70, 10²). P(X ≤ 90) yaklaşık kaçtır?', o: ['0,977', '0,841', '0,500', '0,682'], a: 0, n: 'z = (90 − 70)/10 = 2; Φ(2) ≈ 0,977.' },
    { q: 'Normal dağılımda verinin yaklaşık yüzde kaçı μ ± 1σ aralığındadır?', o: ['%68', '%95', '%99,7', '%50'], a: 0, n: '68–95–99,7 kuralı: ±1σ %68, ±2σ %95, ±3σ %99,7.' },
    { q: 'Binom(n = 20, p = 0,25) için beklenen değer?', o: ['5', '20', '3,75', '0,25'], a: 0, n: 'E[X] = np = 20 · 0,25 = 5; Var = np(1 − p) = 3,75.' },
    { q: 'Poisson dağılımında ortalama 4 ise varyans kaçtır?', o: ['4', '2', '16', '1/4'], a: 0, n: 'Poisson’da ortalama = varyans = λ.' },
    { q: 't dağılımı ile standart normal arasındaki fark hangisi?', o: ['t’nin kuyrukları daha kalındır; sd arttıkça fark kaybolur', 't hep sağa çarpıktır', 't’nin ortalaması 1’dir', 't yalnız kesikli verilerde kullanılır'], a: 0, n: 'σ tahmin edildiği için belirsizlik artar; t daha basık ve kuyruklu, sd → ∞ iken normale döner.' }
  ];

  FN.st.dagilim = {
    init: function () {
      root = C.$('#dagilim');
      root.innerHTML = IS.head({ k: 'istasyon 3 · olasılık dağılımları', title: 'Dağılım galerisi', sub: 'Sürgüleri oynat, eğrinin biçimi değişsin. İki sınır sürgüsü arasındaki <b>alan</b>, o aralığa düşme olasılığıdır; z tablosunun canlı hâli.', weeks: ['İst I · 7. hafta: rastlantı değişkeni', '8–9. hafta: binom, Poisson', '9–10. hafta: normal, z, t, ki-kare'] }) +
        '<div class="seg" data-dist style="margin-bottom:14px"></div>' +
        '<div class="grid gside"><div class="card box" style="--cc:#7FE0C2"><h2 data-dt></h2><p class="sub" data-desc></p><div data-params></div></div>' +
        '<div class="card box" style="--cc:#7FE0C2"><div data-ch></div><div data-pr></div><div data-code></div></div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      IS.seg(C.$('[data-dist]', root), Object.keys(D).map(function (k) { return [k, D[k].t]; }), cur, function (k) { cur = k; C.$('[data-dt]', root).textContent = D[k].t + ' dağılımı'; panel(); FN.bridgeSend(); });
      C.$('[data-dt]', root).textContent = D[cur].t + ' dağılımı';
      panel();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Dağılımlar');
    },
    ctx: function () {
      var o = calc(cur), p = P[cur];
      return IS.ctx('dagilim', D[cur].t + ' dağılımı', Object.keys(p).filter(function (k) { return k !== 'inv'; }).map(function (k) { return [k, f(p[k], 2)]; }).concat([['P(a ≤ X ≤ b)', f(o.pr, 4)]]),
        'öğrenci ' + D[cur].t + ' dağılımında alan/olasılık hesabı çalışıyor.', ['Bu olasılığı elle nasıl hesaplarım?', 'z tablosu nasıl okunur?', 'Hangi durumda hangi dağılım?']);
    }
  };
})();
