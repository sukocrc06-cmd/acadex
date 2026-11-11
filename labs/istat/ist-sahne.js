/* ==========================================================================
   ACADEX İSTATİSTİK · soru sahneleri (labs/istat/ist-sahne.js), 13.11.2026
   Soruların senaryo görselleri ve animasyonlu çözümü için çizim yardımcıları.
   Her yardımcı k (gösterilen çözüm adımı sayısı) alır: k = 0 senaryo, k arttıkça
   çözüm görselde adım adım ilerler. Sorular bunları Q.viz(k) içinden çağırır.
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;
  var S = IST.S = {};
  var etk = function (x, y, t, c, an) { return '<text class="lbb' + (an ? ' fd' : '') + '" x="' + x + '" y="' + y + '" text-anchor="middle"' + (c ? ' style="fill:' + c + '"' : '') + '>' + t + '</text>'; };

  /* normal eğri: o = { m, s, x | a,b, yon: 'sag'|'sol'|'ara', adim: [zAdımı, alanAdımı], p, birim } */
  S.normal = function (o, k) {
    var za = o.adim ? o.adim[0] : 1, aa = o.adim ? o.adim[1] : 2, lo = o.yon === 'sag' ? o.x : o.yon === 'sol' ? o.m - 5 * o.s : o.a, hi = o.yon === 'sol' ? o.x : o.yon === 'sag' ? o.m + 5 * o.s : o.b;
    var xs = [o.m].concat(o.yon === 'ara' ? [o.a, o.b] : [o.x]);
    return V.curve({ f: function (x) { return M.npdf(x, o.m, o.s); }, a: o.m - 4 * o.s, b: o.m + 4 * o.s, ymax: M.npdf(o.m, o.m, o.s) * 1.25, sh: k >= aa ? [lo, hi] : null, shc: PAL[3], h: 190, d: -2,
      xt: xs.map(function (v) { return [v, nf(v, 2)]; }),
      extra: function (X0, Y0, y0) {
        var s = '';
        xs.slice(1).forEach(function (v) { s += '<line x1="' + X0(v) + '" x2="' + X0(v) + '" y1="' + y0 + '" y2="18" stroke="#C8553D" stroke-width="2.2" stroke-dasharray="5 4"/>'; if (k >= za) s += '<text class="lbm pop" x="' + X0(v) + '" y="14" text-anchor="middle" style="fill:#C8553D;font-weight:700">z = ' + nf((v - o.m) / o.s, 2) + '</text>'; });
        if (k < aa) { var mid = o.yon === 'sag' ? Math.min(o.x + o.s, o.m + 3.4 * o.s) : o.yon === 'sol' ? Math.max(o.x - o.s, o.m - 3.4 * o.s) : (o.a + o.b) / 2; s += '<text class="lbb pl" x="' + X0(mid) + '" y="' + Y0(M.npdf(o.m, o.m, o.s) * 0.35) + '" text-anchor="middle" style="fill:#C8553D;font-size:20px">?</text>'; }
        else if (o.p != null && k >= (o.son || aa)) s += '<text class="lbb pop" x="' + X0((lo + hi) / 2 < o.m - 3 * o.s ? o.m - 2.8 * o.s : (lo + hi) / 2 > o.m + 3 * o.s ? o.m + 2.8 * o.s : (Math.max(lo, o.m - 3.4 * o.s) + Math.min(hi, o.m + 3.4 * o.s)) / 2) + '" y="' + Y0(M.npdf(o.m, o.m, o.s) * 0.3) + '" text-anchor="middle">' + nf(o.p, 4) + '</text>';
        return s;
      } });
  };
  /* genel yoğunluk ve kuyruk: o = { f, a, b, ymax, sh, xt, isaret:[x, etiket], kuyruk } */
  S.egri = function (o, k) {
    return V.curve({ f: o.f, a: o.a, b: o.b, ymax: o.ymax, sh: k >= (o.shAdim || 1) ? o.sh : null, shc: o.shc || PAL[1], h: o.h || 190, d: -2, xt: o.xt, renk: o.renk,
      extra: function (X0, Y0, y0) { var e2 = ''; if (o.f2 && k >= (o.f2k || 1)) { var pp = []; for (var q = 0; q <= 160; q++) { var xx = o.a + (o.b - o.a) * q / 160; pp.push(X0(xx).toFixed(1) + ' ' + Y0(Math.min(o.ymax, o.f2(xx))).toFixed(1)); } e2 = '<path class="dr" style="--len:1500" d="M' + pp.join('L') + '" fill="none" stroke="' + PAL[1] + '" stroke-width="3"/>' + (o.f2lab ? '<text class="lbb fd" x="' + X0(o.f2lab[0]) + '" y="' + Y0(o.f2lab[1]) + '" style="fill:#C8553D">' + o.f2lab[2] + '</text>' : ''); } if (!o.isaret || k < (o.isAdim || 0)) return e2; var x = Math.max(o.a, Math.min(o.b, o.isaret[0])); return '<g class="pop"><line x1="' + X0(x) + '" x2="' + X0(x) + '" y1="' + y0 + '" y2="20" stroke="#0D1838" stroke-width="2.5"/><path d="M' + X0(x) + ' 18l-6-10h12z" fill="#E0A526" stroke="#0D1838"/><text class="lbb" x="' + X0(x) + '" y="' + (y0 + 30) + '" text-anchor="middle">' + o.isaret[1] + '</text></g>' + e2; } });
  };
  /* sınıf sınırları: [mn, mx] aralığı k3 sınıfa (k ≥ 2 sınıflar görünür) */
  S.sinif = function (mn, mx, k3, w, k) {
    var hi = k >= 2 ? mn + k3 * w : mx, xs = V.sc(mn, Math.max(hi, mx), 20, 520), s = '<line x1="20" x2="520" y1="60" y2="60" stroke="#0D1838" stroke-width="2"/>';
    s += '<g class="pop"><circle cx="' + xs(mn) + '" cy="60" r="7" fill="' + PAL[0] + '"/><circle cx="' + xs(mx) + '" cy="60" r="7" fill="' + PAL[1] + '"/></g><text class="lbb" x="' + xs(mn) + '" y="88" text-anchor="middle">min ' + mn + '</text><text class="lbb" x="' + xs(mx) + '" y="88" text-anchor="middle">maks ' + mx + '</text>';
    if (k >= 1) s += '<line class="gx" x1="' + xs(mn) + '" x2="' + xs(mx) + '" y1="40" y2="40" stroke="#E0A526" stroke-width="5"/><text class="lbm fd" x="' + ((xs(mn) + xs(mx)) / 2) + '" y="32" text-anchor="middle">açıklık ' + (mx - mn) + '</text>';
    if (k >= 2) for (var i = 0; i <= k3; i++) s += '<line class="an" ' + d(i * 0.1) + ' x1="' + xs(mn + i * w) + '" x2="' + xs(mn + i * w) + '" y1="50" y2="70" stroke="#0D1838" stroke-width="2"/>' + (i < k3 ? '<text class="lbm fd" ' + d(i * 0.1) + ' x="' + ((xs(mn + i * w) + xs(mn + (i + 1) * w)) / 2) + '" y="108" text-anchor="middle">' + w + '</text>' : '');
    return V.svg(540, 116, s, 'sınıf sınırları');
  };
  /* sistematik örneklem: k sütunlu ızgara; her satır bir aralık */
  S.sistematik = function (N, n, bas, kac, k) {
    var kk = N / n, sat = Math.min(kac + 1, 6), sut = Math.min(kk, 20), w = 520 / sut, s = '';
    for (var r = 0; r < sat; r++) for (var c = 0; c < sut; c++) {
      var no = r * kk + c + 1, sec = k >= 2 && c === bas - 1 && r < kac, hedef = k >= 2 && r === kac - 1 && c === bas - 1;
      s += '<g' + (sec ? ' class="pop" ' + d(r * 0.15) : '') + '><rect x="' + (10 + c * w) + '" y="' + (24 + r * 30) + '" width="' + (w - 3) + '" height="26" rx="4" fill="' + (hedef ? PAL[1] : sec ? PAL[3] : k >= 1 && r % 2 ? '#EEF3FA' : '#fff') + '" stroke="#0D1838" stroke-width="' + (sec ? 1.8 : 0.6) + '"/>' + (w > 22 ? '<text class="lbm" x="' + (10 + c * w + w / 2 - 1.5) + '" y="' + (41 + r * 30) + '" text-anchor="middle" style="font-size:' + (w > 30 ? 10.5 : 8.5) + 'px' + (sec ? ';fill:#0D1838;font-weight:700' : '') + '">' + no + '</text>' : '') + '</g>';
    }
    if (kk > 20) s += '<text class="lbl" x="530" y="40" text-anchor="end">…</text>';
    s += k >= 1 ? etk(270, 16, 'her satır bir aralık: k = ' + N + ' / ' + n + ' = ' + kk, '#0D5C8C', true) : etk(270, 16, N + ' dosya, ' + n + ' seçilecek · adım k = ?', '#0D1838');
    if (k >= 2) s += '<text class="lbb fd" x="10" y="' + (36 + sat * 30) + '">sarı: seçilen dosyalar · kırmızı: ' + kac + '. dosya</text>';
    return V.svg(540, 44 + sat * 30, s, 'sistematik örneklem ızgarası');
  };
  /* tabakalar: kutu alanları N_h ile orantılı; k ≥ 1 toplam, k ≥ 2 n_h */
  S.tabaka = function (ad, Nh, n, hi, k) {
    var T = M.sum(Nh), x = 10, s = '';
    Nh.forEach(function (v, i) { var w = 520 * v / T; s += '<g class="gx" ' + d(i * 0.15) + '><rect x="' + x + '" y="30" width="' + (w - 4) + '" height="80" rx="8" fill="' + PAL[i] + '" fill-opacity="' + (i === hi || k < 2 ? 0.9 : 0.35) + '" stroke="#0D1838" stroke-width="' + (i === hi ? 2.5 : 1.2) + '"/></g><text class="lbb" x="' + (x + w / 2) + '" y="60" text-anchor="middle" style="fill:#fff">' + ad[i] + '</text><text class="lbm" x="' + (x + w / 2) + '" y="80" text-anchor="middle" style="fill:#fff">N = ' + v + '</text>' + (k >= 2 ? '<text class="lbb pop" x="' + (x + w / 2) + '" y="102" text-anchor="middle" style="fill:#fff">n = ' + nf(n * v / T, 1) + '</text>' : ''); x += w; });
    s += etk(270, 18, k >= 1 ? 'toplam N = ' + T + ' · örneklem n = ' + n + ' → oran ' + nf(n / T, 4) : 'kutu büyüklüğü = tabaka büyüklüğü', '#0D1838', k >= 1);
    return V.svg(540, 120, s, 'tabakalar');
  };
  /* sayı şeridi: okunan sayılar, geçerli/atlanan işaretli (k ≥ 1) */
  S.serit = function (L, gec, son, k) {
    var s = '', sec = 0;
    L.forEach(function (v, i) { var ok = gec(v, i); if (ok) sec++; var renk = k < 1 ? '#fff' : ok ? (sec <= son ? '#E3F4EA' : '#fff') : '#FBE9E6'; s += '<g' + (k >= 1 ? ' class="pop" ' + d(i * 0.12) : '') + '><rect x="' + (8 + i * 59) + '" y="20" width="54" height="40" rx="8" fill="' + renk + '" stroke="#0D1838" stroke-width="' + (k >= 1 && ok && sec === son ? 3 : 1.4) + '"/><text class="lbm" x="' + (35 + i * 59) + '" y="45" text-anchor="middle" style="font-size:14px;font-weight:700">' + (v < 10 ? '00' : v < 100 ? '0' : '') + v + '</text>' + (k >= 1 ? '<text class="lbb" x="' + (35 + i * 59) + '" y="80" text-anchor="middle" style="fill:' + (ok ? '#2E8E5B' : '#C9483B') + '">' + (ok ? (sec <= son ? sec + '.' : '✓') : '✗') + '</text>' : '') + '</g>'; });
    return V.svg(540, 92, s, 'okunan sayılar');
  };
  /* güven aralığı sayı doğrusu: o = { m, e, alt, ust } ; k ≥ 1 hata payı, k ≥ 2 sınırlar */
  S.aralik = function (o, k) {
    var lo = o.m - o.e * 1.8, hi = o.m + o.e * 1.8, xs = V.sc(lo, hi, 30, 510), s = '<line x1="20" x2="520" y1="70" y2="70" stroke="#0D1838" stroke-width="2"/>';
    s += '<circle class="pop" cx="' + xs(o.m) + '" cy="70" r="8" fill="#0D1838"/><text class="lbb" x="' + xs(o.m) + '" y="100" text-anchor="middle">' + (o.lab || 'x̄') + ' = ' + nf(o.m, o.dg || 2) + '</text>';
    if (k >= (o.ka || 1)) s += '<line class="gx" x1="' + xs(o.m) + '" x2="' + xs(o.m + o.e) + '" y1="70" y2="70" stroke="' + PAL[1] + '" stroke-width="7" stroke-linecap="round"/><line class="gx" style="transform-origin:100% 50%" x1="' + xs(o.m - o.e) + '" x2="' + xs(o.m) + '" y1="70" y2="70" stroke="' + PAL[1] + '" stroke-width="7" stroke-linecap="round"/><text class="lbm fd" x="' + xs(o.m + o.e / 2) + '" y="56" text-anchor="middle" style="fill:#C8553D">± ' + nf(o.e, 4) + '</text>';
    if (k >= (o.kb || 2)) s += '<g class="pop"><line x1="' + xs(o.m - o.e) + '" x2="' + xs(o.m - o.e) + '" y1="58" y2="82" stroke="#0D1838" stroke-width="3"/><line x1="' + xs(o.m + o.e) + '" x2="' + xs(o.m + o.e) + '" y1="58" y2="82" stroke="#0D1838" stroke-width="3"/><text class="lbb" x="' + xs(o.m - o.e) + '" y="34" text-anchor="middle">' + nf(o.m - o.e, o.dg || 2) + '</text><text class="lbb" x="' + xs(o.m + o.e) + '" y="34" text-anchor="middle">' + nf(o.m + o.e, o.dg || 2) + '</text></g>';
    if (k < (o.ka || 1)) s += etk(270, 34, (o.g || '%95') + ' güven aralığı: x̄ ± ?', '#C8553D');
    return V.svg(540, 112, s, 'güven aralığı');
  };
  /* olasılık sütunları; vurgu kümesi k’ya göre: o.hi(k) → indeks dizisi */
  S.sutun = function (xs, ps, hi, o) { o = o || {}; return V.bars({ x: xs.map(String), y: ps, h: o.h || 170, max: o.max || V.nice(Math.max.apply(null, ps) * 1.15), val: o.val != null ? o.val : xs.length <= 9, hi: hi, fmt: function (v) { return nf(v, o.dg || 3); }, renk: o.renk || PAL[7], d: -2, gap: xs.length > 14 ? 0.12 : 0.22, xlab: o.xlab || '', label: 'olasılık dağılımı' }); };
  /* nesne ızgarası: n nesne (≤ 100 görünür), ilk f tanesi vurgulu */
  S.izgara = function (n, f, ic, k, o) {
    o = o || {}; var g = Math.min(n, 100), fg = Math.round(f / n * g), s = '', c = 20;
    for (var i = 0; i < g; i++) { var on = k >= (o.k || 0) && i < fg; s += '<g class="' + (on ? 'pop' : '') + '" ' + d(i * 0.006) + '><rect x="' + (8 + (i % c) * 26) + '" y="' + (8 + Math.floor(i / c) * 26) + '" width="22" height="22" rx="5" fill="' + (on ? (o.renk || PAL[2]) : '#fff') + '" stroke="#0D1838" stroke-width=".8"/><text x="' + (19 + (i % c) * 26) + '" y="' + (24 + Math.floor(i / c) * 26) + '" text-anchor="middle" font-size="12">' + ic + '</text></g>'; }
    var h = 16 + Math.ceil(g / c) * 26;
    s += '<text class="lbl" x="530" y="' + (h + 12) + '" text-anchor="end">' + (n > 100 ? 'her kare ≈ ' + nf(n / 100, 1) + ' birim · ' : '') + (k >= (o.k || 0) ? (o.lab || f + ' / ' + n) : n + ' birim') + '</text>';
    return V.svg(540, h + 18, s, 'nesne ızgarası');
  };
  /* sıralı kutular: değerler sıralanır (k ≥ 1), konumlar vurgulanır (k ≥ 2) */
  S.siralar = function (v, hiPos, k, o) {
    o = o || {}; var a = k >= 1 ? M.sort(v) : v, w = Math.min(46, 520 / a.length), s = '';
    a.forEach(function (x, i) { var on = k >= 2 && hiPos.indexOf(i + 1) >= 0; s += '<g class="' + (k >= 1 ? 'dp' : '') + '" ' + d(i * 0.05) + '><rect x="' + (10 + i * w) + '" y="' + (on ? 14 : 24) + '" width="' + (w - 4) + '" height="34" rx="6" fill="' + (on ? PAL[3] : '#fff') + '" stroke="#0D1838" stroke-width="' + (on ? 2.2 : 1.2) + '"/><text class="lbm" x="' + (10 + i * w + (w - 4) / 2) + '" y="' + (on ? 36 : 46) + '" text-anchor="middle" style="font-weight:700">' + nf(x, 1) + '</text>' + (k >= 1 ? '<text class="lbm" x="' + (10 + i * w + (w - 4) / 2) + '" y="74" text-anchor="middle" style="font-size:9.5px">' + (i + 1) + '</text>' : '') + '</g>'; });
    if (o.not && k >= (o.notk || 2)) s += '<text class="lbb fd" x="10" y="96">' + o.not + '</text>';
    return V.svg(540, o.not ? 104 : 82, s, 'sıralı değerler');
  };
  /* iki çubuk karşılaştırma (oranlar, nominal/reel) */
  S.cift = function (lab, val, k, o) { o = o || {}; return V.bars({ x: lab, y: val.map(function (v, i) { return k >= (o.k ? o.k[i] : 0) ? v : 0; }), h: o.h || 170, max: o.max || V.nice(Math.max.apply(null, val) * 1.15), fmt: o.fmt || function (v) { return nf(v, 2); }, renk: o.renk || [PAL[0], PAL[1], PAL[2], PAL[3]], d: -2, val: true }); };
  /* serpilme + (k ≥ kl) doğru + isteğe bağlı işaret */
  S.serp = function (x, y, k, o) {
    o = o || {}; var f = M.ls(x, y), mnx = Math.min.apply(null, x), mxx = Math.max.apply(null, x), mny = Math.min.apply(null, y), mxy = Math.max.apply(null, y), px = (mxx - mnx) * 0.15 || 1, py = (mxy - mny) * 0.2 || 1;
    var lo = o.xmin != null ? o.xmin : mnx - px, hi = o.xmax != null ? o.xmax : mxx + px;
    var svg = V.xy({ x: x, y: y, h: 200, xmin: lo, xmax: hi, ymin: Math.max(0, mny - py), ymax: mxy + py, fit: k >= (o.kl || 99) ? [f.a, f.b] : null, xt: [[lo, nf(lo, 0)], [(lo + hi) / 2, nf((lo + hi) / 2, 0)], [hi, nf(hi, 0)]], d: -2, renk: PAL[0] });
    if (o.isaret && k >= o.isaret[2]) { var X0 = V.sc(lo, hi, 54, 498), Y0 = V.sc(Math.max(0, mny - py), mxy + py, 156, 18); svg = svg.replace('</svg>', '<g class="pop"><circle cx="' + X0(o.isaret[0]) + '" cy="' + Y0(o.isaret[1]) + '" r="8" fill="#E0A526" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="' + (X0(o.isaret[0]) + 10) + '" y="' + (Y0(o.isaret[1]) - 8) + '">' + (o.isaret[3] || '') + '</text></g></svg>'); }
    return svg;
  };
})();
