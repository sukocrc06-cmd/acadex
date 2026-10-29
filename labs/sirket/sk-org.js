/* ==========================================================================
   ACADEX ŞİRKET · ORGANİZASYON (labs/sirket/sk-org.js), 29.10.2026
   Şirket türleri (6102 sayılı TTK; asgari sermaye 1 Ocak 2024'ten beri
   A.Ş. 250.000 TL, Ltd. 50.000 TL), örgüt yapıları (fonksiyonel, bölümsel,
   matris) ve kontrol alanı: çalışan sayısı ile yönetici başına kişi
   değişince kademe ve yönetici sayısı nasıl değişir?
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, SK = FN.sk, V = SK.V, M = SK.M, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf;
  var S = C.ls.get('sk.og', null) || { t: 'tur', yp: 'fonk', n: 240, s: 6 };
  var save = function () { C.ls.set('sk.og', S); };
  var sec, body;

  var tur = function () {
    var ad = {}; V.TUR.forEach(function (t) { ad[t.k] = t.ad; });
    body.innerHTML = '<div class="grid g2"><div><div class="tur">' + V.TUR.map(function (t) { return '<div class="tur-c"><b>' + X(t.ad) + '</b><p>' + X(t.s) + '</p></div>'; }).join('') + '</div>' +
      '<p class="sub" style="margin-top:10px">Kaynak: 6102 sayılı Türk Ticaret Kanunu; asgari sermaye tutarları 7887 sayılı Cumhurbaşkanı Kararı (1 Ocak 2024).</p></div>' +
      '<div><h3>Hangi şirket türü?</h3><div data-qz></div></div></div>';
    var keys = V.TUR.map(function (t) { return t.k; });
    SK.quiz($('[data-qz]', body), V.TUR_SORU.map(function (q) {
      return { q: X(q[0]), o: keys.map(function (k) { return ad[k]; }), a: keys.indexOf(q[1]), n: X(V.TUR.filter(function (t) { return t.k === q[1]; })[0].s) };
    }), 'Şirket türleri');
  };

  var chart = function (k) {
    var box = function (x, y, w, t, c) { return '<g><rect x="' + x + '" y="' + y + '" width="' + w + '" height="34" rx="8" fill="' + (c || '#fff') + '" stroke="#0D1838" stroke-width="2"/><text x="' + (x + w / 2) + '" y="' + (y + 22) + '" text-anchor="middle" font-size="12" font-weight="700">' + X(t) + '</text></g>'; };
    var ln = function (x1, y1, x2, y2, d) { return '<path d="M' + x1 + ' ' + y1 + 'V' + ((y1 + y2) / 2) + 'H' + x2 + 'V' + y2 + '" fill="none" stroke="#0D1838" stroke-width="1.6"' + (d ? ' stroke-dasharray="5 4"' : '') + '/>'; };
    var g = '<svg viewBox="0 0 560 230" class="orgc" role="img" aria-label="örgüt şeması">' + box(220, 10, 120, 'Genel müdür', '#FFD86B');
    var kids = k === 'fonk' ? ['Üretim', 'Pazarlama', 'Finans', 'İK'] : k === 'urun' ? ['Termos', 'Yedek parça', 'Tekstil'] : k === 'cog' ? ['Türkiye', 'Avrupa', 'Orta Doğu'] : ['Üretim', 'Ar-Ge', 'Finans'];
    var w = 520 / kids.length;
    kids.forEach(function (t, i) {
      var x = 20 + i * w + (w - 110) / 2; g += ln(280, 44, x + 55, 90) + box(x, 90, 110, t, k === 'urun' || k === 'cog' ? '#DDF2EE' : '#EAF3FA');
      if (k === 'urun' || k === 'cog') { g += ln(x + 55, 124, x + 55, 160) + '<text x="' + (x + 55) + '" y="180" text-anchor="middle" font-size="10.5" fill="#46506A">üretim · satış · finans</text>'; }
    });
    if (k === 'matris') {
      ['Proje A', 'Proje B'].forEach(function (p, j) {
        var y = 150 + j * 38; g += '<rect x="20" y="' + y + '" width="520" height="28" rx="6" fill="rgba(200,85,61,.08)" stroke="#C8553D" stroke-dasharray="5 4"/><text x="532" y="' + (y + 18) + '" text-anchor="end" font-size="11.5" font-weight="700" fill="#C8553D">' + p + ' yöneticisi</text>';
        kids.forEach(function (t, i) { var x = 20 + i * w + w / 2 - 30; g += '<circle cx="' + x + '" cy="' + (y + 14) + '" r="6" fill="#C8553D"/>'; });
      });
    }
    return g + '</svg>';
  };
  var yapi = function () {
    var y = V.YAPI.filter(function (x) { return x.k === S.yp; })[0];
    body.innerHTML = '<div class="grid g2"><div><div class="seg" data-yp style="margin-bottom:10px">' + V.YAPI.map(function (x) { return '<button type="button" data-y="' + x.k + '" aria-pressed="' + (x.k === S.yp) + '">' + X(x.ad) + '</button>'; }).join('') + '</div>' +
      chart(S.yp) + '<p class="sub">' + X(y.s) + '</p></div><div><h3>Bu şirkete hangi yapı?</h3><div data-qz></div></div></div>';
    $$('[data-y]', body).forEach(function (b) { b.onclick = function () { S.yp = b.getAttribute('data-y'); save(); yapi(); FN.bridgeSend(); }; });
    var keys = V.YAPI.map(function (x) { return x.k; });
    SK.quiz($('[data-qz]', body), V.YAPI_SORU.map(function (q) { var t = V.YAPI.filter(function (x) { return x.k === q[1]; })[0]; return { q: X(q[0]), o: V.YAPI.map(function (x) { return x.ad; }), a: keys.indexOf(q[1]), n: X(t.s) }; }), 'Örgüt yapıları');
  };

  var alanDraw = function () {
    var r = M.kademe(S.n, S.s), lv = r.seviye.slice().reverse().concat([S.n]);
    var W = 560, H = 20 + lv.length * 34, g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pyr" role="img" aria-label="kademe piramidi">';
    lv.forEach(function (c, i) {
      var w = Math.max(40, Math.min(520, 40 + Math.log(c + 1) / Math.log(S.n + 1) * 480)), x = (W - w) / 2, y = 10 + i * 34;
      g += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="28" rx="5" fill="' + (i === lv.length - 1 ? '#DDF2EE' : i === 0 ? '#FFD86B' : '#EAF3FA') + '" stroke="#0D1838" stroke-width="1.6"/>' +
        '<text x="' + (W / 2) + '" y="' + (y + 19) + '" text-anchor="middle" font-size="12" font-weight="700">' + (i === lv.length - 1 ? nf(c) + ' çalışan' : nf(c) + ' yönetici') + '</text>';
    });
    $('[data-al-g]', body).innerHTML = g + '</svg>';
    $('[data-al-k]', body).innerHTML = '<div class="kpis"><div class="kpi hl"><small>yönetim kademesi</small><b>' + r.kademe + '</b></div><div class="kpi"><small>yönetici sayısı</small><b>' + nf(r.yonetici) + '</b></div><div class="kpi"><small>yönetici oranı</small><b>' + C.pct(r.yonetici / (S.n + r.yonetici)) + '</b></div></div>' +
      SK.tip(S.s <= 4 ? 'Dar kontrol alanı: ' + r.kademe + ' kademe. Bilgi tepeye ulaşana kadar yavaşlar, yönetim maliyeti artar.' : S.s >= 12 ? 'Çok geniş kontrol alanı: basık yapı, hızlı karar; ama ' + S.s + ' kişiyi tek yönetici izlemekte zorlanabilir. Rutin işlerde uygun.' : 'Dengeli bir alan: ' + r.kademe + ' kademede ' + nf(r.yonetici) + ' yönetici.', r.kademe + ' kad');
    $('[data-no]', body).textContent = nf(S.n); $('[data-so]', body).textContent = S.s;
  };
  var alan = function () {
    body.innerHTML = '<div class="grid g2"><div><p class="sub"><b>Kontrol alanı</b>: bir yöneticiye doğrudan bağlı kişi sayısı. Dar alan sıkı denetim ama çok kademe ve çok yönetici demek; geniş alan basık, hızlı ama yöneticiye yük.</p>' +
      '<label class="sl"><span>çalışan</span><input type="range" min="30" max="2000" step="10" data-n value="' + S.n + '"><output data-no></output></label>' +
      '<label class="sl"><span>kontrol alanı</span><input type="range" min="3" max="15" step="1" data-s value="' + S.s + '"><output data-so></output></label><div data-al-k></div></div><div data-al-g></div></div>';
    $('[data-n]', body).oninput = function () { S.n = +this.value; save(); alanDraw(); FN.bridgeSend(); };
    $('[data-s]', body).oninput = function () { S.s = +this.value; save(); alanDraw(); FN.bridgeSend(); };
    alanDraw();
  };
  var show = function (t) { S.t = t; save(); (t === 'yapi' ? yapi : t === 'alan' ? alan : tur)(); FN.bridgeSend(); };
  FN.st.org = {
    init: function () {
      sec = $('#org');
      sec.innerHTML = '<div class="card box" style="--cc:var(--teal)"><span class="k">istasyon · organizasyon</span><h2>Şirketi kur, yapısını çiz</h2><div class="seg" data-tabs style="margin:8px 0 12px"></div><div data-body></div></div>';
      body = $('[data-body]', sec);
      SK.seg($('[data-tabs]', sec), [['tur', 'Şirket türleri'], ['yapi', 'Örgüt yapısı'], ['alan', 'Kontrol alanı']], S.t, show);
      show(S.t);
    },
    ctx: function () {
      var r = M.kademe(S.n, S.s);
      return { sel: { key: 'sirket.org.' + S.t, title: S.t === 'tur' ? 'şirket türleri' : S.t === 'yapi' ? 'örgüt yapısı' : 'kontrol alanı',
        rows: S.t === 'alan' ? [['çalışan', nf(S.n)], ['kontrol alanı', String(S.s)], ['kademe', String(r.kademe)], ['yönetici', nf(r.yonetici)]] : S.t === 'yapi' ? [['seçili yapı', S.yp]] : [['A.Ş. asgari sermaye', '250.000 TL'], ['Ltd. asgari sermaye', '50.000 TL']],
        about: 'öğrenci şirket türlerini (TTK), örgüt yapılarını ve kontrol alanını çalışıyor.' },
        chips: ['Limited ile anonim şirket farkı ne?', 'Matris yapının riski ne?', 'Kontrol alanı neye göre seçilir?'] };
    }
  };
})();
