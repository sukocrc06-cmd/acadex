/* ==========================================================================
   ACADEX İSTATİSTİK · 8. REGRESYON ATÖLYESİ (labs/istatistik/is-regresyon.js), 03.11.2026
   İstatistik II, 10–13. hafta: serpilme diyagramı, korelasyon, basit doğrusal regresyon,
   en küçük kareler, R², tahmin; korelasyon ≠ nedensellik, aykırı nokta etkisi.
     - yıldızları sürükle, boş yere tıklayıp yıldız ekle: doğru canlı oturur
     - kalıntı kareleri: en küçük kareler bu karelerin toplam alanını en aza indirir
     - kendi doğrun: iki tutamağı oynat, hatanı en küçük kareler doğrusuyla yarıştır
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, svg, W = 620, H = 400, PL = 46, PR = 16, PT = 16, PB = 40;
  var sx = IS.scale(0, 10, PL, W - PR), sy = IS.scale(0, 100, H - PB, PT);
  var SETS = {
    saat: { t: 'Çalışma saati → not', xl: 'haftalık çalışma (saat)', yl: 'sınav notu', p: [[1, 38], [1.5, 52], [2, 45], [3, 55], [3.5, 61], [4, 58], [5, 66], [5.5, 72], [6, 64], [7, 78], [8, 80], [9, 88]] },
    reklam: { t: 'Reklam → satış', xl: 'reklam (bin TL)', yl: 'satış (bin adet)', p: [[0.5, 22], [1, 30], [2, 28], [2.5, 41], [3, 39], [4, 50], [5, 47], [6, 58], [7, 61], [7.5, 70], [8.5, 72], [9.5, 81]] },
    rastgele: { t: 'Ayakkabı numarası → not', xl: 'ayakkabı (ölçekli)', yl: 'sınav notu', p: [[1, 60], [2, 42], [2.5, 75], [3, 55], [4, 68], [4.5, 40], [5.5, 62], [6, 50], [7, 72], [7.5, 45], [8.5, 58], [9, 66]] },
    aykiri: { t: 'Aykırı noktanın gücü', xl: 'x', yl: 'y', p: [[1, 30], [1.5, 34], [2, 36], [2.5, 40], [3, 41], [3.5, 46], [4, 47], [4.5, 52], [5, 53], [9.5, 15]] },
    egri: { t: 'Eğrisel ilişki', xl: 'stres düzeyi', yl: 'performans', p: [[0.5, 30], [1.5, 48], [2.5, 62], [3.5, 72], [4.5, 78], [5.5, 77], [6.5, 70], [7.5, 58], [8.5, 44], [9.5, 28]] }
  };
  var S = { k: 'saat', p: [], sq: true, own: false, ol: [[1, 40], [9, 80]], xp: 6, best: null };
  var xs = function () { return S.p.map(function (q) { return q[0]; }); }, ys = function () { return S.p.map(function (q) { return q[1]; }); };
  var draw = function () {
    var r = S.p.length >= 2 ? M.linreg(xs(), ys()) : null, g = '';
    for (var gx = 0; gx <= 10; gx += 2) g += '<line class="rg-gr" x1="' + sx(gx) + '" x2="' + sx(gx) + '" y1="' + PT + '" y2="' + (H - PB) + '"/><text class="rg-t" x="' + sx(gx) + '" y="' + (H - PB + 16) + '" text-anchor="middle">' + gx + '</text>';
    for (var gy = 0; gy <= 100; gy += 20) g += '<line class="rg-gr" x1="' + PL + '" x2="' + (W - PR) + '" y1="' + sy(gy) + '" y2="' + sy(gy) + '"/><text class="rg-t" x="' + (PL - 6) + '" y="' + (sy(gy) + 4) + '" text-anchor="end">' + gy + '</text>';
    g += '<text class="rg-al" x="' + (W - PR) + '" y="' + (H - 6) + '" text-anchor="end">' + X(SETS[S.k].xl) + '</text><text class="rg-al" x="' + PL + '" y="11">' + X(SETS[S.k].yl) + '</text>';
    var clipL = function (b0, b1) { var x0 = 0, x1 = 10, y0 = b0, y1 = b0 + b1 * 10; return { x1: sx(x0), y1: sy(y0), x2: sx(x1), y2: sy(y1) }; };
    if (r) {
      if (S.sq && !S.own) S.p.forEach(function (q, i) {
        var yh = r.b0 + r.b1 * q[0], py = sy(q[1]), ph = sy(yh), side = Math.abs(py - ph), x0 = sx(q[0]);
        g += '<rect class="rg-sq" x="' + (x0 - (q[1] > yh ? side : 0)).toFixed(1) + '" y="' + Math.min(py, ph).toFixed(1) + '" width="' + side.toFixed(1) + '" height="' + side.toFixed(1) + '"/>';
      });
      S.p.forEach(function (q) { var yh = r.b0 + r.b1 * q[0]; g += '<line class="rg-res" x1="' + sx(q[0]) + '" x2="' + sx(q[0]) + '" y1="' + sy(q[1]).toFixed(1) + '" y2="' + sy(yh).toFixed(1) + '"/>'; });
      var l = clipL(r.b0, r.b1); g += '<line class="rg-ls" x1="' + l.x1.toFixed(1) + '" y1="' + l.y1.toFixed(1) + '" x2="' + l.x2.toFixed(1) + '" y2="' + l.y2.toFixed(1) + '"/>';
      if (!S.own) { var yp = r.b0 + r.b1 * S.xp; g += '<line class="rg-pl" x1="' + sx(S.xp) + '" x2="' + sx(S.xp) + '" y1="' + (H - PB) + '" y2="' + sy(yp).toFixed(1) + '"/><line class="rg-pl" x1="' + PL + '" x2="' + sx(S.xp) + '" y1="' + sy(yp).toFixed(1) + '" y2="' + sy(yp).toFixed(1) + '"/><circle class="rg-pp" cx="' + sx(S.xp) + '" cy="' + sy(yp).toFixed(1) + '" r="6"/>'; }
    }
    if (S.own) {
      var ob1 = (S.ol[1][1] - S.ol[0][1]) / (S.ol[1][0] - S.ol[0][0]), ob0 = S.ol[0][1] - ob1 * S.ol[0][0], ol = clipL(ob0, ob1);
      S.p.forEach(function (q) { var yh = ob0 + ob1 * q[0], py = sy(q[1]), ph = sy(yh), side = Math.abs(py - ph); g += '<rect class="rg-sq own" x="' + (sx(q[0]) - (q[1] > yh ? side : 0)).toFixed(1) + '" y="' + Math.min(py, ph).toFixed(1) + '" width="' + side.toFixed(1) + '" height="' + side.toFixed(1) + '"/>'; });
      g += '<line class="rg-own" x1="' + ol.x1.toFixed(1) + '" y1="' + ol.y1.toFixed(1) + '" x2="' + ol.x2.toFixed(1) + '" y2="' + ol.y2.toFixed(1) + '"/>';
      S.ol.forEach(function (h, i) { g += '<g class="rg-h" data-h="' + i + '"><circle cx="' + sx(h[0]) + '" cy="' + sy(h[1]).toFixed(1) + '" r="11"/><path d="M' + (sx(h[0]) - 4) + ' ' + sy(h[1]).toFixed(1) + 'h8M' + sx(h[0]) + ' ' + (sy(h[1]) - 4).toFixed(1) + 'v8"/></g>'; });
    }
    S.p.forEach(function (q, i) { g += '<g class="rg-s" data-i="' + i + '" style="transform:translate(' + sx(q[0]).toFixed(1) + 'px,' + sy(q[1]).toFixed(1) + 'px)"><circle r="12" fill="transparent"/><path d="M0 -7l2 4.6 5 .5-3.8 3.3 1.1 4.9L0 2.8l-4.4 2.5 1.1-4.9L-7 -2.9l5-.5z"/></g>'; });
    svg.innerHTML = g;
    stats(r);
  };
  var stats = function (r) {
    var el = C.$('[data-rk]', root);
    if (!r) { el.innerHTML = '<p class="sub">En az iki yıldız gerekiyor.</p>'; return; }
    var sgn = r.b1 >= 0 ? '+' : '−', str = Math.abs(r.r) >= 0.7 ? 'güçlü' : Math.abs(r.r) >= 0.4 ? 'orta' : Math.abs(r.r) >= 0.2 ? 'zayıf' : 'yok denecek kadar zayıf';
    var h = '<div class="formula" style="font-size:15px">ŷ = ' + f(r.b0, 2) + ' ' + sgn + ' ' + f(Math.abs(r.b1), 2) + '·x</div><div class="kpis"><div class="kpi hl"><small>korelasyon r</small><b>' + f(r.r, 3) + '</b></div><div class="kpi"><small>R² (açıklanan varyans)</small><b>%' + f(r.r2 * 100, 1) + '</b></div><div class="kpi"><small>eğim b₁</small><b>' + f(r.b1, 2) + '</b></div><div class="kpi"><small>kesişim b₀</small><b>' + f(r.b0, 2) + '</b></div><div class="kpi"><small>KT_hata (kare alanları)</small><b>' + f(r.sse, 1) + '</b></div><div class="kpi"><small>n</small><b>' + r.n + '</b></div></div>';
    if (S.own) {
      var ob1 = (S.ol[1][1] - S.ol[0][1]) / (S.ol[1][0] - S.ol[0][0]), ob0 = S.ol[0][1] - ob1 * S.ol[0][0], se = M.sse(xs(), ys(), ob0, ob1), sc = Math.max(0, Math.round(100 * r.sse / se));
      h += '<div class="rg-race"><div><span class="lbl">senin doğrun</span><b>' + f(se, 1) + '</b><i style="width:' + Math.min(100, se / Math.max(se, r.sse) * 100) + '%;background:#E0A526"></i></div><div><span class="lbl">en küçük kareler</span><b>' + f(r.sse, 1) + '</b><i style="width:' + (r.sse / Math.max(se, r.sse) * 100) + '%;background:#2F6FB0"></i></div></div><p class="lbl">yakınlık puanın: <b>' + sc + ' / 100</b>' + (sc >= 97 ? ' · neredeyse kusursuz!' : '') + '</p>';
    } else h += '<p class="lbl" style="margin:6px 0 0">' + str.charAt(0).toUpperCase() + str.slice(1) + (r.r >= 0 ? ' pozitif' : ' negatif') + ' doğrusal ilişki. x = ' + f(S.xp, 1) + ' için tahmin ŷ = <b>' + f(r.b0 + r.b1 * S.xp, 1) + '</b>' + (S.xp > Math.max.apply(null, xs()) || S.xp < Math.min.apply(null, xs()) ? ' <span class="pill warn">veri aralığı dışında: dış değerleme riskli</span>' : '') + '</p>';
    var tip = S.k === 'egri' ? 'r neredeyse sıfır ama ilişki çok güçlü: <b>eğrisel</b>. Korelasyon yalnız doğrusal ilişkiyi ölçer; önce serpilme diyagramına bak.'
      : S.k === 'aykiri' ? 'Sağ alttaki tek yıldız doğruyu tek başına büküyor. Onu sürükleyip öbürlerinin hizasına getir; r’nin nasıl sıçradığını izle.'
      : S.k === 'rastgele' ? 'Ayakkabı numarası ile not arasında ilişki beklemeyiz; küçük bir r tesadüften de çıkabilir.'
      : 'Korelasyon nedensellik değildir. Çok çalışan öğrencinin notu yüksek; ama arada motivasyon gibi üçüncü bir değişken olabilir.';
    C.$('[data-rk]', root).innerHTML = h + IS.tip(tip, 'r = ' + f(r.r, 2));
  };
  var load = function (k) { S.k = k; S.p = SETS[k].p.map(function (q) { return q.slice(); }); var r = M.linreg(xs(), ys()); S.ol = [[1, 50], [9, 50]]; draw(); FN.bridgeSend(); };

  var QS = [
    { q: 'r = −0,85 ne anlatır?', o: ['güçlü negatif doğrusal ilişki', 'zayıf ilişki', 'x, y’yi azaltır (nedensel)', 'veri hatalı'], a: 0, n: 'İşaret yönü, büyüklük gücü gösterir; nedensellik söylemez.' },
    { q: 'ŷ = 35 + 5x modelinde eğimin yorumu?', o: ['x bir birim artınca y ortalama 5 birim artar', 'y her zaman 5’tir', 'x = 0 iken y = 5', 'r = 5'], a: 0, n: 'b₁ = 5: x’teki bir birimlik artış, tahmin edilen y’de 5 birimlik artış.' },
    { q: 'R² = 0,64 ise r kaçtır (ilişki pozitif)?', o: ['0,8', '0,64', '0,41', '0,32'], a: 0, n: 'Basit regresyonda R² = r²; √0,64 = 0,8.' },
    { q: 'En küçük kareler doğrusu neyi en aza indirir?', o: ['kalıntıların kareleri toplamını', 'kalıntıların toplamını', 'noktaların x uzaklığını', 'eğimi'], a: 0, n: 'Σ(y − ŷ)²; yukarıdaki karelerin toplam alanı.' },
    { q: 'r ≈ 0 çıktı. Hangisi kesin söylenebilir?', o: ['doğrusal ilişki zayıf; eğrisel ilişki olabilir', 'hiçbir ilişki yoktur', 'değişkenler bağımsızdır', 'veri yanlış girilmiştir'], a: 0, n: 'Eğrisel örnekte r ≈ 0 ama ilişki çok güçlü.' }
  ];

  FN.st.regresyon = {
    init: function () {
      root = C.$('#regresyon');
      root.innerHTML = IS.head({ k: 'istasyon 8 · korelasyon ve regresyon', title: 'Regresyon atölyesi', sub: 'Her yıldız bir öğrenci. Mavi çizgi en küçük kareler doğrusu; sarı kareler kalıntıların karesi. Bir yıldızı sürükle, boş yere tıklayıp yeni yıldız ekle: doğru, karelerin toplam alanını en küçük tutacak şekilde yeniden oturur.', weeks: ['İst II · 10. hafta: serpilme ve korelasyon', '11–12. hafta: basit doğrusal regresyon', '13. hafta: R², tahmin, varsayımlar'] }) +
        '<div class="seg" data-sets style="margin-bottom:14px"></div>' +
        '<div class="grid g2"><div class="card box" style="--cc:#6FD3F0"><div class="row" style="justify-content:space-between"><h2 data-rt></h2><div class="row"><label class="row lbl"><input type="checkbox" data-sq checked style="width:auto"> kalıntı kareleri</label><label class="row lbl"><input type="checkbox" data-own style="width:auto"> kendi doğrumu çizeyim</label></div></div>' +
        '<div class="stage"><svg class="rg-svg svgdrag" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="serpilme diyagramı ve regresyon doğrusu"></svg></div>' +
        '<div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-undo>son yıldızı sil</button><button type="button" class="btn sm" data-reload>veriyi geri al</button><span class="lbl">çift tıklama yıldızı siler</span></div>' +
        '<label class="sl"><span>tahmin için x</span><input type="range" min="0" max="10" step="0.1" value="6" data-xp><output data-xpo>6,0</output></label></div>' +
        '<div class="card box" style="--cc:#6FD3F0"><h2>Model</h2><div data-rk></div>' +
        IS.code({ x: [['=EĞİM(B2:B13;A2:A13)', 'b₁ (önce y, sonra x)'], ['=KESMENOKTASI(B2:B13;A2:A13)', 'b₀'], ['=KORELASYON(A2:A13;B2:B13)', 'r'], ['=RKARE(B2:B13;A2:A13)', 'R²'], ['=TAHMİN.DOĞRUSAL(6;B2:B13;A2:A13)', 'x = 6 için ŷ'], ['Veri › Veri Çözümleme › Regresyon', 't testleri ve ANOVA tablosu']],
          r: [['m <- lm(not ~ saat, data = d)', ''], ['summary(m)', 'katsayılar, R², p-değerleri'], ['cor(d$saat, d$not)', 'r'], ['predict(m, data.frame(saat = 6))', 'tahmin'], ['plot(d$saat, d$not); abline(m)', 'serpilme + doğru'], ['plot(m, which = 1)', 'kalıntı grafiği: varsayım kontrolü']] }) + '</div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      svg = C.$('.rg-svg', root);
      IS.seg(C.$('[data-sets]', root), Object.keys(SETS).map(function (k) { return [k, SETS[k].t]; }), S.k, function (k) { load(k); C.$('[data-rt]', root).textContent = SETS[k].t; });
      C.$('[data-rt]', root).textContent = SETS[S.k].t;
      C.$('[data-sq]', root).onchange = function (e) { S.sq = e.target.checked; draw(); };
      C.$('[data-own]', root).onchange = function (e) { S.own = e.target.checked; draw(); FN.bridgeSend(); };
      C.$('[data-undo]', root).onclick = function () { if (S.p.length > 2) { S.p.pop(); draw(); } };
      C.$('[data-reload]', root).onclick = function () { load(S.k); };
      C.$('[data-xp]', root).addEventListener('input', function (e) { S.xp = +e.target.value; C.$('[data-xpo]', root).textContent = f(S.xp, 1); draw(); });
      var toData = function (p) { return [Math.max(0, Math.min(10, sx.inv(p.x))), Math.max(0, Math.min(100, sy.inv(p.y)))]; };
      var moved = false;
      IS.drag(svg, function (e) {
        moved = false;
        var h = e.target.closest && e.target.closest('.rg-h'); if (h) return { h: +h.getAttribute('data-h') };
        var s = e.target.closest && e.target.closest('.rg-s'); if (s) return { i: +s.getAttribute('data-i') };
        return null;
      }, function (t, p) {
        moved = true; var d = toData(p);
        if (t.h != null) { S.ol[t.h] = [t.h === 0 ? Math.min(d[0], S.ol[1][0] - 0.5) : Math.max(d[0], S.ol[0][0] + 0.5), d[1]]; }
        else S.p[t.i] = [Math.round(d[0] * 10) / 10, Math.round(d[1])];
        draw();
      }, function () { FN.bridgeSend(); });
      svg.addEventListener('click', function (e) {
        if (moved || (e.target.closest && e.target.closest('.rg-s,.rg-h'))) return;
        var d = toData(IS.pt(svg, e)); if (S.p.length >= 40) { C.toast('en fazla 40 yıldız'); return; }
        S.p.push([Math.round(d[0] * 10) / 10, Math.round(d[1])]); draw(); FN.bridgeSend();
      });
      svg.addEventListener('dblclick', function (e) { var s = e.target.closest && e.target.closest('.rg-s'); if (s && S.p.length > 2) { S.p.splice(+s.getAttribute('data-i'), 1); draw(); } });
      load('saat');
      IS.quiz(C.$('[data-quiz]', root), QS, 'Regresyon');
    },
    ctx: function () {
      var r = S.p.length >= 2 ? M.linreg(xs(), ys()) : null;
      return IS.ctx('regresyon', SETS[S.k].t, r ? [['n', r.n], ['ŷ', f(r.b0, 2) + ' + ' + f(r.b1, 2) + 'x'], ['r', f(r.r, 3)], ['R²', f(r.r2, 3)]] : [],
        'öğrenci basit doğrusal regresyonu serpilme diyagramında çalışıyor. Noktalar: ' + S.p.map(function (q) { return '(' + q[0] + ', ' + q[1] + ')'; }).join(' '), ['R² ne demek?', 'Regresyonun varsayımları neler?', 'Korelasyon neden nedensellik değildir?']);
    }
  };
})();
