/* ==========================================================================
   ACADEX KIDS · test ekibi "Bildir" düğmesi (kids/assets/kids-test.js), 20.11.2026
   Acadex'teki Test Paneli düğmesinin (js/acadex-test.js) aynısı Kids'te de çıkar; kayıtlar
   yine acadex.com.tr/panel'e düşer (tp_items, test-panel deposu; yetki aynı: tp_members).

   Kimlik: test ekibi AYNI TARAYICIDA acadex.com.tr hesabına giriş yapmışsa Kids o oturumu
   (Supabase'in localStorage anahtarı) görür. Oturum yoksa — yani çocukların cihazlarında —
   HİÇBİR ŞEY yüklenmez: ne Supabase kütüphanesi ne test düğmesi. Oturum varsa kütüphane ve
   /js/acadex-test.js yüklenir; o dosya kişi ekipte değilse yine hiçbir şey çizmez.
   Kids sayfaları: ACADEX_TEST_SAYFA (sayfa listesi, o anki ekran, adres + konu/durak).
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, URL_ = 'https://yrcdvcsowblzmkpbmkut.supabase.co', ANAHTAR = 'sb_publishable_W_DZnHPY-I51nioiWOTJmw_FCnyFjxm';
  var LS = 'sb-yrcdvcsowblzmkpbmkut-auth-token';
  function oturumVar() {
    try {
      var v = W.localStorage.getItem(LS); if (!v) return false;
      var j = JSON.parse(v), s = j && (j.currentSession || j);
      return !!(s && (s.access_token || s.refresh_token) && s.user && s.user.email);
    } catch (e) { return false; }
  }
  if (!oturumVar()) return;

  var DURAK = { izle: 'Kids · İzle', sarki: 'Kids · Şarkı', soyle: 'Kids · Söyle', dokun: 'Kids · Oyunlar' };
  var GOR = { giris: 'Kids · Giriş', harita: 'Kids · Harita', sahnekur: 'Kids · Resim yap', sozluk: 'Kids · Kelimelerim', dolap: 'Kids · Dolabım', album: 'Kids · Albüm', daha: 'Kids · Daha fazlası' };
  var LISTE = ['Kids · Giriş', 'Kids · Harita', 'Kids · Konu penceresi', 'Kids · İzle', 'Kids · Şarkı', 'Kids · Oyunlar', 'Kids · Söyle', 'Kids · Kitaplık', 'Kids · Masal', 'Kids · Resim yap', 'Kids · Kelimelerim',
    'Kids · Dolabım', 'Kids · Albüm', 'Kids · Daha fazlası', 'Kids · Veli köşesi', 'Kids · Sesli cevap / komut', 'Kids · Genel'];
  function durum() { try { return W.KIDS_APP && W.KIDS_APP.durum ? W.KIDS_APP.durum() : null; } catch (e) { return null; } }
  /* o anki durak: konu başlığındaki ".ka-simdi" sırası */
  function durak(S) { var L = [].slice.call(D.querySelectorAll('.ka-duraklar > li')), i = L.findIndex(function (x) { return x.classList.contains('ka-simdi'); }); return S && S.duraklar && i >= 0 ? S.duraklar[i] : null; }
  function bul() {
    var app = D.getElementById('kids-app'), g = app ? app.dataset.gorunum || '' : '';
    var pen = D.querySelector('.ka-ort .ka-pen h2');
    if (pen && /Veli/.test(pen.textContent)) return 'Kids · Veli köşesi';
    if (D.querySelector('.kd-izin')) return 'Kids · Sesli cevap / komut';
    if (g === 'harita') return D.querySelector('.ka-ort') ? 'Kids · Konu penceresi' : 'Kids · Harita';
    if (g === 'kitap') return D.querySelector('.km-sayfa, [data-kmo]') ? 'Kids · Masal' : 'Kids · Kitaplık';
    if (g === 'konu') { var d = durak(durum()); return (d && DURAK[d.id]) || 'Kids · Oyunlar'; }
    return GOR[g] || 'Kids · Genel';
  }
  /* kayda düşen adres: sayfa + konu + durak + yaş grubu (testçi yazmasa da nerede olduğu belli olsun) */
  function adres() {
    var S = durum(), app = D.getElementById('kids-app'), p = ['kids/' + (location.hash || ''), app && app.dataset.gorunum ? 'ekran=' + app.dataset.gorunum : ''];
    if (S) {
      if (S.konu) p.push('konu=' + S.konu);
      var d = durak(S); if (d && d.id) p.push('durak=' + d.id);
      if (S.sinif && S.sinif.bant) p.push('yaş=' + S.sinif.bant);
    }
    return p.filter(Boolean).join(' · ');
  }
  W.ACADEX_TEST_SAYFA = { liste: LISTE, bul: bul, adres: adres };

  /* düğme Kids'te sol altta, alt çubuğun ve mikrofonun üstünde kalmasın */
  var st = D.createElement('style');
  st.textContent = '#axt .fab{left:max(12px,env(safe-area-inset-left,0px))!important;right:auto!important;bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;z-index:70!important}';
  D.head.appendChild(st);

  function yukle(src) { return new Promise(function (ok, no) { var s = D.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = no; D.head.appendChild(s); }); }
  setTimeout(function () {
    (W.supabase && W.supabase.createClient ? Promise.resolve() : yukle('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'))
      .then(function () { if (!W.supabaseClient) W.supabaseClient = W.supabase.createClient(URL_, ANAHTAR); return yukle('/js/acadex-test.js'); })
      .catch(function () { /* çevrimdışı ya da engelli: sessiz */ });
  }, 1500);
})(window);
