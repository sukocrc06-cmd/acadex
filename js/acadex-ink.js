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

/* ================= BİLGİ KARTLARI (tam tasarım, gerçek desteler) =================
   Desteler: study_cards. Kartlar: her destenin anahtar terimleri, test soruları ve boşluk doldurmaları
   + öğrencinin özetten kendi yaptığı kartlar (aynı destenin key_terms / cloze_cards listesine "user": true
   olarak eklenir). Tekrar kayıtları card_item_confidence tablosuna, Akıllı Tekrar'la aynı SM-2 kuralıyla
   ve aynı anahtarlarla yazılır; iki ekran birbirinin ilerlemesini görür. */
(function () {
  'use strict';
  var root = document.getElementById('cards-view');
  if (!root || !root.classList.contains('axk')) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var me = function () { return lsafe(function () { return currentUser; }, null) || window.currentUser || null; };
  var sb = function () { return typeof supabaseClient !== 'undefined' ? supabaseClient : null; };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var baseName = function (n) { n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, ''); var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1]; return n.replace(/_+/g, ' ').trim() || 'İsimsiz belge'; };
  var MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var dshort = function (d) { d = new Date(d); return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
  var STY = { standard: 'STANDART', bullet: 'MADDELER', structured: 'YAPILANDIRILMIŞ', simplified: 'SADE', exam: 'SINAV ODAKLI' };
  var LB = ['her gün', '2 günde', '4 günde', 'hafta', '2 hafta'];
  $$('.land').forEach(function (el, i) { el.style.setProperty('--hr', (((i * 37) % 11 - 5) * 0.3).toFixed(2) + 'deg'); el.style.setProperty('--hx', (((i * 53) % 9 - 4) * 2) + 'px'); });

  var decks = function () { return lsafe(function () { return libraryCards; }, []) || []; };
  var confMap = function () { var m = lsafe(function () { return libraryConfidenceMap; }, null); return m || {}; };
  var activeId = null;
  var activeDeck = function () { return decks().filter(function (d) { return d.id === activeId; })[0] || null; };
  var keyOf = function (item, type, i) { return typeof getReviewItemKey === 'function' ? getReviewItemKey(item, type, i) : type + ':' + i; };
  var stripTags = function (h) { var d = document.createElement('div'); d.innerHTML = String(h || ''); return (d.textContent || '').trim(); };

  /* bir destenin kartları */
  var cardsOf = function (deck) {
    if (!deck) return [];
    var out = [], src = baseName(deck.documents && deck.documents.file_name);
    (deck.key_terms || []).forEach(function (t, i) { if (!t || !(t.term || t.definition)) return; out.push({ id: deck.id + '|t|' + i, deck: deck.id, type: 'terms', idx: i, key: keyOf(t, 'terms', i), front: stripTags(t.term), back: stripTags(t.definition), user: !!t.user, src: src }); });
    (deck.quiz_questions || []).forEach(function (q, i) {
      if (!q || !q.question) return;
      var ans = q.answer != null ? String(q.answer) : '';
      if (/^[A-Da-d]$/.test(ans) && Array.isArray(q.options)) { var o = q.options['ABCD'.indexOf(ans.toUpperCase())]; if (o) ans = ans.toUpperCase() + ') ' + o; }
      out.push({ id: deck.id + '|q|' + i, deck: deck.id, type: 'quiz', idx: i, key: keyOf(q, 'quiz', i), front: stripTags(q.question), back: stripTags(ans) + (q.explanation ? ' — ' + stripTags(q.explanation) : ''), user: false, src: src });
    });
    (deck.cloze_cards || []).forEach(function (c, i) { if (!c || !c.prompt) return; out.push({ id: deck.id + '|c|' + i, deck: deck.id, type: 'cloze', idx: i, key: keyOf(c, 'cloze', i), front: stripTags(c.prompt), back: stripTags(c.full || c.sentence || c.answer), cloze: stripTags(c.answer), user: !!c.user, src: src }); });
    var cm = confMap(), now = Date.now();
    out.forEach(function (c) {
      var r = cm[c.deck + ':' + c.key]; c.conf = r || null;
            c.box = !r ? 1 : Math.min(5, 1 + (Number(r.repetitions) || 0));
      c.due = !r || !r.next_review_at || new Date(r.next_review_at).getTime() <= now;
    });
    return out;
  };

  /* bildirim */
  var toast = $('[data-toast]'), toastT = $('[data-toast-t]'), toastB = $('[data-toast-b]'), toastA = $('[data-toast-a]'), toastTimer = 0, undoFn = null;
  var say = function (t, undo, link) { toastT.textContent = t; undoFn = undo || null; toastB.hidden = !undo; toastA.hidden = !link; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; undoFn = null; }, 5600); };
  toastB.addEventListener('click', function () { if (undoFn) undoFn(); toast.hidden = true; undoFn = null; });
  toastA.addEventListener('click', function (e) { e.preventDefault(); toast.hidden = true; if (typeof switchDashboardView === 'function') switchDashboardView('notebook'); });

  /* ---------- kutular ---------- */
  var dots = function (b) { var h = ''; for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= b ? 'on' : '') + '"></i>'; return h; };
  var renderBoxes = function (list) {
    var sec = $('#cards-list-section'); if (!sec) return;
    list = list || window.filteredLibraryCardsList || decks();
    if (!list.length) {
      sec.innerHTML = '<p class="none">' + (decks().length ? 'bu aramayla deste bulamadım.' : 'henüz desten yok. “Belgeden deste oluştur” ile bir belgeni özetlediğinde kutun burada belirir.') + '</p>';
      if (!decks().length) { activeId = null; paintAll(); }
      return;
    }
    if (!activeId || !list.some(function (d) { return d.id === activeId; })) activeId = list[0].id;
    try { libraryActiveCardId = activeId; } catch (e) {}
    sec.innerHTML = list.map(function (d) {
      var full = (d.documents && d.documents.file_name) || 'İsimsiz belge', nm = baseName(full), cs = cardsOf(d), due = cs.filter(function (c) { return c.due; }).length, mine = cs.filter(function (c) { return c.user; }).length;
      var stack = ''; for (var i = 0; i < Math.min(cs.length, 6); i++) stack += '<i style="--o:' + (6 - i) * 2 + 'px;--r:' + ((i % 3) - 1) * 1.5 + 'deg;bottom:' + (-i * 2) + 'px"></i>';
      return '<div class="kbox land lib-md-item" role="listitem" tabindex="0" data-card-id="' + d.id + '" aria-current="' + (d.id === activeId) + '" aria-label="' + esc(nm) + ' destesi, ' + cs.length + ' kart">' +
        '<div class="kbox-lid" aria-hidden="true"></div><div class="kbox-front">' +
        '<span class="kbox-label"><b>' + esc(nm) + '</b><small>' + esc(dshort(d.created_at)) + '</small></span>' +
        '<p class="kc-tags"><span>' + esc(STY[d.summary_style] || 'STANDART') + '</span><span>' + (d.summary_language === 'tr' ? 'TR' : 'EN') + '</span>' + (d.course_tag ? '<span>' + esc(d.course_tag) + '</span>' : '') + '</p>' +
        '<p class="kbox-n hand">' + (cs.length ? cs.length + ' kart' + (mine ? ' · ' + mine + ' senin' : '') + (due ? ' · bugün ' + due : '') : 'bu destede kart yok') + '</p>' +
        '<div class="kc-row"><span class="kc-share"><label class="ax-sw" title="Bölüm akışında paylaş"><input type="checkbox" id="share-switch-lib-' + d.id + '"' + (d.is_shared ? ' checked' : '') + ' onchange="toggleShareStudyCard(\'' + d.id + '\', this.checked)" aria-label="' + esc(nm) + ' destesini paylaş"><i></i></label>paylaş</span>' +
        '<button type="button" class="kc-b btn-view-summary" data-doc-id="' + d.document_id + '" data-doc-name="' + esc(full) + '" data-card-id="' + d.id + '">Görüntüle</button>' +
        '<button type="button" class="ax-kdel" title="Desteyi sil" onclick="deleteStudyCard(event, \'' + d.id + '\', \'' + d.document_id + '\')">sil</button></div>' +
        '</div><div class="kbox-cards" aria-hidden="true">' + stack + '</div></div>';
    }).join('');
    paintAll();
  };
  var pick = function (id) {
    if (id === activeId) return;
    activeId = id; try { libraryActiveCardId = id; } catch (e) {}
    $$('.kbox').forEach(function (b) { b.setAttribute('aria-current', String(b.getAttribute('data-card-id') === id)); });
    paintAll();
  };
  $('#cards-list-section').addEventListener('click', function (e) { if (e.target.closest('button, input, label, a')) return; var b = e.target.closest('.kbox'); if (b) pick(b.getAttribute('data-card-id')); });
  $('#cards-list-section').addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('kbox')) { e.preventDefault(); pick(e.target.getAttribute('data-card-id')); } });

  /* ---------- tekrar kutusu, özet, yelpaze, başlıktaki sayaç ---------- */
  var leit = $('[data-leit]'), fan = $('[data-fan]'), fanW = $('[data-fan-w]'), listN = $('[data-list-n]'), dueEl = $('[data-due]');
  var paintSide = function () {
    var deck = activeDeck(), cs = cardsOf(deck), cnt = [0, 0, 0, 0, 0, 0], due = [0, 0, 0, 0, 0, 0];
    cs.forEach(function (c) { cnt[c.box]++; if (c.due) due[c.box]++; });
    var lh = '';
    for (var b = 1; b <= 5; b++) {
      var fi = ''; for (var k = 0; k < Math.min(cnt[b], 14); k++) fi += '<i style="--k:' + k + ';--t:' + (((k * 7 + b) % 5) - 2) * 0.8 + 'deg"></i>';
      lh += '<div class="cp' + (due[b] ? ' due' : '') + (cnt[b] ? '' : ' empty') + '" data-cp="' + b + '" role="img" aria-label="' + LB[b - 1] + ' bölmesi: ' + cnt[b] + ' kart' + (due[b] ? ', ' + due[b] + ' tanesi bugün' : '') + '"><span class="cp-l hand">' + LB[b - 1] + '</span><span class="cp-in">' + (cnt[b] ? fi : '<em class="hand">boş</em>') + '</span><span class="cp-n hand">' + cnt[b] + '</span></div>';
    }
    leit.innerHTML = lh;
    var all = 0; decks().forEach(function (d) { all += cardsOf(d).filter(function (c) { return c.due; }).length; });
    dueEl.textContent = all ? 'bugün ' + all + ' kart seni bekliyor' : (decks().length ? 'bugünlük tekrar bitti' : 'bugün tekrar yok'); dueEl.classList.toggle('on', !!all);
    listN.textContent = cs.length; fanW.hidden = !cs.length;
    var n = cs.length, mid = (n - 1) / 2;
    fan.innerHTML = cs.map(function (c, i) {
      var r = n > 1 ? (i - mid) * Math.min(5, 26 / n) : 0;
      return '<button type="button" role="listitem" class="fc" data-id="' + esc(c.id) + '" style="--fr:' + r.toFixed(1) + 'deg;--fy:' + (Math.abs(i - mid) * Math.min(6, 30 / n)).toFixed(1) + 'px"' + (cur && cur.id === c.id ? ' aria-current="true"' : '') + ' aria-label="Kartı aç: ' + esc(c.front) + ', ' + c.box + '. bölme">' + (c.user ? '<span class="fc-u">senin</span>' : '') +
        '<span class="fc-q">' + esc(c.front.length > 90 ? c.front.slice(0, 90) + '…' : c.front) + '</span><span class="fc-d" aria-hidden="true">' + dots(c.box) + '</span></button>';
    }).join('');
  };
  var sumEl = $('[data-sum]');
  var paintSummary = function () {
    var deck = activeDeck();
    $('[data-sum-n]').textContent = deck ? baseName(deck.documents && deck.documents.file_name) : '';
    $('[data-sum-act]').hidden = !deck;
    if (!deck) { sumEl.innerHTML = '<p class="hand" style="font-size:20px;color:#6A7593">bir deste seç; özeti burada açılır.</p>'; return; }
    sumEl.innerHTML = (typeof formatSummaryText === 'function' ? formatSummaryText(deck.summary, deck.footnotes) : esc(deck.summary || '')) || '<p>Bu destede özet yok.</p>';
    var vb = $('[data-view-sum]'); vb.setAttribute('data-doc-id', deck.document_id); vb.setAttribute('data-doc-name', (deck.documents && deck.documents.file_name) || ''); vb.setAttribute('data-card-id', deck.id);
  };
  $('[data-smart]').addEventListener('click', function () { var d = activeDeck(); if (d && typeof openAdaptiveReview === 'function') openAdaptiveReview(d.id, baseName(d.documents && d.documents.file_name)); });
  var paintAll = function () { paintSummary(); buildQueue(); load(); };

  /* ---------- çalışma masası ---------- */
  var mode = 'due', queue = [], idx = 0, cur = null, flipped = false, score = { y: 0, n: 0 }, busy = false;
  var bigB = $('[data-big]'), bigIn = $('[data-big-in]'), prog = $('[data-prog]'), judgeEl = $('[data-judge]'), keysEl = $('[data-keys]'), tallyEl = $('[data-tally]'), jBtns = $$('[data-j]');
  var paintTally = function () {
    var n = score.y, w = Math.max(1, Math.ceil(n / 5)) * 34, h = '<svg viewBox="0 0 ' + w + ' 36" style="width:' + (w * 0.8) + 'px" aria-hidden="true">';
    for (var k = 0; k < n; k++) { var g = Math.floor(k / 5), j = k % 5, x = g * 34 + 4 + j * 6; h += j < 4 ? '<path d="M' + x + ' 5 C' + (x + 1) + ' 14 ' + (x - 1) + ' 24 ' + x + ' 32"/>' : '<path d="M' + (g * 34 + 1) + ' 26 C' + (g * 34 + 10) + ' 20 ' + (g * 34 + 18) + ' 14 ' + (g * 34 + 27) + ' 9"/>'; }
    tallyEl.innerHTML = n ? h + '</svg>' : '';
    var last = tallyEl.querySelector('path:last-child'); if (last && !reduce) { last.setAttribute('pathLength', '1'); last.classList.add('fresh'); }
  };
  var steps = '<span class="how" aria-hidden="true"><span class="hw"><svg viewBox="0 0 64 48"><path d="M6 18 H50 M6 28 H34"/><path class="hl" d="M14 23 H44" /><path d="M46 30 L52 44 L55 38 L61 41 Z"/></svg><b>seç</b></span><i>→</i><span class="hw"><svg viewBox="0 0 64 48"><path d="M8 10 H50 V40 H8 Z"/><path d="M14 20 H32"/><path d="M36 38 L56 12 L60 15 L40 41 L35 42 Z"/></svg><b>soruyu yaz</b></span><i>→</i><span class="hw"><svg viewBox="0 0 64 48"><path d="M14 8 H46 V40 H14 Z"/><path d="M8 20 C2 26 4 34 12 36"/><path d="M8 30 L12 36 L5 37"/></svg><b>çevir</b></span></span>';
  var setInteractive = function (on) { if (on) { bigB.setAttribute('role', 'button'); bigB.tabIndex = 0; } else { bigB.removeAttribute('role'); bigB.removeAttribute('tabindex'); bigB.removeAttribute('aria-pressed'); bigB.removeAttribute('aria-label'); } };
  var firstSentence = function () { var t = (sumEl.textContent || '').trim(); var m = t.search(/[.!?](\s|$)/); return m < 0 ? t.slice(0, 200) : t.slice(0, m + 1); };
  var face = function () {
    var c = cur, deck = activeDeck();
    $$('.imprint', bigIn.parentNode).forEach(function (x) { x.remove(); });
    if (!c) {
      var cs = cardsOf(deck), done = queue.length && idx >= queue.length;
      bigB.classList.remove('back'); setInteractive(false); judgeEl.hidden = !done; keysEl.hidden = true; jBtns.forEach(function (b) { b.disabled = true; });
      if (!deck) { bigIn.innerHTML = '<span class="side">DESTE YOK</span><span class="empty-t">kart çalışmak için önce bir belgeden deste oluştur.</span><button type="button" class="first" data-new-deck="">belgeden deste oluştur →</button>'; prog.textContent = ''; }
      else if (done) {
        bigIn.innerHTML = '<span class="side">BUGÜNLÜK BU KADAR</span><span class="done-n">' + score.y + ' / ' + (score.y + score.n) + '</span><span class="a">' + (score.n ? 'kartı bildin. bilmediklerin en başa döndü, yakında yine sorulur.' : 'hepsini bildin, hepsi bir bölme ileri gitti.') + '</span><span class="note hand">' + (score.y >= score.n ? 'iyi gidiyorsun, yarın da uğra.' : 'zor kartlar böyledir; bir tur daha?') + '</span>' + (score.n ? '<button type="button" class="again" data-again="">bilmediklerimi bir daha sor</button>' : '');
        prog.textContent = 'bitti';
      } else if (!cs.length) {
        var fs = firstSentence();
        bigIn.innerHTML = '<span class="side">İLK KARTIN</span>' + steps + (fs ? '<span class="seed hand">“' + esc(fs.length > 110 ? fs.slice(0, 110) + '…' : fs) + '”</span><button type="button" class="first" data-first="">bu cümleden ilk kartımı yap →</button>' : '') + '<span class="k-src">bu destede hazır kart yok; özetten kendi kartlarını yapabilirsin.</span>';
        prog.textContent = '';
      } else {
        bigIn.innerHTML = '<span class="side">BUGÜN</span><span class="empty-t">bu destede bugün sorulacak kart kalmadı. istersen hepsine bir göz at.</span><button type="button" class="first" data-go-all="">sırayla çevir →</button>';
        prog.textContent = '';
      }
      return;
    }
    setInteractive(true); judgeEl.hidden = false; keysEl.hidden = false; jBtns.forEach(function (b) { b.disabled = false; });
    var lvl = '<span class="lvl" aria-hidden="true">' + dots(c.box) + '</span>', kind = c.type === 'quiz' ? 'TEST SORUSU' : c.type === 'cloze' ? 'BOŞLUK' : 'SORU';
    if (!flipped) bigIn.innerHTML = '<span class="side">' + kind + '</span>' + lvl + '<span class="q">' + esc(c.front) + '</span><span class="k-hint">dokun, çevir ↻</span>';
    else bigIn.innerHTML = '<span class="side">CEVAP</span>' + lvl + '<span class="a">' + (c.cloze && c.back.indexOf(c.cloze) > -1 ? esc(c.back).replace(esc(c.cloze), '<mark>' + esc(c.cloze) + '</mark>') : esc(c.back)) + '</span><span class="k-src">— ' + esc(c.src) + (c.user ? ' · senin kartın' : '') + '</span><span class="tools"><button type="button" class="send" data-send-cur="" tabindex="-1">deftere gönder</button>' + (c.user ? '<button type="button" class="send del" data-del-cur="" tabindex="-1">sil</button>' : '') + '</span>';
    bigB.classList.toggle('back', flipped); bigB.setAttribute('aria-pressed', String(flipped));
    bigB.setAttribute('aria-label', (flipped ? 'Cevap: ' + c.back : 'Soru: ' + c.front) + '. Çevirmek için dokun.');
    prog.textContent = (idx + 1) + ' / ' + queue.length;
  };
  var byId = function (id) { var cs = cardsOf(activeDeck()); for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i]; return null; };
  var load = function () { cur = idx < queue.length ? byId(queue[idx]) : null; flipped = false; face(); paintSide(); };
  var buildQueue = function () {
    var cs = cardsOf(activeDeck());
    queue = (mode === 'due' ? cs.filter(function (c) { return c.due; }).sort(function (a, b) { return a.box - b.box || (a.conf ? 1 : 0) - (b.conf ? 1 : 0); }) : cs).slice(0, mode === 'due' ? 40 : 999).map(function (c) { return c.id; });
    idx = 0; score = { y: 0, n: 0 }; paintTally();
  };
  var flip = function () { if (!cur || busy) return; if (reduce) { flipped = !flipped; face(); return; } bigIn.classList.add('squash'); setTimeout(function () { flipped = !flipped; face(); bigIn.classList.remove('squash'); }, 190); };

  /* SM-2 kaydı (Akıllı Tekrar ile aynı) */
  var record = async function (c, knew) {
    var u = me(); if (!u || !sb() || typeof computeSm2 !== 'function') return;
    var s = computeSm2(c.conf, knew ? 'good' : 'again');
    var row = { user_id: u.id, study_card_id: c.deck, item_key: c.key, card_type: c.type, rating: s.rating, last_rating: s.last_rating, ease_factor: s.ease_factor, interval_days: s.interval_days, repetitions: s.repetitions, lapses: s.lapses, next_review_at: s.next_review_at, updated_at: new Date().toISOString() };
    try {
      var r = await sb().from('card_item_confidence').upsert(row, { onConflict: 'user_id,study_card_id,item_key' });
      if (r.error) throw r.error;
      var m = confMap(); m[c.deck + ':' + c.key] = { study_card_id: c.deck, item_key: c.key, next_review_at: s.next_review_at, ease_factor: s.ease_factor, repetitions: s.repetitions, interval_days: s.interval_days, lapses: s.lapses };
      try { if (!libraryConfidenceMap) libraryConfidenceMap = m; } catch (e) {}
      paintSide(); renderBoxesKeep();
    } catch (er) { console.warn('acadex-ink: tekrar kaydedilemedi', er); say('Bu cevap kaydedilemedi; bağlantını kontrol et.'); }
  };
  var judge = function (knew) {
    if (!cur || busy) return; busy = true;
    var c = cur, nb = knew ? Math.min(5, c.box + 1) : 1;
    if (knew) score.y++; else score.n++;
    record(c, knew);
    var im = document.createElement('span'); im.className = 'imprint ' + (knew ? 'yes' : 'no'); im.textContent = knew ? 'BİLİYORUM' : 'TEKRAR';
    im.style.setProperty('--ir', ((Math.random() * 16) - 8).toFixed(1) + 'deg'); im.style.left = (28 + Math.random() * 30) + '%'; im.style.top = (30 + Math.random() * 25) + '%';
    bigIn.appendChild(im);
    var btn = $('[data-j="' + (knew ? 1 : 0) + '"]'); btn.classList.remove('press'); void btn.offsetWidth; btn.classList.add('press');
    paintTally();
    var next = function () { busy = false; idx++; load(); if (!reduce) { bigIn.classList.add('come'); setTimeout(function () { bigIn.classList.remove('come'); }, 420); } };
    if (reduce) { setTimeout(next, 250); return; }
    setTimeout(function () {
      var cp = leit.querySelector('[data-cp="' + nb + '"]'), a = bigIn.getBoundingClientRect(), b = cp ? cp.getBoundingClientRect() : null;
      var f = bigIn.cloneNode(true); f.classList.add('flyc'); f.style.left = a.left + 'px'; f.style.top = a.top + 'px'; f.style.width = a.width + 'px'; f.style.height = a.height + 'px';
      root.appendChild(f);
      var vis = b && b.bottom > 0 && b.top < window.innerHeight;
      var anim = vis ? [{ transform: 'none' }, { transform: 'translate(' + ((b.left + b.width / 2) - (a.left + a.width / 2)) * 0.5 + 'px,' + (((b.top) - (a.top + a.height / 2)) * 0.5 - 60) + 'px) scale(.45) rotate(' + (knew ? 10 : -10) + 'deg)', offset: 0.5 }, { transform: 'translate(' + ((b.left + b.width / 2) - (a.left + a.width / 2)) + 'px,' + ((b.top + b.height / 2) - (a.top + a.height / 2)) + 'px) scale(' + (b.width / a.width * 0.9).toFixed(3) + ',.05)', opacity: 0.6 }]
        : [{ transform: 'none' }, { transform: 'translate(' + (knew ? 140 : -140) + '%,-30px) rotate(' + (knew ? 18 : -18) + 'deg)', opacity: 0 }];
      f.animate(anim, { duration: vis ? 620 : 380, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = function () {
        f.remove(); var nc = leit.querySelector('[data-cp="' + nb + '"]'); if (nc) { nc.classList.remove('bump'); void nc.offsetWidth; nc.classList.add('bump'); }
      };
      next();
    }, 420);
  };
  var swiped = false;
  bigB.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('[data-send-cur]')) { sendToDepot(cur); return; }
    if (e.target.closest('[data-del-cur]')) { removeCard(cur); return; }
    if (e.target.closest('[data-first]')) { openMaker('', firstSentence(), '', 'ilk kartın'); return; }
    if (e.target.closest('[data-go-all]')) { $('#m-all').click(); return; }
    if (e.target.closest('[data-new-deck]')) { openRecipe(); return; }
    if (e.target.closest('[data-again]')) { var cs = cardsOf(activeDeck()); queue = cs.filter(function (c) { return c.box === 1 && c.due; }).map(function (c) { return c.id; }); idx = 0; score = { y: 0, n: 0 }; paintTally(); load(); return; }
    if (cur) flip();
  });
  jBtns.forEach(function (b) { b.addEventListener('click', function () { judge(b.getAttribute('data-j') === '1'); }); });
  bigB.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === bigB) { e.preventDefault(); flip(); } });
  document.addEventListener('keydown', function (e) {
    if (!root.classList.contains('active')) return;
    var t = e.target; if (document.querySelector('dialog[open]') || document.querySelector('.modal-overlay.active') || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || (t.closest && t.closest('.modes'))) return;
    if (e.key === ' ' && (t === document.body || t === bigB)) { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight' && cur) { e.preventDefault(); judge(true); }
    else if (e.key === 'ArrowLeft' && cur) { e.preventDefault(); judge(false); }
  });
  bigB.addEventListener('pointerdown', function (e) {
    if (!cur || busy || e.button !== 0 || e.target.closest('button')) return;
    var sx = e.clientX, dx = 0, on = false;
    var mv = function (m) { dx = m.clientX - sx; if (!on && Math.abs(dx) < 8) return; on = true; bigB.classList.add('dragging'); bigIn.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 22 + 'deg)'; };
    var up = function () {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      bigB.classList.remove('dragging'); bigIn.style.transform = '';
      if (!on) return; swiped = true; setTimeout(function () { swiped = false; }, 60);
      if (Math.abs(dx) > 90) judge(dx > 0);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });
  var tabs = $$('[data-mode]');
  tabs.forEach(function (b, i) {
    b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); x.tabIndex = x === b ? 0 : -1; }); $('#ktable').setAttribute('aria-labelledby', b.id); buildQueue(); load(); });
    b.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); var n = tabs[(i + 1) % 2]; n.focus(); n.click(); } });
  });
  fan.addEventListener('click', function (e) {
    var b = e.target.closest('.fc'); if (!b) return; var id = b.getAttribute('data-id');
    mode = 'all'; tabs.forEach(function (x) { var on = x.getAttribute('data-mode') === 'all'; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
    buildQueue(); idx = Math.max(0, queue.indexOf(id)); load(); $('#ktable').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- deftere gönder: Bilgi deposu (defterin hazırlık rafı) ---------- */
  var sendToDepot = async function (c) {
    if (!c || !me() || !sb()) return;
    try {
      var r = await sb().from('card_depot').insert({ user_id: me().id, source_type: 'key_term', title: c.front.slice(0, 300), content: c.back, study_card_id: c.deck });
      if (r.error) throw r.error;
      if (typeof updateDepotCountBadge === 'function') updateDepotCountBadge();
      if (!reduce) {
        var src = bigB.getBoundingClientRect(), f = document.createElement('div'); f.className = 'flycard';
        f.style.cssText = 'left:' + src.left + 'px;top:' + src.top + 'px;width:' + src.width + 'px;height:' + src.height + 'px;background:#fff;border-top:4px solid #2F6BFF;border-radius:4px;box-shadow:0 20px 30px -16px rgba(13,24,56,.5)';
        root.appendChild(f);
        f.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + (window.innerWidth - src.right + 40) + 'px,-' + (src.top + 60) + 'px) rotate(24deg) scale(.3)', opacity: 0 }], { duration: 620, easing: 'cubic-bezier(.5,0,.75,.4)' }).onfinish = function () { f.remove(); };
      }
      say('Kart defterin Bilgi deposuna gitti; defterden sayfaya ekleyebilirsin.', null, true);
    } catch (er) { console.warn(er); say('Depoya gönderilemedi; tekrar dene.'); }
  };

  /* ---------- kendi kartın: destenin listesine yazılır ---------- */
  var saveDeckField = async function (deck, field, arr) {
    var upd = {}; upd[field] = arr;
    var r = await sb().from('study_cards').update(upd).eq('id', deck.id);
    if (r.error) throw r.error;
    deck[field] = arr;
  };
  var removeCard = function (c) {
    if (!c || !c.user) return; var deck = activeDeck(); if (!deck) return;
    var field = c.type === 'cloze' ? 'cloze_cards' : 'key_terms', before = (deck[field] || []).slice(), item = before[c.idx];
    var after = before.filter(function (x, i) { return i !== c.idx; });
    var go = async function () {
      try { await saveDeckField(deck, field, after); } catch (er) { say('Kart silinemedi; tekrar dene.'); return; }
      buildQueue(); load(); renderBoxesKeep();
      say('Kartın silindi.', async function () { try { await saveDeckField(deck, field, before); buildQueue(); load(); renderBoxesKeep(); } catch (er) { say('Geri alınamadı.'); } });
    };
    if (reduce) { go(); return; }
    bigIn.classList.add('torn'); setTimeout(function () { bigIn.classList.remove('torn'); go(); }, 420);
    return item;
  };
  var renderBoxesKeep = function () {
    var b = $('.kbox[aria-current="true"] .kbox-n'), d = activeDeck(); if (!b || !d) return;
    var cs = cardsOf(d), due = cs.filter(function (c) { return c.due; }).length, mine = cs.filter(function (c) { return c.user; }).length;
    b.textContent = cs.length ? cs.length + ' kart' + (mine ? ' · ' + mine + ' senin' : '') + (due ? ' · bugün ' + due : '') : 'bu destede kart yok';
  };

  /* özetten seç → karta çevir / boşluk yap */
  var bubble = $('[data-bubble]'), lastSel = null, selT = 0;
  var selInfo = function () {
    var s = window.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null;
    var rg = s.getRangeAt(0); if (!sumEl.contains(rg.commonAncestorContainer)) return null;
    var t = s.toString().replace(/\s+/g, ' ').trim(); if (!t) return null;
    var n = rg.startContainer.nodeType === 3 ? rg.startContainer.parentNode : rg.startContainer;
    var p = n.closest ? n.closest('p, li') : null;
    return { text: t, rect: rg.getBoundingClientRect(), para: p ? p.textContent : t };
  };
  var showBubble = function (info) {
    bubble.hidden = false;
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight, cx = info.rect.left + info.rect.width / 2;
    var x = Math.max(8, Math.min(window.innerWidth - bw - 8, cx - bw / 2)), y = info.rect.top - bh - 14; if (y < 70) y = info.rect.bottom + 14;
    bubble.style.left = x + 'px'; bubble.style.top = y + 'px'; bubble.style.setProperty('--ax', Math.max(16, Math.min(bw - 16, cx - x)) + 'px');
  };
  document.addEventListener('selectionchange', function () {
    if (!root.classList.contains('active')) return;
    clearTimeout(selT);
    selT = setTimeout(function () { var info = selInfo(); if (!info) { if (!bubble.contains(document.activeElement)) bubble.hidden = true; return; } lastSel = info; showBubble(info); }, 220);
  });
  bubble.addEventListener('mousedown', function (e) { e.preventDefault(); });
  window.addEventListener('scroll', function () { if (!bubble.hidden) bubble.hidden = true; }, { passive: true });
  var sentenceOf = function (para, piece) {
    var i = para.indexOf(piece); if (i < 0) return piece;
    var a = Math.max(para.lastIndexOf('. ', i), para.lastIndexOf('! ', i), para.lastIndexOf('? ', i)); a = a < 0 ? 0 : a + 2;
    var m = para.slice(i + piece.length).search(/[.!?](\s|$)/), b = m < 0 ? para.length : i + piece.length + m + 1;
    return para.slice(a, b).trim();
  };
  var maker = $('[data-maker]'), mkF = $('[data-maker-f]'), mkErr = $('[data-mk-err]'), mkCloze = '', lastFocus = null;
  var openMaker = function (front, back, cloze, title) {
    if (!activeDeck()) return;
    lastFocus = document.activeElement; mkCloze = cloze || '';
    $('[data-mk-t]').textContent = title || 'yeni kart';
    $('[data-mk-src]').textContent = '— ' + baseName(activeDeck().documents && activeDeck().documents.file_name) + ' · özet';
    mkF.elements.front.value = front || ''; mkF.elements.back.value = back || ''; mkErr.hidden = true;
    if (typeof maker.showModal === 'function') maker.showModal(); else maker.setAttribute('open', '');
    setTimeout(function () { var f = mkF.elements.front; f.focus(); if (front) f.setSelectionRange(f.value.length, f.value.length); }, 40);
  };
  maker.addEventListener('close', function () { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); });
  $('[data-mk-cancel]').addEventListener('click', function () { maker.close(); });
  bubble.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mk]'); if (!b || !lastSel) return; var info = lastSel; bubble.hidden = true; window.getSelection().removeAllRanges();
    if (b.getAttribute('data-mk') === 'card') openMaker('', info.text, '', 'karta çevir');
    else {
      if (info.text.length > 60) { say('Boşluk için bir kelime ya da kısa bir ifade seç.'); return; }
      var sent = sentenceOf(info.para, info.text);
      openMaker(sent.replace(info.text, '_____'), sent, info.text, 'boşluk doldurma kartı');
    }
  });
  mkF.addEventListener('submit', async function (e) {
    e.preventDefault();
    var deck = activeDeck(); if (!deck) return;
    var f = mkF.elements.front.value.trim(), bk = mkF.elements.back.value.trim();
    if (!f) { mkErr.hidden = false; mkErr.textContent = 'ön yüze bir soru yaz.'; mkF.elements.front.focus(); return; }
    if (!bk) { mkErr.hidden = false; mkErr.textContent = 'arka yüz boş kalmasın.'; mkF.elements.back.focus(); return; }
    var isCloze = mkCloze && bk.indexOf(mkCloze) > -1 && f.indexOf('_____') > -1;
    var field = isCloze ? 'cloze_cards' : 'key_terms', before = (deck[field] || []).slice();
    var item = isCloze ? { id: 'u' + Date.now().toString(36), prompt: f, answer: mkCloze, full: bk, source: 'user', user: true } : { term: f, definition: bk, user: true };
    var sub = $('button[type="submit"]', mkF); sub.disabled = true;
    try { await saveDeckField(deck, field, before.concat([item])); }
    catch (er) { sub.disabled = false; mkErr.hidden = false; mkErr.textContent = 'kaydedemedim; bağlantını kontrol edip tekrar dene.'; console.warn(er); return; }
    sub.disabled = false;
    var from = mkF.querySelector('.ic-f').getBoundingClientRect(); maker.close();
    var boxEl = $('.kbox[aria-current="true"]');
    if (!reduce && boxEl) {
      var to = boxEl.getBoundingClientRect(), fl = document.createElement('div'); fl.className = 'flycard';
      fl.style.cssText = 'left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;height:' + from.height + 'px;background:#fff;border-top:4px solid #2F6BFF;border-radius:4px;box-shadow:0 20px 30px -16px rgba(13,24,56,.5);transform-origin:0 0';
      root.appendChild(fl);
      var k = (to.width - 30) / from.width;
      fl.animate([{ transform: 'none' }, { transform: 'translate(' + (to.left + 15 - from.left) + 'px,' + (to.top - 30 - from.top) + 'px) scale(' + k + ',' + k * 0.5 + ') rotate(-4deg)', offset: 0.75 }, { transform: 'translate(' + (to.left + 15 - from.left) + 'px,' + (to.top + 6 - from.top) + 'px) scale(' + k + ',' + k * 0.4 + ')', opacity: 0 }], { duration: 760, easing: 'cubic-bezier(.45,0,.3,1)' }).onfinish = function () { fl.remove(); boxEl.classList.remove('gulp'); void boxEl.offsetWidth; boxEl.classList.add('gulp'); };
    }
    buildQueue(); load(); renderBoxesKeep();
    say('Kart desteye katıldı; tekrarda karşına çıkacak.', async function () { try { await saveDeckField(deck, field, before); buildQueue(); load(); renderBoxesKeep(); } catch (er) { say('Geri alınamadı.'); } });
  });

  /* ---------- belgeden deste oluştur: mevcut özetleme akışı ---------- */
  var recipe = $('[data-recipe]'), rcF = $('[data-recipe-f]');
  var openRecipe = async function () {
    var sel = rcF.elements.doc; sel.innerHTML = '<option value="">yükleniyor…</option>';
    if (typeof recipe.showModal === 'function') recipe.showModal(); else recipe.setAttribute('open', '');
    try {
      var r = await sb().from('documents').select('id, file_name, status, uploaded_at').eq('user_id', me().id).order('uploaded_at', { ascending: false });
      var docs = (r.data || []).filter(function (d) { return d.status !== 'processing'; });
      sel.innerHTML = docs.length ? docs.map(function (d) { return '<option value="' + d.id + '">' + esc(baseName(d.file_name)) + (d.status === 'summarized' ? ' · özeti var' : '') + '</option>'; }).join('') : '<option value="">önce Belgelerim\'e bir belge yükle</option>';
      $('button[type="submit"]', rcF).disabled = !docs.length;
    } catch (er) { sel.innerHTML = '<option value="">belgeler yüklenemedi</option>'; }
  };
  root.addEventListener('click', function (e) { if (e.target.closest('.d-head [data-new-deck]')) openRecipe(); });
  $('[data-rc-cancel]').addEventListener('click', function () { recipe.close(); });
  rcF.addEventListener('submit', function (e) {
    e.preventDefault(); var id = rcF.elements.doc.value; recipe.close(); if (!id) return;
    if (typeof switchDashboardView === 'function') switchDashboardView('docs');
    setTimeout(function () { if (typeof summarizeDocument === 'function') summarizeDocument(id); }, 400);
  });

  /* ---------- dashboard.js'in kart kütüphanesi çizimleri yerine ---------- */
  if (typeof renderCardsLibraryList === 'function') { renderCardsLibraryList = renderBoxes; window.renderCardsLibraryList = renderBoxes; }
  if (typeof renderLibraryDetailPane === 'function') { renderLibraryDetailPane = function (id) { if (id) pick(id); }; window.renderLibraryDetailPane = renderLibraryDetailPane; }
  if (typeof selectLibraryCard === 'function') { selectLibraryCard = pick; window.selectLibraryCard = pick; }
  if (typeof loadCardsLibrary === 'function') {
    var origLib = loadCardsLibrary;
    loadCardsLibrary = async function () {
      var sec = $('#cards-list-section'); if (sec && !sec.children.length) sec.innerHTML = '<p class="none">kutular açılıyor…</p>';
      var r = await origLib.apply(this, arguments);
      var o = $('#cards-filter-course option[value="all"]'); if (o) o.textContent = 'tüm dersler';
      renderBoxes(window.filteredLibraryCardsList || decks());
      return r;
    };
    window.loadCardsLibrary = loadCardsLibrary;
  }
  paintAll();
})();

/* ================= KAYNAKLA ÇALIŞ (tam tasarım, gerçek belge + özet + Acadia) =================
   Veriyi ve sohbeti dashboard.js'in kendi Kaynakla Çalış kodu yürütür (loadSourceHubView,
   loadSourceHubCard, chat-with-document fonksiyonu, görsel ekleme, "çözümümü kontrol et",
   Mermaid diyagramları, dipnotla belgeye atlama). Burada yalnızca çizim değişir ve tasarımın
   ekleri gelir: bölüm sekmeleri, okuma işaretleri, seçip sor, alıntı, karta çevir. */
(function () {
  'use strict';
  var root = document.getElementById('sourcehub-view');
  if (!root || !root.classList.contains('axy')) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var me = function () { return lsafe(function () { return currentUser; }, null) || window.currentUser || null; };
  var sb = function () { return typeof supabaseClient !== 'undefined' ? supabaseClient : null; };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var baseName = function (n) { n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, ''); var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1]; return n.replace(/_+/g, ' ').trim() || 'İsimsiz belge'; };
  var get = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var STY = { standard: 'STANDART', bullet: 'MADDELER', structured: 'YAPILANDIRILMIŞ', simplified: 'SADE', exam: 'SINAV ODAKLI' };
  var TC = ['#2F6BFF', '#1A2A5C', '#5B8CFF', '#33478A', '#7FA6FF', '#0D1838', '#4A6FD8'];
  $$('.land').forEach(function (el, i) { el.style.setProperty('--hr', (((i * 37) % 11 - 5) * 0.3).toFixed(2) + 'deg'); el.style.setProperty('--hx', (((i * 53) % 9 - 4) * 2) + 'px'); });

  var cards = function () { return lsafe(function () { return sourceHubCards; }, []) || []; };
  var activeId = function () { return lsafe(function () { return sourceHubActiveCardId; }, null); };
  var active = function () { var id = activeId(); return cards().filter(function (c) { return c.id === id; })[0] || null; };

  /* bildirim */
  var toast = $('[data-toast]'), toastT = $('[data-toast-t]'), toastA = $('[data-toast-a]'), toastTimer = 0;
  var say = function (t, link) { toastT.textContent = t; toastA.hidden = !link; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; }, 5600); };
  toastA.addEventListener('click', function (e) { e.preventDefault(); toast.hidden = true; if (typeof switchDashboardView === 'function') switchDashboardView('cards'); });
  $('[data-go-docs]').addEventListener('click', function () { if (typeof switchDashboardView === 'function') switchDashboardView('docs'); });

  /* ---------- belge kenara konabilir ---------- */
  var desk = $('[data-desk]'), docOpen = $('[data-doc-open]'), docClose = $('[data-doc-close]');
  var setDoc = function (on, focus) {
    desk.classList.toggle('no-doc', !on); docOpen.hidden = on || desk.style.display === 'none'; put('acadex.kaynak.nodoc', !on);
    if (focus) (on ? docClose : docOpen).focus();
  };
  docClose.addEventListener('click', function () { setDoc(false, true); });
  docOpen.addEventListener('click', function () { setDoc(true, true); });
  /* dipnota dokununca belge kapalıysa açılsın (belge o sayfaya atlar) */
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#sourcehub-view .footnote-marker') && desk.classList.contains('no-doc')) setDoc(true); }, true);

  /* ---------- özet: bölüm sekmeleri, okuma işaretleri ---------- */
  var secsEl = $('[data-secs]'), tabsEl = $('[data-tabs]'), sumEl = $('#sourcehub-summary-text');
  var readKey = function () { return 'acadex.kaynak.read.' + (activeId() || ''); };
  var markKey = function () { return 'acadex.kaynak.marks.' + (activeId() || ''); };
  var readS = [], marks = {};
  var paintRead = function () {
    $$('[data-tk]', tabsEl).forEach(function (t) { t.textContent = readS.indexOf(+t.getAttribute('data-tk')) > -1 ? '✓' : ''; });
    $$('[data-rd]', secsEl).forEach(function (t) { t.textContent = readS.indexOf(+t.getAttribute('data-rd')) > -1 ? 'okundu' : ''; });
  };
  var openSec = function (i, scroll) {
    $$('.sec-b', secsEl).forEach(function (b) {
      var k = +b.getAttribute('data-sec'), on = k === i && b.getAttribute('aria-expanded') !== 'true', c = $('#axy-secc-' + k);
      b.setAttribute('aria-expanded', String(on)); c.hidden = !on;
      var t = $('[data-tab="' + k + '"]', tabsEl); if (t) t.setAttribute('aria-selected', String(on));
      if (on && !reduce) { c.classList.remove('unfold'); void c.offsetWidth; c.classList.add('unfold'); }
    });
    if (readS.indexOf(i) < 0) { readS.push(i); put(readKey(), readS); paintRead(); }
    if (scroll) $('#axy-sec-' + i).scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  };
  secsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-sec]'); if (b) openSec(+b.getAttribute('data-sec')); });
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; var i = +b.getAttribute('data-tab'); if ($('[data-sec="' + i + '"]').getAttribute('aria-expanded') === 'true') return; openSec(i, true); });

  /* özet paragraflarını cümlelere böl (yalnızca düz metinli paragraflar; dipnotlu/biçimli olanlar tek parça) */
  var splitSentences = function () {
    var n = 0;
    $$('p, li', sumEl).forEach(function (p) {
      if (p.closest('.sn') || p.querySelector('p, li, ul, ol, table')) return;
      var simple = Array.prototype.every.call(p.childNodes, function (c) { return c.nodeType === 3 || (c.nodeType === 1 && /^(STRONG|B|EM|I|BR)$/.test(c.tagName)); });
      if (simple && p.children.length === 0) {
        var parts = p.textContent.match(/[^.!?…]+(?:[.!?…]+["”’)]*|$)\s*/g) || [p.textContent];
        p.innerHTML = parts.filter(function (s) { return s.trim(); }).map(function (s) { return '<span class="sn" data-s="' + (n++) + '">' + esc(s.trim()) + '</span>'; }).join(' ');
      } else {
        var w = document.createElement('span'); w.className = 'sn'; w.setAttribute('data-s', n++);
        while (p.firstChild) w.appendChild(p.firstChild); p.appendChild(w);
      }
    });
    $$('.sn', sumEl).forEach(function (s) { s.tabIndex = 0; s.setAttribute('role', 'button'); s.setAttribute('aria-label', 'Cümleyi işaretle: ' + s.textContent.slice(0, 60)); });
    paintMarks();
  };
  var paintMarks = function () { $$('.sn', sumEl).forEach(function (s) { var m = marks[s.getAttribute('data-s')]; if (m) s.setAttribute('data-m', m); else s.removeAttribute('data-m'); }); };

  var renderSummary = function (card, docName) {
    readS = get(readKey(), []); marks = get(markKey(), {});
    $('[data-doc-name]').textContent = baseName(docName); $('[data-doc-name]').title = docName || '';
    /* etiketler */
    var tags = [STY[card.summary_style] || 'STANDART', card.summary_language === 'tr' ? 'TÜRKÇE' : 'İNGİLİZCE'];
    if (typeof getDocumentTypeBadgeHtml === 'function') { var d = document.createElement('div'); d.innerHTML = getDocumentTypeBadgeHtml(card.document_type) || ''; var tt = d.textContent.replace(/[^\wçğıöşüÇĞİÖŞÜ\s]/g, '').trim(); if (tt) tags.push(tt.toLocaleUpperCase('tr')); }
    if (card.course_tag) tags.push(String(card.course_tag));
    $('#sourcehub-summary-badges').innerHTML = tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    /* bölümler */
    var secs = Array.isArray(card.sections) ? card.sections.filter(function (s) { return s && (s.heading || s.summary); }) : [];
    $('[data-secs-w]').hidden = !secs.length;
    var fmt = function (t) { return typeof formatSummaryText === 'function' ? formatSummaryText(t || '', card.footnotes) : esc(t); };
    secsEl.innerHTML = secs.map(function (s, i) {
      var kps = Array.isArray(s.key_points) ? s.key_points.filter(Boolean) : [], c = TC[i % TC.length];
      return '<li class="sec" style="--tc:' + c + '" id="axy-sec-' + i + '"><button type="button" class="sec-b" aria-expanded="false" aria-controls="axy-secc-' + i + '" data-sec="' + i + '"><span class="no">' + (i + 1) + '</span><span class="st-t">' + esc(s.heading || ('Bölüm ' + (i + 1))) + '</span><span class="rd" data-rd="' + i + '"></span><span class="ch" aria-hidden="true">⌄</span></button>' +
        '<div class="sec-c" id="axy-secc-' + i + '" hidden>' + fmt(s.summary) + (kps.length ? '<div class="kp"><b>önemli noktalar</b><ul>' + kps.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' : '') + '</div></li>';
    }).join('');
    tabsEl.innerHTML = secs.slice(0, 12).map(function (s, i) { return '<button type="button" class="tab" role="tab" aria-selected="false" style="--tc:' + TC[i % TC.length] + '" data-tab="' + i + '" aria-label="Bölüm ' + (i + 1) + ': ' + esc(s.heading || '') + '">' + (i + 1) + '<span class="tk" data-tk="' + i + '"></span></button>'; }).join('');
    tabsEl.hidden = !secs.length;
    /* giriş özeti */
    sumEl.innerHTML = fmt(card.summary) || '<p>Bu belge için özet yok.</p>';
    splitSentences(); paintRead();
    /* önemli noktalar */
    var kp = card.key_points || [];
    $('[data-pts-w]').hidden = !kp.length;
    $('#sourcehub-points-container').innerHTML = kp.map(function (p) { return '<li>' + (typeof formatFootnoteMarkers === 'function' ? formatFootnoteMarkers(p, card.footnotes) : esc(p)) + '</li>'; }).join('');
    if (typeof renderStudyCardImagesGallery === 'function') renderStudyCardImagesGallery(card.chat_attachments || [], card.id, 'sourcehub-images-section', 'sourcehub-images-container');
  };

  /* okuma işareti: ✓ anladım, ? sorum var */
  var mpop = $('[data-mpop]'), mTarget = null;
  var showPop = function (s) {
    mTarget = s; mpop.hidden = false; $('[data-mk="x"]', mpop).hidden = !s.getAttribute('data-m');
    var r = s.getBoundingClientRect(), w = mpop.offsetWidth, h = mpop.offsetHeight;
    mpop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px'; mpop.style.top = (r.top - h - 10 < 70 ? r.bottom + 10 : r.top - h - 10) + 'px';
    $('button', mpop).focus();
  };
  var hidePop = function () { mpop.hidden = true; mTarget = null; };
  sumEl.addEventListener('click', function (e) { if (e.target.closest('a, sup, button')) return; var s = e.target.closest('.sn'); if (!s) return; var sel = window.getSelection(); if (sel && !sel.isCollapsed) return; showPop(s); });
  sumEl.addEventListener('keydown', function (e) { var s = e.target.closest('.sn'); if (s && e.target === s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showPop(s); } });
  mpop.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mk]'); if (!b || !mTarget) return; var k = b.getAttribute('data-mk'), s = mTarget, id = s.getAttribute('data-s');
    if (k === 'x') delete marks[id]; else marks[id] = k;
    put(markKey(), marks); paintMarks(); hidePop(); s.focus();
    if (k === 'q') { attach(s.textContent.trim()); say('Sorduğun cümle soru kutusuna iliştirildi; sorunu yaz.'); }
  });
  document.addEventListener('click', function (e) { if (!mpop.hidden && !e.target.closest('[data-mpop]') && !e.target.closest('#sourcehub-view .sn')) hidePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mpop.hidden) { var s = mTarget; hidePop(); if (s) s.focus(); } });

  /* ---------- seç → Acadia'ya sor ---------- */
  var bubble = $('[data-bubble]'), lastSel = '', selT = 0, paper = $('.sumf-paper');
  document.addEventListener('selectionchange', function () {
    if (!root.classList.contains('active')) return;
    clearTimeout(selT);
    selT = setTimeout(function () {
      var s = window.getSelection(); if (!s || s.isCollapsed || !s.rangeCount || !paper.contains(s.getRangeAt(0).commonAncestorContainer)) { if (!bubble.contains(document.activeElement)) bubble.hidden = true; return; }
      var t = s.toString().replace(/\s+/g, ' ').trim(); if (!t) return; lastSel = t.slice(0, 500); hidePop();
      var r = s.getRangeAt(0).getBoundingClientRect(); bubble.hidden = false;
      var w = bubble.offsetWidth, h = bubble.offsetHeight, cx = r.left + r.width / 2, x = Math.max(8, Math.min(window.innerWidth - w - 8, cx - w / 2));
      bubble.style.left = x + 'px'; bubble.style.top = (r.top - h - 14 < 70 ? r.bottom + 14 : r.top - h - 14) + 'px'; bubble.style.setProperty('--ax', Math.max(16, Math.min(w - 16, cx - x)) + 'px');
    }, 220);
  });
  bubble.addEventListener('mousedown', function (e) { e.preventDefault(); });
  window.addEventListener('scroll', function () { if (!bubble.hidden) bubble.hidden = true; }, { passive: true });
  bubble.addEventListener('click', function () { if (!lastSel) return; attach(lastSel); window.getSelection().removeAllRanges(); bubble.hidden = true; });

  /* ---------- soru kutusu: alıntı iliştirme, Enter ile gönder ---------- */
  var form = $('#sourcehub-chat-input-form'), qEl = $('#sourcehub-chat-input'), att = $('[data-att]'), attText = '';
  var attach = function (t) {
    attText = t; att.hidden = false; att.innerHTML = '“' + esc(t.length > 220 ? t.slice(0, 220) + '…' : t) + '”<button type="button" aria-label="Alıntıyı kaldır" data-att-x="">×</button>';
    qEl.focus();
  };
  att.addEventListener('click', function (e) { if (e.target.closest('[data-att-x]')) { attText = ''; att.hidden = true; qEl.focus(); } });
  /* dashboard.js'in gönderme dinleyicisinden ÖNCE çalışır: alıntıyı sorunun başına ekler */
  document.addEventListener('submit', function (e) {
    if (e.target !== form) return;
    var q = qEl.value.trim();
    if (attText) { qEl.value = '“' + attText + '”\n\n' + (q || 'Bu kısmı açıklar mısın?'); attText = ''; att.hidden = true; }
    qEl.style.height = '';
  }, true);
  qEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); } });
  qEl.addEventListener('input', function () { qEl.style.height = ''; qEl.style.height = Math.min(140, qEl.scrollHeight) + 'px'; });

  /* ---------- sohbet balonları: kâğıt mektuplar ---------- */
  var feed = $('#sourcehub-chat-messages');
  var tilt = function () { return ((Math.random() * 1.6) - 0.8).toFixed(2); };
  var lastQ = '';
  var writeOut = function (el) {
    if (reduce) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) { var pn = n.parentNode; if (n.data.trim() && !pn.closest('.acts, button, .katex, svg, sup')) nodes.push(n); }
    var spans = [];
    nodes.forEach(function (tn) {
      var frag = document.createDocumentFragment();
      tn.data.split(/(\s+)/).forEach(function (w) { if (!w) return; if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; } var s = document.createElement('span'); s.className = 'w'; s.style.opacity = '0'; s.textContent = w; frag.appendChild(s); spans.push(s); });
      tn.parentNode.replaceChild(frag, tn);
    });
    var step = spans.length > 260 ? 6 : 24;
    spans.forEach(function (s, i) { setTimeout(function () { s.style.opacity = ''; s.classList.add('in'); if (i % 8 === 0) feed.scrollTop = feed.scrollHeight; }, step * i); });
  };
  var dress = function (bub, role, text, saveable) {
    bub.removeAttribute('style');
    bub.className = 'msg ' + (role === 'user' ? 'me' : 'ac');
    bub.style.setProperty('--r', tilt() + 'deg');
    if (role === 'user') {
      lastQ = text;
      var td = bub.lastElementChild && bub.lastElementChild.tagName === 'DIV' && !bub.lastElementChild.querySelector('button') ? bub.lastElementChild : null;
      if (!td) $$(':scope > div', bub).forEach(function (d) { if (!td && !d.querySelector('button')) td = d; });
      var m = String(text).match(/^“([\s\S]*?)”\n\n([\s\S]*)$/);
      if (td && m) td.innerHTML = '<span class="quote">“' + esc(m[1].length > 160 ? m[1].slice(0, 160) + '…' : m[1]) + '”</span>' + esc(m[2]);
      $$(':scope > div', bub).forEach(function (d) { if (d.querySelector('button')) { d.removeAttribute('style'); d.className = 'acts'; } });
      return;
    }
    $$(':scope > div', bub).forEach(function (d) {
      if (d.querySelector('button') && !d.querySelector('svg, img')) {
        d.removeAttribute('style'); d.className = 'acts';
        $$('button', d).forEach(function (b) { b.textContent = b.textContent.replace(/^[^\wçğıöşüÇĞİÖŞÜ]+/, '').replace(/^Deftere Ekle$/, 'deftere').replace(/^Add to Notebook$/, 'deftere'); });
      }
    });
    if (saveable && text && text.trim()) {
      var row = $('.acts', bub);
      if (!row) { row = document.createElement('div'); row.className = 'acts'; bub.appendChild(row); }
      var cb = document.createElement('button'); cb.type = 'button'; cb.textContent = 'karta çevir';
      var q = lastQ, a = text;
      cb.addEventListener('click', function () { toCard(q, a, cb); });
      row.appendChild(cb);
    } else if (!saveable && text && /tekrar deneyin|try again|kota|limit/i.test(text)) bub.classList.add('err');
    if (bub.parentNode === feed && feed.children.length > 1) { bub.classList.add('drop'); if (saveable) writeOut(bub); }
  };
  if (typeof renderSourceHubChatMessage === 'function') {
    var origMsg = renderSourceHubChatMessage;
    renderSourceHubChatMessage = function (role, text, citations, imageDataUrl, visionUsed, mermaidCode, saveable) {
      if (saveable === undefined) saveable = true;
      var before = feed.lastElementChild;
      var r = origMsg.apply(this, arguments);
      var bub = feed.lastElementChild;
      if (bub && bub !== before) dress(bub, role, text, role !== 'user' && saveable);
      return r;
    };
    window.renderSourceHubChatMessage = renderSourceHubChatMessage;
  }

  /* Acadia'nın cevabını bilgi kartına çevir: soru ön yüz, cevap arka yüz (bu destenin kartlarına eklenir) */
  var toCard = async function (q, a, btn) {
    var card = active(); if (!card || !sb()) return;
    var front = String(q || '').replace(/^“[\s\S]*?”\n\n/, '').trim().slice(0, 300) || 'Bu kısım ne anlatıyor?';
    var back = String(a || '').replace(/\[\d+\]/g, '').trim(); if (back.length > 600) back = back.slice(0, 597) + '…';
    var list = (card.key_terms || []).slice(); list.push({ term: front, definition: back, user: true, source: 'acadia' });
    btn.disabled = true;
    try {
      var r = await sb().from('study_cards').update({ key_terms: list }).eq('id', card.id);
      if (r.error) throw r.error;
      card.key_terms = list;
      var lib = lsafe(function () { return libraryCards; }, []) || []; lib.forEach(function (c) { if (c.id === card.id) c.key_terms = list; });
      btn.textContent = 'kart oldu ✓';
      say('Bilgi kartı yapıldı: soru ön yüzde, Acadia\'nın cevabı arka yüzde.', true);
    } catch (er) { console.warn(er); btn.disabled = false; say('Kart yapılamadı; bağlantını kontrol edip tekrar dene.'); }
  };

  /* temizle */
  $('[data-clear]').addEventListener('click', function () {
    var had = lsafe(function () { return sourceHubChatHistory.length; }, 0);
    if (typeof clearSourceHubChat === 'function') clearSourceHubChat();
    attText = ''; att.hidden = true;
    say(had ? 'Sohbet temizlendi.' : 'Sohbet zaten boş.');
  });

  /* ---------- dashboard.js'in Kaynakla Çalış çizimleri yerine ---------- */
  if (typeof renderSourceHubSummary === 'function') { renderSourceHubSummary = renderSummary; window.renderSourceHubSummary = renderSummary; }
  var afterLoad = function () {
    var has = cards().length;
    $('[data-pick-w]').hidden = !has;
    var sel = $('#sourcehub-card-select');
    $$('option', sel).forEach(function (o) { var c = cards().filter(function (x) { return x.id === o.value; })[0]; if (c) o.textContent = baseName(c.documents && c.documents.file_name) + ' — ' + ((STY[c.summary_style] || 'STANDART').toLocaleLowerCase('tr')) + ' · ' + new Date(c.created_at || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); });
    setDoc(!get('acadex.kaynak.nodoc', false));
    if (!has) docOpen.hidden = true;
  };
  if (typeof loadSourceHubView === 'function') {
    var origView = loadSourceHubView;
    loadSourceHubView = async function () {
      if (typeof initSourceHubChatForm === 'function') initSourceHubChatForm();
      var r = await origView.apply(this, arguments);
      afterLoad();
      return r;
    };
    window.loadSourceHubView = loadSourceHubView;
  }
  setDoc(!get('acadex.kaynak.nodoc', false)); docOpen.hidden = true;
})();

/* ================= SINAV PLATFORMU (tam tasarım, gerçek sınavlar) =================
   Soruları dashboard.js'in kendi akışı üretir ve okur: generateExam → generate-exam,
   ipucu → get-exam-hint, teslim → grade-exam, sonra rozet ve planlayıcıya tekrar hatırlatması.
   Burada çizim değişir: sınav takvimi (study_events · sınav), ders sıraları, karne
   (exams tablosundan), hata defteri (yanlış cevaplar + zayıf konular), sınav salonu
   (kitapçık, optik form, saat) ve kırmızı kalemli sonuç kâğıdı. */
(function () {
  'use strict';
  var root = document.getElementById('exams-view');
  if (!root || !root.classList.contains('axs')) return;
  var layer = document.getElementById('axs-layer');
  if (layer) document.body.appendChild(layer);
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $L = function (s) { return layer.querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var me = function () { return lsafe(function () { return currentUser; }, null) || window.currentUser || null; };
  var prof = function () { return lsafe(function () { return currentUserProfile; }, null) || {}; };
  var sb = function () { return typeof supabaseClient !== 'undefined' ? supabaseClient : null; };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rich = function (t) { return typeof renderMathInText === 'function' ? renderMathInText(String(t == null ? '' : t)) : esc(t); };
  var baseName = function (n) { n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, ''); var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1]; return n.replace(/_+/g, ' ').trim() || 'İsimsiz belge'; };
  var get = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var MON = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
  var dloc = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var today = function () { return dloc(new Date()); };
  var dayDiff = function (s) { var a = new Date(String(s).slice(0, 10) + 'T00:00:00'), b = new Date(today() + 'T00:00:00'); return Math.round((a - b) / 864e5); };
  var dshort = function (s) { var d = new Date(s); return isNaN(d) ? '' : pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2); };
  var TYPE = { classic: 'klasik', test: 'test', mixed: 'karışık', calculation: 'hesaplama' };
  var DIFF = { easy: 'kolay', medium: 'orta', hard: 'zor' };
  var QT = { multiple_choice: 'test', true_false: 'doğru-yanlış', fill_blank: 'boşluk', calculation: 'hesaplama', open_ended: 'açık uçlu' };
  $$('.land').forEach(function (el, i) { el.style.setProperty('--hr', (((i * 37) % 11 - 5) * 0.3).toFixed(2) + 'deg'); el.style.setProperty('--hx', (((i * 53) % 9 - 4) * 2) + 'px'); });

  /* bildirim */
  var toast = $L('[data-toast]'), toastT = $L('[data-toast-t]'), toastB = $L('[data-toast-b]'), toastA = $L('[data-toast-a]'), toastTimer = 0, undoFn = null;
  var say = function (t, undo, link) { toastT.textContent = t; undoFn = undo || null; toastB.hidden = !undo; toastA.hidden = !link; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; undoFn = null; }, 6000); };
  toastB.addEventListener('click', function () { if (undoFn) undoFn(); toast.hidden = true; undoFn = null; });
  toastA.addEventListener('click', function (e) { e.preventDefault(); toast.hidden = true; closeHall(); if (typeof switchDashboardView === 'function') switchDashboardView('planner'); });

  /* ---------- veri ---------- */
  var EX = [], EV = [], loading = null;
  var cards = function () { return lsafe(function () { return cachedExamCards; }, []) || []; };
  var hoca = get('acadex.sinav.prof', {});
  var hidden = get('acadex.sinav.hidden', []);
  var done = get('acadex.sinav.errs.done', []);
  var cardById = function (id) { return cards().filter(function (c) { return String(c.id) === String(id); })[0] || null; };
  var keyOfCard = function (c) { return c.course_tag && String(c.course_tag).trim() ? 'c:' + String(c.course_tag).trim().toUpperCase() : 's:' + c.id; };
  var keyOfExam = function (e) {
    if (e.source_type === 'course' && e.course_code) return 'c:' + String(e.course_code).toUpperCase();
    var c = cardById(e.study_card_id), tag = (e.study_cards && e.study_cards.course_tag) || (c && c.course_tag);
    if (tag && String(tag).trim()) return 'c:' + String(tag).trim().toUpperCase();
    return 's:' + e.study_card_id;
  };
  var nameOfKey = function (k) {
    if (hoca[k] && hoca[k].name) return hoca[k].name;
    if (k.indexOf('c:') === 0) return k.slice(2);
    var c = cardById(k.slice(2)); if (c) return baseName(c.documents && c.documents.file_name);
    var e = EX.filter(function (x) { return 's:' + x.study_card_id === k; })[0];
    return e && e.study_cards && e.study_cards.documents ? baseName(e.study_cards.documents.file_name) : 'Belge';
  };
  var desks = function () {
    var m = {};
    cards().forEach(function (c) { var k = keyOfCard(c); (m[k] = m[k] || { key: k, cards: [], ex: [], last: 0 }).cards.push(c.id); m[k].last = Math.max(m[k].last, new Date(c.created_at || 0).getTime() / 10); });
    EX.forEach(function (e) { var k = keyOfExam(e); (m[k] = m[k] || { key: k, cards: [], ex: [], last: 0 }).ex.push(e); m[k].last = Math.max(m[k].last, new Date(e.completed_at || 0).getTime()); });
    return Object.keys(m).map(function (k) { var d = m[k]; d.name = nameOfKey(k); d.code = k.indexOf('c:') === 0 ? k.slice(2) : null; return d; })
      .filter(function (d) { return hidden.indexOf(d.key) < 0; }).sort(function (a, b) { return b.last - a.last; });
  };
  var loadData = function () {
    if (!me() || !sb()) return Promise.resolve();
    if (loading) return loading;
    loading = Promise.all([
      sb().from('exams').select('*, study_cards(course_tag, documents(file_name))').eq('user_id', me().id).not('completed_at', 'is', null).order('completed_at', { ascending: true }).limit(300),
      sb().from('study_events').select('*').eq('user_id', me().id).eq('event_type', 'exam').order('event_date', { ascending: true })
    ]).then(function (r) {
      if (r[0].error) console.warn('acadex-ink: sınavlar yüklenemedi', r[0].error); else EX = (r[0].data || []).filter(function (e) { return e.completed_at; });
      if (r[1].error) console.warn('acadex-ink: takvim yüklenemedi', r[1].error); else EV = r[1].data || [];
    }).catch(function (e) { console.warn(e); }).then(function () { loading = null; paintAll(); });
    return loading;
  };

  /* ---------- kapı: sınav takvimi ---------- */
  var calEl = $('[data-cal]'), calTip = $('[data-cal-tip]');
  var paintCal = function () {
    var list = EV.filter(function (e) { return e.event_date && dayDiff(e.event_date) >= -2; }).slice(0, 10);
    if (!list.length) { calEl.innerHTML = '<li class="sn-cal-empty">takvim boş. vize ve final tarihlerini as; geri sayım burada görünür.</li>'; calTip.textContent = ''; return; }
    calEl.innerHTML = list.map(function (e, i) {
      var n = dayDiff(e.event_date), d = new Date(e.event_date.slice(0, 10) + 'T00:00:00'), cls = n < 0 ? ' past' : n <= 7 ? ' soon' : '';
      var when = n < 0 ? (-n) + ' gün önceydi' : n === 0 ? 'bugün!' : n === 1 ? 'yarın' : n + ' gün kaldı';
      return '<li class="sn-tk' + cls + '" style="--r:' + (((i * 7) % 5) - 2) * 0.6 + 'deg"><span class="sn-tk-d"><b>' + d.getDate() + '</b><small>' + MON[d.getMonth()] + '</small></span><span class="sn-tk-b"><b>' + esc(e.title) + '</b><span>' + when + '</span></span><button type="button" class="sn-tk-x" data-ev-x="' + esc(e.id) + '" aria-label="' + esc(e.title) + ' tarihini kaldır">×</button></li>';
    }).join('');
    var next = list.filter(function (e) { return dayDiff(e.event_date) >= 0; })[0];
    calTip.textContent = next ? (dayDiff(next.event_date) === 0 ? 'bugün ' + next.title + '. kolay gelsin!' : 'en yakını ' + next.title + ': ' + dayDiff(next.event_date) + ' gün. ' + (dayDiff(next.event_date) <= 7 ? 'her gün bir deneme iyi gider.' : 'şimdiden haftada iki deneme yeter.')) : '';
  };
  calEl.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-ev-x]'); if (!b) return;
    var ev = EV.filter(function (x) { return String(x.id) === b.getAttribute('data-ev-x'); })[0]; if (!ev) return;
    var r = await sb().from('study_events').delete().eq('id', ev.id);
    if (r.error) { say('Tarih kaldırılamadı; tekrar dene.'); return; }
    EV = EV.filter(function (x) { return x !== ev; }); paintCal();
    say(ev.title + ' takvimden kalktı.', async function () {
      var row = {}; Object.keys(ev).forEach(function (k) { if (k !== 'id' && k !== 'created_at') row[k] = ev[k]; });
      var r2 = await sb().from('study_events').insert(row).select(); if (!r2.error) { EV.push((r2.data && r2.data[0]) || ev); EV.sort(function (a, b) { return a.event_date < b.event_date ? -1 : 1; }); paintCal(); }
    });
  });
  var calDlg = $('[data-caldlg]'), calF = $('[data-calf]');
  $('[data-cal-add]').addEventListener('click', function () {
    $('#axs-courses').innerHTML = desks().map(function (d) { return '<option value="' + esc(d.name) + '">'; }).join('');
    calF.reset(); $('[data-cl-date]').min = today(); calDlg.showModal(); setTimeout(function () { $('[data-cl-course]').focus(); }, 30);
  });
  calF.addEventListener('submit', async function (e) {
    e.preventDefault();
    var course = $('[data-cl-course]').value.trim(), kind = $('[data-cl-kind]').value, date = $('[data-cl-date]').value; if (!course || !date) return;
    var sub = $('button[type="submit"]', calF); sub.disabled = true;
    var r = await sb().from('study_events').insert({ user_id: me().id, title: course + ' ' + kind, event_date: date, event_type: 'exam', notes: '', is_done: false }).select();
    sub.disabled = false;
    if (r.error) { say('Tarih eklenemedi; tekrar dene.'); return; }
    calDlg.close(); EV.push((r.data && r.data[0]) || { id: 'n' + Date.now(), title: course + ' ' + kind, event_date: date, event_type: 'exam' });
    EV.sort(function (a, b) { return a.event_date < b.event_date ? -1 : 1; }); paintCal();
    say('Kapıya asıldı; planlayıcına da düştü.', null, true);
  });

  /* ---------- sıralar ---------- */
  var deskEl = $('[data-desks]');
  var spark = function (vals, target) {
    var w = 120, h = 34, n = vals.length, x = function (i) { return n < 2 ? w / 2 : 4 + i * (w - 8) / (n - 1); }, y = function (v) { return 3 + (100 - v) * (h - 6) / 100; };
    var p = vals.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path class="tg" d="M0 ' + y(target).toFixed(1) + ' H' + w + '"/>' + (n > 1 ? '<path d="' + p + '"/>' : '') + '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(vals[n - 1]).toFixed(1) + '" r="3.2"/></svg>';
  };
  var paintDesks = function () {
    var ds = desks();
    deskEl.innerHTML = ds.map(function (d, i) {
      var h = hoca[d.key] || {}, ex = d.ex, last = ex.length ? ex[ex.length - 1].grade : null, tgt = +(h.target || 70);
      var chips = [h.type ? TYPE[h.type] : '', h.diff ? DIFF[h.diff] : '', h.lang ? (h.lang === 'tr' ? 'TR' : 'EN') : '', h.sim ? 'süreli' : ''].filter(Boolean);
      var sticky = (h.who || h.note || chips.length) ? '<div class="sn-sticky"><b>' + esc(h.who || 'hocanın tarzı') + '</b>' + (chips.length ? '<span class="chips">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</span>' : '') + (h.note ? '<i>' + esc(h.note) + '</i>' : '') + '</div>' : '';
      var src = [d.cards.length ? d.cards.length + ' belge' : (d.code ? 'ders ağacı' : ''), ex.length ? ex.length + ' deneme' : ''].filter(Boolean).join(' · ');
      return '<div class="sn-desk" style="--i:' + i + '"><div class="sn-top" style="--r:' + (((i * 5) % 5) - 2) * 0.4 + 'deg">' +
        '<h3 class="sn-dname">' + esc(d.name) + '</h3>' + (src ? '<p class="sn-dsrc">' + esc(src) + '</p>' : '') + sticky +
        '<div class="sn-dstat">' + (ex.length ? '<b>' + last + '</b><small>son<br>deneme</small>' + spark(ex.slice(-8).map(function (x) { return +x.grade || 0; }), tgt) : '<span class="none">henüz deneme yok · hedef ' + tgt + '</span>') + '</div>' +
        '<div class="sn-dbtns"><button type="button" class="btn btn-blue" data-try="' + esc(d.key) + '">deneme yap</button><button type="button" class="sn-ghost" data-prof="' + esc(d.key) + '">hoca dosyası</button></div>' +
        '</div><div class="sn-legs" aria-hidden="true"></div>' + (i % 3 === 0 ? '<i class="sn-pencil" aria-hidden="true"></i>' : '') + '</div>';
    }).join('') + '<div class="sn-desk add" style="--i:' + ds.length + '"><div class="sn-top"><button type="button" data-add-desk="">+ ' + (ds.length ? 'ders ağacından sıra aç' : 'ilk sıranı aç: ders ağacından bir ders seç') + '</button></div><div class="sn-legs" aria-hidden="true"></div></div>';
  };
  deskEl.addEventListener('click', function (e) {
    var t = e.target.closest('[data-try]'); if (t) { openBuild(t.getAttribute('data-try')); return; }
    var p = e.target.closest('[data-prof]'); if (p) { openProf(p.getAttribute('data-prof')); return; }
    if (e.target.closest('[data-add-desk]')) openBuild(null, 'course');
  });

  /* hoca dosyası */
  var pfDlg = $('[data-profdlg]'), pfF = $('[data-proff]'), pfKey = null;
  var openProf = function (k) {
    pfKey = k; var h = hoca[k] || {};
    $('[data-pf-h]').textContent = nameOfKey(k) + ' · hocanın tarzı';
    $('[data-pf-name]').value = nameOfKey(k); $('[data-pf-who]').value = h.who || ''; $('[data-pf-type]').value = h.type || 'classic';
    $('[data-pf-diff]').value = h.diff || 'medium'; $('[data-pf-target]').value = String(h.target || 70); $('[data-pf-lang]').value = h.lang || 'en';
    $('[data-pf-sim]').checked = !!h.sim; $('[data-pf-note]').value = h.note || '';
    pfDlg.showModal();
  };
  pfF.addEventListener('submit', function (e) {
    e.preventDefault(); if (!pfKey) return;
    var nm = $('[data-pf-name]').value.trim();
    hoca[pfKey] = { name: nm && nm !== (pfKey.indexOf('c:') === 0 ? pfKey.slice(2) : '') ? nm : '', who: $('[data-pf-who]').value.trim(), type: $('[data-pf-type]').value, diff: $('[data-pf-diff]').value, target: +$('[data-pf-target]').value, lang: $('[data-pf-lang]').value, sim: $('[data-pf-sim]').checked, note: $('[data-pf-note]').value.trim() };
    if (hoca[pfKey].name === nameOfKeyRaw(pfKey)) hoca[pfKey].name = '';
    put('acadex.sinav.prof', hoca); pfDlg.close(); paintAll(); say('Hoca dosyası kaydedildi; yeni denemeler bu tarza göre hazırlanır.');
  });
  var nameOfKeyRaw = function (k) { var s = hoca[k] && hoca[k].name; if (hoca[k]) hoca[k].name = ''; var n = nameOfKey(k); if (hoca[k]) hoca[k].name = s; return n; };
  $('[data-pf-del]').addEventListener('click', function () {
    var k = pfKey; if (!k) return; pfDlg.close(); hidden.push(k); put('acadex.sinav.hidden', hidden); paintAll();
    say(nameOfKey(k) + ' sırası kaldırıldı; denemelerin silinmedi.', function () { hidden = hidden.filter(function (x) { return x !== k; }); put('acadex.sinav.hidden', hidden); paintAll(); });
  });
  $$('[data-dlg-x]').forEach(function (b) { b.addEventListener('click', function () { var d = b.closest('dialog'); if (d) d.close(); }); });

  /* ---------- sınav hazırla (dashboard.js'in alanları) ---------- */
  var bdDlg = $('[data-builddlg]'), cover = $('[data-bd-cover]'), bdErr = $('[data-bd-err]'), bdKey = null, topicEl = $('[data-bd-topic]');
  var checkRadio = function (name, val) { var r = root.querySelector('input[name="' + name + '"][value="' + val + '"]'); if (r && !r.disabled) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } };
  var openBuild = async function (k, forceSrc) {
    bdKey = k; bdErr.hidden = true; topicEl.value = '';
    var d = k ? desks().filter(function (x) { return x.key === k; })[0] : null, h = (k && hoca[k]) || {};
    if (!bdDlg.open) bdDlg.showModal();
    if (d && d.cards.length && forceSrc !== 'course') {
      checkRadio('exam-source', 'study_card');
      var sel = $('#exam-card-select'); if (sel) sel.value = d.cards[0];
      await (typeof onExamSourceChange === 'function' ? onExamSourceChange() : null);
    } else if (d && d.code || forceSrc === 'course') {
      if (d && d.code) window.pendingExamCourse = { code: d.code, deptCode: null };
      var cr = root.querySelector('input[name="exam-source"][value="course"]'); if (cr) cr.checked = true;
      await (typeof onExamSourceChange === 'function' ? onExamSourceChange() : null);
    } else await (typeof onExamSourceChange === 'function' ? onExamSourceChange() : null);
    if (h.type) checkRadio('exam-type', h.type);
    if (h.diff) checkRadio('exam-difficulty', h.diff);
    if (h.lang) checkRadio('exam-lang', h.lang);
    if (h.sim != null) $('#exam-simulation-toggle').checked = !!h.sim;
    paintCover();
  };
  $('[data-build]').addEventListener('click', function () { openBuild(null); });
  var countEl = $('#exam-question-count');
  $$('[data-cnt]').forEach(function (b) { b.addEventListener('click', function () { var v = (+countEl.value || 10) + (+b.getAttribute('data-cnt')), mn = +countEl.min || 1, mx = +countEl.max || 20; countEl.value = Math.max(mn, Math.min(mx, v)); countEl.dispatchEvent(new Event('change')); paintCover(); }); });
  var val = function (n) { var r = root.querySelector('input[name="' + n + '"]:checked'); return r ? r.value : ''; };
  var paintCover = function () {
    var src = val('exam-source'), name = '';
    if (src === 'course') { var cs = $('#exam-course-select'); name = cs && cs.selectedOptions[0] ? cs.selectedOptions[0].textContent : 'ders ağacı'; }
    else { var c = cardById($('#exam-card-select') && $('#exam-card-select').value); name = c ? (c.course_tag ? c.course_tag + ' · ' : '') + baseName(c.documents && c.documents.file_name) : 'belge seç'; }
    var sim = $('#exam-simulation-toggle').checked, p = prof();
    $('[data-bd-note]').textContent = sim ? 'süre bitince kâğıt kendiliğinden toplanır.' : '';
    cover.innerHTML = '<span class="uni">ACADEX · SINAV SALONU</span><h3>' + esc(name.length > 60 ? name.slice(0, 58) + '…' : name) + '</h3><span class="sub">' + esc((TYPE[val('exam-type')] || '') + ' · ' + (DIFF[val('exam-difficulty')] || '') + ' · ' + (val('exam-lang') === 'tr' ? 'Türkçe' : 'English')) + '</span>' +
      '<div class="lines"><span>Ad Soyad: ' + esc(p.full_name || '') + '</span><span>Öğrenci no: ' + esc(p.student_number || '') + '</span><span>Tarih: ' + dshort(new Date()) + '</span></div>' +
      '<table><tr><th>SORU</th><td>' + esc(countEl.value) + '</td></tr><tr><th>SÜRE</th><td>' + (sim ? 'gerçek sınav süresi' : 'serbest') + '</td></tr><tr><th>İPUCU</th><td>' + (sim ? 'yok' : 'soru başına bir') + '</td></tr>' + (topicEl.value.trim() && src === 'course' ? '<tr><th>ODAK</th><td>' + esc(topicEl.value.trim()) + '</td></tr>' : '') + '</table>' +
      '<p class="warn">' + (sim ? 'KİTAPÇIĞI AÇINCA SÜRE BAŞLAR' : 'KOLAY GELSİN') + '</p>';
  };
  bdDlg.addEventListener('change', function () { setTimeout(paintCover, 0); });
  bdDlg.addEventListener('input', function () { setTimeout(paintCover, 0); });
  if (typeof generateExam === 'function') {
    var origGen = generateExam;
    generateExam = async function () {
      bdErr.hidden = true;
      var t = topicEl.value.trim();
      if (t && val('exam-source') === 'course') { try { examFocusConcept = t; } catch (e) {} }
      var n = $('[data-bd-note]'); n.textContent = 'Acadia soruları yazıyor; bu biraz sürebilir…';
      var r = await origGen.apply(this, arguments);
      if (n.textContent.indexOf('Acadia') === 0) n.textContent = '';
      return r;
    };
    window.generateExam = generateExam;
  }

  /* panelin uyarıları: diyalog ya da salon açıkken kendi notumuzda göster */
  if (typeof showDashboardAlert === 'function') {
    var origAlert = showDashboardAlert;
    showDashboardAlert = function (type, msg) {
      if (bdDlg.open) { if (type === 'error') { bdErr.textContent = msg; bdErr.hidden = false; } return; }
      if (!hall.hidden) { if (type === 'error' || /hatırlatma|reminder/i.test(msg)) say(msg, null, /hatırlatma|reminder/i.test(msg)); return; }
      return origAlert.apply(this, arguments);
    };
    window.showDashboardAlert = showDashboardAlert;
  }

  /* ---------- salon ---------- */
  var hall = $L('[data-hall]'), book = $L('[data-book]'), opt = $L('[data-opt]'), res = $L('[data-res]'), hMain = $L('[data-hall-main]');
  var clockW = $L('[data-clockw]'), wedge = $L('[data-wedge]'), leftEl = $L('[data-left]'), leftNote = $L('[data-left-note]'), tabw = $L('[data-tabw]');
  var subBtn = $L('[data-submit]'), exitBtn = $L('[data-exit]'), subDlg = $L('[data-subdlg]');
  (function () { var t = ''; for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6, r1 = i % 3 ? 40 : 36; t += '<line x1="' + (50 + Math.sin(a) * r1).toFixed(1) + '" y1="' + (50 - Math.cos(a) * r1).toFixed(1) + '" x2="' + (50 + Math.sin(a) * 44).toFixed(1) + '" y2="' + (50 - Math.cos(a) * 44).toFixed(1) + '"/>'; } $L('[data-ticks]').innerHTML = t; })();
  var EXM = null, QS = [], cur = -1, started = 0, ticker = 0, tabOut = 0, mode = 'off', lastFocus = null;
  var wedgeD = function (f) { f = Math.max(0, Math.min(1, f)); if (f >= 0.9999) return 'M50 50 m-46 0 a46 46 0 1 0 92 0 a46 46 0 1 0 -92 0'; var a = f * 2 * Math.PI, x = 50 + 46 * Math.sin(a), y = 50 - 46 * Math.cos(a); return 'M50 50 L50 4 A46 46 0 ' + (f > 0.5 ? 1 : 0) + ' 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Z'; };
  var mmss = function (s) { s = Math.max(0, Math.round(s)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
  var tick = function () {
    if (!EXM) return;
    var lim = EXM.is_simulation && EXM.time_limit_seconds ? +EXM.time_limit_seconds : 0;
    if (lim && started) {
      var left = lsafe(function () { return examTimerRemainingSeconds; }, 0);
      leftEl.textContent = mmss(left); leftNote.textContent = 'kalan süre'; wedge.setAttribute('d', wedgeD(left / lim));
      clockW.classList.toggle('warn', left <= Math.max(60, lim * 0.1)); clockW.classList.toggle('last', left <= 10);
    } else {
      var el = started ? (Date.now() - started) / 1000 : 0;
      leftEl.textContent = mmss(el); leftNote.textContent = lim ? 'süre kitapçığı açınca başlar' : 'geçen süre · sınır yok'; wedge.setAttribute('d', wedgeD(lim ? 1 : (el % 3600) / 3600));
      clockW.classList.remove('warn', 'last');
    }
  };
  var openHall = function () {
    if (hall.hidden) { lastFocus = document.activeElement; hall.hidden = false; document.documentElement.style.overflow = 'hidden'; document.body.classList.add('axs-hall-on'); }
    $L('[data-opt-name]').textContent = prof().full_name || '';
  };
  var closeHall = function () {
    if (hall.hidden) return;
    clearInterval(ticker); ticker = 0; hall.hidden = true; document.documentElement.style.overflow = ''; document.body.classList.remove('axs-hall-on'); mode = 'off'; EXM = null;
    if (typeof stopExamTimer === 'function') stopExamTimer();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  };
  var anim = function (cls, ms) { if (reduce) return; hall.classList.remove('deal', 'lift', 'collect'); void hall.offsetWidth; hall.classList.add(cls); setTimeout(function () { hall.classList.remove(cls); }, ms || 700); };
  var letter = function (i) { return 'ABCDEFGH'.charAt(i); };
  var qHtml = function (q, i) {
    var name = 'answer-q-' + q.id, body = '', txt = rich(q.question);
    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      var opts = q.options || [], dy = q.type === 'true_false';
      body = (dy ? '<div class="sn-dy" role="radiogroup" aria-label="Cevap">' : '<ol class="sn-opts" role="radiogroup" aria-label="Şıklar">') + opts.map(function (o, k) {
        var lb = dy ? (String(o).charAt(0).toUpperCase() || letter(k)) : letter(k);
        var inner = '<label class="sn-opt-b" aria-pressed="false" data-letter="' + esc(lb) + '"><input type="radio" name="' + name + '" value="' + esc(o) + '"><span class="l" aria-hidden="true">' + esc(lb) + '</span><span>' + esc(o) + '</span></label>';
        return dy ? inner : '<li>' + inner + '</li>';
      }).join('') + (dy ? '</div>' : '</ol>');
    } else if (q.type === 'fill_blank') {
      var inp = '<input type="text" class="sn-blank" name="' + name + '" autocomplete="off" aria-label="Boşluğa gelecek cevap">';
      if (/_{3,}/.test(txt)) { txt = txt.replace(/_{3,}/, inp); body = ''; } else body = '<p>' + inp + '</p>';
    } else if (q.type === 'calculation') {
      var pre = q.units && /^[$€₺£]$/.test(q.units);
      body = '<div class="sn-calc">' + (pre ? '<span>' + esc(q.units) + '</span>' : '') + '<input type="number" step="any" class="sn-blank" name="' + name + '" aria-label="Sayısal cevap" placeholder="cevap">' + (!pre && q.units ? '<span>' + esc(q.units) + '</span>' : '') + '</div>';
    } else {
      body = '<div class="sn-answ"><textarea class="sn-ans" name="' + name + '" aria-label="Cevabın" placeholder="cevabını buraya yaz…"></textarea></div><p class="sn-wc"><span>kelime: <b data-wc="">0</b></span><span class="hand">anahtar kavramları kullanmayı unutma</span></p>';
    }
    var hintB = EXM.is_simulation ? '' : '<button type="button" class="sn-ghost" id="btn-hint-' + esc(q.id) + '" data-hint="' + esc(q.id) + '">ipucu al</button>';
    var hintBox = EXM.is_simulation ? '' : '<div id="hint-box-' + esc(q.id) + '" class="exam-hint-box sn-hint" style="display:none"></div>';
    return '<section class="sn-q" data-qi="' + i + '" aria-label="Soru ' + (i + 1) + '" hidden><div class="sn-qn"><b>' + (i + 1) + '</b><span class="ty">' + esc(QT[q.type] || q.type) + '</span><span class="pt">' + (i + 1) + ' / ' + QS.length + '</span></div>' +
      '<div class="sn-qtext">' + txt + '</div>' + body + hintBox +
      '<div class="sn-book-nav"><button type="button" class="sn-ghost" data-prev=""' + (i ? '' : ' disabled') + '>← önceki</button><button type="button" class="sn-ghost sn-flag" aria-pressed="false" data-flag="">işaretle</button>' + hintB + '<span class="sp"></span>' +
      (i < QS.length - 1 ? '<button type="button" class="btn btn-dark" data-next="">sonraki →</button>' : '<button type="button" class="btn btn-blue" data-hand="">kâğıdı teslim et</button>') + '</div></section>';
  };
  var answered = function (q) {
    var name = 'answer-q-' + q.id;
    if (q.type === 'multiple_choice' || q.type === 'true_false') return !!book.querySelector('input[name="' + name + '"]:checked');
    var el = book.querySelector('[name="' + name + '"]'); return !!(el && String(el.value).trim());
  };
  var paintOpt = function () {
    var info = QS.map(function (q, i) {
      var sec = book.querySelector('[data-qi="' + i + '"]'), fb = sec && sec.querySelector('[data-flag]');
      var ch = (q.type === 'multiple_choice' || q.type === 'true_false') ? book.querySelector('input[name="answer-q-' + q.id + '"]:checked') : null;
      return { fl: !!(fb && fb.getAttribute('aria-pressed') === 'true'), an: answered(q), sec: sec, ch: ch };
    });
    if (opt.children.length !== QS.length || opt.getAttribute('data-for') !== String(EXM && EXM.id) + ':' + (cur >= 0)) {
      opt.setAttribute('data-for', String(EXM && EXM.id) + ':' + (cur >= 0));
      opt.innerHTML = QS.map(function (q, i) {
        var bb, sec = info[i].sec;
        if ((q.type === 'multiple_choice' || q.type === 'true_false') && sec) bb = '<span class="bb" aria-hidden="true">' + $$('.sn-opt-b', sec).map(function (l) { return '<i>' + esc(l.getAttribute('data-letter')) + '</i>'; }).join('') + '</span>';
        else bb = '<span class="tl">' + (q.type === 'fill_blank' ? 'boşluk' : q.type === 'calculation' ? 'sayı' : q.type === 'open_ended' ? 'yazılı' : 'test') + '</span>';
        return '<li><button type="button" data-go="' + i + '"><span class="n">' + (i + 1) + '</span>' + bb + '<span class="st"></span></button></li>';
      }).join('');
    }
    QS.forEach(function (q, i) {
      var b = opt.children[i].firstChild, it = info[i];
      if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-label', 'Soru ' + (i + 1) + (it.an ? ', cevaplı' : ', boş') + (it.fl ? ', işaretli' : ''));
      b.querySelector('.st').className = 'st' + (it.fl ? ' g' : it.an ? ' f' : '');
      if (it.sec) $$('.bb i', b).forEach(function (bi, k) { var l = $$('.sn-opt-b', it.sec)[k]; bi.classList.toggle('f', !!(it.ch && l && l.contains(it.ch))); });
    });
  };
  var go = function (i, focus) {
    if (i < 0 || i >= QS.length) return; cur = i;
    $$('.sn-q', book).forEach(function (s) { s.hidden = +s.getAttribute('data-qi') !== i; });
    $('.sn-book-h .pg', book).textContent = 'sayfa ' + (i + 1) + ' / ' + QS.length;
    if (!reduce) { book.classList.remove('turn'); void book.offsetWidth; book.classList.add('turn'); }
    paintOpt();
    book.parentNode.scrollTop = 0;
    if (focus) { var f = book.querySelector('[data-qi="' + i + '"] input, [data-qi="' + i + '"] textarea'); if (f) f.focus({ preventScroll: true }); }
  };
  var coverPage = function () {
    var e = EXM, lim = e.is_simulation && e.time_limit_seconds ? Math.round(e.time_limit_seconds / 60) : 0;
    book.className = 'sn-book cover';
    book.innerHTML = '<span class="sn-k">' + esc($L('[data-hl-course]').textContent) + '</span><h3>' + esc((TYPE[e.exam_type] || 'deneme') + ' sınavı') + '</h3><p class="meta">' + QS.length + ' soru · ' + (DIFF[e.difficulty] || '') + ' · ' + (e.language === 'tr' ? 'Türkçe' : 'English') + '</p>' +
      '<ul><li>' + (lim ? 'süre: ' + lim + ' dakika; bitince kâğıt kendiliğinden toplanır' : 'süre sınırı yok; kendi hızında çöz') + '</li><li>' + (e.is_simulation ? 'ipucu yok, gerçek sınav gibi' : 'her soruda bir ipucu alabilirsin') + '</li><li>sorular arasında optik formdan gezebilirsin</li><li>emin olmadığını “işaretle”, sonra dön</li></ul>' +
      (e.is_simulation ? '<p class="warn">SEKMEDEN ÇIKARSAN NOT EDİLİR</p>' : '') + '<button type="button" class="btn btn-blue" data-open-book="">kitapçığı aç</button>';
    setTimeout(function () { var b = book.querySelector('[data-open-book]'); if (b) b.focus(); }, 60);
  };
  var openBook = function () {
    var paint = function () {
      book.className = 'sn-book';
      book.innerHTML = '<div class="sn-book-h"><span class="nm">' + esc(prof().full_name || '') + ' · ' + esc($L('[data-hl-course]').textContent) + '</span><span class="pg"></span></div>' + QS.map(qHtml).join('');
      started = Date.now();
      if (EXM.is_simulation && EXM.time_limit_seconds && typeof startExamTimer === 'function') startExamTimer(EXM.time_limit_seconds);
      tick(); go(0, true);
    };
    if (reduce) paint(); else { anim('lift', 560); setTimeout(paint, 520); }
  };
  if (typeof startActiveExam === 'function') {
    startActiveExam = function (exam) {
      if (bdDlg.open) bdDlg.close();
      EXM = exam; QS = exam.questions || []; cur = -1; started = 0; tabOut = 0; tabw.hidden = true; mode = 'exam';
      if (typeof stopExamTimer === 'function') stopExamTimer();
      var c = cardById(exam.study_card_id);
      $L('[data-hl-course]').textContent = exam.source_type === 'course' ? (exam.course_code || 'ders ağacı') : (c ? (c.course_tag ? c.course_tag + ' · ' : '') + baseName(c.documents && c.documents.file_name) : 'belge');
      $L('[data-hl-title]').textContent = (TYPE[exam.exam_type] || 'deneme') + ' deneme' + (exam.is_simulation ? ' · gerçek süre' : '');
      hMain.hidden = false; res.hidden = true; res.innerHTML = ''; clockW.hidden = false; subBtn.hidden = false; exitBtn.hidden = false; exitBtn.textContent = 'çık';
      openHall(); coverPage(); paintOpt(); tick(); anim('deal', 760);
      clearInterval(ticker); ticker = setInterval(tick, 1000);
    };
    window.startActiveExam = startActiveExam;
  }
  book.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-open-book]')) { openBook(); return; }
    if (t.closest('[data-next]')) { go(cur + 1, true); return; }
    if (t.closest('[data-prev]')) { go(cur - 1, true); return; }
    if (t.closest('[data-hand]')) { askSubmit(); return; }
    var f = t.closest('[data-flag]'); if (f) { f.setAttribute('aria-pressed', String(f.getAttribute('aria-pressed') !== 'true')); f.textContent = f.getAttribute('aria-pressed') === 'true' ? 'işaretli' : 'işaretle'; paintOpt(); return; }
    var h = t.closest('[data-hint]'); if (h && typeof revealExamHint === 'function') revealExamHint(h.getAttribute('data-hint'));
  });
  book.addEventListener('change', function (e) {
    var r = e.target; if (r.type === 'radio') { $$('input[name="' + r.name + '"]', book).forEach(function (x) { x.closest('.sn-opt-b').setAttribute('aria-pressed', String(x.checked)); }); }
    paintOpt();
    if (r.type === 'radio') { var b = opt.querySelector('[data-go="' + cur + '"] .bb i.f'); if (b) b.classList.add('new'); }
  });
  book.addEventListener('input', function (e) {
    var t = e.target; if (t.classList.contains('sn-ans')) { var n = (t.value.trim().match(/\S+/g) || []).length, w = t.closest('.sn-q').querySelector('[data-wc]'); if (w) w.textContent = n; }
    clearTimeout(book._t); book._t = setTimeout(paintOpt, 250);
  });
  opt.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && cur >= 0) go(+b.getAttribute('data-go'), true); });
  document.addEventListener('keydown', function (e) {
    if (hall.hidden || mode !== 'exam' || cur < 0 || subDlg.open) return;
    var t = e.target; if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) && t.type !== 'radio') return;
    if (e.key === 'ArrowRight' && t.type !== 'radio') { e.preventDefault(); go(cur + 1, false); }
    else if (e.key === 'ArrowLeft' && t.type !== 'radio') { e.preventDefault(); go(cur - 1, false); }
    else if (/^[a-eA-E]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      var sec = book.querySelector('[data-qi="' + cur + '"]'), l = sec && $$('.sn-opt-b', sec)['abcde'.indexOf(e.key.toLowerCase())];
      if (l) { e.preventDefault(); var inp = l.querySelector('input'); inp.checked = true; inp.dispatchEvent(new Event('change', { bubbles: true })); inp.focus(); }
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !hall.hidden && mode === 'exam' && started && EXM && EXM.is_simulation) { tabOut++; tabw.hidden = false; tabw.textContent = 'sekmeden çıktın · ' + tabOut; }
  });
  var subAction = null;
  var askSubmit = function () {
    if (cur < 0) { say('Önce kitapçığı aç.'); return; }
    var a = QS.filter(answered).length, fl = $$('[data-flag][aria-pressed="true"]', book).length;
    $L('[data-sb-h]').textContent = 'kâğıdı teslim ediyor musun?';
    $L('[data-sb-info]').textContent = QS.length + ' sorudan ' + a + ' tanesi cevaplı' + (QS.length - a ? ', ' + (QS.length - a) + ' tanesi boş' : '') + (fl ? ', ' + fl + ' tanesi işaretli' : '') + '. Teslim edince Acadia kâğıdını okur.';
    $L('[data-sb-ok]').textContent = 'teslim et'; $L('[data-sb-no]').textContent = 'devam et';
    subAction = 'submit'; subDlg.returnValue = ''; subDlg.showModal();
  };
  subBtn.addEventListener('click', function () { if (mode === 'exam') askSubmit(); });
  exitBtn.addEventListener('click', function () {
    if (mode === 'result') { closeHall(); if (typeof loadExamsPlatform === 'function') loadExamsPlatform(); return; }
    $L('[data-sb-h]').textContent = 'sınavdan çıkıyor musun?';
    $L('[data-sb-info]').textContent = 'Cevapların kaydedilmez; bu deneme karnene işlenmez.';
    $L('[data-sb-ok]').textContent = 'çık'; $L('[data-sb-no]').textContent = 'devam et';
    subAction = 'exit'; subDlg.returnValue = ''; subDlg.showModal();
  });
  subDlg.addEventListener('close', function () {
    if (subDlg.returnValue !== 'ok') return;
    if (subAction === 'exit') { closeHall(); if (typeof loadExamsPlatform === 'function') loadExamsPlatform(); }
    else if (subAction === 'submit' && typeof submitExam === 'function') submitExam();
  });
  var readingState = function () {
    var cl = book.cloneNode(true); cl.removeAttribute('data-book'); cl.className = 'sn-book sn-reading'; cl.setAttribute('data-reading', '');
    cl.innerHTML = '<svg viewBox="0 0 120 60" aria-hidden="true"><path pathLength="1" d="M6 40 C20 10 30 50 44 26 C56 6 66 44 80 24 C90 10 100 38 114 18"/></svg><p>kâğıdın okunuyor… kırmızı kalem iş başında.</p>';
    book.hidden = true; book.parentNode.appendChild(cl); subBtn.disabled = true; exitBtn.disabled = true;
    return function () { cl.remove(); book.hidden = false; subBtn.disabled = false; exitBtn.disabled = false; };
  };
  if (typeof submitExam === 'function') {
    var origSubmit = submitExam;
    submitExam = async function () {
      var ex = EXM, el = started ? Math.round((Date.now() - started) / 1000) : 0, undo = null;
      if (!hall.hidden && mode === 'exam') { anim('collect', 600); undo = readingState(); }
      lastElapsed = { id: ex && ex.id, s: el };
      var r;
      try { r = await origSubmit.apply(this, arguments); } finally {
        if (undo) undo();
        if (mode === 'exam' && !hall.hidden) { subBtn.textContent = 'kâğıdı teslim et'; say('Kâğıt gönderilemedi; cevapların duruyor, tekrar dene.'); }
      }
      return r;
    };
    window.submitExam = submitExam;
  }
  var lastElapsed = null;

  /* ---------- sonuç: kırmızı kalem ---------- */
  var MK = { ok: '<path pathLength="1" d="M5 18 L13 27 L29 6"/>', no: '<path pathLength="1" d="M6 6 L28 28 M28 6 L6 28"/>', half: '<path pathLength="1" d="M6 26 L28 8"/>' };
  if (typeof showExamResults === 'function') {
    showExamResults = function (exam) {
      if (typeof stopExamTimer === 'function') stopExamTimer();
      clearInterval(ticker); ticker = 0; mode = 'result';
      var rs = exam.question_results || [], isTr = true, g = Math.round(+exam.grade || 0);
      var cnt = { ok: 0, half: 0, no: 0, blank: 0 };
      rs.forEach(function (r) { if (!String(r.student_answer || '').trim()) cnt.blank++; if (r.score >= 80) cnt.ok++; else if (r.score >= 50) cnt.half++; else cnt.no++; });
      var sid = exam.study_card_id || (EXM && EXM.id === exam.id ? EXM.study_card_id : null), c = cardById(sid);
      if (!exam.source_type && EXM && EXM.id === exam.id) { exam.source_type = EXM.source_type; exam.course_code = exam.course_code || EXM.course_code; }
      if (!exam.study_card_id && sid) exam.study_card_id = sid;
      var course = exam.source_type === 'course' ? (exam.course_code || 'ders ağacı') : (c ? (c.course_tag ? c.course_tag + ' · ' : '') + baseName(c.documents && c.documents.file_name) : (exam.study_cards && exam.study_cards.documents ? baseName(exam.study_cards.documents.file_name) : 'belge'));
      var el = lastElapsed && lastElapsed.id === exam.id ? lastElapsed.s : 0;
      var verdict = g >= 85 ? 'harika; konuyu neredeyse tamamen kavramışsın.' : g >= 70 ? 'güzel; ufak eksikler dışında hakimsin.' : g >= 50 ? 'geçtin; yine de birkaç konunun üstünden geç.' : 'bu konuya biraz daha zaman ayır; yanlışların hata defterinde.';
      var weak = {}; rs.forEach(function (r) { if (!r.concept) return; (weak[r.concept] = weak[r.concept] || { t: 0, n: 0 }); weak[r.concept].t += +r.score || 0; weak[r.concept].n++; });
      var wl = Object.keys(weak).map(function (k) { return { c: k, a: weak[k].t / weak[k].n }; }).sort(function (a, b) { return a.a - b.a; });
      var label = keyOfExam(exam), code = label.indexOf('c:') === 0 ? label.slice(2) : null;
      var practice = wl.length && wl[0].a < 75 ? (code ? '<button type="button" class="sn-ghost" data-practice="' + esc(code) + '" data-concept="' + esc(wl[0].c) + '">“' + esc(wl[0].c) + '” konusundan yeni deneme</button>' : '<button type="button" class="sn-ghost" data-retry="' + esc(label) + '">bu belgeden yeni deneme</button>') : '';
      res.innerHTML = '<article class="sn-paper"><div class="sn-ph"><div><span class="sn-k">' + esc(course) + '</span><h2 class="disp">' + esc((TYPE[exam.exam_type] || 'deneme') + ' deneme') + (exam.is_simulation ? ' · gerçek süre' : '') + '</h2><p>' + esc(dshort(exam.completed_at || new Date())) + ' · ' + rs.length + ' soru · ' + (exam.language === 'tr' ? 'Türkçe' : 'English') + ' · ' + verdict + '</p></div>' +
        '<div class="sn-score" role="img" aria-label="Puan ' + g + ' / 100"><svg viewBox="0 0 118 96" aria-hidden="true"><path pathLength="1" d="M60 6 C24 4 4 26 8 52 C12 80 50 94 82 86 C110 78 118 50 104 28 C94 12 74 6 52 10"/></svg><b>' + g + '</b><small>/ 100</small></div></div>' +
        '<p class="sn-sum"><span>doğru <b>' + cnt.ok + '</b></span><span>kısmen <b>' + cnt.half + '</b></span><span>yanlış <b>' + cnt.no + '</b></span>' + (cnt.blank ? '<span>boş <b>' + cnt.blank + '</b></span>' : '') + (el ? '<span>süre <b>' + mmss(el) + '</b></span>' : '') + '</p>' +
        rs.map(function (r, i) {
          var k = r.score >= 80 ? 'ok' : r.score >= 50 ? 'half' : 'no', blank = !String(r.student_answer || '').trim();
          var steps = Array.isArray(r.solution_steps) && r.solution_steps.length ? '<div class="sn-model"><b>çözüm adımları</b><ol>' + r.solution_steps.map(function (s) { return '<li>' + rich(s) + '</li>'; }).join('') + '</ol></div>' : '';
          var unit = r.units ? ' ' + esc(r.units) : '';
          return '<div class="sn-ri" style="--i:' + i + '"><svg class="mk ' + k + '" viewBox="0 0 34 34" aria-hidden="true">' + MK[k] + '</svg><div class="sn-ri-h"><b>' + (i + 1) + '</b><span class="ty">' + esc(QT[r.type] || r.type || '') + '</span>' + (r.concept ? '<span class="cpt">' + esc(r.concept) + '</span>' : '') + '<span class="pt">' + (+r.score || 0) + '</span></div>' +
            '<p class="q">' + rich(r.question) + '</p><p class="yours' + (k === 'no' && !blank ? ' wrong' : '') + '">senin cevabın: <span>' + (blank ? 'boş bıraktın' : esc(r.student_answer) + (r.student_answer && r.units ? unit : '')) + '</span></p>' +
            (r.type !== 'open_ended' && r.correct_answer != null && r.correct_answer !== '' ? '<p class="right">doğrusu: ' + esc(r.correct_answer) + unit + (r.tolerance_percent ? ' (±%' + esc(r.tolerance_percent) + ')' : '') + '</p>' : '') +
            (r.feedback ? '<p class="fb">' + rich(r.feedback) + '</p>' : '') + steps + '</div>';
        }).join('') +
        '<div class="sn-res-b">' + practice + '<button type="button" class="sn-ghost" data-to-errs="">hata defterine bak</button><button type="button" class="btn btn-dark" data-back="">salona dön</button></div>' +
        '<p class="sn-honest">Puanları Acadex’in yapay zekası verdi. Açık uçlu sorularda hocanın okuması farklı olabilir; geri bildirimi bir öneri olarak oku.</p></article>';
      $L('[data-hl-course]').textContent = course; $L('[data-hl-title]').textContent = 'sonuç kâğıdı';
      hMain.hidden = true; res.hidden = false; clockW.hidden = true; subBtn.hidden = true; exitBtn.hidden = false; exitBtn.disabled = false; exitBtn.textContent = 'salona dön'; tabw.hidden = true;
      openHall(); res.scrollTop = 0; setTimeout(function () { var b = res.querySelector('[data-back]'); if (b) b.focus({ preventScroll: true }); }, 50);
      loadData();
    };
    window.showExamResults = showExamResults;
  }
  res.addEventListener('click', function (e) {
    if (e.target.closest('[data-back]')) { closeHall(); if (typeof loadExamsPlatform === 'function') loadExamsPlatform(); return; }
    if (e.target.closest('[data-to-errs]')) { closeHall(); if (typeof loadExamsPlatform === 'function') loadExamsPlatform(); setTimeout(function () { $('#hata-defteri').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }, 300); return; }
    var p = e.target.closest('[data-practice]'); if (p) { closeHall(); practice(p.getAttribute('data-practice'), p.getAttribute('data-concept')); return; }
    var r = e.target.closest('[data-retry]'); if (r) { closeHall(); openBuild(r.getAttribute('data-retry')); }
  });
  var practice = function (code, concept) {
    window.pendingExamCourse = { code: code, deptCode: null }; window.pendingFocusConcept = concept;
    var cr = root.querySelector('input[name="exam-source"][value="course"]'); if (cr) cr.checked = true;
    bdKey = 'c:' + code; bdErr.hidden = true; topicEl.value = '';
    if (!bdDlg.open) bdDlg.showModal();
    Promise.resolve(typeof onExamSourceChange === 'function' ? onExamSourceChange() : null).then(function () { topicEl.value = concept || ''; paintCover(); });
  };

  /* ---------- karne ---------- */
  var rtabs = $('[data-rtabs]'), chartEl = $('[data-chart]'), timeEl = $('[data-time]'), attsEl = $('[data-atts]'), rSel = 'all';
  var paintReport = function () {
    var ds = desks().filter(function (d) { return d.ex.length; });
    if (rSel !== 'all' && !ds.some(function (d) { return d.key === rSel; })) rSel = 'all';
    rtabs.innerHTML = '<button type="button" class="sn-rtab" role="tab" aria-selected="' + (rSel === 'all') + '" data-rk="all">tümü</button>' + ds.map(function (d) { return '<button type="button" class="sn-rtab" role="tab" aria-selected="' + (rSel === d.key) + '" data-rk="' + esc(d.key) + '">' + esc(d.name) + '</button>'; }).join('');
    var ex = rSel === 'all' ? EX.slice() : (ds.filter(function (d) { return d.key === rSel; })[0] || { ex: [] }).ex;
    var tgt = rSel !== 'all' && hoca[rSel] && hoca[rSel].target ? +hoca[rSel].target : 70;
    /* puan grafiği */
    if (!ex.length) chartEl.innerHTML = '<p class="sn-empty">ilk denemeni çözünce puanların burada çizilir.</p>';
    else {
      var pts = ex.slice(-12), W = 600, H = 230, L = 34, Rr = 16, T = 18, Bm = 34, n = pts.length;
      var x = function (i) { return n < 2 ? (L + W - Rr) / 2 : L + i * (W - L - Rr) / (n - 1); }, y = function (v) { return T + (100 - v) * (H - T - Bm) / 100; };
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(+p.grade || 0).toFixed(1); }).join(' ');
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Son ' + n + ' denemenin puanları: ' + pts.map(function (p) { return p.grade; }).join(', ') + '">';
      s += '<path class="ax" d="M' + L + ' ' + (H - Bm) + ' H' + (W - Rr) + '"/>';
      s += '<path class="tg" d="M' + L + ' ' + y(tgt).toFixed(1) + ' H' + (W - Rr) + '"/><text class="tl" x="' + (W - Rr) + '" y="' + (y(tgt) - 6).toFixed(1) + '" text-anchor="end">hedef ' + tgt + '</text>';
      [0, 50, 100].forEach(function (v) { s += '<text x="' + (L - 8) + '" y="' + (y(v) + 5).toFixed(1) + '" text-anchor="end">' + v + '</text>'; });
      if (n > 1) s += '<path class="ln" pathLength="1" d="' + d + '"/>'; else s += '<path class="ghost" d="M' + L + ' ' + y(+pts[0].grade || 0).toFixed(1) + ' H' + (W - Rr) + '"/>';
      pts.forEach(function (p, i) { s += '<circle class="pt" cx="' + x(i).toFixed(1) + '" cy="' + y(+p.grade || 0).toFixed(1) + '" r="5.5"/><text class="vl" x="' + x(i).toFixed(1) + '" y="' + (y(+p.grade || 0) - 11).toFixed(1) + '" text-anchor="middle">' + (+p.grade || 0) + '</text>'; if (n <= 8 || i % 2 === 0 || i === n - 1) s += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + dshort(p.completed_at).slice(0, 5) + '</text>'; });
      chartEl.innerHTML = s + '</svg>' + (n === 1 ? '<p class="sn-tnote">bir deneme daha çöz; çizgi buradan başlar.</p>' : '');
    }
    /* soru türleri */
    var by = {}; ex.forEach(function (e) { (e.question_results || []).forEach(function (r) { var t = r.type || 'open_ended'; (by[t] = by[t] || { t: 0, n: 0 }); by[t].t += +r.score || 0; by[t].n++; }); });
    var rows = Object.keys(by).map(function (k) { return { k: k, a: Math.round(by[k].t / by[k].n), n: by[k].n }; }).sort(function (a, b) { return a.a - b.a; });
    timeEl.innerHTML = rows.length ? rows.map(function (r) { return '<div class="sn-trow"><span class="nm">' + esc(QT[r.k] || r.k) + '</span><span class="bar" role="img" aria-label="ortalama ' + r.a + '"><i class="' + (r.a < 50 ? 'lo' : r.a < 75 ? 'mid' : '') + '" style="width:' + r.a + '%"></i></span><span class="v">ort. ' + r.a + ' · ' + r.n + ' soru</span></div>'; }).join('') + (rows.length > 1 && rows[0].a < 75 ? '<p class="sn-tnote">en çok zorlandığın: ' + esc(QT[rows[0].k] || rows[0].k) + ' soruları.</p>' : '')
      : '<p class="sn-empty">denemelerden sonra hangi soru türünde zorlandığını burada görürsün.</p>';
    /* denemeler */
    var list = ex.slice().reverse();
    attsEl.innerHTML = list.length ? list.slice(0, 20).map(function (e) {
      var gg = Math.round(+e.grade || 0);
      return '<li tabindex="0" role="button" data-ex="' + esc(e.id) + '" aria-label="' + esc(nameOfKey(keyOfExam(e))) + ' denemesi, ' + gg + ' puan, sonucu aç"><span class="dt">' + dshort(e.completed_at) + '</span><span class="ti">' + esc((TYPE[e.exam_type] || 'deneme') + ' · ' + nameOfKey(keyOfExam(e))) + (e.is_simulation ? ' · ⏱' : '') + '</span><span class="du">' + (e.question_count || (e.question_results || []).length) + ' soru' + (e.difficulty ? ' · ' + (DIFF[e.difficulty] || '') : '') + '</span><span class="sc' + (gg >= 75 ? ' ok' : gg >= 50 ? ' mid' : '') + '">' + gg + '</span></li>';
    }).join('') : '<li class="sn-empty" style="display:block;border:0">henüz tamamlanmış deneme yok.</li>';
  };
  rtabs.addEventListener('click', function (e) { var b = e.target.closest('[data-rk]'); if (b) { rSel = b.getAttribute('data-rk'); paintReport(); } });
  var openAtt = function (li) { var e = EX.filter(function (x) { return String(x.id) === li.getAttribute('data-ex'); })[0]; if (e) { lastElapsed = null; showExamResults(e); } };
  attsEl.addEventListener('click', function (e) { var li = e.target.closest('[data-ex]'); if (li) openAtt(li); });
  attsEl.addEventListener('keydown', function (e) { var li = e.target.closest('[data-ex]'); if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAtt(li); } });

  /* ---------- hata defteri ---------- */
  var errsEl = $('[data-errs]');
  var paintErrs = function () {
    var groups = {}, total = 0;
    EX.slice().reverse().forEach(function (e) {
      var k = keyOfExam(e);
      (e.question_results || []).forEach(function (r, i) {
        var g = groups[k] = groups[k] || { key: k, items: [], con: {} };
        if (r.concept) { (g.con[r.concept] = g.con[r.concept] || { t: 0, n: 0 }); g.con[r.concept].t += +r.score || 0; g.con[r.concept].n++; }
        var id = e.id + ':' + i;
        if ((+r.score || 0) < 50 && done.indexOf(id) < 0) { g.items.push({ id: id, r: r }); total++; }
      });
    });
    $('[data-errn]').textContent = total;
    var gs = Object.keys(groups).map(function (k) { return groups[k]; }).filter(function (g) { return g.items.length; });
    if (!gs.length) { errsEl.innerHTML = '<p class="sn-empty">' + (EX.length ? 'hata defterin temiz. yanlış yaptıkça buraya yazılır.' : 'henüz yanlış yok. ilk denemeni çözünce yanlışların burada birikir.') + '</p>'; return; }
    errsEl.innerHTML = gs.map(function (g) {
      var wk = Object.keys(g.con).map(function (c) { return { c: c, a: Math.round(g.con[c].t / g.con[c].n) }; }).filter(function (x) { return x.a < 75; }).sort(function (a, b) { return a.a - b.a; }).slice(0, 4);
      var code = g.key.indexOf('c:') === 0 ? g.key.slice(2) : null;
      var btn = code && wk.length ? '<button type="button" class="btn btn-dark" data-practice="' + esc(code) + '" data-concept="' + esc(wk[0].c) + '">zayıf konudan deneme</button>' : '<button type="button" class="btn btn-dark" data-retry="' + esc(g.key) + '">yeniden deneme</button>';
      return '<div class="sn-eg"><div class="sn-eg-h"><h3>' + esc(nameOfKey(g.key)) + '</h3><small>' + g.items.length + ' yanlış</small>' + btn + '</div>' +
        (wk.length ? '<p class="axs-wk">' + wk.map(function (w) { return '<span>' + esc(w.c) + ' <b>' + w.a + '</b></span>'; }).join('') + '</p>' : '') +
        '<ol>' + g.items.slice(0, 8).map(function (it) {
          var r = it.r;
          return '<li><span><span class="q">' + rich(String(r.question || '').slice(0, 220)) + '</span><span class="a">senin: <s>' + esc(String(r.student_answer || '').trim() ? String(r.student_answer).slice(0, 120) : 'boş') + '</s>' + (r.type !== 'open_ended' && r.correct_answer != null && r.correct_answer !== '' ? ' · doğrusu: <b>' + esc(String(r.correct_answer).slice(0, 120)) + '</b>' : '') + '</span></span><button type="button" data-done="' + esc(it.id) + '" aria-label="Öğrendim, defterden sil" title="öğrendim">✓</button></li>';
        }).join('') + '</ol>' + (g.items.length > 8 ? '<p class="sn-empty" style="font-size:18px">+' + (g.items.length - 8) + ' yanlış daha</p>' : '') + '</div>';
    }).join('');
  };
  errsEl.addEventListener('click', function (e) {
    var d = e.target.closest('[data-done]');
    if (d) { var id = d.getAttribute('data-done'); done.push(id); put('acadex.sinav.errs.done', done); paintErrs(); say('Defterden silindi.', function () { done = done.filter(function (x) { return x !== id; }); put('acadex.sinav.errs.done', done); paintErrs(); }); return; }
    var p = e.target.closest('[data-practice]'); if (p) { practice(p.getAttribute('data-practice'), p.getAttribute('data-concept')); return; }
    var r = e.target.closest('[data-retry]'); if (r) openBuild(r.getAttribute('data-retry'));
  });
  $('[data-goerr]').addEventListener('click', function () { $('#hata-defteri').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); });

  if (typeof revealExamHint === 'function') {
    var origHint = revealExamHint;
    revealExamHint = async function (qId) {
      var r = await origHint.apply(this, arguments);
      var b = document.getElementById('btn-hint-' + qId), h = document.getElementById('hint-box-' + qId);
      if (b && b.disabled) { b.textContent = 'ipucu alındı'; b.style.borderColor = ''; b.style.color = ''; }
      if (h) { var st = h.querySelector('strong'); if (st && /Hint|İpucu/.test(st.textContent)) st.textContent = 'ipucu:'; }
      return r;
    };
    window.revealExamHint = revealExamHint;
  }
  var paintAll = function () { paintCal(); paintDesks(); paintReport(); paintErrs(); };

  /* ---------- dashboard.js'in sınav ekranı yerine ---------- */
  if (typeof loadExamsPlatform === 'function') {
    var origLoad = loadExamsPlatform;
    loadExamsPlatform = async function () {
      var r = await origLoad.apply(this, arguments);
      var ss = document.getElementById('exam-setup-screen'); if (ss) ss.style.display = '';
      await loadData();
      return r;
    };
    window.loadExamsPlatform = loadExamsPlatform;
  }
  if (typeof cancelExam === 'function') { cancelExam = function () { exitBtn.click(); }; window.cancelExam = cancelExam; }
  if (typeof backToExamSetup === 'function') { backToExamSetup = function () { closeHall(); return loadExamsPlatform(); }; window.backToExamSetup = backToExamSetup; }
  paintAll();
})();
