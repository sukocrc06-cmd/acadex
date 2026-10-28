/* ==========================================================================
   LANDING · MEDLAB SCROLL FİLMİ (js/acadex-medlab-film.js), 28.10.2026
   section#medlab içinde: 96 kare (assets/landing/medlab/fNNN.webp) Anatomi Lab'in
   gerçek 3B modelinden çekildi. Scroll ilerledikçe kare değişir; sahne sabit kalır.
     - Kareler bölüm yaklaşınca yüklenir (önce her 8. kare, sonra hepsi); telefonda ve
       veri tasarrufunda her 2. kare. Henüz gelmeyen kare yerine en yakın yüklenen çizilir.
     - Hareket azaltmada film oynamaz; her adımda o adımın tek karesi gösterilir.
     - Sağdaki Acadia rehberi (js/acadia-rehber.js) bu bölümde stetoskop takar ve
       her adımda kısa bir cümle söyler (window.acadiaRehber.say).
     - v2 (28.10.2026): kareler 2x süper örneklemeyle "yüksek" kalitede çekildi.
       Masaüstü 960×1200 (hd/), telefon 640×800 (kök klasör). Etiketler yapıya
       bağlı: pins.json her karede yapının ekran konumunu tutar (çekimde modelden
       hesaplandı); etiket modelle birlikte hareket eder, yapı görünmüyorsa söner.
   ========================================================================== */
(function () {
  'use strict';
  var sec = document.getElementById('medlab'); if (!sec) return;
  var W = window, D = document;
  var calm = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var BASE = 'assets/landing/medlab/';
  var phone = W.innerWidth < 860 || !!(navigator.connection && navigator.connection.saveData);
  var N = 96, SET = phone ? '' : 'hd/', SRC = function (i) { return BASE + SET + 'f' + ('00' + i).slice(-3) + '.webp'; };
  var cv = sec.querySelector('canvas'), ctx = cv.getContext('2d'), track = sec.querySelector('.mf-track');
  var steps = Array.prototype.slice.call(sec.querySelectorAll('.mf-step')), rail = Array.prototype.slice.call(sec.querySelectorAll('.mf-rail li')), pinsEl = sec.querySelector('.mf-pins'), svg = sec.querySelector('.mf-lines');
  var loadEl = sec.querySelector('.mf-load');
  /* adım sınırları (0–1 ilerleme) ve her adımın sakin karesi */
  var STEP = [[0, .2, 10], [.2, .46, 34], [.46, .6, 54], [.6, .8, 72], [.8, 1.01, 95]];
  var SAY = [
    ['Bu gerçek bir 3B insan modeli; önce kaslar.', 'mutlu', 'isaret'],
    ['Şimdi kasları yüzeyden derine soyuyorum.', 'odakli', 'dusun'],
    ['İskelet ve organlar: her yapının kartı var.', 'saskin', 'isaret'],
    ['Damar ve sinirlerin seyrini modelde izliyoruz.', 'dusunuyor', 'dusun'],
    ['Göğüs kafesine yakından bak; spot sınava hazırız!', 'kutlama', 'zipla']
  ];
  var stride = phone ? 2 : 1;
  var imgs = new Array(N), ok = new Array(N), started = false, loaded = 0, want = 0, cur = -1, stepNow = -1;

  var size = function () { var r = cv.getBoundingClientRect(), d = Math.min(2, W.devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); cur = -1; paint(); };
  var nearest = function (i) { for (var k = 0; k < N; k++) { if (ok[i - k]) return i - k; if (ok[i + k]) return i + k; } return -1; };
  var draw = function (i) {
    var j = nearest(i); if (j < 0) return; if (j === cur) return; cur = j;
    var im = imgs[j], cw = cv.width, ch = cv.height, s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.clearRect(0, 0, cw, ch); ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    box = { x: (cw - w) / 2, y: (ch - h) / 2, w: w, h: h, cw: cw, ch: ch }; pins(j);
  };
  /* ---- yapıya bağlı etiketler ---- */
  var PINS = [
    [['deltoid', 'm. deltoideus', 'deltoid kası'], ['rectusabd', 'm. rectus abdominis', 'karın düz kası'], ['rectusfem', 'm. rectus femoris', 'uyluk düz kası']],
    [['biceps', 'm. biceps brachii', 'pazı kası'], ['serratus', 'm. serratus anterior', 'testere kası'], ['femur', 'femur', 'uyluk kemiği']],
    [['pulmo', 'pulmo', 'akciğer'], ['hepar', 'hepar', 'karaciğer'], ['femur', 'femur', 'uyluk kemiği']],
    [['carotis', 'a. carotis communis', 'şah damarı'], ['aorta', 'aorta thoracica', 'göğüs aortası'], ['nfemoralis', 'n. femoralis', 'uyluk siniri']],
    [['clavicula', 'clavicula', 'köprücük kemiği'], ['sternum', 'sternum', 'göğüs kemiği'], ['cor', 'cor', 'kalp']]
  ];
  var PD = null, box = null, pinEls = {}, lineEls = {}, NS = 'http://www.w3.org/2000/svg';
  if (pinsEl && W.fetch) W.fetch(BASE + 'pins.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.k && d.f) { PD = d; cur = -1; paint(); } }).catch(function () {});
  var pinAt = function (j, key) {
    var ki = PD.k.indexOf(key), f = PD.f[j]; if (ki < 0 || !f) return null;
    return { x: f[ki * 3] / 1000, y: f[ki * 3 + 1] / 1000, v: f[ki * 3 + 2] / 100 };
  };
  var pins = function (j) {
    if (!PD || !pinsEl || !box) return;
    var d = box.cw / (cv.getBoundingClientRect().width || 1), vw = box.cw / d, vh = box.ch / d, k = stepNow < 0 ? 0 : stepNow;
    var want = {}, list = [];
    PINS[k].forEach(function (p) {
      var a = pinAt(j, p[0]); if (!a || a.v < .3) return;
      var x = (box.x + a.x * box.w) / d, y = (box.y + a.y * box.h) / d;
      if (x < vw * .06 || x > vw * .94 || y < vh * .05 || y > vh * .95) return;
      /* sağ tarafta Acadia'nın balonu durur; etiketler sola toplanır, yalnız yapı çok sağdaysa sağa */
      list.push({ p: p, x: x, y: y, side: x < vw * .68 ? -1 : 1 });
    });
    /* aynı taraftaki etiketler üst üste binmesin */
    [-1, 1].forEach(function (sd) {
      var g = list.filter(function (o) { return o.side === sd; }).sort(function (a, b) { return a.y - b.y; }), last = -1e9;
      g.forEach(function (o) { o.ly = Math.max(o.y, last + (phone ? 30 : 40)); last = o.ly; });
    });
    list.forEach(function (o) {
      var id = o.p[0], el = pinEls[id], ln = lineEls[id];
      if (!el) {
        el = pinEls[id] = D.createElement('span'); el.className = 'mf-pin';
        el.innerHTML = '<i></i><b></b><small></small>'; pinsEl.appendChild(el);
        ln = lineEls[id] = D.createElementNS(NS, 'path'); svg.appendChild(ln);
      }
      el.querySelector('b').textContent = o.p[1]; el.querySelector('small').textContent = o.p[2];
      var reach = Math.max(phone ? 34 : 70, Math.min(vw * .22, 150)), lx = o.x + o.side * reach;
      /* etiket kutusu sahnenin dışına taşmasın (genişliği ölçülür) */
      var ew = el.offsetWidth || 0;
      lx = o.side < 0 ? Math.max(ew + 10, lx) : Math.min(vw - ew - 10, lx);
      el.style.setProperty('--x', o.x.toFixed(1) + 'px'); el.style.setProperty('--y', o.y.toFixed(1) + 'px');
      el.style.setProperty('--lx', lx.toFixed(1) + 'px'); el.style.setProperty('--ly', o.ly.toFixed(1) + 'px');
      el.classList.toggle('l', o.side < 0); el.classList.add('on');
      var mx = o.x + o.side * Math.min(18, reach / 3);
      ln.setAttribute('d', 'M' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ' L' + mx.toFixed(1) + ' ' + o.ly.toFixed(1) + ' L' + lx.toFixed(1) + ' ' + o.ly.toFixed(1));
      ln.setAttribute('class', 'on'); want[id] = 1;
    });
    for (var id in pinEls) if (!want[id]) { pinEls[id].classList.remove('on'); lineEls[id].setAttribute('class', ''); }
  };
  var load = function () {
    if (started) return; started = true;
    var order = [], seen = {};
    for (var i = 0; i < N; i += 8) order.push(i);
    order.push(N - 1); STEP.forEach(function (s) { order.push(s[2]); });
    for (var j = 0; j < N; j += stride) order.push(j);
    order = order.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
    want = order.length;
    var q = order.slice(), active = 0, good = 0, tried = {};
    var prog = function () {
      if (!loadEl) return;
      if (loaded < want) { loadEl.textContent = 'model yükleniyor · %' + Math.round(loaded / want * 100); return; }
      if (good) { loadEl.classList.add('done'); return; }
      sec.classList.add('mf-fail');
      loadEl.innerHTML = 'Model şu an açılamadı. <a href="register.html">MedLab’de 3B olarak gör →</a>';
    };
    var pump = function () {
      while (active < 6 && q.length) {
        (function (i) {
          active++; var im = new Image(); im.decoding = 'async'; im.src = SRC(i);
          im.onload = function () { imgs[i] = im; ok[i] = true; good++; loaded++; active--; prog(); cur = -1; paint(); pump(); };
          /* bir kez daha dene; yine olmazsa sayılır. Hiç kare gelmezse "yükleniyor"da
             takılı kalmaz, yerine açık bir not ve MedLab bağlantısı çıkar. */
          im.onerror = function () {
            if (!tried[i]) { tried[i] = 1; active--; q.push(i); return pump(); }
            active--; loaded++; prog(); pump();
          };
        })(q.shift());
      }
    };
    pump();
  };
  var progress = function () { var r = track.getBoundingClientRect(), total = r.height - W.innerHeight; return Math.max(0, Math.min(1, -r.top / (total || 1))); };
  var setStep = function (k) {
    if (k === stepNow) return; stepNow = k; cur = -1;
    steps.forEach(function (s, i) { s.classList.toggle('on', i === k); s.setAttribute('aria-hidden', String(i !== k)); });
    rail.forEach(function (l, i) { l.classList.toggle('on', i === k); });
    if (W.acadiaRehber && W.acadiaRehber.at === 'medlab') W.acadiaRehber.say(SAY[k][0], SAY[k][1], SAY[k][2]);
  };
  var paint = function () {
    var p = progress(), k = 0;
    for (var i = 0; i < STEP.length; i++) if (p >= STEP[i][0]) k = i;
    setStep(k);
    rail.forEach(function (l, i) { var s = STEP[i], f = Math.max(0, Math.min(1, (p - s[0]) / (Math.min(1, s[1]) - s[0]))); l.querySelector('i').style.width = (f * 100).toFixed(1) + '%'; });
    var fi = calm ? STEP[k][2] : Math.round(p * (N - 1));
    if (stride > 1 && !calm) fi = Math.min(N - 1, Math.round(fi / stride) * stride);
    draw(fi);
  };
  var raf = 0;
  W.addEventListener('scroll', function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; paint(); }); }, { passive: true });
  W.addEventListener('resize', function () { size(); });
  if (W.IntersectionObserver) new IntersectionObserver(function (es) { if (es[0].isIntersecting) load(); }, { rootMargin: '150% 0px' }).observe(sec);
  else load();
  /* telefonda sahne ekrandayken rehber ve paket ipi çekilir (css: .mf-in) */
  if (W.IntersectionObserver) new IntersectionObserver(function (es) { D.documentElement.classList.toggle('mf-in', es[0].isIntersecting); }, { threshold: 0.01 }).observe(track);
  /* rehber bu bölümde mi? */
  if (W.IntersectionObserver) new IntersectionObserver(function (es) { if (es[0].isIntersecting && stepNow > -1 && W.acadiaRehber) { var k = stepNow; stepNow = -1; setStep(k); } }, { threshold: 0.3 }).observe(sec.querySelector('.mf-stage'));
  size();
})();
