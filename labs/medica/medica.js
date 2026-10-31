/* ==========================================================================
   ACADEX MEDICA · hastane (labs/medica/medica.js), 31.10.2026
   MedLab'in içindeki eğitim hastanesi. Akış:
     giriş (lobi) → maskeli, ameliyata hazır rehber cerrah karşılar ve hastaneyi tanıtır →
     öğrenci bölümünü seçer → asansör (kapılar kapanır, kat göstergesi sayar, açılır) →
     katın bekleme salonu: sıra numaralı hastalar, servis odasındaki yatan hastalar →
     hasta odaya çağrılır → labs/klinik sahnesi (anamnez, muayene, karar) →
     lab'a devir (iç çerçevede, ?medica=1&vaka=…) → lab sonucu Medica'ya döner.
   Nöbet modu: kattan rastgele hastalar sırayla gelir, nöbet saati ilerler; sonunda
   nöbet karnesi. Bütün nöbetler ve görülen hastalar "nöbet karnesi"nde birikir.
   Acadia: MedLab köprüsü (?medlab=1). İç çerçevedeki lab'ın mesajları 'medica' adıyla
   üst sayfaya aktarılır; üstten gelen sorular açık lab'a iletilir.
   Veri: medica-veri.js (AXMEDICA), senaryolar: labs/klinik/senaryo-*.js (AXKLINIK.SEN).
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, V = W.AXMEDICA, K = W.AXKLINIK;
  if (!V || !K) return;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem('acadex.medica.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.medica.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var live = function (t) { var el = $('#live'); if (el) el.textContent = t; };
  var toast = function (t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 3200); };
  var dar = function () { return (W.innerWidth || 1024) < 760; };

  /* ---------------- durum ---------------- */
  var S = {
    ekran: 'lobi', kat: null,
    bolum: ls.get('bolum', null),                 /* öğrencinin bölümü (kat kimliği) */
    gorulen: ls.get('gorulen', {}),               /* senaryo kimliği → {sahne, lab, t} */
    nobet: ls.get('nobet', null),                 /* süren nöbet */
    defter: ls.get('defter', []),                 /* biten nöbetler */
    sevk: ls.get('sevk', {}),                     /* konsültasyon: zincir → {acik: açılan son halka, sec: {i: seçilen kat}} */
    olay: null,                                   /* açık olay penceresi: 'triyaj' | 'kod' | 'sevk' (Acadia bağlamı için) */
    aktif: null,                                  /* odadaki / lab'daki hasta: {sen, sahne, lab} */
    lab: null                                     /* iç çerçevede açık lab */
  };
  var kaydet = function () { ls.set('gorulen', S.gorulen); ls.set('nobet', S.nobet); ls.set('defter', S.defter.slice(-40)); ls.set('sevk', S.sevk); };
  var hastalar = function (kat) { return V.katHastalari(kat, K.SEN); };

  /* ---------------- ses: asansör "ding" ve sıra çağrısı (kullanıcı dokunuşundan sonra) ---------------- */
  var AC = null;
  var bip = function (frek, sure, gec) {
    if (RM) return;
    try {
      AC = AC || new (W.AudioContext || W.webkitAudioContext)();
      var t = AC.currentTime + (gec || 0), o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = frek; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + sure + 0.05);
    } catch (e) {}
  };
  var ding = function () { bip(1318, 0.6); bip(1046, 0.9, 0.18); };

  /* =========================== çizim =========================== */
  /* rehber cerrah: yeşil forma, bone, maske, steril eldivenli eller havada (ameliyata hazır) */
  var cerrah = function (o) {
    var ten = '#E8B48A', f = '#3E9A86', fk = '#2F7F6E', el = '#8FC3EE';
    var s = '<g class="cerrah' + (o.cls ? ' ' + o.cls : '') + '" transform="translate(' + o.x + ' ' + o.y + ') scale(' + (o.sc || 1) + ')">';
    s += '<g class="govde">';
    s += '<ellipse cx="0" cy="2" rx="66" ry="10" fill="#0D1838" opacity=".12"/>';
    s += '<rect x="-32" y="-140" width="27" height="130" rx="11" fill="' + fk + '"/><rect x="5" y="-140" width="27" height="130" rx="11" fill="' + fk + '"/>';
    s += '<rect x="-40" y="-15" width="38" height="15" rx="7" fill="#F4F6F9" stroke="#C7CFDD" stroke-width="2"/><rect x="2" y="-15" width="38" height="15" rx="7" fill="#F4F6F9" stroke="#C7CFDD" stroke-width="2"/>';
    s += '<g class="nefes"><path d="M-48 -238 C-50 -260 50 -260 48 -238 L52 -126 C52 -116 -52 -116 -52 -126 Z" fill="' + f + '"/>';
    s += '<path d="M-17 -254 L0 -214 L17 -254" fill="' + fk + '"/><path d="M0 -214 V-126" stroke="' + fk + '" stroke-width="2" opacity=".5"/>';
    s += '<rect x="16" y="-232" width="26" height="15" rx="3" fill="#fff"/><text x="29" y="-221.5" font-size="8" text-anchor="middle" fill="' + fk + '" font-family="JetBrains Mono,monospace" font-weight="700">AXM</text></g>';
    /* eller havada: kısa kollu forma, çıplak önkol, eldiven */
    var kol = function (m) {
      return '<g class="kol' + (m < 0 ? 'L' : 'R') + '"><path d="M' + (44 * m) + ' -236 L' + (60 * m) + ' -214" stroke="' + f + '" stroke-width="26" stroke-linecap="round"/>' +
        '<path d="M' + (60 * m) + ' -214 L' + (76 * m) + ' -194 L' + (70 * m) + ' -252" stroke="' + ten + '" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '<path d="M' + (70 * m) + ' -250 L' + (69 * m) + ' -262" stroke="' + el + '" stroke-width="19" stroke-linecap="round"/>' +
        '<g fill="' + el + '"><ellipse cx="' + (69 * m) + '" cy="-272" rx="12" ry="14"/><rect x="' + (69 * m - 11) + '" y="-296" width="5" height="18" rx="2.5"/><rect x="' + (69 * m - 5) + '" y="-300" width="5" height="20" rx="2.5"/><rect x="' + (69 * m + 1) + '" y="-298" width="5" height="19" rx="2.5"/><rect x="' + (69 * m + 6) + '" y="-293" width="5" height="15" rx="2.5"/></g></g>';
    };
    s += kol(-1) + kol(1);
    s += '<rect x="-10" y="-266" width="20" height="18" fill="' + ten + '"/>';
    s += '<g class="bas"><ellipse cx="-34" cy="-296" rx="6" ry="9" fill="' + ten + '"/><ellipse cx="34" cy="-296" rx="6" ry="9" fill="' + ten + '"/>';
    s += '<ellipse cx="0" cy="-296" rx="34" ry="38" fill="' + ten + '"/>';
    /* bone */
    s += '<path d="M-37 -304 C-40 -346 40 -346 37 -304 C24 -312 -24 -312 -37 -304 Z" fill="' + f + '"/><path d="M36 -312 c10 2 16 10 12 18" stroke="' + f + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
    s += '<g fill="#fff" opacity=".35"><circle cx="-18" cy="-326" r="2.4"/><circle cx="0" cy="-332" r="2.4"/><circle cx="18" cy="-326" r="2.4"/><circle cx="-8" cy="-316" r="2.4"/><circle cx="10" cy="-316" r="2.4"/></g>';
    /* gözler ve kaşlar (maskenin üstünde) */
    s += '<g class="goz"><ellipse cx="-12" cy="-298" rx="3.8" ry="4.8" fill="#0D1838"/><ellipse cx="12" cy="-298" rx="3.8" ry="4.8" fill="#0D1838"/></g>';
    s += '<path d="M-20 -309 q8 -5 15 -1 M20 -309 q-8 -5 -15 -1" stroke="#3A2A1E" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    /* cerrahi maske: kıvrımlar, kulak lastikleri; konuşurken hafifçe kabarır */
    s += '<path d="M-31 -296 L-37 -299 M31 -296 L37 -299 M-29 -270 L-36 -290 M29 -270 L36 -290" stroke="#E9F3F2" stroke-width="2.2"/>';
    s += '<g class="maske"><path d="M-30 -290 Q0 -296 30 -290 L28 -268 Q0 -254 -28 -268 Z" fill="#A6DDD5" stroke="#7FC1B7" stroke-width="1.6"/><path d="M-27 -283 Q0 -287 27 -283 M-27 -276 Q0 -279 27 -276 M-25 -269 Q0 -270 25 -269" stroke="#7FC1B7" stroke-width="1.5" fill="none"/></g>';
    s += '</g></g></g>';
    return s;
  };
  var bitki = function (x, y, sc) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (sc || 1) + ')"><g class="sway"><path d="M-22 0 h44 l-6 -46 h-32 z" fill="#C7A27A"/><path d="M0 -46 c-30 -30 -40 -70 -10 -96 c10 30 14 60 10 96 m0 0 c22 -40 52 -62 72 -52 c-10 30 -42 48 -72 52 m0 0 c-12 -36 -46 -54 -70 -44 c14 26 44 40 70 44" fill="#3E8E5B"/></g></g>'; };
  var tavan = function () { return '<g opacity=".9"><rect x="120" y="0" width="160" height="10" rx="4" fill="#FFFFFF"/><rect x="420" y="0" width="160" height="10" rx="4" fill="#FFFFFF"/><rect x="720" y="0" width="160" height="10" rx="4" fill="#FFFFFF"/></g><g class="isik" fill="#FFF7D6" opacity=".35"><path d="M120 10 L60 200 H340 L280 10Z"/><path d="M420 10 L360 200 H640 L580 10Z"/><path d="M720 10 L660 200 H940 L880 10Z"/></g>'; };
  var zemin = function () {
    var s = '<rect y="430" width="1000" height="130" fill="#DCE2E8"/><g stroke="#CBD3DC" stroke-width="2">';
    for (var i = 0; i < 12; i++) s += '<path d="M' + (i * 100 - 60) + ' 560 L' + (i * 90 + 10) + ' 430"/>';
    return s + '<path d="M0 470 H1000 M0 515 H1000"/></g><rect y="426" width="1000" height="6" fill="#B8C2CE"/>';
  };
  var asansorKapi = function (x, y, kat) {
    return '<g class="asn" data-asn><rect x="' + (x - 8) + '" y="' + (y - 8) + '" width="146" height="' + (430 - y + 8) + '" rx="6" fill="#AEB8C6"/>' +
      '<rect class="ak1" x="' + x + '" y="' + y + '" width="65" height="' + (430 - y) + '" fill="url(#celik)"/><rect class="ak2" x="' + (x + 65) + '" y="' + y + '" width="65" height="' + (430 - y) + '" fill="url(#celik)"/>' +
      '<path d="M' + (x + 65) + ' ' + y + ' V430" stroke="#8D98A8" stroke-width="2"/>' +
      '<rect x="' + (x + 30) + '" y="' + (y - 56) + '" width="70" height="38" rx="6" fill="#0D1838"/><text class="asn-g" x="' + (x + 65) + '" y="' + (y - 30) + '" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="20" font-weight="700" fill="#FFB547">' + (kat || 'G') + '</text>' +
      '<g transform="translate(' + (x + 148) + ' ' + (y + 120) + ')"><rect x="-4" y="0" width="20" height="44" rx="5" fill="#C9D1DC" stroke="#8D98A8" stroke-width="2"/><circle cx="6" cy="12" r="5" fill="#E7EEF5" stroke="#8D98A8"/><circle class="asn-btn" cx="6" cy="31" r="5" fill="#FFB547"/></g></g>';
  };
  var defs = function () { return '<defs><linearGradient id="celik" x1="0" x2="1"><stop offset="0" stop-color="#C9D1DC"/><stop offset=".5" stop-color="#E8EDF3"/><stop offset="1" stop-color="#BCC6D2"/></linearGradient><linearGradient id="duvar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3F7F9"/><stop offset="1" stop-color="#E3EBF0"/></linearGradient><linearGradient id="cam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CFE8F7"/><stop offset="1" stop-color="#A9D2EC"/></linearGradient></defs>'; };

  /* ---------- canlı hastane: gökyüzü (vakit), yürüyen personel, sedye ---------- */
  var vakitDk = function () { if (S.nobet) return S.nobet.saat; var d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  var gokDefs = function () { return '<defs><linearGradient id="gokG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--gok1)"/><stop offset="1" style="stop-color:var(--gok2)"/></linearGradient></defs>'; };
  /* pencere ya da cam kapı ardındaki gökyüzü: güneş/ay, yıldız, bulut, şehir silueti */
  var gok = function (x, y, w, h) {
    var s = '<g class="gok-k"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#gokG)"/>';
    s += '<g class="yildiz" fill="#FFF7D6">' + [[.12, .18], [.3, .08], [.52, .22], [.7, .1], [.86, .3], [.42, .36], [.2, .42]].map(function (p, i) { return '<circle cx="' + (x + p[0] * w).toFixed(1) + '" cy="' + (y + p[1] * h).toFixed(1) + '" r="' + (i % 3 ? 1.4 : 2) + '" style="animation-delay:-' + (i * 0.7) + 's"/>'; }).join('') + '</g>';
    s += '<circle class="gunes" cx="' + (x + w * 0.76) + '" cy="' + (y + h * 0.3) + '" r="' + Math.min(w, h) * 0.12 + '" fill="#FFE07A"/>';
    s += '<g class="ay"><circle cx="' + (x + w * 0.72) + '" cy="' + (y + h * 0.26) + '" r="' + Math.min(w, h) * 0.1 + '" fill="#F3EFE0"/><circle cx="' + (x + w * 0.72 + Math.min(w, h) * 0.05) + '" cy="' + (y + h * 0.23) + '" r="' + Math.min(w, h) * 0.09 + '" fill="var(--gok1)"/></g>';
    s += '<g class="bulut" fill="#FFFFFF" opacity=".85"><ellipse cx="' + (x + w * 0.25) + '" cy="' + (y + h * 0.3) + '" rx="' + w * 0.12 + '" ry="' + h * 0.06 + '"/><ellipse cx="' + (x + w * 0.33) + '" cy="' + (y + h * 0.26) + '" rx="' + w * 0.08 + '" ry="' + h * 0.07 + '"/></g>';
    var b = y + h, sil = 'M' + x + ' ' + b; [[0, .3], [.12, .3], [.12, .18], [.24, .18], [.24, .38], [.36, .38], [.36, .12], [.46, .12], [.46, .28], [.6, .28], [.6, .2], [.74, .2], [.74, .34], [.86, .34], [.86, .16], [1, .16]].forEach(function (p) { sil += ' L' + (x + p[0] * w).toFixed(1) + ' ' + (b - p[1] * h).toFixed(1); });
    s += '<path class="sehir" d="' + sil + ' L' + (x + w) + ' ' + b + 'Z"/>';
    s += '<g class="pencereler" fill="#FFE7A0">' + [[.05, .2], [.16, .1], [.28, .26], [.4, .06], [.5, .18], [.64, .12], [.78, .24], [.9, .08]].map(function (p) { return '<rect x="' + (x + p[0] * w).toFixed(1) + '" y="' + (b - p[1] * h - 4).toFixed(1) + '" width="4" height="4"/>'; }).join('') + '</g></g>';
    return s;
  };
  /* koridorda yürüyen personel: hemşire (mavi forma), doktor (önlük), sedye iten hasta bakıcı */
  var yuruyen = function (o) {
    var k = K.kisi({ x: 0, y: 0, cins: o.cins, ten: o.ten, sac: o.sac, kiyafet: o.kiyafet, rol: o.rol, ic: o.ic, flip: o.flip, gorunum: 'yetiskin' });
    return '<g class="yuru ' + o.cls + '" aria-hidden="true"><g transform="translate(0 ' + o.y + ') scale(' + o.sc + ')"><g class="adim">' + k + '</g></g></g>';
  };
  var sedye = function (o) {
    var h = K.yatan({ x: 0, y: 0, ifade: 'normal', ortu: '#9CC6E8', sac: '#5A3A22' });
    return '<g class="yuru ' + o.cls + '" aria-hidden="true"><g transform="translate(0 ' + o.y + ') scale(' + o.sc + ')"><g class="adim">' +
      K.kisi({ x: -60, y: 0, cins: 'E', kiyafet: '#3E8E7E', sac: '#2E241C' }) +
      '<g transform="translate(0 -60)"><rect x="-20" y="0" width="480" height="18" rx="6" fill="#F1F4FA" stroke="#C7CFDD" stroke-width="3"/><rect x="-26" y="-40" width="10" height="70" rx="4" fill="#9AA6BC"/><path d="M40 18 L60 58 M400 18 L380 58" stroke="#9AA6BC" stroke-width="6"/><circle cx="60" cy="62" r="7" fill="#38425C"/><circle cx="380" cy="62" r="7" fill="#38425C"/>' +
      '<g transform="translate(40 2)">' + h + '</g></g><rect x="-42" y="-160" width="24" height="10" rx="4" fill="#9AA6BC"/></g></g></g>';
  };
  var canliLobi = function () {
    return yuruyen({ cls: 'y-hem', y: 442, sc: 0.6, cins: 'K', kiyafet: '#5E9BD8', sac: '#5A3A22' }) +
      yuruyen({ cls: 'y-dr ters', y: 442, sc: 0.6, cins: 'E', rol: 'mentor', ic: '#7FA6E0', flip: true, sac: '#2E241C', ten: '#D49A6A' });
  };
  var canliKat = function (kat, servis) {
    return yuruyen({ cls: 'y-hem', y: 436, sc: 0.58, cins: 'K', kiyafet: kat.renk, sac: '#2E241C', ten: '#E8B48A' }) +
      yuruyen({ cls: 'y-dr ters', y: 436, sc: 0.58, cins: 'E', rol: 'mentor', ic: '#7FA6E0', flip: true, sac: '#5A3A22' }) +
      (servis ? sedye({ cls: 'y-sedye', y: 552, sc: 0.42 }) : '');
  };

  /* ---------- giriş (lobi) ---------- */
  var lobiSVG = function () {
    var s = '<svg class="sahne" data-vakit="' + V.vakit(vakitDk()) + '" viewBox="0 0 1000 560" role="img" aria-label="Acadex Medica giriş holü: danışma, kat yönlendirme panosu, asansör ve rehber cerrah">' + defs() + gokDefs();
    s += '<rect width="1000" height="430" fill="url(#duvar)"/>' + tavan() + zemin();
    /* yön bulma şeritleri: girişten asansöre giden renkli çizgiler */
    s += '<g class="serit" fill="none" stroke-linecap="round">' + V.KAT.map(function (k, i) { var d = 'M150 ' + (548 - i * 9) + ' C 420 ' + (548 - i * 9) + ', 700 ' + (500 - i * 7) + ', 900 ' + (440 + i * 2); return '<path d="' + d + '" stroke="' + k.renk + '" stroke-width="6" opacity=".75"/><path class="nabiz" style="animation-delay:-' + (i * 0.5) + 's" d="' + d + '" stroke="#fff" stroke-width="4" pathLength="100"/>'; }).join('') + '</g>';
    /* giriş: otomatik cam kapı */
    s += '<g><rect x="34" y="118" width="232" height="312" rx="4" fill="#8D98A8"/>' + gok(44, 128, 212, 302) + '<rect x="44" y="128" width="212" height="302" fill="url(#cam)" opacity=".28"/>' +
      '<g class="kapi1"><rect x="44" y="128" width="106" height="302" fill="#DDEFFA" opacity=".85" stroke="#9FB6C8" stroke-width="3"/><path d="M60 150 L110 230" stroke="#fff" stroke-width="5" opacity=".6"/></g>' +
      '<g class="kapi2"><rect x="150" y="128" width="106" height="302" fill="#DDEFFA" opacity=".85" stroke="#9FB6C8" stroke-width="3"/><path d="M166 150 L216 230" stroke="#fff" stroke-width="5" opacity=".6"/></g>' +
      '<rect x="34" y="96" width="232" height="26" rx="4" fill="#0D1838"/><text x="150" y="114" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="#9FE1CB" letter-spacing="3">GİRİŞ · ACİL</text></g>';
    /* tabela */
    s += '<g transform="translate(330 46)"><rect width="300" height="74" rx="12" fill="#0D1838"/><g transform="translate(40 37)"><rect x="-18" y="-6" width="36" height="12" rx="3" fill="#E5544A"/><rect x="-6" y="-18" width="12" height="36" rx="3" fill="#E5544A"/></g>' +
      '<text x="74" y="34" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="28" font-weight="800" fill="#fff">Acadex Medica</text><text x="76" y="56" font-family="JetBrains Mono,monospace" font-size="11" fill="#9FE1CB" letter-spacing="2">EĞİTİM HASTANESİ</text></g>';
    s += canliLobi();
    /* danışma bankosu */
    s += '<g><rect x="320" y="318" width="320" height="112" rx="10" fill="#FFFFFF" stroke="#C7CFDD" stroke-width="3"/><rect x="320" y="318" width="320" height="18" rx="8" fill="#2E9C86"/>' +
      '<text x="388" y="392" text-anchor="middle" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="20" font-weight="800" fill="#0D1838">Danışma</text>' +
      '<rect x="560" y="276" width="56" height="42" rx="4" fill="#2E3A5C"/><rect x="565" y="281" width="46" height="30" rx="2" fill="#7FE0C2" class="ekr"/><rect x="584" y="311" width="8" height="8" fill="#2E3A5C"/></g>';
    /* kat panosu */
    s += '<g transform="translate(668 132)"><rect width="150" height="196" rx="10" fill="#FFFFFF" stroke="#C7CFDD" stroke-width="3"/><text x="14" y="26" font-family="JetBrains Mono,monospace" font-size="12" font-weight="700" fill="#46506A" letter-spacing="2">KATLAR</text>' +
      V.KAT.slice().reverse().map(function (k, i) { return '<g transform="translate(12 ' + (40 + i * 30) + ')"><rect width="24" height="22" rx="5" fill="' + k.renk + '"/><text x="12" y="16" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="#fff">' + k.no + '</text><text x="32" y="16" font-size="11.5" font-weight="700" fill="#0D1838" font-family="Instrument Sans,sans-serif">' + X(k.ad.length > 15 ? k.ad.slice(0, 14) + '…' : k.ad) + '</text></g>'; }).join('') + '</g>';
    s += asansorKapi(846, 176, 'G');
    s += bitki(296, 430, .9) + bitki(990, 430, .8);
    s += cerrah({ x: 520, y: 520, sc: 1.05, cls: 'gelis' });
    s += '<rect class="vakit-ton" width="1000" height="560" pointer-events="none"/>';
    return s + '</svg>';
  };

  /* ---------- kat: bekleme salonu ---------- */
  var KOLTUK = [96, 224, 352, 480, 608];
  var katSVG = function (kat) {
    var L = hastalar(kat), otur = L.filter(function (s) { return !V.yatan(s); }), yat = L.filter(V.yatan);
    var sirada = siradaki(kat);
    var s = '<svg class="sahne" data-vakit="' + V.vakit(vakitDk()) + '" viewBox="0 0 1000 560" role="group" aria-label="' + X(kat.no + '. kat bekleme salonu: ' + kat.ad) + '">' + defs() + gokDefs();
    s += '<rect width="1000" height="430" fill="url(#duvar)"/><rect y="300" width="1000" height="130" fill="' + kat.acik + '"/><rect y="292" width="1000" height="10" fill="' + kat.renk + '"/>' + tavan() + zemin();
    s += '<path d="M0 520 H1000" stroke="' + kat.renk + '" stroke-width="8" opacity=".7"/>';
    /* kat tabelası */
    s += '<g transform="translate(36 38)"><rect width="330" height="84" rx="12" fill="#FFFFFF" stroke="#C7CFDD" stroke-width="3"/><circle cx="46" cy="42" r="30" fill="' + kat.renk + '"/><text x="46" y="54" text-anchor="middle" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="34" font-weight="800" fill="#fff">' + kat.no + '</text>' +
      '<text x="90" y="38" font-family="JetBrains Mono,monospace" font-size="12" font-weight="700" fill="#6A7593" letter-spacing="2">' + kat.no + '. KAT</text><text x="90" y="64" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="' + (kat.ad.length > 22 ? 17 : 21) + '" font-weight="800" fill="#0D1838">' + X(kat.ad) + '</text></g>';
    /* sıra panosu */
    s += '<g transform="translate(392 40)"><rect width="270" height="96" rx="10" fill="#0D1838"/><text x="18" y="28" font-family="JetBrains Mono,monospace" font-size="12" fill="#9AA6BC" letter-spacing="2">SIRADAKİ HASTA</text>' +
      '<text class="pano-no" x="18" y="72" font-family="JetBrains Mono,monospace" font-size="38" font-weight="700" fill="#FFB547">' + (sirada ? V.sira(kat, L.indexOf(sirada)) : '—') + '</text>' +
      '<text x="150" y="58" font-family="JetBrains Mono,monospace" font-size="15" fill="#7FE0C2">→ ODA ' + ((sirada ? L.indexOf(sirada) % 3 : 0) + 1) + '</text><text x="150" y="80" font-family="JetBrains Mono,monospace" font-size="11" fill="#9AA6BC">' + L.length + ' hasta</text>' +
      '<circle class="pano-led" cx="250" cy="22" r="5" fill="#7FE0C2"/></g>';
    /* pencere: dışarısı saate göre (sabah, gündüz, akşam, gece) */
    s += '<g><rect x="404" y="150" width="252" height="118" rx="6" fill="#FFFFFF"/>' + gok(412, 158, 236, 102) + '<path d="M530 158 v102 M412 209 h236" stroke="#FFFFFF" stroke-width="6"/><rect x="404" y="150" width="252" height="118" rx="6" fill="none" stroke="#C7CFDD" stroke-width="3"/><rect x="396" y="266" width="268" height="10" rx="4" fill="#DCE2EA"/></g>';
    /* oda kapıları */
    [0, 1, 2].forEach(function (i) {
      var x = 700 + i * 98;
      s += '<g><rect x="' + x + '" y="170" width="84" height="260" rx="4" fill="#FFFFFF" stroke="#C7CFDD" stroke-width="3"/><rect x="' + (x + 10) + '" y="186" width="64" height="96" rx="3" fill="' + kat.acik + '"/><circle cx="' + (x + 70) + '" cy="320" r="5" fill="#9AA6BC"/>' +
        '<rect x="' + (x + 12) + '" y="150" width="60" height="16" rx="3" fill="' + kat.renk + '"/><text x="' + (x + 42) + '" y="162" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700" fill="#fff">ODA ' + (i + 1) + '</text>' +
        '<circle class="oda-led" cx="' + (x + 42) + '" cy="140" r="5" fill="' + (i === 1 ? '#FFB547' : '#7FE0C2') + '"/></g>';
    });
    /* servis kapısı: yatan hastalar */
    if (yat.length) s += '<g class="servis" data-servis tabindex="0" role="button" aria-label="Servis: ' + yat.length + ' yatan hasta"><rect x="40" y="138" width="190" height="56" rx="10" fill="#FFFFFF" stroke="' + kat.renk + '" stroke-width="3"/><path d="M56 178 h34 v-10 h18 a9 9 0 0 1 9 9 v12 M56 166 v24 M117 178 v12" stroke="#0D1838" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="68" cy="170" r="5.5" fill="#0D1838"/><text x="128" y="162" font-family="JetBrains Mono,monospace" font-size="11" font-weight="700" fill="' + kat.renk + '">SERVİS →</text><text x="128" y="182" font-family="Instrument Sans,sans-serif" font-size="13" font-weight="700" fill="#0D1838">' + yat.length + ' yatan hasta</text></g>';
    /* koridorda yürüyen personel (bankın arkasından geçer) */
    s += canliKat(kat, false);
    /* banklar ve oturan hastalar */
    var gor = otur.slice(0, KOLTUK.length);
    s += '<g><rect x="40" y="378" width="640" height="16" rx="6" fill="#4E5E86"/><rect x="40" y="282" width="640" height="90" rx="12" fill="#5D6E98"/>' + KOLTUK.map(function (x) { return '<rect x="' + (x - 6) + '" y="394" width="10" height="40" fill="#3B4A6E"/>'; }).join('') + '</g>';
    var nb = S.nobet && S.nobet.kat === kat.id && S.nobet.triyaj ? S.nobet.hastalar.map(function (x) { return x.id; }) : [];
    gor.forEach(function (sen, i) {
      var x = KOLTUK[i], no = V.sira(kat, L.indexOf(sen)), g = S.gorulen[sen.id], h = Object.assign({}, sen.hasta, { poz: 'otur', x: x, y: 500 });
      var trR = nb.indexOf(sen.id) >= 0 ? V.TRIYAJ_RENK[V.triyaj(sen).renk].renk : null, zr = V.zincir(sen.id), svk = zr && zr.i > 0 && sevkAcik(sen.id) && !g;
      var ad = sen.hasta.hitap || sen.hasta.ad;
      s += '<g class="hb' + (g ? ' gor' : '') + (sirada === sen ? ' sirada' : '') + '" data-sen="' + sen.id + '" tabindex="0" role="button" aria-label="' + X('Sıra ' + no + ': ' + ad + ', ' + sen.baslik + (g ? ', görüldü' : '') + '. Odaya çağır') + '">' +
        '<g class="hb-k"><g transform="translate(' + x + ' 500) scale(.8) translate(' + (-x) + ' -500)">' + K.kisi(h) + '</g></g>' +
        '<g transform="translate(' + (x + 6) + ' ' + (sen.hasta.gorunum === 'cocuk' ? 288 : 212) + ')"><rect x="-26" y="-16" width="52" height="24" rx="6" fill="' + (g ? '#2E8E5B' : '#FFFFFF') + '" stroke="' + kat.renk + '" stroke-width="2.5"/><text x="0" y="1" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="' + (g ? '#fff' : '#0D1838') + '">' + (g ? '✓ ' : '') + no + '</text>' +
        (trR ? '<circle cx="-26" cy="-16" r="7" fill="' + trR + '" stroke="#fff" stroke-width="2"/>' : '') + (svk ? '<g class="svk"><rect x="-24" y="-40" width="48" height="18" rx="9" fill="#0D1838"/><text x="0" y="-27" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700" fill="#FFB547">SEVK</text></g>' : '') + '</g></g>';
    });
    if (otur.length > gor.length) s += '<g transform="translate(360 548)"><text text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" fill="#46506A">+' + (otur.length - gor.length) + ' hasta daha listede</text></g>';
    /* katın sorumlusu kapının yanında */
    s += '<g data-who="kat-mentor">' + K.kisi({ x: 958, y: 520, rol: 'mentor', cins: kat.mcins || 'K', ic: kat.renk, flip: true }) + '</g>';
    if (yat.length) s += sedye({ cls: 'y-sedye', y: 556, sc: 0.42 });
    s += '<rect class="vakit-ton" width="1000" height="560" pointer-events="none"/>';
    return s + '</svg>';
  };
  var siradaki = function (kat) { var L = hastalar(kat), sv = sevkBekleyen(kat); return sv[0] || L.filter(function (s) { return !S.gorulen[s.id]; })[0] || L[0] || null; };

  /* =========================== konuşma paneli =========================== */
  var yaz = null;
  var konus = function (kutu, kim, ad, metin, sonra) {
    clearInterval(yaz);
    kutu.innerHTML = '<div class="md-say"><span class="who ' + kim + '">' + X(ad) + '</span><p></p></div><div class="md-row" data-row></div>';
    var p = $('p', kutu), i = 0, bitti = false, sah = $('.sahne');
    var bitir = function () { if (bitti) return; bitti = true; clearInterval(yaz); p.textContent = metin; if (sah) sah.classList.remove('konusuyor'); if (sonra) sonra($('[data-row]', kutu)); };
    if (sah) sah.classList.add('konusuyor');
    if (RM) { bitir(); return; }
    yaz = setInterval(function () { i += 2; p.innerHTML = X(metin.slice(0, i)) + '<span class="cur"></span>'; if (i >= metin.length) bitir(); }, 20);
    $('.md-say', kutu).addEventListener('click', bitir);
  };
  var dugme = function (row, t, cls, fn, attr) { var b = D.createElement('button'); b.type = 'button'; b.className = 'md-btn ' + (cls || ''); b.innerHTML = t; if (attr) Object.keys(attr).forEach(function (k) { b.setAttribute(k, attr[k]); }); b.onclick = fn; row.appendChild(b); return b; };
  var odak = function (el) { setTimeout(function () { try { el && el.focus({ preventScroll: true }); } catch (e) {} }, 40); };

  /* =========================== üst çubuk =========================== */
  var ustCiz = function () {
    var k = S.kat ? V.katBul(S.kat) : null, n = S.nobet;
    $('#md-yer').innerHTML = S.ekran === 'lobi' ? '<i style="background:#2E9C86"></i>Giriş holü' : '<i style="background:' + k.renk + '"></i>' + k.no + '. kat · ' + X(k.ad);
    var nb = $('#md-nob');
    if (n) { var o = V.nobetOzet(n), kk = V.katBul(n.kat); nb.hidden = false; nb.innerHTML = '<span class="nb-dot"></span>Nöbet · ' + X(kk.ad) + ' · ' + o.gorulen + '/' + o.toplam + ' · ' + V.saat(n.saat); }
    else nb.hidden = true;
    saatCiz();
    bridge();
  };

  /* =========================== ekranlar =========================== */
  var ekran = function (ad, kat) {
    S.ekran = ad; S.kat = kat || null;
    var m = $('#md-main');
    if (ad === 'lobi') lobi(m); else katEkrani(m, V.katBul(kat));
    ustCiz();
    try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])kat=[^&]*&?/, '$1').replace(/[?&]$/, '') + (ad === 'kat' ? '#' + kat : '')); } catch (e) {}
  };

  /* ---------- giriş ---------- */
  var lobi = function (m) {
    m.className = 'md-ekran lobi';
    m.innerHTML = '<div class="md-sahne-k">' + lobiSVG() + '</div><div class="md-panel" data-panel aria-live="polite"></div>';
    if (dar()) $('.sahne', m).setAttribute('viewBox', '270 30 600 530');              /* telefonda cerraha ve danışmaya yaklaş */
    var panel = $('[data-panel]', m), ad = V.REHBER.unvan + ' ' + V.REHBER.ad;
    var secim = function (row) {
      row.classList.add('bolum');
      V.KAT.forEach(function (k) { dugme(row, '<b style="background:' + k.renk + '">' + k.no + '</b>' + X(k.bolum), 'kat' + (S.bolum === k.id ? ' sec' : ''), function () { S.bolum = k.id; ls.set('bolum', k.id); konus(panel, 'rehber', ad, k.bolum + ' öğrencisisin, harika. Asansör şurada; seni ' + k.no + '. kata, ' + k.ad.toLocaleLowerCase('tr') + ' katına bırakıyorum. İyi nöbetler!', function (r) { odak(dugme(r, 'Asansöre bin →', 'pri', function () { asansor(k.id); })); }); }, { 'data-bolum': k.id }); });
      odak(row.firstChild);
    };
    var tanitim = function (i) {
      konus(panel, 'rehber', ad, V.TANITIM[i], function (row) {
        if (i < V.TANITIM.length - 1) { odak(dugme(row, 'Devam', 'pri', function () { tanitim(i + 1); })); if (i === 0) dugme(row, 'Tanıtımı geç', '', function () { tanitim(V.TANITIM.length - 1); }); }
        else secim(row);
      });
    };
    var basla = function () {
      var k = S.bolum ? V.katBul(S.bolum) : null;
      if (!k) { tanitim(0); return; }
      konus(panel, 'rehber', ad, V.TEKRAR(k), function (row) {
        odak(dugme(row, 'Katıma çık →', 'pri', function () { asansor(k.id); }));
        dugme(row, 'Bölümümü değiştir', '', function () { tanitim(V.TANITIM.length - 1); });
        dugme(row, 'Tanıtımı yeniden dinle', '', function () { tanitim(0); });
      });
    };
    /* kapılar açılır, cerrah içeri yürür, sonra konuşur */
    var sv = $('.sahne', m);
    if (RM) { sv.classList.add('acik', 'geldi'); basla(); }
    else { requestAnimationFrame(function () { sv.classList.add('acik'); }); setTimeout(function () { sv.classList.add('geldi'); }, 450); setTimeout(basla, 1700); }
    $('[data-asn]', m).addEventListener('click', function () { panelAsansor(); });
  };

  /* ---------- kat ---------- */
  var katEkrani = function (m, kat) {
    var L = hastalar(kat);
    m.className = 'md-ekran kat';
    m.style.setProperty('--kc', kat.renk); m.style.setProperty('--ka', kat.acik);
    var otur = L.filter(function (s) { return !V.yatan(s); }), yat = L.filter(V.yatan), gor = L.filter(function (s) { return S.gorulen[s.id]; }).length;
    m.innerHTML = '<div class="md-kat-sol"><div class="md-sahne-k">' + katSVG(kat) + '</div><div class="md-panel" data-panel aria-live="polite"></div></div>' +
      '<aside class="md-liste" aria-label="' + X(kat.ad) + ' hastaları"><div class="md-liste-u"><div><span class="k">' + kat.no + '. kat · ' + X(kat.bolum) + '</span><h2>' + X(kat.ad) + '</h2><p class="sub">' + gor + ' / ' + L.length + ' hasta görüldü · devir: ' + X(kat.labAd) + '</p></div></div>' +
      '<div class="md-nobet-k" data-nk></div>' +
      (otur.length ? '<h3>Bekleme salonu</h3><ol class="md-hl">' + otur.map(function (s) { return hastaKart(kat, L, s); }).join('') + '</ol>' : '') +
      (yat.length ? '<h3 id="md-servis">Serviste yatan</h3><ol class="md-hl">' + yat.map(function (s) { return hastaKart(kat, L, s); }).join('') + '</ol>' : '') + '</aside>';
    if (dar()) $('.sahne', m).setAttribute('viewBox', '20 20 690 540');               /* telefonda bekleme bankına yaklaş */
    nobetKutu(kat);
    var panel = $('[data-panel]', m), kmAd = kat.mentor;
    if (S.nobet && S.nobet.kat === kat.id) nobetSiradaki(panel);
    else konus(panel, 'mentor', kmAd, (sevkBekleyen(kat).length ? 'Konsültasyon var: ' + sevkBekleyen(kat).map(function (s) { return s.hasta.hitap || s.hasta.ad; }).join(', ') + ' başka kattan sevkle geldi. ' : '') + kat.kars + (gor === L.length ? ' Bu kattaki bütün hastaları gördün; istersen nöbet tutabilir ya da yeniden görüşebilirsin.' : ' ' + (L.length - gor) + ' hasta seni bekliyor.'), function (row) {
      var sr = siradaki(kat);
      if (sr) odak(dugme(row, 'Sıradakini çağır · ' + V.sira(kat, L.indexOf(sr)), 'pri', function () { cagir(sr); }));
      if (!S.nobet) dugme(row, 'Nöbete başla', '', function () { nobetBasla(kat); });
    });
  };
  var hastaKart = function (kat, L, s) {
    var g = S.gorulen[s.id], p = V.hastaPuan(g), no = V.sira(kat, L.indexOf(s)), h = s.hasta;
    var n = S.nobet, nb = n && n.kat === kat.id && n.triyaj && n.hastalar.some(function (x) { return x.id === s.id; }), tr = nb ? V.TRIYAJ_RENK[V.triyaj(s).renk] : null;
    var zr = V.zincir(s.id), sv = zr && zr.i > 0 && sevkAcik(s.id) && !g;
    return '<li><button type="button" class="hk' + (g ? ' gor' : '') + (sv ? ' sevkli' : '') + '" data-sen="' + s.id + '"' + (tr ? ' style="--tr:' + tr.renk + '"' : '') + '><span class="no">' + (tr ? '<i class="tr" title="Triyaj: ' + tr.ad + '"></i>' : '') + no + '</span><span class="tx"><b>' + X(h.hitap || h.ad) + (h.yas != null ? ' <small>' + X(typeof h.yas === 'number' ? h.yas + ' yaş' : h.yas) + '</small>' : '') + '</b><span>' + X(s.baslik) + '</span><small>' + X(s.odaAd) + (zr ? ' · <em class="zn">' + (sv ? 'SEVK · ' + V.katOf(zr.z.zincir[zr.i - 1]).no + '. kattan' : 'konsültasyon hastası') + '</em>' : '') + '</small></span>' +
      (g ? '<span class="st ' + (p >= 85 ? 'ok' : p >= 60 ? 'orta' : 'zay') + '">' + (p != null ? p : '✓') + '</span>' : '<span class="st bek">bekliyor</span>') + '</button></li>';
  };

  /* ---------- asansör ---------- */
  var panelAsansor = function () {
    var md = modal('<div class="md-asn-panel"><span class="k">asansör</span><h2 id="md-mt">Hangi kata?</h2><div class="md-asn-b">' +
      V.KAT.slice().reverse().map(function (k) { return '<button type="button" data-kat="' + k.id + '" style="--kc:' + k.renk + '"' + (S.kat === k.id ? ' aria-current="true"' : '') + '><b>' + k.no + '</b><span>' + X(k.ad) + '<small>' + X(k.bolum) + (S.bolum === k.id ? ' · senin bölümün' : '') + '</small></span></button>'; }).join('') +
      '<button type="button" data-kat="lobi" style="--kc:#2E9C86"' + (S.ekran === 'lobi' ? ' aria-current="true"' : '') + '><b>G</b><span>Giriş holü<small>danışma ve rehber cerrah</small></span></button></div></div>');
    md.addEventListener('click', function (e) { var b = e.target.closest('[data-kat]'); if (!b) return; kapatModal(); var k = b.getAttribute('data-kat'); if (k === 'lobi') { if (S.ekran !== 'lobi') asansor(null); } else if (k !== S.kat || S.ekran !== 'kat') asansor(k); });
  };
  var asansor = function (katId, sonra) {
    var ov = $('#md-asansor'), g = $('.gosterge b', ov), ok = $('.gosterge i', ov);
    var from = S.ekran === 'lobi' ? 0 : (V.katBul(S.kat) || { no: 0 }).no, to = katId ? V.katBul(katId).no : 0;
    var git = function () { ekran(katId ? 'kat' : 'lobi', katId); if (sonra) sonra(); };
    if (RM) { git(); live((to ? to + '. kat' : 'Giriş holü') + '.'); return; }
    ov.hidden = false; g.textContent = from || 'G'; ok.textContent = to > from ? '▲' : to < from ? '▼' : '•'; ov.className = 'md-asansor';
    $('.gosterge small', ov).textContent = katId ? V.katBul(katId).ad : 'Giriş holü';
    requestAnimationFrame(function () { ov.classList.add('kapan'); });
    setTimeout(function () {
      var n = from, adim = to > from ? 1 : -1, iv = setInterval(function () {
        if (n === to) { clearInterval(iv); g.textContent = to || 'G'; ok.textContent = '•'; ding(); git(); setTimeout(function () { ov.classList.add('acil'); }, 250); setTimeout(function () { ov.hidden = true; ov.className = 'md-asansor'; }, 1100); return; }
        n += adim; g.textContent = n || 'G'; ov.classList.remove('tik'); void ov.offsetWidth; ov.classList.add('tik');
      }, 520);
    }, 620);
    live((to ? to + '. kata, ' + V.katBul(katId).ad : 'Giriş holüne') + ' çıkılıyor.');
  };

  /* =========================== hasta çağırma ve sahne =========================== */
  var cagir = function (sen, nobetten) {
    var kat = V.katBul(S.kat), L = hastalar(kat), no = V.sira(kat, L.indexOf(sen));
    bip(880, 0.25); bip(660, 0.35, 0.22);
    var pano = $('.pano-no'); if (pano) { pano.textContent = no; pano.classList.remove('flas'); void pano.getBoundingClientRect(); pano.classList.add('flas'); }
    var hb = $('.sahne [data-sen="' + sen.id + '"]'); if (hb) hb.classList.add('kalk');
    live('Sıra ' + no + ', ' + (sen.hasta.hitap || sen.hasta.ad) + ' odaya çağrıldı.');
    setTimeout(function () { sahne(sen, !!nobetten); }, RM ? 0 : 900);
  };
  var sahne = function (sen, nobetten) {
    S.aktif = { sen: sen, sahne: null, lab: null, nobet: nobetten };
    var kn = V.konsultNotu(sen.id), oyna = kn ? Object.assign({}, sen, { adimlar: [{ tip: 'konus', kim: 'anlatici', metin: kn }].concat(sen.adimlar) }) : sen;
    K.open(oyna, {
      onSonuc: function (R) { S.aktif.sahne = R.puan; S.aktif.kacan = R.rows.filter(function (r) { return r.kacan.length; }).map(function (r) { return r.kacan[0]; }).slice(0, 2); kaydetHasta(); },
      onDevir: function (R, hedef) { if (S.aktif.sahne == null) { S.aktif.sahne = R.puan; kaydetHasta(); } labAc(sen, hedef); },
      onKapat: function () { bitir(false); }
    });
    bridge();
  };
  var kaydetHasta = function () {
    var a = S.aktif; if (!a) return;
    var o = S.gorulen[a.sen.id] || {}; o.sahne = a.sahne; if (a.lab != null) o.lab = a.lab; o.t = Date.now(); S.gorulen[a.sen.id] = o;
    if (S.nobet && a.nobet) { var h = S.nobet.hastalar.filter(function (x) { return x.id === a.sen.id; })[0]; if (h) { h.sahne = a.sahne; if (a.lab != null) h.lab = a.lab; if (a.kacan) h.kacan = a.kacan; } }
    kaydet();
  };

  /* ---------- lab devri: iç çerçeve ---------- */
  var labAc = function (sen, hedef) {
    var ov = $('#md-muayene'), fr = $('iframe', ov), url = V.devirAdres(sen, hedef), kat = V.katBul(S.kat);
    if (!url) { bitir(true); return; }
    S.lab = sen.lab;
    $('#md-mu-t').textContent = (sen.hasta.hitap || sen.hasta.ad) + ' · ' + kat.labAd;
    $('#md-mu-d').textContent = 'lab sonucu bekleniyor';
    $('#md-mu-s').className = 'md-mu-s';
    ov.hidden = false; D.body.classList.add('md-labda');
    $('.md-mu-yuk', ov).hidden = false;
    fr.onload = function () { $('.md-mu-yuk', ov).hidden = true; };
    fr.setAttribute('src', url);
    setTimeout(function () { try { fr.focus(); } catch (e) {} }, 80);
    bridge();
  };
  var labKapat = function () {
    var ov = $('#md-muayene'), fr = $('iframe', ov);
    ov.hidden = true; D.body.classList.remove('md-labda'); fr.removeAttribute('src'); try { fr.src = 'about:blank'; } catch (e) {}
    S.lab = null;
  };
  /* lab'dan gelen sonuç: {src:'axmedica', type:'sonuc', puan?:0..100, tamam:true} */
  var labSonuc = function (d) {
    if (!S.aktif) return;
    if (typeof d.puan === 'number') S.aktif.lab = Math.round(d.puan);
    kaydetHasta();
    var p = V.hastaPuan(S.gorulen[S.aktif.sen.id]);
    $('#md-mu-d').textContent = 'vaka tamamlandı' + (d.puan != null ? ' · lab puanı ' + Math.round(d.puan) : '') + ' · hasta puanı ' + p;
    $('#md-mu-s').className = 'md-mu-s ok';
    var b = $('#md-mu-geri'); b.textContent = S.aktif.nobet ? 'Sıradaki hastaya geç →' : 'Bekleme salonuna dön →'; b.classList.add('pri');
    toast('Vaka tamamlandı. Hasta puanı: ' + p);
  };
  /* hasta işi bitti: bekleme salonuna dön, nöbetteyse sıradakine geç */
  var bitir = function (tamam) {
    var a = S.aktif; S.aktif = null; labKapat();
    var b = $('#md-mu-geri'); b.textContent = '← Bekleme salonuna dön'; b.classList.remove('pri');
    if (a && a.nobet && S.nobet && tamam !== false && a.sahne != null) { S.nobet.i++; S.nobet.saat += V.NOBET_DK; kaydet(); }
    var kat = S.kat;
    ekran('kat', kat);
    var sonra = function () {
      var n = S.nobet;
      if (a && a.nobet && n && n.i >= n.hastalar.length) { nobetBitir(); return; }
      if (a && a.nobet && n && n.kod && !n.kod.bitti && n.i === n.kod.i) setTimeout(kodBasla, RM ? 0 : 700);
    };
    if (a && tamam !== false && a.sahne != null && V.sevkSoru(a.sen.id)) sevkSor(a.sen.id, sonra); else sonra();
  };

  /* =========================== nöbet =========================== */
  var nobetBasla = function (kat) {
    var L = hastalar(kat).slice(), sec = [];
    var gorulmemis = L.filter(function (s) { return !S.gorulen[s.id]; }), havuz = gorulmemis.length >= Math.min(V.NOBET_HASTA, L.length) ? gorulmemis : L;
    havuz = havuz.slice(); while (sec.length < Math.min(V.NOBET_HASTA, L.length) && havuz.length) sec.push(havuz.splice(Math.floor(Math.random() * havuz.length), 1)[0]);
    S.nobet = { kat: kat.id, basla: Date.now(), saat: V.NOBET_BASLA, i: 0, hastalar: sec.map(function (s) { return { id: s.id, sahne: null, lab: null }; }), triyaj: null, kod: V.kodPlan(kat.id, sec.length) };
    kaydet(); ekran('kat', kat.id); live('Nöbet başladı: ' + sec.length + ' hasta. Saat ' + V.saat(V.NOBET_BASLA));
    setTimeout(triyajMasasi, RM ? 0 : 500);
  };
  var nobetKutu = function (kat) {
    var el = $('[data-nk]'), n = S.nobet; if (!el) return;
    if (!n) { el.innerHTML = '<button type="button" class="md-btn" data-nobet-basla>Nöbete başla</button><small>' + Math.min(V.NOBET_HASTA, hastalar(kat).length) + ' hasta sırayla gelir, sonunda nöbet karnesi çıkar.</small>'; return; }
    var kk = V.katBul(n.kat), o = V.nobetOzet(n);
    el.innerHTML = '<div class="nk-u"><span class="nb-dot"></span><b>Nöbet sürüyor</b><span class="mono">' + V.saat(n.saat) + '</span></div><p>' + X(kk.ad) + ' · ' + o.gorulen + ' / ' + o.toplam + ' hasta</p><div class="nk-b">' +
      n.hastalar.map(function (h, i) { var s = K.SEN[h.id]; return '<span class="' + (h.sahne != null ? 'ok' : i === n.i ? 'su' : '') + '" title="' + X(s ? s.hasta.hitap || s.hasta.ad : '') + '"></span>'; }).join('') + '</div>' +
      (n.kat !== kat.id ? '<button type="button" class="md-btn pri" data-nobet-kat>Nöbet katına dön</button>' : '') + '<button type="button" class="md-btn" data-nobet-bitir>Nöbeti bitir</button>';
  };
  var nobetSiradaki = function (panel) {
    var n = S.nobet, sen = K.SEN[n.hastalar[n.i] && n.hastalar[n.i].id], kat = V.katBul(n.kat);
    if (!sen) { nobetBitir(); return; }
    if (n.triyaj === null) {
      konus(panel, 'mentor', kat.mentor, 'Nöbet başlıyor, saat ' + V.saat(n.saat) + '. ' + n.hastalar.length + ' hasta geldi. Önce triyaj masasına bak: kimi önce göreceğimize birlikte karar verelim.', function (row) { odak(dugme(row, 'Triyaj masasını aç →', 'pri', triyajMasasi)); dugme(row, 'Nöbeti bitir', '', function () { nobetBitir(); }); });
      return;
    }
    if (n.kod && !n.kod.bitti && n.i === n.kod.i && n.i > 0) {
      konus(panel, 'mentor', kat.mentor, 'Bir dakika! Hoparlörden kod anonsu geliyor…', function (row) { odak(dugme(row, 'Olay yerine koş →', 'pri', kodBasla)); });
      return;
    }
    konus(panel, 'mentor', kat.mentor, (n.i === 0 ? 'Nöbet başladı, saat ' + V.saat(n.saat) + '. ' : 'Saat ' + V.saat(n.saat) + '. ') + 'Sıradaki hasta: ' + (sen.hasta.hitap || sen.hasta.ad) + ', ' + sen.baslik.toLocaleLowerCase('tr') + '.', function (row) {
      odak(dugme(row, 'Hastayı çağır →', 'pri', function () { cagir(sen, true); }));
      dugme(row, 'Nöbeti bitir', '', function () { nobetBitir(); });
      if (n.triyaj && !n.triyaj.atlandi) { var tr = V.TRIYAJ_RENK[V.triyaj(sen).renk]; row.insertAdjacentHTML('beforeend', '<span class="md-tr" style="--tr:' + tr.renk + '"><i></i>triyaj: ' + tr.ad.toLocaleLowerCase('tr') + '</span>'); }
    });
  };
  var nobetBitir = function () {
    var n = S.nobet; if (!n) return;
    n.bitis = Date.now(); S.defter.push(n); S.nobet = null; kaydet();
    karne(n); if (S.ekran === 'kat') ekran('kat', S.kat);
  };

  /* =========================== nöbet karnesi =========================== */
  var damga = function (p) { var c = p >= 85 ? '#2E8E5B' : p >= 60 ? '#B9821F' : '#C9483B', l = p >= 85 ? 'ÇOK İYİ' : p >= 60 ? 'GELİŞİYOR' : 'TEKRAR'; return '<div class="damga" style="color:' + c + '"><b>' + p + '</b><small>' + l + '</small></div>'; };
  var karne = function (n) {
    var o = V.nobetOzet(n), kat = V.katBul(n.kat);
    var satir = n.hastalar.map(function (h) { var s = K.SEN[h.id]; if (!s) return ''; var p = V.hastaPuan(h); return '<tr><td><b>' + X(s.hasta.hitap || s.hasta.ad) + '</b><small>' + X(s.baslik) + '</small>' + (h.kacan && h.kacan.length ? '<small class="kc">kaçan: ' + X(h.kacan.join('; ')) + '</small>' : '') + '</td><td class="n">' + (h.sahne != null ? h.sahne : '—') + '</td><td class="n">' + (h.lab != null ? h.lab : '—') + '</td><td class="n"><b>' + (p != null ? p : 'görülmedi') + '</b></td></tr>'; }).join('');
    modal('<div class="md-karne">' + damga(o.ort) + '<span class="k">nöbet karnesi · ' + X(kat.ad) + '</span><h2 id="md-mt">' + o.gorulen + ' / ' + o.toplam + ' hasta · ortalama ' + o.ort + '</h2><p class="sub">' + V.saat(V.NOBET_BASLA) + ' – ' + V.saat(n.saat) + ' · ' + new Date(n.bitis || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + '</p>' +
      '<div class="tw"><table><thead><tr><th>Hasta</th><th class="n">Görüşme</th><th class="n">Lab</th><th class="n">Puan</th></tr></thead><tbody>' + satir + '</tbody></table></div>' +
      ((n.triyaj || n.kod) ? '<div class="md-ek">' + (n.triyaj ? '<div><span class="k">triyaj masası</span><b>' + (n.triyaj.atlandi ? 'atlandı' : n.triyaj.dogru + ' / ' + n.triyaj.toplam + ' doğru') + '</b><small>' + (n.triyaj.atlandi ? '—' : n.triyaj.puan) + '</small></div>' : '') +
        (n.kod ? '<div style="--kr:' + V.KOD[n.kod.tip].renk + '"><span class="k">acil kod</span><b>' + X(V.KOD[n.kod.tip].ad) + '</b><small>' + (n.kod.puan != null ? n.kod.puan + ' · ' + (n.kod.hata || 0) + ' hata' : 'gerçekleşmedi') + '</small></div>' : '') + '</div>' : '') +
      '<p class="not">Görüşme puanı odadaki anamnez, muayene ve karardan; lab puanı ' + X(kat.labAd) + ' formundan gelir. Kaçan sorular bir sonraki nöbette ilk bakman gereken yerlerdir.</p>' +
      '<div class="md-row"><button type="button" class="md-btn pri" data-kapat>Tamam</button><button type="button" class="md-btn" data-defter>Bütün nöbetler</button></div></div>');
  };
  var defter = function () {
    var katlar = V.KAT.map(function (k) { var L = hastalar(k), g = L.filter(function (s) { return S.gorulen[s.id]; }), ps = g.map(function (s) { return V.hastaPuan(S.gorulen[s.id]); }).filter(function (p) { return p != null; }); return { k: k, n: L.length, g: g.length, ort: ps.length ? Math.round(ps.reduce(function (a, b) { return a + b; }, 0) / ps.length) : null }; });
    var html = '<div class="md-karne"><span class="k">nöbet karnesi</span><h2 id="md-mt">Hastane dosyan</h2>' +
      '<div class="md-katlar">' + katlar.map(function (x) { return '<div class="kd" style="--kc:' + x.k.renk + '"><b>' + x.k.no + '</b><span>' + X(x.k.ad) + '<small>' + x.g + ' / ' + x.n + ' hasta' + (x.ort != null ? ' · ort. ' + x.ort : '') + '</small></span><i style="width:' + Math.round(x.g / Math.max(1, x.n) * 100) + '%"></i></div>'; }).join('') + '</div>' +
      '<h3>Nöbetler</h3>' + (S.defter.length ? '<ol class="md-def">' + S.defter.slice().reverse().map(function (n, i) { var o = V.nobetOzet(n), k = V.katBul(n.kat); return '<li><button type="button" data-nb="' + (S.defter.length - 1 - i) + '"><span class="dt">' + new Date(n.bitis || n.basla).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + '</span><span>' + X(k ? k.ad : n.kat) + '<small>' + o.gorulen + ' / ' + o.toplam + ' hasta</small></span><b>' + o.ort + '</b></button></li>'; }).join('') + '</ol>' : '<p class="sub">Henüz nöbet tutmadın. Bir kata çık ve “Nöbete başla”ya bas.</p>') +
      '<div class="md-row"><button type="button" class="md-btn pri" data-kapat>Kapat</button></div></div>';
    var md = modal(html);
    md.addEventListener('click', function (e) { var b = e.target.closest('[data-nb]'); if (b) { kapatModal(); karne(S.defter[+b.getAttribute('data-nb')]); } });
  };

  /* =========================== canlı hastane: saat, vakit ve anonslar =========================== */
  var VAKIT_AD = { sabah: 'sabah', gunduz: 'gündüz', aksam: 'akşam', gece: 'gece' };
  var saatCiz = function () {
    var el = $('#md-saat'); if (!el) return;
    var dk = vakitDk(), v = V.vakit(dk);
    el.innerHTML = (v === 'gece' || v === 'aksam' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11z"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>') +
      '<b class="mono">' + V.saat(dk) + '</b><span>' + VAKIT_AD[v] + (S.nobet ? ' · nöbet' : '') + '</span>';
    el.setAttribute('aria-label', 'Hastane saati ' + V.saat(dk) + ', ' + VAKIT_AD[v]);
    var sv = $('#md-main .sahne'); if (sv) sv.setAttribute('data-vakit', v);
  };
  setInterval(saatCiz, 30000);
  var anonsT = null;
  var anons = function (metin, kod) {
    var k = $('#md-main .md-sahne-k'); if (!k) return;
    var el = $('.md-anons', k);
    if (!el) { el = D.createElement('div'); el.className = 'md-anons'; el.setAttribute('aria-hidden', 'true'); k.appendChild(el); }
    el.className = 'md-anons' + (kod ? ' kod' : '');
    el.innerHTML = '<i><svg viewBox="0 0 24 24"><path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg></i><span>' + X(metin) + '</span>';
    void el.offsetWidth; el.classList.add('on');
    if (AC || kod) { bip(784, 0.5, 0); bip(622, 0.7, 0.32); }
    clearTimeout(anons.h); anons.h = setTimeout(function () { el.classList.remove('on'); }, kod ? 5200 : 6500);
  };
  var anonsPlanla = function () {
    clearTimeout(anonsT);
    anonsT = setTimeout(function () {
      if ((S.ekran === 'kat' || S.ekran === 'lobi') && !S.aktif && !S.olay && !$('.md-modal') && !(K.acik && K.acik()) && !D.hidden) {
        var L = V.ANONS.genel.concat(S.kat ? V.ANONS[S.kat] || [] : V.ANONS.tip);
        anons(L[Math.floor(Math.random() * L.length)]);
      }
      anonsPlanla();
    }, (RM ? 60 : 24) * 1000 + Math.random() * 18000);
  };

  /* =========================== triyaj masası (nöbet başında) =========================== */
  var triyajMasasi = function () {
    var n = S.nobet; if (!n) return;
    var sec = {}, ids = n.hastalar.map(function (h) { return h.id; });
    S.olay = 'triyaj'; bridge();
    var kart = function (id) {
      var s = K.SEN[id], h = s.hasta, ib = V.ilkBakis(s);
      return '<li class="ty-k" data-ty="' + id + '"><div class="ty-u"><b>' + X(h.hitap || h.ad) + ' <small>' + X(typeof h.yas === 'number' ? h.yas + ' yaş' : h.yas) + '</small></b><span>' + X(s.baslik) + '</span><small class="ty-v">' + X(ib.gelis) + ' · ' + X(ib.vital) + '</small></div>' +
        '<div class="ty-r" role="radiogroup" aria-label="' + X((h.hitap || h.ad) + ' için triyaj rengi') + '">' + Object.keys(V.TRIYAJ_RENK).map(function (r) { var R = V.TRIYAJ_RENK[r]; return '<button type="button" role="radio" aria-checked="false" data-renk="' + r + '" style="--tr:' + R.renk + '"><i></i>' + R.ad + '</button>'; }).join('') + '</div><p class="ty-g" hidden></p></li>';
    };
    var md = modal('<div class="md-triyaj"><span class="k">nöbet başı · triyaj masası</span><h2 id="md-mt">Kimi önce görelim?</h2><p class="sub">Hastaları renklendir: <b style="color:#D9362B">kırmızı</b> hemen, <b style="color:#B98200">sarı</b> kısa sürede, <b style="color:#2E9C5B">yeşil</b> bekleyebilir. Sıra buna göre kurulur.</p>' +
      '<ol class="ty-l">' + ids.map(kart).join('') + '</ol><div class="md-row"><button type="button" class="md-btn pri" data-ty-bitir disabled>Sırayı kur</button><button type="button" class="md-btn" data-ty-gec>Triyajı atla</button></div></div>', { kapatma: true });
    var bitirB = $('[data-ty-bitir]', md);
    md.addEventListener('click', function (e) {
      var b = e.target.closest('[data-renk]');
      if (b && !md.classList.contains('bitti')) {
        var li = b.closest('[data-ty]'); sec[li.getAttribute('data-ty')] = b.getAttribute('data-renk');
        $$('[data-renk]', li).forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
        bitirB.disabled = Object.keys(sec).length < ids.length; return;
      }
      if (e.target.closest('[data-ty-bitir]')) {
        if (md.classList.contains('bitti')) { kapatModal(); S.olay = null; ekran('kat', S.kat); return; }
        var R = V.triyajPuan(ids, sec, K.SEN); md.classList.add('bitti');
        R.satir.forEach(function (r) {
          var li = $('[data-ty="' + r.id + '"]', md), g = $('.ty-g', li), D0 = V.TRIYAJ_RENK[r.dogru];
          li.classList.add(r.ok ? 'ok' : 'no'); $$('[data-renk]', li).forEach(function (x) { x.disabled = true; if (x.getAttribute('data-renk') === r.dogru) x.classList.add('dogru'); });
          g.hidden = false; g.innerHTML = (r.ok ? '✓ ' : '✗ ') + '<b style="color:' + D0.renk + '">' + D0.ad + '</b> · ' + X(r.neden) + (r.eksikTriyaj ? ' <em>Düşük önceliklendirme en riskli hatadır.</em>' : '');
        });
        n.triyaj = { puan: R.puan, dogru: R.dogru, toplam: R.toplam, sec: sec };
        var sira = V.triyajSira(ids, K.SEN); n.hastalar.sort(function (a, b) { return sira.indexOf(a.id) - sira.indexOf(b.id); });
        kaydet();
        $('h2', md).textContent = R.dogru + ' / ' + R.toplam + ' doğru triyaj';
        $('.sub', md).textContent = 'Sıra kırmızı → sarı → yeşil olarak kuruldu. Gerekçeleri oku, sonra nöbete başla.';
        bitirB.textContent = 'Nöbete başla →'; $('[data-ty-gec]', md).hidden = true; odak(bitirB);
        live('Triyaj puanı ' + R.puan + '.');
        return;
      }
      if (e.target.closest('[data-ty-gec]')) { n.triyaj = { puan: 0, dogru: 0, toplam: ids.length, atlandi: true }; var sr = V.triyajSira(ids, K.SEN); n.hastalar.sort(function (a, b) { return sr.indexOf(a.id) - sr.indexOf(b.id); }); kaydet(); kapatModal(); S.olay = null; ekran('kat', S.kat); }
    });
    odak($('[data-renk]', md));
  };

  /* =========================== acil kod (nöbette süreli olay) =========================== */
  var kodBasla = function () {
    var n = S.nobet; if (!n || !n.kod || n.kod.bitti) return;
    var KD = V.KOD[n.kod.tip], kat = V.katBul(n.kat), dogru = KD.adimlar.slice(), karisik = dogru.slice();
    var guv = 0; do { karisik.sort(function () { return Math.random() - 0.5; }); guv++; } while (karisik.join() === dogru.join() && guv < 9);
    var hata = 0, adim = 0, kalan = KD.sure, bitti = false;
    S.olay = 'kod'; bridge();
    var ov = D.createElement('div'); ov.className = 'md-kod'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'md-kod-t'); ov.style.setProperty('--kr', KD.renk);
    ov.innerHTML = '<div class="kd-isik" aria-hidden="true"><i></i><i></i></div><div class="kd-k"><div class="kd-u"><span class="kd-rozet">' + X(KD.ad.toLocaleUpperCase('tr')) + '</span><h2 id="md-kod-t">' + X(KD.ad) + ' · ' + kat.no + '. kat</h2>' +
      '<svg class="kd-sure" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" fill="none" stroke="#E3E8EE" stroke-width="5"/><circle class="kd-hal" cx="22" cy="22" r="19" fill="none" stroke="var(--kr)" stroke-width="5" stroke-linecap="round" pathLength="100" stroke-dasharray="100" transform="rotate(-90 22 22)"/><text x="22" y="27" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="#0D1838">' + kalan + '</text></svg></div>' +
      '<p class="kd-olay">' + X(KD.olay) + '</p><p class="kd-yon"><b>Doğru sırayla</b> adımlara dokun. Yanlış adım süre ve puan kaybettirir.</p>' +
      '<ol class="kd-sira" aria-label="Seçtiğin sıra"></ol><div class="kd-ad">' + karisik.map(function (t) { return '<button type="button" data-kd="' + X(t) + '">' + X(t) + '</button>'; }).join('') + '</div><p class="kd-fb" aria-live="polite"></p>' +
      '<div class="md-row"><button type="button" class="md-btn" data-kd-ekip>Ekip devralsın</button></div></div>';
    D.body.appendChild(ov);
    if (!RM) { [0, 0.45, 0.9, 1.35].forEach(function (g, i) { bip(i % 2 ? 660 : 880, 0.38, g); }); }
    live(KD.ad + '! ' + kat.no + '. kat. ' + KD.olay);
    var tx = $('.kd-sure text', ov), hal = $('.kd-hal', ov);
    var sonuc = function (sureBitti) {
      if (bitti) return; bitti = true; clearInterval(ov.t);
      var p = V.kodPuan(hata, sureBitti); n.kod.puan = p; n.kod.hata = hata; n.kod.kalan = kalan; n.kod.bitti = true; kaydet();
      ov.classList.add('bitti');
      $('.kd-k', ov).innerHTML = '<span class="k">' + X(KD.ad) + ' · sonuç</span><h2 id="md-kod-t">' + (sureBitti ? 'Süre doldu, ekip devraldı' : 'Olay yönetildi') + '</h2>' + damga(p) +
        '<p class="sub">' + hata + ' yanlış adım · ' + (sureBitti ? 'süre doldu' : kalan + ' saniye kala bitti') + '</p><h3>Doğru sıra</h3><ol class="kd-dogru">' + dogru.map(function (t) { return '<li>' + X(t) + '</li>'; }).join('') + '</ol><p class="not">' + X(KD.not) + '</p>' +
        '<div class="md-row"><button type="button" class="md-btn pri" data-kd-kapat>Nöbete dön →</button></div>';
      odak($('[data-kd-kapat]', ov));
    };
    ov.t = setInterval(function () { kalan--; tx.textContent = Math.max(0, kalan); hal.style.strokeDashoffset = String(100 - Math.max(0, kalan) / KD.sure * 100); if (kalan <= 10) ov.classList.add('az'); if (kalan <= 0) sonuc(true); }, 1000);
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kd]');
      if (b && !bitti && !b.disabled) {
        var t = b.getAttribute('data-kd'), fb = $('.kd-fb', ov);
        if (t === dogru[adim]) {
          adim++; b.disabled = true; b.classList.add('ok');
          var li = D.createElement('li'); li.textContent = t; $('.kd-sira', ov).appendChild(li);
          fb.className = 'kd-fb ok'; fb.textContent = 'Doğru. ' + (adim < dogru.length ? 'Sıradaki adım?' : '');
          if (adim >= dogru.length) setTimeout(function () { sonuc(false); }, 350);
        } else {
          hata++; kalan = Math.max(1, kalan - 3); b.classList.remove('salla'); void b.offsetWidth; b.classList.add('salla');
          fb.className = 'kd-fb no'; fb.textContent = 'Henüz değil: önce “' + dogru[adim].split(/[;:(]/)[0].trim() + '…” gibi bir adım gelmeli.';
        }
        return;
      }
      if (e.target.closest('[data-kd-ekip]')) { kalan = 0; sonuc(true); return; }
      if (e.target.closest('[data-kd-kapat]')) { ov.remove(); S.olay = null; ekran('kat', S.kat); }
    });
    odak($('[data-kd]', ov));
  };

  /* =========================== konsültasyon / sevk =========================== */
  var sevkDurum = function (zid) { return S.sevk[zid] || (S.sevk[zid] = { acik: 0, sec: {} }); };
  /* zincirde bu halkaya sevk edildi mi (ilk halka her zaman açık) */
  var sevkAcik = function (id) { var r = V.zincir(id); return !r || r.i === 0 || sevkDurum(r.z.id).acik >= r.i; };
  var sevkBekleyen = function (kat) { return hastalar(kat).filter(function (s) { var r = V.zincir(s.id); return r && r.i > 0 && sevkAcik(s.id) && !S.gorulen[s.id]; }); };
  var sevkSor = function (id, sonra) {
    var q = V.sevkSoru(id); if (!q) { if (sonra) sonra(); return false; }
    var dz = sevkDurum(q.z.id); if (dz.sec[q.i] != null) { if (sonra) sonra(); return false; }
    var s = K.SEN[id], hedef = V.katBul(q.hedef);
    S.olay = 'sevk'; bridge();
    var md = modal('<div class="md-sevk"><span class="k">konsültasyon · ' + X(q.z.ad) + '</span><h2 id="md-mt">' + X(s.hasta.hitap || s.hasta.ad) + ' için hangi bölüme sevk edersin?</h2><p class="sub">Hastanın bugünkü sorunlarını düşün: başka bir meslektaşın değerlendirmesi gerekiyor mu?</p>' +
      '<div class="md-asn-b sv-b">' + q.secenek.map(function (k) { var K0 = k === 'yok' ? null : V.katBul(k); return '<button type="button" data-sv="' + k + '" style="--kc:' + (K0 ? K0.renk : '#6A7593') + '"><b>' + (K0 ? K0.no : '—') + '</b><span>' + (K0 ? X(K0.ad) + '<small>' + X(K0.bolum) + '</small>' : 'Sevk gerekmez<small>taburcu, poliklinik kontrolü</small>') + '</span></button>'; }).join('') + '</div><p class="sv-g" hidden></p><div class="md-row" data-sv-row hidden></div></div>', { kapatma: true });
    md.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sv]'); if (!b || dz.sec[q.i] != null) return;
      var k = b.getAttribute('data-sv'), ok = k === q.hedef;
      dz.sec[q.i] = k; dz.acik = Math.max(dz.acik, q.i + 1); kaydet();
      $$('[data-sv]', md).forEach(function (x) { x.disabled = true; if (x.getAttribute('data-sv') === q.hedef) x.classList.add('dogru'); else if (x === b) x.classList.add('yanlis'); });
      var g = $('.sv-g', md); g.hidden = false; g.className = 'sv-g ' + (ok ? 'ok' : 'no');
      g.innerHTML = (ok ? '<b>Doğru sevk.</b> ' : '<b>Doğru bölüm: ' + hedef.no + '. kat, ' + X(hedef.ad.toLocaleLowerCase('tr')) + '.</b> ') + X(q.neden) + ' ' + X(K.SEN[q.sonraki].hasta.hitap || K.SEN[q.sonraki].hasta.ad) + ' ' + hedef.no + '. katta konsültasyon notuyla seni bekliyor.';
      var row = $('[data-sv-row]', md); row.hidden = false;
      var bb = dugme(row, hedef.no + '. kata git →', 'pri', function () { kapatModal(true); S.olay = null; if (S.nobet && S.nobet.kat === S.kat) { toast('Sevkli hasta ' + hedef.no + '. katta. Nöbet bitince görebilirsin.'); if (sonra) sonra(); return; } asansor(hedef.id); });
      dugme(row, 'Burada kal', '', function () { kapatModal(); S.olay = null; if (sonra) sonra(); else ekran('kat', S.kat); });
      odak(bb); live(ok ? 'Doğru sevk.' : 'Sevk yanlış; doğru bölüm ' + hedef.ad + '.');
    });
    odak($('[data-sv]', md));
    return true;
  };
  var konsultPanel = function () {
    var html = '<div class="md-kons"><span class="k">konsültasyonlar</span><h2 id="md-mt">Katlar arası hastalar</h2><p class="sub">Aynı hasta birden çok bölümde görülür. Bir halkayı bitirince doğru bölüme sevk et; sevk ettiğin kat hastayı konsültasyon notuyla karşılar.</p>' +
      V.KONSULT.map(function (z) {
        var dz = sevkDurum(z.id);
        return '<section class="kn"><h3>' + X(z.ad) + '</h3><ol class="kn-z">' + z.zincir.map(function (id, i) {
          var s = K.SEN[id], k = V.katOf(id), g = S.gorulen[id], p = g ? V.hastaPuan(g) : null, acik = i === 0 || dz.acik >= i, sv = dz.sec[i - 1];
          var durum = g ? 'görüldü' + (p != null ? ' · ' + p : '') : acik ? (i ? 'sevk edildi, bekliyor' : 'bekliyor') : 'henüz sevk edilmedi';
          return (i ? '<li class="kn-ok' + (sv != null ? (sv === k.id ? ' ok' : ' no') : '') + '" aria-hidden="true">' + (sv != null ? (sv === k.id ? '✓ sevk' : '✗ sevk') : '→') + '</li>' : '') +
            '<li class="kn-h' + (g ? ' gor' : acik ? ' acik' : '') + '" style="--kc:' + k.renk + '"><button type="button" data-kn-kat="' + k.id + '"' + (acik ? '' : ' disabled') + '><b>' + k.no + '</b><span>' + X(s.baslik) + '<small>' + X(k.ad) + ' · ' + durum + '</small></span></button></li>';
        }).join('') + '</ol></section>';
      }).join('') + '<div class="md-row"><button type="button" class="md-btn pri" data-kapat>Kapat</button></div></div>';
    var md = modal(html);
    md.addEventListener('click', function (e) { var b = e.target.closest('[data-kn-kat]'); if (!b || b.disabled) return; kapatModal(); var k = b.getAttribute('data-kn-kat'); if (k !== S.kat || S.ekran !== 'kat') asansor(k); });
  };

  /* =========================== kalıcı pencere =========================== */
  var modalOnce = null;
  /* o.kapatma: karar penceresi (triyaj, sevk) dışına tıklayarak ya da Esc ile kapanmaz */
  var modal = function (html, o) {
    kapatModal(true);
    var zor = !!(o && o.kapatma);
    var w = D.createElement('div'); w.className = 'md-modal'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'md-mt');
    if (zor) w.setAttribute('data-zorunlu', '');
    w.innerHTML = '<div class="md-mk">' + (zor ? '' : '<button type="button" class="md-x" data-kapat aria-label="Kapat">×</button>') + html + '</div>';
    modalOnce = D.activeElement; D.body.appendChild(w);
    w.addEventListener('click', function (e) { if ((e.target === w && !zor) || e.target.closest('[data-kapat]')) kapatModal(); if (e.target.closest('[data-defter]')) { kapatModal(); defter(); } });
    odak($('button:not([data-kapat])', w) || $('[data-kapat]', w));
    return w;
  };
  var kapatModal = function (sessiz) { var w = $('.md-modal'); if (w) w.remove(); if (!sessiz && modalOnce) { odak(modalOnce); } };

  /* =========================== olaylar =========================== */
  D.addEventListener('click', function (e) {
    var h = e.target.closest('[data-sen]');
    if (h && !e.target.closest('.md-modal')) { var sen = K.SEN[h.getAttribute('data-sen')]; if (sen) { if (S.nobet && S.nobet.kat === S.kat) { var cur = S.nobet.hastalar[S.nobet.i]; if (!cur || cur.id !== sen.id) { toast('Nöbet sürüyor: sıradaki hastayı çağır ya da nöbeti bitir.'); return; } cagir(sen, true); return; } cagir(sen); } return; }
    if (e.target.closest('[data-servis]')) { var sv = $('#md-servis'); if (sv) sv.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); return; }
    if (e.target.closest('[data-nobet-basla]')) { nobetBasla(V.katBul(S.kat)); return; }
    if (e.target.closest('[data-nobet-bitir]')) { nobetBitir(); return; }
    if (e.target.closest('[data-nobet-kat]')) { asansor(S.nobet.kat); return; }
  });
  D.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.sahne [data-sen], .sahne [data-servis]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    if (e.key === 'Escape' && $('.md-modal') && !$('.md-modal[data-zorunlu]') && !(K.acik && K.acik())) kapatModal();
  });
  $('#md-asn').addEventListener('click', panelAsansor);
  $('#md-def').addEventListener('click', defter);
  $('#md-kon').addEventListener('click', konsultPanel);
  $('#md-nob').addEventListener('click', function () { if (S.nobet) { if (S.ekran !== 'kat' || S.kat !== S.nobet.kat) asansor(S.nobet.kat); } });
  $('#md-mu-geri').addEventListener('click', function () { bitir(true); });
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#md-muayene').hidden && !$('.md-modal')) { /* lab açıkken Esc lab'ın kendi penceresine kalır */ } });

  /* =========================== Acadia köprüsü ve iç çerçeve aktarımı =========================== */
  var EMB = W.parent !== W && /(?:\?|&)medlab=1(?:&|$)/.test(location.search), ORG = location.origin;
  var ust = function (m) { if (!EMB) return; m.src = 'axlab'; m.lab = 'medica'; try { W.parent.postMessage(m, ORG); } catch (e) {} };
  var ic = function () { var f = $('#md-muayene iframe'); return S.lab && f && f.contentWindow ? f.contentWindow : null; };
  var ctx = function () {
    var k = S.kat ? V.katBul(S.kat) : null, a = S.aktif;
    if (S.olay === 'triyaj') return { sel: { key: 'medica.triyaj', title: 'Triyaj masası', la: 'Nöbet başı', rows: [['Renkler', 'kırmızı hemen, sarı kısa sürede, yeşil bekleyebilir']], about: 'öğrenci Acadex Medica nöbetinin başında hastaları triyaj rengine göre önceliklendiriyor; bu puanlanıyor. Hangi hastanın hangi renk olduğunu söyleme; triyajın genel ilkelerini (havayolu, solunum, dolaşım, bilinç, ağrı) anlatabilirsin.' }, chips: [['triyaj', 'Triyaj nasıl yapılır?']] };
    if (S.olay === 'kod') return { sel: { key: 'medica.kod', title: 'Acil kod', la: 'Süreli olay', rows: [['Kod', S.nobet && S.nobet.kod ? V.KOD[S.nobet.kod.tip].ad : '']], about: 'öğrenci Acadex Medica nöbetinde süreli bir acil kod olayını yönetiyor; adımları doğru sırayla seçmesi puanlanıyor. Sırayı doğrudan söyleme.' }, chips: [] };
    if (S.olay === 'sevk') return { sel: { key: 'medica.sevk', title: 'Konsültasyon', la: 'Sevk kararı', rows: [], about: 'öğrenci Acadex Medica’da bir hastayı başka bölüme sevk edip etmeyeceğine karar veriyor; bu puanlanıyor. Doğru bölümü söyleme; ekip çalışması ve konsültasyon ilkelerini anlatabilirsin.' }, chips: [] };
    if (a && K.acik && K.acik()) {
      var s = a.sen;
      return { sel: { key: 'medica.sahne.' + s.id, title: (s.odaAd || '') + ' · ' + (s.hasta.hitap || s.hasta.ad), la: 'Hasta görüşmesi', rows: [['Yakınma', s.baslik], ['Oda', s.odaAd]],
        about: 'öğrenci Acadex Medica eğitim hastanesinde kurgusal bir hastayla görüşüyor ("' + s.baslik + '"). Görüşme ve klinik karar puanlanıyor; seçilecek soruları, muayeneyi ya da kararı doğrudan söyleme. Genel görüşme ilkelerini anlatabilirsin.' },
        chips: [['gorusme', 'İyi bir anamnez nasıl alınır?']] };
    }
    if (S.ekran === 'kat' && k) {
      var L = hastalar(k);
      return { sel: { key: 'medica.kat.' + k.id, title: k.no + '. kat · ' + k.ad, la: 'Bekleme salonu', rows: [['Bölüm', k.bolum], ['Hastalar', L.map(function (s) { return (s.hasta.hitap || s.hasta.ad) + ' (' + s.baslik + ')' + (S.gorulen[s.id] ? ' ✓' : ''); }).join('; ')], ['Nöbet', S.nobet ? 'sürüyor, ' + V.nobetOzet(S.nobet).gorulen + '/' + S.nobet.hastalar.length : 'yok']],
        about: 'öğrenci Acadex Medica eğitim hastanesinin ' + k.ad + ' katında, bekleme salonunda. Hastaları seçip görüşüyor, ardından ' + k.labAd + '’de vakayı tamamlıyor.' },
        chips: [['kat', 'Bu katta kimler bekliyor?'], ['nobet', 'Nöbet modu nasıl çalışır?'], ['konsult', 'Konsültasyon nasıl işler?']] };
    }
    return { sel: { key: 'medica.lobi', title: 'Giriş holü', la: 'Acadex Medica', rows: [['Bölümün', S.bolum ? V.katBul(S.bolum).bolum : 'seçilmedi']], about: 'öğrenci Acadex Medica eğitim hastanesinin giriş holünde; rehber cerrah hastaneyi tanıtıyor ve öğrencinin bölümüne göre kat seçiliyor.' },
      chips: [['katlar', 'Hangi katta ne var?'], ['nobet', 'Nöbet modu nasıl çalışır?']] };
  };
  var bridge = function () { if (!EMB || S.lab) return; clearTimeout(bridge.t); bridge.t = setTimeout(function () { var c = ctx(); ust({ type: 'ctx', mode: S.ekran, spot: false, sel: c.sel, chips: c.chips }); }, 60); };
  var cevap = function (kind) {
    var k = S.kat ? V.katBul(S.kat) : null;
    if (kind === 'katlar') return V.KAT.map(function (x) { return x.no + '. kat: ' + x.ad + ' (' + x.bolum + ', devir ' + x.labAd + ', ' + hastalar(x).length + ' hasta)'; }).join('. ') + '. Asansörle istediğin kata geçebilirsin.';
    if (kind === 'nobet') return 'Nöbet modunda katın hastalarından ' + V.NOBET_HASTA + ' kişi gelir; önce triyaj masasında onları önceliklendirirsin, sıra buna göre kurulur. Nöbet sırasında bir kez süreli bir acil kod olayı çıkabilir. Her hastayla görüşür, ardından lab’da vakayı tamamlarsın; nöbet saati her hastada ' + V.NOBET_DK + ' dakika ilerler. Nöbet bitince görüşme ve lab puanlarınla nöbet karnesi çıkar; bütün nöbetlerin “Nöbet karnesi”nde birikir.';
    if (kind === 'kat' && k) { var L = hastalar(k); return k.ad + ' katında ' + L.length + ' hasta var: ' + L.map(function (s) { return (s.hasta.hitap || s.hasta.ad) + ', ' + s.baslik.toLocaleLowerCase('tr') + (S.gorulen[s.id] ? ' (görüldü)' : ''); }).join('; ') + '.'; }
    if (kind === 'triyaj') return 'Triyajda önce yaşamı tehdit eden durum aranır: havayolu, solunum (SpO₂, nefes darlığı), dolaşım (nabız, tansiyon, kanama), bilinç ve zamana bağlı tablolar (inme, kafa travması). Bunlar kırmızıdır. Stabil ama kısa sürede bakılması gereken ağrılı ya da ilerleyebilecek durumlar sarı, planlı ve stabil başvurular yeşildir. Düşük önceliklendirme en riskli hatadır.';
    if (kind === 'konsult') return 'Konsültasyon zincirlerinde aynı hasta birden çok bölümde görülür. Bir halkayı bitirince hangi meslektaşın değerlendirmesi gerektiğine karar verip sevk edersin; sevk ettiğin kat hastayı konsültasyon notuyla karşılar. Zincirleri üst çubuktaki “Konsültasyon” düğmesinden izleyebilirsin.';
    if (kind === 'gorusme') return K.GENEL.iyi + ' Açık uçlu başla, sonra yakınmayı daraltan sorular sor. ' + K.GENEL.kotu + ' ' + K.GENEL.bos;
    return null;
  };
  var siniflandir = function (q) { if (/triyaj|öncelik/.test(q)) return 'triyaj'; if (/konsült|konsult|sevk/.test(q)) return 'konsult'; if (/kat(ta|lar)|ne var/.test(q)) return S.ekran === 'kat' && /bekli|kim/.test(q) ? 'kat' : 'katlar'; if (/nöbet|nobet/.test(q)) return 'nobet'; if (/kim|bekli/.test(q)) return 'kat'; if (/anamnez|görüşme/.test(q)) return 'gorusme'; return null; };
  W.addEventListener('message', function (e) {
    if (e.origin !== ORG) return;
    var d = e.data; if (!d) return;
    var f = $('#md-muayene iframe');
    /* iç çerçevedeki lab: sonuç ve Acadia bağlamı */
    if (f && e.source === f.contentWindow) {
      if (d.src === 'axmedica' && d.type === 'sonuc') { labSonuc(d); return; }
      if (d.src === 'axlab' && EMB) { var m = JSON.parse(JSON.stringify(d)); if (m.sel && m.sel.title) m.sel.title = (V.katBul(S.kat) || { labAd: '' }).labAd + ' · ' + m.sel.title; ust(m); }
      return;
    }
    /* üst sayfa (MedLab Acadia köprüsü) */
    if (!EMB || e.source !== W.parent || d.src !== 'axhost') return;
    var i = ic();
    if (i) { try { i.postMessage(d, ORG); } catch (er) {} return; }
    if (d.type === 'hello') { bridge(); return; }
    if (d.type !== 'ask') return;
    var kind = d.kind || siniflandir(String(d.q || '').toLocaleLowerCase('tr')), text = kind ? cevap(kind) : null;
    if (!text) { ust({ type: 'reply', id: d.id, miss: true }); return; }
    ust({ type: 'ack', id: d.id }); ust({ type: 'reply', id: d.id, text: text });
  });

  /* =========================== başlat =========================== */
  var q = new URLSearchParams(location.search), h0 = (location.hash || '').slice(1), k0 = q.get('kat') || h0;
  if (k0 && V.katBul(k0)) ekran('kat', k0); else ekran('lobi');
  anonsPlanla();
  W.AXMEDICA_APP = { S: S, ekran: ekran, asansor: asansor, cagir: cagir, nobetBasla: nobetBasla, nobetBitir: nobetBitir, defter: defter, labSonuc: labSonuc, bitir: bitir, ctx: ctx,
    triyajMasasi: triyajMasasi, kodBasla: kodBasla, sevkSor: sevkSor, konsultPanel: konsultPanel, anons: anons, saatCiz: saatCiz };
})();
