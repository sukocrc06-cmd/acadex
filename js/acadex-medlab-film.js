/* ==========================================================================
   LANDING · MEDLAB SCROLL FİLMİ (js/acadex-medlab-film.js), 28.10.2026
   section#medlab içinde: 96 kare (assets/landing/medlab/fNNN.webp) Anatomi Lab'in
   gerçek 3B modelinden çekildi. Scroll ilerledikçe kare değişir; sahne sabit kalır.
     - Kareler bölüm yaklaşınca yüklenir (önce her 8. kare, sonra hepsi); telefonda ve
       veri tasarrufunda her 2. kare. Henüz gelmeyen kare yerine en yakın yüklenen çizilir.
     - Hareket azaltmada film oynamaz; her adımda o adımın tek karesi gösterilir.
     - Sağdaki Acadia rehberi (js/acadia-rehber.js) bu bölümde stetoskop takar ve
       her adımda kısa bir cümle söyler (window.acadiaRehber.say).
   ========================================================================== */
(function () {
  'use strict';
  var sec = document.getElementById('medlab'); if (!sec) return;
  var W = window, D = document;
  var calm = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var N = 96, SRC = function (i) { return 'assets/landing/medlab/f' + ('00' + i).slice(-3) + '.webp'; };
  var cv = sec.querySelector('canvas'), ctx = cv.getContext('2d'), track = sec.querySelector('.mf-track');
  var steps = Array.prototype.slice.call(sec.querySelectorAll('.mf-step')), rail = Array.prototype.slice.call(sec.querySelectorAll('.mf-rail li')), tags = Array.prototype.slice.call(sec.querySelectorAll('.mf-tag'));
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
  var phone = W.innerWidth < 860 || (navigator.connection && navigator.connection.saveData);
  var stride = phone ? 2 : 1;
  var imgs = new Array(N), ok = new Array(N), started = false, loaded = 0, want = 0, cur = -1, stepNow = -1;

  var size = function () { var r = cv.getBoundingClientRect(), d = Math.min(2, W.devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); cur = -1; paint(); };
  var nearest = function (i) { for (var k = 0; k < N; k++) { if (ok[i - k]) return i - k; if (ok[i + k]) return i + k; } return -1; };
  var draw = function (i) {
    var j = nearest(i); if (j < 0) return; if (j === cur) return; cur = j;
    var im = imgs[j], cw = cv.width, ch = cv.height, s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.clearRect(0, 0, cw, ch); ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
  };
  var load = function () {
    if (started) return; started = true;
    var order = [], seen = {};
    for (var i = 0; i < N; i += 8) order.push(i);
    order.push(N - 1); STEP.forEach(function (s) { order.push(s[2]); });
    for (var j = 0; j < N; j += stride) order.push(j);
    order = order.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
    want = order.length;
    var q = order.slice(), active = 0;
    var pump = function () {
      while (active < 6 && q.length) {
        (function (i) {
          active++; var im = new Image(); im.decoding = 'async'; im.src = SRC(i);
          im.onload = function () { imgs[i] = im; ok[i] = true; loaded++; active--; if (loadEl) { loadEl.textContent = 'model yükleniyor · %' + Math.round(loaded / want * 100); if (loaded >= want) loadEl.classList.add('done'); } cur = -1; paint(); pump(); };
          im.onerror = function () { active--; loaded++; pump(); };
        })(q.shift());
      }
    };
    pump();
  };
  var progress = function () { var r = track.getBoundingClientRect(), total = r.height - W.innerHeight; return Math.max(0, Math.min(1, -r.top / (total || 1))); };
  var setStep = function (k) {
    if (k === stepNow) return; stepNow = k;
    steps.forEach(function (s, i) { s.classList.toggle('on', i === k); s.setAttribute('aria-hidden', String(i !== k)); });
    rail.forEach(function (l, i) { l.classList.toggle('on', i === k); });
    tags.forEach(function (t) { t.classList.toggle('on', +t.getAttribute('data-step') === k); });
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
