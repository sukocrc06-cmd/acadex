/* ==========================================================================
   ACADEX ENGLISH · kapı (ingilizce/assets/kapi.js), 05.11.2026
   İngilizce bölümü landing'den açılan ayrı bir yer; kendi giriş ya da kayıt
   ekranı yok. Yalnız oturumu açık ve erişimi olan Acadex hesapları görür:
     - oturum yoksa: kilit kartı, "Acadex hesabınla giriş yap" (../login.html)
     - oturum var ama kapalı betada izinsizse (acadexAccess.check): kilit kartı
     - Supabase yüklenemezse: kilitli kalır (açık kapı yok)
   Sayfa, kontrol bitene kadar <html class="kapi"> ile görünmez.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, H = D.documentElement;
  var YILDIZ = '<svg viewBox="-62 -62 124 124" aria-hidden="true"><path d="M0 -52 C7 -19 19 -7 52 0 C19 7 7 19 0 52 C-7 19 -19 7 -52 0 C-19 -7 -7 -19 0 -52 Z" fill="#FFD86B" stroke="#1A2A5C" stroke-width="4" stroke-linejoin="round"/><ellipse cx="-10" cy="-4" rx="6.5" ry="8" fill="#fff" stroke="#1A2A5C" stroke-width="2.5"/><circle cx="-9" cy="-2" r="3.6" fill="#1A2A5C"/><ellipse cx="10" cy="-4" rx="6.5" ry="8" fill="#fff" stroke="#1A2A5C" stroke-width="2.5"/><circle cx="11" cy="-2" r="3.6" fill="#1A2A5C"/><path d="M-6 13 Q0 9 6 13" fill="none" stroke="#1A2A5C" stroke-width="3" stroke-linecap="round"/></svg>';
  var kilitEl = null;
  /* supabase-config.js CDN olmadan hata verirse supabaseClient tanımsız kalır (TDZ); typeof bile fırlatır */
  function istemci() { try { return supabaseClient; } catch (e) { return null; } }
  function kilit(baslik, metin, giris) {
    H.classList.add('kapi');
    if (!kilitEl) { kilitEl = D.createElement('div'); kilitEl.id = 'kilit'; kilitEl.setAttribute('role', 'dialog'); kilitEl.setAttribute('aria-modal', 'true'); kilitEl.setAttribute('aria-labelledby', 'kilit-b'); D.body.appendChild(kilitEl); }
    kilitEl.innerHTML = '<div class="kagit"><span class="bant"></span>' + YILDIZ + '<h1 id="kilit-b"></h1><p></p><div class="dugmeler">' +
      (giris ? '<a class="btn ana" href="../login.html">Acadex hesabınla giriş yap</a>' : '') + '<a class="btn" href="../index.html">Ana sayfaya dön</a></div></div>';
    kilitEl.querySelector('h1').textContent = baslik; kilitEl.querySelector('p').textContent = metin;
    var a = kilitEl.querySelector('a'); if (a) a.focus({ preventScroll: true });
  }
  function ac() { if (kilitEl) { kilitEl.remove(); kilitEl = null; } H.classList.remove('kapi'); }
  var KAPALI = ['Bu bölüm hesabı olanlara açık', 'Acadex English şu an yalnızca açık bir Acadex hesabıyla görülebiliyor. Yeni kayıt alınmıyor; hesabın varsa giriş yapıp buraya dönebilirsin.'];

  async function denetle() {
    var sb = istemci();
    if (!sb) { kilit('Bağlantı kurulamadı', 'Hesabını doğrulayamadık. İnternet bağlantını kontrol edip sayfayı yenile.', false); return; }
    try {
      var r = await sb.auth.getSession(), u = r && r.data && r.data.session && r.data.session.user;
      if (!u) { kilit(KAPALI[0], KAPALI[1], true); return; }
      if (window.acadexAccess) {
        var e = await window.acadexAccess.check(u.id);
        if (!e.ok) { kilit('Hesabın henüz açılmadı', 'Acadex şu an geliştirme aşamasında ve yalnızca izin verilen hesaplar girebiliyor.', false); return; }
      }
      ac();
    } catch (x) { kilit('Bağlantı kurulamadı', 'Hesabını doğrulayamadık. Sayfayı yenilemeyi dene.', false); }
  }
  function basla() {
    if (D.body && !kilitEl && H.classList.contains('kapi')) { kilitEl = D.createElement('div'); kilitEl.id = 'kilit'; kilitEl.innerHTML = '<span class="bekle">defter açılıyor…</span>'; D.body.appendChild(kilitEl); }
    denetle();
    var sb = istemci(); if (sb) sb.auth.onAuthStateChange(function (olay) { if (olay === 'SIGNED_OUT') kilit(KAPALI[0], KAPALI[1], true); });
    /* başka sekmede çıkış yapıp geri tuşuyla dönülürse (bfcache) yeniden denetle */
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) denetle(); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', basla); else basla();
})();
