/* ==========================================================================
   ACADEX HEMŞİRELİK LAB · HASTA BAŞI VE VİTAL (labs/hemsirelik/hem-yatak.js)
   Ölç (nabız ve solunumu say, tansiyon, ateş, SpO₂, bilinç) → NEWS2 puanla →
   klinik yanıtı seç → hemşirelik süreci (tanı, girişim) → karne.
   Her açılışta hasta adı ve vital bulgular küçük oynar; skor her seferinde
   ölçülen değerden yeniden hesaplanır.
   ========================================================================== */
(function () {
  'use strict';
  var HM = window.HM, C = HM.core, V = C.V, $ = C.$, X = C.X;
  var el = function () { return $('#yatak'); };
  var kullan = {};
  var HS = V.HASTA.map(function (h, i) {
    var r = C.rng(100 + i), v = V.oynat(h.v, r), k = V.kisi(h, r), dene = 0;
    while (kullan[k.ad] && dene++ < 20) k = V.kisi(h, C.rng(500 + i * 31 + dene));
    kullan[k.ad] = 1;
    var n15 = Math.round(v.nabiz / 4), s30 = Math.round(v.sol / 2);
    v.nabiz = n15 * 4; v.sol = s30 * 2;
    return { h: h, k: k, v: v, n15: n15, s30: s30, news: V.news(v) };
  });
  var S = { i: 0, st: 0, olc: {}, gir: {}, sk: {}, yanit: null, tani: null, gr: {}, done: C.ls.get('yb.done', {}) };
  var cur = function () { return HS[S.i]; };
  var sifirla = function () { S.st = 0; S.olc = {}; S.gir = {}; S.sk = {}; S.yanit = null; S.tani = null; S.gr = {}; S.tKar = null; S.gKar = null; };
  var ALET = [['nabiz', 'Nabzı say (15 sn)', '<circle cx="14" cy="14" r="11" fill="#FDE9E4" stroke="#0D1838" stroke-width="2"/><path d="M5 15h5l2-4 3 8 2-4h4" stroke="#E8664F" stroke-width="2" fill="none"/>'],
    ['sol', 'Solunumu say (30 sn)', '<circle cx="14" cy="14" r="11" fill="#E7F0FC" stroke="#0D1838" stroke-width="2"/><path d="M8 18c2-6 4-8 6-8s4 2 6 8" stroke="#3B7DD8" stroke-width="2" fill="none"/>'],
    ['ta', 'Tansiyon ölç', '<rect x="3" y="8" width="14" height="12" rx="3" fill="#E7F0FC" stroke="#0D1838" stroke-width="2"/><circle cx="21" cy="14" r="5" fill="#fff" stroke="#0D1838" stroke-width="2"/><path d="M21 14l2-2" stroke="#C9483B" stroke-width="2"/>'],
    ['ates', 'Ateş ölç', '<rect x="11" y="3" width="6" height="16" rx="3" fill="#fff" stroke="#0D1838" stroke-width="2"/><circle cx="14" cy="21" r="4" fill="#E8664F" stroke="#0D1838" stroke-width="2"/>'],
    ['spo2', 'Pulse oksimetre', '<rect x="4" y="9" width="20" height="11" rx="5" fill="#0B1222" stroke="#0D1838" stroke-width="2"/><text x="14" y="17.5" text-anchor="middle" font-size="6" fill="#4BE08A" font-family="JetBrains Mono">SpO2</text>'],
    ['bilinc', 'Bilinci değerlendir', '<circle cx="14" cy="12" r="7" fill="#FFF0C9" stroke="#0D1838" stroke-width="2"/><circle cx="11.5" cy="12" r="1.2"/><circle cx="16.5" cy="12" r="1.2"/><path d="M8 24h12" stroke="#0D1838" stroke-width="2"/>']];
  var odaSVG = function (c) {
    var v = c.v, o = S.olc, mon = function (id, t) { return o[id] ? t : '--'; };
    return '<svg viewBox="0 0 640 330" role="img" aria-label="' + X(c.k.hitap) + ' yatakta; monitör">' +
      '<rect width="640" height="330" fill="#E6F0FA"/><path d="M0 70 H640" stroke="#7FA9DD" stroke-width="8"/><rect y="250" width="640" height="80" fill="#D6E2EF"/>' +
      '<rect x="470" y="30" width="150" height="104" rx="10" fill="#1D2438" stroke="#38425C" stroke-width="4"/><rect x="478" y="38" width="134" height="88" rx="4" fill="#0B1222"/>' +
      '<path class="nbzN" style="--nb:' + (60 / v.nabiz).toFixed(2) + 's" d="M484 62 h30 l6 -12 l6 22 l6 -10 h52" stroke="#4BE08A" stroke-width="2" fill="none"/>' +
      '<text x="484" y="96" font-family="JetBrains Mono" font-size="9" fill="#4BE08A">NABIZ</text><text x="484" y="114" font-family="JetBrains Mono" font-size="16" font-weight="700" fill="#4BE08A">' + mon('nabiz', v.nabiz) + '</text>' +
      '<text x="530" y="96" font-family="JetBrains Mono" font-size="9" fill="#66C7FF">SpO₂</text><text x="530" y="114" font-family="JetBrains Mono" font-size="16" font-weight="700" fill="#66C7FF">' + mon('spo2', v.spo2) + '</text>' +
      '<text x="572" y="96" font-family="JetBrains Mono" font-size="9" fill="#FFD45A">TA</text><text x="568" y="114" font-family="JetBrains Mono" font-size="11" font-weight="700" fill="#FFD45A">' + (o.ta ? v.sis + '/' + v.dia : '--') + '</text>' +
      '<path d="M546 134 v40" stroke="#9AA6BC" stroke-width="5"/>' +
      '<g><rect x="60" y="196" width="400" height="22" rx="8" fill="#F1F4FA" stroke="#C7CFDD" stroke-width="3"/><rect x="54" y="140" width="12" height="130" rx="5" fill="#9AA6BC"/><rect x="452" y="170" width="12" height="100" rx="5" fill="#9AA6BC"/><circle cx="90" cy="282" r="9" fill="#46506A"/><circle cx="430" cy="282" r="9" fill="#46506A"/></g>' +
      '<g class="kisi"><ellipse cx="120" cy="186" rx="44" ry="15" fill="#fff" stroke="#DCE2EC" stroke-width="2"/><ellipse cx="124" cy="168" rx="26" ry="24" fill="#E8B48A"/><path d="M100 160 C104 138 140 136 148 156 C136 148 116 148 100 160 Z" fill="' + (c.h.cins === 'K' ? '#8A5A2B' : '#B9B4A8') + '"/>' +
      (v.bilinc === 'A' ? '<ellipse cx="136" cy="166" rx="2.6" ry="3.2" fill="#0D1838"/>' : '<path d="M131 166 q5 3 10 0" stroke="#0D1838" stroke-width="2.2" fill="none"/>') +
      (v.o2 ? '<path d="M146 172 C170 170 200 160 240 150" stroke="#9FD8D0" stroke-width="3" fill="none"/><circle cx="146" cy="172" r="3" fill="#9FD8D0"/>' : '') +
      '<g class="breath" style="--nf:' + (60 / v.sol).toFixed(2) + 's"><path d="M150 178 C175 150 230 152 280 156 L440 160 C456 160 460 190 446 194 L150 196 Z" fill="#9CC6E8"/></g></g>' +
      (o.ates ? '<g transform="translate(300 96)"><rect width="88" height="36" rx="8" fill="#fff" stroke="#0D1838" stroke-width="2"/><text x="44" y="24" text-anchor="middle" font-family="JetBrains Mono" font-size="15" font-weight="700" fill="#C9483B">' + String(v.ates).replace('.', ',') + ' °C</text></g>' : '') +
      '<text x="20" y="40" font-family="Bricolage Grotesque" font-size="18" font-weight="800" fill="#0D1838">' + X(c.k.hitap) + ', ' + c.k.yas + '</text><text x="20" y="60" font-family="Instrument Sans" font-size="12" fill="#46506A">' + X(c.h.tani) + '</text></svg>';
  };
  var olcHTML = function (c) {
    var v = c.v, o = S.olc, L = [];
    if (o.nabiz) L.push('<div><span>Nabız · 15 sn’de ' + c.n15 + ' atım</span><label class="vh" for="g-nabiz">Dakikada nabız</label><input id="g-nabiz" data-g="nabiz" inputmode="numeric" placeholder="/dk" value="' + (S.gir.nabiz || '') + '" class="' + (S.st > 0 ? (+S.gir.nabiz === v.nabiz ? 'ok' : 'no') : '') + '"' + (S.st > 0 ? ' disabled' : '') + '></div>');
    if (o.sol) L.push('<div><span>Solunum · 30 sn’de ' + c.s30 + ' kez</span><label class="vh" for="g-sol">Dakikada solunum</label><input id="g-sol" data-g="sol" inputmode="numeric" placeholder="/dk" value="' + (S.gir.sol || '') + '" class="' + (S.st > 0 ? (+S.gir.sol === v.sol ? 'ok' : 'no') : '') + '"' + (S.st > 0 ? ' disabled' : '') + '></div>');
    if (o.ta) L.push('<div><span>Korotkoff ' + v.sis + '’te başladı, ' + v.dia + '’de kayboldu</span><b>TA ' + v.sis + '/' + v.dia + '</b></div>');
    if (o.ates) L.push('<div><span>Timpanik</span><b>' + String(v.ates).replace('.', ',') + ' °C</b></div>');
    if (o.spo2) L.push('<div><span>' + (v.o2 ? 'nazal kanül 2 L/dk' : 'oda havası') + '</span><b>SpO₂ %' + v.spo2 + '</b></div>');
    var h = '<div class="olcum">' + L.join('') + '</div>';
    if (o.bilinc) h += '<div class="q">Bilinç: <span class="sub" style="font-weight:500">' + X(c.h.bilincT) + '</span></div><div class="seg" role="group" aria-label="ACVPU">' + V.ACVPU.map(function (a) { var on = S.gir.bilinc === a[0], cls = S.st > 0 ? (a[0] === v.bilinc ? 'background:var(--ok);color:#fff' : on ? 'background:var(--bad);color:#fff' : '') : ''; return '<button type="button" data-acvpu="' + a[0] + '" aria-pressed="' + on + '" title="' + X(a[1]) + '"' + (S.st > 0 ? ' disabled' : '') + ' style="' + cls + '">' + a[0] + '</button>'; }).join('') + '</div>';
    return h;
  };
  var newsTablo = function (c) {
    var v = c.v, n = c.news, deger = { sol: v.sol + '/dk', spo2: '%' + v.spo2, o2: v.o2 ? 'Var' : 'Yok (oda havası)', sis: v.sis + ' mmHg', nabiz: v.nabiz + '/dk', bilinc: v.bilinc, ates: String(v.ates).replace('.', ',') + ' °C' };
    var sec = { o2: [0, 2], bilinc: [0, 3] };
    return '<table class="nw"><tbody>' + V.NEWS_PARAM.map(function (p) {
      var L = sec[p.id] || [0, 1, 2, 3];
      return '<tr><td>' + X(p.ad) + '</td><td class="mono">' + X(deger[p.id]) + '</td><td><span class="sk" role="group" aria-label="' + X(p.ad) + ' puanı">' + L.map(function (x) {
        var on = S.sk[p.id] === x, cls = S.st > 1 ? (x === n.parca[p.id] ? (on ? 'ok' : 'dg') : on ? 'no' : '') : '';
        return '<button type="button" data-sk="' + p.id + '" data-x="' + x + '" aria-pressed="' + on + '" class="' + cls + '"' + (S.st > 1 ? ' disabled' : '') + '>' + x + '</button>';
      }).join('') + '</span></td></tr>';
    }).join('') + '</tbody></table>';
  };
  var top = function () { return V.NEWS_PARAM.reduce(function (a, p) { return a + (S.sk[p.id] || 0); }, 0); };
  var paint = function () {
    var c = cur(), h = '';
    h += '<div class="bas"><div><span class="k">hasta başı · ' + (S.i + 1) + '/' + HS.length + '</span><h1>Vital bulgular ve NEWS2</h1><p>Ölç, sayıları dakikaya çevir, NEWS2’yi puanla ve skorun gerektirdiği yanıtı seç. Sonra hemşirelik tanısını ve girişimleri belirle.</p></div></div>';
    h += '<div class="hlist" role="group" aria-label="Hastalar">' + HS.map(function (x, i) { var d = S.done[x.h.id]; return '<button type="button" data-h="' + i + '" aria-pressed="' + (i === S.i) + '">' + X(x.k.hitap) + (d != null ? ' <span class="pill ' + (d >= 85 ? 'ok' : d >= 60 ? 'warn' : 'bad') + '">%' + d + '</span>' : '') + '</button>'; }).join('') + '</div>';
    h += '<div class="yb"><div><div class="card oda">' + odaSVG(c) + '<p style="margin:10px 2px 0;font-size:14px;line-height:1.5">' + X(c.h.durum) + '</p></div>';
    h += '<div class="aletler" role="group" aria-label="Ölçüm araçları">' + ALET.map(function (a) { return '<button type="button" data-alet="' + a[0] + '" class="' + (S.olc[a[0]] ? 'olc' : '') + '"' + (S.st > 0 ? ' disabled' : '') + '><svg viewBox="0 0 28 28" aria-hidden="true">' + a[2] + '</svg>' + X(a[1]) + '</button>'; }).join('') + '</div></div>';
    var L = ['Ölç', 'NEWS2', 'Yanıt', 'Süreç', 'Karne'];
    h += '<div class="card"><div class="steps">' + L.map(function (l, i) { return '<span class="' + (i === S.st ? 'on' : i < S.st ? 'done' : '') + '">' + (i < S.st ? '✓ ' : (i + 1) + '. ') + l + '</span>'; }).join('') + '</div>';
    h += '<div class="q">1. Ölçümler</div>' + (Object.keys(S.olc).length ? olcHTML(c) : '<p class="sub">Soldaki araçlarla ölçmeye başla. Nabzı ve solunumu say, dakikaya çevir.</p>');
    if (S.st === 0) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-adim="1">NEWS2 tablosuna geç →</button></div>';
    if (S.st >= 1) {
      h += '<div class="q">2. Her parametreyi puanla</div>' + newsTablo(c) + '<div class="toplam"><span>Toplam</span><b>' + top() + '</b>' + (S.st > 1 ? '<span class="pill ' + (top() === c.news.toplam ? 'ok' : 'bad') + '">doğrusu ' + c.news.toplam + '</span>' : '') + '</div>';
      if (S.st === 1) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-adim="2">Puanı kaydet →</button></div>';
    }
    if (S.st >= 2) {
      h += '<div class="q">3. Bu skor ne gerektirir?</div><div class="chk">' + Object.keys(V.YANIT).map(function (k) { var y = V.YANIT[k], on = S.yanit === k, cls = S.st > 2 ? (k === c.news.yanit ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<label class="' + cls + '"><input type="radio" name="yanit" value="' + k + '"' + (on ? ' checked' : '') + (S.st > 2 ? ' disabled' : '') + '><span><b>' + X(y.ad) + '</b> · ' + X(y.izlem) + '; ' + X(y.is) + '</span></label>'; }).join('') + '</div>';
      if (S.st === 2) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-adim="3">Hemşirelik sürecine geç →</button></div>';
    }
    if (S.st >= 3) {
      S.tKar = S.tKar || C.shuffle(c.h.tanilar.map(function (t, i) { return [String(i), t[0], t[1]]; }));
      S.gKar = S.gKar || C.shuffle(c.h.girisim.map(function (t, i) { return [String(i), t[0], t[1]]; }));
      h += '<div class="q">4a. Öncelikli hemşirelik tanısı</div><div class="chk">' + S.tKar.map(function (t) { var on = S.tani === t[0], cls = S.st > 3 ? (t[2] ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<label class="' + cls + '"><input type="radio" name="tani" value="' + t[0] + '"' + (on ? ' checked' : '') + (S.st > 3 ? ' disabled' : '') + '>' + X(t[1]) + '</label>'; }).join('') + '</div>';
      h += '<div class="q">4b. Girişimler <span class="sub">(birden çok)</span></div><div class="chk">' + S.gKar.map(function (t) { var on = !!S.gr[t[0]], cls = S.st > 3 ? (t[2] ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<label class="' + cls + '"><input type="checkbox" name="gr" value="' + t[0] + '"' + (on ? ' checked' : '') + (S.st > 3 ? ' disabled' : '') + '>' + X(t[1]) + '</label>'; }).join('') + '</div>';
      if (S.st === 3) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn grn" data-adim="4">Değerlendirmeyi kaydet</button></div>';
    }
    if (S.st >= 4) {
      var v = c.v, olc = ((+S.gir.nabiz === v.nabiz) + (+S.gir.sol === v.sol) + (S.gir.bilinc === v.bilinc)) / 3;
      var pr = V.NEWS_PARAM.filter(function (p) { return S.sk[p.id] === c.news.parca[p.id]; }).length / V.NEWS_PARAM.length;
      var yn = S.yanit === c.news.yanit ? 1 : 0, tn = c.h.tanilar[+S.tani] && c.h.tanilar[+S.tani][1] ? 1 : 0;
      var need = c.h.girisim.filter(function (g) { return g[1]; }).length, tp = 0, fp = 0; c.h.girisim.forEach(function (g, i) { if (S.gr[i]) { if (g[1]) tp++; else fp++; } });
      var gs = Math.max(0, (tp - fp) / need), pct = Math.round((olc + pr + yn * 1.5 + tn + gs) / 5.5 * 100);
      if (S.done[c.h.id] !== pct) { S.done[c.h.id] = pct; C.ls.set('yb.done', S.done); }
      h += C.karne(pct, c.k.hitap + ' · hasta başı karnesi', [[olc >= 0.99, 'Ölçüm ve dönüşüm: %' + Math.round(olc * 100)], [pr >= 0.99, 'NEWS2 parametreleri: ' + Math.round(pr * 7) + '/7 (toplam ' + c.news.toplam + ')'], [!!yn, 'Klinik yanıt: ' + X(V.YANIT[c.news.yanit].ad)], [!!tn, 'Hemşirelik tanısı'], [gs >= 0.99, 'Girişimler: %' + Math.round(gs * 100)]], '<b>Hedef:</b> ' + X(c.h.hedef) + ' <b>Yanıt:</b> ' + X(V.YANIT[c.news.yanit].is) + '.');
      h += '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-bastan>Baştan değerlendir</button>' + (S.i < HS.length - 1 ? '<button type="button" class="btn pri" data-sonraki>Sıradaki hasta →</button>' : '') + '</div>';
    }
    el().innerHTML = h + '</div></div>';
  };
  var bekle = false;
  HM.st.yatak = {
    init: function () {
      paint();
      el().addEventListener('input', function (e) { var g = e.target.getAttribute('data-g'); if (g) S.gir[g] = e.target.value.replace(/\D/g, ''); });
      el().addEventListener('change', function (e) { var t = e.target; if (t.name === 'yanit') S.yanit = t.value; else if (t.name === 'tani') S.tani = t.value; else if (t.name === 'gr') S.gr[t.value] = t.checked; });
      el().addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-h]'))) { S.i = +b.getAttribute('data-h'); sifirla(); paint(); HM.bridgeSend(); return; }
        if ((b = e.target.closest('[data-alet]'))) {
          if (bekle) return; var a = b.getAttribute('data-alet'); if (S.olc[a]) return;
          bekle = true; b.textContent = a === 'nabiz' ? 'Sayılıyor…' : a === 'sol' ? 'Göğüs izleniyor…' : 'Ölçülüyor…';
          setTimeout(function () { bekle = false; S.olc[a] = true; paint(); C.live(a + ' ölçüldü'); }, C.RM ? 0 : 900); return;
        }
        if ((b = e.target.closest('[data-acvpu]'))) { S.gir.bilinc = b.getAttribute('data-acvpu'); paint(); return; }
        if ((b = e.target.closest('[data-sk]'))) { S.sk[b.getAttribute('data-sk')] = +b.getAttribute('data-x'); paint(); return; }
        if (e.target.closest('[data-sonraki]')) { S.i++; sifirla(); paint(); el().scrollIntoView({ behavior: C.RM ? 'auto' : 'smooth', block: 'start' }); return; }
        if (e.target.closest('[data-bastan]')) { sifirla(); paint(); return; }
        if ((b = e.target.closest('[data-adim]'))) {
          var g = +b.getAttribute('data-adim');
          if (g === 1) { if (ALET.some(function (x) { return !S.olc[x[0]]; })) { C.toast('Önce altı ölçümün hepsini yap.'); return; } if (!S.gir.nabiz || !S.gir.sol || !S.gir.bilinc) { C.toast('Nabzı ve solunumu dakikaya çevir, bilinci ACVPU ile seç.'); return; } }
          if (g === 2 && V.NEWS_PARAM.some(function (p) { return S.sk[p.id] == null; })) { C.toast('Her parametreye bir puan ver.'); return; }
          if (g === 3 && !S.yanit) { C.toast('Bir klinik yanıt seç.'); return; }
          if (g === 4 && (!S.tani || !Object.keys(S.gr).some(function (k) { return S.gr[k]; }))) { C.toast('Tanıyı ve en az bir girişimi seç.'); return; }
          S.st = g; paint(); HM.bridgeSend();
        }
      });
    },
    ctx: function () {
      var c = cur();
      return { sel: { key: 'hem.yatak.' + c.h.id + '.' + S.st, title: 'Hasta başı · ' + c.k.hitap, la: 'Hasta başı ve vital', rows: [['Tanı', c.h.tani], ['Durum', c.h.durum]], about: 'öğrenci Hemşirelik Lab hasta başında vital bulguları ölçüp NEWS2 hesaplıyor (adım ' + (S.st + 1) + '). Skoru ya da tanıyı doğrudan söyleme; parametre aralıklarını hatırlat.' }, chips: [['news', 'NEWS2 aralıkları neler?'], ['yanit', 'Skora göre ne yapılır?']] };
    },
    classify: function (q) { if (/news|aralık|puan/.test(q)) return 'news'; if (/yanıt|ne yap|çağır/.test(q)) return 'yanit'; return null; },
    answer: function (k) {
      if (k === 'news') return 'NEWS2: solunum 12–20 → 0 (9–11: 1, 21–24: 2, ≤8 ya da ≥25: 3); SpO₂ ≥96 → 0 (94–95: 1, 92–93: 2, ≤91: 3); oksijen alıyorsa +2; sistolik 111–219 → 0 (101–110: 1, 91–100: 2, ≤90 ya da ≥220: 3); nabız 51–90 → 0 (41–50 ya da 91–110: 1, 111–130: 2, ≤40 ya da ≥131: 3); bilinç uyanık 0, değilse 3; ateş 36,1–38,0 → 0 (35,1–36,0 ya da 38,1–39,0: 1, ≥39,1: 2, ≤35,0: 3).';
      return 'Skor 0: en az 12 saatte bir; 1–4: 4–6 saatte bir, hemşire değerlendirir; tek parametrede 3: hekime acil haber, saatlik izlem; 5–6: acil yanıt, saatlik izlem; 7 ve üstü: acil müdahale ekibi, sürekli izlem.';
    }
  };
})();
