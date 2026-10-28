/* ==========================================================================
   Acadex · Yönetim paneli (js/admin-app.js)
   Güvenlik tarayıcıda değil, veritabanında: her veri ve işlem admin_* SQL
   fonksiyonlarıyla gelir; her fonksiyon "yönetici mi" diye kendisi bakar ve işlemleri admin_audit_log'a yazar.
   Bu dosya yalnızca gösterir. Gizli anahtar yok; anon/publishable anahtar ve
   oturum yeterli.
   ========================================================================== */
(function () {
  'use strict';
  var sb = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var NF = function (n) { return Number(n || 0).toLocaleString('tr-TR'); };
  var DT = function (d, withTime) { if (!d) return '—'; var x = new Date(d); if (isNaN(x)) return '—'; return x.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) + (withTime ? ' ' + x.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''); };
  var AGO = function (d) { if (!d) return '—'; var s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return 'az önce'; if (s < 3600) return Math.floor(s / 60) + ' dk önce'; if (s < 86400) return Math.floor(s / 3600) + ' sa önce'; if (s < 86400 * 30) return Math.floor(s / 86400) + ' gün önce'; return DT(d); };
  var SIZE = function (b) { b = Number(b || 0); return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; };
  var DEPTS = { 'Management Information Systems': 'Yönetim Bilişim Sistemleri', 'Business Administration': 'İşletme', 'International Trade and Business': 'Uluslararası Ticaret', 'Banking and Finance': 'Bankacılık ve Finans' };
  var dept = function (d) { return d ? (DEPTS[d] || d) : 'seçilmedi'; };
  var ini = function (n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toLocaleUpperCase('tr') || '?'; };
  var av = function (u) { return '<span class="av">' + X(ini(u.full_name || u.email)) + (u.avatar_url && /^https?:/.test(u.avatar_url) ? '<img src="' + X(u.avatar_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</span>'; };

  var toastT = 0;
  var toast = function (msg, bad) { var t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 3200); };
  var errMsg = function (e) { var m = (e && (e.message || e.error_description)) || String(e || 'bilinmeyen hata'); if (/42501|yetki/i.test(m + (e && e.code))) return 'Yetki yok: bu işlem için yönetici hesabı gerekli.'; return m; };
  var rpc = async function (fn, args) { var r = await sb.rpc(fn, args || {}); if (r.error) throw r.error; return r.data; };

  /* =========================== giriş + 2FA =========================== */
  var gateBody = $('#gate-body');
  var gate = function (html) { $('#app').hidden = true; $('#gate').hidden = false; gateBody.innerHTML = html; var f = $('input', gateBody); if (f) setTimeout(function () { f.focus(); }, 60); };
  var showErr = function (box, m) { var e = $('.err', box); if (!e) { e = document.createElement('p'); e.className = 'err'; e.setAttribute('role', 'alert'); box.querySelector('form, .acts-g').before(e); } e.textContent = m; };

  var loginView = function (msg) {
    gate('<h2 class="disp">Yönetim girişi</h2><p>Yalnızca Acadex yöneticileri içindir. Her işlem kayda geçer.</p>' + (msg ? '<p class="err" role="alert">' + X(msg) + '</p>' : '') +
'<form id="g-form" novalidate><label class="fld">E-posta<input class="in" type="email" name="e" autocomplete="username" required></label><label class="fld">Şifre<input class="in" type="password" name="p" autocomplete="current-password" required></label><button class="btn blue" type="submit">Giriş yap</button><button type="button" class="lnk" id="g-forgot">şifremi unuttum / şifre belirle</button></form>');
    $('#g-forgot').addEventListener('click', async function () {
      var f = $('#g-form'), em = f.e.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(em)) { showErr(gateBody, 'Önce e-posta adresini yaz.'); f.e.focus(); return; }
      this.disabled = true;
      var r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + '/reset-password.html' });
      this.disabled = false;
      if (r.error) { showErr(gateBody, errMsg(r.error)); return; }
      var e = $('.err', gateBody); if (e) e.remove();
      toast(em + ' adresine şifre belirleme bağlantısı gönderildi.');
    });
    $('#g-form').addEventListener('submit', async function (e) {
      e.preventDefault(); var b = $('button', this); b.disabled = true; b.textContent = 'giriş yapılıyor…';
      var r = await sb.auth.signInWithPassword({ email: this.e.value.trim(), password: this.p.value });
      if (r.error) { b.disabled = false; b.textContent = 'Giriş yap'; showErr(gateBody, /invalid/i.test(r.error.message) ? 'E-posta ya da şifre hatalı. Hesabın Google ile açıldıysa henüz şifresi yoktur: aşağıdan "şifre belirle"ye bas.' : errMsg(r.error)); return; }
      boot();
    });
  };

  var notAdminView = function (who) {
    gate('<h2 class="disp">Bu sayfa yöneticiler için</h2><p><b>' + X(who.email || who.name || '') + '</b> hesabının yönetici yetkisi yok. Yetki yalnızca veritabanından verilebilir.</p><div class="acts-g" style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn blue" href="dashboard.html">Öğrenci paneline git</a><button type="button" class="btn ghost" id="g-out">Başka hesapla gir</button></div>');
    $('#g-out').addEventListener('click', signOut);
  };

  var mfaView = async function () {
    var lf = await sb.auth.mfa.listFactors(); if (lf.error) throw lf.error;
    var all = (lf.data && lf.data.all) || [], verified = all.filter(function (f) { return f.factor_type === 'totp' && f.status === 'verified'; });
    if (verified.length) {
      var fid = verified[0].id;
      gate('<h2 class="disp">İki adımlı doğrulama</h2><p>Authenticator uygulamandaki 6 haneli kodu yaz.</p><form id="m-form" novalidate><input class="in code-in" name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required aria-label="Doğrulama kodu"><button class="btn blue" type="submit">Doğrula</button><button type="button" class="lnk" id="g-out">çıkış yap</button></form>');
      $('#g-out').addEventListener('click', signOut);
      var f = $('#m-form'); f.c.addEventListener('input', function () { this.value = this.value.replace(/\D/g, ''); if (this.value.length === 6) f.requestSubmit(); });
      f.addEventListener('submit', async function (e) {
        e.preventDefault(); var b = $('button[type=submit]', f); b.disabled = true;
        var r = await sb.auth.mfa.challengeAndVerify({ factorId: fid, code: f.c.value });
        if (r.error) { b.disabled = false; f.c.value = ''; showErr(gateBody, 'Kod yanlış ya da süresi geçti; yeni kodu dene.'); f.c.focus(); return; }
        boot();
      });
      return;
    }
    /* henüz kurulmamış: yarım kalan kayıtları temizle, yenisini oluştur */
    for (var i = 0; i < all.length; i++) if (all[i].status !== 'verified') { try { await sb.auth.mfa.unenroll({ factorId: all[i].id }); } catch (e) {} }
    var en = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Acadex yönetim ' + new Date().toISOString().slice(0, 10) });
    if (en.error) throw en.error;
    var t = en.data.totp;
    gate('<h2 class="disp">İki adımlı doğrulamayı kur</h2><p>Yönetim paneli için zorunlu. Google Authenticator, Microsoft Authenticator ya da 1Password ile bu kodu tara, sonra uygulamadaki 6 haneli kodu yaz.</p>' +
      '<div class="qr"><img src="' + X(t.qr_code) + '" alt="İki adımlı doğrulama QR kodu"></div><p class="muted" style="font-size:12.5px;margin-bottom:6px">Tarayamıyorsan bu anahtarı elle gir:</p><p class="secret mono">' + X(t.secret) + '</p>' +
      '<form id="m-form" novalidate><input class="in code-in" name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required aria-label="Doğrulama kodu"><button class="btn blue" type="submit">Kurulumu tamamla</button><button type="button" class="lnk" id="g-out">çıkış yap</button></form>');
    $('#g-out').addEventListener('click', signOut);
    var f2 = $('#m-form'); f2.c.addEventListener('input', function () { this.value = this.value.replace(/\D/g, ''); });
    f2.addEventListener('submit', async function (e) {
      e.preventDefault(); var b = $('button[type=submit]', f2); b.disabled = true;
      var r = await sb.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: f2.c.value });
      if (r.error) { b.disabled = false; f2.c.value = ''; showErr(gateBody, 'Kod tutmadı. Telefonunun saatinin doğru olduğundan emin ol ve yeni kodu dene.'); return; }
      toast('İki adımlı doğrulama kuruldu.'); boot();
    });
  };

  var signOut = async function () { try { await sb.auth.signOut(); } catch (e) {} location.replace(location.pathname); };

  var boot = async function () {
    if (!sb) { gate('<h2 class="disp">Bağlantı yok</h2><p>Supabase istemcisi yüklenemedi; sayfayı yenile.</p>'); return; }
    try {
      var s = await sb.auth.getSession();
      if (!s.data || !s.data.session) { var q = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1)); loginView(q.get('error_description') ? q.get('error_description').replace(/\+/g, ' ') : ''); return; }
      var who = await rpc('admin_whoami');
      if (!who || !who.is_admin) { notAdminView(who || {}); return; }
      ME = who; start();
    } catch (e) { gate('<h2 class="disp">Bir sorun çıktı</h2><p class="err">' + X(errMsg(e)) + '</p><div class="acts-g"><button type="button" class="btn blue" id="g-retry">Tekrar dene</button> <button type="button" class="lnk" id="g-out">çıkış yap</button></div>'); $('#g-retry').addEventListener('click', boot); $('#g-out').addEventListener('click', signOut); }
  };

  /* =========================== panel iskeleti =========================== */
  var ME = null, CUR = 'overview', COUNTS = {}, TEST = null;
  var IC = {
    overview: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.7 2.5 3 5.2"/>',
    reports: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    plans: '<path d="M4 6h16v12H4zM4 10h16M8 15h3"/>',
    content: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>',
    support: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-2 2.5-5 2.5h-1"/>',
    push: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1.5 2.5h5L16 13h5"/>',
    news: '<path d="M4 9v6h3l6 4V5L7 9zM17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    audit: '<path d="M9 4h6M9 4a2 2 0 0 0-2 2v0H5v15h14V6h-2a2 2 0 0 0-2-2M9 12l2 2 4-4"/>',
    ekip: '<circle cx="12" cy="5.5" r="2.5"/><circle cx="5" cy="17.5" r="2.5"/><circle cx="19" cy="17.5" r="2.5"/><path d="M12 8v4M5 15v-3h14v3"/>',
    test: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 14h9"/>'
  };
  var NAV = [
    { g: 'MASA' }, { k: 'overview', t: 'Genel bakış' },
    { g: 'ÖĞRENCİLER' }, { k: 'users', t: 'Kullanıcılar' }, { k: 'reports', t: 'Şikâyetler', badge: 'open_reports' }, { k: 'plans', t: 'Planlar ve kota', soon: true },
    { g: 'İÇERİK VE İLETİŞİM' }, { k: 'content', t: 'İçerik' }, { k: 'support', t: 'Canlı destek', badge: 'support_unread' }, { k: 'push', t: 'Bildirimler' }, { k: 'inbox', t: 'Gelen kutusu', badge: 'unread_messages' }, { k: 'news', t: 'Duyurular' },
    { g: 'ACADEX' }, { k: 'ekip', t: 'Acadex ekibi' },
    { g: 'TEST' }, { k: 'test', t: 'Test paneli', badge: 'test_open_hata' },
    { g: 'SİSTEM' }, { k: 'settings', t: 'Site ayarları' }, { k: 'audit', t: 'Denetim kaydı' }
  ];
  var TITLES = { overview: 'Genel bakış', users: 'Kullanıcılar', reports: 'Şikâyetler ve moderasyon', plans: 'Planlar ve kota', content: 'İçerik', support: 'Canlı destek', push: 'Telefon bildirimleri', inbox: 'Gelen kutusu', news: 'Duyurular', settings: 'Site ayarları', audit: 'Denetim kaydı', test: 'Test paneli', ekip: 'Acadex ekibi' };
  var paintNav = function () {
    $('#nav').innerHTML = NAV.map(function (n) {
      if (n.g) return '<div class="grp">' + n.g + '</div>';
      var c = n.badge && COUNTS[n.badge] ? '<span class="badge">' + NF(COUNTS[n.badge]) + '</span>' : n.soon ? '<span class="soon">yakında</span>' : '';
      return '<button type="button" data-go="' + n.k + '"' + (n.k === CUR ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + IC[n.k] + '</svg>' + X(n.t) + c + '</button>';
    }).join('');
  };
  var main = function () { return $('#adm-main'); };
  var go = function (k, push) {
    if (!VIEWS[k]) k = 'overview'; CUR = k; paintNav(); closeDrawer();
    $('#page-t').textContent = TITLES[k]; $('#crumb').textContent = TITLES[k].toLocaleUpperCase('tr'); document.title = 'Acadex · ' + TITLES[k]; supTitle();
    if (push !== false) history.replaceState(null, '', '#' + k);
    $('#app').classList.remove('nav-open'); $('#menu-b').setAttribute('aria-expanded', 'false');
    var m = main(); m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
    m.innerHTML = '<div class="card"><div class="skel" style="width:40%"></div><div class="skel" style="margin-top:12px"></div><div class="skel" style="margin-top:12px;width:70%"></div></div>';
    VIEWS[k](m).catch(function (e) { m.innerHTML = '<div class="card"><h2>Yüklenemedi</h2><p class="err">' + X(errMsg(e)) + '</p><button type="button" class="btn sm" data-go="' + k + '">tekrar dene</button></div>'; });
  };
  var refreshCounts = async function () { try { var o = await rpc('admin_overview'); try { TEST = await rpc('admin_test_overview'); o.test_open_hata = TEST.open_hata; } catch (te) { TEST = null; } o.support_unread = SUP.unread; COUNTS = o; paintNav(); $('#maint-pill').hidden = !(SETTINGS_CACHE && SETTINGS_CACHE.maintenance_mode && SETTINGS_CACHE.maintenance_mode.enabled); return o; } catch (e) { return null; } };
  var SETTINGS_CACHE = null;
  var start = function () {
    $('#gate').hidden = true; $('#app').hidden = false; $('#me-name').textContent = ME.name || ME.email || 'yönetici';
    rpc('admin_settings').then(function (s) { SETTINGS_CACHE = s.settings || {}; $('#maint-pill').hidden = !(SETTINGS_CACHE.maintenance_mode && SETTINGS_CACHE.maintenance_mode.enabled); }, function () {});
    refreshCounts(); supPulse();
    go((location.hash || '#overview').slice(1), false);
  };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); go(b.getAttribute('data-go')); } });
  $('#btn-out').addEventListener('click', signOut);
  $('#btn-refresh').addEventListener('click', function () { refreshCounts(); go(CUR); });
  $('#menu-b').addEventListener('click', function () { var o = $('#app').classList.toggle('nav-open'); this.setAttribute('aria-expanded', String(o)); });

  /* çekmece */
  var lastFocus = null;
  var openDrawer = function (title, html) { lastFocus = document.activeElement; $('#drawer-t').textContent = title; $('#drawer-body').innerHTML = html; $('#drawer').hidden = false; $('#drawer-back').hidden = false; setTimeout(function () { $('#drawer-x').focus(); }, 30); };
  var closeDrawer = function () { $('#drawer').hidden = true; $('#drawer-back').hidden = true; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} };
  $('#drawer-x').addEventListener('click', closeDrawer); $('#drawer-back').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

  var confirmBox = function (msg) { return window.confirm(msg); };
  /* profil fotoğrafını büyük göster */
  var lightbox = function (src, name) {
    var d = document.createElement('div'); d.className = 'lbox'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', (name || '') + ' profil fotoğrafı');
    d.innerHTML = '<figure><img src="' + X(src) + '" alt="' + X(name || '') + ' profil fotoğrafı" referrerpolicy="no-referrer"><figcaption>' + X(name || '') + '</figcaption></figure><button type="button" class="x" aria-label="Kapat">×</button>';
    var prev = document.activeElement, close = function () { d.remove(); document.removeEventListener('keydown', key, true); if (prev && prev.focus) prev.focus(); };
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    d.addEventListener('click', function (e) { if (!e.target.closest('img')) close(); });
    document.addEventListener('keydown', key, true); document.body.appendChild(d); d.querySelector('.x').focus();
  };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-bigav]'); if (b) lightbox(b.getAttribute('data-bigav'), ($('#drawer-t') || {}).textContent); });

  /* =========================== görünümler =========================== */
  var VIEWS = {};

  /* ---------- genel bakış ---------- */
  var chart30 = function (series) {
    var W = 760, H = 220, L = 34, R = 12, T = 14, B = 30, n = series.length || 1;
    var max = Math.max(1, Math.max.apply(null, series.map(function (s) { return Math.max(s.signups, s.docs, s.cards); })));
    var step = Math.ceil(max / 4) || 1, top = step * 4;
    var x = function (i) { return L + (W - L - R) * (i + .5) / n; }, y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var bw = Math.max(3, (W - L - R) / n * .32);
    var grid = ''; for (var g = 0; g <= 4; g++) { var gy = y(g * step); grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" stroke="#E3DECF"/><text x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="#6A7593">' + g * step + '</text>'; }
    var bars = series.map(function (s, i) { return '<rect x="' + (x(i) - bw - 1) + '" y="' + y(s.signups) + '" width="' + bw + '" height="' + (y(0) - y(s.signups)) + '" rx="2" fill="#2F6BFF"><title>' + s.d + ': ' + s.signups + ' yeni kayıt</title></rect><rect x="' + (x(i) + 1) + '" y="' + y(s.docs) + '" width="' + bw + '" height="' + (y(0) - y(s.docs)) + '" rx="2" fill="#E8B53A"><title>' + s.d + ': ' + s.docs + ' belge</title></rect>'; }).join('');
    var line = series.map(function (s, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(s.cards).toFixed(1); }).join(' ');
    var labels = series.map(function (s, i) { return i % 5 === 0 || i === n - 1 ? '<text x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="#6A7593">' + new Date(s.d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + '</text>' : ''; }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Son 30 günde yeni kayıt, belge ve özet kartı sayıları">' + grid + bars + '<path d="' + line + '" fill="none" stroke="#0D1838" stroke-width="2" stroke-linejoin="round"/>' + labels + '</svg><div class="legend"><span><i style="background:#2F6BFF"></i>yeni kayıt</span><span><i style="background:#E8B53A"></i>yüklenen belge</span><span><i style="background:#0D1838;height:3px;vertical-align:3px"></i>özet kartı</span></div>';
  };
  VIEWS.overview = async function (m) {
    var o = await refreshCounts(); if (!o) o = await rpc('admin_overview');
    var k = function (key, label, val, sub, goTo, alert, pct) { return '<div class="kpi' + (goTo ? ' go' : '') + (alert ? ' alert' : '') + '"' + (goTo ? ' data-go="' + goTo + '" role="button" tabindex="0"' : '') + ' style="--w:0%" data-w="' + (pct || 0) + '"><div class="k">' + label + '</div><div class="v" data-count="' + Number(val || 0) + '">0</div><div class="s">' + sub + '</div></div>'; };
    var tot = Math.max(1, o.users_total);
    m.innerHTML = '<div class="kpis">' +
      k('u', 'Öğrenci', o.users_total, '+' + NF(o.users_7d) + ' son 7 gün', 'users', false, 100) +
      k('a', 'Aktif (7 gün)', o.active_7d, NF(o.active_today) + ' bugün', 'users', false, Math.round(o.active_7d / tot * 100)) +
      k('d', 'Belge', o.docs_total, '+' + NF(o.docs_7d) + ' son 7 gün' + (o.docs_stuck ? ' · <b style="color:#C9483B">' + o.docs_stuck + ' takılı</b>' : ''), 'content', !!o.docs_stuck) +
      k('c', 'Özet kartı', o.cards_total, NF(o.cards_shared) + ' bölüm akışında paylaşıldı', 'content') +
      k('p', 'Bu ay özetlenen sayfa', o.pages_month, 'tüm öğrenciler toplamı') +
      k('r', 'Açık şikâyet', o.open_reports, o.open_reports ? 'incelemeni bekliyor' : 'temiz', 'reports', o.open_reports > 0) +
      k('m', 'Okunmamış mesaj', o.unread_messages, 'iletişim formundan', 'inbox', o.unread_messages > 0) +
      k('g', 'Google ile gelen', o.google_users, NF(o.incomplete) + ' profili eksik · ' + NF(o.suspended) + ' askıda', 'users') +
      '</div>' + testStrip() + '<div class="grid g-wide"><div class="card"><h2>Son 30 gün</h2><p class="sub">Günlük yeni kayıt, belge ve özet kartı</p>' + chart30(o.series || []) + '</div>' +
      '<div class="card"><h2>Bölümlere göre öğrenci</h2><p class="sub">' + NF(o.users_total) + ' öğrenci</p><div class="bars">' + (o.by_department || []).map(function (b) { return '<div class="bar"><span title="' + X(dept(b.d === '(seçilmedi)' ? '' : b.d)) + '">' + X(dept(b.d === '(seçilmedi)' ? '' : b.d)) + '</span><span class="t"><i data-w="' + Math.round(b.n / tot * 100) + '"></i></span><b>' + b.n + '</b></div>'; }).join('') + '</div></div></div>';
    /* sayaçlar ve çubuklar canlansın */
    requestAnimationFrame(function () {
      $$('.kpi', m).forEach(function (el) { el.style.setProperty('--w', (el.getAttribute('data-w') || 0) + '%'); });
      $$('.bar .t i', m).forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
      $$('[data-count]', m).forEach(function (el) { var to = +el.getAttribute('data-count'), t0 = performance.now(); var f = function (t) { var p = Math.min(1, (t - t0) / 700); el.textContent = NF(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    });
    $$('.kpi.go', m).forEach(function (el) { el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(el.getAttribute('data-go')); } }); });
  };

  /* ---------- test paneli (tp_* tabloları; bkz. test-paneli.sql, test-paneli-2.sql) ---------- */
  var TK = { hata: ['Hata', 'tk-hata'], tasarim: ['Tasarım', 'tk-tasarim'], oneri: ['Öneri', 'tk-oneri'] };
  var TS = { yeni: 'Yeni', inceleniyor: 'İnceleniyor', duzeltildi: 'Düzeltildi', dogrulandi: 'Doğrulandı' };
  var tKind = function (k) { var x = TK[k] || [k, '']; return '<span class="pill ' + x[1] + '"><i></i>' + x[0] + '</span>'; };
  var tStat = function (s) { return '<span class="pill ts-' + X(s) + '">' + X(TS[s] || s) + '</span>'; };
  var tLink = function (no) { return 'panel.html#k-' + encodeURIComponent(no); };
  var testStrip = function () {
    if (!TEST) return '';
    return '<a class="card tst-strip" href="panel.html" target="_blank" rel="noopener"><span class="mono">TEST PANELİ</span>' +
      '<span><b class="tk-t hata">' + NF(TEST.open_hata) + '</b> açık hata</span><span><b class="tk-t tasarim">' + NF(TEST.open_tasarim) + '</b> tasarım</span><span><b class="tk-t oneri">' + NF(TEST.open_oneri) + '</b> öneri</span>' +
      '<span class="muted">bu hafta ' + NF(TEST.week_new) + ' yeni · ' + NF(TEST.week_done) + ' doğrulandı</span><span class="go-t" data-go="test">ayrıntı →</span></a>';
  };
  VIEWS.test = async function (m) {
    var t;
    try { t = await rpc('admin_test_overview'); TEST = t; }
    catch (e) {
      if (/admin_test_overview|PGRST202|does not exist|tp_/i.test(String((e && (e.message || e.code)) || ''))) {
        m.innerHTML = '<div class="card"><h2>Test paneli henüz kurulmadı</h2><p class="sub">Supabase → SQL Editor\'de önce <b>test-paneli.sql</b>, sonra <b>test-paneli-2.sql</b> dosyasını çalıştır; bu sayfa kendiliğinden dolar.</p></div>';
        return;
      }
      throw e;
    }
    var tot = Math.max(1, t.total), bs = t.by_status || {}, pmax = Math.max(1, Math.max.apply(null, (t.by_page || []).map(function (p) { return p.n; }).concat([1])));
    var kpi = function (cls, label, val, sub, alert) { return '<div class="kpi tst-kpi ' + cls + (alert ? ' alert' : '') + '"><div class="k">' + label + '</div><div class="v">' + NF(val) + '</div><div class="s">' + sub + '</div></div>'; };
    var row = function (x, withVotes) {
      return '<a class="item tst-item" href="' + tLink(x.no) + '" target="_blank" rel="noopener"><div class="item-h">' + tKind(x.kind) + '<b>#' + X(x.no) + ' ' + X(x.title) + '</b>' + tStat(x.status) + '<span class="t">' + AGO(x.created_at) + '</span></div>' +
        '<span class="muted" style="font-size:12.5px">' + X(x.author) + (x.page ? ' · ' + X(x.page) : '') + (x.source === 'uygulama' ? ' · uygulama içinden' : '') +
        (withVotes && (x.votes || x.comments) ? ' · ' + (x.votes ? '+' + x.votes + ' bende de' : '') + (x.votes && x.comments ? ', ' : '') + (x.comments ? x.comments + ' yorum' : '') : '') + '</span></a>';
    };
    m.innerHTML =
      '<div class="tst-head"><p class="muted" style="margin:0">Şevval, Asude ve Cemre\'nin hata, tasarım ve öneri kayıtları. Kayıtları düzenlemek ve durumunu değiştirmek Test Paneli\'nde.</p><a class="btn blue sm" href="panel.html" target="_blank" rel="noopener">Test panelini aç ↗</a></div>' +
      '<div class="kpis">' +
        kpi('hata', 'Açık hata', t.open_hata, 'doğrulanmamış', t.open_hata > 0) +
        kpi('tasarim', 'Açık tasarım eksiği', t.open_tasarim, 'doğrulanmamış') +
        kpi('oneri', 'Açık öneri', t.open_oneri, 'doğrulanmamış') +
        kpi('', 'Bu hafta', t.week_new, NF(t.week_done) + ' doğrulandı · ' + NF(t.total) + ' toplam') +
      '</div>' +
      '<div class="grid g-wide"><div class="card"><h2>Son kayıtlar</h2><p class="sub">' + NF(t.from_app) + ' kayıt uygulama içindeki "Bildir" düğmesinden geldi</p><div class="list">' +
        ((t.recent || []).length ? t.recent.map(function (x) { return row(x, true); }).join('') : '<p class="muted">Henüz kayıt yok.</p>') + '</div></div>' +
      '<div class="grid" style="align-content:start"><div class="card"><h2>Durumlar</h2><p class="sub">' + NF(t.total) + ' kayıt</p><div class="bars">' +
        ['yeni', 'inceleniyor', 'duzeltildi', 'dogrulandi'].map(function (s) { var n = bs[s] || 0; return '<div class="bar"><span>' + TS[s] + '</span><span class="t"><i class="ts-bar ' + s + '" style="width:' + Math.round(n / tot * 100) + '%"></i></span><b>' + n + '</b></div>'; }).join('') + '</div></div>' +
        '<div class="card"><h2>Sayfalara göre açık kayıt</h2><p class="sub">en çok sorun çıkan yerler</p><div class="bars">' +
        ((t.by_page || []).length ? t.by_page.slice(0, 10).map(function (p) { return '<div class="bar"><span title="' + X(p.page) + '">' + X(p.page) + '</span><span class="t"><i style="width:' + Math.round(p.n / pmax * 100) + '%"></i></span><b>' + p.n + '</b></div>'; }).join('') : '<p class="muted">Açık kayıt yok.</p>') + '</div></div></div></div>' +
      '<div class="grid g-wide" style="margin-top:16px"><div class="card"><h2>Ekip</h2><p class="sub">kim ne kadar kayıt açtı</p><div class="tbl-w"><table class="tst-team"><thead><tr><th>Kişi</th><th>Açtı</th><th>Açık</th><th>Yorum</th><th>Son</th></tr></thead><tbody>' +
        (t.people || []).map(function (p) { return '<tr><td><div class="who"><span class="av" style="background:' + X(p.color) + ';color:#fff">' + X(ini(p.name)) + '</span><span><b>' + X(p.name) + (p.role === 'owner' ? ' <span class="pill">sahip</span>' : '') + '</b></span></div></td><td>' + NF(p.opened) + '</td><td>' + NF(p.open) + '</td><td>' + NF(p.comments) + '</td><td class="muted">' + (p.last_at ? AGO(p.last_at) : '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div><p class="muted" style="font-size:12.5px;margin:10px 0 0">Ekibe kişi eklemek ya da çıkarmak için Test Paneli\'nde sağ üstteki ekip simgesini kullan.</p></div>' +
      '<div class="card"><h2>En eski açık kayıtlar</h2><p class="sub">en uzun süredir bekleyenler</p><div class="list">' +
        ((t.oldest || []).length ? t.oldest.map(function (x) { return row(x, false); }).join('') : '<p class="muted">Açık kayıt yok.</p>') + '</div></div></div>';
  };

  /* ---------- Acadex ekibi (ax_teams, ax_people; bkz. supabase/migrations/20261024e_acadex_ekip.sql
     ve 20261029c_acadex_ekip_2.sql) ----------
     29.10.2026: "Organizasyon Şeması ve Görev Tanımları" belgesine göre genişledi:
     kişide amaç / sorumluluk / yetki / başarı göstergesi / bağlı olduğu; durumlar
     yeni katıldı, aday, açık pozisyon; birimde amaç, ortak görevler, karar usulü,
     çıktılar, koordinatör, durum (kuruldu / kuruluyor / kurulacak / dış destek),
     öncelik ve danışma kutusu. Kişiye/birime tıklayınca önce görev kartı açılır. */
  var EK = { teams: [], people: [], view: 'ekip', v2: true };
  var EST = { aktif: 'aktif', yeni: 'yeni katıldı', yari: 'yarı zamanlı', aday: 'aday', acik: 'açık pozisyon', ayrildi: 'ayrıldı' };
  var ESTC = { aktif: 'ok', yeni: 'blue', yari: 'warn', aday: 'warn', acik: '', ayrildi: 'bad' };
  var ETS = { kuruldu: 'kuruldu', kuruluyor: 'kuruluyor', acik: 'kurulacak', dis: 'dış destek' };
  var ETSC = { kuruldu: 'ok', kuruluyor: 'warn', acik: '', dis: 'blue' };
  var EPRI = { yuksek: 'yüksek öncelik', orta: 'orta öncelik', dusuk: 'düşük öncelik' };
  var EPRIC = { yuksek: 'bad', orta: 'warn', dusuk: '' };
  var EPAL = ['#1A2A5C', '#E06AA0', '#2F6BFF', '#8A5CF6', '#F08A24', '#C2417A', '#12A3A3', '#1E8A55', '#B5832A', '#D64545', '#5B6B8C'];
  try { EK.view = localStorage.getItem('acadex.adm.ekipView') || 'ekip'; } catch (e) {}
  var ekLoad = async function () {
    var a = await Promise.all([sb.from('ax_teams').select('*').order('sort').order('name'), sb.from('ax_people').select('*').order('sort').order('full_name')]);
    if (a[0].error) throw a[0].error; if (a[1].error) throw a[1].error;
    EK.teams = a[0].data || []; EK.people = a[1].data || [];
    /* 2. adım (20261029c) kurulu mu? kurulu değilse yeni alanlar gizlenir, kayıt bozulmaz */
    EK.v2 = !EK.teams.length || Object.prototype.hasOwnProperty.call(EK.teams[0], 'state');
  };
  var ekTeam = function (id) { return EK.teams.filter(function (t) { return t.id === id; })[0] || null; };
  var ekOpen = function (p) { return p.status === 'acik'; };
  var ekOf = function (tid) { return EK.people.filter(function (p) { return p.team_id === tid; }).sort(function (a, b) { return (ekOpen(a) - ekOpen(b)) || (b.is_lead - a.is_lead) || (a.sort - b.sort) || a.full_name.localeCompare(b.full_name, 'tr'); }); };
  var ekLines = function (s) { return String(s || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); };
  var ekList = function (s, cls) { var l = ekLines(s); return l.length ? '<ul class="ek-ul' + (cls ? ' ' + cls : '') + '">' + l.map(function (x) { var m = /^([^:]{2,20}):\s+(.+)$/.exec(x); /* yalnız kısa başlık kalın: "Ürün: …" */ return '<li>' + (m ? '<b>' + X(m[1]) + ':</b> ' + X(m[2]) : X(x)) + '</li>'; }).join('') + '</ul>' : ''; };
  var ekParas = function (s) { return ekLines(s).map(function (x) { return '<p>' + X(x) + '</p>'; }).join(''); };
  var ekAv = function (p, c) { return ekOpen(p) ? '<span class="av ek-av ek-av-open" aria-hidden="true">+</span>' : '<span class="av ek-av" style="background:' + X(c || '#5B6B8C') + '">' + X(ini(p.full_name)) + '</span>'; };
  var ekStatus = function (p) { return p.status !== 'aktif' ? ' <span class="pill ' + (ESTC[p.status] || '') + '">' + X(EST[p.status] || p.status) + '</span>' : ''; };
  var ekPerson = function (p, c) {
    return '<button type="button" class="ek-p' + (p.status === 'ayrildi' ? ' gone' : '') + (ekOpen(p) ? ' open' : '') + '" data-ekp="' + X(p.id) + '">' + ekAv(p, c) +
      '<span class="ek-pn"><b>' + X(p.full_name) + (p.is_lead ? ' <span class="pill blue">lider</span>' : '') + ekStatus(p) + '</b>' +
      '<small>' + X(ekOpen(p) ? (p.title && p.title !== p.full_name ? p.title : 'görevli aranıyor') : (p.title || 'rol yazılmadı')) + '</small>' +
      (p.job_description ? '<span class="ek-job">' + X(p.job_description) + '</span>' : '') +
      (p.reports_to && p.reports_to !== '—' ? '<span class="ek-rep">bağlı: ' + X(p.reports_to) + '</span>' : '') + '</span></button>';
  };
  var ekTeamPills = function (t) {
    return (t.state && t.state !== 'kuruldu' ? '<span class="pill ' + (ETSC[t.state] || '') + '">' + ETS[t.state] + '</span>' : '') +
      (t.priority ? '<span class="pill ' + (EPRIC[t.priority] || '') + '">' + EPRI[t.priority] + '</span>' : '');
  };
  var ekTeamCard = function (t) {
    var ps = ekOf(t.id), real = ps.filter(function (p) { return !ekOpen(p); }).length, duties = ekLines(t.duties);
    return '<div class="card ek-team' + (t.state && t.state !== 'kuruldu' ? ' dash' : '') + '" style="--tc:' + X(t.color) + '"><div class="ek-th"><span class="ek-dot"></span><h2><button type="button" class="ek-tlink" data-ekt="' + X(t.id) + '">' + X(t.name) + '</button></h2><span class="muted">' + real + ' kişi</span></div>' +
      ((t.state && t.state !== 'kuruldu') || t.priority ? '<div class="ek-pills">' + ekTeamPills(t) + '</div>' : '') +
      (t.coordinator ? '<p class="ek-coord">' + X(t.coordinator) + '</p>' : '') +
      (t.purpose || t.description ? '<p class="sub">' + X(t.purpose || t.description) + '</p>' : '') +
      (duties.length ? '<details class="ek-duties"><summary>' + (t.is_board ? 'Sorumluluklar' : ps.some(function (p) { return !ekOpen(p); }) ? 'Ortak görevler' : 'Planlanan görevler') + ' · ' + duties.length + '</summary>' + ekList(t.duties) + '</details>' : '') +
      '<div class="ek-ps">' + (ps.length ? ps.map(function (p) { return ekPerson(p, t.color); }).join('') : '<p class="muted ek-empty">Bu birimde henüz kimse yok.</p>') + '</div>' +
      '<button type="button" class="lnk ek-add" data-ekadd="' + X(t.id) + '">+ bu birime kişi ekle</button></div>';
  };
  /* açık pozisyonlar ve kurulacak birimler (belgenin 5. bölümü) */
  var ekGaps = function () {
    var rank = { yuksek: 0, orta: 1, dusuk: 2 }, rows = [];
    EK.teams.forEach(function (t) {
      if (t.is_advisory) return;
      var open = ekOf(t.id).filter(ekOpen), cand = ekOf(t.id).filter(function (p) { return p.status === 'aday'; });
      if (t.state === 'kuruldu' && !open.length && !cand.length) return;
      rows.push({ t: t, open: open, cand: cand, r: t.priority in rank ? rank[t.priority] : 3 });
    });
    if (!rows.length) return '';
    rows.sort(function (a, b) { return (a.r - b.r) || (a.t.sort - b.t.sort); });
    return '<div class="card ek-gaps"><h2>Açık pozisyonlar ve kurulacak birimler</h2><p class="sub">Öncelik sırasıyla; satıra tıklayınca birim açılır.</p><div class="tbl-w"><table><thead><tr><th>Birim / pozisyon</th><th>Neden gerekli</th><th>Öncelik</th><th>Durum</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var t = x.t, pos = x.open.map(function (p) { return p.title || p.full_name; }).concat(x.cand.map(function (p) { return p.full_name + ' (aday)'; }));
        return '<tr class="ek-gap" data-ekt="' + X(t.id) + '" tabindex="0"><td><b>' + X(t.name) + '</b>' + (pos.length ? '<div class="psh-s">' + X(pos.join(' · ')) + '</div>' : '') + '</td><td>' + X(t.purpose || '') + '</td>' +
          '<td>' + (t.priority ? '<span class="pill ' + EPRIC[t.priority] + '">' + EPRI[t.priority].replace(' öncelik', '') + '</span>' : '—') + '</td><td>' + (t.state && t.state !== 'kuruldu' ? '<span class="pill ' + (ETSC[t.state] || '') + '">' + ETS[t.state] + '</span> ' : '') + '<div class="psh-s">' + X(t.description || t.coordinator || '') + '</div></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  };
  var ekChart = function () {
    var board = EK.teams.filter(function (t) { return t.is_board; }), adv = EK.teams.filter(function (t) { return t.is_advisory && !t.is_board; });
    var rest = EK.teams.filter(function (t) { return !t.is_board && !t.is_advisory; });
    var node = function (p, c) { return '<button type="button" class="ek-node' + (ekOpen(p) || p.status === 'aday' ? ' dash' : '') + '" data-ekp="' + X(p.id) + '" style="--tc:' + X(c) + '">' + ekAv(p, c) + '<span><b>' + X(ekOpen(p) ? 'açık' : p.full_name) + (p.status === 'aday' ? ' <i class="ek-tag">aday</i>' : '') + '</b><small>' + X(ekOpen(p) ? (p.title || p.full_name) : (p.title || '')) + '</small></span></button>'; };
    var top = board.map(function (t) { return '<div class="ek-board" style="--tc:' + X(t.color) + '"><button type="button" class="ek-tn" data-ekt="' + X(t.id) + '"><b>' + X(t.name) + '</b>' + (t.coordinator ? '<small>' + X(t.coordinator) + '</small>' : '') + '</button><div class="ek-top">' + ekOf(t.id).map(function (p) { return node(p, t.color); }).join('') + '</div></div>'; }).join('');
    var noTeam = EK.people.filter(function (p) { return !p.team_id || !ekTeam(p.team_id); });
    return '<div class="card ek-chart">' + (top || '<p class="muted">Şemanın tepesi için bir birimi "yönetim" olarak işaretle.</p>') +
      (rest.length ? '<div class="ek-stem"></div><div class="ek-row">' + rest.map(function (t) {
        var ps = ekOf(t.id), lead = ps.filter(function (p) { return p.is_lead; })[0], others = ps.filter(function (p) { return p !== lead; });
        var dash = (t.state && t.state !== 'kuruldu') || !ps.some(function (p) { return !ekOpen(p); });
        return '<div class="ek-branch" style="--tc:' + X(t.color) + '"><button type="button" class="ek-tn' + (dash ? ' dash' : '') + '" data-ekt="' + X(t.id) + '"><b>' + X(t.name) + '</b><small>' + X(t.coordinator || (ps.filter(function (p) { return !ekOpen(p); }).length + ' kişi')) + '</small>' + (t.state && t.state !== 'kuruldu' ? '<small class="ek-st">' + ETS[t.state] + '</small>' : '') + '</button>' +
          (lead ? node(lead, t.color) : '') + (others.length ? '<div class="ek-sub">' + others.map(function (p) { return node(p, t.color); }).join('') + '</div>' : '') +
          (!ps.length ? '<button type="button" class="ek-open" data-ekadd="' + X(t.id) + '">+ kişi ekle</button>' : '') + '</div>';
      }).join('') + '</div>' : '') +
      (adv.length ? '<div class="ek-adv">' + adv.map(function (t) { return '<div class="ek-advrow" style="--tc:' + X(t.color) + '"><button type="button" class="mono ek-advt" data-ekt="' + X(t.id) + '">' + X(t.name.toLocaleUpperCase('tr')) + '</button>' + ekOf(t.id).map(function (p) { return node(p, t.color); }).join('') + '</div>'; }).join('') + '</div>' : '') +
      (noTeam.length ? '<div class="ek-loose"><span class="mono">BİRİMİ YOK</span>' + noTeam.map(function (p) { return node(p, '#5B6B8C'); }).join('') + '</div>' : '') +
      '<div class="legend ek-legend"><span><i style="background:var(--ink)"></i>dolu rol</span><span><i class="dash"></i>açık / aday / kurulacak</span></div></div>';
  };
  VIEWS.ekip = async function (m) {
    try { await ekLoad(); }
    catch (e) {
      if (/ax_teams|ax_people|does not exist|PGRST20/i.test(String((e && (e.message || e.code)) || ''))) {
        m.innerHTML = '<div class="card"><h2>Ekip bölümü henüz kurulmadı</h2><p class="sub">Supabase → SQL Editor\'de <b>20261024e_acadex_ekip.sql</b>, ardından <b>20261029c_acadex_ekip_2.sql</b> dosyasını çalıştır; bu sayfa kendiliğinden dolar.</p></div>';
        return;
      }
      throw e;
    }
    var act = EK.people.filter(function (p) { return p.status !== 'ayrildi' && !ekOpen(p) && !(ekTeam(p.team_id) || {}).is_advisory; }).length, open = EK.people.filter(ekOpen).length;
    m.innerHTML = (EK.v2 ? '' : '<div class="card ek-warn"><b>Görev kartı alanları henüz kurulmadı.</b> Yetki, başarı göstergesi, açık pozisyon ve birim durumu için Supabase → SQL Editor\'de <b>20261029c_acadex_ekip_2.sql</b> dosyasını çalıştır.</div>') +
      '<div class="tst-head"><p class="muted" style="margin:0">' + act + ' kişi · ' + EK.teams.filter(function (t) { return !t.is_advisory; }).length + ' birim' + (open ? ' · ' + open + ' açık pozisyon' : '') + '. Kişiye ya da birime tıklayınca görev kartı açılır.</p>' +
      '<div class="acts"><div class="ek-seg" role="group" aria-label="Görünüm"><button type="button" data-ekv="ekip" aria-pressed="' + (EK.view === 'ekip') + '">Birimler</button><button type="button" data-ekv="sema" aria-pressed="' + (EK.view === 'sema') + '">Organizasyon şeması</button></div>' +
      '<button type="button" class="btn ghost sm" id="ek-xlsx">Excel indir</button><button type="button" class="btn ghost sm" id="ek-newt">+ Birim</button><button type="button" class="btn blue sm" id="ek-newp">+ Kişi</button></div></div>' +
      (EK.view === 'sema' ? ekChart() : (EK.v2 ? ekGaps() : '') + '<div class="ek-grid">' + EK.teams.map(ekTeamCard).join('') + '</div>' +
        (EK.people.some(function (p) { return !p.team_id; }) ? '<div class="card" style="margin-top:16px"><h2>Birimi olmayanlar</h2><div class="ek-ps">' + EK.people.filter(function (p) { return !p.team_id; }).map(function (p) { return ekPerson(p); }).join('') + '</div></div>' : ''));
    m.onclick = function (e) {
      var b;
      if ((b = e.target.closest('[data-ekv]'))) { EK.view = b.getAttribute('data-ekv'); try { localStorage.setItem('acadex.adm.ekipView', EK.view); } catch (er) {} VIEWS.ekip(m); return; }
      if ((b = e.target.closest('[data-ekp]'))) { ekPersonCard(m, EK.people.filter(function (p) { return p.id === b.getAttribute('data-ekp'); })[0]); return; }
      if ((b = e.target.closest('[data-ekadd]'))) { ekPersonForm(m, null, b.getAttribute('data-ekadd')); return; }
      if ((b = e.target.closest('[data-ekt]'))) { ekTeamCardView(m, ekTeam(b.getAttribute('data-ekt'))); return; }
      if (e.target.closest('#ek-newp')) { ekPersonForm(m, null); return; }
      if (e.target.closest('#ek-newt')) { ekTeamForm(m, null); return; }
      if (e.target.closest('#ek-xlsx')) { ekExcel(); }
    };
    m.onkeydown = function (e) { var r = e.target.closest && e.target.closest('tr[data-ekt]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ekTeamCardView(m, ekTeam(r.getAttribute('data-ekt'))); } };
  };
  /* görev kartı (belgedeki düzen: amaç, sorumluluklar, yetkiler, başarı göstergeleri) */
  var ekSec = function (label, html) { return html ? '<section class="ek-sec"><h3>' + label + '</h3>' + html + '</section>' : ''; };
  var ekPersonCard = function (m, p) {
    if (!p) return; var t = ekTeam(p.team_id), c = t ? t.color : '#5B6B8C';
    openDrawer(ekOpen(p) ? (p.title || p.full_name) : p.full_name,
      '<div class="ek-card" style="--tc:' + X(c) + '"><div class="ek-ch">' + ekAv(p, c) + '<div><b>' + X(ekOpen(p) ? 'Açık pozisyon' : (p.title || 'rol yazılmadı')) + '</b>' +
      '<div class="ek-pills">' + (t ? '<span class="pill" style="background:' + X(c) + ';color:#fff">' + X(t.name) + '</span>' : '') + (p.is_lead ? '<span class="pill blue">lider</span>' : '') + (p.status !== 'aktif' ? '<span class="pill ' + (ESTC[p.status] || '') + '">' + X(EST[p.status] || p.status) + '</span>' : '') + '</div></div></div>' +
      '<dl class="kv ek-kv">' + (p.reports_to ? '<dt>Bağlı olduğu</dt><dd>' + X(p.reports_to) + '</dd>' : '') + (p.email ? '<dt>E-posta</dt><dd><a href="mailto:' + X(p.email) + '">' + X(p.email) + '</a></dd>' : '') + (p.phone ? '<dt>Telefon</dt><dd>' + X(p.phone) + '</dd>' : '') + (p.start_date ? '<dt>Başlangıç</dt><dd>' + DT(p.start_date) + '</dd>' : '') + '</dl>' +
      ekSec('Amaç', p.job_description ? '<p>' + X(p.job_description) + '</p>' : '') + ekSec('Sorumluluklar', ekList(p.responsibilities)) +
      ekSec('Yetkiler', ekParas(p.authority)) + ekSec('Başarı göstergeleri', ekParas(p.kpis)) +
      (!p.job_description && !p.responsibilities && !p.authority && !p.kpis ? '<p class="muted">Görev tanımı henüz yazılmadı.</p>' : '') +
      '<div class="acts"><button type="button" class="btn blue" id="ekc-edit">Düzenle</button></div></div>');
    $('#ekc-edit').addEventListener('click', function () { ekPersonForm(m, p); });
  };
  var ekTeamCardView = function (m, t) {
    if (!t) return; var ps = ekOf(t.id);
    openDrawer(t.name,
      '<div class="ek-card" style="--tc:' + X(t.color) + '"><div class="ek-pills">' + (t.is_board ? '<span class="pill blue">yönetim</span>' : '') + (t.is_advisory ? '<span class="pill">danışma</span>' : '') + ekTeamPills(t) + '</div>' +
      (t.coordinator ? '<p class="ek-coord">' + X(t.coordinator) + '</p>' : '') + (t.description && t.description !== t.purpose ? '<p>' + X(t.description) + '</p>' : '') +
      ekSec('Amaç', t.purpose ? '<p>' + X(t.purpose) + '</p>' : '') + ekSec(t.is_board ? 'Sorumluluklar' : ps.some(function (p) { return !ekOpen(p); }) ? 'Ortak görevler' : 'Planlanan görevler', ekList(t.duties)) +
      ekSec(t.is_board ? 'Karar usulü' : 'Çalışma kuralı', ekParas(t.rules)) + ekSec('Çıktılar', ekParas(t.outputs)) +
      ekSec('Kişiler', ps.length ? '<div class="ek-ps">' + ps.map(function (p) { return ekPerson(p, t.color); }).join('') + '</div>' : '<p class="muted">Henüz kimse yok.</p>') +
      '<div class="acts"><button type="button" class="btn blue" id="ekt-edit">Birimi düzenle</button><button type="button" class="btn ghost" id="ekt-addp">+ kişi ekle</button></div></div>');
    $('#ekt-edit').addEventListener('click', function () { ekTeamForm(m, t); });
    $('#ekt-addp').addEventListener('click', function () { ekPersonForm(m, null, t.id); });
    $$('[data-ekp]', $('#drawer-body')).forEach(function (b) { b.addEventListener('click', function () { ekPersonCard(m, EK.people.filter(function (p) { return p.id === b.getAttribute('data-ekp'); })[0]); }); });
  };
  var ekSave = async function (table, id, row) {
    var r = id ? await sb.from(table).update(row).eq('id', id) : await sb.from(table).insert(row);
    if (r.error) throw r.error;
  };
  var ekPersonForm = function (m, p, teamId) {
    p = p || { full_name: '', title: '', team_id: teamId || '', is_lead: false, job_description: '', responsibilities: '', authority: '', kpis: '', reports_to: '', email: '', phone: '', start_date: '', status: 'aktif', sort: 100 };
    var sts = EK.v2 ? EST : { aktif: EST.aktif, yari: EST.yari, ayrildi: EST.ayrildi };
    openDrawer(p.id ? (ekOpen(p) ? (p.title || p.full_name) : p.full_name) : 'Yeni kişi',
      '<form id="ekp-f" novalidate style="display:flex;flex-direction:column;gap:12px">' +
      '<label class="fld">Ad soyad <small>açık pozisyonda pozisyonun adı</small><input class="in" name="n" maxlength="80" required value="' + X(p.full_name) + '"></label>' +
      '<label class="fld">Rol / unvan <small>ör. Test Uzmanı</small><input class="in" name="ti" maxlength="160" value="' + X(p.title) + '"></label>' +
      '<div class="grid g2" style="gap:10px"><label class="fld">Birim<select class="in" name="t"><option value="">birimi yok</option>' + EK.teams.map(function (t) { return '<option value="' + X(t.id) + '"' + (t.id === p.team_id ? ' selected' : '') + '>' + X(t.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Durum<select class="in" name="s">' + Object.keys(sts).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? ' selected' : '') + '>' + sts[k] + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="switch"><input type="checkbox" name="l"' + (p.is_lead ? ' checked' : '') + '><i></i>birim lideri</label>' +
      (EK.v2 ? '<label class="fld">Bağlı olduğu <small>kişi ya da rol</small><input class="in" name="rp" maxlength="200" value="' + X(p.reports_to || '') + '"></label>' : '') +
      '<label class="fld">Amaç <small>bu rol neden var, kısaca</small><textarea class="in" name="j" maxlength="2000">' + X(p.job_description) + '</textarea></label>' +
      '<label class="fld">Sorumluluklar <small>her satıra bir madde; "Başlık: açıklama" yazılabilir</small><textarea class="in" name="r" maxlength="4000" rows="6">' + X(p.responsibilities) + '</textarea></label>' +
      (EK.v2 ? '<label class="fld">Yetkiler<textarea class="in" name="au" maxlength="2000">' + X(p.authority || '') + '</textarea></label>' +
        '<label class="fld">Başarı göstergeleri<textarea class="in" name="kp" maxlength="1500">' + X(p.kpis || '') + '</textarea></label>' : '') +
      '<div class="grid g2" style="gap:10px"><label class="fld">E-posta<input class="in" type="email" name="e" maxlength="120" value="' + X(p.email) + '"></label><label class="fld">Telefon<input class="in" type="tel" name="ph" maxlength="30" value="' + X(p.phone) + '"></label></div>' +
      '<div class="grid g2" style="gap:10px"><label class="fld">Başlangıç tarihi<input class="in" type="date" name="d" value="' + X(p.start_date || '') + '"></label><label class="fld">Sıra <small>küçük olan önce</small><input class="in" type="number" name="o" min="0" max="999" value="' + X(p.sort) + '"></label></div>' +
      '<div class="acts"><button class="btn blue" type="submit">' + (p.id ? 'Kaydet' : 'Ekle') + '</button>' + (p.id ? '<button class="btn red" type="button" id="ekp-del">kaldır</button>' : '') + '</div></form>');
    var f = $('#ekp-f');
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault(); if (f.n.value.trim().length < 2) { toast('Ad yaz.', true); f.n.focus(); return; }
      var b = $('button[type=submit]', f); b.disabled = true;
      var row = { full_name: f.n.value.trim(), title: f.ti.value.trim(), team_id: f.t.value || null, status: f.s.value, is_lead: f.l.checked, job_description: f.j.value.trim(), responsibilities: f.r.value.trim(), email: f.e.value.trim(), phone: f.ph.value.trim(), start_date: f.d.value || null, sort: parseInt(f.o.value, 10) || 100 };
      if (EK.v2) { row.reports_to = f.rp.value.trim(); row.authority = f.au.value.trim(); row.kpis = f.kp.value.trim(); }
      try {
        await ekSave('ax_people', p.id, row);
        toast(p.id ? 'Kaydedildi.' : 'Kişi eklendi.'); closeDrawer(); VIEWS.ekip(m);
      } catch (er) { b.disabled = false; toast(errMsg(er), true); }
    });
    var del = $('#ekp-del'); if (del) del.addEventListener('click', async function () {
      if (!confirmBox((ekOpen(p) ? '"' + (p.title || p.full_name) + '" açık pozisyonu' : p.full_name) + ' listeden kaldırılsın mı? Ayrıldıysa "Durum: ayrıldı" seçmek kaydı korur.')) return;
      try { var r = await sb.from('ax_people').delete().eq('id', p.id); if (r.error) throw r.error; toast('Kaldırıldı.'); closeDrawer(); VIEWS.ekip(m); } catch (er) { toast(errMsg(er), true); }
    });
  };
  var ekTeamForm = function (m, t) {
    var used = EK.teams.map(function (x) { return x.color; });
    t = t || { name: '', color: EPAL.filter(function (c) { return used.indexOf(c) < 0; })[0] || EPAL[0], description: '', purpose: '', duties: '', rules: '', outputs: '', coordinator: '', state: 'kuruldu', priority: null, is_board: false, is_advisory: false, sort: (EK.teams.length + 1) * 10 };
    var n = t.id ? ekOf(t.id).length : 0, sel = function (name, map, cur, empty) { return '<select class="in" name="' + name + '">' + (empty ? '<option value="">' + empty + '</option>' : '') + Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + map[k] + '</option>'; }).join('') + '</select>'; };
    openDrawer(t.id ? t.name : 'Yeni birim',
      '<form id="ekt-f" novalidate style="display:flex;flex-direction:column;gap:12px">' +
      '<label class="fld">Birim adı<input class="in" name="n" maxlength="60" required value="' + X(t.name) + '" placeholder="ör. Finans"></label>' +
      (EK.v2 ? '<div class="grid g2" style="gap:10px"><label class="fld">Durum' + sel('st', ETS, t.state || 'kuruldu') + '</label><label class="fld">Öncelik' + sel('pr', { yuksek: 'yüksek', orta: 'orta', dusuk: 'düşük' }, t.priority, 'yok') + '</label></div>' +
        '<label class="fld">Lider / koordinasyon <small>ör. Koordinasyon: Serhat Arslan</small><input class="in" name="co" maxlength="200" value="' + X(t.coordinator || '') + '"></label>' +
        '<label class="fld">Amaç<textarea class="in" name="pu" maxlength="1500">' + X(t.purpose || '') + '</textarea></label>' : '') +
      '<label class="fld">Kısa açıklama<textarea class="in" name="d" maxlength="1500">' + X(t.description) + '</textarea></label>' +
      (EK.v2 ? '<label class="fld">Görevler / sorumluluklar <small>her satıra bir madde</small><textarea class="in" name="du" maxlength="4000" rows="6">' + X(t.duties || '') + '</textarea></label>' +
        '<label class="fld">Karar usulü / çalışma kuralı<textarea class="in" name="ru" maxlength="2000">' + X(t.rules || '') + '</textarea></label>' +
        '<label class="fld">Çıktılar<textarea class="in" name="ou" maxlength="1000">' + X(t.outputs || '') + '</textarea></label>' : '') +
      '<div class="fld">Renk<div class="ek-colors">' + EPAL.map(function (c) { return '<label><input type="radio" name="c" value="' + c + '"' + (c === t.color ? ' checked' : '') + '><i style="background:' + c + '"></i></label>'; }).join('') + '</div></div>' +
      '<div class="grid g2" style="gap:10px"><label class="fld">Sıra <small>küçük olan önce</small><input class="in" type="number" name="o" min="0" max="999" value="' + X(t.sort) + '"></label>' +
      '<div style="display:flex;flex-direction:column;gap:6px;justify-content:flex-end"><label class="switch"><input type="checkbox" name="b"' + (t.is_board ? ' checked' : '') + '><i></i>yönetim (şemada en üstte)</label>' +
      (EK.v2 ? '<label class="switch"><input type="checkbox" name="ad"' + (t.is_advisory ? ' checked' : '') + '><i></i>danışma (şemada ayrı sıra)</label>' : '') + '</div></div>' +
      '<div class="acts"><button class="btn blue" type="submit">' + (t.id ? 'Kaydet' : 'Birim ekle') + '</button>' + (t.id ? '<button class="btn red" type="button" id="ekt-del">birimi kaldır</button>' : '') + '</div>' +
      (t.id && n ? '<p class="muted" style="font-size:12.5px;margin:0">Birim kaldırılırsa ' + n + ' kişi silinmez, "birimi yok" olarak kalır.</p>' : '') + '</form>');
    var f = $('#ekt-f');
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault(); if (f.n.value.trim().length < 2) { toast('Birim adı yaz.', true); f.n.focus(); return; }
      var c = $('input[name=c]:checked', f), b = $('button[type=submit]', f); b.disabled = true;
      var row = { name: f.n.value.trim(), description: f.d.value.trim(), color: c ? c.value : t.color, sort: parseInt(f.o.value, 10) || 100, is_board: f.b.checked };
      if (EK.v2) { row.state = f.st.value; row.priority = f.pr.value || null; row.coordinator = f.co.value.trim(); row.purpose = f.pu.value.trim(); row.duties = f.du.value.trim(); row.rules = f.ru.value.trim(); row.outputs = f.ou.value.trim(); row.is_advisory = f.ad.checked; }
      try {
        await ekSave('ax_teams', t.id, row);
        toast(t.id ? 'Birim kaydedildi.' : 'Birim eklendi.'); closeDrawer(); VIEWS.ekip(m);
      } catch (er) { b.disabled = false; toast(/duplicate|unique/i.test(er.message || '') ? 'Bu adla bir birim zaten var.' : errMsg(er), true); }
    });
    var del = $('#ekt-del'); if (del) del.addEventListener('click', async function () {
      if (!confirmBox('"' + t.name + '" birimi kaldırılsın mı?')) return;
      try { var r = await sb.from('ax_teams').delete().eq('id', t.id); if (r.error) throw r.error; toast('Birim kaldırıldı.'); closeDrawer(); VIEWS.ekip(m); } catch (er) { toast(errMsg(er), true); }
    });
  };
  var xlsxP = null;
  var loadXlsx = function () {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxP) return xlsxP;
    xlsxP = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = function () { res(window.XLSX); }; s.onerror = function () { xlsxP = null; rej(new Error('Excel kütüphanesi yüklenemedi')); }; document.head.appendChild(s); });
    return xlsxP;
  };
  var ekExcel = async function () {
    var tName = function (id) { var t = ekTeam(id); return t ? t.name : 'birimi yok'; };
    var bul = function (s) { return ekLines(s).map(function (x) { return '• ' + x; }).join('\n'); };
    var people = EK.people.slice().sort(function (a, b) { var ta = ekTeam(a.team_id), tb = ekTeam(b.team_id); return ((ta ? ta.sort : 9999) - (tb ? tb.sort : 9999)) || (ekOpen(a) - ekOpen(b)) || (b.is_lead - a.is_lead) || (a.sort - b.sort); });
    var PH = ['Ad soyad / pozisyon', 'Rol / unvan', 'Birim', 'Lider', 'Durum', 'Bağlı olduğu', 'Amaç', 'Sorumluluklar', 'Yetkiler', 'Başarı göstergeleri', 'E-posta', 'Telefon', 'Başlangıç'];
    var PR = people.map(function (p) { return [p.full_name, p.title, tName(p.team_id), p.is_lead ? 'evet' : '', EST[p.status] || p.status, p.reports_to || '', p.job_description, bul(p.responsibilities), p.authority || '', p.kpis || '', p.email, p.phone, p.start_date || '']; });
    var TH = ['Birim', 'Durum', 'Öncelik', 'Lider / koordinasyon', 'Amaç', 'Açıklama', 'Görevler', 'Karar usulü / kural', 'Çıktılar', 'Kişi sayısı', 'Kişiler', 'Açık pozisyonlar'];
    var TR = EK.teams.map(function (t) { var ps = ekOf(t.id), real = ps.filter(function (p) { return !ekOpen(p); }), op = ps.filter(ekOpen); return [t.name, ETS[t.state] || '', t.priority ? EPRI[t.priority] : '', t.coordinator || '', t.purpose || '', t.description, bul(t.duties), t.rules || '', t.outputs || '', real.length, real.map(function (p) { return p.full_name + (p.title ? ' (' + p.title + ')' : ''); }).join(', '), op.map(function (p) { return p.title || p.full_name; }).join(', ')]; });
    var day = new Date().toISOString().slice(0, 10);
    try {
      var XL = await loadXlsx(), wb = XL.utils.book_new();
      var ws1 = XL.utils.aoa_to_sheet([PH].concat(PR)); ws1['!cols'] = [24, 34, 22, 8, 14, 30, 50, 70, 50, 40, 26, 16, 12].map(function (w) { return { wch: w }; });
      var ws2 = XL.utils.aoa_to_sheet([TH].concat(TR)); ws2['!cols'] = [24, 12, 14, 30, 50, 50, 70, 50, 40, 10, 50, 40].map(function (w) { return { wch: w }; });
      XL.utils.book_append_sheet(wb, ws1, 'Kişiler'); XL.utils.book_append_sheet(wb, ws2, 'Birimler');
      XL.writeFile(wb, 'acadex-ekip-' + day + '.xlsx');
      toast('Excel indirildi.');
    } catch (e) {
      csv('acadex-ekip-' + day + '.csv', PH, PR);
      toast('Excel kütüphanesi yüklenemedi; Excel\'de açılan CSV olarak indirdim.', true);
    }
  };

  /* ---------- kullanıcılar ---------- */
  var UF = { q: '', dept: '', provider: '', status: '', off: 0 };
  VIEWS.users = async function (m) {
    m.innerHTML = '<div class="tools"><label class="fld grow">Ara<input class="in" id="u-q" placeholder="ad, e-posta ya da öğrenci no" value="' + X(UF.q) + '"></label>' +
      '<label class="fld">Bölüm<select class="in" id="u-dept"><option value="">hepsi</option>' + Object.keys(DEPTS).map(function (d) { return '<option value="' + X(d) + '"' + (UF.dept === d ? ' selected' : '') + '>' + X(DEPTS[d]) + '</option>'; }).join('') + '<option value="-"' + (UF.dept === '-' ? ' selected' : '') + '>seçilmedi</option></select></label>' +
      '<label class="fld">Giriş<select class="in" id="u-prov"><option value="">hepsi</option><option value="email"' + (UF.provider === 'email' ? ' selected' : '') + '>e-posta</option><option value="google"' + (UF.provider === 'google' ? ' selected' : '') + '>Google</option></select></label>' +
      '<label class="fld">Durum<select class="in" id="u-st"><option value="">hepsi</option><option value="active"' + (UF.status === 'active' ? ' selected' : '') + '>aktif</option><option value="suspended"' + (UF.status === 'suspended' ? ' selected' : '') + '>askıda</option><option value="incomplete"' + (UF.status === 'incomplete' ? ' selected' : '') + '>profili eksik</option><option value="admin"' + (UF.status === 'admin' ? ' selected' : '') + '>yönetici</option><option value="noaccess"' + (UF.status === 'noaccess' ? ' selected' : '') + '>izinsiz</option></select></label>' +
      '<button type="button" class="btn ghost sm" id="u-csv">CSV indir</button></div><div id="u-list"></div>';
    var t = 0;
    $('#u-q').addEventListener('input', function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { UF.q = v.trim(); UF.off = 0; loadUsers(); }, 300); });
    [['#u-dept', 'dept'], ['#u-prov', 'provider'], ['#u-st', 'status']].forEach(function (p) { $(p[0]).addEventListener('change', function () { UF[p[1]] = this.value; UF.off = 0; loadUsers(); }); });
    $('#u-csv').addEventListener('click', async function () { var d = await rpc('admin_users', { p_q: UF.q, p_dept: UF.dept, p_provider: UF.provider, p_status: UF.status, p_limit: 200, p_offset: 0 }); csv('acadex-kullanicilar.csv', ['Ad', 'E-posta', 'Bölüm', 'Öğrenci no', 'Giriş', 'Kayıt', 'Son aktif', 'Belge', 'Kart', 'Durum'], (d.rows || []).map(function (u) { return [u.full_name, u.email, dept(u.department), u.student_number, u.provider, u.created_at, u.last_active_date, u.docs, u.cards, u.is_suspended ? 'askıda' : 'aktif']; })); });
    await loadUsers();
  };
  var loadUsers = async function () {
    var box = $('#u-list'); if (!box) return;
    var d = await rpc('admin_users', { p_q: UF.q, p_dept: UF.dept, p_provider: UF.provider, p_status: UF.status, p_limit: 50, p_offset: UF.off });
    var rows = d.rows || [];
    if (!rows.length) { box.innerHTML = '<div class="tbl-w"><div class="empty"><span class="hand">kimse çıkmadı</span>Süzgeçleri değiştirmeyi dene.</div></div>'; return; }
    box.innerHTML = '<div class="tbl-w"><table><thead><tr><th>Öğrenci</th><th class="hide-sm">Bölüm</th><th>Giriş</th><th class="hide-sm">Kayıt</th><th>Son aktif</th><th class="hide-sm">Belge / kart</th><th>Durum</th></tr></thead><tbody>' +
      rows.map(function (u) { return '<tr class="click" data-uid="' + X(u.id) + '" tabindex="0"><td><div class="who">' + av(u) + '<span><b>' + X(u.full_name || '(adsız)') + (u.is_admin ? ' <span class="pill blue">yönetici</span>' : '') + (u.access_allowed === false && !u.is_admin ? ' <span class="pill warn">izinsiz</span>' : '') + '</b><small>' + X(u.email) + '</small></span></div></td><td class="hide-sm">' + X(dept(u.department)) + '</td><td>' + (u.provider === 'google' ? '<span class="pill">Google</span>' : '<span class="pill">e-posta</span>') + '</td><td class="hide-sm">' + DT(u.created_at) + '</td><td>' + (u.last_active_date ? DT(u.last_active_date) : '—') + '</td><td class="hide-sm">' + u.docs + ' / ' + u.cards + '</td><td>' + (u.is_suspended ? '<span class="pill bad">askıda</span>' : (!u.department || /^oauth-/.test(u.student_number || '')) ? '<span class="pill warn">profil eksik</span>' : '<span class="pill ok">aktif</span>') + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="pager"><span>' + NF(d.total) + ' kişiden ' + (UF.off + 1) + '–' + (UF.off + rows.length) + '</span><span><button type="button" class="btn ghost sm" id="u-prev"' + (UF.off ? '' : ' disabled') + '>← önceki</button> <button type="button" class="btn ghost sm" id="u-next"' + (UF.off + rows.length < d.total ? '' : ' disabled') + '>sonraki →</button></span></div>';
    $$('tr[data-uid]', box).forEach(function (tr) { var o = function () { userDetail(tr.getAttribute('data-uid')); }; tr.addEventListener('click', o); tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') o(); }); });
    $('#u-prev').addEventListener('click', function () { UF.off = Math.max(0, UF.off - 50); loadUsers(); });
    $('#u-next').addEventListener('click', function () { UF.off += 50; loadUsers(); });
  };
  var userDetail = async function (id) {
    openDrawer('Öğrenci', '<div class="skel"></div><div class="skel" style="margin-top:10px;width:60%"></div>');
    try {
      var d = await rpc('admin_user_detail', { p_id: id }), p = d.profile || {}, a = d.auth || {}, c = d.counts || {};
      var self = ME && p.email === ME.email;
      $('#drawer-t').textContent = p.full_name || 'Öğrenci';
      var hasImg = p.avatar_url && /^https?:/.test(p.avatar_url);
      $('#drawer-body').innerHTML = '<div class="who big"><button type="button" class="av av-lg"' + (hasImg ? ' data-bigav="' + X(p.avatar_url) + '" aria-label="Profil fotoğrafını büyüt" title="büyüt"' : ' disabled aria-label="Profil fotoğrafı yok"') + '>' + X(ini(p.full_name || p.email)) + (hasImg ? '<img src="' + X(p.avatar_url) + '" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.removeAttribute(\'data-bigav\');this.remove()">' : '') + '</button><span><b>' + X(p.full_name || '(adsız)') + '</b><small>' + X(p.email) + '</small>' + (hasImg ? '<small class="muted" style="margin-top:2px">fotoğrafa tıkla, büyüt</small>' : '') + '</span></div>' +
        '<div>' + (p.is_suspended ? '<span class="pill bad">askıda</span> ' : '<span class="pill ok">aktif</span> ') + (p.is_admin ? '<span class="pill blue">yönetici</span> ' : '') + (p.access_allowed === false && !p.is_admin ? '<span class="pill warn">izinsiz</span> ' : p.access_allowed === true ? '<span class="pill ok">erişim izni var</span> ' : '') + '<span class="pill">' + (a.provider === 'google' ? 'Google ile' : 'e-postayla') + ' giriş</span> ' + (a.confirmed ? '' : '<span class="pill warn">e-posta onaysız</span>') + '</div>' +
        '<div class="minis"><div class="mini"><b>' + NF(c.docs) + '</b><span>belge</span></div><div class="mini"><b>' + NF(c.cards) + '</b><span>özet kartı</span></div><div class="mini"><b>' + NF(c.shared) + '</b><span>paylaşılan</span></div><div class="mini"><b>' + NF(c.reports_against) + '</b><span>şikâyet aldı</span></div></div>' +
        '<dl class="kv"><dt>Bölüm</dt><dd>' + X(dept(p.department)) + '</dd><dt>Öğrenci no</dt><dd>' + (/^oauth-/.test(p.student_number || '') ? '<span class="pill warn">girilmedi</span>' : X(p.student_number)) + '</dd><dt>Kayıt</dt><dd>' + DT(p.created_at, true) + '</dd><dt>Son giriş</dt><dd>' + (a.last_sign_in_at ? DT(a.last_sign_in_at, true) + ' (' + AGO(a.last_sign_in_at) + ')' : '—') + '</dd><dt>Son aktif gün</dt><dd>' + DT(p.last_active_date) + '</dd><dt>Seri</dt><dd>' + NF(p.current_streak) + ' gün</dd><dt>Plan</dt><dd>' + X((d.plan && d.plan.plan) || 'lite') + ' <span class="muted">(planlar yakında düzenlenebilecek)</span></dd>' + (p.bio ? '<dt>Hakkında</dt><dd>' + X(p.bio) + '</dd>' : '') + '</dl>' +
        (d.usage && d.usage.length ? '<div><h3 style="margin:0 0 8px;font-size:15px">Aylık kullanım</h3><div class="tbl-w"><table><thead><tr><th>Ay</th><th>Sayfa</th><th>Belge</th><th>Önbellek</th></tr></thead><tbody>' + d.usage.map(function (u) { return '<tr><td>' + new Date(u.period).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) + '</td><td>' + NF(u.pages_used) + '</td><td>' + NF(u.docs_used) + '</td><td>' + NF(u.cache_hits) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '') +
        (d.docs && d.docs.length ? '<div><h3 style="margin:0 0 8px;font-size:15px">Son belgeler</h3><div class="tbl-w"><table><tbody>' + d.docs.map(function (x) { return '<tr><td>' + X(x.file_name) + '</td><td>' + (x.status === 'summarized' ? '<span class="pill ok">özetlendi</span>' : '<span class="pill">' + X(x.status) + '</span>') + '</td><td class="muted">' + AGO(x.uploaded_at) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '') +
        '<div class="acts"><a class="btn ghost sm" href="mailto:' + X(p.email) + '">e-posta yaz</a><button type="button" class="btn ghost sm" id="d-reset">şifre sıfırlama e-postası</button></div>' +
        '<div id="d-teach"></div>' +
        (!self && !p.is_admin && typeof p.access_allowed === 'boolean' ? '<div class="danger" style="border-color:#2F6BFF;background:#F3F7FF"><h3>' + (p.access_allowed ? 'Erişimi kapat' : 'Erişim izni ver') + '</h3><p class="muted" style="font-size:13px;margin:0 0 10px">' + (p.access_allowed ? 'Geliştirme modu açıkken öğrenci giriş yapamaz; verisi silinmez.' : 'Geliştirme modu açıkken yalnızca izinli hesaplar girebilir. İzin verince öğrenci hemen giriş yapabilir.') + '</p><button type="button" class="btn ' + (p.access_allowed ? 'ghost' : 'blue') + ' sm" id="d-acc">' + (p.access_allowed ? 'Erişimi kapat' : 'Erişim izni ver') + '</button></div>' : '') +
        (self ? '<p class="muted" style="font-size:13px">Kendi hesabın: askıya alma kapalı.</p>' : p.is_admin ? '<p class="muted" style="font-size:13px">Yönetici hesapları panelden askıya alınamaz.</p>' :
          '<div class="danger"><h3>' + (p.is_suspended ? 'Askıyı kaldır' : 'Hesabı askıya al') + '</h3><p class="muted" style="font-size:13px;margin:0 0 10px">' + (p.is_suspended ? 'Öğrenci yeniden giriş yapıp Acadex\'i kullanabilir.' : 'Öğrenci giriş yaptığında panel yerine "hesabın askıda" ekranını görür. Verisi silinmez.') + '</p>' +
          (p.is_suspended ? '' : '<label class="fld" style="margin-bottom:10px">Sebep <small>(kayda geçer)</small><input class="in" id="d-reason" maxlength="200" placeholder="örn. tekrarlanan uygunsuz paylaşım"></label>') +
          '<button type="button" class="btn ' + (p.is_suspended ? 'green' : 'red') + ' sm" id="d-susp">' + (p.is_suspended ? 'Askıyı kaldır' : 'Askıya al') + '</button></div>' +
          '<div class="danger" style="border-style:solid"><h3>Hesabı kalıcı olarak sil</h3><p class="muted" style="font-size:13px;margin:0 0 10px">Öğrencinin hesabı, belgeleri, özet kartları, notları ve diğer tüm kayıtları silinir. <b>Geri alınamaz.</b> Silme işlemi denetim kaydına geçer.</p>' +
          '<label class="fld" style="margin-bottom:10px">Onaylamak için e-postasını yaz <small>' + X(p.email) + '</small><input class="in" id="d-delmail" autocomplete="off" spellcheck="false"></label>' +
          '<button type="button" class="btn red sm" id="d-del" disabled>Hesabı kalıcı sil</button></div>') +
        (d.log && d.log.length ? '<div><h3 style="margin:0 0 8px;font-size:15px">Bu öğrenciyle ilgili kayıtlar</h3><div class="list">' + d.log.map(function (l) { return '<div class="item" style="padding:10px 12px"><div class="item-h"><b style="font-size:13.5px">' + X(ACTION[l.action] || l.action) + '</b><span class="t">' + AGO(l.created_at) + '</span></div><span class="muted" style="font-size:12.5px">' + X(l.actor_name || 'sistem') + (l.details && l.details.reason ? ' · ' + X(l.details.reason) : '') + '</span></div>'; }).join('') + '</div></div>' : '');
      $('#d-reset').addEventListener('click', async function () {
        if (!confirmBox(p.email + ' adresine şifre sıfırlama bağlantısı gönderilsin mi?')) return;
        this.disabled = true; var r = await sb.auth.resetPasswordForEmail(p.email, { redirectTo: location.origin + '/reset-password.html' });
        if (r.error) { this.disabled = false; toast(errMsg(r.error), true); return; }
        try { await rpc('admin_note_password_reset', { p_id: p.id }); } catch (e) {}
        this.textContent = 'gönderildi ✓'; toast('Şifre sıfırlama e-postası gönderildi.');
      });
      var dm = $('#d-delmail'), db = $('#d-del');
      if (dm && db) {
        dm.addEventListener('input', function () { db.disabled = this.value.trim().toLowerCase() !== String(p.email || '').toLowerCase(); });
        db.addEventListener('click', async function () {
          if (!confirmBox((p.full_name || p.email) + ' hesabı ve tüm verileri kalıcı olarak silinecek. Emin misin?')) return;
          db.disabled = true; db.textContent = 'siliniyor…';
          try { await rpc('admin_delete_user', { p_id: p.id, p_confirm_email: dm.value.trim() }); toast((p.full_name || p.email) + ' hesabı silindi.'); closeDrawer(); loadUsers(); refreshCounts(); }
          catch (e) { db.disabled = false; db.textContent = 'Hesabı kalıcı sil'; toast(/admin_delete_user|could not find|does not exist|PGRST202/i.test((e && (e.message + e.code)) || '') ? 'Silme özelliği veritabanında henüz kurulu değil (SQL adımı yapılmalı).' : errMsg(e), true); }
        });
      }
      /* Faz 6.1: öğretmen yetkisi (admin_user_detail is_teacher döndürmez; ayrı RPC). */
      var tbox = $('#d-teach');
      var paintTeach = async function () {
        if (!tbox) return;
        var t; try { t = await rpc('admin_teacher_status', { p_id: p.id }); } catch (e) { tbox.innerHTML = ''; return; }
        if (!t) { tbox.innerHTML = ''; return; }
        var on = !!t.is_teacher;
        tbox.innerHTML = '<div class="danger" style="border-color:#1F9D6B;background:#F2FBF6"><h3>' + (on ? 'Öğretmen yetkisini kaldır' : 'Öğretmen yetkisi ver') + '</h3>' +
          '<p class="muted" style="font-size:13px;margin:0 0 10px">' + (on
            ? 'Öğretmen: ' + NF(t.classes) + ' açık sınıf, ' + NF(t.students) + ' öğrenci. Yetki kalkınca sınıflar yeni öğrenci almaz; kayıtlar silinmez.'
            : 'Çalışma masasında "sınıflarım" açılır: sınıf kurar, katılım kodu dağıtır, ödev verir. Öğrencinin yalnızca adını, numarasını, bölümünü ve ödev sonuçlarını görür.' + (t.enrolled ? ' Bu hesap ' + NF(t.enrolled) + ' sınıfta öğrenci.' : '')) + '</p>' +
          '<button type="button" class="btn ' + (on ? 'red' : 'green') + ' sm" id="d-teach-b">' + (on ? 'Yetkiyi kaldır' : 'Öğretmen yap') + '</button></div>';
        $('#d-teach-b').addEventListener('click', async function () {
          if (!confirmBox((p.full_name || p.email) + (on ? ' için öğretmen yetkisi kaldırılsın mı?' : ' öğretmen yapılsın mı?'))) return;
          this.disabled = true;
          try { await rpc('admin_set_teacher', { p_id: p.id, p_value: !on }); toast(on ? 'Öğretmen yetkisi kaldırıldı.' : 'Öğretmen yetkisi verildi.'); paintTeach(); }
          catch (e) { this.disabled = false; toast(/admin_set_teacher|could not find|PGRST202/i.test((e && (e.message + e.code)) || '') ? 'Öğretmen yetkisi veritabanında henüz kurulu değil (Faz 6.1 SQL adımı).' : errMsg(e), true); }
        });
      };
      paintTeach();
      var acb = $('#d-acc'); if (acb) acb.addEventListener('click', async function () {
        var to = !p.access_allowed;
        if (!confirmBox((p.full_name || p.email) + (to ? ' için erişim izni verilsin mi?' : ' için erişim kapatılsın mı?'))) return;
        this.disabled = true;
        try { await rpc('admin_set_access', { p_id: p.id, p_value: to }); toast(to ? 'Erişim izni verildi.' : 'Erişim kapatıldı.'); userDetail(p.id); loadUsers(); }
        catch (e) { this.disabled = false; toast(errMsg(e), true); }
      });
      var sb2 = $('#d-susp'); if (sb2) sb2.addEventListener('click', async function () {
        var to = !p.is_suspended, reason = ($('#d-reason') || {}).value || '';
        if (to && !reason.trim()) { toast('Askıya alma sebebini yaz.', true); $('#d-reason').focus(); return; }
        if (!confirmBox((p.full_name || p.email) + (to ? ' askıya alınsın mı?' : ' için askı kaldırılsın mı?'))) return;
        this.disabled = true;
        try { await rpc('admin_set_suspended', { p_id: p.id, p_value: to, p_reason: reason.trim() }); toast(to ? 'Hesap askıya alındı.' : 'Askı kaldırıldı.'); userDetail(p.id); loadUsers(); refreshCounts(); }
        catch (e) { this.disabled = false; toast(errMsg(e), true); }
      });
    } catch (e) { $('#drawer-body').innerHTML = '<p class="err">' + X(errMsg(e)) + '</p>'; }
  };

  /* ---------- şikâyetler ---------- */
  var RS = 'open';
  VIEWS.reports = async function (m) {
    m.innerHTML = '<div class="tools"><div class="tabs" role="group" aria-label="Şikâyet durumu">' + [['open', 'açık'], ['resolved', 'kapatılan'], ['', 'hepsi']].map(function (t) { return '<button type="button" data-rs="' + t[0] + '" aria-pressed="' + (RS === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div><div id="r-list"></div>';
    $$('[data-rs]', m).forEach(function (b) { b.addEventListener('click', function () { RS = b.getAttribute('data-rs'); VIEWS.reports(m); }); });
    var rows = await rpc('admin_reports', { p_status: RS });
    var box = $('#r-list');
    if (!rows.length) { box.innerHTML = '<div class="card empty"><span class="hand">' + (RS === 'open' ? 'kuyruk temiz' : 'kayıt yok') + '</span>' + (RS === 'open' ? 'Açık şikâyet yok. Öğrenciler Sandbox projelerini ve paylaşılan özet kartlarını şikâyet ettiğinde burada görünür.' : '') + '</div>'; return; }
    box.innerHTML = '<div class="list">' + rows.map(function (r) {
      var kind = r.kind === 'sandbox' ? 'Sandbox projesi' : 'Özet kartı';
      return '<div class="item"><div class="item-h"><span class="pill ' + (r.status === 'open' ? 'warn' : 'ok') + '">' + (r.status === 'open' ? 'açık' : 'kapatıldı') + '</span><span class="pill">' + kind + '</span>' + (r.target_hidden ? '<span class="pill bad">gizli</span>' : '') + (r.same_target > 1 ? '<span class="pill bad">' + r.same_target + ' şikâyet</span>' : '') + '<span class="t">' + AGO(r.created_at) + '</span></div>' +
        '<b>' + X(r.target_title || '(silinmiş içerik)') + '</b> <span class="muted" style="font-size:13px">· ' + X(r.owner_name || '?') + '</span>' +
        '<p>' + X(r.reason || '(sebep yazılmamış)') + '</p><p class="muted" style="font-size:12.5px;margin-top:-6px">şikâyet eden: ' + X(r.reporter_name || '?') + (r.resolution ? ' · karar: ' + X(String(r.resolution).replace(/^dismiss/, 'sorun yok').replace(/^hide/, 'gizlendi')) : '') + '</p>' +
        '<div class="acts">' + (r.status === 'open' ? '<button type="button" class="btn red sm" data-ra="hide" data-k="' + r.kind + '" data-id="' + r.id + '">Gizle ve kapat</button><button type="button" class="btn ghost sm" data-ra="dismiss" data-k="' + r.kind + '" data-id="' + r.id + '">Sorun yok, kapat</button>' : '<button type="button" class="btn ghost sm" data-ra="reopen" data-k="' + r.kind + '" data-id="' + r.id + '">Yeniden aç</button>' + (r.target_hidden && r.target_id ? '<button type="button" class="btn ghost sm" data-unhide="' + r.target_id + '" data-k="' + r.kind + '">Görünür yap</button>' : '')) +
        (r.owner_id ? '<button type="button" class="btn ghost sm" data-user="' + r.owner_id + '">sahibini aç</button>' : '') + '</div></div>';
    }).join('') + '</div>';
    $$('[data-ra]', box).forEach(function (b) { b.addEventListener('click', async function () {
      var a = b.getAttribute('data-ra'); var note = '';
      if (a === 'hide' && !confirmBox('İçerik herkesten gizlenecek (sahibi görmeye devam eder) ve şikâyet kapanacak. Devam?')) return;
      b.disabled = true;
      try { await rpc('admin_resolve_report', { p_kind: b.getAttribute('data-k'), p_id: b.getAttribute('data-id'), p_action: a, p_note: note }); toast(a === 'hide' ? 'Gizlendi, şikâyet kapatıldı.' : a === 'dismiss' ? 'Şikâyet kapatıldı.' : 'Yeniden açıldı.'); refreshCounts(); VIEWS.reports(m); }
      catch (e) { b.disabled = false; toast(errMsg(e), true); }
    }); });
    $$('[data-unhide]', box).forEach(function (b) { b.addEventListener('click', async function () { b.disabled = true; try { await rpc('admin_set_hidden', { p_kind: b.getAttribute('data-k'), p_id: b.getAttribute('data-unhide'), p_hidden: false }); toast('İçerik yeniden görünür.'); VIEWS.reports(m); } catch (e) { b.disabled = false; toast(errMsg(e), true); } }); });
    $$('[data-user]', box).forEach(function (b) { b.addEventListener('click', function () { userDetail(b.getAttribute('data-user')); }); });
  };

  /* ---------- planlar (yakında) ---------- */
  VIEWS.plans = async function (m) {
    var s = await rpc('admin_settings');
    m.innerHTML = '<div class="card ink soon-card"><span class="hand">yakında</span><h2 class="disp" style="font-size:24px;margin:6px 0">Planlar ve kota</h2><p class="muted" style="max-width:520px;margin:0 auto 18px">Lite/premium sınırlarını düzenleme, öğrenci bazında kota verme ve sınıra yaklaşanları görme buraya gelecek. Şimdilik mevcut sınırlar:</p>' +
      '<div class="tbl-w" style="max-width:560px;margin:0 auto;text-align:left"><table><thead><tr><th>Plan</th><th>Aylık sayfa</th><th>Belge başına en çok</th><th>Görsel analiz</th></tr></thead><tbody>' + (s.plans || []).map(function (p) { return '<tr><td><b>' + X(p.plan) + '</b></td><td>' + NF(p.monthly_pages) + '</td><td>' + NF(p.max_pages_per_doc) + '</td><td>' + (p.visual_analysis ? 'var' : 'yok') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  };

  /* ---------- içerik ---------- */
  var CK = 'documents', CQ = '', COFF = 0;
  VIEWS.content = async function (m) {
    m.innerHTML = '<div class="tools"><div class="tabs" role="group" aria-label="İçerik türü"><button type="button" data-ck="documents" aria-pressed="' + (CK === 'documents') + '">Belgeler</button><button type="button" data-ck="cards" aria-pressed="' + (CK === 'cards') + '">Özet kartları</button></div><label class="fld grow">Ara<input class="in" id="c-q" placeholder="dosya adı" value="' + X(CQ) + '"></label></div><div id="c-list"></div>';
    $$('[data-ck]', m).forEach(function (b) { b.addEventListener('click', function () { CK = b.getAttribute('data-ck'); COFF = 0; VIEWS.content(m); }); });
    var t = 0; $('#c-q').addEventListener('input', function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { CQ = v.trim(); COFF = 0; loadContent(); }, 300); });
    await loadContent();
  };
  var STATUS = { summarized: ['özetlendi', 'ok'], uploaded: ['yüklendi', ''], processing: ['işleniyor', 'warn'], failed: ['hata', 'bad'] };
  var loadContent = async function () {
    var box = $('#c-list'); if (!box) return;
    var d = await rpc('admin_content', { p_kind: CK, p_q: CQ, p_limit: 50, p_offset: COFF }), rows = d.rows || [];
    if (!rows.length) { box.innerHTML = '<div class="card empty"><span class="hand">burada bir şey yok</span></div>'; return; }
    if (CK === 'documents') {
      box.innerHTML = '<div class="tbl-w"><table><thead><tr><th>Belge</th><th>Sahibi</th><th>Durum</th><th class="hide-sm">Boyut</th><th>Yüklendi</th></tr></thead><tbody>' + rows.map(function (r) { var s = STATUS[r.status] || [r.status, '']; return '<tr><td><b>' + X(r.title) + '</b>' + (r.processing_stage ? '<br><small class="muted">' + X(r.processing_stage) + '</small>' : '') + '</td><td><button type="button" class="lnk" data-user="' + r.user_id + '">' + X(r.owner_name || '?') + '</button></td><td><span class="pill ' + s[1] + '">' + X(s[0]) + '</span>' + (r.has_card ? '' : ' <span class="pill">kart yok</span>') + '</td><td class="hide-sm">' + SIZE(r.file_size) + '</td><td>' + AGO(r.created_at) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    } else {
      box.innerHTML = '<div class="tbl-w"><table><thead><tr><th>Özet kartı</th><th>Sahibi</th><th class="hide-sm">Stil / dil</th><th>Bölüm akışı</th><th>Oluşturuldu</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td><b>' + X(r.title) + '</b></td><td><button type="button" class="lnk" data-user="' + r.user_id + '">' + X(r.owner_name || '?') + '</button></td><td class="hide-sm">' + X(r.summary_style || '—') + ' · ' + X((r.summary_language || '').toUpperCase()) + '</td><td>' + (r.is_shared ? '<span class="pill ok">paylaşılıyor</span> <button type="button" class="lnk" data-hide="' + r.id + '">gizle</button>' : '<span class="pill">paylaşılmıyor</span>') + '</td><td>' + AGO(r.created_at) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    box.insertAdjacentHTML('beforeend', '<div class="pager"><span>' + NF(d.total) + ' kayıttan ' + (COFF + 1) + '–' + (COFF + rows.length) + '</span><span><button type="button" class="btn ghost sm" id="c-prev"' + (COFF ? '' : ' disabled') + '>← önceki</button> <button type="button" class="btn ghost sm" id="c-next"' + (COFF + rows.length < d.total ? '' : ' disabled') + '>sonraki →</button></span></div>');
    $('#c-prev').addEventListener('click', function () { COFF = Math.max(0, COFF - 50); loadContent(); });
    $('#c-next').addEventListener('click', function () { COFF += 50; loadContent(); });
    $$('[data-user]', box).forEach(function (b) { b.addEventListener('click', function () { userDetail(b.getAttribute('data-user')); }); });
    $$('[data-hide]', box).forEach(function (b) { b.addEventListener('click', async function () { if (!confirmBox('Bu kart bölüm akışından kaldırılsın mı? Öğrenci kartını görmeye devam eder.')) return; b.disabled = true; try { await rpc('admin_set_hidden', { p_kind: 'card', p_id: b.getAttribute('data-hide'), p_hidden: true }); toast('Kart bölüm akışından kaldırıldı.'); loadContent(); } catch (e) { b.disabled = false; toast(errMsg(e), true); } }); });
  };

  /* ---------- gelen kutusu ---------- */
  VIEWS.inbox = async function (m) {
    var d = await rpc('admin_messages', { p_limit: 100, p_offset: 0 }), rows = d.rows || [];
    if (!rows.length) { m.innerHTML = '<div class="card empty"><span class="hand">gelen kutusu boş</span>İletişim formundan gelen mesajlar burada görünür.</div>'; return; }
    m.innerHTML = '<div class="list">' + rows.map(function (r) { return '<div class="item' + (r.is_read ? '' : ' unread') + '" data-mid="' + r.id + '"><div class="item-h"><b>' + X(r.name || 'isimsiz') + '</b><span class="muted" style="font-size:13px">' + X(r.email) + '</span><span class="t">' + DT(r.created_at, true) + '</span></div><p>' + X(r.message) + '</p><div class="acts"><a class="btn sm" href="mailto:' + X(r.email) + '?subject=' + encodeURIComponent('Acadex: mesajın hakkında') + '">yanıtla</a><button type="button" class="btn ghost sm" data-read="' + (r.is_read ? '0' : '1') + '">' + (r.is_read ? 'okunmadı işaretle' : 'okundu işaretle') + '</button></div></div>'; }).join('') + '</div>';
    $$('[data-read]', m).forEach(function (b) { b.addEventListener('click', async function () { var it = b.closest('[data-mid]'); b.disabled = true; try { await rpc('admin_message_read', { p_id: it.getAttribute('data-mid'), p_read: b.getAttribute('data-read') === '1' }); refreshCounts(); VIEWS.inbox(m); } catch (e) { b.disabled = false; toast(errMsg(e), true); } }); });
  };

  /* ---------- canlı destek (28.10.2026) ----------
     Landing'deki Acadia destek hattından (js/acadex-destek.js) ekibe aktarılan görüşmeler.
     supabase/migrations/20261028_canli_destek.sql: admin_support_threads / _thread / _reply /
     _set_status / _presence. "Çevrimiçiyim" açıkken panel her 15 sn nabız atar; ziyaretçi
     tarafı son 3 dakikada nabız atan yönetici varsa "ekip çevrimiçi" gösterir.
     Yeni mesajda: menüde rozet, sekme başlığında sayı, kısa ses ve tarayıcı bildirimi. */
  var SUP = { unread: 0, online: false, latest: null, cur: null, filter: 'open', last: 0, t: 0, view: 0, base: '', rendered: null, lastId: 0, drafts: {} };
  var supBeep = function () {
    try { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var c = SUP.ac || (SUP.ac = new A()); [0, 0.16].forEach(function (d, i) { var o = c.createOscillator(), g = c.createGain(); o.frequency.value = i ? 1046 : 784; g.gain.setValueAtTime(0.0001, c.currentTime + d); g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d + 0.22); o.connect(g); g.connect(c.destination); o.start(c.currentTime + d); o.stop(c.currentTime + d + 0.25); }); } catch (e) {}
  };
  var supTitle = function () { var b = document.title.replace(/^\(\d+\)\s*/, ''); document.title = (SUP.unread ? '(' + SUP.unread + ') ' : '') + b; };
  var supPulse = async function (setOnline) {
    try {
      var r = await rpc('admin_support_presence', { p_online: typeof setOnline === 'boolean' ? setOnline : null });
      var before = SUP.unread, beforeLatest = SUP.latest;
      SUP.online = !!r.online; SUP.unread = +r.unread || 0; SUP.latest = r.latest;
      COUNTS.support_unread = SUP.unread; paintNav(); supTitle();
      if (SUP.unread > before || (SUP.unread && r.latest && beforeLatest && r.latest !== beforeLatest)) {
        supBeep();
        if (window.Notification && Notification.permission === 'granted' && (document.hidden || CUR !== 'support')) { try { var n = new Notification('Acadex · canlı destek', { body: SUP.unread + ' okunmamış destek mesajı', icon: 'assets/logo-icon-only.png', tag: 'acadex-destek' }); n.onclick = function () { window.focus(); go('support'); n.close(); }; } catch (e) {} }
        if (CUR === 'support') supList();
      }
      var sw = document.getElementById('sup-on'); if (sw) sw.checked = SUP.online;
    } catch (e) { /* tablo henüz yoksa sessiz */ }
  };
  setInterval(function () { if (ME) supPulse(); }, 15000);
  var supWhen = function (d) { if (!d) return ''; var x = new Date(d), s = (Date.now() - x) / 1000; if (s < 60) return 'şimdi'; if (s < 3600) return Math.floor(s / 60) + ' dk'; if (s < 86400) return Math.floor(s / 3600) + ' sa'; return DT(d); };
  var supList = async function () {
    var box = document.getElementById('sup-list'); if (!box) return;
    var rows = await rpc('admin_support_threads', { p_status: SUP.filter, p_limit: 150 });
    box.innerHTML = rows.length ? rows.map(function (t) {
      var last = t.last ? (t.last.s === 'admin' ? 'sen: ' : t.last.s === 'bot' ? 'Acadia: ' : '') + t.last.b : '';
      return '<button type="button" class="sup-row' + (t.admin_unread ? ' unread' : '') + '" data-sup="' + t.id + '"' + (SUP.cur === t.id ? ' aria-current="true"' : '') + '><span class="sup-rh"><b>' + X(t.name || t.email || 'ziyaretçi') + '</b><span class="t">' + supWhen(t.last_msg_at) + '</span></span>' +
        '<span class="sup-rl">' + X(last) + '</span><span class="sup-rt">' + (t.topic ? '<span class="pill">' + X(t.topic) + '</span>' : '') + (t.status === 'closed' ? '<span class="pill">kapalı</span>' : '') + (t.admin_unread ? '<span class="badge">' + t.admin_unread + '</span>' : '') + '</span></button>';
    }).join('') : '<p class="muted" style="padding:16px">' + (SUP.filter === 'open' ? 'açık görüşme yok. destek hattı sessiz.' : 'görüşme yok.') + '</p>';
  };
  /* görüşme bölmesi: ilk açılışta bir kez çizilir; yenilemede yalnız başlık güncellenir ve
     yeni mesajlar sona eklenir. Cevap kutusuna dokunulmaz (yazarken odak ve imleç kaybolmaz). */
  var supMsgHtml = function (m, t) {
    if (m.s === 'system') return '<div class="sup-sys" data-mid="' + m.id + '">' + X(m.b) + '</div>';
    return '<div class="sup-m sup-' + m.s + '" data-mid="' + m.id + '"><span class="sup-who">' + (m.s === 'admin' ? 'Acadex ekibi' : m.s === 'bot' ? 'Acadia (otomatik)' : X(t.name || 'ziyaretçi')) + ' · ' + DT(m.t, true) + '</span><p>' + X(m.b) + '</p></div>';
  };
  var supHead = function (t) {
    var seenAgo = t.last_visitor_seen ? (Date.now() - new Date(t.last_visitor_seen)) / 1000 : 1e9;
    return '<header class="sup-ph"><div><h2>' + X(t.name || 'ziyaretçi') + ' ' + (seenAgo < 60 ? '<span class="pill ok">sayfada</span>' : '') + '</h2><p class="muted">' + (t.email ? '<a href="mailto:' + X(t.email) + '?subject=' + encodeURIComponent('Acadex destek') + '">' + X(t.email) + '</a> · ' : 'e-posta yok · ') + (t.topic ? X(t.topic) + ' · ' : '') + X(t.page || '') + ' · ' + DT(t.created_at, true) + '</p></div>' +
      '<div class="sup-pa">' + (t.status === 'open' ? '<button type="button" class="btn ghost sm" data-sup-st="closed">görüşmeyi kapat</button>' : '<button type="button" class="btn ghost sm" data-sup-st="open">yeniden aç</button>') + '</div></header>';
  };
  var supBindHead = function (pane, id) {
    $$('[data-sup-st]', pane).forEach(function (b) { b.addEventListener('click', async function () { b.disabled = true; try { await rpc('admin_support_set_status', { p_id: id, p_status: b.getAttribute('data-sup-st') }); await supOpen(id, true); supList(); } catch (er) { b.disabled = false; toast(errMsg(er), true); } }); });
  };
  var supOpen = async function (id, refresh) {
    var pane = document.getElementById('sup-pane'); if (!pane) return;
    var same = refresh && SUP.rendered === id && pane.querySelector('.sup-log');
    if (!same) SUP.cur = id;
    var d = await rpc('admin_support_thread', { p_id: id }), t = d.thread, ms = d.messages || [];
    if (SUP.cur !== id) return; /* bu arada başka görüşme seçildi */
    pane = document.getElementById('sup-pane'); if (!pane) return;
    if (same && pane.querySelector('.sup-log')) {
      var log = pane.querySelector('.sup-log'), atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 60, added = 0;
      ms.forEach(function (m) { if (m.id > SUP.lastId) { log.insertAdjacentHTML('beforeend', supMsgHtml(m, t)); SUP.lastId = m.id; added++; } });
      if (added && atEnd) log.scrollTop = log.scrollHeight;
      var oh = pane.querySelector('.sup-ph'), nh = supHead(t);
      if (oh && oh.outerHTML !== nh) { oh.outerHTML = nh; supBindHead(pane, id); }
      var ta0 = pane.querySelector('#sup-txt'); if (ta0) ta0.placeholder = t.status === 'closed' ? 'yazarsan görüşme yeniden açılır…' : 'cevabını yaz · Enter gönderir, Shift+Enter alt satır';
      if (added) supPulse();
      return;
    }
    SUP.rendered = id; SUP.lastId = ms.reduce(function (a, m) { return Math.max(a, m.id); }, 0);
    pane.innerHTML = supHead(t) + '<div class="sup-log">' + ms.map(function (m) { return supMsgHtml(m, t); }).join('') + '</div>' +
      '<form class="sup-reply" id="sup-form"><textarea class="in" id="sup-txt" rows="2" maxlength="2000" placeholder="' + (t.status === 'closed' ? 'yazarsan görüşme yeniden açılır…' : 'cevabını yaz · Enter gönderir, Shift+Enter alt satır') + '"></textarea><button type="submit" class="btn blue">gönder</button></form>';
    var nl = pane.querySelector('.sup-log'); nl.scrollTop = nl.scrollHeight;
    var ta = pane.querySelector('#sup-txt'), draft = SUP.drafts[id]; if (draft) ta.value = draft;
    ta.addEventListener('input', function () { SUP.drafts[id] = ta.value; });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); pane.querySelector('#sup-form').requestSubmit(); } });
    pane.querySelector('#sup-form').addEventListener('submit', async function (e) {
      e.preventDefault(); var v = ta.value.trim(); if (!v) return; var b = this.querySelector('button'); b.disabled = true;
      try { await rpc('admin_support_reply', { p_id: id, p_body: v }); ta.value = ''; delete SUP.drafts[id]; await supOpen(id, true); supList(); }
      catch (er) { toast(errMsg(er), true); }
      b.disabled = false; ta.focus();
    });
    supBindHead(pane, id);
    $$('.sup-row', document).forEach(function (r) { r.setAttribute('aria-current', String(r.getAttribute('data-sup') === id)); });
    supPulse();
  };
  VIEWS.support = async function (m) {
    m.innerHTML = '<div class="sup-top card"><label class="switch"><input type="checkbox" id="sup-on"' + (SUP.online ? ' checked' : '') + '><i></i>Çevrimiçiyim</label><span class="muted" style="font-size:13px">açıkken ziyaretçiler “ekip çevrimiçi” görür. panel kapanınca 3 dk içinde kendiliğinden çevrimdışı olursun.</span>' +
      '<span style="flex:1"></span>' + (window.Notification && Notification.permission !== 'granted' ? '<button type="button" class="btn ghost sm" id="sup-notif">tarayıcı bildirimlerini aç</button>' : '') + '</div>' +
      '<div class="sup-grid"><aside class="sup-side card"><div class="sup-tabs" role="tablist">' + [['open', 'açık'], ['closed', 'kapalı'], ['all', 'tümü']].map(function (f) { return '<button type="button" role="tab" data-sup-f="' + f[0] + '" aria-selected="' + (SUP.filter === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div><div id="sup-list" class="sup-list"></div></aside>' +
      '<section class="sup-pane card" id="sup-pane"><div class="empty"><span class="hand">bir görüşme seç</span>Landing’deki Acadia’nın ekibe aktardığı sorular burada.</div></section></div>';
    document.getElementById('sup-on').addEventListener('change', function () { var on = this.checked; supPulse(on).then(function () { toast(on ? 'Çevrimiçisin; yeni mesajlar sesle bildirilir.' : 'Çevrimdışısın.'); }); if (on && window.Notification && Notification.permission === 'default') Notification.requestPermission(); });
    var nb = document.getElementById('sup-notif'); if (nb) nb.addEventListener('click', function () { Notification.requestPermission().then(function () { nb.remove(); }); });
    m.querySelector('.sup-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-sup-f]'); if (!b) return; SUP.filter = b.getAttribute('data-sup-f'); $$('[data-sup-f]', m).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); supList(); });
    m.querySelector('#sup-list').addEventListener('click', function (e) { var r = e.target.closest('[data-sup]'); if (r) { SUP.cur = r.getAttribute('data-sup'); supOpen(SUP.cur).catch(function (er) { toast(errMsg(er), true); }); } });
    await supList();
    if (SUP.cur) supOpen(SUP.cur).catch(function () { SUP.cur = null; });
    var my = ++SUP.view;
    SUP.rendered = null;
    var refresh = function () { supList().catch(function () {}); if (SUP.cur) supOpen(SUP.cur, true).catch(function () {}); };
    var loop = function () { clearTimeout(SUP.t); if (CUR !== 'support' || my !== SUP.view) return; refresh(); SUP.t = setTimeout(loop, document.hidden ? 10000 : 3000); };
    SUP.t = setTimeout(loop, 3000);
    if (!SUP.visHook) { SUP.visHook = true; document.addEventListener('visibilitychange', function () { if (!document.hidden && CUR === 'support') { refresh(); supPulse(); } }); }
    supPulse();
  };

  /* ---------- telefon bildirimleri (29.10.2026) ----------
     Salt okunur izleme: admin_push_stats + admin_push_feed
     (supabase/migrations/20261029b_push_admin.sql). Cihaz adresi ve anahtarı
     hiç gelmez. 15 sn'de bir (sekme gizliyken 60 sn) yalnız VERİ alanları
     yenilenir; süzgeç kutuları yeniden çizilmez, odak ve yazılan kaybolmaz. */
  var PSH = { state: 'all', kind: 'all', q: '', t: 0, view: 0, qT: 0 };
  var PSH_KIND = { like: 'Beğeni', comment: 'Yorum', support: 'Destek cevabı', study: 'Çalışma hatırlatması', review: 'Kart tekrarı', exam: 'Yarınki sınav', test: 'Deneme' };
  var PSH_STATE = { gitti: ['ok', 'gitti'], bekliyor: ['blue', 'bekliyor'], hata: ['warn', 'hata · yeniden denenecek'], vazgecildi: ['bad', 'gönderilemedi'], atlandi: ['', 'atlandı'] };
  var PSH_PLAT = { apple: 'iPhone / Mac', google: 'Android / Chrome', mozilla: 'Firefox', windows: 'Windows', diger: 'Diğer' };
  var PSH_SKIP = { eskidi: '1 günden eski, gönderilmedi', goruldu: 'ziyaretçi mesajı zaten okumuştu' };
  var ago = function (d) {
    if (!d) return '—'; var s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 0) return Math.round(-s) + ' sn sonra'; if (s < 60) return s + ' sn önce'; if (s < 3600) return Math.round(s / 60) + ' dk önce';
    if (s < 86400) return Math.round(s / 3600) + ' sa önce'; return DT(d, true);
  };
  var pshChart = function (series) {
    var W = 760, H = 150, L = 30, R = 10, T = 10, B = 24, n = series.length || 1;
    var max = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.ok + s.err; })));
    var top = Math.max(4, Math.ceil(max / 4) * 4), step = top / 4;
    var x = function (i) { return L + (W - L - R) * i / n; }, y = function (v) { return T + (H - T - B) * (1 - v / top); }, bw = (W - L - R) / n * .7;
    var grid = ''; for (var g = 0; g <= 4; g++) { var gy = y(g * step); grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" stroke="#E3DECF"/><text x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="#6A7593">' + Math.round(g * step) + '</text>'; }
    var bars = series.map(function (s, i) {
      var hh = new Date(s.h).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      return '<rect x="' + (x(i) + 2) + '" y="' + y(s.ok) + '" width="' + bw + '" height="' + (y(0) - y(s.ok)) + '" rx="2" fill="#2E9E6B"><title>' + hh + ': ' + s.ok + ' gitti</title></rect>' +
        (s.err ? '<rect x="' + (x(i) + 2) + '" y="' + y(s.ok + s.err) + '" width="' + bw + '" height="' + (y(s.ok) - y(s.ok + s.err)) + '" rx="2" fill="#C9483B"><title>' + hh + ': ' + s.err + ' hata</title></rect>' : '') +
        (i % 4 === 0 || i === n - 1 ? '<text x="' + (x(i) + 2 + bw / 2) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="11" fill="#6A7593">' + hh + '</text>' : '');
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Son 24 saatte saat saat giden ve hatalı bildirim sayısı">' + grid + bars + '</svg>';
  };
  var pshHealth = function (h, l24) {
    var rows = [], now = Date.now();
    var cronOk = function (j) { if (!j) return ['bad', 'kurulu değil']; if (!j.active) return ['bad', 'kapalı']; if (j.status && j.status !== 'succeeded') return ['bad', 'son çalışma başarısız · ' + ago(j.last)]; return j.last ? ['ok', 'çalışıyor · ' + ago(j.last)] : ['warn', 'henüz çalışmadı']; };
    var cj = function (n) { return (h.cron || []).filter(function (j) { return j.job === n; })[0]; };
    var f = cronOk(cj('push-flush')), d = cronOk(cj('push-daily'));
    var oldest = h.oldest_pending ? (now - new Date(h.oldest_pending).getTime()) / 1000 : 0;
    rows.push(['Gönderim zamanlayıcısı (her dakika)', f]);
    rows.push(['Hatırlatma zamanlayıcısı (15 dk)', d]);
    rows.push(['Kasadaki gizli anahtar', h.secret ? ['ok', 'kayıtlı'] : ['bad', 'yok · bildirim gönderilemez']]);
    rows.push(['Bekleyen kuyruk', !h.oldest_pending ? ['ok', 'boş'] : oldest > 180 ? ['bad', 'en eskisi ' + ago(h.oldest_pending) + ' · takılmış olabilir'] : ['blue', 'en eskisi ' + ago(h.oldest_pending)]]);
    rows.push(['Son başarılı gönderim', h.last_ok ? ['ok', ago(h.last_ok)] : ['', 'henüz yok']]);
    if (h.last_error) rows.push(['Son hata', [(now - new Date(h.last_error.t).getTime()) < 3600e3 ? 'warn' : '', ago(h.last_error.t) + ' · ' + X(h.last_error.e)]]);
    var bad = rows.some(function (r) { return r[1][0] === 'bad'; });
    return '<div class="psh-health"><span class="pill ' + (bad ? 'bad' : 'ok') + '">' + (bad ? 'dikkat gerekiyor' : 'sistem sağlıklı') + '</span>' +
      (l24.avg_sec != null ? '<span class="psh-s">ortalama gönderim süresi ' + String(l24.avg_sec).replace('.', ',') + ' sn</span>' : '') +
      '<dl class="kv">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd><span class="pill ' + r[1][0] + '">' + r[1][1] + '</span></dd>'; }).join('') + '</dl></div>';
  };
  var pshFeed = function (rows) {
    if (!rows.length) return '<div class="empty">' + (PSH.state !== 'all' || PSH.kind !== 'all' || PSH.q ? 'Bu süzgeçle bildirim yok.' : 'Henüz bildirim gönderilmedi. Biri telefonundan bildirimi açıp bir olay olunca burada görünür.') + '</div>';
    return '<table><thead><tr><th>Zaman</th><th>Kime</th><th>Tür</th><th>Bildirim</th><th>Sonuç</th></tr></thead><tbody>' + rows.map(function (r) {
      var st = PSH_STATE[r.state] || ['', r.state], who = r.visitor ? '<span class="muted">ziyaretçi ·</span> ' + X(r.visitor) : r.user_id ? '<button type="button" class="lnk" data-user="' + X(r.user_id) + '">' + X(r.user_name || 'kullanıcı') + '</button>' : '—';
      var why = r.state === 'atlandi' ? (PSH_SKIP[r.error] || X(r.error || '')) : r.error ? X(r.error) : r.state === 'gitti' && r.sent_at ? Math.max(0, Math.round((new Date(r.sent_at) - new Date(r.send_after)) / 1000)) + ' sn içinde' : r.state === 'bekliyor' && new Date(r.send_after) > Date.now() ? 'gönderim ' + ago(r.send_after) : '';
      return '<tr><td style="white-space:nowrap" title="' + X(DT(r.created_at, true)) + '">' + ago(r.created_at) + '</td><td>' + who + '<div class="psh-s">' + X(PSH_PLAT[r.platform] || r.platform) + '</div></td>' +
        '<td>' + X(PSH_KIND[r.kind] || r.kind) + (r.n > 1 ? ' <span class="pill">×' + r.n + '</span>' : '') + '</td>' +
        '<td class="psh-msg"><b>' + X(r.title) + '</b><div class="muted">' + X(r.body) + '</div></td>' +
        '<td><span class="pill ' + st[0] + '">' + st[1] + '</span>' + (why ? '<div class="psh-s">' + why + (r.tries > 1 && r.state !== 'gitti' ? ' · ' + r.tries + '. deneme' : '') + '</div>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
  };
  VIEWS.push = async function (m) {
    var my = ++PSH.view;
    m.innerHTML = '<div id="psh-top"><div class="card"><div class="skel" style="width:40%"></div><div class="skel" style="margin-top:12px"></div></div></div>' +
      '<div class="card psh-feed-c"><div class="psh-feed-h"><div><h2>Bildirim akışı</h2><p class="sub">Son 14 gün · en yeni üstte · <span id="psh-at">yükleniyor</span></p></div>' +
      '<div class="tools"><label class="fld">Sonuç<select class="in" id="psh-st"><option value="all">hepsi</option><option value="gitti">gitti</option><option value="bekliyor">bekliyor</option><option value="hata">hatalı</option><option value="atlandi">atlandı</option></select></label>' +
      '<label class="fld">Tür<select class="in" id="psh-k"><option value="all">hepsi</option>' + Object.keys(PSH_KIND).map(function (k) { return '<option value="' + k + '">' + PSH_KIND[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Ara<input class="in" id="psh-q" type="search" placeholder="kişi, e-posta, başlık" autocomplete="off"></label></div></div>' +
      '<div class="tbl-w" id="psh-feed"><div class="empty">yükleniyor…</div></div></div>';
    $('#psh-st').value = PSH.state; $('#psh-k').value = PSH.kind; $('#psh-q').value = PSH.q;
    var refresh = async function () {
      if (my !== PSH.view || CUR !== 'push') return;
      var res = await Promise.all([rpc('admin_push_stats'), rpc('admin_push_feed', { p_state: PSH.state, p_kind: PSH.kind, p_q: PSH.q || null, p_limit: 150 })]);
      if (my !== PSH.view || CUR !== 'push') return;
      var s = res[0] || {}, sb = s.subs || {}, l = s.last24 || {}, pf = s.prefs_off || {}, plat = sb.by_platform || {};
      var k = function (label, val, sub, alert) { return '<div class="kpi' + (alert ? ' alert' : '') + '"><div class="k">' + label + '</div><div class="v">' + NF(val) + '</div><div class="s">' + sub + '</div></div>'; };
      var platTxt = Object.keys(plat).sort(function (a, b) { return plat[b] - plat[a]; }).map(function (p) { return NF(plat[p]) + ' ' + (PSH_PLAT[p] || p); }).join(' · ') || 'henüz yok';
      $('#psh-top').innerHTML = '<div class="kpis">' +
        k('Bildirim açık cihaz', sb.total, NF(sb.users) + ' kişi · ' + NF(sb.visitors) + ' destek ziyaretçisi · +' + NF(sb.new_7d) + ' son 7 gün') +
        k('Son 24 saatte giden', l.gitti, NF(l.total) + ' bildirim oluştu · ' + NF(l.atlandi) + ' atlandı') +
        k('Bekleyen', l.bekliyor, l.bekliyor ? 'sırada, birazdan gider' : 'kuyruk boş') +
        k('Hatalı (24 saat)', l.hata, NF(sb.failing) + ' cihazda tekrarlayan hata', l.hata > 0) + '</div>' +
        '<div class="grid g-wide"><div class="card"><h2>Son 24 saat</h2><p class="sub">Saat saat giden ve hatalı bildirim</p>' + pshChart(s.series || []) +
        '<div class="legend"><span><i style="background:#2E9E6B"></i>gitti</span><span><i style="background:#C9483B"></i>hata</span></div></div>' +
        '<div class="card"><h2>Sistem sağlığı</h2>' + pshHealth(s.health || {}, l) + '</div></div>' +
        '<div class="grid g2"><div class="card"><h2>Bildirim türleri</h2><p class="sub">Son 24 saat · cihazlar: ' + platTxt + '</p><div class="bars">' +
        Object.keys(PSH_KIND).filter(function (x) { return (l.by_kind || {})[x]; }).map(function (x) { var n = l.by_kind[x]; return '<div class="bar"><span>' + PSH_KIND[x] + '</span><span class="t"><i style="width:' + Math.round(n / Math.max(1, l.total) * 100) + '%"></i></span><b>' + NF(n) + '</b></div>'; }).join('') +
        ((l.total || 0) ? '' : '<p class="muted">Son 24 saatte bildirim yok.</p>') + '</div></div>' +
        '<div class="card"><h2>Kapatılan bildirimler</h2><p class="sub">Bildirim açık kişilerden kaçı hangi türü kapattı</p><div class="bars">' +
        [['likes', 'Beğeni'], ['comments', 'Yorum'], ['study', 'Çalışma hatırlatması'], ['review', 'Kart tekrarı']].map(function (x) { var n = pf[x[0]] || 0; return '<div class="bar"><span>' + x[1] + '</span><span class="t"><i style="width:' + Math.round(n / Math.max(1, sb.users) * 100) + '%;background:#C9483B"></i></span><b>' + NF(n) + '</b></div>'; }).join('') + '</div></div></div>';
      var fe = $('#psh-feed'), sc = fe.scrollTop;
      fe.innerHTML = pshFeed(res[1] || []); fe.scrollTop = sc;
      $$('[data-user]', fe).forEach(function (b) { b.addEventListener('click', function () { userDetail(b.getAttribute('data-user')); }); });
      $('#psh-at').textContent = 'canlı · ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' güncellendi';
    };
    var loop = function () {
      clearTimeout(PSH.t); if (my !== PSH.view || CUR !== 'push') return;
      refresh().catch(function (e) { var a = $('#psh-at'); if (a) a.textContent = 'güncellenemedi: ' + errMsg(e); })
        .then(function () { clearTimeout(PSH.t); if (my === PSH.view && CUR === 'push') PSH.t = setTimeout(loop, document.hidden ? 60000 : 15000); });
    };
    $('#psh-st').addEventListener('change', function () { PSH.state = this.value; loop(); });
    $('#psh-k').addEventListener('change', function () { PSH.kind = this.value; loop(); });
    $('#psh-q').addEventListener('input', function () { var v = this.value.trim(); clearTimeout(PSH.qT); PSH.qT = setTimeout(function () { PSH.q = v; loop(); }, 350); });
    if (!PSH.visHook) { PSH.visHook = true; document.addEventListener('visibilitychange', function () { if (!document.hidden && CUR === 'push') loop(); }); }
    await refresh(); clearTimeout(PSH.t); PSH.t = setTimeout(loop, 15000); /* ilk yükleme hatası görünümün kendi hata kartına düşer */
  };

  /* ---------- duyurular ---------- */
  var localIn = function (d) { if (!d) return ''; var x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  VIEWS.news = async function (m, edit) {
    var rows = await rpc('admin_announcements'), e = edit || {};
    m.innerHTML = '<div class="grid g-news"><form class="card ink" id="n-form" novalidate><h2>' + (e.id ? 'Duyuruyu düzenle' : 'Yeni duyuru') + '</h2><p class="sub">Öğrencilerin bildirimlerinde ve panelde görünür.</p>' +
      '<div style="display:flex;flex-direction:column;gap:12px"><label class="fld">Başlık<input class="in" name="t" maxlength="120" required value="' + X(e.title || '') + '"></label><label class="fld">Metin<textarea class="in" name="b" maxlength="2000">' + X(e.body || '') + '</textarea></label>' +
      '<label class="fld">Kime<select class="in" name="d"><option value="">tüm öğrenciler</option>' + Object.keys(DEPTS).map(function (d) { return '<option value="' + X(d) + '"' + (e.audience_department === d ? ' selected' : '') + '>' + X(DEPTS[d]) + '</option>'; }).join('') + '</select></label>' +
      '<div class="grid g2" style="gap:10px"><label class="fld">Başlangıç <small>(boş = hemen)</small><input class="in" type="datetime-local" name="s" value="' + localIn(e.starts_at) + '"></label><label class="fld">Bitiş <small>(boş = süresiz)</small><input class="in" type="datetime-local" name="e" value="' + localIn(e.ends_at) + '"></label></div>' +
      '<label class="switch"><input type="checkbox" name="a"' + (e.id ? (e.active ? ' checked' : '') : ' checked') + '><i></i>yayında</label>' +
      '<div class="acts"><button class="btn blue" type="submit">' + (e.id ? 'Kaydet' : 'Yayınla') + '</button>' + (e.id ? '<button type="button" class="btn ghost" id="n-cancel">vazgeç</button>' : '') + '</div></div></form>' +
      '<div><div class="list" id="n-list">' + (rows.length ? rows.map(function (r) { var now = Date.now(), live = r.active && (!r.starts_at || new Date(r.starts_at) <= now) && (!r.ends_at || new Date(r.ends_at) > now); return '<div class="item"><div class="item-h"><span class="pill ' + (live ? 'ok' : '') + '">' + (live ? 'yayında' : r.active ? 'zamanlandı / bitti' : 'taslak') + '</span><span class="pill">' + X(r.audience_department ? DEPTS[r.audience_department] || r.audience_department : 'herkes') + '</span><span class="t">' + DT(r.created_at) + '</span></div><b>' + X(r.title) + '</b><p>' + X(r.body || '') + '</p>' + (r.starts_at || r.ends_at ? '<p class="muted" style="font-size:12.5px;margin-top:-6px">' + (r.starts_at ? DT(r.starts_at, true) : 'hemen') + ' → ' + (r.ends_at ? DT(r.ends_at, true) : 'süresiz') + '</p>' : '') + '<div class="acts"><button type="button" class="btn ghost sm" data-nedit="' + r.id + '">düzenle</button><button type="button" class="btn ghost sm" data-narch="' + r.id + '">arşivle</button></div></div>'; }).join('') : '<div class="card empty"><span class="hand">henüz duyuru yok</span></div>') + '</div></div></div>';
    var f = $('#n-form');
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault(); if (!f.t.value.trim()) { toast('Başlık yaz.', true); f.t.focus(); return; }
      var b = $('button[type=submit]', f); b.disabled = true;
      try { await rpc('admin_announce_save', { p_id: e.id || null, p_title: f.t.value.trim(), p_body: f.b.value.trim(), p_dept: f.d.value, p_active: f.a.checked, p_starts: f.s.value ? new Date(f.s.value).toISOString() : null, p_ends: f.e.value ? new Date(f.e.value).toISOString() : null }); toast(e.id ? 'Duyuru güncellendi.' : 'Duyuru yayınlandı.'); VIEWS.news(m); }
      catch (er) { b.disabled = false; toast(errMsg(er), true); }
    });
    var cn = $('#n-cancel'); if (cn) cn.addEventListener('click', function () { VIEWS.news(m); });
    $$('[data-nedit]', m).forEach(function (b) { b.addEventListener('click', function () { var r = rows.filter(function (x) { return x.id === b.getAttribute('data-nedit'); })[0]; VIEWS.news(m, r); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
    $$('[data-narch]', m).forEach(function (b) { b.addEventListener('click', async function () { if (!confirmBox('Duyuru arşivlensin mi? Öğrenciler artık görmez.')) return; b.disabled = true; try { await rpc('admin_announce_archive', { p_id: b.getAttribute('data-narch') }); toast('Arşivlendi.'); VIEWS.news(m); } catch (er) { b.disabled = false; toast(errMsg(er), true); } }); });
  };

  /* ---------- site ayarları ---------- */
  VIEWS.settings = async function (m) {
    var s = await rpc('admin_settings'), st = s.settings || {}; SETTINGS_CACHE = st;
    var mm = st.maintenance_mode || {}, bn = st.site_banner || {}, rd = st.registration_domains || {}, rf = st.registration_freeze || null;
    m.innerHTML = '<div class="grid g2">' +
      (rf ? '<form class="card" data-key="registration_freeze"><h2>Geliştirme modu <span class="pill warn" style="vertical-align:3px">kapalı beta</span></h2><p class="sub">Açıkken kayıt ekranı ve Google ile yeni hesap donar; yalnızca izinli hesaplar ve davet listesindekiler girebilir.</p><div style="display:flex;flex-direction:column;gap:12px"><label class="switch"><input type="checkbox" name="en"' + (rf.enabled ? ' checked' : '') + '><i></i>geliştirme modu</label><label class="fld">Kayıt ekranındaki mesaj<input class="in" name="msg" maxlength="200" value="' + X(rf.message || '') + '"></label><div class="acts"><button class="btn blue sm" type="submit">Kaydet</button></div></div></form>' +
        '<div class="card" id="inv-card"><h2>Davet listesi</h2><p class="sub">Buraya eklenen e-posta, geliştirme modunda da kayıt olabilir (e-posta ya da Google). Hesabı varsa erişimi hemen açılır.</p><form id="inv-f" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end"><label class="fld grow">E-posta<input class="in" name="em" type="email" required placeholder="ad@ornek.com"></label><label class="fld grow">Not <small>(isteğe bağlı)</small><input class="in" name="nt" maxlength="120" placeholder="örn. AYBÜ Tıp kulübü"></label><button class="btn blue sm" type="submit">Davet et</button></form><div id="inv-list" style="margin-top:12px"><div class="skel"></div></div></div>' : '') +
      '<form class="card" data-key="maintenance_mode"><h2>Bakım modu</h2><p class="sub">Açıkken giriş sayfasında bakım uyarısı görünür.</p><div style="display:flex;flex-direction:column;gap:12px"><label class="switch"><input type="checkbox" name="en"' + (mm.enabled ? ' checked' : '') + '><i></i>bakım modu</label><label class="fld">Mesaj<input class="in" name="msg" maxlength="200" value="' + X(mm.message || '') + '" placeholder="Acadex şu anda bakımda…"></label><div class="acts"><button class="btn blue sm" type="submit">Kaydet</button></div></div></form>' +
      '<form class="card" data-key="site_banner"><h2>Site bandı</h2><p class="sub">Sayfaların en üstünde ince duyuru şeridi.</p><div style="display:flex;flex-direction:column;gap:12px"><label class="switch"><input type="checkbox" name="en"' + (bn.enabled ? ' checked' : '') + '><i></i>bandı göster</label><label class="fld">Mesaj<input class="in" name="msg" maxlength="200" value="' + X(bn.message || '') + '" placeholder="örn. Vize haftası: özetleme önceliği sende"></label><div class="acts"><button class="btn blue sm" type="submit">Kaydet</button></div></div></form>' +
      '<form class="card" data-key="registration_domains"><h2>Kayıt alan adları</h2><p class="sub">Boş bırakırsan herkes kayıt olabilir. Örnek: ogr.universite.edu.tr</p><div style="display:flex;flex-direction:column;gap:12px"><label class="fld">Alan adları <small>(virgülle ayır)</small><input class="in" name="dom" value="' + X((rd.domains || []).join(', ')) + '"></label><div class="acts"><button class="btn blue sm" type="submit">Kaydet</button></div></div></form>' +
      '<div class="card"><h2>Güvenlik</h2><p class="sub">Bu panel nasıl korunuyor</p><dl class="kv"><dt>Yetki</dt><dd>Veritabanında: her işlem "yönetici mi" kontrolünden geçer.</dd><dt>Kayıt</dt><dd>Her değişiklik Denetim kaydına yazılır.</dd><dt>Yönetici atama</dt><dd>Panelden yapılamaz; yalnızca veritabanından.</dd></dl></div>' +
      '</div>';
    $$('form[data-key]', m).forEach(function (f) { f.addEventListener('submit', async function (ev) {
      ev.preventDefault(); var key = f.getAttribute('data-key'), val;
      if (key === 'registration_domains') val = { domains: f.dom.value.split(',').map(function (x) { return x.trim().toLowerCase().replace(/^@/, ''); }).filter(Boolean) };
      else val = { enabled: f.en.checked, message: f.msg.value.trim() };
      if (key === 'maintenance_mode' && val.enabled && !confirmBox('Bakım modu açılsın mı? Giriş sayfasında uyarı görünecek.')) return;
      if (key === 'registration_freeze' && !val.enabled && !confirmBox('Geliştirme modu kapatılsın mı? Kayıt ekranı herkese açılır.')) return;
      var b = $('button[type=submit]', f); b.disabled = true;
      try { await rpc('admin_set_setting', { p_key: key, p_value: val }); SETTINGS_CACHE[key] = val; $('#maint-pill').hidden = !(SETTINGS_CACHE.maintenance_mode && SETTINGS_CACHE.maintenance_mode.enabled); toast('Kaydedildi.'); b.disabled = false; }
      catch (er) { b.disabled = false; toast(errMsg(er), true); }
    }); });
    loadInvites();
  };

  var loadInvites = async function () {
    var box = $('#inv-list'); if (!box) return;
    try {
      var list = await rpc('admin_invites') || [];
      box.innerHTML = list.length ? '<div class="list">' + list.map(function (i) { return '<div class="item" style="padding:10px 12px"><div class="item-h"><b style="font-size:13.5px">' + X(i.email) + '</b><span>' + (i.joined ? '<span class="pill ok">katıldı</span> ' : '<span class="pill">bekliyor</span> ') + '<button type="button" class="btn ghost sm" data-inv-rm="' + X(i.email) + '">kaldır</button></span></div>' + (i.note ? '<span class="muted" style="font-size:12.5px">' + X(i.note) + '</span>' : '') + '</div>'; }).join('') + '</div>' : '<p class="muted" style="font-size:13px">Henüz davet yok.</p>';
      $$('[data-inv-rm]', box).forEach(function (b) { b.addEventListener('click', async function () { var e = b.getAttribute('data-inv-rm'); if (!confirmBox(e + ' davet listesinden çıkarılsın mı? Açılmış hesabın erişimi değişmez.')) return; b.disabled = true; try { await rpc('admin_invite_remove', { p_email: e }); toast('Davet kaldırıldı.'); loadInvites(); } catch (er) { b.disabled = false; toast(errMsg(er), true); } }); });
    } catch (e) { box.innerHTML = '<p class="err">' + X(errMsg(e)) + '</p>'; }
  };
  document.addEventListener('submit', async function (ev) {
    var f = ev.target; if (!f || f.id !== 'inv-f') return; ev.preventDefault();
    var b = $('button[type=submit]', f); b.disabled = true;
    try { await rpc('admin_invite_add', { p_email: f.em.value.trim(), p_note: f.nt.value.trim() }); toast(f.em.value.trim() + ' davet edildi.'); f.reset(); loadInvites(); }
    catch (er) { toast(errMsg(er), true); }
    b.disabled = false;
  });

  /* ---------- denetim kaydı ---------- */
  var ACTION = { user_suspend: 'Hesap askıya alındı', user_unsuspend: 'Askı kaldırıldı', user_password_reset_email: 'Şifre sıfırlama e-postası', user_delete: 'Hesap kalıcı silindi', report_hide: 'Şikâyet: içerik gizlendi', report_dismiss: 'Şikâyet kapatıldı', report_reopen: 'Şikâyet yeniden açıldı', content_hide: 'İçerik gizlendi', content_unhide: 'İçerik görünür yapıldı', setting_change: 'Site ayarı değişti', announcement_create: 'Duyuru yayınlandı', announcement_update: 'Duyuru güncellendi', announcement_archive: 'Duyuru arşivlendi', set_is_admin: 'Yönetici atandı', set_is_teacher: 'Öğretmen yetkisi', teacher_system_removed: 'Hoca sistemi kaldırıldı', campuso_sso_login: 'Campuso girişi (eski)', access_grant: 'Erişim izni verildi', access_revoke: 'Erişim kapatıldı', invite_add: 'Davet eklendi', invite_remove: 'Davet kaldırıldı' };
  var AF = '';
  VIEWS.audit = async function (m) {
    var d = await rpc('admin_audit', { p_action: AF, p_limit: 200, p_offset: 0 }), rows = d.rows || [];
    m.innerHTML = '<div class="tools"><label class="fld">İşlem<select class="in" id="a-f"><option value="">hepsi</option>' + (d.actions || []).map(function (a) { return '<option value="' + X(a) + '"' + (AF === a ? ' selected' : '') + '>' + X(ACTION[a] || a) + '</option>'; }).join('') + '</select></label><button type="button" class="btn ghost sm" id="a-csv">CSV indir</button></div>' +
      (rows.length ? '<div class="tbl-w"><table><thead><tr><th>Zaman</th><th>Kim</th><th>İşlem</th><th>Kime / neye</th><th class="hide-sm">Ayrıntı</th></tr></thead><tbody>' + rows.map(function (r) { var det = r.details || {}; var txt = det.reason || det.note || (det.value !== undefined ? JSON.stringify(det.value) : '') || ''; return '<tr><td style="white-space:nowrap">' + DT(r.created_at, true) + '</td><td>' + X(r.actor_name || 'sistem') + '</td><td>' + X(ACTION[r.action] || r.action) + '</td><td>' + (r.target_user_id ? '<button type="button" class="lnk" data-user="' + r.target_user_id + '">' + X(r.target_label || 'kullanıcı') + '</button>' : X(r.target_label || '—')) + '</td><td class="hide-sm muted" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + X(txt) + '">' + X(txt) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="muted" style="font-size:12.5px">Kayıtlar panelden silinemez. ' + NF(d.total) + ' kayıt.</p>' : '<div class="card empty"><span class="hand">kayıt yok</span></div>');
    $('#a-f').addEventListener('change', function () { AF = this.value; VIEWS.audit(m); });
    $('#a-csv').addEventListener('click', function () { csv('acadex-denetim-kaydi.csv', ['Zaman', 'Kim', 'İşlem', 'Hedef', 'Ayrıntı'], rows.map(function (r) { return [r.created_at, r.actor_name || 'sistem', ACTION[r.action] || r.action, r.target_label || '', JSON.stringify(r.details || {})]; })); });
    $$('[data-user]', m).forEach(function (b) { b.addEventListener('click', function () { userDetail(b.getAttribute('data-user')); }); });
  };

  var csv = function (name, head, rows) {
    var esc = function (v) { v = v == null ? '' : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var txt = '﻿' + [head].concat(rows).map(function (r) { return r.map(esc).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /* oturum değişince (Google dönüşü, çıkış) yeniden başla */
  if (sb) sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') loginView(); });
  boot();
})();
