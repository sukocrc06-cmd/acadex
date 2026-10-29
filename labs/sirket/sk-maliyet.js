/* ==========================================================================
   ACADEX ŞİRKET · MALİYET, BAŞABAŞ VE BÜTÇE (labs/sirket/sk-maliyet.js), 29.10.2026
   Termos üretimi: fiyat, değişken ve sabit maliyet sürgüleri; gelir/maliyet
   grafiği, başabaş noktası, hedef kâr, güvenlik marjı, faaliyet kaldıracı.
   Bütçe–gerçekleşen: satış fiyat/hacim ve malzeme fiyat/miktar sapmaları;
   her sapmayı sorumlu birime bağla.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, SK = FN.sk, V = SK.V, M = SK.M, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, tl = C.tl, pct = C.pct;
  var U = V.URUN, sec;
  var S = C.ls.get('sk.mt', null) || { f: U.fiyat, d: U.degisken, s: U.sabit, a: 7000, as: {} };
  var save = function () { C.ls.set('sk.mt', S); };

  var bep = function () {
    var b = M.bep(S.s, S.f, S.d), h = M.hedefAdet(S.s, U.hedefKar, S.f, S.d), k = M.kar(S.a, S.s, S.f, S.d), kp = M.kp(S.f, S.d);
    var xmax = U.kapasite, rev = [[0, 0], [xmax, xmax * S.f]], cost = [[0, S.s], [xmax, S.s + xmax * S.d]];
    var ch = C.chart({ w: 640, h: 300, x: [0, xmax], y0: true, al: 'başabaş grafiği', xf: function (v) { return nf(v / 1000, 0) + 'b'; }, yf: function (v) { return nf(v / 1e6, 1) + 'mn'; }, xl: 'adet', yl: 'TL',
      s: [{ p: cost, c: '#C8553D', lab: 'toplam maliyet' }, { p: rev, c: '#2F6FB0', lab: 'gelir' }, { p: [[0, S.s], [xmax, S.s]], c: '#9AA6B8', d: '5 5', w: 1.6, lab: 'sabit' }],
      vl: (isFinite(b) && b <= xmax ? [{ x: b, c: '#3E8E5B', lab: 'başabaş ' + nf(Math.ceil(b)) }] : []).concat([{ x: S.a, c: '#0D1838', lab: 'satış ' + nf(S.a) }]),
      dots: isFinite(b) && b <= xmax ? [{ x: b, y: b * S.f, c: '#3E8E5B', r: 6, cls: 'me' }] : [] });
    $('[data-bep-ch]', sec).innerHTML = ch;
    $('[data-bep-k]', sec).innerHTML =
      '<div class="kpi hl"><small>başabaş noktası</small><b>' + (isFinite(b) ? nf(Math.ceil(b)) + ' adet' : 'yok') + '</b></div>' +
      '<div class="kpi"><small>birim katkı payı</small><b>' + tl(kp) + '</b></div>' +
      '<div class="kpi"><small>katkı payı oranı</small><b>' + pct(kp / S.f) + '</b></div>' +
      '<div class="kpi"><small>' + nf(S.a) + ' adette kâr</small><b style="color:' + (k >= 0 ? 'var(--ok)' : 'var(--bad)') + '">' + tl(k) + '</b></div>' +
      '<div class="kpi"><small>' + nf(U.hedefKar) + ' TL kâr için</small><b>' + (isFinite(h) ? nf(Math.ceil(h)) + ' adet' : '—') + '</b></div>' +
      '<div class="kpi"><small>güvenlik marjı</small><b>' + (isFinite(b) ? pct(M.guvenlik(S.a, S.s, S.f, S.d)) : '—') + '</b></div>' +
      '<div class="kpi"><small>faaliyet kaldıracı</small><b>' + (k > 0 ? nf(M.fk(S.a, S.s, S.f, S.d), 2) + ' kat' : '—') + '</b></div>';
    $('[data-bep-f]', sec).innerHTML = 'başabaş = sabit ÷ (fiyat − değişken) = ' + nf(S.s) + ' ÷ (' + nf(S.f) + ' − ' + nf(S.d) + ') = <b>' + (isFinite(b) ? nf(b, 1) : '∞') + '</b> adet';
    $('[data-bep-tip]', sec).innerHTML = SK.tip(kp <= 0 ? 'Fiyat değişken maliyetin altında: her termos zarar ettiriyor, daha çok satmak zararı büyütür.'
      : b > U.kapasite ? 'Başabaş noktası kapasitenin (' + nf(U.kapasite) + ') üstünde: tam kapasitede bile zarar. Fiyatı ya da sabit giderleri gözden geçir.'
      : k > 0 ? 'Satış %10 artarsa kâr yaklaşık %' + nf(M.fk(S.a, S.s, S.f, S.d) * 10, 0) + ' artar: faaliyet kaldıracı ' + nf(M.fk(S.a, S.s, S.f, S.d), 2) + '. Sabit gider oranı yüksek şirkette kâr satışa çok duyarlıdır.'
      : 'Başabaşa ' + nf(Math.ceil(b - S.a)) + ' adet daha var. Sabit giderin karşılanmadan kâr başlamaz.', isFinite(b) ? nf(Math.ceil(b)) : '∞');
  };

  var SAP = [
    ['satFiyat', 'Satış fiyat sapması', 'pazarlama'], ['satHacim', 'Satış hacim sapması', 'satis'],
    ['mFiyat', 'Malzeme fiyat sapması', 'satinalma'], ['mMiktar', 'Malzeme miktar sapması', 'uretim']
  ];
  var BIRIM = [['pazarlama', 'Pazarlama (fiyat)'], ['satis', 'Satış ekibi'], ['satinalma', 'Satın alma'], ['uretim', 'Üretim']];
  var NEDEN = { satFiyat: 'Fiyatı bütçeden yüksek gerçekleşti: fiyat kararı pazarlamanın.', satHacim: 'Bütçeden az adet satıldı: satış ekibinin hedefi.', mFiyat: 'Çelik kilosu bütçeden ucuz alındı: satın almanın başarısı.', mMiktar: 'Termos başına daha çok çelik harcandı (fire): üretimin sorumluluğu.' };
  var butce = function () {
    var B = V.BUTCE, sp = M.sapma(B), box = $('[data-bt]', sec);
    var cell = function (v) { return '<td class="n" style="color:' + (v >= 0 ? 'var(--ok)' : 'var(--bad)') + ';font-weight:700">' + SK.sgn(v, function (x) { return nf(x); }) + ' <small>' + (v >= 0 ? 'lehte' : 'aleyhte') + '</small></td>'; };
    box.innerHTML = '<div class="tbl-w"><table class="t"><thead><tr><th></th><th class="n">bütçe</th><th class="n">gerçekleşen</th></tr></thead><tbody>' +
      '<tr><td>Satış adedi</td><td class="n">' + nf(B.b.adet) + '</td><td class="n">' + nf(B.g.adet) + '</td></tr>' +
      '<tr><td>Birim fiyat</td><td class="n">' + tl(B.b.fiyat) + '</td><td class="n">' + tl(B.g.fiyat) + '</td></tr>' +
      '<tr><td>Termos başına çelik</td><td class="n">' + nf(B.b.kg, 2) + ' kg</td><td class="n">' + nf(B.g.kg, 2) + ' kg</td></tr>' +
      '<tr><td>Çelik kg fiyatı</td><td class="n">' + tl(B.b.kgFiyat) + '</td><td class="n">' + tl(B.g.kgFiyat) + '</td></tr>' +
      '<tr><td><b>Satış geliri</b></td><td class="n">' + tl(sp.gelirB) + '</td><td class="n">' + tl(sp.gelirG) + '</td></tr>' +
      '<tr><td><b>Malzeme maliyeti</b></td><td class="n">' + tl(sp.malzB) + '</td><td class="n">' + tl(sp.malzG) + '</td></tr></tbody></table></div>' +
      '<p class="k" style="margin:14px 0 6px">sapmalar · her birini sorumlu birime bağla</p><div class="bt-rows">' +
      SAP.map(function (x) {
        return '<div class="bt-r"><div><b>' + x[1] + '</b><table class="t"><tr>' + cell(sp[x[0]]) + '</tr></table></div><div class="seg" data-as="' + x[0] + '">' +
          BIRIM.map(function (b) { return '<button type="button" data-b="' + b[0] + '" aria-pressed="' + (S.as[x[0]] === b[0]) + '">' + b[1] + '</button>'; }).join('') + '</div><p class="fb" data-asf="' + x[0] + '"></p></div>';
      }).join('') + '</div>' +
      '<div class="formula">fiyat sapması = (gerçek fiyat − bütçe fiyatı) × gerçek adet<br>hacim sapması = (gerçek adet − bütçe adedi) × bütçe fiyatı<br>malzeme fiyat = (std kg fiyatı − gerçek kg fiyatı) × gerçek kg<br>malzeme miktar = (std kg − gerçek kg) × std kg fiyatı</div>';
    var fb = function (k) {
      var x = SAP.filter(function (y) { return y[0] === k; })[0], a = S.as[k], el = $('[data-asf="' + k + '"]', box); if (!a) { el.innerHTML = ''; return; }
      el.innerHTML = a === x[2] ? '<b style="color:var(--ok)">Doğru.</b> ' + NEDEN[k] : '<b style="color:var(--bad)">Tekrar düşün.</b> ' + (k[0] === 's' ? 'Bu bir satış sapması.' : 'Bu bir malzeme sapması.') + ' Kimin kararıyla oluşur?';
    };
    $$('[data-as]', box).forEach(function (g) {
      var k = g.getAttribute('data-as'); fb(k);
      $$('[data-b]', g).forEach(function (b) { b.onclick = function () { S.as[k] = b.getAttribute('data-b'); save(); $$('[data-b]', g).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); fb(k); FN.bridgeSend(); }; });
    });
  };

  FN.st.maliyet = {
    init: function () {
      sec = $('#maliyet');
      var sl = function (k, l, mn, mx, st) { return '<label class="sl"><span>' + l + '</span><input type="range" min="' + mn + '" max="' + mx + '" step="' + st + '" data-m="' + k + '" value="' + S[k] + '"><output data-mo="' + k + '"></output></label>'; };
      sec.innerHTML = '<div class="grid gside"><div class="card box" style="--cc:var(--rust)"><span class="k">istasyon · maliyet · ' + X(U.ad) + '</span><h2>Kaç termos satmalıyız?</h2>' +
        '<p class="sub">Sabit gider (kira, maaş, amortisman) üretim yapsak da yapmasak da vardır. Her termos <b>katkı payı</b> (fiyat − değişken maliyet) kadar sabit gideri öder; hepsi ödenince kâr başlar.</p>' +
        sl('f', 'fiyat', 40, 150, 1) + sl('d', 'değişken maliyet', 20, 110, 1) + sl('s', 'sabit gider (ay)', 60000, 320000, 5000) + sl('a', 'satış adedi', 0, U.kapasite, 100) +
        '<div class="formula" data-bep-f></div><div data-bep-tip></div></div>' +
        '<div class="card box" style="--cc:var(--blue)"><span class="k">gelir ve maliyet doğruları</span><h2>Başabaş grafiği</h2><div data-bep-ch></div><div class="kpis" data-bep-k></div></div></div>' +
        '<div class="card box" style="--cc:var(--green);margin-top:18px"><span class="k">bütçe kontrolü · ay</span><h2>Bütçe tuttu mu? Sapma analizi</h2>' +
        '<p class="sub">Gerçekleşen kâr bütçeden farklıysa nedenini parçalara ayırırız: fiyat mı, adet mi, malzemenin fiyatı mı, harcanan miktar mı? Her sapmanın bir sahibi vardır.</p><div data-bt></div></div>';
      var out = function () {
        $('[data-mo="f"]', sec).textContent = tl(S.f); $('[data-mo="d"]', sec).textContent = tl(S.d);
        $('[data-mo="s"]', sec).textContent = nf(S.s / 1000) + 'b TL'; $('[data-mo="a"]', sec).textContent = nf(S.a);
      };
      $$('[data-m]', sec).forEach(function (i) { i.oninput = function () { S[i.getAttribute('data-m')] = +i.value; save(); out(); bep(); FN.bridgeSend(); }; });
      out(); bep(); butce();
    },
    ctx: function () {
      var b = M.bep(S.s, S.f, S.d);
      return { sel: { key: 'sirket.maliyet', title: 'başabaş',
        rows: [['fiyat', tl(S.f)], ['değişken maliyet', tl(S.d)], ['sabit gider', tl(S.s)], ['satış adedi', nf(S.a)], ['başabaş', isFinite(b) ? nf(Math.ceil(b)) + ' adet' : 'yok'], ['kâr', tl(M.kar(S.a, S.s, S.f, S.d))]],
        about: 'öğrenci maliyet-hacim-kâr analizi, başabaş noktası ve bütçe sapmalarını çalışıyor.' },
        chips: ['Faaliyet kaldıracı ne demek?', 'Sabit ve değişken maliyet örnekleri ver', 'Malzeme miktar sapması neden üretimin?'] };
    }
  };
})();
