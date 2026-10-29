/* ==========================================================================
   ACADEX FİNANS · FİNANSAL TABLO ANALİZİ (labs/finans/fn-analiz.js), 29.10.2026
   Üç kurgusal şirket (milyon TL). Bilanço iki sütun (aktif = pasif) canlı
   istif; oran tablosu (likidite, kaldıraç, faaliyet, kârlılık) en iyi/en kötü
   işaretli; DuPont ağacı; veriden üretilen 4 soruluk analiz sınavı.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, pct = C.pct;
  var F = V.FIRMA;
  var S = C.ls.get('an', null) || { f: 'kiyi', q: null };
  var save = function () { C.ls.set('an', S); };
  var sec;

  var ratios = function (f) {
    var akt = f.hz + f.ala + f.sto + f.dv, don = f.hz + f.ala + f.sto, yk = f.kv + f.uv, fvok = f.sat - f.smm - f.fg, net = f.sat - f.smm - f.fg - f.faiz - f.vergi;
    return { akt: akt, net: net, fvok: fvok, cari: don / f.kv, asit: (f.hz + f.ala) / f.kv, nakit: f.hz / f.kv, borcoz: yk / f.oz, kald: yk / akt, faizk: fvok / f.faiz,
      brut: (f.sat - f.smm) / f.sat, marj: net / f.sat, devir: f.sat / akt, stok: f.smm / f.sto, roa: net / akt, roe: net / f.oz, carp: akt / f.oz };
  };
  /* [anahtar, ad, grup, biçim, büyük iyi mi, açıklama] */
  var R = [
    ['cari', 'Cari oran', 'likidite', 'x', 1, 'dönen varlıklar / KVYK'], ['asit', 'Asit-test oranı', 'likidite', 'x', 1, '(hazır değerler + alacaklar) / KVYK'], ['nakit', 'Nakit oranı', 'likidite', 'x', 1, 'hazır değerler / KVYK'],
    ['borcoz', 'Borç / özkaynak', 'finansal yapı', 'x', 0, 'toplam yabancı kaynak / özkaynak'], ['kald', 'Kaldıraç oranı', 'finansal yapı', '%', 0, 'yabancı kaynak / aktif'], ['faizk', 'Faiz karşılama', 'finansal yapı', 'x', 1, 'FVÖK / faiz gideri'],
    ['devir', 'Aktif devir hızı', 'faaliyet', 'x', 1, 'net satışlar / aktif'], ['stok', 'Stok devir hızı', 'faaliyet', 'x', 1, 'SMM / stoklar'],
    ['brut', 'Brüt kâr marjı', 'kârlılık', '%', 1, '(satış − SMM) / satış'], ['marj', 'Net kâr marjı', 'kârlılık', '%', 1, 'net kâr / satış'], ['roa', 'Aktif kârlılığı (ROA)', 'kârlılık', '%', 1, 'net kâr / aktif'], ['roe', 'Özkaynak kârlılığı (ROE)', 'kârlılık', '%', 1, 'net kâr / özkaynak']
  ];
  var fmt = function (v, t) { return t === '%' ? pct(v, 1) : nf(v, 2); };
  var RT = {}; F.forEach(function (f) { RT[f.k] = ratios(f); });
  var cur = function () { return F.filter(function (f) { return f.k === S.f; })[0] || F[0]; };
  /* veriden üretilen sorular: [soru, oran, büyük mü kazanır, açıklama] */
  var QS = [
    ['Kısa vadeli borçlarını stok satmadan ödemekte en çok zorlanacak şirket hangisi?', 'asit', 0, 'Asit-test oranı stokları dışarıda bırakır; en düşük olan, stok satmadan borç ödemekte en zorlanandır.'],
    ['Finansal riski (borçla finansman) en yüksek şirket hangisi?', 'borcoz', 1, 'Borç/özkaynak oranı en yüksek olan şirket, varlıklarını en çok borçla finanse ediyor.'],
    ['Varlıklarını satış üretmekte en verimli kullanan şirket hangisi?', 'devir', 1, 'Aktif devir hızı, her lira varlık başına kaç liralık satış yapıldığını gösterir.'],
    ['Ortaklarına sermayesi başına en çok kâr kazandıran şirket hangisi?', 'roe', 1, 'ROE = net kâr / özkaynak. DuPont’a göre marj, devir hızı ve kaldıraç çarpımıdır.']
  ];
  var winner = function (key, big) { return F.slice().sort(function (a, b) { return big ? RT[b.k][key] - RT[a.k][key] : RT[a.k][key] - RT[b.k][key]; })[0].k; };
  FN.analiz = { ratios: ratios, winner: winner, QS: QS };

  var html = function () {
    return '<div class="grid">' +
      '<div class="card box" style="--cc:var(--plum)"><span class="k">istasyon · tablo analizi · milyon TL · kurgusal</span><h2>Üç şirket, aynı liman: kim sağlam, kim riskli?</h2><p class="sub">Şirket seç; bilançosu iki sütun hâlinde istiflenir. Oran tablosu üçünü yan yana karşılaştırır.</p>' +
      '<div class="firms" data-firms>' + F.map(function (f) { return '<button type="button" data-f="' + f.k + '" style="--fc:' + f.renk + '"><i></i><span>' + X(f.ad) + '<small style="display:block;font-weight:500;color:var(--muted);font-size:11.5px">' + X(f.sek) + '</small></span></button>'; }).join('') + '</div>' +
      '<div class="grid g2" style="margin-top:16px"><div><h3>Bilanço istifi</h3><div data-bil></div></div><div><h3>Gelir tablosu</h3><div data-gt></div></div></div></div>' +
      '<div class="grid g2"><div class="card box" style="--cc:var(--sea)"><span class="k">karşılaştırma</span><h3>Oranlar</h3><div class="rat" data-rat></div><p class="sub" style="margin-top:8px">Yeşil en iyi, kırmızı en zayıf değer. Oranlar tek başına değil, sektör ve geçmiş yıllarla birlikte yorumlanır.</p></div>' +
      '<div class="card box" style="--cc:var(--must)"><span class="k">DuPont</span><h3>ROE’yi parçalarına ayır</h3><div data-dup></div><div data-dtip></div></div></div>' +
      '<div class="card box" style="--cc:var(--green)"><span class="k">sına kendini</span><h3>Analist masası</h3><div data-q></div></div></div>';
  };
  var paintBil = function () {
    var f = cur(), r = RT[f.k], H = 230, sc = H / r.akt;
    $$('[data-firms] button', sec).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === f.k)); });
    var stack = function (x, parts) { var y = 250, g = ''; parts.forEach(function (p) { var h = p[1] * sc; y -= h; g += '<g><rect x="' + x + '" y="' + y.toFixed(1) + '" width="150" height="' + Math.max(0, h - 2).toFixed(1) + '" rx="3" fill="' + p[2] + '" style="transition:all .6s cubic-bezier(.2,.8,.2,1)"/>' + (h > 18 ? '<text x="' + (x + 8) + '" y="' + (y + 15).toFixed(1) + '" font-size="12" font-weight="700" fill="#fff">' + X(p[0]) + ' ' + nf(p[1]) + '</text>' : '') + '</g>'; }); return g; };
    var g = '<svg viewBox="0 0 360 290" style="display:block;width:100%;max-width:420px;height:auto" role="img" aria-label="bilanço istifi">' +
      stack(10, [['Duran varlıklar', f.dv, '#46506A'], ['Stoklar', f.sto, '#E0A526'], ['Alacaklar', f.ala, '#2F6FB0'], ['Hazır değerler', f.hz, '#1F8A7A']]) +
      stack(200, [['Özkaynak', f.oz, '#3E8E5B'], ['UVYK', f.uv, '#B84A6B'], ['KVYK', f.kv, '#C8553D']]) +
      '<text x="85" y="275" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#6A7593">AKTİF ' + nf(r.akt) + '</text><text x="275" y="275" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#6A7593">PASİF ' + nf(f.kv + f.uv + f.oz) + '</text></svg>';
    $('[data-bil]', sec).innerHTML = g;
    $('[data-gt]', sec).innerHTML = '<div class="bil" style="grid-template-columns:1fr"><div>' +
      '<div class="r"><span>Net satışlar</span><b>' + nf(f.sat) + '</b></div><div class="r"><span>Satışların maliyeti</span><b>(' + nf(f.smm) + ')</b></div><div class="r t"><span>Brüt kâr</span><b>' + nf(f.sat - f.smm) + '</b></div>' +
      '<div class="r"><span>Faaliyet giderleri</span><b>(' + nf(f.fg) + ')</b></div><div class="r t"><span>FVÖK</span><b>' + nf(r.fvok) + '</b></div><div class="r"><span>Faiz gideri</span><b>(' + nf(f.faiz) + ')</b></div><div class="r"><span>Vergi</span><b>(' + nf(f.vergi) + ')</b></div><div class="r t"><span>Net kâr</span><b>' + nf(r.net) + '</b></div></div></div>';
    paintDup();
  };
  var paintRat = function () {
    var h = '<div class="h">Oran</div>' + F.map(function (f) { return '<div class="h v" style="color:' + f.renk + '">' + X(f.ad.split(' ')[0]) + '</div>'; }).join('');
    var grp = '';
    R.forEach(function (r) {
      var vals = F.map(function (f) { return RT[f.k][r[0]]; }), best = r[4] ? Math.max.apply(null, vals) : Math.min.apply(null, vals), worst = r[4] ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
      if (r[2] !== grp) { grp = r[2]; h += '<div class="h" style="grid-column:1/-1;background:#fff;color:var(--muted);font-family:JetBrains Mono,monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase">' + grp + '</div>'; }
      h += '<div>' + X(r[1]) + '<small>' + X(r[5]) + '</small></div>' + vals.map(function (v) { return '<div class="v' + (v === best ? ' best' : v === worst ? ' worst' : '') + '">' + fmt(v, r[3]) + '</div>'; }).join('');
    });
    $('[data-rat]', sec).innerHTML = h;
  };
  var paintDup = function () {
    var f = cur(), r = RT[f.k], mx = { marj: 0.14, devir: 1.8, carp: 4.5, roe: 0.26 };
    var node = function (x, y, w, t, v, k, c) { var bw = Math.min(1, (k === 'roe' ? r.roe : r[k]) / mx[k]) * (w - 20); return '<g class="nd"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="66" rx="10" fill="#fff" stroke="#0D1838" stroke-width="2"/><text x="' + (x + 10) + '" y="' + (y + 20) + '" font-size="11.5" font-weight="700" fill="#46506A">' + X(t) + '</text><text x="' + (x + 10) + '" y="' + (y + 42) + '" font-size="18" font-weight="800" fill="#0D1838" font-family="Bricolage Grotesque,sans-serif">' + v + '</text><rect x="' + (x + 10) + '" y="' + (y + 50) + '" width="' + (w - 20) + '" height="6" rx="3" fill="#E6ECF2"/><rect class="bar2" x="' + (x + 10) + '" y="' + (y + 50) + '" width="' + bw.toFixed(1) + '" height="6" rx="3" fill="' + c + '"/></g>'; };
    var g = '<svg class="dup" viewBox="0 0 560 220" role="img" aria-label="DuPont ağacı"><path d="M280 76V100M93 100H467M93 100V124M280 100V124M467 100V124" stroke="#0D1838" stroke-width="2" fill="none"/>' +
      node(190, 10, 180, 'ROE (özkaynak kârlılığı)', pct(r.roe, 1), 'roe', f.renk) +
      node(8, 124, 170, 'Net kâr marjı', pct(r.marj, 1), 'marj', '#C8553D') + '<text x="186" y="164" font-size="20" font-weight="800" fill="#6A7593">×</text>' +
      node(195, 124, 170, 'Aktif devir hızı', nf(r.devir, 2) + ' kez', 'devir', '#2F6FB0') + '<text x="373" y="164" font-size="20" font-weight="800" fill="#6A7593">×</text>' +
      node(382, 124, 170, 'Özkaynak çarpanı', nf(r.carp, 2) + ' kat', 'carp', '#B84A6B') + '</svg>';
    $('[data-dup]', sec).innerHTML = g;
    var drv = [['marj', r.marj / 0.08], ['devir', r.devir / 1.1], ['carp', r.carp / 2.2]].sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var nm = { marj: 'yüksek kâr marjı', devir: 'hızlı aktif devri', carp: 'borçla büyütülmüş özkaynak (kaldıraç)' };
    $('[data-dtip]', sec).innerHTML = C.tip(X(f.ad) + ': ' + pct(r.marj, 1) + ' × ' + nf(r.devir, 2) + ' × ' + nf(r.carp, 2) + ' = <b>' + pct(r.roe, 1) + '</b>. ROE’yi en çok <b>' + nm[drv] + '</b> taşıyor.' + (drv === 'carp' ? ' Kaldıraçla gelen ROE, kârlar düşünce aynı hızla erir.' : ''), 'ROE');
  };
  var paintQ = function () {
    var Q = S.q, box = $('[data-q]', sec);
    if (!Q) { box.innerHTML = '<p class="sub">Dört analist sorusu. Cevabı oran tablosundan bul.</p><button type="button" class="btn pri" data-qs>Başla</button>'; return; }
    if (Q.i >= QS.length) { var p = Q.ok / QS.length * 100; box.innerHTML = C.karne(p, 'Analist karnesi', [[Q.ok === QS.length, 'İlk denemede doğru: ' + Q.ok + ' / ' + QS.length]].concat(Q.miss.map(function (m) { return [false, X(m)]; })), 'Bir oranı tek başına değil, aynı grubun öbür oranlarıyla birlikte oku: düşük asit-test, yüksek borç/özkaynakla birleşince alarm verir.') + '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-qs>Yeniden çöz</button></div>'; return; }
    var q = QS[Q.i];
    box.innerHTML = '<div class="prog"><i style="width:' + (Q.i / QS.length * 100) + '%"></i></div><div class="q"><span class="k">soru ' + (Q.i + 1) + ' / ' + QS.length + '</span><p>' + X(q[0]) + '</p><div class="opts">' + F.map(function (f) { return '<button type="button" data-qa="' + f.k + '">' + X(f.ad.split(' ')[0]) + '</button>'; }).join('') + '</div><div class="fb" data-qfb></div></div>';
  };
  var answerQ = function (k, b) {
    var Q = S.q, q = QS[Q.i], w = winner(q[1], q[2]), fb = $('[data-qfb]', sec), lab = R.filter(function (r) { return r[0] === q[1]; })[0];
    if (k === w) {
      b.classList.add('ok'); $$('[data-qa]', sec).forEach(function (x) { x.disabled = true; });
      if (!Q.try) Q.ok++; else Q.miss.push(q[0]);
      fb.innerHTML = '<b style="color:var(--ok)">Doğru.</b> ' + X(q[3]) + ' ' + F.map(function (f) { return X(f.ad.split(' ')[0]) + ' ' + fmt(RT[f.k][q[1]], lab[3]); }).join(' · ');
      Q.i++; Q.try = 0; save(); setTimeout(paintQ, C.RM ? 200 : 2200);
    } else { Q.try++; save(); b.classList.add('no'); b.disabled = true; fb.innerHTML = '<b style="color:var(--bad)">Değil.</b> İpucu: ' + X(lab[1]) + ' satırına bak.'; }
    FN.bridgeSend();
  };

  FN.st.analiz = {
    init: function () {
      sec = $('#analiz'); sec.innerHTML = html(); paintBil(); paintRat(); paintQ();
      sec.addEventListener('click', function (e) {
        var b = e.target.closest('[data-f]'); if (b) { S.f = b.getAttribute('data-f'); save(); paintBil(); FN.bridgeSend(); return; }
        if (e.target.closest('[data-qs]')) { S.q = { i: 0, ok: 0, miss: [], try: 0 }; save(); paintQ(); FN.bridgeSend(); return; }
        var qa = e.target.closest('[data-qa]'); if (qa && !qa.disabled) answerQ(qa.getAttribute('data-qa'), qa);
      });
    },
    ctx: function () {
      var f = cur(), r = RT[f.k];
      return { sel: { key: 'finans.analiz.' + f.k, title: f.ad, la: 'Finansal tablo analizi',
          rows: [['Şirket', f.ad + ' (' + f.sek + ', kurgusal, milyon TL)'], ['Bilanço', 'aktif ' + nf(r.akt) + '; KVYK ' + f.kv + ', UVYK ' + f.uv + ', özkaynak ' + f.oz], ['Gelir', 'satış ' + f.sat + ', net kâr ' + nf(r.net)], ['Likidite', 'cari ' + nf(r.cari, 2) + ', asit-test ' + nf(r.asit, 2)], ['Yapı', 'borç/özkaynak ' + nf(r.borcoz, 2) + ', faiz karşılama ' + nf(r.faizk, 2)], ['DuPont', 'marj ' + pct(r.marj, 1) + ' × devir ' + nf(r.devir, 2) + ' × çarpan ' + nf(r.carp, 2) + ' = ROE ' + pct(r.roe, 1)]].concat(S.q && S.q.i < QS.length ? [['Sınav', 'analist sorusu çözülüyor: cevabı söyleme']] : []),
          about: 'öğrenci Acadex Finans tablo analizi istasyonunda üç kurgusal şirketin oranlarını karşılaştırıyor.' },
        chips: [['yorum', f.ad.split(' ')[0] + ' için kısa analist yorumu yaz'], ['dupont', 'DuPont analizi ne işe yarar?'], ['cari', 'Cari oran yüksekse her zaman iyi mi?']] };
    },
    classify: function (q) { if (/dupont/.test(q)) return 'dupont'; if (/cari/.test(q)) return 'cari'; if (/yorum/.test(q)) return 'yorum'; return null; },
    answer: function (k) {
      var f = cur(), r = RT[f.k];
      if (k === 'dupont') return 'DuPont analizi ROE’yi üç kaldıraca ayırır: kârlılık (net kâr marjı), verimlilik (aktif devir hızı) ve finansal kaldıraç (özkaynak çarpanı = aktif / özkaynak). Aynı ROE’ye çok farklı yollardan ulaşılabilir. ' + X(f.ad) + ' için ' + pct(r.marj, 1) + ' × ' + nf(r.devir, 2) + ' × ' + nf(r.carp, 2) + ' = ' + pct(r.roe, 1) + '. Kaldıraçtan gelen ROE daha risklidir.';
      if (k === 'cari') return 'Hayır. Çok düşük cari oran kısa vadeli borç ödemede sıkıntıya işaret eder, ama çok yüksek oran da atıl nakit, tahsil edilemeyen alacak ya da satılamayan stok anlamına gelebilir. Bu yüzden asit-test oranıyla birlikte okunur. Pamukova’nın cari oranı ' + nf(RT.pamuk.cari, 2) + ' iken asit-testi ' + nf(RT.pamuk.asit, 2) + ': likiditesi büyük ölçüde stoklarına bağlı.';
      if (k === 'yorum') { if (S.q && S.q.i < QS.length) return 'Analist sınavı sürüyor; önce soruları sen çöz, yorumu sonra birlikte yazarız.'; return null; }
      return null;
    }
  };
})();
