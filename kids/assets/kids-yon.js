/* ==========================================================================
   ACADEX KIDS · tek sayfa yönlendirme (kids/assets/kids-yon.js), 10.11.2026
   Tek index.html içinde üç görünüm: tanıtım (varsayılan), #oyna (çocuk),
   #ogretmen (öğretmen paneli). Tanıtım içi bağlantılar (#nasil, #fiyat…) kaydırır.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, simdi = null;
  function gorunum() { var h = (location.hash || '').replace(/^#\/?/, ''); return h === 'oyna' ? 'oyna' : h === 'ogretmen' ? 'ogretmen' : 'tanitim'; }
  function goster() {
    var g = gorunum(); if (g === simdi) return;
    if (simdi === 'oyna' && W.KIDS_APP) W.KIDS_APP.kapat();
    if (simdi === 'ogretmen' && W.KIDS_OGRETMEN) W.KIDS_OGRETMEN.kapat();
    if (W.KIDS_SES) W.KIDS_SES.sus();
    simdi = g;
    D.getElementById('kl-sayfa').hidden = g !== 'tanitim';
    D.getElementById('kids-app').hidden = g !== 'oyna';
    D.getElementById('kids-ogretmen').hidden = g !== 'ogretmen';
    D.body.className = g === 'tanitim' ? 'kl' : g === 'ogretmen' ? 'kl kt' : 'ka-govde';
    D.title = g === 'oyna' ? 'Acadex Kids · Oyna' : g === 'ogretmen' ? 'Acadex Kids · Öğretmen paneli' : 'Acadex Kids · Kreş, anaokulu ve ilkokul için oyunlarla İngilizce';
    if (g === 'oyna') W.KIDS_APP.ac(); else if (g === 'ogretmen') W.KIDS_OGRETMEN.ac();
    if (g !== 'tanitim') W.scrollTo(0, 0);
    else { var hedef = (location.hash || '').replace(/^#/, ''), el = hedef && D.getElementById(hedef); if (el) setTimeout(function () { el.scrollIntoView(); }, 60); else W.scrollTo(0, 0); }   /* gizliyken tarayıcı çapaya kaydıramaz */
    D.dispatchEvent(new CustomEvent('kids:gorunum', { detail: g }));
  }
  W.addEventListener('hashchange', goster);
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', goster); else goster();
  W.KIDS_YON = { goster: goster, gorunum: gorunum };
})(window);
