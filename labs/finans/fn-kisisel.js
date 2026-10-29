/* ==========================================================================
   ACADEX FİNANS · KİŞİSEL FİNANS (labs/finans/fn-kisisel.js), 29.10.2026
   Herkes için: 1) 50/30/20 bütçe terazisi  2) kredi kartı: asgari ödeme ↔
   sabit ödeme (borç eğrisi, toplam faiz)  3) birikim hedefi: enflasyona karşı
   reel getiri ile aylık ne kadar biriktirmeli. Oranlar kurgusal; tavsiye değildir.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, tl = C.tl, pct = C.pct, num = C.num;
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var S = C.ls.get('kf', null) || { gel: V.GELIR, bud: clone(V.BUTCE), kk: { b: 30000, r: 4.25, a: 20, s: 6000 }, hd: { h: 150000, y: 3, g: 40, e: 30 } };
  var save = function () { C.ls.set('kf', S); };
  var sec;
  var GR = { ihtiyac: ['İhtiyaç', '#2F6FB0', 0.5], istek: ['İstek', '#E0A526', 0.3], birikim: ['Birikim', '#3E8E5B', 0.2] };

  /* kredi kartı: her ay faiz eklenir, ödeme düşülür; asgari ödeme bakiyenin %a'sı (alt sınır 250 TL) */
  var card = function (b, r, a, sabit) {
    var bal = b, tf = 0, m = 0, path = [[0, b]];
    while (bal > 0.005 && m < 600) {
      var f = bal * r; bal += f; tf += f; m++;
      var pay = sabit ? Math.min(bal, sabit) : Math.min(bal, Math.max(bal * a, 250));
      if (sabit && sabit <= f + 1e-9) return { m: Infinity, tf: Infinity, path: path };
      bal -= pay; path.push([m, bal]);
    }
    if (bal > 0.005) return { m: Infinity, tf: Infinity, path: path };
    return { m: m, tf: tf, path: path };
  };
  var goal = function (h, y, g, e) { var real = (1 + g) / (1 + e) - 1, rm = Math.pow(1 + real, 1 / 12) - 1, n = Math.round(y * 12), pmt = Math.abs(rm) < 1e-12 ? h / n : h * rm / (Math.pow(1 + rm, n) - 1); return { real: real, pmt: pmt, n: n, rm: rm, nom: h * Math.pow(1 + e, y) }; };
  FN.kisisel = { card: card, goal: goal };

  var html = function () {
    return '<div class="grid">' +
      '<div class="card box" style="--cc:var(--green)"><span class="k">istasyon · cüzdan · herkes için</span><h2>Bütçe terazisi: 50 / 30 / 20</h2><p class="sub">Basit bir kural: gelirin yaklaşık yarısı ihtiyaçlara, üçte biri isteklere, beşte biri birikime. Kendi rakamlarını yaz, terazinin nereye eğildiğini gör.</p>' +
      '<div class="grid g2"><div><label class="fld" style="max-width:240px">Aylık net gelir (TL)<input type="text" inputmode="decimal" data-gel value="' + nf(S.gel) + '"></label><div class="bud" data-bud style="margin-top:12px"></div></div>' +
      '<div><div class="row" style="align-items:center;gap:18px"><div data-don></div><div class="kpis" data-k="bt" style="flex:1;min-width:180px"></div></div><div class="gauge" data-gauge style="margin-top:14px"></div><div data-tip="bt"></div></div></div></div>' +
      '<div class="grid g2">' +
      '<div class="card box" style="--cc:var(--rust)"><span class="k">kredi kartı · oranlar kurgusal</span><h3>Asgari ödemenin bedeli</h3><div class="fl">' +
      '<label class="fld">Kart borcu (TL)<input type="text" inputmode="decimal" data-kk="b" value="' + nf(S.kk.b) + '"></label><label class="fld">Aylık faiz (%)<input type="text" inputmode="decimal" data-kk="r" value="' + nf(S.kk.r, 2) + '"></label>' +
      '<label class="fld">Asgari ödeme oranı (%)<input type="text" inputmode="decimal" data-kk="a" value="' + nf(S.kk.a) + '"></label><label class="fld">Sabit aylık ödeme (TL)<input type="text" inputmode="decimal" data-kk="s" value="' + nf(S.kk.s) + '"></label></div>' +
      '<div data-c="kk" style="margin-top:12px"></div><div class="leg"><span><i style="background:#C8553D;height:3px"></i>yalnız asgari ödeme</span><span><i style="background:#3E8E5B;height:3px"></i>sabit ödeme</span></div><div class="kpis" data-k="kk"></div><p class="sub" style="margin:0">Gerçekte kart faizine KKDF ve BSMV de eklenir; geciken ödemede gecikme faizi işler. Burada yok sayıldı.</p></div>' +
      '<div class="card box" style="--cc:var(--blue)"><span class="k">hedef kumbarası</span><h3>Birikim hedefi: enflasyona yenilmeden</h3><div class="fl">' +
      '<label class="fld">Hedef (bugünün parasıyla, TL)<input type="text" inputmode="decimal" data-hd="h" value="' + nf(S.hd.h) + '"></label><label class="fld">Süre (yıl)<input type="text" inputmode="decimal" data-hd="y" value="' + nf(S.hd.y, 1) + '"></label>' +
      '<label class="fld">Beklenen nominal getiri (yıllık %)<input type="text" inputmode="decimal" data-hd="g" value="' + nf(S.hd.g, 1) + '"></label><label class="fld">Beklenen enflasyon (yıllık %)<input type="text" inputmode="decimal" data-hd="e" value="' + nf(S.hd.e, 1) + '"></label></div>' +
      '<div data-c="hd" style="margin-top:12px"></div><div class="kpis" data-k="hd"></div><div data-tip="hd"></div></div>' +
      '</div></div>';
  };
  var paintBud = function (rows) {
    if (rows) $('[data-bud]', sec).innerHTML = S.bud.map(function (b, i) { return '<div class="br" data-bi="' + i + '"><span>' + X(b[1]) + '</span><select data-bf="g" aria-label="' + X(b[1]) + ' grubu">' + Object.keys(GR).map(function (g) { return '<option value="' + g + '"' + (g === b[2] ? ' selected' : '') + '>' + GR[g][0] + '</option>'; }).join('') + '</select><input type="text" inputmode="decimal" data-bf="v" value="' + nf(b[3]) + '" aria-label="' + X(b[1]) + ' tutarı"></div>'; }).join('');
    var sum = { ihtiyac: 0, istek: 0, birikim: 0 }, tot = 0;
    S.bud.forEach(function (b) { sum[b[2]] += b[3]; tot += b[3]; });
    var kal = S.gel - tot; if (kal > 0) sum.birikim += 0; /* kalan ayrı gösterilir */
    $('[data-don]', sec).innerHTML = C.donut(Object.keys(GR).map(function (g) { return [sum[g], GR[g][1], GR[g][0]]; }).concat(kal > 0 ? [[kal, '#D5DDE6', 'dağıtılmamış']] : []), 150, pct(sum.birikim / (S.gel || 1), 0));
    $('[data-k="bt"]', sec).innerHTML = '<div class="kpi"><small>toplam harcama + birikim</small><b>' + tl(tot) + '</b></div><div class="kpi' + (kal < 0 ? '' : ' hl') + '"><small>' + (kal < 0 ? 'açık' : 'dağıtılmamış') + '</small><b style="' + (kal < 0 ? 'color:var(--bad)' : '') + '">' + tl(Math.abs(kal)) + '</b></div>';
    $('[data-gauge]', sec).innerHTML = Object.keys(GR).map(function (g) { var f = sum[g] / (S.gel || 1); return '<div class="gr2"><span>' + GR[g][0] + '</span><div class="tr"><i style="width:' + Math.min(100, f * 100) + '%;background:' + GR[g][1] + '"></i><u style="left:' + GR[g][2] * 100 + '%" data-l="%' + GR[g][2] * 100 + '"></u></div><span class="mono" style="text-align:right">' + pct(f, 0) + '</span></div>'; }).join('');
    var ih = sum.ihtiyac / (S.gel || 1), is = sum.istek / (S.gel || 1), bi = sum.birikim / (S.gel || 1), msg;
    if (kal < 0) msg = 'Gider gelirden ' + tl(-kal) + ' fazla: bu açık genellikle kredi kartına yazılır. Önce isteklerden kıs.';
    else if (bi < 0.2 && kal > 0) msg = 'Dağıtılmamış ' + tl(kal) + ' var. Ayın başında birikime ayırırsan oran ' + pct((sum.birikim + kal) / S.gel, 0) + '’e çıkar: “önce kendine öde”.';
    else if (ih > 0.5) msg = 'İhtiyaçlar gelirin ' + pct(ih, 0) + '’i. Öğrencilikte kira bunu zorlar; yurt, ev arkadaşı ya da ulaşım kartı indirimleri payı düşürür.';
    else if (is > 0.3) msg = 'İstekler ' + pct(is, 0) + ': hedefin üstünde. Abonelikleri tek tek gözden geçirmek en kolay kazanımdır.';
    else msg = 'Terazi dengede. Birikim oranın ' + pct(bi, 0) + '.';
    $('[data-tip="bt"]', sec).innerHTML = C.tip(msg, pct(bi, 0));
  };
  var paintKK = function () {
    var o = S.kk, A = card(o.b, o.r / 100, o.a / 100, 0), B = card(o.b, o.r / 100, 0, o.s);
    var ser = [{ p: A.path, c: '#C8553D', w: 2.6 }]; if (isFinite(B.m)) ser.push({ p: B.path, c: '#3E8E5B', w: 2.6 });
    var xm = Math.max(isFinite(A.m) ? A.m : A.path.length - 1, isFinite(B.m) ? B.m : 0, 6);
    $('[data-c="kk"]', sec).innerHTML = C.chart({ w: 560, h: 220, x: [0, xm], y0: true, s: ser, xf: function (v) { return nf(v); }, xl: 'ay', yf: function (v) { return nf(v / 1e3) + ' bin'; }, al: 'kart borcunun seyri' });
    var f = function (R) { return isFinite(R.m) ? R.m + ' ay' : 'bitmiyor'; };
    $('[data-k="kk"]', sec).innerHTML = '<div class="kpi"><small>asgari ile süre</small><b>' + f(A) + '</b></div><div class="kpi"><small>asgari ile faiz</small><b style="color:var(--bad)">' + (isFinite(A.tf) ? tl(A.tf) : '—') + '</b></div><div class="kpi"><small>sabit ödemeyle süre</small><b>' + (isFinite(B.m) ? B.m + ' ay' : 'faizi karşılamıyor') + '</b></div><div class="kpi hl"><small>sabit ödemeyle faiz</small><b>' + (isFinite(B.tf) ? tl(B.tf) : '—') + '</b></div>';
  };
  var paintHD = function () {
    var o = S.hd, G = goal(o.h, o.y, o.g / 100, o.e / 100), pts = [], bal = 0, k;
    for (k = 0; k <= G.n; k++) { pts.push([k / 12, bal]); bal = bal * (1 + G.rm) + G.pmt; }
    $('[data-c="hd"]', sec).innerHTML = C.chart({ w: 560, h: 220, x: [0, o.y], y0: true, s: [{ p: pts, c: '#2F6FB0', w: 2.8, area: true }], hl: [{ y: o.h, c: '#3E8E5B', lab: 'hedef' }], xf: function (v) { return nf(v, v % 1 ? 1 : 0); }, xl: 'yıl', yf: function (v) { return nf(v / 1e3) + ' bin'; }, al: 'birikimin bugünkü alım gücüyle seyri' });
    $('[data-k="hd"]', sec).innerHTML = '<div class="kpi hl"><small>aylık birikim (bugünün TL’si)</small><b>' + tl(G.pmt) + '</b></div><div class="kpi"><small>reel getiri</small><b style="color:' + (G.real < 0 ? 'var(--bad)' : 'var(--ok)') + '">' + pct(G.real, 2) + '</b></div><div class="kpi"><small>vadede nominal hedef</small><b>' + tl(G.nom) + '</b></div>';
    $('[data-tip="hd"]', sec).innerHTML = C.tip(G.real < 0 ? 'Getiri enflasyonun altında: biriken para alım gücü kaybediyor, aylık tutar yalnızca biriktirmekten fazlasını istiyor.' : 'Aylık tutar bugünün parasıyla. Her yıl enflasyon kadar artırırsan (ilk yıl ' + tl(G.pmt) + ', sonra ' + tl(G.pmt * (1 + o.e / 100)) + '…) vadede ' + tl(G.nom) + ' nominal hedefe ulaşırsın. Grafik alım gücünü gösterir.', '₺→');
  };

  FN.st.kisisel = {
    init: function () {
      sec = $('#kisisel'); sec.innerHTML = html(); paintBud(true); paintKK(); paintHD();
      sec.addEventListener('input', function (e) {
        var t = e.target, v;
        if (t.hasAttribute('data-gel')) { v = num(t.value); if (isFinite(v) && v >= 0) { S.gel = v; save(); paintBud(false); } }
        else if (t.getAttribute('data-bf') === 'v') { v = num(t.value); if (isFinite(v) && v >= 0) { S.bud[+t.closest('[data-bi]').getAttribute('data-bi')][3] = v; save(); paintBud(false); } }
        else if (t.hasAttribute('data-kk')) { v = num(t.value); if (isFinite(v) && v >= 0) { S.kk[t.getAttribute('data-kk')] = v; save(); paintKK(); } }
        else if (t.hasAttribute('data-hd')) { v = num(t.value); if (isFinite(v) && v >= 0 && !(t.getAttribute('data-hd') === 'y' && v < 0.25)) { S.hd[t.getAttribute('data-hd')] = v; save(); paintHD(); } }
        else return;
        clearTimeout(paintKK.t); paintKK.t = setTimeout(FN.bridgeSend, 300);
      });
      sec.addEventListener('change', function (e) { if (e.target.getAttribute('data-bf') !== 'g') return; S.bud[+e.target.closest('[data-bi]').getAttribute('data-bi')][2] = e.target.value; save(); paintBud(false); FN.bridgeSend(); });
    },
    ctx: function () {
      var tot = S.bud.reduce(function (a, b) { return a + b[3]; }, 0), A = card(S.kk.b, S.kk.r / 100, S.kk.a / 100, 0), G = goal(S.hd.h, S.hd.y, S.hd.g / 100, S.hd.e / 100);
      return { sel: { key: 'finans.kisisel', title: 'bütçe, kart, hedef', la: 'Kişisel finans',
          rows: [['Bütçe', 'gelir ' + tl(S.gel) + ', dağıtılan ' + tl(tot) + '; ' + S.bud.map(function (b) { return b[1] + ' ' + nf(b[3]) + ' (' + GR[b[2]][0] + ')'; }).join(', ')], ['Kart', 'borç ' + tl(S.kk.b) + ', aylık %' + nf(S.kk.r, 2) + ', asgari ile ' + (isFinite(A.m) ? A.m + ' ay, faiz ' + tl(A.tf) : 'bitmiyor')], ['Hedef', tl(S.hd.h) + ' / ' + S.hd.y + ' yıl, reel getiri ' + pct(G.real, 2) + ' → aylık ' + tl(G.pmt)]],
          about: 'kullanıcı Acadex Finans kişisel finans istasyonunda bütçe, kredi kartı ve birikim hedefi hesaplıyor (kurgusal oranlar). Kişisel yatırım tavsiyesi verme; genel ilkeleri ve hesabı açıkla.' },
        chips: [['asgari', 'Asgari ödeme neden bu kadar pahalı?'], ['acil', 'Acil durum fonu ne kadar olmalı?'], ['butce', 'Bütçemde ilk neyi değiştireyim?']] };
    },
    classify: function (q) { if (/asgari|kart/.test(q)) return 'asgari'; if (/acil/.test(q)) return 'acil'; if (/bütçe|butce/.test(q)) return 'butce'; return null; },
    answer: function (k) {
      if (k === 'asgari') { var A = card(S.kk.b, S.kk.r / 100, S.kk.a / 100, 0), B = card(S.kk.b, S.kk.r / 100, 0, S.kk.s); return 'Asgari ödeme bakiyenin yüzdesi olduğu için borç küçüldükçe ödeme de küçülür; kalan borç her ay yeniden faiz yer. Senin rakamlarınla yalnız asgari ödeyince borç ' + (isFinite(A.m) ? A.m + ' ayda biter ve ' + tl(A.tf) + ' faiz ödenir' : 'bitmez') + '. Sabit ' + tl(S.kk.s) + ' ödersen ' + (isFinite(B.m) ? B.m + ' ay ve ' + tl(B.tf) + ' faiz' : 'faiz bile karşılanmaz') + '. Kural: ödeyebildiğin en yüksek sabit tutarı öde, yeni harcamayı karta yazma.'; }
      if (k === 'acil') { var ih = S.bud.filter(function (b) { return b[2] === 'ihtiyac'; }).reduce(function (a, b) { return a + b[3]; }, 0); return 'Yaygın kural, 3 ila 6 aylık zorunlu gider kadar kolay ulaşılabilir birikimdir. Senin ihtiyaç kalemlerin aylık ' + tl(ih) + '; buna göre hedef ' + tl(ih * 3) + ' ile ' + tl(ih * 6) + ' arası. Öğrenciysen ve aile desteği varsa alt sınır yeterli olabilir. Bu fon yatırım değil, sigortadır: değeri kolay erimeyen ve hemen çekilebilen bir yerde durmalı.'; }
      if (k === 'butce') return null;
      return null;
    }
  };
})();
