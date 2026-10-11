/* ==========================================================================
   ACADEX · mürekkep & kâğıt arayüzü (js/acadex-ink.js)
   dashboard.js'ten SONRA yüklenir. dashboard.js'e dokunmaz: yalnızca
   Bugün / Belgelerim / Bölüm akışı / Bilgi kartları panellerinin çizim
   (render) fonksiyonlarını yeni tasarımla değiştirir. Veri sorguları,
   yükleme, özetleme, oylama, paylaşım, modallar aynen dashboard.js'te kalır.
   Demo veri yok: her şey Supabase'den gelen gerçek kayıtlardan çizilir;
   kayıt yoksa boş durum gösterilir.
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var jsq = function (s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' '); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var prof = function () { return lsafe(function () { return currentUserProfile; }, null) || window.currentUserProfile || null; };
  var me = function () { return lsafe(function () { return currentUser; }, null) || window.currentUser || null; };
  var trDept = function (d) { return (typeof translateDepartment === 'function' ? translateDepartment(d) : d) || ''; };
  var initials = function (n) { n = String(n || '').trim(); if (!n) return '?'; var p = n.split(/\s+/); return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : (p[0][1] || ''))).toLocaleUpperCase('tr'); };
  var cap = function (w) { return w ? w.charAt(0).toLocaleUpperCase('tr') + w.slice(1) : ''; };
  var first = function () { var p = prof(); var n = (p && p.full_name) || ((me() && me().email) || '').split('@')[0]; return cap(String(n).split(/\s+/)[0] || ''); };
  var avatar = function (p, cls) {
    var n = (p && p.full_name) || '';
    if (p && p.avatar_url) return '<span class="ax-av ' + (cls || '') + '"><img src="' + esc(p.avatar_url) + '" alt="" loading="lazy" onerror="this.remove()">' + '</span>';
    return '<span class="ax-av ' + (cls || '') + '" aria-hidden="true">' + esc(initials(n)) + '</span>';
  };
  var MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var dshort = function (d) { d = new Date(d); return isNaN(d) ? '' : d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  var ago = function (d) {
    var t = new Date(d).getTime(); if (isNaN(t)) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' dk önce';
    if (s < 86400) return Math.round(s / 3600) + ' sa önce';
    if (s < 86400 * 7) return Math.round(s / 86400) + ' gün önce';
    return dshort(d);
  };
  var tod = function () { var h = new Date().getHours(); return h >= 5 && h < 11 ? 'sabah' : h < 17 ? 'gun' : h < 22 ? 'aksam' : 'gece'; };
  var GREET = { sabah: 'günaydın', gun: 'iyi çalışmalar', aksam: 'iyi akşamlar', gece: 'geç saatte de buradasın' };
  var baseName = function (n) {
    n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, '');
    var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1];
    return n.replace(/[_]+/g, ' ').trim() || 'İsimsiz belge';
  };
  var extKind = function (n) { var e = String(n || '').split('.').pop().toLowerCase(); return e === 'pdf' ? ['pdf', 'PDF'] : (e === 'docx' || e === 'doc') ? ['word', 'DOC'] : (e === 'pptx' || e === 'ppt') ? ['ppt', 'PPT'] : ['txt', 'TXT']; };
  var tilt = function (i) { return (((i * 37) % 9) - 4) * 0.35; };
  var ICON = {
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12.5 C5 6.5 9 5 12 5 C15 5 19 6.5 22 12.5 C19 18 15 19.5 12 19.5 C9 19.5 5 18 2 12.5 Z"/><circle cx="12" cy="12.3" r="3.3"/></svg>',
    dl: '<svg viewBox="0 0 24 24"><path d="M12 3.5 C12 8 12.2 11 12 15.5 M7.5 11.2 C9.2 12.7 10.6 14.2 12 15.6 C13.5 14.1 14.8 12.8 16.6 11.1 M4 15.5 V19.5 H20 V15.5"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 6.5 H20 M9 6.5 V4 H15 V6.5 M6.5 6.5 L7.5 20 H16.5 L17.5 6.5 M10 10.5 V16.5 M14 10.5 V16.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M3.5 12.6 C8 11.4 13 12.9 19.2 11.7 M14.6 6.6 C16.4 8.6 18 10.3 19.6 11.6 C17.8 13.2 16.1 15 14.3 17.4"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.5 L14.6 9 L20.5 9.6 L16 13.6 L17.3 19.6 L12 16.5 L6.7 19.6 L8 13.6 L3.5 9.6 L9.4 9 Z"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="M4 12.5 C6 13.5 7.6 15.5 9 18 C11.5 11.5 14.5 7.5 20 4"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 15.5 C12 11 12.2 8 12 3.5 M7.5 7.8 C9.2 6.3 10.6 4.8 12 3.4 C13.5 4.9 14.8 6.2 16.6 7.9 M4 14.5 V19.5 H20 V14.5"/></svg>'
  };

  /* ---------------- kabuk: açılır/kapanır menü + aktif sayfa ---------------- */
  var html = document.documentElement, NAVK = 'acadex.nav.c';
  if (store.get(NAVK) === '1') html.classList.add('nav-c');
  var tog = $('[data-navtog]');
  var paintTog = function () { if (!tog) return; var c = html.classList.contains('nav-c'); tog.setAttribute('aria-expanded', String(!c)); tog.setAttribute('aria-label', c ? 'Menüyü genişlet' : 'Menüyü daralt'); };
  if (tog) {
    paintTog();
    tog.addEventListener('click', function () { html.classList.toggle('nav-c'); store.set(NAVK, html.classList.contains('nav-c') ? '1' : '0'); paintTog(); setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 330); });
  }
  $$('.ax-side .sidebar-item a').forEach(function (a) { var l = a.querySelector('.lbl'); if (l && !a.title) a.title = l.textContent.trim(); });
  var markNav = function (v) {
    $$('.ax-side .sidebar-item').forEach(function (li) { var a = li.querySelector('a'); if (!a) return; if (li.id === 'side-' + v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var nav = $('#nav-menu'); if (nav && nav.classList.contains('active') && window.innerWidth <= 1000) { nav.classList.remove('active'); var mt = $('#menu-toggle'); if (mt) { mt.classList.remove('active'); mt.setAttribute('aria-expanded', 'false'); } document.body.style.overflow = ''; }
  };
  if (typeof switchDashboardView === 'function') {
    var origSwitch = switchDashboardView;
    switchDashboardView = function (v) { markNav(v); return origSwitch.apply(this, arguments); };
    window.switchDashboardView = switchDashboardView;
  }
  $$('.ax-side .sidebar-item a').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
  markNav('home');
  /* "/" ile ara */
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var b = $('#btn-global-search'); if (b) { e.preventDefault(); b.click(); }
  });

  /* ================= BUGÜN ================= */
  var homeBusy = false;
  var drawDeskHead = function () {
    var desk = $('[data-desk]'); if (!desk) return;
    var t = tod(); desk.setAttribute('data-tod', t);
    var g = $('[data-greet]', desk); if (g) g.textContent = GREET[t] + (first() ? ', ' + first() : '');
    var d = new Date(), DAYS = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'], MON = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
    var dt = $('[data-today]', desk); if (dt) dt.textContent = d.getDate() + ' ' + MON[d.getMonth()] + ' ' + DAYS[d.getDay()];
  };
  var ymd = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var drawStreak = function () {
    var cal = $('[data-cal]'); if (!cal) return;
    var p = prof() || {}, streak = Number(p.current_streak) || 0, last = p.last_active_date ? new Date(p.last_active_date + 'T12:00:00') : null;
    var on = {};
    if (last && streak > 0) for (var k = 0; k < streak && k < 60; k++) { var x = new Date(last); x.setDate(x.getDate() - k); on[ymd(x)] = 1; }
    var today = new Date(); today.setHours(12, 0, 0, 0);
    var dow = (today.getDay() + 6) % 7; /* pazartesi = 0 */
    var start = new Date(today); start.setDate(today.getDate() - dow - 7);
    var out = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(function (n) { return '<span class="dn">' + n + '</span>'; }).join('');
    for (var i = 0; i < 14; i++) {
      var dd = new Date(start); dd.setDate(start.getDate() + i);
      var key = ymd(dd), isOn = !!on[key], isT = key === ymd(today);
      out += '<i class="' + (isOn ? 'on' : '') + (isT ? ' today' : '') + '" title="' + dshort(dd) + (isOn ? ' · çalıştın' : '') + '">' + dd.getDate() + (isOn ? ICON.tick : '') + '</i>';
    }
    cal.innerHTML = out;
    var n = $('[data-streak-n]'), tt = $('[data-streak-t]');
    if (n) n.textContent = streak;
    if (tt) tt.textContent = streak > 1 ? 'gündür üst üste çalışıyorsun. Yarın da uğrarsan ' + (streak + 1) + ' olur.' : streak === 1 ? 'gün: serin bugün başladı. Yarın da gel, iki olsun.' : 'gün: bugün başla, serin birden başlasın.';
    var goal = $('[data-goal]');
    if (goal && !goal.dataset.w) {
      goal.dataset.w = '1';
      var cur = store.get('acadex.weekgoal') || '';
      $$('button', goal).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.textContent.trim() === cur));
        b.addEventListener('click', function () { store.set('acadex.weekgoal', b.textContent.trim()); $$('button', goal).forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); }); });
      });
    }
  };
  var drawDeskObjects = async function () {
    var box = $('[data-desk-objs]'); if (!box || !me() || typeof supabaseClient === 'undefined') return;
    try {
      var r = await Promise.all([
        supabaseClient.from('documents').select('id, file_name, uploaded_at, status').eq('user_id', me().id).order('uploaded_at', { ascending: false }).limit(1),
        supabaseClient.from('study_cards').select('id, document_id, created_at, documents(file_name)').eq('user_id', me().id).order('created_at', { ascending: false }).limit(1)
      ]);
      var doc = (r[0].data || [])[0], card = (r[1].data || [])[0];
      if (!doc && !card) {
        box.innerHTML = '<div class="ax-desk-empty"><b>masan şimdilik boş.</b>İlk belgeni yükle; özetini çıkarıp kartlarını hazırlayalım.<div class="ax-desk-act"><button type="button" class="ax-btn ax-btn-blue" onclick="switchDashboardView(\'docs\')">' + ICON.up + 'Belge yükle</button></div></div>';
        return;
      }
      var h = '<div class="ax-objs">';
      if (doc) {
        var k = extKind(doc.file_name);
        h += '<div class="ax-paper"><i class="ax-clip"></i><span class="ext">' + k[1] + '</span><b>' + esc(baseName(doc.file_name)) + '</b><i></i><i></i><i style="width:70%"></i><i></i><small>' + esc(dshort(doc.uploaded_at).replace(/ \d{4}$/, '')) + '</small></div>';
      }
      if (card) h += '<div class="ax-deck"><span class="mono">BİLGİ KARTLARI</span><b>' + esc(baseName(card.documents && card.documents.file_name)) + '</b><span class="hand">bugün bunu tekrar et</span></div>';
      h += '</div><div class="ax-desk-act">';
      if (card) h += '<button type="button" class="ax-btn ax-btn-blue" data-review="' + card.id + '" data-name="' + esc(baseName(card.documents && card.documents.file_name)) + '">Tekrara başla ' + ICON.arrow + '</button><button type="button" class="ax-link" onclick="switchDashboardView(\'exams\')">ya da bu belgeden deneme oluştur</button>';
      else h += '<button type="button" class="ax-btn ax-btn-blue" onclick="switchDashboardView(\'docs\')">Belgeyi özetle ' + ICON.arrow + '</button>';
      h += '</div>';
      box.innerHTML = h;
      var rv = $('[data-review]', box);
      if (rv) rv.addEventListener('click', async function () {
        rv.disabled = true;
        try {
          if (typeof libraryCards !== 'undefined' && !libraryCards.some(function (c) { return c.id === rv.dataset.review; })) {
            var q = await supabaseClient.from('study_cards').select('*, documents(file_name)').eq('id', rv.dataset.review).single();
            if (q.data) libraryCards.push(q.data);
          }
          if (typeof openAdaptiveReview === 'function') await openAdaptiveReview(rv.dataset.review, rv.dataset.name);
        } finally { rv.disabled = false; }
      });
    } catch (e) { console.warn('acadex-ink: masa çizilemedi', e); }
  };
  var drawWeek = async function () {
    var ul = $('[data-week]'); if (!ul || !me() || typeof supabaseClient === 'undefined') return;
    var today = new Date(); today.setHours(12, 0, 0, 0);
    var mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var evs = [];
    try {
      var r = await supabaseClient.from('study_events').select('id, title, event_date, event_type, is_done').eq('user_id', me().id).gte('event_date', ymd(mon)).lte('event_date', ymd(sun) + 'T23:59:59').order('event_date', { ascending: true });
      evs = r.data || [];
    } catch (e) {}
    var N = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], out = '', total = 0;
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon); d.setDate(mon.getDate() + i);
      var key = ymd(d), mine = evs.filter(function (e) { return String(e.event_date).slice(0, 10) === key; });
      total += mine.length;
      out += '<li class="' + (key === ymd(today) ? 'today' : '') + '"><span class="d">' + N[i] + '<b>' + d.getDate() + '</b></span>' +
        mine.slice(0, 4).map(function (e) { return '<span class="ev' + (e.is_done ? ' done' : '') + (/exam|sınav/i.test(e.event_type || '') ? ' exam' : '') + '">' + esc(e.title) + '</span>'; }).join('') +
        (mine.length > 4 ? '<span class="hand" style="font-size:16px;color:var(--soft)">+' + (mine.length - 4) + ' daha</span>' : '') +
        '<button type="button" class="add" data-add="' + key + '">+ ekle</button></li>';
    }
    ul.innerHTML = out;
    var note = $('[data-week-note]'); if (note) note.textContent = total ? 'bu hafta ' + total + ' plan var.' : 'bu hafta henüz boş. bir güne dokun, plan yapıştıralım.';
    $$('[data-add]', ul).forEach(function (b) {
      b.addEventListener('click', function () {
        switchDashboardView('planner');
        setTimeout(function () {
          if (typeof openAddEventModal === 'function') openAddEventModal();
          var f = document.querySelector('#add-event-modal input[type="date"], #event-date');
          if (f) f.value = b.dataset.add;
        }, 450);
      });
    });
  };
  if (typeof loadDashboardHome === 'function') {
    var origHome = loadDashboardHome;
    loadDashboardHome = async function () {
      drawDeskHead(); drawStreak();
      if (homeBusy) return origHome.apply(this, arguments);
      homeBusy = true;
      try {
        await Promise.all([origHome.apply(this, arguments), drawDeskObjects(), drawWeek()]);
        drawStreak();
      } finally { homeBusy = false; }
    };
  }
  drawDeskHead();

  /* ================= BELGELERİM ================= */
  var docQ = '', docSort = 'new';
  var STAGES = { extracting: ['metin çıkarılıyor', 18], analyzing: ['özet oluşturuluyor', 40], synthesizing: ['parçalar birleştiriliyor', 58], sectioning: ['bölüm özetleri derinleşiyor', 62], writing: ['anlatı yazılıyor', 70], draft_ready: ['taslak hazır, kontrol ediliyor', 76], reviewing: ['doğruluk kontrol ediliyor', 86], critic: ['kalite kontrolü', 92], saving: ['kart kaydediliyor', 96] };
  var stageOf = function (st) {
    st = String(st || '');
    var m = st.match(/chunking:(\d+)\/(\d+)/);
    if (m) { var a = +m[1], b = +m[2] || 1; return ['bölümler işleniyor (' + a + '/' + b + ')', 40 + Math.min(25, Math.round(a / b * 25))]; }
    if (st.indexOf('chunking') === 0) return ['bölümler işleniyor', 45];
    return STAGES[st] || ['sıraya alındı', 8];
  };
  var docsHead = function () {
    var p = prof(); var hello = $('[data-hello]'); if (hello) hello.textContent = 'tekrar hoş geldin' + (first() ? ', ' + first() : '');
    var sub = $('[data-docs-sub]'); if (sub && p && p.department) sub.textContent = trDept(p.department) + ' · slaytlarını, notlarını, müfredat belgelerini yükle; özetleri burada dursun.';
  };
  var renderDocs = function () {
    docsHead();
    var sec = $('#docs-list-section'); if (!sec) return;
    var docs = lsafe(function () { return activeDocuments; }, []) || [], cards = lsafe(function () { return activeStudyCards; }, []) || [];
    var sel = lsafe(function () { return selectedDocIds; }, []) || [];
    var cnt = $('[data-doc-count]'); if (cnt) cnt.textContent = docs.length + ' belge';
    if (!docs.length) {
      sec.innerHTML = '<div id="docs-grid"></div><div class="ax-cabinet"><div class="ax-empty"><b>arşiv boş</b><p>Henüz belge yüklemedin. Yukarıdaki tepsiye bir ders slaytı, not ya da makale bırak; özetini birlikte çıkaralım.</p></div></div>';
      return;
    }
    var list = docs.slice();
    if (docQ) list = list.filter(function (d) { return (d.file_name + ' ' + (d.course_tag || '')).toLocaleLowerCase('tr').indexOf(docQ) > -1; });
    list.sort(function (a, b) {
      if (docSort === 'az') return baseName(a.file_name).localeCompare(baseName(b.file_name), 'tr');
      var x = new Date(a.uploaded_at) - new Date(b.uploaded_at); return docSort === 'old' ? x : -x;
    });
    var h = '<div class="ax-cabinet"><div class="ax-folders" id="docs-grid">';
    if (!list.length) h += '<div class="ax-empty" style="grid-column:1/-1"><b>bulunamadı</b><p>Aramana uyan belge yok.</p></div>';
    list.forEach(function (doc, i) {
      var k = extKind(doc.file_name), kb = (doc.file_size || 0) / 1024;
      var size = kb > 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(1) + ' KB';
      var nm = baseName(doc.file_name), safe = jsq(doc.file_name);
      var dc = cards.filter(function (c) { return c.document_id === doc.id; });
      var stamp = '', body = '', main = '';
      if (doc.status === 'processing') {
        var sg = stageOf(doc.processing_stage);
        var upd = doc.updated_at ? new Date(doc.updated_at).getTime() : (doc.created_at ? new Date(doc.created_at).getTime() : Date.now());
        stamp = '<span class="ax-stamp run">işleniyor</span>';
        body = '<div class="ax-prog" role="status"><span>' + sg[0] + '…</span><i><b style="width:' + sg[1] + '%"></b></i></div>' +
          ((Date.now() - upd) > 210000 ? '<button type="button" class="ax-resum" style="color:var(--amber)" onclick="resetStuckDocument(\'' + doc.id + '\')">takıldı gibi: sıfırla ve tekrar dene</button>' : '');
      } else if (doc.status === 'summarized') {
        stamp = '<span class="ax-stamp ok">özetlendi</span>';
        if (dc.length > 1) {
          body = '<div class="ax-vers"><span class="hand" style="font-size:18px;color:var(--soft)">' + dc.length + ' özet sürümü:</span>' + dc.map(function (c) {
            return '<a href="#" onclick="viewStudyCardWrapper(event, \'' + doc.id + '\', \'' + safe + '\', \'' + c.id + '\')">' + esc(typeof getStyleLabel === 'function' ? getStyleLabel(c.summary_style) : c.summary_style) + ' · ' + (c.summary_language === 'tr' ? 'Türkçe' : 'English') + ' · ' + esc(dshort(c.created_at)) + '</a>';
          }).join('') + '</div>';
          main = '';
        } else {
          main = '<button type="button" class="ax-btn ax-btn-line btn-view-summary" data-doc-id="' + doc.id + '" data-doc-name="' + esc(doc.file_name) + '" data-card-id="' + (dc[0] ? dc[0].id : '') + '">Özeti gör</button>';
        }
        body += '<button type="button" class="ax-resum" onclick="openResummarizeModal(\'' + doc.id + '\')">farklı stille yeniden özetle</button>';
      } else {
        stamp = doc.status === 'failed' ? '<span class="ax-stamp bad">hata</span>' : '<span class="ax-stamp new">yüklendi</span>';
        if (doc.status === 'failed') body = '<span class="ax-fail">özetleme yarım kaldı; bir daha deneyelim.</span>';
        main = '<button type="button" class="ax-btn ax-btn-blue" id="btn-sum-' + doc.id + '" onclick="summarizeDocument(\'' + doc.id + '\')">Özetle</button>';
      }
      var tag = doc.course_tag
        ? '<button type="button" class="course-tag-pill" onclick="startEditCourseTag(\'' + doc.id + '\', this)" title="Ders etiketini düzenle">🏷️ ' + esc(doc.course_tag) + '</button>'
        : '<button type="button" class="add-course-tag-btn" onclick="startEditCourseTag(\'' + doc.id + '\', this)">+ ders etiketi</button>';
      h += '<article class="ax-folder doc-card' + (sel.indexOf(doc.id) > -1 ? ' is-sel' : '') + '" id="doc-card-' + doc.id + '" data-tab="' + esc(doc.course_tag || nm) + '" style="--r:' + tilt(i) + 'deg">' +
        '<div class="ax-f-top"><span class="ax-ficon" data-k="' + k[0] + '"><span>' + k[1] + '</span></span>' +
        '<div><h4 class="ax-fname" title="' + esc(doc.file_name) + '">' + esc(nm) + '</h4><span class="ax-fmeta">' + size + ' · ' + esc(dshort(doc.uploaded_at)) + '</span></div>' +
        '<label class="ax-check" title="Seç"><input type="checkbox" class="doc-bulk-select-checkbox" data-doc-id="' + doc.id + '" aria-label="' + esc(nm) + ' belgesini seç"' + (sel.indexOf(doc.id) > -1 ? ' checked' : '') + ' onclick="handleDocCheckboxClick(event); this.closest(\'.ax-folder\').classList.toggle(\'is-sel\', this.checked)"><i></i></label></div>' +
        '<div class="ax-f-mid">' + stamp + '<span class="doc-course-tag-wrapper" data-doc-id="' + doc.id + '">' + tag + '</span></div>' +
        body +
        '<div class="ax-f-foot">' + main + '<span class="sp"></span>' +
        '<button type="button" class="ax-iconbtn" title="İndir" aria-label="İndir" onclick="downloadDocument(\'' + jsq(doc.storage_path) + '\')">' + ICON.dl + '</button>' +
        '<button type="button" class="ax-iconbtn del" title="Sil" aria-label="Sil" onclick="confirmDeleteDocument(\'' + doc.id + '\', \'' + jsq(doc.storage_path) + '\')">' + ICON.del + '</button></div>' +
        '</article>';
    });
    h += '</div></div>';
    sec.innerHTML = h;
  };
  if (typeof renderDocumentsList === 'function') { renderDocumentsList = renderDocs; window.renderDocumentsList = renderDocs; }
  var dq = $('[data-doc-q]'), ds = $('[data-doc-sort]');
  if (dq) dq.addEventListener('input', function () { docQ = dq.value.trim().toLocaleLowerCase('tr'); renderDocs(); });
  if (ds) ds.addEventListener('change', function () { docSort = ds.value; renderDocs(); });
  if (typeof updateBulkDeleteBar === 'function') {
    var origBulk = updateBulkDeleteBar;
    updateBulkDeleteBar = function () { origBulk.apply(this, arguments); var c = $('#bulk-delete-count'), n = lsafe(function () { return selectedDocIds.length; }, 0); if (c && n) c.textContent = n + ' belge seçili'; };
  }

  /* ================= BÖLÜM AKIŞI ================= */
  var feedProfiles = {};
  var feedHead = function () {
    var p = prof(), sub = $('[data-feed-sub]');
    if (sub) sub.textContent = (p && p.department ? trDept(p.department) + ' · ' : '') + 'arkadaşlarının paylaştığı özetler, raptiyeler ve faydalı işaretleri.';
  };
  var drawChips = function () {
    var box = $('[data-feed-chips]'), sel = $('#feed-filter-course'); if (!box || !sel) return;
    var opts = $$('option', sel);
    if (opts.length <= 1) { box.innerHTML = ''; return; }
    box.innerHTML = opts.map(function (o) {
      return '<button type="button" class="ax-tape" aria-pressed="' + (o.value === sel.value) + '" data-c="' + esc(o.value) + '">' + (o.value === 'all' ? 'tüm dersler' : esc(o.textContent)) + '</button>';
    }).join('');
    $$('[data-c]', box).forEach(function (b, i) {
      b.style.transform = 'rotate(' + tilt(i + 2) + 'deg)';
      b.addEventListener('click', function () { sel.value = b.dataset.c; sel.dispatchEvent(new Event('change')); });
    });
  };
  var voteBtn = function (id) {
    var n = lsafe(function () { return feedVoteCounts[id] || 0; }, 0), on = lsafe(function () { return feedUserVotedSet.has(id); }, false);
    return '<button type="button" class="ax-vote" data-vote="' + id + '" aria-pressed="' + on + '" title="' + (on ? 'Faydalı işaretini kaldır' : 'Bunu faydalı buldum') + '">' + ICON.star + '<span>faydalı</span> <b>' + n + '</b></button>';
  };
  var doVote = async function (id, btn) {
    var u = me(); if (!u || btn.disabled) return;
    btn.disabled = true;
    var on = lsafe(function () { return feedUserVotedSet.has(id); }, false);
    try {
      var r = on ? await supabaseClient.from('study_card_votes').delete().eq('card_id', id).eq('user_id', u.id)
                 : await supabaseClient.from('study_card_votes').insert({ card_id: id, user_id: u.id });
      if (r.error) throw r.error;
      if (on) { feedUserVotedSet.delete(id); feedVoteCounts[id] = Math.max(0, (feedVoteCounts[id] || 1) - 1); }
      else { feedUserVotedSet.add(id); feedVoteCounts[id] = (feedVoteCounts[id] || 0) + 1; }
      btn.outerHTML = voteBtn(id);
      var nb = $('[data-vote="' + id + '"]'); if (nb) { nb.addEventListener('click', function () { doVote(id, nb); }); nb.focus(); }
    } catch (e) {
      console.error('acadex-ink: oy kaydedilemedi', e);
      if (typeof showDashboardAlert === 'function') showDashboardAlert('error', 'Oy kaydedilemedi. Biraz sonra tekrar dene.');
      btn.disabled = false;
    }
  };
  var renderFeed = function (cards, profileMap) {
    feedHead();
    var sec = $('#feed-list-section'); if (!sec) return;
    cards = cards || []; feedProfiles = profileMap || feedProfiles || {};
    drawChips();
    var p = prof(), dept = p && p.department ? trDept(p.department) : 'bölüm';
    var short = p && p.department && typeof getDepartmentShortName === 'function' ? getDepartmentShortName(p.department) : '';
    var h = '<div class="ax-board"><span class="ax-board-label"><span>' + esc(short || 'PANO') + '</span> · <b>' + (cards.length ? cards.length + ' özet asılı' : 'boş pano') + '</b></span>';
    if (!cards.length) {
      h += '<div class="ax-board-empty"><b>pano şimdilik boş</b><p>' + esc(dept) + ' panosuna henüz özet asılmadı. İlk özeti sen as: Bilgi kartları\'nda bir kartı “bölümümle paylaş” yapman yeterli.</p><button type="button" class="ax-btn ax-btn-dark" onclick="switchDashboardView(\'cards\')">Bilgi kartlarına git</button></div>';
    } else {
      h += '<div class="ax-pins">';
      cards.forEach(function (c, i) {
        var who = feedProfiles[c.user_id] || { full_name: 'Bir arkadaşın', avatar_url: null };
        var nm = (c.documents && c.documents.file_name) || 'Paylaşılan belge';
        var txt = String(c.summary || '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();
        var ex = txt.length > 260 ? txt.slice(0, 260).replace(/\s+\S*$/, '') + '…' : (txt || 'Bu kartta özet metni yok.');
        h += '<article class="ax-pin" style="--r:' + tilt(i + 1) + 'deg">' +
          '<div class="ax-pin-who">' + avatar(who) + '<span><b>' + esc(who.full_name || 'Bir arkadaşın') + '</b><small>' + esc(ago(c.shared_at || c.created_at)) + '</small></span>' + (c.course_tag ? '<span class="ax-tape">' + esc(c.course_tag) + '</span>' : '') + '</div>' +
          '<span class="lbl">ÖZET</span><h4>' + esc(baseName(nm)) + '</h4><p>' + esc(ex) + '</p>' +
          '<div class="ax-pin-foot"><button type="button" class="ax-link btn-view-summary" data-doc-id="' + c.document_id + '" data-doc-name="' + esc(nm) + '" data-card-id="' + c.id + '" data-read-only="true">kâğıdı aç →</button>' + voteBtn(c.id) + '</div>' +
          '</article>';
      });
      h += '</div>';
      var lim = lsafe(function () { return departmentFeedLimit; }, 30);
      if (cards.length >= lim) h += '<div class="ax-more"><button type="button" class="ax-btn ax-btn-line" data-more>daha fazla göster</button></div>';
    }
    h += '</div>';
    sec.innerHTML = h;
    $$('[data-vote]', sec).forEach(function (b) { b.addEventListener('click', function () { doVote(b.dataset.vote, b); }); });
    var more = $('[data-more]', sec);
    if (more) more.addEventListener('click', async function () { more.disabled = true; more.textContent = 'yükleniyor…'; departmentFeedLimit += 30; await loadDepartmentFeed(); });
    /* panoya asanlar: akıştaki gerçek paylaşımlardan */
    var roll = $('[data-roll-list]');
    if (roll) {
      var by = {};
      cards.forEach(function (c) { (by[c.user_id] = by[c.user_id] || { n: 0, last: c.shared_at || c.created_at }).n++; });
      var ids = Object.keys(by).sort(function (a, b) { return by[b].n - by[a].n; });
      roll.innerHTML = ids.length ? ids.map(function (id) {
        var w = feedProfiles[id] || { full_name: 'Bir arkadaşın' };
        return '<li>' + avatar(w) + '<span><b>' + esc(w.full_name || 'Bir arkadaşın') + (me() && id === me().id ? ' (sen)' : '') + '</b><small>' + by[id].n + ' özet · son ' + esc(ago(by[id].last)) + '</small></span></li>';
      }).join('') : '<li class="none">henüz kimse asmadı.</li>';
    }
  };
  if (typeof renderDepartmentFeed === 'function') { renderDepartmentFeed = renderFeed; window.renderDepartmentFeed = renderFeed; }
  if (typeof loadDepartmentFeed === 'function') {
    var origFeed = loadDepartmentFeed;
    loadDepartmentFeed = async function () {
      feedHead();
      var sec = $('#feed-list-section'); if (sec && !sec.querySelector('.ax-board')) sec.innerHTML = '<div class="ax-board"><span class="ax-board-label"><b>pano yükleniyor…</b></span></div>';
      var r = await origFeed.apply(this, arguments);
      var sec2 = $('#feed-list-section');
      if (sec2 && !sec2.querySelector('.ax-board')) sec2.innerHTML = '<div class="ax-board"><div class="ax-board-empty"><b>pano açılamadı</b><p>Bağlantıda bir sorun olabilir. Sayfayı yenileyip tekrar dene.</p></div></div>';
      return r;
    };
  }

  /* ================= BİLGİ KARTLARI ================= */
  var boxOf = function (conf) { var d = Number(conf.interval_days) || 0; return d <= 1 ? 0 : d <= 2 ? 1 : d <= 4 ? 2 : d <= 7 ? 3 : 4; };
  var cardStats = function (card) {
    var pool = typeof buildCardReviewPool === 'function' ? buildCardReviewPool(card) : [];
    var map = lsafe(function () { return libraryConfidenceMap; }, {}) || {}, now = Date.now();
    var boxes = [0, 0, 0, 0, 0], due = 0, fresh = 0, seen = 0;
    pool.forEach(function (it) {
      var c = map[it._studyCardId + ':' + it._key];
      if (!c) { fresh++; return; }
      seen++; boxes[boxOf(c)]++;
      if (!c.next_review_at || new Date(c.next_review_at).getTime() <= now) due++;
    });
    return { total: pool.length, boxes: boxes, due: due, fresh: fresh, seen: seen };
  };
  var dueLabel = function () {
    var el = $('[data-due]'); if (!el) return;
    var all = lsafe(function () { return libraryCards; }, []) || [], due = 0;
    all.forEach(function (c) { due += cardStats(c).due; });
    el.textContent = all.length ? (due ? 'bugün ' + due + ' kart tekrar bekliyor' : 'bugün tekrar yok') : '';
  };
  var detail = function (cardId, cards) {
    var pane = $('#lib-md-detail'); if (!pane) return;
    var all = lsafe(function () { return libraryCards; }, []) || [];
    var card = (cards || []).find(function (c) { return c.id === cardId; }) || all.find(function (c) { return c.id === cardId; });
    if (!card) { pane.innerHTML = '<div class="ax-empty"><b>bir deste seç</b><p>Soldaki kutulardan birine dokun.</p></div>'; return; }
    var nm = (card.documents && card.documents.file_name) || 'İsimsiz belge', safe = jsq(nm);
    var s = cardStats(card);
    var terms = (card.key_terms || []).length, pts = (card.key_points || []).length, quiz = (card.quiz_questions || []).length, cl = (card.cloze_cards || []).length;
    var sumHtml = typeof formatSummaryText === 'function' ? formatSummaryText(card.summary) : esc(card.summary || '');
    var mode = function (type, title, hint, n) { return '<button type="button" class="ax-mode" ' + (n ? '' : 'disabled ') + 'onclick="openFlashcardViewer(\'' + card.id + '\', \'' + type + '\', \'' + safe + '\')"><span class="n">' + n + '</span><b>' + title + '</b><small>' + hint + '</small></button>'; };
    var LB = ['her gün', '2 günde', '4 günde', 'haftada', '2 haftada'], mx = Math.max.apply(null, s.boxes.concat([1]));
    pane.innerHTML =
      '<div class="ax-detail">' +
      '<div class="ax-sum"><h3>özet <small>' + esc(baseName(nm)) + '</small></h3>' +
      '<div class="ax-sum-t">' + (sumHtml || '<p>Bu kartta özet metni yok.</p>') + '</div>' +
      '<div class="ax-sum-act">' +
      '<button type="button" class="ax-btn ax-btn-line btn-view-summary" data-doc-id="' + card.document_id + '" data-doc-name="' + esc(nm) + '" data-card-id="' + card.id + '">' + ICON.eye + 'Tam özeti aç</button>' +
      '<button type="button" class="ax-btn ax-btn-line" onclick="addStickyNoteToNotebook(\'' + card.id + '\', \'' + safe + '\', \'' + jsq(card.summary || '') + '\')">Deftere gönder</button>' +
      '<label class="ax-switch" title="Bölüm akışına as"><input type="checkbox" id="share-switch-lib-' + card.id + '"' + (card.is_shared ? ' checked' : '') + ' onchange="toggleShareStudyCard(\'' + card.id + '\', this.checked)"><i></i>bölümümle paylaş</label>' +
      '<span class="sp" style="flex:1"></span>' +
      '<button type="button" class="ax-iconbtn del" title="Desteyi sil" aria-label="Desteyi sil" onclick="deleteStudyCard(event, \'' + card.id + '\', \'' + card.document_id + '\')">' + ICON.del + '</button>' +
      '</div></div>' +
      '<div><div class="ax-modes">' +
      '<button type="button" class="ax-mode big" ' + (s.total ? '' : 'disabled ') + 'onclick="openAdaptiveReview(\'' + card.id + '\', \'' + safe + '\')"><b>Akıllı tekrar</b><small>' + (s.total ? (s.due ? s.due + ' kart vadesi geldi' : s.fresh ? s.fresh + ' kart hiç görülmedi' : 'şimdilik hepsi yerinde') : 'bu destede soru yok') + '</small><span class="n">' + s.total + '</span></button>' +
      mode('terms', 'Anahtar terimler', 'tanımları çevir', terms) + mode('points', 'Önemli noktalar', 'sınavlık fikirler', pts) +
      mode('quiz', 'Kendini test et', 'soru–cevap turu', quiz) + mode('cloze', 'Boşluk doldurma', 'eksik kelimeyi bul', cl) +
      '</div>' +
      '<div class="ax-leit"><h4>tekrar kutusu</h4><div class="ax-leit-box">' + s.boxes.map(function (n, i) { return '<div><small>' + LB[i] + '</small><i style="height:' + Math.round(6 + 40 * n / mx) + 'px"></i><b>' + n + '</b></div>'; }).join('') + '</div>' +
      '<p>' + (s.seen ? 'bildiğin kart bir bölme ileri gider; bilemediğin baştan başlar.' : 'henüz tekrar yapmadın; ilk turdan sonra kartların kutulara dağılır.') + '</p></div></div>' +
      '</div>';
  };
  var renderLib = function (cards) {
    var sec = $('#cards-list-section'); if (!sec) return;
    var all = lsafe(function () { return libraryCards; }, []) || [];
    if (!cards) cards = window.filteredLibraryCardsList || all;
    dueLabel();
    if (!cards.length) {
      sec.innerHTML = all.length
        ? '<div class="ax-card ax-empty"><b>bu filtreye uyan kart yok</b><p>Aramayı ya da filtreleri değiştir.</p><button type="button" class="ax-btn ax-btn-line" onclick="document.getElementById(\'btn-clear-filters\').click(); setCardsStatusFilter(\'all\')">Filtreleri temizle</button></div>'
        : '<div class="ax-card ax-empty"><b>henüz bir desten yok</b><p>Belgelerim\'den bir dosya yükleyip özetlediğinde kart destesi burada belirir.</p><button type="button" class="ax-btn ax-btn-dark" onclick="switchDashboardView(\'docs\')">Belgelerime git</button></div>';
      return;
    }
    var act = lsafe(function () { return libraryActiveCardId; }, null);
    if (!act || !cards.some(function (c) { return c.id === act; })) act = cards[0].id;
    try { libraryActiveCardId = act; } catch (e) {}
    var h = '<div class="ax-lib"><div class="ax-decks" id="lib-md-list" role="list" aria-label="Kart desteleri">';
    cards.forEach(function (c) {
      var nm = baseName(c.documents && c.documents.file_name), st = typeof getCardProgressStats === 'function' ? getCardProgressStats(c) : { total: 0, percent: 0 };
      h += '<button type="button" class="ax-dbox lib-md-item" role="listitem" data-card-id="' + c.id + '" aria-current="' + (c.id === act) + '" onclick="selectLibraryCard(\'' + c.id + '\')">' +
        (c.is_shared ? '<span class="sh">panoda</span>' : '') +
        '<span class="lab"><b>' + esc(nm) + '</b><small>' + esc(dshort(c.created_at)) + '</small></span>' +
        '<span class="tags"><span>' + esc(typeof getStyleLabel === 'function' ? getStyleLabel(c.summary_style) : (c.summary_style || '')) + '</span><span>' + (c.summary_language === 'tr' ? 'TR' : 'EN') + '</span>' + (c.course_tag ? '<span>' + esc(c.course_tag) + '</span>' : '') + '</span>' +
        '<span class="pr">' + (st.total ? '<i><b style="width:' + st.percent + '%"></b></i>%' + st.percent : 'çalışılacak madde yok') + '</span></button>';
    });
    h += '</div><div id="lib-md-detail"></div></div>';
    sec.innerHTML = h;
    detail(act, cards);
  };
  if (typeof renderCardsLibraryList === 'function') { renderCardsLibraryList = renderLib; window.renderCardsLibraryList = renderLib; }
  if (typeof renderLibraryDetailPane === 'function') { renderLibraryDetailPane = detail; window.renderLibraryDetailPane = detail; }
  if (typeof selectLibraryCard === 'function') {
    selectLibraryCard = function (id) {
      try { libraryActiveCardId = id; } catch (e) {}
      $$('#lib-md-list .ax-dbox').forEach(function (b) { b.setAttribute('aria-current', String(b.dataset.cardId === id)); });
      detail(id, window.filteredLibraryCardsList || lsafe(function () { return libraryCards; }, []));
      if (window.innerWidth <= 900) { var d = $('#lib-md-detail'); if (d) d.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
    };
    window.selectLibraryCard = selectLibraryCard;
  }
  if (typeof loadCardsLibrary === 'function') {
    var origLib = loadCardsLibrary;
    loadCardsLibrary = async function () {
      var r = await origLib.apply(this, arguments);
      var o = $('#cards-filter-course option[value="all"]'); if (o) o.textContent = 'tüm dersler';
      return r;
    };
  }
})();
