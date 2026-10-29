/* ==========================================================================
   ACADEX ŞİRKET · ŞİRKETİ YÖNET (labs/sirket/sk-sim.js), 29.10.2026
   Mavi Liman A.Ş.'nin genel müdürüsün: 8 çeyrek. Her çeyrek fiyat, üretim,
   vade, pazarlama, personel ve kredi kararı ver; yönetim kurulunun gündem
   maddesini (CFO, COO, CMO görüşleriyle) karara bağla. Çeyrek kapanınca
   gelir tablosu, bilanço (aktif = pasif) ve nakit akışı güncellenir; kule
   katları uyarı verir. Sonunda yönetim karnesi. Model: sk-model.js (SKM.ceyrek).
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, SK = FN.sk, V = SK.V, M = SK.M, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, pct = C.pct;
  var CF = V.SIM, sec;
  var fresh = function () { var s = M.simBas(CF); return { s: s, d: { fiyat: s.fiyat, uretim: null, vade: 30, pazarlama: 1500000, isci: 0, kredi: 0 }, g: null, son: null }; };
  var S = C.ls.get('sk.sim', null); if (!S || !S.s || S.s.q == null) S = fresh();
  var save = function () { C.ls.set('sk.sim', S); };
  var mn = SK.mn;
  var bitti = function () { return S.s.q > CF.ceyrek; };
  var preview = function () { var s2 = JSON.parse(JSON.stringify(S.s)); s2.isci = Math.max(20, s2.isci + (S.d.isci || 0)); var g = gfx(); if (g.hat) s2.hat += g.hat; return { kap: M.kapasite(s2, CF, g.grev), s2: s2 }; };
  var gfx = function () { var gd = V.GUNDEM[S.s.q - 1]; return gd && S.g != null ? gd.s[S.g].fx : {}; };
  var tahmin = function () { var a = M.cekim(S.s, CF, S.d.fiyat, S.d.vade, S.d.pazarlama), pay = a / (a + CF.rakipCekim); return Math.round(M.pazar(S.s, CF) * pay); };

  /* ---------- kule ---------- */
  var tower = function () {
    var r = S.son, s = S.s, al = {};
    if (r) {
      if (r.bil.acil > 0) al.fin = 'acil kredi!'; else if (r.oran.cari < 1.2) al.fin = 'cari oran düşük';
      if (r.op.kacan > 0) al.ure = nf(r.op.kacan) + ' sipariş kaçtı'; else if (s.stokAdet > r.op.satis * 0.4) al.ure = 'stok birikti';
      if (r.op.grev) al.ik = 'grev!';
      var pr = S.s.gecmis.length > 1 ? S.s.gecmis[S.s.gecmis.length - 2].op.pay : null; if (pr != null && r.op.pay < pr - 0.02) al.paz = 'pay düştü';
      if (r.gelirT.net < 0) al.yon = 'zarar ettik';
    }
    var lit = function (f) { var n = Math.round(C.clamp(f, 0, 1) * 4); return [0, 1, 2, 3].map(function (i) { return '<i' + (i < n ? ' class="on"' : '') + '></i>'; }).join(''); };
    var fl = [
      ['yon', 'Yönetim katı', 'gündem · strateji', '★', '#FFD86B', r ? C.clamp(0.5 + r.gelirT.net / 6e6, 0, 1) : 0.5],
      ['fin', 'Finans', 'kasa ' + mn(s.kasa), '₺', '#B5D4F4', r ? C.clamp(r.oran.cari / 3, 0, 1) : 0.6],
      ['ure', 'Üretim', s.hat + ' hat · ' + (r ? pct(r.op.kullanim, 0) + ' dolu' : 'kapasite'), '⚙', '#F6C8BC', r ? r.op.kullanim : 0.8],
      ['paz', 'Pazarlama', r ? 'pazar payı ' + pct(r.op.pay) : 'fiyat · talep', '📣', '#CDEBD8', r ? r.op.pay / 0.3 : 0.6],
      ['ik', 'İnsan kaynakları', s.isci + ' işçi', '☺', '#E2D9F5', C.clamp(s.isci / 160, 0, 1)]
    ];
    $('[data-tower]', sec).innerHTML = '<div class="tw-roof"></div><div class="tw-sign">' + X(V.SIRKET.toLocaleUpperCase('tr')) + '</div>' +
      fl.map(function (f) { return '<div class="tw-fl' + (al[f[0]] ? ' al' : '') + '"><span class="tw-ic" style="background:' + f[4] + '">' + f[3] + '</span><span class="tw-t"><b>' + f[1] + '</b><small>' + X(f[2]) + '</small></span><span class="tw-w">' + lit(f[5]) + '</span>' + (al[f[0]] ? '<em class="tw-al">' + X(al[f[0]]) + '</em>' : '') + '</div>'; }).join('') +
      '<div class="tw-base"><span class="mono">ÇEYREK ' + Math.min(S.s.q, CF.ceyrek) + ' / ' + CF.ceyrek + '</span></div>';
  };

  /* ---------- tablolar ---------- */
  var tables = function () {
    var r = S.son, s = S.s, box = $('[data-tab-r]', sec);
    var b = r ? r.bil : { kasa: s.kasa, alacak: s.alacak, stok: s.stokDeger, makine: s.makine, satici: s.satici, vergi: s.vergi, kredi: s.kredi, acil: s.acil, sermaye: s.sermaye, birikmis: s.birikmis };
    var A = b.kasa + b.alacak + b.stok + b.makine, P = b.satici + b.vergi + b.kredi + b.acil + b.sermaye + b.birikmis, H = 200;
    var blk = function (v, c, l) { var h = Math.max(0, v) / Math.max(A, P) * H; return h < 1 ? '' : '<span style="height:' + h.toFixed(1) + 'px;background:' + c + '" title="' + l + ' ' + mn(v) + '">' + (h > 16 ? l : '') + '</span>'; };
    box.innerHTML = '<h3>Bilanço <small class="mono">aktif ' + mn(A) + ' = pasif ' + mn(P) + '</small></h3><div class="sm-bil"><div>' +
      blk(b.makine, '#46506A', 'makine') + blk(b.stok, '#E0A526', 'stok') + blk(b.alacak, '#2F6FB0', 'alacak') + blk(b.kasa, '#1F8A7A', 'kasa') + '</div><div>' +
      blk(b.sermaye + b.birikmis, '#3E8E5B', 'özkaynak') + blk(b.kredi, '#B84A6B', 'kredi') + blk(b.acil, '#D9472B', 'acil kredi') + blk(b.satici + b.vergi, '#C8553D', 'KV borç') + '</div></div>' +
      (r ? '<h3>Gelir tablosu <small class="mono">ç' + r.q + '</small></h3>' + [['Satışlar', r.gelirT.sat], ['Satılan malın maliyeti', -r.gelirT.smm], ['Brüt kâr', r.gelirT.brut, 1], ['Genel yönetim + depo', -r.gelirT.genel], ['Pazarlama', -r.gelirT.pazarlama], ['Diğer (gündem, İK)', -r.gelirT.diger], ['Faaliyet kârı', r.gelirT.faal, 1], ['Faiz', -r.gelirT.faiz], ['Vergi (%25)', -r.gelirT.vergi], ['Net kâr', r.gelirT.net, 1]].map(function (x) {
        return '<div class="row2' + (x[2] ? ' t' : '') + '"><span>' + x[0] + '</span><b class="' + (x[1] < 0 ? 'dn' : '') + '">' + mn(x[1]) + '</b></div>'; }).join('') +
      '<h3>Nakit akışı</h3>' + [['İşletme', r.nakitT.isletme], ['Yatırım', r.nakitT.yatirim], ['Finansman', r.nakitT.finansman], ['Kasadaki değişim', r.nakitT.net, 1]].map(function (x) {
        return '<div class="row2' + (x[2] ? ' t' : '') + '"><span>' + x[0] + '</span><b class="' + (x[1] < 0 ? 'dn' : 'up') + '">' + SK.sgn(x[1], function (v) { return mn(v); }) + '</b></div>'; }).join('') +
      '<h3>Oranlar</h3><div class="row2"><span>Cari oran</span><b>' + (isFinite(r.oran.cari) ? nf(r.oran.cari, 2) : '∞') + '</b></div><div class="row2"><span>Borç / özkaynak</span><b>' + nf(r.oran.borcOz, 2) + '</b></div><div class="row2"><span>Net kâr marjı</span><b>' + pct(r.oran.marj) + '</b></div>'
        : '<p class="sub" style="margin-top:12px">İlk çeyreği kapatınca gelir tablosu ve nakit akışı burada belirir.</p>');
  };

  /* ---------- karar paneli ---------- */
  var gundem = function () {
    var gd = V.GUNDEM[S.s.q - 1], box = $('[data-gd]', sec);
    if (!gd) { box.innerHTML = ''; return; }
    box.innerHTML = '<span class="k">yönetim kurulu · gündem ' + S.s.q + '</span><h3>' + X(gd.t) + '</h3><p class="sub">' + X(gd.ac) + '</p><div class="gd-b">' +
      [['cfo', 'CFO', '#B5D4F4'], ['coo', 'COO', '#F6C8BC'], ['cmo', 'CMO', '#CDEBD8']].map(function (x) { return '<div class="gd-p"><span class="gd-av" style="background:' + x[2] + '">' + x[1] + '</span><p>' + X(gd.g[x[0]]) + '</p></div>'; }).join('') + '</div>' +
      '<div class="gd-o" role="group" aria-label="kurul kararı">' + gd.s.map(function (o, i) { return '<button type="button" data-g="' + i + '" aria-pressed="' + (S.g === i) + '">' + X(o.l) + '</button>'; }).join('') + '</div>';
    $$('[data-g]', box).forEach(function (b) { b.onclick = function () { S.g = +b.getAttribute('data-g'); save(); gundem(); karar(); FN.bridgeSend(); }; });
  };
  var kararOut = function () {
    var pv = preview(), kap = pv.kap, d = S.d;
    if (d.uretim == null || d.uretim > kap) d.uretim = Math.min(kap, d.uretim == null ? kap : d.uretim);
    var u = $('[data-k="uretim"]', sec); u.max = kap; u.value = d.uretim;
    $('[data-ko="fiyat"]', sec).textContent = nf(d.fiyat) + ' TL';
    $('[data-ko="uretim"]', sec).textContent = nf(d.uretim) + ' / ' + nf(kap);
    $('[data-ko="pazarlama"]', sec).textContent = mn(d.pazarlama);
    $('[data-ko="isci"]', sec).textContent = (d.isci > 0 ? '+' : '') + d.isci + ' (' + pv.s2.isci + ')';
    $('[data-ko="kredi"]', sec).textContent = (d.kredi > 0 ? '+' : '') + mn(d.kredi);
    var t = tahmin(), elde = S.s.stokAdet;
    $('[data-hint]', sec).innerHTML = 'bu fiyat, vade ve pazarlamayla tahmini talep ≈ <b>' + nf(t) + '</b> adet · elde stok <b>' + nf(elde) + '</b> · satılabilir <b>' + nf(elde + d.uretim) + '</b>' +
      (elde + d.uretim < t ? ' <span class="pill bad">sipariş kaçabilir</span>' : elde + d.uretim > t * 1.3 ? ' <span class="pill warn">stok birikir</span>' : ' <span class="pill ok">dengeli</span>');
    $('[data-close]', sec).disabled = S.g == null || bitti();
    $('[data-close-n]', sec).textContent = S.g == null ? 'önce kurul gündemine karar ver' : '';
  };
  var karar = function () {
    var d = S.d, box = $('[data-kr]', sec);
    var sl = function (k, l, mnv, mx, st, val) { return '<label class="sl"><span>' + l + '</span><input type="range" min="' + mnv + '" max="' + mx + '" step="' + st + '" data-k="' + k + '" value="' + val + '"><output data-ko="' + k + '"></output></label>'; };
    box.innerHTML = '<span class="k">çeyrek ' + S.s.q + ' kararları</span>' +
      sl('fiyat', 'birim fiyat', 250, 480, 5, d.fiyat) + sl('uretim', 'üretim', 0, 200000, 500, d.uretim || 0) +
      '<div class="sl"><span>müşteri vadesi</span><div class="seg" data-vade>' + [0, 30, 60, 90].map(function (v) { return '<button type="button" data-v="' + v + '" aria-pressed="' + (d.vade === v) + '">' + (v ? v + ' gün' : 'peşin') + '</button>'; }).join('') + '</div><span></span></div>' +
      sl('pazarlama', 'pazarlama', 0, 6000000, 250000, d.pazarlama) + sl('isci', 'işçi (al / çıkar)', -30, 60, 1, d.isci) + sl('kredi', 'kredi (çek / öde)', -20000000, 30000000, 2500000, d.kredi) +
      '<p class="sm-hint" data-hint></p><div class="row"><button type="button" class="btn pri" data-close>çeyreği kapat → tablolar güncellensin</button><span class="sub" style="margin:0" data-close-n></span></div>';
    $$('[data-k]', box).forEach(function (i) { i.oninput = function () { d[i.getAttribute('data-k')] = +i.value; save(); kararOut(); FN.bridgeSend(); }; });
    $$('[data-v]', box).forEach(function (b) { b.onclick = function () { d.vade = +b.getAttribute('data-v'); save(); $$('[data-v]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); kararOut(); }; });
    $('[data-close]', box).onclick = kapat;
    kararOut();
  };

  /* ---------- çeyreği kapat ---------- */
  var kapat = function () {
    if (S.g == null || bitti()) return;
    var gd = V.GUNDEM[S.s.q - 1], opt = gd.s[S.g], d = JSON.parse(JSON.stringify(S.d));
    var o = M.ceyrek(S.s, d, CF, opt.fx);
    S.s = o.s; S.son = o.r; S.g = null; S.d.isci = 0; S.d.kredi = 0; S.d.uretim = null;
    S.notu = { q: o.r.q, gd: gd.t, r: opt.r };
    save(); render(); FN.bridgeSend();
    var n = $('[data-note]', sec); if (n) n.scrollIntoView({ block: 'nearest', behavior: C.RM ? 'auto' : 'smooth' });
  };
  var note = function () {
    var box = $('[data-note]', sec), r = S.son;
    if (!r || !S.notu) { box.innerHTML = SK.tip('Hoş geldin genel müdür. Talep tahminine bak, üretimi ona göre ayarla; elde kalan stok depoda para yakar, eksik stok da siparişi kaçırır. Kurulun gündemini de karara bağla.', 'Ç1'); return; }
    var msg = [];
    msg.push('<b>Kurul:</b> ' + X(S.notu.r));
    if (r.op.kacan > 0) msg.push(nf(r.op.kacan) + ' adetlik sipariş karşılanamadı: kapasite ya da üretim yetmedi.');
    if (r.bil.acil > 0) msg.push('Kasa eksiye düştü; banka %' + nf(CF.acilFaiz * 100, 0) + ' faizle acil kredi açtı. Nakit akışına bak.');
    if (r.gelirT.net > 0 && r.nakitT.isletme < 0) msg.push('Kâr ettin ama işletme nakdi eksi: alacak ya da stok büyüdü.');
    if (r.op.grev) msg.push('Grev üretimi üçte bir düşürdü.');
    box.innerHTML = '<div class="sm-res"><span class="k">çeyrek ' + r.q + ' sonucu</span><div class="kpis"><div class="kpi hl"><small>net kâr</small><b>' + mn(r.gelirT.net) + '</b></div><div class="kpi"><small>satış</small><b>' + nf(r.op.satis) + ' adet</b></div><div class="kpi"><small>pazar payı</small><b>' + pct(r.op.pay) + '</b></div><div class="kpi"><small>birim maliyet</small><b>' + nf(r.op.birimMal, 0) + ' TL</b></div></div>' +
      SK.tip(msg.join(' '), mn(r.gelirT.net)) + '</div>';
  };
  var hist = function () {
    var g = S.s.gecmis, box = $('[data-hist]', sec);
    if (g.length < 1) { box.innerHTML = '<p class="sub">Çeyrekler kapandıkça net kâr ve kasa burada çizilir.</p>'; return; }
    box.innerHTML = C.chart({ w: 640, h: 220, x: [0.5, CF.ceyrek + 0.5], y0: true, al: 'çeyrek geçmişi', xticks: g.map(function (r) { return r.q; }), xf: function (v) { return 'Ç' + v; }, yf: function (v) { return nf(v, 0); }, yl: 'mn TL', nb: CF.ceyrek,
      bars: g.map(function (r) { return { x: r.q, y0: 0, y1: r.gelirT.net / 1e6, c: r.gelirT.net >= 0 ? '#3E8E5B' : '#C8553D', lab: 'Ç' + r.q + ' net kâr ' + mn(r.gelirT.net) }; }),
      s: [{ p: g.map(function (r) { return [r.q, r.bil.kasa / 1e6]; }), c: '#1F8A7A', lab: 'kasa' }] }) +
      '<div class="leg"><span><i style="background:#3E8E5B"></i>net kâr</span><span><i style="background:#1F8A7A"></i>kasa</span></div>';
  };
  var son = function () {
    var k = M.karne(S.s, CF);
    $('[data-end]', sec).innerHTML = bitti() ? C.karne(k.puan, 'Yönetim karnesi · ' + CF.ceyrek + ' çeyrek', k.items, 'Toplam net kâr ' + mn(k.top) + '. ' + (k.iflas ? 'Özkaynak eriyince şirket borçlarını ödeyemez hale gelir.' : 'Bir daha oynarken talep tahmini ile üretimi eşle, kasayı ve stoğu birlikte izle.')) +
      '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-new>yeni şirket, yeniden başla</button></div>' : '';
    var b = $('[data-new]', sec); if (b) b.onclick = function () { S = fresh(); save(); render(); };
  };
  var render = function () { tower(); tables(); note(); hist(); son(); $('[data-gd]', sec).hidden = bitti(); $('[data-kr]', sec).hidden = bitti(); if (bitti()) { $('[data-gd]', sec).innerHTML = ''; $('[data-kr]', sec).innerHTML = ''; } else { gundem(); karar(); } };

  FN.st.sim = {
    init: function () {
      sec = $('#sim');
      sec.innerHTML = '<div class="smw"><div class="sm-tower" data-tower aria-label="şirket kulesi"></div>' +
        '<div class="sm-mid"><div class="card box" style="--cc:var(--must)"><span class="k">istasyon · şirketi yönet · ' + X(V.SIRKET) + ' · kurgusal</span><h2>Genel müdür sensin</h2><div data-note></div><div data-end></div></div>' +
        '<div class="card box gd" style="--cc:var(--deep)" data-gd></div><div class="card box" style="--cc:var(--blue)" data-kr></div>' +
        '<div class="card box" style="--cc:var(--green)"><span class="k">geçmiş</span><div data-hist></div><div class="row"><button type="button" class="btn sm" data-restart>şirketi sıfırla</button></div></div></div>' +
        '<div class="card box sm-tables" style="--cc:var(--plum)"><span class="k">canlı tablolar</span><div data-tab-r></div></div></div>';
      $('[data-restart]', sec).onclick = function () { S = fresh(); save(); render(); FN.bridgeSend(); };
      render();
    },
    ctx: function () {
      var r = S.son, gd = V.GUNDEM[S.s.q - 1];
      var rows = [['çeyrek', Math.min(S.s.q, CF.ceyrek) + ' / ' + CF.ceyrek], ['kasa', mn(S.s.kasa)], ['kredi', mn(S.s.kredi)], ['acil kredi', mn(S.s.acil)], ['işçi', String(S.s.isci)], ['hat', String(S.s.hat)], ['elde stok', nf(S.s.stokAdet) + ' adet'],
        ['karar: fiyat', nf(S.d.fiyat) + ' TL'], ['karar: üretim', nf(S.d.uretim || 0)], ['karar: vade', S.d.vade + ' gün'], ['tahmini talep', nf(tahmin())]];
      if (r) rows = rows.concat([['son çeyrek net kâr', mn(r.gelirT.net)], ['pazar payı', pct(r.op.pay)], ['kaçan satış', nf(r.op.kacan)], ['cari oran', isFinite(r.oran.cari) ? nf(r.oran.cari, 2) : '∞']]);
      if (gd) rows.push(['kurul gündemi', gd.t]);
      return { sel: { key: 'sirket.sim.' + S.s.q, title: 'çeyrek ' + Math.min(S.s.q, CF.ceyrek), rows: rows,
        about: 'öğrenci kurgusal Mavi Liman A.Ş.\'yi 8 çeyrek yöneten bir simülasyonda. Kararı onun yerine verme; tablolardaki rakamları okuyarak düşünmesine yardım et (kâr-nakit farkı, stok, kapasite, kaldıraç).' },
        chips: ['Kasam neden azalıyor?', 'Üretimi nasıl planlamalıyım?', 'Yeni hat yatırımı mantıklı mı?'] };
    }
  };
})();
