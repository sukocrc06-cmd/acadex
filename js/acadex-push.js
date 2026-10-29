/* ==========================================================================
   ACADEX TELEFON BİLDİRİMLERİ — istemci (js/acadex-push.js), 29.10.2026
   Web Push aboneliği: tarayıcıdan izin alır, push servisine abone olur ve
   aboneliği Supabase'e yazar (public.push_subscribe / support_push_subscribe).
   Bildirimi sunucu gönderir (supabase/functions/send-push), sw.js gösterir.

   window.AxPush:
     supported()     tarayıcı Web Push destekliyor mu
     needsInstall()  iPhone/iPad'de Safari sekmesi: önce "Ana Ekrana Ekle" gerekir
     current()       bu cihazın aboneliği (yoksa null)
     enable(save)    izin + abonelik; save(sub) aboneliği sunucuya yazar
     disable(remove) aboneliği kaldırır; remove(endpoint) sunucudan siler
   Panel: Ayarlar → Bildirimler'deki [data-push] kutusu kendiliğinden kurulur.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document, N = navigator;
  var cfg = function () {
    var url = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : W.SUPABASE_URL;
    var key = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : W.SUPABASE_ANON_KEY;
    return { url: url, key: key };
  };
  var sbc = function () { return typeof supabaseClient !== 'undefined' ? supabaseClient : (W.supabaseClient || null); };
  var rpc = function (fn, args) {
    var c = sbc(); if (!c) return Promise.reject(new Error('baglanti'));
    return c.rpc(fn, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; });
  };

  var ios = function () { return /iPad|iPhone|iPod/.test(N.userAgent) || (N.platform === 'MacIntel' && N.maxTouchPoints > 1); };
  var standalone = function () { return N.standalone === true || !!(W.matchMedia && W.matchMedia('(display-mode: standalone)').matches); };
  var supported = function () { return 'serviceWorker' in N && 'PushManager' in W && 'Notification' in W; };
  var needsInstall = function () { return ios() && !standalone(); };

  var b64ToBytes = function (s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a;
  };
  var keyP = null;
  var publicKey = function () {
    if (keyP) return keyP;
    var c = cfg(); if (!c.url) return Promise.reject(new Error('ayar'));
    var h = c.key ? { apikey: c.key, Authorization: 'Bearer ' + c.key } : {};
    keyP = fetch(c.url.replace(/\/$/, '') + '/functions/v1/send-push', { headers: h })
      .then(function (r) { if (!r.ok) throw new Error('servis ' + r.status); return r.json(); })
      .then(function (d) { if (!d || !d.publicKey) throw new Error('anahtar'); return d.publicKey; });
    keyP.catch(function () { keyP = null; });
    return keyP;
  };
  var regP = null;
  var registration = function () {
    if (!regP) regP = (W.__axSwReg || (W.__axSwReg = N.serviceWorker.register('/sw.js').then(function () { return N.serviceWorker.ready; })));
    return regP;
  };
  var current = function () {
    if (!supported()) return Promise.resolve(null);
    return registration().then(function (r) { return r.pushManager.getSubscription(); }).catch(function () { return null; });
  };
  var parts = function (sub) {
    var j = sub.toJSON ? sub.toJSON() : sub;
    return { endpoint: j.endpoint, p256dh: j.keys && j.keys.p256dh, auth: j.keys && j.keys.auth };
  };
  /* izin İSTEĞİ mutlaka bir dokunuşun içinde çağrılmalı (Safari şartı) */
  var enable = function (save) {
    if (!supported()) return Promise.reject(new Error('desteklenmiyor'));
    if (needsInstall()) return Promise.reject(new Error('ana-ekran'));
    var perm = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
    return Promise.resolve(perm).then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'engelli' : 'izin-yok');
      return Promise.all([registration(), publicKey()]);
    }).then(function (x) {
      var reg = x[0], key = b64ToBytes(x[1]);
      return reg.pushManager.getSubscription().then(function (old) {
        /* sunucu anahtarı değiştiyse eski abonelik geçersiz: yenile */
        if (old && old.options && old.options.applicationServerKey) {
          var a = new Uint8Array(old.options.applicationServerKey), same = a.length === key.length;
          for (var i = 0; same && i < a.length; i++) same = a[i] === key[i];
          if (same) return old;
          return old.unsubscribe().then(function () { return null; });
        }
        return old;
      }).then(function (sub) { return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); });
    }).then(function (sub) { return Promise.resolve(save(parts(sub))).then(function () { return sub; }); });
  };
  var disable = function (remove) {
    return current().then(function (sub) {
      if (!sub) return null;
      var ep = sub.endpoint;
      return Promise.resolve(remove ? remove(ep) : null).catch(function () {}).then(function () { return sub.unsubscribe(); });
    });
  };
  var saveMine = function (p) { return rpc('push_subscribe', { p_endpoint: p.endpoint, p_p256dh: p.p256dh, p_auth: p.auth, p_ua: (N.userAgent || '').slice(0, 200) }); };
  var removeMine = function (ep) { return rpc('push_unsubscribe', { p_endpoint: ep }); };

  W.AxPush = { supported: supported, needsInstall: needsInstall, ios: ios, standalone: standalone, current: current, enable: enable, disable: disable, publicKey: publicKey, rpc: rpc };

  /* ---------------- Ayarlar → Bildirimler kutusu ---------------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true" class="axpn-ic"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5v9h14v-9h-1"/></svg>';
  var mount = function (box) {
    if (box.__axp) return; box.__axp = 1;
    var busy = false, synced = {};
    var paint = function (state, note) {
      var h = '';
      if (state === 'yok') h = '<p class="axpn-st">Bu tarayıcı telefon bildirimini desteklemiyor. Android’de Chrome, iPhone’da Safari (ana ekrandan) kullanabilirsin.</p>';
      else if (state === 'ana-ekran') h = '<p class="axpn-st"><b>iPhone’da bildirim için Acadex’i ana ekrana ekle.</b> Apple, bildirimi yalnız ana ekrandan açılan sitelere izin veriyor.</p>' +
        '<ol class="axpn-steps"><li>Safari’de alttaki <b>Paylaş</b> düğmesine dokun ' + SHARE + '</li><li><b>Ana Ekrana Ekle</b>’yi seç</li><li>Ana ekrandaki <b>Acadex</b>’i aç, buraya gelip bildirimi aç</li></ol>';
      else if (state === 'engelli') h = '<p class="axpn-st"><b>Bildirimlere izin verilmemiş.</b> Adres çubuğundaki kilit simgesine dokun → <b>Site ayarları</b> → <b>Bildirimler: İzin ver</b>. Sonra bu sayfayı yenile.</p>';
      else if (state === 'servis') h = '<p class="axpn-st">Bildirim servisi şu an yanıt vermiyor. Biraz sonra tekrar dene.</p><button type="button" class="btn btn-line sm" data-axpn-on>Tekrar dene</button>';
      else if (state === 'acik') h = '<p class="axpn-st ok"><i class="axpn-dot"></i><span><b>Bu cihaza bildirim geliyor.</b> Acadex kapalıyken de beğeni, yorum ve hatırlatmalar telefonuna düşer.</span></p>' +
        '<div class="row"><button type="button" class="btn btn-blue sm" data-axpn-test>Deneme bildirimi gönder</button><button type="button" class="btn btn-line sm" data-axpn-off>Bu cihazda kapat</button></div>';
      else h = '<p class="axpn-st">Acadex kapalıyken de beğeni, yorum ve çalışma hatırlatmaları telefonuna gelsin.</p><div class="row"><button type="button" class="btn btn-dark sm" data-axpn-on>Bu cihaza bildirim aç</button></div>';
      box.innerHTML = h + (note ? '<p class="axpn-note" role="status">' + esc(note) + '</p>' : '');
      box.setAttribute('data-state', state);
    };
    var refresh = function (note) {
      if (!supported()) return paint(needsInstall() ? 'ana-ekran' : 'yok', note);
      if (needsInstall()) return paint('ana-ekran', note);
      if (Notification.permission === 'denied') return paint('engelli', note);
      current().then(function (sub) {
        if (!sub || Notification.permission !== 'granted') return paint('kapali', note);
        /* tarayıcıda abonelik var: sunucuda bu hesaba kayıtlı mı? değilse sessizce yaz */
        if (synced[sub.endpoint]) return paint('acik', note);
        return rpc('push_has', { p_endpoint: sub.endpoint }).then(function (has) {
          return has ? null : saveMine(parts(sub));
        }).then(function () { synced[sub.endpoint] = 1; }).then(function () { paint('acik', note); }, function () { paint('acik', note); });
      });
    };
    box.addEventListener('click', function (e) {
      if (busy) return;
      var on = e.target.closest('[data-axpn-on]'), off = e.target.closest('[data-axpn-off]'), test = e.target.closest('[data-axpn-test]');
      if (on) {
        busy = true; on.disabled = true; on.textContent = 'açılıyor…';
        enable(saveMine).then(function (sub) { busy = false; if (sub) synced[sub.endpoint] = 1; refresh('Bildirimler açıldı. Bir deneme göndermek ister misin?'); }, function (err) {
          busy = false; var m = String(err && err.message || err);
          if (m === 'engelli') paint('engelli'); else if (m === 'ana-ekran') paint('ana-ekran');
          else if (m === 'izin-yok') refresh('İzin verilmedi; istediğin zaman tekrar açabilirsin.');
          else if (/servis|anahtar|ayar/.test(m)) paint('servis');
          else refresh('Bildirim açılamadı: ' + m);
        });
      } else if (off) {
        busy = true; off.disabled = true;
        disable(removeMine).then(function () { busy = false; refresh('Bu cihaza artık bildirim gelmeyecek.'); }, function () { busy = false; refresh(); });
      } else if (test) {
        busy = true; test.disabled = true;
        rpc('push_test').then(function () { busy = false; refresh('Gönderildi; birkaç saniye içinde gelir.'); }, function () { busy = false; refresh('Deneme gönderilemedi.'); });
      }
    });
    refresh();
    /* ayarlar sekmesi açılınca (oturum o sırada hazırdır) yeniden bak */
    if (W.IntersectionObserver) {
      var lastR = Date.now();
      new IntersectionObserver(function (es) { if (es[0].isIntersecting && !busy && Date.now() - lastR > 1500) { lastR = Date.now(); refresh(); } }).observe(box);
    }
  };
  var scan = function () { Array.prototype.forEach.call(D.querySelectorAll('[data-push]'), mount); };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', scan); else scan();
  W.AxPush.mount = scan;
})();
