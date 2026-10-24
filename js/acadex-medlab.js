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
    fizyo: { t: 'Fizyo Lab', src: 'labs/fizyo/index.html' } /* 3B veriyi ../anatomi/data/ yolundan paylaşır */
  };
  window.AX_MEDLABS = LABS;

  /* tam ekran katman: section'a geçiş animasyonunda transform verildiği için body'ye taşınır */
  var run = sec.querySelector('[data-medlab-run]'), frame = run.querySelector('[data-medlab-frame]');
  var titleEl = run.querySelector('[data-medlab-title]'), newTab = run.querySelector('[data-medlab-newtab]');
  document.body.appendChild(run);
  var cur = null, lastBtn = null;

  var open = function (k) {
    var L = LABS[k]; if (!L) return false;
    cur = k; titleEl.textContent = L.t; frame.title = L.t; newTab.href = L.src;
    if (frame.getAttribute('src') !== L.src) frame.setAttribute('src', L.src);
    run.hidden = false; document.body.classList.add('axm-open');
    setTimeout(function () { lsafe(function () { frame.focus(); }); }, 60);
    return true;
  };
  var close = function () {
    if (run.hidden) return;
    run.hidden = true; document.body.classList.remove('axm-open'); cur = null;
    if (lastBtn) lsafe(function () { lastBtn.focus(); });
  };
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
      if (v !== 'medlab') close();
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
