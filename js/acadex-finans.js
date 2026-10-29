/* ================= ACADEX FİNANS: finans, muhasebe ve uluslararası ticaret istasyonları ================= */
/* Görünüm dashboard.html → #finans-view; stiller css/acadex-finans.css.
   Sekiz istasyon tek sayfada: labs/finans/index.html (?hub=1&tab=<istasyon>). Karttan açılınca
   tam ekran katmandaki iframe'e yüklenir; iframe zaten yüklüyse sayfa yeniden yüklenmez,
   istasyon postMessage ile değişir. Sitenin Acadia'sı MedLab köprüsünü kullanır
   (js/acadex-medlab-acadia.js → axMedLabHook('finans')). */
(function () {
  'use strict';
  var sec = document.getElementById('finans-view'); if (!sec) return;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var SRC = 'labs/finans/index.html';
  var ST = { zaman: 'Paranın zaman değeri', muhasebe: 'Muhasebe', borsa: 'Borsa ve portföy', dis: 'Dış ticaret', analiz: 'Finansal tablo analizi', makro: 'Kur ve makro', turev: 'Türev ürünler', kisisel: 'Kişisel finans' };
  window.AX_FINANS = ST;
  /* genel müdürlük (29.10.2026): şirket yönetimi katları ayrı lab'da (labs/sirket/), aynı katmanda açılır; anahtar 'sirket-<kat>' */
  var SK = { terazi: 'Bilanço terazisi', tablolar: 'Üç tablo ve nakit', maliyet: 'Maliyet ve başabaş', yatirim: 'Yatırım kararı', strateji: 'Strateji masası', org: 'Organizasyon', sim: 'Şirketi yönet' };
  window.AX_SIRKET = SK;
  var labOf = function (k) { return /^sirket-/.test(k) ? 'sirket' : 'finans'; };
  var info = function (k) {
    if (labOf(k) === 'sirket') { var t = k.slice(7); return SK[t] ? { lab: 'sirket', tab: t, src: 'labs/sirket/index.html', name: 'Acadex Şirket · ' + SK[t] } : null; }
    return ST[k] ? { lab: 'finans', tab: k, src: SRC, name: 'Acadex Finans · ' + ST[k] } : null;
  };
  var curLab = null;

  /* tam ekran katman: section'a geçiş animasyonunda transform verildiği için body'ye taşınır */
  var run = sec.querySelector('[data-finans-run]'), frame = run.querySelector('[data-finans-frame]');
  var titleEl = run.querySelector('[data-finans-title]'), newTab = run.querySelector('[data-finans-newtab]'), loadEl = run.querySelector('[data-finans-load]');
  document.body.appendChild(run);
  var cur = null, lastBtn = null, ready = false;
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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
  var hideLoad = function () { if (!loadEl || loadEl.hidden) return; loadEl.classList.add('out'); setTimeout(function () { loadEl.hidden = true; loadEl.classList.remove('out'); }, 360); };
  frame.addEventListener('load', function () { if (frame.getAttribute('src')) { ready = true; setTimeout(hideLoad, 200); } });

  var open = function (k) {
    var I = info(k); if (!I) return false;
    cur = k; titleEl.textContent = I.name; frame.title = I.name; newTab.href = I.src + '?tab=' + I.tab;
    if (!frame.getAttribute('src') || curLab !== I.lab) { ready = false; curLab = I.lab; if (loadEl) { loadEl.classList.remove('out'); loadEl.hidden = false; } frame.setAttribute('src', I.src + '?hub=1&tab=' + I.tab); }
    else if (ready) lsafe(function () { frame.contentWindow.postMessage({ src: 'axhost', type: 'tab', tab: I.tab }, location.origin); });
    else frame.setAttribute('src', I.src + '?hub=1&tab=' + I.tab);
    run.hidden = false; document.body.classList.add('axm-open');
    grow(lastBtn, false);
    if (typeof window.axMedLabHook === 'function') lsafe(function () { window.axMedLabHook(I.lab, frame); });
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
  window.axFinansOpen = function (k) { if (typeof switchDashboardView === 'function') switchDashboardView('finans'); return open(k); };
  window.axFinansClose = close;

  sec.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-finans-open]'); if (!b) return;
    lastBtn = b; open(b.getAttribute('data-finans-open'));
  });
  run.querySelector('[data-finans-close]').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !run.hidden && !document.querySelector('dialog[open]')) close(); });

  /* dashboard bağlantısı: kenar menü ve ilk açılış (MedLab'deki gibi) */
  if (typeof switchDashboardView === 'function') {
    var origSwitch = switchDashboardView;
    switchDashboardView = function (v) {
      var side = document.getElementById('side-finans'); if (side) side.classList.toggle('active', v === 'finans');
      if (v !== 'finans') close(true);
      if (v === 'finans' && !document.querySelector('.dashboard-view-section.active')) {
        sec.classList.add('active'); lsafe(function () { currentActiveTab = 'finans'; });
        Array.prototype.forEach.call(document.querySelectorAll('.sidebar-item.active'), function (x) { if (x !== side) x.classList.remove('active'); });
        return;
      }
      var r = origSwitch.apply(this, arguments);
      if (v === 'finans') Array.prototype.forEach.call(document.querySelectorAll('.sidebar-item.active'), function (x) { if (x !== side) x.classList.remove('active'); });
      return r;
    };
    window.switchDashboardView = switchDashboardView;
  }
})();
