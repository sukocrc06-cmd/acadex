/* ==========================================================================
   ACADEX KIDS · tek sayfa yönlendirme (kids/assets/kids-yon.js), 10.11.2026
   Tek index.html içinde üç görünüm: tanıtım (varsayılan), #oyna (çocuk),
   #ogretmen (öğretmen paneli). Tanıtım içi bağlantılar (#nasil, #fiyat…) kaydırır.
   14.11.2026: #ev=KOD~öğrenci (evde devam kartı QR'ı) → oyna; #yonetim → kreş yönetici paneli;
   #giris → rol seçmeli giriş (Çocuk / Öğretmen / Kreş yöneticisi).
   15.11.2026: #teklif (ve eski #basvuru, #demo) tanıtım sayfasında kalır; kids-teklif.js teklif penceresini açar.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, simdi = null;
  function gorunum() { var h = (location.hash || '').replace(/^#\/?/, ''); return h === 'oyna' || /^ev=/.test(h) ? 'oyna' : h === 'ogretmen' ? 'ogretmen' : h === 'yonetim' ? 'yonetim' : h === 'giris' ? 'giris' : 'tanitim'; }
  /* giriş ekranı: kim giriyor? Çocuk (okul kodu + gizli resimler), öğretmen (okul kodu + PIN/şifre),
     kreş yöneticisi (okul kodu + yönetici şifresi). Kartın QR'ı ise doğrudan çocuğun resim adımını açar. */
  function girisCiz(k) {
    var C = W.KIDS_CIZ, s = function (f, a) { try { return C[f](a); } catch (e) { return ''; } };
    var rol = [['#oyna', s('avatar', 'kedi'), 'Çocuk', 'Okul kodu ve iki gizli resimle oyna', 'kgi-cocuk'],
      ['#ogretmen', s('simge', 'book'), 'Öğretmen', 'Okul kodu ve size özel PIN ya da okul şifresi', 'kgi-ogretmen'],
      ['#yonetim', s('simge', 'ev'), 'Kreş yöneticisi', 'Sınıflar, öğrenciler, öğretmenler ve kartlar', 'kgi-yonetici']];
    k.innerHTML = '<section class="kt-giris kgi"><div class="kgi-kart"><div class="kt-giris-bas"><span>' + s('acadia', { mood: 'mutlu' }) + '</span><div><small>Acadex Kids</small><h1>Giriş yap</h1></div></div>' +
      '<p class="kgi-alt">Kim giriyor?</p><div class="kgi-roller">' + rol.map(function (r, i) { return '<a class="kgi-rol ' + r[4] + '" href="' + r[0] + '"' + (i === 0 ? ' data-odak' : '') + '><span class="kgi-r">' + r[1] + '</span><b>' + r[2] + '</b><small>' + r[3] + '</small></a>'; }).join('') + '</div>' +
      '<p class="kgi-not">' + s('simge', 'yildiz') + '<span>Çocuğunuzun kartında QR var mı? Telefonun kamerasıyla okutun; doğrudan çocuğunuzun gizli resim ekranı açılır.</span></p>' +
      '<p class="kt-donus"><a href="#">← Tanıtım sayfası</a> · Kreşiniz kayıtlı değil mi? <a href="#teklif" data-teklif>Kreşim için teklif al</a></p></div></section>';
    var o = k.querySelector('[data-odak]'); if (o) try { o.focus({ preventScroll: true }); } catch (e) { }
  }
  function goster() {
    var g = gorunum(); if (g === simdi) return;
    if (simdi === 'oyna' && W.KIDS_APP) W.KIDS_APP.kapat();
    if (simdi === 'ogretmen' && W.KIDS_OGRETMEN) W.KIDS_OGRETMEN.kapat();
    if (simdi === 'yonetim' && W.KIDS_YONETICI) W.KIDS_YONETICI.kapat();
    if (W.KIDS_SES) W.KIDS_SES.sus();
    simdi = g;
    D.getElementById('kl-sayfa').hidden = g !== 'tanitim';
    D.getElementById('kids-app').hidden = g !== 'oyna';
    D.getElementById('kids-ogretmen').hidden = g !== 'ogretmen';
    var yk = D.getElementById('kids-yonetim'); if (yk) yk.hidden = g !== 'yonetim';
    var gk = D.getElementById('kids-giris'); if (gk) { gk.hidden = g !== 'giris'; if (g === 'giris') girisCiz(gk); else gk.innerHTML = ''; }
    D.body.className = g === 'tanitim' ? 'kl' : g === 'ogretmen' || g === 'yonetim' || g === 'giris' ? 'kl kt' : 'ka-govde';
    D.title = g === 'oyna' ? 'Acadex Kids · Oyna' : g === 'ogretmen' ? 'Acadex Kids · Öğretmen paneli' : g === 'yonetim' ? 'Acadex Kids · Kreş yönetimi' : g === 'giris' ? 'Acadex Kids · Giriş' : 'Acadex Kids · Kreş, anaokulu ve ilkokul için oyunlarla İngilizce';
    if (g === 'oyna') W.KIDS_APP.ac(); else if (g === 'ogretmen') W.KIDS_OGRETMEN.ac(); else if (g === 'yonetim' && W.KIDS_YONETICI) W.KIDS_YONETICI.ac();
    if (g !== 'tanitim') W.scrollTo(0, 0);
    else { var hedef = (location.hash || '').replace(/^#/, ''), el = hedef && D.getElementById(hedef); if (el) setTimeout(function () { el.scrollIntoView(); }, 60); else W.scrollTo(0, 0); }   /* gizliyken tarayıcı çapaya kaydıramaz */
    D.dispatchEvent(new CustomEvent('kids:gorunum', { detail: g }));
  }
  W.addEventListener('hashchange', goster);
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', goster); else goster();
  W.KIDS_YON = { goster: goster, gorunum: gorunum };
})(window);
