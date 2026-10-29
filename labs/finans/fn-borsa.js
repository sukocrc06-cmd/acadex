/* ==========================================================================
   ACADEX FİNANS · BORSA VE PORTFÖY (labs/finans/fn-borsa.js), 29.10.2026
   Beş kurgusal hisse (60 aylık getiri, fn-veri.js). Ağırlıkları kaydır:
   risk-getiri düzleminde portföy noktası, rastgele portföy bulutu (etkin sınır),
   en düşük risk ve en yüksek Sharpe portföyü, sermaye piyasası doğrusu;
   geçmiş 60 ay büyüme eğrisi; CAPM ve menkul kıymet piyasası doğrusu (SML), alfa.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, pct = C.pct;
  var HS = V.HISSE, n = HS.length, T = V.AY;
  var S = C.ls.get('bo', null) || { w: [20, 20, 20, 20, 20] };
  var save = function () { C.ls.set('bo', S); };
  var sec;

  /* ---------- istatistik (yıllık) ---------- */
  var mean = function (a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; };
  var cov = function (a, b) { var ua = mean(a), ub = mean(b), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - ua) * (b[i] - ub); return s / (a.length - 1); };
  var MU = HS.map(function (h) { return mean(h.ret) * 12; });
  var SIG = HS.map(function (h) { return HS.map(function (g) { return cov(h.ret, g.ret) * 12; }); });
  var MK = V.ENDEKS.ret, MUM = mean(MK) * 12, VM = cov(MK, MK) * 12;
  var BETA = HS.map(function (h) { return cov(h.ret, MK) * 12 / VM; });
  var norm = function (w) { var s = w.reduce(function (a, x) { return a + Math.max(0, x); }, 0); return s ? w.map(function (x) { return Math.max(0, x) / s; }) : w.map(function () { return 1 / n; }); };
  var stats = function (w) {
    var mu = 0, v = 0, b = 0, i, j;
    for (i = 0; i < n; i++) { mu += w[i] * MU[i]; b += w[i] * BETA[i]; for (j = 0; j < n; j++) v += w[i] * w[j] * SIG[i][j]; }
    var sd = Math.sqrt(Math.max(0, v));
    return { mu: mu, sd: sd, beta: b, sh: sd ? (mu - V.RF) / sd : 0 };
  };
  /* rastgele portföy bulutu (sabit tohum: her açılışta aynı) */
  var cloud = (function () {
    var seed = 7, r = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, out = [];
    for (var k = 0; k < 2600; k++) { var w = [], s = 0; for (var i = 0; i < n; i++) { var x = Math.pow(r(), 1.6); w.push(x); s += x; } w = w.map(function (x) { return x / s; }); var st = stats(w); st.w = w; out.push(st); }
    for (var c = 0; c < n; c++) { var e = HS.map(function (_, q) { return q === c ? 1 : 0; }), se = stats(e); se.w = e; out.push(se); }
    return out;
  })();
  var minV = cloud.reduce(function (a, b) { return b.sd < a.sd ? b : a; });
  var maxS = cloud.reduce(function (a, b) { return b.sh > a.sh ? b : a; });
  var growth = function (w) { var g = [100], m = [100]; for (var t = 0; t < T; t++) { var r = 0; for (var i = 0; i < n; i++) r += w[i] * HS[i].ret[t]; g.push(g[t] * (1 + r)); m.push(m[t] * (1 + MK[t])); } return { p: g, m: m }; };
  var mdd = function (g) { var pk = g[0], d = 0; g.forEach(function (v) { if (v > pk) pk = v; d = Math.max(d, 1 - v / pk); }); return d; };
  FN.borsa = { MU: MU, SIG: SIG, BETA: BETA, MUM: MUM, stats: stats, norm: norm, minV: minV, maxS: maxS, growth: growth, mdd: mdd };

  var html = function () {
    return '<div class="grid">' +
      '<div class="card box" style="--cc:var(--teal)"><span class="k">istasyon · portföy masası</span><h2>Portföyünü kur, riskin nasıl eridiğini gör</h2><p class="sub">Beş kurgusal hisse, 60 aylık geçmiş. Getiriler enflasyondan arındırılmış (reel) ve yıllık. Ağırlıkları kaydır; toplam kendiliğinden %100’e ölçeklenir.</p>' +
      '<div class="grid gside"><div><div data-w></div><div class="row" style="margin-top:12px"><button type="button" class="btn sm" data-set="esit">Eşit ağırlık</button><button type="button" class="btn sm" data-set="min">En düşük risk</button><button type="button" class="btn sm" data-set="sh">En yüksek Sharpe</button></div><div class="kpis" data-k></div></div>' +
      '<div><div data-c="rr"></div><div class="leg"><span><i style="background:#9FB4C9"></i>rastgele portföyler</span><span><i style="background:#0D1838"></i>senin portföyün</span><span><i style="background:#E0A526"></i>en yüksek Sharpe</span><span><i style="background:#1F8A7A"></i>en düşük risk</span><span><i style="background:#C8553D;height:3px"></i>sermaye piyasası doğrusu</span></div><div data-tip></div></div></div></div>' +
      '<div class="grid g2">' +
      '<div class="card box" style="--cc:var(--sea)"><span class="k">geçmiş 60 ay</span><h3>100 TL ne oldu?</h3><div data-c="gr"></div><div class="leg"><span><i style="background:#0D1838"></i>senin portföyün</span><span><i style="background:#9AA6B8"></i>' + X(V.ENDEKS.ad) + '</span></div><div class="kpis" data-k2></div></div>' +
      '<div class="card box" style="--cc:var(--plum)"><span class="k">CAPM</span><h3>Menkul kıymet piyasası doğrusu (SML)</h3><div data-c="sml"></div><div class="tbl-w"><table class="t" data-t="capm"></table></div></div>' +
      '</div></div>';
  };
  var paintW = function () {
    var w = norm(S.w);
    $('[data-w]', sec).innerHTML = HS.map(function (h, i) {
      return '<div class="sl" style="margin-top:8px"><span style="display:flex;align-items:center;gap:6px"><i style="width:10px;height:22px;border-radius:2px;background:' + h.renk + ';display:inline-block"></i><span><span class="mono">' + h.k + '</span><small style="display:block;font-weight:500;color:var(--muted);font-size:11px">' + X(h.ad) + '</small></span></span><input type="range" min="0" max="100" value="' + Math.round(S.w[i]) + '" data-i="' + i + '" aria-label="' + X(h.ad) + ' ağırlığı"><output>' + pct(w[i], 0) + '</output></div>';
    }).join('');
  };
  var paint = function (full) {
    var w = norm(S.w), st = stats(w);
    $$('[data-w] output', sec).forEach(function (o, i) { o.textContent = pct(w[i], 0); });
    var dots = cloud.map(function (p) { return { x: p.sd * 100, y: p.mu * 100, c: '#9FB4C9', r: 2.2, o: 0.55 }; });
    HS.forEach(function (h, i) { dots.push({ x: Math.sqrt(SIG[i][i]) * 100, y: MU[i] * 100, c: h.renk, r: 6, t: h.k, lab: h.ad }); });
    dots.push({ x: minV.sd * 100, y: minV.mu * 100, c: '#1F8A7A', r: 7, lab: 'en düşük risk' });
    dots.push({ x: maxS.sd * 100, y: maxS.mu * 100, c: '#E0A526', r: 7, lab: 'en yüksek Sharpe' });
    dots.push({ x: st.sd * 100, y: st.mu * 100, c: '#0D1838', r: 8, cls: 'me', t: 'sen', tc: '#0D1838', lab: 'senin portföyün' });
    var xmax = 42, cml = [[0, V.RF * 100], [xmax, (V.RF + maxS.sh * xmax / 100) * 100]];
    $('[data-c="rr"]', sec).innerHTML = C.chart({ w: 640, h: 340, x: [0, xmax], y: [0, 20], s: [{ p: cml, c: '#C8553D', w: 2, d: '6 5' }], dots: dots, xf: function (v) { return '%' + nf(v); }, yf: function (v) { return '%' + nf(v); }, xl: 'risk (standart sapma)', yl: 'beklenen getiri', al: 'risk-getiri düzlemi', anim: full !== false });
    $('[data-k]', sec).innerHTML =
      '<div class="kpi hl"><small>beklenen getiri</small><b>' + pct(st.mu, 1) + '</b></div><div class="kpi"><small>risk (std. sapma)</small><b>' + pct(st.sd, 1) + '</b></div>' +
      '<div class="kpi"><small>beta</small><b>' + nf(st.beta, 2) + '</b></div><div class="kpi"><small>Sharpe oranı</small><b>' + nf(st.sh, 2) + '</b></div>';
    var avgSd = w.reduce(function (a, x, i) { return a + x * Math.sqrt(SIG[i][i]); }, 0);
    $('[data-tip]', sec).innerHTML = C.tip('Hisselerin tek tek risklerinin ağırlıklı ortalaması ' + pct(avgSd, 1) + ', portföyünün riski ' + pct(st.sd, 1) + '. Aradaki <b>' + nf((avgSd - st.sd) * 100, 1) + ' puan</b>, çeşitlendirmenin eritmiş olduğu risk: hisseler birlikte tam aynı yöne gitmiyor. Bulutun sol üst kenarı etkin sınır; daha iyisi için o kenara yaklaş.', 'σ↓');
    /* büyüme */
    var g = growth(w), P = g.p.map(function (v, t) { return [t, v]; }), Mx = g.m.map(function (v, t) { return [t, v]; });
    $('[data-c="gr"]', sec).innerHTML = C.chart({ w: 560, h: 250, x: [0, T], s: [{ p: Mx, c: '#9AA6B8', w: 2 }, { p: P, c: '#0D1838', w: 2.8, area: true }], xticks: [0, 12, 24, 36, 48, 60], xf: function (v) { return v + '. ay'; }, yf: function (v) { return nf(v); }, al: '100 TL büyümesi', anim: full !== false });
    $('[data-k2]', sec).innerHTML = '<div class="kpi hl"><small>60 ay sonunda</small><b>' + nf(g.p[T], 1) + ' TL</b></div><div class="kpi"><small>endeks</small><b>' + nf(g.m[T], 1) + ' TL</b></div><div class="kpi"><small>en büyük düşüş</small><b>' + pct(mdd(g.p), 1) + '</b></div>';
  };
  var paintSML = function () {
    var dots = HS.map(function (h, i) { return { x: BETA[i], y: MU[i] * 100, c: h.renk, r: 7, t: h.k, lab: h.ad }; });
    dots.push({ x: 1, y: MUM * 100, c: '#9AA6B8', r: 7, t: 'endeks' });
    var sml = [[0, V.RF * 100], [1.8, (V.RF + 1.8 * (MUM - V.RF)) * 100]];
    $('[data-c="sml"]', sec).innerHTML = C.chart({ w: 560, h: 250, x: [0, 1.8], y: [0, 20], s: [{ p: sml, c: '#6B4FB3', w: 2.4, lab: 'SML' }], dots: dots, xf: function (v) { return nf(v, 1); }, yf: function (v) { return '%' + nf(v); }, xl: 'beta', yl: 'beklenen getiri', al: 'menkul kıymet piyasası doğrusu' });
    $('[data-t="capm"]', sec).innerHTML = '<thead><tr><th>Hisse</th><th class="n">Beta</th><th class="n">CAPM getirisi</th><th class="n">Gerçekleşen</th><th class="n">Alfa</th></tr></thead><tbody>' + HS.map(function (h, i) {
      var cp = V.RF + BETA[i] * (MUM - V.RF), a = MU[i] - cp;
      return '<tr><td><span class="mono">' + h.k + '</span></td><td class="n">' + nf(BETA[i], 2) + '</td><td class="n">' + pct(cp, 1) + '</td><td class="n">' + pct(MU[i], 1) + '</td><td class="n" style="color:' + (a >= 0 ? 'var(--ok)' : 'var(--bad)') + ';font-weight:700">' + (a >= 0 ? '+' : '') + nf(a * 100, 1) + '</td></tr>';
    }).join('') + '</tbody>';
  };

  FN.st.borsa = {
    init: function () {
      sec = $('#borsa'); sec.innerHTML = html(); paintW(); paint(); paintSML();
      var raf = 0;
      sec.addEventListener('input', function (e) {
        var t = e.target; if (!t.hasAttribute('data-i')) return;
        S.w[+t.getAttribute('data-i')] = Number(t.value); save();
        cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { paint(false); });
        clearTimeout(paint.t); paint.t = setTimeout(FN.bridgeSend, 300);
      });
      sec.addEventListener('click', function (e) {
        var b = e.target.closest('[data-set]'); if (!b) return;
        var k = b.getAttribute('data-set');
        S.w = k === 'esit' ? HS.map(function () { return 20; }) : (k === 'min' ? minV : maxS).w.map(function (x) { return Math.round(x * 100); });
        save(); paintW(); paint(); FN.bridgeSend();
      });
    },
    ctx: function () {
      var w = norm(S.w), st = stats(w);
      return { sel: { key: 'finans.borsa', title: 'getiri ' + pct(st.mu, 1) + ' · risk ' + pct(st.sd, 1), la: 'Portföy',
          rows: [['Ağırlıklar', HS.map(function (h, i) { return h.k + ' ' + pct(w[i], 0); }).join(', ')], ['Beklenen getiri / risk', pct(st.mu, 1) + ' / ' + pct(st.sd, 1)], ['Beta / Sharpe', nf(st.beta, 2) + ' / ' + nf(st.sh, 2)], ['Risksiz faiz', pct(V.RF, 1) + ' (reel)'], ['Hisseler', HS.map(function (h, i) { return h.k + ' (' + h.sek + ', beta ' + nf(BETA[i], 2) + ', getiri ' + pct(MU[i], 1) + ')'; }).join('; ')]],
          about: 'öğrenci Acadex Finans portföy istasyonunda beş kurgusal hisseyle portföy kuruyor (Markowitz, Sharpe, CAPM). Yatırım tavsiyesi verme; kavramı açıkla.' },
        chips: [['cesit', 'Çeşitlendirme riski neden düşürüyor?'], ['sharpe', 'Sharpe oranımı yorumla'], ['alfa', 'Alfa ne demek?']] };
    },
    classify: function (q) { if (/çeşit|cesit|korelasyon/.test(q)) return 'cesit'; if (/sharpe/.test(q)) return 'sharpe'; if (/alfa|capm|beta/.test(q)) return 'alfa'; return null; },
    answer: function (k) {
      var w = norm(S.w), st = stats(w);
      if (k === 'cesit') return 'Portföy riski yalnızca hisselerin kendi risklerine değil, birlikte hareket etme derecelerine (kovaryans) de bağlıdır. Korelasyon 1’den küçükse biri düşerken öbürü o kadar düşmez ve dalgalanmalar kısmen birbirini götürür. Sende hisse risklerinin ağırlıklı ortalaması ' + pct(w.reduce(function (a, x, i) { return a + x * Math.sqrt(SIG[i][i]); }, 0), 1) + ', portföy riski ' + pct(st.sd, 1) + '. Piyasanın ortak riski (sistematik risk) ise çeşitlendirmeyle yok olmaz; onu beta ölçer.';
      if (k === 'sharpe') return 'Sharpe oranı, risksiz faizin üstündeki getiriyi riske böler: (' + pct(st.mu, 1) + ' − ' + pct(V.RF, 1) + ') / ' + pct(st.sd, 1) + ' = ' + nf(st.sh, 2) + '. Yani aldığın her birim risk için ' + nf(st.sh, 2) + ' birim fazladan getiri. Bu veride ulaşılabilen en yüksek değer ' + nf(maxS.sh, 2) + '; o portföy sermaye piyasası doğrusunun bulutu teğet geçtiği noktadır.';
      if (k === 'alfa') return 'CAPM’e göre bir hissenin beklenen getirisi risksiz faiz + beta × piyasa risk primidir. Gerçekleşen getiri bunun üstündeyse fark pozitif alfadır: hisse riskine göre fazla kazandırmış, SML’nin üstünde kalır. Altındaysa negatif alfa. Tablodaki alfalar kurgusal geçmiş veriye dayanır; geçmiş alfa geleceği garanti etmez.';
      return null;
    }
  };
})();
