/* ==========================================================================
   ACADEX KIDS · çevrimdışı önbellek (kids/sw.js), 10.11.2026
   Kapsam yalnız /kids/. Sayfa tek dosya (kids/index.html: stil, betik, yazı tipi
   içinde), bu yüzden önbellekte o ve simgeler yeter. Sayfa isteği önce internetten
   denenir (yeni sürüm hemen gelsin), 4 sn'de yanıt yoksa önbellekten açılır.
   Supabase istekleri (başka alan adı) hiç önbelleğe alınmaz. Ses dosyaları (kids/ses/*.mp3)
   ve liste.json her seferinde önce internetten alınır, internet yoksa önbellekteki çalar.
   Yeni sürüm yayınlarken SURUM'u değiştirmek eski önbelleği temizler. Ses değişince
   SURUM'a gerek yok: kids-ses.js adrese sesin kimliğini (?v=) ekler.
   ========================================================================== */
'use strict';
const SURUM = 'acadex-kids-2026-11-12a';
const DOSYALAR = ['/kids/', '/kids/manifest.webmanifest', '/kids/assets/ikon-192.png', '/kids/assets/ikon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('acadex-kids-') && k !== SURUM).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || !u.pathname.startsWith('/kids/')) return;
  /* ses listesi ve ses dosyaları: her zaman önce internetten (ses değişince eskisi çalmasın), internet yoksa önbellekten */
  if (u.pathname === '/kids/ses/liste.json' || u.pathname.startsWith('/kids/ses/')) {
    e.respondWith(fetch(r).then((y) => { if (y.ok) { const k = y.clone(); caches.open(SURUM).then((c) => c.put(r, k)); } return y; }, () => caches.match(r).then((c) => c || Response.error())));
    return;
  }
  if (r.mode === 'navigate' || u.pathname === '/kids/' || u.pathname === '/kids/index.html') {
    e.respondWith(new Promise((coz) => {
      let bitti = false;
      const yedek = () => caches.match('/kids/').then((c) => { if (!bitti && c) { bitti = true; coz(c); } });
      const sure = setTimeout(yedek, 4000);
      fetch(r).then((y) => {
        clearTimeout(sure);
        if (y.ok) { const kopya = y.clone(); caches.open(SURUM).then((c) => c.put('/kids/', kopya)); }
        if (!bitti) { bitti = true; coz(y); }
      }, () => { clearTimeout(sure); caches.match('/kids/').then((c) => { if (!bitti) { bitti = true; coz(c || Response.error()); } }); });
    }));
    return;
  }
  e.respondWith(caches.match(r).then((c) => c || fetch(r).then((y) => { if (y.ok) { const k = y.clone(); caches.open(SURUM).then((ca) => ca.put(r, k)); } return y; })));
});
