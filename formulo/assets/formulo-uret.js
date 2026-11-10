/* ==========================================================================
   FORMULO · sembolik soru üreticileri (formulo/assets/formulo-uret.js), 08.11.2026
   Her ders için parametreli üreticiler: limit, türev, integral, seri, vektör, matris,
   diferansiyel denklem, olasılık, sayısal yöntem. Her üretici rastgele katsayılarla
   yeni soru, şıklar ya da sayısal cevap, iki ipucu ve adım adım çözüm döndürür.
   "oran" üreticisi her hesaplanabilir formül için "x iki katına çıkarsa?" sorar.
   n: üreticinin farklı soru sayısı (sayaç için). Önek yok (yalnız veri).
   ========================================================================== */
(function (W) {
  'use strict';
  var FO = W.FORMULO, H = FO.h, F = H.F, R = H.R, S = H.S, B = H.B, OP = H.OP;
  var x = '<i>x</i>', y = '<i>y</i>', t = '<i>t</i>', s = '<i>s</i>', e = '<i>e</i>';
  function dil() { return (W.FORMULO_APP && W.FORMULO_APP.dil()) || 'tr'; }
  function L(tr, en) { return dil() === 'en' ? en : tr; }
  function sayi(n) { return W.FORMULO_APP ? W.FORMULO_APP.sayi(n) : String(+(+n).toPrecision(4)); }
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function rnz(a, b) { var v = 0; while (!v) v = ri(a, b); return v; }
  function rast(a) { return a[Math.floor(Math.random() * a.length)]; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var tt = b; b = a % b; a = tt; } return a || 1; }
  function kesir(p, q) { if (q < 0) { p = -p; q = -q; } var g = gcd(p, q); p /= g; q /= g; if (q === 1) return String(p).replace('-', '−'); return (p < 0 ? '−' : '') + F(Math.abs(p), q); }
  /* polinom: [[katsayı, üs], ...] → HTML */
  function pol(ts, v) {
    v = v || x; var out = '';
    ts.filter(function (q) { return q[0] !== 0; }).forEach(function (q, i) {
      var c = q[0], p = q[1], a = Math.abs(c), sg = c < 0 ? '−' : '+';
      var gov = p === 0 ? String(a) : (a === 1 ? '' : a) + v + (p > 1 ? S(p) : '');
      out += i === 0 ? (c < 0 ? '−' : '') + gov : ' ' + sg + ' ' + gov;
    });
    return out || '0';
  }
  function isaretli(n) { return n < 0 ? '− ' + Math.abs(n) : '+ ' + n; }
  function karistir(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), tt = a[i]; a[i] = a[j]; a[j] = tt; } return a; }
  /* şıklar: ilki doğru; tekrarları ayıklar, karıştırır */
  function sik(dogru, yanlis) {
    var hepsi = [dogru], gor = {}; gor[dogru] = 1;
    yanlis.forEach(function (y1) { if (!gor[y1] && hepsi.length < 4) { gor[y1] = 1; hepsi.push(y1); } });
    var k = karistir(hepsi.slice()); return { mc: k, dogruI: k.indexOf(dogru) };
  }
  function adim(b, h) { return { b: b, h: h }; }
  function fx(h) { return '<span class="fo-f fq-f">' + h + '</span>'; }
  var deg = Math.PI / 180;

  var G = [
    /* ================= CALCULUS I ================= */
    { id: 'lim-carpan', d: 'calc1', k: 'limit', f: 'sureklilik', sev: 'kolay', n: 19 * 19,
      u: function () { var a = rnz(-9, 9), b = rnz(-9, 9); if (a === -b) b++; var p = [[1, 2], [b - a, 1], [-a * b, 0]];
        return { metin: L('Limiti hesapla:', 'Evaluate the limit:') + fx(OP('lim', x + '→' + a) + F(pol(p), x + ' ' + isaretli(-a))), dogru: a + b, birim: '', s: 'L',
          ip: [L('Pay, (x − a) çarpanını içeriyor; çarpanlara ayır.', 'The numerator has the factor (x − a); factor it.'), fx(F('(' + x + ' ' + isaretli(-a) + ')(' + x + ' ' + isaretli(b) + ')', x + ' ' + isaretli(-a)))],
          cozum: [adim(L('Çarpanlara ayır', 'Factor'), fx(pol(p) + ' = (' + x + ' ' + isaretli(-a) + ')(' + x + ' ' + isaretli(b) + ')')), adim(L('Sadeleştir', 'Cancel'), fx(OP('lim', x + '→' + a) + '(' + x + ' ' + isaretli(b) + ')')), adim(L('Yerine koy', 'Substitute'), fx(a + ' ' + isaretli(b) + ' = <b>' + (a + b) + '</b>'))] }; } },
    { id: 'lim-sin', d: 'calc1', k: 'limit', f: 'lhopital', sev: 'kolay', n: 81,
      u: function () { var a = ri(1, 9), b = ri(1, 9), d1 = kesir(a, b); var r = sik(d1, [kesir(b, a), '1', '0', String(a * b), kesir(a, 2 * b)]);
        return { metin: L('Limiti bul:', 'Find the limit:') + fx(OP('lim', x + '→0') + F('sin ' + a + x, b + x)), mc: r.mc, dogruI: r.dogruI,
          ip: [L('0/0 belirsizliği var: L’Hôpital ya da sin u/u → 1.', '0/0 form: use L’Hôpital or sin u/u → 1.'), fx(F('sin ' + a + x, b + x) + ' = ' + F(a, b) + '·' + F('sin ' + a + x, a + x))],
          cozum: [adim(L('Belirsizlik', 'Indeterminate form'), fx(F('0', '0'))), adim('L’Hôpital', fx(OP('lim', x + '→0') + F(a + ' cos ' + a + x, b))), adim(L('Sonuç', 'Result'), fx(F(a + ' · 1', b) + ' = <b>' + d1 + '</b>'))] }; } },
    { id: 'turev-tanim-g', d: 'calc1', k: 'turev', f: 'turev-tanim', sev: 'orta', n: 9 * 19,
      u: function () { var c = rnz(-4, 5), a = rnz(-9, 9), fa = c === 1 ? x + S(2) : c + x + S(2);
        return { metin: L('Tanımla bul: ', 'Using the definition, find ') + fx('<i>f</i>(' + x + ') = ' + fa) + L(' için ', ' — ') + fx('<i>f</i>′(' + a + ')'), dogru: 2 * c * a, birim: '', s: '<i>f</i>′(' + a + ')',
          ip: [fx('<i>f</i>′(<i>a</i>) = ' + OP('lim', '<i>h</i>→0') + F('<i>f</i>(<i>a</i>+<i>h</i>) − <i>f</i>(<i>a</i>)', '<i>h</i>')), fx(F(c + '(' + a + '+<i>h</i>)' + S(2) + ' − ' + c + '·' + a + S(2), '<i>h</i>') + ' = ' + c + '(' + (2 * a) + ' + <i>h</i>)')],
          cozum: [adim(L('Tanım', 'Definition'), fx(OP('lim', '<i>h</i>→0') + F('<i>f</i>(' + a + '+<i>h</i>) − <i>f</i>(' + a + ')', '<i>h</i>'))), adim(L('Aç', 'Expand'), fx(F(c + '(' + (a * a) + ' ' + isaretli(2 * a) + '<i>h</i> + <i>h</i>' + S(2) + ') − ' + (c * a * a), '<i>h</i>') + ' = ' + c + '(' + (2 * a) + ' + <i>h</i>)')), adim(L('h → 0', 'h → 0'), fx(c + ' · ' + (2 * a) + ' = <b>' + (2 * c * a) + '</b>'))] }; } },
    { id: 'turev-pol', d: 'calc1', k: 'turev', f: 'turev-kural', sev: 'kolay', n: 9 * 9 * 9 * 7,
      u: function () { var a = rnz(-4, 4), b = ri(-4, 4), c = ri(-4, 4), k = ri(-3, 3), p = [[a, 3], [b, 2], [c, 1], [ri(-9, 9), 0]], d = 3 * a * k * k + 2 * b * k + c;
        return { metin: fx('<i>f</i>(' + x + ') = ' + pol(p)) + L(' ise ', ', find ') + fx('<i>f</i>′(' + k + ')') + L(' kaçtır?', '.'), dogru: d, birim: '', s: '<i>f</i>′(' + k + ')',
          ip: [L('Kuvvet kuralı: (xⁿ)′ = n xⁿ⁻¹; sabitin türevi 0.', 'Power rule: (xⁿ)′ = n xⁿ⁻¹; constants vanish.'), fx('<i>f</i>′(' + x + ') = ' + pol([[3 * a, 2], [2 * b, 1], [c, 0]]))],
          cozum: [adim(L('Türev al', 'Differentiate'), fx('<i>f</i>′(' + x + ') = ' + pol([[3 * a, 2], [2 * b, 1], [c, 0]]))), adim(L('Yerine koy', 'Substitute'), fx('<i>f</i>′(' + k + ') = ' + (3 * a) + '·(' + k + ')' + S(2) + ' ' + isaretli(2 * b) + '·(' + k + ') ' + isaretli(c) + ' = <b>' + d + '</b>'))] }; } },
    { id: 'carpim', d: 'calc1', k: 'turev', f: 'turev-kural', sev: 'orta', n: 8 * 9 * 8 * 9,
      u: function () { var a = rnz(-4, 4), b = rnz(-5, 5), c = rnz(-4, 4), d = rnz(-5, 5), dog = pol([[2 * a * c, 1], [a * d + b * c, 0]]);
        var r = sik(dog, [pol([[a * c, 1], [a * d + b * c, 0]]), pol([[2 * a * c, 1], [a * d - b * c, 0]]), pol([[a * c, 0]]), pol([[2 * a * c, 1], [b * d, 0]])]);
        return { metin: L('Türevi bul: ', 'Differentiate: ') + fx('<i>f</i>(' + x + ') = (' + pol([[a, 1], [b, 0]]) + ')(' + pol([[c, 1], [d, 0]]) + ')'), mc: r.mc.map(function (m) { return fx(m); }), dogruI: r.dogruI,
          ip: [L('Çarpım kuralı: (uv)′ = u′v + uv′', 'Product rule: (uv)′ = u′v + uv′'), fx(a + '(' + pol([[c, 1], [d, 0]]) + ') + (' + pol([[a, 1], [b, 0]]) + ')·' + c)],
          cozum: [adim(L('Kural', 'Rule'), fx('(<i>uv</i>)′ = <i>u</i>′<i>v</i> + <i>uv</i>′')), adim(L('Uygula', 'Apply'), fx(a + '(' + pol([[c, 1], [d, 0]]) + ') + ' + c + '(' + pol([[a, 1], [b, 0]]) + ')')), adim(L('Topla', 'Collect'), fx('<b>' + dog + '</b>'))] }; } },
    { id: 'zincir', d: 'calc1', k: 'turev', f: 'turev-kural', sev: 'orta', n: 8 * 9 * 6,
      u: function () { var a = rnz(-4, 4), b = rnz(-6, 6), n = ri(2, 7), ic = pol([[a, 1], [b, 0]]), dog = (n * a) + '(' + ic + ')' + (n - 1 > 1 ? S(n - 1) : '');
        var r = sik(dog, [n + '(' + ic + ')' + (n - 1 > 1 ? S(n - 1) : ''), (n * a) + '(' + ic + ')' + S(n), a + '(' + ic + ')' + (n - 1 > 1 ? S(n - 1) : ''), (n * a) + x + '(' + ic + ')' + (n - 1 > 1 ? S(n - 1) : '')]);
        return { metin: L('Türevi bul: ', 'Differentiate: ') + fx('(' + ic + ')' + S(n)), mc: r.mc.map(fx), dogruI: r.dogruI,
          ip: [L('Zincir kuralı: dış türev × iç türev.', 'Chain rule: outer derivative × inner derivative.'), fx(n + '(' + ic + ')' + S(n - 1) + ' · ' + a)],
          cozum: [adim(L('Dış', 'Outer'), fx(n + '(' + ic + ')' + S(n - 1))), adim(L('İç', 'Inner'), fx('(' + ic + ')′ = ' + a)), adim(L('Çarp', 'Multiply'), fx('<b>' + dog + '</b>'))] }; } },
    { id: 'kritik-g', d: 'calc1', k: 'uyg', f: 'kritik', sev: 'orta', n: 8 * 2,
      u: function () { var p = ri(1, 8), yon = rast([1, -1]), poly = yon > 0 ? pol([[1, 3], [-3 * p * p, 1]]) : pol([[-1, 3], [3 * p * p, 1]]), mx = yon > 0 ? -p : p;
        var r = sik(String(mx).replace('-', '−'), [String(-mx).replace('-', '−'), '0', String(3 * p).replace('-', '−'), String(p * p)]);
        return { metin: fx('<i>f</i>(' + x + ') = ' + poly) + L(' fonksiyonunun yerel maksimum noktası x = ?', ': at which x is the local maximum?'), mc: r.mc, dogruI: r.dogruI,
          ip: [L('f′(x) = 0 yap, kritik noktaları bul.', 'Set f′(x) = 0 for critical points.'), L('İkinci türevin işaretine bak: f″ < 0 → maksimum.', 'Check f″: negative means a maximum.')],
          cozum: [adim(L('Türev', 'Derivative'), fx('<i>f</i>′(' + x + ') = ' + (yon > 0 ? pol([[3, 2], [-3 * p * p, 0]]) : pol([[-3, 2], [3 * p * p, 0]])) + ' = 0 ⟹ ' + x + ' = ±' + p)), adim(L('İkinci türev', 'Second derivative'), fx('<i>f</i>″(' + x + ') = ' + (6 * yon) + x)), adim(L('Karar', 'Decide'), fx('<i>f</i>″(' + mx + ') = ' + (6 * yon * mx) + ' &lt; 0 ⟹ <b>' + x + ' = ' + mx + '</b>'))] }; } },
    { id: 'teget-g', d: 'calc1', k: 'uyg', f: 'lineer-yak', sev: 'orta', n: 15 * 13,
      u: function () { var a = rnz(-7, 7), b = ri(-6, 6), m = 2 * a + b, fa = a * a + b * a, kes = fa - m * a;
        return { metin: fx(y + ' = ' + pol([[1, 2], [b, 1]])) + L(' eğrisine x = ' + a + ' noktasında çizilen teğet doğrunun y-eksenini kestiği değer?', ': where does the tangent at x = ' + a + ' cross the y-axis?'), dogru: kes, birim: '', s: y + B('0'),
          ip: [L('Eğim m = f′(a); nokta (a, f(a)).', 'Slope m = f′(a); point (a, f(a)).'), fx('<i>m</i> = 2·' + a + ' ' + isaretli(b) + ' = ' + m + ', &nbsp;<i>f</i>(' + a + ') = ' + fa)],
          cozum: [adim(L('Eğim', 'Slope'), fx('<i>m</i> = ' + m)), adim(L('Teğet', 'Tangent'), fx(y + ' − ' + fa + ' = ' + m + '(' + x + ' ' + isaretli(-a) + ')')), adim(L('x = 0', 'x = 0'), fx(y + ' = ' + fa + ' − ' + m + '·' + a + ' = <b>' + kes + '</b>'))] }; } },
    { id: 'belirli', d: 'calc1', k: 'integral', f: 'temel-teorem', sev: 'kolay', n: 8 * 11 * 5,
      u: function () { var c = rnz(-3, 5), d = ri(-5, 5), b = ri(1, 5), v = c * b * b * b / 3 + d * b;
        return { metin: L('Hesapla: ', 'Evaluate: ') + fx(OP('∫', '0', b) + '(' + pol([[c, 2], [d, 0]]) + ')<i>dx</i>'), dogru: v, birim: '', s: '<i>I</i>',
          ip: [L('Ters türev: ∫xⁿdx = xⁿ⁺¹/(n+1).', 'Antiderivative: ∫xⁿdx = xⁿ⁺¹/(n+1).'), fx('[' + F(c + x + S(3), 3) + ' ' + isaretli(d) + x + ']' + B(0) + S(b))],
          cozum: [adim(L('Ters türev', 'Antiderivative'), fx('<i>F</i>(' + x + ') = ' + F(c + x + S(3), 3) + ' ' + isaretli(d) + x)), adim(L('Sınırlar', 'Limits'), fx('<i>F</i>(' + b + ') − <i>F</i>(0) = ' + F(c + '·' + (b * b * b), 3) + ' ' + isaretli(d * b))), adim(L('Sonuç', 'Result'), fx('<b>' + sayi(v) + '</b>'))] }; } },
    { id: 'usub-g', d: 'calc1', k: 'integral', f: 'u-sub', sev: 'orta', n: 5 * 9 * 5,
      u: function () { var a = ri(1, 5), b = rnz(-5, 5), n = ri(2, 6), ic = pol([[a, 2], [b, 0]]), dog = F('(' + ic + ')' + S(n + 1), n + 1) + ' + <i>C</i>';
        var r = sik(dog, [F('(' + ic + ')' + S(n + 1), (n + 1) * 2 * a) + ' + <i>C</i>', '(' + ic + ')' + S(n + 1) + ' + <i>C</i>', F('(' + ic + ')' + S(n), n) + ' + <i>C</i>', (2 * a) + x + '(' + ic + ')' + S(n + 1) + ' + <i>C</i>']);
        return { metin: L('Hesapla: ', 'Evaluate: ') + fx(OP('∫') + (2 * a) + x + '(' + ic + ')' + S(n) + '<i>dx</i>'), mc: r.mc.map(fx), dogruI: r.dogruI,
          ip: [L('u = ' + 'iç fonksiyon seç; du integralde var mı?', 'Let u be the inner function; is du already there?'), fx('<i>u</i> = ' + ic + ', &nbsp;<i>du</i> = ' + (2 * a) + x + '<i>dx</i>')],
          cozum: [adim(L('Değiştir', 'Substitute'), fx('<i>u</i> = ' + ic + ' ⟹ ' + OP('∫') + '<i>u</i>' + S(n) + '<i>du</i>')), adim(L('İntegral', 'Integrate'), fx(F('<i>u</i>' + S(n + 1), n + 1) + ' + <i>C</i>')), adim(L('Geri dön', 'Back-substitute'), fx('<b>' + dog + '</b>'))] }; } },
    { id: 'alan-iki-g', d: 'calc1', k: 'iuyg', f: 'iki-egri', sev: 'orta', n: 8,
      u: function () { var k = ri(1, 8), v = k * k * k / 6;
        return { metin: fx(y + ' = ' + x + S(2)) + L(' ile ', ' and ') + fx(y + ' = ' + (k === 1 ? '' : k) + x) + L(' arasında kalan alan?', ': area between them?'), dogru: v, birim: L('birim²', 'unit²'), s: '<i>A</i>',
          ip: [L('Kesişim: x² = kx ⟹ x = 0 ve x = k.', 'Intersections: x² = kx ⟹ x = 0, x = k.'), fx(OP('∫', '0', k) + '(' + k + x + ' − ' + x + S(2) + ')<i>dx</i>')],
          cozum: [adim(L('Sınırlar', 'Limits'), fx(x + ' = 0, &nbsp;' + x + ' = ' + k)), adim(L('Üst − alt', 'Top − bottom'), fx(OP('∫', '0', k) + '(' + k + x + ' − ' + x + S(2) + ')<i>dx</i> = ' + F(k + '·' + (k * k), 2) + ' − ' + F(k * k * k, 3))), adim(L('Sonuç', 'Result'), fx('<b>' + sayi(v) + '</b>'))] }; } },
    { id: 'disk-g', d: 'calc1', k: 'iuyg', f: 'disk', sev: 'zor', n: 9,
      u: function () { var b = ri(1, 9), v = Math.PI * b * b / 2;
        return { metin: fx(y + ' = ' + R(x)) + L(', 0 ≤ x ≤ ' + b + ' bölgesi x ekseni etrafında döndürülüyor. Hacim?', ', 0 ≤ x ≤ ' + b + ', is revolved about the x-axis. Volume?'), dogru: v, birim: L('birim³', 'unit³'), s: '<i>V</i>',
          ip: [L('Disk yöntemi: V = π∫[f(x)]²dx', 'Disk method: V = π∫[f(x)]²dx'), fx('π' + OP('∫', '0', b) + x + '<i>dx</i>')],
          cozum: [adim(L('Disk', 'Disk'), fx('<i>V</i> = π' + OP('∫', '0', b) + '(' + R(x) + ')' + S(2) + '<i>dx</i>')), adim(L('İntegral', 'Integrate'), fx('π[' + F(x + S(2), 2) + ']' + B(0) + S(b) + ' = ' + F('π·' + (b * b), 2))), adim(L('Sonuç', 'Result'), fx('<b>' + sayi(v) + '</b>'))] }; } },

    /* ================= CALCULUS II ================= */
    { id: 'kismi-g', d: 'calc2', k: 'teknik', f: 'kismi-int', sev: 'orta', n: 6,
      u: function () { var a = ri(1, 6), ea = e + S(a === 1 ? x : a + x), dog = F(ea, a === 1 ? '' : a) ; dog = ea + '(' + F(x, a) + ' − ' + F(1, a * a) + ') + <i>C</i>';
        var r = sik(dog, [ea + '(' + x + ' − 1) + <i>C</i>', ea + '(' + F(x, a) + ' + ' + F(1, a * a) + ') + <i>C</i>', F(x + S(2), 2) + ea + ' + <i>C</i>', a + x + ea + ' + <i>C</i>']);
        return { metin: L('Hesapla: ', 'Evaluate: ') + fx(OP('∫') + x + ea + '<i>dx</i>'), mc: r.mc.map(fx), dogruI: r.dogruI,
          ip: [L('Kısmi integral: u = x, dv = e^{ax}dx.', 'By parts: u = x, dv = e^{ax}dx.'), fx(OP('∫') + '<i>u dv</i> = <i>uv</i> − ' + OP('∫') + '<i>v du</i>')],
          cozum: [adim(L('Seç', 'Choose'), fx('<i>u</i> = ' + x + ', <i>dv</i> = ' + ea + '<i>dx</i> ⟹ <i>v</i> = ' + F(ea, a))), adim(L('Uygula', 'Apply'), fx(F(x + ea, a) + ' − ' + OP('∫') + F(ea, a) + '<i>dx</i>')), adim(L('Sonuç', 'Result'), fx('<b>' + dog + '</b>'))] }; } },
    { id: 'geo-g', d: 'calc2', k: 'seri', f: 'geo-seri', sev: 'kolay', n: 9 * 20,
      u: function () { var a = rnz(-9, 9), q = ri(2, 6), p = rnz(-(q - 1), q - 1), r = p / q, v = a / (1 - r);
        return { metin: L('Serinin toplamı: ', 'Sum the series: ') + fx(OP('∑', '<i>n</i>=0', '∞') + a + '(' + kesir(p, q) + ')' + S('<i>n</i>')), dogru: v, birim: '', s: '<i>S</i>',
          ip: [L('|r| < 1 olduğu için yakınsar: S = a/(1 − r).', 'Since |r| < 1 it converges: S = a/(1 − r).'), fx(F(a, '1 − (' + kesir(p, q) + ')'))],
          cozum: [adim(L('a ve r', 'a and r'), fx('<i>a</i> = ' + a + ', <i>r</i> = ' + kesir(p, q))), adim(L('Formül', 'Formula'), fx(F(a, '1 − (' + kesir(p, q) + ')') + ' = ' + kesir(a * q, q - p))), adim(L('Sonuç', 'Result'), fx('<b>' + sayi(v) + '</b>'))] }; } },
    { id: 'p-seri-g', d: 'calc2', k: 'seri', f: 'p-serisi', sev: 'kolay', n: 8,
      u: function () { var p = rast([0.5, 1, 1.5, 2, 3, 0.8, 1.2, 4]), yak = p > 1, ys = L('Yakınsak', 'Converges'), is = L('Iraksak', 'Diverges'), pS = sayi(p);
        return { metin: fx(OP('∑', '<i>n</i>=1', '∞') + F(1, '<i>n</i>' + S(pS))) + L(' yakınsak mı?', ' — converge or diverge?'), mc: [ys, is], dogruI: yak ? 0 : 1,
          ip: [L('p-serisi: p > 1 ise yakınsar.', 'p-series: converges iff p > 1.'), 'p = ' + pS],
          cozum: [adim('p', fx('<i>p</i> = ' + pS)), adim(L('Karar', 'Decide'), '<b>' + (yak ? ys + ' (p > 1)' : is + ' (p ≤ 1)') + '</b>')] }; } },
    { id: 'oran-g', d: 'calc2', k: 'seri', f: 'oran-testi', sev: 'orta', n: 3 * 8 * 4,
      u: function () { var c = ri(2, 9), k = ri(1, 4), tip = ri(0, 2), terim = [F('<i>n</i>' + S(k), c + S('<i>n</i>')), F(c + S('<i>n</i>'), '<i>n</i>!'), F('<i>n</i>!', c + S('<i>n</i>'))][tip], yak = tip < 2, ys = L('Yakınsak', 'Converges'), is = L('Iraksak', 'Diverges');
        var lim = ['1/' + c, '0', '∞'][tip];
        return { metin: L('Oran testiyle karar ver: ', 'Use the ratio test: ') + fx(OP('∑', '<i>n</i>=1', '∞') + terim), mc: [ys, is], dogruI: yak ? 0 : 1,
          ip: [fx('<i>L</i> = ' + OP('lim') + '|<i>a</i>' + B('<i>n</i>+1') + '/<i>a</i>' + B('<i>n</i>') + '|'), L('L < 1 yakınsak, L > 1 ıraksak.', 'L < 1 converges, L > 1 diverges.')],
          cozum: [adim(L('Oran', 'Ratio'), fx('|<i>a</i>' + B('<i>n</i>+1') + '/<i>a</i>' + B('<i>n</i>') + '| → ' + lim)), adim(L('Karar', 'Decide'), '<b>' + (yak ? ys : is) + '</b>')] }; } },
    { id: 'maclaurin-g', d: 'calc2', k: 'seri', f: 'maclaurin', sev: 'orta', n: 5 * 6,
      u: function () { var a = rnz(-3, 3), n = ri(1, 6), fa = 1; for (var i = 2; i <= n; i++) fa *= i; var v = Math.pow(a, n) / fa;
        return { metin: fx(e + S((a === 1 ? '' : a === -1 ? '−' : a) + x)) + L(' fonksiyonunun Maclaurin serisinde ', ': Maclaurin coefficient of ') + fx(x + S(n)) + L(' teriminin katsayısı?', '?'), dogru: v, birim: '', s: '<i>c</i>' + B(n),
          ip: [fx(e + S('<i>u</i>') + ' = ' + OP('∑') + F('<i>u</i>' + S('<i>n</i>'), '<i>n</i>!')), fx('<i>u</i> = ' + a + x + ' ⟹ ' + F('(' + a + ')' + S(n), n + '!'))],
          cozum: [adim(L('Seri', 'Series'), fx(e + S('<i>u</i>') + ' = ' + OP('∑') + F('<i>u</i>' + S('<i>n</i>'), '<i>n</i>!'))), adim(L('Katsayı', 'Coefficient'), fx(F('(' + a + ')' + S(n), n + '!') + ' = ' + F(Math.pow(a, n), fa))), adim(L('Sonuç', 'Result'), fx('<b>' + sayi(v) + '</b>'))] }; } },
    { id: 'yaricap-g', d: 'calc2', k: 'seri', f: 'yaricap', sev: 'orta', n: 8 * 4,
      u: function () { var c = ri(2, 9), k = ri(0, 3);
        return { metin: fx(OP('∑', '<i>n</i>=1', '∞') + F((k ? '<i>n</i>' + (k > 1 ? S(k) : '') : '') + x + S('<i>n</i>'), c + S('<i>n</i>'))) + L(' kuvvet serisinin yakınsaklık yarıçapı?', ': radius of convergence?'), dogru: c, birim: '', s: '<i>R</i>',
          ip: [L('Oran testi: |x|/c < 1.', 'Ratio test: |x|/c < 1.'), L('Polinom çarpanı nᵏ limiti değiştirmez.', 'A polynomial factor nᵏ does not change the limit.')],
          cozum: [adim(L('Oran', 'Ratio'), fx(OP('lim') + '|' + F(x, c) + '| &lt; 1')), adim(L('Sonuç', 'Result'), fx('<i>R</i> = <b>' + c + '</b>'))] }; } },
    { id: 'kutupsal-g', d: 'calc2', k: 'kutupsal', f: 'kartezyen-kutupsal', sev: 'kolay', n: 9 * 8,
      u: function () { var r = ri(1, 9), th = rast([30, 45, 60, 90, 120, 135, 150, 180]), v = r * Math.cos(th * deg);
        return { metin: L('Kutupsal (r, θ) = (' + r + ', ' + th + '°) noktasının x koordinatı?', 'x-coordinate of the polar point (r, θ) = (' + r + ', ' + th + '°)?'), dogru: v, birim: '', s: x,
          ip: [fx(x + ' = <i>r</i> cos θ'), fx(x + ' = ' + r + ' cos ' + th + '°')], cozum: [adim(L('Dönüşüm', 'Convert'), fx(x + ' = <i>r</i> cos θ')), adim(L('Hesap', 'Compute'), fx(r + ' · ' + sayi(Math.cos(th * deg)) + ' = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'nokta-g', d: 'calc2', k: 'vektor', f: 'vektor-boy', sev: 'kolay', n: 19 * 19 * 19 * 19,
      u: function () { var a = [ri(-6, 6), ri(-6, 6), ri(-6, 6)], b = [ri(-6, 6), ri(-6, 6), ri(-6, 6)], v = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        return { metin: '<b>u</b> = ⟨' + a.join(', ') + '⟩, <b>v</b> = ⟨' + b.join(', ') + '⟩ ' + L('için', '—') + ' <b>u</b>·<b>v</b> = ?', dogru: v, birim: '', s: '<b>u</b>·<b>v</b>',
          ip: [L('Bileşenleri çarp, topla.', 'Multiply components, add.'), fx(a.map(function (q, i) { return '(' + q + ')(' + b[i] + ')'; }).join(' + '))], cozum: [adim(L('Çarp', 'Multiply'), fx(a.map(function (q, i) { return '(' + q + ')(' + b[i] + ')'; }).join(' + '))), adim(L('Topla', 'Add'), fx('<b>' + v + '</b>'))] }; } },
    { id: 'capraz-g', d: 'calc2', k: 'vektor', f: 'vektorel', sev: 'orta', n: 13 * 13 * 13 * 13,
      u: function () { var a = [ri(-5, 5), ri(-5, 5), ri(-5, 5)], b = [ri(-5, 5), ri(-5, 5), ri(-5, 5)], v = a[1] * b[2] - a[2] * b[1];
        return { metin: '<b>u</b> = ⟨' + a.join(', ') + '⟩, <b>v</b> = ⟨' + b.join(', ') + '⟩. <b>u</b> × <b>v</b> ' + L('vektörünün i bileşeni?', ': its i-component?'), dogru: v, birim: '', s: '(<b>u</b>×<b>v</b>)' + B('<i>x</i>'),
          ip: [fx('(<b>u</b>×<b>v</b>)' + B('<i>x</i>') + ' = <i>u</i>' + B(2) + '<i>v</i>' + B(3) + ' − <i>u</i>' + B(3) + '<i>v</i>' + B(2)), fx('(' + a[1] + ')(' + b[2] + ') − (' + a[2] + ')(' + b[1] + ')')], cozum: [adim(L('Determinant', 'Determinant'), fx('<i>u</i>' + B(2) + '<i>v</i>' + B(3) + ' − <i>u</i>' + B(3) + '<i>v</i>' + B(2))), adim(L('Hesap', 'Compute'), fx('(' + a[1] + ')(' + b[2] + ') − (' + a[2] + ')(' + b[1] + ') = <b>' + v + '</b>'))] }; } },
    { id: 'kismi-tur-g', d: 'calc2', k: 'cok', f: 'kismi', sev: 'kolay', n: 9 * 9 * 9 * 9,
      u: function () { var a = rnz(-4, 4), b = rnz(-4, 4), p = ri(-4, 4), q = ri(-4, 4), v = a * p * p + 3 * b * q * q;
        return { metin: fx('<i>f</i>(' + x + ', ' + y + ') = ' + pol([[a, 2]]) + y + ' ' + isaretli(b) + y + S(3)) + L(' için ', ': ') + fx('<i>f</i>' + B(y) + '(' + p + ', ' + q + ')'), dogru: v, birim: '', s: '<i>f</i>' + B(y),
          ip: [L('x’i sabit tut, y’ye göre türev al.', 'Hold x fixed, differentiate in y.'), fx('<i>f</i>' + B(y) + ' = ' + pol([[a, 2]]) + ' ' + isaretli(3 * b) + y + S(2))], cozum: [adim(L('Kısmi türev', 'Partial'), fx('<i>f</i>' + B(y) + ' = ' + pol([[a, 2]]) + ' ' + isaretli(3 * b) + y + S(2))), adim(L('Yerine koy', 'Substitute'), fx(a + '·' + (p * p) + ' ' + isaretli(3 * b) + '·' + (q * q) + ' = <b>' + v + '</b>'))] }; } },
    { id: 'gradyan-g', d: 'calc2', k: 'cok', f: 'gradyan', sev: 'orta', n: 6 * 6 * 9 * 9,
      u: function () { var a = ri(1, 6), b = ri(1, 6), p = rnz(-4, 4), q = rnz(-4, 4), gx = 2 * a * p, gy = 2 * b * q, v = Math.hypot(gx, gy);
        return { metin: fx('<i>f</i> = ' + pol([[a, 2]]) + ' + ' + pol([[b, 2]], y)) + L(' için (' + p + ', ' + q + ') noktasında |∇f| = ?', ': |∇f| at (' + p + ', ' + q + ')?'), dogru: v, birim: '', s: '|∇<i>f</i>|',
          ip: [fx('∇<i>f</i> = ⟨' + (2 * a) + x + ', ' + (2 * b) + y + '⟩'), fx('⟨' + gx + ', ' + gy + '⟩')], cozum: [adim(L('Gradyan', 'Gradient'), fx('∇<i>f</i>(' + p + ', ' + q + ') = ⟨' + gx + ', ' + gy + '⟩')), adim(L('Boy', 'Length'), fx(R(gx * gx + ' + ' + gy * gy) + ' = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'cift-g', d: 'calc2', k: 'katli', f: 'cift-katli', sev: 'orta', n: 6 * 6,
      u: function () { var a = ri(1, 6), b = ri(1, 6), v = a * b * (a + b) / 2;
        return { metin: L('Hesapla: ', 'Evaluate: ') + fx(OP('∫', '0', a) + OP('∫', '0', b) + '(' + x + ' + ' + y + ')<i>dy dx</i>'), dogru: v, birim: '', s: '<i>I</i>',
          ip: [L('Önce y’ye göre integral al.', 'Integrate in y first.'), fx(OP('∫', '0', a) + '(' + b + x + ' + ' + F(b * b, 2) + ')<i>dx</i>')], cozum: [adim(L('İç integral', 'Inner'), fx(b + x + ' + ' + F(b * b, 2))), adim(L('Dış integral', 'Outer'), fx(F(b + '·' + a * a, 2) + ' + ' + F(b * b + '·' + a, 2) + ' = <b>' + sayi(v) + '</b>'))] }; } },

    /* ================= LİNEER CEBİR ================= */
    { id: 'det2-g', d: 'lin', k: 'matris', f: 'det2', sev: 'kolay', n: 19 * 19 * 19 * 19,
      u: function () { var m = [ri(-9, 9), ri(-9, 9), ri(-9, 9), ri(-9, 9)], v = m[0] * m[3] - m[1] * m[2];
        return { metin: L('Determinantı bul: ', 'Find the determinant: ') + fx(mx([[m[0], m[1]], [m[2], m[3]]])), dogru: v, birim: '', s: 'det',
          ip: [fx('<i>ad</i> − <i>bc</i>'), fx('(' + m[0] + ')(' + m[3] + ') − (' + m[1] + ')(' + m[2] + ')')], cozum: [adim(L('Kural', 'Rule'), fx('<i>ad</i> − <i>bc</i>')), adim(L('Hesap', 'Compute'), fx('(' + m[0] + ')(' + m[3] + ') − (' + m[1] + ')(' + m[2] + ') = <b>' + v + '</b>'))] }; } },
    { id: 'det3-g', d: 'lin', k: 'matris', f: 'det3', sev: 'orta', n: Math.pow(7, 9),
      u: function () { var a = []; for (var i = 0; i < 9; i++) a.push(ri(-3, 3)); var c1 = a[4] * a[8] - a[5] * a[7], c2 = a[3] * a[8] - a[5] * a[6], c3 = a[3] * a[7] - a[4] * a[6], v = a[0] * c1 - a[1] * c2 + a[2] * c3;
        return { metin: L('Determinantı bul: ', 'Find the determinant: ') + fx(mx([[a[0], a[1], a[2]], [a[3], a[4], a[5]], [a[6], a[7], a[8]]])), dogru: v, birim: '', s: 'det',
          ip: [L('İlk satıra göre kofaktör açılımı.', 'Cofactor expansion along row 1.'), fx(a[0] + '·(' + c1 + ') − ' + '(' + a[1] + ')·(' + c2 + ') + (' + a[2] + ')·(' + c3 + ')')],
          cozum: [adim(L('Küçükler', 'Minors'), fx('<i>M</i>' + B(11) + ' = ' + c1 + ', <i>M</i>' + B(12) + ' = ' + c2 + ', <i>M</i>' + B(13) + ' = ' + c3)), adim(L('Açılım', 'Expand'), fx(a[0] + '·' + c1 + ' − (' + a[1] + ')·' + c2 + ' + (' + a[2] + ')·' + c3 + ' = <b>' + v + '</b>'))] }; } },
    { id: 'carpim-g', d: 'lin', k: 'matris', f: 'matris-carpim', sev: 'kolay', n: Math.pow(11, 8),
      u: function () { var A = [[ri(-5, 5), ri(-5, 5)], [ri(-5, 5), ri(-5, 5)]], Bm = [[ri(-5, 5), ri(-5, 5)], [ri(-5, 5), ri(-5, 5)]], i = ri(0, 1), j = ri(0, 1), v = A[i][0] * Bm[0][j] + A[i][1] * Bm[1][j];
        return { metin: fx('<i>A</i> = ' + mx(A) + ', <i>B</i> = ' + mx(Bm)) + L(' için (AB)', ': (AB)') + B((i + 1) + '' + (j + 1)) + ' = ?', dogru: v, birim: '', s: '(<i>AB</i>)' + B((i + 1) + '' + (j + 1)),
          ip: [L('A’nın ' + (i + 1) + '. satırı · B’nin ' + (j + 1) + '. sütunu', 'Row ' + (i + 1) + ' of A · column ' + (j + 1) + ' of B'), fx('(' + A[i][0] + ')(' + Bm[0][j] + ') + (' + A[i][1] + ')(' + Bm[1][j] + ')')], cozum: [adim(L('Satır · sütun', 'Row · column'), fx('(' + A[i][0] + ')(' + Bm[0][j] + ') + (' + A[i][1] + ')(' + Bm[1][j] + ') = <b>' + v + '</b>'))] }; } },
    { id: 'ozdeger-g', d: 'lin', k: 'oz', f: 'ozdeger', sev: 'orta', n: 19 * 18,
      u: function () { var a = ri(-9, 9), b = rnz(-9, 9), v = a + Math.abs(b);
        return { metin: fx('<i>A</i> = ' + mx([[a, b], [b, a]])) + L(' matrisinin en büyük özdeğeri?', ': largest eigenvalue?'), dogru: v, birim: '', s: 'λ' + B('maks'),
          ip: [fx('det(<i>A</i> − λ<i>I</i>) = (' + a + ' − λ)' + S(2) + ' − ' + (b * b) + ' = 0'), fx('λ = ' + a + ' ± ' + Math.abs(b))], cozum: [adim(L('Karakteristik', 'Characteristic'), fx('(' + a + ' − λ)' + S(2) + ' = ' + (b * b))), adim(L('Kökler', 'Roots'), fx('λ = ' + (a - Math.abs(b)) + ', ' + (a + Math.abs(b)))), adim(L('En büyük', 'Largest'), fx('<b>' + v + '</b>'))] }; } },
    { id: 'sistem-g', d: 'lin', k: 'sistem', f: 'cramer2', sev: 'kolay', n: 19 * 19 * Math.pow(9, 4),
      u: function () { var X = ri(-9, 9), Y = ri(-9, 9), a, b, c, d; do { a = rnz(-4, 4); b = rnz(-4, 4); c = rnz(-4, 4); d = rnz(-4, 4); } while (a * d - b * c === 0); var e1 = a * X + b * Y, e2 = c * X + d * Y, dt = a * d - b * c;
        return { metin: L('Sistemi çöz, x = ?', 'Solve; x = ?') + fx(pol([[a, 1]]) + ' ' + isaretli(b) + y + ' = ' + e1 + ', &nbsp; ' + pol([[c, 1]]) + ' ' + isaretli(d) + y + ' = ' + e2), dogru: X, birim: '', s: x,
          ip: [L('Cramer: x = Dₓ/D', 'Cramer: x = Dₓ/D'), fx('<i>D</i> = ' + dt + ', <i>D</i>' + B('<i>x</i>') + ' = ' + (e1 * d - b * e2))], cozum: [adim('D', fx('(' + a + ')(' + d + ') − (' + b + ')(' + c + ') = ' + dt)), adim('Dₓ', fx('(' + e1 + ')(' + d + ') − (' + b + ')(' + e2 + ') = ' + (e1 * d - b * e2))), adim(L('Sonuç', 'Result'), fx(x + ' = ' + F(e1 * d - b * e2, dt) + ' = <b>' + X + '</b>'))] }; } },
    { id: 'rank-g', d: 'lin', k: 'uzay', f: 'rank-nullity', sev: 'orta', n: 3 * 2000,
      u: function () { var r = ri(1, 3), r1 = [rnz(-3, 3), ri(-3, 3), ri(-3, 3)], r2 = [ri(-3, 3), rnz(-3, 3), ri(-3, 3)], k1 = rnz(-2, 2), k2 = rnz(-2, 2), M;
        if (r === 1) M = [r1, r1.map(function (q) { return q * k1; }), r1.map(function (q) { return q * k2; })];
        else if (r === 2) { if (r1[0] * r2[1] - r1[1] * r2[0] === 0) r2[1] += 1; M = [r1, r2, r1.map(function (q, i) { return k1 * q + k2 * r2[i]; })]; }
        else { M = [[rnz(1, 3), ri(-2, 2), ri(-2, 2)], [0, rnz(1, 3), ri(-2, 2)], [0, 0, rnz(1, 3)]]; karistir(M); }
        var r0 = sik(String(r), ['1', '2', '3', '0']);
        return { metin: fx('<i>A</i> = ' + mx(M)) + L(' matrisinin rankı?', ': rank?'), mc: r0.mc, dogruI: r0.dogruI,
          ip: [L('Satırların birbirinin katı ya da toplamı mı?', 'Are rows multiples or sums of others?'), L('Basamak formuna indir, sıfır olmayan satırları say.', 'Row-reduce and count nonzero rows.')], cozum: [adim(L('Basamak formu', 'Echelon form'), L(r === 3 ? 'Üç pivot var.' : r === 2 ? '3. satır = ' + k1 + '·1. + ' + k2 + '·2. satır → sıfırlanır.' : '2. ve 3. satır 1. satırın katı → sıfırlanır.', r === 3 ? 'Three pivots.' : r === 2 ? 'Row 3 = ' + k1 + '·R1 + ' + k2 + '·R2 → zero.' : 'Rows 2 and 3 are multiples of row 1 → zero.')), adim(L('Rank', 'Rank'), '<b>' + r + '</b>')] }; } },
    { id: 'iz-det-g', d: 'lin', k: 'oz', f: 'iz-det', sev: 'kolay', n: 19 * 19,
      u: function () { var l1 = rnz(-9, 9), l2 = rnz(-9, 9);
        return { metin: L('2×2 bir matrisin özdeğerleri ' + l1 + ' ve ' + l2 + '. det A = ?', 'A 2×2 matrix has eigenvalues ' + l1 + ' and ' + l2 + '. det A = ?'), dogru: l1 * l2, birim: '', s: 'det <i>A</i>',
          ip: [L('Determinant = özdeğerlerin çarpımı.', 'Determinant = product of eigenvalues.'), fx('(' + l1 + ')(' + l2 + ')')], cozum: [adim(L('Kural', 'Rule'), fx('det <i>A</i> = λ' + B(1) + 'λ' + B(2))), adim(L('Hesap', 'Compute'), fx('(' + l1 + ')(' + l2 + ') = <b>' + (l1 * l2) + '</b>'))] }; } },
    { id: 'aci-g', d: 'lin', k: 'ortho', f: 'aci', sev: 'orta', n: 13 * 13 * 13 * 13,
      u: function () { var a, b; do { a = [ri(-5, 5), ri(-5, 5)]; b = [ri(-5, 5), ri(-5, 5)]; } while (!Math.hypot(a[0], a[1]) || !Math.hypot(b[0], b[1])); var d = a[0] * b[0] + a[1] * b[1], v = d / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]));
        return { metin: '<b>u</b> = ⟨' + a.join(', ') + '⟩, <b>v</b> = ⟨' + b.join(', ') + '⟩. cos θ = ?', dogru: v, birim: '', s: 'cos θ',
          ip: [fx('cos θ = ' + F('<b>u</b>·<b>v</b>', '‖<b>u</b>‖‖<b>v</b>‖')), fx('<b>u</b>·<b>v</b> = ' + d)], cozum: [adim(L('Nokta çarpım', 'Dot'), fx(String(d))), adim(L('Boylar', 'Lengths'), fx(R(a[0] * a[0] + a[1] * a[1]) + ' · ' + R(b[0] * b[0] + b[1] * b[1]))), adim(L('Sonuç', 'Result'), fx('<b>' + sayi(v) + '</b>'))] }; } },

    /* ================= DİFERANSİYEL DENKLEMLER ================= */
    { id: 'ayrilabilir-g', d: 'dif', k: 'bir', f: 'ayrilabilir', sev: 'kolay', n: 10 * 10 * 10,
      u: function () { var k = rast([-0.5, -0.3, -0.2, -0.1, 0.1, 0.2, 0.3, 0.5, 0.05, 1]), y0 = ri(1, 10) * 10, t1 = ri(1, 10), v = y0 * Math.exp(k * t1);
        return { metin: fx(y + '′ = ' + sayi(k) + y + ', &nbsp;' + y + '(0) = ' + y0) + L(' ise y(' + t1 + ') = ?', '; find y(' + t1 + ').'), dogru: v, birim: '', s: y + '(' + t1 + ')',
          ip: [L('Değişkenlere ayır: dy/y = k dt.', 'Separate: dy/y = k dt.'), fx(y + ' = ' + y0 + e + S(sayi(k) + t))], cozum: [adim(L('Ayır', 'Separate'), fx('ln|' + y + '| = ' + sayi(k) + t + ' + <i>C</i>')), adim(L('Başlangıç', 'Initial'), fx(y + ' = ' + y0 + e + S(sayi(k) + t))), adim(L('Hesap', 'Compute'), fx(y0 + e + S(sayi(k * t1)) + ' = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'lineer1-g', d: 'dif', k: 'bir', f: 'lineer1', sev: 'orta', n: 6 * 10 * 10 * 6,
      u: function () { var p = ri(1, 6), q = ri(1, 10) * p, y0 = ri(0, 9), t1 = rast([0.5, 1, 2, 0.25, 1.5, 3]), ys = q / p, v = ys + (y0 - ys) * Math.exp(-p * t1);
        return { metin: fx(y + '′ + ' + p + y + ' = ' + q + ', &nbsp;' + y + '(0) = ' + y0) + L(' ise y(' + sayi(t1) + ') = ?', '; find y(' + sayi(t1) + ').'), dogru: v, birim: '', s: y,
          ip: [L('İntegral çarpanı μ = e^{pt}; denge çözümü q/p.', 'Integrating factor e^{pt}; steady state q/p.'), fx(y + ' = ' + ys + ' + (' + y0 + ' − ' + ys + ')' + e + S('−' + p + t))], cozum: [adim(L('Denge', 'Steady state'), fx(y + B('d') + ' = ' + F(q, p) + ' = ' + ys)), adim(L('Genel çözüm', 'General'), fx(y + ' = ' + ys + ' + <i>C</i>' + e + S('−' + p + t) + ', <i>C</i> = ' + (y0 - ys))), adim(L('Hesap', 'Compute'), fx('<b>' + sayi(v) + '</b>'))] }; } },
    { id: 'karakteristik-g', d: 'dif', k: 'iki', f: 'karakteristik', sev: 'orta', n: 3 * 100,
      u: function () { var tip = ri(0, 2), r1, r2, b, c, dog, yan;
        var Y = function (h) { return y + ' = ' + h; }, C1 = '<i>c</i>' + B(1), C2 = '<i>c</i>' + B(2), ex = function (r) { return e + S((r === 1 ? '' : r === -1 ? '−' : r) + t); };
        if (tip === 0) { r1 = rnz(-5, 5); do { r2 = rnz(-5, 5); } while (r2 === r1); b = -(r1 + r2); c = r1 * r2; dog = Y(C1 + ex(r1) + ' + ' + C2 + ex(r2)); yan = [Y(C1 + ex(-r1) + ' + ' + C2 + ex(-r2)), Y('(' + C1 + ' + ' + C2 + t + ')' + ex(r1)), Y(C1 + ' cos ' + Math.abs(r1) + t + ' + ' + C2 + ' sin ' + Math.abs(r2) + t)]; }
        else if (tip === 1) { r1 = rnz(-5, 5); b = -2 * r1; c = r1 * r1; dog = Y('(' + C1 + ' + ' + C2 + t + ')' + ex(r1)); yan = [Y(C1 + ex(r1) + ' + ' + C2 + ex(r1)), Y('(' + C1 + ' + ' + C2 + t + ')' + ex(-r1)), Y(C1 + ex(r1) + ' + ' + C2 + ex(-r1))]; }
        else { var al = ri(-3, 3), be = ri(1, 4); b = -2 * al; c = al * al + be * be; var dalga = '(' + C1 + ' cos ' + (be === 1 ? '' : be) + t + ' + ' + C2 + ' sin ' + (be === 1 ? '' : be) + t + ')'; dog = Y((al ? ex(al) : '') + dalga); yan = [Y((al ? ex(-al) : '') + dalga), Y(C1 + ex(al + be) + ' + ' + C2 + ex(al - be)), Y((al ? ex(al) : '') + '(' + C1 + ' cos ' + (be * be) + t + ' + ' + C2 + ' sin ' + (be * be) + t + ')')]; }
        var r = sik(dog, yan), den = y + '″ ' + (b ? isaretli(b) + y + '′ ' : '') + (c ? isaretli(c) + y + ' ' : '') + '= 0';
        return { metin: L('Genel çözüm hangisi? ', 'Which is the general solution? ') + fx(den), mc: r.mc.map(fx), dogruI: r.dogruI,
          ip: [L('Karakteristik denklem: r² + br + c = 0.', 'Characteristic equation: r² + br + c = 0.'), fx('<i>r</i>' + S(2) + ' ' + isaretli(b) + '<i>r</i> ' + isaretli(c) + ' = 0')], cozum: [adim(L('Karakteristik', 'Characteristic'), fx('<i>r</i>' + S(2) + ' ' + isaretli(b) + '<i>r</i> ' + isaretli(c) + ' = 0')), adim(L('Kökler', 'Roots'), [L('İki farklı reel kök', 'Two distinct real roots'), L('Çakışık kök', 'Repeated root'), L('Karmaşık eşlenik kökler', 'Complex conjugate roots')][tip]), adim(L('Çözüm', 'Solution'), fx('<b>' + dog + '</b>'))] }; } },
    { id: 'laplace-g', d: 'dif', k: 'laplace', f: 'laplace', sev: 'kolay', n: 4 * 9,
      u: function () { var a = rnz(-5, 5), tip = ri(0, 3), b = Math.abs(a), fT = [t + S(b), e + S(a + t), 'sin ' + b + t, 'cos ' + b + t][tip], fact = 1; for (var i = 2; i <= b; i++) fact *= i;
        var dog = [F(fact, s + S(b + 1)), F(1, s + ' ' + isaretli(-a)), F(b, s + S(2) + ' + ' + b * b), F(s, s + S(2) + ' + ' + b * b)][tip];
        var r = sik(dog, [F(1, s + S(b)), F(1, s + ' ' + isaretli(a)), F(s, s + S(2) + ' + ' + b * b), F(b, s + S(2) + ' + ' + b * b), F(b, s + S(2) + ' − ' + b * b)]);
        return { metin: fx('ℒ{' + fT + '} = ?'), mc: r.mc.map(fx), dogruI: r.dogruI, ip: [L('Laplace tablosuna bak.', 'Use the Laplace table.'), fx(['ℒ{' + t + S('<i>n</i>') + '} = ' + F('<i>n</i>!', s + S('<i>n</i>+1')), 'ℒ{' + e + S('<i>at</i>') + '} = ' + F(1, s + ' − <i>a</i>'), 'ℒ{sin <i>bt</i>} = ' + F('<i>b</i>', s + S(2) + ' + <i>b</i>' + S(2)), 'ℒ{cos <i>bt</i>} = ' + F(s, s + S(2) + ' + <i>b</i>' + S(2))][tip])],
          cozum: [adim(L('Tablo', 'Table'), fx(['ℒ{' + t + S('<i>n</i>') + '} = ' + F('<i>n</i>!', s + S('<i>n</i>+1')), 'ℒ{' + e + S('<i>at</i>') + '} = ' + F(1, s + ' − <i>a</i>'), 'ℒ{sin <i>bt</i>} = ' + F('<i>b</i>', s + S(2) + ' + <i>b</i>' + S(2)), 'ℒ{cos <i>bt</i>} = ' + F(s, s + S(2) + ' + <i>b</i>' + S(2))][tip])), adim(L('Sonuç', 'Result'), fx('<b>' + dog + '</b>'))] }; } },
    { id: 'sonum-g', d: 'dif', k: 'iki', f: 'sonum', sev: 'orta', n: 10 * 10 * 20,
      u: function () { var m = ri(1, 10), k = ri(1, 10) * 10, cc = 2 * Math.sqrt(m * k), c = Math.round(cc * rast([0.3, 0.6, 1, 1.6, 2.5])), z = c / cc, tip = Math.abs(z - 1) < 0.02 ? 1 : z < 1 ? 0 : 2, ad = [L('Az sönümlü (salınır)', 'Underdamped'), L('Kritik sönümlü', 'Critically damped'), L('Aşırı sönümlü', 'Overdamped')];
        if (tip === 1) c = cc; var r = sik(ad[tip], ad.concat([L('Sönümsüz', 'Undamped')]));
        return { metin: L('m = ' + m + ' kg, c = ' + sayi(c) + ' N·s/m, k = ' + k + ' N/m. Sistem nasıl davranır?', 'm = ' + m + ' kg, c = ' + sayi(c) + ' N·s/m, k = ' + k + ' N/m. How does it behave?'), mc: r.mc, dogruI: r.dogruI,
          ip: [fx('ζ = ' + F('<i>c</i>', '2' + R('<i>mk</i>'))), fx('ζ = ' + sayi(c / cc))], cozum: [adim('ζ', fx(F(sayi(c), '2' + R(m * k)) + ' = ' + sayi(c / cc))), adim(L('Karar', 'Decide'), '<b>' + ad[tip] + '</b>')] }; } },

    /* ================= OLASILIK ve İSTATİSTİK ================= */
    { id: 'beklenen-g', d: 'ist', k: 'surekli', f: 'beklenen', sev: 'kolay', n: Math.pow(10, 3) * 30,
      u: function () { var xs = [ri(0, 9), ri(0, 9), ri(0, 9)], p1 = ri(1, 7) / 10, p2 = ri(1, Math.round((1 - p1) * 10) - 1) / 10, p3 = Math.round((1 - p1 - p2) * 10) / 10, ps = [p1, p2, p3], v = xs[0] * p1 + xs[1] * p2 + xs[2] * p3;
        return { metin: L('X değerleri ', 'X takes values ') + xs.join(', ') + L(' ve olasılıkları ', ' with probabilities ') + ps.map(sayi).join(', ') + '. E[X] = ?', dogru: v, birim: '', s: 'E[X]',
          ip: [fx('<i>E</i>[<i>X</i>] = ' + OP('∑') + x + B('<i>i</i>') + '<i>p</i>' + B('<i>i</i>')), fx(xs.map(function (q, i) { return q + '·' + sayi(ps[i]); }).join(' + '))], cozum: [adim(L('Ağırlıklı toplam', 'Weighted sum'), fx(xs.map(function (q, i) { return q + '·' + sayi(ps[i]); }).join(' + '))), adim(L('Sonuç', 'Result'), fx('<b>' + sayi(v) + '</b>'))] }; } },
    { id: 'kosullu-g', d: 'ist', k: 'olas', f: 'kosullu', sev: 'kolay', n: 40 * 40 * 40 * 40,
      u: function () { var a = ri(5, 40), b = ri(5, 40), c = ri(5, 40), d = ri(5, 40), v = a / (a + c);
        return { metin: L('Bir ankette: Mühendis ve kahve içen ' + a + ', mühendis ve çay içen ' + b + ', mühendis olmayıp kahve içen ' + c + ', mühendis olmayıp çay içen ' + d + ' kişi. Kahve içtiği bilinen birinin mühendis olma olasılığı?', 'Survey: engineer & coffee ' + a + ', engineer & tea ' + b + ', non-engineer & coffee ' + c + ', non-engineer & tea ' + d + '. P(engineer | coffee)?'), dogru: v, birim: '', s: '<i>P</i>(<i>M</i>|<i>K</i>)',
          ip: [fx('<i>P</i>(<i>A</i>|<i>B</i>) = ' + F('<i>n</i>(<i>A</i>∩<i>B</i>)', '<i>n</i>(<i>B</i>)')), fx(F(a, a + ' + ' + c))], cozum: [adim(L('Kahve içenler', 'Coffee drinkers'), fx(a + ' + ' + c + ' = ' + (a + c))), adim(L('Sonuç', 'Result'), fx(F(a, a + c) + ' = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'bayes-g', d: 'ist', k: 'olas', f: 'bayes', sev: 'zor', n: 10 * 10 * 10,
      u: function () { var p = rast([0.01, 0.02, 0.05, 0.1, 0.005]), se = rast([0.9, 0.95, 0.99, 0.85]), fp = rast([0.05, 0.1, 0.02, 0.08]), pb = se * p + fp * (1 - p), v = se * p / pb;
        return { metin: L('Bir arıza ürünlerin %' + sayi(p * 100) + '’inde var. Test arızalıyı %' + sayi(se * 100) + ' yakalıyor, sağlamı %' + sayi(fp * 100) + ' yanlışlıkla arızalı diyor. Test “arızalı” dediyse gerçekten arızalı olma olasılığı?', 'A defect affects ' + sayi(p * 100) + '% of items. The test catches ' + sayi(se * 100) + '% of defects and flags ' + sayi(fp * 100) + '% of good items. P(defect | flagged)?'), dogru: v, birim: '', s: '<i>P</i>(<i>A</i>|+)',
          ip: [L('Bayes: P(A|+) = P(+|A)P(A) / P(+)', 'Bayes: P(A|+) = P(+|A)P(A) / P(+)'), fx('<i>P</i>(+) = ' + sayi(se) + '·' + sayi(p) + ' + ' + sayi(fp) + '·' + sayi(1 - p) + ' = ' + sayi(pb))], cozum: [adim(L('Toplam olasılık', 'Total probability'), fx('<i>P</i>(+) = ' + sayi(pb))), adim('Bayes', fx(F(sayi(se) + '·' + sayi(p), sayi(pb)) + ' = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'normal-g', d: 'ist', k: 'surekli', f: 'z-skor', sev: 'orta', n: 20 * 20 * 30,
      u: function () { var mu = ri(40, 80), sg = ri(4, 15), z = rast([-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 1.645, 1.96]), xv = +(mu + z * sg).toFixed(2), v = Phi(z);
        return { metin: L('Ortalama ' + mu + ', standart sapma ' + sg + ' olan normal dağılımda P(X < ' + sayi(xv) + ') = ?', 'For a normal with mean ' + mu + ' and SD ' + sg + ', P(X < ' + sayi(xv) + ') = ?'), dogru: v, birim: '', s: '<i>P</i>',
          ip: [fx('<i>z</i> = ' + F(x + ' − μ', 'σ')), fx('<i>z</i> = ' + sayi(z) + ' ⟹ Φ(' + sayi(z) + ')')], cozum: [adim('z', fx(F(sayi(xv) + ' − ' + mu, sg) + ' = ' + sayi(z))), adim(L('Tablo', 'Table'), fx('Φ(' + sayi(z) + ') = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'komite-g', d: 'ist', k: 'olas', f: 'kombinasyon', sev: 'kolay', n: 20 * 6,
      u: function () { var n = ri(6, 25), r = ri(2, 6), v = FO.comb(n, r);
        return { metin: L(n + ' kişilik bir kulüpten ' + r + ' kişilik bir komite kaç farklı şekilde seçilir?', 'How many ways to choose a ' + r + '-person committee from ' + n + ' members?'), dogru: v, birim: '', s: '<i>C</i>',
          ip: [L('Sıra önemli değil: kombinasyon.', 'Order doesn’t matter: combination.'), fx('<i>C</i>(' + n + ', ' + r + ') = ' + F(n + '!', r + '!·' + (n - r) + '!'))], cozum: [adim(L('Formül', 'Formula'), fx('<i>C</i>(' + n + ', ' + r + ')')), adim(L('Sonuç', 'Result'), fx('<b>' + v + '</b>'))] }; } },
    { id: 'binom-g2', d: 'ist', k: 'kesikli', f: 'binom', sev: 'orta', n: 15 * 9 * 10,
      u: function () { var n = ri(3, 15), p = ri(1, 9) / 10, k = ri(0, Math.min(n, 6)), v = FO.comb(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
        return { metin: L('Bir ürünün kusurlu olma olasılığı ' + sayi(p) + '. ' + n + ' üründen tam ' + k + ' tanesinin kusurlu olma olasılığı?', 'Each item is defective with probability ' + sayi(p) + '. P(exactly ' + k + ' of ' + n + ' defective)?'), dogru: v, birim: '', s: '<i>P</i>',
          ip: [fx('<i>P</i> = <i>C</i>(<i>n</i>,<i>k</i>)<i>p</i>' + S('<i>k</i>') + '(1−<i>p</i>)' + S('<i>n</i>−<i>k</i>')), fx(FO.comb(n, k) + '·' + sayi(p) + S(k) + '·' + sayi(1 - p) + S(n - k))], cozum: [adim('C', fx('<i>C</i>(' + n + ', ' + k + ') = ' + FO.comb(n, k))), adim(L('Sonuç', 'Result'), fx(FO.comb(n, k) + '·' + sayi(p) + S(k) + '·' + sayi(1 - p) + S(n - k) + ' = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'guven-g', d: 'ist', k: 'cikarim', f: 'guven', sev: 'orta', n: 30 * 20 * 50,
      u: function () { var xb = ri(40, 90), sg = ri(4, 20), n = rast([16, 25, 36, 49, 64, 81, 100, 144]), z = rast([1.645, 1.96, 2.576]), alt = xb - z * sg / Math.sqrt(n), lv = { 1.645: '90', 1.96: '95', 2.576: '99' }[z];
        return { metin: L('n = ' + n + ', x̄ = ' + xb + ', σ = ' + sg + '. %' + lv + ' güven aralığının alt sınırı?', 'n = ' + n + ', x̄ = ' + xb + ', σ = ' + sg + '. Lower bound of the ' + lv + '% CI?'), dogru: alt, birim: '', s: L('alt', 'lower'),
          ip: [fx('x̄ − <i>z</i>' + F('σ', R('<i>n</i>'))), fx(xb + ' − ' + z + '·' + F(sg, R(n)))], cozum: [adim(L('Hata payı', 'Margin'), fx(z + '·' + F(sg, Math.sqrt(n)) + ' = ' + sayi(z * sg / Math.sqrt(n)))), adim(L('Sonuç', 'Result'), fx(xb + ' − ' + sayi(z * sg / Math.sqrt(n)) + ' = <b>' + sayi(alt) + '</b>'))] }; } },

    /* ================= SAYISAL YÖNTEMLER ================= */
    { id: 'ikiye-g', d: 'say', k: 'kok', f: 'ikiye-bolme', sev: 'orta', n: 40 * 3,
      u: function () { var c = ri(2, 40), a = Math.floor(Math.sqrt(c)), b = a + 1, n = ri(1, 3), lo = a, hi = b, adimlar = [];
        if (a * a === c) { b = a + 2; hi = b; } for (var i = 0; i < n; i++) { var m = (lo + hi) / 2, fm = m * m - c; adimlar.push('<i>m</i>' + B(i + 1) + ' = ' + sayi(m) + ', <i>f</i> = ' + sayi(fm)); if (fm > 0) hi = m; else lo = m; } var v = (lo + hi) / 2;
        return { metin: fx('<i>f</i>(' + x + ') = ' + x + S(2) + ' − ' + c) + L(' için [' + a + ', ' + b + '] aralığında ' + n + ' ikiye bölme adımından sonraki orta nokta?', ': on [' + a + ', ' + b + '], the midpoint after ' + n + ' bisection steps?'), dogru: v, birim: '', s: '<i>m</i>' + B(n + 1),
          ip: [L('Her adımda işaret değiştiren yarıyı tut.', 'Keep the half where the sign changes.'), fx(adimlar[0])], cozum: adimlar.map(function (q, i) { return adim(L('Adım ', 'Step ') + (i + 1), fx(q)); }).concat([adim(L('Sonuç', 'Result'), fx('[' + sayi(lo) + ', ' + sayi(hi) + '] ⟹ <b>' + sayi(v) + '</b>'))]) }; } },
    { id: 'newton-g', d: 'say', k: 'kok', f: 'newton-raphson', sev: 'kolay', n: 30 * 6,
      u: function () { var c = ri(2, 30), x0 = ri(1, 6), v = x0 - (x0 * x0 * x0 - c) / (3 * x0 * x0);
        return { metin: fx('<i>f</i>(' + x + ') = ' + x + S(3) + ' − ' + c) + L(', x₀ = ' + x0 + ' ile bir Newton adımı: x₁ = ?', ', x₀ = ' + x0 + ': one Newton step gives x₁ = ?'), dogru: v, birim: '', s: x + B(1),
          ip: [fx(x + B(1) + ' = ' + x + B(0) + ' − ' + F('<i>f</i>(' + x + B(0) + ')', '<i>f</i>′(' + x + B(0) + ')')), fx('<i>f</i>(' + x0 + ') = ' + (x0 * x0 * x0 - c) + ', <i>f</i>′(' + x0 + ') = ' + (3 * x0 * x0))], cozum: [adim(L('Değerler', 'Values'), fx('<i>f</i>(' + x0 + ') = ' + (x0 * x0 * x0 - c) + ', <i>f</i>′(' + x0 + ') = ' + (3 * x0 * x0))), adim(L('Adım', 'Step'), fx(x0 + ' − ' + F(x0 * x0 * x0 - c, 3 * x0 * x0) + ' = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'yamuk-g', d: 'say', k: 'sayint', f: 'yamuk', sev: 'kolay', n: 6 * 4 * 11,
      u: function () { var b = ri(1, 6), n = ri(2, 5), c = ri(-5, 5), h = b / n, sm = 0, fs = []; for (var i = 0; i <= n; i++) { var xv = i * h, fv = xv * xv + c; fs.push(sayi(fv)); sm += (i === 0 || i === n ? 1 : 2) * fv; } var v = h / 2 * sm;
        return { metin: L('Yamuk kuralıyla, n = ' + n + ': ', 'Trapezoidal rule, n = ' + n + ': ') + fx(OP('∫', '0', b) + '(' + pol([[1, 2], [c, 0]]) + ')<i>dx</i> ≈ ?'), dogru: v, birim: '', s: '<i>T</i>',
          ip: [fx('<i>h</i> = ' + sayi(h)), fx('<i>f</i>' + B('<i>i</i>') + ': ' + fs.join(', '))], cozum: [adim('h', fx('<i>h</i> = ' + F(b, n) + ' = ' + sayi(h))), adim(L('Değerler', 'Values'), fx(fs.join(', '))), adim(L('Kural', 'Rule'), fx(F(sayi(h), 2) + '·' + sayi(sm) + ' = <b>' + sayi(v) + '</b>'))] }; } },
    { id: 'euler-g', d: 'say', k: 'ode', f: 'euler-yontem', sev: 'kolay', n: 5 * 9 * 3 * 4,
      u: function () { var a = rast([-1, -0.5, 0.5, 1, 2]), y0 = ri(1, 9), h = rast([0.1, 0.2, 0.5]), n = ri(1, 4), yy = y0, satir = []; for (var i = 0; i < n; i++) { var yn = yy + h * a * yy; satir.push(y + B(i + 1) + ' = ' + sayi(yy) + ' + ' + h + '·(' + sayi(a * yy) + ') = ' + sayi(yn)); yy = yn; }
        return { metin: fx(y + '′ = ' + sayi(a) + y + ', &nbsp;' + y + '(0) = ' + y0 + ', &nbsp;<i>h</i> = ' + h) + L('. Euler ile ' + n + ' adım: yₙ = ?', '. ' + n + ' Euler steps: yₙ = ?'), dogru: yy, birim: '', s: y + B(n),
          ip: [fx(y + B('<i>n</i>+1') + ' = ' + y + B('<i>n</i>') + ' + <i>h f</i>(' + t + B('<i>n</i>') + ', ' + y + B('<i>n</i>') + ')'), fx(satir[0])], cozum: satir.map(function (q, i) { return adim(L('Adım ', 'Step ') + (i + 1), fx(q)); }) }; } },
    { id: 'lagrange-g', d: 'say', k: 'interp', f: 'lagrange-int', sev: 'orta', n: 9 * 9 * 9 * 5,
      u: function () { var a = rnz(-3, 3), b = ri(-4, 4), c = ri(-4, 4), P = function (q) { return a * q * q + b * q + c; }, xp = ri(3, 6);
        return { metin: L('Bir ikinci derece polinom (0, ' + P(0) + '), (1, ' + P(1) + '), (2, ' + P(2) + ') noktalarından geçiyor. p(' + xp + ') = ?', 'A quadratic passes through (0, ' + P(0) + '), (1, ' + P(1) + '), (2, ' + P(2) + '). p(' + xp + ') = ?'), dogru: P(xp), birim: '', s: '<i>p</i>(' + xp + ')',
          ip: [L('Bölünmüş farklar ya da Lagrange ile polinomu kur.', 'Build the polynomial with divided differences or Lagrange.'), fx('<i>p</i>(' + x + ') = ' + pol([[a, 2], [b, 1], [c, 0]]))], cozum: [adim(L('Farklar', 'Differences'), fx('Δ = ' + (P(1) - P(0)) + ', ' + (P(2) - P(1)) + '; Δ' + S(2) + ' = ' + (P(2) - 2 * P(1) + P(0)))), adim(L('Polinom', 'Polynomial'), fx('<i>p</i>(' + x + ') = ' + pol([[a, 2], [b, 1], [c, 0]]))), adim(L('Hesap', 'Compute'), fx('<i>p</i>(' + xp + ') = <b>' + P(xp) + '</b>'))] }; } },
    { id: 'merkezi-g', d: 'say', k: 'turev', f: 'merkezi-fark', sev: 'kolay', n: 7 * 4 * 5,
      u: function () { var x0 = ri(-3, 3), h = rast([0.5, 0.25, 0.1, 1]), a = rnz(-2, 2), P = function (q) { return a * q * q * q; }, v = (P(x0 + h) - P(x0 - h)) / (2 * h);
        return { metin: fx('<i>f</i>(' + x + ') = ' + pol([[a, 3]]) + ', &nbsp;' + x + B(0) + ' = ' + x0 + ', &nbsp;<i>h</i> = ' + h) + L('. Merkezi fark ile f′(x₀) ≈ ?', '. Central difference: f′(x₀) ≈ ?'), dogru: v, birim: '', s: '<i>f</i>′',
          ip: [fx(F('<i>f</i>(' + x + '+<i>h</i>) − <i>f</i>(' + x + '−<i>h</i>)', '2<i>h</i>')), fx('<i>f</i>(' + sayi(x0 + h) + ') = ' + sayi(P(x0 + h)) + ', <i>f</i>(' + sayi(x0 - h) + ') = ' + sayi(P(x0 - h)))], cozum: [adim(L('Değerler', 'Values'), fx(sayi(P(x0 + h)) + ', ' + sayi(P(x0 - h)))), adim(L('Fark', 'Difference'), fx(F(sayi(P(x0 + h)) + ' − (' + sayi(P(x0 - h)) + ')', 2 * h) + ' = <b>' + sayi(v) + '</b>'))] }; } }
  ];
  function mx(rows) { return '<span class="mx">' + rows.map(function (r) { return '<span>' + r.map(function (c) { return '<i>' + String(c).replace('-', '−') + '</i>'; }).join('') + '</span>'; }).join('') + '</span>'; }
  function Phi(z) { var tt = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * tt * (0.3193815 + tt * (-0.3565638 + tt * (1.781478 + tt * (-1.821256 + tt * 1.330274)))); return z > 0 ? 1 - p : p; }

  /* ---------- oran (orantı) üreticisi: her hesaplanabilir formül ---------- */
  var ADAY = [[0.25, '¼'], [0.5, '½'], [1 / Math.SQRT2, '1/√2'], [1, '1'], [Math.SQRT2, '√2'], [2, '2'], [4, '4'], [8, '8'], [1 / 8, '⅛']];
  function oranSoru(f, deg) {
    if (!f || !f.o || !f.v) return null;
    var v0 = {}; Object.keys(f.v).forEach(function (k) { v0[k] = deg && deg[k] != null ? deg[k] : f.v[k].val; });
    var r0 = f.o.f(v0); if (!isFinite(r0) || Math.abs(r0) < 1e-12) return null;
    var keys = karistir(Object.keys(f.v).slice());
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], kat = rast([2, 2, 0.5]), v1 = Object.assign({}, v0); v1[k] = v0[k] * kat; if (!v0[k] || f.v[k].u === '°') continue;
      var r1 = f.o.f(v1); if (!isFinite(r1)) continue; var oran = r1 / r0, aday = ADAY.filter(function (a) { return Math.abs(a[0] - oran) < 0.005 * Math.max(1, a[0]); })[0];
      if (!aday) continue;
      var sym = (function () { var tt = W.document.createElement('div'); tt.innerHTML = f.h; var el = tt.querySelector('[data-v="' + k + '"]'); return el ? el.innerHTML : k; })();
      var yazi = function (a) { return a[1] === '1' ? L('Değişmez', 'No change') : '× ' + a[1]; }, dogru = yazi(aday);
      var r = sik(dogru, ADAY.filter(function (a) { return a !== aday; }).map(yazi).sort(function () { return Math.random() - .5; }));
      var katY = kat === 2 ? L('iki katına çıkarsa', 'is doubled') : L('yarıya inerse', 'is halved');
      return { g: 'oran', f: f.id, metin: L('Diğer her şey aynı kalırken ', 'With everything else fixed, if ') + '<i class="fq-s">' + sym + '</i> (' + (dil() === 'en' ? f.v[k].en : f.v[k].tr) + ') ' + katY + ', <i class="fq-s">' + FO.os(f.o.s) + '</i> ' + L('nasıl değişir?', 'changes by what factor?'), mc: r.mc, dogruI: r.dogruI,
        ip: [L('Formülde bu değişkenin kuvvetine bak.', 'Look at the power of that variable in the formula.'), fx(f.h)], cozum: [adim(L('Formül', 'Formula'), fx(f.h)), adim(L('Oran', 'Ratio'), fx(F(sayi(r1), sayi(r0)) + ' = ' + sayi(oran))), adim(L('Sonuç', 'Result'), '<b>' + dogru + '</b>')] };
    }
    return null;
  }

  /* kavram sorusu: formül neyi verir / adı ne (hep şıklı, her formüle uyar) */
  function kavramSoru(f) {
    var ayni = FO.formuller.filter(function (x) { return x.d === f.d && x.id !== f.id; }), ad = function (o) { return dil() === 'en' ? (o.en || o.tr) : o.tr; };
    if (f.o) { var dg = ad(f.o), yan = karistir(ayni.filter(function (x) { return x.o && ad(x.o) !== dg; }).map(function (x) { return ad(x.o); })); var r = sik(dg, yan);
      return { g: 'kavram', f: f.id, metin: L('Tahtadaki formül hangi büyüklüğü verir?', 'Which quantity does this formula give?'), mc: r.mc, dogruI: r.dogruI, ip: [fx(f.h), L('Eşittirin solundaki simgeye bak.', 'Look at the symbol on the left.')], cozum: [adim(L('Sonuç', 'Answer'), '<b>' + dg + '</b>')] }; }
    var dn = ad(f), y2 = karistir(ayni.map(ad).filter(function (x) { return x !== dn; })), r2 = sik(dn, y2);
    return { g: 'kavram', f: f.id, metin: L('Tahtadaki ifadenin adı nedir?', 'What is this result called?'), mc: r2.mc, dogruI: r2.dogruI, ip: [fx(f.h || ''), ''], cozum: [adim(L('Sonuç', 'Answer'), '<b>' + dn + '</b>')] };
  }
  function bul(id) { for (var i = 0; i < FO.formuller.length; i++) if (FO.formuller[i].id === id) return FO.formuller[i]; return null; }
  /* eksi işaretleri tipografik: "-4" → "−4" (etiket ve sınıf adlarına dokunmaz) */
  function eksi(h) { return String(h).replace(/(^|[\s(>=,⟨\[·+])-(\d)/g, '$1−$2'); }
  function uret(g) { var q = g.u(); q.g = g.id; q.f = g.f; q.d = g.d; q.k = g.k; q.sev = g.sev; q.metin = eksi(q.metin); if (q.mc) q.mc = q.mc.map(eksi); q.ip = q.ip.map(eksi); q.cozum = q.cozum.map(function (a) { return { b: a.b, h: eksi(a.h) }; }); return q; }
  /* ara soru için şıklı bir soru: önce formülün, sonra konunun, sonra dersin üreticileri */
  function mcIcin(f) {
    var gruplar = [G.filter(function (g) { return g.f === f.id; }), G.filter(function (g) { return g.d === f.d && g.k === f.k; }), G.filter(function (g) { return g.d === f.d; })];
    for (var i = 0; i < 2; i++) { var a = karistir(gruplar[i].slice()); for (var j = 0; j < a.length; j++) for (var k = 0; k < 3; k++) { var q = uret(a[j]); if (q.mc) return q; } }
    return kavramSoru(f);
  }
  function havuz(ders, konu, sev) { return G.filter(function (g) { return g.d === ders && (!konu || g.k === konu) && (!sev || g.sev === sev); }); }
  /* formüle en yakın üretici: önce formülün kendisi, sonra konusu */
  function formulIcin(f) { var a = G.filter(function (g) { return g.f === f.id; }); if (!a.length) a = G.filter(function (g) { return g.d === f.d && g.k === f.k; }); return a.length ? uret(rast(a)) : null; }
  /* sayaç: üretici kombinasyonları + sayısal şablonların değer uzayı + oran soruları */
  function sayac(ders) {
    var n = 0; havuz(ders).forEach(function (g) { n += g.n; });
    FO.formuller.forEach(function (f) { if (f.d !== ders || !f.o) return; var m = 1; Object.keys(f.v).forEach(function (k) { m *= 21; }); n += Math.min(m, 1e7) * 2 + Object.keys(f.v).length * 2; });
    return n;
  }
  W.FORMULO_URET = { G: G, uret: uret, havuz: havuz, formulIcin: formulIcin, mcIcin: mcIcin, kavramSoru: kavramSoru, oranSoru: oranSoru, sayac: sayac, bul: bul };
})(window);
