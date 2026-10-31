/* ==========================================================================
   ACADEX DKT LAB · çekirdek (labs/dkt/dkt-app.js), 29.10.2026
   Sekmeler, ortak yardımcılar, karne ve MedLab köprüsü (sitenin Acadia'sı).
   İstasyonlar kendini DK.st'ye kaydeder: { init, show, hide, ctx, answer, classify }.
   Veri: dkt-veri.js (AXDKT).
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, V = W.AXDKT;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem('acadex.dkt.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.dkt.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var tr = function (v, n) { if (v == null || isNaN(v)) return '—'; return Number(v).toFixed(n == null ? 0 : n).replace('.', ','); };
  var toast = function (t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2600); };
  var live = function (t) { $('#live').textContent = t; };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  /* karne: puan yüzdesi, başlık, maddeler [ok, metin], not */
  var karne = function (pct, title, items, note) {
    var c = pct >= 85 ? 'var(--ok)' : pct >= 60 ? 'var(--warn)' : 'var(--bad)';
    var lbl = pct >= 85 ? 'ÇOK İYİ' : pct >= 60 ? 'GELİŞİYOR' : 'TEKRAR';
    return '<div class="karne"><div class="stamp" style="color:' + c + '"><b>%' + Math.round(pct) + '</b><small>' + lbl + '</small></div>' +
      '<h3>' + X(title) + '</h3><ul>' + (items || []).map(function (it) { return '<li class="' + (it[0] ? 'ok' : 'no') + '">' + it[1] + '</li>'; }).join('') + '</ul>' +
      (note ? '<p class="not">' + note + '</p>' : '') + '</div>';
  };
  /* Dudi: konuşan dudak maskotu (boş durumlar, vaka dosyası) */
  var dudi = function (sz) {
    return '<svg class="dudi" width="' + (sz || 64) + '" height="' + (sz || 64) + '" viewBox="0 0 64 64" aria-hidden="true"><circle cx="30" cy="32" r="26" fill="#F4C9A8" stroke="#0D1838" stroke-width="2.6"/><ellipse class="eye" cx="21" cy="24" rx="3" ry="3.8" fill="#0D1838"/><ellipse class="eye" cx="39" cy="24" rx="3" ry="3.8" fill="#0D1838"/><g class="mouth"><path d="M14 37 C20 30 40 30 46 37 C40 49 20 49 14 37 Z" fill="#E0705A" stroke="#0D1838" stroke-width="2.4"/><path d="M22 41 C26 39 34 39 38 41" stroke="#F9C6B8" stroke-width="2.6" fill="none" stroke-linecap="round"/></g><path class="wv" d="M55 26q4 6 0 12" stroke="#E0705A" stroke-width="2.6" fill="none" stroke-linecap="round"/><path class="wv w2" d="M59 21q7 11 0 22" stroke="#E0705A" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';
  };

  var DK = W.DK = W.DK || {};
  DK.st = DK.st || {};
  DK.core = { V: V, $: $, $$: $$, X: X, ls: ls, tr: tr, toast: toast, live: live, RM: RM, karne: karne, dudi: dudi, shuffle: shuffle };

  /* ---------------- sekmeler ---------------- */
  /* vaka masası Acadex Medica'da: yalnız ?medica=1 ile açılır (labs/medica) */
  var MEDICA = /(?:\?|&)medica=1(?:&|$)/.test(location.search);
  DK.core.MEDICA = MEDICA;
  var TABS = MEDICA ? ['sesletim', 'ses', 'akicilik', 'yutma', 'dil', 'vaka'] : ['sesletim', 'ses', 'akicilik', 'yutma', 'dil'];
  var tab = null, inited = {};
  var setTab = function (k) {
    if (TABS.indexOf(k) < 0) k = 'sesletim';
    if (tab && tab !== k && DK.st[tab] && DK.st[tab].hide) DK.st[tab].hide();
    tab = k;
    $$('.tk-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === k)); });
    $$('.tk-view').forEach(function (v) { v.classList.toggle('on', v.id === k); });
    var st = DK.st[k];
    if (st && !inited[k] && st.init) { inited[k] = true; st.init(); }
    if (st && st.show) st.show();
    ls.set('tab', k); bridgeSend();
  };
  $$('.tk-tabs [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = TABS.indexOf(b.getAttribute('data-tab')), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      e.preventDefault(); setTab(n); var nb = $('.tk-tabs [data-tab="' + n + '"]'); if (nb) nb.focus();
    });
  });
  DK.core.setTab = setTab; DK.core.tab = function () { return tab; };

  /* ---------------- MedLab köprüsü ---------------- */
  var EMB = W.parent !== W && /(?:\?|&)medlab=1(?:&|$)/.test(location.search), ORG = location.origin;
  var post = function (m) { if (!EMB) return; m.src = 'axlab'; m.lab = 'dkt'; try { W.parent.postMessage(m, ORG); } catch (e) {} };
  var NAMES = { sesletim: 'Sesletim atölyesi', ses: 'Ses laboratuvarı', akicilik: 'Akıcılık masası', yutma: 'Yutma masası', dil: 'Dil gelişimi ve afazi', vaka: 'Klinik vaka masası' };
  var ctx = function () {
    var o = { type: 'ctx', mode: tab, spot: false, sel: null, chips: [] };
    var st = DK.st[tab], c = st && st.ctx ? st.ctx() : null;
    if (c) { o.sel = c.sel; o.chips = c.chips || []; }
    if (!o.sel) o.sel = { key: 'dkt.' + tab, title: NAMES[tab] || 'DKT Lab', la: 'DKT Lab', rows: [], about: 'öğrenci DKT Lab\'de ' + (NAMES[tab] || '') + ' istasyonunda çalışıyor.' };
    return o;
  };
  var bridgeSend = DK.bridgeSend = function () { if (!EMB) return; clearTimeout(bridgeSend.t); bridgeSend.t = setTimeout(function () { post(ctx()); }, 40); };
  if (EMB) {
    W.addEventListener('message', function (e) {
      if (e.origin !== ORG || e.source !== W.parent) return;
      var d = e.data; if (!d || d.src !== 'axhost') return;
      if (d.type === 'hello') { bridgeSend(); return; }
      if (d.type !== 'ask') return;
      var st = DK.st[tab];
      var kind = d.kind || (st && st.classify ? st.classify(String(d.q || '').toLocaleLowerCase('tr')) : null);
      var text = kind && st && st.answer ? st.answer(kind) : null;
      if (!text) { post({ type: 'reply', id: d.id, miss: true }); return; }
      post({ type: 'ack', id: d.id }); post({ type: 'reply', id: d.id, text: text });
    });
  }

  /* ---------------- başlat (index.html sonunda) ---------------- */
  DK.core.start = function () {
    var t0 = new URLSearchParams(location.search).get('tab') || ls.get('tab', 'sesletim');
    setTab(t0);
  };
})();
