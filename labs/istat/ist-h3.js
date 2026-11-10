/* ==========================================================================
   ACADEX İSTATİSTİK · 9–12. haftalar (labs/istat/ist-h3.js), 11.11.2026
   9 Değişkenlik · 10 Rastgele değişken ve kesikli dağılım · 11 Binom ve Poisson
   12 Hipergeometrik (ve Poisson örnekleri)
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;
  var gauss = function (r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  var pmfBars = function (xs, ps, o) { o = o || {}; return V.bars({ x: xs.map(String), y: ps, h: o.h || 240, max: o.max, fmt: function (v) { return nf(v, o.dg || 3); }, hi: o.hi, renk: o.renk || PAL[7], xlab: o.xlab || 'x', ylab: o.ylab || 'P(X = x)', d: o.d, val: o.val, gap: o.gap, label: o.label || 'olasılık dağılımı' }); };
  var cumL = function (f, a, b) { var s = 0; for (var k = a; k <= b; k++) s += f(k); return s; };

  /* ======================= 9. HAFTA ======================= */
  var SET3 = [[3, 19, 20, 21, 22, 23], [3, 7, 11, 15, 19, 23], [3, 3, 4, 22, 23, 23]];
  var IQRD = [12, 15, 17, 18, 20, 21, 23, 24, 26, 30, 41];
  IST.hafta({
    id: 'g9', no: 9, renk: '#3E8E5B', tr: 'Değişkenlik ölçüleri', en: 'Variability Measures',
    sahneler: [
      {
        b: 'Ortalama yetmez: süt şişeleri', terim: [['değişkenlik', 'variability'], ['yayılım', 'spread / dispersion']],
        t: '<p>500 ml’lik süt dolumunda 200 şişenin ortalaması 500 ml çıktı. Hepsi doğru dolmuş mu?</p><p>100 şişe 470 ml, 100 şişe 530 ml olsa da ortalama 500’dür, ama <b>hiçbir şişe</b> 500 ml değildir! Kimi müşteri fazlasını, kimi eksiğini alır. Bu yüzden değerlerin merkezden ne kadar <b>yayıldığını</b> da ölçmeliyiz.</p>',
        v: function () {
          var r = IST.rng(5), a = [], b = []; for (var i = 0; i < 40; i++) { a.push(Math.round(500 + gauss(r) * 4)); b.push(i < 20 ? 470 : 530); }
          var e = []; for (var t = 460; t <= 540; t += 5) e.push(t);
          var hy = function (v) { return e.slice(0, -1).map(function (lo, i) { return v.filter(function (x) { return x >= lo && x < e[i + 1]; }).length; }); };
          return V.ust(V.hist({ edges: e, y: hy(a), h: 150, val: false, every: 2, renk: PAL[2], xlab: 'Hat A · ortalama 500 ml, dar', max: 25 }), V.hist({ edges: e, y: hy(b), h: 150, val: false, every: 2, renk: PAL[1], xlab: 'Hat B · ortalama 500 ml, geniş', max: 25, d: 0.8 }));
        }
      },
      {
        b: 'Açıklık ve aykırı değer', terim: [['açıklık', 'range'], ['aykırı değer', 'outlier']],
        t: '<p><b>Açıklık = en büyük − en küçük</b>. En kolay ölçüdür ama yalnızca iki uç değere bakar.</p><p>Üç veri setinin açıklığı da 23 − 3 = 20; ama yayılımları çok farklı. 1. sette tek bir <b>aykırı değer</b> (3) var; onu çıkarınca açıklık 4’e düşer. Gruplanmış veride açıklık: son sınıfın üst sınırı − ilk sınıfın alt sınırı (yaklaşık).</p>',
        v: function () {
          return SET3.map(function (s, i) { return V.dots({ v: s, min: 0, max: 25, h: 92, r: 8, step: 5, d: i * 0.5, renk: PAL[i], hi: i === 0 ? function (v) { return v === 3; } : null }).replace('</svg>', '<text class="lbb" x="24" y="14">' + (i + 1) + '. set · açıklık 20</text></svg>'); }).join('');
        }
      },
      {
        b: 'Varyans ve standart sapma', terim: [['varyans', 'variance s²'], ['standart sapma', 'standard deviation s'], ['kareler toplamı', 'sum of squares']],
        t: '<p>Sapmaların toplamı hep 0’dır, işe yaramaz. İşaretten kurtulmak için sapmaların <b>karesini</b> alırız.</p><p class="mono">s² = Σ(x − x̄)² / (n − 1) &nbsp; s = √s²</p><p>Örneklemde n − 1’e böleriz (anakütle varyansını yansız tahmin etmek için). 2, 4, 4, 7, 13 için: x̄ = 6, Σ(x − x̄)² = 74 → s² = 74 / 4 = <b>18,5</b>, s = <b>4,30</b>. Standart sapma verinin <b>kendi biriminde</b>dir.</p>',
        v: function () {
          var a = [2, 4, 4, 7, 13], m = 6, xs = V.sc(0, 15, 30, 520), s = '';
          s += '<line x1="30" x2="520" y1="230" y2="230" stroke="#0D1838" stroke-width="2"/>';
          for (var t = 0; t <= 15; t += 3) s += '<text class="lbm" x="' + xs(t) + '" y="248" text-anchor="middle">' + t + '</text>';
          s += '<line x1="' + xs(m) + '" x2="' + xs(m) + '" y1="20" y2="230" stroke="#C8553D" stroke-width="2.5" stroke-dasharray="5 4"/><text class="lbb" x="' + xs(m) + '" y="16" text-anchor="middle" style="fill:#C8553D">x̄ = 6</text>';
          a.forEach(function (v, i) {
            var dv = v - m, w = Math.abs(xs(v) - xs(m)), y = 222 - i * 4, x0 = Math.min(xs(v), xs(m));
            s += '<rect class="pop" ' + d(0.3 + i * 0.3) + ' x="' + x0 + '" y="' + (y - w) + '" width="' + w + '" height="' + w + '" fill="' + PAL[i] + '" fill-opacity=".28" stroke="' + PAL[i] + '" stroke-width="2"/>';
            s += '<circle class="dp" ' + d(i * 0.1) + ' cx="' + xs(v) + '" cy="230" r="7" fill="' + PAL[i] + '" stroke="#0D1838"/>';
            if (w > 20) s += '<text class="lbm fd" ' + d(0.5 + i * 0.3) + ' x="' + (x0 + w / 2) + '" y="' + (y - w / 2 + 4) + '" text-anchor="middle">' + dv * dv + '</text>';
          });
          return V.svg(540, 256, s, 'sapma kareleri') + V.fx([{ s: 'kareler toplamı', h: '16 + 4 + 4 + 1 + 49 = 74' }, { s: 'örneklem varyansı ve standart sapma', h: 's² = 74 / (5 − 1) = <b>18,5</b> · s = √18,5 = <b>4,30</b>', son: true }], 1.8);
        }
      },
      {
        b: 'Standart sapmayı yorumlamak', terim: [['x̄ ± s bandı', 'mean ± one standard deviation']],
        t: '<p>İki şehirde günlük yeni kayıt sayısı. Ortalamalar yakın, ama B’nin standart sapması A’nınkinin iki katından fazla.</p><p>Dikkat: B’deki yüksek s’nin asıl nedeni iki <b>aykırı değer</b> (18 ve 19). Böyle durumda verinin kaynağına dönüp bu değerlerin neden bu kadar uzak olduğunu araştırmak gerekir.</p>',
        v: function () {
          var A = [6, 7, 7, 8, 8, 8, 9, 9, 10, 8], B = [3, 4, 5, 6, 6, 7, 7, 5, 18, 19];
          var band = function (v, c) { var m = M.mean(v), s = M.sdS(v), xs = V.sc(0, 20, 24, 516); return '<rect class="gx" ' + d(0.8) + ' x="' + xs(m - s) + '" y="8" width="' + (xs(m + s) - xs(m - s)) + '" height="92" fill="' + c + '" fill-opacity=".14" stroke="' + c + '" stroke-dasharray="4 4"/><text class="lbb" x="' + (xs(m + s) + 6) + '" y="22" style="fill:' + c + '">x̄ = ' + nf(m, 1) + ', s = ' + nf(s, 2) + '</text>'; };
          return V.dots({ v: A, min: 0, max: 20, h: 140, step: 2, renk: PAL[0] }).replace('</svg>', band(A, PAL[0]) + '<text class="lbb" x="24" y="40">A</text></svg>') +
            V.dots({ v: B, min: 0, max: 20, h: 140, step: 2, renk: PAL[1], d: 0.4, hi: function (v) { return v >= 18; } }).replace('</svg>', band(B, PAL[1]) + '<text class="lbb" x="24" y="40">B</text></svg>');
        }
      },
      {
        b: 'Yüzdelikler ve çeyrekler arası açıklık', terim: [['yüzdelik', 'percentile'], ['çeyrek', 'quartile Q1, Q3'], ['çeyrekler arası açıklık', 'interquartile range IQR']],
        t: '<p>p. yüzdelik, verinin yaklaşık %p’sinin altında kaldığı değerdir. Sıralı veride konum: <b>L = p(n + 1)</b>.</p><p>n = 11 için Q1 = 25. yüzdelik → konum 0,25·12 = 3 → <b>17</b>; Q3 → konum 9 → <b>26</b>.</p><p><b>IQR = Q3 − Q1 = 9</b>: verinin ortadaki yarısının yayılımı. Aykırı değerden (41) etkilenmez.</p>',
        v: function () {
          var s = '';
          IQRD.forEach(function (v, i) { var q = i === 2 || i === 8, me = i === 5; s += '<g class="dp" ' + d(i * 0.08) + '><rect x="' + (10 + i * 48) + '" y="' + (q || me ? 40 : 56) + '" width="42" height="42" rx="8" fill="' + (q ? PAL[3] : me ? PAL[2] : '#fff') + '" stroke="#0D1838" stroke-width="2"/><text x="' + (31 + i * 48) + '" y="' + (q || me ? 67 : 83) + '" text-anchor="middle" font-weight="800" fill="' + (q || me ? '#fff' : '#0D1838') + '">' + v + '</text></g><text class="lbm" x="' + (31 + i * 48) + '" y="118" text-anchor="middle">' + (i + 1) + '</text>'; });
          s += '<g class="an" ' + d(1.1) + '><text class="lbb" x="127" y="28" text-anchor="middle">Q1 (3.)</text><text class="lbb" x="271" y="28" text-anchor="middle">medyan (6.)</text><text class="lbb" x="415" y="28" text-anchor="middle">Q3 (9.)</text></g>';
          return V.svg(540, 128, s, 'sıralı veri ve çeyrekler') + V.box({ v: IQRD, min: 10, max: 45, h: 140, d: 1.4, step: 5 }) + V.fx([{ s: 'çeyrekler arası açıklık', h: 'IQR = 26 − 17 = <b>9</b>', son: true }], 2.2);
        }
      },
      {
        b: 'Kutu grafiği ve çarpıklık', terim: [['kutu grafiği', 'box plot'], ['sağa çarpık', 'right / positively skewed'], ['sola çarpık', 'left / negatively skewed'], ['simetrik', 'symmetric']],
        t: '<p>Kutu Q1’den Q3’e uzanır; içindeki çizgi medyandır; bıyıklar uç değerlere gider.</p><ul><li>Medyan kutunun ortasında, bıyıklar eşit → <b>simetrik</b>.</li><li>Medyan Q1’e yakın, sağ bıyık uzun → <b>sağa çarpık</b> (pozitif).</li><li>Medyan Q3’e yakın, sol bıyık uzun → <b>sola çarpık</b> (negatif).</li></ul>',
        v: function () {
          return [['simetrik', [10, 30, 40, 50, 70], PAL[2]], ['sağa çarpık', [12, 22, 27, 40, 88], PAL[1]], ['sola çarpık', [12, 60, 73, 78, 88], PAL[0]]].map(function (b, i) {
            return V.box({ q: b[1], min: 0, max: 100, h: i === 2 ? 110 : 82, y: 40, d: i * 0.5, noaxis: i < 2, lab: false, renk: b[2] + '44', step: 20 }).replace('</svg>', '<text class="lbb" x="24" y="14">' + b[0] + '</text></svg>');
          }).join('');
        }
      }
    ],
    gorsel: {
      b: 'Dolum hattı kalite paneli', t: 'İki dolum hattının standart sapmasını sürgülerle ayarla. Her hat 200 şişe doldurur; tolerans 490–510 ml. Histogram, kutu grafikleri ve tolerans dışı şişe yüzdesi canlı değişir.',
      kur: function (el) {
        var sa = 4, sb = 15, ma = 500, mb = 500;
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>Hat A standart sapması <output data-ao></output></span><input type="range" min="1" max="25" step="0.5" value="4" data-a></label><label><span>Hat B standart sapması <output data-bo></output></span><input type="range" min="1" max="25" step="0.5" value="15" data-b></label><label><span>Hat B ortalaması <output data-mo></output></span><input type="range" min="485" max="515" step="1" value="500" data-m></label></div><div class="at-v"><div data-h></div><div data-bx></div><div class="at-out" data-o></div><div class="at-not" data-n></div></div></div>';
        var gen = function (m, s, seed) { var r = IST.rng(seed), v = []; for (var i = 0; i < 200; i++) v.push(m + gauss(r) * s); return v; };
        var draw = function () {
          var A = gen(ma, sa, 11), B = gen(mb, sb, 29), e = []; for (var t = 440; t <= 560; t += 5) e.push(t);
          var hy = function (v) { return e.slice(0, -1).map(function (lo, i) { return v.filter(function (x) { return x >= lo && x < e[i + 1]; }).length; }); };
          var ha = hy(A), hb = hy(B), mx = V.nice(Math.max.apply(null, ha.concat(hb)) * 1.05), xs = V.sc(440, 560, 46, 506), ys = V.sc(0, mx, 196, 18), s = V.axes({}, 46, 506, 196, 18, mx, function (v) { return nf(v, 0); }, 4);
          s += '<rect x="' + xs(490) + '" y="18" width="' + (xs(510) - xs(490)) + '" height="178" fill="#E3F4EA"/>';
          [[hb, PAL[1]], [ha, PAL[2]]].forEach(function (h) { h[0].forEach(function (v, i) { s += '<rect x="' + xs(e[i]) + '" y="' + ys(v) + '" width="' + (xs(e[i + 1]) - xs(e[i])) + '" height="' + (196 - ys(v)) + '" fill="' + h[1] + '" fill-opacity=".55" stroke="' + h[1] + '"/>'; }); });
          for (t = 440; t <= 560; t += 20) s += '<text class="lbm" x="' + xs(t) + '" y="212" text-anchor="middle">' + t + '</text>';
          s += '<text class="lbl" x="' + xs(500) + '" y="32" text-anchor="middle">tolerans 490–510</text>';
          el.querySelector('[data-h]').innerHTML = V.svg(520, 222, s, 'iki hattın dolum histogramı');
          el.querySelector('[data-bx]').innerHTML = V.box({ v: A, min: 440, max: 560, h: 80, y: 34, noaxis: true, lab: false, renk: PAL[2] + '55' }).replace('</svg>', '<text class="lbb" x="2" y="14">A</text></svg>') + V.box({ v: B, min: 440, max: 560, h: 110, y: 34, lab: false, renk: PAL[1] + '55', step: 20 }).replace('</svg>', '<text class="lbb" x="2" y="14">B</text></svg>');
          var st = function (v) { var s2 = M.sort(v); return { r: s2[s2.length - 1] - s2[0], s: M.sdS(v), iqr: M.pct(v, 0.75) - M.pct(v, 0.25), out: v.filter(function (x) { return x < 490 || x > 510; }).length / v.length * 100, m: M.mean(v) }; };
          var a = st(A), b = st(B);
          el.querySelector('[data-o]').innerHTML = [['ortalama', a.m, b.m, 1], ['açıklık', a.r, b.r, 1], ['standart sapma', a.s, b.s, 2], ['IQR', a.iqr, b.iqr, 1], ['tolerans dışı %', a.out, b.out, 1]].map(function (x) { return '<div><small>' + x[0] + '</small><b style="color:' + PAL[2] + '">A ' + nf(x[1], x[3]) + '</b><br><b style="color:' + PAL[1] + '">B ' + nf(x[2], x[3]) + '</b></div>'; }).join('');
          el.querySelector('[data-n]').innerHTML = 'Ortalamalar ' + (Math.abs(a.m - b.m) < 2 ? 'neredeyse aynı' : 'farklı') + ', ama B hattındaki şişelerin <b>%' + nf(b.out, 1) + '</b>’i toleransın dışında (A’da %' + nf(a.out, 1) + '). Yönetici yalnızca ortalamaya bakarsa bu sorunu göremez; <b>değişkenliği izlemek</b> gerekir.';
          el.querySelector('[data-ao]').textContent = nf(sa, 1) + ' ml'; el.querySelector('[data-bo]').textContent = nf(sb, 1) + ' ml'; el.querySelector('[data-mo]').textContent = mb + ' ml';
        };
        el.querySelector('[data-a]').oninput = function () { sa = +this.value; draw(); };
        el.querySelector('[data-b]').oninput = function () { sb = +this.value; draw(); };
        el.querySelector('[data-m]').oninput = function () { mb = +this.value; draw(); };
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var rv = []; for (var i = 0; i < 9; i++) rv.push(r.int(30, 95)); var rng = Math.max.apply(null, rv) - Math.min.apply(null, rv);
      out.push({ vizOnly: true, viz: function (ka) { return IST.S.siralar(rv, [1, 9], ka + 1, { not: 'en büyük − en küçük = ' + rng }); }, tag: 'hesap', q: '<p>Bir otelde 9 gecelik doluluk oranları (%):</p><p class="mono" style="font-size:16px">' + rv.join(', ') + '</p><p>Açıklık kaçtır?</p>', say: rng, goster: String(rng), tol: 0.01, ornek: '20',
        ip: 'Açıklık = en büyük − en küçük.', cz: ['En büyük: ' + Math.max.apply(null, rv) + ', en küçük: ' + Math.min.apply(null, rv) + '.', 'Açıklık = <b>' + rng + '</b>.'] });
      var vv; do { vv = []; for (i = 0; i < 5; i++) vv.push(r.int(2, 20)); } while (M.sum(vv) % 5);
      var mm = M.mean(vv), ss = M.sum(vv.map(function (x) { return (x - mm) * (x - mm); })), s2 = ss / 4;
      out.push({ tag: 'hesap', q: '<p>Bir kafede 5 günlük iptal edilen sipariş sayıları: <b class="mono">' + vv.join(', ') + '</b>.</p><p><b>Örneklem varyansı</b> s² kaçtır? (iki ondalık)</p>', say: s2, goster: nf(s2, 2), tol: 0.011, ornek: '18,5',
        yanlis: function (v) { return Math.abs(v - ss / 5) < 0.02 ? 'n’ye böldün; örneklem varyansında payda n − 1 = 4 olmalı.' : Math.abs(v - Math.sqrt(s2)) < 0.02 ? 'Bu standart sapma; soru varyansı soruyor.' : 'Önce x̄, sonra sapmaların kareleri.'; },
        ip: 'x̄’yi bul; her sapmanın karesini al, topla, n − 1’e böl.', cz: ['x̄ = ' + M.sum(vv) + ' / 5 = ' + nf(mm, 0) + '.', 'Sapmalar: ' + vv.map(function (x) { return nf(x - mm, 0); }).join(', ') + ' → kareler: ' + vv.map(function (x) { return (x - mm) * (x - mm); }).join(', ') + '.', 'Σ = ' + ss + ' → s² = ' + ss + ' / 4 = <b>' + nf(s2, 2) + '</b>.'] });
      var sv = []; for (i = 0; i < 6; i++) sv.push(r.int(40, 80)); var sd = M.sdS(sv), sm = M.mean(sv);
      out.push({ tag: 'hesap', q: '<p>Bir kargo şubesinde 6 günlük teslimat süreleri (dakika): <b class="mono">' + sv.join(', ') + '</b>.</p><p><b>Örneklem standart sapması</b> s kaçtır? (iki ondalık)</p>', say: sd, goster: nf(sd, 2), tol: 0.011, ornek: '4,30',
        yanlis: function (v) { return Math.abs(v - Math.sqrt(M.sum(sv.map(function (x) { return (x - sm) * (x - sm); })) / 6)) < 0.02 ? 'n’ye böldün; n − 1 = 5 kullan.' : Math.abs(v - sd * sd) < 0.05 ? 'Bu varyans; karekökünü almayı unutma.' : 'Adımları kontrol et.'; },
        ip: 's = √[Σ(x − x̄)² / (n − 1)].', cz: ['x̄ = ' + M.sum(sv) + ' / 6 = ' + nf(sm, 4) + '.', 'Σ(x − x̄)² = ' + nf(M.sum(sv.map(function (x) { return (x - sm) * (x - sm); })), 4) + '.', 's² = … / 5 = ' + nf(sd * sd, 4) + ' → s = <b>' + nf(sd, 2) + '</b>.'] });
      var q = []; for (i = 0; i < 11; i++) q.push(r.int(10, 60)); var qs = M.sort(q), iqr = qs[8] - qs[2];
      out.push({ vizOnly: true, viz: function (ka) { return IST.S.siralar(q, [3, 9], ka, { not: 'Q1 = ' + qs[2] + ' · Q3 = ' + qs[8] }); }, tag: 'hesap', q: '<p>Bir mağazada 11 günün kasa fişi sayıları (sıralı değil): <b class="mono">' + q.join(', ') + '</b>.</p><p>L = p(n + 1) konum kuralıyla <b>IQR = Q3 − Q1</b> kaçtır?</p>', say: iqr, goster: String(iqr), tol: 0.01, ornek: '9',
        ip: 'n = 11: Q1 konumu 0,25·12 = 3, Q3 konumu 0,75·12 = 9.', cz: ['Sıralı: ' + qs.join(', ') + '.', 'Q1 = 3. değer = ' + qs[2] + ', Q3 = 9. değer = ' + qs[8] + '.', 'IQR = ' + qs[8] + ' − ' + qs[2] + ' = <b>' + iqr + '</b>.'] });
      var sk = r.int(0, 2), bq = [[15, 35, 50, 65, 85], [10, 22, 30, 48, 92], [8, 52, 70, 78, 90]][sk].map(function (x) { return x + r.int(-3, 3); }); bq.sort(function (a, b) { return a - b; });
      out.push({ tag: 'grafik okuma', q: '<p>Bir bankanın kredi başvurularında onay süresinin (saat) kutu grafiği yanda.</p><p>Dağılımın şekli hakkında ne söylenebilir?</p>', g: V.box({ q: bq, min: 0, max: 100, h: 140, step: 20 }), o: ['Yaklaşık simetrik', 'Sağa (pozitif) çarpık', 'Sola (negatif) çarpık'], a: sk,
        n: ['Medyan kutunun ortasında, bıyıklar benzer uzunlukta.', 'Medyan Q1’e yakın ve sağ bıyık uzun.', 'Medyan Q3’e yakın ve sol bıyık uzun.'][sk], ip: 'Medyan çizgisi kutunun hangi ucuna yakın? Hangi bıyık daha uzun?', cz: ['Q1 = ' + bq[1] + ', medyan = ' + bq[2] + ', Q3 = ' + bq[3] + '.', 'Medyan − Q1 = ' + (bq[2] - bq[1]) + ', Q3 − medyan = ' + (bq[3] - bq[2]) + '.', 'Cevap: <b>' + ['simetrik', 'sağa çarpık', 'sola çarpık'][sk] + '</b>.'] });
      return out;
    }
  });

  /* ======================= 10. HAFTA ======================= */
  IST.hafta({
    id: 'g10', no: 10, renk: '#8A6D3B', tr: 'Rastgele değişken ve kesikli olasılık dağılımı', en: 'Probability Distributions and Discrete PD',
    sahneler: [
      {
        b: 'Rastgele değişken nedir?', terim: [['rastgele değişken', 'random variable X'], ['değer', 'value x']],
        t: '<p><b>Rastgele değişken</b>, rastgele bir deneyin her sonucuna bir <b>sayı</b> atayan kuraldır. Büyük harfle (X) gösterilir; aldığı değerler küçük harfle (x).</p><p>Üç para atalım; X = “yazı (T) sayısı”. TTH sonucu X = 2’ye, HHH sonucu X = 0’a gider.</p>',
        v: function () {
          var S = ['TTT', 'TTH', 'THT', 'HTT', 'THH', 'HTH', 'HHT', 'HHH'], s = '';
          S.forEach(function (o, i) { var x = (o.match(/T/g) || []).length, y = 20 + i * 30; s += '<g class="an" ' + d(i * 0.1) + '><rect x="20" y="' + y + '" width="86" height="24" rx="6" fill="#fff" stroke="#0D1838" stroke-width="1.5"/><text class="lbm" x="63" y="' + (y + 17) + '" text-anchor="middle" font-weight="600">' + o + '</text></g><path class="dr" style="--len:300;--d:' + (0.9 + i * 0.1) + 's" d="M106 ' + (y + 12) + 'C 240 ' + (y + 12) + ', 260 ' + (52 + (3 - x) * 56) + ', 380 ' + (52 + (3 - x) * 56) + '" fill="none" stroke="' + PAL[x] + '" stroke-width="2"/>'; });
          [3, 2, 1, 0].forEach(function (x, k) { s += '<g class="pop" ' + d(0.6 + k * 0.1) + '><circle cx="400" cy="' + (52 + k * 56) + '" r="20" fill="' + PAL[x] + '" stroke="#0D1838" stroke-width="2"/><text x="400" y="' + (58 + k * 56) + '" text-anchor="middle" fill="#fff" font-weight="800" font-size="16">' + x + '</text></g>'; });
          s += '<text class="lbb" x="63" y="14" text-anchor="middle">sonuç</text><text class="lbb" x="400" y="16" text-anchor="middle">X = yazı sayısı</text>';
          return V.svg(540, 270, s, 'üç para: sonuçtan X değerine');
        }
      },
      {
        b: 'Kesikli ve sürekli rastgele değişken', terim: [['kesikli', 'discrete'], ['sürekli', 'continuous']],
        t: '<p><b>Kesikli</b> rastgele değişken sayılabilir değerler alır: bir saatte gelen müşteri sayısı, 4 atıştaki isabet, kusurlu ürün sayısı.</p><p><b>Sürekli</b> rastgele değişken bir aralıktaki tüm değerleri alabilir: bekleme süresi, ağırlık, sıcaklık. Bu hafta kesiklileri, 13. haftada sürekli olanları işliyoruz.</p>',
        v: function () { return V.kart([{ ic: '🧾', b: 'Kesikli', en: 'discrete', p: 'Günlük iade sayısı: 0, 1, 2, …' }, { ic: '📞', b: 'Kesikli', en: 'discrete', p: 'Bir saatteki çağrı sayısı' }, { ic: '⏱️', b: 'Sürekli', en: 'continuous', p: 'Bir çağrının süresi: 3,72 dk' }, { ic: '⚖️', b: 'Sürekli', en: 'continuous', p: 'Paketin ağırlığı: 1,248 kg' }]); }
      },
      {
        b: 'Olasılık fonksiyonunun iki koşulu', terim: [['olasılık fonksiyonu', 'probability mass function'], ['olasılık dağılımı', 'probability distribution']],
        t: '<p>Kesikli X’in olasılık dağılımı her x değerine P(X = x) atar. İki koşul sağlanmalı:</p><ul><li><b>0 ≤ P(X = x) ≤ 1</b> her x için</li><li><b>Σ P(X = x) = 1</b></li></ul><p>Hilesiz zar: her yüz 1/6; 6 × 1/6 = 1 ✓.</p>',
        v: function () { return pmfBars([1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1].map(function () { return 1 / 6; }), { max: 0.25, label: 'zarın olasılık dağılımı', xlab: 'x = zarın üst yüzü' }) + V.fx([{ s: 'toplam', h: '6 × 1/6 = <b>1</b> ✓', son: true }], 1); }
      },
      {
        b: 'Bu bir olasılık fonksiyonu mu? P(X = x) = x / 9', terim: [['geçerlilik', 'validity']],
        t: '<p>x = 2, 3, 4 için P(X = x) = x/9 veriliyor.</p><p>Değerler 2/9, 3/9, 4/9 → hepsi 0 ile 1 arasında ✓. Toplam: (2 + 3 + 4) / 9 = 9/9 = <b>1</b> ✓. Demek ki geçerli bir olasılık fonksiyonudur.</p>',
        v: function () { return pmfBars([2, 3, 4], [2 / 9, 3 / 9, 4 / 9], { max: 0.5, label: 'P(X=x)=x/9' }) + V.fx([{ s: 'koşul 1', h: '0 ≤ 2/9, 3/9, 4/9 ≤ 1 ✓' }, { s: 'koşul 2', h: '2/9 + 3/9 + 4/9 = <b>1</b> ✓', son: true }], 0.9); }
      },
      {
        b: 'Üç paranın dağılımı', terim: [['olasılık tablosu', 'probability table']],
        t: '<p>8 eşit olasılıklı sonuçtan: X = 0 yalnızca HHH (1/8), X = 1 üç sonuç (3/8), X = 2 üç sonuç (3/8), X = 3 yalnızca TTT (1/8).</p><p>Dağılım simetriktir; toplam 8/8 = 1.</p>',
        v: function () { return V.ust(V.tablo(['x', '0', '1', '2', '3'], [['P(X = x)', '1/8', '3/8', '3/8', '1/8']], { st: 0 }), pmfBars([0, 1, 2, 3], [1 / 8, 3 / 8, 3 / 8, 1 / 8], { max: 0.5, d: 0.4, xlab: 'x = yazı sayısı' })); }
      },
      {
        b: 'Beklenen değer ve varyans', terim: [['beklenen değer', 'expected value E(X) = μ'], ['varyans', 'variance Var(X) = σ²']],
        t: '<p><b>E(X) = μ = Σ x·P(x)</b>: deney çok kez tekrarlansaydı X’in ortalaması.</p><p><b>Var(X) = σ² = Σ (x − μ)²·P(x)</b> ve σ = √σ².</p><p>Üç para: μ = 0·⅛ + 1·⅜ + 2·⅜ + 3·⅛ = <b>1,5</b>; σ² = 2,25·⅛ + 0,25·⅜ + 0,25·⅜ + 2,25·⅛ = <b>0,75</b>, σ ≈ 0,866.</p>',
        v: function () {
          return V.tablo(['x', 'P(x)', 'x·P(x)', '(x − μ)²·P(x)'], [['0', '0,125', '0', '0,28125'], ['1', '0,375', '0,375', '0,09375'], ['2', '0,375', '0,75', '0,09375'], ['3', '0,125', '0,375', '0,28125'], ['<b>Σ</b>', '<b>1</b>', '<b>1,5</b>', '<b>0,75</b>']], { n: [0, 1, 2, 3], st: 0.18, rowc: { 4: 'ht' } }) +
            V.fx([{ s: 'beklenen değer', h: 'μ = <b>1,5</b> yazı' }, { s: 'varyans ve standart sapma', h: 'σ² = <b>0,75</b> · σ = √0,75 = <b>0,866</b>', son: true }], 1.1);
        }
      }
    ],
    gorsel: {
      b: 'Dağılım kurucu', t: 'X = 0…4 için olasılıkları sürgülerle ayarla. Geçerli bir olasılık fonksiyonu olması için toplamın tam 1 olması gerekir. E(X) ve Var(X) canlı hesaplanır; ortalama grafikte işaretlenir.',
      kur: function (el) {
        var p = [0.1, 0.2, 0.4, 0.2, 0.1];
        el.innerHTML = '<div class="at-g"><div class="at-k">' + p.map(function (v, i) { return '<label><span>P(X = ' + i + ') <output data-o' + i + '></output></span><input type="range" min="0" max="1" step="0.01" value="' + v + '" data-p="' + i + '"></label>'; }).join('') + '<div class="row"><button type="button" class="btn sm" data-n>toplamı 1’e ölçekle</button><button type="button" class="btn sm ghost" data-c>3 para örneği (0–3)</button></div></div><div class="at-v"><div data-g></div><div class="at-out"><div><small>Σ P</small><b data-s></b></div><div><small>E(X) = μ</small><b data-m></b></div><div><small>Var(X)</small><b data-v></b></div><div><small>σ</small><b data-sd></b></div></div><div class="at-not" data-t></div></div></div>';
        var draw = function () {
          var S = M.sum(p), ok = Math.abs(S - 1) < 0.005, mu = M.sum(p.map(function (v, i) { return i * v; })) / (S || 1), va = M.sum(p.map(function (v, i) { return (i - mu) * (i - mu) * v; })) / (S || 1);
          p.forEach(function (v, i) { el.querySelector('[data-o' + i + ']').textContent = nf(v, 2); });
          el.querySelector('[data-g]').innerHTML = pmfBars([0, 1, 2, 3, 4], p, { max: 1, dg: 2, renk: ok ? PAL[7] : PAL[1], d: -1 }).replace('</svg>', ok ? '<line x1="' + (46 + (mu + 0.5) * 92.4).toFixed(1) + '" x2="' + (46 + (mu + 0.5) * 92.4).toFixed(1) + '" y1="14" y2="196" stroke="#E0A526" stroke-width="3"/><text class="lbb" x="' + (46 + (mu + 0.5) * 92.4).toFixed(1) + '" y="12" text-anchor="middle">μ = ' + nf(mu, 2) + '</text></svg>' : '</svg>');
          el.querySelector('[data-s]').textContent = nf(S, 2); el.querySelector('[data-s]').style.color = ok ? 'var(--ok)' : 'var(--bad)';
          el.querySelector('[data-m]').textContent = ok ? nf(mu, 3) : '–'; el.querySelector('[data-v]').textContent = ok ? nf(va, 3) : '–'; el.querySelector('[data-sd]').textContent = ok ? nf(Math.sqrt(va), 3) : '–';
          el.querySelector('[data-t]').innerHTML = ok ? '✅ Geçerli olasılık fonksiyonu. μ = Σx·P(x) = ' + p.map(function (v, i) { return i + '·' + nf(v, 2); }).join(' + ') + ' = <b>' + nf(mu, 3) + '</b>.' : '❌ Toplam ' + nf(S, 2) + ' — bir olasılık fonksiyonunda olasılıkların toplamı <b>1</b> olmalı. “Toplamı 1’e ölçekle”yi dene.';
        };
        [].forEach.call(el.querySelectorAll('[data-p]'), function (s) { s.oninput = function () { p[+s.getAttribute('data-p')] = +s.value; draw(); }; });
        var setAll = function () { [].forEach.call(el.querySelectorAll('[data-p]'), function (s) { s.value = p[+s.getAttribute('data-p')]; }); draw(); };
        el.querySelector('[data-n]').onclick = function () { var S = M.sum(p); if (S > 0) { p = p.map(function (v) { return Math.round(v / S * 100) / 100; }); var fix = 1 - M.sum(p); p[p.indexOf(Math.max.apply(null, p))] = Math.round((p[p.indexOf(Math.max.apply(null, p))] + fix) * 100) / 100; } setAll(); };
        el.querySelector('[data-c]').onclick = function () { p = [0.125, 0.375, 0.375, 0.125, 0]; setAll(); };
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var mk = function () { var a = [r.int(1, 6), r.int(1, 6), r.int(1, 6), r.int(1, 6)], s = M.sum(a); var p = a.map(function (x) { return Math.round(x / s * 20) / 20; }); p[3] = Math.round((1 - p[0] - p[1] - p[2]) * 100) / 100; if (p[3] <= 0) return mk(); return p; };
      var p = mk(), xs = [0, 1, 2, 3].map(function (i) { return i + r.int(0, 1) * 0; }), miss = r.int(0, 3);
      var tb = V.tablo(['x'].concat(xs.map(String)), [['P(X = x)'].concat(p.map(function (v, i) { return i === miss ? '<b>k</b>' : nf(v, 2); }))], { st: 0 });
      out.push({ tag: 'tablo', q: '<p>Bir bayide günlük satılan elektrikli bisiklet sayısı X’in dağılımı yanda. Bir değer silinmiş.</p><p><b>k</b> kaç olmalıdır?</p>', g: tb, say: p[miss], goster: nf(p[miss], 2), tol: 0.0051, ornek: '0,25',
        ip: 'Tüm olasılıkların toplamı 1 olmalı.', cz: ['Bilinenlerin toplamı: ' + p.filter(function (_, i) { return i !== miss; }).map(function (v) { return nf(v, 2); }).join(' + ') + ' = ' + nf(1 - p[miss], 2) + '.', 'k = 1 − ' + nf(1 - p[miss], 2) + ' = <b>' + nf(p[miss], 2) + '</b>.'] });
      var q = mk(), mu = M.sum(q.map(function (v, i) { return i * v; }));
      var t2 = V.tablo(['x', '0', '1', '2', '3'], [['P(X = x)'].concat(q.map(function (v) { return nf(v, 2); }))], { st: 0 });
      out.push({ tag: 'tablo', q: '<p>Bir sigorta şirketinde bir poliçe sahibinin bir yılda bildirdiği hasar sayısı X’in dağılımı yanda.</p><p><b>E(X)</b> kaçtır? (iki ondalık)</p>', g: t2, say: mu, goster: nf(mu, 2), tol: 0.0051, ornek: '1,5',
        ip: 'E(X) = Σ x·P(x).', cz: [q.map(function (v, i) { return i + '·' + nf(v, 2); }).join(' + ') + '.', '= ' + q.map(function (v, i) { return nf(i * v, 2); }).join(' + ') + ' = <b>' + nf(mu, 2) + '</b>.'] });
      var va = M.sum(q.map(function (v, i) { return (i - mu) * (i - mu) * v; }));
      out.push({ tag: 'tablo', q: '<p>Aynı dağılım için <b>Var(X)</b> kaçtır? (dört ondalık)</p><p>İpucu yerine kısa yol: Var(X) = E(X²) − μ².</p>', g: t2, say: va, goster: nf(va, 4), tol: 0.0011, ornek: '0,75',
        ip: 'E(X²) = Σ x²·P(x); Var(X) = E(X²) − [E(X)]².', cz: ['μ = ' + nf(mu, 4) + '.', 'E(X²) = ' + q.map(function (v, i) { return (i * i) + '·' + nf(v, 2); }).join(' + ') + ' = ' + nf(M.sum(q.map(function (v, i) { return i * i * v; })), 4) + '.', 'Var(X) = ' + nf(M.sum(q.map(function (v, i) { return i * i * v; })), 4) + ' − ' + nf(mu, 4) + '² = <b>' + nf(va, 4) + '</b>.'] });
      var w = mk(), a = r.int(1, 2), pg = M.sum(w.slice(a));
      out.push({ tag: 'tablo', q: '<p>Bir kafede bir masadaki müşterinin sipariş ettiği tatlı sayısı X’in dağılımı yanda.</p><p><b>P(X ≥ ' + a + ')</b> kaçtır?</p>', g: V.tablo(['x', '0', '1', '2', '3'], [['P(X = x)'].concat(w.map(function (v) { return nf(v, 2); }))], { st: 0 }), say: pg, goster: nf(pg, 2), tol: 0.0051, ornek: '0,5',
        ip: '“En az ' + a + '” → x = ' + a + ', …, 3 olasılıklarını topla (ya da 1 − P(X < ' + a + ')).', cz: ['P(X ≥ ' + a + ') = ' + w.slice(a).map(function (v) { return nf(v, 2); }).join(' + ') + '.', '= <b>' + nf(pg, 2) + '</b>.'] });
      var good = mk().map(function (v) { return nf(v, 2); }).join(' · '), b1 = mk(), b2 = mk();
      b1[1] = Math.round((b1[1] + 0.1) * 100) / 100; b2[0] = -0.1; b2[1] = Math.round((b2[1] + 0.1) * 100) / 100;
      out.push({ tag: 'kavram', q: '<p>Aşağıdaki tablolardan hangisi x = 0, 1, 2, 3 için <b>geçerli</b> bir olasılık fonksiyonudur?</p>', o: ['P: ' + good, 'P: ' + b1.map(function (v) { return nf(v, 2); }).join(' · '), 'P: ' + b2.map(function (v) { return nf(v, 2); }).join(' · ')], a: 0, n: 'Hepsi 0–1 arasında ve toplam 1.', yn: { 1: 'Toplamı 1 değil (' + nf(M.sum(b1), 2) + ').', 2: 'Negatif olasılık olamaz.' },
        ip: 'İki koşul: her değer 0–1 arasında ve toplam 1.', cz: ['Her seçenekte negatif değer var mı? Toplam 1 mi?', 'Yalnızca ilk seçenek iki koşulu da sağlıyor.'] });
      return out;
    }
  });

  /* ======================= 11. HAFTA ======================= */
  IST.hafta({
    id: 'g11', no: 11, renk: '#C8553D', tr: 'Binom ve Poisson dağılımları', en: 'Discrete PD 1: Binomial and Poisson',
    sahneler: [
      {
        b: 'Bernoulli denemesi', terim: [['Bernoulli denemesi', 'Bernoulli trial'], ['başarı / başarısızlık', 'success / failure'], ['binom deneyi', 'binomial experiment']],
        t: '<p>Bir <b>Bernoulli denemesinin</b> özellikleri:</p><ul><li>Yalnızca iki sonuç: başarı / başarısızlık (yazı-tura, 0-1).</li><li>Denemeler <b>bağımsız</b>.</li><li>Başarı olasılığı p, başarısızlık q = 1 − p her denemede <b>sabit</b>.</li></ul><p>n denemedeki başarı sayısı X’in dağılımı <b>binom dağılımıdır</b>.</p>',
        v: function () { var s = ''; for (var i = 0; i < 8; i++) { var ok = [1, 0, 1, 1, 0, 1, 0, 1][i]; s += '<g class="pop" ' + d(i * 0.15) + '><circle cx="' + (40 + i * 64) + '" cy="80" r="26" fill="' + (ok ? PAL[2] : '#fff') + '" stroke="#0D1838" stroke-width="2"/><text x="' + (40 + i * 64) + '" y="88" text-anchor="middle" font-size="20" font-weight="800" fill="' + (ok ? '#fff' : '#C8553D') + '">' + (ok ? '✓' : '✗') + '</text></g>'; } s += '<text class="lbb fd" ' + d(1.4) + ' x="270" y="150" text-anchor="middle">n = 8 bağımsız deneme, her birinde p sabit → X = 5 başarı</text>'; return V.svg(540, 170, s, 'Bernoulli denemeleri'); }
      },
      {
        b: 'Binom formülü', terim: [['binom dağılımı', 'binomial distribution X ~ B(n, p)']],
        t: '<p class="mono" style="font-size:15px">P(X = x) = C(n, x) · pˣ · qⁿ⁻ˣ</p><p>C(n, x): x başarının n denemeye kaç farklı şekilde dağılabileceği. Üç parada iki yazı: C(3, 2)·(½)²·(½)¹ = 3/8.</p><p>En az bir yazı: 1 − P(X = 0) = 1 − 1/8 = <b>7/8</b>. En az iki yazı: 3/8 + 1/8 = <b>1/2</b>.</p>',
        v: function () { return pmfBars([0, 1, 2, 3], [1, 3, 3, 1].map(function (v) { return v / 8; }), { max: 0.5, hi: [2, 3], xlab: 'yazı sayısı (n = 3, p = 0,5)' }) + V.fx([{ s: 'P(X = 2)', h: 'C(3,2)·0,5²·0,5 = 3 × 0,125 = <b>0,375</b>' }, { s: 'P(X ≥ 2)', h: '0,375 + 0,125 = <b>0,5</b>', son: true }], 1); }
      },
      {
        b: 'Basketbolcunun serbest atışları', terim: [['ortalama', 'μ = np'], ['standart sapma', 'σ = √(npq)']],
        t: '<p>Oyuncu serbest atışların %90’ını sokuyor. X = sonraki 4 atışta <b>kaçan</b> sayısı → p = 0,1, n = 4.</p><ul><li>P(X = 2) = C(4,2)·0,1²·0,9² = 6·0,01·0,81 = <b>0,0486</b></li><li>P(X ≥ 1) = 1 − 0,9⁴ = <b>0,3439</b></li><li>μ = np = <b>0,4</b>, σ = √(4·0,1·0,9) = <b>0,6</b></li></ul>',
        v: function () { var ps = [0, 1, 2, 3, 4].map(function (x) { return M.binom(x, 4, 0.1); }); return pmfBars([0, 1, 2, 3, 4], ps, { max: 0.8, dg: 4, hi: [2], xlab: 'kaçan atış sayısı (n = 4, p = 0,1)' }); }
      },
      {
        b: 'Poisson dağılımı', terim: [['Poisson dağılımı', 'Poisson distribution'], ['oran parametresi', 'rate λ (lambda)']],
        t: '<p>Belirli bir <b>aralıkta</b> (zaman, alan, uzunluk) olayların sayısı: bir saatte gelen çağrı, bir sayfadaki yazım hatası. Olaylar bağımsız, ortalama oran λ sabit.</p><p class="mono" style="font-size:15px">P(X = x) = e^(−λ) · λˣ / x!</p><p>Bankanın çağrı merkezine saatte ortalama 6 çağrı: P(X = 5) = e⁻⁶·6⁵/5! = <b>0,1606</b>. Poisson’da <b>μ = σ² = λ</b>.</p>',
        v: function () { var ps = []; for (var x = 0; x <= 14; x++) ps.push(M.pois(x, 6)); return pmfBars(ps.map(function (_, i) { return i; }), ps, { max: 0.2, dg: 3, hi: [5], val: false, xlab: 'bir saatteki çağrı sayısı (λ = 6)', gap: 0.15 }); }
      },
      {
        b: 'En çok, en az ve aralığı değiştirmek', terim: [['tümleyen', 'complement'], ['aralık ölçekleme', 'rescaling λ']],
        t: '<ul><li>En çok 3 çağrı: P(0) + P(1) + P(2) + P(3) = <b>0,1512</b></li><li>En az 4 çağrı: 1 − 0,1512 = <b>0,8488</b> (tümleyen daha kısa yol)</li><li>10 dakikada tam 2 çağrı: önce λ’yı aralığa uyarla: 6 × 10/60 = <b>1</b>; P(X = 2) = e⁻¹·1²/2! = <b>0,1839</b></li></ul>',
        v: function () {
          var ps = []; for (var x = 0; x <= 12; x++) ps.push(M.pois(x, 6));
          return pmfBars(ps.map(function (_, i) { return i; }), ps, { max: 0.2, hi: [0, 1, 2, 3], val: false, h: 190, xlab: 'λ = 6 · turuncu: X ≤ 3', gap: 0.15 }) + V.fx([{ s: 'tümleyen', h: 'P(X ≥ 4) = 1 − 0,1512 = <b>0,8488</b>' }, { s: '10 dakika: λ = 6 × 1/6 = 1', h: 'P(X = 2) = e⁻¹ / 2 = <b>0,1839</b>', son: true }], 1);
        }
      }
    ],
    gorsel: {
      b: 'Binom ve Poisson gezgini', t: 'Dağılımı seç, parametreleri değiştir. k sürgüsü ve işaret seçimiyle P(X = k), P(X ≤ k) ya da P(X ≥ k) alanını boyayıp olasılığı oku.',
      kur: function (el) {
        var tip = 'b', n = 10, p = 0.3, lam = 4, k = 3, op = 'le';
        el.innerHTML = '<div class="seg" data-t style="margin-bottom:12px"><button type="button" data-k="b" aria-pressed="true">Binom B(n, p)</button><button type="button" data-k="p" aria-pressed="false">Poisson (λ)</button></div><div class="at-g"><div class="at-k" data-k></div><div class="at-v"><div data-g></div><div class="at-out" data-o></div><div class="at-not" data-n></div></div></div>';
        var ctl = function () {
          el.querySelector('.at-k[data-k]').innerHTML = (tip === 'b' ? '<label><span>n (deneme) <output data-no></output></span><input type="range" min="1" max="30" value="' + n + '" data-n></label><label><span>p (başarı) <output data-po></output></span><input type="range" min="0.01" max="0.99" step="0.01" value="' + p + '" data-p></label>' : '<label><span>λ (ortalama) <output data-lo></output></span><input type="range" min="0.2" max="15" step="0.1" value="' + lam + '" data-l></label>') +
            '<label><span>k <output data-ko></output></span><input type="range" min="0" max="30" value="' + k + '" data-kk></label><div class="seg" data-op><button type="button" data-k="eq" aria-pressed="' + (op === 'eq') + '">P(X = k)</button><button type="button" data-k="le" aria-pressed="' + (op === 'le') + '">P(X ≤ k)</button><button type="button" data-k="ge" aria-pressed="' + (op === 'ge') + '">P(X ≥ k)</button></div>';
          var b = el.querySelector('.at-k[data-k]');
          if (tip === 'b') { b.querySelector('[data-n]').oninput = function () { n = +this.value; draw(); }; b.querySelector('[data-p]').oninput = function () { p = +this.value; draw(); }; }
          else b.querySelector('[data-l]').oninput = function () { lam = +this.value; draw(); };
          b.querySelector('[data-kk]').oninput = function () { k = +this.value; draw(); };
          [].forEach.call(b.querySelectorAll('[data-op] [data-k]'), function (x) { x.onclick = function () { op = x.getAttribute('data-k'); [].forEach.call(b.querySelectorAll('[data-op] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); draw(); }; });
          draw();
        };
        var draw = function () {
          var top = tip === 'b' ? n : Math.max(10, Math.ceil(lam + 4 * Math.sqrt(lam))), f = tip === 'b' ? function (x) { return M.binom(x, n, p); } : function (x) { return M.pois(x, lam); };
          k = Math.min(k, top); var kk = el.querySelector('[data-kk]'); kk.max = top; kk.value = k;
          var xs = [], ps = [], hi = []; for (var x = 0; x <= top; x++) { xs.push(x); ps.push(f(x)); if (op === 'eq' ? x === k : op === 'le' ? x <= k : x >= k) hi.push(x); }
          var pr = op === 'eq' ? f(k) : op === 'le' ? cumL(f, 0, k) : 1 - cumL(f, 0, k - 1);
          var mu = tip === 'b' ? n * p : lam, sd = tip === 'b' ? Math.sqrt(n * p * (1 - p)) : Math.sqrt(lam);
          el.querySelector('[data-g]').innerHTML = pmfBars(xs, ps, { hi: hi, val: top <= 12, renk: PAL[0], d: -1, gap: top > 20 ? 0.1 : 0.2, max: V.nice(Math.max.apply(null, ps) * 1.1) });
          if (tip === 'b') { el.querySelector('[data-no]').textContent = n; el.querySelector('[data-po]').textContent = nf(p, 2); } else el.querySelector('[data-lo]').textContent = nf(lam, 1);
          el.querySelector('[data-ko]').textContent = k;
          el.querySelector('[data-o]').innerHTML = '<div><small>' + { eq: 'P(X = ', le: 'P(X ≤ ', ge: 'P(X ≥ ' }[op] + k + ')</small><b>' + nf(pr, 4, false) + '</b></div><div><small>μ</small><b>' + nf(mu, 2) + '</b></div><div><small>σ²</small><b>' + nf(sd * sd, 2) + '</b></div><div><small>σ</small><b>' + nf(sd, 3) + '</b></div>';
          el.querySelector('[data-n]').innerHTML = tip === 'b' ? 'P(X = ' + k + ') = C(' + n + ', ' + k + ')·' + nf(p, 2) + '^' + k + '·' + nf(1 - p, 2) + '^' + (n - k) + ' = ' + nf(f(k), 4, false) + '. p = 0,5’te dağılım simetrik; p küçükse sağa, büyükse sola çarpık.' : 'P(X = ' + k + ') = e^(−' + nf(lam, 1) + ')·' + nf(lam, 1) + '^' + k + ' / ' + k + '! = ' + nf(f(k), 4, false) + '. Poisson’da ortalama ve varyans eşittir (λ); λ büyüdükçe dağılım simetrikleşir.';
        };
        [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (x) { x.onclick = function () { tip = x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); ctl(); }; });
        ctl();
      }
    },
    sorular: function (r) {
      var out = [];
      var n = r.int(4, 10), p = r.pick([0.1, 0.2, 0.25, 0.3, 0.4, 0.6, 0.7, 0.8]), x = r.int(1, Math.min(n - 1, 4)), pb = M.binom(x, n, p);
      out.push({ viz: function (ka) { var xs = [], ps = []; for (var i = 0; i <= n; i++) { xs.push(i); ps.push(M.binom(i, n, p)); } return IST.S.sutun(xs, ps, ka >= 1 ? [x] : [], { xlab: 'satış sayısı · B(' + n + '; ' + nf(p, 2) + ')' }); }, tag: 'senaryo', q: '<p>Bir çağrı merkezinde aramaların %' + Math.round(p * 100) + '’si satışla sonuçlanıyor; aramalar bağımsız. Bir temsilci ' + n + ' arama yapıyor.</p><p><b>Tam ' + x + '</b> satış yapma olasılığı kaçtır? (dört ondalık)</p>', say: pb, goster: nf(pb, 4, false), tol: 0.0006, ornek: '0,0486',
        ip: 'X ~ B(n = ' + n + ', p = ' + nf(p, 2) + '); P(X = x) = C(n, x)·pˣ·qⁿ⁻ˣ.', cz: ['C(' + n + ', ' + x + ') = ' + M.C(n, x) + '.', nf(p, 2) + '^' + x + ' = ' + nf(Math.pow(p, x), 6) + ', ' + nf(1 - p, 2) + '^' + (n - x) + ' = ' + nf(Math.pow(1 - p, n - x), 6) + '.', 'P = ' + M.C(n, x) + ' × ' + nf(Math.pow(p, x), 6) + ' × ' + nf(Math.pow(1 - p, n - x), 6) + ' = <b>' + nf(pb, 4, false) + '</b>.'] });
      var q2 = r.pick([0.85, 0.9, 0.92, 0.95]), n2 = r.int(3, 8), al = 1 - Math.pow(q2, n2);
      out.push({ viz: function (ka) { var xs = [], ps = []; for (var i = 0; i <= n2; i++) { xs.push(i); ps.push(M.binom(i, n2, 1 - q2)); } return IST.S.sutun(xs, ps, ka >= 2 ? xs.slice(1) : ka >= 1 ? [0] : [], { xlab: ka >= 2 ? 'turuncu: en az bir iade = 1 − P(0)' : 'iade sayısı' }); }, tag: 'senaryo', q: '<p>Bir e-ticaret sitesinde siparişlerin %' + Math.round((1 - q2) * 100) + '’si iade ediliyor (bağımsız). Rastgele ' + n2 + ' sipariş seçiliyor.</p><p><b>En az bir</b> siparişin iade edilme olasılığı kaçtır? (dört ondalık)</p>', say: al, goster: nf(al, 4, false), tol: 0.0006, ornek: '0,3439',
        ip: '“En az bir” = 1 − P(hiç yok) = 1 − qⁿ.', cz: ['P(X = 0) = ' + nf(q2, 2) + '^' + n2 + ' = ' + nf(Math.pow(q2, n2), 4) + '.', 'P(X ≥ 1) = 1 − ' + nf(Math.pow(q2, n2), 4) + ' = <b>' + nf(al, 4, false) + '</b>.'] });
      var n3 = r.int(20, 200), p3 = r.pick([0.05, 0.1, 0.2, 0.25, 0.4]), sd3 = Math.sqrt(n3 * p3 * (1 - p3));
      out.push({ tag: 'hesap', q: '<p>Bir bankada kredi kartı başvurularının %' + Math.round(p3 * 100) + '’i reddediliyor. Bugün ' + n3 + ' başvuru var.</p><p>Reddedilen başvuru sayısının <b>standart sapması</b> kaçtır? (iki ondalık)</p>', say: sd3, goster: nf(sd3, 2), tol: 0.011, ornek: '0,6',
        yanlis: function (v) { return Math.abs(v - n3 * p3 * (1 - p3)) < 0.02 ? 'Bu varyans (npq); karekökünü al.' : Math.abs(v - n3 * p3) < 0.02 ? 'Bu ortalama (np).' : 'σ = √(npq).'; },
        ip: 'Binomda μ = np, σ = √(npq).', cz: ['n = ' + n3 + ', p = ' + nf(p3, 2) + ', q = ' + nf(1 - p3, 2) + '.', 'npq = ' + nf(n3 * p3 * (1 - p3), 4) + '.', 'σ = √' + nf(n3 * p3 * (1 - p3), 4) + ' = <b>' + nf(sd3, 2) + '</b>.'] });
      var lam = r.pick([1.5, 2, 2.5, 3, 4, 5, 6]), x4 = r.int(0, 5), pp = M.pois(x4, lam);
      out.push({ viz: function (ka) { var xs = [], ps = []; for (var i = 0; i <= Math.max(10, Math.ceil(lam * 2.5)); i++) { xs.push(i); ps.push(M.pois(i, lam)); } return IST.S.sutun(xs, ps, ka >= 1 ? [x4] : [], { xlab: 'saatteki müşteri · λ = ' + nf(lam, 1) }); }, tag: 'senaryo', q: '<p>Bir eczaneye öğle saatinde saatte ortalama <b>' + nf(lam, 1) + '</b> müşteri geliyor (Poisson).</p><p>Bir saatte <b>tam ' + x4 + '</b> müşteri gelme olasılığı kaçtır? (dört ondalık)</p>', say: pp, goster: nf(pp, 4, false), tol: 0.0006, ornek: '0,1606',
        ip: 'P(X = x) = e^(−λ)·λˣ / x!.', cz: ['e^(−' + nf(lam, 1) + ') = ' + nf(Math.exp(-lam), 6) + '.', nf(lam, 1) + '^' + x4 + ' / ' + x4 + '! = ' + nf(Math.pow(lam, x4) / M.fact(x4), 6) + '.', 'P = <b>' + nf(pp, 4, false) + '</b>.'] });
      var lh = r.pick([6, 12, 18, 24, 30]), mins = r.pick([10, 15, 20, 30]), ln = lh * mins / 60, x5 = r.int(0, 3), p5 = M.pois(x5, ln);
      out.push({ viz: function (ka) { var L = ka >= 1 ? ln : lh, xs = [], ps = []; for (var i = 0; i <= Math.max(8, Math.ceil(L * 2.2)); i++) { xs.push(i); ps.push(M.pois(i, L)); } return IST.S.sutun(xs, ps, ka >= 2 ? [x5] : [], { xlab: (ka >= 1 ? mins + ' dakika · λ = ' : 'bir saat · λ = ') + nf(L, 2) }); }, tag: 'senaryo', q: '<p>Bir otoyol gişesinden saatte ortalama <b>' + lh + '</b> araç geçiyor (Poisson).</p><p><b>' + mins + ' dakikada tam ' + x5 + '</b> araç geçme olasılığı kaçtır? (dört ondalık)</p>', say: p5, goster: nf(p5, 4, false), tol: 0.0006, ornek: '0,1839',
        yanlis: function (v) { return Math.abs(v - M.pois(x5, lh)) < 0.001 ? 'λ’yı ' + mins + ' dakikaya uyarlamadın.' : 'Önce λ’yı aralığa uyarla.'; },
        ip: 'λ, sorulan aralığa göre ölçeklenmeli: λ\' = ' + lh + ' × ' + mins + '/60.', cz: ['λ\' = ' + lh + ' × ' + mins + ' / 60 = <b>' + nf(ln, 2) + '</b>.', 'P(X = ' + x5 + ') = e^(−' + nf(ln, 2) + ')·' + nf(ln, 2) + '^' + x5 + ' / ' + x5 + '!.', '= <b>' + nf(p5, 4, false) + '</b>.'] });
      return out;
    }
  });

  /* ======================= 12. HAFTA ======================= */
  IST.hafta({
    id: 'g12', no: 12, renk: '#1F8A7A', tr: 'Hipergeometrik dağılım ve Poisson uygulamaları', en: 'Discrete PD 2: Hypergeometric',
    sahneler: [
      {
        b: 'Poisson’a dönüş: acil servis ve ATM', terim: [['μ = σ² = λ', 'mean equals variance']],
        t: '<p>Acil servise saatte ortalama 2,5 hasta geliyor. Hiç hasta gelmeme olasılığı: P(0) = e^(−2,5) = <b>0,0821</b>.</p><p>Tersinden: bir ATM’de bir saatte hiç müşteri olmama olasılığı 0,02 ise e^(−λ) = 0,02 → λ = −ln 0,02 = <b>3,912</b>. Poisson’da ortalama ve varyans ikisi de 3,912’dir.</p>',
        v: function () { var ps = []; for (var x = 0; x <= 9; x++) ps.push(M.pois(x, 2.5)); return pmfBars(ps.map(function (_, i) { return i; }), ps, { max: 0.3, hi: [0], h: 210, xlab: 'saatteki hasta sayısı (λ = 2,5)' }) + V.fx([{ s: 'ATM', h: 'e^(−λ) = 0,02 → λ = −ln(0,02) = <b>3,912</b>', son: true }], 1); }
      },
      {
        b: 'Yerine koymadan seçim', terim: [['hipergeometrik dağılım', 'hypergeometric distribution'], ['yerine koymadan', 'without replacement']],
        t: '<p>Binomda p sabitti. Ama sonlu bir kümeden <b>yerine koymadan</b> seçince her çekilişte olasılık değişir; denemeler bağımsız değildir.</p><p class="mono" style="font-size:14.5px">P(X = x) = C(K, x)·C(N − K, n − x) / C(N, n)</p><p>N: kümedeki toplam eleman, K: “başarı” sayısı, n: seçilen sayı, x: seçilenlerdeki başarı sayısı.</p>',
        v: function () {
          var s = '', r = IST.rng(4);
          for (var i = 0; i < 20; i++) { var red = i < 8; s += '<circle class="pop" ' + d(i * 0.04) + ' cx="' + (60 + (i % 5) * 34) + '" cy="' + (60 + Math.floor(i / 5) * 34) + '" r="14" fill="' + (red ? PAL[1] : PAL[0]) + '" stroke="#0D1838"/>'; }
          s += '<rect x="30" y="30" width="180" height="150" rx="16" fill="none" stroke="#0D1838" stroke-width="2.5"/><text class="lbb" x="120" y="204" text-anchor="middle">N = 20, K = 8 kırmızı</text>';
          [1, 0, 1, 0].forEach(function (red, k) { s += '<g class="dp" ' + d(0.9 + k * 0.35) + '><circle cx="' + (300 + k * 50) + '" cy="100" r="16" fill="' + (red ? PAL[1] : PAL[0]) + '" stroke="#0D1838" stroke-width="2"/></g><text class="lbm fd" ' + d(1 + k * 0.35) + ' x="' + (300 + k * 50) + '" y="140" text-anchor="middle">' + ['8/20', '12/19', '7/18', '11/17'][k] + '</text>'; });
          s += '<text class="lbb fd" ' + d(2.4) + ' x="375" y="60" text-anchor="middle">n = 4 çekiliş · olasılık her seferinde değişir</text>';
          return V.svg(540, 220, s, 'yerine koymadan çekiliş');
        }
      },
      {
        b: 'İstatistik sınıfı örneği', terim: [['tümleyen', 'complement']],
        t: '<p>Sınıfta 60 iktisat, 40 işletme öğrencisi (N = 100, K = 60). Rastgele 4 öğrenci seçiliyor.</p><ul><li>Dördü de iktisattan: C(60,4)·C(40,0) / C(100,4) = <b>0,1244</b></li><li>İki ya da daha fazla iktisatçı: 1 − P(0) − P(1) = <b>0,8255</b></li></ul>',
        v: function () { var ps = [0, 1, 2, 3, 4].map(function (x) { return M.hyper(x, 100, 60, 4); }); return pmfBars([0, 1, 2, 3, 4], ps, { max: 0.4, dg: 4, hi: [2, 3, 4], xlab: 'örneklemdeki iktisatçı sayısı (N = 100, K = 60, n = 4)' }); }
      },
      {
        b: 'Ortalama ve varyans', terim: [['sonlu anakütle düzeltmesi', 'finite population correction (N − n)/(N − 1)']],
        t: '<p class="mono" style="font-size:14px">μ = n·K/N &nbsp;&nbsp; σ² = n·(K/N)·(1 − K/N)·(N − n)/(N − 1)</p><p>Sınıf örneği: μ = 4·60/100 = <b>2,4</b>; σ² = 4·0,6·0,4·96/99 = <b>0,9309</b>; σ = <b>0,9648</b>.</p><p>(N − n)/(N − 1) çarpanı binom varyansını küçültür: yerine koymadan seçim belirsizliği azaltır.</p>',
        v: function () { return V.fx([{ s: 'ortalama', h: 'μ = 4 × 60/100 = <b>2,4</b>' }, { s: 'binom olsaydı', h: 'npq = 4 × 0,6 × 0,4 = 0,96' }, { s: 'düzeltme çarpanı', h: '(100 − 4)/(100 − 1) = 96/99 = 0,9697' }, { s: 'hipergeometrik varyans', h: 'σ² = 0,96 × 0,9697 = <b>0,9309</b> · σ = <b>0,9648</b>', son: true }], 0.2, 0.55); }
      },
      {
        b: 'Kalite kontrol: toptancının kararı', terim: [['kabul örneklemesi', 'acceptance sampling']],
        t: '<p>400 parçalık bir kolide 20 parça standart dışı. Toptancı rastgele 5 parça seçiyor ve <b>beşi de</b> standarda uygunsa koliyi alıyor.</p><p>P(kabul) = C(380,5)·C(20,0) / C(400,5) = 0,7728 → P(<b>red</b>) = 1 − 0,7728 = <b>0,2272</b>.</p>',
        v: function () {
          var s = '';
          for (var i = 0; i < 80; i++) { var bad = [3, 17, 29, 44].indexOf(i) >= 0; s += '<rect class="pop" ' + d(i * 0.012) + ' x="' + (20 + (i % 16) * 22) + '" y="' + (30 + Math.floor(i / 16) * 22) + '" width="18" height="18" rx="3" fill="' + (bad ? PAL[1] : '#DDEBFA') + '" stroke="#0D1838" stroke-width=".8"/>'; }
          s += '<text class="lbl" x="20" y="18">koli: her 20 parçadan 1’i kusurlu (20 / 400)</text>';
          s += '<g class="an" ' + d(1.2) + '><rect x="390" y="30" width="130" height="106" rx="12" fill="#fff" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="455" y="60" text-anchor="middle">P(kabul)</text><text x="455" y="86" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="700">0,7728</text><text class="lbb" x="455" y="112" text-anchor="middle" style="fill:#C8553D">P(red) 0,2272</text></g>';
          return V.svg(540, 150, s, 'koli ve kusurlu parçalar');
        }
      },
      {
        b: 'Ne zaman binom yaklaşımı?', terim: [['binom yaklaşımı', 'binomial approximation']],
        t: '<p>Seçilen sayı kümenin küçük bir kesriyse (genellikle <b>n/N ≤ 0,05</b>) yerine koyup koymamak sonucu pek değiştirmez; hipergeometrik yerine binom kullanılabilir.</p><p>Koli örneğinde n/N = 5/400 = 0,0125: binomla P(kabul) = 0,95⁵ = 0,7738; hipergeometrikle 0,7728. Fark yalnızca 0,001!</p>',
        v: function () {
          var h = [0, 1, 2, 3].map(function (x) { return M.hyper(x, 400, 20, 5); }), b = [0, 1, 2, 3].map(function (x) { return M.binom(x, 5, 0.05); }), s = '', ys = V.sc(0, 0.8, 220, 20);
          s += V.axes({}, 46, 520, 220, 20, 0.8, function (v) { return nf(v, 1); }, 4);
          h.forEach(function (v, i) { var x = 80 + i * 112; s += '<rect class="gy" ' + d(i * 0.15) + ' x="' + x + '" y="' + ys(v) + '" width="40" height="' + (220 - ys(v)) + '" fill="' + PAL[2] + '" stroke="#0D1838"/><rect class="gy" ' + d(0.4 + i * 0.15) + ' x="' + (x + 42) + '" y="' + ys(b[i]) + '" width="40" height="' + (220 - ys(b[i])) + '" fill="' + PAL[3] + '" stroke="#0D1838"/><text class="lbl" x="' + (x + 41) + '" y="238" text-anchor="middle">' + i + '</text>'; });
          s += '<rect x="300" y="30" width="12" height="12" fill="' + PAL[2] + '"/><text class="lbl" x="316" y="40">hipergeometrik</text><rect x="420" y="30" width="12" height="12" fill="' + PAL[3] + '"/><text class="lbl" x="436" y="40">binom</text>';
          return V.svg(540, 250, s, 'hipergeometrik ve binom karşılaştırması');
        }
      }
    ],
    gorsel: {
      b: 'Torba deneyi: yerine koymadan çekiliş', t: 'N, K ve n’yi ayarla, torbadan çek. Her çekiliş X’i (seçilen kırmızı sayısı) kaydeder; yüzlerce çekilişte göreli frekanslar hipergeometrik olasılıklara yaklaşır. Binom çizgisini açıp n/N küçükken farkın kaybolduğunu gör.',
      kur: function (el) {
        var N = 20, K = 8, n = 4, cnt = [], last = [], bin = false;
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>N (torbadaki top) <output data-No></output></span><input type="range" min="10" max="60" value="20" data-N></label><label><span>K (kırmızı) <output data-Ko></output></span><input type="range" min="1" max="59" value="8" data-K></label><label><span>n (çekilen) <output data-no></output></span><input type="range" min="1" max="10" value="4" data-n></label><div class="row"><button type="button" class="btn sm pri" data-c1>1 kez çek</button><button type="button" class="btn sm" data-c100>100 kez çek</button><button type="button" class="btn sm ghost" data-bn aria-pressed="false">binom çizgisi</button></div></div><div class="at-v"><div data-u></div><div data-g></div><div class="at-not" data-t></div></div></div>';
        var reset = function () { cnt = []; for (var i = 0; i <= n; i++) cnt.push(0); last = []; };
        var draw = function () {
          var s = '', idxs = last;
          for (var i = 0; i < N; i++) { var red = i < K, on = idxs.indexOf(i) >= 0; s += '<circle cx="' + (16 + (i % 30) * 17) + '" cy="' + (16 + Math.floor(i / 30) * 18) + '" r="7" fill="' + (red ? PAL[1] : PAL[0]) + '" fill-opacity="' + (on ? 1 : 0.35) + '" stroke="#0D1838" stroke-width="' + (on ? 2 : 0.6) + '"' + (on ? ' class="pop"' : '') + '/>'; }
          el.querySelector('[data-u]').innerHTML = V.svg(530, 50, s, 'torba: koyu olanlar son çekiliş');
          var tot = M.sum(cnt), xs = [], th = [], fr = [];
          for (var x = 0; x <= n; x++) { xs.push(x); th.push(M.hyper(x, N, K, n)); fr.push(tot ? cnt[x] / tot : 0); }
          var mx = V.nice(Math.max.apply(null, th.concat(fr)) * 1.1), W = 520, L = 46, ys = V.sc(0, mx, 210, 18), bw = (W - L - 12) / (n + 1), g = V.axes({}, L, W - 12, 210, 18, mx, function (v) { return nf(v, 2); }, 4);
          xs.forEach(function (x, i) { var X0 = L + i * bw; g += '<rect x="' + (X0 + bw * 0.15) + '" y="' + ys(fr[i]) + '" width="' + (bw * 0.7) + '" height="' + (210 - ys(fr[i])) + '" fill="' + PAL[2] + '" fill-opacity=".7" stroke="#0D1838"/><line x1="' + (X0 + bw * 0.08) + '" x2="' + (X0 + bw * 0.92) + '" y1="' + ys(th[i]) + '" y2="' + ys(th[i]) + '" stroke="#C8553D" stroke-width="3"/><text class="lbl" x="' + (X0 + bw / 2) + '" y="226" text-anchor="middle">' + x + '</text>'; if (bin) { var bp = M.binom(x, n, K / N); g += '<circle cx="' + (X0 + bw / 2) + '" cy="' + ys(bp) + '" r="5" fill="#E0A526" stroke="#0D1838"/>'; } });
          g += '<text class="lbl" x="' + (W - 12) + '" y="14" text-anchor="end">yeşil: deney · kırmızı çizgi: hipergeometrik' + (bin ? ' · sarı: binom' : '') + '</text>';
          el.querySelector('[data-g]').innerHTML = V.svg(W, 236, g, 'deney ve teori');
          el.querySelector('[data-No]').textContent = N; el.querySelector('[data-Ko]').textContent = K; el.querySelector('[data-no]').textContent = n;
          var mu = n * K / N, va = n * (K / N) * (1 - K / N) * (N - n) / (N - 1);
          el.querySelector('[data-t]').innerHTML = tot + ' çekiliş. Teori: μ = nK/N = <b>' + nf(mu, 3) + '</b>, σ² = <b>' + nf(va, 3) + '</b>' + (tot ? '; deneyin ortalaması ' + nf(M.sum(cnt.map(function (c, x) { return c * x; })) / tot, 3) : '') + '. n/N = ' + nf(n / N, 3) + (n / N <= 0.05 ? ' ≤ 0,05 → binom iyi bir yaklaşım.' : ' > 0,05 → binom yaklaşımı zayıf.');
        };
        var cek = function (t) { for (var j = 0; j < t; j++) { last = IST.rng((Math.random() * 1e9) | 0).shuf(Array.apply(null, Array(N)).map(function (_, i) { return i; })).slice(0, n); cnt[last.filter(function (i) { return i < K; }).length]++; } draw(); };
        var sync = function () { K = Math.min(K, N - 1); var kk = el.querySelector('[data-K]'); kk.max = N - 1; kk.value = K; n = Math.min(n, N); reset(); draw(); };
        el.querySelector('[data-N]').oninput = function () { N = +this.value; sync(); };
        el.querySelector('[data-K]').oninput = function () { K = +this.value; sync(); };
        el.querySelector('[data-n]').oninput = function () { n = +this.value; sync(); };
        el.querySelector('[data-c1]').onclick = function () { cek(1); };
        el.querySelector('[data-c100]').onclick = function () { cek(100); };
        el.querySelector('[data-bn]').onclick = function () { bin = !bin; this.setAttribute('aria-pressed', String(bin)); draw(); };
        reset(); draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var N = r.int(20, 60), K = r.int(5, Math.floor(N / 2)), n = r.int(3, 6), x = r.int(1, Math.min(n, K) - 1 || 1), ph = M.hyper(x, N, K, n);
      var ctx = r.pick([['bir yönetim kurulu adayları', 'kadın'], ['bir depodaki laptoplar', 'kusurlu'], ['bir fon sepetindeki hisseler', 'teknoloji']]);
      out.push({ viz: function (ka) { var xs = [], ps = []; for (var i = 0; i <= Math.min(n, K); i++) { xs.push(i); ps.push(M.hyper(i, N, K, n)); } return IST.S.izgara(N, K, '●', 0, { renk: PAL[1], lab: K + ' ' + ctx[1] + ' / ' + N }) + (ka >= 1 ? IST.S.sutun(xs, ps, [x], { xlab: 'seçilenlerdeki ' + ctx[1] + ' sayısı' }) : ''); }, tag: 'senaryo', q: '<p>' + X(ctx[0][0].toUpperCase() + ctx[0].slice(1)) + ': toplam <b>' + N + '</b>, bunların <b>' + K + '</b> tanesi ' + ctx[1] + '. Yerine koymadan rastgele <b>' + n + '</b> tanesi seçiliyor.</p><p>Seçilenlerin <b>tam ' + x + '</b> tanesinin ' + ctx[1] + ' olma olasılığı kaçtır? (dört ondalık)</p>', say: ph, goster: nf(ph, 4, false), tol: 0.0006, ornek: '0,1244',
        yanlis: function (v) { return Math.abs(v - M.binom(x, n, K / N)) < 0.001 ? 'Bu binom sonucu; yerine koymadan seçimde hipergeometrik kullan.' : 'P = C(K,x)·C(N−K,n−x)/C(N,n).'; },
        ip: 'P(X = x) = C(K, x)·C(N − K, n − x) / C(N, n).', cz: ['C(' + K + ', ' + x + ') = ' + M.C(K, x) + ', C(' + (N - K) + ', ' + (n - x) + ') = ' + M.C(N - K, n - x) + '.', 'C(' + N + ', ' + n + ') = ' + M.C(N, n) + '.', 'P = ' + M.C(K, x) + ' × ' + M.C(N - K, n - x) + ' / ' + M.C(N, n) + ' = <b>' + nf(ph, 4, false) + '</b>.'] });
      var N2 = r.int(30, 200), K2 = r.int(5, Math.floor(N2 * 0.6)), n2 = r.int(3, 12), mu = n2 * K2 / N2;
      out.push({ tag: 'hesap', q: '<p>Bir otoparkta ' + N2 + ' aracın ' + K2 + ' tanesi elektrikli. Denetçi yerine koymadan ' + n2 + ' araç seçiyor.</p><p>Seçilen elektrikli araç sayısının <b>beklenen değeri</b> kaçtır? (iki ondalık)</p>', say: mu, goster: nf(mu, 2), tol: 0.0051, ornek: '2,4',
        ip: 'μ = n·K / N.', cz: ['μ = ' + n2 + ' × ' + K2 + ' / ' + N2 + '.', '= <b>' + nf(mu, 2) + '</b>.'] });
      var N3 = r.pick([100, 200, 250, 400, 500]), K3 = r.int(4, Math.floor(N3 / 10)), n3 = r.int(3, 6), rej = 1 - M.hyper(0, N3, K3, n3);
      out.push({ viz: function (ka) { return IST.S.izgara(N3, K3, '⚙️', 0, { renk: PAL[1], lab: K3 + ' kusurlu / ' + N3 + ' · ' + n3 + ' parça çekilecek' }); }, tag: 'senaryo', q: '<p>' + N3 + ' parçalık bir partide ' + K3 + ' parça kusurlu. Alıcı yerine koymadan ' + n3 + ' parça seçiyor ve <b>hepsi sağlamsa</b> partiyi kabul ediyor.</p><p>Partinin <b>reddedilme</b> olasılığı kaçtır? (dört ondalık)</p>', say: rej, goster: nf(rej, 4, false), tol: 0.0006, ornek: '0,2272',
        ip: 'Red = en az bir kusurlu = 1 − P(X = 0).', cz: ['P(X = 0) = C(' + (N3 - K3) + ', ' + n3 + ') / C(' + N3 + ', ' + n3 + ') = ' + nf(1 - rej, 4) + '.', 'P(red) = 1 − ' + nf(1 - rej, 4) + ' = <b>' + nf(rej, 4, false) + '</b>.'] });
      var p0 = r.pick([0.01, 0.02, 0.03, 0.05, 0.1, 0.15]), lam = -Math.log(p0);
      out.push({ tag: 'ters soru', q: '<p>Bir kargo şubesinde 5 dakikalık bir aralıkta <b>hiç müşteri gelmeme</b> olasılığı ' + nf(p0, 2) + ' (Poisson).</p><p>5 dakikada gelen müşteri sayısının <b>varyansı</b> kaçtır? (üç ondalık)</p>', say: lam, goster: nf(lam, 3), tol: 0.0021, ornek: '3,912',
        ip: 'P(X = 0) = e^(−λ). Poisson’da varyans = λ.', cz: ['e^(−λ) = ' + nf(p0, 2) + ' → λ = −ln(' + nf(p0, 2) + ').', 'λ = <b>' + nf(lam, 3) + '</b>; Poisson’da σ² = λ = <b>' + nf(lam, 3) + '</b>.'] });
      var sc = r.pick([['Bir web sitesine dakikada ortalama 3 sipariş geliyor; bir dakikadaki sipariş sayısı.', 1], ['Bir kalite kontrolcü 12 parçalık bir kutudan (3’ü kusurlu) 4 parçayı yerine koymadan seçiyor; seçilen kusurlu sayısı.', 2], ['Müşterilerin %20’si ek garanti alıyor; sonraki 15 müşteride ek garanti alan sayısı.', 0], ['Bir kitabın sayfasında ortalama 0,4 dizgi hatası var; bir sayfadaki hata sayısı.', 1], ['10 kişilik bir ekipten (4’ü kadın) 3 kişilik bir heyet rastgele seçiliyor; heyetteki kadın sayısı.', 2], ['Bir okçu hedefi %70 olasılıkla vuruyor; 8 atıştaki isabet sayısı.', 0]]);
      out.push({ tag: 'senaryo', q: '<p>' + X(sc[0]) + '</p><p>Bu değişken için en uygun dağılım hangisidir?</p>', o: ['Binom', 'Poisson', 'Hipergeometrik'], a: sc[1], n: ['Sabit n bağımsız deneme, sabit p.', 'Bir aralıktaki olay sayısı, sabit ortalama oran.', 'Sonlu kümeden yerine koymadan seçim.'][sc[1]],
        ip: 'Sabit sayıda deneme mi var, yoksa bir aralıktaki olay sayısı mı? Seçim yerine koymadan mı?', cz: ['Binom: n deneme, p sabit, bağımsız.', 'Poisson: aralıkta olay sayısı, λ.', 'Hipergeometrik: N’den yerine koymadan n seçim.', 'Cevap: <b>' + ['binom', 'Poisson', 'hipergeometrik'][sc[1]] + '</b>.'] });
      return out;
    }
  });
})();
