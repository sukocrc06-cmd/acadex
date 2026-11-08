/* ==========================================================================
   FORMULO · "Acadia anlatsın" tebeşir dersi (formulo/assets/formulo-sahne.js), 08.11.2026
   Akış: formül tebeşirle yazılır, şekil çizgi çizgi çizilir → her terim renklenir,
   cetvel altına kayar, şekildeki karşılığına ok çizilir → sahne canlanır (değerler
   kaydırılabilir) → Acadia ara soru sorar ve cevabı bekler → örnek soru tahtaya
   yazılıp satır satır çözülür. Sesli anlatım (tarayıcı sesi) ve 0,75×/1×/1,5× hız.
   Her formülün bir sahnesi var: f.sh, yoksa dersin konusuna göre (KONU).
   Sahne: { ciz(v) → SVG, an(svg, v, t) canlandırma, soz: [tr, en] }. Önek fs-.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, FO = W.FORMULO;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RENK = ['#FFD86B', '#7FE3FF', '#FF9F5A', '#9BF0C0', '#F7A8FF', '#B9C6FF'];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function al(k, v) { try { var x = localStorage.getItem('formulo.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { try { localStorage.setItem('formulo.' + k, JSON.stringify(v)); } catch (e) { } }
  var Y = {
    tr: { baslik: 'Acadia anlatıyor', kapat: 'Kapat', geri: 'Önceki adım', ileri: 'Sonraki adım', oynat: 'Oynat', dur: 'Duraklat', adim: 'Adım', ses: 'Sesli anlatım', hiz: 'Hız',
      yaz: function (f) { return f.o ? 'Önce formülü tahtaya yazayım. Bu formül ' + f.o.tr + ' hesaplar.' : 'Önce formülü tahtaya yazayım: ' + f.tr + '.'; },
      degisken: function (s, a, d) { return s + ': ' + a + '. Şu an ' + d + '.'; },
      sonuc: function (s, a, d) { return 'Hepsi birleşince ' + s + ' = ' + d + '. Bu, ' + a + '.'; },
      canli: 'Şekle bak, hareket ediyor. Sağdaki cetvellerden değerleri kaydır; şekil de değişir.', ara: 'Küçük bir soru: ', araOk: 'Aynen öyle! Devam edelim.', araNo: 'Olmadı ama sorun değil. Doğrusu işaretli; devam edelim.',
      ornek: 'Şimdi bir örnek soru çözelim. Soruyu tahtaya yazıyorum.', tablo: 'Tablodaki satır: ', son: 'Bitti! Soru havuzunda benzerlerini çözebilirsin.', olcu: 'ölçü cetveli', cevapla: 'Cevabını seç, sonra devam ederiz.', soru: 'Soru', sonucY: 'sonuç' },
    en: { baslik: 'Acadia explains', kapat: 'Close', geri: 'Previous step', ileri: 'Next step', oynat: 'Play', dur: 'Pause', adim: 'Step', ses: 'Voice', hiz: 'Speed',
      yaz: function (f) { return f.o ? 'Let me write the formula first. It gives the ' + f.o.en + '.' : 'Let me write the formula first: ' + (f.en || f.tr) + '.'; },
      degisken: function (s, a, d) { return s + ': ' + a + '. Right now ' + d + '.'; },
      sonuc: function (s, a, d) { return 'Put together, ' + s + ' = ' + d + '. That is the ' + a + '.'; },
      canli: 'Watch the figure move. Slide the values on the right and the figure follows.', ara: 'Quick question: ', araOk: 'Exactly! Let’s go on.', araNo: 'Not quite, that’s fine. The right one is marked; let’s go on.',
      ornek: 'Now let’s solve an example. I’m writing the question on the board.', tablo: 'Table row: ', son: 'Done! Try similar ones in the question pool.', olcu: 'measuring ruler', cevapla: 'Pick an answer, then we continue.', soru: 'Question', sonucY: 'result' }
  };

  /* ---------- çizim yardımcıları (viewBox 0 0 320 200) ---------- */
  var OK = '<defs><marker id="fsUc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#EAF4FF"/></marker></defs>';
  function ok(x1, y1, x2, y2, r, et, ex, ey, a) { return '<g data-r="' + r + '"' + (a ? ' data-a="' + a + '"' : '') + '><line class="fs-ok" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" marker-end="url(#fsUc)"/>' + (et ? '<text x="' + ex + '" y="' + ey + '">' + et + '</text>' : '') + '</g>'; }
  function aralik(x1, x2, yy, r, et) { return '<g data-r="' + r + '"><path class="fs-ar" d="M' + x1 + ' ' + (yy - 5) + 'V' + (yy + 5) + 'M' + x1 + ' ' + yy + 'H' + x2 + 'M' + x2 + ' ' + (yy - 5) + 'V' + (yy + 5) + '"/><text x="' + (x1 + x2) / 2 + '" y="' + (yy + 16) + '" text-anchor="middle">' + et + '</text></g>'; }
  function dikey(xx, y1, y2, r, et) { return '<g data-r="' + r + '"><path class="fs-ar" d="M' + (xx - 5) + ' ' + y1 + 'H' + (xx + 5) + 'M' + xx + ' ' + y1 + 'V' + y2 + 'M' + (xx - 5) + ' ' + y2 + 'H' + (xx + 5) + '"/><text x="' + (xx + 9) + '" y="' + (y1 + y2) / 2 + '">' + et + '</text></g>'; }
  function yay(cx, cy, r, a1, a2, rol, et) {
    var p = function (a) { return [cx + r * Math.cos(-a * Math.PI / 180), cy + r * Math.sin(-a * Math.PI / 180)]; }, s = p(a1), e = p(a2), m = p((a1 + a2) / 2);
    return '<g data-r="' + rol + '"><path class="fs-ar" d="M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + 'A' + r + ' ' + r + ' 0 0 0 ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1) + '"/><text x="' + (m[0] + (m[0] - cx) * .45).toFixed(1) + '" y="' + (m[1] + (m[1] - cy) * .45 + 4).toFixed(1) + '" text-anchor="middle">' + et + '</text></g>';
  }
  function it(h) { return '<tspan font-style="italic">' + h + '</tspan>'; }
  function egriYol(fn, x0, x1, X, Yf, n) { var c = ''; n = n || 60; for (var i = 0; i <= n; i++) { var xx = x0 + (x1 - x0) * i / n; c += (i ? 'L' : 'M') + X(xx).toFixed(1) + ' ' + Yf(fn(xx)).toFixed(1); } return c; }
  function $a(svg, a) { return svg.querySelector('[data-a="' + a + '"]'); }
  function set(el, o) { if (el) for (var k in o) el.setAttribute(k, typeof o[k] === 'number' ? o[k].toFixed(1) : o[k]); }
  function sinir(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function oran(v, k, f, def) { if (!f || !f.v || !f.v[k] || v[k] == null) return def; var q = f.v[k]; return (v[k] - q.min) / ((q.max - q.min) || 1); }
  var zemin = '<line class="fs-zemin" x1="10" y1="168" x2="310" y2="168"/>';
  var EKSEN = '<path class="fs-zemin" d="M20 165H310M40 180V12"/>';

  var SAHNE = {
    atis: { soz: ['Top v₀ hızla, θ açısıyla fırlıyor; yerçekimi onu aşağı çekiyor ve R kadar ötede yere iniyor.', 'The ball leaves at v₀ and angle θ; gravity pulls it down and it lands R away.'],
      ciz: function (v) {
        var th = sinir(v.th || 45, 5, 85), r = th * Math.PI / 180, hp = Math.min(140, 240 * Math.tan(r) / 4);
        return zemin + '<path class="fs-cizgi fs-kesik" d="M30 168Q150 ' + (168 - 2 * hp).toFixed(1) + ' 270 168"/>' +
          ok(30, 168, 30 + 60 * Math.cos(r), 168 - 60 * Math.sin(r), 'v0', it('v') + '₀', 36 + 60 * Math.cos(r), 160 - 60 * Math.sin(r)) +
          yay(30, 168, 30, 0, th, 'th', 'θ') + ok(290, 40, 290, 80, 'g', it('g'), 298, 66) + aralik(30, 270, 182, 'R', it('R')) +
          '<path class="fs-iz" data-a="iz" d="M30 168"/><circle class="fs-top" data-a="top" cx="30" cy="168" r="7"/>';
      },
      an: function (s, v, t) { var th = sinir(v.th || 45, 5, 85) * Math.PI / 180, hp = Math.min(140, 240 * Math.tan(th) / 4), u = (t % 2.6) / 2.2; if (u > 1) u = 1; var x = 30 + 240 * u, y = 168 - 4 * hp * u * (1 - u);
        set($a(s, 'top'), { cx: x, cy: y }); var d = 'M30 168'; for (var i = 1; i <= 20; i++) { var w = u * i / 20; d += 'L' + (30 + 240 * w).toFixed(1) + ' ' + (168 - 4 * hp * w * (1 - w)).toFixed(1); } set($a(s, 'iz'), { d: d }); } },
    kutu: { soz: ['Kutuya F kuvveti uygulanıyor; net kuvvet onu a ivmesiyle hızlandırıyor, sürtünme ise yavaşlatıyor.', 'Force F acts on the box; the net force accelerates it at a while friction resists.'],
      ciz: function (v) { var th = sinir(v.th || 0, 0, 60), r = th * Math.PI / 180;
        return zemin + '<g data-a="kutu"><rect class="fs-cizgi" data-r="m" x="80" y="118" width="70" height="50" rx="3"/><text x="115" y="148" text-anchor="middle" data-r="m">m</text>' +
          ok(150, 143, 150 + 70 * Math.cos(r), 143 - 70 * Math.sin(r), 'F', it('F'), 156 + 70 * Math.cos(r), 138 - 70 * Math.sin(r)) + (th ? yay(150, 143, 24, 0, th, 'th', 'θ') : '<g data-r="th"></g>') +
          ok(115, 110, 115, 56, 'N', it('N'), 122, 66) + ok(80, 160, 40, 160, 'mk', 'μ<tspan font-size="10">k</tspan>', 34, 150) + ok(90, 100, 140, 100, 'a', it('a'), 146, 104) + '</g>' + aralik(80, 300, 186, 'd', it('d'));
      },
      an: function (s, v, t) { var u = (t % 3) / 2.4; if (u > 1) u = 1; set($a(s, 'kutu'), { transform: 'translate(' + (150 * u * u).toFixed(1) + ' 0)' }); } },
    rampa: { soz: ['Blok eğik düzlemde kayıyor: yerçekiminin eğim boyunca bileşeni onu iter, sürtünme frenler.', 'The block slides down: gravity’s component along the slope pushes, friction brakes.'],
      ciz: function (v) {
        var th = sinir(v.th || 30, 8, 60), r = th * Math.PI / 180, hy = Math.max(30, 168 - 260 * Math.tan(r)), hx = 30 + (168 - hy) / Math.tan(r);
        return zemin + '<path class="fs-cizgi" d="M30 168L' + hx.toFixed(1) + ' 168L' + hx.toFixed(1) + ' ' + hy.toFixed(1) + 'Z" data-r="mk"/>' + yay(30, 168, 38, 0, th, 'th', 'θ') +
          '<g data-a="blok"><rect class="fs-cizgi" data-r="m" x="-20" y="-30" width="40" height="30" rx="2"/></g>' + ok(hx - 40, 40, hx - 40, 86, 'g', it('g'), hx - 32, 70) +
          '<g data-r="a"><text data-a="at" x="0" y="0">' + it('a') + ' ↙</text></g>';
      },
      an: function (s, v, t) { var th = sinir(v.th || 30, 8, 60), r = th * Math.PI / 180, hy = Math.max(30, 168 - 260 * Math.tan(r)), hx = 30 + (168 - hy) / Math.tan(r), u = (t % 3) / 2.4; if (u > 1) u = 1; var k = 0.92 - 0.75 * u * u, bx = 30 + (hx - 30) * k, by = 168 - (168 - hy) * k;
        set($a(s, 'blok'), { transform: 'translate(' + bx.toFixed(1) + ' ' + by.toFixed(1) + ') rotate(' + (-th) + ')' }); set($a(s, 'at'), { x: bx - 40, y: by + 8 }); } },
    sarkac: { soz: ['Sarkaç ip boyu L ve yerçekimi g ile belirlenen bir ritimde gidip geliyor.', 'The pendulum swings with a rhythm set by the length L and gravity g.'],
      ciz: function (v, f) { var L = 70 + 70 * sinir(oran(v, 'L', f, .5), 0, 1);
        return '<line class="fs-zemin" x1="110" y1="22" x2="210" y2="22"/><line class="fs-cizgi fs-kesik" x1="160" y1="22" x2="160" y2="180"/>' +
          '<g data-a="kol"><g data-r="L"><line class="fs-cizgi" x1="160" y1="22" x2="160" y2="' + (22 + L) + '"/><text x="166" y="' + (22 + L / 2) + '">' + it('L') + '</text></g><circle class="fs-top" data-r="m" cx="160" cy="' + (22 + L) + '" r="11"/></g>' +
          yay(160, 22, 40, -90, -66, 'th', 'θ') + '<path class="fs-ar fs-kesik" data-r="T" d="M' + (160 - L * .42) + ' ' + (22 + L * .9) + 'Q160 ' + (22 + L * 1.15) + ' ' + (160 + L * .42) + ' ' + (22 + L * .9) + '"/>' + ok(270, 60, 270, 110, 'g', it('g'), 278, 90);
      },
      an: function (s, v, t) { var T = sinir(2 * Math.PI * Math.sqrt((v.L || 1) / (v.g || 9.81)), .8, 4), a = 25 * Math.cos(2 * Math.PI * t / T); set($a(s, 'kol'), { transform: 'rotate(' + a.toFixed(2) + ' 160 22)' }); } },
    yay: { soz: ['Kütle yayın ucunda salınıyor; yay sertleştikçe ya da kütle hafifledikçe salınım hızlanır.', 'The mass oscillates on the spring; stiffer spring or lighter mass means faster motion.'],
      ciz: function () { return zemin + '<line class="fs-zemin" x1="30" y1="60" x2="30" y2="168"/><path class="fs-cizgi" data-r="k" data-a="yay" d="M30 110H160"/><text x="90" y="88" text-anchor="middle" data-r="k">' + it('k') + '</text>' +
          '<g data-a="kutle"><rect class="fs-cizgi" data-r="m" x="160" y="84" width="56" height="52" rx="3"/><text x="188" y="115" text-anchor="middle" data-r="m">m</text></g>' +
          '<line class="fs-cizgi fs-kesik" x1="160" y1="70" x2="160" y2="168"/>' + aralik(160, 205, 156, 'x', it('x') + ' · ' + it('A')) +
          '<g data-r="c"><path class="fs-cizgi" d="M30 150H70M70 142V158M76 144H100M76 156H100M76 144V156"/></g>' +
          '<g data-r="w"><path class="fs-ar" d="M262 70a22 22 0 1 1 -2 -14" marker-end="url(#fsUc)"/><text x="274" y="96">ω</text></g>'; },
      an: function (s, v, t) { var w = sinir(Math.sqrt((v.k || 100) / (v.m || 1)), 1.5, 7), sn = v.c && v.k && v.m ? Math.exp(-v.c / (2 * v.m) * (t % 8)) : 1, x = 34 * Math.cos(w * t * .6) * sn, z = 'M30 110'; for (var i = 0; i < 9; i++) z += 'L' + (44 + i * (12 + x / 10)).toFixed(1) + ' ' + (i % 2 ? 122 : 98); z += 'L' + (160 + x).toFixed(1) + ' 110';
        set($a(s, 'yay'), { d: z }); set($a(s, 'kutle'), { transform: 'translate(' + x.toFixed(1) + ' 0)' }); } },
    devre: { soz: ['Pil devreye enerji veriyor; akım I direnç, sığaç ve bobin üzerinden dolaşıyor.', 'The battery drives current I around through the resistor, capacitor and coil.'],
      ciz: function () {
        return '<path class="fs-cizgi" d="M40 40H280V160H40Z"/>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return '<circle class="fs-elektron" data-a="e' + i + '" r="3.5"/>'; }).join('') +
          '<g data-r="V"><rect x="30" y="80" width="20" height="40" fill="#123a2e"/><path class="fs-cizgi" d="M28 92H52M34 104H46M28 112H52"/><text x="10" y="104">ε</text></g>' +
          '<g data-r="R"><rect x="110" y="30" width="80" height="20" fill="#123a2e"/><path class="fs-cizgi" d="M110 40L118 30L130 50L142 30L154 50L166 30L178 50L190 40"/><text x="150" y="22" text-anchor="middle">' + it('R') + '</text></g>' +
          '<g data-r="C"><rect x="270" y="86" width="20" height="28" fill="#123a2e"/><path class="fs-cizgi" d="M262 94H298M262 106H298"/><text x="302" y="104">' + it('C') + '</text></g>' +
          '<g data-r="L"><rect x="120" y="150" width="80" height="20" fill="#123a2e"/><path class="fs-cizgi" d="M120 160a10 10 0 0 1 20 0a10 10 0 0 1 20 0a10 10 0 0 1 20 0a10 10 0 0 1 20 0"/><text x="160" y="188" text-anchor="middle">' + it('L') + '</text></g>' +
          ok(60, 74, 60, 54, 'I', it('I'), 66, 70) + '<g data-r="R2"><path class="fs-cizgi fs-kesik" d="M110 40V80H190V40"/><text x="150" y="96" text-anchor="middle">' + it('R') + '₂</text></g>';
      },
      an: function (s, v, t) { var hz = sinir((v.I || 1) * .15 + .12, .08, .5), P = 720; for (var i = 0; i < 10; i++) { var q = ((t * hz + i / 10) % 1) * P, x, y; if (q < 240) { x = 40 + q; y = 40; } else if (q < 360) { x = 280; y = 40 + q - 240; } else if (q < 600) { x = 280 - (q - 360); y = 160; } else { x = 40; y = 160 - (q - 600); } set($a(s, 'e' + i), { cx: x, cy: y }); } } },
    yukler: { soz: ['İki yük birbirini r uzaklıktan itiyor ya da çekiyor; aradaki alan çizgileri akıyor.', 'Two charges push or pull across distance r; field lines flow between them.'],
      ciz: function (v) { var q2n = (v.q2 || 1) < 0;
        return '<g data-r="E"><path class="fs-ar fs-akis" d="M98 92Q160 56 222 92M98 108Q160 144 222 108M96 100H224"/></g>' +
          '<g data-r="q1"><g data-a="q1"><circle class="fs-top" cx="80" cy="100" r="18"/><text x="80" y="105" text-anchor="middle" class="fs-koyu">' + ((v.q1 || v.q || 1) < 0 ? '−' : '+') + '</text></g><text x="80" y="140" text-anchor="middle">' + it('q') + '₁</text></g>' +
          '<g data-r="q2"><g data-a="q2"><circle class="fs-top fs-top2" cx="240" cy="100" r="18"/><text x="240" y="105" text-anchor="middle" class="fs-koyu">' + (q2n ? '−' : '+') + '</text></g><text x="240" y="140" text-anchor="middle">' + it('q') + '₂</text></g>' +
          aralik(80, 240, 168, 'r', it('r')) + ok(262, 100, 304, 100, 'F', it('F'), 292, 90);
      },
      an: function (s, v, t) { var k = 1 + .08 * Math.sin(t * 4); set($a(s, 'q1'), { transform: 'translate(80 100) scale(' + k.toFixed(3) + ') translate(-80 -100)' }); set($a(s, 'q2'), { transform: 'translate(240 100) scale(' + (2 - k).toFixed(3) + ') translate(-240 -100)' }); } },
    egri: { soz: ['Nokta eğri boyunca kayıyor; her yerde teğetin eğimi o noktadaki türev.', 'The point slides along the curve; the tangent slope there is the derivative.'],
      ciz: function () { var X = function (x) { return 40 + (x + 1) * 50; }, Yf = function (y) { return 165 - y * 14; };
        return EKSEN + '<path class="fs-cizgi" d="' + egriYol(function (x) { return x * x; }, -1, 3, X, Yf) + '"/>' +
          '<g data-r="a"><circle class="fs-top" cx="' + X(1) + '" cy="' + Yf(1) + '" r="5"/><text x="' + X(1) + '" y="180" text-anchor="middle">' + it('a') + '</text></g>' +
          '<g data-r="b"><circle class="fs-top" cx="' + X(2.6) + '" cy="' + Yf(6.76) + '" r="5"/><text x="' + X(2.6) + '" y="180" text-anchor="middle">' + it('b') + '</text></g>' +
          '<line class="fs-ar" data-r="m" data-a="teg" x1="0" y1="0" x2="0" y2="0"/><circle class="fs-top fs-top2" data-r="x" data-a="nok" r="6"/>' + aralik(X(2), X(2.6), 24, 'h', it('h'));
      },
      an: function (s, v, t) { var X = function (x) { return 40 + (x + 1) * 50; }, Yf = function (y) { return 165 - y * 14; }, x0 = -.6 + 3.2 * (.5 - .5 * Math.cos(t * .9)), m = 2 * x0, y0 = x0 * x0;
        set($a(s, 'nok'), { cx: X(x0), cy: Yf(y0) }); set($a(s, 'teg'), { x1: X(x0 - .8), y1: Yf(y0 - .8 * m), x2: X(x0 + .8), y2: Yf(y0 + .8 * m) }); } },
    kesen: { soz: ['h küçüldükçe iki nokta birbirine yaklaşıyor; kesen doğru dönerek teğete oturuyor.', 'As h shrinks the two points close in; the secant rotates onto the tangent.'],
      ciz: function () { var X = function (x) { return 40 + (x + .5) * 62; }, Yf = function (y) { return 168 - y * 16; };
        return EKSEN + '<path class="fs-cizgi" d="' + egriYol(function (x) { return x * x; }, -.5, 3.2, X, Yf) + '"/>' +
          '<line class="fs-ar fs-kesik" x1="' + X(.2) + '" y1="' + Yf(2 * .2 - 1) + '" x2="' + X(2.4) + '" y2="' + Yf(2 * 2.4 - 1) + '"/>' +
          '<line class="fs-ok" data-a="kes" x1="0" y1="0" x2="0" y2="0"/><circle class="fs-top" cx="' + X(1) + '" cy="' + Yf(1) + '" r="5"/><text x="' + (X(1) - 8) + '" y="' + (Yf(1) - 10) + '" text-anchor="end">' + it('x') + '</text>' +
          '<circle class="fs-top fs-top2" data-a="b" r="5"/><g data-r="h"><path class="fs-ar" data-a="h" d="M0 0"/><text data-a="ht" x="0" y="186" text-anchor="middle">' + it('h') + '</text></g>' +
          '<text data-a="eg" x="60" y="24" class="fs-not"></text>';
      },
      an: function (s, v, t) { var X = function (x) { return 40 + (x + .5) * 62; }, Yf = function (y) { return 168 - y * 16; }, u = (t % 4.5) / 4, h = 1.9 * Math.pow(Math.max(0, 1 - Math.min(u, 1)), 1.4) + .02, b = 1 + h, m = (b * b - 1) / h;
        set($a(s, 'b'), { cx: X(b), cy: Yf(b * b) }); set($a(s, 'kes'), { x1: X(1 - .9), y1: Yf(1 - .9 * m), x2: X(b + .3), y2: Yf(b * b + .3 * m) });
        set($a(s, 'h'), { d: 'M' + X(1).toFixed(1) + ' 174H' + X(b).toFixed(1) }); set($a(s, 'ht'), { x: (X(1) + X(b)) / 2 }); var eg = $a(s, 'eg'); if (eg) eg.textContent = 'm = ' + (W.FORMULO_APP ? W.FORMULO_APP.sayi(+m.toFixed(2)) : m.toFixed(2)) + ' → 2'; } },
    limit: { soz: ['İki taraftan x, a’ya yaklaşıyor; fonksiyon o noktada tanımsız olsa bile değerler L’ye gidiyor.', 'x approaches a from both sides; the values head to L even if f(a) is undefined.'],
      ciz: function () { var X = function (x) { return 40 + x * 60; }, Yf = function (y) { return 168 - y * 30; };
        return EKSEN + '<path class="fs-cizgi" d="' + egriYol(function (x) { return x / 2 + 1; }, 0, 4.4, X, Yf) + '"/><circle cx="' + X(2) + '" cy="' + Yf(2) + '" r="6" class="fs-delik"/>' +
          '<line class="fs-ar fs-kesik" x1="' + X(2) + '" y1="165" x2="' + X(2) + '" y2="' + Yf(2) + '"/><line class="fs-ar fs-kesik" x1="40" y1="' + Yf(2) + '" x2="' + X(2) + '" y2="' + Yf(2) + '"/>' +
          '<text x="' + X(2) + '" y="182" text-anchor="middle">' + it('a') + '</text><text x="32" y="' + (Yf(2) + 4) + '" text-anchor="end">' + it('L') + '</text>' +
          '<circle class="fs-top" data-a="p1" r="5"/><circle class="fs-top fs-top2" data-a="p2" r="5"/>';
      },
      an: function (s, v, t) { var X = function (x) { return 40 + x * 60; }, Yf = function (y) { return 168 - y * 30; }, u = Math.min(1, (t % 4) / 3.4), d = 1.8 * (1 - u) + .06;
        set($a(s, 'p1'), { cx: X(2 - d), cy: Yf((2 - d) / 2 + 1) }); set($a(s, 'p2'), { cx: X(2 + d), cy: Yf((2 + d) / 2 + 1) }); } },
    alan: { soz: ['Alanı ince dikdörtgenlerle dolduruyoruz; sayıları arttıkça toplam gerçek alana yaklaşıyor.', 'We fill the area with thin rectangles; more of them gets closer to the true area.'],
      ciz: function () { var X = function (x) { return 40 + x * 42; }, Yf = function (y) { return 165 - y * 15; }, fn = function (x) { return x * x / 4 + .5; };
        var q = 'M' + X(.5) + ' 165' + egriYol(fn, .5, 3, X, Yf, 30).replace('M', 'L') + 'L' + X(3) + ' 165Z';
        return EKSEN + '<path class="fs-alan" d="' + q + '"/><g data-r="n" data-a="dik"></g><path class="fs-cizgi" d="' + egriYol(fn, 0, 6, X, Yf) + '"/>' +
          '<g data-r="a"><line class="fs-ar" x1="' + X(.5) + '" y1="165" x2="' + X(.5) + '" y2="' + Yf(fn(.5)) + '"/><text x="' + X(.5) + '" y="181" text-anchor="middle">' + it('a') + '</text></g>' +
          '<g data-r="b"><line class="fs-ar" x1="' + X(3) + '" y1="165" x2="' + X(3) + '" y2="' + Yf(fn(3)) + '"/><text x="' + X(3) + '" y="181" text-anchor="middle">' + it('b') + '</text></g><text data-a="nt" x="300" y="28" text-anchor="end" class="fs-not"></text>';
      },
      an: function (s, v, t) { var n = [2, 3, 4, 6, 8, 12, 16, 24][Math.floor(t / .9) % 8], g = $a(s, 'dik'); if (!g || g.__n === n) return; g.__n = n; var X = function (x) { return 40 + x * 42; }, Yf = function (y) { return 165 - y * 15; }, w = 2.5 / n, h = '';
        for (var j = 0; j < n; j++) { var x0 = .5 + j * w, yy = Yf((x0 + w / 2) * (x0 + w / 2) / 4 + .5); h += '<rect class="fs-dik" x="' + X(x0).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + (w * 42).toFixed(1) + '" height="' + (165 - yy).toFixed(1) + '"/>'; } g.innerHTML = h; $a(s, 'nt').textContent = 'n = ' + n; } },
    disk: { soz: ['Eğri x ekseni etrafında dönüyor; her dilim bir disk, hacim disklerin toplamı.', 'The curve spins about the x-axis; each slice is a disk, volume is their sum.'],
      ciz: function () { var X = function (x) { return 40 + x * 26; }, Yf = function (y) { return 100 - y * 26; };
        return '<path class="fs-zemin" d="M20 100H310"/><path class="fs-cizgi" d="' + egriYol(Math.sqrt, 0, 9, X, Yf) + '"/><path class="fs-cizgi fs-kesik" d="' + egriYol(function (x) { return -Math.sqrt(x); }, 0, 9, X, Yf) + '"/>' +
          [1.5, 3, 4.5, 6, 7.5].map(function (x, i) { return '<ellipse class="fs-dik" data-a="d' + i + '" cx="' + X(x) + '" cy="100" rx="6" ry="' + (Math.sqrt(x) * 26).toFixed(1) + '"/>'; }).join('');
      },
      an: function (s, v, t) { for (var i = 0; i < 5; i++) set($a(s, 'd' + i), { rx: 3 + 7 * Math.abs(Math.sin(t * 1.4 + i * .5)) }); } },
    dagilim: { soz: ['Çan eğrisinin altındaki taralı alan, x’e kadar olan olasılık; x kaydıkça alan büyüyor.', 'The shaded area under the bell is the probability up to x; it grows as x moves.'],
      ciz: function () { var X = function (z) { return 160 + z * 45; }, Yf = function (p) { return 160 - 120 * p; }, fn = function (z) { return Math.exp(-z * z / 2); };
        return '<path class="fs-zemin" d="M10 160H310"/><path class="fs-alan" data-a="tar" d="M0 0"/><path class="fs-cizgi" d="' + egriYol(fn, -3, 3, X, Yf) + '"/>' +
          '<g data-r="mu"><line class="fs-ar fs-kesik" x1="160" y1="160" x2="160" y2="34"/><text x="160" y="176" text-anchor="middle">μ</text></g>' + aralik(160, 205, 22, 'sg', 'σ') +
          '<g data-r="x"><line class="fs-ar" data-a="xl" x1="0" y1="160" x2="0" y2="40"/><text data-a="xt" x="0" y="176" text-anchor="middle">' + it('x') + '</text></g><g data-r="z"><text data-a="zt" x="300" y="40" text-anchor="end" class="fs-not"></text></g>' +
          '<g data-r="xb"><circle class="fs-top" cx="174" cy="160" r="4"/></g><g data-r="n"></g>' + aralik(118, 202, 186, 'E', it('E'));
      },
      an: function (s, v, t) { var X = function (z) { return 160 + z * 45; }, Yf = function (p) { return 160 - 120 * p; }, z = -2.6 + 5 * (.5 - .5 * Math.cos(t * .7)), d = 'M' + X(-3) + ' 160';
        for (var i = 0; i <= 40; i++) { var zz = -3 + (z + 3) * i / 40; d += 'L' + X(zz).toFixed(1) + ' ' + Yf(Math.exp(-zz * zz / 2)).toFixed(1); } d += 'L' + X(z).toFixed(1) + ' 160Z';
        set($a(s, 'tar'), { d: d }); set($a(s, 'xl'), { x1: X(z), x2: X(z) }); set($a(s, 'xt'), { x: X(z) }); var zt = $a(s, 'zt'); if (zt) zt.textContent = 'z = ' + z.toFixed(1); } },
    ustel: { soz: ['Değişim hızı mevcut miktarla orantılı; bu yüzden eğri önce hızlı, sonra yavaş değişiyor.', 'The rate is proportional to the amount, so the curve changes fast first, then slowly.'],
      ciz: function () { return EKSEN + '<path class="fs-cizgi" d="' + egriYol(function (x) { return 1 - Math.exp(-4 * x); }, 0, 1, function (x) { return 40 + x * 260; }, function (y) { return 60 + 100 * y; }) + '"/>' +
          '<g data-r="y0"><circle class="fs-top" cx="40" cy="60" r="6"/><text x="48" y="50">' + it('y') + '₀</text></g><g data-r="Ts"><line class="fs-ar fs-kesik" x1="40" y1="160" x2="300" y2="160"/><text x="270" y="152">∞</text></g>' +
          '<g data-r="t"><line class="fs-ar fs-kesik" data-a="tl" x1="0" y1="165" x2="0" y2="0"/><text data-a="tt" x="0" y="181" text-anchor="middle">' + it('t') + '</text></g><circle class="fs-top fs-top2" data-a="p" r="6"/>' +
          '<g data-r="k"><text x="60" y="118">' + it('k') + '</text></g>'; },
      an: function (s, v, t) { var x = (t % 4) / 4, X = 40 + x * 260, Yv = 60 + 100 * (1 - Math.exp(-4 * x)); set($a(s, 'p'), { cx: X, cy: Yv }); set($a(s, 'tl'), { x1: X, x2: X, y2: Yv }); set($a(s, 'tt'), { x: X }); } },
    buyume: { soz: ['Miktar büyüdükçe büyüme de hızlanıyor; lojistikte ise tavana yaklaşınca yavaşlıyor.', 'Growth speeds up with the amount; in the logistic case it slows near the ceiling.'],
      ciz: function () { return EKSEN + '<path class="fs-cizgi" d="' + egriYol(function (x) { return 1 - Math.exp(-4 * x); }, 0, 1, function (x) { return 40 + x * 260; }, function (y) { return 160 - 110 * y; }) + '"/>' +
          '<g data-r="y0"><circle class="fs-top" cx="40" cy="160" r="6"/><text x="48" y="150">' + it('y') + '₀</text></g><g data-r="Ts"><line class="fs-ar fs-kesik" x1="40" y1="50" x2="300" y2="50"/><text x="270" y="42">' + it('K') + '</text></g>' +
          '<g data-r="t"><line class="fs-ar fs-kesik" data-a="tl" x1="0" y1="165" x2="0" y2="0"/><text data-a="tt" x="0" y="181" text-anchor="middle">' + it('t') + '</text></g><circle class="fs-top fs-top2" data-a="p" r="6"/>' +
          '<g data-r="k"><text x="58" y="112">' + it('k') + '</text></g>'; },
      an: function (s, v, t) { var x = (t % 4) / 4, X = 40 + x * 260, Yv = 160 - 110 * (1 - Math.exp(-4 * x)); set($a(s, 'p'), { cx: X, cy: Yv }); set($a(s, 'tl'), { x1: X, x2: X, y2: Yv }); set($a(s, 'tt'), { x: X }); } },
    carpisma: { soz: ['Arabalar çarpışıyor; toplam momentum çarpışmadan önce ve sonra aynı kalıyor.', 'The carts collide; total momentum is the same before and after.'],
      ciz: function () { var ar = function (r, x, et) { return '<g data-r="' + r + '"><g data-a="' + r + '"><rect class="fs-cizgi" x="' + x + '" y="120" width="70" height="36" rx="4"/><circle class="fs-cizgi" cx="' + (x + 16) + '" cy="162" r="6"/><circle class="fs-cizgi" cx="' + (x + 54) + '" cy="162" r="6"/><text x="' + (x + 35) + '" y="143" text-anchor="middle">' + et + '</text></g></g>'; };
        return zemin + ar('m1', 20, it('m') + '₁') + ar('m2', 200, it('m') + '₂') + ok(30, 100, 90, 100, 'v1', it('v') + '₁', 94, 104, 'o1') + ok(260, 100, 230, 100, 'v2', it('v') + '₂', 214, 92, 'o2'); },
      an: function (s, v, t) { var u = (t % 4) / 4, x1, x2; if (u < .5) { var k = u / .5; x1 = 90 * k; x2 = -20 * k; } else { var k2 = (u - .5) / .5; x1 = 90 + 50 * k2; x2 = -20 + 50 * k2 + (v.m1 && v.m2 && v.m1 < v.m2 ? 0 : 30 * k2); }
        set($a(s, 'm1'), { transform: 'translate(' + x1.toFixed(1) + ' 0)' }); set($a(s, 'm2'), { transform: 'translate(' + x2.toFixed(1) + ' 0)' }); set($a(s, 'o1'), { transform: 'translate(' + x1.toFixed(1) + ' 0)' }); set($a(s, 'o2'), { transform: 'translate(' + x2.toFixed(1) + ' 0)' }); } },
    yol: { soz: ['Araç x₀’dan v hızıyla çıkıyor, a ivmesiyle hızlanıyor; aldığı yol zamanla karesel artıyor.', 'The car starts at x₀ with speed v and accelerates at a; distance grows with t².'],
      ciz: function () { return zemin + '<line class="fs-zemin fs-kesik" x1="10" y1="180" x2="310" y2="180"/>' +
          '<g data-a="araba"><g data-r="m"><path class="fs-cizgi" d="M40 150h70l14 12v6H32v-8z"/><circle class="fs-cizgi" cx="54" cy="168" r="7"/><circle class="fs-cizgi" cx="104" cy="168" r="7"/></g>' + ok(70, 128, 130, 128, 'v0', it('v'), 136, 132) + ok(70, 110, 105, 110, 'a', it('a'), 110, 114) + '</g>' +
          '<g data-r="x0"><line class="fs-ar" x1="40" y1="140" x2="40" y2="184"/><text x="40" y="134" text-anchor="middle">' + it('x') + '₀</text></g>' + aralik(40, 290, 30, 'dx', 'Δ' + it('x')) +
          '<g data-r="t"><circle class="fs-cizgi" cx="280" cy="90" r="18"/><path class="fs-cizgi" data-a="ibre" d="M280 90V76"/><text x="304" y="94">' + it('t') + '</text></g>'; },
      an: function (s, v, t) { var u = (t % 3.5) / 3; if (u > 1) u = 1; var x = 40 * u + 130 * u * u; set($a(s, 'araba'), { transform: 'translate(' + x.toFixed(1) + ' 0)' }); set($a(s, 'ibre'), { transform: 'rotate(' + (u * 360).toFixed(0) + ' 280 90)' }); } },
    yukseklik: { soz: ['Cisim h yüksekliğinden düşüyor; potansiyel enerjisi hızla kinetik enerjiye dönüyor.', 'The body falls from height h; potential energy turns into kinetic energy.'],
      ciz: function () { return zemin + '<path class="fs-cizgi" d="M30 168V40H110V168"/><path class="fs-zemin" d="M110 40H140"/>' +
          '<g data-a="cisim"><rect class="fs-cizgi" data-r="m" x="120" y="22" width="18" height="18" rx="2"/></g><line class="fs-cizgi fs-kesik" x1="129" y1="40" x2="129" y2="160"/>' + dikey(170, 40, 168, 'h', it('h')) +
          ok(230, 50, 230, 100, 'g', it('g'), 238, 80) + '<g data-r="v"><line class="fs-ok" data-a="hv" x1="129" y1="0" x2="129" y2="0" marker-end="url(#fsUc)"/></g>' +
          '<g data-r="t"><circle class="fs-cizgi" cx="270" cy="140" r="16"/><path class="fs-cizgi" data-a="ibre" d="M270 140V128"/></g>'; },
      an: function (s, v, t) { var u = (t % 2.6) / 1.8; if (u > 1) u = 1; var y = 128 * u * u; set($a(s, 'cisim'), { transform: 'translate(0 ' + y.toFixed(1) + ')' }); set($a(s, 'hv'), { y1: 46 + y, y2: 46 + y + 4 + 36 * u }); set($a(s, 'ibre'), { transform: 'rotate(' + (u * 360).toFixed(0) + ' 270 140)' }); } },
    levha: { soz: ['Levhalar arasında düzgün bir alan var; arayı daraltınca ya da alanı büyütünce sığa artar.', 'There’s a uniform field between the plates; closer or larger plates hold more charge.'],
      ciz: function () { return '<g data-r="A"><path class="fs-cizgi" d="M90 30L120 50V170L90 150Z"/><path class="fs-cizgi" d="M200 30L230 50V170L200 150Z"/><text x="70" y="30">' + it('A') + '</text></g>' +
          '<g data-r="kap"><path class="fs-alan" d="M128 46L192 46V154L128 154Z"/><text x="160" y="40" text-anchor="middle">κ</text></g>' +
          '<g data-r="E">' + [70, 100, 130].map(function (y) { return '<line class="fs-ar fs-akis" x1="124" y1="' + y + '" x2="196" y2="' + y + '" marker-end="url(#fsUc)"/>'; }).join('') + '<text x="160" y="148" text-anchor="middle">' + it('E') + '</text></g>' + aralik(105, 215, 182, 'd', it('d')); } },
    seri: { soz: ['Her yeni terim bir öncekinden küçük; kısmi toplamlar bir sınıra yaklaşıp orada duruyor.', 'Each new term is smaller; the partial sums creep toward a limit.'],
      ciz: function () { return EKSEN + '<line class="fs-ar fs-kesik" x1="40" y1="45" x2="310" y2="45"/><text x="306" y="38" text-anchor="end">' + it('S') + '</text><g data-a="cub"></g><text data-a="nt" x="300" y="194" text-anchor="end" class="fs-not"></text>'; },
      an: function (s, v, t) { var n = 1 + Math.floor((t % 7) / .55), g = $a(s, 'cub'); if (!g || g.__n === n) return; g.__n = n; var h = '', S = 0; for (var i = 1; i <= Math.min(n, 12); i++) { S += Math.pow(.5, i); var top = 165 - 120 * S; h += '<rect class="fs-dik" x="' + (46 + (i - 1) * 21) + '" y="' + top.toFixed(1) + '" width="16" height="' + (165 - top).toFixed(1) + '"/>'; } g.innerHTML = h; $a(s, 'nt').textContent = 'S' + Math.min(n, 12) + ' = ' + S.toFixed(4); } },
    kutup: { soz: ['θ döndükçe r değişiyor ve eğri kutupsal düzlemde kendi kendini çiziyor.', 'As θ turns, r changes and the curve draws itself in the polar plane.'],
      ciz: function () { return '<circle class="fs-zemin" cx="160" cy="100" r="40"/><circle class="fs-zemin" cx="160" cy="100" r="80"/><path class="fs-zemin" d="M60 100H260M160 10V190"/><path class="fs-cizgi" data-a="gul" d="M160 100"/><line class="fs-ar" data-r="r" data-a="ray" x1="160" y1="100" x2="160" y2="100"/>'; },
      an: function (s, v, t) { var u = (t % 6) / 5; if (u > 1) u = 1; var d = '', th = 0; for (var i = 0; i <= 120 * u; i++) { th = i / 120 * Math.PI * 2; var r = 80 * Math.cos(3 * th); d += (i ? 'L' : 'M') + (160 + r * Math.cos(th)).toFixed(1) + ' ' + (100 - r * Math.sin(th)).toFixed(1); }
        set($a(s, 'gul'), { d: d || 'M160 100' }); var r2 = 80 * Math.cos(3 * th); set($a(s, 'ray'), { x2: 160 + r2 * Math.cos(th), y2: 100 - r2 * Math.sin(th) }); } },
    vektor: { soz: ['v döndükçe u ile aradaki açı değişiyor; izdüşüm ve paralelkenar alanı da onunla değişiyor.', 'As v turns, the angle to u changes, and so do the projection and the area.'],
      ciz: function () { return '<path class="fs-zemin" d="M20 150H310M60 190V10"/><path class="fs-alan" data-a="pk" d="M0 0"/>' + ok(60, 150, 230, 150, 'u', '<tspan font-weight="700">u</tspan>', 236, 154) +
          '<g data-r="v"><line class="fs-ok" data-a="v" x1="60" y1="150" x2="60" y2="150" marker-end="url(#fsUc)"/><text data-a="vt" x="0" y="0" font-weight="700">v</text></g><line class="fs-ar fs-kesik" data-a="iz" x1="0" y1="0" x2="0" y2="0"/><g data-r="th"><text data-a="tht" x="0" y="0">θ</text></g>'; },
      an: function (s, v, t) { var a = .3 + 1.2 * (.5 - .5 * Math.cos(t * .6)), x = 60 + 120 * Math.cos(a), y = 150 - 120 * Math.sin(a);
        set($a(s, 'v'), { x2: x, y2: y }); set($a(s, 'vt'), { x: x + 6, y: y - 4 }); set($a(s, 'iz'), { x1: x, y1: y, x2: x, y2: 150 }); set($a(s, 'pk'), { d: 'M60 150L230 150L' + (x + 170).toFixed(1) + ' ' + y.toFixed(1) + 'L' + x.toFixed(1) + ' ' + y.toFixed(1) + 'Z' }); set($a(s, 'tht'), { x: 60 + 34 * Math.cos(a / 2), y: 150 - 34 * Math.sin(a / 2) + 4 }); } },
    kontur: { soz: ['Eş yükselti eğrileri dağın haritası; gradyan her zaman en dik çıkışı gösterir.', 'Level curves map the hill; the gradient always points uphill steepest.'],
      ciz: function () { return [20, 40, 60, 80].map(function (r) { return '<ellipse class="fs-ar" cx="160" cy="100" rx="' + (r * 1.6) + '" ry="' + r + '"/>'; }).join('') + '<circle class="fs-top" cx="160" cy="100" r="4"/><g data-r="grad"><line class="fs-ok" data-a="gr" x1="0" y1="0" x2="0" y2="0" marker-end="url(#fsUc)"/><circle class="fs-top fs-top2" data-a="p" r="5"/></g>'; },
      an: function (s, v, t) { var a = t * .5, x = 160 + 96 * Math.cos(a), y = 100 + 60 * Math.sin(a), gx = (x - 160) / 2.56, gy = (y - 100), n = Math.hypot(gx, gy) || 1; set($a(s, 'p'), { cx: x, cy: y }); set($a(s, 'gr'), { x1: x, y1: y, x2: x - 34 * gx / n, y2: y - 34 * gy / n }); } },
    donme: { soz: ['Disk ω açısal hızıyla dönüyor; tork onu hızlandırır, eylemsizlik momenti direnir.', 'The disk spins at ω; torque speeds it up, the moment of inertia resists.'],
      ciz: function () { return '<g data-r="I"><circle class="fs-cizgi" cx="140" cy="100" r="70"/></g><g data-a="kol"><line class="fs-cizgi" data-r="r" x1="140" y1="100" x2="210" y2="100"/><circle class="fs-top" cx="210" cy="100" r="6"/></g><circle class="fs-top" cx="140" cy="100" r="5"/>' +
          '<g data-r="w"><path class="fs-ar" d="M140 18a82 82 0 0 1 70 40" marker-end="url(#fsUc)"/><text x="196" y="26">ω</text></g>' + ok(240, 140, 240, 80, 'F', it('F'), 246, 96) + '<g data-r="th"></g><g data-r="al"></g>'; },
      an: function (s, v, t) { var w = sinir((v.w || v.w0 || 2) * .25, .3, 4); set($a(s, 'kol'), { transform: 'rotate(' + (-(t * w * 57.3) % 360).toFixed(1) + ' 140 100)' }); } },
    manyetik: { soz: ['Akım taşıyan tel çevresinde halka şeklinde bir manyetik alan oluşturuyor.', 'A current-carrying wire makes a ring-shaped magnetic field around it.'],
      ciz: function () { return '<g data-r="I"><circle class="fs-top" cx="160" cy="100" r="10"/><circle cx="160" cy="100" r="3" fill="#123a2e"/></g>' + [34, 58, 84].map(function (r, i) { return '<circle class="fs-ar fs-kesik" cx="160" cy="100" r="' + r + '"/><g data-a="m' + i + '"><path class="fs-ok" d="M' + (160 + r) + ' 104V96" marker-end="url(#fsUc)"/></g>'; }).join('') + '<g data-r="B"><text x="256" y="40">' + it('B') + '</text></g>' + aralik(160, 244, 180, 'r', it('r')); },
      an: function (s, v, t) { for (var i = 0; i < 3; i++) set($a(s, 'm' + i), { transform: 'rotate(' + (-(t * (50 - i * 12)) % 360).toFixed(1) + ' 160 100)' }); } },
    matris: { soz: ['Matris düzlemi büküyor: birim kare paralelkenara dönüşüyor, alanı det kadar ölçekleniyor.', 'The matrix bends the plane: the unit square becomes a parallelogram scaled by det.'],
      ciz: function () { return '<g data-a="izg"></g><path class="fs-alan" data-a="kare" d="M0 0"/><g data-r="a"></g><g data-r="d"></g>'; },
      an: function (s, v, t) { var a = v.a != null ? v.a : 1.4, b = v.b != null ? v.b : .6, c = v.c != null ? v.c : .3, d = v.d != null ? v.d : 1.1, u = .5 - .5 * Math.cos(t * .8), A = [1 + (a - 1) * u, b * u, c * u, 1 + (d - 1) * u];
        var P = function (x, y) { return [160 + 22 * (A[0] * x + A[1] * y), 100 - 22 * (A[2] * x + A[3] * y)]; }, h = '';
        for (var i = -4; i <= 4; i++) { var p1 = P(i, -4), p2 = P(i, 4), q1 = P(-4, i), q2 = P(4, i); h += '<line class="fs-izgara" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/><line class="fs-izgara" x1="' + q1[0].toFixed(1) + '" y1="' + q1[1].toFixed(1) + '" x2="' + q2[0].toFixed(1) + '" y2="' + q2[1].toFixed(1) + '"/>'; }
        var g = $a(s, 'izg'); if (g) g.innerHTML = h; var o = P(0, 0), e1 = P(1, 0), e3 = P(1, 1), e2 = P(0, 1); set($a(s, 'kare'), { d: 'M' + o.join(' ') + 'L' + e1.join(' ') + 'L' + e3.join(' ') + 'L' + e2.join(' ') + 'Z' }); } },
    yon: { soz: ['Her küçük çizgi o noktadaki eğim; çözüm eğrisi bu çizgileri izleyerek akıyor.', 'Each small segment is the slope there; the solution flows along them.'],
      ciz: function () { var h = ''; for (var i = 0; i < 13; i++) for (var j = 0; j < 8; j++) { var x = (i - 1) * .5, y = (j - 3.5) * .6, m = x - y, a = Math.atan(m), cx = 40 + i * 22, cy = 100 - (j - 3.5) * 22; h += '<line class="fs-izgara fs-yon" x1="' + (cx - 7 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + 7 * Math.sin(a)).toFixed(1) + '" x2="' + (cx + 7 * Math.cos(a)).toFixed(1) + '" y2="' + (cy - 7 * Math.sin(a)).toFixed(1) + '"/>'; }
        return h + '<path class="fs-cizgi" data-a="coz" d="M0 0"/><circle class="fs-top fs-top2" data-a="p" r="5"/>'; },
      an: function (s, v, t) { var u = (t % 5) / 4.5; if (u > 1) u = 1; var d = '', X = function (x) { return 40 + (x + .5) * 44; }, Yf = function (y) { return 100 - y / .6 * 22; }, fy = function (x) { return x - 1 + 2.2 * Math.exp(-x); }, x1 = -.5 + 6 * u;
        for (var i = 0; i <= 50; i++) { var x = -.5 + (x1 + .5) * i / 50; d += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Yf(fy(x)).toFixed(1); } set($a(s, 'coz'), { d: d }); set($a(s, 'p'), { cx: X(x1), cy: Yf(fy(x1)) }); } },
    venn: { soz: ['A ve B kesiştikçe ortak bölge büyüyor; koşullu olasılık bu bölgenin B’ye oranı.', 'As A and B overlap, the shared region grows; conditional probability is its share of B.'],
      ciz: function () { return '<rect class="fs-zemin" x="20" y="20" width="280" height="160" rx="6" fill="none"/><g data-r="pa"><g data-a="A"><circle class="fs-venn" cx="0" cy="100" r="58"/><text x="-30" y="56">' + it('A') + '</text></g></g><g data-r="pb"><g data-a="B"><circle class="fs-venn fs-venn2" cx="0" cy="100" r="58"/><text x="30" y="56">' + it('B') + '</text></g></g><g data-r="pab"></g>'; },
      an: function (s, v, t) { var d = 40 + 30 * Math.cos(t * .7); set($a(s, 'A'), { transform: 'translate(' + (160 - d).toFixed(1) + ' 0)' }); set($a(s, 'B'), { transform: 'translate(' + (160 + d).toFixed(1) + ' 0)' }); } },
    cubuk: { soz: ['Her çubuk bir sonucun olasılığı; hepsinin toplamı 1.', 'Each bar is the probability of one outcome; they add up to 1.'],
      ciz: function () { return '<path class="fs-zemin" d="M20 170H310"/><g data-a="cub"></g><g data-r="n"></g><g data-r="p"></g><g data-r="k"></g>'; },
      an: function (s, v, t) { var n = sinir(Math.round(v.n || 10), 1, 14), p = v.p != null ? sinir(v.p, .01, .99) : .3, g = $a(s, 'cub'), u = Math.min(1, (t % 6) / 1.5), k0 = v.k, key = n + '|' + p + '|' + k0 + '|' + u.toFixed(2); if (!g || g.__k === key) return; g.__k = key; var h = '', w = 280 / (n + 1), mx = 0, ps = [];
        for (var k = 0; k <= n; k++) { var q = FO.comb(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k); ps.push(q); mx = Math.max(mx, q); }
        ps.forEach(function (q, k) { var hh = 140 * q / mx * u; h += '<rect class="fs-dik' + (k === k0 ? ' fs-dik-on' : '') + '" x="' + (24 + k * w).toFixed(1) + '" y="' + (170 - hh).toFixed(1) + '" width="' + (w * .8).toFixed(1) + '" height="' + hh.toFixed(1) + '"/>'; if (n <= 10) h += '<text x="' + (24 + k * w + w * .4).toFixed(1) + '" y="188" text-anchor="middle">' + k + '</text>'; }); g.innerHTML = h; } },
    kok: { soz: ['Teğetin x eksenini kestiği yer yeni tahmin; birkaç adımda köke kilitleniyor.', 'Where the tangent hits the axis is the next guess; it locks onto the root in a few steps.'],
      ciz: function () { var X = function (x) { return 30 + x * 80; }, Yf = function (y) { return 140 - y * 22; };
        return '<path class="fs-zemin" d="M20 140H310"/><path class="fs-cizgi" d="' + egriYol(function (x) { return x * x - 2; }, 0, 3.4, X, Yf) + '"/><circle class="fs-top" cx="' + X(Math.SQRT2) + '" cy="140" r="4"/><g data-a="adim"></g><text data-a="nt" x="300" y="190" text-anchor="end" class="fs-not"></text>'; },
      an: function (s, v, t) { var n = Math.floor((t % 6) / 1.4), g = $a(s, 'adim'); if (!g || g.__n === n) return; g.__n = n; var X = function (x) { return 30 + x * 80; }, Yf = function (y) { return 140 - y * 22; }, x = 3.2, h = '';
        for (var i = 0; i < n; i++) { var y = x * x - 2, x2 = x - y / (2 * x); h += '<line class="fs-ar fs-kesik" x1="' + X(x).toFixed(1) + '" y1="140" x2="' + X(x).toFixed(1) + '" y2="' + Yf(y).toFixed(1) + '"/><line class="fs-ok" x1="' + X(x).toFixed(1) + '" y1="' + Yf(y).toFixed(1) + '" x2="' + X(x2).toFixed(1) + '" y2="140"/><circle class="fs-top fs-top2" cx="' + X(x2).toFixed(1) + '" cy="140" r="4"/>'; x = x2; }
        g.innerHTML = h; $a(s, 'nt').textContent = 'x' + n + ' = ' + x.toFixed(5); } },
    interp: { soz: ['Önce ölçüm noktaları konuyor, sonra hepsinden geçen tek bir polinom çiziliyor.', 'First the data points, then the one polynomial through all of them.'],
      ciz: function () { var P = [[40, 140], [110, 70], [180, 110], [250, 50], [300, 90]]; return EKSEN + P.map(function (p, i) { return '<circle class="fs-top" data-a="n' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="5" opacity="0"/>'; }).join('') + '<path class="fs-cizgi" data-a="pol" d="M40 140"/>'; },
      an: function (s, v, t) { var P = [[40, 140], [110, 70], [180, 110], [250, 50], [300, 90]], u = (t % 6) / 5; for (var i = 0; i < 5; i++) set($a(s, 'n' + i), { opacity: u * 5 > i * .5 ? 1 : 0 }); var k = Math.max(0, Math.min(1, (u - .5) * 2)), d = '';
        if (k > 0) { for (var j = 0; j <= 60 * k; j++) { var x = 40 + 260 * j / 60, y = 0; for (var a = 0; a < 5; a++) { var L = 1; for (var b = 0; b < 5; b++) if (b !== a) L *= (x - P[b][0]) / (P[a][0] - P[b][0]); y += P[a][1] * L; } d += (j ? 'L' : 'M') + x.toFixed(1) + ' ' + sinir(y, 5, 195).toFixed(1); } } set($a(s, 'pol'), { d: d || 'M40 140' }); } }
  };
  var KONU = { calc1: { limit: 'limit', turev: 'kesen', uyg: 'egri', integral: 'alan', iuyg: 'disk' }, calc2: { teknik: 'alan', seri: 'seri', kutupsal: 'kutup', vektor: 'vektor', cok: 'kontur', katli: 'kontur' },
    fiz1: { kin: 'atis', newton: 'kutu', enerji: 'yukseklik', mom: 'carpisma', donme: 'donme', salinim: 'sarkac' }, fiz2: { elektro: 'yukler', sigac: 'levha', devre: 'devre', manyetik: 'manyetik', induk: 'manyetik' },
    lin: { matris: 'matris', sistem: 'matris', uzay: 'vektor', oz: 'matris', ortho: 'vektor' }, dif: { bir: 'yon', model: 'buyume', iki: 'yay', laplace: 'ustel', sistem: 'yon' },
    ist: { olas: 'venn', kesikli: 'cubuk', surekli: 'dagilim', cikarim: 'dagilim' }, say: { hata: 'egri', kok: 'kok', interp: 'interp', turev: 'egri', sayint: 'alan', lsis: 'matris', ode: 'yon' } };
  var OZEL = { 'turev-tanim': 'kesen', 'lhopital': 'limit', 'sinx-x': 'limit', 'euler-e': 'seri', 'geo-seri': 'seri', 'taylor': 'seri', 'maclaurin': 'seri', 'tork': 'donme', 'kutle-cekim': 'yukler', 'gauss': 'yukler', 'ozdeger': 'matris', 'det2': 'matris', 'dondurme': 'matris', 'aci': 'vektor', 'izdusum': 'vektor', 'vektor-boy': 'vektor', 'vektorel': 'vektor', 'kosullu': 'venn', 'bayes': 'venn', 'toplama': 'venn', 'bagimsiz-olay': 'venn', 'binom': 'cubuk', 'poisson': 'cubuk', 'geometrik': 'cubuk', 'hipergeo': 'cubuk', 'binom-sd': 'cubuk', 'newton-raphson': 'kok', 'karekok-newton': 'kok', 'ikiye-bolme': 'kok', 'kiris': 'kok', 'regula': 'kok', 'sabit-nokta': 'kok', 'ikiye-adim': 'kok', 'kismi': 'kontur', 'gradyan': 'kontur', 'lagrange': 'kontur', 'cift-katli': 'kontur', 'kartezyen-kutupsal': 'kutup', 'kutupsal-alan': 'kutup', 'solenoid': 'manyetik', 'duz-tel': 'manyetik', 'aki': 'manyetik', 'trafo': 'manyetik', 'hareketli-cubuk': 'manyetik', 'dalga': 'manyetik', 'lorentz': 'manyetik', 'ozdirenc': 'devre', 'duzlem-yuk': 'levha', 'cizgi-yuk': 'yukler', 'kacis': 'yukseklik', 'merkezcil': 'donme', 'guc': 'kutu', 'egik-duzlem': 'rampa' };
  function sahneSec(f) { if (OZEL[f.id]) return OZEL[f.id]; if (f.sh && f.sh !== 'olcu' && SAHNE[f.sh]) return f.sh; return (KONU[f.d] || {})[f.k] || 'egri'; }

  /* ---------- tahta durumu ---------- */
  var el = null, adimlar = [], i = 0, zaman = null, f = null, deg = null, dil = 'tr', sc = null, raf = 0, t0 = 0, ornekQ = null, araQ = null, araBekle = false, ses = al('ses', true), hiz = al('hiz', 1), konusma = null, oynuyor = false, adimBas = 0;
  function app() { return W.FORMULO_APP || { sayi: function (n) { return String(+(+n).toPrecision(4)); } }; }
  function T() { return Y[dil]; }
  function ad(o) { return dil === 'en' ? (o.en || o.tr) : o.tr; }
  function sembolMetin(key) { var t = D.createElement('div'); t.innerHTML = f.h || ''; var e = t.querySelector('[data-v="' + key + '"]'); return e ? e.textContent : key; }
  function degMetin(key) { var q = f.v[key]; return app().sayi(deg[key]) + (q.u ? ' ' + q.u : ''); }
  function duz(h) { return String(h).replace(/<sup>/g, '^').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }

  function kurAdimlar() {
    var a = [], L = T(), S2 = W.FORMULO_SORU, U = W.FORMULO_URET;
    a.push({ tip: 'yaz', s: L.yaz(f) });
    if (f.v && f.o) {
      Object.keys(f.v).forEach(function (k, n) { a.push({ tip: 'v', k: k, c: RENK[n % RENK.length], s: L.degisken(sembolMetin(k), ad(f.v[k]), degMetin(k)) }); });
      var r = f.o.f(deg), sm = L.sonuc('§', ad(f.o), app().sayi(r) + (f.o.u ? ' ' + f.o.u : ''));
      a.push({ tip: 'sonuc', s: sm.replace('§', f.o.s), h: esc(sm).replace('§', FO.os(f.o.s)) });
    } else {
      (f.anl || []).forEach(function (x) { a.push({ tip: 'not', s: ad(x) }); });
      (f.tablo || []).forEach(function (r, n) { a.push({ tip: 'satir', n: n, s: L.tablo + (dil === 'en' ? r[2] : r[1]) + '.' }); });
      if (f.not) a.push({ tip: 'not', s: ad(f.not) });
    }
    a.push({ tip: 'canli', s: (sc && sc.soz ? sc.soz[dil === 'en' ? 1 : 0] + ' ' : '') + (f.v ? L.canli : '') });
    /* ara soru: hesaplanan formülde orantı, sembolikte konunun şıklı sorusu */
    araQ = null;
    if (U) { araQ = f.o ? U.oranSoru(f, deg) : null; if (!araQ) araQ = U.mcIcin(f); }
    if (araQ) a.push({ tip: 'ara', s: L.ara + duz(araQ.metin), h: esc(L.ara) + araQ.metin });
    /* örnek soru: formüle bağlı üretici ya da sayısal kolay soru */
    ornekQ = null;
    if (U && S2) { var gq = U.formulIcin(f); if (gq && (gq.f === f.id || !f.o)) ornekQ = S2.genQ(gq); }
    if (!ornekQ && S2 && f.o) ornekQ = S2.kolayIcin(f);
    if (!ornekQ && S2) { var komsu = FO.formuller.filter(function (x) { return x.o && x.d === f.d && x.k === f.k; }); if (!komsu.length) komsu = FO.formuller.filter(function (x) { return x.o && x.d === f.d; }); if (komsu.length) ornekQ = S2.kolayIcin(komsu[Math.floor(Math.random() * komsu.length)]); }
    if (ornekQ) {
      a.push({ tip: 'ornek', s: L.ornek + ' ' + duz(S2.soruMetni(ornekQ)) });
      S2.adimlar(ornekQ).forEach(function (st, n) { a.push({ tip: 'coz', n: n, b: st.b, s: st.b + '. ' + duz(st.h) }); });
    }
    a.push({ tip: 'son', s: L.son });
    return a;
  }
  function olcuHTML() {
    if (!f.v) return '';
    return '<div class="fs-olcu" aria-label="' + T().olcu + '">' + Object.keys(f.v).map(function (k) {
      var q = f.v[k], p = Math.max(0, Math.min(1, (deg[k] - q.min) / ((q.max - q.min) || 1)));
      return '<label class="fs-olcu-s" data-r="' + k + '"><b>' + esc(sembolMetin(k)) + '</b><span class="fs-olcu-ray"><i style="width:' + (p * 100).toFixed(1) + '%"></i><input type="range" min="' + q.min + '" max="' + q.max + '" step="' + q.st + '" value="' + deg[k] + '" data-fs-k="' + k + '" aria-label="' + esc(ad(q)) + '"></span><em>' + esc(degMetin(k)) + '</em></label>';
    }).join('') + (f.o ? '<p class="fs-olcu-son"><span>' + FO.os(f.o.s) + ' · ' + esc(T().sonucY) + '</span><b data-fs-son>' + esc(app().sayi(f.o.f(deg))) + '</b> ' + esc(f.o.u) + '</p>' : '') + '</div>';
  }
  function ornekHTML() { return FO.yerine(f, deg, function (n) { return esc(app().sayi(n)); }, 'fs-d'); }
  function sahneCiz(ilk) {
    var kut = el.querySelector('[data-fs-sahne]'); if (!kut || !sc) return;
    kut.innerHTML = '<svg viewBox="0 0 320 200" role="img" aria-label="' + esc(ad(f)) + '">' + OK + sc.ciz(deg, f) + '</svg>';
    var svg = kut.firstChild;
    if (ilk && !SAKIN) svg.querySelectorAll('.fs-cizgi:not(.fs-kesik),.fs-zemin:not(.fs-kesik),.fs-ar:not(.fs-kesik):not(.fs-akis)').forEach(function (p, n) { p.setAttribute('pathLength', '1'); p.classList.add('fs-ciz'); p.style.animationDelay = (.3 + n * .09 / hiz).toFixed(2) + 's'; });
    if (sc.an) sc.an(svg, deg, SAKIN ? 1.3 : (performance.now() - t0) / 1000 * hiz * SAKIN_HIZ);
  }
  var SAKIN_HIZ = .8, uyanik = 0;
  function dongu(now) { if (!el) return; raf = 0; if (now - uyanik > 24000 || D.hidden) return; var svg = el.querySelector('[data-fs-sahne] svg'); if (svg && sc && sc.an) sc.an(svg, deg, (now - t0) / 1000 * hiz * SAKIN_HIZ); raf = requestAnimationFrame(dongu); }
  function uyandir() { uyanik = performance.now(); if (!raf && !SAKIN && el) raf = requestAnimationFrame(dongu); }

  function ac(formul, degerler) {
    kapat();
    f = formul; dil = (W.FORMULO_APP && W.FORMULO_APP.dil()) || 'tr';
    deg = {}; if (f.v) Object.keys(f.v).forEach(function (k) { deg[k] = degerler && degerler[k] != null ? degerler[k] : f.v[k].val; });
    sc = SAHNE[sahneSec(f)] || null; adimlar = kurAdimlar(); i = 0;
    var ders = FO.dersler.filter(function (d) { return d.id === f.d; })[0], L = T();
    el = D.createElement('div'); el.className = 'fs-ort'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L.baslik + ': ' + ad(f));
    el.style.setProperty('--c', ders.renk); el.style.setProperty('--hiz', hiz);
    el.innerHTML = '<div class="fs-tahta">' +
      '<header class="fs-bas"><span class="fs-eyb">' + esc(ders.kod) + ' · ' + L.baslik + '</span><h2>' + esc(ad(f)) + '</h2><button type="button" class="fs-x" data-fs-kapat aria-label="' + L.kapat + '">×</button></header>' +
      '<div class="fs-govde">' +
        '<div class="fs-yazi"><div class="fo-f fs-f" data-fs-f>' + (f.h || '') + '<span class="fs-cetvel" data-fs-cetvel aria-hidden="true"></span><span class="fs-tebesir" aria-hidden="true"></span></div>' +
          (f.v ? '<div class="fo-f fs-f fs-f-ornek" data-fs-ornek hidden>' + ornekHTML() + ' <span class="fs-esit">= <b>' + esc(app().sayi(f.o.f(deg))) + '</b> ' + esc(f.o.u) + '</span></div>' : '') +
          (f.tablo ? '<div class="fs-tablo">' + f.tablo.map(function (r, n) { return '<div class="fs-tr" data-satir="' + n + '"><span class="fo-f fo-f-s fs-f fs-f-s">' + r[0] + '</span><span>' + esc(dil === 'en' ? r[2] : r[1]) + '</span></div>'; }).join('') + '</div>' : '') +
          '<div class="fs-defter" data-fs-defter></div>' +
        '</div>' +
        '<div class="fs-sahne" data-fs-sahne></div>' + olcuHTML() +
        '<div class="fs-acadia"><span class="fs-acd" data-fs-acd>' + W.FO_ACADIA({ mood: 'odakli', pose: 'isaret', size: 92 }) +
          '<svg class="fs-elcetvel" viewBox="0 0 100 16" aria-hidden="true"><rect x="1" y="1" width="98" height="14" rx="2"/>' + Array.apply(null, Array(19)).map(function (_, n) { return '<line x1="' + (5 + n * 5) + '" y1="1" x2="' + (5 + n * 5) + '" y2="' + (n % 2 ? 6 : 9) + '"/>'; }).join('') + '</svg></span>' +
          '<div class="fs-konus"><p class="fs-balon" data-fs-balon aria-live="polite"></p><div class="fs-ara" data-fs-ara hidden></div></div></div>' +
      '</div>' +
      '<svg class="fs-oklar" data-fs-oklar aria-hidden="true"></svg>' +
      '<footer class="fs-alt"><button type="button" class="fs-dg" data-fs-geri aria-label="' + L.geri + '">◀</button><button type="button" class="fs-dg fs-oyn" data-fs-oyn aria-label="' + L.oynat + '">▶</button><button type="button" class="fs-dg" data-fs-ileri aria-label="' + L.ileri + '">▶▶</button>' +
        '<div class="fs-noktalar">' + adimlar.map(function (a, n) { return '<button type="button" data-fs-n="' + n + '" class="fs-n-' + a.tip + '" aria-label="' + L.adim + ' ' + (n + 1) + '"></button>'; }).join('') + '</div>' +
        '<div class="fs-ayar"><div class="fs-hiz" role="radiogroup" aria-label="' + L.hiz + '">' + [0.75, 1, 1.5].map(function (h) { return '<button type="button" role="radio" data-fs-hiz="' + h + '" aria-checked="' + (h === hiz) + '">' + String(h).replace('.', dil === 'en' ? '.' : ',') + '×</button>'; }).join('') + '</div>' +
        ('speechSynthesis' in W ? '<button type="button" class="fs-dg fs-ses" data-fs-ses aria-pressed="' + ses + '" aria-label="' + L.ses + '" title="' + L.ses + '">' + (ses ? '🔊' : '🔇') + '</button>' : '') +
        '<span class="fs-say" data-fs-say></span></div></footer>' +
      '</div>';
    D.body.appendChild(el); D.body.classList.add('fs-acik');
    t0 = performance.now(); sahneCiz(true); uyandir();
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-fs-kapat]')) kapat(); });
    el.querySelector('[data-fs-geri]').addEventListener('click', function () { durdur(); git(i - 1); });
    el.querySelector('[data-fs-ileri]').addEventListener('click', function () { durdur(); git(i + 1); });
    el.querySelector('[data-fs-oyn]').addEventListener('click', function () { oynuyor ? durdur() : oynat(); });
    el.querySelectorAll('[data-fs-n]').forEach(function (b) { b.addEventListener('click', function () { durdur(); git(+b.getAttribute('data-fs-n')); }); });
    el.querySelectorAll('[data-fs-hiz]').forEach(function (b) { b.addEventListener('click', function () { hiz = +b.getAttribute('data-fs-hiz'); koy('hiz', hiz); el.style.setProperty('--hiz', hiz); el.querySelectorAll('[data-fs-hiz]').forEach(function (x) { x.setAttribute('aria-checked', x === b); }); }); });
    var sb = el.querySelector('[data-fs-ses]'); if (sb) sb.addEventListener('click', function () { ses = !ses; koy('ses', ses); sb.setAttribute('aria-pressed', ses); sb.textContent = ses ? '🔊' : '🔇'; if (!ses) { W.speechSynthesis.cancel(); konusma = null; planla(); } else konus(adimlar[i]); });
    el.querySelectorAll('[data-fs-k]').forEach(function (r) { r.addEventListener('input', function () {
      var k = r.getAttribute('data-fs-k'), q = f.v[k]; deg[k] = +r.value; var lab = r.closest('.fs-olcu-s'); lab.querySelector('em').textContent = degMetin(k); lab.querySelector('i').style.width = (100 * (deg[k] - q.min) / ((q.max - q.min) || 1)).toFixed(1) + '%';
      var son = el.querySelector('[data-fs-son]'); if (son) son.textContent = app().sayi(f.o.f(deg)); sahneCiz(false); uyandir();
      var orn = el.querySelector('[data-fs-ornek]'); if (orn) orn.innerHTML = ornekHTML() + ' <span class="fs-esit">= <b>' + esc(app().sayi(f.o.f(deg))) + '</b> ' + esc(f.o.u) + '</span>';
    }); });
    W.addEventListener('resize', yenidenOk); D.addEventListener('keydown', tus);
    el.querySelector('[data-fs-kapat]').focus({ preventScroll: true });
    requestAnimationFrame(function () { git(0); if (!SAKIN) oynat(); });
  }
  function tus(e) { if (!el || (e.target.closest && e.target.closest('input'))) return; if (e.key === 'Escape') kapat(); else if (e.key === 'ArrowRight') { durdur(); git(i + 1); } else if (e.key === 'ArrowLeft') { durdur(); git(i - 1); } }
  /* oynatma: ses açıksa konuşma bitince, değilse süreyle ilerler; ara soruda cevap bekler */
  function sure(a) { var m = { yaz: 3600, coz: 4200, ornek: 4200, canli: 5400 }[a.tip] || 3400; return Math.max(1800, (m + a.s.length * 18) / hiz); }
  function planla() { clearTimeout(zaman); zaman = null; if (!oynuyor || !el) return; var a = adimlar[i]; if (a.tip === 'ara' && araBekle) return; if (i >= adimlar.length - 1) return durdur(); if (ses && konusma) return; zaman = setTimeout(function () { git(i + 1); }, sure(a)); }
  function oynat() { if (!el) return; oynuyor = true; var b = el.querySelector('[data-fs-oyn]'); b.textContent = '❚❚'; b.setAttribute('aria-label', T().dur); if (i >= adimlar.length - 1) git(0); else planla(); }
  function durdur() { oynuyor = false; clearTimeout(zaman); zaman = null; if (!el) return; var b = el.querySelector('[data-fs-oyn]'); b.textContent = '▶'; b.setAttribute('aria-label', T().oynat); }
  function konus(a) {
    if (!('speechSynthesis' in W)) return; var s0 = W.speechSynthesis; s0.cancel(); konusma = null; if (!ses || !a) return;
    var u = new W.SpeechSynthesisUtterance(a.s.replace(/[_′]/g, ' ').replace(/·/g, dil === 'en' ? ' times ' : ' çarpı ').replace(/−/g, dil === 'en' ? ' minus ' : ' eksi ')), lang = dil === 'en' ? 'en' : 'tr';
    var vs = s0.getVoices().filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(lang) === 0; }); if (vs[0]) u.voice = vs[0];
    u.lang = dil === 'en' ? 'en-US' : 'tr-TR'; u.rate = Math.min(2, .95 * hiz); konusma = u;
    u.onend = u.onerror = function () { if (konusma !== u) return; konusma = null; if (!oynuyor) return; clearTimeout(zaman); var a2 = adimlar[i]; if (a2.tip === 'ara' && araBekle) return; var kalan = Math.max(700 / hiz, sure(a2) * .6 - (performance.now() - adimBas)); zaman = setTimeout(function () { if (i < adimlar.length - 1) git(i + 1); else durdur(); }, kalan); };
    s0.speak(u);
    setTimeout(function () { if (konusma === u && !s0.speaking && !s0.pending) { konusma = null; planla(); } }, 1500); /* ses motoru yoksa takılma */
  }
  function kapat() {
    durdur(); cancelAnimationFrame(raf); raf = 0; if ('speechSynthesis' in W) W.speechSynthesis.cancel(); konusma = null; if (!el) return; el.remove(); el = null; D.body.classList.remove('fs-acik');
    W.removeEventListener('resize', yenidenOk); D.removeEventListener('keydown', tus);
  }
  var sonOk = null;
  function yenidenOk() { if (sonOk) okCiz(sonOk.k, sonOk.c); }
  /* örnek soru ve çözüm satırları adım n'e kadar tahtaya yazılır (geri gidince silinir) */
  function defterYaz(n) {
    var df = el.querySelector('[data-fs-defter]'); if (!df || !ornekQ) return;
    var hedef = -1; for (var m = 0; m <= n; m++) { if (adimlar[m].tip === 'ornek') hedef = Math.max(hedef, 0); if (adimlar[m].tip === 'coz') hedef = adimlar[m].n + 1; }
    if (hedef < 0) { df.innerHTML = ''; return; }
    while (df.children.length - 1 > hedef) df.lastChild.remove();
    if (!df.children.length) df.insertAdjacentHTML('beforeend', '<div class="fs-satir fs-soru"><b>' + esc(T().soru) + '</b><div>' + W.FORMULO_SORU.soruMetni(ornekQ) + (ornekQ.mc ? '<ol class="fs-sik">' + ornekQ.mc.map(function (m) { return '<li>' + m + '</li>'; }).join('') + '</ol>' : '') + '</div></div>');
    var st = W.FORMULO_SORU.adimlar(ornekQ);
    for (var k = df.children.length - 1; k < hedef; k++) df.insertAdjacentHTML('beforeend', '<div class="fs-satir"><b>' + (k + 1) + '. ' + esc(st[k].b) + '</b><div>' + st[k].h + '</div></div>');
    var son = df.lastChild; if (son && son.scrollIntoView) son.scrollIntoView({ block: 'nearest', behavior: SAKIN ? 'auto' : 'smooth' });
  }
  function araGoster(a) {
    var kut = el.querySelector('[data-fs-ara]'); if (a.tip !== 'ara' || !araQ) { kut.hidden = true; kut.innerHTML = ''; araBekle = false; return; }
    kut.hidden = false; araBekle = true;
    kut.innerHTML = '<p class="fs-ara-not">' + esc(T().cevapla) + '</p><div class="fs-ara-s">' + araQ.mc.map(function (m, n) { return '<button type="button" data-fs-ara-s="' + n + '"><i>' + 'ABCD'[n] + '</i><span>' + m + '</span></button>'; }).join('') + '</div>';
    kut.querySelectorAll('[data-fs-ara-s]').forEach(function (b) { b.addEventListener('click', function () {
      if (!araBekle) return; araBekle = false; var n = +b.getAttribute('data-fs-ara-s'), dogru = n === araQ.dogruI;
      kut.querySelectorAll('[data-fs-ara-s]').forEach(function (x, j) { x.disabled = true; if (j === araQ.dogruI) x.classList.add('fs-dogru'); else if (j === n) x.classList.add('fs-yanlis'); });
      var bal = el.querySelector('[data-fs-balon]'), m = dogru ? T().araOk : T().araNo; bal.textContent = m; acadia(dogru ? 'kutlama' : 'dusunuyor', dogru ? 'zipla' : 'dusun');
      var dev = function () { if (i < adimlar.length - 1) git(i + 1); };
      if (!oynuyor) { oynuyor = true; var ob = el.querySelector('[data-fs-oyn]'); ob.textContent = '❚❚'; ob.setAttribute('aria-label', T().dur); }
      adimBas = performance.now() - sure(adimlar[i]) * .6 + 2200 / hiz; if (ses && 'speechSynthesis' in W) konus({ s: m }); else { clearTimeout(zaman); zaman = setTimeout(dev, 2200 / hiz); }
    }); });
  }
  function acadia(mood, pose) { var acd = el.querySelector('[data-fs-acd]'); if (!acd || !W.AcadiaKit) return; var s = acd.querySelector('svg.acd'); if (s) { s.insertAdjacentHTML('afterend', W.FO_ACADIA({ mood: mood, pose: pose, size: 92 })); s.remove(); } }
  function git(n) {
    if (!el) return; i = Math.max(0, Math.min(adimlar.length - 1, n)); var a = adimlar[i]; adimBas = performance.now();
    el.querySelectorAll('[data-fs-n]').forEach(function (b, m) { b.classList.toggle('on', m === i); b.classList.toggle('gecti', m < i); });
    el.querySelector('[data-fs-say]').textContent = (i + 1) + '/' + adimlar.length;
    var balon = el.querySelector('[data-fs-balon]'); balon.innerHTML = a.h || esc(a.tip === 'coz' ? a.b : a.tip === 'ornek' ? T().ornek : a.s); balon.classList.remove('fs-yeni'); void balon.offsetWidth; balon.classList.add('fs-yeni');
    var fx = el.querySelector('[data-fs-f]'), ornek = el.querySelector('[data-fs-ornek]'), tah = el.querySelector('.fs-tahta');
    /* formül tebeşirle yazılır (ilk adımda); sonra terimler sırayla renklenir */
    fx.classList.remove('fs-yaziyor'); if (a.tip === 'yaz' && !SAKIN) { void fx.offsetWidth; fx.classList.add('fs-yaziyor'); }
    fx.classList.toggle('fs-kur', !!f.v && a.tip === 'v'); fx.classList.toggle('fs-tam', a.tip !== 'v');
    fx.querySelectorAll('.fv').forEach(function (v) { v.classList.remove('fs-on', 'fs-gecti'); v.style.removeProperty('--rc'); });
    el.querySelectorAll('[data-r]').forEach(function (r) { r.classList.remove('fs-on'); r.style.removeProperty('--k'); });
    el.querySelectorAll('[data-satir]').forEach(function (r) { r.classList.toggle('fs-on', a.tip === 'satir' && +r.getAttribute('data-satir') === a.n); });
    for (var m = 1; m < adimlar.length; m++) if (adimlar[m].tip === 'v' && (m < i || a.tip !== 'v')) fx.querySelectorAll('.fv[data-v="' + adimlar[m].k + '"]').forEach(function (v) { v.classList.add('fs-gecti'); v.style.setProperty('--rc', adimlar[m].c); });
    if (ornek) ornek.hidden = a.tip !== 'sonuc';
    tah.classList.toggle('fs-ornekte', a.tip === 'ornek' || a.tip === 'coz' || (a.tip === 'son' && !!ornekQ));
    tah.classList.toggle('fs-canlida', a.tip === 'canli');
    defterYaz(i); araGoster(a);
    var cet = el.querySelector('[data-fs-cetvel]'), hedef = null;
    sonOk = null; el.querySelector('[data-fs-oklar]').innerHTML = '';
    if (a.tip === 'v') {
      var vs = fx.querySelectorAll('.fv[data-v="' + a.k + '"]'); vs.forEach(function (v) { v.classList.add('fs-on'); v.style.setProperty('--rc', a.c); }); hedef = vs[0];
      var rol = (f.map && f.map[a.k]) || a.k;
      el.querySelectorAll('.fs-sahne [data-r="' + rol + '"]').forEach(function (r) { r.classList.add('fs-on'); r.style.setProperty('--k', a.c); });
      var ol = el.querySelector('.fs-olcu [data-r="' + a.k + '"]'); if (ol) { ol.classList.add('fs-on'); ol.style.setProperty('--k', a.c); }
      sonOk = { k: a.k, c: a.c }; okCiz(a.k, a.c);
    } else if (a.tip === 'sonuc' && ornek) hedef = ornek.querySelector('.fs-esit');
    else if (a.tip === 'satir') hedef = el.querySelector('[data-satir="' + a.n + '"] .fs-f');
    cetvelKoy(cet, hedef, a.c, a.tip);
    var mood = a.tip === 'son' || a.tip === 'sonuc' ? 'kutlama' : a.tip === 'yaz' ? 'mutlu' : a.tip === 'ara' ? 'dusunuyor' : 'odakli', pose = a.tip === 'son' ? 'zipla' : a.tip === 'ornek' || a.tip === 'coz' ? 'oku' : a.tip === 'ara' ? 'dusun' : 'isaret';
    acadia(mood, pose);
    if (a.tip === 'canli') t0 = performance.now(); uyandir();
    konus(a); planla();
  }
  function cetvelKoy(cet, hedef, renk, tip) {
    if (!cet) return; var kutu = cet.parentNode;
    if (!hedef) { cet.style.opacity = tip === 'yaz' || tip === 'ornek' || tip === 'coz' || tip === 'ara' ? '0' : '1'; cet.style.left = '0px'; cet.style.width = '100%'; cet.style.top = (kutu.scrollHeight - 4) + 'px'; cet.style.removeProperty('--k'); kaldir2(); return; }
    if (!kutu.contains(hedef)) { cet.style.opacity = '0'; var r = hedef.getBoundingClientRect(), p = el.querySelector('.fs-tahta').getBoundingClientRect(), c = el.querySelector('.fs-cetvel-2'); if (!c) { c = D.createElement('span'); c.className = 'fs-cetvel fs-cetvel-2'; el.querySelector('.fs-tahta').appendChild(c); } c.style.left = (r.left - p.left - 6) + 'px'; c.style.width = (r.width + 12) + 'px'; c.style.top = (r.bottom - p.top + 4) + 'px'; c.style.setProperty('--k', renk || '#FFD86B'); c.style.opacity = '1'; return; }
    kaldir2(); var rk = kutu.getBoundingClientRect(), rh = hedef.getBoundingClientRect();
    cet.style.opacity = '1'; cet.style.left = (rh.left - rk.left + kutu.scrollLeft - 6) + 'px'; cet.style.width = (rh.width + 12) + 'px'; cet.style.top = (rh.bottom - rk.top + 4) + 'px'; cet.style.setProperty('--k', renk || '#FFD86B');
    if (kutu.scrollWidth > kutu.clientWidth) kutu.scrollTo({ left: Math.max(0, rh.left - rk.left + kutu.scrollLeft - 40), behavior: SAKIN ? 'auto' : 'smooth' });
  }
  function kaldir2() { var c = el && el.querySelector('.fs-cetvel-2'); if (c) c.remove(); }
  function okCiz(key, renk) {
    var svg = el.querySelector('[data-fs-oklar]'), pr = el.querySelector('.fs-tahta').getBoundingClientRect();
    var bas = el.querySelector('[data-fs-f] .fv[data-v="' + key + '"]'), rol = (f.map && f.map[key]) || key;
    var son = el.querySelector('.fs-sahne [data-r="' + rol + '"]') || el.querySelector('.fs-olcu [data-r="' + key + '"]');
    svg.setAttribute('viewBox', '0 0 ' + pr.width + ' ' + pr.height); svg.innerHTML = '';
    if (!bas || !son) return; var a = bas.getBoundingClientRect(), b = son.getBoundingClientRect(); if (!a.width || !b.width) return;
    var yan = b.left > a.right + 20, x1, y1, x2, y2, cx, cy;
    if (yan) { x1 = a.right - pr.left + 6; y1 = a.top + a.height / 2 - pr.top; x2 = b.left - pr.left - 4; y2 = b.top + b.height / 2 - pr.top; cx = (x1 + x2) / 2; cy = Math.min(y1, y2) - 50; }
    else { x1 = a.left + a.width / 2 - pr.left; y1 = a.bottom - pr.top + 20; x2 = b.left + Math.min(b.width / 2, 40) - pr.left; y2 = b.top - pr.top - 4; cx = x1; cy = (y1 + y2) / 2; }
    svg.innerHTML = '<defs><marker id="fsUc2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + renk + '"/></marker></defs>' +
      '<path class="fs-ok-cizgi" d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" stroke="' + renk + '" marker-end="url(#fsUc2)"/>';
  }

  W.FORMULO_SAHNE = { ac: ac, kapat: kapat, SAHNE: SAHNE, sahneSec: sahneSec };
})(window);
