/* ==========================================================================
   ACADEX İSTATİSTİK · Bahar 1–4. haftalar (labs/istat/ist-h5.js), 12.11.2026
   Statistics for Business II: 1 Örnekleme yöntemleri · 2 Nokta tahmini ve örnekleme dağılımı
   3 Aralık tahmini · 4 Tek örneklem hipotez testi I
   Bahar dosyalarının ortak yardımcıları (V.norm, V.tc, IST.ttab, IST.c2tab) burada tanımlanır.
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;

  /* ---- ortak: dağılım eğrileri ve tablolar ---- */
  V.norm = function (o) { return V.curve({ f: function (x) { return M.npdf(x, o.m, o.s); }, a: o.a != null ? o.a : o.m - 4 * o.s, b: o.b != null ? o.b : o.m + 4 * o.s, ymax: M.npdf(o.m, o.m, o.s) * 1.15, sh: o.sh, xt: o.xt, h: o.h || 220, w: o.w, renk: o.renk, shc: o.shc, d: o.d, extra: o.extra }); };
  V.tc = function (o) { return V.curve({ f: function (x) { return M.tpdf(x, o.v); }, a: -4.5, b: 4.5, ymax: 0.45, sh: o.sh, xt: o.xt, h: o.h || 220, renk: o.renk || PAL[4], shc: o.shc || PAL[1], d: o.d, extra: o.extra }); };
  var red = function (a, tail) { return tail === 'iki' ? [[-9, -M.zinv(1 - a / 2)], [M.zinv(1 - a / 2), 9]] : tail === 'sag' ? [[M.zinv(1 - a), 9]] : [[-9, M.zinv(a)]]; };
  IST.redBolge = red;
  /* t tablosu: satır sd, sütun sağ kuyruk alanı */
  IST.ttab = function (dfs, hl) {
    var A = [0.10, 0.05, 0.025, 0.01, 0.005];
    return '<div style="overflow-x:auto">' + V.tablo(['sd'].concat(A.map(function (a) { return 't<sub>' + nf(a, 3) + '</sub>'; })), dfs.map(function (v) { return ['<b>' + v + '</b>'].concat(A.map(function (a) { return nf(M.tkr(a, v), 3, false); })); }), { n: [1, 2, 3, 4, 5], st: 0, hi: hl || {}, cap: 't tablosu: sağ kuyrukta α alanını bırakan değer' }) + '</div>';
  };
  IST.c2tab = function (dfs, hl) {
    var A = [0.10, 0.05, 0.025, 0.01];
    return '<div style="overflow-x:auto">' + V.tablo(['sd'].concat(A.map(function (a) { return 'χ²<sub>' + nf(a, 3) + '</sub>'; })), dfs.map(function (v) { return ['<b>' + v + '</b>'].concat(A.map(function (a) { return nf(M.c2kr(a, v), 3, false); })); }), { n: [1, 2, 3, 4], st: 0, hi: hl || {}, cap: 'ki-kare tablosu: sağ kuyruk alanı' }) + '</div>';
  };

  /* ======================= BAHAR 1 ======================= */
  var BOL = [['Marmara', 80, PAL[0]], ['İç Anadolu', 60, PAL[2]], ['Ege', 40, PAL[3]], ['Karadeniz', 20, PAL[1]]];
  IST.hafta({
    id: 'b1', no: 1, renk: '#0D5C8C', tr: 'Örnekleme yöntemleri', en: 'Sampling Methods',
    sahneler: [
      {
        b: 'Neden sayım değil de örneklem?', terim: [['sayım', 'census'], ['örneklem', 'sample'], ['hedef anakütle', 'target population']],
        t: '<p>İyi bir örneklem, anakütleyi <b>temsil eder</b>. Sayım (census) anakütlenin tamamını inceler; ama çoğu zaman örneklem daha akıllıcadır:</p><ul><li><b>Maliyet:</b> ülkedeki tüm üniversite öğrencilerine ulaşmak çok pahalıdır.</li><li><b>Zaman:</b> 20 milyon aileye ulaşmak yerine rastgele aileler hızlı bilgi verir.</li><li><b>Doğruluk:</b> küçük veri setinde kayıt ve kopyalama hataları daha kolay kontrol edilir.</li><li><b>Sonsuz ya da yıkıcı anakütle:</b> bir gölün pH’ını ölçmek için gölün tamamını alamayız.</li></ul>',
        v: function () { return V.kart([{ ic: '💰', b: 'Maliyet', en: 'cost' }, { ic: '⏱️', b: 'Zaman', en: 'timeliness' }, { ic: '🎯', b: 'Doğruluk', en: 'accuracy' }, { ic: '🌊', b: 'Sonsuz anakütle', en: 'infinite population' }]); }
      },
      {
        b: 'Temsili örneklem', terim: [['temsili örneklem', 'representative sample']],
        t: '<p>Bir fabrikada 10.000 işçi var: %70’i erkek, %15’i 56 yaşın üstünde. 200 kişilik bir örneklem anakütlenin bu dengesini yansıtmalı.</p><p>Yaklaşık <b>140 erkek</b> (200 × 0,70) ve <b>30 kişi 56 yaş üstü</b> (200 × 0,15) beklenir. Örneklemin değeri, sonuçların genelleneceği hedef anakütleyi ne kadar iyi temsil ettiğine bağlıdır.</p>',
        v: function () {
          var s = '', xs = V.sc(0, 100, 150, 520);
          [['Anakütle (10.000)', 70, 15], ['Örneklem (200)', 70, 15]].forEach(function (r, i) {
            var y = 40 + i * 110; s += '<text class="lbb" x="10" y="' + (y + 22) + '">' + r[0] + '</text>';
            s += '<rect class="gx" ' + d(i * 0.6) + ' x="150" y="' + y + '" width="' + (xs(r[1]) - 150) + '" height="30" fill="' + PAL[0] + '" stroke="#0D1838"/><rect class="gx" ' + d(i * 0.6 + 0.2) + ' x="' + xs(r[1]) + '" y="' + y + '" width="' + (xs(100) - xs(r[1])) + '" height="30" fill="' + PAL[5] + '" stroke="#0D1838"/>';
            s += '<text class="lbm fd" ' + d(i * 0.6 + 0.5) + ' x="' + ((150 + xs(r[1])) / 2) + '" y="' + (y + 20) + '" text-anchor="middle" style="fill:#fff">erkek %70' + (i ? ' → 140' : '') + '</text>';
            s += '<rect class="gx" ' + d(i * 0.6 + 0.4) + ' x="150" y="' + (y + 40) + '" width="' + (xs(r[2]) - 150) + '" height="22" fill="' + PAL[3] + '" stroke="#0D1838"/><text class="lbm fd" ' + d(i * 0.6 + 0.7) + ' x="' + (xs(r[2]) + 6) + '" y="' + (y + 56) + '">56+ yaş %15' + (i ? ' → 30' : '') + '</text>';
          });
          return V.svg(540, 260, s, 'anakütle ve örneklemde oranlar');
        }
      },
      {
        b: 'Basit rastgele örnekleme', terim: [['basit rastgele örnekleme', 'simple random sampling']],
        t: '<p>Belirli büyüklükteki <b>her olası örneklemin seçilme olasılığı eşittir</b>.</p><p>Beş şehirden (A, B, C, D, E) iki şehir seçilecekse C(5, 2) = <b>10</b> farklı örneklem vardır; her birinin seçilme olasılığı <b>0,10</b> olmalıdır. Pratikte elemanlar tek tek, yerine koymadan seçilir.</p>',
        v: function () {
          var s = '', ad = 'ABCDE', k = 0;
          for (var i = 0; i < 5; i++) for (var j = i + 1; j < 5; j++) { var x = 20 + (k % 5) * 104, y = 30 + Math.floor(k / 5) * 86; s += '<g class="pop" ' + d(k * 0.1) + '><rect x="' + x + '" y="' + y + '" width="94" height="64" rx="12" fill="#fff" stroke="#0D1838" stroke-width="2"/><text x="' + (x + 47) + '" y="' + (y + 30) + '" text-anchor="middle" font-weight="800" font-size="18">' + ad[i] + ' · ' + ad[j] + '</text><text class="lbm" x="' + (x + 47) + '" y="' + (y + 50) + '" text-anchor="middle">P = 0,10</text></g>'; k++; }
          return V.svg(540, 210, s, '10 olası örneklem');
        }
      },
      {
        b: 'Rastgele sayı tablosuyla seçim', terim: [['rastgele sayılar tablosu', 'table of random digits'], ['çerçeve', 'sampling frame']],
        t: '<p>Fabrikada 750 işçiye 001–750 arası numara verildi; 10 işçi seçilecek. Çerçevede en büyük numara 750 olduğundan <b>üç basamaklı</b> sayılar okunur.</p><p>Tablonun bir sütunundan aşağı doğru okunur: <b>919</b> → 750’den büyük, atla. <b>364</b> → seç. <b>115</b> → seç… Tekrar eden numara ve 000 da atlanır.</p>',
        v: function () {
          var L = [919, 364, 115, 781, 642, 364, 87, 990, 503], s = '', sec = 0;
          L.forEach(function (n, i) {
            var ok = n <= 750 && n > 0 && L.indexOf(n) === i, y = 20 + i * 27; if (ok) sec++;
            s += '<g class="an" ' + d(i * 0.3) + '><rect x="30" y="' + y + '" width="80" height="22" rx="5" fill="#fff" stroke="#0D1838"/><text class="lbm" x="70" y="' + (y + 16) + '" text-anchor="middle" font-weight="700">' + (n < 100 ? '0' : '') + n + '</text>';
            s += '<text class="lbb" x="124" y="' + (y + 16) + '" style="fill:' + (ok ? PAL[6] : PAL[1]) + '">' + (ok ? '✓ seçildi (' + sec + '. işçi)' : n > 750 ? '✗ 750’den büyük' : '✗ tekrar') + '</text></g>';
          });
          return V.svg(400, 270, s, 'rastgele sayılarla seçim');
        }
      },
      {
        b: 'Sistematik, tabakalı ve küme örnekleme', terim: [['sistematik', 'systematic'], ['tabakalı', 'stratified'], ['küme', 'cluster']],
        t: '<ul><li><b>Sistematik:</b> k = N / n; ilk k eleman içinden rastgele bir başlangıç seçilir, sonra her k’ıncı eleman alınır.</li><li><b>Tabakalı:</b> anakütle iç yapısı benzer tabakalara (bölge, yaş grubu) ayrılır; her tabakadan (genellikle büyüklüğüyle orantılı) rastgele örneklem çekilir: n<sub>h</sub> = n · N<sub>h</sub> / N.</li><li><b>Küme:</b> anakütle kümelere (mahalle, okul) ayrılır; rastgele kümeler seçilir ve seçilen kümelerin tamamı incelenir. Yoksulluk araştırmasında kümeler coğrafi bölgelerdi.</li></ul>',
        v: function () {
          var g = function (x0, f, lab, dd) { var s = '<text class="lbb" x="' + (x0 + 70) + '" y="16" text-anchor="middle">' + lab + '</text>'; for (var i = 0; i < 48; i++) { var c = i % 6, rr = Math.floor(i / 6), on = f(i, c, rr); s += '<rect class="' + (on ? 'pop' : '') + '" ' + d(dd + i * 0.015) + ' x="' + (x0 + c * 24) + '" y="' + (26 + rr * 24) + '" width="20" height="20" rx="4" fill="' + (on ? PAL[1] : rr < 4 ? '#DDEBFA' : rr < 6 ? '#E3F4EA' : '#FFF1C2') + '" stroke="#0D1838" stroke-width=".8"/>'; } return s; };
          return V.svg(540, 230, g(10, function (i) { return (i - 2) % 6 === 0; }, 'sistematik (k = 6)', 0) + g(195, function (i, c, r) { return [1, 9, 20, 27, 37, 44].indexOf(i) >= 0; }, 'tabakalı (3 tabaka)', 0.6) + g(380, function (i, c) { return c === 1 || c === 4; }, 'küme (2 sütun)', 1.2), 'üç örnekleme yöntemi');
        }
      },
      {
        b: 'Olasılıksız yöntemler ve hatalar', terim: [['kolayda örnekleme', 'convenience sampling'], ['kota', 'quota'], ['kartopu', 'snowball'], ['yargısal', 'judgment'], ['örnekleme hatası', 'sampling error']],
        t: '<p>Olasılıksız yöntemlerde seçilme olasılıkları bilinmez: <b>kolayda</b> (ulaşması kolay olanlar), <b>kota</b> (gruplardan belirli sayıda), <b>kartopu</b> (katılımcılar yenilerini önerir), <b>yargısal</b> (uzman seçer). Hızlı ve ucuzdurlar, ama genelleme risklidir.</p><p><b>Örnekleme hatası</b> örneklem ile anakütle arasındaki rastlantısal farktır; n büyüdükçe küçülür. <b>Örnekleme dışı hatalar</b> (yanlış çerçeve, cevapsızlık, ölçme hatası) n büyüse de kaybolmaz.</p>',
        v: function () { return V.kart([{ ic: '🚶', b: 'Kolayda', en: 'convenience', p: 'AVM girişindeki ilk 50 kişi' }, { ic: '📊', b: 'Kota', en: 'quota', p: '30 kadın, 30 erkek' }, { ic: '❄️', b: 'Kartopu', en: 'snowball', p: 'Her katılımcı 2 kişi önerir' }, { ic: '🧑‍🏫', b: 'Yargısal', en: 'judgment', p: 'Uzman tipik mağazaları seçer' }]); }
      }
    ],
    gorsel: {
      b: 'Örnekleme yöntemi simülatörü', t: '200 müşterilik anakütle dört bölgeye (tabaka) ayrılmış; her sütun bir mahalle (küme). Bir yöntem seç, örneklem çek ve örneklemin bölge dağılımını anakütleyle karşılaştır.',
      kur: function (el) {
        var r0 = IST.rng(77), pop = [];
        for (var i = 0; i < 200; i++) { var row = Math.floor(i / 20), st = row < 4 ? 0 : row < 7 ? 1 : row < 9 ? 2 : 3; pop.push({ st: st, v: Math.round([620, 480, 540, 390][st] + (r0() - 0.5) * 160) }); }
        var mu = M.mean(pop.map(function (p) { return p.v; })), yon = 'basit', sec = [];
        el.innerHTML = '<div class="at-g"><div class="at-k"><div class="seg" data-y>' + [['basit', 'basit rastgele'], ['sis', 'sistematik'], ['tab', 'tabakalı'], ['kum', 'küme']].map(function (y) { return '<button type="button" data-k="' + y[0] + '" aria-pressed="' + (y[0] === yon) + '">' + y[1] + '</button>'; }).join('') + '</div><button type="button" class="btn sm pri" data-c>örneklem çek (n = 20)</button><div class="at-out" style="margin:0"><div><small>anakütle μ</small><b>' + nf(mu, 1) + ' TL</b></div><div><small>örneklem x̄</small><b data-x>–</b></div></div><div class="at-not" style="margin:0" data-n></div></div><div class="at-v"><div data-p></div><div data-b></div></div></div>';
        var draw = function () {
          var s = '';
          pop.forEach(function (p, i) { var on = sec.indexOf(i) >= 0; s += '<rect' + (on ? ' class="pop"' : '') + ' x="' + (4 + (i % 20) * 26) + '" y="' + (4 + Math.floor(i / 20) * 20) + '" width="22" height="16" rx="3" fill="' + BOL[p.st][2] + '" fill-opacity="' + (on ? 1 : 0.22) + '" stroke="#0D1838" stroke-width="' + (on ? 1.8 : 0.4) + '"/>'; });
          el.querySelector('[data-p]').innerHTML = V.svg(528, 210, s, 'anakütle: renkler bölge, koyu olanlar seçilen');
          var ps = BOL.map(function (b) { return b[1] / 200 * 100; }), ss = BOL.map(function (_, k) { return sec.length ? sec.filter(function (i) { return pop[i].st === k; }).length / sec.length * 100 : 0; });
          var b = '', ys = V.sc(0, 60, 170, 16); b += V.axes({}, 46, 520, 170, 16, 60, function (v) { return '%' + nf(v, 0); }, 3);
          BOL.forEach(function (o, k) { var x = 70 + k * 115; b += '<rect x="' + x + '" y="' + ys(ps[k]) + '" width="40" height="' + (170 - ys(ps[k])) + '" fill="' + o[2] + '" fill-opacity=".35" stroke="#0D1838"/><rect x="' + (x + 44) + '" y="' + ys(ss[k]) + '" width="40" height="' + (170 - ys(ss[k])) + '" fill="' + o[2] + '" stroke="#0D1838"/><text class="lbl" x="' + (x + 42) + '" y="188" text-anchor="middle">' + o[0] + '</text>'; });
          b += '<text class="lbl" x="520" y="12" text-anchor="end">soluk: anakütle payı · koyu: örneklem payı</text>';
          el.querySelector('[data-b]').innerHTML = V.svg(530, 196, b, 'bölge payları');
          el.querySelector('[data-x]').textContent = sec.length ? nf(M.mean(sec.map(function (i) { return pop[i].v; })), 1) + ' TL' : '–';
        };
        var NOT = { basit: 'Her 20’li kombinasyon eşit olasılıklı. Şans eseri bazı bölgeler az ya da çok temsil edilebilir.', sis: 'k = 200 / 20 = 10. İlk 10 içinden rastgele başlangıç, sonra her 10’uncu müşteri. Liste düzenli bir örüntü taşıyorsa yanlılık riski vardır.', tab: 'Orantılı dağıtım: n<sub>h</sub> = 20 × N<sub>h</sub> / 200 → 8, 6, 4, 2. Bölge payları anakütleyle birebir aynı; x̄ genellikle μ’ye daha yakındır.', kum: 'Rastgele 2 mahalle (sütun) seçilir ve tamamı incelenir. Ucuzdur; ama kümeler birbirine benzemiyorsa x̄ daha çok dalgalanır.' };
        var cek = function () {
          var r = IST.rng((Math.random() * 1e9) | 0), idx = pop.map(function (_, i) { return i; });
          if (yon === 'basit') sec = r.shuf(idx).slice(0, 20);
          else if (yon === 'sis') { var st = r.int(0, 9); sec = []; for (var i = st; i < 200; i += 10) sec.push(i); }
          else if (yon === 'tab') { sec = []; [8, 6, 4, 2].forEach(function (nh, k) { sec = sec.concat(r.shuf(idx.filter(function (i) { return pop[i].st === k; })).slice(0, nh)); }); }
          else { var cs = r.shuf([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]).slice(0, 2); sec = idx.filter(function (i) { return cs.indexOf(i % 20) >= 0; }); }
          el.querySelector('[data-n]').innerHTML = NOT[yon]; draw();
        };
        [].forEach.call(el.querySelectorAll('[data-y] [data-k]'), function (b) { b.onclick = function () { yon = b.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-y] [data-k]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); cek(); }; });
        el.querySelector('[data-c]').onclick = cek;
        el.querySelector('[data-n]').innerHTML = NOT[yon]; draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var N = r.int(6, 14), n = r.int(2, 4), c = M.C(N, n);
      out.push({ tag: 'sayma', q: '<p>Bir zincirin ' + N + ' şubesinden ' + n + ' şube basit rastgele örneklemle denetlenecek.</p><p>Kaç farklı örneklem oluşturulabilir? Her birinin seçilme olasılığı 1/bu sayıdır.</p>', say: c, goster: String(c), tol: 0.01, ornek: '10',
        ip: 'Sıra önemsiz, yerine koymadan: C(N, n).', cz: ['C(' + N + ', ' + n + ') = ' + N + '! / (' + n + '!·' + (N - n) + '!).', '= <b>' + c + '</b>; her örneklemin olasılığı 1/' + c + '.'] });
      var NN = r.pick([200, 300, 400, 500, 600, 1000]), nn = r.pick([10, 20, 25, 50]), k = NN / nn, st = r.int(1, k), th = r.int(3, 5), val = st + (th - 1) * k;
      out.push({ viz: function (ka) { return NN / nn <= 20 ? IST.S.sistematik(NN, nn, st, th, ka) : ''; }, tag: 'senaryo', q: '<p>Bir bankanın ' + NN + ' kredi dosyasından sistematik örneklemle ' + nn + ' dosya seçilecek. İlk aralıktan rastgele başlangıç numarası <b>' + st + '</b> çıktı.</p><p>Örnekleme giren <b>' + th + '. dosyanın</b> numarası kaçtır?</p>', say: val, goster: String(val), tol: 0.01, ornek: '27',
        ip: 'k = N / n; seçilenler: başlangıç, başlangıç + k, başlangıç + 2k…', cz: ['k = ' + NN + ' / ' + nn + ' = ' + k + '.', th + '. dosya = ' + st + ' + (' + th + ' − 1) × ' + k + ' = <b>' + val + '</b>.'] });
      var sz = [r.int(20, 60) * 10, r.int(10, 40) * 10, r.int(5, 25) * 10], tot = M.sum(sz), n3 = r.pick([40, 50, 60, 80, 100]), hi = r.int(0, 2), nh = n3 * sz[hi] / tot, ad = ['Ankara', 'İzmir', 'Bursa'];
      out.push({ viz: function (ka) { return IST.S.tabaka(ad, sz, n3, hi, ka); }, tag: 'tablo', q: '<p>Bir market zincirinin müşterileri üç şehirde (tabaka). Orantılı tabakalı örneklemle toplam <b>' + n3 + '</b> müşteriyle görüşülecek.</p><p><b>' + ad[hi] + '</b> tabakasından kaç müşteri seçilmelidir? (bir ondalık; uygulamada yuvarlanır)</p>', g: V.tablo(['Şehir', 'N<sub>h</sub>'], ad.map(function (a, i) { return [a, String(sz[i])]; }).concat([['<b>Toplam</b>', '<b>' + tot + '</b>']]), { n: [1], st: 0 }), say: nh, goster: nf(nh, 1), tol: 0.06, ornek: '8',
        ip: 'n<sub>h</sub> = n × N<sub>h</sub> / N.', cz: ['N = ' + tot + '.', 'n<sub>h</sub> = ' + n3 + ' × ' + sz[hi] + ' / ' + tot + ' = <b>' + nf(nh, 1) + '</b>.'] });
      var F = r.pick([350, 480, 600, 750, 820]), seq = [], used = {};
      while (seq.length < 9) { var x = r.int(0, 999); seq.push(x); }
      var picks = []; seq.forEach(function (x) { if (x > 0 && x <= F && !used[x]) { used[x] = 1; picks.push(x); } });
      if (picks.length < 3) { seq[6] = Math.max(1, Math.floor(F / 3)); seq[7] = Math.max(2, Math.floor(F / 2)); seq[8] = Math.max(3, F - 7); used = {}; picks = []; seq.forEach(function (x) { if (x > 0 && x <= F && !used[x]) { used[x] = 1; picks.push(x); } }); }
      var pad = function (x) { return (x < 10 ? '00' : x < 100 ? '0' : '') + x; };
      out.push({ viz: function (ka) { return IST.S.serit(seq, function (v, i) { return v > 0 && v <= F && seq.indexOf(v) === i; }, 3, ka); }, tag: 'tablo okuma', q: '<p>Çerçevede 001–' + F + ' numaralı çalışanlar var. Rastgele sayılar tablosundan aşağı doğru şu üç basamaklı sayılar okundu:</p><p class="mono" style="font-size:16px">' + seq.map(pad).join(' · ') + '</p><p>Örnekleme giren <b>3. çalışanın</b> numarası kaçtır?</p>', say: picks[2], goster: pad(picks[2]), tol: 0.01, ornek: '115',
        ip: F + '’den büyük sayıları, 000’ı ve daha önce seçilmiş numaraları atla.', cz: ['Geçerli olanlar sırayla: ' + picks.slice(0, 3).map(pad).join(', ') + '…', '3. çalışan: <b>' + pad(picks[2]) + '</b>.'] });
      var ym = r.pick([['Bir araştırmacı AVM girişinde karşılaştığı ilk 100 kişiyle anket yapıyor.', 4], ['Bir üniversite her fakülteden öğrenci sayısıyla orantılı rastgele öğrenci seçiyor.', 1], ['Bir belediye 40 mahalleden rastgele 5 mahalleyi seçip bu mahallelerdeki tüm haneleri inceliyor.', 2], ['Bir şirket personel listesinden rastgele başlayıp her 15. kişiyi seçiyor.', 3], ['Tüm müşteri numaraları bir torbadan, her kombinasyonun eşit şansla seçileceği şekilde çekiliyor.', 0]]);
      out.push({ tag: 'senaryo', q: '<p>' + X(ym[0]) + '</p><p>Kullanılan örnekleme yöntemi hangisidir?</p>', o: ['Basit rastgele', 'Tabakalı', 'Küme', 'Sistematik', 'Kolayda (olasılıksız)'], a: ym[1], n: ['Her olası örneklem eşit olasılıklı.', 'Tabakalardan orantılı rastgele seçim.', 'Rastgele kümeler seçilir, içleri tamamen incelenir.', 'Rastgele başlangıç ve her k’ıncı eleman.', 'Ulaşması kolay olanlar seçilir; seçilme olasılıkları bilinmez.'][ym[1]],
        ip: 'Seçim kimden yapılıyor: bireylerden mi, gruplardan mı? Bir düzen var mı?', cz: ['Seçimin birimi ve kuralı yöntemi belirler.', 'Cevap: <b>' + ['basit rastgele', 'tabakalı', 'küme', 'sistematik', 'kolayda'][ym[1]] + '</b>.'] });
      return out;
    }
  });

  /* ======================= BAHAR 2 ======================= */
  var BOY = [150, 155, 160, 165, 170, 175, 180];
  var cift = function (a) { var o = []; for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) o.push([a[i], a[j]]); return o; };
  IST.hafta({
    id: 'b2', no: 2, renk: '#6B4FB3', tr: 'Nokta tahmini ve örnekleme dağılımı', en: 'Point Estimation',
    sahneler: [
      {
        b: 'Nokta tahmini', terim: [['nokta tahmini', 'point estimate'], ['tahmin edici', 'estimator'], ['örneklem oranı', 'sample proportion p̂']],
        t: '<p>Anakütle parametresini <b>tek bir sayıyla</b> tahmin etmeye nokta tahmini denir: x̄ → μ, s → σ, p̂ → p.</p><p>10.000 kişilik anakütleden 100 kişinin ortalama boyu 175 cm ise μ ≈ <b>175 cm</b>. Yoksulluk araştırmasında 2000 kişiden 750’si yoksulluk sınırının altında: p̂ = 750 / 2000 = <b>0,375</b>.</p><p>Sorun: başka bir örneklem başka bir tahmin verir. Tahmin ile gerçek değer arasında hep bir fark olabilir.</p>',
        v: function () { return V.fx([{ s: 'ortalama', h: 'x̄ = 175 cm → μ ≈ 175 cm' }, { s: 'oran', h: 'p̂ = f / n = 750 / 2000 = <b>0,375</b>' }, { s: 'standart sapma', h: 's → σ', son: true }], 0.2); }
      },
      {
        b: 'Örnekleme dağılımı: 7 öğrenci, 21 örneklem', terim: [['örnekleme dağılımı', 'sampling distribution of x̄']],
        t: '<p>7 öğrencilik küçük bir anakütle (boylar: 150, 155, …, 180 cm). 2 kişilik C(7, 2) = <b>21</b> farklı örneklem var; her birinin ortalaması farklı olabilir.</p><p>Bu 21 ortalamanın dağılımı <b>x̄’in örnekleme dağılımıdır</b>. Dikkat: ortalamaların ortalaması tam olarak μ = <b>165</b>, ama yayılımı anakütleninkinden küçük.</p>',
        v: function () {
          var m = cift(BOY).map(function (p) { return (p[0] + p[1]) / 2; }), u = M.sort(m).filter(function (v, i, a) { return a.indexOf(v) === i; });
          return V.bars({ x: u.map(function (v) { return nf(v, 1); }), y: u.map(function (v) { return m.filter(function (w) { return w === v; }).length; }), h: 250, max: 4, fmt: function (v) { return nf(v, 0); }, renk: PAL[4], xlab: '21 örneklem ortalaması (cm)', ylab: 'frekans', hi: [u.indexOf(165)], dim: false });
        }
      },
      {
        b: 'Ortalaması μ, standart hatası σ/√n', terim: [['standart hata', 'standard error σ_x̄'], ['sonlu anakütle düzeltmesi', 'finite population correction']],
        t: '<p class="mono">μ<sub>x̄</sub> = μ &nbsp; σ<sub>x̄</sub> = σ / √n</p><p>Küçük ve sonlu anakütlede yerine koymadan seçimde düzeltme çarpanı eklenir: σ<sub>x̄</sub> = (σ/√n)·√((N − n)/(N − 1)).</p><p>Örnekte σ = 10: σ<sub>x̄</sub> = (10/√2)·√(5/6) = <b>6,455</b>. n büyüdükçe standart hata küçülür: tahmin <b>daha isabetli</b> olur.</p>',
        v: function () { var m = cift(BOY).map(function (p) { return (p[0] + p[1]) / 2; }); return V.fx([{ s: 'anakütle', h: 'μ = 165 · σ = 10' }, { s: '21 ortalamanın ortalaması', h: 'μ<sub>x̄</sub> = ' + nf(M.mean(m), 1) + ' = μ ✓' }, { s: '21 ortalamanın standart sapması', h: 'σ<sub>x̄</sub> = ' + nf(Math.sqrt(M.mean(m.map(function (v) { return (v - 165) * (v - 165); }))), 3) + ' = (10/√2)·√(5/6) ✓', son: true }], 0.2); }
      },
      {
        b: 'İyi tahmin edicinin özellikleri', terim: [['yansız', 'unbiased'], ['etkin', 'efficient'], ['tutarlı', 'consistent']],
        t: '<ul><li><b>Yansız:</b> örnekleme dağılımının ortalaması parametreye eşit; ortalamada isabetli (E(x̄) = μ).</li><li><b>Etkin:</b> yansızlar arasında varyansı en küçük olan; atışlar sıkı.</li><li><b>Tutarlı:</b> n büyüdükçe tahmin parametreye yaklaşır.</li></ul><p>s²’de n − 1’e bölmemizin nedeni de budur: böylece s², σ²’nin <b>yansız</b> tahmin edicisi olur.</p>',
        v: function () {
          var hd = function (cx, pts, lab, dd) { var s = ''; [60, 42, 24, 8].forEach(function (rr, i) { s += '<circle cx="' + cx + '" cy="110" r="' + rr + '" fill="' + (i % 2 ? '#fff' : '#FBE6E1') + '" stroke="#0D1838" stroke-width="1.4"/>'; }); pts.forEach(function (p, i) { s += '<circle class="dp" ' + d(dd + i * 0.08) + ' cx="' + (cx + p[0]) + '" cy="' + (110 + p[1]) + '" r="4.5" fill="#0D1838"/>'; }); return s + '<text class="lbb" x="' + cx + '" y="196" text-anchor="middle">' + lab + '</text>'; };
          var r = IST.rng(3), a = [], b = [], c = []; for (var i = 0; i < 9; i++) { a.push([(r() - 0.5) * 16, (r() - 0.5) * 16]); b.push([(r() - 0.5) * 70, (r() - 0.5) * 70]); c.push([28 + (r() - 0.5) * 14, -24 + (r() - 0.5) * 14]); }
          return V.svg(540, 210, hd(90, a, 'yansız + etkin', 0) + hd(270, b, 'yansız, etkin değil', 0.8) + hd(450, c, 'yanlı', 1.6), 'tahmin edicilerin hedef tahtası');
        }
      },
      {
        b: 'Merkezî limit teoremi', terim: [['merkezî limit teoremi', 'central limit theorem']],
        t: '<p>Anakütle hangi biçimde olursa olsun (U şeklinde, çarpık…), n yeterince büyükse x̄’in örnekleme dağılımı <b>yaklaşık normaldir</b>: x̄ ~ N(μ, σ²/n).</p><p>Ders notundaki simülasyonda U biçimli bir anakütleden bir milyon örneklem çekildi: n = 3’te dağılım hâlâ tuhaf, n = 30 ve 100’de çan eğrisi. Pratikte <b>n ≥ 30</b> genellikle yeterli sayılır.</p>',
        v: function () {
          var r = IST.rng(21), u = function () { var x = r(); return x < 0.5 ? Math.pow(x * 2, 3) / 2 : 1 - Math.pow((1 - x) * 2, 3) / 2; };
          return [1, 3, 30].map(function (n, j) {
            var mm = []; for (var t = 0; t < 1500; t++) { var s = 0; for (var k = 0; k < n; k++) s += u(); mm.push(s / n); }
            var e = []; for (var a = 0; a <= 1.0001; a += 0.05) e.push(Math.round(a * 100) / 100);
            var y = e.slice(0, -1).map(function (lo, i) { return mm.filter(function (v) { return v >= lo && v < e[i + 1]; }).length; });
            return V.hist({ edges: e, y: y, h: 120, val: false, every: 5, renk: [PAL[1], PAL[3], PAL[2]][j], xlab: 'n = ' + n + (j ? '' : ' (anakütlenin kendisi: U biçimli)'), d: j * 0.7 });
          }).join('');
        }
      },
      {
        b: 'Oranın örnekleme dağılımı', terim: [['oranın standart hatası', 'standard error of p̂']],
        t: '<p>p̂ = f / n de bir rastgele değişkendir: <b>E(p̂) = p</b>, <b>σ<sub>p̂</sub> = √(p(1 − p)/n)</b>.</p><p>np ≥ 5 ve n(1 − p) ≥ 5 ise p̂ yaklaşık normaldir. Notlardaki simülasyonda p = 0,10’da küçük n için dağılım sağa çarpık; n = 100’de çan eğrisi.</p><p>Yoksulluk örneği: σ<sub>p̂</sub> ≈ √(0,375 · 0,625 / 2000) = <b>0,0108</b>.</p>',
        v: function () { var ps = []; for (var x = 0; x <= 20; x++) ps.push(M.binom(x, 20, 0.1)); return V.bars({ x: ps.map(function (_, i) { return nf(i / 20, 2); }), y: ps, h: 160, val: false, max: 0.3, fmt: function (v) { return nf(v, 2); }, renk: PAL[1], xlab: 'p̂ dağılımı: p = 0,10, n = 20 (sağa çarpık)', gap: 0.1 }) + V.norm({ m: 0.375, s: 0.0108, h: 140, xt: [[0.35, '0,35'], [0.375, '0,375'], [0.4, '0,40']], d: 0.8, renk: PAL[2] }); }
      }
    ],
    gorsel: {
      b: 'Merkezî limit teoremi laboratuvarı', t: 'Anakütlenin biçimini ve örneklem büyüklüğünü seç; 1000 örneklem çekip ortalamalarının histogramını gör. Kırmızı eğri N(μ, σ²/n) teorik dağılımıdır.',
      kur: function (el) {
        var BIC = { duz: ['düzgün', function (r) { return r() * 10; }], u: ['U biçimli', function (r) { var x = r(); return 10 * (x < 0.5 ? Math.pow(x * 2, 3) / 2 : 1 - Math.pow((1 - x) * 2, 3) / 2); }], ust: ['sağa çarpık', function (r) { return Math.min(10, -Math.log(1 - r()) * 2); }] }, b = 'u', n = 5;
        el.innerHTML = '<div class="at-g"><div class="at-k"><div class="seg" data-b>' + Object.keys(BIC).map(function (k) { return '<button type="button" data-k="' + k + '" aria-pressed="' + (k === b) + '">' + BIC[k][0] + '</button>'; }).join('') + '</div><label><span>örneklem büyüklüğü n <output data-no>5</output></span><input type="range" min="1" max="60" value="5" data-n></label><button type="button" class="btn sm pri" data-c>1000 örneklem çek</button><div class="at-out" style="margin:0" data-o></div></div><div class="at-v"><div data-p></div><div data-h></div><div class="at-not" data-t></div></div></div>';
        var draw = function () {
          var r = IST.rng((Math.random() * 1e9) | 0), f = BIC[b][1], pop = []; for (var i = 0; i < 4000; i++) pop.push(f(r));
          var mu = M.mean(pop), sg = Math.sqrt(M.mean(pop.map(function (v) { return (v - mu) * (v - mu); }))), mm = [];
          for (var t = 0; t < 1000; t++) { var s = 0; for (var k = 0; k < n; k++) s += f(r); mm.push(s / n); }
          var e = []; for (var a = 0; a <= 10.0001; a += 0.25) e.push(a);
          var hy = function (v) { return e.slice(0, -1).map(function (lo, j) { return v.filter(function (x) { return x >= lo && x < e[j + 1]; }).length; }); };
          el.querySelector('[data-p]').innerHTML = V.hist({ edges: e, y: hy(pop), h: 110, val: false, every: 8, renk: '#CFC6B3', xlab: 'anakütle: ' + BIC[b][0] });
          var hm = hy(mm), mx = Math.max.apply(null, hm), hs = V.hist({ edges: e, y: hm, h: 220, val: false, every: 8, renk: PAL[4], xlab: '1000 örneklem ortalaması (n = ' + n + ')', max: V.nice(Math.max(mx, 1000 * 0.25 * M.npdf(mu, mu, sg / Math.sqrt(n))) * 1.1) });
          var xs = V.sc(0, 10, 46, 506), ymax = V.nice(Math.max(mx, 1000 * 0.25 * M.npdf(mu, mu, sg / Math.sqrt(n))) * 1.1), ys = V.sc(0, ymax, 176, 18), pts = [];
          for (var q = 0; q <= 200; q++) { var x = q / 20; pts.push(xs(x).toFixed(1) + ' ' + ys(1000 * 0.25 * M.npdf(x, mu, sg / Math.sqrt(n))).toFixed(1)); }
          el.querySelector('[data-h]').innerHTML = hs.replace('</svg>', '<path d="M' + pts.join('L') + '" fill="none" stroke="#C8553D" stroke-width="2.5"/></svg>');
          el.querySelector('[data-o]').innerHTML = '<div><small>μ</small><b>' + nf(mu, 2) + '</b></div><div><small>x̄’lerin ort.</small><b>' + nf(M.mean(mm), 2) + '</b></div><div><small>σ/√n</small><b>' + nf(sg / Math.sqrt(n), 3) + '</b></div><div><small>x̄’lerin s</small><b>' + nf(M.sdS(mm), 3) + '</b></div>';
          el.querySelector('[data-t]').innerHTML = n < 10 && b !== 'duz' ? 'n küçükken ortalamaların dağılımı anakütlenin biçimini hâlâ taşıyor. n’yi 30’un üstüne çıkar.' : 'Ortalamalar μ etrafında çan biçiminde toplanıyor ve yayılımları yaklaşık σ/√n: <b>merkezî limit teoremi</b>.';
        };
        [].forEach.call(el.querySelectorAll('[data-b] [data-k]'), function (x) { x.onclick = function () { b = x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-b] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); draw(); }; });
        el.querySelector('[data-n]').oninput = function () { n = +this.value; el.querySelector('[data-no]').textContent = n; draw(); };
        el.querySelector('[data-c]').onclick = draw;
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var sg = r.pick([8, 10, 12, 15, 20, 24, 30]), n = r.pick([16, 25, 36, 49, 64, 100]), se = sg / Math.sqrt(n);
      out.push({ viz: function (ka) { return IST.S.egri({ f: function (x) { return M.npdf(x, 0, sg); }, a: -3.5 * sg, b: 3.5 * sg, ymax: M.npdf(0, 0, se) * 1.1, f2: function (x) { return M.npdf(x, 0, se); }, f2k: 2, f2lab: [se * 1.2, M.npdf(0, 0, se) * 0.8, 'x̄’lerin dağılımı (σ/√n)'], xt: [[-sg, '−σ'], [0, 'μ'], [sg, 'σ']], renk: '#CFC6B3' }, ka); }, tag: 'hesap', q: '<p>Bir kafede sipariş tutarlarının standart sapması σ = <b>' + sg + ' TL</b>. Rastgele <b>' + n + '</b> siparişlik örneklemler alınıyor.</p><p>Örneklem ortalamasının <b>standart hatası</b> kaçtır? (üç ondalık)</p>', say: se, goster: nf(se, 3), tol: 0.0021, ornek: '1,5',
        ip: 'σ<sub>x̄</sub> = σ / √n.', cz: ['√' + n + ' = ' + Math.sqrt(n) + '.', sg + ' / ' + Math.sqrt(n) + ' = <b>' + nf(se, 3) + '</b>.'] });
      var mu = r.pick([120, 200, 250, 500]), s2 = r.pick([20, 30, 40, 50]), n2 = r.pick([36, 49, 64, 100]), se2 = s2 / Math.sqrt(n2), kk = r.int(50, 220) / 100, x2 = Math.round((mu + kk * se2) * 10) / 10, z = Math.round((x2 - mu) / se2 * 100) / 100, p = 0.5 - M.ztab(z);
      out.push({ viz: function (ka) { return IST.S.normal({ m: mu, s: se2, x: x2, yon: 'sag', p: p, adim: [2, 3] }, ka); }, tag: 'MLT', q: '<p>Bir bankada günlük işlem tutarlarının ortalaması μ = ' + mu + ' bin TL, σ = ' + s2 + ' bin TL. Rastgele ' + n2 + ' günlük örneklem alınıyor.</p><p>Örneklem ortalamasının <b>' + nf(x2, 1) + '</b>’ten büyük olma olasılığı kaçtır? (dört ondalık)</p>', g: IST.ztab([z]), wide: true, say: p, goster: nf(p, 4), tol: 0.0011, ornek: '0,0228',
        yanlis: function (v) { var zz = Math.round((x2 - mu) / s2 * 100) / 100; return Math.abs(v - (0.5 - M.ztab(zz))) < 0.002 ? 'σ ile standartlaştırdın; x̄ için σ/√n kullanmalısın.' : 'z = (x̄ − μ) / (σ/√n).'; },
        ip: 'MLT: x̄ ~ N(μ, σ/√n). z = (x̄ − μ)/(σ/√n).', cz: ['σ<sub>x̄</sub> = ' + s2 + '/√' + n2 + ' = ' + nf(se2, 3) + '.', 'z = (' + nf(x2, 1) + ' − ' + mu + ') / ' + nf(se2, 3) + ' = ' + nf(z, 2) + '.', 'P(Z > ' + nf(z, 2) + ') = 0,5 − ' + nf(M.ztab(z), 4, false) + ' = <b>' + nf(p, 4) + '</b>.'] });
      var nn = r.pick([400, 500, 800, 1000, 1200, 2000]), f = Math.round(nn * r.int(15, 60) / 100), ph = f / nn, sp = Math.sqrt(ph * (1 - ph) / nn), ask = r.int(0, 1);
      out.push({ viz: function (ka) { return IST.S.izgara(nn, f, '👤', ka, { k: 1, lab: f + ' / ' + nn + ' = ' + nf(ph, 4) }); }, tag: 'oran', q: '<p>Bir anket şirketi ' + nn + ' kişiden <b>' + f + '</b>’inin yeni bir ödeme uygulamasını kullandığını buldu.</p><p>' + (ask ? '<b>p̂’nin standart hatası</b> kaçtır? (dört ondalık)' : 'Kullanım oranının <b>nokta tahmini</b> p̂ kaçtır? (dört ondalık)') + '</p>', say: ask ? sp : ph, goster: nf(ask ? sp : ph, 4), tol: 0.0006, ornek: '0,375',
        ip: ask ? 'σ<sub>p̂</sub> ≈ √(p̂(1 − p̂)/n).' : 'p̂ = f / n.', cz: ['p̂ = ' + f + ' / ' + nn + ' = ' + nf(ph, 4) + '.', ask ? '√(' + nf(ph, 4) + ' × ' + nf(1 - ph, 4) + ' / ' + nn + ') = <b>' + nf(sp, 4) + '</b>.' : 'Cevap: <b>' + nf(ph, 4) + '</b>.'] });
      var P = [], N5 = r.int(4, 6); for (var i = 0; i < N5; i++) P.push(r.int(5, 20)); var n5 = r.int(2, N5 - 1), c5 = M.C(N5, n5), m5 = M.mean(P);
      out.push({ tag: 'örnekleme dağılımı', q: '<p>Bir anakütlede ' + N5 + ' gözlem var: <b class="mono">' + P.join(', ') + '</b>. Bu anakütleden yerine koymadan n = ' + n5 + ' büyüklüğünde tüm olası örneklemler (' + c5 + ' tane) çekilip her birinin ortalaması hesaplanıyor.</p><p>Bu ' + c5 + ' örneklem ortalamasının <b>ortalaması</b> kaçtır? (iki ondalık)</p>', say: m5, goster: nf(m5, 2), tol: 0.0051, ornek: '10,4',
        ip: 'x̄ yansız bir tahmin edicidir: tüm örneklem ortalamalarının ortalaması μ’dür. Tek tek hesaplamana gerek yok.', cz: ['μ<sub>x̄</sub> = μ.', 'μ = ' + M.sum(P) + ' / ' + N5 + ' = <b>' + nf(m5, 2) + '</b>.'] });
      var kat = r.pick([4, 9, 16, 25]);
      out.push({ tag: 'kavram', q: '<p>Bir araştırmacı örneklem büyüklüğünü <b>' + kat + ' katına</b> çıkarıyor. x̄’in standart hatası ne olur?</p>', o: ['1/' + Math.sqrt(kat) + ' katına iner', '1/' + kat + ' katına iner', 'Değişmez', Math.sqrt(kat) + ' katına çıkar'], a: 0, n: 'σ/√n: n ' + kat + ' katına çıkınca √n ' + Math.sqrt(kat) + ' katına çıkar.', yn: { 1: 'Standart hata n’nin değil √n’nin tersiyle orantılı.' },
        ip: 'σ<sub>x̄</sub> = σ / √n. Payda nasıl değişir?', cz: ['Yeni standart hata: σ / √(' + kat + 'n) = (σ/√n) / ' + Math.sqrt(kat) + '.', 'Cevap: <b>1/' + Math.sqrt(kat) + ' katına iner</b>.'] });
      return out;
    }
  });

  /* ======================= BAHAR 3 ======================= */
  var BAL = [482, 488, 495, 490, 486, 492, 484, 491, 487];
  IST.hafta({
    id: 'b3', no: 3, renk: '#C8553D', tr: 'Aralık tahmini (güven aralıkları)', en: 'Interval Estimation',
    sahneler: [
      {
        b: 'Noktadan aralığa', terim: [['güven aralığı', 'confidence interval'], ['güven düzeyi', 'confidence level 1 − α'], ['hata payı', 'margin of error']],
        t: '<p>Nokta tahmini neredeyse hiç tam isabet etmez. Bunun yerine parametreyi belli bir güvenle içine alan bir <b>aralık</b> veririz:</p><p class="mono">nokta tahmini ± hata payı</p><p>Güven düzeyi (1 − α): %90, %95, %99. Karşılık gelen z değerleri <b>1,645</b>, <b>1,96</b>, <b>2,576</b>.</p>',
        v: function () { return V.norm({ m: 0, s: 1, sh: [-1.96, 1.96], h: 230, xt: [[-1.96, '−1,96'], [0, 'μ'], [1.96, '1,96']], extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.3) + ' x="' + xs(0) + '" y="' + ys(0.15) + '" text-anchor="middle">%95</text><text class="lbm" x="' + xs(-2.7) + '" y="' + ys(0.04) + '" text-anchor="middle">%2,5</text><text class="lbm" x="' + xs(2.7) + '" y="' + ys(0.04) + '" text-anchor="middle">%2,5</text>'; } }); }
      },
      {
        b: 'σ biliniyorsa: z aralığı', terim: [['z aralığı', 'z interval']],
        t: '<p class="mono">x̄ ± z<sub>α/2</sub> · σ / √n</p><p>Bir üretim hattından rastgele 100 ürün; ortalama ağırlık 50,23 g. Hattın σ’sı geçmiş kayıtlardan <b>0,6 g</b> biliniyor (uyarlanmış örnek). %95 güven:</p><p>50,23 ± 1,96 · 0,6/√100 = 50,23 ± 0,1176 → <b>[50,112; 50,348] g</b>.</p>',
        v: function () { return V.fx([{ s: 'standart hata', h: '0,6 / √100 = 0,06' }, { s: 'hata payı', h: '1,96 × 0,06 = 0,1176' }, { s: '%95 güven aralığı', h: '[50,112 ; 50,348] g', son: true }], 0.2); }
      },
      {
        b: 'σ bilinmiyorsa: t dağılımı', terim: [['t dağılımı', 'Student’s t distribution'], ['serbestlik derecesi', 'degrees of freedom (n − 1)']],
        t: '<p>σ yerine s kullanınca belirsizlik artar; z yerine <b>t dağılımı</b> kullanılır. t, normalden daha <b>kalın kuyrukludur</b>; serbestlik derecesi (sd = n − 1) arttıkça normale yaklaşır.</p><p class="mono">x̄ ± t<sub>α/2, n−1</sub> · s / √n</p>',
        v: function () {
          var xs = V.sc(-4.5, 4.5, 30, 520), ys = V.sc(0, 0.45, 220, 14), s = '<line x1="30" x2="520" y1="220" y2="220" stroke="#0D1838" stroke-width="2"/>';
          [[function (x) { return M.npdf(x, 0, 1); }, '#0D1838', 'normal'], [function (x) { return M.tpdf(x, 2); }, PAL[1], 't (sd = 2)'], [function (x) { return M.tpdf(x, 8); }, PAL[4], 't (sd = 8)']].forEach(function (c, i) { var p = []; for (var x = -4.5; x <= 4.5; x += 0.05) p.push(xs(x).toFixed(1) + ' ' + ys(c[0](x)).toFixed(1)); s += '<path class="dr" style="--len:1300;--d:' + (i * 0.6) + 's" d="M' + p.join('L') + '" fill="none" stroke="' + c[1] + '" stroke-width="2.8"/><g class="fd" ' + d(0.6 + i * 0.6) + '><rect x="380" y="' + (20 + i * 20) + '" width="14" height="4" fill="' + c[1] + '"/><text class="lbl" x="400" y="' + (26 + i * 20) + '">' + c[2] + '</text></g>'; });
          return V.svg(540, 236, s, 't ve normal');
        }
      },
      {
        b: 'Bal kavanozları: %99 t aralığı', terim: [['t tablosu', 't table']],
        t: '<p>Üretim hattından rastgele 9 bal kavanozu tartıldı (g): 482, 488, 495, 490, 486, 492, 484, 491, 487. σ bilinmiyor.</p><p>x̄ = <b>488,33</b>, s = <b>4,03</b>, sd = 8, t<sub>0,005; 8</sub> = <b>3,355</b>.</p><p>488,33 ± 3,355 · 4,03/3 = 488,33 ± 4,51 → <b>[483,82; 492,84] g</b>.</p>',
        v: function () { var m = M.mean(BAL), s = M.sdS(BAL), e = M.tkr(0.005, 8) * s / 3; return V.ust(IST.ttab([7, 8, 9], { '1,5': 'hi' }), V.fx([{ s: 'örneklem', h: 'x̄ = ' + nf(m, 2) + ' · s = ' + nf(s, 2) + ' · n = 9' }, { s: 'hata payı', h: '3,355 × ' + nf(s, 2) + ' / √9 = ' + nf(e, 2) }, { s: '%99 güven aralığı', h: '[' + nf(m - e, 2) + ' ; ' + nf(m + e, 2) + '] g', son: true }], 0.6)); }
      },
      {
        b: 'Oran için güven aralığı', terim: [['oran aralığı', 'interval for a proportion']],
        t: '<p class="mono">p̂ ± z<sub>α/2</sub> · √(p̂(1 − p̂)/n)</p><p>Yoksulluk araştırması: 2000 kişiden 750’si (p̂ = 0,375). %95 güven:</p><p>0,375 ± 1,96 · √(0,375·0,625/2000) = 0,375 ± 0,0212 → <b>[0,354; 0,396]</b>. Nüfusun yaklaşık %35,4–%39,6’sı yoksulluk sınırının altında.</p>',
        v: function () { return V.norm({ m: 0.375, s: 0.01083, sh: [0.3538, 0.3962], h: 220, xt: [[0.3538, '0,354'], [0.375, '0,375'], [0.3962, '0,396']] }); }
      },
      {
        b: '“%95 güven” ne demek?', terim: [['kapsama', 'coverage'], ['örneklem büyüklüğü', 'sample size n = (zσ/E)²']],
        t: '<p>%95 güven, <b>μ’nin %95 olasılıkla bu aralıkta olduğu</b> anlamına gelmez; μ sabittir. Anlamı: aynı yöntemle 100 örneklem çekip 100 aralık kurarsak yaklaşık <b>95’i μ’yü kapsar</b>.</p><p>Aralık daralır: n büyüyünce, güven düzeyi düşünce, σ küçükken. Hedef hata payı E için gereken n: <b>n = (z·σ / E)²</b> (yukarı yuvarla).</p>',
        v: function () {
          var r = IST.rng(8), s = '', xs = V.sc(-4, 4, 30, 520);
          s += '<line x1="' + xs(0) + '" x2="' + xs(0) + '" y1="6" y2="236" stroke="#C8553D" stroke-width="2.5" stroke-dasharray="6 4"/><text class="lbb" x="' + (xs(0) + 6) + '" y="16" style="fill:#C8553D">μ</text>';
          for (var i = 0; i < 20; i++) { var m = (r() + r() + r() + r() - 2) * 1.7, hit = Math.abs(m) <= 1.96; if (i === 7) { m = 2.4; hit = false; } s += '<g class="gx" ' + d(i * 0.09) + '><line x1="' + xs(m - 1.96) + '" x2="' + xs(m + 1.96) + '" y1="' + (24 + i * 11) + '" y2="' + (24 + i * 11) + '" stroke="' + (hit ? PAL[0] : PAL[1]) + '" stroke-width="3" stroke-linecap="round"/><circle cx="' + xs(m) + '" cy="' + (24 + i * 11) + '" r="3" fill="#0D1838"/></g>'; }
          return V.svg(540, 246, s, '20 güven aralığı');
        }
      }
    ],
    gorsel: {
      b: 'Güven aralığı yağmuru', t: 'Gerçek μ = 100 olan bir anakütleden 50 örneklem çek; her biri için güven aralığı kur. Kırmızılar μ’yü kaçıranlar. Güven düzeyini, n’yi ve σ’nın bilinip bilinmediğini değiştir.',
      kur: function (el) {
        var g = 0.95, n = 10, tb = false, toplam = 0, kac = 0;
        el.innerHTML = '<div class="at-g"><div class="at-k"><div class="seg" data-g>' + [0.9, 0.95, 0.99].map(function (x) { return '<button type="button" data-k="' + x + '" aria-pressed="' + (x === g) + '">%' + x * 100 + '</button>'; }).join('') + '</div><label><span>n <output data-no>10</output></span><input type="range" min="3" max="100" value="10" data-n></label><div class="seg" data-t><button type="button" data-k="z" aria-pressed="true">σ biliniyor (z)</button><button type="button" data-k="t" aria-pressed="false">σ bilinmiyor (t)</button></div><button type="button" class="btn sm pri" data-c>50 örneklem çek</button><div class="at-out" style="margin:0"><div><small>kapsayan</small><b data-k2>–</b></div><div><small>ort. genişlik</small><b data-w>–</b></div><div><small>toplam kapsama</small><b data-tt>–</b></div></div></div><div class="at-v"><div data-s></div><div class="at-not" data-nt></div></div></div>';
        var cek = function () {
          var r = IST.rng((Math.random() * 1e9) | 0), sg = 15, s = '', xs = V.sc(70, 130, 30, 520), hit = 0, W = 0;
          s += '<line x1="' + xs(100) + '" x2="' + xs(100) + '" y1="4" y2="410" stroke="#C8553D" stroke-width="2.5" stroke-dasharray="6 4"/>';
          for (var t = 70; t <= 130; t += 10) s += '<text class="lbm" x="' + xs(t) + '" y="422" text-anchor="middle">' + t + '</text>';
          for (var i = 0; i < 50; i++) {
            var v = []; for (var k = 0; k < n; k++) { var u1 = 1 - r(), u2 = r(); v.push(100 + sg * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)); }
            var m = M.mean(v), e = tb ? M.tkr((1 - g) / 2, n - 1) * M.sdS(v) / Math.sqrt(n) : M.zkr((1 - g) / 2) * sg / Math.sqrt(n), ok = m - e <= 100 && 100 <= m + e; if (ok) hit++; W += 2 * e;
            s += '<line x1="' + xs(Math.max(70, m - e)) + '" x2="' + xs(Math.min(130, m + e)) + '" y1="' + (8 + i * 8) + '" y2="' + (8 + i * 8) + '" stroke="' + (ok ? PAL[0] : PAL[1]) + '" stroke-width="3" stroke-linecap="round" class="gx" ' + d(i * 0.02) + '/>';
          }
          toplam += 50; kac += hit;
          el.querySelector('[data-s]').innerHTML = V.svg(540, 430, s, '50 güven aralığı');
          el.querySelector('[data-k2]').textContent = hit + ' / 50'; el.querySelector('[data-w]').textContent = nf(W / 50, 2); el.querySelector('[data-tt]').textContent = '%' + nf(kac / toplam * 100, 1) + ' (' + toplam + ')';
          el.querySelector('[data-nt]').innerHTML = 'Beklenen kapsama: %' + g * 100 + '. ' + (tb ? 't aralıklarının genişlikleri s’ye göre değişir.' : 'z aralıklarının hepsi aynı genişlikte (σ sabit).') + ' n’yi büyüt: aralıklar daralır ama kapsama oranı aynı kalır.';
        };
        var reset = function () { toplam = 0; kac = 0; cek(); };
        [].forEach.call(el.querySelectorAll('[data-g] [data-k]'), function (x) { x.onclick = function () { g = +x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-g] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); reset(); }; });
        [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (x) { x.onclick = function () { tb = x.getAttribute('data-k') === 't'; [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); reset(); }; });
        el.querySelector('[data-n]').oninput = function () { n = +this.value; el.querySelector('[data-no]').textContent = n; reset(); };
        el.querySelector('[data-c]').onclick = cek;
        cek();
      }
    },
    sorular: function (r) {
      var out = [];
      var G = r.pick([[0.9, 1.645], [0.95, 1.96], [0.99, 2.576]]), m = r.int(400, 900) / 10, sg = r.pick([2, 3, 4, 5, 6, 8]), n = r.pick([25, 36, 49, 64, 100]), e = G[1] * sg / Math.sqrt(n), up = r.int(0, 1);
      out.push({ viz: function (ka) { return IST.S.aralik({ m: m, e: e, g: '%' + G[0] * 100, ka: 2, kb: 3 }, ka); }, tag: 'z aralığı', q: '<p>Bir kahve makinesinin doldurduğu bardak hacmi için σ = ' + sg + ' ml biliniyor. Rastgele ' + n + ' bardağın ortalaması ' + nf(m, 1) + ' ml.</p><p>μ için <b>%' + G[0] * 100 + '</b> güven aralığının <b>' + (up ? 'üst' : 'alt') + ' sınırı</b> kaçtır? (iki ondalık)</p>', say: up ? m + e : m - e, goster: nf(up ? m + e : m - e, 2), tol: 0.011, ornek: '50,35',
        ip: 'x̄ ± z<sub>α/2</sub>·σ/√n; %' + G[0] * 100 + ' için z = ' + nf(G[1], 3) + '.', cz: ['σ/√n = ' + sg + '/√' + n + ' = ' + nf(sg / Math.sqrt(n), 4) + '.', 'Hata payı = ' + nf(G[1], 3) + ' × ' + nf(sg / Math.sqrt(n), 4) + ' = ' + nf(e, 4) + '.', (up ? 'Üst' : 'Alt') + ' sınır = ' + nf(m, 1) + (up ? ' + ' : ' − ') + nf(e, 4) + ' = <b>' + nf(up ? m + e : m - e, 2) + '</b>.'] });
      var nt = r.int(6, 15), A = r.pick([[0.95, 0.025], [0.99, 0.005], [0.9, 0.05]]), s = r.int(20, 80) / 10, tk = M.tkr(A[1], nt - 1), et = tk * s / Math.sqrt(nt);
      out.push({ viz: function (ka) { return IST.S.egri({ f: function (x) { return M.tpdf(x, nt - 1); }, a: -4.5, b: 4.5, ymax: 0.45, sh: [-tk, tk], shAdim: 1, shc: PAL[2], xt: ka >= 1 ? [[-tk, '−' + nf(tk, 3)], [0, '0'], [tk, nf(tk, 3)]] : [[0, '0']], renk: PAL[4] }, ka); }, tag: 't tablosu', q: '<p>Bir laboratuvarda ' + nt + ' numunenin ölçümünde s = ' + nf(s, 1) + ' bulundu; σ bilinmiyor, anakütle normal.</p><p>μ için <b>%' + A[0] * 100 + '</b> güven aralığının <b>hata payı</b> kaçtır? (iki ondalık)</p>', g: IST.ttab([nt - 2, nt - 1, nt]), wide: true, say: et, goster: nf(et, 2), tol: 0.02, ornek: '4,51',
        yanlis: function (v) { return Math.abs(v - M.zkr(A[1]) * s / Math.sqrt(nt)) < 0.02 ? 'z kullandın; σ bilinmediği için t gerekir.' : Math.abs(v - M.tkr(A[1], nt) * s / Math.sqrt(nt)) < 0.02 ? 'Serbestlik derecesi n − 1 = ' + (nt - 1) + ' olmalı.' : 't<sub>α/2, n−1</sub>·s/√n.'; },
        ip: 'sd = n − 1 = ' + (nt - 1) + '; α/2 = ' + nf(A[1], 3) + ' sütunundan t’yi oku.', cz: ['t<sub>' + nf(A[1], 3) + '; ' + (nt - 1) + '</sub> = ' + nf(tk, 3) + '.', 's/√n = ' + nf(s, 1) + '/√' + nt + ' = ' + nf(s / Math.sqrt(nt), 4) + '.', 'Hata payı = <b>' + nf(et, 2) + '</b>.'] });
      var nn = r.pick([400, 500, 800, 1000, 1500]), f = Math.round(nn * r.int(20, 70) / 100), ph = f / nn, ep = 1.96 * Math.sqrt(ph * (1 - ph) / nn), u2 = r.int(0, 1);
      out.push({ viz: function (ka) { return IST.S.aralik({ m: ph, e: ep, lab: 'p̂', dg: 4, ka: 2, kb: 3 }, ka); }, tag: 'oran', q: '<p>Bir seçim anketinde ' + nn + ' kişiden ' + f + '’i A partisini desteklediğini söyledi.</p><p>Destek oranı için %95 güven aralığının <b>' + (u2 ? 'üst' : 'alt') + ' sınırı</b> kaçtır? (dört ondalık)</p>', say: u2 ? ph + ep : ph - ep, goster: nf(u2 ? ph + ep : ph - ep, 4), tol: 0.0006, ornek: '0,3962',
        ip: 'p̂ ± 1,96·√(p̂(1 − p̂)/n).', cz: ['p̂ = ' + nf(ph, 4) + '.', 'Hata payı = 1,96 × √(' + nf(ph, 4) + '·' + nf(1 - ph, 4) + '/' + nn + ') = ' + nf(ep, 4) + '.', 'Sınır = <b>' + nf(u2 ? ph + ep : ph - ep, 4) + '</b>.'] });
      var sg3 = r.pick([5, 8, 10, 12, 15, 20]), E = r.pick([1, 1.5, 2, 2.5, 3]), G3 = r.pick([[0.95, 1.96], [0.99, 2.576], [0.9, 1.645]]), nreq = Math.ceil(Math.pow(G3[1] * sg3 / E, 2));
      out.push({ tag: 'planlama', q: '<p>Bir pazar araştırmacısı ortalama harcamayı <b>±' + nf(E, 1) + ' TL</b> hata payıyla, <b>%' + G3[0] * 100 + '</b> güvenle tahmin etmek istiyor. Ön çalışmadan σ ≈ ' + sg3 + ' TL.</p><p>En az kaç kişilik örneklem gerekir?</p>', say: nreq, goster: String(nreq), tol: 0.01, ornek: '97',
        yanlis: function (v) { return Math.abs(v - Math.pow(G3[1] * sg3 / E, 2)) < 1 ? 'Sonucu her zaman yukarı yuvarla.' : 'n = (zσ/E)².'; },
        ip: 'n = (z·σ / E)²; yukarı yuvarla.', cz: ['z·σ/E = ' + nf(G3[1], 3) + ' × ' + sg3 + ' / ' + nf(E, 1) + ' = ' + nf(G3[1] * sg3 / E, 3) + '.', 'Kare: ' + nf(Math.pow(G3[1] * sg3 / E, 2), 2) + ' → <b>' + nreq + '</b>.'] });
      out.push({ tag: 'yorum', q: '<p>Bir analist ortalama teslim süresi için %95 güven aralığını [2,4; 3,1] gün buldu. Hangisi <b>doğru</b> yorumdur?</p>', o: ['Bu yöntemle kurulan aralıkların yaklaşık %95’i gerçek ortalamayı kapsar.', 'Gerçek ortalamanın bu aralıkta olma olasılığı %95’tir; ortalama değişkendir.', 'Teslimatların %95’i 2,4 ile 3,1 gün arasında sürer.', 'Örneklem ortalaması %95 olasılıkla bu aralıktadır.'], a: 0,
        n: 'μ sabit bir sayıdır; güven, yöntemin uzun dönem başarısını anlatır.', yn: { 2: 'Aralık tek tek teslimatları değil, ortalamayı anlatır.', 3: 'x̄ aralığın tam ortasındadır; olasılık sorusu yok.' },
        ip: 'Rastgele olan aralıktır, μ değil.', cz: ['Her örneklem farklı bir aralık verir; μ sabittir.', 'Bu yüzden “%95”, aralıkların yaklaşık %95’inin μ’yü yakalamasıdır.'] });
      return out;
    }
  });

  /* ======================= BAHAR 4 ======================= */
  IST.hafta({
    id: 'b4', no: 4, renk: '#2F6FB0', tr: 'Tek örneklem hipotez testi I: kavramlar', en: 'One Sample Hypothesis Testing',
    sahneler: [
      {
        b: 'Fark gerçek mi, şans mı?', terim: [['hipotez', 'hypothesis'], ['sıfır hipotezi', 'null hypothesis H₀'], ['alternatif hipotez', 'alternative hypothesis H₁']],
        t: '<p>Eski tedarikçinin makine parçalarında ortalama arızalanma süresi <b>120 saat</b>. Mühendis yeni tedarikçiden 100 parça test ediyor: ortalama <b>118 saat</b>.</p><p>Yeni parçalar gerçekten daha mı kötü, yoksa 2 saatlik fark rastgele örneklemin sonucu mu? Başka bir 100’lük örneklem 124 saat verebilirdi. Hipotez testi bu soruya sistemli bir cevap verir.</p><p><b>H₀: μ = 120</b> (değişiklik yok) &nbsp; <b>H₁: μ ≠ 120</b>.</p>',
        v: function () { return V.norm({ m: 120, s: 1.5, sh: [117.06, 122.94], shc: '#E3F4EA', h: 230, xt: [[115, '115'], [118, '118'], [120, '120'], [124, '124'], [125, '125']], extra: function (xs, ys) { return '<g class="pop" ' + d(1.3) + '><circle cx="' + xs(118) + '" cy="' + ys(0.02) + '" r="7" fill="#C8553D"/></g><g class="pop" ' + d(1.6) + '><circle cx="' + xs(124) + '" cy="' + ys(0.02) + '" r="7" fill="#E0A526"/></g><text class="lbl fd" ' + d(1.8) + ' x="' + xs(120) + '" y="' + ys(0.12) + '" text-anchor="middle">H₀ doğruysa x̄’ler burada toplanır</text>'; } }); }
      },
      {
        b: 'Çift yönlü ve tek yönlü testler', terim: [['çift yönlü', 'two-tailed'], ['tek yönlü', 'one-tailed']],
        t: '<p>Kalite kontrol mühendisi silindirik parçanın çapının <b>25 mm</b> olup olmadığını merak ediyor:</p><ul><li>Fark her iki yönde de önemliyse: H₀: μ = 25, H₁: μ ≠ 25 (<b>çift yönlü</b>).</li><li>Yalnızca büyük olması sorunsa: H₁: μ &gt; 25 (<b>sağ kuyruk</b>).</li><li>Yalnızca küçük olması sorunsa: H₁: μ &lt; 25 (<b>sol kuyruk</b>).</li></ul><p>Eşitlik her zaman H₀’dadır; araştırmacının kanıtlamak istediği iddia H₁’dedir.</p>',
        v: function () { return ['iki', 'sag', 'sol'].map(function (t, i) { return V.norm({ m: 0, s: 1, sh: IST.redBolge(0.05, t), shc: PAL[1], h: 100, xt: [], d: i * 0.5 }).replace('</svg>', '<text class="lbb" x="30" y="14">' + ['H₁: μ ≠ 25', 'H₁: μ > 25', 'H₁: μ < 25'][i] + '</text></svg>'); }).join(''); }
      },
      {
        b: 'İki tür hata', terim: [['I. tür hata', 'Type I error (α)'], ['II. tür hata', 'Type II error (β)'], ['testin gücü', 'power 1 − β']],
        t: '<p>Mahkemeye benzer: H₀ “sanık masum”. Karar verirken iki hata yapılabilir:</p><ul><li><b>I. tür hata (α):</b> H₀ doğruyken reddetmek (masumu mahkûm etmek).</li><li><b>II. tür hata (β):</b> H₀ yanlışken reddetmemek (suçluyu serbest bırakmak).</li></ul><p>α’yı biz seçeriz (genellikle 0,05). n sabitken α küçülünce β büyür. <b>Güç = 1 − β</b>: yanlış H₀’ı yakalama olasılığı.</p>',
        v: function () { return V.tablo(['', 'H₀ doğru', 'H₀ yanlış'], [['<b>H₀ reddedilmez</b>', '✅ doğru karar (1 − α)', '❌ II. tür hata (β)'], ['<b>H₀ reddedilir</b>', '❌ I. tür hata (α)', '✅ doğru karar (güç, 1 − β)']], { st: 0.4, hi: { '0,2': 'hi', '1,1': 'hi', '0,1': 'ht', '1,2': 'ht' } }); }
      },
      {
        b: 'Anlamlılık düzeyi ve kritik değerler', terim: [['anlamlılık düzeyi', 'significance level α'], ['kritik değer', 'critical value'], ['red bölgesi', 'rejection region']],
        t: '<p>α, red bölgesinin toplam alanıdır. Standart normal tablodan kritik değerler:</p><p>Bu sınırların dışına düşen test istatistiği H₀ doğruysa “çok olağandışıdır”; H₀ reddedilir.</p>',
        v: function () { return V.tablo(['α', 'çift yönlü', 'sağ kuyruk', 'sol kuyruk'], [['0,10', '±1,645', '1,282', '−1,282'], ['0,05', '±1,96', '1,645', '−1,645'], ['0,01', '±2,576', '2,326', '−2,326']], { st: 0.25, hi: { '1,1': 'hi' }, n: [1, 2, 3] }) + '<div style="margin-top:12px">' + V.norm({ m: 0, s: 1, sh: [[-4, -1.96], [1.96, 4]], shc: PAL[1], h: 170, xt: [[-1.96, '−1,96'], [0, '0'], [1.96, '1,96']], d: 0.8, extra: function (xs, ys) { return '<text class="lbb" x="' + xs(0) + '" y="' + ys(0.18) + '" text-anchor="middle">kabul bölgesi</text><text class="lbm" x="' + xs(-3) + '" y="' + ys(0.06) + '" text-anchor="middle" style="fill:#C8553D">red</text><text class="lbm" x="' + xs(3) + '" y="' + ys(0.06) + '" text-anchor="middle" style="fill:#C8553D">red</text>'; } }) + '</div>'; }
      },
      {
        b: 'Hipotez testinin beş adımı', terim: [['test istatistiği', 'test statistic']],
        t: '<p>Her testte aynı yol izlenir:</p><ul><li>1. H₀ ve H₁’i yaz.</li><li>2. α’yı seç.</li><li>3. Test istatistiğini belirle ve hesapla (z, t…).</li><li>4. Karar kuralı: kritik değerle karşılaştır (ya da p-değeri &lt; α mı?).</li><li>5. Kararı <b>bağlam içinde</b> yorumla: “%5 düzeyinde ortalamanın 120 saatten farklı olduğuna dair yeterli kanıt yok.”</li></ul>',
        v: function () { return V.kart([{ ic: '①', b: 'Hipotezler', en: 'H₀, H₁' }, { ic: '②', b: 'α', en: 'significance level' }, { ic: '③', b: 'İstatistik', en: 'z = (x̄ − μ₀)/(σ/√n)' }, { ic: '④', b: 'Karar', en: 'critical value / p-value' }, { ic: '⑤', b: 'Yorum', en: 'conclusion in context' }]); }
      },
      {
        b: 'p-değeri', terim: [['p-değeri', 'p-value']],
        t: '<p><b>p-değeri:</b> H₀ doğruyken en az gözlenen kadar uç bir sonuç elde etme olasılığı. Ne kadar küçükse H₀ aleyhine kanıt o kadar güçlüdür.</p><p>Karar kuralı: <b>p &lt; α ise H₀ reddedilir</b>. Çift yönlü testte p = 2 × (tek kuyruk alanı).</p><p>Tedarikçi örneğinde σ = 15 saat varsayalım: z = (118 − 120)/(15/10) = −1,33; p = 2 × 0,0918 = <b>0,1836</b> &gt; 0,05 → H₀ reddedilmez.</p>',
        v: function () { return V.norm({ m: 0, s: 1, sh: [[-4, -1.33], [1.33, 4]], shc: PAL[3], h: 230, xt: [[-1.33, '−1,33'], [0, '0'], [1.33, '1,33']], extra: function (xs, ys) { return '<text class="lbb fd" ' + d(1.3) + ' x="' + xs(-2.4) + '" y="' + ys(0.12) + '" text-anchor="middle">0,0918</text><text class="lbb fd" ' + d(1.3) + ' x="' + xs(2.4) + '" y="' + ys(0.12) + '" text-anchor="middle">0,0918</text><text class="lbb fd" ' + d(1.6) + ' x="' + xs(0) + '" y="' + ys(0.43) + '" text-anchor="middle">p = 0,1836 > 0,05</text>'; } }); }
      }
    ],
    gorsel: {
      b: 'Hipotez mahkemesi: α, β ve güç', t: 'Mavi eğri H₀ doğruyken, turuncu eğri gerçek ortalama farklıyken test istatistiğinin dağılımı. α’yı, testin yönünü ve gerçek farkı değiştir; I. tür hata (kırmızı), II. tür hata (sarı) ve güç canlı hesaplanır.',
      kur: function (el) {
        var a = 0.05, tail = 'sag', dl = 2;
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>α <output data-ao></output></span><input type="range" min="0.01" max="0.2" step="0.01" value="0.05" data-a></label><div class="seg" data-t><button type="button" data-k="sol" aria-pressed="false">sol kuyruk</button><button type="button" data-k="iki" aria-pressed="false">çift yönlü</button><button type="button" data-k="sag" aria-pressed="true">sağ kuyruk</button></div><label><span>gerçek fark (standart hata cinsinden) <output data-do></output></span><input type="range" min="-4" max="4" step="0.1" value="2" data-d></label><div class="at-out" style="margin:0"><div><small>α (I. tür)</small><b data-x1></b></div><div><small>β (II. tür)</small><b data-x2></b></div><div><small>güç 1 − β</small><b data-x3></b></div></div></div><div class="at-v"><div data-s></div><div class="at-not" data-n></div></div></div>';
        var draw = function () {
          var R = IST.redBolge(a, tail), inR = function (z) { return R.some(function (q) { return z >= q[0] && z <= q[1]; }); };
          var beta = tail === 'iki' ? M.Phi(R[1][0] - dl) - M.Phi(R[0][1] - dl) : tail === 'sag' ? M.Phi(R[0][0] - dl) : 1 - M.Phi(R[0][1] - dl);
          var acc = tail === 'iki' ? [R[0][1], R[1][0]] : tail === 'sag' ? [-9, R[0][0]] : [R[0][1], 9];
          var xs = V.sc(-5, 7, 30, 520), ys = V.sc(0, 0.45, 210, 12), s = '<line x1="30" x2="520" y1="210" y2="210" stroke="#0D1838" stroke-width="2"/>';
          var alan = function (f, lo, hi, c, op) { lo = Math.max(-5, lo); hi = Math.min(7, hi); if (hi <= lo) return ''; var p = 'M' + xs(lo) + ' 210'; for (var i = 0; i <= 60; i++) { var x = lo + (hi - lo) * i / 60; p += 'L' + xs(x).toFixed(1) + ' ' + ys(f(x)).toFixed(1); } return '<path d="' + p + 'L' + xs(hi) + ' 210Z" fill="' + c + '" fill-opacity="' + op + '"/>'; };
          var f0 = function (x) { return M.npdf(x, 0, 1); }, f1 = function (x) { return M.npdf(x, dl, 1); };
          R.forEach(function (q) { s += alan(f0, q[0], q[1], PAL[1], 0.6); });
          s += alan(f1, acc[0], acc[1], PAL[3], 0.45);
          [[f0, PAL[0], 'H₀'], [f1, '#E0A526', 'gerçek']].forEach(function (c, j) { var p = []; for (var x = -5; x <= 7; x += 0.05) p.push(xs(x).toFixed(1) + ' ' + ys(c[0](x)).toFixed(1)); s += '<path d="M' + p.join('L') + '" fill="none" stroke="' + c[1] + '" stroke-width="3"/><text class="lbb" x="' + xs(j ? dl : 0) + '" y="' + (ys(0.4) - 6) + '" text-anchor="middle" style="fill:' + c[1] + '">' + c[2] + '</text>'; });
          R.forEach(function (q) { [q[0], q[1]].forEach(function (z) { if (z > -5 && z < 7) s += '<line x1="' + xs(z) + '" x2="' + xs(z) + '" y1="20" y2="210" stroke="#C8553D" stroke-width="2" stroke-dasharray="5 4"/><text class="lbm" x="' + xs(z) + '" y="226" text-anchor="middle">' + nf(z, 2) + '</text>'; }); });
          el.querySelector('[data-s]').innerHTML = V.svg(540, 236, s, 'H₀ ve gerçek dağılım');
          el.querySelector('[data-ao]').textContent = nf(a, 2); el.querySelector('[data-do]').textContent = nf(dl, 1);
          el.querySelector('[data-x1]').textContent = nf(a, 3); el.querySelector('[data-x2]').textContent = nf(beta, 3); el.querySelector('[data-x3]').textContent = nf(1 - beta, 3);
          el.querySelector('[data-n]').innerHTML = Math.abs(dl) < 0.05 ? 'Gerçek fark sıfır: H₀ doğru. Bu durumda yapılabilecek tek hata I. tür hatadır (α).' : 'α’yı küçültürsen kırmızı alan daralır ama sarı alan (β) büyür. ' + (tail !== 'iki' && (tail === 'sag') !== (dl > 0) ? 'Dikkat: test yanlış yöne bakıyor; güç neredeyse sıfır!' : 'Gerçek fark büyüdükçe güç artar.');
        };
        el.querySelector('[data-a]').oninput = function () { a = +this.value; draw(); };
        el.querySelector('[data-d]').oninput = function () { dl = +this.value; draw(); };
        [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (x) { x.onclick = function () { tail = x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); draw(); }; });
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var h = r.pick([['Bir dolum makinesinin şişelere ortalama 500 ml’den <b>az</b> doldurduğundan şüpheleniliyor.', 2, '500'], ['Yeni bir satış eğitiminin ortalama aylık satışı 40 birimin <b>üstüne</b> çıkardığı iddia ediliyor.', 1, '40'], ['Bir parçanın ortalama çapının 25 mm’den <b>farklı</b> olup olmadığı test edilecek.', 0, '25'], ['Bir kargonun ortalama teslim süresinin 48 saati <b>aştığından</b> şikâyet ediliyor.', 1, '48']]), hn = h[2];
      out.push({ tag: 'hipotez kurma', q: '<p>' + h[0] + '</p><p>Doğru hipotez çifti hangisidir?</p>', o: ['H₀: μ = ' + hn + ' · H₁: μ ≠ ' + hn, 'H₀: μ = ' + hn + ' · H₁: μ > ' + hn, 'H₀: μ = ' + hn + ' · H₁: μ < ' + hn, 'H₀: μ ≠ ' + hn + ' · H₁: μ = ' + hn], a: h[1], n: 'İddia (kanıtlanmak istenen) H₁’e, eşitlik H₀’a yazılır.', yn: { 3: 'Eşitlik her zaman H₀’dadır.' },
        ip: 'Araştırmacının kanıtlamak istediği yön H₁’i belirler.', cz: ['Eşitlik: H₀: μ = ' + hn + '.', 'İddianın yönü: ' + ['≠', '>', '<'][h[1]] + '.', 'Cevap: <b>H₁: μ ' + ['≠', '>', '<'][h[1]] + ' ' + hn + '</b>.'] });
      var A = r.pick([0.01, 0.05, 0.1]), T = r.pick(['iki', 'sag', 'sol']), zc = T === 'iki' ? M.zkr(A / 2) : T === 'sag' ? M.zkr(A) : -M.zkr(A);
      out.push({ viz: function (ka) { return IST.S.egri({ f: function (x) { return IST.M.npdf(x, 0, 1); }, a: -4, b: 4, ymax: 0.45, sh: IST.redBolge(A, T), shAdim: 0, isaret: [zc, 'z = ' + nf(zc, 3)], isAdim: 2, xt: [[0, '0']] }, ka); }, tag: 'kritik değer', q: '<p>α = <b>' + nf(A, 2) + '</b> ile <b>' + { iki: 'çift yönlü', sag: 'sağ kuyruk', sol: 'sol kuyruk' }[T] + '</b> bir z testi yapılıyor.</p><p>' + (T === 'iki' ? 'Pozitif kritik değer' : 'Kritik değer') + ' kaçtır? (üç ondalık; sol kuyrukta eksi işaretli)</p>', g: IST.ztab([Math.abs(zc)], { hi: false }), wide: true, say: zc, goster: nf(zc, 3), tol: 0.012, ornek: '1,645',
        ip: T === 'iki' ? 'Her kuyrukta α/2 kalır: P(0 < Z < z) = 0,5 − α/2.' : 'Tek kuyrukta α kalır: P(0 < Z < z) = 0,5 − α.', cz: ['Kuyruk alanı: ' + nf(T === 'iki' ? A / 2 : A, 3) + '.', 'Tabloda ' + nf(0.5 - (T === 'iki' ? A / 2 : A), 3) + '’e en yakın değer → z ≈ ' + nf(Math.abs(zc), 3) + '.', 'Cevap: <b>' + nf(zc, 3) + '</b>.'] });
      var e = r.pick([['Gerçekte kusursuz olan bir parti, testte “kusurlu” bulunup iade edildi.', 0], ['Gerçekte ortalaması düşmüş bir dolum hattı, testte “sorun yok” kararı aldı.', 1], ['Etkisiz bir ilaç, klinik testte etkili bulundu.', 0], ['Gerçekten işe yarayan bir reklam kampanyası, testte “etkisiz” bulundu.', 1]]);
      out.push({ tag: 'senaryo', q: '<p>' + X(e[0]) + '</p><p>Bu hangi tür hatadır?</p>', o: ['I. tür hata (α)', 'II. tür hata (β)', 'Hata yok; doğru karar'], a: e[1], n: e[1] ? 'H₀ yanlışken reddedilmedi.' : 'H₀ doğruyken reddedildi.',
        ip: 'Önce H₀’ı yaz (“değişiklik yok / etkisiz / kusursuz”). Gerçekte doğru muydu? Reddedildi mi?', cz: ['H₀ doğruyken red → I. tür; H₀ yanlışken red etmemek → II. tür.', 'Cevap: <b>' + (e[1] ? 'II. tür' : 'I. tür') + '</b>.'] });
      var z = (r() < 0.5 ? -1 : 1) * r.int(80, 290) / 100, p = 2 * (0.5 - M.ztab(z));
      out.push({ viz: function (ka) { return IST.S.egri({ f: function (x) { return IST.M.npdf(x, 0, 1); }, a: -4, b: 4, ymax: 0.45, sh: [[-9, -Math.abs(z)], [Math.abs(z), 9]], shAdim: 2, shc: PAL[3], isaret: [z, 'z = ' + nf(z, 2)], isAdim: 0, xt: [[-Math.abs(z), '−' + nf(Math.abs(z), 2)], [0, '0'], [Math.abs(z), nf(Math.abs(z), 2)]] }, ka); }, tag: 'p-değeri', q: '<p>Çift yönlü bir z testinde test istatistiği <b>z = ' + nf(z, 2) + '</b> bulundu.</p><p>p-değeri kaçtır? (dört ondalık)</p>', g: IST.ztab([z]), wide: true, say: p, goster: nf(p, 4), tol: 0.0011, ornek: '0,1836',
        yanlis: function (v) { return Math.abs(v - p / 2) < 0.0015 ? 'Tek kuyruğu buldun; çift yönlüde iki ile çarp.' : 'p = 2 × P(Z > |z|).'; },
        ip: 'p = 2 × (0,5 − P(0 < Z < |z|)).', cz: ['Tablo: P(0 < Z < ' + nf(Math.abs(z), 2) + ') = ' + nf(M.ztab(z), 4, false) + '.', 'Tek kuyruk = 0,5 − ' + nf(M.ztab(z), 4, false) + ' = ' + nf(0.5 - M.ztab(z), 4) + '.', 'p = 2 × ' + nf(0.5 - M.ztab(z), 4) + ' = <b>' + nf(p, 4) + '</b>.'] });
      var A2 = r.pick([0.01, 0.05, 0.1]), p2 = r.pick([0.003, 0.012, 0.024, 0.038, 0.047, 0.062, 0.081, 0.12, 0.3]), rej = p2 < A2;
      out.push({ tag: 'karar', q: '<p>Bir testte p-değeri <b>' + nf(p2, 3) + '</b>, anlamlılık düzeyi α = <b>' + nf(A2, 2) + '</b>.</p><p>Karar nedir?</p>', o: ['H₀ reddedilir', 'H₀ reddedilmez', 'H₀ kesin olarak kanıtlanır'], a: rej ? 0 : 1, n: rej ? 'p < α: veri H₀ ile pek uyuşmuyor.' : 'p ≥ α: H₀’ı reddetmek için yeterli kanıt yok (bu, H₀’ın kanıtlandığı anlamına gelmez).', yn: { 2: 'Testler H₀’ı asla “kanıtlamaz”; yalnızca reddeder ya da reddetmez.' },
        ip: 'Kural: p < α ⇒ H₀ red.', cz: [nf(p2, 3) + (rej ? ' < ' : ' ≥ ') + nf(A2, 2) + '.', 'Karar: <b>' + (rej ? 'H₀ reddedilir' : 'H₀ reddedilmez') + '</b>.'] });
      return out;
    }
  });
})();
