/* ==========================================================================
   ACADEX DİYET LAB · değişim tablosu (labs/diyet/diyet-degisim.js), 31.10.2026
   Akış: hedef enerji ve makro dağılımı → besin değişim sayıları (süt, et, ekmek, kuru baklagil,
   sebze, meyve, yağ, yağlı tohum) → öğünlere dağıtım → tabaktaki menünün değişim karşılığı.
   Değişim değerleri ve hesap: diyet-model.js (DEG, degisimOtomatik, degisimKontrol, menuDegisim).
   Diyetisyen geri bildirimi (Diyet Lab test raporu v1, madde 3).
   ========================================================================== */
(function () {
  'use strict';
  var DL = window.DL, C = DL && DL.core; if (!C) return;
  var M = C.M, $ = C.$, X = C.X, ls = C.ls, tr = C.tr, toast = C.toast;
  var OG = [['kahvalti', 'Kahvaltı'], ['ogle', 'Öğle'], ['aksam', 'Akşam'], ['ara', 'Ara']];

  var S = ls.get('degisim', null) || {};
  if (!S.h) S.h = null;                 /* {kcal, kh, pro, yag} */
  if (!S.c) S.c = {};                   /* günlük değişim sayıları */
  if (!S.o) S.o = {};                   /* öğün dağılımı: {grup: {kahvalti: n, …}} */
  var save = function () { ls.set('degisim', S); };
  var num = function (v) { return v === '' || v == null || isNaN(+v) ? null : +v; };
  var t1 = function (v) { return tr(v, Math.round(v * 10) % 10 ? 1 : 0); };

  var fromTabak = function () {
    var t = C.target ? C.target() : null;
    return { kcal: Math.round(t && t.kcal ? t.kcal : 1800), kh: 55, pro: 15, yag: 30, ad: t ? t.d : '' };
  };
  var hedef = function () { if (!S.h) { var f = fromTabak(); S.h = { kcal: f.kcal, kh: f.kh, pro: f.pro, yag: f.yag }; S.src = f.ad; save(); } return S.h; };
  var sumPct = function (h) { return (+h.kh || 0) + (+h.pro || 0) + (+h.yag || 0); };

  var paintHedef = function () {
    var h = hedef();
    $('#dg-kcal').value = h.kcal; $('#dg-kh').value = h.kh; $('#dg-pro').value = h.pro; $('#dg-yag').value = h.yag;
    $('#dg-src').textContent = S.src ? 'Kaynak: ' + S.src : 'Hedefi tabaktan al ya da kendin yaz. TÜBER 2022: KH %45–60, protein %10–20, yağ %20–35.';
    var g = M.degisimHedef(h), sp = sumPct(h), el = $('#dg-g');
    el.className = 'calc' + (sp !== 100 ? ' bad' : '');
    el.innerHTML = sp !== 100 ? 'Yüzdelerin toplamı %' + sp + '; 100 olmalı.' :
      'Hedef: <b>' + Math.round(g.kh) + ' g KH</b> (÷ 4 kcal) · <b>' + Math.round(g.pro) + ' g protein</b> (÷ 4) · <b>' + Math.round(g.yag) + ' g yağ</b> (÷ 9)';
  };

  var paintTab = function () {
    var head = '<thead><tr><th>GRUP · 1 DEĞİŞİM</th><th class="n">KH/P/Y (g)</th><th class="n">KCAL</th><th>GÜNLÜK</th>' + OG.map(function (o) { return '<th>' + o[1].toLocaleUpperCase('tr') + '</th>'; }).join('') + '<th>KALAN</th></tr></thead>';
    var body = M.DEG.map(function (g) {
      var gun = num(S.c[g.k]), o = S.o[g.k] || {};
      return '<tr><td><b>' + X(g.t) + '</b><small>' + X(g.ol) + '</small></td><td class="n">' + g.kh + '/' + g.pro + '/' + g.yag + '</td><td class="n">' + g.kcal + '</td>' +
        '<td><input class="gun" data-g="' + g.k + '" type="number" min="0" max="30" step="0.5" inputmode="decimal" aria-label="' + X(g.t) + ' günlük değişim" value="' + (gun != null ? gun : '') + '"></td>' +
        OG.map(function (x) { var v = num(o[x[0]]); return '<td><input data-g="' + g.k + '" data-o="' + x[0] + '" type="number" min="0" max="30" step="0.5" inputmode="decimal" aria-label="' + X(g.t) + ', ' + x[1] + '" value="' + (v != null ? v : '') + '"></td>'; }).join('') +
        '<td class="kal" id="dg-kal-' + g.k + '"></td></tr>';
    }).join('');
    var foot = '<tfoot><tr><td>Toplam</td><td class="n" id="dg-t-g"></td><td class="n" id="dg-t-k"></td><td colspan="' + (OG.length + 2) + '" style="font-weight:500;color:var(--muted)" id="dg-t-e"></td></tr></tfoot>';
    $('#dg-tab').innerHTML = head + '<tbody>' + body + '</tbody>' + foot;
    calc();
  };
  /* kutulara dokunmadan hesaplanan hücreleri günceller (yazarken tablo yeniden çizilmez) */
  var calc = function () {
    M.DEG.forEach(function (g) {
      var el = $('#dg-kal-' + g.k); if (!el) return;
      var gun = num(S.c[g.k]), o = S.o[g.k] || {}, dag = OG.reduce(function (a, x) { return a + (num(o[x[0]]) || 0); }, 0), kal = (gun || 0) - dag;
      el.className = 'kal' + (Math.abs(kal) > 1e-9 && gun ? ' bad' : '');
      el.textContent = gun ? (Math.abs(kal) < 1e-9 ? '✓' : (kal > 0 ? t1(kal) + ' dağıtılmadı' : t1(-kal) + ' fazla')) : '';
    });
    var T = M.degisimToplam(S.c);
    $('#dg-t-g').textContent = Math.round(T.kh) + '/' + Math.round(T.pro) + '/' + Math.round(T.yag);
    $('#dg-t-k').textContent = Math.round(T.kcal);
    $('#dg-t-e').textContent = T.kcal ? 'KH %' + Math.round(T.e.kh) + ' · protein %' + Math.round(T.e.pro) + ' · yağ %' + Math.round(T.e.yag) : '';
    paintKontrol();
  };

  var paintKontrol = function () {
    var h = hedef(); if (sumPct(h) !== 100 || !Object.keys(S.c).some(function (k) { return num(S.c[k]); })) { $('#dg-kontrol').innerHTML = ''; return; }
    var K = M.degisimKontrol(h, S.c);
    $('#dg-kontrol').innerHTML = '<div class="dg-k">' + K.rows.map(function (r) {
      return '<span class="pill ' + (r.ok ? 'ok' : 'bad') + '">' + X(r.t) + ': ' + Math.round(r.v) + ' / ' + Math.round(r.g) + (r.k === 'kcal' ? ' kcal' : ' g') + '</span>';
    }).join('') + '</div>' + (K.ok ? '<p class="sub" style="margin:8px 0 0">Plan hedefle uyumlu. Şimdi tabakta bu değişimlere uyan bir menü kur ve sağdaki karşılaştırmaya bak.</p>' : '');
  };

  var paintMenu = function () {
    var menu = C.menu ? C.menu() : {}, items = ['kahvalti', 'ogle', 'aksam', 'ara'].reduce(function (a, k) { return a.concat(menu[k] || []); }, []);
    if (!items.length) { $('#dg-menu').innerHTML = '<p class="sub" style="margin:0">Tabakta henüz besin yok. Menüyü kurunca değişim karşılığı burada çıkar.</p>'; return; }
    var m = M.menuDegisim(items), any = Object.keys(S.c).some(function (k) { return num(S.c[k]); });
    var rows = M.DEG.map(function (g) {
      var p = num(S.c[g.k]) || 0, v = m[g.k] || 0, off = any && Math.abs(v - p) > 0.5;
      if (!p && !v) return '';
      return '<tr' + (off ? ' class="off"' : '') + '><td>' + X(g.t) + '</td><td class="n">' + (any ? t1(p) : '—') + '</td><td class="n">' + t1(v) + '</td></tr>';
    }).join('');
    $('#dg-menu').innerHTML = '<table class="dg-menu"><thead><tr><th>GRUP</th><th class="n">PLAN</th><th class="n">MENÜ</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (m.seker ? '<p class="sub" style="margin:8px 0 0">Şeker grubu ≈ ' + t1(m.seker) + ' değişim (planda yok; 1 değişim = 15 g KH).</p>' : '') +
      (m.digerKcal ? '<p class="sub" style="margin:4px 0 0">İçecek vb. değişime girmeyen ≈ ' + m.digerKcal + ' kcal.</p>' : '');
  };

  var paint = function () { paintHedef(); paintTab(); paintMenu(); };
  DL.degisim = { paint: paint };

  /* olaylar */
  ['kcal', 'kh', 'pro', 'yag'].forEach(function (k) {
    $('#dg-' + k).addEventListener('input', function () { var h = hedef(), v = num(this.value); if (v == null) return; h[k] = v; S.src = 'senin girdiğin değerler'; save(); paintHedef(); paintKontrol(); });
  });
  $('#dg-al').addEventListener('click', function () { var f = fromTabak(); S.h = { kcal: f.kcal, kh: S.h ? S.h.kh : 55, pro: S.h ? S.h.pro : 15, yag: S.h ? S.h.yag : 30 }; S.src = f.ad; save(); paint(); toast('Hedef ' + f.kcal + ' kcal olarak alındı.'); });
  $('#dg-tab').addEventListener('input', function (e) {
    var t = e.target, g = t.getAttribute('data-g'); if (!g) return;
    var o = t.getAttribute('data-o'), v = num(t.value);
    if (o) { S.o[g] = S.o[g] || {}; if (v == null) delete S.o[g][o]; else S.o[g][o] = v; }
    else if (v == null) delete S.c[g]; else S.c[g] = v;
    save(); calc(); paintMenu();
  });
  $('#dg-oto').addEventListener('click', function () {
    var h = hedef(); if (sumPct(h) !== 100) { toast('Önce yüzdelerin toplamını 100 yap.'); return; }
    if (!num(S.c.sut) && !num(S.c.sebze) && !num(S.c.meyve)) { toast('Önce süt, sebze ve meyve değişimlerini yaz (ör. süt 2, sebze 3, meyve 3).'); return; }
    var r = M.degisimOtomatik(h, S.c);
    ['ekmek', 'et', 'yag'].forEach(function (k) { S.c[k] = r.c[k]; });
    save(); paintTab(); paintMenu();
    $('#dg-adim').innerHTML = r.adim.map(function (a) { return '<li>' + X(a) + '</li>'; }).join('');
  });
  $('#dg-sil').addEventListener('click', function () { S.c = {}; S.o = {}; save(); $('#dg-adim').innerHTML = ''; paintTab(); paintMenu(); });
  $('#dg-tabak').addEventListener('click', function () { C.setTab('tabak'); });

  if (C.tab && C.tab() === 'degisim') paint();
})();
