/* ==========================================================================
   DERDİNİ SEÇ · tanıtım sayfası (index.html #dert), 08.11.2026
   Dert kâğıdına basınca o derdin cevabı (defter sayfası) açılır; ötekiler gizlenir.
   Betik yoksa ilk cevap görünür kalır.
   ========================================================================== */
(function () {
  'use strict';
  function kur() {
    var el = document.querySelector('[data-drt]'); if (!el) return;
    var dugme = el.querySelectorAll('[data-drt-c]'), kart = el.querySelectorAll('[data-drt-k]');
    function sec(id, odak) {
      dugme.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-drt-c') === id ? 'true' : 'false'); });
      kart.forEach(function (k) {
        var on = k.getAttribute('data-drt-k') === id; k.hidden = !on;
        k.classList.remove('drt-gel'); if (on) { void k.offsetWidth; k.classList.add('drt-gel'); if (odak) k.focus({ preventScroll: true }); }
      });
    }
    dugme.forEach(function (b) { b.addEventListener('click', function () { sec(b.getAttribute('data-drt-c'), false); }); });
    sec(dugme[0].getAttribute('data-drt-c'), false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kur); else kur();
})();
