/* ==========================================================================
   SAHNELER CANLI · tanıtım sayfası (index.html, css/acadex-sahne-canli.css), 08.11.2026
   Fark: her satıra kaydırma ilerlemesi (--fq). Yöntemler: saat ibresi, zil, Leitner
   zıplaması, puan mührü, ampul. Sayfanın ana betiğinin değişkenlerini (--a/--b/--c/--f,
   kartların --x'i) yalnız okur; onlara yazmaz. Hareket azaltılınca hiçbiri kurulmaz.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document, NS = 'http://www.w3.org/2000/svg';
  if (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var KALEM = function (renk) { return '<svg class="fk-pen ' + (renk === 'k' ? 'k' : 'm') + '" viewBox="0 0 16 46" aria-hidden="true"><rect x="3" y="1" width="10" height="32" rx="2" fill="' + (renk === 'k' ? '#E8907E' : '#5B8CFF') + '" stroke="#0D1838" stroke-width="1.6"/><path d="M3 33 L13 33 L8 44 Z" fill="#F6D7B0" stroke="#0D1838" stroke-width="1.6" stroke-linejoin="round"/><path d="M6.5 40.5 L9.5 40.5 L8 44 Z" fill="#0D1838"/></svg>'; };

  function kur() {
    var hepsi = [];
    /* ---- 1. Fark ---- */
    var rows = D.querySelector('.ba-rows');
    if (rows) {
      var satir = [].slice.call(rows.querySelectorAll('.ba-row'));
      satir.forEach(function (r) {
        var once = r.querySelector('.ba-before'), sonra = r.querySelector('.ba-after'), ok = r.querySelector('.ba-arrow path'), disp = sonra && sonra.querySelector('.disp');
        if (ok) ok.setAttribute('pathLength', '1');
        if (once) once.insertAdjacentHTML('beforeend', KALEM('k'));
        if (sonra) { sonra.insertAdjacentHTML('beforeend', KALEM('m')); sonra.insertAdjacentHTML('beforeend', '<span class="fk-tik" aria-hidden="true">✓</span>'); }
        r.__dw = function () { if (disp) r.style.setProperty('--dw', Math.min(disp.scrollWidth, sonra.clientWidth) + 'px'); };
        r.__dw();
      });
      rows.classList.add('fk');
      W.addEventListener('resize', function () { satir.forEach(function (r) { r.__dw(); }); });
      hepsi.push(function (vh) {
        satir.forEach(function (r) {
          var t = r.getBoundingClientRect().top;
          r.style.setProperty('--fq', clamp((vh * 0.86 - t) / (vh * 0.42)).toFixed(3));
        });
      });
    }

    /* ---- 2. Yöntemler ---- */
    var mt = D.getElementById('yontemler');
    if (mt) {
      var saat = mt.querySelector('.nb-timer');
      if (saat) {
        var g = D.createElementNS(NS, 'g');
        g.innerHTML = '<g class="yc-ibre dk"><line x1="140" y1="150" x2="140" y2="64" stroke="#1A2A5C" stroke-width="5"/></g>' +
          '<g class="yc-ibre sn"><line x1="140" y1="166" x2="140" y2="46" stroke="#C9483B" stroke-width="1.8"/></g>' +
          '<circle cx="140" cy="150" r="5" fill="#C9483B"/>' +
          '<g class="yc-zil" fill="none" stroke="#C9483B" stroke-width="2.4" stroke-linecap="round"><path d="M96 26 C90 18 86 12 84 4"/><path d="M110 18 C108 10 106 6 106 0"/><path d="M184 26 C190 18 194 12 196 4"/><path d="M170 18 C172 10 174 6 174 0"/></g>';
        var merkez = saat.querySelector('circle[r="9"]');
        saat.insertBefore(g, merkez || null);
      }
      var fyOk = mt.querySelector('.fy-ok');
      if (fyOk) fyOk.insertAdjacentHTML('beforeend', '<svg class="yc-ampul" viewBox="0 0 30 38" aria-hidden="true"><path class="cam" d="M15 3 C8 3 4 8 4 13 C4 18 8 20 9 25 H21 C22 20 26 18 26 13 C26 8 22 3 15 3 Z"/><path class="dip" d="M10 29 H20 M11 33 H19"/><path class="isik" d="M15 -4 V0 M27 2 L24 5 M3 2 L6 5"/></svg>');
      var ar = mt.querySelector('.nb-ar');
      if (ar) ar.insertAdjacentHTML('afterbegin', '<span class="yc-puan" aria-hidden="true">2/3<small>tekrar: 1</small></span>');
      var kartlar = [].slice.call(mt.querySelectorAll('.lt-card')), sutun = [].slice.call(mt.querySelectorAll('.lt-col')), cal = false;
      hepsi.push(function () {
        if (!D.documentElement.querySelector('.js-mt')) return;
        var cs = getComputedStyle(mt), a = parseFloat(cs.getPropertyValue('--a')) || 0;
        if (saat) {
          var bitti = a >= 0.985;
          if (bitti && !cal) { cal = true; saat.classList.remove('yc-cal'); void saat.getBoundingClientRect(); saat.classList.add('yc-cal'); }
          else if (!bitti && cal) { cal = false; saat.classList.remove('yc-cal'); }
        }
        var gel = {};
        kartlar.forEach(function (c) {
          var x = parseFloat(c.style.getPropertyValue('--x')); if (isNaN(x)) return;
          var f = x - Math.floor(x), lift = f > 0.002 && f < 0.998 ? Math.sin(f * Math.PI) : 0;
          c.style.setProperty('--lift', lift.toFixed(3));
          c.classList.toggle('yc-ok', x >= 2.995);
          if (lift > 0.05) gel[Math.ceil(x)] = 1;
        });
        sutun.forEach(function (s, i) { s.classList.toggle('yc-gel', !!gel[i]); });
      });
    }

    if (!hepsi.length) return;
    var bekle = false;
    var tik = function () { bekle = false; var vh = W.innerHeight; hepsi.forEach(function (f) { f(vh); }); };
    var iste = function () { if (!bekle) { bekle = true; W.requestAnimationFrame(tik); } };
    W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', iste);
    tik();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
})();
