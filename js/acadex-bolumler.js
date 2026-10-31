/* ==========================================================================
   ACADEX · Fakülteler, bölümler ve bölüme göre laboratuvarlar (js/acadex-bolumler.js)
   31.10.2026

   Tek kaynak: kayıt formu (register.html), "profilini tamamla" penceresi
   (profile-complete.js), Ayarlar'daki bölüm seçimi, bölüm adı çevirisi
   (translateDepartment) ve yönetim paneli bu listeyi kullanır.

   profiles.department değeri İngilizce bölüm adıdır (eski kayıtlarla uyum).
   Yeni bölüm eklerken: buraya ekle + supabase/migrations/20261031_bolumler.sql
   içindeki acadex_departments() listesine ekle (SQL Editor'da çalıştır).

   Laboratuvarlar: yan menüde yalnızca bölüme uyan lab'lar görünür; diğerleri
   "diğer laboratuvarlar" başlığı altında katlı durur. Bölüm seçilmemişse ya da
   "Other" ise hepsi açıktır. Ayarlar'daki "tüm laboratuvarları göster"
   (localStorage acadexLabsAll) katlamayı kapatır.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };

  /* labs: bu fakültenin bölümlerine öne çıkan laboratuvarlar (yan menü id'si side-<lab>) */
  var FAK = [
    { k: 'iibf', tr: 'İktisadi ve İdari Bilimler', en: 'Economics and Administrative Sciences', labs: ['finans'], d: [
      ['Management Information Systems', 'Yönetim Bilişim Sistemleri'],
      ['Business Administration', 'İşletme'],
      ['International Trade and Business', 'Uluslararası Ticaret ve İşletmecilik'],
      ['Banking and Finance', 'Bankacılık ve Finans'],
      ['Economics', 'İktisat'],
      ['Public Finance', 'Maliye'],
      ['Accounting and Financial Management', 'Muhasebe ve Finans Yönetimi'],
      ['Political Science and Public Administration', 'Siyaset Bilimi ve Kamu Yönetimi'],
      ['Health Management', 'Sağlık Yönetimi', ['finans', 'medlab']]
    ] },
    { k: 'saglik', tr: 'Tıp ve Sağlık Bilimleri', en: 'Medicine and Health Sciences', labs: ['medlab'], d: [
      ['Medicine', 'Tıp'],
      ['Dentistry', 'Diş Hekimliği'],
      ['Pharmacy', 'Eczacılık'],
      ['Nursing', 'Hemşirelik'],
      ['Midwifery', 'Ebelik'],
      ['Nutrition and Dietetics', 'Beslenme ve Diyetetik'],
      ['Physiotherapy and Rehabilitation', 'Fizyoterapi ve Rehabilitasyon'],
      ['Audiology', 'Odyoloji'],
      ['Speech and Language Therapy', 'Dil ve Konuşma Terapisi']
    ] },
    { k: 'muh', tr: 'Mühendislik', en: 'Engineering', labs: [], d: [
      ['Computer Engineering', 'Bilgisayar Mühendisliği'],
      ['Software Engineering', 'Yazılım Mühendisliği'],
      ['Industrial Engineering', 'Endüstri Mühendisliği', ['finans']],
      ['Electrical and Electronics Engineering', 'Elektrik-Elektronik Mühendisliği'],
      ['Mechanical Engineering', 'Makine Mühendisliği'],
      ['Civil Engineering', 'İnşaat Mühendisliği']
    ] },
    { k: 'diger', tr: 'Diğer', en: 'Other', labs: null, d: [
      ['Other', 'Diğer / listede yok']
    ] }
  ];
  /* üst çubuktaki kısa rozet (getDepartmentShortName) */
  var SHORT = { 'Management Information Systems': 'MIS', 'Business Administration': 'BA', 'International Trade and Business': 'ITB', 'Banking and Finance': 'B&F',
    'Economics': 'ECON', 'Public Finance': 'PF', 'Accounting and Financial Management': 'AFM', 'Political Science and Public Administration': 'PSPA', 'Health Management': 'HM',
    'Medicine': 'MED', 'Dentistry': 'DENT', 'Pharmacy': 'PHAR', 'Nursing': 'NURS', 'Midwifery': 'MIDW', 'Nutrition and Dietetics': 'N&D',
    'Physiotherapy and Rehabilitation': 'PTR', 'Audiology': 'AUD', 'Speech and Language Therapy': 'SLT',
    'Computer Engineering': 'CENG', 'Software Engineering': 'SENG', 'Industrial Engineering': 'IE', 'Electrical and Electronics Engineering': 'EEE',
    'Mechanical Engineering': 'ME', 'Civil Engineering': 'CE', 'Other': '' };
  /* bölüme bağlı olabilen lab'lar (Study Lab herkese açık, burada yok) */
  var LABS = ['medlab', 'finans'];

  var BY = {};
  FAK.forEach(function (f) { f.d.forEach(function (x) { BY[x[0]] = { v: x[0], tr: x[1], fak: f, labs: x[2] || f.labs }; }); });

  var en = function () { return lsafe(function () { return localStorage.getItem('acadexUILang'); }, 'tr') === 'en'; };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var api = {
    FAK: FAK,
    LABS: LABS,
    all: function () { return Object.keys(BY); },
    valid: function (d) { return !!BY[d]; },
    /* görünen ad: TR arayüzde Türkçe, EN'de kayıtlı İngilizce ad */
    name: function (d) { if (!d) return ''; var b = BY[d]; return b ? (en() ? (d === 'Other' ? 'Other' : d) : b.tr) : d; },
    tr: function (d) { var b = BY[d]; return b ? b.tr : (d || ''); },
    short: function (d) { return SHORT[d] != null ? SHORT[d] : null; },
    faculty: function (d) { var b = BY[d]; return b ? b.fak.k : ''; },
    facultyName: function (d) { var b = BY[d]; return b ? (en() ? b.fak.en : b.fak.tr) : ''; },
    /* bölüme öne çıkan lab'lar; null = hepsi (bölüm yok / Other / bilinmeyen) */
    labsFor: function (d) { var b = BY[d]; return b && b.labs ? b.labs.slice() : null; },
    /* <select> için fakülte grupları */
    options: function (sel, ph) {
      return (ph != null ? '<option value="">' + esc(ph) + '</option>' : '') + FAK.map(function (f) {
        return '<optgroup label="' + esc(f.tr) + '">' + f.d.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (sel === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</optgroup>';
      }).join('');
    },
    fill: function (el, sel) {
      if (!el) return;
      var cur = sel != null ? sel : el.value, ph = el.getAttribute('data-bolum-ph');
      el.innerHTML = api.options(cur, ph);
      /* listede olmayan eski bir değer kaybolmasın */
      if (cur && !BY[cur]) { var o = D.createElement('option'); o.value = cur; o.textContent = cur; o.selected = true; el.appendChild(o); }
    }
  };
  W.AX_BOLUM = api;

  /* -------------------- yan menü: bölüme göre lab'lar -------------------- */
  var KEY_ALL = 'acadexLabsAll', KEY_OPEN = 'acadexLabsMoreOpen';
  var showAll = function () { return lsafe(function () { return localStorage.getItem(KEY_ALL) === '1'; }, false); };
  var profile = function () { return lsafe(function () { return W.currentUserProfile; }, null); };

  var css = [
    'body .ax-side .sidebar-item.ax-lab-off{display:none}',
    'body .ax-side .ax-lab-more a{color:#4B5675}',
    'body .ax-side .ax-lab-more a .ax-chev{transition:transform .2s}',
    'body .ax-side .ax-lab-more[data-open="1"] a .ax-chev{transform:rotate(90deg)}',
    'body .ax-side .sidebar-item.ax-lab-fold{padding-left:10px}',
    '.ax-labs-all{grid-column:1/-1;display:flex!important;flex-direction:row!important;gap:10px;align-items:flex-start;font-weight:500;cursor:pointer}',
    '.ax-labs-all input[type=checkbox]{width:20px!important;height:20px!important;min-height:0!important;margin:2px 0 0!important;padding:0!important;border:0!important;box-shadow:none!important;background:none!important;flex:none;accent-color:#2F6BFF}',
    '.ax-labs-all small{display:block;color:#4B5675;font-weight:400}',
    '.ax-dept-card{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 16px;padding:12px 16px;border:1.5px dashed #9FB4E8;border-radius:8px;background:#F5F8FF;color:#1A2A5C;font-size:15px;line-height:1.45}',
    '.ax-dept-card b{font-weight:700}',
    '.ax-dept-card .ax-dc-a{display:flex;gap:8px;align-items:center}',
    '.ax-dept-card button{min-height:40px;border-radius:999px;padding:8px 16px;font:inherit;font-weight:600;cursor:pointer}',
    '.ax-dept-card .go{border:0;background:#2F6BFF;color:#fff}',
    '.ax-dept-card .x{border:0;background:none;color:#4B5675;text-decoration:underline;text-underline-offset:3px}',
    '@media (prefers-reduced-motion: reduce){body .ax-side .ax-lab-more a .ax-chev{transition:none}}'
  ].join('\n');

  var more = null;
  var ensureMore = function () {
    if (more && more.isConnected) return more;
    var anchor = D.getElementById('side-studylab') || D.getElementById('side-medlab');
    if (!anchor || !anchor.parentNode) return null;
    if (!D.getElementById('ax-bolum-css')) { var st = D.createElement('style'); st.id = 'ax-bolum-css'; st.textContent = css; D.head.appendChild(st); }
    more = D.createElement('li');
    more.className = 'sidebar-item ax-lab-more ax-lab-off';
    more.id = 'side-labs-more';
    more.innerHTML = '<a href="#" role="button" aria-expanded="false" aria-controls="side-medlab side-finans"><svg class="ax-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5 L15.5 12 L9 18.5"/></svg><span class="lbl">diğer laboratuvarlar</span></a>';
    /* katlı lab'ların hemen önüne koy: lab'lar her zaman Study Lab'dan sonra gelir */
    var labsLis = LABS.map(function (k) { return D.getElementById('side-' + k); }).filter(Boolean);
    var last = labsLis.length ? labsLis[labsLis.length - 1] : anchor;
    last.parentNode.insertBefore(more, last.nextSibling);
    more.querySelector('a').addEventListener('click', function (e) {
      e.preventDefault();
      var open = more.getAttribute('data-open') !== '1';
      lsafe(function () { localStorage.setItem(KEY_OPEN, open ? '1' : '0'); });
      apply();
    });
    return more;
  };

  var lastSig = '';
  var apply = function () {
    var p = profile();
    var dept = p ? (p.department || '') : null;
    var m = ensureMore(); if (!m) return;
    var want = dept == null || showAll() ? null : api.labsFor(dept);
    var folded = want ? LABS.filter(function (k) { return want.indexOf(k) < 0 && D.getElementById('side-' + k); }) : [];
    /* katlı bir lab açıkken (Ctrl+K, bağlantı) grubu kendiliğinden aç */
    var activeFolded = folded.some(function (k) { var li = D.getElementById('side-' + k); return li && li.classList.contains('active'); });
    var open = activeFolded || lsafe(function () { return localStorage.getItem(KEY_OPEN) === '1'; }, false);
    LABS.forEach(function (k) {
      var li = D.getElementById('side-' + k); if (!li) return;
      var f = folded.indexOf(k) > -1;
      li.classList.toggle('ax-lab-fold', f);
      li.classList.toggle('ax-lab-off', f && !open);
    });
    /* öne çıkan lab'lar Study Lab'ın hemen ardından, katlılar "diğer"in altında */
    var ul = m.parentNode, sl = D.getElementById('side-studylab');
    if (want && sl && sl.parentNode === ul) {
      var after = sl;
      want.forEach(function (k) { var li = D.getElementById('side-' + k); if (li && li.parentNode === ul) { ul.insertBefore(li, after.nextSibling); after = li; } });
      ul.insertBefore(m, after.nextSibling); after = m;
      folded.forEach(function (k) { var li = D.getElementById('side-' + k); if (li) { ul.insertBefore(li, after.nextSibling); after = li; } });
    }
    m.classList.toggle('ax-lab-off', !folded.length);
    m.setAttribute('data-open', open ? '1' : '0');
    var a = m.querySelector('a'); a.setAttribute('aria-expanded', open ? 'true' : 'false');
    a.setAttribute('aria-controls', folded.map(function (k) { return 'side-' + k; }).join(' '));
    a.querySelector('.lbl').textContent = (folded.length === 1 ? 'diğer laboratuvar' : 'diğer laboratuvarlar') + ' (' + folded.length + ')';
    D.documentElement.setAttribute('data-ax-faculty', dept ? api.faculty(dept) || 'diger' : 'none');
    deptCard(p);
  };

  /* bölümü boş olan kullanıcıya bir kez, kapatılabilir kart */
  var deptCard = function (p) {
    var old = D.getElementById('ax-dept-card');
    var need = p && !p.department && !lsafe(function () { return sessionStorage.getItem('acadexDeptCardX') === '1'; }, false);
    if (!need) { if (old) old.remove(); return; }
    if (old) return;
    var home = D.getElementById('home-view') || D.querySelector('.dashboard-view-section');
    if (!home) return;
    var c = D.createElement('div'); c.id = 'ax-dept-card'; c.className = 'ax-dept-card'; c.setAttribute('role', 'note');
    c.innerHTML = '<span><b>Bölümünü seç,</b> sana uygun laboratuvarları öne alalım. Şimdilik hepsi açık.</span><span class="ax-dc-a"><button type="button" class="x">sonra</button><button type="button" class="go">bölümümü seç</button></span>';
    home.insertBefore(c, home.firstChild);
    c.querySelector('.go').addEventListener('click', function () { if (typeof W.switchDashboardView === 'function') W.switchDashboardView('settings'); setTimeout(function () { var s = D.getElementById('settings-dept'); if (s) s.focus(); }, 400); });
    c.querySelector('.x').addEventListener('click', function () { lsafe(function () { sessionStorage.setItem('acadexDeptCardX', '1'); }); c.remove(); });
  };

  /* Ayarlar: bölüm listesi + "tüm laboratuvarları göster" */
  var settings = function () {
    var s = D.getElementById('settings-dept');
    if (s && !s.__axBolum) {
      s.__axBolum = true;
      var p = profile();
      api.fill(s, p && p.department ? p.department : s.value);
      var lab = s.closest('label');
      if (lab && !D.getElementById('settings-labs-all')) {
        var w = D.createElement('label'); w.className = 'fld ax-labs-all';
        w.innerHTML = '<input type="checkbox" id="settings-labs-all"><span>Tüm laboratuvarları menüde göster <small>kapalıyken bölümüne uymayanlar “diğer laboratuvarlar” altında durur</small></span>';
        lab.parentNode.insertBefore(w, lab.nextSibling);
        var cb = w.querySelector('input'); cb.checked = showAll();
        cb.addEventListener('change', function () { lsafe(function () { localStorage.setItem(KEY_ALL, cb.checked ? '1' : '0'); }); apply(); });
      }
    }
    /* loadSettingsView değeri sonradan yazar; listede yoksa eklensin */
    if (s) { var pp = profile(); if (pp && pp.department && s.value !== pp.department && !s.matches(':focus')) api.fill(s, pp.department); }
  };

  var tick = function () {
    var p = profile();
    var sig = (p ? 'p:' + (p.department || '') : 'none') + '|' + showAll() + '|' + LABS.map(function (k) { var li = D.getElementById('side-' + k); return li && li.classList.contains('active') ? 1 : 0; }).join('');
    settings();
    if (sig !== lastSig) { lastSig = sig; lsafe(apply); }
  };
  var start = function () {
    D.querySelectorAll('select[data-bolum-select]').forEach(function (el) { api.fill(el); });
    if (!D.getElementById('nav-menu')) return;   /* yalnızca panelde */
    tick();
    setInterval(tick, 1200);
    W.addEventListener('ax:profile', tick);
    W.addEventListener('hashchange', function () { setTimeout(tick, 50); });
  };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
