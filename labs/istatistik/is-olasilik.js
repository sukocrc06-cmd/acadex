/* ==========================================================================
   ACADEX İSTATİSTİK · 2. OLASILIK (labs/istatistik/is-olasilik.js), 03.11.2026
   İstatistik I, 5–7. hafta: deney, olay, göreli frekans, koşullu olasılık, Bayes, sayma.
     - büyük sayılar: para ya da zar at; göreli frekans gerçek olasılığa yaklaşır
     - olasılık ağacı: torbadan iki top, iadeli/iadesiz; dallar koşullu olasılık
     - Bayes: 1000 kişilik ızgarada tanı testi; P(hasta | pozitif) neden küçük kalır
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root, sub = 'bsy';
  /* ---------- büyük sayılar ---------- */
  var B = { kind: 'para', n: 0, hit: 0, path: [], faces: [0, 0, 0, 0, 0, 0], last: null, busy: false };
  var bsyReset = function () { B.n = 0; B.hit = 0; B.path = []; B.faces = [0, 0, 0, 0, 0, 0]; B.last = null; };
  var toss = function () {
    if (B.kind === 'para') { var t = Math.random() < 0.5; B.last = t ? 'T' : 'Y'; if (t) B.hit++; }
    else { var z = 1 + Math.floor(Math.random() * 6); B.faces[z - 1]++; B.last = z; if (z === 6) B.hit++; }
    B.n++; if (B.n <= 60 || B.n % Math.ceil(B.n / 300) === 0) B.path.push([B.n, B.hit / B.n]);
  };
  var bsyDraw = function () {
    var box = C.$('[data-bsy]', root), p0 = B.kind === 'para' ? 0.5 : 1 / 6, rf = B.n ? B.hit / B.n : 0;
    C.$('[data-bsy-fig]', root).innerHTML = B.kind === 'para'
      ? '<div class="ol-coin' + (B.last ? ' spin' : '') + '" data-face="' + (B.last || '') + '"><span>' + (B.last === 'Y' ? 'yazı' : 'tura') + '</span></div>'
      : '<div class="ol-die' + (B.last ? ' spin' : '') + '">' + (B.last ? '⚀⚁⚂⚃⚄⚅'.charAt(B.last - 1) : '⚅') + '</div>';
    C.$('[data-bsy-k]', root).innerHTML = '<div class="kpi"><small>atış</small><b>' + C.nf(B.n) + '</b></div><div class="kpi hl"><small>göreli frekans ' + (B.kind === 'para' ? 'P(tura)' : 'P(6)') + '</small><b>' + (B.n ? f(rf, 3) : '—') + '</b></div><div class="kpi"><small>gerçek olasılık</small><b>' + f(p0, 3) + '</b></div><div class="kpi"><small>fark</small><b>' + (B.n ? f(Math.abs(rf - p0), 3) : '—') + '</b></div>';
    var ch = C.chart({ w: 620, h: 230, y: [0, 1], x: [1, Math.max(10, B.n)], anim: false, al: 'göreli frekans', xl: 'atış sayısı', yl: 'göreli frekans', yf: function (v) { return f(v, 1); },
      hl: [{ y: p0, c: '#C8553D', lab: (B.kind === 'para' ? '1/2' : '1/6') }], s: B.path.length ? [{ p: B.path, c: '#2F6FB0', w: 2.2 }] : [] });
    if (B.kind === 'zar' && B.n) ch += C.chart({ w: 620, h: 170, y0: true, x: [0.5, 6.5], nb: 6, xticks: [1, 2, 3, 4, 5, 6], anim: false, al: 'yüzlerin frekansı', yl: 'göreli f', yf: function (v) { return f(v, 2); }, hl: [{ y: 1 / 6, c: '#C8553D', lab: '1/6' }],
      bars: B.faces.map(function (c, i) { return { x: i + 1, y0: 0, y1: c / B.n, c: i === 5 ? '#C8553D' : '#9DB8FF', lab: (i + 1) + ': ' + c }; }) });
    box.innerHTML = ch;
  };
  var bsyRun = function (k) {
    if (B.busy) return;
    if (k === 1 || C.RM) { for (var i = 0; i < k; i++) toss(); bsyDraw(); return; }
    B.busy = true; var left = k, per = Math.max(1, Math.ceil(k / 40));
    var step = function () { for (var j = 0; j < per && left > 0; j++, left--) toss(); bsyDraw(); if (left > 0) requestAnimationFrame(step); else { B.busy = false; FN.bridgeSend(); } };
    requestAnimationFrame(step);
  };
  /* ---------- olasılık ağacı ---------- */
  var T = { r: 3, b: 5, iade: false, q: 'ikisi' };
  var treeDraw = function () {
    var r = T.r, b = T.b, n = r + b, pr = r / n, pb = b / n;
    var prr = T.iade ? pr : (r - 1) / (n - 1), pbr = 1 - prr, prb = T.iade ? pr : r / (n - 1), pbb = 1 - prb;
    var leaves = [['KK', pr * prr], ['KM', pr * pbr], ['MK', pb * prb], ['MM', pb * pbb]];
    var want = { ikisi: ['KK'], enaz: ['KK', 'KM', 'MK'], farkli: ['KM', 'MK'], ikinci: ['KK', 'MK'] }[T.q];
    var tot = leaves.reduce(function (a, l) { return a + (want.indexOf(l[0]) > -1 ? l[1] : 0); }, 0);
    var br = function (x1, y1, x2, y2, p, on, col) { return '<path class="ol-br' + (on ? ' on' : '') + '" d="M' + x1 + ' ' + y1 + 'C' + (x1 + 60) + ' ' + y1 + ' ' + (x2 - 60) + ' ' + y2 + ' ' + x2 + ' ' + y2 + '" stroke="' + col + '"/><text class="ol-bp" x="' + ((x1 + x2) / 2) + '" y="' + ((y1 + y2) / 2 - 7) + '" text-anchor="middle">' + X(p) + '</text>'; };
    var fr = function (a, c) { return a + '/' + c; };
    var hit = function (k) { return want.indexOf(k) > -1; };
    var g = '<svg class="ol-tree" viewBox="0 0 640 300" role="img" aria-label="olasılık ağacı">';
    g += br(40, 150, 230, 75, fr(r, n), hit('KK') || hit('KM'), '#C8553D') + br(40, 150, 230, 225, fr(b, n), hit('MK') || hit('MM'), '#2F6FB0');
    g += br(240, 75, 440, 35, T.iade ? fr(r, n) : fr(r - 1, n - 1), hit('KK'), '#C8553D') + br(240, 75, 440, 115, T.iade ? fr(b, n) : fr(b, n - 1), hit('KM'), '#2F6FB0');
    g += br(240, 225, 440, 185, T.iade ? fr(r, n) : fr(r, n - 1), hit('MK'), '#C8553D') + br(240, 225, 440, 265, T.iade ? fr(b, n) : fr(b - 1, n - 1), hit('MM'), '#2F6FB0');
    g += '<circle cx="36" cy="150" r="9" fill="#0D1838"/><circle class="ol-n" cx="236" cy="75" r="10" fill="#C8553D"/><circle class="ol-n" cx="236" cy="225" r="10" fill="#2F6FB0"/>';
    [[35, 'KK'], [115, 'KM'], [185, 'MK'], [265, 'MM']].forEach(function (q, i) {
      var on = hit(q[1]); g += '<g class="ol-leaf' + (on ? ' on' : '') + '" style="--d:' + (i * 0.08) + 's"><rect x="448" y="' + (q[0] - 16) + '" width="180" height="32" rx="9"/><circle cx="466" cy="' + q[0] + '" r="7" fill="' + (q[1][0] === 'K' ? '#C8553D' : '#2F6FB0') + '"/><circle cx="484" cy="' + q[0] + '" r="7" fill="' + (q[1][1] === 'K' ? '#C8553D' : '#2F6FB0') + '"/><text x="500" y="' + (q[0] + 4) + '">' + f(leaves[i][1], 4) + '</text></g>';
    });
    g += '</svg>';
    C.$('[data-tree]', root).innerHTML = g;
    var ex = { ikisi: 'P(K₁ ∩ K₂) = P(K₁) · P(K₂ | K₁) = ' + fr(r, n) + ' · ' + (T.iade ? fr(r, n) : fr(r - 1, n - 1)), enaz: 'P(en az bir K) = 1 − P(MM) = 1 − ' + f(leaves[3][1], 4), farkli: 'P(farklı) = P(KM) + P(MK)', ikinci: 'P(K₂) = P(KK) + P(MK)  (toplam olasılık kuralı)' }[T.q];
    C.$('[data-tree-r]', root).innerHTML = '<div class="formula">' + X(ex) + ' = <b>' + f(tot, 4) + '</b></div>' +
      IS.tip(T.iade ? 'İadeli çekişte ikinci çekiliş birinciden <b>bağımsızdır</b>: dallar aynı kalır.' : 'İadesiz çekişte ikinci dal birinciye <b>bağlıdır</b>: kırmızı çıktıysa torbada bir kırmızı eksilir. Koşullu olasılık budur.', T.iade ? 'bağımsız' : 'P(B|A)');
  };
  /* ---------- Bayes ---------- */
  var Y = { prev: 2, sens: 95, spec: 90 };
  var bayesDraw = function () {
    var N = 1000, hasta = Math.round(N * Y.prev / 100), tp = Math.round(hasta * Y.sens / 100), fn = hasta - tp, saglam = N - hasta, fp = Math.round(saglam * (100 - Y.spec) / 100), tn = saglam - fp;
    var ppv = tp + fp ? tp / (tp + fp) : 0, s = '', cls = [];
    for (var i = 0; i < tp; i++) cls.push('tp'); for (i = 0; i < fn; i++) cls.push('fn'); for (i = 0; i < fp; i++) cls.push('fp'); for (i = 0; i < tn; i++) cls.push('tn');
    cls.forEach(function (c, k) { s += '<i class="' + c + '" style="--d:' + (k % 50 * 0.004 + Math.floor(k / 50) * 0.014).toFixed(3) + 's"></i>'; });
    C.$('[data-grid]', root).innerHTML = s;
    C.$('[data-bay]', root).innerHTML = '<div class="kpis"><div class="kpi"><small>hasta, test +</small><b style="color:#C8553D">' + tp + '</b></div><div class="kpi"><small>sağlam, test + (yanlış alarm)</small><b style="color:#B9821F">' + fp + '</b></div><div class="kpi"><small>hasta, test − (kaçan)</small><b>' + fn + '</b></div><div class="kpi"><small>sağlam, test −</small><b>' + tn + '</b></div></div>' +
      '<p class="lbl" style="margin:4px 0">Testi pozitif çıkan biri gerçekten hasta mı?</p><div class="big" style="color:#C8553D">%' + f(ppv * 100, 1) + '</div>' +
      '<div class="formula">P(H | +) = P(+ | H)·P(H) / P(+) = ' + tp + ' / (' + tp + ' + ' + fp + ') = <b>' + f(ppv, 3) + '</b></div>' +
      IS.tip(ppv < 0.5 ? 'Test %' + Y.sens + ' duyarlı olsa da hastalık nadir (%' + f(Y.prev, 1) + '). Pozitiflerin çoğu, kalabalık sağlam gruptan gelen yanlış alarmlar. Buna <b>taban oranı yanılgısı</b> denir.' : 'Hastalık yaygınlaştıkça ya da özgüllük arttıkça pozitif sonucun güvenilirliği yükselir.', 'Bayes');
  };

  var subDraw = function () {
    C.$$('[data-sub]', root).forEach(function (s) { s.hidden = s.getAttribute('data-sub') !== sub; });
    if (sub === 'bsy') bsyDraw(); else if (sub === 'agac') treeDraw(); else bayesDraw();
    FN.bridgeSend();
  };
  var sl = function (k, lab, min, max, st, val, unit) { return '<label class="sl"><span>' + lab + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + st + '" value="' + val + '" data-sl="' + k + '"><output data-o="' + k + '">' + val + unit + '</output></label>'; };

  var QS = [
    { q: 'Adil bir para 10 kez atıldı ve 7 tura geldi. 11. atışta tura olasılığı nedir?', o: ['0,5', '0,7', '0,3', 'tura gelme olasılığı düşer'], a: 0, n: 'Atışlar bağımsızdır; para geçmişi hatırlamaz. “Sıra yazıda” düşüncesi kumarbaz yanılgısıdır.' },
    { q: 'Torbada 3 kırmızı, 5 mavi top var. İadesiz iki top çekiliyor. P(ikisi de kırmızı)?', o: ['3/28', '9/64', '3/8', '6/56 + 1'], a: 0, n: '3/8 · 2/7 = 6/56 = 3/28.' },
    { q: 'P(A) = 0,4, P(B) = 0,5 ve A ile B bağımsız. P(A ∩ B)?', o: ['0,20', '0,90', '0,10', '0,45'], a: 0, n: 'Bağımsız olaylarda P(A ∩ B) = P(A)·P(B) = 0,2.' },
    { q: 'Nadir bir hastalık için çok iyi bir test pozitif çıktı. En doğru yorum hangisi?', o: ['Hasta olma olasılığı arttı ama yine de düşük olabilir', 'Kesinlikle hastadır', 'Olasılık testin duyarlılığına eşittir', 'Test sonucu bilgi vermez'], a: 0, n: 'P(H|+), duyarlılık değil; taban oranı (yaygınlık) da hesaba girer.' },
    { q: '10 kişilik sınıftan 3 kişilik bir komite (sırasız) kaç farklı şekilde seçilir?', o: ['120', '720', '30', '1000'], a: 0, n: 'C(10,3) = 10!/(3!·7!) = 120. Excel: =KOMBİNASYON(10;3).' }
  ];

  FN.st.olasilik = {
    init: function () {
      root = C.$('#olasilik');
      root.innerHTML = IS.head({ k: 'istasyon 2 · olasılık', title: 'Zar ve para atölyesi', sub: 'Az atışta göreli frekans zıplar; atış arttıkça gerçek olasılığa yerleşir (büyük sayılar yasası). Sonra koşullu olasılığı bir ağaçta, Bayes teoremini bin kişilik bir kalabalıkta gör.', weeks: ['İst I · 5. hafta: olasılık kavramı', '6. hafta: koşullu olasılık ve Bayes', '7. hafta: sayma (permütasyon, kombinasyon)'] }) +
        '<div class="seg" data-seg style="margin-bottom:14px"></div>' +
        '<div data-sub="bsy"><div class="grid gside"><div class="card box" style="--cc:#F4A7B9"><h2>Büyük sayılar</h2><div class="seg" data-kind></div><div class="ol-fig" data-bsy-fig></div>' +
        '<div class="row"><button type="button" class="btn sm pri" data-run="1">1 at</button><button type="button" class="btn sm" data-run="10">10</button><button type="button" class="btn sm" data-run="100">100</button><button type="button" class="btn sm" data-run="1000">1000</button><button type="button" class="btn sm" data-run="0">sıfırla</button></div><div class="kpis" data-bsy-k></div></div>' +
        '<div class="card box" style="--cc:#F4A7B9"><h2>Göreli frekans yolculuğu</h2><p class="sub">Mavi çizgi şimdiye kadarki oranı, kırmızı kesikli çizgi gerçek olasılığı gösterir.</p><div data-bsy></div></div></div></div>' +
        '<div data-sub="agac" hidden><div class="grid gside"><div class="card box" style="--cc:#F4A7B9"><h2>Torba</h2><p class="sub">Torbadan art arda iki top çek.</p>' + sl('r', 'kırmızı top', 1, 8, 1, T.r, '') + sl('b', 'mavi top', 1, 8, 1, T.b, '') +
        '<div class="seg" data-iade style="margin:6px 0"></div><p class="lbl" style="margin:10px 0 4px">Hangi olay?</p><div class="seg" data-q></div><div class="ol-urn" data-urn></div></div>' +
        '<div class="card box" style="--cc:#F4A7B9"><h2>Olasılık ağacı</h2><div data-tree></div><div data-tree-r></div></div></div></div>' +
        '<div data-sub="bayes" hidden><div class="grid gside"><div class="card box" style="--cc:#F4A7B9"><h2>Tanı testi</h2><p class="sub">Bin kişilik bir kasaba düşün.</p>' + sl('prev', 'yaygınlık P(H)', 0.1, 30, 0.1, Y.prev, '%') + sl('sens', 'duyarlılık P(+|H)', 50, 99.9, 0.1, Y.sens, '%') + sl('spec', 'özgüllük P(−|sağlam)', 50, 99.9, 0.1, Y.spec, '%') + '<div data-bay></div></div>' +
        '<div class="card box" style="--cc:#F4A7B9"><h2>1000 kişi</h2><div class="leg"><span><i style="background:#C8553D"></i>hasta, test +</span><span><i style="background:#F2C94C"></i>sağlam, test + (yanlış alarm)</span><span><i style="background:#fff;border:2px solid #C8553D"></i>hasta, test −</span><span><i style="background:#3A4C86"></i>sağlam, test −</span></div><div class="ol-grid" data-grid></div></div></div></div>' +
        '<div class="grid g2" style="margin-top:18px"><div>' + IS.quizCard() + '</div><div class="card box" style="--cc:#F4A7B9"><h2>Sayma ve simülasyon</h2><p class="sub">Permütasyonda sıra önemlidir, kombinasyonda önemli değildir.</p>' +
        IS.code({ x: [['=KOMBİNASYON(10;3)', 'C(10,3) = 120'], ['=PERMÜTASYON(10;3)', 'P(10,3) = 720'], ['=ÇARPINIM(5)', '5! = 120'], ['=RASTGELEARADA(1;6)', 'zar at'], ['=EĞER(S_SAYI_ÜRET()<0,5;"tura";"yazı")', 'para at']],
          r: [['choose(10, 3)', ''], ['factorial(10) / factorial(7)', 'P(10,3)'], ['zar <- sample(1:6, 1000, replace = TRUE)', ''], ['mean(zar == 6)', 'göreli frekans P(6)'], ['tp <- .95*.02; tp / (tp + .10*.98)', 'Bayes: P(H|+)']] }) + '</div></div>';
      var seg = C.$('[data-seg]', root);
      IS.seg(seg, [['bsy', 'Büyük sayılar'], ['agac', 'Olasılık ağacı'], ['bayes', 'Bayes · tanı testi']], sub, function (k) { sub = k; subDraw(); });
      IS.seg(C.$('[data-kind]', root), [['para', 'para'], ['zar', 'zar']], B.kind, function (k) { B.kind = k; bsyReset(); bsyDraw(); });
      C.$$('[data-run]', root).forEach(function (b) { b.onclick = function () { var k = +b.getAttribute('data-run'); if (!k) { bsyReset(); bsyDraw(); return; } bsyRun(k); }; });
      IS.seg(C.$('[data-iade]', root), [['0', 'iadesiz'], ['1', 'iadeli']], '0', function (k) { T.iade = k === '1'; treeDraw(); });
      IS.seg(C.$('[data-q]', root), [['ikisi', 'ikisi de kırmızı'], ['enaz', 'en az biri kırmızı'], ['farkli', 'farklı renk'], ['ikinci', 'ikinci kırmızı']], T.q, function (k) { T.q = k; treeDraw(); });
      var urn = function () { var s = ''; for (var i = 0; i < T.r; i++) s += '<i class="k"></i>'; for (i = 0; i < T.b; i++) s += '<i class="m"></i>'; C.$('[data-urn]', root).innerHTML = s; };
      C.$$('[data-sl]', root).forEach(function (el) {
        el.addEventListener('input', function () {
          var k = el.getAttribute('data-sl'), v = +el.value; C.$('[data-o="' + k + '"]', root).textContent = (k === 'r' || k === 'b') ? v : '%' + f(v, 1);
          if (k === 'r' || k === 'b') { T[k] = v; urn(); treeDraw(); } else { Y[k] = v; bayesDraw(); }
        });
      });
      urn(); subDraw();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Olasılık');
    },
    ctx: function () {
      if (sub === 'bayes') return IS.ctx('olasilik', 'Bayes', [['yaygınlık', '%' + Y.prev], ['duyarlılık', '%' + Y.sens], ['özgüllük', '%' + Y.spec]], 'öğrenci Bayes teoremini tanı testi örneğiyle çalışıyor.', ['Taban oranı yanılgısı nedir?', 'Duyarlılık ile özgüllük farkı']);
      if (sub === 'agac') return IS.ctx('olasilik', 'olasılık ağacı', [['kırmızı', T.r], ['mavi', T.b], ['çekiliş', T.iade ? 'iadeli' : 'iadesiz']], 'öğrenci koşullu olasılığı torbadan top çekme ağacıyla çalışıyor.', ['Bağımsız ve ayrık olay farkı nedir?', 'Toplam olasılık kuralı']);
      return IS.ctx('olasilik', 'büyük sayılar', [['deney', B.kind], ['atış', B.n], ['göreli frekans', B.n ? f(B.hit / B.n, 3) : '—']], 'öğrenci büyük sayılar yasasını para/zar atarak gözlüyor.', ['Kumarbaz yanılgısı nedir?', 'Göreli frekans ile olasılık aynı şey mi?']);
    }
  };
})();
