/* ==========================================================================
   ACADEX İSTATİSTİK · matematik çekirdeği (labs/istatistik/is-mat.js), 03.11.2026
   Betimsel ölçüler, olasılık dağılımları (yoğunluk, birikimli, ters), regresyon.
   Excel ve R ile aynı tanımlar:
     - çeyrekler R type 7 = Excel DÖRTTEBİRLİK.DHL (QUARTILE.INC)
     - varyans/standart sapma örneklem (n − 1) = Excel VAR.S / STDSAPMA.S, R var / sd
   Tarayıcıda window.ISM, Node'da module.exports. Ağ isteği yok.
   ========================================================================== */
(function (root) {
  'use strict';
  var M = {};
  var sum = function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; };
  var sorted = function (a) { return a.slice().sort(function (x, y) { return x - y; }); };
  M.sum = sum;
  M.mean = function (a) { return a.length ? sum(a) / a.length : NaN; };
  M.quantile = function (a, p) {
    if (!a.length) return NaN; var s = sorted(a), h = (s.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  };
  M.median = function (a) { return M.quantile(a, 0.5); };
  M.variance = function (a) { if (a.length < 2) return NaN; var m = M.mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return s / (a.length - 1); };
  M.sd = function (a) { return Math.sqrt(M.variance(a)); };
  /* mod: en sık değer(ler); hepsi bir kez geçiyorsa boş */
  M.modes = function (a) {
    var c = {}, best = 0; a.forEach(function (v) { c[v] = (c[v] || 0) + 1; if (c[v] > best) best = c[v]; });
    if (best < 2) return [];
    return Object.keys(c).filter(function (k) { return c[k] === best; }).map(Number).sort(function (x, y) { return x - y; });
  };
  /* örneklem çarpıklığı (Excel ÇARPIKLIK, R e1071 type 2) */
  M.skew = function (a) {
    var n = a.length; if (n < 3) return NaN; var m = M.mean(a), s = M.sd(a), t = 0;
    for (var i = 0; i < n; i++) t += Math.pow((a[i] - m) / s, 3);
    return n / ((n - 1) * (n - 2)) * t;
  };
  M.box = function (a) {
    var q1 = M.quantile(a, 0.25), q3 = M.quantile(a, 0.75), iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    var inn = a.filter(function (v) { return v >= lo && v <= hi; });
    return { q1: q1, med: M.median(a), q3: q3, iqr: iqr, wlo: Math.min.apply(null, inn), whi: Math.max.apply(null, inn), out: a.filter(function (v) { return v < lo || v > hi; }) };
  };
  M.sturges = function (n) { return Math.max(3, Math.ceil(Math.log2(n) + 1)); };
  M.hist = function (a, k, lo, hi) {
    lo = lo == null ? Math.min.apply(null, a) : lo; hi = hi == null ? Math.max.apply(null, a) : hi; if (hi === lo) hi = lo + 1;
    var w = (hi - lo) / k, c = []; for (var i = 0; i < k; i++) c.push(0);
    a.forEach(function (v) { var j = Math.min(k - 1, Math.max(0, Math.floor((v - lo) / w))); c[j]++; });
    return { lo: lo, w: w, c: c };
  };

  /* ---------- özel fonksiyonlar ---------- */
  var LG = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  M.lnGamma = function (z) {
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - M.lnGamma(1 - z);
    z -= 1; var x = 0.99999999999980993; for (var i = 0; i < 8; i++) x += LG[i] / (z + i + 1);
    var t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  };
  /* düzenlenmiş alt eksik gama P(a, x) */
  M.gammaP = function (a, x) {
    if (x <= 0) return 0;
    var gln = M.lnGamma(a);
    if (x < a + 1) {
      var ap = a, s = 1 / a, d = s;
      for (var n = 0; n < 500; n++) { ap++; d *= x / ap; s += d; if (Math.abs(d) < Math.abs(s) * 1e-15) break; }
      return s * Math.exp(-x + a * Math.log(x) - gln);
    }
    var b = x + 1 - a, c = 1e300, dd = 1 / b, h = dd;
    for (var i = 1; i < 500; i++) {
      var an = -i * (i - a); b += 2; dd = an * dd + b; if (Math.abs(dd) < 1e-300) dd = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      dd = 1 / dd; var del = dd * c; h *= del; if (Math.abs(del - 1) < 1e-15) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
  };
  /* düzenlenmiş eksik beta I_x(a, b) */
  var betacf = function (a, b, x) {
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; var h = d;
    for (var m = 1; m <= 500; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; var del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  };
  M.betaI = function (x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(M.lnGamma(a + b) - M.lnGamma(a) - M.lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  };
  /* tekdüze artan F için ters: ikiye bölme (sınırlar genişletilerek) */
  var inv = function (F, p, lo, hi) {
    while (F(hi) < p && hi < 1e7) hi *= 2;
    for (var i = 0; i < 200; i++) { var m = (lo + hi) / 2; if (F(m) < p) lo = m; else hi = m; if (hi - lo < 1e-12 * Math.max(1, Math.abs(m))) break; }
    return (lo + hi) / 2;
  };

  /* ---------- normal ---------- */
  M.normPdf = function (x, mu, s) { mu = mu || 0; s = s || 1; var z = (x - mu) / s; return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI)); };
  M.normCdf = function (x, mu, s) { mu = mu || 0; s = s || 1; var z = (x - mu) / s, p = 0.5 * M.gammaP(0.5, z * z / 2); return z >= 0 ? 0.5 + p : 0.5 - p; };
  /* Acklam + bir Newton adımı */
  M.normInv = function (p, mu, s) {
    mu = mu || 0; s = s || 1; if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239],
      b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
      c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
      d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416], q, r, x;
    if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p > 1 - 0.02425) { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    var e = M.normCdf(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); x = x - u / (1 + x * u / 2);
    return mu + s * x;
  };
  /* ---------- t ---------- */
  M.tPdf = function (t, v) { return Math.exp(M.lnGamma((v + 1) / 2) - M.lnGamma(v / 2)) / Math.sqrt(v * Math.PI) * Math.pow(1 + t * t / v, -(v + 1) / 2); };
  M.tCdf = function (t, v) { var x = v / (v + t * t), q = 0.5 * M.betaI(x, v / 2, 0.5); return t >= 0 ? 1 - q : q; };
  M.tInv = function (p, v) { if (p === 0.5) return 0; if (p < 0.5) return -M.tInv(1 - p, v); return inv(function (t) { return M.tCdf(t, v); }, p, 0, 10); };
  /* ---------- ki-kare ---------- */
  M.chiPdf = function (x, k) { if (x <= 0) return k === 2 ? 0.5 : 0; return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - M.lnGamma(k / 2)); };
  M.chiCdf = function (x, k) { return x <= 0 ? 0 : M.gammaP(k / 2, x / 2); };
  M.chiInv = function (p, k) { return inv(function (x) { return M.chiCdf(x, k); }, p, 0, Math.max(10, k * 3)); };
  /* ---------- F ---------- */
  M.fPdf = function (x, a, b) { if (x <= 0) return 0; return Math.exp(0.5 * (a * Math.log(a * x) + b * Math.log(b) - (a + b) * Math.log(a * x + b)) - Math.log(x) - (M.lnGamma(a / 2) + M.lnGamma(b / 2) - M.lnGamma((a + b) / 2))); };
  M.fCdf = function (x, a, b) { return x <= 0 ? 0 : M.betaI(a * x / (a * x + b), a / 2, b / 2); };
  M.fInv = function (p, a, b) { return inv(function (x) { return M.fCdf(x, a, b); }, p, 0, 10); };
  /* ---------- kesikli ---------- */
  M.lnChoose = function (n, k) { return M.lnGamma(n + 1) - M.lnGamma(k + 1) - M.lnGamma(n - k + 1); };
  M.choose = function (n, k) { return k < 0 || k > n ? 0 : Math.round(Math.exp(M.lnChoose(n, k))); };
  M.binomPmf = function (k, n, p) { if (k < 0 || k > n) return 0; if (p === 0) return k === 0 ? 1 : 0; if (p === 1) return k === n ? 1 : 0; return Math.exp(M.lnChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)); };
  M.binomCdf = function (k, n, p) { var s = 0; for (var i = 0; i <= Math.min(k, n); i++) s += M.binomPmf(i, n, p); return Math.min(1, s); };
  M.poisPmf = function (k, l) { if (k < 0) return 0; if (l === 0) return k === 0 ? 1 : 0; return Math.exp(k * Math.log(l) - l - M.lnGamma(k + 1)); };
  M.poisCdf = function (k, l) { var s = 0; for (var i = 0; i <= k; i++) s += M.poisPmf(i, l); return Math.min(1, s); };

  /* ---------- regresyon ---------- */
  M.linreg = function (xs, ys) {
    var n = xs.length, mx = M.mean(xs), my = M.mean(ys), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
    var b1 = sxx ? sxy / sxx : 0, b0 = my - b1 * mx, r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0, sse = 0;
    for (var j = 0; j < n; j++) { var e = ys[j] - (b0 + b1 * xs[j]); sse += e * e; }
    return { n: n, b0: b0, b1: b1, r: r, r2: r * r, sse: sse, sst: syy, mx: mx, my: my };
  };
  M.sse = function (xs, ys, b0, b1) { var s = 0; for (var i = 0; i < xs.length; i++) { var e = ys[i] - (b0 + b1 * xs[i]); s += e * e; } return s; };

  /* ---------- rastgele ---------- */
  M.randn = function (rnd) { rnd = rnd || Math.random; var u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  /* tekrarlanabilir üreteç (mulberry32): hazır veri setleri her açılışta aynı olsun */
  M.seeded = function (s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  if (typeof module !== 'undefined' && module.exports) module.exports = M; else root.ISM = M;
})(typeof window !== 'undefined' ? window : this);
