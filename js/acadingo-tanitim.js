/* ==========================================================================
   ACADINGO · tanıtım sayfası sahnesi (index.html #acadingo), 07.11.2026
   Sahne sabitlenir; kaydırma ilerlemesi (--p) gökyüzünü, güneşi, yolu ve Acadia'yı yürütür.
   Beş durak (data-a 0–4): her biri bir panel. Saat düğmeleri o durağa kaydırır.
   Hareket azaltılınca CSS beş durağı alt alta gösterir; bu betik yalnız etiketleri günceller.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document;
  function kur() {
    var el = D.querySelector('[data-acg]'); if (!el) return;
    var track = el.querySelector('.acg-track'), kartlar = el.querySelectorAll('.acg-kart'), saat = el.querySelectorAll('.acg-saat li'),
      duraklar = el.querySelectorAll('.acg-yol .durak'), yol = el.querySelector('.acg-yol .iz'), acadia = el.querySelector('.acg-yol .acadia-y'),
      sakin = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches, N = kartlar.length, uzun = yol && yol.getTotalLength ? yol.getTotalLength() : 0, son = -1, sonA = -1;
    /* durakları yol üstüne yerleştir: durak j, ilerlemenin (j+.5)/N noktasında */
    if (uzun) duraklar.forEach(function (d, j) { var q = yol.getPointAtLength(uzun * (j + .5) / N); d.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ')'); });
    /* yıldızlar (gece durağı) */
    var yz = el.querySelector('.acg-yildiz');
    if (yz && !yz.children.length) for (var i = 0; i < 26; i++) { var s = D.createElement('i'); s.style.left = ((i * 37) % 100) + '%'; s.style.top = ((i * 53) % 60) + '%'; s.style.animationDelay = (-(i % 7) * .4) + 's'; yz.appendChild(s); }
    function ciz(a) {
      if (a === sonA) return; sonA = a; el.dataset.a = a;
      kartlar.forEach(function (k, j) { k.classList.toggle('on', j === a); k.classList.toggle('gecti', j < a); k.setAttribute('aria-hidden', j === a ? 'false' : 'true'); });
      saat.forEach(function (li, j) { li.classList.toggle('on', j === a); li.classList.toggle('gecti', j < a); var b = li.querySelector('button'); if (b) b.setAttribute('aria-current', j === a ? 'step' : 'false'); });
      duraklar.forEach(function (d, j) { d.classList.toggle('on', j === a); d.classList.toggle('gecti', j < a); });
    }
    function tik() {
      if (sakin) return;
      var r = track.getBoundingClientRect(), boy = track.offsetHeight - W.innerHeight, p = Math.min(1, Math.max(0, -r.top / Math.max(1, boy)));
      if (Math.abs(p - son) < .0005) return; son = p;
      el.style.setProperty('--p', p.toFixed(4));
      if (uzun && acadia) { var q = yol.getPointAtLength(uzun * p); acadia.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ' ' + (q.y - 30).toFixed(1) + ')'); }
      ciz(Math.min(N - 1, Math.floor(p * N)));
    }
    var bekle = false, iste = function () { if (!bekle) { bekle = true; W.requestAnimationFrame(function () { bekle = false; tik(); }); } };
    W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', iste);
    saat.forEach(function (li, j) {
      var b = li.querySelector('button'); if (!b) return;
      b.addEventListener('click', function () {
        if (sakin) { kartlar[j].scrollIntoView({ block: 'center' }); return; }
        var top = track.getBoundingClientRect().top + W.scrollY, boy = track.offsetHeight - W.innerHeight;
        W.scrollTo({ top: top + boy * (j + .5) / N, behavior: 'smooth' });
      });
    });
    ciz(0); tik();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
})();
