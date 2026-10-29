/* ==========================================================================
   ACADEX FİNANS · çekirdek (labs/finans/fn-app.js), 29.10.2026
   Sekmeler (istasyonlar), ortak yardımcılar, SVG grafik çizici, karne,
   Hesi (hesap makinesi maskotu) ve Acadex köprüsü (sitenin Acadia'sı).
   İstasyonlar kendini FN.st'ye kaydeder: { init, show, hide, ctx, answer, classify }.
   Veri: fn-veri.js (AXFIN). Hepsi kurgusal; ağ isteği yok.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, V = W.AXFIN;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem('acadex.finans.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.finans.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  /* Türkçe sayı biçimi: 1.234,56 */
  var nf = function (v, n) {
    if (v == null || !isFinite(v)) return '—';
    n = n == null ? 0 : n;
    var s = Math.abs(v).toFixed(n).split('.'), i = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (v < 0 && Number(Math.abs(v).toFixed(n)) !== 0 ? '−' : '') + i + (s[1] ? ',' + s[1] : '');
  };
  var tl = function (v, n) { return nf(v, n) + ' TL'; };
  var pct = function (v, n) { return v == null || !isFinite(v) ? '—' : '%' + nf(v * 100, n == null ? 1 : n); };
  /* "1.234,5" ya da "1234.5" girişini sayıya çevirir */
  var num = function (s) {
    if (typeof s === 'number') return s;
    s = String(s == null ? '' : s).trim().replace(/\s|TL|%/g, '');
    if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var v = parseFloat(s.replace('−', '-')); return isFinite(v) ? v : NaN;
  };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var toast = function (t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2600); };
  var live = function (t) { $('#live').textContent = t; };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  /* karne: puan yüzdesi, başlık, maddeler [ok, metin], not */
  var karne = function (p, title, items, note) {
    var c = p >= 85 ? 'var(--ok)' : p >= 60 ? 'var(--warn)' : 'var(--bad)';
    var lbl = p >= 85 ? 'ONAYLANDI' : p >= 60 ? 'EKSİKLİ' : 'İADE';
    return '<div class="karne"><div class="stamp" style="color:' + c + '"><b>%' + Math.round(p) + '</b><small>' + lbl + '</small></div>' +
      '<h3>' + X(title) + '</h3><ul>' + (items || []).map(function (it) { return '<li class="' + (it[0] ? 'ok' : 'no') + '">' + it[1] + '</li>'; }).join('') + '</ul>' +
      (note ? '<p class="not">' + note + '</p>' : '') + '</div>';
  };
  /* Hesi: hesap makinesi maskotu; ekranında kısa bir değer yazar */
  var hesi = function (sz, ekran) {
    return '<svg class="hesi" width="' + (sz || 64) + '" height="' + (sz || 64) + '" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect x="12" y="4" width="40" height="56" rx="8" fill="#B5D4F4" stroke="#0D1838" stroke-width="2.6"/>' +
      '<rect x="17" y="9" width="30" height="13" rx="2.5" fill="#0D2440"/><text x="44" y="19.5" font-family="JetBrains Mono,monospace" font-size="8.5" fill="#7FE0C2" text-anchor="end">' + X(ekran || '%12') + '</text>' +
      '<g class="eye"><circle cx="25" cy="30" r="2.6" fill="#0D1838"/><circle cx="39" cy="30" r="2.6" fill="#0D1838"/></g>' +
      '<path d="M26 37 Q32 41 38 37" stroke="#0D1838" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<g fill="#2F6FB0"><rect x="18" y="44" width="7" height="5" rx="1.5"/><rect x="28.5" y="44" width="7" height="5" rx="1.5"/><rect x="39" y="44" width="7" height="5" rx="1.5" fill="#C8553D"/>' +
      '<rect x="18" y="51" width="7" height="5" rx="1.5"/><rect x="28.5" y="51" width="7" height="5" rx="1.5"/><rect x="39" y="51" width="7" height="5" rx="1.5" fill="#E0A526"/></g>' +
      '<path class="arm" d="M52 34 l7 -6" stroke="#0D1838" stroke-width="2.6" stroke-linecap="round"/><circle class="arm" cx="59.5" cy="27.5" r="2.6" fill="#B5D4F4" stroke="#0D1838" stroke-width="2"/></svg>';
  };
  /* Hesi'nin balonu: istasyonlardaki kısa açıklamalar */
  var tip = function (txt, ekran) { return '<div class="tipbox">' + hesi(52, ekran) + '<p>' + txt + '</p></div>'; };

  /* ---------------- SVG grafik ----------------
     o: { w, h, x:[a,b], y:[a,b], xf, yf (etiket biçimi), xt, yt (çentik sayısı) ,
          s: [{ p:[[x,y]...], c, w, d (kesikli), area, cls, lab }],
          bars: [{ x, y0, y1, c, bw, lab }], dots: [{ x, y, c, r, lab, cls }],
          vl: [{ x, c, lab }], hl: [{ y, c, lab }], xl, yl (eksen adı) } */
  var nice = function (a, b, n) {
    if (a === b) { a -= 1; b += 1; }
    var span = b - a, st = Math.pow(10, Math.floor(Math.log10(span / n))), e = span / n / st;
    st *= e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1;
    var lo = Math.floor(a / st) * st, hi = Math.ceil(b / st) * st, out = [];
    for (var v = lo; v <= hi + st / 2; v += st) out.push(Math.abs(v) < st / 1e6 ? 0 : v);
    return out;
  };
  var chart = function (o) {
    /* telefonda dar çizim alanı: yazılar okunur boyda kalsın */
    var mob = (W.innerWidth || 1024) < 600, w = mob ? 380 : o.w || 640, h = mob ? Math.round((o.h || 300) * 0.92) : o.h || 300, L = o.pl == null ? (mob ? 48 : 58) : o.pl, R = o.pr == null ? 16 : o.pr, T = o.pt == null ? (o.yl ? 26 : 14) : o.pt, B = o.pb == null ? 34 : o.pb;
    var pts = [];
    (o.s || []).forEach(function (s) { s.p.forEach(function (q) { pts.push(q); }); });
    (o.bars || []).forEach(function (b) { pts.push([b.x, b.y0]); pts.push([b.x, b.y1]); });
    (o.dots || []).forEach(function (d) { pts.push([d.x, d.y]); });
    var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
    var x0 = o.x ? o.x[0] : Math.min.apply(null, xs), x1 = o.x ? o.x[1] : Math.max.apply(null, xs);
    var yr = o.y || [Math.min.apply(null, ys.concat(o.y0 ? [0] : [])), Math.max.apply(null, ys.concat(o.y0 ? [0] : []))];
    var yt = nice(yr[0], yr[1], o.yt || 5), y0 = o.y ? o.y[0] : yt[0], y1 = o.y ? o.y[1] : yt[yt.length - 1];
    if (o.y) yt = nice(y0, y1, o.yt || 5).filter(function (v) { return v >= y0 - 1e-9 && v <= y1 + 1e-9; });
    if (x1 === x0) x1 = x0 + 1; if (y1 === y0) y1 = y0 + 1;
    var X_ = function (v) { return L + (v - x0) / (x1 - x0) * (w - L - R); }, Y_ = function (v) { return T + (1 - (v - y0) / (y1 - y0)) * (h - T - B); };
    var xf = o.xf || function (v) { return nf(v); }, yf = o.yf || function (v) { return nf(v); };
    var g = '<svg class="ch' + (o.cls ? ' ' + o.cls : '') + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + X(o.al || 'grafik') + '" preserveAspectRatio="xMidYMid meet">';
    g += '<g class="gr">';
    yt.forEach(function (v) { var y = Y_(v); g += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y + '" y2="' + y + '"' + (v === 0 ? ' class="z"' : '') + '/><text x="' + (L - 7) + '" y="' + (y + 4) + '" text-anchor="end">' + X(yf(v)) + '</text>'; });
    var xt = o.xticks || nice(x0, x1, o.xt || 6).filter(function (v) { return v >= x0 - 1e-9 && v <= x1 + 1e-9; });
    xt.forEach(function (v) { var x = X_(v); g += '<text x="' + x + '" y="' + (h - B + 18) + '" text-anchor="middle">' + X(xf(v)) + '</text>'; });
    g += '<line class="ax" x1="' + L + '" x2="' + (w - R) + '" y1="' + (h - B) + '" y2="' + (h - B) + '"/></g>';
    if (o.xl) g += '<text class="axl" x="' + (w - R) + '" y="' + (h - 4) + '" text-anchor="end">' + X(o.xl) + '</text>';
    if (o.yl) g += '<text class="axl" x="' + 4 + '" y="12">' + X(o.yl) + '</text>';
    (o.hl || []).forEach(function (l) { var y = Y_(l.y); g += '<line class="rl" x1="' + L + '" x2="' + (w - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + (l.c || '#6A7593') + '"/>' + (l.lab ? '<text class="rlt" x="' + (w - R - 4) + '" y="' + (y - 5) + '" text-anchor="end" fill="' + (l.c || '#6A7593') + '">' + X(l.lab) + '</text>' : ''); });
    (o.vl || []).forEach(function (l) { var x = X_(l.x); g += '<line class="rl" x1="' + x + '" x2="' + x + '" y1="' + T + '" y2="' + (h - B) + '" stroke="' + (l.c || '#6A7593') + '"/>' + (l.lab ? '<text class="rlt" x="' + (x + 5) + '" y="' + (T + 11) + '" fill="' + (l.c || '#6A7593') + '">' + X(l.lab) + '</text>' : ''); });
    (o.bars || []).forEach(function (b, i) {
      var bw = (b.bw || 0.7) * (w - L - R) / Math.max(1, (o.nb || (o.bars.length))), x = X_(b.x) - bw / 2, ya = Y_(Math.max(b.y0, b.y1)), yb = Y_(Math.min(b.y0, b.y1));
      g += '<rect class="bar" style="--d:' + (i * 0.025).toFixed(3) + 's" x="' + x.toFixed(1) + '" y="' + ya.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0.5, yb - ya).toFixed(1) + '" rx="2" fill="' + b.c + '"><title>' + X(b.lab || '') + '</title></rect>';
    });
    (o.s || []).forEach(function (s) {
      if (!s.p.length) return;
      var d = s.p.map(function (q, i) { return (i ? 'L' : 'M') + X_(q[0]).toFixed(1) + ' ' + Y_(q[1]).toFixed(1); }).join('');
      if (s.area) g += '<path class="area" d="' + d + 'L' + X_(s.p[s.p.length - 1][0]).toFixed(1) + ' ' + Y_(s.base || Math.max(y0, 0)).toFixed(1) + 'L' + X_(s.p[0][0]).toFixed(1) + ' ' + Y_(s.base || Math.max(y0, 0)).toFixed(1) + 'Z" fill="' + s.c + '"/>';
      g += '<path class="ln' + (s.cls ? ' ' + s.cls : '') + (o.anim === false ? '' : ' draw') + '" pathLength="1" d="' + d + '" stroke="' + s.c + '" stroke-width="' + (s.w || 2.6) + '"' + (s.d ? ' stroke-dasharray="' + s.d + '"' : '') + '/>';
      if (s.lab) { var q = s.p[s.p.length - 1]; g += '<text class="slab" x="' + (X_(q[0]) - 4) + '" y="' + (Y_(q[1]) - 7) + '" text-anchor="end" fill="' + s.c + '">' + X(s.lab) + '</text>'; }
    });
    (o.dots || []).forEach(function (d) {
      g += '<circle class="dot' + (d.cls ? ' ' + d.cls : '') + '" cx="' + X_(d.x).toFixed(1) + '" cy="' + Y_(d.y).toFixed(1) + '" r="' + (d.r || 4) + '" fill="' + d.c + '"' + (d.o != null ? ' fill-opacity="' + d.o + '"' : '') + '>' + (d.lab ? '<title>' + X(d.lab) + '</title>' : '') + '</circle>';
      if (d.t) g += '<text class="dlab" x="' + (X_(d.x) + (d.r || 4) + 4).toFixed(1) + '" y="' + (Y_(d.y) + 4).toFixed(1) + '"' + (d.tc ? ' fill="' + d.tc + '"' : '') + '>' + X(d.t) + '</text>';
    });
    g += '</svg>';
    return g;
  };
  /* halka grafik: [[değer, renk, etiket]] */
  var donut = function (parts, sz, mid) {
    var tot = parts.reduce(function (a, p) { return a + Math.max(0, p[0]); }, 0) || 1, a0 = -Math.PI / 2, R = 44, r = 28, g = '<svg class="donut" viewBox="0 0 100 100" width="' + (sz || 160) + '" height="' + (sz || 160) + '" role="img" aria-label="dağılım">';
    parts.forEach(function (p) {
      var f = Math.max(0, p[0]) / tot; if (f <= 0) return;
      if (f > 0.9999) { g += '<circle cx="50" cy="50" r="' + ((R + r) / 2) + '" fill="none" stroke="' + p[1] + '" stroke-width="' + (R - r) + '"/>'; return; }
      var a1 = a0 + f * Math.PI * 2, lg = f > 0.5 ? 1 : 0, c = function (rr, a) { return (50 + rr * Math.cos(a)).toFixed(2) + ' ' + (50 + rr * Math.sin(a)).toFixed(2); };
      g += '<path d="M' + c(R, a0) + 'A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + c(R, a1) + 'L' + c(r, a1) + 'A' + r + ' ' + r + ' 0 ' + lg + ' 0 ' + c(r, a0) + 'Z" fill="' + p[1] + '"><title>' + X(p[2] || '') + '</title></path>';
      a0 = a1;
    });
    return g + (mid ? '<text x="50" y="54" text-anchor="middle" class="dmid">' + X(mid) + '</text>' : '') + '</svg>';
  };
  /* sayının akarak yazılması (tek eleman) */
  var roll = function (el, to, fmt) {
    if (!el) return; var from = Number(el.getAttribute('data-v') || 0); el.setAttribute('data-v', to);
    if (RM || !isFinite(from) || !isFinite(to)) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), d = 450;
    var step = function (t) { var k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  var FN = W.FN = W.FN || {};
  FN.st = FN.st || {};
  FN.core = { V: V, $: $, $$: $$, X: X, ls: ls, nf: nf, tl: tl, pct: pct, num: num, clamp: clamp, toast: toast, live: live, RM: RM, karne: karne, hesi: hesi, tip: tip, shuffle: shuffle, chart: chart, donut: donut, roll: roll };

  /* ---------------- istasyonlar ---------------- */
  /* başka lablar (labs/sirket) aynı çekirdeği W.FN_CONF ile kullanır: { tabs, names, lab, brand } */
  var CONF = W.FN_CONF || {};
  var TABS = CONF.tabs || ['zaman', 'muhasebe', 'borsa', 'dis', 'analiz', 'makro', 'turev', 'kisisel'];
  var NAMES = CONF.names || { zaman: 'Paranın zaman değeri', muhasebe: 'Muhasebe rıhtımı', borsa: 'Borsa ve portföy', dis: 'Dış ticaret', analiz: 'Finansal tablo analizi', makro: 'Kur ve makro', turev: 'Türev ürünler', kisisel: 'Kişisel finans' };
  var LAB = CONF.lab || 'finans', BRAND = CONF.brand || 'Acadex Finans';
  FN.NAMES = NAMES; FN.TABS = TABS;
  var tab = null, inited = {};
  var setTab = function (k) {
    if (TABS.indexOf(k) < 0) k = TABS[0];
    if (tab && tab !== k && FN.st[tab] && FN.st[tab].hide) FN.st[tab].hide();
    tab = k;
    $$('.pt-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === k)); });
    $$('.pt-view').forEach(function (v) { v.classList.toggle('on', v.id === k); });
    var sb = $('.pt-tabs [data-tab="' + k + '"]'); if (sb && sb.scrollIntoView) { try { sb.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
    var st = FN.st[k];
    if (st && !inited[k] && st.init) { inited[k] = true; st.init(); }
    if (st && st.show) st.show();
    ls.set(LAB === 'finans' ? 'tab' : LAB + '.tab', k); bridgeSend();
  };
  $$('.pt-tabs [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); try { W.scrollTo({ top: 0 }); } catch (e) {} });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = TABS.indexOf(b.getAttribute('data-tab')), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      e.preventDefault(); setTab(n); var nb = $('.pt-tabs [data-tab="' + n + '"]'); if (nb) nb.focus();
    });
  });
  FN.core.setTab = setTab; FN.core.tab = function () { return tab; };

  /* ---------------- Acadex köprüsü (hub iframe'i, ?hub=1) ---------------- */
  var EMB = W.parent !== W && /(?:\?|&)hub=1(?:&|$)/.test(location.search), ORG = location.origin;
  var post = function (m) { if (!EMB) return; m.src = 'axlab'; m.lab = LAB; try { W.parent.postMessage(m, ORG); } catch (e) {} };
  var ctx = function () {
    var o = { type: 'ctx', mode: tab, spot: false, sel: null, chips: [] };
    var st = FN.st[tab], c = st && st.ctx ? st.ctx() : null;
    if (c) { o.sel = c.sel; o.chips = c.chips || []; }
    if (!o.sel) o.sel = { key: LAB + '.' + tab, title: NAMES[tab] || BRAND, la: BRAND, rows: [], about: 'öğrenci ' + BRAND + '\'ta ' + (NAMES[tab] || '') + ' istasyonunda çalışıyor.' };
    o.sel.title = (NAMES[tab] || '') + (o.sel.title && o.sel.title !== NAMES[tab] ? ' · ' + o.sel.title : '');
    return o;
  };
  var bridgeSend = FN.bridgeSend = function () { if (!EMB) return; clearTimeout(bridgeSend.t); bridgeSend.t = setTimeout(function () { post(ctx()); }, 60); };
  if (EMB) {
    W.addEventListener('message', function (e) {
      if (e.origin !== ORG || e.source !== W.parent) return;
      var d = e.data; if (!d || d.src !== 'axhost') return;
      if (d.type === 'hello') { bridgeSend(); return; }
      if (d.type === 'tab') { setTab(d.tab); return; }
      if (d.type !== 'ask') return;
      var st = FN.st[tab];
      var kind = d.kind || (st && st.classify ? st.classify(String(d.q || '').toLocaleLowerCase('tr')) : null);
      var text = kind && st && st.answer ? st.answer(kind) : null;
      if (!text) { post({ type: 'reply', id: d.id, miss: true }); return; }
      post({ type: 'ack', id: d.id }); post({ type: 'reply', id: d.id, text: text });
    });
  }

  /* ---------------- başlat (index.html sonunda) ---------------- */
  FN.core.start = function () {
    var q = new URLSearchParams(location.search).get('tab'), h = (location.hash || '').slice(1);
    setTab(TABS.indexOf(q) > -1 ? q : TABS.indexOf(h) > -1 ? h : ls.get(LAB === 'finans' ? 'tab' : LAB + '.tab', TABS[0]));
  };
})();
