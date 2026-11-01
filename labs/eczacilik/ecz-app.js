/* ==========================================================================
   ACADEX ECZACILIK LAB · çekirdek (labs/eczacilik/ecz-app.js), 01.11.2026
   Sekmeler, ortak yardımcılar, karne, maskot ve MedLab köprüsü (Acadia).
   İstasyonlar kendini EC.st'ye kaydeder: { init, show, hide, ctx, answer, classify }.
   Veri: ecz-veri.js (AXECZ).
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, V = W.AXECZ;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem('acadex.ecz.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.ecz.' + k, JSON.stringify(v)); } catch (e) { /* depolama kapalı */ } }
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
  /* maskot Havancık: yüzü olan havan-tokmak */
  var havan = function (sz) {
    return '<svg class="havan" width="' + (sz || 64) + '" height="' + (sz || 64) + '" viewBox="0 0 64 64" aria-hidden="true"><g class="tok"><rect x="38" y="4" width="9" height="30" rx="4.5" transform="rotate(28 42 20)" fill="#C99A6B" stroke="#0D1838" stroke-width="2.4"/></g>' +
      '<path d="M8 30 H56 C56 46 46 56 32 56 C18 56 8 46 8 30 Z" fill="#EDE6F8" stroke="#0D1838" stroke-width="2.6"/><rect x="5" y="26" width="54" height="7" rx="3.5" fill="#7A4FA8" stroke="#0D1838" stroke-width="2.4"/>' +
      '<ellipse class="eye" cx="24" cy="41" rx="2.6" ry="3.2" fill="#0D1838"/><ellipse class="eye" cx="40" cy="41" rx="2.6" ry="3.2" fill="#0D1838"/><path d="M27 48 C30 51 34 51 37 48" stroke="#0D1838" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="19" cy="46" rx="3.6" ry="2" fill="#F2A5C0" opacity=".8"/><ellipse cx="45" cy="46" rx="3.6" ry="2" fill="#F2A5C0" opacity=".8"/></svg>';
  };
  /* ilaç kutusu çizimi (raf ve kartlar) */
  var kutu = function (il, w, h) {
    w = w || 78; h = h || 58;
    return '<svg class="kutu" width="' + w + '" height="' + h + '" viewBox="0 0 78 58" aria-hidden="true"><rect x="2" y="6" width="74" height="50" rx="5" fill="' + il.kutu + '" stroke="#0D1838" stroke-width="2"/><path d="M2 14 H76" stroke="#0D1838" stroke-width="1.4" opacity=".4"/>' +
      '<rect x="8" y="20" width="10" height="10" rx="2" fill="' + (il.rec === 'kirmizi' ? '#C9483B' : il.rec === 'yesil' ? '#2E8E5B' : '#FFFFFF') + '" stroke="#0D1838" stroke-width="1.2"/>' +
      '<text x="22" y="29" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="8.6" font-weight="800" fill="#0D1838">' + X(il.ad.length > 13 ? il.ad.slice(0, 12) + '…' : il.ad) + '</text>' +
      '<text x="8" y="46" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700" fill="#46506A">' + X(il.guc) + '</text><text x="70" y="46" text-anchor="end" font-family="Instrument Sans,sans-serif" font-size="7" fill="#46506A">' + X(il.form) + '</text></svg>';
  };

  var EC = W.EC = W.EC || {};
  EC.st = EC.st || {};
  EC.core = { V: V, $: $, $$: $$, X: X, ls: ls, tr: tr, toast: toast, live: live, RM: RM, karne: karne, havan: havan, kutu: kutu, shuffle: shuffle, rng: rng };

  /* ---------------- sekmeler ---------------- */
  var MEDICA = /(?:\?|&)medica=1(?:&|$)/.test(location.search);
  EC.core.MEDICA = MEDICA;
  var TABS = MEDICA ? ['tezgah', 'doz', 'etk', 'maj', 'vaka'] : ['tezgah', 'doz', 'etk', 'maj'];
  var tab = null, inited = {};
  var setTab = function (k) {
    if (TABS.indexOf(k) < 0) k = 'tezgah';
    if (tab && tab !== k && EC.st[tab] && EC.st[tab].hide) EC.st[tab].hide();
    tab = k;
    $$('.ec-tabs [data-tab]').forEach(function (b) { var on = b.getAttribute('data-tab') === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$('.ec-view').forEach(function (v) { v.classList.toggle('on', v.id === k); });
    var st = EC.st[k];
    if (st && !inited[k] && st.init) { inited[k] = true; st.init(); }
    if (st && st.show) st.show();
    if (k !== 'vaka') ls.set('tab', k); bridgeSend();
  };
  $$('.ec-tabs [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = TABS.indexOf(b.getAttribute('data-tab')), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      e.preventDefault(); setTab(n); var nb = $('.ec-tabs [data-tab="' + n + '"]'); if (nb) nb.focus();
    });
  });
  EC.core.setTab = setTab; EC.core.tab = function () { return tab; };

  /* ---------------- MedLab köprüsü (Acadia) ---------------- */
  var EMB = W.parent !== W && /(?:\?|&)medlab=1(?:&|$)/.test(location.search), ORG = location.origin;
  var post = function (m) { if (!EMB) return; m.src = 'axlab'; m.lab = 'eczacilik'; try { W.parent.postMessage(m, ORG); } catch (e) { /* köprü yok */ } };
  var NAMES = { tezgah: 'Eczane tezgâhı', doz: 'Doz hesap masası', etk: 'Etkileşim ve farmakoloji', maj: 'Majistral laboratuvarı', vaka: 'Klinik vaka masası' };
  var ctx = function () {
    var o = { type: 'ctx', mode: tab, spot: false, sel: null, chips: [] };
    var st = EC.st[tab], c = st && st.ctx ? st.ctx() : null;
    if (c) { o.sel = c.sel; o.chips = c.chips || []; }
    if (!o.sel) o.sel = { key: 'ecz.' + tab, title: NAMES[tab] || 'Eczacılık Lab', la: 'Eczacılık Lab', rows: [], about: 'öğrenci Eczacılık Lab\'de ' + (NAMES[tab] || '') + ' istasyonunda çalışıyor.' };
    return o;
  };
  var bridgeSend = EC.bridgeSend = function () { if (!EMB) return; clearTimeout(bridgeSend.t); bridgeSend.t = setTimeout(function () { post(ctx()); }, 40); };
  if (EMB) {
    W.addEventListener('message', function (e) {
      if (e.origin !== ORG || e.source !== W.parent) return;
      var d = e.data; if (!d || d.src !== 'axhost') return;
      if (d.type === 'hello') { bridgeSend(); return; }
      if (d.type !== 'ask') return;
      var st = EC.st[tab];
      var kind = d.kind || (st && st.classify ? st.classify(String(d.q || '').toLocaleLowerCase('tr')) : null);
      var text = kind && st && st.answer ? st.answer(kind) : null;
      if (!text) { post({ type: 'reply', id: d.id, miss: true }); return; }
      post({ type: 'ack', id: d.id }); post({ type: 'reply', id: d.id, text: text });
    });
  }

  EC.core.start = function () {
    var t0 = new URLSearchParams(location.search).get('tab') || ls.get('tab', 'tezgah');
    setTab(t0);
  };
})();
