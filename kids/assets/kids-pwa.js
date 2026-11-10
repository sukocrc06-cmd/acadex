/* ==========================================================================
   ACADEX KIDS · ana ekrana ekle (kids/assets/kids-pwa.js), 10.11.2026
   acadex.com.tr/kids uygulama gibi kurulur (kids/manifest.webmanifest) ve
   kids/sw.js sayfayı önbelleğe alır: internet kesilince de oyunlar açılır,
   ilerleme bağlantı gelince gönderilir (kids-bulut.js). Yalnız /kids/ altında,
   https ya da localhost'ta çalışır; tasarım klasöründe (file://) hiçbir şey yapmaz.
   W.KIDS_PWA.durum() → 'kurulu' | 'kur' | 'ios' | 'yok' ; kur() → Promise<bool>
   ========================================================================== */
(function (W) {
  'use strict';
  var istem = null, N = W.navigator;
  var uygun = /^https:$|^http:$/.test(location.protocol) && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) && /^\/kids(\/|$)/.test(location.pathname);
  /* her açılışta yeni sürümü sor; yeni sw devreye girince sayfayı bir kez yenile (eski ses/sayfa takılı kalmasın) */
  if (uygun && N.serviceWorker) W.addEventListener('load', function () {
    var vardi = !!N.serviceWorker.controller;
    N.serviceWorker.register('/kids/sw.js', { scope: '/kids/' }).then(function (r) { try { r.update(); } catch (e) { } }).catch(function () { });
    N.serviceWorker.addEventListener('controllerchange', function () {
      if (!vardi) return; try { if (sessionStorage.getItem('kids.swYenile')) return; sessionStorage.setItem('kids.swYenile', '1'); } catch (e) { return; }
      location.reload();
    });
  });
  W.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); istem = e; });
  W.addEventListener('appinstalled', function () { istem = null; });
  function kurulu() { try { return W.matchMedia('(display-mode: standalone)').matches || N.standalone === true; } catch (e) { return false; } }
  W.KIDS_PWA = {
    durum: function () {
      if (kurulu()) return 'kurulu';
      if (istem) return 'kur';
      if (uygun && /iphone|ipad|ipod/i.test(N.userAgent) && !/crios|fxios/i.test(N.userAgent)) return 'ios';
      return 'yok';
    },
    kur: function () {
      if (!istem) return Promise.resolve(false);
      var e = istem; istem = null; e.prompt();
      return e.userChoice.then(function (c) { return c && c.outcome === 'accepted'; }, function () { return false; });
    }
  };
})(window);
