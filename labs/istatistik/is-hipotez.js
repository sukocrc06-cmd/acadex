/* ==========================================================================
   ACADEX İSTATİSTİK · 6. HİPOTEZ MAHKEMESİ (labs/istatistik/is-hipotez.js), 03.11.2026
   İstatistik II, 1–5. hafta: hipotez testinin mantığı, tek ve iki örneklem t, oran z,
   tek/çift yönlü test, p-değeri, I. ve II. tip hata, testin gücü.
     - mahkeme: H₀ sanıktır, “masum” varsayılır. Test istatistiği tokmak gibi eğriye iner;
       ret bölgesine düşerse H₀ reddedilir. “Reddedilemedi” ≠ “kabul edildi”.
     - güç terazisi: α küçülürse β büyür; n büyürse ikisi birden küçülür.
   ========================================================================== */
(function () {
  'use strict';
  var FN = window.FN, C = FN.core, IS = FN.is, M = IS.M, X = C.X, f = IS.f;
  var root;
  var CASES = {
    kahve: { t: 'Kahve bardağı', story: 'Bir kahve zinciri bardakların <b>250 ml</b> olduğunu söylüyor. 16 bardak ölçtün: ortalama 246,8 ml, s = 6,2 ml. Bardaklar eksik mi?', kind: 't1', v: { m: 246.8, s: 6.2, n: 16, mu0: 250 }, tail: 'sol', h0: 'μ = 250 ml', h1: { sol: 'μ < 250 ml', sag: 'μ > 250 ml', cift: 'μ ≠ 250 ml' } },
    yontem: { t: 'Yeni çalışma yöntemi', story: 'A grubu (n = 20) yeni yöntemle çalıştı: ortalama 74,1, s = 9,5. B grubu (n = 22) eski yöntemle: ortalama 68,3, s = 10,2. Yeni yöntem notları artırıyor mu?', kind: 't2', v: { m1: 74.1, s1: 9.5, n1: 20, m2: 68.3, s2: 10.2, n2: 22 }, tail: 'sag', h0: 'μ_A = μ_B', h1: { sol: 'μ_A < μ_B', sag: 'μ_A > μ_B', cift: 'μ_A ≠ μ_B' } },
    secim: { t: 'Seçim anketi', story: 'Rastgele 600 seçmenden 327’si adayı destekliyor (p̂ = 0,545). Adayın desteği %50’nin üstünde mi?', kind: 'z1', v: { x: 327, n: 600, p0: 0.5 }, tail: 'sag', h0: 'p = 0,50', h1: { sol: 'p < 0,50', sag: 'p > 0,50', cift: 'p ≠ 0,50' } }
  };
  var S = { c: 'kahve', tail: 'sol', a: 0.05, v: null };
  var test = function () {
    var c = CASES[S.c], v = S.v, o = {};
    if (c.kind === 't1') { o.se = v.s / Math.sqrt(v.n); o.stat = (v.m - v.mu0) / o.se; o.df = v.n - 1; o.dist = 't'; }
    else if (c.kind === 't2') { var sp2 = ((v.n1 - 1) * v.s1 * v.s1 + (v.n2 - 1) * v.s2 * v.s2) / (v.n1 + v.n2 - 2); o.sp = Math.sqrt(sp2); o.se = o.sp * Math.sqrt(1 / v.n1 + 1 / v.n2); o.stat = (v.m1 - v.m2) / o.se; o.df = v.n1 + v.n2 - 2; o.dist = 't'; }
    else { o.ph = v.x / v.n; o.se = Math.sqrt(v.p0 * (1 - v.p0) / v.n); o.stat = (o.ph - v.p0) / o.se; o.dist = 'z'; }
    var cdf = o.dist === 't' ? function (x) { return M.tCdf(x, o.df); } : function (x) { return M.normCdf(x); };
    var q = o.dist === 't' ? function (p) { return M.tInv(p, o.df); } : function (p) { return M.normInv(p); };
    o.p = S.tail === 'sol' ? cdf(o.stat) : S.tail === 'sag' ? 1 - cdf(o.stat) : 2 * Math.min(cdf(o.stat), 1 - cdf(o.stat));
    o.crit = S.tail === 'sol' ? q(S.a) : S.tail === 'sag' ? q(1 - S.a) : q(1 - S.a / 2);
    o.rej = o.p < S.a; return o;
  };
  var court = function (anim) {
    var c = CASES[S.c], o = test(), lim = 4.5, pdf = o.dist === 't' ? function (x) { return M.tPdf(x, o.df); } : function (x) { return M.normPdf(x); };
    var W = 640, H = 270, sx = IS.scale(-lim, lim, 30, W - 20), sy = IS.scale(0, 0.42, H - 40, 30), path = function (a, b, close) {
      var d = ''; for (var i = 0; i <= 80; i++) { var x = a + (b - a) * i / 80; d += (i ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(pdf(x)).toFixed(1); }
      return close ? d + 'L' + sx(b).toFixed(1) + ' ' + sy(0) + 'L' + sx(a).toFixed(1) + ' ' + sy(0) + 'Z' : d;
    };
    var g = '', cr = Math.abs(o.crit), st = Math.max(-lim, Math.min(lim, o.stat));
    var rej = S.tail === 'sol' ? [[-lim, -cr]] : S.tail === 'sag' ? [[cr, lim]] : [[-lim, -cr], [cr, lim]];
    var pv = S.tail === 'sol' ? [[-lim, st]] : S.tail === 'sag' ? [[st, lim]] : [[-lim, -Math.abs(st)], [Math.abs(st), lim]];
    rej.forEach(function (r) { g += '<path class="hp-rej" d="' + path(r[0], r[1], true) + '"/>'; });
    pv.forEach(function (r) { if (r[1] > r[0]) g += '<path class="hp-pv" d="' + path(r[0], r[1], true) + '"/>'; });
    g += '<path class="hp-cv" d="' + path(-lim, lim) + '"/><line class="hp-ax" x1="30" x2="' + (W - 20) + '" y1="' + sy(0) + '" y2="' + sy(0) + '"/>';
    [-4, -3, -2, -1, 0, 1, 2, 3, 4].forEach(function (v) { g += '<text class="hp-t" x="' + sx(v) + '" y="' + (sy(0) + 16) + '" text-anchor="middle">' + v + '</text>'; });
    rej.forEach(function (r) { var x = r[0] === -lim ? r[1] : r[0]; g += '<line class="hp-cl" x1="' + sx(x) + '" x2="' + sx(x) + '" y1="' + sy(0) + '" y2="' + (sy(pdf(x)) - 26) + '"/><text class="hp-ct" x="' + sx(x) + '" y="' + (sy(pdf(x)) - 30) + '" text-anchor="middle">kritik ' + f(x, 2) + '</text>'; });
    /* tokmak */
    g += '<g class="hp-gav' + (anim && !C.RM ? ' in' : '') + '" style="transform:translate(' + sx(st).toFixed(1) + 'px,' + (sy(pdf(st)) - 2).toFixed(1) + 'px)"><g class="hp-gh"><rect x="-17" y="-34" width="34" height="14" rx="3"/><rect x="-3" y="-20" width="6" height="18"/></g><circle r="5" class="hp-dot"/><text y="' + (sy(0) - sy(pdf(st)) + 32) + '" text-anchor="middle">' + (o.dist === 't' ? 't' : 'z') + ' = ' + f(o.stat, 2) + '</text></g>';
    g += '<text class="hp-lg" x="34" y="20">ret bölgesi (α = ' + f(S.a, 2) + ')</text><text class="hp-lg2" x="34" y="36">p-değeri alanı</text>';
    C.$('[data-court]', root).innerHTML = '<svg class="hp-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="H0 altında örnekleme dağılımı, ret bölgesi ve test istatistiği">' + g + '</svg>';
    var v = S.v, n2 = function (x) { return C.nf(x, 2); };
    var steps = [
      ['Hipotezler', 'H₀: ' + c.h0 + '  ·  H₁: ' + c.h1[S.tail]],
      ['Anlamlılık düzeyi', 'α = ' + n2(S.a) + (S.tail === 'cift' ? ' (iki kuyruğa ' + n2(S.a / 2) + ')' : '')],
      ['Test istatistiği', c.kind === 't1' ? 't = (x̄ − μ₀)/(s/√n) = (' + n2(v.m) + ' − ' + v.mu0 + ')/(' + n2(v.s) + '/√' + v.n + ') = ' + n2(o.stat) + ', sd = ' + o.df
        : c.kind === 't2' ? 't = (x̄_A − x̄_B)/(s_p·√(1/n_A + 1/n_B)) = ' + n2(v.m1 - v.m2) + '/' + f(o.se, 3) + ' = ' + n2(o.stat) + ', sd = ' + o.df + ' (s_p = ' + n2(o.sp) + ')'
        : 'z = (p̂ − p₀)/√(p₀(1 − p₀)/n) = (' + f(o.ph, 3) + ' − ' + n2(v.p0) + ')/' + f(o.se, 4) + ' = ' + n2(o.stat)],
      ['Karar kuralı', (S.tail === 'cift' ? '|' + (o.dist) + '| > ' + f(Math.abs(o.crit), 3) : (o.dist) + (S.tail === 'sol' ? ' < ' : ' > ') + f(o.crit, 3)) + '  ya da  p < α'],
      ['Sonuç', 'p = ' + IS.p(o.p) + (o.rej ? ' < ' : ' ≥ ') + n2(S.a) + ' → ' + (o.rej ? 'H₀ reddedilir. ' + c.h1[S.tail] + ' yönünde anlamlı kanıt var.' : 'H₀ reddedilemez. Kanıt yetersiz; bu, H₀’ın doğru olduğunu kanıtlamaz.')]
    ];
    IS.steps(C.$('[data-steps]', root), steps.map(function (s) { return { t: s[0], x: s[1] }; }), 'beş adımda test');
    var vd = C.$('[data-verdict]', root);
    vd.innerHTML = '<span class="verdict' + (anim ? ' in' : '') + '" style="color:' + (o.rej ? 'var(--bad)' : 'var(--ok)') + '">' + (o.rej ? 'H₀ REDDEDİLDİ' : 'H₀ REDDEDİLEMEDİ') + '</span><span class="lbl">p = ' + IS.p(o.p) + '</span>';
    var xs = c.kind === 't1' ? { x: [['=T.DAĞ(' + n2(o.stat) + ';' + o.df + ';DOĞRU)', 'sol kuyruk p'], ['=T.DAĞ.SAĞK(' + n2(o.stat) + ';' + o.df + ')', 'sağ kuyruk p'], ['=T.DAĞ.2K(MUTLAK(' + n2(o.stat) + ');' + o.df + ')', 'çift yönlü p']], r: [['t.test(x, mu = ' + v.mu0 + ', alternative = "' + ({ sol: 'less', sag: 'greater', cift: 'two.sided' })[S.tail] + '")', 'ham veriden'], ['pt(' + f(o.stat, 3).replace(',', '.') + ', ' + o.df + ')', 'sol kuyruk p']] }
      : c.kind === 't2' ? { x: [['=T.TEST(A2:A21;B2:B23;' + (S.tail === 'cift' ? 2 : 1) + ';2)', 'ham veriden, eşit varyanslı iki örneklem'], ['=T.DAĞ.SAĞK(' + n2(o.stat) + ';' + o.df + ')', 'özet değerlerden sağ kuyruk p']], r: [['t.test(a, b, var.equal = TRUE, alternative = "' + ({ sol: 'less', sag: 'greater', cift: 'two.sided' })[S.tail] + '")', 'var.equal = FALSE: Welch testi']] }
      : { x: [['=1-NORM.S.DAĞ(' + n2(o.stat) + ';DOĞRU)', 'sağ kuyruk p'], ['=NORM.S.DAĞ(' + n2(o.stat) + ';DOĞRU)', 'sol kuyruk p']], r: [['prop.test(' + v.x + ', ' + v.n + ', p = ' + v.p0 + ', alternative = "' + ({ sol: 'less', sag: 'greater', cift: 'two.sided' })[S.tail] + '", correct = FALSE)', 'ki-kare = z²'], ['1 - pnorm(' + f(o.stat, 3).replace(',', '.') + ')', '']] };
    C.$('[data-hcode]', root).innerHTML = IS.code(xs);
  };
  var panel = function () {
    var c = CASES[S.c], v = S.v, sl = function (k, lab, min, max, st) { return '<label class="sl"><span>' + lab + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + st + '" value="' + v[k] + '" data-hv="' + k + '"><output data-ho="' + k + '">' + f(v[k], st < 1 ? (st < 0.05 ? 2 : 1) : 0) + '</output></label>'; };
    C.$('[data-story]', root).innerHTML = c.story;
    C.$('[data-hsl]', root).innerHTML = c.kind === 't1' ? sl('m', 'örneklem ortalaması x̄', 238, 262, 0.1) + sl('s', 's', 1, 20, 0.1) + sl('n', 'n', 3, 100, 1)
      : c.kind === 't2' ? sl('m1', 'A ortalaması', 55, 90, 0.1) + sl('m2', 'B ortalaması', 55, 90, 0.1) + sl('s1', 'A s', 2, 25, 0.1) + sl('s2', 'B s', 2, 25, 0.1) + sl('n1', 'n_A', 3, 80, 1) + sl('n2', 'n_B', 3, 80, 1)
      : sl('x', 'destekleyen kişi', 200, 400, 1) + sl('n', 'anket n', 300, 1500, 10);
    C.$$('[data-hv]', root).forEach(function (el) {
      el.addEventListener('input', function () { var k = el.getAttribute('data-hv'); v[k] = +el.value; if (c.kind === 'z1' && v.x > v.n) v.x = v.n; C.$('[data-ho="' + k + '"]', root).textContent = f(v[k], +el.step < 1 ? (+el.step < 0.05 ? 2 : 1) : 0); court(false); });
      el.addEventListener('change', function () { court(true); FN.bridgeSend(); });
    });
    court(true);
  };
  var pick = function (k) { S.c = k; S.v = JSON.parse(JSON.stringify(CASES[k].v)); S.tail = CASES[k].tail; tailSeg(); panel(); FN.bridgeSend(); };
  var tailSeg = function () { IS.seg(C.$('[data-tail]', root), [['sol', 'sol kuyruk'], ['cift', 'çift yönlü'], ['sag', 'sağ kuyruk']], S.tail, function (t) { S.tail = t; court(true); FN.bridgeSend(); }); };

  /* ---------- güç terazisi ---------- */
  var Pw = { mu1: 106, n: 25, a: 0.05 };
  var power = function () {
    var mu0 = 100, sig = 15, se = sig / Math.sqrt(Pw.n), cv = mu0 + M.normInv(1 - Pw.a) * se, beta = M.normCdf(cv, Pw.mu1, se), pw = 1 - beta;
    var lo = 82, hi = 124, f0 = function (x) { return M.normPdf(x, mu0, se); }, f1 = function (x) { return M.normPdf(x, Pw.mu1, se); };
    var top = Math.max(f0(mu0), f1(Pw.mu1)) * 1.15;
    C.$('[data-pw]', root).innerHTML = C.chart({ w: 640, h: 250, x: [lo, hi], y: [0, top], anim: false, al: 'güç', xl: 'x̄', yf: function () { return ''; }, pl: 14,
      s: [{ p: IS.curve(f0, lo, hi), c: '#46506A', w: 2.2, lab: 'H₀: μ = 100' }, { p: IS.curve(f1, lo, hi), c: '#2F6FB0', w: 2.2, lab: 'gerçek μ = ' + f(Pw.mu1, 0) },
        { p: IS.curve(f0, cv, hi), c: '#C9483B', w: 0.1, area: true }, { p: IS.curve(f1, lo, cv), c: '#2F6FB0', w: 0.1, area: true }, { p: IS.curve(f1, cv, hi), c: '#1E8A55', w: 0.1, area: true }],
      vl: [{ x: cv, c: '#0D1838', lab: 'kritik x̄ = ' + f(cv, 1) }] });
    C.$('[data-pwk]', root).innerHTML = '<div class="hp-scale"><div class="hp-beam" style="--t:' + Math.max(-14, Math.min(14, (beta - Pw.a) * 30)).toFixed(1) + 'deg"><span class="a">α<br><b>' + f(Pw.a, 2) + '</b></span><span class="b">β<br><b>' + f(beta, 3) + '</b></span></div><i></i></div>' +
      '<div class="kpis"><div class="kpi"><small>I. tip hata α (masumu mahkûm)</small><b style="color:#C9483B">' + f(Pw.a, 2) + '</b></div><div class="kpi"><small>II. tip hata β (suçluyu salıver)</small><b style="color:#2F6FB0">' + f(beta, 3) + '</b></div><div class="kpi hl"><small>güç 1 − β</small><b>' + f(pw, 3) + '</b></div></div>';
  };

  var QS = [
    { q: 'p = 0,03 ve α = 0,05. Karar?', o: ['H₀ reddedilir', 'H₀ kabul edilir', 'H₁ reddedilir', 'karar verilemez'], a: 0, n: 'p < α → ret bölgesindesin.' },
    { q: 'p-değeri neyi ifade eder?', o: ['H₀ doğruysa, bu kadar ya da daha uç bir sonuç görme olasılığı', 'H₀’ın doğru olma olasılığı', 'H₁’in doğru olma olasılığı', 'hata yapma olasılığı'], a: 0, n: 'p, veriye dair koşullu bir olasılıktır; hipotezin olasılığı değildir.' },
    { q: 'I. tip hata hangisidir?', o: ['H₀ doğruyken reddetmek', 'H₀ yanlışken reddetmemek', 'yanlış testi seçmek', 'α’yı büyük seçmek'], a: 0, n: 'Mahkemede masumu mahkûm etmek. Olasılığı α.' },
    { q: 'α sabitken testin gücünü artırmanın en doğrudan yolu?', o: ['örneklem büyüklüğünü artırmak', 'α’yı küçültmek', 'tek yönlüyü çift yönlü yapmak', 'veriyi azaltmak'], a: 0, n: 'n büyüdükçe standart hata küçülür, iki eğri ayrışır, β azalır.' },
    { q: '“H₀ reddedilemedi” sonucunun doğru yorumu?', o: ['H₀’a karşı yeterli kanıt bulunamadı', 'H₀ kanıtlandı', 'H₁ kesinlikle yanlış', 'test hatalı yapıldı'], a: 0, n: 'Delil yetersizliğinden beraat, masumiyetin kanıtı değildir.' }
  ];

  IS.bank.hipotez = QS;

  FN.st.hipotez = {
    init: function () {
      root = C.$('#hipotez');
      root.innerHTML = IS.head({ key: 'hipotez', k: 'istasyon 6 · hipotez testi', title: 'Hipotez mahkemesi', sub: 'H₀ sanık sandalyesinde ve <b>masum varsayılıyor</b>. Veri delildir. Test istatistiği tokmak gibi eğriye iner; kırmızı ret bölgesine düşerse H₀ reddedilir.', weeks: ['İst II · 1–2. hafta: hipotez testinin mantığı', '3. hafta: tek örneklem t', '4. hafta: iki örneklem t, oran z', '5. hafta: hata türleri ve güç'] }) +
        '<div class="seg" data-case style="margin-bottom:14px"></div>' +
        '<div class="grid gside"><div class="card box" style="--cc:#FF8A7A"><h2>Dava dosyası</h2><p class="sub" data-story style="font-size:14px;color:var(--ink2)"></p><div data-hsl></div>' +
        '<p class="lbl" style="margin:10px 0 4px">alternatif hipotez yönü</p><div class="seg" data-tail></div><p class="lbl" style="margin:10px 0 4px">anlamlılık düzeyi α</p><div class="seg" data-alpha></div></div>' +
        '<div class="card box" style="--cc:#FF8A7A"><div class="row" style="justify-content:space-between"><h2>Duruşma</h2><div class="row" data-verdict></div></div><div class="stage" data-court></div><div data-steps></div><div data-hcode></div></div></div>' +
        '<div class="grid gside" style="margin-top:18px"><div class="card box" style="--cc:#2F6FB0"><h2>Güç terazisi</h2><p class="sub">H₀: μ = 100, σ = 15, sağ kuyruk z testi. Gerçekte μ farklıysa testin bunu yakalama olasılığı (güç) kaç?</p>' +
        '<label class="sl"><span>gerçek μ</span><input type="range" min="100" max="115" step="0.5" value="106" data-pk="mu1"><output data-pko="mu1">106</output></label><label class="sl"><span>n</span><input type="range" min="4" max="200" step="1" value="25" data-pk="n"><output data-pko="n">25</output></label><label class="sl"><span>α</span><input type="range" min="0.01" max="0.2" step="0.01" value="0.05" data-pk="a"><output data-pko="a">0,05</output></label><div data-pwk></div></div>' +
        '<div class="card box" style="--cc:#2F6FB0"><h2>İki dünya</h2><p class="sub">Gri: H₀ doğruysa x̄’in dağılımı; mavi: gerçek dünya. Kırmızı alan α, mavi alan β, yeşil alan güç.</p><div data-pw></div>' + IS.tip('α’yı küçült: kırmızı daralır ama mavi (β) büyür. n’i artır: iki çan da incelir, ikisi birden küçülür.', '1−β') + '</div></div>' +
        '<div style="margin-top:18px">' + IS.quizCard() + '</div>';
      IS.seg(C.$('[data-case]', root), Object.keys(CASES).map(function (k) { return [k, CASES[k].t]; }), S.c, pick);
      IS.seg(C.$('[data-alpha]', root), [['0.1', '0,10'], ['0.05', '0,05'], ['0.01', '0,01']], '0.05', function (k) { S.a = +k; court(true); FN.bridgeSend(); });
      C.$$('[data-pk]', root).forEach(function (el) { el.addEventListener('input', function () { var k = el.getAttribute('data-pk'); Pw[k] = +el.value; C.$('[data-pko="' + k + '"]', root).textContent = f(Pw[k], k === 'a' ? 2 : k === 'mu1' ? 1 : 0); power(); }); });
      pick('kahve'); power();
      IS.quiz(C.$('[data-quiz]', root), QS, 'Hipotez testi');
    },
    ctx: function () {
      var o = test(), c = CASES[S.c];
      return IS.ctx('hipotez', c.t, [['H₀', c.h0], ['H₁', c.h1[S.tail]], ['α', f(S.a, 2)], ['test istatistiği', f(o.stat, 3)], ['p-değeri', IS.p(o.p)], ['karar', o.rej ? 'H₀ reddedildi' : 'H₀ reddedilemedi']],
        'öğrenci hipotez testini dava örneğiyle çalışıyor: ' + c.story.replace(/<[^>]+>/g, ''), ['p-değerini sezgisel anlat', 'Tek yönlü mü çift yönlü mü seçmeliyim?', 'I. ve II. tip hata farkı']);
    }
  };
})();
