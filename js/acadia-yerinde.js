/* ==========================================================================
   ACADIA YERİNDE (js/acadia-yerinde.js), 28.10.2026 — dashboard'da bağlamsal Acadia
   Her panelin başlığında, başlığın hemen yanında küçük Acadia durur; panele göre
   ifade, poz ve kılık değişir (MedLab'de stetoskop, Study Lab'de deney gözlüğü,
   Sınav salonunda kep...). Panel ilk açıldığında kısa bir balon söyler (günde bir kez).
   Kartoteks'te dolabın üstünde oturur ve çalışmaya tepki verir (js/acadex-ink.js).
   Başarı bildirimlerinde sağ alttaki Acadia kutlar. Çizim: js/acadia-kit.js.
   ========================================================================== */
(function () {
  'use strict';
  var K = window.AcadiaKit; if (!K) return;
  var D = document;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var VIEWS = {
    'docs-view': { mood: 'mutlu', pose: 'isaret', say: 'belgeni bırak; özetini ben dizerim.' },
    'planner-view': { mood: 'odakli', pose: 'dur', say: 'bu haftayı birlikte planlayalım.' },
    'feed-view': { mood: 'kirp', pose: 'selam', say: 'bölüm arkadaşların ne asmış, bakalım.' },
    'notebook-view': { mood: 'dusunuyor', pose: 'dusun', say: 'aklındakini buraya yaz, ben sıralarım.' },
    'sourcehub-view': { mood: 'odakli', pose: 'oku', costume: 'kartoteks', say: 'belge, özet ve ben aynı masadayız.' },
    'exams-view': { mood: 'odakli', pose: 'dur', costume: 'sinav', say: 'sakin ol; soruları tek tek çözeriz.' },
    'acadexsunum-view': { mood: 'mutlu', pose: 'isaret', say: 'sahne senin; asetatları ben toparlarım.' },
    'sandbox-view': { mood: 'saskin', pose: 'dur', say: 'ne kuruyorsun bakalım?' },
    'sandbox-interaction-view': { mood: 'mutlu', pose: 'selam', say: 'yayındakilere göz atalım.' },
    'settings-view': { mood: 'kirp', pose: 'selam', say: 'beni de giydirmek ister misin?', studio: true },
    'studylab-view': { mood: 'mutlu', pose: 'oku', costume: 'studylab', say: 'bir yöntem seç, birlikte deneyelim.' },
    'medlab-view': { mood: 'mutlu', pose: 'selam', costume: 'medlab', say: 'stetoskobum hazır; bir lab seç.' }
  };
  var DAYK = 'acadex.acadia.said', today = new Date().toISOString().slice(0, 10);
  var said = lsafe(function () { var o = JSON.parse(localStorage.getItem(DAYK) || '{}'); return o.d === today ? o : { d: today }; }, { d: today });

  Object.keys(VIEWS).forEach(function (id) {
    var sec = D.getElementById(id); if (!sec) return;
    var h1 = sec.querySelector('.d-head h1, .axm-head h1, .ax-head .ax-h'); if (!h1 || h1.parentNode.querySelector('.acd-head')) return;
    var c = VIEWS[id], el = D.createElement('span');
    el.className = 'acd-head say-r'; el.setAttribute('data-acadia', ''); el.dataset.mood = c.mood; el.dataset.pose = c.pose; el.dataset.size = '64';
    if (c.costume) el.dataset.costume = c.costume;
    if (c.studio) { el.setAttribute('data-acd-studio', ''); el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-label', 'Acadia’nı giydir'); el.title = 'Acadia’nı giydir'; }
    else el.setAttribute('aria-hidden', 'true');
    h1.insertAdjacentElement('afterend', el);
  });
  K.mount();

  /* panel açılınca kısa balon (her panelde günde bir kez) */
  var greet = function (id) {
    var c = VIEWS[id], sec = D.getElementById(id); if (!c || !sec || said[id]) return;
    var el = sec.querySelector('.acd-head'); if (!el) return;
    said[id] = 1; lsafe(function () { localStorage.setItem(DAYK, JSON.stringify(said)); });
    setTimeout(function () { K.say(el, c.say, 4800); }, 600);
  };
  if (typeof switchDashboardView === 'function') {
    var o = switchDashboardView;
    switchDashboardView = function (v) { var r = o.apply(this, arguments); if (typeof v === 'string') greet(v + '-view'); return r; };
    window.switchDashboardView = switchDashboardView;
  }
  D.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.acd-head[data-acd-studio]')) { e.preventDefault(); K.openStudio(); } });

  /* başarı bildirimi: sağ alttaki Acadia kutlar */
  var hook = function () {
    if (typeof showDashboardAlert !== 'function' || showDashboardAlert.__acd) return;
    var a = showDashboardAlert, w = function (t) { if (t === 'success') { var m = D.querySelector('#axa-layer .axa-mas'); if (m && m.__acdReact) m.__acdReact('kutlama', 1600); } return a.apply(this, arguments); };
    w.__acd = true; Object.keys(a).forEach(function (k) { w[k] = a[k]; });
    showDashboardAlert = w; window.showDashboardAlert = w;
  };
  hook(); setTimeout(hook, 1500);
})();
