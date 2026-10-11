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

/* ================= BUGÜN · masa (tam tasarım, gerçek veri) ================= */
(function () {
  'use strict';
  var root = document.getElementById('home-view');
  if (!root || !root.classList.contains('axd')) return;
  document.documentElement.classList.add('js');
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var prof = function () { return lsafe(function () { return currentUserProfile; }, null) || window.currentUserProfile || null; };
  var me = function () { return lsafe(function () { return currentUser; }, null) || window.currentUser || null; };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem('acadex.dash.' + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('acadex.dash.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem('acadex.dash.' + k); } catch (e) {} }
  };
  var ymd = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var dm = function (d) { d = new Date(d); return d.getDate() + ' ' + MON[d.getMonth()]; };
  var dd2 = function (d) { d = new Date(d); return ('0' + d.getDate()).slice(-2) + ' · ' + ('0' + (d.getMonth() + 1)).slice(-2); };
  var hm = function (d) { d = new Date(d); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  var baseName = function (n) {
    n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, '');
    var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1];
    n = n.replace(/_+/g, ' ').trim();
    return n || 'İsimsiz belge';
  };
  var extOf = function (n) { var e = String(n || '').split('.').pop().toUpperCase(); return e === 'DOCX' || e === 'DOC' ? 'DOC' : e === 'PPTX' || e === 'PPT' ? 'PPT' : e === 'PDF' ? 'PDF' : 'TXT'; };
  var shortName = function (n) { var w = baseName(n).split(/\s+/); return w.length > 1 ? (w[0].charAt(0) + ' ' + w.slice(1).join(' ')).slice(0, 10) : w[0].slice(0, 10); };
  var rng = function (seed) { var x = 0; for (var i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
  var go = function (v) { if (typeof switchDashboardView === 'function') switchDashboardView(v); };
  var now = new Date();

  /* data-go: tasarımdaki bağlantılar panellere geçer */
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-go]'); if (!a || !root.contains(a)) return;
    e.preventDefault(); go(a.getAttribute('data-go'));
  });

  /* ---------- ölçüye göre çizgiler, sayım çizgileri, görününce çiz ---------- */
  var io = (!reduce && 'IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' }) : null;
  var reveal = function (els) { els.forEach(function (el) { if (io) io.observe(el); else el.classList.add('on'); }); };
  var prepDrw = function (scope) { $$('.drw', scope).forEach(function (s) { $$('path, circle', s).forEach(function (el, i) { el.setAttribute('pathLength', '1'); el.style.setProperty('--i', i); }); }); };
  var tally = function (t, n) {
    t.innerHTML = ''; if (!n) return;
    var shown = Math.min(n, 20), groups = Math.ceil(shown / 5), w = groups * 34;
    var s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 ' + w + ' 36'); s.setAttribute('class', 'drw'); s.style.width = (w * 0.8) + 'px';
    for (var k = 0; k < shown; k++) {
      var g = Math.floor(k / 5), j = k % 5, x = g * 34 + 4 + j * 6, wob = ((k * 7) % 3 - 1) * 0.8;
      var d = j < 4 ? 'M' + (x + wob) + ' 5 C' + (x + 1) + ' 14 ' + (x - 1) + ' 24 ' + (x + wob * -1) + ' 32' : 'M' + (g * 34 + 1) + ' 26 C' + (g * 34 + 10) + ' 20 ' + (g * 34 + 18) + ' 14 ' + (g * 34 + 27) + ' 9';
      var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); p.setAttribute('pathLength', '1'); p.style.setProperty('--i', k); s.appendChild(p);
    }
    t.appendChild(s); reveal([s]);
  };
  $$('.land').forEach(function (el, i) { el.style.setProperty('--hr', (((i * 37) % 11 - 5) * 0.3).toFixed(2) + 'deg'); el.style.setProperty('--hx', (((i * 53) % 9 - 4) * 2) + 'px'); });
  prepDrw(root); reveal($$('.drw, [data-reveal]'));

  /* ---------- selam, tarih, ışık ---------- */
  var h = now.getHours(), tod = h >= 5 && h < 11 ? 'sabah' : h < 17 ? 'gun' : h < 22 ? 'aksam' : 'gece';
  var band = $('.band'); band.setAttribute('data-tod', tod);
  var greet = function () {
    var p = prof(), n = (p && p.full_name) || ((me() && me().email) || '').split('@')[0] || '';
    n = String(n).split(/\s+/)[0]; n = n ? n.charAt(0).toLocaleUpperCase('tr') + n.slice(1) : '';
    $('[data-greet]').textContent = { sabah: 'günaydın', gun: 'iyi çalışmalar', aksam: 'iyi akşamlar', gece: 'geç saatte de buradasın' }[tod] + (n ? ', ' + n : '');
  };
  try { $('[data-date]').textContent = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleLowerCase('tr'); } catch (e) {}
  greet();

  /* ---------- kenar çizgileri (el çizimi) ---------- */
  var drawEdge = function (card) {
    var w = card.offsetWidth, ht = card.offsetHeight; if (!w || !ht) return;
    var r = rng(card.getAttribute('aria-labelledby') || 'c');
    var svg = card.querySelector(':scope > .edge');
    if (!svg) { svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'edge'); svg.setAttribute('aria-hidden', 'true'); card.insertBefore(svg, card.firstChild); }
    svg.setAttribute('viewBox', '-1 -1 ' + (w + 2) + ' ' + (ht + 2));
    var j = function (a) { return ((r() - 0.5) * 2 * a).toFixed(1); };
    var line = function (x1, y1, x2, y2, horiz) {
      var len = horiz ? Math.abs(x2 - x1) : Math.abs(y2 - y1), n = Math.max(2, Math.round(len / 90)), d = 'M' + x1 + ' ' + y1;
      for (var k = 1; k <= n; k++) {
        var t = k / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, cx = x1 + (x2 - x1) * (t - 0.5 / n), cy = y1 + (y2 - y1) * (t - 0.5 / n);
        d += ' Q' + (horiz ? cx : +cx + +j(1.1)) + ' ' + (horiz ? +cy + +j(1.1) : cy) + ' ' + (horiz ? x : +x + +j(0.4)) + ' ' + (horiz ? +y + +j(0.4) : y);
      }
      return d;
    };
    var o = function () { return 2 + r() * 4; };
    svg.innerHTML = '<path d="' + line(6 - o(), 0.5, w - 6 + o(), 0.5 + +j(0.8), true) + '"/><path d="' + line(w - 0.5, 6 - o(), w - 0.5 + +j(0.8), ht - 6 + o(), false) + '"/>' +
      '<path d="' + line(w - 6 + o(), ht - 0.5, 6 - o(), ht - 0.5 + +j(0.8), true) + '"/><path d="' + line(0.5, ht - 6 + o(), 0.5 + +j(0.8), 6 - o(), false) + '"/>';
  };
  var grid = $('.grid'), cards = function () { return $$('.grid > .card'); };
  var tones = ['#FFFFFF', '#FEFEFC', '#FBFCFF', '#FFFFFE', '#FCFCFD'];
  cards().forEach(function (c, i) { c.style.setProperty('--tone', tones[i % tones.length]); });
  var edges = function () { cards().forEach(drawEdge); };
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(function (es) { es.forEach(function (e) { drawEdge(e.target); }); }); cards().forEach(function (c) { ro.observe(c); }); }
  else window.addEventListener('resize', edges);
  var byId = function (id) { return $('.grid > .card[aria-labelledby="' + id + '"]'); };
  ['t-log', 't-short'].forEach(function (k) { var c = byId(k); if (c) c.classList.add('curl'); });
  var cf = byId('t-facts'); if (cf) cf.classList.add('taped');

  /* ---------- yarınki sana not (bu tarayıcıda) ---------- */
  (function () {
    var todayK = ymd(now), memo = $('#memo-t'), memoL = $('[data-memo-l]'), memoS = $('[data-memo-s]'), saved = store.get('memo');
    if (saved && saved.t) {
      memo.value = saved.t;
      if (saved.d !== todayK) {
        var y = new Date(now); y.setDate(now.getDate() - 1);
        var when = saved.d === ymd(y) ? 'dün' : new Date(saved.d + 'T12:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' günü';
        memoL.textContent = when + ' kendine şunu yazmıştın:';
      } else memoL.textContent = 'yarınki sana notun';
    }
    var memoB = $('[data-memo-b]'), memoP = $('[data-memo-peek]'), box = $('[data-memo]');
    var peek = function () {
      var v = memo.value.trim(); if (!v) { memoP.textContent = 'yarınki sana bir not bırak'; return; }
      var pre = /yazmıştın/.test(memoL.textContent) ? memoL.textContent.replace(' kendine şunu yazmıştın:', ' yazmıştın: ') : 'notun: ';
      memoP.textContent = pre + (v.length > 30 ? v.slice(0, 30).trim() + '…' : v);
    };
    peek();
    var open = function (o) { box.hidden = !o; memoB.setAttribute('aria-expanded', String(o)); if (o) memo.focus(); else { peek(); memoB.focus(); } };
    memoB.addEventListener('click', function () { open(box.hidden); });
    $('[data-memo-x]').addEventListener('click', function () { open(false); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); open(false); } });
    document.addEventListener('click', function (e) { if (!box.hidden && !e.target.closest('.memo-w')) { box.hidden = true; memoB.setAttribute('aria-expanded', 'false'); peek(); } });
    var mt = 0;
    memo.addEventListener('input', function () {
      clearTimeout(mt);
      mt = setTimeout(function () {
        var v = memo.value.trim();
        if (!v) { store.del('memo'); memoL.textContent = 'yarınki sana bir not bırak'; memoS.textContent = 'yalnızca bu tarayıcıda kalır'; return; }
        memoS.textContent = store.set('memo', { t: v, d: todayK }) ? 'kaydedildi, yarın burada olacak' : 'bu tarayıcı notu saklamıyor';
        memoL.textContent = 'yarınki sana notun';
      }, 400);
    });
  })();

  /* ---------- lamba: ipi çek ---------- */
  (function () {
    var pull = $('[data-pull]'), lampW = $('[data-lamp]');
    var on = store.get('lamp'); if (on === null) on = true;
    var ang = 0, vel = 0, raf = 0;
    var swing = function () { vel += -0.05 * ang; vel *= 0.95; ang += vel; lampW.style.transform = 'rotate(' + ang.toFixed(2) + 'deg)'; if (Math.abs(ang) + Math.abs(vel) > 0.02) raf = requestAnimationFrame(swing); else { lampW.style.transform = ''; ang = vel = 0; raf = 0; } };
    var set = function (v, anim) {
      on = v; band.classList.toggle('lamp-on', on); pull.setAttribute('aria-pressed', String(on)); pull.setAttribute('aria-label', on ? 'Lambayı kapat' : 'Lambayı aç'); store.set('lamp', on);
      if (anim && !reduce) { if (on) { band.classList.remove('flick'); void band.offsetWidth; band.classList.add('flick'); } vel += 1.6; if (!raf) raf = requestAnimationFrame(swing); }
    };
    set(on, false);
    var st = null, moved = false;
    pull.addEventListener('pointerdown', function (e) { if (e.button !== 0) return; e.preventDefault(); st = { y: e.clientY }; moved = false; pull.classList.add('pulling'); try { pull.setPointerCapture(e.pointerId); } catch (er) {} });
    pull.addEventListener('pointermove', function (e) { if (!st) return; var d = Math.max(0, Math.min(34, e.clientY - st.y)); if (d > 3) moved = true; pull.style.setProperty('--pl', d + 'px'); });
    var up = function () {
      if (!st) return; var d = parseFloat(pull.style.getPropertyValue('--pl')) || 0; st = null;
      pull.classList.remove('pulling'); pull.style.setProperty('--pl', '0px');
      if (moved) { if (d > 12) set(!on, true); else { vel += 0.6; if (!raf && !reduce) raf = requestAnimationFrame(swing); } }
    };
    pull.addEventListener('pointerup', up); pull.addEventListener('pointercancel', up);
    pull.addEventListener('click', function () { if (moved) { moved = false; return; } if (!reduce) { pull.style.setProperty('--pl', '16px'); setTimeout(function () { pull.style.setProperty('--pl', '0px'); }, 140); } set(!on, true); });
  })();

  /* ---------- masadaki nesneler: tut, fırlat, geri sallanır ---------- */
  var throwable = function (el) {
    if (el.dataset.thr) return; el.dataset.thr = '1';
    var st = null, moved = false, x = 0, y = 0, vx = 0, vy = 0, raf = 0;
    var put = function () { el.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px'; el.style.rotate = (x * 0.04 + vx * 0.6).toFixed(2) + 'deg'; };
    var spring = function () { vx += -0.06 * x; vy += -0.06 * y; vx *= 0.86; vy *= 0.86; x += vx; y += vy; put(); if (Math.abs(x) + Math.abs(y) + Math.abs(vx) + Math.abs(vy) > 0.15) raf = requestAnimationFrame(spring); else { x = y = vx = vy = 0; el.style.translate = ''; el.style.rotate = ''; raf = 0; } };
    el.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch' || e.button !== 0) return; cancelAnimationFrame(raf); st = { px: e.clientX - x, py: e.clientY - y, lx: e.clientX, ly: e.clientY }; moved = false; });
    window.addEventListener('pointermove', function (e) {
      if (!st) return; var nx = e.clientX - st.px, ny = e.clientY - st.py;
      if (!moved && Math.abs(nx - x) + Math.abs(ny - y) < 5) return;
      if (!moved) { moved = true; el.classList.add('grabbing'); try { el.setPointerCapture(e.pointerId); } catch (er) {} }
      vx = e.clientX - st.lx; vy = e.clientY - st.ly; st.lx = e.clientX; st.ly = e.clientY;
      x = Math.max(-260, Math.min(260, nx)); y = Math.max(-160, Math.min(160, ny)); put();
    });
    var up = function () { if (!st) return; st = null; el.classList.remove('grabbing'); if (moved) { if (reduce) { x = y = vx = vy = 0; el.style.translate = ''; el.style.rotate = ''; } else raf = requestAnimationFrame(spring); } };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    el.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopImmediatePropagation(); moved = false; } }, true);
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
  };
  $$('.objs .pdf, .objs .deck').forEach(throwable);
  var deck = $('[data-deck]'), dtop = $('.dtop', deck);
  deck.addEventListener('click', function () {
    var flip = function () { deck.setAttribute('aria-pressed', String(deck.getAttribute('aria-pressed') !== 'true')); };
    if (reduce) { flip(); return; }
    dtop.classList.add('squash'); setTimeout(function () { flip(); dtop.classList.remove('squash'); }, 180);
  });

  /* ---------- haftalık hedef halkası ---------- */
  var goalEl = $('[data-goal]'), doneWeek = 0;
  var arc = function (cx, cy, rr, a0, a1, rnd) {
    var p = function (a, rad) { return (cx + rad * Math.cos(a)).toFixed(1) + ' ' + (cy + rad * Math.sin(a)).toFixed(1); };
    var m = (a0 + a1) / 2, rm = rr + (rnd() - 0.5) * 1.6;
    return 'M' + p(a0, rr) + ' Q' + p(m, rm / Math.cos((a1 - a0) / 2)) + ' ' + p(a1, rr + (rnd() - 0.5));
  };
  var drawGoal = function (n, picking) {
    if (!n || picking) {
      goalEl.innerHTML = '<div class="goal-pick" role="group" aria-label="Bu hafta kaç gün çalışacaksın?"><span class="hand">bu hafta kaç gün?</span>' +
        [3, 4, 5, 6, 7].map(function (k) { return '<button type="button" data-n="' + k + '" aria-label="' + k + ' gün">' + k + '</button>'; }).join('') + '</div>';
      return;
    }
    var rnd = rng('goal' + n), segs = '', gap = 0.22, step = Math.PI * 2 / n;
    for (var k = 0; k < n; k++) { var a0 = -Math.PI / 2 + k * step + gap / 2, a1 = a0 + step - gap; segs += '<path class="seg ' + (k < doneWeek ? 'on' : 'off') + '" pathLength="1" style="--i:' + k + '" d="' + arc(31, 31, 26, a0, a1, rnd) + '"/>'; }
    var dn = Math.min(doneWeek, n);
    goalEl.innerHTML = '<svg class="ring drw" viewBox="0 0 62 62" role="img" aria-label="Haftalık hedef: ' + n + ' günden ' + dn + ' tanesi tamam">' + segs + '<text x="31" y="36.5" text-anchor="middle">' + dn + '/' + n + '</text></svg>' +
      '<div class="goal-t"><span class="hand">hedef: ' + n + ' gün</span><small>' + (doneWeek >= n ? 'bu haftalık tamam, helal olsun' : (n - doneWeek) + ' gün daha') + '</small></div><button type="button" class="g-ch" data-goal-ch="">değiştir</button>';
    var ring = $('.ring', goalEl); $$('.seg.off', ring).forEach(function (s) { s.removeAttribute('pathLength'); });
    if (reduce) ring.classList.add('on'); else requestAnimationFrame(function () { requestAnimationFrame(function () { ring.classList.add('on'); }); });
  };
  goalEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-n]');
    if (b) { var n = +b.getAttribute('data-n'); store.set('goal', n); drawGoal(n); var c = $('[data-goal-ch]'); if (c) c.focus(); return; }
    if (e.target.closest('[data-goal-ch]')) { drawGoal(store.get('goal'), true); var f = $('[data-n]', goalEl); if (f) f.focus(); }
  });

  /* ---------- seri: son iki hafta (profildeki gerçek seriden) ---------- */
  var drawStreak = function () {
    var p = prof() || {}, streak = Number(p.current_streak) || 0, last = p.last_active_date ? new Date(p.last_active_date + 'T12:00:00') : null;
    var on = {};
    if (last && streak > 0) for (var k = 0; k < Math.min(streak, 60); k++) { var x = new Date(last); x.setDate(last.getDate() - k); on[ymd(x)] = 1; }
    var cal = $('[data-cal]'); cal.innerHTML = '';
    ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].forEach(function (d) { var s = document.createElement('span'); s.textContent = d; cal.appendChild(s); });
    var start = new Date(now); start.setDate(now.getDate() - 13);
    for (var q = 0; q < (start.getDay() + 6) % 7; q++) { var pad = document.createElement('i'); pad.style.visibility = 'hidden'; cal.appendChild(pad); }
    var ticks = 0, n14 = 0;
    for (var i = 0; i < 14; i++) {
      var day = new Date(start); day.setDate(start.getDate() + i);
      var c = document.createElement('i'); c.textContent = day.getDate();
      if (i === 13) c.className = 'today-c';
      if (on[ymd(day)]) { n14++; c.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 22 22"><path pathLength="1" style="--d:' + (0.4 + (ticks++) * 0.18).toFixed(2) + 's" d="M4 12 C6 13 7.6 15 9 17.5 C11.5 11 14.5 7 19.5 3.5"/></svg>'); }
      cal.appendChild(c);
    }
    cal.setAttribute('aria-label', n14 ? 'Son iki hafta: ' + n14 + ' gün çalıştın.' : 'Son iki haftada henüz çalışma günü yok.');
    var mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); doneWeek = 0;
    for (var w = 0; w < 7; w++) { var dd = new Date(mon); dd.setDate(mon.getDate() + w); if (dd <= now && on[ymd(dd)]) doneWeek++; }
    drawGoal(store.get('goal'));
    var alive = last && (ymd(last) === ymd(now) || ymd(last) === ymd(new Date(now.getTime() - 864e5)));
    var s2 = alive ? streak : 0;
    var note = $('[data-streak-note]');
    note.innerHTML = '<span class="tally" aria-hidden="true"></span><span>' + (s2 > 1 ? '<b>' + s2 + ' gündür</b> çalışıyorsun. Yarın da uğrarsan ' + (s2 + 1) + ' olur.' : s2 === 1 ? '<b>1 gün:</b> serin başladı. Yarın da gel, iki olsun.' : '<b>bugün</b> yeni bir seriye başla.') + '</span>';
    tally($('.tally', note), s2);
  };

  /* ---------- ders kartlarının yeri: tutamaçla taşı ---------- */
  var live = $('[data-order-live]'), resetB = $('[data-order-reset]'), sched = $('.grid > .sched');
  var movable = function () { return $$('.grid > .card:not(.sched)'); };
  var keyOf = function (c) { return c.getAttribute('aria-labelledby'); };
  var nameOf = function (c) { var h2 = $('#' + keyOf(c)); return h2 ? h2.textContent.trim() : ''; };
  var defaultOrder = movable().map(keyOf);
  var saveOrder = function () { var o = movable().map(keyOf), same = o.join() === defaultOrder.join(); if (same) store.del('order'); else store.set('order', o); resetB.hidden = same; };
  var applyOrder = function (o) { o.forEach(function (k) { var c = byId(k); if (c) grid.insertBefore(c, sched); }); movable().forEach(function (c) { if (o.indexOf(keyOf(c)) < 0) grid.insertBefore(c, sched); }); };
  var savedOrder = store.get('order');
  if (savedOrder && savedOrder.length) { applyOrder(savedOrder); resetB.hidden = savedOrder.join() === defaultOrder.join(); }
  var flip = function (fn, skip) {
    var before = new Map(); movable().forEach(function (c) { before.set(c, c.getBoundingClientRect()); });
    fn(); if (reduce) return;
    movable().forEach(function (c) { if (c === skip) return; var a = before.get(c), b = c.getBoundingClientRect(); if (!a) return; var dx = a.left - b.left, dy = a.top - b.top; if (dx || dy) c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' }); });
  };
  var gripSvg = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="5" r="1.6"/><circle cx="13" cy="5.3" r="1.6"/><circle cx="7.2" cy="10" r="1.6"/><circle cx="13" cy="10" r="1.6"/><circle cx="7" cy="15" r="1.6"/><circle cx="12.8" cy="15.2" r="1.6"/></svg>';
  movable().forEach(function (card) {
    var hd = $('.card-h', card); if (!hd) return;
    var g = document.createElement('button'); g.type = 'button'; g.className = 'grip'; g.innerHTML = gripSvg;
    g.setAttribute('aria-label', '“' + nameOf(card) + '” kartını taşı. Ok tuşlarıyla yerini değiştir.'); hd.appendChild(g);
    g.addEventListener('keydown', function (e) {
      var list = movable(), i = list.indexOf(card), to = -1;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = i - 1; else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = i + 1; else return;
      e.preventDefault(); if (to < 0 || to >= list.length) return;
      flip(function () { grid.insertBefore(card, to < i ? list[to] : list[to].nextSibling); });
      g.focus(); saveOrder(); live.textContent = '“' + nameOf(card) + '” ' + (to + 1) + '. sıraya taşındı';
    });
    g.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return; e.preventDefault();
      var r0 = card.getBoundingClientRect(), offX = e.clientX - r0.left, offY = e.clientY - r0.top;
      var place = function (px, py) { card.style.translate = '0 0'; var r = card.getBoundingClientRect(); card.style.translate = (px - offX - r.left) + 'px ' + (py - offY - r.top) + 'px'; };
      card.classList.add('lift'); document.body.classList.add('reordering');
      var last = 0;
      var move = function (ev) {
        place(ev.clientX, ev.clientY);
        var n2 = Date.now(); if (n2 - last < 120) return;
        var t = document.elementFromPoint(ev.clientX, ev.clientY), tc = t && t.closest('#home-view .grid > .card:not(.sched)');
        if (!tc || tc === card) return; last = n2;
        var list = movable(), i = list.indexOf(card), j = list.indexOf(tc);
        flip(function () { grid.insertBefore(card, j < i ? tc : tc.nextSibling); }, card); place(ev.clientX, ev.clientY);
      };
      var end = function () {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
        document.body.classList.remove('reordering');
        var tr = card.style.translate.split(' '); card.style.translate = ''; card.classList.remove('lift');
        if (!reduce && tr.length === 2) card.animate([{ translate: tr.join(' ') }, { translate: '0 0' }], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
        saveOrder();
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    });
  });
  resetB.addEventListener('click', function () { flip(function () { applyOrder(defaultOrder); }); store.del('order'); resetB.hidden = true; live.textContent = 'kartlar ilk düzenine döndü'; var f = $('.grid .grip'); if (f) f.focus(); });

  /* ---------- tur: el yazısı notlar ve oklar ---------- */
  var steps = [
    ['#home-view .objs .pdf', 'belgelerin burada durur.', 'son yüklediğin belge masanda. yenisini “Belgelerim”den ya da kısayollardan eklersin.'],
    ['#home-view .objs .deck', 'bilgi kartların bunlar.', 'Acadex belgeden kart destesi çıkarır. desteye dokun, kart çevrilir.'],
    ['#home-view .go-row .btn', 'tek tıkla tekrara başla.', 'kaldığın yerden devam edersin.'],
    ['#home-view [data-pull]', 'ışığı sen yak.', 'lambanın ipini çek ya da dokun; ışık açılır, kapanır.'],
    ['#home-view .band-r', 'serin ve haftalık hedefin.', 'çalıştığın her gün işaretlenir. haftada kaç gün çalışacağını sen seçersin.'],
    ['#home-view .grid > .card[aria-labelledby="t-week"]', 'haftanı buradan planla.', 'bir güne dokun, planlayıcıda o güne etkinlik eklersin.'],
    ['#home-view .stamps .st:not(.on) a', 'sıradaki adım burada.', 'belgenin hangi aşamada olduğunu damgalar gösterir; boş damgaya basarak devam edersin.'],
    ['#home-view .grid .grip', 'masayı kendine göre diz.', 'bu tutamaçtan tutup kartların yerini değiştirebilirsin.'],
    ['#btn-acadia-toggle', 'takılırsan Acadia’ya sor.', 'notların hakkında sorunu yaz, belgelerine bakarak yanıtlar.']
  ];
  var tour = null;
  var dq = function (s) { return document.querySelector(s); };
  var visible = function (el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  var endTour = function () { if (!tour) return; tour.layer.remove(); document.removeEventListener('keydown', tour.key, true); window.removeEventListener('resize', tour.place); document.body.classList.remove('touring'); store.set('toured', 1); var back = tour.from; tour = null; if (back && back.focus) back.focus(); };
  var showStep = function (i) {
    var list = steps.filter(function (s) { return visible(dq(s[0])); });
    if (i < 0 || i >= list.length) { endTour(); return; }
    tour.i = i; tour.list = list;
    var s = list[i], el = dq(s[0]);
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    tour.note.innerHTML = '<i class="t-tape" aria-hidden="true"></i><span class="t-n">' + (i + 1) + ' / ' + list.length + '</span><h3 id="tour-h">' + s[1] + '</h3><p>' + s[2] + '</p>' +
      '<div class="t-row"><button type="button" class="t-skip" data-t="end">turu bitir</button>' + (i ? '<button type="button" class="t-back" data-t="back">← geri</button>' : '') +
      '<button type="button" class="ax-btn ax-btn-blue t-next" data-t="next">' + (i === list.length - 1 ? 'masama dön' : 'devam →') + '</button></div>';
    tour.note.classList.remove('in'); void tour.note.offsetWidth; tour.note.classList.add('in');
    setTimeout(function () { if (tour && tour.i === i) { tour.place(); var nb = tour.note.querySelector('.t-next'); if (nb) nb.focus({ preventScroll: true }); } }, reduce ? 0 : 420);
    tour.place();
  };
  var startTour = function (from) {
    if (tour) return;
    var layer = document.createElement('div'); layer.className = 'tour-l';
    layer.innerHTML = '<div class="t-spot" aria-hidden="true"></div><svg class="t-arrow" aria-hidden="true"><path class="t-a1" pathLength="1"/><path class="t-a2" pathLength="1"/></svg><div class="t-note" role="dialog" aria-modal="true" aria-labelledby="tour-h" tabindex="-1"></div>';
    document.body.appendChild(layer); document.body.classList.add('touring');
    tour = { layer: layer, note: layer.querySelector('.t-note'), spot: layer.querySelector('.t-spot'), arrow: layer.querySelector('.t-arrow'), from: from, i: 0 };
    tour.place = function () {
      if (!tour) return; var el = dq(tour.list[tour.i][0]); if (!el) return;
      var r = el.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY, pad = 8, sp = tour.spot.style;
      sp.left = (r.left + sx - pad) + 'px'; sp.top = (r.top + sy - pad) + 'px'; sp.width = (r.width + pad * 2) + 'px'; sp.height = (r.height + pad * 2) + 'px';
      var n = tour.note, nw = n.offsetWidth, nh = n.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight, gap = 70;
      var below = vh - r.bottom > nh + gap || r.top < nh + gap;
      var nx = Math.max(12, Math.min(vw - nw - 12, r.left + r.width / 2 - nw / 2 + (r.width > 500 ? r.width / 4 : 50)));
      var ny = below ? r.bottom + gap : r.top - gap - nh;
      if (r.height > vh * 0.6) ny = Math.min(vh - nh - 20, Math.max(80, r.top + 40));
      n.style.left = (nx + sx) + 'px'; n.style.top = (ny + sy) + 'px';
      var ax = nx + Math.min(nw - 30, Math.max(30, nw * 0.3)), ay = below ? ny - 4 : ny + nh + 4;
      var tx = Math.max(r.left + 10, Math.min(r.right - 10, ax - 20)), ty = below ? r.bottom + 12 : r.top - 12;
      if (r.height > vh * 0.6) { ty = ay; tx = r.left + 20; ax = nx - 4; ay = ny + 30; }
      var minx = Math.min(ax, tx) - 30, miny = Math.min(ay, ty) - 30, w = Math.abs(ax - tx) + 60, hh = Math.abs(ay - ty) + 60;
      var A = tour.arrow; A.style.left = (minx + sx) + 'px'; A.style.top = (miny + sy) + 'px'; A.setAttribute('width', w); A.setAttribute('height', hh); A.setAttribute('viewBox', '0 0 ' + w + ' ' + hh);
      var x1 = ax - minx, y1 = ay - miny, x2 = tx - minx, y2 = ty - miny, bend = (x2 - x1) * 0.4 + 26;
      A.querySelector('.t-a1').setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + (x1 + bend) + ' ' + (y1 + (y2 - y1) * 0.2) + ' ' + (x2 - bend * 0.2) + ' ' + (y2 - (y2 - y1) * 0.5) + ' ' + x2 + ' ' + y2);
      var ang = Math.atan2(y2 - (y2 - (y2 - y1) * 0.5), x2 - (x2 - bend * 0.2)), L = 13;
      A.querySelector('.t-a2').setAttribute('d', 'M' + (x2 - L * Math.cos(ang - 0.5)) + ' ' + (y2 - L * Math.sin(ang - 0.5)) + ' L' + x2 + ' ' + y2 + ' L' + (x2 - L * Math.cos(ang + 0.5)) + ' ' + (y2 - L * Math.sin(ang + 0.5)));
      A.classList.remove('on'); void A.getBoundingClientRect(); A.classList.add('on');
    };
    tour.key = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endTour(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); showStep(tour.i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); showStep(tour.i - 1); }
      else if (e.key === 'Tab') { var f = Array.prototype.slice.call(tour.note.querySelectorAll('button')); if (!f.length) return; var k = f.indexOf(document.activeElement); if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); } else if (k < 0) { e.preventDefault(); f[0].focus(); } }
    };
    document.addEventListener('keydown', tour.key, true);
    window.addEventListener('resize', tour.place);
    var st2 = 0; window.addEventListener('scroll', function () { if (!tour) return; clearTimeout(st2); st2 = setTimeout(tour.place, 80); }, { passive: true });
    layer.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; var t = b.getAttribute('data-t'); if (t === 'end') endTour(); else if (t === 'back') showStep(tour.i - 1); else showStep(tour.i + 1); });
    showStep(0);
  };
  $('[data-tour]').addEventListener('click', function () { startTour(this); });


  /* sınav uyarı şeritleri (dashboard.js çizer): Türkçe ve kâğıt görünümü */
  var banners = document.getElementById('home-exam-banners-container');
  if (banners && 'MutationObserver' in window) new MutationObserver(function () {
    Array.prototype.forEach.call(banners.children, function (b) {
      if (b.dataset.ink) return; b.dataset.ink = '1'; b.className = 'ax-exam';
      var sp = b.querySelector('span'), bt = b.querySelector('button');
      if (sp) { var m = sp.textContent.match(/"(.*)" is (TODAY|TOMORROW)/); if (m) sp.innerHTML = '<b class="hand">' + (m[2] === 'TODAY' ? 'bugün sınavın var' : 'yarın sınavın var') + '</b> ' + esc(m[1]); }
      if (bt) bt.textContent = 'gördüm';
    });
  }).observe(banners, { childList: true });

  /* ================= gerçek veriyle doldur ================= */
  var DATA = null;
  var fetchAll = async function () {
    var u = me(); if (!u || typeof supabaseClient === 'undefined') return null;
    var sb = supabaseClient, mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var p = prof() || {};
    var q = await Promise.all([
      sb.from('documents').select('id, file_name, uploaded_at, status').eq('user_id', u.id).order('uploaded_at', { ascending: false }).limit(40),
      sb.from('study_cards').select('id, document_id, created_at, summary_style, key_terms, documents(file_name)').eq('user_id', u.id).order('created_at', { ascending: false }).limit(40),
      sb.from('exams').select('id, grade, completed_at, created_at, study_card_id').eq('user_id', u.id).order('created_at', { ascending: false }).limit(40),
      sb.from('study_events').select('id, title, event_date, event_type, is_done').eq('user_id', u.id).gte('event_date', ymd(mon)).lte('event_date', ymd(sun) + 'T23:59:59').order('event_date', { ascending: true }),
      sb.from('card_item_confidence').select('study_card_id, next_review_at, repetitions').eq('user_id', u.id),
      sb.from('announcements').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(2),
      p.department ? sb.from('study_cards').select('id', { count: 'exact', head: true }).eq('is_shared', true).eq('department', p.department) : Promise.resolve({ count: 0 })
    ].map(function (pr) { return Promise.resolve(pr).catch(function () { return { data: null }; }); }));
    return { docs: (q[0].data || []).filter(function (d) { return d.status !== 'failed'; }), allDocs: q[0].data || [], cards: q[1].data || [], exams: q[2].data || [], events: q[3].data || [], conf: q[4].data || [], ann: q[5].data || [], shared: q[6].count || 0 };
  };

  var renderDesk = function (D) {
    var doc = D.docs[0], card = D.cards[0];
    var objs = $('.objs'), empty = $('[data-desk-empty]'), goRow = $('.go-row');
    if (!doc && !card) { objs.hidden = true; empty.hidden = false; goRow.hidden = true; return; }
    objs.hidden = false; empty.hidden = true; goRow.hidden = false;
    var pdf = $('.objs .pdf');
    if (doc) {
      pdf.hidden = false;
      $('.pdf-k', pdf).textContent = extOf(doc.file_name); $('b', pdf).textContent = baseName(doc.file_name); $('.pdf-d', pdf).textContent = dm(doc.uploaded_at);
      pdf.setAttribute('aria-label', baseName(doc.file_name) + ' belgesini aç (' + extOf(doc.file_name) + ', ' + dm(doc.uploaded_at) + ')');
    } else pdf.hidden = true;
    var dk = $('.objs .deck'), hint = $('.objs .hint');
    if (card) {
      dk.hidden = false; hint.hidden = false;
      var nm = baseName(card.documents && card.documents.file_name);
      $('.f-front b', dk).textContent = nm;
      dk.setAttribute('aria-label', nm + ' bilgi kartı destesi, çevirmek için dokun');
      var t = (card.key_terms || [])[0], back = $('.f-back', dk);
      if (t && (t.term || t.definition)) back.innerHTML = '<span class="hand">' + esc(t.term || '') + '</span><span class="hand sm">' + esc(String(t.definition || '').slice(0, 90)) + (String(t.definition || '').length > 90 ? '…' : '') + '</span>';
      var due = D.conf.filter(function (c) { return c.study_card_id === card.id && c.next_review_at && new Date(c.next_review_at) <= now; }).length;
      $('[data-due-k]').textContent = due ? 'BUGÜN ' + due + ' TEKRAR' : 'BİLGİ KARTLARI';
      $('[data-review]').disabled = false;
    } else { dk.hidden = true; hint.hidden = true; }
    var rv = $('[data-review]');
    rv.innerHTML = (card ? 'Tekrara başla ' : 'Belgeyi özetle ') + rv.querySelector('svg').outerHTML;
    rv.dataset.mode = card ? 'review' : 'docs';
  };
  $('[data-review]').addEventListener('click', async function () {
    var b = this; if (b.dataset.mode !== 'review') { go('docs'); return; }
    var card = DATA && DATA.cards[0]; if (!card) return;
    b.disabled = true;
    try {
      if (typeof libraryCards !== 'undefined' && !libraryCards.some(function (c) { return c.id === card.id; })) {
        var r = await supabaseClient.from('study_cards').select('*, documents(file_name)').eq('id', card.id).single();
        if (r.data) libraryCards.push(r.data);
      }
      if (typeof openAdaptiveReview === 'function') await openAdaptiveReview(card.id, baseName(card.documents && card.documents.file_name));
    } finally { b.disabled = false; }
  });

  var renderWeek = function (D) {
    var week = $('[data-week]'), dn = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], count = 0;
    var monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    week.innerHTML = '';
    for (var w = 0; w < 7; w++) {
      var d = new Date(monday); d.setDate(monday.getDate() + w);
      var dk = ymd(d), evs = D.events.filter(function (e) { return String(e.event_date).slice(0, 10) === dk; });
      count += evs.length;
      var li = document.createElement('li'); if (dk === ymd(now)) { li.className = 'is-today'; li.setAttribute('aria-current', 'date'); }
      li.innerHTML = '<span class="wd"><span>' + dn[w] + '</span><b>' + d.getDate() + '</b></span>' +
        evs.map(function (e, n) { var ty = e.event_type === 'exam' ? 'sinav' : e.event_type === 'deadline' ? 'odev' : ''; return '<span class="plan ' + ty + '" style="--r:' + (((n * 37 + w * 11) % 7 - 3) * 0.6).toFixed(1) + 'deg' + (e.is_done ? ';text-decoration:line-through;opacity:.6' : '') + '">' + esc(e.title) + '</span>'; }).join('') +
        '<a class="addp" href="#planner" data-add="' + dk + '" aria-label="' + dn[w] + ' ' + d.getDate() + ' için planlayıcıda etkinlik ekle">+ ekle</a>';
      week.appendChild(li);
    }
    $('.hint-s').textContent = count ? 'bu hafta planlayıcında ' + count + ' etkinlik var.' : 'bu hafta henüz boş. bir güne dokun, not yapıştıralım.';
    $$('[data-add]', week).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); go('planner');
        setTimeout(function () { if (window.acxPlanOpen) window.acxPlanOpen({ date: a.dataset.add }); }, 350);
      });
    });
  };

  var renderPassport = function (D) {
    var doc = D.docs[0], pp = $('[data-passport]'), road = $('[data-road]');
    if (!doc) {
      pp.innerHTML = '<p class="hand" style="font-size:21px;color:var(--soft);margin:6px 0 10px">henüz belgen yok. ilk belgeni yüklediğinde yolculuğu buradan izlersin.</p>';
      road.hidden = true; return;
    }
    road.hidden = false;
    var card = D.cards.filter(function (c) { return c.document_id === doc.id; })[0];
    var exam = card ? D.exams.filter(function (e) { return e.study_card_id === card.id && e.completed_at; })[0] : null;
    var rev = card ? D.conf.some(function (c) { return c.study_card_id === card.id && Number(c.repetitions) > 0; }) : false;
    var nm = baseName(doc.file_name), dn = [1, card ? 1 : 0, exam ? 1 : 0].reduce(function (a, b) { return a + b; }, 0);
    var stamp = function (on, label, when, r, i, view, cta) {
      return '<li class="st' + (on ? ' on' : '') + '" style="--r:' + r + 'deg' + (on ? ';--i:' + i : '') + '">' + (on ? '<span>' + label + '</span><small>' + when + '</small>' : '<a href="#' + view + '" data-go="' + view + '"><span>' + label + '</span><small>' + cta + '</small></a>') + '</li>';
    };
    pp.innerHTML = '<a class="doc-th" href="#docs" data-go="docs" aria-label="' + esc(nm) + ' belgesini aç"><b>' + esc(nm) + '</b><span class="pdf-lines" aria-hidden="true"></span><small>' + extOf(doc.file_name) + ' · ' + dm(doc.uploaded_at) + '</small></a>' +
      '<ol class="stamps" data-reveal="" aria-label="' + esc(nm) + ' ilerlemesi: 3 adımdan ' + dn + "'" + (dn === 1 ? 'i' : dn === 2 ? 'si' : 'ü') + ' tamam">' +
      stamp(true, 'YÜKLENDİ', dd2(doc.uploaded_at), -7, 0) +
      stamp(!!card, 'KARTLAR', card ? dd2(card.created_at) : '', 6, 1, 'docs', 'özetle →') +
      stamp(!!exam, 'DENEME', exam ? dd2(exam.completed_at) : '', -2, 2, 'exams', 'buraya bas →') + '</ol>';
    reveal([$('.stamps', pp)]);
    var lis = $$('li', road), stops = [true, !!card, !!exam, rev], lab = [['yükledin'], ['kartlar', 'docs'], ['deneme', 'exams'], ['tekrar', 'cards']], nextI = stops.indexOf(false);
    lis.forEach(function (li, i) {
      li.className = stops[i] ? 'done' : (i === nextI ? 'next' : '');
      li.innerHTML = i === nextI ? '<a href="#' + lab[i][1] + '" data-go="' + lab[i][1] + '">' + lab[i][0] + ' <small>sıradaki durak</small></a>' : '<span>' + lab[i][0] + '</span>';
    });
    $('ol', road).setAttribute('aria-label', nm + ' yol haritası');
    var at = [0, 0.36, 0.68, 1], lastDone = nextI < 0 ? 3 : nextI - 1, ink = nextI < 0 ? 1 : at[lastDone] + (at[nextI] - at[lastDone]) / 2;
    $('.road-ink', road).style.strokeDasharray = ink.toFixed(3) + ' 1';
    var rp = $('.road-base', road), RL = rp.getTotalLength ? rp.getTotalLength() : 0;
    if (RL) lis.forEach(function (li) { var pt = rp.getPointAtLength(RL * +li.getAttribute('data-at')); li.style.left = (pt.x / 520 * 100).toFixed(2) + '%'; li.style.top = (pt.y / 110 * 100).toFixed(2) + '%'; });
  };

  var ICO = {
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5 H14 L18.5 8 V20.5 H7 Z"/><path d="M14 3.5 V8 H18.5"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7" width="13" height="10" rx="1.5"/><path d="M7 4.5 H19 C19.8 4.5 20.5 5.2 20.5 6 V14"/></svg>',
    exam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5 H16 L19 6.5 V20.5 H6 Z"/><path d="M9 11 L10.5 12.5 L13.5 9 M9 16 H15"/></svg>'
  };
  var STYLE = { standard: 'standart', bullet: 'maddeler', structured: 'yapılandırılmış', simplified: 'sade', exam: 'sınav odaklı' };
  var renderLog = function (D) {
    var ev = [];
    D.allDocs.forEach(function (d) { ev.push({ t: d.uploaded_at, ic: 'doc', h: '<b>' + esc(baseName(d.file_name)) + '</b> yüklendi <em>' + extOf(d.file_name) + '</em>' }); });
    D.cards.forEach(function (c) { ev.push({ t: c.created_at, ic: 'card', h: '<b>Kart destesi</b> oluşturdun <em>' + esc(baseName(c.documents && c.documents.file_name)) + ' · ' + (STYLE[c.summary_style] || 'standart') + ' stil</em>' }); });
    D.exams.forEach(function (e) { if (e.completed_at) ev.push({ t: e.completed_at, ic: 'exam', h: '<b>Deneme</b> çözdün <em>' + (e.grade != null ? 'notun ' + Math.round(e.grade) : 'tamamlandı') + '</em>' }); });
    ev = ev.filter(function (e) { return e.t; }).sort(function (a, b) { return new Date(b.t) - new Date(a.t); }).slice(0, 6);
    var box = $('[data-log]');
    if (!ev.length) { box.innerHTML = '<p class="tl-end hand" style="margin-top:4px">henüz bir şey yapmadın; ilk iz, ilk belgeyle düşer.</p>'; return; }
    var out = '', day = '';
    ev.forEach(function (e, i) {
      var d = dm(e.t);
      if (d !== day) {
        if (day) out += '</ol>';
        var label = ymd(new Date(e.t)) === ymd(now) ? 'bugün' : ymd(new Date(e.t)) === ymd(new Date(now.getTime() - 864e5)) ? 'dün' : d;
        out += '<span class="tl-day hand">' + label + (i === 0 ? '<svg class="drw" viewBox="0 0 90 40" preserveAspectRatio="none" aria-hidden="true"><path d="M70 6 C50 0 14 4 6 16 C0 28 30 37 56 34 C76 32 88 22 84 12"/></svg>' : '') + '</span><ol>';
        day = d;
      }
      out += '<li><i class="tl-dot" aria-hidden="true"></i>' + ICO[e.ic] + '<span>' + e.h + '</span><time datetime="' + esc(e.t) + '">' + hm(e.t) + '</time></li>';
    });
    out += '</ol>';
    var hasCard = D.cards.length, hasExam = D.exams.some(function (e) { return e.completed_at; });
    out += '<p class="tl-end hand">' + (!hasCard ? 'sıradaki durak: belgeni özetleyip kart destesi çıkarmak.' : !hasExam ? 'sıradaki durak ilk deneme, acele yok.' : 'güzel gidiyor; bugün biraz tekrar yeter.') + '</p>';
    box.innerHTML = out; prepDrw(box); reveal($$('.drw', box));
  };

  var renderShelf = function (D) {
    var docs = D.docs, cards = D.cards, ex = D.exams.filter(function (e) { return e.completed_at; });
    var shelf = $('[data-shelf]'), avg = $('[data-avg]');
    var g = ex.filter(function (e) { return e.grade != null; }), av = g.length ? Math.round(g.reduce(function (a, e) { return a + Number(e.grade || 0); }, 0) / g.length) : null;
    var sh = '<div class="sh">' + (docs.length ? '<a class="book" href="#docs" data-go="docs" aria-label="' + docs.length + ' belge: ' + esc(baseName(docs[0].file_name)) + '"><span>' + esc(baseName(docs[0].file_name)) + '</span></a>' : '<a class="slot" href="#docs" data-go="docs"><span class="hand">ilk belgen burada duracak</span></a>') +
      '<p>' + (docs.length ? '<span class="tally" data-t="' + docs.length + '" aria-hidden="true"></span>' : '') + '<span><b' + (docs.length ? '' : ' class="zero"') + '>' + docs.length + '</b> belge</span></p></div>' +
      '<div class="sh">' + (cards.length ? '<a class="cards" href="#cards" data-go="cards" aria-label="' + cards.length + ' kart destesi"><i></i><i></i><i><span>' + esc(shortName(cards[0].documents && cards[0].documents.file_name)) + '</span></i></a>' : '<a class="slot" href="#cards" data-go="cards"><span class="hand">ilk desten burada duracak</span></a>') +
      '<p>' + (cards.length ? '<span class="tally" data-t="' + cards.length + '" aria-hidden="true"></span>' : '') + '<span><b' + (cards.length ? '' : ' class="zero"') + '>' + cards.length + '</b> deste</span></p></div>' +
      '<div class="sh">' + (ex.length ? '<a class="book" href="#exams" data-go="exams" style="--bk:#1E8A55" aria-label="' + ex.length + ' deneme"><span>deneme' + (av != null ? ' · ' + av : '') + '</span></a>' : '<a class="slot" href="#exams" data-go="exams"><span class="hand">ilk denemen burada duracak</span></a>') +
      '<p>' + (ex.length ? '<span class="tally" data-t="' + ex.length + '" aria-hidden="true"></span>' : '') + '<span><b' + (ex.length ? '' : ' class="zero"') + '>' + ex.length + '</b> deneme</span></p></div>';
    var plank = $('.plank', shelf); $$('.sh', shelf).forEach(function (n) { n.remove(); });
    plank.insertAdjacentHTML('beforebegin', sh);
    $$('[data-t]', shelf).forEach(function (t) { tally(t, +t.getAttribute('data-t')); });
    avg.firstChild.nodeValue = av != null ? 'ortalama notun: ' + av + '. bir sonraki denemede bunu geçmeye çalış.' : 'ortalama notun ilk denemeden sonra rafa gelecek.';
  };

  var renderPano = function (D) {
    var a = D.ann[0], cork = $('[data-cork]');
    var n1 = a ? '<h3>duyurular</h3><p><b>' + esc(a.title) + '</b> ' + esc(String(a.body || '').slice(0, 110)) + (String(a.body || '').length > 110 ? '…' : '') + '</p><small class="hand">' + dm(a.created_at) + '</small>'
      : '<h3>duyurular</h3><p>şimdilik sessiz. bölümünden bir duyuru gelince ilk buraya iğnelenecek.</p>';
    var n2 = '<h3>bölüm akışı</h3><p>' + (D.shared ? 'koridor panosunda arkadaşlarının astığı <b>' + D.shared + ' özet</b> var.' : 'koridor panosu şimdilik boş; ilk özeti sen asabilirsin.') + '</p><a href="#feed" data-go="feed">panoya git →</a>';
    cork.innerHTML = '<div class="pin-note" style="--r:-2.5deg"><i class="pin" aria-hidden="true"></i>' + n1 + '</div><div class="pin-note" style="--r:2deg"><i class="pin" aria-hidden="true"></i>' + n2 + '</div>';
  };

  var hoursBuilt = false;
  var renderHours = function (D) {
    var hours = $('[data-hours]'), H0 = 8, H1 = 24, ROW = 40, h2 = now.getHours();
    if (!hoursBuilt) {
      hoursBuilt = true;
      for (var hh = H0; hh < H1; hh++) { var hl = document.createElement('li'); hl.textContent = ('0' + hh).slice(-2) + ':00'; if (hh < h2) hl.className = 'past'; hours.appendChild(hl); }
      var mins = h2 + now.getMinutes() / 60;
      if (mins >= H0 && mins < H1) {
        var ln = document.createElement('div'); ln.className = 'now-ln'; ln.style.top = ((mins - H0) * ROW).toFixed(1) + 'px';
        ln.innerHTML = '<i></i><svg class="drw" viewBox="0 0 200 14" preserveAspectRatio="none"><path pathLength="1" d="M2 7 C40 3 70 10 110 6 S170 4 198 8"/></svg><span>şimdi ' + ('0' + h2).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2) + '</span>';
        hours.appendChild(ln); reveal([ln.querySelector('svg')]);
        var hw = $('[data-hours-w]'); setTimeout(function () { hw.scrollTop = Math.max(0, (mins - H0) * ROW - 120); }, 60);
      }
    }
    var todayEv = D.events.filter(function (e) { return String(e.event_date).slice(0, 10) === ymd(now); });
    $$('.h-ev', hours).forEach(function (n) { n.remove(); });
    todayEv.forEach(function (e) {
      var t = String(e.event_date).match(/T(\d\d):(\d\d)/); if (!t) return;
      var hr = Math.max(H0, +t[1]), row = hours.children[hr - H0];
      if (row) row.insertAdjacentHTML('beforeend', '<span class="h-ev ' + (e.event_type === 'exam' ? 'sinav' : e.event_type === 'deadline' ? 'odev' : '') + '">' + esc(e.title) + '</span>');
    });
    var sn = $('.sched-n');
    sn.textContent = todayEv.length ? 'bugün ' + todayEv.length + ' plan var: ' + todayEv.map(function (e) { return e.title; }).join(', ') + '.' : 'bugün planın boş. istersen bir saat ayır, gerisi kendiliğinden gelir.';
  };

  var busy = false;
  var load = async function () {
    greet(); drawStreak();
    if (busy) return; busy = true;
    try {
      var D = await fetchAll(); if (!D) return;
      DATA = D;
      renderDesk(D); renderWeek(D); renderPassport(D); renderLog(D); renderShelf(D); renderPano(D); renderHours(D);
      requestAnimationFrame(edges);
      setTimeout(function () { var al = document.getElementById('home-achievements-list'); if (al && !al.children.length) al.innerHTML = '<p class="hand ach-empty" style="font-size:20px;color:#6A7593;margin:0">ilk rozetin, ilk belgeni özetlediğinde buraya iğnelenecek.</p>'; }, 2500);
    } catch (e) { console.warn('acadex-ink: Bugün çizilemedi', e); }
    finally { busy = false; }
  };
  if (typeof loadDashboardHome === 'function') {
    var origHome = loadDashboardHome;
    loadDashboardHome = async function () {
      var r = origHome.apply(this, arguments);
      load();
      return r;
    };
  }
  drawStreak();
})();

/* ================= ÇALIŞMA PLANLAYICI (tam tasarım, study_events tablosu) ================= */
(function () {
  'use strict';
  var root = document.getElementById('planner-view');
  if (!root || !root.classList.contains('axp')) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var me = function () { return lsafe(function () { return currentUser; }, null) || window.currentUser || null; };
  var SVGNS = 'http://www.w3.org/2000/svg', now = new Date();
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem('acadex.plan.' + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('acadex.plan.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  var MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
  var DAYS = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'];
  var TYPE = { sinav: 'sınav', calisma: 'çalışma', odev: 'ödev' };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var toD = function (k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var addD = function (k, n) { var d = toD(k); d.setDate(d.getDate() + n); return ymd(d); };
  var todayK = ymd(now);
  var diffDays = function (a, b) { return Math.round((toD(b) - toD(a)) / 86400000); };
  var fmt = function (k, withDay) { var d = toD(k); return d.getDate() + ' ' + MONTHS[d.getMonth()] + (withDay ? ', ' + DAYS[d.getDay()] : ''); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cap = function (t) { return t ? t.charAt(0).toLocaleUpperCase('tr') + t.slice(1) : t; };
  var uid = function () { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var tilt = function (id) { var x = 0; id = String(id); for (var i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0; return ((x % 7) - 3) * 0.5; };
  var mobile = function () { return window.matchMedia('(max-width: 700px)').matches; };
  var baseName = function (n) { n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, ''); var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1]; return n.replace(/_+/g, ' ').trim() || 'İsimsiz belge'; };

  $$('.land').forEach(function (el, i) { el.style.setProperty('--hr', (((i * 37) % 11 - 5) * 0.3).toFixed(2) + 'deg'); el.style.setProperty('--hx', (((i * 53) % 9 - 4) * 2) + 'px'); });

  /* ---------- veri: study_events  <->  tasarımdaki not ----------
     tür: exam=sınav, deadline=ödev, goal/other=çalışma.
     saat ve belge için tabloda sütun yok; notların başına [14:00] ve [belge: …] olarak yazılır. */
  var T_IN = { exam: 'sinav', deadline: 'odev', goal: 'calisma', other: 'calisma' };
  var T_OUT = { sinav: 'exam', odev: 'deadline', calisma: 'goal' };
  var parseNotes = function (n) {
    var o = { time: '', doc: '', notes: '' }; n = String(n || '');
    var m = n.match(/^\[(\d{2}:\d{2})\]\s*/); if (m) { o.time = m[1]; n = n.slice(m[0].length); }
    m = n.match(/^\[belge: ([^\]]+)\]\s*/); if (m) { o.doc = m[1]; n = n.slice(m[0].length); }
    o.notes = n.trim(); return o;
  };
  var packNotes = function (e) { var s = (e.time ? '[' + e.time + '] ' : '') + (e.doc ? '[belge: ' + e.doc + '] ' : '') + (e.notes || ''); s = s.trim(); return s || null; };
  var fromRow = function (r) {
    var p = parseNotes(r.notes);
    return { id: r.id, title: r.title || '', date: String(r.event_date || '').slice(0, 10), type: T_IN[r.event_type] || 'calisma', rawType: r.event_type, time: p.time, doc: p.doc, notes: p.notes, done: !!r.is_done };
  };
  var toRow = function (e) {
    var t = T_OUT[e.type] || 'goal';
    if (e.type === 'calisma' && e.rawType === 'other') t = 'other';
    return { title: e.title, event_date: e.date, event_type: t, notes: packNotes(e), is_done: !!e.done };
  };
  var events = [], loaded = false;
  var real = function () { return events.filter(function (e) { return !e.draft; }); };
  var syncLegacy = function () { try { plannerEvents = real().map(function (e) { return { id: e.id, title: e.title, event_date: e.date, event_type: T_OUT[e.type], notes: e.notes, is_done: e.done }; }); } catch (er) {} };
  var byId = function (id) { for (var i = 0; i < events.length; i++) if (String(events[i].id) === String(id)) return events[i]; return null; };
  var sortEv = function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.type === 'sinav') !== (b.type === 'sinav') ? (a.type === 'sinav' ? -1 : 1) : (a.time || '') < (b.time || '') ? -1 : 1; };
  var sb = function () { return typeof supabaseClient !== 'undefined' ? supabaseClient : null; };
  var fail = function (msg, err) { console.error('acadex-ink planlayıcı:', err); say(msg); };
  var dbInsert = async function (e) {
    var r = await sb().from('study_events').insert(Object.assign({ user_id: me().id }, toRow(e))).select('*').single();
    if (r.error) throw r.error; return r.data;
  };
  var dbUpdate = async function (e) { var r = await sb().from('study_events').update(toRow(e)).eq('id', e.id); if (r.error) throw r.error; };
  var dbDelete = async function (id) { var r = await sb().from('study_events').delete().eq('id', id); if (r.error) throw r.error; };

  /* ---------- geri alınabilir bildirim ---------- */
  var toast = $('[data-toast]'), toastT = $('[data-toast-t]'), toastB = $('[data-toast-b]'), toastTimer = 0, undoFn = null;
  var say = function (t, undo) { toastT.textContent = t; undoFn = undo || null; toastB.hidden = !undo; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; undoFn = null; }, 5200); };
  toastB.addEventListener('click', function () { if (undoFn) undoFn(); toast.hidden = true; undoFn = null; });

  /* ---------- el çizimi kenarlar ---------- */
  var rng = function (seed) { var x = 0; for (var i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
  var drawEdge = function (card) {
    var w = card.offsetWidth, ht = card.offsetHeight; if (!w) return;
    var r = rng(card.id || 'c'), svg = card.querySelector(':scope > .edge');
    if (!svg) { svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'edge'); svg.setAttribute('aria-hidden', 'true'); card.insertBefore(svg, card.firstChild); }
    svg.setAttribute('viewBox', '-1 -1 ' + (w + 2) + ' ' + (ht + 2));
    var j = function (a) { return (r() - 0.5) * 2 * a; };
    var line = function (x1, y1, x2, y2, hz) {
      var len = hz ? Math.abs(x2 - x1) : Math.abs(y2 - y1), n = Math.max(2, Math.round(len / 90)), d = 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1);
      for (var k = 1; k <= n; k++) { var t = k / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, cx = x1 + (x2 - x1) * (t - 0.5 / n), cy = y1 + (y2 - y1) * (t - 0.5 / n); d += ' Q' + (hz ? cx : cx + j(1.1)).toFixed(1) + ' ' + (hz ? cy + j(1.1) : cy).toFixed(1) + ' ' + (hz ? x : x + j(0.4)).toFixed(1) + ' ' + (hz ? y + j(0.4) : y).toFixed(1); }
      return d;
    };
    var o = function () { return 2 + r() * 4; };
    svg.innerHTML = '<path d="' + line(6 - o(), 0.5, w - 6 + o(), 0.5 + j(0.8), true) + '"/><path d="' + line(w - 0.5, 6 - o(), w - 0.5 + j(0.8), ht - 6 + o(), false) + '"/><path d="' + line(w - 6 + o(), ht - 0.5, 6 - o(), ht - 0.5 + j(0.8), true) + '"/><path d="' + line(0.5, ht - 6 + o(), 0.5 + j(0.8), 6 - o(), false) + '"/>';
  };
  var edged = $$('.wall, .agenda');
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(function (es) { es.forEach(function (e) { drawEdge(e.target); }); }); edged.forEach(function (c) { ro.observe(c); }); }

  /* ---------- ay takvimi ---------- */
  var daysEl = $('[data-days]'), monthT = $('[data-month-t]');
  var view = { y: now.getFullYear(), m: now.getMonth() };
  var ringSvg = '<svg class="ring-ex" viewBox="0 0 42 36" aria-hidden="true"><path d="M30 5 C20 0 4 4 4 17 C4 30 22 34 32 29 C42 24 40 8 26 5"/></svg>';
  var chip = function (e) {
    if (e.draft) return '<div class="ev draft" data-id="' + e.id + '"><span>↻ ' + esc(e.title) + '</span><button type="button" data-acc="" aria-label="Öneriyi ekle: ' + esc(e.title) + '">✓</button><button type="button" data-rej="" aria-label="Öneriyi kaldır">✕</button></div>';
    return '<button type="button" class="ev pi ' + e.type + (e.done ? ' done' : '') + '" data-id="' + e.id + '" style="--r:' + tilt(e.id) + 'deg;--i:' + (e._i || 0) + '" aria-label="' + TYPE[e.type] + ': ' + esc(e.title) + (e.time ? ', ' + e.time : '') + (e.done ? ', tamamlandı' : '') + '. Düzenlemek için aç"><span class="pi-t">' + esc(e.title) + '</span>' + (e.time ? '<b class="pi-h">' + e.time + '</b>' : '') + '</button>';
  };
  var stack = function (list) {
    var notes = list.filter(function (e) { return !e.draft; }), drafts = list.filter(function (e) { return e.draft; }), shown = notes.slice(0, 3), out = '';
    if (shown.length) {
      out += '<div class="stack" style="--n:' + shown.length + '">' + shown.map(function (e, i) { e._i = i; var h = chip(e); delete e._i; return h; }).join('') + '</div>';
      if (notes.length > 3) out += '<button type="button" class="more-ev" data-more="' + list[0].date + '">+' + (notes.length - 3) + ' not daha</button>';
    }
    return out + drafts.map(chip).join('');
  };
  var flipPage = function (dir) {
    if (reduce || !dir || !daysEl.children.length) return;
    var old = daysEl.cloneNode(true); old.removeAttribute('data-days'); old.className = 'days page-old ' + (dir > 0 ? 'up' : 'down'); old.setAttribute('aria-hidden', 'true');
    old.style.top = daysEl.offsetTop + 'px'; old.style.left = daysEl.offsetLeft + 'px'; old.style.width = daysEl.offsetWidth + 'px';
    $$('button', old).forEach(function (b) { b.tabIndex = -1; });
    daysEl.parentNode.appendChild(old); setTimeout(function () { old.remove(); }, 900);
  };
  var renderCal = function (dir) {
    flipPage(dir);
    monthT.textContent = MONTHS[view.m] + ' ' + view.y;
    var first = new Date(view.y, view.m, 1), off = (first.getDay() + 6) % 7, start = new Date(view.y, view.m, 1 - off), html = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i);
      if (i === 35 && d.getMonth() !== view.m) break;
      var k = ymd(d), list = events.filter(function (e) { return e.date === k; }).sort(sortEv);
      var exam = list.some(function (e) { return e.type === 'sinav' && !e.draft && !e.done; });
      var cls = 'day' + (d.getMonth() !== view.m ? ' out' : '') + (k === todayK ? ' is-today' : '') + (d.getDay() % 6 === 0 ? ' wkend' : '') + (exam ? ' exam' : '');
      var lab = d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + DAYS[d.getDay()] + (list.length ? ', ' + list.length + ' etkinlik' : '') + '. Etkinlik ekle';
      html += '<div class="' + cls + '" data-d="' + k + '"><button type="button" class="day-add" aria-label="' + lab + '"></button><span class="dn">' + d.getDate() + '</span>' + (exam ? ringSvg : '') + '<span class="plus" aria-hidden="true">+</span>' +
        stack(list) + '<span class="dots" aria-hidden="true">' + list.map(function (e) { return '<i class="' + (e.draft ? 'draft' : e.type) + '"></i>'; }).join('') + '</span></div>';
    }
    daysEl.innerHTML = html;
    daysEl.classList.remove('fwd', 'back');
    if (dir && !reduce) { void daysEl.offsetWidth; daysEl.classList.add(dir > 0 ? 'fwd' : 'back'); }
  };
  $$('[data-month]').forEach(function (b) { b.addEventListener('click', function () { var s = +b.getAttribute('data-month'); view.m += s; if (view.m < 0) { view.m = 11; view.y--; } if (view.m > 11) { view.m = 0; view.y++; } renderCal(s); }); });
  var goMonth = function (k) { var d = toD(k), s = (d.getFullYear() - view.y) * 12 + d.getMonth() - view.m; if (s) { view = { y: d.getFullYear(), m: d.getMonth() }; return s; } return 0; };
  $('[data-today]').addEventListener('click', function () { var s = goMonth(todayK); renderCal(s ? (s > 0 ? 1 : -1) : 0); });

  /* ---------- ajanda listesi ---------- */
  var agenda = $('[data-agenda]'), showPast = false;
  var emptySvg = '<svg viewBox="0 0 120 90" aria-hidden="true"><path d="M22 18 H86 C89 18 90 20 90 22 V78 H26 C23 78 22 76 22 74 Z"/><path d="M22 32 H90"/><path d="M36 12 V24 M76 12 V24"/><path d="M34 44 H44 M52 44 H62 M70 44 H80 M34 56 H44 M52 56 H62"/><path d="M84 70 L106 40 L112 45 L90 75 L82 77 Z"/></svg>';
  var item = function (e) {
    return '<li class="ag-it' + (e.done ? ' done' : '') + '"><time>' + (e.time || '—') + '</time><span class="stamp ' + (e.draft ? 'taslak' : e.type) + '">' + (e.draft ? 'ÖNERİ' : TYPE[e.type].toLocaleUpperCase('tr')) + '</span>' +
      '<span class="ag-t"><b>' + esc(e.title) + '</b><small>' + [e.doc ? esc(e.doc) : '', e.draft ? 'tekrar önerisi · onaylarsan eklenir' : '', e.done ? 'tamamlandı' : ''].filter(Boolean).join(' · ') + '</small>' + (e.notes ? '<small class="nt">' + esc(e.notes) + '</small>' : '') + '</span><span class="ag-a" data-id="' + e.id + '">' +
      (e.draft ? '<button type="button" data-acc="">ekle</button><button type="button" data-rej="">kaldır</button>'
        : '<input type="checkbox" class="ag-chk" data-done=""' + (e.done ? ' checked' : '') + ' aria-label="' + esc(e.title) + ' tamamlandı"><button type="button" data-edit="">düzenle</button><button type="button" data-del="">sil</button>') + '</span></li>';
  };
  var group = function (list) {
    var out = '', cur = null, buf = [];
    var flush = function () { if (!cur) return; var d = toD(cur); out += '<div class="ag-day' + (cur === todayK ? ' is-today' : '') + '" id="ag-' + cur + '"><div class="ag-d"><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()].slice(0, 3) + ' · ' + (cur === todayK ? 'bugün' : ['paz', 'pzt', 'sal', 'çar', 'per', 'cum', 'cmt'][d.getDay()]) + '</span></div><ul class="ag-items">' + buf.join('') + '</ul></div>'; };
    list.forEach(function (e) { if (e.date !== cur) { flush(); cur = e.date; buf = []; } buf.push(item(e)); });
    flush(); return out;
  };
  var renderList = function () {
    if (!loaded) { agenda.innerHTML = '<p class="p-load">takvimin açılıyor…</p>'; return; }
    var up = events.filter(function (e) { return e.date >= todayK; }).sort(sortEv), past = events.filter(function (e) { return e.date < todayK && !e.draft; }).sort(sortEv).reverse();
    var html = up.length ? group(up) : '<div class="ag-empty">' + emptySvg + '<p>yaklaşan etkinlik yok. ilk sınav tarihini ya da çalışma hedefini ekle.</p><button type="button" class="btn btn-blue" data-new="">+ Etkinlik ekle</button></div>';
    if (past.length) html += '<button type="button" class="ag-past" data-past="" aria-expanded="' + showPast + '">' + (showPast ? 'geçmişi gizle' : 'geçmiş etkinlikler (' + past.length + ')') + '</button>' + (showPast ? '<div class="ag-past-list">' + group(past) + '</div>' : '');
    agenda.innerHTML = html;
  };

  /* ---------- en yakın sınava geri sayım ---------- */
  var countEl = $('[data-count]'), firstCount = true;
  var renderCount = function () {
    var ex = events.filter(function (e) { return e.type === 'sinav' && !e.draft && !e.done && e.date >= todayK; }).sort(sortEv)[0];
    if (!ex) { countEl.innerHTML = '<div class="tear"><i class="tear-bind"></i><div class="tear-pg empty"><span class="n">—</span><span class="u">yaklaşan sınav yok</span><button type="button" data-new-exam="">sınav tarihi ekle</button></div></div>'; return; }
    var n = diffDays(todayK, ex.date), when = fmt(ex.date, true) + (ex.time ? ' · ' + ex.time : '');
    var pg = function (num) { return '<div class="tear-pg"><span class="n">' + (num === 0 ? '!' : num) + '</span><span class="u">' + (num === 0 ? 'sınav bugün' : num === 1 ? 'gün kaldı · yarın' : 'gün kaldı') + '</span><b>' + esc(ex.title) + '</b><small>' + when + '</small></div>'; };
    countEl.innerHTML = '<div class="tear" aria-label="En yakın sınav: ' + esc(ex.title) + ', ' + (n === 0 ? 'bugün' : n + ' gün kaldı') + '"><i class="tear-bind"></i>' + (firstCount && n >= 0 ? '<div class="tear-off" aria-hidden="true">' + pg(n + 1) + '</div>' : '') + pg(n) + '</div>';
    firstCount = false;
  };

  /* ---------- 7-3-1 tekrar önerileri (kural, yapay zeka değil) ---------- */
  var OFFS = [7, 3, 1], sugEl = $('[data-suggest]');
  var rejected = store.get('rejected') || [], dismissed = store.get('dismissed') || [];
  var slotsFor = function (ex) {
    return OFFS.map(function (o) { return { off: o, date: addD(ex.date, -o), from: ex.id + ':' + o }; }).filter(function (s) {
      return s.date >= todayK && rejected.indexOf(s.from) < 0 && !events.some(function (e) { return e.from === s.from || (!e.draft && e.date === s.date && e.title === 'Tekrar: ' + (ex.doc || ex.title)); });
    });
  };
  var renderSuggest = function () {
    var drafts = events.filter(function (e) { return e.draft; });
    if (drafts.length) {
      sugEl.hidden = false;
      sugEl.innerHTML = '<p><span class="hand">' + drafts.length + ' tekrar önerisi takvimde soluk duruyor.</span> Tek tek ✓ ile ekleyebilir ya da hepsini birden alabilirsin.<small>kural: sınavdan 7, 3 ve 1 gün önce tekrar · yapay zeka değil</small></p><button type="button" class="btn btn-blue" data-s-all="">Hepsini ekle</button><button type="button" class="s-no" data-s-drop="">önerileri kaldır</button>';
      return;
    }
    var ex = events.filter(function (e) { return e.type === 'sinav' && !e.draft && !e.done && dismissed.indexOf(String(e.id)) < 0 && slotsFor(e).length; }).sort(sortEv)[0];
    if (!ex) { sugEl.hidden = true; sugEl.innerHTML = ''; return; }
    var n = diffDays(todayK, ex.date), s = slotsFor(ex);
    sugEl.hidden = false; sugEl.setAttribute('data-ex', ex.id);
    sugEl.innerHTML = '<p><span class="hand">' + esc(ex.title) + ' için ' + (n === 0 ? 'bugün' : n + ' gün') + ' var.</span> İstersen ' + s.map(function (x) { return x.off; }).join(', ') + ' gün kala birer tekrar günü önereyim.<small>kural: 7-3-1 gün aralıklı tekrar · yapay zeka değil · sen onaylamadan eklenmez</small></p>' +
      '<button type="button" class="btn btn-blue" data-s-go="">Tekrar planı öner</button><button type="button" class="s-no" data-s-no="">hayır, teşekkürler</button>';
  };
  var acceptDraft = async function (e) {
    var row = await dbInsert({ title: e.title, date: e.date, type: 'calisma', time: '', doc: e.doc, notes: '' });
    var x = fromRow(row); x.from = e.from;
    events = events.filter(function (y) { return y !== e; }); events.push(x); return x;
  };
  sugEl.addEventListener('click', async function (e) {
    if (e.target.closest('[data-s-go]')) {
      var ex = byId(sugEl.getAttribute('data-ex')); if (!ex) return;
      slotsFor(ex).forEach(function (s) { events.push({ id: uid(), draft: true, type: 'calisma', title: 'Tekrar: ' + (ex.doc || ex.title), date: s.date, time: '', doc: ex.doc || '', from: s.from }); });
      var m = goMonth(slotsFor(ex)[0] ? slotsFor(ex)[0].date : ex.date); renderAll(m);
    } else if (e.target.closest('[data-s-no]')) {
      dismissed.push(String(sugEl.getAttribute('data-ex'))); store.set('dismissed', dismissed); renderAll();
    } else if (e.target.closest('[data-s-all]')) {
      var ds = events.filter(function (x) { return x.draft; }), c = 0;
      try { for (var i = 0; i < ds.length; i++) { await acceptDraft(ds[i]); c++; } } catch (er) { fail('Bazı öneriler kaydedilemedi; bağlantını kontrol et.', er); }
      syncLegacy(); renderAll(); if (c) say(c + ' tekrar günü eklendi.');
    } else if (e.target.closest('[data-s-drop]')) {
      events.forEach(function (x) { if (x.draft) rejected.push(x.from); }); store.set('rejected', rejected);
      events = events.filter(function (x) { return !x.draft; }); renderAll();
    }
  });
  var accept = async function (id) {
    var e = byId(id); if (!e) return;
    try { var x = await acceptDraft(e); syncLegacy(); renderAll(); slap(x.id); say('Eklendi: ' + x.title + ' · ' + fmt(x.date)); } catch (er) { fail('Öneri kaydedilemedi; tekrar dene.', er); }
  };
  var reject = function (id) { var e = byId(id); if (!e) return; rejected.push(e.from); store.set('rejected', rejected); events = events.filter(function (x) { return x.id !== id; }); renderAll(); };

  var renderAll = function (dir) { renderCal(dir); renderList(); renderCount(); renderSuggest(); };

  /* ---------- yapışkan not formu ---------- */
  var dlg = $('[data-form]'), ff = $('[data-form-f]'), F = ff.elements, editing = null, lastFocus = null, fErr = $('[data-f-err]');
  var fillDocs = async function (sel) {
    var s = F.doc;
    if (!s.dataset.loaded && me() && sb()) {
      s.dataset.loaded = '1';
      try {
        var r = await sb().from('documents').select('file_name, uploaded_at').eq('user_id', me().id).order('uploaded_at', { ascending: false }).limit(40);
        var seen = {};
        (r.data || []).forEach(function (d) { var n = baseName(d.file_name); if (seen[n]) return; seen[n] = 1; var o = document.createElement('option'); o.value = n; o.textContent = n; s.appendChild(o); });
      } catch (er) {}
    }
    if (sel && !$$('option', s).some(function (o) { return o.value === sel; })) { var o2 = document.createElement('option'); o2.value = sel; o2.textContent = sel; s.appendChild(o2); }
    s.value = sel || '';
  };
  var openForm = function (ev, note) {
    lastFocus = document.activeElement; editing = ev && ev.id && byId(ev.id) ? ev.id : null; ev = ev || {};
    $('[data-form-t]').textContent = editing ? 'etkinliği düzenle' : 'yeni etkinlik';
    F.title.value = ev.title || ''; F.date.value = ev.date || todayK; F.time.value = ev.time || ''; F.notes.value = ev.notes || ''; F.done.checked = !!ev.done;
    fillDocs(ev.doc || '');
    $$('input[name="type"]', ff).forEach(function (r) { r.checked = r.value === (ev.type || 'calisma'); });
    $('[data-f-del]').hidden = !editing;
    fErr.hidden = !note; fErr.textContent = note || '';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(function () { (ev.title ? F.date : F.title).focus(); }, 30);
  };
  window.acxPlanOpen = function (ev) { openForm(ev || null); };
  var closeForm = function () { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', function () { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeForm(); });
  $('[data-f-cancel]').addEventListener('click', closeForm);
  ff.addEventListener('submit', async function (e) {
    e.preventDefault();
    var t = F.title.value.trim(), d = F.date.value, type = ($('input[name="type"]:checked', ff) || {}).value || 'calisma';
    if (!t) { fErr.hidden = false; fErr.textContent = 'bir başlık yaz, sonra yapıştıralım.'; F.title.focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { fErr.hidden = false; fErr.textContent = 'tarihi seç.'; F.date.focus(); return; }
    var sub = $('button[type="submit"]', ff); sub.disabled = true;
    var data = { title: t, date: d, time: F.time.value || '', type: type, doc: F.doc.value || '', notes: F.notes.value.trim(), done: F.done.checked }, id, wasEdit = editing;
    try {
      if (editing) { var x = byId(editing), prev = Object.assign({}, x); Object.assign(x, data); try { await dbUpdate(x); } catch (er) { Object.assign(x, prev); throw er; } id = editing; }
      else { var row = await dbInsert(data); var ne = fromRow(row); events.push(ne); id = ne.id; }
    } catch (er) { sub.disabled = false; fErr.hidden = false; fErr.textContent = 'kaydedemedim; bağlantını kontrol edip tekrar dene.'; console.error(er); return; }
    sub.disabled = false;
    var fr = ff.getBoundingClientRect(), mv = goMonth(d);
    syncLegacy(); closeForm(); renderAll(mv);
    flyTo(id, fr, mv ? 480 : 0);
    say((wasEdit ? 'Güncellendi: ' : 'Yapıştırıldı: ') + t + ' · ' + fmt(d, true) + (data.time ? ' ' + data.time : ''));
  });
  var noteEl = function (id) { var c = daysEl.querySelector('.pi[data-id="' + id + '"]'); return c && c.offsetParent && !$('#v-cal').hidden ? c : null; };
  var slap = function (id) { var c = noteEl(id); if (!c) return; c.classList.remove('just'); void c.offsetWidth; c.classList.add('just'); };
  var flyTo = function (id, fromRect, delay) {
    var c = noteEl(id);
    if (!c || reduce || !fromRect) { slap(id); return; }
    setTimeout(function () {
      var t = c.getBoundingClientRect(); if (!t.width) { slap(id); return; }
      var f = c.cloneNode(true); f.className = c.className.replace(' just', '') + ' flyer'; f.removeAttribute('data-id');
      f.style.left = t.left + 'px'; f.style.top = t.top + 'px'; f.style.width = t.width + 'px'; f.style.height = t.height + 'px';
      root.appendChild(f); c.style.visibility = 'hidden';
      var sx = Math.min(2.6, fromRect.width / t.width), sy = Math.min(2.6, fromRect.height / t.height);
      var dx = fromRect.left + fromRect.width / 2 - (t.left + t.width / 2), dy = fromRect.top + fromRect.height / 2 - (t.top + t.height / 2);
      var a = f.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ') rotate(-4deg)', opacity: 0.4, offset: 0 },
        { transform: 'translate(' + dx * 0.45 + 'px,' + (dy * 0.45 - 60) + 'px) scale(1.25) rotate(-10deg)', opacity: 1, offset: 0.45 },
        { transform: 'translate(0,-6px) scale(1.12) rotate(-6deg)', opacity: 1, offset: 0.85 },
        { transform: 'none', opacity: 1, offset: 1 }
      ], { duration: 720, easing: 'cubic-bezier(.45,0,.3,1)' });
      a.onfinish = function () { f.remove(); c.style.visibility = ''; slap(id); };
    }, delay || 0);
  };
  var peel = function (id) {
    var c = noteEl(id); if (!c || reduce) return null;
    var t = c.getBoundingClientRect(), f = c.cloneNode(true); f.className = c.className.replace(' just', '') + ' flyer peeling'; f.removeAttribute('data-id');
    f.style.left = t.left + 'px'; f.style.top = t.top + 'px'; f.style.width = t.width + 'px'; f.style.height = t.height + 'px';
    root.appendChild(f);
    var mark = document.createElement('i'); mark.className = 'glue'; var cell = c.closest('.day'), cr = cell.getBoundingClientRect();
    mark.style.left = (t.left - cr.left) + 'px'; mark.style.top = (t.top - cr.top) + 'px'; mark.style.width = t.width + 'px';
    var r0 = getComputedStyle(c).getPropertyValue('--r') || '0deg';
    f.animate([
      { transform: 'rotate(' + r0 + ')', offset: 0, easing: 'ease-out' },
      { transform: 'rotate(' + r0 + ') skewY(-4deg) scaleY(.95)', offset: 0.2, easing: 'ease-in-out' },
      { transform: 'translate(8px,10px) rotate(16deg)', offset: 0.38, easing: 'cubic-bezier(.55,0,.9,.5)' },
      { transform: 'translate(-40px,240px) rotate(-40deg)', opacity: 0, offset: 1 }
    ], { duration: 1000, easing: 'linear' }).onfinish = function () { f.remove(); };
    return { cell: cell.getAttribute('data-d'), mark: mark };
  };
  var removeEv = async function (id) {
    var gone = byId(id); if (!gone) return;
    try { await dbDelete(gone.id); } catch (er) { fail('Silemedim; bağlantını kontrol et.', er); return; }
    var p = peel(gone.id);
    events = events.filter(function (x) { return x !== gone; }); syncLegacy(); renderAll();
    if (p) { var cell = daysEl.querySelector('[data-d="' + p.cell + '"]'); if (cell) { cell.appendChild(p.mark); setTimeout(function () { p.mark.remove(); }, 1600); } }
    say('Koparıldı: ' + gone.title, async function () {
      try { var row = await dbInsert(gone); var back = fromRow(row); events.push(back); syncLegacy(); renderAll(); slap(back.id); } catch (er) { fail('Geri alamadım.', er); }
    });
  };
  $('[data-f-del]').addEventListener('click', function () { var id = editing; closeForm(); removeEv(id); });
  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-new]')) openForm(null);
    else if (e.target.closest('[data-new-exam]')) openForm({ type: 'sinav' });
  });

  /* ---------- takvim ve liste tıklamaları ---------- */
  var justDragged = false;
  daysEl.addEventListener('click', function (e) {
    if (justDragged) { justDragged = false; return; }
    var acc = e.target.closest('[data-acc]'), rej = e.target.closest('[data-rej]');
    if (acc) { accept(acc.closest('[data-id]').getAttribute('data-id')); return; }
    if (rej) { reject(rej.closest('[data-id]').getAttribute('data-id')); return; }
    var more = e.target.closest('[data-more]'); if (more) { setView('list'); var gm = document.getElementById('ag-' + more.getAttribute('data-more')); if (gm) gm.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); return; }
    var ev = e.target.closest('.ev:not(.draft)'); if (ev) { openForm(byId(ev.getAttribute('data-id'))); return; }
    var add = e.target.closest('.day-add'); if (!add) return;
    var k = add.parentNode.getAttribute('data-d');
    if (mobile() && events.some(function (x) { return x.date === k; })) { setView('list'); var g = document.getElementById('ag-' + k); if (g) g.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); return; }
    openForm({ date: k });
  });
  agenda.addEventListener('change', async function (e) {
    var c = e.target.closest('[data-done]'); if (!c) return;
    var x = byId(c.closest('[data-id]').getAttribute('data-id')); if (!x) return;
    x.done = c.checked;
    try { await dbUpdate(x); syncLegacy(); renderAll(); say(x.done ? 'Tamamlandı: ' + x.title + ' ✓' : 'Yeniden açıldı: ' + x.title); }
    catch (er) { x.done = !c.checked; c.checked = x.done; fail('Durumu kaydedemedim.', er); }
  });
  agenda.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-past')) { showPast = !showPast; renderList(); var p = $('[data-past]', agenda); if (p) p.focus(); return; }
    var host = b.closest('[data-id]'); if (!host) return; var id = host.getAttribute('data-id');
    if (b.hasAttribute('data-edit')) openForm(byId(id)); else if (b.hasAttribute('data-del')) removeEv(id);
    else if (b.hasAttribute('data-acc')) accept(id); else if (b.hasAttribute('data-rej')) reject(id);
  });

  /* ---------- notu başka güne sürükle ---------- */
  daysEl.addEventListener('pointerdown', function (e) {
    var ev = e.target.closest('.ev:not(.draft)'); if (!ev || e.pointerType === 'touch' || e.button !== 0) return;
    var sx = e.clientX, sy = e.clientY, ghost = null, over = null, id = ev.getAttribute('data-id');
    var move = function (m) {
      if (!ghost) {
        if (Math.abs(m.clientX - sx) + Math.abs(m.clientY - sy) < 6) return;
        ghost = ev.cloneNode(true); ghost.classList.add('ghost'); ghost.style.width = ev.offsetWidth + 'px'; ghost.style.height = ev.offsetHeight + 'px'; ghost.removeAttribute('data-id'); root.appendChild(ghost); ev.classList.add('dragging'); document.body.classList.add('reordering');
      }
      ghost.style.left = (m.clientX - 30) + 'px'; ghost.style.top = (m.clientY - 14) + 'px';
      var t = document.elementFromPoint(m.clientX, m.clientY), d = t && t.closest('#planner-view .day');
      if (d !== over) { if (over) over.classList.remove('drop-on'); over = d; if (over) over.classList.add('drop-on'); }
    };
    var up = async function () {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      document.body.classList.remove('reordering');
      if (!ghost) return;
      justDragged = true; setTimeout(function () { justDragged = false; }, 50);
      ghost.remove(); ev.classList.remove('dragging'); if (over) over.classList.remove('drop-on');
      var x = byId(id), to = over && over.getAttribute('data-d');
      if (x && to && to !== x.date) {
        var from = x.date; x.date = to; renderAll(); slap(id);
        try { await dbUpdate(x); syncLegacy(); } catch (er) { x.date = from; renderAll(); fail('Taşıyamadım; bağlantını kontrol et.', er); return; }
        say('Taşındı: ' + x.title + ' → ' + fmt(to, true), async function () { x.date = from; renderAll(); try { await dbUpdate(x); syncLegacy(); } catch (er) { fail('Geri alamadım.', er); } });
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });

  /* ---------- hızlı yaz: "cuma 14:00 finans sınavı" (kurallar, yapay zeka değil) ---------- */
  var docNames = function () { return $$('option', F.doc).map(function (o) { return o.value; }).filter(Boolean); };
  var parseQuick = function (text) {
    var t = ' ' + text + ' ', low = ' ' + text.toLocaleLowerCase('tr') + ' ', out = { time: '', date: '', type: 'calisma', doc: '' };
    var cut = function (m) { if (!m) return; var i = low.indexOf(m); if (i < 0) return; t = t.slice(0, i) + ' ' + t.slice(i + m.length); low = low.slice(0, i) + ' ' + low.slice(i + m.length); };
    var m;
    if ((m = low.match(/(?:saat\s*)?([01]?\d|2[0-3]):([0-5]\d)(?:['’](?:de|da|te|ta))?/)) || (m = low.match(/saat\s*([01]?\d|2[0-3])\.([0-5]\d)(?:['’](?:de|da|te|ta))?/))) { out.time = pad(+m[1]) + ':' + m[2]; cut(m[0]); }
    else if ((m = low.match(/saat\s*([01]?\d|2[0-3])(?:['’](?:de|da|te|ta))?(?=\s)/))) { out.time = pad(+m[1]) + ':00'; cut(m[0]); }
    else if ((m = low.match(/\s([01]?\d|2[0-3])['’](?:de|da|te|ta)(?=\s)/))) { out.time = pad(+m[1]) + ':00'; cut(m[0].trim()); }
    if ((m = low.match(/(?:^|\s)(bugün)/))) { out.date = todayK; cut(m[1]); }
    else if ((m = low.match(/(?:^|\s)(yarın)/))) { out.date = addD(todayK, 1); cut(m[1]); }
    else if ((m = low.match(/(?:^|\s)((?:öbür|ertesi)\s*gün)/))) { out.date = addD(todayK, 2); cut(m[1]); }
    else if ((m = low.match(new RegExp('(?:^|\\s)(\\d{1,2})\\s+(' + MONTHS.join('|') + ')[a-zçğıöşü]*(?:\\s+(\\d{4}))?')))) {
      var y = m[3] ? +m[3] : now.getFullYear(), d = new Date(y, MONTHS.indexOf(m[2]), +m[1]);
      if (!m[3] && ymd(d) < todayK) d.setFullYear(y + 1);
      if (d.getDate() === +m[1]) out.date = ymd(d); cut(m[0].trim());
    } else if ((m = low.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s)/))) {
      var yy = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : now.getFullYear(), d2 = new Date(yy, +m[2] - 1, +m[1]);
      if (!m[3] && ymd(d2) < todayK) d2.setFullYear(yy + 1);
      if (d2.getDate() === +m[1] && d2.getMonth() === +m[2] - 1) out.date = ymd(d2); cut(m[0].trim());
    } else {
      var order = ['cumartesi', 'pazartesi', 'çarşamba', 'perşembe', 'salı', 'cuma', 'pazar'];
      for (var i = 0; i < order.length; i++) {
        var re = new RegExp('(?:^|\\s)((?:haftaya\\s+)?' + order[i] + '[a-zçğıöşü]*)'), mm = low.match(re);
        if (mm) { var target = DAYS.indexOf(order[i]), dd = (target - now.getDay() + 7) % 7; if (/haftaya/.test(mm[1])) dd += 7; out.date = addD(todayK, dd); cut(mm[1]); break; }
      }
    }
    if (/(sınav|vize|final|quiz|bütünleme|midterm)/.test(low)) out.type = 'sinav'; else if (/(ödev|proje|teslim|rapor)/.test(low)) out.type = 'odev';
    docNames().some(function (n) { if (low.indexOf(n.toLocaleLowerCase('tr')) > -1) { out.doc = n; return true; } return false; });
    out.title = cap(t.replace(/\s+/g, ' ').replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '').trim()) || cap(TYPE[out.type]);
    return out;
  };
  $('[data-quick]').addEventListener('submit', async function (e) {
    e.preventDefault();
    var inp = $('#quick-in'), v = inp.value.trim(); if (!v) { inp.focus(); return; }
    await fillDocs('');
    var p = parseQuick(v);
    if (!p.date) { openForm({ title: p.title, type: p.type, time: p.time, doc: p.doc, date: todayK }, 'günü anlayamadım; tarihi buradan seç.'); return; }
    var qr = $('[data-quick]').getBoundingClientRect(), ne;
    try { ne = fromRow(await dbInsert({ title: p.title, type: p.type, date: p.date, time: p.time, doc: p.doc, notes: '' })); }
    catch (er) { fail('Ekleyemedim; bağlantını kontrol et.', er); return; }
    events.push(ne); syncLegacy(); var mv = goMonth(ne.date); inp.value = ''; renderAll(mv);
    flyTo(ne.id, qr, mv ? 480 : 0);
    say('Eklendi: ' + ne.title + ' · ' + fmt(ne.date, true) + (ne.time ? ' ' + ne.time : '') + ' · ' + TYPE[ne.type], async function () {
      try { await dbDelete(ne.id); events = events.filter(function (x) { return x.id !== ne.id; }); syncLegacy(); renderAll(); } catch (er) { fail('Geri alamadım.', er); }
    });
  });

  /* ---------- görünümler ---------- */
  var tabs = $$('[data-view]');
  var setView = function (v) {
    tabs.forEach(function (b) { var on = b.getAttribute('data-view') === v; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $('#v-cal').hidden = v !== 'cal'; $('#v-list').hidden = v !== 'list'; store.set('view', v);
    edged.forEach(drawEdge);
  };
  tabs.forEach(function (b, i) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    b.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var n = tabs[(i + 1) % 2]; n.focus(); n.click(); } });
  });

  /* ---------- takvim uygulamasına aktar (.ics) ---------- */
  $('[data-ics]').addEventListener('click', function () {
    var list = real();
    if (!list.length) { say('Aktaracak etkinlik yok; önce bir tane ekle.'); return; }
    var icsEsc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Acadex//Planlayici//TR', 'CALSCALE:GREGORIAN'];
    list.forEach(function (e) {
      var d = e.date.replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:acadex-' + e.id + '@acadex', 'DTSTAMP:' + stamp);
      if (e.time) { L.push('DTSTART:' + d + 'T' + e.time.replace(':', '') + '00', 'DURATION:PT1H'); }
      else L.push('DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + addD(e.date, 1).replace(/-/g, ''));
      L.push('SUMMARY:' + icsEsc(e.title), 'CATEGORIES:' + icsEsc(TYPE[e.type]));
      var desc = [e.doc ? 'Belge: ' + e.doc : '', e.notes || ''].filter(Boolean).join('\n');
      if (desc) L.push('DESCRIPTION:' + icsEsc(desc));
      if (e.type === 'sinav') L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.title), 'TRIGGER:-P1D', 'END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    var blob = new Blob([L.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'acadex-planlayici.ics'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    say(list.length + ' etkinlik .ics dosyası olarak indi. Google Takvim, Outlook ya da iPhone takvimine ekleyebilirsin.');
  });

  /* ---------- sınav hatırlatıcıları (tarayıcı bildirimi, sayfa açıkken) ---------- */
  var sw = $('[data-remind-sw]'), swS = $('[data-remind-s]'), remindOn = !!store.get('remind'), notified = store.get('notified') || [];
  var hasN = 'Notification' in window;
  var paintRemind = function () {
    var perm = hasN ? Notification.permission : 'none';
    if (perm !== 'granted') remindOn = false;
    sw.setAttribute('aria-checked', String(remindOn)); swS.className = 'remind-s';
    if (!hasN) { swS.textContent = 'bu tarayıcı bildirim desteklemiyor'; swS.classList.add('warn'); sw.disabled = true; }
    else if (remindOn) { swS.textContent = 'açık'; swS.classList.add('on'); }
    else if (perm === 'denied') { swS.textContent = 'izin verilmedi · tarayıcı ayarlarından açabilirsin'; swS.classList.add('warn'); }
    else swS.textContent = 'kapalı';
  };
  var checkRemind = function () {
    if (!remindOn || !hasN || Notification.permission !== 'granted') return;
    var t = Date.now();
    real().forEach(function (e) {
      if (e.type !== 'sinav' || e.done) return;
      var at = toD(e.date), hm = (e.time || '09:00').split(':'); at.setHours(+hm[0], +hm[1], 0, 0);
      [[86400000, 'yarın'], [3600000, '1 saat sonra']].forEach(function (r) {
        var key = e.id + ':' + r[0] + ':' + e.date + e.time;
        if (t >= at - r[0] && t < at && notified.indexOf(key) < 0) {
          try { new Notification('Acadex · sınav hatırlatıcısı', { body: e.title + ' ' + r[1] + (e.time ? ' (' + e.time + ')' : ''), icon: 'assets/logo-icon-only.png' }); } catch (er) {}
          notified.push(key); store.set('notified', notified.slice(-200));
        }
      });
    });
  };
  sw.addEventListener('click', function () {
    if (!hasN) return;
    if (remindOn) { remindOn = false; store.set('remind', false); paintRemind(); return; }
    var go = function (p) { remindOn = p === 'granted'; store.set('remind', remindOn); paintRemind(); if (remindOn) { say('Hatırlatıcılar açık. Bu sayfa açıkken sınavdan önce haber vereceğim.'); checkRemind(); } };
    try { var pr = Notification.requestPermission(go); if (pr && pr.then) pr.then(go); } catch (er) { go(Notification.permission); }
  });
  paintRemind(); setInterval(checkRemind, 60000);

  /* ---------- dashboard.js'in planlayıcı yükleyicisi yerine ---------- */
  var loading = false;
  var load = async function () {
    if (!me() || !sb()) return;
    if (loading) return; loading = true;
    try {
      var r = await sb().from('study_events').select('*').eq('user_id', me().id).order('event_date', { ascending: true });
      if (r.error) throw r.error;
      var drafts = events.filter(function (e) { return e.draft; });
      events = (r.data || []).map(fromRow).concat(drafts); loaded = true;
      syncLegacy(); renderAll(); checkRemind();
    } catch (er) { loaded = true; renderAll(); fail('Takvimin yüklenemedi. Sayfayı yenileyip tekrar dene.', er); }
    finally { loading = false; }
  };
  if (typeof loadPlannerEvents === 'function') { loadPlannerEvents = load; window.loadPlannerEvents = load; }
  if (typeof openAddEventModal === 'function') {
    openAddEventModal = function () { if (typeof switchDashboardView === 'function' && !root.classList.contains('active')) switchDashboardView('planner'); setTimeout(function () { openForm(null); }, 200); };
    window.openAddEventModal = openAddEventModal;
  }
  renderAll(); setView(store.get('view') || (mobile() ? 'list' : 'cal'));
})();

/* ================= ÇALIŞMA DEFTERİ (tasarım kabuğu, dashboard.js'in defter motoru) =================
   Çizim, yazı, tablo, şekil, resim, sesli not, sayfalar, şablonlar, paylaşım, bilgi deposu ve
   buluta kaydetme dashboard.js'te olduğu gibi çalışır (notebooks tablosu, eski sayfalar aynen açılır).
   Bu dosya görünümü, kart listesini, özet panelini, fosforlu kalemi, kâğıt türünü, tam ekranı,
   dokunmatik çizimi ve kayıt durumunu ekler. */
(function () {
  'use strict';
  var root = document.getElementById('notebook-view');
  if (!root || !root.classList.contains('axn')) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var jsq = function (s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\r?\n/g, ' '); };
  var baseName = function (n) { n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, ''); var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1]; return n.replace(/_+/g, ' ').trim() || 'İsimsiz belge'; };
  var MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var dshort = function (d) { d = new Date(d); return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
  var STY = { standard: 'standart', bullet: 'maddeler', structured: 'yapılandırılmış', simplified: 'sade', exam: 'sınav odaklı' };
  var store = { get: function (k) { try { return localStorage.getItem('acadex.defter.' + k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem('acadex.defter.' + k, v); } catch (e) {} } };
  $$('.land').forEach(function (el, i) { el.style.setProperty('--hr', (((i * 37) % 11 - 5) * 0.3).toFixed(2) + 'deg'); el.style.setProperty('--hx', (((i * 53) % 9 - 4) * 2) + 'px'); });

  /* ---------- kart listesi (klasör) ---------- */
  var ICO_DOC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5 C5 3.7 5.7 3 6.5 3 H19 V18 H6.5 C5.7 18 5 18.7 5 19.5 Z"/><path d="M5 19.5 C5 20.3 5.7 21 6.5 21 H19"/></svg>';
  var ICO_DEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 H20 M9 6.5 V4 H15 V6.5 M6.5 6.5 L7.5 20 H16.5 L17.5 6.5"/></svg>';
  var activeCard = null;
  var showSummary = function (card) {
    var box = $('[data-sumcard]');
    if (!card) { box.hidden = true; return; }
    activeCard = card;
    $('[data-sum-n]').textContent = baseName(card.documents && card.documents.file_name);
    var html = typeof formatSummaryText === 'function' ? formatSummaryText(card.summary, card.footnotes) : esc(card.summary || '');
    $('[data-sum]').innerHTML = html || '<p>Bu kartta özet yok.</p>';
    box.hidden = false;
    $$('.kc').forEach(function (k) { k.classList.toggle('is-on', k.getAttribute('data-card') === card.id); });
  };
  var renderList = function (cards) {
    var ul = $('#notebook-sidebar-list'); if (!ul) return;
    cards = cards || [];
    if (!cards.length) {
      var all = lsafe(function () { return notebookCards; }, []) || [];
      ul.innerHTML = all.length ? '<li class="cards-none">bu aramayla kart bulamadım.</li>' : '<li class="cards-none">henüz kartın yok. Belgelerim\'den bir belge özetlediğinde kartların burada durur.</li>';
      showSummary(null); return;
    }
    ul.innerHTML = cards.map(function (c) {
      var full = (c.documents && c.documents.file_name) || 'İsimsiz belge', nm = baseName(full);
      return '<li class="kc" draggable="true" data-card="' + c.id + '">' +
        '<div class="kc-top"><span class="kc-ic" aria-hidden="true">' + ICO_DOC + '</span><div class="kc-n"><b title="' + esc(nm) + '">' + esc(nm) + '</b><small title="' + esc(full) + '">' + esc(full) + '</small></div>' +
        '<button type="button" class="kc-del" aria-label="Kartı sil" title="Kartı sil" onclick="deleteStudyCard(event, \'' + c.id + '\', \'' + c.document_id + '\')">' + ICO_DEL + '</button></div>' +
        '<p class="kc-meta">' + esc(dshort(c.created_at)) + '</p>' +
        '<p class="kc-tags"><span>' + esc((STY[c.summary_style] || c.summary_style || 'standart').toLocaleUpperCase('tr')) + '</span><span>' + (c.summary_language === 'tr' ? 'TR' : 'EN') + '</span>' + (c.course_tag ? '<span>' + esc(c.course_tag) + '</span>' : '') + '</p>' +
        '<div class="kc-row"><span class="kc-share"><label class="ax-sw" title="Bölüm akışında paylaş"><input type="checkbox" id="share-switch-' + c.id + '"' + (c.is_shared ? ' checked' : '') + ' onchange="toggleShareStudyCard(\'' + c.id + '\', this.checked)" aria-label="' + esc(nm) + ' kartını paylaş"><i></i></label>paylaş</span>' +
        '<button type="button" class="kc-b btn-view-summary" data-doc-id="' + c.document_id + '" data-doc-name="' + esc(full) + '" data-card-id="' + c.id + '">Görüntüle</button>' +
        '<button type="button" class="kc-b kc-add" data-add="' + c.id + '">Deftere ekle</button></div></li>';
    }).join('');
    var keep = activeCard && cards.filter(function (c) { return c.id === activeCard.id; })[0];
    showSummary(keep || cards[0]);
  };
  var cardById = function (id) { return (lsafe(function () { return notebookCards; }, []) || []).filter(function (c) { return c.id === id; })[0]; };
  var addNote = function (card, text, at) {
    if (!card || typeof addStickyNoteToNotebook !== 'function') return;
    var nm = baseName(card.documents && card.documents.file_name);
    addStickyNoteToNotebook(card.id, nm, text != null ? text : (card.summary || ''));
    if (at) setTimeout(function () {
      var notes = $$('#notebook-overlay-container .draggable-note'), n = notes[notes.length - 1];
      if (n) { n.style.left = Math.max(0, at.x - 100) + 'px'; n.style.top = Math.max(0, at.y - 30) + 'px'; }
    }, 160);
  };
  var ul = $('#notebook-sidebar-list');
  ul.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]'); if (add) { addNote(cardById(add.getAttribute('data-add'))); return; }
    if (e.target.closest('button, input, label, a')) return;
    var li = e.target.closest('.kc'); if (li) showSummary(cardById(li.getAttribute('data-card')));
  });
  ul.addEventListener('dragstart', function (e) { var li = e.target.closest('.kc'); if (!li) return; e.dataTransfer.setData('text/acadex-card', li.getAttribute('data-card')); e.dataTransfer.effectAllowed = 'copy'; });
  var vp = $('#canvas-viewport');
  vp.addEventListener('dragover', function (e) { if (Array.prototype.indexOf.call(e.dataTransfer.types, 'text/acadex-card') > -1) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  vp.addEventListener('drop', function (e) {
    var id = e.dataTransfer.getData('text/acadex-card'); if (!id) return; e.preventDefault();
    var r = vp.getBoundingClientRect(); addNote(cardById(id), null, { x: e.clientX - r.left, y: e.clientY - r.top });
  });
  if (typeof renderNotebookSidebarList === 'function') { renderNotebookSidebarList = renderList; window.renderNotebookSidebarList = renderList; }

  /* ---------- özetten seç: deftere not olarak as / kopyala ---------- */
  var bubble = $('[data-bubble]'), sumEl = $('[data-sum]'), picked = '';
  var hideBubble = function () { bubble.hidden = true; };
  sumEl.addEventListener('mouseup', function () {
    setTimeout(function () {
      var sel = window.getSelection(), t = sel ? String(sel).trim() : '';
      if (!t || !sel.rangeCount || !sumEl.contains(sel.anchorNode)) { hideBubble(); return; }
      picked = t.slice(0, 600);
      var r = sel.getRangeAt(0).getBoundingClientRect();
      bubble.hidden = false;
      var bw = bubble.offsetWidth, x = Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2));
      bubble.style.left = x + 'px'; bubble.style.top = Math.max(70, r.top - bubble.offsetHeight - 12) + 'px';
      bubble.style.setProperty('--ax', (r.left + r.width / 2 - x) + 'px');
    }, 10);
  });
  document.addEventListener('mousedown', function (e) { if (!bubble.hidden && !bubble.contains(e.target)) hideBubble(); });
  window.addEventListener('scroll', hideBubble, { passive: true });
  bubble.addEventListener('click', function (e) {
    var b = e.target.closest('[data-clip]'); if (!b) return;
    if (b.getAttribute('data-clip') === 'note') addNote(activeCard, picked);
    else if (navigator.clipboard) navigator.clipboard.writeText(picked).catch(function () {});
    hideBubble(); try { window.getSelection().removeAllRanges(); } catch (er) {}
  });

  /* ---------- araçlar: basılı görünüm, fosforlu kalem, kalınlık noktası ---------- */
  var HL = 'rgba(255,209,0,0.38)', hl = null;
  var syncTools = function () {
    var hlOn = !!hl;
    $$('.tools .tl').forEach(function (b) {
      var on = b.id === 'ax-tool-hl' ? hlOn : (b.classList.contains('active') && !(hlOn && b.id === 'tool-pen'));
      b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on);
    });
    root.classList.toggle('hl-mode', hlOn);
  };
  var leaveHl = function () {
    if (!hl) return;
    try { currentPenColor = hl.color; currentBrushSize = hl.size; } catch (er) {}
    var s = $('#brush-size'); if (s) { s.value = hl.size; $('#brush-size-val').textContent = hl.size + 'px'; }
    hl = null; dot();
  };
  $('#ax-tool-hl').addEventListener('click', function () {
    if (hl) { leaveHl(); syncTools(); return; }
    if (typeof setNotebookMode === 'function') setNotebookMode('pen');
    hl = { color: lsafe(function () { return currentPenColor; }, '#000000'), size: lsafe(function () { return currentBrushSize; }, 4) };
    try { currentPenColor = HL; currentBrushSize = 16; } catch (er) {}
    var s = $('#brush-size'); if (s) { s.value = 16; $('#brush-size-val').textContent = '16px'; }
    dot(); syncTools();
  });
  $$('.tools .tool-btn').forEach(function (b) { b.addEventListener('click', function () { leaveHl(); setTimeout(syncTools, 0); }); });
  $$('.color-swatch').forEach(function (b) { b.addEventListener('click', function () { if (hl) { hl = null; root.classList.remove('hl-mode'); syncTools(); } }); });
  $('#tool-color-picker').addEventListener('input', function () { if (hl) { hl = null; syncTools(); } });
  var dot = function () { var s = $('#brush-size'), d = $('[data-size-dot]'); if (s && d) d.style.setProperty('--d', Math.max(3, Math.min(20, +s.value)) + 'px'); };
  $('#brush-size').addEventListener('input', dot); dot();
  document.addEventListener('click', function (e) { var m = $('#shape-menu'); if (m && m.style.display === 'block' && !e.target.closest('.ax-shape-w')) m.style.display = 'none'; });
  if ('MutationObserver' in window) new MutationObserver(function () { syncTools(); }).observe($('.tools'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  syncTools();

  /* ---------- kâğıt türü (bu tarayıcıda hatırlanır) ---------- */
  var book = $('[data-book]'), paperSel = $('[data-paper]');
  var setPaper = function (v) { ['lined', 'grid', 'dots', 'plain', 'cornell'].forEach(function (p) { book.classList.toggle('p-' + p, p === v); }); paperSel.value = v; store.set('paper', v); };
  paperSel.addEventListener('change', function () { setPaper(paperSel.value); });
  setPaper(store.get('paper') || 'lined');

  /* ---------- tam ekran ---------- */
  var nb = $('.nb'), fullB = $('[data-full]');
  fullB.addEventListener('click', function () {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (nb.requestFullscreen) nb.requestFullscreen().catch(function () {});
  });
  document.addEventListener('fullscreenchange', function () {
    var on = document.fullscreenElement === nb;
    fullB.setAttribute('aria-pressed', String(on)); nb.classList.toggle('is-full', on);
    setTimeout(function () { if (typeof resizeCanvasToDisplaySize === 'function') resizeCanvasToDisplaySize(); }, 120);
  });

  /* ---------- parmakla ya da tabletle çizim (eski motor yalnızca fareyi dinliyordu) ---------- */
  var cv = $('#notebook-canvas');
  cv.style.touchAction = 'none';
  var tp = null;
  var fake = function (e) { return { clientX: e.clientX, clientY: e.clientY, target: cv, preventDefault: function () { e.preventDefault(); } }; };
  cv.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') return; tp = e.pointerId; e.preventDefault(); if (typeof startDrawing === 'function') startDrawing(fake(e)); });
  cv.addEventListener('pointermove', function (e) { if (e.pointerId !== tp) return; e.preventDefault(); if (typeof draw === 'function') draw(fake(e)); });
  var tEnd = function (e) { if (e.pointerId !== tp) return; tp = null; if (typeof stopDrawing === 'function') stopDrawing(fake(e)); };
  cv.addEventListener('pointerup', tEnd); cv.addEventListener('pointercancel', tEnd);

  /* ---------- sayfa göstergesi Türkçe, kayıt durumu ---------- */
  var ind = $('#notebook-page-indicator');
  var fixInd = function () { var m = ind.textContent.match(/(\d+)\s*(?:\/|of)\s*(\d+)/i); var t = m ? 'sayfa ' + m[1] + ' / ' + m[2] : ind.textContent; if (ind.textContent !== t) ind.textContent = t; };
  if ('MutationObserver' in window) new MutationObserver(fixInd).observe(ind, { childList: true, characterData: true, subtree: true });
  var saved = $('[data-saved]'), lastSave = null, wasDirty = false;
  var paintSaved = function () {
    var dirty = lsafe(function () { return notebookHasUnsavedChanges; }, false);
    if (dirty === wasDirty && saved.dataset.init) return;
    saved.dataset.init = '1'; wasDirty = dirty;
    saved.classList.toggle('ok', !dirty && !!lastSave);
    saved.textContent = dirty ? 'kaydedilmemiş değişiklik var' : lastSave ? 'kaydedildi ✓ ' + lastSave : 'bulutta';
  };
  setInterval(paintSaved, 1200);
  if (typeof saveNotebookData === 'function') {
    var origSave = saveNotebookData;
    saveNotebookData = async function () {
      saved.textContent = 'kaydediliyor…'; saved.classList.remove('ok');
      var r = await origSave.apply(this, arguments);
      if (!lsafe(function () { return notebookHasUnsavedChanges; }, true)) {
        var d = new Date(); lastSave = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
        saved.classList.remove('thump'); void saved.offsetWidth; saved.classList.add('thump');
      }
      saved.dataset.init = ''; paintSaved();
      return r;
    };
    window.saveNotebookData = saveNotebookData;
  }
  window.addEventListener('beforeunload', function (e) {
    if (root.classList.contains('active') && lsafe(function () { return notebookHasUnsavedChanges; }, false)) { e.preventDefault(); e.returnValue = ''; }
  });
  /* Ctrl+S: defteri kaydet */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && root.classList.contains('active')) { e.preventDefault(); $('#btn-save-notebook').click(); }
  });
})();
