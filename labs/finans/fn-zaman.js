/* ==========================================================================
   ACADEX FİNANS · PARANIN ZAMAN DEĞERİ (labs/finans/fn-zaman.js), 29.10.2026
   1) Bileşik faiz: basit ↔ bileşik, sıklık, efektif faiz, 72 kuralı
   2) Nakit akışı: akışlar "bugüne iner" (iskonto animasyonu), NBD, İVO, NBD profili
   3) Kredi ödeme planı: eşit taksit (anüite) ↔ eşit anapara
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, tl = C.tl, pct = C.pct, num = C.num;
  var S = C.ls.get('zm', null) || { P: 10000, r: 30, y: 8, m: 1, cf: [-1000, 300, 350, 400, 300, 200], d: 15, L: 100000, lr: 3.2, n: 12, yon: 'anuite' };
  var save = function () { C.ls.set('zm', S); };
  var M = [[1, 'yıllık'], [2, '6 ayda bir'], [4, '3 ayda bir'], [12, 'aylık'], [0, 'sürekli']];

  /* ---------- hesaplar (test de bunları okur) ---------- */
  var fv = function (P, r, y, m) { return m === 0 ? P * Math.exp(r * y) : P * Math.pow(1 + r / m, m * y); };
  var eff = function (r, m) { return m === 0 ? Math.exp(r) - 1 : Math.pow(1 + r / m, m) - 1; };
  var npv = function (r, cf) { return cf.reduce(function (a, c, t) { return a + c / Math.pow(1 + r, t); }, 0); };
  var irr = function (cf) {
    var lo = -0.99, hi = 10, f = function (r) { return npv(r, cf); }, flo = f(lo), fhi = f(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (var i = 0; i < 200; i++) { var mid = (lo + hi) / 2, fm = f(mid); if (Math.abs(fm) < 1e-9) return mid; if (fm * flo > 0) { lo = mid; flo = fm; } else hi = mid; }
    return (lo + hi) / 2;
  };
  var plan = function (L, i, n, yon) {
    var rows = [], bal = L, k;
    if (yon === 'anuite') {
      var A = i === 0 ? L / n : L * i / (1 - Math.pow(1 + i, -n));
      for (k = 1; k <= n; k++) { var f = bal * i, a = A - f; bal -= a; rows.push([k, A, f, a, Math.max(0, bal)]); }
    } else {
      var ap = L / n;
      for (k = 1; k <= n; k++) { var f2 = bal * i; bal -= ap; rows.push([k, ap + f2, f2, ap, Math.max(0, bal)]); }
    }
    return rows;
  };
  FN.zaman = { fv: fv, eff: eff, npv: npv, irr: irr, plan: plan };

  var sec;
  var html = function () {
    return '<div class="grid">' +
      /* ---- bileşik faiz ---- */
      '<div class="card box" style="--cc:var(--blue)"><span class="k">istasyon 1 · faiz rıhtımı</span><h2>Basit faiz mi, bileşik faiz mi?</h2><p class="sub">Faizin faizi zamanla katlanır. Sıklığı değiştir, konteyner istifinin nasıl büyüdüğüne bak.</p>' +
      '<div class="grid gside"><div><div class="fl">' +
      '<label class="fld">Anapara (TL)<input type="text" inputmode="decimal" data-z="P" value="' + nf(S.P) + '"></label>' +
      '<label class="fld">Yıllık faiz (%)<input type="text" inputmode="decimal" data-z="r" value="' + nf(S.r, 1) + '"></label>' +
      '<label class="fld">Süre (yıl)<input type="range" min="1" max="20" data-z="y" value="' + S.y + '"><small data-o="y"></small></label>' +
      '<label class="fld">Bileşik sıklığı<select data-z="m">' + M.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === S.m ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '</div><div class="kpis" data-k="bf"></div><div class="formula" data-f="bf"></div></div>' +
      '<div><div data-c="bf"></div><div class="leg"><span><i style="background:#2F6FB0"></i>anapara</span><span><i style="background:#E0A526"></i>bileşik faiz birikimi</span><span><i style="background:#C8553D;height:3px"></i>basit faizle değer</span></div><div data-tip="bf"></div></div></div></div>' +
      /* ---- nakit akışı ---- */
      '<div class="card box" style="--cc:var(--sea)"><span class="k">istasyon 2 · yatırım kararı</span><h2>Gelecekteki parayı bugüne indir: NBD ve İVO</h2><p class="sub">Yeni bir vinç yatırımı: bugün para çıkar, sonraki yıllarda nakit girer. İskonto oranı, gelecekteki her liranın bugün kaç lira ettiğini söyler.</p>' +
      '<div class="cfs" data-cfs></div>' +
      '<div class="row" style="margin-top:12px"><label class="fld" style="flex:1;min-width:220px">İskonto oranı (sermaye maliyeti): <b data-o="d"></b><input type="range" min="0" max="40" step="0.5" data-z="d" value="' + S.d + '"></label><button type="button" class="btn deep" data-pv>Bugüne indir</button><button type="button" class="btn sm" data-pv0>Sıfırla</button></div>' +
      '<div class="tl" data-tl></div><div class="kpis" data-k="np"></div>' +
      '<div class="grid g2"><div><h3>NBD profili</h3><div data-c="np"></div></div><div><div class="formula" data-f="np"></div><div data-tip="np"></div></div></div></div>' +
      /* ---- kredi ---- */
      '<div class="card box" style="--cc:var(--must)"><span class="k">istasyon 3 · kredi masası</span><h2>Kredi ödeme planı</h2><p class="sub">Aynı kredi, iki ödeme yöntemi. Taksitin içinde faiz ve anaparanın payı ay ay nasıl değişiyor?</p>' +
      '<div class="grid gside"><div><div class="fl">' +
      '<label class="fld">Kredi tutarı (TL)<input type="text" inputmode="decimal" data-z="L" value="' + nf(S.L) + '"></label>' +
      '<label class="fld">Aylık faiz (%)<input type="text" inputmode="decimal" data-z="lr" value="' + nf(S.lr, 2) + '"></label>' +
      '<label class="fld">Vade (ay)<input type="range" min="3" max="60" data-z="n" value="' + S.n + '"><small data-o="n"></small></label>' +
      '<div class="fld">Yöntem<div class="seg" data-yon><button type="button" data-v="anuite">Eşit taksit</button><button type="button" data-v="esit">Eşit anapara</button></div></div>' +
      '</div><div class="kpis" data-k="kr"></div><p class="sub" style="margin:0">Türkiye’de bireysel kredilerde faize ayrıca KKDF ve BSMV eklenir; burada yok sayıldı.</p></div>' +
      '<div><div data-c="kr"></div><div class="leg"><span><i style="background:#2F6FB0"></i>anapara payı</span><span><i style="background:#E0A526"></i>faiz payı</span></div><div class="tbl-w" style="max-height:260px;margin-top:10px" data-t="kr"></div></div></div></div>' +
      '</div>';
  };

  /* ---------- 1) bileşik faiz ---------- */
  var paintBF = function () {
    var P = S.P, r = S.r / 100, y = S.y, m = S.m;
    $('[data-o="y"]', sec).textContent = y + ' yıl';
    var bars = [], line = [[0, P]], i;
    for (i = 0; i <= y; i++) {
      var v = fv(P, r, i, m);
      bars.push({ x: i, y0: 0, y1: P, c: '#2F6FB0', lab: i + '. yıl anapara ' + tl(P) });
      if (v > P) bars.push({ x: i, y0: P, y1: v, c: '#E0A526', lab: i + '. yıl değer ' + tl(v) });
      if (i) line.push([i, P * (1 + r * i)]);
    }
    var F = fv(P, r, y, m), simp = P * (1 + r * y), e = eff(r, m), dbl = Math.log(2) / Math.log(1 + e);
    $('[data-c="bf"]', sec).innerHTML = C.chart({ w: 640, h: 290, x: [-0.6, y + 0.6], y0: true, bars: bars, nb: y + 1, s: [{ p: line, c: '#C8553D', w: 2.6 }], xticks: Array.apply(null, Array(y + 1)).map(function (_, k) { return k; }).filter(function (k) { return y <= 10 || k % 2 === 0; }), yf: function (v) { return v >= 1e6 ? nf(v / 1e6, 1) + ' mn' : v >= 1e3 ? nf(v / 1e3) + ' bin' : nf(v); }, xl: 'yıl', al: 'bileşik faizle değer, yıllara göre' });
    $('[data-k="bf"]', sec).innerHTML =
      '<div class="kpi"><small>basit faizle</small><b>' + tl(simp) + '</b></div>' +
      '<div class="kpi hl"><small>bileşik faizle</small><b>' + tl(F) + '</b></div>' +
      '<div class="kpi"><small>efektif yıllık faiz</small><b>' + pct(e, 2) + '</b></div>' +
      '<div class="kpi"><small>ikiye katlanma</small><b>' + nf(dbl, 1) + ' yıl</b></div>';
    $('[data-f="bf"]', sec).innerHTML = (m === 0 ? 'GD = P · e<sup>r·n</sup> = ' + nf(P) + ' · e<sup>' + nf(r, 3) + '·' + y + '</sup>' : 'GD = P · (1 + r/m)<sup>m·n</sup> = ' + nf(P) + ' · (1 + ' + nf(r, 3) + '/' + m + ')<sup>' + (m * y) + '</sup>') + ' = <b>' + tl(F) + '</b><br>Efektif faiz = ' + (m === 0 ? 'e<sup>r</sup> − 1' : '(1 + r/m)<sup>m</sup> − 1') + ' = <b>' + pct(e, 2) + '</b>';
    $('[data-tip="bf"]', sec).innerHTML = C.tip('72 kuralı: 72 ÷ ' + nf(S.r, 1) + ' ≈ <b>' + nf(72 / Math.max(0.1, S.r), 1) + ' yıl</b>. Gerçek ikiye katlanma ' + nf(dbl, 1) + ' yıl. Kural düşük faizde çok iyi tutar, faiz yükseldikçe sapar. Bileşik faiz ' + y + ' yılda basit faizden <b>' + tl(F - simp) + '</b> fazla getiriyor.', '×2');
  };

  /* ---------- 2) nakit akışı ---------- */
  var tlX = function (t) { return 70 + t * 120; };
  var paintCF = function () {
    var cf = S.cf, r = S.d / 100, max = Math.max.apply(null, cf.map(Math.abs)) || 1, base = 150, sc = 100 / max;
    $('[data-o="d"]', sec).textContent = '%' + nf(S.d, 1);
    var g = '<svg viewBox="0 0 760 260" role="img" aria-label="nakit akışı zaman çizelgesi"><line x1="40" x2="740" y1="' + base + '" y2="' + base + '" stroke="#0D1838" stroke-width="2"/>';
    cf.forEach(function (c, t) {
      var x = tlX(t), h = Math.abs(c) * sc;
      g += '<line x1="' + x + '" x2="' + x + '" y1="' + (base - 4) + '" y2="' + (base + 4) + '" stroke="#0D1838" stroke-width="2"/><text x="' + x + '" y="' + (base + 92) + '" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="12" fill="#6A7593">' + (t === 0 ? 'bugün' : t + '. yıl') + '</text>';
      if (c < 0) g += '<rect x="' + (x - 22) + '" y="' + base + '" width="44" height="' + h + '" fill="#C8553D" rx="2"/><text x="' + x + '" y="' + (base + h + 14 > base + 78 ? base + 78 : base + h + 14) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#C8553D">' + nf(c) + '</text>';
      else if (c > 0) g += '<rect class="ghost" x="' + (x - 22) + '" y="' + (base - h) + '" width="44" height="' + h + '" fill="#2F6FB0" opacity=".18" rx="2"/><rect class="coin" data-t="' + t + '" x="' + (x - 22) + '" y="' + (base - h) + '" width="44" height="' + h + '" fill="#2F6FB0" rx="2" style="transform-box:fill-box;transform-origin:50% 100%"/><text x="' + x + '" y="' + (base - h - 6) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#2F6FB0">' + nf(c) + '</text><text class="pvt" data-t="' + t + '" x="' + x + '" y="' + (base + 20) + '" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#1F8A7A" opacity="0">BD ' + nf(c / Math.pow(1 + r, t)) + '</text>';
    });
    g += '<g class="npvlab" opacity="0"><text x="' + (tlX(0) + 32) + '" y="30" font-size="13" font-weight="800" fill="#0D1838" data-nl></text></g></svg>';
    $('[data-tl]', sec).innerHTML = g;
    var N = npv(r, cf), I = irr(cf), cum = 0, pb = null;
    cf.forEach(function (c, t) { var p = cum; cum += c; if (pb == null && t > 0 && cum >= 0 && p < 0) pb = t - 1 + (-p / c); });
    $('[data-k="np"]', sec).innerHTML =
      '<div class="kpi hl"><small>net bugünkü değer</small><b data-roll="npv">' + tl(N) + '</b></div>' +
      '<div class="kpi"><small>iç verim oranı</small><b>' + (I == null ? 'yok' : pct(I, 2)) + '</b></div>' +
      '<div class="kpi"><small>karar (NBD kuralı)</small><b style="color:' + (N >= 0 ? 'var(--ok)' : 'var(--bad)') + '">' + (N >= 0 ? 'kabul' : 'ret') + '</b></div>' +
      '<div class="kpi"><small>basit geri ödeme</small><b>' + (pb == null ? 'dönmüyor' : nf(pb, 1) + ' yıl') + '</b></div>';
    /* NBD profili */
    var pts = [], k; for (k = 0; k <= 60; k++) { var rr = k / 100; pts.push([k, npv(rr, cf)]); }
    $('[data-c="np"]', sec).innerHTML = C.chart({ w: 520, h: 250, x: [0, 60], s: [{ p: pts, c: '#1E5B8C', w: 2.8 }], dots: [{ x: S.d, y: N, c: '#E0A526', r: 6, cls: 'me', lab: 'şu anki oran' }], vl: I != null && I * 100 <= 60 && I > 0 ? [{ x: I * 100, c: '#1F8A7A', lab: 'İVO ' + pct(I, 1) }] : [], hl: [], xf: function (v) { return '%' + nf(v); }, yf: function (v) { return nf(v); }, xl: 'iskonto oranı', al: 'NBD profili' });
    $('[data-f="np"]', sec).innerHTML = 'NBD = Σ CF<sub>t</sub> / (1 + r)<sup>t</sup><br>' + cf.map(function (c, t) { return (t ? (c < 0 ? ' − ' : ' + ') : '') + nf(Math.abs(c)) + (t ? '/' + nf(1 + r, 3) + (t > 1 ? '<sup>' + t + '</sup>' : '') : ''); }).join('') + ' = <b>' + nf(N, 1) + '</b>';
    $('[data-tip="np"]', sec).innerHTML = C.tip(I == null ? 'Bu akışların iç verim oranı yok (işaret hiç değişmiyor). NBD kuralına göre karar ver.' : 'İVO, NBD’yi sıfırlayan orandır: eğrinin yatay ekseni kestiği yer. İskonto oranı (%' + nf(S.d, 1) + ') İVO’nun ' + (S.d < I * 100 ? 'altında, yatırım para kazandırıyor.' : 'üstünde, yatırım sermaye maliyetini karşılamıyor.'), pct(I || 0, 0));
    lowered = false;
  };
  var lowered = false;
  var lower = function (on) {
    var cf = S.cf, r = S.d / 100, max = Math.max.apply(null, cf.map(Math.abs)) || 1, sc = 100 / max, cum = 0;
    $$('.coin', sec).forEach(function (el) {
      var t = +el.getAttribute('data-t'), c = cf[t], pv = c / Math.pow(1 + r, t), h = c * sc;
      el.style.transition = C.RM ? 'none' : 'transform 1.1s cubic-bezier(.5,0,.25,1) ' + (t * 0.12) + 's, fill .6s';
      if (on) { el.style.transform = 'translate(' + (tlX(0) - tlX(t)) + 'px,' + (-cum) + 'px) scaleY(' + (pv / c).toFixed(4) + ')'; el.style.fill = '#1F8A7A'; cum += pv * sc; }
      else { el.style.transform = ''; el.style.fill = ''; }
      void h;
    });
    $$('.pvt', sec).forEach(function (el) { el.style.transition = 'opacity .5s ' + (on ? '1s' : '0s'); el.setAttribute('opacity', on ? '1' : '0'); });
    var nl = $('[data-nl]', sec), g = $('.npvlab', sec);
    if (nl) { var N = npv(r, cf); nl.textContent = 'bugüne inen girişler ' + nf(N - cf[0]) + ' · yatırım ' + nf(-cf[0]) + ' → NBD ' + nf(N); g.style.transition = 'opacity .5s ' + (on ? '1.3s' : '0s'); g.setAttribute('opacity', on ? '1' : '0'); }
    lowered = on;
    if (on) C.live('Nakit girişleri bugüne indirildi. NBD ' + nf(npv(r, cf)));
  };
  var paintCFInputs = function () {
    $('[data-cfs]', sec).innerHTML = S.cf.map(function (c, t) { return '<label>' + (t === 0 ? 'Bugün (yatırım)' : t + '. yıl') + '<input type="text" inputmode="decimal" data-cf="' + t + '" value="' + nf(c) + '"></label>'; }).join('');
  };

  /* ---------- 3) kredi ---------- */
  var paintKR = function () {
    $('[data-o="n"]', sec).textContent = S.n + ' ay';
    $$('[data-yon] button', sec).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === S.yon)); });
    var rows = plan(S.L, S.lr / 100, S.n, S.yon), tf = rows.reduce(function (a, r) { return a + r[2]; }, 0);
    var other = plan(S.L, S.lr / 100, S.n, S.yon === 'anuite' ? 'esit' : 'anuite'), tf2 = other.reduce(function (a, r) { return a + r[2]; }, 0);
    var bars = [];
    rows.forEach(function (r) { bars.push({ x: r[0], y0: 0, y1: r[3], c: '#2F6FB0', lab: r[0] + '. ay anapara ' + tl(r[3]) }); bars.push({ x: r[0], y0: r[3], y1: r[1], c: '#E0A526', lab: r[0] + '. ay faiz ' + tl(r[2]) }); });
    $('[data-c="kr"]', sec).innerHTML = C.chart({ w: 640, h: 240, x: [0.4, S.n + 0.6], y0: true, bars: bars, nb: S.n, xt: Math.min(S.n, 12), xf: function (v) { return Math.round(v) === v ? nf(v) : ''; }, yf: function (v) { return v >= 1e3 ? nf(v / 1e3, v % 1000 ? 1 : 0) + ' bin' : nf(v); }, xl: 'ay', al: 'taksitlerin anapara ve faiz payı' });
    $('[data-k="kr"]', sec).innerHTML =
      '<div class="kpi hl"><small>' + (S.yon === 'anuite' ? 'aylık taksit' : 'ilk / son taksit') + '</small><b>' + (S.yon === 'anuite' ? tl(rows[0][1]) : nf(rows[0][1]) + ' / ' + nf(rows[rows.length - 1][1])) + '</b></div>' +
      '<div class="kpi"><small>toplam faiz</small><b>' + tl(tf) + '</b></div>' +
      '<div class="kpi"><small>öbür yöntemde faiz</small><b>' + tl(tf2) + '</b></div>';
    $('[data-t="kr"]', sec).innerHTML = '<table class="t"><thead><tr><th>Ay</th><th class="n">Taksit</th><th class="n">Faiz</th><th class="n">Anapara</th><th class="n">Kalan</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="n">' + nf(r[1], 2) + '</td><td class="n">' + nf(r[2], 2) + '</td><td class="n">' + nf(r[3], 2) + '</td><td class="n">' + nf(r[4], 2) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>Toplam</td><td class="n">' + nf(tf + S.L, 2) + '</td><td class="n">' + nf(tf, 2) + '</td><td class="n">' + nf(S.L, 2) + '</td><td></td></tr></tfoot></table>';
  };

  var paintAll = function () { paintBF(); paintCF(); paintKR(); };
  FN.st.zaman = {
    init: function () {
      sec = $('#zaman'); sec.innerHTML = html(); paintCFInputs(); paintAll();
      sec.addEventListener('input', function (e) {
        var t = e.target, k = t.getAttribute('data-z');
        if (k) {
          var v = t.type === 'range' || t.tagName === 'SELECT' ? Number(t.value) : num(t.value);
          if (!isFinite(v)) return;
          if (k === 'P' || k === 'L') v = C.clamp(v, 0, 1e12); if (k === 'r') v = C.clamp(v, 0, 500); if (k === 'lr') v = C.clamp(v, 0, 50);
          S[k] = v; save();
          if (/^(P|r|y|m)$/.test(k)) paintBF(); else if (k === 'd') paintCF(); else paintKR();
          FN.bridgeSend(); return;
        }
        if (t.hasAttribute('data-cf')) { var c = num(t.value); if (!isFinite(c)) return; S.cf[+t.getAttribute('data-cf')] = c; save(); paintCF(); FN.bridgeSend(); }
      });
      sec.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') { S.m = Number(e.target.value); save(); paintBF(); FN.bridgeSend(); } });
      sec.addEventListener('click', function (e) {
        if (e.target.closest('[data-pv]')) { if (lowered) { lower(false); setTimeout(function () { lower(true); }, 450); } else lower(true); return; }
        if (e.target.closest('[data-pv0]')) { lower(false); return; }
        var y = e.target.closest('[data-yon] button'); if (y) { S.yon = y.getAttribute('data-v'); save(); paintKR(); FN.bridgeSend(); }
      });
    },
    ctx: function () {
      var r = S.d / 100, N = npv(r, S.cf), I = irr(S.cf), rows = plan(S.L, S.lr / 100, S.n, S.yon);
      return { sel: { key: 'finans.zaman', title: 'NBD ' + nf(N) + (I != null ? ' · İVO ' + pct(I, 1) : ''), la: 'Paranın zaman değeri',
          rows: [['Bileşik faiz', nf(S.P) + ' TL, yıllık %' + nf(S.r, 1) + ', ' + S.y + ' yıl, ' + (M.filter(function (m) { return m[0] === S.m; })[0] || M[0])[1] + ' → ' + tl(fv(S.P, S.r / 100, S.y, S.m))],
            ['Nakit akışı', S.cf.map(function (c) { return nf(c); }).join(', ') + ' · iskonto %' + nf(S.d, 1)], ['NBD / İVO', nf(N, 1) + ' / ' + (I == null ? 'yok' : pct(I, 2))],
            ['Kredi', tl(S.L) + ', aylık %' + nf(S.lr, 2) + ', ' + S.n + ' ay, ' + (S.yon === 'anuite' ? 'eşit taksit ' + tl(rows[0][1], 2) : 'eşit anapara')]],
          about: 'öğrenci Acadex Finans\'ta paranın zaman değeri istasyonunda bileşik faiz, NBD/İVO ve kredi ödeme planı hesaplıyor.' },
        chips: [['nbdivo', 'NBD ile İVO çelişirse hangisine güvenirim?'], ['efektif', 'Nominal ve efektif faiz farkı ne?'], ['anuite', 'Eşit taksitte faiz neden başta yüksek?']] };
    },
    classify: function (q) { if (/ivo|i̇vo|iç verim|nbd/.test(q)) return 'nbdivo'; if (/efektif|nominal/.test(q)) return 'efektif'; if (/taksit|anüite|anuite|kredi/.test(q)) return 'anuite'; return null; },
    answer: function (k) {
      var I = irr(S.cf), N = npv(S.d / 100, S.cf);
      if (k === 'nbdivo') return 'NBD, yatırımın bugün sana kaç lira kazandırdığını söyler (şu an ' + tl(N) + '). İVO ise yatırımın kendi getiri oranıdır (' + (I == null ? 'bu akışta yok' : pct(I, 2)) + '). Tek ve bağımsız bir projede ikisi aynı kararı verir. Birbirini dışlayan projelerde, büyüklükleri ya da akış zamanlamaları farklıysa çelişebilirler; o zaman NBD’ye güvenilir, çünkü servete katkıyı doğrudan ölçer. İşareti birden çok kez değişen akışlarda birden fazla İVO çıkabilir.';
      if (k === 'efektif') return 'Nominal yıllık %' + nf(S.r, 1) + ' faiz yılda ' + (S.m || 'sonsuz') + ' kez işlerse efektif faiz ' + pct(eff(S.r / 100, S.m), 2) + ' olur. Fark, dönem içinde eklenen faizin de faiz kazanmasından gelir. Sıklık arttıkça efektif faiz yükselir ama bir sınıra yaklaşır: sürekli bileşikte e^r − 1.';
      if (k === 'anuite') { var rows = plan(S.L, S.lr / 100, S.n, 'anuite'); return 'Faiz her ay kalan borç üzerinden işler. Başta borç en yüksek olduğu için ilk taksitin ' + tl(rows[0][2], 2) + '’si faizdir; borç azaldıkça faiz payı düşer, sabit taksitin anapara payı büyür. Son ayda faiz yalnızca ' + tl(rows[rows.length - 1][2], 2) + '. Eşit anaparada ise anapara sabit, taksit azalarak gider ve toplam faiz daha düşüktür.'; }
      return null;
    }
  };
})();
