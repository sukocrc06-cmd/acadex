/* ==========================================================================
   ACADEX DESTEK HATTI (js/acadex-destek.js + css/acadex-destek.css), 28.10.2026
   Landing'in sağ altında kulaklıklı Acadia: önce sık sorulanları kendisi cevaplar
   (sabit metinler, yapay zekâ değil, maliyet yok), yetmezse "ekiple konuş" der ve
   görüşme yönetim panelindeki "Canlı destek" sekmesine düşer.

   Sunucu: supabase/migrations/20261028_canli_destek.sql
     support_status / support_open / support_send / support_fetch / support_peek / support_close
   Ziyaretçi giriş yapmaz; tarayıcı 48 karakterlik rastgele bir anahtar üretir
   (acadex.destek), sunucu yalnız özetini tutar. Mesajlar 4 sn'de bir (pencere açıkken)
   çekilir; kapalıyken 30 sn'de bir yalnız "okunmamış var mı" sorulur.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window;
  if (D.querySelector('.axs-dest')) return;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sbc = function () { return typeof supabaseClient !== 'undefined' ? supabaseClient : (W.supabaseClient || null); };
  var rpc = function (fn, args) { var c = sbc(); if (!c) return Promise.reject(new Error('baglanti')); return c.rpc(fn, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; }); };
  var K = W.AcadiaKit;
  var avatar = function (mood, pose) { return K ? K.svg({ mood: mood || 'mutlu', pose: pose || 'dur', costume: 'destek', forceCostume: true }) : ''; };
  var norm = function (s) { return String(s || '').toLocaleLowerCase('tr').replace(/[çğıöşü]/g, function (c) { return { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' }[c]; }).replace(/\s+/g, ' ').trim(); };

  /* ---------- Acadia'nın bildikleri: landing'deki metinlerden, uydurma yok ---------- */
  var FAQ = [
    { k: 'ucret', q: 'Acadex ücretli mi?', kw: ['ucret', 'fiyat', 'para', 'premium', 'paket', 'abonelik', ' tl', 'odeme', 'indirim', 'bedava', 'ucretsiz'],
      a: 'Şu an beta dönemindeyiz ve beta boyunca herkes Premium kullanıyor. Lansmanda kredi kartı gerektirmeyen ücretsiz bir paket, Lite (119 TL/ay) ve Premium (229 TL/ay) olacak; beta’ya katılan kurucu üyelere lansmanda %50 indirim var. Fiyatlar lansmanda kesinleşir.' },
    { k: 'kayit', q: 'Kayıt olamıyorum', kw: ['kayit', 'uye', 'hesap ac', 'giris yap', 'giremiyorum', 'davet', 'beta', 'pilot', 'katil'],
      a: 'Acadex şu an geliştirme aşamasında; yeni kayıtlar kısa bir süreliğine kapalı ve yalnızca davet edilen hesaplar girebiliyor. Pilot programa katılmak istersen ekibe yaz, seni listeye ekleyelim.' },
    { k: 'dosya', q: 'Hangi dosyaları yükleyebilirim?', kw: ['dosya', 'pdf', 'pptx', 'ppt', 'slayt', 'yukle', 'format', 'word', 'not yukle', 'sayfa'],
      a: 'PDF, slayt ya da ders notunu yükleyebilirsin; birkaç dakikada özetin hazır olur. Aylık özet sayısı ve sayfa sınırı pakete göre değişir: ücretsiz pakette ayda 4 belge, belge başına 25 sayfaya kadar.' },
    { k: 'gizlilik', q: 'Dosyalarımı kim görür?', kw: ['gizli', 'kim gor', 'guven', 'kvkk', 'paylas', 'veri', 'gizlilik', 'baskasi'],
      a: 'Yalnızca sen. Paylaşmayı seçmediğin sürece hiçbir dosyan başkasına görünmez. Hesabını ve tüm verini Ayarlar’dan tek adımda kalıcı olarak silebilirsin.' },
    { k: 'kim', q: 'Kimler kullanabilir?', kw: ['kim kullan', 'bolum', 'fakulte', 'hukuk', 'tip', 'muhendis', 'iktisat', 'universite', 'ogrenci'],
      a: 'Pilot programa katılan üniversite öğrencileri. Mühendislikten hukuka, iktisattan sosyal bilimlere her bölüm için çalışır.' },
    { k: 'sinav', q: 'Denemeler notumu etkiler mi?', kw: ['sinav', 'deneme', 'puan', 'notumu', 'not etkile'],
      a: 'Hayır. Deneme sınavları yalnızca pratik içindir; resmi notlarına yansımaz. Puanlama yol göstermek içindir, öğretim üyesinin değerlendirmesinin yerini tutmaz.' },
    { k: 'sil', q: 'Hesabımı silebilir miyim?', kw: ['hesabimi sil', 'hesap sil', 'silmek', 'kapatmak', 'verimi sil'],
      a: 'Evet. Ayarlar’dan hesabını ve tüm verini tek adımda kalıcı olarak silebilirsin.' }
  ];
  var match = function (text) {
    var n = ' ' + norm(text) + ' ', best = null, bs = 0;
    FAQ.forEach(function (f) { var s = 0; f.kw.forEach(function (k) { if (n.indexOf(k) > -1) s += k.length > 4 ? 2 : 1; }); if (s > bs) { bs = s; best = f; } });
    return bs >= 1 ? best : null;
  };

  /* ---------- durum ---------- */
  var KEY = 'acadex.destek';
  var S = lsafe(function () { return JSON.parse(localStorage.getItem(KEY) || 'null'); }, null) || {};
  var save = function () { lsafe(function () { localStorage.setItem(KEY, JSON.stringify({ tok: S.tok, live: S.live, last: S.last || 0, name: S.name || '', log: (S.log || []).slice(-30) })); }); };
  var newTok = function () { var a = new Uint8Array(36); (W.crypto || W.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 48); };
  if (!S.tok) { S.tok = newTok(); save(); }
  S.log = S.log || [];
  var online = false, openState = false, pollT = 0, unread = 0, mode = S.live ? 'live' : 'bot', seen = {};

  /* ---------- iskelet ---------- */
  var root = D.createElement('div'); root.className = 'axs-dest';
  root.innerHTML =
    '<button type="button" class="axs-launch" data-ds-open aria-expanded="false" aria-controls="axs-panel">' +
      '<span class="axs-av" data-ds-av>' + avatar('mutlu', 'selam') + '</span>' +
      '<span class="axs-l"><b>canlı destek</b><small data-ds-st>Acadia hatta</small></span><i class="axs-dot" data-ds-dot></i><span class="axs-badge" data-ds-badge hidden>1</span>' +
    '</button>' +
    '<section class="axs-panel" id="axs-panel" role="dialog" aria-modal="false" aria-labelledby="axs-t" hidden>' +
      '<header class="axs-h"><span class="axs-hav" data-ds-hav>' + avatar('mutlu') + '</span>' +
        '<div class="axs-ht"><span class="axs-k">ACADEX · DESTEK HATTI</span><h2 id="axs-t">Acadia ve ekip</h2><p data-ds-sub><i class="axs-dot"></i>bağlanıyor…</p></div>' +
        '<button type="button" class="axs-x" data-ds-close aria-label="Destek penceresini kapat">×</button></header>' +
      '<div class="axs-log" data-ds-log role="log" aria-live="polite"></div>' +
      '<div class="axs-chips" data-ds-chips></div>' +
      '<form class="axs-form" data-ds-form autocomplete="off"><label class="axs-vh" for="axs-in">Mesajın</label><textarea id="axs-in" rows="1" maxlength="2000" placeholder="bir şey sor…"></textarea><button type="submit" aria-label="Gönder"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 L20 4 L14 20 L11 13 Z"/></svg></button></form>' +
      '<p class="axs-foot" data-ds-foot></p>' +
    '</section>';
  D.body.appendChild(root);
  var $ = function (s) { return root.querySelector(s); };
  var logEl = $('[data-ds-log]'), chipsEl = $('[data-ds-chips]'), form = $('[data-ds-form]'), inp = $('#axs-in'), panel = $('#axs-panel'), launch = $('[data-ds-open]');

  var time = function (t) { var d = t ? new Date(t) : new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  var bubble = function (who, text, t, extra) {
    var w = D.createElement('div'); w.className = 'axs-m axs-' + who;
    var lab = who === 'admin' ? 'Acadex ekibi' : who === 'bot' ? 'Acadia' : '';
    w.innerHTML = (who === 'bot' || who === 'admin' ? '<span class="axs-mav" aria-hidden="true">' + (who === 'bot' ? avatar('mutlu') : '<b>A</b>') + '</span>' : '') +
      '<div class="axs-mb">' + (lab ? '<span class="axs-who">' + lab + '</span>' : '') + '<p></p>' + (extra || '') + '<time>' + time(t) + '</time></div>';
    w.querySelector('p').textContent = text;
    logEl.appendChild(w); logEl.scrollTop = logEl.scrollHeight;
    return w;
  };
  var sys = function (text) { var w = D.createElement('div'); w.className = 'axs-sys'; w.textContent = text; logEl.appendChild(w); logEl.scrollTop = logEl.scrollHeight; };
  var talk = function (mood) { var h = $('[data-ds-hav]'); if (!h) return; h.innerHTML = avatar(mood || 'mutlu'); h.classList.remove('talk'); void h.offsetWidth; h.classList.add('talk'); };
  var botSay = function (text, extra, keep) {
    var typing = D.createElement('div'); typing.className = 'axs-m axs-bot axs-typing'; typing.innerHTML = '<span class="axs-mav" aria-hidden="true">' + avatar('dusunuyor') + '</span><div class="axs-mb"><span class="axs-dots"><i></i><i></i><i></i></span></div>';
    logEl.appendChild(typing); logEl.scrollTop = logEl.scrollHeight;
    return new Promise(function (res) {
      setTimeout(function () { typing.remove(); bubble('bot', text, null, extra); talk('mutlu'); if (keep !== false) { S.log.push({ s: 'bot', b: text }); save(); } res(); }, Math.min(1400, 450 + text.length * 6));
    });
  };

  /* ---------- üst satır: çevrimiçi / değil ---------- */
  var paintStatus = function () {
    $('[data-ds-dot]').classList.toggle('on', online);
    $('[data-ds-st]').textContent = mode === 'live' ? (online ? 'ekip çevrimiçi' : 'ekibe iletildi') : 'Acadia hatta';
    var sub = $('[data-ds-sub]');
    sub.innerHTML = '<i class="axs-dot' + (online ? ' on' : '') + '"></i>' + (mode === 'live' ? (online ? 'ekip çevrimiçi · genelde birkaç dakikada döner' : 'ekip şu an çevrimdışı · e-postana döneceğiz') : (online ? 'Acadia cevaplar · ekip de çevrimiçi' : 'Acadia cevaplar · ekip şu an çevrimdışı'));
    $('[data-ds-foot]').innerHTML = mode === 'live' ? '<button type="button" class="axs-lnk" data-ds-end>görüşmeyi bitir</button> · yazışma yalnız destek için saklanır' : 'Acadia hazır cevaplar verir; yapay zekâ değildir.';
  };
  var chips = function () {
    if (mode === 'live') { chipsEl.innerHTML = ''; chipsEl.hidden = true; return; }
    chipsEl.hidden = false;
    chipsEl.innerHTML = FAQ.map(function (f) { return '<button type="button" data-ds-q="' + f.k + '">' + X(f.q) + '</button>'; }).join('') + '<button type="button" class="axs-human" data-ds-human>ekiple konuş</button>';
  };

  /* ---------- ekibe aktar ---------- */
  var pendingQ = '';
  var handoffCard = function (q) {
    pendingQ = q || pendingQ;
    if (logEl.querySelector('.axs-hand')) { logEl.querySelector('.axs-hand input').focus(); return; }
    var c = D.createElement('form'); c.className = 'axs-hand'; c.noValidate = true;
    c.innerHTML = '<b>Ekiple bağlanalım</b><p>' + (online ? 'Ekip şu an çevrimiçi; genelde birkaç dakikada döner.' : 'Ekip şu an çevrimdışı. E-postanı bırak, en kısa sürede dönelim.') + '</p>' +
      '<label>Adın <small>(isteğe bağlı)</small><input name="n" maxlength="80" value="' + X(S.name || '') + '"></label>' +
      '<label>E-postan' + (online ? ' <small>(cevabı kaçırmamak için)</small>' : '') + '<input name="e" type="email" maxlength="160" inputmode="email"' + (online ? '' : ' required') + '></label>' +
      (pendingQ ? '' : '<label>Sorun ne?<textarea name="q" rows="2" maxlength="2000" required></textarea></label>') +
      '<p class="axs-err" hidden></p><button type="submit">ekibe bağlan</button><small class="axs-kvkk">Bilgilerin yalnız bu görüşme için kullanılır.</small>';
    logEl.appendChild(c); logEl.scrollTop = logEl.scrollHeight;
    setTimeout(function () { c.querySelector('input').focus(); }, 50);
    c.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = c.elements.n.value.trim(), em = c.elements.e.value.trim(), q = pendingQ || (c.elements.q ? c.elements.q.value.trim() : ''), err = c.querySelector('.axs-err'), b = c.querySelector('button');
      var bad = function (m) { err.hidden = false; err.textContent = m; };
      if (!q) return bad('Sorununu kısaca yaz.');
      if (!online && !em) return bad('Çevrimdışıyken cevabı e-postana yazıyoruz; e-postanı bırak.');
      if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return bad('E-posta adresini kontrol eder misin?');
      b.disabled = true; err.hidden = true;
      var topic = (S.topic ? ((FAQ.filter(function (x) { return x.k === S.topic; })[0] || {}).q || S.topic) : '').slice(0, 60);
      rpc('support_open', { p_token: S.tok, p_name: n || null, p_email: em || null, p_topic: topic || null, p_page: (location.pathname + location.hash).slice(0, 300) })
        .then(function () {
          var ctx = S.log.filter(function (x) { return x.s === 'v' && x.b !== q; }).slice(-3).map(function (x) { return '• ' + x.b; }).join('\n');
          return rpc('support_send', { p_token: S.tok, p_body: q }).then(function () { if (ctx) return rpc('support_send', { p_token: S.tok, p_body: 'Acadia’ya sorduğu önceki sorular:\n' + ctx, p_bot: true }); });
        })
        .then(function () {
          S.live = true; S.name = n; S.last = 0; mode = 'live'; save(); c.remove(); logEl.innerHTML = '';
          sys('Görüşme ekibe iletildi. ' + (online ? 'Ekip birazdan burada.' : 'Cevabı burada ve ' + (em ? 'e-postanda' : 'bu sayfada') + ' göreceksin.'));
          chips(); paintStatus(); seen = {}; fetchNow(); schedule(); pushOffer();
        })
        .catch(function (er) {
          b.disabled = false; var m = String(er && er.message || er);
          bad(/SINIR/.test(m) ? 'Çok fazla görüşme açıldı; biraz sonra tekrar dene.' : /EPOSTA/.test(m) ? 'E-posta adresini kontrol eder misin?' : 'Bağlanamadım; internetini kontrol edip tekrar dene.');
        });
    });
  };

  /* ---------- cevap gelince telefona bildirim (js/acadex-push.js, 29.10.2026) ----------
     Görüşme ekibe aktarılınca teklif edilir. Bu tarayıcıda zaten izin ve abonelik
     varsa sorulmadan bu görüşmeye bağlanır. iPhone'da Safari sekmesinden
     (ana ekrana eklenmeden) bildirim mümkün değil; orada teklif gösterilmez. */
  var pushSave = function (p) { return rpc('support_push_subscribe', { p_token: S.tok, p_endpoint: p.endpoint, p_p256dh: p.p256dh, p_auth: p.auth }); };
  var pushOffer = function () {
    var P = W.AxPush; if (!P || !P.supported() || P.needsInstall()) return;
    if (W.Notification && Notification.permission === 'denied') return;
    P.current().then(function (sub) {
      if (sub && Notification.permission === 'granted') { P.enable(pushSave).catch(function () {}); return; }
      if (logEl.querySelector('.axs-push')) return;
      var c = D.createElement('div'); c.className = 'axs-push';
      c.innerHTML = '<b>Cevap gelince haber vereyim mi?</b><p>Sayfayı kapatsan da telefonuna ya da bilgisayarına bildirim gelir.</p><div><button type="button" data-ds-push>bildirim aç</button><button type="button" class="axs-lnk" data-ds-nopush>gerek yok</button></div>';
      logEl.appendChild(c); logEl.scrollTop = logEl.scrollHeight;
    });
  };

  /* ---------- canlı görüşme ---------- */
  var fetchNow = function () {
    if (mode !== 'live') return Promise.resolve();
    return rpc('support_fetch', { p_token: S.tok, p_after: S.last || 0 }).then(function (r) {
      if (!r || !r.exists) { S.live = false; mode = 'bot'; save(); return; }
      online = !!r.online;
      var got = false;
      (r.messages || []).forEach(function (m) {
        if (seen[m.id]) return; seen[m.id] = 1; S.last = Math.max(S.last || 0, m.id);
        if (m.s === 'system') sys(m.b); else { bubble(m.s === 'visitor' ? 'me' : m.s, m.b, m.t); if (m.s === 'admin') { got = true; } }
      });
      if (got) { talk('kutlama'); if (!openState) setUnread(unread + 1); }
      if (r.status === 'closed' && !logEl.querySelector('.axs-again')) { var a = D.createElement('div'); a.className = 'axs-sys axs-again'; a.innerHTML = 'Görüşme kapandı. <button type="button" class="axs-lnk" data-ds-new>yeni soru sor</button>'; logEl.appendChild(a); }
      save(); paintStatus();
    }).catch(function () {});
  };
  var setUnread = function (n) { unread = n; var b = $('[data-ds-badge]'); b.hidden = !n; b.textContent = n; launch.classList.toggle('ring', !!n); };
  /* tek döngü: aynı anda iki zamanlayıcı çalışmaz (gen); sekme arka plandayken de seyrek
     sorar, sekmeye dönünce hemen çeker; mesaj gelmesi için sayfayı yenilemek gerekmez */
  var gen = 0;
  var schedule = function () {
    clearTimeout(pollT); var my = ++gen;
    var next = function (ms) { if (my === gen) pollT = setTimeout(tick, ms); };
    var tick = function () {
      if (my !== gen) return;
      if (mode === 'live' && openState) fetchNow().then(function () { next(D.hidden ? 10000 : 3000); });
      else if (mode === 'live') rpc('support_peek', { p_token: S.tok }).then(function (r) { if (r && r.unread) setUnread(r.unread); }).catch(function () {}).then(function () { next(D.hidden ? 30000 : 12000); });
      else rpc('support_status').then(function (r) { online = !!(r && r.online); paintStatus(); }).catch(function () {}).then(function () { next(60000); });
    };
    tick();
  };
  D.addEventListener('visibilitychange', function () { if (!D.hidden) schedule(); });

  /* ---------- aç / kapat ---------- */
  var greeted = false;
  var open = function () {
    openState = true; panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); root.classList.add('open'); setUnread(0);
    if (mode === 'live') { if (!logEl.children.length) { S.last = 0; seen = {}; } fetchNow(); }
    else if (!greeted) {
      greeted = true;
      S.log.slice(-8).forEach(function (x) { bubble(x.s === 'v' ? 'me' : 'bot', x.b); });
      if (!S.log.length) botSay('Merhaba, ben Acadia! Acadex destek hattındasın. Aşağıdan bir konu seç ya da sorunu yaz; bilmediğimi ekibe aktarırım.', null, false);
    }
    chips(); paintStatus(); schedule();
    setTimeout(function () { inp.focus(); }, 80);
    var g = D.querySelector('.acd-guide'); if (g) g.classList.add('away');
  };
  var close = function () { openState = false; panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); root.classList.remove('open'); schedule(); launch.focus(); var g = D.querySelector('.acd-guide'); if (g) g.classList.remove('away'); };
  launch.addEventListener('click', function () { if (openState) close(); else open(); });
  $('[data-ds-close]').addEventListener('click', close);
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openState && root.contains(D.activeElement)) close(); });

  root.addEventListener('click', function (e) {
    var endTok = S.tok;
    var q = e.target.closest('[data-ds-q]');
    if (q) { var f = FAQ.filter(function (x) { return x.k === q.getAttribute('data-ds-q'); })[0]; if (!f) return; S.topic = f.k; bubble('me', f.q); S.log.push({ s: 'v', b: f.q }); save(); botSay(f.a, '<button type="button" class="axs-lnk" data-ds-human>yetmedi, ekiple konuşayım</button>'); return; }
    if (e.target.closest('[data-ds-human]')) { if (mode === 'live') return; botSay('Tamam, seni ekibe bağlıyorum.', null, false).then(function () { handoffCard(''); }); return; }
    var pb = e.target.closest('[data-ds-push]');
    if (pb) {
      pb.disabled = true; pb.textContent = 'açılıyor…';
      var card = pb.closest('.axs-push');
      W.AxPush.enable(pushSave).then(function () { if (card) card.remove(); sys('Tamam; cevap gelince bildirim gelecek.'); }, function (er) {
        if (card) card.remove(); var m = String(er && er.message || er);
        sys(m === 'engelli' || m === 'izin-yok' ? 'Bildirim izni verilmedi; cevabı burada göreceksin.' : 'Bildirim şu an açılamadı; cevabı burada göreceksin.');
      });
      return;
    }
    if (e.target.closest('[data-ds-nopush]')) { var cc = e.target.closest('.axs-push'); if (cc) cc.remove(); return; }
    if (e.target.closest('[data-ds-end]')) { if (W.AxPush) W.AxPush.current().then(function (sub) { if (sub) rpc('support_push_unsubscribe', { p_token: endTok, p_endpoint: sub.endpoint }).catch(function () {}); }); rpc('support_close', { p_token: S.tok }).catch(function () {}); S.live = false; S.last = 0; S.log = []; S.tok = newTok(); mode = 'bot'; save(); logEl.innerHTML = ''; sys('Görüşmeyi bitirdin. Teşekkürler!'); chips(); paintStatus(); return; }
    if (e.target.closest('[data-ds-new]')) { S.live = false; S.last = 0; S.log = []; S.tok = newTok(); mode = 'bot'; save(); logEl.innerHTML = ''; greeted = false; open(); }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault(); var t = inp.value.trim(); if (!t) return; inp.value = ''; inp.style.height = '';
    if (mode === 'live') {
      var w = bubble('me', t); w.classList.add('sending');
      rpc('support_send', { p_token: S.tok, p_body: t }).then(function (r) { w.classList.remove('sending'); if (r && r.id) { seen[r.id] = 1; S.last = Math.max(S.last || 0, r.id); save(); } })
        .catch(function (er) { w.classList.remove('sending'); w.classList.add('failed'); sys(/HIZ/.test(String(er && er.message)) ? 'Biraz yavaş: dakikada en fazla 6 mesaj.' : 'Mesaj gitmedi; tekrar dene.'); });
      return;
    }
    bubble('me', t); S.log.push({ s: 'v', b: t }); save();
    var f = match(t);
    if (f) { S.topic = f.k; botSay(f.a, '<button type="button" class="axs-lnk" data-ds-human>yetmedi, ekiple konuşayım</button>'); }
    else botSay('Bunu ben cevaplayamam ama ekibimiz cevaplar. Sorunu ekibe iletiyorum.', null).then(function () { handoffCard(t); });
  });
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });
  inp.addEventListener('input', function () { inp.style.height = ''; inp.style.height = Math.min(120, inp.scrollHeight) + 'px'; });

  /* kullanıcı Acadia'yı giydirmişse renk ve aksesuarlar burada da görünür (kulaklık her zaman) */
  D.addEventListener('acadia:style', function () { $('[data-ds-av]').innerHTML = avatar('mutlu', 'selam'); talk('mutlu'); });
  W.axDestek = { open: open, close: close, state: function () { return { mode: mode, online: online, tok: S.tok.slice(0, 6) }; }, match: match, FAQ: FAQ };
  paintStatus(); schedule();
  /* bildirimden gelindi (/#destek): pencereyi aç */
  var hashOpen = function () { if (location.hash === '#destek' && !openState) open(); };
  W.addEventListener('hashchange', hashOpen); hashOpen();
})();
