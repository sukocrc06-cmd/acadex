/* Acadex bildirim servis calisani (25.10.2026, test raporu R7).
   Android Chrome'da sayfa icinden new Notification() calismiyor ("Illegal
   constructor"); bildirim yalnizca servis calisani uzerinden gosterilebiliyor.
   Bu dosya yalnizca bunu yapar: onbellek / fetch yonetimi YOKTUR.
   Bildirime dokununca acik Acadex sekmesi one gelir ya da planlayici acilir. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || 'dashboard.html#planner';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf('dashboard.html') > -1 && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
