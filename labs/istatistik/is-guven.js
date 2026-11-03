/* ==========================================================================
   ACADEX İSTATİSTİK · 5. GÜVEN ARALIĞI YAĞMURU (labs/istatistik/is-guven.js), 03.11.2026
   İstatistik I, 11–13. hafta: nokta tahmini, ortalama ve oran için güven aralığı,
   z ve t, hata payı, gerekli örneklem büyüklüğü.
     - yağmur: aynı ana kütleden yüzlerce örneklem; her biri bir aralık olarak düşer.
       %95 güven = aralıkların yaklaşık %95'i gerçek μ'yü yakalar (tek aralık için "%95 olasılık" değil)
     - hesaplayıcı: x̄, s, n → aralık; oran için p̂; istenen hata payı için gerekli n
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, MU = 20, SIG = 6;
  var R = { n: 10, lv: 95, meth: 't', iv: [], fresh: 0 };
  var crit = function (lv, meth, n) { var a = 1 - lv / 100; return meth === 'z' ? M.normInv(1 - a / 2) : M.tInv(1 - a / 2, n - 1); };
  var one = function () {
    var a = []; for (var i = 0; i < R.n; i++) a.push(MU + SIG * M.randn());
    var m = M.mean(a), s = R.meth === 'z' ? SIG : M.sd(a), e = crit(R.lv, R.meth, R.n) * s / Math.sqrt(R.n);
    return { m: m, lo: m - e, hi: m + e, hit: m - e <= MU && MU <= m + e };
  };
  var rain = function () {
    var W = 640, H = 420, top = 16, rows = 100, sx = IS.scale(MU - 12, MU + 12, 30, W - 20), rh = (H - top - 30) / rows, g = '';
    g += '<line class="gv-mu" x1="' + sx(MU) + '" x2="' + sx(MU) + '" y1="4" y2="' + (H - 22) + '"/><text class="gv-mut" x="' + (sx(MU) + 6) + '" y="14">gerçek μ = ' + MU + '</text>';
    [8, 12, 16, 20, 24, 28, 32].forEach(function (v) { g += '<text class="gv-t" x="' + sx(v) + '" y="' + (H - 6) + '" text-anchor="middle">' + v + '</text>'; });
    var list = R.iv.slice(-rows), n0 = list.length - R.fresh;
    list.forEach(function (o, i) {
      var y = top + (list.length - 1 - i) * rh + rh / 2, lo = Math.max(MU - 12, o.lo), hi = Math.min(MU + 12, o.hi);
      g += '<g class="gv-i' + (o.hit ? '' : ' miss') + (i >= n0 ? ' new' : '') + '" style="--d:' + (i >= n0 ? ((i - n0) * 0.02).toFixed(2) : 0) + 's"><line x1="' + sx(lo).toFixed(1) + '" x2="' + sx(hi).toFixed(1) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><circle cx="' + sx(Math.max(MU - 12, Math.min(MU + 12, o.m))).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + Math.min(2.6, rh / 2 + 0.6) + '"/></g>';
    });
    C.$('[data-rain]', root).innerHTML = '<svg class="gv-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="güven aralıkları: her satır bir örneklemin aralığı">' + g + '</svg>';
    var hit = R.iv.filter(function (o) { return o.hit; }).length, N = R.iv.length;
    C.$('[data-rk]', root).innerHTML = '<div class="kpi"><small>aralık</small><b>' + N + '</b></div><div class="kpi hl"><small>μ’yü yakalayan</small><b>' + hit + (N ? ' · %' + f(hit / N * 100, 1) : '') + '</b></div><div class="kpi"><small>beklenen</small><b>%' + R.lv + '</b></div><div class="kpi"><small>kaçıran (kırmızı)</small><b style="color:var(--bad)">' + (N - hit) + '</b></div>';
    R.fresh = 0;
  };
  var drop = function (k) { for (var i = 0; i < k; i++) R.iv.push(one()); if (R.iv.length > 400) R.iv = R.iv.slice(-400); R.fresh = Math.min(k, 100); rain(); FN.bridgeSend(); };

  /* ---------- hesaplayıcı ---------- */
  var K = { m: 72.4, s: 9.8, n: 25, lv: 95, sig: false, ph: 0.42, pn: 400, E: 2, Es: 10 };
  var calc = function () {
    var a = 1 - K.lv / 100, z = M.normInv(1 - a / 2), c = K.sig ? z : M.tInv(1 - a / 2, K.n - 1), e = c * K.s / Math.sqrt(K.n);
    var pe = z * Math.sqrt(K.ph * (1 - K.ph) / K.pn), need = Math.ceil(Math.pow(z * K.Es / K.E, 2));
    C.$('[data-cr]', root).innerHTML = '<span class="lbl">ortalama için %' + K.lv + ' güven aralığı</span><div class="big">[' + f(K.m - e, 2) + ' ; ' + f(K.m + e, 2) + ']</div>' +
      '<div class="formula">x̄ ± ' + (K.sig ? 'z' : 't') + '·' + (K.sig ? 'σ' : 's') + '/√n = ' + f(K.m, 2) + ' ± ' + f(c, 3) + ' · ' + f(K.s, 2) + '/√' + K.n + ' = ' + f(K.m, 2) + ' ± <b>' + f(e, 3) + '</b>' + (K.sig ? '' : '   (sd = ' + (K.n - 1) + ')') + '</div>' +
      '<span class="lbl" style="display:block;margin-top:12px">oran için (p̂ = ' + f(K.ph, 2) + ', n = ' + K.pn + ')</span><div class="big" style="font-size:28px">[' + f(K.ph - pe, 3) + ' ; ' + f(K.ph + pe, 3) + ']</div>' +
      '<div class="formula">p̂ ± z·√(p̂(1 − p̂)/n) = ' + f(K.ph, 3) + ' ± <b>' + f(pe, 3) + '</b> → anketlerdeki “±%' + f(pe * 100, 1) + ' hata payı”</div>' +
      '<span class="lbl" style="display:block;margin-top:12px">hata payı en fazla ' + f(K.E, 1) + ' olsun (σ ≈ ' + f(K.Es, 1) + ')</span><div class="big" style="font-size:28px">n ≥ ' + C.nf(need) + '</div><div class="formula">n = (z·σ / E)² = (' + f(z, 3) + ' · ' + f(K.Es, 1) + ' / ' + f(K.E, 1) + ')² = ' + f(Math.pow(z * K.Es / K.E, 2), 1) + ' → yukarı yuvarla</div>';
    C.$('[data-gcode]', root).innerHTML = IS.code({ x: [['=GÜVENİLİRLİK.' + (K.sig ? 'NORM' : 'T') + '(' + C.nf(a, 2) + ';' + C.nf(K.s, 2) + ';' + K.n + ')', 'hata payı = ' + f(e, 3)], ['=' + C.nf(K.m, 2) + '-GÜVENİLİRLİK.T(0,05;' + C.nf(K.s, 2) + ';' + K.n + ')', 'alt sınır (%95, t)'], ['=T.TERS.2K(' + C.nf(a, 2) + ';' + (K.n - 1) + ')', 'kritik t']],
      r: [['t.test(x, conf.level = ' + K.lv / 100 + ')$conf.int', 'ham veriden'], [K.m + ' + c(-1, 1) * qt(' + (1 - a / 2) + ', ' + (K.n - 1) + ') * ' + K.s + ' / sqrt(' + K.n + ')', 'özet değerlerden'], ['prop.test(' + Math.round(K.ph * K.pn) + ', ' + K.pn + ', correct = FALSE)$conf.int', 'oran (Wilson tipi; elle hesap Wald)']] });
  };

  var QS = [
    { q: '%95 güven aralığı [68; 76] bulundu. Doğru yorum hangisi?', o: ['Bu yöntemle kurulan aralıkların %95’i gerçek μ’yü kapsar', 'μ %95 olasılıkla 68 ile 76 arasındadır', 'Verinin %95’i 68–76 arasındadır', 'Örneklem ortalaması %95 olasılıkla 72’dir'], a: 0, n: 'Güven, yönteme aittir. μ sabit bir sayıdır; aralık ya kapsar ya kapsamaz. Yukarıdaki yağmur bunu gösterir.' },
    { q: 'Güven düzeyini %95’ten %99’a çıkarırsan aralık ne olur?', o: ['genişler', 'daralır', 'değişmez', 'kayar ama genişliği aynı kalır'], a: 0, n: 'Daha emin olmak için daha geniş ağ atarsın: z 1,96’dan 2,576’ya çıkar.' },
    { q: 'σ bilinmiyor, n = 12. Hangi kritik değer kullanılır?', o: ['t, sd = 11', 'z', 't, sd = 12', 'ki-kare, sd = 11'], a: 0, n: 's ile tahmin edildiği için t; serbestlik derecesi n − 1 = 11.' },
    { q: 'Hata payını yarıya indirmek için n nasıl değişmeli?', o: ['4 katına çıkmalı', '2 katına çıkmalı', 'yarıya inmeli', 'değişmemeli'], a: 0, n: 'E ∝ 1/√n.' },
    { q: 'Bir ankette n = 1000, p̂ = 0,50. %95 hata payı yaklaşık kaçtır?', o: ['±%3,1', '±%1', '±%5', '±%10'], a: 0, n: '1,96 · √(0,25/1000) ≈ 0,031.' }
  ];

  FN.st.guven = {
    init: function () {
      root = C.$('#guven');
      var sl = function (k, lab, min, max, st, v) { return '<label class="sl"><span>' + lab + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + st + '" value="' + v + '" data-k="' + k + '"><output data-ko="' + k + '">' + f(v, st < 1 ? 2 : 0) + '</output></label>'; };
      root.innerHTML = IS.head({ k: 'istasyon 5 · tahmin', title: 'Güven aralığı yağmuru', sub: 'Gerçek ortalamayı (μ = 20 saat/hafta) bu kez biliyoruz. Her örneklem bir aralık kurar ve gökten düşer. Kırmızılar μ’yü kaçıranlar: %95 güvende yüzde birkaç tane kırmızı <b>olması gerekir</b>.', weeks: ['İst I · 11. hafta: nokta ve aralık tahmini', '12. hafta: ortalama için z ve t aralığı', '13. hafta: oran için aralık, örneklem büyüklüğü'] }) +
        '<div class="grid gside"><div class="card box" style="--cc:#FFB36B"><h2>Gökyüzü ayarı</h2><p class="sub">Ana kütle: haftalık çalışma saati, μ = 20, σ = 6.</p>' +
        '<label class="sl"><span>örneklem büyüklüğü n</span><input type="range" min="3" max="100" step="1" value="10" data-rn><output data-rno>10</output></label>' +
        '<p class="lbl" style="margin:8px 0 4px">güven düzeyi</p><div class="seg" data-lv></div><p class="lbl" style="margin:10px 0 4px">yöntem</p><div class="seg" data-me></div>' +
        '<div class="row" style="margin-top:12px"><button type="button" class="btn sm pri" data-dr="1">1 aralık</button><button type="button" class="btn sm" data-dr="20">20</button><button type="button" class="btn sm" data-dr="100">100</button><button type="button" class="btn sm" data-dr="0">temizle</button></div><div class="kpis" data-rk></div>' +
        IS.tip('n’i büyüt: aralıklar <b>kısalır</b> ama kaçırma oranı aynı kalır. Güven düzeyini %99 yap: aralıklar uzar, kırmızı azalır.', '%95') + '</div>' +
        '<div class="card box" style="--cc:#FFB36B"><div class="stage" data-rain></div></div></div>' +
        '<div class="grid gside" style="margin-top:18px"><div class="card box" style="--cc:#FFB36B"><h2>Hesaplayıcı</h2><p class="sub">Kendi örnekleminin özetini gir.</p>' +
        sl('m', 'örneklem ortalaması x̄', 0, 200, 0.1, K.m) + sl('s', 'standart sapma s (ya da σ)', 0.5, 50, 0.1, K.s) + sl('n', 'n', 2, 500, 1, K.n) +
        '<div class="seg" data-klv style="margin:6px 0"></div><label class="row lbl" style="margin:6px 0"><input type="checkbox" data-sig style="width:auto"> σ biliniyor (z kullan)</label>' +
        sl('ph', 'oran p̂', 0.01, 0.99, 0.01, K.ph) + sl('pn', 'anket n', 30, 3000, 10, K.pn) + sl('E', 'istenen hata payı E', 0.5, 10, 0.5, K.E) + sl('Es', 'tahmini σ', 1, 40, 1, K.Es) + '</div>' +
        '<div class="card box" style="--cc:#FFB36B"><div data-cr></div><div data-gcode></div></div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      C.$('[data-rn]', root).addEventListener('input', function (e) { R.n = +e.target.value; C.$('[data-rno]', root).textContent = R.n; R.iv = []; rain(); });
      IS.seg(C.$('[data-lv]', root), [['90', '%90'], ['95', '%95'], ['99', '%99']], '95', function (k) { R.lv = +k; R.iv = []; rain(); });
      IS.seg(C.$('[data-me]', root), [['t', 't (σ bilinmiyor)'], ['z', 'z (σ biliniyor)']], 't', function (k) { R.meth = k; R.iv = []; rain(); });
      C.$$('[data-dr]', root).forEach(function (b) { b.onclick = function () { var k = +b.getAttribute('data-dr'); if (!k) { R.iv = []; rain(); return; } drop(k); }; });
      IS.seg(C.$('[data-klv]', root), [['90', '%90'], ['95', '%95'], ['99', '%99']], '95', function (k) { K.lv = +k; calc(); });
      C.$('[data-sig]', root).addEventListener('change', function (e) { K.sig = e.target.checked; calc(); });
      C.$$('[data-k]', root).forEach(function (el) { el.addEventListener('input', function () { var k = el.getAttribute('data-k'); K[k] = +el.value; C.$('[data-ko="' + k + '"]', root).textContent = f(K[k], +el.step < 1 ? 2 : 0); calc(); }); });
      for (var i = 0; i < 30; i++) R.iv.push(one()); R.fresh = 30; rain(); calc();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Güven aralığı');
    },
    ctx: function () {
      var hit = R.iv.filter(function (o) { return o.hit; }).length;
      return IS.ctx('guven', 'güven aralığı', [['n', R.n], ['güven', '%' + R.lv], ['yöntem', R.meth], ['aralık', R.iv.length], ['yakalayan', hit], ['hesap: x̄, s, n', f(K.m, 2) + ', ' + f(K.s, 2) + ', ' + K.n]],
        'öğrenci güven aralıklarını simülasyon ve hesaplayıcıyla çalışıyor.', ['%95 güven ne demek, tam olarak?', 'z mi t mi kullanmalıyım?', 'Anketlerdeki hata payı nasıl hesaplanır?']);
    }
  };
})();
