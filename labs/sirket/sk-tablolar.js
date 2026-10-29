/* ==========================================================================
   ACADEX ŞİRKET · ÜÇ TABLO VE NAKİT DÖNGÜSÜ (labs/sirket/sk-tablolar.js), 29.10.2026
   Terazideki ayın gelir tablosu, ay başı/ay sonu bilançosu ve nakit akışı
   (doğrudan ve dolaylı). Bir satıra tıklayınca bağlı olduğu satırlar yanar
   (net kâr → özkaynak; nakit akışı → kasa). Altta nakit dönüşüm süresi
   (stok + alacak − borç günü) ve işletme sermayesi ihtiyacı; mini sınav.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, SK = FN.sk, V = SK.V, M = SK.M, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf;
  var K = V.KALEM, sec;
  var son = V.OLAY.reduce(function (b, e) { return M.apply(b, e); }, V.ACILIS);
  var G = M.gelir(V.OLAY), N = M.nakit(V.OLAY), AMORT = 20, DOL = M.dolayli(V.ACILIS, son, G, AMORT);
  var S = C.ls.get('sk.tb', null) || { dio: 60, dso: 45, dpo: 30, gs: 400000 };
  var save = function () { C.ls.set('sk.tb', S); };
  var PRE = [
    ['market', 'Zincir market', 20, 2, 45, 'Peşin satar, tedarikçiye 45 günde öder: döngü eksi. Müşterinin parasıyla döner.'],
    ['mobilya', 'Mobilya üreticisi', 75, 60, 30, 'Stok uzun bekler, bayiye vadeli satar: uzun döngü, çok işletme sermayesi.'],
    ['yazilim', 'Yazılım (abonelik)', 0, 10, 20, 'Stok yok, peşin abonelik: döngü kısa ya da eksi.']
  ];

  var row = function (l, v, cls, link) { return '<div class="r' + (cls ? ' ' + cls : '') + '"' + (link ? ' data-link="' + link + '" tabindex="0"' : '') + '><span>' + l + '</span><span>' + v + '</span></div>'; };
  var tables = function () {
    var gl = '<div class="tb-t"><h4>GELİR TABLOSU · ay</h4>' + row('Satışlar', nf(G.sat)) + row('Satılan malın maliyeti', '(' + nf(G.smm) + ')') + row('Brüt kâr', nf(G.brut), 't') +
      G.gid.map(function (g) { return row(X(g[0]), '(' + nf(g[1]) + ')', g[0] === 'Amortisman' ? 'amo' : ''); }).join('') + row('Net kâr', SK.sgn(G.net), 't', 'kar') + '</div>';
    var bil = '<div class="tb-t"><h4>BİLANÇO · ay başı → ay sonu</h4>' + K.map(function (k) {
      var d = son[k[0]] - V.ACILIS[k[0]];
      return row(X(k[1]), nf(V.ACILIS[k[0]]) + ' → <b>' + nf(son[k[0]]) + '</b>' + (d ? ' <small class="' + (d > 0 ? 'up' : 'dn') + '">' + SK.sgn(d) + '</small>' : ''), k[2] === 'P' && k[0] === 'kar' ? 'lk-kar' : k[0] === 'kasa' ? 'lk-kasa' : '', k[0] === 'kar' ? 'kar' : k[0] === 'kasa' ? 'kasa' : '');
    }).join('') + row('Aktif = pasif', nf(M.side(son, K, 'A')) + ' = ' + nf(M.side(son, K, 'P')), 't') + '</div>';
    var nk = '<div class="tb-t"><h4>NAKİT AKIŞI · doğrudan</h4>' + row('İşletme faaliyetleri', SK.sgn(N.isletme)) + row('Yatırım faaliyetleri', SK.sgn(N.yatirim)) + row('Finansman faaliyetleri', SK.sgn(N.finansman)) +
      row('Kasadaki değişim', SK.sgn(N.net), 't lk-kasa', 'kasa') +
      '<h4 style="margin-top:12px">İŞLETME NAKDİ · dolaylı köprü</h4>' + row('Net kâr', SK.sgn(G.net), 'lk-kar') + row('+ Amortisman (nakitsiz gider)', '+' + nf(AMORT), 'amo') +
      row('− Alacak artışı', SK.sgn(-(son.alacak - V.ACILIS.alacak))) + row('− Stok artışı', SK.sgn(-(son.stok - V.ACILIS.stok))) + row('+ Satıcı borcu artışı', SK.sgn(son.satici - V.ACILIS.satici)) +
      row('= İşletme nakdi', SK.sgn(DOL), 't') + '</div>';
    return '<div class="tb-3">' + gl + bil + nk + '</div>';
  };
  var link = function (k) {
    $$('.tb-3 .r', sec).forEach(function (r) { r.classList.toggle('lit', !!k && r.classList.contains('lk-' + k)); });
    $('[data-chain]', sec).innerHTML = k === 'kar' ? 'Net kâr (' + SK.sgn(G.net) + ') bilançoda özkaynağa <b>dönem kârı</b> olarak geçer; dolaylı nakit akışı da buradan başlar.'
      : k === 'kasa' ? 'Nakit akış tablosunun sonucu (' + SK.sgn(N.net) + '), bilançodaki kasanın ay başı ile ay sonu farkına eşittir.' : 'Bir satıra tıkla: bağlı olduğu satırlar yansın.';
  };
  var ndd = function () {
    var n = M.ndd(S.dio, S.dso, S.dpo), ihtiyac = n * S.gs, box = $('[data-ndd]', sec);
    var tot = Math.max(1, S.dio + S.dso), R = 70, cx = 90, cy = 90, L = 2 * Math.PI * R;
    var a1 = S.dio / tot, a2 = S.dso / tot;
    box.innerHTML = '<svg viewBox="0 0 180 180" class="nd-ring" aria-hidden="true"><circle cx="90" cy="90" r="70" fill="none" stroke="#EEF1F5" stroke-width="22"/>' +
      '<circle cx="90" cy="90" r="70" fill="none" stroke="#E0A526" stroke-width="22" stroke-dasharray="' + (a1 * L).toFixed(1) + ' ' + L.toFixed(1) + '" transform="rotate(-90 90 90)"/>' +
      '<circle cx="90" cy="90" r="70" fill="none" stroke="#2F6FB0" stroke-width="22" stroke-dasharray="' + (a2 * L).toFixed(1) + ' ' + L.toFixed(1) + '" stroke-dashoffset="' + (-a1 * L).toFixed(1) + '" transform="rotate(-90 90 90)"/>' +
      '<g class="nd-coin" style="--d:' + Math.max(2, Math.min(14, (S.dio + S.dso) / 12)).toFixed(1) + 's"><circle cx="90" cy="20" r="9" fill="#FFD86B" stroke="#0D1838" stroke-width="2"/><text x="90" y="24" text-anchor="middle" font-size="10" font-weight="700" fill="#0D1838">₺</text></g>' +
      '<text x="90" y="86" text-anchor="middle" class="nd-big">' + nf(n) + '</text><text x="90" y="104" text-anchor="middle" class="nd-sm">gün</text></svg>' +
      '<div class="kpis"><div class="kpi hl"><small>nakit dönüşüm süresi</small><b>' + nf(n) + ' gün</b></div><div class="kpi"><small>işletme sermayesi ihtiyacı</small><b>' + SK.mn(ihtiyac) + ' TL</b></div></div>' +
      '<div class="formula">NDS = stok günü <b>' + S.dio + '</b> + alacak günü <b>' + S.dso + '</b> − borç günü <b>' + S.dpo + '</b> = <b>' + n + '</b><br>ihtiyaç ≈ günlük satış maliyeti × NDS = ' + nf(S.gs) + ' × ' + n + '</div>' +
      SK.tip(n <= 0 ? 'Döngü eksi: tedarikçiye ödemeden önce müşteriden parayı topluyorsun. Büyümek nakit doğurur.' : n > 90 ? 'Para ' + n + ' gün stokta ve müşteride bekliyor. Satış arttıkça nakit ihtiyacı da artar: kârlı şirket bile nakitsiz kalabilir.' : 'Alacak gününü 10 gün kısaltmak ' + SK.mn(10 * S.gs) + ' TL nakdi serbest bırakır.', nf(n) + 'g');
  };

  var QS = [
    { q: 'Mavi Liman bu ay ' + (G.net < 0 ? nf(-G.net) + ' zarar etti' : nf(G.net) + ' kâr etti') + ' ama kasası ' + SK.sgn(N.net) + ' arttı. En büyük neden hangisi?', o: ['Banka kredisi ve sermaye girişi (finansman)', 'Satışların hepsi peşindi', 'Amortisman nakit girişidir', 'Stoklar arttı'], a: 0, n: 'Finansman faaliyetlerinden ' + SK.sgn(N.finansman) + ' nakit geldi: kredi 100, sermaye 50, anapara ödemesi −30. Borç ve sermaye kâr değildir.' },
    { q: 'Amortisman dolaylı yöntemde neden net kâra geri eklenir?', o: ['Nakitsiz bir giderdir', 'Bir gelir kalemidir', 'Vergiyi sıfırlar', 'Kredi geri ödemesidir'], a: 0, n: 'Amortisman kârı düşürür ama kasadan para çıkmaz; nakdi bulmak için geri eklenir.' },
    { q: 'Alacaklar 20 arttı. İşletme nakdine etkisi?', o: ['−20', '+20', 'Etkisi yok', '−40'], a: 0, n: 'Satış gelir tablosuna girdi ama para gelmedi: alacak artışı nakitten düşülür.' },
    { q: 'Stok günü 60, alacak günü 45, borç günü 30. Nakit dönüşüm süresi?', o: ['75 gün', '135 gün', '45 gün', '15 gün'], a: 0, n: '60 + 45 − 30 = 75 gün.' },
    { q: 'Hangisi nakit dönüşüm süresini KISALTIR?', o: ['Tedarikçiye daha geç ödemek', 'Müşteriye daha uzun vade vermek', 'Daha çok stok tutmak', 'Fiyatı düşürmek'], a: 0, n: 'Borç günü uzadıkça döngü kısalır; ama tedarikçiyle ilişkiyi zorlamamak gerekir.' }
  ];

  FN.st.tablolar = {
    init: function () {
      sec = $('#tablolar');
      sec.innerHTML = '<div class="card box" style="--cc:var(--plum)"><span class="k">istasyon · üç tablo · ' + X(V.SIRKET) + ' · bin TL</span><h2>Kâr, bilanço ve nakit: aynı ayın üç fotoğrafı</h2>' +
        '<p class="sub">Gelir tablosu bir <b>dönemi</b> anlatır (ne kazandık), bilanço bir <b>anı</b> (ne var, kime borçluyuz), nakit akışı da kasanın <b>neden</b> değiştiğini. Üçü birbirine bağlıdır.</p>' +
        tables() + '<p class="tb-chain" data-chain aria-live="polite"></p></div>' +
        '<div class="grid g2" style="margin-top:18px"><div class="card box" style="--cc:var(--must)"><span class="k">işletme sermayesi</span><h2>Nakit döngüsü: para kaç gün dışarıda?</h2>' +
        '<div class="seg" data-pre style="margin:6px 0 10px">' + PRE.map(function (p) { return '<button type="button" data-p="' + p[0] + '" aria-pressed="false">' + X(p[1]) + '</button>'; }).join('') + '</div>' +
        '<div class="nd-sl">' + [['dio', 'stok günü', 0, 150, '#E0A526'], ['dso', 'alacak günü', 0, 120, '#2F6FB0'], ['dpo', 'borç günü', 0, 120, '#C8553D']].map(function (x) {
          return '<label class="sl"><span><i style="background:' + x[4] + '"></i>' + x[1] + '</span><input type="range" min="' + x[2] + '" max="' + x[3] + '" step="5" data-s="' + x[0] + '" value="' + S[x[0]] + '"><output data-o="' + x[0] + '">' + S[x[0]] + '</output></label>';
        }).join('') + '</div><div class="nd" data-ndd></div><p class="sub" data-pre-n></p></div>' +
        '<div class="card box" style="--cc:var(--blue)"><span class="k">mini sınav</span><h2>Tablolar sınavı</h2><div data-qz></div></div></div>';
      $$('.tb-3 [data-link]', sec).forEach(function (r) { var go = function () { link(r.getAttribute('data-link')); }; r.onclick = go; r.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
      link(null);
      $$('[data-s]', sec).forEach(function (i) { i.oninput = function () { S[i.getAttribute('data-s')] = +i.value; $('[data-o="' + i.getAttribute('data-s') + '"]', sec).textContent = i.value; $$('[data-p]', sec).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); $('[data-pre-n]', sec).textContent = ''; save(); ndd(); FN.bridgeSend(); }; });
      $$('[data-p]', sec).forEach(function (b) {
        b.onclick = function () {
          var p = PRE.filter(function (x) { return x[0] === b.getAttribute('data-p'); })[0];
          S.dio = p[2]; S.dso = p[3]; S.dpo = p[4]; save();
          ['dio', 'dso', 'dpo'].forEach(function (k) { $('[data-s="' + k + '"]', sec).value = S[k]; $('[data-o="' + k + '"]', sec).textContent = S[k]; });
          $$('[data-p]', sec).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          $('[data-pre-n]', sec).textContent = p[5]; ndd();
        };
      });
      ndd();
      SK.quiz($('[data-qz]', sec), QS, 'Tablolar sınavı');
    },
    ctx: function () {
      return { sel: { key: 'sirket.tablolar', title: 'üç tablo',
        rows: [['net kâr', nf(G.net)], ['kasa değişimi', nf(N.net)], ['işletme nakdi', nf(N.isletme)], ['yatırım', nf(N.yatirim)], ['finansman', nf(N.finansman)], ['nakit dönüşüm süresi', M.ndd(S.dio, S.dso, S.dpo) + ' gün']],
        about: 'öğrenci gelir tablosu, bilanço ve nakit akışı arasındaki bağı ve nakit dönüşüm süresini çalışıyor.' },
        chips: ['Kâr var ama nakit yok nasıl olur?', 'Dolaylı yöntemi adım adım anlat', 'Nakit dönüşüm süresi nasıl kısalır?'] };
    }
  };
})();
