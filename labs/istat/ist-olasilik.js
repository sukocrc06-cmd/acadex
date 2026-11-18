/* ==========================================================================
   ACADEX İSTATİSTİK · olasılık ve binom eki (labs/istat/ist-olasilik.js), 18.11.2026
   7. hafta (Olasılık) ve 11. hafta (Binom ve Poisson) için:
     - yeni anlatım sahneleri: Bayes’i 1000 kişiyle düşün (doğal frekans), aynı bilgi üç biçimde
       (tablo · Venn · ağaç), bağımsız mı ayrık mı; 5 atıştan 3’ünü kaçırmanın 10 yolu, tam / en az / en fazla
     - görsel atölyeye yeni sekmeler: Bayes filmi (adım adım, nokta ve kare alan görünümü, “ikinci test”),
       Tablo ↔ Venn ↔ Ağaç çevirici, Basketçi (atış animasyonu, yollar, 1000 maç simülasyonu)
     - yeni nesil soru şablonları (her sette 5 soru, eski + yeni havuzdan karışık) ve yanılgı yakalayıcı
       açıklamalar: P(A|B) ile P(B|A), bağımsız ile ayrık, “en az” ile “tam”, tek sıralama ile C(n, k)
     - rehberli seri (azalan yardım): 1) çözülmüş örnek 2) son adım sende 3) son iki adım 4) hepsi sende
   ist-tahmin.js’ten SONRA yüklenir (tahmin kartları sahne sırasıyla eşleşir).
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST; if (!IST || !IST.by) return;
  var V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;
  var D = window.document;
  var SAKIN = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var r4 = function (v) { return nf(v, 4); };
  var yuzde = function (v, k) { return '%' + nf(v * 100, k == null ? 1 : k); };

  /* =====================================================================
     ORTAK ÇİZİMLER
     ===================================================================== */
  /* doğal frekans ağacı: 1000 kişi → hasta / sağlam → test + / − ; k adımı vurgular */
  var dogalAgac = function (N, h, tp, fp, k, o) {
    o = o || {};
    var s = h - tp, sg = N - h, tn = sg - fp, on = function (n) { return k >= n ? 1 : 0.25; };
    var kutu = function (x, y, w, t, alt, renk, op) { return '<g opacity="' + op + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="44" rx="9" fill="' + renk + '" stroke="#0D1838" stroke-width="1.5"/><text x="' + (x + w / 2) + '" y="' + (y + 19) + '" text-anchor="middle" font-weight="800" font-size="15">' + t + '</text><text x="' + (x + w / 2) + '" y="' + (y + 35) + '" text-anchor="middle" class="lbm">' + alt + '</text></g>'; };
    var ok = function (x1, y1, x2, y2, op) { return '<path d="M' + x1 + ' ' + y1 + 'C' + x1 + ' ' + (y1 + 24) + ' ' + x2 + ' ' + (y2 - 24) + ' ' + x2 + ' ' + y2 + '" fill="none" stroke="#0D1838" stroke-width="1.6" opacity="' + op + '"/>'; };
    var g = kutu(220, 6, 120, N + ' kişi', o.kim || 'herkes', '#fff', 1);
    g += ok(280, 50, 140, 84, on(1)) + ok(280, 50, 420, 84, on(1));
    g += kutu(80, 84, 120, String(h), o.a || 'hasta', '#F6D4CB', on(1)) + kutu(360, 84, 120, String(sg), o.b || 'sağlam', '#DCE4F0', on(1));
    g += ok(140, 128, 70, 164, on(2)) + ok(140, 128, 210, 164, on(2)) + ok(420, 128, 350, 164, on(2)) + ok(420, 128, 490, 164, on(2));
    g += kutu(20, 164, 100, String(tp), 'test +', '#C8553D', on(2)) + kutu(160, 164, 100, String(s), 'test −', '#F2E3DE', on(2));
    g += kutu(300, 164, 100, String(fp), 'test +', '#E0A526', on(2)) + kutu(440, 164, 100, String(tn), 'test −', '#EEF1F6', on(2));
    if (k >= 3) g += '<path d="M24 218H396" stroke="#0D1838" stroke-width="2.5" stroke-dasharray="6 5"/><text class="lbb" x="24" y="240">pozitifler: ' + tp + ' + ' + fp + ' = ' + (tp + fp) + '</text>';
    if (k >= 4) g += '<text class="lbb" x="24" y="262" style="fill:#C8553D">' + (o.son || ('P(hasta | +) = ' + tp + ' / ' + (tp + fp) + ' = ' + r4(tp / Math.max(1, tp + fp)))) + '</text>';
    return V.svg(560, k >= 3 ? 272 : 216, g, 'doğal frekans ağacı');
  };
  /* iki çember (Venn): a, b, ab sayıları; vurgu: { pay: [bölgeler], payda: [bölgeler] } bölgeler: ab, aB, Ab, AB (büyük harf = değil) */
  var vennSvg = function (n, sec, o) {
    o = o || {};
    var id = 'v' + Math.floor(Math.random() * 1e9), pay = (sec && sec.pay) || [], payda = (sec && sec.payda) || [];
    var renk = function (k) { return pay.indexOf(k) > -1 ? '#C8553D' : payda.indexOf(k) > -1 ? '#F6D4CB' : '#fff'; };
    var cA = '<circle cx="190" cy="120" r="88"/>', cB = '<circle cx="300" cy="120" r="88"/>';
    var g = '<defs><clipPath id="' + id + 'a">' + cA + '</clipPath><clipPath id="' + id + 'b">' + cB + '</clipPath>' +
      '<mask id="' + id + 'na"><rect width="490" height="240" fill="#fff"/><circle cx="190" cy="120" r="88" fill="#000"/></mask><mask id="' + id + 'nb"><rect width="490" height="240" fill="#fff"/><circle cx="300" cy="120" r="88" fill="#000"/></mask></defs>';
    g += '<rect x="4" y="4" width="482" height="232" rx="12" fill="' + renk('AB') + '" stroke="#0D1838" stroke-width="1.5" data-bolge="AB" class="vb' + (payda.indexOf('AB') > -1 && pay.indexOf('AB') < 0 ? ' pd' : '') + '"/>';
    g += '<g mask="url(#' + id + 'nb)"><circle cx="190" cy="120" r="88" fill="' + renk('aB') + '" data-bolge="aB" class="vb"/></g>';
    g += '<g mask="url(#' + id + 'na)"><circle cx="300" cy="120" r="88" fill="' + renk('Ab') + '" data-bolge="Ab" class="vb"/></g>';
    g += '<g clip-path="url(#' + id + 'a)"><circle cx="300" cy="120" r="88" fill="' + renk('ab') + '" data-bolge="ab" class="vb"/></g>';
    g += '<circle cx="190" cy="120" r="88" fill="none" stroke="#0D1838" stroke-width="2"/><circle cx="300" cy="120" r="88" fill="none" stroke="#0D1838" stroke-width="2"/>';
    payda.forEach(function (k) { if (pay.indexOf(k) < 0) g += ''; });
    var t = function (x, y, v, k) { return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-weight="800" font-size="17" fill="' + (pay.indexOf(k) > -1 ? '#fff' : '#0D1838') + '" pointer-events="none">' + v + '</text>'; };
    g += t(150, 126, n.aB, 'aB') + t(245, 126, n.ab, 'ab') + t(340, 126, n.Ab, 'Ab') + t(440, 222, n.AB, 'AB');
    g += '<text class="lbb" x="140" y="26" pointer-events="none">' + X(o.a || 'A') + '</text><text class="lbb" x="350" y="26" text-anchor="end" pointer-events="none">' + X(o.b || 'B') + '</text>';
    return V.svg(490, 240, g, 'Venn şeması');
  };
  /* olasılık ağacı (önce A sonra B): sayılar n; vurgu yaprakları pay / payda */
  var agacSvg = function (n, sec, o) {
    o = o || {};
    var pay = (sec && sec.pay) || [], payda = (sec && sec.payda) || [], nA = n.ab + n.aB, nN = n.Ab + n.AB, N = nA + nN;
    var q = function (a, b) { return b ? nf(a / b, 3) : '0'; };
    var dal = function (x1, y1, x2, y2, lab, on) { return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="#0D1838" stroke-width="' + (on ? 3.2 : 1.6) + '"/><text class="lbm" x="' + ((x1 + x2) / 2) + '" y="' + ((y1 + y2) / 2 - 6) + '" text-anchor="middle">' + lab + '</text>'; };
    var yap = [['ab', 40], ['aB', 100], ['Ab', 160], ['AB', 220]], s = '<circle cx="20" cy="130" r="7" fill="#0D1838"/>';
    var aKol = pay.concat(payda).some(function (k) { return k[0] === 'a'; }), nKol = pay.concat(payda).some(function (k) { return k[0] === 'A'; });
    s += dal(20, 130, 160, 70, X(o.a || 'A') + ': ' + q(nA, N), aKol) + dal(20, 130, 160, 190, 'değil: ' + q(nN, N), nKol);
    s += '<circle cx="168" cy="70" r="10" fill="' + PAL[1] + '" stroke="#0D1838"/><circle cx="168" cy="190" r="10" fill="#DCE4F0" stroke="#0D1838"/>';
    var ad = { ab: [X(o.a || 'A') + ' ve ' + X(o.b || 'B'), n.ab], aB: [X(o.a || 'A') + ', ' + X(o.b || 'B') + ' değil', n.aB], Ab: [X(o.a || 'A') + ' değil, ' + X(o.b || 'B'), n.Ab], AB: ['ikisi de değil', n.AB] };
    s += dal(178, 70, 300, 40, q(n.ab, nA), pay.indexOf('ab') > -1 || payda.indexOf('ab') > -1) + dal(178, 70, 300, 100, q(n.aB, nA), pay.indexOf('aB') > -1 || payda.indexOf('aB') > -1);
    s += dal(178, 190, 300, 160, q(n.Ab, nN), pay.indexOf('Ab') > -1 || payda.indexOf('Ab') > -1) + dal(178, 190, 300, 220, q(n.AB, nN), pay.indexOf('AB') > -1 || payda.indexOf('AB') > -1);
    yap.forEach(function (y) {
      var k = y[0], p = pay.indexOf(k) > -1, pd = payda.indexOf(k) > -1;
      s += '<g data-bolge="' + k + '" class="vb"><rect x="304" y="' + (y[1] - 16) + '" width="200" height="32" rx="8" fill="' + (p ? '#C8553D' : pd ? '#F6D4CB' : '#fff') + '" stroke="#0D1838" stroke-width="' + (pd || p ? 2 : 1.2) + '"' + (pd && !p ? ' stroke-dasharray="5 3"' : '') + '/>' +
        '<text x="314" y="' + (y[1] + 5) + '" font-size="12.5" font-weight="700" fill="' + (p ? '#fff' : '#0D1838') + '" pointer-events="none">' + ad[k][0] + ' · ' + ad[k][1] + '</text></g>';
    });
    return V.svg(510, 250, s, 'olasılık ağacı');
  };

  /* =====================================================================
     7. HAFTA: SAHNELER
     ===================================================================== */
  var g7 = IST.by.g7, g11 = IST.by.g11;
  var KARGO = { a: 'gecikti', b: 'şehir dışı', ab: 36, aB: 24, Ab: 54, AB: 186 };
  if (g7) {
    g7.sahneler.push({
      b: 'Bayes’i 1000 kişiyle düşün', terim: [['doğal frekans', 'natural frequency'], ['taban oranı', 'base rate'], ['yanlış pozitif', 'false positive']],
      t: '<p>Yüzdelerle Bayes zor gelir; aynı soruyu <b>kişi sayısıyla</b> düşünmek kolaylaştırır. Bir hastalık 1000 kişiden <b>10</b>’unda var. Test hastaların %90’ını yakalıyor (9 kişi), ama 990 sağlamın %9’una da yanlışlıkla “pozitif” diyor (89 kişi).</p><p>Testi pozitif çıkan <b>98</b> kişiden yalnızca <b>9</b>’u gerçekten hasta: <b>9 / 98 ≈ %9</b>. Pozitif sonuç “kesin hastasın” demek değildir; hastalık nadirse yanlış alarmlar çoğunluktadır.</p>',
      v: function () { return dogalAgac(1000, 10, 9, 89, 4, { son: 'P(hasta | +) = 9 / 98 ≈ 0,0918' }); }
    }, {
      b: 'Aynı bilgi üç biçimde: tablo, Venn, ağaç', terim: [['çapraz tablo', 'contingency table'], ['birleşik olasılık', 'joint probability'], ['marjinal olasılık', 'marginal probability']],
      t: '<p>Bir kargo şubesinde 300 gönderi: <b>60</b>’ı şehir dışı, şehir dışındakilerin <b>36</b>’sı gecikti. Aynı sayılar tabloda hücre, Venn’de bölge, ağaçta yapraktır.</p><p>“Şehir dışıysa gecikme olasılığı” sorusunda payda yalnız <b>şehir dışı</b> gönderilerdir: <b>36 / 60 = 0,60</b>. Genel toplama bölersen (36 / 300) birleşik olasılığı bulursun; o başka bir sorudur.</p>',
      v: function () {
        var n = { ab: 36, aB: 54, Ab: 24, AB: 186 };
        return V.yy(V.tablo(['', 'Şehir dışı', 'Şehir içi', 'Toplam'], [['Gecikti', '36', '54', '90'], ['Zamanında', '24', '186', '210'], ['<b>Toplam</b>', '60', '240', '300']], { n: [1, 2, 3], hi: { '0,1': 'cz-on', '2,1': 'cz-on' } }),
          vennSvg(n, { pay: ['ab'], payda: ['ab', 'Ab'] }, { a: 'gecikti', b: 'şehir dışı' }));
      }
    }, {
      b: 'Bağımsız mı, ayrık mı?', terim: [['ayrık olaylar', 'mutually exclusive events'], ['bağımsız olaylar', 'independent events']],
      t: '<p><b>Ayrık</b>: iki olay birlikte olamaz, P(A∩B) = 0. Bir zar atışında “1 gelmesi” ile “6 gelmesi”.</p><p><b>Bağımsız</b>: birinin olması ötekinin olasılığını değiştirmez, P(A∩B) = P(A)·P(B). İki ayrı zarda “ilki 1” ile “ikincisi 6”.</p><p>Sık yapılan hata: ayrık olayları bağımsız sanmak. Biri olunca öteki <b>kesin olmaz</b>; bu, en güçlü bağımlılıktır.</p>',
      v: function () {
        var a = '<circle cx="90" cy="90" r="60" fill="#F6D4CB" stroke="#0D1838" stroke-width="2"/><circle cx="230" cy="90" r="60" fill="#DCE4F0" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="160" y="176" text-anchor="middle">ayrık: kesişim yok</text>';
        var b = '<circle cx="120" cy="90" r="64" fill="#F6D4CB" fill-opacity=".85" stroke="#0D1838" stroke-width="2"/><circle cx="200" cy="90" r="64" fill="#DCE4F0" fill-opacity=".85" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="160" y="176" text-anchor="middle">bağımsız: kesişim = çarpım</text>';
        return V.ust(V.yy(V.svg(320, 186, a, 'ayrık olaylar'), V.svg(320, 186, b, 'bağımsız olaylar')),
          V.fx([{ s: 'ayrık', h: 'P(A∩B) = 0 → P(A|B) = 0 ≠ P(A)' }, { s: 'bağımsız', h: 'P(A∩B) = P(A)·P(B) → P(A|B) = P(A)', son: true }]));
      }
    });
    if (IST.TAHMIN && IST.TAHMIN.g7) IST.TAHMIN.g7.push(
      ['1000 kişide 10 hasta var; test hastaların %90’ını yakalıyor, sağlamların %9’una yanlış alarm veriyor. Pozitif çıkan biri gerçekten hasta mı?', ['Yaklaşık %90 hasta', 'Yaklaşık %50 hasta', 'Yaklaşık %9 hasta'], 2, 'Pozitiflerin 9’u hasta, 89’u yanlış alarm: 9 / 98 ≈ %9.'],
      ['Şehir dışı 60 gönderinin 36’sı gecikti; toplam 300 gönderi var. “Şehir dışıysa gecikme” olasılığının paydası hangisi?', ['300', '60', '90'], 1, 'Koşul şehir dışı: yeni evren 60 gönderi.'],
      ['Ayrık iki olay (birlikte olamayan) bağımsız mıdır?', ['Evet, hep bağımsızdır', 'Hayır, bağımlıdır', 'Duruma göre'], 1, 'Biri olunca öteki kesin olmaz; P(A|B) = 0 ≠ P(A).']
    );
  }

  /* =====================================================================
     11. HAFTA: SAHNELER
     ===================================================================== */
  var yollar = function (n, k) { var out = []; var rec = function (s, i, kalan) { if (i === n) { if (!kalan) out.push(s); return; } if (kalan) rec(s + '0', i + 1, kalan - 1); if (n - i > kalan) rec(s + '1', i + 1, kalan); }; rec('', 0, k); return out; };
  if (g11) {
    g11.sahneler.push({
      b: '5 atıştan 3’ünü kaçırmak: 10 farklı yol', terim: [['kombinasyon', 'combination C(n, k)'], ['dizilim', 'sequence / arrangement']],
      t: '<p>Basketbolcu serbest atışların %60’ını sokuyor (p = 0,6), %40’ını kaçırıyor (q = 0,4). 5 atışta <b>tam 3 kaçırma</b> olasılığı nedir?</p><p>Tek bir dizilim, örneğin ✗✗✗✓✓: 0,4³·0,6² = 0,02304. Ama kaçırılan 3 atış 5 atıştan herhangi üçü olabilir: <b>C(5, 3) = 10</b> farklı dizilim. Hepsinin olasılığı aynı, o yüzden çarparız: <b>10 · 0,02304 = 0,2304</b>.</p>',
      v: function () {
        var L = yollar(5, 3), s = '';
        L.forEach(function (y, i) {
          var row = i % 5, col = Math.floor(i / 5), x0 = 10 + col * 270, y0 = 12 + row * 34;
          s += '<g class="pop" ' + d(0.1 + i * 0.12) + '>';
          for (var j = 0; j < 5; j++) { var kac = y[j] === '0'; s += '<circle cx="' + (x0 + 14 + j * 30) + '" cy="' + (y0 + 12) + '" r="12" fill="' + (kac ? '#C8553D' : '#3E8E5B') + '" stroke="#0D1838"/><text x="' + (x0 + 14 + j * 30) + '" y="' + (y0 + 17) + '" text-anchor="middle" fill="#fff" font-weight="800" font-size="13">' + (kac ? '✗' : '✓') + '</text>'; }
          s += '<text class="lbm" x="' + (x0 + 168) + '" y="' + (y0 + 16) + '">0,02304</text></g>';
        });
        s += '<text class="lbb fd" ' + d(1.5) + ' x="10" y="196">10 dizilim × 0,4³ · 0,6² = 0,2304</text>';
        return V.svg(560, 206, s, 'beş atışta üç kaçırmanın dizilimleri');
      }
    }, {
      b: 'Tam, en az, en fazla: hangisi?', terim: [['en az', 'at least P(X ≥ k)'], ['en fazla', 'at most P(X ≤ k)'], ['tümleyen', 'complement']],
      t: '<p>X = kaçırılan atış sayısı, X ~ B(5; 0,4).</p><p><b>Tam 2</b>: yalnız P(X = 2). <b>En az 2</b>: 2, 3, 4 ya da 5 → P(X ≥ 2) = 1 − P(X = 0) − P(X = 1). <b>En fazla 2</b>: 0, 1 ya da 2 → P(X ≤ 2).</p><p>“En az bir” sorularında kısa yol hep tümleyendir: <b>1 − P(X = 0)</b>.</p>',
      v: function () {
        var xs = [0, 1, 2, 3, 4, 5], ps = xs.map(function (x) { return M.binom(x, 5, 0.4); });
        return V.ust(IST.S.sutun(xs, ps, [2, 3, 4, 5], { xlab: 'kaçırılan atış (en az 2 boyalı)', h: 190 }),
          V.fx([{ s: 'tam 2', h: 'P(X = 2) = ' + r4(ps[2]) }, { s: 'en az 2', h: '1 − ' + r4(ps[0]) + ' − ' + r4(ps[1]) + ' = ' + r4(1 - ps[0] - ps[1]) }, { s: 'en fazla 2', h: r4(ps[0]) + ' + ' + r4(ps[1]) + ' + ' + r4(ps[2]) + ' = ' + r4(ps[0] + ps[1] + ps[2]), son: true }]));
      }
    });
    if (IST.TAHMIN && IST.TAHMIN.g11) IST.TAHMIN.g11.push(
      ['5 atıştan tam 3’ünü kaçırmanın kaç farklı dizilimi var?', ['3', '10', '60'], 1, 'C(5, 3) = 10: kaçırılan üç atışın hangileri olduğu seçilir.'],
      ['“En az 2 kaçırma” olasılığını en kısa nasıl bulursun?', ['P(X = 2)', '1 − P(X = 0) − P(X = 1)', 'P(X ≤ 2)'], 1, 'En az 2’nin tümleyeni 0 ya da 1 kaçırmadır.']
    );
  }

  /* =====================================================================
     GÖRSEL ATÖLYE: BAYES FİLMİ
     ===================================================================== */
  var bayesFilm = function (el) {
    var S = { prev: 2, sens: 95, spec: 90, k: 0, gor: 'nokta', ikinci: 0, oyn: 0 };
    el.innerHTML = '<div class="at-g"><div class="at-k">' +
      '<label><span>yaygınlık P(H) <output data-o="prev"></output></span><input type="range" min="0.5" max="30" step="0.5" value="2" data-s="prev"></label>' +
      '<label><span>duyarlılık P(+|H) <output data-o="sens"></output></span><input type="range" min="50" max="99.5" step="0.5" value="95" data-s="sens"></label>' +
      '<label><span>özgüllük P(−|S) <output data-o="spec"></output></span><input type="range" min="50" max="99.5" step="0.5" value="90" data-s="spec"></label>' +
      '<div class="seg" data-gor><button type="button" data-k="nokta" aria-pressed="true">1000 kişi</button><button type="button" data-k="kare" aria-pressed="false">kare alan</button></div>' +
      '<div class="row bf-kum"><button type="button" class="btn sm" data-a="bas" aria-label="baştan">⏮</button><button type="button" class="btn sm" data-a="geri" aria-label="önceki adım">◀</button><button type="button" class="btn sm pri" data-a="oyn">▶ oynat</button><button type="button" class="btn sm" data-a="ileri" aria-label="sonraki adım">▶|</button></div>' +
      '<p class="bf-adim" data-adim aria-live="polite"></p><button type="button" class="btn sm ghost" data-a="iki" hidden>🔁 ikinci test de pozitif çıktı</button></div>' +
      '<div class="at-v"><div class="bf-sahne" data-sahne></div><div class="bf-form mono" data-form></div><div class="at-out" data-out></div></div></div>';
    var $ = function (s) { return el.querySelector(s); };
    var say = function () {
      var N = 1000, h = Math.round(N * S.prev / 100), tp = Math.round(h * S.sens / 100), sg = N - h, fp = Math.round(sg * (100 - S.spec) / 100);
      return { N: N, h: h, tp: tp, fn: h - tp, sg: sg, fp: fp, tn: sg - fp, post: tp + fp ? tp / (tp + fp) : 0 };
    };
    var ADIM = [
      function (c) { return '1000 kişilik bir kasaba. Henüz kimseyi test etmedik.'; },
      function (c) { return '<b>1. Taban oranı.</b> Yaygınlık ' + yuzde(S.prev / 100) + ': 1000 kişiden <b>' + c.h + '</b> kişi hasta. P(H) = ' + c.h + ' / 1000.'; },
      function (c) { return '<b>2. Test.</b> Hastalarda ' + yuzde(S.sens / 100) + ' oranında pozitif: <b style="color:#C8553D">' + c.tp + '</b> kişi. Sağlamlarda da ' + yuzde((100 - S.spec) / 100) + ' oranında yanlışlıkla pozitif: <b style="color:#B9821F">' + c.fp + '</b> kişi.'; },
      function (c) { return '<b>3. Yalnız pozitiflere bak.</b> Sonucun pozitifse artık evren şu ' + (c.tp + c.fp) + ' kişi: ' + c.tp + ' gerçek + ' + c.fp + ' yanlış alarm.'; },
      function (c) { return '<b>4. Cevap.</b> Pozitiflerden ' + c.tp + ' kişi hasta: P(H | +) = ' + c.tp + ' / ' + (c.tp + c.fp) + ' = <b>' + yuzde(c.post) + '</b>. ' + (c.post < 0.5 ? 'Hastalık nadir olduğundan pozitiflerin çoğu yanlış alarm (taban oranı yanılgısı).' : 'Hastalık yaygın ya da test çok özgül; pozitif sonuç güçlü bir kanıt.'); }
    ];
    var noktalar = function (c) {
      var col = 40, sp = 13, x0 = 8, y0 = 8, pos = [], i;
      /* sıralama: hasta-test+ (tp), hasta-test− (fn), sağlam-test+ (fp), sağlam-test− (tn) */
      var tur = []; for (i = 0; i < c.tp; i++) tur.push('tp'); for (i = 0; i < c.fn; i++) tur.push('fn'); for (i = 0; i < c.fp; i++) tur.push('fp'); for (i = 0; i < c.tn; i++) tur.push('tn');
      var pozN = c.tp + c.fp, pozSira = 0, negSira = 0, ust = y0 + Math.ceil((c.N - pozN) / col) * sp + 30;
      var renk = function (t) {
        if (S.k === 0) return '#AEB8CB';
        if (S.k === 1) return t === 'tp' || t === 'fn' ? '#C8553D' : '#DCE4F0';
        return { tp: '#C8553D', fn: '#F2B8A8', fp: '#E0A526', tn: '#DCE4F0' }[t];
      };
      var s = '';
      tur.forEach(function (t, j) {
        var x, y, op = 1, poz = t === 'tp' || t === 'fp';
        if (S.k >= 3) {
          if (poz) { x = x0 + (pozSira % col) * sp; y = ust + Math.floor(pozSira / col) * sp; pozSira++; }
          else { x = x0 + (negSira % col) * sp; y = y0 + Math.floor(negSira / col) * sp; negSira++; op = 0.18; }
        } else { x = x0 + (j % col) * sp; y = y0 + Math.floor(j / col) * sp; }
        s += '<circle class="bf-n" r="5" cx="0" cy="0" style="transform:translate(' + (x + 5) + 'px,' + (y + 5) + 'px);transition-delay:' + (SAKIN ? 0 : (j % 97) * 3) + 'ms" fill="' + renk(t) + '" opacity="' + op + '"/>';
      });
      var H = S.k >= 3 ? ust + Math.ceil(pozN / col) * sp + 28 : y0 + 25 * sp + 10;
      if (S.k >= 3) s += '<text class="lbb" x="8" y="' + (ust - 10) + '">test pozitif çıkanlar: ' + pozN + ' kişi</text>';
      if (S.k >= 4) s += '<text class="lbb" x="8" y="' + (H - 8) + '" style="fill:#C8553D">' + c.tp + ' gerçek hasta / ' + pozN + ' pozitif = ' + yuzde(c.post) + '</text>';
      return V.svg(540, H, s, '1000 kişilik nokta dizisi');
    };
    var kare = function (c) {
      var W = 400, x0 = 60, y0 = 20, ph = S.prev / 100, a = Math.max(2, W * ph), se = S.sens / 100, fpr = (100 - S.spec) / 100;
      var s = '<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + W + '" fill="#EEF1F6" stroke="#0D1838" stroke-width="1.5"/>';
      if (S.k >= 1) s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + a + '" height="' + W + '" fill="#F6D4CB" stroke="#0D1838"/><text class="lbm" x="' + (x0 + a / 2) + '" y="' + (y0 + W + 16) + '" text-anchor="middle">hasta ' + yuzde(ph) + '</text><text class="lbm" x="' + (x0 + a + (W - a) / 2) + '" y="' + (y0 + W + 16) + '" text-anchor="middle">sağlam ' + yuzde(1 - ph) + '</text>';
      if (S.k >= 2) {
        var op = S.k >= 3 ? 0.2 : 1;
        s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + a + '" height="' + (W * se) + '" fill="#C8553D" stroke="#0D1838"/>';
        s += '<rect x="' + (x0 + a) + '" y="' + y0 + '" width="' + (W - a) + '" height="' + Math.max(1, W * fpr) + '" fill="#E0A526" stroke="#0D1838"/>';
        s += '<rect x="' + x0 + '" y="' + (y0 + W * se) + '" width="' + a + '" height="' + (W * (1 - se)) + '" fill="#fff" opacity="' + (1 - op) * 0.8 + '"/><rect x="' + (x0 + a) + '" y="' + (y0 + W * fpr) + '" width="' + (W - a) + '" height="' + (W * (1 - fpr)) + '" fill="#fff" opacity="' + (S.k >= 3 ? 0.75 : 0) + '"/>';
        s += '<text class="lbm" x="' + (x0 - 6) + '" y="' + (y0 + 12) + '" text-anchor="end">test +</text>';
      }
      if (S.k >= 4) s += '<text class="lbb" x="' + x0 + '" y="' + (y0 + W + 40) + '" style="fill:#C8553D">kırmızı alan / (kırmızı + sarı) = ' + yuzde(c.post) + '</text>';
      return V.svg(520, y0 + W + 50, s, 'kare alan görünümü');
    };
    var ciz = function () {
      var c = say();
      ['prev', 'sens', 'spec'].forEach(function (k) { $('[data-o="' + k + '"]').textContent = '%' + nf(S[k], 1); });
      $('[data-sahne]').innerHTML = S.gor === 'nokta' ? noktalar(c) : kare(c);
      $('[data-adim]').innerHTML = ADIM[S.k](c) + (S.ikinci ? ' <small>(ikinci test: ön olasılık önceki sonuç oldu)</small>' : '');
      var on = function (n) { return S.k >= n ? ' class="on"' : ''; };
      $('[data-form]').innerHTML = 'P(H | +) = <span' + on(1) + '>P(H)</span>·<span' + on(2) + '>P(+|H)</span> / [ <span' + on(3) + '>P(H)·P(+|H)</span> + <span' + on(3) + '>P(S)·P(+|S)</span> ]' +
        (S.k >= 4 ? '<br>= ' + nf(S.prev / 100, 3) + '·' + nf(S.sens / 100, 3) + ' / (' + nf(S.prev / 100 * S.sens / 100, 4) + ' + ' + nf((1 - S.prev / 100) * (1 - S.spec / 100), 4) + ') ≈ <b>' + r4(c.post) + '</b>' : '');
      $('[data-out]').innerHTML = '<div><small>hasta, test +</small><b style="color:#C8553D">' + (S.k >= 2 ? c.tp : '–') + '</b></div><div><small>sağlam, test + (yanlış alarm)</small><b style="color:#B9821F">' + (S.k >= 2 ? c.fp : '–') + '</b></div><div><small>P(H | +)</small><b>' + (S.k >= 4 ? yuzde(c.post) : '?') + '</b></div>';
      $('[data-a="iki"]').hidden = S.k < 4;
    };
    var dur = function () { clearTimeout(S.oyn); S.oyn = 0; $('[data-a="oyn"]').textContent = '▶ oynat'; };
    var git = function (k) { S.k = Math.max(0, Math.min(4, k)); ciz(); };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'), g = e.target.closest('[data-gor] [data-k]');
      if (g) { S.gor = g.getAttribute('data-k'); el.querySelectorAll('[data-gor] [data-k]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === g)); }); ciz(); return; }
      if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'oyn') {
        if (S.oyn) { dur(); return; }
        if (S.k >= 4) git(0);
        b.textContent = '⏸ durdur';
        var adim = function () { if (S.k >= 4) { dur(); return; } git(S.k + 1); S.oyn = setTimeout(adim, SAKIN ? 1200 : 2400); };
        S.oyn = setTimeout(adim, 400); return;
      }
      dur();
      if (a === 'bas') git(0); else if (a === 'geri') git(S.k - 1); else if (a === 'ileri') git(S.k + 1);
      else if (a === 'iki') {
        var c = say(); S.prev = Math.max(0.5, Math.min(99, Math.round(c.post * 1000) / 10)); S.ikinci++;
        var sl = $('[data-s="prev"]'); sl.max = Math.max(30, Math.ceil(S.prev)); sl.value = S.prev; git(1);
      }
    });
    el.querySelectorAll('[data-s]').forEach(function (inp) { inp.addEventListener('input', function () { S[inp.getAttribute('data-s')] = +inp.value; S.ikinci = 0; ciz(); }); });
    ciz();
    return { dur: dur };
  };

  /* =====================================================================
     GÖRSEL ATÖLYE: TABLO ↔ VENN ↔ AĞAÇ
     ===================================================================== */
  var SENARYO = [
    { k: 'kargo', ad: 'Kargo şubesi', a: 'gecikti', b: 'şehir dışı', n: { ab: 36, aB: 54, Ab: 24, AB: 186 } },
    { k: 'ogr', ad: 'Sınıf', a: 'dersi geçti', b: 'düzenli çalıştı', n: { ab: 42, aB: 18, Ab: 8, AB: 32 } },
    { k: 'iade', ad: 'E-ticaret', a: 'iade edildi', b: 'indirimli ürün', n: { ab: 30, aB: 20, Ab: 170, AB: 280 } }
  ];
  var SORU = {
    ab: { t: 'P(A ∩ B)', pay: ['ab'], payda: ['ab', 'aB', 'Ab', 'AB'], n: 'birleşik: ikisi birlikte / hepsi' },
    agb: { t: 'P(A | B)', pay: ['ab'], payda: ['ab', 'Ab'], n: 'koşul B: yeni evren B’nin içi' },
    bga: { t: 'P(B | A)', pay: ['ab'], payda: ['ab', 'aB'], n: 'koşul A: yeni evren A’nın içi; ağaçta doğrudan dal' },
    birl: { t: 'P(A ∪ B)', pay: ['ab', 'aB', 'Ab'], payda: ['ab', 'aB', 'Ab', 'AB'], n: 'en az biri' },
    a: { t: 'P(A)', pay: ['ab', 'aB'], payda: ['ab', 'aB', 'Ab', 'AB'], n: 'marjinal: satır toplamı / hepsi' }
  };
  var cevirici = function (el) {
    var sc = SENARYO[0], n = JSON.parse(JSON.stringify(sc.n)), q = 'agb', hucre = null;
    el.innerHTML = '<div class="tv-ust"><div class="seg" data-sc>' + SENARYO.map(function (s, i) { return '<button type="button" data-k="' + i + '" aria-pressed="' + (i === 0) + '">' + X(s.ad) + '</button>'; }).join('') + '</div>' +
      '<div class="seg" data-q>' + Object.keys(SORU).map(function (k) { return '<button type="button" data-k="' + k + '" aria-pressed="' + (k === q) + '">' + SORU[k].t + '</button>'; }).join('') + '</div></div>' +
      '<div class="tv-g"><div class="tv-k"><h3>Tablo</h3><div data-tab></div></div><div class="tv-k"><h3>Venn</h3><div data-venn></div></div><div class="tv-k"><h3>Ağaç</h3><div data-agac></div></div></div>' +
      '<div class="tv-sonuc" data-son aria-live="polite"></div>';
    var $ = function (s) { return el.querySelector(s); };
    var sec = function () {
      if (hucre) return { pay: [hucre], payda: ['ab', 'aB', 'Ab', 'AB'], t: 'P(' + ({ ab: 'A ∩ B', aB: 'A ∩ B′', Ab: 'A′ ∩ B', AB: 'A′ ∩ B′' })[hucre] + ')', n: 'tıkladığın bölge / hepsi' };
      return SORU[q];
    };
    var tabloCiz = function (S) {
      var cl = function (k) { return S.pay.indexOf(k) > -1 ? 'tv-pay' : S.payda.indexOf(k) > -1 ? 'tv-payda' : ''; };
      var inp = function (k) { return '<td class="' + cl(k) + '" data-bolge="' + k + '"><label class="vh" for="tv-' + k + '">' + k + '</label><input id="tv-' + k + '" type="number" min="0" max="999" value="' + n[k] + '" data-n="' + k + '"></td>'; };
      return '<table class="tb tv-t"><thead><tr><th></th><th>' + X(sc.b) + '</th><th>' + X(sc.b) + ' değil</th><th>Toplam</th></tr></thead><tbody>' +
        '<tr><th>' + X(sc.a) + '</th>' + inp('ab') + inp('aB') + '<td class="n">' + (n.ab + n.aB) + '</td></tr>' +
        '<tr><th>' + X(sc.a) + ' değil</th>' + inp('Ab') + inp('AB') + '<td class="n">' + (n.Ab + n.AB) + '</td></tr>' +
        '<tr><th>Toplam</th><td class="n">' + (n.ab + n.Ab) + '</td><td class="n">' + (n.aB + n.AB) + '</td><td class="n"><b>' + (n.ab + n.aB + n.Ab + n.AB) + '</b></td></tr></tbody></table>';
    };
    var ciz = function (tabloDa) {
      var S = sec(), top = function (L) { return L.reduce(function (a, k) { return a + n[k]; }, 0); }, p = top(S.pay), pd = top(S.payda);
      if (!tabloDa) $('[data-tab]').innerHTML = tabloCiz(S);
      else el.querySelectorAll('.tv-t td[data-bolge]').forEach(function (td) { var k = td.getAttribute('data-bolge'); td.className = S.pay.indexOf(k) > -1 ? 'tv-pay' : S.payda.indexOf(k) > -1 ? 'tv-payda' : ''; });
      $('[data-venn]').innerHTML = vennSvg(n, S, { a: sc.a, b: sc.b });
      $('[data-agac]').innerHTML = agacSvg(n, S, { a: sc.a, b: sc.b });
      var yon = q === 'agb' && !hucre ? ' Ağaç önce A’ya göre dallandığı için P(A | B) ağaçta doğrudan okunmaz: B’li yaprakları (iki kesik çerçeveli) toplayıp böleriz. Bu, Bayes’in ta kendisi.' : q === 'bga' && !hucre ? ' Ağaçta A dalının üstündeki sayı doğrudan bu olasılıktır.' : '';
      $('[data-son]').innerHTML = '<b>' + S.t + '</b> = <span class="tv-pay">' + p + '</span> / <span class="tv-payda">' + pd + '</span> = <b>' + (pd ? r4(p / pd) : '–') + '</b> <small>(' + X(S.n) + ', A = ' + X(sc.a) + ', B = ' + X(sc.b) + ')</small>' + yon;
    };
    el.addEventListener('click', function (e) {
      var s = e.target.closest('[data-sc] [data-k]'), qq = e.target.closest('[data-q] [data-k]'), b = e.target.closest('[data-bolge]');
      if (s) { sc = SENARYO[+s.getAttribute('data-k')]; n = JSON.parse(JSON.stringify(sc.n)); hucre = null; el.querySelectorAll('[data-sc] [data-k]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === s)); }); ciz(); return; }
      if (qq) { q = qq.getAttribute('data-k'); hucre = null; el.querySelectorAll('[data-q] [data-k]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === qq)); }); ciz(); return; }
      if (b && !e.target.closest('input')) { hucre = b.getAttribute('data-bolge'); el.querySelectorAll('[data-q] [data-k]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); ciz(); }
    });
    el.addEventListener('input', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-n'); if (!k) return;
      n[k] = Math.max(0, Math.min(999, Math.round(+e.target.value || 0)));
      var tb = el.querySelector('.tv-t'); tb.querySelectorAll('tbody tr')[0].lastElementChild.textContent = n.ab + n.aB; tb.querySelectorAll('tbody tr')[1].lastElementChild.textContent = n.Ab + n.AB;
      var t3 = tb.querySelectorAll('tbody tr')[2].children; t3[1].textContent = n.ab + n.Ab; t3[2].textContent = n.aB + n.AB; t3[3].innerHTML = '<b>' + (n.ab + n.aB + n.Ab + n.AB) + '</b>';
      ciz(true);
    });
    ciz();
  };

  /* =====================================================================
     GÖRSEL ATÖLYE: BASKETÇİ (Bernoulli → Binom)
     ===================================================================== */
  var basketci = function (el) {
    var S = { n: 5, p: 0.6, olay: 'tam', k: 3, sonuc: [], mac: null, oyn: false };
    el.innerHTML = '<div class="at-g"><div class="at-k">' +
      '<label><span>atış sayısı n <output data-o="n"></output></span><input type="range" min="1" max="8" step="1" value="5" data-s="n"></label>' +
      '<label><span>isabet olasılığı p <output data-o="p"></output></span><input type="range" min="0.1" max="0.95" step="0.05" value="0.6" data-s="p"></label>' +
      '<p class="lbl" style="margin:2px 0 0;font-weight:700;font-size:13px">X = kaçırılan atış sayısı</p><div class="seg" data-olay><button type="button" data-k="tam" aria-pressed="true">tam k</button><button type="button" data-k="enaz" aria-pressed="false">en az k</button><button type="button" data-k="enfazla" aria-pressed="false">en fazla k</button></div>' +
      '<label><span>k <output data-o="k"></output></span><input type="range" min="0" max="5" step="1" value="3" data-s="k"></label>' +
      '<div class="row"><button type="button" class="btn sm pri" data-a="at">🏀 ' + 'atışları yap</button><button type="button" class="btn sm" data-a="mac">1000 maç oyna</button></div></div>' +
      '<div class="at-v"><div class="bk-saha" data-saha></div><div data-yol></div><div data-dag></div><div class="bf-form mono" data-form></div></div></div>';
    var $ = function (s) { return el.querySelector(s); };
    var q = function () { return 1 - S.p; };
    var kume = function () { var L = []; for (var x = 0; x <= S.n; x++) if (S.olay === 'tam' ? x === S.k : S.olay === 'enaz' ? x >= S.k : x <= S.k) L.push(x); return L; };
    var saha = function (top) {
      var s = '<rect x="0" y="150" width="540" height="20" fill="#E9D6B4"/><path d="M450 40v110" stroke="#0D1838" stroke-width="4"/><rect x="452" y="30" width="56" height="40" fill="#fff" stroke="#0D1838" stroke-width="2"/><path d="M420 70h40" stroke="#C8553D" stroke-width="4"/>';
      s += '<g transform="translate(60 92)"><circle r="14" fill="#0D1838"/><path d="M0 14v34M0 26l20-14M0 26l-16 12M0 48l-12 22M0 48l12 22" stroke="#0D1838" stroke-width="5" stroke-linecap="round"/></g>';
      S.sonuc.forEach(function (ok, i) { s += '<g transform="translate(' + (24 + i * 34) + ' 18)"><circle r="13" fill="' + (ok ? '#3E8E5B' : '#C8553D') + '" stroke="#0D1838"/><text y="5" text-anchor="middle" fill="#fff" font-weight="800" font-size="13">' + (ok ? '✓' : '✗') + '</text></g>'; });
      if (top) s += '<circle data-top r="9" cx="0" cy="0" fill="#E0A526" stroke="#0D1838" stroke-width="1.5" style="transform:translate(80px,76px)"/>';
      var kac = S.sonuc.filter(function (x) { return !x; }).length;
      if (S.sonuc.length === S.n && S.n) s += '<text class="lbb" x="24" y="54">' + kac + ' kaçırma</text>';
      return V.svg(540, 172, s, 'basketbol sahası');
    };
    var dagilim = function () {
      var xs = [], ps = [], L = kume(); for (var x = 0; x <= S.n; x++) { xs.push(x); ps.push(M.binom(x, S.n, q())); }
      var hi = L.map(function (x) { return x; }), h = IST.S.sutun(xs, ps, hi, { xlab: 'kaçırılan atış sayısı X ~ B(' + S.n + '; ' + nf(q(), 2) + ')', h: 210, dg: 3 });
      if (S.mac) {
        var mx = V.nice(Math.max.apply(null, ps) * 1.15), W = 520, L0 = 46, bw = (W - L0 - 12) / xs.length, ys = function (v) { return 210 - 44 - v / mx * (210 - 44 - 18); }, dots = '';
        S.mac.forEach(function (c, i) { var v = c / 1000; dots += '<circle cx="' + (L0 + i * bw + bw * 0.78).toFixed(1) + '" cy="' + ys(v).toFixed(1) + '" r="5" fill="#fff" stroke="#C8553D" stroke-width="2.5"/>'; });
        h = h.replace('</svg>', dots + '</svg>');
      }
      return h + (S.mac ? '<p class="lbm" style="margin:4px 0 0">○ 1000 maçta gözlenen oran · sütunlar binom olasılığı</p>' : '');
    };
    var yolHtml = function () {
      if (S.olay !== 'tam') return '';
      var L = yollar(S.n, S.k), tek = Math.pow(q(), S.k) * Math.pow(S.p, S.n - S.k), goster = L.slice(0, 20);
      return '<div class="bk-yol"><b>' + L.length + ' dizilim</b> (C(' + S.n + ', ' + S.k + ')), her biri ' + nf(q(), 2) + '<sup>' + S.k + '</sup>·' + nf(S.p, 2) + '<sup>' + (S.n - S.k) + '</sup> = ' + r4(tek) + '<div class="bk-yl">' +
        goster.map(function (y, i) { return '<span class="pop" ' + d(i * 0.04) + '>' + y.split('').map(function (c) { return c === '0' ? '<i class="x">✗</i>' : '<i class="v">✓</i>'; }).join('') + '</span>'; }).join('') + (L.length > 20 ? '<span>… ve ' + (L.length - 20) + ' dizilim daha</span>' : '') + '</div></div>';
    };
    var ciz = function () {
      $('[data-o="n"]').textContent = S.n; $('[data-o="p"]').textContent = nf(S.p, 2) + ' (kaçırma q = ' + nf(q(), 2) + ')'; $('[data-o="k"]').textContent = S.k;
      var ks = $('[data-s="k"]'); ks.max = S.n; if (S.k > S.n) { S.k = S.n; ks.value = S.n; $('[data-o="k"]').textContent = S.k; }
      $('[data-saha]').innerHTML = saha(false);
      $('[data-yol]').innerHTML = yolHtml();
      $('[data-dag]').innerHTML = dagilim();
      var L = kume(), pr = L.reduce(function (a, x) { return a + M.binom(x, S.n, q()); }, 0), ad = S.olay === 'tam' ? 'P(X = ' + S.k + ')' : S.olay === 'enaz' ? 'P(X ≥ ' + S.k + ')' : 'P(X ≤ ' + S.k + ')';
      var acik = S.olay === 'tam' ? 'C(' + S.n + ', ' + S.k + ')·' + nf(q(), 2) + '^' + S.k + '·' + nf(S.p, 2) + '^' + (S.n - S.k) : S.olay === 'enaz' && S.k > 0 ? '1 − P(X ≤ ' + (S.k - 1) + ')' : L.map(function (x) { return 'P(X=' + x + ')'; }).join(' + ');
      $('[data-form]').innerHTML = ad + ' = ' + acik + ' = <b>' + r4(pr) + '</b>' + (S.olay === 'enaz' && S.k === 1 ? '<br>kısa yol: 1 − P(X = 0) = 1 − ' + nf(S.p, 2) + '^' + S.n : '');
    };
    var atisYap = function () {
      if (S.oyn) return; S.oyn = true; S.sonuc = []; S.mac = null; ciz();
      var i = 0;
      var tek = function () {
        if (i >= S.n) { S.oyn = false; ciz(); return; }
        var ok = Math.random() < S.p;
        $('[data-saha]').innerHTML = saha(true);
        var top = $('[data-top]');
        if (SAKIN || !top) { S.sonuc.push(ok); i++; setTimeout(tek, 120); return; }
        var t0 = null, sure = 650, son = ok ? [480, 62] : [500, 20];
        var adim = function (t) {
          if (!t0) t0 = t; var u = Math.min(1, (t - t0) / sure), x = 80 + (son[0] - 80) * u, y = 76 + (son[1] - 76) * u - 120 * Math.sin(Math.PI * u) * (ok ? 1 : 0.8);
          top.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
          if (u < 1) requestAnimationFrame(adim); else { S.sonuc.push(ok); i++; setTimeout(tek, 160); }
        };
        requestAnimationFrame(adim);
      };
      tek();
    };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'), o = e.target.closest('[data-olay] [data-k]');
      if (o) { S.olay = o.getAttribute('data-k'); el.querySelectorAll('[data-olay] [data-k]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === o)); }); ciz(); return; }
      if (!b) return;
      if (b.getAttribute('data-a') === 'at') atisYap();
      else { var c = []; for (var x = 0; x <= S.n; x++) c.push(0); for (var m = 0; m < 1000; m++) { var k = 0; for (var j = 0; j < S.n; j++) if (Math.random() >= S.p) k++; c[k]++; } S.mac = c; ciz(); }
    });
    el.querySelectorAll('[data-s]').forEach(function (inp) { inp.addEventListener('input', function () { var k = inp.getAttribute('data-s'); S[k] = +inp.value; if (k !== 'k') { S.sonuc = []; S.mac = null; } ciz(); }); });
    ciz();
  };

  /* görsel atölyeye sekme ekle: mevcut atölye “ilk sekme” olarak kalır */
  var sekmeEkle = function (H, ilkAd, ekler) {
    if (!H || !H.gorsel) return;
    var eski = H.gorsel.kur;
    H.gorsel.t += ' Yeni: ' + ekler.map(function (e) { return '“' + e[1] + '”'; }).join(', ') + ' sekmeleri.';
    H.gorsel.kur = function (el, api) {
      var L = [['ilk', ilkAd]].concat(ekler.map(function (e) { return [e[0], e[1]]; })), cur = 'ilk', ctl = null;
      el.innerHTML = '<div class="seg ek-sek" data-ek role="tablist" style="margin-bottom:14px">' + L.map(function (x, i) { return '<button type="button" role="tab" data-k="' + x[0] + '" aria-pressed="' + (i === 0) + '">' + X(x[1]) + '</button>'; }).join('') + '</div><div data-ekb></div>';
      var b = el.querySelector('[data-ekb]');
      var ac = function (k) {
        if (ctl && ctl.dur) ctl.dur(); ctl = null; cur = k;
        el.querySelectorAll('[data-ek] [data-k]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-k') === k)); });
        if (k === 'ilk') eski(b, api); else ctl = ekler.filter(function (e) { return e[0] === k; })[0][2](b, api) || null;
      };
      el.querySelector('[data-ek]').addEventListener('click', function (e) { var x = e.target.closest('[data-k]'); if (x && x.getAttribute('data-k') !== cur) ac(x.getAttribute('data-k')); });
      ac('ilk');
    };
  };
  sekmeEkle(g7, 'Venn ve zar', [['bayes', 'Bayes filmi', bayesFilm], ['cevir', 'Tablo ↔ Venn ↔ Ağaç', cevirici]]);
  sekmeEkle(g11, 'Binom ve Poisson gezgini', [['basket', 'Basketçi', basketci]]);

  /* =====================================================================
     YENİ NESİL SORU ŞABLONLARI (yanılgı yakalayıcı açıklamalarla)
     ===================================================================== */
  var g7Yeni = function (r) {
    var out = [];
    /* 1) tanı testi: doğal frekansla Bayes */
    var prev = r.pick([1, 2, 3, 4, 5]), se = r.pick([80, 85, 90, 95]), sp = r.pick([85, 88, 90, 92, 95]), N = 1000;
    var h = N * prev / 100, tp = Math.round(h * se / 100), fp = Math.round((N - h) * (100 - sp) / 100), post = tp / (tp + fp);
    var urun = r.pick([['bir kalp hastalığı taraması', 'hasta'], ['bir fabrikadaki hatalı ürün sensörü', 'hatalı'], ['bir bankanın sahte işlem alarmı', 'sahte']]);
    out.push({ viz: function (k) { return dogalAgac(N, h, tp, fp, k, { a: urun[1], b: 'değil', kim: 'vaka' }); }, vizOnly: true, tag: 'senaryo · Bayes',
      q: '<p>' + X(urun[0].charAt(0).toLocaleUpperCase('tr') + urun[0].slice(1)) + ': ' + urun[1] + ' vaka oranı <b>%' + prev + '</b>. Sistem ' + urun[1] + ' vakaları <b>%' + se + '</b> oranında yakalıyor; ' + urun[1] + ' olmayan vakalarda da <b>%' + (100 - sp) + '</b> oranında yanlışlıkla alarm veriyor.</p><p>Alarm veren bir vakanın gerçekten ' + urun[1] + ' olma olasılığı kaçtır? (dört ondalık)</p>',
      say: post, goster: r4(post), tol: 0.0006, ornek: '0,1610',
      yanlis: function (v) { return Math.abs(v - se / 100) < 0.006 ? 'Bu P(alarm | ' + urun[1] + '), yani duyarlılık. Sorulan ters yön: P(' + urun[1] + ' | alarm). Yanlış alarmları da paydaya katmalısın.' : Math.abs(v - prev / 100) < 0.006 ? 'Bu yalnız taban oranı; alarm bilgisini hesaba katmadın.' : '1000 vaka üzerinden say: önce ' + urun[1] + ' olanlar, sonra alarm verenler.'; },
      ip: '1000 vaka düşün: kaçı ' + urun[1] + ', bunların kaçına alarm verilir, ' + urun[1] + ' olmayanların kaçına yanlış alarm verilir?',
      cz: ['1000 vakada oran %' + prev + ': ' + h + ' ' + urun[1] + ', ' + (N - h) + ' değil.', urun[1] + ' olup alarm: ' + h + '·' + nf(se / 100, 2) + ' = ' + tp + '.', 'Yanlış alarm: ' + (N - h) + '·' + nf((100 - sp) / 100, 2) + ' = ' + fp + '.', 'Alarm verenler ' + tp + ' + ' + fp + ' = ' + (tp + fp) + '; P = ' + tp + ' / ' + (tp + fp) + ' = <b>' + r4(post) + '</b>.'] });
    /* 2) P(A|B) mi P(B|A) mı? (yanılgı yakalayıcı) */
    var n, gA, gB, tt, i = 0;
    var farkli = function () { var v = [n.ab / gB, n.ab / gA, n.ab / tt, gA / tt]; for (var x = 0; x < 4; x++) for (var y = x + 1; y < 4; y++) if (Math.abs(v[x] - v[y]) < 0.02) return false; return true; };
    do { n = { ab: r.int(15, 60), aB: r.int(15, 80), Ab: r.int(10, 60), AB: r.int(60, 200) }; gA = n.ab + n.aB; gB = n.ab + n.Ab; tt = n.ab + n.aB + n.Ab + n.AB; i++; } while (i < 60 && !farkli());
    if (!farkli()) { n = { ab: 30, aB: 50, Ab: 20, AB: 150 }; gA = 80; gB = 50; tt = 250; }
    var sc = r.pick([['kampanya e-postasını açtı', 'satın aldı'], ['kredi kartı kullanıyor', 'mobil uygulamayı kullanıyor'], ['sigorta yaptırdı', 'kaza yaptı']]);
    var dogru = n.ab / gB, op = [r4(dogru), r4(n.ab / gA), r4(n.ab / tt), r4(gA / tt)];
    out.push({ tag: 'tablo · koşullu', q: '<p>Bir şirketin 1 aylık müşteri verisi yanda (A: ' + X(sc[0]) + ', B: ' + X(sc[1]) + ').</p><p>Müşteri <b>' + X(sc[1]) + '</b> ise, <b>' + X(sc[0]) + '</b> olma olasılığı kaçtır?</p>',
      g: V.tablo(['', 'B: ' + X(sc[1]), 'B değil', 'Toplam'], [['A: ' + X(sc[0]), String(n.ab), String(n.aB), String(gA)], ['A değil', String(n.Ab), String(n.AB), String(n.Ab + n.AB)], ['<b>Toplam</b>', String(gB), String(n.aB + n.AB), String(tt)]], { n: [1, 2, 3], st: 0 }),
      o: op, a: 0, n: 'Koşul B: payda B sütununun toplamı ' + gB + '; P(A|B) = ' + n.ab + ' / ' + gB + ' = ' + r4(dogru) + '.',
      yn: [null, 'Bu P(B | A): koşulu ters çevirdin. “B ise” dendiği için evren B sütunudur, A satırı değil.', 'Bu P(A ∩ B): ikisinin birlikte olma olasılığı. Koşullu olasılıkta payda tüm müşteriler değil, yalnız B’dir.', 'Bu P(A): B bilgisini kullanmadın.'],
      ip: '“B ise” → B sütununu yeni evren say.', cz: ['Koşul B: B sütunu toplamı ' + gB + '.', 'A ve B birlikte: ' + n.ab + '.', 'P(A | B) = ' + n.ab + ' / ' + gB + ' = <b>' + r4(dogru) + '</b>.'] });
    /* 3) bağımsız mı, ayrık mı? */
    var tur = r.int(0, 2), pa = r.pick([0.2, 0.3, 0.4, 0.5, 0.6]), pb = r.pick([0.2, 0.3, 0.4, 0.5]), pab = tur === 0 ? Math.round(pa * pb * 100) / 100 : tur === 1 ? 0 : Math.round((pa * pb + r.pick([-0.04, 0.05, 0.08])) * 100) / 100;
    if (tur === 2 && (pab <= 0 || pab > Math.min(pa, pb))) pab = Math.round(Math.min(pa, pb) * 50) / 100;
    if (tur === 2 && Math.abs(pab - pa * pb) < 0.005) pab = Math.round((pab + 0.03) * 100) / 100;
    out.push({ tag: 'kavram', q: '<p>Bir ankette P(A) = <b>' + nf(pa, 2) + '</b>, P(B) = <b>' + nf(pb, 2) + '</b> ve P(A ∩ B) = <b>' + nf(pab, 2) + '</b> bulundu.</p><p>A ile B için hangisi doğrudur?</p>',
      o: ['Bağımsızdır', 'Ayrıktır (birlikte olamaz); dolayısıyla bağımlıdır', 'Ne bağımsız ne ayrık; bağımlıdır'], a: tur,
      n: 'P(A)·P(B) = ' + nf(pa * pb, 2) + '. ' + (tur === 0 ? 'P(A ∩ B) buna eşit: bağımsız.' : tur === 1 ? 'P(A ∩ B) = 0: ayrık; ayrık olaylar bağımsız değildir.' : 'P(A ∩ B) ne 0 ne de çarpıma eşit: bağımlı.'),
      yn: ['Bağımsızlık için P(A ∩ B) = P(A)·P(B) = ' + nf(pa * pb, 2) + ' olmalıydı; burada ' + nf(pab, 2) + '.', tur === 0 ? 'Ayrık olsalardı kesişim 0 olurdu; burada ' + nf(pab, 2) + '.' : 'Kesişim ' + nf(pab, 2) + ', 0 değil: birlikte olabiliyorlar.', tur === 1 ? 'Kesişim tam 0: bu ayrıklık demek. Ayrık olaylar bağımlıdır, “ne ayrık” denemez.' : 'Kesişim çarpıma eşit: bu tam bağımsızlık.'],
      ip: 'İki ölçüt: P(A ∩ B) = 0 mı (ayrık)? P(A ∩ B) = P(A)·P(B) mi (bağımsız)?', cz: ['P(A)·P(B) = ' + nf(pa, 2) + '·' + nf(pb, 2) + ' = ' + nf(pa * pb, 2) + '.', 'P(A ∩ B) = ' + nf(pab, 2) + ' ile karşılaştır.', '<b>' + ['Bağımsız', 'Ayrık (bağımlı)', 'Bağımlı'][tur] + '</b>.'] });
    /* 4) en az bir: tümleyen */
    var k = r.int(3, 5), p = r.pick([0.2, 0.25, 0.3, 0.35, 0.4]), ea = 1 - Math.pow(1 - p, k);
    var ctx = r.pick([['iş başvurusu yaptı; her başvurunun olumlu dönme', 'en az birinden olumlu dönüş'], ['tedarikçiye sipariş verdi; her siparişin gecikme', 'en az bir siparişin gecikmesi'], ['müşteriyi aradı; her aramanın satışla sonuçlanma', 'en az bir satış']]);
    out.push({ viz: function (ka) { return IST.S.izgara(k, k, '📨', ka, { k: 1, lab: ka >= 1 ? 'hiçbiri: ' + nf(1 - p, 2) + '^' + k + ' = ' + r4(Math.pow(1 - p, k)) : k + ' bağımsız deneme' }); }, tag: 'senaryo · tümleyen',
      q: '<p>Bir girişimci ' + k + ' ' + ctx[0] + ' olasılığı birbirinden bağımsız olarak <b>' + nf(p, 2) + '</b>.</p><p><b>' + X(ctx[1].charAt(0).toLocaleUpperCase('tr') + ctx[1].slice(1)) + '</b> olasılığı kaçtır? (dört ondalık)</p>',
      say: ea, goster: r4(ea), tol: 0.0006, ornek: '0,5904',
      yanlis: function (v) { return Math.abs(v - Math.min(1, k * p)) < 0.006 ? 'Olasılıkları topladın; olaylar ayrık olmadığı için kesişimler iki kez sayılır (k çok olsa 1’i bile geçerdi).' : Math.abs(v - Math.pow(p, k)) < 0.0006 ? 'Bu “hepsinin” olasılığı; “en az bir” istendi.' : '“En az bir”in tümleyeni “hiçbiri”dir.'; },
      ip: 'P(en az bir) = 1 − P(hiçbiri) = 1 − (1 − p)^k.', cz: ['P(hiçbiri) = ' + nf(1 - p, 2) + '^' + k + ' = ' + r4(Math.pow(1 - p, k)) + '.', '1 − ' + r4(Math.pow(1 - p, k)) + ' = <b>' + r4(ea) + '</b>.'] });
    return out;
  };

  var dil = function (op, k) { return { tam: 'P(X = ' + k + ')', enaz: 'P(X ≥ ' + k + ')', enfazla: 'P(X ≤ ' + k + ')', fazla: 'P(X > ' + k + ')', az: 'P(X < ' + k + ')' }[op]; };
  var g11Yeni = function (r) {
    var out = [], bin = function (x, n, p) { return M.binom(x, n, p); }, cdf = function (x, n, p) { var s = 0; for (var i = 0; i <= x; i++) s += bin(i, n, p); return s; };
    /* 1) basketçi: tam k kaçırma */
    var n = r.int(4, 7), p = r.pick([0.6, 0.65, 0.7, 0.75, 0.8]), q = Math.round((1 - p) * 100) / 100, k = r.int(1, n - 1), pr = bin(k, n, q), tek = Math.pow(q, k) * Math.pow(p, n - k);
    var xs = []; for (var i = 0; i <= n; i++) xs.push(i);
    out.push({ viz: function (ka) { return IST.S.sutun(xs, xs.map(function (x) { return bin(x, n, q); }), ka >= 3 ? [k] : [], { xlab: 'kaçırılan atış sayısı' }); }, tag: 'senaryo · binom',
      q: '<p>Bir basketbolcunun serbest atış isabet oranı <b>%' + Math.round(p * 100) + '</b>; atışlar birbirinden bağımsız. Maçta <b>' + n + '</b> serbest atış kullanıyor.</p><p>Bu atışlardan <b>tam ' + k + '</b> tanesini kaçırma olasılığı kaçtır? (dört ondalık)</p>',
      say: pr, goster: r4(pr), tol: 0.0006, ornek: '0,2304',
      yanlis: function (v) { return Math.abs(v - tek) < 0.0006 ? 'Yalnız bir dizilimin olasılığını buldun. Kaçırılan ' + k + ' atış, ' + n + ' atış içinde herhangi ' + k + ' tanesi olabilir: C(' + n + ', ' + k + ') = ' + M.C(n, k) + ' ile çarp.' : Math.abs(v - bin(k, n, p)) < 0.0006 ? 'İsabet ile kaçırmayı karıştırdın: başarı olasılığı burada “kaçırma” = ' + nf(q, 2) + '.' : 'X = kaçırma sayısı, X ~ B(' + n + '; ' + nf(q, 2) + ').'; },
      ip: 'X = kaçırılan atış sayısı → “başarı” kaçırmadır, q = ' + nf(q, 2) + '. P(X = k) = C(n, k)·q^k·p^(n−k).',
      cz: ['X ~ B(' + n + '; ' + nf(q, 2) + '), sorulan P(X = ' + k + ').', 'Bir dizilim: ' + nf(q, 2) + '^' + k + '·' + nf(p, 2) + '^' + (n - k) + ' = ' + r4(tek) + '.', 'Dizilim sayısı C(' + n + ', ' + k + ') = ' + M.C(n, k) + '.', M.C(n, k) + '·' + r4(tek) + ' = <b>' + r4(pr) + '</b>.'] });
    /* 2) şık tahmini: en az k doğru */
    var ns = r.int(6, 10), sik = r.pick([4, 5]), ps = 1 / sik, ke = r.int(2, 3), ea = 1 - cdf(ke - 1, ns, ps);
    var xs2 = []; for (i = 0; i <= ns; i++) xs2.push(i);
    out.push({ viz: function (ka) { return IST.S.sutun(xs2, xs2.map(function (x) { return bin(x, ns, ps); }), ka >= 1 ? xs2.filter(function (x) { return ka >= 2 ? x >= ke : x < ke; }) : [], { xlab: 'doğru sayısı' }); }, tag: 'senaryo · en az',
      q: '<p>Hiç çalışmadan girdiğin ' + ns + ' soruluk bir testte her soru <b>' + sik + '</b> şıklı ve hepsini rastgele işaretliyorsun.</p><p><b>En az ' + ke + '</b> doğru yapma olasılığı kaçtır? (dört ondalık)</p>',
      say: ea, goster: r4(ea), tol: 0.0006, ornek: '0,4744',
      yanlis: function (v) { return Math.abs(v - bin(ke, ns, ps)) < 0.0006 ? '“En az ' + ke + '” tek değer değildir: ' + ke + ', ' + (ke + 1) + ', …, ' + ns + ' doğrunun hepsi.' : Math.abs(v - (1 - cdf(ke, ns, ps))) < 0.0006 ? 'Tümleyende ' + ke + ' değerini de çıkardın; bu P(X > ' + ke + ') olur.' : 'Kısa yol: 1 − P(X ≤ ' + (ke - 1) + ').'; },
      ip: 'X ~ B(' + ns + '; 1/' + sik + '). P(X ≥ ' + ke + ') = 1 − [P(X = 0) + … + P(X = ' + (ke - 1) + ')].',
      cz: ['p = 1/' + sik + ' = ' + nf(ps, 2) + ', n = ' + ns + '.', 'P(X ≤ ' + (ke - 1) + ') = ' + (function () { var a = []; for (var j = 0; j < ke; j++) a.push(r4(bin(j, ns, ps))); return a.join(' + '); })() + ' = ' + r4(cdf(ke - 1, ns, ps)) + '.', '1 − ' + r4(cdf(ke - 1, ns, ps)) + ' = <b>' + r4(ea) + '</b>.'] });
    /* 3) kalite kontrol: en fazla 1 kusurlu */
    var nk = r.int(8, 20), pk = r.pick([0.02, 0.03, 0.05, 0.08, 0.1]), ef = cdf(1, nk, pk);
    out.push({ tag: 'senaryo · en fazla', q: '<p>Bir dolum hattında kusurlu şişe oranı <b>%' + Math.round(pk * 100) + '</b>. Kontrolör rastgele <b>' + nk + '</b> şişe alıyor; en fazla 1 kusurlu varsa parti kabul ediliyor.</p><p>Partinin <b>kabul edilme</b> olasılığı kaçtır? (dört ondalık)</p>',
      say: ef, goster: r4(ef), tol: 0.0006, ornek: '0,8108',
      yanlis: function (v) { return Math.abs(v - bin(1, nk, pk)) < 0.0006 ? '“En fazla 1” = 0 ya da 1 kusurlu; P(X = 0)’ı da eklemelisin.' : Math.abs(v - bin(0, nk, pk)) < 0.0006 ? 'Yalnız “hiç kusursuz” durumunu aldın; 1 kusurlu da kabul.' : 'P(X ≤ 1) = P(X = 0) + P(X = 1).'; },
      ip: 'X ~ B(' + nk + '; ' + nf(pk, 2) + '). Kabul: X ≤ 1.', cz: ['P(X = 0) = ' + nf(1 - pk, 2) + '^' + nk + ' = ' + r4(bin(0, nk, pk)) + '.', 'P(X = 1) = ' + nk + '·' + nf(pk, 2) + '·' + nf(1 - pk, 2) + '^' + (nk - 1) + ' = ' + r4(bin(1, nk, pk)) + '.', 'Toplam = <b>' + r4(ef) + '</b>.'] });
    /* 4) sözel ifade → olasılık gösterimi */
    var ifadeler = [['en az', 'enaz'], ['en fazla', 'enfazla'], ['fazla', 'fazla'], ['az', 'az']], sec = r.pick(ifadeler), kk = r.int(2, 5);
    var ayr = { 2: '’den', 3: '’ten', 4: '’ten', 5: '’ten' }[kk];   /* iki’den, üç’ten, dört’ten, beş’ten */
    var metin = sec[1] === 'enaz' || sec[1] === 'enfazla' ? sec[0] + ' ' + kk : kk + ayr + ' ' + sec[0];
    var tumu = ['enaz', 'enfazla', 'fazla', 'az'], dogruI = tumu.indexOf(sec[1]);
    var acik = { enaz: kk + ' dahil ve üstü', enfazla: kk + ' dahil ve altı', fazla: kk + ' hariç, üstü', az: kk + ' hariç, altı' };
    out.push({ tag: 'okuma', q: '<p>Bir çağrı merkezinde saatte gelen şikâyet sayısı X. Yönetici “şikâyet sayısının <b>' + X(metin) + '</b> olma olasılığını” soruyor.</p><p>Bu hangi gösterimdir?</p>',
      o: tumu.map(function (t) { return dil(t, kk); }), a: dogruI, n: '“' + metin + '” = ' + acik[sec[1]] + ' → ' + dil(sec[1], kk) + '.',
      yn: tumu.map(function (t) { return t === sec[1] ? null : dil(t, kk) + ' “' + acik[t] + '” demektir; “' + metin + '” ise ' + acik[sec[1]] + '.'; }),
      ip: '“En az / en fazla” sınırı içerir (≥, ≤); “’ten fazla / ’ten az” içermez (>, <).', cz: ['“' + metin + '”: ' + acik[sec[1]] + '.', '<b>' + dil(sec[1], kk) + '</b>.'] });
    return out;
  };

  /* her sette 5 soru: eski ve yeni şablonlardan karışık (her sette en az iki yeni) */
  var karistir = function (H, yeni) {
    if (!H) return;
    var eski = H.sorular;
    H.sorular = function (r) {
      var a = eski(r), b = yeni(r), nb = r.int(2, Math.min(3, b.length)), sb = r.shuf(b).slice(0, nb), sa = r.shuf(a).slice(0, 5 - nb);
      return r.shuf(sa.concat(sb));
    };
  };
  karistir(g7, g7Yeni);
  karistir(g11, g11Yeni);

  /* =====================================================================
     REHBERLİ SERİ (azalan yardım): 4 basamak, her basamakta yeni sayılar
     şablon: r → { q, g?, adim: [{ t, say, goster, tol?, yanlis?(v) }] }
     ===================================================================== */
  var R7 = [
    function (r) {
      var prev = r.pick([1, 2, 5]), se = r.pick([80, 90, 95]), sp = r.pick([90, 95]), h = 10 * prev, tp = Math.round(h * se / 100), fp = Math.round((1000 - h) * (100 - sp) / 100), post = tp / (tp + fp);
      return { q: '<p>Bir hastalığın nüfusta görülme oranı <b>%' + prev + '</b>. Test hastalarda <b>%' + se + '</b> oranında pozitif, sağlamlarda da <b>%' + (100 - sp) + '</b> oranında yanlışlıkla pozitif. Pozitif çıkan biri gerçekten hasta mı?</p>',
        adim: [{ t: '1000 kişide kaç hasta var?', say: h, goster: String(h), tol: 0.5 },
          { t: 'Hastaların kaçı test pozitif? (gerçek pozitif)', say: tp, goster: String(tp), tol: 0.5, yanlis: function (v) { return Math.abs(v - h) < 0.5 ? 'Hastaların hepsi değil, yalnız %' + se + ' oranında pozitif çıkar.' : ''; } },
          { t: 'Sağlamların kaçı yanlışlıkla pozitif?', say: fp, goster: String(fp), tol: 0.5, yanlis: function (v) { return Math.abs(v - Math.round(1000 * (100 - sp) / 100)) < 0.5 ? 'Yanlış alarm oranı yalnız sağlamlara (' + (1000 - h) + ' kişi) uygulanır.' : ''; } },
          { t: 'P(hasta | pozitif) = ? (dört ondalık)', say: post, goster: r4(post), tol: 0.0006, yanlis: function (v) { return Math.abs(v - se / 100) < 0.006 ? 'Bu P(+ | hasta). Sorulan ters yön; payda tüm pozitifler (' + (tp + fp) + ').' : ''; } }] };
    },
    function (r) {
      var n = { ab: r.int(12, 40), aB: r.int(20, 60), Ab: r.int(10, 40), AB: r.int(60, 160) }, gB = n.ab + n.Ab;
      return { q: '<p>Bir mağazada 1 haftalık alışverişler: A = <b>kart ile ödedi</b>, B = <b>indirimli ürün aldı</b>. İndirimli ürün alan bir müşterinin kartla ödeme olasılığı nedir?</p>',
        g: V.tablo(['', 'İndirimli', 'İndirimsiz', 'Toplam'], [['Kart', String(n.ab), String(n.aB), String(n.ab + n.aB)], ['Nakit', String(n.Ab), String(n.AB), String(n.Ab + n.AB)], ['<b>Toplam</b>', String(gB), String(n.aB + n.AB), String(n.ab + n.aB + n.Ab + n.AB)]], { n: [1, 2, 3], st: 0 }),
        adim: [{ t: 'Koşul “indirimli”: yeni evrende kaç müşteri var?', say: gB, goster: String(gB), tol: 0.5, yanlis: function (v) { return Math.abs(v - (n.ab + n.aB)) < 0.5 ? 'Bu kartla ödeyenlerin toplamı; koşul “indirimli ürün”.' : ''; } },
          { t: 'Bunların kaçı kartla ödedi?', say: n.ab, goster: String(n.ab), tol: 0.5 },
          { t: 'P(kart | indirimli) = ? (dört ondalık)', say: n.ab / gB, goster: r4(n.ab / gB), tol: 0.0006 }] };
    }
  ];
  var R11 = [
    function (r) {
      var n = r.int(4, 6), p = r.pick([0.6, 0.7, 0.8]), q = Math.round((1 - p) * 10) / 10, k = r.int(1, n - 1), c = M.C(n, k), tek = Math.pow(q, k) * Math.pow(p, n - k);
      return { q: '<p>Basketbolcunun isabet oranı <b>%' + Math.round(p * 100) + '</b>. <b>' + n + '</b> atışta <b>tam ' + k + '</b> kaçırma olasılığı nedir?</p>',
        adim: [{ t: 'Kaçırma olasılığı q = ?', say: q, goster: nf(q, 1), tol: 0.005, yanlis: function (v) { return Math.abs(v - p) < 0.005 ? 'Bu isabet olasılığı; kaçırma 1 − p.' : ''; } },
          { t: 'Kaç farklı dizilim var? C(' + n + ', ' + k + ') = ?', say: c, goster: String(c), tol: 0.5 },
          { t: 'Tek bir dizilimin olasılığı q^' + k + '·p^' + (n - k) + ' = ? (dört ondalık)', say: tek, goster: r4(tek), tol: 0.0006 },
          { t: 'P(X = ' + k + ') = ? (dört ondalık)', say: c * tek, goster: r4(c * tek), tol: 0.0006, yanlis: function (v) { return Math.abs(v - tek) < 0.0006 ? 'Dizilim sayısıyla çarpmayı unuttun.' : ''; } }] };
    },
    function (r) {
      var n = r.int(5, 10), p = r.pick([0.1, 0.15, 0.2]), p0 = Math.pow(1 - p, n);
      return { q: '<p>Bir kargo firmasında paket gecikme oranı <b>%' + Math.round(p * 100) + '</b>. Bugün <b>' + n + '</b> paket gönderdin. <b>En az birinin</b> gecikme olasılığı nedir?</p>',
        adim: [{ t: '“En az bir”in tümleyeni hangi olay? Hiç gecikmeme olasılığı P(X = 0) = ? (dört ondalık)', say: p0, goster: r4(p0), tol: 0.0006, yanlis: function (v) { return Math.abs(v - Math.pow(p, n)) < 0.0006 ? 'Bu hepsinin gecikmesi; “hiç gecikmeme” için (1 − p)^n.' : ''; } },
          { t: 'P(X ≥ 1) = 1 − P(X = 0) = ? (dört ondalık)', say: 1 - p0, goster: r4(1 - p0), tol: 0.0006, yanlis: function (v) { return Math.abs(v - n * p) < 0.006 ? 'Olasılıkları topladın; tümleyeni kullan.' : ''; } }] };
    }
  ];
  if (g7) g7.rehber = R7;
  if (g11) g11.rehber = R11;
  var BAS = ['1. basamak · çözülmüş örnek', '2. basamak · son adım sende', '3. basamak · son iki adım sende', '4. basamak · hepsi sende'];
  IST.rehber = function (H, kok) {
    if (!H.rehber || !kok) return;
    var b = 0, seed = (Date.now() / 1000 | 0) + Math.floor(Math.random() * 1e4);
    kok.innerHTML = '<details class="rh"><summary><b>Rehberli seri</b> <span>önce çözülmüş örnek, sonra yardım azalır; 4 basamakta kendi başına çözersin</span></summary><div data-rh></div></details>';
    var kutu = kok.querySelector('[data-rh]');
    var ciz = function () {
      var r = IST.rng(seed + b * 101), T = H.rehber[b % H.rehber.length](r), n = T.adim.length, acik = b === 0 ? n : b === 1 ? n - 1 : b === 2 ? Math.max(0, n - 2) : 0;
      kutu.innerHTML = '<div class="rh-ust"><ol class="rh-bas">' + BAS.map(function (t, i) { return '<li class="' + (i < b ? 'ok' : i === b ? 'on' : '') + '">' + t + '</li>'; }).join('') + '</ol></div>' +
        '<div class="rh-q">' + T.q + (T.g ? '<div class="fig">' + T.g + '</div>' : '') + '</div><ol class="rh-ad">' +
        T.adim.map(function (a, i) {
          return '<li data-i="' + i + '"><span class="rh-t">' + a.t + '</span>' + (i < acik ? '<span class="rh-c">= <b>' + a.goster + '</b></span>' :
            '<span class="rh-g"><label class="vh" for="rh' + b + '_' + i + '">cevap</label><input id="rh' + b + '_' + i + '" inputmode="decimal" autocomplete="off" placeholder="?"><button type="button" class="btn sm" data-k="' + i + '">kontrol</button></span><span class="rh-fb" aria-live="polite"></span>');
        }).join('') + '</ol><div class="rh-alt">' + (b === 0 ? '<p>Örneği satır satır oku: her adım bir önceki sayıyı kullanıyor.</p>' : '') +
        '<button type="button" class="btn sm pri" data-ileri' + (acik === n ? '' : ' disabled') + '>' + (b >= 3 ? 'seriyi bitir ✓' : b === 0 ? 'anladım, sıradaki →' : 'sıradaki basamak →') + '</button></div>';
      var deneme = {};
      var kalan = function () { return [].filter.call(kutu.querySelectorAll('.rh-g input'), function (x) { return !x.disabled; }).length; };
      kutu.querySelectorAll('[data-k]').forEach(function (btn) {
        var i = +btn.getAttribute('data-k'), a = T.adim[i], inp = btn.previousElementSibling, fb = btn.closest('li').querySelector('.rh-fb');
        var kontrol = function () {
          var v = IST.parse(inp.value); if (isNaN(v)) { fb.textContent = 'Bir sayı yaz.'; return; }
          var tol = a.tol != null ? a.tol : Math.max(Math.abs(a.say) * 0.005, 0.0051);
          if (Math.abs(v - a.say) <= tol) { inp.disabled = true; btn.disabled = true; inp.classList.add('ok'); fb.innerHTML = '<b style="color:var(--ok)">✓</b>'; if (!kalan()) kutu.querySelector('[data-ileri]').disabled = false; return; }
          deneme[i] = (deneme[i] || 0) + 1; inp.classList.add('no');
          var y = a.yanlis ? a.yanlis(v) : '';
          fb.innerHTML = '<b style="color:var(--bad)">Tam değil.</b> ' + (y || 'Önceki adımın sayısını kullan.') + (deneme[i] >= 2 ? ' <button type="button" class="btn sm ghost" data-gos>cevabı göster</button>' : '');
          var g = fb.querySelector('[data-gos]'); if (g) g.onclick = function () { inp.value = a.goster; inp.disabled = true; btn.disabled = true; fb.innerHTML = 'Cevap: <b>' + a.goster + '</b>. Bu basamağı bir daha dene.'; if (!kalan()) { var il = kutu.querySelector('[data-ileri]'); il.disabled = false; il.textContent = 'bu basamağı yeni sayılarla tekrarla ↻'; il.setAttribute('data-tekrar', '1'); } };
        };
        btn.onclick = kontrol; inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') kontrol(); if (inp.classList.contains('no')) inp.classList.remove('no'); });
      });
      kutu.querySelector('[data-ileri]').onclick = function () {
        if (this.getAttribute('data-tekrar')) { seed++; ciz(); return; }
        if (b >= 3) { kutu.innerHTML = '<div class="rh-bitti">🎉 <b>Seriyi bitirdin.</b> Artık aynı tür soruyu tek başına çözebiliyorsun. Aşağıdaki yeni nesil sorularla dene.</div><button type="button" class="btn sm" data-bas>seriyi baştan al</button>'; kutu.querySelector('[data-bas]').onclick = function () { b = 0; seed += 7; ciz(); }; return; }
        b++; seed += 13; ciz();
        var ilk = kutu.querySelector('.rh-g input'); if (ilk) ilk.focus();
      };
    };
    ciz();
  };
  IST.EK_OLASILIK = { dogalAgac: dogalAgac, vennSvg: vennSvg, agacSvg: agacSvg, yollar: yollar, g7Yeni: g7Yeni, g11Yeni: g11Yeni, R7: R7, R11: R11 };
})();
