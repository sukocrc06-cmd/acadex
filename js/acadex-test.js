/* ==========================================================================
   ACADEX TEST — uygulama içi "Bildir" düğmesi (js/acadex-test.js) · 24.10.2026
   Yalnızca Test Paneli ekibi (tp_members) görür. Uygulamadan çıkmadan hata /
   tasarım eksiği / öneri kaydı açar; sayfa, cihaz, tarayıcı, ekran boyutu ve
   adres kendiliğinden yazılır. Kayıtlar acadex.com.tr/panel'e düşer.
   Veri ve yetki: supabase tp_items + "test-panel" deposu (test-paneli.sql).
   Tablo yoksa ya da kullanıcı ekipte değilse hiçbir şey çizmez.
   27.11.2026:
   - "Kim bildiriyor?": ekipten kişi seçilir (cihaz hatırlar). Kayıt panelde o kişinin adıyla
     görünür (tp_items.reporter_email); gönderen hesap author_email'de kalır. Cihazı paylaşan test
     ekibi (Şevval, Şükrü'nün tabletinde) artık kendi adıyla bildirir.
   - Gönderirken o anki oturum okunur ve tazelenir. Eskiden sayfa açılırken alınan kullanıcı
     kullanılıyordu; tarayıcıda hesap değişmiş ya da oturum düşmüşse görüntü yanlış klasöre
     gidiyor, depo "new row violates row-level security policy" diyerek reddediyordu ve
     görüntü yüklenemeyince BÜTÜN kayıt kayboluyordu.
   - Kayıt kaybolmaz: görüntü yüklenemezse kayıt görüntüsüz gider (haber verilir); bağlantı ya
     da oturum yoksa kayıt bu cihazda bekler, düğmede "1 bekliyor" yazar, ilk fırsatta gider.
   - Hatalar Türkçe ve ne yapılacağını söyler.
   ========================================================================== */
(function () {
  'use strict';
  var BUCKET = 'test-panel';
  var PANEL_URL = 'panel.html';
  var TAB_PAGE = { home: 'Bugün', planner: 'Çalışma planlayıcı', notebook: 'Çalışma defteri', cards: 'Bilgi kartları', sourcehub: 'Kaynakla çalış', studylab: 'Study Lab', medlab: 'MedLab', docs: 'Belgelerim', feed: 'Bölüm akışı', acadexsunum: 'Acadex sunum', exams: 'Sınav platformu', settings: 'Ayarlar', sandbox: 'Genel', 'sandbox-interaction': 'Genel' };
  var PAGES = ['Bugün', 'Çalışma planlayıcı', 'Çalışma defteri', 'Bilgi kartları', 'Özet kartı', 'Kaynakla çalış', 'Study Lab', 'MedLab', 'Belgelerim', 'Bölüm akışı', 'Acadex sunum', 'Sınav platformu', 'Ayarlar', 'Acadia', 'Menü / üst bar', 'Genel'];
  var KIND = {
    hata: { l: 'Hata', ph: 'ör. "Çevir" düğmesine basınca kart açılmıyor', f: [['olan', 'Ne oldu?', 'ör. Ekran bir saniye donuyor, kart dönmüyor.'], ['beklenen', 'Ne olmalıydı?', 'ör. Kartın arka yüzü açılmalıydı.']] },
    tasarim: { l: 'Tasarım eksiği', ph: 'ör. Başlık telefonda düğmenin altında kalıyor', f: [['aciklama', 'Ne eksik ya da yanlış görünüyor?', ''], ['olmali', 'Nasıl olmalı? (fikrin varsa)', '']] },
    oneri: { l: 'Öneri', ph: 'ör. Zamanlayıcı bitince ses çalsın', f: [['aciklama', 'Önerin ne?', ''], ['neden', 'Neden işe yarar?', '']] }
  };

  var sb = function () { try { return supabaseClient; } catch (e) { return null; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ME = null, USER = null, root = null, st = null, EKIP = [];
  var LS_BILDIREN = 'axt-bildiren', LS_KUYRUK = 'axt-kuyruk';
  var lsAl = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  var lsKoy = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  function uye(email) { email = String(email || '').toLowerCase(); for (var i = 0; i < EKIP.length; i++) if (EKIP[i].email === email) return EKIP[i]; return null; }
  function bildiren() { var e = st && st.bildiren || lsAl(LS_BILDIREN, '') || (ME && ME.email); return uye(e) || ME; }
  /* teknik hata → Türkçe, ne yapılacağını söyleyen cümle */
  function turkce(e) {
    var m = String((e && (e.message || e.error_description || e.error)) || e || '');
    if (/Failed to fetch|NetworkError|network|Load failed|ERR_INTERNET|timeout/i.test(m)) return 'İnternet bağlantısı yok gibi görünüyor. Kayıt bu cihazda bekliyor; bağlantı gelince kendiliğinden gönderilecek.';
    if (/row-level security|violates row|permission denied|42501|not authorized|Unauthorized|JWT|jwt|token/i.test(m)) return 'Oturum doğrulanamadı (bu tarayıcıda giriş süresi dolmuş ya da hesap değişmiş olabilir). Kayıt bu cihazda bekliyor; acadex.com.tr\'de yeniden giriş yapınca kendiliğinden gönderilecek.';
    if (/Payload too large|413|exceeded the maximum|too large/i.test(m)) return 'Görüntü çok büyük. Daha küçük bir görüntü seç ya da görüntüsüz gönder.';
    if (/duplicate key/i.test(m)) return 'Bu kayıt zaten gönderilmiş.';
    return 'Gönderilemedi: ' + m + '. Kayıt bu cihazda bekliyor, tekrar denenecek.';
  }

  /* 20.11.2026: Acadex Kids da aynı düğmeyi kullanır (kids/assets/kids-test.js). Kids kendi sayfa
     listesini, o anki sayfayı ve adresi window.ACADEX_TEST_SAYFA ile verir: { liste, bul(), adres() } */
  var DIS = window.ACADEX_TEST_SAYFA || null;
  if (DIS && DIS.liste && DIS.liste.length) PAGES = DIS.liste.slice();
  function curPage() {
    if (DIS && DIS.bul) { try { var p = DIS.bul(); if (p) return p; } catch (e) {} }
    if (document.querySelector('#axa-layer .axa.in')) return 'Acadia';
    var r = document.querySelector('.axr-card'); if (r && r.getClientRects().length) return 'Özet kartı';
    var t = 'home'; try { t = currentActiveTab || 'home'; } catch (e) {}
    return TAB_PAGE[t] || 'Genel';
  }
  function env() {
    var ua = navigator.userAgent || '', touch = navigator.maxTouchPoints > 1, w = Math.min(screen.width || innerWidth, screen.height || innerHeight);
    var kind = /iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && touch) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' : (/Mobi|iPhone|Android/i.test(ua) || (touch && w < 600)) ? 'telefon' : 'bilgisayar';
    var os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    var br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
    return { kind: kind, ortam: [os, br].filter(Boolean).join(' · '), ekran: innerWidth + '×' + innerHeight, adres: DIS && DIS.adres ? (function () { try { return DIS.adres(); } catch (e) { return location.pathname + location.hash; } })() : (location.pathname.split('/').pop() || '/') + (function () { try { return currentActiveTab ? '#' + currentActiveTab : location.hash; } catch (e) { return location.hash; } })() };
  }

  /* ---------- görüntü ---------- */
  function shrinkCanvas(src, w, h) {
    var sc = Math.min(1, 1800 / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * sc); c.height = Math.round(h * sc); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    var webp = c.toDataURL('image/webp', .1).indexOf('data:image/webp') === 0, type = webp ? 'image/webp' : 'image/jpeg';
    return new Promise(function (res) { c.toBlob(function (b) { res({ blob: b, type: type, ext: webp ? 'webp' : 'jpg' }); }, type, .86); });
  }
  function fromFile(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { shrinkCanvas(im, im.naturalWidth, im.naturalHeight).then(function (x) { URL.revokeObjectURL(u); res(x); }); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('Görüntü okunamadı')); };
      im.src = u;
    });
  }
  var canCapture = function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && matchMedia('(pointer:fine)').matches; };
  async function captureScreen() {
    root.hidden = true;
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    var stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
      var v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = stream;
      await v.play();
      await new Promise(function (r) { setTimeout(r, 350); });
      return await shrinkCanvas(v, v.videoWidth, v.videoHeight);
    } finally {
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      root.hidden = false;
    }
  }

  /* ---------- arayüz ---------- */
  var CSS = '' +
    '#axt{--ink:#1A2A5C;--navy:#0D1838;--paper:#FBF8F0;--card:#FFFDF8;--line:#D9D3C3;--soft:#6A7593;--hata:#D64545;--hata-d:#A92F2F;--tas:#2F6BFF;--tas-d:#1F4FCC;--one:#1E8A55;--one-d:#156B41;font-family:"Instrument Sans",system-ui,sans-serif;color:var(--navy)}' +
    '#axt [hidden]{display:none!important}' +
    '#axt .fab{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:10025;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 16px 8px 12px;border:1.5px solid var(--ink);border-radius:999px;background:var(--card);box-shadow:2px 2px 0 var(--ink);font:700 14px/1 "Instrument Sans",system-ui,sans-serif;color:var(--navy);cursor:pointer}' +
    '#axt .fab:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 var(--ink)}' +
    '#axt .dots{display:inline-flex;gap:3px}#axt .dots i{width:8px;height:8px;border-radius:50%}' +
    '#axt .dots i:nth-child(1){background:var(--hata)}#axt .dots i:nth-child(2){background:var(--tas)}#axt .dots i:nth-child(3){background:var(--one)}' +
    '@media (max-width:760px){#axt .fab{right:12px;bottom:calc(77px + env(safe-area-inset-bottom,0px));min-height:40px;padding:6px 12px 6px 10px;font-size:13px}}' +
    'body.axr-open #axt .fab,body.axs-hall-on #axt .fab{display:none}' +
    '#axt .veil{position:fixed;inset:0;z-index:10090;background:rgba(13,24,56,.4)}' +
    '#axt .box{position:fixed;left:50%;top:50%;z-index:10091;width:min(560px,calc(100% - 24px));max-height:calc(100dvh - 24px);display:flex;flex-direction:column;transform:translate(-50%,-50%);background:var(--paper);border:1.5px solid var(--ink);border-radius:18px;box-shadow:5px 5px 0 var(--ink)}' +
    '#axt .hd{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 18px;border-bottom:1px solid #E4DECF;background:var(--card);border-radius:16px 16px 0 0}' +
    '#axt .hd h3{margin:0;font:800 18px "Bricolage Grotesque",system-ui,sans-serif}#axt .hd small{color:var(--soft);font-size:12.5px}' +
    '#axt .x{margin-left:auto;width:40px;height:40px;border:0;border-radius:10px;background:none;font-size:24px;line-height:1;color:var(--navy);cursor:pointer}' +
    '#axt .bd{overflow:auto;padding:16px 18px;overscroll-behavior:contain}' +
    '#axt .ft{display:flex;align-items:center;gap:8px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #E4DECF;background:var(--card);border-radius:0 0 16px 16px}' +
    '#axt .ft .m{margin-right:auto;font-size:12.5px;color:var(--soft)}' +
    '#axt .kim{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 14px}#axt .kim>span{width:100%;font-weight:700;font-size:13.5px}' +
    '#axt .kc{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:4px 12px 4px 4px;border:2px solid var(--line);border-radius:999px;background:var(--card);font:700 14px "Instrument Sans",system-ui,sans-serif;color:var(--navy);cursor:pointer}' +
    '#axt .kc i{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--c);color:#fff;font:800 14px/1 "Bricolage Grotesque",system-ui,sans-serif;font-style:normal}' +
    '#axt .kc[aria-pressed="true"]{border-color:var(--c);box-shadow:2px 2px 0 var(--c);background:#fff}' +
    '#axt .fab .bek{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:var(--hata);color:#fff;font-size:12px}' +
    '#axt .kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}' +
    '#axt .k{min-height:46px;border:2px solid var(--line);border-radius:12px;background:var(--card);font:800 14.5px "Bricolage Grotesque",system-ui,sans-serif;color:var(--navy);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}' +
    '#axt .k i{width:10px;height:10px;border-radius:50%;background:var(--c)}' +
    '#axt .k.hata{--c:var(--hata);--b:#FDEDEB}#axt .k.tasarim{--c:var(--tas);--b:#EAF0FF}#axt .k.oneri{--c:var(--one);--b:#E5F4EC}' +
    '#axt .k[aria-pressed="true"]{border-color:var(--c);background:var(--b);box-shadow:2px 2px 0 var(--c)}' +
    '#axt label.f{display:block;margin:0 0 12px}#axt label.f>span{display:block;margin:0 0 5px;font-weight:700;font-size:13.5px}' +
    '#axt .in{width:100%;min-height:44px;padding:9px 12px;border:1.5px solid var(--line);border-radius:12px;background:#fff;font:16px/1.4 "Instrument Sans",system-ui,sans-serif;color:var(--navy);box-sizing:border-box}' +
    '#axt textarea.in{min-height:70px;resize:vertical}#axt .in:focus{outline:none;border-color:var(--ink);box-shadow:0 0 0 3px rgba(47,107,255,.15)}' +
    '#axt .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '#axt .ctx{margin:0 0 12px;padding:8px 12px;border:1px dashed var(--line);border-radius:10px;font:500 12px "JetBrains Mono",ui-monospace,monospace;color:var(--soft);overflow-wrap:anywhere}' +
    '#axt .shots{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '#axt .shot{position:relative;width:92px;height:70px;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:#EEE}' +
    '#axt .shot img{width:100%;height:100%;object-fit:cover;object-position:top}' +
    '#axt .shot button{position:absolute;right:3px;top:3px;width:26px;height:26px;border:0;border-radius:50%;background:rgba(13,24,56,.8);color:#fff;font-weight:800;cursor:pointer}' +
    '#axt .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:8px 14px;border:1.5px solid var(--ink);border-radius:999px;background:var(--card);box-shadow:2px 2px 0 var(--ink);font:700 14px "Instrument Sans",system-ui,sans-serif;color:var(--navy);cursor:pointer;white-space:nowrap}' +
    '#axt .btn.go{background:var(--navy);color:#fff}#axt .btn.go.hata{background:var(--hata);border-color:var(--hata-d);box-shadow:2px 2px 0 var(--hata-d)}#axt .btn.go.tasarim{background:var(--tas);border-color:var(--tas-d);box-shadow:2px 2px 0 var(--tas-d)}#axt .btn.go.oneri{background:var(--one);border-color:var(--one-d);box-shadow:2px 2px 0 var(--one-d)}' +
    '#axt .btn.gh{box-shadow:none;border-color:var(--line)}#axt .btn[disabled]{opacity:.55;pointer-events:none}' +
    '#axt .err{margin:0 0 12px;padding:9px 12px;border-radius:10px;background:#FDEDEB;color:#A92F2F;font-size:14px}' +
    '#axt .ok{padding:26px 10px 10px;text-align:center}#axt .ok b{display:block;font:800 22px "Bricolage Grotesque",system-ui,sans-serif;margin-bottom:6px}#axt .ok p{margin:0 0 16px;color:#4B5675}' +
    '#axt .ok .acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}' +
    '@media (max-width:760px){#axt .box{left:0;top:auto;bottom:0;width:100%;max-height:92dvh;transform:none;border-radius:18px 18px 0 0;border-width:1.5px 0 0;box-shadow:0 -10px 40px -10px rgba(13,24,56,.5)}#axt .row{grid-template-columns:1fr}#axt .ft .m{display:none}}';

  function mount() {
    if (document.getElementById('axt')) return;
    var s = document.createElement('style'); s.id = 'axt-css'; s.textContent = CSS; document.head.appendChild(s);
    root = document.createElement('div'); root.id = 'axt';
    root.innerHTML = '<button type="button" class="fab" data-axt-open title="Test Paneline bildir"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>Bildir</button>';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('change', function (e) { if (e.target.matches('[data-axt-file]')) { addFiles(e.target.files); e.target.value = ''; } });
    root.addEventListener('input', function (e) { if (st && e.target.matches('[data-k]')) st.v[e.target.getAttribute('data-k')] = e.target.value; });
    document.addEventListener('paste', function (e) {
      if (!st || st.done) return;
      var fl = []; Array.prototype.forEach.call((e.clipboardData && e.clipboardData.items) || [], function (i) { if (i.kind === 'file' && /^image\//.test(i.type)) { var f = i.getAsFile(); if (f) fl.push(f); } });
      if (fl.length) { e.preventDefault(); addFiles(fl); }
    });
    document.addEventListener('keydown', function (e) { if (st && e.key === 'Escape') { e.stopPropagation(); close(); } }, true);
  }

  function open() {
    var e = env();
    st = { kind: '', page: curPage(), device: e.kind, env: e, v: { title: '', ortam: e.ortam }, shots: [], err: '', saving: false, done: null };
    paint();
  }
  function close() {
    if (!st) return; st.shots.forEach(function (x) { URL.revokeObjectURL(x.url); }); st = null;
    var v = root.querySelector('.veil'), b = root.querySelector('.box'); if (v) v.remove(); if (b) b.remove();
    var f = root.querySelector('.fab'); if (f) f.focus();
  }
  function paint() {
    var old = root.querySelector('.box .bd'), sc = old ? old.scrollTop : 0;
    var v = root.querySelector('.veil'), b = root.querySelector('.box');
    if (!v) { v = document.createElement('div'); v.className = 'veil'; v.setAttribute('data-axt-close', ''); root.appendChild(v); }
    if (!b) { b = document.createElement('div'); b.className = 'box'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-modal', 'true'); b.setAttribute('aria-label', 'Test Paneline bildir'); root.appendChild(b); }
    if (st.done) {
      if (st.done.bekliyor) { b.innerHTML = '<div class="hd"><h3>Kaydedildi, bekliyor</h3><button type="button" class="x" data-axt-close aria-label="Kapat">×</button></div><div class="bd"><div class="ok"><b>Kayıt kaybolmadı</b><p>' + esc(st.done.neden) + '</p><div class="acts"><button type="button" class="btn go" data-axt-again>Bir tane daha</button></div></div></div>'; return; }
      b.innerHTML = '<div class="hd"><h3>Gönderildi</h3><button type="button" class="x" data-axt-close aria-label="Kapat">×</button></div><div class="bd"><div class="ok"><b>#' + st.done.no + ' Test Paneline eklendi</b><p>' + esc(st.done.title) + (st.done.kim ? ' · ' + esc(st.done.kim) + ' adına' : '') + '</p>' + (st.done.eksik ? '<p class="err">' + st.done.eksik + ' görüntü yüklenemedi; kayıt görüntüsüz gönderildi. Panelde kayda görüntü ekleyebilirsin.</p>' : '') + '<div class="acts"><a class="btn" href="' + PANEL_URL + '#k-' + st.done.no + '" target="_blank" rel="noopener">Panelde aç</a><button type="button" class="btn go" data-axt-again>Bir tane daha</button></div></div></div>';
      return;
    }
    var k = st.kind, K = k ? KIND[k] : null;
    var bk = bildiren();
    var h = (st.err ? '<p class="err" role="alert">' + esc(st.err) + '</p>' : '') +
      (EKIP.length > 1 ? '<div class="kim" role="radiogroup" aria-label="Kim bildiriyor?"><span>Kim bildiriyor?</span>' + EKIP.map(function (m) { var on = bk && m.email === bk.email; return '<button type="button" class="kc" data-axt-kim="' + esc(m.email) + '" role="radio" aria-checked="' + on + '" aria-pressed="' + on + '" style="--c:' + esc(m.color || '#1A2A5C') + '"><i>' + esc((m.name || m.email).charAt(0).toLocaleUpperCase('tr')) + '</i>' + esc(m.name || m.email) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="kinds" role="radiogroup" aria-label="Tür">' + Object.keys(KIND).map(function (x) { return '<button type="button" class="k ' + x + '" data-axt-kind="' + x + '" role="radio" aria-pressed="' + (k === x) + '" aria-checked="' + (k === x) + '"><i></i>' + (x === 'tasarim' ? 'Tasarım' : KIND[x].l) + '</button>'; }).join('') + '</div>';
    if (K) {
      h += '<label class="f"><span>Başlık</span><input class="in" data-k="title" maxlength="160" placeholder="' + esc(K.ph) + '" value="' + esc(st.v.title) + '"></label>' +
        K.f.map(function (f) { return '<label class="f"><span>' + f[1] + '</span><textarea class="in" data-k="' + f[0] + '" maxlength="3000" placeholder="' + esc(f[2]) + '">' + esc(st.v[f[0]] || '') + '</textarea></label>'; }).join('') +
        '<div class="row"><label class="f"><span>Sayfa</span><select class="in" data-axt-page>' + PAGES.map(function (p) { return '<option' + (p === st.page ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></label>' +
        '<label class="f"><span>Cihaz</span><select class="in" data-axt-dev>' + [['telefon', 'Telefon'], ['tablet', 'Tablet'], ['bilgisayar', 'Bilgisayar']].map(function (d) { return '<option value="' + d[0] + '"' + (d[0] === st.device ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('') + '</select></label></div>' +
        '<p class="ctx" title="Kayda kendiliğinden eklenir">' + esc([st.env.ortam, 'ekran ' + st.env.ekran, st.env.adres].filter(Boolean).join(' · ')) + '</p>' +
        '<div class="f"><span style="display:block;margin:0 0 6px;font-weight:700;font-size:13.5px">Ekran görüntüsü</span><div class="shots">' +
          st.shots.map(function (x, i) { return '<div class="shot"><img alt="" src="' + x.url + '"><button type="button" data-axt-rm="' + i + '" aria-label="Kaldır">×</button></div>'; }).join('') +
          (st.shots.length < 6 ? (canCapture() ? '<button type="button" class="btn" data-axt-cap>Ekranı yakala</button>' : '') + '<label class="btn gh">Görüntü seç<input type="file" accept="image/*" multiple hidden data-axt-file></label>' : '') +
        '</div></div>';
    }
    b.innerHTML = '<div class="hd"><div><h3>Test Paneline bildir</h3><small>' + esc((bk || ME).name) + ' adına' + (bk && ME && bk.email !== ME.email ? ' · ' + esc(ME.name) + ' hesabından' : '') + '</small></div><button type="button" class="x" data-axt-close aria-label="Kapat">×</button></div>' +
      '<div class="bd">' + h + '</div>' +
      '<div class="ft"><span class="m">' + (kuyruk().length ? kuyruk().length + ' kayıt bu cihazda bekliyor' : canCapture() ? 'Ctrl+V ile görüntü yapıştırabilirsin' : '') + '</span><button type="button" class="btn gh" data-axt-close>Vazgeç</button>' +
      '<button type="button" class="btn go' + (k ? ' ' + k : '') + '" data-axt-save' + (!k || st.saving ? ' disabled' : '') + '>' + (st.saving ? 'Gönderiliyor…' : 'Gönder') + '</button></div>';
    var bd = b.querySelector('.bd'); if (bd) bd.scrollTop = sc;
    var sp = b.querySelector('[data-axt-page]'); if (sp) sp.addEventListener('change', function () { st.page = this.value; });
    var sd = b.querySelector('[data-axt-dev]'); if (sd) sd.addEventListener('change', function () { st.device = this.value; });
  }
  async function addFiles(list) {
    if (!st) return;
    var arr = Array.prototype.filter.call(list || [], function (f) { return /^image\//.test(f.type); });
    for (var i = 0; i < arr.length && st && st.shots.length < 6; i++) {
      try { var x = await fromFile(arr[i]); x.url = URL.createObjectURL(x.blob); st.shots.push(x); } catch (e) { st.err = e.message; }
    }
    if (st) paint();
  }
  /* o anki oturum: tarayıcıda hesap değişmiş olabilir, süresi dolmuş olabilir → oku, gerekirse tazele */
  async function oturum(c) {
    var s1 = null;
    try { var a = await c.auth.getSession(); s1 = a && a.data && a.data.session; } catch (e) {}
    if (!s1 || (s1.expires_at && s1.expires_at * 1000 < Date.now() + 30000)) {
      try { var b = await c.auth.refreshSession(); s1 = (b && b.data && b.data.session) || s1; } catch (e) {}
    }
    return s1 && s1.user ? s1 : null;
  }
  function blobUrl(b) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { ok(null); }; r.readAsDataURL(b); }); }
  function urlBlob(u) { try { var p = u.split(','), m = /data:([^;]+)/.exec(p[0]), bin = atob(p[1]), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: m ? m[1] : 'image/jpeg' }); } catch (e) { return null; } }
  function kuyruk() { var k = lsAl(LS_KUYRUK, []); return Array.isArray(k) ? k : []; }
  function rozet() { var f = root && root.querySelector('.fab'); if (!f) return; var n = kuyruk().length, b = f.querySelector('.bek'); if (n && !b) { b = document.createElement('span'); b.className = 'bek'; f.appendChild(b); } if (b) { if (n) { b.textContent = n; f.title = n + ' kayıt bu cihazda bekliyor'; } else { b.remove(); f.title = 'Test Paneline bildir'; } } }
  /* bir kaydı gönder: görüntü yüklenemezse görüntüsüz gider; satır eklenemezse hata fırlatır */
  async function gonder(c, kayit, gorseller) {
    var s1 = await oturum(c); if (!s1) throw new Error('JWT oturum yok');
    var email = String(s1.user.email || '').toLowerCase();
    if (!uye(email) && !(ME && ME.email === email)) { var mr = await c.from('tp_members').select('email').eq('email', email).maybeSingle(); if (!mr.data) throw new Error('permission denied: ekipte değil'); }
    var up = [], eksik = 0;
    for (var i = 0; i < gorseller.length; i++) {
      var x = gorseller[i], path = s1.user.id + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + (x.ext || 'jpg');
      try { var r = await c.storage.from(BUCKET).upload(path, x.blob, { contentType: x.type, upsert: false, cacheControl: '31536000' }); if (r.error) throw r.error; up.push(path); }
      catch (e) { eksik++; if (/Failed to fetch|network/i.test(e.message || '')) { if (up.length) c.storage.from(BUCKET).remove(up).catch(function () {}); throw e; } }
    }
    var row = Object.assign({}, kayit, { shots: up }), res = await c.from('tp_items').insert(row).select('no,title').single();
    /* veritabanı henüz güncellenmediyse (reporter_email yok): bildiren detaya yazılır */
    if (res.error && /reporter_email/.test(res.error.message || '')) { delete row.reporter_email; row.detail = Object.assign({}, row.detail, { bildiren: kayit.reporter_email }); res = await c.from('tp_items').insert(row).select('no,title').single(); }
    if (res.error && /source/.test(res.error.message || '')) { delete row.source; res = await c.from('tp_items').insert(row).select('no,title').single(); }
    if (res.error) { if (up.length) c.storage.from(BUCKET).remove(up).catch(function () {}); throw res.error; }
    return { no: res.data.no, title: res.data.title, eksik: eksik };
  }
  /* bekleyenler: bağlantı/oturum gelince sırayla gider */
  var bosaltiyor = false;
  async function bosalt() {
    if (bosaltiyor) return; var k = kuyruk(); if (!k.length) return rozet();
    var c = sb(); if (!c) return; bosaltiyor = true;
    try {
      while (k.length) {
        var x = k[0];
        try { await gonder(c, x.kayit, (x.gorsel || []).map(function (g) { var b = urlBlob(g.url); return b ? { blob: b, type: g.type, ext: g.ext } : null; }).filter(Boolean)); }
        catch (e) { break; }
        k.shift(); lsKoy(LS_KUYRUK, k);
      }
    } finally { bosaltiyor = false; rozet(); if (st && !st.done) paint(); }
  }
  async function beklet(kayit, gorseller) {
    var g = [];
    for (var i = 0; i < gorseller.length; i++) { var u = await blobUrl(gorseller[i].blob); if (u) g.push({ url: u, type: gorseller[i].type, ext: gorseller[i].ext }); }
    var k = kuyruk(); k.push({ kayit: kayit, gorsel: g, t: Date.now() });
    if (!lsKoy(LS_KUYRUK, k)) { k[k.length - 1].gorsel = []; if (!lsKoy(LS_KUYRUK, k)) return false; }   /* yer yoksa görüntüsüz sakla */
    rozet(); return true;
  }
  async function save() {
    if (!st || st.saving) return;
    var title = String(st.v.title || '').trim();
    st.err = title.length < 3 ? 'Kısa bir başlık yaz (en az 3 harf).' : '';
    if (st.err) { paint(); return; }
    st.saving = true; paint();
    var c = sb(), bk = bildiren();
    var d = { ortam: st.v.ortam || st.env.ortam, ekran: st.env.ekran, adres: st.env.adres };
    KIND[st.kind].f.forEach(function (f) { var v = String(st.v[f[0]] || '').trim(); if (v) d[f[0]] = v; });
    var kayit = { kind: st.kind, title: title, page: st.page, device: st.device, detail: d, source: 'uygulama', reporter_email: bk ? bk.email : null };
    try {
      var sonuc = await gonder(c, kayit, st.shots);
      st.shots.forEach(function (s) { URL.revokeObjectURL(s.url); });
      st.done = { no: sonuc.no, title: sonuc.title, eksik: sonuc.eksik, kim: bk && ME && bk.email !== ME.email ? bk.name : '' }; st.saving = false; paint();
      bosalt();
    } catch (e) {
      var neden = turkce(e), ok = await beklet(kayit, st.shots);
      st.saving = false;
      if (ok) { st.shots.forEach(function (s) { URL.revokeObjectURL(s.url); }); st.done = { bekliyor: true, neden: neden }; }
      else st.err = neden.replace(/Kayıt bu cihazda bekliyor[^.]*\./, 'Cihazda yer olmadığı için saklanamadı; tekrar dene.');
      paint();
    }
  }
  async function onClick(e) {
    var t = e.target, x;
    if (t.closest('[data-axt-open]')) { open(); setTimeout(function () { var k = root.querySelector('.k'); if (k) k.focus(); }, 30); return; }
    if (!st) return;
    if (t.closest('[data-axt-close]')) { close(); return; }
    if (t.closest('[data-axt-again]')) { open(); return; }
    if ((x = t.closest('[data-axt-kim]'))) { st.bildiren = x.getAttribute('data-axt-kim'); lsKoy(LS_BILDIREN, st.bildiren); paint(); return; }
    if ((x = t.closest('[data-axt-kind]'))) { st.kind = x.getAttribute('data-axt-kind'); st.err = ''; paint(); var ti = root.querySelector('[data-k="title"]'); if (ti && !ti.value) ti.focus(); return; }
    if ((x = t.closest('[data-axt-rm]'))) { var r = st.shots.splice(+x.getAttribute('data-axt-rm'), 1)[0]; if (r) URL.revokeObjectURL(r.url); paint(); return; }
    if (t.closest('[data-axt-cap]')) {
      try { var s = await captureScreen(); if (st && s && s.blob) { s.url = URL.createObjectURL(s.blob); st.shots.push(s); paint(); } }
      catch (er) { if (st && er && er.name !== 'NotAllowedError' && er.name !== 'AbortError') { st.err = 'Ekran yakalanamadı; görüntüyü seçerek ekleyebilirsin.'; paint(); } }
      return;
    }
    if (t.closest('[data-axt-save]')) save();
  }

  /* ---------- kimlik: yalnız test ekibi ---------- */
  async function init() {
    var c = sb(); if (!c) return;
    try {
      var s = await c.auth.getSession(), u = s && s.data && s.data.session && s.data.session.user; if (!u) return;
      var email = String(u.email || '').toLowerCase();
      var r = await c.from('tp_members').select('email,name,color').eq('email', email).maybeSingle();
      if (r.error || !r.data) return;   // tablo yok ya da ekipte değil: sessiz
      USER = u; ME = r.data;
      var ek = await c.from('tp_members').select('email,name,color').order('name'); EKIP = (ek.data || []).map(function (m) { return { email: String(m.email).toLowerCase(), name: m.name, color: m.color }; });
      if (!uye(ME.email)) EKIP.unshift({ email: ME.email, name: ME.name, color: ME.color });
      mount(); rozet(); bosalt();
      window.addEventListener('online', bosalt);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) bosalt(); });
    } catch (e) { /* sessiz */ }
  }
  window.acadexTest = { open: function () { if (ME) open(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 1200); });
  else setTimeout(init, 1200);
})();
