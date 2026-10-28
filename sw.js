/* Acadex bildirim servis calisani (25.10.2026, test raporu R7).
   Android Chrome'da sayfa icinden new Notification() calismiyor ("Illegal
   constructor"); bildirim yalnizca servis calisani uzerinden gosterilebiliyor.
   Bu dosya yalnizca bunu yapar: onbellek / fetch yonetimi YOKTUR.
   Bildirime dokununca acik Acadex sekmesi one gelir ya da planlayici acilir.

   29.10.2026 — telefon bildirimleri (Web Push): "push" olayi sunucudan gelen
   bildirimi gosterir (supabase/functions/send-push). Veri: {title, body, url,
   tag, kind, n}. Dokununca bildirimdeki adres acilir: acik bir Acadex penceresi
   varsa o pencere oraya gider, yoksa yeni pencere acilir. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  var title = String(d.title || 'Acadex').slice(0, 120);
  var opts = {
    body: String(d.body || '').slice(0, 300),
    icon: '/assets/pwa/icon-192.png',
    badge: '/assets/pwa/badge-96.png',
    tag: d.tag || d.kind || 'acadex',
    renotify: d.kind === 'like' || d.kind === 'comment' || d.kind === 'support',
    data: { url: d.url || '/dashboard.html', kind: d.kind || '' },
    lang: 'tr'
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

/* yalniz kendi sitemizin adresleri (bildirim verisi disaridan gelse bile) */
function axSameOrigin(u) {
  try { var x = new URL(u, self.location.origin); return x.origin === self.location.origin ? x.href : null; } catch (e) { return null; }
}

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = axSameOrigin((e.notification.data && e.notification.data.url) || 'dashboard.html#planner') || self.location.origin + '/dashboard.html';
  var want = new URL(url), wantPage = want.pathname.replace(/\/index\.html$/, '/');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    /* ayni sayfa acik: one getir, gerekiyorsa adrese git */
    for (var i = 0; i < list.length; i++) {
      var c = list[i], p;
      try { p = new URL(c.url).pathname.replace(/\/index\.html$/, '/'); } catch (x) { continue; }
      if (p === wantPage && 'focus' in c) {
        return (c.url !== url && c.navigate ? c.navigate(url).catch(function () { return c; }) : Promise.resolve(c)).then(function (w) { return (w || c).focus(); });
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
