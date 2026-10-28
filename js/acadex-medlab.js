/* ================= ACADEX MEDLAB: tıp öğrencilerine özel laboratuvarlar ================= */
/* Görünüm dashboard.html → #medlab-view; stiller css/acadex-medlab.css.
   Her laboratuvar labs/<ad>/index.html altında kendi başına çalışan bir sayfadır;
   karttan açılınca tam ekran katmandaki iframe'e yüklenir (veri ağır, o yüzden ilk açılışta). */
(function () {
  'use strict';
  var sec = document.getElementById('medlab-view'); if (!sec) return;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var LABS = {
    anatomi: { t: 'Anatomi Lab', src: 'labs/anatomi/index.html' },
    fizyo: { t: 'Fizyo Lab', src: 'labs/fizyo/index.html' }, /* 3B veriyi ../anatomi/data/ yolundan paylaşır */
    odyoloji: { t: 'Odyoloji Lab', src: 'labs/odyoloji/index.html' } /* kabin, 3B kulak (data/ax-kulak.js), vaka masası */
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
    run.hidden = false; document.body.classList.add('axm-open');
    grow(lastBtn, false);
    if (typeof window.axMedLabHook === 'function') lsafe(function () { window.axMedLabHook(k, frame); });
    setTimeout(function () { lsafe(function () { frame.focus(); }); }, 60);
    return true;
  };
  var close = function (now) {
    if (run.hidden) return;
    cur = null;
    if (typeof window.axMedLabHook === 'function') lsafe(function () { window.axMedLabHook(null, frame); });
    var b = lastBtn, fin = function () { run.hidden = true; document.body.classList.remove('axm-open'); if (b && now !== true) lsafe(function () { b.focus(); }); };
    if (now !== true && sec.classList.contains('active')) grow(b, true, fin); else { clearTimeout(grow.t); run.classList.remove('axm-grow'); if (run.style) run.style.clipPath = ''; fin(); }
  };

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
      if (v !== 'medlab') close(true);
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
})();
