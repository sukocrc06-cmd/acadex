/* ==========================================================================
   ACADEX KIDS · "Oyun dünyana gidiyorsun!" uçuşu (kids/assets/kids-ucus.js), 15.11.2026
   Çocuk giriş yapınca (şifreyle ya da "Kim oynuyor?"dan) renkli bir evrenden roketle uçar:
   rokettin penceresinde kendi yüzü (hayvan + renk), yanında Acadia, yanından adalar ve
   yıldızlar akar; bulutların arasından haritaya iner. Yaklaşık 5,2 sn, yumuşak geçişlerle; aynı gün
   aynı çocuk ikinci kez girerse 2,2 sn'lik kısa hâli. Sonda harita 1 sn'de yavaşça belirir.
   Dokununca ya da bir tuşa basınca atlanır. Sessizdir. Hareketi azalt açıksa yalnız yumuşak bir solma (1,2 sn).
   KIDS_UCUS.oynat({ad, hayvan, renk, anahtar}) → bitince çözülen Promise.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function bugun() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  /* aynı gün aynı çocuk ikinci kez mi giriyor? (yalnız bu cihazda; ad tutulmaz, anahtar tutulur) */
  function kisaMi(anahtar) {
    var k = 'kids.ucus', m = {};
    try { m = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { m = {}; }
    var g = bugun(), kisa = m[anahtar] === g;
    Object.keys(m).forEach(function (a) { if (m[a] !== g) delete m[a]; });
    m[anahtar] = g; try { localStorage.setItem(k, JSON.stringify(m)); } catch (e) { }
    return kisa;
  }
  function ilkAd(ad) { return String(ad || '').trim().split(/\s+/)[0].replace(/[.,]+$/, ''); }
  /* özgün roket çizimi; pencere (cx 60, cy 78) çocuğun yüzü için boş bırakılır */
  function roket() {
    var M = '#23304D';
    return '<svg class="ku-roket-c" viewBox="0 0 120 200" aria-hidden="true">' +
      '<g class="ku-alev"><path d="M44 160 q16 48 16 40 q0 8 16 -40 z" fill="#FFB020"/><path d="M50 160 q10 30 10 26 q0 4 10 -26 z" fill="#FFF3B0"/></g>' +
      '<path d="M34 120 l-22 36 l26 -6 z M86 120 l22 36 l-26 -6 z" fill="#E5484D" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M60 6 q34 30 30 120 q-2 26 -10 36 h-40 q-8 -10 -10 -36 q-4 -90 30 -120 z" fill="#FFFFFF" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M60 6 q18 16 25 44 h-50 q7 -28 25 -44 z" fill="#E5484D" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M40 162 h40 l-4 10 h-32 z" fill="#8E7CF0" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M60 112 v40" stroke="#4AA8FF" stroke-width="6" stroke-linecap="round"/>' +
      '<circle cx="60" cy="78" r="25" fill="#CDEBFF" stroke="' + M + '" stroke-width="4"/></svg>';
  }
  function sahne(o, kisa) {
    var yildiz = '', ada = '', bulut = '', n = kisa ? 26 : 54;
    for (var i = 0; i < n; i++) {
      var a = (i * 137.5) % 360, t = (1.3 + (i % 5) * 0.3).toFixed(2), d = (-(i % 9) * 0.11).toFixed(2), c = ['#FFFFFF', '#FFD23F', '#A5DBFF', '#FFB3D1', '#B8F2C8'][i % 5];
      yildiz += '<i style="--a:' + a.toFixed(1) + 'deg;--t:' + t + 's;--d:' + d + 's;--c:' + c + '"></i>';
    }
    if (!kisa && V && V.KONU) {
      V.KONU.slice(0, 6).forEach(function (k, i) {
        var a = [210, 330, 30, 150, 260, 90][i];
        ada += '<span class="ku-ada" style="--a:' + a + 'deg;--d:' + (0.25 + i * 0.22).toFixed(2) + 's">' + (W.KIDS_UZAY ? W.KIDS_UZAY.gezegen(k.renk, k.simge, false, 0, i) : C.ada(k.renk, k.simge, false)) + '</span>';
      });
    }
    for (var b = 0; b < 7; b++) bulut += '<span class="ku-bulut" style="--a:' + (b * 51) + 'deg;--d:' + (b * 0.03).toFixed(2) + 's">' + C.bulut() + '</span>';
    var ad = ilkAd(o.ad);
    return '<div class="ku-evren" aria-hidden="true"><span class="ku-nebula"></span><span class="ku-gokkusagi"></span><span class="ku-yildizlar">' + yildiz + '</span>' + ada + '</div>' +
      (SAKIN ? '' : '<div class="ku-roket" aria-hidden="true">' + roket() + '<span class="ku-yuz">' + C.avatar(o.hayvan, o.renk) + '</span></div><span class="ku-acd" aria-hidden="true">' + C.acadia({ mood: 'kutlama' }) + '</span>') +
      (SAKIN ? '<span class="ku-yuz-b" aria-hidden="true">' + C.avatar(o.hayvan, o.renk) + '</span>' : '') +
      '<p class="ku-yazi" role="status"><span>Oyun dünyana gidiyorsun' + (ad ? ', <b>' + esc(ad) + '</b>' : '') + '!</span></p>' +
      '<div class="ku-bulutlar" aria-hidden="true">' + bulut + '</div>';
  }
  function oynat(o) {
    o = o || {};
    return new Promise(function (bitti) {
      if (!C || !D.body) return bitti();
      var kisa = SAKIN ? false : kisaMi(o.anahtar || ('?' + (o.ad || ''))), sure = SAKIN ? 1200 : kisa ? 2200 : 5200;   /* 15.11.2026: yumuşak geçiş (önce 3,2 / 1,1 sn) */
      var k = D.createElement('div');
      k.className = 'ku' + (kisa ? ' ku-kisa' : '') + (SAKIN ? ' ku-sakin' : '');
      k.style.setProperty('--sure', sure + 'ms');
      k.innerHTML = sahne(o, kisa);
      D.body.appendChild(k);
      var bitir = function (hizli) {
        if (!k.isConnected || k.dataset.bitiyor) return; k.dataset.bitiyor = '1';
        D.removeEventListener('keydown', tus, true); clearTimeout(z);
        k.classList.add('ku-son');
        setTimeout(function () { k.remove(); bitti(); }, hizli ? 450 : 1000);
      };
      var tus = function () { bitir(true); };
      var z = setTimeout(function () { bitir(false); }, sure);
      k.addEventListener('pointerdown', function () { bitir(true); });
      D.addEventListener('keydown', tus, true);
    });
  }
  W.KIDS_UCUS = { oynat: oynat, kisaMi: kisaMi, ilkAd: ilkAd };
})(window);
