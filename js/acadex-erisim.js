/* ==========================================================================
   ACADEX ERİŞİM (js/acadex-erisim.js) — kapalı beta, 24.10.2026
   site_settings.registration_freeze açıkken:
     - register.html: kayıt formu ve Google butonu donar, "geliştirme aşamasında" etiketi
     - login.html: Google butonunda "yalnızca izinli hesaplar" etiketi; izinsiz/yeni hesaba mesaj
     - dashboard.html: izinsiz hesap oturumdan çıkarılır
   Asıl kilit veritabanında (supabase/migrations/20261024_kapali_beta_erisim.sql):
   yeni auth kullanıcısı tetikleyicide reddedilir, profiles.access_allowed yöneticiye ait.
   Sütun henüz yoksa (SQL çalışmadıysa) bu dosya kimseyi kilitlemez.
   ========================================================================== */
(function () {
  var DEF = { enabled: false, message: '' };
  var MSG = 'Acadex şu an geliştirme aşamasında. Yeni kayıtlar kısa bir süreliğine kapalı; yalnızca davet edilen hesaplar girebilir.';
  var fp = null;
  function freeze() {
    if (fp) return fp;
    fp = (async function () {
      try {
        var r = await supabaseClient.from('site_settings').select('value').eq('key', 'registration_freeze').maybeSingle();
        return (r && r.data && r.data.value) || DEF;
      } catch (e) { return DEF; }
    })();
    return fp;
  }
  async function check(uid) {
    var f = await freeze();
    if (!f.enabled || !uid) return { ok: true, f: f };
    try {
      var r = await supabaseClient.from('profiles').select('is_admin, access_allowed').eq('id', uid).single();
      if (r.error || !r.data) return { ok: true, f: f };          // sütun yok / okunamadı: kilitleme
      return { ok: !!r.data.is_admin || r.data.access_allowed !== false, f: f };
    } catch (e) { return { ok: true, f: f }; }
  }
  window.acadexAccess = { freeze: freeze, check: check, message: MSG };

  var CSS = '' +
    '.ax-dev{position:relative;display:flex;gap:12px;align-items:flex-start;margin:0 0 16px;padding:14px 16px 14px 14px;background:#FFF8E6;border:1.5px solid #1A2A5C;border-radius:14px;box-shadow:3px 3px 0 #1A2A5C;color:#1A2A5C;transform:rotate(-.4deg)}' +
    '.ax-dev::before{content:"";position:absolute;left:50%;top:-9px;width:70px;height:16px;transform:translateX(-50%) rotate(-3deg);background:rgba(255,216,107,.9)}' +
    '.ax-dev svg{flex:none;width:36px;height:36px}' +
    '.ax-dev b{display:block;font-weight:800;font-size:15.5px;letter-spacing:-.01em}' +
    '.ax-dev span{display:block;font-size:13.5px;line-height:1.45;margin-top:2px;color:#3A4362}' +
    '.ax-dev a{color:#2F6BFF;font-weight:700}' +
    '.ax-tag{position:absolute;top:-10px;right:10px;z-index:2;font:700 10.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;background:#FFD86B;color:#1A2A5C;border:1.5px solid #1A2A5C;border-radius:999px;padding:5px 9px;box-shadow:2px 2px 0 #1A2A5C;transform:rotate(2deg);pointer-events:none;white-space:nowrap}' +
    '.ax-sso{position:relative}' +
    '.ax-sso.ax-off button{opacity:.45;filter:grayscale(1);cursor:not-allowed!important}' +
    '.ax-sso.ax-soft button{opacity:.72}' +
    '.ax-frozen{position:relative;opacity:.35!important;filter:grayscale(.7);pointer-events:none;user-select:none;animation:none!important}' +
    '.ax-block{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(251,248,240,.96);padding:20px}' +
    '.ax-block .ax-dev{max-width:440px;transform:none}';
  function css() { if (document.getElementById('ax-erisim-css')) return; var s = document.createElement('style'); s.id = 'ax-erisim-css'; s.textContent = CSS; document.head.appendChild(s); }
  var ICON = '<svg viewBox="-60 -60 120 120" aria-hidden="true"><path d="M0 -50 C6 -18 18 -6 50 0 C18 6 6 18 0 50 C-6 18 -18 6 -50 0 C-18 -6 -6 -18 0 -50 Z" fill="#FFD86B" stroke="#1A2A5C" stroke-width="5" stroke-linejoin="round"/><circle cx="-10" cy="-4" r="5" fill="#1A2A5C"/><circle cx="10" cy="-4" r="5" fill="#1A2A5C"/><path d="M-7 12 Q0 17 7 12" fill="none" stroke="#1A2A5C" stroke-width="4" stroke-linecap="round"/></svg>';
  function card(title, text, extra) {
    var d = document.createElement('div'); d.className = 'ax-dev'; d.setAttribute('role', 'status');
    d.innerHTML = ICON + '<div><b></b><span></span>' + (extra || '') + '</div>';
    d.querySelector('b').textContent = title; d.querySelector('span').textContent = text;
    return d;
  }
  function tagSso(off, label) {
    document.querySelectorAll('.sso').forEach(function (box) {
      box.classList.add('ax-sso', off ? 'ax-off' : 'ax-soft');
      if (!box.querySelector('.ax-tag')) { var t = document.createElement('span'); t.className = 'ax-tag'; t.textContent = label; box.appendChild(t); }
    });
  }

  var path = location.pathname;
  var isReg = /register\.html$/.test(path) || /\/register$/.test(path);
  var isLogin = /login\.html$/.test(path) || /\/login$/.test(path);
  var isDash = /dashboard\.html$/.test(path) || /\/dashboard$/.test(path);

  async function onReady() {
    if (isReg) {
      var f = await freeze(); if (!f.enabled) return; css();
      var form = document.getElementById('register-form');
      var main = document.querySelector('section.main') || (form && form.parentNode);
      tagSso(true, 'geliştirme aşamasında');
      document.querySelectorAll('[data-sso]').forEach(function (b) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); });
      if (form) {
        form.classList.add('ax-frozen'); form.setAttribute('aria-hidden', 'true');
        form.querySelectorAll('input, select, button, textarea').forEach(function (x) { x.disabled = true; });
        form.addEventListener('submit', function (e) { e.preventDefault(); e.stopImmediatePropagation(); }, true);
      }
      var sub = main && main.querySelector('.sub'); if (sub) sub.textContent = 'Kayıtlar şimdilik kapalı.';
      var anchor = main && (main.querySelector('.sso') || form);
      if (anchor) anchor.parentNode.insertBefore(card('Şu an geliştirme aşamasındayız', f.message || MSG, '<span>Hesabın varsa <a href="login.html">giriş yap</a>.</span>'), anchor);
    }
    if (isLogin) {
      var f2 = await freeze(); if (!f2.enabled) return; css();
      tagSso(false, 'yalnızca izinli hesaplar');
      var q = new URLSearchParams(location.search.slice(1) + '&' + location.hash.replace(/^#/, ''));
      var err = (q.get('error_description') || '') + ' ' + (q.get('error') || '');
      var denied = q.get('erisim') === 'yok', newBlocked = /database error saving new user|ACADEX_KAYIT_KAPALI|server_error/i.test(err);
      if (denied || newBlocked) {
        var view = document.getElementById('login-view'); var sso = view && view.querySelector('.sso');
        var note = document.querySelector('[data-sso-note]'); if (note && newBlocked) note.hidden = true;
        var c = card(newBlocked ? 'Bu hesapla henüz giriş yapılamıyor' : 'Hesabın henüz açılmadı',
          newBlocked ? 'Acadex şu an geliştirme aşamasında; Google ile yeni hesap açılamıyor. Davet aldıysan aynı e-postayla tekrar dene.' : 'Acadex şu an geliştirme aşamasında ve yalnızca izin verilen hesaplar girebiliyor. Erişim için Acadex ekibine yaz.');
        if (sso) sso.parentNode.insertBefore(c, sso); else if (view) view.prepend(c);
      }
    }
    if (isDash) {
      try {
        var s = await supabaseClient.auth.getSession(), u = s && s.data && s.data.session && s.data.session.user;
        if (!u) return;
        var r = await check(u.id); if (r.ok) return;
        css(); var b = document.createElement('div'); b.className = 'ax-block';
        b.appendChild(card('Hesabın henüz açılmadı', 'Acadex şu an geliştirme aşamasında ve yalnızca izin verilen hesaplar girebiliyor. Seni giriş sayfasına alıyoruz.'));
        document.body.appendChild(b);
        await supabaseClient.auth.signOut();
        setTimeout(function () { location.replace('login.html?erisim=yok'); }, 1800);
      } catch (e) { /* kilitleme */ }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
})();
