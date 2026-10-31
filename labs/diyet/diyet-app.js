/* ==========================================================================
   ACADEX DİYET LAB · uygulama çekirdeği (labs/diyet/diyet-app.js), 29.10.2026
   Sekmeler, TABAK & MENÜ (kiler, terazi, tabak, besin ögesi panosu, görevler) ve MedLab köprüsü.
   Antropometri, vaka masası ve enteral/parenteral: diyet-klinik.js (DL.klinik).
   Model: diyet-model.js (AXDIYET) · besin verisi: data/besin.js (AXDB) · ikonlar: diyet-ikon.js (AXIKON)
   ========================================================================== */
(function () {
  'use strict';
  var M = window.AXDIYET, IK = window.AXIKON, D = document, W = window;
  M.load(W.AXDB || {});
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = { get: function (k, d) { try { var v = localStorage.getItem('acadex.diyet.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.diyet.' + k, JSON.stringify(v)); } catch (e) {} } };
  var tr = function (v, n) { if (v == null || isNaN(v)) return '—'; var s = Number(v).toFixed(n == null ? 0 : n); return s.replace('.', ','); };
  var toast = function (t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2600); };
  var live = function (t) { $('#live').textContent = t; };
  var RM = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DL = W.DL = W.DL || {};
  DL.core = { M: M, IK: IK, $: $, $$: $$, X: X, ls: ls, tr: tr, toast: toast, live: live, RM: RM };

  /* ---------------- sekmeler ---------------- */
  var tab = 'tabak';
  /* vaka masası ve enteral-parenteral Acadex Medica'da: yalnız ?medica=1 ile açılır (labs/medica) */
  var MEDICA = /(?:\?|&)medica=1(?:&|$)/.test(location.search);
  DL.core.MEDICA = MEDICA;
  var setTab = function (k) {
    if (['tabak', 'degisim', 'antro', 'vaka', 'ep'].indexOf(k) < 0 || (!MEDICA && (k === 'vaka' || k === 'ep'))) k = 'tabak';
    tab = k;
    $$('.dl-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === k)); });
    $$('.dl-view').forEach(function (v) { v.classList.toggle('on', v.id === k); });
    ls.set('tab', k); if (DL.klinik && DL.klinik.onTab) DL.klinik.onTab(k); if (k === 'degisim' && DL.degisim) DL.degisim.paint(); bridgeSend();
  };
  $$('.dl-tabs [data-tab]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); }); });
  DL.core.setTab = setTab; DL.core.tab = function () { return tab; };

  /* =========================== TABAK & MENÜ =========================== */
  var OGUN = [['kahvalti', 'Kahvaltı'], ['ogle', 'Öğle'], ['aksam', 'Akşam'], ['ara', 'Ara öğün'], ['gun', 'Günün toplamı']];
  var ON = {}; OGUN.forEach(function (o) { ON[o[0]] = o[1]; });
  var CATS = [['', 'Tümü'], ['tarif', 'Tarifler'], ['tahil', 'Tahıl'], ['et', 'Et · balık · yumurta'], ['baklagil', 'Baklagil'], ['sut', 'Süt'], ['sebze', 'Sebze'], ['meyve', 'Meyve'], ['yag', 'Yağ · zeytin'], ['kuruyemis', 'Kuruyemiş'], ['seker', 'Şeker · tatlı'], ['icecek', 'İçecek'], ['tuz', 'Tuz']];
  var T = {
    ogun: ls.get('ogun', 'kahvalti'), cat: '', q: '', sel: null, mi: 0, g: 0,
    menu: ls.get('menu', { kahvalti: [], ogle: [], aksam: [], ara: [] }),
    prof: ls.get('prof', 'kadin'), ozel: ls.get('ozel', null), gorev: ls.get('gorev', null), fiyat: ls.get('fiyat', {}), cost: ls.get('cost', false), gdone: ls.get('gdone', {})
  };
  ['kahvalti', 'ogle', 'aksam', 'ara'].forEach(function (k) { if (!Array.isArray(T.menu[k])) T.menu[k] = []; });
  var saveMenu = function () { ls.set('menu', T.menu); };
  var allFoods = function () { return M.DB.besin.filter(function (b) { return b.id !== 'pirinckuru' && b.id !== 'mercimekkuru' && b.id !== 'un'; }).concat(M.DB.tarif.map(function (t) { return M.DB.by[t.id]; })); };
  var per = function (b) { return b.kat === 'tarif' ? b.ol[0][1] : 100; };
  var tags = function (b) { var s = ''; if (b.b && /g/.test(b.b)) s += '<i title="gluten içerir">G</i>'; else if (b.b && /y/.test(b.b)) s += '<i title="gluten bulaşı olabilir">G?</i>'; if (b.b && /l/.test(b.b)) s += '<i title="laktoz içerir">L</i>'; return s; };
  var norm = function (s) { return String(s).toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  $('#cats').innerHTML = CATS.map(function (c) { return '<button type="button" data-cat="' + c[0] + '" aria-pressed="' + (c[0] === T.cat) + '">' + c[1] + '</button>'; }).join('');
  $('#cats').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; T.cat = b.getAttribute('data-cat'); $$('#cats [data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); paintList(); });
  $('#srch').addEventListener('input', function () { T.q = this.value; paintList(); });
  var paintList = function () {
    var q = norm(T.q.trim()), list = allFoods().filter(function (b) { return (!T.cat || b.kat === T.cat) && (!q || norm(b.ad).indexOf(q) >= 0); });
    $('#flist').innerHTML = list.length ? list.map(function (b) {
      var kc = b.n.kcal * per(b) / 100;
      return '<button type="button" class="fi" data-f="' + b.id + '" aria-pressed="' + (b.id === T.sel) + '">' + IK.svg(b.id, 34) + '<span><b>' + X(b.ad) + '</b><small>' + Math.round(kc) + ' kcal / ' + (b.kat === 'tarif' ? X(b.ol[0][0]) + ' (' + Math.round(per(b)) + ' g)' : '100 g') + '</small></span><span class="tg">' + tags(b) + '</span></button>';
    }).join('') : '<p class="sub" style="color:#3A2410;padding:8px">Bulunamadı. Başka bir ad dene.</p>';
  };
  $('#flist').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) pickFood(b.getAttribute('data-f')); });

  /* terazi */
  (function ticks() { var s = ''; for (var g = 0; g <= 500; g += 50) { var a = (-90 + g / 500 * 180) * Math.PI / 180, x1 = 100 + Math.sin(a) * 72, y1 = 100 - Math.cos(a) * 72, x2 = 100 + Math.sin(a) * (g % 100 ? 66 : 62), y2 = 100 - Math.cos(a) * (g % 100 ? 66 : 62); s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#0D1838" stroke-width="' + (g % 100 ? 1.4 : 2.4) + '"/>'; if (!(g % 100)) s += '<text x="' + (100 + Math.sin(a) * 52).toFixed(1) + '" y="' + (100 - Math.cos(a) * 52 + 3).toFixed(1) + '" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" fill="#46506A">' + g + '</text>'; } $('#ticks').innerHTML = s; })();
  var paintScale = function () {
    var b = T.sel && M.DB.by[T.sel], g = T.g;
    $('#needle').style.transform = 'rotate(' + (-90 + Math.min(500, g) / 500 * 180) + 'deg)';
    $('#s-lcd').innerHTML = Math.round(g) + '<small>g</small>';
    $('#q-g').value = Math.round(g);
    if (!b) { $('#s-name').textContent = 'Kilerden bir besin seç'; $('#s-meas').innerHTML = ''; $('#s-add').disabled = true; return; }
    $('#s-name').innerHTML = X(b.ad) + '<br><span class="mono" style="font-size:12px;font-weight:600;color:var(--muted)">' + Math.round(b.n.kcal * g / 100) + ' kcal · ' + tr(b.n.pro * g / 100, 1) + ' g protein</span>';
    $('#s-meas').innerHTML = b.ol.map(function (o, i) { return '<button type="button" data-mi="' + i + '" aria-pressed="' + (i === T.mi) + '">' + X(o[0]) + ' · ' + Math.round(o[1]) + ' g</button>'; }).join('') + '<button type="button" data-mi="-1" aria-pressed="' + (T.mi === -1) + '">gram</button>';
    $('#s-add').disabled = !(g > 0);
  };
  var stepG = function () { var b = M.DB.by[T.sel]; return b && T.mi >= 0 ? b.ol[T.mi][1] : 10; };
  var pickFood = function (id) {
    var b = M.DB.by[id]; if (!b) return;
    T.sel = id; T.mi = 0; T.g = b.ol[0][1];
    $$('#flist [data-f]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-f') === id)); });
    paintScale(); bridgeSend();
    if (W.innerWidth < 900) { var sc = $('.scale'); if (sc && sc.scrollIntoView) sc.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); }   /* telefonda terazi aşağıda kalır */
  };
  $('#s-meas').addEventListener('click', function (e) { var x = e.target.closest('[data-mi]'); if (!x) return; T.mi = +x.getAttribute('data-mi'); if (T.mi >= 0) T.g = M.DB.by[T.sel].ol[T.mi][1]; paintScale(); });
  $('#q-dn').onclick = function () { if (!T.sel) return; T.g = Math.max(0, T.g - stepG()); paintScale(); };
  $('#q-up').onclick = function () { if (!T.sel) return; T.g = Math.min(2000, T.g + stepG()); paintScale(); };
  $('#q-g').addEventListener('change', function () { if (!T.sel) return; T.mi = -1; T.g = Math.max(0, Math.min(2000, +this.value || 0)); paintScale(); });
  var olText = function (it) {
    var b = M.DB.by[it.id]; if (!b) return '';
    for (var i = 0; i < b.ol.length; i++) { var n = it.g / b.ol[i][1]; if (Math.abs(n - Math.round(n)) < 0.01 && Math.round(n) >= 1) return Math.round(n) + ' × ' + b.ol[i][0]; }
    return '';
  };
  var flyTo = function (id) {
    if (RM) return;
    var from = $('#s-name').getBoundingClientRect(), to = $('#plate-items').getBoundingClientRect(), el = D.createElement('div');
    el.className = 'fly'; el.innerHTML = IK.svg(id, 56); el.style.left = (from.left + from.width / 2 - 28) + 'px'; el.style.top = (from.top - 10) + 'px';
    D.body.appendChild(el); void el.offsetWidth;
    el.style.transform = 'translate(' + (to.left + to.width / 2 - from.left - from.width / 2) + 'px,' + (to.top + to.height / 2 - from.top) + 'px) scale(.6)'; el.style.opacity = '.2';
    setTimeout(function () { el.remove(); }, 650);
  };
  $('#s-add').onclick = function () {
    if (!T.sel || !(T.g > 0)) return;
    if (T.ogun === 'gun') { toast('Önce bir öğün seç: kahvaltı, öğle, akşam ya da ara öğün.'); return; }
    T.menu[T.ogun].push({ id: T.sel, g: Math.round(T.g) }); saveMenu(); flyTo(T.sel);
    setTimeout(function () { paintTabak(); }, RM ? 0 : 420);
    live(M.DB.by[T.sel].ad + ' ' + Math.round(T.g) + ' g tabağa kondu'); bridgeSend();
  };
  $('#m-clear').onclick = function () {
    if (T.ogun === 'gun') { if (!confirm('Bütün öğünler boşaltılsın mı?')) return; ['kahvalti', 'ogle', 'aksam', 'ara'].forEach(function (k) { T.menu[k] = []; }); }
    else T.menu[T.ogun] = [];
    saveMenu(); paintTabak(); bridgeSend();
  };
  var ogunItems = function (k) { return k === 'gun' ? ['kahvalti', 'ogle', 'aksam', 'ara'].reduce(function (a, o) { return a.concat(T.menu[o]); }, []) : T.menu[k]; };
  var paintOgun = function () {
    $('#ogun').innerHTML = OGUN.map(function (o) { var s = M.analiz(ogunItems(o[0])); return '<button type="button" data-og="' + o[0] + '" aria-pressed="' + (o[0] === T.ogun) + '">' + o[1] + '<span>' + Math.round(s.kcal) + '</span></button>'; }).join('');
  };
  $('#ogun').addEventListener('click', function (e) { var b = e.target.closest('[data-og]'); if (!b) return; T.ogun = b.getAttribute('data-og'); ls.set('ogun', T.ogun); paintTabak(); bridgeSend(); });
  var paintPlate = function () {
    var items = ogunItems(T.ogun), n = items.length, sz = Math.max(15, 32 - n * 1.3);
    $('#plate-empty').hidden = n > 0;
    $('#plate-items').innerHTML = items.map(function (it, i) {
      var r = n === 1 ? 0 : 36 * Math.sqrt((i + 0.6) / n), a = i * 137.5 * Math.PI / 180, x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a), b = M.DB.by[it.id];
      return '<button type="button" class="pi" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%;width:' + sz.toFixed(1) + '%;animation-delay:' + (i * 0.03) + 's" title="' + X(b ? b.ad : '') + ' · ' + it.g + ' g" data-pi="' + i + '">' + IK.svg(it.id, 60) + '</button>';
    }).join('');
    $('#plate-kcal').textContent = Math.round(M.analiz(items).kcal) + ' kcal';
  };
  $('#plate-items').addEventListener('click', function (e) { var b = e.target.closest('[data-pi]'); if (!b) return; var it = ogunItems(T.ogun)[+b.getAttribute('data-pi')]; if (it) pickFood(it.id); });
  var paintTable = function () {
    $('#m-t').textContent = ON[T.ogun]; $('#m-costn').hidden = !T.cost; $('#m-cost').checked = !!T.cost;
    var keys = T.ogun === 'gun' ? ['kahvalti', 'ogle', 'aksam', 'ara'] : [T.ogun], h = '<thead><tr><th>BESİN</th><th class="n">GRAM</th><th>ÖLÇÜ</th><th class="n">KCAL</th><th class="n">PROT.</th>' + (T.cost ? '<th>TL/kg</th><th class="n">TL</th>' : '') + '<th></th></tr></thead><tbody>', tl = 0, any = false;
    keys.forEach(function (k) {
      if (T.ogun === 'gun') h += '<tr><td colspan="' + (T.cost ? 8 : 6) + '" style="background:#F6F1E6;font-weight:800;font-size:12.5px">' + ON[k] + '</td></tr>';
      T.menu[k].forEach(function (it, i) {
        var b = M.DB.by[it.id]; if (!b) return; any = true;
        var pr = T.fiyat[it.id], c = pr ? pr * it.g / 1000 : null; if (c) tl += c;
        h += '<tr><td><span style="display:inline-flex;align-items:center;gap:6px">' + IK.svg(it.id, 24) + X(b.ad) + '</span></td><td class="n">' + it.g + '</td><td style="color:var(--muted);font-size:12px">' + X(olText(it)) + '</td><td class="n">' + Math.round(b.n.kcal * it.g / 100) + '</td><td class="n">' + tr(b.n.pro * it.g / 100, 1) + '</td>' +
          (T.cost ? '<td><input class="pr" type="number" min="0" step="1" data-pr="' + it.id + '" value="' + (pr || '') + '" aria-label="' + X(b.ad) + ' fiyatı TL/kg"></td><td class="n">' + (c ? tr(c, 2) : '—') + '</td>' : '') +
          '<td><button type="button" class="x" data-rm="' + k + '.' + i + '" aria-label="' + X(b.ad) + ' çıkar">×</button></td></tr>';
      });
    });
    var s = M.analiz(ogunItems(T.ogun));
    h += '</tbody><tfoot><tr><td>Toplam</td><td class="n">' + Math.round(ogunItems(T.ogun).reduce(function (a, x) { return a + x.g; }, 0)) + '</td><td></td><td class="n">' + Math.round(s.kcal) + '</td><td class="n">' + tr(s.pro, 1) + '</td>' + (T.cost ? '<td></td><td class="n">' + tr(tl, 2) + '</td>' : '') + '<td></td></tr></tfoot>';
    $('#mtab').innerHTML = any ? h : '<tbody><tr><td style="color:var(--muted)">' + (T.ogun === 'gun' ? 'Henüz hiçbir öğüne besin koymadın.' : 'Bu öğün boş.') + '</td></tr></tbody>';
  };
  $('#mtab').addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (!b) return; var a = b.getAttribute('data-rm').split('.'); T.menu[a[0]].splice(+a[1], 1); saveMenu(); paintTabak(); bridgeSend(); });
  $('#mtab').addEventListener('change', function (e) { var x = e.target.closest('[data-pr]'); if (!x) return; var v = +x.value; if (v > 0) T.fiyat[x.getAttribute('data-pr')] = v; else delete T.fiyat[x.getAttribute('data-pr')]; ls.set('fiyat', T.fiyat); paintTable(); });
  $('#m-cost').addEventListener('change', function () { T.cost = this.checked; ls.set('cost', T.cost); paintTable(); });

  /* hedef profili */
  var PROF = {
    kadin: { ad: 'Kadın', d: 'Hareketsiz yetişkin kadın, 30 yaş, 60 kg', cins: 'K', yas: 30, kg: 60, kcal: 1800 },
    erkek: { ad: 'Erkek', d: 'Hafif aktif yetişkin erkek, 35 yaş, 75 kg', cins: 'E', yas: 35, kg: 75, kcal: 2400 }
  };
  var gorevOf = function (id) { return M.GOREV.filter(function (g) { return g.id === id; })[0]; };
  var target = function () {
    if (T.prof === 'gorev' && gorevOf(T.gorev)) {
      var g = gorevOf(T.gorev), kc = g.kr.filter(function (k) { return k[0] === 'kcal'; })[0], base = PROF[g.profil === 'erkek' ? 'erkek' : 'kadin'];
      return { ad: 'Görev', d: g.t + ' · ' + kc[1] + '–' + kc[2] + ' kcal', cins: base.cins, yas: base.yas, kg: base.kg, kcal: (kc[1] + kc[2]) / 2, ogun: g.ogun };
    }
    if (T.prof === 'ozel' && T.ozel) return T.ozel;
    return PROF[T.prof] || PROF.kadin;
  };
  var paintProf = function () {
    var opts = [['kadin', 'Kadın · 1800'], ['erkek', 'Erkek · 2400'], ['ozel', T.ozel ? 'Hasta · ' + Math.round(T.ozel.kcal) : 'Hasta']];
    if (T.gorev) opts.push(['gorev', 'Görev']);
    $('#prof').style.gridTemplateColumns = 'repeat(' + opts.length + ',minmax(0,1fr))';
    $('#prof').innerHTML = opts.map(function (o) { return '<button type="button" data-prof="' + o[0] + '" aria-pressed="' + (o[0] === T.prof) + '"' + (o[0] === 'ozel' && !T.ozel ? ' disabled title="Antropometri ya da vaka masasından hedef aktar"' : '') + '>' + X(o[1]) + '</button>'; }).join('');
    var t = target(); $('#prof-d').textContent = t.d + (t.ad === 'Görev' ? '' : ' · ' + Math.round(t.kcal) + ' kcal/gün');
  };
  $('#prof').addEventListener('click', function (e) { var b = e.target.closest('[data-prof]'); if (!b || b.disabled) return; T.prof = b.getAttribute('data-prof'); ls.set('prof', T.prof); paintTabak(); bridgeSend(); });
  /* değişim tablosu (diyet-degisim.js) tabağın menüsünü ve hedefini okur */
  DL.core.menu = function () { return T.menu; }; DL.core.target = function () { return target(); };
  DL.setHedef = function (o) { /* antropometri / vaka masasından: {ad, d, cins, yas, kg, kcal} */
    T.ozel = o; T.prof = 'ozel'; ls.set('ozel', o); ls.set('prof', 'ozel'); paintTabak();
  };

  /* pano: halkalar ve çubuklar */
  var ringSVG = function (frac, st, big, val, unit) {
    var R = 40, C = 2 * Math.PI * R, f = Math.max(0, Math.min(1, frac)), col = st === 'ust' ? 'var(--tomato)' : st === 'alt' ? 'var(--wheat)' : 'var(--olive)';
    return '<svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="' + R + '" stroke-width="' + (big ? 11 : 12) + '"/><circle class="fg" cx="50" cy="50" r="' + R + '" stroke-width="' + (big ? 11 : 12) + '" stroke="' + col + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - f)).toFixed(1) + '"/>' +
      '<text class="val" x="50" y="' + (big ? 51 : 53) + '" text-anchor="middle" font-size="' + (big ? 19 : 17) + '">' + val + '</text>' + (unit ? '<text x="50" y="' + (big ? 67 : 69) + '" text-anchor="middle" font-size="10" fill="#6A7593" font-family="JetBrains Mono">' + unit + '</text>' : '') + '</svg>';
  };
  var lastRing = {};
  var paintPano = function () {
    var t = target(), items = ogunItems(T.ogun), s = M.analiz(items), H = M.hedef(t), meal = T.ogun !== 'gun' && t.ogun !== 'kahvalti';
    $('#p-t').textContent = (T.ogun === 'gun' ? 'Günün toplamı' : ON[T.ogun]) + (meal ? ' · günlük hedefe göre' : '');
    var rs = [
      ['kcal', 'Enerji', Math.round(s.kcal), 'kcal', s.kcal / H.kcal.max, M.durum(s.kcal, H.kcal), Math.round(H.kcal.min) + '–' + Math.round(H.kcal.max), true],
      ['kh', 'KH', '%' + Math.round(s.e.kh), tr(s.kh) + ' g', s.kh / H.kh.max, s.kcal ? (s.e.kh > 60 ? 'ust' : s.e.kh < 45 ? 'alt' : 'ok') : 'alt', '%45–60'],
      ['pro', 'Protein', '%' + Math.round(s.e.pro), tr(s.pro) + ' g', s.pro / H.pro.max, s.kcal ? (s.e.pro > 20 ? 'ust' : s.e.pro < 10 ? 'alt' : 'ok') : 'alt', '%10–20'],
      ['yag', 'Yağ', '%' + Math.round(s.e.yag), tr(s.yag) + ' g', s.yag / H.yag.max, s.kcal ? (s.e.yag > 35 ? 'ust' : s.e.yag < 20 ? 'alt' : 'ok') : 'alt', '%20–35']
    ];
    if (meal) rs.forEach(function (r) { if (r[5] === 'alt') r[5] = 'ok'; });
    $('#rings').innerHTML = rs.map(function (r) { var over = r[5] === 'ust' && lastRing[r[0]] !== 'ust'; lastRing[r[0]] = r[5]; return '<div class="ring' + (over ? ' over' : '') + '">' + ringSVG(r[4], r[5], r[7], r[2], r[3]) + '<div class="lb">' + r[1] + '<small>' + r[6] + '</small></div></div>'; }).join('');
    var B = [['lif', 'Lif', 'g', 1], ['sat', 'Doymuş yağ', 'g', 1], ['na', 'Sodyum', 'mg', 0], ['k', 'Potasyum', 'mg', 0], ['ca', 'Kalsiyum', 'mg', 0], ['fe', 'Demir', 'mg', 1], ['c', 'C vitamini', 'mg', 0], ['fol', 'Folat', 'µg', 0], ['b12', 'B12', 'µg', 1], ['d', 'D vitamini', 'µg', 1]];
    $('#bars').innerHTML = B.map(function (b) {
      var h = H[b[0]], ref = h.min != null ? h.min : h.max, v = s[b[0]], st = M.durum(v, h); if (meal && st === 'alt') st = '';
      var scale = ref / 0.7, w = Math.min(100, v / scale * 100);
      return '<div class="bar ' + (st === 'ok' ? '' : st) + '"><b>' + b[1] + '</b><div class="t"><i style="width:' + w.toFixed(1) + '%"></i><u style="left:70%" title="' + (h.min != null ? 'en az ' : 'en çok ') + tr(ref, b[3]) + ' ' + b[2] + '"></u></div><span>' + tr(v, b[3]) + ' / ' + (h.min != null ? '≥' : '≤') + tr(ref, b[3]) + '</span></div>';
    }).join('');
    var fl = '<span class="pill">tuz eşdeğeri ' + tr(s.tuz, 1) + ' g</span>';
    if (s.bay.g) fl += '<span class="pill bad">gluten içeriyor</span>'; else if (s.bay.y) fl += '<span class="pill warn">gluten bulaşı olabilir (yulaf)</span>'; else if (items.length) fl += '<span class="pill ok">glutensiz</span>';
    if (s.bay.l) fl += '<span class="pill">laktoz içeriyor</span>';
    $('#flags').innerHTML = fl;
  };

  /* görevler */
  var paintGorev = function () {
    $('#gorev-l').innerHTML = M.GOREV.map(function (g) { return '<button type="button" data-g="' + g.id + '" aria-pressed="' + (g.id === T.gorev) + '">' + (T.gdone[g.id] != null ? '<span class="pill ' + (T.gdone[g.id] >= 80 ? 'ok' : 'warn') + ' done">%' + T.gdone[g.id] + '</span>' : '') + '<b>' + X(g.t) + '</b><small>' + X(g.d) + '</small></button>'; }).join('');
  };
  $('#gorev-l').addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]'); if (!b) return; var id = b.getAttribute('data-g');
    T.gorev = T.gorev === id ? null : id; ls.set('gorev', T.gorev);
    if (T.gorev) { T.prof = 'gorev'; ls.set('prof', 'gorev'); var g = gorevOf(id); if (g.ogun === 'kahvalti') { T.ogun = 'kahvalti'; ls.set('ogun', 'kahvalti'); } }
    else if (T.prof === 'gorev') { T.prof = 'kadin'; ls.set('prof', 'kadin'); }
    $('#g-karne').innerHTML = ''; paintTabak(); bridgeSend();
  });
  var IPUCU = { kcal: 'Porsiyonları terazide ayarla; yağ ve şeker küçük miktarda çok enerji katar.', lif: 'Tam tahıllı ekmek, bulgur, kuru baklagil, sebze ve meyve lifi artırır.', na: 'Peynir, zeytin, kraker ve tuz sodyumun büyük kısmını getirir; tarif tuzunu azalt.', k: 'Sebze, meyve (muz, kayısı), kuru baklagil, yoğurt ve patates potasyumdan zengindir.', ca: 'Süt, yoğurt, peynir ve tahin kalsiyum kaynağıdır.', fe: 'Kırmızı et, kuru baklagil, ıspanak ve kuru kayısı; yanına C vitamini (domates, biber, portakal) emilimi artırır.', c: 'Biber, portakal, çilek, brokoli ve domates C vitamini getirir.', fol: 'Kuru baklagil, ıspanak, brokoli ve portakal folattan zengindir.', pro: 'Yumurta, süt ürünleri, et, tavuk, balık ve baklagil protein kaynağıdır.', '%kh': 'Tahıl ve meyve oranını dengele.', '%yag': 'Yağ ekleme miktarını ve yağlı peyniri gözden geçir.', '%pro': 'Protein kaynaklarının porsiyonunu ayarla.', '%sat': 'Tereyağı, kaşar ve yağlı et yerine zeytinyağı, az yağlı süt ürünü ve balık seç.', '!g': 'Ekmek, bulgur, makarna, bisküvi ve kraker gluten içerir; pirinç, patates ve mısır glutensizdir.' };
  $('#g-eval').onclick = function () {
    var g = gorevOf(T.gorev); if (!g) { toast('Önce bir görev seç.'); return; }
    var items = g.ogun === 'kahvalti' ? T.menu.kahvalti : ogunItems('gun');
    if (!items.length) { toast(g.ogun === 'kahvalti' ? 'Kahvaltı öğünü boş.' : 'Menü boş: öğünlere besin koy.'); return; }
    var s = M.analiz(items), r = M.gorevPuan(g, s, items), col = r.puan >= 80 ? 'var(--ok)' : r.puan >= 50 ? 'var(--warn)' : 'var(--bad)';
    T.gdone[g.id] = r.puan; ls.set('gdone', T.gdone); paintGorev();
    var gl = items.filter(function (it) { var b = M.DB.by[it.id]; return b && b.b && /[gy]/.test(b.b); }).map(function (it) { return M.DB.by[it.id].ad; });
    $('#g-karne').innerHTML = '<div class="karne"><div class="stamp" style="color:' + col + '"><b>' + r.puan + '</b><small>PUAN</small></div><h3>' + X(g.t) + '</h3><ul>' + r.rows.map(function (x) {
      var v = x.k === '!g' ? (x.v ? x.v + ' besin (' + X(gl.join(', ')) + ')' : 'yok') : tr(x.v, x.k.charAt(0) === '%' || x.k === 'fe' ? 1 : 0);
      var lim = x.k === '!g' ? '' : ' · hedef ' + (x.min != null ? '≥' + x.min : '') + (x.min != null && x.max != null ? ' ve ' : '') + (x.max != null ? '≤' + x.max : '');
      return '<li class="' + (x.ok ? 'ok' : 'no') + '"><b>' + X(x.t) + ':</b> ' + v + lim + (x.ok ? '' : '<br><span style="color:var(--muted)">' + X(IPUCU[x.k] || '') + '</span>') + '</li>';
    }).join('') + '</ul></div>';
    bridgeSend();
  };

  var paintTabak = function () { paintOgun(); paintPlate(); paintTable(); paintProf(); paintPano(); paintGorev(); paintScale(); };

  /* =========================== MedLab köprüsü =========================== */
  /* Anatomi/Fizyo/Odyoloji ile aynı protokol (js/acadex-medlab-acadia.js) */
  var EMB = W.parent !== W && /(?:\?|&)medlab=1(?:&|$)/.test(location.search), ORG = location.origin;
  var post = function (m) { if (!EMB) return; m.src = 'axlab'; m.lab = 'diyet'; try { W.parent.postMessage(m, ORG); } catch (e) {} };
  var top = function (items, k, n) {
    return items.map(function (it) { var b = M.DB.by[it.id]; return { ad: b ? b.ad : it.id, v: b ? (b.n[k] || 0) * it.g / 100 : 0 }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, n || 3).filter(function (x) { return x.v > 0; });
  };
  var ctx = function () {
    var o = { type: 'ctx', mode: tab, spot: false, sel: null, chips: [] };
    if (tab === 'tabak') {
      var items = ogunItems(T.ogun), s = M.analiz(items), t = target();
      o.sel = { key: 'tabak.' + T.ogun, title: 'Tabak · ' + ON[T.ogun], la: 'Menü analizi', rows: [['Hedef', t.d], ['Enerji', Math.round(s.kcal) + ' kcal'], ['Dağılım', 'KH %' + Math.round(s.e.kh) + ', protein %' + Math.round(s.e.pro) + ', yağ %' + Math.round(s.e.yag)], ['Lif / sodyum', tr(s.lif, 1) + ' g / ' + Math.round(s.na) + ' mg'], ['Besinler', items.slice(0, 14).map(function (it) { var b = M.DB.by[it.id]; return (b ? b.ad : it.id) + ' ' + it.g + ' g'; }).join(', ') || 'boş']],
        about: 'öğrenci Diyet Lab\'de ' + (T.ogun === 'gun' ? 'günlük menü' : ON[T.ogun].toLocaleLowerCase('tr') + ' öğünü') + ' planlıyor' + (T.gorev ? ' (görev: ' + gorevOf(T.gorev).t + ')' : '') + '. Hazır menü yazma; menüsünü hedefe göre değerlendir ve neyi değiştirebileceğini sor.' };
      o.chips = [['menu', 'Bu menüyü nasıl dengelerim?'], ['lif', 'Lifi nasıl artırırım?'], ['na', 'Sodyum en çok nereden geliyor?']];
    } else if (DL.klinik && DL.klinik.ctx) { var k = DL.klinik.ctx(tab); if (k) { o.sel = k.sel; o.chips = k.chips || []; } }
    return o;
  };
  var bridgeSend = DL.bridgeSend = function () { if (!EMB) return; clearTimeout(bridgeSend.t); bridgeSend.t = setTimeout(function () { post(ctx()); }, 40); };
  var answer = function (kind) {
    if (tab === 'tabak') {
      var items = ogunItems(T.ogun), s = M.analiz(items), H = M.hedef(target());
      if (!items.length && /menu|lif|na/.test(kind)) return 'Tabak şu an boş. Kilerden besin seçip terazide tartınca enerji ve besin ögesi halkaları dolmaya başlar; sonra birlikte değerlendirelim.';
      if (kind === 'lif') { var tl = top(items, 'lif'); return 'Şu an lif ' + tr(s.lif, 1) + ' g (günlük hedef en az 25 g). ' + (tl.length ? 'En çok katkı: ' + tl.map(function (x) { return x.ad + ' ' + tr(x.v, 1) + ' g'; }).join(', ') + '. ' : '') + 'Beyaz ekmek yerine tam buğday ya da çavdar, pirinç yerine bulgur, bir öğüne kuru baklagil ve her öğüne sebze ya da meyve eklemek lifi hızla artırır.'; }
      if (kind === 'na') { var tn = top(items, 'na'); return 'Sodyum ' + Math.round(s.na) + ' mg (tuz eşdeğeri ' + tr(s.tuz, 1) + ' g); WHO üst sınırı 2000 mg. ' + (tn.length ? 'En çok katkı: ' + tn.map(function (x) { return x.ad + ' ' + Math.round(x.v) + ' mg'; }).join(', ') + '. ' : '') + 'Peynir ve zeytini azaltmak, tuzsuz pişirip baharat kullanmak en etkili adımlardır.'; }
      if (kind === 'menu') {
        var tips = [];
        if (T.ogun === 'gun') { if (s.kcal < H.kcal.min) tips.push('enerji hedefin altında (' + Math.round(s.kcal) + ' / ' + Math.round(H.kcal.min) + '–' + Math.round(H.kcal.max) + ' kcal)'); if (s.kcal > H.kcal.max) tips.push('enerji hedefin üstünde'); }
        if (s.kcal && s.e.yag > 35) tips.push('yağ enerjinin %' + Math.round(s.e.yag) + '\'i (üst sınır %35): eklenen yağı ve yağlı peyniri azalt');
        if (s.kcal && s.e.kh < 45) tips.push('KH oranı düşük (%' + Math.round(s.e.kh) + '): tam tahıl ve meyve ekle');
        if (s.kcal && s.e.kh > 60) tips.push('KH oranı yüksek (%' + Math.round(s.e.kh) + '): protein kaynağı ekle, şekerli besinleri azalt');
        if (s.kcal && s.e.sat > 10) tips.push('doymuş yağ enerjinin %' + Math.round(s.e.sat) + '\'i (üst sınır %10)');
        if (s.na > 2000) tips.push('sodyum ' + Math.round(s.na) + ' mg (üst sınır 2000)');
        if (T.ogun === 'gun' && s.lif < 25) tips.push('lif ' + tr(s.lif, 1) + ' g (en az 25 g)');
        if (T.ogun === 'gun' && s.ca < H.ca.min) tips.push('kalsiyum ' + Math.round(s.ca) + ' mg (en az ' + H.ca.min + ')');
        return tips.length ? 'Gördüklerim: ' + tips.join('; ') + '. Hangisinden başlamak istersin?' : 'Bu ' + (T.ogun === 'gun' ? 'günlük menü' : 'öğün') + ' hedeflerle uyumlu görünüyor. Bir görev seçip değerlendirmeyle sınayabilirsin.';
      }
    }
    if (DL.klinik && DL.klinik.answer) return DL.klinik.answer(kind, tab);
    return null;
  };
  var classify = function (q) {
    q = q.toLocaleLowerCase('tr');
    if (tab === 'tabak') { if (/\blif|posa/.test(q)) return 'lif'; if (/sodyum|tuz/.test(q)) return 'na'; if (/menü|menu|denge|öğün/.test(q)) return 'menu'; }
    if (DL.klinik && DL.klinik.classify) return DL.klinik.classify(q, tab);
    return null;
  };
  if (EMB) {
    D.documentElement.classList.add('axm-embed');
    W.addEventListener('message', function (e) {
      if (e.origin !== ORG || e.source !== W.parent) return;
      var d = e.data; if (!d || d.src !== 'axhost') return;
      if (d.type === 'hello') { bridgeSend(); return; }
      if (d.type !== 'ask') return;
      var kind = d.kind || classify(String(d.q || '')), text = kind ? answer(kind) : null;
      if (!text) { post({ type: 'reply', id: d.id, miss: true }); return; }
      post({ type: 'ack', id: d.id }); post({ type: 'reply', id: d.id, text: text });
    });
  }
  DL.core.answer = answer; DL.core.classify = classify;

  /* ---------------- başlat ---------------- */
  paintList(); paintTabak();
  var t0 = new URLSearchParams(location.search).get('tab') || ls.get('tab', 'tabak');
  DL.core.startTab = t0;
  setTab(t0);
})();
