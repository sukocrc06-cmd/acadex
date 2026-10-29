/* ==========================================================================
   ACADEX FİNANS · DIŞ TİCARET (labs/finans/fn-dis.js), 29.10.2026
   1) Incoterms® 2020 rotası: 11 kural; konteyner satıcı deposundan alıcı deposuna
      yolculuk eder, risk geçiş noktasında renk değiştirir; masraf tablosu
   2) Teyitli akreditif akışı (UCP 600): adım adım belge yolculuğu
   3) İthalat maliyeti: FOB → CIF → gümrük vergisi → KDV (oranlar kurgusal)
   4) Hangi Incoterm? (8 senaryo, karne)
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, nf = C.nf, tl = C.tl, num = C.num;
  var IN = {}; V.INCO.forEach(function (r) { IN[r.k] = r; });
  var S = C.ls.get('dt', null) || { k: 'FOB', lc: 0, ic: { fob: 20000, nav: 1800, sig: 0.3, kur: 40, gv: 8, dig: 12000 }, q: null };
  var save = function () { C.ls.set('dt', S); };
  var sec, raf = 0;

  /* rota: konum (0..4.2) → x */
  var PX = [[0, 70], [1, 262], [2, 340], [3, 612], [4, 830], [4.2, 858]];
  var posX = function (p) { for (var i = 1; i < PX.length; i++) if (p <= PX[i][0]) { var a = PX[i - 1], b = PX[i]; return a[1] + (p - a[0]) / (b[0] - a[0]) * (b[1] - a[1]); } return PX[PX.length - 1][1]; };
  /* konteynerin yolculuğu: [x, y] ara noktalar (y: kara 138, gemi güvertesi 152) */
  var PATH = [[70, 138], [262, 138], [300, 96], [340, 146], [612, 146], [640, 96], [680, 138], [830, 138]];
  var at = function (k) { /* k: 0..1 yol boyunca */
    var L = [0], i; for (i = 1; i < PATH.length; i++) L.push(L[i - 1] + Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]));
    var d = k * L[L.length - 1]; for (i = 1; i < PATH.length; i++) if (d <= L[i]) { var f = (d - L[i - 1]) / (L[i] - L[i - 1]); return [PATH[i - 1][0] + f * (PATH[i][0] - PATH[i - 1][0]), PATH[i - 1][1] + f * (PATH[i][1] - PATH[i - 1][1])]; }
    return PATH[PATH.length - 1];
  };
  var routeSvg = function () {
    var g = '<svg class="route" viewBox="0 0 900 250" role="img" aria-label="satıcı deposundan alıcı deposuna rota">';
    g += '<rect width="900" height="250" fill="#EAF3FA"/><rect x="290" y="160" width="350" height="90" fill="#2C77B0"/><g class="wv" fill="#fff" opacity=".25"><rect x="290" y="176" width="20" height="3" rx="1.5"/><rect x="350" y="196" width="26" height="3" rx="1.5"/><rect x="420" y="182" width="20" height="3" rx="1.5"/><rect x="480" y="206" width="26" height="3" rx="1.5"/><rect x="540" y="186" width="20" height="3" rx="1.5"/><rect x="600" y="200" width="20" height="3" rx="1.5"/><rect x="650" y="190" width="20" height="3" rx="1.5"/></g>';
    g += '<rect x="0" y="152" width="300" height="98" fill="#D9DED6"/><rect x="630" y="152" width="270" height="98" fill="#D9DED6"/><path d="M0 152H300M630 152H900" stroke="#9AA6B8" stroke-width="2"/>';
    /* depolar */
    g += '<g><path d="M30 152V100l40-22 40 22v52z" fill="#FFFDF8" stroke="#0D1838" stroke-width="2.5"/><rect x="56" y="122" width="28" height="30" fill="#C8553D"/><text x="70" y="70" text-anchor="middle" font-size="13" font-weight="800" fill="#C8553D">SATICI</text></g>';
    g += '<g><path d="M790 152V100l40-22 40 22v52z" fill="#FFFDF8" stroke="#0D1838" stroke-width="2.5"/><rect x="816" y="122" width="28" height="30" fill="#1F8A7A"/><text x="830" y="70" text-anchor="middle" font-size="13" font-weight="800" fill="#1F8A7A">ALICI</text></g>';
    /* vinçler */
    var crane = function (x) { return '<g stroke="#0D1838" stroke-width="3" fill="none"><path d="M' + x + ' 152V40M' + (x - 30) + ' 44H' + (x + 46) + 'M' + x + ' 64L' + (x + 40) + ' 44"/><path d="M' + (x + 36) + ' 44v34" stroke-width="1.5"/></g><rect x="' + (x - 10) + '" y="148" width="20" height="6" fill="#E0A526"/>'; };
    g += crane(262) + crane(612);
    g += '<text x="262" y="30" text-anchor="middle" font-size="11.5" font-family="JetBrains Mono,monospace" fill="#46506A">yükleme limanı</text><text x="612" y="30" text-anchor="middle" font-size="11.5" font-family="JetBrains Mono,monospace" fill="#46506A">varış limanı</text>';
    /* gemi */
    g += '<g><path d="M320 158h300l-14 22H336z" fill="#1E5B8C"/><rect x="560" y="132" width="24" height="26" fill="#F4F1EA" stroke="#0D1838" stroke-width="1.5"/><path d="M466 158v-34" stroke="#0D1838" stroke-width="2"/><text x="470" y="216" text-anchor="middle" font-size="11" font-family="JetBrains Mono,monospace" fill="#fff" opacity=".9">ana taşıma (navlun)</text></g>';
    /* risk bayrağı */
    g += '<g class="flag" data-flag><path d="M0 152V18" stroke="#0D1838" stroke-width="2.5"/><path d="M0 20h58l-10 11 10 11H0z" fill="#F2C230" stroke="#0D1838" stroke-width="2"/><text x="6" y="35.5" font-size="11.5" font-weight="800" fill="#0D1838">RİSK</text></g>';
    /* konteyner */
    g += '<g class="cont" data-cont><rect class="cbox" data-cbox x="-24" y="-16" width="48" height="26" rx="2" fill="#C8553D" stroke="#0D1838" stroke-width="2"/><path d="M-16 -12v18M-8 -12v18M0 -12v18M8 -12v18M16 -12v18" stroke="rgba(255,255,255,.35)" stroke-width="2"/></g>';
    g += '<text data-rl x="450" y="242" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0D1838"></text></svg>';
    return g;
  };
  var html = function () {
    var keys = V.INCO.map(function (r) { return '<button type="button" data-ik="' + r.k + '"' + (r.mod === 'deniz' ? ' class="sw" title="yalnız deniz ve iç su yolu"' : '') + '>' + r.k + '</button>'; }).join('');
    return '<div class="grid">' +
      '<div class="card box" style="--cc:var(--must)"><span class="k">istasyon · rıhtım · Incoterms® 2020</span><h2>Risk nerede el değiştiriyor, masrafı kim ödüyor?</h2><p class="sub">Bir kural seç ve yolculuğu oynat. Konteyner sarı bayrağı geçtiği an risk alıcıya geçer. Altı çizili kurallar yalnız deniz ve iç su yolu taşımacılığı içindir.</p>' +
      '<div class="inc-k" data-inc>' + keys + '</div><div data-iname style="margin-top:10px"></div><div class="route-w">' + routeSvg() + '</div>' +
      '<div class="row" style="margin-top:8px"><button type="button" class="btn deep" data-play>Yolculuğu oynat</button><span class="sub" style="margin:0" data-riskt></span></div>' +
      '<div class="grid g2" style="margin-top:14px"><div><h3>Masraf kimde?</h3><div class="who" data-who></div><div class="leg"><span><i style="background:var(--S)"></i>satıcı öder</span><span><i style="background:var(--A)"></i>alıcı öder</span><span><i style="background:var(--S-s);border:1px dashed var(--S)"></i>zorunlu değil (riski taşıyanın menfaati)</span></div></div><div data-inote></div></div></div>' +
      '<div class="grid g2">' +
      '<div class="card box" style="--cc:var(--deep)"><span class="k">ödeme · UCP 600</span><h3>Teyitli akreditif: belgeler nasıl yol alır?</h3><p class="sub">Banka malla değil belgeyle ilgilenir. Adımları tek tek ilerlet.</p><div class="lc-w" data-lc></div><div class="steps" data-lcs></div><div class="row"><button type="button" class="btn sm" data-lcp>Önceki</button><button type="button" class="btn sm pri" data-lcn>Sonraki adım</button></div><div class="tipbox" data-lct style="margin-top:12px"></div></div>' +
      '<div class="card box" style="--cc:var(--rust)"><span class="k">gümrük masası · oranlar kurgusal</span><h3>İthalat maliyeti: FOB’dan depoya</h3><div class="fl" data-ic></div><div data-c="ic" style="margin-top:12px"></div><div class="kpis" data-k="ic"></div><p class="sub" style="margin:0">Türkiye’de gümrük kıymeti CIF esaslıdır. Gerçek gümrük vergisi oranı malın GTİP’ine ve menşeine göre değişir; burada kurgusal bir oran kullanılıyor. İthalatta ödenen KDV, KDV mükellefi için indirilebilir.</p></div>' +
      '</div>' +
      '<div class="card box" style="--cc:var(--green)"><span class="k">sına kendini</span><h3>Hangi Incoterm?</h3><div data-q></div></div>' +
      '</div>';
  };

  /* ---------- Incoterms ---------- */
  var paintInc = function () {
    var r = IN[S.k];
    $$('[data-inc] button', sec).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ik') === S.k)); });
    $('[data-iname]', sec).innerHTML = '<b class="disp" style="font-size:20px">' + r.k + '</b> <span style="font-weight:600">' + X(r.ad) + '</span> <span class="pill' + (r.mod === 'deniz' ? ' warn' : '') + '">' + (r.mod === 'deniz' ? 'yalnız deniz / iç su yolu' : 'her taşıma türü') + '</span>';
    var fx = posX(r.risk), flag = $('[data-flag]', sec);
    flag.style.transform = 'translate(' + fx + 'px,0)';
    $('[data-riskt]', sec).innerHTML = 'Risk geçişi: <b>' + X(r.yer) + '</b>';
    var who = '<div class="h">masraf kalemi</div><div class="h">satıcı</div><div class="h">alıcı</div>';
    V.KALEM.forEach(function (k, i) {
      var m = r.m[i], up = m.toUpperCase(), opt = m !== up, t = i === 5 && (r.k === 'CIF' || r.k === 'CIP') ? (r.k === 'CIF' ? 'ICC (C)' : 'ICC (A)') : '✓';
      who += '<div class="lb">' + X(k) + '</div><div class="c ' + (up === 'S' ? (opt ? 's' : 'S') : 'e') + '">' + (up === 'S' ? (opt ? 'isteğe' : t) : '') + '</div><div class="c ' + (up === 'A' ? (opt ? 'a' : 'A') : 'e') + '">' + (up === 'A' ? (opt ? 'isteğe' : t) : '') + '</div>';
    });
    $('[data-who]', sec).innerHTML = who;
    var ns = r.m.split('').filter(function (c) { return c === 'S'; }).length;
    $('[data-inote]', sec).innerHTML = C.tip(X(r.not) + '<br><br>Bu kuralda zorunlu 10 masraf kaleminin <b>' + ns + '</b>’i satıcıda. EXW’den DDP’ye gittikçe satıcının yükü artar.', r.k);
    place(0, false);
  };
  var place = function (k, moving) {
    /* durağanken mal satıcıda; yolculukta bayrağı geçince (D grubunda varışta) risk alıcıya geçer */
    var p = at(k), r = IN[S.k], fx = posX(r.risk), passed = !!moving && (p[0] >= fx - 0.5 || k >= 1);
    var c = $('[data-cont]', sec); c.style.transition = 'none'; c.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)';
    $('[data-cbox]', sec).setAttribute('fill', passed ? '#1F8A7A' : '#C8553D');
    $('[data-rl]', sec).textContent = moving ? (passed ? 'risk alıcıda' : 'risk satıcıda') : '';
    /* dar ekranda rota kayar: konteyner görüş alanında kalsın */
    var rw = $('.route-w', sec);
    if (rw && rw.scrollWidth > rw.clientWidth + 2) { var sv = rw.querySelector('svg'), sc = sv.getBoundingClientRect().width / 900; rw.scrollLeft = moving ? Math.max(0, p[0] * sc - rw.clientWidth / 2) : 0; }
    return passed;
  };
  var play = function () {
    cancelAnimationFrame(raf);
    var t0 = performance.now(), dur = C.RM ? 1 : 5200, was = false;
    var step = function (t) {
      var k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, ps = place(e, true);
      if (ps && !was) { was = true; C.live('Risk alıcıya geçti: ' + IN[S.k].yer); }
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  /* ---------- akreditif ---------- */
  /* telefonda dikey yerleşim: yazılar okunur kalsın, yatay kaydırma gerekmesin */
  var LPW = { alici: [110, 64], amir: [110, 226], ihbar: [590, 226], satici: [590, 64], tasiyici: [350, 145] };
  var LPM = { alici: [92, 70], amir: [92, 330], ihbar: [268, 330], satici: [268, 70], tasiyici: [180, 200] };
  var LP = LPW;
  var paintLC = function (anim) {
    var mob = (window.innerWidth || 1024) < 600, bw = mob ? 168 : 156; LP = mob ? LPM : LPW;
    var i = S.lc, a = V.LC_ADIM[i], from = LP[a[0]], to = LP[a[1]];
    var ln = function (p, q) { return 'M' + LP[p][0] + ' ' + LP[p][1] + 'L' + LP[q][0] + ' ' + LP[q][1]; };
    var g = '<svg class="lc' + (mob ? ' mob' : '') + '" viewBox="0 0 ' + (mob ? '360 400' : '700 290') + '" role="img" aria-label="akreditif akışı">';
    g += '<g stroke="#CBD5E1" stroke-width="2" stroke-dasharray="5 6" fill="none"><path d="' + ln('alici', 'satici') + ln('alici', 'amir') + ln('amir', 'ihbar') + ln('satici', 'ihbar') + ln('alici', 'tasiyici') + ln('satici', 'tasiyici') + '"/></g>';
    V.LC_AKTOR.forEach(function (ak) { var p = LP[ak[0]], on = ak[0] === a[0] || ak[0] === a[1]; g += '<g class="act' + (on ? ' on' : '') + '"><rect x="' + (p[0] - bw / 2) + '" y="' + (p[1] - 24) + '" width="' + bw + '" height="48" rx="10" fill="#fff" stroke="#0D1838" stroke-width="2"/><text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" font-size="' + (mob ? 13 : 13.5) + '" font-weight="700" fill="#0D1838">' + X(ak[1]) + '</text></g>'; });
    g += '<g class="doc" data-doc style="transform:translate(' + from[0] + 'px,' + (from[1] - 40) + 'px)"><rect x="-70" y="-13" width="140" height="26" rx="5" fill="#F2C230" stroke="#0D1838" stroke-width="1.6"/><text x="0" y="4" text-anchor="middle" font-size="12" font-weight="700" fill="#0D1838">' + X(a[2]) + '</text></g></svg>';
    $('[data-lc]', sec).innerHTML = g;
    var d = $('[data-doc]', sec);
    if (anim && !C.RM) { void d.getBoundingClientRect(); requestAnimationFrame(function () { d.style.transform = 'translate(' + to[0] + 'px,' + (to[1] - 40) + 'px)'; }); }
    else d.style.transform = 'translate(' + to[0] + 'px,' + (to[1] - 40) + 'px)';
    $('[data-lcs]', sec).innerHTML = V.LC_ADIM.map(function (_, k) { return '<button type="button" data-lci="' + k + '"' + (k === i ? ' aria-current="step"' : '') + ' class="' + (k < i ? 'done' : '') + '" aria-label="' + (k + 1) + '. adım">' + (k + 1) + '</button>'; }).join('');
    $('[data-lct]', sec).innerHTML = C.hesi(48, (i + 1) + '/10') + '<p><b>' + (i + 1) + '. ' + X(a[2]) + '.</b> ' + X(a[3]) + '</p>';
  };

  /* ---------- ithalat maliyeti ---------- */
  var IC = [['fob', 'FOB bedel (USD)'], ['nav', 'Navlun (USD)'], ['sig', 'Sigorta oranı (%)'], ['kur', 'Kur (TL/USD, kurgusal)'], ['gv', 'Gümrük vergisi (%, kurgusal)'], ['dig', 'Diğer masraflar (TL)']];
  var landed = function (o) {
    var sig = (o.fob + o.nav) * 1.1 * o.sig / 100, cif = o.fob + o.nav + sig, kiy = cif * o.kur, gv = kiy * o.gv / 100, mat = kiy + gv + o.dig, kdv = mat * 0.20;
    return { sig: sig, cif: cif, kiy: kiy, gv: gv, mat: mat, kdv: kdv, mal: kiy + gv + o.dig, odeme: kiy + gv + o.dig + kdv };
  };
  FN.dis = { posX: posX, landed: landed };
  var paintIC = function () {
    var o = S.ic, L = landed(o), K = o.kur;
    var bars = [{ x: 0, y0: 0, y1: o.fob * K, c: '#2F6FB0', lab: 'FOB' }, { x: 1, y0: o.fob * K, y1: (o.fob + o.nav) * K, c: '#1E5B8C', lab: 'navlun' }, { x: 2, y0: (o.fob + o.nav) * K, y1: L.kiy, c: '#1F8A7A', lab: 'sigorta' },
      { x: 3, y0: 0, y1: L.kiy, c: '#0D1838', lab: 'gümrük kıymeti (CIF)' }, { x: 4, y0: L.kiy, y1: L.kiy + L.gv, c: '#C8553D', lab: 'gümrük vergisi' }, { x: 5, y0: L.kiy + L.gv, y1: L.mat, c: '#E0A526', lab: 'diğer' }, { x: 6, y0: L.mat, y1: L.odeme, c: '#6B4FB3', lab: 'KDV %20' }];
    var lbl = ['FOB', 'navlun', 'sigorta', 'CIF', 'GV', 'diğer', 'KDV'];
    $('[data-c="ic"]', sec).innerHTML = C.chart({ w: 560, h: 230, x: [-0.6, 6.6], y0: true, bars: bars, nb: 7, xticks: [0, 1, 2, 3, 4, 5, 6], xf: function (v) { return lbl[v] || ''; }, yf: function (v) { return v >= 1e6 ? nf(v / 1e6, 1) + ' mn' : nf(v / 1e3) + ' bin'; }, al: 'ithalat maliyeti şelalesi (TL)' });
    $('[data-k="ic"]', sec).innerHTML = '<div class="kpi"><small>CIF (USD)</small><b>' + nf(L.cif, 0) + '</b></div><div class="kpi"><small>gümrük vergisi</small><b>' + tl(L.gv) + '</b></div><div class="kpi"><small>KDV</small><b>' + tl(L.kdv) + '</b></div><div class="kpi hl"><small>depoya maliyet (KDV hariç)</small><b>' + tl(L.mal) + '</b></div>';
  };

  /* ---------- sınav ---------- */
  var newQuiz = function () { S.q = { ord: C.shuffle(V.INCO_SORU.map(function (_, i) { return i; })), i: 0, ok: 0, miss: [], try: 0 }; save(); };
  var paintQ = function () {
    var Q = S.q, box = $('[data-q]', sec);
    if (!Q) { box.innerHTML = '<p class="sub">8 kısa senaryo. Her biri için doğru kuralı seç.</p><button type="button" class="btn pri" data-qs>Başla</button>'; return; }
    if (Q.i >= Q.ord.length) {
      var p = Q.ok / Q.ord.length * 100;
      box.innerHTML = C.karne(p, 'Incoterms karnesi', [[Q.ok === Q.ord.length, 'İlk denemede doğru: ' + Q.ok + ' / ' + Q.ord.length]].concat(Q.miss.map(function (m) { return [false, X(m)]; })), 'Risk ve masrafın ayrıldığı C grubunda (CFR, CIF, CPT, CIP) dikkat: satıcı navlunu öder ama risk yükleme yerinde geçer.') + '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-qs>Yeniden çöz</button></div>';
      return;
    }
    var q = V.INCO_SORU[Q.ord[Q.i]], pool = V.INCO.map(function (r) { return r.k; }).filter(function (k) { return k !== q.k; });
    var seed = Q.ord[Q.i] * 7 + 3, alt = []; while (alt.length < 3) { var c = pool[(seed + alt.length * 5) % pool.length]; if (alt.indexOf(c) < 0) alt.push(c); else seed++; }
    var opts = alt.concat([q.k]).sort();
    box.innerHTML = '<div class="prog"><i style="width:' + (Q.i / Q.ord.length * 100) + '%"></i></div><div class="q"><span class="k">senaryo ' + (Q.i + 1) + ' / ' + Q.ord.length + '</span><p>' + X(q.q) + '</p><div class="opts">' + opts.map(function (o) { return '<button type="button" data-qa="' + o + '">' + o + '</button>'; }).join('') + '</div><div class="fb" data-qfb></div></div>';
  };
  var answerQ = function (k, b) {
    var Q = S.q, q = V.INCO_SORU[Q.ord[Q.i]], fb = $('[data-qfb]', sec);
    if (k === q.k) {
      b.classList.add('ok'); $$('[data-qa]', sec).forEach(function (x) { x.disabled = true; });
      if (!Q.try) Q.ok++; else Q.miss.push(q.k + ': ' + q.q);
      fb.innerHTML = '<b style="color:var(--ok)">Doğru: ' + q.k + '.</b> ' + X(IN[q.k].not);
      Q.i++; Q.try = 0; save(); setTimeout(paintQ, C.RM ? 200 : 1800);
    } else { Q.try++; save(); b.classList.add('no'); b.disabled = true; fb.innerHTML = '<b style="color:var(--bad)">' + k + ' değil.</b> ' + X(k + ': risk ' + IN[k].yer + '.'); }
    FN.bridgeSend();
  };

  FN.st.dis = {
    init: function () {
      sec = $('#dis'); sec.innerHTML = html();
      $('[data-ic]', sec).innerHTML = IC.map(function (x) { return '<label class="fld">' + x[1] + '<input type="text" inputmode="decimal" data-icv="' + x[0] + '" value="' + nf(S.ic[x[0]], x[0] === 'sig' ? 2 : 0) + '"></label>'; }).join('');
      paintInc(); paintLC(false); paintIC(); paintQ();
      sec.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ik]'); if (b) { S.k = b.getAttribute('data-ik'); save(); cancelAnimationFrame(raf); paintInc(); FN.bridgeSend(); return; }
        if (e.target.closest('[data-play]')) { play(); return; }
        if (e.target.closest('[data-lcn]')) { S.lc = (S.lc + 1) % V.LC_ADIM.length; save(); paintLC(true); FN.bridgeSend(); return; }
        if (e.target.closest('[data-lcp]')) { S.lc = (S.lc + V.LC_ADIM.length - 1) % V.LC_ADIM.length; save(); paintLC(true); FN.bridgeSend(); return; }
        var li = e.target.closest('[data-lci]'); if (li) { S.lc = +li.getAttribute('data-lci'); save(); paintLC(true); FN.bridgeSend(); return; }
        if (e.target.closest('[data-qs]')) { newQuiz(); paintQ(); FN.bridgeSend(); return; }
        var qa = e.target.closest('[data-qa]'); if (qa && !qa.disabled) answerQ(qa.getAttribute('data-qa'), qa);
      });
      sec.addEventListener('input', function (e) { var k = e.target.getAttribute('data-icv'); if (!k) return; var v = num(e.target.value); if (!isFinite(v) || v < 0) return; S.ic[k] = v; save(); paintIC(); FN.bridgeSend(); });
    },
    hide: function () { cancelAnimationFrame(raf); },
    ctx: function () {
      var r = IN[S.k], L = landed(S.ic), a = V.LC_ADIM[S.lc];
      return { sel: { key: 'finans.dis.' + S.k, title: r.k + ' · ' + r.ad.split(' · ')[1], la: 'Dış ticaret',
          rows: [['Kural', r.k + ' (' + r.ad + '), ' + (r.mod === 'deniz' ? 'yalnız deniz' : 'her taşıma türü')], ['Risk geçişi', r.yer], ['Satıcının masrafları', V.KALEM.filter(function (_, i) { return r.m[i] === 'S'; }).join(', ') || 'yok'], ['Akreditif adımı', (S.lc + 1) + '. ' + a[2]], ['İthalat', 'CIF ' + nf(L.cif) + ' USD, depoya maliyet ' + tl(L.mal) + ' (kurgusal oranlar)']].concat(S.q && S.q.i < S.q.ord.length ? [['Sınav', 'senaryo ' + (S.q.i + 1) + ' çözülüyor: cevabı söyleme']] : []),
          about: 'öğrenci Acadex Finans dış ticaret istasyonunda Incoterms 2020, akreditif (UCP 600) ve ithalat maliyetini çalışıyor. Uluslararası ticaret öğrencisi.' },
        chips: [['risk', r.k + ' kuralında risk nerede geçer?'], ['fark', 'FOB ile FCA farkı ne?'], ['lc', 'Bu akreditif adımında ne oluyor?']] };
    },
    classify: function (q) { if (/fca|fob/.test(q) && /fark/.test(q)) return 'fark'; if (/risk/.test(q)) return 'risk'; if (/akreditif|vesaik|ucp/.test(q)) return 'lc'; return null; },
    answer: function (k) {
      var r = IN[S.k];
      if (k === 'risk') { if (S.q && S.q.i < S.q.ord.length) return 'Senaryo sınavı sürüyor; önce onu kendi başına çöz, sonra kuralları birlikte inceleriz.'; return r.k + ' kuralında risk ' + r.yer + ' geçer. ' + r.not; }
      if (k === 'fark') return 'FOB yalnız deniz ve iç su yolunda kullanılır; risk mal gemiye yüklenince geçer. FCA her taşıma türüne uyar; risk mal adlandırılan yerde alıcının taşıyıcısına teslim edilince geçer. Konteyner yük genellikle gemiye yüklenmeden çok önce terminalde teslim edildiği için ICC konteynerde FOB yerine FCA’yı önerir: aksi hâlde satıcı, kontrol edemediği terminal-gemi arasındaki riski taşır.';
      if (k === 'lc') { var a = V.LC_ADIM[S.lc]; return (S.lc + 1) + '. adım, ' + a[2] + ': ' + a[3] + ' Akreditifte bankalar malla değil belgelerle ilgilenir; belgeler akreditif şartlarına birebir uymazsa (uyumsuzluk) banka ödemeyi reddedebilir.'; }
      return null;
    }
  };
})();
