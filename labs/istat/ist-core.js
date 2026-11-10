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
  IST.hafta = function (h) { IST.H.push(h); IST.by[h.id] = h; };

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
      about: 'öğrenci Acadex İstatistik giriş dersinde (Statistics for Business I), ' + H.no + '. hafta "' + H.tr + ' (' + H.en + ')" dersinin ' + adim + ' bölümünde' +
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

  /* ---------- yol haritası ---------- */
  IST.BAHAR = [
    [1, 'Örnekleme yöntemleri', 'Sampling Methods'], [2, 'Nokta tahmini', 'Point Estimation'], [3, 'Aralık tahmini', 'Interval Estimation'],
    [4, 'Tek örneklem hipotez testi I', 'One Sample Hypothesis Testing'], [5, 'Tek örneklem hipotez testi II', 'One Sample Hypothesis Testing 2'],
    [6, 'İki örneklem hipotez testi', 'Two Samples Hypothesis Testing'], [7, 'Varyans analizi', 'ANOVA'], [9, 'Korelasyon', 'Correlation'],
    [10, 'Regresyon analizi', 'Regression Analysis'], [11, 'Parametrik olmayan testler I', 'Non-Parametric Statistics I'],
    [12, 'Parametrik olmayan testler II', 'Non-Parametric Statistics II'], [13, 'İndeks sayıları', 'Index Numbers'], [14, 'Karar teorisi', 'Decision Theory']
  ];
  var yol = function () {
    var p = prog(), done = 0, parts = 0;
    IST.H.forEach(function (H) { var q = IST.parts(p[H.id]); parts += q.filter(Boolean).length; if (q[0] && q[1] && q[2]) done++; });
    var tot = IST.H.length * 3, pc = tot ? parts / tot : 0, C = 2 * Math.PI * 46;
    var kart = function (H, i) {
      var q = IST.parts(p[H.id]), r = p[H.id] || {}, all = q[0] && q[1] && q[2];
      return '<li style="--i:' + i + ';--cc:' + H.renk + '"><button type="button" class="is-wk' + (all ? ' done' : '') + '" data-go="' + H.id + '">' +
        '<span class="no"><b>' + H.no + '. HAFTA</b>' + (p.last === H.id ? '<span>kaldığın yer</span>' : '') + '</span>' +
        '<h3 class="disp">' + X(H.tr) + '<small>' + X(H.en) + '</small></h3>' +
        '<span class="parts" aria-label="anlatım ' + (q[0] ? 'bitti' : 'bekliyor') + ', görsel ' + (q[1] ? 'bitti' : 'bekliyor') + ', sorular ' + (q[2] ? 'geçti' : 'bekliyor') + '"><i class="' + (q[0] ? 'on' : '') + '"></i><i class="' + (q[1] ? 'on' : '') + '"></i><i class="' + (q[2] ? 'on' : '') + '"></i><span>' + (r.s != null ? '%' + r.s : all ? '✓' : '') + '</span></span></button></li>';
    };
    var guz = IST.H.slice().sort(function (a, b) { return a.no - b.no; }), html = '', i = 0;
    guz.forEach(function (H) {
      if (H.no === 9) html += '<li style="--i:' + (i++) + '"><div class="is-ara"><span><b>8</b>ara sınav haftası<br>(midterm)</span></div></li>';
      html += kart(H, i++);
    });
    main.innerHTML = '<div class="is-hero"><div><span class="hand" style="font-size:22px;color:var(--rust)">Statistics for Business I · II</span><h1 class="disp">İstatistiğe giriş<br>haftalık ders yolu</h1>' +
      '<p>Her hafta üç adım: <b>animasyonlu anlatım</b>, <b>etkileşimli görsel</b> ve <b>yeni nesil sorular</b>. Sıra ders notlarındakiyle aynı; terimlerin İngilizcesi yanında.</p></div>' +
      '<div class="is-ring" aria-label="ilerleme yüzde ' + Math.round(pc * 100) + '"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="46" fill="none" stroke="#E6E0D2" stroke-width="10"/><circle cx="56" cy="56" r="46" fill="none" stroke="#0D1838" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * pc).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><b class="disp">%' + Math.round(pc * 100) + '</b><small>' + done + ' / ' + IST.H.length + ' hafta</small></div></div>' +
      '<div class="is-donem"><h2 class="disp">Güz dönemi</h2><span>Statistics for Business I · betimsel istatistik, olasılık ve dağılımlar</span></div><ol class="is-yol">' + html + '</ol>' +
      '<div class="is-donem"><h2 class="disp">Bahar dönemi</h2><span>Statistics for Business II · yakında</span></div><ol class="is-yol">' +
      IST.BAHAR.map(function (b, j) { return '<li style="--i:' + (j + i) + '"><div class="is-wk lock" aria-disabled="true"><span class="no"><b>' + b[0] + '. HAFTA</b></span><h3 class="disp">' + X(b[1]) + '<small>' + X(b[2]) + '</small></h3><span class="is-soon">yakında</span></div></li>'; }).join('') + '</ol>' +
      '<p class="is-not">Ders notları: Statistics for Business I–II (güz ve bahar). Sorulardaki şirketler ve sayılar ders amaçlı kurgusaldır; her "yeni soru seti" sayıları yeniden üretir.</p>';
    crumb.textContent = 'Ders yolu';
  };

  /* ---------- ders ---------- */
  var ders = function (H, step) {
    var p = prog()[H.id] || {}, q = IST.parts(p);
    main.innerHTML = '<div class="is-ders" style="--cc:' + H.renk + '"><div class="is-dh"><div><span class="k">' + H.no + '. hafta · Güz</span><h1 class="disp">' + X(H.tr) + '<small>' + X(H.en) + '</small></h1></div>' +
      '<div class="is-adim" role="tablist" aria-label="Dersin adımları">' +
      [['a', 'Anlatım', 0], ['g', 'Görsel', 1], ['s', 'Sorular', 2]].map(function (t) { return '<button type="button" role="tab" data-st="' + t[0] + '" aria-selected="' + (step === t[0]) + '" class="' + (q[t[2]] ? 'ok' : '') + '"><i>' + (q[t[2]] ? '✓' : t[2] + 1) + '</i><span>' + t[1] + '</span></button>'; }).join('') +
      '</div></div><div class="is-card" data-body></div><div class="is-sonraki" data-alt></div></div>';
    crumb.innerHTML = '<span>' + H.no + '. hafta</span><span aria-hidden="true">·</span><span>' + X(H.tr) + '</span>';
    var body = main.querySelector('[data-body]');
    if (step === 'a') anlatim(H, body);
    else if (step === 'g') gorsel(H, body);
    else sorular(H, body);
    var alt = main.querySelector('[data-alt]'), i = IST.H.indexOf(H), nx = IST.H[i + 1], pv = IST.H[i - 1];
    alt.innerHTML = (pv ? '<button type="button" class="btn ghost" data-go="' + pv.id + '">← ' + pv.no + '. hafta</button>' : '') + '<button type="button" class="btn ghost" data-go="yol">ders yolu</button>' + (nx ? '<button type="button" class="btn" data-go="' + nx.id + '">' + nx.no + '. hafta →</button>' : '');
  };
  var anlatim = function (H, body) {
    var S = H.sahneler, k = Math.min(cur.sahne || 0, S.length - 1);
    var draw = function () {
      cur.sahne = k; var s = S[k];
      body.innerHTML = '<div class="is-sahne"><div class="is-metin"><span class="sn">SAHNE ' + (k + 1) + ' / ' + S.length + '</span><h2 class="disp">' + s.b + '</h2><div class="tx">' + s.t + '</div>' +
        (s.terim ? '<div class="is-terimler">' + s.terim.map(function (t) { return '<span>' + X(t[0]) + ' <em>· ' + X(t[1]) + '</em></span>'; }).join('') + '</div>' : '') +
        '<div class="is-sahne-nav"><div class="is-dots">' + S.map(function (_, j) { return '<button type="button" data-sj="' + j + '" class="' + (j < k ? 'on' : '') + '"' + (j === k ? ' aria-current="true"' : '') + ' aria-label="sahne ' + (j + 1) + '"></button>'; }).join('') + '</div>' +
        '<button type="button" class="btn sm ghost" data-sp' + (k ? '' : ' disabled') + '>← geri</button>' +
        (k < S.length - 1 ? '<button type="button" class="btn sm pri" data-sn>ileri →</button>' : '<button type="button" class="btn sm pri" data-tog>görsele geç →</button>') + '</div></div>' +
        '<div class="is-gor"><button type="button" class="btn sm ghost tekrar" data-rp title="animasyonu yeniden oynat">↻ tekrar</button><div class="fig" data-v></div></div></div>';
      var v = body.querySelector('[data-v]');
      lsafe(function () { v.innerHTML = typeof s.v === 'function' ? s.v() : (s.v || ''); });
      if (s.kur) lsafe(function () { s.kur(v); });
      body.querySelector('[data-rp]').onclick = function () { var h = v.innerHTML; v.innerHTML = ''; void v.offsetWidth; v.innerHTML = typeof s.v === 'function' ? s.v() : h; if (s.kur) s.kur(v); };
      var sp = body.querySelector('[data-sp]'); sp.onclick = function () { if (k) { k--; draw(); } };
      var sn = body.querySelector('[data-sn]'); if (sn) sn.onclick = function () { k++; draw(); if (k === S.length - 1) put(H.id, { a: 1 }); };
      var tg = body.querySelector('[data-tog]'); if (tg) tg.onclick = function () { put(H.id, { a: 1 }); IST.go(H.id, 'g'); };
      [].forEach.call(body.querySelectorAll('[data-sj]'), function (b) { b.onclick = function () { k = +b.getAttribute('data-sj'); draw(); if (k === S.length - 1) put(H.id, { a: 1 }); }; });
      if (k === S.length - 1) put(H.id, { a: 1 });
      ctxSend();
    };
    draw();
  };
  var gorsel = function (H, body) {
    var G = H.gorsel;
    body.innerHTML = '<div class="is-at"><h2 class="disp">' + G.b + '</h2><p>' + G.t + '</p><div data-at></div>' +
      '<div class="is-sahne-nav" style="margin-top:18px"><span style="flex:1"></span><button type="button" class="btn sm pri" data-tos>sorulara geç →</button></div></div>';
    var touched = false, api = { dokundu: function () { if (!touched) { touched = true; put(H.id, { g: 1 }); } } };
    body.querySelector('[data-at]').addEventListener('input', function () { api.dokundu(); });
    body.querySelector('[data-at]').addEventListener('click', function (e) { if (e.target.closest('button,input,svg')) api.dokundu(); });
    lsafe(function () { G.kur(body.querySelector('[data-at]'), api); });
    body.querySelector('[data-tos]').onclick = function () { api.dokundu(); IST.go(H.id, 's'); };
    ctxSend();
  };

  /* ---------- yeni nesil sorular ---------- */
  var HARF = 'ABCDE';
  var sorular = function (H, body) {
    var seed = cur.seed || ((Date.now() / 1000) | 0), r = IST.rng(seed * 7 + H.no), list = lsafe(function () { return H.sorular(r); }, []);
    var res = list.map(function () { return null; });
    body.innerHTML = '<div class="is-sor"><div class="is-sor-h"><div><h2 class="disp">Yeni nesil sorular</h2><p>' + list.length + ' soru · senaryo, tablo ve grafik okuma. Takılırsan önce <b>ipucu</b>, sonra <b>adım adım çözüm</b>. Puan ilk denemene göre.</p></div>' +
      '<button type="button" class="btn sm" data-yeni>↻ yeni soru seti</button></div><div data-qs style="display:grid;gap:14px"></div><div data-karne></div></div>';
    body.querySelector('[data-yeni]').onclick = function () { cur.seed = ((Date.now() / 1000) | 0) + Math.floor(Math.random() * 1e5); sorular(H, body); };
    var qs = body.querySelector('[data-qs]');
    var bitti = function () {
      if (res.some(function (x) { return x === null; })) return;
      var ok = res.filter(Boolean).length, pc = Math.round(ok / res.length * 100);
      put(H.id, { s: pc });
      var nx = IST.H[IST.H.indexOf(H) + 1];
      body.querySelector('[data-karne]').innerHTML = '<div class="is-karne"><b>' + ok + ' / ' + res.length + '</b><div><p>' + (pc >= 80 ? 'Harika! Bu haftanın konusu oturmuş görünüyor.' : pc >= 60 ? 'İyi gidiyorsun; yanlışlarının çözüm adımlarını bir kez daha oku.' : 'Anlatıma geri dönüp sahneleri tekrar izle, sonra yeni bir soru setiyle dene.') +
        ' Sorular her sette yeni sayılarla gelir.</p><div class="row" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn sm" data-yeni2>yeni soru seti</button>' + (nx ? '<button type="button" class="btn sm" data-go="' + nx.id + '">' + nx.no + '. haftaya geç →</button>' : '<button type="button" class="btn sm" data-go="yol">ders yoluna dön</button>') + '</div></div></div>';
      body.querySelector('[data-yeni2]').onclick = function () { cur.seed = ((Date.now() / 1000) | 0) + Math.floor(Math.random() * 1e5); sorular(H, body); top(); };
      main.querySelectorAll('.is-adim [data-st="s"]').forEach(function (b) { if (pc >= 60) { b.classList.add('ok'); b.querySelector('i').textContent = '✓'; } });
    };
    list.forEach(function (Q, qi) {
      var el = D.createElement('div'); el.className = 'q'; el.style.animationDelay = (qi * 0.06) + 's';
      var ord = Q.o ? r.shuf(Q.o.map(function (_, i) { return i; })) : null;
      el.innerHTML = '<div class="q-h"><span>Soru ' + (qi + 1) + '</span>' + (Q.tag ? '<span class="tag">' + X(Q.tag) + '</span>' : '') + '<span class="st" data-st></span></div>' +
        '<div class="q-b' + (Q.g && !Q.wide ? ' g2' : '') + '"><div class="q-q">' + Q.q + '</div>' + (Q.g ? '<div class="q-g fig">' + Q.g + '</div>' : '') +
        (ord ? '<div class="q-o">' + ord.map(function (i, j) { return '<button type="button" data-o="' + i + '"><i>' + HARF[j] + '</i><span>' + Q.o[i] + '</span></button>'; }).join('') + '</div>'
          : '<div class="q-n"><label class="vh" for="qn' + qi + '">cevap</label><input id="qn' + qi + '" inputmode="decimal" autocomplete="off" placeholder="' + X(Q.ph || 'cevap') + '"><button type="button" class="btn sm pri" data-ck>kontrol et</button>' + (Q.birim ? '<small>' + X(Q.birim) + '</small>' : '') + '<small>' + X(Q.not || 'ondalık için virgül ya da nokta; kesir de olur (3/8)') + '</small></div>') +
        '<div class="q-fb" data-fb aria-live="polite"></div><div class="q-f"><button type="button" class="btn sm ghost" data-ip>💡 ipucu</button><button type="button" class="btn sm ghost" data-cz>adım adım çözüm</button></div><div data-ipb></div><div data-czb></div></div>';
      qs.appendChild(el);
      var fb = el.querySelector('[data-fb]'), stEl = el.querySelector('[data-st]');
      var mark = function (good) {
        if (res[qi] === null) { res[qi] = good; stEl.textContent = good ? '✓ ilk denemede' : '✗ ilk deneme'; stEl.style.color = good ? 'var(--ok)' : 'var(--bad)'; bitti(); }
      };
      if (ord) [].forEach.call(el.querySelectorAll('[data-o]'), function (b) {
        b.onclick = function () {
          var i = +b.getAttribute('data-o'), good = i === Q.a;
          mark(good);
          if (good) { [].forEach.call(el.querySelectorAll('[data-o]'), function (x) { x.disabled = true; }); b.classList.add('ok'); fb.innerHTML = '<b style="color:var(--ok)">Doğru.</b> ' + (Q.n || ''); }
          else { b.classList.add('no'); b.disabled = true; fb.innerHTML = '<b style="color:var(--bad)">Bu değil.</b> ' + (Q.yn && Q.yn[i] ? Q.yn[i] : 'İpucuna bakıp yeniden dene.'); }
        };
      });
      else {
        var inp = el.querySelector('input'), ck = el.querySelector('[data-ck]');
        var check = function () {
          var v = IST.parse(inp.value); if (isNaN(v)) { fb.innerHTML = 'Bir sayı yaz (örnek: ' + X(Q.ornek || '0,25') + ').'; return; }
          var tol = Q.tol != null ? Q.tol : Math.max(Math.abs(Q.say) * 0.005, 0.0051), good = Math.abs(v - Q.say) <= tol;
          mark(good); inp.classList.toggle('ok', good); inp.classList.toggle('no', !good);
          fb.innerHTML = good ? '<b style="color:var(--ok)">Doğru.</b> Cevap: <b>' + Q.goster + '</b>. ' + (Q.n || '') : '<b style="color:var(--bad)">Tam değil.</b> ' + (Q.yanlis ? Q.yanlis(v) : 'Adımları kontrol et; ipucu yardımcı olabilir.');
          if (good) { inp.disabled = true; ck.disabled = true; }
        };
        ck.onclick = check; inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
      }
      el.querySelector('[data-ip]').onclick = function () { el.querySelector('[data-ipb]').innerHTML = '<div class="q-ip">💡 ' + Q.ip + '</div>'; };
      el.querySelector('[data-cz]').onclick = function () {
        if (res[qi] === null) mark(false);
        var box = el.querySelector('[data-czb]'), n = 0;
        var dr = function () {
          box.innerHTML = '<div class="q-cz"><b>Adım adım çözüm</b><ol>' + Q.cz.slice(0, n).map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
            (n < Q.cz.length ? '<div><button type="button" class="btn sm" data-cn>' + (n ? 'sonraki adım' : 'ilk adım') + '</button> <button type="button" class="btn sm ghost" data-ca>hepsini göster</button></div>' : '') + '</div>';
          var cn = box.querySelector('[data-cn]'); if (cn) { cn.onclick = function () { n++; dr(); }; box.querySelector('[data-ca]').onclick = function () { n = Q.cz.length; dr(); }; }
        };
        n = 1; dr();
      };
    });
    ctxSend();
  };

  /* ---------- yönlendirme ---------- */
  IST.go = function (tab, step) {
    if (tab !== 'yol' && !IST.by[tab]) tab = 'yol';
    var same = cur.tab === tab;
    cur.tab = tab; cur.step = step || (same ? cur.step : 'a'); if (!same) { cur.sahne = 0; cur.seed = null; }
    if (tab === 'yol') yol(); else ders(IST.by[tab], cur.step);
    setUrl(); ctxSend(); top();
  };
  IST.cur = cur;
  IST.start = function () {
    main = D.getElementById('main'); crumb = D.getElementById('crumb'); toastEl = D.getElementById('toast');
    IST.H.sort(function (a, b) { return a.no - b.no; });
    D.addEventListener('click', function (e) {
      var g = e.target.closest && e.target.closest('[data-go]'); if (g) { IST.go(g.getAttribute('data-go')); return; }
      var s = e.target.closest && e.target.closest('[data-st]'); if (s && s.closest('.is-adim')) { IST.go(cur.tab, s.getAttribute('data-st')); }
    });
    D.addEventListener('keydown', function (e) {
      if (cur.step !== 'a' || cur.tab === 'yol' || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return;
      if (e.key === 'ArrowRight') { var n = main.querySelector('[data-sn],[data-tog]'); if (n) n.click(); }
      else if (e.key === 'ArrowLeft') { var b = main.querySelector('[data-sp]'); if (b && !b.disabled) b.click(); }
    });
    var t = lsafe(function () { return new URL(location.href).searchParams.get('tab'); }, null) || 'yol';
    IST.go(t);
  };
})();
