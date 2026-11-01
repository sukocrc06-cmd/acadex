/* ==========================================================================
   ACADEX · ÇALIŞMA DEFTERİ+ (js/acadex-defter-plus.js + css/acadex-defter-plus.css), 02.11.2026
   Defterin tasarım kabuğunun (acadex-ink.js) üstüne gelen görsel ve işlevsel katman:
     - sayfa çevirme (spiralin üstünden kalkan yaprak) + defter kapağı (ad, ders etiketi, renk)
     - kalemlik (araç kutusu bir kalem kabı; seçilen kalem kaptan çıkar), masa lambası, kupa, cetvel
     - çıkartmalar: washi bant, damgalar, renkli post-it; ders sekmeleri sayfanın kenarında
     - akıllı çizim: kement (seç / taşı / boyutlandır / sil), şekil düzeltme, cetvelle düz çizgi
     - sayfa başlığı, tarih, ders etiketi; derslere göre bölümler; sürükleyerek sıralama; arama
     - şablon galerisi (canlı önizlemeli; 5 yeni şablon + Cornell, zihin haritası, SWOT)
     - odak modu (tam ekran + pomodoro + "bugün çalıştın" damgası)
     - bütün defteri (ya da bir dersi) kapaklı PDF olarak indirme
   VERİ: yeni her şey sayfanın mevcut "elements" dizisine yeni öğe türleri olarak yazılır
   (type 'meta' = sayfa bilgisi, type 'deco' = bant/damga/post-it/şablon çerçevesi).
   notebooks tablosunda şema değişikliği YOK; eski sayfalar aynen açılır.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('notebook-view');
  if (!root || !root.classList.contains('axn')) return;
  var W = window, D = document;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var store = {
    get: function (k) { try { return localStorage.getItem('acadex.defter.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('acadex.defter.' + k, v); } catch (e) {} }
  };
  var sget = function (k) { try { return sessionStorage.getItem('acadex.defter.' + k); } catch (e) { return null; } };
  var sset = function (k, v) { try { sessionStorage.setItem('acadex.defter.' + k, v); } catch (e) {} };
  var EN = function () { return lsafe(function () { return (localStorage.getItem('acadexUILang') || 'tr') === 'en'; }, false); };
  var uid = function (p) { return p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); };
  var alertMsg = function (kind, msg) { if (typeof showDashboardAlert === 'function') showDashboardAlert(kind, msg); };
  var MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var ymd = function (d) { d = d ? new Date(d) : new Date(); return isNaN(d) ? '' : d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var dshort = function (s) { var d = new Date(s); return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };

  /* ---------- motorun küresel durumu (dashboard.js) ---------- */
  var pages = function () { return lsafe(function () { return notebookPages; }, []) || []; };
  var curNo = function () { return lsafe(function () { return currentNotebookPageNumber; }, 1); };
  var cur = function () { var n = curNo(); return pages().filter(function (p) { return p.page_number === n; })[0] || null; };
  var setDirty = function () { try { notebookHasUnsavedChanges = true; } catch (e) {} };
  var rec = function () { if (typeof recordNotebookState === 'function') recordNotebookState(); };
  var ov = function () { return D.getElementById('notebook-overlay-container'); };
  var vp = function () { return D.getElementById('canvas-viewport'); };
  var cv = function () { return D.getElementById('notebook-canvas'); };
  var ctx = function () { var c = cv(); return c && c.getContext('2d'); };
  var mode = function () { return lsafe(function () { return notebookMode; }, 'pen'); };
  var book = $('[data-book]'), nb = $('.nb'), paperSel = $('[data-paper]');
  if (!book || !nb || !vp() || !cv()) return;

  /* ---------- ders renkleri ---------- */
  var PAL = ['#2F6BFF', '#C9483B', '#1E8A55', '#B4511F', '#7A4FD6', '#0E8C9A', '#C23A7A', '#8A6D1F'];
  var colorOf = function (name) {
    name = String(name || '').trim().toLocaleLowerCase('tr'); if (!name) return '#9AA6C0';
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PAL[h % PAL.length];
  };

  /* =====================================================================
     1) SAYFA BİLGİSİ (başlık, tarih, ders, sıra) — elements içinde { type:'meta' }
     ===================================================================== */
  var state = { meta: {} };
  var metaOf = function (p) {
    var m = ((p && p.elements) || []).filter(function (e) { return e && e.type === 'meta'; })[0];
    return (m && m.content) || {};
  };
  var hasKeys = function (o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] !== '' && o[k] != null) return true; return false; };
  var writeMetaInto = function (p, m) {
    if (!p) return;
    var els = (p.elements || []).filter(function (e) { return !(e && e.type === 'meta'); });
    if (hasKeys(m)) els.push({ type: 'meta', id: 'meta', content: JSON.parse(JSON.stringify(m)) });
    p.elements = els;
  };
  /* Bulutta yalnızca bu sayfanın bilgisini güncelle (açık olmayan sayfalar için). */
  var persistPage = async function (p) {
    if (!p || p.is_shared) return false;
    var u = lsafe(function () { return currentUser; }, null), sb = lsafe(function () { return supabaseClient; }, null);
    if (!u || !sb) return false;
    try {
      var r = await sb.from('notebooks').upsert({ user_id: u.id, page_number: p.page_number, canvas_data: p.canvas_data || null, elements: p.elements || [], updated_at: new Date().toISOString() }, { onConflict: 'user_id,page_number' });
      if (r && r.error) throw r.error;
      return true;
    } catch (e) { console.warn('Defter sayfası güncellenemedi:', e); return false; }
  };
  /* bg: sıra / kapak gibi arka plan bilgisi. Açık sayfada kaydedilmemiş değişiklik yoksa
     sayfa "kaydedilmedi" durumuna düşmeden hemen buluta yazılır (bellekteki kopya ekranla aynıdır). */
  var setPageMeta = function (p, patch, bg) {
    if (!p) return;
    var isCur = p.page_number === curNo();
    var m = Object.assign({}, isCur ? state.meta : metaOf(p), patch);
    for (var k in m) if (m[k] === '' || m[k] == null) delete m[k];
    writeMetaInto(p, m);
    if (!isCur) { persistPage(p); return; }
    state.meta = m;
    if (bg && !lsafe(function () { return notebookHasUnsavedChanges; }, true)) persistPage(p); else setDirty();
  };
  var keyOf = function (p) { var o = metaOf(p).ord; return typeof o === 'number' && isFinite(o) ? o : p.page_number; };
  var sortPages = function () { pages().sort(function (a, b) { return (keyOf(a) - keyOf(b)) || (a.page_number - b.page_number); }); };
  var titleOf = function (p) { return (p && p.page_number === curNo() ? state.meta.title : metaOf(p).title) || ''; };
  var courseOf = function (p) { return (p && p.page_number === curNo() ? state.meta.course : metaOf(p).course) || ''; };
  var courses = function () {
    var s = {}, out = [];
    pages().forEach(function (p) { var c = courseOf(p); if (c && !s[c.toLocaleLowerCase('tr')]) { s[c.toLocaleLowerCase('tr')] = 1; out.push(c); } });
    return out;
  };

  /* ---------- sayfa bilgisi şeridi (spiralin üstünde) ---------- */
  var metaBar = D.createElement('div');
  metaBar.className = 'dp-meta';
  metaBar.innerHTML =
    '<label class="dp-course" title="Ders etiketi: aynı dersin sayfaları bir bölüm olur"><i aria-hidden="true"></i><span class="vh">Ders etiketi</span>' +
    '<input type="text" list="dp-course-list" maxlength="40" placeholder="ders etiketi" autocomplete="off" data-m="course"></label>' +
    '<datalist id="dp-course-list"></datalist>' +
    '<label class="dp-title"><span class="vh">Sayfa başlığı</span><input type="text" maxlength="80" placeholder="başlıksız sayfa" autocomplete="off" data-m="title"></label>' +
    '<label class="dp-date"><span class="vh">Sayfa tarihi</span><input type="date" data-m="date"></label>' +
    '<span class="dp-pomo-chip" data-pchip hidden></span>';
  book.parentNode.insertBefore(metaBar, book);
  var mIn = function (k) { return metaBar.querySelector('[data-m="' + k + '"]'); };
  var paintMeta = function () {
    var p = cur(), m = state.meta;
    mIn('title').value = m.title || '';
    mIn('course').value = m.course || '';
    mIn('date').value = m.date || ymd(p && (p.created_at || p.updated_at)) || ymd();
    metaBar.style.setProperty('--c', colorOf(m.course));
    metaBar.querySelector('#dp-course-list').innerHTML = courses().concat(lsafe(function () { return (notebookCards || []).map(function (c) { return c.course_tag; }); }, []))
      .filter(function (c, i, a) { return c && a.indexOf(c) === i; }).slice(0, 30).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
  };
  ['title', 'course', 'date'].forEach(function (k) {
    var inp = mIn(k);
    inp.addEventListener('change', function () {
      var patch = {}; patch[k] = inp.value.trim(); setPageMeta(cur(), patch);
      metaBar.style.setProperty('--c', colorOf(state.meta.course)); paintTabs(); rec();
    });
    inp.addEventListener('input', function () { if (k === 'course') metaBar.style.setProperty('--c', colorOf(inp.value)); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  });

  /* ---------- ders sekmeleri (sayfanın sağ kenarında) ---------- */
  var tabs = D.createElement('nav');
  tabs.className = 'dp-tabs'; tabs.setAttribute('aria-label', 'Ders bölümleri');
  $('.ax-page-wrap').appendChild(tabs);
  var firstOf = function (course) {
    var lc = course.toLocaleLowerCase('tr');
    return pages().filter(function (p) { return courseOf(p).toLocaleLowerCase('tr') === lc; })[0];
  };
  var paintTabs = function () {
    var list = courses(), mine = (state.meta.course || '').toLocaleLowerCase('tr');
    tabs.hidden = !list.length;
    tabs.innerHTML = list.slice(0, 9).map(function (c, i) {
      var n = pages().filter(function (p) { return courseOf(p).toLocaleLowerCase('tr') === c.toLocaleLowerCase('tr'); }).length;
      return '<button type="button" class="dp-tab' + (c.toLocaleLowerCase('tr') === mine ? ' on' : '') + '" style="--c:' + colorOf(c) + ';--i:' + i + '" data-tab="' + esc(c) + '" title="' + esc(c) + ' · ' + n + ' sayfa"><span>' + esc(c) + '</span></button>';
    }).join('');
  };
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return;
    var p = firstOf(b.getAttribute('data-tab'));
    if (p && p.page_number !== curNo()) goPage(p.page_number);
  });

  /* ---------- sayfa türü (kâğıt) sayfaya özel olabilir ---------- */
  var setPaperView = function (v) {
    ['lined', 'grid', 'dots', 'plain', 'cornell'].forEach(function (k) { book.classList.toggle('p-' + k, k === v); });
    if (paperSel) paperSel.value = v;
  };
  var applyPaper = function () { var v = state.meta.paper || store.get('paper') || 'lined'; if (paperSel && paperSel.value !== v) setPaperView(v); };
  if (paperSel) paperSel.addEventListener('change', function () { if (state.meta.paper && state.meta.paper !== paperSel.value) setPageMeta(cur(), { paper: paperSel.value }); });

  /* =====================================================================
     2) ÇIKARTMALAR: washi bant, damga, post-it, şablon çerçevesi ({ type:'deco' })
     ===================================================================== */
  var TAPES = { kraft: '#D9B98A', nokta: '#F4A7B9', cizgi: '#8FC1E8', kare: '#B7D88B', mint: '#9ADBC5', lila: '#C7B3F0' };
  var STAMPS = {
    yildiz: { t: '★', c: '#D9472B', l: 'yıldız' },
    ok: { t: '➜', c: '#2F6BFF', l: 'ok' },
    onemli: { t: 'ÖNEMLİ', c: '#C9483B', l: 'önemli' },
    sinav: { t: 'SINAVDA ÇIKAR', c: '#7A4FD6', l: 'sınavda çıkar' },
    tekrar: { t: 'TEKRAR ET', c: '#B4511F', l: 'tekrar et' },
    tamam: { t: '✓ ANLADIM', c: '#1E8A55', l: 'anladım' },
    calistin: { t: 'BUGÜN ÇALIŞTIN', c: '#1E8A55', l: 'bugün çalıştın' }
  };
  var POSTITS = { sari: '#FFE97A', pembe: '#FFB8CF', mavi: '#AFDCFF', yesil: '#BDF0A8' };
  var decoInner = function (k, v, color, text) {
    if (k === 'tape') return '<i class="dp-tape-s" style="--t:' + (TAPES[v] || color || '#D9B98A') + '"></i>';
    if (k === 'stamp') {
      var s = STAMPS[v] || STAMPS.yildiz;
      var big = s.t.length <= 2;
      return '<span class="dp-stamp-s' + (big ? ' big' : '') + '" style="--sc:' + (color || s.c) + '"><b>' + esc(s.t) + '</b>' + (text ? '<small>' + esc(text) + '</small>' : '') + '</span>';
    }
    if (k === 'postit') return '<div class="dp-postit-s" style="--pc:' + (POSTITS[v] || color || POSTITS.sari) + '"><div class="dp-pt" contenteditable="false" spellcheck="false">' + esc(text || '') + '</div></div>';
    if (k === 'tpl') return tplSvg(v, color);
    return '';
  };
  var addDeco = function (it, fresh) {
    var o = ov(); if (!o || !it) return null;
    var c = it.content || {}, k = c.kind, el = D.createElement('div');
    el.className = 'draggable-element dp-deco dp-k-' + k + (fresh && !RM ? ' dp-stick' : '');
    el.id = it.id || uid('deco');
    el.setAttribute('data-type', 'deco'); el.setAttribute('data-kind', k); el.setAttribute('data-v', c.v || '');
    if (c.color) el.setAttribute('data-color', c.color);
    var rot = +it.rotation || 0; el.setAttribute('data-rot', rot); el.style.setProperty('--r', rot + 'deg');
    el.style.left = (+it.left || 0) + 'px'; el.style.top = (+it.top || 0) + 'px';
    if (it.width) el.style.width = it.width + 'px';
    if (it.height) el.style.height = it.height + 'px';
    el.innerHTML = (k === 'tpl' ? '' : '<button class="delete-overlay-btn" type="button" title="Kaldır" aria-label="Kaldır" onclick="removeOverlayElement(\'' + el.id + '\')">×</button>') + decoInner(k, c.v, c.color, c.text);
    if (c.text != null && k !== 'postit') el.setAttribute('data-text', c.text);
    o.appendChild(el);
    if (k !== 'tpl' && typeof makeElementDraggable === 'function') makeElementDraggable(el);
    if (k === 'postit') {
      if (typeof addNoteResizeHandle === 'function') addNoteResizeHandle(el);
      var pt = el.querySelector('.dp-pt');
      el.addEventListener('dblclick', function (e) { if (e.target.closest('.delete-overlay-btn')) return; pt.contentEditable = 'true'; el.classList.add('editing'); pt.focus(); });
      pt.addEventListener('blur', function () { pt.contentEditable = 'false'; el.classList.remove('editing'); setDirty(); rec(); });
    }
    if (fresh) setTimeout(function () { el.classList.remove('dp-stick'); }, 900);
    return el;
  };
  var decoData = function (el) {
    var k = el.getAttribute('data-kind'), c = { kind: k, v: el.getAttribute('data-v') || '' };
    if (el.getAttribute('data-color')) c.color = el.getAttribute('data-color');
    if (k === 'postit') { var pt = el.querySelector('.dp-pt'); c.text = pt ? pt.innerText.replace(/ /g, ' ').trim() : ''; }
    else if (el.hasAttribute('data-text')) c.text = el.getAttribute('data-text');
    return { type: 'deco', id: el.id, left: parseFloat(el.style.left) || 0, top: parseFloat(el.style.top) || 0, width: el.offsetWidth, height: el.offsetHeight, rotation: +el.getAttribute('data-rot') || 0, content: c };
  };
  var DECO_SIZE = { tape: [150, 34], stamp: [128, 70], postit: [170, 160] };
  var makeDeco = function (kind, v, x, y, extra) {
    var sz = DECO_SIZE[kind] || [120, 60];
    if (kind === 'stamp' && (STAMPS[v] || {}).t && STAMPS[v].t.length <= 2) sz = [74, 74];
    var rot = kind === 'tape' ? Math.round(Math.random() * 16 - 8) : kind === 'stamp' ? Math.round(Math.random() * 14 - 7) : Math.round(Math.random() * 6 - 3);
    var it = { type: 'deco', id: uid('deco'), left: Math.round(x - sz[0] / 2), top: Math.round(y - sz[1] / 2), width: sz[0], height: sz[1], rotation: rot, content: Object.assign({ kind: kind, v: v }, extra || {}) };
    var o = ov(), w = o ? o.clientWidth : 700, h = o ? o.clientHeight : 760;
    it.left = Math.max(4, Math.min(w - sz[0] - 4, it.left)); it.top = Math.max(4, Math.min(h - sz[1] - 4, it.top));
    var el = addDeco(it, true);
    setDirty(); rec();
    if (kind === 'postit' && el) setTimeout(function () { el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }, RM ? 0 : 450);
    return el;
  };

  /* ---------- şablon çerçeveleri (dokunulmaz arka plan; kalem üstünden yazar) ---------- */
  var TPL = {
    timeline: [660, 170], formul: [680, 660], kavram: [680, 668]
  };
  var tplSvg = function (v, color) {
    var c = color || '#2F6BFF', sz = TPL[v] || [400, 200], w = sz[0], h = sz[1], s = '';
    if (v === 'timeline') {
      s += '<path class="dp-tl-ln" d="M10 85 H' + (w - 22) + '" stroke="' + c + '" stroke-width="4" stroke-linecap="round" fill="none"/>';
      s += '<path d="M' + (w - 30) + ' 72 L' + (w - 8) + ' 85 L' + (w - 30) + ' 98 Z" fill="' + c + '"/>';
      for (var i = 0; i < 5; i++) {
        var x = 60 + i * 130, up = i % 2 === 0;
        s += '<path d="M' + x + ' 85 V' + (up ? 30 : 140) + '" stroke="' + c + '" stroke-width="2" stroke-dasharray="4 5" fill="none" opacity=".6"/>';
        s += '<circle cx="' + x + '" cy="85" r="10" fill="#fff" stroke="' + c + '" stroke-width="4"/>';
      }
    } else if (v === 'formul') {
      for (var r = 0; r < 3; r++) for (var k = 0; k < 2; k++) {
        var X = 6 + k * 340, Y = 6 + r * 220;
        s += '<rect x="' + X + '" y="' + Y + '" width="326" height="204" rx="14" fill="' + c + '" fill-opacity=".04" stroke="' + c + '" stroke-width="2"/>';
        s += '<path d="M' + X + ' ' + (Y + 44) + ' H' + (X + 326) + '" stroke="' + c + '" stroke-width="1.5" opacity=".5"/>';
        s += '<path d="M' + (X + 14) + ' ' + (Y + 150) + ' H' + (X + 312) + '" stroke="' + c + '" stroke-width="1" stroke-dasharray="3 5" opacity=".55"/>';
      }
    } else if (v === 'kavram') {
      for (var q = 0; q < 4; q++) for (var j = 0; j < 2; j++) {
        var x0 = 6 + j * 340, y0 = 6 + q * 166;
        s += '<rect x="' + x0 + '" y="' + y0 + '" width="326" height="150" rx="6" fill="none" stroke="#AEB9D2" stroke-width="1.6"/>';
        s += '<path d="M' + x0 + ' ' + (y0 + 34) + ' H' + (x0 + 326) + '" stroke="#C9483B" stroke-width="1.4" opacity=".55"/>';
        s += '<path d="M' + (x0 + 128) + ' ' + (y0 + 40) + ' V' + (y0 + 142) + '" stroke="#AEB9D2" stroke-width="1.4" stroke-dasharray="5 5"/>';
      }
    }
    return '<svg class="dp-tpl-s" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" aria-hidden="true">' + s + '</svg>';
  };

  /* =====================================================================
     3) MOTORA BAĞLANMA: çiz / yakala / geçmiş / kaydet
     ===================================================================== */
  if (typeof renderCurrentPageData === 'function') {
    var origRender = renderCurrentPageData;
    renderCurrentPageData = function () {
      dropSel(); 
      var r = origRender.apply(this, arguments);
      var p = cur();
      state.meta = Object.assign({}, metaOf(p));
      ((p && p.elements) || []).forEach(function (it) { if (it && it.type === 'deco') addDeco(it, false); });
      paintMeta(); paintTabs(); applyPaper();
      return r;
    };
    W.renderCurrentPageData = renderCurrentPageData;
  }
  if (typeof captureCurrentOverlayElements === 'function') {
    var origCap = captureCurrentOverlayElements;
    captureCurrentOverlayElements = function () {
      var arr = origCap.apply(this, arguments) || [];
      var o = ov();
      if (o) $$('.dp-deco', o).forEach(function (el) { arr.push(decoData(el)); });
      if (hasKeys(state.meta)) arr.push({ type: 'meta', id: 'meta', content: JSON.parse(JSON.stringify(state.meta)) });
      return arr;
    };
    W.captureCurrentOverlayElements = captureCurrentOverlayElements;
  }
  /* GERİ AL BAŞLANGICI SAYFANIN KENDİSİ (02.11.2026). Sayfa değişirken geçmiş, yeni sayfa
     çizilmeden ÖNCE ekrandan alınıyordu: yeni sayfada bir çizgi çizip geri alınca ESKİ
     sayfanın çizimi ve notları yeni sayfaya geliyor, kaydedilince oraya yazılıyordu.
     Başlangıç anı artık sayfanın kayıtlı verisinden kurulur. */
  if (typeof resetNotebookHistory === 'function') {
    var origReset = resetNotebookHistory;
    resetNotebookHistory = function () {
      var p = cur();
      if (!p) return origReset.apply(this, arguments);
      try {
        notebookUndoStack = [{ canvasDataURL: p.canvas_data || null, elements: (p.elements || []).slice() }];
        notebookRedoStack = [];
        if (typeof updateUndoRedoButtons === 'function') updateUndoRedoButtons();
      } catch (e) { return origReset.apply(this, arguments); }
    };
    W.resetNotebookHistory = resetNotebookHistory;
  }
  if (typeof W.saveNotebookData === 'function') {
    var origSave = W.saveNotebookData;
    var plusSave = async function () { commitSel(); return origSave.apply(this, arguments); };
    try { saveNotebookData = plusSave; } catch (e) {}
    W.saveNotebookData = plusSave;
  }
  if (typeof loadNotebookData === 'function') {
    var origLoad = loadNotebookData;
    loadNotebookData = async function () {
      var r = await origLoad.apply(this, arguments);
      var n = curNo(); sortPages();
      if (typeof updatePageControlsUI === 'function') updatePageControlsUI();
      if (cur() && cur().page_number === n) { paintTabs(); }
      maybeCover();
      return r;
    };
    W.loadNotebookData = loadNotebookData;
  }

  /* =====================================================================
     4) SAYFA ÇEVİRME: yaprak spiralin üstünden kalkar (ileri) ya da iner (geri)
     ===================================================================== */
  var pageWrap = $('.ax-page-wrap');
  var idxOf = function (n) { return pages().findIndex(function (p) { return p.page_number === n; }); };
  var makeSheet = function () {
    if (RM) return null;
    var v = vp(), c = cv(); if (!v || !c) return null;
    var sh = D.createElement('div'); sh.className = 'dp-sheet'; sh.setAttribute('aria-hidden', 'true');
    var paper = v.querySelector('.paper'); if (paper) sh.appendChild(paper.cloneNode(true));
    try { var img = new Image(); img.src = c.toDataURL('image/png'); img.className = 'dp-sheet-ink'; img.alt = ''; sh.appendChild(img); } catch (e) {}
    var o = ov(); if (o) { var oc = o.cloneNode(true); oc.removeAttribute('id'); oc.className = 'dp-sheet-ov'; $$('[id]', oc).forEach(function (x) { x.removeAttribute('id'); }); sh.appendChild(oc); }
    sh.appendChild(D.createElement('i')).className = 'dp-sheet-shade';
    return sh;
  };
  var playFlip = function (sheet, dir) {
    if (!sheet || RM) return;
    var v = vp();
    book.classList.remove('dp-flipping'); void book.offsetWidth; book.classList.add('dp-flipping');
    if (dir > 0) { sheet.classList.add('up'); pageWrap.appendChild(sheet); }
    else { sheet.classList.add('under'); pageWrap.insertBefore(sheet, pageWrap.firstChild); v.classList.add('dp-drop'); }
    setTimeout(function () { sheet.remove(); v.classList.remove('dp-drop'); book.classList.remove('dp-flipping'); }, 820);
  };
  var turning = false;
  var turnTo = async function (n, leave) {
    if (turning) return;
    commitSel();
    var from = curNo(); if (n == null || n === from) return;
    turning = true;
    try {
      var a = idxOf(from), sheet = makeSheet();
      await leave();
      if (curNo() !== from) playFlip(sheet, idxOf(curNo()) > a ? 1 : -1);
    } finally { turning = false; }
  };
  var goPage = function (n) {
    return turnTo(n, async function () {
      if (!(await confirmLeaveNotebookPage('Sayfa değiştirmeden', 'switching pages'))) return;
      currentNotebookPageNumber = n; notebookHasUnsavedChanges = false;
      resetNotebookHistory(); renderCurrentPageData();
    });
  };
  if (typeof navigateNotebookPage === 'function') {
    var origNav = navigateNotebookPage;
    navigateNotebookPage = function (dir) {
      var i = idxOf(curNo()) + dir, p = pages()[i];
      if (!p) return origNav.apply(this, arguments);
      var self = this, args = arguments;
      return turnTo(p.page_number, function () { return origNav.apply(self, args); });
    };
    W.navigateNotebookPage = navigateNotebookPage;
  }
  if (typeof selectPageFromOverview === 'function') {
    selectPageFromOverview = function (n) { closeOverview(); return goPage(n); };
    W.selectPageFromOverview = selectPageFromOverview;
  }
  /* klavye: defter odaktayken PageUp/PageDown sayfa çevirir */
  D.addEventListener('keydown', function (e) {
    if (!root.classList.contains('active')) return;
    var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'PageDown') { e.preventDefault(); navigateNotebookPage(1); }
    else if (e.key === 'PageUp') { e.preventDefault(); navigateNotebookPage(-1); }
  });

  /* =====================================================================
     5) KAPAK: ilk açılışta (oturum başına bir kez) adı, ders etiketi ve rengiyle
     ===================================================================== */
  var COVERS = ['#1A2A5C', '#C9483B', '#1E8A55', '#B4511F', '#7A4FD6', '#0E8C9A', '#2B2B2B', '#D9A400'];
  var semester = function () { var d = new Date(), m = d.getMonth(); return m >= 8 || m < 1 ? d.getFullYear() + ' güz dönemi' : d.getFullYear() + ' bahar dönemi'; };
  var defName = function () {
    return lsafe(function () { return currentUser.user_metadata.full_name; }, '') || lsafe(function () { return D.querySelector('.who b, .u-name, [data-user-name]').textContent.trim(); }, '') || 'Çalışma defterim';
  };
  var coverData = function () {
    var local = lsafe(function () { return JSON.parse(store.get('cover') || 'null'); }, null) || {};
    var first = pages()[0], cloud = first ? ((first.page_number === curNo() ? state.meta : metaOf(first)).cover || {}) : {};
    return Object.assign({ name: defName(), label: semester(), color: COVERS[0] }, local, cloud);
  };
  var cover = D.createElement('div');
  cover.className = 'dp-cover'; cover.hidden = true;
  cover.setAttribute('role', 'dialog'); cover.setAttribute('aria-label', 'Defter kapağı');
  cover.innerHTML =
    '<div class="dp-cov-face">' +
      '<i class="dp-cov-band" aria-hidden="true"></i><i class="dp-cov-corner" aria-hidden="true"></i>' +
      '<div class="dp-cov-label"><small>acadex · çalışma defteri</small><b data-cv="name"></b><span data-cv="label"></span><em data-cv="info"></em></div>' +
      '<div class="dp-cov-acts"><button type="button" class="dp-cov-open">defteri aç</button><button type="button" class="dp-cov-edit">kapağı düzenle</button></div>' +
      '<form class="dp-cov-form" hidden>' +
        '<label><span>defterin adı</span><input name="name" maxlength="40" autocomplete="off"></label>' +
        '<label><span>ders / dönem etiketi</span><input name="label" maxlength="40" autocomplete="off"></label>' +
        '<div class="dp-cov-cols" role="radiogroup" aria-label="Kapak rengi">' + COVERS.map(function (c) { return '<button type="button" role="radio" aria-checked="false" data-cc="' + c + '" style="--c:' + c + '" aria-label="Kapak rengi ' + c + '"></button>'; }).join('') + '</div>' +
        '<div class="dp-cov-fa"><button type="submit" class="dp-cov-save">kaydet</button><button type="button" class="dp-cov-cancel">vazgeç</button></div>' +
      '</form>' +
    '</div>';
  pageWrap.appendChild(cover);
  var covForm = cover.querySelector('form'), pickColor = null;
  var paintCover = function () {
    var d = coverData(), ps = pages();
    cover.style.setProperty('--cc', d.color);
    cover.querySelector('[data-cv="name"]').textContent = d.name;
    cover.querySelector('[data-cv="label"]').textContent = d.label;
    var last = ps.reduce(function (m, p) { return p.updated_at && p.updated_at > m ? p.updated_at : m; }, '');
    cover.querySelector('[data-cv="info"]').textContent = ps.length + ' sayfa' + (last ? ' · son yazılan ' + dshort(last) : '');
  };
  var showCover = function () {
    paintCover(); covForm.hidden = true; cover.classList.remove('opening');
    cover.hidden = false; book.classList.add('dp-covered');
    setTimeout(function () { var b = cover.querySelector('.dp-cov-open'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {} }, 60);
  };
  var openCover = function () {
    sset('coverSeen', '1');
    var done = function () { cover.hidden = true; cover.classList.remove('opening'); book.classList.remove('dp-covered'); };
    if (RM) { done(); return; }
    cover.classList.add('opening'); book.classList.remove('dp-flipping'); void book.offsetWidth; book.classList.add('dp-flipping');
    setTimeout(function () { done(); book.classList.remove('dp-flipping'); }, 900);
  };
  var maybeCover = function () { if (!sget('coverSeen') && root.classList.contains('active')) showCover(); };
  cover.querySelector('.dp-cov-open').addEventListener('click', openCover);
  cover.querySelector('.dp-cov-face').addEventListener('dblclick', function (e) { if (!e.target.closest('form,button')) openCover(); });
  cover.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); openCover(); } });
  cover.querySelector('.dp-cov-edit').addEventListener('click', function () {
    var d = coverData(); covForm.hidden = false; covForm.name.value = d.name; covForm.label.value = d.label; pickColor = d.color;
    $$('[data-cc]', covForm).forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-cc') === pickColor)); });
    covForm.name.focus();
  });
  covForm.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cc]'); if (!b) return;
    pickColor = b.getAttribute('data-cc'); cover.style.setProperty('--cc', pickColor);
    $$('[data-cc]', covForm).forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
  });
  covForm.querySelector('.dp-cov-cancel').addEventListener('click', function () { covForm.hidden = true; paintCover(); });
  covForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = { name: covForm.name.value.trim() || defName(), label: covForm.label.value.trim(), color: pickColor || COVERS[0] };
    store.set('cover', JSON.stringify(d));
    if (pages()[0]) setPageMeta(pages()[0], { cover: d }, true);
    covForm.hidden = true; paintCover();
    alertMsg('success', 'Kapak kaydedildi ✓');
  });
  if ('MutationObserver' in W) new MutationObserver(function () { if (root.classList.contains('active') && pages().length) maybeCover(); }).observe(root, { attributes: true, attributeFilter: ['class'] });

  /* =====================================================================
     6) YENİ ARAÇLAR: kement, cetvel, çıkartma; şekil düzeltme; odak; kapak
     ===================================================================== */
  var tools = $('.tools'), inks = $('#notebook-contextual-panel'), caseR = $('.case-r'), pagesBar = $('.pages-bar');
  var mkTool = function (id, label, title, svg) {
    var b = D.createElement('button');
    b.type = 'button'; b.className = 'tl dp-tool'; b.id = id; b.title = title; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = svg + '<span>' + label + '</span>';
    tools.appendChild(b); return b;
  };
  var bLasso = mkTool('dp-tool-lasso', 'kement', 'Kement: çizimi ve notları seç, taşı, büyüt, sil',
    '<svg viewBox="0 0 30 64" aria-hidden="true"><path class="tl-paper" d="M4 26 H26 V58 H4 Z"/><path class="tl-ink dp-ants" d="M9 40 C8 32 21 30 22 37 C23 44 13 47 11 43 C10 41 13 39 15 41 L17 52"/></svg>');
  var bRuler = mkTool('dp-tool-ruler', 'cetvel', 'Cetvel: kenarına yaslanan çizgi dümdüz çıkar',
    '<svg viewBox="0 0 30 64" aria-hidden="true"><path class="dp-rl-b" d="M8 8 H22 V60 H8 Z"/><path class="tl-ink" d="M8 16 H14 M8 24 H17 M8 32 H14 M8 40 H17 M8 48 H14 M8 56 H17"/></svg>');
  var bStick = mkTool('dp-tool-stick', 'çıkartma', 'Çıkartma: washi bant, damga, post-it',
    '<svg viewBox="0 0 30 64" aria-hidden="true"><path class="tl-paper" d="M3 24 H27 V50 L19 58 H3 Z"/><path class="dp-st-c" d="M19 58 V50 H27 Z"/><path class="dp-st-a" d="M9 30 L10.8 34 L15 34.4 L11.8 37.2 L12.8 41.4 L9 39.2 L5.2 41.4 L6.2 37.2 L3 34.4 L7.2 34 Z" transform="translate(4 0)"/><rect class="dp-st-t" x="6" y="44" width="12" height="5" rx="1" transform="rotate(-8 12 46)"/></svg>');

  var bFix = D.createElement('button');
  bFix.type = 'button'; bFix.className = 'dp-fix'; bFix.title = 'Akıllı şekil: titrek daire → daire, çizgi, ok, kare, üçgen';
  var fixOn = store.get('shapeFix') !== '0';
  bFix.setAttribute('aria-pressed', String(fixOn));
  bFix.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 C4 6 9 4 12 4.5 C17 5 20 8 19.6 12.4 C19.2 17 15 20 11 19.6" stroke-dasharray="2.4 2.6"/><circle cx="12" cy="12" r="7.6"/></svg><span>düzelt</span>';
  inks.appendChild(bFix);
  bFix.addEventListener('click', function () { fixOn = !fixOn; bFix.setAttribute('aria-pressed', String(fixOn)); store.set('shapeFix', fixOn ? '1' : '0'); toast(fixOn ? 'akıllı şekil açık: çizdiğin daire, çizgi, ok ve kareler düzelir' : 'akıllı şekil kapalı'); });

  var bFocus = D.createElement('button');
  bFocus.type = 'button'; bFocus.className = 'ib2 dp-focus-b'; bFocus.title = 'Odak modu: tam ekran, pomodoro, sessiz masa';
  bFocus.setAttribute('aria-label', 'Odak modu'); bFocus.setAttribute('aria-pressed', 'false');
  bFocus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 13 V9 M9.5 3.5 H14.5 M12 3.5 V5.5"/></svg>';
  var fullBtn = caseR.querySelector('[data-full]'); caseR.insertBefore(bFocus, fullBtn);

  var bCover = D.createElement('button');
  bCover.type = 'button'; bCover.className = 'ib2 txt dp-cover-b'; bCover.textContent = 'kapak'; bCover.title = 'Defterin kapağı: adı, ders etiketi, rengi';
  pagesBar.insertBefore(bCover, $('#btn-page-delete'));
  bCover.addEventListener('click', showCover);

  var toastEl = D.createElement('div'); toastEl.className = 'dp-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
  pageWrap.appendChild(toastEl);
  var toastT = null;
  var toast = function (t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2600); };

  /* ---------- araç seçimi ---------- */
  var plus = null, placing = null;
  var engineBtns = function () { return $$('.tools .tl:not(.dp-tool)'); };
  var setPlus = function (name) {
    commitSel();
    if (root.classList.contains('hl-mode')) { var h = $('#ax-tool-hl'); if (h) h.click(); }
    plus = name;
    engineBtns().forEach(function (b) { b.classList.remove('active'); });
    [bLasso, bStick].forEach(function (b) { b.classList.toggle('active', (name === 'lasso' && b === bLasso) || (name === 'place' && b === bStick)); });
    root.classList.toggle('dp-m-lasso', name === 'lasso'); root.classList.toggle('dp-m-place', name === 'place');
  };
  var exitPlus = function (restore) {
    if (!plus) return;
    plus = null; placing = null; ghost.hidden = true;
    bLasso.classList.remove('active'); bStick.classList.remove('active');
    root.classList.remove('dp-m-lasso', 'dp-m-place');
    if (restore && typeof setNotebookMode === 'function') setNotebookMode(mode() === 'shape' ? 'pen' : mode());
  };
  engineBtns().forEach(function (b) { b.addEventListener('click', function () { commitSel(); exitPlus(false); closeTray(); }, true); });
  bLasso.addEventListener('click', function () { if (plus === 'lasso') exitPlus(true); else { setPlus('lasso'); toast('kement: seçmek istediğin yerin çevresini çiz'); } });

  /* ---------- çıkartma tepsisi ---------- */
  var tray = D.createElement('div');
  tray.className = 'dp-tray'; tray.hidden = true; tray.setAttribute('role', 'dialog'); tray.setAttribute('aria-label', 'Çıkartmalar');
  tray.innerHTML =
    '<p class="dp-tr-h">washi bant</p><div class="dp-tr-row">' + Object.keys(TAPES).map(function (k) { return '<button type="button" class="dp-tr-tape" data-pk="tape" data-pv="' + k + '" style="--t:' + TAPES[k] + '" aria-label="' + k + ' bant"><i></i></button>'; }).join('') + '</div>' +
    '<p class="dp-tr-h">damga</p><div class="dp-tr-row">' + Object.keys(STAMPS).filter(function (k) { return k !== 'calistin'; }).map(function (k) { var s = STAMPS[k]; return '<button type="button" class="dp-tr-stamp" data-pk="stamp" data-pv="' + k + '" style="--sc:' + s.c + '" aria-label="' + s.l + ' damgası"><b>' + esc(s.t) + '</b></button>'; }).join('') + '</div>' +
    '<p class="dp-tr-h">post-it</p><div class="dp-tr-row">' + Object.keys(POSTITS).map(function (k) { return '<button type="button" class="dp-tr-pt" data-pk="postit" data-pv="' + k + '" style="--pc:' + POSTITS[k] + '" aria-label="' + k + ' post-it"><i></i></button>'; }).join('') + '</div>' +
    '<p class="dp-tr-tip">birini seç, sonra sayfada yapıştıracağın yere dokun</p>';
  bStick.parentNode.appendChild(tray);
  var closeTray = function () { tray.hidden = true; bStick.setAttribute('aria-expanded', 'false'); };
  bStick.setAttribute('aria-haspopup', 'dialog'); bStick.setAttribute('aria-expanded', 'false');
  bStick.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!tray.hidden) { closeTray(); if (plus === 'place') exitPlus(true); return; }
    tray.hidden = false; bStick.setAttribute('aria-expanded', 'true');
    tray.style.left = Math.max(0, bStick.offsetLeft - 120) + 'px';
    var f = tray.querySelector('button'); if (f) f.focus();
  });
  tray.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeTray(); bStick.focus(); } });
  D.addEventListener('pointerdown', function (e) { if (!tray.hidden && !tray.contains(e.target) && e.target !== bStick && !bStick.contains(e.target)) closeTray(); });
  var ghost = D.createElement('div'); ghost.className = 'dp-ghost'; ghost.hidden = true; vp().appendChild(ghost);
  var freeSpot = function () {
    var v = vp(), r = v.getBoundingClientRect(), top = Math.max(0, -r.top + 120);
    return { x: Math.min(r.width - 120, 220 + Math.random() * 260), y: Math.min(r.height - 90, top + 60 + Math.random() * 160) };
  };
  tray.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pk]'); if (!b) return;
    var k = b.getAttribute('data-pk'), v = b.getAttribute('data-pv');
    closeTray();
    if (e.detail === 0) { var s = freeSpot(); makeDeco(k, v, s.x, s.y); return; } /* klavyeyle: hemen boş bir yere */
    setPlus('place'); placing = { kind: k, v: v };
    ghost.className = 'dp-ghost dp-k-' + k; ghost.innerHTML = decoInner(k, v); ghost.hidden = true;
    var sz = DECO_SIZE[k] || [120, 60]; ghost.style.width = sz[0] + 'px'; ghost.style.height = sz[1] + 'px';
    toast('yapıştıracağın yere dokun · vazgeçmek için Esc');
  });
  vp().addEventListener('pointermove', function (e) {
    if (plus !== 'place' || !placing) return;
    var r = vp().getBoundingClientRect(); ghost.hidden = false;
    ghost.style.left = (e.clientX - r.left - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (e.clientY - r.top - ghost.offsetHeight / 2) + 'px';
  });
  vp().addEventListener('pointerleave', function () { ghost.hidden = true; });

  /* =====================================================================
     7) KALEMİ YAKALAMA: çıkartma yerleştirme, kement, cetvel, şekil düzeltme
     ===================================================================== */
  var cssPt = function (e) { var r = vp().getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  var scale = function () { var c = cv(), r = c.getBoundingClientRect(); return r.width ? c.width / r.width : 1; };
  var penColor = function () { return lsafe(function () { return currentPenColor; }, '#000'); };
  var penSize = function () { return +lsafe(function () { return currentBrushSize; }, 4) || 4; };
  var stop = function (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); };
  var onCanvas = function (e) { return e.target === cv() || e.target === ov() || e.target === vp() || (e.target.classList && e.target.classList.contains('paper')); };
  var stroke = null, lasso = null, rdraw = null;

  vp().addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (plus === 'place' && placing) {
      if (e.target.closest('.dp-selbox,.dp-ruler,.delete-overlay-btn')) return;
      stop(e); var p = cssPt(e); makeDeco(placing.kind, placing.v, p.x, p.y); exitPlus(true); return;
    }
    if (!onCanvas(e)) return;
    if (plus === 'lasso') { stop(e); startLasso(e); return; }
    /* kalem kullanılan tablette parmak sayfayı kaydırır (acadex-ink.js): o dokunuş çizgi değildir */
    if (e.pointerType === 'touch' && store.get('penOnly') === '1') return;
    if (mode() === 'pen' && ruler.on) { var q = rulerSnap(cssPt(e)); if (q) { stop(e); startRulerDraw(e, q); return; } }
    if (mode() === 'pen' && fixOn && !root.classList.contains('hl-mode')) {
      var c = cv(), x = ctx();
      stroke = { id: e.pointerId, pts: [cssPt(e)], before: null, n: lsafe(function () { return notebookUndoStack.length; }, 0) };
      try { stroke.before = x.getImageData(0, 0, c.width, c.height); } catch (er) { stroke = null; }
    }
  }, true);
  vp().addEventListener('pointermove', function (e) {
    if (stroke && e.pointerId === stroke.id) {
      var evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      (evs && evs.length ? evs : [e]).forEach(function (ev) { stroke.pts.push(cssPt(ev)); });
    }
  }, true);
  W.addEventListener('pointerup', function (e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    var s = stroke; stroke = null;
    setTimeout(function () { fixStroke(s); }, 0);
  });
  W.addEventListener('pointercancel', function (e) { if (stroke && e.pointerId === stroke.id) stroke = null; });

  /* ---------- akıllı şekil ---------- */
  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  var plen = function (P) { var L = 0; for (var i = 1; i < P.length; i++) L += dist(P[i - 1], P[i]); return L; };
  var segDev = function (p, a, b) { var dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / l; };
  var maxDev = function (P, a, b) { var m = 0; P.forEach(function (p) { m = Math.max(m, segDev(p, a, b)); }); return m; };
  var bbox = function (P) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; P.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
  var rdp = function (P, eps) {
    if (P.length < 3) return P.slice();
    var a = P[0], b = P[P.length - 1], idx = 0, md = 0;
    for (var i = 1; i < P.length - 1; i++) { var d = segDev(P[i], a, b); if (d > md) { md = d; idx = i; } }
    if (md > eps) { var l = rdp(P.slice(0, idx + 1), eps), r = rdp(P.slice(idx), eps); return l.slice(0, -1).concat(r); }
    return [a, b];
  };
  var corners = function (P, eps) {
    /* kapalı yol: en uzak iki noktadan böl, iki yarıyı ayrı sadeleştir */
    var a = 0, b = 0, md = 0;
    for (var i = 0; i < P.length; i++) { var d = dist(P[0], P[i]); if (d > md) { md = d; b = i; } }
    var h1 = rdp(P.slice(a, b + 1), eps), h2 = rdp(P.slice(b).concat([P[0]]), eps);
    var pts = h1.slice(0, -1).concat(h2.slice(0, -1));
    /* birbirine çok yakın köşeleri birleştir */
    var out = [];
    pts.forEach(function (p) { if (!out.length || dist(out[out.length - 1], p) > eps * 1.2) out.push(p); });
    if (out.length > 2 && dist(out[0], out[out.length - 1]) < eps * 1.2) out.pop();
    return out;
  };
  var recognize = function (P) {
    if (P.length < 6) return null;
    var L = plen(P); if (L < 40) return null;
    var bb = bbox(P), diag = Math.hypot(bb.w, bb.h), a = P[0], z = P[P.length - 1], gap = dist(a, z);
    /* el yazısı korunur: harf boyundaki (≈40 px altı) çizgiler ve halkalar düzeltilmez */
    if (gap >= 60 && gap > 0.9 * L && maxDev(P, a, z) < Math.max(5, 0.045 * gap)) return { t: 'line', a: a, z: z };
    var ti = 0, md = 0; P.forEach(function (p) { md = Math.max(md, dist(a, p)); }); for (ti = 0; ti < P.length - 1 && dist(a, P[ti]) < 0.96 * md; ti++);
    var tip = P[ti], main = P.slice(0, ti + 1), tail = P.slice(ti), Lm = plen(main), Lt = plen(tail);
    if (ti > 3 && md > 50 && md > 0.88 * Lm && maxDev(main, a, tip) < Math.max(6, 0.06 * md) && Lt > 14 && Lt < 0.7 * Lm &&
        tail.every(function (p) { return dist(p, tip) < Math.max(36, 0.38 * md); }) && tail.some(function (p) { return dist(p, tip) > 10; })) return { t: 'arrow', a: a, z: tip };
    if (gap < 0.25 * Math.max(bb.w, bb.h) && Math.max(bb.w, bb.h) >= 44 && Math.min(bb.w, bb.h) >= 24 && L > 0.8 * (bb.w + bb.h)) {
      var cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, rx = bb.w / 2, ry = bb.h / 2, err = 0;
      P.forEach(function (p) { err += Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1); }); err /= P.length;
      var C = corners(P, 0.1 * diag);
      if (C.length === 3) return { t: 'poly', pts: C };
      if (C.length === 4) {
        var ok = C.every(function (p, i) {
          var q = C[(i + 3) % 4], r = C[(i + 1) % 4], v1 = { x: q.x - p.x, y: q.y - p.y }, v2 = { x: r.x - p.x, y: r.y - p.y };
          var cos = (v1.x * v2.x + v1.y * v2.y) / ((Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)) || 1);
          return Math.abs(cos) < 0.35;
        });
        if (ok) {
          var axis = C.every(function (p, i) { var r = C[(i + 1) % 4], an = Math.abs(Math.atan2(r.y - p.y, r.x - p.x) * 180 / Math.PI) % 90; return an < 12 || an > 78; });
          return axis ? { t: 'rect', x: bb.x, y: bb.y, w: bb.w, h: bb.h } : { t: 'poly', pts: C };
        }
      }
      if (err < 0.14) {
        if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.16) { var rr = (rx + ry) / 2; return { t: 'ellipse', cx: cx, cy: cy, rx: rr, ry: rr, circle: true }; }
        return { t: 'ellipse', cx: cx, cy: cy, rx: rx, ry: ry };
      }
    }
    return null;
  };
  var pathOf = function (g, s) {
    var x = new Path2D();
    if (g.t === 'line' || g.t === 'arrow') {
      x.moveTo(g.a.x * s, g.a.y * s); x.lineTo(g.z.x * s, g.z.y * s);
      if (g.t === 'arrow') {
        var an = Math.atan2(g.z.y - g.a.y, g.z.x - g.a.x), hl = Math.min(26, Math.max(12, dist(g.a, g.z) * 0.18)) * s;
        x.moveTo(g.z.x * s, g.z.y * s); x.lineTo(g.z.x * s - hl * Math.cos(an - 0.45), g.z.y * s - hl * Math.sin(an - 0.45));
        x.moveTo(g.z.x * s, g.z.y * s); x.lineTo(g.z.x * s - hl * Math.cos(an + 0.45), g.z.y * s - hl * Math.sin(an + 0.45));
      }
    } else if (g.t === 'rect') x.rect(g.x * s, g.y * s, g.w * s, g.h * s);
    else if (g.t === 'ellipse') x.ellipse(g.cx * s, g.cy * s, g.rx * s, g.ry * s, 0, 0, Math.PI * 2);
    else if (g.t === 'poly') { g.pts.forEach(function (p, i) { if (i) x.lineTo(p.x * s, p.y * s); else x.moveTo(p.x * s, p.y * s); }); x.closePath(); }
    return x;
  };
  var NAMES = { line: 'çizgi', arrow: 'ok', rect: 'dikdörtgen', ellipse: 'elips', poly: 'çokgen' };
  var fixStroke = function (s) {
    if (!s || !s.before) return;
    var g = recognize(s.pts); if (!g) return;
    var x = ctx(), k = scale();
    x.save(); x.globalCompositeOperation = 'source-over';
    x.putImageData(s.before, 0, 0);
    x.strokeStyle = penColor(); x.lineWidth = penSize(); x.lineCap = 'round'; x.lineJoin = 'round';
    x.stroke(pathOf(g, k)); x.restore();
    setDirty();
    try { if (notebookUndoStack.length > s.n) notebookUndoStack.pop(); } catch (er) {}
    rec();
    flashShape(g);
    toast((g.circle ? 'daire' : g.t === 'poly' ? (g.pts.length === 3 ? 'üçgen' : 'dörtgen') : NAMES[g.t]) + ' düzeltildi · istemezsen Ctrl+Z');
  };
  var flashShape = function (g) {
    if (RM) return;
    var v = vp(), svg = D.createElementNS('http://www.w3.org/2000/svg', 'svg'), p = D.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.setAttribute('class', 'dp-morph'); svg.setAttribute('aria-hidden', 'true');
    var d = '';
    if (g.t === 'line' || g.t === 'arrow') d = 'M' + g.a.x + ' ' + g.a.y + ' L' + g.z.x + ' ' + g.z.y;
    else if (g.t === 'rect') d = 'M' + g.x + ' ' + g.y + ' h' + g.w + ' v' + g.h + ' h' + (-g.w) + ' Z';
    else if (g.t === 'ellipse') d = 'M' + (g.cx - g.rx) + ' ' + g.cy + ' a' + g.rx + ' ' + g.ry + ' 0 1 0 ' + (2 * g.rx) + ' 0 a' + g.rx + ' ' + g.ry + ' 0 1 0 ' + (-2 * g.rx) + ' 0';
    else d = g.pts.map(function (q, i) { return (i ? 'L' : 'M') + q.x + ' ' + q.y; }).join(' ') + ' Z';
    p.setAttribute('d', d); p.setAttribute('pathLength', '100'); svg.appendChild(p); v.appendChild(svg);
    setTimeout(function () { svg.remove(); }, 900);
  };

  /* ---------- cetvel ---------- */
  var ruler = { on: false, x: 380, y: 300, a: 0, len: 560, th: 64 };
  var rEl = D.createElement('div');
  rEl.className = 'dp-ruler'; rEl.hidden = true; rEl.setAttribute('role', 'slider'); rEl.setAttribute('tabindex', '0');
  rEl.setAttribute('aria-label', 'Cetvel açısı'); rEl.setAttribute('aria-valuemin', '-180'); rEl.setAttribute('aria-valuemax', '180');
  (function () {
    var t = '', cm = 37.8;
    for (var i = 0; i * cm / 10 <= ruler.len - 20; i++) {
      var x = 14 + i * cm / 10, h = i % 10 === 0 ? 18 : i % 5 === 0 ? 12 : 7;
      t += '<path d="M' + x.toFixed(1) + ' 0 V' + h + '"/>';
      if (i % 10 === 0) t += '<text x="' + x.toFixed(1) + '" y="30">' + (i / 10) + '</text>';
    }
    rEl.innerHTML = '<svg class="dp-r-ticks" viewBox="0 0 ' + ruler.len + ' 64" aria-hidden="true">' + t + '</svg>' +
      '<b class="dp-r-a" aria-hidden="true">0°</b>' +
      '<span class="dp-r-k" title="Döndür" aria-hidden="true"></span>' +
      '<button type="button" class="dp-r-x" aria-label="Cetveli kaldır">×</button>';
  })();
  vp().appendChild(rEl);
  var paintRuler = function () {
    rEl.style.left = (ruler.x - ruler.len / 2) + 'px'; rEl.style.top = (ruler.y - ruler.th / 2) + 'px';
    rEl.style.transform = 'rotate(' + ruler.a + 'deg)';
    var deg = Math.round(((ruler.a % 360) + 540) % 360 - 180);
    rEl.querySelector('.dp-r-a').textContent = Math.abs(deg) + '°';
    rEl.setAttribute('aria-valuenow', String(deg)); rEl.setAttribute('aria-valuetext', Math.abs(deg) + ' derece');
  };
  var setRuler = function (on) {
    ruler.on = on; rEl.hidden = !on; bRuler.classList.toggle('active', on); bRuler.setAttribute('aria-pressed', String(on));
    if (on) {
      var r = vp().getBoundingClientRect();
      ruler.x = r.width / 2; ruler.y = Math.max(120, Math.min(r.height - 120, -r.top + W.innerHeight / 2));
      paintRuler(); rEl.classList.remove('dp-in'); void rEl.offsetWidth; rEl.classList.add('dp-in');
      toast('cetvel: kenarı boyunca çiz · döndürmek için uçtaki düğme, fare tekerleği ya da ok tuşları');
    }
  };
  bRuler.addEventListener('click', function () { setRuler(!ruler.on); });
  rEl.querySelector('.dp-r-x').addEventListener('click', function (e) { e.stopPropagation(); setRuler(false); });
  var snapA = function (a) { var s = Math.round(a / 45) * 45; return Math.abs(a - s) < 3 ? s : a; };
  rEl.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.dp-r-x')) return;
    e.preventDefault(); e.stopPropagation();
    var turn = !!e.target.closest('.dp-r-k'), p0 = cssPt(e), x0 = ruler.x, y0 = ruler.y;
    try { rEl.setPointerCapture(e.pointerId); } catch (er) {}
    var mv = function (ev) {
      var p = cssPt(ev);
      if (turn) ruler.a = snapA(Math.atan2(p.y - ruler.y, p.x - ruler.x) * 180 / Math.PI);
      else { ruler.x = x0 + p.x - p0.x; ruler.y = y0 + p.y - p0.y; }
      paintRuler();
    };
    var up = function () { W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); W.removeEventListener('pointercancel', up); };
    W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
  });
  rEl.addEventListener('wheel', function (e) { e.preventDefault(); ruler.a = snapA(ruler.a + (e.deltaY > 0 ? 1 : -1) * (e.shiftKey ? 15 : 1)); paintRuler(); }, { passive: false });
  rEl.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); ruler.a += (k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 15 : 1); paintRuler(); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); ruler.y += k === 'ArrowDown' ? 8 : -8; paintRuler(); }
    else if (k === 'Escape' || k === 'Delete') { e.preventDefault(); setRuler(false); bRuler.focus(); }
  });
  var rulerSnap = function (p) {
    var an = ruler.a * Math.PI / 180, ux = Math.cos(an), uy = Math.sin(an), nx = -uy, ny = ux;
    var dx = p.x - ruler.x, dy = p.y - ruler.y, t = dx * ux + dy * uy, d = dx * nx + dy * ny, half = ruler.th / 2;
    if (Math.abs(t) > ruler.len / 2 || Math.abs(d) < half - 2 || Math.abs(d) > half + 30) return null;
    return { ux: ux, uy: uy, nx: nx * Math.sign(d), ny: ny * Math.sign(d), t: t };
  };
  var startRulerDraw = function (e, q) {
    var c = cv(), x = ctx(), k = scale(), off = ruler.th / 2 + penSize() / 2 + 1;
    var at = function (t) { return { x: ruler.x + q.ux * t + q.nx * off, y: ruler.y + q.uy * t + q.ny * off }; };
    var before; try { before = x.getImageData(0, 0, c.width, c.height); } catch (er) { return; }
    var t0 = q.t, hl = root.classList.contains('hl-mode');
    rdraw = { id: e.pointerId };
    try { vp().setPointerCapture(e.pointerId); } catch (er) {}
    var paint = function (t1) {
      var a = at(t0), b = at(t1);
      x.save(); x.globalCompositeOperation = 'source-over'; x.putImageData(before, 0, 0);
      x.strokeStyle = penColor(); x.lineWidth = penSize(); x.lineCap = hl ? 'butt' : 'round';
      x.beginPath(); x.moveTo(a.x * k, a.y * k); x.lineTo(b.x * k, b.y * k); x.stroke(); x.restore();
    };
    paint(t0);
    var tOf = function (ev) { var p = cssPt(ev); return Math.max(-ruler.len / 2, Math.min(ruler.len / 2, (p.x - ruler.x) * q.ux + (p.y - ruler.y) * q.uy)); };
    var mv = function (ev) { if (ev.pointerId === rdraw.id) paint(tOf(ev)); };
    var up = function (ev) {
      if (ev.pointerId !== rdraw.id) return;
      vp().removeEventListener('pointermove', mv, true); vp().removeEventListener('pointerup', up, true); vp().removeEventListener('pointercancel', up, true);
      rdraw = null; setDirty(); rec();
    };
    vp().addEventListener('pointermove', mv, true); vp().addEventListener('pointerup', up, true); vp().addEventListener('pointercancel', up, true);
  };

  /* ---------- kement: seç, taşı, boyutlandır, sil ---------- */
  var sel = null, NS = 'http://www.w3.org/2000/svg';
  var lsvg = D.createElementNS(NS, 'svg'); lsvg.setAttribute('class', 'dp-lsvg'); lsvg.setAttribute('aria-hidden', 'true');
  var lpath = D.createElementNS(NS, 'path'); lsvg.appendChild(lpath); vp().appendChild(lsvg);
  var inPoly = function (p, P) {
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
      if (((P[i].y > p.y) !== (P[j].y > p.y)) && (p.x < (P[j].x - P[i].x) * (p.y - P[i].y) / ((P[j].y - P[i].y) || 1e-9) + P[i].x)) c = !c;
    }
    return c;
  };
  var startLasso = function (e) {
    commitSel();
    lasso = { id: e.pointerId, pts: [cssPt(e)] };
    try { vp().setPointerCapture(e.pointerId); } catch (er) {}
    lsvg.classList.add('on'); lpath.setAttribute('d', '');
    var mv = function (ev) {
      if (!lasso || ev.pointerId !== lasso.id) return;
      lasso.pts.push(cssPt(ev));
      lpath.setAttribute('d', lasso.pts.map(function (q, i) { return (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); }).join(' '));
    };
    var up = function (ev) {
      if (!lasso || ev.pointerId !== lasso.id) return;
      vp().removeEventListener('pointermove', mv, true); vp().removeEventListener('pointerup', up, true); vp().removeEventListener('pointercancel', up, true);
      var P = lasso.pts; lasso = null; lsvg.classList.remove('on');
      makeSel(P);
    };
    vp().addEventListener('pointermove', mv, true); vp().addEventListener('pointerup', up, true); vp().addEventListener('pointercancel', up, true);
  };
  var makeSel = function (P) {
    if (P.length < 4) return;
    var bb = bbox(P); if (bb.w < 8 && bb.h < 8) return;
    var c = cv(), x = ctx(), k = scale(), fc = null;
    var bx = Math.max(0, Math.floor(bb.x)), by = Math.max(0, Math.floor(bb.y));
    var bw = Math.min(c.width / k - bx, Math.ceil(bb.w) + 2), bh = Math.min(c.height / k - by, Math.ceil(bb.h) + 2);
    var poly = function (g, ox, oy) { g.beginPath(); P.forEach(function (q, i) { var X = (q.x - ox) * k, Y = (q.y - oy) * k; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); };
    if (bw > 1 && bh > 1) {
      fc = D.createElement('canvas'); fc.width = Math.max(1, Math.round(bw * k)); fc.height = Math.max(1, Math.round(bh * k));
      var g = fc.getContext('2d'); g.save(); poly(g, bx, by); g.clip(); g.drawImage(c, -bx * k, -by * k); g.restore();
      var data = null; try { data = g.getImageData(0, 0, fc.width, fc.height).data; } catch (er) {}
      var any = false; if (data) for (var i = 3; i < data.length; i += 16) if (data[i] > 8) { any = true; break; }
      if (!any) fc = null;
    }
    var els = $$('.draggable-element', ov()).filter(function (el) {
      var l = parseFloat(el.style.left) || el.offsetLeft, t = parseFloat(el.style.top) || el.offsetTop;
      return inPoly({ x: l + el.offsetWidth / 2, y: t + el.offsetHeight / 2 }, P);
    });
    if (!fc && !els.length) { toast('bu alanda seçilecek bir şey yok'); return; }
    if (fc) { x.save(); x.globalCompositeOperation = 'source-over'; poly(x, 0, 0); x.clip(); x.clearRect(bx * k, by * k, bw * k, bh * k); x.restore(); }
    var U = fc ? { x0: bx, y0: by, x1: bx + bw, y1: by + bh } : { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    var items = els.map(function (el) {
      var l = parseFloat(el.style.left) || el.offsetLeft, t = parseFloat(el.style.top) || el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
      U.x0 = Math.min(U.x0, l); U.y0 = Math.min(U.y0, t); U.x1 = Math.max(U.x1, l + w); U.y1 = Math.max(U.y1, t + h);
      el.classList.add('dp-sel-el');
      return { el: el, l: l, t: t, w: w, h: h, sw: !!el.style.width, sh: !!el.style.height, fs: parseFloat(el.style.fontSize) || 0 };
    });
    var box = D.createElement('div'); box.className = 'dp-selbox'; box.tabIndex = -1;
    box.innerHTML = '<div class="dp-sel-bar"><button type="button" data-s="del" aria-label="Seçileni sil">sil</button><button type="button" data-s="ok" aria-label="Seçimi bitir">bitti ✓</button></div><span class="dp-sel-h" aria-hidden="true"></span>';
    if (fc) { fc.className = 'dp-sel-fc'; box.insertBefore(fc, box.firstChild); }
    vp().appendChild(box);
    sel = { fc: fc, bx: bx, by: by, bw: bw, bh: bh, ox: U.x0, oy: U.y0, ow: U.x1 - U.x0, oh: U.y1 - U.y0, x: U.x0, y: U.y0, s: 1, items: items, box: box };
    paintSel();
    try { box.focus({ preventScroll: true }); } catch (er) {}
    box.addEventListener('pointerdown', selDown);
    box.addEventListener('click', function (ev) { var b = ev.target.closest('[data-s]'); if (!b) return; if (b.getAttribute('data-s') === 'del') deleteSel(); else commitSel(); });
    box.addEventListener('keydown', function (ev) {
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); deleteSel(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); cancelSel(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); commitSel(); }
      else if (/^Arrow/.test(ev.key)) { ev.preventDefault(); var st = ev.shiftKey ? 10 : 2; sel.x += ev.key === 'ArrowLeft' ? -st : ev.key === 'ArrowRight' ? st : 0; sel.y += ev.key === 'ArrowUp' ? -st : ev.key === 'ArrowDown' ? st : 0; paintSel(); }
    });
    toast('sürükle: taşı · köşe: büyüt/küçült · sil ya da bitti');
  };
  var paintSel = function () {
    if (!sel) return;
    var s = sel.s, b = sel.box;
    b.style.left = sel.x + 'px'; b.style.top = sel.y + 'px'; b.style.width = (sel.ow * s) + 'px'; b.style.height = (sel.oh * s) + 'px';
    if (sel.fc) { var f = sel.fc.style; f.left = ((sel.bx - sel.ox) * s) + 'px'; f.top = ((sel.by - sel.oy) * s) + 'px'; f.width = (sel.bw * s) + 'px'; f.height = (sel.bh * s) + 'px'; }
    sel.items.forEach(function (it) {
      var st = it.el.style, tx = it.el.getAttribute('data-type');
      st.left = (sel.x + (it.l - sel.ox) * s) + 'px'; st.top = (sel.y + (it.t - sel.oy) * s) + 'px';
      if (tx === 'text') { if (it.fs) st.fontSize = Math.max(8, Math.round(it.fs * s)) + 'px'; }
      else if (s !== 1 || it.sw) { st.width = (it.w * s) + 'px'; if (tx !== 'sticky' || it.sh || s !== 1) { st.height = (it.h * s) + 'px'; if (tx === 'sticky') st.minHeight = '0'; } }
    });
  };
  var selDown = function (e) {
    if (e.target.closest('[data-s]')) return;
    e.preventDefault(); e.stopPropagation();
    var rs = !!e.target.closest('.dp-sel-h'), p0 = cssPt(e), x0 = sel.x, y0 = sel.y, s0 = sel.s, box = sel.box;
    try { box.setPointerCapture(e.pointerId); } catch (er) {}
    var mv = function (ev) {
      if (!sel) return; var p = cssPt(ev);
      if (rs) sel.s = Math.max(0.2, Math.min(5, s0 * Math.max((sel.ow * s0 + p.x - p0.x) / (sel.ow * s0), (sel.oh * s0 + p.y - p0.y) / (sel.oh * s0))));
      else { sel.x = x0 + p.x - p0.x; sel.y = y0 + p.y - p0.y; }
      paintSel();
    };
    var up = function () { W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); W.removeEventListener('pointercancel', up); };
    W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
  };
  var endSel = function () { if (!sel) return; sel.items.forEach(function (it) { it.el.classList.remove('dp-sel-el'); }); sel.box.remove(); sel = null; };
  var dropSel = function () { if (sel) { sel.box.remove(); sel = null; } if (lasso) { lasso = null; lsvg.classList.remove('on'); } };
  var commitSel = function () {
    if (!sel) return;
    var s = sel.s, moved = s !== 1 || sel.x !== sel.ox || sel.y !== sel.oy;
    if (sel.fc) { var x = ctx(), k = scale(); x.save(); x.globalCompositeOperation = 'source-over'; x.drawImage(sel.fc, (sel.x + (sel.bx - sel.ox) * s) * k, (sel.y + (sel.by - sel.oy) * s) * k, sel.bw * s * k, sel.bh * s * k); x.restore(); }
    endSel();
    if (moved) { setDirty(); rec(); }
  };
  var cancelSel = function () { if (!sel) return; sel.x = sel.ox; sel.y = sel.oy; sel.s = 1; paintSel(); sel.items.forEach(function (it) { if (!it.sw) it.el.style.width = ''; if (!it.sh) it.el.style.height = ''; }); commitSel(); };
  var deleteSel = function () { if (!sel) return; sel.items.forEach(function (it) { it.el.remove(); }); sel.fc = null; endSel(); setDirty(); rec(); toast('seçilen kısım silindi · geri almak için Ctrl+Z'); };
  /* seçim açıkken Ctrl+Z seçimi geri koyar; kaydet ve Ctrl+S önce seçimi yerine yapıştırır */
  D.addEventListener('keydown', function (e) {
    if (!root.classList.contains('active')) return;
    if (e.key === 'Escape' && plus) { exitPlus(true); closeTray(); }
    if (!sel) return;
    var k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) { e.preventDefault(); e.stopImmediatePropagation(); cancelSel(); }
    else if ((e.ctrlKey || e.metaKey) && k === 's') commitSel();
  }, true);
  var saveB = $('#btn-save-notebook');
  if (saveB) saveB.addEventListener('pointerdown', commitSel, true);
  ['btn-undo-notebook', 'btn-redo-notebook'].forEach(function (id) { var b = D.getElementById(id); if (b) b.addEventListener('click', function (e) { if (sel) { e.stopImmediatePropagation(); e.preventDefault(); cancelSel(); } }, true); });

  /* =====================================================================
     8) MASA: lamba (gece temasında yanar), kupa, cetvel ve çıkartma kısayolları
     ===================================================================== */
  var lamp = D.createElement('div');
  lamp.className = 'dp-lamp';
  lamp.innerHTML = '<svg viewBox="0 0 92 96" aria-hidden="true"><path class="dp-l-arm" d="M66 92 H86 M76 92 V70 L52 40 L28 30"/><circle class="dp-l-j" cx="52" cy="40" r="4"/><path class="dp-l-head" d="M36 14 L8 34 C4 38 8 44 14 42 L44 30 Z"/><ellipse class="dp-l-bulb" cx="11" cy="40" rx="7" ry="4" transform="rotate(-30 11 40)"/></svg>' +
    '<button type="button" class="dp-l-sw" aria-pressed="false" aria-label="Masa lambası" title="Masa lambası: aç / kapat"></button>';
    var glow = D.createElement('i'); glow.className = 'dp-glow'; glow.setAttribute('aria-hidden', 'true'); pageWrap.appendChild(glow);
  var lampUser = sget('lamp');
  var setLamp = function (on) { book.classList.toggle('dp-lamp-on', on); var dk = root.querySelector('.dp-desk'); if (dk) dk.classList.toggle('dp-lamp-on', on); lamp.querySelector('.dp-l-sw').setAttribute('aria-pressed', String(on)); };
  var autoLamp = function () { if (lampUser == null) setLamp(D.documentElement.classList.contains('ax-dark') || nb.classList.contains('dp-focus')); };
  lamp.querySelector('.dp-l-sw').addEventListener('click', function () { var on = !book.classList.contains('dp-lamp-on'); lampUser = on ? '1' : '0'; sset('lamp', lampUser); setLamp(on); });
  if (lampUser != null) setLamp(lampUser === '1'); else autoLamp();
  if ('MutationObserver' in W) new MutationObserver(autoLamp).observe(D.documentElement, { attributes: true, attributeFilter: ['class'] });

  var desk = D.createElement('div');
  desk.className = 'dp-desk';
  desk.innerHTML =
    '<div class="dp-mug" aria-hidden="true"><i class="dp-steam s1"></i><i class="dp-steam s2"></i><i class="dp-steam s3"></i><svg viewBox="0 0 70 64"><path class="dp-mug-b" d="M8 14 H52 V48 C52 56 46 60 38 60 H22 C14 60 8 56 8 48 Z"/><path class="dp-mug-h" d="M52 22 C66 22 66 44 52 44"/><ellipse class="dp-mug-t" cx="30" cy="14" rx="22" ry="5"/><text x="30" y="42">a</text></svg></div>' +
    '<button type="button" class="dp-desk-b dp-desk-ruler" data-d="ruler"><svg viewBox="0 0 120 24" aria-hidden="true"><rect x="1" y="2" width="118" height="20" rx="3"/><path d="M10 2 V12 M22 2 V8 M34 2 V12 M46 2 V8 M58 2 V12 M70 2 V8 M82 2 V12 M94 2 V8 M106 2 V12"/></svg><span>cetveli koy</span></button>' +
    '<button type="button" class="dp-desk-b dp-desk-st" data-d="stick"><i class="dp-ds-a"></i><i class="dp-ds-b"></i><i class="dp-ds-c"></i><span>çıkartma kutusu</span></button>' +
    '<button type="button" class="dp-desk-b dp-desk-focus" data-d="focus"><b data-today>0 dk</b><span>bugün odak · başlat</span></button>';
  book.parentNode.insertBefore(desk, book.nextSibling); desk.appendChild(lamp); setLamp(book.classList.contains('dp-lamp-on'));
  desk.addEventListener('click', function (e) {
    var b = e.target.closest('[data-d]'); if (!b) return;
    var d = b.getAttribute('data-d');
    if (d === 'ruler') { setRuler(true); try { rEl.focus({ preventScroll: true }); } catch (er) {} }
    else if (d === 'stick') { bStick.scrollIntoView({ block: 'nearest' }); bStick.click(); }
    else if (d === 'focus') enterFocus();
  });

  /* =====================================================================
     9) ODAK MODU: tam ekran + pomodoro + sessiz masa + "bugün çalıştın" damgası
     ===================================================================== */
  var todayKey = function () { return ymd(); };
  var focusLog = function () { return lsafe(function () { return JSON.parse(store.get('odak') || '{}'); }, {}) || {}; };
  var todayMin = function () { return +focusLog()[todayKey()] || 0; };
  var addMin = function (m) { var l = focusLog(); l[todayKey()] = (+l[todayKey()] || 0) + m; var ks = Object.keys(l).sort().slice(-60), o = {}; ks.forEach(function (k) { o[k] = l[k]; }); store.set('odak', JSON.stringify(o)); };
  var pomoEl = D.createElement('div');
  pomoEl.className = 'dp-pomo'; pomoEl.setAttribute('role', 'region'); pomoEl.setAttribute('aria-label', 'Pomodoro');
  pomoEl.innerHTML =
    '<div class="dp-p-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52" pathLength="100"/></svg>' +
    '<div class="dp-p-c"><b data-pt role="timer" aria-live="off">25:00</b><small data-pp>çalışma</small></div></div>' +
    '<div class="dp-p-acts"><button type="button" data-pa="go" class="go">başlat</button><button type="button" data-pa="reset">sıfırla</button></div>' +
    '<div class="dp-p-pre" role="radiogroup" aria-label="Süre">' + [[25, 5], [50, 10], [15, 3]].map(function (x, i) { return '<button type="button" role="radio" aria-checked="' + (i === 0) + '" data-pw="' + x[0] + '" data-pb="' + x[1] + '">' + x[0] + '/' + x[1] + '</button>'; }).join('') + '</div>' +
    '<p class="dp-p-today" data-today2></p>' +
    '<button type="button" class="dp-p-exit" data-pa="exit">odaktan çık</button>';
  nb.appendChild(pomoEl);
  var pomo = { phase: 'work', work: 25, brk: 5, left: 25 * 60000, end: 0, run: false, t: null };
  var mmss = function (ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); };
  var chip = metaBar.querySelector('[data-pchip]');
  var paintPomo = function () {
    var total = (pomo.phase === 'work' ? pomo.work : pomo.brk) * 60000, left = pomo.run ? pomo.end - Date.now() : pomo.left;
    pomoEl.querySelector('[data-pt]').textContent = mmss(left);
    pomoEl.querySelector('[data-pp]').textContent = pomo.phase === 'work' ? 'çalışma' : 'mola';
    pomoEl.querySelector('.fg').style.strokeDashoffset = String(100 - Math.max(0, Math.min(100, (1 - left / total) * 100)));
    pomoEl.classList.toggle('brk', pomo.phase !== 'work'); pomoEl.classList.toggle('run', pomo.run);
    var go = pomoEl.querySelector('[data-pa="go"]'); go.textContent = pomo.run ? 'duraklat' : (left < total ? 'devam' : 'başlat');
    var tm = todayMin(); pomoEl.querySelector('[data-today2]').textContent = 'bugün ' + tm + ' dk odaklandın';
    var dt = desk.querySelector('[data-today]'); if (dt) dt.textContent = tm + ' dk';
    chip.hidden = !pomo.run || nb.classList.contains('dp-focus');
    chip.textContent = '⏱ ' + mmss(left) + ' · ' + (pomo.phase === 'work' ? 'çalışma' : 'mola');
    nb.classList.toggle('dp-break', pomo.run && pomo.phase !== 'work');
  };
  var beep = function () {
    try {
      var A = W.AudioContext || W.webkitAudioContext; if (!A) return;
      var a = new A(), t = a.currentTime;
      [660, 880].forEach(function (f, i) { var o = a.createOscillator(), g = a.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.22); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.22 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.3); o.connect(g); g.connect(a.destination); o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.32); });
      setTimeout(function () { try { a.close(); } catch (e) {} }, 1200);
    } catch (e) {}
  };
  var stampToday = function (mins) {
    var r = vp().getBoundingClientRect(), top = Math.max(0, -r.top) + 80;
    var el = makeDeco('stamp', 'calistin', r.width - 120, Math.min(r.height - 60, top), { text: dshort(new Date()) + ' · ' + mins + ' dk' });
    if (el && !RM) { el.classList.add('dp-thump'); setTimeout(function () { el.classList.remove('dp-thump'); }, 1000); }
  };
  var tick = function () {
    if (!pomo.run) return;
    if (pomo.end - Date.now() <= 0) {
      if (pomo.phase === 'work') {
        addMin(pomo.work); stampToday(pomo.work); beep();
        toast('harika! ' + pomo.work + ' dakika çalıştın · şimdi ' + pomo.brk + ' dakika mola');
        pomo.phase = 'brk'; pomo.left = pomo.brk * 60000; pomo.end = Date.now() + pomo.left;
      } else {
        beep(); toast('mola bitti · hazır olduğunda yeni tura başla');
        pomo.phase = 'work'; pomo.run = false; pomo.left = pomo.work * 60000;
      }
    }
    paintPomo();
  };
  var pomoGo = function () {
    if (pomo.run) { pomo.left = pomo.end - Date.now(); pomo.run = false; }
    else { pomo.end = Date.now() + pomo.left; pomo.run = true; }
    clearInterval(pomo.t); if (pomo.run) pomo.t = setInterval(tick, 500);
    paintPomo();
  };
  pomoEl.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pa]'), pr = e.target.closest('[data-pw]');
    if (pr && !pomo.run) {
      pomo.work = +pr.getAttribute('data-pw'); pomo.brk = +pr.getAttribute('data-pb'); pomo.phase = 'work'; pomo.left = pomo.work * 60000;
      $$('[data-pw]', pomoEl).forEach(function (b) { b.setAttribute('aria-checked', String(b === pr)); }); paintPomo(); return;
    }
    if (!a) return;
    var k = a.getAttribute('data-pa');
    if (k === 'go') pomoGo();
    else if (k === 'reset') { pomo.run = false; clearInterval(pomo.t); pomo.phase = 'work'; pomo.left = pomo.work * 60000; paintPomo(); }
    else if (k === 'exit') exitFocus();
  });
  chip.addEventListener('click', enterFocus);
  var fixedFocus = false;
  function enterFocus() {
    if (nb.classList.contains('dp-focus')) return;
    commitSel(); exitPlus(true);
    nb.classList.add('dp-focus'); root.classList.add('dp-focusing'); bFocus.setAttribute('aria-pressed', 'true'); autoLamp(); paintPomo();
    var fail = function () { fixedFocus = true; nb.classList.add('dp-focus-fixed'); D.body.classList.add('dp-noscroll'); };
    if (nb.requestFullscreen && !D.fullscreenElement) { fixedFocus = false; nb.requestFullscreen().catch(fail); } else fail();
    setTimeout(function () { try { pomoEl.querySelector('[data-pa="go"]').focus({ preventScroll: true }); } catch (e) {} }, 200);
    if (typeof resizeCanvasToDisplaySize === 'function') setTimeout(resizeCanvasToDisplaySize, 260);
  }
  function exitFocus() {
    if (!nb.classList.contains('dp-focus')) return;
    nb.classList.remove('dp-focus', 'dp-focus-fixed'); root.classList.remove('dp-focusing'); D.body.classList.remove('dp-noscroll');
    bFocus.setAttribute('aria-pressed', 'false'); autoLamp(); paintPomo();
    if (D.fullscreenElement === nb) { try { D.exitFullscreen(); } catch (e) {} }
    fixedFocus = false;
  }
  bFocus.addEventListener('click', function () { if (nb.classList.contains('dp-focus')) exitFocus(); else enterFocus(); });
  D.addEventListener('fullscreenchange', function () { if (nb.classList.contains('dp-focus') && !fixedFocus && D.fullscreenElement !== nb) exitFocus(); });
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && fixedFocus && nb.classList.contains('dp-focus')) exitFocus(); });
  paintPomo();

  /* =====================================================================
     10) TÜM SAYFALAR: arama, derslere göre bölümler, sürükleyerek sıralama
     ===================================================================== */
  var strip = function (h) { var d = D.createElement('div'); d.innerHTML = String(h || '').replace(/<(br|\/div|\/p|\/li)\b[^>]*>/gi, '\n$&'); return (d.textContent || '').replace(/[ \t ]+/g, ' ').trim(); };
  var elsOf = function (p) { return p.page_number === curNo() ? captureCurrentOverlayElements() : (p.elements || []); };
  var textOf = function (p) {
    var out = [titleOf(p), courseOf(p)];
    elsOf(p).forEach(function (e) {
      if (!e) return; var c = e.content;
      if (e.type === 'text') out.push(strip(c));
      else if (e.type === 'sticky' && c) out.push(c.fileName || '', strip(c.excerpt));
      else if (e.type === 'table' && c) out.push((c.cells || []).map(strip).join(' '));
      else if (e.type === 'deco' && c && c.text) out.push(c.text);
      else if (e.title) out.push(e.title);
    });
    return out.join(' \n ');
  };
  var norm = function (t) { return String(t || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i'); };
  var ovm = D.createElement('div');
  ovm.className = 'dp-ov'; ovm.hidden = true;
  ovm.innerHTML =
    '<div class="dp-ov-box" role="dialog" aria-modal="true" aria-labelledby="dp-ov-t">' +
      '<header><h3 id="dp-ov-t" class="hd">tüm sayfalar <small data-ovn></small></h3><button type="button" class="dp-x" data-ovx aria-label="Kapat">×</button></header>' +
      '<div class="dp-ov-tools"><label class="dp-ov-q"><span class="vh">Sayfalarda ara</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.6 15.8 L20.4 20.6"/></svg><input type="search" placeholder="sayfalarda ara: başlık, yazı, not, tablo…" autocomplete="off" data-ovq></label>' +
      '<button type="button" class="dp-ov-sort" data-ovsort title="Aynı dersin sayfalarını yan yana getirir">derslere göre diz</button></div>' +
      '<div class="dp-ov-chips" role="group" aria-label="Bölüm" data-ovchips></div>' +
      '<div class="dp-ov-grid" data-ovgrid></div>' +
      '<p class="dp-ov-tip" data-ovtip>sırayı değiştirmek için ⋮⋮ tutamağından sürükle · klavyede tutamağa gelip ← →</p>' +
    '</div>';
  D.body.appendChild(ovm);
  var ovQ = ovm.querySelector('[data-ovq]'), ovGrid = ovm.querySelector('[data-ovgrid]'), ovFilter = '', ovLast = null;
  var thumbCache = {};
  var renderThumbs = function () {
    $$('.dp-th[data-th]', ovGrid).forEach(function (th) {
      var n = +th.getAttribute('data-th'), p = pages().filter(function (x) { return x.page_number === n; })[0]; if (!p) return;
      var key = n + ':' + (p.page_number === curNo() ? 'cur' + Date.now() : (p.updated_at || '') + (p.elements || []).length);
      if (thumbCache[n] && thumbCache[n].k === key) { th.style.backgroundImage = 'url(' + thumbCache[n].u + ')'; return; }
      renderPage(p, 0.3).then(function (c) { var u = c.toDataURL('image/jpeg', 0.8); thumbCache[n] = { k: key, u: u }; th.style.backgroundImage = 'url(' + u + ')'; }).catch(function () {});
    });
  };
  var paintOverview = function () {
    var q = norm(ovQ.value.trim()), ps = pages(), list = courses(), nUn = ps.filter(function (p) { return !courseOf(p); }).length;
    ovm.querySelector('[data-ovn]').textContent = ps.length + ' sayfa';
    ovm.querySelector('[data-ovchips]').innerHTML = '<button type="button" aria-pressed="' + (!ovFilter) + '" data-ovf="">hepsi</button>' +
      list.map(function (c) { return '<button type="button" aria-pressed="' + (ovFilter === c) + '" data-ovf="' + esc(c) + '" style="--c:' + colorOf(c) + '"><i></i>' + esc(c) + '</button>'; }).join('') +
      (nUn && list.length ? '<button type="button" aria-pressed="' + (ovFilter === '\u0000') + '" data-ovf="\u0000">etiketsiz</button>' : '');
    var canDrag = !q && !ovFilter;
    ovm.querySelector('[data-ovtip]').hidden = !canDrag || ps.length < 2;
    var html = '', shown = 0;
    ps.forEach(function (p, i) {
      var c = courseOf(p);
      if (ovFilter === '\u0000' ? !!c : ovFilter && c.toLocaleLowerCase('tr') !== ovFilter.toLocaleLowerCase('tr')) return;
      var snip = '';
      if (q) {
        var txt = textOf(p), at = norm(txt).indexOf(q); if (at < 0) return;
        var a = Math.max(0, at - 30), seg = txt.slice(a, at + q.length + 50).replace(/\s+/g, ' ');
        var rel = at - a;
        snip = '<em class="dp-snip">' + (a ? '…' : '') + esc(seg.slice(0, rel)) + '<mark>' + esc(seg.slice(rel, rel + q.length)) + '</mark>' + esc(seg.slice(rel + q.length)) + '…</em>';
      }
      shown++;
      var isCur = p.page_number === curNo(), t = titleOf(p), cnt = elsOf(p).filter(function (e) { return e && e.type !== 'meta'; }).length;
      var m = p.page_number === curNo() ? state.meta : metaOf(p), dt = m.date || ymd(p.updated_at);
      html += '<div class="dp-tile' + (isCur ? ' cur' : '') + '" data-pn="' + p.page_number + '" style="--c:' + colorOf(c) + '">' +
        '<button type="button" class="dp-tile-go" data-go="' + p.page_number + '"' + (isCur ? ' aria-current="page"' : '') + '>' +
          '<span class="dp-th" data-th="' + p.page_number + '"><b class="dp-th-n">' + (i + 1) + '</b></span>' +
          '<span class="dp-tile-t">' + esc(t || ('Sayfa ' + (i + 1))) + '</span>' +
          '<small>' + (c ? '<i class="dp-cc">' + esc(c) + '</i>' : '') + (dt ? dshort(dt) + ' · ' : '') + cnt + ' öğe' + (p.is_shared ? ' · paylaşılan' : '') + (isCur && lsafe(function () { return notebookHasUnsavedChanges; }, false) ? ' · <b class="dp-dirty">kaydedilmedi</b>' : '') + '</small>' + snip +
        '</button>' +
        (canDrag ? '<button type="button" class="dp-grip" data-grip="' + p.page_number + '" aria-label="Sayfa ' + (i + 1) + ' sırasını değiştir (← →)" title="sürükle">⋮⋮</button>' : '') +
      '</div>';
    });
    if (!q && !ovFilter) html += '<button type="button" class="dp-tile-add" data-ovadd><span>+</span>yeni sayfa</button>';
    if (!shown && (q || ovFilter)) html = '<p class="dp-ov-none">' + (q ? '“' + esc(ovQ.value.trim()) + '” hiçbir sayfada geçmiyor.' : 'bu bölümde sayfa yok.') + '</p>';
    ovGrid.innerHTML = html;
    renderThumbs();
  };
  var openOverview = function () {
    commitSel(); ovLast = D.activeElement; ovm.hidden = false; D.body.classList.add('dp-noscroll');
    paintOverview(); setTimeout(function () { try { ovQ.focus({ preventScroll: true }); } catch (e) {} }, 40);
  };
  var closeOverview = function () { if (ovm.hidden) return; ovm.hidden = true; D.body.classList.remove('dp-noscroll'); if (ovLast && ovLast.focus) try { ovLast.focus({ preventScroll: true }); } catch (e) {} };
  if (typeof openNotebookPagesOverview === 'function') { openNotebookPagesOverview = openOverview; W.openNotebookPagesOverview = openOverview; }
  if (typeof closeNotebookPagesOverview === 'function') { var origCloseOv = closeNotebookPagesOverview; closeNotebookPagesOverview = function () { closeOverview(); return origCloseOv.apply(this, arguments); }; W.closeNotebookPagesOverview = closeNotebookPagesOverview; }
  ovQ.addEventListener('input', paintOverview);
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ovm.hidden) { e.preventDefault(); e.stopPropagation(); closeOverview(); } }, true);
  ovm.addEventListener('click', function (e) {
    if (e.target === ovm || e.target.closest('[data-ovx]')) { closeOverview(); return; }
    var f = e.target.closest('[data-ovf]'); if (f) { ovFilter = f.getAttribute('data-ovf'); paintOverview(); return; }
    if (e.target.closest('[data-ovadd]')) { closeOverview(); openTemplatePickerModal(); return; }
    if (e.target.closest('[data-ovsort]')) { sortByCourse(); return; }
    var g = e.target.closest('[data-go]'); if (g && !ovDragged) { var n = +g.getAttribute('data-go'); closeOverview(); if (n !== curNo()) goPage(n); }
  });
  var applyOrder = function (nums) {
    var ps = pages(), map = {}; ps.forEach(function (p) { map[p.page_number] = p; });
    var arr = nums.map(function (n) { return map[n]; }).filter(Boolean);
    ps.forEach(function (p) { if (arr.indexOf(p) < 0) arr.push(p); });
    var changed = 0;
    arr.forEach(function (p, i) { if (!p.is_shared && metaOf(p).ord !== i) { setPageMeta(p, { ord: i }, true); changed++; } });
    ps.length = 0; arr.forEach(function (p) { ps.push(p); });
    if (typeof updatePageControlsUI === 'function') updatePageControlsUI();
    paintTabs();
    if (changed) toast('sayfa sırası güncellendi');
    return changed;
  };
  var sortByCourse = function () {
    var ps = pages().slice(), order = [];
    courses().forEach(function (c) { ps.forEach(function (p) { if (courseOf(p).toLocaleLowerCase('tr') === c.toLocaleLowerCase('tr')) order.push(p.page_number); }); });
    ps.forEach(function (p) { if (!courseOf(p)) order.push(p.page_number); });
    applyOrder(order); paintOverview();
  };
  var ovDragged = false;
  ovGrid.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('[data-grip]'); if (!g || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    var tile = g.closest('.dp-tile'), id = e.pointerId, moved = false, sx = e.clientX, sy = e.clientY;
    try { g.setPointerCapture(id); } catch (er) {}
    var mv = function (ev) {
      if (ev.pointerId !== id) return;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      moved = true; tile.classList.add('dp-dragging');
      tile.style.transform = 'translate(' + (ev.clientX - sx) + 'px,' + (ev.clientY - sy) + 'px) rotate(-2deg)';
      tile.style.pointerEvents = 'none';
      var over = D.elementFromPoint(ev.clientX, ev.clientY), t = over && over.closest && over.closest('.dp-tile');
      tile.style.pointerEvents = '';
      if (t && t !== tile && t.parentNode === ovGrid) {
        var r = t.getBoundingClientRect(), after = ev.clientX > r.left + r.width / 2;
        var ref = after ? t.nextSibling : t; if (ref !== tile) { var b0 = tile.getBoundingClientRect(); ovGrid.insertBefore(tile, ref); var b1 = tile.getBoundingClientRect(); sx += b1.left - b0.left; sy += b1.top - b0.top; tile.style.transform = 'translate(' + (ev.clientX - sx) + 'px,' + (ev.clientY - sy) + 'px) rotate(-2deg)'; }
      }
    };
    var up = function (ev) {
      if (ev.pointerId !== id) return;
      W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); W.removeEventListener('pointercancel', up);
      tile.classList.remove('dp-dragging'); tile.style.transform = '';
      if (moved) { ovDragged = true; setTimeout(function () { ovDragged = false; }, 50); applyOrder($$('.dp-tile', ovGrid).map(function (t) { return +t.getAttribute('data-pn'); })); paintOverview(); var ng = ovGrid.querySelector('[data-grip="' + tile.getAttribute('data-pn') + '"]'); if (ng) ng.focus(); }
    };
    W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
  });
  ovGrid.addEventListener('keydown', function (e) {
    var g = e.target.closest('[data-grip]'); if (!g || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    var nums = pages().map(function (p) { return p.page_number; }), n = +g.getAttribute('data-grip'), i = nums.indexOf(n), j = i + ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1);
    if (j < 0 || j >= nums.length) return;
    nums.splice(i, 1); nums.splice(j, 0, n); applyOrder(nums); paintOverview();
    var ng = ovGrid.querySelector('[data-grip="' + n + '"]'); if (ng) ng.focus();
  });

  /* =====================================================================
     11) ŞABLON GALERİSİ (canlı önizlemeli)
     ===================================================================== */
  var T_ = function (id, l, t, w, h, html, color, fs) { return { type: 'text', id: id, left: l, top: t, width: w, height: h, color: color || '#1A2A5C', fontSize: (fs || 16) + 'px', content: html }; };
  var TB = function (id, l, t, w, h, rows, cols, cells) { return { type: 'table', id: id, left: l, top: t, width: w, height: h, content: { rows: String(rows), cols: String(cols), cells: cells } }; };
  var DC = function (v, l, t, color) { var s = TPL[v]; return { type: 'deco', id: uid('tpl'), left: l, top: t, width: s[0], height: s[1], rotation: 0, content: { kind: 'tpl', v: v, color: color } }; };
  var STARTERS = {
    timeline: function (n) {
      var a = [T_('text-' + n + '-h', 88, 22, 560, 40, '<strong>📅 Zaman çizelgesi</strong> — konu: …', '#1A2A5C', 20), DC('timeline', 40, 300, '#2F6BFF')];
      for (var i = 0; i < 5; i++) { var up = i % 2 === 0; a.push(T_('text-' + n + '-' + i, 40 + 60 + i * 130 - 58, up ? 264 : 450, 120, 60, '<div style="text-align:center;"><b>tarih</b><br>olay</div>', '#334155', 15)); }
      a.push(T_('text-' + n + '-s', 88, 580, 560, 40, '<span style="color:#64748B;">neden → sonuç bağlantılarını oklarla göster</span>', '#64748B', 14));
      return a;
    },
    karsilastirma: function (n) {
      var cells = ['<b>ölçüt</b>', '<b>A</b>', '<b>B</b>', 'tanım', '', '', 'neden / mekanizma', '', '', 'özellikler', '', '', 'örnek', '', '', 'avantaj', '', '', 'dezavantaj', '', '', '<b>temel fark</b>', '', ''];
      return [T_('text-' + n + '-h', 88, 22, 560, 40, '<strong>⚖️ Karşılaştırma</strong> — A ile B', '#1A2A5C', 20), TB('table-' + n, 40, 90, 660, 470, 8, 3, cells),
        T_('text-' + n + '-s', 40, 590, 660, 60, '<b>sonuç:</b> ikisini tek cümlede ayıran şey…', '#334155', 16)];
    },
    formul: function (n) {
      var a = [T_('text-' + n + '-h', 88, 22, 560, 40, '<strong>🧮 Formül kâğıdı</strong> — ders: …', '#1A2A5C', 20), DC('formul', 30, 80, '#7A4FD6')];
      var nums = ['①', '②', '③', '④', '⑤', '⑥'];
      for (var i = 0; i < 6; i++) { var X = 30 + 6 + (i % 2) * 340, Y = 80 + 6 + Math.floor(i / 2) * 220; a.push(T_('text-' + n + '-' + i, X + 14, Y + 10, 290, 30, '<b>' + nums[i] + ' formül adı</b>', '#5B3DB0', 15)); a.push(T_('text-' + n + '-w' + i, X + 14, Y + 158, 290, 30, '<span style="color:#64748B;">ne zaman kullanılır · birim</span>', '#64748B', 13)); }
      return a;
    },
    haftalik: function (n) {
      var days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'], cells = ['<b>gün</b>', '<b>ders / konu</b>', '<b>süre</b>', '<b>✓</b>'];
      days.forEach(function (d) { cells.push('<b>' + d + '</b>', '', '', ''); });
      return [T_('text-' + n + '-h', 88, 22, 560, 40, '<strong>🗓️ Haftalık plan</strong> — hafta: …', '#1A2A5C', 20),
        T_('text-' + n + '-g', 40, 74, 660, 34, '<b>bu haftanın hedefi:</b> …', '#B4511F', 16), TB('table-' + n, 40, 120, 660, 470, 8, 4, cells),
        T_('text-' + n + '-n', 40, 610, 660, 60, '<b>hafta sonu kendime not:</b> …', '#334155', 15)];
    },
    kavram: function (n) {
      var a = [T_('text-' + n + '-h', 88, 22, 560, 40, '<strong>🗂️ Kavram kartları</strong> — kes, katla, tekrar et', '#1A2A5C', 20), DC('kavram', 30, 80)];
      for (var i = 0; i < 8; i++) { var X = 30 + 6 + (i % 2) * 340, Y = 80 + 6 + Math.floor(i / 2) * 166; a.push(T_('text-' + n + '-k' + i, X + 10, Y + 6, 110, 26, '<b>kavram</b>', '#C9483B', 14)); a.push(T_('text-' + n + '-t' + i, X + 138, Y + 6, 180, 26, 'tanım · örnek', '#64748B', 14)); }
      return a;
    }
  };
  var PAPER = { timeline: 'plain', karsilastirma: 'plain', formul: 'grid', haftalik: 'plain', kavram: 'dots', cornell: 'lined', swot: 'plain', mindmap: 'dots' };
  var GAL = [
    { k: 'blank', n: 'boş sayfa', d: 'çizgili, kareli ya da düz; serbest çalış', pv: '<path d="M30 30 H130 M30 46 H130 M30 62 H130 M30 78 H110"/><path class="pen" d="M40 92 C60 80 70 100 92 88"/>' },
    { k: 'cornell', n: 'Cornell notu', d: 'ipuçları · notlar · özet', pv: '<path d="M58 14 V82 M14 82 H146"/><path class="pen" d="M20 26 H50 M20 40 H46 M66 26 H138 M66 40 H130 M66 54 H136 M20 94 H120"/>' },
    { k: 'mindmap', n: 'zihin haritası', d: 'merkezde konu, dallarda alt konular', pv: '<ellipse cx="80" cy="55" rx="24" ry="14"/><path d="M58 48 L30 26 M102 48 L130 26 M58 62 L30 86 M102 62 L130 86"/><circle class="pen" cx="26" cy="22" r="8"/><circle class="pen" cx="134" cy="22" r="8"/><circle class="pen" cx="26" cy="90" r="8"/><circle class="pen" cx="134" cy="90" r="8"/>' },
    { k: 'swot', n: 'SWOT analizi', d: 'güçlü · zayıf · fırsat · tehdit', pv: '<rect x="20" y="12" width="56" height="42"/><rect x="84" y="12" width="56" height="42"/><rect x="20" y="60" width="56" height="42"/><rect x="84" y="60" width="56" height="42"/><path class="pen" d="M28 24 H60 M92 24 H124 M28 72 H60 M92 72 H124"/>' },
    { k: 'timeline', n: 'zaman çizelgesi', d: 'tarihler ve olaylar sırayla', pv: '<path d="M14 58 H140 M134 52 L144 58 L134 64"/><circle cx="34" cy="58" r="5"/><circle cx="64" cy="58" r="5"/><circle cx="94" cy="58" r="5"/><circle cx="124" cy="58" r="5"/><path class="pen" d="M22 36 H46 M52 84 H76 M82 36 H106 M112 84 H136"/>' },
    { k: 'karsilastirma', n: 'karşılaştırma tablosu', d: 'iki kavramı ölçüt ölçüt yan yana', pv: '<rect x="18" y="12" width="124" height="88"/><path d="M18 28 H142 M18 46 H142 M18 64 H142 M18 82 H142 M58 12 V100 M100 12 V100"/><path class="pen" d="M66 37 H92 M108 55 H134 M66 73 H90"/>' },
    { k: 'formul', n: 'formül kâğıdı', d: 'her formül bir kutu: ne, ne zaman, birim', pv: '<rect x="16" y="12" width="60" height="40" rx="6"/><rect x="84" y="12" width="60" height="40" rx="6"/><rect x="16" y="60" width="60" height="40" rx="6"/><rect x="84" y="60" width="60" height="40" rx="6"/><path class="pen" d="M24 34 C30 26 34 40 40 30 M50 32 H66 M92 36 H130 M24 82 L34 74 L44 86 M92 82 H136"/>' },
    { k: 'haftalik', n: 'haftalık plan', d: 'yedi gün, ders, süre ve tik', pv: '<rect x="16" y="12" width="128" height="90"/><path d="M16 24 H144 M16 36 H144 M16 48 H144 M16 60 H144 M16 72 H144 M16 84 H144 M50 12 V102 M118 12 V102"/><path class="pen" d="M124 30 L128 34 L136 26 M124 54 L128 58 L136 50"/>' },
    { k: 'kavram', n: 'kavram kartları', d: 'kes-katla tekrar kartları', pv: '<rect x="16" y="12" width="60" height="38" rx="3"/><rect x="84" y="12" width="60" height="38" rx="3"/><rect x="16" y="60" width="60" height="38" rx="3"/><rect x="84" y="60" width="60" height="38" rx="3"/><path d="M40 16 V46 M108 16 V46 M40 64 V94 M108 64 V94" stroke-dasharray="3 3"/><path class="pen" d="M22 30 H34 M90 30 H102 M46 26 H70 M114 26 H138"/>' }
  ];
  var gal = D.createElement('div');
  gal.className = 'dp-gal'; gal.hidden = true;
  gal.innerHTML = '<div class="dp-gal-box" role="dialog" aria-modal="true" aria-labelledby="dp-gal-t">' +
    '<header><h3 id="dp-gal-t" class="hd">yeni sayfa · şablon seç</h3><button type="button" class="dp-x" data-galx aria-label="Kapat">×</button></header>' +
    '<p class="dp-gal-sub" data-galsub></p>' +
    '<div class="dp-gal-grid">' + GAL.map(function (g, i) {
      return '<button type="button" class="dp-gal-c" data-tpl="' + g.k + '" style="--i:' + i + '"><span class="dp-gal-pv"><svg viewBox="0 0 160 112" aria-hidden="true">' + g.pv + '</svg></span><b>' + esc(g.n) + '</b><small>' + esc(g.d) + '</small>' + (i >= 4 ? '<i class="dp-new">yeni</i>' : '') + '</button>';
    }).join('') + '</div></div>';
  D.body.appendChild(gal);
  var galLast = null;
  var openGallery = function () {
    commitSel(); galLast = D.activeElement;
    var c = state.meta.course; gal.querySelector('[data-galsub]').textContent = c ? 'yeni sayfa “' + c + '” bölümüne eklenir; ders etiketini sonra değiştirebilirsin.' : 'şablon yalnızca başlangıç: yazılar düzenlenir, kalemle üstüne yazılır.';
    gal.hidden = false; D.body.classList.add('dp-noscroll'); gal.classList.remove('dp-in'); void gal.offsetWidth; gal.classList.add('dp-in');
    setTimeout(function () { var f = gal.querySelector('.dp-gal-c'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }, 40);
  };
  var closeGallery = function () { if (gal.hidden) return; gal.hidden = true; D.body.classList.remove('dp-noscroll'); if (galLast && galLast.focus) try { galLast.focus({ preventScroll: true }); } catch (e) {} };
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !gal.hidden) { e.preventDefault(); e.stopPropagation(); closeGallery(); } }, true);
  gal.addEventListener('click', function (e) {
    if (e.target === gal || e.target.closest('[data-galx]')) { closeGallery(); return; }
    var c = e.target.closest('[data-tpl]'); if (c) { closeGallery(); newFromTemplate(c.getAttribute('data-tpl')); }
  });
  var origSelect = typeof selectNotebookTemplate === 'function' ? selectNotebookTemplate : null;
  var newFromTemplate = async function (k) {
    if (!origSelect) return;
    var from = curNo(), course = state.meta.course || '';
    var nextKey = pages().reduce(function (m, p) { return Math.max(m, keyOf(p)); }, 0) + 1;
    var builtIn = ['blank', 'swot', 'cornell', 'mindmap'].indexOf(k) >= 0;
    var sheet = makeSheet();
    await origSelect(builtIn ? k : 'blank');
    var p = cur(); if (!p || curNo() === from) return;
    if (!builtIn && STARTERS[k]) p.elements = STARTERS[k](Date.now());
    var m = { ord: nextKey, date: ymd() }; if (course) m.course = course; if (PAPER[k]) m.paper = PAPER[k];
    var gi = GAL.filter(function (g) { return g.k === k; })[0]; if (gi && k !== 'blank') m.title = gi.n.charAt(0).toLocaleUpperCase('tr') + gi.n.slice(1);
    writeMetaInto(p, m);
    renderCurrentPageData(); resetNotebookHistory();
    try { notebookHasUnsavedChanges = false; } catch (e) {}
    persistPage(p);
    playFlip(sheet, 1);
    setTimeout(function () { var t = mIn('title'); if (t) try { t.focus({ preventScroll: true }); } catch (e) {} }, RM ? 0 : 700);
  };
  if (typeof openTemplatePickerModal === 'function') { openTemplatePickerModal = openGallery; W.openTemplatePickerModal = openGallery; }
  if (typeof createNewNotebookPage === 'function') { createNewNotebookPage = function () { openGallery(); }; W.createNewNotebookPage = createNewNotebookPage; }
  if (origSelect) { selectNotebookTemplate = function (k) { closeGallery(); return newFromTemplate(k); }; W.selectNotebookTemplate = selectNotebookTemplate; }
  bLasso.addEventListener('keydown', function () {});

  /* =====================================================================
     12) SAYFAYI RESME ÇEVİRME (önizleme ve PDF için; ekrana dokunmadan)
     ===================================================================== */
  var imgCache = {};
  var loadImg = function (src) {
    if (!src) return Promise.resolve(null);
    if (imgCache[src]) return imgCache[src];
    imgCache[src] = new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; });
    return imgCache[src];
  };
  var SANS = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif', HAND = '"Caveat", "Segoe Print", cursive';
  var wrapLines = function (g, text, maxW) {
    var out = [];
    String(text || '').split('\n').forEach(function (para) {
      var words = para.split(' '), line = '';
      words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
      out.push(line);
    });
    return out;
  };
  var drawPaper = function (g, w, h, kind) {
    g.fillStyle = '#FFFEFC'; g.fillRect(0, 0, w, h);
    g.save();
    if (kind === 'lined' || kind === 'cornell') {
      g.strokeStyle = '#CBD6EC'; g.lineWidth = 1;
      for (var y = 70 + 31.5; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.strokeStyle = kind === 'cornell' ? 'rgba(26,42,92,0.55)' : 'rgba(201,72,59,0.4)'; g.lineWidth = 2;
      var mx = kind === 'cornell' ? 229 : 79; g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, h); g.stroke();
    } else if (kind === 'grid') {
      g.strokeStyle = '#DCE4F3'; g.lineWidth = 1;
      for (var x = 23.5; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (var yy = 14.5; yy < h; yy += 24) { g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke(); }
    } else if (kind === 'dots') {
      g.fillStyle = '#AEB9D2';
      for (var dx = 19; dx < w; dx += 26) for (var dy = 27; dy < h; dy += 26) { g.beginPath(); g.arc(dx, dy, 1.4, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  };
  var rrect = function (g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  var svgImg = function (svg, w, h) { var s = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('width="100%" height="100%"', 'width="' + w + '" height="' + h + '"'); return loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)); };
  var drawEl = async function (g, e) {
    var x = +e.left || 0, y = +e.top || 0, w = +e.width || 0, h = +e.height || 0, c = e.content;
    g.save();
    if (e.type === 'text') {
      var fs = parseFloat(e.fontSize) || 16; g.font = '500 ' + fs + 'px ' + SANS; g.fillStyle = e.color || '#1A2A5C'; g.textBaseline = 'top';
      wrapLines(g, strip(c), Math.max(w || 400, 60)).forEach(function (ln, i) { g.fillText(ln, x + 2, y + 2 + i * fs * 1.3); });
    } else if (e.type === 'sticky' && c) {
      w = w || 220; h = h || 160;
      g.translate(x + w / 2, y + h / 2); g.rotate((+e.rotation || 0) * Math.PI / 180); g.translate(-w / 2, -h / 2);
      g.shadowColor = 'rgba(13,24,56,.18)'; g.shadowBlur = 10; g.shadowOffsetY = 4; g.fillStyle = '#FFF4B8'; g.fillRect(0, 0, w, h); g.shadowColor = 'transparent';
      g.fillStyle = '#1A2A5C'; g.font = '700 13px ' + SANS; g.textBaseline = 'top'; g.fillText(String(c.fileName || '').slice(0, 40), 12, 12);
      g.font = '400 12px ' + SANS; wrapLines(g, strip(c.excerpt), w - 24).slice(0, Math.floor((h - 44) / 16)).forEach(function (ln, i) { g.fillText(ln, 12, 34 + i * 16); });
    } else if (e.type === 'table' && c) {
      var R = parseInt(c.rows, 10) || 1, C = parseInt(c.cols, 10) || 1; w = w || C * 120; h = h || R * 34;
      var cw = w / C, ch = h / R; g.strokeStyle = '#94A3B8'; g.lineWidth = 1; g.font = '400 12px ' + SANS; g.fillStyle = '#1A2A5C'; g.textBaseline = 'top';
      for (var r = 0; r < R; r++) for (var k = 0; k < C; k++) {
        g.strokeRect(x + k * cw, y + r * ch, cw, ch);
        var txt = strip((c.cells || [])[r * C + k]); if (txt) { g.save(); g.beginPath(); g.rect(x + k * cw, y + r * ch, cw, ch); g.clip(); wrapLines(g, txt, cw - 10).slice(0, 3).forEach(function (ln, i) { g.fillText(ln, x + k * cw + 5, y + r * ch + 5 + i * 15); }); g.restore(); }
      }
    } else if (e.type === 'image') {
      var im = await loadImg(c); if (im) g.drawImage(im, x, y, w || im.naturalWidth, h || im.naturalHeight);
    } else if (e.type === 'shape' && c) {
      g.strokeStyle = e.color || '#1A2A5C'; g.lineWidth = 3; var t = c.shapeType, fx = c.flippedX === 'true', fy = c.flippedY === 'true';
      if (t === 'rectangle') g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      else if (t === 'circle' || t === 'ellipse') { g.beginPath(); g.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2 - 1.5), Math.max(1, h / 2 - 1.5), 0, 0, Math.PI * 2); g.stroke(); }
      else if (t === 'line' || t === 'arrow') {
        var x1 = fx ? x + w : x, y1 = fy ? y + h : y, x2 = fx ? x : x + w, y2 = fy ? y : y + h;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        if (t === 'arrow') { var an = Math.atan2(y2 - y1, x2 - x1); g.fillStyle = e.color || '#1A2A5C'; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 14 * Math.cos(an - 0.4), y2 - 14 * Math.sin(an - 0.4)); g.lineTo(x2 - 14 * Math.cos(an + 0.4), y2 - 14 * Math.sin(an + 0.4)); g.closePath(); g.fill(); }
      }
    } else if (e.type === 'deco' && c) {
      var rot = (+e.rotation || 0) * Math.PI / 180;
      g.translate(x + w / 2, y + h / 2); g.rotate(rot); g.translate(-w / 2, -h / 2);
      if (c.kind === 'tape') {
        g.globalAlpha = 0.78; g.fillStyle = TAPES[c.v] || c.color || '#D9B98A';
        g.beginPath(); g.moveTo(0, 0); for (var zi = 0; zi <= 6; zi++) g.lineTo(zi % 2 ? 5 : 0, zi * h / 6); g.lineTo(w, h); for (var zj = 6; zj >= 0; zj--) g.lineTo(w - (zj % 2 ? 5 : 0), zj * h / 6); g.closePath(); g.fill();
      } else if (c.kind === 'stamp') {
        var S = STAMPS[c.v] || STAMPS.yildiz, col = c.color || S.c, big = S.t.length <= 2;
        g.strokeStyle = col; g.fillStyle = col; g.globalAlpha = 0.88; g.lineWidth = 3;
        if (big) { g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) / 2 - 3, 0, Math.PI * 2); g.stroke(); g.font = '700 ' + Math.round(h * 0.5) + 'px ' + SANS; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.t, w / 2, h / 2 + 2); }
        else { rrect(g, 2, 2, w - 4, h - 4, 8); g.stroke(); g.font = '800 15px ' + SANS; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.t, w / 2, c.text ? h / 2 - 8 : h / 2); if (c.text) { g.font = '600 11px ' + SANS; g.fillText(c.text, w / 2, h / 2 + 12); } }
      } else if (c.kind === 'postit') {
        g.shadowColor = 'rgba(13,24,56,.2)'; g.shadowBlur = 10; g.shadowOffsetY = 5; g.fillStyle = POSTITS[c.v] || c.color || POSTITS.sari; g.fillRect(0, 0, w, h); g.shadowColor = 'transparent';
        g.fillStyle = '#1A2A5C'; g.font = '600 20px ' + HAND; g.textBaseline = 'top'; wrapLines(g, c.text || '', w - 24).slice(0, Math.floor((h - 20) / 22)).forEach(function (ln, i) { g.fillText(ln, 12, 12 + i * 22); });
      } else if (c.kind === 'tpl') {
        var si = await svgImg(tplSvg(c.v, c.color), w, h); if (si) g.drawImage(si, 0, 0, w, h);
      }
    } else if ((e.type === 'ai_table' || e.type === 'ai_chart' || e.type === 'transcript') && w && h) {
      g.strokeStyle = '#CBD5E1'; g.lineWidth = 1.5; rrect(g, x, y, w, h, 10); g.stroke(); g.fillStyle = '#1A2A5C'; g.font = '700 14px ' + SANS; g.textBaseline = 'top'; g.fillText(String(e.title || '').slice(0, 60), x + 12, y + 12);
    }
    g.restore();
  };
  var renderPage = async function (p, sc, footer) {
    var isCur = p.page_number === curNo(), c0 = cv();
    var data = isCur ? c0.toDataURL('image/png') : p.canvas_data;
    var els = (isCur ? captureCurrentOverlayElements() : (p.elements || [])).filter(Boolean);
    var m = isCur ? state.meta : metaOf(p);
    try { if (D.fonts && D.fonts.load) await Promise.all([D.fonts.load('600 20px Caveat'), D.fonts.load('500 16px Inter')]); } catch (e) {}
    var img = await loadImg(data);
    var w = img ? img.naturalWidth : Math.round(c0.width / scale()), h = img ? img.naturalHeight : Math.round(c0.height / scale());
    var cvs = D.createElement('canvas'); cvs.width = Math.round(w * sc); cvs.height = Math.round(h * sc);
    var g = cvs.getContext('2d'); g.scale(sc, sc);
    drawPaper(g, w, h, m.paper || store.get('paper') || 'lined');
    for (var i = 0; i < els.length; i++) if (els[i].type === 'deco' && els[i].content && els[i].content.kind === 'tpl') await drawEl(g, els[i]);
    if (img) g.drawImage(img, 0, 0, w, h);
    for (var j = 0; j < els.length; j++) if (!(els[j].type === 'deco' && els[j].content && els[j].content.kind === 'tpl') && els[j].type !== 'meta') await drawEl(g, els[j]);
    if (footer) { g.fillStyle = '#9AA6C0'; g.font = '600 17px ' + HAND; g.textBaseline = 'alphabetic'; g.textAlign = 'right'; g.fillText(footer, w - 24, h - 16); }
    return cvs;
  };
  var renderCover = function (d, w, h, info) {
    var c = D.createElement('canvas'); c.width = w * 2; c.height = h * 2; var g = c.getContext('2d'); g.scale(2, 2);
    g.fillStyle = d.color; g.fillRect(0, 0, w, h);
    var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(w - 70, 0, 16, h);
    var lw = Math.min(460, w - 140), lh = 210, lx = (w - lw) / 2 - 20, ly = h * 0.3;
    g.fillStyle = '#FFFDF6'; rrect(g, lx, ly, lw, lh, 12); g.fill();
    g.strokeStyle = 'rgba(26,42,92,.25)'; g.lineWidth = 1.5; rrect(g, lx + 10, ly + 10, lw - 20, lh - 20, 8); g.stroke();
    g.textAlign = 'center'; g.fillStyle = '#6A7593'; g.font = '600 12px ' + SANS; g.fillText('ACADEX · ÇALIŞMA DEFTERİ', lx + lw / 2, ly + 44);
    g.fillStyle = '#0D1838'; g.font = '700 40px ' + HAND; g.fillText(String(d.name).slice(0, 30), lx + lw / 2, ly + 100);
    g.fillStyle = '#1A2A5C'; g.font = '600 24px ' + HAND; g.fillText(String(d.label || '').slice(0, 40), lx + lw / 2, ly + 140);
    g.fillStyle = '#6A7593'; g.font = '500 13px ' + SANS; g.fillText(info, lx + lw / 2, ly + 180);
    return c;
  };

  /* =====================================================================
     13) İNDİR: bu sayfa (resim) ya da bütün defter / bir ders (kapaklı PDF)
     ===================================================================== */
  var dlBtn = D.getElementById('btn-download-notebook'), dl = null;
  if (dlBtn) {
    dlBtn.title = 'İndir: bu sayfa ya da bütün defter (PDF)'; dlBtn.setAttribute('aria-haspopup', 'dialog'); dlBtn.setAttribute('aria-expanded', 'false');
    dl = D.createElement('div'); dl.className = 'dp-dl'; dl.hidden = true; dl.setAttribute('role', 'dialog'); dl.setAttribute('aria-label', 'İndir');
    dl.innerHTML = '<button type="button" class="dp-dl-png" data-dl="png"><b>bu sayfa</b><small>resim (PNG)</small></button>' +
      '<div class="dp-dl-pdf"><b>bütün defter · PDF</b>' +
      '<label><span>sayfalar</span><select data-dls></select></label>' +
      '<label class="dp-dl-c"><input type="checkbox" data-dlc checked> kapak ekle</label>' +
      '<button type="button" class="dp-dl-go" data-dl="pdf">PDF oluştur</button><p class="dp-dl-p" data-dlp aria-live="polite"></p></div>';
    dlBtn.parentNode.style.position = 'relative'; dlBtn.parentNode.appendChild(dl);
    var closeDl = function () { dl.hidden = true; dlBtn.setAttribute('aria-expanded', 'false'); };
    dlBtn.parentNode.addEventListener('click', function (e) {
      if (!dlBtn.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (!dl.hidden) { closeDl(); return; }
      var ps = pages(), list = courses();
      dl.querySelector('[data-dls]').innerHTML = '<option value="">hepsi (' + ps.length + ' sayfa)</option>' + list.map(function (c) { var n = ps.filter(function (p) { return courseOf(p).toLocaleLowerCase('tr') === c.toLocaleLowerCase('tr'); }).length; return '<option value="' + esc(c) + '">' + esc(c) + ' (' + n + ')</option>'; }).join('');
      dl.querySelector('[data-dlp]').textContent = '';
      dl.hidden = false; dlBtn.setAttribute('aria-expanded', 'true');
      dl.style.right = Math.max(0, dlBtn.parentNode.offsetWidth - dlBtn.offsetLeft - dlBtn.offsetWidth) + 'px';
      var f = dl.querySelector('button'); if (f) f.focus();
    }, true);
    dl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDl(); dlBtn.focus(); } });
    D.addEventListener('pointerdown', function (e) { if (!dl.hidden && !dl.contains(e.target) && !dlBtn.contains(e.target)) closeDl(); });
    dl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dl]'); if (!b) return;
      if (b.getAttribute('data-dl') === 'png') { closeDl(); commitSel(); if (typeof downloadNotebook === 'function') downloadNotebook(); return; }
      exportPdf(dl.querySelector('[data-dls]').value, dl.querySelector('[data-dlc]').checked, dl.querySelector('[data-dlp]'), b);
    });
  }
  var exportPdf = async function (course, withCover, prog, btn) {
    commitSel();
    var ps = pages().filter(function (p) { return !course || courseOf(p).toLocaleLowerCase('tr') === course.toLocaleLowerCase('tr'); });
    if (!ps.length) { prog.textContent = 'bu bölümde sayfa yok.'; return; }
    btn.disabled = true; prog.textContent = 'hazırlanıyor…';
    try {
      if (!(W.jspdf && W.jspdf.jsPDF) && W.loadScript) await W.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if (!(W.jspdf && W.jspdf.jsPDF)) throw new Error('jsPDF yüklenemedi');
      var J = W.jspdf.jsPDF, doc = null, all = pages();
      var add = function (canvas) {
        var wmm = 210, hmm = Math.round(210 * canvas.height / canvas.width * 10) / 10, o = hmm >= wmm ? 'p' : 'l';
        if (!doc) doc = new J({ unit: 'mm', format: [wmm, hmm], orientation: o, compress: true }); else doc.addPage([wmm, hmm], o);
        doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, wmm, hmm, undefined, 'FAST');
      };
      var first = null;
      for (var i = 0; i < ps.length; i++) {
        prog.textContent = 'sayfa ' + (i + 1) + ' / ' + ps.length + ' çiziliyor…';
        var p = ps[i], m = p.page_number === curNo() ? state.meta : metaOf(p);
        var foot = [m.course, m.title, m.date ? dshort(m.date) : ''].filter(Boolean).join(' · ') + '   ' + (all.indexOf(p) + 1) + '/' + all.length;
        var c = await renderPage(p, 2, foot);
        if (!first) {
          first = c;
          if (withCover) {
            var d = coverData(), dates = ps.map(function (q) { return (q.page_number === curNo() ? state.meta : metaOf(q)).date || ymd(q.updated_at); }).filter(Boolean).sort();
            var info = ps.length + ' sayfa' + (course ? ' · ' + course : '') + (dates.length ? ' · ' + dshort(dates[0]) + (dates.length > 1 && dates[dates.length - 1] !== dates[0] ? ' – ' + dshort(dates[dates.length - 1]) : '') : '');
            add(renderCover(course ? Object.assign({}, d, { label: course }) : d, c.width / 2, c.height / 2, info));
          }
        }
        add(c);
        await new Promise(function (r) { setTimeout(r, 0); });
      }
      var name = 'acadex-defter' + (course ? '-' + norm(course).replace(/[^a-z0-9]+/g, '-') : '') + '-' + ymd() + '.pdf';
      doc.save(name);
      W.__dpLastPdf = { name: name, pages: ps.length + (withCover ? 1 : 0) };
      prog.textContent = 'indirildi ✓ ' + name;
    } catch (err) {
      console.error('Defter PDF olusturulamadi:', err);
      prog.textContent = 'PDF oluşturulamadı. Bağlantını kontrol edip tekrar dene.';
    } finally { btn.disabled = false; }
  };

  /* test ve diğer modüller için küçük bir kapı */
  W.AXDefterPlus = { recognize: recognize, goPage: goPage, openOverview: openOverview, openGallery: openGallery, renderPage: renderPage, applyOrder: applyOrder, setPageMeta: setPageMeta, metaOf: metaOf, state: state, enterFocus: enterFocus, exitFocus: exitFocus, pomo: pomo, showCover: showCover, setRuler: setRuler, ruler: ruler, makeDeco: makeDeco, exportPdf: exportPdf, sortByCourse: sortByCourse };
  if (lsafe(function () { return pages().length; }, 0)) { var p0 = cur(); state.meta = Object.assign({}, metaOf(p0)); paintMeta(); paintTabs(); }
})();
