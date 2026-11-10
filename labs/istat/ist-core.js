/* ==========================================================================
   ACADEX İSTATİSTİK · giriş dersi çekirdeği (labs/istat/ist-core.js), 11.11.2026
   Haftalık ders yolu (Statistics for Business I, güz). Her hafta bir ders:
     1) anlatım: animasyonlu sahneler (metin + SVG; ↻ ile yeniden oynar)
     2) görsel: etkileşimli atölye (sürgü, sürükle, seç)
     3) yeni nesil sorular: senaryo/grafik/tablo; sayılar her sette yeniden üretilir,
        ipucu ve adım adım çözüm vardır.
   Haftalar ist-h*.js dosyalarında IST.hafta({...}) ile kaydolur.
   İlerleme: localStorage 'acadex.istat.v1' → { g3: { a:1, g:1, s:80 }, last:'g3' }.
   Acadex içinde (?hub=1) iframe olarak açılır: axhost 'tab' mesajıyla hafta değişir,
   her değişimde Acadia'ya bağlam (ctx) ve panoya 'progress' yollanır.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document;
  var IST = W.IST = { H: [], by: {} };
  IST.hafta = function (h) { h.donem = h.donem || (h.id.charAt(0) === 'b' ? 'bahar' : 'guz'); IST.H.push(h); IST.by[h.id] = h; };

  /* ---------- yardımcılar ---------- */
  var X = IST.X = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  /* Türkçe sayı: 1.234,5 ; d basamak, z=true ise sondaki sıfırlar atılır */
  var nf = IST.nf = function (v, d, z) {
    if (v == null || !isFinite(v)) return '–';
    d = d == null ? 2 : d;
    var s = Math.abs(v).toFixed(d), p = s.split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var f = p[1] || ''; if (z !== false) f = f.replace(/0+$/, '');
    return (v < 0 && +s !== 0 ? '−' : '') + i + (f ? ',' + f : '');
  };
  IST.parse = function (s) {
    s = String(s || '').trim().replace(/\s/g, '').replace(/−/g, '-').replace(/%$/, '');
    if (!s) return NaN;
    var fr = s.match(/^(-?\d+(?:[.,]\d+)?)\/(\d+(?:[.,]\d+)?)$/);
    if (fr) return parseFloat(fr[1].replace(',', '.')) / parseFloat(fr[2].replace(',', '.'));
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    return parseFloat(s.replace(',', '.'));
  };
  IST.rng = function (seed) {
    var a = seed >>> 0 || 1;
    var r = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    r.int = function (lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); };
    r.pick = function (a) { return a[Math.floor(r() * a.length)]; };
    r.shuf = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    r.step = function (lo, hi, st) { return lo + st * r.int(0, Math.round((hi - lo) / st)); };
    return r;
  };
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var calm = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  IST.calm = calm;

  /* ---------- istatistik matematiği ---------- */
  var M = IST.M = {};
  M.sum = function (a) { return a.reduce(function (s, v) { return s + v; }, 0); };
  M.mean = function (a) { return M.sum(a) / a.length; };
  M.sort = function (a) { return a.slice().sort(function (x, y) { return x - y; }); };
  M.median = function (a) { var s = M.sort(a), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  M.modes = function (a) {
    var c = {}, mx = 0; a.forEach(function (v) { c[v] = (c[v] || 0) + 1; if (c[v] > mx) mx = c[v]; });
    if (mx < 2) return [];
    return Object.keys(c).filter(function (k) { return c[k] === mx; }).map(Number).sort(function (x, y) { return x - y; });
  };
  M.varS = function (a) { var m = M.mean(a); return M.sum(a.map(function (v) { return (v - m) * (v - m); })) / (a.length - 1); };
  M.sdS = function (a) { return Math.sqrt(M.varS(a)); };
  /* yüzdelik: konum L = p(n+1) (ders notundaki yaklaşım); kesirli konumda iki komşu arası doğrusal */
  M.pct = function (a, p) {
    var s = M.sort(a), n = s.length, L = p * (n + 1);
    if (L <= 1) return s[0]; if (L >= n) return s[n - 1];
    var i = Math.floor(L), f = L - i; return s[i - 1] + f * (s[i] - s[i - 1]);
  };
  M.fact = function (n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; };
  M.C = function (n, k) { if (k < 0 || k > n) return 0; k = Math.min(k, n - k); var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return r < 1e15 ? Math.round(r) : r; };
  M.P = function (n, k) { var r = 1; for (var i = 0; i < k; i++) r *= n - i; return r; };
  M.binom = function (x, n, p) { return M.C(n, x) * Math.pow(p, x) * Math.pow(1 - p, n - x); };
  M.pois = function (x, l) { return Math.exp(-l) * Math.pow(l, x) / M.fact(x); };
  M.hyper = function (x, N, K, n) { return M.C(K, x) * M.C(N - K, n - x) / M.C(N, n); };
  M.erf = function (x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  };
  M.Phi = function (z) { return 0.5 * (1 + M.erf(z / Math.SQRT2)); };
  M.npdf = function (x, m, s) { var z = (x - m) / s; return Math.exp(-z * z / 2) / (s * Math.sqrt(2 * Math.PI)); };
  /* tablo değeri: P(0 < Z < z), z iki basamağa yuvarlanır (z tablosundaki gibi) */
  M.ztab = function (z) { z = Math.round(Math.abs(z) * 100) / 100; return Math.round((M.Phi(z) - 0.5) * 10000) / 10000; };
  M.zinv = function (p) { var lo = -6, hi = 6; for (var i = 0; i < 80; i++) { var m = (lo + hi) / 2; if (M.Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };

  /* t, ki-kare ve F (12.11.2026, bahar dönemi): log-gama (Lanczos), düzenlenmiş eksik beta ve gama */
  M.lgam = function (x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); var s = 1.000000000190015;
    for (var j = 0; j < 6; j++) s += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  };
  var betacf = function (a, b, x) {
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; var h = d;
    for (var m = 1; m <= 200; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; var del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-12) break;
    }
    return h;
  };
  M.ibeta = function (x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(M.lgam(a + b) - M.lgam(a) - M.lgam(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  };
  M.igam = function (a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) { var ap = a, sum = 1 / a, del = sum; for (var n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return sum * Math.exp(-x + a * Math.log(x) - M.lgam(a)); }
    var b = x + 1 - a, c = 1e30, d = 1 / b, h = d;
    for (var i = 1; i < 500; i++) { var an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30; c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; var dl = d * c; h *= dl; if (Math.abs(dl - 1) < 1e-14) break; }
    return 1 - Math.exp(-x + a * Math.log(x) - M.lgam(a)) * h;
  };
  M.tcdf = function (t, v) { var p = 0.5 * M.ibeta(v / (v + t * t), v / 2, 0.5); return t >= 0 ? 1 - p : p; };
  M.tpdf = function (t, v) { return Math.exp(M.lgam((v + 1) / 2) - M.lgam(v / 2)) / Math.sqrt(v * Math.PI) * Math.pow(1 + t * t / v, -(v + 1) / 2); };
  M.c2cdf = function (x, k) { return M.igam(k / 2, x / 2); };
  M.c2pdf = function (x, k) { return x <= 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - M.lgam(k / 2)); };
  M.fcdf = function (x, a, b) { return x <= 0 ? 0 : M.ibeta(a * x / (a * x + b), a / 2, b / 2); };
  M.fpdf = function (x, a, b) { return x <= 0 ? 0 : Math.exp(0.5 * (a * Math.log(a * x) + b * Math.log(b) - (a + b) * Math.log(a * x + b)) - Math.log(x) - (M.lgam(a / 2) + M.lgam(b / 2) - M.lgam((a + b) / 2))); };
  var inv = function (cdf, p, lo, hi) { for (var i = 0; i < 100; i++) { var m = (lo + hi) / 2; if (cdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
  /* sağ kuyruk kritik değerleri (tablolardaki gibi üç ondalığa yuvarlı) */
  M.tkr = function (a, v) { return Math.round(inv(function (t) { return M.tcdf(t, v); }, 1 - a, 0, 80) * 1000) / 1000; };
  M.c2kr = function (a, k) { return Math.round(inv(function (x) { return M.c2cdf(x, k); }, 1 - a, 0, 400) * 1000) / 1000; };
  M.fkr = function (a, d1, d2) { return Math.round(inv(function (x) { return M.fcdf(x, d1, d2); }, 1 - a, 0, 400) * 100) / 100; };
  M.zkr = function (a) { return Math.round(M.zinv(1 - a) * 1000) / 1000; };
  M.cov = function (x, y) { var mx = M.mean(x), my = M.mean(y); return M.sum(x.map(function (v, i) { return (v - mx) * (y[i] - my); })) / (x.length - 1); };
  M.r = function (x, y) { return M.cov(x, y) / (M.sdS(x) * M.sdS(y)); };
  M.ls = function (x, y) { var mx = M.mean(x), my = M.mean(y), sxy = M.sum(x.map(function (v, i) { return (v - mx) * (y[i] - my); })), sxx = M.sum(x.map(function (v) { return (v - mx) * (v - mx); })), b = sxy / sxx; return { a: my - b * mx, b: b, sxy: sxy, sxx: sxx, mx: mx, my: my }; };
  /* sıralar (eşitlerde ortalama sıra) */
  M.rank = function (a) { var s = a.map(function (v, i) { return [v, i]; }).sort(function (p, q) { return p[0] - q[0]; }), r = []; for (var i = 0; i < s.length;) { var j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (var k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };

  /* ---------- görsel ilkeller (SVG dizgileri) ---------- */
  var V = IST.V = {};
  var PAL = V.PAL = ['#2F6FB0', '#C8553D', '#1F8A7A', '#E0A526', '#6B4FB3', '#B84A6B', '#3E8E5B', '#0D5C8C', '#8A6D3B'];
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  V.svg = function (w, h, body, label) { return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + X(label || '') + '">' + body + '</svg>'; };
  V.fig = function (html, cls) { return '<div class="fig ' + (cls || '') + '">' + html + '</div>'; };
  V.d = function (s) { return 'style="--d:' + (+s).toFixed(2) + 's"'; };
  /* ölçek: veri → piksel */
  V.sc = function (d0, d1, p0, p1) { return function (v) { return p0 + (v - d0) / (d1 - d0) * (p1 - p0); }; };
  V.nice = function (mx) { if (mx <= 0) return 1; var e = Math.pow(10, Math.floor(Math.log10(mx))), f = mx / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  /* eksen: y ızgarası + x tabanı */
  V.axes = function (o, x0, x1, y0, y1, ymax, fmt, ticks) {
    fmt = fmt || function (v) { return nf(v, 2); };
    if (!ticks) { ticks = 4; [4, 5, 3, 6, 2].some(function (t) { var st = ymax / t, m = st / Math.pow(10, Math.floor(Math.log10(st) + 1e-9)); if ([1, 2, 2.5, 5, 10].some(function (q) { return Math.abs(m - q) < 1e-6; })) { ticks = t; return true; } return false; }); }
    var s = '', ys = V.sc(0, ymax, y0, y1);
    for (var i = 0; i <= ticks; i++) {
      var v = ymax * i / ticks, y = r1(ys(v));
      s += '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y + '" y2="' + y + '" stroke="' + (i ? '#E6E0D2' : '#0D1838') + '" stroke-width="' + (i ? 1 : 2) + '"/>';
      s += '<text class="lbm" x="' + (x0 - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt(v) + '</text>';
    }
    return s;
  };
  /* sütun grafiği: o = { x:[etiket], y:[değer], w, h, max, renk, hi:[i], fmt, d, ylab, gap, val:true } */
  V.bars = function (o) {
    var w = o.w || 520, h = o.h || 280, L = o.L || 46, R = 12, T = 18, B = o.B || 44, n = o.y.length;
    var mx = o.max || V.nice(Math.max.apply(null, o.y) * 1.08), ys = V.sc(0, mx, h - B, T), bw = (w - L - R) / n, gap = o.gap == null ? 0.22 : o.gap;
    var fmt = o.fmt || function (v) { return nf(v, 2); }, d0 = o.d || 0;
    var s = V.axes(o, L, w - R, h - B, T, mx, o.yfmt || fmt, o.ticks);
    o.y.forEach(function (v, i) {
      var x = L + i * bw + bw * gap / 2, bwi = bw * (1 - gap), y = ys(v), c = Array.isArray(o.renk) ? o.renk[i % o.renk.length] : (o.renk || PAL[0]);
      var hi = o.hi && o.hi.indexOf(i) >= 0, dim = o.hi && o.hi.length && !hi && o.dim !== false;
      s += '<rect class="gy" ' + V.d(d0 + i * 0.07) + ' x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(bwi) + '" height="' + r1(h - B - y) + '" rx="3" fill="' + c + '" opacity="' + (dim ? 0.35 : 1) + '" stroke="#0D1838" stroke-width="' + (hi ? 2.2 : 1.2) + '"/>';
      if (o.val !== false) s += '<text class="lbm fd" ' + V.d(d0 + 0.5 + i * 0.07) + ' x="' + r1(x + bwi / 2) + '" y="' + r1(y - 5) + '" text-anchor="middle">' + fmt(v) + '</text>';
      s += '<text class="lbl" x="' + r1(x + bwi / 2) + '" y="' + (h - B + 16) + '" text-anchor="middle">' + X(o.x[i]) + '</text>';
    });
    if (o.xlab) s += '<text class="lbl" x="' + ((L + w - R) / 2) + '" y="' + (h - 6) + '" text-anchor="middle" font-weight="700">' + X(o.xlab) + '</text>';
    if (o.ylab) s += '<text class="lbl" transform="translate(12 ' + ((T + h - B) / 2) + ') rotate(-90)" text-anchor="middle" font-weight="700">' + X(o.ylab) + '</text>';
    return V.svg(w, h, s, o.label || 'sütun grafiği');
  };
  /* histogram: bitişik sütunlar; o.edges sınıf sınırları */
  V.hist = function (o) {
    var e = o.edges, w = o.w || 520, h = o.h || 280, L = 46, R = 14, T = 18, B = 44;
    var mx = o.max || V.nice(Math.max.apply(null, o.y) * 1.08), xs = V.sc(e[0], e[e.length - 1], L, w - R), ys = V.sc(0, mx, h - B, T), d0 = o.d || 0;
    var s = V.axes(o, L, w - R, h - B, T, mx, function (v) { return nf(v, 1); }, o.ticks);
    o.y.forEach(function (v, i) {
      var x = xs(e[i]), x2 = xs(e[i + 1]), y = ys(v), hi = o.hi && o.hi.indexOf(i) >= 0;
      s += '<rect class="gy" ' + V.d(d0 + i * 0.06) + ' x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(x2 - x) + '" height="' + r1(h - B - y) + '" fill="' + (hi ? (o.hc || PAL[3]) : (o.renk || PAL[0])) + '" stroke="#0D1838" stroke-width="1.4"/>';
      if (o.val !== false) s += '<text class="lbm fd" ' + V.d(d0 + 0.5 + i * 0.06) + ' x="' + r1((x + x2) / 2) + '" y="' + r1(y - 5) + '" text-anchor="middle">' + nf(v, 0) + '</text>';
    });
    e.forEach(function (v, i) { if (o.every && i % o.every) return; s += '<text class="lbm" x="' + r1(xs(v)) + '" y="' + (h - B + 16) + '" text-anchor="middle">' + nf(v, 1) + '</text>'; });
    if (o.poly) {
      var pts = o.y.map(function (v, i) { return r1((xs(e[i]) + xs(e[i + 1])) / 2) + ',' + r1(ys(v)); });
      var x0 = r1(xs(e[0]) - (xs(e[1]) - xs(e[0])) / 2), xN = r1(xs(e[e.length - 1]) + (xs(e[1]) - xs(e[0])) / 2);
      s += '<polyline class="dr" ' + V.d(d0 + 0.9) + ' style="--len:1400;--d:' + (d0 + 0.9) + 's" points="' + x0 + ',' + (h - B) + ' ' + pts.join(' ') + ' ' + xN + ',' + (h - B) + '" fill="none" stroke="' + PAL[1] + '" stroke-width="3" stroke-linejoin="round"/>';
      o.y.forEach(function (v, i) { s += '<circle class="pop" ' + V.d(d0 + 1 + i * 0.08) + ' cx="' + r1((xs(e[i]) + xs(e[i + 1])) / 2) + '" cy="' + r1(ys(v)) + '" r="4.5" fill="#fff" stroke="' + PAL[1] + '" stroke-width="2.5"/>'; });
    }
    if (o.xlab) s += '<text class="lbl" x="' + ((L + w - R) / 2) + '" y="' + (h - 6) + '" text-anchor="middle" font-weight="700">' + X(o.xlab) + '</text>';
    return V.svg(w, h, s, o.label || 'histogram');
  };
  /* çizgi / serpilme: o = { x:[], y:[], line:true, xlab, ylab, ymin, ymax } */
  V.xy = function (o) {
    var w = o.w || 520, h = o.h || 280, L = 46, R = 14, T = 18, B = 44, d0 = o.d || 0;
    var xmn = o.xmin != null ? o.xmin : Math.min.apply(null, o.x), xmx = o.xmax != null ? o.xmax : Math.max.apply(null, o.x);
    var ymn = o.ymin != null ? o.ymin : 0, ymx = o.ymax || V.nice(Math.max.apply(null, o.y) * 1.1);
    var xs = V.sc(xmn, xmx, L + 8, w - R - 8), ys = V.sc(ymn, ymx, h - B, T), s = '';
    for (var i = 0; i <= 4; i++) { var v = ymn + (ymx - ymn) * i / 4, y = r1(ys(v)); s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + (i ? '#E6E0D2' : '#0D1838') + '" stroke-width="' + (i ? 1 : 2) + '"/><text class="lbm" x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + nf(v, 1) + '</text>'; }
    if (o.xt) o.xt.forEach(function (t) { s += '<text class="lbm" x="' + r1(xs(t[0])) + '" y="' + (h - B + 16) + '" text-anchor="middle">' + X(t[1]) + '</text>'; });
    if (o.line) s += '<polyline class="dr" style="--len:1600;--d:' + d0 + 's" points="' + o.x.map(function (x, i) { return r1(xs(x)) + ',' + r1(ys(o.y[i])); }).join(' ') + '" fill="none" stroke="' + (o.renk || PAL[0]) + '" stroke-width="3" stroke-linejoin="round"/>';
    o.x.forEach(function (x, i) { s += '<circle class="pop" ' + V.d(d0 + (o.line ? 0.6 : 0) + i * (o.stag || 0.05)) + ' cx="' + r1(xs(x)) + '" cy="' + r1(ys(o.y[i])) + '" r="' + (o.line ? 4 : 5) + '" fill="' + (o.line ? '#fff' : (o.renk || PAL[0])) + '" stroke="' + (o.line ? (o.renk || PAL[0]) : '#0D1838') + '" stroke-width="' + (o.line ? 2.5 : 1.2) + '"/>'; });
    if (o.fit) { var a = o.fit; s += '<line class="dr" style="--len:700;--d:' + (d0 + 1.2) + 's" x1="' + r1(xs(xmn)) + '" y1="' + r1(ys(a[0] + a[1] * xmn)) + '" x2="' + r1(xs(xmx)) + '" y2="' + r1(ys(a[0] + a[1] * xmx)) + '" stroke="' + PAL[1] + '" stroke-width="2.5" stroke-dasharray="6 5"/>'; }
    if (o.xlab) s += '<text class="lbl" x="' + ((L + w - R) / 2) + '" y="' + (h - 6) + '" text-anchor="middle" font-weight="700">' + X(o.xlab) + '</text>';
    if (o.ylab) s += '<text class="lbl" transform="translate(12 ' + ((T + h - B) / 2) + ') rotate(-90)" text-anchor="middle" font-weight="700">' + X(o.ylab) + '</text>';
    return V.svg(w, h, s, o.label || 'grafik');
  };
  /* pasta: o = { v:[], l:[], w, renk } dilimler sırayla açılır, açılar yazılır */
  V.pie = function (o) {
    var w = o.w || 520, h = o.h || 290, cx = o.cx || 150, cy = h / 2, R = o.R || 115, tot = M.sum(o.v), a = -Math.PI / 2, s = '', d0 = o.d || 0;
    o.v.forEach(function (v, i) {
      var da = v / tot * Math.PI * 2, a2 = a + da, big = da > Math.PI ? 1 : 0, c = (o.renk || PAL)[i % (o.renk || PAL).length];
      var p = da >= Math.PI * 2 - 1e-9 ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '"' : '<path d="M' + cx + ' ' + cy + 'L' + r1(cx + R * Math.cos(a)) + ' ' + r1(cy + R * Math.sin(a)) + 'A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + r1(cx + R * Math.cos(a2)) + ' ' + r1(cy + R * Math.sin(a2)) + 'Z"';
      s += '<g class="pop" ' + V.d(d0 + i * 0.18) + ' style="transform-origin:' + cx + 'px ' + cy + 'px;--d:' + (d0 + i * 0.18).toFixed(2) + 's">' + p + ' fill="' + c + '" stroke="#FFFDF8" stroke-width="2.5"/></g>';
      var m = (a + a2) / 2;
      if (da > 0.32) s += '<text class="lbb fd" ' + V.d(d0 + 0.3 + i * 0.18) + ' x="' + r1(cx + R * 0.62 * Math.cos(m)) + '" y="' + r1(cy + R * 0.62 * Math.sin(m) + 4) + '" text-anchor="middle" fill="#fff" style="fill:#fff">' + nf(v / tot * 360, 0) + '°</text>';
      var ly = 30 + i * 26;
      s += '<g class="an" ' + V.d(d0 + i * 0.18) + '><rect x="' + (cx + R + 34) + '" y="' + (ly - 11) + '" width="14" height="14" rx="3" fill="' + c + '" stroke="#0D1838"/><text class="lbl" x="' + (cx + R + 56) + '" y="' + ly + '">' + X(o.l[i]) + ' · ' + nf(v / tot * 100, 1) + '%</text></g>';
      a = a2;
    });
    return V.svg(w, h, s, o.label || 'pasta grafiği');
  };
  /* nokta grafiği: değerler sayı doğrusunda üst üste düşer */
  V.dots = function (o) {
    var w = o.w || 520, h = o.h || 220, L = 24, R = 24, B = 40, mn = o.min, mx = o.max, xs = V.sc(mn, mx, L, w - R), c = {}, s = '', d0 = o.d || 0, rr = o.r || 7;
    s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + (h - B) + '" y2="' + (h - B) + '" stroke="#0D1838" stroke-width="2"/>';
    for (var t = mn; t <= mx; t += (o.step || 1)) s += '<line x1="' + r1(xs(t)) + '" x2="' + r1(xs(t)) + '" y1="' + (h - B) + '" y2="' + (h - B + 5) + '" stroke="#0D1838"/><text class="lbm" x="' + r1(xs(t)) + '" y="' + (h - B + 19) + '" text-anchor="middle">' + nf(t, 1) + '</text>';
    M.sort(o.v).forEach(function (v, i) {
      c[v] = (c[v] || 0) + 1; var hi = o.hi && o.hi(v);
      s += '<circle class="dp" ' + V.d(d0 + i * (o.stag || 0.04)) + ' cx="' + r1(xs(v)) + '" cy="' + r1(h - B - rr - 2 - (c[v] - 1) * (rr * 2 + 2)) + '" r="' + rr + '" fill="' + (hi ? PAL[1] : (o.renk || PAL[0])) + '" stroke="#0D1838" stroke-width="1.2"/>';
    });
    if (o.mark) o.mark.forEach(function (m, i) {
      var x = r1(xs(m[0]));
      s += '<g class="an" ' + V.d(d0 + 0.6 + o.v.length * (o.stag || 0.04) + i * 0.3) + '><line x1="' + x + '" x2="' + x + '" y1="14" y2="' + (h - B) + '" stroke="' + (m[2] || PAL[1]) + '" stroke-width="2.5" stroke-dasharray="5 4"/><text class="lbb" x="' + x + '" y="11" text-anchor="middle" style="fill:' + (m[2] || PAL[1]) + '">' + X(m[1]) + '</text></g>';
    });
    if (o.xlab) s += '<text class="lbl" x="' + (w / 2) + '" y="' + (h - 4) + '" text-anchor="middle" font-weight="700">' + X(o.xlab) + '</text>';
    return V.svg(w, h, s, o.label || 'nokta grafiği');
  };
  /* kutu grafiği: o = { v:[] veya q:[min,q1,me,q3,max], min, max } */
  V.box = function (o) {
    var w = o.w || 520, h = o.h || 150, L = 24, R = 24, y = o.y || 60, bh = 46, d0 = o.d || 0;
    var q = o.q || [Math.min.apply(null, o.v), M.pct(o.v, 0.25), M.median(o.v), M.pct(o.v, 0.75), Math.max.apply(null, o.v)];
    var xs = V.sc(o.min, o.max, L, w - R), s = '';
    if (!o.noaxis) { s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + (h - 30) + '" y2="' + (h - 30) + '" stroke="#0D1838" stroke-width="1.5"/>'; var st = o.step || V.nice((o.max - o.min) / 6); for (var t = Math.ceil(o.min / st) * st; t <= o.max + 1e-9; t += st) s += '<text class="lbm" x="' + r1(xs(t)) + '" y="' + (h - 14) + '" text-anchor="middle">' + nf(t, 1) + '</text><line x1="' + r1(xs(t)) + '" x2="' + r1(xs(t)) + '" y1="' + (h - 30) + '" y2="' + (h - 25) + '" stroke="#0D1838"/>'; }
    s += '<line class="gx" ' + V.d(d0) + ' x1="' + r1(xs(q[0])) + '" x2="' + r1(xs(q[1])) + '" y1="' + y + '" y2="' + y + '" stroke="#0D1838" stroke-width="2"/>';
    s += '<line class="gx" ' + V.d(d0 + 0.3) + ' x1="' + r1(xs(q[3])) + '" x2="' + r1(xs(q[4])) + '" y1="' + y + '" y2="' + y + '" stroke="#0D1838" stroke-width="2"/>';
    s += '<rect class="pop" ' + V.d(d0 + 0.15) + ' x="' + r1(xs(q[1])) + '" y="' + (y - bh / 2) + '" width="' + r1(xs(q[3]) - xs(q[1])) + '" height="' + bh + '" rx="5" fill="' + (o.renk || '#DDEBFA') + '" stroke="#0D1838" stroke-width="2"/>';
    s += '<line class="an" ' + V.d(d0 + 0.5) + ' x1="' + r1(xs(q[2])) + '" x2="' + r1(xs(q[2])) + '" y1="' + (y - bh / 2) + '" y2="' + (y + bh / 2) + '" stroke="' + PAL[1] + '" stroke-width="3.5"/>';
    [0, 4].forEach(function (k) { s += '<line x1="' + r1(xs(q[k])) + '" x2="' + r1(xs(q[k])) + '" y1="' + (y - 12) + '" y2="' + (y + 12) + '" stroke="#0D1838" stroke-width="2"/>'; });
    if (o.lab !== false) [['min', 0], ['Q1', 1], ['medyan', 2], ['Q3', 3], ['maks', 4]].forEach(function (p, i) { s += '<text class="lbm fd" ' + V.d(d0 + 0.6 + i * 0.1) + ' x="' + r1(xs(q[p[1]])) + '" y="' + (i % 2 ? y + bh / 2 + 16 : y - bh / 2 - 8) + '" text-anchor="middle">' + p[0] + ' ' + nf(q[p[1]], 1) + '</text>'; });
    return V.svg(w, h, s, o.label || 'kutu grafiği');
  };
  /* eğri: o = { f, a, b, ymax, sh:[a,b], xt:[...], w, h, renk } */
  V.curve = function (o) {
    var w = o.w || 520, h = o.h || 260, L = 30, R = 16, T = 16, B = 36, N = 160, d0 = o.d || 0;
    var xs = V.sc(o.a, o.b, L, w - R), ys = V.sc(0, o.ymax, h - B, T), pts = [];
    for (var i = 0; i <= N; i++) { var x = o.a + (o.b - o.a) * i / N; pts.push([x, o.f(x)]); }
    var s = '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + (h - B) + '" y2="' + (h - B) + '" stroke="#0D1838" stroke-width="2"/>';
    (o.sh ? [].concat(Array.isArray(o.sh[0]) ? o.sh : [o.sh]) : []).forEach(function (sh, k) {
      var a = Math.max(o.a, sh[0]), b = Math.min(o.b, sh[1]); if (b <= a) return;
      var pa = 'M' + r1(xs(a)) + ' ' + (h - B);
      for (var j = 0; j <= 80; j++) { var x2 = a + (b - a) * j / 80; pa += 'L' + r1(xs(x2)) + ' ' + r1(ys(o.f(x2))); }
      pa += 'L' + r1(xs(b)) + ' ' + (h - B) + 'Z';
      s += '<path class="fd" ' + V.d(d0 + 0.9 + k * 0.2) + ' d="' + pa + '" fill="' + (o.shc || PAL[3]) + '" fill-opacity=".55" stroke="none"/>';
    });
    s += '<path class="dr" style="--len:1500;--d:' + d0 + 's" d="M' + pts.map(function (p) { return r1(xs(p[0])) + ' ' + r1(ys(p[1])); }).join('L') + '" fill="none" stroke="' + (o.renk || PAL[0]) + '" stroke-width="3" stroke-linejoin="round"/>';
    (o.xt || []).forEach(function (t) { var v = Array.isArray(t) ? t[0] : t, lab = Array.isArray(t) ? t[1] : nf(t, 2); s += '<line x1="' + r1(xs(v)) + '" x2="' + r1(xs(v)) + '" y1="' + (h - B) + '" y2="' + (h - B + 5) + '" stroke="#0D1838"/><text class="lbm" x="' + r1(xs(v)) + '" y="' + (h - B + 19) + '" text-anchor="middle">' + X(lab) + '</text>'; });
    if (o.extra) s += o.extra(xs, ys, h - B);
    return V.svg(w, h, s, o.label || 'olasılık yoğunluk eğrisi');
  };
  /* tablo: head [..], rows [[..]], o = { n:[sayısal sütun idx], hi:{ 'r,c':'hi' }, rowc:{r:'ht'}, cap, d, st } */
  V.tablo = function (head, rows, o) {
    o = o || {}; var d0 = o.d || 0, st = o.st == null ? 0.08 : o.st, num = o.n || [];
    return '<table class="tb">' + (o.cap ? '<caption>' + o.cap + '</caption>' : '') + '<thead><tr>' + head.map(function (h, j) { return '<th' + (num.indexOf(j) >= 0 ? ' class="n"' : '') + '>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr class="an ' + ((o.rowc || {})[i] || '') + '" ' + V.d(d0 + i * st) + '>' + r.map(function (c, j) {
          var k = (o.hi || {})[i + ',' + j], cl = (num.indexOf(j) >= 0 ? 'n ' : '') + (k || ''); return '<td' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + '>' + c + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  };
  /* kavram kartları: [{ ic, b, en, p }] */
  V.kart = function (list, d0) {
    return '<div class="kt">' + list.map(function (k, i) { return '<div class="pop" ' + V.d((d0 || 0) + i * 0.16) + '>' + (k.ic ? '<span class="ic" aria-hidden="true">' + k.ic + '</span>' : '') + '<b>' + k.b + '</b>' + (k.en ? '<small>' + X(k.en) + '</small>' : '') + (k.p ? '<p>' + k.p + '</p>' : '') + '</div>'; }).join('') + '</div>';
  };
  /* formül akışı: [{ s:'açıklama', h:'formül html', son:true }] */
  V.fx = function (list, d0, st) {
    return '<div class="fx">' + list.map(function (l, i) { return '<div class="an' + (l.son ? ' son' : '') + '" ' + V.d((d0 || 0) + i * (st || 0.55)) + '>' + (l.s ? '<small>' + l.s + '</small>' : '') + l.h + '</div>'; }).join('') + '</div>';
  };
  V.frac = function (a, b) { return '<span class="fr"><span>' + a + '</span><span>' + b + '</span></span>'; };
  /* iki parça yan yana */
  V.yy = function (a, b, gap) { return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:' + (gap || 14) + 'px;align-items:center">' + a + b + '</div>'; };
  V.ust = function (a, b) { return '<div style="display:grid;gap:14px">' + a + b + '</div>'; };

  /* SVG içinde imleç konumu (viewBox koordinatı) ve sürükleme */
  IST.svgPt = function (svg, e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 }; };
  IST.drag = function (svg, sel, on) {
    var cur = null;
    svg.addEventListener('pointerdown', function (e) { var t = e.target.closest && e.target.closest(sel); if (!t) return; cur = t; e.preventDefault(); lsafe(function () { svg.setPointerCapture(e.pointerId); }); });
    svg.addEventListener('pointermove', function (e) { if (!cur) return; on(cur, IST.svgPt(svg, e), false); });
    var up = function (e) { if (!cur) return; on(cur, IST.svgPt(svg, e), true); cur = null; };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', function () { cur = null; });
  };

  /* ---------- ilerleme ---------- */
  var KEY = 'acadex.istat.v1';
  var prog = function () { return lsafe(function () { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }, {}); };
  var put = function (id, patch) {
    var p = prog(), r = p[id] || {};
    Object.keys(patch).forEach(function (k) { if (k === 's') r.s = Math.max(r.s || 0, patch.s); else r[k] = patch[k]; });
    p[id] = r; p.last = id;
    lsafe(function () { localStorage.setItem(KEY, JSON.stringify(p)); });
    post({ type: 'progress' });
  };
  IST.prog = prog; IST.put = put;
  IST.parts = function (r) { r = r || {}; return [!!r.a, !!r.g, r.s != null && r.s >= 60]; };

  /* ---------- Acadex köprüsü ---------- */
  var EMB = W.parent !== W && /(?:\?|&)hub=1(?:&|$)/.test(location.search), ORG = location.origin;
  var post = function (m) { if (!EMB) return; m.src = 'axlab'; m.lab = 'istat'; lsafe(function () { W.parent.postMessage(m, ORG); }); };
  var cur = { tab: 'yol', step: 'a', sahne: 0 };
  var ctx = function () {
    var H = IST.by[cur.tab], adim = { a: 'anlatım', g: 'etkileşimli görsel', s: 'yeni nesil sorular' }[cur.step];
    var sel = H ? {
      key: 'istat.' + H.id, title: H.no + '. hafta · ' + H.tr, la: 'Acadex İstatistik', rows: [],
      about: 'öğrenci Acadex İstatistik dersinde (Statistics for Business ' + (H.donem === 'bahar' ? 'II' : 'I') + '), ' + H.no + '. hafta "' + H.tr + ' (' + H.en + ')" dersinin ' + adim + ' bölümünde' +
        (cur.step === 'a' && H.sahneler[cur.sahne] ? ', "' + H.sahneler[cur.sahne].b.replace(/<[^>]+>/g, '') + '" sahnesinde' : '') + '. Sorularda cevabı doğrudan verme, adım adım yönlendir.'
    } : { key: 'istat.yol', title: 'Ders yolu', la: 'Acadex İstatistik', rows: [], about: 'öğrenci Acadex İstatistik giriş dersinin haftalık ders yolunda; hangi haftadan başlayacağını seçiyor.' };
    return { type: 'ctx', mode: cur.tab, spot: false, sel: sel, chips: [] };
  };
  var ctxSend = function () { if (!EMB) return; clearTimeout(ctxSend.t); ctxSend.t = setTimeout(function () { post(ctx()); }, 60); };
  if (EMB) W.addEventListener('message', function (e) {
    if (e.origin !== ORG || e.source !== W.parent) return;
    var d = e.data; if (!d || d.src !== 'axhost') return;
    if (d.type === 'tab' && d.tab) IST.go(d.tab);
    else if (d.type === 'ask') post({ type: 'reply', id: d.id, miss: true });
  });

  /* ---------- kabuk ---------- */
  var main, crumb, toastEl;
  var toast = IST.toast = function (t) { if (!toastEl) return; toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, 2200); };
  var setUrl = function () {
    lsafe(function () { var u = new URL(location.href); u.searchParams.set('tab', cur.tab); history.replaceState(null, '', u.pathname + '?' + u.searchParams.toString()); });
  };
  var top = function () { lsafe(function () { W.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); }); };

  /* ---------- Veri Hoca: kurgusal anlatıcı (12.11.2026) ----------
     Gözlüklü, papyonlu bir çizgi hoca. Boştayken göz kırpar; anlatırken ağzı oynar,
     her yeni cümlede işaret çubuğuyla görsele doğru gösterir. */
  IST.hoca = function (sz) {
    return '<svg class="hoca" viewBox="0 0 84 92" width="' + (sz || 64) + '" height="' + Math.round((sz || 64) * 92 / 84) + '" aria-hidden="true">' +
      '<path d="M10 92c2-18 14-26 32-26s30 8 32 26z" fill="#2F6FB0" stroke="#0D1838" stroke-width="2.4"/>' +
      '<path d="M34 66l8 10 8-10" fill="#FFFDF8" stroke="#0D1838" stroke-width="2"/><path d="M36 78l6-4 6 4-6 4z" fill="#C8553D" stroke="#0D1838" stroke-width="1.6"/>' +
      '<circle cx="42" cy="36" r="22" fill="#F1C7A1" stroke="#0D1838" stroke-width="2.4"/>' +
      '<path d="M20 34c0-16 10-22 22-22s22 6 22 22c-4-8-10-11-14-11-3 4-12 5-18 2-5 1-9 4-12 9z" fill="#5B6578" stroke="#0D1838" stroke-width="2"/>' +
      '<g class="goz"><circle cx="34" cy="38" r="2.4" fill="#0D1838"/><circle cx="50" cy="38" r="2.4" fill="#0D1838"/></g>' +
      '<circle cx="34" cy="38" r="7" fill="rgba(255,255,255,.25)" stroke="#0D1838" stroke-width="2"/><circle cx="50" cy="38" r="7" fill="rgba(255,255,255,.25)" stroke="#0D1838" stroke-width="2"/><path d="M41 38h2" stroke="#0D1838" stroke-width="2"/>' +
      '<path d="M37 47c3 2 7 2 10 0" fill="none" stroke="#0D1838" stroke-width="1.8" stroke-linecap="round"/>' +
      '<ellipse class="agiz" cx="42" cy="50" rx="4.2" ry="2.6" fill="#7A2E2A"/><path class="gul" d="M35 48c3 6 11 6 14 0z" fill="#7A2E2A"/><path class="kas" d="M28 27l9 2M47 29l9-2" stroke="#0D1838" stroke-width="2" stroke-linecap="round"/>' +
      '<g class="kol"><path d="M66 82l12-16" stroke="#2F6FB0" stroke-width="7" stroke-linecap="round"/><path d="M78 66l6-14" stroke="#8A6D3B" stroke-width="2.6" stroke-linecap="round"/><circle cx="78" cy="66" r="3.6" fill="#F1C7A1" stroke="#0D1838" stroke-width="1.5"/></g></svg>';
  };

  /* ---------- yol haritası ---------- */
  IST.PROVA = [
    { id: 'pv-gv', ad: 'Güz · vize provası', hf: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'] },
    { id: 'pv-gf', ad: 'Güz · final provası', hf: ['g9', 'g10', 'g11', 'g12', 'g13', 'g14', 'g15'] },
    { id: 'pv-bv', ad: 'Bahar · vize provası', hf: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] },
    { id: 'pv-bf', ad: 'Bahar · final provası', hf: ['b9', 'b10', 'b11', 'b12', 'b13', 'b14'] }
  ];
  var donem = function (d) { return IST.H.filter(function (H) { return H.donem === d; }); };
  var yol = function () {
    var p = prog(), done = 0, parts = 0;
    IST.H.forEach(function (H) { var q = IST.parts(p[H.id]); parts += q.filter(Boolean).length; if (q[0] && q[1] && q[2]) done++; });
    var tot = IST.H.length * 3, pc = tot ? parts / tot : 0, C = 2 * Math.PI * 46, i = 0;
    var kart = function (H) {
      var q = IST.parts(p[H.id]), r = p[H.id] || {}, all = q[0] && q[1] && q[2];
      return '<li style="--i:' + (i++) + ';--cc:' + H.renk + '"><button type="button" class="is-wk' + (all ? ' done' : '') + '" data-go="' + H.id + '">' +
        '<span class="no"><b>' + H.no + '. HAFTA</b>' + (p.last === H.id ? '<span>kaldığın yer</span>' : '') + '</span>' +
        '<h3 class="disp">' + X(H.tr) + '<small>' + X(H.en) + '</small></h3>' +
        '<span class="parts" aria-label="anlatım ' + (q[0] ? 'bitti' : 'bekliyor') + ', görsel ' + (q[1] ? 'bitti' : 'bekliyor') + ', sorular ' + (q[2] ? 'geçti' : 'bekliyor') + '"><i class="' + (q[0] ? 'on' : '') + '"></i><i class="' + (q[1] ? 'on' : '') + '"></i><i class="' + (q[2] ? 'on' : '') + '"></i><span>' + (r.s != null ? '%' + r.s : all ? '✓' : '') + '</span></span></button></li>';
    };
    var liste = function (L) { var h = ''; L.forEach(function (H) { if (H.no === 9) h += '<li style="--i:' + (i++) + '"><div class="is-ara"><span><b>8</b>ara sınav haftası<br>(midterm)</span></div></li>'; h += kart(H); }); return h; };
    var prova = function (d) {
      return '<div class="is-pv">' + IST.PROVA.filter(function (P) { return P.id.charAt(3) === d; }).map(function (P) {
        var r = p[P.id] || {}; return '<button type="button" class="is-pvb" data-go="' + P.id + '"><span class="ic" aria-hidden="true">⏱️</span><span><b class="disp">' + X(P.ad) + '</b><small>' + P.hf.length * 2 + ' soru · ' + P.hf.length * 5 + ' dakika · ' + P.hf.map(function (k) { return IST.by[k] ? IST.by[k].no : ''; }).join(', ') + '. haftalar</small></span><span class="sc">' + (r.s != null ? 'en iyi %' + r.s : 'başla →') + '</span></button>';
      }).join('') + '</div>';
    };
    main.innerHTML = '<div class="is-hero"><div><span class="hand" style="font-size:22px;color:var(--rust)">Statistics for Business I · II</span><h1 class="disp">İstatistiğe giriş<br>haftalık ders yolu</h1>' +
      '<p>Her hafta: <b>Veri Hoca’nın animasyonlu anlatımı</b>, <b>etkileşimli görsel</b>, <b>yeni nesil sorular</b> ve yazdırılabilir <b>özet kartı</b>. Sıra ders notlarındakiyle aynı; terimlerin İngilizcesi yanında.</p></div>' +
      '<div class="is-ring" aria-label="ilerleme yüzde ' + Math.round(pc * 100) + '"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="46" fill="none" stroke="#E6E0D2" stroke-width="10"/><circle cx="56" cy="56" r="46" fill="none" stroke="#0D1838" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * pc).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><b class="disp">%' + Math.round(pc * 100) + '</b><small>' + done + ' / ' + IST.H.length + ' hafta</small></div></div>' +
      '<div class="is-hocab">' + IST.hoca(70) + '<p><b>Veri Hoca:</b> Merhaba! Bir haftayı aç, “▶ oynat”a bas; sahneleri ben anlatayım. Takıldığın yerde durdur, kendi hızında oku. Dönem sonunda sınav provalarıyla kendini dene.</p></div>' +
      '<div class="is-donem"><h2 class="disp">Güz dönemi</h2><span>Statistics for Business I · betimsel istatistik, olasılık ve dağılımlar</span></div><ol class="is-yol">' + liste(donem('guz')) + '</ol>' + prova('g') +
      '<div class="is-donem"><h2 class="disp">Bahar dönemi</h2><span>Statistics for Business II · örnekleme, tahmin, hipotez testleri, ilişki ve karar</span></div><ol class="is-yol">' + liste(donem('bahar')) + '</ol>' + prova('b') +
      '<p class="is-not">Ders notları: Statistics for Business I–II. Anlatıcı Veri Hoca kurgusal bir karakterdir. Sorulardaki şirketler ve sayılar ders amaçlı kurgusaldır; her “yeni soru seti” sayıları yeniden üretir.</p>';
    crumb.textContent = 'Ders yolu';
  };

  /* ---------- ders ---------- */
  var ADIM = [['a', 'Anlatım', 0], ['g', 'Görsel', 1], ['s', 'Sorular', 2], ['o', 'Özet', 3]];
  var ders = function (H, step) {
    var p = prog()[H.id] || {}, q = IST.parts(p);
    main.innerHTML = '<div class="is-ders" style="--cc:' + H.renk + '"><div class="is-dh"><div><span class="k">' + H.no + '. hafta · ' + (H.donem === 'bahar' ? 'Bahar' : 'Güz') + '</span><h1 class="disp">' + X(H.tr) + '<small>' + X(H.en) + '</small></h1></div>' +
      '<div class="is-adim" role="tablist" aria-label="Dersin adımları">' +
      ADIM.map(function (t) { var ok = t[2] < 3 && q[t[2]]; return '<button type="button" role="tab" data-st="' + t[0] + '" aria-selected="' + (step === t[0]) + '" class="' + (ok ? 'ok' : '') + '"><i>' + (ok ? '✓' : t[2] < 3 ? t[2] + 1 : '★') + '</i><span>' + t[1] + '</span></button>'; }).join('') +
      '</div></div><div class="is-card" data-body></div><div class="is-sonraki" data-alt></div></div>';
    crumb.innerHTML = '<span>' + (H.donem === 'bahar' ? 'Bahar' : 'Güz') + ' · ' + H.no + '. hafta</span><span aria-hidden="true">·</span><span>' + X(H.tr) + '</span>';
    var body = main.querySelector('[data-body]');
    if (step === 'a') anlatim(H, body);
    else if (step === 'g') gorsel(H, body);
    else if (step === 'o') ozet(H, body);
    else sorular(H, body);
    var alt = main.querySelector('[data-alt]'), i = IST.H.indexOf(H), nx = IST.H[i + 1], pv = IST.H[i - 1];
    alt.innerHTML = (pv ? '<button type="button" class="btn ghost" data-go="' + pv.id + '">← ' + pv.no + '. hafta</button>' : '') + '<button type="button" class="btn ghost" data-go="yol">ders yolu</button>' + (nx ? '<button type="button" class="btn" data-go="' + nx.id + '">' + (nx.donem !== H.donem ? 'Bahar · ' : '') + nx.no + '. hafta →</button>' : '');
  };

  /* anlatım: sahneler + Veri Hoca + otomatik oynatıcı (altyazı = metnin paragraf/madde birimleri)
     13.11.2026 · senkron görsel: görseldeki animasyonlu parçalar gecikme sırasına göre metin birimlerine
     bölünür; Veri Hoca bir birimi okurken o birimin parçası belirir ve parlar. Elle okurken bir paragrafa
     tıklamak görseldeki karşılığını parlatır.
     13.11.2026 · tahmin et, sonra gör: IST.TAHMIN[hafta][sahne] varsa metnin ortasında “Sence?” kartı çıkar;
     cevaplanana kadar metnin ve görselin ikinci yarısı bekler. */
  var oyn = { t: null };
  var durdur = function () { clearTimeout(oyn.t); oyn.t = null; };
  IST.durdur = durdur;
  var ANIM = '.an,.pop,.gy,.gx,.dr,.fd,.dp';
  var gecik = function (el) { var d = parseFloat((el.style.getPropertyValue('--d') || '').replace('s', '')); if (isNaN(d)) d = parseFloat(lsafe(function () { return getComputedStyle(el).animationDelay; }, '0')) || 0; return d; };
  /* görseldeki animasyonlu öğeleri n birime dağıt (aynı gecikmedekiler birlikte kalır) */
  var parcala = function (v, n) {
    var els = [].filter.call(v.querySelectorAll(ANIM), function (e) { var p = e.parentElement && e.parentElement.closest(ANIM); return !p || !v.contains(p); });
    var gr = {}, keys = [];
    els.forEach(function (e) { var k = Math.round(gecik(e) * 100) / 100; e.__d = k; if (!gr[k]) { gr[k] = []; keys.push(k); } gr[k].push(e); });
    keys.sort(function (a, b) { return a - b; });
    var out = []; for (var j = 0; j < n; j++) out.push([]);
    keys.forEach(function (k, i) { out[Math.min(n - 1, Math.floor(i * n / Math.max(1, keys.length)))].push(gr[k]); });
    return out.map(function (g) { return [].concat.apply([], g); });
  };
  var gizle = function (L) { L.forEach(function (e) { e.classList.add('is-bekle'); }); };
  var ac = function (L, parla) {
    if (!L.length) return; var t0 = Math.min.apply(null, L.map(function (e) { return e.__d || 0; }));
    L.forEach(function (e) { e.style.animationDelay = Math.max(0, (e.__d || 0) - t0) + 's'; e.classList.remove('is-bekle'); if (parla) { e.classList.remove('is-yeni'); void e.getBoundingClientRect(); e.classList.add('is-yeni'); } });
    if (parla) setTimeout(function () { L.forEach(function (e) { e.classList.remove('is-yeni'); }); }, 2600);
  };
  cur.tah = cur.tah || {};
  var anlatim = function (H, body) {
    var S = H.sahneler, k = Math.min(cur.sahne || 0, S.length - 1);
    var draw = function () {
      durdur(); cur.sahne = k; var s = S[k], T = ((IST.TAHMIN || {})[H.id] || [])[k], tk = H.id + ':' + k;
      body.innerHTML = '<div class="is-sahne"><div class="is-bar" aria-hidden="true"><i data-bar></i></div><div class="is-metin"><span class="sn">SAHNE ' + (k + 1) + ' / ' + S.length + '</span><h2 class="disp">' + s.b + '</h2>' +
        '<div class="is-hk">' + IST.hoca(58) + '<div class="is-bal" data-bal aria-live="polite">' + (cur.play ? '' : k ? 'Hazırsan ▶ oynat; bu sahneyi birlikte okuyalım. Bir paragrafa tıklarsan görselde karşılığını gösteririm.' : 'Merhaba, ben Veri Hoca! ▶ oynat’a basarsan bu dersi sahne sahne anlatırım.') + '</div></div>' +
        '<div class="tx">' + s.t + '</div>' +
        (s.terim ? '<div class="is-terimler">' + s.terim.map(function (t) { return '<span>' + X(t[0]) + ' <em>· ' + X(t[1]) + '</em></span>'; }).join('') + '</div>' : '') +
        '<div class="is-sahne-nav"><button type="button" class="btn sm pri is-oyn" data-play aria-pressed="' + !!cur.play + '">' + (cur.play ? '⏸ durdur' : '▶ oynat') + '</button><button type="button" class="btn sm ghost" data-hiz title="oynatma hızı">' + (cur.hiz === 1.5 ? '1,5×' : '1×') + '</button>' +
        '<div class="is-dots">' + S.map(function (_, j) { return '<button type="button" data-sj="' + j + '" class="' + (j < k ? 'on' : '') + '"' + (j === k ? ' aria-current="true"' : '') + ' aria-label="sahne ' + (j + 1) + '"></button>'; }).join('') + '</div>' +
        '<button type="button" class="btn sm ghost" data-sp' + (k ? '' : ' disabled') + '>←</button>' +
        (k < S.length - 1 ? '<button type="button" class="btn sm" data-sn>ileri →</button>' : '<button type="button" class="btn sm" data-tog>görsel →</button>') + '</div></div>' +
        '<div class="is-gor"><button type="button" class="btn sm ghost tekrar" data-rp title="animasyonu yeniden oynat">↻ tekrar</button><div class="fig" data-v></div></div></div>';
      var v = body.querySelector('[data-v]'), hk = body.querySelector('.hoca'), bal = body.querySelector('[data-bal]'), bar = body.querySelector('[data-bar]');
      /* altyazı birimleri */
      var units = []; [].forEach.call(body.querySelectorAll('.tx > *'), function (el) { if (/^(UL|OL)$/.test(el.tagName)) [].forEach.call(el.children, function (li) { units.push(li); }); else units.push(el); });
      var N = units.length, m = T ? Math.max(1, Math.ceil(N / 2)) : N, P = [], acik = !T || cur.tah[tk];
      var ciz = function () {
        v.innerHTML = ''; void v.offsetWidth; lsafe(function () { v.innerHTML = typeof s.v === 'function' ? s.v() : (s.v || ''); }); if (s.kur) lsafe(function () { s.kur(v); });
        P = parcala(v, Math.max(1, N));
        if (cur.play) P.forEach(gizle);
        else if (!acik) P.slice(m).forEach(gizle);
      };
      ciz();
      body.querySelector('[data-rp]').onclick = function () { var ply = cur.play; cur.play = false; ciz(); cur.play = ply; if (ply) P.forEach(function (L) { ac(L); }); };
      /* tahmin kartı */
      var kart = null;
      var bekle = function (on) { units.forEach(function (x, j) { x.classList.toggle('is-gizli', on && j >= m); }); };
      if (T) {
        kart = D.createElement('div'); kart.className = 'is-tah'; kart.setAttribute('role', 'group'); kart.setAttribute('aria-label', 'Tahmin sorusu');
        kart.innerHTML = '<div class="is-tah-h"><span>🤔 Sence?</span><button type="button" class="is-tah-gec" data-gec>geç →</button></div><p>' + T[0] + '</p><div class="is-tah-o">' + T[1].map(function (o, i) { return '<button type="button" data-t="' + i + '">' + o + '</button>'; }).join('') + '</div><div class="is-tah-fb" data-tfb></div>';
        var after = units[m - 1]; (after.tagName === 'LI' ? after.parentElement : after).insertAdjacentElement('afterend', kart);
        if (acik) { kart.classList.add('cozuldu'); kart.querySelector('[data-tfb]').innerHTML = '<b>Cevap:</b> ' + T[1][T[2]] + '. ' + T[3]; [].forEach.call(kart.querySelectorAll('[data-t]'), function (b) { b.disabled = true; if (+b.getAttribute('data-t') === T[2]) b.classList.add('ok'); }); kart.querySelector('[data-gec]').hidden = true; }
        else bekle(true);
      }
      var devam = null;
      var coz = function (i) {
        if (acik) return; acik = true; cur.tah[tk] = 1;
        var good = i === T[2];
        [].forEach.call(kart.querySelectorAll('[data-t]'), function (b) { var j = +b.getAttribute('data-t'); b.disabled = true; if (j === T[2]) b.classList.add('ok'); else if (j === i) b.classList.add('no'); });
        kart.classList.add('cozuldu'); kart.querySelector('[data-gec]').hidden = true;
        kart.querySelector('[data-tfb]').innerHTML = (i == null ? '' : good ? '<b style="color:var(--ok)">Bildin!</b> ' : '<b style="color:var(--bad)">Yakındı.</b> ') + '<b>Cevap:</b> ' + T[1][T[2]] + '. ' + T[3];
        hk.classList.remove('konus', 'dusun'); hk.classList.add(good ? 'mutlu' : 'dusun'); setTimeout(function () { hk.classList.remove('mutlu', 'dusun'); }, 2600);
        bal.textContent = i == null ? 'Peki, cevabı birlikte görelim: ' + T[1][T[2]] + '.' : good ? 'Harika tahmin! ' + T[3] : 'Güzel deneme. ' + T[3];
        bekle(false);
        if (!cur.play) P.slice(m).forEach(function (L) { ac(L, true); });
        if (devam) { var f = devam; devam = null; oyn.t = setTimeout(f, 2600 / (cur.hiz || 1)); }
      };
      if (kart) { [].forEach.call(kart.querySelectorAll('[data-t]'), function (b) { b.onclick = function () { coz(+b.getAttribute('data-t')); }; }); kart.querySelector('[data-gec]').onclick = function () { coz(null); }; }
      /* elle okuma: paragrafa tıkla → görseldeki karşılığı parlar */
      units.forEach(function (el, j) { el.classList.add('is-birim'); el.addEventListener('click', function () { if (cur.play || el.classList.contains('is-gizli')) return; units.forEach(function (x) { x.classList.toggle('is-oku', x === el); }); ac(P[j] || [], true); setTimeout(function () { el.classList.remove('is-oku'); }, 2600); }); });
      var git = function (j) { k = j; draw(); if (k === S.length - 1) put(H.id, { a: 1 }); };
      body.querySelector('[data-sp]').onclick = function () { if (k) git(k - 1); };
      var sn = body.querySelector('[data-sn]'); if (sn) sn.onclick = function () { git(k + 1); };
      var tg = body.querySelector('[data-tog]'); if (tg) tg.onclick = function () { cur.play = false; put(H.id, { a: 1 }); IST.go(H.id, 'g'); };
      [].forEach.call(body.querySelectorAll('[data-sj]'), function (b) { b.onclick = function () { git(+b.getAttribute('data-sj')); }; });
      body.querySelector('[data-hiz]').onclick = function () { cur.hiz = cur.hiz === 1.5 ? 1 : 1.5; this.textContent = cur.hiz === 1.5 ? '1,5×' : '1×'; };
      var adim = function (u) {
        if (u === m && !acik && u < N) {
          hk.classList.remove('konus'); hk.classList.add('dusun'); bal.textContent = 'Dur bir saniye: sence? Cevabını seç (ya da “geç”), sonra devam edelim.';
          units.forEach(function (x) { x.classList.remove('is-oku'); }); lsafe(function () { kart.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }); });
          devam = function () { adim(u); }; return;
        }
        units.forEach(function (x, j) { x.classList.toggle('is-oku', j === u); x.classList.toggle('is-okundu', j < u); });
        if (u >= N) {
          hk.classList.remove('konus'); bar.style.transition = 'none'; bar.style.width = '100%';
          oyn.t = setTimeout(function () { if (k < S.length - 1) { git(k + 1); } else { cur.play = false; put(H.id, { a: 1 }); draw(); bal.textContent = 'Anlatım bitti! Şimdi görselde kendin dene.'; IST.toast('Anlatım bitti → görsele geç'); } }, 1100 / (cur.hiz || 1));
          return;
        }
        var el = units[u], txt = el.textContent.replace(/\s+/g, ' ').trim(), dur = Math.max(2600, Math.min(11000, txt.length * 62)) / (cur.hiz || 1);
        ac(P[u] || [], true);
        bal.textContent = txt.length > 230 ? txt.slice(0, 227) + '…' : txt;
        hk.classList.remove('dusun', 'mutlu'); hk.classList.add('konus'); hk.classList.remove('isaret'); void hk.offsetWidth; hk.classList.add('isaret');
        bar.style.transition = 'none'; bar.style.width = (u / N * 100) + '%'; void bar.offsetWidth;
        bar.style.transition = 'width ' + dur + 'ms linear'; bar.style.width = ((u + 1) / N * 100) + '%';
        if (!calm) lsafe(function () { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
        oyn.t = setTimeout(function () { adim(u + 1); }, dur);
      };
      body.querySelector('[data-play]').onclick = function () {
        cur.play = !cur.play; this.setAttribute('aria-pressed', String(cur.play)); this.textContent = cur.play ? '⏸ durdur' : '▶ oynat';
        if (cur.play) { P.forEach(gizle); adim(0); }
        else { durdur(); devam = null; hk.classList.remove('konus'); bal.textContent = 'Durdurdum. Devam etmek için ▶ oynat.'; P.forEach(function (L, j) { if (acik || j < m) ac(L); }); }
      };
      if (cur.play) setTimeout(function () { if (cur.play && cur.sahne === k && body.contains(bal)) adim(0); }, 500);
      if (k === S.length - 1) put(H.id, { a: 1 });
      ctxSend();
    };
    draw();
  };
  var gorsel = function (H, body) {
    var G = H.gorsel;
    body.innerHTML = '<div class="is-at"><div class="is-hk" style="margin-bottom:10px">' + IST.hoca(48) + '<div class="is-bal"><b>' + G.b + '.</b> ' + G.t + '</div></div><div data-at></div>' +
      '<div class="is-sahne-nav" style="margin-top:18px"><span style="flex:1"></span><button type="button" class="btn sm pri" data-tos>sorulara geç →</button></div></div>';
    var touched = false, api = { dokundu: function () { if (!touched) { touched = true; put(H.id, { g: 1 }); } } };
    body.querySelector('[data-at]').addEventListener('input', function () { api.dokundu(); });
    body.querySelector('[data-at]').addEventListener('click', function (e) { if (e.target.closest('button,input,svg')) api.dokundu(); });
    lsafe(function () { G.kur(body.querySelector('[data-at]'), api); });
    body.querySelector('[data-tos]').onclick = function () { api.dokundu(); IST.go(H.id, 's'); };
    ctxSend();
  };
  /* özet ve formül kartı (yazdırılabilir) */
  var ozet = function (H, body) {
    var O = (IST.OZET || {})[H.id] || { m: [], f: [] };
    body.innerHTML = '<div class="is-oz" style="--cc:' + H.renk + '"><div class="is-oz-h"><div><span class="k">' + (H.donem === 'bahar' ? 'Statistics for Business II' : 'Statistics for Business I') + ' · ' + H.no + '. hafta</span><h2 class="disp">' + X(H.tr) + '</h2><small>' + X(H.en) + '</small></div><button type="button" class="btn sm" data-yaz>🖨 yazdır / PDF</button></div>' +
      '<div class="is-oz-g"><section><h3>Bu haftanın özeti</h3><ul>' + O.m.map(function (m) { return '<li>' + m + '</li>'; }).join('') + '</ul></section>' +
      '<section><h3>Formül kartı</h3><table class="tb"><tbody>' + O.f.map(function (f) { return '<tr><td>' + f[0] + (f[2] ? '<small style="display:block;color:var(--muted)">' + f[2] + '</small>' : '') + '</td><td class="mono">' + f[1] + '</td></tr>'; }).join('') + '</tbody></table></section></div>' +
      '<p class="is-oz-n">Acadex İstatistik · Veri Hoca’nın özet kartı</p></div>';
    body.querySelector('[data-yaz]').onclick = function () { D.body.classList.add('is-yazdir'); var bit = function () { D.body.classList.remove('is-yazdir'); W.removeEventListener('afterprint', bit); }; W.addEventListener('afterprint', bit); lsafe(function () { W.print(); }); setTimeout(bit, 1500); };
    ctxSend();
  };

  /* ---------- soru kartı (alıştırma ve sınav ortak) ----------
     o.sinav: ipucu/çözüm yok, anında geri bildirim yok; cevap kaydedilir, puan oku() ile alınır.
     13.11.2026 · senaryo görseli: Q.viz(adım) varsa o çizilir; yoksa sorudaki sayılar “veri kartları”na,
     sorudaki sayı listesi nokta grafiğine dönüşür (IST.senaryo). Animasyonlu çözüm: çözüm adımları kara
     tahtaya tebeşirle yazılır; her adımda Q.viz yeniden çizilir, kullanılan veri kartları ve tablodaki
     ilgili hücreler parlar. */
  var HARF = 'ABCDE';
  var duz = function (h) { return String(h || '').replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' '); };
  var sayilar = function (t) { return (duz(t).match(/[−-]?\d[\d.]*(?:,\d+)?/g) || []).map(function (x) { return x.replace(/^−/, '-'); }); };
  var SAHNE_IC = [[/kafe|kahve|tatlı|fırın|sipariş/i, '☕'], [/banka|kredi|faiz|mobil şube|maaş/i, '🏦'], [/fabrika|üretim|makine|dolum|parça|montaj|sensör|ambalaj/i, '🏭'], [/kargo|teslim|kurye/i, '📦'], [/otel/i, '🏨'], [/market|mağaza|sepet|şube|bayi|zincir/i, '🛒'], [/çağrı merkezi|görüşme|arama|temsilci/i, '📞'], [/öğrenci|sınav|ders|eğitim|puan/i, '🎓'], [/hasta|ilaç|eczane|diyet|tansiyon/i, '🏥'], [/anket|seçim|parti|tercih/i, '🗳️'], [/otopark|araç|otoyol|lastik|asansör|metro|otobüs/i, '🚗'], [/zar/i, '🎲'], [/web|uygulama|site|A\/B/i, '📱'], [/enerji|elektrik/i, '⚡'], [/yatırım|hisse|ciro|girişim|fon/i, '📈'], [/spor/i, '🏋️'], [/kütüphane|kitap/i, '📚'], [/laboratuvar|numune/i, '🧪'], [/sigorta|poliçe/i, '🛡️'], [/sıcaklık|°C/i, '🌡️']];
  IST.senaryo = function (Q, k, kullan) {
    var t = duz(Q.q), ic = '📊'; SAHNE_IC.some(function (p) { if (p[0].test(t)) { ic = p[1]; return true; } return false; });
    var ch = [], gor = {};
    (Q.q.match(/[A-Za-zμσλαβρχΣ][₀₁₂²̂̄A-Za-z]{0,3}\s*(?:<sub>[^<]*<\/sub>)?\s*=\s*[−-]?\d[\d.,]*%?/g) || []).forEach(function (m) { var s = duz(m).replace(/\s+/g, ' ').trim().replace(/[,.;:]+$/, ''); if (!gor[s]) { gor[s] = 1; ch.push(s); } });
    (Q.q.match(/<b>([^<]*\d[^<]*)<\/b>/g) || []).forEach(function (m) { var s = duz(m).replace(/\s+/g, ' ').trim(); s = s.replace(/[,.;:]+$/, ''); if (/^(%\s?)?[−-]?\d[\d.,]*\s?(%|°C?|[a-zçğıöşü²³]{1,4}|TL|ml|kg|dk|bin TL)?$/i.test(s) && !gor[s] && !ch.some(function (c) { return c.indexOf(s) >= 0; })) { gor[s] = 1; ch.push(s); } });
    ch = ch.slice(0, 6);
    var liste = (Q.q.match(/class="mono"[^>]*>([^<]+)</) || [])[1], dots = '';
    if (liste && !Q.g) { var L = sayilar(liste).map(function (x) { return parseFloat(x.replace(/\./g, '').replace(',', '.')); }).filter(isFinite); if (L.length >= 4 && L.length <= 30) { var mn = Math.min.apply(null, L), mx = Math.max.apply(null, L), st = V.nice((mx - mn) / 6 || 1), lo = Math.floor(mn / st) * st, hi = Math.ceil(mx / st) * st; var isik = {}; (kullan || []).forEach(function (x) { isik[x] = 1; }); dots = V.dots({ v: L, min: lo, max: hi === lo ? lo + st : hi, step: st, h: 120, r: 7, stag: 0.03, hi: function (v) { return isik[String(v).replace('.', ',')]; } }); } }
    if (!ch.length && !dots) return '';
    return '<div class="q-sh"><span class="q-ic pop" aria-hidden="true">' + ic + '</span><div class="q-chips">' + ch.map(function (c, i) { var on = (kullan || []).some(function (u) { return c.replace(/\s/g, '').indexOf(u) >= 0; }); return '<span class="pop' + (on ? ' on' : '') + '" ' + V.d(0.08 * i) + '>' + X(c) + '</span>'; }).join('') + '</div></div>' + (dots ? '<div class="q-dots">' + dots + '</div>' : '');
  };
  var soruKart = function (Q, qi, r, o) {
    o = o || {};
    var el = D.createElement('div'); el.className = 'q'; el.style.animationDelay = (qi * 0.05) + 's';
    var ord = Q.o ? r.shuf(Q.o.map(function (_, i) { return i; })) : null, secim = null, ilk = null, cevap = null;
    el.innerHTML = '<div class="q-h"><span>Soru ' + (qi + 1) + '</span>' + (o.etiket ? '<span class="tag" style="background:' + o.renk + '">' + X(o.etiket) + '</span>' : '') + (Q.tag ? '<span class="tag">' + X(Q.tag) + '</span>' : '') + '<span class="st" data-qst></span></div>' +
      '<div class="q-sv" data-sv></div>' +
      '<div class="q-b' + (Q.g && !Q.wide ? ' g2' : '') + '"><div class="q-q">' + Q.q + '</div>' + (Q.g ? '<div class="q-g fig" data-qg>' + Q.g + '</div>' : '') +
      (ord ? '<div class="q-o">' + ord.map(function (i, j) { return '<button type="button" data-o="' + i + '"><i>' + HARF[j] + '</i><span>' + Q.o[i] + '</span></button>'; }).join('') + '</div>'
        : '<div class="q-n"><label class="vh" for="qn' + o.pre + qi + '">cevap</label><input id="qn' + o.pre + qi + '" inputmode="decimal" autocomplete="off" placeholder="' + X(Q.ph || 'cevap') + '"><button type="button" class="btn sm pri" data-ck>' + (o.sinav ? 'kaydet' : 'kontrol et') + '</button>' + (Q.birim ? '<small>' + X(Q.birim) + '</small>' : '') + '<small>' + X(Q.not || 'ondalık için virgül ya da nokta; kesir de olur (3/8)') + '</small></div>') +
      '<div class="q-fb" data-fb aria-live="polite"></div><div class="q-f"' + (o.sinav ? ' hidden' : '') + '><button type="button" class="btn sm ghost" data-ip>💡 ipucu</button><button type="button" class="btn sm ghost" data-cz>adım adım çözüm</button></div><div data-ipb></div><div data-czb></div></div>';
    var fb = el.querySelector('[data-fb]'), stEl = el.querySelector('[data-qst]'), sv = el.querySelector('[data-sv]');
    /* senaryo görseli; k = gösterilen çözüm adımı sayısı */
    var sahne = function (k) {
      var used = []; Q.cz.slice(0, k).forEach(function (s) { used = used.concat(sayilar(s)); });
      var h = '';
      if (Q.viz) h = lsafe(function () { return Q.viz(k) || ''; }, '');
      h = (Q.viz && Q.vizOnly ? '' : IST.senaryo(Q, k, used)) + (h ? '<div class="q-viz fig">' + h + '</div>' : '');
      sv.innerHTML = h; sv.hidden = !h;
      var g = el.querySelector('[data-qg]');
      if (g && k) { var son = sayilar(Q.cz[k - 1]); [].forEach.call(g.querySelectorAll('td'), function (td) { var t = duz(td.innerHTML).trim(); td.classList.toggle('cz-on', !!t && son.indexOf(t) >= 0); }); }
    };
    sahne(0);
    var mark = function (good) { if (ilk === null) { ilk = good; if (!o.sinav) { stEl.textContent = good ? '✓ ilk denemede' : '✗ ilk deneme'; stEl.style.color = good ? 'var(--ok)' : 'var(--bad)'; } if (o.on) o.on(qi, good); } };
    var dogruMu = function (v) { var tol = Q.tol != null ? Q.tol : Math.max(Math.abs(Q.say) * 0.005, 0.0051); return Math.abs(v - Q.say) <= tol; };
    if (ord) [].forEach.call(el.querySelectorAll('[data-o]'), function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-o'), good = i === Q.a;
        if (o.sinav) { secim = i; [].forEach.call(el.querySelectorAll('[data-o]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); x.classList.toggle('sec', x === b); }); stEl.textContent = 'cevaplandı'; if (o.on) o.on(qi, null); return; }
        mark(good);
        if (good) { [].forEach.call(el.querySelectorAll('[data-o]'), function (x) { x.disabled = true; }); b.classList.add('ok'); fb.innerHTML = '<b style="color:var(--ok)">Doğru.</b> ' + (Q.n || ''); }
        else { b.classList.add('no'); b.disabled = true; fb.innerHTML = '<b style="color:var(--bad)">Bu değil.</b> ' + (Q.yn && Q.yn[i] ? Q.yn[i] : 'İpucuna bakıp yeniden dene.'); }
      };
    });
    else {
      var inp = el.querySelector('input'), ck = el.querySelector('[data-ck]');
      var check = function () {
        var v = IST.parse(inp.value); if (isNaN(v)) { fb.innerHTML = 'Bir sayı yaz (örnek: ' + X(Q.ornek || '0,25') + ').'; return; }
        if (o.sinav) { cevap = v; stEl.textContent = 'kaydedildi'; fb.textContent = ''; if (o.on) o.on(qi, null); return; }
        var good = dogruMu(v);
        mark(good); inp.classList.toggle('ok', good); inp.classList.toggle('no', !good);
        fb.innerHTML = good ? '<b style="color:var(--ok)">Doğru.</b> Cevap: <b>' + Q.goster + '</b>. ' + (Q.n || '') : '<b style="color:var(--bad)">Tam değil.</b> ' + (Q.yanlis ? Q.yanlis(v) : 'Adımları kontrol et; ipucu yardımcı olabilir.');
        if (good) { inp.disabled = true; ck.disabled = true; }
      };
      ck.onclick = check; inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
    }
    el.querySelector('[data-ip]').onclick = function () { el.querySelector('[data-ipb]').innerHTML = '<div class="q-ip">💡 ' + Q.ip + '</div>'; };
    el.querySelector('[data-cz]').onclick = function () {
      if (ilk === null && !o.bitti) mark(false);
      var box = el.querySelector('[data-czb]'), n = 1;
      var dr = function () {
        box.innerHTML = '<div class="q-cz"><div class="q-cz-h">' + IST.hoca(40) + '<b>Adım adım çözüm</b><span>' + n + ' / ' + Q.cz.length + '</span></div><ol>' + Q.cz.slice(0, n).map(function (s, i) { return '<li' + (i === n - 1 ? ' class="yeni"' : '') + '>' + s + '</li>'; }).join('') + '</ol>' +
          (n < Q.cz.length ? '<div class="q-cz-n"><button type="button" class="btn sm" data-cn>sonraki adım</button> <button type="button" class="btn sm ghost" data-ca>hepsini göster</button></div>' : '') + '</div>';
        sahne(n);
        var cn = box.querySelector('[data-cn]'); if (cn) { cn.onclick = function () { n++; dr(); }; box.querySelector('[data-ca]').onclick = function () { n = Q.cz.length; dr(); }; }
        if (Q.viz && !calm) lsafe(function () { if (sv.getBoundingClientRect().bottom < 0) sv.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      };
      dr();
    };
    /* sınav sonunda: notla, kilitle, çözümü aç */
    el.oku = function () {
      o.bitti = true; var good;
      if (ord) { good = secim === Q.a; [].forEach.call(el.querySelectorAll('[data-o]'), function (x) { x.disabled = true; var i = +x.getAttribute('data-o'); if (i === Q.a) x.classList.add('ok'); else if (i === secim) x.classList.add('no'); }); }
      else { var inp2 = el.querySelector('input'); good = cevap != null && dogruMu(cevap); inp2.disabled = true; el.querySelector('[data-ck]').disabled = true; inp2.classList.add(good ? 'ok' : 'no'); }
      stEl.textContent = good ? '✓ doğru' : (ord ? secim : cevap) == null ? '— boş' : '✗ yanlış'; stEl.style.color = good ? 'var(--ok)' : 'var(--bad)';
      fb.innerHTML = good ? '<b style="color:var(--ok)">Doğru.</b>' : '<b style="color:var(--bad)">Doğru cevap:</b> ' + (ord ? HARF[ord.indexOf(Q.a)] + ') ' + Q.o[Q.a] : Q.goster);
      el.querySelector('.q-f').hidden = false; return good;
    };
    return el;
  };

  /* ---------- yeni nesil sorular ---------- */
  var sorular = function (H, body) {
    var seed = cur.seed || ((Date.now() / 1000) | 0), r = IST.rng(seed * 7 + H.no + (H.donem === 'bahar' ? 100 : 0)), list = lsafe(function () { return H.sorular(r); }, []);
    var res = list.map(function () { return null; });
    body.innerHTML = '<div class="is-sor"><div class="is-sor-h"><div class="is-hk">' + IST.hoca(48) + '<div class="is-bal"><b>Yeni nesil sorular.</b> ' + list.length + ' soru; senaryo, tablo ve grafik okuma. Takılırsan önce <b>ipucu</b>, sonra <b>adım adım çözüm</b>. Puan ilk denemene göre.</div></div>' +
      '<button type="button" class="btn sm" data-yeni>↻ yeni soru seti</button></div><div data-qs style="display:grid;gap:14px"></div><div data-karne></div></div>';
    var yeni = function () { cur.seed = ((Date.now() / 1000) | 0) + Math.floor(Math.random() * 1e5); sorular(H, body); };
    body.querySelector('[data-yeni]').onclick = yeni;
    var qs = body.querySelector('[data-qs]');
    var bitti = function () {
      if (res.some(function (x) { return x === null; })) return;
      var ok = res.filter(Boolean).length, pc = Math.round(ok / res.length * 100);
      put(H.id, { s: pc });
      var nx = IST.H[IST.H.indexOf(H) + 1];
      body.querySelector('[data-karne]').innerHTML = '<div class="is-karne"><b>' + ok + ' / ' + res.length + '</b><div><p>' + (pc >= 80 ? 'Harika! Bu haftanın konusu oturmuş görünüyor.' : pc >= 60 ? 'İyi gidiyorsun; yanlışlarının çözüm adımlarını bir kez daha oku.' : 'Anlatıma geri dönüp sahneleri tekrar izle, sonra yeni bir soru setiyle dene.') +
        ' Sorular her sette yeni sayılarla gelir.</p><div class="row" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn sm" data-yeni2>yeni soru seti</button><button type="button" class="btn sm" data-go="' + H.id + '" data-st-go="o">özet kartı ★</button>' + (nx ? '<button type="button" class="btn sm" data-go="' + nx.id + '">' + nx.no + '. haftaya geç →</button>' : '<button type="button" class="btn sm" data-go="yol">ders yoluna dön</button>') + '</div></div></div>';
      body.querySelector('[data-yeni2]').onclick = function () { yeni(); top(); };
      body.querySelector('[data-st-go]').onclick = function (e) { e.stopPropagation(); IST.go(H.id, 'o'); };
      main.querySelectorAll('.is-adim [data-st="s"]').forEach(function (b) { if (pc >= 60) { b.classList.add('ok'); b.querySelector('i').textContent = '✓'; } });
    };
    list.forEach(function (Q, qi) { qs.appendChild(soruKart(Q, qi, r, { pre: 'a', on: function (i, g) { res[i] = g; bitti(); } })); });
    ctxSend();
  };

  /* ---------- sınav provası: haftalardan karışık, süreli; sonunda karne ve çözümler ---------- */
  var prova = function (P) {
    durdur();
    var r = IST.rng((Date.now() / 1000 | 0) + Math.floor(Math.random() * 1e5)), list = [];
    P.hf.forEach(function (k) { var H = IST.by[k]; if (!H) return; var L = lsafe(function () { return H.sorular(IST.rng(r.int(1, 1e9))); }, []); r.shuf(L).slice(0, 2).forEach(function (Q) { list.push({ Q: Q, H: H }); }); });
    list = r.shuf(list);
    var sure = list.length * 150, kal = sure, kartlar = [], cev = 0, bitti = false;
    main.innerHTML = '<div class="is-ders is-prova"><div class="is-dh"><div><span class="k">Sınav provası</span><h1 class="disp">' + X(P.ad) + '<small>' + list.length + ' soru · ipucu yok · sonunda karne ve çözümler</small></h1></div>' +
      '<div class="is-saat" data-saat><b data-kal></b><small data-cev>0 / ' + list.length + ' cevap</small></div></div><div data-qs style="display:grid;gap:14px"></div>' +
      '<div class="is-sonraki"><button type="button" class="btn pri" data-bitir>sınavı bitir</button></div><div data-karne></div></div>';
    crumb.textContent = P.ad;
    var qs = main.querySelector('[data-qs]'), kalEl = main.querySelector('[data-kal]');
    var on = function () { cev = kartlar.filter(function (k) { return k.querySelector('[data-qst]').textContent; }).length; main.querySelector('[data-cev]').textContent = cev + ' / ' + list.length + ' cevap'; };
    list.forEach(function (x, i) { var el = soruKart(x.Q, i, r, { pre: 'p', sinav: true, etiket: x.H.no + '. hafta', renk: x.H.renk, on: on }); kartlar.push(el); qs.appendChild(el); });
    var yaz = function () { var m = Math.floor(kal / 60), s = kal % 60; kalEl.textContent = m + ':' + (s < 10 ? '0' : '') + s; main.querySelector('[data-saat]').classList.toggle('az', kal <= 60); };
    var bitir = function () {
      if (bitti) return; bitti = true; clearInterval(prova.t);
      var ok = 0, hf = {};
      kartlar.forEach(function (el, i) { var g = el.oku(); if (g) ok++; var h = list[i].H.id; hf[h] = hf[h] || [0, 0]; hf[h][1]++; if (g) hf[h][0]++; });
      var pc = Math.round(ok / list.length * 100), zayif = Object.keys(hf).filter(function (k) { return hf[k][0] < hf[k][1]; });
      put(P.id, { s: pc });
      main.querySelector('[data-bitir]').disabled = true;
      main.querySelector('[data-karne]').innerHTML = '<div class="is-karne" style="margin-top:14px"><b>%' + pc + '</b><div><p>' + ok + ' / ' + list.length + ' doğru · süre ' + Math.round((sure - kal) / 60) + ' dk. ' + (pc >= 70 ? 'Sınava hazırsın gibi görünüyor!' : 'Aşağıdaki haftaları tekrar etmeni öneririm.') + '</p>' +
        '<div class="is-pvk">' + Object.keys(hf).map(function (k) { var H = IST.by[k], v = hf[k]; return '<button type="button" class="btn sm' + (v[0] < v[1] ? '' : ' ghost') + '" data-go="' + k + '">' + H.no + '. hafta ' + v[0] + '/' + v[1] + '</button>'; }).join('') + '</div>' +
        '<p style="margin-top:8px">Her sorunun altındaki “adım adım çözüm” artık açık.' + (zayif.length ? ' Zayıf haftalar: ' + zayif.map(function (k) { return IST.by[k].no + '.'; }).join(', ') + ' hafta.' : '') + '</p></div></div>';
      main.querySelector('[data-karne]').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    };
    main.querySelector('[data-bitir]').onclick = function () { if (cev < list.length && !W.confirm) { bitir(); return; } bitir(); };
    clearInterval(prova.t); yaz();
    prova.t = setInterval(function () { if (!main.contains(kalEl)) { clearInterval(prova.t); return; } kal--; yaz(); if (kal <= 0) { IST.toast('Süre doldu'); bitir(); } }, 1000);
    ctxSend();
  };

  /* ---------- yönlendirme ---------- */
  IST.go = function (tab, step) {
    var P = IST.PROVA.filter(function (x) { return x.id === tab; })[0];
    if (tab !== 'yol' && !IST.by[tab] && !P) tab = 'yol';
    var same = cur.tab === tab;
    durdur(); clearInterval(prova.t);
    if (!same) cur.play = false;
    cur.tab = tab; cur.step = step || (same ? cur.step : 'a'); if (!same) { cur.sahne = 0; cur.seed = null; }
    if (tab === 'yol') yol(); else if (P) prova(P); else ders(IST.by[tab], cur.step);
    setUrl(); ctxSend(); top();
  };
  IST.cur = cur;
  IST.start = function () {
    main = D.getElementById('main'); crumb = D.getElementById('crumb'); toastEl = D.getElementById('toast');
    IST.H.sort(function (a, b) { return (a.donem === b.donem ? 0 : a.donem === 'guz' ? -1 : 1) || a.no - b.no; });
    D.addEventListener('click', function (e) {
      var g = e.target.closest && e.target.closest('[data-go]'); if (g) { IST.go(g.getAttribute('data-go')); return; }
      var s = e.target.closest && e.target.closest('[data-st]'); if (s && s.closest('.is-adim')) { IST.go(cur.tab, s.getAttribute('data-st')); }
    });
    D.addEventListener('keydown', function (e) {
      if (cur.step !== 'a' || !IST.by[cur.tab] || /INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target.tagName || ''))) return;
      if (e.key === 'ArrowRight') { var n = main.querySelector('[data-sn],[data-tog]'); if (n) n.click(); }
      else if (e.key === 'ArrowLeft') { var b = main.querySelector('[data-sp]'); if (b && !b.disabled) b.click(); }
      else if (e.key === ' ') { var p = main.querySelector('[data-play]'); if (p) { e.preventDefault(); p.click(); } }
    });
    var t = lsafe(function () { return new URL(location.href).searchParams.get('tab'); }, null) || 'yol';
    IST.go(t);
  };
})();
