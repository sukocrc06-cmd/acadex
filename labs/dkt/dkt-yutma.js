/* ==========================================================================
   ACADEX DKT LAB · YUTMA MASASI (labs/dkt/dkt-yutma.js), 29.10.2026
   Yutmanın dört evresi (canlandırmalı kesit), IDDSI şırınga akış testi ve
   kıvam düzeyleri, Penetrasyon-Aspirasyon Skalası (PAS) simülatörü.
   ========================================================================== */
(function () {
  'use strict';
  var DK = window.DK, C = DK.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, tr = C.tr;
  var S = { ev: 'hazirlik', play: null, sy: null, syRun: null, idd: 0, d: 'ust', e: 'evet', syDone: C.ls.get('y.sy', {}) };
  var POS = { hazirlik: [112, 176], oral: [196, 186], faringeal: [246, 250], ozofageal: [262, 300] };

  /* ---------- evreler ---------- */
  var swSVG = function () {
    return '<svg viewBox="0 0 360 330" role="img" aria-label="Yutma kesiti: ağız, yutak, gırtlak ve yemek borusu">' +
      '<path d="M40 60 C80 40 140 44 160 70 L164 110 C130 116 90 116 54 124 C44 130 46 142 58 146 L62 160 C54 170 56 182 64 186 C54 196 56 208 66 212 C64 232 80 248 110 250 L180 254" fill="#FCE9DB" stroke="#0D1838" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M60 126 C110 104 180 102 214 116 L218 132 C180 124 120 124 104 140 Z" fill="#EAF2FC" stroke="#9DB8E8" stroke-width="2"/>' +
      '<path d="M100 150 C130 138 170 134 200 134 L201 141 C170 141 134 146 104 158 Z" fill="#E8D8C4" stroke="#7A5230" stroke-width="2"/>' +
      '<g class="velum2"><path d="M200 134 C212 134 222 142 228 156 C230 164 228 170 222 170 C218 162 210 150 201 141 Z" fill="#F4B6AE" stroke="#A8412B" stroke-width="2"/></g>' +
      '<path d="M64 182 C72 178 84 176 94 180 L92 188 C84 188 74 190 64 190 Z" fill="#E88E7E" stroke="#0D1838" stroke-width="2"/><path d="M64 194 C74 193 84 194 92 196 L94 206 C84 210 72 208 64 206 Z" fill="#E88E7E" stroke="#0D1838" stroke-width="2"/>' +
      '<path d="M100 200 C108 186 128 180 154 178 C184 176 210 176 222 190 C232 202 234 226 232 252 C210 254 180 254 150 250 C120 244 102 232 100 214 Z" fill="#F08A80" stroke="#0D1838" stroke-width="2.6"/>' +
      /* yutak arka duvarı */
      '<path d="M238 118 C256 150 262 200 264 250" fill="none" stroke="#0D1838" stroke-width="3"/>' +
      /* yemek borusu (arkada) */
      '<path d="M252 258 L252 330 M276 252 L276 330" fill="none" stroke="#0D1838" stroke-width="3"/>' +
      '<rect class="ues" x="252" y="262" width="24" height="10" rx="3" fill="#C9483B" opacity=".85"/>' +
      '<text x="284" y="300" font-family="JetBrains Mono" font-size="10" fill="#6A7593">yemek borusu</text>' +
      /* gırtlak + soluk borusu (önde) */
      '<g class="larynx"><path d="M214 262 L214 330 M240 258 L240 330" fill="none" stroke="#2457C5" stroke-width="3"/><path d="M216 290 L227 296 L238 290" fill="none" stroke="#A8412B" stroke-width="4" stroke-linecap="round"/>' +
      '<g class="epi"><path d="M240 222 C244 236 244 248 240 258" fill="none" stroke="#7A5230" stroke-width="5" stroke-linecap="round"/></g>' +
      '<text x="150" y="318" font-family="JetBrains Mono" font-size="10" fill="#2457C5">soluk borusu</text></g>' +
      '<circle class="bolus" r="11" cx="0" cy="0" fill="#F6D04D" stroke="#8A5A00" stroke-width="2.4" transform="translate(112 176)"/>' +
      '</svg>';
  };
  var setEv = function (k) {
    S.ev = k; $('#sw').setAttribute('data-ev', k);
    var e = V.EVRE.filter(function (x) { return x.k === k; })[0], p = POS[k];
    $$('#ev-st [data-ev]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ev') === k)); });
    var bol = $('#sw .bolus'); if (bol) bol.setAttribute('transform', 'translate(' + p[0] + ' ' + p[1] + ')');
    $('#ev-t').innerHTML = '<b>' + X(e.t) + '</b><span class="pill">' + X(e.s) + '</span><p>' + X(e.d) + '</p><div class="bel"><b style="display:inline;font-size:13px;font-family:inherit">Bozulursa:</b> ' + X(e.b) + '</div>';
    DK.bridgeSend();
  };
  var playAll = function () {
    clearTimeout(S.play); var ks = V.EVRE.map(function (e) { return e.k; }), i = 0;
    var step = function () { setEv(ks[i]); i++; if (i < ks.length) S.play = setTimeout(step, C.RM ? 400 : 2000); };
    step();
  };

  /* ---------- şırınga akış testi ---------- */
  var ML_TOP = 26, ML_PX = 18; /* 10 mL çizgisi y=26, her mL 18 px → 0 mL y=206 */
  var syrSVG = function () {
    var t = ''; for (var m = 0; m <= 10; m++) { var y = ML_TOP + (10 - m) * ML_PX; t += '<path d="M54 ' + y + 'h' + (m % 5 ? 8 : 14) + '" stroke="#0D1838" stroke-width="1.5"/>' + (m % 5 ? '' : '<text x="74" y="' + (y + 4) + '" font-family="JetBrains Mono" font-size="10" fill="#46506A">' + m + '</text>'); }
    return '<svg viewBox="0 0 120 260" aria-hidden="true"><rect x="30" y="14" width="24" height="196" rx="4" fill="#fff" stroke="#0D1838" stroke-width="2.5"/>' +
      '<rect class="liq" id="sy-liq" x="32" y="' + ML_TOP + '" width="20" height="' + (10 * ML_PX) + '" fill="#F6D04D" opacity=".85"/>' + t +
      '<path d="M38 210 L46 210 L44 226 L40 226 Z" fill="#fff" stroke="#0D1838" stroke-width="2"/><circle class="drip" cx="42" cy="232" r="3.5" fill="#F6D04D"/>' +
      '<path d="M22 14 H62" stroke="#0D1838" stroke-width="4" stroke-linecap="round"/></svg>';
  };
  var setLiq = function (ml) { var r = $('#sy-liq'); if (!r) return; var h = Math.max(0, ml) * ML_PX; r.setAttribute('height', h); r.setAttribute('y', ML_TOP + (10 * ML_PX - h)); };
  var syLevel = function (k) { if (k == null) return 4; if (k < 1) return 0; if (k <= 4) return 1; if (k <= 8) return 2; return 3; };
  var pickSy = function (k) {
    if (S.syRun) return;
    S.sy = V.SIRINGA.filter(function (s) { return s.k === k; })[0]; S.syAns = false;
    $$('#sy-pick [data-sy]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sy') === k)); });
    setLiq(10); $('#sy-st').textContent = 'Örnek ' + k + ': 10 mL dolu.'; $('#sy-go').disabled = false; $('#sy-lvl').innerHTML = ''; $('#sy-fb').innerHTML = '';
  };
  var runSy = function () {
    if (!S.sy || S.syRun) return;
    var end = S.sy.kalan == null ? 10 : S.sy.kalan, t0 = performance.now(), dur = C.RM ? 1500 : 10000;
    $('#syr').classList.toggle('run', S.sy.kalan != null); $('#sy-go').disabled = true;
    var tick = function (now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 1.6), ml = 10 - (10 - end) * e;
      setLiq(ml); $('#sy-st').textContent = tr(p * 10, 1) + ' sn · kalan ' + tr(ml, 1) + ' mL';
      if (p < 1) { S.syRun = requestAnimationFrame(tick); return; }
      S.syRun = null; $('#syr').classList.remove('run');
      $('#sy-st').textContent = S.sy.kalan == null ? '10 sn: şırıngadan hiç akmadı.' : '10 sn: şırıngada ' + tr(S.sy.kalan, 1) + ' mL kaldı.';
      $('#sy-lvl').innerHTML = [0, 1, 2, 3, 4].map(function (n) { var d = V.IDDSI[n]; return '<button type="button" data-lv="' + n + '" style="--lc:' + d.c + '"><i style="color:' + (n === 0 ? '#0D1838' : '#fff') + '">' + n + '</i>' + X(d.ad) + '</button>'; }).join('');
      $('#sy-go').disabled = false;
    };
    S.syRun = requestAnimationFrame(tick);
  };
  var ansSy = function (n) {
    if (!S.sy || S.syAns) return;
    var ok = syLevel(S.sy.kalan), d = V.IDDSI[ok]; S.syAns = true;
    $$('#sy-lvl [data-lv]').forEach(function (b) { var v = +b.getAttribute('data-lv'); if (v === ok) b.classList.add('ok'); else if (v === n) b.classList.add('no'); });
    $('#sy-fb').innerHTML = '<div class="rule"><b>' + (n === ok ? 'Doğru: ' : 'Doğrusu: ') + 'IDDSI ' + ok + ' · ' + X(d.ad) + '.</b> ' + X(d.test) + '</div>';
    if (n === ok) { S.syDone[S.sy.k] = 1; C.ls.set('y.sy', S.syDone); }
    DK.bridgeSend();
  };

  /* ---------- IDDSI düzeyleri ---------- */
  var paintIdd = function () {
    $('#idd').innerHTML = V.IDDSI.map(function (d) { return '<button type="button" data-id="' + d.n + '" aria-pressed="' + (d.n === S.idd) + '" style="--lc:' + d.c + '"><i style="color:' + (d.n === 0 ? '#0D1838' : '#fff') + '">' + d.n + '</i><b>' + X(d.ad) + '</b><small>' + X(d.tur) + '</small></button>'; }).join('');
    var d = V.IDDSI[S.idd];
    $('#idd-d').innerHTML = '<b>IDDSI ' + d.n + ' · ' + X(d.ad) + '</b><br>' + X(d.d) + '<br><span class="mono" style="font-size:12.5px">Test: ' + X(d.test) + '</span>';
  };

  /* ---------- PAS ---------- */
  var DEPTH = [['yok', 'Hava yoluna girmedi'], ['ust', 'Ses tellerinin üstünde'], ['tel', 'Ses tellerine değdi'], ['alt', 'Ses tellerinin altına geçti']];
  var EJ = [['evet', 'Atıldı'], ['caba', 'Atılmadı, çaba var'], ['yok', 'Atılmadı, çaba yok']];
  var pasScore = function (d, e) {
    if (d === 'yok') return 1;
    if (d === 'ust') return e === 'evet' ? 2 : 3;
    if (d === 'tel') return e === 'evet' ? 4 : 5;
    return e === 'evet' ? 6 : e === 'caba' ? 7 : 8;
  };
  var pasSVG = function () {
    return '<svg viewBox="0 0 220 260" role="img" aria-label="Gırtlak kesiti, PAS">' +
      '<path d="M40 10 C40 60 40 120 50 250 M180 10 C180 60 180 120 170 250" fill="none" stroke="#0D1838" stroke-width="3"/>' +
      '<path d="M110 10 L110 70" stroke="#0D1838" stroke-width="2" stroke-dasharray="4 4"/>' +
      '<text x="56" y="34" font-family="JetBrains Mono" font-size="10" fill="#6A7593">yutak</text>' +
      '<path d="M112 60 C150 60 170 72 176 90" fill="none" stroke="#7A5230" stroke-width="6" stroke-linecap="round"/><text x="150" y="56" font-family="JetBrains Mono" font-size="10" fill="#7A5230">epiglot</text>' +
      '<rect x="74" y="88" width="72" height="62" rx="10" fill="#EAF2FC" stroke="#9DB8E8" stroke-width="2"/><text x="110" y="104" font-family="JetBrains Mono" font-size="9.5" fill="#2457C5" text-anchor="middle">giriş (vestibül)</text>' +
      '<path d="M74 150 L104 158 M146 150 L116 158" stroke="#A8412B" stroke-width="7" stroke-linecap="round"/><text x="152" y="162" font-family="JetBrains Mono" font-size="9.5" fill="#A8412B">ses telleri</text>' +
      '<rect x="80" y="166" width="60" height="84" rx="6" fill="#F7F0E6" stroke="#D8CBB8" stroke-width="2"/><path d="M80 190 H140 M80 214 H140 M80 238 H140" stroke="#D8CBB8" stroke-width="2"/><text x="110" y="182" font-family="JetBrains Mono" font-size="9.5" fill="#6A7593" text-anchor="middle">soluk borusu</text>' +
      '<g class="bd" id="pas-b"><circle r="10" fill="#F6D04D" stroke="#8A5A00" stroke-width="2.4"/></g>' +
      '<g class="cough" id="pas-c"><path d="M196 230 C204 180 204 120 196 70" fill="none" stroke="#2E8E5B" stroke-width="3" stroke-dasharray="6 6"/><path d="M190 80 L196 66 L203 80" fill="none" stroke="#2E8E5B" stroke-width="3"/><text x="160" y="250" font-family="JetBrains Mono" font-size="10" fill="#2E8E5B">öksürük</text></g>' +
      '</svg>';
  };
  var BPOS = { yok: [60, 60], ust: [110, 126], tel: [110, 152], alt: [110, 210] };
  var paintPas = function () {
    $('#pas-d').innerHTML = DEPTH.map(function (d) { return '<button type="button" data-d="' + d[0] + '" aria-pressed="' + (d[0] === S.d) + '">' + X(d[1]) + '</button>'; }).join('');
    var ejOpts = S.d === 'alt' ? EJ : EJ.slice(0, 2).map(function (e, i) { return i === 1 ? ['caba', 'Atılmadı'] : e; });
    if (S.d !== 'alt' && S.e === 'yok') S.e = 'caba';
    $('#pas-e').innerHTML = S.d === 'yok' ? '<span class="sub" style="padding:6px 8px;margin:0">Hava yoluna girmediyse sorulmaz.</span>' : ejOpts.map(function (e) { return '<button type="button" data-e="' + e[0] + '" aria-pressed="' + (e[0] === S.e) + '">' + X(e[1]) + '</button>'; }).join('');
    var sc = pasScore(S.d, S.e), p = BPOS[S.d];
    $('#pas-b').setAttribute('transform', 'translate(' + p[0] + ' ' + p[1] + ')');
    $('#pas-c').classList.toggle('on', S.d !== 'yok' && S.e === 'evet');
    var col = sc === 1 ? 'var(--ok)' : sc <= 5 ? 'var(--warn)' : 'var(--bad)', ad = sc === 1 ? 'güvenli' : sc <= 5 ? 'penetrasyon' : 'aspirasyon' + (sc === 8 ? ' · sessiz' : '');
    $('#pas-n').innerHTML = '<b style="--pc:' + col + '">' + sc + '</b><div><span class="pill ' + (sc === 1 ? 'ok' : sc <= 5 ? 'warn' : 'bad') + '">' + ad + '</span><p class="sub" style="margin:6px 0 0;color:var(--ink)">' + X(V.PAS[sc - 1][1]) + '</p></div>';
    DK.bridgeSend();
  };

  DK.st.yutma = {
    init: function () {
      $('#sw-svg').innerHTML = swSVG();
      $('#ev-st').innerHTML = V.EVRE.map(function (e, i) { return '<button type="button" data-ev="' + e.k + '" aria-pressed="false">' + (i + 1) + '. ' + X(e.t) + '<small>' + X(e.s) + '</small></button>'; }).join('');
      $('#ev-st').addEventListener('click', function (e) { var b = e.target.closest('[data-ev]'); if (b) { clearTimeout(S.play); setEv(b.getAttribute('data-ev')); } });
      $('#ev-play').addEventListener('click', playAll);
      setEv('hazirlik');
      $('#sy-svg').innerHTML = syrSVG();
      $('#sy-pick').innerHTML = V.SIRINGA.map(function (s) { return '<button type="button" class="btn sm" data-sy="' + s.k + '" aria-pressed="false">Örnek ' + s.k + '</button>'; }).join('');
      $('#sy-pick').addEventListener('click', function (e) { var b = e.target.closest('[data-sy]'); if (b) pickSy(b.getAttribute('data-sy')); });
      $('#sy-go').addEventListener('click', runSy);
      $('#sy-lvl').addEventListener('click', function (e) { var b = e.target.closest('[data-lv]'); if (b) ansSy(+b.getAttribute('data-lv')); });
      paintIdd();
      $('#idd').addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) { S.idd = +b.getAttribute('data-id'); paintIdd(); DK.bridgeSend(); } });
      $('#pas-svg').innerHTML = pasSVG(); paintPas();
      $('#pas-d').addEventListener('click', function (e) { var b = e.target.closest('[data-d]'); if (b) { S.d = b.getAttribute('data-d'); paintPas(); } });
      $('#pas-e').addEventListener('click', function (e) { var b = e.target.closest('[data-e]'); if (b) { S.e = b.getAttribute('data-e'); paintPas(); } });
    },
    hide: function () { clearTimeout(S.play); if (S.syRun) { cancelAnimationFrame(S.syRun); S.syRun = null; $('#syr').classList.remove('run'); $('#sy-go').disabled = false; } },
    ctx: function () {
      var e = V.EVRE.filter(function (x) { return x.k === S.ev; })[0], sc = pasScore(S.d, S.e);
      return { sel: { key: 'dkt.yutma.' + S.ev, title: 'Yutma · ' + e.t, la: 'Yutma', rows: [['Evre', e.t + ' (' + e.s + ')'], ['PAS seçimi', sc + ': ' + V.PAS[sc - 1][1]], ['IDDSI kartı', S.idd + ' · ' + V.IDDSI[S.idd].ad]],
          about: 'öğrenci DKT Lab yutma masasında yutma evrelerini, IDDSI kıvam düzeylerini ve Penetrasyon-Aspirasyon Skalasını çalışıyor. Hasta için kişisel öneri verme, kavramları öğret.' },
        chips: [['pas', 'Penetrasyon ile aspirasyon farkı ne?'], ['sessiz', 'Sessiz aspirasyon neden tehlikeli?'], ['evre', 'Bu evrede ne bozulabilir?']] };
    },
    classify: function (q) { if (/penetrasyon|aspirasyon fark/.test(q)) return 'pas'; if (/sessiz/.test(q)) return 'sessiz'; if (/evre/.test(q)) return 'evre'; return null; },
    answer: function (k) {
      if (k === 'pas') return 'Penetrasyonda madde gırtlak girişine girer ama ses tellerinin altına geçmez (PAS 2–5). Aspirasyonda ses tellerinin altına, soluk borusuna geçer (PAS 6–8). Puan ayrıca maddenin atılıp atılmadığına göre değişir.';
      if (k === 'sessiz') return 'Sessiz aspirasyonda (PAS 8) madde ses tellerinin altına geçer ama hasta öksürmez, boğulma belirtisi göstermez. Yatak başı testlerde gözden kaçabilir; aspirasyon pnömonisi riskini artırır. Bu yüzden şüphede videofloroskopi (VFSS) ya da endoskopik değerlendirme (FEES) gerekir.';
      if (k === 'evre') { var e = V.EVRE.filter(function (x) { return x.k === S.ev; })[0]; return e.t + ' evresi: ' + e.d + ' Bozulursa: ' + e.b; }
      return null;
    }
  };
})();
