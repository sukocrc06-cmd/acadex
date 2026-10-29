/* ==========================================================================
   ACADEX FİNANS · TÜREV ÜRÜNLER (labs/finans/fn-turev.js), 29.10.2026
   1) Opsiyon stratejileri: hazır stratejiler ya da kendi bacakların;
      vade sonu kâr-zarar grafiği, başabaş noktaları, en çok kâr/zarar
   2) Black–Scholes: alım/satım değeri, Yunanlar (delta, gama, vega, teta),
      alım-satım paritesi denetimi; değer eğrisi vadeye yaklaştıkça kırılır
   Fiyatlar kurgusal (dayanak varlık 100 TL civarı).
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, pct = C.pct, num = C.num;
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var S = C.ls.get('tv', null) || { st: 'lcall', bac: clone(V.STRAT[0].bac), bs: { S: 100, K: 100, T: 90, r: 30, v: 35 } };
  var save = function () { C.ls.set('tv', S); };
  var sec;

  /* ---------- hesaplar ---------- */
  var leg = function (b, s) { var v = b.t === 'call' ? Math.max(s - b.K, 0) - b.p : b.t === 'put' ? Math.max(b.K - s, 0) - b.p : s - b.p; return b.y * b.n * v; };
  var pay = function (bac, s) { return bac.reduce(function (a, b) { return a + leg(b, s); }, 0); };
  var range = function (bac) { var ks = bac.map(function (b) { return b.t === 'hisse' ? b.p : b.K; }), m = ks.reduce(function (a, k) { return a + k; }, 0) / (ks.length || 1); return [Math.max(0, Math.min.apply(null, ks) - m * 0.35), Math.max.apply(null, ks) + m * 0.35]; };
  var info = function (bac) {
    var rg = range(bac), lo = 0, hi = rg[1] * 1.5, N = 1200, mx = -Infinity, mn = Infinity, be = [], prev = null, i;
    for (i = 0; i <= N; i++) { var s = lo + (hi - lo) * i / N, v = pay(bac, s); if (v > mx) mx = v; if (v < mn) mn = v; if (prev != null && (prev[1] < 0) !== (v < 0) && Math.abs(v - prev[1]) > 1e-12) be.push(prev[0] + (s - prev[0]) * (-prev[1]) / (v - prev[1])); prev = [s, v]; }
    var slope = bac.reduce(function (a, b) { return a + (b.t === 'put' ? 0 : b.y * b.n); }, 0);
    return { max: slope > 1e-9 ? Infinity : mx, min: slope < -1e-9 ? -Infinity : mn, be: be, net: bac.reduce(function (a, b) { return a + (b.t === 'hisse' ? 0 : -b.y * b.n * b.p); }, 0) };
  };
  var ncdf = function (x) { var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804 * Math.exp(-x * x / 2), p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x > 0 ? 1 - p : p; };
  var npdf = function (x) { return 0.3989422804 * Math.exp(-x * x / 2); };
  var bs = function (s, K, T, r, v) {
    if (T <= 0) return { c: Math.max(s - K, 0), p: Math.max(K - s, 0), dc: s > K ? 1 : 0, dp: s < K ? -1 : 0, g: 0, vg: 0, tc: 0, tp: 0 };
    var sq = Math.sqrt(T), d1 = (Math.log(s / K) + (r + v * v / 2) * T) / (v * sq), d2 = d1 - v * sq, df = Math.exp(-r * T);
    var c = s * ncdf(d1) - K * df * ncdf(d2), p = K * df * ncdf(-d2) - s * ncdf(-d1);
    return { c: c, p: p, d1: d1, d2: d2, dc: ncdf(d1), dp: ncdf(d1) - 1, g: npdf(d1) / (s * v * sq), vg: s * npdf(d1) * sq / 100,
      tc: (-s * npdf(d1) * v / (2 * sq) - r * K * df * ncdf(d2)) / 365, tp: (-s * npdf(d1) * v / (2 * sq) + r * K * df * ncdf(-d2)) / 365 };
  };
  FN.turev = { pay: pay, info: info, bs: bs, ncdf: ncdf };

  var html = function () {
    return '<div class="grid">' +
      '<div class="card box" style="--cc:var(--rasp)"><span class="k">istasyon · türev masası</span><h2>Opsiyon stratejisini kur, vade sonu kârını çiz</h2><p class="sub">Hazır bir strateji seç ya da bacakları kendin düzenle. Grafik, vade sonunda dayanak fiyatına göre toplam kâr-zararı gösterir.</p>' +
      '<div class="strat" data-strat>' + V.STRAT.map(function (s) { return '<button type="button" data-st="' + s.k + '">' + X(s.ad) + '</button>'; }).join('') + '</div>' +
      '<div class="grid g2" style="margin-top:14px"><div><div class="legs" data-legs></div><div class="row" style="margin-top:10px"><button type="button" class="btn sm" data-add>+ bacak ekle</button></div><div class="kpis" data-k="pf"></div><div data-tip="pf"></div></div>' +
      '<div><div data-c="pf"></div><div class="leg"><span><i style="background:#B84A6B;height:3px"></i>toplam kâr-zarar</span><span><i style="background:#9AA6B8;height:3px"></i>tek tek bacaklar</span><span><i style="background:#E0A526"></i>başabaş</span></div></div></div></div>' +
      '<div class="card box" style="--cc:var(--plum)"><span class="k">fiyatlama</span><h2>Black–Scholes: opsiyon bugün kaç para eder?</h2><p class="sub">Avrupa tipi opsiyon, temettüsüz dayanak. Vade kısaldıkça değer eğrisi vade sonu çizgisine yaklaşır.</p>' +
      '<div class="grid gside"><div data-bsin></div><div><div data-c="bs"></div><div class="leg"><span><i style="background:#6B4FB3;height:3px"></i>alım opsiyonu bugünkü değeri</span><span><i style="background:#9AA6B8;height:3px"></i>vade sonu değeri</span></div></div></div>' +
      '<div class="kpis" data-k="bs"></div><div class="formula" data-f="bs"></div></div></div>';
  };
  var paintLegs = function () {
    $$('[data-strat] button', sec).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-st') === S.st)); });
    $('[data-legs]', sec).innerHTML = S.bac.map(function (b, i) {
      return '<div class="leg2" data-li="' + i + '"><label class="fld">Ürün<select data-lf="t"><option value="call"' + (b.t === 'call' ? ' selected' : '') + '>Alım (call)</option><option value="put"' + (b.t === 'put' ? ' selected' : '') + '>Satım (put)</option><option value="hisse"' + (b.t === 'hisse' ? ' selected' : '') + '>Hisse</option></select></label>' +
        '<label class="fld">Yön<select data-lf="y"><option value="1"' + (b.y > 0 ? ' selected' : '') + '>al (uzun)</option><option value="-1"' + (b.y < 0 ? ' selected' : '') + '>sat (kısa)</option></select></label>' +
        '<label class="fld">Kullanım<input type="text" inputmode="decimal" data-lf="K" value="' + (b.t === 'hisse' ? '' : nf(b.K, 1)) + '"' + (b.t === 'hisse' ? ' disabled placeholder="—"' : '') + '></label>' +
        '<label class="fld">' + (b.t === 'hisse' ? 'Alış fiyatı' : 'Prim') + '<input type="text" inputmode="decimal" data-lf="p" value="' + nf(b.p, 2) + '"></label>' +
        '<label class="fld">Adet<input type="text" inputmode="numeric" data-lf="n" value="' + b.n + '"></label>' +
        '<button type="button" class="x" data-rm="' + i + '" aria-label="bacağı sil"' + (S.bac.length < 2 ? ' disabled' : '') + '>×</button></div>';
    }).join('');
  };
  var paintPF = function (anim) {
    var rg = range(S.bac), N = 160, tot = [], legsP = S.bac.map(function () { return []; }), i;
    for (i = 0; i <= N; i++) { var s = rg[0] + (rg[1] - rg[0]) * i / N; tot.push([s, pay(S.bac, s)]); S.bac.forEach(function (b, j) { legsP[j].push([s, leg(b, s)]); }); }
    var I = info(S.bac), ser = S.bac.length > 1 ? legsP.map(function (p) { return { p: p, c: '#9AA6B8', w: 1.6, d: '5 5' }; }) : [];
    ser.push({ p: tot, c: '#B84A6B', w: 3.2, area: true, base: 0 });
    var ys = tot.map(function (q) { return q[1]; }), ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys), pad = (ymax - ymin) * 0.12 || 2;
    $('[data-c="pf"]', sec).innerHTML = C.chart({ w: 620, h: 300, x: rg, y: [ymin - pad, ymax + pad], s: ser, dots: I.be.filter(function (b) { return b >= rg[0] && b <= rg[1]; }).map(function (b) { return { x: b, y: 0, c: '#E0A526', r: 6, t: nf(b, 1) }; }), xf: function (v) { return nf(v); }, yf: function (v) { return nf(v, 0); }, xl: 'vadede dayanak fiyatı', yl: 'kâr / zarar (TL)', al: 'vade sonu kâr-zarar', anim: anim !== false });
    var f = function (v) { return v === Infinity ? 'sınırsız' : v === -Infinity ? 'sınırsız' : nf(v, 2); };
    $('[data-k="pf"]', sec).innerHTML = '<div class="kpi"><small>en çok kâr</small><b style="color:var(--ok)">' + f(I.max) + '</b></div><div class="kpi"><small>en çok zarar</small><b style="color:var(--bad)">' + f(I.min) + '</b></div><div class="kpi"><small>başabaş</small><b>' + (I.be.length ? I.be.map(function (b) { return nf(b, 1); }).join(' · ') : 'yok') + '</b></div><div class="kpi"><small>' + (I.net >= 0 ? 'net prim geliri' : 'net prim ödemesi') + '</small><b>' + nf(Math.abs(I.net), 2) + '</b></div>';
    var st = V.STRAT.filter(function (x) { return x.k === S.st; })[0];
    $('[data-tip="pf"]', sec).innerHTML = C.tip(st ? X(st.not) : 'Kendi stratejin. Sağ uçta eğim pozitifse kâr, negatifse zarar sınırsızdır: açıkta satılan alım opsiyonlarına dikkat.', S.st === 'ozel' ? 'f(x)' : 'K');
  };
  var BSIN = [['S', 'Dayanak fiyatı', 40, 180, 1, ''], ['K', 'Kullanım fiyatı', 40, 180, 1, ''], ['T', 'Vadeye gün', 0, 365, 1, ' gün'], ['r', 'Risksiz faiz', 0, 60, 0.5, '%'], ['v', 'Oynaklık (σ)', 5, 120, 1, '%']];
  var paintBS = function () {
    var o = S.bs, T = o.T / 365, r = o.r / 100, v = o.v / 100, R = bs(o.S, o.K, T, r, v);
    $$('[data-bsin] output', sec).forEach(function (el) { var k = el.getAttribute('data-for'), d = BSIN.filter(function (x) { return x[0] === k; })[0]; el.textContent = (d[5] === '%' ? '%' : '') + nf(o[k], d[4] < 1 ? 1 : 0) + (d[5] === ' gün' ? ' gün' : ''); });
    var lo = o.K * 0.5, hi = o.K * 1.5, cur = [], exp = [], i;
    for (i = 0; i <= 120; i++) { var s = lo + (hi - lo) * i / 120; cur.push([s, bs(s, o.K, T, r, v).c]); exp.push([s, Math.max(s - o.K, 0)]); }
    $('[data-c="bs"]', sec).innerHTML = C.chart({ w: 620, h: 260, x: [lo, hi], y0: true, s: [{ p: exp, c: '#9AA6B8', w: 2 }, { p: cur, c: '#6B4FB3', w: 3 }], dots: [{ x: o.S, y: R.c, c: '#0D1838', r: 7, cls: 'me', t: nf(R.c, 2) }], vl: [{ x: o.K, c: '#9AA6B8', lab: 'K' }], xf: function (v2) { return nf(v2); }, yf: function (v2) { return nf(v2); }, xl: 'dayanak fiyatı', al: 'alım opsiyonu değer eğrisi', anim: false });
    $('[data-k="bs"]', sec).innerHTML = '<div class="kpi hl"><small>alım (call)</small><b>' + nf(R.c, 2) + '</b></div><div class="kpi hl"><small>satım (put)</small><b>' + nf(R.p, 2) + '</b></div><div class="kpi"><small>delta (call / put)</small><b>' + nf(R.dc, 3) + ' / ' + nf(R.dp, 3) + '</b></div><div class="kpi"><small>gama</small><b>' + nf(R.g, 4) + '</b></div><div class="kpi"><small>vega (σ +1 puan)</small><b>' + nf(R.vg, 3) + '</b></div><div class="kpi"><small>teta (günlük, call)</small><b>' + nf(R.tc, 3) + '</b></div>';
    var par = o.S - o.K * Math.exp(-r * T);
    $('[data-f="bs"]', sec).innerHTML = (T > 0 ? 'd₁ = [ln(S/K) + (r + σ²/2)T] / (σ√T) = <b>' + nf(R.d1, 4) + '</b> · d₂ = d₁ − σ√T = <b>' + nf(R.d2, 4) + '</b><br>C = S·N(d₁) − K·e<sup>−rT</sup>·N(d₂) = <b>' + nf(R.c, 4) + '</b><br>' : 'Vade doldu: opsiyon değeri iç değerine eşit.<br>') + 'Parite: C − P = ' + nf(R.c - R.p, 4) + ' · S − K·e<sup>−rT</sup> = ' + nf(par, 4) + (Math.abs(R.c - R.p - par) < 1e-6 ? ' ✓' : '');
  };

  FN.st.turev = {
    init: function () {
      sec = $('#turev'); sec.innerHTML = html();
      $('[data-bsin]', sec).innerHTML = BSIN.map(function (d) { return '<div class="sl" style="margin-top:10px"><span>' + d[1] + '</span><input type="range" min="' + d[2] + '" max="' + d[3] + '" step="' + d[4] + '" value="' + S.bs[d[0]] + '" data-bs="' + d[0] + '" aria-label="' + d[1] + '"><output data-for="' + d[0] + '"></output></div>'; }).join('');
      paintLegs(); paintPF(); paintBS();
      sec.addEventListener('click', function (e) {
        var b = e.target.closest('[data-st]'); if (b) { var st = V.STRAT.filter(function (x) { return x.k === b.getAttribute('data-st'); })[0]; S.st = st.k; S.bac = clone(st.bac); save(); paintLegs(); paintPF(); FN.bridgeSend(); return; }
        if (e.target.closest('[data-add]')) { if (S.bac.length >= 4) { C.toast('En çok 4 bacak.'); return; } S.bac.push({ t: 'call', y: 1, K: 100, p: 5, n: 1 }); S.st = 'ozel'; save(); paintLegs(); paintPF(); FN.bridgeSend(); return; }
        var rm = e.target.closest('[data-rm]'); if (rm && S.bac.length > 1) { S.bac.splice(+rm.getAttribute('data-rm'), 1); S.st = 'ozel'; save(); paintLegs(); paintPF(); FN.bridgeSend(); }
      });
      var onLeg = function (e) {
        var f = e.target.getAttribute('data-lf'); if (!f) return; var i = +e.target.closest('[data-li]').getAttribute('data-li'), b = S.bac[i];
        if (f === 't') { b.t = e.target.value; if (b.t === 'hisse') { b.K = 0; b.p = 100; } else if (!b.K) { b.K = 100; b.p = 5; } }
        else if (f === 'y') b.y = Number(e.target.value);
        else { var v = num(e.target.value); if (!isFinite(v) || v < 0) return; b[f] = f === 'n' ? Math.max(1, Math.round(v)) : v; }
        S.st = 'ozel'; save(); if (e.type === 'change' && (f === 't' || f === 'y')) paintLegs(); paintPF(false); $$('[data-strat] button', sec).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        clearTimeout(onLeg.t); onLeg.t = setTimeout(FN.bridgeSend, 300);
      };
      sec.addEventListener('input', function (e) {
        var k = e.target.getAttribute('data-bs'); if (k) { S.bs[k] = Number(e.target.value); save(); paintBS(); clearTimeout(paintBS.t); paintBS.t = setTimeout(FN.bridgeSend, 300); return; }
        if (e.target.tagName === 'INPUT') onLeg(e);
      });
      sec.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') onLeg(e); });
    },
    ctx: function () {
      var I = info(S.bac), o = S.bs, R = bs(o.S, o.K, o.T / 365, o.r / 100, o.v / 100), st = V.STRAT.filter(function (x) { return x.k === S.st; })[0];
      var f = function (v) { return isFinite(v) ? nf(v, 2) : 'sınırsız'; };
      return { sel: { key: 'finans.turev.' + S.st, title: st ? st.ad : 'özel strateji', la: 'Türev ürünler',
          rows: [['Bacaklar', S.bac.map(function (b) { return (b.y > 0 ? 'uzun ' : 'kısa ') + (b.t === 'hisse' ? 'hisse @' + nf(b.p, 2) : b.t + ' K=' + nf(b.K, 1) + ' prim ' + nf(b.p, 2)) + ' ×' + b.n; }).join('; ')], ['Kâr / zarar', 'en çok kâr ' + f(I.max) + ', en çok zarar ' + f(I.min) + ', başabaş ' + (I.be.map(function (b) { return nf(b, 1); }).join(' / ') || 'yok')], ['Black–Scholes', 'S ' + o.S + ', K ' + o.K + ', ' + o.T + ' gün, r %' + nf(o.r, 1) + ', σ %' + o.v + ' → call ' + nf(R.c, 2) + ', put ' + nf(R.p, 2) + ', delta ' + nf(R.dc, 3)]],
          about: 'öğrenci Acadex Finans türev istasyonunda opsiyon stratejileri ve Black–Scholes fiyatlamasını çalışıyor (kurgusal fiyatlar). Yatırım tavsiyesi verme.' },
        chips: [['delta', 'Delta ne anlatıyor?'], ['oynak', 'Oynaklık artınca opsiyon neden pahalanır?'], ['strateji', 'Bu stratejiyi hangi beklentiyle kurarım?']] };
    },
    classify: function (q) { if (/delta|gama|yunan/.test(q)) return 'delta'; if (/oynak|volatil|vega/.test(q)) return 'oynak'; if (/strateji|beklenti/.test(q)) return 'strateji'; return null; },
    answer: function (k) {
      var o = S.bs, R = bs(o.S, o.K, o.T / 365, o.r / 100, o.v / 100), st = V.STRAT.filter(function (x) { return x.k === S.st; })[0];
      if (k === 'delta') return 'Delta, dayanak fiyatı 1 TL değişince opsiyon değerinin ne kadar değiştiğidir. Şu an alım opsiyonunun deltası ' + nf(R.dc, 3) + ': dayanak 1 TL artarsa opsiyon yaklaşık ' + nf(R.dc, 2) + ' TL artar. Derin parada 1’e, derin zararda 0’a yaklaşır. Gama, deltanın kendisinin ne hızla değiştiğini ölçer (' + nf(R.g, 4) + '); en çok başa baş noktası civarında ve vadeye yakın büyür.';
      if (k === 'oynak') return 'Opsiyon sahibinin zararı primle sınırlı, kazancı ise fiyatın ne kadar uzağa gidebileceğine bağlı. Oynaklık arttıkça uç sonuçların olasılığı artar; bu, kazanç tarafını büyütür ama zarar tarafını (prim) büyütmez. Bu yüzden hem alım hem satım opsiyonu pahalanır. Vega ' + nf(R.vg, 3) + ': oynaklık 1 puan artınca opsiyon değeri yaklaşık bu kadar artar.';
      if (k === 'strateji') return st ? st.ad + ': ' + st.not : 'Özel stratejinde sağ uçtaki eğime bak: alım bacaklarının ve hissenin toplam yönü pozitifse yükselişten, negatifse düşüşten ya da yatay piyasadan kazanırsın. Başabaş noktaları, fiyatın vadede hangi aralıkta olmasını beklediğini gösterir.';
      return null;
    }
  };
})();
