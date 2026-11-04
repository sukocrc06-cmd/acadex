/* ==========================================================================
   ACADEX İSTATİSTİK · ORANLAR VE İNDEKSLER (labs/istatistik/is-indeks.js), 03.11.2026
   AYBÜ BUS201 10. hafta: oran ve yüzde değişim, yüzde puan, basit endeks, baz değiştirme,
   zincirleme endeks, basit ve ağırlıklı bileşik endeks (Laspeyres, Paasche, Fisher),
   fiyat endeksiyle reel değer (enflasyondan arındırma).
     - basit endeks: baz yılını değiştir, sütunlar yeni baza göre akar
     - bileşik endeks: sepetteki fiyat ve miktarları değiştir; adım adım Laspeyres
     - reel değer: nominal maaş yükselirken satın alma gücü ekmek sayısıyla görünür
   Bütün fiyat ve endeks rakamları ders amaçlı kurgusaldır.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, sub = 'basit';
  var YRS = [2020, 2021, 2022, 2023, 2024, 2025];
  var PRICE = [2.5, 3.25, 5.0, 8.0, 12.0, 15.0]; /* simit, TL (kurgusal) */
  var B = { base: 0, pc: { a: 40, b: 45 } };
  var basitDraw = function () {
    var p0 = PRICE[B.base], idx = PRICE.map(function (p) { return p / p0 * 100; }), ch = PRICE.map(function (p, i) { return i ? p / PRICE[i - 1] * 100 : null; });
    var mx = Math.max.apply(null, idx);
    C.$('[data-bar]', root).innerHTML = '<div class="ix-bars">' + YRS.map(function (y, i) {
      return '<button type="button" class="ix-b' + (i === B.base ? ' base' : '') + '" data-by="' + i + '" style="--h:' + (idx[i] / mx * 100).toFixed(1) + '%"><span class="ix-v">' + f(idx[i], 1) + '</span><i></i><span class="ix-y">' + y + '</span><small>' + f(PRICE[i], 2) + ' TL</small></button>';
    }).join('') + '</div><p class="lbl">Bir yıla tıkla: baz yılı o olur, bütün sütunlar yeni baza göre akar (baz yılı hep 100).</p>';
    C.$$('[data-by]', root).forEach(function (b) { b.onclick = function () { B.base = +b.getAttribute('data-by'); basitDraw(); FN.bridgeSend(); }; });
    C.$('[data-btab]', root).innerHTML = '<table class="t"><thead><tr><th>yıl</th><th class="n">fiyat</th><th class="n">basit endeks (baz ' + YRS[B.base] + ')</th><th class="n">zincirleme (önceki yıl = 100)</th><th class="n">yıllık değişim</th></tr></thead><tbody>' +
      YRS.map(function (y, i) { return '<tr><td>' + y + '</td><td class="n">' + f(PRICE[i], 2) + '</td><td class="n"><b>' + f(idx[i], 1) + '</b></td><td class="n">' + (ch[i] ? f(ch[i], 1) : '—') + '</td><td class="n">' + (ch[i] ? '%' + f(ch[i] - 100, 1) : '—') + '</td></tr>'; }).join('') + '</tbody></table>';
    var last = YRS.length - 1;
    IS.steps(C.$('[data-bst]', root), [
      { t: 'basit endeks', x: 'I(' + YRS[last] + ') = p(' + YRS[last] + ') / p(' + YRS[B.base] + ') · 100 = ' + f(PRICE[last], 2) + ' / ' + f(p0, 2) + ' · 100 = ' + f(idx[last], 1) },
      { t: 'zincirleme endeks', x: 'C(' + YRS[last] + ') = ' + f(PRICE[last], 2) + ' / ' + f(PRICE[last - 1], 2) + ' · 100 = ' + f(ch[last], 1) },
      { t: 'zincirlerden basit endekse', x: '(' + ch.slice(1).map(function (c) { return f(c / 100, 3); }).join(' × ') + ') · 100 = ' + f(PRICE[last] / PRICE[0] * 100, 1) + '  (baz ' + YRS[0] + ')' },
      { t: 'yorum', x: YRS[0] + '’ten ' + YRS[last] + '’e fiyat ' + f(PRICE[last] / PRICE[0], 1) + ' katına, yani %' + f((PRICE[last] / PRICE[0] - 1) * 100, 0) + ' arttı.' }
    ], 'endeks, adım adım');
    var a = B.pc.a, b = B.pc.b;
    C.$('[data-pcr]', root).innerHTML = '<div class="kpis"><div class="kpi"><small>yüzde puan farkı <span class="en">percentage points</span></small><b>' + f(b - a, 1) + ' puan</b></div><div class="kpi hl"><small>yüzde değişim <span class="en">percentage change</span></small><b>%' + f((b - a) / a * 100, 1) + '</b></div></div>' +
      IS.tip('Faiz %' + f(a, 1) + '’ten %' + f(b, 1) + '’e çıktı: haber “' + f(b - a, 1) + ' puan arttı” demeli. “%' + f(b - a, 1) + ' arttı” demek yanlıştır; göreli artış %' + f((b - a) / a * 100, 1) + '.', 'puan ≠ %');
  };
  /* ---------- bileşik ---------- */
  var BK = [{ n: 'simit (adet)', p0: 2.5, q0: 60, p1: 15, q1: 40 }, { n: 'çay (bardak)', p0: 2, q0: 90, p1: 10, q1: 80 }, { n: 'yurt (ay)', p0: 900, q0: 1, p1: 5500, q1: 1 }, { n: 'otobüs (biniş)', p0: 3, q0: 50, p1: 17, q1: 44 }];
  var bkCalc = function () {
    var S = function (p, q) { return BK.reduce(function (a, x) { return a + x[p] * x[q]; }, 0); }, sp = function (p) { return BK.reduce(function (a, x) { return a + x[p]; }, 0); };
    var L = S('p1', 'q0') / S('p0', 'q0') * 100, P = S('p1', 'q1') / S('p0', 'q1') * 100;
    return { U: sp('p1') / sp('p0') * 100, L: L, P: P, F: Math.sqrt(L * P), a: S('p1', 'q0'), b: S('p0', 'q0') };
  };
  var bileskDraw = function () {
    var r = bkCalc();
    C.$('[data-kt]', root).innerHTML = '<table class="t"><thead><tr><th>mal</th><th class="n">p₀</th><th class="n">q₀</th><th class="n">p₁</th><th class="n">q₁</th><th class="n">basit endeks</th></tr></thead><tbody>' + BK.map(function (b, i) {
      return '<tr><td>' + X(b.n) + '</td><td class="n">' + f(b.p0, 2) + '</td><td class="n">' + b.q0 + '</td><td class="n"><input type="number" min="0" step="0.5" value="' + b.p1 + '" data-kp="' + i + '" aria-label="' + X(b.n) + ' yeni fiyat"></td><td class="n"><input type="number" min="0" value="' + b.q1 + '" data-kq="' + i + '" aria-label="' + X(b.n) + ' yeni miktar"></td><td class="n">' + f(b.p1 / b.p0 * 100, 0) + '</td></tr>';
    }).join('') + '</tbody></table>';
    var mx = Math.max(r.U, r.L, r.P, r.F);
    C.$('[data-kr]', root).innerHTML = '<div class="ix-cmp">' + [['basit bileşik', 'unweighted aggregate', r.U, '#9AA6B8'], ['Laspeyres', 'base-weighted', r.L, '#2F6FB0'], ['Paasche', 'current-weighted', r.P, '#C8553D'], ['Fisher', 'ideal', r.F, '#3E8E5B']].map(function (q) {
      return '<div><span class="lbl">' + q[0] + ' <span class="en">' + q[1] + '</span></span><i style="--w:' + (q[2] / mx * 100).toFixed(1) + '%;background:' + q[3] + '"></i><b style="color:' + q[3] + '">' + f(q[2], 1) + '</b></div>';
    }).join('') + '</div>' + IS.tip('Basit bileşik endeks yurdun pahalı fiyatına boğulur, simidi hiç görmez. Ağırlıklı endeksler sepetteki miktarı hesaba katar. Laspeyres eski sepeti tutar; fiyatı artan maldan kaçışı görmediği için genelde Paasche’dan yüksek çıkar.', 'Σpq');
    IS.steps(C.$('[data-kst]', root), [
      { t: 'eski sepet, yeni fiyatlar', x: 'Σp₁q₀ = ' + BK.map(function (b) { return f(b.p1, 1) + '·' + b.q0; }).join(' + ') + ' = ' + f(r.a, 1) },
      { t: 'eski sepet, eski fiyatlar', x: 'Σp₀q₀ = ' + BK.map(function (b) { return f(b.p0, 1) + '·' + b.q0; }).join(' + ') + ' = ' + f(r.b, 1) },
      { t: 'Laspeyres', x: 'L = ' + f(r.a, 1) + ' / ' + f(r.b, 1) + ' · 100 = ' + f(r.L, 1) },
      { t: 'Fisher', x: 'F = √(L · P) = √(' + f(r.L, 1) + ' · ' + f(r.P, 1) + ') = ' + f(r.F, 1) }
    ], 'Laspeyres, adım adım');
    C.$$('[data-kp],[data-kq]', root).forEach(function (el) { el.onchange = function () { var i = +(el.getAttribute('data-kp') || el.getAttribute('data-kq')), v = Math.max(0, C.num(el.value) || 0); if (el.hasAttribute('data-kp')) BK[i].p1 = v; else BK[i].q1 = v; bileskDraw(); FN.bridgeSend(); }; });
  };
  /* ---------- reel değer ---------- */
  var NOM = [17000, 21000, 32000, 45000, 58000, 70000]; /* aylık net maaş, TL (kurgusal) */
  var CPI = [100, 136, 222, 365, 530, 690]; /* fiyat endeksi, 2020 = 100 (kurgusal) */
  var R = { y: 5 };
  var reelDraw = function () {
    var real = NOM.map(function (n, i) { return n / CPI[i] * 100; }), loaves = NOM.map(function (n, i) { return n / PRICE[i]; });
    C.$('[data-rch]', root).innerHTML = C.chart({ w: 620, h: 250, x: [2020, 2025], xticks: YRS, xf: function (v) { return String(v); }, al: 'nominal ve reel maaş', yl: 'TL', yf: function (v) { return C.nf(v / 1000) + ' bin'; }, y0: true,
      s: [{ p: YRS.map(function (y, i) { return [y, NOM[i]]; }), c: '#C8553D', w: 3, lab: 'nominal' }, { p: YRS.map(function (y, i) { return [y, real[i]]; }), c: '#1E8A55', w: 3, lab: '2020 fiyatlarıyla reel' }], vl: [{ x: YRS[R.y], c: '#0D1838', lab: String(YRS[R.y]) }] });
    var n = Math.round(loaves[R.y] / 200);
    C.$('[data-rl]', root).innerHTML = '<p class="lbl">' + YRS[R.y] + ' maaşıyla alınabilecek simit (her ikon 200 simit): <b>' + C.nf(loaves[R.y]) + '</b></p><div class="ix-loaf">' + Array.apply(null, { length: n }).map(function (_, i) { return '<i style="--d:' + (i * 0.02).toFixed(2) + 's"></i>'; }).join('') + '</div>';
    IS.steps(C.$('[data-rst]', root), [
      { t: 'endeksi orana çevir', x: CPI[R.y] + ' / 100 = ' + f(CPI[R.y] / 100, 2) + ' (fiyatlar 2020’ye göre bu kadar kat)' },
      { t: 'nominali böl', x: 'reel = ' + C.nf(NOM[R.y]) + ' / ' + f(CPI[R.y] / 100, 2) + ' = ' + C.nf(Math.round(real[R.y])) + ' TL (2020 fiyatlarıyla)' },
      { t: 'karşılaştır', x: 'nominal artış %' + f((NOM[R.y] / NOM[0] - 1) * 100, 0) + ' · reel değişim %' + f((real[R.y] / real[0] - 1) * 100, 1) }
    ], 'reel değer, adım adım');
  };

  var subDraw = function () { C.$$('[data-sub]', root).forEach(function (s) { s.hidden = s.getAttribute('data-sub') !== sub; }); if (sub === 'basit') basitDraw(); else if (sub === 'bilesik') bileskDraw(); else reelDraw(); FN.bridgeSend(); };
  var QS = [
    { q: 'Fiyat 2020’de 20 TL, 2025’te 50 TL. 2020 = 100 iken 2025 basit endeksi?', o: ['250', '150', '40', '30'], a: 0, n: '50 / 20 · 100 = 250: fiyat %150 arttı.' },
    { q: 'İşsizlik %8’den %10’a çıktı. Doğru ifade?', o: ['2 puan arttı (%25 artış)', '%2 arttı', '%20 arttı', '10 puan arttı'], a: 0, n: 'Yüzde puan farkı 2; göreli artış 2/8 = %25.' },
    { q: 'Laspeyres endeksi hangi miktarlarla ağırlıklandırır?', o: ['baz dönem miktarları (q₀)', 'cari dönem miktarları (q₁)', 'ağırlık kullanmaz', 'fiyatların ortalamasıyla'], a: 0, n: 'L = Σp₁q₀ / Σp₀q₀ · 100. TÜFE bu mantıkla hesaplanır.' },
    { q: 'Maaş 30.000 TL, fiyat endeksi 250 (baz = 100). Baz yılı fiyatlarıyla reel maaş?', o: ['12.000 TL', '75.000 TL', '30.250 TL', '7.500 TL'], a: 0, n: '30.000 / 2,5 = 12.000.' },
    { q: 'Zincirleme endeksler 110, 120 ve 105. Başlangıca göre toplam endeks?', o: ['138,6', '335', '111,7', '135'], a: 0, n: '1,10 × 1,20 × 1,05 = 1,386 → 138,6. Zincirler toplanmaz, çarpılır.' },
    { q: 'Basit bileşik endeksin (Σp₁/Σp₀) en büyük kusuru?', o: ['pahalı mallar sonucu belirler, tüketim miktarı yok sayılır', 'hesaplaması zordur', 'baz yılı gerektirmez', 'her zaman 100 çıkar'], a: 0, n: 'Ev kirası ile simidi eşit önemde sayamazsın; miktarla ağırlıklandırmak gerekir.' }
  ];
  IS.bank.indeks = QS;

  FN.st.indeks = {
    init: function () {
      root = C.$('#indeks');
      root.innerHTML = IS.head({ key: 'indeks', k: 'istasyon · oranlar ve endeksler', title: 'Oranlar ve indeksler', sub: 'Fiyatlar artınca “ne kadar arttı” sorusunun cevabı endekstir. Baz yılını değiştir, sepeti oynat, maaşı enflasyondan arındır. <span class="en">Bütün rakamlar kurgusaldır.</span>' }) +
        '<div class="seg" data-seg style="margin-bottom:14px"></div>' +
        '<div data-sub="basit"><div class="grid g2"><div class="card box" style="--cc:#FFB36B"><h2>' + IS.en('Simit fiyatı endeksi', 'simple price index') + '</h2><div data-bar></div><div class="tbl-w" data-btab></div></div>' +
        '<div class="card box" style="--cc:#FFB36B"><div data-bst></div><h3 style="margin-top:16px">Yüzde mi, puan mı?</h3><label class="sl"><span>eski oran %</span><input type="range" min="1" max="60" step="0.5" value="40" data-pa><output data-pao>40,0</output></label><label class="sl"><span>yeni oran %</span><input type="range" min="1" max="60" step="0.5" value="45" data-pb><output data-pbo>45,0</output></label><div data-pcr></div>' +
        IS.code({ x: [['=B3/$B$2*100', 'basit endeks (baz B2, aşağı sürükle)'], ['=B3/B2*100', 'zincirleme endeks'], ['=(B3-B2)/B2', 'yüzde değişim (% biçimle)']], r: [['p / p[1] * 100', 'basit endeks'], ['c(NA, p[-1] / p[-length(p)] * 100)', 'zincirleme'], ['cumprod(c(1, zincir / 100)) * 100', 'zincirden basit endekse']] }) + '</div></div></div>' +
        '<div data-sub="bilesik" hidden><div class="grid g2"><div class="card box" style="--cc:#FFB36B"><h2>' + IS.en('Öğrenci sepeti', 'aggregate price index') + '</h2><p class="sub">Yeni fiyat (p₁) ve miktarları (q₁) değiştir.</p><div class="tbl-w ix-tab" data-kt></div><div data-kr></div></div>' +
        '<div class="card box" style="--cc:#FFB36B"><div data-kst></div>' + IS.code({ x: [['=TOPLA.ÇARPIM(D2:D5;C2:C5)/TOPLA.ÇARPIM(B2:B5;C2:C5)*100', 'Laspeyres'], ['=TOPLA.ÇARPIM(D2:D5;E2:E5)/TOPLA.ÇARPIM(B2:B5;E2:E5)*100', 'Paasche'], ['=KAREKÖK(F7*F8)', 'Fisher']], r: [['L <- sum(p1*q0) / sum(p0*q0) * 100', ''], ['P <- sum(p1*q1) / sum(p0*q1) * 100', ''], ['sqrt(L * P)', 'Fisher']] }) + '</div></div></div>' +
        '<div data-sub="reel" hidden><div class="grid g2"><div class="card box" style="--cc:#FFB36B"><h2>' + IS.en('Nominal ve reel maaş', 'nominal vs real wage') + '</h2><div data-rch></div><label class="sl"><span>yıl</span><input type="range" min="0" max="5" step="1" value="5" data-ry><output data-ryo>2025</output></label></div>' +
        '<div class="card box" style="--cc:#FFB36B"><div data-rl></div><div data-rst></div>' + IS.code({ x: [['=B2/C2*100', 'reel değer = nominal / endeks · 100']], r: [['reel <- nominal / tufe * 100', '']] }) + '</div></div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      IS.seg(C.$('[data-seg]', root), [['basit', 'Basit ve zincirleme endeks'], ['bilesik', 'Bileşik endeks'], ['reel', 'Reel değer']], sub, function (k) { sub = k; subDraw(); });
      C.$('[data-pa]', root).oninput = function (e) { B.pc.a = +e.target.value; C.$('[data-pao]', root).textContent = f(B.pc.a, 1); basitDraw(); };
      C.$('[data-pb]', root).oninput = function (e) { B.pc.b = +e.target.value; C.$('[data-pbo]', root).textContent = f(B.pc.b, 1); basitDraw(); };
      C.$('[data-ry]', root).oninput = function (e) { R.y = +e.target.value; C.$('[data-ryo]', root).textContent = YRS[R.y]; reelDraw(); };
      subDraw();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Oranlar ve indeksler');
    },
    ctx: function () {
      var r = bkCalc();
      return IS.ctx('indeks', sub, [['baz yılı', YRS[B.base]], ['Laspeyres', f(r.L, 1)], ['Paasche', f(r.P, 1)]], 'öğrenci oranlar ve fiyat endekslerini çalışıyor (AYBÜ BUS201 10. hafta). Rakamlar kurgusal.', ['Laspeyres ile Paasche farkı', 'Reel değer nasıl hesaplanır?', 'Yüzde puan ile yüzde farkı']);
    }
  };
})();
