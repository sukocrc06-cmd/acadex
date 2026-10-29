/* ==========================================================================
   ACADEX FİNANS · KUR VE MAKRO (labs/finans/fn-makro.js), 29.10.2026
   1) Forward ile kur riskinden korunma: faiz paritesiyle forward kur,
      gelecekteki spot senaryosuna göre korunmalı ↔ korunmasız TL tutarı
   2) Para politikası aktarım zinciri: faiz kararı → piyasa faizleri → talep,
      kur, beklentiler → enflasyon (sırayla yanan düğümler)
   3) Fisher: nominal faiz, enflasyon, reel faiz
   Kurlar ve faizler kurgusaldır.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, tl = C.tl, pct = C.pct, num = C.num;
  var K0 = V.KUR;
  var S = C.ls.get('mk', null) || { spot: K0.spot, iTL: K0.iTL * 100, iUSD: K0.iUSD * 100, gun: K0.gun, tutar: K0.tutar, sen: 10, yon: 0, ni: 45, enf: 33 };
  var save = function () { C.ls.set('mk', S); };
  var sec, tmr = [];

  /* örtülü faiz paritesi (basit faiz, 360 gün) */
  var fwd = function (s, iTL, iUSD, g) { return s * (1 + iTL * g / 360) / (1 + iUSD * g / 360); };
  var fisher = function (i, p) { return (1 + i) / (1 + p) - 1; };
  FN.makro = { fwd: fwd, fisher: fisher };
  /* aktarım: artırımda yön (+1 yükselir, −1 düşer) ve açıklama */
  var AK = {
    politika: [1, 'Merkez bankası kısa vadeli borç verme faizini artırır.', 'Merkez bankası kısa vadeli borç verme faizini indirir.'],
    piyasa: [1, 'Bankaların fonlama maliyeti yükselir; kredi ve mevduat faizleri artar.', 'Bankaların fonlama maliyeti düşer; kredi ve mevduat faizleri azalır.'],
    kredi: [-1, 'Borçlanmak pahalılaşır, biriktirmek cazipleşir: kredi hacmi ve harcama azalır.', 'Borçlanmak ucuzlar, biriktirmenin cazibesi azalır: kredi hacmi ve harcama artar.'],
    talep: [-1, 'Tüketim ve yatırım yavaşlar; toplam talep düşer.', 'Tüketim ve yatırım hızlanır; toplam talep artar.'],
    kur: [-1, 'TL varlıkların getirisi artar, TL’ye talep yükselir: döviz kuru düşer (TL değer kazanır), ithal ürünler ucuzlar.', 'TL varlıkların getirisi azalır: döviz kuru yükselir (TL değer kaybeder), ithal ürünler pahalılaşır.'],
    bekl: [-1, 'Kararlı bir duruş gelecekteki enflasyon beklentisini aşağı çeker; fiyatlama davranışı yumuşar.', 'Gevşeme, enflasyon beklentisini yukarı itebilir; fiyat artışları hızlanabilir.'],
    enf: [-1, 'Talep, kur ve beklenti kanallarıyla enflasyon düşer. Etkiler genellikle aylar içinde ve gecikmeli gelir.', 'Talep, kur ve beklenti kanallarıyla enflasyon yükselir. Etkiler genellikle aylar içinde ve gecikmeli gelir.']
  };

  var html = function () {
    return '<div class="grid">' +
      '<div class="card box" style="--cc:var(--deep)"><span class="k">istasyon · kambiyo gişesi · kurgusal kur ve faiz</span><h2>90 gün sonra gelecek doları bugünden sabitle</h2><p class="sub">Bir ihracatçı ileride döviz alacak. Kur düşerse eline daha az TL geçer. Forward sözleşme, bugünden bir kur kilitler. Kaydırıcıyla gelecekteki kuru değiştir.</p>' +
      '<div class="grid gside"><div><div class="fl">' +
      '<label class="fld">Alacak (USD)<input type="text" inputmode="decimal" data-m="tutar" value="' + nf(S.tutar) + '"></label><label class="fld">Spot kur (TL/USD)<input type="text" inputmode="decimal" data-m="spot" value="' + nf(S.spot, 2) + '"></label>' +
      '<label class="fld">TL faizi (yıllık %)<input type="text" inputmode="decimal" data-m="iTL" value="' + nf(S.iTL, 1) + '"></label><label class="fld">USD faizi (yıllık %)<input type="text" inputmode="decimal" data-m="iUSD" value="' + nf(S.iUSD, 1) + '"></label>' +
      '<label class="fld">Vade (gün)<input type="text" inputmode="numeric" data-m="gun" value="' + S.gun + '"></label></div>' +
      '<label class="fld" style="margin-top:12px">Vadede spot kur: <b data-o="sen"></b><input type="range" min="-25" max="40" step="1" data-m="sen" value="' + S.sen + '"><small>spot kura göre değişim</small></label>' +
      '<div class="kpis" data-k="fw"></div><div class="formula" data-f="fw"></div></div>' +
      '<div><div data-c="fw"></div><div class="leg"><span><i style="background:#1F8A7A;height:3px"></i>forward ile (kilitli)</span><span><i style="background:#C8553D;height:3px"></i>korunmasız</span><span><i style="background:#0D1838"></i>seçili senaryo</span></div><div data-tip="fw"></div></div></div></div>' +
      '<div class="grid g2">' +
      '<div class="card box" style="--cc:var(--sea)"><span class="k">para politikası</span><h3>Faiz kararı ekonomiye nasıl yayılır?</h3><div class="row" style="margin:8px 0 14px"><button type="button" class="btn pri" data-yon="1">Faizi artır</button><button type="button" class="btn" data-yon="-1">Faizi indir</button></div><div class="chain" data-chain></div><div data-ctip></div></div>' +
      '<div class="card box" style="--cc:var(--must)"><span class="k">Fisher denklemi</span><h3>Nominal faiz, enflasyon, reel faiz</h3><div class="fl"><label class="fld">Nominal faiz (yıllık %)<input type="range" min="0" max="80" step="0.5" data-m="ni" value="' + S.ni + '"><small data-o="ni"></small></label><label class="fld">Enflasyon (yıllık %)<input type="range" min="0" max="80" step="0.5" data-m="enf" value="' + S.enf + '"><small data-o="enf"></small></label></div><div class="kpis" data-k="fi"></div><div data-c="fi"></div><div class="formula" data-f="fi"></div></div>' +
      '</div></div>';
  };
  var paintFW = function () {
    var s = S.spot, F = fwd(s, S.iTL / 100, S.iUSD / 100, S.gun), A = S.tutar, sT = s * (1 + S.sen / 100);
    $('[data-o="sen"]', sec).textContent = nf(sT, 2) + ' TL (' + (S.sen >= 0 ? '+' : '') + S.sen + '%)';
    var lo = s * 0.75, hi = s * 1.4, un = [[lo, A * lo], [hi, A * hi]], he = [[lo, A * F], [hi, A * F]];
    $('[data-c="fw"]', sec).innerHTML = C.chart({ w: 620, h: 300, x: [lo, hi], s: [{ p: un, c: '#C8553D', w: 2.6, lab: 'korunmasız' }, { p: he, c: '#1F8A7A', w: 3, lab: 'forward' }], dots: [{ x: sT, y: A * sT, c: '#C8553D', r: 6 }, { x: sT, y: A * F, c: '#0D1838', r: 7, cls: 'me' }], vl: [{ x: F, c: '#1F8A7A', lab: 'F = ' + nf(F, 2) }], xf: function (v) { return nf(v, 0); }, yf: function (v) { return nf(v / 1e6, 1) + ' mn'; }, xl: 'vadedeki spot kur', yl: 'eline geçen TL', al: 'forward korunma grafiği', anim: false });
    var d = A * F - A * sT, prem = (F / s - 1) * 360 / S.gun;
    $('[data-k="fw"]', sec).innerHTML = '<div class="kpi hl"><small>forward kur</small><b>' + nf(F, 4) + '</b></div><div class="kpi"><small>yıllık forward primi</small><b>' + pct(prem, 1) + '</b></div><div class="kpi"><small>forward ile</small><b>' + tl(A * F) + '</b></div><div class="kpi"><small>korunmasız</small><b>' + tl(A * sT) + '</b></div>';
    $('[data-f="fw"]', sec).innerHTML = 'F = S · (1 + i<sub>TL</sub>·g/360) / (1 + i<sub>USD</sub>·g/360)<br>= ' + nf(s, 2) + ' · (1 + ' + nf(S.iTL / 100, 3) + '·' + S.gun + '/360) / (1 + ' + nf(S.iUSD / 100, 3) + '·' + S.gun + '/360) = <b>' + nf(F, 4) + '</b>';
    $('[data-tip="fw"]', sec).innerHTML = C.tip(d >= 0 ? 'Bu senaryoda kur forward’ın altında kaldı: korunma sana <b>' + tl(d) + '</b> kazandırdı.' : 'Bu senaryoda kur forward’ın üstüne çıktı: korunmasaydın <b>' + tl(-d) + '</b> daha fazla alırdın. Forward kazanç aracı değil, belirsizliği yok etme aracıdır.', d >= 0 ? '+' + nf(d / 1e3) + 'b' : nf(d / 1e3) + 'b');
  };
  var chain = function (yon, anim) {
    tmr.forEach(clearTimeout); tmr = [];
    var box = $('[data-chain]', sec), keys = V.AKTARIM;
    box.innerHTML = keys.map(function (k, i) { var d = yon ? AK[k[0]][0] * yon : 0; return (i ? '<span class="ar" data-ar="' + i + '">→</span>' : '') + '<span class="nd ' + (d > 0 ? 'up' : d < 0 ? 'dn' : '') + '" data-nd="' + i + '" title="' + X(AK[k[0]][yon < 0 ? 2 : 1]) + '"><b>' + (d > 0 ? '↑' : d < 0 ? '↓' : '·') + '</b>' + X(k[1]) + '</span>'; }).join('');
    var show = function (i) { var n = $('[data-nd="' + i + '"]', box), a = $('[data-ar="' + i + '"]', box); if (n) n.classList.add('on'); if (a) a.classList.add('on'); var k = keys[i][0]; $('[data-ctip]', sec).innerHTML = C.tip('<b>' + X(keys[i][1]) + ' ' + (AK[k][0] * yon > 0 ? 'yükselir' : 'düşer') + '.</b> ' + X(yon > 0 ? AK[k][1] : AK[k][2]), yon > 0 ? '↑%' : '↓%'); };
    if (!yon) { $$('.nd', box).forEach(function (n) { n.classList.add('on'); }); $$('.ar', box).forEach(function (n) { n.classList.add('on'); }); $('[data-ctip]', sec).innerHTML = C.tip('Bir karar seç; etkisini zincir boyunca adım adım izle. Düğümün üstüne gelince açıklaması görünür.', '?'); return; }
    keys.forEach(function (_, i) { if (anim && !C.RM) tmr.push(setTimeout(function () { show(i); }, i * 650)); else show(i); });
  };
  var paintFI = function () {
    var i = S.ni / 100, p = S.enf / 100, r = fisher(i, p);
    $('[data-o="ni"]', sec).textContent = '%' + nf(S.ni, 1); $('[data-o="enf"]', sec).textContent = '%' + nf(S.enf, 1);
    $('[data-k="fi"]', sec).innerHTML = '<div class="kpi hl"><small>reel faiz</small><b style="color:' + (r < 0 ? '#FF9C8F' : '#9FE6CF') + '">' + pct(r, 2) + '</b></div><div class="kpi"><small>yaklaşık (i − π)</small><b>' + pct(i - p, 1) + '</b></div><div class="kpi"><small>100 TL’nin alım gücü</small><b>' + nf(100 * (1 + r), 1) + '</b></div>';
    $('[data-c="fi"]', sec).innerHTML = C.chart({ w: 520, h: 150, x: [-0.6, 2.6], y0: true, bars: [{ x: 0, y0: 0, y1: S.ni, c: '#2F6FB0', lab: 'nominal' }, { x: 1, y0: 0, y1: S.enf, c: '#C8553D', lab: 'enflasyon' }, { x: 2, y0: 0, y1: r * 100, c: r < 0 ? '#C9483B' : '#1F8A7A', lab: 'reel' }], nb: 3, xticks: [0, 1, 2], xf: function (v) { return ['nominal', 'enflasyon', 'reel'][v]; }, yf: function (v) { return '%' + nf(v); }, al: 'faiz karşılaştırması' });
    $('[data-f="fi"]', sec).innerHTML = '1 + r = (1 + i) / (1 + π) → r = ' + nf(1 + i, 3) + ' / ' + nf(1 + p, 3) + ' − 1 = <b>' + pct(r, 2) + '</b>';
  };

  FN.st.makro = {
    init: function () {
      sec = $('#makro'); sec.innerHTML = html(); paintFW(); chain(S.yon, false); paintFI();
      sec.addEventListener('input', function (e) {
        var k = e.target.getAttribute('data-m'); if (!k) return;
        var v = e.target.type === 'range' ? Number(e.target.value) : num(e.target.value); if (!isFinite(v)) return;
        if (k === 'gun') v = C.clamp(Math.round(v), 1, 720); if (k === 'spot' && v <= 0) return;
        S[k] = v; save(); if (k === 'ni' || k === 'enf') paintFI(); else paintFW();
        clearTimeout(paintFW.t); paintFW.t = setTimeout(FN.bridgeSend, 300);
      });
      sec.addEventListener('click', function (e) { var b = e.target.closest('[data-yon]'); if (!b) return; S.yon = +b.getAttribute('data-yon'); save(); chain(S.yon, true); FN.bridgeSend(); });
    },
    hide: function () { tmr.forEach(clearTimeout); },
    ctx: function () {
      var F = fwd(S.spot, S.iTL / 100, S.iUSD / 100, S.gun);
      return { sel: { key: 'finans.makro', title: 'forward ' + nf(F, 2), la: 'Kur ve makro',
          rows: [['Forward', S.tutar + ' USD alacak, spot ' + nf(S.spot, 2) + ', TL faizi %' + nf(S.iTL, 1) + ', USD faizi %' + nf(S.iUSD, 1) + ', ' + S.gun + ' gün → F ' + nf(F, 4) + ' (kurgusal)'], ['Senaryo', 'vadede spot ' + nf(S.spot * (1 + S.sen / 100), 2)], ['Faiz kararı', S.yon > 0 ? 'artırım zinciri izleniyor' : S.yon < 0 ? 'indirim zinciri izleniyor' : 'seçilmedi'], ['Fisher', 'nominal %' + nf(S.ni, 1) + ', enflasyon %' + nf(S.enf, 1) + ' → reel ' + pct(fisher(S.ni / 100, S.enf / 100), 2)]],
          about: 'öğrenci Acadex Finans kur ve makro istasyonunda forward korunma, para politikası aktarımı ve reel faizi çalışıyor. Güncel gerçek kur/faiz tahmini yapma; kavramı açıkla.' },
        chips: [['parite', 'Forward kur neden spottan yüksek?'], ['opsiyon', 'Forward yerine opsiyon alsam ne değişir?'], ['gecikme', 'Faiz kararının etkisi neden gecikir?']] };
    },
    classify: function (q) { if (/parite|forward.*(yüksek|neden)/.test(q)) return 'parite'; if (/opsiyon/.test(q)) return 'opsiyon'; if (/gecik/.test(q)) return 'gecikme'; return null; },
    answer: function (k) {
      var F = fwd(S.spot, S.iTL / 100, S.iUSD / 100, S.gun);
      if (k === 'parite') return 'Örtülü faiz paritesine göre forward kur, iki para birimi arasındaki faiz farkını yansıtır. TL faizi (%' + nf(S.iTL, 1) + ') USD faizinden (%' + nf(S.iUSD, 1) + ') yüksek olduğu için forward kur spottan yüksektir (' + nf(F, 4) + '). Aksi hâlde biri TL’de faiz kazanıp bugünden dolar satarak risksiz kâr (arbitraj) elde ederdi. Forward kur bir kur tahmini değildir.';
      if (k === 'opsiyon') return 'Forward seni bir kura bağlar: kur lehine dönse de o kurdan satarsın. Satım opsiyonu (put) ise bir prim karşılığı “en kötü ihtimalle şu kurdan satma hakkı” verir: kur düşerse korunursun, yükselirse opsiyonu kullanmaz, yüksek kurdan satarsın. Esneklik bedavaya gelmez: primi peşin ödersin. Türev ürünler istasyonunda bu ödemeleri çizebilirsin.';
      if (k === 'gecikme') return 'Faiz kararı önce piyasa faizlerine hızla yansır, ama kredi sözleşmeleri, yatırım planları ve fiyat ayarlamaları zaman alır. Hane halkı ve şirketler harcamalarını kademeli değiştirir; ücret ve kira sözleşmeleri belirli aralıklarla yenilenir. Bu yüzden politika etkisi genellikle birkaç çeyrek içinde ve dağılarak görülür.';
      return null;
    }
  };
})();
