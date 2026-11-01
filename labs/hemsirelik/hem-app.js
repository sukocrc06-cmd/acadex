/* ==========================================================================
   ACADEX HEMŞİRELİK LAB · çekirdek (labs/hemsirelik/hem-app.js), 01.11.2026
   Sekmeler, ortak yardımcılar, karne, maskot ve MedLab köprüsü (Acadia).
   İstasyonlar kendini HM.st'ye kaydeder: { init, show, hide, ctx, answer, classify }.
   Veri: hem-veri.js (AXHEM).
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, V = W.AXHEM;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem('acadex.hem.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.hem.' + k, JSON.stringify(v)); } catch (e) { /* depolama kapalı */ } }
  };
  var tr = function (v, n) { if (v == null || isNaN(v)) return '—'; return Number(v).toFixed(n == null ? 0 : n).replace('.', ','); };
  var toast = function (t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2600); };
  var live = function (t) { $('#live').textContent = t; };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var shuffle = function (a, r) { r = r || Math.random; a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  /* her açılışta farklı kişiler: oturum tohumu */
  var TOHUM = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  var rng = function (ek) { return V.rng(TOHUM + (ek || 0) * 7919); };

  var karne = function (pct, title, items, note) {
    var c = pct >= 85 ? 'var(--ok)' : pct >= 60 ? 'var(--warn)' : 'var(--bad)';
    var lbl = pct >= 85 ? 'ÇOK İYİ' : pct >= 60 ? 'GELİŞİYOR' : 'TEKRAR';
    return '<div class="karne"><div class="stamp" style="color:' + c + '"><b>%' + Math.round(pct) + '</b><small>' + lbl + '</small></div>' +
      '<h3>' + X(title) + '</h3><ul>' + (items || []).map(function (it) { return '<li class="' + (it[0] ? 'ok' : 'no') + '">' + it[1] + '</li>'; }).join('') + '</ul>' +
      (note ? '<p class="not">' + note + '</p>' : '') + '</div>';
  };
  /* maskot Nabız: hemşire şapkalı kalp */
  var nabiz = function (sz) {
    return '<svg class="nbz" width="' + (sz || 64) + '" height="' + (sz || 64) + '" viewBox="0 0 64 64" aria-hidden="true"><g class="kalp"><path d="M32 56 C14 44 6 34 6 23 C6 15 12 9 19.5 9 C25 9 29.5 12 32 16.5 C34.5 12 39 9 44.5 9 C52 9 58 15 58 23 C58 34 50 44 32 56 Z" fill="#F7A9A0" stroke="#0D1838" stroke-width="2.6"/></g>' +
      '<path d="M18 12 L22 2 H42 L46 12 Z" fill="#fff" stroke="#0D1838" stroke-width="2.2"/><rect x="29.5" y="4" width="5" height="7" fill="#C9483B"/><rect x="28.5" y="5.5" width="7" height="4" fill="#C9483B"/>' +
      '<ellipse class="eye" cx="24" cy="27" rx="2.6" ry="3.2" fill="#0D1838"/><ellipse class="eye" cx="40" cy="27" rx="2.6" ry="3.2" fill="#0D1838"/><path d="M27 34 C30 37 34 37 37 34" stroke="#0D1838" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M8 42 H20 L24 36 L29 48 L33 40 H56" stroke="#2F6BFF" stroke-width="2.6" fill="none" stroke-linejoin="round" class="ekg"/></svg>';
  };

  var HM = W.HM = W.HM || {};
  HM.st = HM.st || {};
  HM.core = { V: V, $: $, $$: $$, X: X, ls: ls, tr: tr, toast: toast, live: live, RM: RM, karne: karne, nabiz: nabiz, shuffle: shuffle, rng: rng };

  /* ---------------- sekmeler ---------------- */
  var MEDICA = /(?:\?|&)medica=1(?:&|$)/.test(location.search);
  HM.core.MEDICA = MEDICA;
  var TABS = MEDICA ? ['yatak', 'beceri', 'ilac', 'servis', 'vaka'] : ['yatak', 'beceri', 'ilac', 'servis'];
  var tab = null, inited = {};
  var setTab = function (k) {
    if (TABS.indexOf(k) < 0) k = 'yatak';
    if (tab && tab !== k && HM.st[tab] && HM.st[tab].hide) HM.st[tab].hide();
    tab = k;
    $$('.hm-tabs [data-tab]').forEach(function (b) { var on = b.getAttribute('data-tab') === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$('.hm-view').forEach(function (v) { v.classList.toggle('on', v.id === k); });
    var st = HM.st[k];
    if (st && !inited[k] && st.init) { inited[k] = true; st.init(); }
    if (st && st.show) st.show();
    if (k !== 'vaka') ls.set('tab', k); bridgeSend();
  };
  $$('.hm-tabs [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = TABS.indexOf(b.getAttribute('data-tab')), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      e.preventDefault(); setTab(n); var nb = $('.hm-tabs [data-tab="' + n + '"]'); if (nb) nb.focus();
    });
  });
  HM.core.setTab = setTab; HM.core.tab = function () { return tab; };

  /* ---------------- MedLab köprüsü (Acadia) ---------------- */
  var EMB = W.parent !== W && /(?:\?|&)medlab=1(?:&|$)/.test(location.search), ORG = location.origin;
  var post = function (m) { if (!EMB) return; m.src = 'axlab'; m.lab = 'hemsirelik'; try { W.parent.postMessage(m, ORG); } catch (e) { /* köprü yok */ } };
  var NAMES = { yatak: 'Hasta başı ve vital bulgular', beceri: 'Beceri istasyonları', ilac: 'İlaç uygulama', servis: 'Servis vardiyası', vaka: 'Klinik vaka masası' };
  var ctx = function () {
    var o = { type: 'ctx', mode: tab, spot: false, sel: null, chips: [] };
    var st = HM.st[tab], c = st && st.ctx ? st.ctx() : null;
    if (c) { o.sel = c.sel; o.chips = c.chips || []; }
    if (!o.sel) o.sel = { key: 'hem.' + tab, title: NAMES[tab] || 'Hemşirelik Lab', la: 'Hemşirelik Lab', rows: [], about: 'öğrenci Hemşirelik Lab\'de ' + (NAMES[tab] || '') + ' istasyonunda çalışıyor.' };
    return o;
  };
  var bridgeSend = HM.bridgeSend = function () { if (!EMB) return; clearTimeout(bridgeSend.t); bridgeSend.t = setTimeout(function () { post(ctx()); }, 40); };
  if (EMB) {
    W.addEventListener('message', function (e) {
      if (e.origin !== ORG || e.source !== W.parent) return;
      var d = e.data; if (!d || d.src !== 'axhost') return;
      if (d.type === 'hello') { bridgeSend(); return; }
      if (d.type !== 'ask') return;
      var st = HM.st[tab];
      var kind = d.kind || (st && st.classify ? st.classify(String(d.q || '').toLocaleLowerCase('tr')) : null);
      var text = kind && st && st.answer ? st.answer(kind) : null;
      if (!text) { post({ type: 'reply', id: d.id, miss: true }); return; }
      post({ type: 'ack', id: d.id }); post({ type: 'reply', id: d.id, text: text });
    });
  }

  HM.core.start = function () {
    var t0 = new URLSearchParams(location.search).get('tab') || ls.get('tab', 'yatak');
    setTab(t0);
  };
})();
