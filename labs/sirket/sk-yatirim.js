/* ==========================================================================
   ACADEX ŞİRKET · YATIRIM KARARI (labs/sirket/sk-yatirim.js), 29.10.2026
   Dört kurgusal proje, sınırlı bütçe (sermaye tayınlaması). İskonto oranı
   sürgüsüyle NBD, İVO, geri ödeme, iskontolu geri ödeme ve karlılık endeksi
   canlı değişir; NBD profili grafiği. Projeleri seçip yönetim kuruluna sun:
   bütçe içindeki en yüksek toplam NBD ile karşılaştırılır.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, SK = FN.sk, V = SK.V, M = SK.M, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, pct = C.pct;
  var P = V.PROJE, B = V.YATIRIM_BUTCE, sec;
  var S = C.ls.get('sk.yt', null) || { r: 0.30, sel: [] };
  var save = function () { C.ls.set('sk.yt', S); };
  var yil = function (v) { return isFinite(v) ? nf(v, 1) + ' yıl' : 'dönmüyor'; };

  var cards = function () {
    $('[data-pj]', sec).innerHTML = P.map(function (p) {
      var npv = M.npv(S.r, p.cf), irr = M.irr(p.cf), on = S.sel.indexOf(p.k) > -1;
      var bars = C.chart({ w: 300, h: 150, yt: 3, x: [-0.5, p.cf.length - 0.5], y0: true, anim: false, pl: 34, pb: 22, al: p.ad + ' nakit akışı', xticks: p.cf.map(function (c, t) { return t; }), xf: function (v) { return 'Y' + v; }, yf: function (v) { return nf(v); },
        bars: p.cf.map(function (c, t) { return { x: t, y0: 0, y1: c, c: c < 0 ? '#C8553D' : p.c, lab: 'Yıl ' + t + ': ' + nf(c, 1) + ' mn' }; }) });
      return '<article class="pj' + (on ? ' on' : '') + '" style="--pc:' + p.c + '"><header><b>' + X(p.ad) + '</b><span class="pill">' + nf(-p.cf[0]) + ' mn</span></header><p class="sub">' + X(p.n) + '</p>' + bars +
        '<div class="pj-k"><span>NBD<b style="color:' + (npv >= 0 ? 'var(--ok)' : 'var(--bad)') + '">' + nf(npv, 1) + '</b></span><span>İVO<b>' + pct(irr) + '</b></span><span>geri ödeme<b>' + yil(M.payback(p.cf)) + '</b></span><span>iskontolu<b>' + yil(M.payback(p.cf, S.r)) + '</b></span><span>KE<b>' + nf(M.pi(S.r, p.cf), 2) + '</b></span></div>' +
        '<button type="button" class="btn sm' + (on ? ' pri' : '') + '" data-pick="' + p.k + '" aria-pressed="' + on + '">' + (on ? '✓ seçildi' : 'seç') + '</button></article>';
    }).join('');
    $$('[data-pick]', sec).forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute('data-pick'), i = S.sel.indexOf(k); if (i > -1) S.sel.splice(i, 1); else S.sel.push(k); save(); cards(); budget(); $('[data-pick="' + k + '"]', sec).focus(); FN.bridgeSend(); };
    });
  };
  var budget = function () {
    var cost = 0, npv = 0; S.sel.forEach(function (k) { var p = P.filter(function (x) { return x.k === k; })[0]; cost += -p.cf[0]; npv += M.npv(S.r, p.cf); });
    var over = cost > B;
    $('[data-bud]', sec).innerHTML = '<div class="bud-bar"><i style="width:' + Math.min(100, cost / B * 100) + '%;background:' + (over ? 'var(--bad)' : 'var(--sea)') + '"></i></div>' +
      '<div class="row" style="justify-content:space-between"><span><b>' + nf(cost) + '</b> / ' + B + ' mn bütçe' + (over ? ' · <b style="color:var(--bad)">bütçe aşıldı</b>' : '') + '</span><span>toplam NBD <b style="color:' + (npv >= 0 ? 'var(--ok)' : 'var(--bad)') + '">' + nf(npv, 1) + ' mn</b></span></div>';
    $('[data-sun]', sec).disabled = !S.sel.length || over;
  };
  var profile = function () {
    var rs = []; for (var r = 0; r <= 0.8001; r += 0.02) rs.push(r);
    $('[data-prof]', sec).innerHTML = C.chart({ w: 640, h: 280, x: [0, 80], al: 'NBD profili', xf: function (v) { return '%' + nf(v, 0); }, yf: function (v) { return nf(v); }, xl: 'iskonto oranı', yl: 'NBD (mn TL)',
      s: P.map(function (p) { return { p: rs.map(function (r) { return [r * 100, M.npv(r, p.cf)]; }), c: p.c, w: 2.4 }; }),
      hl: [{ y: 0, c: '#0D1838' }], vl: [{ x: S.r * 100, c: '#0D1838', lab: 'şu an %' + nf(S.r * 100, 0) }],
      dots: P.map(function (p) { var i = M.irr(p.cf); return { x: i * 100, y: 0, c: p.c, r: 6, lab: p.ad + ' İVO ' + pct(i) }; }) }) +
      '<div class="leg">' + P.map(function (p) { return '<span><i style="background:' + p.c + '"></i>' + X(p.ad) + ' · İVO ' + pct(M.irr(p.cf)) + '</span>'; }).join('') + '</div>';
  };
  var sun = function () {
    var best = M.best(S.r, P, B), mine = S.sel.reduce(function (a, k) { var p = P.filter(function (x) { return x.k === k; })[0]; return a + M.npv(S.r, p.cf); }, 0);
    var name = function (k) { return P.filter(function (x) { return x.k === k; })[0].ad; };
    var bad = S.sel.filter(function (k) { return M.npv(S.r, P.filter(function (x) { return x.k === k; })[0].cf) < 0; });
    var p = best.npv > 0 ? Math.max(0, Math.min(100, mine / best.npv * 100)) : 100;
    $('[data-res]', sec).innerHTML = C.karne(p, 'Yönetim kurulu kararı · iskonto %' + nf(S.r * 100, 0), [
      [Math.abs(mine - best.npv) < 1e-6, 'Senin seçimin: ' + S.sel.map(name).join(' + ') + ' → NBD ' + nf(mine, 1) + ' mn'],
      [true, 'Bütçe içinde en yüksek NBD: ' + best.set.map(name).join(' + ') + ' → ' + nf(best.npv, 1) + ' mn (' + nf(best.cost) + ' mn)'],
      [!bad.length, bad.length ? 'NBD\'si eksi proje seçtin: ' + bad.map(name).join(', ') + '. Bu oranda şirketin değerini azaltır.' : 'Değer yok eden (NBD < 0) proje seçmedin.']
    ], 'Bütçe kısıtlıyken tek tek en yüksek İVO\'yu seçmek yetmez; bütçeye sığan <b>toplam NBD</b>\'yi büyütmek gerekir. İskonto oranını değiştirip kararın nasıl döndüğünü izle (faiz yükselince uzun vadeli projeler önce düşer).');
    FN.bridgeSend();
  };

  FN.st.yatirim = {
    init: function () {
      sec = $('#yatirim');
      sec.innerHTML = '<div class="card box" style="--cc:var(--blue)"><span class="k">istasyon · sermaye bütçelemesi · milyon TL · kurgusal</span><h2>' + B + ' milyon TL var: hangi projelere?</h2>' +
        '<p class="sub"><b>NBD</b> (net bugünkü değer): gelecekteki nakitleri sermaye maliyetiyle bugüne indirip yatırımı düşeriz; artıysa proje şirkete değer katar. <b>İVO</b>: NBD\'yi sıfırlayan oran. <b>KE</b> (karlılık endeksi): yatırılan her 1 TL\'nin bugünkü karşılığı.</p>' +
        '<label class="sl" style="max-width:520px"><span>iskonto oranı</span><input type="range" min="0.10" max="0.60" step="0.01" data-r value="' + S.r + '"><output data-ro>%' + nf(S.r * 100, 0) + '</output></label>' +
        '<div class="pjs" data-pj></div><div class="bud" data-bud></div><div class="row" style="margin-top:10px"><button type="button" class="btn pri" data-sun>yönetim kuruluna sun</button></div><div data-res></div></div>' +
        '<div class="card box" style="--cc:var(--plum);margin-top:18px"><span class="k">duyarlılık</span><h2>NBD profili: oran yükselince ne olur?</h2><p class="sub">Her eğri bir proje. Eğrinin sıfırı kestiği yer İVO\'su. Eğriler kesişiyorsa sıralama orana göre değişir: nakdi geç gelen proje yüksek oranda hızla değer kaybeder.</p><div data-prof></div></div>';
      $('[data-r]', sec).oninput = function () { S.r = +this.value; $('[data-ro]', sec).textContent = '%' + nf(S.r * 100, 0); save(); cards(); budget(); profile(); $('[data-res]', sec).innerHTML = ''; FN.bridgeSend(); };
      $('[data-sun]', sec).onclick = sun;
      cards(); budget(); profile();
    },
    ctx: function () {
      return { sel: { key: 'sirket.yatirim', title: 'yatırım kararı · %' + nf(S.r * 100, 0),
        rows: P.map(function (p) { return [p.ad, 'NBD ' + nf(M.npv(S.r, p.cf), 1) + ' · İVO ' + pct(M.irr(p.cf)) + (S.sel.indexOf(p.k) > -1 ? ' · seçili' : '')]; }),
        about: 'öğrenci ' + B + ' mn TL bütçeyle dört proje arasında NBD, İVO, geri ödeme ve karlılık endeksine göre seçim yapıyor.' },
        chips: ['NBD ile İVO çelişirse hangisine bakılır?', 'Geri ödeme süresinin eksiği ne?', 'Sermaye tayınlaması nedir?'] };
    }
  };
})();
