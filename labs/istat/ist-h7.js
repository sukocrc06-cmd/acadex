/* ==========================================================================
   ACADEX İSTATİSTİK · Bahar 9–11. haftalar (labs/istat/ist-h7.js), 12.11.2026
   9 Korelasyon · 10 Regresyon analizi · 11 Parametrik olmayan testler I
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;
  var SX = [30, 45, 60, 20, 90, 75, 40, 55, 80, 65], SY = [52, 60, 71, 45, 88, 80, 58, 62, 85, 70];
  var EX = [60, 75, 85, 90, 100, 110, 120, 135, 150, 170], EY = [180, 210, 240, 235, 260, 290, 300, 330, 360, 400];
  /* sürüklenebilir serpilme: pts [[x,y]], dom [x0,x1,y0,y1], on(pts) her değişimde */
  var serp = function (box, pts, dom, opt, on) {
    var W = 540, H = 300, L = 46, R = 14, T = 14, B = 40, xs = V.sc(dom[0], dom[1], L, W - R), ys = V.sc(dom[2], dom[3], H - B, T);
    var ix = function (px) { return dom[0] + (px - L) / (W - R - L) * (dom[1] - dom[0]); }, iy = function (py) { return dom[2] + (H - B - py) / (H - B - T) * (dom[3] - dom[2]); };
    var draw = function () {
      var s = '', xs0 = pts.map(function (p) { return p[0]; }), ys0 = pts.map(function (p) { return p[1]; }), mx = M.mean(xs0), my = M.mean(ys0);
      for (var i = 0; i <= 4; i++) { var v = dom[2] + (dom[3] - dom[2]) * i / 4, vx = dom[0] + (dom[1] - dom[0]) * i / 4; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + ys(v) + '" y2="' + ys(v) + '" stroke="' + (i ? '#E6E0D2' : '#0D1838') + '" stroke-width="' + (i ? 1 : 2) + '"/><text class="lbm" x="' + (L - 6) + '" y="' + (ys(v) + 4) + '" text-anchor="end">' + nf(v, 0) + '</text><text class="lbm" x="' + xs(vx) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + nf(vx, 0) + '</text>'; }
      if (opt.quad) { s += '<line x1="' + xs(mx) + '" x2="' + xs(mx) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#6A7593" stroke-dasharray="4 4"/><line x1="' + L + '" x2="' + (W - R) + '" y1="' + ys(my) + '" y2="' + ys(my) + '" stroke="#6A7593" stroke-dasharray="4 4"/><text class="lbl" x="' + (W - R - 4) + '" y="' + (T + 12) + '" text-anchor="end">+ bölge</text><text class="lbl" x="' + (L + 4) + '" y="' + (T + 12) + '">− bölge</text>'; }
      if (opt.extra) s += opt.extra(xs, ys, pts, mx, my);
      pts.forEach(function (p, i) { var c = opt.quad ? ((p[0] - mx) * (p[1] - my) >= 0 ? PAL[2] : PAL[1]) : PAL[0]; s += '<circle class="drag" data-i="' + i + '" cx="' + xs(p[0]) + '" cy="' + ys(p[1]) + '" r="9" fill="' + c + '" stroke="#0D1838" stroke-width="1.8"/>'; });
      if (opt.xl) s += '<text class="lbl" x="' + ((L + W - R) / 2) + '" y="' + (H - 4) + '" text-anchor="middle" font-weight="700">' + X(opt.xl) + '</text>';
      if (opt.yl) s += '<text class="lbl" transform="translate(12 ' + ((T + H - B) / 2) + ') rotate(-90)" text-anchor="middle" font-weight="700">' + X(opt.yl) + '</text>';
      box.innerHTML = V.svg(W, H, s, 'sürüklenebilir serpilme grafiği');
      var svg = box.querySelector('svg');
      IST.drag(svg, '[data-i]', function (c, p, end) { var i = +c.getAttribute('data-i'); pts[i] = [Math.max(dom[0], Math.min(dom[1], Math.round(ix(p.x)))), Math.max(dom[2], Math.min(dom[3], Math.round(iy(p.y))))]; if (end) { draw(); on(pts); } else { c.setAttribute('cx', xs(pts[i][0])); c.setAttribute('cy', ys(pts[i][1])); on(pts, true); } });
    };
    draw(); on(pts);
    return { draw: draw };
  };

  /* ======================= BAHAR 9 ======================= */
  IST.hafta({
    id: 'b9', no: 9, renk: '#3E8E5B', tr: 'Korelasyon', en: 'Correlation',
    sahneler: [
      {
        b: 'İki değişken birlikte değişiyor mu?', terim: [['korelasyon', 'correlation'], ['pozitif / negatif ilişki', 'positive / negative relationship']],
        t: '<p>Bir bebek büyüdükçe kilosu artar: yaş ile kilo <b>birlikte</b> değişir. <b>Korelasyon</b>, iki nicel değişken arasındaki <b>doğrusal</b> ilişkinin yönünü ve gücünü ölçer.</p><p>Bir öğretim üyesi 10 öğrencinin sınava çalışma süresi (dk) ile notunu kaydediyor: çalışma arttıkça not da artıyor gibi.</p>',
        v: function () { var f = M.ls(SX, SY); return V.xy({ x: SX, y: SY, h: 270, xmin: 10, xmax: 100, ymin: 40, ymax: 95, xt: [[20, '20'], [40, '40'], [60, '60'], [80, '80'], [100, '100']], xlab: 'çalışma süresi (dk)', ylab: 'sınav notu', stag: 0.1, fit: [f.a, f.b] }); }
      },
      {
        b: 'Kovaryans: işaret yönü söyler', terim: [['kovaryans', 'covariance'], ['sapmaların çarpımı', 'cross-products']],
        t: '<p class="mono">s<sub>xy</sub> = Σ(x − x̄)(y − ȳ) / (n − 1)</p><p>Nokta, iki ortalamanın oluşturduğu çizgilere göre sağ-üst ya da sol-alt bölgedeyse çarpım <b>pozitif</b>, diğer iki bölgedeyse <b>negatif</b>. Toplamın işareti ilişkinin yönünü verir.</p><p>Sorun: kovaryansın büyüklüğü birimlere bağlıdır (dakika yerine saniye kullansak 60 katına çıkar).</p>',
        v: function () { var mx = M.mean(SX), my = M.mean(SY); return V.xy({ x: SX, y: SY, h: 270, xmin: 10, xmax: 100, ymin: 40, ymax: 95, xt: [[20, '20'], [60, '60'], [100, '100']], stag: 0.1, renk: PAL[2] }).replace('</svg>', '<g class="an" ' + d(1.2) + '><line x1="' + (54 + (mx - 10) / 90 * 444).toFixed(1) + '" x2="' + (54 + (mx - 10) / 90 * 444).toFixed(1) + '" y1="18" y2="226" stroke="#6A7593" stroke-dasharray="4 4"/><line x1="46" x2="506" y1="' + (226 - (my - 40) / 55 * 208).toFixed(1) + '" y2="' + (226 - (my - 40) / 55 * 208).toFixed(1) + '" stroke="#6A7593" stroke-dasharray="4 4"/><text class="lbb" x="480" y="34" text-anchor="end" style="fill:#1F8A7A">(+)(+) = +</text><text class="lbb" x="70" y="214" style="fill:#1F8A7A">(−)(−) = +</text></g></svg>') + V.fx([{ s: 'kovaryans', h: 's<sub>xy</sub> = ' + nf(M.cov(SX, SY), 2) + ' > 0 → pozitif yön', son: true }], 1.6); }
      },
      {
        b: 'Pearson korelasyon katsayısı r', terim: [['Pearson korelasyon katsayısı', 'Pearson’s r']],
        t: '<p class="mono">r = s<sub>xy</sub> / (s<sub>x</sub> · s<sub>y</sub>), −1 ≤ r ≤ 1</p><p>Kovaryansı standart sapmalara bölerek birimden kurtuluruz. r = 1 tam pozitif, r = −1 tam negatif doğrusal ilişki; r ≈ 0 doğrusal ilişki yok.</p><p>Çalışma–not verisi: r = <b>' + nf(M.r(SX, SY), 3) + '</b> → çok güçlü pozitif ilişki.</p>',
        v: function () { return [-0.95, -0.5, 0, 0.5, 0.95].map(function (rr, j) { var r = IST.rng(40 + j), x = [], y = []; for (var i = 0; i < 30; i++) { var a = (r() + r() + r() - 1.5) * 2, b = (r() + r() + r() - 1.5) * 2; x.push(a); y.push(rr * a + Math.sqrt(1 - rr * rr) * b); } var s = ''; x.forEach(function (v, i) { s += '<circle class="pop" ' + d(j * 0.2 + i * 0.01) + ' cx="' + (50 + v * 14).toFixed(1) + '" cy="' + (55 - y[i] * 14).toFixed(1) + '" r="3" fill="' + PAL[j] + '"/>'; }); return '<div style="display:inline-block;width:20%;text-align:center">' + V.svg(100, 120, '<rect x="2" y="2" width="96" height="96" rx="8" fill="#fff" stroke="#0D1838"/>' + s + '<text class="lbb" x="50" y="116" text-anchor="middle">r = ' + nf(rr, 2) + '</text>', 'r = ' + rr) + '</div>'; }).join(''); }
      },
      {
        b: 'Belirlilik katsayısı r²', terim: [['belirlilik katsayısı', 'coefficient of determination r²']],
        t: '<p><b>r²</b>, y’deki değişkenliğin ne kadarının x ile doğrusal olarak açıklandığını gösterir.</p><p>Deniz derinliği ile yakalanan balık miktarı arasında r = 0,75 ise r² = 0,75² = <b>0,5625</b>: derinlik, balık miktarındaki değişkenliğin yalnızca <b>%56,25</b>’ini açıklıyor; kalan %43,75 başka etkenlerden (su sıcaklığı, mevsim…) kaynaklanıyor.</p>',
        v: function () { return V.svg(540, 150, '<rect class="gx" x="30" y="40" width="' + (480 * 0.5625) + '" height="50" fill="' + PAL[2] + '" stroke="#0D1838" stroke-width="2"/><rect class="gx" ' + d(0.4) + ' x="' + (30 + 480 * 0.5625) + '" y="40" width="' + (480 * 0.4375) + '" height="50" fill="#E6E0D2" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="40" y="70" style="fill:#fff">derinlik ile açıklanan %56,25</text><text class="lbb fd" ' + d(0.6) + ' x="' + (40 + 480 * 0.5625) + '" y="70">diğer etkenler %43,75</text><text class="lbl" x="30" y="120">r = 0,75 → r² = 0,5625</text>', 'açıklanan değişkenlik'); }
      },
      {
        b: 'Korelasyon anlamlı mı?', terim: [['korelasyon testi', 'test of correlation'], ['ρ (rho)', 'population correlation']],
        t: '<p>Örneklem r’si rastgele de sıfırdan farklı çıkabilir. H₀: ρ = 0 (anakütlede ilişki yok), H₁: ρ ≠ 0.</p><p class="mono">t = r·√(n − 2) / √(1 − r²), sd = n − 2</p><p>r = 0,75 ve n = 12 için: t = 0,75·√10 / √0,4375 = <b>3,59</b> &gt; t<sub>0,025; 10</sub> = 2,228 → <b>H₀ reddedilir</b>; ilişki anlamlı.</p>',
        v: function () { return V.tc({ v: 10, sh: [[-9, -2.228], [2.228, 9]], h: 220, xt: [[-2.228, '−2,228'], [0, '0'], [2.228, '2,228'], [3.59, '3,59']], extra: function (xs, ys) { return '<g class="pop" ' + d(1.3) + '><line x1="' + xs(3.59) + '" x2="' + xs(3.59) + '" y1="' + ys(0) + '" y2="30" stroke="#0D1838" stroke-width="2.5"/><text class="lbb" x="' + xs(3.59) + '" y="24" text-anchor="middle">t = 3,59</text></g>'; } }); }
      },
      {
        b: 'Korelasyon nedensellik değildir', terim: [['nedensellik', 'causation'], ['karıştırıcı değişken', 'confounding variable']],
        t: '<p>Yatırımcı John, S&amp;P 500 ile Apple hisse fiyatlarının 2013–2017 korelasyonunu <b>r ≈ 0,954</b> buldu: fiyatlar aynı yönde hareket ediyor. Bu bir <b>ilişkidir</b>, birinin diğerine neden olduğu anlamına gelmez.</p><p>Dondurma satışları ile boğulma vakaları da pozitif ilişkilidir; ikisinin ortak nedeni <b>sıcak hava</b>dır (karıştırıcı değişken). Ayrıca r yalnızca <b>doğrusal</b> ilişkiyi ölçer: U biçimli bir ilişkide r ≈ 0 çıkabilir.</p>',
        v: function () { return V.kart([{ ic: '🍦', b: 'Dondurma satışı', p: 'yazın artar' }, { ic: '☀️', b: 'Sıcak hava', en: 'ortak neden', p: 'ikisini birden etkiler' }, { ic: '🏊', b: 'Boğulma vakası', p: 'yazın artar' }]); }
      }
    ],
    gorsel: {
      b: 'Korelasyonu sürükle', t: 'Noktaları sürükle. Yeşil noktalar sapmaların çarpımına pozitif, kırmızılar negatif katkı yapıyor. r, r², kovaryans ve anlamlılık testi canlı hesaplanır. Tek bir noktayı uzağa çekip aykırı değerin r’yi nasıl değiştirdiğini gör.',
      kur: function (el) {
        var pts = SX.map(function (x, i) { return [x, SY[i]]; });
        el.innerHTML = '<div class="at-g"><div class="at-k"><div class="at-out" style="margin:0" data-o></div><div class="row"><button type="button" class="btn sm" data-r>çalışma–not verisi</button><button type="button" class="btn sm ghost" data-z>rastgele bulut</button><button type="button" class="btn sm ghost" data-u>U biçimli</button></div></div><div class="at-v"><div data-g></div><div class="at-not" data-n></div></div></div>';
        var on = function (p) {
          var x = p.map(function (q) { return q[0]; }), y = p.map(function (q) { return q[1]; }), n = p.length, rr = M.sdS(x) && M.sdS(y) ? M.r(x, y) : 0, t = rr * Math.sqrt(n - 2) / Math.sqrt(Math.max(1e-9, 1 - rr * rr)), tk = M.tkr(0.025, n - 2);
          el.querySelector('[data-o]').innerHTML = '<div><small>kovaryans</small><b>' + nf(M.cov(x, y), 1) + '</b></div><div><small>r</small><b>' + nf(rr, 3) + '</b></div><div><small>r²</small><b>' + nf(rr * rr, 3) + '</b></div><div><small>t (sd ' + (n - 2) + ')</small><b>' + nf(t, 2) + '</b></div>';
          el.querySelector('[data-n]').innerHTML = (Math.abs(rr) >= 0.8 ? 'Çok güçlü' : Math.abs(rr) >= 0.6 ? 'Güçlü' : Math.abs(rr) >= 0.4 ? 'Orta' : Math.abs(rr) >= 0.2 ? 'Zayıf' : 'Çok zayıf / yok') + (rr >= 0 ? ' pozitif' : ' negatif') + ' doğrusal ilişki. |t| ' + (Math.abs(t) > tk ? '> ' : '≤ ') + nf(tk, 3) + ' → ' + (Math.abs(t) > tk ? 'α = 0,05’te anlamlı.' : 'anlamlı değil.') + ' y’deki değişkenliğin %' + nf(rr * rr * 100, 1) + '’i x ile açıklanıyor.';
        };
        var g = serp(el.querySelector('[data-g]'), pts, [0, 100, 30, 100], { quad: true, xl: 'çalışma süresi (dk)', yl: 'sınav notu' }, on);
        var set = function (p) { pts.length = 0; p.forEach(function (q) { pts.push(q); }); g.draw(); on(pts); };
        el.querySelector('[data-r]').onclick = function () { set(SX.map(function (x, i) { return [x, SY[i]]; })); };
        el.querySelector('[data-z]').onclick = function () { var r = IST.rng((Math.random() * 1e9) | 0); set(SX.map(function () { return [r.int(10, 95), r.int(35, 95)]; })); };
        el.querySelector('[data-u]').onclick = function () { set([10, 20, 30, 40, 50, 60, 70, 80, 90, 95].map(function (x) { return [x, Math.round(40 + Math.pow(x - 52, 2) / 45)]; })); };
      }
    },
    sorular: function (r) {
      var out = [];
      var n = 5, x, y; do { x = []; y = []; var b = r.pick([1, -1]) * r.int(5, 15) / 10; for (var i = 0; i < n; i++) { var xi = r.int(1, 12); x.push(xi); y.push(Math.round(20 + b * xi + r.int(-4, 4))); } } while (M.sdS(x) === 0 || M.sdS(y) === 0);
      var rr = M.r(x, y);
      out.push({ tag: 'hesap', q: '<p>Beş mağazanın reklam harcaması (x, bin TL) ve satışları (y, bin adet):</p>', g: V.tablo(['x'].concat(x.map(String)), [['y'].concat(y.map(String))], { st: 0 }), wide: true, say: rr, goster: nf(rr, 3), tol: 0.0051, ornek: '0,954',
        ip: 'r = Σ(x − x̄)(y − ȳ) / √[Σ(x − x̄)² · Σ(y − ȳ)²].', cz: ['x̄ = ' + nf(M.mean(x), 2) + ', ȳ = ' + nf(M.mean(y), 2) + '.', 'Σ(x − x̄)(y − ȳ) = ' + nf(M.cov(x, y) * 4, 2) + '; Σ(x − x̄)² = ' + nf(M.varS(x) * 4, 2) + '; Σ(y − ȳ)² = ' + nf(M.varS(y) * 4, 2) + '.', 'r = <b>' + nf(rr, 3) + '</b>.'] });
      out[0].q += '<p>Pearson korelasyon katsayısı r kaçtır? (üç ondalık)</p>';
      var r2 = r.int(30, 95) / 100 * (r() < 0.5 ? -1 : 1);
      out.push({ tag: 'yorum', q: '<p>Bir çalışmada ürün fiyatı ile satış adedi arasında <b>r = ' + nf(r2, 2) + '</b> bulundu.</p><p>Satış adedindeki değişkenliğin yüzde kaçı fiyat ile açıklanır? (iki ondalık)</p>', say: r2 * r2 * 100, goster: '%' + nf(r2 * r2 * 100, 2), tol: 0.011, ornek: '56,25',
        yanlis: function (v) { return Math.abs(v - Math.abs(r2) * 100) < 0.02 ? 'Bu r’nin kendisi; açıklanan oran r²’dir.' : 'r²’yi yüzdeye çevir.'; },
        ip: 'Açıklanan oran = r² (işaret önemsiz).', cz: ['r² = (' + nf(r2, 2) + ')² = ' + nf(r2 * r2, 4) + '.', '%' + nf(r2 * r2 * 100, 2) + '.'] });
      var r3 = r.int(25, 90) / 100, n3 = r.int(8, 30), t3 = r3 * Math.sqrt(n3 - 2) / Math.sqrt(1 - r3 * r3);
      out.push({ tag: 'test', q: '<p>n = ' + n3 + ' gözlemde r = ' + nf(r3, 2) + ' bulundu. H₀: ρ = 0.</p><p>t test istatistiği kaçtır? (iki ondalık)</p>', say: t3, goster: nf(t3, 2), tol: 0.011, ornek: '3,59',
        ip: 't = r·√(n − 2)/√(1 − r²).', cz: ['√(' + n3 + ' − 2) = ' + nf(Math.sqrt(n3 - 2), 4) + ', √(1 − r²) = ' + nf(Math.sqrt(1 - r3 * r3), 4) + '.', 't = <b>' + nf(t3, 2) + '</b> (sd = ' + (n3 - 2) + ').'] });
      var yon = r.int(0, 2), xs = [], ys = []; for (i = 0; i < 14; i++) { var a = r.int(1, 30); xs.push(a); ys.push(Math.max(1, Math.round(yon === 0 ? 8 + a * 1.6 + (r() - 0.5) * 6 : yon === 1 ? 58 - a * 1.6 + (r() - 0.5) * 6 : 10 + r() * 45))); }
      var gr = M.r(xs, ys), ops = ['r ≈ ' + nf(0.9, 1) + ' (güçlü pozitif)', 'r ≈ −0,9 (güçlü negatif)', 'r ≈ 0 (doğrusal ilişki yok)'];
      out.push({ tag: 'grafik okuma', q: '<p>Yandaki serpilme grafiği için korelasyon katsayısı yaklaşık kaçtır?</p>', g: V.xy({ x: xs, y: ys, h: 220, xmin: 0, xmax: 31, ymax: 65 }), o: ops, a: yon, n: 'Gerçek değer r = ' + nf(gr, 2) + '.',
        ip: 'Noktalar bir doğru etrafında mı toplanıyor? Doğru yükseliyor mu, alçalıyor mu?', cz: ['Eğilim yönüne ve noktaların doğruya yakınlığına bak.', 'Hesaplanan r = <b>' + nf(gr, 2) + '</b>.'] });
      out.push({ tag: 'kavram', q: '<p>Bir şehirde dondurma satışları ile güneş yanığı vakaları arasında r = 0,88 bulundu. Hangisi <b>doğru</b> çıkarımdır?</p>', o: ['İki değişken güçlü pozitif ilişkili; ama bu, birinin diğerine neden olduğunu göstermez.', 'Dondurma yemek güneş yanığına neden olur.', 'Güneş yanığı vakalarının %88’i dondurmadan kaynaklanır.', 'r pozitif olduğu için ilişki doğrusal değildir.'], a: 0, n: 'Ortak neden (sıcak ve güneşli hava) her ikisini de artırıyor olabilir.', yn: { 1: 'Korelasyon nedensellik değildir.', 2: 'r bir yüzde değildir; r² bile “neden” oranı değildir.' },
        ip: 'Korelasyon ilişkiyi ölçer, nedeni değil. Üçüncü bir değişken olabilir mi?', cz: ['Karıştırıcı değişken: güneşli hava.', 'Doğru çıkarım: <b>ilişki var, nedensellik kanıtlanmadı</b>.'] });
      return out;
    }
  });

  /* ======================= BAHAR 10 ======================= */
  var REG = M.ls(EX, EY);
  IST.hafta({
    id: 'b10', no: 10, renk: '#0D5C8C', tr: 'Basit doğrusal regresyon', en: 'Regression Analysis',
    sahneler: [
      {
        b: 'Bağımlı ve bağımsız değişken', terim: [['bağımlı değişken', 'dependent variable y'], ['bağımsız değişken', 'independent variable x'], ['regresyon doğrusu', 'regression line ŷ = a + bx']],
        t: '<p>Korelasyon ilişkinin gücünü söyler; <b>regresyon</b> ilişkiyi bir denklemle ifade eder ve <b>tahmin</b> yapmamızı sağlar.</p><p>Bir araştırmacı, dört kişilik bir ailenin aylık elektrik tüketimini (y, kWh) evin büyüklüğüyle (x, m²) tahmin etmek istiyor. Büyük projeden önce 10 evle pilot çalışma yapıyor.</p><p class="mono">ŷ = a + b·x</p>',
        v: function () { return V.xy({ x: EX, y: EY, h: 270, xmin: 50, xmax: 180, ymin: 150, ymax: 420, xt: [[60, '60'], [100, '100'], [140, '140'], [180, '180']], xlab: 'ev büyüklüğü (m²)', ylab: 'tüketim (kWh)', stag: 0.1, fit: [REG.a, REG.b] }); }
      },
      {
        b: 'En küçük kareler yöntemi', terim: [['en küçük kareler', 'least squares'], ['eğim', 'slope b'], ['kesişim', 'intercept a']],
        t: '<p>Noktalara en iyi uyan doğru, <b>artıkların karelerinin toplamını</b> en küçük yapan doğrudur:</p><p class="mono">b = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)² &nbsp; a = ȳ − b·x̄</p><p>Elektrik verisi: b = <b>' + nf(REG.b, 3) + '</b>, a = <b>' + nf(REG.a, 2) + '</b>. Ev 1 m² büyüdükçe aylık tüketim ortalama ' + nf(REG.b, 2) + ' kWh artıyor.</p>',
        v: function () { return V.fx([{ s: 'ortalamalar', h: 'x̄ = ' + nf(REG.mx, 1) + ' · ȳ = ' + nf(REG.my, 1) }, { s: 'çarpımlar ve kareler toplamı', h: 'S<sub>xy</sub> = ' + nf(REG.sxy, 1) + ' · S<sub>xx</sub> = ' + nf(REG.sxx, 1) }, { s: 'eğim', h: 'b = ' + nf(REG.sxy, 1) + ' / ' + nf(REG.sxx, 1) + ' = <b>' + nf(REG.b, 3) + '</b>' }, { s: 'kesişim', h: 'a = ' + nf(REG.my, 1) + ' − ' + nf(REG.b, 3) + ' × ' + nf(REG.mx, 1) + ' = <b>' + nf(REG.a, 2) + '</b>', son: true }], 0.2, 0.6); }
      },
      {
        b: 'Tahmin ve artıklar', terim: [['tahmin', 'prediction ŷ'], ['artık', 'residual e = y − ŷ']],
        t: '<p>120 m²’lik bir ev için tahmin: ŷ = ' + nf(REG.a, 2) + ' + ' + nf(REG.b, 3) + ' × 120 = <b>' + nf(REG.a + REG.b * 120, 1) + ' kWh</b>. Gerçek değer 300 → artık e = 300 − ' + nf(REG.a + REG.b * 120, 1) + ' = <b>' + nf(300 - REG.a - REG.b * 120, 1) + '</b>.</p><p>Dikkat: tahminleri veri aralığının (60–170 m²) dışına taşımak (<b>dışdeğerleme</b>) risklidir.</p>',
        v: function () { return V.xy({ x: EX, y: EY, h: 280, xmin: 50, xmax: 180, ymin: 150, ymax: 420, xt: [[60, '60'], [100, '100'], [140, '140'], [180, '180']], fit: [REG.a, REG.b], stag: 0.05 }).replace('</svg>', EX.map(function (x, i) { var X0 = 54 + (x - 50) / 130 * 444, y1 = 226 - (EY[i] - 150) / 270 * 208, y2 = 226 - (REG.a + REG.b * x - 150) / 270 * 208; return '<line class="fd" ' + d(1.6 + i * 0.05) + ' x1="' + X0.toFixed(1) + '" x2="' + X0.toFixed(1) + '" y1="' + y1.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#C8553D" stroke-width="2"/>'; }).join('') + '</svg>'); }
      },
      {
        b: 'Modelin açıklama gücü: r² ve standart hata', terim: [['kareler toplamları', 'SST = SSR + SSE'], ['tahminin standart hatası', 'standard error of estimate s_e']],
        t: '<p class="mono">SST = SSR + SSE &nbsp; r² = SSR / SST &nbsp; s<sub>e</sub> = √(SSE / (n − 2))</p><p>Elektrik modelinde r² = <b>' + nf(Math.pow(M.r(EX, EY), 2), 3) + '</b>: tüketimdeki değişkenliğin %' + nf(Math.pow(M.r(EX, EY), 2) * 100, 1) + '’i ev büyüklüğüyle açıklanıyor. s<sub>e</sub>, tahminlerin tipik olarak ne kadar şaştığını (kWh cinsinden) gösterir.</p>',
        v: function () { var yh = EX.map(function (x) { return REG.a + REG.b * x; }), sse = M.sum(EY.map(function (y, i) { return Math.pow(y - yh[i], 2); })), sst = M.sum(EY.map(function (y) { return Math.pow(y - REG.my, 2); })); return V.fx([{ s: 'toplam', h: 'SST = ' + nf(sst, 1) }, { s: 'açıklanamayan', h: 'SSE = ' + nf(sse, 1) }, { s: 'açıklanan', h: 'SSR = ' + nf(sst - sse, 1) }, { s: 'sonuç', h: 'r² = ' + nf((sst - sse) / sst, 3) + ' · s<sub>e</sub> = ' + nf(Math.sqrt(sse / 8), 2) + ' kWh', son: true }], 0.2, 0.5); }
      },
      {
        b: 'Eğim anlamlı mı?', terim: [['eğim için t testi', 't test for the slope']],
        t: '<p>H₀: β = 0 (x, y’yi doğrusal olarak etkilemez). Test istatistiği:</p><p class="mono">t = b / s<sub>b</sub>, s<sub>b</sub> = s<sub>e</sub> / √S<sub>xx</sub>, sd = n − 2</p><p>Hesaplanan t, t<sub>α/2; n−2</sub> tablosu değerini aşıyorsa eğim anlamlıdır. Basit regresyonda bu test, korelasyon testiyle aynı sonucu verir.</p>',
        v: function () { var yh = EX.map(function (x) { return REG.a + REG.b * x; }), se = Math.sqrt(M.sum(EY.map(function (y, i) { return Math.pow(y - yh[i], 2); })) / 8), sb = se / Math.sqrt(REG.sxx), t = REG.b / sb; return V.fx([{ s: 'eğimin standart hatası', h: 's<sub>b</sub> = ' + nf(se, 2) + ' / √' + nf(REG.sxx, 1) + ' = ' + nf(sb, 4) }, { s: 'test istatistiği', h: 't = ' + nf(REG.b, 3) + ' / ' + nf(sb, 4) + ' = <b>' + nf(t, 2) + '</b> > t<sub>0,025; 8</sub> = 2,306', son: true }], 0.2); }
      },
      {
        b: 'Ters soru: y biliniyorsa x?', terim: [['ters tahmin', 'inverse prediction']],
        t: '<p>Notlardaki gibi bir soru: bağımlı değişken için yeni bir gözlem ölçülmüş; bağımsız değişkenin değeri ne olmalı?</p><p class="mono">x = (y − a) / b</p><p>Aylık tüketimi 330 kWh olan bir ev için: x = (330 − ' + nf(REG.a, 2) + ') / ' + nf(REG.b, 3) + ' = <b>' + nf((330 - REG.a) / REG.b, 1) + ' m²</b>.</p>',
        v: function () { var x0 = (330 - REG.a) / REG.b; return V.xy({ x: EX, y: EY, h: 270, xmin: 50, xmax: 180, ymin: 150, ymax: 420, xt: [[60, '60'], [100, '100'], [140, '140'], [180, '180']], fit: [REG.a, REG.b], renk: '#CFC6B3' }).replace('</svg>', '<g class="an" ' + d(1.6) + '><line x1="46" x2="' + (54 + (x0 - 50) / 130 * 444).toFixed(1) + '" y1="' + (226 - (330 - 150) / 270 * 208).toFixed(1) + '" y2="' + (226 - (330 - 150) / 270 * 208).toFixed(1) + '" stroke="#E0A526" stroke-width="2.5" stroke-dasharray="6 4"/><line x1="' + (54 + (x0 - 50) / 130 * 444).toFixed(1) + '" x2="' + (54 + (x0 - 50) / 130 * 444).toFixed(1) + '" y1="' + (226 - (330 - 150) / 270 * 208).toFixed(1) + '" y2="226" stroke="#E0A526" stroke-width="2.5" stroke-dasharray="6 4"/><text class="lbb" x="' + (58 + (x0 - 50) / 130 * 444).toFixed(1) + '" y="218">x ≈ ' + nf(x0, 1) + '</text></g></svg>'); }
      }
    ],
    gorsel: {
      b: 'En küçük kareler oyunu', t: 'Noktaları sürükle; en küçük kareler doğrusu (mavi) ve artıkların kareleri anında güncellenir. “Kendi doğrun” sürgüleriyle bir doğru çiz ve SSE’ni en iyi doğrunun SSE’siyle karşılaştır: daha küçüğünü bulamazsın!',
      kur: function (el) {
        var pts = EX.map(function (x, i) { return [x, EY[i]]; }), a = 100, b = 1.5;
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>senin kesişimin a <output data-ao>100</output></span><input type="range" min="-100" max="300" value="100" data-a></label><label><span>senin eğimin b <output data-bo>1,5</output></span><input type="range" min="-1" max="4" step="0.05" value="1.5" data-b></label><div class="at-out" style="margin:0" data-o></div></div><div class="at-v"><div data-g></div><div class="at-not" data-n></div></div></div>';
        var cur = pts;
        var on = function (p) {
          cur = p; var x = p.map(function (q) { return q[0]; }), y = p.map(function (q) { return q[1]; }), f = M.ls(x, y), sse = M.sum(y.map(function (v, i) { return Math.pow(v - f.a - f.b * x[i], 2); })), my = M.sum(y.map(function (v, i) { return Math.pow(v - a - b * x[i], 2); })), sst = M.sum(y.map(function (v) { return Math.pow(v - f.my, 2); }));
          el.querySelector('[data-o]').innerHTML = '<div><small>EKK: ŷ = a + bx</small><b style="font-size:13px">' + nf(f.a, 1) + ' + ' + nf(f.b, 3) + 'x</b></div><div><small>EKK SSE</small><b>' + nf(sse, 0) + '</b></div><div><small>senin SSE</small><b style="color:' + (my <= sse * 1.02 ? 'var(--ok)' : 'var(--bad)') + '">' + nf(my, 0) + '</b></div><div><small>r²</small><b>' + nf(1 - sse / sst, 3) + '</b></div>';
          el.querySelector('[data-n]').innerHTML = 'Senin doğrunun SSE’si en iyi doğrununkinin ' + nf(my / sse, 2) + ' katı. ' + (my <= sse * 1.02 ? 'Neredeyse en küçük kareler doğrusunu buldun!' : 'a ve b’yi ' + nf(f.a, 1) + ' ve ' + nf(f.b, 3) + ' değerlerine yaklaştırmayı dene.');
        };
        var g = serp(el.querySelector('[data-g]'), pts, [40, 190, 100, 460], { xl: 'ev büyüklüğü (m²)', yl: 'tüketim (kWh)', extra: function (xs, ys, p) { var x = p.map(function (q) { return q[0]; }), y = p.map(function (q) { return q[1]; }), f = M.ls(x, y), s = ''; p.forEach(function (q) { var yh = f.a + f.b * q[0], h = Math.abs(ys(q[1]) - ys(yh)); s += '<rect x="' + xs(q[0]) + '" y="' + Math.min(ys(q[1]), ys(yh)) + '" width="' + Math.min(h, 60) + '" height="' + h + '" fill="#C8553D" fill-opacity=".14" stroke="#C8553D" stroke-width=".8"/>'; }); s += '<line x1="' + xs(40) + '" x2="' + xs(190) + '" y1="' + ys(f.a + f.b * 40) + '" y2="' + ys(f.a + f.b * 190) + '" stroke="' + PAL[0] + '" stroke-width="3"/><line x1="' + xs(40) + '" x2="' + xs(190) + '" y1="' + ys(a + b * 40) + '" y2="' + ys(a + b * 190) + '" stroke="#E0A526" stroke-width="3" stroke-dasharray="7 5"/>'; return s; } }, on);
        el.querySelector('[data-a]').oninput = function () { a = +this.value; el.querySelector('[data-ao]').textContent = a; g.draw(); on(cur); };
        el.querySelector('[data-b]').oninput = function () { b = +this.value; el.querySelector('[data-bo]').textContent = nf(b, 2); g.draw(); on(cur); };
      }
    },
    sorular: function (r) {
      var out = [];
      var n = 5, x, y; do { x = []; y = []; for (var i = 0; i < n; i++) { var xi = r.int(1, 15); x.push(xi); y.push(Math.round(10 + 2.5 * xi + r.int(-5, 5))); } } while (M.sdS(x) === 0);
      var f = M.ls(x, y), tb = V.tablo(['x'].concat(x.map(String)), [['y'].concat(y.map(String))], { st: 0 });
      out.push({ tag: 'eğim', q: '<p>Bir kafede günlük reklam harcaması (x, yüz TL) ve kahve satışı (y, düzine):</p><p>En küçük kareler doğrusunun <b>eğimi b</b> kaçtır? (üç ondalık)</p>', g: tb, wide: true, say: f.b, goster: nf(f.b, 3), tol: 0.0021, ornek: '2,15',
        ip: 'b = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)².', cz: ['x̄ = ' + nf(f.mx, 2) + ', ȳ = ' + nf(f.my, 2) + '.', 'S<sub>xy</sub> = ' + nf(f.sxy, 2) + ', S<sub>xx</sub> = ' + nf(f.sxx, 2) + '.', 'b = <b>' + nf(f.b, 3) + '</b>.'] });
      out.push({ tag: 'kesişim', q: '<p>Aynı veri için <b>kesişim a</b> kaçtır? (iki ondalık)</p>', g: tb, wide: true, say: f.a, goster: nf(f.a, 2), tol: 0.011, ornek: '12,4',
        ip: 'a = ȳ − b·x̄.', cz: ['b = ' + nf(f.b, 4) + '.', 'a = ' + nf(f.my, 2) + ' − ' + nf(f.b, 4) + ' × ' + nf(f.mx, 2) + ' = <b>' + nf(f.a, 2) + '</b>.'] });
      var A = r.int(50, 200), B = r.int(5, 40) / 10, x3 = r.int(20, 120), yh = A + B * x3;
      out.push({ tag: 'tahmin', q: '<p>Bir otelin aylık enerji gideri (bin TL) doluluk oranına (x, %) göre şu modelle tahmin ediliyor: <b>ŷ = ' + A + ' + ' + nf(B, 1) + 'x</b>.</p><p>Doluluk %' + x3 + ' iken tahmini gider kaçtır? (bir ondalık)</p>', say: yh, goster: nf(yh, 1), tol: 0.06, ornek: '300,5',
        ip: 'x’i denklemde yerine koy.', cz: ['ŷ = ' + A + ' + ' + nf(B, 1) + ' × ' + x3 + '.', '= <b>' + nf(yh, 1) + '</b>.'] });
      var A4 = r.int(10, 80), B4 = r.int(5, 30) / 10, y4 = Math.round(A4 + B4 * r.int(10, 60)), x4 = (y4 - A4) / B4;
      out.push({ tag: 'ters soru', q: '<p>Regresyon denklemi <b>ŷ = ' + A4 + ' + ' + nf(B4, 1) + 'x</b>. Bağımlı değişken için yeni bir gözlem <b>' + y4 + '</b> olarak ölçüldü.</p><p>Bağımsız değişkenin değeri kaç olmalıdır? (iki ondalık)</p>', say: x4, goster: nf(x4, 2), tol: 0.011, ornek: '27,5',
        ip: 'x = (y − a)/b.', cz: ['x = (' + y4 + ' − ' + A4 + ') / ' + nf(B4, 1) + '.', '= <b>' + nf(x4, 2) + '</b>.'] });
      var sst = r.int(800, 5000), sse = Math.round(sst * r.int(10, 60) / 100), r2 = (sst - sse) / sst;
      out.push({ tag: 'r²', q: '<p>Bir regresyon analizinde SST = ' + sst + ', SSE = ' + sse + '.</p><p>Belirlilik katsayısı r² kaçtır? (dört ondalık)</p>', say: r2, goster: nf(r2, 4), tol: 0.0006, ornek: '0,8125',
        yanlis: function (v) { return Math.abs(v - sse / sst) < 0.001 ? 'Bu açıklanamayan oran (SSE/SST); r² = 1 − SSE/SST.' : 'r² = SSR/SST.'; },
        ip: 'SSR = SST − SSE; r² = SSR/SST.', cz: ['SSR = ' + sst + ' − ' + sse + ' = ' + (sst - sse) + '.', 'r² = ' + (sst - sse) + ' / ' + sst + ' = <b>' + nf(r2, 4) + '</b>.'] });
      return out;
    }
  });

  /* ======================= BAHAR 11 ======================= */
  var MEV = [['Kış', 28], ['İlkbahar', 20], ['Yaz', 32], ['Sonbahar', 40]];
  var c2 = function (O, E) { return M.sum(O.map(function (o, i) { return (o - E[i]) * (o - E[i]) / E[i]; })); };
  IST.hafta({
    id: 'b11', no: 11, renk: '#6B4FB3', tr: 'Parametrik olmayan testler I: binom, işaret ve ki-kare', en: 'Non-Parametric Statistics I',
    sahneler: [
      {
        b: 'Parametrik olmayan testler ne zaman?', terim: [['parametrik olmayan', 'non-parametric'], ['dağılımdan bağımsız', 'distribution-free']],
        t: '<p>t, z ve F testleri anakütlenin dağılımı hakkında varsayımlar yapar (normallik, eşit varyans) ve nicel veri ister.</p><p><b>Parametrik olmayan testler</b> bu varsayımlara ihtiyaç duymaz: veri sıralama ya da sınıflama ölçeğindeyse, örneklem küçükse veya dağılım normal değilse kullanılır. Bedeli: varsayımlar sağlandığında parametrik testlerden biraz daha <b>az güçlüdürler</b>.</p>',
        v: function () { return V.tablo(['Parametrik test', 'Parametrik olmayan karşılığı'], [['Tek örneklem t', 'İşaret testi · Wilcoxon işaretli sıra'], ['Eşleştirilmiş t', 'İşaret testi · Wilcoxon işaretli sıra'], ['İki bağımsız örneklem t', 'Wilcoxon sıra toplamı (Mann–Whitney)'], ['Tek yönlü ANOVA', 'Kruskal–Wallis'], ['Pearson r', 'Spearman sıra korelasyonu'], ['Oran z testi', 'Binom testi · ki-kare uyum iyiliği']], { st: 0.18 }); }
      },
      {
        b: 'Binom testi', terim: [['binom testi', 'binomial test']],
        t: '<p>Rastgele 20 kişiden <b>15’i</b> yoksulluk sınırının altında yaşıyor. Planlamacı bu oranın yarıdan fazla olduğunu düşünüyor: H₀: p = 0,5, H₁: p &gt; 0,5, α = 0,05.</p><p>H₀ doğruyken X ~ B(20; 0,5). p-değeri = P(X ≥ 15) = <b>0,0207</b> &lt; 0,05 → <b>H₀ reddedilir</b>: oran yarıdan büyük.</p>',
        v: function () { var ps = []; for (var x = 0; x <= 20; x++) ps.push(M.binom(x, 20, 0.5)); return V.bars({ x: ps.map(function (_, i) { return String(i); }), y: ps, h: 250, max: 0.2, val: false, hi: [15, 16, 17, 18, 19, 20], fmt: function (v) { return nf(v, 2); }, renk: PAL[4], gap: 0.12, xlab: 'X ~ B(20; 0,5) · turuncu: X ≥ 15 → p = 0,0207' }); }
      },
      {
        b: 'İşaret testi', terim: [['işaret testi', 'sign test'], ['medyan', 'median']],
        t: '<p>Adını farkların <b>+ ve − işaretlerinden</b> alır. Tek örneklem t testinin, eşleştirilmiş t testinin ya da yalnızca sıralanabilen ölçümlerin alternatifidir.</p><p>Yeni ambalajı 10 müşteri eskisiyle karşılaştırıyor: 8 kişi “yeni daha iyi” (+), 2 kişi “eski daha iyi” (−). H₀ doğruysa + sayısı ~ B(10; 0,5). P(X ≥ 8) = <b>0,0547</b> &gt; 0,05 → H₀ reddedilmez (sınırda). Eşitlikler (0 fark) atılır.</p>',
        v: function () { var s = '', sg = ['+', '+', '−', '+', '+', '+', '−', '+', '+', '+']; sg.forEach(function (g, i) { s += '<g class="pop" ' + d(i * 0.12) + '><circle cx="' + (40 + i * 50) + '" cy="60" r="20" fill="' + (g === '+' ? PAL[2] : PAL[1]) + '" stroke="#0D1838" stroke-width="2"/><text x="' + (40 + i * 50) + '" y="68" text-anchor="middle" fill="#fff" font-size="24" font-weight="800">' + g + '</text></g>'; }); s += '<text class="lbb fd" ' + d(1.4) + ' x="270" y="120" text-anchor="middle">8 artı, 2 eksi → P(X ≥ 8 | n = 10, p = 0,5) = 0,0547</text>'; return V.svg(540, 140, s, 'işaretler'); }
      },
      {
        b: 'Ki-kare uyum iyiliği testi', terim: [['uyum iyiliği', 'goodness of fit'], ['gözlenen / beklenen frekans', 'observed O / expected E']],
        t: '<p>Veri belirli bir dağılıma uyuyor mu? Bir firma satış şikâyetlerinin <b>mevsimlere eşit</b> dağıldığını (düzgün dağılım) iddia ediyor. 120 şikâyet: kış 28, ilkbahar 20, yaz 32, sonbahar 40. Her mevsim için E = 120/4 = 30.</p><p class="mono">χ² = Σ(O − E)² / E, sd = k − 1</p><p>χ² = (4 + 100 + 4 + 100)/30 = <b>6,93</b> &lt; χ²<sub>0,05; 3</sub> = 7,815 → <b>H₀ reddedilmez</b>.</p>',
        v: function () { var O = MEV.map(function (m) { return m[1]; }), s = '', ys = V.sc(0, 45, 220, 20); s += V.axes({}, 46, 520, 220, 20, 45, function (v) { return nf(v, 0); }, 3); MEV.forEach(function (m, i) { var x = 80 + i * 112; s += '<rect class="gy" ' + d(i * 0.15) + ' x="' + x + '" y="' + ys(m[1]) + '" width="50" height="' + (220 - ys(m[1])) + '" fill="' + PAL[i] + '" stroke="#0D1838"/><text class="lbm fd" ' + d(0.6 + i * 0.15) + ' x="' + (x + 25) + '" y="' + (ys(m[1]) - 5) + '" text-anchor="middle">' + m[1] + '</text><text class="lbl" x="' + (x + 25) + '" y="238" text-anchor="middle">' + m[0] + '</text><text class="lbm fd" ' + d(1.2 + i * 0.15) + ' x="' + (x + 25) + '" y="252" text-anchor="middle" style="fill:#C8553D">' + nf(Math.pow(m[1] - 30, 2) / 30, 2) + '</text>'; }); s += '<line class="an" ' + d(0.9) + ' x1="60" x2="520" y1="' + ys(30) + '" y2="' + ys(30) + '" stroke="#C8553D" stroke-width="2.5" stroke-dasharray="7 5"/><text class="lbb" x="516" y="' + (ys(30) - 6) + '" text-anchor="end" style="fill:#C8553D">E = 30</text>'; return V.svg(540, 262, s, 'mevsimlere göre şikâyetler') + V.fx([{ s: 'kırmızı sayıların toplamı', h: 'χ² = 0,13 + 3,33 + 0,13 + 3,33 = <b>6,93</b> < 7,815', son: true }], 1.8); }
      },
      {
        b: 'Ki-kare bağımsızlık testi', terim: [['bağımsızlık testi', 'test of independence'], ['çapraz tablo', 'contingency table']],
        t: '<p>İki nitel değişken bağımsız mı? H₀: bağımsız. Her hücre için beklenen frekans:</p><p class="mono">E = (satır toplamı × sütun toplamı) / genel toplam<br>χ² = Σ(O − E)²/E, sd = (r − 1)(c − 1)</p><p>3. haftadaki tablo: kadın/erkek × evet/hayır (60, 115; 110, 115). E(kadın, evet) = 175 · 170 / 400 = <b>74,4</b>. χ² = <b>8,59</b> &gt; χ²<sub>0,05; 1</sub> = 3,841 → cinsiyet ile cevap <b>bağımlı</b>.</p>',
        v: function () { var O = [[60, 115], [110, 115]], R = [175, 225], C = [170, 230], E = O.map(function (r, i) { return r.map(function (_, j) { return R[i] * C[j] / 400; }); }); return V.tablo(['', 'Evet', 'Hayır', 'Toplam'], [['Kadın', '60 <small>(E ' + nf(E[0][0], 1) + ')</small>', '115 <small>(E ' + nf(E[0][1], 1) + ')</small>', '175'], ['Erkek', '110 <small>(E ' + nf(E[1][0], 1) + ')</small>', '115 <small>(E ' + nf(E[1][1], 1) + ')</small>', '225'], ['Toplam', '170', '230', '400']], { st: 0.3, n: [1, 2, 3] }) + V.fx([{ s: 'ki-kare', h: 'χ² = ' + nf(c2([60, 115, 110, 115], [E[0][0], E[0][1], E[1][0], E[1][1]]), 2) + ' > 3,841 → bağımlı', son: true }], 1.2); }
      }
    ],
    gorsel: {
      b: 'Ki-kare uyum iyiliği laboratuvarı', t: 'Mevsimlere göre gözlenen şikâyet sayılarını sürgülerle değiştir. Her hücrenin χ²’ye katkısı ve toplam χ², ki-kare eğrisi üzerinde kritik değerle karşılaştırılır.',
      kur: function (el) {
        var O = MEV.map(function (m) { return m[1]; });
        el.innerHTML = '<div class="at-g"><div class="at-k">' + MEV.map(function (m, i) { return '<label><span>' + m[0] + ' <output data-o' + i + '>' + m[1] + '</output></span><input type="range" min="0" max="80" value="' + m[1] + '" data-i="' + i + '"></label>'; }).join('') + '<button type="button" class="btn sm" data-e>hepsini eşitle</button></div><div class="at-v"><div data-b></div><div data-c></div><div class="at-not" data-n></div></div></div>';
        var draw = function () {
          var n = M.sum(O), E = O.map(function () { return n / 4; }), x2 = n ? c2(O, E) : 0, kr = M.c2kr(0.05, 3), p = 1 - M.c2cdf(x2, 3);
          var mx = V.nice(Math.max.apply(null, O.concat([n / 4])) * 1.15), ys = V.sc(0, mx, 170, 18), s = V.axes({}, 46, 520, 170, 18, mx, function (v) { return nf(v, 0); });
          MEV.forEach(function (m, i) { var x = 80 + i * 112, k = E[i] ? Math.pow(O[i] - E[i], 2) / E[i] : 0; s += '<rect x="' + x + '" y="' + ys(O[i]) + '" width="50" height="' + (170 - ys(O[i])) + '" fill="' + PAL[i] + '" stroke="#0D1838"/><text class="lbl" x="' + (x + 25) + '" y="186" text-anchor="middle">' + m[0] + '</text><text class="lbm" x="' + (x + 25) + '" y="200" text-anchor="middle" style="fill:#C8553D">+' + nf(k, 2) + '</text>'; });
          s += '<line x1="60" x2="520" y1="' + ys(n / 4) + '" y2="' + ys(n / 4) + '" stroke="#C8553D" stroke-width="2.5" stroke-dasharray="7 5"/><text class="lbb" x="516" y="' + (ys(n / 4) - 6) + '" text-anchor="end" style="fill:#C8553D">E = ' + nf(n / 4, 1) + '</text>';
          el.querySelector('[data-b]').innerHTML = V.svg(540, 206, s, 'gözlenen ve beklenen');
          el.querySelector('[data-c]').innerHTML = V.curve({ f: function (x) { return M.c2pdf(x, 3); }, a: 0, b: 25, ymax: 0.27, sh: [kr, 99], shc: PAL[1], h: 170, d: -2, xt: [[0, '0'], [kr, nf(kr, 3)], [25, '25']], renk: PAL[4], extra: function (xs, ys, y0) { var xx = Math.min(25, x2); return '<line x1="' + xs(xx) + '" x2="' + xs(xx) + '" y1="' + y0 + '" y2="20" stroke="#0D1838" stroke-width="2.5"/><text class="lbb" x="' + xs(xx) + '" y="16" text-anchor="middle">χ² = ' + nf(x2, 2) + '</text>'; } });
          el.querySelector('[data-n]').innerHTML = 'n = ' + n + ', χ² = ' + nf(x2, 3) + ', sd = 3, p = ' + nf(p, 4) + ' → ' + (x2 > kr ? '<b style="color:#C8553D">H₀ reddedilir</b>: şikâyetler mevsimlere eşit dağılmıyor.' : '<b style="color:#1F8A7A">H₀ reddedilmez</b>: eşit dağılımdan sapma rastlantısal olabilir.') + (n / 4 < 5 ? ' Uyarı: beklenen frekanslar 5’ten küçük; test güvenilir değil.' : '');
          O.forEach(function (o, i) { el.querySelector('[data-o' + i + ']').textContent = o; });
        };
        [].forEach.call(el.querySelectorAll('[data-i]'), function (s) { s.oninput = function () { O[+s.getAttribute('data-i')] = +s.value; draw(); }; });
        el.querySelector('[data-e]').onclick = function () { var m = Math.round(M.sum(O) / 4); O = O.map(function () { return m; }); [].forEach.call(el.querySelectorAll('[data-i]'), function (s) { s.value = m; }); draw(); };
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var n = r.int(10, 20), x = r.int(Math.ceil(n * 0.65), n - 1), p = 0; for (var k = x; k <= n; k++) p += M.binom(k, n, 0.5);
      out.push({ tag: 'binom testi', q: '<p>Bir kafede rastgele ' + n + ' müşterinin <b>' + x + '</b>’i yeni tatlıyı eskisine tercih etti. H₀: p = 0,5, H₁: p > 0,5.</p><p>p-değeri P(X ≥ ' + x + ') kaçtır? (dört ondalık)</p>', say: p, goster: nf(p, 4), tol: 0.0006, ornek: '0,0207',
        ip: 'H₀ altında X ~ B(' + n + '; 0,5). P(X ≥ ' + x + ') = Σ C(' + n + ', k)·0,5^' + n + ', k = ' + x + '…' + n + '.', cz: ['0,5^' + n + ' = ' + nf(Math.pow(0.5, n), 7) + '.', 'Σ C(' + n + ', k) (k = ' + x + '…' + n + ') = ' + Math.round(p / Math.pow(0.5, n)) + '.', 'p = <b>' + nf(p, 4) + '</b>.'] });
      var nn = r.int(8, 14), pl = r.int(Math.ceil(nn / 2) + 1, nn - 1), ps = 0; for (k = pl; k <= nn; k++) ps += M.binom(k, nn, 0.5);
      out.push({ tag: 'işaret testi', q: '<p>' + (nn + 2) + ' çalışanın eğitim öncesi ve sonrası verimlilik puanları karşılaştırıldı. ' + pl + ' çalışanda artış (+), ' + (nn - pl) + ' çalışanda düşüş (−), 2 çalışanda değişiklik yok.</p><p>Tek yönlü işaret testi için p-değeri kaçtır? (dört ondalık)</p>', say: ps, goster: nf(ps, 4), tol: 0.0006, ornek: '0,0547',
        yanlis: function (v) { var q = 0; for (var j = pl; j <= nn + 2; j++) q += M.binom(j, nn + 2, 0.5); return Math.abs(v - q) < 0.001 ? 'Değişmeyen (0 fark) gözlemler atılır; n = ' + nn + '.' : 'X ~ B(' + nn + '; 0,5), P(X ≥ ' + pl + ').'; },
        ip: 'Sıfır farkları at: n = ' + nn + '. + sayısı H₀ altında B(n; 0,5).', cz: ['n = ' + nn + ', + sayısı = ' + pl + '.', 'p = P(X ≥ ' + pl + ') = <b>' + nf(ps, 4) + '</b>.'] });
      var k3 = r.int(3, 5), O = [], tot = 0; for (k = 0; k < k3; k++) { O.push(r.int(10, 40)); } tot = M.sum(O); var E = tot / k3, x2 = c2(O, O.map(function () { return E; }));
      out.push({ tag: 'uyum iyiliği', q: '<p>Bir web sitesinde ' + k3 + ' farklı ödeme yönteminin eşit sıklıkta seçildiği iddia ediliyor. Gözlenen frekanslar: <b class="mono">' + O.join(', ') + '</b>.</p><p>χ² istatistiği kaçtır? (iki ondalık)</p>', say: x2, goster: nf(x2, 2), tol: 0.011, ornek: '6,93',
        ip: 'Eşit dağılım: E = n/k. χ² = Σ(O − E)²/E.', cz: ['n = ' + tot + ', E = ' + nf(E, 2) + '.', 'Katkılar: ' + O.map(function (o) { return nf(Math.pow(o - E, 2) / E, 3); }).join(' + ') + '.', 'χ² = <b>' + nf(x2, 2) + '</b> (sd = ' + (k3 - 1) + ').'] });
      var df = r.int(1, 6), A = r.pick([0.05, 0.01, 0.1]), kr = M.c2kr(A, df);
      out.push({ tag: 'tablo okuma', q: '<p>Bir ki-kare testinde sd = <b>' + df + '</b>, α = <b>' + nf(A, 2) + '</b>.</p><p>Kritik değer kaçtır? (üç ondalık)</p>', g: IST.c2tab([1, 2, 3, 4, 5, 6]), wide: true, say: kr, goster: nf(kr, 3), tol: 0.0021, ornek: '7,815',
        ip: 'Satır sd = ' + df + ', sütun α = ' + nf(A, 2) + '.', cz: ['Tabloda (sd ' + df + ', α ' + nf(A, 2) + ') kesişimi.', 'χ²<sub>kr</sub> = <b>' + nf(kr, 3) + '</b>.'] });
      var a = r.int(20, 80), b = r.int(20, 80), c = r.int(20, 80), e = r.int(20, 80), Tt = a + b + c + e, rr = r.int(0, 1), cc = r.int(0, 1), Rs = rr ? c + e : a + b, Cs = cc ? b + e : a + c, Ev = Rs * Cs / Tt;
      out.push({ tag: 'bağımsızlık', q: '<p>Bir mağazada müşteri türü ile ödeme yöntemi çapraz tablosu yanda. Bağımsızlık testi için <b>' + (rr ? 'Kurumsal' : 'Bireysel') + ' × ' + (cc ? 'Havale' : 'Kart') + '</b> hücresinin <b>beklenen frekansı</b> kaçtır? (iki ondalık)</p>', g: V.tablo(['', 'Kart', 'Havale', 'Toplam'], [['Bireysel', String(a), String(b), String(a + b)], ['Kurumsal', String(c), String(e), String(c + e)], ['Toplam', String(a + c), String(b + e), String(Tt)]], { n: [1, 2, 3], st: 0 }), say: Ev, goster: nf(Ev, 2), tol: 0.011, ornek: '74,38',
        ip: 'E = satır toplamı × sütun toplamı / genel toplam.', cz: ['Satır toplamı ' + Rs + ', sütun toplamı ' + Cs + ', genel ' + Tt + '.', 'E = ' + Rs + ' × ' + Cs + ' / ' + Tt + ' = <b>' + nf(Ev, 2) + '</b>.'] });
      return out;
    }
  });
})();
