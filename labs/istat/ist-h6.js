/* ==========================================================================
   ACADEX İSTATİSTİK · Bahar 5–7. haftalar (labs/istat/ist-h6.js), 12.11.2026
   5 Tek örneklem testleri II · 6 İki örneklem testleri · 7 ANOVA
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;
  var karar = function (rej) { return rej ? '<b style="color:#C8553D">H₀ reddedilir</b>' : '<b style="color:#1F8A7A">H₀ reddedilmez</b>'; };
  /* test eğrisi: red bölgesi + gözlenen değer işareti */
  var testC = function (o) {
    var f = o.f || function (x) { return M.npdf(x, 0, 1); };
    return V.curve({ f: f, a: o.a != null ? o.a : -4.2, b: o.b != null ? o.b : 4.2, ymax: o.ymax || 0.45, sh: o.R, shc: PAL[1], h: o.h || 200, xt: o.xt, d: o.d, renk: o.renk, extra: function (xs, ys, y0) { var x = Math.max(o.a != null ? o.a : -4.2, Math.min(o.b != null ? o.b : 4.2, o.obs)); return '<g class="pop" ' + d((o.d || 0) + 1.2) + '><line x1="' + xs(x) + '" x2="' + xs(x) + '" y1="' + y0 + '" y2="16" stroke="#0D1838" stroke-width="2.5"/><path d="M' + xs(x) + ' 14l-6-10h12z" fill="#E0A526" stroke="#0D1838"/><text class="lbb" x="' + xs(x) + '" y="' + (y0 + 30) + '" text-anchor="middle">' + o.lab + '</text></g>'; } });
  };

  /* ======================= BAHAR 5 ======================= */
  IST.hafta({
    id: 'b5', no: 5, renk: '#1F8A7A', tr: 'Tek örneklem hipotez testi II: z, t, oran ve varyans', en: 'One Sample Hypothesis Testing 2',
    sahneler: [
      {
        b: 'Hangi test?', terim: [['test seçimi', 'choosing the test']],
        t: '<ul><li>Ortalama, <b>σ biliniyor</b> (ya da n &gt; 30) → <b>z testi</b>: z = (x̄ − μ₀)/(σ/√n)</li><li>Ortalama, <b>σ bilinmiyor</b>, n küçük, anakütle normal → <b>t testi</b>: t = (x̄ − μ₀)/(s/√n), sd = n − 1</li><li>Oran (np ≥ 5, n(1 − p) ≥ 5) → <b>oran z testi</b></li><li>Varyans, anakütle normal → <b>ki-kare testi</b>: χ² = (n − 1)s²/σ₀²</li></ul>',
        v: function () { return V.kart([{ ic: 'z', b: 'Ortalama · σ biliniyor', en: 'one-sample z test' }, { ic: 't', b: 'Ortalama · σ bilinmiyor', en: 'one-sample t test' }, { ic: 'p̂', b: 'Oran', en: 'one-proportion z test' }, { ic: 'χ²', b: 'Varyans', en: 'chi-square test for variance' }]); }
      },
      {
        b: 'z testi: paketler hâlâ 450 g mı?', terim: [['test istatistiği', 'test statistic z']],
        t: '<p>Etikette 450 g yazıyor; hattın σ’sı uzun süredir 25 g. Sabah rastgele 40 paket: x̄ = <b>460 g</b>. α = 0,05, çift yönlü.</p><p>z = (460 − 450)/(25/√40) = 10 / 3,953 = <b>2,53</b> &gt; 1,96 → H₀ reddedilir. Kalite müdürü haklı olarak endişelenmeli: ortalama 450 g’dan farklı görünüyor (p ≈ 0,0114).</p>',
        v: function () { return testC({ R: IST.redBolge(0.05, 'iki'), obs: 2.53, lab: 'z = 2,53', xt: [[-1.96, '−1,96'], [0, '0'], [1.96, '1,96']] }) + V.fx([{ s: 'standart hata', h: '25 / √40 = 3,953' }, { s: 'test istatistiği', h: 'z = 10 / 3,953 = <b>2,53</b> → H₀ red', son: true }], 1.4); }
      },
      {
        b: 'Sol kuyruk: öğleden sonra 448 g', terim: [['tek yönlü test', 'one-tailed test']],
        t: '<p>Öğleden sonra 32 paket: x̄ = <b>448 g</b>. Mühendis ortalamanın 450’den <b>az</b> olduğunu söyleyebilir mi? H₁: μ &lt; 450, α = 0,05.</p><p>z = (448 − 450)/(25/√32) = −2 / 4,419 = <b>−0,45</b>. Kritik değer −1,645. −0,45 &gt; −1,645 → <b>H₀ reddedilmez</b>. 2 g’lık fark rastgele dalgalanmayla açıklanabilir.</p>',
        v: function () { return testC({ R: IST.redBolge(0.05, 'sol'), obs: -0.45, lab: 'z = −0,45', xt: [[-1.645, '−1,645'], [0, '0']] }); }
      },
      {
        b: 't testi: kafede bekleme süresi', terim: [['t testi', 't test'], ['serbestlik derecesi', 'df = n − 1']],
        t: '<p>Bir kafe ortalama bekleme süresinin 5 dakika olduğunu söylüyor. Müşteriler daha uzun olduğunu düşünüyor. 12 sipariş: x̄ = 5,6 dk, s = 0,9 dk. σ bilinmiyor → t testi. H₁: μ &gt; 5, α = 0,05.</p><p>t = (5,6 − 5)/(0,9/√12) = 0,6 / 0,260 = <b>2,31</b>; t<sub>0,05; 11</sub> = <b>1,796</b>. 2,31 &gt; 1,796 → <b>H₀ reddedilir</b>.</p>',
        v: function () { return testC({ f: function (x) { return M.tpdf(x, 11); }, R: [[1.796, 9]], obs: 2.31, lab: 't = 2,31', xt: [[0, '0'], [1.796, '1,796']], renk: PAL[4] }) + IST.ttab([10, 11, 12], { '1,2': 'hi' }); }
      },
      {
        b: 'Oran için z testi', terim: [['oran testi', 'test for a proportion']],
        t: '<p class="mono">z = (p̂ − p₀) / √(p₀(1 − p₀)/n)</p><p>Bir uygulamanın kullanıcılarının %30’unun premium üye olduğu biliniyor. Kampanyadan sonra 200 kullanıcıdan 72’si premium (p̂ = 0,36). Oran arttı mı? H₁: p &gt; 0,30.</p><p>z = 0,06 / √(0,3·0,7/200) = 0,06 / 0,0324 = <b>1,85</b> &gt; 1,645 → <b>H₀ reddedilir</b>.</p>',
        v: function () { return testC({ R: IST.redBolge(0.05, 'sag'), obs: 1.85, lab: 'z = 1,85', xt: [[0, '0'], [1.645, '1,645']] }); }
      },
      {
        b: 'Varyans için ki-kare testi', terim: [['ki-kare dağılımı', 'chi-square distribution'], ['varyans testi', 'test for a variance']],
        t: '<p class="mono">χ² = (n − 1)s² / σ₀², sd = n − 1</p><p>Bir makinenin dolum varyansı en çok 4 olmalı. 15 ölçümde s² = 6,5. Varyans arttı mı? H₁: σ² &gt; 4.</p><p>χ² = 14 · 6,5 / 4 = <b>22,75</b>; χ²<sub>0,05; 14</sub> = <b>23,685</b>. 22,75 &lt; 23,685 → <b>H₀ reddedilmez</b> (sınıra yakın; izlemeye devam).</p>',
        v: function () { return testC({ f: function (x) { return M.c2pdf(x, 14); }, a: 0, b: 40, ymax: 0.09, R: [[23.685, 99]], obs: 22.75, lab: 'χ² = 22,75', xt: [[0, '0'], [14, '14'], [23.685, '23,685'], [40, '40']], renk: PAL[2] }); }
      }
    ],
    gorsel: {
      b: 'Test hesaplayıcı', t: 'Test türünü ve yönünü seç, örneklem değerlerini sürgülerle ayarla. Test istatistiği, kritik değer, p-değeri ve karar adım adım güncellenir.',
      kur: function (el) {
        var tip = 'z', yon = 'iki', a = 0.05, mu0 = 450, xb = 460, sg = 25, n = 40, p0 = 0.3, ph = 0.36;
        el.innerHTML = '<div class="seg" data-t style="margin-bottom:10px"><button type="button" data-k="z" aria-pressed="true">z (σ biliniyor)</button><button type="button" data-k="t" aria-pressed="false">t (σ bilinmiyor)</button><button type="button" data-k="p" aria-pressed="false">oran</button></div><div class="at-g"><div class="at-k" data-c></div><div class="at-v"><div data-g></div><div class="at-out" data-o></div><div class="at-not" data-n></div></div></div>';
        var sl = function (k, lab, mn, mx, st, v) { return '<label><span>' + lab + ' <output data-o-' + k + '>' + nf(v, st < 1 ? 2 : 0) + '</output></span><input type="range" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + v + '" data-s="' + k + '"></label>'; };
        var ctl = function () {
          var c = el.querySelector('[data-c]');
          c.innerHTML = '<div class="seg" data-y>' + [['sol', 'H₁: <'], ['iki', 'H₁: ≠'], ['sag', 'H₁: >']].map(function (y) { return '<button type="button" data-k="' + y[0] + '" aria-pressed="' + (y[0] === yon) + '">' + y[1] + '</button>'; }).join('') + '</div>' +
            sl('a', 'α', 0.01, 0.1, 0.01, a) + (tip === 'p' ? sl('p0', 'p₀', 0.05, 0.95, 0.01, p0) + sl('ph', 'p̂', 0.01, 0.99, 0.01, ph) + sl('n', 'n', 20, 1000, 10, Math.max(20, n)) :
              sl('mu0', 'μ₀', 400, 500, 1, mu0) + sl('xb', 'x̄', 400, 500, 0.5, xb) + sl('sg', tip === 'z' ? 'σ' : 's', 1, 60, 0.5, sg) + sl('n', 'n', 2, 100, 1, n));
          [].forEach.call(c.querySelectorAll('[data-s]'), function (s) { s.oninput = function () { var k = s.getAttribute('data-s'), v = +s.value; if (k === 'a') a = v; else if (k === 'mu0') mu0 = v; else if (k === 'xb') xb = v; else if (k === 'sg') sg = v; else if (k === 'n') n = v; else if (k === 'p0') p0 = v; else ph = v; c.querySelector('[data-o-' + k + ']').textContent = nf(v, s.step < 1 ? 2 : (k === 'xb' ? 1 : 0)); draw(); }; });
          [].forEach.call(c.querySelectorAll('[data-y] [data-k]'), function (x) { x.onclick = function () { yon = x.getAttribute('data-k'); [].forEach.call(c.querySelectorAll('[data-y] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); draw(); }; });
          draw();
        };
        var draw = function () {
          var se, st, cdf, kr, pdf, df = n - 1, ad;
          if (tip === 'p') { se = Math.sqrt(p0 * (1 - p0) / n); st = (ph - p0) / se; ad = 'z'; }
          else { se = sg / Math.sqrt(n); st = (xb - mu0) / se; ad = tip; }
          if (tip === 't') { cdf = function (x) { return M.tcdf(x, df); }; pdf = function (x) { return M.tpdf(x, df); }; kr = function (al) { return M.tkr(al, df); }; }
          else { cdf = M.Phi; pdf = function (x) { return M.npdf(x, 0, 1); }; kr = M.zkr; }
          var c = yon === 'iki' ? kr(a / 2) : kr(a), R = yon === 'iki' ? [[-99, -c], [c, 99]] : yon === 'sag' ? [[c, 99]] : [[-99, -c]];
          var p = yon === 'iki' ? 2 * (1 - cdf(Math.abs(st))) : yon === 'sag' ? 1 - cdf(st) : cdf(st), rej = p < a;
          el.querySelector('[data-g]').innerHTML = testC({ f: pdf, R: R, obs: st, lab: ad + ' = ' + nf(st, 2), xt: (yon === 'iki' ? [[-c, nf(-c, 3)], [0, '0'], [c, nf(c, 3)]] : [[0, '0'], [yon === 'sag' ? c : -c, nf(yon === 'sag' ? c : -c, 3)]]), d: -2, renk: tip === 't' ? PAL[4] : PAL[0] });
          el.querySelector('[data-o]').innerHTML = '<div><small>standart hata</small><b>' + nf(se, 4) + '</b></div><div><small>' + ad + '</small><b>' + nf(st, 3) + '</b></div><div><small>kritik</small><b>' + (yon === 'iki' ? '±' : yon === 'sol' ? '−' : '') + nf(c, 3) + '</b></div><div><small>p-değeri</small><b>' + nf(p, 4) + '</b></div>';
          el.querySelector('[data-n]').innerHTML = (tip === 'p' ? 'z = (' + nf(ph, 2) + ' − ' + nf(p0, 2) + ') / √(' + nf(p0, 2) + '·' + nf(1 - p0, 2) + '/' + n + ')' : ad + ' = (' + nf(xb, 1) + ' − ' + mu0 + ') / (' + nf(sg, 1) + '/√' + n + ')') + ' = ' + nf(st, 3) + (tip === 't' ? ', sd = ' + df : '') + '. p = ' + nf(p, 4) + (rej ? ' < ' : ' ≥ ') + nf(a, 2) + ' → ' + karar(rej) + '.' + (tip === 'p' && (n * p0 < 5 || n * (1 - p0) < 5) ? ' Uyarı: np₀ ≥ 5 koşulu sağlanmıyor.' : '');
        };
        [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (x) { x.onclick = function () { tip = x.getAttribute('data-k'); [].forEach.call(el.querySelectorAll('[data-t] [data-k]'), function (y) { y.setAttribute('aria-pressed', String(y === x)); }); if (tip === 't') { n = Math.min(n, 15); sg = 9; } if (tip === 'p') n = 200; ctl(); }; });
        ctl();
      }
    },
    sorular: function (r) {
      var out = [];
      var mu = r.pick([100, 250, 450, 500, 1000]), sg = r.pick([10, 12, 15, 20, 25]), n = r.pick([36, 40, 49, 50, 64, 100]), dlt = (r.int(-30, 30) || 12) / 10, xb = Math.round((mu + dlt * sg / Math.sqrt(n)) * 10) / 10, z = (xb - mu) / (sg / Math.sqrt(n));
      out.push({ viz: function (ka) { return IST.S.egri({ f: function (x) { return IST.M.npdf(x, 0, 1); }, a: -4.2, b: 4.2, ymax: 0.45, sh: [[-9, -1.96], [1.96, 9]], shAdim: 0, isaret: [z, 'z = ' + nf(z, 2)], isAdim: 2, xt: [[-1.96, '−1,96'], [0, '0'], [1.96, '1,96']] }, ka); }, tag: 'z testi', q: '<p>Bir fabrikada ürün ağırlığının ortalaması μ₀ = ' + mu + ' g, σ = ' + sg + ' g. Rastgele ' + n + ' ürünün ortalaması <b>' + nf(xb, 1) + ' g</b>.</p><p>z test istatistiği kaçtır? (iki ondalık)</p>', say: z, goster: nf(z, 2), tol: 0.011, ornek: '2,53',
        yanlis: function (v) { return Math.abs(v - (xb - mu) / sg) < 0.02 ? 'σ yerine σ/√n kullanmalısın.' : 'z = (x̄ − μ₀)/(σ/√n).'; },
        ip: 'z = (x̄ − μ₀)/(σ/√n).', cz: ['σ/√n = ' + sg + '/√' + n + ' = ' + nf(sg / Math.sqrt(n), 4) + '.', 'z = (' + nf(xb, 1) + ' − ' + mu + ') / ' + nf(sg / Math.sqrt(n), 4) + ' = <b>' + nf(z, 2) + '</b>.'] });
      var nt = r.int(8, 20), m0 = r.pick([5, 8, 10, 20, 30]), s = r.int(5, 30) / 10, xt = Math.round((m0 + r.int(-12, 25) / 10 * s / Math.sqrt(nt)) * 100) / 100, t = (xt - m0) / (s / Math.sqrt(nt)), tk = M.tkr(0.05, nt - 1), rej = t > tk;
      out.push({ tag: 't testi', q: '<p>Bir çağrı merkezinde ortalama görüşme süresinin <b>' + m0 + ' dakikayı aştığı</b> iddia ediliyor. ' + nt + ' görüşme: x̄ = ' + nf(xt, 2) + ', s = ' + nf(s, 1) + '. α = 0,05, H₁: μ > ' + m0 + '.</p><p>t istatistiğini hesapla ve karar ver.</p>', g: IST.ttab([nt - 1]) + '<p class="mono" style="margin:6px 0 0;font-size:13px">t = ' + nf(t, 3) + ' için karar?</p>', wide: true,
        o: ['H₀ reddedilir (t > ' + nf(tk, 3) + ')', 'H₀ reddedilmez (t ≤ ' + nf(tk, 3) + ')'], a: rej ? 0 : 1, n: 't = ' + nf(t, 3) + ', kritik t<sub>0,05; ' + (nt - 1) + '</sub> = ' + nf(tk, 3) + '.',
        ip: 't = (x̄ − μ₀)/(s/√n); sd = n − 1; sağ kuyruk α = 0,05 sütunu.', cz: ['s/√n = ' + nf(s, 1) + '/√' + nt + ' = ' + nf(s / Math.sqrt(nt), 4) + '.', 't = (' + nf(xt, 2) + ' − ' + m0 + ') / ' + nf(s / Math.sqrt(nt), 4) + ' = ' + nf(t, 3) + '.', 't<sub>0,05; ' + (nt - 1) + '</sub> = ' + nf(tk, 3) + ' → ' + (rej ? '<b>H₀ reddedilir</b>' : '<b>H₀ reddedilmez</b>') + '.'] });
      out[1].q = out[1].q.replace('t istatistiğini hesapla ve karar ver.', 't istatistiğini hesapla (yukarıda gösterildi) ve tablodaki kritik değerle karşılaştır. Karar nedir?');
      var p0 = r.pick([0.2, 0.25, 0.3, 0.4, 0.5]), nn = r.pick([100, 150, 200, 300, 400]), f = Math.round(nn * (p0 + r.int(-8, 10) / 100)), ph = f / nn, zp = (ph - p0) / Math.sqrt(p0 * (1 - p0) / nn);
      out.push({ viz: function (ka) { return IST.S.izgara(nn, f, '👤', 0, { lab: f + ' / ' + nn + ' kullanıyor · H₀: %' + Math.round(p0 * 100) }) + (ka >= 3 ? IST.S.egri({ f: function (x) { return IST.M.npdf(x, 0, 1); }, a: -4.2, b: 4.2, ymax: 0.45, sh: [[-9, -1.96], [1.96, 9]], shAdim: 0, isaret: [zp, 'z = ' + nf(zp, 2)], isAdim: 0, xt: [[-1.96, '−1,96'], [0, '0'], [1.96, '1,96']] }, ka) : ''); }, tag: 'oran testi', q: '<p>Bir bankada müşterilerin %' + Math.round(p0 * 100) + '’inin mobil şubeyi kullandığı biliniyor. Yeni arayüzden sonra ' + nn + ' müşteriden ' + f + '’i kullanıyor.</p><p>Oran testi için z istatistiği kaçtır? (iki ondalık)</p>', say: zp, goster: nf(zp, 2), tol: 0.011, ornek: '1,85',
        yanlis: function (v) { return Math.abs(v - (ph - p0) / Math.sqrt(ph * (1 - ph) / nn)) < 0.02 ? 'Testte standart hata H₀’daki p₀ ile hesaplanır, p̂ ile değil.' : 'z = (p̂ − p₀)/√(p₀(1 − p₀)/n).'; },
        ip: 'Standart hata H₀ altındaki p₀ ile: √(p₀(1 − p₀)/n).', cz: ['p̂ = ' + f + '/' + nn + ' = ' + nf(ph, 4) + '.', '√(' + nf(p0, 2) + '·' + nf(1 - p0, 2) + '/' + nn + ') = ' + nf(Math.sqrt(p0 * (1 - p0) / nn), 4) + '.', 'z = <b>' + nf(zp, 2) + '</b>.'] });
      var nv = r.int(10, 25), s0 = r.pick([4, 9, 16, 25]), s2 = Math.round(s0 * r.int(60, 200) / 100 * 10) / 10, c2 = (nv - 1) * s2 / s0;
      out.push({ viz: function (ka) { var df = nv - 1, kr = M.c2kr(0.05, df), b = Math.max(c2 * 1.3, kr * 1.4); return IST.S.egri({ f: function (x) { return M.c2pdf(x, df); }, a: 0, b: b, ymax: M.c2pdf(Math.max(df - 2, 0.5), df) * 1.25, sh: [[kr, 9999]], shAdim: 0, isaret: [c2, 'χ² = ' + nf(c2, 2)], isAdim: 2, xt: [[0, '0'], [df, 'sd ' + df], [kr, nf(kr, 2)]], renk: PAL[2] }, ka); }, tag: 'ki-kare', q: '<p>Bir makinenin dolum varyansı σ₀² = ' + s0 + ' olmalı. ' + nv + ' ölçümde s² = ' + nf(s2, 1) + ' bulundu.</p><p>Varyans testi için χ² istatistiği kaçtır? (iki ondalık)</p>', say: c2, goster: nf(c2, 2), tol: 0.011, ornek: '22,75',
        ip: 'χ² = (n − 1)s² / σ₀².', cz: ['(' + nv + ' − 1) × ' + nf(s2, 1) + ' / ' + s0 + '.', '= <b>' + nf(c2, 2) + '</b> (sd = ' + (nv - 1) + ').'] });
      var sc = r.pick([['n = 12 ölçüm, σ bilinmiyor, anakütle normal; ortalama test edilecek.', 1], ['n = 64, σ geçmiş kayıtlardan biliniyor; ortalama test edilecek.', 0], ['400 müşteriden kaçının memnun olduğu ölçüldü; memnuniyet oranı %60 mı?', 2], ['Dolum miktarlarının değişkenliği belirlenen sınırı aşıyor mu?', 3]]);
      out.push({ tag: 'test seçimi', q: '<p>' + X(sc[0]) + '</p><p>Hangi test kullanılmalıdır?</p>', o: ['z testi (ortalama)', 't testi (ortalama)', 'Oran için z testi', 'Varyans için ki-kare testi'], a: sc[1], n: ['σ biliniyor.', 'σ bilinmiyor ve n küçük.', 'Parametre bir oran.', 'Parametre bir varyans.'][sc[1]],
        ip: 'Hangi parametre test ediliyor? σ biliniyor mu?', cz: ['Parametre: ' + ['ortalama', 'ortalama', 'oran', 'varyans'][sc[1]] + '.', 'Cevap: <b>' + ['z testi', 't testi', 'oran z testi', 'ki-kare testi'][sc[1]] + '</b>.'] });
      return out;
    }
  });

  /* ======================= BAHAR 6 ======================= */
  var S1 = [85, 87, 90, 78, 82, 88, 92], S2 = [81, 79, 85, 75, 80, 84, 89];
  IST.hafta({
    id: 'b6', no: 6, renk: '#B84A6B', tr: 'İki örneklem hipotez testleri', en: 'Two Samples Hypothesis Testing',
    sahneler: [
      {
        b: 'İki bağımsız örneklem: z testi', terim: [['bağımsız örneklemler', 'independent samples'], ['ortalamalar farkı', 'difference of means']],
        t: '<p>İstatistik dersini BUS ve ITB öğrencileri alıyor. Geçmiş yıllarda final notlarının varyansları 12 ve 14. Bu dönem 140 BUS ve 120 ITB öğrencisinin ortalamaları <b>62 ve 65</b>.</p><p class="mono">z = (x̄₁ − x̄₂) / √(σ₁²/n₁ + σ₂²/n₂)</p><p>z = (62 − 65) / √(12/140 + 14/120) = −3 / 0,450 = <b>−6,67</b> → |z| &gt; 1,96, <b>H₀ reddedilir</b>: iki bölümün ortalamaları farklı.</p>',
        v: function () { return V.curve({ f: function (x) { return M.npdf(x, 62, 0.293) * 0.5 + 0; }, a: 60.5, b: 66.5, ymax: 0.75, h: 200, xt: [[61, '61'], [62, 'BUS 62'], [65, 'ITB 65'], [66, '66']], extra: function (xs, ys) { var p = []; for (var x = 60.5; x <= 66.5; x += 0.02) p.push(xs(x).toFixed(1) + ' ' + ys(M.npdf(x, 65, 0.342) * 0.5).toFixed(1)); return '<path class="dr" style="--len:900;--d:.8s" d="M' + p.join('L') + '" fill="none" stroke="' + PAL[1] + '" stroke-width="3"/><text class="lbl" x="' + xs(63.5) + '" y="' + ys(0.65) + '" text-anchor="middle">x̄’lerin örnekleme dağılımları ayrışmış</text>'; } }) + V.fx([{ s: 'standart hata', h: '√(12/140 + 14/120) = 0,450' }, { s: 'test istatistiği', h: 'z = −3 / 0,450 = <b>−6,67</b>', son: true }], 1.5); }
      },
      {
        b: 'Küçük örneklemler: havuzlanmış t testi', terim: [['havuzlanmış varyans', 'pooled variance s_p²'], ['eşit varyans varsayımı', 'equal variances']],
        t: '<p>n &lt; 30 ve varyanslar eşit varsayılıyorsa:</p><p class="mono">s<sub>p</sub>² = [(n₁−1)s₁² + (n₂−1)s₂²] / (n₁ + n₂ − 2)<br>t = (x̄₁ − x̄₂) / √(s<sub>p</sub>²(1/n₁ + 1/n₂))</p><p>İki sınıfın puanları: Sınıf 1 (x̄ = 86, s² = 23), Sınıf 2 (x̄ = 81,86, s² = 20,81). s<sub>p</sub>² = 21,90 → t = <b>1,66</b>; t<sub>0,025; 12</sub> = 2,179 → <b>H₀ reddedilmez</b>.</p>',
        v: function () { return V.dots({ v: S1, min: 70, max: 95, h: 110, step: 5, renk: PAL[0] }).replace('</svg>', '<text class="lbb" x="24" y="14">Sınıf 1 · x̄ = 86</text></svg>') + V.dots({ v: S2, min: 70, max: 95, h: 110, step: 5, renk: PAL[1], d: 0.5 }).replace('</svg>', '<text class="lbb" x="24" y="14">Sınıf 2 · x̄ = 81,86</text></svg>') + V.fx([{ s: 'havuzlanmış varyans', h: '(6·23 + 6·20,81) / 12 = 21,90' }, { s: 'test istatistiği', h: 't = 4,14 / √(21,90·2/7) = <b>1,66</b> < 2,179', son: true }], 1.2); }
      },
      {
        b: 'Varyanslar eşit değilse: Welch t testi', terim: [['Welch t testi', 'Welch’s t test']],
        t: '<p>İki otomobil modelinin yakıt tüketimi karşılaştırılıyor; varyansların eşit olduğu varsayılamıyor. Bu durumda havuzlama yapılmaz:</p><p class="mono">t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)</p><p>Serbestlik derecesi Welch–Satterthwaite formülüyle (genellikle tam sayı olmayan) hesaplanır; yazılımlar bunu otomatik yapar. Varyanslar belirgin farklıysa bu test daha güvenlidir.</p>',
        v: function () { return V.curve({ f: function (x) { return M.npdf(x, 6.2, 0.4); }, a: 4, b: 9, ymax: 1.05, h: 220, xt: [[5, '5'], [6.2, 'A: 6,2'], [7.1, 'B: 7,1'], [9, '9']], renk: PAL[0], extra: function (xs, ys) { var p = []; for (var x = 4; x <= 9; x += 0.02) p.push(xs(x).toFixed(1) + ' ' + ys(M.npdf(x, 7.1, 0.9)).toFixed(1)); return '<path class="dr" style="--len:900;--d:.8s" d="M' + p.join('L') + '" fill="none" stroke="' + PAL[1] + '" stroke-width="3"/><text class="lbl" x="' + xs(8.3) + '" y="' + ys(0.4) + '">B: daha geniş yayılım</text>'; } }); }
      },
      {
        b: 'Eşleştirilmiş örneklemler', terim: [['eşleştirilmiş t testi', 'paired t test'], ['farklar', 'differences d']],
        t: '<p>Aynı kişiler <b>önce ve sonra</b> ölçülüyorsa örneklemler bağımlıdır. Her kişinin farkı d alınır, farklar tek örneklem gibi test edilir:</p><p class="mono">t = d̄ / (s<sub>d</sub>/√n), sd = n − 1</p><p>Bir satış eğitiminden önce ve sonra 6 temsilcinin haftalık satışları: farklar 3, 5, −1, 4, 6, 2 → d̄ = 3,17, s<sub>d</sub> = 2,48 → t = <b>3,13</b> &gt; t<sub>0,05; 5</sub> = 2,015 → eğitim satışları artırmış.</p>',
        v: function () { var b = [20, 18, 25, 22, 19, 24], a = [23, 23, 24, 26, 25, 26], s = '', ys = V.sc(10, 30, 200, 20); a.forEach(function (v, i) { var x = 60 + i * 80; s += '<line class="dr" style="--len:200;--d:' + (0.3 + i * 0.15) + 's" x1="' + x + '" x2="' + x + '" y1="' + ys(b[i]) + '" y2="' + ys(v) + '" stroke="' + (v > b[i] ? PAL[2] : PAL[1]) + '" stroke-width="4"/><circle cx="' + x + '" cy="' + ys(b[i]) + '" r="7" fill="#fff" stroke="#0D1838" stroke-width="2"/><circle class="pop" ' + d(0.5 + i * 0.15) + ' cx="' + x + '" cy="' + ys(v) + '" r="7" fill="' + PAL[2] + '" stroke="#0D1838"/><text class="lbm" x="' + x + '" y="222" text-anchor="middle">' + (v - b[i] > 0 ? '+' : '') + (v - b[i]) + '</text>'; }); s += '<text class="lbl" x="20" y="14">boş: önce · dolu: sonra · alttaki sayılar: farklar d</text>'; return V.svg(540, 232, s, 'önce ve sonra'); }
      },
      {
        b: 'İki oranın karşılaştırılması', terim: [['iki oran testi', 'two-proportion z test'], ['havuzlanmış oran', 'pooled proportion p̄']],
        t: '<p>Kış lastiği kullanımı: 1. şehirde 100 araçtan 60’ı (0,60), 2. şehirde 120 araçtan 78’i (0,65). α = 0,05.</p><p class="mono">p̄ = (60 + 78)/(100 + 120) = 0,6273<br>z = (0,60 − 0,65) / √(p̄(1 − p̄)(1/100 + 1/120)) = <b>−0,77</b></p><p>|z| &lt; 1,96 → <b>H₀ reddedilmez</b>: iki şehrin kullanım oranları arasında anlamlı fark yok.</p>',
        v: function () { return V.bars({ x: ['1. şehir', '2. şehir'], y: [0.6, 0.65], max: 1, h: 180, fmt: function (v) { return nf(v, 2); }, renk: [PAL[0], PAL[1]] }) + V.norm({ m: 0, s: 1, sh: [[-4, -1.96], [1.96, 4]], shc: PAL[1], h: 130, xt: [[-1.96, '−1,96'], [-0.77, '−0,77'], [1.96, '1,96']], d: 0.8 }); }
      },
      {
        b: 'İki varyansın karşılaştırılması: F testi', terim: [['F dağılımı', 'F distribution'], ['varyans oranı', 'variance ratio']],
        t: '<p class="mono">F = s₁² / s₂², sd = (n₁ − 1, n₂ − 1)</p><p>Büyük varyans paya yazılır; F kritik değeri aşarsa varyanslar farklıdır. Bu test, havuzlanmış t mi Welch t mi kullanacağımıza karar vermede yardımcı olur. Gelecek hafta F dağılımını ANOVA’da kullanacağız.</p>',
        v: function () { return V.curve({ f: function (x) { return M.fpdf(x, 6, 6); }, a: 0, b: 6, ymax: 0.8, sh: [M.fkr(0.05, 6, 6), 9], shc: PAL[1], h: 220, xt: [[0, '0'], [1, '1'], [M.fkr(0.05, 6, 6), nf(M.fkr(0.05, 6, 6), 2)], [6, '6']], renk: PAL[4] }); }
      }
    ],
    gorsel: {
      b: 'İki grup karşılaştırıcı', t: 'İki grubun ortalamasını, standart sapmasını ve büyüklüğünü değiştir. Örnekleme dağılımlarının örtüşmesi azaldıkça t büyür, p küçülür.',
      kur: function (el) {
        var g = { m1: 86, m2: 82, s1: 5, s2: 5, n1: 7, n2: 7 };
        el.innerHTML = '<div class="at-g"><div class="at-k">' + [['m1', 'x̄₁', 60, 100, 0.5], ['m2', 'x̄₂', 60, 100, 0.5], ['s1', 's₁', 1, 20, 0.5], ['s2', 's₂', 1, 20, 0.5], ['n1', 'n₁', 3, 60, 1], ['n2', 'n₂', 3, 60, 1]].map(function (q) { return '<label><span>' + q[1] + ' <output data-o-' + q[0] + '>' + g[q[0]] + '</output></span><input type="range" min="' + q[2] + '" max="' + q[3] + '" step="' + q[4] + '" value="' + g[q[0]] + '" data-s="' + q[0] + '"></label>'; }).join('') + '</div><div class="at-v"><div data-g></div><div class="at-out" data-o></div><div class="at-not" data-n></div></div></div>';
        var draw = function () {
          var se1 = g.s1 / Math.sqrt(g.n1), se2 = g.s2 / Math.sqrt(g.n2), sp2 = ((g.n1 - 1) * g.s1 * g.s1 + (g.n2 - 1) * g.s2 * g.s2) / (g.n1 + g.n2 - 2), df = g.n1 + g.n2 - 2, se = Math.sqrt(sp2 * (1 / g.n1 + 1 / g.n2)), t = (g.m1 - g.m2) / se, p = 2 * (1 - M.tcdf(Math.abs(t), df)), tk = M.tkr(0.025, df);
          var lo = Math.min(g.m1 - 4 * se1, g.m2 - 4 * se2), hi = Math.max(g.m1 + 4 * se1, g.m2 + 4 * se2), xs = V.sc(lo, hi, 30, 520), ym = Math.max(M.npdf(0, 0, se1), M.npdf(0, 0, se2)) * 1.1, ys = V.sc(0, ym, 200, 14), s = '<line x1="30" x2="520" y1="200" y2="200" stroke="#0D1838" stroke-width="2"/>';
          [[g.m1, se1, PAL[0], 'grup 1'], [g.m2, se2, PAL[1], 'grup 2']].forEach(function (c) { var p2 = []; for (var i = 0; i <= 200; i++) { var x = lo + (hi - lo) * i / 200; p2.push(xs(x).toFixed(1) + ' ' + ys(M.npdf(x, c[0], c[1])).toFixed(1)); } s += '<path d="M30 200L' + p2.join('L') + 'L520 200Z" fill="' + c[2] + '" fill-opacity=".25" stroke="' + c[2] + '" stroke-width="2.5"/><text class="lbb" x="' + xs(c[0]) + '" y="' + (ys(M.npdf(0, 0, c[1])) - 6) + '" text-anchor="middle" style="fill:' + c[2] + '">' + c[3] + '</text>'; });
          for (var k = 0; k <= 4; k++) { var v = lo + (hi - lo) * k / 4; s += '<text class="lbm" x="' + xs(v) + '" y="216" text-anchor="middle">' + nf(v, 1) + '</text>'; }
          el.querySelector('[data-g]').innerHTML = V.svg(540, 224, s, 'iki ortalamanın örnekleme dağılımları');
          el.querySelector('[data-o]').innerHTML = '<div><small>fark</small><b>' + nf(g.m1 - g.m2, 2) + '</b></div><div><small>s<sub>p</sub>²</small><b>' + nf(sp2, 2) + '</b></div><div><small>t (sd ' + df + ')</small><b>' + nf(t, 3) + '</b></div><div><small>p (çift yönlü)</small><b>' + nf(p, 4) + '</b></div>';
          el.querySelector('[data-n]').innerHTML = 'Havuzlanmış t = ' + nf(t, 3) + ', kritik ±' + nf(tk, 3) + ' (α = 0,05) → ' + karar(Math.abs(t) > tk) + '. Aynı farkı daha büyük n ya da daha küçük s ile ölçersen kanıt güçlenir. Varyans oranı F = ' + nf(Math.max(g.s1, g.s2) * Math.max(g.s1, g.s2) / (Math.min(g.s1, g.s2) * Math.min(g.s1, g.s2)), 2) + (Math.max(g.s1, g.s2) / Math.min(g.s1, g.s2) > 2 ? ' — varyanslar çok farklı, Welch testi daha uygun.' : '.');
        };
        [].forEach.call(el.querySelectorAll('[data-s]'), function (s) { s.oninput = function () { var k = s.getAttribute('data-s'); g[k] = +s.value; el.querySelector('[data-o-' + k + ']').textContent = s.value; draw(); }; });
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var v1 = r.int(8, 30), v2 = r.int(8, 30), n1 = r.int(40, 150), n2 = r.int(40, 150), m1 = r.int(55, 80), m2 = m1 + r.int(1, 4) * (r() < 0.5 ? -1 : 1), z = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);
      out.push({ viz: function (ka) { return IST.S.egri({ f: function (x) { return IST.M.npdf(x, 0, 1); }, a: -4.2, b: 4.2, ymax: 0.45, sh: [[-9, -1.96], [1.96, 9]], shAdim: 0, isaret: [z, 'z = ' + nf(z, 2)], isAdim: 2, xt: [[-1.96, '−1,96'], [0, '0'], [1.96, '1,96']] }, ka); }, tag: 'iki örneklem z', q: '<p>İki şubenin müşteri memnuniyet puanları karşılaştırılıyor. Bilinen varyanslar σ₁² = ' + v1 + ', σ₂² = ' + v2 + '. Örneklemler: n₁ = ' + n1 + ' (x̄₁ = ' + m1 + '), n₂ = ' + n2 + ' (x̄₂ = ' + m2 + ').</p><p>z istatistiği kaçtır? (iki ondalık)</p>', say: z, goster: nf(z, 2), tol: 0.011, ornek: '−6,67',
        ip: 'z = (x̄₁ − x̄₂)/√(σ₁²/n₁ + σ₂²/n₂).', cz: ['√(' + v1 + '/' + n1 + ' + ' + v2 + '/' + n2 + ') = ' + nf(Math.sqrt(v1 / n1 + v2 / n2), 4) + '.', 'z = (' + m1 + ' − ' + m2 + ') / ' + nf(Math.sqrt(v1 / n1 + v2 / n2), 4) + ' = <b>' + nf(z, 2) + '</b>.'] });
      var a = [], b = [], k = r.int(5, 7); for (var i = 0; i < k; i++) { a.push(r.int(70, 95)); b.push(r.int(65, 92)); }
      var sp = ((k - 1) * M.varS(a) + (k - 1) * M.varS(b)) / (2 * k - 2), t = (M.mean(a) - M.mean(b)) / Math.sqrt(sp * 2 / k);
      out.push({ tag: 'havuzlanmış t', q: '<p>İki eğitim yönteminin sınav puanları (varyanslar eşit varsayılıyor):</p><p class="mono">A: ' + a.join(', ') + '<br>B: ' + b.join(', ') + '</p><p>Havuzlanmış t istatistiği kaçtır? (iki ondalık)</p>', say: t, goster: nf(t, 2), tol: 0.015, ornek: '1,66',
        ip: 's<sub>p</sub>² = [(n₁−1)s₁² + (n₂−1)s₂²]/(n₁+n₂−2); t = (x̄₁ − x̄₂)/√(s<sub>p</sub>²(1/n₁ + 1/n₂)).', cz: ['x̄_A = ' + nf(M.mean(a), 3) + ', s_A² = ' + nf(M.varS(a), 3) + '; x̄_B = ' + nf(M.mean(b), 3) + ', s_B² = ' + nf(M.varS(b), 3) + '.', 's<sub>p</sub>² = ' + nf(sp, 3) + '.', 't = ' + nf(M.mean(a) - M.mean(b), 3) + ' / √(' + nf(sp, 3) + ' × 2/' + k + ') = <b>' + nf(t, 2) + '</b> (sd = ' + (2 * k - 2) + ').'] });
      var dd = [], kk = r.int(5, 8); for (i = 0; i < kk; i++) dd.push(r.int(-3, 8)); if (M.sdS(dd) === 0) dd[0] += 2;
      var tp = M.mean(dd) / (M.sdS(dd) / Math.sqrt(kk));
      out.push({ tag: 'eşleştirilmiş t', q: '<p>Bir verimlilik yazılımının etkisi için ' + kk + ' çalışanın günlük tamamlanan iş sayısındaki farklar (sonra − önce):</p><p class="mono">' + dd.join(', ') + '</p><p>Eşleştirilmiş t istatistiği kaçtır? (iki ondalık)</p>', say: tp, goster: nf(tp, 2), tol: 0.015, ornek: '3,13',
        ip: 't = d̄ / (s<sub>d</sub>/√n).', cz: ['d̄ = ' + nf(M.mean(dd), 4) + ', s<sub>d</sub> = ' + nf(M.sdS(dd), 4) + '.', 't = ' + nf(M.mean(dd), 4) + ' / (' + nf(M.sdS(dd), 4) + '/√' + kk + ') = <b>' + nf(tp, 2) + '</b> (sd = ' + (kk - 1) + ').'] });
      var N1 = r.pick([100, 120, 150, 200]), N2 = r.pick([100, 120, 150, 200]), x1 = Math.round(N1 * r.int(30, 70) / 100), x2 = Math.round(N2 * r.int(30, 70) / 100), pb = (x1 + x2) / (N1 + N2), zp = (x1 / N1 - x2 / N2) / Math.sqrt(pb * (1 - pb) * (1 / N1 + 1 / N2));
      out.push({ viz: function (ka) { return IST.S.cift(['A sayfası', 'B sayfası', 'havuzlanmış p̄'], [x1 / N1, x2 / N2, pb], ka, { k: [0, 0, 1], max: 1, fmt: function (v) { return nf(v, 3); }, renk: [PAL[0], PAL[1], PAL[3]] }); }, tag: 'iki oran', q: '<p>A/B testi: A sayfasını gören ' + N1 + ' kişiden ' + x1 + '’i, B sayfasını gören ' + N2 + ' kişiden ' + x2 + '’si satın aldı.</p><p>İki oran testi için z istatistiği kaçtır? (iki ondalık)</p>', say: zp, goster: nf(zp, 2), tol: 0.012, ornek: '−0,77',
        ip: 'Havuzlanmış oran p̄ = (x₁ + x₂)/(n₁ + n₂); z = (p̂₁ − p̂₂)/√(p̄(1 − p̄)(1/n₁ + 1/n₂)).', cz: ['p̂₁ = ' + nf(x1 / N1, 4) + ', p̂₂ = ' + nf(x2 / N2, 4) + ', p̄ = ' + nf(pb, 4) + '.', 'Standart hata = ' + nf(Math.sqrt(pb * (1 - pb) * (1 / N1 + 1 / N2)), 4) + '.', 'z = <b>' + nf(zp, 2) + '</b>.'] });
      var sc = r.pick([['Aynı 15 hastanın tedavi öncesi ve sonrası tansiyonları karşılaştırılıyor.', 2], ['İki fabrikadan 8’er ürünün ağırlığı karşılaştırılıyor; varyanslar eşit varsayılıyor.', 1], ['İki ilde 500’er kişiye “e-devlet kullanıyor musunuz?” soruldu.', 3], ['Varyansları bilinen iki büyük grubun (n = 150 ve 180) ortalamaları karşılaştırılıyor.', 0]]);
      out.push({ tag: 'test seçimi', q: '<p>' + X(sc[0]) + '</p><p>Hangi test uygundur?</p>', o: ['İki örneklem z testi', 'Havuzlanmış iki örneklem t testi', 'Eşleştirilmiş t testi', 'İki oran z testi'], a: sc[1], n: ['Büyük örneklemler, bilinen varyanslar.', 'Küçük bağımsız örneklemler, eşit varyans.', 'Aynı birimler iki kez ölçülüyor.', 'Karşılaştırılan iki oran.'][sc[1]],
        ip: 'Örneklemler bağımsız mı? Ortalama mı, oran mı?', cz: ['Bağımlılık ve parametre türünü belirle.', 'Cevap: <b>' + ['iki örneklem z', 'havuzlanmış t', 'eşleştirilmiş t', 'iki oran z'][sc[1]] + '</b>.'] });
      return out;
    }
  });

  /* ======================= BAHAR 7 ======================= */
  var GOLF = [[254, 263, 241, 237, 251], [234, 218, 235, 227, 216], [200, 222, 197, 206, 204]];
  var anova = function (G) { var all = [].concat.apply([], G), gm = M.mean(all), ssb = M.sum(G.map(function (g) { return g.length * Math.pow(M.mean(g) - gm, 2); })), ssw = M.sum(G.map(function (g) { var m = M.mean(g); return M.sum(g.map(function (v) { return (v - m) * (v - m); })); })), k = G.length, n = all.length; return { gm: gm, ssb: ssb, ssw: ssw, sst: ssb + ssw, d1: k - 1, d2: n - k, msb: ssb / (k - 1), msw: ssw / (n - k), F: ssb / (k - 1) / (ssw / (n - k)) }; };
  IST.anova = anova;
  IST.hafta({
    id: 'b7', no: 7, renk: '#E0A526', tr: 'Varyans analizi (ANOVA)', en: 'ANOVA',
    sahneler: [
      {
        b: 'Neden çok sayıda t testi yapmıyoruz?', terim: [['varyans analizi', 'analysis of variance (ANOVA)'], ['aile hata oranı', 'familywise error rate']],
        t: '<p>Üç anakütle ortalamasını ikişer ikişer karşılaştırmak için 3 t testi, beşini karşılaştırmak için <b>10</b> t testi gerekir. Her test %5 I. tür hata riski taşıdığından toplam risk hızla büyür: 10 testte 1 − 0,95¹⁰ ≈ <b>%40</b>!</p><p><b>ANOVA</b>, tüm ortalamaları <b>tek bir testle</b> karşılaştırır: H₀: μ₁ = μ₂ = … = μ<sub>k</sub>; H₁: en az biri farklı.</p>',
        v: function () { return V.bars({ x: ['2 grup', '3 grup', '4 grup', '5 grup', '6 grup'], y: [1, 3, 6, 10, 15].map(function (m) { return (1 - Math.pow(0.95, m)) * 100; }), h: 230, max: 60, fmt: function (v) { return '%' + nf(v, 0); }, renk: PAL[1], xlab: 'tüm ikili t testleri yapılırsa en az bir I. tür hata olasılığı', yfmt: function (v) { return '%' + nf(v, 0); } }); }
      },
      {
        b: 'Golf sopaları deneyi', terim: [['grup', 'group / treatment'], ['genel ortalama', 'grand mean']],
        t: '<p>Üç golf sopası otomatik bir vuruş makinesiyle test ediliyor; her sopayla 5 atış mesafesi (metre) ölçülüyor. α = 0,05.</p><p>Ortalamalar: Sopa 1 <b>249,2</b>, Sopa 2 <b>226,0</b>, Sopa 3 <b>205,8</b>; genel ortalama <b>227,0</b>. Farklar gerçek mi, yoksa atıştan atışa değişkenlik mi?</p>',
        v: function () { return GOLF.map(function (g, i) { return V.dots({ v: g, min: 190, max: 270, h: 84, step: 10, r: 7, renk: PAL[i], d: i * 0.4, mark: [[M.mean(g), 'x̄ ' + nf(M.mean(g), 1), PAL[i]]] }).replace('</svg>', '<text class="lbb" x="24" y="40">Sopa ' + (i + 1) + '</text></svg>'); }).join(''); }
      },
      {
        b: 'Değişkenliği ikiye ayırmak', terim: [['gruplar arası kareler toplamı', 'SSB (between)'], ['grup içi kareler toplamı', 'SSW (within)'], ['toplam', 'SST']],
        t: '<p class="mono">SST = SSB + SSW</p><ul><li><b>SSB</b> (gruplar arası): grup ortalamalarının genel ortalamadan sapması. SSB = 5(249,2 − 227)² + 5(226 − 227)² + 5(205,8 − 227)² = <b>4716,4</b></li><li><b>SSW</b> (grup içi): her gözlemin kendi grup ortalamasından sapması = <b>1119,6</b></li><li>SST = 4716,4 + 1119,6 = <b>5836,0</b></li></ul>',
        v: function () { var A = anova(GOLF), w = 480; return V.svg(540, 120, '<rect class="gx" x="30" y="30" width="' + (w * A.ssb / A.sst).toFixed(1) + '" height="46" fill="' + PAL[3] + '" stroke="#0D1838" stroke-width="2"/><rect class="gx" ' + d(0.4) + ' x="' + (30 + w * A.ssb / A.sst).toFixed(1) + '" y="30" width="' + (w * A.ssw / A.sst).toFixed(1) + '" height="46" fill="' + PAL[0] + '" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="40" y="58">SSB 4716,4 (%80,8)</text><text class="lbb fd" ' + d(0.6) + ' x="' + (40 + w * A.ssb / A.sst).toFixed(1) + '" y="58" style="fill:#fff">SSW 1119,6</text><text class="lbl" x="30" y="100">SST = 5836,0: değişkenliğin çoğu sopalar arasındaki farktan geliyor</text>', 'kareler toplamının ayrışması'); }
      },
      {
        b: 'ANOVA tablosu', terim: [['kareler ortalaması', 'mean square MS'], ['F oranı', 'F ratio']],
        t: '<p>Kareler toplamları serbestlik derecelerine bölünerek <b>kareler ortalaması</b> bulunur; F oranı ikisinin oranıdır:</p><p class="mono">F = MSB / MSW = 2358,2 / 93,3 = <b>25,28</b></p><p>Gruplar arası sd = c − 1 = 2; grup içi sd = n − c = 15 − 3 = 12.</p>',
        v: function () { var A = anova(GOLF); return V.tablo(['Kaynak', 'SS', 'sd', 'MS', 'F'], [['Gruplar arası', nf(A.ssb, 1), '2', nf(A.msb, 1), '<b>' + nf(A.F, 2) + '</b>'], ['Grup içi', nf(A.ssw, 1), '12', nf(A.msw, 1), ''], ['Toplam', nf(A.sst, 1), '14', '', '']], { n: [1, 2, 3, 4], st: 0.3, hi: { '0,4': 'hi' } }); }
      },
      {
        b: 'F dağılımı ve karar', terim: [['F kritik değeri', 'F critical value']],
        t: '<p>H₀ doğruysa F değeri 1 civarında olur. F<sub>0,05; 2; 12</sub> = <b>3,89</b>. Hesaplanan F = 25,28 bu değeri çok aşıyor → <b>H₀ reddedilir</b>.</p><p>Yorum: en az bir sopanın ortalama vuruş mesafesi diğerlerinden farklı. Hangisi(leri) olduğunu bulmak için çoklu karşılaştırma testleri (ör. Tukey) kullanılır.</p>',
        v: function () { return V.curve({ f: function (x) { return M.fpdf(x, 2, 12); }, a: 0, b: 28, ymax: 1.05, sh: [3.89, 99], shc: PAL[1], h: 230, xt: [[0, '0'], [3.89, '3,89'], [10, '10'], [20, '20'], [25.28, '25,28']], renk: PAL[4], extra: function (xs, ys, y0) { return '<g class="pop" ' + d(1.3) + '><line x1="' + xs(25.28) + '" x2="' + xs(25.28) + '" y1="' + y0 + '" y2="30" stroke="#0D1838" stroke-width="2.5"/><path d="M' + xs(25.28) + ' 28l-6-10h12z" fill="#E0A526" stroke="#0D1838"/><text class="lbb" x="' + (xs(25.28) - 6) + '" y="22" text-anchor="end">F = 25,28 → red</text></g>'; } }); }
      },
      {
        b: 'ANOVA’nın varsayımları', terim: [['bağımsızlık', 'independence'], ['normallik', 'normality'], ['varyans homojenliği', 'equal variances']],
        t: '<ul><li>Gözlemler <b>bağımsızdır</b> (rastgele örneklem / rastgele atama).</li><li>Her grubun anakütlesi <b>normal</b> dağılır.</li><li>Grupların varyansları <b>eşittir</b> (golfte 108,2; 77,5; 94,2 — benzer).</li></ul><p>Varsayımlar ciddi biçimde bozuluyorsa parametrik olmayan Kruskal–Wallis testi kullanılır (12. hafta).</p>',
        v: function () { return V.tablo(['Sopa', 'Ortalama', 'Varyans'], GOLF.map(function (g, i) { return [String(i + 1), nf(M.mean(g), 1), nf(M.varS(g), 1)]; }), { n: [1, 2], st: 0.3 }); }
      }
    ],
    gorsel: {
      b: 'ANOVA sürgüleri', t: 'Üç grubun ortalamalarını ve grup içi yayılımı değiştir. Grup ortalamaları birbirinden uzaklaştıkça SSB, yayılım arttıkça SSW büyür; F ve karar canlı güncellenir.',
      kur: function (el) {
        var mm = [249, 226, 206], sp = 1, base = GOLF.map(function (g) { var m = M.mean(g); return g.map(function (v) { return v - m; }); });
        el.innerHTML = '<div class="at-g"><div class="at-k">' + mm.map(function (m, i) { return '<label><span>grup ' + (i + 1) + ' ortalaması <output data-o' + i + '>' + m + '</output></span><input type="range" min="190" max="270" value="' + m + '" data-m="' + i + '"></label>'; }).join('') + '<label><span>grup içi yayılım × <output data-so>1</output></span><input type="range" min="0.2" max="4" step="0.1" value="1" data-s></label></div><div class="at-v"><div data-g></div><div data-t></div><div class="at-not" data-n></div></div></div>';
        var draw = function () {
          var G = base.map(function (b, i) { return b.map(function (v) { return Math.round((mm[i] + v * sp) * 10) / 10; }); }), A = anova(G), fk = M.fkr(0.05, 2, 12), p = 1 - M.fcdf(A.F, 2, 12);
          el.querySelector('[data-g]').innerHTML = G.map(function (g, i) { return V.dots({ v: g, min: 150, max: 310, h: 70, step: 20, r: 6, renk: PAL[i], d: -2, mark: [[M.mean(g), '', PAL[i]]] }); }).join('');
          el.querySelector('[data-t]').innerHTML = V.tablo(['', 'SS', 'sd', 'MS', 'F'], [['arası', nf(A.ssb, 1), '2', nf(A.msb, 1), '<b>' + nf(A.F, 2) + '</b>'], ['içi', nf(A.ssw, 1), '12', nf(A.msw, 1), ''], ['toplam', nf(A.sst, 1), '14', '', '']], { n: [1, 2, 3, 4], st: 0 });
          el.querySelector('[data-n]').innerHTML = 'F = ' + nf(A.F, 2) + ', F<sub>0,05; 2; 12</sub> = ' + nf(fk, 2) + ', p = ' + nf(p, 4) + ' → ' + karar(A.F > fk) + '. Ortalamaları eşitle: SSB → 0, F → 0. Yayılımı büyüt: aynı ortalama farkları anlamsızlaşır.';
          mm.forEach(function (m, i) { el.querySelector('[data-o' + i + ']').textContent = m; }); el.querySelector('[data-so]').textContent = nf(sp, 1);
        };
        [].forEach.call(el.querySelectorAll('[data-m]'), function (s) { s.oninput = function () { mm[+s.getAttribute('data-m')] = +s.value; draw(); }; });
        el.querySelector('[data-s]').oninput = function () { sp = +this.value; draw(); };
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var k = r.int(3, 4), n = r.int(4, 6), ms = []; for (var i = 0; i < k; i++) ms.push(r.int(40, 80)); var gm = M.mean(ms), ssb = M.sum(ms.map(function (m) { return n * (m - gm) * (m - gm); }));
      out.push({ viz: function (ka) { return IST.S.cift(ms.map(function (_, i) { return 'Mağaza ' + (i + 1); }).concat(['genel ort.']), ms.concat([gm]), ka, { k: ms.map(function () { return 0; }).concat([1]), fmt: function (v) { return nf(v, 1); }, renk: [PAL[0], PAL[1], PAL[2], PAL[4], PAL[3]] }); }, tag: 'SSB', q: '<p>' + k + ' mağazada her birinden ' + n + ' gün satış kaydı alındı. Mağaza ortalamaları: <b>' + ms.join(', ') + '</b> (eşit grup büyüklükleri).</p><p>Gruplar arası kareler toplamı SSB kaçtır? (iki ondalık)</p>', say: ssb, goster: nf(ssb, 2), tol: 0.02, ornek: '4716,4',
        ip: 'Genel ortalama = ortalamaların ortalaması (gruplar eşit büyüklükte). SSB = Σ n(x̄<sub>j</sub> − x̿)².', cz: ['x̿ = ' + nf(gm, 4) + '.', 'SSB = ' + n + ' × [' + ms.map(function (m) { return '(' + m + ' − ' + nf(gm, 2) + ')²'; }).join(' + ') + '].', '= <b>' + nf(ssb, 2) + '</b>.'] });
      var c = r.int(3, 5), nn = c * r.int(4, 8), ssw = r.int(300, 2000), msw = ssw / (nn - c);
      out.push({ tag: 'MSW', q: '<p>' + c + ' grup ve toplam ' + nn + ' gözlemle yapılan bir ANOVA’da SSW = ' + ssw + '.</p><p>Grup içi kareler ortalaması MSW kaçtır? (iki ondalık)</p>', say: msw, goster: nf(msw, 2), tol: 0.011, ornek: '93,3',
        yanlis: function (v) { return Math.abs(v - ssw / (c - 1)) < 0.02 ? 'Grup içi sd = n − c olmalı.' : Math.abs(v - ssw / (nn - 1)) < 0.02 ? 'Bu toplam sd; grup içi sd = n − c.' : 'MSW = SSW/(n − c).'; },
        ip: 'MSW = SSW / (n − c).', cz: ['sd = ' + nn + ' − ' + c + ' = ' + (nn - c) + '.', 'MSW = ' + ssw + ' / ' + (nn - c) + ' = <b>' + nf(msw, 2) + '</b>.'] });
      var sb = r.int(200, 3000), sw = r.int(400, 2500), c3 = r.int(3, 5), n3 = c3 * r.int(4, 7), F = (sb / (c3 - 1)) / (sw / (n3 - c3));
      out.push({ tag: 'ANOVA tablosu', q: '<p>Bir ANOVA tablosunun bir kısmı yanda. F oranı kaçtır? (iki ondalık)</p>', g: V.tablo(['Kaynak', 'SS', 'sd'], [['Gruplar arası', String(sb), String(c3 - 1)], ['Grup içi', String(sw), String(n3 - c3)]], { n: [1, 2], st: 0 }), say: F, goster: nf(F, 2), tol: 0.011, ornek: '25,28',
        ip: 'Önce MS = SS/sd; sonra F = MSB/MSW.', cz: ['MSB = ' + sb + '/' + (c3 - 1) + ' = ' + nf(sb / (c3 - 1), 3) + '.', 'MSW = ' + sw + '/' + (n3 - c3) + ' = ' + nf(sw / (n3 - c3), 3) + '.', 'F = <b>' + nf(F, 2) + '</b>.'] });
      var c4 = r.int(3, 6), n4 = c4 * r.int(3, 8);
      out.push({ tag: 'serbestlik', q: '<p>' + c4 + ' farklı reklam kampanyasının etkisi toplam ' + n4 + ' mağazada (eşit dağıtılmış) karşılaştırılıyor.</p><p>F testinin serbestlik dereceleri nedir?</p>', o: ['(' + (c4 - 1) + ', ' + (n4 - c4) + ')', '(' + c4 + ', ' + n4 + ')', '(' + (n4 - 1) + ', ' + (c4 - 1) + ')', '(' + (c4 - 1) + ', ' + (n4 - 1) + ')'], a: 0, n: 'Pay: c − 1; payda: n − c.',
        ip: 'Gruplar arası sd = c − 1; grup içi sd = n − c.', cz: ['c − 1 = ' + (c4 - 1) + ', n − c = ' + (n4 - c4) + '.', 'Cevap: <b>(' + (c4 - 1) + ', ' + (n4 - c4) + ')</b>.'] });
      var d1 = r.int(2, 4), d2 = r.int(10, 30), Fc = M.fkr(0.05, d1, d2), Fo = Math.round(Fc * r.int(40, 250) / 100 * 100) / 100, rej = Fo > Fc;
      out.push({ tag: 'karar', q: '<p>Bir ANOVA’da F = <b>' + nf(Fo, 2) + '</b>, sd = (' + d1 + ', ' + d2 + '). Tablodan F<sub>0,05; ' + d1 + '; ' + d2 + '</sub> = <b>' + nf(Fc, 2) + '</b>.</p><p>α = 0,05’te karar ve yorum nedir?</p>', o: ['H₀ reddedilir: en az bir grup ortalaması farklı', 'H₀ reddedilmez: ortalamaların farklı olduğuna dair yeterli kanıt yok', 'H₀ reddedilir: tüm grup ortalamaları birbirinden farklı'], a: rej ? 0 : 1, n: nf(Fo, 2) + (rej ? ' > ' : ' ≤ ') + nf(Fc, 2) + '.', yn: { 2: 'ANOVA yalnızca “en az biri farklı” der; hangilerinin farklı olduğunu söylemez.' },
        ip: 'F > F kritik ise H₀ reddedilir. H₁ “en az biri farklı”dır.', cz: ['F = ' + nf(Fo, 2) + ', kritik ' + nf(Fc, 2) + '.', 'Karar: <b>' + (rej ? 'H₀ red; en az bir ortalama farklı' : 'H₀ reddedilmez') + '</b>.'] });
      return out;
    }
  });
})();
