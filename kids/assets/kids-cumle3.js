/* ==========================================================================
   ACADEX KIDS · CÜMLE GALAKSİSİ: CANLI UZAY, ROKET GARAJI, METEOR AVI VERİSİ
   (kids/assets/kids-cumle3.js), 27.11.2026. kids-cumle.js bunları çalışırken okur.
     gok(tohum)          haritanın canlı gökyüzü: göz kırpan yıldızlar, kayan yıldızlar, nebula
     buz(kirik)          kilitli gezegenin buz kabuğu; kirik=true → parçalar dağılır (kilit açıldı)
     roket(cfg)          garajda seçilen renk / alev / çıkartmayla roket SVG'si
     GARAJ               { renk, alev, cikartma }: [id, ad, ..., eşik yıldız]
     toplamYildiz(il)    garaj eşikleri için toplam: durak yıldızları (kural hariç) + meteor yıldızları
     acikMi(il, tur, id) o parça açık mı · secili(il) seçili, açık parçalar
   Kayıt: il.cumleRoket = { renk, alev, cikartma } · il.cumleMeteor[tema] = en iyi yıldız ·
          il.cumleGordu = [açılışı oynatılmış gezegen kimlikleri]
   ========================================================================== */
(function (W) {
  'use strict';
  var M = '#23304D';

  /* ---------------- canlı gökyüzü ---------------- */
  function rng(t) { var s = 0; for (var i = 0; i < String(t).length; i++) s = (s * 31 + String(t).charCodeAt(i)) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function gok(tohum) {
    var r = rng(tohum || 'galaksi'), y = '';
    for (var i = 0; i < 46; i++) {
      var b = r() < 0.18 ? 3 : r() < 0.5 ? 2 : 1.2;
      y += '<i style="left:' + (r() * 100).toFixed(1) + '%;top:' + (r() * 100).toFixed(1) + '%;--b:' + b + 'px;--g:' + (r() * 4).toFixed(2) + 's;--s:' + (2 + r() * 3).toFixed(2) + 's"></i>';
    }
    var kay = [0, 1, 2].map(function (k) { return '<b class="kc3-kayan" style="--k:' + k + ';left:' + (20 + k * 27 + r() * 10).toFixed(0) + '%;top:' + (6 + r() * 26).toFixed(0) + '%"></b>'; }).join('');
    return '<div class="kc3-gok" aria-hidden="true"><span class="kc3-neb kc3-neb1"></span><span class="kc3-neb kc3-neb2"></span><span class="kc3-neb kc3-neb3"></span>' +
      '<span class="kc3-toz"></span><span class="kc3-yildizlar">' + y + '</span>' + kay + '</div>';
  }

  /* ---------------- buz kabuğu ---------------- */
  var PARCA = [
    ['M60 70 L86 52 L100 74 L78 92 Z', -60, -50, -40], ['M100 74 L120 46 L144 66 L122 96 Z', 50, -60, 35], ['M78 92 L100 74 L122 96 L104 122 Z', -20, 60, -25],
    ['M122 96 L144 66 L158 100 L140 130 Z', 70, 30, 50], ['M52 110 L78 92 L104 122 L70 140 Z', -70, 40, -55], ['M104 122 L140 130 L118 154 L86 150 Z', 20, 80, 30],
    ['M86 52 L104 40 L120 46 L100 74 Z', -10, -80, -20]
  ];
  function buz(kirik) {
    return '<svg class="kc3-buz' + (kirik ? ' kc3-kirik' : '') + '" viewBox="0 0 200 170" aria-hidden="true" focusable="false">' +
      '<circle cx="100" cy="108" r="66" fill="rgba(200,232,255,.22)"/>' +
      PARCA.map(function (p, j) { return '<path class="kc3-p" style="--dx:' + p[1] + 'px;--dy:' + p[2] + 'px;--dr:' + p[3] + 'deg;--j:' + j + '" d="' + p[0] + '" fill="rgba(214,238,255,.55)" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>'; }).join('') +
      '<path class="kc3-parilti" d="M70 64 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z M138 120 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3z" fill="#fff"/></svg>';
  }

  /* ---------------- roket garajı ---------------- */
  var GARAJ = {
    renk: [['klasik', 'Klasik', '#FFFFFF', '#FF6B5B', 0], ['gok', 'Gök mavisi', '#BFE3FF', '#2F80ED', 4], ['nane', 'Nane', '#C8F5DE', '#1FA463', 9], ['lavanta', 'Lavanta', '#E5DBFF', '#8A5CF6', 15],
      ['gunes', 'Güneş', '#FFF1B8', '#F59E0B', 22], ['pembe', 'Pembe', '#FFD6E8', '#E5488C', 30], ['gece', 'Gece', '#3E4F8F', '#FFD23F', 42], ['altin', 'Altın', '#FFE08A', '#B7791F', 60]],
    alev: [['turuncu', 'Turuncu', '#FFB020', '#FFF3B0', 0], ['mavi', 'Mavi', '#4FC3FF', '#E0F7FF', 6], ['yesil', 'Yeşil', '#3DDC84', '#E2FFE9', 14], ['mor', 'Mor', '#B57BFF', '#F1E6FF', 24], ['gokkusagi', 'Gökkuşağı', 'url(#kc3-gk)', '#FFFFFF', 48]],
    cikartma: [['yok', 'Yok', '', 0], ['yildiz', 'Yıldız', 'M0 -6 l1.8 3.8 4.2 .6 -3 3 .7 4.2 -3.7 -2 -3.7 2 .7 -4.2 -3 -3 4.2 -.6z', 2], ['kalp', 'Kalp', 'M0 5 C-7 0 -6 -6 -2.5 -6 C-1 -6 0 -5 0 -4 C0 -5 1 -6 2.5 -6 C6 -6 7 0 0 5z', 8],
      ['simsek', 'Şimşek', 'M1.5 -7 L-4 1 H0 L-1.5 7 L4 -1 H0z', 12], ['ay', 'Ay', 'M2 -6 A6.5 6.5 0 1 0 2 6 A5 5 0 1 1 2 -6z', 20], ['cicek', 'Çiçek', 'M0 -6 a2.6 2.6 0 0 1 0 5 a2.6 2.6 0 0 1 5 0 a2.6 2.6 0 0 1 -5 0 a2.6 2.6 0 0 1 0 5 a2.6 2.6 0 0 1 -5 0 a2.6 2.6 0 0 1 5 0z', 34],
      ['tac', 'Taç', 'M-6 4 L-6 -3 L-3 0 L0 -6 L3 0 L6 -3 L6 4z', 52]]
  };
  function bul(tur, id) { return GARAJ[tur].filter(function (x) { return x[0] === id; })[0] || GARAJ[tur][0]; }
  function esik(x) { return x[x.length - 1]; }
  function toplamYildiz(il) {
    var t = 0, d = il && il.cumleD || {}, m = il && il.cumleMeteor || {};
    Object.keys(d).forEach(function (id) { Object.keys(d[id] || {}).forEach(function (k) { if (k !== 'kural') t += Math.max(0, Math.min(3, +d[id][k] || 0)); }); });
    Object.keys(m).forEach(function (id) { t += Math.max(0, Math.min(3, +m[id] || 0)); });
    return t;
  }
  function acikMi(il, tur, id) { return toplamYildiz(il) >= esik(bul(tur, id)); }
  function secili(il) {
    var s = (il && il.cumleRoket) || {}, o = {};
    ['renk', 'alev', 'cikartma'].forEach(function (k) { var x = bul(k, s[k]); o[k] = acikMi(il, k, x[0]) ? x[0] : GARAJ[k][0][0]; });
    return o;
  }
  var uid = 0;
  function roket(cfg) {
    cfg = cfg || {}; var r = bul('renk', cfg.renk), a = bul('alev', cfg.alev), c = bul('cikartma', cfg.cikartma), n = ++uid;
    var gk = a[0] === 'gokkusagi' ? '<defs><linearGradient id="kc3-gk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5B5B"/><stop offset=".35" stop-color="#FFD23F"/><stop offset=".7" stop-color="#3DDC84"/><stop offset="1" stop-color="#4FC3FF"/></linearGradient></defs>' : '';
    var alevRenk = a[0] === 'gokkusagi' ? 'url(#kc3-gk)' : a[2];
    return '<svg viewBox="0 0 40 60" aria-hidden="true" focusable="false" data-roket="' + n + '">' + gk +
      '<path class="kc2-alev" d="M14 34q6 24 12 0" fill="' + alevRenk + '" stroke="' + M + '" stroke-width="2"/><path class="kc2-alev kc3-alev-i" d="M17 35q3 12 6 0" fill="' + a[3] + '"/>' +
      '<path d="M20 3c8 6 11 16 9 30H11C9 19 12 9 20 3z" fill="' + r[2] + '" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<circle cx="20" cy="17" r="5" fill="#7FC4FF" stroke="' + M + '" stroke-width="2.2"/><path d="M17.5 15.5a3 3 0 0 1 3-2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M11 26l-7 9 7 2M29 26l7 9-7 2" fill="' + r[3] + '" stroke="' + M + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M15 33h10" stroke="' + M + '" stroke-width="2.2" stroke-linecap="round"/>' +
      (c[2] ? '<path transform="translate(20 27) scale(.62)" d="' + c[2] + '" fill="' + (r[0] === 'gece' ? '#FFD23F' : r[3]) + '" stroke="' + M + '" stroke-width="1.6" stroke-linejoin="round"/>' : '') + '</svg>';
  }

  W.KIDS_CUMLE3 = { gok: gok, buz: buz, roket: roket, GARAJ: GARAJ, toplamYildiz: toplamYildiz, acikMi: acikMi, secili: secili, esik: esik, bul: bul };
})(window);
