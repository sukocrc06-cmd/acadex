/* ==========================================================================
   ACADEX İSTATİSTİK · Bahar 12–14. haftalar (labs/istat/ist-h8.js), 12.11.2026
   12 Parametrik olmayan testler II · 13 İndeks sayıları · 14 Karar teorisi
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;
  var STRES = [['A', 80, 60], ['B', 70, 55], ['C', 90, 78], ['D', 65, 70], ['E', 85, 60], ['F', 75, 65], ['G', 60, 50], ['H', 95, 85], ['I', 55, 58], ['J', 88, 70]];
  var GOLF = [[254, 263, 241, 237, 251], [234, 218, 235, 227, 216], [200, 222, 197, 206, 204]];

  /* ======================= BAHAR 12 ======================= */
  IST.hafta({
    id: 'b12', no: 12, renk: '#C8553D', tr: 'Parametrik olmayan testler II: sıra testleri', en: 'Non-Parametric Statistics II',
    sahneler: [
      {
        b: 'Değerler yerine sıralar', terim: [['sıra', 'rank'], ['eşit değerler', 'ties']],
        t: '<p>Sıra testleri gözlemlerin kendisi yerine <b>sıralarını</b> kullanır; böylece aykırı değerler ve normal olmayan dağılımlar sorun olmaz.</p><p>Küçükten büyüğe sırala, 1’den başlayarak sıra ver. <b>Eşit değerler</b> kapladıkları sıraların ortalamasını alır: 10, 10, 10 değerleri 3., 4. ve 5. sıradaysa her biri <b>4</b> alır.</p>',
        v: function () { var v = [3, 5, 10, 10, 10, 12, 15], rk = M.rank(v), s = ''; v.forEach(function (x, i) { s += '<g class="dp" ' + d(i * 0.15) + '><rect x="' + (20 + i * 72) + '" y="30" width="60" height="50" rx="10" fill="' + (x === 10 ? '#FFF1C2' : '#fff') + '" stroke="#0D1838" stroke-width="2"/><text x="' + (50 + i * 72) + '" y="62" text-anchor="middle" font-weight="800" font-size="18">' + x + '</text></g><text class="lbm fd" ' + d(1.2 + i * 0.1) + ' x="' + (50 + i * 72) + '" y="104" text-anchor="middle">sıra ' + nf(rk[i], 1) + '</text>'; }); s += '<text class="lbl fd" ' + d(2) + ' x="270" y="140" text-anchor="middle">üç tane 10: (3 + 4 + 5)/3 = 4</text>'; return V.svg(540, 156, s, 'sıralama'); }
      },
      {
        b: 'Wilcoxon sıra toplamı (Mann–Whitney) testi', terim: [['Wilcoxon sıra toplamı', 'Wilcoxon rank sum test'], ['Mann–Whitney U', 'Mann–Whitney U']],
        t: '<p>İki bağımsız örneklemi karşılaştırır (iki örneklem t testinin alternatifi). İki grup birleştirilip sıralanır; bir grubun sıra toplamı R₁ hesaplanır.</p><p class="mono">U₁ = R₁ − n₁(n₁ + 1)/2</p><p>Gruplar benzerse sıralar karışık dağılır; bir grup hep üstteyse R₁ uçta çıkar. Büyük örneklemde W ≈ normal: μ = n₁(n₁ + n₂ + 1)/2, σ = √(n₁n₂(n₁ + n₂ + 1)/12).</p>',
        v: function () { var A = [12, 15, 18, 21, 25], B = [17, 22, 26, 28, 31, 33], all = A.concat(B), rk = M.rank(all), s = '', srt = all.map(function (v, i) { return [v, i < 5, rk[i]]; }).sort(function (p, q) { return p[0] - q[0]; }); srt.forEach(function (p, i) { s += '<g class="pop" ' + d(i * 0.1) + '><circle cx="' + (30 + i * 48) + '" cy="60" r="18" fill="' + (p[1] ? PAL[0] : PAL[1]) + '" stroke="#0D1838"/><text x="' + (30 + i * 48) + '" y="65" text-anchor="middle" fill="#fff" font-weight="700" font-size="13">' + p[0] + '</text></g><text class="lbm" x="' + (30 + i * 48) + '" y="100" text-anchor="middle">' + p[2] + '</text>'; }); var R1 = M.sum(rk.slice(0, 5)); s += '<text class="lbb fd" ' + d(1.4) + ' x="20" y="140">mavi (A) sıra toplamı R₁ = ' + R1 + ' → U₁ = ' + R1 + ' − 15 = ' + (R1 - 15) + '</text><text class="lbl" x="20" y="20">mavi: A grubu · kırmızı: B grubu · alttaki sayılar sıra</text>'; return V.svg(540, 156, s, 'birleşik sıralama'); }
      },
      {
        b: 'Wilcoxon işaretli sıra testi: stres eğitimi', terim: [['Wilcoxon işaretli sıra testi', 'Wilcoxon signed rank test']],
        t: '<p>Bir firma 10 çalışanın stres puanını bir stres yönetimi kursundan önce ve sonra ölçüyor. Eşleştirilmiş veride: farkları al, <b>mutlak farkları</b> sırala, sıralara farkın işaretini ver.</p><p>T⁺ = pozitif sıraların toplamı = <b>3</b>, T⁻ = <b>52</b>. Küçük olan T = 3; n = 10, α = 0,05 (çift yönlü) için kritik değer <b>8</b>. 3 ≤ 8 → <b>H₀ reddedilir</b>: kurs stresi azaltmış.</p>',
        v: function () { var D = STRES.map(function (s) { return s[2] - s[1]; }), rk = M.rank(D.map(Math.abs)); return V.tablo(['Çalışan', 'Önce', 'Sonra', 'D', '|D| sırası', 'işaretli'], STRES.map(function (s, i) { return [s[0], String(s[1]), String(s[2]), (D[i] > 0 ? '+' : '') + D[i], nf(rk[i], 1), (D[i] > 0 ? '+' : '−') + nf(rk[i], 1)]; }), { n: [1, 2, 3, 4, 5], st: 0.1, rowc: { 3: 'hc', 8: 'hc' }, cap: 'mavi satırlar: pozitif farklar → T⁺ = 2 + 1 = 3' }); }
      },
      {
        b: 'Kruskal–Wallis testi', terim: [['Kruskal–Wallis H', 'Kruskal–Wallis test']],
        t: '<p>Üç ya da daha fazla bağımsız grubu sıralarla karşılaştırır (tek yönlü ANOVA’nın alternatifi).</p><p class="mono">H = 12/(N(N + 1)) · Σ R<sub>j</sub>²/n<sub>j</sub> − 3(N + 1), sd = k − 1</p><p>Golf sopası verisini sıralarsak: R₁ = 65, R₂ = 38, R₃ = 17. H = 12/240 · (65² + 38² + 17²)/5 − 48 = <b>11,58</b> &gt; χ²<sub>0,05; 2</sub> = 5,991 → <b>H₀ reddedilir</b>; ANOVA ile aynı sonuç.</p>',
        v: function () { var all = [].concat.apply([], GOLF), rk = M.rank(all), R = [0, 1, 2].map(function (g) { return M.sum(rk.slice(g * 5, g * 5 + 5)); }); return V.bars({ x: ['Sopa 1', 'Sopa 2', 'Sopa 3'], y: R, h: 220, max: 80, fmt: function (v) { return nf(v, 0); }, renk: [PAL[0], PAL[1], PAL[2]], ylab: 'sıra toplamı R' }) + V.fx([{ s: 'Kruskal–Wallis', h: 'H = 0,05 × 1191,6 − 48 = <b>11,58</b> > 5,991', son: true }], 1); }
      },
      {
        b: 'Spearman sıra korelasyonu', terim: [['Spearman sıra korelasyonu', 'Spearman’s rank correlation r_s']],
        t: '<p>İki değişkenin <b>sıraları</b> arasındaki korelasyon. Sıralı veride ya da doğrusal olmayan ama tek yönlü (monoton) ilişkilerde kullanılır.</p><p class="mono">r<sub>s</sub> = 1 − 6Σd² / (n(n² − 1))</p><p>İki jüri 6 yarışmacıyı sıralıyor; sıra farklarının kareleri toplamı Σd² = 4 ise r<sub>s</sub> = 1 − 24/210 = <b>0,886</b>: jüriler büyük ölçüde hemfikir.</p>',
        v: function () { var j1 = [1, 2, 3, 4, 5, 6], j2 = [2, 1, 4, 3, 5, 6]; return V.tablo(['Yarışmacı', 'Jüri 1', 'Jüri 2', 'd', 'd²'], j1.map(function (a, i) { return [String.fromCharCode(65 + i), String(a), String(j2[i]), String(a - j2[i]), String((a - j2[i]) * (a - j2[i]))]; }).concat([['<b>Σ</b>', '', '', '', '<b>4</b>']]), { n: [1, 2, 3, 4], st: 0.15 }) + V.fx([{ s: 'bu tabloda', h: 'r<sub>s</sub> = 1 − 6·4 / (6·35) = <b>0,886</b>', son: true }], 1.2); }
      }
    ],
    gorsel: {
      b: 'Sıra toplamı laboratuvarı', t: 'B grubunu sürgüyle kaydır. İki grup birleştirilip sıralanır; A’nın sıra toplamı, U ve normal yaklaşımla z ve p-değeri canlı hesaplanır.',
      kur: function (el) {
        var A = [12, 15, 18, 21, 25, 19, 23], B0 = [17, 22, 26, 28, 31, 33, 24, 29], sh = 0;
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>B grubunu kaydır <output data-so>0</output></span><input type="range" min="-20" max="15" value="0" data-s></label><div class="at-out" style="margin:0" data-o></div></div><div class="at-v"><div data-g></div><div class="at-not" data-n></div></div></div>';
        var draw = function () {
          var B = B0.map(function (v) { return v + sh; }), all = A.concat(B), rk = M.rank(all), n1 = A.length, n2 = B.length, R1 = M.sum(rk.slice(0, n1)), U = R1 - n1 * (n1 + 1) / 2, mu = n1 * (n1 + n2 + 1) / 2, sg = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12), z = (R1 - mu) / sg, p = 2 * (1 - M.Phi(Math.abs(z)));
          var srt = all.map(function (v, i) { return [v, i < n1, rk[i]]; }).sort(function (a, b) { return a[0] - b[0]; }), s = '';
          srt.forEach(function (q, i) { s += '<circle cx="' + (24 + i * 34) + '" cy="' + (q[1] ? 40 : 90) + '" r="14" fill="' + (q[1] ? PAL[0] : PAL[1]) + '" stroke="#0D1838"/><text x="' + (24 + i * 34) + '" y="' + (q[1] ? 45 : 95) + '" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">' + q[0] + '</text><text class="lbm" x="' + (24 + i * 34) + '" y="128" text-anchor="middle">' + nf(q[2], 1) + '</text>'; });
          s += '<text class="lbl" x="4" y="14">A (üst) ve B (alt) birleşik sıralama · alttaki sayılar sıra</text>';
          el.querySelector('[data-g]').innerHTML = V.svg(540, 140, s, 'birleşik sıralama');
          el.querySelector('[data-so]').textContent = (sh > 0 ? '+' : '') + sh;
          el.querySelector('[data-o]').innerHTML = '<div><small>R₁ (A)</small><b>' + nf(R1, 1) + '</b></div><div><small>U₁</small><b>' + nf(U, 1) + '</b></div><div><small>z</small><b>' + nf(z, 2) + '</b></div><div><small>p</small><b>' + nf(p, 4) + '</b></div>';
          el.querySelector('[data-n]').innerHTML = 'H₀ doğruysa R₁’in beklenen değeri ' + nf(mu, 1) + '. ' + (p < 0.05 ? 'R₁ bundan çok uzak → <b style="color:#C8553D">H₀ reddedilir</b>: gruplar farklı konumda.' : 'Sıralar karışık → <b style="color:#1F8A7A">H₀ reddedilmez</b>.') + ' Bir değeri çok büyütsen bile yalnızca sırası değişir: test aykırı değerlere dayanıklıdır.';
        };
        el.querySelector('[data-s]').oninput = function () { sh = +this.value; draw(); };
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var v = [], k = r.int(7, 9); for (var i = 0; i < k; i++) v.push(r.int(10, 25)); var tv = v[r.int(0, k - 1)]; v.push(tv); v = r.shuf(v); var rk = M.rank(v), tr = rk[v.indexOf(tv)];
      out.push({ vizOnly: true, viz: function (ka) { var s = M.sort(v), pos = []; s.forEach(function (x, i) { if (x === tv) pos.push(i + 1); }); return IST.S.siralar(v, pos, ka, { not: 'ortalama sıra = ' + nf(tr, 1), notk: 3 }); }, tag: 'sıralama', q: '<p>Şu değerler küçükten büyüğe sıralanacak (eşitlere ortalama sıra verilecek):</p><p class="mono" style="font-size:16px">' + v.join(', ') + '</p><p><b>' + tv + '</b> değerinin sırası kaçtır?</p>', say: tr, goster: nf(tr, 1), tol: 0.01, ornek: '4',
        ip: 'Sırala; ' + tv + ' değerinin kapladığı sıra numaralarının ortalamasını al.', cz: ['Sıralı: ' + M.sort(v).join(', ') + '.', tv + ' değerleri ' + M.sort(v).map(function (x, j) { return x === tv ? j + 1 : null; }).filter(function (x) { return x; }).join(', ') + '. sıralarda.', 'Ortalama sıra = <b>' + nf(tr, 1) + '</b>.'] });
      var n = r.int(6, 9), D = []; for (i = 0; i < n; i++) { var dd; do { dd = r.int(-12, 8); } while (dd === 0 || D.some(function (x) { return Math.abs(x) === Math.abs(dd); })); D.push(dd); }
      var rr = M.rank(D.map(Math.abs)), Tp = M.sum(D.map(function (x, j) { return x > 0 ? rr[j] : 0; })), Tm = M.sum(D.map(function (x, j) { return x < 0 ? rr[j] : 0; }));
      out.push({ tag: 'işaretli sıra', q: '<p>Bir diyet programında ' + n + ' kişinin kilo farkları (sonra − önce, kg):</p><p class="mono" style="font-size:16px">' + D.join(', ') + '</p><p>Wilcoxon işaretli sıra testi için <b>T⁻</b> (negatif farkların sıra toplamı) kaçtır?</p>', say: Tm, goster: nf(Tm, 1), tol: 0.01, ornek: '52',
        ip: 'Mutlak farkları sırala; negatif farklara ait sıraları topla.', cz: ['|D| sıraları: ' + D.map(function (x, j) { return '|' + x + '| → ' + rr[j]; }).join(', ') + '.', 'T⁺ = ' + Tp + ', T⁻ = <b>' + Tm + '</b> (kontrol: T⁺ + T⁻ = n(n+1)/2 = ' + n * (n + 1) / 2 + ').'] });
      var m = r.int(5, 8), r1 = [], r2 = r.shuf(Array.apply(null, Array(m)).map(function (_, j) { return j + 1; })); for (i = 1; i <= m; i++) r1.push(i); var sd2 = M.sum(r1.map(function (a, j) { return (a - r2[j]) * (a - r2[j]); })), rs = 1 - 6 * sd2 / (m * (m * m - 1));
      out.push({ tag: 'Spearman', q: '<p>İki uzman ' + m + ' girişim projesini sıralıyor:</p>', g: V.tablo(['Proje'].concat(r1.map(function (_, j) { return String.fromCharCode(65 + j); })), [['Uzman 1'].concat(r1.map(String)), ['Uzman 2'].concat(r2.map(String))], { st: 0 }), wide: true, say: rs, goster: nf(rs, 3), tol: 0.0011, ornek: '0,886',
        ip: 'd = sıra farkı; r<sub>s</sub> = 1 − 6Σd²/(n(n² − 1)).', cz: ['d²: ' + r1.map(function (a, j) { return Math.pow(a - r2[j], 2); }).join(' + ') + ' = ' + sd2 + '.', 'r<sub>s</sub> = 1 − 6·' + sd2 + ' / (' + m + '·' + (m * m - 1) + ') = <b>' + nf(rs, 3) + '</b>.'] });
      out[2].q += '<p>Spearman sıra korelasyonu r<sub>s</sub> kaçtır? (üç ondalık)</p>';
      var n1 = r.int(5, 9), n2 = r.int(5, 9), R1 = r.int(n1 * (n1 + 1) / 2 + 3, n1 * (n1 + 1) / 2 + n1 * n2 - 3), U = R1 - n1 * (n1 + 1) / 2;
      out.push({ tag: 'Mann–Whitney', q: '<p>İki bağımsız grup (n₁ = ' + n1 + ', n₂ = ' + n2 + ') birleştirilip sıralandı. Birinci grubun sıra toplamı <b>R₁ = ' + R1 + '</b>.</p><p>U₁ kaçtır?</p>', say: U, goster: String(U), tol: 0.01, ornek: '20',
        ip: 'U₁ = R₁ − n₁(n₁ + 1)/2.', cz: ['n₁(n₁ + 1)/2 = ' + n1 * (n1 + 1) / 2 + '.', 'U₁ = ' + R1 + ' − ' + n1 * (n1 + 1) / 2 + ' = <b>' + U + '</b>.'] });
      var nj = r.int(4, 6), N = 3 * nj, tot = N * (N + 1) / 2, Ra = r.int(Math.round(tot * 0.2), Math.round(tot * 0.45)), Rb = r.int(Math.round(tot * 0.2), Math.round(tot * 0.45)), Rc = tot - Ra - Rb, H = 12 / (N * (N + 1)) * (Ra * Ra + Rb * Rb + Rc * Rc) / nj - 3 * (N + 1);
      out.push({ tag: 'Kruskal–Wallis', q: '<p>Üç şubenin (her birinde ' + nj + ' gün) satışları sıralandı. Sıra toplamları: R₁ = ' + Ra + ', R₂ = ' + Rb + ', R₃ = ' + Rc + ' (N = ' + N + ').</p><p>Kruskal–Wallis H istatistiği kaçtır? (iki ondalık)</p>', say: H, goster: nf(H, 2), tol: 0.011, ornek: '11,58',
        ip: 'H = 12/(N(N + 1)) · Σ R<sub>j</sub>²/n<sub>j</sub> − 3(N + 1).', cz: ['Σ R²/n = (' + Ra + '² + ' + Rb + '² + ' + Rc + '²) / ' + nj + ' = ' + nf((Ra * Ra + Rb * Rb + Rc * Rc) / nj, 3) + '.', '12/(' + N + '·' + (N + 1) + ') = ' + nf(12 / (N * (N + 1)), 5) + '.', 'H = <b>' + nf(H, 2) + '</b> (sd = 2).'] });
      return out;
    }
  });

  /* ======================= BAHAR 13 ======================= */
  var SEP = [['Süt (L)', 18, 30, 24, 28, 40, 22], ['Ekmek (adet)', 5, 60, 8, 55, 12, 50], ['Peynir (kg)', 120, 4, 190, 3, 280, 3]]; /* ad, p13, q13, p16, q16, p17, q17 */
  var idx = function (p0, q0, pt, qt) { var L = M.sum(pt.map(function (p, i) { return p * q0[i]; })) / M.sum(p0.map(function (p, i) { return p * q0[i]; })) * 100, P = M.sum(pt.map(function (p, i) { return p * qt[i]; })) / M.sum(p0.map(function (p, i) { return p * qt[i]; })) * 100; return { L: L, P: P, F: Math.sqrt(L * P) }; };
  IST.hafta({
    id: 'b13', no: 13, renk: '#8A6D3B', tr: 'İndeks sayıları', en: 'Index Numbers',
    sahneler: [
      {
        b: 'Basit indeks: baz yıla göre değişim', terim: [['indeks sayısı', 'index number'], ['baz dönem', 'base period'], ['basit fiyat indeksi', 'simple price index']],
        t: '<p>İndeks sayısı bir değişkenin zaman içindeki değişimini bir <b>baz döneme</b> göre yüzde olarak gösterir.</p><p class="mono">I = p<sub>t</sub> / p<sub>0</sub> × 100</p><p>2013 baz yıl: süt 18 TL → 2016’da 24 TL → I₂₀₁₆ = 24/18 × 100 = <b>133,3</b> (fiyat %33,3 arttı); 2017’de 40 TL → <b>222,2</b>. Miktar indeksi de aynı mantıkla: q<sub>t</sub>/q<sub>0</sub> × 100.</p>',
        v: function () { return V.bars({ x: ['2013 (baz)', '2016', '2017'], y: [100, 24 / 18 * 100, 40 / 18 * 100], h: 240, max: 250, fmt: function (v) { return nf(v, 1); }, renk: [PAL[7], PAL[3], PAL[1]], ylab: 'süt fiyat indeksi' }); }
      },
      {
        b: 'Sabit bazlı ve zincirleme indeks', terim: [['sabit bazlı', 'fixed-base'], ['zincirleme', 'chain index']],
        t: '<p><b>Sabit bazlı</b> indekste her yıl aynı baz yılla karşılaştırılır. <b>Zincirleme</b> indekste her yıl <b>bir önceki</b> yılla karşılaştırılır:</p><p class="mono">Z<sub>t</sub> = p<sub>t</sub> / p<sub>t−1</sub> × 100</p><p>Süt: 2017/2016 = 40/24 × 100 = <b>166,7</b> (bir yılda %66,7 artış). Zincir halkalarını çarparak sabit baza dönülebilir: 1,333 × 1,667 = 2,222 ✓.</p>',
        v: function () { return V.fx([{ s: 'sabit baz (2013 = 100)', h: '2016: 133,3 · 2017: 222,2' }, { s: 'zincirleme', h: '2016/2013: 133,3 · 2017/2016: 166,7' }, { s: 'halkaları çarp', h: '1,333 × 1,667 = <b>2,222</b> → 222,2 ✓', son: true }], 0.2); }
      },
      {
        b: 'Ağırlıksız bileşik indeksler', terim: [['basit toplam indeks', 'simple aggregate index'], ['basit ortalama indeks', 'simple average of relatives']],
        t: '<p>Birden çok ürünü bir arada izlemek için:</p><ul><li><b>Basit toplam:</b> Σp<sub>t</sub> / Σp<sub>0</sub> × 100 = (24 + 8 + 190)/(18 + 5 + 120) × 100 = <b>155,2</b></li><li><b>Basit ortalama:</b> fiyat oranlarının ortalaması = (133,3 + 160 + 158,3)/3 = <b>150,6</b></li></ul><p>Sorun: pahalı ürün (peynir) toplamı domine eder ve miktarlar, yani ürünlerin önemi, hiç hesaba katılmaz.</p>',
        v: function () { return V.tablo(['Ürün', 'p₂₀₁₃', 'p₂₀₁₆', 'oran ×100'], SEP.map(function (s) { return [s[0], String(s[1]), String(s[3]), nf(s[3] / s[1] * 100, 1)]; }).concat([['<b>Σ</b>', '<b>143</b>', '<b>222</b>', '']]), { n: [1, 2, 3], st: 0.2 }) + V.fx([{ s: 'basit toplam', h: '222 / 143 × 100 = <b>155,2</b>' }, { s: 'basit ortalama', h: '(133,3 + 160 + 158,3) / 3 = <b>150,6</b>', son: true }], 0.9); }
      },
      {
        b: 'Laspeyres: baz dönem miktarlarıyla', terim: [['Laspeyres indeksi', 'Laspeyres index'], ['baz dönem ağırlıkları', 'base-period weights']],
        t: '<p class="mono">L = Σp<sub>t</sub>q<sub>0</sub> / Σp<sub>0</sub>q<sub>0</sub> × 100</p><p>“Baz yıldaki sepeti bugün almak kaç para?” Yalnızca baz yıl miktarlarını ister; yıllar arası karşılaştırma kolaydır. Ama tüketicilerin pahalılaşan üründen kaçmasını (ikame) yansıtmaz; enflasyonu <b>abartma</b> eğilimindedir.</p><p>2016 için L = ' + nf(idx(SEP.map(function (s) { return s[1]; }), SEP.map(function (s) { return s[2]; }), SEP.map(function (s) { return s[3]; }), SEP.map(function (s) { return s[4]; })).L, 1) + '.</p>',
        v: function () { var p0 = SEP.map(function (s) { return s[1]; }), q0 = SEP.map(function (s) { return s[2]; }), pt = SEP.map(function (s) { return s[3]; }); return V.tablo(['Ürün', 'q₀', 'p₀q₀', 'p₂₀₁₆q₀'], SEP.map(function (s) { return [s[0], String(s[2]), String(s[1] * s[2]), String(s[3] * s[2])]; }).concat([['<b>Σ</b>', '', '<b>' + M.sum(p0.map(function (p, i) { return p * q0[i]; })) + '</b>', '<b>' + M.sum(pt.map(function (p, i) { return p * q0[i]; })) + '</b>']]), { n: [1, 2, 3], st: 0.2 }) + V.fx([{ s: 'Laspeyres', h: 'L = ' + M.sum(pt.map(function (p, i) { return p * q0[i]; })) + ' / ' + M.sum(p0.map(function (p, i) { return p * q0[i]; })) + ' × 100 = <b>' + nf(M.sum(pt.map(function (p, i) { return p * q0[i]; })) / M.sum(p0.map(function (p, i) { return p * q0[i]; })) * 100, 1) + '</b>', son: true }], 0.9); }
      },
      {
        b: 'Paasche ve Fisher', terim: [['Paasche indeksi', 'Paasche index'], ['Fisher ideal indeksi', 'Fisher’s ideal index']],
        t: '<p class="mono">P = Σp<sub>t</sub>q<sub>t</sub> / Σp<sub>0</sub>q<sub>t</sub> × 100 &nbsp; F = √(L × P)</p><p>Paasche <b>cari dönem</b> miktarlarını kullanır; her dönem yeni miktar verisi ister (daha maliyetli). Fisher ikisinin geometrik ortalamasıdır. Tüketiciler fiyat değişimlerine sepetlerini değiştirerek tepki verdiğinde: <b>Paasche ≤ Fisher ≤ Laspeyres</b>.</p>',
        v: function () { var p0 = SEP.map(function (s) { return s[1]; }), q0 = SEP.map(function (s) { return s[2]; }), I = idx(p0, q0, SEP.map(function (s) { return s[3]; }), SEP.map(function (s) { return s[4]; })); return V.bars({ x: ['Paasche', 'Fisher', 'Laspeyres'], y: [I.P, I.F, I.L], h: 240, max: 200, fmt: function (v) { return nf(v, 1); }, renk: [PAL[2], PAL[4], PAL[1]], ylab: '2016 fiyat indeksi (2013 = 100)' }); }
      },
      {
        b: 'Reel değer: enflasyondan arındırma', terim: [['reel değer', 'real value'], ['fiyat endeksiyle arındırma', 'deflating']],
        t: '<p class="mono">reel değer = nominal değer / fiyat indeksi × 100</p><p>Bir çalışanın maaşı 2013’te 3.000 TL, 2017’de 6.000 TL. Fiyat indeksi 2017’de 222,2 (2013 = 100) ise reel maaş = 6.000 / 222,2 × 100 = <b>2.700 TL</b> (2013 fiyatlarıyla). Maaş ikiye katlanmış görünse de alım gücü <b>%10 düşmüş</b>.</p>',
        v: function () { return V.bars({ x: ['2013 nominal', '2017 nominal', '2017 reel'], y: [3000, 6000, 2700], h: 240, max: 7000, fmt: function (v) { return nf(v, 0); }, renk: [PAL[7], PAL[0], PAL[1]] }); }
      }
    ],
    gorsel: {
      b: 'Alışveriş sepeti indeks laboratuvarı', t: 'Üç ürünün cari fiyatlarını ve miktarlarını değiştir. Pahalılaşan üründen daha az alındığında (ikame) Laspeyres ile Paasche’nin nasıl ayrıştığını izle.',
      kur: function (el) {
        var p0 = SEP.map(function (s) { return s[1]; }), q0 = SEP.map(function (s) { return s[2]; }), pt = SEP.map(function (s) { return s[3]; }), qt = SEP.map(function (s) { return s[4]; });
        el.innerHTML = '<div class="at-g"><div class="at-k">' + SEP.map(function (s, i) { return '<b style="font-size:13px">' + s[0] + ' <small style="font-weight:400;color:var(--muted)">baz: ' + s[1] + ' TL × ' + s[2] + '</small></b><label><span>cari fiyat <output data-po' + i + '>' + pt[i] + '</output></span><input type="range" min="' + Math.round(s[1] * 0.5) + '" max="' + s[1] * 4 + '" value="' + pt[i] + '" data-p="' + i + '"></label><label><span>cari miktar <output data-qo' + i + '>' + qt[i] + '</output></span><input type="range" min="1" max="' + s[2] * 2 + '" value="' + qt[i] + '" data-q="' + i + '"></label>'; }).join('') + '</div><div class="at-v"><div data-g></div><div class="at-not" data-n></div></div></div>';
        var draw = function () {
          var I = idx(p0, q0, pt, qt), ba = M.sum(pt) / M.sum(p0) * 100;
          el.querySelector('[data-g]').innerHTML = V.bars({ x: ['basit toplam', 'Laspeyres', 'Paasche', 'Fisher'], y: [ba, I.L, I.P, I.F], h: 260, max: V.nice(Math.max(ba, I.L, I.P, I.F, 100) * 1.1), fmt: function (v) { return nf(v, 1); }, renk: ['#CFC6B3', PAL[1], PAL[2], PAL[4]], d: -2 }).replace('</svg>', '<text class="lbl" x="50" y="14">baz = 100</text></svg>');
          el.querySelector('[data-n]').innerHTML = 'L = ' + nf(I.L, 1) + ', P = ' + nf(I.P, 1) + ', F = ' + nf(I.F, 1) + '. ' + (I.P <= I.F + 1e-9 && I.F <= I.L + 1e-9 ? 'Paasche ≤ Fisher ≤ Laspeyres: tüketiciler pahalılaşan üründen kaçıyor (ikame etkisi).' : 'Bu sepette sıralama farklı: miktarlar ucuzlayan ürüne doğru değil, pahalılaşana doğru kaymış.');
          SEP.forEach(function (_, i) { el.querySelector('[data-po' + i + ']').textContent = pt[i]; el.querySelector('[data-qo' + i + ']').textContent = qt[i]; });
        };
        [].forEach.call(el.querySelectorAll('[data-p]'), function (s) { s.oninput = function () { pt[+s.getAttribute('data-p')] = +s.value; draw(); }; });
        [].forEach.call(el.querySelectorAll('[data-q]'), function (s) { s.oninput = function () { qt[+s.getAttribute('data-q')] = +s.value; draw(); }; });
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var p0 = r.int(10, 80), pt = Math.round(p0 * r.int(80, 260) / 100), I = pt / p0 * 100;
      out.push({ viz: function (ka) { return IST.S.cift(['2020 (baz)', '2025'], [p0, pt], 0, { fmt: function (v) { return nf(v, 0) + ' TL'; } }) + (ka >= 1 ? IST.S.cift(['2020', '2025'], [100, I], 0, { fmt: function (v) { return nf(v, 1); }, renk: [PAL[7], PAL[3]] }) : ''); }, tag: 'basit indeks', q: '<p>Bir ürünün fiyatı baz yıl 2020’de <b>' + p0 + ' TL</b>, 2025’te <b>' + pt + ' TL</b>.</p><p>2025 için basit fiyat indeksi kaçtır? (bir ondalık)</p>', say: I, goster: nf(I, 1), tol: 0.06, ornek: '133,3',
        ip: 'I = p<sub>t</sub>/p<sub>0</sub> × 100.', cz: [pt + ' / ' + p0 + ' × 100 = <b>' + nf(I, 1) + '</b>.', 'Fiyat %' + nf(I - 100, 1) + ' değişmiş.'] });
      var a = r.int(105, 140), b = r.int(105, 160), ch = a * b / 100;
      out.push({ viz: function (ka) { return IST.S.cift(['2023', '2024', '2025'], [100, a, ch], ka, { k: [0, 0, 2], fmt: function (v) { return nf(v, 1); }, renk: [PAL[7], PAL[3], PAL[1]] }); }, tag: 'zincirleme', q: '<p>Bir ürünün zincirleme fiyat indeksleri: 2024/2023 = <b>' + a + '</b>, 2025/2024 = <b>' + b + '</b>.</p><p>2023 = 100 bazlı 2025 indeksi kaçtır? (bir ondalık)</p>', say: ch, goster: nf(ch, 1), tol: 0.06, ornek: '222,2',
        yanlis: function (v) { return Math.abs(v - (a + b - 100)) < 0.1 ? 'Yüzde değişimler toplanmaz, çarpılır.' : 'Halkaları çarp: (a/100)(b/100)×100.'; },
        ip: 'Halkaları çarp: (' + a + '/100) × (' + b + '/100) × 100.', cz: [nf(a / 100, 2) + ' × ' + nf(b / 100, 2) + ' = ' + nf(ch / 100, 4) + '.', 'İndeks = <b>' + nf(ch, 1) + '</b>.'] });
      var P0 = [r.int(5, 20), r.int(20, 60), r.int(60, 150)], Q0 = [r.int(20, 60), r.int(5, 20), r.int(1, 6)], Pt = P0.map(function (p) { return Math.round(p * r.int(100, 200) / 100); }), Qt = Q0.map(function (q) { return Math.max(1, Math.round(q * r.int(70, 130) / 100)); }), II = idx(P0, Q0, Pt, Qt), ad = ['Çay (kg)', 'Kahve (kg)', 'Bal (kavanoz)'];
      var tb = V.tablo(['Ürün', 'p₀', 'q₀', 'p<sub>t</sub>', 'q<sub>t</sub>'], ad.map(function (n, i) { return [n, String(P0[i]), String(Q0[i]), String(Pt[i]), String(Qt[i])]; }), { n: [1, 2, 3, 4], st: 0 });
      out.push({ tag: 'Laspeyres', q: '<p>Bir kafenin üç ürününün baz ve cari dönem fiyat ve miktarları yanda.</p><p><b>Laspeyres</b> fiyat indeksi kaçtır? (bir ondalık)</p>', g: tb, wide: true, say: II.L, goster: nf(II.L, 1), tol: 0.06, ornek: '155,2',
        yanlis: function (v) { return Math.abs(v - II.P) < 0.1 ? 'Bu Paasche (cari miktarlar); Laspeyres baz dönem miktarlarını kullanır.' : 'L = Σp<sub>t</sub>q<sub>0</sub>/Σp<sub>0</sub>q<sub>0</sub> × 100.'; },
        ip: 'L = Σp<sub>t</sub>q<sub>0</sub> / Σp<sub>0</sub>q<sub>0</sub> × 100 (baz miktarlar).', cz: ['Σp<sub>t</sub>q<sub>0</sub> = ' + Pt.map(function (p, i) { return p + '·' + Q0[i]; }).join(' + ') + ' = ' + M.sum(Pt.map(function (p, i) { return p * Q0[i]; })) + '.', 'Σp<sub>0</sub>q<sub>0</sub> = ' + M.sum(P0.map(function (p, i) { return p * Q0[i]; })) + '.', 'L = <b>' + nf(II.L, 1) + '</b>.'] });
      out.push({ tag: 'Paasche', q: '<p>Aynı tablo için <b>Paasche</b> fiyat indeksi kaçtır? (bir ondalık)</p>', g: tb, wide: true, say: II.P, goster: nf(II.P, 1), tol: 0.06, ornek: '150,6',
        ip: 'P = Σp<sub>t</sub>q<sub>t</sub> / Σp<sub>0</sub>q<sub>t</sub> × 100 (cari miktarlar).', cz: ['Σp<sub>t</sub>q<sub>t</sub> = ' + M.sum(Pt.map(function (p, i) { return p * Qt[i]; })) + '.', 'Σp<sub>0</sub>q<sub>t</sub> = ' + M.sum(P0.map(function (p, i) { return p * Qt[i]; })) + '.', 'P = <b>' + nf(II.P, 1) + '</b>; Fisher = √(L·P) = ' + nf(II.F, 1) + '.'] });
      var w0 = r.int(20, 60) * 1000, wt = Math.round(w0 * r.int(130, 300) / 100 / 100) * 100, cpi = r.int(140, 320), real = wt / cpi * 100;
      out.push({ viz: function (ka) { return IST.S.cift(['baz yıl', 'bugün · nominal', 'bugün · reel'], [w0, wt, real], ka, { k: [0, 0, 1], fmt: function (v) { return nf(v, 0); }, renk: [PAL[7], PAL[0], PAL[1]] }); }, tag: 'reel değer', q: '<p>Bir çalışanın aylık maaşı baz yılda ' + nf(w0, 0) + ' TL idi; bugün <b>' + nf(wt, 0) + ' TL</b>. Aynı dönemde fiyat indeksi 100’den <b>' + cpi + '</b>’e çıktı.</p><p>Bugünkü maaşın baz yıl fiyatlarıyla reel değeri kaç TL’dir? (tam sayı)</p>', say: real, goster: nf(real, 0) + ' TL', tol: 0.6, ornek: '2.700',
        ip: 'Reel = nominal / indeks × 100.', cz: [nf(wt, 0) + ' / ' + cpi + ' × 100 = <b>' + nf(real, 0) + ' TL</b>.', 'Baz yıla göre alım gücü ' + (real >= w0 ? 'arttı' : 'azaldı') + ' (%' + nf((real / w0 - 1) * 100, 1) + ').'] });
      return out;
    }
  });

  /* ======================= BAHAR 14 ======================= */
  var GT = { al: ['Firma 1', 'Firma 2', 'Firma 3'], dr: ['Uzun sipariş süreci', 'Kısa sipariş süreci'], v: [[14500, 17500], [12540, 19000], [11000, 18000]] };
  var KR = function (v, p, a) {
    var rmax = v.map(function (r) { return Math.max.apply(null, r); }), rmin = v.map(function (r) { return Math.min.apply(null, r); }), cmax = v[0].map(function (_, j) { return Math.max.apply(null, v.map(function (r) { return r[j]; })); });
    var reg = v.map(function (r) { return r.map(function (x, j) { return cmax[j] - x; }); }), rg = reg.map(function (r) { return Math.max.apply(null, r); });
    var hur = v.map(function (r, i) { return a * rmax[i] + (1 - a) * rmin[i]; }), lap = v.map(function (r) { return M.mean(r); }), emv = v.map(function (r) { return M.sum(r.map(function (x, j) { return x * p[j]; })); });
    var arg = function (L, mn) { var b = 0; L.forEach(function (x, i) { if (mn ? x < L[b] : x > L[b]) b = i; }); return b; };
    var evpi = M.sum(cmax.map(function (c, j) { return c * p[j]; })) - Math.max.apply(null, emv);
    return { rmax: rmax, rmin: rmin, reg: reg, rg: rg, hur: hur, lap: lap, emv: emv, evpi: evpi, mx: arg(rmax), mn: arg(rmin), mr: arg(rg, true), hw: arg(hur), lp: arg(lap), em: arg(emv) };
  };
  IST.hafta({
    id: 'b14', no: 14, renk: '#1F8A7A', tr: 'Karar teorisi', en: 'Decision Theory',
    sahneler: [
      {
        b: 'Karar problemi ve getiri matrisi', terim: [['karar seçeneği', 'decision alternative'], ['doğa durumu', 'state of nature'], ['getiri matrisi', 'payoff matrix']],
        t: '<p>“Bugün işe nasıl gideyim?” bir karar problemidir. Karar verici <b>seçenekler</b> arasından seçer; sonuç kontrol edemediği <b>doğa durumlarına</b> bağlıdır. Her seçenek–durum çiftinin sonucu <b>getiri matrisine</b> yazılır (kâr ya da maliyet).</p><p>Bir şirket üç tedarikçi firmadan biriyle çalışacak; kârı siparişlerin uzun ya da kısa süreceğine bağlı (TL).</p>',
        v: function () { return V.tablo(['Seçenek', GT.dr[0], GT.dr[1]], GT.al.map(function (a, i) { return [a, nf(GT.v[i][0], 0), nf(GT.v[i][1], 0)]; }), { n: [1, 2], st: 0.3 }) + V.kart([{ ic: '✅', b: 'Kesinlik', en: 'certainty', p: 'Durum biliniyor' }, { ic: '❓', b: 'Belirsizlik', en: 'uncertainty', p: 'Olasılıklar bilinmiyor' }, { ic: '🎲', b: 'Risk', en: 'risk', p: 'Olasılıklar biliniyor' }], 1); }
      },
      {
        b: 'İyimser ve kötümser yaklaşım', terim: [['maximax', 'maximax (optimistic)'], ['maximin', 'maximin (pessimistic, Wald)']],
        t: '<ul><li><b>Maximax</b> (iyimser): her seçeneğin <b>en iyi</b> sonucunu al, bunların en büyüğünü seç → Firma 2 (19.000).</li><li><b>Maximin</b> (kötümser, Wald): her seçeneğin <b>en kötü</b> sonucunu al, bunların en büyüğünü seç → Firma 1 (14.500).</li></ul><p>Maliyet tablosunda mantık tersine döner: minimin ve minimax.</p>',
        v: function () { var k = KR(GT.v, [0.5, 0.5], 0.5); return V.tablo(['Seçenek', 'uzun', 'kısa', 'satır en iyi', 'satır en kötü'], GT.al.map(function (a, i) { return [a, nf(GT.v[i][0], 0), nf(GT.v[i][1], 0), nf(k.rmax[i], 0), nf(k.rmin[i], 0)]; }), { n: [1, 2, 3, 4], st: 0.3, hi: { '1,3': 'ht', '0,4': 'ht' }, cap: 'yeşil: maximax (Firma 2) ve maximin (Firma 1) seçimleri' }); }
      },
      {
        b: 'Minimax pişmanlık (Savage)', terim: [['pişmanlık', 'regret / opportunity loss'], ['minimax pişmanlık', 'minimax regret']],
        t: '<p>Doğru seçimi yapmasaydık ne kadar kaybederdik? Her sütunda en iyi değerden her hücreyi çıkar: <b>pişmanlık matrisi</b>. Sonra her seçeneğin en büyük pişmanlığını al ve <b>en küçüğünü</b> seç.</p><p>Firma 1: en büyük pişmanlık 1.500 · Firma 2: 1.960 · Firma 3: 3.500 → <b>Firma 1</b>.</p>',
        v: function () { var k = KR(GT.v, [0.5, 0.5], 0.5); return V.tablo(['Seçenek', 'pişmanlık · uzun', 'pişmanlık · kısa', 'en büyük'], GT.al.map(function (a, i) { return [a, nf(k.reg[i][0], 0), nf(k.reg[i][1], 0), nf(k.rg[i], 0)]; }), { n: [1, 2, 3], st: 0.3, hi: { '0,3': 'ht' } }); }
      },
      {
        b: 'Hurwicz ve Laplace', terim: [['Hurwicz kriteri', 'Hurwicz criterion'], ['iyimserlik katsayısı', 'coefficient of optimism α'], ['Laplace', 'Laplace (equal likelihood)']],
        t: '<p>Hurwicz (1951) iyimserlik ile kötümserliği dengeler: <b>H = α · en iyi + (1 − α) · en kötü</b>. α = 0,6 için: Firma 1 16.300, Firma 2 <b>16.416</b>, Firma 3 15.200 → Firma 2. α = 1 maximax, α = 0 maximin olur.</p><p><b>Laplace:</b> durumlar eşit olasılıklı kabul edilir; satır ortalamaları: 16.000, 15.770, 14.500 → <b>Firma 1</b>.</p>',
        v: function () { var xs = [], y1 = [], y2 = [], y3 = []; for (var a = 0; a <= 1.0001; a += 0.1) { var k = KR(GT.v, [0.5, 0.5], a); xs.push(a); y1.push(k.hur[0]); y2.push(k.hur[1]); y3.push(k.hur[2]); } return V.xy({ x: xs, y: y1, line: true, h: 260, ymin: 10000, ymax: 20000, xt: [[0, '0 (maximin)'], [0.5, '0,5'], [1, '1 (maximax)']], xlab: 'iyimserlik katsayısı α', renk: PAL[0] }).replace('</svg>', [y2, y3].map(function (Y, j) { return '<polyline class="dr" style="--len:900;--d:' + (0.5 + j * 0.4) + 's" points="' + xs.map(function (x, i) { return (54 + x * 444).toFixed(1) + ',' + (226 - (Y[i] - 10000) / 10000 * 208).toFixed(1); }).join(' ') + '" fill="none" stroke="' + PAL[j + 1] + '" stroke-width="3"/>'; }).join('') + '<text class="lbl" x="60" y="20">mavi: Firma 1 · kırmızı: Firma 2 · yeşil: Firma 3</text></svg>'); }
      },
      {
        b: 'Risk altında: beklenen parasal değer', terim: [['beklenen parasal değer', 'expected monetary value EMV'], ['tam bilginin beklenen değeri', 'EVPI']],
        t: '<p>Durumların olasılıkları biliniyorsa: <b>EMV = Σ getiri × olasılık</b>. P(uzun) = 0,4, P(kısa) = 0,6:</p><ul><li>Firma 1: 0,4·14.500 + 0,6·17.500 = 16.300</li><li>Firma 2: 0,4·12.540 + 0,6·19.000 = <b>16.416</b> → seç</li><li>Firma 3: 15.200</li></ul><p><b>EVPI</b> = tam bilgiyle beklenen değer − en iyi EMV = (0,4·14.500 + 0,6·19.000) − 16.416 = <b>784 TL</b>: geleceği kesin bilmek için ödenebilecek en yüksek tutar.</p>',
        v: function () { var k = KR(GT.v, [0.4, 0.6], 0.5); return V.bars({ x: GT.al, y: k.emv, h: 220, max: 20000, fmt: function (v) { return nf(v, 0); }, hi: [k.em], renk: [PAL[0], PAL[1], PAL[2]], ylab: 'EMV (TL)' }) + V.fx([{ s: 'tam bilgiyle', h: '0,4 × 14.500 + 0,6 × 19.000 = 17.200' }, { s: 'EVPI', h: '17.200 − 16.416 = <b>784 TL</b>', son: true }], 1.1); }
      },
      {
        b: 'Karar ağacı', terim: [['karar ağacı', 'decision tree'], ['karar düğümü', 'decision node ■'], ['şans düğümü', 'chance node ●']],
        t: '<p>Kararlar ve belirsizlikler zamana göre bir ağaçta gösterilir: <b>kare</b> karar düğümü, <b>daire</b> şans düğümü, dalların ucundaki dikey çizgi <b>son düğüm</b> (getiri).</p><p>Ağaç sağdan sola çözülür: her şans düğümünde EMV hesaplanır, her karar düğümünde en iyi dal seçilir, diğerleri “budanır” (//).</p>',
        v: function () {
          var k = KR(GT.v, [0.4, 0.6], 0.5), s = '<rect class="pop" x="14" y="128" width="24" height="24" fill="#0D1838"/>';
          GT.al.forEach(function (a, i) { var y = 50 + i * 90; s += '<path class="dr" style="--len:300;--d:' + (0.2 + i * 0.2) + 's" d="M38 140L170 ' + y + '" stroke="#0D1838" stroke-width="2"/><text class="lbb fd" ' + d(0.4 + i * 0.2) + ' x="182" y="' + (y + 30) + '" text-anchor="middle">' + a + '</text><circle class="pop" ' + d(0.6 + i * 0.2) + ' cx="182" cy="' + y + '" r="12" fill="' + (i === k.em ? PAL[2] : '#CFC6B3') + '" stroke="#0D1838" stroke-width="2"/><text class="lbm fd" ' + d(1.6 + i * 0.1) + ' x="182" y="' + (y - 18) + '" text-anchor="middle" font-weight="700">' + nf(k.emv[i], 0) + '</text>'; if (i !== k.em) s += '<text class="lbb fd" ' + d(2) + ' x="104" y="' + ((140 + y) / 2 + 4) + '" style="fill:#C8553D">//</text>'; [0, 1].forEach(function (j) { var y2 = y - 22 + j * 44; s += '<path class="dr" style="--len:300;--d:' + (0.9 + i * 0.2) + 's" d="M194 ' + y + 'L360 ' + y2 + '" stroke="#6A7593" stroke-width="1.5"/><text class="lbm fd" ' + d(1 + i * 0.2) + ' x="270" y="' + ((y + y2) / 2 - 4) + '" text-anchor="middle">' + (j ? '0,6' : '0,4') + '</text><line x1="364" x2="364" y1="' + (y2 - 8) + '" y2="' + (y2 + 8) + '" stroke="#0D1838" stroke-width="2.5"/><text class="lbm fd" ' + d(1.1 + i * 0.2) + ' x="372" y="' + (y2 + 4) + '">' + nf(GT.v[i][j], 0) + '</text>'; }); });
          return V.svg(540, 280, s, 'karar ağacı');
        }
      }
    ],
    gorsel: {
      b: 'Karar masası', t: 'Getiri matrisini, durum olasılığını ve iyimserlik katsayısını değiştir. Her kriterin seçtiği firma işaretlenir; kriterlerin bazen farklı seçenekleri önerdiğini gör.',
      kur: function (el) {
        var v = GT.v.map(function (r) { return r.slice(); }), p = 0.4, a = 0.6;
        el.innerHTML = '<div class="at-g"><div class="at-k"><b style="font-size:13px">getiriler (TL)</b>' + GT.al.map(function (f, i) { return '<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:6px;align-items:center;font-size:13px"><span>' + f + '</span>' + [0, 1].map(function (j) { return '<input type="number" step="100" value="' + v[i][j] + '" data-v="' + i + ',' + j + '" style="width:100%;min-height:34px;border:1.5px solid #0D1838;border-radius:8px;padding:4px 6px;font:600 13px JetBrains Mono,monospace">'; }).join('') + '</div>'; }).join('') + '<label><span>P(uzun süreç) <output data-po>0,4</output></span><input type="range" min="0" max="1" step="0.05" value="0.4" data-p></label><label><span>Hurwicz α <output data-ao>0,6</output></span><input type="range" min="0" max="1" step="0.05" value="0.6" data-a></label></div><div class="at-v"><div data-t></div><div class="at-not" data-n></div></div></div>';
        var draw = function () {
          var k = KR(v, [p, 1 - p], a), rows = [['Maximax (iyimser)', k.rmax, k.mx], ['Maximin (kötümser)', k.rmin, k.mn], ['Minimax pişmanlık', k.rg, k.mr], ['Hurwicz (α = ' + nf(a, 2) + ')', k.hur, k.hw], ['Laplace', k.lap, k.lp], ['EMV (risk)', k.emv, k.em]];
          var hi = {}; rows.forEach(function (rw, i) { hi[i + ',' + (rw[2] + 1)] = 'ht'; });
          el.querySelector('[data-t]').innerHTML = V.tablo(['Kriter'].concat(GT.al), rows.map(function (rw) { return [rw[0]].concat(rw[1].map(function (x) { return nf(x, 0); })); }), { n: [1, 2, 3], st: 0, hi: hi, cap: 'yeşil: kriterin seçtiği firma (pişmanlıkta en küçük, diğerlerinde en büyük)' });
          var cnt = [0, 0, 0]; rows.forEach(function (rw) { cnt[rw[2]]++; });
          el.querySelector('[data-n]').innerHTML = 'Altı kriterden ' + cnt.map(function (c, i) { return GT.al[i] + ' ' + c; }).join(', ') + ' kez seçildi. EVPI = <b>' + nf(k.evpi, 0) + ' TL</b>: siparişin süresini kesin bilmek en fazla bu kadar değerli.';
          el.querySelector('[data-po]').textContent = nf(p, 2); el.querySelector('[data-ao]').textContent = nf(a, 2);
        };
        [].forEach.call(el.querySelectorAll('[data-v]'), function (inp) { inp.oninput = function () { var ij = inp.getAttribute('data-v').split(','), x = parseFloat(inp.value); if (isFinite(x)) { v[+ij[0]][+ij[1]] = x; draw(); } }; });
        el.querySelector('[data-p]').oninput = function () { p = +this.value; draw(); };
        el.querySelector('[data-a]').oninput = function () { a = +this.value; draw(); };
        draw();
      }
    },
    sorular: function (r) {
      var out = [], v, k, al = ['Mağaza A', 'Mağaza B', 'Mağaza C'], dr = ['Talep düşük', 'Talep orta', 'Talep yüksek'];
      do { v = al.map(function () { return dr.map(function () { return r.int(-20, 90) * 1000; }); }); k = KR(v, [0.3, 0.5, 0.2], 0.5); } while (new Set(k.rmax).size < 3 || new Set(k.rmin).size < 3 || new Set(k.rg).size < 3 || new Set(k.emv.map(function (x) { return Math.round(x); })).size < 3);
      var pr = [r.pick([0.2, 0.3, 0.4]), 0, 0]; pr[1] = r.pick([0.3, 0.4, 0.5]); pr[2] = Math.round((1 - pr[0] - pr[1]) * 100) / 100; k = KR(v, pr, 0.5);
      var tb = V.tablo(['Seçenek'].concat(dr), al.map(function (a, i) { return [a].concat(v[i].map(function (x) { return nf(x, 0); })); }), { n: [1, 2, 3], st: 0 });
      out.push({ tag: 'maximax', q: '<p>Bir girişimci üç mağaza yerinden birini seçecek; yıllık kâr (TL) talebe bağlı.</p><p><b>Maximax</b> (iyimser) kritere göre hangi seçenek seçilir?</p>', g: tb, o: al, a: k.mx, n: 'Satır en iyileri: ' + k.rmax.map(function (x) { return nf(x, 0); }).join(', ') + '.', ip: 'Her satırın en büyük değerini bul, sonra bunların en büyüğünü seç.', cz: ['Satır en iyileri: ' + k.rmax.map(function (x) { return nf(x, 0); }).join(' · ') + '.', 'En büyüğü: <b>' + al[k.mx] + '</b>.'] });
      out.push({ tag: 'maximin', q: '<p>Aynı tablo için <b>maximin</b> (kötümser, Wald) kritere göre hangi seçenek seçilir?</p>', g: tb, o: al, a: k.mn, n: 'Satır en kötüleri: ' + k.rmin.map(function (x) { return nf(x, 0); }).join(', ') + '.', ip: 'Her satırın en küçük değerini bul, sonra bunların en büyüğünü seç.', cz: ['Satır en kötüleri: ' + k.rmin.map(function (x) { return nf(x, 0); }).join(' · ') + '.', 'En büyüğü: <b>' + al[k.mn] + '</b>.'] });
      out.push({ tag: 'pişmanlık', q: '<p>Aynı tablo için <b>minimax pişmanlık</b> kriterinde seçilen seçeneğin en büyük pişmanlığı kaç TL’dir?</p>', g: tb, say: k.rg[k.mr], goster: nf(k.rg[k.mr], 0) + ' TL (' + al[k.mr] + ')', tol: 0.6, ornek: '1.500',
        ip: 'Her sütunda en büyük değerden hücreleri çıkar; her satırın en büyük pişmanlığını al; en küçüğünü seç.', cz: ['Sütun en iyileri: ' + [0, 1, 2].map(function (j) { return nf(Math.max(v[0][j], v[1][j], v[2][j]), 0); }).join(' · ') + '.', 'Satırların en büyük pişmanlıkları: ' + k.rg.map(function (x) { return nf(x, 0); }).join(' · ') + '.', 'En küçüğü: <b>' + nf(k.rg[k.mr], 0) + ' TL</b> → ' + al[k.mr] + '.'] });
      var aa = r.pick([0.3, 0.4, 0.6, 0.7, 0.8]), hi = r.int(0, 2), hv = aa * k.rmax[hi] + (1 - aa) * k.rmin[hi];
      out.push({ tag: 'Hurwicz', q: '<p>Aynı tablo için iyimserlik katsayısı <b>α = ' + nf(aa, 1) + '</b>. <b>' + al[hi] + '</b> seçeneğinin Hurwicz değeri kaç TL’dir?</p>', g: tb, say: hv, goster: nf(hv, 0) + ' TL', tol: 0.6, ornek: '16.300',
        ip: 'H = α · satır en iyi + (1 − α) · satır en kötü.', cz: ['En iyi ' + nf(k.rmax[hi], 0) + ', en kötü ' + nf(k.rmin[hi], 0) + '.', 'H = ' + nf(aa, 1) + ' × ' + nf(k.rmax[hi], 0) + ' + ' + nf(1 - aa, 1) + ' × ' + nf(k.rmin[hi], 0) + ' = <b>' + nf(hv, 0) + ' TL</b>.'] });
      var ask = r.int(0, 1);
      out.push({ tag: ask ? 'EVPI' : 'EMV', q: '<p>Talep olasılıkları: düşük ' + nf(pr[0], 1) + ', orta ' + nf(pr[1], 1) + ', yüksek ' + nf(pr[2], 1) + '.</p><p>' + (ask ? '<b>Tam bilginin beklenen değeri (EVPI)</b> kaç TL’dir?' : 'En yüksek <b>beklenen parasal değer (EMV)</b> kaç TL’dir?') + '</p>', g: tb, say: ask ? k.evpi : k.emv[k.em], goster: nf(ask ? k.evpi : k.emv[k.em], 0) + ' TL', tol: 0.6, ornek: '16.416',
        ip: ask ? 'EVPI = Σ(sütun en iyisi × olasılık) − en yüksek EMV.' : 'EMV = Σ getiri × olasılık; her satır için hesapla, en büyüğünü al.', cz: ['EMV’ler: ' + k.emv.map(function (x, i) { return al[i] + ' ' + nf(x, 0); }).join(' · ') + '.', ask ? 'Tam bilgiyle: ' + [0, 1, 2].map(function (j) { return nf(Math.max(v[0][j], v[1][j], v[2][j]), 0) + '×' + nf(pr[j], 1); }).join(' + ') + ' = ' + nf(k.evpi + k.emv[k.em], 0) + '; EVPI = <b>' + nf(k.evpi, 0) + ' TL</b>.' : 'En yüksek EMV: <b>' + nf(k.emv[k.em], 0) + ' TL</b> (' + al[k.em] + ').'] });
      return out;
    }
  });
})();
