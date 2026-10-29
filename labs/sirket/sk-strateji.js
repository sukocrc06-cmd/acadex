/* ==========================================================================
   ACADEX ŞİRKET · STRATEJİ MASASI (labs/sirket/sk-strateji.js), 29.10.2026
   Üç araç: SWOT (kartı seç, kutuya koy), Porter'ın beş gücü (kanıtı oku,
   baskıyı puanla, örnek değerlendirmeyle radar grafiğinde karşılaştır),
   BCG matrisi (ürün baloncuklarını yerleştir, stratejisini gör).
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, SK = FN.sk, V = SK.V, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf;
  var S = C.ls.get('sk.sg', null) || { t: 'swot', sw: {}, po: {}, bc: {} };
  var save = function () { C.ls.set('sk.sg', S); };
  var sec, body, pick = null;
  var Q = { G: ['Güçlü yönler', 'iç · olumlu', '#3E8E5B'], Z: ['Zayıf yönler', 'iç · olumsuz', '#C8553D'], F: ['Fırsatlar', 'dış · olumlu', '#2F6FB0'], T: ['Tehditler', 'dış · olumsuz', '#B84A6B'] };

  /* ---------- SWOT ---------- */
  var swot = function () {
    var left = V.SWOT.map(function (c, i) { return i; }).filter(function (i) { return S.sw[i] !== c_ok(i); });
    body.innerHTML = '<p class="sub">Önce soruyu sor: bu durum <b>şirketin içinde</b> mi (güçlü/zayıf), yoksa <b>dışarıda</b> mı oluyor (fırsat/tehdit)? Bir kartı seç, sonra kutusuna tıkla.</p>' +
      '<div class="sw"><div class="sw-deck" data-deck>' + left.map(function (i) { return '<button type="button" class="sw-c" data-c="' + i + '">' + X(V.SWOT[i][0]) + '</button>'; }).join('') +
      (left.length ? '' : '<p class="hand" style="font-size:22px;margin:0">Bütün kartlar yerinde. Şimdi SO stratejisi düşün: bir gücü bir fırsatla eşleştir (ör. limana yakın fabrika + Avrupa\'da yakın tedarik).</p>') + '</div>' +
      '<div class="sw-grid">' + Object.keys(Q).map(function (k) {
        return '<button type="button" class="sw-q" data-q="' + k + '" style="--qc:' + Q[k][2] + '"><span class="sw-h"><b>' + Q[k][0] + '</b><small>' + Q[k][1] + '</small></span><span class="sw-in">' +
          V.SWOT.map(function (c, i) { return S.sw[i] === k && c[1] === k ? '<i>' + X(c[0]) + '</i>' : ''; }).join('') + '</span></button>';
      }).join('') + '</div></div><p class="fb" data-swfb aria-live="polite"></p>' +
      '<div class="row"><span class="pill ' + (left.length ? '' : 'ok') + '">' + (V.SWOT.length - left.length) + ' / ' + V.SWOT.length + ' yerinde · ilk denemede ' + Object.keys(S.sw).filter(function (i) { return S.sw[i] === V.SWOT[i][1] && !S['swx' + i]; }).length + '</span><button type="button" class="btn sm" data-swr>karıştır, baştan</button></div>';
    $$('[data-c]', body).forEach(function (b) { b.onclick = function () { pick = +b.getAttribute('data-c'); $$('[data-c]', body).forEach(function (x) { x.classList.toggle('on', x === b); }); $('[data-swfb]', body).textContent = 'Kart seçildi: kutusuna tıkla.'; }; });
    $$('[data-q]', body).forEach(function (q) {
      q.onclick = function () {
        if (pick == null) { $('[data-swfb]', body).textContent = 'Önce soldan bir kart seç.'; return; }
        var k = q.getAttribute('data-q'), c = V.SWOT[pick], fb = $('[data-swfb]', body);
        if (c[1] === k) { S.sw[pick] = k; save(); var m = c[2]; pick = null; swot(); $('[data-swfb]', body).innerHTML = '<b style="color:var(--ok)">Doğru.</b> ' + X(m); FN.bridgeSend(); }
        else { S['swx' + pick] = 1; save(); q.classList.remove('shake'); void q.offsetWidth; q.classList.add('shake'); fb.innerHTML = '<b style="color:var(--bad)">Olmadı.</b> ' + (('GZ'.indexOf(k) > -1) !== ('GZ'.indexOf(c[1]) > -1) ? 'İç mi dış mı? Bu ' + ('GZ'.indexOf(c[1]) > -1 ? 'şirketin kendi durumu.' : 'şirketin dışında olan bir gelişme.') : 'İç/dış doğru; ama şirkete etkisi ' + ('GF'.indexOf(c[1]) > -1 ? 'olumlu.' : 'olumsuz.')); }
      };
    });
    $('[data-swr]', body).onclick = function () { S.sw = {}; Object.keys(S).forEach(function (k) { if (k.indexOf('swx') === 0) delete S[k]; }); save(); swot(); };
  };
  var c_ok = function (i) { return V.SWOT[i][1]; };

  /* ---------- Porter ---------- */
  var radar = function (vals, ref) {
    var n = V.PORTER.length, cx = 170, cy = 150, R = 110, pt = function (i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5]; };
    var poly = function (vs) { return vs.map(function (v, i) { return pt(i, v).map(function (x) { return x.toFixed(1); }).join(','); }).join(' '); };
    var g = '<svg viewBox="0 0 340 300" class="radar" role="img" aria-label="beş güç radar grafiği">';
    [1, 2, 3, 4, 5].forEach(function (l) { g += '<polygon points="' + poly(V.PORTER.map(function () { return l; })) + '" fill="none" stroke="#E3E9F0"/>'; });
    V.PORTER.forEach(function (p, i) { var e = pt(i, 5.9); g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + pt(i, 5)[0] + '" y2="' + pt(i, 5)[1] + '" stroke="#E3E9F0"/><text x="' + e[0].toFixed(0) + '" y="' + e[1].toFixed(0) + '" text-anchor="middle" font-size="10.5">' + X(p.ad.split(' ')[0]) + '</text>'; });
    if (ref) g += '<polygon points="' + poly(ref) + '" fill="rgba(13,24,56,.06)" stroke="#0D1838" stroke-dasharray="5 4" stroke-width="1.6"/>';
    g += '<polygon class="rd-me" points="' + poly(vals) + '" fill="rgba(200,85,61,.22)" stroke="#C8553D" stroke-width="2.4"/>';
    return g + '</svg>';
  };
  var porter = function () {
    var vals = V.PORTER.map(function (p) { return S.po[p.k] || 3; }), shown = !!S.poShow, ref = V.PORTER.map(function (p) { return p.p; });
    var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    body.innerHTML = '<p class="sub">Sektör: <b>paslanmaz çelik termos</b>. Her gücün kanıtını oku ve baskıyı 1 (zayıf) ile 5 (çok güçlü) arasında puanla. Baskılar güçlüyse sektörün kârlılığı düşüktür.</p>' +
      '<div class="grid g2"><div class="po">' + V.PORTER.map(function (p) {
        var v = S.po[p.k] || 3, d = shown ? Math.abs(v - p.p) : null;
        return '<div class="po-r"><b>' + X(p.ad) + '</b><p>' + X(p.kan) + '</p><label class="sl"><span>baskı</span><input type="range" min="1" max="5" step="1" data-po="' + p.k + '" value="' + v + '"><output>' + v + '</output></label>' +
          (shown ? '<p class="fb" style="margin:0">örnek değerlendirme: <b>' + p.p + '</b> ' + (d === 0 ? '<span class="pill ok">aynı</span>' : d === 1 ? '<span class="pill warn">yakın</span>' : '<span class="pill bad">uzak</span>') + '</p>' : '') + '</div>';
      }).join('') + '</div><div><div data-po-side></div>' +
      '<div class="row"><button type="button" class="btn ' + (shown ? '' : 'pri') + '" data-poc>' + (shown ? 'örneği gizle' : 'örnek değerlendirmeyle karşılaştır') + '</button></div>' +
      (shown ? SK.tip('Alıcılar ve rakipler en güçlü baskı: üç zincir market satışın %60\'ını alıyor. Strateji: alıcı yoğunlaşmasını azalt (online kanal, ihracat), ürünü farklılaştır (akıllı matara).', nf(6 - avg, 1)) : '') + '</div></div>';
    $$('[data-po]', body).forEach(function (i) { i.oninput = function () { S.po[i.getAttribute('data-po')] = +i.value; i.nextElementSibling.textContent = i.value; save(); porterSide(); FN.bridgeSend(); }; });
    $('[data-poc]', body).onclick = function () { S.poShow = !S.poShow; save(); porter(); };
    porterSide();
  };
  var porterSide = function () {
    var vals = V.PORTER.map(function (p) { return S.po[p.k] || 3; }), ref = V.PORTER.map(function (p) { return p.p; }), avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    $('[data-po-side]', body).innerHTML = radar(vals, S.poShow ? ref : null) +
      '<div class="kpis"><div class="kpi hl"><small>sektör çekiciliği</small><b>' + nf(6 - avg, 1) + ' / 5</b></div><div class="kpi"><small>en güçlü baskı</small><b style="font-size:15px">' + X(V.PORTER[vals.indexOf(Math.max.apply(null, vals))].ad) + '</b></div></div>';
  };

  /* ---------- BCG ---------- */
  var bcg = function () {
    var W = 520, H = 360, L = 50, T = 20, R = 20, B = 46;
    var xs = function (rp) { var lo = Math.log(0.2), hi = Math.log(4); return L + (1 - (Math.log(rp) - lo) / (hi - lo)) * (W - L - R); };   /* BCG: yüksek pay solda */
    var ys = function (g) { return T + (1 - g / 32) * (H - T - B); };
    var mx = xs(1), my = ys(10);
    var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bcg" role="img" aria-label="BCG matrisi">' +
      '<rect x="' + L + '" y="' + T + '" width="' + (mx - L) + '" height="' + (my - T) + '" fill="#FFF4DC"/><rect x="' + mx + '" y="' + T + '" width="' + (W - R - mx) + '" height="' + (my - T) + '" fill="#EEE8FA"/>' +
      '<rect x="' + L + '" y="' + my + '" width="' + (mx - L) + '" height="' + (H - B - my) + '" fill="#E3F4EA"/><rect x="' + mx + '" y="' + my + '" width="' + (W - R - mx) + '" height="' + (H - B - my) + '" fill="#F1F4F7"/>' +
      '<text x="' + (L + 8) + '" y="' + (T + 18) + '" class="bq">★ Yıldız</text><text x="' + (mx + 8) + '" y="' + (T + 18) + '" class="bq">? Soru işareti</text><text x="' + (L + 8) + '" y="' + (H - B - 8) + '" class="bq">₺ Nakit ineği</text><text x="' + (mx + 8) + '" y="' + (H - B - 8) + '" class="bq">✕ Köpek</text>' +
      '<line x1="' + mx + '" x2="' + mx + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#0D1838" stroke-width="1.5"/><line x1="' + L + '" x2="' + (W - R) + '" y1="' + my + '" y2="' + my + '" stroke="#0D1838" stroke-width="1.5"/>' +
      '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11">göreli pazar payı (yüksek ← → düşük)</text><text x="14" y="' + ((T + H - B) / 2) + '" font-size="11" transform="rotate(-90 14 ' + ((T + H - B) / 2) + ')" text-anchor="middle">pazar büyümesi %</text>';
    V.BCG.forEach(function (p) {
      var r = 10 + Math.sqrt(p.ciro) * 3.2, on = !!S.bc[p.k];
      g += '<g class="bub' + (on ? ' on' : '') + '"><circle cx="' + xs(p.rp).toFixed(1) + '" cy="' + ys(p.g).toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + (on ? (S.bc[p.k] === p.d ? '#3E8E5B' : '#C8553D') : '#2F6FB0') + '" fill-opacity=".8" stroke="#0D1838" stroke-width="2"/>' +
        '<text x="' + xs(p.rp).toFixed(1) + '" y="' + (ys(p.g) + 4).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">' + X(p.ad.split(' ')[0]) + '</text></g>';
    });
    g += '</svg>';
    body.innerHTML = '<p class="sub">Dört ürün: baloncuk büyüklüğü ciro. Yatay eksen <b>göreli pazar payı</b> (bizim pay ÷ en büyük rakibin payı; 1\'in solunda lideriz), dikey eksen <b>pazar büyümesi</b> (%10 eşik). Her ürünün kutusunu seç.</p>' +
      '<div class="grid g2"><div>' + g + '</div><div class="bc-l">' + V.BCG.map(function (p) {
        var a = S.bc[p.k];
        return '<div class="bc-r"><b>' + X(p.ad) + '</b><small>büyüme %' + p.g + ' · göreli pay ' + nf(p.rp, 1) + ' · ciro ' + p.ciro + ' mn</small><div class="seg" data-bc="' + p.k + '">' +
          Object.keys(V.BCG_AD).map(function (k) { return '<button type="button" data-b="' + k + '" aria-pressed="' + (a === k) + '">' + V.BCG_AD[k] + '</button>'; }).join('') + '</div>' +
          (a ? '<p class="fb" style="margin:4px 0 0">' + (a === p.d ? '<b style="color:var(--ok)">Doğru.</b> ' + X(V.BCG_STR[p.d]) : '<b style="color:var(--bad)">Olmadı.</b> ' + (p.g >= 10 ? 'Pazar hızlı büyüyor (≥ %10).' : 'Pazar yavaş büyüyor (< %10).') + ' ' + (p.rp >= 1 ? 'Pazar lideriyiz (göreli pay ≥ 1).' : 'Liderin gerisindeyiz (göreli pay < 1).')) + '</p>' : '') + '</div>';
      }).join('') + '</div></div>';
    $$('[data-bc]', body).forEach(function (s) { $$('[data-b]', s).forEach(function (b) { b.onclick = function () { S.bc[s.getAttribute('data-bc')] = b.getAttribute('data-b'); save(); bcg(); FN.bridgeSend(); }; }); });
  };

  var show = function (t) { S.t = t; save(); pick = null; (t === 'porter' ? porter : t === 'bcg' ? bcg : swot)(); FN.bridgeSend(); };
  FN.st.strateji = {
    init: function () {
      sec = $('#strateji');
      sec.innerHTML = '<div class="card box" style="--cc:var(--deep)"><span class="k">istasyon · strateji masası · ' + X(V.SIRKET) + '</span><h2>Karar vermeden önce: araç çantası</h2><div class="seg" data-tabs style="margin:8px 0 12px"></div><div data-body></div></div>';
      body = $('[data-body]', sec);
      SK.seg($('[data-tabs]', sec), [['swot', 'SWOT'], ['porter', 'Porter\'ın 5 gücü'], ['bcg', 'BCG matrisi']], S.t, show);
      show(S.t);
    },
    ctx: function () {
      var rows = S.t === 'swot' ? [['yerleştirilen', Object.keys(S.sw).length + ' / ' + V.SWOT.length]] : S.t === 'porter' ? V.PORTER.map(function (p) { return [p.ad, String(S.po[p.k] || 3)]; }) : V.BCG.map(function (p) { return [p.ad, (S.bc[p.k] ? V.BCG_AD[S.bc[p.k]] : 'seçilmedi')]; });
      return { sel: { key: 'sirket.strateji.' + S.t, title: S.t === 'swot' ? 'SWOT' : S.t === 'porter' ? 'beş güç' : 'BCG', rows: rows, about: 'öğrenci kurgusal termos üreticisi için ' + (S.t === 'swot' ? 'SWOT analizi' : S.t === 'porter' ? 'Porter\'ın beş gücü' : 'BCG matrisi') + ' çalışıyor.' },
        chips: ['SWOT\'tan strateji nasıl çıkar (SO, WO, ST, WT)?', 'Porter\'ın beş gücünü örnekle anlat', 'Nakit ineğinden gelen para nereye gitmeli?'] };
    }
  };
})();
