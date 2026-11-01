/* ==========================================================================
   ACADEX ECZACILIK LAB · MAJİSTRAL LABORATUVARI (labs/eczacilik/ecz-majistral.js)
   Formül seç → miktarları hesapla → terazide tart (±%2) → hazırlama sırası →
   etiket → karne. Hazırlanan ürün kavanozda görünür.
   ========================================================================== */
(function () {
  'use strict';
  var EC = window.EC, C = EC.core, V = C.V, $ = C.$, X = C.X;
  var el = function () { return $('#maj'); };
  var S = { id: null, st: 0, hesap: {}, tart: {}, ti: 0, ekran: 0, sira: [], etiket: {}, karis: null, done: C.ls.get('maj.done', {}) };
  var m = function () { return V.MAJ.filter(function (x) { return x.id === S.id; })[0]; };
  var birim = function (mj, i) { return mj.seyrelt && i === 0 ? 'ml' : mj.birim === 'ml' && i > 0 ? 'ml' : (mj.id === 'serum' ? 'g' : mj.birim); };
  var tol = function (h) { return Math.max(0.05, Math.abs(h) * 0.01); };
  var sec = function (id) { S.id = id; S.st = 1; S.hesap = {}; S.tart = {}; S.ti = 0; S.ekran = 0; S.sira = []; S.etiket = {}; S.karis = C.shuffle(m().adim.map(function (a, i) { return [i, a]; })); S.etkKar = C.shuffle(m().etiket.map(function (e, i) { return [i, e[0], e[1]]; })); paint(); EC.bridgeSend(); };
  var tartilan = function () { var mj = m(), M = V.majMiktar(mj); return M.map(function (x, i) { return x == null ? null : i; }).filter(function (i) { return i != null; }); };
  var teraziSVG = function (deger, hedefBirim) {
    var dolu = Math.min(1, deger / Math.max(1, (S.hedefT || 1))), yig = 6 + dolu * 26;
    return '<svg viewBox="0 0 340 220" role="img" aria-label="Hassas terazi: ' + C.tr(deger, 2) + ' ' + hedefBirim + '">' +
      '<rect x="40" y="150" width="260" height="56" rx="12" fill="#E8E3F0" stroke="#0D1838" stroke-width="3"/><rect x="70" y="164" width="130" height="30" rx="6" fill="#0B1222"/>' +
      '<text class="ekran" x="190" y="186" text-anchor="end" font-size="18" fill="#7FE0C2">' + C.tr(deger, 2) + '</text><text x="196" y="186" font-size="10" fill="#7FE0C2" font-family="JetBrains Mono">' + hedefBirim + '</text>' +
      '<circle cx="232" cy="179" r="9" fill="#1F9B62" stroke="#0D1838" stroke-width="2"/><circle cx="262" cy="179" r="9" fill="#C9483B" stroke="#0D1838" stroke-width="2"/>' +
      '<rect x="164" y="128" width="12" height="24" fill="#B9BEC6" stroke="#0D1838" stroke-width="2"/><ellipse cx="170" cy="126" rx="96" ry="12" fill="#D9DDE3" stroke="#0D1838" stroke-width="3"/>' +
      '<path d="M' + (170 - yig * 2.2) + ' 122 Q170 ' + (122 - yig * 1.6) + ' ' + (170 + yig * 2.2) + ' 122 Z" fill="' + (S.ti === 0 ? '#FFFFFF' : '#F3E9D2') + '" stroke="#0D1838" stroke-width="2"/>' +
      '<path d="M110 40 h120 l-14 70 h-92 z" fill="#E6F2F7" stroke="#0D1838" stroke-width="2" opacity=".55"/></svg>';
  };
  var paint = function () {
    var h = '<div class="bas"><div><span class="k">majistral laboratuvarı</span><h1>' + (S.id ? X(m().ad) : 'Bugün ne hazırlıyoruz?') + '</h1><p>Hesapla, tart, sırayla hazırla ve etiketle. Tartım toleransı %2; ürün eczanede hazırlanır ve hastaya etiketle teslim edilir.</p></div></div>';
    h += '<div class="mj-list" role="group" aria-label="Formüller">' + V.MAJ.map(function (x) { var d = S.done[x.id]; return '<button type="button" data-mj="' + x.id + '" aria-pressed="' + (S.id === x.id) + '">' + X(x.ad) + '<small>' + x.hedef + ' ' + x.birim + ' · ' + X(x.kullanim) + '</small>' + (d != null ? '<span class="pill ' + (d >= 85 ? 'ok' : d >= 60 ? 'warn' : 'bad') + '" style="margin-top:6px">%' + d + '</span>' : '') + '</button>'; }).join('') + '</div>';
    if (!S.id) { el().innerHTML = h + '<div class="card" style="display:flex;gap:14px;align-items:center;max-width:620px">' + C.havan(72) + '<p style="margin:0">Havancık hazır! Yukarıdan bir formül seç.</p></div>'; return; }
    var mj = m(), M = V.majMiktar(mj), T = tartilan(), L = ['Hesap', 'Tartım', 'Hazırlama', 'Etiket', 'Karne'];
    h += '<div class="mj"><div class="card"><div class="steps">' + L.map(function (l, i) { var n = i + 1; return '<span class="' + (n === S.st ? 'on' : n < S.st ? 'done' : '') + '">' + (n < S.st ? '✓ ' : n + '. ') + l + '</span>'; }).join('') + '</div>';
    /* 1. hesap */
    h += '<div class="q">1. ' + mj.hedef + ' ' + mj.birim + ' için miktarlar</div>' + (mj.seyrelt ? '<p class="sub" style="margin:0 0 6px">Stok %' + mj.seyrelt.c1 + ', hedef %' + mj.seyrelt.c2 + ': C₁V₁ = C₂V₂</p>' : '');
    mj.bil.forEach(function (b, i) {
      if (M[i] == null) { h += '<div class="bil"><span>' + X(b[0].replace('…', mj.hedef)) + '</span><span class="sub">tamamla</span><span></span></div>'; return; }
      var v = S.hesap[i], ok = v != null && Math.abs(v - M[i]) <= tol(M[i]);
      h += '<div class="bil"><label for="mjh' + i + '">' + X(b[0]) + (b[1] != null && !mj.seyrelt ? ' <span class="sub">(%' + C.tr(b[1], b[1] % 1 ? 1 : 0) + ')</span>' : '') + '</label><input id="mjh' + i + '" data-h="' + i + '" inputmode="decimal" value="' + (v != null ? String(v).replace('.', ',') : '') + '" class="' + (S.st > 1 ? (ok ? 'ok' : 'no') : '') + '"' + (S.st > 1 ? ' disabled' : '') + '><span class="mono">' + birim(mj, i) + '</span></div>' + (S.st > 1 && !ok ? '<p class="sub" style="margin:2px 0 0;color:var(--bad)">Doğrusu ' + C.tr(M[i], 2) + ' ' + birim(mj, i) + '</p>' : '');
    });
    if (S.st === 1) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-git="2">Tartıma geç →</button></div>';
    /* 2. tartım */
    if (S.st >= 2) {
      h += '<div class="q">2. Tartım</div><div class="chk">' + T.map(function (i) { var t = S.tart[i], ok = t != null && Math.abs(t - M[i]) <= V.tartTol(M[i]); return '<label class="' + (t != null ? (ok ? 'ok' : 'no') : '') + '" style="cursor:default">' + X(mj.bil[i][0]) + ': ' + (t != null ? C.tr(t, 2) + ' ' + birim(mj, i) + (ok ? ' ✓' : ' (hedef ' + C.tr(M[i], 2) + ')') : 'bekliyor') + '</label>'; }).join('') + '</div>';
      if (S.st === 2 && Object.keys(S.tart).length === T.length) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-git="3">Hazırlamaya geç →</button></div>';
    }
    /* 3. sıra */
    if (S.st >= 3) {
      h += '<div class="q">3. Hazırlama sırası <span class="sub">(doğru sırayla dokun)</span></div><div class="sira-l">' + S.karis.map(function (a) {
        var n = S.sira.indexOf(a[0]), cls = S.st > 3 ? (n === a[0] ? 'ok' : 'no') : n >= 0 ? 'sec' : '';
        return '<button type="button" data-sira="' + a[0] + '" class="' + cls + '"' + (S.st > 3 ? ' disabled' : '') + '><b>' + (n >= 0 ? n + 1 : '·') + '</b>' + X(a[1]) + '</button>';
      }).join('') + '</div>';
      if (S.st === 3) h += '<div class="row" style="margin-top:10px"><button type="button" class="btn" data-sifirla>Sırayı sıfırla</button>' + (S.sira.length === mj.adim.length ? '<button type="button" class="btn pri" data-git="4">Etikete geç →</button>' : '') + '</div>';
    }
    /* 4. etiket */
    if (S.st >= 4) {
      h += '<div class="q">4. Etikette neler olmalı? <span class="sub">(birden çok)</span></div><div class="chk">' + S.etkKar.map(function (e) { var on = !!S.etiket[e[0]], cls = S.st > 4 ? (e[2] ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<label class="' + cls + '"><input type="checkbox" data-et="' + e[0] + '"' + (on ? ' checked' : '') + (S.st > 4 ? ' disabled' : '') + '>' + X(e[1]) + '</label>'; }).join('') + '</div>';
      if (S.st === 4) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn grn" data-git="5">Ürünü teslim et</button></div>';
    }
    if (S.st >= 5) {
      var hs = 0, hn = 0; M.forEach(function (x, i) { if (x == null) return; hn++; if (S.hesap[i] != null && Math.abs(S.hesap[i] - x) <= tol(x)) hs++; });
      var ts = T.filter(function (i) { return S.tart[i] != null && Math.abs(S.tart[i] - M[i]) <= V.tartTol(M[i]); }).length;
      var ss = S.sira.filter(function (a, n) { return a === n; }).length / mj.adim.length;
      var need = mj.etiket.filter(function (e) { return e[1]; }).length, tp = 0, fp = 0; mj.etiket.forEach(function (e, i) { if (S.etiket[i]) { if (e[1]) tp++; else fp++; } });
      var es = Math.max(0, (tp - fp) / need), pct = Math.round((hs / hn + ts / T.length + ss + es) / 4 * 100);
      if (S.done[mj.id] !== pct) { S.done[mj.id] = pct; C.ls.set('maj.done', S.done); }
      h += C.karne(pct, mj.ad + ' · majistral karnesi', [[hs === hn, 'Hesap: ' + hs + '/' + hn], [ts === T.length, 'Tartım (±%2): ' + ts + '/' + T.length], [ss >= 0.99, 'Hazırlama sırası: %' + Math.round(ss * 100)], [es >= 0.99, 'Etiket: %' + Math.round(es * 100)]], '<b>Neden?</b> ' + X(mj.id === 'alkol' ? 'V₁ = C₂V₂ ÷ C₁ = 70 × 100 ÷ 96 ≈ 72,9 ml. Su eklenince hacim büzülür; karıştırıp yeniden tamamla.' : mj.id === 'serum' ? '%0,9 a/h: 100 ml’de 0,9 g → 500 ml’de 4,5 g sodyum klorür.' : 'Yüzde (a/a): 100 g üründe kaç gram. Katıyı önce az vazelinle ezmek (levigasyon) pürüzsüz ve homojen ürün verir.'));
      h += '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-mj="' + mj.id + '">Yeniden hazırla</button></div>';
    }
    h += '</div><div class="card" style="text-align:center">';
    if (S.st === 2 && Object.keys(S.tart).length < T.length) {
      var i = T[S.ti]; S.hedefT = M[i];
      h += '<span class="k">' + (mj.seyrelt ? 'dereceli silindir' : 'hassas terazi') + '</span><h3 class="disp" style="margin:6px 0 2px">' + X(mj.bil[i][0]) + '</h3><p class="sub" style="margin:0">Hesapladığın miktara getir, sonra onayla.</p><div class="terazi">' + teraziSVG(S.ekran, birim(mj, i)) + '</div>' +
        '<div class="tz-btn" role="group" aria-label="Tartım düğmeleri">' + [[10, '+10'], [1, '+1'], [0.1, '+0,1'], [-10, '−10'], [-1, '−1'], [-0.1, '−0,1']].map(function (o) { return '<button type="button" data-ek="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        '<div class="row" style="justify-content:center;margin-top:10px"><button type="button" class="btn" data-dara>Dara (sıfırla)</button><button type="button" class="btn pri" data-onay>Tartımı onayla</button></div>';
    } else {
      var dolu = S.st >= 5 ? 1 : S.st >= 3 ? 0.6 : S.st >= 2 ? 0.3 : 0.08, kav = mj.birim === 'ml';
      h += '<span class="k">' + (kav ? 'şişe' : 'kavanoz') + '</span><svg viewBox="0 0 200 220" style="max-width:220px;margin:10px auto 0;display:block" role="img" aria-label="Hazırlanan ürün">' +
        (kav ? '<path d="M78 20 h44 v30 l18 24 v124 a10 10 0 0 1 -10 10 h-60 a10 10 0 0 1 -10 -10 v-124 l18 -24z" fill="#F4FAFD" stroke="#0D1838" stroke-width="3"/><rect x="62" y="' + (198 - 120 * dolu) + '" width="76" height="' + (120 * dolu) + '" fill="#CFE8F5"/><rect x="74" y="10" width="52" height="14" rx="3" fill="#7A4FA8"/>'
          : '<rect x="40" y="56" width="120" height="150" rx="18" fill="#F7F7FA" stroke="#0D1838" stroke-width="3"/><rect x="44" y="' + (200 - 140 * dolu) + '" width="112" height="' + (140 * dolu) + '" rx="12" fill="' + (mj.id === 'lassar' ? '#F4F0E8' : '#FBF6E6') + '"/><rect x="34" y="36" width="132" height="26" rx="8" fill="#7A4FA8" stroke="#0D1838" stroke-width="3"/>') +
        (S.st >= 5 ? '<rect x="58" y="110" width="84" height="56" rx="4" fill="#fff" stroke="#0D1838" stroke-width="2"/><text x="100" y="128" text-anchor="middle" font-size="8" font-weight="800" font-family="Bricolage Grotesque">' + X(mj.ad.split(' ').slice(0, 3).join(' ')) + '</text><text x="100" y="142" text-anchor="middle" font-size="7" font-family="JetBrains Mono">' + mj.hedef + ' ' + mj.birim + '</text><text x="100" y="156" text-anchor="middle" font-size="7" fill="#C9483B" font-weight="700" font-family="Instrument Sans">HARİCEN</text>' : '') + '</svg>' +
        '<p class="sub">' + (S.st >= 5 ? 'Ürün teslime hazır.' : S.st >= 3 ? 'Karıştırma sürüyor…' : 'Hazırlık başlıyor.') + '</p>';
    }
    h += '</div></div>';
    el().innerHTML = h;
  };
  EC.st.maj = {
    init: function () {
      paint();
      el().addEventListener('input', function (e) { var i = e.target.getAttribute('data-h'); if (i != null) { var v = parseFloat(String(e.target.value).replace(',', '.')); S.hesap[i] = isNaN(v) ? null : v; } });
      el().addEventListener('change', function (e) { var i = e.target.getAttribute('data-et'); if (i != null) S.etiket[i] = e.target.checked; });
      el().addEventListener('click', function (e) {
        var b, mj = S.id && m();
        if ((b = e.target.closest('[data-mj]'))) { sec(b.getAttribute('data-mj')); return; }
        if ((b = e.target.closest('[data-ek]'))) { S.ekran = Math.max(0, Math.round((S.ekran + parseFloat(b.getAttribute('data-ek'))) * 100) / 100); paint(); return; }
        if (e.target.closest('[data-dara]')) { S.ekran = 0; paint(); return; }
        if (e.target.closest('[data-onay]')) { var T = tartilan(); if (!S.ekran) { C.toast('Terazi boş; önce tart.'); return; } S.tart[T[S.ti]] = S.ekran; S.ti++; S.ekran = 0; paint(); return; }
        if ((b = e.target.closest('[data-sira]'))) { var k = +b.getAttribute('data-sira'); if (S.sira.indexOf(k) < 0) S.sira.push(k); paint(); return; }
        if (e.target.closest('[data-sifirla]')) { S.sira = []; paint(); return; }
        if ((b = e.target.closest('[data-git]'))) {
          var g = +b.getAttribute('data-git'), M = V.majMiktar(mj);
          if (g === 2 && M.some(function (x, i) { return x != null && S.hesap[i] == null; })) { C.toast('Her bileşen için miktarı yaz.'); return; }
          if (g === 5 && !Object.keys(S.etiket).some(function (k) { return S.etiket[k]; })) { C.toast('Etikette olması gerekenleri seç.'); return; }
          S.st = g; paint(); EC.bridgeSend();
        }
      });
    },
    ctx: function () {
      if (!S.id) return null; var mj = m();
      return { sel: { key: 'ecz.maj.' + mj.id + '.' + S.st, title: 'Majistral · ' + mj.ad, la: 'Majistral laboratuvarı', rows: [['Hedef', mj.hedef + ' ' + mj.birim], ['Bileşenler', mj.bil.map(function (b) { return b[0] + (b[1] != null ? ' %' + Math.round(b[1] * 100) / 100 : ''); }).join(', ')]], about: 'öğrenci Eczacılık Lab majistral istasyonunda ürün hazırlıyor (adım ' + S.st + '). Hesabı doğrudan verme; yüzde a/a, a/h ve C₁V₁ = C₂V₂ mantığını kurdur.' }, chips: [['hesap', 'Yüzde hesabı nasıl yapılır?'], ['levigasyon', 'Levigasyon neden gerekli?']] };
    },
    classify: function (q) { if (/yüzde|hesap|c1|seyrel/.test(q)) return 'hesap'; if (/levig|ezme|havan/.test(q)) return 'levigasyon'; return null; },
    answer: function (k) {
      if (k === 'hesap') return '% a/a: 100 g üründe kaç g madde (100 g × %2 = 2 g). % a/h: 100 ml çözeltide kaç g (500 ml × %0,9 = 4,5 g). Seyreltmede C₁V₁ = C₂V₂: stok hacmi = hedef % × hedef hacim ÷ stok %.';
      return 'Katı tozu doğrudan çok miktarda vazeline katarsan topaklanır ve ürün kumlu olur. Önce az miktar bazla havanda ezip ince bir macun yapmak (levigasyon) partikülleri dağıtır; sonra baz azar azar eklenir.';
    }
  };
})();
