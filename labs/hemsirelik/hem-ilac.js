/* ==========================================================================
   ACADEX HEMŞİRELİK LAB · İLAÇ UYGULAMA (labs/hemsirelik/hem-ilac.js)
   İki görünüm: “Doğru ilkeleri” (hekim istemi, hazırlanan ilaç ve bileklik
   karşılaştırılır, ihlal edilen doğrular seçilir) ve “Hız hesabı” (damla/dk
   ve pompa ml/saat; pompa tuş takımıyla programlanır, damla odası canlı akar).
   ========================================================================== */
(function () {
  'use strict';
  var HM = window.HM, C = HM.core, V = C.V, $ = C.$, X = C.X;
  var el = function () { return $('#ilac'); };
  var SIRA = C.shuffle(V.UYG, C.rng(7));
  var S = { mod: 'dogru', i: 0, sec: {}, bitti: false, skor: C.ls.get('iu.skor', {}), hz: null };
  var yeniHiz = function () { var r = C.rng(Date.now() % 77777); S.hz = { L: [0, 1, 2, 3].map(function () { return V.hizProblem(r); }), i: 0, cev: [], giris: '' }; };
  yeniHiz();
  var belge = function (u) {
    return '<div class="iu"><div class="belge"><span class="k">hekim istemi</span><h4>' + X(u.istem[0]) + '</h4><dl><dt>Doz</dt><dd>' + X(u.istem[1]) + '</dd><dt>Yol</dt><dd>' + X(u.istem[2]) + '</dd><dt>Saat</dt><dd>' + X(u.istem[3]) + '</dd><dt>Hasta</dt><dd>' + X(u.bileklik.ad) + ' · ' + u.bileklik.no + '</dd></dl>' + (u.id === 'u5' ? '<p class="sub" style="margin:6px 0 0">Kayıt: son doz 00:00’da verildi.</p>' : '') + '</div>' +
      '<div class="belge"><span class="k">hazırlanan ilaç · kart</span><h4>' + X(u.hazir[0]) + '</h4><dl><dt>Doz</dt><dd>' + X(u.hazir[1]) + '</dd><dt>Yol</dt><dd>' + X(u.hazir[2]) + '</dd><dt>Saat</dt><dd>' + X(u.hazir[3]) + '</dd><dt>Hasta</dt><dd>' + X(u.hasta.ad) + ' · ' + u.hasta.no + '</dd></dl></div>' +
      '<div class="belge bileklik"><span class="k">hasta bilekliği</span><h4>' + X(u.bileklik.ad) + '</h4><dl><dt>Doğum</dt><dd>' + u.bileklik.dt + '</dd><dt>Protokol</dt><dd>' + u.bileklik.no + '</dd></dl>' + (u.alerji !== 'Yok' ? '<span class="alerji">ALERJİ: ' + X(u.alerji) + '</span>' : '<span class="sub">Alerji: bilinen yok</span>') + '</div></div>';
  };
  var puan = function (u, sec) {
    var s = Object.keys(sec).filter(function (k) { return sec[k]; }), d = u.hata;
    var kes = s.filter(function (x) { return d.indexOf(x) >= 0; }).length, bir = s.concat(d.filter(function (x) { return s.indexOf(x) < 0; })).length;
    return bir ? kes / bir : 0;
  };
  var dogruHTML = function () {
    if (S.i >= SIRA.length) {
      var top = 0; SIRA.forEach(function (u) { top += S.skor[u.id] || 0; }); var pct = Math.round(top / SIRA.length * 100);
      return '<div class="card" style="max-width:760px">' + C.karne(pct, 'Doğru ilkeleri karnesi', SIRA.map(function (u) { return [(S.skor[u.id] || 0) >= 0.99, X(u.istem[0]) + ': ' + u.hata.map(function (h) { return V.DOGRU.filter(function (d) { return d[0] === h; })[0][1]; }).join(', ')]; }), 'Uygulamadan önce üç kez kontrol: ilacı dolaptan alırken, hazırlarken ve hastanın yanında; her seferinde iki tanımlayıcıyla.') + '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-yeniden>Yeniden başla</button></div></div>';
    }
    var u = SIRA[S.i], h = '<span class="k">uygulama ' + (S.i + 1) + '/' + SIRA.length + '</span>' + belge(u) + '<div class="card"><div class="q">Hangi doğru(lar) ihlal ediliyor? <span class="sub">(birden çok olabilir)</span></div><div class="chk">';
    h += V.DOGRU.map(function (d) { var on = !!S.sec[d[0]], cls = S.bitti ? (u.hata.indexOf(d[0]) >= 0 ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<label class="' + cls + '"><input type="checkbox" data-dg="' + d[0] + '"' + (on ? ' checked' : '') + (S.bitti ? ' disabled' : '') + '>' + X(d[1]) + '</label>'; }).join('') + '</div>';
    if (!S.bitti) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-kontrol>Kontrol et</button></div>';
    else { var p = puan(u, S.sec); h += '<div class="find ' + (p >= 0.99 ? 'ok' : 'no') + '" style="margin-top:12px"><b>' + (p >= 0.99 ? 'Doğru.' : 'Eksik ya da fazla seçim.') + '</b> ' + X(u.neden) + '</div><div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-ileri>' + (S.i < SIRA.length - 1 ? 'Sonraki uygulama →' : 'Karneyi gör') + '</button></div>'; }
    return h + '</div>';
  };
  var damla = function (gtt) {
    var hz = Math.max(0.15, Math.min(3, 60 / Math.max(1, gtt)));
    return '<svg class="damla" viewBox="0 0 120 200" width="120" height="200" role="img" aria-label="Damla odası: dakikada ' + gtt + ' damla"><rect x="40" y="8" width="40" height="30" rx="6" fill="#E7F0FC" stroke="#0D1838" stroke-width="2"/><path d="M48 38 h24 l-4 14 h-16z" fill="#fff" stroke="#0D1838" stroke-width="2"/><rect x="44" y="52" width="32" height="70" rx="10" fill="#F4FAFD" stroke="#0D1838" stroke-width="2"/><rect x="46" y="98" width="28" height="22" rx="8" fill="#CFE8F5"/>' +
      (gtt ? '<circle class="dm" style="--dh:' + hz.toFixed(2) + 's" cx="60" cy="58" r="4" fill="#5C8FD0"/>' : '') + '<path d="M60 122 V196" stroke="#0D1838" stroke-width="3"/></svg>';
  };
  var hizHTML = function () {
    var T = S.hz;
    if (T.i >= T.L.length) {
      var d = T.cev.filter(function (c) { return c.ok; }).length, pct = Math.round(d / T.L.length * 100);
      return '<div class="card" style="max-width:760px">' + C.karne(pct, 'Hız hesabı karnesi', T.L.map(function (q, i) { return [T.cev[i].ok, X(q.metin.split('.')[0]) + ' → ' + q.cevap + ' ' + q.birim]; }), 'Gravite setinde damla faktörünü set ambalajından oku; pompada hem hızı hem verilecek toplam hacmi (VTBI) gir.') + '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-yenihiz>Yeni seri</button></div></div>';
    }
    var q = T.L[T.i], c = T.cev[T.i], pompa = q.tip === 'pompa', g = c ? c.x : parseFloat(String(T.giris).replace(',', '.')) || 0;
    var h = '<div class="seri" aria-hidden="true">' + T.L.map(function (x, i) { return '<i class="' + (T.cev[i] ? (T.cev[i].ok ? 'ok' : 'no') : i === T.i ? 'on' : '') + '"></i>'; }).join('') + '</div><div class="pompa"><div class="card"><span class="k">soru ' + (T.i + 1) + '/' + T.L.length + '</span><p style="font-size:16px;line-height:1.55">' + X(q.metin) + '</p>';
    if (!pompa) h += '<label class="q" for="hz-in">Dakikada damla</label><div class="row"><input id="hz-in" inputmode="numeric" value="' + X(T.giris) + '" style="width:120px;min-height:48px;border:2px solid var(--ink);border-radius:12px;padding:0 12px;font-family:JetBrains Mono,monospace;font-size:20px;font-weight:700"' + (c ? ' disabled' : '') + '><span class="mono">damla/dk</span>' + (c ? '' : '<button type="button" class="btn pri" data-hzk>Kontrol et</button>') + '</div>';
    else h += '<p class="sub">Sağdaki pompanın tuşlarıyla hızı gir, sonra ✓ ile başlat.</p>';
    if (c) h += '<div class="find ' + (c.ok ? 'ok' : 'no') + '" style="margin-top:12px"><b>' + (c.ok ? 'Doğru.' : 'Doğrusu ' + q.cevap + ' ' + q.birim + '.') + '</b></div><ol class="cozum" style="margin:10px 0 0;padding-left:20px">' + q.cozum.map(function (x) { return '<li class="mono" style="font-size:13px">' + X(x) + '</li>'; }).join('') + '</ol><div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-hzi>' + (T.i < T.L.length - 1 ? 'Sonraki →' : 'Karneyi gör') + '</button></div>';
    h += '</div><div class="card" style="text-align:center">';
    if (pompa) h += '<div class="pompa-g"><div class="ekr"><span class="mono" style="font-size:11px;color:#9FB6D0">HIZ ml/saat · VTBI ' + q.ml + ' ml</span><b>' + X(c ? String(c.x).replace('.', ',') : (T.giris || '0')) + '</b></div><div class="tus" role="group" aria-label="Pompa tuşları">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map(function (k) { return '<button type="button" data-tus="' + k + '"' + (c ? ' disabled' : '') + (k === '⌫' ? ' class="sil" aria-label="Sil"' : '') + '>' + k + '</button>'; }).join('') + '<button type="button" class="ok" data-tus="ok" style="grid-column:1/-1"' + (c ? ' disabled' : '') + '>✓ Başlat</button></div></div>';
    else h += '<span class="k">damla odası</span>' + damla(Math.round(g)) + '<p class="sub">' + (g ? 'Dakikada ' + Math.round(g) + ' damla akıyor.' : 'Hızı yazınca damla akmaya başlar.') + '</p>';
    return h + '</div></div>';
  };
  var paint = function () {
    var h = '<div class="bas"><div><span class="k">ilaç uygulama</span><h1>' + (S.mod === 'dogru' ? 'Uygulamadan önce kontrol' : 'Damla ve pompa hızı') + '</h1><p>' + (S.mod === 'dogru' ? 'Hekim istemi, hazırlanan ilaç ve hastanın bilekliğini karşılaştır. Bir uygulamada birden çok hata olabilir; hiç olmayabilir de.' : 'Gravite setinde dakikadaki damlayı, pompada saatlik hızı hesapla.') + '</p></div>' +
      '<div class="seg" role="group" aria-label="Görünüm">' + [['dogru', 'Doğru ilkeleri'], ['hiz', 'Hız hesabı']].map(function (o) { return '<button type="button" data-mod="' + o[0] + '" aria-pressed="' + (S.mod === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    el().innerHTML = h + (S.mod === 'dogru' ? dogruHTML() : hizHTML());
  };
  var hzCevap = function (x) { var T = S.hz, q = T.L[T.i]; T.cev[T.i] = { x: x, ok: Math.abs(x - q.cevap) <= q.tol + 1e-9 }; paint(); HM.bridgeSend(); };
  HM.st.ilac = {
    init: function () {
      paint();
      el().addEventListener('change', function (e) { var d = e.target.getAttribute('data-dg'); if (d) { S.sec[d] = e.target.checked; if (d === 'yok' && e.target.checked) { Object.keys(S.sec).forEach(function (k) { if (k !== 'yok') S.sec[k] = false; }); paint(); } else if (d !== 'yok' && e.target.checked && S.sec.yok) { S.sec.yok = false; paint(); } } });
      el().addEventListener('input', function (e) { if (e.target.id === 'hz-in') { S.hz.giris = e.target.value; } });
      el().addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-mod]'))) { S.mod = b.getAttribute('data-mod'); paint(); HM.bridgeSend(); return; }
        if (e.target.closest('[data-kontrol]')) { if (!Object.keys(S.sec).some(function (k) { return S.sec[k]; })) { C.toast('En az bir seçim yap.'); return; } S.bitti = true; S.skor[SIRA[S.i].id] = puan(SIRA[S.i], S.sec); C.ls.set('iu.skor', S.skor); paint(); return; }
        if (e.target.closest('[data-ileri]')) { S.i++; S.sec = {}; S.bitti = false; paint(); return; }
        if (e.target.closest('[data-yeniden]')) { S.i = 0; S.sec = {}; S.bitti = false; paint(); return; }
        if (e.target.closest('[data-hzk]')) { var x = parseFloat(String(S.hz.giris).replace(',', '.')); if (isNaN(x)) { C.toast('Bir sayı yaz.'); return; } hzCevap(x); return; }
        if ((b = e.target.closest('[data-tus]'))) { var k = b.getAttribute('data-tus'), T = S.hz; if (k === 'ok') { var y = parseFloat(String(T.giris).replace(',', '.')); if (isNaN(y)) { C.toast('Önce hızı gir.'); return; } hzCevap(y); return; } if (k === '⌫') T.giris = T.giris.slice(0, -1); else if (T.giris.length < 6) T.giris += k; paint(); return; }
        if (e.target.closest('[data-hzi]')) { S.hz.i++; S.hz.giris = ''; paint(); return; }
        if (e.target.closest('[data-yenihiz]')) { yeniHiz(); paint(); }
      });
      el().addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'hz-in') { var b = el().querySelector('[data-hzk]'); if (b) b.click(); } });
    },
    ctx: function () {
      if (S.mod === 'dogru' && SIRA[S.i]) { var u = SIRA[S.i]; return { sel: { key: 'hem.ilac.' + u.id, title: 'İlaç uygulama · ' + u.istem[0], la: 'İlaç uygulama', rows: [['İstem', u.istem.join(' · ')], ['Hazırlanan', u.hazir.join(' · ')], ['Alerji', u.alerji]], about: 'öğrenci Hemşirelik Lab ilaç uygulama istasyonunda doğru ilkelerini kontrol ediyor. Hatayı doğrudan söyleme; satır satır karşılaştırmasını sağla.' }, chips: [['dogrular', 'İlaç uygulamanın doğruları neler?']] }; }
      return { sel: { key: 'hem.ilac.hiz', title: 'Hız hesabı', la: 'İlaç uygulama', rows: [], about: 'öğrenci damla ve pompa hızı hesaplıyor.' }, chips: [['formul', 'Damla formülü nedir?']] };
    },
    classify: function (q) { if (/doğru|ilke/.test(q)) return 'dogrular'; if (/formül|damla|pompa/.test(q)) return 'formul'; return null; },
    answer: function (k) {
      if (k === 'formul') return 'Damla/dk = hacim (ml) × damla faktörü (gtt/ml) ÷ süre (dk). Standart sette faktör genellikle 20, mikro sette 60. Pompa hızı (ml/saat) = hacim ÷ saat.';
      return 'Temel doğrular: doğru hasta (iki tanımlayıcı), doğru ilaç, doğru doz, doğru yol, doğru zaman; ayrıca ilaç öyküsü ve alerji, doğru kayıt, hastanın bilgilendirilmesi ve ret hakkı, etkinin değerlendirilmesi.';
    }
  };
})();
