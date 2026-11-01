/* ==========================================================================
   ACADEX HEMŞİRELİK LAB · BECERİ İSTASYONLARI (labs/hemsirelik/hem-beceri.js)
   Damar yolu, kas içi enjeksiyon, deri altı insülin, üriner kateter, aseptik
   pansuman. Tepsiyi hazırla → adımları doğru sırayla → kritik karar →
   (varsa) bölgeyi bedende seç → karne.
   ========================================================================== */
(function () {
  'use strict';
  var HM = window.HM, C = HM.core, V = C.V, $ = C.$, X = C.X;
  var el = function () { return $('#beceri'); };
  var S = { id: null, st: 0, mal: {}, sira: [], karar: {}, bolge: null, done: C.ls.get('bc.done', {}) };
  var b = function () { return V.BECERI.filter(function (x) { return x.id === S.id; })[0]; };
  var IKON = {
    iv: '<rect x="6" y="20" width="22" height="6" rx="3" fill="#E7F0FC" stroke="#0D1838" stroke-width="2"/><path d="M28 23 L34 23" stroke="#0D1838" stroke-width="2"/><rect x="2" y="21" width="5" height="4" fill="#E8664F"/>',
    im: '<rect x="8" y="12" width="18" height="8" rx="2" fill="#E7F0FC" stroke="#0D1838" stroke-width="2"/><path d="M26 16 H34 M2 16 H8 M4 12 V20" stroke="#0D1838" stroke-width="2"/>',
    sc: '<rect x="4" y="13" width="24" height="9" rx="4" fill="#FDE9E4" stroke="#0D1838" stroke-width="2"/><path d="M28 17.5 H34" stroke="#0D1838" stroke-width="2"/><rect x="10" y="15" width="8" height="5" rx="1" fill="#fff"/>',
    sonda: '<path d="M6 6 C6 24 30 12 30 30" stroke="#E8A93A" stroke-width="3" fill="none"/><circle cx="6" cy="6" r="3" fill="#E8A93A" stroke="#0D1838" stroke-width="1.5"/><rect x="24" y="26" width="10" height="8" rx="2" fill="#FFF3DA" stroke="#0D1838" stroke-width="1.5"/>',
    yara: '<rect x="5" y="10" width="26" height="16" rx="4" fill="#fff" stroke="#0D1838" stroke-width="2"/><rect x="12" y="13" width="12" height="10" rx="2" fill="#FDE9E4"/><path d="M15 18h6M18 15v6" stroke="#E8664F" stroke-width="2"/>'
  };
  var sec = function (id) { S.id = id; S.st = 1; S.mal = {}; S.sira = []; S.karar = {}; S.bolge = null; S.mKar = C.shuffle(b().malzeme.map(function (m, i) { return [i, m[0], m[1]]; })); S.aKar = C.shuffle(b().adim.map(function (a, i) { return [i, a]; })); paint(); HM.bridgeSend(); };
  var beden = function (bo) {
    var s = '<svg viewBox="0 0 300 280" role="group" aria-label="' + X(bo.soru) + '">';
    if (bo.tip === 'kol') s += '<path d="M10 230 C40 214 80 200 120 186 C170 168 210 150 280 110 L292 132 C220 176 176 196 128 212 C90 226 50 244 18 256 Z" fill="#F2D2B6" stroke="#0D1838" stroke-width="2.5"/><path d="M10 230 C2 236 0 250 18 256" fill="#F2D2B6" stroke="#0D1838" stroke-width="2.5"/><path d="M110 196 C150 182 190 166 240 140" stroke="#5C8FD0" stroke-width="3" fill="none" opacity=".6"/><path d="M140 200 C180 186 220 162 260 132" stroke="#5C8FD0" stroke-width="3" fill="none" opacity=".5"/>';
    else if (bo.tip === 'kalca') s += '<path d="M150 20 a18 18 0 1 1 0.1 0 Z" fill="#F2D2B6" stroke="#0D1838" stroke-width="2.5"/><path d="M128 56 C112 70 110 110 120 140 C130 166 170 174 210 160 C232 150 236 120 222 96 C208 70 186 56 168 56 Z" fill="#9CC6E8" stroke="#0D1838" stroke-width="2.5"/><path d="M120 140 C126 190 150 240 170 272 M210 160 C214 200 214 240 210 272" stroke="#0D1838" stroke-width="2.5" fill="#F2D2B6"/><path d="M130 64 C140 50 160 48 170 56" stroke="#0D1838" stroke-width="2.5" fill="none"/><circle cx="206" cy="150" r="5" fill="#0D1838" opacity=".3"/>';
    else s += '<circle cx="150" cy="30" r="20" fill="#F2D2B6" stroke="#0D1838" stroke-width="2.5"/><path d="M112 58 H188 C196 100 194 160 186 190 H114 C106 160 104 100 112 58 Z" fill="#F2D2B6" stroke="#0D1838" stroke-width="2.5"/><path d="M112 62 C90 80 70 120 64 170 M188 62 C210 80 230 120 236 170" stroke="#0D1838" stroke-width="12" stroke-linecap="round" fill="none" opacity=".25"/><path d="M118 190 L112 272 M182 190 L188 272 M150 190 V272" stroke="#0D1838" stroke-width="2.5" fill="none"/><circle cx="150" cy="124" r="3" fill="#0D1838"/><circle cx="150" cy="124" r="22" fill="none" stroke="#C9483B" stroke-width="1.5" stroke-dasharray="3 4"/>';
    bo.L.forEach(function (p) {
      var cls = S.st > 4 ? (p[0] === bo.dogru ? 'ok' : S.bolge === p[0] ? 'no' : '') : S.bolge === p[0] ? 'sec' : '';
      s += '<g class="nok ' + cls + '" data-bolge="' + p[0] + '" tabindex="0" role="button" aria-label="' + X(p[1]) + '"><circle cx="' + p[2] + '" cy="' + p[3] + '" r="11" fill="#3B7DD8" stroke="#fff" stroke-width="3"/><text x="' + p[2] + '" y="' + (p[3] - 16) + '" text-anchor="middle" font-family="Instrument Sans" font-size="11" font-weight="700" fill="#0D1838">' + X(p[1].split(' (')[0]) + '</text></g>';
    });
    return s + '</svg>';
  };
  var paint = function () {
    var h = '<div class="bas"><div><span class="k">beceri istasyonları</span><h1>' + (S.id ? X(b().ad) : 'Bugün hangi beceri?') + '</h1><p>Tepsiyi hazırla, adımları doğru sırayla uygula, kritik kararı ver. Aseptik tekniğin ve hasta güvenliğinin her adımı puanlanır.</p></div></div>';
    h += '<div class="bc-list" role="group" aria-label="Beceriler">' + V.BECERI.map(function (x) { var d = S.done[x.id]; return '<button type="button" data-bc="' + x.id + '" aria-pressed="' + (S.id === x.id) + '"><svg viewBox="0 0 36 36" aria-hidden="true">' + IKON[x.ikon] + '</svg><span>' + X(x.ad) + (d != null ? '<br><span class="pill ' + (d >= 85 ? 'ok' : d >= 60 ? 'warn' : 'bad') + '">%' + d + '</span>' : '') + '</span></button>'; }).join('') + '</div>';
    if (!S.id) { el().innerHTML = h + '<div class="card" style="display:flex;gap:14px;align-items:center;max-width:620px">' + C.nabiz(72) + '<p style="margin:0">Nabız hazır! Yukarıdan bir beceri seç.</p></div>'; return; }
    var B = b(), L = ['Tepsi', 'Adımlar', 'Karar'].concat(B.bolge ? ['Bölge'] : []).concat(['Karne']), son = B.bolge ? 5 : 4;
    h += '<div class="bc"><div class="card"><div class="steps">' + L.map(function (l, i) { var n = i + 1; return '<span class="' + (n === S.st ? 'on' : n < S.st ? 'done' : '') + '">' + (n < S.st ? '✓ ' : n + '. ') + l + '</span>'; }).join('') + '</div>';
    h += '<div class="q">1. Tepsiye gerekenleri koy</div><div class="tepsi" role="group" aria-label="Malzeme tepsisi">' + S.mKar.map(function (m) { var on = !!S.mal[m[0]], cls = S.st > 1 ? (m[2] ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<button type="button" data-mal="' + m[0] + '" aria-pressed="' + on + '" class="' + cls + '"' + (S.st > 1 ? ' disabled' : '') + '>' + X(m[1]) + '</button>'; }).join('') + '</div>';
    if (S.st === 1) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-adim="2">Uygulamaya geç →</button></div>';
    if (S.st >= 2) {
      h += '<div class="q">2. Adımları doğru sırayla seç</div><div class="sira-l">' + S.aKar.map(function (a) { var n = S.sira.indexOf(a[0]), cls = S.st > 2 ? (n === a[0] ? 'ok' : 'no') : n >= 0 ? 'sec' : ''; return '<button type="button" data-sira="' + a[0] + '" class="' + cls + '"' + (S.st > 2 ? ' disabled' : '') + '><b>' + (n >= 0 ? n + 1 : '·') + '</b>' + X(a[1]) + '</button>'; }).join('') + '</div>';
      if (S.st === 2) h += '<div class="row" style="margin-top:10px"><button type="button" class="btn" data-sifirla>Sırayı sıfırla</button>' + (S.sira.length === B.adim.length ? '<button type="button" class="btn pri" data-adim="3">Karara geç →</button>' : '<span class="sub">' + S.sira.length + '/' + B.adim.length + '</span>') + '</div>';
      if (S.st > 2) h += '<p class="sub" style="margin:8px 0 0">Doğru sıra: ' + B.adim.map(function (a, i) { return (i + 1) + ') ' + X(a); }).join(' ') + '</p>';
    }
    if (S.st >= 3) {
      B.karar.forEach(function (k, ki) {
        h += '<div class="q">3. ' + X(k.s) + '</div><div class="chk">' + k.o.map(function (o, oi) { var on = S.karar[ki] === oi, cls = S.st > 3 ? (o[1] ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<label class="' + cls + '"><input type="radio" name="k' + ki + '" data-karar="' + ki + '" value="' + oi + '"' + (on ? ' checked' : '') + (S.st > 3 ? ' disabled' : '') + '>' + X(o[0]) + '</label>'; }).join('') + '</div>' + (S.st > 3 && S.karar[ki] != null ? '<div class="find ' + (k.o[S.karar[ki]][1] ? 'ok' : 'no') + '" style="margin-top:8px">' + X(k.o[S.karar[ki]][2]) + '</div>' : '');
      });
      if (S.st === 3) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-adim="4">' + (B.bolge ? 'Bölgeyi seç →' : 'Beceriyi bitir') + '</button></div>';
    }
    if (B.bolge && S.st >= 4) {
      h += '<div class="q">4. ' + X(B.bolge.soru) + ' <span class="sub">(bedende dokun)</span></div>' + (S.bolge ? '<p style="margin:0">Seçimin: <b>' + X(B.bolge.L.filter(function (p) { return p[0] === S.bolge; })[0][1]) + '</b></p>' : '');
      if (S.st > 4) h += '<div class="find ' + (S.bolge === B.bolge.dogru ? 'ok' : 'no') + '" style="margin-top:8px">' + X(B.bolge.geri) + '</div>';
      if (S.st === 4) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn grn" data-adim="5">Beceriyi bitir</button></div>';
    }
    if (S.st > son - 1 && S.st >= son) {
      var need = B.malzeme.filter(function (m) { return m[1]; }).length, tp = 0, fp = 0; B.malzeme.forEach(function (m, i) { if (S.mal[i]) { if (m[1]) tp++; else fp++; } });
      var ms = Math.max(0, (tp - fp) / need), ss = S.sira.filter(function (a, n) { return a === n; }).length / B.adim.length;
      var ks = B.karar.filter(function (k, ki) { return S.karar[ki] != null && k.o[S.karar[ki]][1]; }).length / B.karar.length, bs = B.bolge ? (S.bolge === B.bolge.dogru ? 1 : 0) : null;
      var pct = Math.round((ms + ss * 1.5 + ks + (bs == null ? 0 : bs)) / (B.bolge ? 4.5 : 3.5) * 100);
      if (S.done[B.id] !== pct) { S.done[B.id] = pct; C.ls.set('bc.done', S.done); }
      h += C.karne(pct, B.ad + ' · beceri karnesi', [[ms >= 0.99, 'Tepsi: %' + Math.round(ms * 100)], [ss >= 0.99, 'Adım sırası: %' + Math.round(ss * 100)], [ks >= 0.99, 'Kritik karar']].concat(B.bolge ? [[bs === 1, 'Bölge seçimi']] : []), 'Her beceri hasta kimliğini doğrulama ve el hijyeniyle başlar, kayıtla biter.');
      h += '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-bc="' + B.id + '">Yeniden dene</button></div>';
    }
    h += '</div><div class="card beden" style="text-align:center">' + (B.bolge && S.st >= 4 ? beden(B.bolge) : '<span class="k">uygulama alanı</span><svg viewBox="0 0 36 36" style="width:140px;height:140px;margin:16px auto;display:block" aria-hidden="true">' + IKON[B.ikon] + '</svg><p class="sub">' + (B.bolge ? 'Karar adımından sonra bölgeyi bedende seçeceksin.' : 'Steril teknik: steril alan, steril eldiven, temizden kirliye.') + '</p>') + '</div></div>';
    el().innerHTML = h;
  };
  HM.st.beceri = {
    init: function () {
      paint();
      el().addEventListener('change', function (e) { var k = e.target.getAttribute('data-karar'); if (k != null) S.karar[k] = +e.target.value; });
      el().addEventListener('click', function (e) {
        var t;
        if ((t = e.target.closest('[data-bc]'))) { sec(t.getAttribute('data-bc')); return; }
        if ((t = e.target.closest('[data-mal]'))) { var i = t.getAttribute('data-mal'); S.mal[i] = !S.mal[i]; t.setAttribute('aria-pressed', String(S.mal[i])); return; }
        if ((t = e.target.closest('[data-sira]'))) { var n = +t.getAttribute('data-sira'); if (S.sira.indexOf(n) < 0) S.sira.push(n); paint(); return; }
        if (e.target.closest('[data-sifirla]')) { S.sira = []; paint(); return; }
        if ((t = e.target.closest('[data-bolge]'))) { if (S.st !== 4) return; S.bolge = t.getAttribute('data-bolge'); paint(); return; }
        if ((t = e.target.closest('[data-adim]'))) {
          var g = +t.getAttribute('data-adim'), B = b();
          if (g === 2 && !Object.keys(S.mal).some(function (k) { return S.mal[k]; })) { C.toast('Tepsiye malzeme koy.'); return; }
          if (g === 4 && B.karar.some(function (k, ki) { return S.karar[ki] == null; })) { C.toast('Kararı ver.'); return; }
          if (g === 4 && !B.bolge) g = 4;
          if (g === 5 && !S.bolge) { C.toast('Bedende bir bölge seç.'); return; }
          S.st = g; paint(); HM.bridgeSend();
        }
      });
      el().addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-bolge]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    },
    ctx: function () {
      if (!S.id) return null; var B = b();
      return { sel: { key: 'hem.beceri.' + B.id + '.' + S.st, title: 'Beceri · ' + B.ad, la: 'Beceri istasyonları', rows: [['Adım', ['', 'tepsi', 'sıralama', 'karar', 'bölge', 'karne'][S.st] || '']], about: 'öğrenci Hemşirelik Lab beceri istasyonunda ' + B.ad + ' uyguluyor. Sırayı doğrudan verme; aseptik teknik ve hasta güvenliği ilkelerini sorgulat.' }, chips: [['ipucu', 'Bu adım için ipucu ver']] };
    },
    classify: function (q) { return /ipucu|sıra|nasıl/.test(q) ? 'ipucu' : null; },
    answer: function () {
      if (!S.id) return null;
      if (S.st === 1) return 'İpucu: tepsiye yalnız bu işlem için gerekenleri koy; fazlası alanı kalabalıklaştırır, eksik olan işlemi yarıda bırakır.';
      if (S.st === 2) return 'İpucu: her beceri hastayı tanımak, açıklamak ve el hijyeniyle başlar; işlem ortası aseptik adımlardır; atık ve kayıt sondadır.';
      return 'İpucu: kararı hasta güvenliği açısından düşün: hangi seçenek dokuya en az zarar verir, enfeksiyonu önler?';
    }
  };
})();
