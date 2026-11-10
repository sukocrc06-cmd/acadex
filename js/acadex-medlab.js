/* ================= ACADEX MEDLAB: sağlık bilimleri öğrencilerine özel laboratuvarlar ================= */
/* Görünüm dashboard.html → #medlab-view; stiller css/acadex-medlab.css.
   Her laboratuvar labs/<ad>/index.html altında kendi başına çalışan bir sayfadır;
   karttan açılınca tam ekran katmandaki iframe'e yüklenir (veri ağır, o yüzden ilk açılışta). */
(function () {
  'use strict';
  var sec = document.getElementById('medlab-view'); if (!sec) return;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var LABS = {
    medica: { t: 'Acadex Medica', src: 'labs/medica/index.html' }, /* eğitim hastanesi: bütün klinik vakalar (labs/klinik senaryoları), lab'lara devir */
    anatomi: { t: 'Anatomi Lab', src: 'labs/anatomi/index.html' },
    fizyo: { t: 'Fizyo Lab', src: 'labs/fizyo/index.html' }, /* 3B veriyi ../anatomi/data/ yolundan paylaşır */
    odyoloji: { t: 'Odyoloji Lab', src: 'labs/odyoloji/index.html' }, /* kabin, 3B kulak (data/ax-kulak.js), vaka masası */
    diyet: { t: 'Diyet Lab', src: 'labs/diyet/index.html' }, /* tabak & menü (data/besin.js, USDA SR28), antropometri, vaka, enteral/parenteral */
    dkt: { t: 'DKT Lab', src: 'labs/dkt/index.html' }, /* terapi odası: sesletim, ses laboratuvarı (mikrofon), akıcılık, yutma, dil/afazi, vaka */
    eczacilik: { t: 'Eczacılık Lab', src: 'labs/eczacilik/index.html' }, /* mahalle eczanesi: tezgâh, doz, etkileşim, majistral, vaka */
    hemsirelik: { t: 'Hemşirelik Lab', src: 'labs/hemsirelik/index.html' } /* servis: vital/NEWS2, beceri, ilaç uygulama, vardiya, vaka */
  };
  window.AX_MEDLABS = LABS;

  /* tam ekran katman: section'a geçiş animasyonunda transform verildiği için body'ye taşınır */
  var run = sec.querySelector('[data-medlab-run]'), frame = run.querySelector('[data-medlab-frame]');
  var titleEl = run.querySelector('[data-medlab-title]'), newTab = run.querySelector('[data-medlab-newtab]');
  var loadEl = run.querySelector('[data-medlab-load]');
  document.body.appendChild(run);
  var cur = null, lastBtn = null;
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* katman kartın kutusundan büyür / kapanırken oraya döner */
  var inset = function (b) {
    var r = lsafe(function () { return b && b.getBoundingClientRect(); }, null); if (!r || !r.width) return null;
    var W = window.innerWidth, H = window.innerHeight;
    return 'inset(' + Math.max(0, r.top) + 'px ' + Math.max(0, W - r.right) + 'px ' + Math.max(0, H - r.bottom) + 'px ' + Math.max(0, r.left) + 'px round 8px)';
  };
  var grow = function (b, back, done) {
    var from = calm ? null : inset(b);
    if (!from) { if (done) done(); return; }
    run.classList.remove('axm-grow'); run.style.clipPath = back ? 'inset(0 round 0)' : from; void run.offsetWidth;
    run.classList.add('axm-grow'); run.style.clipPath = back ? from : 'inset(0 round 0)';
    clearTimeout(grow.t); grow.t = setTimeout(function () { run.classList.remove('axm-grow'); run.style.clipPath = ''; if (done) done(); }, 560);
  };

  /* yükleniyor ekranı: iframe'in sayfası gelene kadar (3B veri sonra labın kendi göstergesiyle iner) */
  var hideLoad = function () { if (!loadEl || loadEl.hidden) return; loadEl.classList.add('out'); setTimeout(function () { loadEl.hidden = true; loadEl.classList.remove('out'); }, 360); };
  frame.addEventListener('load', function () { if (frame.getAttribute('src')) setTimeout(hideLoad, 250); });

  var open = function (k) {
    var L = LABS[k]; if (!L) return false;
    cur = k; titleEl.textContent = L.t; frame.title = L.t; newTab.href = L.src;
    /* ?medlab=1: lab kendi Acadia'sını gizler, sitenin Acadia'sıyla köprü kurar (js/acadex-medlab-acadia.js); yeni sekme köprüsüz açılır */
    var fsrc = L.src + '?medlab=1';
    if (frame.getAttribute('src') !== fsrc) { if (loadEl) { loadEl.classList.remove('out'); loadEl.hidden = false; } frame.setAttribute('src', fsrc); }
    run.hidden = false; document.body.classList.add('axm-open'); kampusMesaj({ type: 'gorunur', v: false });
    grow(lastBtn, false);
    if (typeof window.axMedLabHook === 'function') lsafe(function () { window.axMedLabHook(k, frame); });
    setTimeout(function () { lsafe(function () { frame.focus(); }); }, 60);
    return true;
  };
  var close = function (now) {
    if (run.hidden) return;
    cur = null; kampusMesaj({ type: 'gorunur', v: true }); kampusMesaj({ type: 'geri' });
    if (typeof window.axMedLabHook === 'function') lsafe(function () { window.axMedLabHook(null, frame); });
    var b = lastBtn, fin = function () { run.hidden = true; document.body.classList.remove('axm-open'); if (b && now !== true) lsafe(function () { b.focus(); }); };
    if (now !== true && sec.classList.contains('active')) grow(b, true, fin); else { clearTimeout(grow.t); run.classList.remove('axm-grow'); if (run.style) run.style.clipPath = ''; fin(); }
  };

  /* ---------------- 3B kampüs (01.11.2026): MedLab'in girişi labs/kampus/index.html ----------------
     Kampüs ayrı sayfada (kendi three.js importmap'i) iframe'de çalışır; yalnız MedLab açıkken yüklenir,
     başka panele geçince boşaltılır (WebGL belleği serbest kalır). Binaya girilince kampüs {type:'ac'}
     gönderir, lab bu katmanda açılır; katman kapanınca kampüse 'geri' gider. Zayıf cihaz ya da "2B"
     seçimi liste görünümüne (lab kartları) geçirir. */
  var kmp = sec.querySelector('[data-medlab-kampus]'), kfr = kmp && kmp.querySelector('[data-kampus-frame]'), kon = kmp && kmp.querySelector('[data-kampus-on]');
  var kListe = sec.querySelector('[data-kampus-liste]'), KG = 'axKampusGrafik', KSRC = 'labs/kampus/index.html';
  var mod3b = !!kfr && lsafe(function () { return localStorage.getItem(KG); }, null) !== '2b';
  var kampusMesaj = function (m) { if (!kfr || !kfr.getAttribute('src')) return; m.src = 'axhost-kampus'; lsafe(function () { kfr.contentWindow.postMessage(m, location.origin); }); };
  var kampusAc = function () { if (!kfr || !mod3b || kfr.getAttribute('src') === KSRC) return; if (kon) kon.hidden = false; kfr.setAttribute('src', KSRC); };
  var kampusBosalt = function () { if (!kfr || !kfr.getAttribute('src')) return; kfr.removeAttribute('src'); lsafe(function () { kfr.contentWindow.location.replace('about:blank'); }); };
  var kampusMod = function (m, kalici) {
    mod3b = m === '3b' && !!kfr;
    sec.classList.toggle('axm-3b', mod3b); if (kListe) kListe.hidden = mod3b || !kfr;
    if (kalici) lsafe(function () { localStorage.setItem(KG, mod3b ? 'oto' : '2b'); });
    if (mod3b) { if (sec.classList.contains('active')) kampusAc(); } else kampusBosalt();
  };
  window.axMedLabKampus = kampusMod;
  if (kfr) {
    kampusMod(mod3b ? '3b' : 'liste');
    sec.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-kampus-mod]'); if (b) kampusMod(b.getAttribute('data-kampus-mod'), true); });
    if (window.addEventListener) window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !kfr.contentWindow || e.source !== kfr.contentWindow) return;
      var d = e.data; if (!d || d.src !== 'axkampus') return;
      if (d.type === 'hazir' && kon) kon.hidden = true;
      if (d.type === 'boy' && d.h > 0) kfr.style.height = Math.max(320, Math.min(2400, Math.round(d.h))) + 'px';
      if (d.type === 'ac' && LABS[d.lab]) { lastBtn = kfr; open(d.lab); }
      if (d.type === '2b') kampusMod('liste', !!d.kalici);
    });
    if (sec.classList.contains('active')) kampusAc();
    /* kampüs ekrandan çıkınca ya da lab katmanı açıkken çizim durur */
    if (typeof IntersectionObserver === 'function') new IntersectionObserver(function (es) { kampusMesaj({ type: 'gorunur', v: es.some(function (x) { return x.isIntersecting; }) && run.hidden }); }).observe(kfr);
  }

  /* monitördeki nabız: her birkaç vuruşta 68–78 arasında oynar */
  var bpm = sec.querySelector('[data-medlab-bpm]');
  if (bpm && !calm) setInterval(function () { if (!document.hidden && sec.classList.contains('active')) bpm.textContent = String(68 + Math.round(Math.random() * 10)); }, 2500);
  window.axMedLabOpen = function (k) { if (typeof switchDashboardView === 'function') switchDashboardView('medlab'); return open(k); };
  window.axMedLabClose = close;

  sec.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-medlab-open]'); if (!b) return;
    lastBtn = b; open(b.getAttribute('data-medlab-open'));
  });
  run.querySelector('[data-medlab-close]').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !run.hidden && !document.querySelector('dialog[open]')) close(); });

  /* dashboard bağlantısı: dashboard.js'teki sekme listesi medlab'i tanımaz, kenar menü ve ilk açılışı burada tutarız */
  if (typeof switchDashboardView === 'function') {
    var origSwitch = switchDashboardView;
    switchDashboardView = function (v) {
      var side = document.getElementById('side-medlab'); if (side) side.classList.toggle('active', v === 'medlab');
      if (v !== 'medlab') { close(true); kampusBosalt(); } else setTimeout(kampusAc, 0);
      if (v === 'medlab' && !document.querySelector('.dashboard-view-section.active')) {
        sec.classList.add('active'); lsafe(function () { currentActiveTab = 'medlab'; });
        Array.prototype.forEach.call(document.querySelectorAll('.sidebar-item.active'), function (x) { if (x !== side) x.classList.remove('active'); });
        return;
      }
      var r = origSwitch.apply(this, arguments);
      if (v === 'medlab') Array.prototype.forEach.call(document.querySelectorAll('.sidebar-item.active'), function (x) { if (x !== side) x.classList.remove('active'); });
      return r;
    };
    window.switchDashboardView = switchDashboardView;
  }

  /* Acadex Medica kapağı (06.11.2026): Uzm. Dr. Ela Altındağ. Kart ilk kez görününce sinematik açılış
     (css/acadex-medlab.css → med-bekle / med-oyna), balonda "hoş geldin!" yazılır; gözleri imleci izler;
     kartın üstüne gelince kapıyı gösterip "buyur, gir!" der. Hareket azaltılmışsa yalnız son kare. */
  (function medKapak() {
    var svg = sec.querySelector('[data-medica-kapak]'); if (!svg) return;
    var btn = svg.closest('[data-medlab-open]'), bubT = svg.querySelector('.med-bub-t'), bebek = svg.querySelector('.med-dr .dr-bebek'), goz = svg.querySelector('.med-dr .dr-goz');
    var MET = { gel: 'hoş geldin!', buyur: 'buyur, gir!' };
    var yazT = 0, yaz = function (m, hizli) {
      clearInterval(yazT); if (!bubT) return;
      if (calm || hizli) { bubT.textContent = m; return; }
      var i = 0; bubT.textContent = ''; svg.classList.add('med-konus');
      yazT = setInterval(function () { i++; bubT.textContent = m.slice(0, i); if (i >= m.length) { clearInterval(yazT); svg.classList.remove('med-konus'); } }, 70);
    };
    if (!calm && typeof IntersectionObserver === 'function') {
      svg.classList.add('med-bekle');
      var io = new IntersectionObserver(function (es) {
        if (!es.some(function (x) { return x.isIntersecting; })) return;
        io.disconnect(); svg.classList.remove('med-bekle'); svg.classList.add('med-oyna');
        if (bubT) bubT.textContent = '';
        setTimeout(function () { yaz(MET.gel); }, 2700);
      }, { threshold: 0.35 });
      io.observe(svg);
    }
    if (btn) {
      var ac = function () { yaz(MET.buyur, false); }, kapa = function () { yaz(MET.gel, true); };
      btn.addEventListener('pointerenter', ac); btn.addEventListener('focus', ac);
      btn.addEventListener('pointerleave', kapa); btn.addEventListener('blur', kapa);
    }
    /* bakış: bebekler imlece doğru en çok 2,4 birim kayar (kart görünürken, kare başına bir kez) */
    if (!calm && bebek && goz && window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      var px = 0, py = 0, bek = false;
      var bak = function () {
        bek = false; if (!sec.classList.contains('active') && !sec.offsetParent) return;
        var r = lsafe(function () { return goz.getBoundingClientRect(); }, null); if (!r || !r.width) return;
        var dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2), d = Math.sqrt(dx * dx + dy * dy) || 1, k = Math.min(1, d / 260) * 2.4;
        bebek.style.transform = 'translate(' + (dx / d * k).toFixed(2) + 'px,' + (dy / d * k * 0.8).toFixed(2) + 'px)';
      };
      window.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!bek) { bek = true; requestAnimationFrame(bak); } }, { passive: true });
    }
  })();
})();
