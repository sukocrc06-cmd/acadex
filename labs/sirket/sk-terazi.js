/* ==========================================================================
   ACADEX ŞİRKET · BİLANÇO TERAZİSİ (labs/sirket/sk-terazi.js), 29.10.2026
   "Bilanço nedir?": solda varlıklar, sağda kaynaklar (borç + özkaynak).
   Mavi Liman A.Ş.'nin bir ayı, 12 olay. Her olayda etkisini seç; doğruysa
   bloklar büyür/küçülür ve terazi dengede kalır. Yanlış seçimde terazi
   eğilir ve nedeni açıklanır. Sonunda karne.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, SK = FN.sk, V = SK.V, M = SK.M, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf;
  var K = V.KALEM, KM = {}; K.forEach(function (k) { KM[k[0]] = k; });
  var S = C.ls.get('sk.tz', null);
  if (!S || !S.bal) S = { i: 0, res: [], bal: V.ACILIS };
  var save = function () { C.ls.set('sk.tz', S); };
  var sec, picked = false;

  /* seçenekler: doğru + tek taraflı + yön ters + hesap karışık */
  var SWAP = { kasa: 'alacak', alacak: 'kasa', kar: 'sermaye', sermaye: 'kar', kredi: 'satici', satici: 'kredi', stok: 'makine', makine: 'stok' };
  var keyOf = function (fx) { return Object.keys(fx).sort().map(function (k) { return k + fx[k]; }).join('|'); };
  var options = function (e) {
    var ks = Object.keys(e.fx), out = [{ fx: e.fx, ok: true }], seen = {}; seen[keyOf(e.fx)] = 1;
    var add = function (fx, why) { var k = keyOf(fx); if (seen[k]) return; seen[k] = 1; out.push({ fx: fx, why: why }); };
    var one = {}; one[ks[0]] = e.fx[ks[0]];
    add(one, 'Tek taraflı kayıt olmaz: her işlemin en az iki etkisi vardır. Yalnız ' + SK.KISA[ks[0]] + ' değişirse terazi dengeden çıkar.');
    var rev = {}; ks.forEach(function (k, j) { rev[k] = j === ks.length - 1 ? -e.fx[k] : e.fx[k]; });
    add(rev, 'Yön ters: ' + SK.KISA[ks[ks.length - 1]] + ' ' + (e.fx[ks[ks.length - 1]] > 0 ? 'artar' : 'azalır') + ', azalmaz/artmaz. İki kefe ters yöne gidince terazi bozulur.');
    for (var j = ks.length - 1; j >= 0; j--) {
      var a = ks[j], b = SWAP[a]; if (!b || e.fx[b] != null) continue;
      var sw = {}; ks.forEach(function (k) { sw[k === a ? b : k] = e.fx[k]; });
      add(sw, SK.KISA[a] + ' yerine ' + SK.KISA[b] + ' yazılmış. ' + (KM[a][2] === KM[b][2] ? 'Terazi dengede kalır ama kalem yanlış: ' : '') + e.n.split('.')[0] + '.');
      break;
    }
    /* sabit karıştırma: olay numarasına göre */
    var r = out.slice(0, 4), sh = e.id % r.length;
    return r.slice(sh).concat(r.slice(0, sh));
  };
  var fxTxt = function (fx) { return Object.keys(fx).map(function (k) { return '<span class="fx ' + (fx[k] > 0 ? 'up' : 'dn') + '">' + SK.KISA[k] + ' ' + SK.sgn(fx[k]) + '</span>'; }).join(''); };

  /* terazi çizimi: bloklar yükseklikle orantılı; eğim aktif − pasif farkından */
  var MAXH = 300;
  var pan = function (side, bal) {
    var items = K.filter(function (k) { return k[2] === side; }), tot = Math.max(1, items.reduce(function (a, k) { return a + Math.max(0, bal[k[0]]); }, 0));
    return items.map(function (k) {
      var v = bal[k[0]] || 0, h = Math.max(0, v) / 700 * MAXH;
      return '<div class="blk' + (v <= 0 ? ' z' : '') + '" data-blk="' + k[0] + '" style="--h:' + h.toFixed(1) + 'px;--c:' + k[4] + '"><span>' + X(k[1]) + '</span><b>' + nf(v) + '</b></div>';
    }).join('');
  };
  var draw = function (bal, tilt, flash) {
    var A = M.side(bal, K, 'A'), P = M.side(bal, K, 'P'), t = tilt != null ? tilt : C.clamp((P - A) * 0.12, -9, 9);
    var sc = $('[data-scale]', sec);
    sc.style.setProperty('--t', t + 'deg');
    $('[data-pan="A"]', sec).innerHTML = pan('A', bal); $('[data-pan="P"]', sec).innerHTML = pan('P', bal);
    $('[data-tot="A"]', sec).textContent = 'VARLIKLAR ' + nf(A); $('[data-tot="P"]', sec).textContent = 'KAYNAKLAR ' + nf(P);
    var ok = Math.abs(A - P) < 1e-9, bd = $('[data-badge]', sec);
    bd.className = 'tz-badge ' + (ok ? 'ok' : 'no'); bd.textContent = ok ? 'denge ✓ ' + nf(A) + ' = ' + nf(P) : 'denge bozuldu: ' + nf(A) + ' ≠ ' + nf(P);
    sc.classList.toggle('shake', !ok && !C.RM);
    (flash || []).forEach(function (k) { var b = $('[data-blk="' + k + '"]', sec); if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); } });
  };

  var card = function () {
    var box = $('[data-ev]', sec), n = V.OLAY.length;
    $('[data-dots]', sec).innerHTML = V.OLAY.map(function (e, j) { var r = S.res[j]; return '<i class="' + (r == null ? '' : r ? 'ok' : 'no') + (j === S.i ? ' cur' : '') + '" title="' + (j + 1) + '. olay"></i>'; }).join('');
    if (S.i >= n) {
      var ok = S.res.filter(Boolean).length, p = ok / n * 100, g = M.gelir(V.OLAY);
      box.innerHTML = C.karne(p, 'Bir ay, on iki olay: ' + ok + ' / ' + n + ' ilk denemede doğru', [
        [true, 'Terazi her olaydan sonra dengede kaldı: <b>aktif = pasif</b> (' + nf(M.side(S.bal, K, 'A')) + ').'],
        [true, 'Ayın net kârı ' + nf(g.net) + '; ama kasa ' + nf(S.bal.kasa - V.ACILIS.kasa) + ' değişti. Kâr ile nakit aynı şey değil.'],
        [true, 'Gelir ve giderler özkaynağı (dönem kârı) değiştirir; borç almak, sermaye koymak, tahsilat ve borç ödemek kârı değiştirmez.']
      ], 'Sırada <b>Üç tablo</b> istasyonu: aynı ayın gelir tablosunu ve nakit akışını kuralım.') +
        '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-go-tab="tablolar">üç tabloya geç →</button><button type="button" class="btn" data-reset>ayı baştan oyna</button></div>';
      $('[data-reset]', box).onclick = reset;
      $('[data-go-tab]', box).onclick = function () { C.setTab('tablolar'); };
      return;
    }
    var e = V.OLAY[S.i], ops = options(e); picked = false;
    box.innerHTML = '<div class="fis tz-fis"><span class="no">OLAY ' + (S.i + 1) + ' / ' + n + '</span><span class="tz-ic" aria-hidden="true">' + e.ic + '</span><p class="t">' + X(e.t) + '</p></div>' +
      '<p class="k" style="margin:14px 0 6px">bilançoda ne değişir?</p><div class="tz-opts">' +
      ops.map(function (o, j) { return '<button type="button" data-o="' + j + '">' + fxTxt(o.fx) + '</button>'; }).join('') + '</div><div class="fb" data-fb aria-live="polite"></div>';
    $$('[data-o]', box).forEach(function (b) {
      b.onclick = function () {
        var o = ops[+b.getAttribute('data-o')], fb = $('[data-fb]', box);
        if (o.ok) {
          $$('[data-o]', box).forEach(function (x) { x.disabled = true; });
          b.classList.add('ok');
          if (S.res[S.i] == null) S.res[S.i] = !picked;
          S.bal = M.apply(S.bal, e); save();
          draw(S.bal, null, Object.keys(e.fx));
          fb.innerHTML = SK.tip('<b>Doğru.</b> ' + X(e.n), nf(M.side(S.bal, K, 'A'))) + '<div class="row" style="margin-top:10px"><button type="button" class="btn pri" data-next>' + (S.i + 1 < n ? 'sonraki olay →' : 'karneyi gör') + '</button></div>';
          $('[data-next]', fb).onclick = function () { S.i++; save(); card(); FN.bridgeSend(); };
          $('[data-next]', fb).focus();
        } else {
          picked = true; b.classList.add('no'); b.disabled = true;
          var wrong = M.apply(S.bal, { fx: o.fx });
          draw(wrong, null, Object.keys(o.fx));
          fb.innerHTML = '<p class="tz-why"><b>Olmadı.</b> ' + X(o.why) + '</p>';
          clearTimeout(card.t); card.t = setTimeout(function () { draw(S.bal); }, 1600);
        }
      };
    });
  };
  var reset = function () { S = { i: 0, res: [], bal: V.ACILIS }; save(); draw(S.bal); card(); };

  FN.st.terazi = {
    init: function () {
      sec = $('#terazi');
      sec.innerHTML = '<div class="grid tz">' +
        '<div class="card box" style="--cc:var(--green)"><span class="k">istasyon · bilanço nedir? · bin TL · kurgusal</span><h2>Her işlem iki kefeyi birden oynatır</h2>' +
        '<p class="sub">Bilanço bir terazidir: solda şirketin <b>sahip oldukları</b> (varlıklar), sağda bunların <b>nereden geldiği</b> (borçlar + ortakların payı). İki taraf her zaman eşittir.</p>' +
        '<div class="tz-stage"><span class="tz-badge" data-badge></span><div class="tz-scale" data-scale>' +
        '<div class="tz-beam"><div class="tz-arm A"><span class="tz-tot hand" data-tot="A"></span><div class="tz-pan" data-pan="A"></div><i class="tz-tray"></i></div>' +
        '<div class="tz-arm P"><span class="tz-tot hand" data-tot="P"></span><div class="tz-pan" data-pan="P"></div><i class="tz-tray"></i></div></div>' +
        '<i class="tz-post"></i><i class="tz-foot"></i></div></div>' +
        '<div class="leg">' + K.map(function (k) { return '<span><i style="background:' + k[4] + '"></i>' + X(k[1]) + ' <small style="color:var(--muted)">(' + k[3] + ')</small></span>'; }).join('') + '</div></div>' +
        '<div class="card box" style="--cc:var(--rust)"><span class="k">' + X(V.SIRKET) + ' · bir ay</span><h2>Bu ay ne oldu?</h2><div class="tz-dots" data-dots></div><div data-ev></div></div></div>';
      draw(S.bal); card();
    },
    ctx: function () {
      var e = V.OLAY[Math.min(S.i, V.OLAY.length - 1)];
      return { sel: { key: 'sirket.terazi.' + S.i, title: S.i < V.OLAY.length ? 'olay ' + (S.i + 1) : 'karne',
        rows: [['olay', e.t], ['aktif', nf(M.side(S.bal, K, 'A'))], ['pasif', nf(M.side(S.bal, K, 'P'))]].concat(K.map(function (k) { return [k[1], nf(S.bal[k[0]])]; })),
        about: 'öğrenci bilanço terazisinde Mavi Liman A.Ş.\'nin olaylarının bilanço etkisini seçiyor. Cevabı söyleme; aktif = pasif eşitliği, varlık/kaynak ayrımı ve gelir-gider ile özkaynak ilişkisi üzerinden düşündür.' },
        chips: ['Bilanço neden hep denk çıkar?', 'Kâr neden özkaynağı artırır?', 'Amortisman neden nakit çıkışı değil?'] };
    }
  };
  FN.terazi = { options: options };
})();
