/* ==========================================================================
   ACADEX İSTATİSTİK · VERİ VE GRAFİK ATÖLYESİ (labs/istatistik/is-grafik.js), 03.11.2026
   AYBÜ BUS201 1–4. ve 6. hafta: istatistiğin temel kavramları, veri türleri ve ölçek düzeyleri,
   veri kaynakları, tablo ve grafikle sunum (Excel), dört ortalama.
     - ölçek düzeyleri: değişken kartlarını doğru kutuya at (sınıflayıcı, sıralı, aralık, oran)
     - grafik dönüşümü: aynı veri pasta → sütun → pareto → histogram → ogive → kutu → dal-yaprak
       arasında akarak dönüşür (her parça 48 noktalı bir çokgen; noktalar birbirine akar).
       Hangi veriye hangi grafiğin uyduğu rozetle söylenir.
     - yanıltıcı grafik avı: kesik eksen, seçici zaman aralığı, alanı büyüyen resim
     - dört ortalama: büyüme oranı (geometrik), hız (harmonik), genel (H ≤ G ≤ x̄ ≤ Q)
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, sub = 'olcek';
  var COLS = ['#2F6FB0', '#C8553D', '#1F8A7A', '#E0A526', '#6B4FB3', '#B84A6B', '#3E8E5B', '#0D5C8C'];

  /* ---------- 1) ölçek düzeyleri ---------- */
  var LV = [['nom', 'sınıflayıcı', 'nominal'], ['ord', 'sıralı', 'ordinal'], ['int', 'aralık', 'interval'], ['rat', 'oran', 'ratio']];
  var CARDS = [
    ['Cinsiyet', 'nom', 'Yalnız ad verir; sıralanamaz.'], ['İl plaka kodu', 'nom', 'Sayı gibi görünür ama yalnız etikettir: 06 > 01 bir anlam taşımaz.'],
    ['Memnuniyet (1–5)', 'ord', 'Sıra var; ama 4 ile 5 arası, 1 ile 2 arasına eşit mi bilinmez.'], ['Sınav sıralaması', 'ord', 'Birinci ile ikinci arasındaki puan farkı her sırada farklı olabilir.'],
    ['Sıcaklık (°C)', 'int', 'Farklar anlamlı, 0 °C “sıcaklık yok” demek değil: 20 °C, 10 °C’nin iki katı değildir.'], ['Doğum yılı', 'int', 'Yıllar arası fark anlamlı; 0 yılı keyfî bir başlangıçtır.'],
    ['Aylık gelir (TL)', 'rat', 'Gerçek sıfır var: 20.000 TL, 10.000 TL’nin iki katıdır.'], ['Boy (cm)', 'rat', 'Gerçek sıfır var; oranlar anlamlıdır.']
  ];
  var O = { pick: null, done: {}, src: {} };
  var SRC = [['Kendi yaptığın kampüs anketi', 'b'], ['TÜİK’ten indirilen enflasyon serisi', 'i'], ['Şirketin geçmiş satış kayıtları', 'i'], ['Laboratuvarda yaptığın deney', 'b']];
  var olcekDraw = function () {
    var left = CARDS.map(function (c, i) { return i; }).filter(function (i) { return !O.done[i]; });
    C.$('[data-cards]', root).innerHTML = left.length ? left.map(function (i) { return '<button type="button" class="gf-card' + (O.pick === i ? ' on' : '') + '" data-c="' + i + '">' + X(CARDS[i][0]) + '</button>'; }).join('') : '<p class="lbl">Bütün kartlar yerinde. Aşağıdaki tablo hangi ölçekte hangi istatistiğin kullanılabileceğini gösteriyor.</p>';
    C.$('[data-bins]', root).innerHTML = LV.map(function (l) {
      return '<button type="button" class="gf-bin" data-l="' + l[0] + '"><b>' + X(l[1]) + '</b><span class="en">' + l[2] + '</span><span class="gf-in">' + Object.keys(O.done).filter(function (i) { return CARDS[i][1] === l[0]; }).map(function (i) { return '<i>' + X(CARDS[i][0]) + '</i>'; }).join('') + '</span></button>';
    }).join('');
    C.$$('[data-c]', root).forEach(function (b) { b.onclick = function () { O.pick = +b.getAttribute('data-c'); olcekDraw(); }; });
    C.$$('[data-l]', root).forEach(function (b) {
      b.onclick = function () {
        if (O.pick == null) { C.toast('önce bir kart seç'); return; }
        var c = CARDS[O.pick], ok = c[1] === b.getAttribute('data-l');
        C.$('[data-ofb]', root).innerHTML = '<p class="' + (ok ? 'gf-ok' : 'gf-no') + '"><b>' + (ok ? 'Doğru. ' : 'Olmadı. ') + '</b>' + X(c[0]) + ': ' + X(c[2]) + '</p>';
        if (ok) { O.done[O.pick] = 1; O.pick = null; olcekDraw(); var bb = C.$('[data-l="' + c[1] + '"] .gf-in i:last-child', root); if (bb) bb.classList.add('new'); }
        else { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      };
    });
    C.$('[data-src]', root).innerHTML = SRC.map(function (q, i) { var a = O.src[i]; return '<div class="gf-src"><span>' + X(q[0]) + '</span><div class="seg"><button type="button" data-s="' + i + ',b" aria-pressed="' + (a === 'b') + '">birincil</button><button type="button" data-s="' + i + ',i" aria-pressed="' + (a === 'i') + '">ikincil</button></div>' + (a ? '<b class="' + (a === q[1] ? 'gf-ok' : 'gf-no') + '">' + (a === q[1] ? '✓' : '✗') + '</b>' : '') + '</div>'; }).join('');
    C.$$('[data-s]', root).forEach(function (b) { b.onclick = function () { var p = b.getAttribute('data-s').split(','); O.src[+p[0]] = p[1]; olcekDraw(); }; });
  };

  /* ---------- 2) grafik dönüşümü ---------- */
  var KAT = { lab: ['İşletme', 'UTİ', 'İktisat', 'YBS', 'Kamu Yön.'], v: [42, 35, 28, 18, 12], t: 'Bölüm tercihleri (kişi)' };
  var SAY = { v: [45, 52, 58, 61, 63, 65, 66, 68, 70, 70, 71, 72, 74, 75, 75, 76, 78, 79, 80, 81, 82, 84, 85, 86, 88, 90, 91, 93, 95, 98], t: 'Vize notları (30 öğrenci)' };
  var CH = {
    kat: [['pasta', 'pasta', 'pie', 1], ['sutun', 'sütun', 'bar', 1], ['pareto', 'pareto', 'Pareto', 1], ['yatay', 'çubuk', 'horizontal bar', 1], ['cizgi', 'çizgi', 'line', 0]],
    say: [['histogram', 'histogram', 'histogram', 1], ['poligon', 'frekans poligonu', 'frequency polygon', 1], ['ogive', 'ogive', 'ogive', 1], ['kutu', 'kutu', 'box plot', 1], ['dal', 'dal-yaprak', 'stem-and-leaf', 1], ['pasta', 'pasta', 'pie', 0]]
  };
  var WHY = {
    'kat.pasta': 'Bütünün parçaları: kategoriler ve paylar. 5–6 dilimden fazlası okunmaz.', 'kat.sutun': 'Kategorileri karşılaştırmanın en okunaklı yolu: uzunluk gözle iyi okunur.',
    'kat.pareto': 'Büyükten küçüğe sıralı sütun + birikimli çizgi: “az sayıda kategori payın çoğunu tutar”. İşletmede kalite ve satış analizinde sık.',
    'kat.yatay': 'Kategori adları uzunsa yatay çubuk daha rahat okunur.', 'kat.cizgi': '<b>Uygun değil:</b> çizgi, noktalar arasında süreklilik (zaman gibi) varsayar. Bölümler arasında “ara değer” yoktur.',
    'say.histogram': 'Sürekli verinin şekli: sınıflar bitişiktir, sütunlar arasında boşluk yoktur.', 'say.poligon': 'Sınıf orta noktalarını birleştirir; iki dağılımı üst üste karşılaştırmak için iyidir.',
    'say.ogive': 'Birikimli frekans: “kaç öğrenci 70’in altında?” sorusunu yatay çizgiyle okursun. Medyan, yarı yüksekliğe denk gelir.',
    'say.kutu': 'Beş sayı özeti (min, Q1, medyan, Q3, maks) ve aykırılar tek bakışta.', 'say.dal': 'Hem tablo hem grafik: ham veri kaybolmaz. Küçük veri setleri için.',
    'say.pasta': '<b>Uygun değil:</b> sınıflar sıralı ve bitişik; pasta bu sırayı ve şekli gizler.'
  };
  var G = { d: 'kat', c: 'pasta', cur: null, raf: 0 };
  var K = 48, PW = 640, PH = 340, L0 = 60, R0 = 610, T0 = 28, B0 = 290;
  var wedge = function (cx, cy, r, a0, a1) { var p = [[cx, cy]]; for (var i = 0; i < K - 1; i++) { var a = a0 + (a1 - a0) * i / (K - 2); p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
  var rect = function (x, y, w, h) {
    var p = [[x, y + h]], per = h + w + h;
    for (var i = 1; i < K; i++) { var d = per * (i - 1) / (K - 2), q; if (d <= h) q = [x, y + h - d]; else if (d <= h + w) q = [x + d - h, y]; else q = [x + w, y + (d - h - w)]; p.push(q); }
    return p;
  };
  var dot = function (cx, cy, r) { var p = []; for (var i = 0; i < K; i++) { var a = Math.PI / 2 + 2 * Math.PI * i / K; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
  var hrect = function (x, y, w, h) { return rect(x, y, w, h); };
  var bins = function () { var h = M.hist(SAY.v, 6, 40, 100); return h; };
  var target = function () {
    var out = [], ov = '', d = G.d, c = G.c;
    if (d === 'kat') {
      var v = KAT.v, tot = M.sum(v), n = v.length, mx = Math.max.apply(null, v), ord = v.map(function (_, i) { return i; });
      if (c === 'pareto') ord.sort(function (a, b) { return v[b] - v[a]; });
      var sy = function (y) { return B0 - y / (mx * 1.15) * (B0 - T0); }, slot = (R0 - L0) / n;
      if (c === 'pasta') { var a = -Math.PI / 2; v.forEach(function (x, i) { var a1 = a + x / tot * 2 * Math.PI; out[i] = wedge(250, 160, 120, a, a1); var am = (a + a1) / 2; ov += '<text x="' + (250 + 150 * Math.cos(am)).toFixed(0) + '" y="' + (164 + 145 * Math.sin(am)).toFixed(0) + '" text-anchor="middle">' + X(KAT.lab[i]) + ' %' + Math.round(x / tot * 100) + '</text>'; a = a1; }); }
      else if (c === 'yatay') { var sx = function (x) { return 130 + x / (mx * 1.1) * (R0 - 140); }, bh = (B0 - T0) / n; v.forEach(function (x, i) { out[i] = hrect(130, T0 + i * bh + bh * 0.15, sx(x) - 130, bh * 0.7); ov += '<text x="122" y="' + (T0 + i * bh + bh * 0.58).toFixed(0) + '" text-anchor="end">' + X(KAT.lab[i]) + '</text><text x="' + (sx(x) + 6).toFixed(0) + '" y="' + (T0 + i * bh + bh * 0.58).toFixed(0) + '">' + x + '</text>'; }); }
      else {
        ord.forEach(function (i, k) { var x0 = L0 + k * slot; out[i] = c === 'cizgi' ? dot(x0 + slot / 2, sy(v[i]), 6) : rect(x0 + slot * 0.18, sy(v[i]), slot * 0.64, B0 - sy(v[i])); ov += '<text x="' + (x0 + slot / 2).toFixed(0) + '" y="' + (B0 + 18) + '" text-anchor="middle">' + X(KAT.lab[i]) + '</text>'; });
        ov += '<path class="gf-ax" d="M' + L0 + ' ' + B0 + 'H' + R0 + 'M' + L0 + ' ' + B0 + 'V' + T0 + '"/>';
        if (c === 'cizgi') ov += '<path class="gf-ln bad" d="' + ord.map(function (i, k) { return (k ? 'L' : 'M') + (L0 + k * slot + slot / 2).toFixed(1) + ' ' + sy(v[i]).toFixed(1); }).join('') + '"/>';
        if (c === 'pareto') { var cum = 0, py = function (q) { return B0 - q * (B0 - T0); }; ov += '<path class="gf-ln" d="' + ord.map(function (i, k) { cum += v[i]; return (k ? 'L' : 'M') + (L0 + k * slot + slot / 2).toFixed(1) + ' ' + py(cum / tot).toFixed(1); }).join('') + '"/>'; cum = 0; ord.forEach(function (i, k) { cum += v[i]; ov += '<text class="gf-pc" x="' + (L0 + k * slot + slot / 2 + 6).toFixed(0) + '" y="' + (py(cum / tot) - 6).toFixed(0) + '">%' + Math.round(cum / tot * 100) + '</text>'; }); ov += '<text class="gf-pc" x="' + (L0 + 8) + '" y="' + (T0 + 4) + '">sarı çizgi: birikimli %</text>'; }
      }
    } else {
      var h = bins(), k = h.c.length, cmx = Math.max.apply(null, h.c), sxN = function (x) { return L0 + (x - 40) / 60 * (R0 - L0); }, syN = function (y) { return B0 - y / (cmx * 1.2) * (B0 - T0); };
      var tk = ''; for (var t = 40; t <= 100; t += 10) tk += '<text x="' + sxN(t).toFixed(0) + '" y="' + (B0 + 18) + '" text-anchor="middle">' + t + '</text>';
      if (c === 'histogram') { h.c.forEach(function (n2, i) { out[i] = rect(sxN(40 + i * 10), syN(n2), sxN(50) - sxN(40), B0 - syN(n2)); ov += '<text x="' + sxN(45 + i * 10).toFixed(0) + '" y="' + (syN(n2) - 6).toFixed(0) + '" text-anchor="middle">' + n2 + '</text>'; }); ov += tk + '<path class="gf-ax" d="M' + L0 + ' ' + B0 + 'H' + R0 + '"/>'; }
      else if (c === 'poligon') { h.c.forEach(function (n2, i) { out[i] = dot(sxN(45 + i * 10), syN(n2), 6); }); ov += tk + '<path class="gf-ax" d="M' + L0 + ' ' + B0 + 'H' + R0 + '"/><path class="gf-ln" d="M' + sxN(35) + ' ' + B0 + h.c.map(function (n2, i) { return 'L' + sxN(45 + i * 10).toFixed(1) + ' ' + syN(n2).toFixed(1); }).join('') + 'L' + sxN(105) + ' ' + B0 + '"/>'; }
      else if (c === 'ogive') { var cu = 0, syC = function (y) { return B0 - y / SAY.v.length * (B0 - T0); }, pts = [[sxN(40), B0]]; h.c.forEach(function (n2, i) { cu += n2; out[i] = dot(sxN(50 + i * 10), syC(cu), 6); pts.push([sxN(50 + i * 10), syC(cu)]); }); ov += tk + '<path class="gf-ax" d="M' + L0 + ' ' + B0 + 'H' + R0 + '"/><path class="gf-ln" d="' + pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + '"/><path class="gf-md" d="M' + L0 + ' ' + syC(15) + 'H' + sxN(M.median(SAY.v)) + 'V' + B0 + '"/><text class="gf-pc" x="' + (sxN(M.median(SAY.v)) + 6) + '" y="' + (B0 - 8) + '">medyan ≈ ' + f(M.median(SAY.v), 1) + '</text><text class="gf-pc" x="' + (L0 + 4) + '" y="' + (syC(15) - 6) + '">15 öğrenci (yarısı)</text>'; }
      else if (c === 'kutu') { var b = M.box(SAY.v), yb = 170; h.c.forEach(function (n2, i) { var cx = Math.max(sxN(b.q1) + 6, Math.min(sxN(b.q3) - 6, sxN(45 + i * 10))); out[i] = rect(cx - 4, yb - 26, 8, 52); }); ov += tk + '<path class="gf-ax" d="M' + L0 + ' ' + B0 + 'H' + R0 + '"/><rect class="gf-box" x="' + sxN(b.q1) + '" y="' + (yb - 30) + '" width="' + (sxN(b.q3) - sxN(b.q1)) + '" height="60" rx="4"/><path class="gf-wh" d="M' + sxN(b.wlo) + ' ' + yb + 'H' + sxN(b.q1) + 'M' + sxN(b.q3) + ' ' + yb + 'H' + sxN(b.whi) + 'M' + sxN(b.wlo) + ' ' + (yb - 14) + 'v28M' + sxN(b.whi) + ' ' + (yb - 14) + 'v28M' + sxN(b.med) + ' ' + (yb - 30) + 'v60"/>' + [['min', b.wlo], ['Q1', b.q1], ['Me', b.med], ['Q3', b.q3], ['maks', b.whi]].map(function (q, i) { return '<text class="gf-pc" x="' + sxN(q[1]).toFixed(0) + '" y="' + (yb - 40 - (i % 2) * 14) + '" text-anchor="middle">' + q[0] + ' ' + f(q[1], 1) + '</text>'; }).join(''); }
      else if (c === 'dal') { var bh = (B0 - T0) / k; h.c.forEach(function (n2, i) { var stem = 4 + i, leaves = SAY.v.filter(function (x) { return Math.floor(x / 10) === stem || (stem === 9 && x === 100); }).map(function (x) { return x % 10; }); out[i] = rect(150, T0 + i * bh + bh * 0.2, Math.max(4, leaves.length * 26), bh * 0.6); ov += '<text class="gf-stem" x="128" y="' + (T0 + i * bh + bh * 0.62).toFixed(0) + '" text-anchor="end">' + stem + ' |</text><text class="gf-leaf" x="160" y="' + (T0 + i * bh + bh * 0.62).toFixed(0) + '">' + leaves.join('  ') + '</text>'; }); ov += '<text class="gf-pc" x="' + R0 + '" y="' + (B0 + 18) + '" text-anchor="end">dal = onlar basamağı, yaprak = birler (7 | 5 = 75)</text>'; }
      else { var a2 = -Math.PI / 2; h.c.forEach(function (n2, i) { var a3 = a2 + n2 / SAY.v.length * 2 * Math.PI; out[i] = wedge(250, 160, 120, a2, a3); a2 = a3; }); ov += '<text class="gf-pc" x="420" y="160">sıra ve şekil kayboldu</text>'; }
    }
    return { p: out, ov: ov };
  };
  var dPath = function (p) { return 'M' + p.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z'; };
  var gDraw = function (fresh) {
    var svg = C.$('[data-gf]', root), tg = target(), n = tg.p.length, list = CH[G.d], meta = list.filter(function (q) { return q[0] === G.c; })[0];
    if (fresh || !G.cur || G.cur.length !== n) {
      svg.innerHTML = '<g class="gf-pieces">' + tg.p.map(function (p, i) { return '<path class="gf-p" fill="' + COLS[i % COLS.length] + '" d="' + dPath(p) + '"/>'; }).join('') + '</g><g class="gf-ov">' + tg.ov + '</g>';
      G.cur = tg.p;
    } else {
      var from = G.cur, to = tg.p, els = C.$$('.gf-p', svg), t0 = performance.now(), dur = C.RM ? 0 : 700, ov = svg.querySelector('.gf-ov');
      ov.classList.add('out'); cancelAnimationFrame(G.raf);
      var step = function (t) {
        var k = dur ? Math.min(1, (t - t0) / dur) : 1, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        els.forEach(function (el, i) { el.setAttribute('d', dPath(from[i].map(function (q, j) { return [q[0] + (to[i][j][0] - q[0]) * e, q[1] + (to[i][j][1] - q[1]) * e]; }))); });
        if (k < 1) G.raf = requestAnimationFrame(step); else { G.cur = to; ov.innerHTML = tg.ov; ov.classList.remove('out'); }
      };
      G.raf = requestAnimationFrame(step);
    }
    C.$('[data-gfb]', root).innerHTML = '<span class="pill ' + (meta[3] ? 'ok' : 'bad') + '">' + (meta[3] ? 'bu veriye uygun' : 'bu veriye uygun değil') + '</span> <span class="lbl">' + X(meta[1]) + ' <span class="en">' + X(meta[2]) + '</span></span>';
    C.$('[data-gfw]', root).innerHTML = IS.tip(WHY[G.d + '.' + G.c], meta[3] ? '✓' : '✗');
  };
  var gSeg = function () {
    IS.seg(C.$('[data-gc]', root), CH[G.d].map(function (q) { return [q[0], q[1]]; }), G.c, function (k) { G.c = k; gDraw(false); FN.bridgeSend(); });
    C.$('[data-gt]', root).textContent = G.d === 'kat' ? KAT.t + ' · nitel (kategorik) veri' : SAY.t + ' · nicel (sürekli) veri';
  };

  /* ---------- 3) yanıltıcı grafik avı ---------- */
  var Y = { k: 'eksen', fix: false };
  var YT = {
    eksen: { t: 'Kesik eksen', q: '“B ürünü A’nın beş katı satıyor!” Gerçekten mi?', a: 'Dikey eksen 95’ten başlıyor. 96 ile 100 arasındaki %4’lük fark, çubuk yüksekliğinde 5 kat görünüyor. Sütun grafiğinde eksen sıfırdan başlamalı.' },
    zaman: { t: 'Seçici zaman aralığı', q: '“Satışlar fırladı!” Son altı aya bakıyoruz…', a: 'Yalnız son altı ay seçilmiş. On yıllık seride satışlar düşüş trendinde; kısa bir toparlanma büyük bir yükseliş gibi sunulmuş.' },
    alan: { t: 'Büyüyen resim', q: 'Kâr iki katına çıktı; ikinci torba neden dört kat büyük görünüyor?', a: 'Resim hem eninde hem boyunda 2 kat büyütülmüş, alanı 4 kat olmuş. Göz alanı okur; doğrusu yalnız bir boyutta (ya da alanı 2 katına) büyütmek.' }
  };
  /* iskelet her örnekte bir kez çizilir; düzeltme düğmesi yalnız stilleri değiştirir, geçiş CSS ile akar */
  var ySer = (function () { var r = M.seeded(3), a = []; for (var i = 0; i < 120; i++) a.push(100 - i * 0.35 + 6 * Math.sin(i / 6) + (r() - 0.5) * 4 + (i > 113 ? (i - 113) * 2.2 : 0)); return a; })();
  var bag = function (s) { return 'M' + (s * 0.2) + ' ' + (s * 0.25) + 'Q0 ' + s + ' ' + (s / 2) + ' ' + s + 'Q' + s + ' ' + s + ' ' + (s * 0.8) + ' ' + (s * 0.25) + 'Z M' + (s * 0.3) + ' ' + (s * 0.25) + 'L' + (s * 0.4) + ' 0H' + (s * 0.6) + 'L' + (s * 0.7) + ' ' + (s * 0.25); };
  var yDraw = function () {
    var box = C.$('[data-yg]', root), o = YT[Y.k], svg = box.querySelector('svg');
    if (!svg || svg.getAttribute('data-k') !== Y.k) {
      var g = '';
      if (Y.k === 'eksen') g = '<g class="yg-ticks"></g><rect class="yg-b" data-b="0" x="150" width="110" fill="#9DB8FF"/><rect class="yg-b" data-b="1" x="320" width="110" fill="#FF8A7A"/><text x="205" y="270" text-anchor="middle">ürün A · 96</text><text x="375" y="270" text-anchor="middle">ürün B · 100</text>';
      else if (Y.k === 'zaman') g = '<path class="yg-l"/><text class="yg-t yg-from" x="90" y="270"></text><text class="yg-t" x="520" y="270" text-anchor="end">bugün</text>';
      else g = '<g transform="translate(150 170)"><path class="yg-bag" d="' + bag(70) + '"/><text x="35" y="49" text-anchor="middle" class="yg-tl">₺</text></g><g class="yg-g2"><path class="yg-bag yg-b2"/></g><text class="yg-t" x="185" y="268" text-anchor="middle">2024 · 1 mn TL kâr</text><text class="yg-t yg-l2" y="268" text-anchor="middle">2025 · 2 mn TL kâr</text>';
      box.innerHTML = '<svg viewBox="0 0 560 280" class="yg-svg" data-k="' + Y.k + '" role="img" aria-label="' + X(o.t) + '">' + g + '</svg>';
      svg = box.querySelector('svg'); void svg.getBoundingClientRect();
    }
    if (Y.k === 'eksen') {
      var lo = Y.fix ? 0 : 95, sy = function (v) { return 250 - (v - lo) / (101 - lo) * 220; };
      [96, 100].forEach(function (v, i) { var r = svg.querySelector('[data-b="' + i + '"]'); r.style.y = sy(v).toFixed(1) + 'px'; r.style.height = (250 - sy(v)).toFixed(1) + 'px'; });
      svg.querySelector('.yg-ticks').innerHTML = (Y.fix ? [0, 25, 50, 75, 100] : [95, 96, 97, 98, 99, 100, 101]).map(function (t) { return '<text class="yg-t" x="80" y="' + (sy(t) + 4).toFixed(1) + '" text-anchor="end">' + t + '</text><line class="yg-gr" x1="88" x2="520" y1="' + sy(t).toFixed(1) + '" y2="' + sy(t).toFixed(1) + '"/>'; }).join('');
    } else if (Y.k === 'zaman') {
      /* her iki görünüm de 120 nokta: kısa görünümde ilk 114 nokta sola sıkışır, böylece çizgi akarak açılır */
      var from = Y.fix ? 0 : 114, sl = ySer.slice(from), mn = Math.min.apply(null, sl), mx = Math.max.apply(null, sl), sy2 = IS.scale(Y.fix ? 40 : mn - 1, Y.fix ? 115 : mx + 1, 250, 30);
      var d = ySer.map(function (v, k) { var x = k < from ? 90 : 90 + (k - from) / (119 - from) * 430; return (k ? 'L' : 'M') + x.toFixed(1) + ' ' + Math.max(-200, Math.min(480, sy2(v))).toFixed(1); }).join('');
      var pth = svg.querySelector('.yg-l'); if (!pth.getAttribute('d')) pth.setAttribute('d', d); pth.style.d = 'path("' + d + '")';
      pth.style.opacity = 1; svg.querySelector('.yg-from').textContent = Y.fix ? '10 yıl önce' : '6 ay önce';
    } else {
      var s2 = Y.fix ? 70 * Math.SQRT2 : 140, b2 = svg.querySelector('.yg-b2');
      b2.style.d = 'path("' + bag(s2) + '")'; if (!b2.getAttribute('d')) b2.setAttribute('d', bag(s2));
      svg.querySelector('.yg-g2').style.transform = 'translate(330px,' + (240 - s2) + 'px)';
      var l2 = svg.querySelector('.yg-l2'); l2.setAttribute('x', (330 + s2 / 2).toFixed(0));
    }
    C.$('[data-yq]', root).innerHTML = '<p class="lbl" style="font-size:14px;color:var(--ink)">' + X(o.q) + '</p>' + (Y.fix ? IS.tip(o.a, 'yanıltma') : '');
    C.$('[data-yfix]', root).textContent = Y.fix ? 'yanıltıcı hâline dön' : 'hatayı göster ve düzelt';
  };

  /* ---------- 4) dört ortalama ---------- */
  var A = { k: 'buyume', gen: [4, 9, 16, 25, 36] };
  var means = function (a) { var n = a.length; return { A: M.mean(a), G: Math.exp(M.mean(a.map(Math.log))), H: n / M.sum(a.map(function (x) { return 1 / x; })), Q: Math.sqrt(M.mean(a.map(function (x) { return x * x; }))) }; };
  var aDraw = function () {
    var box = C.$('[data-av]', root), st = C.$('[data-ast]', root), html = '';
    if (A.k === 'buyume') {
      var r = [0.5, -0.3, 0.2, 0.1], gr = r.map(function (x) { return 1 + x; }), m = means(gr), am = M.mean(r), gm = m.G - 1, path = [[0, 1000]], v = 1000;
      r.forEach(function (x, i) { v *= 1 + x; path.push([i + 1, v]); });
      html = '<p class="sub">Bir hisse 4 yılda %50, −%30, %20, %10 getirdi. 1.000 TL ne oldu? Ortalama yıllık getiri kaç?</p>' + C.chart({ w: 600, h: 230, x: [0, 4], xticks: [0, 1, 2, 3, 4], al: 'büyüme', xl: 'yıl', yl: 'TL', y0: false,
        s: [{ p: path, c: '#0D1838', w: 3 }, { p: [0, 1, 2, 3, 4].map(function (t) { return [t, 1000 * Math.pow(1 + am, t)]; }), c: '#C8553D', w: 2, d: '6 4', lab: 'aritmetik %' + f(am * 100, 1) }, { p: [0, 1, 2, 3, 4].map(function (t) { return [t, 1000 * Math.pow(1 + gm, t)]; }), c: '#1E8A55', w: 2.4, d: '2 3', lab: 'geometrik %' + f(gm * 100, 2) + ' = gerçek son' }] }) + '<div class="leg"><span><i style="background:#0D1838"></i>gerçek değer</span><span><i style="background:#C8553D"></i>aritmetik ortalamayla</span><span><i style="background:#1E8A55"></i>geometrik ortalamayla</span></div>' +
        IS.tip('Aritmetik ortalama %' + f(am * 100, 1) + ' der; o oranla 4 yılda ' + C.nf(1000 * Math.pow(1 + am, 4)) + ' TL olurdu. Gerçekte ' + C.nf(v) + ' TL oldu. Büyüme oranlarının ortalaması <b>geometrik</b> alınır.', 'GEOORT');
      IS.steps(st, [{ t: 'oranları çarpana çevir', x: '1 + r → ' + gr.map(function (x) { return f(x, 2); }).join(' · ') }, { t: 'çarp', x: 'Π = ' + gr.map(function (x) { return f(x, 2); }).join(' × ') + ' = ' + f(v / 1000, 4) }, { t: 'n. kök', x: 'G = ' + f(v / 1000, 4) + '^(1/4) = ' + f(m.G, 4) }, { t: 'oranı geri al', x: 'ḡ = ' + f(m.G, 4) + ' − 1 = %' + f(gm * 100, 2) }], 'geometrik ortalama');
    } else if (A.k === 'hiz') {
      var hm = 2 / (1 / 60 + 1 / 90);
      html = '<p class="sub">Ankara’dan Eskişehir’e (240 km) 60 km/sa ile gidip 90 km/sa ile döndün. Ortalama hızın 75 mi?</p><div class="gf-trip"><div><span class="lbl">gidiş · 60 km/sa</span><i style="--w:100%;background:#C8553D"></i><b>4 saat</b></div><div><span class="lbl">dönüş · 90 km/sa</span><i style="--w:66.7%;background:#2F6FB0"></i><b>2 sa 40 dk</b></div></div>' +
        '<div class="kpis"><div class="kpi"><small>aritmetik (yanlış)</small><b style="color:var(--bad)">75 km/sa</b></div><div class="kpi hl"><small>harmonik (doğru)</small><b>' + f(hm, 0) + ' km/sa</b></div><div class="kpi"><small>kontrol: 480 km / 6,67 sa</small><b>' + f(480 / (20 / 3), 0) + ' km/sa</b></div></div>' + IS.tip('Daha yavaş giderken <b>daha uzun süre</b> geçirdin; bu yüzden ortalama 75’in altında. Sabit yolda hız (oran) ortalaması harmoniktir.', 'HARORT');
      IS.steps(st, [{ t: 'terslerini al', x: '1/60 = ' + f(1 / 60, 5) + '   1/90 = ' + f(1 / 90, 5) }, { t: 'terslerin ortalaması', x: '(' + f(1 / 60, 5) + ' + ' + f(1 / 90, 5) + ') / 2 = ' + f((1 / 60 + 1 / 90) / 2, 5) }, { t: 'yeniden ters çevir', x: 'H = 1 / ' + f((1 / 60 + 1 / 90) / 2, 5) + ' = ' + f(hm, 2) + ' km/sa' }], 'harmonik ortalama');
    } else {
      var mm = means(A.gen), lo = Math.min.apply(null, A.gen), hi = Math.max.apply(null, A.gen), sx = IS.scale(lo, hi, 40, 580), g = '';
      g += '<line x1="40" x2="580" y1="90" y2="90" class="gf-nl"/>' + A.gen.map(function (x) { return '<circle cx="' + sx(x).toFixed(1) + '" cy="90" r="5" class="gf-d"/>'; }).join('');
      [['H', mm.H, '#B84A6B', 'harmonik'], ['G', mm.G, '#1E8A55', 'geometrik'], ['x̄', mm.A, '#2F6FB0', 'aritmetik'], ['Q', mm.Q, '#E0A526', 'kareli']].forEach(function (q, i) {
        g += '<g class="gf-m" style="transform:translate(' + sx(q[1]).toFixed(1) + 'px,0)"><path d="M0 90V' + (40 - i * 0) + '" stroke="' + q[2] + '"/><circle cy="' + (36 - (i % 2) * 22) + '" r="13" fill="' + q[2] + '"/><text y="' + (40 - (i % 2) * 22) + '" text-anchor="middle">' + q[0] + '</text><text class="gf-mv" y="' + (120 + (i % 2) * 16) + '" text-anchor="middle" fill="' + q[2] + '">' + q[3] + ' ' + f(q[1], 2) + '</text></g>';
      });
      html = '<p class="sub">Pozitif sayılarını gir; dört ortalama sayı doğrusuna yerleşir. Her zaman H ≤ G ≤ x̄ ≤ Q; eşitlik yalnız bütün sayılar aynıysa.</p><label class="fld">sayılar (pozitif)<input type="text" data-ain value="' + A.gen.join(' ') + '"></label><div class="stage" style="margin-top:8px"><svg viewBox="0 0 620 150" class="gf-msvg" role="img" aria-label="dört ortalama">' + g + '</svg></div>';
      IS.steps(st, [{ t: 'aritmetik', x: 'x̄ = ' + f(M.sum(A.gen), 2) + ' / ' + A.gen.length + ' = ' + f(mm.A, 3) }, { t: 'geometrik', x: 'G = (' + A.gen.join('·') + ')^(1/' + A.gen.length + ') = ' + f(mm.G, 3) }, { t: 'harmonik', x: 'H = ' + A.gen.length + ' / (' + A.gen.map(function (x) { return '1/' + x; }).join(' + ') + ') = ' + f(mm.H, 3) }, { t: 'kareli (RMS)', x: 'Q = √((' + A.gen.map(function (x) { return x + '²'; }).join(' + ') + ') / ' + A.gen.length + ') = ' + f(mm.Q, 3) }], 'dört ortalama');
    }
    box.innerHTML = html;
    var ain = C.$('[data-ain]', root);
    if (ain) ain.onchange = function () { var v = ain.value.split(/[\s;]+/).map(C.num).filter(function (x) { return isFinite(x) && x > 0; }); if (v.length < 2) { C.toast('en az iki pozitif sayı'); return; } A.gen = v.slice(0, 30); aDraw(); };
  };

  var subDraw = function () {
    C.$$('[data-sub]', root).forEach(function (s) { s.hidden = s.getAttribute('data-sub') !== sub; });
    if (sub === 'olcek') olcekDraw(); else if (sub === 'donusum') { gSeg(); gDraw(true); } else if (sub === 'yaniltici') yDraw(); else aDraw();
    FN.bridgeSend();
  };
  var QS = [
    { q: '“Müşteri memnuniyeti: çok kötü, kötü, orta, iyi, çok iyi” hangi ölçektedir?', o: ['sıralı (ordinal)', 'sınıflayıcı (nominal)', 'aralık (interval)', 'oran (ratio)'], a: 0, n: 'Sıra var ama kategoriler arası uzaklık eşit varsayılamaz.' },
    { q: 'Hangisi oran ölçeğindedir?', o: ['aylık gelir (TL)', 'sıcaklık (°C)', 'il plaka kodu', 'sınav sıralaması'], a: 0, n: 'Gerçek sıfır var: 0 TL gelir yok demektir; 20.000 TL, 10.000’in iki katıdır.' },
    { q: 'TÜİK’ten indirdiğin enflasyon serisi ne tür veridir?', o: ['ikincil veri', 'birincil veri', 'nitel veri', 'deneysel veri'], a: 0, n: 'Başkası tarafından derlenip yayımlanmış veri ikincildir.' },
    { q: 'Sürekli bir değişkenin dağılım şeklini göstermek için en uygun grafik?', o: ['histogram', 'pasta grafiği', 'çizgi grafiği', 'pareto'], a: 0, n: 'Histogramda sınıflar bitişik; şekil, çarpıklık ve tepe görünür.' },
    { q: 'Bir yatırım iki yılda %100 kazandırıp sonra %50 kaybetti. Yıllık ortalama getiri?', o: ['%0', '%25', '%75', '%50'], a: 0, n: 'Geometrik: √(2 × 0,5) − 1 = 0. 100 TL → 200 → 100; hiç kazanmadın. Aritmetik %25 yanıltır.' },
    { q: '120 km’lik yolu 40 km/sa ile gidip 120 km/sa ile döndün. Ortalama hız?', o: ['60 km/sa', '80 km/sa', '70 km/sa', '100 km/sa'], a: 0, n: 'Harmonik: 2 / (1/40 + 1/120) = 60. Kontrol: 240 km / 4 saat.' },
    { q: 'Sütun grafiğinde dikey eksenin 90’dan başlaması neden sorunludur?', o: ['küçük farkları büyük gösterir', 'grafiği okunaksız yapar', 'Excel buna izin vermez', 'sorun yoktur'], a: 0, n: 'Çubuk uzunluğu değerle orantılı algılanır; kesik eksen bu orantıyı bozar.' },
    { q: 'Ogive (birikimli frekans eğrisi) ile en kolay hangisi okunur?', o: ['medyan ve yüzdelikler', 'mod', 'çarpıklık', 'varyans'], a: 0, n: 'Yarı yükseklikten yatay çizgi medyanı, %90 yüksekliği P90’ı verir.' }
  ];
  IS.bank.grafik = QS;

  FN.st.grafik = {
    init: function () {
      root = C.$('#grafik');
      root.innerHTML = IS.head({ key: 'grafik', k: 'istasyon · veri, tablo ve grafik', title: 'Veri ve grafik atölyesi', sub: 'İstatistik veriyle başlar: önce verinin <b>türünü</b> tanı, sonra ona uygun tabloyu ve grafiği seç. Aynı veri bir grafikten ötekine akarak dönüşür; hangisinin doğru olduğunu gözünle gör.' }) +
        '<div class="seg" data-seg style="margin-bottom:14px"></div>' +
        '<div data-sub="olcek"><div class="grid g2"><div class="card box" style="--cc:#FFD86B"><h2>' + IS.en('Ölçek düzeyleri', 'levels of measurement') + '</h2><p class="sub">Bir kart seç, sonra doğru kutuya tıkla. Ölçek, hangi istatistiği hesaplayabileceğini belirler.</p><div class="gf-cards" data-cards></div><div data-ofb aria-live="polite"></div><div class="gf-bins" data-bins></div></div>' +
        '<div class="card box" style="--cc:#FFD86B"><h2>Hangi ölçekte ne hesaplanır?</h2><div class="tbl-w"><table class="t gf-tab"><thead><tr><th>ölçek</th><th>sıra</th><th>fark</th><th>oran</th><th>uygun ölçüler</th></tr></thead><tbody>' +
        '<tr><td>sınıflayıcı <span class="en">nominal</span></td><td>—</td><td>—</td><td>—</td><td>frekans, mod, pasta/sütun</td></tr><tr><td>sıralı <span class="en">ordinal</span></td><td>✓</td><td>—</td><td>—</td><td>+ medyan, yüzdelik</td></tr><tr><td>aralık <span class="en">interval</span></td><td>✓</td><td>✓</td><td>—</td><td>+ ortalama, std. sapma</td></tr><tr><td>oran <span class="en">ratio</span></td><td>✓</td><td>✓</td><td>✓</td><td>+ geometrik ort., değişim katsayısı</td></tr></tbody></table></div>' +
        '<h3 style="margin-top:16px">' + IS.en('Veri kaynağı', 'data source') + '</h3><div data-src></div>' +
        IS.code({ x: [['Veri › Sırala ve Filtre Uygula', 'tablolama'], ['Ekle › PivotTable', 'frekans ve çapraz tablo'], ['=EĞERSAY(A2:A101;"İşletme")', 'bir kategorinin frekansı'], ['=SIKLIK(A2:A31;C2:C7)', 'sınıf frekansları']], r: [['table(x)', 'frekans tablosu'], ['prop.table(table(x))', 'göreli frekans'], ['table(bolum, cinsiyet)', 'çapraz tablo'], ['cut(x, breaks = seq(40, 100, 10))', 'sınıflama']] }) + '</div></div></div>' +
        '<div data-sub="donusum" hidden><div class="grid gside"><div class="card box" style="--cc:#FFD86B"><h2>Veri</h2><div class="seg" data-gd></div><p class="sub" data-gt style="margin-top:8px"></p><p class="lbl" style="margin:10px 0 4px">grafik</p><div class="seg" data-gc></div><p style="margin:12px 0 0" data-gfb></p><div data-gfw></div></div>' +
        '<div class="card box" style="--cc:#FFD86B"><div class="stage"><svg class="gf-svg" data-gf viewBox="0 0 ' + PW + ' ' + PH + '" role="img" aria-label="grafik dönüşümü"></svg></div>' +
        IS.code({ x: [['Ekle › Grafikler › Önerilen Grafikler', ''], ['Ekle › İstatistik Grafiği › Histogram', 'Excel 2016 ve sonrası'], ['Ekle › İstatistik Grafiği › Kutu ve Bıyık', ''], ['Ekle › İstatistik Grafiği › Pareto', '']], r: [['barplot(table(x)); pie(table(x))', 'nitel veri'], ['hist(x, breaks = seq(40, 100, 10))', ''], ['plot(ecdf(x))', 'ogive (birikimli)'], ['boxplot(x, horizontal = TRUE); stem(x)', '']] }) + '</div></div></div>' +
        '<div data-sub="yaniltici" hidden><div class="grid gside"><div class="card box" style="--cc:#FFD86B"><h2>Yanıltıcı grafik avı</h2><p class="sub">Haberlerde ve sunumlarda sık görülen üç hile. Önce grafiğe bak, ne iddia ettiğini düşün, sonra düzelt.</p><div class="seg" data-yk></div><div data-yq style="margin-top:10px"></div><button type="button" class="btn sm pri" data-yfix style="margin-top:8px"></button></div>' +
        '<div class="card box" style="--cc:#FFD86B"><div class="stage" data-yg></div></div></div></div>' +
        '<div data-sub="ortalama" hidden><div class="grid g2"><div class="card box" style="--cc:#FFD86B"><h2>' + IS.en('Dört ortalama', 'four means') + '</h2><div class="seg" data-ak></div><div data-av style="margin-top:10px"></div></div>' +
        '<div class="card box" style="--cc:#FFD86B"><h2>Hesap</h2><div data-ast></div>' + IS.code({ x: [['=ORTALAMA(A2:A6)', 'aritmetik'], ['=GEOORT(B2:B5)', 'geometrik (çarpanlar: 1,5; 0,7; …)'], ['=HARORT(60;90)', 'harmonik'], ['=KAREKÖK(TOPKARE(A2:A6)/SAY(A2:A6))', 'kareli (RMS)']], r: [['mean(x)', ''], ['exp(mean(log(x)))', 'geometrik'], ['1 / mean(1 / x)', 'harmonik'], ['sqrt(mean(x^2))', 'kareli']] }) + '</div></div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      IS.seg(C.$('[data-seg]', root), [['olcek', 'Veri türleri ve ölçekler'], ['donusum', 'Grafik dönüşümü'], ['yaniltici', 'Yanıltıcı grafik avı'], ['ortalama', 'Dört ortalama']], sub, function (k) { sub = k; subDraw(); });
      IS.seg(C.$('[data-gd]', root), [['kat', 'nitel: bölüm tercihi'], ['say', 'nicel: vize notu']], G.d, function (k) { G.d = k; G.c = CH[k][0][0]; G.cur = null; gSeg(); gDraw(true); });
      IS.seg(C.$('[data-yk]', root), Object.keys(YT).map(function (k) { return [k, YT[k].t]; }), Y.k, function (k) { Y.k = k; Y.fix = false; yDraw(); });
      C.$('[data-yfix]', root).onclick = function () { Y.fix = !Y.fix; yDraw(); };
      IS.seg(C.$('[data-ak]', root), [['buyume', 'büyüme oranı'], ['hiz', 'ortalama hız'], ['genel', 'kendi sayıların']], A.k, function (k) { A.k = k; C.$('[data-ast]', root).__stp = 0; aDraw(); });
      subDraw();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Veri ve grafik');
    },
    ctx: function () {
      return IS.ctx('grafik', sub === 'donusum' ? 'grafik: ' + G.c : sub, [['bölüm', sub], ['veri', G.d === 'kat' ? 'nitel' : 'nicel'], ['grafik', G.c]], 'öğrenci veri türleri, ölçek düzeyleri, grafik seçimi ve ortalama türlerini çalışıyor (AYBÜ BUS201 1–6. hafta).', ['Hangi veriye hangi grafik?', 'Geometrik ortalamayı ne zaman kullanırım?', 'Ölçek düzeylerini örnekle anlat']);
    }
  };
})();
