/* ==========================================================================
   ACADEX KIDS · oyun parkı (kids/assets/kids-park.js), 12.11.2026
   Her konuya eklenen "Park" durağı; oyun madalya seviyesine göre değişir, böylece
   Bronz · Gümüş · Altın'da çocuk her seferinde başka bir şey oynar:
     Bronz  · Ses avı   : dağınık, süzülen resimler; "Point to the cat!" denen resme dokun.
                          Seri yaptıkça notalar yükselir.
     Gümüş  · Yapboz    : resim 4 / 6 / 9 parçaya bölünür; yanıp sönen yere doğru parçayı seç.
              Gölge     : (yapbozla dönüşümlü) gölgesi gösterilen resmi bul.
     Altın  · Harf treni: kelimenin eksik harfini seç, vagona koy, tren düdük çalıp gider
                          (yazı gösterilen yaş dünyalarında; Miniklerde yerine gölge oyunu).
   Kurallar diğer oyunlarla aynı: yalnız dokunma, yanlışta ceza yok, doğru cevap
   kelime ustalığına sayılır (a.dogru). W.KIDS_OYUN.park / sesavi / yapboz / golge / harf
   ========================================================================== */
(function (W) {
  'use strict';
  var C = W.KIDS_CIZ, SES = W.KIDS_SES, O = W.KIDS_OYUN, K = W.KIDS_KONU;
  var kar = O.kar, yildizHesap = O.yildizHesap, salla = O.salla, yonerge = O.yonerge, turNokta = O.turNokta;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function rasgele(l, degil) { var a = l.filter(function (x) { return x !== degil; }); return a[Math.floor(Math.random() * a.length)] || l[0]; }
  function bitir(a, yanlis, metin) { return SES.soyle(metin || 'Super!', 'en').then(function () { a.bitti(yildizHesap(yanlis, [1, 3])); }); }
  /* çizimin iç kısmı ve viewBox'ı (yapboz kırpması ve gölge için) */
  function parcala(svg) { var m = /viewBox="([^"]+)"/.exec(svg) || [0, '0 0 100 100']; return { vb: m[1].split(/\s+/).map(Number), ic: String(svg).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') }; }

  /* ---------------- Ses avı ---------------- */
  function sesavi(kok, a) {
    var P = a.paket, l = kar(a.renkler).slice(0, Math.min(a.renkler.length, a.bant.secenek + 3)), tura = a.bant.tur, tur = 0, yanlis = 0, seri = 0, hedef = null, bitti = false, kilit = false, kalan = l.slice();
    kok.innerHTML = '<div class="ko ko-park ko-sesavi">' + yonerge('', a.bant.yazi) + '<div class="ko-avalan" data-ko-alan>' +
      (function () { var sut = Math.ceil(Math.sqrt(l.length * 0.8)), sat = Math.ceil(l.length / sut), yer = kar(Array.apply(null, { length: sut * sat }).map(function (x, i) { return i; }));
        return l.map(function (x, i) { var h = yer[i], c = h % sut, r = Math.floor(h / sut), jx = (Math.random() - 0.5) * 30 / sut, jy = (Math.random() - 0.5) * 30 / sat;
          return '<button type="button" class="ko-av" data-ko-id="' + x.id + '" style="--i:' + i + ';--x:' + ((c + 0.5) / sut * 100 + jx).toFixed(1) + '%;--y:' + ((r + 0.5) / sat * 100 + jy).toFixed(1) + '%;--r:' + (x.hex || '#9AA7BD') + '" aria-label="' + esc(x.en) + '">' + P.gorsel(x) + '</button>'; }).join(''); })() + '</div></div>';
    var alan = kok.querySelector('[data-ko-alan]'), soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]');
    function sor() { var m = K.komut(P, hedef); soz.textContent = m; return SES.soyle(m, 'en'); }
    function yeni() {
      if (tur >= tura) { bitti = true; return bitir(a, yanlis, 'You found them all!'); }
      if (!kalan.length) { kalan = l.slice(); alan.querySelectorAll('.ko-bulundu').forEach(function (b) { b.classList.remove('ko-bulundu'); }); }
      kilit = false; turNokta(tn, tur, tura); hedef = rasgele(kalan, hedef); sor();
    }
    alan.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ko-id]'); if (!b || kilit || bitti || b.classList.contains('ko-bulundu')) return;
      var x = l.filter(function (y) { return y.id === b.getAttribute('data-ko-id'); })[0];
      if (x === hedef) {
        kilit = true; tur++; seri++; SES.fx('seri', seri); if (a.dogru) a.dogru(x.id); b.classList.add('ko-bulundu'); kalan = kalan.filter(function (y) { return y !== x; });
        SES.soyle(x.en + '!', 'en').then(function () { if (!bitti) setTimeout(yeni, 250); });
      } else { yanlis++; seri = 0; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(b); var h0 = hedef; SES.soyle(x.en + '.', 'en').then(function () { if (!bitti && h0 === hedef) sor(); }); }
    });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- Yapboz ---------------- */
  var IZGARA = { 3: [2, 2], 4: [2, 3], 5: [3, 3], 6: [3, 3] };
  /* yapboz zemini: renk geçişi ve noktalar; boş parçalar da birbirinden ayrılsın */
  function zemin(vb, hex) {
    var x = vb[0], y = vb[1], w = vb[2], h = vb[3], id = 'yz' + Math.random().toString(36).slice(2, 7), d = '';
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) d += '<circle cx="' + (x + w * (i * 0.33 + 0.12 + j * 0.05)) + '" cy="' + (y + h * (j * 0.33 + 0.15)) + '" r="' + (w * (0.03 + (i + j) % 3 * 0.015)) + '" fill="#fff" opacity=".55"/>';
    return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + hex + '" stop-opacity=".55"/><stop offset=".5" stop-color="#FFF8E7"/><stop offset="1" stop-color="#4AA8FF" stop-opacity=".35"/></linearGradient></defs><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#' + id + ')"/>' + d;
  }
  function yapboz(kok, a) {
    var P = a.paket, g = IZGARA[a.bant.secenek] || [2, 3], sat = g[0], sut = g[1], resimler = kar(a.renkler).slice(0, 2), ri = 0, sira = [], adim = 0, yanlis = 0, bitti = false, kilit = false, hedef = null, pr = null;
    kok.innerHTML = '<div class="ko ko-park ko-yapboz">' + yonerge('', a.bant.yazi) + '<div class="ko-yb"><div class="ko-yb-tahta" data-tahta style="--sat:' + sat + ';--sut:' + sut + '"></div></div><div class="ko-yb-tepsi" data-ko-alan></div></div>';
    var tahta = kok.querySelector('[data-tahta]'), alan = kok.querySelector('[data-ko-alan]'), soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]');
    function parca(i) { var r = Math.floor(i / sut), c = i % sut, w = pr.vb[2] / sut, h = pr.vb[3] / sat; return '<svg class="kc" viewBox="' + (pr.vb[0] + c * w) + ' ' + (pr.vb[1] + r * h) + ' ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' + pr.ic + '</svg>'; }
    function resimBasla() {
      if (ri >= resimler.length) { bitti = true; return bitir(a, yanlis, 'What a great puzzle!'); }
      hedef = resimler[ri]; pr = parcala(P.gorsel(hedef)); pr.ic = zemin(pr.vb, hedef.hex || '#9AA7BD') + pr.ic; adim = 0; sira = kar(Array.apply(null, { length: sat * sut }).map(function (x, i) { return i; }));
      tahta.innerHTML = '<div class="ko-yb-golge">' + P.gorsel(hedef) + '</div>' + Array.apply(null, { length: sat * sut }).map(function (x, i) { return '<span class="ko-yb-yuva" data-yuva="' + i + '"></span>'; }).join('');
      tahta.classList.remove('ko-yb-tamam');
      soz.textContent = 'Let\'s make a puzzle!'; SES.soyle('Let\'s make a puzzle!', 'en'); sonraki();
    }
    function sonraki() {
      turNokta(tn, ri, resimler.length);
      if (adim >= sat * sut) {
        tahta.classList.add('ko-yb-tamam'); SES.fx('yildiz'); if (a.dogru) a.dogru(hedef.id);
        return SES.soyle(hedef.en + '!', 'en').then(function () { ri++; setTimeout(resimBasla, 600); });
      }
      kilit = false; var i = sira[adim];
      tahta.querySelectorAll('.ko-yb-yuva').forEach(function (y) { y.classList.toggle('ko-yb-simdi', +y.getAttribute('data-yuva') === i); });
      /* tepsi: doğru parça + kalanlardan 2-3 parça */
      var secenek = kar([i].concat(kar(sira.slice(adim + 1)).slice(0, Math.min(3, a.bant.secenek - 1))));
      alan.innerHTML = secenek.map(function (p) { return '<button type="button" class="ko-yb-p" data-p="' + p + '" aria-label="Parça">' + parca(p) + '</button>'; }).join('');
    }
    alan.addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]'); if (!b || kilit || bitti) return;
      var p = +b.getAttribute('data-p');
      if (p === sira[adim]) { kilit = true; SES.fx('dogru'); var y = tahta.querySelector('[data-yuva="' + p + '"]'); y.innerHTML = parca(p); y.classList.add('ko-yb-dolu'); y.classList.remove('ko-yb-simdi'); adim++; setTimeout(sonraki, 250); }
      else { yanlis++; SES.fx('yanlis'); salla(b); }
    });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); SES.soyle(hedef ? hedef.en : 'Let\'s make a puzzle!', 'en'); });
    resimBasla();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- Gölge eşleme ---------------- */
  function golge(kok, a) {
    var P = a.paket, tura = a.bant.tur, tur = 0, yanlis = 0, bitti = false, kilit = false, hedef = null, sec = [];
    kok.innerHTML = '<div class="ko ko-park ko-golge">' + yonerge('Whose shadow is this?', a.bant.yazi) + '<div class="ko-gl-sahne"><div class="ko-gl-golge" data-golge></div></div><div class="ko-kartlar2" data-ko-alan></div></div>';
    var gl = kok.querySelector('[data-golge]'), alan = kok.querySelector('[data-ko-alan]'), tn = kok.querySelector('[data-ko-tur]');
    function yeni() {
      if (tur >= tura) { bitti = true; return bitir(a, yanlis, 'Great! You matched every shadow!'); }
      kilit = false; turNokta(tn, tur, tura); hedef = rasgele(a.renkler, hedef);
      sec = kar([hedef].concat(kar(a.renkler.filter(function (x) { return x !== hedef; })).slice(0, Math.min(a.bant.secenek, 4) - 1)));
      gl.innerHTML = P.gorsel(hedef); gl.classList.remove('ko-gl-acik'); void gl.offsetWidth; gl.classList.add('ko-gl-gir');
      alan.innerHTML = sec.map(function (x) { return '<button type="button" class="ko-kart2" data-ko-id="' + x.id + '" style="--r:' + (x.hex || '#9AA7BD') + '" aria-label="' + esc(x.en) + '">' + P.gorsel(x) + (a.bant.yazi ? '<b lang="en">' + esc(x.en) + '</b>' : '') + '</button>'; }).join('');
      SES.soyle('Whose shadow is this?', 'en');
    }
    alan.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ko-id]'); if (!b || kilit || bitti) return;
      var x = sec.filter(function (y) { return y.id === b.getAttribute('data-ko-id'); })[0];
      if (x === hedef) { kilit = true; tur++; SES.fx('dogru'); b.classList.add('ko-dogru'); gl.classList.add('ko-gl-acik'); if (a.dogru) a.dogru(x.id); SES.soyle(x.en + '!', 'en').then(function () { if (!bitti) setTimeout(yeni, 450); }); }
      else { yanlis++; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(b); SES.soyle(x.en + '.', 'en'); }
    });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); SES.soyle('Whose shadow is this?', 'en'); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- Harf treni: eksik harfi bul ---------------- */
  var HARFLER = 'abcdefghijklmnoprstuvwyz';
  function kelimeOf(x) { return x.kelime || x.en; }   /* ABC: harf yerine örnek kelime (A → apple) */
  function harfUygun(x) { return /^[a-z]{3,8}$/i.test(kelimeOf(x)); }
  function harf(kok, a) {
    var P = a.paket, l = a.renkler.filter(harfUygun), tura = Math.min(a.bant.tur, Math.max(3, l.length)), tur = 0, yanlis = 0, bitti = false, kilit = false, hedef = null, eksik = 0, harfS = '';
    if (!l.length) return golge(kok, a);
    kok.innerHTML = '<div class="ko ko-park ko-harf">' + yonerge('What letter is missing?', true) + '<div class="ko-tren-yol"><div class="ko-tren" data-tren></div></div><div class="ko-harfler" data-ko-alan></div></div>';
    var tren = kok.querySelector('[data-tren]'), alan = kok.querySelector('[data-ko-alan]'), tn = kok.querySelector('[data-ko-tur]');
    function yeni() {
      if (tur >= tura) { bitti = true; return bitir(a, yanlis, 'Choo, choo! Well done!'); }
      kilit = false; turNokta(tn, tur, tura); hedef = rasgele(l, hedef);
      var w = kelimeOf(hedef).toLowerCase(); eksik = Math.floor(Math.random() * w.length); harfS = w[eksik];
      tren.className = 'ko-tren ko-tren-gel';
      tren.innerHTML = '<span class="ko-lok" aria-hidden="true"><i class="ko-duman"></i><i class="ko-duman"></i></span><span class="ko-vagon ko-v-resim">' + P.gorsel(hedef) + '</span>' +
        w.split('').map(function (c, i) { return '<span class="ko-vagon' + (i === eksik ? ' ko-v-bos' : '') + '" data-v="' + i + '">' + (i === eksik ? '?' : esc(c)) + '</span>'; }).join('');
      var yan = kar(HARFLER.split('').filter(function (c) { return c !== harfS; })).slice(0, Math.min(a.bant.secenek, 4) - 1);
      alan.innerHTML = kar([harfS].concat(yan)).map(function (c) { return '<button type="button" class="ko-harf-b" data-h="' + c + '">' + c + '</button>'; }).join('');
      SES.soyle(kelimeOf(hedef) + '.', 'en').then(function () { if (!bitti && !kilit) SES.soyle('What letter is missing?', 'en'); });
    }
    alan.addEventListener('click', function (e) {
      var b = e.target.closest('[data-h]'); if (!b || kilit || bitti) return;
      if (b.getAttribute('data-h') === harfS) {
        kilit = true; tur++; SES.fx('dogru'); if (a.dogru) a.dogru(hedef.id); b.classList.add('ko-dogru');
        var v = tren.querySelector('[data-v="' + eksik + '"]'); v.textContent = harfS; v.classList.remove('ko-v-bos'); v.classList.add('ko-v-doldu');
        SES.soyle(kelimeOf(hedef) + '!', 'en').then(function () { SES.fx('duduk'); tren.classList.add('ko-tren-git'); setTimeout(function () { if (!bitti) yeni(); }, 1100); });
      } else { yanlis++; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(b); }
    });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); SES.soyle(kelimeOf(hedef) + '.', 'en'); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* madalya seviyesine göre park oyunu */
  /* gölgesi birbirine benzeyen konular (renk lekeleri, sayı ve harf kartları) gölge oynamaz */
  var GOLGE_YOK = { colours: 1, numbers: 1, alphabet: 1, days: 1, feelings: 1 };
  function parkOyun(bant, konu) {
    var L = bant.seviye || 1, gl = !GOLGE_YOK[konu];
    if (L === 1) return 'sesavi';
    if (L === 2) return gl && Math.random() < 0.5 ? 'golge' : 'yapboz';
    return bant.yazi ? 'harf' : gl ? 'golge' : 'yapboz';
  }
  var PARK = { sesavi: [sesavi, 'Ses avı', 'ses'], yapboz: [yapboz, 'Yapboz', 'blocks'], golge: [golge, 'Gölge', 'yildiz'], harf: [harf, 'Harf treni', 'train'] };
  O.sesavi = sesavi; O.yapboz = yapboz; O.golge = golge; O.harf = harf;
  O.park = function (kok, a) { return PARK[a.parkOyun || parkOyun(a.bant, a.paket && a.paket.id)][0](kok, a); };
  O.parkOyun = parkOyun; O.PARK = PARK; O.GOLGE_YOK = GOLGE_YOK; O.harfUygun = harfUygun;
  O.parkCumleler = ['You found them all!', 'Let\'s make a puzzle!', 'What a great puzzle!', 'Whose shadow is this?', 'Great! You matched every shadow!', 'What letter is missing?', 'Choo, choo! Well done!', 'Repeat after me!'];
})(window);
