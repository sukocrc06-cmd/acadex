/* ==========================================================================
   ACADEX ECZACILIK LAB · DOZ HESAP MASASI (labs/eczacilik/ecz-doz.js)
   Beş soruluk seri: çocuk şurubu, tablet, kreatinin klirensi (Cockcroft-Gault),
   infüzyon hızı, sulandırma. Sayılar her seride yeniden üretilir; yanlışta
   adım adım çözüm gösterilir. Böbrek sorusunda ayrıca doz kararı istenir.
   ========================================================================== */
(function () {
  'use strict';
  var EC = window.EC, C = EC.core, V = C.V, $ = C.$, X = C.X;
  var el = function () { return $('#doz'); };
  var TIPLER = ['surup', 'tablet', 'crcl', 'infuzyon', 'sulandirma'];
  var S = { filtre: 'karisik', seri: [], i: 0, cev: [], sinif: null, gor: false, en: C.ls.get('doz.en', null) };
  var yeniSeri = function () {
    var r = C.rng(Date.now() % 100000);
    S.seri = (S.filtre === 'karisik' ? C.shuffle(TIPLER, r) : [0, 1, 2, 3, 4].map(function () { return S.filtre; })).map(function (t) { return V.problem(t, r); });
    S.i = 0; S.cev = []; S.sinif = null; S.gor = false;
  };
  yeniSeri();
  var p = function () { return S.seri[S.i]; };
  var gorsel = function (q, deger) {
    if (q.birim === 'ml') { var max = Math.max(10, Math.ceil(q.cevap / 5) * 5 + 5), h = Math.min(100, (deger || 0) / max * 100); var cz = ''; for (var i = 1; i < 5; i++) cz += '<b style="bottom:' + (i * 20) + '%"></b>'; return '<div class="siv" role="img" aria-label="Ölçek: ' + C.tr(deger || 0, 1) + ' ml"><i style="height:' + h + '%"></i>' + cz + '</div><p class="sub" style="text-align:center;margin:6px 0 0">ölçek: 0–' + max + ' ml</p>'; }
    if (q.birim === 'ml/dk') { var v = Math.min(120, deger || 0), a = Math.PI * (1 - v / 120), x = 110 + 80 * Math.cos(a), y = 110 - 80 * Math.sin(a);
      return '<svg viewBox="0 0 220 130" role="img" aria-label="Kreatinin klirensi göstergesi"><path d="M30 110 A80 80 0 0 1 70 41" stroke="#C9483B" stroke-width="14" fill="none"/><path d="M70 41 A80 80 0 0 1 110 30" stroke="#E8A93A" stroke-width="14" fill="none"/><path d="M110 30 A80 80 0 0 1 190 110" stroke="#2E8E5B" stroke-width="14" fill="none"/><line x1="110" y1="110" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#0D1838" stroke-width="4" stroke-linecap="round"/><circle cx="110" cy="110" r="7" fill="#0D1838"/><text x="22" y="128" font-size="10" font-family="JetBrains Mono">0</text><text x="62" y="30" font-size="10" font-family="JetBrains Mono">30</text><text x="104" y="20" font-size="10" font-family="JetBrains Mono">50</text><text x="186" y="128" font-size="10" font-family="JetBrains Mono">120</text></svg>'; }
    if (q.birim === 'ml/saat') return '<svg viewBox="0 0 220 130" role="img" aria-label="İnfüzyon pompası ekranı"><rect x="10" y="10" width="200" height="110" rx="14" fill="#2E3A5C"/><rect x="24" y="24" width="172" height="58" rx="6" fill="#0B1222"/><text x="110" y="64" text-anchor="middle" font-family="JetBrains Mono" font-size="26" font-weight="700" fill="#7FE0C2">' + C.tr(deger || 0, 1) + '</text><text x="186" y="78" text-anchor="end" font-family="JetBrains Mono" font-size="9" fill="#7FE0C2">ml/saat</text><circle cx="50" cy="100" r="9" fill="#2E8E5B"/><circle cx="80" cy="100" r="9" fill="#C9483B"/><rect x="120" y="92" width="70" height="16" rx="4" fill="#46506A"/></svg>';
    var n = Math.min(4, deger || 0), s = '<svg viewBox="0 0 220 90" role="img" aria-label="' + C.tr(deger || 0, 1) + ' tablet">';
    for (var k = 0; k < 4; k++) { var dol = Math.max(0, Math.min(1, n - k)); s += '<g transform="translate(' + (20 + k * 50) + ' 45)"><circle r="20" fill="#fff" stroke="#0D1838" stroke-width="2.5"/>' + (dol > 0 ? (dol >= 1 ? '<circle r="18" fill="#D9C9F2"/>' : '<path d="M0 -18 A18 18 0 0 0 0 18 Z" fill="#D9C9F2"/>') : '') + '<path d="M0 -20 V20" stroke="#0D1838" stroke-width="1.4" opacity=".4"/></g>'; }
    return s + '</svg>';
  };
  var paint = function () {
    var q = p(), cv = S.cev[S.i], bitti = S.i >= S.seri.length, h = '';
    h += '<div class="bas"><div><span class="k">doz hesap masası</span><h1>Hesapla, sonra ölç</h1><p>Her soruda hekim istemi ya da prospektüs bilgisi verilir. Sonucu yaz; yanlışsa adım adım çözümü gör. Sayılar her seride değişir.</p></div>' +
      '<div class="seg" role="group" aria-label="Soru türü">' + [['karisik', 'Karışık']].concat(TIPLER.map(function (t) { return [t, V.DOZ_TIP[t].split(' (')[0].split(':')[0]]; })).map(function (o) { return '<button type="button" data-filtre="' + o[0] + '" aria-pressed="' + (S.filtre === o[0]) + '">' + X(o[1]) + '</button>'; }).join('') + '</div></div>';
    h += '<div class="seri" aria-hidden="true">' + S.seri.map(function (x, i) { var c = S.cev[i]; return '<i class="' + (c ? (c.ok ? 'ok' : 'no') : i === S.i ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    if (bitti) {
      var d = S.cev.filter(function (c) { return c.ok; }).length, pct = Math.round(d / S.seri.length * 100);
      if (S.en == null || pct > S.en) { S.en = pct; C.ls.set('doz.en', pct); }
      h += '<div class="card" style="max-width:760px">' + C.karne(pct, 'Doz serisi karnesi', S.seri.map(function (x, i) { return [S.cev[i].ok, X(V.DOZ_TIP[x.tip]) + ': ' + (S.cev[i].ok ? 'doğru' : 'doğrusu ' + C.tr(x.cevap, x.birim === 'tablet' || x.birim === 'ml/dk' ? (x.cevap % 1 ? 1 : 0) : 1) + ' ' + x.birim)]; }), 'En iyi serin: %' + S.en + '. Birimleri her adımda yazmak (mg → ml, mcg → mg) hataların çoğunu önler.') +
        '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-yeni>Yeni seri</button></div></div>';
      el().innerHTML = h; return;
    }
    h += '<div class="dz"><div class="card"><span class="k">soru ' + (S.i + 1) + '/' + S.seri.length + ' · ' + X(V.DOZ_TIP[q.tip]) + '</span><p style="font-size:16px;line-height:1.55;margin:8px 0 0">' + X(q.metin) + '</p>' +
      '<div class="dz-veri">' + q.veri.map(function (v) { return '<div><span>' + X(v[0]) + '</span><b>' + X(v[1]) + '</b></div>'; }).join('') + '</div>' +
      '<label class="q" for="dz-in">Cevabın</label><div class="cevap"><input id="dz-in" inputmode="decimal" autocomplete="off" value="' + (cv ? X(String(cv.x).replace('.', ',')) : '') + '"' + (cv ? ' disabled' : '') + '><span class="br">' + X(q.birim) + '</span>' + (cv ? '' : '<button type="button" class="btn pri" data-kontrol>Kontrol et</button>') + '</div>';
    if (q.tip === 'crcl' && cv) h += '<div class="q">Bu klirenste doz kararı?</div><div class="seg" role="group" aria-label="Doz kararı">' + [['normal', 'Normal doz'], ['yari', 'Doz yarıya'], ['yok', 'Kullanılmaz']].map(function (o) { return '<button type="button" data-sinif="' + o[0] + '" aria-pressed="' + (S.sinif === o[0]) + '"' + (S.sinif ? ' disabled' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>' + (S.sinif ? '<div class="find ' + (S.sinif === q.sinif ? 'ok' : 'no') + '" style="margin-top:8px">' + (S.sinif === q.sinif ? 'Doğru karar.' : 'Doğrusu: ' + { normal: 'normal doz', yari: 'doz yarıya', yok: 'kullanılmaz' }[q.sinif] + '.') + '</div>' : '');
    if (cv) {
      h += '<div class="find ' + (cv.ok ? 'ok' : 'no') + '" style="margin-top:12px">' + (cv.ok ? '<b>Doğru!</b> ' : '<b>Olmadı.</b> Doğru cevap ' + C.tr(q.cevap, q.cevap % 1 ? 1 : 0) + ' ' + X(q.birim) + '. ') + (cv.ok ? 'Adımlar:' : 'Adım adım:') + '</div><ol class="cozum">' + q.cozum.map(function (c) { return '<li>' + X(c) + '</li>'; }).join('') + '</ol>';
      if (q.tip !== 'crcl' || S.sinif) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-ileri>' + (S.i < S.seri.length - 1 ? 'Sonraki soru →' : 'Karneyi gör') + '</button></div>';
    }
    h += '</div><div class="card" style="text-align:center"><span class="k">ölçüm</span><div style="margin-top:10px">' + gorsel(q, cv ? cv.x : 0) + '</div><p class="sub" style="margin:10px 0 0">' + (cv ? (cv.ok ? 'Ölçü hazır.' : 'Doğru değer: ' + C.tr(q.cevap, q.cevap % 1 ? 1 : 0) + ' ' + X(q.birim)) : 'Cevabını yazınca burada ölçülür.') + '</p></div></div>';
    el().innerHTML = h;
  };
  EC.st.doz = {
    init: function () {
      paint();
      el().addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-filtre]'))) { S.filtre = b.getAttribute('data-filtre'); yeniSeri(); paint(); return; }
        if (e.target.closest('[data-yeni]')) { yeniSeri(); paint(); return; }
        if (e.target.closest('[data-kontrol]')) {
          var x = parseFloat(String($('#dz-in').value).replace(',', '.'));
          if (isNaN(x)) { C.toast('Bir sayı yaz (ondalık için virgül kullanabilirsin).'); return; }
          var ok = V.dogruMu(p(), x); S.cev[S.i] = { x: x, ok: ok };
          paint(); C.live(ok ? 'Doğru' : 'Yanlış; çözüm gösterildi'); EC.bridgeSend(); return;
        }
        if ((b = e.target.closest('[data-sinif]'))) { S.sinif = b.getAttribute('data-sinif'); if (S.sinif !== p().sinif) S.cev[S.i].ok = false; paint(); return; }
        if (e.target.closest('[data-ileri]')) { S.i++; S.sinif = null; paint(); var i = $('#dz-in'); if (i) i.focus(); EC.bridgeSend(); }
      });
      el().addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'dz-in') { var b = el().querySelector('[data-kontrol]'); if (b) b.click(); } });
    },
    ctx: function () {
      var q = p(); if (!q) return null;
      return { sel: { key: 'ecz.doz.' + S.i, title: 'Doz sorusu · ' + V.DOZ_TIP[q.tip], la: 'Doz hesap masası', rows: q.veri.map(function (v) { return [v[0], String(v[1])]; }), about: 'öğrenci Eczacılık Lab doz masasında hesap yapıyor. Cevabı doğrudan verme; birimleri dönüştürmesini ve formülü kurmasını sağla.' }, chips: [['formul', 'Hangi formülü kullanmalıyım?'], ['birim', 'Birimleri nasıl çeviririm?']] };
    },
    classify: function (q) { if (/formül|formul/.test(q)) return 'formul'; if (/birim|çevir/.test(q)) return 'birim'; return null; },
    answer: function (k) {
      var q = p(); if (!q) return null;
      if (k === 'birim') return '1 g = 1000 mg, 1 mg = 1000 mcg. Şurupta “mg/5 ml” verilir: önce 1 ml’deki mg’ı bul (÷5). Dakikalık dozu saatliğe çevirmek için ×60.';
      return { surup: 'Doz (mg) = kilo × mg/kg; hacim (ml) = doz ÷ (mg/ml).', tablet: 'Tablet = istenen doz ÷ tablet gücü.', crcl: 'Cockcroft-Gault: (140 − yaş) × kilo ÷ (72 × kreatinin); kadında × 0,85.', infuzyon: 'Saatlik doz (mg/saat) = mcg/kg/dk × kilo × 60 ÷ 1000; hız = saatlik doz ÷ konsantrasyon (mg/ml).', sulandirma: 'Konsantrasyon = flakon mg ÷ son hacim; çekilecek hacim = istem ÷ konsantrasyon.' }[q.tip];
    }
  };
})();
