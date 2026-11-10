/* ==========================================================================
   ACADEX İSTATİSTİK · 13–15. haftalar (labs/istat/ist-h4.js), 11.11.2026
   13 Sürekli rastgele değişken · 14 Düzgün ve üstel dağılım · 15 Normal dağılım
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;
  /* sayısal integral (Simpson) */
  var integ = function (f, a, b, n) { n = n || 400; if (b <= a) return 0; var h = (b - a) / n, s = f(a) + f(b); for (var i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return s * h / 3; };
  /* z tablosundan satırlar: P(0 < Z < z), satır = ilk ondalık, sütun = ikinci ondalık */
  var ztab = IST.ztab = function (zs, o) {
    o = o || {}; var rows = [], hi = {};
    zs.forEach(function (z) { var a = Math.abs(Math.round(z * 100) / 100), r = Math.floor(a * 10 + 1e-9) / 10; if (rows.indexOf(r) < 0) rows.push(r); });
    rows.sort(function (a, b) { return a - b; });
    var body = rows.map(function (r, i) {
      zs.forEach(function (z) { var a = Math.abs(Math.round(z * 100) / 100); if (Math.floor(a * 10 + 1e-9) / 10 === r && o.hi !== false) hi[i + ',' + (Math.round((a - r) * 100) + 1)] = 'hi'; });
      return ['<b>' + nf(r, 1, false) + '</b>'].concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (c) { return nf(M.ztab(r + c / 100), 4, false); }));
    });
    return '<div style="overflow-x:auto">' + V.tablo(['z'].concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (c) { return ',0' + c; })), body, { n: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], st: 0, hi: o.hi === false ? {} : hi, cap: 'Standart normal tablo: P(0 < Z < z)' }) + '</div>';
  };
  var normC = function (o) { return V.curve({ f: function (x) { return M.npdf(x, o.m, o.s); }, a: o.m - 4 * o.s, b: o.m + 4 * o.s, ymax: M.npdf(o.m, o.m, o.s) * 1.12, sh: o.sh, xt: o.xt, h: o.h || 230, renk: o.renk, shc: o.shc, d: o.d, extra: o.extra }); };

  /* ======================= 13. HAFTA ======================= */
  var TRI = function (x) { return x >= 0 && x <= 2 ? x / 2 : 0; };
  IST.hafta({
    id: 'g13', no: 13, renk: '#6B4FB3', tr: 'Sürekli rastgele değişken', en: 'Continuous PD 1',
    sahneler: [
      {
        b: 'Sürekli değişkende olasılık = alan', terim: [['sürekli rastgele değişken', 'continuous random variable'], ['alan', 'area under the curve']],
        t: '<p>Sürekli X bir aralıktaki <b>sayılamayacak kadar çok</b> değeri alabilir (bekleme süresi, ağırlık). Bu yüzden tek bir noktanın olasılığı sıfırdır: <b>P(X = a) = 0</b>.</p><p>Olasılık, eğrinin altındaki <b>alandır</b>: P(a ≤ X ≤ b) = a ile b arasındaki alan. Bu yüzden ≤ ile &lt; arasında fark yoktur.</p>',
        v: function () {
          var r = IST.rng(9), e = [], f = []; for (var a = 0; a <= 10; a += 0.5) e.push(a);
          var v = []; for (var i = 0; i < 400; i++) v.push(Math.min(9.99, Math.max(0, 5 + (r() + r() + r() - 1.5) * 4)));
          f = e.slice(0, -1).map(function (lo, j) { return v.filter(function (x) { return x >= lo && x < e[j + 1]; }).length; });
          return V.hist({ edges: e, y: f, h: 260, val: false, every: 4, renk: '#C9B8F0', xlab: 'histogram sınıfları daraldıkça → düzgün bir eğri', poly: true });
        }
      },
      {
        b: 'Olasılık yoğunluk fonksiyonu', terim: [['olasılık yoğunluk fonksiyonu', 'probability density function f(x)']],
        t: '<p>Sürekli X’in dağılımını <b>f(x)</b> belirler. İki koşul:</p><ul><li><b>f(x) ≥ 0</b> her x için</li><li>eğrinin altındaki <b>toplam alan = 1</b>: ∫ f(x) dx = 1</li></ul><p>Örnek: f(x) = kx, 0 ≤ x ≤ 2. Alan bir üçgen: ½ · 2 · 2k = 2k = 1 → <b>k = ½</b>, yani f(x) = x/2.</p>',
        v: function () { return V.curve({ f: TRI, a: -0.3, b: 2.4, ymax: 1.15, sh: [0, 2], xt: [0, 0.5, 1, 1.5, 2], h: 250, renk: PAL[4], extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.5) + ' x="' + xs(1.35) + '" y="' + ys(0.3) + '" text-anchor="middle">alan = ½·2·1 = 1</text><text class="lbm" x="' + xs(2) + '" y="' + (ys(1) - 8) + '" text-anchor="middle">f(2) = 1</text>'; } }); }
      },
      {
        b: 'Aralık olasılığı', terim: [['integral', 'integral ∫']],
        t: '<p class="mono">P(a ≤ X ≤ b) = ∫ₐᵇ f(x) dx</p><p>f(x) = x/2 için ∫ x/2 dx = x²/4. Böylece:</p><p>P(0,5 ≤ X ≤ 1,5) = (1,5² − 0,5²) / 4 = (2,25 − 0,25)/4 = <b>0,5</b>.</p><p>Aynı genişlikteki [0; 1] aralığının olasılığı ise yalnızca 0,25: eğri yükseldikçe alan büyür.</p>',
        v: function () { return V.curve({ f: TRI, a: -0.3, b: 2.4, ymax: 1.15, sh: [0.5, 1.5], xt: [0, 0.5, 1, 1.5, 2], h: 250, renk: PAL[4], extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.4) + ' x="' + xs(1.05) + '" y="' + ys(0.18) + '" text-anchor="middle">0,5</text>'; } }) + V.fx([{ s: 'F(b) − F(a)', h: '1,5²/4 − 0,5²/4 = 0,5625 − 0,0625 = <b>0,5</b>', son: true }], 1.6); }
      },
      {
        b: 'Birikimli dağılım fonksiyonu', terim: [['birikimli dağılım fonksiyonu', 'cumulative distribution function F(x)']],
        t: '<p><b>F(x) = P(X ≤ x)</b>: x’e kadar biriken alan. f(x) = x/2 için:</p><p class="mono">F(x) = 0 (x &lt; 0) · x²/4 (0 ≤ x ≤ 2) · 1 (x &gt; 2)</p><p>F hep artar, 0’dan başlayıp 1’de biter. Aralık olasılığı: <b>P(a ≤ X ≤ b) = F(b) − F(a)</b>.</p>',
        v: function () { return V.curve({ f: function (x) { return x < 0 ? 0 : x > 2 ? 1 : x * x / 4; }, a: -0.5, b: 2.6, ymax: 1.12, xt: [0, 0.5, 1, 1.5, 2], h: 250, renk: PAL[1], extra: function (xs, ys) { return '<g class="an" ' + d(1.3) + '><line x1="' + xs(1) + '" x2="' + xs(1) + '" y1="' + ys(0) + '" y2="' + ys(0.25) + '" stroke="#0D1838" stroke-dasharray="4 4"/><line x1="' + xs(-0.5) + '" x2="' + xs(1) + '" y1="' + ys(0.25) + '" y2="' + ys(0.25) + '" stroke="#0D1838" stroke-dasharray="4 4"/><circle cx="' + xs(1) + '" cy="' + ys(0.25) + '" r="5" fill="#E0A526" stroke="#0D1838"/><text class="lbb" x="' + (xs(1) + 8) + '" y="' + (ys(0.25) - 8) + '">F(1) = 0,25</text><text class="lbm" x="' + xs(2.3) + '" y="' + (ys(1) - 8) + '" text-anchor="middle">F = 1</text></g>'; } }); }
      },
      {
        b: 'Ortalama ve varyans', terim: [['beklenen değer', 'E(X) = ∫ x f(x) dx'], ['varyans', 'Var(X) = E(X²) − μ²']],
        t: '<p>Kesiklideki toplamların yerini integral alır:</p><p class="mono">μ = ∫ x·f(x) dx &nbsp; σ² = ∫ x²·f(x) dx − μ²</p><p>f(x) = x/2: μ = ∫₀² x²/2 dx = 8/6 = <b>4/3 ≈ 1,333</b>; E(X²) = ∫₀² x³/2 dx = 2 → σ² = 2 − 16/9 = <b>2/9 ≈ 0,222</b>.</p>',
        v: function () { return V.curve({ f: TRI, a: -0.3, b: 2.4, ymax: 1.15, xt: [0, 0.5, 1, 1.5, 2], h: 210, renk: PAL[4], extra: function (xs, ys) { return '<g class="an" ' + d(1.2) + '><line x1="' + xs(4 / 3) + '" x2="' + xs(4 / 3) + '" y1="' + ys(0) + '" y2="' + ys(1.05) + '" stroke="#E0A526" stroke-width="3"/><path d="M' + xs(4 / 3) + ' ' + (ys(0) + 2) + 'l-12 18h24z" fill="#E0A526" stroke="#0D1838"/><text class="lbb" x="' + (xs(4 / 3) + 8) + '" y="' + ys(1.0) + '">μ = 4/3 (denge noktası)</text></g>'; } }) + V.fx([{ s: 'ortalama', h: 'μ = [x³/6]₀² = <b>1,333</b>' }, { s: 'varyans', h: 'σ² = [x⁴/8]₀² − (4/3)² = 2 − 1,778 = <b>0,222</b>', son: true }], 1.5); }
      },
      {
        b: 'Beklenen değer kuralları', terim: [['beklenen değerin doğrusallığı', 'laws of expectation']],
        t: '<p>Kesikli ve sürekli tüm rastgele değişkenler için:</p><ul><li><b>E(aX + b) = a·E(X) + b</b></li><li><b>Var(aX + b) = a²·Var(X)</b> (sabit eklemek yayılımı değiştirmez)</li><li>E(X + Y) = E(X) + E(Y)</li></ul><p>Bir hayır derneği atık kâğıt topluyor; konteynerdeki yabancı madde X (ton) için E(X) = 0,4, Var(X) = 0,02. Ayıklama maliyeti Y = 50 + 200X TL ise E(Y) = 50 + 200·0,4 = <b>130 TL</b>, Var(Y) = 200²·0,02 = <b>800</b>.</p>',
        v: function () { return V.fx([{ s: 'dönüşüm', h: 'Y = 50 + 200X' }, { s: 'ortalama', h: 'E(Y) = 50 + 200 × 0,4 = <b>130</b>' }, { s: 'varyans (sabit 50 düşer, 200 karesiyle girer)', h: 'Var(Y) = 200² × 0,02 = <b>800</b> · σᵧ = 28,28', son: true }], 0.2, 0.6); }
      }
    ],
    gorsel: {
      b: 'Alan avcısı: yoğunluk ve birikimli fonksiyon', t: 'Bir yoğunluk fonksiyonu seç, a ve b sürgüleriyle aralığı belirle. Üstte f(x) altında boyanan alan, altta F(x) üzerinde F(b) − F(a) aynı olasılığı gösterir.',
      kur: function (el) {
        var FN = {
          tri: { ad: 'f(x) = x/2, [0, 2]', f: TRI, lo: 0, hi: 2 },
          kare: { ad: 'f(x) = 3x²/8, [0, 2]', f: function (x) { return x >= 0 && x <= 2 ? 3 * x * x / 8 : 0; }, lo: 0, hi: 2 },
          tepe: { ad: 'f(x) = ¾(1 − x²), [−1, 1]', f: function (x) { return x >= -1 && x <= 1 ? 0.75 * (1 - x * x) : 0; }, lo: -1, hi: 1 }
        };
        var k = 'tri', a = 0.5, b = 1.5;
        el.innerHTML = '<div class="seg" data-f style="margin-bottom:12px">' + Object.keys(FN).map(function (x) { return '<button type="button" data-k="' + x + '" aria-pressed="' + (x === k) + '">' + FN[x].ad + '</button>'; }).join('') + '</div><div class="at-g"><div class="at-k"><label><span>a <output data-ao></output></span><input type="range" step="0.05" data-a></label><label><span>b <output data-bo></output></span><input type="range" step="0.05" data-b></label><div class="at-out" style="margin:0"><div><small>P(a ≤ X ≤ b)</small><b data-p></b></div><div><small>F(a)</small><b data-fa></b></div><div><small>F(b)</small><b data-fb></b></div><div><small>E(X)</small><b data-m></b></div><div><small>Var(X)</small><b data-v></b></div></div></div><div class="at-v"><div data-g1></div><div data-g2></div><div class="at-not" data-n></div></div></div>';
        var setR = function () { var F = FN[k], A = el.querySelector('[data-a]'), B = el.querySelector('[data-b]'); [A, B].forEach(function (s) { s.min = F.lo - 0.5; s.max = F.hi + 0.5; }); a = F.lo + (F.hi - F.lo) * 0.25; b = F.lo + (F.hi - F.lo) * 0.75; A.value = a; B.value = b; };
        var draw = function () {
          var F = FN[k], lo = Math.min(a, b), hi = Math.max(a, b), cdf = function (x) { return integ(F.f, F.lo, Math.max(F.lo, Math.min(F.hi, x)), 200); };
          var ymax = Math.max(integ(F.f, F.lo, F.hi) > 0 ? F.f(F.hi) : 1, F.f((F.lo + F.hi) / 2), F.f(F.lo)) * 1.15, P = cdf(hi) - cdf(lo);
          var xt = []; for (var t = F.lo; t <= F.hi + 1e-9; t += 0.5) xt.push(t);
          el.querySelector('[data-g1]').innerHTML = V.curve({ f: F.f, a: F.lo - 0.5, b: F.hi + 0.5, ymax: ymax, sh: [lo, hi], xt: xt, h: 200, renk: PAL[4], d: -2 });
          el.querySelector('[data-g2]').innerHTML = V.curve({ f: cdf, a: F.lo - 0.5, b: F.hi + 0.5, ymax: 1.1, xt: xt, h: 170, renk: PAL[1], d: -2, extra: function (xs, ys) { return '<line x1="' + xs(F.lo - 0.5) + '" x2="' + xs(F.hi + 0.5) + '" y1="' + ys(1) + '" y2="' + ys(1) + '" stroke="#CFC6B3" stroke-dasharray="3 3"/>' + [[lo, cdf(lo)], [hi, cdf(hi)]].map(function (p) { return '<line x1="' + xs(p[0]) + '" x2="' + xs(p[0]) + '" y1="' + ys(0) + '" y2="' + ys(p[1]) + '" stroke="#0D1838" stroke-dasharray="4 4"/><circle cx="' + xs(p[0]) + '" cy="' + ys(p[1]) + '" r="5" fill="#E0A526" stroke="#0D1838"/>'; }).join('') + '<line x1="' + (xs(F.hi + 0.5) - 14) + '" x2="' + (xs(F.hi + 0.5) - 14) + '" y1="' + ys(cdf(lo)) + '" y2="' + ys(cdf(hi)) + '" stroke="#E0A526" stroke-width="5"/>'; } });
          var mu = integ(function (x) { return x * F.f(x); }, F.lo, F.hi), va = integ(function (x) { return x * x * F.f(x); }, F.lo, F.hi) - mu * mu;
          el.querySelector('[data-ao]').textContent = nf(a, 2); el.querySelector('[data-bo]').textContent = nf(b, 2);
          el.querySelector('[data-p]').textContent = nf(P, 4, false); el.querySelector('[data-fa]').textContent = nf(cdf(lo), 4, false); el.querySelector('[data-fb]').textContent = nf(cdf(hi), 4, false);
          el.querySelector('[data-m]').textContent = nf(mu, 3); el.querySelector('[data-v]').textContent = nf(va, 3);
          el.querySelector('[data-n]').innerHTML = 'P(' + nf(lo, 2) + ' ≤ X ≤ ' + nf(hi, 2) + ') = F(' + nf(hi, 2) + ') − F(' + nf(lo, 2) + ') = ' + nf(cdf(hi), 4) + ' − ' + nf(cdf(lo), 4) + ' = <b>' + nf(P, 4) + '</b>. a = b yaparsan alan sıfırlanır: sürekli değişkende <b>P(X = a) = 0</b>.';
        };
        el.querySelector('[data-a]').oninput = function () { a = +this.value; draw(); };
        el.querySelector('[data-b]').oninput = function () { b = +this.value; draw(); };
        [].forEach.call(el.querySelectorAll('[data-f] [data-k]'), function (x) { x.onclick = function () { k = x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-f] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); setR(); draw(); }; });
        setR(); draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var c = r.pick([2, 3, 4, 5, 10]), k = 2 / (c * c);
      out.push({ tag: 'hesap', q: '<p>Bir ürünün montaj süresi X (dakika) için yoğunluk fonksiyonu <b>f(x) = kx, 0 ≤ x ≤ ' + c + '</b> (diğer yerlerde 0).</p><p>f’nin geçerli bir yoğunluk fonksiyonu olması için <b>k</b> kaç olmalıdır? (dört ondalık ya da kesir)</p>', say: k, goster: '2/' + (c * c) + ' = ' + nf(k, 4), tol: 0.0003, ornek: '1/2',
        ip: 'Toplam alan 1 olmalı: ∫₀^' + c + ' kx dx = k·' + c + '²/2.', cz: ['∫₀^' + c + ' kx dx = k·x²/2 |₀^' + c + ' = k·' + (c * c) + '/2.', 'k·' + (c * c) + '/2 = 1 → k = 2/' + (c * c) + ' = <b>' + nf(k, 4) + '</b>.'] });
      var a = r.int(0, 12) / 10, b = Math.min(2, a + r.int(3, 10) / 10), p = (b * b - a * a) / 4;
      out.push({ tag: 'grafik', q: '<p>Bir kafede siparişin hazırlanma süresi X (× 5 dakika) için f(x) = x/2, 0 ≤ x ≤ 2.</p><p><b>P(' + nf(a, 1) + ' ≤ X ≤ ' + nf(b, 1) + ')</b> kaçtır? (dört ondalık)</p>', g: V.curve({ f: TRI, a: -0.2, b: 2.3, ymax: 1.15, sh: [a, b], xt: [0, 0.5, 1, 1.5, 2], h: 180, renk: PAL[4] }), say: p, goster: nf(p, 4), tol: 0.0006, ornek: '0,5',
        ip: 'F(x) = x²/4; P = F(b) − F(a).', cz: ['F(' + nf(b, 1) + ') = ' + nf(b, 1) + '²/4 = ' + nf(b * b / 4, 4) + '.', 'F(' + nf(a, 1) + ') = ' + nf(a * a / 4, 4) + '.', 'P = <b>' + nf(p, 4) + '</b>.'] });
      var c3 = r.pick([1, 2, 4, 6, 8, 10]), mu3 = 3 * c3 / 4;
      out.push({ tag: 'hesap', q: '<p>Bir sunucunun yanıt süresi X (saniye) için f(x) = 3x² / ' + (c3 * c3 * c3) + ', 0 ≤ x ≤ ' + c3 + '.</p><p><b>E(X)</b> kaçtır? (üç ondalık)</p>', say: mu3, goster: nf(mu3, 3), tol: 0.0021, ornek: '1,333',
        ip: 'E(X) = ∫ x·f(x) dx = ∫₀^c 3x³/c³ dx.', cz: ['∫₀^' + c3 + ' 3x³ / ' + (c3 * c3 * c3) + ' dx = 3/' + (c3 * c3 * c3) + ' · x⁴/4 |₀^' + c3 + '.', '= 3·' + Math.pow(c3, 4) + ' / (4·' + (c3 * c3 * c3) + ') = 3·' + c3 + '/4 = <b>' + nf(mu3, 3) + '</b>.'] });
      var ex = r.int(2, 9) / 10 * 10, vx = r.int(2, 30) / 10, aa = r.pick([20, 50, 100, 150]), bb = r.pick([100, 250, 500]), ask = r.int(0, 1), ans = ask ? aa * aa * vx : bb + aa * ex;
      out.push({ tag: 'kural', q: '<p>Bir atölyede günlük arıza süresi X (saat) için E(X) = ' + nf(ex, 1) + ', Var(X) = ' + nf(vx, 1) + '. Günlük kayıp maliyeti <b>Y = ' + bb + ' + ' + aa + 'X</b> TL.</p><p><b>' + (ask ? 'Var(Y)' : 'E(Y)') + '</b> kaçtır?</p>', say: ans, goster: nf(ans, 1), tol: Math.max(0.05, ans * 0.001), ornek: '130',
        yanlis: function (v) { return ask && Math.abs(v - aa * vx) < 0.1 ? 'a karesiyle girer: Var(aX + b) = a²·Var(X).' : ask && Math.abs(v - (aa * aa * vx + bb)) < 0.1 ? 'Sabit (' + bb + ') varyansı değiştirmez.' : 'Kuralı kontrol et.'; },
        ip: ask ? 'Var(aX + b) = a²·Var(X).' : 'E(aX + b) = a·E(X) + b.', cz: [ask ? 'Var(Y) = ' + aa + '² × ' + nf(vx, 1) + '.' : 'E(Y) = ' + bb + ' + ' + aa + ' × ' + nf(ex, 1) + '.', '= <b>' + nf(ans, 1) + '</b>.'] });
      var v5 = r.int(1, 9);
      out.push({ tag: 'kavram', q: '<p>Bir otobüsün durağa varış süresi X sürekli bir rastgele değişken. <b>P(X = ' + v5 + ' dakika)</b> kaçtır?</p>', o: ['0', 'f(' + v5 + ')', 'F(' + v5 + ')', '1 − F(' + v5 + ')'], a: 0, n: 'Tek bir noktanın altında alan yoktur; sürekli değişkende P(X = a) = 0. Bu yüzden P(X ≤ a) = P(X < a).',
        yn: { 1: 'f(x) olasılık değil yoğunluktur; 1’den büyük bile olabilir.', 2: 'F(a) = P(X ≤ a), yani a’ya kadar olan alan.', 3: 'Bu P(X > a).' }, ip: 'Olasılık = alan. Genişliği sıfır olan bir şeridin alanı nedir?', cz: ['P(X = a) = ∫ₐᵃ f(x) dx.', 'Alt ve üst sınır aynı → integral <b>0</b>.'] });
      return out;
    }
  });

  /* ======================= 14. HAFTA ======================= */
  IST.hafta({
    id: 'g14', no: 14, renk: '#E0A526', tr: 'Düzgün ve üstel dağılım', en: 'Continuous PD 2: Uniform and Exponential',
    sahneler: [
      {
        b: 'Sürekli düzgün dağılım', terim: [['düzgün dağılım', 'uniform distribution X ~ U(a, b)']],
        t: '<p>X, a ile b arasında her yerde <b>eşit yoğunlukta</b>: f(x) = 1 / (b − a), a ≤ x ≤ b; dışında 0. Grafik bir dikdörtgendir.</p><p>X ~ U(5, 10): f(x) = 1/5 = <b>0,2</b>. Alan = 5 × 0,2 = 1 ✓.</p>',
        v: function () { return V.curve({ f: function (x) { return x >= 5 && x <= 10 ? 0.2 : 0; }, a: 3, b: 12, ymax: 0.28, sh: [5, 10], xt: [3, 5, 7, 8, 10, 12], h: 240, renk: PAL[3], shc: '#FFE08A', extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.3) + ' x="' + xs(7.5) + '" y="' + ys(0.1) + '" text-anchor="middle">alan = 5 × 0,2 = 1</text><text class="lbm" x="' + xs(5) + '" y="' + (ys(0.2) - 8) + '">f = 0,2</text>'; } }); }
      },
      {
        b: 'Düzgün dağılımda olasılık', terim: [['dikdörtgen alanı', 'width × height']],
        t: '<p>Alan = genişlik × yükseklik.</p><ul><li>P(X ≥ 7) = (10 − 7) × 0,2 = <b>0,6</b></li><li>P(6 ≤ X ≤ 8) = (8 − 6) × 0,2 = <b>0,4</b></li></ul><p>Aynı genişlikteki her aralık aynı olasılığa sahiptir.</p>',
        v: function () { var f = function (x) { return x >= 5 && x <= 10 ? 0.2 : 0; }; return V.curve({ f: f, a: 3, b: 12, ymax: 0.28, sh: [7, 10], xt: [5, 7, 10], h: 150, renk: PAL[3], extra: function (xs, ys) { return '<text class="lbb" x="' + xs(8.5) + '" y="' + ys(0.1) + '" text-anchor="middle">P(X ≥ 7) = 0,6</text>'; } }) + V.curve({ f: f, a: 3, b: 12, ymax: 0.28, sh: [6, 8], xt: [5, 6, 8, 10], h: 150, renk: PAL[3], shc: PAL[2], d: 0.8, extra: function (xs, ys) { return '<text class="lbb" x="' + xs(7) + '" y="' + ys(0.1) + '" text-anchor="middle">P(6 ≤ X ≤ 8) = 0,4</text>'; } }); }
      },
      {
        b: 'Ortalama, varyans ve birikimli fonksiyon', terim: [['ortalama', 'μ = (a + b)/2'], ['varyans', 'σ² = (b − a)²/12']],
        t: '<p class="mono">μ = (a + b)/2 &nbsp; σ² = (b − a)²/12 &nbsp; F(x) = (x − a)/(b − a)</p><p>Bir bankanın çağrı merkezinde hizmet süresi 3 ile 5,5 dakika arasında düzgün: μ = 8,5/2 = <b>4,25 dk</b>; σ² = 2,5²/12 = <b>0,5208</b>; σ = 0,7217 dk.</p><p>F(x) üç parçalı: x &lt; 3 için 0; 3 ≤ x ≤ 5,5 için (x − 3)/2,5; x &gt; 5,5 için 1.</p>',
        v: function () { return V.curve({ f: function (x) { return x < 3 ? 0 : x > 5.5 ? 1 : (x - 3) / 2.5; }, a: 2, b: 6.5, ymax: 1.12, xt: [2, 3, 4, 4.25, 5, 5.5, 6.5], h: 230, renk: PAL[1], extra: function (xs, ys) { return '<g class="an" ' + d(1.2) + '><line x1="' + xs(4.25) + '" x2="' + xs(4.25) + '" y1="' + ys(0) + '" y2="' + ys(0.5) + '" stroke="#E0A526" stroke-width="3"/><circle cx="' + xs(4.25) + '" cy="' + ys(0.5) + '" r="5" fill="#E0A526" stroke="#0D1838"/><text class="lbb" x="' + (xs(4.25) + 8) + '" y="' + (ys(0.5) + 4) + '">μ = 4,25 → F = 0,5</text></g>'; } }); }
      },
      {
        b: 'Üstel dağılım', terim: [['üstel dağılım', 'exponential distribution'], ['oran', 'rate λ'], ['ortalama', 'μ = 1/λ']],
        t: '<p>İki olay <b>arasındaki süreyi</b> modeller (iki müşteri arası, bir görüşmenin süresi).</p><p class="mono">f(x) = λe^(−λx), x ≥ 0 &nbsp; μ = σ = 1/λ</p><p class="mono">P(X ≤ x) = 1 − e^(−λx) &nbsp; P(X &gt; x) = e^(−λx)</p><p>Temsilcinin görüşme süresi ortalaması 5 dk → λ = 0,2. P(X &gt; 7) = e^(−1,4) = <b>0,2466</b>.</p>',
        v: function () { return V.curve({ f: function (x) { return x < 0 ? 0 : 0.2 * Math.exp(-0.2 * x); }, a: -1, b: 22, ymax: 0.23, sh: [7, 22], xt: [0, 5, 7, 10, 15, 20], h: 250, renk: PAL[0], extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.4) + ' x="' + xs(11) + '" y="' + ys(0.06) + '">P(X > 7) = 0,2466</text><line x1="' + xs(5) + '" x2="' + xs(5) + '" y1="' + ys(0) + '" y2="' + ys(0.2) + '" stroke="#E0A526" stroke-width="2.5" stroke-dasharray="5 4"/><text class="lbm" x="' + (xs(5) + 4) + '" y="' + ys(0.19) + '">μ = 5</text>'; } }); }
      },
      {
        b: 'Hafızasızlık ve Poisson bağlantısı', terim: [['hafızasızlık', 'memoryless property']],
        t: '<p>Olaylar Poisson’a göre (oran λ) geliyorsa, iki olay arasındaki süre <b>üstel</b> dağılır (ortalama 1/λ).</p><p><b>Hafızasızlık:</b> P(X &gt; s + t | X &gt; s) = P(X &gt; t). 10 dakikadır müşteri gelmemiş olması, sonraki 5 dakikada gelme olasılığını değiştirmez. Üstel dağılım bu özelliğe sahip tek sürekli dağılımdır.</p>',
        v: function () {
          var s = '', r = IST.rng(12), t = 0, xs = V.sc(0, 60, 20, 520);
          s += '<line x1="20" x2="520" y1="90" y2="90" stroke="#0D1838" stroke-width="2"/>';
          for (var i = 0; i < 12 && t < 58; i++) { var g = -Math.log(1 - r()) * 5; var t2 = t + g; if (t2 > 60) break; s += '<path class="dr" style="--len:200;--d:' + (i * 0.2) + 's" d="M' + xs(t) + ' 90 Q ' + ((xs(t) + xs(t2)) / 2) + ' ' + (90 - Math.min(60, g * 8)) + ' ' + xs(t2) + ' 90" fill="none" stroke="' + PAL[0] + '" stroke-width="2"/><circle class="pop" ' + d(0.2 + i * 0.2) + ' cx="' + xs(t2) + '" cy="90" r="6" fill="' + PAL[1] + '" stroke="#0D1838"/>'; t = t2; }
          for (var m = 0; m <= 60; m += 10) s += '<text class="lbm" x="' + xs(m) + '" y="110" text-anchor="middle">' + m + '</text>';
          s += '<text class="lbl" x="20" y="134">kırmızı nokta: müşteri gelişi (Poisson, saatte 12) · yaylar: aradaki süreler (üstel, ortalama 5 dk)</text>';
          return V.svg(540, 150, s, 'Poisson gelişleri ve üstel aralar');
        }
      }
    ],
    gorsel: {
      b: 'Düzgün mü, üstel mi? Olasılık laboratuvarı', t: 'Dağılımı seç, parametreleri ve aralığı ayarla. Boyalı alanın olasılığı, ortalama ve standart sapma canlı hesaplanır.',
      kur: function (el) {
        var tip = 'u', A = 3, B = 5.5, mu = 5, lo = 4, hi = 5;
        el.innerHTML = '<div class="seg" data-t style="margin-bottom:12px"><button type="button" data-k="u" aria-pressed="true">Düzgün U(a, b)</button><button type="button" data-k="e" aria-pressed="false">Üstel (ortalama 1/λ)</button></div><div class="at-g"><div class="at-k" data-c></div><div class="at-v"><div data-g></div><div class="at-out" data-o></div><div class="at-not" data-n></div></div></div>';
        var ctl = function () {
          var c = el.querySelector('[data-c]');
          c.innerHTML = (tip === 'u' ? '<label><span>a <output data-Ao></output></span><input type="range" min="0" max="10" step="0.5" value="' + A + '" data-A></label><label><span>b <output data-Bo></output></span><input type="range" min="0.5" max="12" step="0.5" value="' + B + '" data-B></label>' : '<label><span>ortalama 1/λ <output data-mo></output></span><input type="range" min="0.5" max="15" step="0.5" value="' + mu + '" data-m></label>') +
            '<label><span>aralık başı <output data-lo></output></span><input type="range" min="0" max="30" step="0.25" value="' + lo + '" data-l></label><label><span>aralık sonu <output data-ho></output></span><input type="range" min="0" max="30" step="0.25" value="' + hi + '" data-h></label>';
          if (tip === 'u') { c.querySelector('[data-A]').oninput = function () { A = +this.value; if (B <= A) B = A + 0.5; draw(); }; c.querySelector('[data-B]').oninput = function () { B = +this.value; if (A >= B) A = B - 0.5; draw(); }; }
          else c.querySelector('[data-m]').oninput = function () { mu = +this.value; draw(); };
          c.querySelector('[data-l]').oninput = function () { lo = +this.value; draw(); };
          c.querySelector('[data-h]').oninput = function () { hi = +this.value; draw(); };
          draw();
        };
        var draw = function () {
          var a1 = Math.min(lo, hi), b1 = Math.max(lo, hi), P, m, s, g;
          if (tip === 'u') {
            var f = 1 / (B - A), cl = function (x) { return Math.max(A, Math.min(B, x)); };
            P = (cl(b1) - cl(a1)) * f; m = (A + B) / 2; s = (B - A) / Math.sqrt(12);
            g = V.curve({ f: function (x) { return x >= A && x <= B ? f : 0; }, a: Math.min(0, A - 1), b: Math.max(B + 1, b1 + 0.5), ymax: f * 1.3, sh: [a1, b1], xt: [A, B, a1, b1].filter(function (v, i, arr) { return arr.indexOf(v) === i; }).map(function (v) { return [v, nf(v, 2)]; }), h: 240, renk: PAL[3], d: -2 });
            el.querySelector('[data-Ao]').textContent = nf(A, 1); el.querySelector('[data-Bo]').textContent = nf(B, 1);
            el.querySelector('[data-n]').innerHTML = 'P(' + nf(a1, 2) + ' ≤ X ≤ ' + nf(b1, 2) + ') = (kesişen genişlik) × 1/(b − a) = ' + nf(cl(b1) - cl(a1), 2) + ' × ' + nf(f, 4) + ' = <b>' + nf(P, 4) + '</b>. σ² = (b − a)²/12 = ' + nf(s * s, 4) + '.';
          } else {
            var L = 1 / mu, ef = function (x) { return x < 0 ? 0 : L * Math.exp(-L * x); };
            P = Math.exp(-L * Math.max(0, a1)) - Math.exp(-L * Math.max(0, b1)); m = mu; s = mu;
            g = V.curve({ f: ef, a: -0.5, b: Math.max(mu * 4, b1 + 1), ymax: L * 1.15, sh: [a1, b1], xt: [0, mu, a1, b1].filter(function (v, i, arr) { return arr.indexOf(v) === i; }).map(function (v) { return [v, nf(v, 2)]; }), h: 240, renk: PAL[0], d: -2 });
            el.querySelector('[data-mo]').textContent = nf(mu, 1) + ' (λ = ' + nf(L, 3) + ')';
            el.querySelector('[data-n]').innerHTML = 'P(' + nf(a1, 2) + ' ≤ X ≤ ' + nf(b1, 2) + ') = e^(−λ·' + nf(a1, 2) + ') − e^(−λ·' + nf(b1, 2) + ') = ' + nf(Math.exp(-L * a1), 4) + ' − ' + nf(Math.exp(-L * b1), 4) + ' = <b>' + nf(P, 4) + '</b>. Hafızasızlık: aralığı sağa kaydırırken genişliği koru; P(X > s + t | X > s) hep e^(−λt).';
          }
          el.querySelector('[data-g]').innerHTML = g;
          el.querySelector('[data-lo]').textContent = nf(lo, 2); el.querySelector('[data-ho]').textContent = nf(hi, 2);
          el.querySelector('[data-o]').innerHTML = '<div><small>P(aralık)</small><b>' + nf(P, 4, false) + '</b></div><div><small>μ</small><b>' + nf(m, 3) + '</b></div><div><small>σ</small><b>' + nf(s, 3) + '</b></div>';
        };
        [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (x) { x.onclick = function () { tip = x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); if (tip === 'e') { lo = 2; hi = 8; } else { lo = 4; hi = 5; } ctl(); }; });
        ctl();
      }
    },
    sorular: function (r) {
      var out = [];
      var a = r.int(2, 20), w = r.int(4, 20), b = a + w, c = a + r.int(1, w - 1), p1 = (b - c) / w;
      var ctx = r.pick(['Bir asansörün bekleme süresi (saniye)', 'Bir metro hattında trenin gelmesine kalan süre (dakika × 0,5)', 'Bir paketin depoda hazırlanma süresi (dakika)']);
      out.push({ tag: 'senaryo', q: '<p>' + ctx + ' X, <b>' + a + ' ile ' + b + '</b> arasında düzgün dağılıyor.</p><p><b>P(X ≥ ' + c + ')</b> kaçtır? (dört ondalık)</p>', say: p1, goster: nf(p1, 4), tol: 0.0006, ornek: '0,6',
        ip: 'f(x) = 1/(b − a); alan = genişlik × yükseklik.', cz: ['f(x) = 1/' + w + '.', 'Genişlik: ' + b + ' − ' + c + ' = ' + (b - c) + '.', 'P = ' + (b - c) + '/' + w + ' = <b>' + nf(p1, 4) + '</b>.'] });
      var a2 = r.int(0, 10), w2 = r.int(6, 20), b2 = a2 + w2, c2 = a2 + r.int(0, w2 - 4), d2 = c2 + r.int(2, b2 - c2 - 1 > 2 ? b2 - c2 - 1 : 2), p2 = (Math.min(d2, b2) - c2) / w2;
      out.push({ tag: 'grafik', q: '<p>Bir otoparkta aracın kalma süresi X (saat × 0,25) U(' + a2 + ', ' + b2 + ') dağılımına uyuyor.</p><p><b>P(' + c2 + ' ≤ X ≤ ' + Math.min(d2, b2) + ')</b> kaçtır? (dört ondalık)</p>', g: V.curve({ f: function (x) { return x >= a2 && x <= b2 ? 1 / w2 : 0; }, a: a2 - 2, b: b2 + 2, ymax: 1.3 / w2, sh: [c2, Math.min(d2, b2)], xt: [a2, c2, Math.min(d2, b2), b2].filter(function (v, i, arr) { return arr.indexOf(v) === i; }).map(function (v) { return [v, String(v)]; }), h: 170, renk: PAL[3] }), say: p2, goster: nf(p2, 4), tol: 0.0006, ornek: '0,4',
        ip: 'Boyalı dikdörtgenin genişliği × 1/(b − a).', cz: ['Genişlik: ' + (Math.min(d2, b2) - c2) + ', yükseklik: 1/' + w2 + '.', 'P = <b>' + nf(p2, 4) + '</b>.'] });
      var a3 = r.int(1, 10) / 2, b3 = a3 + r.int(2, 16) / 2, v3 = Math.pow(b3 - a3, 2) / 12;
      out.push({ tag: 'hesap', q: '<p>Bir çağrı merkezinde hizmet süresi <b>' + nf(a3, 1) + ' ile ' + nf(b3, 1) + ' dakika</b> arasında düzgün dağılıyor.</p><p>Hizmet süresinin <b>varyansı</b> kaçtır? (dört ondalık)</p>', say: v3, goster: nf(v3, 4), tol: 0.0006, ornek: '0,5208',
        yanlis: function (v) { return Math.abs(v - (a3 + b3) / 2) < 0.01 ? 'Bu ortalama.' : Math.abs(v - Math.sqrt(v3)) < 0.002 ? 'Bu standart sapma; varyans karesidir.' : 'σ² = (b − a)²/12.'; },
        ip: 'σ² = (b − a)²/12.', cz: ['b − a = ' + nf(b3 - a3, 1) + '.', '(' + nf(b3 - a3, 1) + ')² / 12 = ' + nf(Math.pow(b3 - a3, 2), 2) + ' / 12 = <b>' + nf(v3, 4) + '</b>.'] });
      var m4 = r.pick([2, 3, 4, 5, 6, 8, 10, 12]), x4 = r.int(1, 3 * m4), p4 = Math.exp(-x4 / m4);
      out.push({ tag: 'senaryo', q: '<p>Bir müşteri temsilcisinin görüşme süresi ortalaması <b>' + m4 + ' dakika</b> olan üstel dağılıma uyuyor.</p><p>Rastgele bir görüşmenin <b>' + x4 + ' dakikadan uzun</b> sürme olasılığı kaçtır? (dört ondalık)</p>', say: p4, goster: nf(p4, 4), tol: 0.0006, ornek: '0,2466',
        yanlis: function (v) { return Math.abs(v - (1 - p4)) < 0.001 ? 'Bu P(X ≤ ' + x4 + '); soru “uzun” diyor: P(X > x) = e^(−λx).' : 'λ = 1/ortalama.'; },
        ip: 'λ = 1/μ; P(X > x) = e^(−λx).', cz: ['λ = 1/' + m4 + ' = ' + nf(1 / m4, 4) + '.', 'λx = ' + x4 + '/' + m4 + ' = ' + nf(x4 / m4, 4) + '.', 'P = e^(−' + nf(x4 / m4, 4) + ') = <b>' + nf(p4, 4) + '</b>.'] });
      var rate = r.pick([6, 10, 12, 15, 20, 30]), mins = r.pick([2, 3, 5, 6, 10]), p5 = 1 - Math.exp(-rate * mins / 60);
      out.push({ tag: 'Poisson → üstel', q: '<p>Bir fırına saatte ortalama <b>' + rate + '</b> müşteri geliyor (Poisson). Bir müşteri az önce geldi.</p><p>Sonraki müşterinin <b>' + mins + ' dakika içinde</b> gelme olasılığı kaçtır? (dört ondalık)</p>', say: p5, goster: nf(p5, 4), tol: 0.0006, ornek: '0,6321',
        ip: 'Gelişler arası süre üsteldir; λ’yı dakikaya çevir: ' + rate + '/60 müşteri/dk. P(X ≤ x) = 1 − e^(−λx).', cz: ['λ = ' + rate + '/60 = ' + nf(rate / 60, 4) + ' müşteri/dk.', 'λx = ' + nf(rate * mins / 60, 4) + '.', 'P(X ≤ ' + mins + ') = 1 − e^(−' + nf(rate * mins / 60, 4) + ') = <b>' + nf(p5, 4) + '</b>.'] });
      return out;
    }
  });

  /* ======================= 15. HAFTA ======================= */
  IST.hafta({
    id: 'g15', no: 15, renk: '#2F6FB0', tr: 'Normal dağılım', en: 'Normal Distribution',
    sahneler: [
      {
        b: 'Çan eğrisi: μ ve σ', terim: [['normal dağılım', 'normal distribution N(μ, σ²)'], ['konum parametresi', 'location μ'], ['ölçek parametresi', 'scale σ']],
        t: '<p>Normal dağılım μ etrafında <b>simetrik</b>, çan biçimli bir dağılımdır. İki parametre şekli belirler:</p><ul><li><b>μ</b> (konum): eğriyi sağa-sola kaydırır.</li><li><b>σ</b> (ölçek): σ büyüdükçe eğri yayılır ve basıklaşır, küçüldükçe daralır ve sivrileşir.</li></ul>',
        v: function () {
          var cs = [[50, 5, PAL[0]], [50, 10, PAL[1]], [70, 5, PAL[2]]], xs = V.sc(20, 100, 30, 520), ys = V.sc(0, 0.085, 230, 20), s = '<line x1="30" x2="520" y1="230" y2="230" stroke="#0D1838" stroke-width="2"/>';
          cs.forEach(function (c, i) { var p = []; for (var x = 20; x <= 100; x += 0.5) p.push(xs(x).toFixed(1) + ' ' + ys(M.npdf(x, c[0], c[1])).toFixed(1)); s += '<path class="dr" style="--len:1500;--d:' + (i * 0.6) + 's" d="M' + p.join('L') + '" fill="none" stroke="' + c[2] + '" stroke-width="3"/><text class="lbb fd" ' + d(0.6 + i * 0.6) + ' x="' + xs(c[0] + (i === 1 ? 14 : 0)) + '" y="' + (ys(M.npdf(c[0], c[0], c[1])) - 8 + (i === 1 ? 40 : 0)) + '" text-anchor="middle" style="fill:' + c[2] + '">μ=' + c[0] + ', σ=' + c[1] + '</text>'; });
          for (var t = 20; t <= 100; t += 10) s += '<text class="lbm" x="' + xs(t) + '" y="248" text-anchor="middle">' + t + '</text>';
          return V.svg(540, 256, s, 'farklı μ ve σ ile normal eğriler');
        }
      },
      {
        b: 'Normal eğrinin özellikleri', terim: [['simetri', 'symmetry'], ['asimptot', 'asymptotic tails']],
        t: '<ul><li>f(x) ≥ 0; x, μ’den uzaklaştıkça f(x) azalır.</li><li>Eğrinin altındaki toplam alan <b>1</b>.</li><li>μ’ye göre simetrik: <b>P(X &lt; μ) = P(X &gt; μ) = 0,5</b>. Ortalama = medyan = mod.</li><li>Kuyruklar sonsuza uzanır, x eksenine hiç değmez.</li></ul>',
        v: function () { return normC({ m: 0, s: 1, sh: [-4, 0], xt: [[-3, 'μ−3σ'], [-2, 'μ−2σ'], [-1, 'μ−σ'], [0, 'μ'], [1, 'μ+σ'], [2, 'μ+2σ'], [3, 'μ+3σ']], h: 250, extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.3) + ' x="' + xs(-0.9) + '" y="' + ys(0.12) + '" text-anchor="middle">0,5</text><text class="lbb fd" ' + d(1.3) + ' x="' + xs(0.9) + '" y="' + ys(0.12) + '" text-anchor="middle">0,5</text><text class="lbl fd" ' + d(1.5) + ' x="' + xs(0) + '" y="' + (ys(0.4) - 6) + '" text-anchor="middle">ortalama = medyan = mod</text>'; } }); }
      },
      {
        b: 'Ampirik kural: 68 – 95 – 99,7', terim: [['ampirik kural', 'empirical rule']],
        t: '<p>Her normal dağılımda:</p><ul><li>μ ± 1σ aralığı alanın <b>%68,3</b>’ünü,</li><li>μ ± 2σ aralığı <b>%95,4</b>’ünü,</li><li>μ ± 3σ aralığı <b>%99,7</b>’sini kapsar.</li></ul><p>Ortalaması 500 g, σ’sı 10 g olan paketlerin yaklaşık %95’i 480–520 g arasındadır.</p>',
        v: function () { return normC({ m: 0, s: 1, sh: [[-3, 3], [-2, 2], [-1, 1]], shc: PAL[0], xt: [[-3, '−3σ'], [-2, '−2σ'], [-1, '−σ'], [0, 'μ'], [1, '+σ'], [2, '+2σ'], [3, '+3σ']], h: 260, extra: function (xs, ys) { return [[1, '%68,3', 0.2], [2, '%95,4', 0.08], [3, '%99,7', 0.02]].map(function (b, i) { return '<g class="an" ' + d(1.4 + i * 0.4) + '><line x1="' + xs(-b[0]) + '" x2="' + xs(b[0]) + '" y1="' + ys(b[2]) + '" y2="' + ys(b[2]) + '" stroke="#0D1838" stroke-width="1.5"/><text class="lbb" x="' + xs(0) + '" y="' + (ys(b[2]) - 4) + '" text-anchor="middle" style="fill:' + (i ? '#0D1838' : '#fff') + '">' + b[1] + '</text></g>'; }).join(''); } }); }
      },
      {
        b: 'Standartlaştırma: z puanı', terim: [['standart normal', 'standard normal Z ~ N(0, 1)'], ['z puanı', 'z-score']],
        t: '<p>Her normal X için integral almak zor. Çözüm: X’i <b>standart normale</b> dönüştürmek (μ = 0, σ = 1):</p><p class="mono" style="font-size:16px">z = (x − μ) / σ</p><p>z, x’in ortalamadan <b>kaç standart sapma</b> uzakta olduğunu söyler. μ = 500, σ = 10 için x = 515 → z = <b>1,5</b>.</p>',
        v: function () {
          var top = normC({ m: 500, s: 10, sh: [470, 515], xt: [[470, '470'], [480, '480'], [490, '490'], [500, '500'], [510, '510'], [515, '515'], [520, '520'], [530, '530']], h: 160 });
          var bot = normC({ m: 0, s: 1, sh: [-3, 1.5], xt: [[-3, '−3'], [-2, '−2'], [-1, '−1'], [0, '0'], [1, '1'], [1.5, '1,5'], [2, '2'], [3, '3']], h: 160, renk: PAL[1], shc: PAL[1], d: 1 });
          return top + '<div class="an" ' + d(0.9) + ' style="text-align:center;font:700 14px JetBrains Mono,monospace;margin:4px 0">↓ z = (515 − 500) / 10 = 1,5 ↓</div>' + bot;
        }
      },
      {
        b: 'z tablosunu okumak', terim: [['z tablosu', 'standard normal table']],
        t: '<p>Tablo P(0 &lt; Z &lt; z) alanını verir. Satır z’nin ilk ondalığı, sütun ikinci ondalığı.</p><p>P(0 &lt; Z &lt; 1,25): satır 1,2 · sütun ,05 → <b>0,3944</b>.</p><p>Simetriyi kullan: P(Z &gt; 1,25) = 0,5 − 0,3944 = 0,1056; P(−1,25 &lt; Z &lt; 0) = 0,3944.</p>',
        v: function () { return normC({ m: 0, s: 1, sh: [0, 1.25], xt: [[-2, '−2'], [-1, '−1'], [0, '0'], [1.25, '1,25'], [2, '2']], h: 170, extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.2) + ' x="' + xs(0.6) + '" y="' + ys(0.12) + '" text-anchor="middle">0,3944</text>'; } }) + '<div class="an" ' + d(1) + '>' + ztab([1.25]) + '</div>'; }
      },
      {
        b: 'Uygulama: paket ağırlıkları', terim: [['ters problem', 'inverse problem (finding x)']],
        t: '<p>Paket ağırlığı X ~ N(500, 10²).</p><ul><li>P(X &lt; 485): z = −1,5 → 0,5 − 0,4332 = <b>0,0668</b></li><li>P(490 &lt; X &lt; 515): z = −1 ve 1,5 → 0,3413 + 0,4332 = <b>0,7745</b></li><li>En ağır %5’in sınırı: tabloda 0,45’e en yakın z ≈ 1,645 → x = 500 + 1,645·10 = <b>516,45 g</b></li></ul>',
        v: function () { return normC({ m: 500, s: 10, sh: [490, 515], xt: [[470, '470'], [485, '485'], [490, '490'], [500, '500'], [515, '515'], [530, '530']], h: 220, extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.2) + ' x="' + xs(502) + '" y="' + ys(0.012) + '" text-anchor="middle">0,7745</text>'; } }) + V.fx([{ s: 'iki tarafa ayır', h: 'P(−1 < Z < 0) + P(0 < Z < 1,5) = 0,3413 + 0,4332' }, { s: 'sonuç', h: 'P(490 < X < 515) = <b>0,7745</b>', son: true }], 1.4); }
      }
    ],
    gorsel: {
      b: 'Normal dağılım laboratuvarı', t: 'μ ve σ’yı ayarla, bir alan türü seç ve sınırları kaydır. z puanları, tablodan okunan değerler ve sonuç adım adım yazılır. Ampirik kural bantlarını açıp kapatabilirsin.',
      kur: function (el) {
        var mu = 500, sg = 10, a = 490, b = 515, mod = 'ara', band = false;
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>μ <output data-mo></output></span><input type="range" min="0" max="1000" step="5" value="500" data-m></label><label><span>σ <output data-so></output></span><input type="range" min="1" max="100" step="0.5" value="10" data-s></label><div class="seg" data-md><button type="button" data-k="sol" aria-pressed="false">P(X &lt; a)</button><button type="button" data-k="ara" aria-pressed="true">P(a &lt; X &lt; b)</button><button type="button" data-k="sag" aria-pressed="false">P(X &gt; b)</button></div><label><span>a <output data-ao></output></span><input type="range" step="0.5" data-a></label><label><span>b <output data-bo></output></span><input type="range" step="0.5" data-b></label><button type="button" class="btn sm ghost" data-bd aria-pressed="false">68–95–99,7 bantları</button></div><div class="at-v"><div data-g></div><div class="at-out" data-o></div><div class="at-not" data-n></div></div></div>';
        var rng = function () { var A = el.querySelector('[data-a]'), B = el.querySelector('[data-b]'); [A, B].forEach(function (s) { s.min = mu - 4 * sg; s.max = mu + 4 * sg; s.step = sg / 20; }); a = Math.max(mu - 4 * sg, Math.min(mu + 4 * sg, a)); b = Math.max(mu - 4 * sg, Math.min(mu + 4 * sg, b)); A.value = a; B.value = b; };
        var tp = function (z) { var t = M.ztab(z); return z >= 0 ? 0.5 + t : 0.5 - t; };
        var draw = function () {
          var lo = Math.min(a, b), hi = Math.max(a, b), za = Math.round((lo - mu) / sg * 100) / 100, zb = Math.round((hi - mu) / sg * 100) / 100, P, sh, steps;
          if (mod === 'sol') { P = tp(za); sh = [mu - 5 * sg, lo]; steps = 'z = (' + nf(lo, 2) + ' − ' + nf(mu, 1) + ') / ' + nf(sg, 1) + ' = ' + nf(za, 2) + ' → P(Z < ' + nf(za, 2) + ') = ' + (za >= 0 ? '0,5 + ' : '0,5 − ') + nf(M.ztab(za), 4, false); }
          else if (mod === 'sag') { P = 1 - tp(zb); sh = [hi, mu + 5 * sg]; steps = 'z = (' + nf(hi, 2) + ' − ' + nf(mu, 1) + ') / ' + nf(sg, 1) + ' = ' + nf(zb, 2) + ' → P(Z > ' + nf(zb, 2) + ') = ' + (zb >= 0 ? '0,5 − ' : '0,5 + ') + nf(M.ztab(zb), 4, false); }
          else { P = tp(zb) - tp(za); sh = [lo, hi]; steps = 'z₁ = ' + nf(za, 2) + ', z₂ = ' + nf(zb, 2) + ' → ' + (za < 0 && zb > 0 ? nf(M.ztab(za), 4, false) + ' + ' + nf(M.ztab(zb), 4, false) : '|' + nf(M.ztab(zb), 4, false) + ' − ' + nf(M.ztab(za), 4, false) + '|'); }
          var shs = band ? [[mu - 3 * sg, mu + 3 * sg], [mu - 2 * sg, mu + 2 * sg], [mu - sg, mu + sg]] : [sh];
          var xt = [-3, -2, -1, 0, 1, 2, 3].map(function (k) { return [mu + k * sg, nf(mu + k * sg, 1)]; });
          el.querySelector('[data-g]').innerHTML = normC({ m: mu, s: sg, sh: shs, shc: band ? PAL[0] : PAL[3], xt: xt, h: 250, d: -2, extra: function (xs, ys) { return band ? '' : (mod !== 'sag' ? '<line x1="' + xs(lo) + '" x2="' + xs(lo) + '" y1="' + ys(0) + '" y2="16" stroke="#C8553D" stroke-width="2"/><text class="lbb" x="' + xs(lo) + '" y="14" text-anchor="middle" style="fill:#C8553D">a</text>' : '') + (mod !== 'sol' ? '<line x1="' + xs(hi) + '" x2="' + xs(hi) + '" y1="' + ys(0) + '" y2="16" stroke="#C8553D" stroke-width="2"/><text class="lbb" x="' + xs(hi) + '" y="14" text-anchor="middle" style="fill:#C8553D">b</text>' : ''); } });
          el.querySelector('[data-mo]').textContent = nf(mu, 1); el.querySelector('[data-so]').textContent = nf(sg, 1); el.querySelector('[data-ao]').textContent = nf(lo, 2); el.querySelector('[data-bo]').textContent = nf(hi, 2);
          el.querySelector('[data-o]').innerHTML = '<div><small>z(a)</small><b>' + nf(za, 2) + '</b></div><div><small>z(b)</small><b>' + nf(zb, 2) + '</b></div><div><small>olasılık</small><b>' + nf(P, 4, false) + '</b></div>';
          el.querySelector('[data-n]').innerHTML = band ? 'Bantlar: μ ± σ → %68,3 · μ ± 2σ → %95,4 · μ ± 3σ → %99,7. Sınırlar: ' + nf(mu - sg, 1) + '–' + nf(mu + sg, 1) + ', ' + nf(mu - 2 * sg, 1) + '–' + nf(mu + 2 * sg, 1) + ', ' + nf(mu - 3 * sg, 1) + '–' + nf(mu + 3 * sg, 1) + '.' : steps + ' = <b>' + nf(P, 4) + '</b> (z tablosu iki ondalığa yuvarlanmış z ile okunur).';
        };
        el.querySelector('[data-m]').oninput = function () { var dm = +this.value - mu; mu = +this.value; a += dm; b += dm; rng(); draw(); };
        el.querySelector('[data-s]').oninput = function () { var k = +this.value / sg; a = mu + (a - mu) * k; b = mu + (b - mu) * k; sg = +this.value; rng(); draw(); };
        el.querySelector('[data-a]').oninput = function () { a = +this.value; draw(); };
        el.querySelector('[data-b]').oninput = function () { b = +this.value; draw(); };
        el.querySelector('[data-bd]').onclick = function () { band = !band; this.setAttribute('aria-pressed', String(band)); draw(); };
        [].forEach.call(el.querySelectorAll('[data-md] [data-k]'), function (x) { x.onclick = function () { mod = x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-md] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); band = false; el.querySelector('[data-bd]').setAttribute('aria-pressed', 'false'); draw(); }; });
        rng(); draw();
      }
    },
    sorular: function (r) {
      var out = [], tp = function (z) { var t = M.ztab(z); return z >= 0 ? 0.5 + t : 0.5 - t; };
      var z1 = r.int(10, 299) / 100, kind = r.int(0, 2), p1 = kind === 0 ? M.ztab(z1) : kind === 1 ? 0.5 - M.ztab(z1) : 0.5 + M.ztab(z1);
      var q1 = ['P(0 &lt; Z &lt; ' + nf(z1, 2, false) + ')', 'P(Z &gt; ' + nf(z1, 2, false) + ')', 'P(Z &lt; ' + nf(z1, 2, false) + ')'][kind];
      out.push({ tag: 'tablo okuma', q: '<p>Z standart normal değişken. Yandaki tabloyu kullanarak <b>' + q1 + '</b> olasılığını bulun. (dört ondalık)</p>', wide: true, g: ztab([z1], { hi: false }), say: p1, goster: nf(p1, 4), tol: 0.0006, ornek: '0,3944',
        ip: 'Tablo P(0 < Z < z) verir. Sağ kuyruk için 0,5’ten çıkar, sol taraf için 0,5 ekle.', cz: ['Satır ' + nf(Math.floor(z1 * 10) / 10, 1, false) + ', sütun ,0' + Math.round((z1 * 100) % 10) + ' → ' + nf(M.ztab(z1), 4, false) + '.', kind === 0 ? 'Cevap: <b>' + nf(p1, 4) + '</b>.' : kind === 1 ? '0,5 − ' + nf(M.ztab(z1), 4, false) + ' = <b>' + nf(p1, 4) + '</b>.' : '0,5 + ' + nf(M.ztab(z1), 4, false) + ' = <b>' + nf(p1, 4) + '</b>.'] });
      var mu = r.pick([50, 70, 120, 250, 500, 1000]), sg = r.pick([4, 5, 8, 10, 12, 20]), k = r.int(-200, 250) / 100, x2 = Math.round((mu + k * sg) * 10) / 10, z2 = Math.round((x2 - mu) / sg * 100) / 100, p2 = 1 - tp(z2);
      var cx2 = r.pick(['Bir fabrikada kahve paketlerinin ağırlığı (g)', 'Bir üniversitede final notları', 'Bir kargo firmasında teslim süresi (dakika)']);
      out.push({ tag: 'senaryo', q: '<p>' + cx2 + ' X ~ N(μ = ' + mu + ', σ = ' + sg + ').</p><p><b>P(X &gt; ' + nf(x2, 1) + ')</b> kaçtır? (dört ondalık)</p>', wide: true, g: ztab([z2]), say: p2, goster: nf(p2, 4), tol: 0.0011, ornek: '0,1056',
        yanlis: function (v) { return Math.abs(v - (1 - p2)) < 0.002 ? 'Bu P(X < ' + nf(x2, 1) + '); sağ tarafı soruyor.' : Math.abs(v - M.ztab(z2)) < 0.002 ? 'Bu yalnızca 0 ile z arası; kuyruğa çevirmelisin.' : 'z’yi hesapla, sonra tabloyu oku.'; },
        ip: 'z = (x − μ)/σ; sonra P(Z > z).', cz: ['z = (' + nf(x2, 1) + ' − ' + mu + ') / ' + sg + ' = <b>' + nf(z2, 2) + '</b>.', 'Tablo: P(0 < Z < ' + nf(Math.abs(z2), 2) + ') = ' + nf(M.ztab(z2), 4, false) + '.', z2 >= 0 ? 'P(Z > ' + nf(z2, 2) + ') = 0,5 − ' + nf(M.ztab(z2), 4, false) + ' = <b>' + nf(p2, 4) + '</b>.' : 'z negatif: P(Z > ' + nf(z2, 2) + ') = 0,5 + ' + nf(M.ztab(z2), 4, false) + ' = <b>' + nf(p2, 4) + '</b>.'] });
      var k1 = r.int(-250, 0) / 100, k2 = r.int(30, 250) / 100, x3a = Math.round((mu + k1 * sg) * 10) / 10, x3b = Math.round((mu + k2 * sg) * 10) / 10, za = Math.round((x3a - mu) / sg * 100) / 100, zb = Math.round((x3b - mu) / sg * 100) / 100, p3 = tp(zb) - tp(za);
      out.push({ tag: 'grafik', q: '<p>Aynı dağılımda (μ = ' + mu + ', σ = ' + sg + ') <b>P(' + nf(x3a, 1) + ' &lt; X &lt; ' + nf(x3b, 1) + ')</b> kaçtır? (dört ondalık)</p>' + normC({ m: mu, s: sg, sh: [x3a, x3b], xt: [[x3a, nf(x3a, 1)], [mu, String(mu)], [x3b, nf(x3b, 1)]], h: 150 }), wide: true, g: ztab([za, zb]), say: p3, goster: nf(p3, 4), tol: 0.0011, ornek: '0,7745',
        ip: 'Ortalamanın iki yanına düşüyorsa iki tablo değerini topla.', cz: ['z₁ = (' + nf(x3a, 1) + ' − ' + mu + ')/' + sg + ' = ' + nf(za, 2) + ', z₂ = ' + nf(zb, 2) + '.', 'Tablo: ' + nf(M.ztab(za), 4, false) + ' ve ' + nf(M.ztab(zb), 4, false) + '.', za <= 0 ? 'P = ' + nf(M.ztab(za), 4, false) + ' + ' + nf(M.ztab(zb), 4, false) + ' = <b>' + nf(p3, 4) + '</b>.' : 'P = <b>' + nf(p3, 4) + '</b>.'] });
      var top = r.pick([[5, 1.645], [10, 1.28], [2.5, 1.96], [1, 2.33]]), xr = mu + top[1] * sg;
      out.push({ tag: 'ters problem', q: '<p>X ~ N(' + mu + ', ' + sg + '²). Bir şirket <b>en yüksek %' + nf(top[0], 1) + '</b>’lik dilime ödül verecek.</p><p>Ödül için gereken en düşük değer kaçtır? (bir ondalık)</p>', wide: true, g: ztab([top[1]], { hi: false }), say: xr, goster: nf(xr, 2), tol: Math.max(0.06 * sg, 0.15), ornek: '516,5',
        ip: 'Sağ kuyrukta %' + nf(top[0], 1) + ' kalıyorsa 0 ile z arası alan 0,5 − ' + nf(top[0] / 100, 3) + ' = ' + nf(0.5 - top[0] / 100, 3) + '. Tabloda bu alana en yakın z’yi bul; x = μ + zσ.', cz: ['Aranan alan: 0,5 − ' + nf(top[0] / 100, 3) + ' = ' + nf(0.5 - top[0] / 100, 3) + '.', 'Tabloda en yakın z ≈ <b>' + nf(top[1], 3) + '</b>.', 'x = ' + mu + ' + ' + nf(top[1], 3) + ' × ' + sg + ' = <b>' + nf(xr, 2) + '</b>.'] });
      var kk = r.int(1, 3), lo4 = mu - kk * sg, hi4 = mu + kk * sg;
      out.push({ tag: 'ampirik kural', q: '<p>Bir bankada günlük işlem sayısı yaklaşık normal: μ = ' + mu + ', σ = ' + sg + '.</p><p>Günlerin yaklaşık yüzde kaçında işlem sayısı <b>' + lo4 + ' ile ' + hi4 + '</b> arasındadır?</p>', o: ['%68,3', '%95,4', '%99,7', '%50'], a: kk - 1, n: 'Aralık μ ± ' + kk + 'σ.', yn: { 3: '%50, ortalamanın bir yanıdır.' },
        ip: 'Sınırlar ortalamadan kaç σ uzakta?', cz: ['(' + hi4 + ' − ' + mu + ') / ' + sg + ' = ' + kk + ' → μ ± ' + kk + 'σ.', 'Ampirik kural: <b>' + ['%68,3', '%95,4', '%99,7'][kk - 1] + '</b>.'] });
      return out;
    }
  });
})();
