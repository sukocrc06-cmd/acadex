/* ==========================================================================
   ACADIA REHBER (js/acadia-rehber.js), 28.10.2026 — landing'de anlatıcı eşlikçi
   Acadia sayfanın sağında durur; scroll'la bölümden bölüme süzülür, her durakta
   poz/ifade değiştirir ve kısa bir balonla bölümü anlatır. Hızlı scroll'da hafifçe
   yatar, tıklayınca zıplar ve bir sonraki cümleyi söyler. Gözleri imleci izler.
   Telefonda sağ altta, küçük ve balonu kısa süreli. Hareket azaltmada sabit durur,
   yalnız ifade ve balon değişir. Çizim: js/acadia-kit.js.
   YILDIZ UÇUŞU (02.11.2026): geniş ekranda sabit durmaz; her bölümde o bölümün kenarına
   (sağa ya da sola) kavisli bir yay çizerek süzülür, dururken hafifçe sekiz çizer.
   Arkasında altın sarısı bir kuyruklu yıldız izi ve pırıltılar bırakır (#acd-trail,
   tek tuval). Konuşurken durur, balon her zaman sayfanın içine doğru açılır.
   ========================================================================== */
(function () {
  'use strict';
  var K = window.AcadiaKit; if (!K || !window.IntersectionObserver) return;
  var D = document, W = window;
  var calm = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var STOPS = [
    { q: '[data-hero]', side: 'r', pose: 'selam', mood: 'mutlu', y: 34, t: 'Merhaba, ben Acadia! Notlarını birlikte sınava hazırlayalım.' },
    { q: '[data-mfs]', side: 'l', pose: 'isaret', mood: 'kirp', y: 20, t: 'Hangi ders olursa olsun: okumayı kısaltmam, anlamayı hızlandırırım.' },
    { q: '#nasil', side: 'r', pose: 'oku', mood: 'odakli', y: 40, t: 'Yükle, özetle, çalış, ölç. Dört adımın hepsinde yanındayım.' },
    { q: '#alanlar', side: 'l', pose: 'dusun', mood: 'dusunuyor', y: 22, t: 'Ezberden değil, anlamaktan yanayım.' },
    { q: '#yontemler', side: 'r', pose: 'isaret', mood: 'mutlu', y: 38, t: 'Pomodoro, aralıklı tekrar, Feynman… hepsi tek masada.' },
    { q: '#akis', side: 'l', pose: 'dur', mood: 'odakli', y: 20, t: 'Her derse ona uyan tekniği öneririm.' },
    { q: '#medlab', side: 'r', pose: 'isaret', mood: 'mutlu', y: 40, costume: 'medlab', t: 'Stetoskobumu taktım; sağlık kampüsünü birlikte gezelim.' },
    { q: '#gizlilik', side: 'l', pose: 'dur', mood: 'odakli', y: 20, t: 'Notların sende kalır; kimseye göstermem.' },
    { q: '#soru', side: 'r', pose: 'dusun', mood: 'dusunuyor', y: 42, t: 'Aklına takılan bir şey mi var? Sor, cevaplayalım.' },
    { q: '#kayit', side: 'l', pose: 'zipla', mood: 'kutlama', y: 22, t: 'Hazırsan başlayalım!' }
  ];
  var EXTRA = ['Bir daha dürtersen gıdıklanırım.', 'Sınav haftası gelmeden başlayan kazanır.', 'Kartlarını ben sıralarım, sen sadece çevir.', 'Yıldız değilim ama sınavda parlatırım.'];

  var g = D.createElement('div'); g.className = 'acd-guide'; g.setAttribute('aria-hidden', 'true');
  var host = D.createElement('span'); host.className = 'acd-gh say-l'; host.setAttribute('data-acadia', ''); host.dataset.mood = 'mutlu'; host.dataset.pose = 'selam'; host.dataset.size = '150';
  var live = D.createElement('p'); live.className = 'acd-live'; live.setAttribute('aria-live', 'polite');
  g.appendChild(host); D.body.appendChild(g); D.body.appendChild(live);
  K.mount();

  /* bölümler kendi anlatımlarını yaptırabilir (ör. MedLab kampüs turu: js/acadex-kampus-tur.js) */
  var api = W.acadiaRehber = { at: '', say: function (text, mood, pose) {
    if (mood) host.dataset.mood = mood; if (pose) host.dataset.pose = pose; host.__acdV = -1; K.mount();
    if (!calm) { host.classList.remove('acd-hop'); void host.offsetWidth; host.classList.add('acd-hop'); }
    K.say(host, text, narrow() ? 3800 : 0); live.textContent = text;
  } };
  var cur = -1, extraI = 0, hideT = 0, narrow = function () { return W.innerWidth < 900; };
  var go = function (i) {
    if (i === cur || !STOPS[i]) return; cur = i; var s = STOPS[i];
    host.dataset.pose = s.pose; host.dataset.mood = s.mood; delete host.dataset.moodNow;
    if (s.costume) host.dataset.costume = s.costume; else delete host.dataset.costume;
    api.at = s.el ? s.el.id : '';
    host.__acdV = -1; K.mount();
    g.style.setProperty('--gy', s.y + 'vh');
    g.classList.toggle('on-dark', !!(s.el && (s.el.classList.contains('dk'))));
    live.textContent = s.t;
    if (fly.on) { fly.to(s); return; }
    if (!calm) { host.classList.remove('acd-hop'); void host.offsetWidth; host.classList.add('acd-hop'); }
    K.say(host, s.t, narrow() ? 3800 : 0);
  };

  /* ---------- yıldız uçuşu + ışık izi (geniş ekran, hareket serbest) ---------- */
  var fly = { on: false, to: function () {} };
  (function () {
    if (calm) return;
    var cv = D.createElement('canvas'); cv.id = 'acd-trail'; cv.hidden = true; cv.setAttribute('aria-hidden', 'true'); D.body.appendChild(cv);
    var cx = cv.getContext('2d'); if (!cx) return;
    var dpr = 1, VW = 0, VH = 0, GW = 150, GH = 170;
    var pos = { x: 0, y: 0 }, from = null, ctrl = null, dest = null, t0 = 0, dur = 1, flying = false, side = 'r', stop = null;
    var parts = [], ribbon = [], last = { x: 0, y: 0 }, vx = 0, vy = 0, raf = 0, lastT = 0, nextSpark = 0, sayT = 0;
    var size = function () {
      dpr = Math.min(2, W.devicePixelRatio || 1); VW = W.innerWidth; VH = W.innerHeight;
      cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var r = host.getBoundingClientRect(); if (r.width) { GW = r.width; GH = r.height; }
    };
    var margin = function () { return Math.max(8, Math.min(34, VW * 0.022)); };
    /* solda paket ipi (.pkt-dock, x≈40) ve balonu var: sol duraklar ipin sağında ve onun üstünde */
    var dock = D.querySelector('.pkt-dock');
    var leftX = function () { return dock && dock.getBoundingClientRect().left < 120 && +getComputedStyle(dock).opacity > 0.1 ? 78 : margin(); };
    var spot = function (s) { return { x: (s.side === 'l' ? leftX() : VW - margin() - GW), y: VH * s.y / 100 - GH / 2 }; };
    var ease = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    var hush = function () { var b = host.querySelector('.acd-say'); if (b) { clearTimeout(b.__t); b.classList.remove('on'); } };
    var setSide = function (sd) { side = sd; host.classList.toggle('say-l', sd !== 'l'); host.classList.toggle('say-r', sd === 'l'); };
    fly.to = function (s) {
      stop = s; dest = spot(s); from = { x: pos.x, y: pos.y };
      var dx = dest.x - from.x, dy = dest.y - from.y, dist = Math.hypot(dx, dy);
      if (dist < 6) { setSide(s.side); arrive(); return; }
      /* yay: aradaki noktanın yukarısından (kenar değişiyorsa daha geniş) */
      /* EKRANDA KALAN YAY (02.11.2026): sol duraklar üstte; yukarı kavis Acadia'yı ekranın
         üstünden dışarı taşıyordu. Yer varsa yukarı, yoksa aşağı kavis; tepe noktası
         menünün altında ve ekranın içinde kalır. */
      var top = 76, bot = VH - GH - 24, lift = 60 + Math.abs(dx) * 0.12, cxp = from.x + dx / 2 + (Math.abs(dx) > VW * 0.3 ? 0 : (s.side === 'l' ? 1 : -1) * VW * 0.12);
      var cy = Math.min(from.y, dest.y) - lift;
      if (0.25 * from.y + 0.5 * cy + 0.25 * dest.y < top) cy = Math.max(from.y, dest.y) + lift;
      cy = Math.max(2 * top - 0.5 * (from.y + dest.y), Math.min(2 * bot - 0.5 * (from.y + dest.y), cy));
      ctrl = { x: cxp, y: cy };
      dur = Math.min(2100, 900 + dist * 1.1); t0 = performance.now(); flying = true;
      hush(); clearTimeout(sayT); g.classList.add('acd-flying');
      host.classList.remove('acd-hop');
      if (s.side !== side) setTimeout(function () { if (stop === s) setSide(s.side); }, dur * 0.5);
      start();
    };
    var arrive = function () {
      flying = false; g.classList.remove('acd-flying');
      if (!stop) return;
      host.classList.remove('acd-hop'); void host.offsetWidth; host.classList.add('acd-hop');
      for (var i = 0; i < 5; i++) burst(1);
      var s = stop; sayT = setTimeout(function () { if (stop === s && !flying) K.say(host, s.t, 0); }, 120);
    };
    var emit = function (x, y, n, fast) {
      for (var i = 0; i < n; i++) parts.push({ x: x + (Math.random() - .5) * 6, y: y + (Math.random() - .5) * 6, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 + .08, life: 0, max: (fast ? 34 : 54) + Math.random() * 24, r: .6 + Math.random() * .8, star: Math.random() < .12 });
    };
    var burst = function () { var c = center(), a = Math.random() * Math.PI * 2, sp = .5 + Math.random() * 1.1; parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 46 + Math.random() * 20, r: .7 + Math.random() * .8, star: Math.random() < .3 }); };
    var center = function () { return { x: pos.x + GW * 0.5, y: pos.y + GH * 0.42 }; };
    var drawStar = function (x, y, r) { cx.beginPath(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? r * .35 : r * 1.9; cx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } cx.closePath(); cx.fill(); };
    var frame = function (now) {
      raf = 0; var dt = Math.min(48, now - (lastT || now)); lastT = now;
      if (flying) {
        var k = Math.min(1, (now - t0) / dur), e = ease(k), u = 1 - e;
        pos.x = u * u * from.x + 2 * u * e * ctrl.x + e * e * dest.x; pos.y = u * u * from.y + 2 * u * e * ctrl.y + e * e * dest.y;
        if (k >= 1) { pos.x = dest.x; pos.y = dest.y; arrive(); }
      } else if (dest) {
        var tt = now / 1000;                                   /* dururken sekiz çizerek süzülür */
        pos.x = dest.x + Math.sin(tt * .7) * 12; pos.y = dest.y + Math.sin(tt * 1.4) * 7;
      }
      vx = vx * .7 + (pos.x - last.x) * .3; vy = vy * .7 + (pos.y - last.y) * .3; last.x = pos.x; last.y = pos.y;
      var sp = Math.hypot(vx, vy), bank = Math.max(-18, Math.min(18, vx * 1.4));
      g.style.transform = 'translate3d(' + pos.x.toFixed(1) + 'px,' + pos.y.toFixed(1) + 'px,0) rotate(' + bank.toFixed(1) + 'deg)';
      var c = center();
      if (!g.classList.contains('away') && D.visibilityState === 'visible') {
        if (sp > .8) { ribbon.push({ x: c.x, y: c.y, a: 1 }); if (now > nextSpark) { emit(c.x, c.y, 1, true); nextSpark = now + 70; } }
        else if (now > nextSpark) { emit(c.x + (Math.random() - .5) * GW * .6, c.y + (Math.random() - .5) * GH * .5, 1, false); nextSpark = now + 700 + Math.random() * 600; }
      }
      cx.clearRect(0, 0, VW, VH);
      cx.globalCompositeOperation = 'lighter';
      /* kuyruk: incelerek sönen altın şerit */
      for (var i = ribbon.length - 1; i >= 0; i--) { ribbon[i].a -= dt / 900; if (ribbon[i].a <= 0) ribbon.splice(i, 1); }
      if (ribbon.length > 48) ribbon.splice(0, ribbon.length - 48);
      /* ince, sakin bir altın çizgi: uca doğru incelir ve söner; altında çok hafif bir parıltı */
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      for (var pass = 0; pass < 2; pass++) for (var j = 1; j < ribbon.length; j++) {
        var p0 = ribbon[j - 1], p1 = ribbon[j], f = j / ribbon.length, a = Math.min(p0.a, p1.a) * f;
        cx.strokeStyle = pass ? 'rgba(242,184,64,' + (a * .8).toFixed(3) + ')' : 'rgba(255,200,90,' + (a * .14).toFixed(3) + ')';
        cx.lineWidth = pass ? .6 + 1.4 * a : 3 + 4 * a;
        cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke();
      }
      for (var q = parts.length - 1; q >= 0; q--) {
        var P = parts[q]; P.life += dt / 16.7; P.x += P.vx * dt / 16.7; P.y += P.vy * dt / 16.7; P.vx *= .985; P.vy *= .985;
        var L = 1 - P.life / P.max; if (L <= 0) { parts.splice(q, 1); continue; }
        var gr = cx.createRadialGradient(P.x, P.y, 0, P.x, P.y, P.r * 4);
        gr.addColorStop(0, 'rgba(255,250,225,' + (L * .8).toFixed(3) + ')'); gr.addColorStop(.35, 'rgba(255,214,107,' + (L * .4).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,181,71,0)');
        cx.fillStyle = gr; cx.beginPath(); cx.arc(P.x, P.y, P.r * 4, 0, Math.PI * 2); cx.fill();
        if (P.star) { cx.fillStyle = 'rgba(255,244,200,' + (L * .9).toFixed(3) + ')'; drawStar(P.x, P.y, P.r * L + .4); }
      }
      if (parts.length > 120) parts.splice(0, parts.length - 120);
      cx.globalCompositeOperation = 'source-over';
      start();
    };
    var start = function () { if (!raf && fly.on && D.visibilityState === 'visible') raf = requestAnimationFrame(frame); };
    var apply = function () {
      var want = !narrow();
      if (want === fly.on) { if (want) { size(); if (stop && !flying) { dest = spot(stop); } } return; }
      fly.on = want; g.classList.toggle('acd-fly', want); cv.hidden = !want;
      if (want) {
        size(); pos.x = VW + 40; pos.y = VH * .3; last.x = pos.x; last.y = pos.y; setSide('r');
        if (cur > -1) fly.to(STOPS[cur]);
      } else { g.style.transform = ''; parts = []; ribbon = []; cx.clearRect(0, 0, VW, VH); host.classList.add('say-l'); host.classList.remove('say-r'); if (cur > -1) K.say(host, STOPS[cur].t, 3800); }
      start();
    };
    W.addEventListener('resize', function () { apply(); });
    D.addEventListener('visibilitychange', start);
    apply();
  })();

  STOPS.forEach(function (s, i) { s.el = D.querySelector(s.q); });
  var vis = STOPS.map(function () { return 0; });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { var i = STOPS.findIndex(function (s) { return s.el === e.target; }); if (i > -1) vis[i] = e.isIntersecting ? e.intersectionRatio : 0; });
    var best = -1, bv = 0; vis.forEach(function (v, i) { if (v > bv) { bv = v; best = i; } });
    if (best > -1) go(best);
  }, { threshold: [0, .15, .3, .5, .7], rootMargin: '-20% 0px -30% 0px' });
  STOPS.forEach(function (s) { if (s.el) io.observe(s.el); });

  /* scroll hızına göre hafif yatma, sayfa sonunda saklanma */
  if (!calm) {
    var lastY = W.scrollY, raf = 0, tilt = 0;
    W.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0; var y = W.scrollY, v = y - lastY; lastY = y;
        if (fly.on) return;
        tilt = Math.max(-14, Math.min(14, v * 0.6));
        g.style.setProperty('--gt', tilt.toFixed(1) + 'deg');
        clearTimeout(hideT); hideT = setTimeout(function () { g.style.setProperty('--gt', '0deg'); }, 160);
      });
    }, { passive: true });
  }
  var foot = D.querySelector('footer');
  if (foot) new IntersectionObserver(function (es) { g.classList.toggle('away', es[0].isIntersecting); }, { threshold: 0.2 }).observe(foot);
  /* paket panosu açıkken çekil */
  var board = D.querySelector('[data-pkt-board]');
  if (board && W.MutationObserver) new MutationObserver(function () { g.classList.toggle('away', !board.hidden); }).observe(board, { attributes: true, attributeFilter: ['hidden'] });

  /* tıklayınca zıpla, sıradaki cümle */
  host.style.pointerEvents = 'auto';
  host.addEventListener('click', function () {
    K.react(host, 'kirp', 1200);
    K.say(host, EXTRA[extraI++ % EXTRA.length], 3200);
  });
  W.addEventListener('load', function () { g.classList.add('in'); });
  setTimeout(function () { g.classList.add('in'); }, 1200);
})();
