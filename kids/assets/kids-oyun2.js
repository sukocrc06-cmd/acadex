/* ==========================================================================
   ACADEX KIDS · temaların üçüncü oyunları (kids/assets/kids-oyun2.js), 12.11.2026
   Üç motor, on oyun. İçerik ve cümleler konu paketinde (kids-temalar.js → oyun3):
     sec       dinle, doğru kartı seç: Kim der? (Animals), Odalar (My Home),
               Çark (Weather: çarkı çevir, söylenen havayı bul), Nasılım? (Feelings)
     yerlestir söylenen şeyi bul, yerine uçur: Fotoğraf (Family), Piknik (Food),
               Topla (Toys), Giydir (Clothes: havaya göre giydir), Çanta (School)
     simon     "Touch your nose!": büyük çocuk figüründe doğru yere dokun (My Body)
   Kurallar kids-oyun.js ile aynı: yalnız dokunma, yanlışta ceza yok (sallanır, dokunulanın
   adı söylenir, yönerge yinelenir), yönerge hoparlörle yeniden dinlenir.
   OYUN.cumleler(paket) katalog için bu oyunların söylediği bütün cümleleri verir.
   ========================================================================== */
(function (W) {
  'use strict';
  var C = W.KIDS_CIZ, R = W.KIDS_RESIM, SES = W.KIDS_SES, O = W.KIDS_OYUN, K = W.KIDS_KONU;
  var kar = O.kar, yildizHesap = O.yildizHesap, salla = O.salla, yonerge = O.yonerge, turNokta = O.turNokta;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function rasgele(l, degil) { var a = l.filter(function (x) { return x !== degil; }); return a[Math.floor(Math.random() * a.length)] || l[0]; }
  function hedefler(T, l) { return T.hedefler ? T.hedefler(l) : l; }
  function vurgu(x, metin) { var i = metin.toLowerCase().indexOf(x.en.toLowerCase()); metin = esc(metin); return i < 0 ? metin : metin.slice(0, i) + '<b style="--r:' + x.hex + '">' + metin.slice(i, i + x.en.length) + '</b>' + metin.slice(i + x.en.length); }
  /* dokunulan şeyi hedefe uçur (kopyası uçar, asıl yerinde kalır) */
  function ucur(den, ya, html) {
    return new Promise(function (coz) {
      if (!den || !ya || !den.getBoundingClientRect || !W.document.body.animate) return coz();
      var a = den.getBoundingClientRect(), b = ya.getBoundingClientRect(), u = W.document.createElement('div');
      u.className = 'ko-ucan'; u.innerHTML = html; u.style.cssText = 'left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height + 'px';
      W.document.body.appendChild(u);
      var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      if (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) { u.remove(); return coz(); }
      u.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 60) + 'px) scale(1.1)', offset: 0.5 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.6)', opacity: 0.4 }],
        { duration: 620, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.then(function () { u.remove(); coz(); }, function () { u.remove(); coz(); });
    });
  }
  function sonra(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- motor 1: sec ---------------- */
  function sec(kok, a, P) {
    var T = P.oyun3, liste = hedefler(T, a.renkler), tur = 0, yanlis = 0, hedef = null, bitti = false, kilit = true, adaylar = [];
    var oda = !!T.odalar, cark = !!T.cark, durum = !!T.durum, tura = Math.min(a.bant.tur, Math.max(3, liste.length + 1));
    kok.innerHTML = '<div class="ko ko-sec ko-o-' + T.id + '">' + yonerge('', a.bant.yazi) + '<div class="ko-sahne2" data-ust></div><div class="ko-kartlar2" data-ko-alan></div></div>';
    var ust = kok.querySelector('[data-ust]'), alan = kok.querySelector('[data-ko-alan]'), soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]'), aci = 0;
    function sor() { soz.innerHTML = vurgu(hedef, T.soz(hedef)); return SES.soyle(T.soz(hedef), 'en'); }
    function secenekler() {
      if (oda) {
        var dogru = T.odalar.filter(function (x) { return hedef.oda.indexOf(x.id) > -1; }), yan = T.odalar.filter(function (x) { return hedef.oda.indexOf(x.id) < 0; });
        return kar([rasgele(dogru)].concat(kar(yan).slice(0, Math.min(a.bant.secenek, 4) - 1)));
      }
      return kar([hedef].concat(kar(a.renkler.filter(function (x) { return x !== hedef; })).slice(0, Math.min(a.bant.secenek, 4) - 1)));
    }
    function kart(x) {
      var resim = oda ? C.simge(x.simge) : R.ciz(x.id);
      return '<button type="button" class="ko-kart2" data-ko-id="' + x.id + '" style="--r:' + x.hex + '" aria-label="' + esc(x.en) + '"' + (cark ? ' disabled' : '') + '>' + resim + (a.bant.yazi ? '<b lang="en">' + esc(x.en) + '</b>' : '') + '</button>';
    }
    function ustCiz() {
      if (oda) ust.innerHTML = '<div class="ko-buyukres" style="--r:' + hedef.hex + '">' + R.ciz(hedef.id) + '</div>';
      else if (durum) ust.innerHTML = '<div class="ko-durum"><span class="ko-durum-r">' + R.ciz(hedef.resim) + '</span><span class="ko-durum-acd">' + C.acadia({ mood: 'dusun' }) + '</span>' + (a.bant.yazi ? '<p lang="en">' + esc(hedef.durum) + '</p>' : '') + '</div>';
      else if (cark) {
        if (!ust.querySelector('[data-cark]')) {
          var dil = '', renk = ['#FF9EB5', '#FFD23F', '#9BE0B4', '#A5DBFF', '#D9C2FF', '#FFB3B3', '#BDE8F2', '#FFE08A'];
          for (var i = 0; i < 8; i++) { var a1 = (i * 45 - 90) * Math.PI / 180, a2 = ((i + 1) * 45 - 90) * Math.PI / 180, am = (a1 + a2) / 2; dil += '<path d="M60 60 L' + (60 + 54 * Math.cos(a1)).toFixed(1) + ' ' + (60 + 54 * Math.sin(a1)).toFixed(1) + ' A54 54 0 0 1 ' + (60 + 54 * Math.cos(a2)).toFixed(1) + ' ' + (60 + 54 * Math.sin(a2)).toFixed(1) + ' Z" fill="' + renk[i] + '" stroke="#23304D" stroke-width="2.4"/><text x="' + (60 + 36 * Math.cos(am)).toFixed(1) + '" y="' + (66 + 36 * Math.sin(am)).toFixed(1) + '" text-anchor="middle" font-size="16" font-weight="800" fill="#23304D">?</text>'; }
          ust.innerHTML = '<div class="ko-cark"><span class="ko-cark-ok" aria-hidden="true"></span><svg viewBox="0 0 120 120" class="ko-cark-r" data-cark aria-hidden="true">' + dil + '<circle cx="60" cy="60" r="10" fill="#fff" stroke="#23304D" stroke-width="2.4"/></svg>' +
            '<div class="ko-pencere" data-pencere>' + R.ciz('cloudy') + '</div><button type="button" class="ka-buyuk ko-cevir" data-cevir>Çevir ' + C.simge('oynat') + '</button></div>';
          ust.querySelector('[data-cevir]').addEventListener('click', cevir);
        }
        ust.querySelector('[data-cevir]').disabled = false; ust.querySelector('[data-cevir]').hidden = false;
      } else ust.innerHTML = '<button type="button" class="ko-ses-b" data-tekrar aria-label="Sesi yeniden dinle">' + C.simge('ses') + '<i></i><i></i><i></i></button>';
      var t = ust.querySelector('[data-tekrar]'); if (t) t.addEventListener('click', function () { SES.fx('dokun'); sor(); });
    }
    function cevir() {
      var b = ust.querySelector('[data-cevir]'); if (!b || b.disabled || bitti) return;
      b.disabled = true; SES.fx('cevir'); aci += 720 + Math.floor(Math.random() * 8) * 45 + 22;
      var c = ust.querySelector('[data-cark]'); c.style.transform = 'rotate(' + aci + 'deg)';
      sonra(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 1700).then(function () {
        if (bitti) return; b.hidden = true; ust.querySelector('[data-pencere]').innerHTML = '<span class="ko-soru">?</span>';
        alan.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); kilit = false; SES.fx('dogru'); sor();
      });
    }
    function yeni() {
      if (tur >= tura) { bitti = true; return SES.soyle(T.son, 'en').then(function () { a.bitti(yildizHesap(yanlis, [1, 3])); }); }
      turNokta(tn, tur, tura); hedef = rasgele(liste, hedef); adaylar = secenekler();
      alan.innerHTML = adaylar.map(kart).join(''); ustCiz();
      if (cark) { kilit = true; soz.innerHTML = 'Spin the wheel!'; SES.soyle('Spin the wheel!', 'en'); return; }
      kilit = false; sor();
    }
    alan.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ko-id]'); if (!b || kilit || bitti || b.disabled) return;
      var id = b.getAttribute('data-ko-id'), x = adaylar.filter(function (y) { return y.id === id; })[0];
      var dogru = oda ? hedef.oda.indexOf(id) > -1 : id === hedef.id;
      if (dogru) {
        kilit = true; tur++; SES.fx('dogru'); b.classList.add('ko-dogru');
        if (cark) ust.querySelector('[data-pencere]').innerHTML = R.ciz(hedef.id);
        if (durum) { var r_ = ust.querySelector('.ko-durum-acd'); if (r_) r_.innerHTML = R.ciz(hedef.id); }
        SES.soyle(T.dogru(hedef, x), 'en').then(function () { if (!bitti) setTimeout(yeni, 350); });
      } else {
        yanlis++; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(b);
        var h0 = hedef; SES.soyle(x.en + '.', 'en').then(function () { if (!bitti && h0 === hedef) sor(); });
      }
    });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); if (kilit && cark) SES.soyle('Spin the wheel!', 'en'); else sor(); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- motor 2: yerlestir ---------------- */
  var KAP = { sepet: function () { return R.sepet(); }, kutu: function () { return R.kutu(); }, canta: function () { return R.canta(); } };
  function yerlestir(kok, a, P) {
    var T = P.oyun3, liste = kar(hedefler(T, a.renkler)), tura = Math.min(a.bant.tur, liste.length), sira = liste.slice(0, tura), tur = 0, yanlis = 0, hedef = null, bitti = false, kilit = false, adaylar = [];
    var yabanci = (T.yabanci || []).map(function (id) { for (var i = 0; i < K.PAKET.length; i++) { var y = K.al(K.PAKET[i]).ogeler({ kelimeSay: 10 }).filter(function (o) { return o.id === id; })[0]; if (y) return y; } return null; }).filter(Boolean);
    var kapHtml;
    if (T.kap === 'cerceve') kapHtml = '<div class="ko-cerceve">' + R.cerceve() + '<div class="ko-foto ko-f' + tura + '">' + sira.map(function (x, i) { return '<span class="ko-yuva" data-yuva="' + i + '"><i>?</i></span>'; }).join('') + '</div></div>';
    else if (T.kap === 'giy') kapHtml = '<div class="ko-giy"><div class="ko-hava" data-hava></div><div class="ko-giyfig-k">' + R.giyFigur() + '<span class="ko-g ko-g-govde" data-g="govde"></span><span class="ko-g ko-g-bacak" data-g="bacak"></span><span class="ko-g ko-g-ayak" data-g="ayak"></span><span class="ko-g ko-g-boyun" data-g="boyun"></span><span class="ko-g ko-g-el" data-g="el"></span><span class="ko-g ko-g-bas" data-g="bas"></span></div></div>';
    else kapHtml = '<div class="ko-kap ko-kap-' + T.kap + '"><div class="ko-icinde" data-icinde></div>' + KAP[T.kap]() + '</div>';
    kok.innerHTML = '<div class="ko ko-yer ko-o-' + T.id + '">' + yonerge('', a.bant.yazi) + '<div class="ko-yer-sahne" data-sahne2>' + kapHtml + '</div><div class="ko-tepsi2" data-ko-alan></div></div>';
    var alan = kok.querySelector('[data-ko-alan]'), soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]'), sahne = kok.querySelector('[data-sahne2]');
    function sor() { soz.innerHTML = vurgu(hedef, T.soz(hedef)); return SES.soyle(T.soz(hedef), 'en'); }
    function hedefYer() {
      if (T.kap === 'cerceve') return sahne.querySelector('[data-yuva="' + tur + '"]');
      if (T.kap === 'giy') return sahne.querySelector('[data-g="' + hedef.yer + '"]');
      return sahne.querySelector('[data-icinde]');
    }
    function yerles(x) {
      var y = hedefYer();
      if (T.kap === 'cerceve') { y.innerHTML = R.ciz(x.id); y.classList.add('ko-dolu'); }
      else if (T.kap === 'giy') { y.innerHTML = R.ciz(x.id); y.classList.remove('ko-giydi'); void y.offsetWidth; y.classList.add('ko-giydi'); }
      else { var s = W.document.createElement('span'); s.className = 'ko-konan'; s.innerHTML = R.ciz(x.id); y.appendChild(s); }
    }
    function yeni() {
      if (tur >= tura) {
        bitti = true; sahne.classList.add('ko-tamam'); if (T.kap === 'cerceve') SES.fx('pat');
        return SES.soyle(T.son, 'en').then(function () { a.bitti(yildizHesap(yanlis, [1, 3])); });
      }
      kilit = false; turNokta(tn, tur, tura); hedef = sira[tur];
      var kalan = sira.slice(tur + 1).concat(a.renkler.filter(function (x) { return sira.indexOf(x) < 0 && hedefler(T, [x]).length; })), n = Math.min(a.bant.secenek, 4) - 1;
      var diger = kar(kalan).slice(0, n); if (yabanci.length && diger.length) diger[diger.length - 1] = rasgele(yabanci);
      if (diger.length < n) diger = diger.concat(kar(a.renkler.filter(function (x) { return x !== hedef && diger.indexOf(x) < 0; })).slice(0, n - diger.length));
      adaylar = kar([hedef].concat(diger));
      alan.innerHTML = adaylar.map(function (x) { return '<button type="button" class="ko-kart2" data-ko-id="' + x.id + '" style="--r:' + x.hex + '" aria-label="' + esc(x.en) + '">' + R.ciz(x.id) + (a.bant.yazi ? '<b lang="en">' + esc(x.en) + '</b>' : '') + '</button>'; }).join('');
      if (T.kap === 'giy') { var hv = sahne.querySelector('[data-hava]'); hv.innerHTML = R.ciz(hedef.hava); hv.classList.remove('ko-yeni'); void hv.offsetWidth; hv.classList.add('ko-yeni'); }
      if (T.kap === 'cerceve') { var yv = hedefYer(); sahne.querySelectorAll('.ko-yuva').forEach(function (s) { s.classList.toggle('ko-simdi', s === yv); }); }
      sor();
    }
    alan.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ko-id]'); if (!b || kilit || bitti) return;
      var id = b.getAttribute('data-ko-id'), x = adaylar.filter(function (y) { return y.id === id; })[0];
      if (id === hedef.id) {
        kilit = true; SES.fx('dogru'); b.classList.add('ko-gitti');
        ucur(b.querySelector('svg') || b, hedefYer(), R.ciz(x.id)).then(function () { if (bitti) return; yerles(x); SES.fx('pat'); tur++; return SES.soyle(T.dogru(x), 'en'); }).then(function () { if (!bitti) setTimeout(yeni, 250); });
      } else {
        yanlis++; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(b);
        var h0 = hedef; SES.soyle(x.en + '.', 'en').then(function () { if (!bitti && h0 === hedef) sor(); });
      }
    });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- motor 3: simon ---------------- */
  function simon(kok, a, P) {
    var T = P.oyun3, liste = a.renkler, tura = a.bant.tur, tur = 0, yanlis = 0, hedef = null, bitti = false, kilit = false, hepsi = {};
    P.ogeler({ kelimeSay: 10 }).forEach(function (x) { hepsi[x.id] = x; });
    kok.innerHTML = '<div class="ko ko-simon">' + yonerge('', a.bant.yazi) + '<div class="ko-simon-sahne"><span class="ko-simon-acd">' + C.acadia({ mood: 'mutlu', pose: 'isaret' }) + '</span>' + R.beden() + '</div></div>';
    var fig = kok.querySelector('.ko-beden'), soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]');
    function sor() { soz.innerHTML = vurgu(hedef, T.soz(hedef)); return SES.soyle(T.soz(hedef), 'en'); }
    function yeni() {
      fig.querySelectorAll('.ko-yandi').forEach(function (x) { x.classList.remove('ko-yandi'); });
      if (tur >= tura) { bitti = true; return SES.soyle(T.son, 'en').then(function () { a.bitti(yildizHesap(yanlis, [1, 3])); }); }
      kilit = false; turNokta(tn, tur, tura); hedef = rasgele(liste, hedef); sor();
    }
    function dokun(g) {
      if (!g || kilit || bitti) return;
      var id = g.getAttribute('data-parca');
      if (id === hedef.id) { kilit = true; tur++; SES.fx('dogru'); g.classList.add('ko-yandi'); SES.soyle(T.dogru(hedef), 'en').then(function () { if (!bitti) setTimeout(yeni, 300); }); }
      else { yanlis++; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(fig); var h0 = hedef; SES.soyle((hepsi[id] || hedef).en + '.', 'en').then(function () { if (!bitti && h0 === hedef) sor(); }); }
    }
    fig.addEventListener('click', function (e) { dokun(e.target.closest('[data-parca]')); });
    fig.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dokun(e.target.closest('[data-parca]')); } });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  var MOTOR = { sec: sec, yerlestir: yerlestir, simon: simon };
  /* her temanın oyununu kendi kimliğiyle kaydet (konuAc OYUN[d.id] ile çağırır) */
  K.PAKET.forEach(function (pid) {
    var P = K.al(pid), T = P.oyun3; if (!T || !T.motor || O[T.id]) return;
    O[T.id] = function (kok, a) { return MOTOR[T.motor](kok, a, a.paket && a.paket.oyun3 && a.paket.oyun3.id === T.id ? a.paket : P); };
  });
  /* katalog: bu oyunların söyleyebileceği bütün İngilizce cümleler */
  O.cumleler = function (P) {
    var T = P.oyun3, l = [], hepsi = P.ogeler({ kelimeSay: 10 }); if (!T || !T.motor) return l;
    hedefler(T, hepsi).forEach(function (x) {
      l.push(T.soz(x));
      if (T.odalar) T.odalar.filter(function (r) { return x.oda.indexOf(r.id) > -1; }).forEach(function (r) { l.push(T.dogru(x, r)); }); else l.push(T.dogru(x));
    });
    if (T.odalar) T.odalar.forEach(function (r) { l.push(r.en + '.'); });
    (T.yabanci || []).forEach(function (id) { for (var i = 0; i < K.PAKET.length; i++) { var y = K.al(K.PAKET[i]).ogeler({ kelimeSay: 10 }).filter(function (o) { return o.id === id; })[0]; if (y) { l.push(y.en + '.'); break; } } });
    if (T.cark) l.push('Spin the wheel!');
    l.push(T.son);
    return l;
  };
  O.MOTOR = MOTOR;
})(window);
