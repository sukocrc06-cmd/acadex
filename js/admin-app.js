/* ==========================================================================
   Acadex · Yönetim paneli (js/admin-app.js)
   Güvenlik tarayıcıda değil, veritabanında: her veri ve işlem admin_* SQL
   fonksiyonlarıyla gelir; her fonksiyon "yönetici mi + iki adımlı doğrulama
   (aal2) yapılmış mı" diye kendisi bakar ve işlemleri admin_audit_log'a yazar.
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
  var errMsg = function (e) { var m = (e && (e.message || e.error_description)) || String(e || 'bilinmeyen hata'); if (/42501|yetki/i.test(m + (e && e.code))) return 'Yetki yok: yönetici hesabı ve iki adımlı doğrulama gerekli.'; return m; };
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
      var al = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!al.data || al.data.currentLevel !== 'aal2') { await mfaView(); return; }
      ME = who; start();
    } catch (e) { gate('<h2 class="disp">Bir sorun çıktı</h2><p class="err">' + X(errMsg(e)) + '</p><div class="acts-g"><button type="button" class="btn blue" id="g-retry">Tekrar dene</button> <button type="button" class="lnk" id="g-out">çıkış yap</button></div>'); $('#g-retry').addEventListener('click', boot); $('#g-out').addEventListener('click', signOut); }
  };

  /* =========================== panel iskeleti =========================== */
  var ME = null, CUR = 'overview', COUNTS = {};
  var IC = {
    overview: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.7 2.5 3 5.2"/>',
    reports: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    plans: '<path d="M4 6h16v12H4zM4 10h16M8 15h3"/>',
    content: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1.5 2.5h5L16 13h5"/>',
    news: '<path d="M4 9v6h3l6 4V5L7 9zM17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    audit: '<path d="M9 4h6M9 4a2 2 0 0 0-2 2v0H5v15h14V6h-2a2 2 0 0 0-2-2M9 12l2 2 4-4"/>'
  };
  var NAV = [
    { g: 'MASA' }, { k: 'overview', t: 'Genel bakış' },
    { g: 'ÖĞRENCİLER' }, { k: 'users', t: 'Kullanıcılar' }, { k: 'reports', t: 'Şikâyetler', badge: 'open_reports' }, { k: 'plans', t: 'Planlar ve kota', soon: true },
    { g: 'İÇERİK VE İLETİŞİM' }, { k: 'content', t: 'İçerik' }, { k: 'inbox', t: 'Gelen kutusu', badge: 'unread_messages' }, { k: 'news', t: 'Duyurular' },
    { g: 'SİSTEM' }, { k: 'settings', t: 'Site ayarları' }, { k: 'audit', t: 'Denetim kaydı' }
  ];
  var TITLES = { overview: 'Genel bakış', users: 'Kullanıcılar', reports: 'Şikâyetler ve moderasyon', plans: 'Planlar ve kota', content: 'İçerik', inbox: 'Gelen kutusu', news: 'Duyurular', settings: 'Site ayarları', audit: 'Denetim kaydı' };
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
    $('#page-t').textContent = TITLES[k]; $('#crumb').textContent = TITLES[k].toLocaleUpperCase('tr'); document.title = 'Acadex · ' + TITLES[k];
    if (push !== false) history.replaceState(null, '', '#' + k);
    $('#app').classList.remove('nav-open'); $('#menu-b').setAttribute('aria-expanded', 'false');
    var m = main(); m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
    m.innerHTML = '<div class="card"><div class="skel" style="width:40%"></div><div class="skel" style="margin-top:12px"></div><div class="skel" style="margin-top:12px;width:70%"></div></div>';
    VIEWS[k](m).catch(function (e) { m.innerHTML = '<div class="card"><h2>Yüklenemedi</h2><p class="err">' + X(errMsg(e)) + '</p><button type="button" class="btn sm" data-go="' + k + '">tekrar dene</button></div>'; });
  };
  var refreshCounts = async function () { try { var o = await rpc('admin_overview'); COUNTS = o; paintNav(); $('#maint-pill').hidden = !(SETTINGS_CACHE && SETTINGS_CACHE.maintenance_mode && SETTINGS_CACHE.maintenance_mode.enabled); return o; } catch (e) { return null; } };
  var SETTINGS_CACHE = null;
  var start = function () {
    $('#gate').hidden = true; $('#app').hidden = false; $('#me-name').textContent = ME.name || ME.email || 'yönetici';
    rpc('admin_settings').then(function (s) { SETTINGS_CACHE = s.settings || {}; $('#maint-pill').hidden = !(SETTINGS_CACHE.maintenance_mode && SETTINGS_CACHE.maintenance_mode.enabled); }, function () {});
    refreshCounts();
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
      '</div><div class="grid g-wide"><div class="card"><h2>Son 30 gün</h2><p class="sub">Günlük yeni kayıt, belge ve özet kartı</p>' + chart30(o.series || []) + '</div>' +
      '<div class="card"><h2>Bölümlere göre öğrenci</h2><p class="sub">' + NF(o.users_total) + ' öğrenci</p><div class="bars">' + (o.by_department || []).map(function (b) { return '<div class="bar"><span title="' + X(dept(b.d === '(seçilmedi)' ? '' : b.d)) + '">' + X(dept(b.d === '(seçilmedi)' ? '' : b.d)) + '</span><span class="t"><i data-w="' + Math.round(b.n / tot * 100) + '"></i></span><b>' + b.n + '</b></div>'; }).join('') + '</div></div></div>';
    /* sayaçlar ve çubuklar canlansın */
    requestAnimationFrame(function () {
      $$('.kpi', m).forEach(function (el) { el.style.setProperty('--w', (el.getAttribute('data-w') || 0) + '%'); });
      $$('.bar .t i', m).forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
      $$('[data-count]', m).forEach(function (el) { var to = +el.getAttribute('data-count'), t0 = performance.now(); var f = function (t) { var p = Math.min(1, (t - t0) / 700); el.textContent = NF(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    });
    $$('.kpi.go', m).forEach(function (el) { el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(el.getAttribute('data-go')); } }); });
  };

  /* ---------- kullanıcılar ---------- */
  var UF = { q: '', dept: '', provider: '', status: '', off: 0 };
  VIEWS.users = async function (m) {
    m.innerHTML = '<div class="tools"><label class="fld grow">Ara<input class="in" id="u-q" placeholder="ad, e-posta ya da öğrenci no" value="' + X(UF.q) + '"></label>' +
      '<label class="fld">Bölüm<select class="in" id="u-dept"><option value="">hepsi</option>' + Object.keys(DEPTS).map(function (d) { return '<option value="' + X(d) + '"' + (UF.dept === d ? ' selected' : '') + '>' + X(DEPTS[d]) + '</option>'; }).join('') + '<option value="-"' + (UF.dept === '-' ? ' selected' : '') + '>seçilmedi</option></select></label>' +
      '<label class="fld">Giriş<select class="in" id="u-prov"><option value="">hepsi</option><option value="email"' + (UF.provider === 'email' ? ' selected' : '') + '>e-posta</option><option value="google"' + (UF.provider === 'google' ? ' selected' : '') + '>Google</option></select></label>' +
      '<label class="fld">Durum<select class="in" id="u-st"><option value="">hepsi</option><option value="active"' + (UF.status === 'active' ? ' selected' : '') + '>aktif</option><option value="suspended"' + (UF.status === 'suspended' ? ' selected' : '') + '>askıda</option><option value="incomplete"' + (UF.status === 'incomplete' ? ' selected' : '') + '>profili eksik</option><option value="admin"' + (UF.status === 'admin' ? ' selected' : '') + '>yönetici</option></select></label>' +
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
      rows.map(function (u) { return '<tr class="click" data-uid="' + X(u.id) + '" tabindex="0"><td><div class="who">' + av(u) + '<span><b>' + X(u.full_name || '(adsız)') + (u.is_admin ? ' <span class="pill blue">yönetici</span>' : '') + '</b><small>' + X(u.email) + '</small></span></div></td><td class="hide-sm">' + X(dept(u.department)) + '</td><td>' + (u.provider === 'google' ? '<span class="pill">Google</span>' : '<span class="pill">e-posta</span>') + '</td><td class="hide-sm">' + DT(u.created_at) + '</td><td>' + (u.last_active_date ? DT(u.last_active_date) : '—') + '</td><td class="hide-sm">' + u.docs + ' / ' + u.cards + '</td><td>' + (u.is_suspended ? '<span class="pill bad">askıda</span>' : (!u.department || /^oauth-/.test(u.student_number || '')) ? '<span class="pill warn">profil eksik</span>' : '<span class="pill ok">aktif</span>') + '</td></tr>'; }).join('') +
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
      $('#drawer-body').innerHTML = '<div class="who">' + av(p) + '<span><b>' + X(p.full_name || '(adsız)') + '</b><small>' + X(p.email) + '</small></span></div>' +
        '<div>' + (p.is_suspended ? '<span class="pill bad">askıda</span> ' : '<span class="pill ok">aktif</span> ') + (p.is_admin ? '<span class="pill blue">yönetici</span> ' : '') + '<span class="pill">' + (a.provider === 'google' ? 'Google ile' : 'e-postayla') + ' giriş</span> ' + (a.confirmed ? '' : '<span class="pill warn">e-posta onaysız</span>') + '</div>' +
        '<div class="minis"><div class="mini"><b>' + NF(c.docs) + '</b><span>belge</span></div><div class="mini"><b>' + NF(c.cards) + '</b><span>özet kartı</span></div><div class="mini"><b>' + NF(c.shared) + '</b><span>paylaşılan</span></div><div class="mini"><b>' + NF(c.reports_against) + '</b><span>şikâyet aldı</span></div></div>' +
        '<dl class="kv"><dt>Bölüm</dt><dd>' + X(dept(p.department)) + '</dd><dt>Öğrenci no</dt><dd>' + (/^oauth-/.test(p.student_number || '') ? '<span class="pill warn">girilmedi</span>' : X(p.student_number)) + '</dd><dt>Kayıt</dt><dd>' + DT(p.created_at, true) + '</dd><dt>Son giriş</dt><dd>' + (a.last_sign_in_at ? DT(a.last_sign_in_at, true) + ' (' + AGO(a.last_sign_in_at) + ')' : '—') + '</dd><dt>Son aktif gün</dt><dd>' + DT(p.last_active_date) + '</dd><dt>Seri</dt><dd>' + NF(p.current_streak) + ' gün</dd><dt>Plan</dt><dd>' + X((d.plan && d.plan.plan) || 'lite') + ' <span class="muted">(planlar yakında düzenlenebilecek)</span></dd>' + (p.bio ? '<dt>Hakkında</dt><dd>' + X(p.bio) + '</dd>' : '') + '</dl>' +
        (d.usage && d.usage.length ? '<div><h3 style="margin:0 0 8px;font-size:15px">Aylık kullanım</h3><div class="tbl-w"><table><thead><tr><th>Ay</th><th>Sayfa</th><th>Belge</th><th>Önbellek</th></tr></thead><tbody>' + d.usage.map(function (u) { return '<tr><td>' + new Date(u.period).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) + '</td><td>' + NF(u.pages_used) + '</td><td>' + NF(u.docs_used) + '</td><td>' + NF(u.cache_hits) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '') +
        (d.docs && d.docs.length ? '<div><h3 style="margin:0 0 8px;font-size:15px">Son belgeler</h3><div class="tbl-w"><table><tbody>' + d.docs.map(function (x) { return '<tr><td>' + X(x.file_name) + '</td><td>' + (x.status === 'summarized' ? '<span class="pill ok">özetlendi</span>' : '<span class="pill">' + X(x.status) + '</span>') + '</td><td class="muted">' + AGO(x.uploaded_at) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '') +
        '<div class="acts"><a class="btn ghost sm" href="mailto:' + X(p.email) + '">e-posta yaz</a><button type="button" class="btn ghost sm" id="d-reset">şifre sıfırlama e-postası</button></div>' +
        (self ? '<p class="muted" style="font-size:13px">Kendi hesabın: askıya alma kapalı.</p>' : p.is_admin ? '<p class="muted" style="font-size:13px">Yönetici hesapları panelden askıya alınamaz.</p>' :
          '<div class="danger"><h3>' + (p.is_suspended ? 'Askıyı kaldır' : 'Hesabı askıya al') + '</h3><p class="muted" style="font-size:13px;margin:0 0 10px">' + (p.is_suspended ? 'Öğrenci yeniden giriş yapıp Acadex\'i kullanabilir.' : 'Öğrenci giriş yaptığında panel yerine "hesabın askıda" ekranını görür. Verisi silinmez.') + '</p>' +
          (p.is_suspended ? '' : '<label class="fld" style="margin-bottom:10px">Sebep <small>(kayda geçer)</small><input class="in" id="d-reason" maxlength="200" placeholder="örn. tekrarlanan uygunsuz paylaşım"></label>') +
          '<button type="button" class="btn ' + (p.is_suspended ? 'green' : 'red') + ' sm" id="d-susp">' + (p.is_suspended ? 'Askıyı kaldır' : 'Askıya al') + '</button></div>') +
        (d.log && d.log.length ? '<div><h3 style="margin:0 0 8px;font-size:15px">Bu öğrenciyle ilgili kayıtlar</h3><div class="list">' + d.log.map(function (l) { return '<div class="item" style="padding:10px 12px"><div class="item-h"><b style="font-size:13.5px">' + X(ACTION[l.action] || l.action) + '</b><span class="t">' + AGO(l.created_at) + '</span></div><span class="muted" style="font-size:12.5px">' + X(l.actor_name || 'sistem') + (l.details && l.details.reason ? ' · ' + X(l.details.reason) : '') + '</span></div>'; }).join('') + '</div></div>' : '');
      $('#d-reset').addEventListener('click', async function () {
        if (!confirmBox(p.email + ' adresine şifre sıfırlama bağlantısı gönderilsin mi?')) return;
        this.disabled = true; var r = await sb.auth.resetPasswordForEmail(p.email, { redirectTo: location.origin + '/reset-password.html' });
        if (r.error) { this.disabled = false; toast(errMsg(r.error), true); return; }
        try { await rpc('admin_note_password_reset', { p_id: p.id }); } catch (e) {}
        this.textContent = 'gönderildi ✓'; toast('Şifre sıfırlama e-postası gönderildi.');
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
    var mm = st.maintenance_mode || {}, bn = st.site_banner || {}, rd = st.registration_domains || {};
    m.innerHTML = '<div class="grid g2">' +
      '<form class="card" data-key="maintenance_mode"><h2>Bakım modu</h2><p class="sub">Açıkken giriş sayfasında bakım uyarısı görünür.</p><div style="display:flex;flex-direction:column;gap:12px"><label class="switch"><input type="checkbox" name="en"' + (mm.enabled ? ' checked' : '') + '><i></i>bakım modu</label><label class="fld">Mesaj<input class="in" name="msg" maxlength="200" value="' + X(mm.message || '') + '" placeholder="Acadex şu anda bakımda…"></label><div class="acts"><button class="btn blue sm" type="submit">Kaydet</button></div></div></form>' +
      '<form class="card" data-key="site_banner"><h2>Site bandı</h2><p class="sub">Sayfaların en üstünde ince duyuru şeridi.</p><div style="display:flex;flex-direction:column;gap:12px"><label class="switch"><input type="checkbox" name="en"' + (bn.enabled ? ' checked' : '') + '><i></i>bandı göster</label><label class="fld">Mesaj<input class="in" name="msg" maxlength="200" value="' + X(bn.message || '') + '" placeholder="örn. Vize haftası: özetleme önceliği sende"></label><div class="acts"><button class="btn blue sm" type="submit">Kaydet</button></div></div></form>' +
      '<form class="card" data-key="registration_domains"><h2>Kayıt alan adları</h2><p class="sub">Boş bırakırsan herkes kayıt olabilir. Örnek: ogr.universite.edu.tr</p><div style="display:flex;flex-direction:column;gap:12px"><label class="fld">Alan adları <small>(virgülle ayır)</small><input class="in" name="dom" value="' + X((rd.domains || []).join(', ')) + '"></label><div class="acts"><button class="btn blue sm" type="submit">Kaydet</button></div></div></form>' +
      '<div class="card"><h2>Güvenlik</h2><p class="sub">Bu panel nasıl korunuyor</p><dl class="kv"><dt>Yetki</dt><dd>Veritabanında: her işlem "yönetici + iki adımlı doğrulama" kontrolünden geçer.</dd><dt>Kayıt</dt><dd>Her değişiklik Denetim kaydına yazılır.</dd><dt>Yönetici atama</dt><dd>Panelden yapılamaz; yalnızca veritabanından.</dd></dl></div>' +
      '</div>';
    $$('form[data-key]', m).forEach(function (f) { f.addEventListener('submit', async function (ev) {
      ev.preventDefault(); var key = f.getAttribute('data-key'), val;
      if (key === 'registration_domains') val = { domains: f.dom.value.split(',').map(function (x) { return x.trim().toLowerCase().replace(/^@/, ''); }).filter(Boolean) };
      else val = { enabled: f.en.checked, message: f.msg.value.trim() };
      if (key === 'maintenance_mode' && val.enabled && !confirmBox('Bakım modu açılsın mı? Giriş sayfasında uyarı görünecek.')) return;
      var b = $('button[type=submit]', f); b.disabled = true;
      try { await rpc('admin_set_setting', { p_key: key, p_value: val }); SETTINGS_CACHE[key] = val; $('#maint-pill').hidden = !(SETTINGS_CACHE.maintenance_mode && SETTINGS_CACHE.maintenance_mode.enabled); toast('Kaydedildi.'); b.disabled = false; }
      catch (er) { b.disabled = false; toast(errMsg(er), true); }
    }); });
  };

  /* ---------- denetim kaydı ---------- */
  var ACTION = { user_suspend: 'Hesap askıya alındı', user_unsuspend: 'Askı kaldırıldı', user_password_reset_email: 'Şifre sıfırlama e-postası', report_hide: 'Şikâyet: içerik gizlendi', report_dismiss: 'Şikâyet kapatıldı', report_reopen: 'Şikâyet yeniden açıldı', content_hide: 'İçerik gizlendi', content_unhide: 'İçerik görünür yapıldı', setting_change: 'Site ayarı değişti', announcement_create: 'Duyuru yayınlandı', announcement_update: 'Duyuru güncellendi', announcement_archive: 'Duyuru arşivlendi', set_is_admin: 'Yönetici atandı', set_is_teacher: 'Hoca yetkisi (eski)', teacher_system_removed: 'Hoca sistemi kaldırıldı', campuso_sso_login: 'Campuso girişi (eski)' };
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
