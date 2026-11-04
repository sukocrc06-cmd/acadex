/* ==========================================================================
   ACADEX İSTATİSTİK · 1. VERİ MASASI (labs/istatistik/is-betimsel.js), 03.11.2026
   İstatistik I, 1–4. hafta: veri türleri, frekans tablosu, histogram, merkezi eğilim,
   yayılım, çeyrekler ve kutu grafiği, çarpıklık.
     - yıldız şeridi: her gözlem bir yıldız, sayı doğrusunun üstünde istiflenir.
       Doğru bir tahterevalli; destek (üçgen) ortalamada durur, yani ortalama denge noktasıdır.
     - bir yıldızı sürükle: ortalama kayar, medyan neredeyse yerinde kalır (aykırı değer etkisi)
     - histogram: sınıf sayısı sürgüsü (başlangıç Sturges), frekans tablosu
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var SETS = {
    notlar: { t: 'Sınav notları', u: 'puan', d: 0, v: [45, 52, 58, 61, 63, 65, 66, 68, 70, 70, 71, 72, 74, 75, 75, 76, 78, 79, 80, 81, 82, 84, 85, 86, 88, 90, 91, 93, 95, 98], about: '30 öğrencinin vize notu' },
    kira: { t: 'Öğrenci kirası', u: 'bin TL', d: 1, v: [8.5, 9, 9.5, 10, 10, 10.5, 11, 11, 11.5, 12, 12, 12.5, 13, 14, 15, 16, 18, 22, 28], about: '19 öğrencinin aylık kirası (kurgusal)' },
    kahve: { t: 'Günlük kahve', u: 'fincan', d: 0, v: [0, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6], about: '16 öğrencinin dün içtiği kahve (kesikli veri)' },
    uyku: { t: 'Uyku süresi', u: 'saat', d: 1, v: [5.5, 6, 6, 6.5, 6.5, 7, 7, 7, 7, 7.5, 7.5, 8, 8, 8.5, 9], about: '15 öğrencinin dün geceki uykusu' },
    kendi: { t: 'Kendi verin', u: '', d: 2, v: [12, 15, 15, 18, 20, 21, 25], about: 'kendi girdiğin veri' }
  };
  var S = { k: 'notlar', v: SETS.notlar.v.slice(), bins: 0, dom: [0, 1], pk: 90 };
  var root, svg, W = 680, H = 270, L = 30, R = 30, AX = 176;
  var sx = function (v) { return L + (v - S.dom[0]) / (S.dom[1] - S.dom[0]) * (W - L - R); };
  var parse = function (s) {
    var out = [];
    String(s || '').split(/[\s;]+/).forEach(function (tok) {
      if (!tok) return;
      (/^-?\d+,\d+$/.test(tok) ? [tok] : tok.split(',')).forEach(function (q) { var v = C.num(q); if (isFinite(v)) out.push(v); });
    });
    return out.slice(0, 200);
  };
  var setDom = function () {
    var a = S.v, lo = Math.min.apply(null, a), hi = Math.max.apply(null, a), r = (hi - lo) || 1;
    S.dom = [lo - r * 0.15, hi + r * 0.55];
  };
  var round = function (v) { var d = SETS[S.k].d, p = Math.pow(10, d); return Math.round(v * p) / p; };

  /* ---------- yıldız şeridi ---------- */
  var STAR = 'M0 -7l2 4.6 5 .5-3.8 3.3 1.1 4.9L0 2.8l-4.4 2.5 1.1-4.9L-7 -2.9l5-.5z';
  var drawStage = function () {
    setDom();
    var ticks = [], step = Math.pow(10, Math.floor(Math.log10((S.dom[1] - S.dom[0]) / 6))), e = (S.dom[1] - S.dom[0]) / 6 / step;
    step *= e >= 5 ? 5 : e >= 2 ? 2 : 1;
    for (var t = Math.ceil(S.dom[0] / step) * step; t <= S.dom[1]; t += step) ticks.push(t);
    var g = '<rect width="' + W + '" height="' + H + '" fill="none"/>';
    g += '<g class="bt-tick">' + ticks.map(function (v) { return '<path d="M' + sx(v).toFixed(1) + ' ' + (AX + 4) + 'v5"/><text x="' + sx(v).toFixed(1) + '" y="' + (AX + 20) + '" text-anchor="middle">' + X(f(v, step < 1 ? 1 : 0)) + '</text>'; }).join('') + '</g>';
    g += '<g class="bt-beam"><rect x="' + (L - 10) + '" y="' + (AX - 1) + '" width="' + (W - L - R + 20) + '" height="5" rx="2.5"/></g>';
    g += '<g class="bt-stars">' + S.v.map(function (v, i) { return '<g class="bt-s" data-i="' + i + '" style="--d:' + (i * 0.025).toFixed(3) + 's"><path d="' + STAR + '"/><circle r="11" fill="transparent"/></g>'; }).join('') + '</g>';
    g += '<g class="bt-ful"><path d="M0 0l-13 24h26z"/><text y="40" text-anchor="middle">ortalama</text><text class="bt-fv" y="54" text-anchor="middle"></text></g>';
    g += '<g class="bt-pct"><path d="M0 -128V6"/><text y="-132" text-anchor="middle"></text></g>';
    g += '<g class="bt-med"><path d="M0 -150V0"/><text y="-154" text-anchor="middle">medyan</text></g>';
    g += '<g class="bt-box"><path class="bt-wh"/><rect class="bt-bx" height="18" rx="3"/><path class="bt-md"/><g class="bt-out"></g></g>';
    svg.innerHTML = g;
    place(true);
  };
  /* yıldızları istifle, desteği ve kutuyu güncelle */
  var place = function (first) {
    var cols = {};
    var order = S.v.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return a[0] - b[0]; });
    order.forEach(function (o) {
      var x = sx(o[0]), c = Math.round(x / 12), n = cols[c] = (cols[c] || 0) + 1;
      var el = svg.querySelector('.bt-s[data-i="' + o[1] + '"]');
      if (el && !el.classList.contains('drag')) el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (AX - 9 - (n - 1) * 13) + 'px)';
      if (el) el.classList.toggle('out', false);
    });
    var m = M.mean(S.v), md = M.median(S.v), b = M.box(S.v);
    svg.querySelector('.bt-ful').style.transform = 'translate(' + sx(m).toFixed(1) + 'px,' + (AX + 4) + 'px)';
    svg.querySelector('.bt-fv').textContent = f(m, 2);
    var pv = M.quantile(S.v, S.pk / 100), pg = svg.querySelector('.bt-pct'); pg.style.transform = 'translate(' + sx(pv).toFixed(1) + 'px,' + (AX - 2) + 'px)'; pg.querySelector('text').textContent = 'P' + S.pk;
    svg.querySelector('.bt-med').style.transform = 'translate(' + sx(md).toFixed(1) + 'px,' + (AX - 2) + 'px)';
    var yb = 236;
    svg.querySelector('.bt-wh').setAttribute('d', 'M' + sx(b.wlo) + ' ' + (yb + 9) + 'H' + sx(b.q1) + 'M' + sx(b.q3) + ' ' + (yb + 9) + 'H' + sx(b.whi) + 'M' + sx(b.wlo) + ' ' + (yb + 3) + 'v12M' + sx(b.whi) + ' ' + (yb + 3) + 'v12');
    var bx = svg.querySelector('.bt-bx'); bx.setAttribute('x', sx(b.q1)); bx.setAttribute('y', yb); bx.setAttribute('width', Math.max(1, sx(b.q3) - sx(b.q1)));
    svg.querySelector('.bt-md').setAttribute('d', 'M' + sx(b.med) + ' ' + yb + 'v18');
    svg.querySelector('.bt-out').innerHTML = b.out.map(function (v) { return '<circle cx="' + sx(v).toFixed(1) + '" cy="' + (yb + 9) + '" r="4"/>'; }).join('');
    b.out.forEach(function (v) { S.v.forEach(function (w, i) { if (w === v) { var el = svg.querySelector('.bt-s[data-i="' + i + '"]'); if (el) el.classList.add('out'); } }); });
    if (!first) stats();
  };

  /* ---------- sayılar, histogram, tablo ---------- */
  var stats = function () {
    var a = S.v, n = a.length, m = M.mean(a), md = M.median(a), mo = M.modes(a), s = M.sd(a), sk = M.skew(a), st = SETS[S.k], u = st.u ? ' ' + st.u : '';
    var kp = [['n', n], ['ortalama x̄', f(m, 2) + u], ['medyan', f(md, 2) + u], ['mod', mo.length ? mo.slice(0, 3).map(function (v) { return f(v, st.d); }).join(' · ') : 'yok'], ['aralık', f(Math.max.apply(null, a) - Math.min.apply(null, a), 2)],
      ['varyans s²', f(M.variance(a), 2)], ['std. sapma s', f(s, 2)], ['değişim katsayısı', '%' + f(s / m * 100, 1)], ['çarpıklık', isFinite(sk) ? f(sk, 2) : '—'], ['basıklık (fazlalık)', isFinite(M.kurt(a)) ? f(M.kurt(a), 2) : '—'], ['P' + S.pk + ' yüzdeliği', f(M.quantile(a, S.pk / 100), 2)]];
    C.$('[data-kp]', root).innerHTML = kp.map(function (k, i) { return '<div class="kpi' + (i === 1 ? ' hl' : '') + '"><small>' + k[0] + '</small><b>' + X(String(k[1])) + '</b></div>'; }).join('');
    var shape = !isFinite(sk) ? 'Çarpıklık için en az 3 gözlem gerekir.' : sk > 0.5 ? '<b>Sağa çarpık:</b> uzun kuyruk sağda; ortalama (' + f(m, 1) + ') medyanın (' + f(md, 1) + ') sağında. Kira, gelir gibi verilerde medyanı raporlamak daha dürüsttür.'
      : sk < -0.5 ? '<b>Sola çarpık:</b> uzun kuyruk solda; ortalama medyanın solunda kalır.' : '<b>Yaklaşık simetrik:</b> ortalama ile medyan birbirine yakın (' + f(m, 1) + ' / ' + f(md, 1) + ').';
    C.$('[data-shape]', root).innerHTML = IS.tip(shape, sk > 0.5 ? 'x̄>Me' : sk < -0.5 ? 'x̄<Me' : 'x̄≈Me');
    hist();
  };
  var hist = function () {
    var a = S.v, k = S.bins || M.sturges(a.length), d = SETS[S.k].d;
    var lo = Math.min.apply(null, a), hi = Math.max.apply(null, a);
    var h = M.hist(a, k, lo, hi + (hi === lo ? 1 : (hi - lo) * 1e-9));
    C.$('[data-bk]', root).textContent = k + ' sınıf' + (S.bins ? '' : ' (Sturges)');
    C.$('[data-hist]', root).innerHTML = C.chart({ w: 620, h: 250, y0: true, nb: k, al: 'histogram', xl: SETS[S.k].u, yl: 'frekans', x: [h.lo, h.lo + h.w * k],
      xticks: h.c.map(function (_, i) { return h.lo + h.w * i; }).concat([h.lo + h.w * k]).filter(function (_, i, ar) { return ar.length < 10 || i % 2 === 0; }), xf: function (v) { return f(v, d ? 1 : 0); },
      bars: h.c.map(function (c, i) { return { x: h.lo + h.w * (i + 0.5), y0: 0, y1: c, c: i % 2 ? '#2F6FB0' : '#3D7FC4', bw: 0.96, lab: c + ' gözlem' }; }) });
    var cum = 0;
    C.$('[data-ftab]', root).innerHTML = '<table class="t"><thead><tr><th>sınıf</th><th class="n">f</th><th class="n">göreli f</th><th class="n">birikimli f</th></tr></thead><tbody>' +
      h.c.map(function (c, i) { cum += c; return '<tr><td>' + f(h.lo + h.w * i, d ? 2 : 1) + ' – ' + f(h.lo + h.w * (i + 1), d ? 2 : 1) + '</td><td class="n">' + c + '</td><td class="n">%' + f(c / a.length * 100, 1) + '</td><td class="n">' + cum + '</td></tr>'; }).join('') + '</tbody></table>';
  };

  var load = function (k) {
    S.k = k; S.v = SETS[k].v.slice(); S.bins = 0;
    var rg = C.$('[data-bins]', root); rg.value = M.sturges(S.v.length);
    C.$('[data-own]', root).hidden = k !== 'kendi';
    C.$('[data-about]', root).textContent = SETS[k].about + ' · ' + S.v.length + ' gözlem';
    drawStage(); stats();
  };

  var QS = [
    { q: 'Bir sınıfta notlar 40, 50, 60, 70 ve 100. Hangisi aykırı değerden <b>en az</b> etkilenir?', o: ['medyan', 'ortalama', 'aralık', 'varyans'], a: 0, n: 'Medyan sıralamadaki ortadaki değerdir; 100 yerine 1000 yazsan da 60 kalır.' },
    { q: 'Kiralar sağa çarpık. Ortalama ile medyan için genellikle hangisi doğrudur?', o: ['ortalama > medyan', 'ortalama < medyan', 'ikisi eşittir', 'ilişki yoktur'], a: 0, n: 'Sağdaki uzun kuyruk ortalamayı kendine doğru çeker.' },
    { q: 'Örneklem varyansında paydada neden <b>n − 1</b> vardır?', o: ['ana kütle varyansını yansız tahmin etmek için', 'hesap kolay olsun diye', 'aykırı değeri atmak için', 'Excel öyle istediği için'], a: 0, n: 'x̄ veriden hesaplandığı için bir serbestlik derecesi harcanır; n − 1 ile s² yansız olur (Excel VAR.S, R var).' },
    { q: 'Q1 = 60, Q3 = 80 ise kutu grafiğinde üst bıyık en fazla nereye uzanır?', o: ['110', '100', '90', '120'], a: 0, n: 'IQR = 20; üst sınır Q3 + 1,5·IQR = 80 + 30 = 110. Ötesindekiler aykırı nokta olarak çizilir.' },
    { q: 'Basıklık (fazlalık) değeri +2 çıktı. Ne anlama gelir?', o: ['kuyruklar normalden kalın, tepe sivri', 'dağılım simetrik değil', 'veri normaldir', 'ortalama medyandan büyük'], a: 0, n: 'Excel BASIKLIK fazlalık basıklığı verir; normal dağılımda 0. Pozitif: sivri ve kalın kuyruklu (leptokurtik).' },
    { q: 'P90 = 88 ne demektir?', o: ['gözlemlerin yaklaşık %90’ı 88 ve altındadır', 'öğrencilerin %90’ı 88 almıştır', 'ortalama 88’dir', '88 aykırı değerdir'], a: 0, n: 'Yüzdelik, sıralı verinin o yüzdesinin altında kaldığı değerdir; Q1 = P25, medyan = P50, Q3 = P75.' },
    { q: '“Günlük kahve sayısı” hangi veri türüdür?', o: ['nicel, kesikli', 'nicel, sürekli', 'nitel, sıralı', 'nitel, sınıflayıcı'], a: 0, n: 'Sayılabilen tam değerler alır (0, 1, 2…): kesikli nicel veri.' }
  ];

  IS.bank.betimsel = QS;

  FN.st.betimsel = {
    init: function () {
      root = C.$('#betimsel');
      root.innerHTML = IS.head({ key: 'betimsel', k: 'istasyon 1 · betimsel istatistik', title: 'Veri masası', sub: 'Her gözlem bir yıldız. Destek üçgeni ortalamada durur: ortalama, verinin <b>denge noktasıdır</b>. Bir yıldızı sağa sürükle; ortalama kayar, medyan yerinde kalır.', weeks: ['İst I · 1. hafta: veri türleri', '2–3. hafta: tablo ve grafik', '4. hafta: merkezi eğilim ve yayılım'] }) +
        '<div class="grid gside"><div class="card box" style="--cc:#FFD86B"><h2>Veri seti</h2><p class="sub" data-about></p><div class="seg" data-sets></div>' +
        '<div data-own hidden style="margin-top:10px"><label class="fld">sayılarını yaz<small>boşluk, satır ya da noktalı virgülle ayır; ondalık için virgül (7,5)</small><textarea data-ta rows="3" style="width:100%;border:1.5px solid var(--line-2);border-radius:10px;padding:8px;font:inherit">12 15 15 18 20 21 25</textarea></label><button type="button" class="btn sm pri" data-use style="margin-top:6px">yıldızlara dök</button></div>' +
        '<div class="kpis" data-kp></div><div data-shape></div></div>' +
        '<div class="card box" style="--cc:#FFD86B"><h2>Yıldız şeridi</h2><p class="sub">Altta kutu grafiği: kutu Q1–Q3, çizgi medyan, bıyıklar 1,5·IQR; ötesi aykırı. Yıldıza tıkla ya da sürükle.</p>' +
        '<div class="stage"><svg class="bt-svg svgdrag" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Verinin yıldız şeridi, ortalama desteği ve kutu grafiği"></svg></div>' +
        '<label class="sl"><span>yüzdelik (percentile): verinin yüzde kaçı altında kalsın?</span><input type="range" min="1" max="99" step="1" value="90" data-pk><output data-pko>P90</output></label>' +
        '<div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-reset>veriyi geri al</button><button type="button" class="btn sm" data-outlier>aykırı değer ekle</button><span class="lbl" data-live></span></div></div></div>' +
        '<div class="grid g2" style="margin-top:18px"><div class="card box" style="--cc:#2F6FB0"><h2>Histogram</h2><div class="row"><label class="lbl" for="bt-bins">sınıf sayısı</label><input id="bt-bins" type="range" min="3" max="15" data-bins style="max-width:220px"><span class="pill" data-bk></span></div><div data-hist></div>' +
        IS.tip('Sınıf sayısını değiştir: çok az sınıf şekli gizler, çok fazla sınıf gürültü yapar. Sturges kuralı k ≈ 1 + log₂n iyi bir başlangıçtır.', 'k') + '</div>' +
        '<div class="card box" style="--cc:#2F6FB0"><h2>Frekans tablosu</h2><div class="tbl-w" data-ftab></div>' +
        IS.code({ x: [['=ORTALAMA(A2:A31)', 'aritmetik ortalama'], ['=ORTANCA(A2:A31)', 'medyan'], ['=ENÇOK_OLAN.TEK(A2:A31)', 'mod'], ['=VAR.S(A2:A31)', 'örneklem varyansı (n − 1)'], ['=STDSAPMA.S(A2:A31)', 'örneklem standart sapması'], ['=DÖRTTEBİRLİK.DHL(A2:A31;1)', 'Q1 (3 yazarsan Q3)'], ['=ÇARPIKLIK(A2:A31)', 'çarpıklık'], ['=BASIKLIK(A2:A31)', 'basıklık (normalde 0)'], ['=YÜZDEBİRLİK.DHL(A2:A31;0,9)', '90. yüzdelik'], ['=SIKLIK(A2:A31;C2:C7)', 'sınıf üst sınırlarına göre frekans']],
          r: [['summary(x)', 'min, Q1, medyan, ortalama, Q3, maks'], ['mean(x); median(x)', ''], ['var(x); sd(x)', 'n − 1 ile'], ['quantile(x, c(.25, .75))', 'tip 7 = Excel DÖRTTEBİRLİK.DHL'], ['names(which.max(table(x)))', 'mod'], ['hist(x, breaks = "Sturges")', ''], ['boxplot(x, horizontal = TRUE)', '']] }) + '</div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      svg = C.$('.bt-svg', root);
      IS.seg(C.$('[data-sets]', root), Object.keys(SETS).map(function (k) { return [k, SETS[k].t]; }), S.k, load);
      C.$('[data-pk]', root).addEventListener('input', function (e) { S.pk = +e.target.value; C.$('[data-pko]', root).textContent = 'P' + S.pk; place(); });
      C.$('[data-bins]', root).addEventListener('input', function (e) { S.bins = +e.target.value; hist(); });
      C.$('[data-use]', root).onclick = function () { var v = parse(C.$('[data-ta]', root).value); if (v.length < 2) { C.toast('en az iki sayı yaz'); return; } SETS.kendi.v = v; load('kendi'); };
      C.$('[data-reset]', root).onclick = function () { load(S.k); };
      C.$('[data-outlier]', root).onclick = function () {
        var hi = Math.max.apply(null, S.v), r = hi - Math.min.apply(null, S.v) || 1; S.v.push(round(hi + r * 0.5));
        var m0 = M.mean(S.v.slice(0, -1)), md0 = M.median(S.v.slice(0, -1)); drawStage(); stats();
        C.$('[data-live]', root).textContent = 'ortalama ' + f(m0, 2) + ' → ' + f(M.mean(S.v), 2) + ' · medyan ' + f(md0, 2) + ' → ' + f(M.median(S.v), 2);
      };
      IS.drag(svg, function (e) { var g = e.target.closest && e.target.closest('.bt-s'); if (!g) return null; g.classList.add('drag'); return g; },
        function (g, p) {
          var i = +g.getAttribute('data-i'), v = round(Math.max(S.dom[0], Math.min(S.dom[1], (p.x - L) / (W - L - R) * (S.dom[1] - S.dom[0]) + S.dom[0])));
          S.v[i] = v; g.style.transform = 'translate(' + sx(v).toFixed(1) + 'px,' + Math.min(AX - 9, p.y).toFixed(1) + 'px)';
          place(); C.$('[data-live]', root).textContent = 'bu yıldız: ' + f(v, SETS[S.k].d) + ' · ortalama ' + f(M.mean(S.v), 2) + ' · medyan ' + f(M.median(S.v), 2);
        }, function () { C.$$('.bt-s.drag', svg).forEach(function (g) { g.classList.remove('drag'); }); place(); FN.bridgeSend(); });
      load('notlar');
      IS.quiz(C.$('[data-quiz]', root), QS, 'Veri masası');
    },
    ctx: function () {
      var a = S.v;
      return IS.ctx('betimsel', SETS[S.k].t, [['n', a.length], ['ortalama', f(M.mean(a), 2)], ['medyan', f(M.median(a), 2)], ['std. sapma', f(M.sd(a), 2)], ['çarpıklık', f(M.skew(a), 2)]],
        'öğrenci betimsel istatistik çalışıyor: ' + SETS[S.k].about + '. Ekrandaki veri: ' + a.join('; '), ['Ortalama mı medyan mı raporlamalıyım?', 'Standart sapmayı sezgisel anlat', 'Kutu grafiğini nasıl okurum?']);
    }
  };
})();
